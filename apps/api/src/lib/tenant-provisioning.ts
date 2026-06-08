/**
 * New-tenant provisioning — per `37-build-execution-plan.md` onboarding +
 * `15-tax-compliance.md` / `14-shipping.md` defaults.
 *
 * A freshly created shop must be sellable out of the box: without VAT rates
 * the tax engine silently falls back to 0 % (warning only), and without a
 * shipping zone checkout offers no delivery. This seeds sensible defaults the
 * merchant can edit later:
 *
 * - VAT rates for the shop's country (CZ 21/12/0, SK 23/19/0; others get the
 *   EU-minimum standard rate as a placeholder the merchant MUST review)
 * - one shipping zone for the home country with Zásilkovna pickup + home
 *   delivery rates (currency-aware amounts)
 * - a disabled Zásilkovna provider config (enabled once credentials are set)
 */

import { schema } from '@shopio/db';
import { generatePubId } from '@shopio/authz';
import type { AppDb } from '../db';
import { DEFAULT_CHANNELS } from './channels';

type DbConn = AppDb | Parameters<Parameters<AppDb['transaction']>[0]>[0];

interface TenantSeed {
  id: string;
  countryCode: string;
  defaultCurrency: string;
}

/** VAT defaults per country (basis points) — merchant-editable later. */
const VAT_DEFAULTS: Record<string, { code: string; bp: number; name: string }[]> = {
  CZ: [
    { code: 'standard', bp: 2100, name: 'DPH 21 %' },
    { code: 'reduced', bp: 1200, name: 'DPH 12 %' },
    { code: 'zero', bp: 0, name: 'DPH 0 %' },
  ],
  SK: [
    { code: 'standard', bp: 2300, name: 'DPH 23 %' },
    { code: 'reduced', bp: 1900, name: 'DPH 19 %' },
    { code: 'zero', bp: 0, name: 'DPH 0 %' },
  ],
};

/** Fallback for countries we don't have curated rates for yet. */
const VAT_FALLBACK = [{ code: 'standard', bp: 2100, name: 'VAT (zkontrolujte sazbu!)' }];

/** Shipping price defaults per currency (minor units). */
const SHIPPING_DEFAULTS: Record<
  string,
  { pickup: bigint; pickupFreeAbove: bigint; home: bigint }
> = {
  CZK: { pickup: 7900n, pickupFreeAbove: 150000n, home: 11900n },
  EUR: { pickup: 290n, pickupFreeAbove: 6000n, home: 490n },
};

/**
 * Seed defaults for a freshly created tenant. Runs inside the tenant-creation
 * transaction — a failure rolls back the whole signup step.
 */
export async function provisionTenantDefaults(tx: DbConn, tenant: TenantSeed): Promise<void> {
  const country = tenant.countryCode.toUpperCase();
  const currency = tenant.defaultCurrency.toUpperCase();

  // 1) VAT rates (effective from the 2024 CZ reform date — safely in the past)
  const rates = VAT_DEFAULTS[country] ?? VAT_FALLBACK;
  await tx.insert(schema.taxRates).values(
    rates.map((r) => ({
      tenantId: tenant.id,
      countryCode: country,
      taxClassCode: r.code,
      rateBasisPoints: r.bp,
      name: r.name,
      validFrom: '2024-01-01',
    })),
  );

  // 2) Home-country shipping zone + Zásilkovna rates
  const prices = SHIPPING_DEFAULTS[currency] ?? SHIPPING_DEFAULTS['EUR']!;
  const [zone] = await tx
    .insert(schema.shippingZones)
    .values({
      tenantId: tenant.id,
      name: country,
      countryCodes: [country],
      priority: 100,
    })
    .returning({ id: schema.shippingZones.id });

  await tx.insert(schema.shippingRates).values([
    {
      tenantId: tenant.id,
      shippingZoneId: zone!.id,
      carrierCode: 'zasilkovna',
      serviceCode: 'pickup_point',
      displayName: 'Zásilkovna — výdejní místo',
      description: 'Doručení na výdejní místo nebo Z-BOX.',
      kind: 'free_above_threshold' as const,
      amount: prices.pickup,
      currency,
      freeAboveAmount: prices.pickupFreeAbove,
      pickupOnly: true,
      supportsCod: true,
      estimatedDaysMin: 1,
      estimatedDaysMax: 2,
      priority: 10,
    },
    {
      tenantId: tenant.id,
      shippingZoneId: zone!.id,
      carrierCode: 'zasilkovna',
      serviceCode: 'home_delivery',
      displayName: 'Zásilkovna — doručení domů',
      description: 'Kurýr na adresu.',
      kind: 'flat' as const,
      amount: prices.home,
      currency,
      estimatedDaysMin: 1,
      estimatedDaysMax: 3,
      priority: 5,
    },
  ]);

  // 3) Carrier provider config — disabled until the merchant adds credentials
  await tx.insert(schema.shippingProviderConfigs).values({
    tenantId: tenant.id,
    carrierCode: 'zasilkovna',
    isEnabled: false,
    isTestMode: true,
    displayName: 'Zásilkovna',
  });

  // 4) Sales channels (per `22`) — web + manual active, POS off.
  await tx.insert(schema.channels).values(
    DEFAULT_CHANNELS.map((c) => ({
      tenantId: tenant.id,
      pubId: generatePubId('chn'),
      code: c.code,
      kind: c.kind,
      name: c.name,
      isActive: c.isActive,
    })),
  );

  // 5) Payment providers (per `13`) — offline methods enabled out of the box so
  //    a fresh shop can take orders before any gateway is connected. COD first,
  //    bank transfer second; gateways (GoPay/Stripe) are added by the merchant.
  await tx.insert(schema.paymentProviderConfigs).values([
    {
      tenantId: tenant.id,
      providerCode: 'cod',
      isEnabled: true,
      isTestMode: false,
      displayName: 'Dobírka',
      priority: 10,
      supportedMethodKinds: ['cod'],
    },
    {
      tenantId: tenant.id,
      providerCode: 'bank_transfer',
      isEnabled: true,
      isTestMode: false,
      displayName: 'Bankovní převod',
      priority: 5,
      supportedMethodKinds: ['bank_transfer'],
    },
  ]);
}
