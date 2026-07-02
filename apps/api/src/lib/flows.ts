/**
 * Flow engine (P3) — no-code automation: trigger → conditions → actions.
 * Modelled on BaseLinker "Automatic Actions" / Shopware Flow Builder, but with
 * two things base.com does NOT give merchants: a durable, observable run log
 * (`flow_runs`) and automatic retries with exponential backoff for actions that
 * touch the outside world (webhooks, e-mail).
 *
 * The condition evaluator is pure + unit-tested. Each action returns a
 * structured {@link ActionOutcome}; the runner records one `flow_runs` row per
 * flow execution and re-queues failed actions for the retry worker.
 *
 * Context fields a condition can reference (built by the caller from the order):
 *   total (minor units), currency, country, payment_method, item_count,
 *   has_coupon (0/1), status, customer_email.
 * Operators: eq, neq, gt, gte, lt, lte, contains, not_contains, starts_with,
 *   ends_with, in.
 *
 * Actions: add_tag, set_note, set_metadata (mutate orders.metadata),
 *   email_merchant, email_customer, webhook.
 */

import { and, asc, desc, eq, inArray, lt, lte, sql as dsql } from 'drizzle-orm';
import { schema } from '@shopio/db';
import type { FastifyBaseLogger } from 'fastify';
import { sendEmail } from './email';
import { isPublicHttpUrl } from './net-guard';
import type { AppDb } from '../db';
import type { ShopioConfig } from '../config';

export type FlowContext = Record<string, string | number>;

const OPERATORS = [
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'contains',
  'not_contains',
  'starts_with',
  'ends_with',
  'in',
] as const;
export type FlowOperator = (typeof OPERATORS)[number];

export const FLOW_FIELDS = [
  'total',
  'currency',
  'country',
  'payment_method',
  'item_count',
  'has_coupon',
  'status',
  'customer_email',
] as const;

export const FLOW_ACTION_TYPES = [
  'add_tag',
  'set_note',
  'set_metadata',
  'email_merchant',
  'email_customer',
  'webhook',
] as const;
export type FlowActionType = (typeof FLOW_ACTION_TYPES)[number];

export interface FlowCondition {
  field: string;
  op: FlowOperator;
  value: string | number | Array<string | number>;
}

/** A single condition holds against the context. */
function conditionHolds(cond: FlowCondition, ctx: FlowContext): boolean {
  const actual = ctx[cond.field];
  if (actual === undefined) return false;
  const { op, value } = cond;
  const a = String(actual).toLowerCase();
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
      return a.includes(String(value).toLowerCase());
    case 'not_contains':
      return !a.includes(String(value).toLowerCase());
    case 'starts_with':
      return a.startsWith(String(value).toLowerCase());
    case 'ends_with':
      return a.endsWith(String(value).toLowerCase());
    case 'in':
      return Array.isArray(value) && value.map(String).includes(String(actual));
    default:
      return false;
  }
}

/** Condition group: legacy array = AND; object = all(AND) + any(OR). */
export type FlowConditions = FlowCondition[] | { all?: FlowCondition[]; any?: FlowCondition[] };

/**
 * Evaluate a flow's conditions against the context.
 *   - Array (legacy):  every condition must hold (AND). Empty array = always.
 *   - Object (groups): every `all` holds AND at least one `any` holds.
 * Anything else (null, primitive, empty object) never matches.
 */
export function evaluateConditions(conditions: unknown, ctx: FlowContext): boolean {
  if (Array.isArray(conditions)) {
    return (conditions as FlowCondition[]).every((c) => conditionHolds(c, ctx));
  }
  if (conditions && typeof conditions === 'object') {
    const g = conditions as { all?: FlowCondition[]; any?: FlowCondition[] };
    if (!('all' in g) && !('any' in g)) return false;
    const allOk = !Array.isArray(g.all) || g.all.every((c) => conditionHolds(c, ctx));
    const anyOk =
      !Array.isArray(g.any) || g.any.length === 0 || g.any.some((c) => conditionHolds(c, ctx));
    return allOk && anyOk;
  }
  return false;
}

export interface FlowAction {
  type: FlowActionType;
  tag?: string;
  note?: string;
  key?: string;
  value?: string;
  to?: string;
  subject?: string;
  url?: string;
}

export type ActionStatus = 'ok' | 'skipped' | 'error';
export interface ActionOutcome {
  type: string;
  status: ActionStatus;
  detail?: string;
}

const MAX_ATTEMPTS = 5;
const RETRY_BATCH = 20;
/** Terminal flow_runs older than this are swept so the audit table can't grow
 * without bound (a capped batch per worker tick). */
const RUN_RETENTION_DAYS = 30;
const RETENTION_SWEEP_BATCH = 500;

/**
 * Exponential backoff for a failed action's next attempt: 1m, 2m, 4m, 8m, …
 * capped at 6h. `attempt` is the attempt number that just failed (1-based).
 */
export function computeBackoffMs(attempt: number): number {
  const base = 60_000;
  const capped = 6 * 60 * 60_000;
  return Math.min(base * 2 ** Math.max(0, attempt - 1), capped);
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

/** Only actions that reach the outside world are worth retrying on failure. */
function isRetryable(type: string): boolean {
  return type === 'webhook' || type === 'email_merchant' || type === 'email_customer';
}

/** Pure JSON body posted by a `webhook` action. */
export function buildWebhookPayload(trigger: string, target: FlowTarget): Record<string, unknown> {
  return {
    event: trigger,
    order: {
      id: target.orderId,
      number: target.orderNumber,
      total: target.context.total,
      currency: target.context.currency,
      status: target.context.status,
      payment_method: target.context.payment_method,
    },
  };
}

/**
 * Execute one action against an order. Never throws — returns a structured
 * outcome so the runner can record it and decide whether to retry.
 */
async function executeAction(
  deps: FlowDeps,
  target: FlowTarget,
  action: FlowAction,
  trigger: string,
): Promise<ActionOutcome> {
  try {
    switch (action.type) {
      case 'add_tag': {
        if (!action.tag) return { type: action.type, status: 'skipped', detail: 'no tag' };
        await deps.db
          .update(schema.orders)
          .set({
            metadata: dsql`jsonb_set(coalesce(${schema.orders.metadata}, '{}'::jsonb), '{tags}',
              coalesce(${schema.orders.metadata} -> 'tags', '[]'::jsonb) || ${JSON.stringify([action.tag])}::jsonb)`,
            updatedAt: new Date(),
          })
          .where(eq(schema.orders.id, target.orderId));
        return { type: action.type, status: 'ok' };
      }
      case 'set_note': {
        if (!action.note) return { type: action.type, status: 'skipped', detail: 'no note' };
        await deps.db
          .update(schema.orders)
          .set({
            metadata: dsql`jsonb_set(coalesce(${schema.orders.metadata}, '{}'::jsonb), '{internal_note}', ${JSON.stringify(action.note)}::jsonb)`,
            updatedAt: new Date(),
          })
          .where(eq(schema.orders.id, target.orderId));
        return { type: action.type, status: 'ok' };
      }
      case 'set_metadata': {
        if (!action.key) return { type: action.type, status: 'skipped', detail: 'no key' };
        await deps.db
          .update(schema.orders)
          .set({
            metadata: dsql`jsonb_set(coalesce(${schema.orders.metadata}, '{}'::jsonb), '{custom}',
              coalesce(${schema.orders.metadata} -> 'custom', '{}'::jsonb) || ${JSON.stringify({ [action.key]: action.value ?? '' })}::jsonb)`,
            updatedAt: new Date(),
          })
          .where(eq(schema.orders.id, target.orderId));
        return { type: action.type, status: 'ok' };
      }
      case 'email_merchant': {
        if (!action.to) return { type: action.type, status: 'skipped', detail: 'no recipient' };
        const body = `Automatizace Shopio: objednávka ${target.orderNumber} odpovídá pravidlu.\nCelkem: ${target.context.total} ${target.context.currency}\nPlatba: ${target.context.payment_method}`;
        await sendEmail(deps.config, {
          to: action.to,
          subject: action.subject ?? `Objednávka ${target.orderNumber}`,
          text: body,
          html: `<p>${body.replace(/\n/g, '<br>')}</p>`,
        });
        return { type: action.type, status: 'ok' };
      }
      case 'email_customer': {
        const to = action.to || String(target.context.customer_email ?? '');
        if (!to) return { type: action.type, status: 'skipped', detail: 'no customer e-mail' };
        const body = `Dobrý den,\nvaše objednávka ${target.orderNumber} byla aktualizována.`;
        await sendEmail(deps.config, {
          to,
          subject: action.subject ?? `Objednávka ${target.orderNumber}`,
          text: body,
          html: `<p>${body.replace(/\n/g, '<br>')}</p>`,
        });
        return { type: action.type, status: 'ok' };
      }
      case 'webhook': {
        if (!action.url) return { type: action.type, status: 'skipped', detail: 'no url' };
        const guard = isPublicHttpUrl(action.url);
        // Blocked URL is a permanent config error → skip (don't retry forever).
        if (!guard.ok) return { type: action.type, status: 'skipped', detail: `blocked: ${guard.reason}` };
        const res = await fetch(action.url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'user-agent': 'Shopio-Flows/1' },
          body: JSON.stringify(buildWebhookPayload(trigger, target)),
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) {
          return { type: action.type, status: 'error', detail: `HTTP ${res.status}` };
        }
        return { type: action.type, status: 'ok' };
      }
      default:
        return { type: (action as FlowAction).type, status: 'skipped', detail: 'unknown action' };
    }
  } catch (err) {
    return {
      type: action.type,
      status: 'error',
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Run every action once; return per-action outcomes in order. */
async function runActions(
  deps: FlowDeps,
  target: FlowTarget,
  actions: FlowAction[],
  trigger: string,
): Promise<ActionOutcome[]> {
  const out: ActionOutcome[] = [];
  for (const action of actions) {
    out.push(await executeAction(deps, target, action, trigger));
  }
  return out;
}

/** Persist the outcome of one flow execution + queue any retryable failures. */
async function recordRun(
  deps: FlowDeps,
  flow: { id: string; pubId: string },
  trigger: string,
  target: FlowTarget,
  actions: FlowAction[],
  outcomes: ActionOutcome[],
): Promise<void> {
  const failedIdx = outcomes
    .map((o, i) => ({ o, i }))
    .filter(({ o }) => o.status === 'error' && isRetryable(o.type));
  const pendingActions = failedIdx.map(({ i }) => actions[i]!);
  const status = pendingActions.length === 0 ? 'succeeded' : 'pending_retry';
  const now = new Date();
  await deps.db
    .insert(schema.flowRuns)
    .values({
      tenantId: target.tenantId,
      flowId: flow.id,
      flowPubId: flow.pubId,
      triggerEvent: trigger as (typeof schema.FLOW_TRIGGERS)[number],
      orderId: target.orderId,
      orderNumber: target.orderNumber,
      status,
      attempts: 1,
      maxAttempts: MAX_ATTEMPTS,
      actionResults: outcomes,
      pendingActions,
      contextSnapshot: target.context,
      error: failedIdx[0]?.o.detail ?? null,
      nextAttemptAt: status === 'pending_retry' ? new Date(now.getTime() + computeBackoffMs(1)) : null,
    })
    .catch((err) => deps.log?.error({ err, flowId: flow.id }, 'flow.run_record_failed'));
}

/**
 * Run all active flows for a trigger event against an order. Loaded on the
 * superuser pool (post-commit best-effort) with an explicit tenant filter,
 * mirroring the outbound-webhook dispatch. Never throws to the caller.
 */
export async function runFlows(deps: FlowDeps, trigger: string, target: FlowTarget): Promise<void> {
  try {
    const flows = await deps.db
      .select()
      .from(schema.flows)
      .where(
        and(
          eq(schema.flows.tenantId, target.tenantId),
          eq(schema.flows.triggerEvent, trigger as (typeof schema.FLOW_TRIGGERS)[number]),
          eq(schema.flows.isActive, true),
        ),
      )
      .orderBy(desc(schema.flows.priority));

    for (const flow of flows) {
      if (!evaluateConditions(flow.conditions, target.context)) continue;
      const actions = Array.isArray(flow.actions) ? (flow.actions as FlowAction[]) : [];
      const outcomes = await runActions(deps, target, actions, trigger);
      await recordRun(deps, flow, trigger, target, actions, outcomes);
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

/**
 * Durable retry worker — re-attempts the failed actions of `pending_retry`
 * runs whose backoff has elapsed. Claims one row at a time FOR UPDATE SKIP
 * LOCKED so multiple app instances don't double-fire. Terminal after
 * MAX_ATTEMPTS (status → `failed`). Returns the number of runs advanced.
 *
 * Registered as an interval job in server.ts (BullMQ takes over in a later
 * wave, like the other sweepers).
 */
export async function runDueFlowRetries(deps: FlowDeps): Promise<number> {
  const now = new Date();
  const due = await deps.db
    .select({ id: schema.flowRuns.id })
    .from(schema.flowRuns)
    .where(and(eq(schema.flowRuns.status, 'pending_retry'), lte(schema.flowRuns.nextAttemptAt, now)))
    .orderBy(asc(schema.flowRuns.nextAttemptAt))
    .limit(RETRY_BATCH);

  let advanced = 0;
  for (const { id } of due) {
    await deps.db
      .transaction(async (tx) => {
        const [row] = await tx
          .select()
          .from(schema.flowRuns)
          .where(eq(schema.flowRuns.id, id))
          .for('update', { skipLocked: true })
          .limit(1);
        // Someone else grabbed it, or it advanced since we listed it.
        if (!row || row.status !== 'pending_retry') return;
        if (row.nextAttemptAt && row.nextAttemptAt.getTime() > Date.now()) return;

        const target: FlowTarget = {
          tenantId: row.tenantId,
          orderId: row.orderId ?? '',
          orderNumber: row.orderNumber ?? '',
          context: (row.contextSnapshot as FlowContext) ?? {},
        };
        const pending = Array.isArray(row.pendingActions)
          ? (row.pendingActions as FlowAction[])
          : [];
        const outcomes = await runActions(deps, target, pending, row.triggerEvent);

        const attempts = row.attempts + 1;
        const stillFailedIdx = outcomes
          .map((o, i) => ({ o, i }))
          .filter(({ o }) => o.status === 'error' && isRetryable(o.type));
        const stillPending = stillFailedIdx.map(({ i }) => pending[i]!);

        let status: 'succeeded' | 'pending_retry' | 'failed';
        let nextAttemptAt: Date | null = null;
        if (stillPending.length === 0) {
          status = 'succeeded';
        } else if (attempts >= row.maxAttempts) {
          status = 'failed';
        } else {
          status = 'pending_retry';
          nextAttemptAt = new Date(Date.now() + computeBackoffMs(attempts));
        }

        await tx
          .update(schema.flowRuns)
          .set({
            status,
            attempts,
            pendingActions: stillPending,
            actionResults: outcomes,
            error: stillFailedIdx[0]?.o.detail ?? null,
            nextAttemptAt,
            updatedAt: new Date(),
          })
          .where(eq(schema.flowRuns.id, id));
        advanced += 1;
      })
      .catch((err) => deps.log?.error({ err, runId: id }, 'flow.retry_failed'));
  }

  // Capped retention sweep of old terminal runs (keeps the audit table bounded).
  const cutoff = new Date(Date.now() - RUN_RETENTION_DAYS * 86_400_000);
  const stale = deps.db
    .select({ id: schema.flowRuns.id })
    .from(schema.flowRuns)
    .where(and(inArray(schema.flowRuns.status, ['succeeded', 'failed']), lt(schema.flowRuns.createdAt, cutoff)))
    .limit(RETENTION_SWEEP_BATCH);
  await deps.db
    .delete(schema.flowRuns)
    .where(inArray(schema.flowRuns.id, stale))
    .catch((err) => deps.log?.error({ err }, 'flow.retention_sweep_failed'));

  return advanced;
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
  customerEmail?: string | null;
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
    customer_email: order.customerEmail ?? '',
  };
}
