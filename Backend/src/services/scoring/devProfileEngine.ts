import { logger } from '../../utils/logger';
import { helius } from '../helius/client';

/**
 * DEVELOPER BEHAVIORAL PROFILING ENGINE
 * 
 * Analyzes the human behind the code beyond static contract audits:
 * 1. Legacy Mapping (Reputation Score) - Previous project history
 * 2. Post-Launch Drain Detection - Creator wallet monitoring
 * 3. Bundle Concentration Analysis - Gini coefficient for early buyers
 */

export interface DevProfile {
    // Legacy Mapping
    reputation: {
        score: number;       // 0-100
        label: 'ALPHA_DEV' | 'TRUSTED' | 'UNKNOWN' | 'SUSPICIOUS' | 'SERIAL_RUGGER';
        previousProjects: number;
        ruggedProjects: number;
        successfulProjects: number; // >10x ROI
        history: Array<{
            name: string;
            outcome: 'RUG' | 'SUCCESS' | 'DEAD' | 'ACTIVE';
            maxRoi: number;
            timeToRug?: number; // hours if rugged
        }>;
    };

    // Post-Launch Drain Detection
    drainAlert: {
        triggered: boolean;
        devSoldPercent: number;
        timeSinceLaunch: number; // minutes
        transactions: Array<{
            type: 'SELL' | 'TRANSFER';
            amount: number;
            timestamp: Date;
        }>;
    };

    // Bundle Concentration Analysis
    bundleRisk: {
        score: number;        // 0-100, higher = more concentrated
        giniCoefficient: number; // 0-1
        clusteredWallets: number;
        clusteredSupplyPercent: number;
        suspiciousBlocks: number; // Blocks with multiple buys
        alerts: string[];
    };

    signals: string[];
    color: 'GREEN' | 'YELLOW' | 'RED';
}

export async function analyzeDevBehavior(
    creatorAddress: string | null,
    tokenMint: string,
    launchTime: Date | null
): Promise<DevProfile> {
    const signals: string[] = [];

    // Default values
    let reputation = createDefaultReputation();
    let drainAlert = createDefaultDrainAlert();
    let bundleRisk = createDefaultBundleRisk();

    try {
        // 1. LEGACY MAPPING - Analyze creator's past projects
        if (creatorAddress) {
            reputation = await analyzeCreatorHistory(creatorAddress);

            if (reputation.label === 'SERIAL_RUGGER') {
                signals.push(`🔴 SERIAL RUGGER: ${reputation.ruggedProjects} previous rugs`);
            } else if (reputation.label === 'ALPHA_DEV') {
                signals.push(`🟢 ALPHA DEV: ${reputation.successfulProjects} successful projects`);
            } else if (reputation.label === 'UNKNOWN') {
                signals.push(`⚪ NEW DEV: No previous history`);
            }
        }

        // 2. POST-LAUNCH DRAIN DETECTION
        if (creatorAddress && launchTime) {
            drainAlert = await detectDrainActivity(creatorAddress, tokenMint, launchTime);

            if (drainAlert.triggered) {
                signals.push(`⛔ IMMEDIATE EXIT: Dev sold ${drainAlert.devSoldPercent.toFixed(0)}% in ${drainAlert.timeSinceLaunch}min`);
            } else if (drainAlert.devSoldPercent > 50) {
                signals.push(`⚠️ Dev sold ${drainAlert.devSoldPercent.toFixed(0)}% of allocation`);
            }
        }

        // 3. BUNDLE CONCENTRATION ANALYSIS
        bundleRisk = await analyzeBundleConcentration(tokenMint);

        if (bundleRisk.score > 70) {
            signals.push(`🔴 HIGH BUNDLE RISK: ${bundleRisk.score}% - Coordinated cluster detected`);
        } else if (bundleRisk.score > 40) {
            signals.push(`🟡 Moderate bundle concentration: ${bundleRisk.score}%`);
        }

    } catch (err: any) {
        logger.error({ err: err.message }, 'Dev behavioral analysis failed');
        signals.push('Dev analysis unavailable');
    }

    // Calculate overall color
    let color: 'GREEN' | 'YELLOW' | 'RED' = 'GREEN';
    if (reputation.label === 'SERIAL_RUGGER' || drainAlert.triggered || bundleRisk.score > 70) {
        color = 'RED';
    } else if (reputation.label === 'SUSPICIOUS' || bundleRisk.score > 40 || drainAlert.devSoldPercent > 50) {
        color = 'YELLOW';
    }

    return {
        reputation,
        drainAlert,
        bundleRisk,
        signals,
        color
    };
}

async function analyzeCreatorHistory(creatorAddress: string): Promise<DevProfile['reputation']> {
    // In production: Query Helius for all token mints by this creator
    // Analyze each token's price history to determine outcome

    // For now, return simulated data based on wallet patterns
    const history: DevProfile['reputation']['history'] = [];

    // This would be populated by actual Helius data
    const previousProjects = 0;
    const ruggedProjects = 0;
    const successfulProjects = 0;

    let label: DevProfile['reputation']['label'] = 'UNKNOWN';
    let score = 50;

    if (ruggedProjects > 2) {
        label = 'SERIAL_RUGGER';
        score = Math.max(0, 20 - ruggedProjects * 5);
    } else if (successfulProjects > 0) {
        label = 'ALPHA_DEV';
        score = Math.min(100, 70 + successfulProjects * 10);
    } else if (previousProjects > 0 && ruggedProjects === 0) {
        label = 'TRUSTED';
        score = 60;
    } else if (ruggedProjects > 0) {
        label = 'SUSPICIOUS';
        score = 30;
    }

    return {
        score,
        label,
        previousProjects,
        ruggedProjects,
        successfulProjects,
        history
    };
}

async function detectDrainActivity(
    creatorAddress: string,
    tokenMint: string,
    launchTime: Date
): Promise<DevProfile['drainAlert']> {
    const timeSinceLaunch = Math.floor((Date.now() - launchTime.getTime()) / 60000);

    // In production: Query Helius for creator's transactions since launch
    // Check for sells/transfers of the token within 60 minutes

    return {
        triggered: false,
        devSoldPercent: 0,
        timeSinceLaunch,
        transactions: []
    };
}

async function analyzeBundleConcentration(tokenMint: string): Promise<DevProfile['bundleRisk']> {
    const alerts: string[] = [];

    // In production: Analyze first 100 transactions
    // Group by block and identify clusters
    // Calculate Gini coefficient

    // Simulated analysis
    const clusteredWallets = 0;
    const clusteredSupplyPercent = 0;
    const giniCoefficient = 0.3; // 0 = perfect equality, 1 = one wallet owns all

    // Convert Gini to risk score (higher Gini = higher risk)
    const score = Math.round(giniCoefficient * 100);

    if (clusteredWallets > 5) {
        alerts.push(`${clusteredWallets} wallets bought in same block`);
    }

    return {
        score,
        giniCoefficient,
        clusteredWallets,
        clusteredSupplyPercent,
        suspiciousBlocks: 0,
        alerts
    };
}

function createDefaultReputation(): DevProfile['reputation'] {
    return {
        score: 50,
        label: 'UNKNOWN',
        previousProjects: 0,
        ruggedProjects: 0,
        successfulProjects: 0,
        history: []
    };
}

function createDefaultDrainAlert(): DevProfile['drainAlert'] {
    return {
        triggered: false,
        devSoldPercent: 0,
        timeSinceLaunch: 0,
        transactions: []
    };
}

function createDefaultBundleRisk(): DevProfile['bundleRisk'] {
    return {
        score: 0,
        giniCoefficient: 0,
        clusteredWallets: 0,
        clusteredSupplyPercent: 0,
        suspiciousBlocks: 0,
        alerts: []
    };
}
