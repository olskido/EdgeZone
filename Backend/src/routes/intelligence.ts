import { FastifyInstance } from 'fastify';
import { aggregateTokenIntelligence } from '../services/intelligenceAggregator';
import { prisma } from '../models/prisma';
import { logger } from '../utils/logger';
import { redis } from '../cache/redis';
import { z } from 'zod'; // Added import for zod
import { socialEngine } from '../services/scoring/socialEngine'; // Added import for socialEngine

// Helper: timeout wrapper
const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('TIMEOUT')), ms);
        promise
            .then((result) => { clearTimeout(timer); resolve(result); })
            .catch((err) => { clearTimeout(timer); reject(err); });
    });
};

export async function intelligenceRoutes(app: FastifyInstance) {
    /**
     * GET /token/:id/intelligence
     * Returns complete intelligence payload for a token
     * Timeout: 5 seconds (returns cached/fallback data if exceeded)
     */
    app.get('/token/:id/intelligence', async (request, reply) => {
        const { id } = request.params as { id: string };
        const startTime = Date.now();

        try {
            // Try cached result first (50ms check)
            const cacheKey = `intelligence: v3:${id} `;
            const cached = await redis.get(cacheKey).catch(() => null);
            if (cached) {
                logger.info({ tokenId: id, cached: true, duration: Date.now() - startTime }, '⚡ Intelligence from cache');
                reply.header('Cache-Control', 'public, max-age=30');
                return JSON.parse(cached);
            }

            // Full aggregation with 5-second timeout
            const intelligence = await withTimeout(
                aggregateTokenIntelligence(id),
                5000
            );

            logger.info({ tokenId: id, duration: Date.now() - startTime }, '✅ Intelligence aggregated');
            reply.header('Cache-Control', 'public, max-age=30');
            return intelligence;

        } catch (err: any) {
            // On timeout, return minimal fast response from DB
            if (err.message === 'TIMEOUT') {
                logger.warn({ tokenId: id, duration: Date.now() - startTime }, '⏱️ Intelligence timeout, returning fast fallback');

                try {
                    // Fast DB lookup for basic token data
                    const token = await prisma.token.findUnique({
                        where: { id },
                        select: {
                            id: true, name: true, ticker: true, contract: true,
                            price: true, liquidity: true, volume24h: true, marketCap: true,
                            pairCreatedAt: true, dexId: true
                        }
                    });

                    if (!token) {
                        return reply.code(404).send({ error: 'Token not found' });
                    }

                    // Return minimal intelligence with loading flags
                    return {
                        header: {
                            priceUsd: Number(token.price),
                            liquidityUsd: Number(token.liquidity),
                            marketCap: Number(token.marketCap),
                            volume24h: Number(token.volume24h),
                            pairAge: token.pairCreatedAt ? formatAge(new Date(token.pairCreatedAt)) : 'N/A',
                            dexId: token.dexId || 'birdeye',
                            baseToken: { symbol: token.ticker, name: token.name }
                        },
                        edgeScore: { score: 50, level: 'LOADING', color: '#71717a', breakdown: {}, topSignals: [], riskFactors: [], bullishFactors: [], recommendation: { action: 'WAIT', reason: 'Loading full analysis...', confidence: 0 } },
                        alpha: { score: 'C', numericScore: 50, color: 'YELLOW', breakdown: { momentum: 50, conviction: 50, safety: 50 }, signals: [] },
                        momentum: { score: 50, phase: 'LOADING', color: 'YELLOW', label: 'Loading...', signals: [] },
                        conviction: { score: 50, color: 'YELLOW', signals: [] },
                        threat: { score: 50, safetyScore: 50, level: 'LOADING', color: 'YELLOW', warnings: [] },
                        devProfile: { reputation: { score: 50, label: 'LOADING' }, drainAlert: { triggered: false }, bundleRisk: { score: 0 }, signals: [], color: 'YELLOW' },
                        marketIntegrity: { overallScore: 50, washTrading: { detected: false, washVolumePercent: 0, color: 'GREEN' }, signals: [], color: 'YELLOW' },
                        degenIntel: { narrative: { currentSector: 'LOADING', mindshare: 0, trending: false, sectors: [], heatmap: 'NEUTRAL' }, smartFlow: { score: 50 }, sentiment: { overall: 'NEUTRAL', score: 50, keyInsight: 'Loading...', suggestedAction: 'Please wait' }, signals: [], color: 'YELLOW' },
                        holderPatterns: { patterns: [], summary: {} },
                        whaleActivity: { recent: [], netFlow: 0, alert: null },
                        aiAnalysis: { summary: 'Loading analysis...', sentiment: 'NEUTRAL', sentimentColor: 'BLUE', confidence: 0, keyInsights: [], riskLevel: 'MEDIUM', actionSuggestion: 'Wait for full analysis', whaleAlert: null, cachedAt: null },
                        _partial: true,
                        _loadingTime: Date.now() - startTime
                    };
                } catch (dbErr) {
                    logger.error({ tokenId: id, err: (dbErr as Error).message }, 'Fast fallback also failed');
                }
            }

            logger.error({ tokenId: id, err: err.message }, 'Intelligence endpoint failed');

            if (err.message === 'Token not found') {
                return reply.code(404).send({ error: 'Token not found' });
            }

            return reply.code(500).send({ error: 'Failed to aggregate intelligence' });
        }
    });

    /**
     * GET /trends
     * Returns global trending narratives
     */
    app.get('/trends', async (request, reply) => {
        const trends = await socialEngine.getGlobalTrends();
        return trends;
    });
}

function formatAge(date: Date): string {
    const diffMs = Date.now() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays > 0) return `${diffDays} d`;
    if (diffHours > 0) return `${diffHours} h`;
    return '<1h';
}
