import { logger } from '../../utils/logger';
import { redis } from '../../cache/redis';
import OpenAI from 'openai';

/**
 * DEGEN INTELLIGENCE ENGINE
 * 
 * AI-powered analysis for degen trading:
 * 1. Narrative Rotation Tracker - Sector mindshare shifts
 * 2. Smart Wallet "Follow-the-Leader" - Top trader activity
 * 3. Automated Content & Sentiment Alerts - Community monitoring
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

export interface DegenIntelligence {
    // Narrative Rotation Tracker
    narrative: {
        currentSector: string;
        mindshare: number;  // 0-100
        trending: boolean;
        sectors: Array<{
            name: string;
            score: number;
            change24h: number;
            color: 'GREEN' | 'YELLOW' | 'RED' | 'GRAY';
        }>;
        heatmap: 'HOT' | 'WARM' | 'NEUTRAL' | 'COLD';
    };

    // Smart Wallet Analysis
    smartFlow: {
        score: number;       // 0-100
        recentEntries: number;
        recentExits: number;
        netFlow: number;     // USD
        topWallets: Array<{
            label: string;   // "90D Smart Trader", "Fund", "Sniper"
            action: 'BUY' | 'SELL';
            amount: number;
            timestamp: Date;
        }>;
        alert: string | null;
    };

    // Community Sentiment
    sentiment: {
        overall: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
        score: number;       // 0-100
        keyInsight: string;
        suggestedAction: string;
        sources: Array<{
            platform: 'TWITTER' | 'TELEGRAM' | 'REDDIT';
            sentiment: number; // -100 to 100
            activity: 'HIGH' | 'MEDIUM' | 'LOW';
        }>;
    };

    signals: string[];
    color: 'GREEN' | 'YELLOW' | 'RED';
}

// Sector definitions for narrative tracking
const SECTORS = [
    { name: 'AI_AGENTS', keywords: ['ai', 'agent', 'gpt', 'llm', 'bot', 'sentient'] },
    { name: 'MEMES', keywords: ['meme', 'doge', 'pepe', 'cat', 'dog', 'frog', 'based'] },
    { name: 'DEFI', keywords: ['defi', 'yield', 'lending', 'swap', 'amm', 'vault'] },
    { name: 'GAMEFI', keywords: ['game', 'nft', 'play', 'metaverse', 'gaming'] },
    { name: 'POLITIFI', keywords: ['trump', 'biden', 'politics', 'election', 'vote'] },
    { name: 'INFRA', keywords: ['chain', 'layer', 'bridge', 'oracle', 'infra'] }
];

export async function analyzeDegenIntelligence(
    tokenSymbol: string,
    tokenDescription: string | null,
    tokenId: string
): Promise<DegenIntelligence> {
    const signals: string[] = [];

    try {
        // 1. NARRATIVE ROTATION TRACKER
        const narrative = await analyzeNarrative(tokenSymbol, tokenDescription);
        if (narrative.trending) {
            signals.push(`🔥 ${narrative.currentSector} is HOT - ${narrative.mindshare}% mindshare`);
        }

        // 2. SMART WALLET ANALYSIS
        const smartFlow = await analyzeSmartFlow(tokenId);
        if (smartFlow.alert) {
            signals.push(smartFlow.alert);
        }
        if (smartFlow.score > 70) {
            signals.push(`💎 Strong smart money inflow: ${smartFlow.recentEntries} entries`);
        } else if (smartFlow.score < 30 && smartFlow.recentExits > 0) {
            signals.push(`⚠️ Smart money exiting: ${smartFlow.recentExits} sells`);
        }

        // 3. SENTIMENT ANALYSIS
        const sentiment = await analyzeSentiment(tokenSymbol);
        if (sentiment.keyInsight) {
            signals.push(`📊 ${sentiment.keyInsight}`);
        }

        // Determine overall color
        const avgScore = (narrative.mindshare + smartFlow.score + sentiment.score) / 3;
        let color: 'GREEN' | 'YELLOW' | 'RED' = 'YELLOW';
        if (avgScore > 65) color = 'GREEN';
        else if (avgScore < 35) color = 'RED';

        return {
            narrative,
            smartFlow,
            sentiment,
            signals,
            color
        };

    } catch (err: any) {
        logger.error({ tokenSymbol, err: err.message }, 'Degen intelligence analysis failed');
        return createDefaultIntelligence();
    }
}

async function analyzeNarrative(
    tokenSymbol: string,
    tokenDescription: string | null
): Promise<DegenIntelligence['narrative']> {
    // Cache key for sector data
    const cacheKey = 'narrative:sectors';

    // Try to get cached sector data
    const cached = await redis.get(cacheKey);
    let sectorScores: Map<string, { score: number; change: number }>;

    if (cached) {
        sectorScores = new Map(Object.entries(JSON.parse(cached)));
    } else {
        // Simulate sector analysis (in production: aggregate from X, Telegram, Reddit)
        sectorScores = new Map([
            ['AI_AGENTS', { score: 75, change: 15 }],
            ['MEMES', { score: 60, change: -5 }],
            ['DEFI', { score: 40, change: -10 }],
            ['GAMEFI', { score: 35, change: 5 }],
            ['POLITIFI', { score: 25, change: -20 }],
            ['INFRA', { score: 30, change: 0 }]
        ]);

        // Cache for 5 minutes
        await redis.setex(cacheKey, 300, JSON.stringify(Object.fromEntries(sectorScores)));
    }

    // Detect which sector this token belongs to
    const text = `${tokenSymbol} ${tokenDescription || ''}`.toLowerCase();
    let currentSector = 'MEMES'; // Default

    for (const sector of SECTORS) {
        if (sector.keywords.some(kw => text.includes(kw))) {
            currentSector = sector.name;
            break;
        }
    }

    // Build sector list for heatmap
    const sectors = Array.from(sectorScores.entries())
        .map(([name, data]) => ({
            name,
            score: data.score,
            change24h: data.change,
            color: (data.score > 60 ? 'GREEN' : data.score > 40 ? 'YELLOW' : data.score > 20 ? 'RED' : 'GRAY') as 'GREEN' | 'YELLOW' | 'RED' | 'GRAY'
        }))
        .sort((a, b) => b.score - a.score);

    const sectorData = sectorScores.get(currentSector) || { score: 50, change: 0 };
    const mindshare = sectorData.score;
    const trending = sectorData.change > 10;

    let heatmap: 'HOT' | 'WARM' | 'NEUTRAL' | 'COLD' = 'NEUTRAL';
    if (mindshare > 70) heatmap = 'HOT';
    else if (mindshare > 50) heatmap = 'WARM';
    else if (mindshare < 25) heatmap = 'COLD';

    return {
        currentSector,
        mindshare,
        trending,
        sectors,
        heatmap
    };
}

async function analyzeSmartFlow(tokenId: string): Promise<DegenIntelligence['smartFlow']> {
    // In production: Query labeled smart wallet database
    // Check for entries from known profitable traders

    const topWallets: DegenIntelligence['smartFlow']['topWallets'] = [];
    let recentEntries = 0;
    let recentExits = 0;
    let netFlow = 0;
    let alert: string | null = null;

    // Simulate smart wallet detection
    // In production, this would check a database of labeled wallets

    // Calculate score based on smart money activity
    const score = 50 + (recentEntries - recentExits) * 10;

    // Generate alert if significant activity
    if (recentEntries >= 3 && netFlow > 10000) {
        alert = `⚠️ Smart Money Entry: ${recentEntries} top-tier snipers bought $${(netFlow / 1000).toFixed(0)}k`;
    } else if (recentExits >= 3 && netFlow < -10000) {
        alert = `🔴 Smart Money Exit: ${recentExits} profitable wallets sold`;
    }

    return {
        score: Math.max(0, Math.min(100, score)),
        recentEntries,
        recentExits,
        netFlow,
        topWallets,
        alert
    };
}

async function analyzeSentiment(tokenSymbol: string): Promise<DegenIntelligence['sentiment']> {
    // In production: Use AI to analyze Twitter/Telegram/Reddit

    // Check cache first
    const cacheKey = `sentiment:${tokenSymbol.toLowerCase()}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
        return JSON.parse(cached);
    }

    // Default neutral sentiment
    const sentiment: DegenIntelligence['sentiment'] = {
        overall: 'NEUTRAL',
        score: 50,
        keyInsight: 'Monitoring community activity...',
        suggestedAction: 'Wait for clearer signals',
        sources: [
            { platform: 'TWITTER', sentiment: 0, activity: 'MEDIUM' },
            { platform: 'TELEGRAM', sentiment: 0, activity: 'LOW' },
            { platform: 'REDDIT', sentiment: 0, activity: 'LOW' }
        ]
    };

    // Use OpenAI if available for sentiment
    if (openai) {
        try {
            const completion = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `You are a crypto sentiment analyst. Analyze the token "${tokenSymbol}" and provide:
                        1. Overall sentiment (BULLISH, BEARISH, or NEUTRAL)
                        2. A score from 0-100 (0=extremely bearish, 100=extremely bullish)
                        3. A brief key insight about current market perception
                        4. A suggested trading action
                        
                        Respond with JSON only: {"overall": "...", "score": N, "keyInsight": "...", "suggestedAction": "..."}`
                    },
                    { role: 'user', content: `Analyze sentiment for ${tokenSymbol}` }
                ],
                max_tokens: 200,
                temperature: 0.3
            });

            const content = completion.choices[0]?.message?.content || '';
            const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();

            try {
                const parsed = JSON.parse(cleanContent);
                sentiment.overall = parsed.overall || 'NEUTRAL';
                sentiment.score = parsed.score || 50;
                sentiment.keyInsight = parsed.keyInsight || sentiment.keyInsight;
                sentiment.suggestedAction = parsed.suggestedAction || sentiment.suggestedAction;
            } catch (parseErr) {
                // Use defaults
            }
        } catch (aiErr: any) {
            logger.warn({ err: aiErr.message }, 'AI sentiment analysis failed');
        }
    }

    // Cache for 5 minutes
    await redis.setex(cacheKey, 300, JSON.stringify(sentiment));

    return sentiment;
}

function createDefaultIntelligence(): DegenIntelligence {
    return {
        narrative: {
            currentSector: 'UNKNOWN',
            mindshare: 0,
            trending: false,
            sectors: [],
            heatmap: 'NEUTRAL'
        },
        smartFlow: {
            score: 50,
            recentEntries: 0,
            recentExits: 0,
            netFlow: 0,
            topWallets: [],
            alert: null
        },
        sentiment: {
            overall: 'NEUTRAL',
            score: 50,
            keyInsight: 'Analysis unavailable',
            suggestedAction: 'Proceed with caution',
            sources: []
        },
        signals: ['Degen intelligence unavailable'],
        color: 'YELLOW'
    };
}
