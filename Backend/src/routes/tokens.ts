import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../models/prisma';
import { redis } from '../cache/redis';
import { cacheKeys } from '../cache/cacheKeys';
import { safeJsonParse } from '../utils/json';
import { HttpError } from '../utils/http';
import { fetcher } from '../services/birdeye/fetcher';
import type { EdgeVerdict, ThreatLevel, TokenDetailResponse, TokenScannerRow } from '../models/dto';

const withTimeout = async <T>(promise: Promise<T>, ms: number): Promise<T> => {
  let timeoutId: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('timeout')), ms);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const TokensQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(1000).default(500),
  sort: z.string().default('newest')
});

const TokenParamsSchema = z.object({
  id: z.string().min(1)
});

export const tokenRoutes: FastifyPluginAsync = async (app) => {
  app.get('/tokens', async (req) => {
    const { page, limit, sort } = TokensQuerySchema.parse(req.query);
    const pageSize = limit;
    const skip = (page - 1) * pageSize;

    const sortMapping: Record<string, any> = {
      price: { price: 'desc' },
      liquidity: { liquidity: 'desc' },
      volume: { volume24h: 'desc' },
      marketcap: { marketCap: 'desc' },
      newest: { createdAt: 'desc' },
      conviction: { signal: { convictionScore: 'desc' } },
      trend: { signal: { edgeScore: 'desc' } }
    };

    const orderBy = sortMapping[sort.toLowerCase()] || { createdAt: 'desc' };
    const t0 = Date.now();
    const key = cacheKeys.tokenList(page, pageSize, sort);

    try {
      const cached = await redis.get(key);
      if (cached) {
        const parsed = safeJsonParse<{ tokens: TokenScannerRow[]; totalPages: number; total: number }>(cached);
        if (parsed) return parsed;
      }
    } catch {
      // Cache is best-effort
    }

    const where = {
      chain: 'solana',
      marketCap: { gte: 10000 },
      volume24h: { gte: 5000 },
      liquidity: { gte: 20000 }
    };

    let tokens;
    let count = 0;

    try {
      const [total, data] = await withTimeout(
        prisma.$transaction([
          prisma.token.count({ where }),
          prisma.token.findMany({
            where,
            orderBy,
            skip,
            take: pageSize,
            include: {
              signal: true
            }
          })
        ]),
        3000 // 3s fast timeout for DB
      );
      count = total;
      tokens = data;
    } catch (err) {
      app.log.warn({ err }, 'DB unavailable/slow, switching to direct API fetch');

      // FALLBACK: Fetch directly from Birdeye/DexScreener
      try {
        const fallbackTokens = await fetcher.fetchTokenList({
          limit: pageSize,
          offset: skip,
          minLiquidity: 20000,
          minVolume24h: 5000
        });

        count = 1000; // Fake total for pagination
        tokens = fallbackTokens.map(t => ({
          id: t.address,
          name: t.name,
          ticker: t.symbol,
          contract: t.address,
          logoUrl: t.logo_uri,
          price: t.price,
          liquidity: t.liquidity,
          volume24h: t.volume_24h_usd,
          marketCap: t.market_cap,
          priceChange24h: t.price_change_24h_percent,
          volumeChange24h: t.volume_24h_change_percent,
          momentumScore: 50,
          convictionScore: 50,
          convictionRatio: 0,
          threatScore: 100,
          threatLevel: 'LOW',
          smartWalletFlow: false,
          aiSummary: null
        }));
      } catch (apiErr) {
        app.log.error({ err: apiErr }, 'Fallback API also failed');
        throw new HttpError(503, 'Service unavailable');
      }
    }

    // Simplest approach: Return fallback payload immediately if used fallback
    if (!tokens[0] || !('createdAt' in tokens[0])) {
      const payload = { tokens: tokens as any, totalPages: 50, total: count, page, limit: pageSize };
      return payload;
    }

    // Normal DB mapping logic
    const rows: TokenScannerRow[] = tokens.map((t: any) => {
      const price = Number(t.price) || 0;
      const liquidity = Number(t.liquidity) || 0;
      const volume24h = Number(t.volume24h) || 0;
      const marketCap = Number(t.marketCap) || 1;
      const priceChange24h = Number(t.priceChange24h) || 0;
      const volumeChange24h = Number(t.volumeChange24h) || 0;

      const rawMomentum = (priceChange24h + volumeChange24h) / 2;
      const momentumScore = Math.max(-100, Math.min(100, rawMomentum));

      const convictionRatio = (liquidity / marketCap) * 100;
      const convictionScore = Math.max(0, Math.min(100, convictionRatio * 5));

      let threatPenalty = 0;
      if (t.mintAuthority || t.isMintable) threatPenalty += 50;
      if (t.freezeAuthority || t.isFreezable) threatPenalty += 40;
      if (t.top10HolderPercent && t.top10HolderPercent > 50) threatPenalty += 30;
      const threatScore = Math.max(0, 100 - threatPenalty);

      let threatLevel: 'LOW' | 'MODERATE' | 'HIGH' = 'LOW';
      if (threatScore < 30) threatLevel = 'HIGH';
      else if (threatScore < 60) threatLevel = 'MODERATE';

      return {
        id: t.id,
        name: t.name,
        symbol: t.ticker,
        contract: t.contract,
        logoUrl: t.logoUrl,
        price,
        liquidity,
        volume24h,
        marketCap,
        priceChange24h,
        volumeChange24h,
        momentumScore,
        convictionScore: Math.round(convictionScore),
        convictionRatio: Math.round(convictionRatio * 100) / 100,
        threatScore,
        threatLevel,
        smartWalletFlow: t.smartWalletFlow ?? false,
        aiSummary: t.aiSummary ?? null,
        smartMoneyScore: t.signal?.smartMoneyScore ?? 0,
        whaleScore: t.signal?.whaleScore ?? 0,
        edgeScore: t.signal?.edgeScore ?? 0,
        momentumPhase: t.signal?.momentumPhase,
        edgeVerdict: (t.signal?.edgeVerdict as TokenScannerRow['edgeVerdict']) ?? undefined,
        confidence: t.signal?.confidence,
        updatedAt: t.signal?.updatedAt ? t.signal.updatedAt.toISOString() : undefined
      };
    });

    const totalPages = Math.max(1, Math.ceil(count / pageSize));
    const payload = { tokens: rows, totalPages, total: count, page, limit: pageSize };

    try {
      await redis.set(key, JSON.stringify(payload), 'EX', 10);
    } catch {
      // Cache is best-effort
    }

    app.log.info({ ms: Date.now() - t0, returned: rows.length, totalCount: count }, 'tokens served');
    return payload;
  });

  app.get('/token/:id', async (req) => {
    const { id } = TokenParamsSchema.parse(req.params);
    const key = cacheKeys.tokenDetail(id);

    try {
      const cached = await redis.get(key);
      if (cached) {
        const parsed = safeJsonParse<any>(cached);
        if (parsed) return parsed;
      }
    } catch {
      // Cache is best-effort
    }

    let token: any;
    try {
      token = await withTimeout(
        prisma.token.findUnique({
          where: { id },
          include: {
            signal: true,
            walletEvents: {
              orderBy: { timestamp: 'desc' },
              take: 20
            },
            snapshots: {
              orderBy: { timestamp: 'desc' },
              take: 24
            }
          }
        }),
        5000
      );
    } catch (err) {
      app.log.error({ err, id }, 'db unavailable (token detail)');
      throw new HttpError(503, 'Database unavailable');
    }

    if (!token) throw new HttpError(404, 'Token not found');

    // Get smart wallet count for this token
    const smartWalletCount = await prisma.walletTransaction.groupBy({
      by: ['walletAddress'],
      where: {
        tokenId: id,
        timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      },
      _count: true
    }).then((groups: any) => groups.length).catch(() => 0);

    // Enhanced response with full analytics
    const payload = {
      tokenInfo: {
        id: token.id,
        name: token.name,
        symbol: token.ticker,
        contract: token.contract,
        logoUrl: token.logoUrl,
        price: Number(token.price),
        liquidity: Number(token.liquidity),
        volume24h: Number(token.volume24h),
        marketCap: Number(token.marketCap)
      },
      marketMetrics: {
        momentumScore: token.momentumScore ?? 0,
        convictionScore: token.convictionScore ?? 0,
        threatLevel: token.threatLevel ?? 'LOW',
        smartWalletFlow: token.smartWalletFlow ?? false,
        clusterDetected: token.clusterDetected ?? false
      },
      walletSignals: {
        smartWalletCount,
        recentBuys: token.walletEvents?.filter((e: any) => e.action === 'buy').length ?? 0,
        recentSells: token.walletEvents?.filter((e: any) => e.action === 'sell').length ?? 0,
        topWallets: token.walletEvents?.slice(0, 5).map((e: any) => ({
          wallet: e.wallet,
          action: e.action,
          amount: Number(e.amount),
          usdValue: Number(e.usdValue),
          label: e.label
        })) ?? []
      },
      aiSignals: {
        aiSummary: token.aiSummary,
        aiSummaryUpdated: token.aiSummaryUpdated?.toISOString()
      },
      riskScore: token.threatLevel ?? 'LOW',
      signal: token.signal
        ? {
          convictionScore: token.signal.convictionScore,
          smartMoneyScore: token.signal.smartMoneyScore,
          whaleScore: token.signal.whaleScore,
          edgeScore: token.signal.edgeScore,
          momentumPhase: token.signal.momentumPhase,
          threatLevel: token.signal.threatLevel as ThreatLevel,
          edgeVerdict: token.signal.edgeVerdict as EdgeVerdict,
          confidence: token.signal.confidence,
          updatedAt: token.signal.updatedAt.toISOString()
        }
        : null,
      marketHistory: token.snapshots?.map((s: any) => ({
        price: Number(s.price),
        liquidity: Number(s.liquidity),
        volume: Number(s.volume),
        timestamp: s.timestamp.toISOString()
      })) ?? []
    };

    try {
      await redis.set(key, JSON.stringify(payload), 'EX', 20);
    } catch {
      // Cache is best-effort
    }

    return payload;
  });
};
