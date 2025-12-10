import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import 'module-alias/register.js';
import morgan from 'morgan';
import path from 'path';
import { config } from './config.js';
import { authMiddleware } from './middlewares/auth.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { instanceValidationMiddleware } from './middlewares/instanceValidation.js';
import { adminRouter } from './routes/admin.js';
import authRouter from './routes/auth.js';
import { eventsRouter } from './routes/events.js';
import { sessionsRouter } from './routes/sessions.js';
import { syncRouter } from './routes/sync.js';
import { tabsRouter } from './routes/tabs.js';
import logger, { stream } from './utils/logger.js';
import { initializeStartup } from './utils/startup.js';

export const app = express();

// Security headers - Configure helmet to allow CORS
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  }),
);

// CORS configuration for Chrome extension support
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, Postman, curl)
    if (!origin) {
      return callback(null, true);
    }

    // Allow chrome-extension:// origins
    if (origin.startsWith('chrome-extension://')) {
      return callback(null, true);
    }

    // Allow moz-extension:// origins (Firefox)
    if (origin.startsWith('moz-extension://')) {
      return callback(null, true);
    }

    // Check against allowed origins from config
    if (
      config.allowedOrigins.length === 0 ||
      config.allowedOrigins.includes(origin) ||
      config.allowedOrigins.includes('*')
    ) {
      return callback(null, true);
    }

    // In development mode, allow localhost and local IPs
    if (config.isDevelopment) {
      if (
        origin.includes('localhost') ||
        origin.includes('127.0.0.1') ||
        /^https?:\/\/(10|172\.16|192\.168|100\.64)\./.test(origin)
      ) {
        return callback(null, true);
      }
    }

    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'X-Instance-ID',
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  credentials: true,
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

// Handle preflight requests explicitly
// app.options("*", cors(corsOptions));
// Handle preflight requests explicitly - Express 5 compatible
app.options('/*splat', cors(corsOptions)); // ✅ Changed from "*"

// HTTP request logging
app.use(morgan('combined', { stream }));

// Rate limiting
app.use(
  rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    standardHeaders: true,
    handler: (
      req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
      options: any,
    ) => {
      const ip = req.ip || req.connection.remoteAddress;
      logger.warn(`Rate limit exceeded for IP: ${ip}, Path: ${req.path}`);
      res.status(options.statusCode).json(options.message);
    },
    message: {
      success: false,
      error: 'Too many requests, please try again later.',
    },
  }),
);

// Parse JSON request bodies
app.use(express.json({ limit: '1mb' }));

// Admin routes (no auth required)
app.use('/api/v1/admin', adminRouter);

// Apply authentication middleware
app.use(authMiddleware);
app.use(instanceValidationMiddleware);

// Health check endpoint (exempt from auth)
app.get('/api/v1/health', (_req: express.Request, res: express.Response) => {
  res.json({ status: 'ok' });
});

// API Routes
app.use('/api/v1/tabs', tabsRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/sync', syncRouter);
app.use('/api/v1/sessions', sessionsRouter);
app.use('/api/v1/events', eventsRouter);

// Error handling middleware
app.use(errorHandler);

const domain = process.env.DOMAIN?.trim();

let trustProxySetting;

if (domain && domain.length > 0) {
  trustProxySetting = domain;
} else {
  trustProxySetting = false;
}

app.set('trust proxy', trustProxySetting);

// Initialize database and create default user before starting server
// This ensures console output is visible before Express takes over
let server: ReturnType<typeof app.listen>;

async function startServer() {
  try {
    // Run startup initialization first
    await initializeStartup();

    // Now start the Express server
    const host = '0.0.0.0';
    server = app.listen(config.port, host, () => {
      const accessUrl = `http://localhost:${config.port}`;
      logger.info(
        `Server is running in ${config.nodeEnv} mode on ${host}:${config.port}`,
      );
      logger.info(`Accessible locally at ${accessUrl}`);
      logger.info(`Log level: ${config.logLevel}`);
      logger.info(`Logs directory: ${path.join(process.cwd(), config.logDir)}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
console.log('🚀 Starting Tab Sync API server...');
startServer().catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});

// Graceful shutdown handler
const shutdown = (signal: string) => {
  logger.info(`Received ${signal}, shutting down.`);
  server.close(async () => {
    logger.info('HTTP server closed.');

    // Note: Database connection is managed by the db module
    // and will be closed automatically when the process exits

    process.exit(0);
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export * from './db.js';
