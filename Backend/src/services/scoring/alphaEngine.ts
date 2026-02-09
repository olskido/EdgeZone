import { MomentumResult, ColorTier, getColorTier } from './momentumEngine';
import { ConvictionResult } from './convictionEngine';
import { ThreatResult } from './threatEngine';

/**
 * ALPHA ENGINE (Composite Master Score)
 * The single value that combines all engines into one final recommendation.
 * 
 * Weighted Formula:
 * AlphaScore = (Momentum × 0.40) + (Conviction × 0.35) + (Safety × 0.25)
 * 
 * Alpha Levels:
 * - DEGEN (Green): Score > 80 - High momentum + High conviction
 * - HIGH (Blue): Score 60-79 - Solid growth with safe metrics
 * - MODERATE (Yellow): Score 40-59 - Mixed signals; wait for confirmation
 * - LOW (Orange): Score 20-39 - Poor volume or suspicious security
 * - AVOID (Red): Score < 20 - Direct rug risk
 */

export type AlphaLevel = 'DEGEN' | 'HIGH' | 'MODERATE' | 'LOW' | 'AVOID';

export interface AlphaResult {
    score: AlphaLevel;
    numericScore: number;
    color: ColorTier;
    breakdown: {
        momentum: number;      // Weighted contribution (40%)
        conviction: number;    // Weighted contribution (35%)
        safety: number;        // Weighted contribution (25%)
    };
    rawScores: {
        momentum: number;      // Raw 0-100 score
        conviction: number;    // Raw 0-100 score
        safety: number;        // Raw 0-100 score
    };
    signals: string[];
}

/**
 * Calculate Alpha Score
 * 
 * Formula: AlphaScore = (Momentum × 0.40) + (Conviction × 0.35) + (Safety × 0.25)
 */
export function calculateAlpha(
    momentum: MomentumResult,
    conviction: ConvictionResult,
    threat: ThreatResult
): AlphaResult {
    const signals: string[] = [];

    // Get raw scores (all on 0-100 scale)
    const momentumScore = momentum.score;
    const convictionScore = conviction.score;
    const safetyScore = threat.safetyScore; // Already 100 - penalties

    // CORE FORMULA: AlphaScore = (Momentum × 0.40) + (Conviction × 0.35) + (Safety × 0.25)
    const momentumContrib = momentumScore * 0.40;
    const convictionContrib = convictionScore * 0.35;
    const safetyContrib = safetyScore * 0.25;

    const numericScore = Math.round(momentumContrib + convictionContrib + safetyContrib);

    // Generate momentum signals
    if (momentumScore >= 76) {
        signals.push(`🚀 STRONG MOMENTUM: ${momentum.rawMomentum?.toFixed(1) || momentumScore}%`);
    } else if (momentumScore >= 56) {
        signals.push(`📈 Healthy momentum: ${momentumScore}/100`);
    } else if (momentumScore < 31) {
        signals.push(`📉 Weak momentum: ${momentumScore}/100`);
    }

    // Generate conviction signals
    if (convictionScore >= 76) {
        signals.push(`💎 DEEP LIQUIDITY: ${conviction.liquidityRatio?.toFixed(1)}% of MC`);
    } else if (convictionScore >= 56) {
        signals.push(`🟢 Solid liquidity: ${conviction.liquidityRatio?.toFixed(1)}% of MC`);
    } else if (convictionScore < 31) {
        signals.push(`⚠️ THIN LIQUIDITY: ${conviction.liquidityRatio?.toFixed(1)}% - Rug risk`);
    }

    // Generate safety signals
    if (safetyScore >= 76) {
        signals.push(`✅ Safe: No critical red flags`);
    } else if (safetyScore >= 31) {
        signals.push(`🟡 Caution: Minor security concerns`);
    } else {
        signals.push(`🔴 DANGER: Critical security flags detected`);
    }

    // Determine Alpha Level based on score thresholds
    let score: AlphaLevel;

    if (numericScore > 80) {
        score = 'DEGEN';
        signals.unshift('🔥 DEGEN PLAY: High momentum + High conviction');
    } else if (numericScore >= 60) {
        score = 'HIGH';
        signals.unshift('🟢 HIGH ALPHA: Solid growth with safe metrics');
    } else if (numericScore >= 40) {
        score = 'MODERATE';
        signals.unshift('🟡 MODERATE: Mixed signals, wait for confirmation');
    } else if (numericScore >= 20) {
        score = 'LOW';
        signals.unshift('🟠 LOW ALPHA: Poor volume or suspicious security');
    } else {
        score = 'AVOID';
        signals.unshift('🚫 AVOID: Direct rug risk detected');
    }

    // Get color tier
    const color = getColorTier(numericScore);

    return {
        score,
        numericScore,
        color,
        breakdown: {
            momentum: Math.round(momentumContrib),
            conviction: Math.round(convictionContrib),
            safety: Math.round(safetyContrib)
        },
        rawScores: {
            momentum: momentumScore,
            conviction: convictionScore,
            safety: safetyScore
        },
        signals
    };
}
