/**
 * Carrier abstraction (per `14-shipping.md`) — mirrors the payment provider
 * pattern. The label/fulfillment flow talks to carriers only through
 * `CarrierProvider` so adding PPL / DPD / Česká pošta / Balíkovna doesn't touch
 * the shipments route.
 *
 * Two kinds: a `real` carrier with an API (Zásilkovna/Packeta) that creates a
 * packet + fetches a label, and `manual` carriers that produce a placeholder
 * label now and let the merchant paste the real tracking number after handing
 * the parcel over (no per-carrier API integration in the MVP).
 */

export interface CarrierLabelInput {
  orderNumber: string;
  shipmentNumber: string;
  recipientName: string;
  recipientEmail: string;
  recipientPhone?: string | undefined;
  weightGrams: number;
  valueMajor: number;
  /** Pickup point external id + name (pickup services). */
  pickup?: { externalId?: string | undefined; name?: string | undefined } | null;
  /** Home delivery address. */
  address?:
    | { line1?: string | undefined; city?: string | undefined; postalCode?: string | undefined }
    | null;
  /** Per-tenant provider options (api passwords, carrier ids, …). */
  providerOptions: Record<string, unknown>;
}

export interface CarrierLabelResult {
  /** Concrete provider that produced the label ('packeta','mock','manual'). */
  provider: string;
  carrierShipmentId: string;
  barcode: string;
  trackingUrl: string | null;
  labelPdfBase64: string;
}

export interface CarrierProvider {
  readonly code: string;
  readonly displayName: string;
  /** True when the carrier has a real label API (vs. manual placeholder). */
  readonly real: boolean;
  createLabel(input: CarrierLabelInput): Promise<CarrierLabelResult>;
  trackingUrl(barcode: string): string | null;
}
