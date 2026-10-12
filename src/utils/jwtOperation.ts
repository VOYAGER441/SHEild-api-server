import env from "@/environment";
import { IJwtRequest } from "@/interface/request/jwt.request";
import jwt, { SignOptions } from "jsonwebtoken";

// get access token
export function generateAccessToken(user: IJwtRequest) {
    return jwt.sign({ user, type: "access" }, env.JWT_SECRET, {
        expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"]
    });
}

// get refresh token (signed with the dedicated refresh secret)
export function generateRefreshToken(user: IJwtRequest) {
    return jwt.sign({ user, type: "refresh" }, env.JWT_REFRESH_SECRET, {
        expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions["expiresIn"]
    });
}

export interface IAccessClaims {
    user?: IJwtRequest;
    type?: string;
    iat?: number;
    exp?: number;
}

// verify a backend access token; returns null instead of throwing
export function verifyAccessToken(token: string): IAccessClaims | null {
    try {
        const decoded = jwt.verify(token, env.JWT_SECRET);
        if (typeof decoded === "string") {
            return null;
        }
        const claims = decoded as IAccessClaims;
        if (claims.type !== "access" || !claims.user?.userId) {
            return null;
        }
        return claims;
    } catch (verifyError) {
        return null;
    }
}

// verify a backend refresh token; returns null instead of throwing
export function verifyRefreshToken(token: string): IAccessClaims | null {
    try {
        const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET);
        if (typeof decoded === "string") {
            return null;
        }
        const claims = decoded as IAccessClaims;
        if (claims.type !== "refresh" || !claims.user?.userId) {
            return null;
        }
        return claims;
    } catch (verifyError) {
        return null;
    }
}
