/**
 * Public business-register lookups (per `21`) — ARES (CZ IČO → company) + VIES
 * (EU VAT validation). No tenant context, no auth: pure pass-through to the
 * public registers, used by the admin B2B form and the storefront company form.
 * Rate-limited against abuse.
 */

import type { FastifyInstance } from 'fastify';
import { lookupAres, validateVies } from '../lib/ares';
import type { AppDb } from '../db';
import type { ShopioConfig } from '../config';

interface PluginOptions {
  config: ShopioConfig;
  db: AppDb;
}

export async function registerLookupRoutes(app: FastifyInstance, _opts: PluginOptions): Promise<void> {
  const limited = { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } };

  // GET /lookup/ares?ico=12345678 — CZ business register autofill.
  app.get<{ Querystring: { ico?: string } }>(
    '/api/2026-05-20/lookup/ares',
    limited,
    async (req, reply) => {
      const ico = (req.query.ico ?? '').trim();
      if (!/^\d{8}$/.test(ico.replace(/\s/g, ''))) {
        return reply.code(422).send({ error: { code: 'INVALID_ICO', message: 'IČO musí mít 8 číslic' } });
      }
      const company = await lookupAres(ico);
      if (!company.found) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Firma nenalezena' } });
      return reply.send({
        data: {
          ico: company.ico,
          name: company.name,
          vat_id: company.vatId,
          address: company.address,
        },
      });
    },
  );

  // GET /lookup/vies?vat=CZ12345678 — EU VAT validation (reverse-charge gate).
  app.get<{ Querystring: { vat?: string } }>(
    '/api/2026-05-20/lookup/vies',
    limited,
    async (req, reply) => {
      const vat = (req.query.vat ?? '').trim();
      if (vat.length < 4) {
        return reply.code(422).send({ error: { code: 'INVALID_VAT', message: 'Zadejte DIČ vč. kódu země' } });
      }
      const result = await validateVies(vat);
      return reply.send({
        data: {
          valid: result.valid,
          name: result.name ?? null,
          address: result.address ?? null,
          country_code: result.countryCode ?? null,
          vat_number: result.vatNumber ?? null,
        },
      });
    },
  );
}
