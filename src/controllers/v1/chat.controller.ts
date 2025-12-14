import { Request, Response } from "express";
import { AppError } from "@/error/AppError";
import ChatService from "@/services/chat.service";
import { Log } from "@/utils/logger";
import utils from "@/utils";

class ChatController {
    async chatService(req: Request, res: Response) {
        Log.info("ChatController:::chatService:::: this is chat controller")
        const { sessionId } = req.params;
        const { message, thinking } = req.body;
        Log.debug("ChatController:::chatService:::: sessionId message thinking", sessionId, message, thinking)

        try {
            const result = await ChatService.chatService(sessionId, message, thinking);

            Log.debug("ChatController:::chatService:::: result", result)
            return res.status(utils.http.HttpStatusCodes.OK).json(result);
        } catch (err) {
            Log.error("ChatController:::chatService:::: err", err)
            return res.status(utils.http.HttpStatusCodes.INTERNAL_SERVER_ERROR).json({ error: err.message });
        }
    }

    async clearChatSession(req: Request, res: Response) {
        Log.info("ChatController:::clearChatSession:::: this is clear chat session controller")
        const { sessionId } = req.params;
        Log.debug("ChatController:::clearChatSession:::: sessionId", sessionId)

        try {

            await ChatService.clearSession(sessionId);
            Log.debug("ChatController:::clearChatSession:::: sessionId cleared successfully", sessionId)
            return res.status(utils.http.HttpStatusCodes.OK).json({ message: "Session cleared successfully" });
        } catch (err) {
            Log.error("ChatController:::clearChatSession:::: err", err)
            return res.status(utils.http.HttpStatusCodes.INTERNAL_SERVER_ERROR).json({ error: err.message });
        }
    }

}

export default new ChatController();
