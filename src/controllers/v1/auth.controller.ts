import { AppError } from "@/error/AppError";
import authService from "@/services/auth.service";
import utils from "@/utils";
import { Log } from "@/utils/logger";
import validations from "@/validations";
import { Request, Response } from "express";

// The only app deep-link scheme the browser flow may redirect to. The target
// travels in OAuth `state`, so this list is the open-redirect allow-list.
const ALLOWED_DEEP_LINK_PREFIXES = ["sheild://"];

// Pending browser-flow results keyed by sessionId (the OAuth `state` param).
// In-memory is fine for a single-instance dev server; move to Redis/Mongo
// before running more than one backend instance.
const PENDING_BROWSER_LOGIN_TTL_MS = 5 * 60 * 1000;
const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
type PendingBrowserLogin = { idToken?: string; error?: string; expiresAt: number };
const pendingBrowserLogins = new Map<string, PendingBrowserLogin>();

const purgeExpiredBrowserLogins = () => {
    const now = Date.now();
    for (const [key, value] of pendingBrowserLogins) {
        if (value.expiresAt <= now) {
            pendingBrowserLogins.delete(key);
        }
    }
};

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
//
// Chrome blocks script-initiated navigations to custom schemes (sheild://)
// without a user gesture, so the auto-redirect is best-effort and the visible
// link is the reliable path - it carries the gesture Chrome requires.
const buildGoogleBridgeHtml = (deepLink: string): string => {
    const jsLink = escapeForJsString(deepLink);
    const hrefLink = escapeForHtmlAttribute(deepLink);
    return `
            <!DOCTYPE html>
            <html>
                <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <title>Redirecting...</title>
                    <style>
                        body { font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5; }
                        .card { text-align: center; padding: 24px; }
                        .btn { display: inline-block; margin-top: 16px; padding: 14px 28px; background-color: #007bff; color: white; text-decoration: none; border-radius: 8px; font-size: 16px; }
                        .hint { color: #666; font-size: 14px; }
                        .error { color: #c0392b; }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <p id="msg">Completing sign-in...</p>
                        <p id="err" class="error hint" style="display:none"></p>
                        <a id="link" class="btn" href="${hrefLink}" style="display:none">Open SHEild app</a>
                        <p class="hint">You can close this page and return to the SHEild app.</p>
                    </div>
                    <script>
                        window.onload = function() {
                            var params = new URLSearchParams(window.location.hash.substring(1));
                            var query = new URLSearchParams(window.location.search);
                            var idToken = params.get("id_token") || query.get("id_token") || "";
                            var error = params.get("error") || query.get("error") || "";
                            var sessionId = params.get("state") || query.get("state") || "";
                            var target = "${jsLink}";
                            var sep = target.indexOf("?") >= 0 ? "&" : "?";
                            var dest = "";
                            if (idToken) dest = target + sep + "id_token=" + encodeURIComponent(idToken);
                            if (error) dest = target + (dest ? "&" : sep) + "error=" + encodeURIComponent(error);

                            // Hand the result to the backend so the app can poll
                            // for it - this is the path that works in Expo Go,
                            // where sheild:// deep links are not registered.
                            if (sessionId && (idToken || error)) {
                                fetch("/v1/auth/google/browser-session/" + encodeURIComponent(sessionId), {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ idToken: idToken || undefined, error: error || undefined })
                                }).catch(function() {});
                            }

                            if (!idToken && !error) {
                                document.getElementById("msg").textContent =
                                    "Google returned no sign-in result.";
                                document.getElementById("err").style.display = "block";
                                document.getElementById("err").textContent =
                                    "Go back and try again. If this keeps happening, check that this URL is registered as an Authorised redirect URI in Google Cloud Console.";
                                return;
                            }

                            document.getElementById("msg").textContent =
                                "Signed in. Return to the SHEild app to continue.";
                            // best-effort deep link for dev/standalone builds that
                            // register sheild:// - harmless no-op in Expo Go.
                            var link = document.getElementById("link");
                            link.href = dest;
                            link.style.display = "inline-block";
                            window.location.replace(dest);
                            setTimeout(function() {
                                document.getElementById("msg").textContent =
                                    "Signed in. Switch back to the SHEild app to continue.";
                            }, 700);
                        };
                    </script>
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
    // with the id_token in the URL fragment; the bridge page hands the result
    // to the backend (POST /v1/auth/google/browser-session/:sessionId) so the
    // app can poll for it - deep links are not reliable in Expo Go.
    async googleOAuthCallback(req: Request, res: Response) {
        const { state } = req.query;

        // state carries the app-generated sessionId; fall back to the default
        // deep link when it is missing or malformed (old clients / manual visits).
        let deepLink = "sheild://oauth/callback";
        if (typeof state === "string" && state.length > 0) {
            const allowed = ALLOWED_DEEP_LINK_PREFIXES.some((prefix) => state.startsWith(prefix));
            if (allowed && state.length <= 2048) {
                deepLink = state;
            }
        }

        res.send(buildGoogleBridgeHtml(deepLink));
    }

    // POST /v1/auth/google/browser-session/:sessionId
    // Called by the bridge page (browser context) with the Google result.
    // Stores the id_token (or error) so the app can poll for it.
    async saveBrowserSession(req: Request, res: Response) {
        const { sessionId } = req.params;
        const { idToken, error } = req.body || {};

        if (!SESSION_ID_PATTERN.test(sessionId)) {
            Log.warn("AuthController:::saveBrowserSession:::: invalid sessionId");
            throw new AppError("Invalid sessionId", utils.http.HttpStatusCodes.BAD_REQUEST);
        }
        if (typeof idToken !== "string" && typeof error !== "string") {
            throw new AppError("idToken or error is required", utils.http.HttpStatusCodes.BAD_REQUEST);
        }

        purgeExpiredBrowserLogins();
        pendingBrowserLogins.set(sessionId, {
            idToken: typeof idToken === "string" ? idToken : undefined,
            error: typeof error === "string" ? error : undefined,
            expiresAt: Date.now() + PENDING_BROWSER_LOGIN_TTL_MS,
        });
        Log.info("AuthController:::saveBrowserSession:::: stored browser sign-in result");
        res.status(utils.http.HttpStatusCodes.NO_CONTENT).send();
    }

    // GET /v1/auth/google/browser-session/:sessionId
    // Polled by the app after opening the browser. Returns 404 until the
    // bridge page has posted the result; one-time read (consumed on success).
    async getBrowserSession(req: Request, res: Response) {
        const { sessionId } = req.params;

        if (!SESSION_ID_PATTERN.test(sessionId)) {
            throw new AppError("Invalid sessionId", utils.http.HttpStatusCodes.BAD_REQUEST);
        }

        purgeExpiredBrowserLogins();
        const pending = pendingBrowserLogins.get(sessionId);
        if (!pending) {
            res.status(utils.http.HttpStatusCodes.NOT_FOUND).json({
                status: "fail",
                message: "No sign-in result yet",
                statusCode: utils.http.HttpStatusCodes.NOT_FOUND,
            });
            return;
        }

        if (pending.error) {
            pendingBrowserLogins.delete(sessionId);
            Log.warn(`AuthController:::getBrowserSession:::: browser sign-in failed: ${pending.error}`);
            res.status(utils.http.HttpStatusCodes.OK).json({ error: pending.error });
            return;
        }

        if (pending.idToken) {
            pendingBrowserLogins.delete(sessionId);
            Log.info("AuthController:::getBrowserSession:::: handing out browser id_token");
            res.status(utils.http.HttpStatusCodes.OK).json({ idToken: pending.idToken });
            return;
        }

        res.status(utils.http.HttpStatusCodes.NOT_FOUND).json({
            status: "fail",
            message: "No sign-in result yet",
            statusCode: utils.http.HttpStatusCodes.NOT_FOUND,
        });
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
