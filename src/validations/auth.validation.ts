import Joi from "joi";

export const jwtVerifySchema = Joi.object({
    jwtFromAppwrite: Joi.string().required()
});


export default {
    jwtVerifySchema
};