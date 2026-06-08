/**
 * Parser tests for ARES + VIES (per `21`). The live fetches fail soft and aren't
 * exercised here; we test the pure parsers with captured-shape fixtures.
 */

import { describe, expect, it } from 'vitest';
import { parseAres, parseVies, splitVatId } from './ares';

describe('parseAres', () => {
  it('maps a full ARES record with street + orientation number', () => {
    const out = parseAres({
      ico: '27074358',
      obchodniJmeno: 'Alza.cz a.s.',
      dic: 'CZ27074358',
      sidlo: { nazevObce: 'Praha', nazevUlice: 'Jankovcova', cisloDomovni: 1522, cisloOrientacni: 53, psc: 17000 },
    });
    expect(out.found).toBe(true);
    expect(out.name).toBe('Alza.cz a.s.');
    expect(out.vatId).toBe('CZ27074358');
    expect(out.address).toEqual({ line1: 'Jankovcova 1522/53', city: 'Praha', postalCode: '170 00', countryCode: 'CZ' });
  });

  it('prefixes a bare DIČ with CZ', () => {
    const out = parseAres({ ico: '12345678', obchodniJmeno: 'X', dic: '12345678', sidlo: { psc: '11000' } });
    expect(out.vatId).toBe('CZ12345678');
  });

  it('handles a non-VAT-payer (no dic) + village without street', () => {
    const out = parseAres({ ico: '00000001', obchodniJmeno: 'Obecní s.r.o.', sidlo: { nazevObce: 'Lhota', psc: 25001 } });
    expect(out.vatId).toBeNull();
    expect(out.address?.line1).toBe('Lhota');
    expect(out.address?.postalCode).toBe('250 01');
  });

  it('returns found:false for empty/garbage', () => {
    expect(parseAres({}).found).toBe(false);
    expect(parseAres(null).found).toBe(false);
    expect(parseAres({ ico: '1' }).found).toBe(false); // no name
  });
});

describe('splitVatId', () => {
  it('splits country + number', () => {
    expect(splitVatId('CZ12345678')).toEqual({ country: 'CZ', number: '12345678' });
    expect(splitVatId('sk 2020123456')).toEqual({ country: 'SK', number: '2020123456' });
  });
  it('returns null for missing country code', () => {
    expect(splitVatId('12345678')).toBeNull();
  });
});

describe('parseVies', () => {
  it('reads isValid + name/address', () => {
    const out = parseVies({ isValid: true, name: 'Firma s.r.o.', address: 'Praha 1', countryCode: 'CZ', vatNumber: '12345678' });
    expect(out).toEqual({ valid: true, name: 'Firma s.r.o.', address: 'Praha 1', countryCode: 'CZ', vatNumber: '12345678' });
  });
  it('treats invalid as valid:false', () => {
    expect(parseVies({ isValid: false }).valid).toBe(false);
    expect(parseVies({}).valid).toBe(false);
  });
});
