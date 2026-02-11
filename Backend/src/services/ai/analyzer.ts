import OpenAI from 'openai';
import { logger } from '../../utils/logger';
import { HolderPattern, WhaleActivity } from '../helius/client';
import { redis } from '../../cache/redis';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

export interface AIAnalysis {
    summary: string;
    sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    sentimentColor: 'GREEN' | 'RED' | 'BLUE';
    confidence: number; // 0-100
    keyInsights: string[];
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    actionSuggestion: string;
    holderBreakdown: {
        accumulators: number;
        diamondHands: number;
        paperHands: number;
        whales: number;
    };
    whaleAlert: string | null;
    cachedAt: Date;
}

/**
 * AI Analysis Service
 * Uses OpenAI to interpret Helius data and generate trading signals
 */
export const aiAnalyzer = {
    /**
     * Generate comprehensive AI analysis from holder patterns and whale activity
     */
    analyzeToken: async (
        tokenSymbol: string,
        tokenAddress: string,
        holderPatterns: HolderPattern[],
        whaleActivity: WhaleActivity[],
        marketData: {
            price: number;
            priceChange24h: number;
            volume24h: number;
            liquidity: number;
            marketCap: number;
        }
    ): Promise<AIAnalysis> => {
        // Check cache first (5 minute TTL)
        const cacheKey = `ai:analysis:${tokenAddress}`;
        const cached = await redis.get(cacheKey);
        if (cached) {
            return JSON.parse(cached);
        }

        // Count holder patterns
        const holderBreakdown = {
            accumulators: holderPatterns.filter(h => h.pattern === 'ACCUMULATOR').length,
            diamondHands: holderPatterns.filter(h => h.pattern === 'DIAMOND_HANDS').length,
            paperHands: holderPatterns.filter(h => h.pattern === 'PAPER_HANDS').length,
            whales: holderPatterns.filter(h => h.pattern === 'WHALE' || h.percentage > 5).length
        };

        // Calculate whale activity summary
        const recentWhales = whaleActivity.filter(w =>
            Date.now() - w.timestamp.getTime() < 60 * 60 * 1000 // Last hour
        );
        const whaleBuys = recentWhales.filter(w => w.type === 'buy');
        const whaleSells = recentWhales.filter(w => w.type === 'sell');

        // If no OpenAI key, use rule-based analysis
        if (!openai) {
            return generateRuleBasedAnalysis(
                tokenSymbol,
                holderPatterns,
                whaleActivity,
                marketData,
                holderBreakdown
            );
        }

        try {
            // Build prompt for OpenAI
            const prompt = buildAnalysisPrompt(
                tokenSymbol,
                holderPatterns,
                whaleActivity,
                marketData,
                holderBreakdown
            );

            const completion = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `You are an expert crypto analyst specializing in on-chain data analysis. 
                        You analyze holder patterns and whale activity to provide trading insights.
                        Your analysis should be concise, actionable, and color-coded:
                        - GREEN: Accumulation phase, bullish signals
                        - RED: Distribution phase, bearish signals
                        - BLUE: Neutral/institutional activity
                        
                        Respond ONLY with valid JSON matching this structure:
                        {
                            "summary": "2-3 sentence analysis",
                            "sentiment": "BULLISH" | "BEARISH" | "NEUTRAL",
                            "sentimentColor": "GREEN" | "RED" | "BLUE",
                            "confidence": 0-100,
                            "keyInsights": ["insight1", "insight2", "insight3"],
                            "riskLevel": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
                            "actionSuggestion": "one sentence recommendation",
                            "whaleAlert": "alert message or null"
                        }`
                    },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 500,
                temperature: 0.3
            });

            const content = completion.choices[0]?.message?.content || '{}';

            // Parse AI response
            let aiResponse;
            try {
                // Clean the response (remove markdown code blocks if present)
                const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
                aiResponse = JSON.parse(cleanContent);
            } catch (parseErr) {
                logger.warn({ content }, 'Failed to parse AI response, using rule-based');
                return generateRuleBasedAnalysis(
                    tokenSymbol,
                    holderPatterns,
                    whaleActivity,
                    marketData,
                    holderBreakdown
                );
            }

            const analysis: AIAnalysis = {
                summary: aiResponse.summary || 'Analysis unavailable',
                sentiment: aiResponse.sentiment || 'NEUTRAL',
                sentimentColor: aiResponse.sentimentColor || 'BLUE',
                confidence: aiResponse.confidence || 50,
                keyInsights: aiResponse.keyInsights || [],
                riskLevel: aiResponse.riskLevel || 'MEDIUM',
                actionSuggestion: aiResponse.actionSuggestion || 'Monitor for changes',
                holderBreakdown,
                whaleAlert: aiResponse.whaleAlert || null,
                cachedAt: new Date()
            };

            // Cache for 5 minutes
            await redis.setex(cacheKey, 300, JSON.stringify(analysis));

            logger.info({ tokenSymbol, sentiment: analysis.sentiment }, 'AI analysis completed');
            return analysis;

        } catch (err: any) {
            logger.error({ err: err.message, tokenSymbol }, 'AI analysis failed');
            return generateRuleBasedAnalysis(
                tokenSymbol,
                holderPatterns,
                whaleActivity,
                marketData,
                holderBreakdown
            );
        }
    }
};

/**
 * Build a detailed prompt for OpenAI analysis
 */
function buildAnalysisPrompt(
    tokenSymbol: string,
    holderPatterns: HolderPattern[],
    whaleActivity: WhaleActivity[],
    marketData: any,
    breakdown: any
): string {
    const holderSummary = holderPatterns.map(h =>
        `#${h.rank}: ${h.pattern} (${h.percentage.toFixed(1)}% supply, ${h.recentBuys} buys, ${h.recentSells} sells in 24h)`
    ).join('\n');

    const whaleSummary = whaleActivity.slice(0, 5).map(w =>
        `${w.type.toUpperCase()}: $${w.amountUsd.toFixed(0)} (${w.isSmartMoney ? 'SMART MONEY' : 'whale'})`
    ).join('\n');

    return `Analyze this Solana token for trading signals:

TOKEN: ${tokenSymbol}
PRICE: $${marketData.price}
24H CHANGE: ${marketData.priceChange24h?.toFixed(1) || 'N/A'}%
24H VOLUME: $${(marketData.volume24h || 0).toLocaleString()}
LIQUIDITY: $${(marketData.liquidity || 0).toLocaleString()}
MARKET CAP: $${(marketData.marketCap || 0).toLocaleString()}

TOP HOLDERS PATTERNS:
${holderSummary || 'No holder data available'}

HOLDER BREAKDOWN:
- Accumulators: ${breakdown.accumulators}
- Diamond Hands: ${breakdown.diamondHands}
- Paper Hands: ${breakdown.paperHands}
- Whales: ${breakdown.whales}

RECENT WHALE ACTIVITY:
${whaleSummary || 'No whale activity detected'}

Provide your analysis as a JSON object. Focus on whether this is accumulation or distribution phase, and highlight any "sells after 2x" patterns.`;
}

/**
 * Generate rule-based analysis when OpenAI is unavailable
 */
function generateRuleBasedAnalysis(
    tokenSymbol: string,
    holderPatterns: HolderPattern[],
    whaleActivity: WhaleActivity[],
    marketData: any,
    breakdown: any
): AIAnalysis {
    // Enhanced Rule-Based Logic for "Why Buy/Avoid"
    const whaleCount = breakdown.whales;
    const diamondHands = breakdown.diamondHands;
    const jeeters = breakdown.paperHands;

    // Whale activity analysis
    const recentWhales = whaleActivity.filter(w =>
        Date.now() - w.timestamp.getTime() < 60 * 60 * 1000
    );
    const netWhaleFlow = recentWhales.reduce((sum, w) =>
        sum + (w.type === 'buy' ? w.amountUsd : -w.amountUsd), 0
    );

    // Default state
    let sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    let sentimentColor: 'GREEN' | 'RED' | 'BLUE' = 'BLUE';
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM';
    let summary = "Analysis pending...";
    let actionSuggestion = "Monitor for now";
    const keyInsights: string[] = [];

    // Logic Scenarios
    if (jeeters > diamondHands && netWhaleFlow < -5000) {
        // SCENARIO: DUMPING
        sentiment = 'BEARISH';
        sentimentColor = 'RED';
        riskLevel = 'HIGH';
        summary = "⚠️ DISTRIBUTION DETECTED: Whales and paper hands are selling into liquidity. Momentum is fading.";
        actionSuggestion = "Avoid / Exit positions";
        keyInsights.push(`Net Whale Outflow: -$${Math.abs(netWhaleFlow).toFixed(0)}`);
        keyInsights.push(`${jeeters} Jeeters selling recently`);

    } else if (diamondHands >= 2 && netWhaleFlow > 10000) {
        // SCENARIO: STRONG ACCUMULATION
        sentiment = 'BULLISH';
        sentimentColor = 'GREEN';
        riskLevel = 'LOW';
        summary = "🟢 APE NOW: Strong conviction detected. Whales are accumulating and diamond hands are holding post-pump.";
        actionSuggestion = "Enter with conviction (Spot)";
        keyInsights.push(`Net Whale Inflow: +$${Math.abs(netWhaleFlow).toFixed(0)}`);
        keyInsights.push(`${diamondHands} Diamond Hand wallets holding`);

    } else if (whaleCount > 0 && netWhaleFlow > 0) {
        // SCENARIO: WHALE INTEREST (EARLY)
        sentiment = 'NEUTRAL';
        sentimentColor = 'BLUE';
        riskLevel = 'MEDIUM';
        summary = "👀 WATCH: Whales are interested but volume is low. Smart money is positioning early.";
        actionSuggestion = "Add to watchlist / Small test entry";
        keyInsights.push("Whale accumulation detected");

    } else {
        // SCENARIO: NEUTRAL / UNDECIDED
        summary = "⚪ NEUTRAL: No strong smart money signal detected yet. Market is undecided.";
        sentiment = 'NEUTRAL';
        sentimentColor = 'BLUE';
        riskLevel = 'MEDIUM';
        actionSuggestion = "Wait for signal";
    }

    // Generate insights
    if (breakdown.accumulators > 0) {
        keyInsights.push(`${breakdown.accumulators} top holder(s) actively accumulating`);
    }
    if (breakdown.diamondHands > 0) {
        keyInsights.push(`${breakdown.diamondHands} diamond hands holding strong`);
    }
    if (breakdown.paperHands > 0) {
        keyInsights.push(`⚠️ ${breakdown.paperHands} paper hands detected`);
    }
    if (netWhaleFlow !== 0) {
        keyInsights.push(`Whale net flow: ${netWhaleFlow > 0 ? '+' : ''}$${netWhaleFlow.toFixed(0)}`);
    }

    // Generate whale alert
    let whaleAlert: string | null = null;
    if (recentWhales.length > 0) {
        const biggestWhale = recentWhales.sort((a, b) => b.amountUsd - a.amountUsd)[0];
        if (biggestWhale.amountUsd > 50000) {
            whaleAlert = `🐋 Large ${biggestWhale.type.toUpperCase()} detected: $${biggestWhale.amountUsd.toFixed(0)}`;
        }
    }

    // Calculate confidence based on data points
    const bullishSignalCount = breakdown.accumulators + breakdown.diamondHands;
    const confidence = Math.min(90, 40 + (bullishSignalCount * 10));

    return {
        summary,
        sentiment,
        sentimentColor,
        confidence,
        keyInsights,
        riskLevel,
        actionSuggestion,
        holderBreakdown: breakdown,
        whaleAlert,
        cachedAt: new Date()
    };
}
