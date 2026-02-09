import { Worker } from 'bullmq';
import { redis } from '../cache/redis';
import { logger } from '../utils/logger';
import { prisma } from '../models/prisma';
import { calculateMomentum } from '../services/scoring/momentumEngine';
import { calculateConviction } from '../services/scoring/convictionEngine';
import { detectWalletClusters } from '../services/scoring/walletClusterEngine';
import { calculateThreat } from '../services/scoring/threatEngine';
import { analyzeMarketStructure } from '../services/scoring/marketStructureEngine';

/**
 * Scoring Worker
 * Recomputes all scoring engines for active tokens
 * Runs every 5-10 minutes to keep intelligence fresh
 */
export const scoringWorker = new Worker(
    'scoring',
    async (job) => {
        const t0 = Date.now();
        logger.info({ jobId: job.id }, 'Starting scoring cycle');

        try {
            // Get tokens with recent activity
            const tokens = await prisma.token.findMany({
                where: {
                    lastSeenAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
                },
                select: {
                    id: true,
                    name: true,
                    ticker: true
                },
                take: 100 // Limit to top 100 most recent tokens
            });

            logger.info({ tokenCount: tokens.length }, 'Computing scores for active tokens');

            let successCount = 0;
            let errorCount = 0;

            for (const token of tokens) {
                try {
                    // Run all scoring engines in parallel
                    const [momentum, conviction, cluster, threat, marketStructure] = await Promise.all([
                        calculateMomentum(token.id),
                        calculateConviction(token.id),
                        detectWalletClusters(token.id),
                        calculateThreat(token.id),
                        analyzeMarketStructure(token.id)
                    ]);

                    // Update token with computed scores
                    await prisma.token.update({
                        where: { id: token.id },
                        data: {
                            momentumScore: momentum.score,
                            convictionScore: conviction.score,
                            threatLevel: threat.level,
                            clusterDetected: cluster.clusterDetected,
                            smartWalletFlow: cluster.clusterDetected && cluster.clusterScore > 50
                        }
                    });

                    successCount++;
                } catch (err: any) {
                    errorCount++;
                    logger.warn({
                        tokenId: token.id,
                        ticker: token.ticker,
                        err: err.message
                    }, 'Failed to compute scores');
                }
            }

            const duration = Date.now() - t0;
            logger.info({
                successCount,
                errorCount,
                duration
            }, 'Scoring cycle completed');

        } catch (err: any) {
            logger.error({ err: err.message }, 'Scoring worker failed');
            throw err;
        }
    },
    {
        connection: redis,
        concurrency: 1
    }
);

scoringWorker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Scoring job completed');
});

scoringWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'Scoring job failed');
});
