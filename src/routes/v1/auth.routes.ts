import express from "express";
import { apiErrorHandler } from "@/error/apiErrorHandler";
import AuthController from "@/controllers/v1/auth.controller";
const router = express.Router();

// for auth 
// ###############################################
/**
 * @openapi
 * /auth/jwtVerify because it already login via google from frontend
 * /auth/jwtVerify/{jwtFromAppwrite} - verify jwt token from Appwrite
 * verify jwt token
 */
router.post("/jwtVerify/:jwtFromAppwrite", apiErrorHandler(AuthController.jwtVerify));

/**
 * @openapi
 * /auth/googleLogin
 * google login
 */
router.get("/googleLogin", apiErrorHandler(AuthController.googleLogin));

/**
 * @openapi
 * /auth/oauth/callback
 * oauth callback
 */
router.get("/oauth/callback", apiErrorHandler(AuthController.oauthCallback));


/**
 * @openapi
 * /auth/logout
 * user logout
 */
router.get("/logout", apiErrorHandler(AuthController.logout));

export default router;
