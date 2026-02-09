import { Worker } from 'bullmq';
import { redis } from '../cache/redis';
import { logger } from '../utils/logger';

export const momentumAnalyzerWorker = new Worker(
  'momentum-analyzer',
  async () => {
    logger.info('momentum-analyzer: tick');
  },
  { connection: redis }
);
