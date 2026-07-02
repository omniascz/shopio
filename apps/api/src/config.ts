/**
 * Runtime config loader. Reads from process.env (populated by `.env`).
 *
 * Per `30-security.md §7.x` — secrets never logged.
 */

import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';

// Load .env from app, or workspace root
const __dirname = dirname(fileURLToPath(import.meta.url));
for (const candidate of [
  resolve(__dirname, '..', '.env'),
  resolve(__dirname, '..', '..', '..', '.env'),
]) {
  if (existsSync(candidate)) {
    loadEnv({ path: candidate });
    break;
  }
}

const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  PORT: z.coerce.number().int().positive().default(4040),
  HOST: z.string().default('0.0.0.0'),

  // URLs
  SHOPIO_BASE_URL: z.string().url().default('http://localhost:3030'),
  SHOPIO_ADMIN_URL: z.string().url().default('http://localhost:3031'),
  SHOPIO_API_URL: z.string().url().default('http://localhost:4040'),

  // Database
  DATABASE_URL: z.string().url(),
  /** Non-superuser role connection for RLS-enforced tenant queries (per `30`).
   *  Falls back to DATABASE_URL when unset (RLS dormant — superuser bypasses). */
  DATABASE_URL_APP: optionalNonEmpty(z.string().url()),

  // Secrets
  SHOPIO_JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 chars'),
  SHOPIO_SESSION_PEPPER: z.string().min(16),

  /** Platform operator allowlist (comma-separated e-mails) — these users get the
   * cross-tenant master-admin back-office (per `30`/`36`). Empty = disabled. */
  PLATFORM_ADMIN_EMAILS: z.string().default(''),

  /** 32-byte key (64 hex chars) for encrypting stored gateway secrets at rest
   * (per `30`). Absent → secrets stored plaintext (dev). Set in production. */
  SHOPIO_SECRET_KEY: z.preprocess(
    (v) => (typeof v === 'string' && /^[0-9a-fA-F]{64}$/.test(v) ? v : undefined),
    z.string().length(64).optional(),
  ),

  // Background jobs (per `09`/Fáze 1) — `interval` (default, in-process timers)
  // or `bullmq` (durable, distributed; requires REDIS_URL). Prod sets bullmq.
  JOBS_BACKEND: z.enum(['interval', 'bullmq']).default('interval'),
  REDIS_URL: z.string().optional(),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:3030,http://localhost:3031'),

  /** Global per-IP rate limit (requests / minute). Health + webhooks exempt. */
  SHOPIO_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),

  // Stripe (optional — falls back to mock if absent or placeholder).
  // Real keys are >40 chars; placeholders like "sk_test_..." (or empty) → mock mode.
  STRIPE_SECRET_KEY: stripeKeySchema('sk_'),
  STRIPE_WEBHOOK_SECRET: stripeKeySchema('whsec_'),
  STRIPE_PUBLISHABLE_KEY: stripeKeySchema('pk_'),

  // AI (Anthropic, per `33`) — optional; absent/placeholder → deterministic
  // mock so the "Generate" actions work in dev/CI without a key.
  ANTHROPIC_API_KEY: z.preprocess((v) => {
    if (typeof v !== 'string') return undefined;
    if (v.length < 40 || !v.startsWith('sk-ant-') || v.includes('...')) return undefined;
    return v;
  }, z.string().min(40).optional()),

  // Zásilkovna / Packeta (optional — when absent the storefront falls back to the
  // seeded pickup-point picker instead of the Packeta JS widget).
  PACKETA_API_KEY: optionalNonEmpty(z.string().min(8)),
  /** REST API password (different secret than the widget key) — when absent,
   * label generation runs in mock mode (fake barcode + placeholder PDF). */
  PACKETA_API_PASSWORD: optionalNonEmpty(z.string().min(8)),

  // Meilisearch (optional — storefront search falls back to ILIKE when absent)
  MEILISEARCH_HOST: optionalNonEmpty(z.string().url()),
  MEILISEARCH_API_KEY: optionalNonEmpty(z.string()),

  // Object storage (MinIO in dev; S3-compatible in prod) — product media
  SHOPIO_S3_ENDPOINT: z.string().url().default('http://localhost:9100'),
  SHOPIO_S3_REGION: z.string().default('us-east-1'),
  SHOPIO_S3_ACCESS_KEY: z.string().default('minioadmin'),
  SHOPIO_S3_SECRET_KEY: z.string().default('minioadmin'),
  SHOPIO_S3_BUCKET_MEDIA: z.string().default('shopio-dev-media'),
  /** Public base for stored objects (defaults to endpoint/bucket — MinIO path style). */
  SHOPIO_S3_PUBLIC_URL: optionalNonEmpty(z.string().url()),

  // SMTP (Mailpit in dev; Postmark/SendGrid in prod via SMTP relay)
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().positive().default(1027),
  SMTP_USER: z.string().default(''),
  SMTP_PASSWORD: z.string().default(''),
  SMTP_FROM: z.string().default('Shopio Dev <hello@shopio.local>'),
  SMTP_ENABLED: z
    .preprocess(
      (v) => (typeof v === 'string' ? v.toLowerCase() === 'true' : Boolean(v)),
      z.boolean(),
    )
    .default(true),

  // SMS notifications (Shoptet "SMS upozornění" — third-party gateway). A generic
  // HTTP gateway: POST {to, text, from} to SMS_GATEWAY_URL. Absent URL → disabled
  // (no-op), like SMTP. CZ gateways (SMSbrana, GoSMS) fit this shape.
  SMS_GATEWAY_URL: z.string().default(''),
  SMS_API_KEY: z.string().default(''),
  SMS_SENDER: z.string().default(''),
  SMS_ENABLED: z
    .preprocess(
      (v) => (typeof v === 'string' ? v.toLowerCase() === 'true' : Boolean(v)),
      z.boolean(),
    )
    .default(false),
});

/** Optional env vars: orchestrators pass empty strings — treat them as unset. */
function optionalNonEmpty<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    schema.optional(),
  );
}

function stripeKeySchema(prefix: string) {
  return z.preprocess((v) => {
    if (typeof v !== 'string') return undefined;
    if (v.length < 30 || !v.startsWith(prefix) || v.includes('...')) return undefined;
    return v;
  }, z.string().min(30).optional());
}

export type ShopioConfig = z.infer<typeof ConfigSchema>;

let _cached: ShopioConfig | null = null;

export function getConfig(): ShopioConfig {
  if (_cached) return _cached;
  const parsed = ConfigSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('❌ Invalid environment configuration:');
    for (const issue of parsed.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }
  _cached = parsed.data;
  return _cached;
}

export function corsOrigins(cfg: ShopioConfig): string[] {
  return cfg.CORS_ORIGIN.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
