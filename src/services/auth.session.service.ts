import crypto from "crypto";
import jwt from "jsonwebtoken";
import authSessionModels, { IAuthSession } from "@/models/auth.models";
import { Log } from "@/utils/logger";

// sha256 hex digest of a token - what we store instead of the raw JWT
function hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
}

// Reads the `exp` claim without verifying (the JWT was already verified before
// we get here); falls back to +1h when the claim is missing.
function readExpiry(token: string): Date {
    const decoded = jwt.decode(token) as { exp?: number } | null;
    if (decoded?.exp) {
        return new Date(decoded.exp * 1000);
    }
    return new Date(Date.now() + 60 * 60 * 1000);
}

class AuthSessionService {
    // Persists a record of an issued refresh session.
    async recordSession(params: {
        userId: string;
        email: string;
        googleId?: string;
        refreshToken: string;
    }): Promise<IAuthSession | null> {
        try {
            const session = await authSessionModels.create({
                userId: params.userId,
                email: params.email,
                googleId: params.googleId,
                refreshTokenHash: hashToken(params.refreshToken),
                expiresAt: readExpiry(params.refreshToken),
                revokedAt: null,
            });
            Log.info(`AuthSessionService:::recordSession:::: recorded session for user ${params.userId}`);
            return session;
        } catch (recordError: any) {
            // Session bookkeeping must never block a successful login.
            Log.error(`AuthSessionService:::recordSession:::: failed to record session: ${recordError?.message || recordError}`);
            return null;
        }
    }

    // Finds the still-valid (unrevoked, unexpired) session for a refresh token.
    async findValidSessionByRefreshToken(refreshToken: string): Promise<IAuthSession | null> {
        const session = await authSessionModels.findOne({
            refreshTokenHash: hashToken(refreshToken),
            revokedAt: null,
            expiresAt: { $gt: new Date() },
        });
        return session;
    }

    // Revokes the session belonging to a refresh token. Idempotent.
    async revokeByRefreshToken(refreshToken: string): Promise<boolean> {
        const result = await authSessionModels.updateQuery(
            { refreshTokenHash: hashToken(refreshToken), revokedAt: null },
            { revokedAt: new Date(), updatedAt: new Date() }
        );
        const modified = (result as any)?.modifiedCount > 0;
        if (modified) {
            Log.info("AuthSessionService:::revokeByRefreshToken:::: session revoked");
        }
        return modified;
    }

    // Revokes every active session of a user (full sign-out everywhere).
    async revokeAllForUser(userId: string): Promise<number> {
        const result = await authSessionModels.updateQuery(
            { userId, revokedAt: null },
            { revokedAt: new Date(), updatedAt: new Date() }
        );
        const modified = (result as any)?.modifiedCount || 0;
        Log.info(`AuthSessionService:::revokeAllForUser:::: revoked ${modified} session(s) for user ${userId}`);
        return modified;
    }
}

export default new AuthSessionService();
