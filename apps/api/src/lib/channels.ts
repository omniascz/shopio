/**
 * Sales channel helpers (per `22-multistore-channels.md` MVP).
 */

import { and, eq } from 'drizzle-orm';
import { schema } from '@shopio/db';
import { generatePubId } from '@shopio/authz';
import type { AppDb } from '../db';

type DbConn = AppDb | Parameters<Parameters<AppDb['transaction']>[0]>[0];

type Channel = typeof schema.channels.$inferSelect;
type ChannelKind = Channel['kind'];

/** Channels every new tenant gets. `web` + `manual` active out of the box. */
export const DEFAULT_CHANNELS: {
  code: string;
  kind: ChannelKind;
  name: string;
  isActive: boolean;
}[] = [
  { code: 'web', kind: 'storefront_web', name: 'Webový obchod', isActive: true },
  { code: 'manual', kind: 'manual', name: 'Ruční / telefonická objednávka', isActive: true },
  { code: 'pos', kind: 'pos', name: 'Prodejna (POS)', isActive: false },
];

/** Idempotently create the default channels for a tenant. Safe to re-run. */
export async function seedDefaultChannels(db: DbConn, tenantId: string): Promise<void> {
  await db
    .insert(schema.channels)
    .values(
      DEFAULT_CHANNELS.map((c) => ({
        tenantId,
        pubId: generatePubId('chn'),
        code: c.code,
        kind: c.kind,
        name: c.name,
        isActive: c.isActive,
      })),
    )
    .onConflictDoNothing({ target: [schema.channels.tenantId, schema.channels.code] });
}

/**
 * Resolve a channel by code, creating it from defaults if missing (covers
 * tenants provisioned before the channels table existed). Returns the row.
 */
export async function getOrCreateChannel(
  db: AppDb,
  tenantId: string,
  code: string,
): Promise<Channel | null> {
  const [existing] = await db
    .select()
    .from(schema.channels)
    .where(and(eq(schema.channels.tenantId, tenantId), eq(schema.channels.code, code)))
    .limit(1);
  if (existing) return existing;

  const def = DEFAULT_CHANNELS.find((c) => c.code === code);
  if (!def) return null;
  await seedDefaultChannels(db, tenantId);
  const [created] = await db
    .select()
    .from(schema.channels)
    .where(and(eq(schema.channels.tenantId, tenantId), eq(schema.channels.code, code)))
    .limit(1);
  return created ?? null;
}

export function serializeChannel(c: Channel) {
  return {
    id: c.pubId,
    code: c.code,
    kind: c.kind,
    name: c.name,
    is_active: c.isActive,
    created_at: c.createdAt,
  };
}
