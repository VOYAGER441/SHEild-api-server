// config/appwrite.js
import { Client, Users, Account, OAuthProvider } from "node-appwrite";
import env from "@/environment";
import { Log } from "@/utils/logger";
import utils from "@/utils";
import { AppError } from "@/error/AppError";

class AppwriteService {

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

    // create google login redirect url
    async createGoogleLoginRedirectURL(redirectUri?: string, fallbackAppUrl?: string): Promise<string> {
        Log.info("AppwriteService:::createGoogleLoginRedirectURL:::: creating google login redirect url");

        const client = new Client()
            .setEndpoint(env.APPWRITE_ENDPOINT!)
            .setProject(env.APPWRITE_PROJECT_ID!)
            .setKey(env.APPWRITE_API_KEY!);

        const account = new Account(client);
        Log.info(`AppwriteService:::createGoogleLoginRedirectURL:::: Raw APP_URL: '${env.APP_URL}'`);
        Log.info(`AppwriteService:::createGoogleLoginRedirectURL:::: Fallback APP_URL: '${fallbackAppUrl}'`);

        // Prefer request-derived backend URL in local/LAN development.
        // A stale APP_URL often causes Appwrite to reject OAuth callbacks.
        let appUrl = fallbackAppUrl || env.APP_URL;
        if (!appUrl || (!appUrl.startsWith("http://") && !appUrl.startsWith("https://"))) {
            const errorMsg = `INVALID Configuration: APP_URL is set to '${appUrl}'. It MUST be a valid HTTP URL pointing to your backend (e.g., 'http://192.168.x.x:5000'). Please update your .env file.`;
            Log.error(errorMsg);
            throw new AppError(errorMsg, utils.http.HttpStatusCodes.INTERNAL_SERVER_ERROR);
        }

        const cleanAppUrl = appUrl.endsWith("/") ? appUrl.slice(0, -1) : appUrl;

        let success = `${cleanAppUrl}/v1/auth/oauth/callback`;
        let failure = `${cleanAppUrl}/v1/auth/oauth/callback`;

        if (redirectUri) {
            const encodedRedirect = encodeURIComponent(redirectUri);
            success += `?redirectUri=${encodedRedirect}`;
            failure += `?redirectUri=${encodedRedirect}`;
        }

        Log.info(`AppwriteService:::createGoogleLoginRedirectURL:::: using redirect URLs - Success: ${success}, Failure: ${failure}`);


        try {
            // Await the promise to get the actual URL
            const result = await account.createOAuth2Token(
                OAuthProvider.Google,
                success,
                failure
            );

            Log.info("AppwriteService:::createGoogleLoginRedirectURL:::: google login redirect url created", result);

            // Ensure we return a string, handling potential object wrappers if any
            if (!result) {
                throw new AppError("Received null or undefined result from OAuth token creation", utils.http.HttpStatusCodes.BAD_REQUEST);
            }
            return result.toString();

        } catch (error: any) {
            Log.error("AppwriteService:::createGoogleLoginRedirectURL:::: google login redirect url creation failed", error);
            const appwriteMessage =
                error?.response?.message ||
                error?.message ||
                "Unknown Appwrite Error";
            Log.error(
                "AppwriteService:::createGoogleLoginRedirectURL:::: Appwrite Response Message",
                appwriteMessage
            );
            throw new AppError(appwriteMessage, utils.http.HttpStatusCodes.BAD_REQUEST);
        }
    }

}

export default new AppwriteService();
