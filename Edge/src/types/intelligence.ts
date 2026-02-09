// TypeScript interfaces for Intelligence DTO
export interface TokenIntelligenceDTO {
    header: {
        priceUsd: number;
        liquidityUsd: number;
        fdv: number;
        marketCap: number;
        volume24h: number;
        pairAge: string;
        dexId: string;
        baseToken: {
            symbol: string;
            name: string;
        };
    };
    momentum: {
        score: number;
        label: 'RED' | 'BLUE' | 'GREEN' | 'EXPLOSIVE';
        signals: string[];
    };
    conviction: {
        score: number;
        repeatBuyers: number;
        smartWalletEntries: number;
        avgPositionSize: number;
        buyPressure: number;
    };
    alpha: {
        score: 'LOW' | 'MODERATE' | 'HIGH' | 'ELITE';
        numericScore: number;
        breakdown: Record<string, number>;
    };
    threat: {
        score: number;
        level: 'GREEN' | 'YELLOW' | 'RED';
        warnings: string[];
    };
    smartWallets: {
        clusterDetected: boolean;
        clusterScore: number;
        wallets: Array<{
            address: string;
            entryPrice: number;
            entryTime: Date;
            smartScore: number;
        }>;
        entryTiming: string;
    };
    marketStructure: {
        phase: string;
        trend: string;
        support: number | null;
        resistance: number | null;
        volatility: string;
    };
    aiInsight: {
        summary: string | null;
        cachedAt: Date | null;
    };
}
