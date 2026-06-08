/**
 * Balíkobot carrier (Shoptet "Balíkobot") — an aggregator that brokers labels
 * for many CZ/SK carriers (PPL, DPD, Česká pošta, GLS, …) through one account.
 *
 * Config-gated: when the tenant's provider options carry Balíkobot credentials
 * (`api_user`, `api_key`, `shipper`), we call their v2 API to register the
 * package and fetch the label. Without credentials — or on any API error — it
 * falls back to the manual placeholder label, so a shipment is never blocked.
 */

import type { CarrierLabelInput, CarrierLabelResult, CarrierProvider } from './types';
import { ManualCarrier } from './manual';

interface BalikobotOptions {
  api_user?: string;
  api_key?: string;
  shipper?: string; // 'cp' | 'ppl' | 'dpd' | 'gls' | 'zasilkovna' | …
}

const API_BASE = 'https://apiv2.balikobot.cz';

export class BalikobotCarrier implements CarrierProvider {
  readonly code = 'balikobot';
  readonly displayName = 'Balíkobot';
  readonly real = true;

  private readonly manual = new ManualCarrier('balikobot');

  trackingUrl(barcode: string): string | null {
    // Universal Balíkobot tracking — the aggregator resolves the real carrier.
    return `https://track.balikobot.cz/?id=${encodeURIComponent(barcode)}`;
  }

  async createLabel(input: CarrierLabelInput): Promise<CarrierLabelResult> {
    const opts = (input.providerOptions ?? {}) as BalikobotOptions;
    if (!opts.api_user || !opts.api_key || !opts.shipper) {
      // Not configured → provisional manual label (merchant pastes the real one).
      return { ...(await this.manual.createLabel(input)), provider: 'balikobot' };
    }
    try {
      const auth = Buffer.from(`${opts.api_user}:${opts.api_key}`).toString('base64');
      const headers = { authorization: `Basic ${auth}`, 'content-type': 'application/json' };

      // 1) Register the package (v2 /{shipper}/add).
      const addBody = {
        packages: [
          {
            eid: input.shipmentNumber,
            order_number: input.orderNumber,
            rec_name: input.recipientName,
            rec_email: input.recipientEmail,
            ...(input.recipientPhone ? { rec_phone: input.recipientPhone } : {}),
            ...(input.address
              ? { rec_street: input.address.line1, rec_city: input.address.city, rec_zip: input.address.postalCode }
              : {}),
            ...(input.pickup?.externalId ? { branch_id: input.pickup.externalId } : {}),
            weight: Math.max(0.1, input.weightGrams / 1000),
            price: input.valueMajor,
          },
        ],
      };
      const addRes = await fetch(`${API_BASE}/${opts.shipper}/add`, {
        method: 'POST',
        headers,
        body: JSON.stringify(addBody),
      });
      if (!addRes.ok) throw new Error(`balikobot add ${addRes.status}`);
      const added = (await addRes.json()) as {
        packages?: { package_id?: string; carrier_id?: string; label_url?: string }[];
      };
      const pkg = added.packages?.[0];
      if (!pkg?.package_id) throw new Error('balikobot add: no package id');

      // 2) Fetch the label PDF (from label_url if present, else /labels).
      let labelPdfBase64 = '';
      const labelUrl = pkg.label_url;
      if (labelUrl) {
        const lr = await fetch(labelUrl, { headers });
        if (lr.ok) labelPdfBase64 = Buffer.from(await lr.arrayBuffer()).toString('base64');
      }
      const barcode = pkg.carrier_id ?? pkg.package_id;
      return {
        provider: 'balikobot',
        carrierShipmentId: pkg.package_id,
        barcode,
        trackingUrl: this.trackingUrl(barcode),
        labelPdfBase64: labelPdfBase64 || (await this.manual.createLabel(input)).labelPdfBase64,
      };
    } catch {
      // Any failure → manual placeholder so the merchant can still ship.
      return { ...(await this.manual.createLabel(input)), provider: 'balikobot' };
    }
  }
}
