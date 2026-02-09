import { logger } from '../../utils/logger';
import { ThreatResult } from './threatEngine';
import { DevProfile } from './devProfileEngine';
import { MarketIntegrity } from './marketIntegrityEngine';
import { DegenIntelligence } from './degenIntelEngine';

/**
 * EDGE SCORE ENGINE
 * 
 * The composite master metric combining all advanced intelligence.
 * 
 * Formula:
 * EdgeScore = (Safety × 0.30) + (Narrative × 0.20) + (SmartFlow × 0.30) + (MarketIntegrity × 0.20)
 * 
 * Components:
 * - Safety: 100 - penalties for dev history and bundle concentration
 * - Narrative: Current sector mindshare (0-100)
 * - SmartFlow: Real-time buy pressure from labeled "Smart Money" wallets
 * - MarketIntegrity: 100 - percentage of detected wash trading
 */

export interface EdgeScore {
    score: number;           // 0-100
    level: 'ALPHA' | 'EDGE' | 'NEUTRAL' | 'RISKY' | 'AVOID';
    color: 'GREEN' | 'BLUE' | 'YELLOW' | 'ORANGE' | 'RED';

    breakdown: {
        safety: {
            score: number;
            weight: number;
            contribution: number;
        };
        narrative: {
            score: number;
            weight: number;
            contribution: number;
        };
        smartFlow: {
            score: number;
            weight: number;
            contribution: number;
        };
        marketIntegrity: {
            score: number;
            weight: number;
            contribution: number;
        };
    };

    // Combined signals from all engines
    topSignals: string[];
    riskFactors: string[];
    bullishFactors: string[];

    // Action recommendation
    recommendation: {
        action: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'CAUTION' | 'AVOID';
        reason: string;
        confidence: number;
    };
}

export function calculateEdgeScore(
    threat: ThreatResult,
    devProfile: DevProfile,
    marketIntegrity: MarketIntegrity,
    degenIntel: DegenIntelligence
): EdgeScore {
    // WEIGHTS
    const SAFETY_WEIGHT = 0.30;
    const NARRATIVE_WEIGHT = 0.20;
    const SMART_FLOW_WEIGHT = 0.30;
    const INTEGRITY_WEIGHT = 0.20;

    // COMPONENT SCORES

    // Safety Score: Combine threat engine + dev profile
    // 100 - penalties from dev history and bundle concentration
    const devPenalty = (100 - devProfile.reputation.score) * 0.5;
    const bundlePenalty = devProfile.bundleRisk.score * 0.3;
    const threatPenalty = 100 - threat.safetyScore;
    const safetyScore = Math.max(0, 100 - devPenalty - bundlePenalty - threatPenalty * 0.2);

    // Narrative Score: Current sector mindshare
    const narrativeScore = degenIntel.narrative.mindshare;

    // Smart Flow Score: Real-time smart money activity
    const smartFlowScore = degenIntel.smartFlow.score;

    // Market Integrity Score: 100 - wash trading percentage
    const integrityScore = marketIntegrity.overallScore;

    // CALCULATE EDGE SCORE
    const safetyContrib = safetyScore * SAFETY_WEIGHT;
    const narrativeContrib = narrativeScore * NARRATIVE_WEIGHT;
    const smartFlowContrib = smartFlowScore * SMART_FLOW_WEIGHT;
    const integrityContrib = integrityScore * INTEGRITY_WEIGHT;

    const edgeScore = Math.round(safetyContrib + narrativeContrib + smartFlowContrib + integrityContrib);

    // DETERMINE LEVEL AND COLOR
    let level: EdgeScore['level'];
    let color: EdgeScore['color'];

    if (edgeScore >= 80) {
        level = 'ALPHA';
        color = 'GREEN';
    } else if (edgeScore >= 65) {
        level = 'EDGE';
        color = 'BLUE';
    } else if (edgeScore >= 45) {
        level = 'NEUTRAL';
        color = 'YELLOW';
    } else if (edgeScore >= 25) {
        level = 'RISKY';
        color = 'ORANGE';
    } else {
        level = 'AVOID';
        color = 'RED';
    }

    // COLLECT SIGNALS
    const topSignals: string[] = [];
    const riskFactors: string[] = [];
    const bullishFactors: string[] = [];

    // Safety signals
    if (devProfile.reputation.label === 'ALPHA_DEV') {
        bullishFactors.push('🟢 Alpha dev with successful history');
    } else if (devProfile.reputation.label === 'SERIAL_RUGGER') {
        riskFactors.push('🔴 Serial rugger detected');
    }

    if (devProfile.drainAlert.triggered) {
        riskFactors.push('⛔ Dev exit alert triggered');
    }

    if (devProfile.bundleRisk.score > 50) {
        riskFactors.push(`🔴 High bundle concentration: ${devProfile.bundleRisk.score}%`);
    }

    // Narrative signals
    if (degenIntel.narrative.trending) {
        bullishFactors.push(`🔥 ${degenIntel.narrative.currentSector} sector is trending`);
    }

    if (degenIntel.narrative.mindshare > 70) {
        bullishFactors.push(`📈 High mindshare: ${degenIntel.narrative.mindshare}%`);
    }

    // Smart flow signals
    if (degenIntel.smartFlow.alert) {
        topSignals.push(degenIntel.smartFlow.alert);
    }

    if (degenIntel.smartFlow.score > 70) {
        bullishFactors.push('💎 Strong smart money inflow');
    } else if (degenIntel.smartFlow.score < 30) {
        riskFactors.push('⚠️ Weak smart wallet interest');
    }

    // Market integrity signals
    if (marketIntegrity.washTrading.detected) {
        riskFactors.push(`🔴 Wash trading: ${marketIntegrity.washTrading.washVolumePercent.toFixed(0)}% fake volume`);
    }

    if (marketIntegrity.collusiveNetwork.detected) {
        riskFactors.push(`🔴 Collusive network: ${marketIntegrity.collusiveNetwork.walletsInClusters} wallets`);
    }

    if (marketIntegrity.volumeAudit.botProbability > 50) {
        riskFactors.push(`🤖 Bot activity: ${marketIntegrity.volumeAudit.botProbability}% probability`);
    }

    if (marketIntegrity.overallScore > 80) {
        bullishFactors.push('✅ Clean market structure');
    }

    // Sentiment signals
    if (degenIntel.sentiment.overall === 'BULLISH' && degenIntel.sentiment.score > 70) {
        bullishFactors.push(`📊 Bullish sentiment: ${degenIntel.sentiment.score}%`);
    } else if (degenIntel.sentiment.overall === 'BEARISH' && degenIntel.sentiment.score < 30) {
        riskFactors.push(`📉 Bearish sentiment: ${degenIntel.sentiment.score}%`);
    }

    // Add key insight to top signals
    if (degenIntel.sentiment.keyInsight) {
        topSignals.push(degenIntel.sentiment.keyInsight);
    }

    // GENERATE RECOMMENDATION
    const recommendation = generateRecommendation(
        edgeScore,
        riskFactors.length,
        bullishFactors.length,
        threat,
        devProfile,
        degenIntel
    );

    return {
        score: edgeScore,
        level,
        color,
        breakdown: {
            safety: {
                score: Math.round(safetyScore),
                weight: SAFETY_WEIGHT * 100,
                contribution: Math.round(safetyContrib)
            },
            narrative: {
                score: Math.round(narrativeScore),
                weight: NARRATIVE_WEIGHT * 100,
                contribution: Math.round(narrativeContrib)
            },
            smartFlow: {
                score: Math.round(smartFlowScore),
                weight: SMART_FLOW_WEIGHT * 100,
                contribution: Math.round(smartFlowContrib)
            },
            marketIntegrity: {
                score: Math.round(integrityScore),
                weight: INTEGRITY_WEIGHT * 100,
                contribution: Math.round(integrityContrib)
            }
        },
        topSignals: topSignals.slice(0, 3),
        riskFactors: riskFactors.slice(0, 5),
        bullishFactors: bullishFactors.slice(0, 5),
        recommendation
    };
}

function generateRecommendation(
    edgeScore: number,
    riskCount: number,
    bullishCount: number,
    threat: ThreatResult,
    devProfile: DevProfile,
    degenIntel: DegenIntelligence
): EdgeScore['recommendation'] {
    // Critical blockers
    if (devProfile.reputation.label === 'SERIAL_RUGGER') {
        return {
            action: 'AVOID',
            reason: 'Serial rugger - high probability of exit scam',
            confidence: 95
        };
    }

    if (devProfile.drainAlert.triggered) {
        return {
            action: 'AVOID',
            reason: 'Developer has exited - likely rug in progress',
            confidence: 90
        };
    }

    if (threat.safetyScore < 30) {
        return {
            action: 'AVOID',
            reason: 'Critical security flags detected',
            confidence: 85
        };
    }

    // Score-based recommendations
    if (edgeScore >= 80 && riskCount === 0) {
        return {
            action: 'STRONG_BUY',
            reason: 'Alpha opportunity with strong fundamentals',
            confidence: Math.min(95, 70 + bullishCount * 5)
        };
    }

    if (edgeScore >= 65) {
        return {
            action: 'BUY',
            reason: 'Good edge with favorable conditions',
            confidence: Math.min(85, 60 + bullishCount * 4)
        };
    }

    if (edgeScore >= 45) {
        return {
            action: 'HOLD',
            reason: 'Mixed signals - wait for confirmation',
            confidence: 50
        };
    }

    if (edgeScore >= 25) {
        return {
            action: 'CAUTION',
            reason: 'Multiple risk factors present',
            confidence: 60
        };
    }

    return {
        action: 'AVOID',
        reason: 'High risk with insufficient reward potential',
        confidence: 75
    };
}
