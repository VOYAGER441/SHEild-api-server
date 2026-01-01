

import { AppError } from "@/error/AppError";
import authService from "@/services/auth.service";
import utils from "@/utils";
import { Log } from "@/utils/logger";
import validations from "@/validations";
import { Request, Response } from "express";

class AuthController {

    async jwtVerify(req: Request, res: Response) {
        const { jwtFromAppwrite } = req.params;
        const { error } = validations.authValidation.jwtVerifySchema.validate({ jwtFromAppwrite });
        if (error) {
            Log.error("AuthController:::jwtVerify:::: need Appwrite JWT validation", error)
            throw new AppError(error.details[0].message, utils.http.HttpStatusCodes.BAD_REQUEST);
        }
        const result = await authService.jwtVerify();
        res.status(utils.http.HttpStatusCodes.OK).json(result);
    }

    async logout(req: Request, res: Response) {
        // TODO: implement logout logic
    }
}

export default new AuthController();