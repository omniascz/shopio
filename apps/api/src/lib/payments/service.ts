/**
 * Payment orchestration — creates the `payments` row and drives the provider.
 *
 * Called from checkout after the order tx commits (mirrors how the legacy
 * Stripe session was created post-commit). One `payments` row per attempt; the
 * provider's redirect URL (if any) is stored on the row and returned to the
 * client. Offline providers (COD / bank transfer) return no redirect — the
 * order simply proceeds with payment held `pending`.
 */

import { eq } from 'drizzle-orm';
import { generatePubId } from '@shopio/authz';
import { schema, withTenant } from '@shopio/db';
import type { AppDb } from '../../db';
import type { SelectedProvider } from './registry';
import type { CreatePaymentInput, PaymentStatus } from './types';

export interface InitiatePaymentArgs {
  rlsDb: AppDb;
  tenantId: string;
  selected: SelectedProvider;
  input: Omit<CreatePaymentInput, 'paymentPubId' | 'idempotencyKey'> & {
    orderId: string;
    customerId: string | null;
  };
}

export interface InitiatePaymentResult {
  paymentPubId: string;
  redirectUrl: string | null;
  offline: boolean;
  status: string;
}

export async function initiatePayment(
  args: InitiatePaymentArgs,
): Promise<InitiatePaymentResult> {
  const { rlsDb, tenantId, selected, input } = args;
  const { provider, config } = selected;

  const paymentPubId = generatePubId('pay');
  const idempotencyKey = `pay_${input.orderId}`; // one initiation per order (RULE-PAY-003)

  // 1. Insert the pending payment row up-front so the gateway reference exists
  //    even if the provider call fails (the row records the failure).
  await withTenant(rlsDb, tenantId, (tx) =>
    tx.insert(schema.payments).values({
      tenantId,
      pubId: paymentPubId,
      orderId: input.orderId,
      customerId: input.customerId,
      providerCode: config.providerCode,
      kind: 'charge',
      status: 'pending',
      amount: input.amountMinor,
      currency: input.currency,
      methodKind: provider.capabilities.supportedMethodKinds[0] ?? null,
      idempotencyKey,
    }),
  );

  // 2. Drive the provider.
  let redirectUrl: string | null = null;
  let providerPaymentId: string | null = null;
  let status: PaymentStatus = 'pending';
  let failure: { code: string; message: string } | null = null;

  try {
    const result = await provider.createPayment({
      ...input,
      paymentPubId,
      idempotencyKey,
    });
    redirectUrl = result.redirectUrl;
    providerPaymentId = result.providerPaymentId;
    status = result.status;
  } catch (err) {
    status = 'failed';
    failure = {
      code: 'PROVIDER_ERROR',
      message: err instanceof Error ? err.message : 'Payment provider error',
    };
  }

  // 3. Persist the outcome.
  await withTenant(rlsDb, tenantId, (tx) =>
    tx
      .update(schema.payments)
      .set({
        providerPaymentId,
        authenticationUrl: redirectUrl,
        status,
        ...(failure && { failureCode: failure.code, failureMessage: failure.message }),
        ...(status === 'failed' && { failedAt: new Date() }),
        updatedAt: new Date(),
      })
      .where(eq(schema.payments.pubId, paymentPubId)),
  );

  if (failure) throw new Error(failure.message);

  return {
    paymentPubId,
    redirectUrl,
    offline: provider.capabilities.offline,
    status,
  };
}
