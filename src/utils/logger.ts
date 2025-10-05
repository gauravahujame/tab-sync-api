import fs from "fs";
import path from "path";
import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import { config } from "../config.js";

// Ensure logs directory exists BEFORE creating logger
const logsDir = path.join(process.cwd(), config.logDir);
try {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
    console.log(`✅ Created logs directory: ${logsDir}`);
  }
} catch (error) {
  console.error(`❌ Failed to create logs directory: ${logsDir}`, error);
  // Fallback to console-only logging if directory creation fails
}

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

// Create transports array
const transports: winston.transport[] = [
  // Console transport (always available)
  new winston.transports.Console({
    format: consoleFormat,
    level: config.logLevel,
  }),
];

// Only add file transports if directory exists
if (fs.existsSync(logsDir)) {
  try {
    transports.push(
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
    );
  } catch (error) {
    console.error("⚠️  Failed to initialize file logging transports:", error);
  }
}

// Create the logger
const logger = winston.createLogger({
  level: config.logLevel,
  format: fileFormat,
  defaultMeta: { service: "tab-sync-api" },
  transports,
  exitOnError: false,
});

// Add exception and rejection handlers only if directory exists
if (fs.existsSync(logsDir)) {
  try {
    logger.exceptions.handle(
      new DailyRotateFile({
        filename: path.join(logsDir, "exceptions-%DATE%.log"),
        datePattern: "YYYY-MM-DD",
        zippedArchive: true,
        maxSize: config.logMaxSize,
        maxFiles: config.logMaxFiles,
      }),
    );

    logger.rejections.handle(
      new DailyRotateFile({
        filename: path.join(logsDir, "rejections-%DATE%.log"),
        datePattern: "YYYY-MM-DD",
        zippedArchive: true,
        maxSize: config.logMaxSize,
        maxFiles: config.logMaxFiles,
      }),
    );
  } catch (error) {
    console.error(
      "⚠️  Failed to initialize exception/rejection handlers:",
      error,
    );
  }
}

// Stream for morgan (HTTP request logging)
export const stream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};

export default logger;
