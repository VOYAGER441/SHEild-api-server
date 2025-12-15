import Joi from "joi";
import { IChatRequest } from "@/interface/request/chat.request";


const chatRequestSchema = Joi.object<IChatRequest>({
    message: Joi.string().required(),
    sessionId: Joi.string().required(),
    thinking: Joi.boolean().optional(),
});

const chatClearSchema = Joi.object({
    sessionId: Joi.string().required(),
});


export default {
    chatRequestSchema,
    chatClearSchema
}