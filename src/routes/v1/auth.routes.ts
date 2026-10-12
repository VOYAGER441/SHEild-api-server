import express from "express";
import { rateLimit } from "express-rate-limit";
import { apiErrorHandler } from "@/error/apiErrorHandler";
import AuthController from "@/controllers/v1/auth.controller";
const router = express.Router();

/**
 * Abuse protection for the native sign-in endpoint. ID tokens are signed and
 * short-lived, so Appwrite verification is the real control - this only stops
 * someone hammering the endpoint.
 */
const nativeSignInLimiter = rateLimit({
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
 * Abuse protection for the one-time login code exchange. Codes are single-use
 * and nonce-bound, so verification is the real control - this only stops
 * someone hammering the endpoint.
 */
const exchangeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
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

// for auth 
// ###############################################
/**
 * @openapi
 * /auth/jwtVerify because it already login via google from frontend
 * /auth/jwtVerify/{jwtFromAppwrite} - verify jwt token from Appwrite
 * verify jwt token
 */
router.post("/jwtVerify/:jwtFromAppwrite", apiErrorHandler(AuthController.jwtVerify));

router.get("/googleLogin", apiErrorHandler(AuthController.googleLogin));

/**
 * @openapi
 * /auth/google/native
 * native google sign-in with ID token verified on backend
 */
router.post("/google/native", nativeSignInLimiter, apiErrorHandler(AuthController.googleNativeLogin));

/**
 * @openapi
 * /auth/oauth/callback
 * oauth callback
 */
router.get("/oauth/callback", apiErrorHandler(AuthController.oauthCallback));

/**
 * @openapi
 * /auth/oauth/exchange
 * exchange a one-time login code for backend JWTs
 */
router.post("/oauth/exchange", exchangeLimiter, apiErrorHandler(AuthController.oauthExchange));


/**
 * @openapi
 * /auth/logout
 * user logout
 */
router.get("/logout", apiErrorHandler(AuthController.logout));

export default router;
