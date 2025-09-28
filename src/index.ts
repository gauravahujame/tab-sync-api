import "module-alias/register.js";
import path from "path";
import helmet from "helmet";
import express from "express";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import { config } from "./config.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { authMiddleware } from "./middlewares/auth.js";
import { tabsRouter } from "./routes/tabs.js";
import { authRouter } from "./routes/auth.js";
import logger, { stream } from "./utils/logger.js";

export const app = express();

// Security headers
app.use(helmet());

// HTTP request logging
app.use(morgan("combined", { stream }));

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
      error: "Too many requests, please try again later.",
    },
  }),
);

// Parse JSON request bodies
app.use(express.json({ limit: "1mb" }));

// Apply authentication middleware
app.use(authMiddleware);

// Health check endpoint (exempt from auth)
app.get("/api/v1/health", (_req: express.Request, res: express.Response) => {
  res.json({ status: "ok" });
});

// API Routes
app.use("/api/v1/tabs", tabsRouter);
app.use("/api/v1/auth", authRouter);

app.use(errorHandler);

// Start server
const server = app.listen(config.port, () => {
  logger.info(
    `Server is running in ${config.nodeEnv} mode on port ${config.port}`,
  );
  logger.info(`Log level: ${config.logLevel}`);
  logger.info(`Logs directory: ${path.join(process.cwd(), config.logDir)}`);
});

// Graceful shutdown handler
const shutdown = (signal: string) => {
  logger.info(`Received ${signal}, shutting down.`);
  server.close(async () => {
    logger.info("HTTP server closed.");

    // Note: Database connection is managed by the db module
    // and will be closed automatically when the process exits

    process.exit(0);
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

export * from "./db.js";
