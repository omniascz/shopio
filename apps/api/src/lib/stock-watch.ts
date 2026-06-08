/**
 * Back-in-stock notifications (Shoptet "Hlídací pes").
 *
 * Shoppers subscribe an e-mail against an out-of-stock variant; when it is
 * restocked we send one notification and stamp `notified_at`. Built on the
 * existing SMTP sender (Mailpit in dev).
 */

import { and, eq, isNull, sql } from 'drizzle-orm';
import { schema, withTenant } from '@shopio/db';
import type { TenantTx } from '@shopio/db';
import type { AppDb } from '../db';
import type { ShopioConfig } from '../config';
import { sendEmail } from './email';

/** Register (or keep) a pending watch for (variant, email). Idempotent. */
export async function addStockWatch(
  tx: TenantTx,
  tenantId: string,
  variantId: string,
  email: string,
): Promise<void> {
  await tx
    .insert(schema.stockWatches)
    .values({ tenantId, variantId, email: email.toLowerCase() })
    .onConflictDoUpdate({
      target: [schema.stockWatches.variantId, schema.stockWatches.email],
      set: { notifiedAt: null, createdAt: sql`now()` }, // re-arm if previously notified
    });
}

/**
 * Notify everyone watching `variantId` that it's back in stock, then stamp the
 * rows so they don't fire again. Best-effort: a failed e-mail leaves the watch
 * pending for the next restock. Runs OUTSIDE the request's RLS tx (own scope).
 */
export async function notifyRestocked(
  rlsDb: AppDb,
  config: ShopioConfig,
  tenantId: string,
  variantId: string,
  log?: { info: (o: object, m: string) => void; warn: (o: object, m: string) => void },
): Promise<number> {
  const ctx = await withTenant(rlsDb, tenantId, async (tx) => {
    const watches = await tx
      .select({ id: schema.stockWatches.id, email: schema.stockWatches.email })
      .from(schema.stockWatches)
      .where(and(eq(schema.stockWatches.variantId, variantId), isNull(schema.stockWatches.notifiedAt)));
    if (watches.length === 0) return null;
    const [v] = await tx
      .select({
        title: schema.productVariants.title,
        productTitle: schema.products.title,
        slug: schema.products.slug,
      })
      .from(schema.productVariants)
      .innerJoin(schema.products, eq(schema.products.id, schema.productVariants.productId))
      .where(eq(schema.productVariants.id, variantId))
      .limit(1);
    const [tenant] = await tx
      .select({ slug: schema.tenants.slug, name: schema.tenants.displayName })
      .from(schema.tenants)
      .where(eq(schema.tenants.id, tenantId))
      .limit(1);
    return { watches, v, tenant };
  });
  if (!ctx?.v || !ctx.tenant) return 0;

  const base = config.SHOPIO_BASE_URL?.replace(/\/$/, '') ?? '';
  const url = `${base}/s/${ctx.tenant.slug}/p/${ctx.v.slug}`;
  const name = `${ctx.v.productTitle}${ctx.v.title && ctx.v.title !== 'Default' ? ` — ${ctx.v.title}` : ''}`;

  let sent = 0;
  for (const w of ctx.watches) {
    try {
      await sendEmail(config, {
        to: w.email,
        subject: `${name} je opět skladem`,
        text: `Dobrá zpráva! ${name} je opět skladem v obchodě ${ctx.tenant.name}.\n\n${url}`,
        html: `<p>Dobrá zpráva! <strong>${name}</strong> je opět skladem v obchodě ${ctx.tenant.name}.</p><p><a href="${url}">Zobrazit produkt</a></p>`,
      });
      sent++;
    } catch (err) {
      log?.warn({ err, email: w.email }, 'stock_watch.notify_failed');
    }
  }
  // Stamp the ones we attempted (so we don't spam on the next stock bump).
  await withTenant(rlsDb, tenantId, (tx) =>
    tx
      .update(schema.stockWatches)
      .set({ notifiedAt: new Date() })
      .where(and(eq(schema.stockWatches.variantId, variantId), isNull(schema.stockWatches.notifiedAt))),
  );
  log?.info({ tenantId, variantId, sent }, 'stock_watch.notified');
  return sent;
}
