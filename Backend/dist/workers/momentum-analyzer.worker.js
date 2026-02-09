"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.momentumAnalyzerWorker = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("../cache/redis");
const logger_1 = require("../utils/logger");
exports.momentumAnalyzerWorker = new bullmq_1.Worker('momentum-analyzer', async () => {
    logger_1.logger.info('momentum-analyzer: tick');
}, { connection: redis_1.redis });
