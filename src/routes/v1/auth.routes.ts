import express from "express";
import { rateLimit } from "express-rate-limit";
import { apiErrorHandler } from "@/error/apiErrorHandler";
import AuthController from "@/controllers/v1/auth.controller";
const router = express.Router();

/**
 * Abuse protection for the Google sign-in endpoint. ID tokens are signed and
 * short-lived, so Google verification is the real control - this only stops
 * someone hammering the endpoint.
 */
const googleSignInLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
        status: "fail",
        message: "Too many sign-in attempts. Please try again in a few minutes.",
        statusCode: 429,
    },
    // This app does not set Express `trust proxy`; do not fail when a proxy or
    // client supplies X-Forwarded-For.
    validate: { xForwardedForHeader: false },
});

/**
 * Abuse protection for the token refresh endpoint. Refresh JWTs are verified
 * and sessions are tracked in the auth collection - this only stops hammering.
 */
const refreshLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
        status: "fail",
        message: "Too many refresh attempts. Please try again in a few minutes.",
        statusCode: 429,
    },
    // This app does not set Express `trust proxy`; do not fail when a proxy or
    // client supplies X-Forwarded-For.
    validate: { xForwardedForHeader: false },
});

// for auth
// ###############################################
/**
 * @openapi
 * /auth/google
 * native Google sign-in: the client sends a Google ID token (from
 * @react-native-google-signin/google-signin or the browser fallback) and the
 * backend verifies it with google-auth-library before upserting the user and
 * issuing JWTs.
 */
router.post("/google", googleSignInLimiter, apiErrorHandler(AuthController.googleLogin));

/**
 * @openapi
 * /auth/google/native
 * backwards-compatible alias of /auth/google (legacy path name).
 */
router.post("/google/native", googleSignInLimiter, apiErrorHandler(AuthController.googleLogin));

/**
 * @openapi
 * /auth/google/callback
 * browser-flow bridge: Google redirects here with the id_token in the URL
 * fragment; the page forwards it into the app via the allow-listed deep link
 * carried in `state`. Used by the Expo Go / browser fallback.
 */
router.get("/google/callback", apiErrorHandler(AuthController.googleOAuthCallback));

/**
 * @openapi
 * /auth/refresh
 * rotate a refresh session: verifies the refresh JWT, checks the session in
 * the auth collection, revokes it and issues a new token pair.
 */
router.post("/refresh", refreshLimiter, apiErrorHandler(AuthController.refresh));

/**
 * @openapi
 * /auth/logout
 * user logout (revokes the refresh session when a refreshToken is provided)
 */
router.get("/logout", apiErrorHandler(AuthController.logout));

export default router;
