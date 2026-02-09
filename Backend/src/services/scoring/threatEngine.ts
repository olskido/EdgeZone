import { prisma } from '../../models/prisma';
import { logger } from '../../utils/logger';
import { ColorTier, getColorTier } from './momentumEngine';

/**
 * THREAT ENGINE (Security & Risk)
 * Penalty-based system. Start at 100 (Safe) and subtract for each red flag.
 * 
 * Formula: ThreatScore = 100 - Σ(Penalties)
 * 
 * Red Flag Penalties:
 * - Mint Authority Active: -50 (Creator can dilute supply to zero)
 * - Freeze Authority Active: -40 (Creator can stop you from selling)
 * - Top 10 Holders > 50%: -30 (High concentration risk)
 * - Liquidity Unlocked: -50 (Developers can pull the rug)
 * 
 * Color Logic (Inverted - higher = safer):
 * - GREEN (76-100): No critical flags
 * - YELLOW (31-75): Minor flags (e.g., high holder concentration)
 * - RED (0-30): AVOID. Mint or Freeze authority is active
 */

export interface ThreatResult {
    score: number;          // The penalty score (lower = more threats)
    safetyScore: number;    // Same as score (100 - penalties)
    level: 'GREEN' | 'YELLOW' | 'RED' | 'CRITICAL';
    color: ColorTier;
    warnings: string[];
    flags: {
        mintable: boolean;
        freezable: boolean;
        highConcentration: boolean;
        liquidityUnlocked: boolean;
        ownershipNotRenounced: boolean;
    };
}

function createDefaultResult(): ThreatResult {
    return {
        score: 0,
        safetyScore: 100,
        level: 'GREEN',
        color: 'GREEN',
        warnings: ['✅ No significant threats detected'],
        flags: {
            mintable: false,
            freezable: false,
            highConcentration: false,
            liquidityUnlocked: false,
            ownershipNotRenounced: false
        }
    };
}

/**
 * Calculate Threat Score
 * 
 * Formula: SafetyScore = 100 - Σ(Penalties)
 * Each red flag subtracts from the safety score
 */
export async function calculateThreat(tokenId: string): Promise<ThreatResult> {
    const warnings: string[] = [];
    let totalPenalty = 0;

    const flags = {
        mintable: false,
        freezable: false,
        highConcentration: false,
        liquidityUnlocked: false,
        ownershipNotRenounced: false
    };

    try {
        const token = await prisma.token.findUnique({
            where: { id: tokenId }
        });

        if (!token) {
            return {
                ...createDefaultResult(),
                warnings: ['Token not found'],
                safetyScore: 50,
                score: 50,
                level: 'YELLOW',
                color: 'YELLOW'
            };
        }

        // Check security flags from token data
        // These would typically come from Birdeye Security API or Helius

        // 1. MINT AUTHORITY CHECK (-50 penalty)
        // If the mint authority is still active, creator can dilute supply
        if ((token as any).mintAuthority || (token as any).isMintable) {
            totalPenalty += 50;
            flags.mintable = true;
            warnings.push('⛔ MINT AUTHORITY ACTIVE: Supply can be diluted');
        }

        // 2. FREEZE AUTHORITY CHECK (-40 penalty)
        // If freeze authority exists, creator can stop your transfers
        if ((token as any).freezeAuthority || (token as any).isFreezable) {
            totalPenalty += 40;
            flags.freezable = true;
            warnings.push('🔒 FREEZE AUTHORITY: Creator can freeze your tokens');
        }

        // 3. TOP 10 HOLDER CONCENTRATION (-30 penalty)
        // If top 10 hold >50%, one whale dump can crash the price
        const holderConcentration = (token as any).top10HolderPercent || 0;
        if (holderConcentration > 50) {
            totalPenalty += 30;
            flags.highConcentration = true;
            warnings.push(`🐋 HIGH CONCENTRATION: Top 10 hold ${holderConcentration.toFixed(0)}%`);
        } else if (holderConcentration > 30) {
            totalPenalty += 15;
            warnings.push(`⚠️ Moderate concentration: Top 10 hold ${holderConcentration.toFixed(0)}%`);
        }

        // 4. LIQUIDITY UNLOCKED (-50 penalty)
        // If liquidity is not locked, devs can pull the rug
        const liquidityLocked = (token as any).liquidityLocked || false;
        if (!liquidityLocked && (token as any).hasLiquidityData !== false) {
            // Only penalize if we know liquidity exists but isn't locked
            const liquidity = Number(token.liquidity) || 0;
            if (liquidity > 10000) {
                // Significant liquidity that could be pulled
                // Partial penalty since we can't always verify lock status
                totalPenalty += 25;
                flags.liquidityUnlocked = true;
                warnings.push('⚠️ Liquidity lock status unknown');
            }
        }

        // 5. OWNERSHIP NOT RENOUNCED (-20 penalty)
        if ((token as any).ownerAddress && (token as any).ownerAddress !== 'renounced') {
            totalPenalty += 20;
            flags.ownershipNotRenounced = true;
            warnings.push('📋 Contract ownership not renounced');
        }

        // Calculate final safety score
        const safetyScore = Math.max(0, Math.min(100, 100 - totalPenalty));

        // Determine threat level
        let level: 'GREEN' | 'YELLOW' | 'RED' | 'CRITICAL';
        if (safetyScore >= 76) {
            level = 'GREEN';
        } else if (safetyScore >= 31) {
            level = 'YELLOW';
        } else if (safetyScore > 0) {
            level = 'RED';
        } else {
            level = 'CRITICAL';
        }

        // Add positive signal if no threats
        if (warnings.length === 0) {
            warnings.push('✅ No significant threats detected');
        }

        // Set color based on safety score (higher = greener)
        const color = getColorTier(safetyScore);

        return {
            score: totalPenalty, // Total penalty points
            safetyScore,        // 100 - penalties
            level,
            color,
            warnings,
            flags
        };

    } catch (err: any) {
        logger.error({ tokenId, err: err.message }, 'Threat calculation failed');
        return {
            ...createDefaultResult(),
            warnings: ['Error checking security'],
            safetyScore: 50,
            score: 50,
            level: 'YELLOW',
            color: 'YELLOW'
        };
    }
}
