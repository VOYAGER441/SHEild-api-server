import { NODE_ENVS } from "@/utils/appConstant";

// env
export const NODE_ENV = process.env.NODE_ENV || 'dev' as NODE_ENVS;

// port 
export const PORT = process.env.PORT || 5000;

// MONGODB_URI
export const MONGODB_URI = process.env.MONGODB_URI || "";

// LOG
export const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
export const LOG_OUTPUT = process.env.LOG_OUTPUT || 'console';
export const LOG_FILE_PATH = process.env.LOG_FILE_PATH || 'logs/app.log';



// NVIDIA API key
export const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
export const NVIDIA_AI_MODEL = process.env.NVIDIA_AI_MODEL;
export const BASE_URL = process.env.BASE_URL;
export const TEMPERATURE = Number(process.env.TEMPERATURE) || 0.2;
export const TOP_P = Number(process.env.TOP_P) || 0.7;
export const MAX_TOKENS = Number(process.env.MAX_TOKENS) || 2048;
