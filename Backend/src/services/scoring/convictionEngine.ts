import { prisma } from '../../models/prisma';
import { logger } from '../../utils/logger';
import { ColorTier, getColorTier } from './momentumEngine';

/**
 * CONVICTION ENGINE
 * Measures quality of the move - is it "real" or a low-liquidity trap?
 * 
 * Formula: Conviction = (Liquidity / MarketCap) × 100
 * 
 * The "Gold Standard": A ratio of 10% (0.1) is considered very strong for memecoins.
 * 
 * Color Logic:
 * - GREEN: Ratio ≥ 15% - "Deep" liquidity, safe for larger entries
 * - BLUE: Ratio 8-14% - Standard solid liquidity
 * - YELLOW: Ratio 3-7% - Slippage risk; be careful with large trades
 * - RED: Ratio < 3% - DANGER. High rug risk or "paper" thin liquidity
 */

export interface ConvictionResult {
    score: number;
    color: ColorTier;
    liquidityRatio: number; // The actual % ratio (Liq/MC * 100)
    volumeToMcRatio: number;
    repeatBuyers: number;
    smartWalletEntries: number;
    avgPositionSize: number;
    buyPressure: number;
    signals: string[];
}

function createDefaultResult(signal: string): ConvictionResult {
    return {
        score: 10,
        color: 'RED',
        liquidityRatio: 0,
        volumeToMcRatio: 0,
        repeatBuyers: 0,
        smartWalletEntries: 0,
        avgPositionSize: 0,
        buyPressure: 50,
        signals: [signal]
    };
}

/**
 * Calculate Conviction Score
 * 
 * Core Formula: Conviction = (Liquidity / MarketCap) × 100
 * Normalized to 0-100 scale based on ratio thresholds
 */
export async function calculateConviction(tokenId: string): Promise<ConvictionResult> {
    const signals: string[] = [];

    try {
        const token = await prisma.token.findUnique({
            where: { id: tokenId }
        });

        if (!token) {
            return createDefaultResult('Token not found');
        }

        const liquidity = Number(token.liquidity) || 0;
        const marketCap = Number(token.marketCap) || 1;
        const volume24h = Number(token.volume24h) || 0;

        // CORE FORMULA: Conviction = (Liquidity / MarketCap) × 100
        const liquidityRatio = (liquidity / marketCap) * 100;

        // Volume to MC ratio for additional context
        const volumeToMcRatio = (volume24h / marketCap) * 100;

        // Calculate score based on liquidity ratio thresholds
        let score: number;

        if (liquidityRatio >= 15) {
            // GREEN zone: 76-100
            score = Math.min(100, 76 + (liquidityRatio - 15) * 2);
            signals.push(`💎 DEEP LIQUIDITY: ${liquidityRatio.toFixed(1)}% of MC`);
            signals.push(`✅ Safe for larger entries`);
        } else if (liquidityRatio >= 8) {
            // BLUE zone: 56-75
            score = 56 + ((liquidityRatio - 8) / 7) * 19;
            signals.push(`🟢 Solid liquidity: ${liquidityRatio.toFixed(1)}% of MC`);
            signals.push(`Standard memecoin depth`);
        } else if (liquidityRatio >= 3) {
            // YELLOW zone: 31-55
            score = 31 + ((liquidityRatio - 3) / 5) * 24;
            signals.push(`🟡 Moderate liquidity: ${liquidityRatio.toFixed(1)}% of MC`);
            signals.push(`⚠️ Watch slippage on large trades`);
        } else {
            // RED zone: 0-30
            score = Math.max(0, (liquidityRatio / 3) * 30);
            signals.push(`🔴 THIN LIQUIDITY: ${liquidityRatio.toFixed(1)}% of MC`);
            signals.push(`⛔ High rug risk - paper thin depth`);
        }

        score = Math.max(0, Math.min(100, Math.round(score)));

        // Add volume context
        if (volumeToMcRatio >= 50) {
            signals.push(`🔥 EXTREME trading: Vol ${volumeToMcRatio.toFixed(0)}% of MC`);
        } else if (volumeToMcRatio >= 20) {
            signals.push(`📊 High interest: Vol ${volumeToMcRatio.toFixed(0)}% of MC`);
        } else if (volumeToMcRatio >= 10) {
            signals.push(`Active trading: Vol ${volumeToMcRatio.toFixed(0)}% of MC`);
        }

        // Wallet behavior analysis (from transaction data if available)
        let repeatBuyers = 0;
        let smartWalletEntries = 0;
        let avgPositionSize = 0;
        let buyPressure = 50;

        try {
            const transactions = await prisma.walletTransaction.findMany({
                where: {
                    tokenId,
                    timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
                },
                orderBy: { timestamp: 'desc' },
                take: 200
            });

            if (transactions.length > 0) {
                // Count repeat buyers
                const buyerCounts = new Map<string, number>();
                let totalBuys = 0;
                let totalSells = 0;
                let totalBuyVolume = 0;

                transactions.forEach(tx => {
                    if (tx.side === 'buy') {
                        totalBuys++;
                        totalBuyVolume += Number(tx.amountUsd);
                        buyerCounts.set(tx.walletAddress, (buyerCounts.get(tx.walletAddress) || 0) + 1);
                    } else {
                        totalSells++;
                    }
                });

                repeatBuyers = Array.from(buyerCounts.values()).filter(count => count >= 2).length;
                avgPositionSize = totalBuys > 0 ? totalBuyVolume / totalBuys : 0;
                buyPressure = transactions.length > 0 ? (totalBuys / transactions.length) * 100 : 50;

                // Detect smart wallet patterns (large consistent buyers)
                smartWalletEntries = Array.from(buyerCounts.entries())
                    .filter(([_, count]) => count >= 3)
                    .length;

                if (repeatBuyers > 5) {
                    signals.push(`💪 ${repeatBuyers} repeat buyers detected`);
                }
                if (buyPressure > 60) {
                    signals.push(`📈 Buy pressure: ${buyPressure.toFixed(0)}%`);
                } else if (buyPressure < 40) {
                    signals.push(`📉 Sell pressure: ${(100 - buyPressure).toFixed(0)}%`);
                }
            }
        } catch (dbErr) {
            // Transaction data not available, continue without
        }

        const color = getColorTier(score);

        return {
            score,
            color,
            liquidityRatio,
            volumeToMcRatio,
            repeatBuyers,
            smartWalletEntries,
            avgPositionSize,
            buyPressure,
            signals
        };

    } catch (err: any) {
        logger.error({ tokenId, err: err.message }, 'Conviction calculation failed');
        return createDefaultResult('Error calculating conviction');
    }
}
