import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  BIRDEYE_API_KEY: z.string().min(1),
  BIRDEYE_API_URL: z.string().url().default('https://public-api.birdeye.so'),
  INGESTION_INTERVAL_SEC: z.coerce.number().int().positive().default(120),
  INGESTION_MIN_LIQUIDITY: z.coerce.number().int().nonnegative().default(10000),
  INGESTION_MIN_VOLUME: z.coerce.number().int().nonnegative().default(5000),
  INGESTION_ENABLED: z.enum(['true', 'false']).default('true'),
  HELIUS_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional()
});

export type Env = z.infer<typeof EnvSchema>;

export const env: Env = EnvSchema.parse(process.env);
