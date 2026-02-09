import type { BirdeyeTokenListItem, NormalizedToken } from './types';

export const normalizer = {
    normalize: (tokens: BirdeyeTokenListItem[]): NormalizedToken[] => {
        const mapped: (NormalizedToken | null)[] = tokens.map(token => {
            try {
                const price = parseFloat(String(token.price || '0'));
                const liquidity = token.liquidity || 0;
                const volume24h = token.volume_24h_usd || 0;  // Updated field name
                const marketCap = token.market_cap || 0;      // Updated field name
                const fdv = token.fdv || marketCap;           // Use fdv if available
                const priceChange24h = token.price_change_24h_percent || 0;  // Updated field name

                // Sanitize strings
                const name = (token.name || 'Unknown').substring(0, 100);
                const symbol = (token.symbol || 'UNK').substring(0, 20);

                // Extract logo URL
                const logoUrl = token.logo_uri || undefined;  // Updated field name

                // For Birdeye, we don't have explicit pair address or dexId
                // We'll use the token address as pairAddress and 'birdeye' as dexId
                const pairAddress = token.address;
                const dexId = 'birdeye';

                // Estimate pair creation time from last_trade_unix_time if available
                const pairCreatedAt = token.last_trade_unix_time  // Updated field name
                    ? new Date(token.last_trade_unix_time * 1000)
                    : new Date();

                return {
                    chain: 'solana',
                    contract: token.address,
                    name,
                    symbol,
                    pairAddress,
                    dexId,
                    price,
                    liquidity,
                    volume24h,
                    marketCap,
                    fdv,
                    priceChange24h,
                    pairCreatedAt,
                    logoUrl
                } as NormalizedToken;
            } catch (err) {
                // Skip malformed tokens
                return null;
            }
        });

        return mapped.filter((t): t is NormalizedToken => t !== null);
    }
};
