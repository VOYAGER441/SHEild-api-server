import { AppError } from "@/error/AppError";
import authService from "@/services/auth.service";
import utils from "@/utils";
import { Log } from "@/utils/logger";
import validations from "@/validations";
import { Request, Response } from "express";

class AuthController {

    // POST /v1/auth/google (alias: POST /api/v1/auth/google)
    // Body: { idToken } - a Google ID token from the native @react-native-google-signin SDK.
    // The token is verified directly against Google via google-auth-library;
    // no third-party BaaS is involved.
    async googleLogin(req: Request, res: Response) {
        Log.info("AuthController:::googleLogin:::: received Google ID token verification request");
        const { idToken } = req.body;

        const { error } = validations.authValidation.googleLoginSchema.validate({ idToken });
        if (error) {
            Log.error("AuthController:::googleLogin:::: invalid ID token payload", error.details[0].message);
            throw new AppError(error.details[0].message, utils.http.HttpStatusCodes.BAD_REQUEST);
        }

        const result = await authService.loginWithGoogleIdToken(idToken);
        Log.info("AuthController:::googleLogin:::: Google sign-in verified, tokens issued");
        res.status(utils.http.HttpStatusCodes.OK).json(result);
    }

    async logout(req: Request, res: Response) {
        try {
            const authHeader = req.get("authorization") || "";
            const headerToken = /^Bearer\s+/i.test(authHeader)
                ? authHeader.replace(/^Bearer\s+/i, "").trim()
                : "";
            const bodyToken =
                typeof req.body?.accessToken === "string"
                    ? req.body.accessToken.trim()
                    : typeof req.body?.token === "string"
                        ? req.body.token.trim()
                        : "";
            const token = headerToken || bodyToken;

            if (!token) {
                Log.warn("AuthController:::logout:::: access token missing");
                res.status(utils.http.HttpStatusCodes.UNAUTHORIZED).json({
                    status: "fail",
                    message: "Access token is required",
                    statusCode: utils.http.HttpStatusCodes.UNAUTHORIZED,
                });
                return;
            }

            const claims = utils.jwtOperation.verifyAccessToken(token);
            if (!claims?.user?.userId) {
                Log.warn("AuthController:::logout:::: access token invalid or expired");
                res.status(utils.http.HttpStatusCodes.UNAUTHORIZED).json({
                    status: "fail",
                    message: "Access token is invalid or expired",
                    statusCode: utils.http.HttpStatusCodes.UNAUTHORIZED,
                });
                return;
            }

            // The backend JWT carries no server-side session id, so there is no
            // session we can identify - skip the cleanup rather than guess.
            // This server never sets cookies, so there is nothing to clear.
            Log.info(`AuthController:::logout:::: user ${claims.user.userId} logged out`);
            res.status(utils.http.HttpStatusCodes.NO_CONTENT).send();
        } catch (error: any) {
            Log.error("AuthController:::logout:::: unexpected logout error:", error?.message || error);
            if (!res.headersSent) {
                res.status(utils.http.HttpStatusCodes.NO_CONTENT).send();
            }
        }
    }
}

export default new AuthController();
