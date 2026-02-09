"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildServer = void 0;
const fastify_1 = __importDefault(require("fastify"));
const env_1 = require("./config/env");
const logger_1 = require("./utils/logger");
const http_1 = require("./utils/http");
const health_1 = require("./routes/health");
const tokens_1 = require("./routes/tokens");
const buildServer = () => {
    const app = (0, fastify_1.default)({
        logger: logger_1.logger
    });
    app.setErrorHandler((err, _req, reply) => {
        const statusCode = err instanceof http_1.HttpError ? err.statusCode : 500;
        const message = statusCode === 500 ? 'Internal Server Error' : err.message;
        app.log.error({ err, statusCode }, 'request error');
        reply.status(statusCode).send({ error: message });
    });
    app.register(health_1.healthRoutes);
    app.register(tokens_1.tokenRoutes);
    return app;
};
exports.buildServer = buildServer;
const main = async () => {
    const app = (0, exports.buildServer)();
    await app.listen({ port: env_1.env.PORT, host: '0.0.0.0' });
};
main().catch((err) => {
    logger_1.logger.fatal({ err }, 'failed to start');
    process.exit(1);
});
