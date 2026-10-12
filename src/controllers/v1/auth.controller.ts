

import { AppError } from "@/error/AppError";
import authService from "@/services/auth.service";
import utils from "@/utils";
import { Log } from "@/utils/logger";
import validations from "@/validations";
import appwriteService from "@/services/appwrite.service";
import { Request, Response } from "express";

const REDIRECT_ERROR_MESSAGE = "Sign-in could not be completed. Please try again.";
const INVALID_STATE_MESSAGE = "Sign-in link is invalid or has expired. Please try again.";

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

// Return an HTML page that redirects to the app deep link
const buildRedirectHtml = (deepLink: string): string => {
    const jsLink = escapeForJsString(deepLink);
    const hrefLink = escapeForHtmlAttribute(deepLink);
    return `
            <!DOCTYPE html>
            <html>
                <head>
                    <title>Redirecting...</title>
                    <script>
                        window.onload = function() {
                            window.location.href = "${jsLink}";
                        };
                    </script>
                </head>
                <body style="display: flex; justify-content: center; align-items: center; height: 100vh; font-family: sans-serif;">
                    <div style="text-align: center;">
                        <p>Redirecting back to App...</p>
                        <a href="${hrefLink}" style="padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Click here if not redirected</a>
                    </div>
                </body>
            </html>
        `;
};

// Used when the state token cannot be trusted: no redirect target exists yet,
// so the caller only gets a plain page.
const buildInvalidStateHtml = (): string => `
            <!DOCTYPE html>
            <html>
                <head>
                    <title>Sign-in failed</title>
                </head>
                <body style="display: flex; justify-content: center; align-items: center; height: 100vh; font-family: sans-serif;">
                    <div style="text-align: center;">
                        <p>${INVALID_STATE_MESSAGE}</p>
                    </div>
                </body>
            </html>
        `;

class AuthController {

    async jwtVerify(req: Request, res: Response) {
        const { jwtFromAppwrite } = req.params;
        const { error } = validations.authValidation.jwtVerifySchema.validate({ jwtFromAppwrite });
        if (error) {
            Log.error("AuthController:::jwtVerify:::: need Appwrite JWT validation", error)
            throw new AppError(error.details[0].message, utils.http.HttpStatusCodes.BAD_REQUEST);
        }
        const result = await authService.jwtVerify(jwtFromAppwrite);
        Log.info("AuthController:::jwtVerify:::: need Appwrite JWT validation", result)
        res.status(utils.http.HttpStatusCodes.OK).json(result);
    }

    async googleLogin(req: Request, res: Response) {
        const { redirectUri, nonce } = req.query;
        const { error } = validations.authValidation.googleLoginSchema.validate({ redirectUri, nonce });
        if (error) {
            Log.error("AuthController:::googleLogin:::: invalid google login request", error.details[0].message);
            throw new AppError(error.details[0].message, utils.http.HttpStatusCodes.BAD_REQUEST);
        }

        Log.info("AuthController:::googleLogin:::: calling createGoogleLoginRedirectURL");
        const host = req.get("host");
        const fallbackAppUrl = host ? `${req.protocol}://${host}` : undefined;
        const { url, state } = await appwriteService.createGoogleLoginRedirectURL(
            redirectUri as string,
            fallbackAppUrl,
            nonce as string
        );
        Log.info("AuthController:::googleLogin:::: createGoogleLoginRedirectURL result", url);

        // Return JSON so frontend can handle the browser open; `state` binds the
        // flow to this client instance for the later code exchange.
        res.status(utils.http.HttpStatusCodes.OK).json({ url, state });
    }

    async oauthCallback(req: Request, res: Response) {
        const { st, userId, secret } = req.query;
        Log.info("AuthController:::oauthCallback:::: received callback", {
            userId,
            hasState: typeof st === "string" && st.length > 0,
            hasSecret: typeof secret === "string" && secret.length > 0,
        });

        // 1. an untrusted state token has no redirect target we may use
        const payload = appwriteService.verify(st);
        if (!payload || typeof payload.r !== "string" || !payload.r || typeof payload.n !== "string") {
            Log.warn("AuthController:::oauthCallback:::: invalid or expired state token");
            res.status(utils.http.HttpStatusCodes.UNAUTHORIZED).send(buildInvalidStateHtml());
            return;
        }

        // 2. single-use: a callback URL may only be consumed once
        if (!authService.consumeStateToken(st as string, payload.e * 1000)) {
            Log.warn("AuthController:::oauthCallback:::: state token already used");
            res.status(utils.http.HttpStatusCodes.UNAUTHORIZED).send(buildInvalidStateHtml());
            return;
        }

        const deepLinkBase = payload.r;
        const separator = deepLinkBase.includes("?") ? "&" : "?";
        let deepLink: string;

        try {
            if (!userId || !secret) {
                throw new AppError("Missing userId or secret in OAuth callback", utils.http.HttpStatusCodes.BAD_REQUEST);
            }

            // Appwrite must confirm the one-time secret before anything else.
            // The frontend never touches the raw secret or interacts with Appwrite directly.
            await authService.loginWithAppwriteOAuthSecret(userId as string, secret as string);

            const code = authService.issueLoginCode(payload.n as string, userId as string);
            deepLink = `${deepLinkBase}${separator}code=${encodeURIComponent(code)}`;
            Log.info("AuthController:::oauthCallback:::: backend verification successful, redirecting with one-time code");
        } catch (error: any) {
            Log.error("AuthController:::oauthCallback:::: backend login error:", error?.message || error);
            const errorMsg = error?.message || REDIRECT_ERROR_MESSAGE;
            deepLink = `${deepLinkBase}${separator}error=${encodeURIComponent(errorMsg)}`;
        }

        res.send(buildRedirectHtml(deepLink));
    }

    async oauthExchange(req: Request, res: Response) {
        const { code, nonce } = req.body;
        const { error } = validations.authValidation.oauthExchangeSchema.validate({ code, nonce });
        if (error) {
            Log.error("AuthController:::oauthExchange:::: invalid exchange payload", error.details[0].message);
            throw new AppError(error.details[0].message, utils.http.HttpStatusCodes.BAD_REQUEST);
        }

        const tokens = await authService.exchangeLoginCode(code, nonce);
        Log.info("AuthController:::oauthExchange:::: login code exchanged for JWTs");
        res.status(utils.http.HttpStatusCodes.OK).json(tokens);
    }

    async googleNativeLogin(req: Request, res: Response) {
        Log.info("AuthController:::googleNativeLogin:::: received native token verification request");
        const { idToken } = req.body;

        const { error } = validations.authValidation.googleNativeLoginSchema.validate({ idToken });
        if (error) {
            Log.error("AuthController:::googleNativeLogin:::: invalid ID token payload", error.details[0].message);
            throw new AppError(error.details[0].message, utils.http.HttpStatusCodes.BAD_REQUEST);
        }

        // Verification, account matching and session creation all happen on Appwrite;
        // this endpoint only ever returns the backend JWT pair.
        const tokens = await authService.loginWithGoogleIdToken(idToken);
        res.status(utils.http.HttpStatusCodes.OK).json(tokens);
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

            // The backend JWT carries no Appwrite session id, so there is no
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
