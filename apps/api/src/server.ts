import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';

export async function buildServer() {
  const level = process.env.LOG_LEVEL ?? 'info';
  const isDev = process.env.NODE_ENV !== 'production';

  const server = Fastify({
    logger: isDev
      ? {
          level,
          transport: {
            target: 'pino-pretty',
            options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
          },
        }
      : { level },
    trustProxy: true,
    bodyLimit: 10 * 1024 * 1024, // 10 MB
    disableRequestLogging: false,
    requestIdHeader: 'x-request-id',
  });

  // Security headers (per `30-security.md §10.3`)
  await server.register(helmet, {
    contentSecurityPolicy: false, // Set per route as needed
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  });

  await server.register(cors, {
    origin: process.env.CORS_ORIGIN?.split(',') ?? false,
    credentials: true,
  });

  await server.register(sensible);

  // Health endpoints (per `31 §RULE-OPS-041`)
  server.get('/health/live', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));
  server.get('/health/ready', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));
  server.get('/health/startup', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // Root marker
  server.get('/', async () => ({
    name: 'shopio-api',
    version: '0.0.1',
    docs: 'https://docs.shopio.com',
  }));

  return server;
}
