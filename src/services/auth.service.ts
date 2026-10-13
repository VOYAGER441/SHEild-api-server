import { OAuth2Client, TokenPayload } from "google-auth-library";
import env from "@/environment";
import { Log } from "@/utils/logger";
import { AppError } from "@/error/AppError";
import utils from "@/utils";
import userService from "./user.service";
import authSessionService from "./auth.session.service";
import { IJwtRequest, IJwtResponse } from "@/interface/request/jwt.request";

// One shared client; the audience list is fixed at first use.
let oauthClient: OAuth2Client | null = null;

function getOAuthClient(): OAuth2Client {
    if (!oauthClient) {
        oauthClient = new OAuth2Client();
    }
    return oauthClient;
}

// Verifies a Google ID token against Google's published signing keys.
// The audience must match one of our OAuth client IDs (web / Android / iOS).
async function verifyGoogleToken(idToken: string): Promise<TokenPayload> {
    const audience = env.GOOGLE_TOKEN_AUDIENCES;
    if (audience.length === 0) {
        Log.error(
            "AuthService:::verifyGoogleToken:::: no Google client ID configured. " +
            "Set GOOGLE_CLIENT_ID_WEB (and optionally GOOGLE_CLIENT_ID_ANDROID / GOOGLE_CLIENT_ID_IOS)."
        );
        throw new AppError(
            "Google sign-in is not configured on the server",
            utils.http.HttpStatusCodes.INTERNAL_SERVER_ERROR
        );
    }

    const ticket = await getOAuthClient().verifyIdToken({
        idToken,
        audience,
    });
    return ticket.getPayload()!;
}

class AuthService {
    // A Google ID token is always a 3-segment base64url JWT. Reject anything else
    // before it reaches Google so garbage never becomes an upstream auth call.
    private _looksLikeJwt(value: unknown): boolean {
        return typeof value === "string" && value.length < 8192 && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value);
    }

    // Full native sign-in: verify the Google ID token server-side, upsert the
    // user, and mint the backend JWT pair.
    async loginWithGoogleIdToken(idToken: string): Promise<IJwtResponse> {
        Log.info("AuthService:::loginWithGoogleIdToken:::: verifying Google ID token with google-auth-library");

        if (!this._looksLikeJwt(idToken)) {
            throw new AppError("Malformed ID token", utils.http.HttpStatusCodes.BAD_REQUEST);
        }

        let payload: TokenPayload;
        try {
            payload = await verifyGoogleToken(idToken);
        } catch (verifyError: any) {
            // google-auth-library throws on bad signature, wrong audience or expiry.
            Log.warn(`AuthService:::loginWithGoogleIdToken:::: Google rejected the ID token: ${verifyError?.message || verifyError}`);
            throw new AppError("Google sign-in could not be verified", utils.http.HttpStatusCodes.UNAUTHORIZED);
        }

        if (!payload?.sub || !payload.email) {
            Log.warn("AuthService:::loginWithGoogleIdToken:::: verified token is missing sub or email");
            throw new AppError("Google sign-in returned an incomplete profile", utils.http.HttpStatusCodes.UNAUTHORIZED);
        }

        const googleId = payload.sub;
        const email = payload.email.toLowerCase();

        // 1. existing user linked to this Google account
        let user = await userService.getUserByGoogleId(googleId);

        // 2. legacy / first-time: match by email and link the googleId
        if (!user) {
            user = await userService.getUserByEmail(email);
            if (user) {
                Log.info(`AuthService:::loginWithGoogleIdToken:::: linking googleId to existing user ${user.id}`);
                await userService.linkGoogleId(user.id, googleId);
            }
        }

        // 3. brand new user
        if (!user) {
            Log.info(`AuthService:::loginWithGoogleIdToken:::: creating user with googleId ${googleId}`);
            user = await userService.createUser({
                googleId,
                email,
                name: payload.name || email,
                avatarUrl: payload.picture,
            });
            Log.info(`AuthService:::loginWithGoogleIdToken:::: user created successfully with id: ${user.id}`);
        } else {
            Log.info(`AuthService:::loginWithGoogleIdToken:::: existing user found with id: ${user.id}`);
        }

        // Generate backend JWT access and refresh tokens
        const jwtRequest: IJwtRequest = {
            userId: user.id,
            email: user.email,
            role: user.role,
        };

        const accessToken = utils.jwtOperation.generateAccessToken(jwtRequest);
        const refreshToken = utils.jwtOperation.generateRefreshToken(jwtRequest);

        // Record the session in the `auth` collection so it can be rotated and
        // revoked server-side.
        await authSessionService.recordSession({
            userId: user.id,
            email: user.email,
            googleId: user.googleId,
            refreshToken,
        });

        return {
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                email: user.email,
                name: user.userName,
                avatarUrl: user.avatarUrl,
                role: user.role,
            },
        };
    }

    // Rotates a refresh session: the presented token must be a valid refresh
    // JWT whose session is still recorded and unrevoked. The old session is
    // revoked and a fresh token pair is issued and recorded.
    async refreshSession(refreshToken: string): Promise<IJwtResponse> {
        Log.info("AuthService:::refreshSession:::: rotating refresh token");

        const claims = utils.jwtOperation.verifyRefreshToken(refreshToken);
        if (!claims?.user?.userId) {
            Log.warn("AuthService:::refreshSession:::: refresh token invalid, expired, or wrong type");
            throw new AppError("Refresh token is invalid or expired", utils.http.HttpStatusCodes.UNAUTHORIZED);
        }

        const session = await authSessionService.findValidSessionByRefreshToken(refreshToken);
        if (!session) {
            // Unknown or revoked: a token that was never issued by this server
            // (or was already rotated / logged out) must not mint new tokens.
            Log.warn(`AuthService:::refreshSession:::: no active session for user ${claims.user.userId}`);
            throw new AppError("Refresh token is invalid or expired", utils.http.HttpStatusCodes.UNAUTHORIZED);
        }

        const user = await userService.getUserById(claims.user.userId);
        if (!user || user.isDeleted || !user.isActive) {
            Log.warn(`AuthService:::refreshSession:::: user ${claims.user.userId} is missing, deleted, or disabled`);
            throw new AppError("Refresh token is invalid or expired", utils.http.HttpStatusCodes.UNAUTHORIZED);
        }

        // Rotation: kill the old session before issuing the new pair.
        await authSessionService.revokeByRefreshToken(refreshToken);

        const jwtRequest: IJwtRequest = {
            userId: user.id,
            email: user.email,
            role: user.role,
        };
        const accessToken = utils.jwtOperation.generateAccessToken(jwtRequest);
        const newRefreshToken = utils.jwtOperation.generateRefreshToken(jwtRequest);

        await authSessionService.recordSession({
            userId: user.id,
            email: user.email,
            googleId: user.googleId,
            refreshToken: newRefreshToken,
        });

        Log.info(`AuthService:::refreshSession:::: tokens rotated for user ${user.id}`);

        return {
            accessToken,
            refreshToken: newRefreshToken,
            user: {
                id: user.id,
                email: user.email,
                name: user.userName,
                avatarUrl: user.avatarUrl,
                role: user.role,
            },
        };
    }

    // Revokes the session behind a refresh token (used by logout).
    async revokeSession(refreshToken: string): Promise<void> {
        await authSessionService.revokeByRefreshToken(refreshToken);
    }

    async logout() {
        // TODO: implement logout logic
    }
}

export default new AuthService();
