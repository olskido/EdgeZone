"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenRoutes = void 0;
const zod_1 = require("zod");
const prisma_1 = require("../models/prisma");
const redis_1 = require("../cache/redis");
const cacheKeys_1 = require("../cache/cacheKeys");
const json_1 = require("../utils/json");
const http_1 = require("../utils/http");
const TokensQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().positive().max(200).default(50),
    sort: zod_1.z.string().default('trend')
});
const TokenParamsSchema = zod_1.z.object({
    id: zod_1.z.string().min(1)
});
const tokenRoutes = async (app) => {
    app.get('/tokens', async (req) => {
        const { page, limit, sort } = TokensQuerySchema.parse(req.query);
        const key = cacheKeys_1.cacheKeys.tokenList(page, limit, sort);
        const cached = await redis_1.redis.get(key);
        if (cached) {
            const parsed = (0, json_1.safeJsonParse)(cached);
            if (parsed)
                return parsed;
        }
        const skip = (page - 1) * limit;
        const [count, tokens] = await Promise.all([
            prisma_1.prisma.token.count(),
            prisma_1.prisma.token.findMany({
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
                include: {
                    signal: true,
                    snapshots: {
                        orderBy: { timestamp: 'desc' },
                        take: 1
                    }
                }
            })
        ]);
        const rows = tokens.map((t) => {
            const snap = t.snapshots[0];
            const price = snap ? Number(snap.price) : 0;
            const liquidity = snap ? Number(snap.liquidity) : 0;
            const volume24h = snap ? Number(snap.volume) : 0;
            const smartMoneyScore = t.signal ? t.signal.smartMoneyScore : 0;
            const whaleScore = t.signal ? t.signal.whaleScore : 0;
            const edgeScore = t.signal ? t.signal.edgeScore : 0;
            return {
                id: t.id,
                name: t.name,
                symbol: t.ticker,
                contract: t.contract,
                price,
                liquidity,
                volume24h,
                smartMoneyScore,
                whaleScore,
                edgeScore,
                convictionScore: t.signal?.convictionScore,
                momentumPhase: t.signal?.momentumPhase,
                threatLevel: t.signal?.threatLevel ?? undefined,
                edgeVerdict: t.signal?.edgeVerdict ?? undefined,
                confidence: t.signal?.confidence,
                updatedAt: t.signal?.updatedAt.toISOString()
            };
        });
        const totalPages = Math.max(1, Math.ceil(count / limit));
        const payload = { tokens: rows, totalPages };
        await redis_1.redis.set(key, JSON.stringify(payload), 'EX', 10);
        return payload;
    });
    app.get('/token/:id', async (req) => {
        const { id } = TokenParamsSchema.parse(req.params);
        const key = cacheKeys_1.cacheKeys.tokenDetail(id);
        const cached = await redis_1.redis.get(key);
        if (cached) {
            const parsed = (0, json_1.safeJsonParse)(cached);
            if (parsed)
                return parsed;
        }
        const token = await prisma_1.prisma.token.findUnique({
            where: { id },
            include: { signal: true }
        });
        if (!token)
            throw new http_1.HttpError(404, 'Token not found');
        const payload = {
            id: token.id,
            name: token.name,
            symbol: token.ticker,
            contract: token.contract,
            signal: token.signal
                ? {
                    convictionScore: token.signal.convictionScore,
                    momentumPhase: token.signal.momentumPhase,
                    threatLevel: token.signal.threatLevel,
                    edgeVerdict: token.signal.edgeVerdict,
                    confidence: token.signal.confidence,
                    updatedAt: token.signal.updatedAt.toISOString()
                }
                : null
        };
        await redis_1.redis.set(key, JSON.stringify(payload), 'EX', 20);
        return payload;
    });
};
exports.tokenRoutes = tokenRoutes;
