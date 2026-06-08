/**
 * Zásilkovna/Packeta carrier — wraps the existing `lib/packeta` REST client
 * (createPacket + getLabelPdf) behind the `CarrierProvider` interface. Real
 * mode when PACKETA_API_PASSWORD is set; deterministic mock label otherwise.
 */

import type { ShopioConfig } from '../../config';
import { createPacket, getLabelPdf, trackingUrlFor } from '../packeta';
import { splitRecipientName } from '../shipments';
import type { CarrierLabelInput, CarrierLabelResult, CarrierProvider } from './types';

export class PacketaCarrier implements CarrierProvider {
  readonly code = 'zasilkovna';
  readonly displayName = 'Zásilkovna';
  readonly real = true;

  constructor(private readonly config: ShopioConfig) {}

  trackingUrl(barcode: string): string {
    return trackingUrlFor(barcode);
  }

  async createLabel(input: CarrierLabelInput): Promise<CarrierLabelResult> {
    const opts = input.providerOptions as {
      home_delivery_carrier_id?: string;
      api_password?: string;
    };
    const recipient = splitRecipientName(input.recipientName, input.recipientEmail);

    const packet = await createPacket(this.config, {
      number: input.orderNumber,
      mockSeed: input.shipmentNumber,
      apiPassword: opts.api_password ?? null,
      name: recipient.name,
      surname: recipient.surname,
      email: input.recipientEmail,
      phone: input.recipientPhone,
      valueMajor: input.valueMajor,
      weightKg: Math.max(0.1, input.weightGrams / 1000),
      pickupPointExternalId: input.pickup?.externalId,
      homeDeliveryCarrierId: opts.home_delivery_carrier_id,
      ...(input.address?.line1 && input.address.city && input.address.postalCode
        ? {
            address: {
              street: input.address.line1,
              city: input.address.city,
              zip: input.address.postalCode,
            },
          }
        : {}),
    });

    const destination = input.pickup?.name
      ? `Výdejní místo: ${input.pickup.name}`
      : `${input.address?.line1 ?? ''}, ${input.address?.postalCode ?? ''} ${input.address?.city ?? ''}`;
    const labelPdf = await getLabelPdf(this.config, packet, {
      orderNumber: input.orderNumber,
      recipientName: input.recipientName,
      destinationLine: destination,
      apiPassword: opts.api_password ?? null,
    });

    return {
      provider: packet.provider,
      carrierShipmentId: packet.carrierShipmentId,
      barcode: packet.barcode,
      trackingUrl: trackingUrlFor(packet.barcode),
      labelPdfBase64: labelPdf.toString('base64'),
    };
  }
}
