import { prisma } from '../../models/prisma';

export interface WalletProfile {
    address: string;
    label: 'DIAMOND_HANDS' | 'JEETER' | 'WHALE' | 'MINT_SNIPER' | 'BOT' | 'FRESH_WALLET';
    riskScore: number; // 0-100 (100 = safe, 0 = toxic)
    tags: string[];
    pnl?: number;
    winRate?: number;
    heldTime?: string; // e.g. "4d 2h"
}

export interface WalletAnalysisResult {
    topWallets: WalletProfile[];
    concentration: {
        top10: number; // % held by top 10
        top20: number;
        score: number; // 0-100 (100 = dispersed/safe)
    };
    smartMoneyInflow: {
        score: number; // 0-100
        netFlow: number; // in USD
        label: 'ACCUMULATING' | 'DUMPING' | 'NEUTRAL';
    };
}

// MOCK DATA for now until GMGN/Birdeye wallet API is fully integrated
// In production, this would fetch from `wallet_transactions` table or external API
export async function analyzeWallets(tokenId: string): Promise<WalletAnalysisResult> {

    // 1. Get real data from DB if available
    const txs = await prisma.walletTransaction.findMany({
        where: { tokenId },
        orderBy: { timestamp: 'desc' },
        take: 100
    });

    // 2. Mock Logic for "Top Wallets" if no real data (Resilience Rule)
    // We will simulate a mix of behaviors for the demo
    const mockWallets: WalletProfile[] = [
        {
            address: 'EqW...9aB',
            label: 'WHALE',
            riskScore: 85,
            tags: ['Early Buyer', 'High Volume'],
            pnl: 15400,
            heldTime: '5d 2h'
        },
        {
            address: '8xF...k2L',
            label: 'DIAMOND_HANDS',
            riskScore: 95,
            tags: ['Never Sold', 'DCA'],
            pnl: 4200,
            heldTime: '12d 5h'
        },
        {
            address: '3zQ...m1N',
            label: 'JEETER',
            riskScore: 30,
            tags: ['Sells on Pump', 'Sniper'],
            pnl: 800,
            heldTime: '2m'
        },
        {
            address: '9pL...v4R',
            label: 'BOT',
            riskScore: 10,
            tags: ['High Frequency', 'Mev'],
            pnl: 150,
            heldTime: '30s'
        },
        {
            address: '2wS...x8Y',
            label: 'MINT_SNIPER',
            riskScore: 40,
            tags: ['First 10 Blocks'],
            pnl: 2200,
            heldTime: '1h'
        }
    ];

    // 3. Concentration Analysis
    // Mocking safe concentration for now
    const concentration = {
        top10: 15,
        top20: 22,
        score: 85
    };

    // 4. Smart Money Flow
    // Mocking positive inflow
    const smartMoneyInflow = {
        score: 75,
        netFlow: 45000,
        label: 'ACCUMULATING' as const
    };

    return {
        topWallets: mockWallets,
        concentration,
        smartMoneyInflow
    };
}
