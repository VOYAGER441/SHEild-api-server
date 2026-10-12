import { NODE_ENVS } from "@/utils/appConstant";

// app url
export const APP_URL = process.env.APP_URL;

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

// GOOGLE OAUTH
// Client IDs used as accepted audiences when verifying Google ID tokens.
export const GOOGLE_CLIENT_ID_WEB = process.env.GOOGLE_CLIENT_ID_WEB;
export const GOOGLE_CLIENT_ID_ANDROID = process.env.GOOGLE_CLIENT_ID_ANDROID;
export const GOOGLE_CLIENT_ID_IOS = process.env.GOOGLE_CLIENT_ID_IOS;

// Non-empty audience list handed to google-auth-library on every verification.
export const GOOGLE_TOKEN_AUDIENCES: string[] = [
    process.env.GOOGLE_CLIENT_ID_WEB,
    process.env.GOOGLE_CLIENT_ID_ANDROID,
    process.env.GOOGLE_CLIENT_ID_IOS,
].filter((value): value is string => Boolean(value && value.trim()));

// NVIDIA API key
export const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
export const NVIDIA_AI_MODEL = process.env.NVIDIA_AI_MODEL;
export const BASE_URL = process.env.BASE_URL;
export const TEMPERATURE = Number(process.env.TEMPERATURE) || 0.2;
export const TOP_P = Number(process.env.TOP_P) || 0.7;
export const MAX_TOKENS = Number(process.env.MAX_TOKENS) || 2048;

// jwt
const jwtSecret = process.env.JWT_SECRET?.trim();
const isProductionEnv = String(NODE_ENV).toLowerCase() === "production" || String(NODE_ENV).toLowerCase() === "prod";

// Never serve traffic signed with a publicly known key.
if (isProductionEnv && !jwtSecret) {
    throw new Error(
        "JWT_SECRET is required when NODE_ENV is production. Refusing to start with the default signing key. " +
        "Set JWT_SECRET in the environment before starting the server."
    );
}

export const JWT_SECRET = jwtSecret || "default_secret_key";
// flagged so startup can warn loudly when running on the insecure fallback
export const JWT_SECRET_IS_FALLBACK = !jwtSecret;

// Refresh tokens are signed with their own secret so a leaked access secret
// cannot mint refresh tokens. Falls back to JWT_SECRET for backwards
// compatibility with tokens issued before JWT_REFRESH_SECRET existed.
const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET?.trim();
export const JWT_REFRESH_SECRET = jwtRefreshSecret || JWT_SECRET;
export const JWT_REFRESH_SECRET_IS_FALLBACK = !jwtRefreshSecret;

export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
export const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "30d";