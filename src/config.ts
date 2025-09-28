import * as dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const configSchema = z.object({
  PORT: z.string().regex(/^\d+$/).optional(),
  DATABASE_PATH: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(1).optional(),
  RATE_LIMIT_WINDOW_MS: z.string().regex(/^\d+$/).optional(),
  RATE_LIMIT_MAX_REQUESTS: z.string().regex(/^\d+$/).optional(),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  LOG_LEVEL: z
    .enum(["error", "warn", "info", "http", "verbose", "debug", "silly"])
    .default("info"),
  LOG_DIR: z.string().min(1).default("./data/logs"),
  LOG_MAX_SIZE: z.string().default("20m"),
  LOG_MAX_FILES: z.string().default("30d"),
  LOG_ERROR_MAX_FILES: z.string().default("60d"),
});

const parseResult = configSchema.safeParse(process.env);

if (!parseResult.success) {
  throw new Error("Environment configuration validation failed");
}

const env = parseResult.data;

export const config = {
  port: env.PORT ? Number(env.PORT) : 3000,
  nodeEnv: env.NODE_ENV || "development",
  isProduction: (env.NODE_ENV || "development") === "production",
  isDevelopment: (env.NODE_ENV || "development") === "development",
  isTest: (env.NODE_ENV || "development") === "test",

  // Paths
  databasePath: env.DATABASE_PATH || "./data/tabs.db",
  logDir: env.LOG_DIR || "./data/logs",

  // JWT
  jwtSecret: env.JWT_SECRET || "default-secret-key-change-in-production",

  // Rate limiting
  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS
      ? Number(env.RATE_LIMIT_WINDOW_MS)
      : 60 * 1000, // 1 minute
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS
      ? Number(env.RATE_LIMIT_MAX_REQUESTS)
      : 60, // 60 requests per minute
  },

  // Logging
  logLevel: env.LOG_LEVEL || "info",
  logMaxSize: env.LOG_MAX_SIZE || "20m",
  logMaxFiles: env.LOG_MAX_FILES || "30d",
  logErrorMaxFiles: env.LOG_ERROR_MAX_FILES || "60d",
};
