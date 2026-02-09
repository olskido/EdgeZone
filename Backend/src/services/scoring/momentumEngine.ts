import { prisma } from '../../models/prisma';
import { logger } from '../../utils/logger';

/**
 * MOMENTUM ENGINE
 * Measures speed & trend of price action
 * 
 * Formula: Momentum = (PriceChange24h + VolumeChange24h) / 2
 * 
 * Color Logic:
 * - GREEN (76-100): Momentum > 15% - High-velocity breakout
 * - BLUE (56-75): Momentum 5-15% - Healthy steady growth
 * - YELLOW (31-55): Momentum -5% to 5% - Sideways "Wait" zone
 * - RED (0-30): Momentum < -10% - Heavy distribution
 */

export type ColorTier = 'GREEN' | 'BLUE' | 'YELLOW' | 'RED';

export interface MomentumResult {
    score: number;
    phase: string;
    color: ColorTier;
    label: string;
    signals: string[];
    rawMomentum: number; // The actual % momentum value
    priceChange24h: number;
    volumeChange24h: number;
}

export function getColorTier(score: number): ColorTier {
    if (score >= 76) return 'GREEN';
    if (score >= 56) return 'BLUE';
    if (score >= 31) return 'YELLOW';
    return 'RED';
}

function getMomentumPhase(score: number): string {
    if (score >= 86) return 'Explosive';
    if (score >= 66) return 'Aggressive';
    if (score >= 46) return 'Trending';
    if (score >= 26) return 'Awakening';
    return 'Dead';
}

function createDefaultResult(signal: string): MomentumResult {
    return {
        score: 25,
        phase: 'Dead',
        color: 'RED',
        label: 'RED',
        signals: [signal],
        rawMomentum: 0,
        priceChange24h: 0,
        volumeChange24h: 0
    };
}

/**
 * Calculate Momentum Score
 * 
 * Formula: Momentum = (PriceChange24h + VolumeChange24h) / 2
 * Then normalize to 0-100 scale
 */
export async function calculateMomentum(tokenId: string): Promise<MomentumResult> {
    const signals: string[] = [];

    try {
        // Get token with snapshot data
        const token = await prisma.token.findUnique({
            where: { id: tokenId },
            include: {
                snapshots: {
                    orderBy: { timestamp: 'desc' },
                    take: 24 // Last 24 snapshots for trend analysis
                }
            }
        });

        if (!token) {
            return createDefaultResult('Token not found');
        }

        const snapshots = token.snapshots;

        // Calculate Price Change 24h (%)
        let priceChange24h = 0;
        if (snapshots.length >= 2) {
            const currentPrice = Number(snapshots[0]?.price || token.price);
            const oldPrice = Number(snapshots[snapshots.length - 1]?.price || currentPrice);

            if (oldPrice > 0) {
                priceChange24h = ((currentPrice - oldPrice) / oldPrice) * 100;
            }
        } else if (snapshots.length === 1 && snapshots[0].priceChange24h) {
            priceChange24h = Number(snapshots[0].priceChange24h);
        }

        // Calculate Volume Change 24h (%)
        let volumeChange24h = 0;
        if (snapshots.length >= 2) {
            const currentVolume = Number(snapshots[0]?.volume || token.volume24h);
            const avgVolume = snapshots.slice(1).reduce((sum, s) => sum + Number(s.volume || 0), 0) / Math.max(1, snapshots.length - 1);

            if (avgVolume > 0) {
                volumeChange24h = ((currentVolume - avgVolume) / avgVolume) * 100;
            }
        }

        // CORE FORMULA: Momentum = (PriceChange24h + VolumeChange24h) / 2
        const rawMomentum = (priceChange24h + volumeChange24h) / 2;

        // Normalize to 0-100 scale
        // Map momentum % to score:
        // >15% = 76-100 (GREEN)
        // 5-15% = 56-75 (BLUE)
        // -5% to 5% = 31-55 (YELLOW)
        // <-10% = 0-30 (RED)
        let score: number;

        if (rawMomentum >= 15) {
            // GREEN zone: 76-100
            score = Math.min(100, 76 + (rawMomentum - 15) * 1.5);
            signals.push(`🚀 HIGH VELOCITY: +${rawMomentum.toFixed(1)}% momentum`);
        } else if (rawMomentum >= 5) {
            // BLUE zone: 56-75
            score = 56 + ((rawMomentum - 5) / 10) * 19;
            signals.push(`📈 Steady growth: +${rawMomentum.toFixed(1)}% momentum`);
        } else if (rawMomentum >= -5) {
            // YELLOW zone: 31-55
            score = 31 + ((rawMomentum + 5) / 10) * 24;
            signals.push(`📊 Sideways: ${rawMomentum >= 0 ? '+' : ''}${rawMomentum.toFixed(1)}% momentum`);
        } else if (rawMomentum >= -10) {
            // Low YELLOW to RED transition
            score = 20 + ((rawMomentum + 10) / 5) * 11;
            signals.push(`📉 Cooling off: ${rawMomentum.toFixed(1)}% momentum`);
        } else {
            // RED zone: 0-20
            score = Math.max(0, 20 + rawMomentum);
            signals.push(`🔴 HEAVY DISTRIBUTION: ${rawMomentum.toFixed(1)}% momentum`);
        }

        score = Math.max(0, Math.min(100, Math.round(score)));

        // Add detailed signals
        if (priceChange24h > 10) {
            signals.push(`💰 Price up ${priceChange24h.toFixed(1)}%`);
        } else if (priceChange24h < -10) {
            signals.push(`⚠️ Price down ${Math.abs(priceChange24h).toFixed(1)}%`);
        }

        if (volumeChange24h > 50) {
            signals.push(`🔥 Volume surge +${volumeChange24h.toFixed(0)}%`);
        } else if (volumeChange24h < -30) {
            signals.push(`📉 Volume declining ${volumeChange24h.toFixed(0)}%`);
        }

        const phase = getMomentumPhase(score);
        const color = getColorTier(score);
        const label = color;

        return {
            score,
            phase,
            color,
            label,
            signals,
            rawMomentum,
            priceChange24h,
            volumeChange24h
        };

    } catch (err: any) {
        logger.error({ tokenId, err: err.message }, 'Momentum calculation failed');
        return createDefaultResult('Error calculating momentum');
    }
}
