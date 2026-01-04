// config/appwrite.js
import { Client, Users, Account } from "node-appwrite";
import env from "@/environment";
import { Log } from "@/utils/logger";

class AppwriteService {

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

    async createSessionClient(session: string) {
        Log.info("AppwriteService:::createSessionClient:::: creating session client");
        const client = new Client()
            .setEndpoint(env.APPWRITE_ENDPOINT)
            .setProject(env.APPWRITE_PROJECT_ID)
            .setSession(session);
        Log.info("AppwriteService:::createSessionClient:::: session client created");
        return {
            client,
            account: new Account(client),
        };
    }
}

export default new AppwriteService();