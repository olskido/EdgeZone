import './workers'; // Initialize workers
import { queues } from './workers/queues';
import { logger } from './utils/logger';
import { env } from './config/env';

async function main() {
    logger.info('Starting worker process...');

    // correct handling for boolean/string env var
    if (env.INGESTION_ENABLED === 'true') {
        const intervalMs = env.INGESTION_INTERVAL_SEC * 1000;
        logger.info({ intervalSec: env.INGESTION_INTERVAL_SEC }, 'Scheduling token ingestion job');

        // Add immediate job to start ingestion right away
        await queues.tokenScanner.add(
            'scan-immediate',
            {},
            {
                removeOnComplete: 10,
                removeOnFail: 50
            }
        );

        // Add repeatable job to the queue
        await queues.tokenScanner.add(
            'scan-trending',
            {},
            {
                repeat: {
                    every: intervalMs
                },
                removeOnComplete: 10, // Keep last 10 successful jobs
                removeOnFail: 50      // Keep last 50 failed jobs for debugging
            }
        );
    } else {
        logger.warn('Ingestion disabled by configuration');
    }

    // Schedule wallet intelligence worker (every 3 minutes)
    if (env.HELIUS_API_KEY) {
        logger.info('Scheduling wallet intelligence job (every 3 minutes)');
        await queues.walletIntelligence.add(
            'analyze-wallets',
            {},
            {
                repeat: {
                    every: 5 * 60 * 1000 // 5 minutes
                },
                removeOnComplete: 10,
                removeOnFail: 50
            }
        );
    } else {
        logger.warn('Wallet intelligence disabled - Helius API key not configured');
    }

    // Schedule AI interpretation worker (every 15 minutes)
    if (env.OPENAI_API_KEY) {
        logger.info('Scheduling AI interpretation job (every 15 minutes)');
        await queues.aiInterpretation.add(
            'generate-summaries',
            {},
            {
                repeat: {
                    every: 15 * 60 * 1000 // 15 minutes
                },
                removeOnComplete: 10,
                removeOnFail: 50
            }
        );
    } else {
        logger.warn('AI interpretation disabled - OpenAI API key not configured');
    }

    // Schedule snapshot worker (every 5 minutes)
    logger.info('Scheduling snapshot job (every 5 minutes)');
    await queues.snapshot.add(
        'capture-snapshots',
        {},
        {
            repeat: {
                every: 5 * 60 * 1000 // 5 minutes
            },
            removeOnComplete: 10,
            removeOnFail: 50
        }
    );

    // Schedule scoring worker (every 10 minutes)
    logger.info('Scheduling scoring job (every 10 minutes)');
    await queues.scoring.add(
        'compute-scores',
        {},
        {
            repeat: {
                every: 10 * 60 * 1000 // 10 minutes
            },
            removeOnComplete: 10,
            removeOnFail: 50
        }
    );

    logger.info('Worker process ready');
}

// Graceful shutdown
const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down workers...');

    await Promise.all([
        queues.tokenScanner.close(),
        queues.walletIntelligence.close(),
        queues.aiInterpretation.close(),
        queues.snapshot.close(),
        queues.scoring.close()
    ]);

    process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

main().catch((err) => {
    logger.fatal({ err }, 'Worker process failed to start');
    process.exit(1);
});
