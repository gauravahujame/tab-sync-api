// require('module-alias/register');
import 'module-alias/register.js';
import express from 'express';
import tabsRouter from '@routes/tabs';
import { config } from '@base/config';
import { errorHandler } from '@middlewares/errorHandler';

const app = express();
app.use(express.json());

// Health endpoint
app.get('/api/v1/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Tabs API
app.use('/api/v1/tabs', tabsRouter);

// Global error handler
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`API server listening at http://localhost:${config.port}`);
});
