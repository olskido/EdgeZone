import type { BirdeyeTokenListItem, FilterConfig } from './types';

export const filter = {
    process: (tokens: BirdeyeTokenListItem[], config: FilterConfig): BirdeyeTokenListItem[] => {
        const validTokens = tokens.filter(token => {
            // 1. Required fields
            if (!token.address || !token.symbol || !token.name) {
                return false;
            }

            // 2. Liquidity check
            if (config.minLiquidityUsd && token.liquidity < config.minLiquidityUsd) {
                return false;
            }

            // 3. Volume check (using correct field name)
            if (config.minVolume24h && token.volume_24h_usd < config.minVolume24h) {
                return false;
            }

            // 4. Market cap check (using correct field name)
            if (config.minMarketCap && token.market_cap < config.minMarketCap) {
                return false;
            }

            // 5. Age check (if configured)
            if (config.minAgeHours && token.last_trade_unix_time) {
                const ageHours = (Date.now() / 1000 - token.last_trade_unix_time) / 3600;
                if (ageHours < config.minAgeHours) {
                    return false;
                }
            }

            // 6. Price sanity check
            if (!token.price || token.price <= 0 || token.price > 1e12) {
                return false;
            }

            return true;
        });

        return validTokens;
    }
};
