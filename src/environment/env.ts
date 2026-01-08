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

// APPWRITE
export const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT;
export const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID;
export const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY;

// NVIDIA API key
export const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
export const NVIDIA_AI_MODEL = process.env.NVIDIA_AI_MODEL;
export const BASE_URL = process.env.BASE_URL;
export const TEMPERATURE = Number(process.env.TEMPERATURE) || 0.2;
export const TOP_P = Number(process.env.TOP_P) || 0.7;
export const MAX_TOKENS = Number(process.env.MAX_TOKENS) || 2048;

// jwt
export const JWT_SECRET = process.env.JWT_SECRET || "default_secret_key";
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
export const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "30d";