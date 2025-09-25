import * as dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const configSchema = z.object({
  PORT: z.string().regex(/^\d+$/).optional(),
  DATABASE_PATH: z.string().min(1).optional()
});

const parseResult = configSchema.safeParse(process.env);

if (!parseResult.success) {
  throw new Error('Environment configuration validation failed');
}

export const config = {
  port: process.env.PORT ? Number(process.env.PORT) : 3000,
  databasePath: process.env.DATABASE_PATH || './data/tabs.db'
};
