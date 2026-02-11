import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from './config/env';
import { logger } from './utils/logger';
import { HttpError } from './utils/http';
import { healthRoutes } from './routes/health';
import { tokenRoutes } from './routes/tokens';
import { intelligenceRoutes } from './routes/intelligence';

import websocket from '@fastify/websocket';
import { redis } from './cache/redis';

export const buildServer = () => {
  const app = Fastify({
    logger
  });

  // Enable CORS for frontend
  app.register(cors, {
    origin: true
  });

  // Register WebSocket Plugin
  app.register(websocket);

  app.register(async function (fastify) {
    fastify.get('/ws', { websocket: true }, (connection: any, req) => {
      // Subscribe to Redis channel for market updates behavior
      const redisSub = redis.duplicate();
      redisSub.subscribe('market_updates', (err) => {
        if (err) fastify.log.error(err);
      });

      redisSub.on('message', (channel, message) => {
        if (channel === 'market_updates') {
          connection.socket.send(message);
        }
      });

      connection.socket.on('message', (message: any) => {
        // Handle subscriptions from client if needed
        try {
          const data = JSON.parse(message.toString());
          if (data.action === 'subscribe') {
            fastify.log.info({ channels: data.channels }, 'Client subscribed');
          }
        } catch (e) { }
      });

      connection.socket.on('close', () => {
        redisSub.disconnect();
      });
    });
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

import { birdeyeWS } from './services/websocketService';

const main = async () => {
  const app = buildServer();
  const address = await app.listen({ port: env.PORT, host: '0.0.0.0' });
  app.log.info({ address, port: env.PORT }, 'server listening');

  // Initialize Birdeye WebSocket
  if (env.INGESTION_ENABLED === 'true') {
    app.log.info('Initializing Real-time Data Stream...');
    birdeyeWS.subscribeToToken('So11111111111111111111111111111111111111112');
  }
};

main().catch((err) => {
  logger.fatal({ err }, 'failed to start');
  process.exit(1);
});
