/**
 * Shipment/fulfillment domain helpers — per `14-shipping.md` + `16-order-management.md`.
 *
 * Pure logic (state machine, weight, shippable quantities, name splitting for
 * the carrier API); DB orchestration lives in `routes/shipments.ts`.
 */

export const SHIPMENT_TRANSITIONS: Record<string, string[]> = {
  pending: ['label_generated', 'cancelled'],
  label_generated: ['handed_over', 'cancelled'], // RULE-SHIP-030: pre-handover only
  handed_over: ['delivered'],
  delivered: [],
  cancelled: [],
};

export function isValidShipmentTransition(from: string, to: string): boolean {
  return (SHIPMENT_TRANSITIONS[from] ?? []).includes(to);
}

export class ShipmentError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** RULE-SHIP-003: item weight → variant grams, else tenant default (500 g). */
export const DEFAULT_ITEM_WEIGHT_GRAMS = 500;

export function computeShipmentWeight(
  items: { quantity: number; weightGrams: number | null }[],
): number {
  return items.reduce(
    (sum, it) => sum + it.quantity * (it.weightGrams ?? DEFAULT_ITEM_WEIGHT_GRAMS),
    0,
  );
}

/**
 * Remaining shippable quantity for an order item given prior live shipments
 * (cancelled shipments release their quantities).
 */
export function shippableQuantity(
  orderedQuantity: number,
  priorShipmentQuantities: { quantity: number; status: string }[],
): number {
  const held = priorShipmentQuantities
    .filter((s) => s.status !== 'cancelled')
    .reduce((sum, s) => sum + s.quantity, 0);
  return Math.max(0, orderedQuantity - held);
}

/** Packeta wants name + surname separately; orders store a single string. */
export function splitRecipientName(fullName: string | null, email: string): {
  name: string;
  surname: string;
} {
  const trimmed = (fullName ?? '').trim();
  if (!trimmed) return { name: email.split('@')[0] ?? 'Zákazník', surname: '—' };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { name: parts[0]!, surname: '—' };
  return { name: parts.slice(0, -1).join(' '), surname: parts[parts.length - 1]! };
}

/** SHP number: SHP-{year}-{0000 seq}. */
export function formatShipmentNumber(year: number, seq: number): string {
  return `SHP-${year}-${String(seq).padStart(4, '0')}`;
}
