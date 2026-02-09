import { Worker } from 'bullmq';
import { redis } from '../cache/redis';
import { logger } from '../utils/logger';

export const threatDetectorWorker = new Worker(
  'threat-detector',
  async () => {
    logger.info('threat-detector: tick');
  },
  { connection: redis }
);
