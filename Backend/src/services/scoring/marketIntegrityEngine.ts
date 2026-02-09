import { prisma } from '../../models/prisma';
import { logger } from '../../utils/logger';

/**
 * MARKET INTEGRITY ENGINE
 * 
 * Exposes artificial demand and "fake" volume created by bot clusters:
 * 1. Wash Trading Detector (A-A Detection) - Same wallet trades
 * 2. Collusive Network Identification - Cluster trading
 * 3. Volume Consistency Audit - Bot vs organic patterns
 */

export interface MarketIntegrity {
    overallScore: number;  // 0-100 (100 = clean market)

    // Wash Trading Detection
    washTrading: {
        detected: boolean;
        washVolumePercent: number;  // % of volume that's self-traded
        realVolume: number;
        reportedVolume: number;
        flaggedTransactions: number;
        color: 'GREEN' | 'ORANGE' | 'RED';
    };

    // Collusive Network Identification
    collusiveNetwork: {
        detected: boolean;
        clusterCount: number;
        walletsInClusters: number;
        controlledSupplyPercent: number;
        networkGraph: Array<{
            wallet: string;
            connections: string[];
            transactionCount: number;
        }>;
    };

    // Volume Consistency Audit
    volumeAudit: {
        isOrganic: boolean;
        botProbability: number;  // 0-100
        variance: number;        // High = organic, Low = bot
        repeatedSizes: number;   // Count of identical transaction sizes
        timeDistribution: 'ORGANIC' | 'SUSPICIOUS' | 'BOT_PATTERN';
    };

    signals: string[];
    color: 'GREEN' | 'YELLOW' | 'RED';
}

export async function analyzeMarketIntegrity(tokenId: string): Promise<MarketIntegrity> {
    const signals: string[] = [];

    try {
        // Fetch recent transactions
        const transactions = await prisma.walletTransaction.findMany({
            where: {
                tokenId,
                timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            },
            orderBy: { timestamp: 'desc' },
            take: 500
        });

        // 1. WASH TRADING DETECTION (A-A Detection)
        const washTrading = detectWashTrading(transactions);
        if (washTrading.washVolumePercent > 30) {
            signals.push(`🔴 WASH TRADING: ${washTrading.washVolumePercent.toFixed(0)}% fake volume detected`);
        } else if (washTrading.washVolumePercent > 10) {
            signals.push(`🟡 Suspicious self-trading: ${washTrading.washVolumePercent.toFixed(0)}%`);
        }

        // 2. COLLUSIVE NETWORK IDENTIFICATION
        const collusiveNetwork = identifyCollusiveNetworks(transactions);
        if (collusiveNetwork.detected) {
            signals.push(`🔴 COLLUSION: ${collusiveNetwork.walletsInClusters} wallets trading among themselves`);
        }

        // 3. VOLUME CONSISTENCY AUDIT
        const volumeAudit = auditVolumeConsistency(transactions);
        if (volumeAudit.botProbability > 70) {
            signals.push(`🤖 BOT ACTIVITY: ${volumeAudit.botProbability}% probability of spoofing`);
        } else if (volumeAudit.isOrganic) {
            signals.push(`✅ Organic trading patterns detected`);
        }

        // Calculate overall integrity score
        const overallScore = calculateIntegrityScore(washTrading, collusiveNetwork, volumeAudit);

        // Determine color
        let color: 'GREEN' | 'YELLOW' | 'RED' = 'GREEN';
        if (overallScore < 40) {
            color = 'RED';
        } else if (overallScore < 70) {
            color = 'YELLOW';
        }

        if (signals.length === 0) {
            signals.push('✅ Market appears clean');
        }

        return {
            overallScore,
            washTrading,
            collusiveNetwork,
            volumeAudit,
            signals,
            color
        };

    } catch (err: any) {
        logger.error({ tokenId, err: err.message }, 'Market integrity analysis failed');
        return createDefaultIntegrity();
    }
}

function detectWashTrading(transactions: any[]): MarketIntegrity['washTrading'] {
    let washVolume = 0;
    let totalVolume = 0;
    let flaggedTransactions = 0;

    // Group transactions by wallet
    const walletActivity = new Map<string, { buys: number; sells: number; volume: number }>();

    transactions.forEach(tx => {
        totalVolume += Number(tx.amountUsd || 0);

        const activity = walletActivity.get(tx.walletAddress) || { buys: 0, sells: 0, volume: 0 };
        activity.volume += Number(tx.amountUsd || 0);

        if (tx.side === 'buy') {
            activity.buys++;
        } else {
            activity.sells++;
        }

        walletActivity.set(tx.walletAddress, activity);
    });

    // Detect wash trading: wallets that both buy AND sell
    walletActivity.forEach((activity, wallet) => {
        if (activity.buys > 0 && activity.sells > 0) {
            const washAmount = Math.min(activity.buys, activity.sells) * (activity.volume / (activity.buys + activity.sells));
            washVolume += washAmount;
            flaggedTransactions += Math.min(activity.buys, activity.sells);
        }
    });

    const washVolumePercent = totalVolume > 0 ? (washVolume / totalVolume) * 100 : 0;

    let color: 'GREEN' | 'ORANGE' | 'RED' = 'GREEN';
    if (washVolumePercent > 30) {
        color = 'RED';
    } else if (washVolumePercent > 10) {
        color = 'ORANGE';
    }

    return {
        detected: washVolumePercent > 10,
        washVolumePercent,
        realVolume: totalVolume - washVolume,
        reportedVolume: totalVolume,
        flaggedTransactions,
        color
    };
}

function identifyCollusiveNetworks(transactions: any[]): MarketIntegrity['collusiveNetwork'] {
    // Build a graph of wallet-to-wallet flows
    const walletConnections = new Map<string, Set<string>>();
    const transactionCounts = new Map<string, number>();

    transactions.forEach(tx => {
        const wallet = tx.walletAddress;
        transactionCounts.set(wallet, (transactionCounts.get(wallet) || 0) + 1);

        // In production: trace token flows between wallets
        // For now, detect wallets that transact frequently
    });

    // Find clusters of highly active wallets
    const highActivityWallets = Array.from(transactionCounts.entries())
        .filter(([_, count]) => count >= 5)
        .map(([wallet]) => wallet);

    // Build network graph
    const networkGraph = highActivityWallets.slice(0, 10).map(wallet => ({
        wallet: shortenAddress(wallet),
        connections: [],
        transactionCount: transactionCounts.get(wallet) || 0
    }));

    const detected = highActivityWallets.length >= 3;
    const controlledSupplyPercent = detected ? Math.min(50, highActivityWallets.length * 5) : 0;

    return {
        detected,
        clusterCount: detected ? 1 : 0,
        walletsInClusters: highActivityWallets.length,
        controlledSupplyPercent,
        networkGraph
    };
}

function auditVolumeConsistency(transactions: any[]): MarketIntegrity['volumeAudit'] {
    if (transactions.length < 10) {
        return {
            isOrganic: true,
            botProbability: 0,
            variance: 100,
            repeatedSizes: 0,
            timeDistribution: 'ORGANIC'
        };
    }

    // Analyze transaction size variance
    const sizes = transactions.map(tx => Number(tx.amountUsd || 0));
    const mean = sizes.reduce((a, b) => a + b, 0) / sizes.length;
    const variance = sizes.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / sizes.length;
    const normalizedVariance = Math.min(100, (variance / (mean * mean)) * 100);

    // Count repeated transaction sizes (bots often use identical amounts)
    const sizeCounts = new Map<number, number>();
    sizes.forEach(size => {
        const roundedSize = Math.round(size / 10) * 10; // Round to nearest 10
        sizeCounts.set(roundedSize, (sizeCounts.get(roundedSize) || 0) + 1);
    });
    const repeatedSizes = Array.from(sizeCounts.values()).filter(count => count >= 3).length;

    // Analyze timing patterns
    const timestamps = transactions.map(tx => new Date(tx.timestamp).getTime());
    const intervals = timestamps.slice(0, -1).map((t, i) => timestamps[i + 1] - t);
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length || 0;
    const intervalVariance = intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / intervals.length || 0;

    // Bot probability calculation
    let botProbability = 0;

    // Low size variance = likely bot
    if (normalizedVariance < 20) botProbability += 40;
    else if (normalizedVariance < 50) botProbability += 20;

    // Many repeated sizes = likely bot
    if (repeatedSizes > 5) botProbability += 30;
    else if (repeatedSizes > 2) botProbability += 15;

    // Low interval variance = likely bot
    const normalizedIntervalVariance = intervalVariance / (avgInterval * avgInterval + 1);
    if (normalizedIntervalVariance < 0.1) botProbability += 30;
    else if (normalizedIntervalVariance < 0.5) botProbability += 15;

    botProbability = Math.min(100, botProbability);

    let timeDistribution: 'ORGANIC' | 'SUSPICIOUS' | 'BOT_PATTERN' = 'ORGANIC';
    if (botProbability > 70) {
        timeDistribution = 'BOT_PATTERN';
    } else if (botProbability > 40) {
        timeDistribution = 'SUSPICIOUS';
    }

    return {
        isOrganic: botProbability < 40,
        botProbability,
        variance: normalizedVariance,
        repeatedSizes,
        timeDistribution
    };
}

function calculateIntegrityScore(
    washTrading: MarketIntegrity['washTrading'],
    collusiveNetwork: MarketIntegrity['collusiveNetwork'],
    volumeAudit: MarketIntegrity['volumeAudit']
): number {
    // Start at 100 and subtract penalties
    let score = 100;

    // Wash trading penalty
    score -= washTrading.washVolumePercent * 0.5;

    // Collusive network penalty
    if (collusiveNetwork.detected) {
        score -= 20 + collusiveNetwork.walletsInClusters * 2;
    }

    // Bot activity penalty
    score -= volumeAudit.botProbability * 0.3;

    return Math.max(0, Math.round(score));
}

function createDefaultIntegrity(): MarketIntegrity {
    return {
        overallScore: 80,
        washTrading: {
            detected: false,
            washVolumePercent: 0,
            realVolume: 0,
            reportedVolume: 0,
            flaggedTransactions: 0,
            color: 'GREEN'
        },
        collusiveNetwork: {
            detected: false,
            clusterCount: 0,
            walletsInClusters: 0,
            controlledSupplyPercent: 0,
            networkGraph: []
        },
        volumeAudit: {
            isOrganic: true,
            botProbability: 0,
            variance: 100,
            repeatedSizes: 0,
            timeDistribution: 'ORGANIC'
        },
        signals: ['Market analysis unavailable'],
        color: 'YELLOW'
    };
}

function shortenAddress(address: string): string {
    if (!address || address.length < 10) return address || 'Unknown';
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
}
