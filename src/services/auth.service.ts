import { Account, Client, Users, Models, AppwriteException } from "node-appwrite";
import env from "@/environment";
import appwriteService from "./appwrite.service";
import { Log } from "@/utils/logger";
import { AppError } from "@/error/AppError";
import utils from "@/utils";
import { IAppWriteAccountResponse } from "@/interface/response/appwrite.response";
import userService from "./user.service";
import { IUserCreateRequest } from "@/interface/request/user.request";
import { IJwtRequest, IJwtResponse } from "@/interface/request/jwt.request";

// lifetime of the one-time login code handed to the exchange endpoint
const LOGIN_CODE_TTL_SECONDS = 120;

class AuthService {
    // single-use registries (token -> expiry epoch ms), evicted lazily
    private _usedStateTokens = new Map<string, number>();
    private _issuedLoginCodes = new Map<string, number>();
    private _usedLoginCodes = new Map<string, number>();

    async jwtVerify(appwriteToken: string) {
        // check the JWT validity with Appwrite
        // check if user is registered in our system if not then create user
        // return user info if valid

        // check user token is valid or not from appwrite
        let appwriteUser: IAppWriteAccountResponse;
        try {
            Log.info(`AuthService:::jwtVerify:::: verifying appwrite token`);
            const { account } = await appwriteService.createSessionClient(appwriteToken);
            appwriteUser = await account.get();
        } catch (appwriteError) {
            Log.error(`AppwriteService:::createSessionClient:::: session client creation failed ${appwriteError}`);
            throw new AppError(appwriteError.message, utils.http.HttpStatusCodes.BAD_REQUEST);
        }

        // if given token is valid then check if user is registered in our system
        const data: IAppWriteAccountResponse = appwriteUser;

        // if user is not registered then create user
        let user = await userService.getUserByAppwriteId(data.$id);

        if (!user) {
            // create user
            Log.info(`AuthService:::jwtVerify:::: user not found, creating user with appwriteId: ${data.$id}`);

            // convert the dataset into db dataset
            const userCreateRequestDataSet: IUserCreateRequest = {
                appwriteId: data.$id,
                email: data.email,
                name: data.name,
                emailVerification: data.emailVerification,
                prefs: data.prefs
            }

            // create user in DB 
            user = await userService.createUser(userCreateRequestDataSet);
            Log.info(`AuthService:::jwtVerify:::: user created successfully with id: ${user.id}`);
        } else {
            Log.info(`AuthService:::jwtVerify:::: user found with id: ${user.id}`);
        }

        const jwtRequest: IJwtRequest = {
            userId: user.id,
            email: user.email,
            role: user.role
        }

        // now create access token and refresh token
        const accessToken = utils.jwtOperation.generateAccessToken(jwtRequest);
        const refreshToken = utils.jwtOperation.generateRefreshToken(jwtRequest);

        Log.info(`AuthService:::jwtVerify:::: JWT tokens generated successfully for user: ${user.id}`);

        const jwtResponse: IJwtResponse = {
            accessToken: accessToken,
            refreshToken: refreshToken
        }

        return jwtResponse;
    }

    // Verifies the one-time OAuth secret against Appwrite and returns the user.
    // The secret is single-use, so a successful createSession is the only proof
    // that this callback came from a real sign-in - nothing may authorize first.
    async loginWithAppwriteOAuthSecret(userId: string, secret: string): Promise<IAppWriteAccountResponse> {
        Log.info(`AuthService:::loginWithAppwriteOAuthSecret:::: validating OAuth secret for user ${userId}`);

        try {
            const client = new Client()
                .setEndpoint(env.APPWRITE_ENDPOINT)
                .setProject(env.APPWRITE_PROJECT_ID);
            const account = new Account(client);
            const session = await account.createSession(userId, secret);

            // The session only proves the secret was real - never keep it around.
            if (session?.$id) {
                await appwriteService.deleteUserSessionQuietly(userId, session.$id);
            }
        } catch (sessionErr: any) {
            Log.warn(`AuthService:::loginWithAppwriteOAuthSecret:::: session creation failed: ${sessionErr?.message}`);
            throw new AppError("Sign-in could not be completed. Please try again.", utils.http.HttpStatusCodes.UNAUTHORIZED);
        }

        let appwriteUser: any = null;
        try {
            // Retrieve user details via Appwrite Admin Client
            const { users } = await appwriteService.createAdminClient();
            appwriteUser = await users.get(userId);
        } catch (userErr: any) {
            Log.error(`AuthService:::loginWithAppwriteOAuthSecret:::: failed to get user ${userId}:`, userErr);
            throw new AppError("Sign-in could not be completed. Please try again.", utils.http.HttpStatusCodes.UNAUTHORIZED);
        }

        if (!appwriteUser) {
            throw new AppError("Sign-in could not be completed. Please try again.", utils.http.HttpStatusCodes.UNAUTHORIZED);
        }

        return appwriteUser;
    }

    // Marks a verified state token as consumed. Returns false when the token was
    // already used, so a callback URL can never be replayed.
    consumeStateToken(stateToken: string, expiresAtMs: number): boolean {
        this._evictExpired(this._usedStateTokens);
        if (this._usedStateTokens.has(stateToken)) {
            return false;
        }
        this._usedStateTokens.set(stateToken, expiresAtMs);
        return true;
    }

    // Mints a short-lived one-time login code bound to the nonce of the flow and
    // registers it so the exchange endpoint can consume it exactly once.
    issueLoginCode(nonce: string, appwriteUserId: string): string {
        this._evictExpired(this._issuedLoginCodes);
        const code = appwriteService.sign(
            { v: 1, n: nonce, u: appwriteUserId },
            LOGIN_CODE_TTL_SECONDS
        );
        this._issuedLoginCodes.set(code, Date.now() + LOGIN_CODE_TTL_SECONDS * 1000);
        Log.info(`AuthService:::issueLoginCode:::: issued one-time login code for user ${appwriteUserId}`);
        return code;
    }

    // Exchanges a one-time login code for backend JWTs. The code must be signed by
    // this server, unexpired, issued in this process, unused, and bound to the
    // nonce of the client instance that started the flow.
    async exchangeLoginCode(code: string, nonce: string): Promise<IJwtResponse> {
        Log.info("AuthService:::exchangeLoginCode:::: verifying one-time login code");

        const payload = appwriteService.verify(code);
        if (!payload || payload.v !== 1 || typeof payload.u !== "string" || typeof payload.n !== "string") {
            Log.warn("AuthService:::exchangeLoginCode:::: login code signature or payload invalid");
            throw new AppError("Sign-in code is invalid or has expired", utils.http.HttpStatusCodes.UNAUTHORIZED);
        }

        if (payload.n !== nonce) {
            Log.warn("AuthService:::exchangeLoginCode:::: login code nonce does not match the client");
            throw new AppError("Sign-in code is invalid or has expired", utils.http.HttpStatusCodes.UNAUTHORIZED);
        }

        this._evictExpired(this._issuedLoginCodes);
        this._evictExpired(this._usedLoginCodes);
        if (!this._issuedLoginCodes.has(code)) {
            Log.warn("AuthService:::exchangeLoginCode:::: login code was not issued by this server");
            throw new AppError("Sign-in code is invalid or has expired", utils.http.HttpStatusCodes.UNAUTHORIZED);
        }
        if (this._usedLoginCodes.has(code)) {
            Log.warn("AuthService:::exchangeLoginCode:::: login code already used");
            throw new AppError("Sign-in code is invalid or has expired", utils.http.HttpStatusCodes.UNAUTHORIZED);
        }
        this._usedLoginCodes.set(code, payload.e * 1000);

        try {
            const { users } = await appwriteService.createAdminClient();
            const appwriteUser = await users.get(payload.u);
            return await this._issueTokensForAppwriteUser(appwriteUser);
        } catch (exchangeErr: any) {
            if (exchangeErr instanceof AppError) {
                throw exchangeErr;
            }
            Log.error(`AuthService:::exchangeLoginCode:::: failed to load Appwrite user ${payload.u}:`, exchangeErr);
            throw new AppError("Sign-in could not be completed. Please try again.", utils.http.HttpStatusCodes.UNAUTHORIZED);
        }
    }

    // Syncs an Appwrite user into MongoDB and mints the backend JWT pair.
    // Shared by every flow that has already proven the Appwrite identity.
    private async _issueTokensForAppwriteUser(appwriteUser: IAppWriteAccountResponse): Promise<IJwtResponse> {
        // Check if user is registered in our MongoDB database
        let user = await userService.getUserByAppwriteId(appwriteUser.$id);
        if (!user && appwriteUser.email) {
            user = await userService.getUserByEmail(appwriteUser.email);
        }

        if (!user) {
            Log.info(`AuthService:::_issueTokensForAppwriteUser:::: creating user with appwriteId: ${appwriteUser.$id}`);
            const userCreateRequestDataSet: IUserCreateRequest = {
                appwriteId: appwriteUser.$id,
                email: appwriteUser.email,
                name: appwriteUser.name,
                emailVerification: appwriteUser.emailVerification,
                prefs: appwriteUser.prefs || {},
            };
            user = await userService.createUser(userCreateRequestDataSet);
            Log.info(`AuthService:::_issueTokensForAppwriteUser:::: user created successfully with id: ${user.id}`);
        } else {
            Log.info(`AuthService:::_issueTokensForAppwriteUser:::: existing user found with id: ${user.id}`);
        }

        // Generate backend JWT access and refresh tokens
        const jwtRequest: IJwtRequest = {
            userId: user.id,
            email: user.email,
            role: user.role,
        };

        const accessToken = utils.jwtOperation.generateAccessToken(jwtRequest);
        const refreshToken = utils.jwtOperation.generateRefreshToken(jwtRequest);

        return {
            accessToken,
            refreshToken,
        };
    }

    private _evictExpired(store: Map<string, number>): void {
        if (store.size === 0) {
            return;
        }
        const now = Date.now();
        for (const [token, expiresAt] of store) {
            if (expiresAt <= now) {
                store.delete(token);
            }
        }
    }

    async loginWithGoogleIdToken(idToken: string): Promise<IJwtResponse> {
        Log.info("AuthService:::loginWithGoogleIdToken:::: verifying Google ID token via Appwrite native sign-in");

        if (!this._looksLikeJwt(idToken)) {
            throw new AppError("Malformed ID token", utils.http.HttpStatusCodes.BAD_REQUEST);
        }

        // Appwrite verifies the Google signature, the audience (web client ID), expiry
        // and account matching. Nothing on this path trusts the token before that check.
        let session: Models.Session;
        try {
            session = await appwriteService.createIdTokenSession(idToken);
        } catch (appwriteError: any) {
            throw this._mapNativeSignInError(appwriteError);
        }

        if (!session?.userId) {
            throw new AppError("Native sign-in returned no user", utils.http.HttpStatusCodes.UNAUTHORIZED);
        }

        // The session was only needed to resolve the token to a user - never keep it around.
        await appwriteService.deleteUserSessionQuietly(session.userId, session.$id);

        let appwriteUser: IAppWriteAccountResponse;
        try {
            const { users } = await appwriteService.createAdminClient();
            appwriteUser = await users.get(session.userId);
        } catch (userErr: any) {
            Log.error(`AuthService:::loginWithGoogleIdToken:::: failed to load Appwrite user: ${userErr?.message || userErr}`);
            throw new AppError("Unable to retrieve authenticated user from Appwrite", utils.http.HttpStatusCodes.UNAUTHORIZED);
        }

        // Sync with MongoDB database and mint the backend JWT pair
        return await this._issueTokensForAppwriteUser(appwriteUser);
    }

    // A Google ID token is always a 3-segment base64url JWT. Reject anything else
    // before it reaches Appwrite so garbage never becomes an upstream auth call.
    private _looksLikeJwt(value: unknown): boolean {
        return typeof value === "string" && value.length < 8192 && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value);
    }

    // Translate Appwrite native sign-in failures into safe, actionable responses.
    // Never echo the ID token back to the caller or into the logs.
    private _mapNativeSignInError(appwriteError: any): AppError {
        const code = appwriteError?.code;
        const type = appwriteError?.type;
        const message = appwriteError?.message || "";

        Log.warn(`AuthService:::loginWithGoogleIdToken:::: Appwrite rejected the ID token (code=${code}, type=${type})`);

        if (type === "project_provider_disabled") {
            Log.error(
                "AuthService:::loginWithGoogleIdToken:::: Native sign-in is disabled or no web client ID is configured. " +
                `Enable it in Appwrite Console -> Auth -> Social providers -> Google for project ${env.APPWRITE_PROJECT_ID}.`
            );
            return new AppError(
                "Google sign-in is not configured on the server",
                utils.http.HttpStatusCodes.INTERNAL_SERVER_ERROR
            );
        }

        if (type === "user_oauth2_token_invalid") {
            return new AppError(message || "Google sign-in could not be verified", utils.http.HttpStatusCodes.UNAUTHORIZED);
        }

        if (code === 429) {
            return new AppError("Too many sign-in attempts, please try again later", utils.http.HttpStatusCodes.TOO_MANY_REQUESTS);
        }

        if (code === 404 || code === 405 || code === 501) {
            Log.error("AuthService:::loginWithGoogleIdToken:::: this Appwrite instance does not expose the native sign-in endpoint");
            return new AppError("Google sign-in is not available on this Appwrite instance", utils.http.HttpStatusCodes.SERVICE_UNAVAILABLE);
        }

        if (appwriteError instanceof AppwriteException) {
            // Any other Appwrite-side rejection means the token did not pass verification.
            return new AppError("Google sign-in could not be verified", utils.http.HttpStatusCodes.UNAUTHORIZED);
        }

        Log.error(`AuthService:::loginWithGoogleIdToken:::: unexpected error talking to Appwrite: ${appwriteError?.message || appwriteError}`);
        return new AppError("Google sign-in is temporarily unavailable", utils.http.HttpStatusCodes.SERVICE_UNAVAILABLE);
    }

    async logout() {
        // TODO: implement logout logic
    }
}

export default new AuthService();