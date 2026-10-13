import { AppError } from "@/error/AppError";
import authService from "@/services/auth.service";
import utils from "@/utils";
import { Log } from "@/utils/logger";
import validations from "@/validations";
import { Request, Response } from "express";

// The only app deep-link scheme the browser flow may redirect to. The target
// travels in OAuth `state`, so this list is the open-redirect allow-list.
const ALLOWED_DEEP_LINK_PREFIXES = ["sheild://"];

const escapeForJsString = (value: string): string =>
    value
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/'/g, "\\'")
        .replace(/</g, "\\u003c")
        .replace(/\r/g, "\\r")
        .replace(/\n/g, "\\n");

const escapeForHtmlAttribute = (value: string): string =>
    value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

// Returns an HTML page that forwards the Google result (id_token in the URL
// fragment, or an error) into the app via its deep link. Browsers never send
// fragments to a server, so this page is the only place the fragment can be
// read - it then hands the token to the app over the custom scheme.
const buildGoogleBridgeHtml = (deepLink: string): string => {
    const jsLink = escapeForJsString(deepLink);
    const hrefLink = escapeForHtmlAttribute(deepLink);
    return `
            <!DOCTYPE html>
            <html>
                <head>
                    <title>Redirecting...</title>
                    <script>
                        window.onload = function() {
                            var params = new URLSearchParams(window.location.hash.substring(1));
                            var query = new URLSearchParams(window.location.search);
                            var idToken = params.get("id_token") || query.get("id_token") || "";
                            var error = params.get("error") || query.get("error") || "";
                            var target = "${jsLink}";
                            var sep = target.indexOf("?") >= 0 ? "&" : "?";
                            var extra = "";
                            if (idToken) extra += sep + "id_token=" + encodeURIComponent(idToken);
                            if (error) extra += (extra ? "&" : sep) + "error=" + encodeURIComponent(error);
                            window.location.replace(target + extra);
                        };
                    </script>
                </head>
                <body style="display: flex; justify-content: center; align-items: center; height: 100vh; font-family: sans-serif;">
                    <div style="text-align: center;">
                        <p>Completing sign-in...</p>
                        <a href="${hrefLink}" style="padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Click here if not redirected</a>
                    </div>
                </body>
            </html>
        `;
};

class AuthController {

    // POST /v1/auth/google (alias: POST /api/v1/auth/google)
    // Body: { idToken } - a Google ID token from the native @react-native-google-signin SDK
    // (or the browser fallback flow). The token is verified directly against
    // Google via google-auth-library; no third-party BaaS is involved.
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

    // GET /v1/auth/google/callback
    // Redirect target registered on the Google Web client. Google lands here
    // with the id_token in the URL fragment; this page forwards it into the
    // app via the deep link carried in `state` (allow-listed scheme only).
    async googleOAuthCallback(req: Request, res: Response) {
        const { state } = req.query;

        let deepLink = "sheild://oauth/callback";
        if (typeof state === "string" && state.length > 0) {
            const allowed = ALLOWED_DEEP_LINK_PREFIXES.some((prefix) => state.startsWith(prefix));
            if (allowed && state.length <= 2048) {
                deepLink = state;
            } else {
                Log.warn("AuthController:::googleOAuthCallback:::: rejected unsafe state redirect target");
            }
        }

        res.send(buildGoogleBridgeHtml(deepLink));
    }

    // POST /v1/auth/refresh
    // Body: { refreshToken } - rotates the refresh session and returns a new pair.
    async refresh(req: Request, res: Response) {
        Log.info("AuthController:::refresh:::: received token refresh request");
        const { refreshToken } = req.body;

        const { error } = validations.authValidation.refreshTokenSchema.validate({ refreshToken });
        if (error) {
            Log.error("AuthController:::refresh:::: invalid refresh token payload", error.details[0].message);
            throw new AppError(error.details[0].message, utils.http.HttpStatusCodes.BAD_REQUEST);
        }

        const result = await authService.refreshSession(refreshToken);
        Log.info("AuthController:::refresh:::: tokens rotated");
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

            // When the client also presents its refresh token, revoke the
            // matching session in the `auth` collection so it can no longer
            // be rotated. Access-token-only calls remain a local sign-out.
            const refreshToken =
                typeof req.body?.refreshToken === "string" && req.body.refreshToken.trim()
                    ? req.body.refreshToken.trim()
                    : "";
            if (refreshToken) {
                await authService.revokeSession(refreshToken);
            }

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
