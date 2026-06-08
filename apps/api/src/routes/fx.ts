/**
 * FX endpoints (P1 multi-currency) — ČNB daily rates.
 *   POST /admin/fx/refresh            — pull the latest ČNB fixing (admin)
 *   GET  /exchange-rates              — public: current rates (for presentment)
 */

import type { FastifyInstance } from 'fastify';
import { PERMISSIONS } from '@shopio/authz';
import { requirePermission } from '../plugins/auth-middleware';
import { loadRates, refreshCnbRates } from '../lib/fx';
import type { AppDb } from '../db';
import type { ShopioConfig } from '../config';

interface PluginOptions {
  config: ShopioConfig;
  db: AppDb;
}

export async function registerFxRoutes(app: FastifyInstance, opts: PluginOptions): Promise<void> {
  const { db } = opts;

  app.post(
    '/api/2026-05-20/admin/fx/refresh',
    { preHandler: [requirePermission(PERMISSIONS.ADMIN_FULL)] },
    async (_req, reply) => {
      const result = await refreshCnbRates(db);
      if (!result) {
        return reply.code(502).send({ error: { code: 'FX_REFRESH_FAILED', message: 'ČNB nedostupné' } });
      }
      return reply.send({ data: result });
    },
  );

  // Public — the storefront uses this to present prices in CZK/EUR/PLN/…
  app.get(
    '/api/2026-05-20/exchange-rates',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (_req, reply) => {
      const rates = await loadRates(db);
      return reply
        .header('cache-control', 'public, max-age=3600')
        .send({
          data: {
            base: 'CZK',
            rates: [...rates.values()].map((r) => ({ currency: r.currency, amount: r.amount, rate: r.rate })),
          },
        });
    },
  );
}
