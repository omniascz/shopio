/**
 * Carrier registry (per `14-shipping.md`) — resolves a `carrier_code` to its
 * `CarrierProvider`. Zásilkovna uses the real Packeta API; every other code
 * (ppl/dpd/cp/balikovna/gls/…) falls back to the manual carrier.
 */

import type { ShopioConfig } from '../../config';
import type { CarrierProvider } from './types';
import { PacketaCarrier } from './packeta-carrier';
import { ManualCarrier } from './manual';

export function getCarrier(carrierCode: string, config: ShopioConfig): CarrierProvider {
  if (carrierCode === 'zasilkovna') return new PacketaCarrier(config);
  return new ManualCarrier(carrierCode);
}

/** Carrier catalog for the admin rate editor (code → label + capabilities). */
export const CARRIER_CATALOG: { code: string; displayName: string; real: boolean }[] = [
  { code: 'zasilkovna', displayName: 'Zásilkovna', real: true },
  { code: 'ppl', displayName: 'PPL', real: false },
  { code: 'dpd', displayName: 'DPD', real: false },
  { code: 'cp', displayName: 'Česká pošta', real: false },
  { code: 'balikovna', displayName: 'Balíkovna', real: false },
  { code: 'gls', displayName: 'GLS', real: false },
];

export * from './types';
export { manualTrackingUrl } from './manual';
