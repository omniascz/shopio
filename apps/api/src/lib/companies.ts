/**
 * B2B company helpers (per `21-b2b-complete.md` MVP).
 *
 * Scope: company billing profile + merchant-granted NET payment terms.
 * Deferred: credit limits/ledger, members/RBAC, quotes, PO workflow,
 * per-company price lists, dunning, EU reverse-charge.
 */

import { schema } from '@shopio/db';

export interface CompanyAddress {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
}

/** Snapshot stored on the order → flows onto the invoice buyer block. */
export interface CompanySnapshot {
  name: string;
  registration_number: string | null;
  vat_id: string | null;
  billing_address: CompanyAddress | null;
}

type Company = typeof schema.companies.$inferSelect;

export function buildCompanySnapshot(company: Company): CompanySnapshot {
  return {
    name: company.name,
    registration_number: company.registrationNumber ?? null,
    vat_id: company.vatId ?? null,
    billing_address: (company.billingAddress as CompanyAddress | null) ?? null,
  };
}

export function serializeCompany(company: Company) {
  return {
    id: company.pubId,
    name: company.name,
    registration_number: company.registrationNumber,
    vat_id: company.vatId,
    billing_address: company.billingAddress,
    net_terms_enabled: company.netTermsEnabled,
    net_terms_days: company.netTermsDays,
    created_at: company.createdAt,
  };
}
