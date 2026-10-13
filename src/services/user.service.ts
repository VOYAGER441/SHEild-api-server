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

        return `user-${data.googleId.slice(-6)}`;
    }

    // get user by google id (the `sub` claim of a verified Google ID token)
    async getUserByGoogleId(googleId: string): Promise<IUserResponse | null> {
        Log.info(`UserService:::getUserByGoogleId:::: googleId ${googleId}`);
        const user = await userModels.findOne({ googleId });
        return user;
    }

    // get user by id
    async getUserById(userId: string): Promise<IUserResponse | null> {
        Log.info(`UserService:::getUserById:::: userId ${userId}`);
        const user = await userModels.findOne({ _id: userId });
        return user;
    }

    // get user by email
    async getUserByEmail(email: string): Promise<IUserResponse | null> {
        Log.info(`UserService:::getUserByEmail:::: email ${email}`);
        const user = await userModels.findOne({ email: email?.toLowerCase?.() || email });
        return user;
    }

    // attach a google id to an existing user (e.g. matched by email on first native sign-in)
    async linkGoogleId(userId: string, googleId: string): Promise<void> {
        Log.info(`UserService:::linkGoogleId:::: linking googleId to user ${userId}`);
        await userModels.update(userId, { googleId, updatedAt: new Date() });
    }

    // set the user's self-selected role (women / parent / child / alzheimer_patient)
    async updateUserRole(userId: string, role: string): Promise<IUserResponse | null> {
        Log.info(`UserService:::updateUserRole:::: user ${userId} -> role ${role}`);
        await userModels.update(userId, { role, updatedAt: new Date() });
        return this.getUserById(userId);
    }

    // create user
    async createUser(data: IUserCreateRequest): Promise<IUserResponse> {
        Log.info(`UserService:::createUser:::: creating user for googleId ${data.googleId}`);

        const userName = this.buildFallbackUserName(data);
        const avatarUrl =
            (typeof data.avatarUrl === "string" && data.avatarUrl.trim()) ||
            utils.commonUnit.generateAvatarUrl(userName);

        const user = await userModels.create({
            googleId: data.googleId,
            email: data.email?.toLowerCase?.() || data.email,
            userName,
            avatarUrl,
        });
        Log.info(`UserService:::createUser:::: user created with id ${user?._id}`);
        return user;
    }
}

export default new UserService();
