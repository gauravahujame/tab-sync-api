import * as dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({
  quiet: true,
});

const configSchema = z.object({
  PORT: z.string().regex(/^\d+$/).optional(),
  DATABASE_PATH: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(1).optional(),
  RATE_LIMIT_ENABLED: z.string().optional(),
  RATE_LIMIT_WINDOW_MS: z.string().regex(/^\d+$/).optional(),
  RATE_LIMIT_MAX_REQUESTS: z.string().regex(/^\d+$/).optional(),
  ALLOWED_ORIGINS: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']).default('info'),
  LOG_DIR: z.string().min(1).default('./data/logs'),
  LOG_MAX_SIZE: z.string().default('20m'),
  LOG_MAX_FILES: z.string().default('30d'),
  LOG_ERROR_MAX_FILES: z.string().default('60d'),

  // Database configuration
  DB_TYPE: z.enum(['sqlite', 'postgres']).optional(),
  DB_HOST: z.string().optional(),
  DB_PORT: z.string().regex(/^\d+$/).optional(),
  DB_USERNAME: z.string().optional(),
  DB_PASSWORD: z.string().optional(),
  DB_NAME: z.string().optional(),
});

const parseResult = configSchema.safeParse(process.env);

if (!parseResult.success) {
  throw new Error('Environment configuration validation failed');
}

const env = parseResult.data;

// Determine database type
const dbType = (env.DB_TYPE || 'sqlite') as 'sqlite' | 'postgres';

// Validate PostgreSQL config if type is postgres
if (dbType === 'postgres' && !env.DB_NAME) {
  throw new Error('DB_NAME is required when DB_TYPE is postgres');
}

export const config = {
  port: env.PORT ? Number(env.PORT) : 3000,
  nodeEnv: env.NODE_ENV || 'development',
  isProduction: (env.NODE_ENV || 'development') === 'production',
  isDevelopment: (env.NODE_ENV || 'development') === 'development',
  isTest: (env.NODE_ENV || 'development') === 'test',

  // Database configuration
  database: {
    type: dbType,
    sqlitePath: env.DATABASE_PATH || './data/tabs.db',
    postgres: {
      host: env.DB_HOST || 'localhost',
      port: env.DB_PORT ? Number(env.DB_PORT) : 5432,
      username: env.DB_USERNAME || 'root',
      password: env.DB_PASSWORD || 'password',
      database: env.DB_NAME || 'tabsync',
    },
  },

  // Legacy path (kept for backward compatibility)
  databasePath: env.DATABASE_PATH || './data/tabs.db',
  logDir: env.LOG_DIR || './data/logs',

  // JWT
  jwtSecret: env.JWT_SECRET || 'default-secret-key-change-in-production',

  // CORS
  allowedOrigins: env.ALLOWED_ORIGINS
    ? env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
    : [],

  // Rate limiting
  rateLimit: {
    enabled: env.RATE_LIMIT_ENABLED === 'true' || env.RATE_LIMIT_ENABLED === undefined, // Default to true
    windowMs: env.RATE_LIMIT_WINDOW_MS ? Number(env.RATE_LIMIT_WINDOW_MS) : 60 * 1000, // 1 minute
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS ? Number(env.RATE_LIMIT_MAX_REQUESTS) : 60, // 60 requests per minute
  },

  // Logging
  logLevel: env.LOG_LEVEL || 'info',
  logMaxSize: env.LOG_MAX_SIZE || '20m',
  logMaxFiles: env.LOG_MAX_FILES || '30d',
  logErrorMaxFiles: env.LOG_ERROR_MAX_FILES || '60d',

  // Sync configuration
  sync: {
    snapshotRetentionDays: 90, // Prune snapshots older than 90 days
    maxSnapshotsPerInstance: 1000, // Max snapshots to keep per instance
  },
};
