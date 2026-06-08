/**
 * Flow engine (P3) — no-code automation: trigger → conditions → actions.
 * The condition evaluator is pure + unit-tested; the runner executes a flow's
 * actions best-effort (post-commit, like the outbound-webhook dispatch).
 *
 * Context fields a condition can reference (built by the caller from the order):
 *   total (minor units), currency, country, payment_method, item_count,
 *   has_coupon (0/1), status.
 * Operators: eq, neq, gt, gte, lt, lte, contains, in.
 *
 * Actions (MVP): add_tag, set_note (mutate orders.metadata), email_merchant.
 */

import { and, desc, eq, sql as dsql } from 'drizzle-orm';
import { schema } from '@shopio/db';
import type { FastifyBaseLogger } from 'fastify';
import { sendEmail } from './email';
import type { AppDb } from '../db';
import type { ShopioConfig } from '../config';

export type FlowContext = Record<string, string | number>;

export interface FlowCondition {
  field: string;
  op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in';
  value: string | number | Array<string | number>;
}

/** A single condition holds against the context. */
function conditionHolds(cond: FlowCondition, ctx: FlowContext): boolean {
  const actual = ctx[cond.field];
  if (actual === undefined) return false;
  const { op, value } = cond;
  switch (op) {
    case 'eq':
      return String(actual) === String(value);
    case 'neq':
      return String(actual) !== String(value);
    case 'gt':
      return Number(actual) > Number(value);
    case 'gte':
      return Number(actual) >= Number(value);
    case 'lt':
      return Number(actual) < Number(value);
    case 'lte':
      return Number(actual) <= Number(value);
    case 'contains':
      return String(actual).toLowerCase().includes(String(value).toLowerCase());
    case 'in':
      return Array.isArray(value) && value.map(String).includes(String(actual));
    default:
      return false;
  }
}

/** All conditions must hold (AND). Empty conditions = always matches. */
export function evaluateConditions(conditions: unknown, ctx: FlowContext): boolean {
  if (!Array.isArray(conditions)) return false;
  return (conditions as FlowCondition[]).every((c) => conditionHolds(c, ctx));
}

export interface FlowAction {
  type: 'add_tag' | 'set_note' | 'email_merchant';
  tag?: string;
  note?: string;
  to?: string;
  subject?: string;
}

interface FlowDeps {
  db: AppDb;
  config: ShopioConfig;
  log?: FastifyBaseLogger;
}

interface FlowTarget {
  tenantId: string;
  orderId: string;
  orderNumber: string;
  context: FlowContext;
}

/** Execute one action against an order. Best-effort; swallows action errors. */
async function executeAction(deps: FlowDeps, target: FlowTarget, action: FlowAction): Promise<void> {
  switch (action.type) {
    case 'add_tag': {
      if (!action.tag) return;
      await deps.db
        .update(schema.orders)
        .set({
          metadata: dsql`jsonb_set(coalesce(${schema.orders.metadata}, '{}'::jsonb), '{tags}',
            coalesce(${schema.orders.metadata} -> 'tags', '[]'::jsonb) || ${JSON.stringify([action.tag])}::jsonb)`,
          updatedAt: new Date(),
        })
        .where(eq(schema.orders.id, target.orderId));
      return;
    }
    case 'set_note': {
      if (!action.note) return;
      await deps.db
        .update(schema.orders)
        .set({
          metadata: dsql`jsonb_set(coalesce(${schema.orders.metadata}, '{}'::jsonb), '{internal_note}', ${JSON.stringify(action.note)}::jsonb)`,
          updatedAt: new Date(),
        })
        .where(eq(schema.orders.id, target.orderId));
      return;
    }
    case 'email_merchant': {
      if (!action.to) return;
      const body = `Automatizace Shopio: objednávka ${target.orderNumber} odpovídá pravidlu.\nCelkem: ${target.context.total} ${target.context.currency}\nPlatba: ${target.context.payment_method}`;
      await sendEmail(deps.config, {
        to: action.to,
        subject: action.subject ?? `Objednávka ${target.orderNumber}`,
        text: body,
        html: `<p>${body.replace(/\n/g, '<br>')}</p>`,
      });
      return;
    }
  }
}

/**
 * Run all active flows for a trigger event against an order. Loaded on the
 * superuser pool (post-commit best-effort) with an explicit tenant filter,
 * mirroring the outbound-webhook dispatch. Never throws to the caller.
 */
export async function runFlows(
  deps: FlowDeps,
  trigger: string,
  target: FlowTarget,
): Promise<void> {
  try {
    const flows = await deps.db
      .select()
      .from(schema.flows)
      .where(
        and(
          eq(schema.flows.tenantId, target.tenantId),
          eq(schema.flows.triggerEvent, trigger as typeof schema.FLOW_TRIGGERS[number]),
          eq(schema.flows.isActive, true),
        ),
      )
      .orderBy(desc(schema.flows.priority));

    for (const flow of flows) {
      if (!evaluateConditions(flow.conditions, target.context)) continue;
      const actions = Array.isArray(flow.actions) ? (flow.actions as FlowAction[]) : [];
      for (const action of actions) {
        try {
          await executeAction(deps, target, action);
        } catch (err) {
          deps.log?.error({ err, flowId: flow.id, action: action.type }, 'flow.action_failed');
        }
      }
      await deps.db
        .update(schema.flows)
        .set({ lastRunAt: new Date(), runCount: dsql`${schema.flows.runCount} + 1` })
        .where(eq(schema.flows.id, flow.id))
        .catch(() => {});
    }
  } catch (err) {
    deps.log?.error({ err, trigger }, 'flow.run_failed');
  }
}

/** Build the standard order context for condition evaluation. */
export function buildOrderContext(order: {
  totalAmount: bigint;
  currency: string;
  shippingAddress: unknown;
  paymentMethod: string | null;
  status: string;
  couponCode: string | null;
  itemCount: number;
}): FlowContext {
  const country = (order.shippingAddress as { countryCode?: string } | null)?.countryCode ?? '';
  return {
    total: Number(order.totalAmount),
    currency: order.currency,
    country,
    payment_method: order.paymentMethod ?? '',
    item_count: order.itemCount,
    has_coupon: order.couponCode ? 1 : 0,
    status: order.status,
  };
}
