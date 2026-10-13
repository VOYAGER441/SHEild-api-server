import express from "express";
import ChatRouter from "./chat.route";
import AuthRouter from "./auth.routes";
import UserRouter from "./user.routes";


const router= express.Router();

// TODO: add middleware to all routes

// system routes
// ###############################################


// public routes
// ###############################################
/**
 * Chat endpoints - public access
 * @swagger
 * tags:
 *   name: Chat
 *   description: Chat operations
 */
router.use("/chat",ChatRouter)

/**
 * auth endpoints - protected access
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication operations
*/
router.use("/auth", AuthRouter);

// private routes
// ###############################################



// user routes
// ###############################################
/**
 * user endpoints - protected access (Bearer access token)
 * @swagger
 * tags:
 *   name: User
 *   description: User profile operations
 */
router.use("/user", UserRouter);


export default router;