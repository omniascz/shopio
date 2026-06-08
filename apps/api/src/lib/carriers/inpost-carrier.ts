/**
 * InPost carrier (PL) — wraps the ShipX client behind `CarrierProvider`.
 * Supports Paczkomaty (parcel lockers, via the pickup point's external id) and
 * courier home delivery. Real mode when the tenant configured an InPost token +
 * organization id; deterministic mock label otherwise.
 */

import type { CarrierLabelInput, CarrierLabelResult, CarrierProvider } from './types';
import { createInPostShipment, getInPostLabel, trackingUrlFor } from '../inpost';

export class InPostCarrier implements CarrierProvider {
  readonly code = 'inpost';
  readonly displayName = 'InPost';
  readonly real = true;

  trackingUrl(barcode: string): string {
    return trackingUrlFor(barcode);
  }

  async createLabel(input: CarrierLabelInput): Promise<CarrierLabelResult> {
    const opts = input.providerOptions as {
      inpost_api_token?: string;
      inpost_organization_id?: string;
    };
    const shipment = await createInPostShipment({
      orderNumber: input.orderNumber,
      mockSeed: input.shipmentNumber,
      apiToken: opts.inpost_api_token ?? null,
      organizationId: opts.inpost_organization_id ?? null,
      recipientName: input.recipientName,
      recipientEmail: input.recipientEmail,
      recipientPhone: input.recipientPhone,
      weightKg: Math.max(0.1, input.weightGrams / 1000),
      targetPoint: input.pickup?.externalId,
      ...(input.address?.line1 && input.address.city && input.address.postalCode
        ? {
            address: {
              street: input.address.line1,
              city: input.address.city,
              postalCode: input.address.postalCode,
            },
          }
        : {}),
    });

    const destination = input.pickup?.name
      ? `Paczkomat: ${input.pickup.name}`
      : `${input.address?.line1 ?? ''}, ${input.address?.postalCode ?? ''} ${input.address?.city ?? ''}`;
    const labelPdf = await getInPostLabel(shipment, {
      apiToken: opts.inpost_api_token ?? null,
      orderNumber: input.orderNumber,
      recipientName: input.recipientName,
      destinationLine: destination,
    });

    return {
      provider: shipment.provider,
      carrierShipmentId: shipment.carrierShipmentId,
      barcode: shipment.barcode,
      trackingUrl: trackingUrlFor(shipment.barcode),
      labelPdfBase64: labelPdf.toString('base64'),
    };
  }
}
