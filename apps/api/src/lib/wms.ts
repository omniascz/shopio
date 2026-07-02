/**
 * WMS foundation (per `09-inventory.md` deferral) — warehouses, storage bins,
 * and stocktakes ("Inventury", BaseLinker WMS style). Additive over the existing
 * single-warehouse ledger: applying a stocktake writes `adjustment` movements
 * into `stock_movements` and reconciles `product_variants.stock_on_hand`.
 */

import { and, eq } from 'drizzle-orm';
import { schema, type TenantTx } from '@shopio/db';

/** Pure: physical count minus system stock. */
export function computeVariance(systemQty: number, countedQty: number): number {
  return countedQty - systemQty;
}

export interface ApplyStocktakeResult {
  applied: number; // lines marked applied
  adjustments: number; // ledger movements written (non-zero deltas only)
}

/**
 * Apply an OPEN stocktake inside the caller's tenant transaction: for each
 * counted line, set the variant's on-hand to the counted quantity and write an
 * `adjustment` movement for the LIVE delta (skipping zero deltas — the ledger
 * forbids zero movements). The status guard makes it idempotent: a second call
 * on an already-applied stocktake is a no-op. Returns null if not found.
 */
export async function applyStocktake(
  tx: TenantTx,
  input: { tenantId: string; stocktakeId: string; actorUserId?: string | null },
): Promise<ApplyStocktakeResult | null> {
  const [st] = await tx
    .select({ id: schema.stocktakes.id, status: schema.stocktakes.status })
    .from(schema.stocktakes)
    .where(
      and(eq(schema.stocktakes.tenantId, input.tenantId), eq(schema.stocktakes.id, input.stocktakeId)),
    )
    .for('update')
    .limit(1);
  if (!st) return null;
  if (st.status !== 'open') return { applied: 0, adjustments: 0 };

  const items = await tx
    .select()
    .from(schema.stocktakeItems)
    .where(eq(schema.stocktakeItems.stocktakeId, input.stocktakeId));

  let applied = 0;
  let adjustments = 0;
  for (const item of items) {
    const [variant] = await tx
      .select({ stockOnHand: schema.productVariants.stockOnHand })
      .from(schema.productVariants)
      .where(eq(schema.productVariants.id, item.variantId))
      .for('update')
      .limit(1);
    if (!variant) continue;

    const delta = computeVariance(variant.stockOnHand, item.countedQty);
    if (delta !== 0) {
      await tx
        .update(schema.productVariants)
        .set({ stockOnHand: item.countedQty, updatedAt: new Date() })
        .where(eq(schema.productVariants.id, item.variantId));
      await tx.insert(schema.stockMovements).values({
        tenantId: input.tenantId,
        variantId: item.variantId,
        quantityDelta: delta,
        reason: 'adjustment',
        referenceType: 'stocktake',
        referenceId: input.stocktakeId,
        resultingStockOnHand: item.countedQty,
        actorUserId: input.actorUserId ?? null,
        note: 'stocktake',
      });
      adjustments += 1;
    }
    await tx
      .update(schema.stocktakeItems)
      .set({ applied: true, updatedAt: new Date() })
      .where(eq(schema.stocktakeItems.id, item.id));
    applied += 1;
  }

  await tx
    .update(schema.stocktakes)
    .set({ status: 'applied', appliedAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.stocktakes.id, input.stocktakeId));

  return { applied, adjustments };
}
