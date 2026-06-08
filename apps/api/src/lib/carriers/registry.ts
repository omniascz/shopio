/**
 * Carrier registry (per `14-shipping.md`) — resolves a `carrier_code` to its
 * `CarrierProvider`. Zásilkovna uses the real Packeta API; every other code
 * (ppl/dpd/cp/balikovna/gls/…) falls back to the manual carrier.
 */

import type { ShopioConfig } from '../../config';
import type { CarrierProvider } from './types';
import { PacketaCarrier } from './packeta-carrier';
import { InPostCarrier } from './inpost-carrier';
import { BalikobotCarrier } from './balikobot-carrier';
import { ManualCarrier } from './manual';

export function getCarrier(carrierCode: string, config: ShopioConfig): CarrierProvider {
  if (carrierCode === 'zasilkovna') return new PacketaCarrier(config);
  if (carrierCode === 'inpost') return new InPostCarrier();
  if (carrierCode === 'balikobot') return new BalikobotCarrier();
  return new ManualCarrier(carrierCode);
}

/** Carrier catalog for the admin rate editor (code → label + capabilities). */
export const CARRIER_CATALOG: { code: string; displayName: string; real: boolean }[] = [
  // CZ
  { code: 'zasilkovna', displayName: 'Zásilkovna', real: true },
  { code: 'ppl', displayName: 'PPL', real: false },
  { code: 'dpd', displayName: 'DPD', real: false },
  { code: 'cp', displayName: 'Česká pošta', real: false },
  { code: 'balikovna', displayName: 'Balíkovna', real: false },
  { code: 'gls', displayName: 'GLS', real: false },
  // Aggregator (brokers labels for PPL/DPD/ČP/GLS/… via one account)
  { code: 'balikobot', displayName: 'Balíkobot', real: true },
  // PL
  { code: 'inpost', displayName: 'InPost (Paczkomaty)', real: true },
  // DACH
  { code: 'dhl', displayName: 'DHL', real: false },
  { code: 'hermes', displayName: 'Hermes', real: false },
  { code: 'dpd_de', displayName: 'DPD (DE)', real: false },
  // UK
  { code: 'royal_mail', displayName: 'Royal Mail', real: false },
  { code: 'evri', displayName: 'Evri', real: false },
  { code: 'dpd_uk', displayName: 'DPD (UK)', real: false },
  // FR
  { code: 'mondial_relay', displayName: 'Mondial Relay', real: false },
  { code: 'colissimo', displayName: 'Colissimo', real: false },
  { code: 'chronopost', displayName: 'Chronopost', real: false },
];

export * from './types';
export { manualTrackingUrl } from './manual';
