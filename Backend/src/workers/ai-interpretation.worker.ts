import { Worker } from 'bullmq';
import { redis } from '../cache/redis';
import { logger } from '../utils/logger';
import { prisma } from '../models/prisma';
import OpenAI from 'openai';
import { helius } from '../services/helius/client';

const AI_ENABLED = process.env.OPENAI_API_KEY ? true : false;
const openai = AI_ENABLED ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

export const aiInterpretationWorker = new Worker(
    'ai-interpretation',
    async (job) => {
        if (!AI_ENABLED || !openai) {
            logger.info('AI interpretation disabled - OpenAI API key not configured');
            return;
        }

        const t0 = Date.now();
        logger.info({ jobId: job.id }, 'Starting AI interpretation cycle');

        try {
            // Select tokens that need AI analysis
            // Prioritize User's "High Quality" Filter: 100k MC / 200k Vol / 24h Old
            const tokens = await prisma.token.findMany({
                where: {
                    AND: [
                        { marketCap: { gte: 100000 } },
                        { volume24h: { gte: 200000 } },
                        { createdAt: { lte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
                        {
                            OR: [
                                { aiSummary: null },
                                { aiSummaryUpdated: { lt: new Date(Date.now() - 30 * 60 * 1000) } } // Update every 30 mins
                            ]
                        }
                    ]
                },
                orderBy: { momentumScore: 'desc' },
                take: 10 // Limit to control costs
            });

            logger.info({ count: tokens.length }, 'Selected tokens for AI analysis');

            let summariesGenerated = 0;

            for (const token of tokens) {
                try {
                    // Enrich with Helius Data
                    const heliusData = await getHeliusAnalysis(token.contract);
                    const summary = await generateAISummary(token, heliusData);

                    await prisma.token.update({
                        where: { id: token.id },
                        data: {
                            aiSummary: summary,
                            aiSummaryUpdated: new Date()
                        }
                    });

                    summariesGenerated++;
                } catch (err: any) {
                    logger.warn({ token: token.ticker, err: err.message }, 'Failed to generate AI summary');
                }
            }

            const duration = Date.now() - t0;
            logger.info({
                service: 'ai-interpretation',
                duration,
                summaries: summariesGenerated
            }, 'AI interpretation cycle completed');

        } catch (err: any) {
            logger.error({ err: err.message }, 'AI interpretation cycle failed');
            throw err;
        }
    },
    { connection: redis, concurrency: 1, lockDuration: 60000 }
);

async function getHeliusAnalysis(contract: string) {
    if (!process.env.HELIUS_API_KEY) return null;
    try {
        const swaps = await helius.getTokenSwaps(contract, 50); // Get last 50 swaps
        const parsed = helius.parseSwaps(swaps, contract);

        if (parsed.length === 0) return null;

        const volume = parsed.reduce((sum, s) => sum + s.amountUsd, 0);
        const buys = parsed.filter(s => s.side === 'buy');
        const sells = parsed.filter(s => s.side === 'sell');

        const largestBuy = Math.max(...buys.map(s => s.amountUsd), 0);
        const largestSell = Math.max(...sells.map(s => s.amountUsd), 0);
        const buyPressure = buys.length / parsed.length;

        // Find recent whales (tx > $5k)
        const whaleTxs = parsed.filter(s => s.amountUsd > 5000);

        return {
            recentVolume: volume,
            buyPressure: buyPressure.toFixed(2),
            largestBuy,
            largestSell,
            recentWhaleActivity: whaleTxs.map(w => `${w.side.toUpperCase()} $${Math.round(w.amountUsd)}`).join(', ')
        };
    } catch (e) {
        return null;
    }
}

async function generateAISummary(token: any, heliusData: any): Promise<string> {
    if (!openai) return '';

    const heliusSection = heliusData ? `
Real-Time On-Chain Data (Last 50 Swaps):
- Recent Buy Pressure: ${Number(heliusData.buyPressure) * 100}%
- Largest Buy: $${Math.round(heliusData.largestBuy)}
- Largest Sell: $${Math.round(heliusData.largestSell)}
- Recent Whale Action: ${heliusData.recentWhaleActivity || 'None detected'}
` : 'On-chain data unavailable (Helius API skipped).';

    const prompt = `
Analyze this Solana token for an institutional trader.
Token: ${token.name} (${token.ticker})
Price: $${token.price}
Market Cap: $${token.marketCap}
24h Volume: $${token.volume24h}
Liquidity: $${token.liquidity}

Signals:
- Smart Wallet Inflow: ${token.smartWalletFlow ? 'DETECTED' : 'None'}
- Cluster Detected: ${token.clusterDetected ? 'YES' : 'No'}
- Momentum Score: ${token.momentumScore}/100
- Conviction Score: ${token.convictionScore}/100
- Threat Level: ${token.threatLevel}

${heliusSection}

Task: Write a concise, high-alpha summary (3-4 lines). Focus on flow, whale activity, and momentum. 
Style: Institutional, direct, no emojis. Highlight if this is a "accumulation" or "distribution" phase based on the data.
`;

    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 150,
            temperature: 0.7
        });

        return completion.choices[0].message.content || 'Analysis pending.';
    } catch (err: any) {
        logger.error({ err: err.message, token: token.ticker }, 'OpenAI API error');
        return 'Analysis unavailable.';
    }
}
