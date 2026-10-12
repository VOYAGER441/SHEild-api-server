import express, { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import cors from "cors";
import bodyParser from "body-parser";
import env from "@/environment";
import utils from "@/utils";
import router from "./routes";
import { globalErrorHandler } from "@/error/globalErrorHandler";
import { Log } from "./utils/logger";
import DATABASE from "@/database/database";


dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// public routes
// ####################################
app.get('/', async (req: Request, res: Response) => {
    // Remove unused parameter warning by using req or underscore prefix
    // This prevents the unused parameter warning
    res.status(utils.http.HttpStatusCodes.OK).send("Hello World")
})




// api routes entry point
// ####################################
// `/v1` is the canonical prefix; `/api/v1` is mounted as an alias so clients
// can use the full `/api/v1/...` style without breaking existing callers.
app.use('/v1', router)
app.use('/api/v1', router)
// ####################################

// 404 handler - must be after all other routes
// ####################################
app.use((req: Request, res: Response, next: NextFunction) => {
    res.status(utils.http.HttpStatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Route not found',
        error: {
            path: req.originalUrl,
            method: req.method,
            message: 'The requested resource was not found'
        }
    });
});

// Global error handler - must be after all routes and middleware
// ####################################
app.use(globalErrorHandler);

const startServer = async () => {
    if (env.JWT_SECRET_IS_FALLBACK) {
        Log.warn(
            "App:::startServer:::: JWT_SECRET is not set - using the insecure development default. " +
            "Set a strong JWT_SECRET before running this server anywhere outside local development."
        );
    }

    const database = new DATABASE();
    await database.init();

    app.listen(env.PORT, () => {
        Log.info(`Server is running on port ${env.PORT}`);
    });
};

startServer().catch((error) => {
    Log.error("Failed to start server:", error);
    process.exit(1);
});
