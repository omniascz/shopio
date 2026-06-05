/**
 * Invoice issuance service — per `15-tax-compliance.md` §3.5–3.7.
 *
 * `issueInvoiceForOrder()` is idempotent: a live (non-void) regular invoice per
 * order is unique (partial unique index); concurrent/repeat calls return the
 * existing row. Numbering is gapless per tenant×kind×year via an atomic
 * upsert on `invoice_number_sequences` inside the same transaction
 * (RULE-TAX-009) — if the insert fails, the counter bump rolls back too.
 *
 * Invoices snapshot everything needed to render PDF + ISDOC XML later:
 * seller/buyer parties, line tax bases, breakdown. Rows are immutable
 * (RULE-TAX-010) — corrections happen via credit notes.
 */

import { and, asc, eq, sql as dsql } from 'drizzle-orm';
import { schema } from '@shopio/db';
import { generatePubId } from '@shopio/authz';
import type { AppDb } from '../db';

/** Either the root db handle or a transaction — both expose the query builder. */
type DbConn = AppDb | Parameters<Parameters<AppDb['transaction']>[0]>[0];

export interface SellerSnapshot {
  name: string;
  ico: string | null;
  dic: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null;
  postal_code: string | null;
  country_code: string;
  bank_account_iban: string | null;
  bank_account_swift: string | null;
  /** Registrace plátce DPH — false ⇒ "Neplátce DPH" on documents. */
  is_vat_payer: boolean;
}

export interface BuyerSnapshot {
  name: string | null;
  email: string;
  line1: string | null;
  line2: string | null;
  city: string | null;
  postal_code: string | null;
  country_code: string | null;
}

export class InvoiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Tenant settings JSONB shape used for invoicing (set via seed / admin later). */
interface TenantInvoicingSettings {
  invoicing?: {
    address?: {
      line1?: string;
      line2?: string;
      city?: string;
      postal_code?: string;
    };
    bank_account_iban?: string;
    bank_account_swift?: string;
    payment_terms_days?: number;
  };
}

function buildSellerSnapshot(tenant: typeof schema.tenants.$inferSelect): SellerSnapshot {
  const settings = (tenant.settings ?? {}) as TenantInvoicingSettings;
  const inv = settings.invoicing ?? {};
  return {
    name: tenant.legalEntityName ?? tenant.displayName,
    ico: tenant.registrationNumber,
    dic: tenant.vatId,
    line1: inv.address?.line1 ?? null,
    line2: inv.address?.line2 ?? null,
    city: inv.address?.city ?? null,
    postal_code: inv.address?.postal_code ?? null,
    country_code: tenant.countryCode,
    bank_account_iban: inv.bank_account_iban ?? null,
    bank_account_swift: inv.bank_account_swift ?? null,
    is_vat_payer: Boolean(tenant.vatId),
  };
}

interface OrderAddress {
  line1?: string;
  line2?: string;
  city?: string;
  postalCode?: string;
  countryCode?: string;
}

function buildBuyerSnapshot(order: typeof schema.orders.$inferSelect): BuyerSnapshot {
  const addr = (order.billingAddress ?? order.shippingAddress ?? {}) as OrderAddress;
  return {
    name: order.customerName,
    email: order.customerEmail,
    line1: addr.line1 ?? null,
    line2: addr.line2 ?? null,
    city: addr.city ?? null,
    postal_code: addr.postalCode ?? null,
    country_code: addr.countryCode ?? null,
  };
}

/**
 * Allocate the next gapless number for (tenant, code, year). MUST run inside
 * the same transaction as the invoice insert.
 */
async function allocateNumber(
  tx: DbConn,
  tenantId: string,
  sequenceCode: 'INV' | 'CRD',
  year: number,
): Promise<{ position: number; number: string }> {
  const [row] = await tx
    .insert(schema.invoiceNumberSequences)
    .values({ tenantId, sequenceCode, year, currentPosition: 1 })
    .onConflictDoUpdate({
      target: [
        schema.invoiceNumberSequences.tenantId,
        schema.invoiceNumberSequences.sequenceCode,
        schema.invoiceNumberSequences.year,
      ],
      set: {
        currentPosition: dsql`${schema.invoiceNumberSequences.currentPosition} + 1`,
        updatedAt: new Date(),
      },
    })
    .returning({ position: schema.invoiceNumberSequences.currentPosition });
  const position = row!.position;
  return {
    position,
    number: `${sequenceCode}-${year}-${String(position).padStart(8, '0')}`,
  };
}

/** Variable symbol: last 2 digits of year + 8-digit sequence position (≤10 digits). */
export function variableSymbolFor(year: number, position: number): string {
  return `${String(year % 100).padStart(2, '0')}${String(position).padStart(8, '0')}`;
}

export interface IssuedInvoice {
  invoice: typeof schema.invoices.$inferSelect;
  items: (typeof schema.invoiceItems.$inferSelect)[];
  /** False when the invoice already existed (idempotent re-issue). */
  created: boolean;
}

/**
 * Issue the regular invoice for a paid order (idempotent).
 */
export async function issueInvoiceForOrder(db: AppDb, orderId: string): Promise<IssuedInvoice> {
  // Fast path — already issued
  const existing = await getInvoiceForOrder(db, orderId, 'invoice');
  if (existing) return { ...existing, created: false };

  return db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, orderId))
      .limit(1);
    if (!order) throw new InvoiceError('ORDER_NOT_FOUND', 'Order not found');
    if (order.paymentStatus !== 'paid') {
      throw new InvoiceError('ORDER_NOT_PAID', 'Invoice requires a paid order');
    }

    const [tenant] = await tx
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.id, order.tenantId))
      .limit(1);
    if (!tenant) throw new InvoiceError('TENANT_NOT_FOUND', 'Tenant not found');

    const orderItems = await tx
      .select()
      .from(schema.orderItems)
      .where(eq(schema.orderItems.orderId, order.id))
      .orderBy(asc(schema.orderItems.createdAt));

    const issuedAt = new Date();
    const year = issuedAt.getFullYear();
    const { position, number } = await allocateNumber(tx, order.tenantId, 'INV', year);

    // DUZP — payment date for B2C e-commerce (goods paid before dispatch).
    const duzp = order.paidAt ?? issuedAt;

    // Shipping VAT is not stored per-line on the order — recover it from the
    // totals: shipping tax = order.taxAmount − Σ line taxes (exact, since the
    // engine computed totals as the sum of per-line floors).
    const lineTaxSum = orderItems.reduce((s, it) => s + it.lineTaxAmount, 0n);
    const shippingTax = order.taxAmount - lineTaxSum;
    const shippingGross = order.shippingAmount;
    const shippingNet = shippingGross - shippingTax;
    // Rate (basis points) for the shipping line — derived from the recovered
    // amounts and snapped to whole percents (floor rounding at placement can
    // skew the ratio by <1 bp).
    const shippingRateBp =
      shippingGross > 0n && shippingNet > 0n
        ? Math.round(Number(shippingTax) / Number(shippingNet) / 0.01) * 100
        : 0;

    const [invoice] = await tx
      .insert(schema.invoices)
      .values({
        tenantId: order.tenantId,
        pubId: generatePubId('inv'),
        orderId: order.id,
        kind: 'invoice',
        number,
        numberSequenceCode: 'INV',
        numberSequencePosition: position,
        variableSymbol: variableSymbolFor(year, position),
        issuedAt,
        taxableSupplyDate: toDateString(duzp),
        dueDate: toDateString(issuedAt), // paid already — due immediately
        sellerSnapshot: buildSellerSnapshot(tenant),
        buyerSnapshot: buildBuyerSnapshot(order),
        currency: order.currency,
        subtotalAmount: order.totalAmount - order.taxAmount,
        taxAmount: order.taxAmount,
        totalAmount: order.totalAmount,
        taxBreakdown: order.taxBreakdown,
        priceIncludesTax: order.priceIncludesTax,
        paymentMethodKind: order.paymentMethod === 'stripe' ? 'card' : (order.paymentMethod ?? null),
      })
      .returning();
    if (!invoice) throw new InvoiceError('INVOICE_INSERT_FAILED', 'Could not insert invoice');

    const itemRows: (typeof schema.invoiceItems.$inferInsert)[] = orderItems.map((it, idx) => ({
      tenantId: order.tenantId,
      invoiceId: invoice.id,
      position: idx,
      lineKind: 'product' as const,
      sku: it.skuSnapshot,
      title: `${it.productTitleSnapshot} — ${it.variantTitleSnapshot}`,
      quantity: it.quantity,
      unitLabel: 'ks',
      unitPriceAmount: it.unitPriceAmount,
      netAmount: it.lineSubtotalAmount,
      taxClassCode: it.taxClassCode,
      taxRateBasisPoints: it.taxRateBasisPoints,
      taxAmount: it.lineTaxAmount,
      grossAmount: it.lineTotalAmount,
    }));
    if (shippingGross > 0n) {
      const method = order.shippingMethod as { display_name?: string } | null;
      itemRows.push({
        tenantId: order.tenantId,
        invoiceId: invoice.id,
        position: itemRows.length,
        lineKind: 'shipping' as const,
        sku: null,
        title: method?.display_name ? `Doprava — ${method.display_name}` : 'Doprava',
        quantity: 1,
        unitLabel: 'ks',
        unitPriceAmount: shippingGross,
        netAmount: shippingNet,
        taxClassCode: tenant.shippingTaxClass,
        taxRateBasisPoints: shippingRateBp,
        taxAmount: shippingTax,
        grossAmount: shippingGross,
      });
    }

    const items = await tx.insert(schema.invoiceItems).values(itemRows).returning();
    return { invoice, items, created: true };
  });
}

export interface CreditNoteLine {
  sku: string | null;
  title: string;
  quantity: number;
  unitPriceAmount: bigint;
  netAmount: bigint;
  taxClassCode: string;
  taxRateBasisPoints: number;
  taxAmount: bigint;
  grossAmount: bigint;
}

/**
 * Issue a credit note (dobropis) against an order's invoice — used by the
 * returns workflow. Amounts are positive; `kind='credit_note'` carries the sign.
 */
export async function issueCreditNote(
  db: AppDb,
  orderId: string,
  lines: CreditNoteLine[],
  opts: { reason?: string } = {},
): Promise<IssuedInvoice> {
  if (lines.length === 0) throw new InvoiceError('EMPTY_CREDIT_NOTE', 'No lines to credit');

  return db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, orderId))
      .limit(1);
    if (!order) throw new InvoiceError('ORDER_NOT_FOUND', 'Order not found');

    const [tenant] = await tx
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.id, order.tenantId))
      .limit(1);
    if (!tenant) throw new InvoiceError('TENANT_NOT_FOUND', 'Tenant not found');

    const related = await getInvoiceForOrder(tx, orderId, 'invoice');

    const issuedAt = new Date();
    const year = issuedAt.getFullYear();
    const { position, number } = await allocateNumber(tx, order.tenantId, 'CRD', year);

    const totals = lines.reduce(
      (acc, l) => ({
        net: acc.net + l.netAmount,
        tax: acc.tax + l.taxAmount,
        gross: acc.gross + l.grossAmount,
      }),
      { net: 0n, tax: 0n, gross: 0n },
    );

    // Breakdown grouped by rate
    const byRate = new Map<number, { tax_class: string; base: bigint; tax: bigint }>();
    for (const l of lines) {
      const e = byRate.get(l.taxRateBasisPoints);
      if (e) {
        e.base += l.netAmount;
        e.tax += l.taxAmount;
      } else {
        byRate.set(l.taxRateBasisPoints, {
          tax_class: l.taxClassCode,
          base: l.netAmount,
          tax: l.taxAmount,
        });
      }
    }
    const breakdown = [...byRate.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([rbp, e]) => ({
        tax_class: e.tax_class,
        rate_basis_points: rbp,
        base_amount: e.base.toString(),
        tax_amount: e.tax.toString(),
      }));

    const [invoice] = await tx
      .insert(schema.invoices)
      .values({
        tenantId: order.tenantId,
        pubId: generatePubId('inv'),
        orderId: order.id,
        kind: 'credit_note',
        relatedInvoiceId: related?.invoice.id ?? null,
        number,
        numberSequenceCode: 'CRD',
        numberSequencePosition: position,
        variableSymbol: variableSymbolFor(year, position),
        issuedAt,
        taxableSupplyDate: toDateString(issuedAt),
        dueDate: null,
        sellerSnapshot: buildSellerSnapshot(tenant),
        buyerSnapshot: buildBuyerSnapshot(order),
        currency: order.currency,
        subtotalAmount: totals.net,
        taxAmount: totals.tax,
        totalAmount: totals.gross,
        taxBreakdown: breakdown,
        priceIncludesTax: order.priceIncludesTax,
        paymentMethodKind: order.paymentMethod === 'stripe' ? 'card' : (order.paymentMethod ?? null),
        ...(opts.reason ? { metadata: { reason: opts.reason } } : {}),
      })
      .returning();
    if (!invoice) throw new InvoiceError('INVOICE_INSERT_FAILED', 'Could not insert credit note');

    const items = await tx
      .insert(schema.invoiceItems)
      .values(
        lines.map((l, idx) => ({
          tenantId: order.tenantId,
          invoiceId: invoice.id,
          position: idx,
          lineKind: 'product' as const,
          sku: l.sku,
          title: l.title,
          quantity: l.quantity,
          unitLabel: 'ks',
          unitPriceAmount: l.unitPriceAmount,
          netAmount: l.netAmount,
          taxClassCode: l.taxClassCode,
          taxRateBasisPoints: l.taxRateBasisPoints,
          taxAmount: l.taxAmount,
          grossAmount: l.grossAmount,
        })),
      )
      .returning();

    return { invoice, items, created: true };
  });
}

/** Load the live invoice/credit-note for an order with its items. */
export async function getInvoiceForOrder(
  db: DbConn,
  orderId: string,
  kind: 'invoice' | 'credit_note',
): Promise<{ invoice: typeof schema.invoices.$inferSelect; items: (typeof schema.invoiceItems.$inferSelect)[] } | null> {
  const [invoice] = await db
    .select()
    .from(schema.invoices)
    .where(
      and(
        eq(schema.invoices.orderId, orderId),
        eq(schema.invoices.kind, kind),
        eq(schema.invoices.isVoid, false),
      ),
    )
    .orderBy(asc(schema.invoices.issuedAt))
    .limit(1);
  if (!invoice) return null;
  const items = await db
    .select()
    .from(schema.invoiceItems)
    .where(eq(schema.invoiceItems.invoiceId, invoice.id))
    .orderBy(asc(schema.invoiceItems.position));
  return { invoice, items };
}

/** All invoices (regular + credit notes) for an order, oldest first. */
export async function listInvoicesForOrder(
  db: AppDb,
  orderId: string,
): Promise<(typeof schema.invoices.$inferSelect)[]> {
  return db
    .select()
    .from(schema.invoices)
    .where(eq(schema.invoices.orderId, orderId))
    .orderBy(asc(schema.invoices.issuedAt));
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}
