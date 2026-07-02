/**
 * Admin WMS — warehouses, storage bins, and stocktakes (per `09-inventory.md`
 * deferral, BaseLinker WMS style).
 *
 *   GET/POST/PATCH  /admin/warehouses[/:pubId]
 *   GET/POST/DELETE /admin/warehouses/:pubId/bins[/:binId]
 *   POST            /admin/stocktakes                 — open a count
 *   POST            /admin/stocktakes/:pubId/items    — record counted lines
 *   GET             /admin/stocktakes/:pubId          — count + per-line variance
 *   POST            /admin/stocktakes/:pubId/apply    — reconcile stock (ledger)
 *   POST            /admin/stocktakes/:pubId/cancel
 *
 * Applying a stocktake writes `adjustment` movements + updates on-hand; it does
 * NOT touch the checkout hot path (sell-side availability keeps reading the
 * aggregate `stock_on_hand`).
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { schema, withTenant, type TenantTx } from '@shopio/db';
import { PERMISSIONS, generatePubId } from '@shopio/authz';
import { requirePermission } from '../plugins/auth-middleware';
import { getRlsDb } from '../db';
import { applyStocktake, computeVariance } from '../lib/wms';
import type { AppDb } from '../db';
import type { ShopioConfig } from '../config';

interface PluginOptions {
  config: ShopioConfig;
  db: AppDb;
}

const WarehouseBody = z.object({
  code: z.string().min(1).max(40),
  name: z.string().min(1).max(200),
  address: z.record(z.string(), z.unknown()).optional(),
  isDefault: z.boolean().optional(),
  priority: z.number().int().optional(),
});
const WarehousePatch = z.object({
  name: z.string().min(1).max(200).optional(),
  address: z.record(z.string(), z.unknown()).optional(),
  isDefault: z.boolean().optional(),
  priority: z.number().int().optional(),
  status: z.enum(['active', 'archived']).optional(),
});
const BinBody = z.object({
  code: z.string().min(1).max(60),
  binType: z.enum(['shelf', 'pallet', 'floor', 'bin', 'other']).optional(),
  maxCapacity: z.number().int().min(0).optional(),
  note: z.string().max(300).optional(),
});
const StocktakeBody = z.object({
  name: z.string().min(1).max(200),
  warehousePubId: z.string().min(1).optional(),
  note: z.string().max(500).optional(),
});
const StocktakeItemsBody = z.object({
  items: z
    .array(z.object({ variant: z.string().min(1), countedQty: z.number().int().min(0) }))
    .min(1)
    .max(500),
});

export async function registerWmsAdminRoutes(app: FastifyInstance, opts: PluginOptions): Promise<void> {
  const rlsDb = getRlsDb(opts.config);
  const guard = { preHandler: [requirePermission(PERMISSIONS.ADMIN_FULL)] };

  // ------------------------------------------------------------------ warehouses
  app.get('/api/2026-05-20/admin/warehouses', guard, async (req, reply) => {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) return noTenant(reply);
    const rows = await withTenant(rlsDb, tenantId, (tx) =>
      tx
        .select()
        .from(schema.warehouses)
        .where(eq(schema.warehouses.tenantId, tenantId))
        .orderBy(schema.warehouses.priority, desc(schema.warehouses.createdAt)),
    );
    return reply.send({ data: { warehouses: rows.map(serializeWarehouse) } });
  });

  app.post('/api/2026-05-20/admin/warehouses', guard, async (req, reply) => {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) return noTenant(reply);
    const parsed = WarehouseBody.safeParse(req.body);
    if (!parsed.success) return validationErr(reply, parsed.error);
    const i = parsed.data;
    const row = await withTenant(rlsDb, tenantId, async (tx) => {
      if (i.isDefault) await clearDefault(tx, tenantId);
      const [r] = await tx
        .insert(schema.warehouses)
        .values({
          tenantId,
          pubId: generatePubId('wh'),
          code: i.code,
          name: i.name,
          ...(i.address && { address: i.address }),
          isDefault: i.isDefault ?? false,
          priority: i.priority ?? 0,
        })
        .returning();
      return r!;
    });
    return reply.code(201).send({ data: serializeWarehouse(row) });
  });

  app.patch<{ Params: { pubId: string } }>(
    '/api/2026-05-20/admin/warehouses/:pubId',
    guard,
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);
      const parsed = WarehousePatch.safeParse(req.body);
      if (!parsed.success) return validationErr(reply, parsed.error);
      const i = parsed.data;
      const row = await withTenant(rlsDb, tenantId, async (tx) => {
        if (i.isDefault) await clearDefault(tx, tenantId);
        const updates: Record<string, unknown> = { updatedAt: new Date() };
        for (const k of ['name', 'address', 'isDefault', 'priority', 'status'] as const) {
          if (i[k] !== undefined) updates[k] = i[k];
        }
        const [r] = await tx
          .update(schema.warehouses)
          .set(updates)
          .where(and(eq(schema.warehouses.tenantId, tenantId), eq(schema.warehouses.pubId, req.params.pubId)))
          .returning();
        return r;
      });
      if (!row) return notFound(reply, 'WAREHOUSE_NOT_FOUND');
      return reply.send({ data: serializeWarehouse(row) });
    },
  );

  // ------------------------------------------------------------------------ bins
  app.get<{ Params: { pubId: string } }>(
    '/api/2026-05-20/admin/warehouses/:pubId/bins',
    guard,
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);
      const result = await withTenant(rlsDb, tenantId, async (tx) => {
        const wh = await findWarehouse(tx, tenantId, req.params.pubId);
        if (!wh) return null;
        const bins = await tx
          .select()
          .from(schema.storageBins)
          .where(eq(schema.storageBins.warehouseId, wh.id))
          .orderBy(schema.storageBins.code);
        return bins;
      });
      if (!result) return notFound(reply, 'WAREHOUSE_NOT_FOUND');
      return reply.send({ data: { bins: result.map(serializeBin) } });
    },
  );

  app.post<{ Params: { pubId: string } }>(
    '/api/2026-05-20/admin/warehouses/:pubId/bins',
    guard,
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);
      const parsed = BinBody.safeParse(req.body);
      if (!parsed.success) return validationErr(reply, parsed.error);
      const i = parsed.data;
      const row = await withTenant(rlsDb, tenantId, async (tx) => {
        const wh = await findWarehouse(tx, tenantId, req.params.pubId);
        if (!wh) return null;
        const [r] = await tx
          .insert(schema.storageBins)
          .values({
            tenantId,
            warehouseId: wh.id,
            code: i.code,
            binType: i.binType ?? 'shelf',
            ...(i.maxCapacity !== undefined && { maxCapacity: i.maxCapacity }),
            ...(i.note && { note: i.note }),
          })
          .returning();
        return r!;
      });
      if (!row) return notFound(reply, 'WAREHOUSE_NOT_FOUND');
      return reply.code(201).send({ data: serializeBin(row) });
    },
  );

  app.delete<{ Params: { pubId: string; binId: string } }>(
    '/api/2026-05-20/admin/warehouses/:pubId/bins/:binId',
    guard,
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);
      const [row] = await withTenant(rlsDb, tenantId, (tx) =>
        tx
          .delete(schema.storageBins)
          .where(and(eq(schema.storageBins.tenantId, tenantId), eq(schema.storageBins.id, req.params.binId)))
          .returning({ id: schema.storageBins.id }),
      );
      if (!row) return notFound(reply, 'BIN_NOT_FOUND');
      return reply.code(204).send();
    },
  );

  // ------------------------------------------------------------------ stocktakes
  app.post('/api/2026-05-20/admin/stocktakes', guard, async (req, reply) => {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) return noTenant(reply);
    const parsed = StocktakeBody.safeParse(req.body);
    if (!parsed.success) return validationErr(reply, parsed.error);
    const i = parsed.data;
    const result = await withTenant(rlsDb, tenantId, async (tx) => {
      let warehouseId: string | null = null;
      if (i.warehousePubId) {
        const wh = await findWarehouse(tx, tenantId, i.warehousePubId);
        if (!wh) return { error: 'WAREHOUSE_NOT_FOUND' as const };
        warehouseId = wh.id;
      }
      const [r] = await tx
        .insert(schema.stocktakes)
        .values({
          tenantId,
          pubId: generatePubId('stk'),
          warehouseId,
          name: i.name,
          ...(i.note && { note: i.note }),
          createdBy: req.auth!.userId ?? null,
        })
        .returning();
      return { row: r! };
    });
    if ('error' in result) return notFound(reply, result.error);
    return reply.code(201).send({ data: serializeStocktake(result.row) });
  });

  app.post<{ Params: { pubId: string } }>(
    '/api/2026-05-20/admin/stocktakes/:pubId/items',
    guard,
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);
      const parsed = StocktakeItemsBody.safeParse(req.body);
      if (!parsed.success) return validationErr(reply, parsed.error);

      const result = await withTenant(rlsDb, tenantId, async (tx) => {
        const st = await findStocktake(tx, tenantId, req.params.pubId);
        if (!st) return { error: 'STOCKTAKE_NOT_FOUND' as const };
        if (st.status !== 'open') return { error: 'STOCKTAKE_NOT_OPEN' as const };

        let recorded = 0;
        const unknown: string[] = [];
        for (const line of parsed.data.items) {
          const [variant] = await tx
            .select({ id: schema.productVariants.id, stockOnHand: schema.productVariants.stockOnHand })
            .from(schema.productVariants)
            .where(and(eq(schema.productVariants.tenantId, tenantId), eq(schema.productVariants.pubId, line.variant)))
            .limit(1);
          if (!variant) {
            unknown.push(line.variant);
            continue;
          }
          const variance = computeVariance(variant.stockOnHand, line.countedQty);
          await tx
            .insert(schema.stocktakeItems)
            .values({
              tenantId,
              stocktakeId: st.id,
              variantId: variant.id,
              systemQty: variant.stockOnHand,
              countedQty: line.countedQty,
              variance,
            })
            .onConflictDoUpdate({
              target: [schema.stocktakeItems.stocktakeId, schema.stocktakeItems.variantId],
              set: { systemQty: variant.stockOnHand, countedQty: line.countedQty, variance, updatedAt: new Date() },
            });
          recorded += 1;
        }
        return { recorded, unknown };
      });
      if ('error' in result) {
        return reply.code(result.error === 'STOCKTAKE_NOT_OPEN' ? 409 : 404).send({
          error: { code: result.error, message: result.error },
        });
      }
      return reply.send({ data: { recorded: result.recorded, unknown_variants: result.unknown } });
    },
  );

  app.get<{ Params: { pubId: string } }>(
    '/api/2026-05-20/admin/stocktakes/:pubId',
    guard,
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);
      const result = await withTenant(rlsDb, tenantId, async (tx) => {
        const [st] = await tx
          .select()
          .from(schema.stocktakes)
          .where(and(eq(schema.stocktakes.tenantId, tenantId), eq(schema.stocktakes.pubId, req.params.pubId)))
          .limit(1);
        if (!st) return null;
        const items = await tx
          .select({
            variant: schema.productVariants.pubId,
            sku: schema.productVariants.sku,
            systemQty: schema.stocktakeItems.systemQty,
            countedQty: schema.stocktakeItems.countedQty,
            variance: schema.stocktakeItems.variance,
            applied: schema.stocktakeItems.applied,
          })
          .from(schema.stocktakeItems)
          .innerJoin(schema.productVariants, eq(schema.stocktakeItems.variantId, schema.productVariants.id))
          .where(eq(schema.stocktakeItems.stocktakeId, st.id));
        return { st, items };
      });
      if (!result) return notFound(reply, 'STOCKTAKE_NOT_FOUND');
      return reply.send({
        data: { ...serializeStocktake(result.st), items: result.items },
      });
    },
  );

  app.post<{ Params: { pubId: string } }>(
    '/api/2026-05-20/admin/stocktakes/:pubId/apply',
    guard,
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);
      const result = await withTenant(rlsDb, tenantId, async (tx) => {
        const st = await findStocktake(tx, tenantId, req.params.pubId);
        if (!st) return null;
        return applyStocktake(tx, { tenantId, stocktakeId: st.id, actorUserId: req.auth!.userId });
      });
      if (!result) return notFound(reply, 'STOCKTAKE_NOT_FOUND');
      return reply.send({ data: result });
    },
  );

  app.post<{ Params: { pubId: string } }>(
    '/api/2026-05-20/admin/stocktakes/:pubId/cancel',
    guard,
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);
      const [row] = await withTenant(rlsDb, tenantId, (tx) =>
        tx
          .update(schema.stocktakes)
          .set({ status: 'cancelled', updatedAt: new Date() })
          .where(
            and(
              eq(schema.stocktakes.tenantId, tenantId),
              eq(schema.stocktakes.pubId, req.params.pubId),
              eq(schema.stocktakes.status, 'open'),
            ),
          )
          .returning({ id: schema.stocktakes.id }),
      );
      if (!row) return notFound(reply, 'STOCKTAKE_NOT_FOUND_OR_NOT_OPEN');
      return reply.send({ data: { ok: true } });
    },
  );
}

// ----------------------------------------------------------------------- helpers
async function clearDefault(tx: TenantTx, tenantId: string): Promise<void> {
  await tx
    .update(schema.warehouses)
    .set({ isDefault: false, updatedAt: new Date() })
    .where(and(eq(schema.warehouses.tenantId, tenantId), eq(schema.warehouses.isDefault, true)));
}
async function findWarehouse(
  tx: TenantTx,
  tenantId: string,
  pubId: string,
): Promise<{ id: string } | undefined> {
  const [w] = await tx
    .select({ id: schema.warehouses.id })
    .from(schema.warehouses)
    .where(and(eq(schema.warehouses.tenantId, tenantId), eq(schema.warehouses.pubId, pubId)))
    .limit(1);
  return w;
}
async function findStocktake(
  tx: TenantTx,
  tenantId: string,
  pubId: string,
): Promise<{ id: string; status: string } | undefined> {
  const [s] = await tx
    .select({ id: schema.stocktakes.id, status: schema.stocktakes.status })
    .from(schema.stocktakes)
    .where(and(eq(schema.stocktakes.tenantId, tenantId), eq(schema.stocktakes.pubId, pubId)))
    .limit(1);
  return s;
}

function serializeWarehouse(w: typeof schema.warehouses.$inferSelect) {
  return {
    id: w.pubId,
    code: w.code,
    name: w.name,
    address: w.address,
    is_default: w.isDefault,
    priority: w.priority,
    status: w.status,
    created_at: w.createdAt,
  };
}
function serializeBin(b: typeof schema.storageBins.$inferSelect) {
  return { id: b.id, code: b.code, bin_type: b.binType, max_capacity: b.maxCapacity, note: b.note };
}
function serializeStocktake(s: typeof schema.stocktakes.$inferSelect) {
  return {
    id: s.pubId,
    name: s.name,
    status: s.status,
    warehouse_id: s.warehouseId,
    note: s.note,
    applied_at: s.appliedAt,
    created_at: s.createdAt,
  };
}

function noTenant(reply: any) {
  return reply.code(400).send({ error: { code: 'NO_ACTIVE_TENANT', message: 'Select a tenant first' } });
}
function notFound(reply: any, code: string) {
  return reply.code(404).send({ error: { code, message: 'Not found' } });
}
function validationErr(reply: any, error: z.ZodError) {
  return reply.code(422).send({
    error: { code: 'VALIDATION_FAILED', message: 'Invalid input', field_errors: error.flatten().fieldErrors },
  });
}
