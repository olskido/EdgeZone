import { request } from 'undici';
import { logger } from '../../utils/logger';

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const HELIUS_API = 'https://api.helius.xyz/v0';

export interface ParsedSwap {
    walletAddress: string;
    amountUsd: number;
    side: 'buy' | 'sell';
    timestamp: Date;
    signature: string;
}

export interface HolderInfo {
    address: string;
    balance: number;
    percentage: number;
    rank: number;
}

export interface HolderPattern {
    address: string;
    rank: number;
    balance: number;
    percentage: number;
    pattern: 'ACCUMULATOR' | 'DIAMOND_HANDS' | 'PAPER_HANDS' | 'SELLS_AFTER_2X' | 'WHALE' | 'NEUTRAL';
    sentiment: 'GREEN' | 'RED' | 'BLUE';
    recentBuys: number;
    recentSells: number;
    avgHoldTime: number; // in hours
    lastActivity: Date | null;
    profitTaking: boolean;
}

export interface WhaleActivity {
    wallet: string;
    type: 'buy' | 'sell';
    amountUsd: number;
    timestamp: Date;
    signature: string;
    isSmartMoney: boolean;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const helius = {
    /**
     * Get Top 10 largest token holders using Helius RPC
     */
    getTopHolders: async (tokenMint: string, limit = 10): Promise<HolderInfo[]> => {
        if (!HELIUS_API_KEY) {
            logger.warn('Helius API key not configured');
            return [];
        }

        try {
            const { statusCode, body } = await request(HELIUS_RPC, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 'top-holders',
                    method: 'getTokenLargestAccounts',
                    params: [tokenMint]
                })
            });

            if (statusCode !== 200) {
                logger.warn({ statusCode }, 'Helius RPC error');
                return [];
            }

            const data = await body.json() as any;
            const accounts = data.result?.value || [];

            // Calculate total supply from top holders
            const totalFromTop = accounts.reduce((sum: number, acc: any) =>
                sum + Number(acc.uiAmount || 0), 0);

            // Return top N holders
            return accounts.slice(0, limit).map((acc: any, idx: number) => ({
                address: acc.address,
                balance: Number(acc.uiAmount || 0),
                percentage: totalFromTop > 0 ? (Number(acc.uiAmount || 0) / totalFromTop) * 100 : 0,
                rank: idx + 1
            }));
        } catch (err: any) {
            logger.error({ err: err.message, tokenMint }, 'Failed to get top holders');
            return [];
        }
    },

    /**
     * Get transaction history for a specific wallet
     */
    getWalletTransactions: async (walletAddress: string, limit = 50): Promise<any[]> => {
        if (!HELIUS_API_KEY) return [];

        try {
            const url = `${HELIUS_API}/addresses/${walletAddress}/transactions?api-key=${HELIUS_API_KEY}&limit=${limit}`;

            const { statusCode, body } = await request(url, {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });

            if (statusCode !== 200) {
                return [];
            }

            const data = await body.json() as any;
            return Array.isArray(data) ? data : [];
        } catch (err: any) {
            logger.warn({ walletAddress, err: err.message }, 'Failed to get wallet transactions');
            return [];
        }
    },

    /**
     * Analyze holder patterns for top 10 holders
     * Returns behavioral analysis: ACCUMULATOR, DIAMOND_HANDS, PAPER_HANDS, SELLS_AFTER_2X
     */
    analyzeHolderPatterns: async (tokenMint: string): Promise<HolderPattern[]> => {
        const holders = await helius.getTopHolders(tokenMint, 10);

        if (holders.length === 0) {
            return [];
        }

        const patterns: HolderPattern[] = [];

        // Process holders in sequence to avoid rate limits
        for (const holder of holders.slice(0, 5)) { // Limit to top 5 for API efficiency
            try {
                await sleep(200); // Rate limiting

                const transactions = await helius.getWalletTransactions(holder.address, 30);
                const pattern = analyzeWalletBehavior(transactions, tokenMint, holder);
                patterns.push(pattern);
            } catch (err: any) {
                logger.warn({ address: holder.address, err: err.message }, 'Failed to analyze holder');

                // Add placeholder for this holder
                patterns.push({
                    address: holder.address,
                    rank: holder.rank,
                    balance: holder.balance,
                    percentage: holder.percentage,
                    pattern: 'NEUTRAL',
                    sentiment: 'BLUE',
                    recentBuys: 0,
                    recentSells: 0,
                    avgHoldTime: 0,
                    lastActivity: null,
                    profitTaking: false
                });
            }
        }

        return patterns;
    },

    /**
     * Detect whale activity (transactions > $10k)
     */
    detectWhaleActivity: async (tokenMint: string, minUsd = 10000): Promise<WhaleActivity[]> => {
        const swaps = await helius.getTokenSwaps(tokenMint, 100);
        const parsed = helius.parseSwaps(swaps, tokenMint);

        // Filter for whale transactions
        const whaleActivities: WhaleActivity[] = parsed
            .filter(swap => swap.amountUsd >= minUsd)
            .map(swap => ({
                wallet: shortenAddress(swap.walletAddress),
                type: swap.side,
                amountUsd: swap.amountUsd,
                timestamp: swap.timestamp,
                signature: swap.signature,
                isSmartMoney: swap.amountUsd >= 50000 // Large = smart money
            }))
            .slice(0, 10);

        return whaleActivities;
    },

    // Fetch swap transactions for a token
    getTokenSwaps: async (tokenAddress: string, limit = 100): Promise<any[]> => {
        if (!HELIUS_API_KEY) {
            logger.warn('Helius API key not configured');
            return [];
        }

        try {
            const url = `${HELIUS_API}/addresses/${tokenAddress}/transactions?api-key=${HELIUS_API_KEY}&type=SWAP&limit=${limit}`;

            const { statusCode, body } = await request(url, {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });

            if (statusCode !== 200) {
                logger.warn({ statusCode, tokenAddress }, 'Helius API error');
                return [];
            }

            const data = await body.json() as any;
            return Array.isArray(data) ? data : [];
        } catch (err: any) {
            logger.error({ err: err.message, tokenAddress }, 'Failed to fetch swaps from Helius');
            return [];
        }
    },

    // Parse swap data to extract wallet, amount, side
    parseSwaps: (transactions: any[], tokenAddress: string): ParsedSwap[] => {
        return transactions
            .map(tx => {
                try {
                    const swap = tx.tokenTransfers?.find((t: any) =>
                        t.mint?.toLowerCase() === tokenAddress.toLowerCase()
                    );

                    if (!swap) return null;

                    const walletAddress = tx.feePayer || tx.accountData?.[0]?.account || 'unknown';
                    const amountUsd = calculateSwapAmount(tx);
                    const side = determineSide(tx, tokenAddress);
                    const timestamp = new Date(tx.timestamp * 1000);
                    const signature = tx.signature;

                    return {
                        walletAddress,
                        amountUsd,
                        side,
                        timestamp,
                        signature
                    };
                } catch (err) {
                    return null;
                }
            })
            .filter((swap): swap is ParsedSwap => swap !== null);
    }
};

/**
 * Analyze wallet behavior to determine trading pattern
 */
function analyzeWalletBehavior(transactions: any[], tokenMint: string, holder: HolderInfo): HolderPattern {
    let recentBuys = 0;
    let recentSells = 0;
    let lastActivity: Date | null = null;
    let profitTaking = false;
    let sellsAfter2x = false;
    let avgHoldTime = 0;

    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    // Analyze recent transactions
    for (const tx of transactions) {
        const timestamp = new Date(tx.timestamp * 1000);

        if (!lastActivity || timestamp > lastActivity) {
            lastActivity = timestamp;
        }

        // Check if transaction involves our token
        const tokenTransfer = tx.tokenTransfers?.find((t: any) =>
            t.mint?.toLowerCase() === tokenMint.toLowerCase()
        );

        if (tokenTransfer) {
            const isSell = tokenTransfer.fromUserAccount === tx.feePayer;

            if (timestamp.getTime() > oneDayAgo) {
                if (isSell) {
                    recentSells++;
                    // Check if sell happened after significant gain
                    if (tx.description?.includes('profit') || tx.description?.includes('swap')) {
                        profitTaking = true;
                    }
                } else {
                    recentBuys++;
                }
            }
        }
    }

    // Determine pattern based on behavior
    let pattern: HolderPattern['pattern'] = 'NEUTRAL';
    let sentiment: HolderPattern['sentiment'] = 'BLUE';

    if (recentBuys > 3 && recentSells === 0) {
        pattern = 'ACCUMULATOR';
        sentiment = 'GREEN';
    } else if (recentSells === 0 && holder.balance > 0) {
        pattern = 'DIAMOND_HANDS';
        sentiment = 'GREEN';
    } else if (recentSells > recentBuys * 2) {
        pattern = 'PAPER_HANDS';
        sentiment = 'RED';
    } else if (profitTaking && recentSells > 0) {
        pattern = 'SELLS_AFTER_2X';
        sentiment = 'RED';
    } else if (holder.percentage > 5) {
        pattern = 'WHALE';
        sentiment = 'BLUE';
    }

    // Calculate average hold time (simplified)
    if (lastActivity) {
        avgHoldTime = Math.floor((now - lastActivity.getTime()) / (1000 * 60 * 60));
    }

    return {
        address: holder.address,
        rank: holder.rank,
        balance: holder.balance,
        percentage: holder.percentage,
        pattern,
        sentiment,
        recentBuys,
        recentSells,
        avgHoldTime,
        lastActivity,
        profitTaking
    };
}

function calculateSwapAmount(tx: any): number {
    // Estimate USD value from SOL transfers
    const solTransfer = tx.nativeTransfers?.[0];
    if (solTransfer) {
        const solAmount = solTransfer.amount / 1e9;
        const solPrice = 150; // Approximate - should fetch real price
        return solAmount * solPrice;
    }
    return 0;
}

function determineSide(tx: any, tokenAddress: string): 'buy' | 'sell' {
    const tokenTransfer = tx.tokenTransfers?.find((t: any) =>
        t.mint?.toLowerCase() === tokenAddress.toLowerCase()
    );

    if (!tokenTransfer) return 'buy';
    return tokenTransfer.fromUserAccount === tx.feePayer ? 'sell' : 'buy';
}

function shortenAddress(address: string): string {
    if (!address || address.length < 10) return address;
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
}
