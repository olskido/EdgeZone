import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from './config/env';
import { logger } from './utils/logger';
import { HttpError } from './utils/http';
import { healthRoutes } from './routes/health';
import { tokenRoutes } from './routes/tokens';
import { intelligenceRoutes } from './routes/intelligence';

export const buildServer = () => {
  const app = Fastify({
    logger
  });

  // Enable CORS for frontend
  app.register(cors, {
    origin: true // Allow all origins in dev (frontend runs on random ports like 5173, 5176)
  });

  if (env.NODE_ENV === 'development') {
    app.addHook('onRoute', (route) => {
      app.log.info({ method: route.method, url: route.url }, 'route registered');
    });
  }

  app.setErrorHandler((err, _req, reply) => {
    const statusCode = err instanceof HttpError ? err.statusCode : 500;
    const message = statusCode === 500 ? 'Internal Server Error' : err.message;

    app.log.error({ err, statusCode }, 'request error');
    reply.status(statusCode).send({ error: message });
  });

  app.register(healthRoutes);
  app.register(tokenRoutes);
  app.register(intelligenceRoutes);

  return app;
};

const main = async () => {
  const app = buildServer();
  const address = await app.listen({ port: env.PORT, host: '0.0.0.0' });
  app.log.info({ address, port: env.PORT }, 'server listening');
};

main().catch((err) => {
  logger.fatal({ err }, 'failed to start');
  process.exit(1);
});
