import express from "express";
import ChatRouter from "./chat.route";
import AuthRouter from "./auth.routes";


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


export default router;