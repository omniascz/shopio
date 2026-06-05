/**
 * `invoices` + `invoice_items` + `invoice_number_sequences` — per
 * `15-tax-compliance.md` §3.5–3.7 (ENT-INVOICE-001, RULE-TAX-009/010/011).
 *
 * Invoices are immutable legal snapshots issued from a paid order:
 * - Gapless per-tenant-per-year numbering (RULE-TAX-009) via the atomic
 *   `invoice_number_sequences` counter — never reuse, never delete; voiding
 *   keeps the number (`is_void` flag only, RULE-TAX-010).
 * - Seller + buyer parties snapshotted as JSONB at issuance.
 * - PDF + ISDOC 6.0.1 XML are generated on demand from these rows (they are
 *   deterministic functions of an immutable snapshot) — object storage comes
 *   with the MinIO/S3 wave.
 *
 * MVP simplifications:
 * - B2C CZ only: no reverse charge, no OSS, no proforma/advance kinds.
 * - `credit_note` kind lands with returns (Wave 1); linked via related_invoice_id.
 */

import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { orders } from './orders';
import { tenants } from './tenants';

export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    pubId: text('pub_id').notNull(), // inv_ NanoID
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'restrict' }),
    /** 'invoice' (faktura — daňový doklad) | 'credit_note' (dobropis). */
    kind: text('kind', { enum: ['invoice', 'credit_note'] })
      .notNull()
      .default('invoice'),
    /** For credit notes — the original invoice being corrected. */
    relatedInvoiceId: uuid('related_invoice_id'),
    /** Legal number, e.g. INV-2026-00000001 / CRD-2026-00000001 (gapless). */
    number: text('number').notNull(),
    numberSequenceCode: text('number_sequence_code').notNull(), // 'INV' | 'CRD'
    numberSequencePosition: integer('number_sequence_position').notNull(),
    /** CZ banking variable symbol (max 10 digits). */
    variableSymbol: text('variable_symbol'),
    // Dates
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
    /** DUZP — datum uskutečnění zdanitelného plnění (RULE-TAX-011). */
    taxableSupplyDate: date('taxable_supply_date').notNull(),
    dueDate: date('due_date'),
    // Party snapshots (RULE-SEC-038: survive tenant/customer edits)
    /** { name, ico, dic, line1, line2, city, postal_code, country_code, bank_account_iban, bank_account_swift } */
    sellerSnapshot: jsonb('seller_snapshot').notNull(),
    /** { name, email, line1, line2, city, postal_code, country_code } */
    buyerSnapshot: jsonb('buyer_snapshot').notNull(),
    // Money — minor units, same convention as orders
    currency: text('currency').notNull(),
    /** Net taxable base (sum of bases across rates). */
    subtotalAmount: bigint('subtotal_amount', { mode: 'bigint' }).notNull(),
    taxAmount: bigint('tax_amount', { mode: 'bigint' }).notNull(),
    /** Gross payable (net + VAT). Negative-free: credit notes keep positive amounts, kind flips the sign semantics. */
    totalAmount: bigint('total_amount', { mode: 'bigint' }).notNull(),
    /** [{ tax_class, rate_basis_points, base_amount, tax_amount }] — per `15 §4` STAGE 7. */
    taxBreakdown: jsonb('tax_breakdown')
      .notNull()
      .default(sql`'[]'::jsonb`),
    priceIncludesTax: boolean('price_includes_tax').notNull().default(true),
    /** 'card' | 'bank_transfer' | 'cod' | 'mock' — payment means snapshot. */
    paymentMethodKind: text('payment_method_kind'),
    // Voiding (RULE-TAX-010 — never DELETE)
    isVoid: boolean('is_void').notNull().default(false),
    voidReason: text('void_reason'),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    // Audit
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb('metadata')
      .notNull()
      .default(sql`'{}'::jsonb`),
  },
  (t) => ({
    pubIdUnique: uniqueIndex('uq_invoices_pub_id').on(t.tenantId, t.pubId),
    numberUnique: uniqueIndex('uq_invoices_number').on(t.tenantId, t.number),
    /** One live regular invoice per order (credit notes are unlimited). */
    orderInvoiceUnique: uniqueIndex('uq_invoices_order_regular')
      .on(t.orderId)
      .where(sql`kind = 'invoice' AND is_void = false`),
    orderIdx: index('idx_invoices_order').on(t.orderId),
    tenantIssuedIdx: index('idx_invoices_tenant_issued').on(t.tenantId, t.issuedAt),
  }),
);

export const invoiceItems = pgTable(
  'invoice_items',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    position: integer('position').notNull().default(0),
    /** 'product' line vs 'shipping' fee line. */
    lineKind: text('line_kind', { enum: ['product', 'shipping'] })
      .notNull()
      .default('product'),
    sku: text('sku'),
    title: text('title').notNull(),
    quantity: integer('quantity').notNull().default(1),
    unitLabel: text('unit_label').notNull().default('ks'),
    /** Gross unit price (B2C display convention; minor units). */
    unitPriceAmount: bigint('unit_price_amount', { mode: 'bigint' }).notNull(),
    /** Net line base + VAT + gross — frozen from the order's tax snapshot. */
    netAmount: bigint('net_amount', { mode: 'bigint' }).notNull(),
    taxClassCode: text('tax_class_code').notNull().default('standard'),
    taxRateBasisPoints: integer('tax_rate_basis_points').notNull().default(0),
    taxAmount: bigint('tax_amount', { mode: 'bigint' }).notNull(),
    grossAmount: bigint('gross_amount', { mode: 'bigint' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    invoiceIdx: index('idx_invoice_items_invoice').on(t.invoiceId, t.position),
  }),
);

/** Atomic gapless number allocation (RULE-TAX-009) — one row per tenant×code×year. */
export const invoiceNumberSequences = pgTable(
  'invoice_number_sequences',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    sequenceCode: text('sequence_code').notNull(), // 'INV' | 'CRD'
    year: integer('year').notNull(),
    currentPosition: integer('current_position').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sequenceUnique: uniqueIndex('uq_invoice_number_sequences').on(
      t.tenantId,
      t.sequenceCode,
      t.year,
    ),
  }),
);

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type NewInvoiceItem = typeof invoiceItems.$inferInsert;
export type InvoiceNumberSequence = typeof invoiceNumberSequences.$inferSelect;
