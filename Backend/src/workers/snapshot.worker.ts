import { Worker } from 'bullmq';
import { redis } from '../cache/redis';
import { logger } from '../utils/logger';
import { prisma } from '../models/prisma';
import { fetcher } from '../services/birdeye/fetcher';
import type { BirdeyeTokenListItem } from '../services/birdeye/types';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Snapshot Worker
 * Stores market data snapshots every 5-10 minutes for velocity calculations
 * 
 * IMPORTANT: Uses sequential processing to avoid API rate limits
 */
export const snapshotWorker = new Worker(
    'snapshot',
    async (job) => {
        const t0 = Date.now();
        logger.info({ jobId: job.id }, 'Starting snapshot cycle');

        try {
            // Check if rate limited - if so, skip this cycle
            if (fetcher.isRateLimited()) {
                logger.warn('Birdeye API is rate limited, skipping snapshot cycle');
                return { skipped: true, reason: 'rate_limited' };
            }

            // Get all active tokens (seen in last 24 hours)
            const tokens = await prisma.token.findMany({
                where: {
                    lastSeenAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
                },
                select: {
                    id: true,
                    contract: true,
                    pairAddress: true
                },
                take: 50 // Limit to 50 tokens per cycle to avoid rate limits
            });

            logger.info({ tokenCount: tokens.length }, 'Fetching snapshots for active tokens');

            let snapshotCount = 0;
            let errorCount = 0;
            let rateLimitedCount = 0;

            // Process tokens SEQUENTIALLY - not in parallel!
            for (const token of tokens) {
                // Check rate limit before each request
                if (fetcher.isRateLimited()) {
                    logger.warn('Hit rate limit during snapshot cycle, stopping');
                    rateLimitedCount = tokens.length - snapshotCount - errorCount;
                    break;
                }

                try {
                    // Fetch current token data from Birdeye
                    const tokenData = await fetchTokenData(token.contract);

                    if (!tokenData) {
                        continue;
                    }

                    // Store snapshot
                    await prisma.marketSnapshot.create({
                        data: {
                            tokenId: token.id,
                            price: tokenData.price,
                            liquidity: tokenData.liquidity,
                            volume: tokenData.volume_24h_usd || 0,
                            marketCap: tokenData.market_cap || 0,
                            fdv: tokenData.fdv || null,
                            priceChange24h: tokenData.price_change_24h_percent || null,
                            timestamp: new Date()
                        }
                    });

                    snapshotCount++;

                    // Rate limiting: wait between requests
                    await sleep(300);

                } catch (err: any) {
                    errorCount++;
                    logger.warn({ tokenId: token.id, err: err.message }, 'Failed to create snapshot');

                    // If it's a rate limit error, stop processing
                    if (err.message?.includes('Rate Limit') || err.message?.includes('Compute units')) {
                        rateLimitedCount = tokens.length - snapshotCount - errorCount;
                        break;
                    }
                }
            }

            const duration = Date.now() - t0;
            logger.info({
                snapshotCount,
                errorCount,
                rateLimitedCount,
                duration
            }, 'Snapshot cycle completed');

            return { snapshotCount, errorCount, rateLimitedCount, duration };

        } catch (err: any) {
            logger.error({ err: err.message }, 'Snapshot worker failed');
            throw err;
        }
    },
    {
        connection: redis,
        concurrency: 1 // Only 1 job at a time
    }
);

async function fetchTokenData(contractAddress: string): Promise<BirdeyeTokenListItem | null> {
    try {
        // Use Birdeye fetcher to get token market data
        const tokenData = await fetcher.fetchTokenMarketData(contractAddress);

        if (!tokenData) {
            logger.warn({ contractAddress }, 'Token not found in Birdeye');
            return null;
        }

        return tokenData;
    } catch (err: any) {
        logger.warn({ contract: contractAddress, err: err.message }, 'Failed to fetch token data');
        return null;
    }
}

snapshotWorker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Snapshot job completed');
});

snapshotWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'Snapshot job failed');
});
