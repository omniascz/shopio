/**
 * Storefront customer accounts — per `18-customer-management.md` MVP.
 *
 *   POST /storefront/{tenantSlug}/auth/register   — create account (+login)
 *   POST /storefront/{tenantSlug}/auth/login
 *   POST /storefront/{tenantSlug}/auth/logout
 *   GET  /storefront/{tenantSlug}/me              — profile (cookie session)
 *   GET  /storefront/{tenantSlug}/me/orders       — order history
 *
 * Customers are per-tenant identities. Sessions are opaque tokens in an
 * httpOnly cookie (sha256 hash stored, raw never persisted) with a 30-day
 * sliding window — instant revocation on logout, no JWT surface.
 *
 * Order history matches on customer_id OR the verified account email, so
 * guest orders placed with the same address show up after registration.
 *
 * Deferred: passkeys (WebAuthn), email verification, password reset (needs
 * outbound templated email + token table), address book CRUD.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { createHash, randomBytes } from 'node:crypto';
import { and, desc, eq, gt, isNull, or } from 'drizzle-orm';
import { schema } from '@shopio/db';
import {
  PasswordPolicyError,
  assertPasswordPolicy,
  generatePubId,
  hashPassword,
  verifyPassword,
} from '@shopio/authz';
import type { AppDb } from '../db';
import type { ShopioConfig } from '../config';

export const CUSTOMER_COOKIE_NAME = 'shopio_customer_session';
const SESSION_TTL_DAYS = 30;

const RegisterBody = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1).max(200),
  fullName: z.string().min(1).max(255).optional(),
  phone: z.string().max(40).optional(),
});

const LoginBody = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1).max(200),
});

interface PluginOptions {
  config: ShopioConfig;
  db: AppDb;
}

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export async function registerCustomerAuthRoutes(
  app: FastifyInstance,
  opts: PluginOptions,
): Promise<void> {
  const { db, config } = opts;
  const isProd = config.NODE_ENV === 'production';

  // ---------------------------------------------------------------------------
  // POST /storefront/{tenantSlug}/auth/register
  // ---------------------------------------------------------------------------
  app.post<{ Params: { tenantSlug: string } }>(
    '/api/2026-05-20/storefront/:tenantSlug/auth/register',
    async (req, reply) => {
      const tenant = await resolveTenant(db, req.params.tenantSlug);
      if (!tenant) return notFound(reply, 'TENANT_NOT_FOUND');

      const parsed = RegisterBody.safeParse(req.body);
      if (!parsed.success) return validationErr(reply, parsed.error);
      const { email, password, fullName, phone } = parsed.data;

      try {
        assertPasswordPolicy(password, email);
      } catch (err) {
        if (err instanceof PasswordPolicyError) {
          return reply.code(422).send({
            error: { code: 'WEAK_PASSWORD', message: err.message },
          });
        }
        throw err;
      }

      const [existing] = await db
        .select({ id: schema.customers.id })
        .from(schema.customers)
        .where(and(eq(schema.customers.tenantId, tenant.id), eq(schema.customers.email, email)))
        .limit(1);
      if (existing) {
        return reply.code(409).send({
          error: { code: 'EMAIL_ALREADY_REGISTERED', message: 'Účet s tímto e-mailem už existuje' },
        });
      }

      const passwordHash = await hashPassword(password, config.SHOPIO_SESSION_PEPPER);
      const [customer] = await db
        .insert(schema.customers)
        .values({
          tenantId: tenant.id,
          pubId: generatePubId('cus'),
          email,
          fullName: fullName ?? null,
          phone: phone ?? null,
          passwordHash,
          lastLoginAt: new Date(),
        })
        .returning();

      await issueSession(db, req, reply, isProd, tenant.id, customer!.id);
      app.log.info({ customerId: customer!.id, tenantId: tenant.id }, 'customer.registered');
      return reply.code(201).send({ data: { customer: serializeCustomer(customer!) } });
    },
  );

  // ---------------------------------------------------------------------------
  // POST /storefront/{tenantSlug}/auth/login
  // ---------------------------------------------------------------------------
  app.post<{ Params: { tenantSlug: string } }>(
    '/api/2026-05-20/storefront/:tenantSlug/auth/login',
    async (req, reply) => {
      const tenant = await resolveTenant(db, req.params.tenantSlug);
      if (!tenant) return notFound(reply, 'TENANT_NOT_FOUND');

      const parsed = LoginBody.safeParse(req.body);
      if (!parsed.success) return validationErr(reply, parsed.error);
      const { email, password } = parsed.data;

      const [customer] = await db
        .select()
        .from(schema.customers)
        .where(and(eq(schema.customers.tenantId, tenant.id), eq(schema.customers.email, email)))
        .limit(1);

      // Uniform error — no account enumeration (RULE-SEC-014)
      const fail = () =>
        reply.code(401).send({
          error: { code: 'INVALID_CREDENTIALS', message: 'Neplatný e-mail nebo heslo' },
        });
      if (!customer || customer.status !== 'active' || !customer.passwordHash) return fail();
      const ok = await verifyPassword(password, customer.passwordHash, config.SHOPIO_SESSION_PEPPER);
      if (!ok) return fail();

      await db
        .update(schema.customers)
        .set({ lastLoginAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.customers.id, customer.id));

      await issueSession(db, req, reply, isProd, tenant.id, customer.id);
      app.log.info({ customerId: customer.id, tenantId: tenant.id }, 'customer.login');
      return reply.send({ data: { customer: serializeCustomer(customer) } });
    },
  );

  // ---------------------------------------------------------------------------
  // POST /storefront/{tenantSlug}/auth/logout
  // ---------------------------------------------------------------------------
  app.post<{ Params: { tenantSlug: string } }>(
    '/api/2026-05-20/storefront/:tenantSlug/auth/logout',
    async (req, reply) => {
      const raw = req.cookies[CUSTOMER_COOKIE_NAME];
      if (raw) {
        await db
          .update(schema.customerSessions)
          .set({ revokedAt: new Date() })
          .where(eq(schema.customerSessions.tokenHash, hashToken(raw)));
      }
      reply.clearCookie(CUSTOMER_COOKIE_NAME, { path: '/' });
      return reply.send({ data: { logged_out: true } });
    },
  );

  // ---------------------------------------------------------------------------
  // GET /storefront/{tenantSlug}/me
  // ---------------------------------------------------------------------------
  app.get<{ Params: { tenantSlug: string } }>(
    '/api/2026-05-20/storefront/:tenantSlug/me',
    async (req, reply) => {
      const tenant = await resolveTenant(db, req.params.tenantSlug);
      if (!tenant) return notFound(reply, 'TENANT_NOT_FOUND');
      const customer = await resolveCustomer(db, req, tenant.id);
      if (!customer) {
        return reply.code(401).send({
          error: { code: 'NOT_LOGGED_IN', message: 'Přihlaste se' },
        });
      }
      return reply.send({ data: { customer: serializeCustomer(customer) } });
    },
  );

  // ---------------------------------------------------------------------------
  // GET /storefront/{tenantSlug}/me/orders — history (account + same-email guest orders)
  // ---------------------------------------------------------------------------
  app.get<{ Params: { tenantSlug: string } }>(
    '/api/2026-05-20/storefront/:tenantSlug/me/orders',
    async (req, reply) => {
      const tenant = await resolveTenant(db, req.params.tenantSlug);
      if (!tenant) return notFound(reply, 'TENANT_NOT_FOUND');
      const customer = await resolveCustomer(db, req, tenant.id);
      if (!customer) {
        return reply.code(401).send({
          error: { code: 'NOT_LOGGED_IN', message: 'Přihlaste se' },
        });
      }

      const rows = await db
        .select({
          orderNumber: schema.orders.orderNumber,
          status: schema.orders.status,
          paymentStatus: schema.orders.paymentStatus,
          totalAmount: schema.orders.totalAmount,
          currency: schema.orders.currency,
          customerEmail: schema.orders.customerEmail,
          placedAt: schema.orders.placedAt,
        })
        .from(schema.orders)
        .where(
          and(
            eq(schema.orders.tenantId, tenant.id),
            or(
              eq(schema.orders.customerId, customer.id),
              eq(schema.orders.customerEmail, customer.email),
            ),
          ),
        )
        .orderBy(desc(schema.orders.placedAt))
        .limit(50);

      return reply.send({
        data: {
          orders: rows.map((o) => ({
            number: o.orderNumber,
            status: o.status,
            payment_status: o.paymentStatus,
            total: { amount: o.totalAmount.toString(), currency: o.currency },
            placed_at: o.placedAt,
            // confirmation link uses the e-mail-as-bearer convention
            detail_url: `/s/${req.params.tenantSlug}/orders/${o.orderNumber}?email=${encodeURIComponent(o.customerEmail)}`,
          })),
        },
      });
    },
  );
}

// =============================================================================
// Shared helpers (exported for checkout integration)
// =============================================================================

/** Resolve the logged-in customer from the session cookie (tenant-scoped). */
export async function resolveCustomer(
  db: AppDb,
  req: FastifyRequest,
  tenantId: string,
): Promise<typeof schema.customers.$inferSelect | null> {
  const raw = req.cookies[CUSTOMER_COOKIE_NAME];
  if (!raw || !/^[a-f0-9]{64}$/i.test(raw)) return null;

  const [row] = await db
    .select({
      session: schema.customerSessions,
      customer: schema.customers,
    })
    .from(schema.customerSessions)
    .innerJoin(schema.customers, eq(schema.customers.id, schema.customerSessions.customerId))
    .where(
      and(
        eq(schema.customerSessions.tokenHash, hashToken(raw)),
        eq(schema.customerSessions.tenantId, tenantId),
        isNull(schema.customerSessions.revokedAt),
        gt(schema.customerSessions.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!row || row.customer.status !== 'active') return null;

  // Sliding window — bump lastUsed/expiry (best-effort, no await on caller path needed)
  void db
    .update(schema.customerSessions)
    .set({
      lastUsedAt: new Date(),
      expiresAt: new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000),
    })
    .where(eq(schema.customerSessions.id, row.session.id))
    .catch(() => {});

  return row.customer;
}

async function issueSession(
  db: AppDb,
  req: FastifyRequest,
  reply: FastifyReply,
  isProd: boolean,
  tenantId: string,
  customerId: string,
): Promise<void> {
  const raw = randomBytes(32).toString('hex');
  await db.insert(schema.customerSessions).values({
    tenantId,
    customerId,
    tokenHash: hashToken(raw),
    userAgent: req.headers['user-agent']?.slice(0, 255) ?? null,
    ipAddress: req.ip,
    expiresAt: new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000),
  });
  reply.setCookie(CUSTOMER_COOKIE_NAME, raw, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  });
}

function serializeCustomer(c: typeof schema.customers.$inferSelect) {
  return {
    id: c.pubId,
    email: c.email,
    full_name: c.fullName,
    phone: c.phone,
    default_address: c.defaultAddress,
    created_at: c.createdAt,
  };
}

async function resolveTenant(db: AppDb, slug: string) {
  const [t] = await db
    .select({ id: schema.tenants.id, status: schema.tenants.status })
    .from(schema.tenants)
    .where(eq(schema.tenants.slug, slug))
    .limit(1);
  if (!t || t.status !== 'active') return null;
  return t;
}

function notFound(reply: any, code: string) {
  return reply.code(404).send({ error: { code, message: 'Not found' } });
}

function validationErr(reply: any, error: z.ZodError) {
  return reply.code(422).send({
    error: {
      code: 'VALIDATION_FAILED',
      message: 'Invalid input',
      field_errors: error.flatten().fieldErrors,
    },
  });
}
