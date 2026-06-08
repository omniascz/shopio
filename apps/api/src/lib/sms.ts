/**
 * SMS notifications (Shoptet "SMS upozornění").
 *
 * Provider-agnostic HTTP gateway: when configured, POST {to, text, from} to
 * SMS_GATEWAY_URL with an optional bearer key. Without a gateway URL (or with
 * SMS_ENABLED=false) it's a no-op — same disabled-by-default model as SMTP, so
 * dev and CI never hit a real provider. CZ gateways (SMSbrana, GoSMS) fit this.
 */

import type { ShopioConfig } from '../config';

export function isSmsEnabled(config: ShopioConfig): boolean {
  return config.SMS_ENABLED && config.SMS_GATEWAY_URL.length > 0;
}

export interface SendSmsInput {
  to: string;
  text: string;
}

/** Send one SMS. Returns true if dispatched, false if SMS is not configured. */
export async function sendSms(config: ShopioConfig, input: SendSmsInput): Promise<boolean> {
  if (!isSmsEnabled(config)) return false;
  const res = await fetch(config.SMS_GATEWAY_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(config.SMS_API_KEY ? { authorization: `Bearer ${config.SMS_API_KEY}` } : {}),
    },
    body: JSON.stringify({
      to: input.to,
      text: input.text,
      ...(config.SMS_SENDER ? { from: config.SMS_SENDER } : {}),
    }),
  });
  return res.ok;
}
