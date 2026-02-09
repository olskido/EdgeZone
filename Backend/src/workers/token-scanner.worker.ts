import { Worker } from 'bullmq';
import { redis } from '../cache/redis';
import { logger } from '../utils/logger';
import { fetcher } from '../services/birdeye/fetcher';
import { filter } from '../services/birdeye/filter';
import { normalizer } from '../services/birdeye/normalizer';
import { ingestor } from '../services/birdeye/ingestor';
import { env } from '../config/env';

const INGESTION_ENABLED = process.env.INGESTION_ENABLED !== 'false';

export const tokenScannerWorker = new Worker(
  'token-scanner',
  async (job) => {
    if (!INGESTION_ENABLED) {
      logger.info('Ingestion disabled by config, skipping');
      return;
    }

    const t0 = Date.now();
    logger.info({ jobId: job.id }, 'Starting token ingestion cycle');

    try {
      // BIRDEYE COMPREHENSIVE STRATEGY: Fetch ALL tokens matching criteria
      // Server-side filtering: Volume > $200k, Market Cap > $100k
      logger.info('Fetching ALL tokens from Birdeye with server-side filtering...');

      const tokens = await fetcher.fetchAllTokens({
        minVolume24h: 200000,  // $200k volume requirement
        minMarketCap: 100000,  // $100k market cap requirement
        minLiquidity: 2000     // $2k liquidity minimum
      });

      logger.info({
        fetched: tokens.length
      }, 'Fetched all matching tokens from Birdeye');

      if (tokens.length === 0) {
        logger.warn('No tokens returned from Birdeye, ending cycle');
        return;
      }

      // 2. Additional client-side filtering (minimal, most filtering done server-side)
      const validTokens = filter.process(tokens, {
        minLiquidityUsd: 2000,      // Already filtered server-side, but double-check
        minVolume24h: 200000,       // Already filtered server-side
        minMarketCap: 100000,       // Already filtered server-side
        minAgeHours: 0              // No age requirement
      });

      if (validTokens.length === 0) {
        logger.warn('No tokens passed client-side filters, ending cycle');
        return;
      }

      // 3. Normalize
      const normalizedTokens = normalizer.normalize(validTokens);

      // 4. Ingest
      const { upsertedCount, snapshotCount, failedBatches } = await ingestor.ingest(normalizedTokens);

      const duration = Date.now() - t0;
      logger.info({
        service: 'ingestion',
        duration,
        fetched: tokens.length,
        filtered: validTokens.length,
        normalized: normalizedTokens.length,
        upserted: upsertedCount,
        snapshots: snapshotCount,
        failedBatches
      }, 'Ingestion cycle completed');

    } catch (err: any) {
      logger.error({ err: err.message, stack: err.stack }, 'Ingestion cycle failed');
      throw err; // Allow BullMQ to handle retry
    }
  },
  {
    connection: redis,
    concurrency: 1, // Prevent overlapping runs
    lockDuration: 30000 // 30s lock
  }
);

