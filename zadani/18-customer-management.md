# 18 – CUSTOMER MANAGEMENT

> **Doména:** Customer profile (B2C + B2B-lite), address book, customer groups (segmentation), GDPR consent ledger, authentication (storefront), aggregates (LTV, return rate, …), account merge/delete, identity verification. B2B-lite od MVP (Company membership); plný B2B v `21-b2b-complete.md`.

**Datum:** 2026-05-20
**Verze:** 1.0
**Status:** 🟡 DESIGN
**Reference:** [03 §11](03-data-models-master.md#11-customers--b2b) · [DEC-AUTH-001](01-decisions-registry.md#dec-auth-001-authentication-strategy) · [DEC-SEC-001](01-decisions-registry.md#dec-sec-001-security-baseline) · [12-checkout.md](12-checkout.md) · [16-order-management.md](16-order-management.md) · [17-returns-refunds.md](17-returns-refunds.md)

---

## 📑 Obsah

0. [Domain overview](#0-domain-overview)
1. [References](#1-references)
2. [Personas](#2-personas)
3. [Data models](#3-data-models)
4. [State machines](#4-state-machines)
5. [Authentication & identity](#5-authentication--identity)
6. [Business rules](#6-business-rules)
7. [REST API endpoints](#7-rest-api-endpoints)
8. [GraphQL schema](#8-graphql-schema)
9. [Events](#9-events)
10. [Background jobs](#10-background-jobs)
11. [UI/UX flows](#11-uiux-flows)
12. [Edge cases & error handling](#12-edge-cases--error-handling)
13. [Performance](#13-performance)
14. [Security & GDPR](#14-security--gdpr)
15. [Testing](#15-testing)
16. [Implementation checklist](#16-implementation-checklist)
17. [Open questions](#17-open-questions)

---

## 0. Domain overview

### 0.1 Co tato doména **je**

- **Customer** — B2C nákupčí (separate od `users` = backoffice staff)
- **Addresses** — address book per customer (shipping + billing); ad-hoc adresy v guest checkout
- **Customer groups** — segmentation pro pricing, discounts, channel-specific behavior
- **Customer consents** — GDPR ledger (immutable, per purpose) — append-only
- **Customer authentication** — storefront auth (per [DEC-AUTH-001](01-decisions-registry.md#dec-auth-001-authentication-strategy)): email+password, magic link, passkeys, social
- **Customer aggregates** — LTV, total_orders, return_rate, average_order_value, last_order_at (materialized)
- **Customer tags** — admin segmentation (free-form + curated catalog)
- **Customer notes** — admin/CS notes (internal)
- **Company membership** — B2B-lite link (customer can be member of multiple companies with role)
- **Identity verification** — email verification, optional phone verification, 2FA (TOTP, passkey)
- **Account merge** — duplicate detection + merge workflow
- **Account deletion** — GDPR right-to-erasure (anonymize, preserve accounting records per `15`)
- **Data portability** — GDPR export (JSON of all customer data)
- **Impersonation** — admin "view as customer" debug capability
- **Marketing opt-in** — explicit consent for marketing emails / SMS / personalization
- **Multi-channel identity** — same customer across web, mobile app, POS (unified profile)
- **Customer Lifetime Value (CLV)** computation
- **Customer activity log** — visits, viewed products, abandoned carts (subset; bigger analytics in `20`)

### 0.2 Co tato doména **NENÍ**

- ❌ Backoffice users (`users` tabulka) — different entity per `03 §3 ENT-USER-001`
- ❌ Cart / order / payment specifics (own domains)
- ❌ Marketing automation (→ `19-marketing-seo.md`)
- ❌ Full B2B workflow (quotes, PO approval) → `21-b2b-complete.md`
- ❌ Customer support ticketing (→ Fáze 3+, separate doc; we provide notes here only)
- ❌ Loyalty / rewards programs (→ Fáze 2+ plugin or `19-marketing-seo.md`)
- ❌ Email delivery infrastructure (→ `19-marketing-seo.md` + `29-integrations.md`)
- ❌ Marketplace customer (single profile reused) (→ `25-marketplace.md` Fáze 4)

### 0.3 Diferenciátory

1. **Per-tenant customer scope** — customers per `tenant_id`; no global "Shopio account" (privacy by design)
2. **GDPR ledger first-class** — append-only consent log; full audit of grant/revoke per purpose
3. **Passkeys preferred** ([DEC-AUTH-001](01-decisions-registry.md#dec-auth-001-authentication-strategy)) — passwordless future-ready
4. **B2B-lite od MVP** — Company entity + members linkage (full B2B v1.0+)
5. **Materialized aggregates** — LTV, return_rate cached for query speed; recomputed event-driven
6. **Identity merge graceful** — guest → registered migration without data loss
7. **AI Copilot integration** — semantic search of customers ("show me customers similar to X"); summarization (v2.0+)

---

## 1. References

- [03 §11](03-data-models-master.md#11-customers--b2b) — ENT-CUSTOMER-001 až ENT-COMPANY-002
- [DEC-AUTH-001](01-decisions-registry.md#dec-auth-001-authentication-strategy) — auth strategy
- [DEC-SEC-001](01-decisions-registry.md#dec-sec-001-security-baseline) — security baseline, Argon2id
- [DEC-SEC-002](01-decisions-registry.md#dec-sec-002-secrets-management) — Vault for sensitive material
- [12-checkout.md](12-checkout.md) — customer creation during checkout
- [16-order-management.md](16-order-management.md) — customer's order list, aggregates
- [17-returns-refunds.md](17-returns-refunds.md) — return rate aggregate
- [13-payments.md](13-payments.md) — saved payment methods
- [10-pricing-promotions.md](10-pricing-promotions.md) — customer group pricing
- [21-b2b-complete.md](21-b2b-complete.md) — full B2B (Fáze 2)
- [19-marketing-seo.md](19-marketing-seo.md) — marketing automation, abandoned cart recovery
- [30-security.md](30-security.md) — fraud, encryption
- [22-multistore-channels.md](22-multistore-channels.md) — customer per channel
- EU GDPR (Regulation 2016/679)
- EU eIDAS (electronic identification)
- WebAuthn / FIDO2 spec (passkeys)

---

## 2. Personas

| Persona | Použití | Klíčové permissions |
|---|---|---|
| `PERSONA-MERCHANT-OWNER` | Full customer management | `PERM-CUSTOMER-*` |
| `PERSONA-CUSTOMER-SERVICE` | View, edit, impersonate, merge, delete (GDPR) | `PERM-CUSTOMER-VIEW`, `PERM-CUSTOMER-EDIT`, `PERM-CUSTOMER-IMPERSONATE`, `PERM-CUSTOMER-DELETE` |
| `PERSONA-MARKETING-MANAGER` | View segments, tag management, export for campaigns | `PERM-CUSTOMER-VIEW`, `PERM-CUSTOMER-SEGMENT-EXPORT`, `PERM-CUSTOMER-TAG-MANAGE` |
| `PERSONA-MERCHANT-VIEWER` | Read-only | `PERM-CUSTOMER-VIEW` |
| `PERSONA-CUSTOMER` | Own profile, addresses, password, addresses, marketing prefs | Auth-gated to own customer_id |
| `PERSONA-B2B-EMPLOYEE` | Own profile + company colleagues' visibility (per role) | Auth + company context |
| `PERSONA-GUEST` | No persistent identity; tracked by session | No PERM |
| `PERSONA-COMPLIANCE-OFFICER` | GDPR requests, audit | `PERM-CUSTOMER-GDPR-MANAGE`, `PERM-CUSTOMER-AUDIT-VIEW` |
| `PERSONA-AI-COPILOT` | Suggest segments, anomaly detection, summarization | `agent:customer:read` |
| `PERSONA-EXTERNAL-AGENT` | Limited: own profile read (per customer agent token) | `agent:profile:read` |

---

## 3. Data models

### 3.1 `customers` ([ENT-CUSTOMER-001](03-data-models-master.md#ent-customer-001))

```sql
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  pub_id TEXT NOT NULL,                                              -- cus_ NanoID
  -- identity
  email CITEXT NOT NULL,
  email_verified_at TIMESTAMPTZ NULL,
  email_verification_token_hash TEXT NULL,
  email_verification_sent_at TIMESTAMPTZ NULL,
  password_hash TEXT NULL,                                            -- Argon2id; NULL for OAuth-only or magic-link-only
  -- profile
  first_name TEXT NULL,
  last_name TEXT NULL,
  full_name TEXT GENERATED ALWAYS AS (
    TRIM(COALESCE(first_name,'') || ' ' || COALESCE(last_name,''))
  ) STORED,
  phone TEXT NULL,                                                     -- E.164
  phone_verified_at TIMESTAMPTZ NULL,
  birth_date DATE NULL,
  gender TEXT NULL CHECK (gender IN ('female','male','non_binary','prefer_not_to_say') OR gender IS NULL),
  default_locale TEXT NOT NULL,                                         -- BCP-47
  default_currency CHAR(3) NULL,
  tax_id TEXT NULL,                                                     -- DIČ for sole proprietors
  -- consent (snapshot of last-known state for fast filtering; full ledger in customer_consents)
  accepts_marketing BOOLEAN NOT NULL DEFAULT false,
  marketing_consent_at TIMESTAMPTZ NULL,
  accepts_sms_marketing BOOLEAN NOT NULL DEFAULT false,
  sms_marketing_consent_at TIMESTAMPTZ NULL,
  accepts_personalization BOOLEAN NOT NULL DEFAULT false,
  personalization_consent_at TIMESTAMPTZ NULL,
  -- status
  status TEXT NOT NULL CHECK (status IN ('active','disabled','locked','anonymized','pending_verification')) DEFAULT 'pending_verification',
  status_reason TEXT NULL,
  locked_until TIMESTAMPTZ NULL,                                         -- brute force lockout
  last_login_at TIMESTAMPTZ NULL,
  last_seen_at TIMESTAMPTZ NULL,                                          -- any auth activity (logout, page view if logged in)
  failed_login_count INTEGER NOT NULL DEFAULT 0,
  -- 2FA
  is_2fa_enabled BOOLEAN NOT NULL DEFAULT false,
  totp_secret_encrypted BYTEA NULL,                                       -- pgcrypto/Vault
  backup_codes_hash JSONB NULL,                                            -- ["argon2id_hash", ...]
  -- aggregates (materialized; recomputed event-driven)
  total_orders INTEGER NOT NULL DEFAULT 0,
  total_spent_amount BIGINT NOT NULL DEFAULT 0,
  total_spent_currency CHAR(3) NULL,                                       -- tenant default at last compute
  total_refunded_amount BIGINT NOT NULL DEFAULT 0,
  average_order_value_amount BIGINT NULL,
  last_order_at TIMESTAMPTZ NULL,
  first_order_at TIMESTAMPTZ NULL,
  return_count INTEGER NOT NULL DEFAULT 0,
  return_rate_basis_points INTEGER NULL,                                    -- 1500 = 15.00%
  abandoned_carts_count INTEGER NOT NULL DEFAULT 0,
  -- fraud / risk
  risk_score INTEGER NULL,                                                  -- 0-100
  is_high_risk BOOLEAN NOT NULL DEFAULT false,
  fraud_flags TEXT[] NOT NULL DEFAULT '{}',
  -- tags + notes
  tags TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT NULL,                                                          -- admin notes
  -- attribution at signup
  signup_source TEXT NULL,                                                  -- 'storefront','checkout_creation','import','admin_invited','social_oauth'
  signup_channel_id UUID NULL REFERENCES channels(id),
  signup_referrer TEXT NULL,
  signup_utm JSONB NULL,
  signup_ip_hash TEXT NULL,                                                  -- anonymized
  signup_country_code CHAR(2) NULL,
  -- preferences
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,                            -- ad-hoc UI prefs (theme, currency display, ...)
  -- merged
  merged_into_customer_id UUID NULL REFERENCES customers(id),                 -- after merge
  merged_at TIMESTAMPTZ NULL,
  -- anonymization (GDPR)
  anonymized_at TIMESTAMPTZ NULL,
  anonymization_reason TEXT NULL,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL,                                                -- soft delete pro retention
  created_by_actor_kind TEXT NULL,
  created_by_actor_id UUID NULL,
  version INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_customers_tenant_email UNIQUE (tenant_id, email) DEFERRABLE INITIALLY IMMEDIATE,
  CONSTRAINT uq_customers_pub_id UNIQUE (tenant_id, pub_id)
);

CREATE INDEX idx_customers_tenant_status ON customers (tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers_last_order ON customers (tenant_id, last_order_at DESC NULLS LAST);
CREATE INDEX idx_customers_total_spent ON customers (tenant_id, total_spent_amount DESC);
CREATE INDEX idx_customers_high_risk ON customers (tenant_id) WHERE is_high_risk = true;
CREATE INDEX idx_customers_tags_gin ON customers USING GIN (tags);
CREATE INDEX idx_customers_full_name ON customers (tenant_id, full_name) WHERE full_name IS NOT NULL;
CREATE INDEX idx_customers_phone ON customers (tenant_id, phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_customers_accepting_marketing ON customers (tenant_id) WHERE accepts_marketing = true AND deleted_at IS NULL;
```

### 3.2 `addresses` ([ENT-CUSTOMER-002](03-data-models-master.md#ent-customer-002))

```sql
CREATE TABLE addresses (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  customer_id UUID NULL REFERENCES customers(id) ON DELETE CASCADE,           -- NULL = ad-hoc / tenant address
  company_id UUID NULL REFERENCES companies(id),
  -- kind
  kind TEXT NOT NULL CHECK (kind IN ('shipping','billing','both','tenant_return','warehouse')) DEFAULT 'both',
  is_default BOOLEAN NOT NULL DEFAULT false,
  nickname TEXT NULL,                                                          -- 'Home', 'Office', 'Mom's place'
  -- snapshot fields (immutable when used in order)
  recipient_name TEXT NOT NULL,
  company_name TEXT NULL,
  street1 TEXT NOT NULL,
  street2 TEXT NULL,
  city TEXT NOT NULL,
  region TEXT NULL,                                                            -- state / kraj
  postal_code TEXT NOT NULL,
  country_code CHAR(2) NOT NULL,
  phone TEXT NULL,
  -- geo (optional, computed via geocoding)
  latitude NUMERIC(9,6) NULL,
  longitude NUMERIC(9,6) NULL,
  validated_at TIMESTAMPTZ NULL,                                               -- last successful address validation
  validation_source TEXT NULL,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL,
  version INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT ck_address_owner CHECK (
    -- address must belong to someone OR be tenant_return/warehouse kind
    customer_id IS NOT NULL OR company_id IS NOT NULL OR
    kind IN ('tenant_return','warehouse')
  )
);

CREATE UNIQUE INDEX uq_addresses_customer_default
  ON addresses (customer_id, kind)
  WHERE is_default = true AND deleted_at IS NULL AND customer_id IS NOT NULL AND kind IN ('shipping','billing');

CREATE INDEX idx_addresses_customer ON addresses (customer_id) WHERE deleted_at IS NULL AND customer_id IS NOT NULL;
CREATE INDEX idx_addresses_company ON addresses (company_id) WHERE deleted_at IS NULL AND company_id IS NOT NULL;
```

### 3.3 `customer_groups` ([ENT-CUSTOMER-003](03-data-models-master.md#ent-customer-003))

```sql
CREATE TABLE customer_groups (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT NULL,
  default_price_list_id UUID NULL REFERENCES price_lists(id),                    -- pricing impact
  default_tax_class_override TEXT NULL,                                           -- if entire group is tax-exempt
  is_default BOOLEAN NOT NULL DEFAULT false,                                       -- default group for new customers
  is_system BOOLEAN NOT NULL DEFAULT false,                                        -- system groups (Retail, VIP, Wholesale) not deletable
  -- auto-assignment rules (Fáze 2 dynamic groups)
  auto_assignment_rules JSONB NULL,                                                -- e.g., "total_spent > 50000 → VIP"
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL,
  version INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_customer_groups_tenant_slug UNIQUE (tenant_id, slug),
  CONSTRAINT uq_customer_groups_tenant_name UNIQUE (tenant_id, name)
);

CREATE UNIQUE INDEX uq_customer_groups_default
  ON customer_groups (tenant_id)
  WHERE is_default = true AND deleted_at IS NULL;
```

### 3.4 `customer_group_members`

```sql
CREATE TABLE customer_group_members (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  customer_group_id UUID NOT NULL REFERENCES customer_groups(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by_actor_kind TEXT NOT NULL CHECK (assigned_by_actor_kind IN ('user','system','rule','import')),
  assigned_by_actor_id UUID NULL,
  expires_at TIMESTAMPTZ NULL,                                                    -- for temporary VIP membership
  notes TEXT NULL,

  CONSTRAINT uq_customer_group_members UNIQUE (customer_id, customer_group_id)
);

CREATE INDEX idx_customer_group_members_customer ON customer_group_members (customer_id);
CREATE INDEX idx_customer_group_members_group ON customer_group_members (customer_group_id);
CREATE INDEX idx_customer_group_members_expires ON customer_group_members (expires_at) WHERE expires_at IS NOT NULL;
```

### 3.5 `customer_consents` ([ENT-CUSTOMER-004](03-data-models-master.md#ent-customer-004))

Append-only GDPR consent ledger.

```sql
CREATE TABLE customer_consents (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN (
    'marketing_email','marketing_sms','marketing_push',
    'personalization','profiling','third_party_sharing',
    'analytics','functional_cookies','marketing_cookies',
    'newsletter','product_updates','sms_order_updates',
    'session_replay','search_personalization'
  )),
  granted BOOLEAN NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),                                  -- when grant or revoke happened
  revoked_at TIMESTAMPTZ NULL,                                                    -- set when this specific row was overridden
  source TEXT NOT NULL CHECK (source IN (
    'signup','checkout','preferences_page','cookie_banner','admin','import','api','sms_reply_stop'
  )),
  policy_version TEXT NULL,                                                       -- reference to terms / privacy version
  legal_basis TEXT NOT NULL CHECK (legal_basis IN ('consent','contract','legitimate_interest','legal_obligation','vital_interest','public_task')) DEFAULT 'consent',
  consent_text_hash TEXT NULL,                                                    -- hash of exact consent text shown
  consent_locale TEXT NULL,
  ip_hash TEXT NULL,                                                              -- anonymized
  user_agent_family TEXT NULL,
  -- audit
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_customer_consents_customer ON customer_consents (customer_id, purpose, granted_at DESC);
CREATE INDEX idx_customer_consents_current ON customer_consents (customer_id, purpose) WHERE revoked_at IS NULL;
```

**Latest consent per purpose** = max(granted_at) where revoked_at IS NULL. Helper view or materialized cache.

### 3.6 `customer_auth_methods`

Per-customer authentication identities (email/password, social, passkey).

```sql
CREATE TABLE customer_auth_methods (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('password','passkey','magic_link','google','apple','facebook','github','microsoft','oidc')),
  identifier TEXT NULL,                                                            -- email for password+magic; subject_id for OIDC; passkey credential_id
  provider_metadata JSONB NULL,                                                    -- provider-specific
  passkey_public_key BYTEA NULL,                                                   -- WebAuthn public key (for passkeys)
  passkey_aaguid UUID NULL,                                                        -- authenticator model
  passkey_sign_count INTEGER NOT NULL DEFAULT 0,
  passkey_name TEXT NULL,                                                          -- user-friendly name ("MacBook fingerprint", "iPhone")
  last_used_at TIMESTAMPTZ NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ NULL,
  revoked_reason TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_customer_auth_methods_identifier UNIQUE (tenant_id, kind, identifier) DEFERRABLE INITIALLY IMMEDIATE
);

CREATE INDEX idx_customer_auth_methods_customer ON customer_auth_methods (customer_id, kind) WHERE revoked_at IS NULL;
CREATE INDEX idx_customer_auth_methods_lookup ON customer_auth_methods (tenant_id, kind, identifier) WHERE revoked_at IS NULL;
```

### 3.7 `customer_sessions`

Active customer storefront sessions (separate from staff sessions in `03 §3 ENT-SESSION-001`).

```sql
CREATE TABLE customer_sessions (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  channel_id UUID NULL REFERENCES channels(id),
  device_kind TEXT NULL CHECK (device_kind IN ('desktop','mobile_web','mobile_app','pos','smart_tv') OR device_kind IS NULL),
  device_fingerprint TEXT NULL,
  user_agent_family TEXT NULL,
  ip_hash TEXT NULL,
  country_code CHAR(2) NULL,
  city TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ NULL,
  revoked_reason TEXT NULL,
  -- 2FA verification status
  mfa_verified_at TIMESTAMPTZ NULL,
  mfa_method_used TEXT NULL                                                         -- 'totp','passkey','backup_code','sms'
);

CREATE INDEX idx_customer_sessions_customer ON customer_sessions (customer_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_customer_sessions_expires ON customer_sessions (expires_at) WHERE revoked_at IS NULL;
```

### 3.8 `customer_login_attempts`

Failed login tracking for rate limiting + fraud detection.

```sql
CREATE TABLE customer_login_attempts (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  email_attempted CITEXT NOT NULL,
  customer_id UUID NULL REFERENCES customers(id),
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  succeeded BOOLEAN NOT NULL,
  failure_reason TEXT NULL,
  ip_hash TEXT NULL,
  user_agent_family TEXT NULL,
  country_code CHAR(2) NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
) PARTITION BY RANGE (attempted_at);

CREATE INDEX idx_customer_login_attempts_email ON customer_login_attempts (tenant_id, email_attempted, attempted_at DESC);
CREATE INDEX idx_customer_login_attempts_ip ON customer_login_attempts (ip_hash, attempted_at DESC) WHERE succeeded = false;
CREATE INDEX brin_customer_login_attempts_attempted ON customer_login_attempts USING BRIN (attempted_at);
```

Retention: 90 dní (fraud forensics).

### 3.9 `companies` ([ENT-COMPANY-001](03-data-models-master.md#ent-company-001))

B2B-lite entity. Detail v `21-b2b-complete.md` Fáze 2.

```sql
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  pub_id TEXT NOT NULL,                                                              -- cmp_ NanoID
  name TEXT NOT NULL,
  legal_name TEXT NULL,
  registration_number TEXT NULL,                                                     -- IČO (CZ), Handelsregister (DE), …
  vat_id TEXT NULL,                                                                  -- DIČ / USt-IdNr
  vies_validated_at TIMESTAMPTZ NULL,
  ares_validated_at TIMESTAMPTZ NULL,
  industry TEXT NULL,
  size_category TEXT NULL CHECK (size_category IN ('micro','small','medium','large','enterprise') OR size_category IS NULL),
  website_url TEXT NULL,
  default_billing_address_id UUID NULL REFERENCES addresses(id),
  default_shipping_address_id UUID NULL REFERENCES addresses(id),
  default_price_list_id UUID NULL REFERENCES price_lists(id),
  default_payment_terms_days INTEGER NULL,                                           -- NET 30/60
  credit_limit_amount BIGINT NULL,
  credit_limit_currency CHAR(3) NULL,
  account_status TEXT NOT NULL CHECK (account_status IN ('pending','approved','suspended','closed')) DEFAULT 'pending',
  account_manager_user_id UUID NULL REFERENCES users(id),                              -- staff rep
  notes TEXT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL,
  version INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_companies_pub_id UNIQUE (tenant_id, pub_id),
  CONSTRAINT uq_companies_registration UNIQUE (tenant_id, registration_number) DEFERRABLE INITIALLY IMMEDIATE
);

CREATE INDEX idx_companies_tenant_status ON companies (tenant_id, account_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_companies_vat_id ON companies (vat_id) WHERE vat_id IS NOT NULL;
```

### 3.10 `company_members` ([ENT-COMPANY-002](03-data-models-master.md#ent-company-002))

```sql
CREATE TABLE company_members (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner','admin','buyer','approver','viewer','accountant')),
  purchase_limit_amount BIGINT NULL,
  purchase_limit_currency CHAR(3) NULL,
  can_view_all_orders BOOLEAN NOT NULL DEFAULT false,                                  -- vs just own
  can_request_quote BOOLEAN NOT NULL DEFAULT true,
  invited_at TIMESTAMPTZ NULL,
  joined_at TIMESTAMPTZ NULL,
  invited_by_customer_id UUID NULL REFERENCES customers(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_company_members UNIQUE (company_id, customer_id)
);

CREATE INDEX idx_company_members_company ON company_members (company_id) WHERE is_active = true;
CREATE INDEX idx_company_members_customer ON company_members (customer_id) WHERE is_active = true;
```

### 3.11 `customer_segments` *(Fáze 2 — saved filter sets)*

```sql
CREATE TABLE customer_segments (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT NULL,
  filter_dsl JSONB NOT NULL,                                                          -- filter expression
  is_dynamic BOOLEAN NOT NULL DEFAULT true,                                            -- live query vs materialized
  member_count INTEGER NULL,                                                            -- if materialized
  last_recomputed_at TIMESTAMPTZ NULL,
  created_by_user_id UUID NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_customer_segments_name UNIQUE (tenant_id, name)
);
```

### 3.12 `customer_activity_log` *(lightweight; deep analytics → `20`)*

```sql
CREATE TABLE customer_activity_log (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  activity_kind TEXT NOT NULL CHECK (activity_kind IN (
    'login','logout','password_changed','email_changed','address_added','address_changed',
    'consent_granted','consent_revoked','2fa_enabled','2fa_disabled',
    'profile_updated','impersonated_by_staff','account_merged','account_anonymized',
    'failed_login','password_reset_requested'
  )),
  actor_kind TEXT NOT NULL CHECK (actor_kind IN ('customer','user','system','agent')),
  actor_id UUID NULL,
  ip_hash TEXT NULL,
  user_agent_family TEXT NULL,
  country_code CHAR(2) NULL,
  context JSONB NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
) PARTITION BY RANGE (occurred_at);

CREATE INDEX idx_customer_activity_log_customer ON customer_activity_log (customer_id, occurred_at DESC);
CREATE INDEX brin_customer_activity_log_occurred ON customer_activity_log USING BRIN (occurred_at);
```

Retention: 365 dní (GDPR + audit).

### 3.13 `customer_merges` *(audit of merge operations)*

```sql
CREATE TABLE customer_merges (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  primary_customer_id UUID NOT NULL REFERENCES customers(id),
  merged_customer_id UUID NOT NULL REFERENCES customers(id),
  reason TEXT NULL,
  performed_by_user_id UUID NOT NULL,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  changes_summary JSONB NOT NULL,                                                       -- what moved where
  is_reversible BOOLEAN NOT NULL DEFAULT false,                                          -- can we undo?
  reverted_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_customer_merges_primary ON customer_merges (primary_customer_id);
CREATE INDEX idx_customer_merges_merged ON customer_merges (merged_customer_id);
```

### 3.14 `gdpr_requests` *(GDPR data subject requests)*

```sql
CREATE TABLE gdpr_requests (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  pub_id TEXT NOT NULL,                                                                   -- gdr_ NanoID
  customer_id UUID NULL REFERENCES customers(id),
  customer_email_at_request CITEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('export','delete','rectification','restriction','portability','withdraw_consent')),
  reason TEXT NULL,
  status TEXT NOT NULL CHECK (status IN ('received','verified','in_progress','completed','rejected','expired')) DEFAULT 'received',
  identity_verification_token_hash TEXT NULL,
  identity_verified_at TIMESTAMPTZ NULL,
  legal_deadline_at TIMESTAMPTZ NOT NULL,                                                 -- 30 days from receipt per GDPR
  completed_at TIMESTAMPTZ NULL,
  rejected_at TIMESTAMPTZ NULL,
  rejection_reason TEXT NULL,
  export_storage_key TEXT NULL,                                                            -- S3 path to JSON export
  export_expires_at TIMESTAMPTZ NULL,
  handled_by_user_id UUID NULL,
  notes TEXT NULL,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_gdpr_requests_pub_id UNIQUE (tenant_id, pub_id)
);

CREATE INDEX idx_gdpr_requests_status ON gdpr_requests (tenant_id, status, legal_deadline_at);
CREATE INDEX idx_gdpr_requests_customer ON gdpr_requests (customer_id) WHERE customer_id IS NOT NULL;
```

### 3.15 Vztahy

```
tenants (1)──(N) customers
customers (1)──(N) addresses                  [own address book]
customers (1)──(N) customer_consents          [GDPR ledger]
customers (1)──(N) customer_auth_methods
customers (1)──(N) customer_sessions
customers (1)──(N) customer_activity_log
customers (N)──(M) customer_groups            [via customer_group_members]
customers (N)──(M) companies                  [via company_members; B2B-lite]
customers (1)──(N) orders                     [from `16`]
customers (1)──(N) returns                    [from `17`]
customers (1)──(N) saved_payment_methods      [from `13`]
customers (1)──(N) carts                      [from `11`]
customers (1)──(N) gdpr_requests
customers (0..1)──(1) customers               [merged_into_customer_id]
companies (1)──(N) company_members
companies (1)──(N) orders                     [B2B order linkage]
customer_groups (1)──(N) price_lists          [pricing impact]
```

---

## 4. State machines

### 4.1 Customer status lifecycle

```
[pending_verification] ──email verified──▶ [active]
        │                                       │
        │ admin manual activate                 │ admin disables
        ▼                                       ▼
   [active]                              [disabled]
        │                                       │
        │ brute-force lockout                   │ reactivate
        ▼                                       │
   [locked] (auto-unlocks after locked_until)   │
        │                                       │
        └─── admin manual unlock ───────────────┘
                                                │
                                                │ GDPR right-to-erasure
                                                ▼
                                       [anonymized] (terminal)
```

Transitions:

| From | Event | To | Trigger |
|---|---|---|---|
| `(none)` | `signup` | `pending_verification` | New customer registration |
| `(none)` | `created_by_admin` | `active` (or pending) | Admin imports / invites |
| `pending_verification` | `verify_email` | `active` | Customer clicks email link |
| `active` | `admin_disable` | `disabled` | Admin action |
| `disabled` | `admin_reactivate` | `active` | |
| `active` | `lock_brute_force` | `locked` | 5+ failed logins (configurable) |
| `locked` | `auto_unlock` (`locked_until` passed) | `active` | System |
| `locked` | `admin_unlock` | `active` | |
| any | `gdpr_delete_executed` | `anonymized` | After GDPR delete saga |

### 4.2 GDPR request lifecycle

```
[received] ──identity verified──▶ [verified] ──processing started──▶ [in_progress]
     │                                                                       │
     │ rejected (suspicious / no proof)                                       │ saga done
     ▼                                                                       ▼
[rejected]                                                              [completed]
     │
     └─── expired (30-day deadline passed without action) ──▶ [expired] (rare; legally non-compliant)
```

### 4.3 Account merge flow

```
[Two customers detected as duplicate]
  ▼
admin reviews proposal
  ▼
[Approved merge]
  ▼
Saga (atomic):
  1. Identify primary (kept) and merged (deleted) customer
  2. Move all addresses to primary (deduplicate identical)
  3. Move all orders' customer_id to primary (snapshot fields immutable)
  4. Move all carts to primary (active carts)
  5. Move all returns customer_id to primary
  6. Move all saved_payment_methods to primary
  7. Move all company_members to primary (dedupe)
  8. Move all customer_consents to primary (preserve most-recent per purpose)
  9. Update aggregates on primary (re-sum)
  10. Set merged customer status='anonymized', merged_into_customer_id, merged_at
  11. Write customer_merges row with change summary
  12. Emit EVENT-CUSTOMER-MERGED
```

### 4.4 Account anonymization flow (GDPR delete)

```
[GDPR delete request approved]
  ▼
Saga:
  1. Anonymize PII in customers row:
     - email → 'anonymized-{customer_id}@deleted.local'
     - first_name, last_name, phone, birth_date → NULL
     - tags, notes → cleared
     - status='anonymized'
     - anonymized_at = now()
  2. Anonymize addresses (per RULE-CUST-027)
  3. Anonymize order snapshots PII (per `16 RULE-ORDER-030`)
  4. Revoke all customer_auth_methods, customer_sessions
  5. Soft-delete saved_payment_methods, cascade detach at providers (per `13`)
  6. Anonymize customer_activity_log (keep events for retention, scrub PII)
  7. Anonymize return notes (per `17 RULE-RTN-030`)
  8. Keep accounting/legal records (invoices retained per `15 RULE-TAX-030`)
  9. Emit EVENT-CUSTOMER-ANONYMIZED
  10. Mark gdpr_requests.status='completed'
```

---

## 5. Authentication & identity

Per [DEC-AUTH-001](01-decisions-registry.md#dec-auth-001-authentication-strategy). Storefront customer auth detail.

### 5.1 Authentication methods

| Method | UX | Backend |
|---|---|---|
| **Email + password** | Classic form | Argon2id hash; password reset via email |
| **Magic link** | "Email me a login link" — passwordless | Signed token; single-use; 15-min TTL |
| **Passkey (WebAuthn)** | Biometric / device auth — preferred | FIDO2 credential stored; sign_count checked |
| **Google OAuth** | "Sign in with Google" | OIDC flow |
| **Apple Sign In** | iOS / Safari | OIDC flow |
| **Facebook OAuth** | Optional | OIDC-ish |
| **Microsoft OAuth** | B2B context | OIDC |

Tenant configures which methods enabled. Default: email+password + magic link + passkey.

### 5.2 Session model

- Session cookie `shopio_session` (HttpOnly, Secure, SameSite=Lax)
- Session token = opaque random 32 bytes
- Backed by `customer_sessions` row (DB-persisted; not JWT for revocability)
- Refresh: sliding extend on activity, max 30 days absolute
- Multi-device: customer can have multiple active sessions; "logout all" revokes all

### 5.3 2FA / MFA

- TOTP (Google Authenticator, 1Password, Authy)
- Backup codes (10 codes, single-use, hashed)
- Passkey (counts as 2nd factor when used alongside password)
- SMS code (v1.0+, opt-in; not preferred per OWASP)

`is_2fa_enabled=true` requires MFA verification per session (`customer_sessions.mfa_verified_at`).

### 5.4 Password requirements

Per [DEC-SEC-001](01-decisions-registry.md#dec-sec-001-security-baseline):
- Min length 12 characters
- No max length (passphrases encouraged)
- Reject common passwords (HaveIBeenPwned check optional, Fáze 2)
- No forced complexity rules (NIST guidance: length matters more)
- No password rotation policy (NIST: rotation harmful unless suspected compromise)

### 5.5 Brute-force protection

- Per customer email: 5 failed attempts → lock 15 min (configurable)
- Per IP: 100 failed attempts/hour → IP ban (manual unblock)
- CAPTCHA after 3 failed attempts (Fáze 2)

### 5.6 Magic link flow

```
1. Customer enters email → POST /storefront/auth/magic-link
2. Server: if customer exists OR signup mode → generate signed token (15 min)
3. Email customer with link `/storefront/auth/magic-callback?token=...`
4. Customer clicks → server validates token → creates session
5. First click invalidates token (single-use)
```

### 5.7 Passkey flow (WebAuthn)

```
Registration (post-login):
1. Client requests `/storefront/auth/passkey/register-start` → server returns challenge
2. Browser invokes `navigator.credentials.create({ publicKey: ... })`
3. User authenticates with biometric
4. Client sends credential to `/storefront/auth/passkey/register-finish`
5. Server stores `customer_auth_methods` row with public key

Authentication:
1. Client requests `/storefront/auth/passkey/login-start` (optionally with email)
2. Server returns challenge
3. Browser invokes `navigator.credentials.get({ publicKey: ... })`
4. User authenticates
5. Client sends assertion to `/storefront/auth/passkey/login-finish`
6. Server verifies signature with stored public key → creates session
```

### 5.8 OAuth flows

Standard OIDC code flow with PKCE:
1. Customer clicks "Sign in with Google"
2. Redirect to Google with state + PKCE challenge
3. Google authenticates
4. Callback to our `/storefront/auth/oauth/callback`
5. Exchange code for tokens
6. Fetch user info (email, name)
7. Match by email OR create new customer
8. Create session

Per-provider OAuth client credentials stored in Vault per tenant.

### 5.9 Identity merge on linking

If customer signs in via Google with email matching existing password-based customer:
- Prompt: "An account with this email exists. Link?"
- On confirm: add `customer_auth_methods` row kind='google', keep existing customer profile

---

## 6. Business rules

### RULE-CUST-001: Per-tenant scope

Customer is per `tenant_id`. Same person at 2 different tenants = 2 separate customers (privacy).

Email unique per tenant only: `uq_customers_tenant_email`.

### RULE-CUST-002: Pending verification customers

New customer status `pending_verification`. Can still:
- Place orders (guest-like; verification deferred)
- Receive emails

Cannot:
- Save payment methods
- Access full account features
- Receive marketing emails (require verified)

After verification: status='active'. Tenant configurable: `require_email_verification_for_account` (default true) vs allow unverified accounts.

### RULE-CUST-003: Guest → registered upgrade

If guest checkout email matches existing customer: link order to that customer, retain customer's profile.

If new email and customer opts to create account post-checkout: build customer profile from order; signup_source='checkout_creation'; require email verification.

### RULE-CUST-004: Customer can have multiple addresses

No hard limit (configurable per tenant, default 50). 1 default shipping + 1 default billing per customer (partial unique index).

Address used in orders is **snapshotted** into `order.shipping_address_snapshot` — editing address book later doesn't change past orders.

### RULE-CUST-005: Customer groups assignment

- Default group at signup (e.g., "Retail") — auto-assigned
- Manual admin assignment to other groups
- Dynamic assignment (Fáze 2) via `customer_groups.auto_assignment_rules` (e.g., "total_spent > 50000 → VIP")

Customer can belong to multiple groups. Pricing engine (`10-pricing-promotions.md`) uses highest-priority group for price_list resolution.

### RULE-CUST-006: Consent ledger immutability

`customer_consents` is append-only. Revoking grants = INSERT new row with `granted=false`. Current consent = latest row per purpose.

Helper view `v_customer_current_consents`:
```sql
SELECT DISTINCT ON (customer_id, purpose) *
FROM customer_consents
WHERE revoked_at IS NULL
ORDER BY customer_id, purpose, granted_at DESC;
```

### RULE-CUST-007: Consent purposes are EU-aligned

- `marketing_email`, `marketing_sms`: explicit opt-in required
- `analytics`, `functional_cookies`: legitimate interest acceptable for analytics
- `personalization`, `profiling`: explicit opt-in (GDPR Art. 22 profiling)
- `third_party_sharing`: explicit opt-in
- `session_replay`: explicit opt-in (could capture PII)

Cookie banner gathers consents at first visit; storefront preferences page lets customer edit.

### RULE-CUST-008: Aggregate fields recomputed event-driven

- `EVENT-ORDER-PLACED` → increment `total_orders`, `total_spent_amount`, update `last_order_at`, `first_order_at`
- `EVENT-ORDER-REFUNDED` → adjust `total_spent_amount`, `total_refunded_amount`
- `EVENT-RETURN-REFUNDED` → increment `return_count`, recompute `return_rate_basis_points`
- `EVENT-CART-ABANDONED` → increment `abandoned_carts_count`

Source of truth: orders, returns tables. Aggregate fields = read-side cache. Daily reconciliation job (`JOB-RECONCILE-CUSTOMER-AGGREGATES`) catches drift.

### RULE-CUST-009: Soft delete vs anonymization

- **Soft delete** (`deleted_at` set): customer record retained, hidden from UI; can be undeleted
- **Anonymization** (`anonymized_at` set, status='anonymized'): PII scrubbed; record retained for accounting; cannot be undone

GDPR delete = anonymization (per RULE-CUST-027). Soft delete = admin action without legal force.

### RULE-CUST-010: Account merge requires admin

Customer cannot self-initiate merge (security: prevent account takeover). Admin reviews + approves merge after detecting duplicate.

Merge candidate detection signals:
- Same email (case-insensitive)
- Same phone number
- Same shipping address + name
- Same payment method fingerprint

`JOB-DETECT-DUPLICATE-CUSTOMERS` (weekly) creates draft merge proposals; admin approves.

### RULE-CUST-011: Anonymized customer immutable

After `status='anonymized'`, no further changes allowed. Soft constraint via app layer + audit.

### RULE-CUST-012: Identity verification token TTL

- Email verification: 24 hours
- Password reset: 1 hour
- Magic link: 15 minutes
- Phone verification (SMS): 5 minutes

Single-use; expire after use.

### RULE-CUST-013: Password reset flow

```
1. Customer enters email → POST /storefront/auth/password-reset
2. Server: rate-limited (3/hour per email + IP)
3. If customer exists: generate signed token, email link
4. Customer clicks → token validation form for new password
5. New password set (Argon2id), token invalidated
6. All existing sessions revoked (security)
7. Email customer "Your password was changed"
```

Email always sent (regardless of existence) to prevent email enumeration.

### RULE-CUST-014: Email change requires re-verification

Customer changes email in preferences:
- New email set as pending; current email still active
- Verification email sent to new address
- On verify: email switches; old email deactivated
- Old sessions kept (no immediate impact)

### RULE-CUST-015: Phone change verification

Optional (configurable). SMS code to new number; verify before set.

### RULE-CUST-016: 2FA enrollment flow

```
1. Customer enables 2FA in preferences
2. Server generates TOTP secret
3. QR code displayed for Google Authenticator
4. Customer enters 6-digit code to verify
5. Backup codes shown (10 codes, save now)
6. is_2fa_enabled = true
```

Disabling 2FA requires current password + TOTP code (security).

### RULE-CUST-017: Session security

- HttpOnly + Secure + SameSite=Lax cookies
- Session token rotated on privilege escalation (login, password change)
- CSRF tokens for state-changing requests
- IP / device fingerprint anomaly → re-challenge (Fáze 2)

### RULE-CUST-018: Impersonation audit

Admin impersonation: `PERM-CUSTOMER-IMPERSONATE` required. Audit log entry mandatory:
- Actor user_id
- Target customer_id
- Reason free-text
- Session ID (impersonation session distinct from regular session)
- Duration

Impersonation banner visible in admin UI (red "Impersonating customer X"). Customer notified (configurable, default off — silent for support purposes).

### RULE-CUST-019: GDPR export contents

Export JSON contains:
- Customer profile (all fields)
- Addresses (all)
- Consents (full ledger)
- Orders + items (snapshots; legal records included)
- Returns + items
- Payments (sanitized: no PAN)
- Carts (recent 90 days)
- Activity log (relevant entries)
- Saved payment methods (provider tokens, no card data)
- Wishlist (Fáze 2 if exists)
- Communications log (Fáze 2)

ZIP file with JSON + PDFs (invoices). Signed URL TTL 7 days.

### RULE-CUST-020: GDPR delete legal limits

Right-to-erasure subject to exceptions:
- **Accounting law**: invoices retained 10 years (CZ) per `15-tax-compliance.md` — PII anonymized but record retained
- **Legal claims**: open disputes, ongoing returns — wait until resolved
- **Public interest**: minimal applicability for e-commerce

Approach: anonymize PII; retain transactional records; document exceptions in `gdpr_requests.metadata.retained_data_categories`.

### RULE-CUST-021: GDPR 30-day deadline

GDPR Art. 12 §3: response within 1 month (extendable to 3 if complex). Default `legal_deadline_at = received + 30 days`. Admin notifications at 7 / 3 / 1 day before deadline.

### RULE-CUST-022: Identity verification for sensitive requests

Email change, password reset, 2FA disable, GDPR delete, account closure:
- Verification email to confirm
- Or active session + recent re-auth (within 15 min)

Prevents account takeover via stolen session.

### RULE-CUST-023: Customer-initiated account closure

Customer requests close via preferences:
- Soft-delete (`deleted_at` set), status='disabled'
- Open orders / returns preserved; complete normally
- After 30-day cooling-off: opt-in GDPR delete OR retain anonymized

### RULE-CUST-024: Tag management

Free-form text tags + curated catalog (`order_tags_catalog` style for customers, Fáze 2). Common tags: `VIP`, `wholesale`, `fraud_risk`, `repeat_returner`, `referral_source_X`.

Auto-tagging rules (Fáze 2) similar to customer_groups: e.g., `total_spent > 50000 → tag('VIP')`.

### RULE-CUST-025: Per-channel customer

`signup_channel_id` records origin. Customer may interact with multiple channels (web + mobile app); unified profile.

Per-channel preferences (e.g., locale per channel) in `metadata.channel_preferences`.

### RULE-CUST-026: B2B-lite (Company membership)

Customer can be member of multiple companies with different roles:
- `owner`: full control of company account
- `admin`: invite/remove members
- `buyer`: place orders on behalf of company
- `approver`: approve POs (v1.0+ workflow)
- `viewer`: read-only
- `accountant`: view invoices, exports

B2B order context: `orders.company_id IS NOT NULL`. Detail v `21-b2b-complete.md`.

### RULE-CUST-027: Address anonymization on GDPR delete

Anonymize address fields:
- `recipient_name` → 'Anonymous'
- `street1`, `street2`, `phone` → NULL
- `city`, `region`, `postal_code`, `country_code` → preserved (aggregate analytics)

Same pattern as order address snapshot anonymization (`16 RULE-ORDER-030`).

### RULE-CUST-028: Marketing opt-out via email link

Every marketing email contains unsubscribe link (legal requirement EU CAN-SPAM):
- Link with signed token → POST /storefront/auth/unsubscribe?token=...
- Server validates → revoke `marketing_email` consent
- Single-click unsubscribe (List-Unsubscribe header, RFC 8058)

### RULE-CUST-029: SMS marketing opt-out

Customer replies "STOP" to SMS:
- SMS provider webhook → emit `EVENT-CUSTOMER-SMS-OPT-OUT`
- Revoke `marketing_sms` consent
- Acknowledge with single confirmation SMS

### RULE-CUST-030: Customer search

Storefront has no search UI for customer profile. Admin search via Meilisearch index `customers:{tenant_id}`:
- Searchable: email, full_name, phone, vat_id, IČO (via company membership), tags
- Filter: customer_group, total_spent range, last_order_at range, is_high_risk, signup_channel

### RULE-CUST-031: Customer view of company colleagues (B2B)

`company_members.can_view_all_orders=true` lets buyer see all company orders. Default false (own orders only).

Privacy: B2B users see colleague names + emails only if `company_members.role` ∈ ('owner','admin','accountant').

### RULE-CUST-032: Customer impersonation expiry

Impersonation session auto-expires after 1 hour (max 4h with re-authorization). Reduces risk of forgotten impersonation.

---

## 7. REST API endpoints

### 7.1 Storefront (customer-facing)

```
POST   /api/{date}/storefront/auth/signup
POST   /api/{date}/storefront/auth/login                     # email+password
POST   /api/{date}/storefront/auth/logout
POST   /api/{date}/storefront/auth/magic-link                # request link
POST   /api/{date}/storefront/auth/magic-callback            # validate token
POST   /api/{date}/storefront/auth/password-reset             # request reset
POST   /api/{date}/storefront/auth/password-reset/confirm    # set new password with token
POST   /api/{date}/storefront/auth/email-verify              # confirm email with token
POST   /api/{date}/storefront/auth/resend-verification

# Passkeys
POST   /api/{date}/storefront/auth/passkey/register-start
POST   /api/{date}/storefront/auth/passkey/register-finish
POST   /api/{date}/storefront/auth/passkey/login-start
POST   /api/{date}/storefront/auth/passkey/login-finish
DELETE /api/{date}/storefront/auth/passkey/{id}

# OAuth
GET    /api/{date}/storefront/auth/oauth/{provider}/start
GET    /api/{date}/storefront/auth/oauth/{provider}/callback

# 2FA
POST   /api/{date}/storefront/auth/2fa/enable-start          # returns QR
POST   /api/{date}/storefront/auth/2fa/enable-finish         # verify TOTP
POST   /api/{date}/storefront/auth/2fa/disable               # requires password
POST   /api/{date}/storefront/auth/2fa/verify                # per-session

# Profile
GET    /api/{date}/storefront/me
PATCH  /api/{date}/storefront/me                             # first_name, last_name, phone, preferences
POST   /api/{date}/storefront/me/email-change                # initiate; sends verification
DELETE /api/{date}/storefront/me                              # initiate account closure (soft delete + GDPR option)
POST   /api/{date}/storefront/me/password
GET    /api/{date}/storefront/me/sessions                    # list active sessions (devices)
DELETE /api/{date}/storefront/me/sessions/{id}               # revoke specific
POST   /api/{date}/storefront/me/sessions:revoke-all          # logout everywhere

# Addresses
GET    /api/{date}/storefront/me/addresses
POST   /api/{date}/storefront/me/addresses
GET    /api/{date}/storefront/me/addresses/{id}
PATCH  /api/{date}/storefront/me/addresses/{id}
DELETE /api/{date}/storefront/me/addresses/{id}
POST   /api/{date}/storefront/me/addresses/{id}:set-default

# Consents
GET    /api/{date}/storefront/me/consents
PATCH  /api/{date}/storefront/me/consents                     # bulk update
POST   /api/{date}/storefront/auth/unsubscribe                 # token-based single-click

# GDPR
POST   /api/{date}/storefront/me/gdpr/export                   # initiate export
POST   /api/{date}/storefront/me/gdpr/delete                    # initiate delete
GET    /api/{date}/storefront/me/gdpr/requests                  # status of own requests
GET    /api/{date}/storefront/me/gdpr/requests/{id}/export-download

# B2B
GET    /api/{date}/storefront/me/companies                      # companies I'm member of
POST   /api/{date}/storefront/me/companies/{id}:switch-context  # B2B order context
GET    /api/{date}/storefront/me/companies/{id}/members          # if role allows
```

### 7.2 Admin

```
GET    /api/{date}/customers                                    # list, filterable, searchable
POST   /api/{date}/customers                                    # admin creates
GET    /api/{date}/customers/{id}
PATCH  /api/{date}/customers/{id}
DELETE /api/{date}/customers/{id}                                # soft delete
POST   /api/{date}/customers/{id}:disable
POST   /api/{date}/customers/{id}:reactivate
POST   /api/{date}/customers/{id}:unlock                         # release brute-force lock
POST   /api/{date}/customers/{id}:reset-password                  # admin sends reset link
POST   /api/{date}/customers/{id}:impersonate                     # returns session token
POST   /api/{date}/customers/{id}:add-tag
DELETE /api/{date}/customers/{id}/tags/{tag}
POST   /api/{date}/customers/{id}:add-note
GET    /api/{date}/customers/{id}/orders                          # cross-domain pivot
GET    /api/{date}/customers/{id}/returns
GET    /api/{date}/customers/{id}/payments
GET    /api/{date}/customers/{id}/activity-log
GET    /api/{date}/customers/{id}/consents
GET    /api/{date}/customers/{id}/companies
POST   /api/{date}/customers/{id}:recompute-aggregates

POST   /api/{date}/customers:bulk-tag
POST   /api/{date}/customers:bulk-add-to-group
POST   /api/{date}/customers:bulk-export
POST   /api/{date}/customers:bulk-message

POST   /api/{date}/customers/{id}/merge-into/{primary_id}         # admin merge
GET    /api/{date}/customer-merges                                 # history
POST   /api/{date}/customer-merges/{id}:revert                     # if reversible

# Search
GET    /api/{date}/customers:search?q=...                          # Meilisearch index
```

### 7.3 Customer groups

```
GET    /api/{date}/customer-groups
POST   /api/{date}/customer-groups
GET    /api/{date}/customer-groups/{id}
PATCH  /api/{date}/customer-groups/{id}
DELETE /api/{date}/customer-groups/{id}
GET    /api/{date}/customer-groups/{id}/members
POST   /api/{date}/customer-groups/{id}/members
DELETE /api/{date}/customer-groups/{id}/members/{customer_id}
```

### 7.4 Companies (B2B-lite)

```
GET    /api/{date}/companies
POST   /api/{date}/companies
GET    /api/{date}/companies/{id}
PATCH  /api/{date}/companies/{id}
DELETE /api/{date}/companies/{id}
POST   /api/{date}/companies/{id}:approve
POST   /api/{date}/companies/{id}:suspend
GET    /api/{date}/companies/{id}/members
POST   /api/{date}/companies/{id}/members                          # invite or add
PATCH  /api/{date}/companies/{id}/members/{id}                     # change role
DELETE /api/{date}/companies/{id}/members/{id}
```

### 7.5 GDPR

```
GET    /api/{date}/gdpr-requests
GET    /api/{date}/gdpr-requests/{id}
PATCH  /api/{date}/gdpr-requests/{id}                              # admin updates status
POST   /api/{date}/gdpr-requests/{id}:verify-identity              # mark verified
POST   /api/{date}/gdpr-requests/{id}:complete                     # trigger execution saga
POST   /api/{date}/gdpr-requests/{id}:reject                       # with reason
```

### 7.6 Analytics

```
GET    /api/{date}/customer-analytics/cohorts?period=monthly
GET    /api/{date}/customer-analytics/clv-distribution
GET    /api/{date}/customer-analytics/churn-rate
GET    /api/{date}/customer-analytics/repeat-purchase-rate
GET    /api/{date}/customer-analytics/by-signup-source
GET    /api/{date}/customer-analytics/top-customers?metric=spent&limit=100
GET    /api/{date}/customer-analytics/segments-overview
```

### 7.7 Example: Signup

```http
POST /api/2026-05-20/storefront/auth/signup HTTP/1.1
Idempotency-Key: 9c9f5e2a-...

{
  "email": "jan.novak@example.com",
  "password": "supersecure-passphrase-123",
  "first_name": "Jan",
  "last_name": "Novák",
  "phone": "+420777123456",
  "default_locale": "cs-CZ",
  "accepts_marketing": false,
  "consents": [
    { "purpose": "functional_cookies", "granted": true },
    { "purpose": "analytics", "granted": true }
  ],
  "terms_accepted_at": "2026-05-20T10:00:00Z",
  "terms_version": "2026-05"
}
```

```jsonc
HTTP/1.1 201 Created
Set-Cookie: shopio_session=...; HttpOnly; Secure; SameSite=Lax

{
  "data": {
    "customer": {
      "id": "01927bca-...",
      "pub_id": "cus_aB3cD",
      "email": "jan.novak@example.com",
      "first_name": "Jan",
      "last_name": "Novák",
      "status": "pending_verification",
      "default_locale": "cs-CZ"
    },
    "session_expires_at": "2026-06-19T10:00:00Z",
    "verification_email_sent": true,
    "next_step": "Klikněte na odkaz v ověřovacím emailu k aktivaci účtu."
  }
}
```

### 7.8 Example: Get my profile

```http
GET /api/2026-05-20/storefront/me HTTP/1.1
Cookie: shopio_session=...
```

```jsonc
HTTP/1.1 200 OK

{
  "data": {
    "id": "01927bca-...",
    "pub_id": "cus_aB3cD",
    "type": "customer",
    "attributes": {
      "email": "jan.novak@example.com",
      "email_verified_at": "2026-05-20T10:05:00Z",
      "first_name": "Jan",
      "last_name": "Novák",
      "full_name": "Jan Novák",
      "phone": "+420777123456",
      "phone_verified_at": null,
      "default_locale": "cs-CZ",
      "default_currency": "CZK",
      "status": "active",
      "is_2fa_enabled": false,
      "total_orders": 12,
      "total_spent_amount": 487300,
      "total_spent_currency": "CZK",
      "average_order_value_amount": 40608,
      "last_order_at": "2026-05-15T14:30:00Z",
      "tags": ["VIP"],
      "accepts_marketing": false,
      "accepts_sms_marketing": false,
      "created_at": "2025-08-12T09:30:00Z"
    },
    "relationships": {
      "addresses": { "count": 3, "url": "/api/2026-05-20/storefront/me/addresses" },
      "companies": { "count": 1, "url": "/api/2026-05-20/storefront/me/companies" }
    }
  }
}
```

### 7.9 Example: List addresses

```http
GET /api/2026-05-20/storefront/me/addresses HTTP/1.1
```

```jsonc
HTTP/1.1 200 OK

{
  "data": [
    {
      "id": "...",
      "pub_id": "adr_aB",
      "attributes": {
        "kind": "both",
        "is_default": true,
        "nickname": "Domov",
        "recipient_name": "Jan Novák",
        "street1": "Karlovo nám. 15",
        "city": "Praha",
        "postal_code": "120 00",
        "country_code": "CZ",
        "phone": "+420777123456",
        "validated_at": "2025-08-12T09:35:00Z"
      }
    },
    ...
  ]
}
```

### 7.10 Example: Update consents

```http
PATCH /api/2026-05-20/storefront/me/consents HTTP/1.1

{
  "consents": [
    { "purpose": "marketing_email", "granted": true },
    { "purpose": "personalization", "granted": false }
  ]
}
```

```jsonc
HTTP/1.1 200 OK

{
  "data": {
    "consents": [
      { "purpose": "marketing_email", "granted": true, "granted_at": "2026-05-20T11:30:00Z" },
      { "purpose": "personalization", "granted": false, "granted_at": "2026-05-20T11:30:00Z" }
    ]
  }
}
```

### 7.11 Example: Admin impersonates

```http
POST /api/2026-05-20/customers/cus_aB:impersonate HTTP/1.1
Authorization: Bearer staff_jwt

{
  "reason": "Helping with checkout issue ticket #12345",
  "duration_minutes": 30
}
```

```jsonc
HTTP/1.1 200 OK

{
  "data": {
    "impersonation_session_id": "...",
    "session_token": "sess_imp_aB3cD...",
    "expires_at": "2026-05-20T12:00:00Z",
    "view_as_customer_url": "https://shop.example.com/?_imp=sess_imp_...",
    "audit_log_id": "..."
  },
  "meta": {
    "warning": "Banner will be shown in storefront indicating impersonation."
  }
}
```

### 7.12 Example: GDPR delete request

```http
POST /api/2026-05-20/storefront/me/gdpr/delete HTTP/1.1

{
  "reason": "Closing account, no longer shopping here",
  "confirm_password": "supersecure-passphrase-123"
}
```

```jsonc
HTTP/1.1 202 Accepted

{
  "data": {
    "id": "...",
    "pub_id": "gdr_aB",
    "kind": "delete",
    "status": "received",
    "legal_deadline_at": "2026-06-19T23:59:59Z",
    "next_step": "Verification email sent. Click link to confirm deletion request."
  }
}
```

---

## 8. GraphQL schema

```graphql
type Customer implements Node & Timestamped {
  id: ID!
  pubId: String!
  email: String!
  emailVerifiedAt: DateTime
  firstName: String
  lastName: String
  fullName: String
  phone: String
  phoneVerifiedAt: DateTime
  birthDate: Date
  gender: CustomerGender
  defaultLocale: String!
  defaultCurrency: String
  taxId: String
  acceptsMarketing: Boolean!
  acceptsSmsMarketing: Boolean!
  acceptsPersonalization: Boolean!
  status: CustomerStatus!
  isHighRisk: Boolean!
  riskScore: Int
  is2faEnabled: Boolean!
  totalOrders: Int!
  totalSpent: Money
  totalRefunded: Money
  averageOrderValue: Money
  lastOrderAt: DateTime
  firstOrderAt: DateTime
  returnCount: Int!
  returnRate: Float
  abandonedCartsCount: Int!
  tags: [String!]!
  notes: String
  signupSource: String
  signupChannel: Channel
  signupCountryCode: String
  groups: [CustomerGroup!]!
  addresses: [Address!]!
  consents: [CustomerConsent!]!
  authMethods: [CustomerAuthMethod!]!
  activeSessions: [CustomerSession!]!
  companies: [CompanyMembership!]!
  orders(first: Int, after: String): OrderConnection!
  returns(first: Int, after: String): ReturnConnection!
  savedPaymentMethods: [SavedPaymentMethod!]!
  carts(activeOnly: Boolean = true): [Cart!]!
  activityLog(first: Int, after: String): CustomerActivityLogConnection!
  createdAt: DateTime!
  updatedAt: DateTime!
  preferences: JSON
  metadata: JSON
}

enum CustomerGender { FEMALE MALE NON_BINARY PREFER_NOT_TO_SAY }
enum CustomerStatus { ACTIVE DISABLED LOCKED ANONYMIZED PENDING_VERIFICATION }

type Address implements Node {
  id: ID!
  pubId: String!
  customer: Customer
  company: Company
  kind: AddressKind!
  isDefault: Boolean!
  nickname: String
  recipientName: String!
  companyName: String
  street1: String!
  street2: String
  city: String!
  region: String
  postalCode: String!
  countryCode: String!
  phone: String
  latitude: Float
  longitude: Float
  validatedAt: DateTime
  createdAt: DateTime!
}

enum AddressKind { SHIPPING BILLING BOTH TENANT_RETURN WAREHOUSE }

type CustomerGroup implements Node {
  id: ID!
  name: String!
  slug: String!
  description: String
  defaultPriceList: PriceList
  isDefault: Boolean!
  isSystem: Boolean!
  memberCount: Int!
}

type CustomerConsent {
  purpose: ConsentPurpose!
  granted: Boolean!
  grantedAt: DateTime!
  source: ConsentSource!
  legalBasis: LegalBasis!
  policyVersion: String
}

enum ConsentPurpose {
  MARKETING_EMAIL MARKETING_SMS MARKETING_PUSH
  PERSONALIZATION PROFILING THIRD_PARTY_SHARING
  ANALYTICS FUNCTIONAL_COOKIES MARKETING_COOKIES
  NEWSLETTER PRODUCT_UPDATES SMS_ORDER_UPDATES
  SESSION_REPLAY SEARCH_PERSONALIZATION
}

enum ConsentSource { SIGNUP CHECKOUT PREFERENCES_PAGE COOKIE_BANNER ADMIN IMPORT API SMS_REPLY_STOP }
enum LegalBasis { CONSENT CONTRACT LEGITIMATE_INTEREST LEGAL_OBLIGATION VITAL_INTEREST PUBLIC_TASK }

type CustomerAuthMethod {
  id: ID!
  kind: AuthMethodKind!
  identifier: String
  passkeyName: String
  isPrimary: Boolean!
  lastUsedAt: DateTime
  createdAt: DateTime!
}

enum AuthMethodKind { PASSWORD PASSKEY MAGIC_LINK GOOGLE APPLE FACEBOOK GITHUB MICROSOFT OIDC }

type CustomerSession {
  id: ID!
  deviceKind: String
  userAgentFamily: String
  countryCode: String
  city: String
  createdAt: DateTime!
  lastActivityAt: DateTime!
  expiresAt: DateTime!
  mfaVerifiedAt: DateTime
  isCurrent: Boolean!
}

type Company implements Node {
  id: ID!
  pubId: String!
  name: String!
  legalName: String
  registrationNumber: String
  vatId: String
  industry: String
  sizeCategory: CompanySize
  websiteUrl: String
  defaultBillingAddress: Address
  defaultShippingAddress: Address
  defaultPriceList: PriceList
  defaultPaymentTermsDays: Int
  creditLimit: Money
  accountStatus: CompanyAccountStatus!
  accountManager: User
  members: [CompanyMembership!]!
  orders(first: Int, after: String): OrderConnection!
  tags: [String!]!
  notes: String
  createdAt: DateTime!
}

enum CompanySize { MICRO SMALL MEDIUM LARGE ENTERPRISE }
enum CompanyAccountStatus { PENDING APPROVED SUSPENDED CLOSED }

type CompanyMembership {
  id: ID!
  company: Company!
  customer: Customer!
  role: CompanyMemberRole!
  purchaseLimit: Money
  canViewAllOrders: Boolean!
  canRequestQuote: Boolean!
  isActive: Boolean!
  joinedAt: DateTime
}

enum CompanyMemberRole { OWNER ADMIN BUYER APPROVER VIEWER ACCOUNTANT }

type GdprRequest implements Node {
  id: ID!
  pubId: String!
  customer: Customer
  customerEmailAtRequest: String!
  kind: GdprRequestKind!
  status: GdprRequestStatus!
  legalDeadlineAt: DateTime!
  completedAt: DateTime
  rejectedAt: DateTime
  rejectionReason: String
  exportDownloadUrl: String
  handledBy: User
}

enum GdprRequestKind { EXPORT DELETE RECTIFICATION RESTRICTION PORTABILITY WITHDRAW_CONSENT }
enum GdprRequestStatus { RECEIVED VERIFIED IN_PROGRESS COMPLETED REJECTED EXPIRED }

extend type Query {
  me: Customer                                                            # current authenticated customer
  customer(id: ID, pubId: String, email: String): Customer @auth(requires: PERM_CUSTOMER_VIEW)
  customers(first: Int, after: String, filter: CustomerFilter): CustomerConnection! @auth(requires: PERM_CUSTOMER_VIEW)
  customerSearch(query: String!, first: Int = 20): [Customer!]! @auth(requires: PERM_CUSTOMER_VIEW)

  customerGroups: [CustomerGroup!]!
  companies(first: Int, after: String): CompanyConnection! @auth(requires: PERM_CUSTOMER_VIEW)
  company(id: ID, pubId: String): Company
  myCompanies: [CompanyMembership!]!

  gdprRequests(filter: GdprRequestFilter): [GdprRequest!]! @auth(requires: PERM_CUSTOMER_GDPR_MANAGE)
  myGdprRequests: [GdprRequest!]!
}

input CustomerFilter {
  status: [CustomerStatus!]
  groupIds: [ID!]
  tags: [String!]
  isHighRisk: Boolean
  minTotalSpent: MoneyInput
  maxTotalSpent: MoneyInput
  minTotalOrders: Int
  signupChannelId: ID
  signupAfter: DateTime
  signupBefore: DateTime
  acceptsMarketing: Boolean
  hasCompanyMembership: Boolean
}

extend type Mutation {
  signupCustomer(input: SignupInput!): SignupResult!
  loginCustomer(input: LoginInput!): LoginResult!
  logoutCustomer: MutationPayload!
  requestMagicLink(email: String!): MutationPayload!
  consumeMagicLink(token: String!): LoginResult!
  requestPasswordReset(email: String!): MutationPayload!
  confirmPasswordReset(token: String!, newPassword: String!): MutationPayload!
  verifyEmail(token: String!): MutationPayload!
  resendEmailVerification: MutationPayload!

  registerPasskey(input: PasskeyRegistrationInput!): CustomerAuthMethod!
  removePasskey(id: ID!): MutationPayload!

  enable2fa(input: Enable2faInput!): Enable2faResult!
  disable2fa(password: String!, totpCode: String!): MutationPayload!
  verify2fa(code: String!): MutationPayload!

  updateMyProfile(input: UpdateProfileInput!): Customer!
  updateMyConsents(consents: [ConsentInput!]!): [CustomerConsent!]!
  changeMyEmail(newEmail: String!, password: String!): MutationPayload!
  changeMyPassword(currentPassword: String!, newPassword: String!): MutationPayload!
  closeMyAccount(reason: String): MutationPayload!

  addMyAddress(input: AddressInput!): Address!
  updateMyAddress(id: ID!, input: AddressInput!): Address!
  deleteMyAddress(id: ID!): DeletePayload!
  setDefaultAddress(id: ID!): Address!

  revokeMySession(sessionId: ID!): MutationPayload!
  revokeAllMySessions: MutationPayload!

  requestMyGdprExport: GdprRequest!
  requestMyGdprDelete(reason: String!, password: String!): GdprRequest!

  # Admin
  createCustomer(input: AdminCreateCustomerInput!): Customer! @auth(requires: PERM_CUSTOMER_CREATE)
  updateCustomer(id: ID!, input: AdminUpdateCustomerInput!): Customer! @auth(requires: PERM_CUSTOMER_EDIT)
  disableCustomer(id: ID!, reason: String!): Customer! @auth(requires: PERM_CUSTOMER_EDIT)
  reactivateCustomer(id: ID!): Customer! @auth(requires: PERM_CUSTOMER_EDIT)
  unlockCustomer(id: ID!): Customer! @auth(requires: PERM_CUSTOMER_EDIT)
  impersonateCustomer(id: ID!, input: ImpersonateInput!): ImpersonateResult! @auth(requires: PERM_CUSTOMER_IMPERSONATE)
  mergeCustomers(primaryId: ID!, mergedId: ID!, reason: String): Customer! @auth(requires: PERM_CUSTOMER_MERGE)
  addCustomerTag(id: ID!, tag: String!): Customer! @auth(requires: PERM_CUSTOMER_EDIT)
  removeCustomerTag(id: ID!, tag: String!): Customer! @auth(requires: PERM_CUSTOMER_EDIT)

  createCustomerGroup(input: CustomerGroupInput!): CustomerGroup! @auth(requires: PERM_CUSTOMER_GROUP_MANAGE)
  updateCustomerGroup(id: ID!, input: CustomerGroupInput!): CustomerGroup! @auth(requires: PERM_CUSTOMER_GROUP_MANAGE)
  assignCustomerToGroup(customerId: ID!, groupId: ID!, expiresAt: DateTime): MutationPayload! @auth(requires: PERM_CUSTOMER_GROUP_MANAGE)

  # B2B
  createCompany(input: CompanyInput!): Company! @auth(requires: PERM_COMPANY_MANAGE)
  updateCompany(id: ID!, input: CompanyInput!): Company! @auth(requires: PERM_COMPANY_MANAGE)
  approveCompany(id: ID!): Company! @auth(requires: PERM_COMPANY_MANAGE)
  suspendCompany(id: ID!, reason: String!): Company! @auth(requires: PERM_COMPANY_MANAGE)
  inviteCompanyMember(companyId: ID!, input: CompanyMemberInput!): CompanyMembership! @auth(requires: PERM_COMPANY_MANAGE)
  updateCompanyMember(id: ID!, input: CompanyMemberInput!): CompanyMembership! @auth(requires: PERM_COMPANY_MANAGE)
  removeCompanyMember(id: ID!): MutationPayload! @auth(requires: PERM_COMPANY_MANAGE)

  # GDPR admin
  verifyGdprRequest(id: ID!): GdprRequest! @auth(requires: PERM_CUSTOMER_GDPR_MANAGE)
  completeGdprRequest(id: ID!): GdprRequest! @auth(requires: PERM_CUSTOMER_GDPR_MANAGE)
  rejectGdprRequest(id: ID!, reason: String!): GdprRequest! @auth(requires: PERM_CUSTOMER_GDPR_MANAGE)
}

type SignupResult {
  customer: Customer!
  session: CustomerSession!
  verificationEmailSent: Boolean!
  nextStep: String
}

type LoginResult {
  customer: Customer!
  session: CustomerSession!
  requires2fa: Boolean!
}

type ImpersonateResult {
  sessionToken: String!
  expiresAt: DateTime!
  viewAsUrl: String!
  auditLogId: ID!
}
```

---

## 9. Events

| Build-spec ID | Wire | Payload |
|---|---|---|
| `EVENT-CUSTOMER-CREATED` | `customer.created` | `{ customer, source }` |
| `EVENT-CUSTOMER-EMAIL-VERIFIED` | `customer.email_verified` | `{ customer }` |
| `EVENT-CUSTOMER-UPDATED` | `customer.updated` | `{ customer, previous_attributes }` |
| `EVENT-CUSTOMER-EMAIL-CHANGED` | `customer.email_changed` | `{ customer, previous_email, new_email }` |
| `EVENT-CUSTOMER-PASSWORD-CHANGED` | `customer.password_changed` | `{ customer }` |
| `EVENT-CUSTOMER-LOGGED-IN` | `customer.logged_in` | `{ customer, session, method }` |
| `EVENT-CUSTOMER-LOGGED-OUT` | `customer.logged_out` | `{ customer, session }` |
| `EVENT-CUSTOMER-LOGIN-FAILED` | `customer.login_failed` | `{ email, reason }` |
| `EVENT-CUSTOMER-LOCKED` | `customer.locked` | `{ customer, reason }` |
| `EVENT-CUSTOMER-UNLOCKED` | `customer.unlocked` | `{ customer }` |
| `EVENT-CUSTOMER-DISABLED` | `customer.disabled` | `{ customer, reason }` |
| `EVENT-CUSTOMER-REACTIVATED` | `customer.reactivated` | `{ customer }` |
| `EVENT-CUSTOMER-ANONYMIZED` | `customer.anonymized` | `{ customer_id, anonymized_at, reason }` |
| `EVENT-CUSTOMER-MERGED` | `customer.merged` | `{ primary_customer, merged_customer_id, changes }` |
| `EVENT-CUSTOMER-CONSENT-GRANTED` | `customer.consent_granted` | `{ customer, purpose, source }` |
| `EVENT-CUSTOMER-CONSENT-REVOKED` | `customer.consent_revoked` | `{ customer, purpose, source }` |
| `EVENT-CUSTOMER-2FA-ENABLED` | `customer.2fa_enabled` | `{ customer }` |
| `EVENT-CUSTOMER-2FA-DISABLED` | `customer.2fa_disabled` | `{ customer }` |
| `EVENT-CUSTOMER-PASSKEY-REGISTERED` | `customer.passkey_registered` | `{ customer, passkey_id }` |
| `EVENT-CUSTOMER-PASSKEY-REVOKED` | `customer.passkey_revoked` | `{ customer, passkey_id }` |
| `EVENT-CUSTOMER-ADDRESS-ADDED` | `customer.address_added` | `{ customer, address }` |
| `EVENT-CUSTOMER-ADDRESS-UPDATED` | `customer.address_updated` | `{ customer, address }` |
| `EVENT-CUSTOMER-ADDRESS-DELETED` | `customer.address_deleted` | `{ customer, address_id }` |
| `EVENT-CUSTOMER-IMPERSONATED` | `customer.impersonated` | `{ customer, user_id, reason, session_id }` |
| `EVENT-CUSTOMER-GROUP-ASSIGNED` | `customer.group_assigned` | `{ customer, group }` |
| `EVENT-CUSTOMER-GROUP-REMOVED` | `customer.group_removed` | `{ customer, group_id }` |
| `EVENT-CUSTOMER-TAGGED` | `customer.tagged` | `{ customer, tag, actor }` |
| `EVENT-CUSTOMER-AGGREGATES-RECOMPUTED` | `customer.aggregates_recomputed` | `{ customer }` |
| `EVENT-CUSTOMER-RISK-RESCORED` | `customer.risk_rescored` | `{ customer, previous_score, new_score }` |
| `EVENT-CUSTOMER-DUPLICATE-DETECTED` | `customer.duplicate_detected` | `{ candidate_a, candidate_b, signals }` |
| `EVENT-CUSTOMER-SMS-OPT-OUT` | `customer.sms_opt_out` | `{ customer }` |
| `EVENT-COMPANY-CREATED` | `company.created` | `{ company }` |
| `EVENT-COMPANY-APPROVED` | `company.approved` | `{ company }` |
| `EVENT-COMPANY-SUSPENDED` | `company.suspended` | `{ company, reason }` |
| `EVENT-COMPANY-MEMBER-ADDED` | `company.member_added` | `{ company, membership }` |
| `EVENT-COMPANY-MEMBER-REMOVED` | `company.member_removed` | `{ company, membership_id }` |
| `EVENT-COMPANY-MEMBER-ROLE-CHANGED` | `company.member_role_changed` | `{ membership, previous_role }` |
| `EVENT-GDPR-REQUEST-RECEIVED` | `gdpr.request_received` | `{ request }` |
| `EVENT-GDPR-REQUEST-VERIFIED` | `gdpr.request_verified` | `{ request }` |
| `EVENT-GDPR-REQUEST-COMPLETED` | `gdpr.request_completed` | `{ request }` |
| `EVENT-GDPR-EXPORT-GENERATED` | `gdpr.export_generated` | `{ request, download_url, expires_at }` |
| `EVENT-GDPR-DEADLINE-APPROACHING` | `gdpr.deadline_approaching` | `{ request, days_remaining }` |

**Konzumenti:**
- Marketing automation (`19`) — welcome emails, consent gating
- Search indexer — customer search index
- Analytics — CLV, churn
- Pricing engine (`10`) — group-based pricing
- Fraud engine (`30`)
- Webhook delivery
- ERP / CRM integrations

---

## 10. Background jobs

| Job | Trigger | Queue | Frequency |
|---|---|---|---|
| `JOB-SEND-WELCOME-EMAIL` | EVENT-CUSTOMER-CREATED | `notifications` | On-demand |
| `JOB-SEND-EMAIL-VERIFICATION` | signup or resend | `notifications` | On-demand |
| `JOB-SEND-PASSWORD-RESET` | reset requested | `notifications` | On-demand |
| `JOB-SEND-MAGIC-LINK` | requested | `notifications` | On-demand |
| `JOB-AUTO-UNLOCK-CUSTOMERS` | scheduled | `customer-sweeper` | Every 5 min |
| `JOB-EXPIRE-PENDING-VERIFICATIONS` | scheduled | `customer-sweeper` | Daily (after 30d) |
| `JOB-RECONCILE-CUSTOMER-AGGREGATES` | scheduled | `analytics` | Daily 04:00 |
| `JOB-UPDATE-CUSTOMER-AGGREGATES-FROM-ORDER` | EVENT-ORDER-PLACED / COMPLETED / REFUNDED | `analytics` | On-demand |
| `JOB-UPDATE-CUSTOMER-RETURN-RATE` | EVENT-RETURN-CLOSED / REFUNDED | `analytics` | On-demand |
| `JOB-DETECT-DUPLICATE-CUSTOMERS` | scheduled | `analytics` | Weekly |
| `JOB-INDEX-CUSTOMER` | EVENT-CUSTOMER-* (debounced 5s) | `search-index` | On-demand |
| `JOB-EXECUTE-GDPR-EXPORT` | EVENT-GDPR-REQUEST-VERIFIED (kind=export) | `gdpr` | On-demand |
| `JOB-EXECUTE-GDPR-DELETE` | EVENT-GDPR-REQUEST-VERIFIED (kind=delete) | `gdpr` | On-demand |
| `JOB-NOTIFY-GDPR-DEADLINE-APPROACHING` | scheduled | `gdpr` | Daily |
| `JOB-CLEANUP-EXPIRED-SESSIONS` | scheduled | `maintenance` | Daily |
| `JOB-PURGE-OLD-LOGIN-ATTEMPTS` | scheduled | `maintenance` | Daily (retention 90d) |
| `JOB-CLEANUP-EXPIRED-VERIFICATION-TOKENS` | scheduled | `maintenance` | Daily |
| `JOB-AUTO-ASSIGN-CUSTOMER-GROUPS` | scheduled | `customer` | Daily (rule-based dynamic groups) |
| `JOB-NOTIFY-CONSENT-EXPIRATION` | scheduled | `notifications` | Daily (annual reconfirmation Fáze 2) |
| `JOB-EXPIRE-IMPERSONATION-SESSIONS` | scheduled | `customer-sweeper` | Every 5 min |
| `JOB-NOTIFY-DORMANT-CUSTOMERS` | scheduled | `marketing` | Weekly (no activity 90d, opt-in via marketing) |
| `JOB-CONSOLIDATE-CUSTOMER-ACTIVITY-LOG` | scheduled | `maintenance` | Daily (retention) |

### 10.1 JOB-EXECUTE-GDPR-DELETE detail

```typescript
async function executeGdprDelete(requestId: string) {
  return await pg.transaction(async tx => {
    const request = await loadGdprRequest(tx, requestId);
    if (request.status !== 'verified') return;
    if (request.kind !== 'delete') return;
    
    const customerId = request.customer_id;
    
    // Anonymize customer profile
    await tx.execute(sql`
      UPDATE customers SET
        email = ${`anonymized-${customerId}@deleted.local`},
        first_name = NULL,
        last_name = NULL,
        phone = NULL,
        birth_date = NULL,
        tags = '{}',
        notes = NULL,
        password_hash = NULL,
        signup_referrer = NULL,
        signup_utm = NULL,
        signup_ip_hash = NULL,
        preferences = '{}'::jsonb,
        status = 'anonymized',
        anonymized_at = now(),
        anonymization_reason = 'gdpr_request',
        updated_at = now(),
        version = version + 1
      WHERE id = ${customerId}
    `);
    
    // Anonymize addresses
    await tx.execute(sql`
      UPDATE addresses SET
        recipient_name = 'Anonymous',
        street1 = NULL,
        street2 = NULL,
        phone = NULL,
        latitude = NULL,
        longitude = NULL,
        deleted_at = now(),
        updated_at = now()
      WHERE customer_id = ${customerId}
    `);
    
    // Revoke all auth methods + sessions
    await tx.execute(sql`UPDATE customer_auth_methods SET revoked_at=now(), revoked_reason='gdpr_delete' WHERE customer_id = ${customerId} AND revoked_at IS NULL`);
    await tx.execute(sql`UPDATE customer_sessions SET revoked_at=now(), revoked_reason='gdpr_delete' WHERE customer_id = ${customerId} AND revoked_at IS NULL`);
    
    // Trigger anonymization in other domains (orders, returns, etc.) via events
    await emitOutbox(tx, 'EVENT-CUSTOMER-ANONYMIZED', { customer_id: customerId, anonymized_at: new Date(), reason: 'gdpr_request' });
    
    // Update request status
    await tx.execute(sql`UPDATE gdpr_requests SET status='completed', completed_at=now(), updated_at=now() WHERE id = ${requestId}`);
    await emitOutbox(tx, 'EVENT-GDPR-REQUEST-COMPLETED', { request_id: requestId });
  });
  
  // External provider detachments async post-Tx
  await detachAllSavedPaymentMethods(customerId);  // calls `13-payments.md`
}
```

### 10.2 JOB-DETECT-DUPLICATE-CUSTOMERS detail

```sql
-- Detect candidates by similar signals
WITH duplicate_pairs AS (
  SELECT
    c1.id AS id1,
    c2.id AS id2,
    -- scoring
    (CASE WHEN c1.email = c2.email THEN 100 ELSE 0 END +
     CASE WHEN c1.phone = c2.phone AND c1.phone IS NOT NULL THEN 50 ELSE 0 END +
     CASE WHEN c1.full_name = c2.full_name AND c1.full_name IS NOT NULL THEN 30 ELSE 0 END +
     -- more signals
    ) AS confidence
  FROM customers c1
  JOIN customers c2 ON c1.tenant_id = c2.tenant_id AND c1.id < c2.id
  WHERE c1.status != 'anonymized' AND c2.status != 'anonymized'
    AND c1.deleted_at IS NULL AND c2.deleted_at IS NULL
)
SELECT * FROM duplicate_pairs WHERE confidence >= 60;
```

Creates draft merge proposals in admin UI; manual review/approve.

---

## 11. UI/UX flows

### FLOW-CUST-001: Customer signup

```
[Storefront / "Sign up" page]
   - Form: email, password (strength meter), first/last name, phone (optional)
   - Marketing opt-in checkbox (default unchecked)
   - T&C checkbox (required)
        │
        ▼
[POST /storefront/auth/signup]
   - Create customer (status=pending_verification)
   - Send verification email
   - Create session
        │
        ▼
[Redirect to /account/verify-email-pending page]
   - "We sent a link to email@example.com — please verify"
        │
   ... customer clicks email link ...
        │
        ▼
[POST /storefront/auth/email-verify]
   - status → active
   - Redirect to /account
```

### FLOW-CUST-002: Customer login (password)

```
[/login page]
   - Email + password form
   - "Forgot password?" link
   - "Sign in with Google" / passkey buttons
        │
        ▼
[POST /storefront/auth/login]
   - If invalid: increment failed_login_count
   - If locked: return 423
   - If 2FA: return requires_2fa, partial session
        │
        ▼
[If 2FA: /verify-2fa page]
   - Enter TOTP code
        │
        ▼
[POST /storefront/auth/2fa/verify]
   - Full session
        │
        ▼
[Redirect to /account or original target]
```

### FLOW-CUST-003: Passkey login

```
[/login page]
   - "Sign in with passkey" button (auto-shown if WebAuthn supported)
        │
        ▼
[POST /storefront/auth/passkey/login-start]
   - Server returns challenge
        │
        ▼
[Browser calls navigator.credentials.get(...)]
   - User biometric prompt
        │
        ▼
[POST /storefront/auth/passkey/login-finish]
   - Signature verified
   - Session created
```

### FLOW-CUST-004: Account dashboard

```
[/account]
   - Header: name, "VIP" badge (if tag), avatar
   - Cards:
     • Orders (link → /account/orders) — recent 3 + count
     • Returns (link → /account/returns) — recent + count
     • Addresses (link → /account/addresses)
     • Payment methods (link → /account/payment-methods)
     • Preferences (link → /account/preferences)
     • Companies (if B2B) (link → /account/companies)
   - Logout button
```

### FLOW-CUST-005: Address management

```
[/account/addresses]
   - List of addresses (default badge)
   - "Add new address" button
        │
   click address
        │
        ▼
[Edit address form]
   - All fields
   - "Validate address" button (call address validation service)
   - "Set as default shipping" / "Set as default billing"
   - Delete option (with confirmation)
```

### FLOW-CUST-006: Privacy preferences

```
[/account/preferences]
   Tabs: Profile | Email & Marketing | Privacy & Cookies | Security
        │
   click "Privacy & Cookies"
        │
        ▼
[Consent toggles]
   - Marketing emails: [on/off] (currently on)
   - SMS marketing: [on/off]
   - Personalization: [on/off]
   - Analytics: [on/off]
   - Each change → PATCH /storefront/me/consents
   - Inline confirmation
   
[Privacy controls]
   - "Download my data" button → GDPR export request
   - "Delete my account" button → GDPR delete (multi-step confirmation)
```

### FLOW-CUST-007: Admin views customer profile

```
[Admin → Customers → click customer]
   - Header: name, email, status, tags, group membership
   - Sidebar: aggregates (LTV, orders, return rate, last seen)
   - Tabs:
     • Profile: editable form
     • Orders: list (link to order)
     • Returns: list
     • Addresses
     • Payment methods
     • Consents (full ledger, immutable view)
     • Activity log
     • Companies
     • Notes (editable)
     • Tags
   - Actions:
     [Edit] [Add note] [Add tag] [Impersonate] [Disable] [Reset password] [GDPR delete on request]
```

### FLOW-CUST-008: Admin impersonates

```
[Customer detail → "Impersonate" button]
        │
        ▼
[Confirm modal]
   - Reason required (free text)
   - Duration: 30 / 60 minutes
   - Warning: "Customer will be notified" (if configured)
        │
        ▼
[POST /customers/{id}:impersonate]
   - Audit log entry
   - Redirect to storefront with impersonation session
        │
        ▼
[Storefront with red banner]
   - "Impersonating Jan Novák (jan@example.com). Reason: Helping with checkout ticket"
   - "End impersonation" button (back to admin)
   - Limited actions visible
```

### FLOW-CUST-009: Account merge

```
[Admin notification: "Duplicate detected: Jan Novák (cus_A) ≈ Jan Novák (cus_B), confidence 85%"]
        │
   click notification
        │
        ▼
[Merge review screen]
   - Side-by-side comparison: profile fields, orders count, addresses
   - "Keep primary" radio
   - Field-level merge choices (which value wins per field)
        │
        ▼
[Confirm merge]
   - Saga executes
   - Audit log entry in customer_merges
   - Merged customer status='anonymized'
```

### FLOW-CUST-010: GDPR delete (customer-initiated)

```
[/account/preferences → "Privacy & Cookies" → "Delete my account"]
        │
        ▼
[Multi-step confirmation]
   Step 1: Information page
     - What gets deleted (PII)
     - What is retained (accounting records 10y per law)
     - Open orders/returns will complete first
   Step 2: Reason (optional)
   Step 3: Password confirmation
   Step 4: Final confirmation
        │
        ▼
[POST /storefront/me/gdpr/delete]
   - Create gdpr_requests row (status=received)
   - Send verification email
        │
        ▼
[Customer clicks verification link]
   - status='verified'
   - JOB-EXECUTE-GDPR-DELETE scheduled (with 7-day grace period)
        │
   ... 7 days pass (customer can still cancel) ...
        │
        ▼
[Saga executes anonymization]
   - All PII anonymized
   - Sessions revoked
   - Customer can no longer log in
   - status='completed'
```

---

## 12. Edge cases & error handling

| Scenario | Behavior | Code |
|---|---|---|
| Signup with existing email | Return generic success (don't reveal); send "did you mean to log in?" email | (security) |
| Login with non-existent email | Generic invalid credentials error (don't reveal) | `INVALID_CREDENTIALS`, 401 |
| Login when locked | Return lockout time | `ACCOUNT_LOCKED`, 423 |
| Login when disabled | Return disabled message | `ACCOUNT_DISABLED`, 403 |
| Login when anonymized | Treat as non-existent | `INVALID_CREDENTIALS`, 401 |
| Email verification token expired | Allow resend | `TOKEN_EXPIRED`, 410 |
| Password reset for non-existent email | Generic success (don't reveal) | (security) |
| Magic link expired | Re-prompt to request new | `TOKEN_EXPIRED`, 410 |
| Magic link reused | Reject; re-prompt | `TOKEN_USED`, 410 |
| Passkey signature invalid | Reject login | `PASSKEY_INVALID`, 401 |
| OAuth state mismatch | Reject (CSRF attempt) | `OAUTH_STATE_INVALID`, 400 |
| OAuth provider returns no email | Reject; require linking with existing account | `OAUTH_EMAIL_MISSING`, 400 |
| 2FA enable without password | Reject | `PASSWORD_REQUIRED`, 422 |
| 2FA disable without TOTP | Reject | `TOTP_REQUIRED`, 422 |
| Concurrent profile edits | Optimistic lock via version | `RESOURCE_VERSION_MISMATCH`, 412 |
| Address default conflict (2 defaults) | Auto-unset previous in same Tx | (handled) |
| Customer deletion with open orders | Defer anonymization until orders complete | (deferred) |
| GDPR delete during open returns | Defer; admin notified | (deferred) |
| GDPR export with > 1GB data | Multi-part download; > 24h generation time | (handled) |
| Admin merge of customer with self | Reject | `CANNOT_MERGE_SELF`, 422 |
| Admin merge anonymized customer | Reject | `CANNOT_MERGE_ANONYMIZED`, 422 |
| Customer tries to access another customer's data | 404 (not 403) | `NOT_FOUND`, 404 |
| Session expired during request | 401, customer re-logs in | `SESSION_EXPIRED`, 401 |
| Impersonation session reuses customer session | Reject; impersonation has distinct session | (handled) |
| Multiple devices simultaneous sessions | All valid; "Active sessions" UI shows each | (handled) |
| Customer changes email mid-checkout | Snapshot at checkout retained; new email only forward | (handled per `16 RULE-ORDER-027`) |
| Phone number malformed | Reject (E.164 validation) | `INVALID_PHONE`, 422 |
| Birth date in future | Reject | `INVALID_BIRTH_DATE`, 422 |
| Customer joins company already member of | Update role | (handled) |
| Company member role downgrade with owner being only owner | Reject; require alternative owner first | `LAST_OWNER`, 422 |
| Customer accepts marketing while pending verification | Allow but mark "pending verification" tag | (handled) |
| Bulk operations exceeding limit | Reject with chunk hint | `BULK_LIMIT_EXCEEDED`, 422 |
| Customer login from new country (anomaly) | Allow but email security alert (Fáze 2) | (handled) |

---

## 13. Performance

### 13.1 Targets

| Operation | p50 | p95 | p99 |
|---|---|---|---|
| `POST /storefront/auth/login` (password) | 50 ms | 200 ms | 500 ms (Argon2id dominant) |
| `POST /storefront/auth/login` (passkey) | 30 ms | 100 ms | 250 ms |
| `GET /storefront/me` | 10 ms | 30 ms | 80 ms |
| `GET /customers/{id}` (admin) | 25 ms | 80 ms | 200 ms |
| `GET /customers` (admin list) | 30 ms | 100 ms | 250 ms |
| Customer search (Meilisearch) | 20 ms | 60 ms | 150 ms |
| `POST /customers/{id}:impersonate` | 50 ms | 150 ms | 300 ms |
| `JOB-EXECUTE-GDPR-DELETE` (small profile) | 1 s | 5 s | 15 s |
| `JOB-EXECUTE-GDPR-DELETE` (large profile, 1000+ orders) | 30 s | 120 s | 300 s |
| `JOB-EXECUTE-GDPR-EXPORT` | 5 s | 30 s | 120 s |
| `JOB-DETECT-DUPLICATE-CUSTOMERS` (10k customers) | 30 s | 120 s | 300 s |

### 13.2 Optimization

- **Argon2id calibration** — target 100-200 ms per hash; balance security vs UX
- **Session cache** Redis (1-min TTL) keyed by session_token
- **Customer profile cache** Redis (30 sec) per customer_id
- **Aggregates materialized** in `customers` row; updated event-driven
- **Reconciliation job daily** to catch drift
- **DataLoader v GraphQL** for batched addresses, consents
- **Meilisearch customer index** for fast admin search
- **Login rate limit** Redis token bucket per email + per IP

### 13.3 Hot path queries

```sql
-- Login lookup
SELECT * FROM customers
WHERE tenant_id = $1 AND email = $2 AND deleted_at IS NULL
LIMIT 1;
-- Uses uq_customers_tenant_email
```

```sql
-- My profile fetch
SELECT * FROM customers WHERE id = $1;  -- direct PK
```

```sql
-- Admin list with filters
SELECT * FROM customers
WHERE tenant_id = $1 AND status = ANY($2) AND total_spent_amount >= $3
ORDER BY last_order_at DESC NULLS LAST
LIMIT 50;
-- Uses idx_customers_total_spent + idx_customers_last_order
```

### 13.4 Scaling

- Customer volume: 1M+ customers per tenant manageable on single Postgres
- Login throughput: 1000 logins/sec per Postgres (Argon2id is the bottleneck on app server, not DB)
- Beyond: read replicas; auth might benefit from separate auth service (Fáze 3+)

---

## 14. Security & GDPR

### 14.1 Permissions

```
PERM-CUSTOMER-VIEW
PERM-CUSTOMER-CREATE
PERM-CUSTOMER-EDIT
PERM-CUSTOMER-DELETE              # soft delete
PERM-CUSTOMER-VIEW-PII             # gate for sensitive (birth_date, phone)
PERM-CUSTOMER-IMPERSONATE
PERM-CUSTOMER-MERGE
PERM-CUSTOMER-EXPORT
PERM-CUSTOMER-GROUP-MANAGE
PERM-CUSTOMER-GDPR-MANAGE
PERM-CUSTOMER-AUDIT-VIEW
PERM-CUSTOMER-SEGMENT-EXPORT       # for marketing campaigns
PERM-CUSTOMER-TAG-MANAGE
PERM-COMPANY-VIEW
PERM-COMPANY-MANAGE
```

### 14.2 Cross-tenant isolation

`tenant_id` part of every query. RLS reinforced. Cross-tenant access prohibited.

### 14.3 PII data classification

- **High sensitivity**: birth_date, phone, full_name, addresses
- **Medium**: email, signup_country
- **Low (anonymizable)**: signup_ip_hash, signup_utm

Hide high-sensitivity unless `PERM-CUSTOMER-VIEW-PII`.

### 14.4 Password security

- Argon2id (winner of PHC) with calibrated params
- Password change invalidates all sessions
- HaveIBeenPwned check (optional, Fáze 2 — privacy via k-anonymity API)

### 14.5 Session security

- HttpOnly + Secure + SameSite=Lax cookies
- DB-backed sessions (revocable)
- IP/device fingerprint stored for anomaly detection
- Refresh on activity, max 30-day absolute

### 14.6 GDPR compliance

- Consent ledger immutable per RULE-CUST-006
- Right-to-access (export) per RULE-CUST-019
- Right-to-erasure (delete) per RULE-CUST-020
- Right-to-rectification (edit profile) self-service
- Right-to-restrict-processing (Fáze 2 — `restriction` GDPR request kind)
- Right-to-portability (export JSON)
- Right-to-object (revoke consent)

30-day deadline tracked per request.

### 14.7 Audit log

100% audit on:
- Customer creation, deletion, anonymization
- Impersonation (always)
- Role changes
- Permission changes
- Tag/note changes
- Consent grants/revokes
- Password resets, 2FA enable/disable
- Merge operations
- GDPR request lifecycle
- Admin viewing of PII (sample 1% reads)

### 14.8 Rate limits

| Endpoint | Anon | Auth |
|---|---|---|
| `POST /storefront/auth/login` | 5/min per IP, 5/min per email | n/a |
| `POST /storefront/auth/signup` | 3/hour per IP | n/a |
| `POST /storefront/auth/password-reset` | 3/hour per email + per IP | n/a |
| `POST /storefront/auth/magic-link` | 5/hour per email + per IP | n/a |
| `GET /storefront/me` | n/a | 600/min |
| `PATCH /storefront/me` | n/a | 30/min |
| `POST /customers:impersonate` | n/a | 30/min |
| GDPR endpoints | n/a | 5/day per customer |

### 14.9 Cookies + tracking

Per EU ePrivacy + GDPR:
- Strictly necessary cookies: no consent needed
- Functional cookies (preferences): may use legitimate interest
- Analytics, marketing: explicit opt-in
- Cookie banner first visit; preferences page anytime

---

## 15. Testing

### 15.1 Unit

```
TEST-UNIT-CUST-001  PasswordHasher (Argon2id)
TEST-UNIT-CUST-002  SignedTokenGenerator (HMAC)
TEST-UNIT-CUST-003  EmailValidator (RFC 5322)
TEST-UNIT-CUST-004  PhoneValidator (E.164)
TEST-UNIT-CUST-005  ConsentResolver (current per purpose)
TEST-UNIT-CUST-006  CustomerStateMachine
TEST-UNIT-CUST-007  AddressDefaultEnforcer
TEST-UNIT-CUST-008  AggregateCalculator (LTV, return_rate)
TEST-UNIT-CUST-009  DuplicateDetector (confidence scoring)
TEST-UNIT-CUST-010  ImpersonationSessionFactory
TEST-UNIT-CUST-011  PasskeyVerifier (WebAuthn)
TEST-UNIT-CUST-012  GdprAnonymizer (field-level)
```

### 15.2 Integration

```
TEST-INT-CUST-001   Signup → customer created (pending_verification) + email sent
TEST-INT-CUST-002   Email verification → status active
TEST-INT-CUST-003   Login with valid password → session created
TEST-INT-CUST-004   Login with invalid password → failed_login_count increments
TEST-INT-CUST-005   5 failed logins → account locked
TEST-INT-CUST-006   Auto-unlock after locked_until
TEST-INT-CUST-007   Password reset flow (request + confirm)
TEST-INT-CUST-008   Magic link single-use + expiry
TEST-INT-CUST-009   2FA enable + verify
TEST-INT-CUST-010   Passkey registration + login
TEST-INT-CUST-011   OAuth signup + linking to existing
TEST-INT-CUST-012   Update profile + activity log entry
TEST-INT-CUST-013   Add/edit/delete addresses + default enforcement
TEST-INT-CUST-014   Consent grant/revoke ledger
TEST-INT-CUST-015   Marketing email list filter (only opted-in)
TEST-INT-CUST-016   Cross-tenant isolation enforced
TEST-INT-CUST-017   Admin creates + invites customer
TEST-INT-CUST-018   Admin impersonation + audit log
TEST-INT-CUST-019   Customer merge — orders, addresses, consents migrated
TEST-INT-CUST-020   GDPR export generates JSON ZIP + signed URL
TEST-INT-CUST-021   GDPR delete saga — PII anonymized, records retained
TEST-INT-CUST-022   GDPR deadline approaching alert
TEST-INT-CUST-023   Duplicate detection job creates proposals
TEST-INT-CUST-024   Customer aggregates updated post-order
TEST-INT-CUST-025   Customer aggregates reconciled (drift detection)
TEST-INT-CUST-026   Customer search via Meilisearch index
TEST-INT-CUST-027   Company creation + member invitation
TEST-INT-CUST-028   Company role downgrade (last owner block)
TEST-INT-CUST-029   B2B order context switching
TEST-INT-CUST-030   Customer group dynamic assignment (Fáze 2)
TEST-INT-CUST-031   Concurrent profile edits — optimistic lock
TEST-INT-CUST-032   Session revocation across devices
```

### 15.3 E2E

```
TEST-E2E-CUST-001  Signup → verify email → first order
TEST-E2E-CUST-002  Login with password + 2FA
TEST-E2E-CUST-003  Passkey enrollment + login
TEST-E2E-CUST-004  Forgot password full flow
TEST-E2E-CUST-005  Update profile + addresses
TEST-E2E-CUST-006  Privacy preferences update consents
TEST-E2E-CUST-007  Admin views customer + impersonates
TEST-E2E-CUST-008  Customer-initiated account deletion (GDPR)
TEST-E2E-CUST-009  Admin merges duplicates
TEST-E2E-CUST-010  B2B customer joins company, places order
```

### 15.4 Load

```
TEST-LOAD-CUST-001  1000 RPS GET /storefront/me → p95 < 50 ms
TEST-LOAD-CUST-002  100 RPS login → no DB bottleneck (Argon2id workers)
TEST-LOAD-CUST-003  Bulk email opt-in/out 10k customers → < 60s
TEST-LOAD-CUST-004  Customer search 50 RPS complex filters → p95 < 100 ms
```

### 15.5 Security

```
TEST-SEC-CUST-001  Email enumeration via signup → generic response
TEST-SEC-CUST-002  Email enumeration via password reset → generic response
TEST-SEC-CUST-003  Brute force login → lockout
TEST-SEC-CUST-004  Session hijack — IP change triggers re-auth (Fáze 2)
TEST-SEC-CUST-005  CSRF on state-changing requests blocked
TEST-SEC-CUST-006  OAuth state validation
TEST-SEC-CUST-007  XSS in customer note sanitized
TEST-SEC-CUST-008  SQL injection on email parameter
TEST-SEC-CUST-009  PII access logged for admin reads
```

---

## 16. Implementation checklist

### Backend
- [ ] **[S]** Drizzle schema `packages/db/src/schema/customers/*.ts`
- [ ] **[S]** Migrace `20260601_001_create_customer_tables.sql` (partitions for activity_log + login_attempts)
- [ ] **[L]** `CustomerService` core — CRUD + state transitions
- [ ] **[L]** `AuthService` — login, logout, sessions, password
- [ ] **[M]** `PasswordService` — Argon2id hashing + verify
- [ ] **[L]** `MagicLinkService` + token signer
- [ ] **[L]** `PasskeyService` — WebAuthn server-side
- [ ] **[L]** `OAuthService` — Google, Apple, Facebook, Microsoft providers
- [ ] **[M]** `TwoFactorService` — TOTP + backup codes
- [ ] **[M]** `ConsentService` — ledger + current-state computation
- [ ] **[M]** `AddressService`
- [ ] **[M]** `CustomerGroupService` + dynamic assignment engine (Fáze 2)
- [ ] **[L]** `CustomerMergeService` — saga
- [ ] **[L]** `GdprService` — export + delete saga
- [ ] **[M]** `CustomerAggregator` — event-driven + reconciliation
- [ ] **[S]** `DuplicateDetector`
- [ ] **[M]** `ImpersonationService`
- [ ] **[M]** `CustomerSearchIndexer` (Meilisearch)
- [ ] **[M]** `CompanyService` — B2B-lite
- [ ] **[M]** REST endpoints per §7
- [ ] **[M]** GraphQL types + resolvers + DataLoaders
- [ ] **[S]** tRPC router (admin)
- [ ] **[S]** MCP tools `customer.get_me` (per agent token customer_id scope)

### Background jobs
- [ ] **[S]** JOB-SEND-WELCOME-EMAIL, JOB-SEND-EMAIL-VERIFICATION, JOB-SEND-PASSWORD-RESET, JOB-SEND-MAGIC-LINK
- [ ] **[S]** JOB-AUTO-UNLOCK-CUSTOMERS
- [ ] **[S]** JOB-EXPIRE-PENDING-VERIFICATIONS
- [ ] **[M]** JOB-RECONCILE-CUSTOMER-AGGREGATES
- [ ] **[M]** JOB-UPDATE-CUSTOMER-AGGREGATES-FROM-ORDER
- [ ] **[S]** JOB-UPDATE-CUSTOMER-RETURN-RATE
- [ ] **[M]** JOB-DETECT-DUPLICATE-CUSTOMERS
- [ ] **[M]** JOB-INDEX-CUSTOMER
- [ ] **[L]** JOB-EXECUTE-GDPR-EXPORT
- [ ] **[L]** JOB-EXECUTE-GDPR-DELETE
- [ ] **[S]** JOB-NOTIFY-GDPR-DEADLINE-APPROACHING
- [ ] **[S]** JOB-CLEANUP-EXPIRED-SESSIONS, JOB-PURGE-OLD-LOGIN-ATTEMPTS, JOB-CLEANUP-EXPIRED-VERIFICATION-TOKENS
- [ ] **[M]** JOB-AUTO-ASSIGN-CUSTOMER-GROUPS (Fáze 2)
- [ ] **[S]** JOB-EXPIRE-IMPERSONATION-SESSIONS
- [ ] **[S]** JOB-NOTIFY-DORMANT-CUSTOMERS (opt-in)

### Frontend — Admin
- [ ] **[L]** Customers list (filter, search, bulk)
- [ ] **[L]** Customer detail view (tabs: profile, orders, returns, addresses, consents, activity, companies, notes)
- [ ] **[M]** Customer create + edit modals
- [ ] **[M]** Impersonate modal + storefront banner
- [ ] **[M]** Customer groups management
- [ ] **[M]** Tag manager
- [ ] **[L]** Merge review screen
- [ ] **[L]** GDPR request queue + processing UI
- [ ] **[L]** Companies management (B2B-lite)
- [ ] **[M]** Company members management
- [ ] **[S]** Customer analytics dashboards (CLV, churn, etc.)

### Frontend — Storefront
- [ ] **[L]** Signup form
- [ ] **[L]** Login form (password + magic link + passkey + OAuth buttons)
- [ ] **[M]** 2FA setup + verify pages
- [ ] **[M]** Passkey enrollment + management
- [ ] **[M]** Forgot password flow
- [ ] **[L]** /account dashboard
- [ ] **[L]** /account/profile editor
- [ ] **[L]** /account/addresses manager
- [ ] **[L]** /account/preferences (privacy + consents)
- [ ] **[M]** /account/sessions (active devices)
- [ ] **[L]** /account/companies (B2B)
- [ ] **[M]** GDPR export request flow
- [ ] **[L]** GDPR delete account flow (multi-step)
- [ ] **[S]** Cookie banner (first visit)
- [ ] **[S]** Email verification landing page
- [ ] **[S]** Magic link callback page
- [ ] **[S]** OAuth callback page
- [ ] **[S]** Single-click unsubscribe page

### Tests
- [ ] **[M]** Per §15
- [ ] **[M]** Security tests (penetration test on auth)

### Docs
- [ ] **[M]** "Managing customers" admin guide
- [ ] **[S]** "Setting up B2B accounts" merchant guide
- [ ] **[S]** "Customer consents and GDPR" compliance guide
- [ ] **[S]** "Handling GDPR requests" admin guide
- [ ] **[S]** "Authentication options" merchant guide (passkeys, magic link setup)
- [ ] **[S]** Customer-facing: "Managing your account" help articles
- [ ] **[S]** Developer: customer event hooks for plugins
- [ ] **[S]** Developer: WebAuthn integration

---

## 17. Open questions

### Q-CUST-001: Cross-tenant customer (loyalty program style)
**Otázka:** Customer with single account across multiple tenants?

**Status:** Out of scope MVP (privacy by design). v3.0+ if explicitly opted-in by customer.

### Q-CUST-002: Customer wishlist
**Otázka:** Wishlist separate domain or part of customer profile?

**Status:** v1.0+ feature. Likely separate doc (cross-cutting with marketing). MVP: not implemented.

### Q-CUST-003: Customer notes admin annotations
**Otázka:** Free-form notes can grow large; structured tags + notes split?

**Status:** Free-form text + tags both supported. Tags for filterable signals, notes for context. Configurable per tenant.

### Q-CUST-004: Email change cooldown
**Otázka:** Limit how often customer can change email (anti-abuse)?

**Status:** v1.0+ feature. MVP: no limit, but verification required.

### Q-CUST-005: Phone verification mandatory
**Otázka:** Some markets require verified phone for high-value purchases?

**Status:** Per-tenant configurable (`require_phone_verification_above_amount`). Default off. SMS infrastructure v1.0+.

### Q-CUST-006: Social login email mismatch handling
**Otázka:** Google account has email X, customer changes Google email to Y. We have X linked.

**Status:** Provider's subject_id is primary key (not email). Email change at provider doesn't break link. We update cached email at next login.

### Q-CUST-007: WebAuthn passkey UX during cross-device login
**Otázka:** Customer registers passkey on iPhone, tries to log in on desktop. Cross-device handoff?

**Status:** WebAuthn supports cross-device flow (CTAP). Browser handles UI. Backend supports both same-device and cross-device assertions.

### Q-CUST-008: Customer impersonation customer notification
**Otázka:** Notify customer "Staff impersonated your account at 10:30" — increases trust or alarms unnecessarily?

**Status:** Configurable per tenant. Default: notify only for high-value customers or with explicit reason categories. Always logged regardless.

### Q-CUST-009: Customer service notes vs internal CRM
**Otázka:** Tighter integration with CRM (HubSpot, Salesforce)?

**Status:** Plugin marketplace via `29-integrations.md`. v1.0+.

### Q-CUST-010: Multi-step verification (KYC for B2B)
**Otázka:** B2B account verification with document upload (e.g., business registration certificate)?

**Status:** Fáze 2 B2B in `21-b2b-complete.md`. Schema-ready via `companies.metadata.verification_documents`.

### Q-CUST-011: AI customer assistant integration
**Otázka:** "Show me customers like Jan Novák" — semantic search via embeddings?

**Status:** Fáze 2+ feature in `33-ai-features.md`.

### Q-CUST-012: Customer data sharing across channels
**Otázka:** Same profile across web + mobile app + POS — unified identity?

**Status:** MVP: yes, single profile per tenant. Cross-tenant out of scope. Mobile/POS auth uses same backend.

### Q-CUST-013: Customer death / estate handling
**Otázka:** Customer passes away — estate management of account, orders, refunds?

**Status:** Manual admin process. Documented procedure: anonymize after estate settlement; preserve accounting records.

### Q-CUST-014: Children's accounts (COPPA, GDPR-K)
**Otázka:** Customer under 16 (EU GDPR consent age) — parental consent required.

**Status:** Schema-ready via `birth_date` check. Logic Fáze 2: if under-age, require guardian email + verification.

### Q-CUST-015: AI agent customer authentication
**Otázka:** AI agent (Claude, Operator) needs to authenticate "on behalf of" customer. How?

**Status:** Per DEC-AUTH-001: agent_tokens with `customer_id` scope. Detail v `30-security.md`.

### Q-CUST-016: Account portability (cross-platform export to competitors)
**Otázka:** GDPR portability requires machine-readable data. Standard format (JSON-LD, schema.org)?

**Status:** MVP: JSON export with semantic structure (schema.org Person + Order). Plugin can add competitor-specific formats.

### Q-CUST-017: Customer email aliases
**Otázka:** Customer's gmail uses `john+shop@gmail.com` alias. Same person?

**Status:** Per tenant rule: optional `email_normalize_plus_aliases=true`. Default false (alias treated as distinct).

### Q-CUST-018: Customer-facing security log
**Otázka:** Show customer "Last 10 logins from devices X, Y, Z" — security transparency?

**Status:** MVP: simple sessions list. v1.0+: full audit-style activity log for customer.

### Q-CUST-019: Customer-initiated 2FA enforcement (admin push)
**Otázka:** Tenant can require all customers enable 2FA?

**Status:** v1.0+ feature. Default opt-in.

### Q-CUST-020: Anonymized customer aggregation (analytics)
**Otázka:** Anonymized customers still count in aggregates (CLV, churn)?

**Status:** Yes; analytics queries include anonymized (their historical purchases happened legitimately). UI excludes from customer list/filter views.

---

## 📅 Změny

| Datum | Změna |
|---|---|
| 2026-05-20 | Initial — Customer Management domain. Profile, addresses, consents (GDPR ledger), customer groups, B2B-lite Company membership, authentication (passkey-first per DEC-AUTH-001), aggregates, merge, GDPR delete saga, impersonation. |

---

**Konec Customer Management.**

➡️ Phase 3 (Transactions & Fulfillment) **kompletní**. Pokračovat na: [`19-marketing-seo.md`](19-marketing-seo.md) (Phase 4: Business Functions).
