# 13 – PAYMENTS

> **Doména:** Platby a platební brány. Provider abstraction (Strategy pattern), authorize/capture lifecycle, 3DS/SCA, refunds, voids, webhook handling, tokenized stored credentials, PCI-minimal scope, multi-currency, reconciliation. Bez MIT (Merchant-Initiated Transactions) v MVP — recurring přijde v `24-subscriptions.md`.

**Datum:** 2026-05-19
**Verze:** 1.0
**Status:** 🟡 DESIGN
**Reference:** [03 §9](03-data-models-master.md#9-orders-payments-shipments) · [DEC-PAY-001](01-decisions-registry.md#dec-pay-001-payment-provider-strategy) · [DEC-PAY-002](01-decisions-registry.md#dec-pay-002-pci-dss-scope) · [12-checkout.md](12-checkout.md) · [16-order-management.md](16-order-management.md) · [17-returns-refunds.md](17-returns-refunds.md)

---

## 📑 Obsah

0. [Domain overview](#0-domain-overview)
1. [References](#1-references)
2. [Personas](#2-personas)
3. [Data models](#3-data-models)
4. [Provider abstraction & MVP providers](#4-provider-abstraction--mvp-providers)
5. [State machines](#5-state-machines)
6. [Business rules](#6-business-rules)
7. [REST API endpoints](#7-rest-api-endpoints)
8. [GraphQL schema](#8-graphql-schema)
9. [Events](#9-events)
10. [Background jobs](#10-background-jobs)
11. [Webhooks (incoming from providers)](#11-webhooks-incoming-from-providers)
12. [UI/UX flows](#12-uiux-flows)
13. [Edge cases & error handling](#13-edge-cases--error-handling)
14. [Performance](#14-performance)
15. [Security & PCI](#15-security--pci)
16. [Testing](#16-testing)
17. [Implementation checklist](#17-implementation-checklist)
18. [Open questions](#18-open-questions)

---

## 0. Domain overview

### 0.1 Co tato doména **je**

- **Provider abstraction** — jediný `PaymentProvider` interface, N implementací
- **MVP providers (CZ/EU first):** Stripe, GoPay, ComGate, ThePay, PayPal, bank transfer (manual), Cash on Delivery (COD)
- **Payment lifecycle** — `requires_payment_method → requires_action (3DS) → processing → authorized → captured → refunded`
- **Authorize + Capture** — separate or combined per provider/method; pre-orders use delayed capture
- **3DS / SCA orchestration** — handled per-provider, our state machine aware
- **Refunds** — full + partial, original method vs alternative method
- **Voids** — pre-capture cancellation
- **Saved payment methods (tokens)** — provider tokens stored (no PAN); customer can re-use
- **Stored credentials (CIT)** — Customer-Initiated Transactions with saved method
- **Webhook ingestion** — per provider, signature-verified, idempotent
- **Reconciliation** — daily settlement reports → match against our ledger
- **Failed payment handling** — retry policy, dunning (basic in MVP, full in `24-subscriptions.md`)
- **Fraud signals** — payment_method risk hints feeding fraud engine
- **Multi-currency** — provider currency support varies; auto-convert if needed
- **Webhook outbound** — emit our events for merchant subscribers

### 0.2 Co tato doména **NENÍ**

- ❌ Checkout flow (→ `12-checkout.md`)
- ❌ Order lifecycle (→ `16-order-management.md`)
- ❌ Refund initiation from customer (→ `17-returns-refunds.md` — returns workflow that calls our refund API)
- ❌ Subscription recurring billing (→ `24-subscriptions.md` MIT — Merchant-Initiated; uses our authorize/capture under the hood)
- ❌ Gift card balance/redemption (→ `10-pricing-promotions.md`; payment domain just receives gift card as one payment method)
- ❌ Tax / invoice (→ `15-tax-compliance.md`)
- ❌ Payouts to marketplace sellers (→ `25-marketplace.md`)
- ❌ Customer payment method UI in storefront (delegated; checkout step from `12`)

### 0.3 Diferenciátory

1. **0% transaction fee napořád** ([DEC-BIZ-001](01-decisions-registry.md#dec-biz-001-pricing-model)) — platforma nebere žádný cut; provider fees go directly merchant ↔ provider
2. **EU-first provider matrix** — primary GoPay/ComGate/ThePay pro CZ tržiště; Stripe pro mezinárodní + EU compliance (PSD2/SCA)
3. **Provider-agnostic refund API** — merchant nemusí znát rozdíly mezi Stripe Refund vs GoPay reverze; my abstrahujeme
4. **Reconciliation built-in** — daily settlement match s our ledger; alert na drift
5. **PCI SAQ A scope** (lowest tier) — žádný PAN ever touches our infrastructure (DEC-PAY-002)

---

## 1. References

- [DEC-PAY-001](01-decisions-registry.md#dec-pay-001-payment-provider-strategy) — provider strategy, MVP list
- [DEC-PAY-002](01-decisions-registry.md#dec-pay-002-pci-dss-scope) — PCI tokenization-only, SAQ A
- [DEC-SEC-001](01-decisions-registry.md#dec-sec-001-security-baseline) — security baseline, encryption at rest
- [DEC-SEC-002](01-decisions-registry.md#dec-sec-002-secrets-management) — Vault for API keys, rotation
- [03 §9](03-data-models-master.md#9-orders-payments-shipments) — ENT-PAYMENT-001, ENT-REFUND-001
- [03 §11](03-data-models-master.md#11-customers--b2b) — customers + addresses
- [12-checkout.md](12-checkout.md) — payment intent creation step
- [16-order-management.md](16-order-management.md) — payment_status, order lifecycle
- [17-returns-refunds.md](17-returns-refunds.md) — refund initiation flows
- [24-subscriptions.md](24-subscriptions.md) — MIT recurring (Fáze 2+)
- [25-marketplace.md](25-marketplace.md) — marketplace split payments (Fáze 4)
- [30-security.md](30-security.md) — PCI, encryption, fraud
- Provider docs: Stripe (api.stripe.com), GoPay (doc.gopay.com), ComGate (help.comgate.cz), ThePay (gateway.thepay.cz/api), PayPal (developer.paypal.com)
- PSD2 SCA technical standards (EBA RTS)
- 3D Secure 2.x EMVCo spec

---

## 2. Personas

| Persona | Použití | Klíčové permissions |
|---|---|---|
| `PERSONA-MERCHANT-OWNER` | Configure providers, view all payments, manual refund | `PERM-PAYMENT-*` |
| `PERSONA-FINANCE-MANAGER` | View payments, refund, reconciliation reports | `PERM-PAYMENT-VIEW`, `PERM-PAYMENT-REFUND`, `PERM-PAYMENT-RECONCILE` |
| `PERSONA-CUSTOMER-SERVICE` | Issue refunds (within policy), view payment status per order | `PERM-PAYMENT-REFUND` (capped amount), `PERM-PAYMENT-VIEW` |
| `PERSONA-CUSTOMER` | Pay during checkout, see receipts, manage saved methods | None (auth-gated via own customer_id) |
| `PERSONA-PAYMENT-PROVIDER-INTEGRATION` (system actor) | Webhook callbacks | API key with `payments:webhook` scope |
| `PERSONA-AI-COPILOT` | Suggest refund per support context, anomaly detection | `agent:payments:read` |
| `PERSONA-EXTERNAL-AGENT` | Initiate payment via MCP (limited; behind agent_token) | `agent:payments:initiate` |

---

## 3. Data models

### 3.1 `payments` ([ENT-PAYMENT-001](03-data-models-master.md#ent-payment-001))

```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  pub_id TEXT NOT NULL,                                          -- pay_ NanoID
  order_id UUID NOT NULL REFERENCES orders(id),
  customer_id UUID NULL REFERENCES customers(id),                 -- denormalized for queries
  provider_code TEXT NOT NULL CHECK (provider_code IN (
    'stripe','gopay','comgate','thepay','paypal','bank_transfer','cod','gift_card','manual'
  )),
  provider_payment_id TEXT NULL,                                  -- e.g., Stripe PaymentIntent id "pi_3OabcXY..."
  provider_charge_id TEXT NULL,                                   -- e.g., Stripe Charge id "ch_..."
  provider_intent_client_secret TEXT NULL,                         -- transient; not for storage long-term
  -- transaction kind & status
  kind TEXT NOT NULL CHECK (kind IN ('charge','authorization','capture','void','refund','adjustment')),
  status TEXT NOT NULL CHECK (status IN (
    'pending','requires_payment_method','requires_action','processing',
    'authorized','captured','partially_captured','partially_refunded','refunded',
    'failed','cancelled','expired','disputed'
  )),
  -- amounts
  amount BIGINT NOT NULL,                                          -- requested amount (minor unit)
  amount_authorized BIGINT NULL,                                    -- after auth, what was authorized (may differ for incremental)
  amount_captured BIGINT NULL,                                       -- captured to date
  amount_refunded BIGINT NULL DEFAULT 0,                              -- refunded to date
  amount_voided BIGINT NULL,                                          -- voided amount pre-capture
  currency CHAR(3) NOT NULL,
  -- method / instrument (PCI scope safe)
  method_kind TEXT NULL CHECK (method_kind IN (
    'card','bank_transfer','apple_pay','google_pay','paypal',
    'sepa_debit','sofort','giropay','ideal','blik','bancontact',
    'klarna','afterpay','cod','gift_card','customer_balance'
  ) OR method_kind IS NULL),
  method_brand TEXT NULL,                                            -- 'visa','mastercard','maestro','amex'
  method_last4 TEXT NULL,
  method_expires_month INTEGER NULL,
  method_expires_year INTEGER NULL,
  method_country CHAR(2) NULL,                                       -- card issuer country (fraud signal)
  method_funding TEXT NULL CHECK (method_funding IN ('credit','debit','prepaid','unknown') OR method_funding IS NULL),
  method_fingerprint TEXT NULL,                                      -- provider-stable token for dedup / fraud
  saved_payment_method_id UUID NULL,                                  -- → saved_payment_methods if stored
  -- 3DS / SCA
  three_d_secure_required BOOLEAN NOT NULL DEFAULT false,
  three_d_secure_completed BOOLEAN NULL,
  three_d_secure_version TEXT NULL,                                  -- '2.1','2.2'
  three_d_secure_result TEXT NULL CHECK (three_d_secure_result IN ('authenticated','attempted','not_required','failed') OR three_d_secure_result IS NULL),
  -- authentication URL (during requires_action)
  authentication_url TEXT NULL,
  -- failure
  failure_code TEXT NULL,
  failure_message TEXT NULL,
  failure_decline_code TEXT NULL,                                    -- provider's internal code (e.g., Stripe 'card_declined')
  -- timestamps
  initiated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  authorized_at TIMESTAMPTZ NULL,
  captured_at TIMESTAMPTZ NULL,
  refunded_at TIMESTAMPTZ NULL,
  voided_at TIMESTAMPTZ NULL,
  failed_at TIMESTAMPTZ NULL,
  expires_at TIMESTAMPTZ NULL,                                       -- auth holds typically 7d
  -- idempotency
  idempotency_key TEXT NULL,
  -- chargeback / dispute
  disputed_at TIMESTAMPTZ NULL,
  dispute_reason TEXT NULL,
  dispute_status TEXT NULL CHECK (dispute_status IN ('needs_response','under_review','won','lost','warning') OR dispute_status IS NULL),
  -- raw provider response (sanitized)
  raw_payload JSONB NULL,
  webhook_received_at TIMESTAMPTZ NULL,
  -- attribution / risk
  risk_score INTEGER NULL,
  risk_signals JSONB NULL,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_payments_provider_payment_id
    UNIQUE (tenant_id, provider_code, provider_payment_id) DEFERRABLE INITIALLY IMMEDIATE,
  CONSTRAINT uq_payments_idempotency
    UNIQUE (tenant_id, idempotency_key) DEFERRABLE INITIALLY IMMEDIATE,
  CONSTRAINT ck_amounts_non_negative CHECK (
    amount >= 0 AND
    (amount_authorized IS NULL OR amount_authorized >= 0) AND
    (amount_captured IS NULL OR amount_captured >= 0) AND
    (amount_refunded IS NULL OR amount_refunded >= 0) AND
    (amount_voided IS NULL OR amount_voided >= 0)
  ),
  CONSTRAINT ck_captured_le_authorized CHECK (
    amount_captured IS NULL OR amount_authorized IS NULL OR amount_captured <= amount_authorized
  ),
  CONSTRAINT ck_refunded_le_captured CHECK (
    amount_refunded IS NULL OR amount_captured IS NULL OR amount_refunded <= amount_captured
  )
);

CREATE UNIQUE INDEX uq_payments_pub_id ON payments (tenant_id, pub_id);
CREATE INDEX idx_payments_order ON payments (order_id, initiated_at DESC);
CREATE INDEX idx_payments_status ON payments (tenant_id, status, initiated_at DESC);
CREATE INDEX idx_payments_provider ON payments (tenant_id, provider_code, status);
CREATE INDEX idx_payments_customer ON payments (customer_id, initiated_at DESC) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_payments_expires_auth ON payments (expires_at) WHERE status = 'authorized' AND expires_at IS NOT NULL;
CREATE INDEX idx_payments_method_fingerprint ON payments (method_fingerprint) WHERE method_fingerprint IS NOT NULL;
CREATE INDEX idx_payments_disputed ON payments (tenant_id, disputed_at DESC) WHERE disputed_at IS NOT NULL;
```

### 3.2 `refunds` ([ENT-REFUND-001](03-data-models-master.md#ent-refund-001))

```sql
CREATE TABLE refunds (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  pub_id TEXT NOT NULL,                                           -- rfd_ NanoID
  order_id UUID NOT NULL REFERENCES orders(id),
  payment_id UUID NOT NULL REFERENCES payments(id),
  return_id UUID NULL REFERENCES returns(id),                      -- if refund from RMA
  customer_id UUID NULL REFERENCES customers(id),
  provider_refund_id TEXT NULL,                                    -- Stripe Refund id 're_...'
  amount BIGINT NOT NULL,
  currency CHAR(3) NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN (
    'customer_request','duplicate','fraudulent','order_cancelled',
    'product_unavailable','price_adjustment','goodwill','chargeback','other'
  )),
  reason_notes TEXT NULL,
  -- method (default: same as original; alternative methods possible)
  refund_method TEXT NOT NULL CHECK (refund_method IN ('original_payment','store_credit','bank_transfer','gift_card','manual')) DEFAULT 'original_payment',
  -- status
  status TEXT NOT NULL CHECK (status IN ('pending','processing','succeeded','failed','cancelled')) DEFAULT 'pending',
  -- destination (if not original)
  destination_bank_account_iban TEXT NULL,                          -- encrypted; for bank_transfer refunds
  destination_email CITEXT NULL,                                     -- for gift_card / store_credit recipient
  destination_gift_card_id UUID NULL REFERENCES gift_cards(id),     -- if refund issued as gift card
  -- timestamps
  initiated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ NULL,
  failed_at TIMESTAMPTZ NULL,
  -- actor
  initiated_by_actor_kind TEXT NOT NULL CHECK (initiated_by_actor_kind IN ('user','customer','system','agent','webhook')),
  initiated_by_actor_id UUID NULL,
  -- failure
  failure_code TEXT NULL,
  failure_message TEXT NULL,
  -- idempotency
  idempotency_key TEXT NULL,
  -- raw
  raw_payload JSONB NULL,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_refunds_pub_id UNIQUE (tenant_id, pub_id),
  CONSTRAINT uq_refunds_provider UNIQUE (tenant_id, provider_refund_id) DEFERRABLE INITIALLY IMMEDIATE,
  CONSTRAINT uq_refunds_idempotency UNIQUE (tenant_id, idempotency_key) DEFERRABLE INITIALLY IMMEDIATE,
  CONSTRAINT ck_refund_amount_positive CHECK (amount > 0)
);

CREATE INDEX idx_refunds_payment ON refunds (payment_id);
CREATE INDEX idx_refunds_order ON refunds (order_id);
CREATE INDEX idx_refunds_status ON refunds (tenant_id, status, initiated_at DESC);
```

### 3.3 `saved_payment_methods`

Tokenized stored credentials (no PAN). For 1-click checkout, subscriptions, returning customers.

```sql
CREATE TABLE saved_payment_methods (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  provider_code TEXT NOT NULL,
  provider_payment_method_id TEXT NOT NULL,                         -- 'pm_...' (Stripe), provider-specific
  provider_customer_id TEXT NULL,                                    -- 'cus_...' (Stripe)
  method_kind TEXT NOT NULL,                                          -- 'card','sepa_debit','paypal'
  display_name TEXT NOT NULL,                                          -- 'Visa •••• 4242'
  brand TEXT NULL,
  last4 TEXT NULL,
  expires_month INTEGER NULL,
  expires_year INTEGER NULL,
  method_funding TEXT NULL,
  method_country CHAR(2) NULL,
  method_fingerprint TEXT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ NULL,
  expires_at TIMESTAMPTZ NULL,                                         -- computed from card expiry; NULL pro non-card
  -- billing address snapshot (for AVS pro re-use)
  billing_address_snapshot JSONB NULL,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_saved_pm_customer_provider_method
    UNIQUE (customer_id, provider_code, provider_payment_method_id)
);

CREATE INDEX idx_saved_pm_customer ON saved_payment_methods (customer_id) WHERE is_active = true AND deleted_at IS NULL;
CREATE UNIQUE INDEX uq_saved_pm_customer_default
  ON saved_payment_methods (customer_id)
  WHERE is_default = true AND is_active = true AND deleted_at IS NULL;
```

### 3.4 `payment_provider_configs`

Per-tenant provider configuration (API keys references, options).

```sql
CREATE TABLE payment_provider_configs (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  provider_code TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  is_test_mode BOOLEAN NOT NULL DEFAULT true,
  display_name TEXT NOT NULL,                                          -- "Stripe (cards)"
  display_icon_media_id UUID NULL REFERENCES media(id),
  priority INTEGER NOT NULL DEFAULT 0,                                 -- ordering in checkout
  -- secrets (references to Vault paths; not stored here directly)
  credentials_vault_path TEXT NULL,                                     -- e.g., 'shopio/tenants/{id}/stripe/api_key'
  webhook_secret_vault_path TEXT NULL,
  webhook_endpoint_url TEXT NULL,                                       -- their endpoint pointed at us
  -- supported currencies / countries (filter checkout method options)
  supported_currencies TEXT[] NOT NULL DEFAULT '{}',
  supported_countries CHAR(2)[] NOT NULL DEFAULT '{}',
  supported_method_kinds TEXT[] NOT NULL DEFAULT '{}',
  -- behavior toggles
  capture_strategy TEXT NOT NULL CHECK (capture_strategy IN ('automatic','manual','delayed')) DEFAULT 'automatic',
  capture_delay_hours INTEGER NULL,                                    -- pro 'delayed' (e.g., 24h before capture)
  three_d_secure_strategy TEXT NOT NULL CHECK (three_d_secure_strategy IN ('automatic','required','disabled')) DEFAULT 'automatic',
  save_method_default BOOLEAN NOT NULL DEFAULT false,
  refund_policy_days INTEGER NULL,                                      -- merchant policy days (e.g., 30); applied app-side
  -- ad-hoc options
  options JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL,
  updated_by UUID NULL,

  CONSTRAINT uq_payment_provider_configs UNIQUE (tenant_id, provider_code)
);

CREATE INDEX idx_payment_provider_configs_enabled
  ON payment_provider_configs (tenant_id)
  WHERE is_enabled = true;
```

### 3.5 `payment_webhook_events`

Inbound webhook log. Idempotent ingestion guarantee via `(provider_code, provider_event_id)`.

```sql
CREATE TABLE payment_webhook_events (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  provider_code TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  provider_event_type TEXT NOT NULL,                                    -- 'payment_intent.succeeded', etc.
  related_payment_id UUID NULL REFERENCES payments(id),
  related_refund_id UUID NULL REFERENCES refunds(id),
  payload JSONB NOT NULL,
  signature_verified BOOLEAN NOT NULL DEFAULT false,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ NULL,
  processing_error TEXT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT uq_payment_webhook_events
    UNIQUE (provider_code, provider_event_id)
) PARTITION BY RANGE (received_at);

CREATE INDEX idx_payment_webhook_unprocessed
  ON payment_webhook_events (received_at)
  WHERE processed_at IS NULL;
CREATE INDEX brin_payment_webhook_received ON payment_webhook_events USING BRIN (received_at);
```

### 3.6 `payment_settlements`

Daily settlement records from providers (reconciliation source).

```sql
CREATE TABLE payment_settlements (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  provider_code TEXT NOT NULL,
  settlement_date DATE NOT NULL,
  provider_settlement_id TEXT NOT NULL,
  gross_amount BIGINT NOT NULL,
  fees_amount BIGINT NOT NULL,
  net_amount BIGINT NOT NULL,
  refunds_amount BIGINT NOT NULL DEFAULT 0,
  chargebacks_amount BIGINT NOT NULL DEFAULT 0,
  currency CHAR(3) NOT NULL,
  payment_count INTEGER NOT NULL DEFAULT 0,
  refund_count INTEGER NOT NULL DEFAULT 0,
  reconciled_at TIMESTAMPTZ NULL,
  reconciliation_drift BIGINT NULL,                                      -- our ledger - provider total (should be 0)
  reconciliation_notes TEXT NULL,
  raw_report_storage_key TEXT NULL,                                      -- S3 path to CSV/JSON report
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_payment_settlements UNIQUE (tenant_id, provider_code, provider_settlement_id)
);

CREATE INDEX idx_payment_settlements_date ON payment_settlements (tenant_id, settlement_date DESC);
```

### 3.7 `payment_disputes` *(chargebacks)*

```sql
CREATE TABLE payment_disputes (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  pub_id TEXT NOT NULL,                                                  -- dsp_ NanoID
  payment_id UUID NOT NULL REFERENCES payments(id),
  order_id UUID NOT NULL REFERENCES orders(id),
  provider_dispute_id TEXT NOT NULL,
  reason TEXT NOT NULL,                                                   -- e.g., 'fraudulent','duplicate','product_not_received'
  reason_message TEXT NULL,
  amount BIGINT NOT NULL,
  currency CHAR(3) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('needs_response','under_review','won','lost','warning','accepted')) DEFAULT 'needs_response',
  evidence_due_by TIMESTAMPTZ NULL,
  evidence_submitted_at TIMESTAMPTZ NULL,
  evidence JSONB NULL,
  outcome TEXT NULL,                                                      -- 'won','lost'
  outcome_at TIMESTAMPTZ NULL,
  raw_payload JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_disputes_provider UNIQUE (tenant_id, provider_dispute_id)
);

CREATE INDEX idx_disputes_status ON payment_disputes (tenant_id, status, evidence_due_by);
```

### 3.8 Vztahy

```
tenants (1)──(N) payment_provider_configs
orders (1)──(N) payments                          [multiple payment attempts; partial captures]
orders (1)──(N) refunds
payments (1)──(N) refunds
payments (1)──(N) payment_disputes
customers (1)──(N) saved_payment_methods
customers (1)──(N) payments                       [denormalized]
payments (1)──(N) payment_webhook_events
provider_configs ──(N) payment_settlements        [per provider per day]
```

---

## 4. Provider abstraction & MVP providers

### 4.1 `PaymentProvider` interface

```typescript
interface PaymentProvider {
  readonly code: string;
  readonly capabilities: ProviderCapabilities;

  // Lifecycle
  createIntent(input: CreateIntentInput): Promise<IntentResult>;
  updateIntent(intentId: string, input: UpdateIntentInput): Promise<IntentResult>;
  confirmIntent(intentId: string, input: ConfirmIntentInput): Promise<ConfirmResult>;
  capture(intentId: string, amount?: number): Promise<CaptureResult>;
  cancel(intentId: string): Promise<CancelResult>;
  refund(input: RefundInput): Promise<RefundResult>;

  // Stored methods
  attachPaymentMethod(customerProviderId: string, paymentMethodId: string): Promise<void>;
  detachPaymentMethod(paymentMethodId: string): Promise<void>;
  retrievePaymentMethod(paymentMethodId: string): Promise<MethodDetails>;
  createOrRetrieveProviderCustomer(customer: Customer): Promise<{ provider_customer_id: string }>;

  // Webhook
  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean;
  parseWebhookEvent(payload: object): NormalizedEvent;

  // Reconciliation
  fetchSettlementReport(date: Date): Promise<SettlementReport>;
}

interface ProviderCapabilities {
  supports3ds: boolean;
  supportsAuthCapture: boolean;        // separate auth + capture
  supportsPartialRefund: boolean;
  supportsPartialCapture: boolean;
  supportsMultipleCapture: boolean;     // incremental authorization
  supportsSavedMethods: boolean;
  supportsRecurring: boolean;            // MIT
  supportedCurrencies: string[];
  supportedCountries: string[];
  supportedMethodKinds: string[];
  authHoldDurationDays: number;          // typically 7
}
```

### 4.2 MVP providers

| Provider | Locale | Currencies | Methods | 3DS | Auth+Capture | Saved methods | Recurring |
|---|---|---|---|---|---|---|---|
| **Stripe** | Global | 130+ | Card, Apple/Google Pay, SEPA, iDEAL, Bancontact, Sofort, Klarna, Afterpay, ... | ✅ 2.x | ✅ | ✅ | ✅ |
| **GoPay** | CZ/SK | CZK, EUR | Card, GoPay wallet, Apple/Google Pay, bank transfer | ✅ | Limited | ✅ | ✅ |
| **ComGate** | CZ | CZK, EUR | Card, bank, Premium SMS, Apple/Google Pay | ✅ | ❌ (auto-capture) | ❌ (Fáze 2) | ❌ |
| **ThePay** | CZ | CZK, EUR | Card, bank, PayPal, BNPL | ✅ | Limited | Limited | ❌ |
| **PayPal** | Global | 25+ | PayPal wallet, card-via-PayPal | ✅ (3DS where applicable) | ✅ | ✅ | ✅ |
| **bank_transfer** (manual) | Any | Any | Bank transfer w/ reference | n/a | n/a | n/a | n/a |
| **COD** (Cash on Delivery) | CZ/SK/PL/RO | Local | Cash at delivery | n/a | n/a | n/a | n/a |
| **gift_card** (internal) | n/a | Tenant currencies | Gift card balance | n/a | n/a | n/a | n/a |

### 4.3 MVP provider matrix

```
Phase 1 (MVP):
  - Stripe (primary card processor, international)
  - GoPay (CZ local + EU)
  - ComGate (CZ alternative)
  - ThePay (CZ niche)
  - PayPal (global wallet)
  - bank_transfer (zero-cost option, manual reconcile)
  - COD (CZ/SK essential)
  - gift_card (internal "method")

Phase 2 (v1.0+):
  - Adyen (enterprise, alternative to Stripe)
  - Klarna (BNPL, integrated separately or via Stripe)
  - Mollie (NL/BE/DE alt)
  - PayU (PL, RO)

Phase 3 (v2.0+):
  - TWINT (Switzerland)
  - BLIK direct (PL — currently via Stripe)
  - Local CEE methods

Phase 4 (v3.0+):
  - Crypto (USDC via Coinbase Commerce)
  - Local APAC methods (Alipay, WeChat Pay, Line Pay)
```

### 4.4 Provider routing

When checkout's `payment_method_kind` set:
1. Filter `payment_provider_configs WHERE is_enabled = true` matching:
   - `currency IN supported_currencies`
   - `customer.country_code IN supported_countries` (or no restriction)
   - `method_kind IN supported_method_kinds`
2. Sort by `priority DESC` then ordered list
3. Pick first match; tenant can override (multi-provider for same method, A/B split, fallback chain) — Fáze 2+

---

## 5. State machines

### 5.1 Payment status lifecycle

```
           ┌─────────────────────────────────────────────────────────┐
           │                                                         │
           ▼                                                         │
      pending ──init──▶ requires_payment_method                       │
                            │                                         │
                            │ method attached                          │
                            ▼                                         │
                       processing ───┐                                │
                            │        │                                │
        ┌───────────────────┤        ├─── requires_action (3DS) ──────┤
        │                   │        │            │                  │
        │                   │        │            │ challenge done   │
        │                   │        │            ▼                  │
        │                   │        └──▶ processing                 │
        │                   │                     │                  │
        │   FAIL            │   SUCCESS           │                  │
        ▼                   ▼                     │                  │
     failed           authorized                  │                  │
        │                   │                     │                  │
        │                   ├─── capture(amount)──▶ partially_captured│
        │                   │                     │                  │
        │                   │                     ├── capture all ──▶ captured
        │                   │                     │                  │
        │                   │                     ├── cancel ───────▶ cancelled
        │                   │                     │                  │
        │                   │                     └── auth expires ─▶ expired
        │                   │
        │                   ├─── refund ───▶ partially_refunded
        │                   │                     │
        │                   │                     └── refund all ──▶ refunded
        │                   │
        │                   └─── dispute opened ─▶ disputed
        │
        └─── retry possible (different method) ──▶ pending
```

**Allowed transitions** (canonical):

| From | Event | To |
|---|---|---|
| `(none)` | `init_intent` | `pending` or `requires_payment_method` (depending on provider) |
| `pending` / `requires_payment_method` | `confirm_with_method` | `processing` |
| `processing` | `requires_action` | `requires_action` |
| `requires_action` | `authentication_succeeded` | `processing` |
| `requires_action` | `authentication_failed` / `timeout` | `failed` (or back to `requires_payment_method`) |
| `processing` | `provider_authorized` | `authorized` |
| `processing` | `provider_captured` (auto-capture) | `captured` |
| `processing` | `provider_declined` | `failed` |
| `authorized` | `capture(full)` | `captured` |
| `authorized` | `capture(partial)` | `partially_captured` |
| `partially_captured` | `capture(remaining)` | `captured` |
| `authorized` | `cancel` | `cancelled` |
| `authorized` | `auth_hold_expires` (>7d typically) | `expired` |
| `captured` / `partially_captured` | `refund(partial)` | `partially_refunded` |
| `partially_refunded` | `refund(remaining)` | `refunded` |
| `captured` / `partially_captured` | `dispute_opened` | `disputed` |

### 5.2 Refund lifecycle

```
[pending] ──provider call──▶ [processing] ──webhook──▶ [succeeded]
                                  │
                                  └──▶ [failed]
              │
              └──manual cancel──▶ [cancelled]
```

### 5.3 Dispute lifecycle

```
[needs_response] ──submit evidence──▶ [under_review] ──┬──▶ [won]
       │                                                │
       │                                                └──▶ [lost]
       │
       ├──accept (no contest)──▶ [accepted]
       │
       └──warning (issuer-side)──▶ [warning]   (informational, no action needed yet)
```

---

## 6. Business rules

### RULE-PAY-001: Provider abstraction; no leaky provider-specifics in core

Core (services, controllers) uses `PaymentProvider` interface only. Provider-specific logic isolated in `packages/core/src/payments/providers/{stripe,gopay,...}/`.

Webhook handlers normalize external events to our `EVENT-PAYMENT-*` schema before downstream consumers see them.

### RULE-PAY-002: PCI tokenization-only (DEC-PAY-002)

- **PAN, CVV NEVER touch our infra.** All card input via provider iframes / Elements.
- Stored: `provider_payment_method_id`, `brand`, `last4`, `expires_*`, `funding`, `country`, `fingerprint`. Nothing more.
- Webhook payloads sanitized: strip PAN if provider erroneously sends.
- Logs scrubbed: regex filter masks any 13–19 digit number sequences.

### RULE-PAY-003: Idempotency keys mandatory

Every `create_intent`, `capture`, `cancel`, `refund` call requires `Idempotency-Key`. Cached 24h in Redis (per `04 §11`).

Provider-side idempotency: pass our key as their idempotency header (Stripe-Idempotency-Key, etc.). If provider re-receives same key, returns cached response.

### RULE-PAY-004: Webhook signature verification

Every inbound webhook MUST verify signature:
- Stripe: HMAC-SHA256 with `Stripe-Signature` header, anti-replay via timestamp (5 min window)
- GoPay: provided signature mechanism
- ComGate: HMAC + IP whitelist
- ThePay: HMAC

Invalid signature → reject 401, log, alert. NEVER process payload.

### RULE-PAY-005: Webhook idempotent processing

`(provider_code, provider_event_id)` unique constraint. Duplicate webhook delivery (provider retries) detected and acknowledged 200 OK without reprocessing.

### RULE-PAY-006: Webhook ordering not guaranteed

Providers may deliver `payment_intent.succeeded` and `payment_intent.payment_failed` out of order. Our state machine enforces valid transitions; out-of-order event for already-terminal state → log + ignore.

Strategy: trust the **latest** authoritative state from provider via `query intent` on suspicious transitions.

### RULE-PAY-007: Authorize + Capture separation

Tenant may configure `capture_strategy` per provider:
- `automatic`: capture happens immediately on authorize (default for low-risk; one-step charge)
- `manual`: merchant calls capture later (pre-orders, custom workflows)
- `delayed`: capture after `capture_delay_hours` (fraud cooldown)

Auth holds expire after provider-defined window (typically 7 days). Job `JOB-EXPIRE-AUTHORIZATIONS` warns merchant before expiry.

### RULE-PAY-008: Partial capture

Provider permitting (Stripe ✅, GoPay limited): merchant captures `amount ≤ amount_authorized`. Remaining can be captured later (multiple captures) or voided.

If provider doesn't support partial capture: capture full, then refund excess.

### RULE-PAY-009: Refund within capture amount

Total refunds `<= amount_captured`. Provider validates; we double-check pre-call. Excess refund request → 422.

### RULE-PAY-010: Refund original method preferred

Default `refund_method = 'original_payment'`. Funds back to original card/bank/wallet via provider.

Alternatives (merchant override):
- `store_credit`: issue store credit (creates `gift_cards` entry with `kind='store_credit'`)
- `gift_card`: same effect; may be tied to specific recipient
- `bank_transfer`: manual; merchant transfers via banking; creates internal accounting record
- `manual`: out-of-band; merchant marks refund as "given" without our system processing

If original payment is COD: refund_method MUST be alternative (no card to refund to).

### RULE-PAY-011: Refund timing rules

- Within capture authorization window (typically 7 days): instant refund possible via void (`cancel` API)
- Post-capture: standard refund (3-10 business days customer-visible turnaround)
- After tenant policy `refund_policy_days` (default 30 days from order): require admin override

### RULE-PAY-012: Refund window for tax/compliance

EU consumer rights: 14-day cooling-off period (return guarantee). Merchant policy may extend.

Our system doesn't enforce; we provide tooling. `17-returns-refunds.md` covers RMA workflow.

### RULE-PAY-013: 3DS / SCA requirements

PSD2 in EU: SCA required for most EU customer transactions over €30, with exemptions:
- Trusted Beneficiaries (whitelisted by customer's bank)
- Low value (< €30)
- Recurring identical (subscription MIT)
- Corporate cards

Strategy: rely on provider to determine 3DS necessity. Our state machine handles `requires_action`. SCA failure → retry with different method or fall to 3DS-required flow.

### RULE-PAY-014: Saved payment methods

`saved_payment_methods` row created post-successful charge if:
- Customer opted-in (`save_for_future_use=true` in checkout)
- Provider supports stored methods
- Method type allows (cards, SEPA usually; not COD)

PCI scope: store only provider tokens (per RULE-PAY-002).

### RULE-PAY-015: Default payment method

Customer has at most 1 `is_default=true` saved method per provider. Set default explicit; first added becomes default automatically.

### RULE-PAY-016: Method expiry handling

Cards expire monthly. `JOB-DETECT-EXPIRING-CARDS` (daily) finds methods expiring within 30 days, notifies customer to update. Provider's account updater (network token / Stripe's auto-update) may update expiry/last4 silently — we sync via webhook `payment_method.updated`.

### RULE-PAY-017: Subscription / recurring (MIT) — out of MVP scope

Recurring billing (`subscriptions`) uses our saved methods to perform MIT charges. Detail v `24-subscriptions.md`.

Payment domain provides the primitives (capture against saved method) but billing scheduling lives in subscription domain.

### RULE-PAY-018: Multi-currency

Provider currency capability filters available methods. If cart in CZK but provider supports EUR only: auto-convert via exchange_rates, customer sees both ("Charged 50.00 EUR ≈ 1225 CZK").

Reconciliation: track both `amount` (in cart currency) and `provider_amount` + `provider_currency` (settlement currency) in metadata.

### RULE-PAY-019: COD payment lifecycle

Cash on Delivery:
- Payment row created at order placement with `status='pending'`, `provider_code='cod'`
- Order status proceeds to fulfillment
- Carrier integration reports COD collection via webhook → mark `status='captured'`, `captured_at=now()`
- If carrier reports no-collection: `status='failed'`, order auto-cancelled (per merchant policy)

### RULE-PAY-020: Bank transfer payment lifecycle

- Payment row `status='pending'`, `provider_code='bank_transfer'`
- Customer instructions: account, reference (typically order_number)
- Manual reconciliation: admin marks payment as captured when bank statement shows incoming
- OR automated (Fáze 2): CSV statement import matched on reference number
- Default expiration: 7 days (configurable); after expiry, order auto-cancelled

### RULE-PAY-021: Gift card as payment method

- `gift_card` provider is internal (no external call)
- Atomic with order placement: decrement `gift_cards.balance`, insert `gift_card_transactions` row
- Mixed payment: gift card + card (split) — multiple `payments` rows, each ≤ amount_due

### RULE-PAY-022: Dispute / chargeback handling

When provider notifies dispute (Stripe `charge.dispute.created`):
- Insert `payment_disputes` row
- Set payment status='disputed'
- Notify merchant immediately (in-app + email)
- Auto-create draft evidence with order details (receipt, shipping tracking, ToS acceptance)
- Merchant has provider-defined deadline to submit
- Outcome via webhook: status updated to `won` / `lost`
- If lost: typically auto-refund + chargeback fee (already taken by provider; we record)

### RULE-PAY-023: Failed payment retry policy

Customer-initiated retry: storefront checkout allows different method (per `12-checkout.md`).

System-initiated (subscription MIT): retry strategy v `24-subscriptions.md`.

Idempotency: each retry uses **new** Idempotency-Key (different attempt = different operation).

### RULE-PAY-024: Settlement reconciliation

`JOB-RECONCILE-SETTLEMENTS` daily:
- Fetch provider settlement report (Stripe Balance Transactions, GoPay reports, ...)
- For each line: match against our `payments` / `refunds` ledger
- Sum gross + refunds + fees; compute `reconciliation_drift = our_total - provider_total`
- Drift > 0 → alert admin (manual investigation)

### RULE-PAY-025: Fraud signals propagation

Payment risk metadata feeds `30-security.md` fraud engine:
- `method_country` vs `shipping_country` mismatch
- `method_fingerprint` velocity (same card across many customers)
- BIN range vs known risky issuers
- Failure code patterns (`do_not_honor` repeated = higher risk)

### RULE-PAY-026: Payment method tokenization across providers

Different providers can issue different tokens for same physical card. We don't dedupe across providers (security boundary). Customer who saves card on Stripe AND PayPal sees two saved methods.

### RULE-PAY-027: Customer's "wallet" view

`GET /customers/{id}/payment-methods` returns active saved methods. Customer can:
- View list (display_name, brand, last4)
- Set default
- Delete (calls provider detach + soft-delete row)
- (No ability to view CVV, full PAN — never stored)

### RULE-PAY-028: Provider sandbox vs production

`payment_provider_configs.is_test_mode=true` uses provider sandbox endpoints. Test payments isolated from production ledger (denormalized `is_test` flag on payments — Fáze 2 if needed).

MVP: test mode for tenant onboarding, production mode for live merchants. No mixed mode in single tenant.

### RULE-PAY-029: Webhook endpoint URL per tenant

Each tenant gets unique webhook URL: `/api/{date}/webhooks/{provider}/{tenant_pub_id}`. Allows provider to send tenant-scoped events even on shared provider account (multi-tenant aware).

Stripe Connect for marketplace (Fáze 4): platform account, connected accounts per tenant.

### RULE-PAY-030: Currency conversion display

When provider charges in different currency:
- Customer sees order total in cart currency
- Receipt shows both: charged amount + converted equivalent
- Exchange rate source noted (provider's or our table)

### RULE-PAY-031: Authorization expiry alert

Authorizations typically valid 7 days. Job alerts merchant 24h before expiry; merchant decides:
- Capture remaining
- Cancel auth (release hold)
- Re-authorize new attempt

After auto-expiry: payment.status='expired'; order remains; merchant must reach out to customer.

### RULE-PAY-032: Refund identifier traceability

Every refund has `provider_refund_id` (Stripe `re_...`). Tracked in our DB and in customer receipt. Bank statement shows: original charge + refund line (negative).

### RULE-PAY-033: Audit logging

100% audit log entries for:
- Refund issuance (actor, amount, reason)
- Provider config change (API key rotation, enable/disable)
- Manual payment status override (admin force-marks captured)
- Saved method delete (customer or admin)
- Dispute evidence submission

---

## 7. REST API endpoints

### 7.1 Provider configuration (admin)

```
GET    /api/{date}/payments/providers                                 # available + configured list
GET    /api/{date}/payments/providers/{code}/config
PATCH  /api/{date}/payments/providers/{code}/config                   # enable, currencies, capture_strategy
POST   /api/{date}/payments/providers/{code}/config:test-connection   # ping provider with current credentials
POST   /api/{date}/payments/providers/{code}/config:rotate-secret     # initiate API key rotation flow
```

### 7.2 Payments

```
GET    /api/{date}/payments                                            # list, filterable by status, provider, customer, order
GET    /api/{date}/payments/{id}
POST   /api/{date}/payments/{id}:capture                                # body: { amount? } — partial or full
POST   /api/{date}/payments/{id}:cancel                                 # void
POST   /api/{date}/payments/{id}:resync                                 # query provider for latest state (admin action)
```

Note: `POST /payments` (create) is **internal** — driven by checkout. No direct public create endpoint.

### 7.3 Refunds

```
GET    /api/{date}/refunds                                              # list
POST   /api/{date}/refunds                                              # create (links to payment_id)
GET    /api/{date}/refunds/{id}
POST   /api/{date}/refunds/{id}:cancel                                  # before processing
```

### 7.4 Saved payment methods

```
GET    /api/{date}/customers/{customer_id}/payment-methods              # customer's wallet
GET    /api/{date}/payment-methods/{id}
PATCH  /api/{date}/payment-methods/{id}                                  # set default
DELETE /api/{date}/payment-methods/{id}                                  # detach + soft delete
POST   /api/{date}/payment-methods:setup-intent                           # create SetupIntent for saving without charge (Fáze 2+)
```

### 7.5 Disputes

```
GET    /api/{date}/payment-disputes                                       # filterable
GET    /api/{date}/payment-disputes/{id}
PATCH  /api/{date}/payment-disputes/{id}/evidence                          # update evidence
POST   /api/{date}/payment-disputes/{id}:submit-evidence
POST   /api/{date}/payment-disputes/{id}:accept                            # accept dispute (no contest)
```

### 7.6 Settlements

```
GET    /api/{date}/payment-settlements                                     # list
GET    /api/{date}/payment-settlements/{id}
POST   /api/{date}/payment-settlements/{id}:reconcile                       # manual trigger
GET    /api/{date}/payment-settlements/{id}/report-download                  # signed URL to provider report
```

### 7.7 Webhook endpoints (incoming)

```
POST   /api/{date}/webhooks/stripe/{tenant_pub_id}
POST   /api/{date}/webhooks/gopay/{tenant_pub_id}
POST   /api/{date}/webhooks/comgate/{tenant_pub_id}
POST   /api/{date}/webhooks/thepay/{tenant_pub_id}
POST   /api/{date}/webhooks/paypal/{tenant_pub_id}
```

### 7.8 Example: Capture authorized payment

```http
POST /api/2026-05-19/payments/pay_aB3cD:capture HTTP/1.1
Authorization: Bearer ...
Idempotency-Key: 9c9f5e2a-...

{
  "amount": 100000,
  "notes": "Capturing for shipped portion"
}
```

```jsonc
HTTP/1.1 200 OK

{
  "data": {
    "id": "01927bea-...",
    "pub_id": "pay_aB3cD",
    "type": "payment",
    "attributes": {
      "order_id": "ord_xY",
      "provider_code": "stripe",
      "status": "partially_captured",
      "amount": 124281,
      "amount_authorized": 124281,
      "amount_captured": 100000,
      "amount_refunded": 0,
      "currency": "CZK",
      "method_kind": "card",
      "method_brand": "visa",
      "method_last4": "4242",
      "captured_at": "2026-05-19T14:50:00Z"
    }
  }
}
```

### 7.9 Example: Issue refund

```http
POST /api/2026-05-19/refunds HTTP/1.1
Authorization: Bearer ...
Idempotency-Key: rfd-9c9f5e2a-...

{
  "payment_id": "pay_aB3cD",
  "amount": 25000,
  "currency": "CZK",
  "reason": "customer_request",
  "reason_notes": "Item arrived damaged",
  "refund_method": "original_payment",
  "return_id": "ret_xy"
}
```

```jsonc
HTTP/1.1 202 Accepted
Location: /api/2026-05-19/refunds/rfd_aB

{
  "data": {
    "id": "01927beb-...",
    "pub_id": "rfd_aB",
    "type": "refund",
    "attributes": {
      "payment_id": "pay_aB3cD",
      "amount": 25000,
      "currency": "CZK",
      "reason": "customer_request",
      "status": "processing",
      "refund_method": "original_payment",
      "initiated_at": "2026-05-19T15:00:00Z",
      "provider_refund_id": "re_3OabXY..."
    }
  },
  "meta": {
    "expected_completion_days": "3-10 business days",
    "next_action": "Poll for status updates or subscribe to refund.succeeded webhook"
  }
}
```

### 7.10 Example: List saved payment methods

```http
GET /api/2026-05-19/customers/cus_aB/payment-methods HTTP/1.1
```

```jsonc
HTTP/1.1 200 OK

{
  "data": [
    {
      "id": "...",
      "pub_id": "pm_aB",
      "type": "saved_payment_method",
      "attributes": {
        "provider_code": "stripe",
        "method_kind": "card",
        "display_name": "Visa •••• 4242",
        "brand": "visa",
        "last4": "4242",
        "expires_month": 12,
        "expires_year": 2028,
        "method_country": "CZ",
        "method_funding": "credit",
        "is_default": true,
        "is_active": true,
        "last_used_at": "2026-05-15T10:30:00Z",
        "created_at": "2026-01-10T12:00:00Z"
      }
    },
    {
      "id": "...",
      "pub_id": "pm_xY",
      "attributes": {
        "provider_code": "stripe",
        "method_kind": "sepa_debit",
        "display_name": "SEPA •••• 1234",
        "is_default": false
      }
    }
  ]
}
```

---

## 8. GraphQL schema

```graphql
type Payment implements Node {
  id: ID!
  pubId: String!
  order: Order!
  customer: Customer
  providerCode: String!
  status: PaymentStatus!
  kind: PaymentKind!
  amount: Money!
  amountAuthorized: Money
  amountCaptured: Money
  amountRefunded: Money
  amountVoided: Money
  methodKind: PaymentMethodKind
  methodBrand: String
  methodLast4: String
  methodExpiresMonth: Int
  methodExpiresYear: Int
  methodCountry: String
  methodFunding: PaymentMethodFunding
  threeDSecureRequired: Boolean!
  threeDSecureCompleted: Boolean
  threeDSecureResult: ThreeDSecureResult
  authenticationUrl: String
  failureCode: String
  failureMessage: String
  initiatedAt: DateTime!
  authorizedAt: DateTime
  capturedAt: DateTime
  refundedAt: DateTime
  voidedAt: DateTime
  failedAt: DateTime
  expiresAt: DateTime
  disputedAt: DateTime
  refunds: [Refund!]!
  disputes: [PaymentDispute!]!
  riskScore: Int
  metadata: JSON
}

enum PaymentStatus {
  PENDING
  REQUIRES_PAYMENT_METHOD
  REQUIRES_ACTION
  PROCESSING
  AUTHORIZED
  CAPTURED
  PARTIALLY_CAPTURED
  PARTIALLY_REFUNDED
  REFUNDED
  FAILED
  CANCELLED
  EXPIRED
  DISPUTED
}

enum PaymentKind { CHARGE AUTHORIZATION CAPTURE VOID REFUND ADJUSTMENT }

enum PaymentMethodKind {
  CARD BANK_TRANSFER APPLE_PAY GOOGLE_PAY PAYPAL
  SEPA_DEBIT SOFORT GIROPAY IDEAL BLIK BANCONTACT
  KLARNA AFTERPAY COD GIFT_CARD CUSTOMER_BALANCE
}

enum PaymentMethodFunding { CREDIT DEBIT PREPAID UNKNOWN }
enum ThreeDSecureResult { AUTHENTICATED ATTEMPTED NOT_REQUIRED FAILED }

type Refund implements Node {
  id: ID!
  pubId: String!
  payment: Payment!
  order: Order!
  customer: Customer
  amount: Money!
  reason: RefundReason!
  reasonNotes: String
  refundMethod: RefundMethod!
  status: RefundStatus!
  initiatedAt: DateTime!
  processedAt: DateTime
  failureCode: String
  failureMessage: String
  destinationGiftCard: GiftCard
  initiatedBy: Actor
  return: Return
}

enum RefundReason {
  CUSTOMER_REQUEST DUPLICATE FRAUDULENT ORDER_CANCELLED
  PRODUCT_UNAVAILABLE PRICE_ADJUSTMENT GOODWILL CHARGEBACK OTHER
}
enum RefundStatus { PENDING PROCESSING SUCCEEDED FAILED CANCELLED }
enum RefundMethod { ORIGINAL_PAYMENT STORE_CREDIT BANK_TRANSFER GIFT_CARD MANUAL }

type SavedPaymentMethod implements Node {
  id: ID!
  pubId: String!
  customer: Customer!
  providerCode: String!
  methodKind: PaymentMethodKind!
  displayName: String!
  brand: String
  last4: String
  expiresMonth: Int
  expiresYear: Int
  methodFunding: PaymentMethodFunding
  methodCountry: String
  isDefault: Boolean!
  isActive: Boolean!
  lastUsedAt: DateTime
  createdAt: DateTime!
}

type PaymentDispute implements Node {
  id: ID!
  pubId: String!
  payment: Payment!
  order: Order!
  reason: String!
  amount: Money!
  status: DisputeStatus!
  evidenceDueBy: DateTime
  evidenceSubmittedAt: DateTime
  outcome: String
  outcomeAt: DateTime
  createdAt: DateTime!
}
enum DisputeStatus { NEEDS_RESPONSE UNDER_REVIEW WON LOST WARNING ACCEPTED }

extend type Query {
  payments(first: Int, after: String, filter: PaymentFilter): PaymentConnection! @auth(requires: PERM_PAYMENT_VIEW)
  payment(id: ID, pubId: String): Payment @auth(requires: PERM_PAYMENT_VIEW)
  refunds(first: Int, after: String, filter: RefundFilter): RefundConnection! @auth(requires: PERM_PAYMENT_VIEW)
  refund(id: ID): Refund @auth(requires: PERM_PAYMENT_VIEW)
  myPaymentMethods: [SavedPaymentMethod!]!
  paymentDisputes(first: Int, after: String, filter: DisputeFilter): PaymentDisputeConnection! @auth(requires: PERM_PAYMENT_VIEW)
  paymentProviders: [PaymentProviderConfig!]! @auth(requires: PERM_PAYMENT_VIEW)
}

extend type Mutation {
  capturePayment(id: ID!, amount: MoneyInput, idempotencyKey: String!): Payment! @auth(requires: PERM_PAYMENT_CAPTURE)
  cancelPayment(id: ID!): Payment! @auth(requires: PERM_PAYMENT_CANCEL)
  resyncPayment(id: ID!): Payment! @auth(requires: PERM_PAYMENT_VIEW)

  createRefund(input: CreateRefundInput!, idempotencyKey: String!): Refund! @auth(requires: PERM_PAYMENT_REFUND)
  cancelRefund(id: ID!): Refund! @auth(requires: PERM_PAYMENT_REFUND)

  setDefaultPaymentMethod(id: ID!): SavedPaymentMethod!
  deletePaymentMethod(id: ID!): DeletePayload!

  updateProviderConfig(code: String!, input: ProviderConfigInput!): PaymentProviderConfig! @auth(requires: PERM_PAYMENT_CONFIGURE)

  submitDisputeEvidence(id: ID!, input: DisputeEvidenceInput!): PaymentDispute! @auth(requires: PERM_PAYMENT_DISPUTE_MANAGE)
  acceptDispute(id: ID!): PaymentDispute! @auth(requires: PERM_PAYMENT_DISPUTE_MANAGE)
}
```

---

## 9. Events

| Build-spec ID | Wire | Payload |
|---|---|---|
| `EVENT-PAYMENT-INITIATED` | `payment.initiated` | `{ payment }` |
| `EVENT-PAYMENT-AUTHENTICATION-REQUIRED` | `payment.authentication_required` | `{ payment, authentication_url }` |
| `EVENT-PAYMENT-AUTHORIZED` | `payment.authorized` | `{ payment }` |
| `EVENT-PAYMENT-CAPTURED` | `payment.captured` | `{ payment, amount_captured }` |
| `EVENT-PAYMENT-PARTIALLY-CAPTURED` | `payment.partially_captured` | `{ payment, amount_captured, remaining }` |
| `EVENT-PAYMENT-FAILED` | `payment.failed` | `{ payment, failure_code, failure_message }` |
| `EVENT-PAYMENT-CANCELLED` | `payment.cancelled` | `{ payment }` |
| `EVENT-PAYMENT-EXPIRED` | `payment.expired` | `{ payment, was_authorized_amount }` |
| `EVENT-REFUND-INITIATED` | `refund.initiated` | `{ refund }` |
| `EVENT-REFUND-SUCCEEDED` | `refund.succeeded` | `{ refund }` |
| `EVENT-REFUND-FAILED` | `refund.failed` | `{ refund, failure_code }` |
| `EVENT-DISPUTE-OPENED` | `dispute.opened` | `{ dispute }` |
| `EVENT-DISPUTE-EVIDENCE-SUBMITTED` | `dispute.evidence_submitted` | `{ dispute }` |
| `EVENT-DISPUTE-WON` | `dispute.won` | `{ dispute }` |
| `EVENT-DISPUTE-LOST` | `dispute.lost` | `{ dispute }` |
| `EVENT-SAVED-METHOD-ADDED` | `payment_method.added` | `{ saved_method }` |
| `EVENT-SAVED-METHOD-DELETED` | `payment_method.deleted` | `{ saved_method_id }` |
| `EVENT-SAVED-METHOD-EXPIRED-SOON` | `payment_method.expired_soon` | `{ saved_method, days_until_expiry }` |
| `EVENT-SETTLEMENT-RECEIVED` | `settlement.received` | `{ settlement }` |
| `EVENT-RECONCILIATION-DRIFT-DETECTED` | `reconciliation.drift_detected` | `{ settlement_id, drift_amount }` |
| `EVENT-PROVIDER-CONFIG-CHANGED` | `provider.config_changed` | `{ provider_code, changed_fields }` |

**Konzumenti:**
- Order management — payment_status sync (`16-order-management.md`)
- Email — receipts, refund confirmations
- Fraud engine — feedback on declines, disputes
- Accounting integrations — ERP sync (Pohoda, ...)
- Webhook delivery — per merchant subscription

---

## 10. Background jobs

| Job | Trigger | Queue | Frequency |
|---|---|---|---|
| `JOB-PROCESS-WEBHOOK-EVENT` | webhook received | `payment-webhooks` | On-demand |
| `JOB-RECONCILE-SETTLEMENT` | scheduled | `payment-reconcile` | Daily 06:00 |
| `JOB-FETCH-PROVIDER-SETTLEMENTS` | scheduled | `payment-reconcile` | Daily 04:00 (after providers post EOD) |
| `JOB-EXPIRE-AUTHORIZATIONS` | scheduled | `payment-sweeper` | Hourly |
| `JOB-WARN-AUTHORIZATIONS-EXPIRING-SOON` | scheduled | `notifications` | Daily |
| `JOB-DETECT-EXPIRING-CARDS` | scheduled | `payment-maintenance` | Daily |
| `JOB-NOTIFY-CUSTOMER-EXPIRING-CARD` | EVENT-SAVED-METHOD-EXPIRED-SOON | `notifications` | On-demand |
| `JOB-RECONCILE-PROVIDER-STATE-INCOMPLETE` | scheduled | `payment-reconcile` | Every 5 min (for payments stuck in 'processing' > 10 min) |
| `JOB-RETRY-FAILED-WEBHOOK` | webhook processing failed | `payment-webhooks` | Exponential backoff |
| `JOB-SYNC-CARD-UPDATES` | provider notification | `payment-maintenance` | On-demand |
| `JOB-CLEANUP-OLD-WEBHOOK-EVENTS` | scheduled | `maintenance` | Daily |
| `JOB-DETECT-FRAUDULENT-VELOCITY` | scheduled | `fraud` | Every 5 min |
| `JOB-AUTO-FILE-DISPUTE-EVIDENCE` | EVENT-DISPUTE-OPENED | `disputes` | On-demand (auto-files default evidence pack) |
| `JOB-PAYMENT-ANALYTICS-DAILY` | scheduled | `analytics` | Daily |
| `JOB-COD-CAPTURE-FROM-CARRIER` | carrier delivery webhook | `payments` | On-demand |
| `JOB-BANK-TRANSFER-MATCH` (v1.0+) | bank statement import | `payments` | On-demand |

---

## 11. Webhooks (incoming from providers)

Each provider sends events. Our endpoint pattern: `POST /api/{date}/webhooks/{provider}/{tenant_pub_id}`.

### 11.1 Stripe events handled

| Stripe event | Action |
|---|---|
| `payment_intent.created` | Sync (usually we initiated; verify state) |
| `payment_intent.requires_action` | Update status, set authentication_url |
| `payment_intent.processing` | Update status |
| `payment_intent.succeeded` | Mark `authorized` or `captured` based on capture_method |
| `payment_intent.payment_failed` | Mark `failed`, set failure_code |
| `payment_intent.canceled` | Mark `cancelled` |
| `charge.succeeded` | Mark `captured` (if auto-capture) |
| `charge.refunded` | Update refund row, mark `succeeded` |
| `charge.dispute.created` | Insert `payment_disputes` row, notify merchant |
| `charge.dispute.closed` | Update dispute status (won/lost) |
| `payment_method.attached` | Sync saved_payment_methods (if customer triggered) |
| `payment_method.detached` | Mark saved method inactive |
| `payment_method.updated` | Sync expiry / details |
| `customer.created` | Sync `provider_customer_id` |

### 11.2 GoPay events handled

| GoPay event | Action |
|---|---|
| `CREATED` (status) | Note creation |
| `AUTHORIZED` | Mark `authorized` |
| `PAID` | Mark `captured` |
| `CANCELED` | Mark `cancelled` |
| `REFUNDED` | Update refund |
| `TIMEOUTED` | Mark `expired` |

### 11.3 Webhook handler skeleton

```typescript
async function handleProviderWebhook(req: Request) {
  const tenantPubId = req.params.tenant_pub_id;
  const providerCode = req.params.provider;
  const rawPayload = await req.text();
  const signature = req.headers.get(provider.signatureHeader);
  
  // 1. Verify signature
  const provider = providers[providerCode];
  if (!provider.verifyWebhookSignature(rawPayload, signature, await resolveSecret(tenantPubId, providerCode))) {
    return new Response('Invalid signature', { status: 401 });
  }
  
  const payload = JSON.parse(rawPayload);
  const providerEventId = provider.extractEventId(payload);
  
  // 2. Idempotency: check if already processed
  const existing = await db.query(sql`SELECT id FROM payment_webhook_events WHERE provider_code=${providerCode} AND provider_event_id=${providerEventId}`);
  if (existing?.processed_at) {
    return new Response('Already processed', { status: 200 });
  }
  
  // 3. Insert webhook event row (advisory lock prevents race on duplicate)
  await db.execute(sql`INSERT INTO payment_webhook_events (...) VALUES (...) ON CONFLICT DO NOTHING`);
  
  // 4. Enqueue processing job
  await enqueueJob('JOB-PROCESS-WEBHOOK-EVENT', { webhook_event_id, provider_code, payload });
  
  // 5. Return 200 immediately (don't block provider on processing)
  return new Response('OK', { status: 200 });
}
```

### 11.4 Webhook processing

```typescript
async function processWebhookEvent(webhookEventId: string) {
  const event = await db.queryOne(sql`SELECT * FROM payment_webhook_events WHERE id=${webhookEventId}`);
  const provider = providers[event.provider_code];
  const normalized = provider.parseWebhookEvent(event.payload);
  
  await pg.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('payment:' + ${normalized.payment_id})::bigint)`);
    
    const payment = await tx.queryOne(sql`SELECT * FROM payments WHERE provider_payment_id=${normalized.provider_payment_id}`);
    if (!payment) {
      // Orphan event — possibly arrived before our intent record committed; defer with backoff
      await tx.execute(sql`UPDATE payment_webhook_events SET retry_count = retry_count + 1 WHERE id = ${webhookEventId}`);
      throw new RetryLater(60); // seconds
    }
    
    // Apply state transition based on normalized event
    await applyPaymentTransition(tx, payment, normalized);
    
    // Mark processed
    await tx.execute(sql`UPDATE payment_webhook_events SET processed_at = now() WHERE id = ${webhookEventId}`);
    
    // Emit our outbox events
    await emitOutbox(tx, mapToOurEvent(normalized));
  });
}
```

---

## 12. UI/UX flows

### FLOW-PAY-001: Configure provider (admin)

```
[Admin → Settings → Payments]
   - List of available providers, configured ones marked
        │
   click "Configure Stripe"
        │
        ▼
[Stripe config form]
   - "Connect with Stripe" OAuth flow → fetches API keys → stored in Vault
   - Or manual: paste publishable + secret key
   - Webhook endpoint URL displayed (to copy into Stripe dashboard)
   - Currencies, countries, capture_strategy toggles
   - "Test connection" button
        │
        ▼
[Save → status='configured', is_enabled=false until merchant explicitly enables]
[Enable toggle]
   - Goes live for checkout offering
```

### FLOW-PAY-002: View payment detail (admin)

```
[Order detail → Payments tab]
   - List of payment attempts
        │
   click a payment
        │
        ▼
[Payment detail panel]
   - Status, amounts (auth/captured/refunded)
   - Method info (Visa •••• 4242, country)
   - Timeline (initiated, authorized, captured, refunded)
   - 3DS info
   - Provider raw payload (collapsed)
   - Actions:
     [Capture] (if authorized + partial possible)
     [Refund]  (if captured)
     [Cancel]  (if authorized, not yet captured)
     [Resync from provider] (admin force-refresh)
```

### FLOW-PAY-003: Issue refund (customer service)

```
[Order detail → "Issue refund"]
        │
        ▼
[Refund modal]
   - Select item(s) to refund (or "full order")
   - Amount auto-computed; can be overridden (within capped limit)
   - Reason dropdown (customer_request, duplicate, ...)
   - Notes textarea
   - Refund method:
     • Original payment method (default)
     • Store credit
     • Bank transfer (admin enters IBAN)
     • Gift card (creates gift card for amount)
        │
   click "Issue Refund"
        │
        ▼
[POST /refunds → 202 + status='processing']
   - Toast: "Refund initiated, customer will see funds within 3-10 business days"
   - Refund appears in payment timeline
   - Customer receives email confirmation
        │
        ▼
[Webhook from provider arrives later]
   - status → 'succeeded' or 'failed'
   - Customer notified again
   - Order.refunded_amount updated
```

### FLOW-PAY-004: 3DS challenge (customer)

```
[Checkout review → click "Place order"]
        │
        ▼
[Backend: provider returns requires_action with authentication_url]
        │
        ▼
[Frontend handles authentication]
   Option A: redirect to URL (full-page)
   Option B: modal iframe (Stripe Elements 3DS handler)
        │
        ▼
[Customer's bank app / SMS code / push notification]
   - Customer approves
        │
        ▼
[Bank → provider → our webhook]
        │
        ▼
[Frontend polls or SSE-receives status update]
        │
        ▼
[Success: redirect to /order/{number}/thank-you]
[Fail: stay on checkout with retry option]
```

### FLOW-PAY-005: Customer manages saved methods

```
[Customer account → Payment methods]
   - List of saved methods
        │
   click "Add new"
        │
        ▼
[Setup intent flow]
   - Provider widget (Stripe Element) collects card
   - SCA challenge if required by issuer
   - On success: card saved as token, appears in list
        │
   user clicks "Make default" on a card
   - PATCH /payment-methods/{id} body: { is_default: true }
   
   user clicks "Delete"
   - DELETE /payment-methods/{id}
   - Provider detach + soft delete local
```

### FLOW-PAY-006: Dispute response (admin)

```
[Dashboard alert: "1 new dispute — respond by 2026-05-25"]
        │
        ▼
[Dispute detail]
   - Reason: "Product not received"
   - Amount: 124281 CZK
   - Evidence due by: 2026-05-25
   - Auto-collected evidence:
     • Receipt (from order)
     • Shipping tracking (from shipment)
     • ToS acceptance (from checkout)
   - Editable: notes, additional evidence (PDF upload)
        │
   click "Submit Evidence"
        │
        ▼
[POST /payment-disputes/{id}:submit-evidence]
   - Provider notified
   - Wait for outcome (provider-dependent, days to weeks)
        │
        ▼
[Outcome webhook]
   - WON: notify merchant + customer; restore funds
   - LOST: notify merchant; payment marked refunded
```

### FLOW-PAY-007: Provider reconciliation (admin)

```
[Admin → Payments → Settlements]
   - Daily settlement reports per provider, sortable
        │
   click latest "Stripe — 2026-05-18"
        │
        ▼
[Settlement detail]
   - Gross: 487,231 CZK
   - Fees: 11,234 CZK
   - Refunds: 12,500 CZK
   - Net: 463,497 CZK
   - Reconciliation: drift 0 ✅ (auto-matched)
   - Or drift detected → list of unmatched payments/refunds
   - "Download report" → signed URL to CSV
   - "Reconcile manually" → admin marks line as resolved
```

---

## 13. Edge cases & error handling

| Scenario | Behavior | Code |
|---|---|---|
| Provider config not enabled at checkout | Filter from available methods | (handled by 12) |
| Provider returns generic error | Map to `PAYMENT_FAILED` with provider's code/message | `PAYMENT_FAILED`, 422 |
| 3DS challenge timeout | Mark intent cancelled, customer retries | `AUTH_TIMEOUT` |
| 3DS challenge cancelled by customer | Mark intent cancelled | `AUTH_CANCELLED` |
| Capture more than authorized | Reject pre-call | `CAPTURE_EXCEEDS_AUTH`, 422 |
| Refund more than captured | Reject pre-call | `REFUND_EXCEEDS_CAPTURED`, 422 |
| Refund on uncaptured payment | Use `cancel` instead | (UI guides admin) |
| Webhook signature invalid | Reject 401 | (provider side) |
| Webhook duplicate | Acknowledge 200, skip | (idempotent) |
| Webhook for unknown payment (orphan) | Retry with backoff (5 min, 1h, 6h, 24h); drop after | (handled) |
| Webhook out of order | State machine guards; ignore invalid transitions | (handled) |
| Provider down (timeout, 5xx) | Circuit breaker opens; checkout offers alternative providers | (handled) |
| Provider returns currency unsupported | Filter pre-checkout; failsafe 422 if leaked | `CURRENCY_NOT_SUPPORTED`, 422 |
| Card declined: insufficient_funds | Allow retry with different method | `CARD_DECLINED`, 422 |
| Card declined: do_not_honor | Allow retry, but log fraud signal | `CARD_DECLINED`, 422 |
| Card stolen / lost (provider flag) | Block this method for customer; admin alert | `CARD_BLOCKED`, 422 |
| Saved method expired | Filter from list; prompt customer update | (UI hint) |
| Saved method deletion fails at provider | Soft-delete locally anyway; mark for retry | (handled) |
| Customer tries to refund COD payment as `original_payment` | Reject; suggest bank transfer or store credit | `INVALID_REFUND_METHOD`, 422 |
| Refund partial, then partial again, totals exceed cap | Reject second | `REFUND_EXCEEDS_CAPTURED`, 422 |
| Dispute opened on already-refunded payment | Track separately; usually informational | (handled) |
| Settlement drift detected | Admin alert + manual reconciliation UI | (handled per FLOW-PAY-007) |
| Bank transfer expired (7 days) | Auto-cancel order; admin can override | (handled) |
| COD package returned without collection | Carrier webhook → payment.failed, order auto-cancel | (handled) |
| Concurrent refund attempts on same payment | Advisory lock per payment_id; second waits | (handled) |
| Provider API key rotated mid-charge | Use new key for new intents; old key still valid for completing existing | (managed by Vault rotation policy) |
| Customer disputes via provider AND opens RMA simultaneously | Combine; communicate via single customer thread | (handled by 17) |
| Webhook arrives before our intent insert | Defer processing 60s; if still no record after 5 min: mark orphan | (handled) |
| Refund to deleted gift card | Reject; require different destination | `GIFT_CARD_DELETED`, 422 |
| Tenant's webhook URL changes | Update provider config (manual or automated); old URL deprecated | (handled, with grace period) |

---

## 14. Performance

### 14.1 Targets

| Operation | p50 | p95 | p99 |
|---|---|---|---|
| `POST /payments/{id}:capture` | 200 ms | 600 ms | 1500 ms (provider call dominant) |
| `POST /refunds` | 200 ms | 600 ms | 1500 ms |
| `GET /payments` (paginated list) | 30 ms | 100 ms | 200 ms |
| Webhook ingestion (signature verify + insert) | 20 ms | 60 ms | 150 ms |
| `JOB-PROCESS-WEBHOOK-EVENT` (per event) | 50 ms | 200 ms | 500 ms |
| `JOB-RECONCILE-SETTLEMENT` (1000-line report) | 5 s | 15 s | 30 s |
| `JOB-EXPIRE-AUTHORIZATIONS` (sweep 10k authorizations) | 2 s | 5 s | 10 s |

### 14.2 Optimization

- **Provider response caching:** for `retrievePaymentMethod` / `getCustomer` reads, cache 5 min
- **Connection pooling:** keep HTTP connections warm to Stripe, GoPay, ComGate
- **Webhook acknowledge fast:** 200 OK immediately after signature verify + insert; process async
- **Batch settlement reconcile:** stream CSV, match in bulk SQL queries
- **Idempotency-Key Redis cache:** 24h for replay protection
- **Read replicas:** payment list/search queries can hit replicas; mutations always primary

### 14.3 Hot path queries

```sql
-- Find payment by provider intent (webhook lookup)
SELECT * FROM payments
WHERE tenant_id = $1 AND provider_code = $2 AND provider_payment_id = $3
LIMIT 1;
-- Uses uq_payments_provider_payment_id
```

```sql
-- List recent payments for order
SELECT * FROM payments
WHERE order_id = $1
ORDER BY initiated_at DESC;
-- Uses idx_payments_order
```

### 14.4 Scaling

- Webhook ingestion throughput: 100/sec per tenant easily; bottleneck is provider's own rate limits
- Reconciliation: per-tenant per-day, parallelizable
- Storage: payment_webhook_events partitioned monthly, BRIN-indexed; retention 90 days

---

## 15. Security & PCI

### 15.1 Permissions

```
PERM-PAYMENT-VIEW
PERM-PAYMENT-CAPTURE          # initiate captures
PERM-PAYMENT-CANCEL           # void authorization
PERM-PAYMENT-REFUND           # may have amount cap per role
PERM-PAYMENT-REFUND-UNLIMITED # no amount cap
PERM-PAYMENT-CONFIGURE        # add/edit providers
PERM-PAYMENT-DISPUTE-MANAGE
PERM-PAYMENT-RECONCILE
PERM-PAYMENT-MANUAL-OVERRIDE  # force-mark payment status (rare admin escape hatch)
```

### 15.2 PCI DSS (DEC-PAY-002)

- **SAQ A scope** — lowest tier; we never touch PAN, CVV, magnetic stripe
- Stripe Elements / GoPay iframe / ComGate hosted page collect card data directly to provider
- Our tokens are provider tokens (`pm_...`, `gp_...`), not PAN
- TLS 1.3 enforced for all provider communication
- API keys in HashiCorp Vault (DEC-SEC-002); never in Postgres or code
- Logs PII-scrubbed (regex filter strips card-like sequences)
- PCI annual self-assessment SAQ A
- Vendor security review per provider (annual)

### 15.3 Encryption

- API keys: Vault transit (AES-256-GCM)
- `destination_bank_account_iban` (in refunds): encrypted with Vault transit at column level
- Raw payloads: stored but PII-scrubbed before persist; original signature retained for re-verification

### 15.4 Webhook security

- Per-tenant webhook URL with `tenant_pub_id` segment
- HMAC signature verification mandatory (RULE-PAY-004)
- IP whitelisting where provider supports (e.g., ComGate)
- Rate limit per tenant per provider: 600/min (provider-side limit higher; we throttle to protect downstream)
- Anti-replay: 5-minute timestamp window

### 15.5 Audit

- 100% audit log on: refunds, manual overrides, provider config changes, dispute evidence, saved method deletes
- Sample 1% on reads (high volume)

### 15.6 Rate limits

| Endpoint | Free | Pro |
|---|---|---|
| `POST /payments/{id}:capture` | 60/min | 600/min |
| `POST /refunds` | 30/min | 300/min |
| `GET /payments` list | 300/min | 6000/min |
| Webhook ingestion | 600/min per tenant | 6000/min |
| `POST /payment-methods` setup | 10/min per customer | 30/min |

### 15.7 GDPR

- Saved payment methods linked to customer — deleted on right-to-erasure (`payment_method.deleted` propagated to provider)
- `payments.raw_payload` PII-scrubbed; customer email/name in payload OK (legitimate interest)
- Retention: payments retained 7 years (tax compliance, EU rules); refunds 7 years; webhook events 90 days

---

## 16. Testing

### 16.1 Unit

```
TEST-UNIT-PAY-001  PaymentStateMachine — valid transitions
TEST-UNIT-PAY-002  PaymentStateMachine — invalid transitions rejected
TEST-UNIT-PAY-003  AmountValidator — capture ≤ authorized; refund ≤ captured
TEST-UNIT-PAY-004  ProviderRouter — picks correct provider for currency/method
TEST-UNIT-PAY-005  WebhookSignatureVerifier per provider
TEST-UNIT-PAY-006  WebhookPayloadNormalizer — Stripe → normalized event
TEST-UNIT-PAY-007  RefundCalculator — partial refund running total
TEST-UNIT-PAY-008  IdempotencyKeyChecker — replay returns cached
TEST-UNIT-PAY-009  CardExpiryDetector — finds methods expiring soon
TEST-UNIT-PAY-010  SettlementMatcher — match provider line to our payment
```

### 16.2 Integration (mocked providers)

```
TEST-INT-PAY-001  Create intent via Stripe mock → status flows
TEST-INT-PAY-002  3DS requires_action flow
TEST-INT-PAY-003  Capture authorized payment
TEST-INT-PAY-004  Partial capture, then capture remaining
TEST-INT-PAY-005  Cancel authorized payment (void)
TEST-INT-PAY-006  Refund full amount
TEST-INT-PAY-007  Refund partial, then partial again
TEST-INT-PAY-008  Refund exceeding cap rejected
TEST-INT-PAY-009  Webhook idempotent (same event twice → processed once)
TEST-INT-PAY-010  Webhook out of order — state guards
TEST-INT-PAY-011  Save card via SetupIntent
TEST-INT-PAY-012  Delete saved card → provider detach + soft delete
TEST-INT-PAY-013  Card expiry → notification
TEST-INT-PAY-014  Dispute opened → row inserted, evidence collected
TEST-INT-PAY-015  Settlement matched (all lines) → reconciled
TEST-INT-PAY-016  Settlement drift → admin alert
TEST-INT-PAY-017  Authorization expired → status='expired'
TEST-INT-PAY-018  Concurrent capture attempts (advisory lock serializes)
TEST-INT-PAY-019  COD captured via carrier webhook
TEST-INT-PAY-020  Bank transfer expired (7d) → order cancelled
TEST-INT-PAY-021  Gift card payment atomic with order placement
TEST-INT-PAY-022  Provider API down → circuit breaker, fallback offered (in checkout)
TEST-INT-PAY-023  Multi-currency: charge in EUR with cart CZK
TEST-INT-PAY-024  Multi-provider failover (Stripe down → GoPay)
TEST-INT-PAY-025  Stripe Connect (Fáze 4 marketplace) — multi-account routing
```

### 16.3 E2E (Playwright)

```
TEST-E2E-PAY-001  Customer pays with Stripe card (no 3DS)
TEST-E2E-PAY-002  Customer pays with 3DS challenge (mocked)
TEST-E2E-PAY-003  Customer pays with GoPay (CZ method)
TEST-E2E-PAY-004  Customer pays with bank transfer; admin manually marks captured
TEST-E2E-PAY-005  Customer pays with COD; carrier webhook captures later
TEST-E2E-PAY-006  Customer adds + uses saved card 1-click checkout (logged-in)
TEST-E2E-PAY-007  Admin issues full refund → customer email received
TEST-E2E-PAY-008  Admin issues partial refund + store credit
TEST-E2E-PAY-009  Customer disputes via bank → admin submits evidence
```

### 16.4 Load (k6)

```
TEST-LOAD-PAY-001  500 concurrent checkout completions → no double-charge
TEST-LOAD-PAY-002  Webhook ingestion 1000/sec → process within 5s p95
TEST-LOAD-PAY-003  Settlement reconcile 100k payments per provider in < 5 min
TEST-LOAD-PAY-004  Refund 1000 orders concurrent → no deadlocks
```

### 16.5 Chaos

```
TEST-CHAOS-PAY-001  Stripe API timeouts → retries, then circuit breaker opens
TEST-CHAOS-PAY-002  Webhook delivered during DB failover → eventually processed
TEST-CHAOS-PAY-003  Vault unavailable (API key fetch fails) → checkout for that provider disabled, fallback offered
TEST-CHAOS-PAY-004  Backend crash mid-capture call → state reconciled via JOB-RECONCILE-PROVIDER-STATE-INCOMPLETE
```

### 16.6 Provider sandbox testing

- Stripe: test cards (4242, 4000 0027 6000 3184 for 3DS required, etc.)
- GoPay: dedicated sandbox account
- ComGate, ThePay: provided test credentials
- PayPal: sandbox accounts
- Automated suite runs against sandbox in CI nightly

---

## 17. Implementation checklist

### Backend
- [ ] **[S]** Drizzle schema `packages/db/src/schema/payments/*.ts`
- [ ] **[S]** Migrace `20260527_001_create_payments_tables.sql` (partitions for webhook_events)
- [ ] **[XL]** `PaymentService` core — create intent, capture, cancel, refund, status sync
- [ ] **[L]** `PaymentProvider` interface + Stripe implementation
- [ ] **[L]** GoPay provider
- [ ] **[M]** ComGate provider
- [ ] **[M]** ThePay provider
- [ ] **[M]** PayPal provider
- [ ] **[S]** Bank transfer (manual) "provider" — internal state only
- [ ] **[S]** COD "provider" — internal state only, integrate with carrier webhooks (per `14`)
- [ ] **[S]** Gift card "provider" — internal, atomic with order
- [ ] **[M]** `WebhookHandler` — signature verify, deduplicate, enqueue processing
- [ ] **[L]** `WebhookProcessor` — apply state transitions per provider event
- [ ] **[M]** `SavedPaymentMethodService` — attach, list, default, delete
- [ ] **[M]** `RefundService` — atomic ledger update + provider call
- [ ] **[M]** `DisputeService` — track lifecycle, evidence management
- [ ] **[M]** `SettlementReconciler` — fetch report, match, drift detect
- [ ] **[S]** `CircuitBreaker` for provider calls (resilience)
- [ ] **[S]** Provider config + Vault integration
- [ ] **[M]** REST endpoints per §7
- [ ] **[M]** GraphQL types + resolvers
- [ ] **[S]** tRPC router (admin payment management)
- [ ] **[S]** MCP tools (read-only for agents)

### Background jobs
- [ ] **[M]** JOB-PROCESS-WEBHOOK-EVENT
- [ ] **[M]** JOB-RECONCILE-SETTLEMENT
- [ ] **[M]** JOB-FETCH-PROVIDER-SETTLEMENTS (per provider integration)
- [ ] **[S]** JOB-EXPIRE-AUTHORIZATIONS
- [ ] **[S]** JOB-WARN-AUTHORIZATIONS-EXPIRING-SOON
- [ ] **[S]** JOB-DETECT-EXPIRING-CARDS
- [ ] **[S]** JOB-NOTIFY-CUSTOMER-EXPIRING-CARD
- [ ] **[M]** JOB-RECONCILE-PROVIDER-STATE-INCOMPLETE
- [ ] **[S]** JOB-RETRY-FAILED-WEBHOOK
- [ ] **[S]** JOB-SYNC-CARD-UPDATES
- [ ] **[S]** JOB-CLEANUP-OLD-WEBHOOK-EVENTS
- [ ] **[S]** JOB-AUTO-FILE-DISPUTE-EVIDENCE
- [ ] **[S]** JOB-PAYMENT-ANALYTICS-DAILY
- [ ] **[S]** JOB-COD-CAPTURE-FROM-CARRIER
- [ ] **[S]** JOB-BANK-TRANSFER-MATCH (v1.0+)

### Frontend — Admin
- [ ] **[M]** Payments list view (filter: status, provider, customer, value)
- [ ] **[M]** Payment detail view (timeline, raw payload, actions)
- [ ] **[M]** Refund modal (line items, amount, method, reason)
- [ ] **[M]** Provider configuration screens (per provider, OAuth flows where possible)
- [ ] **[M]** Settlements dashboard
- [ ] **[M]** Dispute response screen (auto-evidence, manual additions)
- [ ] **[S]** Analytics: payment success rate, top decline reasons, dispute ratio
- [ ] **[S]** Webhook delivery log (for debugging)

### Frontend — Storefront
- [ ] **[M]** Provider widgets integration (Stripe Elements, GoPay iframe, etc.) — per `12-checkout.md`
- [ ] **[M]** Saved payment methods management (customer account)
- [ ] **[S]** Receipt with payment details
- [ ] **[S]** Refund status page (customer-facing)
- [ ] **[S]** Card expiry warning banner

### Tests
- [ ] **[M]** Per §16
- [ ] **[M]** Provider sandbox CI nightly suite

### Docs
- [ ] **[S]** "Setting up payments" merchant guide
- [ ] **[S]** Per-provider configuration guides
- [ ] **[S]** "Issuing refunds" admin guide
- [ ] **[S]** "Managing disputes" admin guide
- [ ] **[S]** "Reconciliation walkthrough" finance guide
- [ ] **[S]** Developer: payment plugin integration (for adding new providers)

---

## 18. Open questions

### Q-PAY-001: Stripe Connect for marketplace
**Otázka:** Marketplace mode (Fáze 4) requires Stripe Connect (Express or Standard accounts). Architecture impact?

**Status:** Defer to `25-marketplace.md`. MVP doesn't use Connect; tenant has single Stripe account.

### Q-PAY-002: Klarna BNPL integration
**Otázka:** Standalone Klarna integration or via Stripe (Klarna is supported method)?

**Status:** Via Stripe initially (less code, fewer compliance hurdles). Direct Klarna integration v2.0+ for advanced features (Klarna Checkout widget).

### Q-PAY-003: Apple Pay / Google Pay domain verification
**Otázka:** Apple Pay requires domain verification file `apple-developer-merchantid-domain-association`. How served per tenant?

**Status:** Auto-served via wildcard route `/.well-known/apple-developer-merchantid-domain-association` per tenant domain; configured during provider setup.

### Q-PAY-004: Recurring payment storage (subscriptions)
**Otázka:** When `24-subscriptions.md` launches, MIT charges need our payments table. Sufficient or specialized table?

**Status:** Reuse `payments` with `metadata.subscription_id`. Avoid premature subdivision.

### Q-PAY-005: Multi-payment per order
**Otázka:** Customer pays partly with gift card + partly with card. Already supported in schema (multiple payments rows). UI complexity?

**Status:** Supported MVP. UI initially shows them as separate rows in order detail; aggregate `order.paid_amount` sums.

### Q-PAY-006: 3DS exemptions strategy
**Otázka:** Use "Trusted Beneficiaries" / "Whitelisted" mode to skip 3DS for returning customers (PSD2 exemption)?

**Status:** Use provider's automatic exemption logic (Stripe Radar handles). No manual config in MVP.

### Q-PAY-007: Network tokens
**Otázka:** Stripe offers Network Tokens for cards (more resilient to card replacement). Auto-opt-in?

**Status:** Default ON for new tenants (Stripe-recommended). Existing tenants can opt-in via config toggle.

### Q-PAY-008: Failed payment dunning
**Otázka:** Email customers about failed subscription charges, retry logic.

**Status:** Subscription-specific; defer to `24-subscriptions.md`. MVP: one-time payment failure surfaces in checkout.

### Q-PAY-009: Custom payment methods via plugin
**Otázka:** Plugin marketplace allows custom payment provider. Security review process?

**Status:** v1.0+ feature. Plugin SDK exposes PaymentProvider interface. Security review required before marketplace listing. Detail v `28-developer-platform.md`.

### Q-PAY-010: Negative cash flow protection
**Otázka:** Refunds may exceed daily settlement; provider holds reserve. Surface to merchant cashflow forecasting?

**Status:** Out of scope MVP. v1.0+: settlement report includes "available balance" vs "pending balance" view.

### Q-PAY-011: Multi-tenancy webhook URL convention
**Otázka:** `{tenant_pub_id}` in webhook URL = predictable. Provider-side authentication still requires secret. Sufficient or add UUID component?

**Status:** Tenant_pub_id (NanoID) is non-guessable enough (entropy ~71 bits with 12 chars). HMAC signature provides primary auth. OK.

### Q-PAY-012: Cryptocurrency
**Otázka:** USDC / ETH support via Coinbase Commerce or BitPay?

**Status:** v3.0+ feature. Out of scope MVP. Schema can accommodate as another provider.

### Q-PAY-013: Per-currency provider routing
**Otázka:** Stripe for EUR, GoPay for CZK — automatic routing by currency?

**Status:** Yes, supported via `payment_provider_configs.supported_currencies`. Checkout filters available methods accordingly.

### Q-PAY-014: Compliance reports for tax authorities
**Otázka:** EU PSD2 requires reporting; some jurisdictions require detailed transaction logs.

**Status:** Compliance domain in `30-security.md`. Payment data retention 7 years (tax law). Exports via admin reports.

### Q-PAY-015: AI agent purchase authorization
**Otázka:** Agent token allows charge up to spending limit. Customer notification before vs after?

**Status:** Per RULE-CHK-017 (in `12`), configurable: pre-authorize email (customer can cancel within window) OR post-fact email. Default: post-fact for trusted agents, pre for unknown.

---

## 📅 Změny

| Datum | Změna |
|---|---|
| 2026-05-19 | Initial — Payments domain. Provider abstraction, 8 MVP providers, atomic capture/refund/cancel, webhook ingestion idempotency, 3DS orchestration, settlement reconciliation, dispute lifecycle, PCI SAQ A scope. |

---

**Konec Payments.**

➡️ Pokračovat na: [`14-shipping.md`](14-shipping.md)
