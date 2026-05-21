# 12 – CHECKOUT

> **Doména:** Hand-off z Cart do Order. Multi-step session: address → shipping → payment → review → confirm. Validace, finalizace pricing/tax, orchestrace payment intent, atomic order placement. Express checkout (Apple/Google Pay, PayPal). Agent checkout přes MCP.

**Datum:** 2026-05-19
**Verze:** 1.0
**Status:** 🟡 DESIGN
**Reference:** [03 §8](03-data-models-master.md#8-cart--checkout) · [11-cart.md](11-cart.md) · [13-payments.md](13-payments.md) · [14-shipping.md](14-shipping.md) · [15-tax-compliance.md](15-tax-compliance.md) · [16-order-management.md](16-order-management.md)

---

## 📑 Obsah

0. [Domain overview](#0-domain-overview)
1. [References](#1-references)
2. [Personas](#2-personas)
3. [Data models](#3-data-models)
4. [State machines](#4-state-machines)
5. [Business rules](#5-business-rules)
6. [Order placement pipeline](#6-order-placement-pipeline)
7. [REST API endpoints](#7-rest-api-endpoints)
8. [GraphQL schema](#8-graphql-schema)
9. [Events](#9-events)
10. [Background jobs](#10-background-jobs)
11. [UI/UX flows](#11-uiux-flows)
12. [Edge cases & error handling](#12-edge-cases--error-handling)
13. [Performance](#13-performance)
14. [Security & compliance](#14-security--compliance)
15. [Testing](#15-testing)
16. [Implementation checklist](#16-implementation-checklist)
17. [Open questions](#17-open-questions)

> Poznámka: kvůli důležitosti **order placement** atomicity má vlastní sekce 6.

---

## 0. Domain overview

### 0.1 Co tato doména **je**

- **Checkout session** — krátkodobý state container mezi cart a order (typicky 1h TTL)
- **Multi-step flow** (default: 4 kroků) nebo **one-page** (theme-configurable)
- **Address collection** + validace (postal code, VIES VAT ID, ARES IČO, address autocomplete)
- **Shipping method selection** — calls shipping engine z `14`
- **Payment method selection** — calls payment engine z `13`
- **Tax finalization** — taxable address known → tax engine z `15`
- **GDPR consent + T&C acceptance** capture
- **Order placement** — atomic transaction creating order + payment + initial inventory state transition
- **Express checkout** — Apple Pay, Google Pay, PayPal Express, Shop Pay-style "1-click"
- **Agent checkout** (MCP) — autonomous AI agent with scoped tokens + spending limits ([DEC-AUTH-001](01-decisions-registry.md#dec-auth-001-authentication-strategy))
- **3DS / SCA orchestration** — coordinate with payment provider for Strong Customer Authentication
- **B2B variant** — VAT reverse charge, PO numbers, company billing, NET payment terms (v1.0+)
- **Buy Now flow** — single-item checkout without cart (just-in-time cart materialization)
- **Idempotency guarantees** — anti-double-submit via `Idempotency-Key`

### 0.2 Co tato doména **NENÍ**

- ❌ Cart logic (→ `11-cart.md`)
- ❌ Order lifecycle post-placement (→ `16-order-management.md`)
- ❌ Payment provider integration internals (→ `13-payments.md`)
- ❌ Shipping rate calc internals (→ `14-shipping.md`)
- ❌ Tax computation (→ `15-tax-compliance.md`)
- ❌ Customer profile creation (→ `18-customer-management.md`)
- ❌ Invoice generation (→ `15-tax-compliance.md` + `16-order-management.md`)

### 0.3 Diferenciátory

1. **Atomic order placement** — payment authorization + inventory commit + order creation v koordinované transakci s saga compensation
2. **3-tap checkout** s Express Pay (Apple/Google Pay) — sub-30s mobile conversion path
3. **Agent-native checkout** — MCP `checkout.initiate` endpoint pro AI agenty s rate-limited spending caps
4. **EU-first compliance** — VIES, ARES, VAT reverse charge, GDPR consent capture v 1 flow
5. **One-codebase B2C + B2B-lite** od MVP (full B2B v1.0+) bez forked flow
6. **Resumable checkout** — partial state persisted; customer može přerušit a vrátit se přes recovery link

---

## 1. References

- [03 §8](03-data-models-master.md#8-cart--checkout) — entity ENT-CHECKOUT-SESSION-001
- [11-cart.md](11-cart.md) — cart → checkout handoff
- [13-payments.md](13-payments.md) — payment intent creation, 3DS, provider abstraction
- [14-shipping.md](14-shipping.md) — shipping rate calc, methods, carrier selection
- [15-tax-compliance.md](15-tax-compliance.md) — tax engine, VAT, reverse charge
- [16-order-management.md](16-order-management.md) — order creation, lifecycle
- [09-inventory.md](09-inventory.md) — reservation re-validation
- [10-pricing-promotions.md](10-pricing-promotions.md) — final pricing snapshot
- [18-customer-management.md](18-customer-management.md) — customer registration during checkout
- [21-b2b-complete.md](21-b2b-complete.md) — B2B checkout variant
- [30-security.md](30-security.md) — PCI scope, fraud detection
- [DEC-AUTH-001](01-decisions-registry.md#dec-auth-001-authentication-strategy) — agent tokens with DPoP
- [DEC-PAY-002](01-decisions-registry.md#dec-pay-002-pci-dss-scope) — PCI tokenization only
- [DEC-API-001](01-decisions-registry.md#dec-api-001-api-protocol) — REST + tRPC + GraphQL + MCP

---

## 2. Personas

| Persona | Použití | Klíčové permissions |
|---|---|---|
| `PERSONA-CUSTOMER` | B2C / B2B-lite storefront checkout | Anon / auth, no specific |
| `PERSONA-B2B-EMPLOYEE` | B2B checkout s company context, NET terms | Auth, `cart:write`, B2B-specific |
| `PERSONA-GUEST` | Guest checkout (no account) | Session-token based |
| `PERSONA-MERCHANT-OWNER` | View checkout sessions, recover abandoned | `PERM-CHECKOUT-VIEW`, `PERM-CHECKOUT-ASSIST` |
| `PERSONA-CUSTOMER-SERVICE` | Assist customer (resume, modify, place order on behalf) | `PERM-CHECKOUT-VIEW`, `PERM-CHECKOUT-ASSIST` |
| `PERSONA-POS-OPERATOR` | POS checkout (v2.0+) | `PERM-CHECKOUT-POS` |
| `PERSONA-AI-COPILOT` | Storefront UI helper (form completion, suggestions) | `agent:cart:read` |
| `PERSONA-EXTERNAL-AGENT` | MCP `checkout.initiate` + `checkout.confirm` s scoped agent token (v1.0+) | `agent:checkout:initiate`, `agent:checkout:write` |

---

## 3. Data models

### 3.1 `checkout_sessions` ([ENT-CHECKOUT-SESSION-001](03-data-models-master.md#ent-checkout-session-001))

```sql
CREATE TABLE checkout_sessions (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  pub_id TEXT NOT NULL,                                       -- chk_ NanoID
  cart_id UUID NOT NULL REFERENCES carts(id),
  customer_id UUID NULL REFERENCES customers(id),
  guest_email CITEXT NULL,
  guest_phone TEXT NULL,                                       -- E.164
  company_id UUID NULL REFERENCES companies(id),                -- B2B context
  channel_id UUID NULL REFERENCES channels(id),
  store_id UUID NULL REFERENCES stores(id),
  locale TEXT NOT NULL,
  currency CHAR(3) NOT NULL,
  -- state machine
  state TEXT NOT NULL CHECK (state IN (
    'initiated','address','shipping','payment','review','authorizing','completed','expired','abandoned','failed'
  )) DEFAULT 'initiated',
  state_entered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  flow_kind TEXT NOT NULL CHECK (flow_kind IN ('standard','one_page','express','b2b','agent','buy_now','quick_pay')) DEFAULT 'standard',
  -- addresses (snapshots until order placement)
  shipping_address_id UUID NULL REFERENCES addresses(id),
  billing_address_id UUID NULL REFERENCES addresses(id),
  shipping_address_snapshot JSONB NULL,                          -- captured snapshot (immutable per session)
  billing_address_snapshot JSONB NULL,
  is_billing_same_as_shipping BOOLEAN NOT NULL DEFAULT true,
  -- shipping selection
  shipping_method_id UUID NULL,                                  -- → from shipping engine (14)
  shipping_method_snapshot JSONB NULL,                            -- carrier + service + label + estimated days
  shipping_amount BIGINT NULL,
  shipping_currency CHAR(3) NULL,
  pickup_point_id UUID NULL REFERENCES pickup_points(id),
  delivery_instructions TEXT NULL,
  preferred_delivery_date DATE NULL,
  -- payment selection
  payment_method_id UUID NULL,                                   -- → payment_methods (13)
  payment_method_kind TEXT NULL,                                  -- 'card', 'paypal', 'gopay', 'bank_transfer', 'cod', 'gift_card_only'
  payment_provider_intent_id TEXT NULL,                            -- e.g., Stripe PaymentIntent ID
  payment_method_snapshot JSONB NULL,
  -- B2B specific
  vat_id_provided TEXT NULL,                                       -- DIČ entered by buyer
  vat_id_validated_at TIMESTAMPTZ NULL,                            -- VIES validation timestamp
  vat_id_validation_result TEXT NULL CHECK (vat_id_validation_result IN ('valid','invalid','unable_to_verify') OR vat_id_validation_result IS NULL),
  vat_reverse_charge_applicable BOOLEAN NOT NULL DEFAULT false,
  ico_provided TEXT NULL,                                          -- CZ IČO
  ico_validated_at TIMESTAMPTZ NULL,                                -- ARES validation timestamp
  purchase_order_number TEXT NULL,                                   -- buyer's PO reference
  -- consents (GDPR + T&C)
  gdpr_consents JSONB NOT NULL DEFAULT '{}'::jsonb,                  -- {marketing: true, profiling: false, ...} with timestamps
  terms_accepted_at TIMESTAMPTZ NULL,
  terms_version TEXT NULL,
  privacy_policy_accepted_at TIMESTAMPTZ NULL,
  privacy_policy_version TEXT NULL,
  -- pricing snapshot (final after tax finalization)
  subtotal_amount BIGINT NULL,
  discount_amount BIGINT NULL,
  tax_amount BIGINT NULL,
  shipping_tax_amount BIGINT NULL,
  total_amount BIGINT NULL,
  gift_card_redeemed_amount BIGINT NULL,
  amount_due BIGINT NULL,                                            -- total - gift_card_redeemed
  tax_breakdown JSONB NULL,
  -- agent context (pokud flow_kind='agent')
  agent_token_id UUID NULL,
  agent_spending_limit_amount BIGINT NULL,
  agent_session_id UUID NULL REFERENCES ai_sessions(id),
  -- idempotency
  idempotency_key TEXT NULL,
  confirm_idempotency_key TEXT NULL,
  -- result
  order_id UUID NULL REFERENCES orders(id),
  failure_reason TEXT NULL,
  failure_code TEXT NULL,
  -- 3DS / SCA
  requires_authentication BOOLEAN NOT NULL DEFAULT false,
  authentication_url TEXT NULL,
  authentication_completed_at TIMESTAMPTZ NULL,
  -- timestamps
  expires_at TIMESTAMPTZ NOT NULL,
  initiated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ NULL,
  abandoned_at TIMESTAMPTZ NULL,
  -- attribution / fraud signals
  origin_ip_hash TEXT NULL,
  origin_user_agent_family TEXT NULL,
  origin_country_code CHAR(2) NULL,
  risk_score INTEGER NULL,                                            -- 0–100 computed by fraud engine
  risk_signals JSONB NULL,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_checkout_sessions_pub_id UNIQUE (tenant_id, pub_id),
  CONSTRAINT uq_checkout_sessions_idempotency UNIQUE (tenant_id, idempotency_key) DEFERRABLE INITIALLY IMMEDIATE,
  CONSTRAINT ck_state_terminal CHECK (
    (state = 'completed' AND order_id IS NOT NULL) OR
    (state NOT IN ('completed'))
  )
);

CREATE INDEX idx_checkout_sessions_cart ON checkout_sessions (cart_id);
CREATE INDEX idx_checkout_sessions_customer ON checkout_sessions (customer_id, state) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_checkout_sessions_state ON checkout_sessions (tenant_id, state, expires_at);
CREATE INDEX idx_checkout_sessions_expires ON checkout_sessions (expires_at) WHERE state NOT IN ('completed','expired','abandoned','failed');
CREATE INDEX idx_checkout_sessions_abandoned ON checkout_sessions (tenant_id, abandoned_at DESC) WHERE state = 'abandoned';
CREATE INDEX idx_checkout_sessions_agent_token ON checkout_sessions (agent_token_id) WHERE agent_token_id IS NOT NULL;
```

### 3.2 `addresses` (used here, defined globally)

Used for shipping/billing. May be NEW (just-created) or REUSED (customer's address book).

```sql
-- Already defined in 03 §11
-- key fields: recipient_name, company_name, street1, street2, city, region,
--             postal_code, country_code, phone, kind
```

Při checkout: 2 entry points
- Customer logged-in: pick from existing addresses, OR enter new (saved to address book on completion)
- Guest: enter new, snapshot v `shipping/billing_address_snapshot` JSONB (NOT persisted to addresses table until order placement, then optionally)

### 3.3 `checkout_session_events` *(audit + recovery)*

Append-only audit per major state transition.

```sql
CREATE TABLE checkout_session_events (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  checkout_session_id UUID NOT NULL REFERENCES checkout_sessions(id) ON DELETE CASCADE,
  event_kind TEXT NOT NULL,
  from_state TEXT NULL,
  to_state TEXT NULL,
  actor_kind TEXT NOT NULL,
  actor_id UUID NULL,
  context JSONB NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_checkout_session_events_session ON checkout_session_events (checkout_session_id, occurred_at DESC);
```

### 3.4 `checkout_recovery_tokens`

Mirrored z cart_recovery_tokens pattern. Pro "Pokračovat v dokončení objednávky" emaily.

```sql
CREATE TABLE checkout_recovery_tokens (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  checkout_session_id UUID NOT NULL REFERENCES checkout_sessions(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  emitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ NULL,
  recovery_stage TEXT NOT NULL,
  CONSTRAINT uq_checkout_recovery_tokens_hash UNIQUE (token_hash)
);
```

### 3.5 `express_pay_tokens` *(saved express payment credentials)*

Pro 1-click / Apple Pay / Google Pay (v1.0+).

```sql
CREATE TABLE express_pay_tokens (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id),
  provider TEXT NOT NULL,                                            -- 'apple_pay','google_pay','paypal_express','shop_pay'
  provider_token_id TEXT NOT NULL,                                    -- provider's reference (no PAN!)
  display_name TEXT NOT NULL,                                          -- "Visa •••• 4242"
  brand TEXT NULL,
  last4 TEXT NULL,
  expires_month INTEGER NULL,
  expires_year INTEGER NULL,
  default_shipping_address_id UUID NULL REFERENCES addresses(id),
  default_billing_address_id UUID NULL REFERENCES addresses(id),
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_express_pay_tokens_customer_provider_token UNIQUE (customer_id, provider, provider_token_id)
);

CREATE INDEX idx_express_pay_tokens_customer ON express_pay_tokens (customer_id) WHERE is_active = true;
```

### 3.6 Vztahy

```
carts (1)──(N) checkout_sessions    [1 cart can theoretically spawn multiple if previous abandoned + retry]
checkout_sessions (1)──(0..1) orders   [completed session → order]
checkout_sessions (1)──(N) checkout_session_events
checkout_sessions (1)──(N) checkout_recovery_tokens
checkout_sessions (N)──(1) addresses  [shipping]
checkout_sessions (N)──(1) addresses  [billing]
checkout_sessions (0..1)──(1) agent_tokens   [pro agent flow]
customers (1)──(N) express_pay_tokens   [v1.0+]
```

---

## 4. State machines

### 4.1 Checkout session state

```
                                     ┌────────────────────────────────────┐
                                     │                                    │
                                     ▼                                    │
[initiated]──set-address──▶[address]──set-shipping──▶[shipping]──set-payment──▶[payment]──review──▶[review]
     │                                                                                                  │
     │                                                                                                  │
     │                                                                              confirm (idempotent)│
     │                                                                                                  ▼
     │                                                                                          [authorizing]
     │                                                                                                  │
     │                                                                                                  │
     │                                            ┌──── 3DS / SCA challenge ────────┬─ completed ──▶[completed → order_id]
     │                                            │                                  │
     │                                            │                                  └─ failed ──▶[failed]
     │                                            │
     │                                            └─── inactivity (TTL) ──────────▶[expired]
     │
     └─ no progress (>configured) ────────────────────────────────────────────────▶[abandoned]
                                                                                       │
                                                                                       └── customer recovers ──▶ back to last valid state
```

**Allowed transitions:**

| From | Event | To | Validates |
|---|---|---|---|
| `(none)` | `initiate` | `initiated` | cart exists, has items, not converted/expired/cancelled |
| `initiated` | `set_address(shipping,billing)` | `address` | address valid, country supported |
| `address` | `set_shipping_method(method_id)` | `shipping` | method available for address + cart items |
| `address` | `re_address` | `address` | self-transition for edit |
| `shipping` | `set_payment_method(method_id, intent_data)` | `payment` | method available for currency + amount |
| `shipping` | `re_address` / `re_shipping` | previous step | edit goes back |
| `payment` | `proceed_to_review` | `review` | all prereqs met |
| `payment` | `re_shipping` / `re_address` | back | edit |
| `review` | `confirm(idempotency_key)` | `authorizing` | atomic: re-validate stock, prices, payment intent capture |
| `authorizing` | `auth_succeeded` | `completed` | order created; `order_id` set |
| `authorizing` | `auth_failed` | `payment` (retry) OR `failed` (terminal after 3 attempts) | error info captured |
| `authorizing` | `requires_authentication` | `payment` (auth pending) | 3DS challenge URL set; customer redirected |
| any non-terminal | `inactivity_24h` | `abandoned` | sweeper sets state |
| any non-terminal | `inactivity_1h` | `expired` | session TTL hit; sweeper sets state |
| `abandoned` | `recover(token)` | back to last valid state | token verified |

### 4.2 Order placement sub-pipeline

Detail v §6. State machine view:

```
authorizing
  ├─ Step 1: Re-validate cart + stock (re-acquire reservations if needed)
  ├─ Step 2: Final pricing snapshot (re-run pricing engine, freeze)
  ├─ Step 3: Tax engine final compute
  ├─ Step 4: Create order (15-tax + 16-order entities, in-flight status='pending')
  ├─ Step 5: Authorize payment via provider (Stripe/GoPay/...)
  │    ├─ If 3DS required: state → payment (with auth_url), return to client
  │    ├─ If success: continue
  │    └─ If fail: rollback steps 1-4 (saga), state → payment (retry) or failed
  ├─ Step 6: Convert cart_reservations → order_reservations (already covered by 09 RULE-INV-006)
  ├─ Step 7: Issue invoice (if applicable, ISDOC for CZ — async)
  ├─ Step 8: Transition order status → 'confirmed'
  ├─ Step 9: Emit EVENT-ORDER-PLACED + EVENT-CHECKOUT-COMPLETED
  └─ state → completed, order_id set
```

### 4.3 3DS / SCA flow

```
[review] ──confirm──▶ [authorizing]
                          │
                          │ payment provider returns "requires_action" (3DS)
                          ▼
                  [payment] state with authentication_url set
                          │
                          │ Customer redirected to bank challenge UI
                          │ (frontend opens authentication_url in iframe/popup/redirect)
                          │
                          │ Customer completes challenge
                          │ Provider callback / webhook (per 13)
                          ▼
                  [authorizing] (retry confirm with original idempotency_key)
                          │
                          ├─ Provider returns success ──▶ [completed]
                          └─ Provider returns fail/cancel ──▶ [payment] retry OR [failed]
```

---

## 5. Business rules

### RULE-CHK-001: Checkout session lifecycle TTL

Default `expires_at = now() + 1 hour`. Configurable per tenant (`tenant.settings.checkout_session_ttl_seconds`).

Activity within session (state transition, field update) bumps `expires_at` (sliding extend) — but never beyond `created_at + 24h` (hard cap pro fraud).

Abandoned threshold: **15 min inactivity** in non-terminal state → `state='abandoned'`. Configurable.

### RULE-CHK-002: Cart re-validation on initiate

`POST /checkouts` (initiate from cart):
1. Acquire advisory lock on cart
2. Verify cart `status='active'`, has items, `tenant_id` matches
3. Re-price cart (call pricing engine — may produce different totals than cached)
4. Re-validate stock reservations (per RULE-INV-006 cart→order transition is later, here just re-attempt + extend)
5. If cart `pricing_stale=true` OR drift detected → require explicit customer acknowledgement before proceeding
6. Create checkout_session row
7. Mark cart with `metadata.active_checkout_session_id` (informational)

### RULE-CHK-003: Single active checkout session per cart

Multiple checkout sessions on same cart = ambiguity. Enforce: when creating new session, expire any prior `initiated/address/shipping/payment/review` sessions for same cart.

Exception: 3DS auth in progress (`authorizing` + `requires_authentication=true`) is preserved; new session creation blocked until that resolves or TTL hits.

### RULE-CHK-004: Email required before payment

`guest_email` MUST be set before transitioning to `payment` state. For logged-in customers, falls back to `customer.email`.

Reason: receipts, order confirmation, recovery emails.

### RULE-CHK-005: Address validation

When `set_address`:
- `country_code` must be in tenant's `enabled_shipping_countries` setting; else 422
- Postal code format validation per country (regex or service lookup)
- For CZ/SK/DE/AT/PL/HU/RO: server-side syntax check + optional service lookup (Mapy.cz, Google Address Validation API)
- `recipient_name` required, min 2 chars
- `street1` required
- `city` required
- `phone` required for shipping (carrier integrations) — E.164 format

Failure → 422 with field-level errors.

### RULE-CHK-006: VIES VAT ID validation (B2B)

When `vat_id_provided` is set:
1. Sync call to VIES (`https://ec.europa.eu/taxation_customs/vies/`) with timeout 3s
2. If timeout/error: `vat_id_validation_result='unable_to_verify'`; allow continue with warning
3. If valid: `vat_id_validation_result='valid'`, set `vat_reverse_charge_applicable` per tax rules (`15-tax-compliance.md`)
4. If invalid: `vat_id_validation_result='invalid'`; allow continue (customer may be sole prop without VAT) but no reverse charge

VIES results cached in Redis for 24h to reduce upstream calls.

### RULE-CHK-007: ARES IČO validation (CZ)

When `ico_provided` (CZ 8-digit IČO):
1. Call ARES (`https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/...`)
2. Fetch company name, address, VAT registration status
3. Auto-fill billing address if customer accepts ("Use ARES data")
4. Cache 7 days

Validate IČO checksum (modulo 11) before remote call.

### RULE-CHK-008: Shipping method validation

`set_shipping_method`:
- Method must be returned by shipping engine for current `(cart, shipping_address)`
- If pickup-point method: `pickup_point_id` required
- Method cost snapshot frozen into `shipping_amount` + `shipping_method_snapshot`
- Re-validation at confirm (price may have changed)

### RULE-CHK-009: Payment method validation

`set_payment_method`:
- Method enabled for tenant + channel
- Method supports currency
- For amount >0: provider returns `payment_intent_id` (Stripe pattern); 3DS may be required
- Payment method snapshot frozen

Special: if cart total = 0 (all gift card / 100% discount): `payment_method_kind='gift_card_only'` or `payment_method_kind='free'` (no provider call needed).

### RULE-CHK-010: T&C and GDPR consent capture

At `review → confirm`:
- `terms_accepted_at` MUST be set (with `terms_version`)
- `privacy_policy_accepted_at` MUST be set
- `gdpr_consents` JSON: marketing consent default false (must opt-in), essential cookies always true (no consent needed)

Failure → 422 `CONSENT_REQUIRED`.

### RULE-CHK-011: Idempotent confirm

`POST /checkouts/{id}/confirm` requires `Idempotency-Key` header (24h Redis cache per `04 §11`).

Second submission with same key:
- If first succeeded: returns same response (cached)
- If first failed terminally: returns cached error
- If first still in progress: returns 409 with hint to wait

Different `Idempotency-Key` on same session in `authorizing` state: 409 (don't allow double-submit fork).

### RULE-CHK-012: Atomic order placement

Per §6 detail. Must be transactional with saga compensation for payment failure.

### RULE-CHK-013: Stock re-validation at confirm

Even though cart reservations exist, at confirm:
- Re-check `stock_reservations.released_at IS NULL` for each cart item
- If any reservation expired: re-attempt acquisition (advisory lock); failure → 422 `STOCK_INSUFFICIENT`

Reason: cart reservation TTL (30 min) may expire during checkout (1h TTL).

### RULE-CHK-014: Pricing snapshot drift handling

At confirm, re-run pricing engine. If `total_amount` differs from `checkout_session.total_amount`:
- If drift ≤ tenant threshold (default 1% or 100 Kč, whichever smaller): silently use new total
- If drift > threshold: return 422 `PRICE_DRIFT` with both values; require explicit customer confirmation

### RULE-CHK-015: 3DS challenge timeout

If `requires_authentication=true`, customer has 15 minutes (configurable per provider) to complete bank challenge. After timeout:
- Provider auto-cancels intent
- Checkout session state → `payment` (retry); error_code='AUTH_TIMEOUT'

### RULE-CHK-016: Customer registration during checkout

Guest customer at `review` stage may opt-in to create account:
- `gdpr_consents.account_creation = true`
- Password set during checkout
- After order placement, customer record created, linked to order
- Subsequent orders use logged-in flow

Field: `metadata.create_account: { password_hash, marketing_opt_in }`. Hash created at API layer; never plaintext.

### RULE-CHK-017: Agent checkout constraints

When `flow_kind='agent'`:
- `agent_token_id` required, validated (DPoP, not expired, scope `agent:checkout:initiate` and `agent:checkout:write`)
- `agent_spending_limit_amount` enforced — total may not exceed
- Customer notification: configurable per agent token settings (email confirmation needed? auto-approve?)
- Rate limit stricter (10 checkouts/hour per agent token)
- Required: `metadata.agent_purpose` (text reason)
- Audit log entry: 100% sampling

### RULE-CHK-018: Express checkout (Apple/Google Pay)

`flow_kind='express'`:
- Skip multi-step; payment sheet provides email, shipping, billing in one interaction
- Backend creates checkout_session at `payment` state directly
- `payment_method_kind='apple_pay'` or `'google_pay'`
- After provider returns: validate + place order in single API call
- Customer cannot edit cart items mid-flow (cart locked in session)

### RULE-CHK-019: Buy Now (one-item express)

`flow_kind='buy_now'`:
- Customer clicks "Buy Now" on PDP → creates checkout session WITHOUT cart materialization (or with ephemeral cart deleted post-order)
- Single variant + quantity
- Pre-fills addresses from customer profile
- Goes straight to `payment` state

### RULE-CHK-020: B2B PO and NET terms

`flow_kind='b2b'`:
- `purchase_order_number` field shown
- `company_id` required (resolved from customer's company membership)
- Payment method may include "NET 30" / "NET 60" (no immediate payment; invoice issued)
- Credit limit check: `company.credit_limit_amount` vs (open invoices + this order total) — if exceeded: 422 unless admin override

### RULE-CHK-021: Risk scoring

Pre-confirm, fraud engine (per `30-security.md`) computes risk_score 0–100 based on:
- IP geo vs shipping country mismatch
- Velocity (multiple checkouts in short time from same IP/customer)
- Email domain disposable check
- Cart value anomaly vs customer history
- Device fingerprint vs known devices

Threshold actions:
- 0–40: auto-approve
- 41–70: require additional verification (CAPTCHA, SMS) for guest; logged-in passes
- 71–100: require manual review (state='authorizing' pauses for admin)

### RULE-CHK-022: Consent versioning

`terms_version` and `privacy_policy_version` reference `cms_pages` (terms-of-service, privacy-policy). At confirm: snapshot of accepted version. Pro audit / legal evidence.

### RULE-CHK-023: Cart conversion semantics

When checkout state → `completed`:
- `cart.status = 'converted'`, `cart.converted_to_order_id = new_order.id`
- Cart items become read-only (immutable post-conversion)
- New empty cart NOT auto-created — happens implicitly at next PDP add

### RULE-CHK-024: Checkout session resume

Recovery URL (HMAC token in email): `/storefront/checkout/recover?token=...`
- Validates token, finds session
- If session expired: redirect to /cart with restored cart
- If session abandoned: reactivate at last valid state, force re-validation (stock, prices)
- If session completed: redirect to order detail

### RULE-CHK-025: Multi-currency at checkout

Cart's `currency` is final by checkout time; switching currency mid-checkout requires going back to cart (intentional friction).

Exception: shipping cost in different currency than items (rare; some carriers price in EUR). Server normalizes to cart currency via exchange rate.

### RULE-CHK-026: Order placement idempotency at provider level

If our backend crashes after payment authorized but before order creation:
- Recovery: on next session access, query payment provider for intent status
- If authorized but no order: complete order placement using provider intent
- Reconciliation job (`JOB-RECONCILE-CHECKOUT-PROVIDER-STATE`) catches orphans

---

## 6. Order placement pipeline

Critical atomic operation. Saga-style with explicit compensations.

### 6.1 Steps

```
POST /checkouts/{id}/confirm
  Headers: Idempotency-Key: <uuid>

PHASE 1 — PRE-FLIGHT (all checks before any side effects)
  Step A: Load checkout_session, validate state == 'review'
  Step B: Check Idempotency-Key cache — if hit, return cached response
  Step C: Lock checkout_session (advisory lock by session_id)
  Step D: Re-validate consents (terms, privacy, GDPR)
  Step E: Re-validate cart (status='active', items present)
  Step F: Re-validate stock — for each cart item, attempt to re-acquire / extend reservation
       (Per RULE-CHK-013; uses 09's advisory lock pattern)
  Step G: Re-run pricing engine (per 10 RULE-PRICING-018), compute final totals
  Step H: Re-run tax engine (per 15) with finalized addresses
  Step I: Validate amount_due vs gift_card balance / payment method capability
  Step J: Compute risk_score; if >70, pause (manual review hold)
  Step K: Set checkout_session.state = 'authorizing', record snapshot of finalized totals

PHASE 2 — CRITICAL TX (atomic transaction)
  BEGIN;
    Step L: Create order row (status='pending', payment_status='pending') with snapshot fields
    Step M: Insert order_items (immutable snapshots from cart_items)
    Step N: Transition stock_reservations kind='cart' → 'order', set order_id
            (per 09 RULE-INV-006 — no expiry)
    Step O: Insert outbox event EVENT-ORDER-CREATED (for downstream consumers)
    Step P: Insert checkout_session_events entry (state transition)
  COMMIT;

PHASE 3 — PAYMENT AUTHORIZATION (external call, with compensation)
  Step Q: Call payment provider with intent ID + amount
  Step R: Handle response:
    • SUCCESS (authorized or captured):
        Insert payment row (status='authorized' or 'captured')
        UPDATE order SET payment_status='authorized' / 'paid'
        UPDATE checkout_session SET state='completed', order_id=order.id, completed_at=now()
        Emit EVENT-ORDER-PLACED + EVENT-PAYMENT-AUTHORIZED/CAPTURED
        Schedule async: invoice generation, confirmation email, fulfillment trigger
        RETURN 201 Created with order details

    • REQUIRES_AUTHENTICATION (3DS):
        Insert payment row (status='requires_authentication')
        UPDATE checkout_session SET state='payment', requires_authentication=true, authentication_url=...
        Emit EVENT-CHECKOUT-AUTHENTICATION-REQUIRED
        RETURN 202 Accepted with authentication_url
        (Customer completes challenge → webhook → re-enter confirm flow)

    • FAILED (insufficient funds, fraud decline, etc.):
        Insert payment row (status='failed') with reason
        ROLLBACK COMPENSATION:
          - UPDATE order SET status='cancelled', cancel_reason='payment_failed'
          - Release order reservations (per 09: reservation released, but stock returns to available)
          - UPDATE checkout_session SET state='payment', failure_reason, failure_code
        Emit EVENT-ORDER-FAILED + EVENT-PAYMENT-FAILED
        RETURN 422 with error details (customer can retry with different payment)

  Step S: Cache Idempotency-Key result (24h TTL)
  Step T: Release advisory lock
```

### 6.2 Pseudocode

```typescript
async function confirmCheckout(sessionId: string, idempotencyKey: string): Promise<ConfirmResult> {
  // Phase 1: pre-flight
  const cached = await redis.get(`idemp:checkout:${sessionId}:${idempotencyKey}`);
  if (cached) return JSON.parse(cached);

  return await pg.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('checkout:' + ${sessionId})::bigint)`);

    const session = await loadCheckoutSession(tx, sessionId);
    if (session.state !== 'review') throw new InvalidStateError();
    validateConsents(session);
    
    const cart = await loadCart(tx, session.cart_id);
    if (cart.status !== 'active') throw new CartNotActiveError();
    
    await revalidateStock(tx, cart); // re-acquire reservations
    const pricing = pricingEngine.run({ cart, context: deriveContext(session), timestamp: now() });
    validatePricingDrift(session, pricing);
    
    const tax = taxEngine.run({ cart, pricing, shippingAddress: session.shipping_address_snapshot });
    validateAmounts(session, pricing, tax);
    
    const riskScore = await fraudEngine.score(session, cart, ctx);
    if (riskScore > 70) {
      await markPendingReview(tx, session);
      return { status: 202, pendingReview: true };
    }
    
    await updateCheckoutSession(tx, sessionId, { state: 'authorizing', risk_score: riskScore });
    
    // Phase 2: critical Tx — create order
    const order = await createOrder(tx, session, cart, pricing, tax);
    await transitionReservations(tx, cart.id, order.id);
    await emitOutbox(tx, 'order.created', { order });

    // Tx commits here when async returns
    return { order, pricing, riskScore };
  }).then(async ({ order, pricing }) => {
    // Phase 3: payment (outside tx — external call)
    const paymentResult = await paymentProvider.confirmIntent(session.payment_provider_intent_id, {
      amount: pricing.total_amount,
      currency: pricing.currency,
      idempotencyKey,
    });
    
    if (paymentResult.kind === 'success') {
      await markCompleted(order.id, sessionId, paymentResult);
      emitEvent('EVENT-ORDER-PLACED', { order });
      emitEvent('EVENT-PAYMENT-AUTHORIZED', { payment: paymentResult });
      scheduleAsyncTasks(order); // invoice, email, fulfillment
      const response = { status: 201, order };
      await redis.setEx(`idemp:checkout:${sessionId}:${idempotencyKey}`, 86400, JSON.stringify(response));
      return response;
    } else if (paymentResult.kind === 'requires_authentication') {
      await markRequiresAuth(sessionId, paymentResult.authenticationUrl);
      emitEvent('EVENT-CHECKOUT-AUTHENTICATION-REQUIRED', { session });
      return { status: 202, authenticationUrl: paymentResult.authenticationUrl };
    } else {
      // failed — compensate
      await compensate(order, sessionId, paymentResult);
      emitEvent('EVENT-ORDER-FAILED', { order, reason: paymentResult.failureCode });
      emitEvent('EVENT-PAYMENT-FAILED', { payment: paymentResult });
      throw new PaymentFailedError(paymentResult);
    }
  });
}
```

### 6.3 Compensation logic

```typescript
async function compensate(order: Order, sessionId: string, failure: PaymentFailure) {
  await pg.transaction(async tx => {
    await tx.execute(sql`UPDATE orders SET status='cancelled', cancel_reason=${'payment_failed: ' + failure.code} WHERE id=${order.id}`);
    await releaseOrderReservations(tx, order.id); // returns stock to available
    await tx.execute(sql`UPDATE checkout_sessions SET state='payment', failure_reason=${failure.message}, failure_code=${failure.code} WHERE id=${sessionId}`);
    await emitOutbox(tx, 'order.cancelled', { order, reason: 'payment_failed' });
    await emitOutbox(tx, 'checkout.payment_failed', { session_id: sessionId, failure });
  });
}
```

### 6.4 Recovery from crash mid-pipeline

If backend crashes between Phase 2 commit and Phase 3 payment response:
- Order exists (status='pending', payment_status='pending')
- Checkout session state='authorizing'
- `JOB-RECONCILE-CHECKOUT-PROVIDER-STATE` runs every 5 min:
  - For sessions in 'authorizing' state >5 min: query provider for intent status
  - If provider says authorized: complete the flow (Phase 3 SUCCESS path)
  - If provider says failed/canceled: trigger compensate()
  - If provider says still pending: leave; retry next cycle

### 6.5 Why saga vs 2PC

Postgres + external payment provider — no shared transaction. Saga is the only viable pattern:
- Phase 2 (Postgres Tx) commits before Phase 3 (provider call)
- Compensation undoes Phase 2 if Phase 3 fails
- Reconciliation job catches crashes between commits

Alternative: outbox-only pattern with eventual order creation post-payment. Rejected because customer needs immediate order_id for confirmation UI.

---

## 7. REST API endpoints

### 7.1 Storefront

```
POST   /api/{date}/storefront/checkouts                           # initiate from cart
GET    /api/{date}/storefront/checkouts/{id}                      # get current state
PATCH  /api/{date}/storefront/checkouts/{id}/email                # set guest_email (RULE-CHK-004)
PATCH  /api/{date}/storefront/checkouts/{id}/addresses            # set shipping + billing
PATCH  /api/{date}/storefront/checkouts/{id}/shipping             # set shipping method
PATCH  /api/{date}/storefront/checkouts/{id}/payment              # set payment method (creates intent)
PATCH  /api/{date}/storefront/checkouts/{id}/vat                  # set/validate VAT ID (B2B)
PATCH  /api/{date}/storefront/checkouts/{id}/ico                  # set/validate ICO (CZ)
PATCH  /api/{date}/storefront/checkouts/{id}/consents             # GDPR + T&C
PATCH  /api/{date}/storefront/checkouts/{id}/notes                # delivery instructions
POST   /api/{date}/storefront/checkouts/{id}:proceed-to-review
POST   /api/{date}/storefront/checkouts/{id}:back-to-step         # body: { step }
POST   /api/{date}/storefront/checkouts/{id}:confirm              # FINALIZE — atomic order placement
POST   /api/{date}/storefront/checkouts/{id}:cancel               # explicit cancel
POST   /api/{date}/storefront/checkouts/{id}:recover              # with token

# Helpers
POST   /api/{date}/storefront/checkouts/{id}:shipping-rates       # query available rates for current address
POST   /api/{date}/storefront/checkouts/{id}:payment-methods      # query available methods for current amount/currency
POST   /api/{date}/storefront/addresses:validate                   # standalone address validation utility
POST   /api/{date}/storefront/checkouts/{id}:summary               # pricing summary refresh

# Express
POST   /api/{date}/storefront/express-checkouts                    # Apple/Google Pay sheet payload
POST   /api/{date}/storefront/express-checkouts/{id}:complete

# Buy Now
POST   /api/{date}/storefront/buy-now                               # one-shot checkout for single variant

# Agent (v1.0+)
POST   /api/{date}/agent/checkouts                                  # initiate agent checkout
POST   /api/{date}/agent/checkouts/{id}:confirm
```

### 7.2 Admin

```
GET    /api/{date}/checkouts                                       # list, filterable
GET    /api/{date}/checkouts/{id}
POST   /api/{date}/checkouts/{id}:assist                           # staff places order on behalf
POST   /api/{date}/checkouts/{id}:send-recovery                    # manual recovery email trigger
POST   /api/{date}/checkouts/{id}:approve-manual-review            # release manual review hold
POST   /api/{date}/checkouts/{id}:reject-manual-review             # reject and cancel
GET    /api/{date}/checkouts/{id}/events                           # audit trail
GET    /api/{date}/checkout-analytics/abandonment-rate
GET    /api/{date}/checkout-analytics/conversion-funnel
GET    /api/{date}/checkout-analytics/manual-review-queue
```

### 7.3 Example: Initiate checkout

```http
POST /api/2026-05-19/storefront/checkouts HTTP/1.1
Cookie: shopio_cart_session=abc123...
Content-Type: application/json
Idempotency-Key: 9c9f5e2a-...

{
  "cart_id": "crt_aB3cD",
  "flow_kind": "standard",
  "locale": "cs-CZ"
}
```

```jsonc
HTTP/1.1 201 Created
Location: /api/2026-05-19/storefront/checkouts/chk_aB
ETag: "v1-..."

{
  "data": {
    "id": "01927bda-...",
    "pub_id": "chk_aB3cD4eF5g6h",
    "type": "checkout_session",
    "attributes": {
      "state": "initiated",
      "flow_kind": "standard",
      "cart_id": "crt_aB",
      "currency": "CZK",
      "locale": "cs-CZ",
      "expires_at": "2026-05-19T15:30:00Z",
      "items_count": 3,
      "subtotal_amount": 88200,
      "needs_email": true,
      "needs_address": true,
      "needs_shipping_method": true,
      "needs_payment_method": true,
      "needs_consent": true,
      "available_steps_order": ["address", "shipping", "payment", "review"]
    }
  },
  "meta": { "request_id": "req_..." }
}
```

### 7.4 Example: Set shipping address

```http
PATCH /api/2026-05-19/storefront/checkouts/chk_aB/addresses HTTP/1.1

{
  "shipping": {
    "recipient_name": "Jan Novák",
    "street1": "Karlovo nám. 15",
    "city": "Praha",
    "postal_code": "120 00",
    "country_code": "CZ",
    "phone": "+420777123456"
  },
  "billing_same_as_shipping": true
}
```

```jsonc
HTTP/1.1 200 OK

{
  "data": {
    "id": "...",
    "attributes": {
      "state": "address",
      "shipping_address_snapshot": { ... },
      "billing_address_snapshot": { ... },
      "tax_amount": 18522,
      "available_shipping_methods_url": "/api/2026-05-19/storefront/checkouts/chk_aB:shipping-rates"
    }
  }
}
```

### 7.5 Example: Set shipping method

```http
PATCH /api/2026-05-19/storefront/checkouts/chk_aB/shipping HTTP/1.1

{
  "shipping_method_id": "ship_zasilkovna_pickup",
  "pickup_point_id": "pup_xyz",
  "delivery_instructions": "Prosím nezvonit, dítě spí"
}
```

```jsonc
HTTP/1.1 200 OK

{
  "data": {
    "attributes": {
      "state": "shipping",
      "shipping_method_snapshot": {
        "carrier_code": "zasilkovna",
        "service_code": "pickup_point",
        "estimated_days_min": 1,
        "estimated_days_max": 2
      },
      "shipping_amount": 7900,
      "shipping_tax_amount": 1659,
      "total_amount": 124281
    }
  }
}
```

### 7.6 Example: Set payment method

```http
PATCH /api/2026-05-19/storefront/checkouts/chk_aB/payment HTTP/1.1

{
  "payment_method_kind": "card",
  "provider_code": "stripe",
  "save_for_future_use": false
}
```

```jsonc
HTTP/1.1 200 OK

{
  "data": {
    "attributes": {
      "state": "payment",
      "payment_method_kind": "card",
      "payment_provider_intent_id": "pi_3OabcXY...",
      "client_secret_for_provider": "pi_3OabcXY..._secret_aB",
      "requires_3ds": null,
      "amount_due": 124281
    }
  }
}
```

(Storefront uses `client_secret_for_provider` to confirm Stripe Element on client side, then calls our confirm endpoint.)

### 7.7 Example: Confirm checkout (atomic placement)

```http
POST /api/2026-05-19/storefront/checkouts/chk_aB:confirm HTTP/1.1
Idempotency-Key: 9c9f5e2a-...

{
  "payment_method_confirmation": {
    "provider_payment_method_id": "pm_xyz..."
  }
}
```

Success:
```jsonc
HTTP/1.1 201 Created
Location: /api/2026-05-19/storefront/orders/ord_aB

{
  "data": {
    "checkout_session": {
      "id": "...",
      "state": "completed",
      "order_id": "ord_aB3cD",
      "completed_at": "2026-05-19T14:45:00Z"
    },
    "order": {
      "id": "ord_aB3cD",
      "number": "ORD-2026-00001234",
      "status": "confirmed",
      "payment_status": "paid",
      "total_amount": 124281,
      "currency": "CZK"
    }
  }
}
```

Requires 3DS:
```jsonc
HTTP/1.1 202 Accepted

{
  "data": {
    "checkout_session": {
      "state": "payment",
      "requires_authentication": true,
      "authentication_url": "https://hooks.stripe.com/3d_secure_2/..."
    }
  },
  "meta": {
    "next_action": "redirect_to_authentication_url"
  }
}
```

Payment failed:
```jsonc
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/problem+json

{
  "type": "https://docs.shopio.com/errors/payment-failed",
  "code": "PAYMENT_FAILED",
  "title": "Payment could not be processed",
  "status": 422,
  "detail": "Your card was declined. Please try a different payment method.",
  "errors": [{
    "code": "CARD_DECLINED",
    "path": "payment_method",
    "context": { "provider_code": "stripe", "decline_reason": "insufficient_funds" }
  }]
}
```

### 7.8 Example: Express checkout (Apple Pay)

```http
POST /api/2026-05-19/storefront/express-checkouts HTTP/1.1

{
  "cart_id": "crt_aB",
  "provider": "apple_pay",
  "payment_token": "encrypted_apple_pay_token",
  "shipping_address": { ... },
  "billing_address": { ... },
  "email": "customer@example.com",
  "shipping_method_id": "ship_zasilkovna_home"
}
```

```jsonc
HTTP/1.1 201 Created

{
  "data": {
    "checkout_session_id": "chk_xY",
    "order_id": "ord_xY",
    "state": "completed",
    "total_amount": 124281,
    "currency": "CZK"
  }
}
```

(Single-call flow; backend creates session, calls payment provider, places order, all atomic.)

### 7.9 Example: Agent checkout (MCP)

MCP tool `checkout.initiate`:
```jsonc
// Agent calls
{
  "tool": "checkout.initiate",
  "args": {
    "cart_pub_id": "crt_aB",
    "shipping_address": { ... },
    "payment_method": { "kind": "stored_card", "provider_token_id": "pm_xyz" },
    "spending_limit_amount": 200000,
    "purpose": "Restocking office supplies"
  }
}
```

Server validates:
- Agent token scope `agent:checkout:initiate`
- Cart total ≤ spending_limit_amount
- Agent token's authorized payment method (provider_token_id)

Then MCP tool `checkout.confirm`:
```jsonc
{
  "tool": "checkout.confirm",
  "args": {
    "checkout_session_id": "chk_aB",
    "agent_idempotency_key": "agent_run_abc123"
  }
}
```

Server places order, emits `EVENT-ORDER-PLACED` + `EVENT-AGENT-ORDER-PLACED` (special downstream event for customer notification).

---

## 8. GraphQL schema

```graphql
type CheckoutSession implements Node & Timestamped {
  id: ID!
  pubId: String!
  cart: Cart!
  customer: Customer
  guestEmail: String
  guestPhone: String
  company: Company
  channel: Channel
  store: Store
  locale: String!
  currency: String!
  state: CheckoutState!
  flowKind: CheckoutFlowKind!
  shippingAddress: Address
  billingAddress: Address
  isBillingSameAsShipping: Boolean!
  shippingMethod: ShippingMethod
  shippingAmount: Money
  pickupPoint: PickupPoint
  deliveryInstructions: String
  preferredDeliveryDate: Date
  paymentMethodKind: String
  paymentProviderIntentId: String
  clientSecretForProvider: String                   # transient, for Stripe.js etc.
  vatIdProvided: String
  vatIdValidationResult: VatIdValidationResult
  vatReverseChargeApplicable: Boolean!
  icoProvided: String
  purchaseOrderNumber: String
  gdprConsents: JSON!
  termsAcceptedAt: DateTime
  privacyPolicyAcceptedAt: DateTime
  subtotalAmount: Money
  discountAmount: Money
  taxAmount: Money
  shippingTaxAmount: Money
  totalAmount: Money
  giftCardRedeemedAmount: Money
  amountDue: Money
  taxBreakdown: [TaxBreakdownItem!]
  requiresAuthentication: Boolean!
  authenticationUrl: String
  expiresAt: DateTime!
  completedAt: DateTime
  abandonedAt: DateTime
  failureReason: String
  failureCode: String
  order: Order
  riskScore: Int
  agentToken: AgentToken
  createdAt: DateTime!
  updatedAt: DateTime!
}

enum CheckoutState {
  INITIATED
  ADDRESS
  SHIPPING
  PAYMENT
  REVIEW
  AUTHORIZING
  COMPLETED
  EXPIRED
  ABANDONED
  FAILED
}

enum CheckoutFlowKind {
  STANDARD
  ONE_PAGE
  EXPRESS
  B2B
  AGENT
  BUY_NOW
  QUICK_PAY
}

enum VatIdValidationResult {
  VALID
  INVALID
  UNABLE_TO_VERIFY
}

type CheckoutMutationPayload {
  checkoutSession: CheckoutSession
  userErrors: [UserError!]!
  warnings: [String!]!
}

extend type Query {
  checkoutSession(id: ID, pubId: String): CheckoutSession
  myActiveCheckouts: [CheckoutSession!]!             # logged-in customer
  checkoutShippingRates(checkoutId: ID!): [ShippingRate!]!
  checkoutPaymentMethods(checkoutId: ID!): [PaymentMethodOption!]!

  # Admin
  checkoutSessions(first: Int, after: String, filter: CheckoutFilter): CheckoutSessionConnection!
    @auth(requires: PERM_CHECKOUT_VIEW)
}

extend type Mutation {
  initiateCheckout(input: InitiateCheckoutInput!): CheckoutMutationPayload!
  setCheckoutEmail(checkoutId: ID!, email: String!): CheckoutMutationPayload!
  setCheckoutAddresses(checkoutId: ID!, input: AddressesInput!): CheckoutMutationPayload!
  setCheckoutShipping(checkoutId: ID!, input: SetShippingInput!): CheckoutMutationPayload!
  setCheckoutPayment(checkoutId: ID!, input: SetPaymentInput!): CheckoutMutationPayload!
  setCheckoutVatId(checkoutId: ID!, vatId: String!): CheckoutMutationPayload!
  setCheckoutIco(checkoutId: ID!, ico: String!): CheckoutMutationPayload!
  setCheckoutConsents(checkoutId: ID!, input: ConsentsInput!): CheckoutMutationPayload!
  setCheckoutNotes(checkoutId: ID!, instructions: String): CheckoutMutationPayload!
  proceedToReview(checkoutId: ID!): CheckoutMutationPayload!
  backToStep(checkoutId: ID!, step: CheckoutState!): CheckoutMutationPayload!
  confirmCheckout(checkoutId: ID!, idempotencyKey: String!): CheckoutConfirmResult!
  cancelCheckout(checkoutId: ID!, reason: String): CheckoutMutationPayload!
  recoverCheckout(token: String!): CheckoutMutationPayload!

  # Express
  initiateExpressCheckout(input: ExpressCheckoutInput!): CheckoutConfirmResult!

  # Buy Now
  buyNow(input: BuyNowInput!): CheckoutConfirmResult!

  # Admin
  staffAssistCheckout(checkoutId: ID!, input: StaffAssistInput!): CheckoutMutationPayload! @auth(requires: PERM_CHECKOUT_ASSIST)
  approveManualReview(checkoutId: ID!): CheckoutMutationPayload! @auth(requires: PERM_CHECKOUT_REVIEW_APPROVE)
  rejectManualReview(checkoutId: ID!, reason: String!): CheckoutMutationPayload! @auth(requires: PERM_CHECKOUT_REVIEW_APPROVE)
}

union CheckoutConfirmResult = CheckoutCompleted | CheckoutRequiresAuth | CheckoutFailed

type CheckoutCompleted {
  checkoutSession: CheckoutSession!
  order: Order!
}

type CheckoutRequiresAuth {
  checkoutSession: CheckoutSession!
  authenticationUrl: String!
  nextAction: String!                                 # 'redirect','iframe','modal'
}

type CheckoutFailed {
  checkoutSession: CheckoutSession!
  failureCode: String!
  failureReason: String!
  retryable: Boolean!
}
```

---

## 9. Events

| Build-spec ID | Wire | Payload |
|---|---|---|
| `EVENT-CHECKOUT-INITIATED` | `checkout.initiated` | `{ checkout_session }` |
| `EVENT-CHECKOUT-STATE-CHANGED` | `checkout.state_changed` | `{ checkout_session_id, from_state, to_state, actor_kind }` |
| `EVENT-CHECKOUT-ADDRESS-SET` | `checkout.address_set` | `{ checkout_session_id, shipping, billing }` |
| `EVENT-CHECKOUT-SHIPPING-METHOD-SET` | `checkout.shipping_method_set` | `{ checkout_session_id, method }` |
| `EVENT-CHECKOUT-PAYMENT-METHOD-SET` | `checkout.payment_method_set` | `{ checkout_session_id, method_kind, provider_code }` |
| `EVENT-CHECKOUT-VAT-VALIDATED` | `checkout.vat_validated` | `{ checkout_session_id, vat_id, result }` |
| `EVENT-CHECKOUT-AUTHENTICATION-REQUIRED` | `checkout.authentication_required` | `{ checkout_session_id, authentication_url, provider }` |
| `EVENT-CHECKOUT-AUTHENTICATION-COMPLETED` | `checkout.authentication_completed` | `{ checkout_session_id }` |
| `EVENT-CHECKOUT-COMPLETED` | `checkout.completed` | `{ checkout_session_id, order_id }` |
| `EVENT-CHECKOUT-ABANDONED` | `checkout.abandoned` | `{ checkout_session_id, last_state, customer_email? }` |
| `EVENT-CHECKOUT-EXPIRED` | `checkout.expired` | `{ checkout_session_id }` |
| `EVENT-CHECKOUT-FAILED` | `checkout.failed` | `{ checkout_session_id, failure_code, failure_reason }` |
| `EVENT-CHECKOUT-MANUAL-REVIEW-REQUIRED` | `checkout.manual_review_required` | `{ checkout_session_id, risk_score, risk_signals }` |
| `EVENT-CHECKOUT-MANUAL-REVIEW-APPROVED` | `checkout.manual_review_approved` | `{ checkout_session_id, approved_by }` |
| `EVENT-CHECKOUT-MANUAL-REVIEW-REJECTED` | `checkout.manual_review_rejected` | `{ checkout_session_id, rejected_by, reason }` |
| `EVENT-CHECKOUT-PRICE-DRIFT` | `checkout.price_drift` | `{ checkout_session_id, previous_total, new_total }` |
| `EVENT-CHECKOUT-STOCK-DRIFT` | `checkout.stock_drift` | `{ checkout_session_id, affected_items }` |
| `EVENT-AGENT-ORDER-PLACED` | `agent.order_placed` | `{ order_id, agent_token_id, customer_id }` |

**Konzumenti:**
- Recovery email pipeline (abandoned, expired, failed)
- Fraud monitoring dashboards
- Analytics: conversion funnel per state, drop-off rates
- Webhook delivery
- ERP/CRM sync (on completion → order entered)

---

## 10. Background jobs

| Job | Trigger | Queue | Frequency |
|---|---|---|---|
| `JOB-EXPIRE-CHECKOUT-SESSIONS` | scheduled | `checkout-sweeper` | Every 5 min |
| `JOB-DETECT-ABANDONED-CHECKOUTS` | scheduled | `checkout-sweeper` | Every 15 min |
| `JOB-RECONCILE-CHECKOUT-PROVIDER-STATE` | scheduled | `payment-reconcile` | Every 5 min |
| `JOB-SEND-CHECKOUT-RECOVERY-EMAIL` | EVENT-CHECKOUT-ABANDONED (staged) | `notifications` | 1h / 24h / 72h |
| `JOB-CLEANUP-CHECKOUT-RECOVERY-TOKENS` | scheduled | `maintenance` | Daily |
| `JOB-VALIDATE-VAT-IDS-PENDING` | EVENT-CHECKOUT-VAT-VALIDATED (async fallback) | `validations` | On-demand |
| `JOB-FRAUD-RESCORE-PENDING` | EVENT-CHECKOUT-INITIATED (debounced) | `fraud` | On-demand |
| `JOB-PROCESS-MANUAL-REVIEW-QUEUE` | none (UI-triggered) | n/a | Manual |
| `JOB-CHECKOUT-ANALYTICS-DAILY` | scheduled | `analytics` | Daily |
| `JOB-CLEANUP-EXPIRED-SESSIONS` | scheduled | `maintenance` | Daily 03:00 |
| `JOB-NOTIFY-AGENT-ORDER-RESULT` | EVENT-AGENT-ORDER-PLACED / FAILED | `notifications` | On-demand |

---

## 11. UI/UX flows

### FLOW-CHK-001: Standard multi-step checkout

```
[Cart page] → click "Checkout"
        │
        ▼
[Step 1: Account]
   - Sign in / continue as guest
   - Email input (with marketing opt-in)
        │
        ▼
[Step 2: Address]
   - Shipping address form (with autocomplete via Mapy.cz / Google)
   - Address book picker (if logged-in)
   - "Billing same as shipping" toggle
   - VAT ID input (if B2B context detected or merchant always shows)
   - IČO input (CZ context)
   - Continue button
        │
        ▼
[Step 3: Shipping]
   - List of available shipping methods from server, with price + estimated days
   - Pickup point picker (Zásilkovna widget) if applicable
   - Delivery instructions textarea
   - Continue button
        │
        ▼
[Step 4: Payment]
   - List of available payment methods
   - Card form (Stripe Element / GoPay iframe)
   - Bank transfer (shows account info)
   - COD (CZ specific)
   - Apple Pay / Google Pay button (if device supports)
   - "Save card for future use" toggle (logged-in)
        │
        ▼
[Step 5: Review]
   - Order summary
   - Edit links per step
   - T&C + Privacy checkboxes (required)
   - Marketing opt-in checkbox (optional)
   - "Place order" CTA
        │
        │  click confirm
        ▼
[Loading spinner — DO NOT NAVIGATE AWAY]
   - Backend: Phase 1-3 of order placement pipeline
   - On success: redirect to /order/{number}/thank-you
   - On 3DS: redirect to authentication_url
   - On fail: stay on /checkout/review with error
```

### FLOW-CHK-002: One-page checkout (theme variant)

All fields on single page, progressive validation as user fills. Submit button enabled when all required fields valid.

```
[/checkout]
   - Email
   - Shipping address (top-left)
   - Billing checkbox + form (collapsed by default)
   - Shipping method (loaded dynamically on address change)
   - Payment method (loaded dynamically on amount change)
   - Order summary (right side, sticky)
   - T&C, Privacy
   - Place order
```

### FLOW-CHK-003: Express checkout (Apple Pay)

```
[Cart or PDP] → "Apple Pay" button visible (device + browser supports)
        │
        ▼
[Apple Pay Sheet opens]
   - Customer reviews items, addresses, payment in single sheet
   - Confirms with Face ID / Touch ID
        │
        ▼
[POST /storefront/express-checkouts with provider token]
   - Backend creates session + places order atomically
        │
        ▼
[/order/{number}/thank-you]
```

### FLOW-CHK-004: 3DS challenge

```
[Checkout confirm] → backend returns 202 with authentication_url
        │
        ▼
[Frontend opens authentication URL]
   Option A: redirect (full page)
   Option B: modal iframe (Stripe Elements 3DS handler — preferred for UX)
        │
        ▼
[Customer's bank 3DS challenge]
   - Approve via app / SMS / etc.
        │
        ▼
[Bank callback to provider, provider webhook to us]
        │
        ▼
[Frontend polls / SSE for state change]
        │
        ▼
[On success: redirect to /order/{number}/thank-you]
[On fail: redirect to /checkout/payment with error]
```

### FLOW-CHK-005: Abandoned checkout recovery

```
[Customer abandons at step 3 (shipping)]
   - JOB-DETECT-ABANDONED-CHECKOUTS marks abandoned after 15 min
        │
        ▼
[JOB-SEND-CHECKOUT-RECOVERY-EMAIL at 1h stage]
   - Email: "Complete your order — your cart is waiting"
   - Includes summary + items + recovery URL
        │
   Customer clicks URL
        │
        ▼
[POST /storefront/checkouts/{id}:recover with token]
   - Session re-validated:
     - Stock re-checked
     - Prices re-checked (drift warning if differ)
     - Goes back to last valid step
        │
        ▼
[Customer continues from saved state]
```

### FLOW-CHK-006: Manual review

```
[High risk_score >70 detected at confirm]
   - Order created with status='pending'
   - Checkout state='authorizing' (paused, no payment yet)
   - Admin notification + queue entry
        │
        ▼
[Customer sees "Reviewing your order..." page]
        │
        ▼
[Admin views queue → approves or rejects]
   - Approve: resume confirmation → payment authorization
   - Reject: cancel order, refund any captured amount, notify customer
        │
        ▼
[Customer sees: success thank-you OR rejection notice]
```

---

## 12. Edge cases & error handling

| Scenario | Behavior | Code |
|---|---|---|
| Initiate from converted/expired cart | Reject | `CART_NOT_ACTIVE`, 422 |
| Initiate when active session exists | Expire old, create new | (success) |
| Set address country not enabled | Reject | `COUNTRY_NOT_SUPPORTED`, 422 |
| Invalid postal code format | Reject | `INVALID_POSTAL_CODE`, 422 |
| VIES timeout (>3s) | Allow with warning, `vat_id_validation_result='unable_to_verify'` | (success with warning) |
| VIES returns invalid | Allow but no reverse charge | (success with warning) |
| ARES timeout | Allow without auto-fill | (success with warning) |
| Shipping method unavailable for address | Reject (list refresh) | `SHIPPING_METHOD_UNAVAILABLE`, 422 |
| Payment method unsupported for currency | Reject (filter list) | `PAYMENT_METHOD_UNSUPPORTED`, 422 |
| Confirm without consent | Reject | `CONSENT_REQUIRED`, 422 |
| Confirm without complete fields (missing email, address, ...) | Reject with field list | `CHECKOUT_INCOMPLETE`, 422 |
| Stock insufficient at confirm | Reject | `STOCK_INSUFFICIENT`, 422 (cart UI prompt customer to remove/reduce) |
| Price drift > threshold at confirm | Reject with new total | `PRICE_DRIFT`, 422 (UI shows new total, asks confirm) |
| Confirm duplicate (same Idempotency-Key) | Return cached response | (success or original error) |
| Confirm with different Idempotency-Key in authorizing state | Reject | `CONFLICT`, 409 |
| Payment declined (card) | Allow retry with different method | `PAYMENT_FAILED`, 422 |
| 3DS challenge timeout (15 min) | Mark intent cancelled, state → payment | `AUTH_TIMEOUT` |
| 3DS challenge cancelled by customer | Mark intent cancelled, state → payment | `AUTH_CANCELLED` |
| Backend crash mid-pipeline (after Tx commit, before payment response) | Reconcile job catches; either completes or compensates | (handled async) |
| Manual review approved while customer waiting | Customer's polling/SSE picks up state change | (handled) |
| Express checkout token invalid | Reject | `EXPRESS_PAY_INVALID_TOKEN`, 422 |
| Agent token spending limit exceeded | Reject | `AGENT_SPENDING_LIMIT_EXCEEDED`, 422 |
| Agent token expired | Reject | `AGENT_TOKEN_EXPIRED`, 401 |
| Buy Now flow but variant out of stock | Reject (cart not materialized) | `STOCK_INSUFFICIENT`, 422 |
| Customer tries to switch currency mid-checkout | Reject (must go back to cart) | `CURRENCY_LOCKED`, 422 |
| Checkout session expired during 3DS | Customer must restart from cart | `SESSION_EXPIRED`, 410 |
| Address validation service down | Allow continue with warning (no strict block) | (success with warning) |
| Shipping address P.O. Box for carrier that doesn't deliver to P.O. boxes | Reject method, filter list | (handled at shipping step) |
| B2B credit limit exceeded | Reject NET payment method, allow card | `CREDIT_LIMIT_EXCEEDED`, 422 |
| Cart modified during checkout (e.g., another tab) | Re-validate at next step; if changed, force re-review | (handled) |
| GDPR consent revoked mid-checkout | Allow continue but mark customer for follow-up consent re-prompt later | (handled) |

---

## 13. Performance

### 13.1 Targets

| Operation | p50 | p95 | p99 |
|---|---|---|---|
| `POST /checkouts` (initiate) | 50 ms | 150 ms | 300 ms |
| `GET /checkouts/{id}` | 15 ms | 40 ms | 100 ms |
| `PATCH /checkouts/{id}/addresses` (with address validation) | 100 ms | 400 ms | 1000 ms |
| `:shipping-rates` (calls shipping engine) | 80 ms | 250 ms | 600 ms |
| `PATCH /payment` (creates Stripe intent) | 200 ms | 600 ms | 1500 ms |
| `:confirm` (full pipeline) | 400 ms | 1200 ms | 3000 ms |
| `:confirm` (express, single call) | 600 ms | 1800 ms | 4000 ms |
| VIES lookup (external) | 500 ms | 1500 ms | 2900 ms (3s timeout) |
| ARES lookup (external) | 300 ms | 1000 ms | 2500 ms |

### 13.2 Optimization

- **Pre-warm shipping rates** when address set (background job triggers, customer sees instant rates list)
- **Cache VIES results** 24h in Redis
- **Cache ARES results** 7d in Redis
- **Payment intent reuse** — same intent ID reused across edit/refresh cycles (provider supports update)
- **Optimistic UI** — frontend can show cart totals before backend confirms (then reconcile)
- **Lazy shipping computation** — only when address set; not pre-emptively
- **Batched validation** — single API call validates address + computes tax + lists shipping in 1 round trip (admin-configurable composite endpoint)
- **DataLoader v GraphQL** for batched fields (customer, cart, etc.)

### 13.3 Hot path queries

```sql
-- Load checkout session with cart + items joined
SELECT cs.*, c.* AS cart, ci.* AS cart_item
FROM checkout_sessions cs
JOIN carts c ON cs.cart_id = c.id
JOIN cart_items ci ON c.id = ci.cart_id
WHERE cs.id = $1 AND cs.tenant_id = $2;
-- Uses idx_checkout_sessions_cart
```

```sql
-- Find pending reconcile candidates
SELECT id FROM checkout_sessions
WHERE state = 'authorizing'
  AND state_entered_at < now() - interval '5 minutes'
  AND payment_provider_intent_id IS NOT NULL
LIMIT 100;
```

### 13.4 Scaling

- Checkout session table — relatively small (1h TTL, low cardinality vs orders)
- Events table — partitioned monthly
- Reconciliation job — async, doesn't block customer paths
- Per-tenant rate limits prevent runaway costs

---

## 14. Security & compliance

### 14.1 Permissions

```
PERM-CHECKOUT-VIEW
PERM-CHECKOUT-ASSIST          # staff helps customer
PERM-CHECKOUT-REVIEW-APPROVE   # release manual review
PERM-CHECKOUT-POS              # POS terminal
PERM-CHECKOUT-AGENT-AUTHORIZE  # tenant-level toggle to allow agent checkout
```

### 14.2 PCI scope

Per [DEC-PAY-002](01-decisions-registry.md#dec-pay-002-pci-dss-scope):
- Card data NEVER touches our servers — tokenized via Stripe Elements / GoPay iframe
- We store only provider tokens (`pm_...`), `last4`, `brand`, no PAN
- Webhook signatures validated (HMAC-SHA256, anti-replay via timestamp)

### 14.3 GDPR

- `shipping_address_snapshot` + `billing_address_snapshot` = PII; included in customer export/delete
- Consent versions snapshot at time of acceptance (legal evidence)
- Anonymize `origin_ip_hash` after 90 days (configurable retention)
- Marketing consent default OFF (must explicit opt-in)

### 14.4 Fraud detection

- Risk score (0–100) computed pre-confirm
- Velocity tracking (multiple checkouts from same IP/device/email in short time)
- Disposable email domain check
- BIN check vs shipping country (card BIN → issuing country mismatch with ship country = signal)
- Device fingerprint (FingerprintJS or similar; opt-in for tenant)
- IP geolocation vs claimed country

### 14.5 Rate limits

| Endpoint | Anon | Auth Free | Auth Pro |
|---|---|---|---|
| `POST /checkouts` (initiate) | 10/min/IP | 30/min | 60/min |
| `PATCH /checkouts/*` mutations | 60/min/session | 60/min | 60/min |
| `POST /checkouts/{id}:confirm` | 5/min/session | 5/min | 10/min |
| `POST /express-checkouts` | 10/min/IP | 30/min | 60/min |
| Agent checkout | 10/hour per agent token | n/a | 100/hour |

### 14.6 Audit

- 100% audit log entries for: confirm, manual review approve/reject, staff assist, recovery email send, refund-impacting actions
- Checkout session events table = append-only audit
- Sensitive data masked in logs (no full card numbers, no full IP — hash only)

### 14.7 CSRF + bot prevention

- Storefront mutations require CSRF token (cookie session)
- CAPTCHA on initiate from suspicious IP (high velocity, known bad reputation)
- Rate limit per IP for initiate
- Honeypot fields in checkout forms (bot fills hidden field → reject)

---

## 15. Testing

### 15.1 Unit

```
TEST-UNIT-CHK-001  CheckoutStateMachine — valid transitions
TEST-UNIT-CHK-002  CheckoutStateMachine — invalid transitions rejected
TEST-UNIT-CHK-003  IdempotencyKeyHandler — replay returns cached
TEST-UNIT-CHK-004  PriceDriftDetector — threshold logic
TEST-UNIT-CHK-005  ConsentValidator — terms + privacy + GDPR required
TEST-UNIT-CHK-006  VatIdValidator — VIES response parser
TEST-UNIT-CHK-007  IcoChecksumValidator — modulo 11
TEST-UNIT-CHK-008  RiskScorer — signal aggregation
TEST-UNIT-CHK-009  CompensationHandler — order cancel + reservation release
TEST-UNIT-CHK-010  AddressSanitizer (trim, normalize postal codes)
```

### 15.2 Integration

```
TEST-INT-CHK-001  Initiate from active cart → session created
TEST-INT-CHK-002  Initiate from converted cart → reject
TEST-INT-CHK-003  Set address → tax computed
TEST-INT-CHK-004  Set shipping → total updated
TEST-INT-CHK-005  Set payment → Stripe intent created (mocked)
TEST-INT-CHK-006  VIES validation called (mocked)
TEST-INT-CHK-007  ARES validation called (mocked)
TEST-INT-CHK-008  Confirm success → order created, payment authorized
TEST-INT-CHK-009  Confirm with stock insufficient → 422, no order created
TEST-INT-CHK-010  Confirm with price drift > threshold → 422
TEST-INT-CHK-011  Confirm 3DS path → 202 + authentication_url, no order yet
TEST-INT-CHK-012  3DS success → order placed
TEST-INT-CHK-013  3DS timeout → state reverts to payment
TEST-INT-CHK-014  Confirm payment failed → order cancelled, stock released
TEST-INT-CHK-015  Idempotent confirm — second call returns cached
TEST-INT-CHK-016  Reconcile job catches orphaned authorizing → completes
TEST-INT-CHK-017  Abandon detection at 15 min → state=abandoned
TEST-INT-CHK-018  Recovery via signed token → state restored
TEST-INT-CHK-019  Manual review approve → continues to payment
TEST-INT-CHK-020  Manual review reject → order cancelled
TEST-INT-CHK-021  Express checkout single call → order placed
TEST-INT-CHK-022  Buy Now flow → ephemeral cart + order
TEST-INT-CHK-023  Agent checkout — spending limit enforced
TEST-INT-CHK-024  B2B checkout — NET 30 payment method, no immediate capture
TEST-INT-CHK-025  Concurrent confirm attempts (50 parallel, same idempotency_key) — exactly 1 order placed
```

### 15.3 E2E

```
TEST-E2E-CHK-001  Guest standard checkout (4 steps) → order placed
TEST-E2E-CHK-002  Logged-in checkout, saved address selection
TEST-E2E-CHK-003  3DS success path
TEST-E2E-CHK-004  3DS challenge cancelled → returns to payment
TEST-E2E-CHK-005  Apple Pay express checkout
TEST-E2E-CHK-006  Google Pay express checkout
TEST-E2E-CHK-007  B2B checkout with VAT ID and PO number
TEST-E2E-CHK-008  Buy Now from PDP
TEST-E2E-CHK-009  Abandoned checkout email recovery flow
TEST-E2E-CHK-010  Customer creates account during checkout
TEST-E2E-CHK-011  Stock changes mid-checkout — UI shows new state
TEST-E2E-CHK-012  Coupon applied at cart persists through checkout
TEST-E2E-CHK-013  Price drift handled — customer sees new price + accept
TEST-E2E-MCP-CHK-001  External agent via MCP performs checkout end-to-end
```

### 15.4 Load (k6)

```
TEST-LOAD-CHK-001  500 concurrent initiate → all complete < 1s p95
TEST-LOAD-CHK-002  100 concurrent confirm (different sessions) → all succeed, no deadlocks
TEST-LOAD-CHK-003  Black Friday simulation: 1000 cart adds + 100 confirms / sec for 5 min
TEST-LOAD-CHK-004  Abandoned cart sweep 100k sessions in < 5 min
```

### 15.5 Chaos

```
TEST-CHAOS-CHK-001  Backend crashes after Phase 2 commit, before Phase 3 — reconcile completes within 5 min
TEST-CHAOS-CHK-002  Stripe outage — circuit breaker opens, fallback to GoPay
TEST-CHAOS-CHK-003  VIES API timeout — checkout continues with warning
TEST-CHAOS-CHK-004  Postgres failover mid-confirm — Tx retried, no double-charge
TEST-CHAOS-CHK-005  Redis outage — Idempotency-Key cache miss → still processes, but duplicate detection weakened (relies on Tx-level uniqueness)
```

---

## 16. Implementation checklist

### Backend
- [ ] **[S]** Drizzle schema `packages/db/src/schema/checkout/*.ts`
- [ ] **[S]** Migrace `20260526_001_create_checkout_tables.sql`
- [ ] **[L]** `CheckoutService` core — initiate, get, all PATCH endpoints
- [ ] **[XL]** `OrderPlacementOrchestrator` — atomic pipeline (§6), saga compensation, reconcile
- [ ] **[M]** `CheckoutStateMachine` — explicit valid transitions, guards
- [ ] **[M]** `AddressValidator` — country, postal, autocomplete provider integration
- [ ] **[M]** `VatIdValidator` (VIES) — sync with timeout, cache
- [ ] **[M]** `IcoValidator` (ARES) — checksum + remote lookup, cache
- [ ] **[M]** `ConsentValidator`
- [ ] **[L]** `RiskScorer` — signal aggregation, threshold actions
- [ ] **[M]** `ExpressCheckoutService` — Apple/Google Pay token handling
- [ ] **[M]** `BuyNowService` — ephemeral cart materialization
- [ ] **[L]** `AgentCheckoutService` — token validation, spending limits, audit
- [ ] **[M]** REST endpoints per §7
- [ ] **[M]** GraphQL types + resolvers
- [ ] **[S]** tRPC router (admin)
- [ ] **[M]** MCP tools `checkout.initiate`, `checkout.confirm`
- [ ] **[M]** Reconciliation worker (`JOB-RECONCILE-CHECKOUT-PROVIDER-STATE`)

### Background jobs
- [ ] **[M]** JOB-EXPIRE-CHECKOUT-SESSIONS
- [ ] **[M]** JOB-DETECT-ABANDONED-CHECKOUTS
- [ ] **[L]** JOB-RECONCILE-CHECKOUT-PROVIDER-STATE
- [ ] **[M]** JOB-SEND-CHECKOUT-RECOVERY-EMAIL (staged)
- [ ] **[S]** JOB-CLEANUP-CHECKOUT-RECOVERY-TOKENS
- [ ] **[S]** JOB-VALIDATE-VAT-IDS-PENDING
- [ ] **[M]** JOB-FRAUD-RESCORE-PENDING
- [ ] **[S]** JOB-PROCESS-MANUAL-REVIEW-QUEUE (UI-driven)
- [ ] **[S]** JOB-CHECKOUT-ANALYTICS-DAILY
- [ ] **[S]** JOB-CLEANUP-EXPIRED-SESSIONS
- [ ] **[S]** JOB-NOTIFY-AGENT-ORDER-RESULT

### Frontend — Admin
- [ ] **[M]** Checkout sessions list (filter by state, abandoned, value, risk)
- [ ] **[M]** Checkout session detail (timeline, snapshot, actions)
- [ ] **[M]** Manual review queue with approve/reject UI
- [ ] **[M]** Staff assist UI ("place on behalf of customer")
- [ ] **[S]** Recovery email manual trigger
- [ ] **[S]** Abandonment analytics dashboard
- [ ] **[S]** Risk score distribution + tuning

### Frontend — Storefront
- [ ] **[XL]** Multi-step checkout UI (4 steps + review)
- [ ] **[M]** One-page checkout (theme variant)
- [ ] **[M]** Address form with autocomplete + validation
- [ ] **[M]** Shipping methods picker (with pickup-point widget)
- [ ] **[L]** Payment methods picker (Stripe Element, GoPay iframe, bank transfer info, COD)
- [ ] **[S]** Apple Pay button (with feature-detect)
- [ ] **[S]** Google Pay button
- [ ] **[M]** Buy Now button on PDP
- [ ] **[M]** Review step with edit links
- [ ] **[M]** Confirm button + loading state + error handling
- [ ] **[M]** 3DS handler (iframe or redirect)
- [ ] **[S]** Thank-you page
- [ ] **[S]** Resume checkout from recovery URL
- [ ] **[S]** Order status polling page (for manual review or 3DS in progress)
- [ ] **[S]** B2B VAT ID + PO number fields (conditional)
- [ ] **[S]** Marketing opt-in checkbox

### Tests
- [ ] **[M]** Per §15 (unit + integration + E2E + load + chaos)
- [ ] **[M]** Mock VIES + ARES for CI

### Docs
- [ ] **[S]** "Customizing your checkout" merchant guide
- [ ] **[S]** "Express payment setup" merchant guide
- [ ] **[S]** "Manual review workflows" admin guide
- [ ] **[S]** "B2B checkout configuration" guide
- [ ] **[S]** Developer: "Checkout extension points" (plugin hooks)
- [ ] **[S]** Developer: "Agent checkout via MCP" integration guide
- [ ] **[S]** Customer-facing: "What to expect during checkout" help article

---

## 17. Open questions

### Q-CHK-001: Multi-currency at checkout
**Otázka:** Block currency switch at checkout (RULE-CHK-025) — UX friction or smart safety?

**Status:** MVP locks currency at checkout entry; v1.0+ may relax with explicit "restart with different currency" flow.

### Q-CHK-002: Address autocomplete provider
**Otázka:** Mapy.cz (free for CZ/SK), Google Address Validation API ($$$), or self-hosted (OSM-based)?

**Status:** Pluggable provider. Default Mapy.cz for CZ/SK; Google for global; merchant configurable. Per `29-integrations.md`.

### Q-CHK-003: Save card during checkout
**Otázka:** Default "save for future use" checkbox state?

**Status:** Default OFF (GDPR-friendly). Per tenant configurable.

### Q-CHK-004: Express checkout 3DS handling
**Otázka:** Apple Pay typically bypasses 3DS due to biometric; what about Google Pay edge cases requiring 3DS?

**Status:** Provider handles natively. We pass through `requires_action` if returned.

### Q-CHK-005: B2B credit terms automation
**Otázka:** Auto-approve NET 30 for established customers vs require credit application?

**Status:** Configurable per company. Default: existing company with positive credit history → auto; new company → manual review. Detail in `21-b2b-complete.md`.

### Q-CHK-006: Tax estimate before address
**Otázka:** Cart page shows "estimated tax" — based on what country? Tenant default or IP geo?

**Status:** Tenant default country (configurable); IP geo as fine-tune hint (with consent). Final tax computed at checkout when address set.

### Q-CHK-007: Agent purchase notifications
**Otázka:** When AI agent places order on behalf of customer, when does customer get notified? Real-time SMS? Email after fact?

**Status:** Configurable per agent token. Default: email confirmation immediately (no SMS by default). Agent token settings include `notification_kind`.

### Q-CHK-008: Recovery email content per stage
**Otázka:** Stage 1 (1h): just reminder. Stage 2 (24h): include incentive? Stage 3 (72h): bigger incentive?

**Status:** Default templates included; merchant can configure incentives per stage. Marketing automation module (`19-marketing-seo.md`) handles.

### Q-CHK-009: Mobile vs desktop checkout flows
**Otázka:** Same multi-step on both, or mobile-specific single-page?

**Status:** Responsive single codebase; mobile uses sticky CTAs + accordion sections. One-page option preferred for mobile. Theme customizable.

### Q-CHK-010: A/B testing checkout
**Otázka:** Built-in A/B testing for checkout variants (4-step vs 1-page)?

**Status:** v2.0+ feature. MVP: theme-level only (merchant picks one).

### Q-CHK-011: Subscription products at checkout
**Otázka:** Mixed subscription + one-time items in same cart → how at checkout?

**Status:** v2.0+ when subscriptions launch. Initial payment captured for both; recurring billing setup post-placement. Detail in `24-subscriptions.md`.

### Q-CHK-012: Marketplace seller in same checkout
**Otázka:** Cart with items from multiple sellers (marketplace mode) → single checkout?

**Status:** Fáze 4 marketplace feature. Single checkout, payment split via Stripe Connect or similar. Detail in `25-marketplace.md`.

### Q-CHK-013: Checkout for digital goods
**Otázka:** No shipping step for all-digital cart?

**Status:** Skip shipping step automatically when cart has no `requires_shipping` items. Show "Delivery" step instead (where to send digital link).

### Q-CHK-014: Bank transfer checkout
**Otázka:** Customer chooses bank transfer; order created in `pending` state until manual reconciliation?

**Status:** Yes. Order placed at confirm with `payment_status='pending'`. Customer receives bank details + reference. Manual reconciliation (or automated CSV import from bank statement, Fáze 2) marks payment as captured later.

### Q-CHK-015: Cash on Delivery (COD)
**Otázka:** Order placed without payment; payment captured by carrier at delivery?

**Status:** Standard CZ/SK pattern. `payment_status='pending'`, fulfillment proceeds, carrier integration reports COD collected → payment.status='captured' via webhook.

### Q-CHK-016: Gift card-only checkout
**Otázka:** Cart total < gift card balance → no payment method needed?

**Status:** Yes. `payment_method_kind='gift_card_only'`, no provider intent created. Order placed with gift_card transaction only.

### Q-CHK-017: Order edit window
**Otázka:** Customer placed order 5 min ago, wants to add item or cancel — within window or not?

**Status:** Out of scope here (post-placement order edit). Detail in `16-order-management.md`. Checkout is one-shot.

---

## 📅 Změny

| Datum | Změna |
|---|---|
| 2026-05-19 | Initial — Checkout domain. Multi-step + express + B2B + agent flows, atomic order placement pipeline with saga compensation, 3DS orchestration, VIES/ARES validations, fraud risk scoring. |

---

**Konec Checkout.**

➡️ Phase 2 (Core Catalog & Commerce) **kompletní**. Pokračovat na: [`13-payments.md`](13-payments.md) (Phase 3: Transactions & Fulfillment).
