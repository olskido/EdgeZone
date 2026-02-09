#!/usr/bin/env ts-node
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('=== Token Discovery System Health Check ===\n');

    // 1. Total tokens in database
    const totalTokens = await prisma.token.count();
    console.log(`📊 Total tokens in database: ${totalTokens}`);

    // 2. Solana-only tokens
    const solanaTokens = await prisma.token.count({
        where: { chain: 'solana' }
    });
    console.log(`🔷 Solana tokens: ${solanaTokens}`);

    // 3. Active tokens (seen in last 24h)
    const activeTokens = await prisma.token.count({
        where: {
            lastSeenAt: {
                gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
            }
        }
    });
    console.log(`✅ Active tokens (seen in last 24h): ${activeTokens}`);

    // 4. Tokens meeting display criteria
    const displayTokens = await prisma.token.count({
        where: {
            chain: 'solana',
            marketCap: { gte: 100000 },
            volume24h: { gte: 200000 },
            lastSeenAt: {
                gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
            }
        }
    });
    console.log(`🎯 Tokens meeting display criteria: ${displayTokens}`);

    // 5. Recently added tokens (last hour)
    const recentTokens = await prisma.token.count({
        where: {
            firstSeenAt: {
                gte: new Date(Date.now() - 60 * 60 * 1000)
            }
        }
    });
    console.log(`🆕 Tokens discovered in last hour: ${recentTokens}`);

    // 6. Sample of latest tokens
    const latestTokens = await prisma.token.findMany({
        where: { chain: 'solana' },
        orderBy: { firstSeenAt: 'desc' },
        take: 5,
        select: {
            name: true,
            ticker: true,
            marketCap: true,
            volume24h: true,
            firstSeenAt: true,
            lastSeenAt: true
        }
    });

    console.log('\n📋 Latest 5 tokens discovered:');
    latestTokens.forEach((token, i) => {
        const age = ((Date.now() - token.firstSeenAt.getTime()) / (1000 * 60)).toFixed(0);
        console.log(`  ${i + 1}. ${token.name} (${token.ticker})`);
        console.log(`     MC: $${Number(token.marketCap).toLocaleString()}, Vol: $${Number(token.volume24h).toLocaleString()}`);
        console.log(`     Discovered: ${age}m ago\n`);
    });

    console.log('=== Health Check Complete ===');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
