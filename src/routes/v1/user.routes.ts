import express from "express";
import { rateLimit } from "express-rate-limit";
import { apiErrorHandler } from "@/error/apiErrorHandler";
import UserController from "@/controllers/v1/user.controller";

const router = express.Router();

/**
 * Abuse protection for role updates. The access token is the real control -
 * this only stops hammering.
 */
const roleUpdateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
        status: "fail",
        message: "Too many role update attempts. Please try again in a few minutes.",
        statusCode: 429,
    },
    validate: { xForwardedForHeader: false },
});

/**
 * @openapi
 * /user/role
 * PATCH: set the self-selected role for the authenticated user.
 * Body: { role: "women" | "parent" | "child" | "alzheimer_patient" }
 * Requires a Bearer access token. ADMIN and the default "user" cannot be
 * self-assigned.
 */
router.patch("/role", roleUpdateLimiter, apiErrorHandler(UserController.updateRole));

export default router;
