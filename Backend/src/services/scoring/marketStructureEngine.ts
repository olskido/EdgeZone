import { prisma } from '../../models/prisma';
import { logger } from '../../utils/logger';

export interface MarketStructureResult {
    phase: 'ACCUMULATION' | 'EXPANSION' | 'DISTRIBUTION' | 'CONTRACTION' | 'NEUTRAL';
    trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    support: number | null;
    resistance: number | null;
    volatility: 'LOW' | 'MEDIUM' | 'HIGH';
    score: number; // 0-100 score for alpha calculation
}

/**
 * Market Structure Engine
 * Analyzes price behavior to determine trend phase and key levels
 */
export async function analyzeMarketStructure(tokenId: string): Promise<MarketStructureResult> {
    try {
        // Get snapshots for last 24 hours
        const snapshots = await prisma.marketSnapshot.findMany({
            where: {
                tokenId,
                timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            },
            orderBy: { timestamp: 'asc' },
            take: 100
        });

        if (snapshots.length < 10) {
            return {
                phase: 'NEUTRAL',
                trend: 'NEUTRAL',
                support: null,
                resistance: null,
                volatility: 'LOW',
                score: 50 // Neutral
            };
        }

        const prices = snapshots.map(s => Number(s.price));
        const volumes = snapshots.map(s => Number(s.volume));

        // Determine trend
        const trend = determineTrend(prices);

        // Determine phase
        const phase = determinePhase(prices, volumes);

        // Find support/resistance
        const { support, resistance } = findKeyLevels(prices);

        // Calculate volatility
        const volatility = calculateVolatility(prices);

        // Calculate score based on phase and trend
        const score = calculateStructureScore(phase, trend, volatility);

        return { phase, trend, support, resistance, volatility, score };

    } catch (err: any) {
        logger.error({ tokenId, err: err.message }, 'Market structure analysis failed');
        return {
            phase: 'NEUTRAL',
            trend: 'NEUTRAL',
            support: null,
            resistance: null,
            volatility: 'LOW',
            score: 50
        };
    }
}

// Calculate structure score for alpha breakdown
function calculateStructureScore(
    phase: string,
    trend: string,
    volatility: string
): number {
    let score = 50; // Base

    // Phase scoring
    if (phase === 'EXPANSION') score += 25;
    else if (phase === 'ACCUMULATION') score += 15;
    else if (phase === 'DISTRIBUTION') score -= 10;
    else if (phase === 'CONTRACTION') score -= 20;

    // Trend scoring
    if (trend === 'BULLISH') score += 15;
    else if (trend === 'BEARISH') score -= 15;

    // Volatility scoring - moderate is best
    if (volatility === 'MEDIUM') score += 5;
    else if (volatility === 'HIGH') score -= 5;

    return Math.max(0, Math.min(100, score));
}

function determineTrend(prices: number[]): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
    if (prices.length < 5) return 'NEUTRAL';

    const recentPrices = prices.slice(-10);
    const olderPrices = prices.slice(-20, -10);

    const recentAvg = recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length;
    const olderAvg = olderPrices.reduce((a, b) => a + b, 0) / olderPrices.length;

    const change = ((recentAvg - olderAvg) / olderAvg) * 100;

    if (change > 5) return 'BULLISH';
    if (change < -5) return 'BEARISH';
    return 'NEUTRAL';
}

function determinePhase(
    prices: number[],
    volumes: number[]
): 'ACCUMULATION' | 'EXPANSION' | 'DISTRIBUTION' | 'CONTRACTION' {
    const priceChange = ((prices[prices.length - 1] - prices[0]) / prices[0]) * 100;
    const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const recentVolume = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;

    // Accumulation: sideways price, increasing volume
    if (Math.abs(priceChange) < 10 && recentVolume > avgVolume * 1.2) {
        return 'ACCUMULATION';
    }

    // Expansion: rising price, high volume
    if (priceChange > 10 && recentVolume > avgVolume) {
        return 'EXPANSION';
    }

    // Distribution: sideways/down price, high volume
    if (priceChange < 5 && recentVolume > avgVolume * 1.1) {
        return 'DISTRIBUTION';
    }

    // Contraction: falling price, declining volume
    return 'CONTRACTION';
}

function findKeyLevels(prices: number[]): { support: number | null; resistance: number | null } {
    if (prices.length < 10) return { support: null, resistance: null };

    // Find local mins (support) and maxs (resistance)
    const localMins: number[] = [];
    const localMaxs: number[] = [];

    for (let i = 2; i < prices.length - 2; i++) {
        if (prices[i] < prices[i - 1] && prices[i] < prices[i + 1]) {
            localMins.push(prices[i]);
        }
        if (prices[i] > prices[i - 1] && prices[i] > prices[i + 1]) {
            localMaxs.push(prices[i]);
        }
    }

    const support = localMins.length > 0
        ? localMins.reduce((a, b) => a + b, 0) / localMins.length
        : null;

    const resistance = localMaxs.length > 0
        ? localMaxs.reduce((a, b) => a + b, 0) / localMaxs.length
        : null;

    return { support, resistance };
}

function calculateVolatility(prices: number[]): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (prices.length < 5) return 'LOW';

    const returns = [];
    for (let i = 1; i < prices.length; i++) {
        returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }

    const variance = returns.reduce((sum, r) => sum + r * r, 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev > 0.05) return 'HIGH';
    if (stdDev > 0.02) return 'MEDIUM';
    return 'LOW';
}
