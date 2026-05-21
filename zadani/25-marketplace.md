# 25 – MARKETPLACE (MULTI-VENDOR)

> **Doména:** Multi-vendor marketplace — third-party sellers list products on platform tenant's storefront. Sellers manage own catalog, inventory, fulfillment; platform takes commission on each sale. Stripe Connect for payouts. Marketplace facilitator tax compliance. Dispute resolution + seller rating system.
>
> **Status:** Fáze 4 activation. MVP: schema-ready (`03 §16` ENT-SELLER-001 stubs), full implementation post-v3.0.

**Datum:** 2026-05-20
**Verze:** 1.0
**Status:** 🟡 DESIGN (Fáze 4 activation)
**Reference:** [03 §16](03-data-models-master.md#16-marketplace-multi-vendor) · [13-payments.md](13-payments.md) · [16-order-management.md](16-order-management.md) · [22-multistore-channels.md](22-multistore-channels.md)

---

## 📑 Obsah

0. [Domain overview](#0-domain-overview)
1. [References](#1-references)
2. [Personas](#2-personas)
3. [Data models](#3-data-models)
4. [Seller onboarding](#4-seller-onboarding)
5. [Marketplace order flow](#5-marketplace-order-flow)
6. [Commission & payouts](#6-commission--payouts)
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

- **Marketplace mode** — platform tenant runs storefront where third-party sellers also list products
- **Sellers (vendors)** — third-party companies; each has own dashboard, catalog, inventory, fulfillment
- **Seller onboarding** — KYC verification, contract signing, banking info, Stripe Connect account
- **Multi-vendor cart** — customer buys items from multiple sellers in single checkout; backend splits orders per seller
- **Commission structure** — platform takes % per sale (configurable per seller, per category, per tier)
- **Payouts** — Stripe Connect (preferred) or similar; periodic seller payouts after settlement
- **Seller storefront** — per-seller branded shop page within marketplace (sub-route or sub-domain)
- **Seller dashboard** — analytics, orders, payouts, ratings
- **Seller fulfillment** — each seller ships own products; platform tracks
- **Seller ratings + reviews** — customers rate sellers (not just products); affects search ranking + trust
- **Dispute resolution** — buyer vs seller disputes; platform mediates
- **Marketplace policies** — listing rules, prohibited items, quality standards
- **Marketplace facilitator tax** — US/UK rules where platform collects tax on seller's behalf; EU IOSS
- **Seller-managed promotions** — sellers can run own discounts within platform rules
- **Returns workflow** — buyer returns to seller (not platform)
- **Multi-currency seller payouts** — Stripe Connect handles FX
- **Search ranking** — multi-vendor products in unified search; seller score affects ranking
- **Buyer trust signals** — verified seller badge, fulfillment SLA, dispute rate, response time
- **Platform-mediated communications** — buyer-seller messages routed through platform (audit)

### 0.2 Co tato doména **NENÍ**

- ❌ Platform-as-marketplace for our own product (Shopio Cloud SaaS billing — separate)
- ❌ Auction model (out of scope; could be Fáze 5+ plugin)
- ❌ Drop-shipping at single-seller scale (→ `09-inventory.md` virtual warehouse)
- ❌ B2B procurement marketplace (→ `21-b2b-complete.md`)
- ❌ Affiliate / referral program (→ Fáze 3+ separate)
- ❌ Existing single-tenant store with bundled catalog (→ standard mode)
- ❌ Order management internals (→ `16-order-management.md`)
- ❌ Payment processing internals (→ `13-payments.md`)
- ❌ Tax engine (→ `15-tax-compliance.md` extended for marketplace facilitator rules)
- ❌ Subscription marketplace (sellers selling subscriptions — Fáze 4+ extension)

### 0.3 Diferenciátory

1. **EU-compliant from day 1** — IOSS for non-EU sellers, OSS for EU sellers, marketplace facilitator tax where applicable
2. **Single codebase mode toggle** — tenant activates `marketplace_mode=true` and standard storefront becomes multi-vendor capable (per `DEC-ARCH-001`)
3. **Stripe Connect native** — proven payout infrastructure; sellers onboard via Express accounts (lower KYC burden on platform)
4. **Seller-as-tenant model** — each seller can also have own back-office (lite version of tenant admin)
5. **Quality enforcement automation** — performance metrics (fulfillment time, dispute rate, return rate) → automatic seller tier adjustment
6. **Dispute resolution workflow** — structured mediation, not ad-hoc support
7. **Marketplace + own products coexist** — platform owner can also sell own products alongside third-party sellers

---

## 1. References

- [03 §16](03-data-models-master.md#16-marketplace-multi-vendor) — ENT-SELLER-001, ENT-SELLER-PRODUCT-001, ENT-PAYOUT-001
- [06-catalog-pim.md](06-catalog-pim.md) — products with seller_id link
- [09-inventory.md](09-inventory.md) — per-seller inventory (each seller has own warehouses)
- [10-pricing-promotions.md](10-pricing-promotions.md) — seller-set pricing
- [13-payments.md](13-payments.md) — Stripe Connect, payment splits
- [14-shipping.md](14-shipping.md) — seller-managed shipping methods
- [15-tax-compliance.md](15-tax-compliance.md) — marketplace facilitator tax, IOSS, OSS
- [16-order-management.md](16-order-management.md) — multi-vendor order splits
- [17-returns-refunds.md](17-returns-refunds.md) — returns to seller
- [18-customer-management.md](18-customer-management.md) — buyer + seller user accounts
- [19-marketing-seo.md](19-marketing-seo.md) — seller-managed promotions
- [20-analytics-reporting.md](20-analytics-reporting.md) — marketplace + per-seller analytics
- [22-multistore-channels.md](22-multistore-channels.md) — marketplace as channel kind
- [29-integrations.md](29-integrations.md) — Stripe Connect, KYC providers (Persona, Onfido)
- [30-security.md](30-security.md) — fraud, dispute audit
- [DEC-ARCH-001](01-decisions-registry.md#dec-arch-001-single-codebase-vs-separate-products) — single codebase
- [DEC-PAY-001](01-decisions-registry.md#dec-pay-001-payment-provider-strategy) — Stripe primary
- EU VAT for marketplaces (2021 DAC7 + IOSS)
- US marketplace facilitator laws (per state)
- UK marketplace VAT rules (post-Brexit)
- Stripe Connect documentation (Express + Custom + Standard accounts)

---

## 2. Personas

| Persona | Použití | Klíčové permissions |
|---|---|---|
| `PERSONA-MARKETPLACE-OPERATOR` | Platform tenant owner; configures marketplace, sets commission, mediates disputes | `PERM-MARKETPLACE-*` |
| `PERSONA-MARKETPLACE-CATEGORY-MANAGER` | Manages specific categories, vets seller listings | `PERM-MARKETPLACE-CATEGORY-MANAGE` |
| `PERSONA-DISPUTE-MEDIATOR` | Resolves buyer-seller disputes | `PERM-MARKETPLACE-DISPUTE-RESOLVE` |
| `PERSONA-FINANCE-MANAGER` | Payouts, commission reports, settlement | `PERM-MARKETPLACE-PAYOUT-*` |
| `PERSONA-COMPLIANCE-OFFICER` | KYC review, regulatory audits, sanctions | `PERM-MARKETPLACE-COMPLIANCE-*` |
| `PERSONA-SELLER` (third-party vendor) | Own catalog, orders, payouts, dashboard | `PERM-SELLER-OWN-*` (scoped to own seller_id) |
| `PERSONA-SELLER-EMPLOYEE` | Works for seller; limited actions | Seller role: 'admin','staff','viewer' |
| `PERSONA-CUSTOMER` | Buys from marketplace; rates sellers; opens disputes | None explicit |
| `PERSONA-CUSTOMER-SERVICE` | Helps buyer + facilitates seller communication | `PERM-MARKETPLACE-SUPPORT` |
| `PERSONA-AI-COPILOT` | Seller performance signals, listing quality checks | `agent:marketplace:read` |

---

## 3. Data models

### 3.1 `sellers` ([ENT-SELLER-001](03-data-models-master.md#ent-seller-001))

```sql
CREATE TABLE sellers (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),                                                    -- the marketplace platform tenant
  pub_id TEXT NOT NULL,                                                                              -- slr_ NanoID
  number TEXT NOT NULL,                                                                              -- "SLR-2026-00000123"
  slug TEXT NOT NULL,                                                                                -- URL-safe (seller's storefront page)
  -- identity
  legal_entity_name TEXT NOT NULL,
  display_name TEXT NOT NULL,                                                                        -- shown to buyers
  description TEXT NULL,
  logo_media_id UUID NULL REFERENCES media(id),
  banner_media_id UUID NULL REFERENCES media(id),
  primary_contact_customer_id UUID NULL REFERENCES customers(id),                                    -- seller's owner account
  -- registration
  registration_number TEXT NOT NULL,                                                                  -- IČO / equivalent
  vat_id TEXT NULL,
  country_code CHAR(2) NOT NULL,
  industry_category_code TEXT NULL,
  legal_address_id UUID NULL REFERENCES addresses(id),
  -- contact
  contact_email CITEXT NOT NULL,
  contact_phone TEXT NULL,
  support_email CITEXT NULL,
  support_url TEXT NULL,
  -- status
  status TEXT NOT NULL CHECK (status IN ('pending_application','under_review','verified','active','suspended','closed','rejected')) DEFAULT 'pending_application',
  status_entered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  rejected_reason TEXT NULL,
  suspended_reason TEXT NULL,
  -- commission
  commission_kind TEXT NOT NULL CHECK (commission_kind IN ('flat_percent','tiered','per_category','custom')) DEFAULT 'flat_percent',
  commission_percent_basis_points INTEGER NULL,                                                         -- e.g., 1500 = 15.00%
  commission_currency CHAR(3) NULL,
  commission_minimum_amount BIGINT NULL,                                                                 -- minimum platform fee
  commission_config JSONB NULL,                                                                          -- pro tiered/per_category
  -- payouts
  stripe_connect_account_id TEXT NULL,
  stripe_connect_account_type TEXT NULL CHECK (stripe_connect_account_type IN ('express','custom','standard') OR stripe_connect_account_type IS NULL),
  stripe_connect_charges_enabled BOOLEAN NOT NULL DEFAULT false,
  stripe_connect_payouts_enabled BOOLEAN NOT NULL DEFAULT false,
  payout_schedule_kind TEXT NOT NULL CHECK (payout_schedule_kind IN ('daily','weekly','biweekly','monthly','manual')) DEFAULT 'weekly',
  payout_currency CHAR(3) NULL,
  next_scheduled_payout_at TIMESTAMPTZ NULL,
  pending_balance_amount BIGINT NOT NULL DEFAULT 0,                                                       -- accumulated since last payout
  pending_balance_currency CHAR(3) NULL,
  -- bank info (optional alternative to Stripe Connect)
  bank_account_iban TEXT NULL,                                                                            -- encrypted
  bank_account_swift TEXT NULL,
  bank_account_holder TEXT NULL,
  -- KYC
  kyc_status TEXT NOT NULL CHECK (kyc_status IN ('not_started','in_progress','approved','rejected','requires_more_info')) DEFAULT 'not_started',
  kyc_provider TEXT NULL CHECK (kyc_provider IN ('persona','onfido','stripe_identity','manual') OR kyc_provider IS NULL),
  kyc_provider_session_id TEXT NULL,
  kyc_completed_at TIMESTAMPTZ NULL,
  kyc_documents JSONB NULL,                                                                                -- references to encrypted document IDs
  beneficial_owners JSONB NULL,                                                                            -- per EU AML rules (>25% ownership)
  -- contracts
  signed_terms_version TEXT NULL,
  signed_terms_at TIMESTAMPTZ NULL,
  signed_terms_ip_hash TEXT NULL,
  contract_media_id UUID NULL REFERENCES media(id),
  -- tier
  tier TEXT NULL CHECK (tier IN ('platinum','gold','silver','bronze','probation') OR tier IS NULL) DEFAULT 'bronze',
  tier_assigned_at TIMESTAMPTZ NULL,
  -- performance metrics (computed regularly)
  total_orders_fulfilled INTEGER NOT NULL DEFAULT 0,
  total_revenue_amount BIGINT NOT NULL DEFAULT 0,
  total_commission_paid_amount BIGINT NOT NULL DEFAULT 0,
  avg_rating NUMERIC(3,2) NULL,                                                                            -- 1.00 - 5.00
  rating_count INTEGER NOT NULL DEFAULT 0,
  fulfillment_sla_compliance_percent NUMERIC(5,2) NULL,                                                     -- % of orders shipped on time
  cancellation_rate_percent NUMERIC(5,2) NULL,
  return_rate_percent NUMERIC(5,2) NULL,
  dispute_rate_percent NUMERIC(5,2) NULL,
  avg_response_time_hours NUMERIC(8,2) NULL,
  -- catalog
  total_active_listings INTEGER NOT NULL DEFAULT 0,
  catalog_visibility_kind TEXT NOT NULL CHECK (catalog_visibility_kind IN ('full','sponsored','featured','restricted')) DEFAULT 'full',
  -- storefront
  storefront_url_path TEXT NOT NULL,                                                                        -- "/sellers/{slug}"
  storefront_theme_id UUID NULL,
  storefront_settings JSONB NULL,
  -- supported regions
  ships_to_country_codes CHAR(2)[] NOT NULL DEFAULT '{}',
  primary_shipping_origin_country_code CHAR(2) NOT NULL,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at TIMESTAMPTZ NULL,
  account_manager_user_id UUID NULL REFERENCES users(id),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_sellers_pub_id UNIQUE (tenant_id, pub_id),
  CONSTRAINT uq_sellers_number UNIQUE (tenant_id, number),
  CONSTRAINT uq_sellers_slug UNIQUE (tenant_id, slug),
  CONSTRAINT uq_sellers_stripe_connect UNIQUE (stripe_connect_account_id) DEFERRABLE INITIALLY IMMEDIATE
);

CREATE INDEX idx_sellers_status ON sellers (tenant_id, status) WHERE status IN ('active','under_review');
CREATE INDEX idx_sellers_tier ON sellers (tenant_id, tier);
CREATE INDEX idx_sellers_pending_kyc ON sellers (tenant_id) WHERE kyc_status IN ('in_progress','requires_more_info');
CREATE INDEX idx_sellers_pending_payout ON sellers (next_scheduled_payout_at) WHERE status = 'active' AND pending_balance_amount > 0;
CREATE INDEX idx_sellers_primary_contact ON sellers (primary_contact_customer_id) WHERE primary_contact_customer_id IS NOT NULL;
```

### 3.2 `seller_members`

Seller's team members (akin to `company_members` for B2B).

```sql
CREATE TABLE seller_members (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner','admin','staff','viewer','support','finance')),
  permissions_override TEXT[] NULL,                                                                            -- granular
  invited_at TIMESTAMPTZ NULL,
  joined_at TIMESTAMPTZ NULL,
  invited_by_customer_id UUID NULL REFERENCES customers(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_seller_members UNIQUE (seller_id, customer_id)
);

CREATE INDEX idx_seller_members_seller ON seller_members (seller_id) WHERE is_active = true;
CREATE INDEX idx_seller_members_customer ON seller_members (customer_id) WHERE is_active = true;
```

### 3.3 `seller_products` ([ENT-SELLER-PRODUCT-001](03-data-models-master.md#ent-seller-product-001))

Linking products to sellers. A product (`products` table) may be owned by exactly 1 seller (in marketplace mode) OR the platform tenant (own products).

```sql
ALTER TABLE products
  ADD COLUMN seller_id UUID NULL REFERENCES sellers(id),                                                       -- NULL = platform-owned
  ADD COLUMN is_marketplace_listing BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_products_seller ON products (seller_id) WHERE seller_id IS NOT NULL;
CREATE INDEX idx_products_marketplace ON products (tenant_id) WHERE is_marketplace_listing = true;
```

Additional seller-specific config:

```sql
CREATE TABLE seller_product_settings (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  -- listing
  is_active_in_marketplace BOOLEAN NOT NULL DEFAULT true,
  listing_status TEXT NOT NULL CHECK (listing_status IN ('draft','pending_review','approved','rejected','suspended','withdrawn')) DEFAULT 'pending_review',
  listing_status_changed_at TIMESTAMPTZ NULL,
  listing_review_notes TEXT NULL,
  -- commission override
  commission_override_percent_basis_points INTEGER NULL,                                                         -- per-product override
  -- ranking signals
  seller_rank_boost INTEGER NOT NULL DEFAULT 0,                                                                  -- seller-paid promotion (sponsored listing)
  is_sponsored BOOLEAN NOT NULL DEFAULT false,
  sponsored_until TIMESTAMPTZ NULL,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_seller_product_settings UNIQUE (product_id)
);

CREATE INDEX idx_seller_product_settings_seller ON seller_product_settings (seller_id, listing_status);
CREATE INDEX idx_seller_product_settings_pending ON seller_product_settings (tenant_id, created_at) WHERE listing_status = 'pending_review';
```

### 3.4 Order splits

When buyer cart contains items from multiple sellers, single checkout creates parent order + child orders per seller:

```sql
ALTER TABLE orders
  ADD COLUMN parent_marketplace_order_id UUID NULL REFERENCES orders(id),                                       -- child order linking
  ADD COLUMN marketplace_seller_id UUID NULL REFERENCES sellers(id),                                            -- which seller fulfills this order
  ADD COLUMN marketplace_commission_amount BIGINT NULL,                                                          -- platform's cut
  ADD COLUMN marketplace_commission_currency CHAR(3) NULL,
  ADD COLUMN marketplace_seller_payout_amount BIGINT NULL;                                                       -- net to seller

CREATE INDEX idx_orders_marketplace_seller ON orders (marketplace_seller_id) WHERE marketplace_seller_id IS NOT NULL;
CREATE INDEX idx_orders_parent_marketplace ON orders (parent_marketplace_order_id) WHERE parent_marketplace_order_id IS NOT NULL;
```

Pattern:
- **Parent order**: `marketplace_seller_id=NULL`, contains payment record, customer-facing single order
- **Child orders**: one per seller, each `parent_marketplace_order_id=parent.id`, `marketplace_seller_id` set, contains items from that seller, has its own fulfillment lifecycle

### 3.5 `seller_payouts` ([ENT-PAYOUT-001](03-data-models-master.md#ent-payout-001))

Periodic seller payouts.

```sql
CREATE TABLE seller_payouts (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  seller_id UUID NOT NULL REFERENCES sellers(id),
  pub_id TEXT NOT NULL,                                                                                          -- pyo_ NanoID
  number TEXT NOT NULL,                                                                                          -- "PYO-2026-00000123"
  -- amounts
  currency CHAR(3) NOT NULL,
  gross_sales_amount BIGINT NOT NULL,                                                                            -- sum of seller orders in period
  commission_amount BIGINT NOT NULL,                                                                              -- platform's take
  refunds_amount BIGINT NOT NULL DEFAULT 0,                                                                       -- refunds since last payout
  chargebacks_amount BIGINT NOT NULL DEFAULT 0,
  adjustments_amount BIGINT NOT NULL DEFAULT 0,                                                                    -- manual corrections
  net_payout_amount BIGINT NOT NULL,                                                                                -- final amount to seller
  -- period
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  -- status
  status TEXT NOT NULL CHECK (status IN ('pending','processing','paid','failed','cancelled','on_hold')) DEFAULT 'pending',
  status_entered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  hold_reason TEXT NULL,
  -- provider
  payout_provider TEXT NOT NULL DEFAULT 'stripe_connect',
  provider_payout_id TEXT NULL,                                                                                   -- Stripe payout ID
  provider_transfer_id TEXT NULL,                                                                                  -- Stripe transfer ID
  -- timing
  scheduled_at TIMESTAMPTZ NOT NULL,
  attempted_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  failed_at TIMESTAMPTZ NULL,
  failure_reason TEXT NULL,
  -- documents
  statement_pdf_media_id UUID NULL REFERENCES media(id),
  invoice_from_seller_media_id UUID NULL REFERENCES media(id),                                                     -- if seller invoices platform
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_seller_payouts_pub_id UNIQUE (tenant_id, pub_id),
  CONSTRAINT uq_seller_payouts_number UNIQUE (tenant_id, number)
);

CREATE INDEX idx_seller_payouts_seller ON seller_payouts (seller_id, created_at DESC);
CREATE INDEX idx_seller_payouts_status ON seller_payouts (tenant_id, status, scheduled_at);
CREATE INDEX idx_seller_payouts_pending ON seller_payouts (scheduled_at) WHERE status = 'pending';
```

### 3.6 `seller_payout_line_items`

Detail per payout — which orders contribute.

```sql
CREATE TABLE seller_payout_line_items (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  payout_id UUID NOT NULL REFERENCES seller_payouts(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id),
  kind TEXT NOT NULL CHECK (kind IN ('sale','refund','chargeback','adjustment','correction')),
  gross_amount BIGINT NOT NULL,
  commission_amount BIGINT NOT NULL DEFAULT 0,
  net_amount BIGINT NOT NULL,
  currency CHAR(3) NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  notes TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_seller_payout_line_items_payout ON seller_payout_line_items (payout_id);
CREATE INDEX idx_seller_payout_line_items_order ON seller_payout_line_items (order_id);
```

### 3.7 `seller_reviews`

Customer reviews of sellers (separate from product reviews).

```sql
CREATE TABLE seller_reviews (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  pub_id TEXT NOT NULL,
  seller_id UUID NOT NULL REFERENCES sellers(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  order_id UUID NOT NULL REFERENCES orders(id),                                                                    -- linked order required (verified purchase)
  -- ratings (1-5 across multiple dimensions)
  overall_rating INTEGER NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  shipping_speed_rating INTEGER NULL CHECK (shipping_speed_rating BETWEEN 1 AND 5),
  communication_rating INTEGER NULL CHECK (communication_rating BETWEEN 1 AND 5),
  product_accuracy_rating INTEGER NULL CHECK (product_accuracy_rating BETWEEN 1 AND 5),
  packaging_rating INTEGER NULL CHECK (packaging_rating BETWEEN 1 AND 5),
  -- content
  title TEXT NULL,
  body TEXT NULL,
  media_ids UUID[] NULL,
  -- moderation
  status TEXT NOT NULL CHECK (status IN ('pending_moderation','approved','rejected','hidden')) DEFAULT 'approved',  -- auto-approved by default; flagged for review only if abuse signals
  moderation_notes TEXT NULL,
  -- seller response
  seller_response TEXT NULL,
  seller_response_at TIMESTAMPTZ NULL,
  -- helpful votes
  helpful_count INTEGER NOT NULL DEFAULT 0,
  not_helpful_count INTEGER NOT NULL DEFAULT 0,
  reported_count INTEGER NOT NULL DEFAULT 0,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_seller_reviews_unique UNIQUE (seller_id, customer_id, order_id),
  CONSTRAINT uq_seller_reviews_pub_id UNIQUE (tenant_id, pub_id)
);

CREATE INDEX idx_seller_reviews_seller ON seller_reviews (seller_id, status, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_seller_reviews_customer ON seller_reviews (customer_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_seller_reviews_pending ON seller_reviews (tenant_id, created_at) WHERE status = 'pending_moderation' AND deleted_at IS NULL;
```

### 3.8 `marketplace_disputes`

Buyer-seller disputes mediated by platform.

```sql
CREATE TABLE marketplace_disputes (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  pub_id TEXT NOT NULL,                                                                                            -- dsp_ NanoID
  number TEXT NOT NULL,
  order_id UUID NOT NULL REFERENCES orders(id),
  buyer_customer_id UUID NOT NULL REFERENCES customers(id),
  seller_id UUID NOT NULL REFERENCES sellers(id),
  -- dispute type
  dispute_kind TEXT NOT NULL CHECK (dispute_kind IN (
    'item_not_received','item_significantly_not_as_described','damage_in_transit',
    'wrong_item','missing_parts','counterfeit','refund_not_received',
    'communication_breakdown','quality_issue','other'
  )),
  reason TEXT NOT NULL,
  buyer_evidence_media_ids UUID[] NULL,
  -- status
  status TEXT NOT NULL CHECK (status IN ('opened','awaiting_seller_response','seller_responded','platform_review','escalated','resolved','closed')) DEFAULT 'opened',
  status_entered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- resolution
  outcome TEXT NULL CHECK (outcome IN ('refund_full','refund_partial','replacement','no_action','split_decision','seller_warning','seller_suspended') OR outcome IS NULL),
  outcome_notes TEXT NULL,
  refund_amount BIGINT NULL,
  refund_currency CHAR(3) NULL,
  -- mediation
  assigned_mediator_user_id UUID NULL REFERENCES users(id),
  mediator_notes TEXT NULL,
  -- timing
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  seller_response_deadline TIMESTAMPTZ NULL,
  seller_responded_at TIMESTAMPTZ NULL,
  escalated_at TIMESTAMPTZ NULL,
  resolved_at TIMESTAMPTZ NULL,
  closed_at TIMESTAMPTZ NULL,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_marketplace_disputes_pub_id UNIQUE (tenant_id, pub_id),
  CONSTRAINT uq_marketplace_disputes_number UNIQUE (tenant_id, number)
);

CREATE INDEX idx_marketplace_disputes_status ON marketplace_disputes (tenant_id, status, opened_at DESC);
CREATE INDEX idx_marketplace_disputes_seller ON marketplace_disputes (seller_id, opened_at DESC);
CREATE INDEX idx_marketplace_disputes_buyer ON marketplace_disputes (buyer_customer_id, opened_at DESC);
CREATE INDEX idx_marketplace_disputes_pending ON marketplace_disputes (tenant_id, seller_response_deadline) WHERE status = 'awaiting_seller_response';
CREATE INDEX idx_marketplace_disputes_review ON marketplace_disputes (tenant_id, opened_at) WHERE status = 'platform_review';
```

### 3.9 `marketplace_dispute_messages`

Thread of dispute communication.

```sql
CREATE TABLE marketplace_dispute_messages (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  dispute_id UUID NOT NULL REFERENCES marketplace_disputes(id) ON DELETE CASCADE,
  author_kind TEXT NOT NULL CHECK (author_kind IN ('buyer','seller','platform','system')),
  author_customer_id UUID NULL,
  author_user_id UUID NULL,
  body TEXT NOT NULL,
  attachments_media_ids UUID[] NULL,
  is_internal BOOLEAN NOT NULL DEFAULT false,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_marketplace_dispute_messages_dispute ON marketplace_dispute_messages (dispute_id, occurred_at);
```

### 3.10 `seller_buyer_messages`

Platform-mediated buyer-seller communications (audited).

```sql
CREATE TABLE seller_buyer_messages (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  seller_id UUID NOT NULL REFERENCES sellers(id),
  buyer_customer_id UUID NOT NULL REFERENCES customers(id),
  order_id UUID NULL REFERENCES orders(id),                                                                        -- if order-related
  thread_id UUID NOT NULL,                                                                                          -- groups messages
  author_kind TEXT NOT NULL CHECK (author_kind IN ('buyer','seller','platform')),
  body TEXT NOT NULL,
  attachments_media_ids UUID[] NULL,
  is_read_by_recipient BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- audit
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
) PARTITION BY RANGE (occurred_at);

CREATE INDEX idx_seller_buyer_messages_thread ON seller_buyer_messages (thread_id, occurred_at);
CREATE INDEX idx_seller_buyer_messages_unread_buyer ON seller_buyer_messages (buyer_customer_id) WHERE is_read_by_recipient = false AND author_kind = 'seller';
CREATE INDEX idx_seller_buyer_messages_unread_seller ON seller_buyer_messages (seller_id) WHERE is_read_by_recipient = false AND author_kind = 'buyer';
```

### 3.11 `seller_performance_snapshots`

Daily performance metrics (basis for tier assignments + buyer trust signals).

```sql
CREATE TABLE seller_performance_snapshots (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  seller_id UUID NOT NULL REFERENCES sellers(id),
  snapshot_date DATE NOT NULL,
  -- volume metrics
  orders_received INTEGER NOT NULL DEFAULT 0,
  orders_fulfilled INTEGER NOT NULL DEFAULT 0,
  orders_cancelled INTEGER NOT NULL DEFAULT 0,
  orders_refunded INTEGER NOT NULL DEFAULT 0,
  gross_revenue_amount BIGINT NOT NULL DEFAULT 0,
  net_revenue_amount BIGINT NOT NULL DEFAULT 0,                                                                       -- after refunds + chargebacks
  -- quality metrics (rolling 30/90 day windows precomputed)
  avg_rating_30d NUMERIC(3,2) NULL,
  rating_count_30d INTEGER NOT NULL DEFAULT 0,
  fulfillment_sla_compliance_30d_percent NUMERIC(5,2) NULL,
  cancellation_rate_30d_percent NUMERIC(5,2) NULL,
  return_rate_30d_percent NUMERIC(5,2) NULL,
  dispute_rate_30d_percent NUMERIC(5,2) NULL,
  open_disputes_count INTEGER NOT NULL DEFAULT 0,
  avg_response_time_30d_hours NUMERIC(8,2) NULL,
  late_shipment_count_30d INTEGER NOT NULL DEFAULT 0,
  -- listing
  active_listings_count INTEGER NOT NULL DEFAULT 0,
  policy_violations_count_30d INTEGER NOT NULL DEFAULT 0,
  -- computed score
  performance_score NUMERIC(5,2) NULL,                                                                                 -- 0-100 composite
  recommended_tier TEXT NULL,
  -- audit
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_seller_performance_snapshots UNIQUE (seller_id, snapshot_date)
);

CREATE INDEX idx_seller_performance_snapshots_seller ON seller_performance_snapshots (seller_id, snapshot_date DESC);
```

### 3.12 `marketplace_policies`

Rules sellers must follow.

```sql
CREATE TABLE marketplace_policies (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  code TEXT NOT NULL,                                                                                                   -- 'prohibited_items','quality_standards','shipping_sla','communication','intellectual_property'
  title TEXT NOT NULL,
  description_html TEXT NOT NULL,
  severity_kind TEXT NOT NULL CHECK (severity_kind IN ('warning','minor','major','critical')) DEFAULT 'minor',
  consequences TEXT NULL,                                                                                                -- "First offense: warning. Repeat: suspension."
  effective_from DATE NOT NULL DEFAULT now()::date,
  effective_until DATE NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  applies_to_country_codes CHAR(2)[] NULL,                                                                                -- NULL = all
  applies_to_category_codes TEXT[] NULL,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_marketplace_policies_code UNIQUE (tenant_id, code)
);
```

### 3.13 `seller_policy_violations`

Recorded breaches.

```sql
CREATE TABLE seller_policy_violations (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  seller_id UUID NOT NULL REFERENCES sellers(id),
  policy_id UUID NOT NULL REFERENCES marketplace_policies(id),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  detection_kind TEXT NOT NULL CHECK (detection_kind IN ('automated','reported_by_buyer','reported_by_competitor','spot_check','dispute_outcome')),
  related_order_id UUID NULL REFERENCES orders(id),
  related_product_id UUID NULL REFERENCES products(id),
  related_dispute_id UUID NULL REFERENCES marketplace_disputes(id),
  evidence_media_ids UUID[] NULL,
  description TEXT NOT NULL,
  -- outcome
  outcome TEXT NULL CHECK (outcome IN ('warning_issued','listing_removed','seller_suspended','seller_closed','dismissed','no_action') OR outcome IS NULL),
  outcome_notes TEXT NULL,
  outcome_decided_by_user_id UUID NULL,
  outcome_decided_at TIMESTAMPTZ NULL,
  -- audit
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_seller_policy_violations_seller ON seller_policy_violations (seller_id, detected_at DESC);
CREATE INDEX idx_seller_policy_violations_open ON seller_policy_violations (tenant_id, detected_at) WHERE outcome IS NULL;
```

### 3.14 Vztahy

```
tenants (1)──(N) sellers
sellers (1)──(N) seller_members
sellers (1)──(N) products                                                                                                 [seller_id FK]
sellers (1)──(N) seller_product_settings
sellers (1)──(N) orders                                                                                                    [marketplace_seller_id]
sellers (1)──(N) seller_payouts
sellers (1)──(N) seller_payout_line_items
sellers (1)──(N) seller_reviews
sellers (1)──(N) marketplace_disputes
sellers (1)──(N) seller_buyer_messages
sellers (1)──(N) seller_performance_snapshots
sellers (1)──(N) seller_policy_violations
products (1)──(0..1) sellers                                                                                                [via seller_id]
orders (0..1)──(1) orders                                                                                                   [parent_marketplace_order_id]
customers (1)──(N) seller_reviews                                                                                          [as buyer]
customers (1)──(N) marketplace_disputes                                                                                    [as buyer]
customers (1)──(N) seller_members                                                                                          [as seller employee]
```

---

## 4. Seller onboarding

### 4.1 Application flow

```
[Prospective seller visits marketplace registration page]
   ▼
Step 1: Initial info
   - Legal entity name
   - Country
   - Industry category
   - Email + phone
   - Description
   ▼
[Sellers row created status='pending_application']
   ▼
Step 2: Verify email + identity
   - Email verification
   - Phone verification (optional)
   ▼
[status='under_review']
   ▼
Step 3: KYC documents upload
   - Business registration (CZ: výpis z OR)
   - VAT registration (if applicable)
   - Bank account info OR Stripe Connect signup
   - Beneficial owner declaration (per EU AML)
   - Government-issued ID of primary contact
   ▼
Step 4: KYC verification
   - Via Persona, Onfido, or manual review
   - kyc_status='in_progress' → 'approved' or 'rejected'
   ▼
Step 5: Sign marketplace terms
   - Electronic signature
   - signed_terms_at recorded
   - Audit IP hash
   ▼
Step 6: Banking setup
   - Stripe Connect Express account creation
   - OR manual bank account input + encrypted
   - stripe_connect_charges_enabled becomes true
   - stripe_connect_payouts_enabled becomes true
   ▼
Step 7: Initial commission tier negotiation
   - Default: 15% commission, 'bronze' tier
   - Negotiable for enterprise sellers (manual)
   ▼
Step 8: Storefront setup
   - Slug for /sellers/{slug}
   - Logo + banner upload
   - Description
   ▼
[Admin reviews + approves]
   ▼
[status='active' → seller can list products]
```

### 4.2 KYC compliance

Required by EU AML (Anti-Money Laundering) directive:
- Identity verification for primary contact (passport/ID)
- Business registration proof
- Beneficial ownership disclosure (>25% ownership)
- Sanctions screening (OFAC, EU sanctions list)
- Tax ID validation
- Country-specific requirements (US: SSN/EIN; UK: Companies House lookup)

KYC providers (per tenant choice):
- **Persona** — modern, EU-friendly
- **Onfido** — established
- **Stripe Identity** — bundled with Stripe Connect
- **Manual** — admin review (fallback)

### 4.3 Stripe Connect Express setup

```
Platform creates Stripe Connect account for seller:
   provider.connect.accounts.create({
     type: 'express',
     country: seller.country_code,
     email: seller.contact_email,
     capabilities: { card_payments: { requested: true }, transfers: { requested: true }},
     business_type: 'company',
     company: { name: seller.legal_entity_name, tax_id: seller.registration_number, ...},
     metadata: { tenant_id, seller_id }
   })

Stripe returns onboarding URL:
   provider.connect.accountLinks.create({
     account: stripe_connect_account_id,
     refresh_url: tenant.url + '/sellers/onboarding-refresh',
     return_url: tenant.url + '/sellers/onboarding-complete',
     type: 'account_onboarding'
   })

Seller completes Stripe-hosted onboarding (KYC done by Stripe).
Webhook fires when complete: account.updated with charges_enabled=true, payouts_enabled=true.
```

### 4.4 Seller account dashboard access

Seller logs in via standard customer auth (per `18-customer-management.md`). If linked to seller via `seller_members`, seller-specific UI accessible.

Role-based:
- `owner`: full control
- `admin`: most actions
- `staff`: limited (order fulfillment, customer support)
- `viewer`: read-only
- `support`: customer service for own listings
- `finance`: payouts + reports

---

## 5. Marketplace order flow

### 5.1 Multi-vendor cart

Customer adds items from multiple sellers:
- Cart shows items grouped by seller (visual separator)
- Per-seller subtotal
- Per-seller shipping cost (each seller may use different carrier/rate)
- Single grand total
- Single checkout

### 5.2 Order splitting at checkout

```
[Customer completes checkout with multi-vendor cart]
   ▼
Backend creates:
   1. Parent order (orders row): marketplace_seller_id=NULL, contains payment record, total amount
   2. Child orders: one per seller, marketplace_seller_id=<seller>, parent_marketplace_order_id=<parent>
      - Items filtered to this seller's items
      - Shipping address inherited
      - Billing address inherited
      - Shipping method per seller's selection
      - Tax computed per seller's tax jurisdiction
   ▼
Payment captured against parent order (single charge to customer)
   ▼
Stripe Connect transfers per seller (after commission deduction):
   provider.transfers.create({
     amount: child_order.marketplace_seller_payout_amount,
     currency: child_order.currency,
     destination: seller.stripe_connect_account_id,
     source_transaction: parent_order.payment.provider_charge_id,
     metadata: { order_id: child_order.id }
   })
   ▼
Each seller sees their child order in dashboard, fulfills independently
```

### 5.3 Fulfillment per seller

Each child order has own:
- Fulfillment status (per `16-order-management.md`)
- Shipments (each seller ships separately, may use different carrier)
- Tracking numbers
- Invoices (per seller — separate VAT invoices for compliance, per `15-tax-compliance.md`)

Parent order:
- Customer view: single order with multiple "shipments from different sellers"
- `fulfillment_status` = aggregate of child orders (`unfulfilled` until all shipped, `fulfilled` when all delivered)

### 5.4 Tax computation per seller

Each seller has own:
- VAT registration (or not)
- Tax jurisdiction (country)
- Reverse charge rules (B2B intra-EU)

Marketplace facilitator rules:
- **EU**: For non-EU sellers selling EU consumers, marketplace may be deemed seller for VAT (IOSS scheme for goods <€150)
- **UK**: Marketplace responsible for VAT on overseas seller sales to UK consumers
- **US**: Marketplace facilitator laws require platform to collect sales tax on behalf of small sellers in many states

Detail per `15-tax-compliance.md` extended (Fáze 4).

### 5.5 Customer experience

Customer sees:
- Single cart with seller groupings
- Single checkout, single payment
- Confirmation email lists items per seller
- Order tracking shows aggregated status + per-seller shipments
- Returns initiated per item → routed to correct seller

---

## 6. Commission & payouts

### 6.1 Commission calculation

Per child order:
```
commission_amount = order.subtotal_amount × commission_percent / 10000
                    + flat_fee_per_order (if any)

commission_amount = MAX(commission_amount, seller.commission_minimum_amount)

seller_payout_amount = order.subtotal_amount + shipping_amount + tax_amount - commission_amount
                       (tax handling depends on marketplace facilitator rules)
```

Stored at order placement in `orders.marketplace_commission_amount` + `marketplace_seller_payout_amount`.

### 6.2 Tiered commission

`commission_kind='tiered'`:
```jsonc
{
  "tiers": [
    { "up_to_amount": 100000, "percent": 1500 },     // 15% up to first 1000 CZK
    { "up_to_amount": 1000000, "percent": 1200 },    // 12% up to 10000 CZK
    { "up_to_amount": null, "percent": 1000 }         // 10% beyond
  ]
}
```

### 6.3 Per-category commission

`commission_kind='per_category'`:
```jsonc
{
  "category_overrides": {
    "electronics": 800,                              // 8%
    "fashion": 1500,                                  // 15%
    "default": 1200
  }
}
```

### 6.4 Payout schedule

Per `sellers.payout_schedule_kind`:
- `daily`: every business day
- `weekly`: every Monday for previous week
- `biweekly`: every other Monday
- `monthly`: 1st of month for previous month
- `manual`: admin triggers ad-hoc

Hold periods: each order's earnings held for `tenant.settings.marketplace_payout_hold_days` (default 14 days, EU cooling-off period) before included in payout.

### 6.5 Payout execution

```
JOB-EXECUTE-SELLER-PAYOUT runs at scheduled_at:
  1. Compute payout: sum of seller's settled order earnings since last payout
  2. Subtract refunds + chargebacks
  3. Subtract adjustments
  4. Net amount calculated
  5. Insert seller_payouts row (status='processing')
  6. Insert seller_payout_line_items per contributing order
  7. Create Stripe transfer (or bank transfer if manual)
  8. On success: status='paid', completed_at; PDF statement generated
  9. On fail: status='failed', failure_reason; admin alerted
  10. Email seller with statement
```

### 6.6 Reserved balance

Stripe Connect may hold reserved balance for risk (chargebacks, refunds). Sellers see:
- Available balance
- Pending balance (cleared after hold period)
- Reserved balance (risk reserve)

### 6.7 Multi-currency payouts

Stripe Connect handles FX. Tenant can configure:
- Seller paid in own currency (Stripe converts)
- Seller paid in platform currency (no conversion)

Per-seller setting.

### 6.8 Payout failures

Common causes:
- Bank account invalid
- Compliance hold (KYC re-verification needed)
- Provider service outage

Retry policy + admin notification.

---

## 7. State machines

### 7.1 Seller status

```
pending_application → under_review → verified ↘
                                      kyc_rejected → rejected
                                                                 ↘
                                                                  active ↔ suspended
                                                                    ↓
                                                                  closed (terminal)
```

### 7.2 Seller payout

```
pending → processing → paid
                     → failed
                     → cancelled
                     → on_hold (manual override)
```

### 7.3 Marketplace dispute

```
opened → awaiting_seller_response → seller_responded → platform_review → resolved → closed
                                                            ↓
                                                       escalated → resolved → closed
```

### 7.4 Listing status

```
draft → pending_review → approved ↘
                       → rejected   → withdrawn / suspended
```

---

## 8. Business rules

### RULE-MKT-001: Marketplace mode toggle

Tenant activates marketplace via `tenant.settings.marketplace_mode=true`. Enables:
- Seller registration page
- Multi-vendor cart UX
- Order splitting
- Payout system
- Dispute resolution

Cannot deactivate while active sellers exist.

### RULE-MKT-002: Seller verification before active

Seller cannot list products until:
- KYC approved
- Stripe Connect onboarded
- Marketplace terms signed
- Banking info verified

Enforced via state machine.

### RULE-MKT-003: Listing approval workflow

New product listings (sellers) go through:
- `draft` (seller editing)
- `pending_review` (submitted)
- `approved` (visible in marketplace) OR `rejected`

Per tenant policy: auto-approve trusted sellers, manual review new sellers.

Marketplace category manager reviews. Reasons for rejection: policy violation, low quality, suspicious pricing.

### RULE-MKT-004: Commission cannot exceed 100%

Sanity check: `commission_percent_basis_points <= 10000` (100%).

### RULE-MKT-005: Payout hold period

Settlement hold default 14 days (EU cooling-off). Configurable per tenant. Per-seller override allowed (e.g., established sellers with good track record: 7 days; new sellers: 30 days).

### RULE-MKT-006: Dispute response SLA

Seller must respond to dispute within `tenant.settings.marketplace_dispute_response_hours` (default 72 hours business hours).

After SLA:
- Dispute auto-escalates to platform review
- Performance metric updated (impacts tier)
- Seller notified

### RULE-MKT-007: Dispute outcome impact

- `refund_full` / `refund_partial`: triggers refund through `13-payments.md`, deducted from seller payout
- `replacement`: new order created (no charge), seller fulfills
- `no_action`: dismissed; no impact
- `seller_warning`: policy violation recorded
- `seller_suspended`: status → suspended, manual reinstatement required

### RULE-MKT-008: Seller tier auto-adjustment

`JOB-COMPUTE-SELLER-PERFORMANCE-DAILY` calculates composite score:

```
performance_score =
   0.30 × normalized(avg_rating_30d)
 + 0.20 × normalized(fulfillment_sla_compliance_30d_percent)
 + 0.15 × (100 - cancellation_rate_30d_percent)
 + 0.15 × (100 - return_rate_30d_percent)
 + 0.10 × (100 - dispute_rate_30d_percent)
 + 0.10 × normalized(rating_count_30d)                                                                                  // volume bonus
```

Tier thresholds (configurable):
- platinum: >= 90
- gold: 75-89
- silver: 60-74
- bronze: 40-59
- probation: < 40 (restrictions: limited new listings, frequent monitoring)

### RULE-MKT-009: Tier affects search ranking

Search ranking signals (per `08-search-filtering.md`):
- Product relevance (base)
- Seller tier (multiplier 0.85 - 1.15 based on tier)
- Sponsored listings (boost paid by seller)
- Stock availability

Bronze tier sellers don't dominate search; platinum get organic boost.

### RULE-MKT-010: Per-seller inventory

Each seller manages own inventory (per `09-inventory.md`):
- Seller has own warehouses (per RULE-MKT-014)
- Stock visible only to seller (and platform admin)
- Out-of-stock listings auto-hidden (configurable)

### RULE-MKT-011: Seller-managed pricing

Sellers set own prices. Marketplace policies:
- Min/max price ranges per category (optional)
- No price gouging (admin detection)
- Promotional discounts: seller can run own; respect platform-wide promos additively

### RULE-MKT-012: Marketplace prohibited items

`marketplace_policies` includes `prohibited_items`:
- Counterfeit goods
- Illegal items (per country)
- Regulated items (firearms, certain chemicals) — separate licensing
- Adult content (per platform policy)

AI-powered scanning of new listings (Fáze 4+).

### RULE-MKT-013: Seller communication via platform

Buyer-seller messages routed through platform (`seller_buyer_messages`). Reasons:
- Audit trail for disputes
- Prevent off-platform transactions
- Customer protection
- Spam prevention

Direct email/phone exchange forbidden (policy violation).

### RULE-MKT-014: Per-seller warehouses

Sellers have own warehouses (per `09-inventory.md` `warehouses.tenant_id` = platform tenant, but `metadata.seller_id` = seller). Sellers cannot see other sellers' inventory.

RLS reinforced for cross-seller isolation.

### RULE-MKT-015: Seller fulfillment SLA

Per tenant policy: `tenant.settings.marketplace_fulfillment_sla_hours` (default 48 business hours from order placement to shipment).

After SLA:
- Customer notified ("delayed")
- Seller performance metric impacted
- Multiple late shipments → tier downgrade

### RULE-MKT-016: Returns to seller

Returns routed to seller per `17-returns-refunds.md`:
- Return shipping label to seller's address
- Seller approves/rejects return
- Refund processed via Stripe Connect reverse transfer
- Adjustment in seller_payouts

### RULE-MKT-017: Tax invoices per seller

Each child order has own invoice issued by seller (not platform), for VAT purposes. Per `15-tax-compliance.md`:
- Seller's VAT info on invoice
- Customer can request invoice per seller
- Marketplace facilitator scenarios: platform may issue VAT invoice on seller's behalf (US states, UK, EU IOSS)

### RULE-MKT-018: Seller-managed promotions

Sellers can create discounts for own listings (per `10-pricing-promotions.md`):
- Scope: own products only
- Cannot exceed platform-wide rules
- Cost borne by seller (reduces their net payout)

### RULE-MKT-019: Customer reviews verified purchase

`seller_reviews.order_id` required — review must be linked to real order. Prevents fake reviews.

### RULE-MKT-020: Reported reviews

Reviews can be flagged by buyer or seller. Threshold (e.g., 5 reports) → `pending_moderation` → mediator reviews → approved/rejected/hidden.

### RULE-MKT-021: Seller can respond to reviews

Sellers can post one public response per review (`seller_response`). Cannot edit review itself, only their reply.

### RULE-MKT-022: Marketplace facilitator tax — EU

For platform-facilitated sales to EU consumers:
- Goods ≤ €150 from non-EU seller: IOSS — platform collects VAT on behalf
- Goods > €150 from non-EU seller: standard import duties, customer pays
- B2B intra-EU: reverse charge, seller's VAT ID required

Detail per `15-tax-compliance.md` extended (Fáze 4).

### RULE-MKT-023: Sanctions screening

`JOB-SANCTIONS-SCREEN-SELLERS` runs weekly:
- Check primary contact name + entity name vs OFAC, EU sanctions list
- Match: suspend seller, notify compliance officer

Required by EU AML directive.

### RULE-MKT-024: Seller cannot self-deal

Seller cannot buy own products (laundering risk). Detection:
- `orders.customer_id` linked to any `seller_members.customer_id` for same seller → flag
- Block at checkout time

### RULE-MKT-025: Beneficial ownership disclosure

EU AML directive: sellers must disclose beneficial owners (>25% ownership). Stored in `sellers.beneficial_owners` JSONB:

```jsonc
[
  { "name": "Jan Novák", "ownership_percent": 60, "date_of_birth": "1980-...", "nationality": "CZ", "address": "..." },
  ...
]
```

Updated yearly or at material change.

### RULE-MKT-026: Marketplace customer is buyer

For dispute purposes, customer relationship is with platform (consumer protection) — platform is legally responsible for marketplace transactions in EU.

This is why platform mediates disputes, can refund customer regardless of seller cooperation.

### RULE-MKT-027: Seller suspension grace period

Suspended seller:
- New orders blocked
- Existing orders complete (fulfillment must continue)
- Listings hidden from marketplace
- Payouts continue for completed orders (minus disputes/refunds)
- Seller can appeal within 30 days

After 90 days suspended without resolution → closed.

### RULE-MKT-028: Closed seller data retention

Closed seller's:
- Sales history retained (accounting law)
- Customer data (anonymized per GDPR)
- Listings permanently hidden but data retained for disputes
- Refunds/returns continue for purchased items

### RULE-MKT-029: Per-seller analytics privacy

Each seller sees only own data. Cross-seller benchmarks anonymized (e.g., "Your conversion rate vs marketplace average for fashion category").

### RULE-MKT-030: Marketplace categories

Categories shared across sellers (per `07-categories-taxonomy.md`). Sellers cannot create new categories — request via admin. Avoids duplication.

### RULE-MKT-031: Sponsored listings

Sellers pay for ranking boost:
- `seller_product_settings.is_sponsored=true`
- Pricing per click OR flat fee per period
- Labeled "Sponsored" in search results (legal requirement)

Fáze 4+ — separate `marketplace_sponsored_campaigns` table.

### RULE-MKT-032: Buyer trust signals

Storefront displays:
- Seller name + logo
- Seller rating (avg of `seller_reviews`)
- Verified Seller badge (if KYC approved + active for 90+ days)
- "Ships from {country}" badge
- Tier badge (Gold, Platinum)
- Estimated delivery
- Return policy summary
- Number of reviews + customers served

### RULE-MKT-033: Seller-buyer message retention

Messages retained 2 years (longer than typical chats; needed for dispute history).

### RULE-MKT-034: Bulk listing upload

Sellers can bulk-upload products via CSV (per `06-catalog-pim.md` patterns). Validation per marketplace rules + listing review.

### RULE-MKT-035: Dispute mediator workload

`marketplace_disputes` distributed across `assigned_mediator_user_id` per round-robin or workload-balanced assignment. Mediator dashboards for queue management.

### RULE-MKT-036: Cross-border seller obligations

Non-EU seller selling to EU consumer:
- VAT collected via IOSS (≤€150) or import (>€150)
- Marketplace facilitator may be deemed responsible per RULE-MKT-022
- Seller responsible for compliance with EU product safety rules (CE marking etc.)
- Marketplace can mandate proof of compliance (Fáze 4+)

---

## 9. REST API endpoints

### 9.1 Sellers (platform admin)

```
GET    /api/{date}/marketplace/sellers
POST   /api/{date}/marketplace/sellers                                                                                       # admin onboards seller manually
GET    /api/{date}/marketplace/sellers/{id}
PATCH  /api/{date}/marketplace/sellers/{id}
POST   /api/{date}/marketplace/sellers/{id}:approve
POST   /api/{date}/marketplace/sellers/{id}:reject
POST   /api/{date}/marketplace/sellers/{id}:suspend
POST   /api/{date}/marketplace/sellers/{id}:reactivate
POST   /api/{date}/marketplace/sellers/{id}:close
POST   /api/{date}/marketplace/sellers/{id}:assign-tier
POST   /api/{date}/marketplace/sellers/{id}:update-commission
GET    /api/{date}/marketplace/sellers/{id}/performance
GET    /api/{date}/marketplace/sellers/{id}/products
GET    /api/{date}/marketplace/sellers/{id}/orders
GET    /api/{date}/marketplace/sellers/{id}/payouts
GET    /api/{date}/marketplace/sellers/{id}/disputes
GET    /api/{date}/marketplace/sellers/{id}/violations
```

### 9.2 Seller self-service (seller_members)

```
GET    /api/{date}/seller/me                                                                                                 # own seller info
PATCH  /api/{date}/seller/me                                                                                                 # update profile
POST   /api/{date}/seller/me/onboarding/stripe-connect:start
POST   /api/{date}/seller/me/onboarding/kyc:start
POST   /api/{date}/seller/me/onboarding/upload-document
POST   /api/{date}/seller/me/onboarding/sign-terms
POST   /api/{date}/seller/me:request-tier-review

GET    /api/{date}/seller/me/products
POST   /api/{date}/seller/me/products
PATCH  /api/{date}/seller/me/products/{id}
DELETE /api/{date}/seller/me/products/{id}
POST   /api/{date}/seller/me/products:bulk-upload-csv

GET    /api/{date}/seller/me/orders
GET    /api/{date}/seller/me/orders/{id}
POST   /api/{date}/seller/me/orders/{id}:mark-shipped
POST   /api/{date}/seller/me/orders/{id}:add-tracking
POST   /api/{date}/seller/me/orders/{id}:respond-to-return

GET    /api/{date}/seller/me/payouts
GET    /api/{date}/seller/me/payouts/{id}/statement.pdf

GET    /api/{date}/seller/me/reviews
POST   /api/{date}/seller/me/reviews/{id}:respond

GET    /api/{date}/seller/me/disputes
POST   /api/{date}/seller/me/disputes/{id}:respond
POST   /api/{date}/seller/me/disputes/{id}/messages

GET    /api/{date}/seller/me/messages
POST   /api/{date}/seller/me/messages
GET    /api/{date}/seller/me/messages/threads/{thread_id}

GET    /api/{date}/seller/me/analytics
GET    /api/{date}/seller/me/performance

GET    /api/{date}/seller/me/team                                                                                            # seller_members
POST   /api/{date}/seller/me/team                                                                                            # invite team member
PATCH  /api/{date}/seller/me/team/{id}
DELETE /api/{date}/seller/me/team/{id}
```

### 9.3 Marketplace storefront (customer)

```
GET    /api/{date}/storefront/marketplace/sellers                                                                            # browseable seller list
GET    /api/{date}/storefront/marketplace/sellers/{slug}                                                                     # seller storefront page
GET    /api/{date}/storefront/marketplace/sellers/{slug}/products
GET    /api/{date}/storefront/marketplace/sellers/{slug}/reviews
POST   /api/{date}/storefront/marketplace/sellers/{slug}/reviews                                                              # write review (post-purchase)
POST   /api/{date}/storefront/marketplace/sellers/{slug}/messages                                                              # contact seller

GET    /api/{date}/storefront/marketplace/disputes
POST   /api/{date}/storefront/marketplace/disputes                                                                            # open dispute
GET    /api/{date}/storefront/marketplace/disputes/{number}
POST   /api/{date}/storefront/marketplace/disputes/{number}/messages
POST   /api/{date}/storefront/marketplace/disputes/{number}:escalate
```

### 9.4 Payouts (admin)

```
GET    /api/{date}/marketplace/payouts
POST   /api/{date}/marketplace/payouts:trigger-manual                                                                         # ad-hoc payout
GET    /api/{date}/marketplace/payouts/{id}
POST   /api/{date}/marketplace/payouts/{id}:hold                                                                              # admin holds payout
POST   /api/{date}/marketplace/payouts/{id}:release
POST   /api/{date}/marketplace/payouts/{id}:retry
GET    /api/{date}/marketplace/payouts/{id}/line-items
GET    /api/{date}/marketplace/payouts/{id}/statement.pdf
```

### 9.5 Disputes (admin / mediator)

```
GET    /api/{date}/marketplace/disputes                                                                                       # queue
GET    /api/{date}/marketplace/disputes/{id}
POST   /api/{date}/marketplace/disputes/{id}:assign                                                                           # to mediator
POST   /api/{date}/marketplace/disputes/{id}:resolve
POST   /api/{date}/marketplace/disputes/{id}:escalate
POST   /api/{date}/marketplace/disputes/{id}/messages                                                                          # internal notes + buyer/seller messages
GET    /api/{date}/marketplace/disputes:by-status?status=platform_review
```

### 9.6 Policies + violations

```
GET    /api/{date}/marketplace/policies
POST   /api/{date}/marketplace/policies
PATCH  /api/{date}/marketplace/policies/{id}
DELETE /api/{date}/marketplace/policies/{id}

GET    /api/{date}/marketplace/violations
POST   /api/{date}/marketplace/violations                                                                                       # record violation
POST   /api/{date}/marketplace/violations/{id}:decide-outcome
```

### 9.7 Analytics

```
GET    /api/{date}/marketplace-analytics/gmv                                                                                    # gross merchandise value
GET    /api/{date}/marketplace-analytics/top-sellers
GET    /api/{date}/marketplace-analytics/commission-revenue
GET    /api/{date}/marketplace-analytics/dispute-rate
GET    /api/{date}/marketplace-analytics/seller-funnel                                                                          # onboarding completion rate
GET    /api/{date}/marketplace-analytics/by-category
```

### 9.8 Example: Seller submits product listing

```http
POST /api/2026-05-20/seller/me/products HTTP/1.1
Authorization: Bearer seller_jwt

{
  "title": "Handmade ceramic bowl",
  "description_html": "<p>...</p>",
  "category_id": "cat_homewares",
  "price_amount": 89900,
  "currency": "CZK",
  "weight_grams": 800,
  "variants": [
    { "sku": "BOWL-WHT-S", "title": "White / Small", "stock": 12 },
    { "sku": "BOWL-WHT-L", "title": "White / Large", "stock": 8 }
  ],
  "media_ids": ["mdi_aB","mdi_xY"]
}
```

```jsonc
HTTP/1.1 201 Created

{
  "data": {
    "id": "prd_aB",
    "listing_status": "pending_review",
    "next_step": "Listing submitted for review. Typically approved within 24 hours."
  }
}
```

### 9.9 Example: Marketplace order placement

Customer cart contains items from Seller A + Seller B:

```http
POST /api/2026-05-20/storefront/checkouts/{id}:confirm HTTP/1.1
Idempotency-Key: ...
```

Backend creates:
```jsonc
{
  "parent_order": {
    "id": "ord_parent",
    "number": "ORD-2026-00012345",
    "total_amount": 234500,
    "marketplace_seller_id": null,
    "child_orders": ["ord_child_a", "ord_child_b"]
  },
  "child_orders": [
    {
      "id": "ord_child_a",
      "parent_marketplace_order_id": "ord_parent",
      "marketplace_seller_id": "slr_a",
      "subtotal_amount": 100000,
      "marketplace_commission_amount": 15000,                                                                                   // 15% commission
      "marketplace_seller_payout_amount": 85000
    },
    {
      "id": "ord_child_b",
      "parent_marketplace_order_id": "ord_parent",
      "marketplace_seller_id": "slr_b",
      "subtotal_amount": 134500,
      "marketplace_commission_amount": 20175,
      "marketplace_seller_payout_amount": 114325
    }
  ]
}
```

Single payment to platform; Stripe Connect transfers per seller after hold period.

### 9.10 Example: Customer opens dispute

```http
POST /api/2026-05-20/storefront/marketplace/disputes HTTP/1.1
Authorization: Bearer customer_jwt

{
  "order_id": "ord_child_a",
  "dispute_kind": "item_significantly_not_as_described",
  "reason": "Item received was much smaller than listed dimensions",
  "buyer_evidence_media_ids": ["mdi_photo1","mdi_photo2"]
}
```

```jsonc
HTTP/1.1 201 Created

{
  "data": {
    "id": "dsp_aB",
    "number": "DSP-2026-00000123",
    "status": "awaiting_seller_response",
    "seller_response_deadline": "2026-05-23T10:00:00Z",
    "next_step": "Seller has 72 hours to respond. You'll be notified."
  }
}
```

### 9.11 Example: Seller payout statement

```http
GET /api/2026-05-20/seller/me/payouts/pyo_aB/statement.pdf HTTP/1.1
```

Returns PDF with:
- Period summary
- Sales breakdown (orders, commission)
- Refunds + adjustments
- Net payout
- Transfer reference

---

## 10. GraphQL schema

```graphql
type Seller implements Node & Timestamped {
  id: ID!
  pubId: String!
  number: String!
  slug: String!
  legalEntityName: String!
  displayName: String!
  description: String
  logo: Media
  banner: Media
  primaryContact: Customer
  registrationNumber: String!
  vatId: String
  countryCode: String!
  contactEmail: String!
  supportEmail: String
  status: SellerStatus!
  rejectedReason: String
  suspendedReason: String
  commissionKind: CommissionKind!
  commissionPercent: Float
  payoutScheduleKind: PayoutScheduleKind!
  pendingBalance: Money
  stripeConnectAccountId: String                                                                                                # masked
  kycStatus: SellerKycStatus!
  tier: SellerTier
  totalOrdersFulfilled: Int!
  totalRevenue: Money!
  avgRating: Float
  ratingCount: Int!
  fulfillmentSlaCompliancePercent: Float
  cancellationRatePercent: Float
  returnRatePercent: Float
  disputeRatePercent: Float
  avgResponseTimeHours: Float
  totalActiveListings: Int!
  shipsToCountryCodes: [String!]!
  primaryShippingOriginCountryCode: String!
  storefrontUrlPath: String!
  activatedAt: DateTime
  createdAt: DateTime!
  updatedAt: DateTime!
}

enum SellerStatus { PENDING_APPLICATION UNDER_REVIEW VERIFIED ACTIVE SUSPENDED CLOSED REJECTED }
enum SellerTier { PLATINUM GOLD SILVER BRONZE PROBATION }
enum SellerKycStatus { NOT_STARTED IN_PROGRESS APPROVED REJECTED REQUIRES_MORE_INFO }
enum CommissionKind { FLAT_PERCENT TIERED PER_CATEGORY CUSTOM }
enum PayoutScheduleKind { DAILY WEEKLY BIWEEKLY MONTHLY MANUAL }

type SellerMember {
  id: ID!
  seller: Seller!
  customer: Customer!
  role: SellerMemberRole!
  isActive: Boolean!
  joinedAt: DateTime
}

enum SellerMemberRole { OWNER ADMIN STAFF VIEWER SUPPORT FINANCE }

type SellerProductSetting {
  product: Product!
  seller: Seller!
  isActiveInMarketplace: Boolean!
  listingStatus: ListingStatus!
  commissionOverridePercent: Float
  isSponsored: Boolean!
  sponsoredUntil: DateTime
}

enum ListingStatus { DRAFT PENDING_REVIEW APPROVED REJECTED SUSPENDED WITHDRAWN }

type SellerPayout implements Node {
  id: ID!
  pubId: String!
  number: String!
  seller: Seller!
  currency: String!
  grossSalesAmount: Money!
  commissionAmount: Money!
  refundsAmount: Money!
  netPayoutAmount: Money!
  periodStart: DateTime!
  periodEnd: DateTime!
  status: PayoutStatus!
  scheduledAt: DateTime!
  completedAt: DateTime
  failureReason: String
  statementPdfUrl: String
  lineItems: [SellerPayoutLineItem!]!
  createdAt: DateTime!
}

enum PayoutStatus { PENDING PROCESSING PAID FAILED CANCELLED ON_HOLD }

type SellerPayoutLineItem {
  id: ID!
  payout: SellerPayout!
  order: Order!
  kind: PayoutLineKind!
  grossAmount: Money!
  commissionAmount: Money!
  netAmount: Money!
  occurredAt: DateTime!
}

enum PayoutLineKind { SALE REFUND CHARGEBACK ADJUSTMENT CORRECTION }

type SellerReview {
  id: ID!
  seller: Seller!
  customer: Customer!
  order: Order!
  overallRating: Int!
  shippingSpeedRating: Int
  communicationRating: Int
  productAccuracyRating: Int
  packagingRating: Int
  title: String
  body: String
  media: [Media!]
  status: SellerReviewStatus!
  sellerResponse: String
  sellerResponseAt: DateTime
  helpfulCount: Int!
  notHelpfulCount: Int!
  createdAt: DateTime!
}

enum SellerReviewStatus { PENDING_MODERATION APPROVED REJECTED HIDDEN }

type MarketplaceDispute implements Node {
  id: ID!
  pubId: String!
  number: String!
  order: Order!
  buyer: Customer!
  seller: Seller!
  disputeKind: DisputeKind!
  reason: String!
  buyerEvidence: [Media!]
  status: DisputeStatus!
  outcome: DisputeOutcome
  refundAmount: Money
  assignedMediator: User
  openedAt: DateTime!
  sellerResponseDeadline: DateTime
  resolvedAt: DateTime
  messages: [DisputeMessage!]!
}

enum DisputeKind {
  ITEM_NOT_RECEIVED ITEM_SIGNIFICANTLY_NOT_AS_DESCRIBED DAMAGE_IN_TRANSIT
  WRONG_ITEM MISSING_PARTS COUNTERFEIT REFUND_NOT_RECEIVED
  COMMUNICATION_BREAKDOWN QUALITY_ISSUE OTHER
}
enum DisputeStatus { OPENED AWAITING_SELLER_RESPONSE SELLER_RESPONDED PLATFORM_REVIEW ESCALATED RESOLVED CLOSED }
enum DisputeOutcome { REFUND_FULL REFUND_PARTIAL REPLACEMENT NO_ACTION SPLIT_DECISION SELLER_WARNING SELLER_SUSPENDED }

type DisputeMessage {
  id: ID!
  dispute: MarketplaceDispute!
  authorKind: DisputeMessageAuthorKind!
  body: String!
  attachments: [Media!]
  isInternal: Boolean!
  occurredAt: DateTime!
}

enum DisputeMessageAuthorKind { BUYER SELLER PLATFORM SYSTEM }

type SellerBuyerMessage {
  id: ID!
  thread: SellerBuyerMessageThread!
  seller: Seller!
  buyer: Customer!
  order: Order
  authorKind: MessageAuthorKind!
  body: String!
  attachments: [Media!]
  isReadByRecipient: Boolean!
  occurredAt: DateTime!
}

type SellerBuyerMessageThread {
  id: ID!
  seller: Seller!
  buyer: Customer!
  order: Order
  messages: [SellerBuyerMessage!]!
  lastMessageAt: DateTime!
  unreadCount: Int!
}

enum MessageAuthorKind { BUYER SELLER PLATFORM }

extend type Query {
  sellers(first: Int, after: String, filter: SellerFilter): SellerConnection! @auth(requires: PERM_MARKETPLACE_SELLER_VIEW)
  seller(id: ID, pubId: String, slug: String): Seller
  mySeller: Seller                                                                                                                   # current customer's seller (if seller_member)

  sellerPayouts(sellerId: ID, status: [PayoutStatus!]): [SellerPayout!]! @auth(requires: PERM_MARKETPLACE_PAYOUT_VIEW)
  sellerPayout(id: ID!): SellerPayout

  sellerReviews(sellerId: ID!, status: [SellerReviewStatus!] = [APPROVED], first: Int = 10, after: String): SellerReviewConnection!

  marketplaceDisputes(filter: MarketplaceDisputeFilter): [MarketplaceDispute!]! @auth(requires: PERM_MARKETPLACE_DISPUTE_VIEW)
  marketplaceDispute(id: ID, pubId: String, number: String): MarketplaceDispute
  myMarketplaceDisputes: [MarketplaceDispute!]!                                                                                       # buyer's own

  marketplacePolicies: [MarketplacePolicy!]!
  sellerViolations(sellerId: ID): [SellerPolicyViolation!]! @auth(requires: PERM_MARKETPLACE_SELLER_VIEW)

  sellerPerformance(sellerId: ID!): SellerPerformanceMetrics!
  sellerBuyerMessageThreads(sellerId: ID, buyerId: ID): [SellerBuyerMessageThread!]!

  marketplaceAnalyticsGmv(period: PeriodInput!): MarketplaceGmvSnapshot! @auth(requires: PERM_MARKETPLACE_ANALYTICS_VIEW)
  marketplaceAnalyticsTopSellers(period: PeriodInput!, limit: Int = 20): [TopSellerEntry!]! @auth(requires: PERM_MARKETPLACE_ANALYTICS_VIEW)
  marketplaceAnalyticsCommissionRevenue(period: PeriodInput!): Money! @auth(requires: PERM_MARKETPLACE_ANALYTICS_VIEW)
}

extend type Mutation {
  applyAsSeller(input: SellerApplicationInput!): Seller!
  approveSeller(id: ID!): Seller! @auth(requires: PERM_MARKETPLACE_SELLER_MANAGE)
  rejectSeller(id: ID!, reason: String!): Seller! @auth(requires: PERM_MARKETPLACE_SELLER_MANAGE)
  suspendSeller(id: ID!, reason: String!): Seller! @auth(requires: PERM_MARKETPLACE_SELLER_MANAGE)
  reactivateSeller(id: ID!): Seller! @auth(requires: PERM_MARKETPLACE_SELLER_MANAGE)
  closeSeller(id: ID!, reason: String!): Seller! @auth(requires: PERM_MARKETPLACE_SELLER_MANAGE)
  updateSellerCommission(id: ID!, input: CommissionInput!): Seller! @auth(requires: PERM_MARKETPLACE_SELLER_MANAGE)
  assignSellerTier(id: ID!, tier: SellerTier!): Seller! @auth(requires: PERM_MARKETPLACE_SELLER_MANAGE)

  updateMySellerProfile(input: SellerProfileInput!): Seller!
  startKycForMySeller: KycSession!
  uploadKycDocument(input: KycDocumentInput!): MutationPayload!
  signMarketplaceTermsForMySeller: Seller!

  inviteSellerMember(input: SellerMemberInput!): SellerMember!
  updateSellerMember(id: ID!, input: SellerMemberInput!): SellerMember!
  removeSellerMember(id: ID!): DeletePayload!

  approveListingReview(productId: ID!): SellerProductSetting! @auth(requires: PERM_MARKETPLACE_LISTING_APPROVE)
  rejectListingReview(productId: ID!, reason: String!): SellerProductSetting! @auth(requires: PERM_MARKETPLACE_LISTING_APPROVE)

  triggerManualPayout(sellerId: ID!): SellerPayout! @auth(requires: PERM_MARKETPLACE_PAYOUT_MANAGE)
  holdSellerPayout(id: ID!, reason: String!): SellerPayout! @auth(requires: PERM_MARKETPLACE_PAYOUT_MANAGE)
  releaseSellerPayoutHold(id: ID!): SellerPayout! @auth(requires: PERM_MARKETPLACE_PAYOUT_MANAGE)
  retrySellerPayout(id: ID!): SellerPayout! @auth(requires: PERM_MARKETPLACE_PAYOUT_MANAGE)

  openMarketplaceDispute(input: OpenDisputeInput!): MarketplaceDispute!
  respondToDispute(id: ID!, body: String!, attachments: [ID!]): MarketplaceDispute!
  escalateDispute(id: ID!): MarketplaceDispute!
  resolveDispute(id: ID!, input: ResolveDisputeInput!): MarketplaceDispute! @auth(requires: PERM_MARKETPLACE_DISPUTE_RESOLVE)
  assignDisputeMediator(id: ID!, mediatorUserId: ID!): MarketplaceDispute! @auth(requires: PERM_MARKETPLACE_DISPUTE_MANAGE)
  addDisputeMessage(disputeId: ID!, body: String!, attachments: [ID!], isInternal: Boolean = false): DisputeMessage!

  submitSellerReview(input: SellerReviewInput!): SellerReview!
  respondToSellerReview(reviewId: ID!, response: String!): SellerReview!
  reportSellerReview(reviewId: ID!, reason: String!): MutationPayload!

  sendSellerBuyerMessage(input: SendMessageInput!): SellerBuyerMessage!
  markMessageThreadRead(threadId: ID!): MutationPayload!

  recordPolicyViolation(input: PolicyViolationInput!): SellerPolicyViolation! @auth(requires: PERM_MARKETPLACE_VIOLATION_MANAGE)
  decidePolicyViolation(id: ID!, input: ViolationOutcomeInput!): SellerPolicyViolation! @auth(requires: PERM_MARKETPLACE_VIOLATION_MANAGE)
}

input OpenDisputeInput {
  orderId: ID!
  disputeKind: DisputeKind!
  reason: String!
  buyerEvidenceMediaIds: [ID!]
}

input ResolveDisputeInput {
  outcome: DisputeOutcome!
  refundAmount: MoneyInput
  notes: String!
}
```

---

## 11. Events

| Build-spec ID | Wire | Payload |
|---|---|---|
| `EVENT-SELLER-APPLIED` | `marketplace.seller_applied` | `{ seller }` |
| `EVENT-SELLER-KYC-COMPLETED` | `marketplace.seller_kyc_completed` | `{ seller, kyc_status }` |
| `EVENT-SELLER-APPROVED` | `marketplace.seller_approved` | `{ seller }` |
| `EVENT-SELLER-REJECTED` | `marketplace.seller_rejected` | `{ seller, reason }` |
| `EVENT-SELLER-ACTIVATED` | `marketplace.seller_activated` | `{ seller }` |
| `EVENT-SELLER-SUSPENDED` | `marketplace.seller_suspended` | `{ seller, reason }` |
| `EVENT-SELLER-CLOSED` | `marketplace.seller_closed` | `{ seller, reason }` |
| `EVENT-SELLER-TIER-CHANGED` | `marketplace.seller_tier_changed` | `{ seller, previous, new }` |
| `EVENT-SELLER-COMMISSION-CHANGED` | `marketplace.seller_commission_changed` | `{ seller }` |
| `EVENT-SELLER-MEMBER-ADDED` | `marketplace.seller_member_added` | `{ seller, member }` |
| `EVENT-LISTING-SUBMITTED-FOR-REVIEW` | `marketplace.listing_submitted` | `{ product, seller }` |
| `EVENT-LISTING-APPROVED` | `marketplace.listing_approved` | `{ product, seller }` |
| `EVENT-LISTING-REJECTED` | `marketplace.listing_rejected` | `{ product, seller, reason }` |
| `EVENT-MARKETPLACE-ORDER-PLACED` | `marketplace.order_placed` | `{ parent_order, child_orders }` |
| `EVENT-MARKETPLACE-ORDER-SPLIT` | `marketplace.order_split` | `{ parent_order, splits }` |
| `EVENT-SELLER-PAYOUT-SCHEDULED` | `marketplace.payout_scheduled` | `{ payout }` |
| `EVENT-SELLER-PAYOUT-PROCESSED` | `marketplace.payout_processed` | `{ payout }` |
| `EVENT-SELLER-PAYOUT-FAILED` | `marketplace.payout_failed` | `{ payout, reason }` |
| `EVENT-MARKETPLACE-DISPUTE-OPENED` | `marketplace.dispute_opened` | `{ dispute }` |
| `EVENT-MARKETPLACE-DISPUTE-RESPONDED` | `marketplace.dispute_responded` | `{ dispute }` |
| `EVENT-MARKETPLACE-DISPUTE-ESCALATED` | `marketplace.dispute_escalated` | `{ dispute }` |
| `EVENT-MARKETPLACE-DISPUTE-RESOLVED` | `marketplace.dispute_resolved` | `{ dispute, outcome }` |
| `EVENT-SELLER-REVIEW-SUBMITTED` | `marketplace.seller_review_submitted` | `{ review }` |
| `EVENT-SELLER-REVIEW-RESPONSE` | `marketplace.seller_review_response` | `{ review, response }` |
| `EVENT-POLICY-VIOLATION-DETECTED` | `marketplace.policy_violation` | `{ violation }` |
| `EVENT-SELLER-PERFORMANCE-DEGRADED` | `marketplace.seller_performance_degraded` | `{ seller, metric }` |
| `EVENT-SANCTIONS-MATCH` | `marketplace.sanctions_match` | `{ seller, list }` |
| `EVENT-SELLER-FULFILLMENT-SLA-MISSED` | `marketplace.fulfillment_sla_missed` | `{ seller, order }` |

**Konzumenti:**
- Email notifications — seller status changes, dispute updates, payout statements
- Search indexer — seller listing changes
- Analytics — GMV, commission, dispute rates
- Webhook delivery
- Compliance team — sanctions matches, severe violations

---

## 12. Background jobs

| Job | Trigger | Queue | Frequency |
|---|---|---|---|
| `JOB-SYNC-STRIPE-CONNECT-ACCOUNT` | webhook from Stripe | `marketplace` | On-demand |
| `JOB-PERFORM-KYC-VERIFICATION` | seller submits docs | `kyc` | On-demand |
| `JOB-SANCTIONS-SCREEN-SELLERS` | scheduled | `compliance` | Weekly |
| `JOB-COMPUTE-SELLER-PERFORMANCE-DAILY` | scheduled | `analytics` | Daily |
| `JOB-AUTO-ADJUST-SELLER-TIERS` | scheduled | `analytics` | Daily |
| `JOB-SPLIT-MARKETPLACE-ORDER` | EVENT-ORDER-PLACED (parent) | `marketplace` | On-demand |
| `JOB-EXECUTE-SELLER-PAYOUT` | scheduled per seller | `payouts` | Per seller schedule |
| `JOB-RETRY-FAILED-PAYOUT` | EVENT-SELLER-PAYOUT-FAILED | `payouts` | Exponential backoff |
| `JOB-RELEASE-PAYOUT-HOLD-AFTER-COOLING-OFF` | scheduled | `payouts` | Daily |
| `JOB-SEND-DISPUTE-RESPONSE-REMINDER` | scheduled (24h before SLA) | `notifications` | Daily |
| `JOB-AUTO-ESCALATE-OVERDUE-DISPUTES` | scheduled | `marketplace` | Hourly |
| `JOB-DETECT-SELLER-SELF-DEALING` | EVENT-ORDER-PLACED (marketplace order) | `compliance` | On-demand |
| `JOB-DETECT-FULFILLMENT-SLA-MISSED` | scheduled | `marketplace` | Hourly |
| `JOB-PUBLISH-MARKETPLACE-FEED` (Heuréka, GS, Meta) | scheduled | `marketing` | Hourly |
| `JOB-SEND-SELLER-PAYOUT-NOTIFICATION` | EVENT-SELLER-PAYOUT-PROCESSED | `notifications` | On-demand |
| `JOB-MODERATE-AUTO-FLAGGED-REVIEWS` | review flagged | `moderation` | On-demand |
| `JOB-RECOMPUTE-SELLER-RATING` | EVENT-SELLER-REVIEW-* | `marketplace` | Debounced 5 min |
| `JOB-AUTO-SUSPEND-SELLERS-BELOW-THRESHOLD` | EVENT-SELLER-PERFORMANCE-DEGRADED | `marketplace` | On-demand |
| `JOB-CLOSE-SUSPENDED-SELLERS-AFTER-90D` | scheduled | `marketplace` | Daily |
| `JOB-MARKETPLACE-DAILY-GMV-SNAPSHOT` | scheduled | `analytics` | Daily |
| `JOB-NOTIFY-SELLER-NEW-ORDER` | EVENT-MARKETPLACE-ORDER-PLACED | `notifications` | On-demand |

---

## 13. UI/UX flows

### FLOW-MKT-001: Seller onboarding

```
[Marketplace homepage → "Become a seller"]
        │
        ▼
[Application form]
   - Step 1: Email + password + company info
   - Step 2: Verify email
   - Step 3: KYC documents upload
   - Step 4: Bank info via Stripe Connect (redirect to Stripe Express)
   - Step 5: Marketplace terms signing
   - Step 6: Storefront setup (slug, logo, description)
        │
        ▼
[Submitted for admin review]
   - Status='under_review'
   - Email confirmation
        │
        ▼
[Admin reviews + approves]
   - Status='active'
   - Welcome email with dashboard link
```

### FLOW-MKT-002: Seller lists products

```
[Seller dashboard → Listings]
   - "Add new product"
        │
        ▼
[Product editor (subset of platform product editor)]
   - Title, description, images
   - Category (from marketplace taxonomy)
   - Price, weight
   - Variants
   - Stock per variant
   - Shipping options
        │
        ▼
[Submit for review → listing_status='pending_review']
        │
   ... category manager reviews ...
        │
        ▼
[Approved → listing_status='approved' → visible in marketplace]
```

### FLOW-MKT-003: Customer marketplace shopping

```
[Marketplace storefront]
   - Search bar
   - Categories
   - Featured sellers
        │
        ▼
[Product detail page]
   - Product info
   - "Sold by: Seller XYZ (4.8 ★, 1234 reviews, Gold tier)"
   - "Verified Seller" badge
   - Shipping from country
   - Estimated delivery
   - Return policy
   - "Contact seller" button
   - "Add to cart"
        │
   add items from multiple sellers
        │
        ▼
[Cart page]
   - Items grouped by seller
   - Per-seller shipping methods
   - Single grand total
        │
        ▼
[Checkout (per `12-checkout.md`)]
   - Single payment to platform
   - Backend splits into child orders per seller
        │
        ▼
[Confirmation: "Your order has been placed with N sellers"]
```

### FLOW-MKT-004: Seller fulfills order

```
[Seller dashboard → Orders → New (highlighted)]
        │
   click order
        │
        ▼
[Order detail]
   - Buyer info
   - Items
   - Shipping address
   - Payment status (handled by platform)
   - Actions: [Mark shipped + add tracking]
        │
        ▼
[POST /seller/me/orders/{id}:mark-shipped]
   - Tracking number added
   - Carrier selected
   - Buyer notified via platform email
   - fulfillment_status=fulfilled
```

### FLOW-MKT-005: Customer opens dispute

```
[Customer → My orders → {order} → "Open dispute"]
        │
        ▼
[Dispute form]
   - Dispute kind dropdown
   - Reason description
   - Photo evidence upload
        │
        ▼
[POST /storefront/marketplace/disputes]
   - status='awaiting_seller_response'
   - Seller notified, 72h deadline
        │
        ▼
[Seller responds via dashboard]
   - status='seller_responded'
        │
        ▼
[Buyer reviews seller's response]
   - Accept → status='resolved'
   - Reject → status='platform_review' (escalation)
        │
        ▼
[Mediator assigned + reviews evidence]
   - Outcome decided + applied (refund, replacement, etc.)
   - Status='resolved' → 'closed'
```

### FLOW-MKT-006: Seller payout

```
[Weekly cron: Monday 06:00]
   - JOB-EXECUTE-SELLER-PAYOUT for each seller with payout_schedule_kind='weekly'
        │
        ▼
[Per seller]
   - Sum pending balance (cleared cooling-off)
   - Subtract refunds/chargebacks/adjustments
   - Create payout row + line items
   - Stripe Connect transfer
        │
   on success:
        ▼
[status='paid']
   - Statement PDF generated
   - Email to seller: "Your weekly payout of X CZK was sent"
```

### FLOW-MKT-007: Performance-based tier change

```
[Daily: JOB-COMPUTE-SELLER-PERFORMANCE-DAILY]
   - For each seller: compute score per RULE-MKT-008
   - JOB-AUTO-ADJUST-SELLER-TIERS:
     - If score crosses tier threshold: update sellers.tier
   - Notify seller of tier change (positive or negative)
        │
        ▼
[Search ranking updated automatically (next reindex)]
```

---

## 14. Edge cases & error handling

| Scenario | Behavior | Code |
|---|---|---|
| Seller applies but KYC fails | status='rejected'; can re-apply after 30 days | (handled) |
| Stripe Connect onboarding incomplete | Seller stays 'under_review'; reminder emails | (handled) |
| Seller tries to list before approval | Reject | `SELLER_NOT_APPROVED`, 403 |
| Marketplace order with items from suspended seller | Reject at checkout | `SELLER_SUSPENDED`, 422 |
| Customer buys from own seller | Block at checkout (self-dealing detection) | `SELF_DEALING_BLOCKED`, 422 |
| Stripe Connect payout fails (account closed) | Retry; alert admin; manual resolution | (handled) |
| Dispute opened on closed seller | Allow; platform handles refund directly | (handled) |
| Seller doesn't respond within SLA | Auto-escalate to platform review | (handled per RULE-MKT-006) |
| Refund issued during payout hold period | Adjust payout amount before transfer | (handled) |
| Chargeback after payout | Subtract from next payout; seller balance can go negative | (handled) |
| Seller wants to close — has pending orders | Cannot close until orders fulfilled or cancelled | (handled) |
| Multi-currency payouts to seller | Stripe Connect handles FX; setting per seller | (handled per RULE-MKT-024) |
| Two sellers list identical product | Allow (competition); customer chooses | (handled) |
| Listing review backlog | Bulk auto-approve trusted sellers (Fáze 4+) | (handled) |
| Seller violates policy (e.g., counterfeit) | Listing removed; warning or suspension per severity | (handled per RULE-MKT-007) |
| Sanctions match | Auto-suspend + compliance officer notification | (handled per RULE-MKT-023) |
| Customer initiates return; seller refuses | Platform mediates; refund forced if buyer right | (handled) |
| Reviewer rates seller after order cancelled | Reject (not a verified purchase) | `NOT_VERIFIED_PURCHASE`, 422 |
| Seller responds to review profanely | Moderation queue; remove or warn | (handled) |
| Negative reviewer flagged by seller as fake | Mediator review; rarely removed unless proven | (handled) |
| Marketplace tax facilitator rules conflict | Default per seller country; manual override possible | (handled) |
| Seller's country sanctions | Block onboarding | `SANCTIONED_COUNTRY`, 422 |
| Marketplace mode disabled mid-operation | Sellers' orders complete; new orders blocked; status='closed' | (handled gracefully) |

---

## 15. Performance

### 15.1 Targets

| Operation | p50 | p95 | p99 |
|---|---|---|---|
| Seller dashboard load | 100 ms | 400 ms | 800 ms |
| Marketplace order split at checkout | 200 ms | 600 ms | 1200 ms |
| `JOB-EXECUTE-SELLER-PAYOUT` per seller | 5 s | 20 s | 60 s (Stripe transfer dominant) |
| Seller performance computation | 50 s | 180 s | 300 s (daily batch) |
| Dispute load | 50 ms | 200 ms | 400 ms |
| Customer marketplace storefront load | 50 ms | 200 ms | 400 ms (cached) |
| Seller reviews aggregation | 30 ms | 100 ms | 200 ms (cached) |

### 15.2 Optimization

- Per-seller performance metrics cached daily snapshots
- Marketplace storefront aggressive caching (per seller page CDN-cached 5 min)
- Order split logic optimized: single Tx for parent + children
- Stripe Connect API rate limits respected (throttle payout job)
- Bulk listing operations chunked

### 15.3 Scaling

- 100k sellers per tenant manageable
- Beyond: per-seller partitioning (Fáze 5+)
- Disputes: high-volume; partition by month

---

## 16. Security & compliance

### 16.1 Permissions

```
PERM-MARKETPLACE-SELLER-VIEW
PERM-MARKETPLACE-SELLER-MANAGE
PERM-MARKETPLACE-LISTING-APPROVE
PERM-MARKETPLACE-PAYOUT-VIEW
PERM-MARKETPLACE-PAYOUT-MANAGE
PERM-MARKETPLACE-DISPUTE-VIEW
PERM-MARKETPLACE-DISPUTE-RESOLVE
PERM-MARKETPLACE-DISPUTE-MANAGE
PERM-MARKETPLACE-VIOLATION-MANAGE
PERM-MARKETPLACE-COMPLIANCE-VIEW
PERM-MARKETPLACE-ANALYTICS-VIEW
PERM-MARKETPLACE-CATEGORY-MANAGE
PERM-MARKETPLACE-SUPPORT
PERM-SELLER-OWN-MANAGE                                                                                                          # seller's own ops
```

### 16.2 Cross-seller isolation

Each seller sees only own:
- Products
- Orders
- Inventory
- Customers (only those who ordered from them)
- Payouts
- Reviews

RLS enforced at DB level for seller-scoped queries.

### 16.3 Customer PII per seller

Sellers see buyer's:
- Shipping address (required for fulfillment)
- Name
- Phone (required for carrier)
- Order details

Sellers do NOT see:
- Full customer profile
- Other sellers' orders
- Payment details
- Customer's order history with other sellers

### 16.4 KYC + AML compliance

EU AML directive 5 + 6:
- KYC for sellers (legal entity + beneficial owners)
- Sanctions screening
- Suspicious activity reporting (large volumes, unusual patterns)
- Records retained 5 years post-relationship

### 16.5 Marketplace facilitator tax

Per RULE-MKT-022. Platform may be deemed seller for tax purposes in:
- EU (IOSS for non-EU imports ≤€150)
- UK (overseas marketplace transactions)
- US (per state marketplace facilitator laws)

Detail per `15-tax-compliance.md` extended.

### 16.6 Audit

100% audit on:
- Seller status changes
- Tier changes
- Commission updates
- Payouts (incl. holds + releases)
- Dispute resolutions
- Policy violation outcomes
- KYC decisions

### 16.7 Rate limits

| Endpoint | Seller | Customer | Admin |
|---|---|---|---|
| `POST /seller/me/products` | 60/min | n/a | n/a |
| `POST /storefront/marketplace/disputes` | n/a | 5/hour per customer | n/a |
| `POST /storefront/marketplace/sellers/{slug}/messages` | n/a | 30/hour per customer | n/a |
| `POST /marketplace/sellers/{id}:approve` | n/a | n/a | 60/min |
| Payout trigger | n/a | n/a | 10/hour |

---

## 17. Testing

### 17.1 Unit

```
TEST-UNIT-MKT-001  CommissionCalculator (flat/tiered/per_category)
TEST-UNIT-MKT-002  SellerPerformanceScorer
TEST-UNIT-MKT-003  TierAssigner (threshold logic)
TEST-UNIT-MKT-004  MarketplaceOrderSplitter
TEST-UNIT-MKT-005  PayoutLineCalculator (sales - refunds - chargebacks)
TEST-UNIT-MKT-006  DisputeStateMachine
TEST-UNIT-MKT-007  SellerStatusStateMachine
TEST-UNIT-MKT-008  SelfDealingDetector
TEST-UNIT-MKT-009  SanctionsScreener (against test list)
TEST-UNIT-MKT-010  ListingStatusEvaluator
```

### 17.2 Integration

```
TEST-INT-MKT-001   Seller application flow end-to-end
TEST-INT-MKT-002   KYC approval activates seller
TEST-INT-MKT-003   Multi-vendor cart creates parent + child orders
TEST-INT-MKT-004   Payment to platform; Stripe Connect transfers to sellers
TEST-INT-MKT-005   Commission calculated correctly per tier
TEST-INT-MKT-006   Listing approval workflow
TEST-INT-MKT-007   Seller fulfills child order; parent order status updated
TEST-INT-MKT-008   Customer opens dispute → seller responds → resolved
TEST-INT-MKT-009   Dispute escalation to platform mediator
TEST-INT-MKT-010   Refund affects next payout
TEST-INT-MKT-011   Seller suspended → new orders blocked
TEST-INT-MKT-012   Performance metric drop → tier downgrade
TEST-INT-MKT-013   Sanctions match → seller auto-suspended
TEST-INT-MKT-014   Self-dealing detected → order blocked
TEST-INT-MKT-015   Seller review verified purchase enforced
TEST-INT-MKT-016   Multi-currency payout (Stripe Connect FX)
TEST-INT-MKT-017   Payout hold + release
TEST-INT-MKT-018   Failed payout retry
TEST-INT-MKT-019   Marketplace facilitator IOSS calculation
TEST-INT-MKT-020   Cross-seller isolation enforced (RLS)
```

### 17.3 E2E

```
TEST-E2E-MKT-001  Seller signs up, KYCs, lists product, gets first order
TEST-E2E-MKT-002  Customer buys from 3 sellers in single checkout
TEST-E2E-MKT-003  Customer opens dispute, gets refund via platform mediation
TEST-E2E-MKT-004  Seller monthly payout reconciliation
TEST-E2E-MKT-005  Performance-based tier change reflected in search ranking
TEST-E2E-MKT-006  Policy violation → seller warned → suspended
```

### 17.4 Load

```
TEST-LOAD-MKT-001  10k sellers active, 1000 orders/min split processing
TEST-LOAD-MKT-002  Daily performance computation for 10k sellers < 1 hour
TEST-LOAD-MKT-003  Payout 1000 sellers in batch window
```

### 17.5 Compliance

```
TEST-COMPLIANCE-MKT-001  KYC documents stored encrypted
TEST-COMPLIANCE-MKT-002  Sanctions list updated weekly
TEST-COMPLIANCE-MKT-003  Marketplace facilitator tax computed per EU rules
TEST-COMPLIANCE-MKT-004  Audit trail complete for all decisions
TEST-COMPLIANCE-MKT-005  Beneficial owner data captured + retained
```

---

## 18. Implementation checklist

### Backend
- [ ] **[S]** Drizzle schema `packages/db/src/schema/marketplace/*.ts`
- [ ] **[S]** Migrace `20260608_001_create_marketplace_tables.sql`
- [ ] **[XL]** `SellerService` — onboarding, lifecycle, KYC
- [ ] **[L]** `StripeConnectService` — account setup + transfers
- [ ] **[L]** `KycService` — Persona/Onfido integration
- [ ] **[M]** `SanctionsScreener`
- [ ] **[L]** `MarketplaceOrderSplitter`
- [ ] **[L]** `SellerPayoutEngine`
- [ ] **[L]** `SellerPerformanceCalculator`
- [ ] **[M]** `SellerTierAssigner`
- [ ] **[L]** `MarketplaceDisputeService`
- [ ] **[M]** `SellerReviewService`
- [ ] **[M]** `SellerBuyerMessagingService`
- [ ] **[M]** `PolicyViolationService`
- [ ] **[M]** `MarketplaceFacilitatorTaxService` (cross-ref `15`)
- [ ] **[M]** REST endpoints per §9
- [ ] **[M]** GraphQL types + resolvers
- [ ] **[S]** tRPC router (admin + seller)
- [ ] **[S]** MCP tools `marketplace.search`, `marketplace.get_seller` (read-only for agents)

### Background jobs
- [ ] **[L]** JOB-SYNC-STRIPE-CONNECT-ACCOUNT
- [ ] **[M]** JOB-PERFORM-KYC-VERIFICATION
- [ ] **[M]** JOB-SANCTIONS-SCREEN-SELLERS
- [ ] **[L]** JOB-COMPUTE-SELLER-PERFORMANCE-DAILY
- [ ] **[M]** JOB-AUTO-ADJUST-SELLER-TIERS
- [ ] **[L]** JOB-SPLIT-MARKETPLACE-ORDER
- [ ] **[L]** JOB-EXECUTE-SELLER-PAYOUT
- [ ] **[M]** JOB-RETRY-FAILED-PAYOUT
- [ ] **[M]** JOB-RELEASE-PAYOUT-HOLD-AFTER-COOLING-OFF
- [ ] **[S]** JOB-SEND-DISPUTE-RESPONSE-REMINDER
- [ ] **[M]** JOB-AUTO-ESCALATE-OVERDUE-DISPUTES
- [ ] **[S]** JOB-DETECT-SELLER-SELF-DEALING
- [ ] **[M]** JOB-DETECT-FULFILLMENT-SLA-MISSED
- [ ] **[S]** JOB-PUBLISH-MARKETPLACE-FEED
- [ ] **[S]** JOB-SEND-SELLER-PAYOUT-NOTIFICATION
- [ ] **[M]** JOB-MODERATE-AUTO-FLAGGED-REVIEWS
- [ ] **[M]** JOB-RECOMPUTE-SELLER-RATING
- [ ] **[M]** JOB-AUTO-SUSPEND-SELLERS-BELOW-THRESHOLD
- [ ] **[S]** JOB-CLOSE-SUSPENDED-SELLERS-AFTER-90D
- [ ] **[M]** JOB-MARKETPLACE-DAILY-GMV-SNAPSHOT

### Frontend — Platform admin
- [ ] **[L]** Sellers list + detail + lifecycle actions
- [ ] **[M]** Listing review queue
- [ ] **[L]** Dispute mediator dashboard + workflow
- [ ] **[L]** Payouts management + manual triggers
- [ ] **[M]** Policy + violations management
- [ ] **[L]** Marketplace analytics dashboards (GMV, top sellers, commission)
- [ ] **[M]** Seller performance overview per seller
- [ ] **[M]** Marketplace facilitator tax config + reports

### Frontend — Seller dashboard
- [ ] **[L]** Seller onboarding wizard
- [ ] **[L]** Seller home dashboard (orders, sales, ratings)
- [ ] **[L]** Listings management (CRUD + bulk)
- [ ] **[L]** Orders management
- [ ] **[L]** Payouts + statements
- [ ] **[M]** Reviews + responses
- [ ] **[M]** Disputes dashboard
- [ ] **[M]** Messages inbox
- [ ] **[M]** Analytics (own performance)
- [ ] **[M]** Team management (seller_members)
- [ ] **[M]** Storefront customization

### Frontend — Marketplace storefront (customer-facing)
- [ ] **[L]** Marketplace homepage
- [ ] **[L]** Seller storefront pages (per seller)
- [ ] **[M]** Multi-vendor cart UX
- [ ] **[M]** Marketplace search results (with seller info)
- [ ] **[M]** Product detail with seller card + trust signals
- [ ] **[L]** Customer dispute flow
- [ ] **[M]** Seller review submission
- [ ] **[M]** Buyer-seller messaging
- [ ] **[S]** Seller profile pages with reviews

### Tests
- [ ] **[L]** Per §17 (incl. compliance tests)

### Docs
- [ ] **[L]** "Becoming a seller" comprehensive guide
- [ ] **[M]** "Marketplace policies" public document
- [ ] **[M]** "Dispute resolution process" customer guide
- [ ] **[M]** "Payout setup + Stripe Connect" seller guide
- [ ] **[S]** "Marketplace facilitator tax setup" compliance guide
- [ ] **[S]** Developer: marketplace event hooks for plugins
- [ ] **[S]** Customer-facing: "How marketplace works" help articles

---

## 19. Open questions

### Q-MKT-001: Auctions
**Otázka:** Auction-style sales (eBay-like)?

**Status:** Out of scope MVP. Fáze 5+ plugin opportunity.

### Q-MKT-002: Marketplace within marketplace
**Otázka:** Tenant runs marketplace; can their sellers also have own sub-sellers?

**Status:** Out of scope. Avoid nested complexity.

### Q-MKT-003: Cross-border marketplace (multi-region)
**Otázka:** Marketplace serves multiple countries with separate seller pools?

**Status:** Via multi-store per `22-multistore-channels.md`. Each store can have own seller filter.

### Q-MKT-004: Marketplace pricing competition tools
**Otázka:** Sellers see competitor pricing; auto-repricing?

**Status:** Fáze 5+ plugin. Risk: race to bottom, anti-competitive concerns.

### Q-MKT-005: Marketplace advertising platform
**Otázka:** Sponsored listings, banner ads from sellers?

**Status:** Fáze 4+ with `marketplace_sponsored_campaigns`. Pay-per-click model.

### Q-MKT-006: Seller-to-seller communications
**Otázka:** Sellers chat amongst themselves (forum)?

**Status:** Out of scope. Not core to marketplace ops.

### Q-MKT-007: Marketplace loyalty program
**Otázka:** Customer loyalty across all sellers (points apply to any seller)?

**Status:** Fáze 4+ extension. Funded by platform from commission.

### Q-MKT-008: Seller insurance
**Otázka:** Platform offers insurance for high-value shipments?

**Status:** Fáze 5+ partnership feature.

### Q-MKT-009: AI seller verification
**Otázka:** AI scans listings for prohibited items, counterfeit detection?

**Status:** Fáze 4+ via `33-ai-features.md`.

### Q-MKT-010: Dropshipping integration
**Otázka:** Seller uses dropship supplier; how to model?

**Status:** Out of scope marketplace doc. Seller manages own dropship via integrations.

---

## 📅 Změny

| Datum | Změna |
|---|---|
| 2026-05-20 | Initial — Multi-vendor marketplace domain (Fáze 4 activation). Sellers, Stripe Connect payouts, multi-vendor cart, dispute resolution, KYC + AML compliance, seller reviews + tiers + performance, marketplace facilitator tax. |

---

**Konec Marketplace.**

➡️ Phase 4 (Business Functions) **kompletní**. Pokračovat na: [`26-themes-storefront.md`](26-themes-storefront.md) (Phase 5: Platform & Tech).
