import express from "express";
import { apiErrorHandler } from "@/error/apiErrorHandler";
import ChatController from "@/controllers/v1/chat.controller";
const router = express.Router();

// for chat 
// ###############################################
router.post("/", apiErrorHandler(ChatController.chat));
router.get("/clear", apiErrorHandler(ChatController.clear));

export default router;
