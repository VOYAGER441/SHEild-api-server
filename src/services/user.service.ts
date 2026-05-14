import { IUserCreateRequest } from "@/interface/request/user.request";
import { IUserResponse } from "@/interface/response/user.response";
import userModels from "@/models/user.models";
import utils from "@/utils";
import { Log } from "@/utils/logger";


class UserService {

    // FIXIT : add cache to all functions
    private buildFallbackUserName(data: IUserCreateRequest): string {
        const trimmedName = data.name?.trim();
        if (trimmedName) return trimmedName;

        const emailPrefix = data.email?.split("@")[0]?.trim();
        if (emailPrefix) return emailPrefix;

        return `user-${data.appwriteId.slice(-6)}`;
    }

    private buildAvatarUrl(userName: string, prefs: any): string {
        const avatarFromPrefs =
            prefs?.avatarUrl ||
            prefs?.avatar ||
            prefs?.profilePhoto ||
            prefs?.image;

        if (typeof avatarFromPrefs === "string" && avatarFromPrefs.trim()) {
            return avatarFromPrefs.trim();
        }

        // return `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=0D8ABC&color=fff`;

    }

    // get user by appwrite id
    async getUserByAppwriteId(appwriteId: string): Promise<IUserResponse | null> {
        Log.info(`UserService:::getUserByAppwriteId:::: appwriteId ${appwriteId}`);
        const user = await userModels.findOne({ appwriteId });
        Log.info(`UserService:::getUserByAppwriteId:::: user ${user}`);
        return user;
    }

    // create user
    async createUser(data: IUserCreateRequest): Promise<IUserResponse> {
        Log.info(`UserService:::createUser:::: creating user for appwriteId ${data.appwriteId}`);

        const userName = this.buildFallbackUserName(data);
        // const avatarUrl = this.buildAvatarUrl(userName, data.prefs);
        const avatarUrl = utils.commonUnit.generateAvatarUrl(userName);

        const user = await userModels.create({
            appwriteId: data.appwriteId,
            email: data.email,
            userName,
            avatarUrl,
        });
        Log.info(`UserService:::createUser:::: user ${user}`);
        return user;
    }
}

export default new UserService();
