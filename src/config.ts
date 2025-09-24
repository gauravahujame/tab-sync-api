import * as dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT ? Number(process.env.PORT) : 3000,
  databasePath: process.env.DATABASE_PATH || './data/tabs.db'
};
