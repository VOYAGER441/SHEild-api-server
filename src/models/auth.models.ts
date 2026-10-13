import mongoose from "mongoose";
import Models from "./model";
import collections from "@/database/collections";

// One document per issued refresh session, stored in the `auth` collection.
// Raw tokens are never persisted - only a sha256 hash - so a database leak
// cannot be replayed against the API.
export interface IAuthSession {
    _id: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId | string;
    email: string;
    googleId?: string;
    refreshTokenHash: string;
    expiresAt: Date;
    revokedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

const authSessionSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true, index: true },
        email: { type: String, required: true, lowercase: true, trim: true },
        googleId: { type: String },
        // sha256 hex of the refresh JWT
        refreshTokenHash: { type: String, required: true, unique: true, index: true },
        expiresAt: { type: Date, required: true },
        revokedAt: { type: Date, default: null },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
    },
    {
        // pin the exact collection name - mongoose would otherwise pluralize
        // the model name to "auths"
        collection: "auth",
    }
);

// Mongo TTL: drop each session a week after its natural expiry so revoked /
// expired rows linger briefly for audit then disappear automatically.
authSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 7 });

class AuthSessionModel extends Models {
    constructor() {
        super(collections.AUTH_COLLECTION, authSessionSchema);
    }
}

export default new AuthSessionModel();
