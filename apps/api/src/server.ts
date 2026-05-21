import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import cookie from '@fastify/cookie';
import { getConfig, corsOrigins } from './config';
import { getDb } from './db';
import { registerAuthRoutes } from './routes/auth';
import { registerTenantRoutes } from './routes/tenants';

export async function buildServer() {
  const config = getConfig();
  const isDev = config.NODE_ENV !== 'production';

  const server = Fastify({
    logger: isDev
      ? {
          level: config.LOG_LEVEL,
          transport: {
            target: 'pino-pretty',
            options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
          },
        }
      : { level: config.LOG_LEVEL },
    trustProxy: true,
    bodyLimit: 10 * 1024 * 1024,
    disableRequestLogging: false,
    requestIdHeader: 'x-request-id',
  });

  // Security headers (per `30-security.md §10.3`)
  await server.register(helmet, {
    contentSecurityPolicy: false,
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  });

  await server.register(cors, {
    origin: corsOrigins(config),
    credentials: true,
  });

  await server.register(cookie);
  await server.register(sensible);

  // Health endpoints (per `31 §RULE-OPS-041`)
  server.get('/health/live', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));
  server.get('/health/ready', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));
  server.get('/health/startup', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // Root marker
  server.get('/', async () => ({
    name: 'shopio-api',
    version: '0.0.1',
    api_version: '2026-05-20',
    docs: 'https://docs.shopio.com',
  }));

  // Auth + tenant routes (per `30-security.md §16.1`, `36-personas-rbac.md §14`)
  const db = getDb(config);
  await registerAuthRoutes(server, { config, db });
  await registerTenantRoutes(server, { config, db });

  return server;
}
