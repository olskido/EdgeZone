import { request } from 'undici';
import { logger } from '../../utils/logger';

// DexScreener API Base URL
const API_BASE = 'https://api.dexscreener.com/latest/dex';

export interface DexScreenerPair {
    chainId: string;
    dexId: string;
    url: string;
    pairAddress: string;
    baseToken: {
        address: string;
        name: string;
        symbol: string;
    };
    quoteToken: {
        address: string;
        name: string;
        symbol: string;
    };
    priceNative: string;
    priceUsd: string;
    txns: {
        m5: { buys: number; sells: number };
        h1: { buys: number; sells: number };
        h6: { buys: number; sells: number };
        h24: { buys: number; sells: number };
    };
    volume: {
        h24: number;
        h6: number;
        h1: number;
        m5: number;
    };
    priceChange: {
        m5: number;
        h1: number;
        h6: number;
        h24: number;
    };
    liquidity?: {
        usd: number;
        base: number;
        quote: number;
    };
    fdv?: number;
    marketCap?: number;
    pairCreatedAt?: number;
}

export interface DexScreenerSearchResponse {
    schemaVersion: string;
    pairs: DexScreenerPair[];
}

export const fetcher = {
    /**
     * Search for tokens on Solana via DexScreener
     * Useful as a fallback for discovery
     */
    searchPairs: async (query: string): Promise<DexScreenerPair[]> => {
        try {
            const url = `${API_BASE}/search?q=${encodeURIComponent(query)}`;
            const { statusCode, body } = await request(url);

            if (statusCode !== 200) {
                throw new Error(`DexScreener API Error: ${statusCode}`);
            }

            const data = await body.json() as DexScreenerSearchResponse;

            // Filter for Solana pairs only
            return (data.pairs || []).filter(p => p.chainId === 'solana');
        } catch (err: any) {
            logger.error({ err: err.message }, 'DexScreener search failed');
            return [];
        }
    },

    /**
     * Get specific pairs by address
     * Comma separated addresses (up to 30)
     */
    getPairs: async (pairAddresses: string[]): Promise<DexScreenerPair[]> => {
        if (!pairAddresses.length) return [];

        try {
            const chunks = [];
            // Chunk into 30 addresses max per request
            for (let i = 0; i < pairAddresses.length; i += 30) {
                chunks.push(pairAddresses.slice(i, i + 30));
            }

            const allPairs: DexScreenerPair[] = [];

            for (const chunk of chunks) {
                const url = `${API_BASE}/pairs/solana/${chunk.join(',')}`;
                const { statusCode, body } = await request(url);

                if (statusCode === 200) {
                    const data = await body.json() as DexScreenerSearchResponse;
                    if (data.pairs) allPairs.push(...data.pairs);
                }
            }

            return allPairs;
        } catch (err: any) {
            logger.error({ err: err.message }, 'DexScreener getPairs failed');
            return [];
        }
    },

    /**
     * Get token profiles/pairs by token address
     */
    getTokenPairs: async (tokenAddress: string): Promise<DexScreenerPair[]> => {
        try {
            const url = `${API_BASE}/tokens/${tokenAddress}`;
            const { statusCode, body } = await request(url);

            if (statusCode !== 200) {
                return [];
            }

            const data = await body.json() as DexScreenerSearchResponse;
            return (data.pairs || []).filter(p => p.chainId === 'solana');
        } catch (err: any) {
            return [];
        }
    }
};
