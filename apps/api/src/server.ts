import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import { getConfig, corsOrigins } from './config';
import { getDb, getRlsDb } from './db';
import { registerAuthRoutes } from './routes/auth';
import { registerTenantRoutes } from './routes/tenants';
import { registerProductRoutes } from './routes/products';
import { registerStorefrontRoutes } from './routes/storefront';
import { registerCartRoutes } from './routes/cart';
import { registerOrderRoutes } from './routes/orders';
import { registerWebhookRoutes } from './routes/webhooks';
import { registerInvoiceRoutes } from './routes/invoices';
import { registerReturnRoutes } from './routes/returns';
import { registerShipmentRoutes } from './routes/shipments';
import { registerSettingsRoutes, registerSearchAdminRoutes } from './routes/settings';
import { setTenantStatusChecker } from './plugins/auth-middleware';
import { schema } from '@shopio/db';
import { eq, sql } from 'drizzle-orm';
import { registerMediaRoutes } from './routes/media';
import { registerReviewAdminRoutes } from './routes/reviews-admin';
import { registerCouponAdminRoutes } from './routes/coupons-admin';
import { registerCustomerGroupAdminRoutes } from './routes/customer-groups-admin';
import { registerContentExtraRoutes } from './routes/content-extras';
import { registerGiftCardAdminRoutes } from './routes/gift-cards-admin';
import { registerPromotionAdminRoutes } from './routes/promotions-admin';
import { registerFlowAdminRoutes } from './routes/flows-admin';
import { registerCollectionAdminRoutes } from './routes/collections-admin';
import { registerNewsletterAdminRoutes } from './routes/newsletter-admin';
import { registerBundleAdminRoutes } from './routes/bundles-admin';
import { registerCompanyAdminRoutes } from './routes/companies-admin';
import { registerChannelAdminRoutes } from './routes/channels-admin';
import { registerTranslationAdminRoutes } from './routes/translations-admin';
import { registerCmsAdminRoutes } from './routes/cms-admin';
import { registerMarketplaceAdminRoutes } from './routes/marketplace-admin';
import { registerAiAdminRoutes } from './routes/ai-admin';
import { registerWmsAdminRoutes } from './routes/wms-admin';
import { registerMarketplaceChannelAdminRoutes } from './routes/marketplace-channels-admin';
import { registerDeveloperAdminRoutes } from './routes/developer-admin';
import { registerOAuthRoutes } from './routes/oauth';
import { registerLookupRoutes } from './routes/lookup';
import { registerFxRoutes } from './routes/fx';
import { refreshCnbRates } from './lib/fx';
import { registerPaymentAdminRoutes } from './routes/payments-admin';
import { registerPaymentWebhookRoutes } from './routes/payments-webhooks';
import { registerPlanAdminRoutes } from './routes/plan-admin';
import { registerPlatformAdminRoutes } from './routes/platform-admin';
import { registerAnalyticsRoutes } from './routes/analytics';
import {
  registerCustomerAuthRoutes,
  registerCustomerPasswordResetRoutes,
  registerCustomerReturnRoutes,
  registerCustomerVerificationRoutes,
  registerCustomerReviewRoutes,
} from './routes/customer-auth';
import { sweepExpiredReservations } from './lib/inventory';
import { runDueFlowRetries } from './lib/flows';
import { createJobRunner } from './lib/jobs';
import { sweepAbandonedCarts } from './lib/abandoned-cart';
import { runDueSubscriptions } from './lib/subscriptions';

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
  await server.register(multipart); // product media uploads (per-route limits)

  // Global per-IP rate limit (per `30 §10`) — basic abuse / brute-force defense
  // on top of the account lockout. Health probes + provider webhooks (which can
  // legitimately burst) are exempt.
  await server.register(rateLimit, {
    global: true,
    max: config.SHOPIO_RATE_LIMIT_MAX,
    timeWindow: '1 minute',
    allowList: (req) => req.url.startsWith('/health') || req.url.includes('/webhooks/'),
  });

  // Health endpoints (per `31 §RULE-OPS-041`). `live` = process up; `ready` =
  // dependencies reachable (DB), so uptime monitors detect real outages (503).
  server.get('/health/live', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));
  server.get('/health/ready', async (_req, reply) => {
    try {
      await getDb(config).execute(sql`select 1`);
      return { status: 'ok', timestamp: new Date().toISOString() };
    } catch (err) {
      server.log.error({ err }, 'health.ready.db_unreachable');
      return reply.code(503).send({ status: 'unavailable', db: false, timestamp: new Date().toISOString() });
    }
  });
  server.get('/health/startup', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));

  // Root marker
  server.get('/', async () => ({
    name: 'shopio-api',
    version: '0.0.1',
    api_version: '2026-05-20',
    docs: 'https://docs.shopio.com',
  }));

  // Auth + tenant routes (per `30-security.md §16.1`, `36-personas-rbac.md §14`)
  const db = getDb(config);

  // Suspended/closing tenants cannot write via admin APIs (per `30`)
  setTenantStatusChecker(async (tenantId) => {
    const [row] = await db
      .select({ status: schema.tenants.status })
      .from(schema.tenants)
      .where(eq(schema.tenants.id, tenantId))
      .limit(1);
    return row?.status ?? null;
  });
  await registerAuthRoutes(server, { config, db });
  await registerTenantRoutes(server, { config, db });
  await registerProductRoutes(server, { config, db });
  await registerStorefrontRoutes(server, { config, db });
  await registerCartRoutes(server, { config, db });
  await registerOrderRoutes(server, { config, db });
  await registerWebhookRoutes(server, { config, db });
  await registerInvoiceRoutes(server, { config, db });
  await registerReturnRoutes(server, { config, db });
  await registerShipmentRoutes(server, { config, db });
  await registerSettingsRoutes(server, { config, db });
  await registerMediaRoutes(server, { config, db });
  registerSearchAdminRoutes(server, { config, db });
  await registerReviewAdminRoutes(server, { config, db });
  await registerCouponAdminRoutes(server, { config, db });
  await registerCustomerGroupAdminRoutes(server, { config, db });
  await registerContentExtraRoutes(server, { config, db });
  await registerGiftCardAdminRoutes(server, { config, db });
  await registerPromotionAdminRoutes(server, { config, db });
  await registerFlowAdminRoutes(server, { config, db });
  await registerCollectionAdminRoutes(server, { config, db });
  await registerNewsletterAdminRoutes(server, { config, db });
  await registerBundleAdminRoutes(server, { config, db });
  await registerCompanyAdminRoutes(server, { config, db });
  await registerChannelAdminRoutes(server, { config, db });
  await registerTranslationAdminRoutes(server, { config, db });
  await registerCmsAdminRoutes(server, { config, db });
  await registerMarketplaceAdminRoutes(server, { config, db });
  await registerAiAdminRoutes(server, { config, db });
  await registerWmsAdminRoutes(server, { config, db });
  await registerMarketplaceChannelAdminRoutes(server, { config, db });
  await registerDeveloperAdminRoutes(server, { config, db });
  await registerOAuthRoutes(server, { config, db });
  await registerLookupRoutes(server, { config, db });
  await registerFxRoutes(server, { config, db });
  await registerPaymentAdminRoutes(server, { config, db });
  await registerPaymentWebhookRoutes(server, { config, db });
  await registerPlanAdminRoutes(server, { config, db });
  await registerPlatformAdminRoutes(server, { config, db });
  await registerAnalyticsRoutes(server, { config, db });
  await registerCustomerAuthRoutes(server, { config, db });
  await registerCustomerPasswordResetRoutes(server, { config, db });
  await registerCustomerReturnRoutes(server, { config, db });
  await registerCustomerVerificationRoutes(server, { config, db });
  await registerCustomerReviewRoutes(server, { config, db });

  // Background jobs (per `09`/Fáze 1) — driven by the interval backend by
  // default; `JOBS_BACKEND=bullmq` (+ REDIS_URL) switches to durable Redis
  // repeatable jobs. Same handlers either way; overlap-guarded + error-isolated
  // inside the runner.
  const rlsDb = getRlsDb(config);
  const jobs = createJobRunner(config, server.log);

  // JOB-SWEEP-EXPIRED-RESERVATIONS (per `09`) — release expired unpaid holds.
  jobs.register({
    name: 'sweep-expired-reservations',
    everyMs: 5 * 60 * 1000,
    handler: async () => {
      const count = await sweepExpiredReservations(db, server.log);
      if (count > 0) server.log.info({ count }, 'inventory.sweeper.swept');
    },
  });
  // JOB-SEND-ABANDONED-CART-EMAIL (per `11`/`19`) — recovery e-mails.
  jobs.register({
    name: 'send-abandoned-cart-email',
    everyMs: 15 * 60 * 1000,
    handler: async () => {
      const count = await sweepAbandonedCarts(db, config, server.log);
      if (count > 0) server.log.info({ count }, 'abandoned_cart.recovery.sent');
    },
  });
  // JOB-RUN-DUE-SUBSCRIPTIONS (per `24`) — generate recurring orders.
  jobs.register({
    name: 'run-due-subscriptions',
    everyMs: 60 * 60 * 1000,
    handler: async () => {
      const count = await runDueSubscriptions(db, rlsDb, config, server.log);
      if (count > 0) server.log.info({ count }, 'subscriptions.generated');
    },
  });
  // JOB-REFRESH-FX-RATES (P1 multi-currency) — ČNB daily fixing, + once on boot.
  jobs.register({
    name: 'refresh-fx-rates',
    everyMs: 24 * 60 * 60 * 1000,
    runOnStart: true,
    handler: async () => {
      const r = await refreshCnbRates(db);
      if (r) server.log.info({ fixingDate: r.fixingDate, count: r.count }, 'fx.rates.refreshed');
    },
  });
  // JOB-RUN-FLOW-RETRIES (P3 automation) — re-attempt failed flow actions.
  jobs.register({
    name: 'run-flow-retries',
    everyMs: 60 * 1000,
    handler: async () => {
      const count = await runDueFlowRetries({ db, config, log: server.log });
      if (count > 0) server.log.info({ count }, 'flows.retries.advanced');
    },
  });

  await jobs.start();
  server.addHook('onClose', async () => jobs.stop());

  return server;
}
