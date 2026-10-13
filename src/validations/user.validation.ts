import Joi from "joi";
import utils from "@/utils";

// Roles a user may self-select after first sign-in. ADMIN and the generic
// USER default are deliberately excluded - admin is assigned server-side and
// "user" is the pre-selection default, not a picker option.
export const PICKABLE_ROLES = [
    utils.appConstant.USER_ROLE.WOMEN,
    utils.appConstant.USER_ROLE.PARENT,
    utils.appConstant.USER_ROLE.CHILD,
    utils.appConstant.USER_ROLE.ALZHEIMER_PATIENT,
] as const;

export const updateRoleSchema = Joi.object({
    role: Joi.string()
        .valid(...PICKABLE_ROLES)
        .required()
        .messages({
            "any.only": `role must be one of: ${PICKABLE_ROLES.join(", ")}`,
        }),
});

export default {
    updateRoleSchema,
};
