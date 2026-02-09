import { request } from 'undici';
import { logger } from '../../utils/logger';

// GMGN API Base URL
const API_BASE = 'https://gmgn.ai/defi/quotation/v1/tokens/top_pools/sol';

export interface GmgnToken {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    logo?: string;
    price: number;
    price_change_24h_percent: number;
    volume_24h_usd: number;
    liquidity: number;
    market_cap: number;
    holder_count: number;
    creation_timestamp: number;
    is_renounced?: boolean;
}

export const fetcher = {
    getTopTokens: async (limit: number = 100): Promise<GmgnToken[]> => {
        try {
            const url = `${API_BASE}?orderby=volume_24h_usd&direction=desc&filters[]=renounced&limit=${limit}`;

            const { statusCode, body } = await request(url);

            if (statusCode !== 200) {
                throw new Error(`GMGN API returned ${statusCode}`);
            }

            const data = await body.json() as any;

            if (data.code !== 0 || !data.data || !data.data.rank) {
                logger.warn({ data }, 'Unexpected GMGN response format');
                return [];
            }

            return data.data.rank.map((t: any) => ({
                address: t.address,
                symbol: t.symbol,
                name: t.name,
                decimals: t.decimals || 9,
                logo: t.logo,
                price: Number(t.price),
                price_change_24h_percent: Number(t.price_change_24h_percent),
                volume_24h_usd: Number(t.volume_24h_usd),
                liquidity: Number(t.liquidity),
                market_cap: Number(t.market_cap),
                holder_count: Number(t.holder_count),
                creation_timestamp: t.creation_timestamp,
                is_renounced: t.is_renounced
            }));

        } catch (err: any) {
            logger.error({ err: err.message }, 'Failed to fetch from GMGN');
            return [];
        }
    }
};
