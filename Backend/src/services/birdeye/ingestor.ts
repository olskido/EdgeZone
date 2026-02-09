import { prisma } from '../../models/prisma';
import { logger } from '../../utils/logger';
import type { NormalizedToken } from './types';

const BATCH_SIZE = 10; // Reduced for stability on remote DB

export const ingestor = {
    ingest: async (tokens: NormalizedToken[]) => {
        let upsertedCount = 0;
        let snapshotCount = 0;
        let failedBatches = 0;

        // Process in small batches
        for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
            const batch = tokens.slice(i, i + BATCH_SIZE);
            const batchPromises = batch.map(async (token) => {
                try {
                    // Use transaction PER TOKEN to ensure atomicity but isolate failures
                    // If one token fails, it doesn't kill the whole batch
                    await prisma.$transaction(async (tx) => {
                        // 1. Upsert Token
                        const savedToken = await tx.token.upsert({
                            where: {
                                contract_chain: {
                                    contract: token.contract,
                                    chain: token.chain
                                }
                            },
                            update: {
                                name: token.name,
                                ticker: token.symbol,
                                pairAddress: token.pairAddress,
                                dexId: token.dexId,
                                logoUrl: token.logoUrl,
                                // Update cached metrics
                                price: token.price,
                                liquidity: token.liquidity,
                                volume24h: token.volume24h,
                                marketCap: token.marketCap,
                                pairCreatedAt: token.pairCreatedAt,
                                lastSeenAt: new Date(),      // Update every time we see it
                                lastIngestedAt: new Date()
                            },
                            create: {
                                name: token.name,
                                ticker: token.symbol,
                                contract: token.contract,
                                chain: token.chain,
                                pairAddress: token.pairAddress,
                                dexId: token.dexId,
                                logoUrl: token.logoUrl,
                                // Set cached metrics
                                price: token.price,
                                liquidity: token.liquidity,
                                volume24h: token.volume24h,
                                marketCap: token.marketCap,
                                pairCreatedAt: token.pairCreatedAt,
                                firstSeenAt: new Date(),     // Set once on creation
                                lastSeenAt: new Date(),      // Also set on creation
                                lastIngestedAt: new Date()
                            }
                        });

                        // 2. Create Snapshot
                        await tx.marketSnapshot.create({
                            data: {
                                tokenId: savedToken.id,
                                price: token.price,
                                liquidity: token.liquidity,
                                volume: token.volume24h,
                                marketCap: token.marketCap,
                                fdv: token.fdv,
                                priceChange24h: token.priceChange24h
                            }
                        });
                    }, { timeout: 10000 }); // 10s per token transaction is plenty

                    return true;
                } catch (err: any) {
                    logger.warn({ token: token.symbol, err: err.message }, 'Failed to ingest token');
                    return false;
                }
            });

            // Wait for all tokens in this batch to complete
            const results = await Promise.all(batchPromises);
            const successCount = results.filter(r => r).length;

            upsertedCount += successCount;
            snapshotCount += successCount;

            if (successCount < batch.length) {
                failedBatches++;
            }

            // Circuit Breaker: If 3 batches fail completely, assume DB is down and abort
            if (failedBatches >= 3 && upsertedCount === 0) {
                logger.error('Circuit breaker tripped: Multiple batch failures, aborting ingestion');
                break;
            }
        }

        return { upsertedCount, snapshotCount, failedBatches };
    }
};
