import { IUserResponse } from "@/interface/response/user.response";
import userModels from "@/models/user.models";
import { Log } from "@/utils/logger";


class UserService {

    // FIXIT : add cache to all functions

    async getUserByAppwriteId(appwriteId: string): Promise<IUserResponse | null> {
        Log.info(`UserService:::getUserByAppwriteId:::: appwriteId ${appwriteId}`);
        const user = await userModels.findOne({ appwriteId });
        Log.info(`UserService:::getUserByAppwriteId:::: user ${user}`);
        return user;
    }
}

export default new UserService();

