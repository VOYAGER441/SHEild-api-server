import { Request, Response } from "express";
import { AppError } from "@/error/AppError";
import ChatService from "@/services/chat.service";

class ChatController {
    async chat(req: Request, res: Response) {
        const { sessionId } = req.params;
        const { message, thinking } = req.body;

        try {
            const result = await ChatService.chat(sessionId, message, thinking);

            return res.status(200).json(result);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    async clear(req: Request, res: Response) {
        const { sessionId } = req.params;

        try {
            ChatService.clearSession(sessionId);
            return res.status(200).json({ message: "Session cleared successfully" });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

}

export default new ChatController();
