import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../models/prisma';
import { fetcher } from '../services/birdeye/fetcher';

const MIN_LIQUIDITY = 20000;
const MIN_VOLUME = 200000;
const MIN_MARKET_CAP = 100000;

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(100),
  sort: z.string().default('volume'),
  minMarketCap: z.coerce.number().default(MIN_MARKET_CAP),
  minVolume: z.coerce.number().default(MIN_VOLUME),
  minLiquidity: z.coerce.number().default(MIN_LIQUIDITY),
});

export const tokenRoutes: FastifyPluginAsync = async (app) => {
  app.get('/tokens', async (req, reply) => {
    const {
      page,
      limit,
      sort,
      minMarketCap,
      minVolume,
      minLiquidity,
    } = querySchema.parse(req.query);

    const skip = (page - 1) * limit;

    const sortOptions = {
      price: { price: 'desc' },
      liquidity: { liquidity: 'desc' },
      volume: { volume24h: 'desc' },
      marketcap: { marketCap: 'desc' },
      newest: { createdAt: 'desc' },
    };

    const orderBy = sortOptions[sort.toLowerCase()] || { volume24h: 'desc' };

    try {
      const [total, tokens] = await Promise.all([
        prisma.token.count({
          where: {
            chain: 'solana',
            liquidity: { gte: minLiquidity },
            volume24h: { gte: minVolume },
            marketCap: { gte: minMarketCap },
          },
        }),
        prisma.token.findMany({
          where: {
            chain: 'solana',
            liquidity: { gte: minLiquidity },
            volume24h: { gte: minVolume },
            marketCap: { gte: minMarketCap },
          },
          orderBy,
          skip,
          take: limit,
          include: { signal: true },
        }),
      ]);

      const rows = tokens.map((t: any) => ({
        id: t.id,
        name: t.name,
        symbol: t.ticker,
        contract: t.contract,
        price: Number(t.price),
        liquidity: Number(t.liquidity),
        volume24h: Number(t.volume24h),
        marketCap: Number(t.marketCap),
        // Add your other mapping fields here
      }));

      return {
        tokens: rows,
        total,
        totalPages: Math.ceil(total / limit),
        page,
        limit,
      };
    } catch (err: any) {
      app.log.error({ error: err?.message }, 'Error in /tokens');

      // Fallback – adjust params to match your fetcher
      const fallback = await fetcher.fetchAllTokens({
        minLiquidity: minLiquidity,       // correct name
        minVolume24h: minVolume,
        minMarketCap,
        limit: limit,
      });

      return {
        tokens: fallback.slice(skip, skip + limit),
        total: fallback.length,
        totalPages: 10,
        page,
        limit,
      };
    }
  });
};