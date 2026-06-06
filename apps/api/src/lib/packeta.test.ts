/**
 * Packeta webhook normalization tests — status mapping + payload parsing.
 */

import { describe, expect, it } from 'vitest';
import { mapPacketaStatus, parsePacketaWebhook } from './packeta';

describe('mapPacketaStatus', () => {
  it('maps delivery codes to delivered', () => {
    expect(mapPacketaStatus('5').kind).toBe('delivered');
    expect(mapPacketaStatus(7).kind).toBe('delivered');
  });

  it('maps transit/depot/pickup codes to carrier_progress', () => {
    expect(mapPacketaStatus('1').kind).toBe('carrier_progress');
    expect(mapPacketaStatus('3').kind).toBe('carrier_progress');
    expect(mapPacketaStatus('4').kind).toBe('carrier_progress');
  });

  it('maps return codes to returned', () => {
    expect(mapPacketaStatus('6').kind).toBe('returned');
    expect(mapPacketaStatus('9').kind).toBe('returned');
  });

  it('falls back to keyword matching on text', () => {
    expect(mapPacketaStatus(null, 'Packet was delivered to customer').kind).toBe('delivered');
    expect(mapPacketaStatus(null, 'Zásilka vrácena').kind).toBe('returned');
    expect(mapPacketaStatus(null, 'in transit to depot').kind).toBe('carrier_progress');
  });

  it('unknown codes degrade to unknown with text passthrough', () => {
    const e = mapPacketaStatus('424242', 'Something exotic');
    expect(e.kind).toBe('unknown');
    expect(e.description).toBe('Something exotic');
  });
});

describe('parsePacketaWebhook', () => {
  it('parses JSON payloads', () => {
    expect(
      parsePacketaWebhook({ barcode: 'Z123456789', status: 5, statusText: 'delivered' }),
    ).toEqual({
      barcode: 'Z123456789',
      packetId: null,
      statusCode: '5',
      statusText: 'delivered',
    });
  });

  it('parses XML payloads', () => {
    const xml = `<?xml version="1.0"?><packetStatus><packetId>987654</packetId><barcode>Z111222333</barcode><statusCode>4</statusCode><statusText>ready for pickup</statusText></packetStatus>`;
    expect(parsePacketaWebhook(xml)).toEqual({
      barcode: 'Z111222333',
      packetId: '987654',
      statusCode: '4',
      statusText: 'ready for pickup',
    });
  });

  it('returns nulls for garbage', () => {
    expect(parsePacketaWebhook(42)).toEqual({
      barcode: null,
      packetId: null,
      statusCode: null,
      statusText: null,
    });
  });
});
