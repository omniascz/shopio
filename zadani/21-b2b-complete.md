# 21 – B2B COMPLETE

> **Doména:** Plná B2B funkcionalita (rozšiřuje B2B-lite z [18-customer-management.md](18-customer-management.md)). Quote requests (RFQ), purchase orders (PO), NET payment terms s credit limits, per-company custom katalogy a tier pricing, multi-level approval workflows, sales rep accounts, B2B-specific reporting + integrations.
>
> **Status:** Většina v MVP **schema-ready** (companies + members + payment_terms_days), aktivace v1.0+. Tento dokument popisuje target architekturu.

**Datum:** 2026-05-20
**Verze:** 1.0
**Status:** 🟡 DESIGN (Fáze 2+ aktivace)
**Reference:** [18-customer-management.md](18-customer-management.md) · [10-pricing-promotions.md](10-pricing-promotions.md) · [15-tax-compliance.md](15-tax-compliance.md) · [16-order-management.md](16-order-management.md) · [12-checkout.md](12-checkout.md)

---

## 📑 Obsah

0. [Domain overview](#0-domain-overview)
1. [References](#1-references)
2. [Personas](#2-personas)
3. [Data models](#3-data-models)
4. [Quote workflow](#4-quote-workflow)
5. [Purchase order workflow](#5-purchase-order-workflow)
6. [Credit + payment terms](#6-credit--payment-terms)
7. [State machines](#7-state-machines)
8. [Business rules](#8-business-rules)
9. [REST API endpoints](#9-rest-api-endpoints)
10. [GraphQL schema](#10-graphql-schema)
11. [Events](#11-events)
12. [Background jobs](#12-background-jobs)
13. [UI/UX flows](#13-uiux-flows)
14. [Edge cases & error handling](#14-edge-cases--error-handling)
15. [Performance](#15-performance)
16. [Security & compliance](#16-security--compliance)
17. [Testing](#17-testing)
18. [Implementation checklist](#18-implementation-checklist)
19. [Open questions](#19-open-questions)

---

## 0. Domain overview

### 0.1 Co tato doména **je**

**Foundation (already in MVP via B2B-lite):**
- Companies entity (`companies` table) — legal entity, registration number, VAT ID
- Company members — multi-user, role-based (`company_members`)
- B2B context on orders (`orders.company_id`)
- VIES VAT validation, ARES IČO validation
- Reverse charge VAT (cross-ref `15`)
- Per-company default price list (cross-ref `10`)

**Full B2B (v1.0+ activation):**
- **Quote requests (RFQ)** — buyer submits cart for negotiated pricing → merchant proposes quote → buyer accepts → converts to order
- **Purchase Orders (PO)** — buyer provides PO number; merchant acknowledges; tracked through lifecycle
- **NET payment terms** — invoice issued; payment due in 30/60/90 days; credit check
- **Credit limits** — company has revolving credit; new orders block if exceeded
- **Per-company custom catalogs** — limit what products company can see (hide, show only contracted SKUs)
- **Per-company tier pricing** — volume discounts negotiated per customer
- **Multi-level approval workflows** — buyer creates order → manager approves → finance approves → ships
- **Purchase limits per buyer** — individual employee can't exceed configured amount
- **Sales rep accounts** — admin user assigned to company, places orders on behalf, gets commission tracking
- **B2B catalog visibility** — public vs B2B-only products (hidden from anon storefront)
- **Negotiated contracts** — formal agreements stored, drive pricing + terms
- **Bulk ordering** — CSV upload of SKU + qty → instant cart fill
- **Replenishment subscriptions** — recurring scheduled orders (cross-ref `24`)
- **Quick reorder** — repeat past order with one click
- **B2B reporting** — per-company spend, top buyers, contract usage
- **B2B-specific checkout variant** — PO field, NET terms display, no immediate payment

### 0.2 Co tato doména **NENÍ**

- ❌ B2B-lite basics (→ `18-customer-management.md` Section 3.9-3.10)
- ❌ Pricing engine internals (→ `10-pricing-promotions.md`)
- ❌ Tax engine + reverse charge math (→ `15-tax-compliance.md`)
- ❌ Order lifecycle internals (→ `16-order-management.md`)
- ❌ Checkout flow base (→ `12-checkout.md` — B2B is variant)
- ❌ Customer profile + auth (→ `18-customer-management.md`)
- ❌ Wholesale marketplace (multi-vendor) (→ `25-marketplace.md`)
- ❌ Recurring delivery scheduling (→ `24-subscriptions.md`)
- ❌ ERP integration mechanics (→ `29-integrations.md`)
- ❌ EDI integration (→ Fáze 3+ separate spec)

### 0.3 Diferenciátory

1. **Full B2B from single codebase** — no separate B2B-only product (per [DEC-ARCH-001](01-decisions-registry.md#dec-arch-001))
2. **Quote-to-cash automation** — RFQ → quote → order → fulfillment → invoice → payment v jednom flow
3. **Self-service B2B portal** — buyers manage orders, see invoices, request quotes bez kontaktu sales rep
4. **EU compliance native** — reverse charge VAT, VIES + ARES validation, ISDOC invoicing
5. **Approval workflows configurable** — graph-based per company (not just linear chain)
6. **AI Copilot integration** — quote negotiation assistant, replenishment suggestions (Fáze 3+, per `33`)
7. **B2B + B2C single platform** — same merchant serves both segments without forks

---

## 1. References

- [18-customer-management.md](18-customer-management.md) — `companies`, `company_members` foundation
- [10-pricing-promotions.md](10-pricing-promotions.md) — per-company price lists, tier pricing
- [15-tax-compliance.md](15-tax-compliance.md) — reverse charge, VIES, ARES, ISDOC
- [12-checkout.md](12-checkout.md) — B2B checkout variant flow
- [16-order-management.md](16-order-management.md) — order lifecycle, PO number field
- [22-multistore-channels.md](22-multistore-channels.md) — B2B-only channel
- [24-subscriptions.md](24-subscriptions.md) — replenishment subscriptions
- [29-integrations.md](29-integrations.md) — ERP / accounting integrations
- [33-ai-features.md](33-ai-features.md) — AI quote suggestions, agent procurement
- [30-security.md](30-security.md) — B2B audit, sensitive data
- [DEC-ARCH-001](01-decisions-registry.md#dec-arch-001-single-codebase-vs-separate-products) — single codebase
- [DEC-BIZ-001](01-decisions-registry.md#dec-biz-001-pricing-model) — B2B as commercial feature
- EU B2B VAT Directive 2006/112/EC (reverse charge)
- CZ § 2079 občanského zákoníku (PO contracts)

---

## 2. Personas

| Persona | Použití | Klíčové permissions |
|---|---|---|
| `PERSONA-MERCHANT-OWNER` | Full B2B configuration | `PERM-B2B-*` |
| `PERSONA-B2B-SALES-MANAGER` | Manages all companies, quotes, contracts | `PERM-B2B-COMPANY-MANAGE`, `PERM-B2B-QUOTE-MANAGE`, `PERM-B2B-CONTRACT-MANAGE` |
| `PERSONA-B2B-SALES-REP` | Assigned to specific companies, creates quotes, places orders on behalf | `PERM-B2B-COMPANY-VIEW` (assigned only), `PERM-B2B-QUOTE-CREATE`, `PERM-B2B-ORDER-CREATE-ON-BEHALF` |
| `PERSONA-FINANCE-MANAGER` | Credit limit management, PO acknowledgement, AR aging | `PERM-B2B-CREDIT-MANAGE`, `PERM-B2B-PO-ACKNOWLEDGE`, `PERM-B2B-AR-REPORT` |
| `PERSONA-B2B-CUSTOMER-SERVICE` | Help B2B buyers, edit orders pre-fulfillment | `PERM-B2B-CUSTOMER-SERVICE` |
| `PERSONA-B2B-COMPANY-OWNER` (buyer-side) | Manages company members, sets purchase limits, approves orders | Company role: 'owner' |
| `PERSONA-B2B-COMPANY-ADMIN` | Invites members, configures approval workflows | Company role: 'admin' |
| `PERSONA-B2B-BUYER` | Places orders within own purchase limit, requests quotes | Company role: 'buyer' |
| `PERSONA-B2B-APPROVER` | Approves orders/POs requiring authorization | Company role: 'approver' |
| `PERSONA-B2B-VIEWER` | Read-only access to company orders, invoices | Company role: 'viewer' |
| `PERSONA-B2B-ACCOUNTANT` | Sees invoices, accounting exports | Company role: 'accountant' |
| `PERSONA-AI-COPILOT` | Quote suggestions, anomaly alerts, replenishment | `agent:b2b:read`, `agent:b2b:suggest` |
| `PERSONA-EXTERNAL-AGENT` | MCP for B2B procurement on behalf of buyer | `agent:b2b:purchase` (scoped to company + spending limit) |
| `PERSONA-COMPLIANCE-OFFICER` | Audit B2B contracts, compliance, large transactions | `PERM-B2B-AUDIT-VIEW` |

---

## 3. Data models

### 3.1 `companies` *(extended from `18`)*

Recap from `18-customer-management.md §3.9`:

```sql
-- already exists:
-- companies (id, tenant_id, name, registration_number, vat_id, default_price_list_id,
--   default_payment_terms_days, credit_limit_amount, account_status, ...)
```

**B2B-specific extensions** (ALTER TABLE in v1.0+ migration):

```sql
ALTER TABLE companies
  ADD COLUMN parent_company_id UUID NULL REFERENCES companies(id),                            -- subsidiary hierarchy
  ADD COLUMN contract_template_id UUID NULL,                                                  -- linked default contract template
  ADD COLUMN catalog_visibility_kind TEXT NOT NULL DEFAULT 'full'
    CHECK (catalog_visibility_kind IN ('full','catalog_id','custom_filter','tag_only')),
  ADD COLUMN visible_catalog_id UUID NULL,                                                    -- pro 'catalog_id'
  ADD COLUMN visible_category_ids UUID[] NULL,                                                 -- pro 'custom_filter'
  ADD COLUMN visible_product_tags TEXT[] NULL,                                                  -- pro 'tag_only'
  ADD COLUMN allow_credit_orders BOOLEAN NOT NULL DEFAULT false,                                -- NET terms allowed at all?
  ADD COLUMN credit_limit_amount BIGINT NULL,                                                  -- already exists, included for context
  ADD COLUMN credit_used_amount BIGINT NOT NULL DEFAULT 0,                                     -- running total of open invoices
  ADD COLUMN credit_currency CHAR(3) NULL,
  ADD COLUMN credit_check_required BOOLEAN NOT NULL DEFAULT true,                              -- check before each order
  ADD COLUMN allow_purchase_order_payments BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN allow_quote_requests BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN approval_workflow_id UUID NULL,                                                   -- linked approval flow
  ADD COLUMN net_payment_terms_options INTEGER[] NULL DEFAULT ARRAY[14,30,60],                  -- which terms permitted
  ADD COLUMN preferred_shipping_method_id UUID NULL,
  ADD COLUMN account_status_set_by_user_id UUID NULL,
  ADD COLUMN account_status_changed_at TIMESTAMPTZ NULL,
  ADD COLUMN onboarding_completed_at TIMESTAMPTZ NULL,
  ADD COLUMN compliance_documents JSONB NULL,                                                   -- KYC docs storage refs
  ADD COLUMN industry_classification TEXT NULL,                                                 -- NACE / NAICS code
  ADD COLUMN annual_revenue_estimate_amount BIGINT NULL,
  ADD COLUMN annual_revenue_currency CHAR(3) NULL,
  ADD COLUMN employee_count_range TEXT NULL,
  ADD COLUMN crm_external_id TEXT NULL,                                                          -- HubSpot / Salesforce sync
  ADD COLUMN tier TEXT NULL CHECK (tier IN ('platinum','gold','silver','bronze','prospect') OR tier IS NULL),
  ADD COLUMN risk_rating TEXT NULL CHECK (risk_rating IN ('low','medium','high','unrated') OR risk_rating IS NULL),
  ADD COLUMN dunning_status TEXT NULL CHECK (dunning_status IN ('current','reminder_1','reminder_2','collections','written_off') OR dunning_status IS NULL);

CREATE INDEX idx_companies_parent ON companies (parent_company_id) WHERE parent_company_id IS NOT NULL;
CREATE INDEX idx_companies_tier ON companies (tenant_id, tier) WHERE tier IS NOT NULL;
CREATE INDEX idx_companies_dunning ON companies (tenant_id, dunning_status) WHERE dunning_status IS NOT NULL AND dunning_status NOT IN ('current');
CREATE INDEX idx_companies_credit_low ON companies (tenant_id) WHERE allow_credit_orders = true AND (credit_limit_amount - credit_used_amount) < 100000;
```

### 3.2 `quotes`

Quote request → proposal → conversion to order.

```sql
CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  pub_id TEXT NOT NULL,                                                                       -- qte_ NanoID
  number TEXT NOT NULL,                                                                       -- "QTE-2026-00000123" per tenant per year
  company_id UUID NOT NULL REFERENCES companies(id),
  requested_by_customer_id UUID NULL REFERENCES customers(id),
  assigned_sales_rep_user_id UUID NULL REFERENCES users(id),
  -- status
  status TEXT NOT NULL CHECK (status IN (
    'draft',                  -- buyer composes
    'requested',              -- buyer submitted; sales rep notified
    'in_negotiation',         -- sales rep editing
    'proposed',               -- sales rep sent quote to buyer
    'accepted',               -- buyer accepted; ready to convert to order
    'rejected',               -- buyer rejected
    'counter_proposed',       -- buyer counter-offered
    'expired',                -- valid_until passed
    'converted',              -- order created
    'cancelled',              -- terminated
    'archived'
  )) DEFAULT 'draft',
  status_entered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- items snapshot
  items JSONB NOT NULL DEFAULT '[]'::jsonb,                                                    -- [{ variant_id, qty, unit_price, discount, notes }]
  items_count INTEGER NOT NULL DEFAULT 0,
  -- pricing
  currency CHAR(3) NOT NULL,
  subtotal_amount BIGINT NOT NULL DEFAULT 0,
  discount_amount BIGINT NOT NULL DEFAULT 0,
  shipping_amount BIGINT NOT NULL DEFAULT 0,
  tax_amount BIGINT NOT NULL DEFAULT 0,
  total_amount BIGINT NOT NULL DEFAULT 0,
  is_reverse_charge BOOLEAN NOT NULL DEFAULT false,
  -- terms
  valid_until TIMESTAMPTZ NULL,                                                                -- offer expiration
  payment_terms_days INTEGER NULL,                                                              -- e.g., NET 30
  shipping_address_snapshot JSONB NULL,
  billing_address_snapshot JSONB NULL,
  delivery_expected_date DATE NULL,
  -- conversation thread
  notes_from_buyer TEXT NULL,
  notes_from_seller TEXT NULL,
  -- conversion result
  converted_order_id UUID NULL REFERENCES orders(id),
  converted_at TIMESTAMPTZ NULL,
  -- rejection
  rejected_at TIMESTAMPTZ NULL,
  rejected_by_actor_kind TEXT NULL,
  rejected_by_actor_id UUID NULL,
  rejection_reason TEXT NULL,
  -- locale
  locale TEXT NOT NULL,
  -- PDF
  pdf_media_id UUID NULL REFERENCES media(id),
  pdf_generated_at TIMESTAMPTZ NULL,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_quotes_pub_id UNIQUE (tenant_id, pub_id),
  CONSTRAINT uq_quotes_number UNIQUE (tenant_id, number)
);

CREATE INDEX idx_quotes_company ON quotes (company_id, created_at DESC);
CREATE INDEX idx_quotes_status ON quotes (tenant_id, status, status_entered_at DESC);
CREATE INDEX idx_quotes_sales_rep ON quotes (assigned_sales_rep_user_id) WHERE assigned_sales_rep_user_id IS NOT NULL;
CREATE INDEX idx_quotes_pending ON quotes (tenant_id, created_at DESC) WHERE status IN ('requested','counter_proposed');
CREATE INDEX idx_quotes_expiring ON quotes (valid_until) WHERE status IN ('proposed') AND valid_until IS NOT NULL;
```

### 3.3 `quote_messages`

Threaded communication on quote.

```sql
CREATE TABLE quote_messages (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  author_kind TEXT NOT NULL CHECK (author_kind IN ('buyer','seller','system')),
  author_user_id UUID NULL REFERENCES users(id),                                                -- pro seller
  author_customer_id UUID NULL REFERENCES customers(id),                                        -- pro buyer
  body TEXT NOT NULL,
  attachments_media_ids UUID[] NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_internal BOOLEAN NOT NULL DEFAULT false,                                                    -- visible only to seller-side
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_quote_messages_quote ON quote_messages (quote_id, occurred_at);
```

### 3.4 `purchase_orders`

Buyer-issued PO documents (formal procurement request, matched to our orders).

```sql
CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  pub_id TEXT NOT NULL,                                                                          -- po_ NanoID
  company_id UUID NOT NULL REFERENCES companies(id),
  po_number_external TEXT NOT NULL,                                                              -- buyer's PO number (e.g., "PO-2026-12345")
  linked_order_id UUID NULL REFERENCES orders(id),                                               -- 1:1 typical; can be 1:N for blanket POs
  related_quote_id UUID NULL REFERENCES quotes(id),                                              -- if originated from quote
  status TEXT NOT NULL CHECK (status IN (
    'received',               -- buyer submitted; awaiting acknowledgement
    'acknowledged',           -- merchant accepted PO terms
    'rejected',               -- merchant declined
    'in_progress',            -- order placed and fulfilling
    'fulfilled',              -- shipped
    'invoiced',               -- invoice issued
    'paid',                   -- payment received
    'overdue',                -- past due_at
    'cancelled',              -- buyer or merchant cancelled
    'partially_received'      -- partial delivery accepted
  )) DEFAULT 'received',
  status_entered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- amounts
  currency CHAR(3) NOT NULL,
  amount BIGINT NOT NULL,
  amount_invoiced BIGINT NOT NULL DEFAULT 0,
  amount_paid BIGINT NOT NULL DEFAULT 0,
  -- terms
  payment_terms_days INTEGER NULL,
  expected_delivery_date DATE NULL,
  -- documents
  po_document_media_id UUID NULL REFERENCES media(id),                                            -- PDF uploaded by buyer
  acknowledgement_pdf_media_id UUID NULL REFERENCES media(id),                                    -- merchant-issued PO ack PDF
  -- timestamps
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ NULL,
  acknowledged_by_user_id UUID NULL,
  rejected_at TIMESTAMPTZ NULL,
  rejection_reason TEXT NULL,
  due_at TIMESTAMPTZ NULL,                                                                        -- payment due date
  paid_at TIMESTAMPTZ NULL,
  cancelled_at TIMESTAMPTZ NULL,
  -- buyer reference
  buyer_contact_name TEXT NULL,
  buyer_contact_email CITEXT NULL,
  buyer_contact_phone TEXT NULL,
  -- notes
  buyer_notes TEXT NULL,
  internal_notes TEXT NULL,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_actor_kind TEXT NULL,
  created_by_actor_id UUID NULL,
  version INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_purchase_orders_pub_id UNIQUE (tenant_id, pub_id),
  CONSTRAINT uq_purchase_orders_external UNIQUE (tenant_id, company_id, po_number_external) DEFERRABLE INITIALLY IMMEDIATE
);

CREATE INDEX idx_purchase_orders_company ON purchase_orders (company_id, received_at DESC);
CREATE INDEX idx_purchase_orders_status ON purchase_orders (tenant_id, status, received_at DESC);
CREATE INDEX idx_purchase_orders_overdue ON purchase_orders (tenant_id, due_at) WHERE status NOT IN ('paid','cancelled') AND due_at < now();
```

### 3.5 `b2b_contracts`

Negotiated agreements (master terms) per company.

```sql
CREATE TABLE b2b_contracts (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  pub_id TEXT NOT NULL,                                                                          -- ctr_ NanoID
  number TEXT NOT NULL,                                                                          -- contract reference
  company_id UUID NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  description TEXT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','active','suspended','expired','terminated')) DEFAULT 'draft',
  effective_from DATE NOT NULL,
  effective_until DATE NULL,                                                                      -- NULL = indefinite
  auto_renew BOOLEAN NOT NULL DEFAULT false,
  auto_renew_period_days INTEGER NULL,
  -- pricing
  linked_price_list_id UUID NULL REFERENCES price_lists(id),                                      -- contract-specific pricing
  contract_discount_percent_basis_points INTEGER NULL,                                            -- blanket discount across catalog
  -- catalog
  catalog_restriction_kind TEXT NULL CHECK (catalog_restriction_kind IN ('full','catalog_id','sku_list','category_list') OR catalog_restriction_kind IS NULL),
  catalog_allowed_skus TEXT[] NULL,
  catalog_allowed_category_ids UUID[] NULL,
  catalog_allowed_product_tags TEXT[] NULL,
  -- volume commitment
  minimum_volume_amount BIGINT NULL,                                                                -- min spend per period
  minimum_volume_period TEXT NULL CHECK (minimum_volume_period IN ('quarterly','yearly') OR minimum_volume_period IS NULL),
  current_period_volume_amount BIGINT NOT NULL DEFAULT 0,                                          -- running total
  -- payment
  default_payment_terms_days INTEGER NULL,
  -- shipping
  free_shipping_above_amount BIGINT NULL,
  preferred_carrier_code TEXT NULL,
  -- compliance
  contract_document_media_id UUID NULL REFERENCES media(id),                                       -- signed PDF
  signed_by_buyer_at TIMESTAMPTZ NULL,
  signed_by_buyer_customer_id UUID NULL REFERENCES customers(id),
  signed_by_seller_at TIMESTAMPTZ NULL,
  signed_by_seller_user_id UUID NULL REFERENCES users(id),
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user_id UUID NULL,
  version INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_b2b_contracts_pub_id UNIQUE (tenant_id, pub_id),
  CONSTRAINT uq_b2b_contracts_number UNIQUE (tenant_id, number)
);

CREATE INDEX idx_b2b_contracts_company ON b2b_contracts (company_id, effective_from DESC);
CREATE INDEX idx_b2b_contracts_active ON b2b_contracts (tenant_id) WHERE status = 'active';
CREATE INDEX idx_b2b_contracts_expiring ON b2b_contracts (effective_until) WHERE status = 'active' AND effective_until IS NOT NULL;
```

### 3.6 `approval_workflows`

Configurable approval graph for purchase orders / quotes.

```sql
CREATE TABLE approval_workflows (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  company_id UUID NULL REFERENCES companies(id),                                                  -- NULL = template; specific = company-specific
  pub_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NULL,
  applies_to_kind TEXT NOT NULL CHECK (applies_to_kind IN ('orders','quotes','both')) DEFAULT 'orders',
  trigger_threshold_amount BIGINT NULL,                                                            -- only require approval if order > X
  trigger_threshold_currency CHAR(3) NULL,
  steps JSONB NOT NULL,                                                                            -- [{ approver_kind, approver_id, name, ... }]
  -- steps example:
  -- [
  --   { "step": 1, "name": "Manager review", "approver_kind": "company_role", "approver_role": "approver", "required_count": 1, "timeout_hours": 24 },
  --   { "step": 2, "name": "Finance approval", "approver_kind": "company_member", "approver_customer_id": "cus_finance", "required_count": 1 }
  -- ]
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user_id UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_approval_workflows_pub_id UNIQUE (tenant_id, pub_id)
);

CREATE INDEX idx_approval_workflows_company ON approval_workflows (company_id) WHERE is_active = true;
```

### 3.7 `approval_requests`

Instance of an approval flow for a specific order/quote.

```sql
CREATE TABLE approval_requests (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  workflow_id UUID NOT NULL REFERENCES approval_workflows(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  target_kind TEXT NOT NULL CHECK (target_kind IN ('order','quote','contract')),
  target_id UUID NOT NULL,
  initiated_by_customer_id UUID NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected','cancelled','timeout','escalated')) DEFAULT 'pending',
  current_step_index INTEGER NOT NULL DEFAULT 0,
  step_history JSONB NOT NULL DEFAULT '[]'::jsonb,                                                  -- [{ step, approver_id, decision, at, notes }]
  decision_required_by TIMESTAMPTZ NULL,                                                            -- step timeout
  finalized_at TIMESTAMPTZ NULL,
  final_decision TEXT NULL,
  final_reason TEXT NULL,
  notes TEXT NULL,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_approval_requests_pending ON approval_requests (tenant_id, status, decision_required_by) WHERE status = 'pending';
CREATE INDEX idx_approval_requests_target ON approval_requests (target_kind, target_id);
CREATE INDEX idx_approval_requests_company ON approval_requests (company_id, created_at DESC);
```

### 3.8 `company_members` *(extended from `18`)*

Recap + B2B extensions:

```sql
ALTER TABLE company_members
  ADD COLUMN can_approve_orders BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN can_request_quotes BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN can_view_all_orders BOOLEAN NOT NULL DEFAULT false,                                    -- already exists, reaffirmed
  ADD COLUMN can_view_pricing BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN can_view_invoices BOOLEAN NOT NULL DEFAULT false,                                       -- accountants typically
  ADD COLUMN purchase_limit_amount BIGINT NULL,                                                       -- already exists
  ADD COLUMN purchase_limit_period TEXT NULL CHECK (purchase_limit_period IN ('daily','monthly','per_order','quarterly','yearly') OR purchase_limit_period IS NULL) DEFAULT 'per_order',
  ADD COLUMN purchase_limit_currency CHAR(3) NULL,
  ADD COLUMN cost_center_code TEXT NULL,                                                              -- accounting cost center
  ADD COLUMN department TEXT NULL,
  ADD COLUMN job_title TEXT NULL;

CREATE INDEX idx_company_members_approvers ON company_members (company_id) WHERE can_approve_orders = true AND is_active = true;
```

### 3.9 `b2b_catalog_overrides`

Per-company custom catalog limits (alternative to using contracts).

```sql
CREATE TABLE b2b_catalog_overrides (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  override_kind TEXT NOT NULL CHECK (override_kind IN ('include','exclude')),
  scope_kind TEXT NOT NULL CHECK (scope_kind IN ('product','variant','category','collection','tag','brand')),
  scope_id UUID NULL,
  scope_value TEXT NULL,                                                                              -- for tag
  reason TEXT NULL,
  effective_from DATE NULL,
  effective_until DATE NULL,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user_id UUID NULL,

  CONSTRAINT uq_b2b_catalog_overrides UNIQUE (company_id, scope_kind, COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(scope_value, ''))
);

CREATE INDEX idx_b2b_catalog_overrides_company ON b2b_catalog_overrides (company_id) WHERE effective_from IS NULL OR effective_from <= now()::date;
```

### 3.10 `b2b_credit_ledger`

Append-only credit usage ledger per company.

```sql
CREATE TABLE b2b_credit_ledger (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES companies(id),
  kind TEXT NOT NULL CHECK (kind IN ('order_placed','invoice_issued','payment_received','credit_note_issued','credit_limit_changed','manual_adjustment','dunning_writeoff')),
  amount BIGINT NOT NULL,                                                                              -- signed: positive = consumed credit, negative = released
  currency CHAR(3) NOT NULL,
  related_order_id UUID NULL REFERENCES orders(id),
  related_invoice_id UUID NULL REFERENCES invoices(id),
  related_payment_id UUID NULL REFERENCES payments(id),
  resulting_credit_used BIGINT NOT NULL,                                                              -- snapshot of credit_used_amount post-apply
  notes TEXT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_kind TEXT NOT NULL,
  actor_id UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
) PARTITION BY RANGE (occurred_at);

CREATE INDEX idx_b2b_credit_ledger_company ON b2b_credit_ledger (company_id, occurred_at DESC);
CREATE INDEX brin_b2b_credit_ledger_occurred ON b2b_credit_ledger USING BRIN (occurred_at);
```

### 3.11 `b2b_dunning_log`

Past-due tracking + reminders.

```sql
CREATE TABLE b2b_dunning_log (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES companies(id),
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  stage TEXT NOT NULL CHECK (stage IN ('reminder_1','reminder_2','final_notice','collections','written_off')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  executed_at TIMESTAMPTZ NULL,
  notification_kind TEXT NULL CHECK (notification_kind IN ('email','letter','phone','sms') OR notification_kind IS NULL),
  notes TEXT NULL,
  notified_recipient_emails CITEXT[] NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_b2b_dunning_log_company ON b2b_dunning_log (company_id, scheduled_at DESC);
CREATE INDEX idx_b2b_dunning_log_due ON b2b_dunning_log (scheduled_at) WHERE executed_at IS NULL;
```

### 3.12 `sales_rep_assignments`

Sales rep ↔ company linking + commission tracking.

```sql
CREATE TABLE sales_rep_assignments (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES companies(id),
  sales_rep_user_id UUID NOT NULL REFERENCES users(id),
  role TEXT NOT NULL CHECK (role IN ('primary','secondary','support')) DEFAULT 'primary',
  effective_from DATE NOT NULL DEFAULT now()::date,
  effective_until DATE NULL,
  commission_percent_basis_points INTEGER NULL,                                                       -- e.g., 500 = 5.00%
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by_user_id UUID NULL,

  CONSTRAINT uq_sales_rep_assignments_primary UNIQUE (company_id, role) DEFERRABLE INITIALLY IMMEDIATE
);

CREATE INDEX idx_sales_rep_assignments_rep ON sales_rep_assignments (sales_rep_user_id) WHERE is_active = true;
CREATE INDEX idx_sales_rep_assignments_company ON sales_rep_assignments (company_id) WHERE is_active = true;
```

### 3.13 `b2b_reorder_lists`

Quick-reorder lists per company (favorites).

```sql
CREATE TABLE b2b_reorder_lists (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES companies(id),
  created_by_customer_id UUID NULL REFERENCES customers(id),
  name TEXT NOT NULL,                                                                                 -- "Monthly stationery", "Cleaning supplies"
  description TEXT NULL,
  is_shared BOOLEAN NOT NULL DEFAULT true,                                                             -- visible to all company members
  items JSONB NOT NULL DEFAULT '[]'::jsonb,                                                            -- [{ variant_id, default_qty }]
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_b2b_reorder_lists_company ON b2b_reorder_lists (company_id) WHERE is_shared = true OR created_by_customer_id IS NOT NULL;
```

### 3.14 Vztahy

```
tenants (1)──(N) companies
companies (0..1)──(1) companies                       [parent_company_id, subsidiary hierarchy]
companies (1)──(N) company_members                    [from `18`]
companies (1)──(N) quotes
companies (1)──(N) purchase_orders
companies (1)──(N) b2b_contracts
companies (1)──(N) approval_workflows                  [company-specific or template]
companies (1)──(N) b2b_catalog_overrides
companies (1)──(N) b2b_credit_ledger                    [partitioned]
companies (1)──(N) b2b_dunning_log
companies (1)──(N) sales_rep_assignments
companies (1)──(N) b2b_reorder_lists
companies (1)──(N) orders                              [via orders.company_id from `16`]
companies (1)──(N) invoices                             [via invoice's order.company_id from `15`]
quotes (1)──(0..1) orders                              [converted]
quotes (1)──(N) quote_messages
purchase_orders (1)──(0..1) orders                     [linked]
purchase_orders (0..1)──(1) quotes                    [related_quote_id]
b2b_contracts (0..1)──(1) price_lists                  [linked pricing]
approval_workflows (1)──(N) approval_requests
```

---

## 4. Quote workflow

### 4.1 Buyer-initiated quote

```
[Buyer logs into B2B portal, browses catalog]
   1. Buyer builds quote-cart (similar to regular cart, but marked as quote)
   2. Submits "Request a quote"
        ▼
[Backend creates quote (status='requested')]
   - Items snapshot frozen
   - Sales rep notified (per assignment)
   - Buyer receives confirmation email
        ▼
[Sales rep reviews quote]
   - May edit items, prices, add discount
   - status='in_negotiation'
        ▼
[Sales rep sends proposed quote]
   - status='proposed'
   - PDF generated, emailed to buyer
   - valid_until set (default 14 days)
        ▼
[Buyer reviews]
   ├─ Accepts → status='accepted' → JOB-CONVERT-QUOTE-TO-ORDER → order created
   ├─ Rejects → status='rejected'
   ├─ Counter-offers → status='counter_proposed' → loop back to sales rep
   └─ Ignores → status='expired' (valid_until passed)
```

### 4.2 Sales rep-initiated quote

```
[Sales rep contacts prospect (existing or new company)]
   1. Rep creates company (if new) + members
   2. Rep builds quote (status='draft')
   3. Sends to buyer
        ▼
[Buyer receives email with quote link]
   - View only (sign-up to accept)
        ▼
[Buyer signs up + accepts quote → converts to order]
```

### 4.3 Negotiation loop

Each round documented in `quote_messages`. Items can be modified per round. Audit trail complete.

When buyer counter-proposes (e.g., "Can you do 10% discount on item X?"):
- Buyer modifies quote → `status='counter_proposed'`
- Sales rep notified
- Loops until accepted, rejected, or expired

### 4.4 Quote PDF

Generated at status='proposed' or any negotiation step. Contains:
- Buyer's company info
- Quote number + date + valid_until
- Line items (description, qty, unit price, discount, total)
- Subtotal, discount, shipping, tax (reverse charge if applicable), grand total
- Payment terms
- Acceptance instructions
- Seller signature (electronic)

---

## 5. Purchase order workflow

### 5.1 Buyer submits PO

Two paths:

**Path A: Buyer attaches PO at checkout**
- Standard checkout flow per `12-checkout.md`
- PO number entered in B2B variant of checkout
- Order placed; `orders.purchase_order_number` recorded
- `purchase_orders` row auto-created with status='received'
- Backend can match PO line items vs order line items

**Path B: Buyer pre-submits PO document**
- Buyer uploads PO PDF to B2B portal
- Backend OCR extracts data (Fáze 2+) or buyer enters manually
- Merchant reviews + acknowledges
- Order created from PO; both linked

### 5.2 Acknowledgement

Merchant reviews PO terms:
- Quantities, prices match catalog?
- Payment terms acceptable per company contract?
- Credit limit sufficient?

```
[Merchant reviews PO]
   ├─ Accept → status='acknowledged' → order proceeds to fulfillment
   ├─ Reject → status='rejected' + reason
   └─ Counter-propose → buyer notified, may resubmit
```

PO acknowledgement PDF sent back to buyer (confirms terms).

### 5.3 PO lifecycle

```
received → acknowledged → in_progress → fulfilled → invoiced → paid
                                                                   │
                                                                   └→ overdue (if past due_at)
                                                                       │
                                                                       └→ collections / written_off
```

Each transition triggers buyer + merchant notifications.

### 5.4 Blanket PO

Pro v1.0+: single PO covers multiple deliveries over time.
- `purchase_orders.amount` = total commitment
- Multiple `orders` link via metadata
- Tracking partial fulfillment + invoicing

---

## 6. Credit + payment terms

### 6.1 Credit limit enforcement

At checkout (B2B variant):

```
if company.allow_credit_orders AND payment_method_kind = 'invoice_net':
    available_credit = company.credit_limit_amount - company.credit_used_amount
    if available_credit < order.total_amount:
        if merchant policy 'block_over_limit': reject with CREDIT_LIMIT_EXCEEDED
        else: flag for approval workflow
    else:
        place order; record b2b_credit_ledger entry kind='order_placed'
```

### 6.2 NET payment terms

When order has `payment_method_kind = 'invoice_net'`:
- No immediate payment captured
- Order status proceeds normally (payment_status='pending')
- Invoice issued (cross-ref `15-tax-compliance.md`) with `due_at = invoice_date + payment_terms_days`
- `b2b_credit_ledger` entry kind='invoice_issued' (consumes credit)

When buyer pays (bank transfer matched OR manual mark):
- Payment recorded per `13-payments.md`
- `b2b_credit_ledger` entry kind='payment_received' (releases credit)
- Invoice marked paid

### 6.3 Dunning workflow

When invoice past due:

```
[Invoice due_at passed]
   ▼
[Day +3] reminder_1 sent (gentle reminder email)
   ▼
[Day +14] reminder_2 (firmer)
   ▼
[Day +30] final_notice (legal language + escalation warning)
   ▼
[Day +60] collections (handed to merchant's collections process; flag in `companies.dunning_status`)
   ▼
[Day +180 if uncollected] written_off (admin manual action; b2b_credit_ledger kind='dunning_writeoff')
```

Configurable per tenant. Tracked in `b2b_dunning_log`.

### 6.4 Credit limit changes

Admin can adjust company's credit limit:
- `b2b_credit_ledger` kind='credit_limit_changed' (audit)
- Buyer notified (configurable)
- Doesn't auto-release credit (still consumed by open invoices)

### 6.5 Partial payments

Buyer pays partial amount of invoice:
- `payments` row recorded
- `invoice.paid_amount` updated
- `b2b_credit_ledger` entry for amount paid
- Invoice remains 'partially_paid' until fully paid

---

## 7. State machines

### 7.1 Quote status

```
draft → requested → in_negotiation → proposed
                                          │
                ┌─────────────────────────┤
                │                          │
            accepted             counter_proposed → in_negotiation (loop)
                │                          │
                ▼                          ▼
            converted               rejected / expired

Any time: cancelled / archived
```

### 7.2 Purchase Order status

Per §5.3 above:
```
received → acknowledged → in_progress → fulfilled → invoiced → paid
              │
              └→ rejected
                                                              │
                                                              └→ overdue → collections / written_off
                                                              
Any time: cancelled
Partial: partially_received
```

### 7.3 Approval request status

```
pending → approved (all required steps yes)
       → rejected (any step no)
       → cancelled (initiator cancels)
       → timeout (step deadline missed without action)
       → escalated (timeout → bumped to higher approver)
```

### 7.4 B2B contract status

```
draft → active (effective_from reached) → expired (effective_until reached)
                  │
                  ├→ suspended (admin pauses)
                  └→ terminated (early end)

active + auto_renew: at effective_until, new contract created with extended dates
```

### 7.5 Dunning stage

```
current → reminder_1 → reminder_2 → final_notice → collections → written_off
```

Reverts to `current` upon payment.

---

## 8. Business rules

### RULE-B2B-001: Company → orders enforcement

Order with `company_id` set IS B2B order. Triggers:
- B2B-specific tax (reverse charge if applicable, per `15` RULE-TAX-001)
- B2B checkout variant (PO number field)
- Credit check (if NET terms)
- Approval workflow (if configured)
- B2B sender domain / templates for confirmation emails

### RULE-B2B-002: Sales rep assignment exclusive primary

Company has at most 1 sales rep with `role='primary'` (enforced via partial UNIQUE index). Secondary/support unlimited.

Quote routing defaults to primary rep.

### RULE-B2B-003: Quote items snapshot immutable post-acceptance

Once buyer accepts quote (`status='accepted'`), items + pricing frozen. Subsequent edits create new revision (Fáze 2+) or block.

Conversion to order uses snapshot exactly.

### RULE-B2B-004: Quote conversion creates order

`JOB-CONVERT-QUOTE-TO-ORDER`:
1. Validate quote `status='accepted'`
2. Validate inventory (re-check stock per `09`)
3. Create order with `source='quote'`, `metadata.quote_id=quote.id`
4. Apply quote's pricing snapshot
5. Update quote `status='converted'`, `converted_order_id`
6. Emit `EVENT-QUOTE-CONVERTED-TO-ORDER`

### RULE-B2B-005: Quote PDF immutable per version

Each PDF regeneration creates new media_id; old PDFs retained (audit). PDF includes version number.

### RULE-B2B-006: PO matching tolerance

When PO line items don't exactly match order:
- Quantity tolerance: configurable per tenant (default 5%)
- Price tolerance: 0% by default (any discrepancy flagged)
- Mismatches → status='rejected' with reason OR manual review queue

### RULE-B2B-007: Credit check at multiple gates

Credit limit checked at:
1. Quote acceptance (warn if will exceed when converted)
2. Order placement (block if over OR flag for approval)
3. Daily reconciliation (catch drift)

Computed live: `available = credit_limit - sum(open_invoices_amount)`.

### RULE-B2B-008: Approval workflow trigger threshold

Workflows fire only if order_total ≥ `trigger_threshold_amount`. Below threshold → auto-approved.

For multiple matching workflows: priority DESC, first match wins.

### RULE-B2B-009: Approval timeout escalation

Step `timeout_hours` set: if no decision, escalate per workflow config (next step OR back to admin).

Auto-cancellation default disabled — admin reviews stuck workflows weekly.

### RULE-B2B-010: Purchase limit enforcement

`company_members.purchase_limit_amount`:
- `per_order`: each order checked against this limit
- `daily/monthly/quarterly/yearly`: sum of buyer's orders in window
- Exceeded → requires approval (escalates to approver)

Exception: company role 'owner' or 'admin' bypasses purchase limits (configurable).

### RULE-B2B-011: Catalog visibility

`companies.catalog_visibility_kind`:
- `full`: all active products visible (default)
- `catalog_id`: only products in linked catalog/collection
- `custom_filter`: visible_category_ids OR visible_product_tags
- `tag_only`: only products with matching tags

`b2b_catalog_overrides` additionally include/exclude.

Storefront product list / search filtered server-side. Direct product URL access also blocked if filtered.

### RULE-B2B-012: Contract-driven pricing

If active `b2b_contract` exists with `linked_price_list_id`:
- That price list takes priority over company's default
- Contract-specific discount (`contract_discount_percent_basis_points`) applied on top

Priority chain: contract > company default > customer_group default > retail.

### RULE-B2B-013: Volume commitment tracking

`b2b_contracts.minimum_volume_amount`:
- Period rolling (quarterly/yearly per `minimum_volume_period`)
- `current_period_volume_amount` updated on each order placement
- If period ends below minimum: alert merchant + flag company

Penalty / fees: tenant-specific (out of scope MVP); merchants handle manually.

### RULE-B2B-014: Dunning workflow per tenant policy

Configurable per tenant `tenant.settings.b2b_dunning_schedule`. Default:
```jsonc
[
  { "stage": "reminder_1", "after_days": 3, "channel": "email" },
  { "stage": "reminder_2", "after_days": 14, "channel": "email" },
  { "stage": "final_notice", "after_days": 30, "channel": "email" },
  { "stage": "collections", "after_days": 60, "channel": "manual" },
  { "stage": "written_off", "after_days": 180, "channel": "manual" }
]
```

Schedule events in `b2b_dunning_log`. Auto-execute email notifications; collections + writeoff require admin action.

### RULE-B2B-015: B2B-only products

`products.metadata.b2b_only=true`: hidden from anon storefront; visible only when customer logged in with company context.

### RULE-B2B-016: B2B checkout flow variant

When `cart.company_id IS NOT NULL`, checkout flow:
- Skip credit card form if NET terms allowed
- Show PO number field (required if company.allow_purchase_order_payments)
- Show reverse charge note prominently
- Display contracted prices + savings
- Apply purchase limit check
- Trigger approval workflow if needed

### RULE-B2B-017: Approval bypass for emergency orders

Admin can mark order `metadata.emergency_bypass_approval=true` (with audit reason). Skips workflow. Used for urgent restock during off-hours.

### RULE-B2B-018: Sales rep commission tracking

Per order with `company_id` and active `sales_rep_assignments`:
- Compute commission amount = order.total_amount × commission_percent / 10000
- Record in `metadata.commission` of order
- Aggregated in `analytics_reports` for payroll

Detail v finance / payroll spec (Fáze 2+).

### RULE-B2B-019: Parent / subsidiary hierarchy

`companies.parent_company_id` chain:
- Subsidiary orders may roll up to parent for credit pooling (configurable)
- Reports aggregate sub-tree
- Contract may apply to parent + subsidiaries

Max depth 5 levels.

### RULE-B2B-020: Quote expiry handling

`quotes.valid_until` passed AND status='proposed':
- Auto-transition to `status='expired'`
- Buyer notified (email)
- Sales rep notified
- Buyer can request re-quote (new quote, references old)

### RULE-B2B-021: PO acknowledgement deadline

Tenant policy: acknowledge PO within N business days (default 2). After:
- Auto-status='rejected' with reason='no_acknowledgement'
- Alert merchant + buyer

### RULE-B2B-022: B2B order cancellation rules

Stricter than B2C:
- Pre-acknowledgement: free to cancel
- Post-acknowledgement: requires merchant + buyer agreement (mutual cancel)
- Post-fulfillment: standard return workflow per `17`
- Contract penalty clauses respected (out of scope; documented in metadata)

### RULE-B2B-023: Pricing visibility per role

`company_members.can_view_pricing=false`: member can browse + add to cart but doesn't see prices until checkout. Useful for procurement clerks who only fill carts.

### RULE-B2B-024: Bulk order CSV import

CSV format:
```
sku,quantity,reference_note
ABC-123,5,Project XYZ
DEF-456,12,
GHI-789,3,Replacement
```

Validation:
- All SKUs exist + accessible per company catalog
- Quantities ≥ 1 and ≤ stock (with backorder check)
- Result: cart populated; buyer reviews + checks out

### RULE-B2B-025: Reorder list usage

Stored reorder lists let buyer 1-click re-add common items. Modifications by any company member (if `is_shared=true`).

Limit 100 items per list; max 50 lists per company.

### RULE-B2B-026: Sales rep impersonation distinct from customer impersonation

Sales rep "place on behalf" creates order with:
- `source='admin'`
- `source_user_id=sales_rep_user_id`
- `customer_id=company_member_buyer_id`
- `metadata.placed_on_behalf=true`

Audit log entry. Buyer notified (configurable).

### RULE-B2B-027: B2B invoice payment reconciliation

Bank transfer matching (Fáze 2):
- Daily import of bank statements
- Match by `invoice.variable_symbol` or `purchase_order_number`
- Auto-mark invoice paid; b2b_credit_ledger entry

Manual reconciliation UI for unmatched payments.

### RULE-B2B-028: Multi-company customer

Customer can be member of multiple companies. Storefront context selector ("Order as: Company A / Company B").

Each company has own pricing, catalog, history, credit.

### RULE-B2B-029: B2B customer ID for VAT (CZ specifics)

For CZ B2B: invoice must reference buyer's IČO + DIČ (already in `15`). Schema enforces.

### RULE-B2B-030: B2B agent procurement (MCP)

External AI agent with company-scoped agent token:
- Can browse catalog
- Can request quote
- Can place order within spending_limit
- All actions audited; buyer (`customer_id`) explicitly designated

Detail v `33-ai-features.md`. Configurable per company.

---

## 9. REST API endpoints

### 9.1 Companies (extended from `18`)

```
GET    /api/{date}/companies/{id}/credit-status
GET    /api/{date}/companies/{id}/credit-ledger
GET    /api/{date}/companies/{id}/orders
GET    /api/{date}/companies/{id}/quotes
GET    /api/{date}/companies/{id}/purchase-orders
GET    /api/{date}/companies/{id}/invoices
GET    /api/{date}/companies/{id}/contracts
PATCH  /api/{date}/companies/{id}/credit-limit
POST   /api/{date}/companies/{id}/credit-adjustment                            # manual adjustment
GET    /api/{date}/companies/{id}/subsidiary-tree
POST   /api/{date}/companies/{id}/subsidiaries                                  # add child company
```

### 9.2 Quotes

```
GET    /api/{date}/quotes
POST   /api/{date}/quotes                                                       # buyer submits OR sales rep creates
GET    /api/{date}/quotes/{id}
PATCH  /api/{date}/quotes/{id}                                                  # edit (per role + status)
DELETE /api/{date}/quotes/{id}
POST   /api/{date}/quotes/{id}:submit                                            # buyer → 'requested'
POST   /api/{date}/quotes/{id}:propose                                           # sales rep → 'proposed'
POST   /api/{date}/quotes/{id}:counter-propose                                   # buyer
POST   /api/{date}/quotes/{id}:accept                                             # buyer
POST   /api/{date}/quotes/{id}:reject                                             # either party
POST   /api/{date}/quotes/{id}:cancel
POST   /api/{date}/quotes/{id}:convert-to-order
GET    /api/{date}/quotes/{id}/pdf
POST   /api/{date}/quotes/{id}/messages                                           # add to thread
GET    /api/{date}/quotes/{id}/messages
POST   /api/{date}/quotes/{id}:regenerate-pdf
POST   /api/{date}/quotes/{id}:duplicate                                          # new quote based on this
```

### 9.3 Purchase orders

```
GET    /api/{date}/purchase-orders
POST   /api/{date}/purchase-orders                                                # buyer submits PO
GET    /api/{date}/purchase-orders/{id}
PATCH  /api/{date}/purchase-orders/{id}
DELETE /api/{date}/purchase-orders/{id}
POST   /api/{date}/purchase-orders/{id}:acknowledge                                 # merchant accepts
POST   /api/{date}/purchase-orders/{id}:reject
POST   /api/{date}/purchase-orders/{id}:cancel
POST   /api/{date}/purchase-orders/{id}:link-order                                   # associate with order
POST   /api/{date}/purchase-orders/{id}:upload-document                              # PDF upload
GET    /api/{date}/purchase-orders/{id}/acknowledgement.pdf                          # ack PDF
GET    /api/{date}/purchase-orders:pending-acknowledgement
```

### 9.4 Contracts

```
GET    /api/{date}/b2b-contracts
POST   /api/{date}/b2b-contracts
GET    /api/{date}/b2b-contracts/{id}
PATCH  /api/{date}/b2b-contracts/{id}
DELETE /api/{date}/b2b-contracts/{id}
POST   /api/{date}/b2b-contracts/{id}:activate
POST   /api/{date}/b2b-contracts/{id}:suspend
POST   /api/{date}/b2b-contracts/{id}:terminate
POST   /api/{date}/b2b-contracts/{id}:upload-document
POST   /api/{date}/b2b-contracts/{id}:sign-seller                                  # merchant sign
POST   /api/{date}/b2b-contracts/{id}:sign-buyer                                    # buyer sign
GET    /api/{date}/b2b-contracts/{id}/usage-report
POST   /api/{date}/b2b-contracts/{id}:renew                                          # manual renewal
```

### 9.5 Approval workflows

```
GET    /api/{date}/approval-workflows
POST   /api/{date}/approval-workflows
GET    /api/{date}/approval-workflows/{id}
PATCH  /api/{date}/approval-workflows/{id}
DELETE /api/{date}/approval-workflows/{id}

GET    /api/{date}/approval-requests
GET    /api/{date}/approval-requests/{id}
POST   /api/{date}/approval-requests/{id}:approve                                  # per step
POST   /api/{date}/approval-requests/{id}:reject
POST   /api/{date}/approval-requests/{id}:cancel
POST   /api/{date}/approval-requests/{id}:escalate
GET    /api/{date}/approval-requests:my-pending                                    # for current user
```

### 9.6 B2B portal (storefront)

```
GET    /api/{date}/storefront/me/companies/{id}                                     # company detail (member view)
GET    /api/{date}/storefront/me/companies/{id}/orders
GET    /api/{date}/storefront/me/companies/{id}/quotes
GET    /api/{date}/storefront/me/companies/{id}/invoices
GET    /api/{date}/storefront/me/companies/{id}/credit-status
POST   /api/{date}/storefront/me/companies/{id}/quotes                              # request quote
GET    /api/{date}/storefront/me/companies/{id}/reorder-lists
POST   /api/{date}/storefront/me/companies/{id}/reorder-lists
POST   /api/{date}/storefront/me/companies/{id}/reorder-lists/{list_id}:add-to-cart
POST   /api/{date}/storefront/me/companies/{id}/bulk-add                            # CSV
GET    /api/{date}/storefront/me/companies/{id}/approval-requests:my-pending
POST   /api/{date}/storefront/me/companies/{id}/approval-requests/{id}:approve
```

### 9.7 Sales rep tools

```
GET    /api/{date}/sales-rep/my-companies
GET    /api/{date}/sales-rep/my-pipeline                                            # quotes + opportunities
POST   /api/{date}/sales-rep/orders-on-behalf                                       # place order
POST   /api/{date}/sales-rep/quotes-on-behalf
GET    /api/{date}/sales-rep/my-commissions                                          # accrued + paid
```

### 9.8 B2B analytics

```
GET    /api/{date}/b2b-analytics/top-companies?period=30d
GET    /api/{date}/b2b-analytics/contract-usage?contract_id=
GET    /api/{date}/b2b-analytics/credit-utilization
GET    /api/{date}/b2b-analytics/ar-aging                                            # accounts receivable aging
GET    /api/{date}/b2b-analytics/sales-rep-performance
GET    /api/{date}/b2b-analytics/quote-conversion-rate?period=90d
GET    /api/{date}/b2b-analytics/dunning-summary
```

### 9.9 Example: Request quote (buyer)

```http
POST /api/2026-05-20/storefront/me/companies/cmp_aB/quotes HTTP/1.1
Authorization: Bearer customer_jwt

{
  "items": [
    { "variant_id": "var_aB", "quantity": 100, "notes": "Need quote for bulk order" },
    { "variant_id": "var_xY", "quantity": 250 }
  ],
  "currency": "CZK",
  "delivery_expected_date": "2026-07-01",
  "notes_from_buyer": "We're expanding our office and need bulk pricing.",
  "preferred_payment_terms_days": 30
}
```

```jsonc
HTTP/1.1 201 Created

{
  "data": {
    "id": "...",
    "pub_id": "qte_aB",
    "type": "quote",
    "attributes": {
      "number": "QTE-2026-00000123",
      "status": "requested",
      "items_count": 2,
      "subtotal_amount": 487500,
      "currency": "CZK",
      "requested_at": "2026-05-20T10:00:00Z",
      "assigned_sales_rep": { "id": "usr_rep1", "name": "Petr Salesman" }
    },
    "next_step": "Sales rep will respond within 2 business days."
  }
}
```

### 9.10 Example: Sales rep proposes quote

```http
POST /api/2026-05-20/quotes/qte_aB:propose HTTP/1.1
Authorization: Bearer staff_jwt

{
  "items": [
    { "variant_id": "var_aB", "quantity": 100, "unit_price_amount": 950, "discount_amount": 5000 },
    { "variant_id": "var_xY", "quantity": 250, "unit_price_amount": 380, "discount_amount": 0 }
  ],
  "valid_until": "2026-06-03T23:59:59Z",
  "payment_terms_days": 30,
  "notes_from_seller": "Per Vaše požadavky jsme připravili nabídku s objemovou slevou. Doprava zdarma nad 50 000 Kč."
}
```

```jsonc
HTTP/1.1 200 OK

{
  "data": {
    "id": "...",
    "pub_id": "qte_aB",
    "attributes": {
      "status": "proposed",
      "subtotal_amount": 190000,
      "discount_amount": 5000,
      "shipping_amount": 0,
      "tax_amount": 38850,
      "total_amount": 223850,
      "valid_until": "2026-06-03T23:59:59Z",
      "pdf_url": "https://cdn.shopio.com/quotes/...?sig=..."
    },
    "actions_performed": ["pdf_generated","email_sent_to_buyer"]
  }
}
```

### 9.11 Example: Buyer accepts quote

```http
POST /api/2026-05-20/storefront/me/companies/cmp_aB/quotes/qte_aB:accept HTTP/1.1
Authorization: Bearer customer_jwt

{
  "shipping_address_id": "adr_aB",
  "billing_address_id": "adr_aB",
  "purchase_order_number": "PO-2026-789"
}
```

```jsonc
HTTP/1.1 200 OK

{
  "data": {
    "quote": {
      "id": "qte_aB",
      "status": "accepted",
      "converted_order_id": "ord_xY"
    },
    "order": {
      "id": "ord_xY",
      "number": "ORD-2026-00012345",
      "status": "confirmed",
      "payment_method_kind": "invoice_net",
      "payment_terms_days": 30,
      "due_at": "2026-06-19T00:00:00Z"
    }
  }
}
```

### 9.12 Example: PO submission

```http
POST /api/2026-05-20/storefront/me/companies/cmp_aB/purchase-orders HTTP/1.1

{
  "po_number_external": "PO-2026-789",
  "amount": 223850,
  "currency": "CZK",
  "payment_terms_days": 30,
  "expected_delivery_date": "2026-07-01",
  "linked_order_id": "ord_xY",
  "buyer_contact_name": "Jan Novák",
  "buyer_contact_email": "jan.novak@company.cz",
  "po_document_media_id": "mdi_po_pdf"
}
```

```jsonc
HTTP/1.1 201 Created

{
  "data": {
    "id": "...",
    "pub_id": "po_aB",
    "attributes": {
      "po_number_external": "PO-2026-789",
      "status": "received",
      "amount": 223850,
      "currency": "CZK"
    },
    "next_step": "Awaiting merchant acknowledgement (typically within 2 business days)."
  }
}
```

### 9.13 Example: Credit status

```http
GET /api/2026-05-20/companies/cmp_aB/credit-status HTTP/1.1
```

```jsonc
HTTP/1.1 200 OK

{
  "data": {
    "company_id": "cmp_aB",
    "credit_limit_amount": 500000,
    "credit_used_amount": 187300,
    "credit_available_amount": 312700,
    "currency": "CZK",
    "credit_utilization_percent": 3746,
    "open_invoices_count": 5,
    "overdue_invoices_count": 1,
    "overdue_amount": 23400,
    "dunning_status": "reminder_1",
    "next_dunning_action_at": "2026-05-25T09:00:00Z"
  }
}
```

---

## 10. GraphQL schema

```graphql
type Quote implements Node & Timestamped {
  id: ID!
  pubId: String!
  number: String!
  company: Company!
  requestedByCustomer: Customer
  assignedSalesRep: User
  status: QuoteStatus!
  items: [QuoteItem!]!
  itemsCount: Int!
  currency: String!
  subtotalAmount: Money!
  discountAmount: Money!
  shippingAmount: Money!
  taxAmount: Money!
  totalAmount: Money!
  isReverseCharge: Boolean!
  validUntil: DateTime
  paymentTermsDays: Int
  shippingAddress: Address
  billingAddress: Address
  notesFromBuyer: String
  notesFromSeller: String
  convertedOrder: Order
  convertedAt: DateTime
  rejectedAt: DateTime
  rejectionReason: String
  locale: String!
  pdfUrl: String
  messages: [QuoteMessage!]!
  createdAt: DateTime!
  updatedAt: DateTime!
}

enum QuoteStatus { DRAFT REQUESTED IN_NEGOTIATION PROPOSED ACCEPTED REJECTED COUNTER_PROPOSED EXPIRED CONVERTED CANCELLED ARCHIVED }

type QuoteItem {
  variant: ProductVariant!
  quantity: Int!
  unitPrice: Money!
  discountAmount: Money!
  lineTotalAmount: Money!
  notes: String
}

type QuoteMessage {
  id: ID!
  authorKind: QuoteMessageAuthorKind!
  authorUser: User
  authorCustomer: Customer
  body: String!
  attachments: [Media!]!
  occurredAt: DateTime!
  isInternal: Boolean!
}

enum QuoteMessageAuthorKind { BUYER SELLER SYSTEM }

type PurchaseOrder implements Node & Timestamped {
  id: ID!
  pubId: String!
  company: Company!
  poNumberExternal: String!
  linkedOrder: Order
  relatedQuote: Quote
  status: PurchaseOrderStatus!
  currency: String!
  amount: Money!
  amountInvoiced: Money!
  amountPaid: Money!
  paymentTermsDays: Int
  expectedDeliveryDate: Date
  poDocument: Media
  acknowledgementPdf: Media
  receivedAt: DateTime!
  acknowledgedAt: DateTime
  acknowledgedBy: User
  rejectedAt: DateTime
  rejectionReason: String
  dueAt: DateTime
  paidAt: DateTime
  buyerContactName: String
  buyerContactEmail: String
  buyerNotes: String
  internalNotes: String
  createdAt: DateTime!
}

enum PurchaseOrderStatus { RECEIVED ACKNOWLEDGED REJECTED IN_PROGRESS FULFILLED INVOICED PAID OVERDUE CANCELLED PARTIALLY_RECEIVED }

type B2bContract implements Node {
  id: ID!
  pubId: String!
  number: String!
  company: Company!
  name: String!
  description: String
  status: B2bContractStatus!
  effectiveFrom: Date!
  effectiveUntil: Date
  autoRenew: Boolean!
  linkedPriceList: PriceList
  contractDiscountPercent: Float
  catalogRestrictionKind: String
  minimumVolumeAmount: Money
  minimumVolumePeriod: String
  currentPeriodVolumeAmount: Money!
  defaultPaymentTermsDays: Int
  contractDocument: Media
  signedByBuyerAt: DateTime
  signedBySellerAt: DateTime
  createdAt: DateTime!
}

enum B2bContractStatus { DRAFT ACTIVE SUSPENDED EXPIRED TERMINATED }

type ApprovalWorkflow implements Node {
  id: ID!
  pubId: String!
  name: String!
  description: String
  company: Company
  appliesToKind: ApprovalAppliesTo!
  triggerThresholdAmount: Money
  steps: JSON!
  isActive: Boolean!
  isDefault: Boolean!
}

enum ApprovalAppliesTo { ORDERS QUOTES BOTH }

type ApprovalRequest implements Node {
  id: ID!
  workflow: ApprovalWorkflow!
  company: Company!
  targetKind: String!
  targetId: ID!
  initiatedByCustomer: Customer
  status: ApprovalRequestStatus!
  currentStepIndex: Int!
  stepHistory: JSON!
  decisionRequiredBy: DateTime
  finalizedAt: DateTime
  finalDecision: String
  finalReason: String
  createdAt: DateTime!
}

enum ApprovalRequestStatus { PENDING APPROVED REJECTED CANCELLED TIMEOUT ESCALATED }

type B2bCreditStatus {
  company: Company!
  creditLimitAmount: Money!
  creditUsedAmount: Money!
  creditAvailableAmount: Money!
  creditUtilizationPercent: Float!
  openInvoicesCount: Int!
  overdueInvoicesCount: Int!
  overdueAmount: Money
  dunningStatus: String
  nextDunningActionAt: DateTime
}

extend type Query {
  quotes(first: Int, after: String, filter: QuoteFilter): QuoteConnection! @auth(requires: PERM_B2B_QUOTE_VIEW)
  quote(id: ID, pubId: String, number: String): Quote
  myCompanyQuotes(companyId: ID!): [Quote!]!

  purchaseOrders(first: Int, after: String, filter: PurchaseOrderFilter): PurchaseOrderConnection! @auth(requires: PERM_B2B_PO_VIEW)
  purchaseOrder(id: ID, pubId: String): PurchaseOrder
  myCompanyPurchaseOrders(companyId: ID!): [PurchaseOrder!]!

  b2bContracts(filter: B2bContractFilter): [B2bContract!]! @auth(requires: PERM_B2B_CONTRACT_VIEW)
  b2bContract(id: ID, pubId: String): B2bContract

  approvalWorkflows(companyId: ID): [ApprovalWorkflow!]! @auth(requires: PERM_B2B_WORKFLOW_VIEW)
  approvalRequests(filter: ApprovalRequestFilter): [ApprovalRequest!]! @auth(requires: PERM_B2B_WORKFLOW_VIEW)
  myPendingApprovals: [ApprovalRequest!]!

  companyCreditStatus(companyId: ID!): B2bCreditStatus! @auth(requires: PERM_B2B_CREDIT_VIEW)
  companyCreditLedger(companyId: ID!, first: Int, after: String): B2bCreditLedgerConnection! @auth(requires: PERM_B2B_CREDIT_VIEW)

  b2bAnalyticsTopCompanies(period: PeriodInput!, first: Int = 20): [TopCompanyEntry!]! @auth(requires: PERM_B2B_ANALYTICS_VIEW)
  b2bAnalyticsArAging: ArAgingReport! @auth(requires: PERM_B2B_ANALYTICS_VIEW)
  b2bAnalyticsSalesRepPerformance(period: PeriodInput!): [SalesRepPerformance!]! @auth(requires: PERM_B2B_ANALYTICS_VIEW)
}

extend type Mutation {
  createQuote(input: QuoteCreateInput!): Quote!
  updateQuote(id: ID!, input: QuoteUpdateInput!): Quote!
  submitQuote(id: ID!): Quote!
  proposeQuote(id: ID!, input: ProposeQuoteInput!): Quote! @auth(requires: PERM_B2B_QUOTE_PROPOSE)
  acceptQuote(id: ID!, input: AcceptQuoteInput): Quote!
  rejectQuote(id: ID!, reason: String!): Quote!
  counterProposeQuote(id: ID!, input: CounterProposeInput!): Quote!
  cancelQuote(id: ID!, reason: String): Quote!
  convertQuoteToOrder(id: ID!): Order! @auth(requires: PERM_B2B_QUOTE_CONVERT)
  addQuoteMessage(quoteId: ID!, body: String!, isInternal: Boolean = false): QuoteMessage!

  createPurchaseOrder(input: PurchaseOrderCreateInput!): PurchaseOrder!
  acknowledgePurchaseOrder(id: ID!, notes: String): PurchaseOrder! @auth(requires: PERM_B2B_PO_ACKNOWLEDGE)
  rejectPurchaseOrder(id: ID!, reason: String!): PurchaseOrder! @auth(requires: PERM_B2B_PO_ACKNOWLEDGE)
  cancelPurchaseOrder(id: ID!, reason: String): PurchaseOrder!
  linkPurchaseOrderToOrder(id: ID!, orderId: ID!): PurchaseOrder! @auth(requires: PERM_B2B_PO_MANAGE)

  createB2bContract(input: B2bContractInput!): B2bContract! @auth(requires: PERM_B2B_CONTRACT_MANAGE)
  updateB2bContract(id: ID!, input: B2bContractInput!): B2bContract! @auth(requires: PERM_B2B_CONTRACT_MANAGE)
  activateB2bContract(id: ID!): B2bContract! @auth(requires: PERM_B2B_CONTRACT_MANAGE)
  signB2bContractAsBuyer(id: ID!): B2bContract!
  signB2bContractAsSeller(id: ID!): B2bContract! @auth(requires: PERM_B2B_CONTRACT_MANAGE)

  createApprovalWorkflow(input: ApprovalWorkflowInput!): ApprovalWorkflow! @auth(requires: PERM_B2B_WORKFLOW_MANAGE)
  approveApprovalRequest(id: ID!, notes: String): ApprovalRequest!
  rejectApprovalRequest(id: ID!, reason: String!): ApprovalRequest!

  updateCompanyCreditLimit(companyId: ID!, newLimitAmount: Money!, reason: String!): Company! @auth(requires: PERM_B2B_CREDIT_MANAGE)
  recordCreditAdjustment(companyId: ID!, amount: Money!, notes: String!): MutationPayload! @auth(requires: PERM_B2B_CREDIT_MANAGE)

  switchActiveCompanyContext(companyId: ID!): MutationPayload!                          # customer with multi-company chooses active
  bulkAddToCart(companyId: ID!, csvData: String!): MutationPayload!                      # CSV bulk import

  assignSalesRep(companyId: ID!, userId: ID!, role: String!, commissionPercent: Float): SalesRepAssignment! @auth(requires: PERM_B2B_SALES_REP_MANAGE)
}
```

---

## 11. Events

| Build-spec ID | Wire | Payload |
|---|---|---|
| `EVENT-QUOTE-REQUESTED` | `b2b.quote.requested` | `{ quote }` |
| `EVENT-QUOTE-PROPOSED` | `b2b.quote.proposed` | `{ quote }` |
| `EVENT-QUOTE-ACCEPTED` | `b2b.quote.accepted` | `{ quote }` |
| `EVENT-QUOTE-REJECTED` | `b2b.quote.rejected` | `{ quote, reason }` |
| `EVENT-QUOTE-COUNTER-PROPOSED` | `b2b.quote.counter_proposed` | `{ quote }` |
| `EVENT-QUOTE-EXPIRED` | `b2b.quote.expired` | `{ quote }` |
| `EVENT-QUOTE-CONVERTED-TO-ORDER` | `b2b.quote.converted_to_order` | `{ quote, order }` |
| `EVENT-QUOTE-MESSAGE-ADDED` | `b2b.quote.message_added` | `{ quote, message }` |
| `EVENT-PURCHASE-ORDER-RECEIVED` | `b2b.po.received` | `{ purchase_order }` |
| `EVENT-PURCHASE-ORDER-ACKNOWLEDGED` | `b2b.po.acknowledged` | `{ purchase_order }` |
| `EVENT-PURCHASE-ORDER-REJECTED` | `b2b.po.rejected` | `{ purchase_order, reason }` |
| `EVENT-PURCHASE-ORDER-INVOICED` | `b2b.po.invoiced` | `{ purchase_order, invoice }` |
| `EVENT-PURCHASE-ORDER-PAID` | `b2b.po.paid` | `{ purchase_order }` |
| `EVENT-PURCHASE-ORDER-OVERDUE` | `b2b.po.overdue` | `{ purchase_order, days_overdue }` |
| `EVENT-CONTRACT-ACTIVATED` | `b2b.contract.activated` | `{ contract }` |
| `EVENT-CONTRACT-EXPIRED` | `b2b.contract.expired` | `{ contract }` |
| `EVENT-CONTRACT-MINIMUM-VOLUME-AT-RISK` | `b2b.contract.minimum_volume_at_risk` | `{ contract, current_progress }` |
| `EVENT-APPROVAL-REQUEST-CREATED` | `b2b.approval.created` | `{ request }` |
| `EVENT-APPROVAL-REQUEST-STEP-DECIDED` | `b2b.approval.step_decided` | `{ request, step, decision }` |
| `EVENT-APPROVAL-REQUEST-FINALIZED` | `b2b.approval.finalized` | `{ request, decision }` |
| `EVENT-APPROVAL-REQUEST-TIMEOUT` | `b2b.approval.timeout` | `{ request, step }` |
| `EVENT-CREDIT-LIMIT-CHANGED` | `b2b.credit.limit_changed` | `{ company, previous_limit, new_limit, reason }` |
| `EVENT-CREDIT-LIMIT-EXCEEDED-ATTEMPT` | `b2b.credit.limit_exceeded_attempt` | `{ company, attempted_amount, available }` |
| `EVENT-CREDIT-UTILIZATION-HIGH` | `b2b.credit.utilization_high` | `{ company, utilization_percent }` |
| `EVENT-DUNNING-STAGE-ADVANCED` | `b2b.dunning.stage_advanced` | `{ company, new_stage }` |
| `EVENT-SALES-REP-ASSIGNED` | `b2b.sales_rep.assigned` | `{ company, sales_rep }` |
| `EVENT-COMPANY-TIER-CHANGED` | `b2b.company.tier_changed` | `{ company, previous_tier, new_tier }` |

**Konzumenti:**
- Notifications — buyer + seller emails per workflow stage
- Marketing automation — onboarding flows pro nové B2B accounts
- Analytics — quote conversion rate, sales rep performance
- Webhook delivery
- ERP/CRM integrations (Salesforce, HubSpot, Pipedrive)

---

## 12. Background jobs

| Job | Trigger | Queue | Frequency |
|---|---|---|---|
| `JOB-NOTIFY-QUOTE-REQUESTED` | EVENT-QUOTE-REQUESTED | `notifications` | On-demand |
| `JOB-GENERATE-QUOTE-PDF` | EVENT-QUOTE-PROPOSED | `documents` | On-demand |
| `JOB-EXPIRE-QUOTES` | scheduled | `b2b-sweeper` | Hourly |
| `JOB-CONVERT-QUOTE-TO-ORDER` | EVENT-QUOTE-ACCEPTED | `b2b` | On-demand |
| `JOB-NOTIFY-PO-RECEIVED` | EVENT-PURCHASE-ORDER-RECEIVED | `notifications` | On-demand |
| `JOB-GENERATE-PO-ACKNOWLEDGEMENT-PDF` | EVENT-PURCHASE-ORDER-ACKNOWLEDGED | `documents` | On-demand |
| `JOB-PO-DEADLINE-AUTO-REJECT` | scheduled | `b2b-sweeper` | Daily |
| `JOB-CHECK-CREDIT-LIMIT-PRE-ORDER` | order placement saga | `b2b-credit` | On-demand |
| `JOB-UPDATE-CREDIT-LEDGER` | EVENT-ORDER-PLACED/INVOICED/PAID/REFUNDED | `b2b-credit` | On-demand |
| `JOB-EVALUATE-APPROVAL-WORKFLOW` | order/quote creation if workflow applies | `b2b` | On-demand |
| `JOB-ESCALATE-APPROVAL-TIMEOUT` | scheduled | `b2b-sweeper` | Every 15 min |
| `JOB-DUNNING-EXECUTE-STAGE` | scheduled | `b2b-dunning` | Daily |
| `JOB-CONTRACT-CHECK-EXPIRING` | scheduled | `b2b-contracts` | Daily |
| `JOB-CONTRACT-AUTO-RENEW` | scheduled | `b2b-contracts` | Daily |
| `JOB-CONTRACT-MINIMUM-VOLUME-CHECK` | scheduled | `b2b-contracts` | Weekly |
| `JOB-COMPUTE-SALES-REP-COMMISSION` | scheduled or order completed | `b2b-analytics` | Daily |
| `JOB-AUTO-TIER-COMPANIES` | scheduled (based on annual revenue) | `b2b-analytics` | Monthly |
| `JOB-RECONCILE-CREDIT-LEDGER` | scheduled | `b2b-credit` | Weekly |
| `JOB-RECONCILE-BANK-PAYMENTS-TO-INVOICES` | bank statement import | `b2b-credit` | On-demand |
| `JOB-NOTIFY-CONTRACT-EXPIRING-SOON` | EVENT-CONTRACT-EXPIRING-SOON | `notifications` | 30/7/1 days before |
| `JOB-COMPUTE-AR-AGING` | scheduled | `b2b-analytics` | Daily |
| `JOB-OCR-PURCHASE-ORDER-DOCUMENT` | EVENT-PURCHASE-ORDER-DOCUMENT-UPLOADED (Fáze 2+) | `b2b` | On-demand |

---

## 13. UI/UX flows

### FLOW-B2B-001: Buyer requests quote

```
[B2B portal /b2b]
   - Company selector (if member of multiple)
   - Navigation: Catalog | Quotes | Orders | Invoices | Reorder lists
        │
        ▼
[Catalog (filtered per company catalog visibility)]
   - Browse products
   - "Request quote" button next to "Add to cart"
        │
   click "Request quote" → enters quote-cart mode (separate cart kind)
        │
        ▼
[Quote-cart page]
   - Items list
   - Notes for sales rep
   - Preferred delivery date
   - "Submit quote request" button
        │
        ▼
[POST /quotes → status='requested']
   - Confirmation email sent
   - Quote visible in /b2b/quotes
```

### FLOW-B2B-002: Sales rep responds

```
[Sales rep dashboard /sales-rep/pipeline]
   - List of pending quotes assigned
        │
   click quote
        │
        ▼
[Quote editor]
   - View buyer's request
   - Edit line items (qty, unit_price, discount)
   - Add note for buyer
   - Set valid_until + payment terms
   - Preview PDF
   - "Send to buyer" button
        │
        ▼
[POST /quotes/{id}:propose]
   - PDF generated
   - Email sent to buyer
   - status='proposed'
```

### FLOW-B2B-003: Buyer accepts

```
[Buyer receives email with quote link]
   - Or sees in /b2b/quotes
        │
        ▼
[Quote detail page]
   - PDF preview / download
   - Items + terms + total
   - Messages thread
   - Actions: [Accept] [Counter-offer] [Reject]
        │
   click [Accept]
        │
        ▼
[Acceptance modal]
   - Confirm shipping/billing address
   - PO number (optional)
   - "Confirm acceptance" button
        │
        ▼
[POST /quotes/{id}:accept]
   - status='accepted'
   - JOB-CONVERT-QUOTE-TO-ORDER fires
   - Order created → buyer sees confirmation page
```

### FLOW-B2B-004: Admin acknowledges PO

```
[Admin dashboard alert: "3 POs awaiting acknowledgement"]
        │
   click → /b2b/purchase-orders?status=received
        │
        ▼
[PO list]
   - Per PO: company, amount, due date, attached PDF
        │
   click PO
        │
        ▼
[PO detail]
   - View buyer's PO document
   - Match against linked order
   - Internal notes
   - Actions: [Acknowledge] [Reject] [Request more info]
        │
   click [Acknowledge]
        │
        ▼
[POST /purchase-orders/{id}:acknowledge]
   - PDF acknowledgement generated
   - Email sent to buyer
   - status='acknowledged'
   - Linked order proceeds to fulfillment
```

### FLOW-B2B-005: Approval workflow

```
[Buyer (purchase limit role) places order > limit]
   - Order goes to status='on_hold' (per `16`)
   - approval_requests row created
   - Approver notified
        │
        ▼
[Approver opens approval queue /b2b/approvals]
   - Pending requests
        │
   click request
        │
        ▼
[Approval detail]
   - Order summary
   - Buyer info
   - Comments thread
   - Actions: [Approve] [Reject] [Request changes]
        │
   click [Approve]
        │
        ▼
[POST /approval-requests/{id}:approve]
   - If multi-step: advance to next step
   - If final: release order hold → confirmed → fulfillment
   - Buyer notified
```

### FLOW-B2B-006: Credit limit warning

```
[Admin → Companies → {company}]
   - Credit utilization 95%
   - Alert badge "Approaching credit limit"
        │
   click → /b2b/credit-status
        │
        ▼
[Credit status page]
   - Limit, used, available, utilization gauge
   - Recent ledger entries
   - Open invoices breakdown
   - Overdue alerts
   - Actions: [Adjust limit] [Manual adjustment] [Send statement]
```

### FLOW-B2B-007: Bulk order CSV upload

```
[B2B portal cart page → "Bulk add" tab]
   - Upload CSV button
        │
   file selected
        │
        ▼
[Preview]
   - Parse CSV: SKU, qty, note per row
   - Validation: SKU exists? Stock? Accessibility?
   - Errors highlighted
   - "Add all valid" button (skip invalid)
        │
        ▼
[POST /storefront/me/companies/{id}/bulk-add]
   - Cart populated
   - Buyer reviews + checks out
```

### FLOW-B2B-008: Dunning workflow

```
[Invoice past due_at]
   - JOB-DUNNING-EXECUTE-STAGE checks daily
        │
        ▼
[Day +3: reminder_1]
   - Email sent (gentle)
   - b2b_dunning_log entry
        │
        ▼
[Day +14: reminder_2]
   - Email sent (firmer)
        │
        ▼
[Day +30: final_notice]
   - Email + optional letter
   - dunning_status='reminder_2' → 'final_notice'
        │
        ▼
[Day +60: collections]
   - Admin notified for manual action
   - Company flagged in admin UI
   - New orders blocked (configurable)
        │
        ▼
[Day +180: written_off]
   - Admin explicit action
   - b2b_credit_ledger kind='dunning_writeoff'
   - Accounting export reflects
```

---

## 14. Edge cases & error handling

| Scenario | Behavior | Code |
|---|---|---|
| Buyer not member of any company tries B2B endpoints | Reject | `NO_COMPANY_CONTEXT`, 403 |
| Member with `viewer` role tries to place order | Reject | `INSUFFICIENT_COMPANY_ROLE`, 403 |
| Buyer requests quote for products not in company catalog | Strip invalid items + warning | (handled) |
| Quote acceptance after `valid_until` passed | Reject; suggest re-quote | `QUOTE_EXPIRED`, 422 |
| Quote acceptance with insufficient stock | Block; offer partial OR re-quote | `STOCK_INSUFFICIENT_FOR_QUOTE`, 422 |
| PO submission with mismatched line items vs order | Flag for manual review | (handled per RULE-B2B-006) |
| PO acknowledgement after order shipped | Allow (informational only) | (handled) |
| Credit limit exceeded during order placement | Reject OR trigger approval per policy | `CREDIT_LIMIT_EXCEEDED`, 422 |
| Concurrent order placements consuming same credit | Advisory lock per company | (handled) |
| Approval request timeout no decision | Escalate per workflow OR mark timeout | (handled per RULE-B2B-009) |
| Multi-step approval: middle approver rejects | Entire request rejected; order cancelled | (handled) |
| Sales rep deactivated mid-quote | Reassign to manager or admin; notify | (handled) |
| Sales rep places order on behalf, customer doesn't exist | Reject (must create company member first) | (handled) |
| Contract minimum volume not met at period end | Notify merchant; manual decision (penalty / waiver / extend) | (handled) |
| Catalog override conflict (include + exclude same SKU) | Exclude wins (safer) | (handled) |
| Bulk CSV with invalid SKU | Skip with note in result; valid ones added | (handled) |
| Subsidiary order rolled up to parent credit | Configurable per `companies.parent_company_id` | (handled per RULE-B2B-019) |
| Approval bypassed without permission | Reject + audit | `INSUFFICIENT_PERMISSION`, 403 |
| B2B order for B2C-only product | Filter pre-checkout; rare case if mistakenly added | (handled) |
| Customer member of inactive company | Block; show "Company suspended" | `COMPANY_SUSPENDED`, 403 |
| Reorder list references discontinued products | Skip with warning | (handled) |
| Credit limit adjustment to below current used | Allow with warning; block new orders until paid down | (handled) |
| Dunning collections action on company with disputed invoice | Pause until dispute resolved | (manual override) |
| Bank reconciliation matches wrong invoice | Admin re-allocation tool | (Fáze 2 manual) |
| Quote PDF generation fails | Retry; fallback HTML version | (handled) |
| Buyer changes mind mid-quote acceptance | Cancel quote; re-engage | (handled) |
| Sales rep commission calculated on refunded order | Reverse commission entry on refund | (handled) |
| GDPR delete of B2B contact at company | Anonymize as customer; preserve company-level data | (handled per `18` rules) |
| Cross-tenant quote attempt | Reject (tenant_id mismatch) | `NOT_FOUND`, 404 |
| Sub-company tries to bypass parent credit pool | Enforced at credit check | (handled) |

---

## 15. Performance

### 15.1 Targets

| Operation | p50 | p95 | p99 |
|---|---|---|---|
| `POST /quotes` (create) | 80 ms | 300 ms | 600 ms |
| `POST /quotes/{id}:accept` (with order conversion) | 300 ms | 1000 ms | 2500 ms |
| `GET /companies/{id}/credit-status` | 20 ms | 60 ms | 150 ms |
| Approval workflow evaluation | 30 ms | 100 ms | 250 ms |
| Quote PDF generation | 500 ms | 2000 ms | 5000 ms |
| Bulk add 100 SKUs | 200 ms | 800 ms | 2000 ms |
| `JOB-DUNNING-EXECUTE-STAGE` (1000 companies) | 30 s | 90 s | 180 s |
| `JOB-COMPUTE-AR-AGING` | 5 s | 20 s | 60 s |

### 15.2 Optimization

- Credit status cached per company (60s TTL, invalidated on order placement)
- Approval workflow queries cached
- PDF generation pooled
- Bulk SKU validation: single SELECT WHERE sku IN (...)
- Sales rep dashboards: materialized views for pipeline

### 15.3 Scaling

- Quote volume: ~10-100/day per merchant typical; max ~1000/day large B2B
- PO volume: similar
- Credit ledger growth: linear with order volume

---

## 16. Security & compliance

### 16.1 Permissions

```
PERM-B2B-COMPANY-VIEW
PERM-B2B-COMPANY-MANAGE
PERM-B2B-QUOTE-VIEW
PERM-B2B-QUOTE-CREATE
PERM-B2B-QUOTE-PROPOSE
PERM-B2B-QUOTE-CONVERT
PERM-B2B-PO-VIEW
PERM-B2B-PO-ACKNOWLEDGE
PERM-B2B-PO-MANAGE
PERM-B2B-CONTRACT-VIEW
PERM-B2B-CONTRACT-MANAGE
PERM-B2B-CREDIT-VIEW
PERM-B2B-CREDIT-MANAGE
PERM-B2B-WORKFLOW-VIEW
PERM-B2B-WORKFLOW-MANAGE
PERM-B2B-SALES-REP-MANAGE
PERM-B2B-ANALYTICS-VIEW
PERM-B2B-AR-REPORT
PERM-B2B-AUDIT-VIEW
PERM-B2B-CUSTOMER-SERVICE
PERM-B2B-ORDER-CREATE-ON-BEHALF
```

### 16.2 Multi-tenancy

Hard enforced. Cross-tenant prohibited.

### 16.3 GDPR

- Company business info NOT PII (legal entity); retained per accounting law
- Individual member info per `18-customer-management.md` rules
- Contract documents retained per business retention (configurable, default 10 years)

### 16.4 Audit

100% audit on:
- Quote propose / accept / reject
- PO acknowledge / reject
- Contract activate / terminate
- Credit limit change
- Manual credit adjustment
- Approval bypass
- Sales rep assignment change
- Dunning stage transition

### 16.5 Rate limits

| Endpoint | Free Plan | Pro |
|---|---|---|
| `POST /storefront/me/companies/{id}/quotes` | 10/hour per customer | 30/hour |
| `POST /storefront/me/companies/{id}/bulk-add` | 5/hour | 30/hour |
| `POST /quotes/{id}:accept` | 10/hour per customer | 60/hour |
| Approval action endpoints | 60/min | 600/min |
| `GET /b2b-analytics/*` | 60/min | 600/min |

---

## 17. Testing

### 17.1 Unit

```
TEST-UNIT-B2B-001  CreditAvailableCalculator
TEST-UNIT-B2B-002  QuotePricingEngine
TEST-UNIT-B2B-003  ApprovalWorkflowEvaluator (multi-step)
TEST-UNIT-B2B-004  ApprovalEscalationHandler
TEST-UNIT-B2B-005  CatalogVisibilityFilter
TEST-UNIT-B2B-006  ContractPriceListResolver
TEST-UNIT-B2B-007  PoLineMatcher (PO vs order matching)
TEST-UNIT-B2B-008  DunningScheduler (stage transitions)
TEST-UNIT-B2B-009  CommissionCalculator
TEST-UNIT-B2B-010  CompanyTierAutoAssigner
TEST-UNIT-B2B-011  PurchaseLimitChecker (per period)
TEST-UNIT-B2B-012  SubsidiaryAggregator (credit pooling)
```

### 17.2 Integration

```
TEST-INT-B2B-001  Buyer creates quote → status='requested'
TEST-INT-B2B-002  Sales rep proposes quote → status='proposed' → PDF generated
TEST-INT-B2B-003  Buyer accepts quote → order created
TEST-INT-B2B-004  PO submission + acknowledgement flow
TEST-INT-B2B-005  PO mismatch detected → manual review
TEST-INT-B2B-006  Credit limit check at checkout
TEST-INT-B2B-007  Credit limit exceeded → order blocked
TEST-INT-B2B-008  Approval workflow triggered above threshold
TEST-INT-B2B-009  Approval timeout → escalation
TEST-INT-B2B-010  Approval rejected → order cancelled
TEST-INT-B2B-011  Contract activates pricing
TEST-INT-B2B-012  Contract expiry auto-archives
TEST-INT-B2B-013  Catalog override filters storefront products
TEST-INT-B2B-014  Dunning stage execution
TEST-INT-B2B-015  Sales rep commission tracked on order
TEST-INT-B2B-016  Bulk CSV order import
TEST-INT-B2B-017  Reorder list one-click add to cart
TEST-INT-B2B-018  Reverse charge VAT applied for EU B2B (cross-ref `15`)
TEST-INT-B2B-019  Subsidiary credit pooling
TEST-INT-B2B-020  Multi-company customer switches context
TEST-INT-B2B-021  Quote conversion preserves snapshot
TEST-INT-B2B-022  Sales rep places order on behalf — audit
TEST-INT-B2B-023  GDPR delete of buyer member — company preserved
TEST-INT-B2B-024  Bank payment reconciled to invoice → credit released
TEST-INT-B2B-025  Concurrent order placements + credit check (advisory lock)
```

### 17.3 E2E

```
TEST-E2E-B2B-001  B2B buyer signs up → company created → invited members → places order
TEST-E2E-B2B-002  Quote-to-cash full flow
TEST-E2E-B2B-003  PO submission → acknowledgement → fulfillment → invoice → payment
TEST-E2E-B2B-004  Approval workflow with 2 approvers
TEST-E2E-B2B-005  Bulk CSV procurement
TEST-E2E-B2B-006  Contract-driven pricing on checkout
TEST-E2E-B2B-007  Dunning workflow email cascade
TEST-E2E-B2B-008  Sales rep assists buyer (impersonate variant)
```

### 17.4 Load

```
TEST-LOAD-B2B-001  100 concurrent quote submissions → < 5s p95
TEST-LOAD-B2B-002  Credit limit check at 1000 RPS → no race conditions
TEST-LOAD-B2B-003  Bulk import 10k SKUs → < 30s
```

---

## 18. Implementation checklist

### Backend
- [ ] **[S]** Migrace `20260604_001_extend_b2b_tables.sql` — ALTER companies + company_members
- [ ] **[S]** Migrace `20260604_002_create_b2b_tables.sql` — quotes, purchase_orders, contracts, workflows, ledger, dunning, sales reps, reorder lists
- [ ] **[L]** `QuoteService` — full lifecycle
- [ ] **[L]** `PurchaseOrderService` — lifecycle + matching
- [ ] **[L]** `B2bContractService` — lifecycle + minimum volume tracking
- [ ] **[L]** `ApprovalWorkflowEngine` — graph-based evaluator
- [ ] **[L]** `CreditLimitService` — check + ledger
- [ ] **[M]** `DunningService` — stage execution
- [ ] **[M]** `SalesRepCommissionCalculator`
- [ ] **[M]** `CatalogVisibilityFilter` (used by storefront product list)
- [ ] **[M]** `BulkAddCsvProcessor`
- [ ] **[L]** `QuotePdfGenerator`
- [ ] **[M]** `PoAcknowledgementPdfGenerator`
- [ ] **[M]** REST endpoints per §9
- [ ] **[M]** GraphQL types + resolvers
- [ ] **[S]** tRPC router (admin + sales rep)
- [ ] **[M]** MCP tools `b2b.quote.create`, `b2b.order.place` (Fáze 3+ agents)

### Background jobs
- [ ] **[S]** JOB-NOTIFY-QUOTE-REQUESTED, JOB-GENERATE-QUOTE-PDF, JOB-EXPIRE-QUOTES
- [ ] **[M]** JOB-CONVERT-QUOTE-TO-ORDER
- [ ] **[S]** JOB-NOTIFY-PO-RECEIVED, JOB-GENERATE-PO-ACKNOWLEDGEMENT-PDF
- [ ] **[M]** JOB-PO-DEADLINE-AUTO-REJECT
- [ ] **[L]** JOB-CHECK-CREDIT-LIMIT-PRE-ORDER, JOB-UPDATE-CREDIT-LEDGER
- [ ] **[L]** JOB-EVALUATE-APPROVAL-WORKFLOW, JOB-ESCALATE-APPROVAL-TIMEOUT
- [ ] **[M]** JOB-DUNNING-EXECUTE-STAGE
- [ ] **[S]** JOB-CONTRACT-CHECK-EXPIRING, JOB-CONTRACT-AUTO-RENEW, JOB-CONTRACT-MINIMUM-VOLUME-CHECK
- [ ] **[M]** JOB-COMPUTE-SALES-REP-COMMISSION
- [ ] **[S]** JOB-AUTO-TIER-COMPANIES
- [ ] **[M]** JOB-RECONCILE-CREDIT-LEDGER, JOB-RECONCILE-BANK-PAYMENTS-TO-INVOICES
- [ ] **[S]** JOB-NOTIFY-CONTRACT-EXPIRING-SOON
- [ ] **[M]** JOB-COMPUTE-AR-AGING

### Frontend — Admin
- [ ] **[L]** Companies list + detail (extended from `18`)
- [ ] **[L]** Quotes list + detail editor (sales rep)
- [ ] **[L]** Purchase orders list + acknowledgement UI
- [ ] **[L]** Contracts management
- [ ] **[M]** Approval workflows builder (visual graph)
- [ ] **[M]** Credit limit + ledger management
- [ ] **[M]** Dunning queue + manual actions
- [ ] **[M]** Sales rep dashboard + assignment UI
- [ ] **[M]** B2B analytics dashboards (AR aging, top companies, conversion)
- [ ] **[S]** Contract signing flow (e-sign integration Fáze 2)

### Frontend — Storefront / B2B portal
- [ ] **[L]** B2B portal `/b2b/*` (separate UI from B2C)
- [ ] **[M]** Company context switcher (multi-company customer)
- [ ] **[L]** Quote-cart variant
- [ ] **[L]** Quote detail + messages thread
- [ ] **[M]** PO submission form + upload
- [ ] **[L]** B2B checkout variant (NET terms, PO field, credit display)
- [ ] **[M]** Approval queue (my pending approvals)
- [ ] **[M]** Credit status widget
- [ ] **[M]** Invoices list + PDF download
- [ ] **[M]** Reorder lists management
- [ ] **[M]** Bulk add CSV UI
- [ ] **[S]** Contract signing UI

### Tests
- [ ] **[M]** Per §17

### Docs
- [ ] **[L]** "Setting up your B2B operation" merchant guide
- [ ] **[M]** "B2B portal user guide" buyer-facing
- [ ] **[M]** "Quote management workflow" sales rep guide
- [ ] **[S]** "Credit management" finance guide
- [ ] **[S]** "Approval workflow design" guide
- [ ] **[S]** "Contract management" guide
- [ ] **[S]** Developer: B2B event hooks for plugins
- [ ] **[S]** Developer: ERP/CRM integration patterns

---

## 19. Open questions

### Q-B2B-001: EDI integration
**Otázka:** Large B2B uses EDI (X12, EDIFACT). Native support or via plugin?

**Status:** Fáze 3+ plugin marketplace. Schema-aware (purchase_orders supports external doc references).

### Q-B2B-002: E-signature integration
**Otázka:** DocuSign, SignNow for contract signing?

**Status:** Fáze 2 via integration plugin. Manual upload + checkbox confirmation in MVP.

### Q-B2B-003: ERP sync depth
**Otázka:** Real-time bi-directional sync vs nightly batch (Pohoda, SAP, Odoo)?

**Status:** v1.0+ per integration. Detail v `29-integrations.md`.

### Q-B2B-004: B2B-specific tax (regional)
**Otázka:** US sales tax B2B with resale certificates? Different from EU model.

**Status:** Fáze 4 US expansion. Schema extension required.

### Q-B2B-005: Multi-currency contracts
**Otázka:** Contract in EUR but order in CZK — conversion at order time?

**Status:** Contract specifies currency; conversion via exchange_rates at order time. Slippage tolerance configurable.

### Q-B2B-006: AI quote suggestions
**Otázka:** AI Copilot proposes pricing based on historical data + competitor analysis?

**Status:** Fáze 3+ feature in `33-ai-features.md`.

### Q-B2B-007: Affiliate / channel partner programs
**Otázka:** Resellers, distributors with tiered commission?

**Status:** Fáze 3+ separate spec. Schema-ready via sales_rep_assignments concept extended.

### Q-B2B-008: Tax-exempt scenarios beyond reverse charge
**Otázka:** Government / non-profit tax exemptions?

**Status:** `tax_exemptions` (cross-ref `15`) supports it. Schema-ready for kind='non_profit' etc.

### Q-B2B-009: Quote vs order ordering of operations
**Otázka:** Can buyer split accepted quote into multiple smaller orders?

**Status:** v1.0+ enhancement. MVP: 1:1 quote→order.

### Q-B2B-010: Multi-language contracts
**Otázka:** Contract template per locale; legal language critical.

**Status:** Templates per locale (cross-ref `19-marketing-seo.md` for templates). Legal review per locale required.

### Q-B2B-011: Group purchasing organizations (GPO)
**Otázka:** Multiple companies pool buying power for collective discounts?

**Status:** Fáze 3+ complex feature. Schema extension TBD.

### Q-B2B-012: Punchout catalog (Ariba, Coupa)
**Otázka:** Buyer browses our catalog from their procurement system, returns cart to their ERP.

**Status:** Fáze 3+ enterprise feature. cXML protocol support.

### Q-B2B-013: Auto-PO generation from subscriptions
**Otázka:** Recurring delivery (per `24-subscriptions.md`) — auto-create PO each cycle?

**Status:** Configurable per company subscription setup. Detail v `24`.

### Q-B2B-014: Spot vs framework contracts
**Otázka:** Long-term framework agreements with call-off orders.

**Status:** Schema supports via b2b_contracts (effective period + linked orders). Detail UX Fáze 2.

### Q-B2B-015: B2B mobile app
**Otázka:** Native mobile app for B2B reps + buyers?

**Status:** Fáze 4 mobile. Detail v `26-themes-storefront.md` future extensions.

---

## 📅 Změny

| Datum | Změna |
|---|---|
| 2026-05-20 | Initial — Full B2B domain (v1.0+ activation). Quotes, POs, contracts, approval workflows, credit limits, NET terms, dunning, sales reps, catalog overrides. Extends B2B-lite from `18-customer-management.md`. |

---

**Konec B2B Complete.**

➡️ Pokračovat na: [`22-multistore-channels.md`](22-multistore-channels.md)
