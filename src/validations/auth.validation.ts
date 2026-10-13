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

// Backend refresh JWTs are also 3-segment base64url tokens.
export const refreshTokenSchema = Joi.object({
    refreshToken: Joi.string()
        .required()
        .max(8192)
        .pattern(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
        .messages({
            "string.pattern.base": "refreshToken must be a valid token",
            "string.max": "refreshToken is too long",
        })
});


export default {
    googleLoginSchema,
    refreshTokenSchema
};
