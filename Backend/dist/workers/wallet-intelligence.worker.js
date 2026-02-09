"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.walletIntelligenceWorker = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("../cache/redis");
const logger_1 = require("../utils/logger");
exports.walletIntelligenceWorker = new bullmq_1.Worker('wallet-intelligence', async () => {
    logger_1.logger.info('wallet-intelligence: tick');
}, { connection: redis_1.redis });
