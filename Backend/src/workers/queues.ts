import { Queue } from 'bullmq';
import { redis } from '../cache/redis';

const connection = redis;

export const queues = {
  tokenScanner: new Queue('token-scanner', { connection }),
  walletIntelligence: new Queue('wallet-intelligence', { connection }),
  aiInterpretation: new Queue('ai-interpretation', { connection }),
  snapshot: new Queue('snapshot', { connection }),
  scoring: new Queue('scoring', { connection })
} as const;
