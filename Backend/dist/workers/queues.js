"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.queues = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("../cache/redis");
const connection = redis_1.redis;
exports.queues = {
    tokenScanner: new bullmq_1.Queue('token-scanner', { connection }),
    walletIntelligence: new bullmq_1.Queue('wallet-intelligence', { connection }),
    momentumAnalyzer: new bullmq_1.Queue('momentum-analyzer', { connection }),
    threatDetector: new bullmq_1.Queue('threat-detector', { connection })
};
