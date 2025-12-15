import express from "express";
import { apiErrorHandler } from "@/error/apiErrorHandler";
import ChatController from "@/controllers/v1/chat.controller";
const router = express.Router();

// for chat 
// ###############################################
/**
 * @openapi
 * /post/
 * for chatBot chat
 */
router.post("/", apiErrorHandler(ChatController.chatService));

/**
 * @openapi
 * /get/clear/:sessionId
 * clear session
 */
router.get("/clear/:sessionId", apiErrorHandler(ChatController.clearChatSession));

export default router;
