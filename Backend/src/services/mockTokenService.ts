/**
 * Mock Token Data Service
 * Use this until network access is enabled
 * Returns realistic Solana memecoin data
 */

export interface MockToken {
    address: string;
    symbol: string;
    name: string;
    price: number;
    liquidity: number;
    volume24h: number;
    volumeChange24h: number;
    priceChange24h: number;
    marketCap: number;
    holders: number;
    creationTime: number;
    logo: string;
}

export const MOCK_TOKENS: MockToken[] = [
    {
        address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
        symbol: "BONK",
        name: "Bonk",
        price: 0.00001245,
        liquidity: 2450000,
        volume24h: 8500000,
        volumeChange24h: 145.3,
        priceChange24h: 23.5,
        marketCap: 850000000,
        holders: 145000,
        creationTime: Date.now() - (180 * 24 * 60 * 60 * 1000), // 180 days ago
        logo: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263/logo.png"
    },
    {
        address: "WENWENvqqNya429ubCdR81ZmD69brwQaaBYY6p3LCpk",
        symbol: "WEN",
        name: "Wen",
        price: 0.000085,
        liquidity: 1200000,
        volume24h: 4200000,
        volumeChange24h: 89.2,
        priceChange24h: 12.3,
        marketCap: 425000000,
        holders: 78000,
        creationTime: Date.now() - (90 * 24 * 60 * 60 * 1000), // 90 days ago
        logo: "https://shdw-drive.genesysgo.net/CsDkETHRRR1EcueeN346MJoqzymkkr7RFjMqGpZMzAib/wen.png"
    },
    {
        address: "3S8qX1MsMqRbiwKg2cQyx7nis1oHMgaCuc9c4VfvVdPN",
        symbol: "MYRO",
        name: "Myro",
        price: 0.0245,
        liquidity: 850000,
        volume24h: 2100000,
        volumeChange24h: -15.5,
        priceChange24h: -8.2,
        marketCap: 245000000,
        holders: 45000,
        creationTime: Date.now() - (120 * 24 * 60 * 60 * 1000), // 120 days ago
        logo: "https://shdw-drive.genesysgo.net/6tcnBSybPG7piEDShBcrVtYJDPSvGrDbVvXmXKpzBvWP/myro.png"
    },
    {
        address: "ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82",
        symbol: "BOME",
        name: "Book of Meme",
        price: 0.0089,
        liquidity: 3200000,
        volume24h: 12000000,
        volumeChange24h: 234.5,
        priceChange24h: 45.8,
        marketCap: 890000000,
        holders: 92000,
        creationTime: Date.now() - (60 * 24 * 60 * 60 * 1000), // 60 days ago
        logo: "https://bafkreidlwzx4cqfxyquhhl6bvxwhnqcjapmhfwp7gxp4g3d6xxds7q656e.ipfs.nftstorage.link"
    },
    {
        address: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr",
        symbol: "POPCAT",
        name: "Popcat",
        price: 0.452,
        liquidity: 1800000,
        volume24h: 6500000,
        volumeChange24h: 123.4,
        priceChange24h: 34.2,
        marketCap: 452000000,
        holders: 67000,
        creationTime: Date.now() - (45 * 24 * 60 * 60 * 1000), // 45 days ago
        logo: "https://cf-ipfs.com/ipfs/QmPzSXqFEDGrHMZpP7MBqmQbZtJmYLbbKpfXWEevpPcPxP"
    },
    {
        address: "HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC",
        symbol: "SLERF",
        name: "Slerf",
        price: 0.156,
        liquidity: 950000,
        volume24h: 3400000,
        volumeChange24h: 67.8,
        priceChange24h: 18.9,
        marketCap: 156000000,
        holders: 34000,
        creationTime: Date.now() - (30 * 24 * 60 * 60 * 1000), // 30 days ago
        logo: "https://cf-ipfs.com/ipfs/QmcM5pGKzZUcT3KXkHYc3nK8i8A8NKNbQKqPZfT6JgR7Xj"
    },
    {
        address: "MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5",
        symbol: "MEW",
        name: "Cat in a Dogs World",
        price: 0.00234,
        liquidity: 2100000,
        volume24h: 7800000,
        volumeChange24h: 156.7,
        priceChange24h: 28.4,
        marketCap: 234000000,
        holders: 56000,
        creationTime: Date.now() - (75 * 24 * 60 * 60 * 1000), // 75 days ago
        logo: "https://cf-ipfs.com/ipfs/QmP8PqPdMvNJf9JZxJCqhvDckLNZaFJ7Qr8T4r5v6LcN3z"
    },
    {
        address: "3fUV7W3JLLgpuJrxAWBUxgWKG8YqCjdqxHaVcxqkMtzw",
        symbol: "WIF",
        name: "Dogwifhat",
        price: 1.234,
        liquidity: 4500000,
        volume24h: 18500000,
        volumeChange24h: 198.3,
        priceChange24h: 42.7,
        marketCap: 1234000000,
        holders: 125000,
        creationTime: Date.now() - (150 * 24 * 60 * 60 * 1000), // 150 days ago
        logo: "https://shdw-drive.genesysgo.net/FDcC9gn12fFkSU2KuQYH4TUjihrZxiTodFRWNF4ns9Kt/wif.png"
    },
    {
        address: "9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump",
        symbol: "PENG",
        name: "Peng",
        price: 0.0123,
        liquidity: 680000,
        volume24h: 1850000,
        volumeChange24h: 45.2,
        priceChange24h: 15.3,
        marketCap: 123000000,
        holders: 28000,
        creationTime: Date.now() - (25 * 24 * 60 * 60 * 1000), // 25 days ago
        logo: "https://cf-ipfs.com/ipfs/QmYmZ7JkYNBfuRLp2y8X8mBvYhqGDwCU9rQHQpHdJMqN6q"
    },
    {
        address: "5tN42n9vMi6ubp67Uy4NnmM5DMZYN8aS8GeB3bEDHr6E",
        symbol: "GIGA",
        name: "Giga Chad",
        price: 0.0456,
        liquidity: 1450000,
        volume24h: 5200000,
        volumeChange24h: 112.3,
        priceChange24h: 31.8,
        marketCap: 456000000,
        holders: 72000,
        creationTime: Date.now() - (55 * 24 * 60 * 60 * 1000), // 55 days ago
        logo: "https://cf-ipfs.com/ipfs/QmX9p5KfhYQQT6RkL7Fh3mJ2wN8vBqGHzXpMrVnY4sD7Tp"
    }
];

export interface TokenFilters {
    min_liquidity?: number;
    min_volume_24h_usd?: number;
    min_mc?: number;
    min_age_hours?: number;
}

// Filter function matching your criteria
export function filterTokens(tokens: MockToken[], filters: TokenFilters = {}): MockToken[] {
    const {
        min_liquidity = 0,
        min_volume_24h_usd = 0,
        min_mc = 0,
        min_age_hours = 0
    } = filters;

    const minAge = min_age_hours * 60 * 60 * 1000;
    const now = Date.now();

    return tokens.filter(token => {
        const age = now - token.creationTime;
        return (
            token.liquidity >= min_liquidity &&
            token.volume24h >= min_volume_24h_usd &&
            token.marketCap >= min_mc &&
            age >= minAge
        );
    });
}

// Get tokens with your default filters
export function getFilteredTokens(customFilters: TokenFilters = {}): MockToken[] {
    const defaultFilters = {
        min_liquidity: 20000,
        min_volume_24h_usd: 100000,
        min_mc: 100000,
        min_age_hours: 24
    };

    const filters = { ...defaultFilters, ...customFilters };
    const filtered = filterTokens(MOCK_TOKENS, filters);

    // Sort by volume
    return filtered.sort((a, b) => b.volume24h - a.volume24h);
}

// Simulate async API call
export async function fetchTokens(filters: TokenFilters = {}): Promise<MockToken[]> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 200));
    return getFilteredTokens(filters);
}

export const mockService = {
    MOCK_TOKENS,
    filterTokens,
    getFilteredTokens,
    fetchTokens
};
