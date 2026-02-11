import { prisma } from '../models/prisma';
import { logger } from '../utils/logger';
import { redis } from '../cache/redis';
import { calculateMomentum, getColorTier, ColorTier } from './scoring/momentumEngine';
import { calculateConviction } from './scoring/convictionEngine';
import { calculateThreat } from './scoring/threatEngine';
import { calculateAlpha } from './scoring/alphaEngine';
import { helius, HolderPattern, WhaleActivity } from './helius/client';
import { aiAnalyzer, AIAnalysis } from './ai/analyzer';
import { analyzeDevBehavior, DevProfile } from './scoring/devProfileEngine';
import { analyzeMarketIntegrity, MarketIntegrity } from './scoring/marketIntegrityEngine';
import { analyzeDegenIntelligence, DegenIntelligence } from './scoring/degenIntelEngine';
import { calculateEdgeScore, EdgeScore } from './scoring/edgeScoreEngine';
import { analyzeWallets, WalletAnalysisResult } from './analysis/walletEngine';
import { socialEngine } from './scoring/socialEngine';

export interface TokenIntelligenceDTO {
    header: {
        priceUsd: number;
        liquidityUsd: number;
        fdv: number;
        marketCap: number;
        volume24h: number;
        pairAge: string;
        dexId: string;
        baseToken: { symbol: string; name: string; };
    };
    momentum: {
        score: number;
        phase: string;
        color: ColorTier;
        label: string;
        signals: string[];
        rawMomentum: number;
        priceChange24h: number;
        volumeChange24h: number;
    };
    conviction: {
        score: number;
        color: ColorTier;
        liquidityRatio: number;
        volumeToMcRatio: number;
        repeatBuyers: number;
        smartWalletEntries: number;
        avgPositionSize: number;
        buyPressure: number;
        signals: string[];
    };
    alpha: {
        score: string;
        numericScore: number;
        color: ColorTier;
        breakdown: { momentum: number; conviction: number; safety: number; };
        signals: string[];
    };
    threat: {
        score: number;
        safetyScore: number;
        level: string;
        color: ColorTier;
        warnings: string[];
    };
    holderPatterns: {
        patterns: Array<{
            rank: number;
            address: string;
            percentage: number;
            pattern: string;
            sentiment: 'GREEN' | 'RED' | 'BLUE';
            recentBuys: number;
            recentSells: number;
        }>;
        summary: { accumulators: number; diamondHands: number; paperHands: number; whales: number; };
    };
    whaleActivity: {
        recent: Array<{ wallet: string; type: 'buy' | 'sell'; amountUsd: number; timestamp: string; isSmartMoney: boolean; }>;
        netFlow: number;
        alert: string | null;
    };
    aiAnalysis: {
        summary: string;
        sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
        sentimentColor: 'GREEN' | 'RED' | 'BLUE';
        confidence: number;
        keyInsights: string[];
        riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
        actionSuggestion: string;
        whaleAlert: string | null;
        cachedAt: string | null;
    };
    // NEW: Developer Behavioral Profiling
    devProfile: {
        reputation: {
            score: number;
            label: string;
            previousProjects: number;
            ruggedProjects: number;
            successfulProjects: number;
        };
        drainAlert: { triggered: boolean; devSoldPercent: number; timeSinceLaunch: number; };
        bundleRisk: { score: number; giniCoefficient: number; clusteredWallets: number; };
        signals: string[];
        color: 'GREEN' | 'YELLOW' | 'RED';
    };
    // NEW: Market Integrity Engines
    marketIntegrity: {
        overallScore: number;
        washTrading: {
            detected: boolean;
            washVolumePercent: number;
            realVolume: number;
            reportedVolume: number;
            color: 'GREEN' | 'ORANGE' | 'RED';
        };
        collusiveNetwork: { detected: boolean; walletsInClusters: number; controlledSupplyPercent: number; };
        volumeAudit: { isOrganic: boolean; botProbability: number; timeDistribution: string; };
        signals: string[];
        color: 'GREEN' | 'YELLOW' | 'RED';
    };
    // NEW: AI-Powered Degen Intelligence
    degenIntel: {
        narrative: {
            currentSector: string;
            mindshare: number;
            trending: boolean;
            sectors: Array<{ name: string; score: number; change24h: number; color: string; }>;
            heatmap: string;
        };
        smartFlow: {
            score: number;
            recentEntries: number;
            recentExits: number;
            netFlow: number;
            alert: string | null;
        };
        sentiment: {
            overall: string;
            score: number;
            keyInsight: string;
            suggestedAction: string;
        };
        signals: string[];
        color: 'GREEN' | 'YELLOW' | 'RED';
    };
    // NEW: Edge Score (Master Composite)
    edgeScore: {
        score: number;
        level: string;
        color: string;
        breakdown: {
            safety: { score: number; weight: number; contribution: number; };
            narrative: { score: number; weight: number; contribution: number; };
            smartFlow: { score: number; weight: number; contribution: number; };
            marketIntegrity: { score: number; weight: number; contribution: number; };
        };
        topSignals: string[];
        riskFactors: string[];
        bullishFactors: string[];
        recommendation: { action: string; reason: string; confidence: number; };
    };
    // NEW: Trend Radar (Social Intelligence)
    socialIntel: {
        hypeScore: number;
        narrative: string;
        socialVolume: number;
        acceleration: number;
        topInfluencers: string[];
    };
    aiInsight: { summary: string | null; cachedAt: Date | null; };
}

/**
 * Intelligence Aggregator
 * Orchestrates all scoring engines
 * 
 * Alpha Formula: (Momentum × 0.40) + (Conviction × 0.35) + (Safety × 0.25)
 * Edge Formula: (Safety × 0.30) + (Narrative × 0.20) + (SmartFlow × 0.30) + (MarketIntegrity × 0.20)
 */
export async function aggregateTokenIntelligence(tokenId: string): Promise<TokenIntelligenceDTO> {
    const startTime = Date.now();

    try {
        const cacheKey = `intelligence:v3:${tokenId}`;
        const cached = await redis.get(cacheKey);
        if (cached) {
            logger.info({ tokenId, duration: Date.now() - startTime, cached: true }, 'Intelligence served from cache');
            return JSON.parse(cached);
        }

        const token = await prisma.token.findUnique({
            where: { id: tokenId },
            include: { snapshots: { orderBy: { timestamp: 'desc' }, take: 1 } }
        });

        if (!token) throw new Error('Token not found');

        const latestSnapshot = token.snapshots[0];
        const pairAge = token.pairCreatedAt ? formatAge(new Date(token.pairCreatedAt)) : 'Unknown';

        const marketData = {
            price: latestSnapshot ? Number(latestSnapshot.price) : Number(token.price),
            priceChange24h: latestSnapshot ? Number(latestSnapshot.priceChange24h || 0) : 0,
            volume24h: latestSnapshot ? Number(latestSnapshot.volume) : Number(token.volume24h),
            liquidity: latestSnapshot ? Number(latestSnapshot.liquidity) : Number(token.liquidity),
            marketCap: latestSnapshot ? Number(latestSnapshot.marketCap) : Number(token.marketCap)
        };

        // Run CORE scoring engines in parallel
        const [momentum, conviction, threat] = await Promise.all([
            calculateMomentum(tokenId),
            calculateConviction(tokenId),
            calculateThreat(tokenId)
        ]);

        const alpha = calculateAlpha(momentum, conviction, threat);

        // Run ADVANCED engines in parallel
        const [devProfile, marketIntegrity, degenIntel, walletAnalysis, socialIntel] = await Promise.all([
            analyzeDevBehavior(
                (token as any).creatorAddress || null,
                token.contract,
                token.pairCreatedAt ? new Date(token.pairCreatedAt) : null
            ).catch(err => {
                logger.warn({ err: err.message }, 'Dev profile analysis failed');
                return createDefaultDevProfile();
            }),
            analyzeMarketIntegrity(tokenId).catch(err => {
                logger.warn({ err: err.message }, 'Market integrity analysis failed');
                return createDefaultMarketIntegrity();
            }),
            analyzeDegenIntelligence(token.ticker, token.name, tokenId).catch(err => {
                logger.warn({ err: err.message }, 'Degen intelligence analysis failed');
                return createDefaultDegenIntel();
            }),
            analyzeWallets(tokenId).catch(err => {
                logger.warn({ err: err.message }, 'Wallet analysis failed');
                return createDefaultWalletAnalysis();
            }),
            socialEngine.analyzeSocials(token.ticker).catch(err => {
                logger.warn({ err: err.message }, 'Social analysis failed');
                return {
                    hypeScore: 50,
                    narrative: 'Unknown',
                    socialVolume: 0,
                    acceleration: 0,
                    topInfluencers: []
                };
            })
        ]);

        // Calculate Edge Score
        const edgeScore = calculateEdgeScore(threat, devProfile, marketIntegrity, degenIntel);

        // Helius data (holder patterns & whale activity)
        let holderPatterns: HolderPattern[] = [];
        let whaleActivity: WhaleActivity[] = [];
        let aiAnalysis: AIAnalysis | null = null;

        try {
            if (token.contract) {
                const [patterns, whales] = await Promise.all([
                    helius.analyzeHolderPatterns(token.contract).catch(() => []),
                    helius.detectWhaleActivity(token.contract, 5000).catch(() => [])
                ]);
                holderPatterns = patterns;
                whaleActivity = whales;

                aiAnalysis = await aiAnalyzer.analyzeToken(
                    token.ticker, token.contract, holderPatterns, whaleActivity, marketData
                ).catch(() => null);
            }
        } catch (err: any) {
            logger.warn({ err: err.message }, 'Helius integration failed');
        }

        const netWhaleFlow = whaleActivity.reduce((sum, w) => sum + (w.type === 'buy' ? w.amountUsd : -w.amountUsd), 0);

        const intelligence: TokenIntelligenceDTO = {
            header: {
                priceUsd: marketData.price,
                liquidityUsd: marketData.liquidity,
                fdv: latestSnapshot ? Number(latestSnapshot.fdv || 0) : 0,
                marketCap: marketData.marketCap,
                volume24h: marketData.volume24h,
                pairAge,
                dexId: token.dexId || 'birdeye',
                baseToken: { symbol: token.ticker, name: token.name }
            },
            momentum: {
                score: momentum.score,
                phase: momentum.phase,
                color: momentum.color,
                label: momentum.label,
                signals: momentum.signals,
                rawMomentum: momentum.rawMomentum || 0,
                priceChange24h: momentum.priceChange24h || 0,
                volumeChange24h: momentum.volumeChange24h || 0
            },
            conviction: {
                score: conviction.score,
                color: conviction.color,
                liquidityRatio: conviction.liquidityRatio,
                volumeToMcRatio: conviction.volumeToMcRatio,
                repeatBuyers: conviction.repeatBuyers,
                smartWalletEntries: conviction.smartWalletEntries,
                avgPositionSize: conviction.avgPositionSize,
                buyPressure: conviction.buyPressure,
                signals: conviction.signals
            },
            alpha: {
                score: alpha.score,
                numericScore: alpha.numericScore,
                color: alpha.color,
                breakdown: alpha.breakdown,
                signals: alpha.signals
            },
            threat: {
                score: threat.score,
                safetyScore: threat.safetyScore,
                level: threat.level,
                color: threat.color,
                warnings: threat.warnings
            },
            holderPatterns: {
                patterns: walletAnalysis.topWallets.map((w, i) => ({
                    rank: i + 1,
                    address: shortenAddress(w.address),
                    percentage: 0, // Mock for now, would be real %
                    pattern: w.label,
                    sentiment: w.riskScore > 80 ? 'GREEN' : w.riskScore > 50 ? 'BLUE' : 'RED',
                    recentBuys: 0,
                    recentSells: 0
                })),
                summary: {
                    accumulators: walletAnalysis.topWallets.filter(w => w.label === 'MINT_SNIPER').length,
                    diamondHands: walletAnalysis.topWallets.filter(w => w.label === 'DIAMOND_HANDS').length,
                    paperHands: walletAnalysis.topWallets.filter(w => w.label === 'JEETER').length,
                    whales: walletAnalysis.topWallets.filter(w => w.label === 'WHALE').length
                }
            },
            whaleActivity: {
                recent: [], // Keep empty or merge if needed
                netFlow: walletAnalysis.smartMoneyInflow.netFlow,
                alert: walletAnalysis.smartMoneyInflow.label === 'ACCUMULATING' ? 'Whales Accumulating' : null
            },
            aiAnalysis: aiAnalysis ? {
                summary: aiAnalysis.summary,
                sentiment: aiAnalysis.sentiment,
                sentimentColor: aiAnalysis.sentimentColor,
                confidence: aiAnalysis.confidence,
                keyInsights: aiAnalysis.keyInsights,
                riskLevel: aiAnalysis.riskLevel,
                actionSuggestion: aiAnalysis.actionSuggestion,
                whaleAlert: aiAnalysis.whaleAlert,
                cachedAt: aiAnalysis.cachedAt?.toISOString() || null
            } : {
                summary: 'AI analysis unavailable',
                sentiment: 'NEUTRAL',
                sentimentColor: 'BLUE',
                confidence: 0,
                keyInsights: [],
                riskLevel: 'MEDIUM',
                actionSuggestion: 'Insufficient data',
                whaleAlert: null,
                cachedAt: null
            },
            devProfile: {
                reputation: {
                    score: devProfile.reputation.score,
                    label: devProfile.reputation.label,
                    previousProjects: devProfile.reputation.previousProjects,
                    ruggedProjects: devProfile.reputation.ruggedProjects,
                    successfulProjects: devProfile.reputation.successfulProjects
                },
                drainAlert: {
                    triggered: devProfile.drainAlert.triggered,
                    devSoldPercent: devProfile.drainAlert.devSoldPercent,
                    timeSinceLaunch: devProfile.drainAlert.timeSinceLaunch
                },
                bundleRisk: {
                    score: devProfile.bundleRisk.score,
                    giniCoefficient: devProfile.bundleRisk.giniCoefficient,
                    clusteredWallets: devProfile.bundleRisk.clusteredWallets
                },
                signals: devProfile.signals,
                color: devProfile.color
            },
            marketIntegrity: {
                overallScore: marketIntegrity.overallScore,
                washTrading: {
                    detected: marketIntegrity.washTrading.detected,
                    washVolumePercent: marketIntegrity.washTrading.washVolumePercent,
                    realVolume: marketIntegrity.washTrading.realVolume,
                    reportedVolume: marketIntegrity.washTrading.reportedVolume,
                    color: marketIntegrity.washTrading.color
                },
                collusiveNetwork: {
                    detected: marketIntegrity.collusiveNetwork.detected,
                    walletsInClusters: marketIntegrity.collusiveNetwork.walletsInClusters,
                    controlledSupplyPercent: marketIntegrity.collusiveNetwork.controlledSupplyPercent
                },
                volumeAudit: {
                    isOrganic: marketIntegrity.volumeAudit.isOrganic,
                    botProbability: marketIntegrity.volumeAudit.botProbability,
                    timeDistribution: marketIntegrity.volumeAudit.timeDistribution
                },
                signals: marketIntegrity.signals,
                color: marketIntegrity.color
            },
            degenIntel: {
                narrative: {
                    currentSector: degenIntel.narrative.currentSector,
                    mindshare: degenIntel.narrative.mindshare,
                    trending: degenIntel.narrative.trending,
                    sectors: degenIntel.narrative.sectors,
                    heatmap: degenIntel.narrative.heatmap
                },
                smartFlow: {
                    score: degenIntel.smartFlow.score,
                    recentEntries: degenIntel.smartFlow.recentEntries,
                    recentExits: degenIntel.smartFlow.recentExits,
                    netFlow: degenIntel.smartFlow.netFlow,
                    alert: degenIntel.smartFlow.alert
                },
                sentiment: {
                    overall: degenIntel.sentiment.overall,
                    score: degenIntel.sentiment.score,
                    keyInsight: degenIntel.sentiment.keyInsight,
                    suggestedAction: degenIntel.sentiment.suggestedAction
                },
                signals: degenIntel.signals,
                color: degenIntel.color
            },
            edgeScore: {
                score: edgeScore.score,
                level: edgeScore.level,
                color: edgeScore.color,
                breakdown: edgeScore.breakdown,
                topSignals: edgeScore.topSignals,
                riskFactors: edgeScore.riskFactors,
                bullishFactors: edgeScore.bullishFactors,
                recommendation: edgeScore.recommendation
            },
            socialIntel: {
                hypeScore: socialIntel.hypeScore,
                narrative: socialIntel.narrative,
                socialVolume: socialIntel.socialVolume,
                acceleration: socialIntel.acceleration,
                topInfluencers: socialIntel.topInfluencers
            },
            aiInsight: { summary: token.aiSummary, cachedAt: token.aiSummaryUpdated }
        };

        const duration = Date.now() - startTime;
        logger.info({
            tokenId, duration,
            alpha: alpha.numericScore,
            edge: edgeScore.score,
            sentiment: aiAnalysis?.sentiment
        }, 'Intelligence aggregation completed');

        await redis.setex(cacheKey, 60, JSON.stringify(intelligence));
        return intelligence;

    } catch (err: any) {
        logger.error({ tokenId, err: err.message }, 'Intelligence aggregation failed');
        throw err;
    }
}

function formatAge(date: Date): string {
    const diffMs = Date.now() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays > 0) return `${diffDays}d`;
    if (diffHours > 0) return `${diffHours}h`;
    return '<1h';
}

function shortenAddress(address: string): string {
    if (!address || address.length < 10) return address || 'Unknown';
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function createDefaultDevProfile(): DevProfile {
    return {
        reputation: { score: 50, label: 'UNKNOWN', previousProjects: 0, ruggedProjects: 0, successfulProjects: 0, history: [] },
        drainAlert: { triggered: false, devSoldPercent: 0, timeSinceLaunch: 0, transactions: [] },
        bundleRisk: { score: 0, giniCoefficient: 0, clusteredWallets: 0, clusteredSupplyPercent: 0, suspiciousBlocks: 0, alerts: [] },
        signals: ['Dev analysis unavailable'],
        color: 'YELLOW'
    };
}

function createDefaultMarketIntegrity(): MarketIntegrity {
    return {
        overallScore: 70,
        washTrading: { detected: false, washVolumePercent: 0, realVolume: 0, reportedVolume: 0, flaggedTransactions: 0, color: 'GREEN' },
        collusiveNetwork: { detected: false, clusterCount: 0, walletsInClusters: 0, controlledSupplyPercent: 0, networkGraph: [] },
        volumeAudit: { isOrganic: true, botProbability: 0, variance: 100, repeatedSizes: 0, timeDistribution: 'ORGANIC' },
        signals: ['Market analysis unavailable'],
        color: 'YELLOW'
    };
}

function createDefaultDegenIntel(): DegenIntelligence {
    return {
        narrative: { currentSector: 'UNKNOWN', mindshare: 50, trending: false, sectors: [], heatmap: 'NEUTRAL' },
        smartFlow: { score: 50, recentEntries: 0, recentExits: 0, netFlow: 0, topWallets: [], alert: null },
        sentiment: { overall: 'NEUTRAL', score: 50, keyInsight: 'Analysis unavailable', suggestedAction: 'Proceed with caution', sources: [] },
        signals: ['Degen intel unavailable'],
        color: 'YELLOW'
    };
}

function createDefaultWalletAnalysis(): WalletAnalysisResult {
    return {
        topWallets: [],
        concentration: { top10: 0, top20: 0, score: 0 },
        smartMoneyInflow: { score: 0, netFlow: 0, label: 'NEUTRAL' }
    };
}
