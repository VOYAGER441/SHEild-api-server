import Joi from "joi";

// Google ID tokens are always 3-segment base64url JWTs.
export const googleLoginSchema = Joi.object({
    idToken: Joi.string()
        .required()
        .max(8192)
        .pattern(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
        .messages({
            "string.pattern.base": "idToken must be a valid ID token",
            "string.max": "idToken is too long",
        })
});


export default {
    googleLoginSchema
};
