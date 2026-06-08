/**
 * Bundle composition logic (per `06-catalog-pim.md` §3.5 + RULE-PRODUCT-004/013).
 *
 * A bundle product (`products.type='bundle'`) lists child variants via
 * `product_bundle_items`. The bundle carries its own price; these helpers
 * resolve the component list, derive availability from the children
 * (min over children of floor(child_available / qty)), and guard against
 * composition cycles.
 */

import { and, asc, eq, inArray } from 'drizzle-orm';
import { schema } from '@shopio/db';
import type { TenantTx } from '@shopio/db';
import type { AppDb } from '../db';

type Db = AppDb | TenantTx;

export interface BundleComponent {
  id: string; // bundle item pub-less id (uuid)
  childVariantId: string;
  childVariantPubId: string;
  productPubId: string;
  productSlug: string;
  title: string;
  variantTitle: string;
  sku: string | null;
  quantity: number;
  isOptional: boolean;
  position: number;
  /** Units of this child currently sellable. */
  availableUnits: number;
  allowBackorder: boolean;
}

/**
 * Load a bundle's components (joined to variant + product) with per-child
 * available units. Returns [] for non-bundle products / empty bundles.
 */
export async function loadBundleComponents(
  db: Db,
  tenantId: string,
  bundleId: string,
): Promise<BundleComponent[]> {
  const rows = await db
    .select({
      id: schema.productBundleItems.id,
      childVariantId: schema.productBundleItems.childVariantId,
      quantity: schema.productBundleItems.quantity,
      isOptional: schema.productBundleItems.isOptional,
      position: schema.productBundleItems.position,
      childVariantPubId: schema.productVariants.pubId,
      title: schema.productVariants.title,
      sku: schema.productVariants.sku,
      stockOnHand: schema.productVariants.stockOnHand,
      stockReserved: schema.productVariants.stockReserved,
      allowBackorder: schema.productVariants.allowBackorder,
      productPubId: schema.products.pubId,
      productSlug: schema.products.slug,
      productTitle: schema.products.title,
    })
    .from(schema.productBundleItems)
    .innerJoin(
      schema.productVariants,
      eq(schema.productBundleItems.childVariantId, schema.productVariants.id),
    )
    .innerJoin(schema.products, eq(schema.productVariants.productId, schema.products.id))
    .where(
      and(
        eq(schema.productBundleItems.tenantId, tenantId),
        eq(schema.productBundleItems.bundleId, bundleId),
      ),
    )
    .orderBy(asc(schema.productBundleItems.position));

  return rows.map((r) => ({
    id: r.id,
    childVariantId: r.childVariantId,
    childVariantPubId: r.childVariantPubId,
    productPubId: r.productPubId,
    productSlug: r.productSlug,
    title: r.productTitle,
    variantTitle: r.title,
    sku: r.sku,
    quantity: r.quantity,
    isOptional: r.isOptional,
    position: r.position,
    availableUnits: Math.max(0, r.stockOnHand - r.stockReserved),
    allowBackorder: r.allowBackorder,
  }));
}

/**
 * How many whole bundles can be assembled from current child stock. Optional
 * components don't constrain availability. `null` children (backorder) are
 * treated as unlimited. Returns Infinity when nothing constrains it.
 */
export function bundleAvailableQuantity(components: BundleComponent[]): number {
  const required = components.filter((c) => !c.isOptional);
  if (required.length === 0) return 0;
  let min = Infinity;
  for (const c of required) {
    if (c.allowBackorder) continue;
    const possible = Math.floor(c.availableUnits / Math.max(1, c.quantity));
    if (possible < min) min = possible;
  }
  return min;
}

/**
 * Validate that adding `childVariantIds` to `bundleId` introduces no cycle:
 * a child variant must not belong to a product that is itself a bundle which
 * (transitively) contains `bundleId`. Returns the offending variant id, or null.
 */
export async function findBundleCycle(
  db: Db,
  tenantId: string,
  bundleId: string,
  childVariantIds: string[],
): Promise<string | null> {
  // Map the candidate child variants to their owning products.
  const seedVariants = await db
    .select({ id: schema.productVariants.id, productId: schema.productVariants.productId })
    .from(schema.productVariants)
    .where(inArray(schema.productVariants.id, childVariantIds));

  // BFS over bundle composition: product → (if bundle) its child variants'
  // products → … If we ever reach `bundleId`, that's a cycle.
  const visited = new Set<string>();
  const queue: { variantId: string; productId: string }[] = seedVariants.map((v) => ({
    variantId: v.id,
    productId: v.productId,
  }));

  while (queue.length > 0) {
    const node = queue.shift()!;
    if (node.productId === bundleId) return node.variantId;
    if (visited.has(node.productId)) continue;
    visited.add(node.productId);

    // Is this product a bundle? If so, expand its children.
    const [prod] = await db
      .select({ type: schema.products.type })
      .from(schema.products)
      .where(and(eq(schema.products.tenantId, tenantId), eq(schema.products.id, node.productId)))
      .limit(1);
    if (!prod || prod.type !== 'bundle') continue;

    const children = await db
      .select({
        childVariantId: schema.productBundleItems.childVariantId,
        productId: schema.productVariants.productId,
      })
      .from(schema.productBundleItems)
      .innerJoin(
        schema.productVariants,
        eq(schema.productBundleItems.childVariantId, schema.productVariants.id),
      )
      .where(eq(schema.productBundleItems.bundleId, node.productId));
    for (const c of children) {
      queue.push({ variantId: c.childVariantId, productId: c.productId });
    }
  }
  return null;
}
