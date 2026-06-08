/**
 * Carrier registry + manual carrier tests (per `14-shipping.md`).
 */

import { describe, expect, it } from 'vitest';
import { getCarrier, manualTrackingUrl } from './registry';
import type { ShopioConfig } from '../../config';

const cfg = {} as ShopioConfig;

describe('getCarrier', () => {
  it('resolves zasilkovna to the real Packeta carrier', () => {
    const c = getCarrier('zasilkovna', cfg);
    expect(c.code).toBe('zasilkovna');
    expect(c.real).toBe(true);
  });

  it('resolves inpost to the real InPost carrier', () => {
    const c = getCarrier('inpost', cfg);
    expect(c.code).toBe('inpost');
    expect(c.real).toBe(true);
    expect(c.displayName).toContain('InPost');
  });

  it('resolves unknown/manual carriers to the manual carrier', () => {
    for (const code of ['ppl', 'dpd', 'cp', 'gls', 'whatever']) {
      const c = getCarrier(code, cfg);
      expect(c.code).toBe(code);
      expect(c.real).toBe(false);
    }
  });

  it('maps known carrier codes to friendly names', () => {
    expect(getCarrier('ppl', cfg).displayName).toBe('PPL');
    expect(getCarrier('dpd', cfg).displayName).toBe('DPD');
    expect(getCarrier('cp', cfg).displayName).toBe('Česká pošta');
  });
});

describe('manual carrier createLabel', () => {
  it('produces a deterministic barcode + placeholder label + tracking URL', async () => {
    const carrier = getCarrier('ppl', cfg);
    const input = {
      orderNumber: 'ORD-2026-00000001',
      shipmentNumber: 'SHP-2026-0001',
      recipientName: 'Jan Novák',
      recipientEmail: 'jan@example.com',
      weightGrams: 500,
      valueMajor: 1200,
      address: { line1: 'Dlouhá 1', city: 'Praha', postalCode: '11000' },
      providerOptions: {},
    };
    const a = await carrier.createLabel(input);
    const b = await carrier.createLabel(input);
    expect(a.provider).toBe('manual');
    expect(a.barcode).toMatch(/^PPL\d+/);
    expect(a.barcode).toBe(b.barcode); // deterministic across retries
    expect(a.trackingUrl).toContain(a.barcode);
    expect(a.labelPdfBase64.length).toBeGreaterThan(100); // a real PDF was rendered
  });
});

describe('InPost carrier createLabel (mock mode)', () => {
  it('produces a Paczkomat label + InPost tracking URL when no token', async () => {
    const carrier = getCarrier('inpost', cfg);
    const input = {
      orderNumber: 'ORD-2026-00000009',
      shipmentNumber: 'SHP-2026-0009',
      recipientName: 'Anna Kowalska',
      recipientEmail: 'anna@example.pl',
      weightGrams: 800,
      valueMajor: 200,
      pickup: { externalId: 'KRA010', name: 'Paczkomat KRA010' },
      providerOptions: {},
    };
    const a = await carrier.createLabel(input);
    const b = await carrier.createLabel(input);
    expect(a.provider).toBe('mock');
    expect(a.barcode).toBe(b.barcode); // deterministic
    expect(a.trackingUrl).toContain('inpost.pl');
    expect(a.trackingUrl).toContain(a.barcode);
    expect(a.labelPdfBase64.length).toBeGreaterThan(100);
  });
});

describe('manualTrackingUrl', () => {
  it('builds carrier-specific public tracking URLs', () => {
    expect(manualTrackingUrl('ppl', 'ABC123')).toContain('ppl.cz');
    expect(manualTrackingUrl('dpd', 'ABC123')).toContain('dpd.com');
    expect(manualTrackingUrl('cp', 'ABC123')).toContain('postaonline.cz');
    expect(manualTrackingUrl('ppl', 'ABC123')).toContain('ABC123');
  });

  it('returns null for carriers without a known template', () => {
    expect(manualTrackingUrl('unknown', 'X')).toBeNull();
  });

  it('builds DACH/UK/FR carrier tracking URLs', () => {
    expect(manualTrackingUrl('dhl', 'JD01')).toContain('dhl.de');
    expect(manualTrackingUrl('hermes', 'X')).toContain('myhermes.de');
    expect(manualTrackingUrl('royal_mail', 'RM9')).toContain('royalmail.com');
    expect(manualTrackingUrl('evri', 'H1')).toContain('evri.com');
    expect(manualTrackingUrl('mondial_relay', 'MR5')).toContain('mondialrelay.fr');
    expect(manualTrackingUrl('colissimo', 'C7')).toContain('laposte.fr');
    expect(manualTrackingUrl('chronopost', 'CH2')).toContain('chronopost.fr');
  });
});
