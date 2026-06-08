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
import { hashPassword } from '@shopio/authz';
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
  // Invoicing identity (per `15 §3.5` seller snapshot source). IČO/DIČ are
  // fictional seed values; address + bank live in settings.invoicing.
  const invoicingSettings = {
    invoicing: {
      address: { line1: 'Keramická 12', city: 'Praha 7', postal_code: '170 00' },
      bank_account_iban: 'CZ6508000000192000145399',
      bank_account_swift: 'GIBACZPX',
    },
  };

  let tenant = await findTenantBySlug(db, 'bob-ceramics');
  if (!tenant) {
    const [created] = await db
      .insert(schema.tenants)
      .values({
        pubId: 'tnt_seed_bob_ceramics',
        slug: 'bob-ceramics',
        displayName: 'Bob Ceramics',
        legalEntityName: 'Bob Ceramics s.r.o.',
        countryCode: 'CZ',
        status: 'active',
        registrationNumber: '12345678',
        vatId: 'CZ12345678',
        settings: invoicingSettings,
      })
      .returning();
    tenant = created!;
    console.log(`  ✓ Created tenant bob-ceramics (${tenant.id})`);
  } else {
    // Idempotent top-up: ensure invoicing identity exists on older seeds
    if (!tenant.registrationNumber || !tenant.vatId) {
      await db
        .update(schema.tenants)
        .set({
          legalEntityName: tenant.legalEntityName ?? 'Bob Ceramics s.r.o.',
          registrationNumber: tenant.registrationNumber ?? '12345678',
          vatId: tenant.vatId ?? 'CZ12345678',
          settings: { ...(tenant.settings as object), ...invoicingSettings },
          updatedAt: new Date(),
        })
        .where(eq(schema.tenants.id, tenant.id));
      console.log(`  ✓ Updated tenant bob-ceramics invoicing identity`);
    }
    console.log(`  ↻ Tenant bob-ceramics already exists`);
  }

  // ---------------------------------------------------------------------------
  // CZ VAT rates (per `15-tax-compliance.md`) — 2024 reform: 21 / 12 / 0 %.
  // ---------------------------------------------------------------------------
  await db
    .insert(schema.taxRates)
    .values([
      {
        tenantId: tenant.id,
        countryCode: 'CZ',
        taxClassCode: 'standard',
        rateBasisPoints: 2100,
        name: 'DPH 21 %',
        validFrom: '2024-01-01',
      },
      {
        tenantId: tenant.id,
        countryCode: 'CZ',
        taxClassCode: 'reduced',
        rateBasisPoints: 1200,
        name: 'DPH 12 %',
        validFrom: '2024-01-01',
      },
      {
        tenantId: tenant.id,
        countryCode: 'CZ',
        taxClassCode: 'zero',
        rateBasisPoints: 0,
        name: 'DPH 0 %',
        validFrom: '2024-01-01',
      },
    ])
    .onConflictDoNothing();
  console.log(`  ✓ CZ VAT rates ensured (21 / 12 / 0 %)`);

  // ---------------------------------------------------------------------------
  // Shipping: CZ zone + Zásilkovna rates + sample pickup points (per `14`).
  // ---------------------------------------------------------------------------
  let [czZone] = await db
    .select({ id: schema.shippingZones.id })
    .from(schema.shippingZones)
    .where(sql`${schema.shippingZones.tenantId} = ${tenant.id} AND ${schema.shippingZones.name} = 'CZ'`)
    .limit(1);
  if (!czZone) {
    [czZone] = await db
      .insert(schema.shippingZones)
      .values({
        tenantId: tenant.id,
        name: 'CZ',
        countryCodes: ['CZ'],
        priority: 100,
      })
      .returning({ id: schema.shippingZones.id });
  }

  await db
    .insert(schema.shippingRates)
    .values([
      {
        tenantId: tenant.id,
        shippingZoneId: czZone!.id,
        carrierCode: 'zasilkovna',
        serviceCode: 'pickup_point',
        displayName: 'Zásilkovna — výdejní místo',
        description: 'Doručení na výdejní místo nebo Z-BOX. Doprava zdarma nad 1 500 Kč.',
        kind: 'free_above_threshold',
        amount: 7900n, // 79 Kč incl. VAT
        currency: 'CZK',
        freeAboveAmount: 150000n, // 1 500 Kč
        pickupOnly: true,
        supportsCod: true,
        estimatedDaysMin: 1,
        estimatedDaysMax: 2,
        priority: 10,
      },
      {
        tenantId: tenant.id,
        shippingZoneId: czZone!.id,
        carrierCode: 'zasilkovna',
        serviceCode: 'home_delivery',
        displayName: 'Zásilkovna — doručení domů',
        description: 'Kurýr na adresu.',
        kind: 'flat',
        amount: 11900n, // 119 Kč incl. VAT
        currency: 'CZK',
        pickupOnly: false,
        supportsCod: true,
        estimatedDaysMin: 1,
        estimatedDaysMax: 3,
        priority: 5,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(schema.pickupPoints)
    .values([
      {
        carrierCode: 'zasilkovna',
        externalId: '1071',
        name: 'Z-BOX Praha 5 — Anděl',
        street: 'Nádražní 32',
        city: 'Praha',
        postalCode: '15000',
        countryCode: 'CZ',
        syncSource: 'manual',
      },
      {
        carrierCode: 'zasilkovna',
        externalId: '2842',
        name: 'Výdejní místo Brno — Veveří',
        street: 'Veveří 125',
        city: 'Brno',
        postalCode: '61600',
        countryCode: 'CZ',
        syncSource: 'manual',
      },
      {
        carrierCode: 'zasilkovna',
        externalId: '3310',
        name: 'Z-BOX Ostrava — Centrum',
        street: 'Nádražní 100',
        city: 'Ostrava',
        postalCode: '70200',
        countryCode: 'CZ',
        syncSource: 'manual',
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(schema.shippingProviderConfigs)
    .values({
      tenantId: tenant.id,
      carrierCode: 'zasilkovna',
      isEnabled: true,
      isTestMode: true,
      displayName: 'Zásilkovna',
    })
    .onConflictDoNothing();
  console.log(`  ✓ Shipping ensured (CZ zone + Zásilkovna rates + 3 pickup points)`);

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

  // ---------------------------------------------------------------------------
  // Demo admin login — so the founder can sign in to /admin and click through
  // the whole shop. Owner persona on the bob-ceramics tenant.
  //   email:    demo@shopio.cz
  //   password: demo1234
  // ---------------------------------------------------------------------------
  const demoEmail = 'demo@shopio.cz';
  let [demoUser] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, demoEmail))
    .limit(1);
  if (!demoUser) {
    const passwordHash = await hashPassword('demo1234', process.env.SHOPIO_SESSION_PEPPER);
    [demoUser] = await db
      .insert(schema.users)
      .values({
        pubId: 'usr_seed_demo_owner',
        email: demoEmail,
        fullName: 'Bob (demo)',
        passwordHash,
        status: 'active',
        locale: 'cs-CZ',
        timezone: 'Europe/Prague',
      })
      .returning();
    console.log(`  ✓ Created demo admin user ${demoEmail} / demo1234 (${demoUser!.id})`);
  } else {
    console.log(`  ↻ Demo admin user ${demoEmail} already exists`);
  }

  // Membership: demo user → bob-ceramics as MERCHANT-OWNER
  const [existingMembership] = await db
    .select({ id: schema.userTenantMemberships.id })
    .from(schema.userTenantMemberships)
    .where(
      sql`${schema.userTenantMemberships.userId} = ${demoUser!.id} AND ${schema.userTenantMemberships.tenantId} = ${tenant.id}`,
    )
    .limit(1);
  if (!existingMembership) {
    await db.insert(schema.userTenantMemberships).values({
      tenantId: tenant.id,
      userId: demoUser!.id,
      personaCode: 'MERCHANT-OWNER',
      status: 'active',
    });
    console.log(`  ✓ Linked demo user to bob-ceramics (MERCHANT-OWNER)`);
  } else {
    console.log(`  ↻ Demo user already a member of bob-ceramics`);
  }

  // ---------------------------------------------------------------------------
  // Catalog: 6 more products with real (reachable) images, so the storefront
  // and admin grids look like a real shop. Images are hot-linked from Unsplash
  // (dev convenience — production uploads land in MinIO/S3).
  // ---------------------------------------------------------------------------
  const IMG = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&h=1200&q=80`;

  await upsertProduct(db, tenant.id, {
    pubId: 'prd_seed_white_mug',
    slug: 'white-stoneware-mug',
    title: 'White Stoneware Mug',
    descriptionHtml: '<p>Ručně točený hrnek z bílé kameniny, 300 ml. Vhodný do myčky i mikrovlnky.</p>',
    basePrice: 34900n,
    variants: [
      { pubId: 'prv_seed_wsm_1', sku: 'WSM-300', title: '300 ml', price: 34900n, stock: 60 },
    ],
    imageUrl: IMG('photo-1514228742587-6b1558fcca3d'),
    alt: 'Bílý kameninový hrnek',
    categoryIds: [potteryId, stonewareId],
  });

  await upsertProduct(db, tenant.id, {
    pubId: 'prd_seed_terracotta_planter',
    slug: 'terracotta-planter',
    title: 'Terracotta Planter',
    descriptionHtml: '<p>Klasický terakotový květináč s podmiskou. Prodyšný materiál pro zdravé kořeny.</p>',
    basePrice: 44900n,
    variants: [
      { pubId: 'prv_seed_tp_s', sku: 'TP-14', title: 'Ø 14 cm', price: 44900n, stock: 35 },
      { pubId: 'prv_seed_tp_l', sku: 'TP-20', title: 'Ø 20 cm', price: 69900n, stock: 22 },
    ],
    imageUrl: IMG('photo-1485955900006-10f4d324d411'),
    alt: 'Terakotový květináč',
    categoryIds: [potteryId],
  });

  await upsertProduct(db, tenant.id, {
    pubId: 'prd_seed_dinner_plate',
    slug: 'speckled-dinner-plate',
    title: 'Speckled Dinner Plate',
    descriptionHtml: '<p>Mělký talíř Ø 27 cm s přírodní kropenatou glazurou. Sada pro každodenní stolování.</p>',
    basePrice: 39900n,
    variants: [
      { pubId: 'prv_seed_dp_1', sku: 'DP-27', title: 'Ø 27 cm', price: 39900n, stock: 80 },
    ],
    imageUrl: IMG('photo-1578749556568-bc2c40e68b61'),
    alt: 'Kropenatý jídelní talíř',
    categoryIds: [potteryId, stonewareId],
  });

  await upsertProduct(db, tenant.id, {
    pubId: 'prd_seed_matte_vase',
    slug: 'matte-vase-tall',
    title: 'Matte Vase (Tall)',
    descriptionHtml: '<p>Vysoká matná váza, 28 cm. Minimalistický doplněk do obýváku i ložnice.</p>',
    basePrice: 89900n,
    variants: [
      { pubId: 'prv_seed_mv_1', sku: 'MV-28', title: '28 cm', price: 89900n, stock: 14 },
    ],
    imageUrl: IMG('photo-1612196808214-b7e239e5d5e5'),
    alt: 'Vysoká matná váza',
    categoryIds: [potteryId],
  });

  await upsertProduct(db, tenant.id, {
    pubId: 'prd_seed_teapot',
    slug: 'ceramic-teapot',
    title: 'Ceramic Teapot 1 L',
    descriptionHtml: '<p>Konvička na čaj s nerezovým sítkem, objem 1 litr. Drží teplo díky silné stěně.</p>',
    basePrice: 119900n,
    variants: [
      { pubId: 'prv_seed_tea_1', sku: 'TEA-1L', title: '1 l', price: 119900n, stock: 19 },
    ],
    imageUrl: IMG('photo-1563822249548-9a72b6353cd1'),
    alt: 'Keramická čajová konvička',
    categoryIds: [potteryId, stonewareId],
  });

  await upsertProduct(db, tenant.id, {
    pubId: 'prd_seed_espresso_set',
    slug: 'espresso-cup-set',
    title: 'Espresso Cup Set (2 ks)',
    descriptionHtml: '<p>Sada dvou espresso šálků s podšálky, 80 ml. Dárkové balení.</p>',
    basePrice: 54900n,
    variants: [
      { pubId: 'prv_seed_esp_1', sku: 'ESP-2', title: '2 ks', price: 54900n, stock: 40 },
    ],
    imageUrl: IMG('photo-1530373239216-42339f4c01f4'),
    alt: 'Sada espresso šálků',
    categoryIds: [potteryId],
  });
  console.log(`  ✓ Catalog ensured (7 products incl. black-ceramic-bowl)`);

  // Backfill an image for black-ceramic-bowl too (its seed URL is unreachable),
  // so every product on the demo storefront actually renders a photo.
  await db
    .update(schema.productMedia)
    .set({ url: IMG('photo-1578500494198-246f612d3b3d') })
    .where(
      sql`${schema.productMedia.tenantId} = ${tenant.id} AND ${schema.productMedia.url} = 'https://cdn.shopio.test/black-bowl-1.jpg'`,
    );

  // ---------------------------------------------------------------------------
  // Demo customer + 2 sample orders — so the admin "Objednávky" view and the
  // customer account aren't empty on first click-through.
  // ---------------------------------------------------------------------------
  const customerEmail = 'eva.novakova@example.com';
  let [demoCustomer] = await db
    .select()
    .from(schema.customers)
    .where(
      sql`${schema.customers.tenantId} = ${tenant.id} AND ${schema.customers.email} = ${customerEmail}`,
    )
    .limit(1);
  if (!demoCustomer) {
    const customerPwHash = await hashPassword('eva12345', process.env.SHOPIO_SESSION_PEPPER);
    [demoCustomer] = await db
      .insert(schema.customers)
      .values({
        tenantId: tenant.id,
        pubId: 'cus_seed_eva',
        email: customerEmail,
        fullName: 'Eva Nováková',
        phone: '+420601234567',
        passwordHash: customerPwHash,
        status: 'active',
      })
      .returning();
    console.log(`  ✓ Created demo customer ${customerEmail} / eva12345`);
  } else {
    console.log(`  ↻ Demo customer ${customerEmail} already exists`);
  }

  const shipTo = {
    line1: 'Lipová 8',
    city: 'Praha 2',
    postal_code: '120 00',
    country_code: 'CZ',
    name: 'Eva Nováková',
  };

  // Order 1 — paid + fulfilled: 1× black bowl (Small) + 1× white mug.
  await upsertOrder(db, tenant.id, demoCustomer!, {
    orderNumber: 'BOB-1001',
    pubId: 'ord_seed_1001',
    status: 'fulfilled',
    paymentStatus: 'paid',
    shipTo,
    shippingAmount: 7900n,
    items: [
      { variantSku: 'BCB-S', productTitle: 'Black Ceramic Bowl (Premium)', variantTitle: 'Small', unitPrice: 59900n, qty: 1 },
      { variantSku: 'WSM-300', productTitle: 'White Stoneware Mug', variantTitle: '300 ml', unitPrice: 34900n, qty: 1 },
    ],
  });

  // Order 2 — paid, awaiting fulfilment: 2× espresso set + 1× teapot.
  await upsertOrder(db, tenant.id, demoCustomer!, {
    orderNumber: 'BOB-1002',
    pubId: 'ord_seed_1002',
    status: 'paid',
    paymentStatus: 'paid',
    shipTo,
    shippingAmount: 11900n,
    items: [
      { variantSku: 'ESP-2', productTitle: 'Espresso Cup Set (2 ks)', variantTitle: '2 ks', unitPrice: 54900n, qty: 2 },
      { variantSku: 'TEA-1L', productTitle: 'Ceramic Teapot 1 L', variantTitle: '1 l', unitPrice: 119900n, qty: 1 },
    ],
  });
  console.log(`  ✓ Sample orders ensured (BOB-1001 fulfilled, BOB-1002 paid)`);

  console.log('✅ Seed complete.');
  console.log('');
  console.log('   👉 Admin login:    demo@shopio.cz / demo1234   (tenant: bob-ceramics)');
  console.log('   👉 Customer login: eva.novakova@example.com / eva12345');
  process.exit(0);
}

/** Tax embedded in a VAT-inclusive gross amount (per `15 §3.6`). */
function vatIncluded(gross: bigint, basisPoints: number): bigint {
  const net = (gross * 10000n) / BigInt(10000 + basisPoints);
  return gross - net;
}

interface ProductSpec {
  pubId: string;
  slug: string;
  title: string;
  descriptionHtml: string;
  basePrice: bigint;
  variants: { pubId: string; sku: string; title: string; price: bigint; stock: number }[];
  imageUrl: string;
  alt: string;
  categoryIds: string[];
}

async function upsertProduct(
  db: ReturnType<typeof createDbClient>,
  tenantId: string,
  spec: ProductSpec,
): Promise<void> {
  const existing = await findProductBySlug(db, tenantId, spec.slug);
  if (existing) return; // idempotent: leave existing catalog untouched

  const [product] = await db
    .insert(schema.products)
    .values({
      tenantId,
      pubId: spec.pubId,
      slug: spec.slug,
      title: spec.title,
      descriptionHtml: spec.descriptionHtml,
      status: 'active',
      basePriceAmount: spec.basePrice,
      basePriceCurrency: 'CZK',
      vendor: 'Bob Ceramics',
      publishedAt: new Date(),
    })
    .returning();

  await db.insert(schema.productVariants).values(
    spec.variants.map((v, i) => ({
      tenantId,
      productId: product!.id,
      pubId: v.pubId,
      sku: v.sku,
      title: v.title,
      priceAmount: v.price,
      priceCurrency: 'CZK',
      stockOnHand: v.stock,
      position: i,
    })),
  );

  await db.insert(schema.productMedia).values({
    tenantId,
    productId: product!.id,
    pubId: `mda_${spec.pubId.replace('prd_', '')}`,
    kind: 'image',
    url: spec.imageUrl,
    alt: spec.alt,
    widthPx: 1200,
    heightPx: 1200,
    position: 0,
    isPrimary: true,
  });

  await db.insert(schema.productCategories).values(
    spec.categoryIds.map((categoryId) => ({ tenantId, productId: product!.id, categoryId, position: 0 })),
  );
}

interface OrderSpec {
  orderNumber: string;
  pubId: string;
  status: 'pending_payment' | 'paid' | 'partially_paid' | 'fulfilling' | 'fulfilled' | 'cancelled' | 'refunded';
  paymentStatus: 'pending' | 'authorized' | 'paid' | 'failed' | 'refunded';
  shipTo: Record<string, unknown>;
  shippingAmount: bigint;
  items: { variantSku: string; productTitle: string; variantTitle: string; unitPrice: bigint; qty: number }[];
}

async function upsertOrder(
  db: ReturnType<typeof createDbClient>,
  tenantId: string,
  customer: typeof schema.customers.$inferSelect,
  spec: OrderSpec,
): Promise<void> {
  const [existing] = await db
    .select({ id: schema.orders.id })
    .from(schema.orders)
    .where(sql`${schema.orders.tenantId} = ${tenantId} AND ${schema.orders.orderNumber} = ${spec.orderNumber}`)
    .limit(1);
  if (existing) return;

  const RATE = 2100; // CZK standard 21 %
  let subtotal = 0n;
  let goodsTax = 0n;
  const lines = spec.items.map((it) => {
    const lineSubtotal = it.unitPrice * BigInt(it.qty);
    const lineTax = vatIncluded(lineSubtotal, RATE);
    subtotal += lineSubtotal;
    goodsTax += lineTax;
    return { it, lineSubtotal, lineTax };
  });
  const shippingTax = vatIncluded(spec.shippingAmount, RATE);
  const taxAmount = goodsTax + shippingTax;
  const total = subtotal + spec.shippingAmount; // VAT-inclusive convention

  const paidStatuses = new Set(['paid', 'partially_paid', 'fulfilling', 'fulfilled']);
  const isPaid = paidStatuses.has(spec.status);

  const [order] = await db
    .insert(schema.orders)
    .values({
      tenantId,
      pubId: spec.pubId,
      orderNumber: spec.orderNumber,
      customerId: customer.id,
      customerEmail: customer.email,
      customerName: customer.fullName,
      customerPhone: customer.phone,
      shippingAddress: spec.shipTo,
      currency: 'CZK',
      subtotalAmount: subtotal,
      shippingAmount: spec.shippingAmount,
      taxAmount,
      priceIncludesTax: true,
      totalAmount: total,
      status: spec.status,
      paymentStatus: spec.paymentStatus,
      paymentMethod: 'mock',
      paidAt: isPaid ? new Date() : null,
      fulfilledAt: spec.status === 'fulfilled' ? new Date() : null,
    })
    .returning();

  let idx = 0;
  for (const { it, lineSubtotal, lineTax } of lines) {
    const [variant] = await db
      .select({ id: schema.productVariants.id, productId: schema.productVariants.productId })
      .from(schema.productVariants)
      .where(sql`${schema.productVariants.tenantId} = ${tenantId} AND ${schema.productVariants.sku} = ${it.variantSku}`)
      .limit(1);
    await db.insert(schema.orderItems).values({
      tenantId,
      orderId: order!.id,
      pubId: `oit_${spec.pubId.replace('ord_', '')}_${idx}`,
      variantId: variant?.id ?? null,
      productId: variant?.productId ?? null,
      productTitleSnapshot: it.productTitle,
      variantTitleSnapshot: it.variantTitle,
      skuSnapshot: it.variantSku,
      quantity: it.qty,
      quantityFulfilled: spec.status === 'fulfilled' ? it.qty : 0,
      unitPriceAmount: it.unitPrice,
      unitPriceCurrency: 'CZK',
      lineSubtotalAmount: lineSubtotal,
      taxClassCode: 'standard',
      taxRateBasisPoints: RATE,
      lineTaxAmount: lineTax,
      lineTotalAmount: lineSubtotal,
    });
    idx += 1;
  }
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
