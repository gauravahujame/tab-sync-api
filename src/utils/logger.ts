import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import path from "path";
import { config } from "../config.js";

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), config.logDir);

// Create a format for console output
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.printf(
    ({ level, message, timestamp, stack }) =>
      `${timestamp} ${level}: ${stack || message}`,
  ),
);

// Create a format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

// Create transports
const transports = [
  // Console transport
  new winston.transports.Console({
    format: consoleFormat,
    level: config.logLevel,
  }),
  // Daily rotate file transport for all logs
  new DailyRotateFile({
    filename: path.join(logsDir, "application-%DATE%.log"),
    datePattern: "YYYY-MM-DD",
    zippedArchive: true,
    maxSize: config.logMaxSize,
    maxFiles: config.logMaxFiles,
    format: fileFormat,
    level: config.logLevel,
  }),
  // Error logs in separate file
  new DailyRotateFile({
    filename: path.join(logsDir, "error-%DATE%.log"),
    datePattern: "YYYY-MM-DD",
    zippedArchive: true,
    maxSize: config.logMaxSize,
    maxFiles: config.logErrorMaxFiles,
    format: fileFormat,
    level: "error",
  }),
];

// Create the logger
const logger = winston.createLogger({
  level: config.logLevel,
  format: fileFormat,
  defaultMeta: { service: "tab-sync-api" },
  transports,
  exceptionHandlers: [
    new DailyRotateFile({
      filename: path.join(logsDir, "exceptions-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      zippedArchive: true,
      maxSize: config.logMaxSize,
      maxFiles: config.logMaxFiles,
    }),
  ],
  rejectionHandlers: [
    new DailyRotateFile({
      filename: path.join(logsDir, "rejections-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      zippedArchive: true,
      maxSize: config.logMaxSize,
      maxFiles: config.logMaxFiles,
    }),
  ],
  exitOnError: false, // Don't exit on handled exceptions
});

// Stream for morgan (HTTP request logging)
export const stream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};

export default logger;
