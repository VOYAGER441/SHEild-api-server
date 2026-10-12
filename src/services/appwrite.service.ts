// config/appwrite.js
import { Client, Users, Account, OAuthProvider, IdTokenProvider, Models } from "node-appwrite";
import { createHmac, timingSafeEqual } from "crypto";
import env from "@/environment";
import { Log } from "@/utils/logger";
import utils from "@/utils";
import { AppError } from "@/error/AppError";

// lifetime of the signed OAuth state token handed to the client
export const OAUTH_STATE_TTL_SECONDS = 600;

export interface ISignedTokenPayload {
    v: number;
    e: number;
    n?: string;
    r?: string;
    u?: string;
    [key: string]: any;
}

class AppwriteService {

    // create client that only knows the project (no API key, no session).
    // Mirrors what an official client SDK sends, so Appwrite treats the request
    // exactly like a first-party sign-in attempt.
    createProjectClient() {
        return new Client()
            .setEndpoint(env.APPWRITE_ENDPOINT!)
            .setProject(env.APPWRITE_PROJECT_ID!);
    }

    // create admin client
    async createAdminClient() {
        Log.info("AppwriteService:::createAdminClient:::: creating admin client");
        const client = new Client()
            .setEndpoint(env.APPWRITE_ENDPOINT)
            .setProject(env.APPWRITE_PROJECT_ID)
            .setKey(env.APPWRITE_API_KEY);
        Log.info("AppwriteService:::createAdminClient:::: admin client created");
        return {
            client,
            users: new Users(client),
        };
    }

    // create session client
    async createSessionClient(session: string) {
        Log.info("AppwriteService:::createSessionClient:::: creating session client");
        const client = new Client()
            .setEndpoint(env.APPWRITE_ENDPOINT)
            .setProject(env.APPWRITE_PROJECT_ID)
            .setJWT(session);
        Log.info("AppwriteService:::createSessionClient:::: session client created");
        return {
            client,
            account: new Account(client),
        };
    }

    /**
     * Native sign-in: exchange a Google ID token for an Appwrite session.
     *
     * Appwrite itself verifies the token against Google's published signing keys,
     * checks the audience (the web client ID configured under the Google provider),
     * rejects expired tokens and performs account matching/identity linking.
     * The backend is the only party that ever sees the ID token, so no Appwrite
     * session is ever created from the frontend.
     */
    async createIdTokenSession(idToken: string): Promise<Models.Session> {
        Log.info("AppwriteService:::createIdTokenSession:::: requesting Appwrite native sign-in session");

        const account = new Account(this.createProjectClient());

        return await account.createIdTokenSession({
            provider: IdTokenProvider.Google,
            idToken,
        });
    }

    /**
     * The session minted above only exists so Appwrite can resolve the token to a
     * user. Its secret is never handed to a client, so it is cleaned up right away
     * to avoid leaking sessions or hitting Appwrite's per-user session limit.
     */
    async deleteUserSessionQuietly(userId: string, sessionId: string): Promise<void> {
        try {
            const { users } = await this.createAdminClient();
            await users.deleteSession(userId, sessionId);
            Log.info("AppwriteService:::deleteUserSessionQuietly:::: removed temporary sign-in session");
        } catch (error: any) {
            Log.warn(`AppwriteService:::deleteUserSessionQuietly:::: could not remove temporary session: ${error?.message || error}`);
        }
    }

    // <b64url(json)>.<b64url(hmac-sha256(key, b64url(json)))>
    // `e` is always (now + ttl) so callers cannot mint long lived tokens.
    sign(payload: Record<string, any>, ttlSeconds: number): string {
        const encoded = Buffer.from(
            JSON.stringify({
                ...payload,
                e: Math.floor(Date.now() / 1000) + Math.max(1, Math.floor(ttlSeconds)),
            }),
            "utf8"
        ).toString("base64url");
        return `${encoded}.${this._signData(encoded)}`;
    }

    // returns the payload only when the signature matches and `e` is in the future
    verify(token: unknown): ISignedTokenPayload | null {
        if (typeof token !== "string" || token.length === 0 || token.length > 8192) {
            return null;
        }

        const separator = token.indexOf(".");
        if (separator <= 0 || separator === token.length - 1 || token.indexOf(".", separator + 1) !== -1) {
            return null;
        }

        const encoded = token.slice(0, separator);
        const provided = token.slice(separator + 1);
        const expected = this._signData(encoded);

        if (provided.length !== expected.length) {
            return null;
        }
        if (!timingSafeEqual(Buffer.from(provided, "utf8"), Buffer.from(expected, "utf8"))) {
            Log.warn("AppwriteService:::verify:::: signature mismatch, rejecting token");
            return null;
        }

        let payload: ISignedTokenPayload;
        try {
            payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
        } catch (parseError) {
            return null;
        }

        if (!payload || payload.v !== 1 || typeof payload.e !== "number" || payload.e * 1000 <= Date.now()) {
            Log.warn("AppwriteService:::verify:::: token payload invalid or expired");
            return null;
        }

        return payload;
    }

    private _signData(data: string): string {
        return createHmac("sha256", env.JWT_SECRET).update(data, "utf8").digest("base64url");
    }

    // create google login redirect url
    async createGoogleLoginRedirectURL(
        redirectUri: string | undefined,
        fallbackAppUrl: string | undefined,
        nonce: string
    ): Promise<{ url: string; state: string }> {
        Log.info("AppwriteService:::createGoogleLoginRedirectURL:::: creating google login redirect url");

        const client = new Client()
            .setEndpoint(env.APPWRITE_ENDPOINT!)
            .setProject(env.APPWRITE_PROJECT_ID!)
            .setKey(env.APPWRITE_API_KEY!);

        const account = new Account(client);
        Log.info(`AppwriteService:::createGoogleLoginRedirectURL:::: Raw APP_URL: '${env.APP_URL}'`);
        Log.info(`AppwriteService:::createGoogleLoginRedirectURL:::: Fallback APP_URL: '${fallbackAppUrl}'`);

        // Prioritize env.APP_URL so developer configuration (e.g. localhost or tunnel) is respected.
        let appUrl = env.APP_URL || fallbackAppUrl;

        // The OAuth callback is opened in the *device's* browser, so a loopback
        // APP_URL only works when the app and the browser are on this machine.
        // When the app reached us from another host, that host is the one the
        // browser can actually load - use it instead of dead-ending on localhost.
        if (this._isLoopbackUrl(appUrl) && fallbackAppUrl && !this._isLoopbackUrl(fallbackAppUrl)) {
            Log.warn(
                `AppwriteService:::createGoogleLoginRedirectURL:::: APP_URL '${appUrl}' is a loopback address but the app called this server at '${fallbackAppUrl}'. ` +
                `Using '${fallbackAppUrl}' for the OAuth callback. Make sure that hostname is registered in Appwrite Console -> Platforms -> Web ` +
                `(or set APP_URL and EXPO_PUBLIC_BACKEND_BASE_URL to http://localhost:5000 and run 'adb reverse tcp:5000 tcp:5000').`
            );
            appUrl = fallbackAppUrl;
        }

        if (!appUrl || (!appUrl.startsWith("http://") && !appUrl.startsWith("https://"))) {
            const errorMsg = `INVALID Configuration: APP_URL is set to '${appUrl}'. It MUST be a valid HTTP URL pointing to your backend (e.g., 'http://localhost:5000' or 'http://192.168.x.x:5000'). Please update your .env file.`;
            Log.error(errorMsg);
            throw new AppError(errorMsg, utils.http.HttpStatusCodes.INTERNAL_SERVER_ERROR);
        }

        const cleanAppUrl = appUrl.endsWith("/") ? appUrl.slice(0, -1) : appUrl;

        // redirectUri travels only inside the signed state so it cannot be
        // swapped after issuance - a tampered redirect could leak the tokens.
        const state = this.sign({ v: 1, n: nonce, r: redirectUri || "" }, OAUTH_STATE_TTL_SECONDS);
        const stateParam = encodeURIComponent(state);
        const success = `${cleanAppUrl}/v1/auth/oauth/callback?st=${stateParam}`;
        const failure = `${cleanAppUrl}/v1/auth/oauth/callback?st=${stateParam}`;

        Log.info(`AppwriteService:::createGoogleLoginRedirectURL:::: using redirect URLs - Success: ${success}, Failure: ${failure}`);


        let result: string | null = null;
        let lastError: any = null;

        // Try up to 2 times in case of transient network timeouts / fetch failures
        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                const tokenResult = await account.createOAuth2Token(
                    OAuthProvider.Google,
                    success,
                    failure
                );

                if (tokenResult) {
                    result = tokenResult.toString();
                    break;
                }
            } catch (error: any) {
                lastError = error;
                Log.warn(`AppwriteService:::createGoogleLoginRedirectURL:::: attempt ${attempt} failed: ${error?.message || error}`);
                if (attempt < 2 && (error?.message === "fetch failed" || error?.code === "ETIMEDOUT")) {
                    await new Promise((res) => setTimeout(res, 1000));
                }
            }
        }

        if (result) {
            Log.info("AppwriteService:::createGoogleLoginRedirectURL:::: google login redirect url created", result);
            return { url: result, state };
        }

        // If we reach here, handle and diagnose the error
        Log.error("AppwriteService:::createGoogleLoginRedirectURL:::: google login redirect url creation failed", {
            message: lastError?.message,
            code: lastError?.code,
            cause: lastError?.cause,
        });

        let appwriteMessage =
            lastError?.response?.message ||
            lastError?.message ||
            "Unknown Appwrite Error";

        // If node-appwrite failed with "Invalid redirect" or code 400, inspect Appwrite directly to get the exact reason
        if (lastError?.message === "Invalid redirect" || lastError?.code === 400) {
            try {
                const targetUrl = new URL(`${env.APPWRITE_ENDPOINT}/account/tokens/oauth2/google`);
                targetUrl.searchParams.set("success", success);
                targetUrl.searchParams.set("failure", failure);
                const resp = await fetch(targetUrl.toString(), {
                    headers: {
                        "x-appwrite-project": env.APPWRITE_PROJECT_ID!,
                        "x-appwrite-key": env.APPWRITE_API_KEY!,
                    },
                    redirect: "manual",
                });
                const text = await resp.text();
                const match = text.match(/<h1>(.*?)<\/h1>/i);
                if (match && match[1]) {
                    appwriteMessage = match[1];
                }
            } catch (inspectError) {
                Log.warn("AppwriteService:::createGoogleLoginRedirectURL:::: could not inspect Appwrite error body", inspectError);
            }
        }

        if (appwriteMessage.includes("Register your new client") || appwriteMessage.includes("Invalid `success` param")) {
            Log.error(
                `Appwrite OAuth Configuration Error: The redirect hostname is not registered in Appwrite Console.\n` +
                `Go to Appwrite Console -> Project (${env.APPWRITE_PROJECT_ID}) -> Platforms -> Add Platform -> Web App\n` +
                `Add the hostname from your URL: ${cleanAppUrl}`
            );
        }

        Log.error("AppwriteService:::createGoogleLoginRedirectURL:::: Appwrite Response Message", appwriteMessage);

        const statusCode = lastError?.message === "fetch failed"
            ? utils.http.HttpStatusCodes.SERVICE_UNAVAILABLE
            : utils.http.HttpStatusCodes.BAD_REQUEST;

        throw new AppError(appwriteMessage, statusCode);
    }

    // true for http://localhost:5000, http://127.0.0.1:5000, http://[::1]:5000, ...
    private _isLoopbackUrl(url?: string): boolean {
        if (!url) {
            return false;
        }
        try {
            const host = new URL(url).hostname.replace(/^\[|\]$/g, "");
            return host === "localhost" || host === "::1" || host.startsWith("127.");
        } catch {
            return false;
        }
    }

}

export default new AppwriteService();
