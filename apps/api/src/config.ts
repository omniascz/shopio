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

  // Secrets
  SHOPIO_JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 chars'),
  SHOPIO_SESSION_PEPPER: z.string().min(16),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:3030,http://localhost:3031'),

  // Stripe (optional — falls back to mock if absent or placeholder).
  // Real keys are >40 chars; placeholders like "sk_test_..." (or empty) → mock mode.
  STRIPE_SECRET_KEY: stripeKeySchema('sk_'),
  STRIPE_WEBHOOK_SECRET: stripeKeySchema('whsec_'),
  STRIPE_PUBLISHABLE_KEY: stripeKeySchema('pk_'),

  // Zásilkovna / Packeta (optional — when absent the storefront falls back to the
  // seeded pickup-point picker instead of the Packeta JS widget).
  PACKETA_API_KEY: z.string().min(8).optional(),

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
});

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
