"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenScannerWorker = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("../cache/redis");
const logger_1 = require("../utils/logger");
exports.tokenScannerWorker = new bullmq_1.Worker('token-scanner', async () => {
    logger_1.logger.info('token-scanner: tick');
}, { connection: redis_1.redis });
