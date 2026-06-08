/**
 * Invoice endpoints — per `15-tax-compliance.md` §3.5 + `04-api-conventions.md`.
 *
 * Admin (Bearer + permission):
 *   GET  /admin/orders/{orderPubId}/invoices       — list invoices for an order
 *   POST /admin/orders/{orderPubId}/invoices       — issue regular invoice (idempotent)
 *   GET  /admin/invoices/{invoicePubId}.pdf        — download PDF
 *   GET  /admin/invoices/{invoicePubId}.xml        — download ISDOC XML
 *
 * Storefront (anonymous; orderNumber + ?email= act as bearer, same convention
 * as the order-confirmation endpoint):
 *   GET  /storefront/{tenantSlug}/orders/{orderNumber}/invoice.pdf?email=
 */

import type { FastifyInstance } from 'fastify';
import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { schema, withTenant, type TenantTx } from '@shopio/db';
import { PERMISSIONS } from '@shopio/authz';
import { requirePermission } from '../plugins/auth-middleware';
import { getRlsDb } from '../db';
import {
  InvoiceError,
  getInvoiceForOrder,
  issueInvoiceForOrder,
  listInvoicesForOrder,
} from '../lib/invoices';
import { buildIsdocXml } from '../lib/isdoc';
import { buildPohodaDataPack, type PohodaInvoice } from '../lib/pohoda';
import { renderInvoicePdf } from '../lib/invoice-pdf';
import type { AppDb } from '../db';
import type { ShopioConfig } from '../config';

interface PluginOptions {
  config: ShopioConfig;
  db: AppDb;
}

export async function registerInvoiceRoutes(
  app: FastifyInstance,
  opts: PluginOptions,
): Promise<void> {
  const { db } = opts;
  const rlsDb = getRlsDb(opts.config);

  // ---------------------------------------------------------------------------
  // GET /admin/orders/{orderPubId}/invoices
  // ---------------------------------------------------------------------------
  app.get<{ Params: { orderPubId: string } }>(
    '/api/2026-05-20/admin/orders/:orderPubId/invoices',
    { preHandler: [requirePermission(PERMISSIONS.ORDER_VIEW)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) {
        return reply.code(400).send({
          error: { code: 'NO_ACTIVE_TENANT', message: 'Select a tenant first' },
        });
      }
      const invoices = await withTenant(rlsDb, tenantId, async (tx) => {
        const order = await findOrder(tx, tenantId, req.params.orderPubId);
        if (!order) return null;
        return listInvoicesForOrder(tx, order.id);
      });
      if (!invoices) {
        return reply.code(404).send({
          error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' },
        });
      }
      return reply.send({ data: { invoices: invoices.map(serializeInvoiceSummary) } });
    },
  );

  // ---------------------------------------------------------------------------
  // POST /admin/orders/{orderPubId}/invoices — manual issue (idempotent)
  // ---------------------------------------------------------------------------
  app.post<{ Params: { orderPubId: string } }>(
    '/api/2026-05-20/admin/orders/:orderPubId/invoices',
    { preHandler: [requirePermission(PERMISSIONS.ORDER_EDIT)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) {
        return reply.code(400).send({
          error: { code: 'NO_ACTIVE_TENANT', message: 'Select a tenant first' },
        });
      }
      const order = await withTenant(rlsDb, tenantId, (tx) =>
        findOrder(tx, tenantId, req.params.orderPubId),
      );
      if (!order) {
        return reply.code(404).send({
          error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' },
        });
      }
      try {
        const issued = await issueInvoiceForOrder(rlsDb, tenantId, order.id);
        app.log.info(
          { orderId: order.id, invoiceNumber: issued.invoice.number, created: issued.created },
          'invoice.issued',
        );
        return reply
          .code(issued.created ? 201 : 200)
          .send({ data: serializeInvoiceSummary(issued.invoice) });
      } catch (err) {
        if (err instanceof InvoiceError) {
          return reply.code(422).send({ error: { code: err.code, message: err.message } });
        }
        throw err;
      }
    },
  );

  // ---------------------------------------------------------------------------
  // GET /admin/invoices/{invoicePubId}.pdf | .xml
  // ---------------------------------------------------------------------------
  app.get<{ Params: { invoiceFile: string } }>(
    '/api/2026-05-20/admin/invoices/:invoiceFile',
    { preHandler: [requirePermission(PERMISSIONS.ORDER_VIEW)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) {
        return reply.code(400).send({
          error: { code: 'NO_ACTIVE_TENANT', message: 'Select a tenant first' },
        });
      }
      const match = /^(inv_[A-Za-z0-9_-]+)\.(pdf|xml)$/.exec(req.params.invoiceFile);
      if (!match) {
        return reply.code(404).send({
          error: { code: 'INVOICE_NOT_FOUND', message: 'Invoice not found' },
        });
      }
      const [, pubId, format] = match;

      const found = await withTenant(rlsDb, tenantId, async (tx) => {
        const [invoice] = await tx
          .select()
          .from(schema.invoices)
          .where(and(eq(schema.invoices.tenantId, tenantId), eq(schema.invoices.pubId, pubId!)))
          .limit(1);
        if (!invoice) return null;
        const items = await tx
          .select()
          .from(schema.invoiceItems)
          .where(eq(schema.invoiceItems.invoiceId, invoice.id))
          .orderBy(asc(schema.invoiceItems.position));
        return { invoice, items };
      });
      if (!found) {
        return reply.code(404).send({
          error: { code: 'INVOICE_NOT_FOUND', message: 'Invoice not found' },
        });
      }
      const { invoice, items } = found;

      if (format === 'xml') {
        return reply
          .header('content-type', 'application/xml; charset=utf-8')
          .header('content-disposition', `attachment; filename="${invoice.number}.isdoc"`)
          .send(buildIsdocXml(invoice, items));
      }
      const pdf = await renderInvoicePdf(invoice, items);
      return reply
        .header('content-type', 'application/pdf')
        .header('content-disposition', `attachment; filename="${invoice.number}.pdf"`)
        .send(pdf);
    },
  );

  // ---------------------------------------------------------------------------
  // GET /storefront/{tenantSlug}/orders/{orderNumber}/invoice.pdf?email=
  // ---------------------------------------------------------------------------
  app.get<{
    Params: { tenantSlug: string; orderNumber: string };
    Querystring: { email?: string };
  }>(
    '/api/2026-05-20/storefront/:tenantSlug/orders/:orderNumber/invoice.pdf',
    async (req, reply) => {
      const [tenant] = await db
        .select({ id: schema.tenants.id, status: schema.tenants.status })
        .from(schema.tenants)
        .where(eq(schema.tenants.slug, req.params.tenantSlug))
        .limit(1);
      if (!tenant || tenant.status !== 'active') {
        return reply.code(404).send({
          error: { code: 'TENANT_NOT_FOUND', message: 'tenant not found' },
        });
      }
      const [order] = await db
        .select({
          id: schema.orders.id,
          customerEmail: schema.orders.customerEmail,
        })
        .from(schema.orders)
        .where(
          and(
            eq(schema.orders.tenantId, tenant.id),
            eq(schema.orders.orderNumber, req.params.orderNumber),
          ),
        )
        .limit(1);
      // Anti-enumeration — same convention as order confirmation
      const providedEmail = req.query.email?.toLowerCase();
      if (!order || !providedEmail || providedEmail !== order.customerEmail.toLowerCase()) {
        return reply.code(404).send({
          error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' },
        });
      }
      const found = await getInvoiceForOrder(db, order.id, 'invoice');
      if (!found) {
        return reply.code(404).send({
          error: { code: 'INVOICE_NOT_FOUND', message: 'Invoice not issued yet' },
        });
      }
      const pdf = await renderInvoicePdf(found.invoice, found.items);
      return reply
        .header('content-type', 'application/pdf')
        .header('content-disposition', `attachment; filename="${found.invoice.number}.pdf"`)
        .send(pdf);
    },
  );

  // ---------------------------------------------------------------------------
  // GET /admin/exports/pohoda.xml?from=&to=&kind= — Pohoda accounting export
  // (per `29`). Issued invoices (+ credit notes) in a date range as a Pohoda
  // dataPack the merchant imports into Stormware Pohoda. CZ-essential.
  // ---------------------------------------------------------------------------
  app.get<{ Querystring: { from?: string; to?: string } }>(
    '/api/2026-05-20/admin/exports/pohoda.xml',
    { preHandler: [requirePermission(PERMISSIONS.ADMIN_FULL)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) {
        return reply.code(400).send({
          error: { code: 'NO_ACTIVE_TENANT', message: 'Select a tenant first' },
        });
      }
      const isoDate = /^\d{4}-\d{2}-\d{2}$/;
      const fromStr = req.query.from && isoDate.test(req.query.from) ? req.query.from : null;
      const toStr = req.query.to && isoDate.test(req.query.to) ? req.query.to : null;
      const from = fromStr ? new Date(`${fromStr}T00:00:00.000Z`) : null;
      const to = toStr ? new Date(`${toStr}T23:59:59.999Z`) : null;

      const { invoices, ico } = await withTenant(rlsDb, tenantId, async (tx) => {
        const conditions = [eq(schema.invoices.tenantId, tenantId), eq(schema.invoices.isVoid, false)];
        if (from) conditions.push(gte(schema.invoices.issuedAt, from));
        if (to) conditions.push(lte(schema.invoices.issuedAt, to));
        const rows = await tx
          .select()
          .from(schema.invoices)
          .where(and(...conditions))
          .orderBy(asc(schema.invoices.issuedAt));

        const itemsByInvoice = new Map<string, (typeof schema.invoiceItems.$inferSelect)[]>();
        if (rows.length > 0) {
          const allItems = await tx
            .select()
            .from(schema.invoiceItems)
            .where(eq(schema.invoiceItems.tenantId, tenantId))
            .orderBy(asc(schema.invoiceItems.position));
          for (const it of allItems) {
            const arr = itemsByInvoice.get(it.invoiceId) ?? [];
            arr.push(it);
            itemsByInvoice.set(it.invoiceId, arr);
          }
        }

        const sellerIco =
          rows.length > 0
            ? ((rows[0]!.sellerSnapshot as { ico?: string }).ico ?? '')
            : '';

        const mapped: PohodaInvoice[] = rows.map((inv) => ({
          number: inv.number,
          kind: inv.kind,
          variableSymbol: inv.variableSymbol,
          issuedAt: inv.issuedAt,
          dueAt: null,
          taxPointAt: null,
          currency: inv.currency,
          sellerSnapshot: inv.sellerSnapshot as PohodaInvoice['sellerSnapshot'],
          buyerSnapshot: inv.buyerSnapshot as PohodaInvoice['buyerSnapshot'],
          priceIncludesTax: inv.priceIncludesTax,
          items: (itemsByInvoice.get(inv.id) ?? []).map((it) => ({
            title: it.title,
            quantity: it.quantity,
            unitLabel: it.unitLabel,
            netAmount: it.netAmount,
            taxAmount: it.taxAmount,
            grossAmount: it.grossAmount,
            taxRateBasisPoints: it.taxRateBasisPoints,
          })),
        }));
        return { invoices: mapped, ico: sellerIco };
      });

      const xml = buildPohodaDataPack(invoices, ico);
      const fname = `pohoda-${fromStr ?? 'vse'}_${toStr ?? 'vse'}.xml`;
      return reply
        .header('content-type', 'application/xml; charset=utf-8')
        .header('content-disposition', `attachment; filename="${fname}"`)
        .send(xml);
    },
  );
}

// =============================================================================
// Helpers
// =============================================================================

async function findOrder(db: AppDb | TenantTx, tenantId: string, orderPubId: string) {
  const [order] = await db
    .select({ id: schema.orders.id })
    .from(schema.orders)
    .where(and(eq(schema.orders.tenantId, tenantId), eq(schema.orders.pubId, orderPubId)))
    .limit(1);
  return order ?? null;
}

function serializeInvoiceSummary(inv: typeof schema.invoices.$inferSelect) {
  return {
    id: inv.pubId,
    kind: inv.kind,
    number: inv.number,
    variable_symbol: inv.variableSymbol,
    issued_at: inv.issuedAt,
    taxable_supply_date: inv.taxableSupplyDate,
    currency: inv.currency,
    subtotal: { amount: inv.subtotalAmount.toString(), currency: inv.currency },
    tax: { amount: inv.taxAmount.toString(), currency: inv.currency },
    total: { amount: inv.totalAmount.toString(), currency: inv.currency },
    is_void: inv.isVoid,
  };
}
