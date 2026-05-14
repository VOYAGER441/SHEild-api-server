

import { AppError } from "@/error/AppError";
import authService from "@/services/auth.service";
import utils from "@/utils";
import { Log } from "@/utils/logger";
import validations from "@/validations";
import appwriteService from "@/services/appwrite.service";
import { Request, Response } from "express";

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
        Log.info("AuthController:::googleLogin:::: calling createGoogleLoginRedirectURL");
        const { redirectUri } = req.query;
        const host = req.get("host");
        const fallbackAppUrl = host ? `${req.protocol}://${host}` : undefined;
        const url = await appwriteService.createGoogleLoginRedirectURL(
            redirectUri as string,
            fallbackAppUrl
        );
        Log.info("AuthController:::googleLogin:::: createGoogleLoginRedirectURL result", url);

        // Return JSON so frontend can handle the browser open
        res.status(utils.http.HttpStatusCodes.OK).json({ url });
    }

    async oauthCallback(req: Request, res: Response) {
        Log.info("AuthController:::oauthCallback:::: received callback", req.query);
        const { secret, userId, redirectUri } = req.query;

        // Determine the base schema/URL
        // If frontend sent a specific redirectUri (e.g. exp://...), use it
        // Otherwise default to the production scheme (sheild://)
        let deepLinkBase = "sheild://oauth/success";
        if (redirectUri) {
            deepLinkBase = decodeURIComponent(redirectUri as string);
        }

        // Add the auth params
        const separator = deepLinkBase.includes("?") ? "&" : "?";
        const deepLink = `${deepLinkBase}${separator}userId=${userId}&secret=${secret}`;

        Log.info("AuthController:::oauthCallback:::: redirecting to deep link", deepLink);

        // Return an HTML page that redirects
        res.send(`
            <!DOCTYPE html>
            <html>
                <head>
                    <title>Redirecting...</title>
                    <script>
                        window.onload = function() {
                            window.location.href = "${deepLink}";
                        };
                    </script>
                </head>
                <body style="display: flex; justify-content: center; align-items: center; height: 100vh; font-family: sans-serif;">
                    <div style="text-align: center;">
                        <p>Redirecting back to App...</p>
                        <a href="${deepLink}" style="padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Click here if not redirected</a>
                    </div>
                </body>
            </html>
        `);
    }

    async logout(req: Request, res: Response) {
        // TODO: implement logout logic
    }
}

export default new AuthController();