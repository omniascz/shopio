# 15 – TAX & COMPLIANCE

> **Doména:** Daně (zejména DPH/VAT v EU), faktury (ISDOC 6.0.1 v CZ), legal compliance, OSS/IOSS reporting, místní účetní exporty (Pohoda, Money S3, iDoklad, DATEV pro DE). EU-first design. B2B reverse charge first-class. EET schema-ready (deactivated v CZ).

**Datum:** 2026-05-19
**Verze:** 1.0
**Status:** 🟡 DESIGN
**Reference:** [03 §7](03-data-models-master.md#7-pricing-promotions--tax) · [03 §9](03-data-models-master.md#9-orders-payments-shipments) · [10-pricing-promotions.md](10-pricing-promotions.md) · [12-checkout.md](12-checkout.md) · [16-order-management.md](16-order-management.md)

---

## 📑 Obsah

0. [Domain overview](#0-domain-overview)
1. [References](#1-references)
2. [Personas](#2-personas)
3. [Data models](#3-data-models)
4. [Tax engine](#4-tax-engine)
5. [Invoice generation pipeline](#5-invoice-generation-pipeline)
6. [State machines](#6-state-machines)
7. [Business rules](#7-business-rules)
8. [REST API endpoints](#8-rest-api-endpoints)
9. [GraphQL schema](#9-graphql-schema)
10. [Events](#10-events)
11. [Background jobs](#11-background-jobs)
12. [UI/UX flows](#12-uiux-flows)
13. [Country-specific compliance](#13-country-specific-compliance)
14. [Edge cases & error handling](#14-edge-cases--error-handling)
15. [Performance](#15-performance)
16. [Security & legal](#16-security--legal)
17. [Testing](#17-testing)
18. [Implementation checklist](#18-implementation-checklist)
19. [Open questions](#19-open-questions)

---

## 0. Domain overview

### 0.1 Co tato doména **je**

- **Tax engine** — výpočet DPH/VAT per line item podle (tax_class × tax_zone × time)
- **Tax zones** — geografické skupiny pro tax rules (typicky země)
- **Tax rates** — sazba per (zone, tax_class), historizovaná (změny v čase)
- **Tax classes** — `standard`, `reduced`, `super_reduced`, `zero`, `exempt`
- **Tax-inclusive vs exclusive** — per price list flag; engine konvertuje
- **B2B reverse charge** — EU intra-community VAT exemption pro B2B s validním VAT ID
- **OSS (One-Stop-Shop)** — EU-wide B2C destination-based VAT reporting helper
- **IOSS** — import One-Stop-Shop pro non-EU goods ≤ €150 (v1.0+)
- **VIES validation** — EU VAT ID lookup (touched v `12-checkout.md`)
- **ARES validation** — CZ IČO lookup (touched v `12`)
- **Invoice generation** — PDF + ISDOC 6.0.1 XML (CZ)
- **Invoice numbering** — legal sequences (per tenant, per year, gapless)
- **Credit notes (dobropis)** — refund-linked, immutable accounting record
- **Proforma invoices** — pre-payment advance invoices
- **Accounting exports** — Pohoda XML, Money S3, iDoklad API (CZ); DATEV (DE)
- **EKO-KOM reporting** — CZ packaging recycling fees
- **EET (Electronic Records of Sales)** — deactivated v CZ since 2023 but **schema ready**
- **Multi-currency tax** — order currency vs tax authority currency conversion
- **Tax-exempt customers** — charity, government, intra-EU B2B
- **Distance selling thresholds** — €10K EU-wide (post-July 2021 OSS); merchant alerts before crossing
- **Place of supply rules** — physical goods (shipping address) vs digital (consumer location)

### 0.2 Co tato doména **NENÍ**

- ❌ Pricing engine (→ `10`) — tax engine je samostatný post-pricing krok
- ❌ Payment processing (→ `13`)
- ❌ Order lifecycle (→ `16-order-management.md`)
- ❌ EU AI Act, CSRD (→ separate compliance docs, Fáze 4+)
- ❌ US sales tax (→ Fáze 3+, very different model — origin/destination/marketplace facilitator)
- ❌ Customs duties (→ `14-shipping.md` international + this doc cross-references)
- ❌ Income tax / corporate tax of merchant (out of platform scope)
- ❌ GDPR mechanics (→ `30-security.md`; tax data retention referenced here)

### 0.3 Diferenciátory

1. **EU-first compliance** — built-in B2B reverse charge, OSS reporting, VIES/ARES integration; not "afterthought addon"
2. **ISDOC 6.0.1 nativně** — CZ standard e-invoice format generated alongside PDF
3. **Pluggable accounting exports** — Pohoda, Money, iDoklad pre-built; SDK pro custom
4. **Historized tax rates** — VAT change (CZ reduced 15% → 12% v 2024) handled cleanly; existing orders use snapshot rate
5. **Tax engine deterministic** — pure function (line × address × time) → tax_amount; cacheable, idempotent
6. **0% transaction fee** ([DEC-BIZ-001](01-decisions-registry.md#dec-biz-001-pricing-model)) — žádný platform cut; tax flows fully to merchant
7. **EU AI Act ready** — AI-generated content disclosure on invoices/listings (Fáze 3+ hook)

---

## 1. References

- [03 §7](03-data-models-master.md#7-pricing-promotions--tax) — ENT-TAX-ZONE-001, ENT-TAX-RATE-001, ENT-TAX-EXEMPTION-001
- [03 §9](03-data-models-master.md#9-orders-payments-shipments) — ENT-INVOICE-001
- [10-pricing-promotions.md](10-pricing-promotions.md) — pricing → tax handoff (RULE-PRICING-004)
- [12-checkout.md](12-checkout.md) — VAT ID validation, B2B context
- [16-order-management.md](16-order-management.md) — invoice issuance triggered at order placement
- [17-returns-refunds.md](17-returns-refunds.md) — credit note generation on refund
- [18-customer-management.md](18-customer-management.md) — customer tax-exempt status
- [21-b2b-complete.md](21-b2b-complete.md) — B2B-specific tax workflows
- [22-multistore-channels.md](22-multistore-channels.md) — per-channel tax config
- [29-integrations.md](29-integrations.md) — Pohoda, iDoklad, Money S3, DATEV connectors
- [30-security.md](30-security.md) — retention policy (7 years CZ accounting law)
- EU VAT Directive 2006/112/EC + OSS implementation (Council Implementing Regulation 282/2011)
- CZ: Zákon č. 235/2004 Sb. (DPH)
- ISDOC 6.0.1 schema (isdoc.cz)
- VIES: ec.europa.eu/taxation_customs/vies/
- ARES: ares.gov.cz
- DE: UStG, USt-IdNr lookup
- IOSS: ec.europa.eu/taxation_customs/business/vat/ioss_en

---

## 2. Personas

| Persona | Použití | Klíčové permissions |
|---|---|---|
| `PERSONA-MERCHANT-OWNER` | Configure tax, view all invoices, accounting exports | `PERM-TAX-*`, `PERM-INVOICE-*` |
| `PERSONA-ACCOUNTANT` (external person, gets read API access) | Download invoices, exports | `PERM-INVOICE-VIEW`, `PERM-ACCOUNTING-EXPORT` |
| `PERSONA-FINANCE-MANAGER` | Tax reporting, OSS submission helper, credit notes | `PERM-TAX-VIEW`, `PERM-TAX-REPORT`, `PERM-INVOICE-CREDIT-NOTE` |
| `PERSONA-CUSTOMER-SERVICE` | View customer invoices, issue credit note on refund | `PERM-INVOICE-VIEW`, `PERM-INVOICE-CREDIT-NOTE` |
| `PERSONA-CUSTOMER` | Download own invoices, view receipts | Auth-gated to own orders |
| `PERSONA-COMPLIANCE-OFFICER` (Enterprise) | Audit logs, retention review | `PERM-TAX-AUDIT-VIEW`, `PERM-COMPLIANCE-*` |
| `PERSONA-AI-COPILOT` | Suggest tax class for new product, anomaly detection | `agent:tax:read` |
| `PERSONA-EXTERNAL-AGENT` | MCP `tax.calculate` (read-only) | `agent:catalog:read` |

---

## 3. Data models

### 3.1 `tax_zones` ([ENT-TAX-ZONE-001](03-data-models-master.md#ent-tax-zone-001))

```sql
CREATE TABLE tax_zones (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,                                          -- "Česká republika", "EU", "Outside EU"
  code TEXT NOT NULL,                                          -- short code 'CZ','EU','EU_OSS','NON_EU'
  country_codes CHAR(2)[] NOT NULL DEFAULT '{}',
  region_codes TEXT[] NULL,                                    -- e.g., DE Bundesländer
  is_eu BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_tax_zones_tenant_code UNIQUE (tenant_id, code)
);

CREATE INDEX idx_tax_zones_active ON tax_zones (tenant_id, priority DESC) WHERE is_active = true;
```

### 3.2 `tax_rates` ([ENT-TAX-RATE-001](03-data-models-master.md#ent-tax-rate-001))

Historized rates — VAT changes captured via `(valid_from, valid_until)` window.

```sql
CREATE TABLE tax_rates (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  tax_zone_id UUID NOT NULL REFERENCES tax_zones(id) ON DELETE CASCADE,
  tax_class_code TEXT NOT NULL CHECK (tax_class_code IN (
    'standard','reduced','super_reduced','zero','exempt','custom'
  )),
  rate_basis_points INTEGER NOT NULL CHECK (rate_basis_points >= 0 AND rate_basis_points <= 10000),
  -- 2100 = 21.00%, 1200 = 12.00%, 0 = 0%
  name TEXT NOT NULL,                                          -- "DPH 21 %", "DPH 12 %", "0 % - vývoz"
  compound BOOLEAN NOT NULL DEFAULT false,                      -- stacks on previous (e.g., Quebec QST)
  priority INTEGER NOT NULL DEFAULT 0,
  valid_from DATE NOT NULL,
  valid_until DATE NULL,                                        -- NULL = currently active
  display_inclusive_default BOOLEAN NOT NULL DEFAULT false,     -- B2C EU: typically true
  notes TEXT NULL,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_tax_rates_unique_window
    UNIQUE (tax_zone_id, tax_class_code, valid_from) DEFERRABLE INITIALLY IMMEDIATE,
  CONSTRAINT ck_tax_rate_window
    CHECK (valid_until IS NULL OR valid_until > valid_from)
);

CREATE INDEX idx_tax_rates_zone_class_active
  ON tax_rates (tax_zone_id, tax_class_code)
  WHERE valid_until IS NULL OR valid_until > now()::date;

CREATE INDEX idx_tax_rates_class_lookup
  ON tax_rates (tenant_id, tax_class_code, valid_from DESC);
```

**Migration patterns** when rate changes:
- New row with new `valid_from`
- Old row: SET `valid_until = new_row.valid_from - 1 day`
- Existing orders/invoices use snapshotted rate from `order_items.tax_rate_basis_points`

### 3.3 `tax_exemptions` ([ENT-TAX-EXEMPTION-001](03-data-models-master.md#ent-tax-exemption-001))

```sql
CREATE TABLE tax_exemptions (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  customer_id UUID NULL REFERENCES customers(id),
  company_id UUID NULL REFERENCES companies(id),
  kind TEXT NOT NULL CHECK (kind IN (
    'vat_reverse_charge',    -- intra-EU B2B
    'zero_rate_export',       -- export outside EU
    'non_profit',             -- charity, NGO
    'government',             -- government bodies
    'diplomatic',             -- embassies (rare)
    'b2b_eu',                  -- legacy alias for reverse_charge
    'manual_override'          -- merchant-issued, requires documentation
  )),
  vat_id TEXT NULL,                                            -- snapshot of validated VAT ID
  vies_validated_at TIMESTAMPTZ NULL,
  vies_validation_id TEXT NULL,                                 -- VIES consultation number
  evidence_media_id UUID NULL REFERENCES media(id),             -- PDF of exemption certificate
  notes TEXT NULL,
  valid_from DATE NOT NULL DEFAULT now()::date,
  valid_until DATE NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT ck_tax_exemption_subject CHECK (customer_id IS NOT NULL OR company_id IS NOT NULL)
);

CREATE INDEX idx_tax_exemptions_customer ON tax_exemptions (customer_id) WHERE is_active = true AND customer_id IS NOT NULL;
CREATE INDEX idx_tax_exemptions_company ON tax_exemptions (company_id) WHERE is_active = true AND company_id IS NOT NULL;
```

### 3.4 `tax_classes` *(reference table — typically static seeded)*

```sql
CREATE TABLE tax_classes (
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  code TEXT NOT NULL,                                           -- 'standard','reduced','super_reduced','zero','exempt'
  display_name TEXT NOT NULL,                                    -- "Základní 21 %", "Snížená 12 %"
  description TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  position INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (tenant_id, code)
);
```

Seeded per tenant at onboarding with default 5 classes.

### 3.5 `invoices` ([ENT-INVOICE-001](03-data-models-master.md#ent-invoice-001))

```sql
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  pub_id TEXT NOT NULL,                                         -- inv_ NanoID (separate from legal number)
  number TEXT NOT NULL,                                          -- "INV-2026-00001234" (legal sequence)
  order_id UUID NOT NULL REFERENCES orders(id),
  customer_id UUID NULL REFERENCES customers(id),
  company_id UUID NULL REFERENCES companies(id),
  -- kind
  kind TEXT NOT NULL CHECK (kind IN (
    'invoice',                  -- standard tax invoice
    'proforma',                 -- pre-payment advance
    'credit_note',              -- dobropis
    'advance',                  -- záloha (partial)
    'debit_note',               -- vrubopis (additional charge)
    'receipt'                   -- POS receipt (no VAT itemization)
  )) DEFAULT 'invoice',
  related_invoice_id UUID NULL REFERENCES invoices(id),          -- pro credit_note → original invoice
  -- legal numbers
  number_sequence_code TEXT NOT NULL,                             -- e.g., 'INV-2026' identifies the sequence
  number_sequence_position INTEGER NOT NULL,                       -- gapless sequential
  -- parties snapshot
  seller_snapshot JSONB NOT NULL,                                 -- name, ICO, DIC, address from tenant.legal_entity at issuance
  buyer_snapshot JSONB NOT NULL,                                  -- from order or company
  -- dates
  issued_at TIMESTAMPTZ NOT NULL,
  taxable_supply_date DATE NOT NULL,                              -- "DUZP" v CZ
  due_at TIMESTAMPTZ NULL,
  paid_at TIMESTAMPTZ NULL,
  -- amounts (snapshot from order)
  currency CHAR(3) NOT NULL,
  subtotal_amount BIGINT NOT NULL,                                -- net total
  discount_amount BIGINT NOT NULL DEFAULT 0,
  shipping_amount BIGINT NOT NULL DEFAULT 0,
  tax_amount BIGINT NOT NULL,
  total_amount BIGINT NOT NULL,                                    -- gross
  rounding_adjustment_amount BIGINT NOT NULL DEFAULT 0,             -- if rounded to whole CZK
  -- tax breakdown
  tax_breakdown JSONB NOT NULL,
  -- [{ "tax_class": "standard", "rate_basis_points": 2100, "base_amount": 100000, "tax_amount": 21000 }, ...]
  -- reverse charge?
  is_reverse_charge BOOLEAN NOT NULL DEFAULT false,
  reverse_charge_reason TEXT NULL,                                 -- "B2B intra-EU"
  buyer_vat_id TEXT NULL,                                           -- validated VAT ID at issuance
  -- payment info
  payment_method_kind TEXT NULL,
  payment_terms_days INTEGER NULL,
  bank_account_iban TEXT NULL,
  bank_account_swift TEXT NULL,
  variable_symbol TEXT NULL,                                        -- CZ banking convention
  constant_symbol TEXT NULL,
  specific_symbol TEXT NULL,
  -- delivery
  delivery_address_snapshot JSONB NULL,
  delivery_method TEXT NULL,
  -- documents
  pdf_media_id UUID NULL REFERENCES media(id),                       -- generated PDF
  pdf_generated_at TIMESTAMPTZ NULL,
  isdoc_xml_storage_key TEXT NULL,                                   -- ISDOC 6.0.1 XML S3 path
  isdoc_xml_generated_at TIMESTAMPTZ NULL,
  -- compliance
  isdoc_schema_version TEXT NULL,                                    -- '6.0.1'
  is_isdoc_signed BOOLEAN NOT NULL DEFAULT false,
  isdoc_signature_at TIMESTAMPTZ NULL,
  -- legal status
  is_void BOOLEAN NOT NULL DEFAULT false,                            -- voided in legal sense (rare; requires credit_note)
  void_reason TEXT NULL,
  void_at TIMESTAMPTZ NULL,
  -- EET (CZ Electronic Records of Sales) — deactivated v CZ since 2023 but schema-ready
  eet_dic_poplatnika TEXT NULL,
  eet_id_provoz INTEGER NULL,
  eet_id_pokl TEXT NULL,
  eet_fik TEXT NULL,                                                  -- fiscal identifier
  eet_bkp TEXT NULL,                                                  -- security code
  eet_pkp TEXT NULL,                                                  -- signature code
  eet_submitted_at TIMESTAMPTZ NULL,
  eet_response_at TIMESTAMPTZ NULL,
  -- ARES snapshot
  buyer_ico_validated_at TIMESTAMPTZ NULL,
  -- localization
  locale TEXT NOT NULL,
  notes TEXT NULL,
  internal_notes TEXT NULL,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL,
  version INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_invoices_tenant_number UNIQUE (tenant_id, number),
  CONSTRAINT uq_invoices_pub_id UNIQUE (tenant_id, pub_id),
  CONSTRAINT uq_invoices_sequence_position UNIQUE (tenant_id, number_sequence_code, number_sequence_position)
);

CREATE INDEX idx_invoices_order ON invoices (order_id, issued_at DESC);
CREATE INDEX idx_invoices_customer ON invoices (customer_id, issued_at DESC) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_invoices_kind_period ON invoices (tenant_id, kind, issued_at DESC);
CREATE INDEX idx_invoices_due_unpaid ON invoices (tenant_id, due_at) WHERE paid_at IS NULL AND kind = 'invoice';
CREATE INDEX idx_invoices_taxable_date ON invoices (tenant_id, taxable_supply_date DESC);
```

### 3.6 `invoice_items` *(line items snapshot)*

Although order_items has snapshot, invoice has its own immutable snapshot per row for legal evidentiary purpose.

```sql
CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  order_item_id UUID NULL REFERENCES order_items(id),               -- reference; may be NULL for ad-hoc items
  position INTEGER NOT NULL DEFAULT 0,
  sku TEXT NULL,
  title TEXT NOT NULL,
  description TEXT NULL,
  quantity NUMERIC(18,4) NOT NULL,                                   -- supports fractional (e.g., 1.5 kg)
  unit_label TEXT NULL,                                               -- 'ks','kg','hod'
  unit_price_amount BIGINT NOT NULL,                                  -- net unit price
  -- pricing
  net_amount BIGINT NOT NULL,                                          -- quantity × unit_price (net)
  discount_amount BIGINT NOT NULL DEFAULT 0,
  tax_class_code TEXT NOT NULL,
  tax_rate_basis_points INTEGER NOT NULL,
  tax_amount BIGINT NOT NULL,
  gross_amount BIGINT NOT NULL,                                         -- net - discount + tax
  -- snapshot details
  is_reverse_charge BOOLEAN NOT NULL DEFAULT false,
  reverse_charge_legal_note TEXT NULL,                                  -- "Daň odvede zákazník" (CZ) / "Reverse charge"
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_invoice_items_invoice ON invoice_items (invoice_id, position);
```

### 3.7 `invoice_number_sequences`

Gapless legal sequences per (tenant, code, year).

```sql
CREATE TABLE invoice_number_sequences (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  sequence_code TEXT NOT NULL,                                          -- 'INV-2026','PRO-2026','CRD-2026'
  year INTEGER NOT NULL,
  current_position INTEGER NOT NULL DEFAULT 0,
  format_pattern TEXT NOT NULL DEFAULT '{code}-{year}-{position:08d}',   -- format spec
  reset_strategy TEXT NOT NULL CHECK (reset_strategy IN ('yearly','monthly','never')) DEFAULT 'yearly',
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_invoice_sequences UNIQUE (tenant_id, sequence_code, year)
);
```

**Allocation pattern** atomic:
```sql
UPDATE invoice_number_sequences
SET current_position = current_position + 1, updated_at = now()
WHERE tenant_id = $1 AND sequence_code = $2 AND year = $3
RETURNING current_position;
-- (then format into number string)
```

### 3.8 `tax_reporting_periods` *(OSS, DPH report helper)*

Per-tenant periods for tax filing (quarterly OSS, monthly local).

```sql
CREATE TABLE tax_reporting_periods (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  scheme TEXT NOT NULL CHECK (scheme IN ('local_vat','oss','ioss','non_eu_oss')),
  country_code CHAR(2) NULL,                                            -- for local schemes
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','submitted','accepted','amended')) DEFAULT 'draft',
  total_taxable_amount BIGINT NULL,
  total_tax_amount BIGINT NULL,
  currency CHAR(3) NULL,
  submission_id TEXT NULL,                                              -- gov reference after submission
  submitted_at TIMESTAMPTZ NULL,
  accepted_at TIMESTAMPTZ NULL,
  pdf_report_storage_key TEXT NULL,
  xml_report_storage_key TEXT NULL,
  notes TEXT NULL,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_tax_reporting_periods UNIQUE (tenant_id, scheme, country_code, period_start)
);

CREATE INDEX idx_tax_reporting_periods_status ON tax_reporting_periods (tenant_id, status, period_start DESC);
```

### 3.9 `accounting_exports` *(history of exports)*

```sql
CREATE TABLE accounting_exports (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  pub_id TEXT NOT NULL,
  target TEXT NOT NULL CHECK (target IN ('pohoda','money_s3','idoklad','datev','custom_xml','custom_csv')),
  scope TEXT NOT NULL CHECK (scope IN ('invoices','credit_notes','orders','payments','combined')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  filters JSONB NULL,                                                    -- additional filters
  output_format TEXT NOT NULL CHECK (output_format IN ('xml','csv','json','api_push')),
  output_storage_key TEXT NULL,                                          -- S3 path
  api_response_payload JSONB NULL,                                       -- for api_push (iDoklad)
  record_count INTEGER NULL,
  total_amount BIGINT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','processing','completed','failed')) DEFAULT 'pending',
  initiated_by_user_id UUID NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ NULL,
  failure_reason TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_accounting_exports_pub_id UNIQUE (tenant_id, pub_id)
);

CREATE INDEX idx_accounting_exports_recent ON accounting_exports (tenant_id, started_at DESC);
```

### 3.10 `eet_records` *(EET audit, deactivated in CZ but schema-ready)*

```sql
CREATE TABLE eet_records (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  invoice_id UUID NULL REFERENCES invoices(id),
  order_id UUID NULL REFERENCES orders(id),
  dic_poplatnika TEXT NOT NULL,
  id_provoz INTEGER NOT NULL,
  id_pokl TEXT NOT NULL,
  porad_cis TEXT NOT NULL,
  dat_trzby TIMESTAMPTZ NOT NULL,
  celk_trzba BIGINT NOT NULL,                                             -- minor units
  zakl_dan1 BIGINT NULL,                                                  -- standard rate base
  dan1 BIGINT NULL,
  zakl_dan2 BIGINT NULL,                                                  -- reduced rate base
  dan2 BIGINT NULL,
  zakl_dan3 BIGINT NULL,                                                  -- super reduced rate base
  dan3 BIGINT NULL,
  zakl_nepodl_dph BIGINT NULL,                                            -- not subject to VAT
  cest_sluz BIGINT NULL,                                                  -- travel service
  pouzit_zboz1 BIGINT NULL,                                                -- used goods
  pouzit_zboz2 BIGINT NULL,
  pouzit_zboz3 BIGINT NULL,
  urceno_cerp_zuct BIGINT NULL,
  cerp_zuct BIGINT NULL,
  rezim INTEGER NOT NULL DEFAULT 0,                                        -- 0=běžný, 1=zjednodušený
  fik TEXT NULL,                                                            -- assigned by tax authority
  bkp TEXT NOT NULL,                                                        -- security code (UUID)
  pkp TEXT NOT NULL,                                                        -- signature code (4096-bit RSA)
  submitted_at TIMESTAMPTZ NULL,
  response_at TIMESTAMPTZ NULL,
  response_status TEXT NULL,
  response_warning JSONB NULL,
  attempt INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_eet_records_invoice ON eet_records (invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX idx_eet_records_unsubmitted ON eet_records (tenant_id, created_at) WHERE submitted_at IS NULL;
```

### 3.11 Vztahy

```
tenants (1)──(N) tax_zones (1)──(N) tax_rates
tenants (1)──(N) tax_classes [reference]
customers / companies (1)──(N) tax_exemptions
orders (1)──(N) invoices [primary + credit_note(s) + advance + proforma]
invoices (1)──(N) invoice_items
invoices (1)──(0..1) media [PDF]
invoices (1)──(0..1) eet_records [CZ only, deactivated]
invoices (1)──(0..1) invoices [credit_note → related_invoice]
tenants (1)──(N) invoice_number_sequences
tenants (1)──(N) tax_reporting_periods
tenants (1)──(N) accounting_exports
```

---

## 4. Tax engine

Stěžejní sekce. Tax engine je **pure function** (line × address × time) → tax_amount. Pricing engine (z `10`) called first, tax engine called second.

### 4.1 Pipeline stages

```
INPUT:
  - lines: [{ variant_id, quantity, unit_price_amount, line_subtotal_after_discount, tax_class_code, requires_shipping }]
  - shipping_amount: bigint (post-discount)
  - shipping_tax_class_code: string (typically 'standard' or 'reduced' per country)
  - customer_address: { country_code, region, postal_code }
  - tenant_company_country: string (seller VAT-registered country)
  - tenant_company_vat_id: string
  - tenant_oss_registered: boolean
  - buyer_vat_id?: string (B2B)
  - buyer_vat_id_validated: boolean (VIES checked)
  - is_b2b: boolean (derived)
  - currency: string
  - timestamp: Date (for historized rates)
  - place_of_supply_override?: 'physical_goods' | 'digital_services'

STAGE 1: PLACE OF SUPPLY DETERMINATION
  For physical goods: place of supply = ship-to country (customer_address.country_code)
  For digital services / e-services (B2C in EU): place of supply = consumer country
  For B2B: place of supply = buyer's country (reverse charge applies in most cross-border EU cases)

STAGE 2: REVERSE CHARGE CHECK (B2B)
  If is_b2b AND buyer_vat_id_validated AND buyer_country ≠ seller_country AND both EU:
    apply_reverse_charge = true
    Set tax_amount = 0 for all lines (and shipping)
    Add legal note "Daň odvede zákazník" / "Reverse charge"
    SKIP rest of computation
  
STAGE 3: ZONE RESOLUTION
  Resolve tax_zone by customer_address.country_code:
    - Specific country zone (e.g., 'CZ') if exists
    - Else 'EU' if customer in EU
    - Else 'NON_EU'
  Sort by priority DESC, first match wins.

STAGE 4: PER-LINE TAX COMPUTATION
  For each line:
    Look up tax_rate where:
      tax_zone = resolved zone
      tax_class_code = line.tax_class_code
      valid_from <= timestamp AND (valid_until IS NULL OR valid_until > timestamp)
    If multiple match: priority DESC
    If no match: fallback to 'standard' class in same zone
    If still no match: tax_rate = 0 (zero) + log warning
    
    line.tax_rate_basis_points = rate.rate_basis_points
    line.taxable_base = line.line_subtotal_after_discount  // already net of discount
    
    Tax-exclusive (stored net):
      line.tax_amount = floor(line.taxable_base × rate.rate_basis_points / 10000)
    Tax-inclusive (stored gross):
      gross = line.taxable_base  // input is gross in this case
      line.tax_amount = gross - floor(gross × 10000 / (10000 + rate.rate_basis_points))
      line.taxable_base = gross - line.tax_amount  // net derived

STAGE 5: SHIPPING TAX
  If shipping_amount > 0:
    Determine shipping_tax_class = tenant.settings.shipping_tax_class || 'standard'
    Apply same lookup as STAGE 4
    shipping.tax_amount = compute(shipping_amount, rate)

STAGE 6: TOTALS
  totals.tax_amount = sum(line.tax_amount) + shipping.tax_amount
  totals.taxable_amount = sum(line.taxable_base) + shipping_taxable_base
  totals.gross_amount = totals.taxable_amount + totals.tax_amount

STAGE 7: TAX BREAKDOWN
  Group by (tax_class_code, rate_basis_points):
    breakdown[k] = { class, rate, base_amount, tax_amount }
  
  For each unique rate, sum bases and taxes.

STAGE 8: ROUNDING (per locale convention)
  CZ: total often rounded to whole CZK; record rounding_adjustment
  EU general: 2 decimal places (cents); no rounding at totals level
  
OUTPUT:
  TaxResult {
    is_reverse_charge: boolean,
    reverse_charge_reason?: string,
    place_of_supply: { country, kind },
    tax_zone_used: { id, code, name },
    lines: [{ line_id, tax_rate_basis_points, tax_amount, taxable_base }],
    shipping: { tax_rate_basis_points, tax_amount, taxable_base },
    totals: { tax_amount, taxable_amount, gross_amount },
    breakdown: [{ tax_class, rate_basis_points, base_amount, tax_amount }],
    rounding_adjustment: bigint,
    warnings: string[]
  }
```

### 4.2 Pseudocode

```typescript
function computeTax(input: TaxComputationInput): TaxResult {
  // Stage 1: place of supply
  const placeOfSupply = determinePlaceOfSupply(input);
  
  // Stage 2: reverse charge
  if (isReverseChargeApplicable(input)) {
    return buildReverseChargeResult(input, placeOfSupply);
  }
  
  // Stage 3: zone
  const zone = resolveTaxZone(input.tenant_id, input.customer_address, input.timestamp);
  if (!zone) {
    return buildZeroTaxResult(input, "no_zone_resolved");
  }
  
  // Stages 4-5: per-line + shipping
  const lineResults: LineTaxResult[] = [];
  for (const line of input.lines) {
    const rate = lookupRate(zone.id, line.tax_class_code, input.timestamp)
              ?? lookupRate(zone.id, 'standard', input.timestamp)
              ?? defaultZeroRate();
    
    const result = computeLineTax(line, rate, input.price_includes_tax);
    lineResults.push(result);
  }
  
  let shippingResult = null;
  if (input.shipping_amount > 0) {
    const shippingClass = input.shipping_tax_class_code || input.tenant.settings.shipping_tax_class || 'standard';
    const rate = lookupRate(zone.id, shippingClass, input.timestamp) ?? defaultZeroRate();
    shippingResult = computeShippingTax(input.shipping_amount, rate, input.price_includes_tax);
  }
  
  // Stages 6-8: totals + breakdown + rounding
  const totals = aggregateTotals(lineResults, shippingResult);
  const breakdown = computeBreakdown(lineResults, shippingResult);
  const roundingAdjustment = applyRounding(totals, input.currency, input.locale);
  
  return {
    is_reverse_charge: false,
    place_of_supply: placeOfSupply,
    tax_zone_used: zone,
    lines: lineResults,
    shipping: shippingResult,
    totals,
    breakdown,
    rounding_adjustment: roundingAdjustment,
    warnings: collectWarnings(lineResults, zone)
  };
}
```

### 4.3 Tax-inclusive ↔ exclusive conversion

```typescript
// Net → Gross
gross = net × (10000 + rate_basis_points) / 10000
tax = gross - net

// Gross → Net
net = floor(gross × 10000 / (10000 + rate_basis_points))
tax = gross - net
```

**Rounding choice:** floor (banker's rounding optional via tenant setting). Per-line rounding prevents penny-mismatch when summing.

### 4.4 Tax engine performance

- **Pure function** — no DB writes during computation
- **Rate lookup cached** in Redis 5 min per (tenant, zone, class, timestamp_bucketed_to_day)
- **Zone resolution cached** per (tenant, country_code) — TTL 1h, event-invalidated
- **Multi-tenant safety** — explicit tenant_id in all lookups

### 4.5 Deterministicity

Same inputs (including explicit `timestamp`) → same outputs. No `now()` inside engine; caller passes timestamp.

Snapshotted at order placement (`order_items.tax_rate_basis_points`, `orders.tax_breakdown`).

---

## 5. Invoice generation pipeline

Triggered post-payment (configurable per tenant: at order placement, at payment captured, at shipment).

### 5.1 Pipeline steps

```
INPUT: order_id, kind (default 'invoice')

PHASE 1: ELIGIBILITY
  - Order has payment captured (or merchant override allows pre-payment invoice = 'proforma')
  - No existing 'invoice' for this order yet (idempotent guard)

PHASE 2: ATOMIC NUMBER ALLOCATION (Tx)
  - Lock invoice_number_sequences row for (tenant, sequence_code, year)
  - UPDATE current_position = current_position + 1 RETURNING position
  - Format number per format_pattern
  - Validate uniqueness via uq_invoices_sequence_position constraint

PHASE 3: SNAPSHOT BUILDER
  - Compose seller_snapshot from tenant.legal_entity at current state
  - Compose buyer_snapshot from order.billing_address_snapshot + customer/company data
  - Snapshot tax_breakdown from order
  - Snapshot all line items
  - Compute taxable_supply_date (DUZP) per CZ rules:
    - For sale of goods: shipment date OR order placement (configurable)
    - For services: service rendered date
    - Default: order.placed_at

PHASE 4: PERSIST INVOICE ROW
  - INSERT invoices row + invoice_items rows in 1 Tx
  - Emit EVENT-INVOICE-ISSUED outbox

PHASE 5: PDF GENERATION (async via JOB-GENERATE-INVOICE-PDF)
  - Template per tenant locale + invoice kind (handlebars / liquid)
  - Render to PDF (puppeteer/playwright headless or wkhtmltopdf for self-host)
  - Upload to S3
  - Update invoice.pdf_media_id, pdf_generated_at

PHASE 6: ISDOC 6.0.1 GENERATION (async, CZ only)
  - Build XML per ISDOC schema
  - Upload to S3
  - Update invoice.isdoc_xml_storage_key, isdoc_xml_generated_at
  - Optionally sign with PFX certificate (Fáze 2)

PHASE 7: NOTIFICATIONS
  - Email customer with PDF attached (configurable per tenant)
  - Webhook outbound EVENT-INVOICE-ISSUED

PHASE 8: ACCOUNTING SYNC (async, opt-in)
  - JOB-SYNC-INVOICE-TO-ACCOUNTING per configured integration (Pohoda, iDoklad, Money S3, DATEV)
```

### 5.2 Number format examples

```
INV-2026-00001234   default invoice
PRO-2026-00000045   proforma
CRD-2026-00000012   credit note (dobropis)
ADV-2026-00000023   advance invoice
DBT-2026-00000007   debit note (vrubopis)
RCP-2026-00098765   POS receipt
```

Format pattern: `{code}-{year}-{position:08d}` default; tenant configurable (CZ accounting convention prefers gapless within calendar year).

### 5.3 Credit note (dobropis) flow

Linked to original invoice via `related_invoice_id`. Negative amounts; legal record of refund.

```
Trigger: EVENT-REFUND-SUCCEEDED (from `13-payments.md`)
  ▼
Look up linked invoice (order's invoice)
  ▼
Generate credit_note with kind='credit_note', related_invoice_id, amount_signs_negated
  ▼
Reuse PDF + ISDOC pipeline
  ▼
Reference original invoice number prominently
```

### 5.4 Proforma → Invoice progression

```
[proforma issued for advance payment]
  → customer pays
[advance invoice issued for amount received] (kind='advance')
  → order fulfilled
[final invoice issued = total - advance] (kind='invoice', references advances)
```

Implementation: `invoices.metadata.applied_advances = [advance_invoice_id, ...]`.

---

## 6. State machines

### 6.1 Invoice status

Invoices are largely immutable once issued (legal requirement). Status flags:

```
[draft] ──issue──▶ [issued]
   (rare; usually skip directly to issued)

[issued] ──paid──▶ [issued, paid_at set]
        ──voided──▶ [issued, is_void=true, void_reason recorded]
        
   credit_note never reverts original; it offsets.
```

For aggregated invoice status (computed):

| State derived | Condition |
|---|---|
| `unpaid` | `paid_at IS NULL AND is_void = false AND due_at >= now()` |
| `overdue` | `paid_at IS NULL AND is_void = false AND due_at < now()` |
| `paid` | `paid_at IS NOT NULL AND is_void = false` |
| `voided` | `is_void = true` |
| `credited` | exists credit_note linking back |

### 6.2 EET submission lifecycle (CZ, schema-ready but deactivated)

```
[invoice issued]
  ▼
[eet_records row created, submitted_at NULL]
  ▼
JOB-SUBMIT-EET fires (10 sec post-issue)
  ▼
Call CZ Tax Authority API (mTLS, XML+signature)
  ▼
  ├─ Success: receive FIK → store, submitted_at, response_at
  └─ Fail: retry (configurable), eventually use offline_mode flag → log
```

### 6.3 Tax reporting period

```
[draft] ──compute aggregations──▶ [draft with totals]
   ▼
admin reviews
   ▼
[draft] ──submit──▶ [submitted]
   ▼
gov accepts
   ▼
[accepted]
   ▼
correction needed?
   ▼
[amended] (creates new period with corrected data)
```

---

## 7. Business rules

### RULE-TAX-001: Reverse charge eligibility

Conditions ALL true:
- Buyer is B2B (has company_id OR provided VAT ID)
- Buyer VAT ID validated via VIES (`vat_id_validated_at NOT NULL`)
- Buyer country ≠ seller country
- Both countries are EU
- Seller is VAT registered in own country (has VAT ID)

Then VAT = 0 on invoice, legal note added.

**Exceptions** (still charge VAT):
- B2B sale of physical goods delivered to country same as VAT registration of seller
- Sale of services where place of supply is seller's country (B2C-ish rules)

### RULE-TAX-002: Place of supply for physical goods

Place of supply = ship-to country. Customer's billing address irrelevant. Tax of ship-to country applies.

For non-EU shipping (export): zero-rated; documentation required.

### RULE-TAX-003: Place of supply for digital services / e-services

Per EU rules:
- B2B: place of supply = buyer's country (reverse charge typically applies)
- B2C: place of supply = consumer's country (OSS scheme handles)

Digital identifier per tenant config: `tenant.settings.is_digital_services_seller = true`. MVP: assume physical goods unless flag set.

### RULE-TAX-004: OSS — One-Stop-Shop

EU merchants selling B2C cross-border > €10K/year EU-wide must register for OSS. OSS allows single quarterly filing covering all EU B2C sales (instead of registering for VAT in each country).

Our system:
- Tracks running EU B2C sales total (`JOB-COMPUTE-OSS-THRESHOLD-TRACKER`)
- Alerts merchant when approaching threshold (default 80% = €8K)
- Generates quarterly OSS XML report (Fáze 2 — schema ready)
- Tax computed at destination country rate (not seller country)

### RULE-TAX-005: IOSS — Import One-Stop-Shop

Non-EU merchants OR EU merchants importing goods ≤ €150 from outside EU to EU consumers.

Schema ready (Fáze 2). MVP: documented as opt-in for tenants with non-EU warehouse.

### RULE-TAX-006: Historized rates honor snapshot

Order placed under old rate (e.g., CZ reduced 15% before 2024) keeps that rate in `order_items.tax_rate_basis_points`. Subsequent VAT rate changes do not affect existing orders.

Refunds on old orders use the snapshotted rate, not current.

### RULE-TAX-007: VAT ID validation expires

`tax_exemptions.vies_validated_at` is timestamped. Re-validation policy:
- Daily background job refreshes for active exemptions
- If validation fails (VAT ID no longer valid): set `is_active = false`, alert merchant
- New checkouts with expired validation: re-validate live

### RULE-TAX-008: Mandatory invoice issuance

EU B2B sales: invoice MUST be issued (with required fields). B2C in CZ: simplified receipt acceptable below thresholds.

Default tenant config: always issue invoice for orders. Configurable per channel/customer-group.

### RULE-TAX-009: Gapless number sequence

CZ accounting law requires gapless sequence per year. Voided invoices keep number; credit_note doesn't fill gap.

Our system: `invoice_number_sequences` allocates atomically. Voiding sets `is_void=true`, never `DELETE`.

### RULE-TAX-010: Invoice immutability

Once issued, invoice fields are immutable except: `paid_at` (payment recorded), `is_void` (formal void), `internal_notes`.

Customer correction requires: void original + issue credit_note + issue new invoice.

### RULE-TAX-011: Taxable supply date (DUZP)

Per CZ: date when supply was made.
- Goods: typically shipment date OR order placement (whichever earlier)
- Services: service rendered date
- Default: `order.placed_at`

Tenant configurable strategy: `tenant.settings.duzp_strategy ∈ ('order_placed','shipment','payment','service_rendered')`.

### RULE-TAX-012: Reverse charge note text

Legal text per country/locale:
- CZ: "Daň odvede zákazník"
- DE: "Steuerschuldnerschaft des Leistungsempfängers" (Reverse Charge)
- EN: "VAT reverse charge — buyer to account for VAT"

Always reference legal basis: "Article 196 of Directive 2006/112/EC" or local statute.

### RULE-TAX-013: Rounding rule per country

- CZ: invoices may round total to whole CZK (rozdíl is recorded as `rounding_adjustment_amount`)
- DE / EU general: 2 decimal places (cents)
- Tenant configurable per locale `tenant.settings.tax_rounding ∈ ('none','whole_unit','5_cents','banker')`

### RULE-TAX-014: Multi-currency tax

Invoice in cart currency; if currency ≠ tax authority currency (e.g., sale in EUR but VAT reported to CZ in CZK), include conversion:
- `invoices.metadata.tax_authority_currency = 'CZK'`
- `invoices.metadata.tax_amount_in_authority_currency = amount` (using ECB or CNB daily rate at DUZP)
- `invoices.metadata.exchange_rate_source = 'cnb'` + rate snapshot

### RULE-TAX-015: Customer download policy

- Logged-in customer: instant PDF download from order page
- Guest: download via order recovery email link (signed token)
- Storefront URL pattern: `/storefront/orders/{order_number}/invoices/{number}.pdf`

Retention: customer access for 7 years (CZ accounting law). After: archived but not deleted.

### RULE-TAX-016: Accountant API access

Read-only API key with `PERSONA-ACCOUNTANT` permissions. Often used by external bookkeepers. Audited.

### RULE-TAX-017: Credit note linkage

Credit note MUST reference original invoice (`related_invoice_id`). PDF and ISDOC include both numbers.

If refund spans multiple original invoices: multiple credit_notes (1:1 mapping).

### RULE-TAX-018: Bad-debt write-off (CZ)

If invoice unpaid > 30 months (CZ rule): merchant may write off VAT. Schema-ready via `metadata.bad_debt_write_off` flag, manual process MVP, automated v1.0+.

### RULE-TAX-019: VAT exemption documentation requirement

For zero-rate export: shipment proof required (carrier delivery confirmation). Stored in `tax_exemptions.evidence_media_id` or shipment proof.

Auditable: tax authority may request during inspection.

### RULE-TAX-020: Threshold alerts

- Distance selling EU threshold (€10K) — OSS alert
- CZ VAT registration threshold (CZK 2M turnover 12 months) — schema ready (v1.0+)
- DE Kleinunternehmer threshold — Fáze 2

### RULE-TAX-021: ISDOC 6.0.1 generation

CZ standard. Mandatory for B2G; optional B2B. Tenant opts in.

Schema requirements:
- Seller IČO, DIČ
- Buyer IČO, DIČ (or NULL for B2C)
- Line items with VAT class
- Document type (invoice / credit_note / advance)
- Payment information
- Optional digital signature (XAdES)

### RULE-TAX-022: Pohoda export format

XML structure per Pohoda specification:
- `<dataPack>` envelope
- `<dataPackItem>` per invoice
- `<inv:invoice>` with metadata
- `<inv:invoiceItem>` lines
- VAT breakdown

Encoding UTF-8, schema validated before delivery.

### RULE-TAX-023: iDoklad API push

iDoklad supports REST API. Push pattern:
- Authenticate (OAuth2 or API key)
- POST `/invoices` per record
- Receive `iDoklad_invoice_id`, store in `metadata.idoklad_id`
- Idempotent via tenant's external_id

### RULE-TAX-024: EET (CZ — currently deactivated)

EET law suspended Jan 2023. Schema ready for reactivation:
- Per `eet_records`: BKP, PKP signatures computable
- Submit XML to CZ Tax Authority (data.eet.cz API)
- Synchronously block POS sale until FIK received (with `offline_mode` fallback)

Currently no submission happens; rows can be generated but `submitted_at` remains NULL.

### RULE-TAX-025: EKO-KOM packaging fees (CZ)

Packaging recycling fees per material kind (paper, plastic, glass, ...) and weight.
- Merchant configures per product (or product category) approximate packaging weights/materials
- `JOB-GENERATE-EKO-KOM-REPORT-QUARTERLY` aggregates and produces XLSX/CSV for AVE EKO-KOM submission

### RULE-TAX-026: Multi-tenancy isolation

Each tenant has own tax_zones, tax_rates, sequences. Cross-tenant queries forbidden.

`tenant_id` part of every WHERE clause; RLS reinforced.

### RULE-TAX-027: Tax-inclusive vs exclusive display

Storefront display rule:
- B2C EU consumer (anonymous or registered): default gross display
- B2B logged-in: configurable per customer group, default net display + VAT breakdown
- Storefront switching: customer can toggle (price display preferences)

### RULE-TAX-028: Audit log scope

100% audit for:
- Tax rate creation/update
- Tax exemption creation/deactivation
- Invoice issuance (immutable record creation)
- Invoice voiding
- Accounting export initiation
- Sequence position allocation (per allocation, for forensics)

### RULE-TAX-029: Retention

CZ accounting law: 10 years for invoices (until end of taxable period + extension). EU GDPR: 7 years general.

Default tenant retention: 10 years. Stricter retention per Enterprise SLA configurable.

Soft delete prohibited for invoices issued; only `is_void` flag. Even voided invoices retain.

### RULE-TAX-030: GDPR right-to-erasure exception

Customer GDPR delete request: PII anonymized (name → "Anonymous", email hashed), but invoice retained per RULE-TAX-029. Documented in privacy policy.

---

## 8. REST API endpoints

### 8.1 Tax engine

```
POST   /api/{date}/tax:compute                                    # synchronous compute for given input
       Input: { lines, shipping_amount, customer_address, ... }
       Output: TaxResult
GET    /api/{date}/tax:preview-for-cart?cart_id=...                # convenience pro storefront
```

### 8.2 Tax zones + rates

```
GET    /api/{date}/tax/zones
POST   /api/{date}/tax/zones
GET    /api/{date}/tax/zones/{id}
PATCH  /api/{date}/tax/zones/{id}
DELETE /api/{date}/tax/zones/{id}

GET    /api/{date}/tax/rates
POST   /api/{date}/tax/rates
GET    /api/{date}/tax/rates/{id}
PATCH  /api/{date}/tax/rates/{id}                                  # only certain fields; valid_from immutable
POST   /api/{date}/tax/rates/{id}:close                             # set valid_until = now
POST   /api/{date}/tax/rates/{id}:replace                           # close + create new
```

### 8.3 Tax classes

```
GET    /api/{date}/tax/classes
POST   /api/{date}/tax/classes
PATCH  /api/{date}/tax/classes/{code}
DELETE /api/{date}/tax/classes/{code}
```

### 8.4 Tax exemptions

```
GET    /api/{date}/tax/exemptions
POST   /api/{date}/tax/exemptions
GET    /api/{date}/tax/exemptions/{id}
PATCH  /api/{date}/tax/exemptions/{id}
DELETE /api/{date}/tax/exemptions/{id}                              # deactivate (soft)
POST   /api/{date}/tax/exemptions/{id}:re-validate                  # trigger VIES check
```

### 8.5 VIES / ARES validators

```
POST   /api/{date}/validators/vies                                  # body: { vat_id: 'CZ12345678' }
POST   /api/{date}/validators/ares                                  # body: { ico: '12345678' }
```

### 8.6 Invoices

```
GET    /api/{date}/invoices                                         # list, filterable
POST   /api/{date}/invoices                                          # manual create (typically auto via order events)
GET    /api/{date}/invoices/{id}
GET    /api/{date}/invoices/{id}.pdf                                 # download PDF
GET    /api/{date}/invoices/{id}.xml                                 # download ISDOC XML (CZ)
POST   /api/{date}/invoices/{id}:void                                # set is_void = true (with reason)
POST   /api/{date}/invoices/{id}:resend-email                        # email PDF to customer
POST   /api/{date}/invoices/{id}:regenerate-pdf                       # rebuild PDF (e.g., template fix)
POST   /api/{date}/invoices:bulk-create-from-orders                  # for orders missing invoices
```

### 8.7 Credit notes

```
POST   /api/{date}/credit-notes                                       # body: { original_invoice_id, items_or_amount, reason }
GET    /api/{date}/credit-notes
```

### 8.8 Customer-facing

```
GET    /api/{date}/storefront/orders/{order_number}/invoices         # list invoices for order
GET    /api/{date}/storefront/orders/{order_number}/invoices/{number}.pdf
```

### 8.9 Tax reporting periods

```
GET    /api/{date}/tax/reporting-periods
POST   /api/{date}/tax/reporting-periods                              # define period (admin)
GET    /api/{date}/tax/reporting-periods/{id}
POST   /api/{date}/tax/reporting-periods/{id}:compute                  # async compute totals
POST   /api/{date}/tax/reporting-periods/{id}:submit                   # mark as submitted (manual; no gov API integration MVP)
GET    /api/{date}/tax/reporting-periods/{id}/report.pdf
GET    /api/{date}/tax/reporting-periods/{id}/report.xml
```

### 8.10 Accounting exports

```
POST   /api/{date}/accounting/exports                                  # body: { target: 'pohoda', scope: 'invoices', period_start, period_end }
GET    /api/{date}/accounting/exports
GET    /api/{date}/accounting/exports/{id}
GET    /api/{date}/accounting/exports/{id}/download                     # signed URL to output file
POST   /api/{date}/accounting/exports/{id}:retry                          # if failed
```

### 8.11 EKO-KOM (CZ)

```
POST   /api/{date}/compliance/eko-kom/reports                          # generate quarterly report
GET    /api/{date}/compliance/eko-kom/reports
GET    /api/{date}/compliance/eko-kom/reports/{id}/download.xlsx
```

### 8.12 Example: Compute tax

```http
POST /api/2026-05-19/tax:compute HTTP/1.1

{
  "lines": [
    { "variant_id": "var_aB", "quantity": 2, "line_subtotal_after_discount": 88200, "tax_class_code": "standard" }
  ],
  "shipping_amount": 9900,
  "shipping_tax_class_code": "standard",
  "customer_address": { "country_code": "CZ", "postal_code": "120 00" },
  "is_b2b": false,
  "currency": "CZK",
  "price_includes_tax": false,
  "timestamp": "2026-05-19T14:30:00Z"
}
```

```jsonc
HTTP/1.1 200 OK

{
  "data": {
    "is_reverse_charge": false,
    "place_of_supply": { "country": "CZ", "kind": "physical_goods" },
    "tax_zone_used": { "id": "txz_cz", "code": "CZ", "name": "Česká republika" },
    "lines": [
      {
        "line_index": 0,
        "tax_class_code": "standard",
        "tax_rate_basis_points": 2100,
        "taxable_base": 88200,
        "tax_amount": 18522
      }
    ],
    "shipping": {
      "tax_class_code": "standard",
      "tax_rate_basis_points": 2100,
      "taxable_base": 9900,
      "tax_amount": 2079
    },
    "totals": {
      "taxable_amount": 98100,
      "tax_amount": 20601,
      "gross_amount": 118701
    },
    "breakdown": [
      { "tax_class": "standard", "rate_basis_points": 2100, "base_amount": 98100, "tax_amount": 20601 }
    ],
    "rounding_adjustment": 0,
    "warnings": []
  },
  "meta": {
    "duration_ms": 12,
    "request_id": "req_..."
  }
}
```

### 8.13 Example: Reverse charge case

```http
POST /api/2026-05-19/tax:compute HTTP/1.1

{
  "lines": [...],
  "customer_address": { "country_code": "DE", "postal_code": "10115" },
  "is_b2b": true,
  "buyer_vat_id": "DE123456789",
  "buyer_vat_id_validated": true,
  "tenant_company_country": "CZ",
  "tenant_company_vat_id": "CZ12345678"
}
```

```jsonc
HTTP/1.1 200 OK

{
  "data": {
    "is_reverse_charge": true,
    "reverse_charge_reason": "B2B intra-EU sale (CZ → DE)",
    "place_of_supply": { "country": "DE", "kind": "physical_goods" },
    "lines": [{ "tax_amount": 0, ... }],
    "shipping": { "tax_amount": 0 },
    "totals": { "taxable_amount": 98100, "tax_amount": 0, "gross_amount": 98100 },
    "legal_note": "Daň odvede zákazník (čl. 196 směrnice 2006/112/ES)"
  }
}
```

### 8.14 Example: Issue invoice (manual)

```http
POST /api/2026-05-19/invoices HTTP/1.1
Authorization: Bearer ...
Idempotency-Key: ...

{
  "order_id": "ord_aB",
  "kind": "invoice",
  "taxable_supply_date": "2026-05-19",
  "payment_terms_days": 14
}
```

```jsonc
HTTP/1.1 201 Created

{
  "data": {
    "id": "...",
    "pub_id": "inv_aB",
    "type": "invoice",
    "attributes": {
      "number": "INV-2026-00001234",
      "kind": "invoice",
      "issued_at": "2026-05-19T15:00:00Z",
      "taxable_supply_date": "2026-05-19",
      "due_at": "2026-06-02T00:00:00Z",
      "currency": "CZK",
      "subtotal_amount": 98100,
      "tax_amount": 20601,
      "total_amount": 118701,
      "is_reverse_charge": false,
      "pdf_url": "https://cdn.shopio.com/invoices/...?sig=...",
      "isdoc_xml_url": "https://cdn.shopio.com/invoices/....xml?sig=..."
    }
  }
}
```

### 8.15 Example: Generate accounting export

```http
POST /api/2026-05-19/accounting/exports HTTP/1.1

{
  "target": "pohoda",
  "scope": "invoices",
  "period_start": "2026-05-01",
  "period_end": "2026-05-31",
  "output_format": "xml"
}
```

```jsonc
HTTP/1.1 202 Accepted

{
  "data": {
    "id": "...",
    "pub_id": "ace_aB",
    "type": "accounting_export",
    "attributes": {
      "target": "pohoda",
      "status": "pending",
      "record_count_expected": 234,
      "expected_completion_seconds": 30
    }
  },
  "meta": { "next_action": "GET /accounting/exports/ace_aB to poll status" }
}
```

---

## 9. GraphQL schema

```graphql
type TaxZone implements Node {
  id: ID!
  name: String!
  code: String!
  countryCodes: [String!]!
  regionCodes: [String!]
  isEu: Boolean!
  isActive: Boolean!
  priority: Int!
  rates: [TaxRate!]!
}

type TaxRate implements Node {
  id: ID!
  taxZone: TaxZone!
  taxClassCode: String!
  rateBasisPoints: Int!
  ratePercent: Float!                       # computed display 21.00
  name: String!
  compound: Boolean!
  priority: Int!
  validFrom: Date!
  validUntil: Date
  displayInclusiveDefault: Boolean!
  isCurrentlyActive: Boolean!
}

type TaxExemption implements Node {
  id: ID!
  customer: Customer
  company: Company
  kind: TaxExemptionKind!
  vatId: String
  viesValidatedAt: DateTime
  validFrom: Date!
  validUntil: Date
  isActive: Boolean!
  evidenceMediaUrl: String
}

enum TaxExemptionKind {
  VAT_REVERSE_CHARGE ZERO_RATE_EXPORT NON_PROFIT GOVERNMENT
  DIPLOMATIC B2B_EU MANUAL_OVERRIDE
}

type TaxComputationResult {
  isReverseCharge: Boolean!
  reverseChargeReason: String
  placeOfSupply: PlaceOfSupply!
  taxZoneUsed: TaxZone!
  lines: [LineTaxResult!]!
  shipping: ShippingTaxResult
  totals: TaxTotals!
  breakdown: [TaxBreakdownItem!]!
  roundingAdjustment: Money
  warnings: [String!]!
  legalNote: String
}

type PlaceOfSupply { country: String!  kind: String! }   # 'physical_goods' | 'digital_services'

type LineTaxResult {
  lineIndex: Int!
  taxClassCode: String!
  taxRateBasisPoints: Int!
  taxableBase: Money!
  taxAmount: Money!
}

type ShippingTaxResult {
  taxClassCode: String!
  taxRateBasisPoints: Int!
  taxableBase: Money!
  taxAmount: Money!
}

type TaxTotals {
  taxableAmount: Money!
  taxAmount: Money!
  grossAmount: Money!
}

type TaxBreakdownItem {
  taxClass: String!
  rateBasisPoints: Int!
  baseAmount: Money!
  taxAmount: Money!
}

type Invoice implements Node & Timestamped {
  id: ID!
  pubId: String!
  number: String!
  kind: InvoiceKind!
  relatedInvoice: Invoice
  order: Order!
  customer: Customer
  company: Company
  sellerSnapshot: JSON!
  buyerSnapshot: JSON!
  issuedAt: DateTime!
  taxableSupplyDate: Date!
  dueAt: DateTime
  paidAt: DateTime
  currency: String!
  subtotalAmount: Money!
  discountAmount: Money!
  shippingAmount: Money!
  taxAmount: Money!
  totalAmount: Money!
  roundingAdjustmentAmount: Money
  taxBreakdown: [TaxBreakdownItem!]!
  isReverseCharge: Boolean!
  buyerVatId: String
  paymentMethodKind: String
  paymentTermsDays: Int
  bankAccountIban: String
  variableSymbol: String
  items: [InvoiceItem!]!
  pdfUrl: String
  isdocXmlUrl: String
  isVoid: Boolean!
  voidReason: String
  voidAt: DateTime
  locale: String!
  notes: String
  createdAt: DateTime!
  updatedAt: DateTime!
}

enum InvoiceKind { INVOICE PROFORMA CREDIT_NOTE ADVANCE DEBIT_NOTE RECEIPT }

type InvoiceItem {
  id: ID!
  position: Int!
  sku: String
  title: String!
  description: String
  quantity: Float!
  unitLabel: String
  unitPriceAmount: Money!
  netAmount: Money!
  discountAmount: Money!
  taxClassCode: String!
  taxRateBasisPoints: Int!
  taxAmount: Money!
  grossAmount: Money!
  isReverseCharge: Boolean!
}

type TaxReportingPeriod implements Node {
  id: ID!
  scheme: TaxReportingScheme!
  countryCode: String
  periodStart: Date!
  periodEnd: Date!
  status: TaxReportingStatus!
  totalTaxableAmount: Money
  totalTaxAmount: Money
  submissionId: String
  submittedAt: DateTime
  acceptedAt: DateTime
}

enum TaxReportingScheme { LOCAL_VAT OSS IOSS NON_EU_OSS }
enum TaxReportingStatus { DRAFT SUBMITTED ACCEPTED AMENDED }

type AccountingExport implements Node {
  id: ID!
  pubId: String!
  target: AccountingExportTarget!
  scope: AccountingExportScope!
  periodStart: Date!
  periodEnd: Date!
  outputFormat: String!
  status: AccountingExportStatus!
  recordCount: Int
  totalAmount: Money
  downloadUrl: String
  startedAt: DateTime!
  completedAt: DateTime
  failureReason: String
}

enum AccountingExportTarget { POHODA MONEY_S3 IDOKLAD DATEV CUSTOM_XML CUSTOM_CSV }
enum AccountingExportScope { INVOICES CREDIT_NOTES ORDERS PAYMENTS COMBINED }
enum AccountingExportStatus { PENDING PROCESSING COMPLETED FAILED }

extend type Query {
  taxZones: [TaxZone!]! @auth(requires: PERM_TAX_VIEW)
  taxZone(id: ID, code: String): TaxZone @auth(requires: PERM_TAX_VIEW)
  taxRates(zoneId: ID, classCode: String): [TaxRate!]! @auth(requires: PERM_TAX_VIEW)
  taxExemptions(filter: TaxExemptionFilter): [TaxExemption!]! @auth(requires: PERM_TAX_VIEW)
  invoices(first: Int, after: String, filter: InvoiceFilter): InvoiceConnection! @auth(requires: PERM_INVOICE_VIEW)
  invoice(id: ID, pubId: String, number: String): Invoice @auth(requires: PERM_INVOICE_VIEW)
  myInvoices(first: Int, after: String): InvoiceConnection!
  taxReportingPeriods(filter: TaxReportingFilter): [TaxReportingPeriod!]! @auth(requires: PERM_TAX_REPORT)
  accountingExports(first: Int, after: String): AccountingExportConnection! @auth(requires: PERM_ACCOUNTING_EXPORT)
  computeTax(input: TaxComputationInput!): TaxComputationResult!
}

extend type Mutation {
  createTaxZone(input: TaxZoneInput!): TaxZone! @auth(requires: PERM_TAX_MANAGE)
  updateTaxZone(id: ID!, input: TaxZoneInput!): TaxZone! @auth(requires: PERM_TAX_MANAGE)
  createTaxRate(input: TaxRateInput!): TaxRate! @auth(requires: PERM_TAX_MANAGE)
  closeTaxRate(id: ID!, validUntil: Date!): TaxRate! @auth(requires: PERM_TAX_MANAGE)
  createTaxExemption(input: TaxExemptionInput!): TaxExemption! @auth(requires: PERM_TAX_MANAGE)
  deactivateTaxExemption(id: ID!): TaxExemption! @auth(requires: PERM_TAX_MANAGE)

  issueInvoice(input: IssueInvoiceInput!): Invoice! @auth(requires: PERM_INVOICE_ISSUE)
  voidInvoice(id: ID!, reason: String!): Invoice! @auth(requires: PERM_INVOICE_VOID)
  resendInvoiceEmail(id: ID!): MutationPayload! @auth(requires: PERM_INVOICE_RESEND)

  issueCreditNote(input: CreditNoteInput!): Invoice! @auth(requires: PERM_INVOICE_CREDIT_NOTE)

  computeTaxReportingPeriod(id: ID!): TaxReportingPeriod! @auth(requires: PERM_TAX_REPORT)
  submitTaxReportingPeriod(id: ID!, submissionRef: String): TaxReportingPeriod! @auth(requires: PERM_TAX_REPORT)

  createAccountingExport(input: AccountingExportInput!): AccountingExport! @auth(requires: PERM_ACCOUNTING_EXPORT)

  validateVatId(vatId: String!): VatIdValidationResultData!
  validateIco(ico: String!): IcoValidationResultData!
}

type VatIdValidationResultData {
  result: VatIdValidationResult!
  countryCode: String
  companyName: String
  companyAddress: String
  viesConsultationId: String
}

type IcoValidationResultData {
  isValid: Boolean!
  companyName: String
  vatId: String
  address: JSON
  registeredFromCommerceRegister: Boolean
}
```

---

## 10. Events

| Build-spec ID | Wire | Payload |
|---|---|---|
| `EVENT-TAX-ZONE-CREATED` | `tax.zone.created` | `{ zone }` |
| `EVENT-TAX-ZONE-UPDATED` | `tax.zone.updated` | `{ zone, previous_attributes }` |
| `EVENT-TAX-RATE-CREATED` | `tax.rate.created` | `{ rate }` |
| `EVENT-TAX-RATE-CLOSED` | `tax.rate.closed` | `{ rate, valid_until }` |
| `EVENT-TAX-EXEMPTION-CREATED` | `tax.exemption.created` | `{ exemption }` |
| `EVENT-TAX-EXEMPTION-DEACTIVATED` | `tax.exemption.deactivated` | `{ exemption_id, reason }` |
| `EVENT-VAT-ID-VALIDATION-ATTEMPTED` | `tax.vat_id_validation_attempted` | `{ vat_id, result, source }` |
| `EVENT-INVOICE-ISSUED` | `invoice.issued` | `{ invoice }` |
| `EVENT-INVOICE-PDF-GENERATED` | `invoice.pdf_generated` | `{ invoice, pdf_url }` |
| `EVENT-INVOICE-ISDOC-GENERATED` | `invoice.isdoc_generated` | `{ invoice, xml_url }` |
| `EVENT-INVOICE-PAID` | `invoice.paid` | `{ invoice }` |
| `EVENT-INVOICE-OVERDUE` | `invoice.overdue` | `{ invoice, days_overdue }` |
| `EVENT-INVOICE-VOIDED` | `invoice.voided` | `{ invoice, reason }` |
| `EVENT-CREDIT-NOTE-ISSUED` | `credit_note.issued` | `{ credit_note, original_invoice }` |
| `EVENT-TAX-REPORTING-PERIOD-COMPUTED` | `tax.reporting_period_computed` | `{ period, totals }` |
| `EVENT-TAX-REPORTING-PERIOD-SUBMITTED` | `tax.reporting_period_submitted` | `{ period, submission_id }` |
| `EVENT-OSS-THRESHOLD-APPROACHING` | `tax.oss_threshold_approaching` | `{ tenant_id, current_total, threshold, projected_breach_date }` |
| `EVENT-ACCOUNTING-EXPORT-STARTED` | `accounting.export_started` | `{ export }` |
| `EVENT-ACCOUNTING-EXPORT-COMPLETED` | `accounting.export_completed` | `{ export, download_url }` |
| `EVENT-EET-SUBMITTED` | `eet.submitted` | `{ eet_record }` |
| `EVENT-EET-FIK-RECEIVED` | `eet.fik_received` | `{ eet_record, fik }` |
| `EVENT-EKO-KOM-REPORT-GENERATED` | `eko_kom.report_generated` | `{ report, download_url }` |

**Konzumenti:**
- Order management — `EVENT-INVOICE-ISSUED` updates order's `invoice_id`
- Email — invoice attachment delivery
- Accounting integrations — automatic sync
- Compliance dashboards — alerts on threshold approaches
- Webhook delivery — per merchant subscription

---

## 11. Background jobs

| Job | Trigger | Queue | Frequency |
|---|---|---|---|
| `JOB-ISSUE-INVOICE-FROM-ORDER` | EVENT-ORDER-PAID (or configured trigger) | `invoicing` | On-demand |
| `JOB-GENERATE-INVOICE-PDF` | EVENT-INVOICE-ISSUED | `invoicing` | On-demand |
| `JOB-GENERATE-ISDOC-XML` | EVENT-INVOICE-ISSUED (CZ only) | `invoicing` | On-demand |
| `JOB-SEND-INVOICE-EMAIL` | EVENT-INVOICE-PDF-GENERATED | `notifications` | On-demand |
| `JOB-ISSUE-CREDIT-NOTE-FROM-REFUND` | EVENT-REFUND-SUCCEEDED | `invoicing` | On-demand |
| `JOB-DETECT-OVERDUE-INVOICES` | scheduled | `invoicing-sweeper` | Daily 09:00 |
| `JOB-SEND-OVERDUE-REMINDER` | EVENT-INVOICE-OVERDUE | `notifications` | On-demand (configurable cadence) |
| `JOB-COMPUTE-OSS-THRESHOLD-TRACKER` | scheduled | `tax-compliance` | Daily |
| `JOB-REVALIDATE-VAT-IDS-DAILY` | scheduled | `tax-compliance` | Daily 03:00 |
| `JOB-COMPUTE-TAX-REPORTING-PERIOD` | manual or scheduled | `tax-reporting` | Quarterly (OSS) / Monthly (local) |
| `JOB-GENERATE-OSS-REPORT-XML` | EVENT-TAX-REPORTING-PERIOD-COMPUTED | `tax-reporting` | On-demand |
| `JOB-GENERATE-ACCOUNTING-EXPORT` | EVENT-ACCOUNTING-EXPORT-STARTED | `accounting` | On-demand |
| `JOB-PUSH-INVOICE-TO-IDOKLAD` | EVENT-INVOICE-PDF-GENERATED (if iDoklad enabled) | `accounting` | On-demand |
| `JOB-SUBMIT-EET` | EVENT-INVOICE-ISSUED (if EET enabled, CZ) | `tax-compliance` | 10s post-issue |
| `JOB-GENERATE-EKO-KOM-REPORT-QUARTERLY` | scheduled | `compliance` | Quarterly |
| `JOB-DETECT-VAT-RATE-CHANGE-PENDING` | scheduled | `compliance` | Weekly (check for upcoming rate changes via external feed/manual) |
| `JOB-ARCHIVE-INVOICES-OLD` | scheduled | `maintenance` | Yearly (move > 10 years to cold storage) |

### 11.1 JOB-ISSUE-INVOICE-FROM-ORDER detail

```typescript
async function issueInvoiceFromOrder(orderId: string, idempotencyKey: string) {
  return await pg.transaction(async tx => {
    const order = await loadOrder(tx, orderId);
    
    // Idempotency
    const existing = await tx.queryOne(sql`SELECT * FROM invoices WHERE order_id = ${orderId} AND kind = 'invoice'`);
    if (existing) return existing;
    
    // Allocate number atomically
    const year = new Date().getFullYear();
    const sequenceCode = `INV-${year}`;
    const seq = await tx.queryOne(sql`
      UPDATE invoice_number_sequences
      SET current_position = current_position + 1, updated_at = now()
      WHERE tenant_id = ${order.tenant_id} AND sequence_code = ${sequenceCode} AND year = ${year}
      RETURNING current_position, format_pattern
    `) ?? await initializeSequence(tx, order.tenant_id, sequenceCode, year);
    
    const number = formatInvoiceNumber(seq.format_pattern, sequenceCode, year, seq.current_position);
    
    // Build snapshots
    const sellerSnapshot = await buildSellerSnapshot(tx, order.tenant_id);
    const buyerSnapshot = await buildBuyerSnapshot(tx, order);
    const taxBreakdown = order.tax_breakdown;
    
    // Insert invoice
    const invoice = await tx.queryOne(sql`
      INSERT INTO invoices (...)
      VALUES (...)
      RETURNING *
    `);
    
    // Insert items
    for (const orderItem of order.items) {
      await tx.execute(sql`INSERT INTO invoice_items (...) VALUES (...)`);
    }
    
    // Outbox
    await emitOutbox(tx, 'EVENT-INVOICE-ISSUED', { invoice });
    
    return invoice;
  });
}
```

### 11.2 JOB-COMPUTE-OSS-THRESHOLD-TRACKER detail

```sql
-- Sum of EU cross-border B2C sales in trailing 12 months
SELECT
  SUM(o.total_amount) FILTER (WHERE o.shipping_address_snapshot->>'country_code' != tenant_country)
  AS eu_b2c_cross_border_total
FROM orders o
WHERE o.tenant_id = $1
  AND o.placed_at >= now() - interval '12 months'
  AND o.status NOT IN ('cancelled','refunded')
  AND NOT EXISTS (SELECT 1 FROM tax_exemptions e WHERE e.customer_id = o.customer_id AND e.is_active);
```

If `total > €8000` (80% of €10K threshold): emit `EVENT-OSS-THRESHOLD-APPROACHING`.

### 11.3 JOB-REVALIDATE-VAT-IDS-DAILY detail

For each `tax_exemptions` with `vat_id_validated_at < now() - interval '90 days' AND is_active=true`:
- Call VIES re-check
- Update `vies_validated_at`
- If failed: emit `EVENT-TAX-EXEMPTION-DEACTIVATED`, admin alert

VIES rate limit: 600/hour per IP. Throttle accordingly.

---

## 12. UI/UX flows

### FLOW-TAX-001: Configure tax zones (admin)

```
[Admin → Settings → Tax → Zones]
   - List of zones with priority
   - "New zone" button
        │
        ▼
[Zone form]
   - Name, code, country codes (multi-select)
   - Region patterns (advanced)
   - Priority
        │
        ▼
[Save → zone created]
[Per zone: define rates per tax class]
   - Standard 21% (CZ default starter)
   - Reduced 12%
   - Etc.
   - With valid_from
```

### FLOW-TAX-002: View invoice (admin)

```
[Admin → Orders → {order} → Invoices tab]
   - List of invoices (invoice + any credit notes + advances)
        │
   click an invoice
        │
        ▼
[Invoice detail]
   - Header: number, issued_at, status
   - Parties (seller, buyer with VAT IDs)
   - Line items
   - Tax breakdown
   - Payment status
   - Actions: [Download PDF] [Download ISDOC] [Email customer] [Void with reason] [Issue credit note]
```

### FLOW-TAX-003: Customer downloads invoice

```
[Customer account → Orders]
   - Order list with status
        │
   click order → "Download invoice (PDF)"
        │
        ▼
[GET /storefront/orders/{number}/invoices/{number}.pdf]
   - Signed URL or stream
   - PDF download
```

### FLOW-TAX-004: Quarterly OSS report (Fáze 2)

```
[Admin → Tax → OSS Reporting]
   - Q2 2026 period ready (Apr-Jun)
        │
   click "Compute Q2 2026"
        │
        ▼
[Async JOB-COMPUTE-TAX-REPORTING-PERIOD]
   - Aggregates EU B2C cross-border sales by destination country
   - Per country: taxable amount, tax owed
        │
        ▼
[Review screen]
   - Per-country breakdown table
   - Total tax to remit per country
   - Discrepancies flagged
        │
   click "Generate XML for submission"
        │
        ▼
[OSS XML generated]
   - Tenant downloads
   - Submits via own tax authority portal (no auto-submission MVP)
   - Marks as "submitted" in our system, records submission ID
```

### FLOW-TAX-005: Accountant export (e.g., Pohoda)

```
[Admin → Settings → Accounting → Exports]
   - "New export" button
        │
        ▼
[Export wizard]
   - Target: Pohoda XML
   - Scope: Invoices for May 2026
   - Format: Pohoda XML (default for target)
        │
        ▼
[POST /accounting/exports → 202 operation]
   - Async job runs
   - Email when ready (or polling)
        │
        ▼
[Download XML]
   - Open Pohoda → Import → file
```

### FLOW-TAX-006: Manual VAT ID validation

```
[Admin → Customers → {customer} → Tax info]
   - VAT ID input + "Validate" button
        │
        ▼
[POST /validators/vies with VAT ID]
   - Call VIES
   - Show: valid / invalid / unable_to_verify
   - If valid: company name + address auto-fill confirmation
        │
        ▼
[Admin clicks "Apply exemption"]
   - Creates tax_exemptions row
   - Future orders from this customer = reverse charge applied
```

---

## 13. Country-specific compliance

### 13.1 Czech Republic (CZ) — MVP focus

**VAT rates (2026):**
- Standard: 21% (`tax_class='standard'`, `rate_basis_points=2100`)
- Reduced: 12% (`tax_class='reduced'`, `rate_basis_points=1200`) — books, food, medication
- Zero: 0% (`tax_class='zero'`) — export, certain housing

**Specifics:**
- ISDOC 6.0.1 invoice format
- DUZP (taxable supply date) prominently displayed
- DPH report DPH report monthly (large) / quarterly (small) — schema ready
- Reverse charge applicable per § 92a-92e of CZ DPH law
- ARES IČO validation
- KH DPH (Kontrolní hlášení) — Fáze 2 (mandatory monthly report of B2B transactions)
- EET — schema ready, currently deactivated by law
- EKO-KOM packaging recycling — quarterly report

**Accounting exports:**
- Pohoda XML (most popular SMB)
- Money S3 XML (alternative)
- iDoklad REST API (cloud)
- Stormware Stereo XML (less common)

### 13.2 Slovakia (SK)

**VAT rates (2026):**
- Standard: 23% (since Jan 2025)
- Reduced: 19%
- Super reduced: 5%
- Zero: 0%

**Specifics:**
- Similar to CZ (reverse charge, EU OSS)
- KV DPH (Kontrolný výkaz) — quarterly B2B transaction report
- e-Faktúra — SK government e-invoicing (Fáze 2)
- Accounting: MRP, Pohoda SK, Oberon

### 13.3 Germany (DE) — Fáze 2

**USt rates:**
- Standard: 19%
- Reduced: 7% (books, food)
- Zero: 0% (export, intra-EU B2B)

**Specifics:**
- DATEV format export (most popular)
- XRechnung (B2G mandatory)
- ZUGFeRD hybrid PDF+XML
- USt-Voranmeldung monthly/quarterly
- Handelsregister validation (separate from VAT)
- DSD (Duales System) packaging recycling fee
- Kleinunternehmer special status (< €22K)

### 13.4 Poland (PL) — Fáze 3

**VAT rates:**
- Standard: 23%
- Reduced: 8%, 5%
- Zero: 0%

**Specifics:**
- JPK_V7 (Jednolity Plik Kontrolny) monthly
- KSeF e-invoicing system (mandatory 2026)
- GUS (REGON) validation

### 13.5 Hungary (HU) — Fáze 3

**ÁFA rates:**
- Standard: 27%
- Reduced: 18%, 5%

**Specifics:**
- NAV Online Invoice (real-time B2B reporting, mandatory)
- NAV reporting via XML push

### 13.6 Romania (RO) — Fáze 3

**TVA rates:**
- Standard: 19%
- Reduced: 9%, 5%

**Specifics:**
- SAF-T (Standard Audit File for Tax) monthly
- e-Factura mandatory B2B

### 13.7 Austria (AT) — Fáze 3

**USt:**
- Standard: 20%
- Reduced: 10%, 13%

**Specifics:**
- Similar to DE (EU member)
- UID Nummer (USt-IdNr equivalent)

---

## 14. Edge cases & error handling

| Scenario | Behavior | Code |
|---|---|---|
| Tax engine called with empty lines | Return zero result | (success) |
| No tax rate for (zone, class, time) | Fallback to 'standard' class; if still none, 0% + warning | (graceful) |
| Customer address country not supported | Return tax_zone='NON_EU' or fail per merchant config | `COUNTRY_NOT_SUPPORTED`, 422 |
| Reverse charge requested but VAT ID invalid | Charge VAT normally + warn customer | (handled) |
| Reverse charge requested but seller not VAT registered | Reject; legally cannot apply | `SELLER_NOT_VAT_REGISTERED`, 422 |
| Invoice number sequence exhausted (99999999) | Reject; admin must extend format | `SEQUENCE_EXHAUSTED`, 422 |
| Concurrent invoice issuance from same order | Idempotency guard; second returns existing | (handled) |
| Invoice issuance during VAT rate transition (e.g., 31. 12. order, 1. 1. issue) | Use rate active at `taxable_supply_date`, not `issued_at` | (handled per RULE-TAX-006) |
| Credit note for partial refund | Specify exact items/amounts; if not aligned with original lines, ad-hoc lines OK | (handled) |
| Credit note exceeds original invoice total | Reject | `CREDIT_NOTE_EXCEEDS_ORIGINAL`, 422 |
| Void invoice already paid | Allow but require explicit confirmation; payment row's status maintained | (handled) |
| Void invoice with credit note already issued | Reject; first must void credit note (rare) | `INVOICE_HAS_CREDIT_NOTES`, 422 |
| Invoice email send fails (mailbox full) | Retry exponential; mark `email_send_failed_at`, admin alert | (handled) |
| PDF generation timeout (>30s) | Mark `pdf_generation_failed`; retry job | (handled) |
| ISDOC XML schema validation fails | Log warning; do not block invoice; admin alert | (handled) |
| Accounting export of 100k invoices | Stream output to S3; do not hold in memory | (handled, async) |
| Pohoda export with invalid XML chars in customer name | Sanitize (XML escape) | (handled) |
| iDoklad API rate limit hit | Throttle, retry with backoff | (handled) |
| VAT rate change announced (e.g., reduced 12 → 10 in Q3) | Create new tax_rates row with valid_from, close old; orders before date use old | (handled per RULE-TAX-006) |
| OSS threshold crossed but merchant not yet registered | Alert + warning; do not auto-register (legal action) | (handled per RULE-TAX-004) |
| Bad debt write-off > 30 months unpaid | Manual admin action; future automation | (manual MVP) |
| EET submission times out | Offline mode flag; reattempt later (when EET reactivated) | (handled, schema ready) |
| Customer GDPR delete request | PII anonymized in invoice; invoice retained per legal | (handled per RULE-TAX-030) |
| Multi-currency: VAT in EUR but report due in CZK | Use ECB/CNB rate at DUZP for conversion | (handled per RULE-TAX-014) |
| Round-half-even (banker's) vs round-half-up | Per tenant setting; default banker's | (handled) |
| Negative line (refund line in same invoice — rare credit) | Allowed; line amounts may be negative | (handled) |
| Sequence reset edge case (year change at midnight) | Atomic Tx in correct sequence; date used = `issued_at::date` in tenant TZ | (handled) |
| External (legacy) invoice import | Admin can backdate; sequence position assigned manually if needed | (admin tool) |

---

## 15. Performance

### 15.1 Targets

| Operation | p50 | p95 | p99 |
|---|---|---|---|
| `POST /tax:compute` (cached rates) | 8 ms | 25 ms | 60 ms |
| `POST /tax:compute` (cache miss) | 30 ms | 100 ms | 200 ms |
| VIES validation (live) | 500 ms | 1500 ms | 2900 ms (3s timeout) |
| Invoice issuance (Tx + sequence allocation) | 30 ms | 80 ms | 200 ms |
| PDF generation | 200 ms | 800 ms | 2000 ms |
| ISDOC XML generation | 50 ms | 150 ms | 400 ms |
| Accounting export (1000 invoices) | 5 s | 15 s | 30 s |
| OSS report computation (10k orders) | 10 s | 30 s | 60 s |
| EU B2C cross-border running total | 20 ms (materialized) | 60 ms | 150 ms |

### 15.2 Optimization

- **Tax rate cache** Redis 5 min per (tenant, zone, class, date)
- **VIES cache** Redis 24h
- **ARES cache** Redis 7d
- **Tenant company info cache** Redis 1h (seller_snapshot input)
- **PDF generation pooled** (puppeteer-cluster or Chromium pool)
- **ISDOC XML streaming** for large invoices
- **Sequence allocation skip-locked** for high concurrency
- **OSS aggregation materialized view** refreshed daily (no live SUM over millions of orders)

### 15.3 Hot path queries

```sql
-- Tax rate lookup
SELECT * FROM tax_rates
WHERE tenant_id = $1 AND tax_zone_id = $2 AND tax_class_code = $3
  AND valid_from <= $4::date
  AND (valid_until IS NULL OR valid_until > $4::date)
ORDER BY priority DESC, valid_from DESC
LIMIT 1;
-- Uses idx_tax_rates_zone_class_active
```

```sql
-- Atomic sequence allocation
UPDATE invoice_number_sequences
SET current_position = current_position + 1
WHERE tenant_id = $1 AND sequence_code = $2 AND year = $3
RETURNING current_position;
```

### 15.4 Scaling

- Invoice issuance: ~1000/sec per tenant easily (sequence is per-tenant per-year)
- PDF generation: bottleneck; horizontally scale workers
- ISDOC: lightweight, low concern
- Accounting export: rare, batch-style

---

## 16. Security & legal

### 16.1 Permissions

```
PERM-TAX-VIEW
PERM-TAX-MANAGE           # zones, rates, classes
PERM-TAX-REPORT           # OSS / reporting periods
PERM-TAX-AUDIT-VIEW       # immutable audit log access
PERM-INVOICE-VIEW
PERM-INVOICE-ISSUE
PERM-INVOICE-VOID
PERM-INVOICE-RESEND
PERM-INVOICE-CREDIT-NOTE
PERM-ACCOUNTING-EXPORT
PERM-COMPLIANCE-VIEW
PERM-COMPLIANCE-REPORT
PERM-EET-MANAGE
PERM-EKO-KOM-REPORT
```

### 16.2 Immutability

Invoice rows are immutable except for `paid_at`, `is_void`, `internal_notes`. DB-level: no UPDATE statements other than allowed columns (enforced at app layer + audit log diff).

Invoice items: never UPDATE; new credit_note row instead.

### 16.3 Retention

- Invoices: 10 years (CZ accounting law) — never deleted; archived after 10 years to cold storage
- Tax rates, exemptions: indefinite (audit trail)
- Accounting exports: 2 years
- EET records: 10 years (schema-ready)

### 16.4 GDPR

- Customer PII in invoice snapshots — subject to RULE-TAX-030 (anonymize on delete, retain document)
- Customer download access for 7 years
- Right to portability: customer can download full invoice history

### 16.5 Audit log

100% audit for:
- Tax rate changes (incl. historization)
- Invoice issuance
- Invoice voiding (with reason)
- Credit note issuance
- Sequence allocations (forensic)
- Accounting export initiation (who, when, what scope)
- VAT ID validations (with VIES consultation IDs)
- VAT exemption changes

Audit log retention: 10 years for tax-related events.

### 16.6 Encryption

- Bank account info encrypted at rest (Vault transit)
- ISDOC XML signatures: PFX certificate stored in Vault (Fáze 2)
- PDF storage: signed URLs only (no public access without auth/signed token)

### 16.7 Rate limits

| Endpoint | Free | Pro |
|---|---|---|
| `POST /tax:compute` | 600/min | 6000/min |
| `POST /validators/vies` | 30/min/customer (anti-VIES abuse) | 60/min/customer |
| `POST /validators/ares` | 30/min | 600/min |
| Invoice list | 300/min | 6000/min |
| Invoice PDF download | 60/min | 600/min |
| Accounting export | 1/hour | 12/hour |

### 16.8 Legal disclaimers

- We don't tax-advise. Documentation states clearly: "Consult your accountant."
- Tax engine output is for computation; final tax responsibility is merchant's
- VAT rate updates: merchant responsibility to keep current; we provide tooling

---

## 17. Testing

### 17.1 Unit

```
TEST-UNIT-TAX-001  ZoneResolver — priority + country matching
TEST-UNIT-TAX-002  RateLookup — historized window selection
TEST-UNIT-TAX-003  ReverseChargeDeterminer — all conditions
TEST-UNIT-TAX-004  TaxInclusiveExclusiveConverter — bidirectional
TEST-UNIT-TAX-005  RoundingEngine — banker's, half-up, CZ whole-unit
TEST-UNIT-TAX-006  TaxBreakdownAggregator
TEST-UNIT-TAX-007  PlaceOfSupplyDeterminer — physical, digital, B2B
TEST-UNIT-TAX-008  InvoiceNumberFormatter — pattern → output
TEST-UNIT-TAX-009  IsdocXmlBuilder — schema-valid output
TEST-UNIT-TAX-010  PohodaXmlBuilder — schema-valid output
TEST-UNIT-TAX-011  SnapshotBuilder — seller, buyer
TEST-UNIT-TAX-012  ViesResponseParser — valid, invalid, error
TEST-UNIT-TAX-013  AresResponseParser
TEST-UNIT-TAX-014  EetSignatureGenerator (BKP, PKP)
```

### 17.2 Integration

```
TEST-INT-TAX-001  Standard CZ B2C order — 21% VAT applied
TEST-INT-TAX-002  CZ reduced rate items (books) — 12% applied
TEST-INT-TAX-003  Mixed-rate cart (standard + reduced) — breakdown correct
TEST-INT-TAX-004  Cross-border EU B2C — destination rate applied (OSS)
TEST-INT-TAX-005  Cross-border EU B2B with valid VAT ID — reverse charge
TEST-INT-TAX-006  Cross-border EU B2B with invalid VAT ID — VAT applied
TEST-INT-TAX-007  Non-EU export — zero rate
TEST-INT-TAX-008  VAT rate change at boundary date — old vs new
TEST-INT-TAX-009  Invoice issuance atomic with sequence allocation
TEST-INT-TAX-010  Concurrent invoice issuance — no number collisions
TEST-INT-TAX-011  PDF generation success + storage
TEST-INT-TAX-012  ISDOC XML schema-valid
TEST-INT-TAX-013  Credit note linked to original invoice
TEST-INT-TAX-014  Void invoice + audit log
TEST-INT-TAX-015  VIES validation mocked — valid, invalid, timeout
TEST-INT-TAX-016  ARES validation mocked
TEST-INT-TAX-017  OSS threshold crossed — alert fires
TEST-INT-TAX-018  Pohoda export 1000 invoices
TEST-INT-TAX-019  iDoklad API push (mocked)
TEST-INT-TAX-020  Multi-currency invoice — CZK + EUR display
TEST-INT-TAX-021  EET record generated (no actual submission MVP)
TEST-INT-TAX-022  EKO-KOM quarterly aggregation
TEST-INT-TAX-023  Tax-inclusive pricing — net derived correctly
TEST-INT-TAX-024  Tenant retention policy (10y) honored on archive
TEST-INT-TAX-025  GDPR delete preserves invoice + anonymizes PII
```

### 17.3 E2E

```
TEST-E2E-TAX-001  B2C customer sees tax-inclusive display in CZ storefront
TEST-E2E-TAX-002  B2B customer with VAT ID sees net display + reverse charge note
TEST-E2E-TAX-003  Customer downloads invoice PDF
TEST-E2E-TAX-004  Admin issues credit note after refund
TEST-E2E-TAX-005  Admin generates Pohoda export end-to-end
TEST-E2E-TAX-006  OSS threshold alert visible in dashboard
```

### 17.4 Load

```
TEST-LOAD-TAX-001  1000 RPS tax:compute (cached) → p95 < 30 ms
TEST-LOAD-TAX-002  500 concurrent invoice issuance → no sequence collisions
TEST-LOAD-TAX-003  100 concurrent PDF generation → workers scale
```

### 17.5 Compliance validation

- ISDOC 6.0.1 schema XSD validation in CI
- Pohoda XML schema validation
- iDoklad API contract tests
- VIES test mode (test VAT IDs)
- ARES sandbox

### 17.6 Snapshot tests

- Golden invoices (representative scenarios) — PDF rendering + XML output snapshotted; any change requires review
- Tax breakdown calculations (per country) — golden inputs → outputs

---

## 18. Implementation checklist

### Backend
- [ ] **[S]** Drizzle schema `packages/db/src/schema/tax/*.ts`, `invoices/*.ts`
- [ ] **[S]** Migrace `20260529_001_create_tax_invoice_tables.sql`
- [ ] **[S]** Seed: default tax_zones (CZ, SK, EU, NON_EU), tax_classes, tax_rates per locale
- [ ] **[XL]** `TaxEngine` — pure function pipeline (§4)
- [ ] **[M]** `TaxRateLookup` — historized
- [ ] **[M]** `ZoneResolver`
- [ ] **[M]** `ReverseChargeEvaluator`
- [ ] **[M]** `ViesClient` + cache
- [ ] **[M]** `AresClient` + cache
- [ ] **[L]** `InvoiceService` — issuance, voiding, credit notes
- [ ] **[M]** `InvoiceNumberAllocator` — atomic sequence
- [ ] **[L]** `PdfGenerator` — template engine + headless Chromium
- [ ] **[L]** `IsdocXmlGenerator` (CZ)
- [ ] **[M]** `PohodaXmlExporter`
- [ ] **[M]** `MoneyS3XmlExporter`
- [ ] **[M]** `IDokladApiClient`
- [ ] **[M]** `DatevExporter` (Fáze 2)
- [ ] **[M]** `OssReporter` (Fáze 2 — schema ready)
- [ ] **[S]** `EetClient` (schema-ready, dormant)
- [ ] **[M]** `EkoKomReporter` (CZ)
- [ ] **[M]** REST endpoints per §8
- [ ] **[M]** GraphQL types + resolvers
- [ ] **[S]** tRPC router (admin)
- [ ] **[S]** MCP tools `tax.calculate`

### Background jobs
- [ ] **[M]** JOB-ISSUE-INVOICE-FROM-ORDER
- [ ] **[M]** JOB-GENERATE-INVOICE-PDF
- [ ] **[M]** JOB-GENERATE-ISDOC-XML
- [ ] **[S]** JOB-SEND-INVOICE-EMAIL
- [ ] **[M]** JOB-ISSUE-CREDIT-NOTE-FROM-REFUND
- [ ] **[S]** JOB-DETECT-OVERDUE-INVOICES
- [ ] **[S]** JOB-SEND-OVERDUE-REMINDER
- [ ] **[M]** JOB-COMPUTE-OSS-THRESHOLD-TRACKER
- [ ] **[M]** JOB-REVALIDATE-VAT-IDS-DAILY
- [ ] **[M]** JOB-COMPUTE-TAX-REPORTING-PERIOD
- [ ] **[M]** JOB-GENERATE-OSS-REPORT-XML
- [ ] **[L]** JOB-GENERATE-ACCOUNTING-EXPORT (per target)
- [ ] **[M]** JOB-PUSH-INVOICE-TO-IDOKLAD
- [ ] **[S]** JOB-SUBMIT-EET (dormant by default)
- [ ] **[M]** JOB-GENERATE-EKO-KOM-REPORT-QUARTERLY
- [ ] **[S]** JOB-ARCHIVE-INVOICES-OLD

### Frontend — Admin
- [ ] **[M]** Tax zones + rates management
- [ ] **[M]** Tax exemptions list + VIES re-validate
- [ ] **[L]** Invoices list (filter by kind, status, period)
- [ ] **[M]** Invoice detail viewer
- [ ] **[M]** Credit note issuance modal
- [ ] **[M]** Accounting export wizard (per target)
- [ ] **[M]** Tax reporting periods dashboard (OSS quarterly review)
- [ ] **[S]** OSS threshold alert widget
- [ ] **[S]** EKO-KOM report generator
- [ ] **[S]** EET status panel (CZ, dormant)

### Frontend — Storefront
- [ ] **[S]** Invoice download in customer account
- [ ] **[S]** Reverse charge note display in cart/checkout summary for B2B
- [ ] **[S]** Tax breakdown in cart total

### Tests
- [ ] **[M]** Per §17
- [ ] **[M]** Snapshot tests for golden invoices

### Docs
- [ ] **[M]** "Setting up tax for your country" guide (CZ, SK, DE specifics)
- [ ] **[S]** "B2B reverse charge how-to" guide
- [ ] **[S]** "OSS registration walkthrough" guide
- [ ] **[S]** "Connecting your accountant via API" guide
- [ ] **[S]** "Pohoda export step-by-step" guide
- [ ] **[S]** Developer: tax engine plugin (custom country)
- [ ] **[M]** Legal disclaimer prominent in documentation

---

## 19. Open questions

### Q-TAX-001: KH DPH (CZ Kontrolní hlášení)
**Otázka:** Monthly mandatory B2B transaction report in CZ. Schema for XML generation, no auto-submission.

**Status:** Fáze 2 (post-MVP). MVP: monthly export only via accounting integration.

### Q-TAX-002: e-Faktúra (SK)
**Otázka:** SK government e-invoicing system. Mandatory progressive timeline.

**Status:** Fáze 2 when SK becomes prominent target. Schema-aware.

### Q-TAX-003: XRechnung / ZUGFeRD (DE)
**Otázka:** German B2G e-invoicing. ZUGFeRD = hybrid PDF+XML.

**Status:** Fáze 2 (DE expansion). Library: mustangproject (Java) or our own ISDOC-style generator adapted.

### Q-TAX-004: Tax rounding strategy default
**Otázka:** CZ tradition: whole CZK. EU general: cents. Default?

**Status:** Configurable per tenant. CZ tenant default = whole CZK; others = cents.

### Q-TAX-005: Multi-VAT-registered tenant
**Otázka:** Tenant registered for VAT in CZ + DE simultaneously (e.g., big merchant). Which VAT applies to sale?

**Status:** Place of supply rules. v1.0+: multiple seller VAT IDs per tenant with country tagging.

### Q-TAX-006: Customer-uploaded VAT exemption certificate
**Otázka:** US sales tax exemption (resale certificate) — different flow.

**Status:** Out of scope MVP. US Fáze 4 separately.

### Q-TAX-007: Auto VAT rate updates
**Otázka:** Subscription to EU VAT rate feeds (e.g., Avalara)?

**Status:** Out of scope MVP. v1.0+ optional plugin. MVP: merchant manually maintains rates per change.

### Q-TAX-008: Sales tax (US)
**Otázka:** Completely different model — origin/destination, marketplace facilitator.

**Status:** Fáze 4 US expansion. Likely Avalara, TaxJar integrations.

### Q-TAX-009: Plastic Packaging Tax (UK)
**Otázka:** UK-specific tax for non-recycled plastic packaging.

**Status:** Fáze 4 UK. Schema-ready via product metadata.

### Q-TAX-010: Carbon border adjustment (EU CBAM)
**Otázka:** CO2 import levy for steel, aluminum, fertilizer, ... — Fáze 3+ for those verticals.

**Status:** Out of scope MVP. Schema-aware.

### Q-TAX-011: Digital products place of supply
**Otázka:** Customer in EU buys software license (digital service). Place of supply = customer country (OSS).

**Status:** Configurable per tenant `is_digital_services_seller`. MVP: default false (physical goods).

### Q-TAX-012: Tax on shipping
**Otázka:** Shipping VAT class per locale (CZ: ride along main product class; EU: standard typically).

**Status:** Configurable per tenant `shipping_tax_class_code`. Default: 'standard'.

### Q-TAX-013: Invoice email opt-out
**Otázka:** Customer can opt out of invoice email if they have account access (eco-friendly)?

**Status:** v1.0+ feature. Default: always email invoice.

### Q-TAX-014: ISDOC signing with PFX certificate
**Otázka:** Optional digital signature on ISDOC XML.

**Status:** Fáze 2. Vault stores PFX; signing service called at ISDOC generation.

### Q-TAX-015: Backdated invoices (legacy data import)
**Otázka:** Migrating from legacy system — historical invoices with their own numbers.

**Status:** Admin tool with explicit number assignment + immutability check. Audit log entry.

### Q-TAX-016: Credit note partial vs full
**Otázka:** Partial credit note for partial refund — link to specific original line items?

**Status:** Supported via item-level credit_note line entries. UI default: item picker.

### Q-TAX-017: Tax for subscription billing
**Otázka:** Recurring subscription charges (when `24-subscriptions.md` launches) — tax recomputed each billing or snapshotted?

**Status:** Recomputed each billing (rates may have changed). Detail in subscriptions doc.

### Q-TAX-018: Marketplace seller tax responsibility
**Otázka:** Multi-vendor marketplace — platform vs seller as tax-of-record?

**Status:** Fáze 4 marketplace. Per local marketplace facilitator laws (varies).

### Q-TAX-019: AI-generated content disclosure
**Otázka:** EU AI Act may require disclosure of AI-generated descriptions in invoices? Or only product listings?

**Status:** Schema-ready via `metadata.ai_generated_content: true`. Disclosure UI Fáze 3+ when EU AI Act enforcement clarifies.

### Q-TAX-020: B2B PO number on invoice
**Otázka:** Many B2B invoices reference buyer's PO number.

**Status:** Supported via `metadata.purchase_order_number` (entered during checkout for B2B). Displayed on PDF.

---

## 📅 Změny

| Datum | Změna |
|---|---|
| 2026-05-19 | Initial — Tax & compliance domain. CZ-first VAT engine, reverse charge, OSS-ready, ISDOC 6.0.1, Pohoda/Money/iDoklad export, EET schema-ready (dormant), EKO-KOM, historized rates. |

---

**Konec Tax & Compliance.**

➡️ Pokračovat na: [`16-order-management.md`](16-order-management.md)
