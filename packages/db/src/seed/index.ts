/**
 * Seed script — populates dev environment with sample data.
 *
 * Idempotent — re-running is safe. Used by e2e CI workflow.
 *
 * Run: `pnpm db:seed`
 */

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { eq, sql } from 'drizzle-orm';
import { createDbClient } from '../client';
import * as schema from '../schema';

// Mirror migrate.ts: load .env from package or workspace root
const __dirname = dirname(fileURLToPath(import.meta.url));
for (const candidate of [
  resolve(__dirname, '..', '..', '.env'),
  resolve(__dirname, '..', '..', '..', '..', '.env'),
]) {
  if (existsSync(candidate)) {
    loadEnv({ path: candidate });
    break;
  }
}

async function seed() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('❌ DATABASE_URL not set');
    process.exit(1);
  }

  const db = createDbClient(url);
  console.log('🌱 Seeding Shopio dev database...');

  // ---------------------------------------------------------------------------
  // Tenant: bob-ceramics
  // ---------------------------------------------------------------------------
  let tenant = await findTenantBySlug(db, 'bob-ceramics');
  if (!tenant) {
    const [created] = await db
      .insert(schema.tenants)
      .values({
        pubId: 'tnt_seed_bob_ceramics',
        slug: 'bob-ceramics',
        displayName: 'Bob Ceramics',
        countryCode: 'CZ',
        status: 'active',
      })
      .returning();
    tenant = created!;
    console.log(`  ✓ Created tenant bob-ceramics (${tenant.id})`);
  } else {
    console.log(`  ↻ Tenant bob-ceramics already exists`);
  }

  // ---------------------------------------------------------------------------
  // Categories: pottery, stoneware
  // ---------------------------------------------------------------------------
  const potteryId = await upsertCategory(db, tenant.id, 'pottery', 'Pottery', 'pottery', null, 0);
  const stonewareId = await upsertCategory(
    db,
    tenant.id,
    'stoneware',
    'Stoneware',
    'pottery.stoneware',
    potteryId,
    1,
  );
  console.log(`  ✓ Categories ensured (pottery, stoneware)`);

  // ---------------------------------------------------------------------------
  // Product: black-ceramic-bowl
  // ---------------------------------------------------------------------------
  let product = await findProductBySlug(db, tenant.id, 'black-ceramic-bowl');
  if (!product) {
    const [created] = await db
      .insert(schema.products)
      .values({
        tenantId: tenant.id,
        pubId: 'prd_seed_black_bowl',
        slug: 'black-ceramic-bowl',
        title: 'Black Ceramic Bowl (Premium)',
        descriptionHtml: '<p>Handmade in Moravia. Microwave + dishwasher safe.</p>',
        status: 'active',
        basePriceAmount: 59900n,
        basePriceCurrency: 'CZK',
        vendor: 'Bob Ceramics',
        publishedAt: new Date(),
      })
      .returning();
    product = created!;
    console.log(`  ✓ Created product black-ceramic-bowl (${product.id})`);

    // Variants
    await db.insert(schema.productVariants).values([
      {
        tenantId: tenant.id,
        productId: product.id,
        pubId: 'prv_seed_bcb_s',
        sku: 'BCB-S',
        title: 'Small',
        priceAmount: 59900n,
        priceCurrency: 'CZK',
        stockOnHand: 42,
        position: 0,
      },
      {
        tenantId: tenant.id,
        productId: product.id,
        pubId: 'prv_seed_bcb_l',
        sku: 'BCB-L',
        title: 'Large',
        priceAmount: 89900n,
        priceCurrency: 'CZK',
        stockOnHand: 18,
        position: 1,
      },
    ]);
    console.log(`  ✓ Created variants (BCB-S, BCB-L)`);

    // Media
    await db.insert(schema.productMedia).values({
      tenantId: tenant.id,
      productId: product.id,
      pubId: 'mda_seed_bcb_1',
      kind: 'image',
      url: 'https://cdn.shopio.test/black-bowl-1.jpg',
      alt: 'Black ceramic bowl front view',
      widthPx: 1600,
      heightPx: 1600,
      position: 0,
      isPrimary: true,
    });
    console.log(`  ✓ Created media`);

    // Categories
    await db.insert(schema.productCategories).values([
      { tenantId: tenant.id, productId: product.id, categoryId: potteryId, position: 0 },
      { tenantId: tenant.id, productId: product.id, categoryId: stonewareId, position: 0 },
    ]);
    console.log(`  ✓ Linked to categories`);
  } else {
    console.log(`  ↻ Product black-ceramic-bowl already exists — ensuring stock levels`);
    // Reset stock to known values (idempotent for e2e)
    await db
      .update(schema.productVariants)
      .set({ stockOnHand: 42 })
      .where(eq(schema.productVariants.sku, 'BCB-S'));
    await db
      .update(schema.productVariants)
      .set({ stockOnHand: 18 })
      .where(eq(schema.productVariants.sku, 'BCB-L'));
  }

  console.log('✅ Seed complete.');
  process.exit(0);
}

async function findTenantBySlug(db: ReturnType<typeof createDbClient>, slug: string) {
  const [row] = await db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.slug, slug))
    .limit(1);
  return row ?? null;
}

async function findProductBySlug(
  db: ReturnType<typeof createDbClient>,
  tenantId: string,
  slug: string,
) {
  const [row] = await db
    .select()
    .from(schema.products)
    .where(sql`${schema.products.tenantId} = ${tenantId} AND ${schema.products.slug} = ${slug}`)
    .limit(1);
  return row ?? null;
}

async function upsertCategory(
  db: ReturnType<typeof createDbClient>,
  tenantId: string,
  slug: string,
  name: string,
  pathStr: string,
  parentId: string | null,
  depth: number,
): Promise<string> {
  const [existing] = await db
    .select({ id: schema.categories.id })
    .from(schema.categories)
    .where(sql`${schema.categories.tenantId} = ${tenantId} AND ${schema.categories.slug} = ${slug}`)
    .limit(1);
  if (existing) return existing.id;

  const [inserted] = await db
    .insert(schema.categories)
    .values({
      tenantId,
      pubId: `cat_seed_${slug}`,
      slug,
      name,
      path: pathStr,
      parentId,
      depth,
      status: 'active',
    })
    .returning({ id: schema.categories.id });
  return inserted!.id;
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
