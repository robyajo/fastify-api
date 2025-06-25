import winston from 'winston';
import path from 'path';
import fs from 'fs';
import DailyRotateFile from 'winston-daily-rotate-file';
import { FastifyRequest } from 'fastify';

// Define log directory
const logDir = path.join(process.cwd(), 'storage', 'logs');

// Ensure log directory exists
const ensureLogDirExists = () => {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
};

// Ensure directory exists before creating logger
ensureLogDirExists();

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Helper function to create file transport with error handling
const createFileTransport = (options: any) => {
  try {
    return new DailyRotateFile({
      ...options,
      filename: path.join(logDir, options.filename),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: options.maxFiles || '14d',
    });
  } catch (error) {
    console.error('Failed to create file transport:', error);
    return null;
  }
};

// Create logger instance with error handling
const logger = winston.createLogger({
  level: 'info', // Default log level
  format: logFormat,
  defaultMeta: { service: 'node-api' },
  transports: [
    // Always log to console
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
      handleExceptions: true,
      handleRejections: true,
    }),
  ],
  exitOnError: false, // Don't exit on handled exceptions
});

// Add file transports with error handling
const errorTransport = createFileTransport({
  level: 'error',
  filename: 'error-%DATE%.log',
  maxFiles: '30d',
});

const appTransport = createFileTransport({
  level: 'info',
  filename: 'application-%DATE%.log',
  maxFiles: '14d',
});

if (errorTransport) logger.add(errorTransport);
if (appTransport) logger.add(appTransport);

// Log unhandled promise rejections and exceptions
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Set log level based on environment
if (process.env.NODE_ENV !== 'production') {
  logger.level = 'debug'; // Log everything in development
} else {
  logger.level = 'info'; // Only log info and above in production
}

// Helper function to format request data for logging
export const formatRequest = (req: FastifyRequest) => ({
  method: req.method,
  url: req.url,
  path: req.url,
  headers: req.headers,
  query: req.query,
  body: req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH' 
    ? { ...(req.body as Record<string, any>), password: (req.body as any)?.password ? '[HIDDEN]' : undefined } 
    : undefined,
  ip: req.ip,
  user: req.user ? { id: req.user.id } : undefined
});

// Custom logging functions
export const logError = (message: string, error: any, meta: Record<string, any> = {}) => {
  const errorInfo = error instanceof Error 
    ? { 
        name: error.name, 
        message: error.message, 
        stack: error.stack,
        ...(error as any).errors // Include validation errors if they exist
      } 
    : error;
  
  logger.error(message, { 
    error: errorInfo,
    ...meta,
    timestamp: new Date().toISOString()
  });
};

export const logInfo = (message: string, meta: Record<string, any> = {}) => {
  logger.info(message, { 
    ...meta,
    timestamp: new Date().toISOString() 
  });
};

export const logWarning = (message: string, meta: Record<string, any> = {}) => {
  logger.warn(message, { 
    ...meta,
    timestamp: new Date().toISOString() 
  });
};

export const logDebug = (message: string, meta: Record<string, any> = {}) => {
  logger.debug(message, { 
    ...meta,
    timestamp: new Date().toISOString() 
  });
};

export default logger;