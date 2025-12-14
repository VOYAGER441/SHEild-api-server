import winston from 'winston';
import 'winston-daily-rotate-file';
import * as path from 'path';
import env from '@/environment';

// Define log levels (using npm levels for winston)
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
};

const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'blue',
    debug: 'gray',
};

// Add colors to winston
winston.addColors(colors);

// Helper to get caller info
// This must be a standalone function or strict method to keep stack trace consistent
function getCallerInfo(): string {
    // Create an error to capture the stack
    const stack = new Error().stack;
    if (!stack) return '';

    const stackLines = stack.split('\n');

    // We need to find the first line that is NOT from inside the logger, winston, or this file
    // Stack typically:
    // Error
    //  at getCallerInfo (...)
    //  at Logger.log (...)
    //  at Logger.info (...)  <-- we are here usually
    //  at Object.<anonymous> (/path/to/caller.ts:5:5)
    //
    // Because we wrap winston, we might have a few layers.

    for (let i = 2; i < stackLines.length; i++) {
        const line = stackLines[i];
        // Skip internal logger stuff and node modules
        if (!line.includes('Logger.') &&
            !line.includes('getCallerInfo') &&
            !line.includes('node_modules') &&
            !line.includes(__filename)) {

            // Extract path: (path:line:col)
            const match = line.match(/\((.*):(\d+):(\d+)\)/);
            if (match) {
                const [_, filePath, lineNum] = match;
                const relativePath = path.relative(process.cwd(), filePath);
                return `${relativePath}:${lineNum}`;
            }

            // Handle no parens case "at path:line:col"
            const matchNoParens = line.match(/at\s+(.*):(\d+):(\d+)/);
            if (matchNoParens) {
                const parts = line.trim().split(' ');
                const pathPart = parts[parts.length - 1];
                const cleanPath = pathPart.replace(/:\d+$/, '');
                const [fileOnly, lineOnly] = cleanPath.split(':');
                if (fileOnly && lineOnly) {
                    const relativePath = path.relative(process.cwd(), fileOnly);
                    return `${relativePath}:${lineOnly}`;
                }
                return cleanPath;
            }
        }
    }
    return 'unknown';
}

// Custom format for console that includes caller info and colors
const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
    winston.format.printf((info) => {
        // We expect 'caller' to be passed in metadata if possible, or we capture it here if not present.
        // However, capturing here in the formatter might be too late/incorrect context if async.
        // Better to capture in the wrapper methods.

        // If we passed caller in the info object (metadata), use it.
        const caller = info.caller || 'unknown';
        const { timestamp, level, message, ...meta } = info;

        // If there are other metadata args, print them
        // meta includes caller, so we exclude it from the printed metadata object
        const { caller: _, ...remainingMeta } = meta as any;

        const metaStr = Object.keys(remainingMeta).length
            ? JSON.stringify(remainingMeta)
            : '';

        // Colorize manually or use winston.format.colorize()
        // Let's use winston's colorize just for the level
        const colorizedLevel = winston.format.colorize().colorize(level, level.toUpperCase());

        // Use ANSI colors for other parts to match the previous aesthetic
        const grey = '\x1b[90m';
        const cyan = '\x1b[36m';
        const reset = '\x1b[0m';

        // Handle objects in message
        let logMessage = message;
        if (typeof message === 'object' && message !== null) {
            logMessage = JSON.stringify(message, null, 2);
        }

        return `${grey}[${timestamp}]${reset} ${colorizedLevel} ${cyan}(${caller})${reset} ${logMessage} ${metaStr}`;
    })
);

// File format (no colors, json or simple text)
const fileFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
    winston.format.printf((info) => {
        const caller = info.caller || 'unknown';
        const { timestamp, level, message, ...meta } = info;

        const { caller: _, ...remainingMeta } = meta as any;
        const metaStr = Object.keys(remainingMeta).length
            ? JSON.stringify(remainingMeta)
            : '';

        let logMessage = message;
        if (typeof message === 'object' && message !== null) {
            logMessage = JSON.stringify(message, null, 2);
        }

        return `[${timestamp}] ${level.toUpperCase()} (${caller}) ${logMessage} ${metaStr}`;
    })
);

export class Logger {
    private logger: winston.Logger;

    constructor() {
        const envLevel = env.LOG_LEVEL || 'info';
        const logOutput = env.LOG_OUTPUT || 'console'; // 'console', 'file', or 'console,file'
        const logFile = env.LOG_FILE_PATH || 'logs/app.log';

        const transports: winston.transport[] = [];

        if (logOutput.includes('console')) {
            transports.push(new winston.transports.Console({
                format: consoleFormat,
            }));
        }

        if (logOutput.includes('file')) {
            transports.push(new winston.transports.DailyRotateFile({
                dirname: 'logs',
                filename: '%DATE%-app.log',
                datePattern: 'YYYY-MM-DD',
                zippedArchive: true,
                maxSize: '20m',
                maxFiles: '14d',
                format: fileFormat,
            }));
        }

        // Default to console if nothing specified or invalid
        if (transports.length === 0) {
            transports.push(new winston.transports.Console({
                format: consoleFormat,
            }));
        }

        this.logger = winston.createLogger({
            level: envLevel,
            levels,
            transports,
        });
    }

    // Wrapper methods to capture caller info
    public debug(message: any, ...meta: any[]) {
        this.logger.debug(message, { caller: getCallerInfo(), ...meta });
    }

    public info(message: any, ...meta: any[]) {
        this.logger.info(message, { caller: getCallerInfo(), ...meta });
    }

    public warn(message: any, ...meta: any[]) {
        this.logger.warn(message, { caller: getCallerInfo(), ...meta });
    }

    public error(message: any, ...meta: any[]) {
        this.logger.error(message, { caller: getCallerInfo(), ...meta });
    }
}

export const Log = new Logger();
