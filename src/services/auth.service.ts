import { Account, Client, Users } from "node-appwrite";
import env from "@/environment";
import appwriteService from "./appwrite.service";
import { Log } from "@/utils/logger";
import { AppError } from "@/error/AppError";
import utils from "@/utils";
import { IAppWriteAccountResponse } from "@/interface/response/appwrite.response";
import userService from "./user.service";
import { IUserCreateRequest } from "@/interface/request/user.request";
import { IJwtRequest, IJwtResponse } from "@/interface/request/jwt.request";
class AuthService {
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

    async logout() {
        // TODO: implement logout logic
    }
}

export default new AuthService();