import { prisma } from '../../models/prisma';
import { logger } from '../../utils/logger';

export interface WalletClusterResult {
    clusterDetected: boolean;
    clusterScore: number;
    wallets: Array<{
        address: string;
        entryPrice: number;
        entryTime: Date;
        smartScore: number;
    }>;
    entryTiming: string;
}

/**
 * Wallet Cluster Engine
 * Detects coordinated smart wallet entries before breakouts
 */
export async function detectWalletClusters(tokenId: string): Promise<WalletClusterResult> {
    try {
        // Get recent transactions (last 2 hours for cluster detection)
        const recentTxs = await prisma.walletTransaction.findMany({
            where: {
                tokenId,
                side: 'buy',
                timestamp: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) }
            },
            orderBy: { timestamp: 'asc' }
        });

        if (recentTxs.length < 3) {
            return { clusterDetected: false, clusterScore: 0, wallets: [], entryTiming: 'N/A' };
        }

        // Get smart wallets from buyers
        const buyerAddresses = [...new Set(recentTxs.map(tx => tx.walletAddress))];
        const smartWallets = await prisma.smartWallet.findMany({
            where: {
                walletAddress: { in: buyerAddresses },
                smartScore: { gte: 40 }
            }
        });

        const smartWalletMap = new Map(smartWallets.map(w => [w.walletAddress, w]));

        // Find smart wallet entries
        const smartEntries = recentTxs
            .filter(tx => smartWalletMap.has(tx.walletAddress))
            .map(tx => ({
                address: tx.walletAddress,
                entryPrice: Number(tx.amountUsd),
                entryTime: tx.timestamp,
                smartScore: smartWalletMap.get(tx.walletAddress)!.smartScore
            }));

        if (smartEntries.length < 3) {
            return { clusterDetected: false, clusterScore: 0, wallets: smartEntries, entryTiming: 'N/A' };
        }

        // Check for clustering (3+ smart wallets within 10 minutes)
        const clusters = findTimeClusters(smartEntries, 10 * 60 * 1000); // 10 minutes
        const largestCluster = clusters.reduce((max, cluster) =>
            cluster.length > max.length ? cluster : max, []
        );

        const clusterDetected = largestCluster.length >= 3;
        const clusterScore = Math.min(100, largestCluster.length * 20);

        // Determine entry timing relative to price movement
        const entryTiming = await determineEntryTiming(tokenId, largestCluster);

        return {
            clusterDetected,
            clusterScore,
            wallets: largestCluster,
            entryTiming
        };

    } catch (err: any) {
        logger.error({ tokenId, err: err.message }, 'Cluster detection failed');
        return { clusterDetected: false, clusterScore: 0, wallets: [], entryTiming: 'N/A' };
    }
}

function findTimeClusters(entries: any[], windowMs: number): any[][] {
    const clusters: any[][] = [];

    for (let i = 0; i < entries.length; i++) {
        const cluster = [entries[i]];
        const baseTime = entries[i].entryTime.getTime();

        for (let j = i + 1; j < entries.length; j++) {
            const timeDiff = entries[j].entryTime.getTime() - baseTime;
            if (timeDiff <= windowMs) {
                cluster.push(entries[j]);
            }
        }

        if (cluster.length >= 3) {
            clusters.push(cluster);
        }
    }

    return clusters;
}

async function determineEntryTiming(tokenId: string, cluster: any[]): Promise<string> {
    if (cluster.length === 0) return 'N/A';

    const clusterTime = cluster[0].entryTime;

    // Get snapshots before and after cluster
    const snapshots = await prisma.marketSnapshot.findMany({
        where: {
            tokenId,
            timestamp: {
                gte: new Date(clusterTime.getTime() - 30 * 60 * 1000),
                lte: new Date(clusterTime.getTime() + 30 * 60 * 1000)
            }
        },
        orderBy: { timestamp: 'asc' }
    });

    if (snapshots.length < 2) return 'Unknown';

    const priceAtEntry = snapshots.find(s => s.timestamp >= clusterTime);
    const priceAfter = snapshots[snapshots.length - 1];

    if (!priceAtEntry || !priceAfter) return 'Unknown';

    const priceChange = ((Number(priceAfter.price) - Number(priceAtEntry.price)) / Number(priceAtEntry.price)) * 100;

    if (priceChange > 20) return 'Early (before +20% move)';
    if (priceChange > 10) return 'Good (before +10% move)';
    if (priceChange > 0) return 'Neutral (slight gain)';
    return 'Late (after peak)';
}
