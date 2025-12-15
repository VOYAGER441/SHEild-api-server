import { Request, Response } from "express";
import { AppError } from "@/error/AppError";
import ChatService from "@/services/chat.service";
import { Log } from "@/utils/logger";
import utils from "@/utils";
import { IChatRequest } from "@/interface/request/chat.request";
import validations from "@/validations";

class ChatController {
    async chatService(req: Request, res: Response) {
        Log.info("ChatController:::chatService:::: this is chat controller")

        const requestBody: IChatRequest = req.body;
        Log.debug("ChatController:::chatService:::: sessionId message thinking", requestBody.sessionId, requestBody.message, requestBody.thinking)

        const { error } = validations.chatBotValidation.chatRequestSchema.validate(requestBody);
        if (error) {
            Log.error("ChatController:::chatService:::: error", error)
            throw new AppError(error.details[0].message, utils.http.HttpStatusCodes.BAD_REQUEST);
        }

        try {
            const result = await ChatService.chatService(requestBody.sessionId, requestBody.message, requestBody.thinking);

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

        const { error } = validations.chatBotValidation.chatClearSchema.validate({ sessionId });
        if (error) {
            Log.error("ChatController:::clearChatSession:::: error", error)
            throw new AppError(error.details[0].message, utils.http.HttpStatusCodes.BAD_REQUEST);
        }

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
