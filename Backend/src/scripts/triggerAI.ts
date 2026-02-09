/**
 * Trigger AI analysis for a specific token
 * Run with: npx ts-node src/scripts/triggerAI.ts <tokenId>
 */
import { prisma } from '../models/prisma';
import { logger } from '../utils/logger';
import OpenAI from 'openai';
import { helius } from '../services/helius/client';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateAISummary(token: any): Promise<string> {
    // Get Helius data
    let heliusSection = 'On-chain data unavailable.';
    try {
        if (process.env.HELIUS_API_KEY) {
            const swaps = await helius.getTokenSwaps(token.contract, 50);
            const parsed = helius.parseSwaps(swaps, token.contract);

            if (parsed.length > 0) {
                const buys = parsed.filter(s => s.side === 'buy');
                const sells = parsed.filter(s => s.side === 'sell');
                const buyPressure = buys.length / parsed.length;
                const largestBuy = Math.max(...buys.map(s => s.amountUsd), 0);
                const largestSell = Math.max(...sells.map(s => s.amountUsd), 0);

                heliusSection = `
Real-Time On-Chain Data:
- Recent Buy Pressure: ${(buyPressure * 100).toFixed(0)}%
- Largest Buy: $${Math.round(largestBuy)}
- Largest Sell: $${Math.round(largestSell)}
- Total Recent Transactions: ${parsed.length}`;
            }
        }
    } catch (e) {
        console.log('Helius data unavailable');
    }

    const prompt = `
Analyze this Solana token for an institutional trader.
Token: ${token.name} (${token.ticker})
Price: $${token.price}
Market Cap: $${token.marketCap?.toLocaleString()}
24h Volume: $${token.volume24h?.toLocaleString()}
Liquidity: $${token.liquidity?.toLocaleString()}

Signals:
- Momentum Score: ${token.momentumScore}/100
- Conviction Score: ${token.convictionScore}/100
- Threat Level: ${token.threatLevel}
- Smart Wallet Flow: ${token.smartWalletFlow ? 'DETECTED' : 'None'}

${heliusSection}

Task: Write a concise, high-alpha summary (3-4 lines). Focus on flow, whale activity, and momentum.
Style: Institutional, direct, no emojis. Highlight if this is "accumulation" or "distribution" phase.
`;

    const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 150,
        temperature: 0.7
    });

    return completion.choices[0].message.content || 'Analysis unavailable.';
}

async function main() {
    const tokenId = process.argv[2];

    if (!tokenId) {
        // If no token ID, get top 5 tokens and generate for all
        const tokens = await prisma.token.findMany({
            where: {
                volume24h: { gte: 100000 }
            },
            orderBy: { volume24h: 'desc' },
            take: 5
        });

        console.log(`Generating AI summaries for ${tokens.length} tokens...`);

        for (const token of tokens) {
            try {
                console.log(`Processing ${token.ticker}...`);
                const summary = await generateAISummary(token);

                await prisma.token.update({
                    where: { id: token.id },
                    data: {
                        aiSummary: summary,
                        aiSummaryUpdated: new Date()
                    }
                });

                console.log(`✅ ${token.ticker}: ${summary.slice(0, 100)}...`);
            } catch (err: any) {
                console.error(`❌ ${token.ticker}: ${err.message}`);
            }
        }
    } else {
        const token = await prisma.token.findUnique({ where: { id: tokenId } });

        if (!token) {
            console.error('Token not found');
            process.exit(1);
        }

        console.log(`Generating AI summary for ${token.ticker}...`);
        const summary = await generateAISummary(token);

        await prisma.token.update({
            where: { id: token.id },
            data: {
                aiSummary: summary,
                aiSummaryUpdated: new Date()
            }
        });

        console.log('✅ Generated:', summary);
    }

    await prisma.$disconnect();
}

main().catch(console.error);
