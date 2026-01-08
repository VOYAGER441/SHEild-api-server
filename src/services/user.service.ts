import { IUserCreateRequest } from "@/interface/request/user.request";
import { IUserResponse } from "@/interface/response/user.response";
import userModels from "@/models/user.models";
import { Log } from "@/utils/logger";


class UserService {

    // FIXIT : add cache to all functions

    // get user by appwrite id
    async getUserByAppwriteId(appwriteId: string): Promise<IUserResponse | null> {
        Log.info(`UserService:::getUserByAppwriteId:::: appwriteId ${appwriteId}`);
        const user = await userModels.findOne({ appwriteId });
        Log.info(`UserService:::getUserByAppwriteId:::: user ${user}`);
        return user;
    }

    // create user
    async createUser(data: IUserCreateRequest): Promise<IUserResponse> {
        Log.info(`UserService:::createUser:::: data ${data}`);
        const user = await userModels.create(data);
        Log.info(`UserService:::createUser:::: user ${user}`);
        return user;
    }
}

export default new UserService();

