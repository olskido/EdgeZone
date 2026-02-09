"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.threatDetectorWorker = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("../cache/redis");
const logger_1 = require("../utils/logger");
exports.threatDetectorWorker = new bullmq_1.Worker('threat-detector', async () => {
    logger_1.logger.info('threat-detector: tick');
}, { connection: redis_1.redis });
