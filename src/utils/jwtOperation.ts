import env from "@/environment";
import { IJwtRequest } from "@/interface/request/jwt.request";
import jwt, { SignOptions } from "jsonwebtoken";

// get access token
export function generateAccessToken(user: IJwtRequest) {
    return jwt.sign({ user, type: "access" }, env.JWT_SECRET, {
        expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"]
    });
}

// get refresh token
export function generateRefreshToken(user: IJwtRequest) {
    return jwt.sign({ user, type: "refresh" }, env.JWT_SECRET, {
        expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions["expiresIn"]
    });
}
