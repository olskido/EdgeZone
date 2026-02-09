export interface BirdeyeTokenListItem {
    address: string;
    decimals: number;
    liquidity: number;
    logo_uri?: string;  // Note: API uses logo_uri not logoURI
    market_cap: number;
    name: string;
    symbol: string;
    volume_24h_usd: number;
    volume_24h_change_percent?: number;
    price: number;
    price_change_24h_percent?: number;
    holder?: number;
    last_trade_unix_time?: number;
    trade_24h_count?: number;
    fdv?: number;
}

export interface BirdeyeTokenListResponse {
    data: {
        items: BirdeyeTokenListItem[];  // API returns 'items' not 'tokens'
        has_next: boolean;
    };
    success: boolean;
}

export interface BirdeyeTokenMarketData {
    address: string;
    decimals: number;
    liquidity: number;
    logoURI?: string;
    mc: number;
    name: string;
    symbol: string;
    price: number;
    priceChange24h?: number;
    volume24h?: number;
    holder?: number;
}

export interface FilterConfig {
    minLiquidityUsd: number;
    minVolume24h: number;
    minMarketCap?: number;
    minAgeHours?: number;
}

export interface NormalizedToken {
    chain: string;
    contract: string;
    name: string;
    symbol: string;
    pairAddress: string;
    dexId: string;
    price: number;
    liquidity: number;
    volume24h: number;
    marketCap: number;
    fdv: number;
    priceChange24h: number;
    pairCreatedAt: Date;
    logoUrl?: string;
}
