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
import { eq } from 'drizzle-orm';
import { registerMediaRoutes } from './routes/media';
import { registerReviewAdminRoutes } from './routes/reviews-admin';
import { registerCouponAdminRoutes } from './routes/coupons-admin';
import { registerGiftCardAdminRoutes } from './routes/gift-cards-admin';
import { registerCompanyAdminRoutes } from './routes/companies-admin';
import { registerChannelAdminRoutes } from './routes/channels-admin';
import { registerTranslationAdminRoutes } from './routes/translations-admin';
import { registerCmsAdminRoutes } from './routes/cms-admin';
import { registerMarketplaceAdminRoutes } from './routes/marketplace-admin';
import { registerAiAdminRoutes } from './routes/ai-admin';
import { registerDeveloperAdminRoutes } from './routes/developer-admin';
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

  // Health endpoints (per `31 §RULE-OPS-041`)
  server.get('/health/live', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));
  server.get('/health/ready', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));
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
  await registerGiftCardAdminRoutes(server, { config, db });
  await registerCompanyAdminRoutes(server, { config, db });
  await registerChannelAdminRoutes(server, { config, db });
  await registerTranslationAdminRoutes(server, { config, db });
  await registerCmsAdminRoutes(server, { config, db });
  await registerMarketplaceAdminRoutes(server, { config, db });
  await registerAiAdminRoutes(server, { config, db });
  await registerDeveloperAdminRoutes(server, { config, db });
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

  // JOB-SWEEP-EXPIRED-RESERVATIONS (per `09`) — dev-grade interval timer;
  // BullMQ takes over in a later wave. Releases expired unpaid holds and
  // cancels their orders. Guarded against overlapping runs.
  let sweeping = false;
  const sweepInterval = setInterval(() => {
    if (sweeping) return;
    sweeping = true;
    void sweepExpiredReservations(db, server.log)
      .then((count) => {
        if (count > 0) server.log.info({ count }, 'inventory.sweeper.swept');
      })
      .catch((err) => server.log.error({ err }, 'inventory.sweeper.failed'))
      .finally(() => {
        sweeping = false;
      });
  }, 5 * 60 * 1000);
  sweepInterval.unref(); // never keep the process alive just for the sweeper
  server.addHook('onClose', async () => clearInterval(sweepInterval));

  // JOB-SEND-ABANDONED-CART-EMAIL (per `11`/`19`) — recovery e-mails for idle
  // carts of logged-in customers. Every 15 min; BullMQ later. Guarded.
  let recovering = false;
  const recoveryInterval = setInterval(() => {
    if (recovering) return;
    recovering = true;
    void sweepAbandonedCarts(db, config, server.log)
      .then((count) => {
        if (count > 0) server.log.info({ count }, 'abandoned_cart.recovery.sent');
      })
      .catch((err) => server.log.error({ err }, 'abandoned_cart.recovery.failed'))
      .finally(() => {
        recovering = false;
      });
  }, 15 * 60 * 1000);
  recoveryInterval.unref();
  server.addHook('onClose', async () => clearInterval(recoveryInterval));

  // JOB-RUN-DUE-SUBSCRIPTIONS (per `24`) — generate recurring orders. Hourly;
  // BullMQ later. Guarded against overlap.
  const rlsDb = getRlsDb(config);
  let subRunning = false;
  const subInterval = setInterval(() => {
    if (subRunning) return;
    subRunning = true;
    void runDueSubscriptions(db, rlsDb, config, server.log)
      .then((count) => {
        if (count > 0) server.log.info({ count }, 'subscriptions.generated');
      })
      .catch((err) => server.log.error({ err }, 'subscriptions.run_failed'))
      .finally(() => {
        subRunning = false;
      });
  }, 60 * 60 * 1000);
  subInterval.unref();
  server.addHook('onClose', async () => clearInterval(subInterval));

  return server;
}
