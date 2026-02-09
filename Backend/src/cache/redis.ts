import Redis from 'ioredis';
import { env } from '../config/env';

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  enableOfflineQueue: false,
  connectTimeout: 500,
  retryStrategy: () => null
});

redis.on('error', (err) => {
  try {
    // eslint-disable-next-line no-console
    console.error('[redis]', err?.message || err);
  } catch {
    return;
  }
});
