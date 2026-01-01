import mongoose from "mongoose";
import Models from "./model";
import collections from "@/database/collections";
import utils from "@/utils";


export interface IUser {
    _id: mongoose.Types.ObjectId;
    userName: string
    email: string
    avatar: string
    role: string
    isActive: boolean
    isDeleted: boolean
    createdAt: Date
    updatedAt: Date
}

const userSchema = new mongoose.Schema({
    userName: { type: String, required: true },
    appwriteId: { type: String, required: true, unique: true, index: true, },
    email: { type: String, required: true },
    avatar: { type: String, required: true },
    role: { type: String, default: utils.appConstant.USER_ROLE.USER },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

export default class UserModel extends Models {
    constructor() {
        super(collections.USER_COLLECTION, userSchema);
    }
}


