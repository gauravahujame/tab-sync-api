import 'module-alias/register.js';
import helmet from 'helmet';
import express from 'express';
import rateLimit from 'express-rate-limit';
import winston from 'winston';
import { config } from './config.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { tabsRouter } from './routes/tabs.js';
import { db } from './db.js';

const logger = winston.createLogger({
  level: 'info',
  transports: [
    new winston.transports.Console()
  ]
});

export const app = express();

app.use(helmet());
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 60
}));

app.use(express.json());

app.get('/api/v1/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/v1/tabs', tabsRouter);

app.use(errorHandler);

const server = app.listen(config.port, '0.0.0.0', () => {
  logger.info(`API server listening at http://localhost:${config.port}`);
});

const shutdown = (signal: string) => {
  logger.info(`Received ${signal}, shutting down.`);
  server.close(() => {
    db.close(() => {
      logger.info("Database connection closed.");
      process.exit(0);
    });
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export * from './db.js';
