import express, { Request, Response } from "express";
import dotenv from "dotenv";
import cors from "cors";
import bodyParser from "body-parser";
import env from "@/environment";
import utils from "@/utils";
import router from "./routes";


dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// public routes
// ####################################
app.get('/', async (req: Request, res: Response) => {
     // Remove unused parameter warning by using req or underscore prefix
     // This prevents the unused parameter warning
     res.status(utils.HttpStatusCodes.OK).send("Hello World")
})




// api routes
// ####################################
app.use('/v1',router)
// ####################################

// 404 handler - must be after all other routes
// ####################################
app.use((req: Request, res: Response) => {
    res.status(utils.HttpStatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Route not found',
        error: {
            path: req.originalUrl,
            method: req.method,
            message: 'The requested resource was not found'
        }
    });
});

// Start the server
app.listen(env.PORT, () => {
     console.log(`Server is running on port ${env.PORT}`);
})
