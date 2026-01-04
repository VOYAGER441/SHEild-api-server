import { Account, Client, Users } from "node-appwrite";
import env from "@/environment";
import appwriteService from "./appwrite.service";
import { Log } from "@/utils/logger";
import { AppError } from "@/error/AppError";
import utils from "@/utils";
import { IAppWriteAccountResponse } from "@/interface/response/appwrite.response";
import userService from "./user.service";
class AuthService {
    async jwtVerify(appwriteToken: string) {
        // check the JWT validity with Appwrite
        // check if user is registered in our system if not then create user
        // return user info if valid

        // check user token is valid or not from appwrite
        let appwriteUser: IAppWriteAccountResponse;
        try {
            const { account } = await appwriteService.createSessionClient(appwriteToken);
            appwriteUser = await account.get();
        } catch (appwriteError) {
            Log.error(`AppwriteService:::createSessionClient:::: session client creation failed ${appwriteError}`);
            throw new AppError(appwriteError.message, utils.http.HttpStatusCodes.BAD_REQUEST);
        }

        // if given token is valid then check if user is registered in our system
        const data: IAppWriteAccountResponse = appwriteUser;

        // if user is not registered then create user
        const user = await userService.getUserByAppwriteId(data.$id);

        if (!user) {
            // create user
            const user = await userService.createUser(data);
        }



    }

    async logout() {
        // TODO: implement logout logic
    }
}

export default new AuthService();