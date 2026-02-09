/**
 * Trigger scoring engines for all active tokens
 * Run with: npx ts-node src/scripts/triggerScoring.ts
 */
import { prisma } from '../models/prisma';
import { calculateMomentum } from '../services/scoring/momentumEngine';
import { calculateConviction } from '../services/scoring/convictionEngine';
import { detectWalletClusters } from '../services/scoring/walletClusterEngine';
import { calculateThreat } from '../services/scoring/threatEngine';
import { analyzeMarketStructure } from '../services/scoring/marketStructureEngine';

async function main() {
    console.log('🔄 Starting manual scoring cycle...');

    const tokens = await prisma.token.findMany({
        where: {
            lastSeenAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        },
        take: 50
    });

    console.log(`Computing scores for ${tokens.length} tokens...`);

    let successCount = 0;

    for (const token of tokens) {
        try {
            const [momentum, conviction, cluster, threat, structure] = await Promise.all([
                calculateMomentum(token.id),
                calculateConviction(token.id),
                detectWalletClusters(token.id),
                calculateThreat(token.id),
                analyzeMarketStructure(token.id)
            ]);

            await prisma.token.update({
                where: { id: token.id },
                data: {
                    momentumScore: momentum.score,
                    convictionScore: conviction.score,
                    threatLevel: threat.level,
                    clusterDetected: cluster.clusterDetected,
                    smartWalletFlow: cluster.clusterDetected && cluster.clusterScore > 50
                }
            });

            successCount++;
            console.log(`✅ ${token.ticker}: momentum=${momentum.score} phase=${momentum.phase} conviction=${conviction.score}`);
        } catch (err: any) {
            console.error(`❌ ${token.ticker}: ${err.message}`);
        }
    }

    console.log(`\n✅ Scored ${successCount}/${tokens.length} tokens`);
    await prisma.$disconnect();
}

main().catch(console.error);
