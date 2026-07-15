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
import { historyRouter } from './routes/history.js';
import { notesRouter } from './routes/notes.js';
import { sessionsRouter } from './routes/sessions.js';
import { snapshotRouter } from './routes/snapshots.js';
import logger, { stream } from './utils/logger.js';
import { initializeStartup } from './utils/startup.js';

export const app = express();

/**
 * ------------------------------------------------------------------
 * TRUST PROXY (Safer Handling)
 * ------------------------------------------------------------------
 * If running behind a reverse proxy (Nginx, Traefik, Cloudflare),
 * set BEHIND_PROXY=true in env.
 *
 * We trust only 1 hop for safety instead of trusting all proxies.
 */
const behindProxy = process.env.BEHIND_PROXY === 'true';
app.set('trust proxy', behindProxy ? 1 : false);

/**
 * ------------------------------------------------------------------
 * SECURITY HEADERS
 * ------------------------------------------------------------------
 */
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  }),
);

/**
 * ------------------------------------------------------------------
 * CORS CONFIGURATION
 * ------------------------------------------------------------------
 * - Supports Chrome & Firefox extensions
 * - Supports mobile apps / curl (no origin)
 * - Supports configured origins
 * - Supports localhost & LAN in development
 *
 * IMPORTANT:
 * We do NOT allow "*" when credentials=true.
 */
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser clients (curl, Postman, mobile apps)
    if (!origin) {
      return callback(null, true);
    }

    // Allow Chrome extensions
    if (origin.startsWith('chrome-extension://')) {
      return callback(null, true);
    }

    // Allow Firefox extensions
    if (origin.startsWith('moz-extension://')) {
      return callback(null, true);
    }

    // If no allowedOrigins configured, allow all explicitly
    if (!config.allowedOrigins || config.allowedOrigins.length === 0) {
      return callback(null, true);
    }

    // Explicit origin match only (NO wildcard with credentials)
    if (config.allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Development convenience: allow localhost + private networks
    if (config.isDevelopment) {
      if (
        origin.includes('localhost') ||
        origin.includes('127.0.0.1') ||
        /^https?:\/\/(10|172\.16|192\.168|100\.64)\./.test(origin)
      ) {
        return callback(null, true);
      }
    }

    return callback(new Error('Not allowed by CORS'));
  },

  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'X-Instance-ID'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  credentials: true,
  maxAge: 86400,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

// Explicit preflight handler (Express 5 compatible)
app.options('/*splat', cors(corsOptions));

/**
 * ------------------------------------------------------------------
 * LOGGING
 * ------------------------------------------------------------------
 */
app.use(morgan('combined', { stream }));

/**
 * ------------------------------------------------------------------
 * RATE LIMITING
 * ------------------------------------------------------------------
 */
// General rate limiter for authenticated routes
const generalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
    options: any,
  ) => {
    const ip = req.ip;
    logger.warn(`Rate limit exceeded for IP: ${ip}, Path: ${req.path}`);
    res.status(options.statusCode).json(options.message);
  },
  message: {
    success: false,
    error: 'Too many requests, please try again later.',
  },
});

// Stricter rate limiter for auth endpoints to prevent brute-force / lockout
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  handler: (
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
    options: any,
  ) => {
    const ip = req.ip;
    logger.warn(`Auth rate limit exceeded for IP: ${ip}, Path: ${req.path}`);
    res.status(options.statusCode).json(options.message);
  },
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later.',
  },
});

/**
 * ------------------------------------------------------------------
 * BODY PARSERS
 * ------------------------------------------------------------------
 * Raw body parser for gzip-compressed snapshot uploads.
 * Must come BEFORE express.json().
 */
app.use(
  express.raw({
    type: req => req.headers['content-encoding'] === 'gzip',
    limit: '10mb',
    inflate: true,
  }),
);

app.use(express.json({ limit: '10mb' }));

/**
 * ------------------------------------------------------------------
 * ROUTES
 * ------------------------------------------------------------------
 */

// Public routes (no auth required)
app.get('/api/v1/health', (_req, res) => {
  res.json({ status: 'ok' });
});

if (config.rateLimit.enabled) {
  app.use('/api/v1/auth', authLimiter);
}
app.use('/api/v1/auth', authRouter);

// Auth middleware
app.use(authMiddleware);
app.use(instanceValidationMiddleware);

if (config.rateLimit.enabled) {
  app.use(generalLimiter);
}

// Protected routes
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/sync', snapshotRouter);
app.use('/api/v1/sessions', sessionsRouter);
app.use('/api/v1/notes', notesRouter);
app.use('/api/v1/history', historyRouter);

/**
 * ------------------------------------------------------------------
 * ERROR HANDLING
 * ------------------------------------------------------------------
 */
app.use(errorHandler);

/**
 * ------------------------------------------------------------------
 * SERVER STARTUP
 * ------------------------------------------------------------------
 */
let server: ReturnType<typeof app.listen>;

async function startServer() {
  try {
    await initializeStartup();

    const host = '0.0.0.0';

    server = app.listen(config.port, host, () => {
      logger.info(`Server running in ${config.nodeEnv} mode on ${host}:${config.port}`);
      logger.info(`Accessible locally at http://localhost:${config.port}`);
      logger.info(`Log level: ${config.logLevel}`);
      logger.info(`Logs directory: ${path.join(process.cwd(), config.logDir)}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Do not auto-start in test
if (process.env.NODE_ENV !== 'test') {
  console.log('🚀 Starting Tab Sync API server...');
  startServer().catch(error => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  });
}

/**
 * ------------------------------------------------------------------
 * GRACEFUL SHUTDOWN
 * ------------------------------------------------------------------
 */
const shutdown = (signal: string) => {
  logger.info(`Received ${signal}, shutting down.`);

  if (!server) {
    process.exit(0);
  }

  server.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export * from './db.js';
