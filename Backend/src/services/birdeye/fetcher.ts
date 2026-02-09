import { request } from 'undici';
import { logger } from '../../utils/logger';
import { env } from '../../config/env';
import type { BirdeyeTokenListResponse, BirdeyeTokenListItem } from './types';
import { fetcher as dexScreenerFetcher } from '../dexscreener/fetcher';
import { fetcher as gmgnFetcher } from '../gmgn/fetcher';
import { mockService } from '../mockTokenService';

const API_BASE = env.BIRDEYE_API_URL || 'https://public-api.birdeye.so';
const TIMEOUT_MS = 15000;
const MAX_RETRIES = 3;
const MAX_TOKENS_PER_REQUEST = 50; // Birdeye's limit per request

// Rate limiter - max 5 requests per second for free tier
const MIN_REQUEST_INTERVAL_MS = 200; // 5 req/sec
let lastRequestTime = 0;
let rateLimitHit = false;
let rateLimitResetTime = 0;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Throttle requests to respect API limits
async function throttle(): Promise<void> {
    const now = Date.now();

    // Check if we're in rate limit cooldown
    if (rateLimitHit && now < rateLimitResetTime) {
        const waitTime = rateLimitResetTime - now;
        logger.warn({ waitTime }, 'Rate limit in effect, waiting...');
        await sleep(waitTime);
        rateLimitHit = false;
    }

    // Ensure minimum interval between requests
    const elapsed = now - lastRequestTime;
    if (elapsed < MIN_REQUEST_INTERVAL_MS) {
        await sleep(MIN_REQUEST_INTERVAL_MS - elapsed);
    }

    lastRequestTime = Date.now();
}

// Simple in-memory cache
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30 * 1000; // 30 seconds cache

// DexScreener fallback import (dynamic or robust check)
// logic to come next

export const fetcher = {
    /**
     * Check if API is rate limited
     */
    isRateLimited: (): boolean => {
        return rateLimitHit && Date.now() < rateLimitResetTime;
    },

    getCached: <T>(key: string): T | null => {
        const cached = cache.get(key);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            return cached.data;
        }
        return null;
    },

    setCache: (key: string, data: any) => {
        cache.set(key, { data, timestamp: Date.now() });
    },

    /**
     * Fetch ALL tokens from Birdeye that match the criteria
     * Uses pagination to retrieve all matching tokens, not just the first page
     * Uses V3 API with proper filters and sorting
     */
    fetchAllTokens: async (options: {
        minLiquidity?: number;
        minVolume24h?: number;
        minMarketCap?: number;
        sortBy?: string;
        sortType?: string;
    } = {}): Promise<BirdeyeTokenListItem[]> => {
        const {
            minLiquidity = 20000,    // $20K minimum liquidity
            minVolume24h = 5000,     // $5K minimum volume
            minMarketCap = 10000,    // $10K minimum market cap
            sortBy = 'liquidity',    // Sort by liquidity (most liquid first)
            sortType = 'desc'        // Descending order
        } = options;

        const cacheKey = `all_tokens:${minLiquidity}:${minVolume24h}:${minMarketCap}:${sortBy}:${sortType}`;
        const cached = fetcher.getCached<BirdeyeTokenListItem[]>(cacheKey);
        if (cached) {
            logger.info({ count: cached.length }, 'Using cached Birdeye token list');
            return cached;
        }

        // FALLBACK: If rate limited, try GMGN first, then DexScreener
        if (fetcher.isRateLimited()) {
            logger.warn('Birdeye API limited, switching to GMGN fallback');
            const gmgnTokens = await fetchFromGmgnFallback();
            if (gmgnTokens.length > 0) return gmgnTokens;

            logger.warn('GMGN fallback failed/empty, switching to DexScreener');
            return await fetchFromDexScreenerFallback();
        }

        const allTokens: BirdeyeTokenListItem[] = [];
        let offset = 0;
        let hasMore = true;
        let consecutiveErrors = 0;
        let usedFallback = false;

        logger.info({
            minVolume24h,
            minMarketCap,
            minLiquidity,
            sortBy,
            sortType
        }, '🚀 Starting Birdeye V3 token fetch');

        while (hasMore && consecutiveErrors < 3) {
            try {
                await throttle();

                // Build V3 API query parameters with all filters
                const params = new URLSearchParams({
                    offset: offset.toString(),
                    limit: MAX_TOKENS_PER_REQUEST.toString(),
                    sort_by: sortBy,
                    sort_type: sortType
                });

                // Add server-side filters
                if (minVolume24h > 0) {
                    params.append('min_volume_24h_usd', minVolume24h.toString());
                }
                if (minMarketCap > 0) {
                    params.append('min_mc', minMarketCap.toString());
                }
                if (minLiquidity > 0) {
                    params.append('min_liquidity', minLiquidity.toString());
                }

                const endpoint = `/defi/v3/token/list?${params.toString()}`;
                logger.info({ endpoint, offset }, '📡 Fetching from Birdeye V3');

                const response = await fetchWithRetry<BirdeyeTokenListResponse>(endpoint);

                if (!response?.success || !response?.data?.items) {
                    logger.warn({ offset }, 'No tokens returned from Birdeye');
                    break;
                }

                const tokens = response.data.items;
                allTokens.push(...tokens);
                consecutiveErrors = 0; // Reset on success

                logger.info({
                    batchSize: tokens.length,
                    totalFetched: allTokens.length,
                    hasNext: response.data.has_next,
                    offset
                }, 'Fetched batch from Birdeye');

                // Check if we've fetched all available tokens
                if (tokens.length < MAX_TOKENS_PER_REQUEST || !response.data.has_next) {
                    hasMore = false;
                } else {
                    offset += MAX_TOKENS_PER_REQUEST;
                    // Longer delay between batch requests
                    await sleep(1500);
                }

            } catch (err: any) {
                consecutiveErrors++;
                logger.error({ err: err.message, offset, consecutiveErrors }, 'Birdeye batch fetch failed');

                // If rate limited, stop immediately
                if (err.message?.includes('Compute units') || err.message?.includes('rate limit')) {
                    rateLimitHit = true;
                    rateLimitResetTime = Date.now() + 60000; // 1 minute cooldown
                    hasMore = false;
                    usedFallback = true;
                }
            }
        }

        // If we failed completely or switched to fallback, try GMGN then DexScreener then Mock
        if (allTokens.length === 0 && (usedFallback || consecutiveErrors >= 3)) {
            logger.warn('Birdeye fetch failed/limited, executing GMGN fallback');
            const gmgnTokens = await fetchFromGmgnFallback();
            if (gmgnTokens.length > 0) {
                fetcher.setCache(cacheKey, gmgnTokens);
                return gmgnTokens;
            }

            logger.warn('GMGN fallback failed, executing DexScreener fallback');
            const dexTokens = await fetchFromDexScreenerFallback();
            if (dexTokens.length > 0) {
                fetcher.setCache(cacheKey, dexTokens);
                return dexTokens;
            }

            logger.warn('All external APIs failed (Network Disabled?), using MOCK DATA');
            const mockTokens = await mockService.fetchTokens({
                min_liquidity: minLiquidity,
                min_volume_24h_usd: minVolume24h,
                min_mc: minMarketCap
            });

            const mappedMockTokens = mockTokens.map(t => ({
                address: t.address,
                decimals: 9,
                liquidity: t.liquidity,
                logo_uri: t.logo,
                market_cap: t.marketCap,
                name: t.name,
                symbol: t.symbol,
                volume_24h_usd: t.volume24h,
                volume_24h_change_percent: t.volumeChange24h,
                price: t.price,
                price_change_24h_percent: t.priceChange24h,
                fdv: t.marketCap
            }));

            fetcher.setCache(cacheKey, mappedMockTokens);
            return mappedMockTokens;
        }

        logger.info({
            totalTokens: allTokens.length,
            minVolume24h,
            minMarketCap
        }, 'Completed comprehensive token fetch from Birdeye');

        if (allTokens.length > 0) {
            fetcher.setCache(cacheKey, allTokens);
        }

        return allTokens;
    },

    /**
     * Legacy method for backward compatibility
     * Now calls fetchAllTokens internally
     */
    fetchTokenList: async (options: {
        minLiquidity?: number;
        minVolume24h?: number;
        limit?: number;
        offset?: number;
    } = {}): Promise<BirdeyeTokenListItem[]> => {
        // If limit is specified and small, fetch only that many
        if (options.limit && options.limit < 1000) {
            return fetcher.fetchSinglePage(options);
        }

        // Otherwise fetch all tokens
        return fetcher.fetchAllTokens({
            minLiquidity: options.minLiquidity,
            minVolume24h: options.minVolume24h
        });
    },

    /**
     * Fetch a single page of tokens (for specific use cases)
     */
    fetchSinglePage: async (options: {
        minLiquidity?: number;
        minVolume24h?: number;
        minMarketCap?: number;
        limit?: number;
        offset?: number;
    } = {}): Promise<BirdeyeTokenListItem[]> => {
        if (fetcher.isRateLimited()) {
            return [];
        }

        const {
            minLiquidity = 2000,
            minVolume24h = 200000,
            minMarketCap = 100000,
            limit = 50,
            offset = 0
        } = options;

        try {
            await throttle();

            const params = new URLSearchParams({
                offset: offset.toString(),
                limit: limit.toString(),
            });

            if (minVolume24h > 0) {
                params.append('min_volume_24h_usd', minVolume24h.toString());
            }
            if (minMarketCap > 0) {
                params.append('min_market_cap', minMarketCap.toString());
            }
            if (minLiquidity > 0) {
                params.append('min_liquidity', minLiquidity.toString());
            }

            const endpoint = `/defi/v3/token/list?${params.toString()}`;
            const response = await fetchWithRetry<BirdeyeTokenListResponse>(endpoint);

            if (!response?.success || !response?.data?.items) {
                logger.warn({ offset, limit }, 'No tokens returned from Birdeye');
                return [];
            }

            return response.data.items;
        } catch (err: any) {
            logger.error({ err: err.message }, 'Birdeye token list fetch failed');
            return [];
        }
    },

    /**
     * Fetch specific token overview with cache
     */
    fetchTokenOverview: async (tokenAddress: string): Promise<TokenOverviewData | null> => {
        const cacheKey = `overview:${tokenAddress}`;
        const cached = fetcher.getCached<TokenOverviewData>(cacheKey);
        if (cached) {
            logger.info({ tokenAddress }, '✅ Token overview fetched from cache');
            return cached;
        }

        if (fetcher.isRateLimited()) {
            logger.warn({ tokenAddress }, 'Birdeye API rate limited, returning null for overview');
            return null;
        }

        try {
            await throttle();
            const endpoint = `/defi/token_overview?address=${tokenAddress}`;
            logger.info({ tokenAddress, endpoint }, '📊 Fetching token overview from Birdeye');
            const response = await fetchWithRetry<TokenOverviewResponse>(endpoint);

            if (!response?.success || !response?.data) {
                logger.warn({ tokenAddress }, 'No overview data returned from Birdeye');
                return null;
            }

            logger.info({
                tokenAddress,
                symbol: response.data.symbol,
                price: response.data.price,
                mc: response.data.mc,
                liquidity: response.data.liquidity
            }, '✅ Token overview fetched successfully');

            fetcher.setCache(cacheKey, response.data);
            return response.data;
        } catch (err: any) {
            logger.warn({ tokenAddress, err: err.message }, '❌ Failed to fetch token overview');
            return null;
        }
    },

    /**
     * Fetch token security data with cache
     */
    fetchTokenSecurity: async (tokenAddress: string): Promise<TokenSecurityData | null> => {
        const cacheKey = `security:${tokenAddress}`;
        const cached = fetcher.getCached<TokenSecurityData>(cacheKey);
        if (cached) {
            logger.info({ tokenAddress }, '🔒 Token security fetched from cache');
            return cached;
        }

        if (fetcher.isRateLimited()) {
            logger.warn({ tokenAddress }, 'Birdeye API rate limited, returning null for security');
            return null;
        }

        try {
            await throttle();
            const endpoint = `/defi/token_security?address=${tokenAddress}`;
            logger.info({ tokenAddress }, '🔒 Fetching token security from Birdeye');
            const response = await fetchWithRetry<TokenSecurityResponse>(endpoint);

            if (!response?.success || !response?.data) {
                logger.warn({ tokenAddress }, 'No security data returned from Birdeye');
                return null;
            }

            logger.info({
                tokenAddress,
                ownerBalance: response.data.ownerBalance,
                creatorBalance: response.data.creatorBalance,
                top10HolderPercent: response.data.top10HolderPercent
            }, '✅ Token security fetched successfully');

            fetcher.setCache(cacheKey, response.data);
            return response.data;
        } catch (err: any) {
            logger.warn({ tokenAddress, err: err.message }, '❌ Failed to fetch token security');
            return null;
        }
    },

    /**
     * Fetch market data for a specific token (legacy compatibility)
     */
    fetchTokenMarketData: async (tokenAddress: string): Promise<BirdeyeTokenListItem | null> => {
        if (fetcher.isRateLimited()) {
            return null;
        }

        try {
            await throttle();

            // Use token overview for single token lookups
            const overview = await fetcher.fetchTokenOverview(tokenAddress);
            if (!overview) return null;

            // Convert to BirdeyeTokenListItem format
            return {
                address: overview.address,
                decimals: overview.decimals || 9,
                liquidity: overview.liquidity || 0,
                logo_uri: overview.logoURI,
                market_cap: overview.mc || 0,
                name: overview.name,
                symbol: overview.symbol,
                volume_24h_usd: overview.v24hUSD || 0,
                volume_24h_change_percent: overview.v24hChangePercent,
                price: overview.price || 0,
                price_change_24h_percent: overview.priceChange24hPercent,
                fdv: overview.fdv
            };

        } catch (err: any) {
            logger.warn({ tokenAddress, err: err.message }, 'Failed to fetch token market data');
            return null;
        }
    }
};

// Type for token overview response
interface TokenOverviewData {
    address: string;
    decimals?: number;
    name: string;
    symbol: string;
    price: number;
    priceChange24hPercent?: number;
    priceChange1hPercent?: number;
    priceChange7dPercent?: number;
    liquidity?: number;
    mc?: number;
    fdv?: number;
    v24hUSD?: number;
    v24hChangePercent?: number;
    holder?: number;
    logoURI?: string;
    extensions?: {
        website?: string;
        twitter?: string;
        telegram?: string;
    };
}

interface TokenOverviewResponse {
    success: boolean;
    data: TokenOverviewData;
}

// Type for token security response
interface TokenSecurityData {
    ownerAddress?: string;
    ownerBalance?: number;
    ownerPercentage?: number;
    creatorAddress?: string;
    creatorBalance?: number;
    creatorPercentage?: number;
    mintAuthority?: string;
    freezeAuthority?: string;
    isToken2022?: boolean;
    isMutable?: boolean;
    top10HolderPercent?: number;
    top10HolderBalance?: number;
}

interface TokenSecurityResponse {
    success: boolean;
    data: TokenSecurityData;
}

async function fetchWithRetry<T>(endpoint: string, retries = 0): Promise<T> {
    const url = `${API_BASE}${endpoint}`;

    try {
        const { statusCode, body } = await request(url, {
            method: 'GET',
            headers: {
                'X-API-KEY': env.BIRDEYE_API_KEY,
                'x-chain': 'solana',
                'Accept': 'application/json'
            },
            headersTimeout: TIMEOUT_MS,
            bodyTimeout: TIMEOUT_MS
        });

        if (statusCode === 429) {
            // Rate limit hit
            rateLimitHit = true;
            rateLimitResetTime = Date.now() + 60000; // 1 minute cooldown
            throw new Error('Rate limit exceeded (429)');
        }

        if (statusCode >= 400) {
            const errorBody = await body.text();

            // Check for compute units limit (non-retryable)
            if (errorBody.includes('Compute units') || errorBody.includes('limit exceeded')) {
                rateLimitHit = true;
                rateLimitResetTime = Date.now() + 60000; // 1 minute cooldown
                throw new Error(`Birdeye API Rate Limit: ${errorBody}`);
            }

            throw new Error(`Birdeye API Error: ${statusCode} - ${errorBody}`);
        }

        const data = await body.json() as any;
        return data as T;

    } catch (err: any) {
        // Don't retry rate limit errors
        if (err.message?.includes('Rate Limit') || err.message?.includes('Compute units')) {
            throw err;
        }

        if (retries < MAX_RETRIES) {
            const backoff = 1000 * Math.pow(2, retries);
            logger.warn({ err: err.message, retry: retries + 1, backoff }, 'Birdeye fetch failed, retrying');
            await sleep(backoff);
            return fetchWithRetry(endpoint, retries + 1);
        }

        throw err;
    }
}
// Helper function to fetch from GMGN and map to Birdeye format
async function fetchFromGmgnFallback(): Promise<BirdeyeTokenListItem[]> {
    try {
        const tokens = await gmgnFetcher.getTopTokens(50);
        return tokens.map(t => ({
            address: t.address,
            decimals: t.decimals,
            liquidity: t.liquidity,
            logo_uri: t.logo,
            market_cap: t.market_cap,
            name: t.name,
            symbol: t.symbol,
            volume_24h_usd: t.volume_24h_usd,
            volume_24h_change_percent: undefined,
            price: t.price,
            price_change_24h_percent: t.price_change_24h_percent,
            fdv: t.market_cap // approximation
        }));
    } catch (err) {
        logger.error({ err }, 'GMGN fallback failed');
        return [];
    }
}

// Helper function to fetch from DexScreener and map to Birdeye format
async function fetchFromDexScreenerFallback(): Promise<BirdeyeTokenListItem[]> {
    try {
        // Search for 'Solana' to get trending/top pairs
        const pairs = await dexScreenerFetcher.searchPairs('Solana');

        return pairs.map(pair => ({
            address: pair.baseToken.address,
            decimals: 9, // Assumption, mostly correct for SOL tokens
            liquidity: pair.liquidity?.usd || 0,
            logo_uri: undefined, // DexScreener doesn't provide logo in search properly sometimes
            market_cap: pair.marketCap || pair.fdv || 0,
            name: pair.baseToken.name,
            symbol: pair.baseToken.symbol,
            volume_24h_usd: pair.volume.h24,
            volume_24h_change_percent: undefined,
            price: parseFloat(pair.priceUsd),
            price_change_24h_percent: pair.priceChange.h24,
            fdv: pair.fdv
        }));
    } catch (err) {
        logger.error({ err }, 'DexScreener fallback failed');
        return [];
    }
}
