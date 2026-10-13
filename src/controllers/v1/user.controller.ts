import { Request, Response } from "express";
import utils from "@/utils";
import { Log } from "@/utils/logger";
import userService from "@/services/user.service";
import { updateRoleSchema } from "@/validations/user.validation";

class UserController {
    /**
     * PATCH /v1/user/role
     * Sets the self-selected role (women / parent / child / alzheimer_patient)
     * for the authenticated user. The generic "user" default is replaced by
     * the picker choice; ADMIN cannot be self-assigned.
     */
    async updateRole(req: Request, res: Response) {
        const authHeader = req.get("authorization") || "";
        const token = /^Bearer\s+/i.test(authHeader)
            ? authHeader.replace(/^Bearer\s+/i, "").trim()
            : "";

        if (!token) {
            res.status(utils.http.HttpStatusCodes.UNAUTHORIZED).json({
                status: "fail",
                message: "Access token is required",
                statusCode: utils.http.HttpStatusCodes.UNAUTHORIZED,
            });
            return;
        }

        const claims = utils.jwtOperation.verifyAccessToken(token);
        if (!claims?.user?.userId) {
            res.status(utils.http.HttpStatusCodes.UNAUTHORIZED).json({
                status: "fail",
                message: "Access token is invalid or expired",
                statusCode: utils.http.HttpStatusCodes.UNAUTHORIZED,
            });
            return;
        }

        const { error, value } = updateRoleSchema.validate(req.body);
        if (error) {
            Log.warn(`UserController:::updateRole:::: validation failed: ${error.message}`);
            res.status(utils.http.HttpStatusCodes.BAD_REQUEST).json({
                status: "fail",
                message: error.message,
                statusCode: utils.http.HttpStatusCodes.BAD_REQUEST,
            });
            return;
        }

        const userId = claims.user.userId;
        const user = await userService.updateUserRole(userId, value.role);
        if (!user) {
            res.status(utils.http.HttpStatusCodes.NOT_FOUND).json({
                status: "fail",
                message: "User not found",
                statusCode: utils.http.HttpStatusCodes.NOT_FOUND,
            });
            return;
        }

        Log.info(`UserController:::updateRole:::: user ${userId} role set to ${value.role}`);
        res.status(utils.http.HttpStatusCodes.OK).json({
            status: "success",
            statusCode: utils.http.HttpStatusCodes.OK,
            user: {
                id: user.id,
                email: user.email,
                name: user.userName,
                avatarUrl: user.avatarUrl,
                role: user.role,
            },
        });
    }
}

export default new UserController();
