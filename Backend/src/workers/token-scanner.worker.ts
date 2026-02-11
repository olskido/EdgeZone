import { Worker } from 'bullmq';
import { redis } from '../cache/redis';
import { logger } from '../utils/logger';
import { fetcher } from '../services/birdeye/fetcher';
import { filter } from '../services/birdeye/filter';
import { normalizer } from '../services/birdeye/normalizer';
import { ingestor } from '../services/birdeye/ingestor';

const INGESTION_ENABLED = process.env.INGESTION_ENABLED !== 'false';

const MIN_LIQUIDITY = 20000;
const MIN_VOLUME_24H = 200000;
const MIN_MARKET_CAP = 100000;
const MIN_AGE_HOURS = 24;

export const tokenScannerWorker = new Worker(
  'token-scanner',
  async (job) => {
    if (!INGESTION_ENABLED) {
      logger.info('Ingestion disabled by config, skipping');
      return;
    }

    const t0 = Date.now();
    logger.info({ jobId: job.id }, 'Starting strict token ingestion cycle');

    try {
      logger.info('Fetching tokens from Birdeye (broad fetch + heavy client filtering)...');

      const rawTokens = await fetcher.fetchAllTokens({
        limit: 500,
        sortBy: 'volume24hUSD',
        sortType: 'desc'
      });

      logger.info({ fetched: rawTokens.length }, 'Raw tokens fetched from Birdeye');

      if (!rawTokens || rawTokens.length === 0) {
        logger.warn('No raw tokens from Birdeye');
        return;
      }

      // Heavy client-side filtering – enforce your exact rules
      const now = Date.now();
      const validTokens = rawTokens.filter((token: any) => {
        const created = token.createdAt || token.pairCreatedAt || token.lastSeenAt || token.created_at || 0;
        const ageMs = now - new Date(created).getTime();
        const ageHours = ageMs / (1000 * 60 * 60);

        const liquidity = Number(token.liquidity ?? token.liquidityUsd ?? 0);
        const volume = Number(token.volume24h ?? token.volume_24h_usd ?? token.volume24hUSD ?? 0);
        const mc = Number(token.marketCap ?? token.market_cap ?? 0);

        return (
          liquidity >= MIN_LIQUIDITY &&
          volume >= MIN_VOLUME_24H &&
          mc >= MIN_MARKET_CAP &&
          ageHours >= MIN_AGE_HOURS &&
          !isNaN(ageHours)
        );
      });

      logger.info({ afterFilter: validTokens.length }, 'Tokens after strict filters');

      if (validTokens.length === 0) return;

      const normalizedTokens = normalizer.normalize(validTokens);
      const { upsertedCount, snapshotCount, failedBatches } = await ingestor.ingest(normalizedTokens);

      const duration = Date.now() - t0;
      logger.info({
        duration,
        raw: rawTokens.length,
        valid: validTokens.length,
        upserted: upsertedCount,
        snapshots: snapshotCount,
        failed: failedBatches
      }, 'Ingestion cycle completed – only high-quality tokens stored');

    } catch (err: any) {
      logger.error({ err: err.message, stack: err?.stack }, 'Ingestion cycle failed');
      throw err; // BullMQ retry
    }
  },
  {
    connection: redis,
    concurrency: 1, // Prevent overlapping runs
    lockDuration: 60000 // 60s lock
  }
);