/**
 * Merchant analytics — per `20-analytics-reporting.md` MVP.
 *
 * Computed on-read from orders/order_items (no rollup table yet — fine at MVP
 * volume; JOB-COMPUTE-ANALYTICS-DAILY + analytics_daily_rollups land when a
 * tenant outgrows live aggregation). All queries tenant-scoped (RULE-ANL-005).
 *
 *   GET /admin/analytics?period=7d|30d|90d
 *
 * Metrics: revenue (paid), orders, AOV, daily revenue series, top products,
 * refunds, new vs returning customers. Deferred: cohorts, RFM, funnels, MRR,
 * multi-currency normalization, conversion (needs session tracking).
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, eq, gte, sql as dsql } from 'drizzle-orm';
import { schema } from '@shopio/db';
import { PERMISSIONS } from '@shopio/authz';
import { requirePermission } from '../plugins/auth-middleware';
import type { AppDb } from '../db';
import type { ShopioConfig } from '../config';

interface PluginOptions {
  config: ShopioConfig;
  db: AppDb;
}

const Query = z.object({ period: z.enum(['7d', '30d', '90d']).default('30d') });

const PERIOD_DAYS: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 };

export async function registerAnalyticsRoutes(
  app: FastifyInstance,
  opts: PluginOptions,
): Promise<void> {
  const { db } = opts;

  app.get(
    '/api/2026-05-20/admin/analytics',
    { preHandler: [requirePermission(PERMISSIONS.ORDER_VIEW)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) {
        return reply.code(400).send({
          error: { code: 'NO_ACTIVE_TENANT', message: 'Select a tenant first' },
        });
      }
      const parsed = Query.safeParse(req.query);
      if (!parsed.success) {
        return reply.code(422).send({ error: { code: 'VALIDATION_FAILED', message: 'Invalid period' } });
      }
      const days = PERIOD_DAYS[parsed.data.period]!;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const sinceIso = since.toISOString();

      // Paid orders in range = revenue source (by paid_at)
      const paidInRange = and(
        eq(schema.orders.tenantId, tenantId),
        eq(schema.orders.paymentStatus, 'paid'),
        gte(schema.orders.paidAt, since),
      );

      const [totals, series, topProducts, refunds, customerSplit, byChannel, currencyRow] =
        await Promise.all([
        db
          .select({
            orders: dsql<number>`COUNT(*)::int`,
            revenue: dsql<string>`COALESCE(SUM(${schema.orders.totalAmount}), 0)::text`,
          })
          .from(schema.orders)
          .where(paidInRange),

        // Daily revenue series (paid orders by day)
        db
          .select({
            day: dsql<string>`to_char(date_trunc('day', ${schema.orders.paidAt}), 'YYYY-MM-DD')`,
            revenue: dsql<string>`COALESCE(SUM(${schema.orders.totalAmount}), 0)::text`,
            orders: dsql<number>`COUNT(*)::int`,
          })
          .from(schema.orders)
          .where(paidInRange)
          .groupBy(dsql`date_trunc('day', ${schema.orders.paidAt})`)
          .orderBy(dsql`date_trunc('day', ${schema.orders.paidAt})`),

        // Top products by revenue (line totals on paid orders in range)
        db
          .select({
            productTitle: schema.orderItems.productTitleSnapshot,
            units: dsql<number>`SUM(${schema.orderItems.quantity})::int`,
            revenue: dsql<string>`COALESCE(SUM(${schema.orderItems.lineTotalAmount}), 0)::text`,
          })
          .from(schema.orderItems)
          .innerJoin(schema.orders, eq(schema.orders.id, schema.orderItems.orderId))
          .where(paidInRange)
          .groupBy(schema.orderItems.productTitleSnapshot)
          .orderBy(dsql`SUM(${schema.orderItems.lineTotalAmount}) DESC`)
          .limit(10),

        // Refunds in range (cumulative refunded amount on orders touched in range)
        db
          .select({
            amount: dsql<string>`COALESCE(SUM(${schema.orders.refundedAmount}), 0)::text`,
            count: dsql<number>`COUNT(*) FILTER (WHERE ${schema.orders.refundedAmount} > 0)::int`,
          })
          .from(schema.orders)
          .where(
            and(
              eq(schema.orders.tenantId, tenantId),
              gte(schema.orders.statusEnteredAt, since),
              dsql`${schema.orders.refundedAmount} > 0`,
            ),
          ),

        // New vs returning: customers with a paid order in range, split by
        // whether their first-ever paid order falls inside the range.
        db.execute(dsql`
          WITH firsts AS (
            SELECT customer_id, MIN(paid_at) AS ever_first
            FROM orders
            WHERE tenant_id = ${tenantId} AND payment_status = 'paid' AND customer_id IS NOT NULL
            GROUP BY customer_id
          )
          SELECT
            COUNT(*) FILTER (WHERE ever_first >= ${sinceIso})::int AS new_customers,
            COUNT(*) FILTER (WHERE ever_first < ${sinceIso} AND customer_id IN (
              SELECT DISTINCT customer_id FROM orders
              WHERE tenant_id = ${tenantId} AND payment_status = 'paid'
                AND customer_id IS NOT NULL AND paid_at >= ${sinceIso}
            ))::int AS returning_customers
          FROM firsts
        `),

        // Revenue by sales channel (per `22`) — paid orders in range.
        db
          .select({
            name: dsql<string>`COALESCE(${schema.channels.name}, ${schema.orders.channelKind})`,
            kind: dsql<string>`COALESCE(${schema.channels.kind}, ${schema.orders.channelKind})`,
            orders: dsql<number>`COUNT(*)::int`,
            revenue: dsql<string>`COALESCE(SUM(${schema.orders.totalAmount}), 0)::text`,
          })
          .from(schema.orders)
          .leftJoin(schema.channels, eq(schema.channels.id, schema.orders.channelId))
          .where(paidInRange)
          .groupBy(
            dsql`COALESCE(${schema.channels.name}, ${schema.orders.channelKind})`,
            dsql`COALESCE(${schema.channels.kind}, ${schema.orders.channelKind})`,
          )
          .orderBy(dsql`SUM(${schema.orders.totalAmount}) DESC`),

        db
          .select({ currency: schema.tenants.defaultCurrency })
          .from(schema.tenants)
          .where(eq(schema.tenants.id, tenantId))
          .limit(1),
      ]);

      const currency = currencyRow[0]?.currency ?? 'CZK';
      const ordersCount = totals[0]?.orders ?? 0;
      const revenue = BigInt(totals[0]?.revenue ?? '0');
      const aov = ordersCount > 0 ? revenue / BigInt(ordersCount) : 0n;
      const split = (customerSplit as unknown as { rows: { new_customers: number; returning_customers: number }[] }).rows?.[0]
        ?? { new_customers: 0, returning_customers: 0 };

      return reply.send({
        data: {
          period: parsed.data.period,
          currency,
          totals: {
            revenue: { amount: revenue.toString(), currency },
            orders: ordersCount,
            average_order_value: { amount: aov.toString(), currency },
          },
          revenue_series: series.map((s) => ({
            day: s.day,
            revenue: s.revenue,
            orders: s.orders,
          })),
          top_products: topProducts.map((p) => ({
            title: p.productTitle,
            units: p.units,
            revenue: { amount: p.revenue, currency },
          })),
          refunds: {
            amount: { amount: refunds[0]?.amount ?? '0', currency },
            count: refunds[0]?.count ?? 0,
          },
          customers: {
            new: split.new_customers ?? 0,
            returning: split.returning_customers ?? 0,
          },
          by_channel: byChannel.map((c) => ({
            name: c.name,
            kind: c.kind,
            orders: c.orders,
            revenue: { amount: c.revenue, currency },
          })),
        },
      });
    },
  );
}
