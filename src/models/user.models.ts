import mongoose from "mongoose";
import Models from "./model";
import collections from "@/database/collections";
import utils from "@/utils";


export interface IUser {
    _id: mongoose.Types.ObjectId;
    userName: string;
    googleId: string;
    email: string;
    avatarUrl: string;
    role: string;
    isActive: boolean;
    isDeleted: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const userSchema = new mongoose.Schema({
    userName: { type: String, required: true },
    // sparse: legacy users created before native Google sign-in may not have a
    // googleId yet; it is linked on their next Google sign-in (matched by email).
    googleId: { type: String, unique: true, sparse: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    avatarUrl: { type: String, required: true },
    role: { type: String, default: utils.appConstant.USER_ROLE.USER },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
}, { versionKey: false });

class UserModel extends Models {
    constructor() {
        super(collections.USER_COLLECTION, userSchema);
    }
}


export default new UserModel();