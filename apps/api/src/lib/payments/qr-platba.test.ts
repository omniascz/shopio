/**
 * SPAYD (QR Platba) builder tests (per `13`).
 */

import { describe, expect, it } from 'vitest';
import { buildSpayd } from './qr-platba';

describe('buildSpayd', () => {
  it('builds a valid SPAYD string', () => {
    const s = buildSpayd({
      iban: 'CZ65 0800 0000 1920 0014 5399',
      amountMinor: 42800n,
      currency: 'CZK',
      variableSymbol: 'ORD-2026-00000045',
      message: 'Objednavka ORD-2026-00000045',
    });
    expect(s).toMatch(/^SPD\*1\.0\*/);
    expect(s).toContain('ACC:CZ6508000000192000145399'); // spaces stripped
    expect(s).toContain('AM:428.00'); // haléře → major units
    expect(s).toContain('CC:CZK');
    expect(s).toContain('X-VS:2026000000'); // digits only, max 10
  });

  it('omits VS when no digits', () => {
    const s = buildSpayd({ iban: 'CZ65', amountMinor: 100n, currency: 'CZK', variableSymbol: 'abc' });
    expect(s).not.toContain('X-VS');
    expect(s).toContain('AM:1.00');
  });
});
