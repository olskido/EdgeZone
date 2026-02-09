import { Worker } from 'bullmq';
import { redis } from '../cache/redis';
import { logger } from '../utils/logger';
import { prisma } from '../models/prisma';
import { helius, ParsedSwap } from '../services/helius/client';

const WALLET_INTELLIGENCE_ENABLED = process.env.HELIUS_API_KEY ? true : false;

export const walletIntelligenceWorker = new Worker(
  'wallet-intelligence',
  async (job) => {
    if (!WALLET_INTELLIGENCE_ENABLED) {
      logger.info('Wallet intelligence disabled - Helius API key not configured');
      return;
    }

    const t0 = Date.now();
    logger.info({ jobId: job.id }, 'Starting wallet intelligence cycle');

    try {
      // Step 1: Select active tokens to analyze
      const activeTokens = await prisma.token.findMany({
        where: {
          volume24h: { gte: 150000 },
          liquidity: { gte: 75000 },
          lastSeenAt: { gte: new Date(Date.now() - 10 * 60 * 1000) }
        },
        orderBy: { volume24h: 'desc' },
        take: 20
      });

      logger.info({ count: activeTokens.length }, 'Selected tokens for analysis');

      let analyzedCount = 0;
      let smartWalletsDetected = 0;
      let clustersDetected = 0;

      for (const token of activeTokens) {
        try {
          const swaps = await helius.getTokenSwaps(token.contract, 100);
          const parsedSwaps = helius.parseSwaps(swaps, token.contract);

          if (parsedSwaps.length === 0) continue;

          await storeTransactions(token.id, parsedSwaps);
          const smartWallets = await detectSmartWallets(parsedSwaps);
          smartWalletsDetected += smartWallets;

          const clusterDetected = await detectClusters(token.id);
          if (clusterDetected) clustersDetected++;

          const momentum = await calculateMomentum(token.id);
          const conviction = await calculateConviction(token.id);
          const threat = await calculateThreat(token.id);

          await prisma.token.update({
            where: { id: token.id },
            data: {
              momentumScore: momentum,
              convictionScore: conviction,
              threatLevel: threat,
              smartWalletFlow: smartWallets > 0,
              clusterDetected
            }
          });

          analyzedCount++;
        } catch (err: any) {
          logger.warn({ token: token.ticker, err: err.message }, 'Failed to analyze token');
        }
      }

      const duration = Date.now() - t0;
      logger.info({
        service: 'wallet-intelligence',
        duration,
        analyzed: analyzedCount,
        smartWallets: smartWalletsDetected,
        clusters: clustersDetected
      }, 'Wallet intelligence cycle completed');

    } catch (err: any) {
      logger.error({ err: err.message }, 'Wallet intelligence cycle failed');
      throw err;
    }
  },
  { connection: redis, concurrency: 1, lockDuration: 120000 }
);

async function storeTransactions(tokenId: string, swaps: ParsedSwap[]): Promise<void> {
  for (const swap of swaps) {
    try {
      await prisma.walletTransaction.upsert({
        where: { signature: swap.signature },
        update: { timestamp: swap.timestamp },
        create: {
          tokenId,
          walletAddress: swap.walletAddress,
          amountUsd: swap.amountUsd,
          side: swap.side,
          timestamp: swap.timestamp,
          signature: swap.signature
        }
      });
    } catch (err: any) {
      if (!err.message?.includes('unique constraint')) {
        logger.warn({ signature: swap.signature }, 'Failed to store transaction');
      }
    }
  }
}

async function detectSmartWallets(swaps: ParsedSwap[]): Promise<number> {
  const uniqueWallets = [...new Set(swaps.map(s => s.walletAddress))];
  let smartCount = 0;

  for (const walletAddress of uniqueWallets) {
    const walletTxs = await prisma.walletTransaction.findMany({
      where: { walletAddress },
      orderBy: { timestamp: 'desc' },
      take: 50
    });

    if (walletTxs.length < 3) continue;

    let smartScore = 0;
    const avgTradeSize = walletTxs.reduce((sum, tx) => sum + Number(tx.amountUsd), 0) / walletTxs.length;
    if (avgTradeSize > 5000) smartScore += 30;

    const earlyEntry = Math.random() > 0.7;
    if (earlyEntry) smartScore += 40;

    const buys = walletTxs.filter(tx => tx.side === 'buy');
    const sells = walletTxs.filter(tx => tx.side === 'sell');
    const winRate = sells.length > 0 ? Math.min(1, buys.length / sells.length) : 0.5;
    if (winRate > 0.6) smartScore += 30;

    if (smartScore >= 40) {
      await prisma.smartWallet.upsert({
        where: { walletAddress },
        update: { smartScore, totalTrades: walletTxs.length, lastActive: new Date() },
        create: {
          walletAddress,
          smartScore,
          totalTrades: walletTxs.length,
          avgEntryPosition: 0.2,
          lastActive: new Date()
        }
      });
      smartCount++;
    }
  }

  return smartCount;
}

async function detectClusters(tokenId: string): Promise<boolean> {
  const recentBuys = await prisma.walletTransaction.findMany({
    where: {
      tokenId,
      side: 'buy',
      timestamp: { gte: new Date(Date.now() - 5 * 60 * 1000) }
    }
  });

  if (recentBuys.length < 3) return false;

  const smartWalletAddresses = await prisma.smartWallet.findMany({
    where: {
      walletAddress: { in: recentBuys.map(tx => tx.walletAddress) },
      smartScore: { gte: 40 }
    }
  });

  return smartWalletAddresses.length >= 3;
}

async function calculateMomentum(tokenId: string): Promise<number> {
  const recentTxs = await prisma.walletTransaction.findMany({
    where: {
      tokenId,
      timestamp: { gte: new Date(Date.now() - 60 * 60 * 1000) }
    }
  });

  if (recentTxs.length === 0) return 0;

  const buys = recentTxs.filter(tx => tx.side === 'buy');
  const buyPressure = (buys.length / recentTxs.length) * 100;
  const volumeAccel = Math.min(100, recentTxs.length * 2);
  const uniqueWallets = new Set(recentTxs.map(tx => tx.walletAddress));
  const walletInflow = Math.min(100, uniqueWallets.size * 5);

  const score = buyPressure * 0.4 + volumeAccel * 0.4 + walletInflow * 0.2;
  return Math.min(100, Math.max(0, Math.round(score)));
}

async function calculateConviction(tokenId: string): Promise<number> {
  const transactions = await prisma.walletTransaction.findMany({
    where: { tokenId },
    orderBy: { timestamp: 'desc' },
    take: 100
  });

  if (transactions.length === 0) return 50;

  let score = 50;
  const walletBuyCounts = new Map<string, number>();

  transactions.forEach(tx => {
    if (tx.side === 'buy') {
      walletBuyCounts.set(tx.walletAddress, (walletBuyCounts.get(tx.walletAddress) || 0) + 1);
    }
  });

  const repeatBuyers = Array.from(walletBuyCounts.values()).filter(count => count > 1).length;
  score += repeatBuyers * 5;

  let quickFlips = 0;
  const walletLastBuy = new Map<string, Date>();

  for (const tx of transactions) {
    if (tx.side === 'buy') {
      walletLastBuy.set(tx.walletAddress, tx.timestamp);
    } else if (tx.side === 'sell') {
      const lastBuy = walletLastBuy.get(tx.walletAddress);
      if (lastBuy && (tx.timestamp.getTime() - lastBuy.getTime()) < 5 * 60 * 1000) {
        quickFlips++;
      }
    }
  }

  score -= quickFlips * 10;
  return Math.min(100, Math.max(0, score));
}

async function calculateThreat(tokenId: string): Promise<string> {
  let threatPoints = 0;

  const recentTxs = await prisma.walletTransaction.findMany({
    where: {
      tokenId,
      timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    }
  });

  if (recentTxs.length > 0) {
    const walletVolumes = new Map<string, number>();
    let totalVolume = 0;

    recentTxs.forEach(tx => {
      const amount = Number(tx.amountUsd);
      walletVolumes.set(tx.walletAddress, (walletVolumes.get(tx.walletAddress) || 0) + amount);
      totalVolume += amount;
    });

    const maxWalletVolume = Math.max(...Array.from(walletVolumes.values()));
    const dominance = totalVolume > 0 ? maxWalletVolume / totalVolume : 0;

    if (dominance > 0.5) threatPoints += 30;
    if (dominance > 0.7) threatPoints += 20;
  }

  if (threatPoints >= 60) return 'HIGH';
  if (threatPoints >= 30) return 'MEDIUM';
  return 'LOW';
}
