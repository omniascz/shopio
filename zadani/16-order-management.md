# 16 – ORDER MANAGEMENT

> **Doména:** Lifecycle objednávky od placement (z `12-checkout.md`) po completed. Centrální koordinátor mezi cart, payments, shipping, tax, returns. Order entity je **immutable snapshot** ekonomického vztahu; status fields mutují. Append-only transitions ledger.

**Datum:** 2026-05-19
**Verze:** 1.0
**Status:** 🟡 DESIGN
**Reference:** [03 §9](03-data-models-master.md#9-orders-payments-shipments) · [12-checkout.md](12-checkout.md) · [13-payments.md](13-payments.md) · [14-shipping.md](14-shipping.md) · [15-tax-compliance.md](15-tax-compliance.md) · [17-returns-refunds.md](17-returns-refunds.md)

---

## 📑 Obsah

0. [Domain overview](#0-domain-overview)
1. [References](#1-references)
2. [Personas](#2-personas)
3. [Data models](#3-data-models)
4. [State machines](#4-state-machines)
5. [Business rules](#5-business-rules)
6. [REST API endpoints](#6-rest-api-endpoints)
7. [GraphQL schema](#7-graphql-schema)
8. [Events](#8-events)
9. [Background jobs](#9-background-jobs)
10. [UI/UX flows](#10-uiux-flows)
11. [Edge cases & error handling](#11-edge-cases--error-handling)
12. [Performance](#12-performance)
13. [Security](#13-security)
14. [Testing](#14-testing)
15. [Implementation checklist](#15-implementation-checklist)
16. [Open questions](#16-open-questions)

---

## 0. Domain overview

### 0.1 Co tato doména **je**

- **Order** — immutable snapshot ekonomického vztahu mezi merchantem a customerem; obsahuje line items, totals, addresses, applied promotions, tax breakdown — všechno **snapshot z času placement**
- **Order status** — agregovaný high-level stav (`pending`, `confirmed`, `processing`, `fulfilled`, `completed`, `cancelled`, `refunded`)
- **Payment status** — odvozený / synced z `payments` rows (per `13`)
- **Fulfillment status** — odvozený / synced z `shipments` rows (per `14`)
- **Order transitions** — append-only audit trail každé status změny (`order_transitions`)
- **Order events** — customer-visible timeline ("Vaše objednávka byla potvrzena", "Zboží odesláno...") — separátní od audit log
- **Admin editing** — limited: cancel, refund, adjust line item qty (creates compensating entry), add notes, manual transitions
- **Multi-shipment** — order může mít N shipments (partial fulfillment, multi-warehouse — viz `14`)
- **Risk scoring** — fraud signal aggregate (z checkout + post-placement signals)
- **Source tracking** — `storefront`, `pos`, `admin`, `api`, `agent` (per checkout)
- **Bulk operations** — admin bulk cancel, bulk fulfill, bulk export
- **Order search** — searchable index (number, customer email, sku, ...), fast filter
- **Customer-facing order view** — "Moje objednávky" page, tracking links, invoices, returns initiation
- **Order recovery** — recover lost-but-paid orders (saga compensation completion from `12`)
- **Notes** — customer note (z checkout) + staff notes (internal)
- **Tags** — admin tagging pro workflow (VIP, problematic, gift)
- **Auto-cancel rules** — unpaid bank transfer > 7d, COD failed delivery, ...
- **Order edits with audit** — limited mutations track who/what/why

### 0.2 Co tato doména **NENÍ**

- ❌ Cart (→ `11-cart.md`)
- ❌ Checkout flow (→ `12-checkout.md`)
- ❌ Payment processing (→ `13-payments.md`) — order has `payment_status` but doesn't own payment lifecycle
- ❌ Shipping carrier APIs (→ `14-shipping.md`)
- ❌ Invoice generation (→ `15-tax-compliance.md`)
- ❌ Returns workflow (→ `17-returns-refunds.md`)
- ❌ Customer profile (→ `18-customer-management.md`)
- ❌ Marketing automation (abandoned cart, post-purchase) (→ `19-marketing-seo.md`)
- ❌ Analytics dashboards (→ `20-analytics-reporting.md`)
- ❌ B2B quote workflow (→ `21-b2b-complete.md`)
- ❌ Subscription recurring orders (→ `24-subscriptions.md`)

### 0.3 Diferenciátory

1. **HPOS-inspired flat schema** — žádné EAV polymorfismy; query performance optimized (per [03 §9 RULE](03-data-models-master.md#9-orders-payments-shipments))
2. **Order immutability** — snapshot at placement, never UPDATE on line items / amounts; corrections via compensating records
3. **Append-only transitions** — perfect audit trail; replayable to reconstruct history
4. **Customer-visible timeline** — separate from audit log; rich events with descriptions for storefront UI
5. **Cross-domain coordinator** — synthesizes payment_status (from 13) + fulfillment_status (from 14) into order_status without owning either
6. **Idempotent order placement** — re-running placement with same Idempotency-Key returns existing order (per `12`)
7. **MCP agent-native** — agent can `order.get_status`, `order.list_my_orders` for AI shopping concierge

---

## 1. References

- [03 §9](03-data-models-master.md#9-orders-payments-shipments) — ENT-ORDER-001 až ENT-INVOICE-001
- [11-cart.md](11-cart.md) — cart → checkout → order handoff
- [12-checkout.md](12-checkout.md) — order placement pipeline (saga)
- [13-payments.md](13-payments.md) — `payment_status` derivation
- [14-shipping.md](14-shipping.md) — `fulfillment_status` derivation; shipments
- [15-tax-compliance.md](15-tax-compliance.md) — invoice issuance triggered from EVENT-ORDER-PAID
- [17-returns-refunds.md](17-returns-refunds.md) — RMA workflow
- [18-customer-management.md](18-customer-management.md) — customer record
- [20-analytics-reporting.md](20-analytics-reporting.md) — order metrics
- [21-b2b-complete.md](21-b2b-complete.md) — B2B-specific PO handling
- [24-subscriptions.md](24-subscriptions.md) — subscription orders link
- [25-marketplace.md](25-marketplace.md) — marketplace seller routing (Fáze 4)
- [30-security.md](30-security.md) — fraud signal extension
- [DEC-EVENTS-001](01-decisions-registry.md#dec-events-001-event-bus--background-jobs) — outbox pattern

---

## 2. Personas

| Persona | Použití | Klíčové permissions |
|---|---|---|
| `PERSONA-MERCHANT-OWNER` | Full control over orders | `PERM-ORDER-*` |
| `PERSONA-FULFILLMENT-MANAGER` | View, mark fulfilled, generate labels | `PERM-ORDER-VIEW`, `PERM-ORDER-FULFILL`, `PERM-SHIPMENT-MANAGE` |
| `PERSONA-WAREHOUSE-STAFF` | View today's orders, mark picked/packed | `PERM-ORDER-VIEW`, `PERM-ORDER-FULFILL` |
| `PERSONA-CUSTOMER-SERVICE` | View, edit address, add notes, cancel, refund (capped) | `PERM-ORDER-VIEW`, `PERM-ORDER-EDIT`, `PERM-ORDER-CANCEL`, `PERM-PAYMENT-REFUND` |
| `PERSONA-FINANCE-MANAGER` | View financials, reports, ledger | `PERM-ORDER-VIEW`, `PERM-ORDER-FINANCIAL-REPORT` |
| `PERSONA-MERCHANT-VIEWER` | Read-only access | `PERM-ORDER-VIEW` |
| `PERSONA-CUSTOMER` | View own orders, track shipments, initiate returns | Auth-gated to own customer_id |
| `PERSONA-GUEST` | View order via guest token (from order confirmation email) | Token-gated |
| `PERSONA-B2B-EMPLOYEE` | View company orders, request quote conversions | Auth + company context |
| `PERSONA-AI-COPILOT` | Suggest order tags, anomaly detection, customer service drafts | `agent:order:read`, `agent:order:annotate` |
| `PERSONA-EXTERNAL-AGENT` | MCP `order.get_status`, `order.list_my_orders` | `agent:order:read` (per agent token customer_id scope) |

---

## 3. Data models

### 3.1 `orders` ([ENT-ORDER-001](03-data-models-master.md#ent-order-001))

```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  pub_id TEXT NOT NULL,                                         -- ord_ NanoID
  number TEXT NOT NULL,                                          -- "ORD-2026-00001234" per tenant per year
  -- identity
  customer_id UUID NULL REFERENCES customers(id),                 -- NULL = guest order
  email CITEXT NOT NULL,                                          -- snapshot (mandatory even for guests)
  phone TEXT NULL,
  company_id UUID NULL REFERENCES companies(id),                   -- B2B context
  customer_group_id UUID NULL REFERENCES customer_groups(id),      -- snapshot
  -- channel / source
  channel_id UUID NULL REFERENCES channels(id),
  store_id UUID NULL REFERENCES stores(id),
  source TEXT NOT NULL CHECK (source IN ('storefront','pos','admin','api','agent','marketplace','imported','recurring')) DEFAULT 'storefront',
  source_user_id UUID NULL REFERENCES users(id),                   -- pro 'admin' staff-placed
  source_agent_token_id UUID NULL,                                  -- pro 'agent'
  -- aggregated status
  status TEXT NOT NULL CHECK (status IN (
    'pending','confirmed','processing','fulfilled','completed','cancelled','refunded','partially_refunded','on_hold','failed'
  )) DEFAULT 'pending',
  payment_status TEXT NOT NULL CHECK (payment_status IN (
    'pending','authorized','partially_paid','paid','partially_refunded','refunded','failed','voided'
  )) DEFAULT 'pending',
  fulfillment_status TEXT NOT NULL CHECK (fulfillment_status IN (
    'unfulfilled','partially_fulfilled','fulfilled','returned','partially_returned'
  )) DEFAULT 'unfulfilled',
  -- timestamps
  placed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ NULL,                                    -- payment authorized; can be processed
  processing_started_at TIMESTAMPTZ NULL,
  fulfilled_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,                                     -- terminal success
  cancelled_at TIMESTAMPTZ NULL,
  cancel_reason TEXT NULL,
  cancel_reason_code TEXT NULL CHECK (cancel_reason_code IN (
    'customer_request','payment_failed','stock_unavailable','fraud',
    'incorrect_address','duplicate','merchant_decision','timeout_bank_transfer',
    'cod_returned','manual_other'
  ) OR cancel_reason_code IS NULL),
  cancelled_by_actor_kind TEXT NULL,
  cancelled_by_actor_id UUID NULL,
  on_hold_reason TEXT NULL,
  -- currency
  currency CHAR(3) NOT NULL,
  -- amounts (snapshot, never UPDATE)
  subtotal_amount BIGINT NOT NULL,
  discount_amount BIGINT NOT NULL DEFAULT 0,
  shipping_amount BIGINT NOT NULL DEFAULT 0,
  shipping_discount_amount BIGINT NOT NULL DEFAULT 0,
  tax_amount BIGINT NOT NULL,
  total_amount BIGINT NOT NULL,
  rounding_adjustment_amount BIGINT NOT NULL DEFAULT 0,
  gift_card_redeemed_amount BIGINT NOT NULL DEFAULT 0,
  paid_amount BIGINT NOT NULL DEFAULT 0,                             -- running total, derived from payments
  refunded_amount BIGINT NOT NULL DEFAULT 0,                          -- running total, derived from refunds
  -- snapshots (immutable JSON)
  shipping_address_snapshot JSONB NOT NULL,
  billing_address_snapshot JSONB NOT NULL,
  tax_breakdown JSONB NOT NULL,                                       -- [{ class, rate, base, tax }, ...]
  applied_coupons TEXT[] NOT NULL DEFAULT '{}',
  applied_discounts JSONB NOT NULL DEFAULT '[]'::jsonb,                -- snapshot from pricing engine
  applied_gift_card_ids UUID[] NOT NULL DEFAULT '{}',
  price_list_id_chain UUID[] NOT NULL DEFAULT '{}',                    -- snapshot of resolved chain
  -- B2B context
  vat_id_provided TEXT NULL,
  vat_reverse_charge_applied BOOLEAN NOT NULL DEFAULT false,
  ico_provided TEXT NULL,
  purchase_order_number TEXT NULL,
  payment_terms_days INTEGER NULL,
  -- shipping intent
  selected_shipping_method_id UUID NULL,                                -- snapshot
  selected_shipping_method_snapshot JSONB NULL,
  selected_pickup_point_id UUID NULL,
  delivery_instructions TEXT NULL,
  preferred_delivery_date DATE NULL,
  -- notes
  customer_note TEXT NULL,
  staff_note TEXT NULL,
  -- tags
  tags TEXT[] NOT NULL DEFAULT '{}',
  -- risk
  risk_score INTEGER NULL,                                              -- 0-100 from checkout
  risk_signals JSONB NULL,
  is_high_risk BOOLEAN NOT NULL DEFAULT false,
  -- locale
  locale TEXT NOT NULL,
  -- linked records
  cart_id UUID NULL REFERENCES carts(id),                                -- source cart
  checkout_session_id UUID NULL REFERENCES checkout_sessions(id),         -- source session
  parent_order_id UUID NULL REFERENCES orders(id),                         -- pro recurring (next charge) v subscriptions
  related_order_ids UUID[] NOT NULL DEFAULT '{}',                          -- exchanges, group orders, ...
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_orders_tenant_pub_id UNIQUE (tenant_id, pub_id),
  CONSTRAINT uq_orders_tenant_number UNIQUE (tenant_id, number),
  CONSTRAINT ck_totals_non_negative CHECK (
    subtotal_amount >= 0 AND tax_amount >= 0 AND
    total_amount >= 0 AND paid_amount >= 0 AND refunded_amount >= 0
  ),
  CONSTRAINT ck_refunded_le_paid CHECK (refunded_amount <= paid_amount + 0),  -- soft check; actual logic in app
  CONSTRAINT ck_cancel_reason CHECK (
    (status NOT IN ('cancelled') OR cancel_reason_code IS NOT NULL)
  )
);

CREATE INDEX idx_orders_customer ON orders (customer_id, placed_at DESC) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_orders_email ON orders (tenant_id, email);
CREATE INDEX idx_orders_status_period ON orders (tenant_id, status, placed_at DESC);
CREATE INDEX idx_orders_payment_status ON orders (tenant_id, payment_status, placed_at DESC);
CREATE INDEX idx_orders_fulfillment_status ON orders (tenant_id, fulfillment_status, placed_at DESC);
CREATE INDEX idx_orders_number ON orders (tenant_id, number);
CREATE INDEX idx_orders_placed_at_brin ON orders USING BRIN (placed_at);
CREATE INDEX idx_orders_high_risk ON orders (tenant_id, placed_at DESC) WHERE is_high_risk = true;
CREATE INDEX idx_orders_tags_gin ON orders USING GIN (tags);
CREATE INDEX idx_orders_company ON orders (company_id, placed_at DESC) WHERE company_id IS NOT NULL;
CREATE INDEX idx_orders_channel ON orders (channel_id, placed_at DESC) WHERE channel_id IS NOT NULL;
CREATE INDEX idx_orders_unpaid_old ON orders (tenant_id, placed_at) WHERE payment_status IN ('pending','authorized','partially_paid') AND status NOT IN ('cancelled','completed');
```

### 3.2 `order_items` ([ENT-ORDER-ITEM-001](03-data-models-master.md#ent-order-item-001))

Immutable snapshots from cart at placement.

```sql
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  -- references
  variant_id UUID NULL REFERENCES product_variants(id),                  -- nullable to allow deletion of variant later
  product_id UUID NULL REFERENCES products(id),
  -- snapshots
  sku TEXT NOT NULL,
  barcode TEXT NULL,
  title TEXT NOT NULL,
  variant_title TEXT NULL,
  primary_image_url TEXT NULL,
  vendor_name TEXT NULL,
  brand_name TEXT NULL,
  category_path TEXT NULL,                                                -- primary category at placement
  -- pricing snapshot
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_amount BIGINT NOT NULL,
  unit_price_currency CHAR(3) NOT NULL,
  compare_at_amount BIGINT NULL,
  subtotal_before_discount BIGINT NOT NULL,                                -- unit_price × quantity
  discount_amount BIGINT NOT NULL DEFAULT 0,
  discount_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- tax snapshot
  tax_class_code TEXT NULL,
  tax_rate_basis_points INTEGER NOT NULL,
  tax_amount BIGINT NOT NULL,
  is_reverse_charge BOOLEAN NOT NULL DEFAULT false,
  -- shipping
  weight_grams INTEGER NULL,
  requires_shipping BOOLEAN NOT NULL DEFAULT true,
  -- bundle
  bundle_parent_item_id UUID NULL REFERENCES order_items(id),
  is_bundle_child BOOLEAN NOT NULL DEFAULT false,
  -- gift / customization snapshot
  gift_message TEXT NULL,
  customization JSONB NULL,
  -- digital fulfillment
  digital_delivery_url TEXT NULL,                                          -- for digital goods, post-fulfillment
  digital_delivery_expires_at TIMESTAMPTZ NULL,
  -- fulfillment tracking (per-line counters)
  quantity_fulfilled INTEGER NOT NULL DEFAULT 0,
  quantity_returned INTEGER NOT NULL DEFAULT 0,
  quantity_cancelled INTEGER NOT NULL DEFAULT 0,                            -- partial cancel
  -- totals
  total_amount BIGINT NOT NULL,                                              -- subtotal - discount + tax (or - for reverse charge)
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT ck_fulfilled_le_quantity CHECK (quantity_fulfilled <= quantity),
  CONSTRAINT ck_returned_le_fulfilled CHECK (quantity_returned <= quantity_fulfilled)
);

CREATE INDEX idx_order_items_order ON order_items (order_id, position);
CREATE INDEX idx_order_items_variant ON order_items (variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX idx_order_items_sku ON order_items (tenant_id, sku);
```

### 3.3 `order_transitions` ([ENT-ORDER-TRANSITION-001](03-data-models-master.md#ent-order-transition-001))

Append-only audit ledger of every status change.

```sql
CREATE TABLE order_transitions (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  transition_kind TEXT NOT NULL CHECK (transition_kind IN (
    'status','payment_status','fulfillment_status','on_hold','manual_override'
  )),
  from_value TEXT NULL,
  to_value TEXT NOT NULL,
  reason TEXT NULL,
  reason_code TEXT NULL,
  notes TEXT NULL,
  actor_kind TEXT NOT NULL CHECK (actor_kind IN ('user','customer','system','agent','webhook','integration')),
  actor_id UUID NULL,
  related_entity_type TEXT NULL,                                           -- e.g., 'payment','shipment','refund'
  related_entity_id UUID NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
) PARTITION BY RANGE (occurred_at);

CREATE INDEX idx_order_transitions_order ON order_transitions (order_id, occurred_at DESC);
CREATE INDEX brin_order_transitions_occurred_at ON order_transitions USING BRIN (occurred_at);
```

### 3.4 `order_events` ([ENT-ORDER-EVENT-001](03-data-models-master.md#ent-order-event-001))

Customer-visible timeline (storefront "Where is my order").

```sql
CREATE TABLE order_events (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN (
    'placed','confirmed','payment_received','payment_failed',
    'on_hold','hold_lifted','cancelled',
    'shipped','partially_shipped','out_for_delivery','delivered','collected',
    'failed_delivery','returned',
    'invoice_issued','refund_issued','partial_refund_issued',
    'note_from_merchant','custom'
  )),
  is_customer_visible BOOLEAN NOT NULL DEFAULT true,
  title TEXT NOT NULL,                                                      -- "Vaše objednávka byla potvrzena"
  description TEXT NULL,                                                     -- longer text
  related_entity_type TEXT NULL,
  related_entity_id UUID NULL,
  customer_facing_link TEXT NULL,                                            -- tracking URL, invoice URL, etc.
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
) PARTITION BY RANGE (occurred_at);

CREATE INDEX idx_order_events_order ON order_events (order_id, occurred_at DESC);
CREATE INDEX idx_order_events_customer_visible ON order_events (order_id, is_customer_visible, occurred_at DESC);
CREATE INDEX brin_order_events_occurred_at ON order_events USING BRIN (occurred_at);
```

### 3.5 `order_number_sequences`

Atomic sequence allocation per (tenant, year). Reset yearly (CZ convention).

```sql
CREATE TABLE order_number_sequences (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  sequence_code TEXT NOT NULL DEFAULT 'ORD',
  year INTEGER NOT NULL,
  current_position INTEGER NOT NULL DEFAULT 0,
  format_pattern TEXT NOT NULL DEFAULT '{code}-{year}-{position:08d}',
  reset_strategy TEXT NOT NULL CHECK (reset_strategy IN ('yearly','monthly','never')) DEFAULT 'yearly',
  is_active BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT uq_order_number_sequences UNIQUE (tenant_id, sequence_code, year)
);
```

### 3.6 `order_tags_catalog` *(curated tag list for admin convenience)*

```sql
CREATE TABLE order_tags_catalog (
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  tag TEXT NOT NULL,
  color TEXT NULL,                                                            -- hex for UI
  description TEXT NULL,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (tenant_id, tag)
);
```

### 3.7 `order_holds`

Reason-tagged on-hold states (multiple holds may overlap; order on_hold while any active).

```sql
CREATE TABLE order_holds (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('fraud_review','manual','stock_unavailable','payment_pending','b2b_credit_check','high_risk','custom')),
  notes TEXT NULL,
  created_by_actor_kind TEXT NOT NULL,
  created_by_actor_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_at TIMESTAMPTZ NULL,
  released_by_actor_kind TEXT NULL,
  released_by_actor_id UUID NULL,
  release_notes TEXT NULL
);

CREATE INDEX idx_order_holds_active ON order_holds (order_id) WHERE released_at IS NULL;
```

### 3.8 Vztahy

```
tenants (1)──(N) orders
customers (0..1)──(N) orders                  [guest order = NULL]
companies (0..1)──(N) orders                  [B2B]
channels (0..1)──(N) orders
stores (0..1)──(N) orders
carts (0..1)──(1) orders                      [via converted_to_order_id]
checkout_sessions (0..1)──(1) orders          [via order_id]
orders (1)──(N) order_items
orders (1)──(N) order_transitions
orders (1)──(N) order_events
orders (1)──(N) payments                      [from `13`]
orders (1)──(N) refunds                       [from `13`]
orders (1)──(N) shipments                     [from `14`]
orders (1)──(N) invoices                      [from `15`]
orders (1)──(N) returns                       [from `17`]
orders (1)──(N) order_holds
orders (0..1)──(1) orders                     [parent_order for subscription children]
```

---

## 4. State machines

### 4.1 Order status (aggregate)

Order status is **derived** from payment_status + fulfillment_status + manual overrides. Engine recomputes on any sub-status change.

```
       ┌───────────────────────────────────────────────┐
       │                                               │
       ▼                                               │
  [pending] ─── confirm (payment authorized) ──▶ [confirmed]
       │                                               │
       │ cancel                                        │ start fulfillment
       │                                               ▼
       ▼                                          [processing]
  [cancelled]                                          │
       ▲                                               │ shipments delivered
       │                                               ▼
       │                                          [fulfilled]
       │                                               │
       │                                               │ post-delivery period ends or all good
       │                                               ▼
       │                                          [completed]
       │                                               │
       │                                               │ refund issued
       │                                               ▼
       │                                          [refunded] / [partially_refunded]
       │                                               │
       │   any non-terminal can be put on_hold ────────┘ (returns to previous after release)
       │
       └─── failed (payment failed, stock_unavailable, ...) ── terminal
```

**Status derivation algorithm:**

```
def deriveOrderStatus(order):
  if order.cancelled_at:
    return 'cancelled'
  
  if hasActiveOnHold(order):
    return 'on_hold'
  
  payment = order.payment_status
  fulfillment = order.fulfillment_status
  
  # Failure
  if payment == 'failed' and not order.has_successful_payment_attempt:
    return 'failed'
  
  # Refunds
  if order.refunded_amount >= order.paid_amount and order.paid_amount > 0:
    return 'refunded'
  if order.refunded_amount > 0:
    return 'partially_refunded'
  
  # Active flow
  if payment == 'pending':
    return 'pending'
  if payment in ('authorized', 'partially_paid', 'paid'):
    if fulfillment == 'unfulfilled':
      return 'confirmed'  # payment OK, awaiting fulfillment
    if fulfillment == 'partially_fulfilled':
      return 'processing'
    if fulfillment == 'fulfilled':
      # Either fully delivered or merchant marked complete
      return 'completed' if order.completed_at else 'fulfilled'
  
  return 'pending'  # default fallback
```

### 4.2 Payment status

Owned by `13-payments.md` but reflected here. Possible:
- `pending`
- `authorized` — payment authorized but not yet captured (Stripe pre-auth, or COD initial)
- `partially_paid` — multiple payments, some captured
- `paid` — fully paid
- `partially_refunded`
- `refunded`
- `failed`
- `voided`

**Sync trigger:** `EVENT-PAYMENT-*` events from `13` → recompute order.payment_status from sum of related payments.

### 4.3 Fulfillment status

Owned by `14-shipping.md` but reflected here. Possible:
- `unfulfilled` — no shipments yet
- `partially_fulfilled` — some line items shipped (qty < total)
- `fulfilled` — all items shipped
- `returned` — all fulfilled items returned
- `partially_returned` — some returned

**Sync trigger:** `EVENT-SHIPMENT-*` events from `14` → recompute order.fulfillment_status from `order_items.quantity_fulfilled` aggregation.

### 4.4 Allowed transitions

| From | Event | To | Trigger |
|---|---|---|---|
| `pending` | payment authorized | `confirmed` | EVENT-PAYMENT-AUTHORIZED / CAPTURED |
| `confirmed` | start fulfillment | `processing` | First shipment created OR first item fulfilled |
| `confirmed` / `processing` | all shipments delivered | `fulfilled` | All items quantity_fulfilled = quantity |
| `fulfilled` | grace period ends OR merchant marks | `completed` | Configurable (e.g., 30 days post-delivery, or admin action) |
| `confirmed` / `processing` | refund issued for all | `refunded` | refunded_amount ≥ paid_amount |
| `confirmed` / `processing` / `fulfilled` | partial refund | `partially_refunded` | refunded_amount > 0 < paid_amount |
| any non-terminal | put on hold | `on_hold` | manual or fraud trigger |
| `on_hold` | hold released | (previous derived) | All holds released |
| any non-terminal | cancel | `cancelled` | manual / system (timeout, payment_failed) |
| `pending` | payment failed | `failed` | EVENT-PAYMENT-FAILED + no retry |

### 4.5 Cancellation policy by phase

```
pending          → free to cancel (no fulfillment started)
confirmed        → cancel + refund/void payment + release inventory reservations
processing       → cancel pre-shipment + refund + release inventory; post-shipment requires return flow
fulfilled        → cannot cancel directly; must use returns workflow (17)
completed        → cannot cancel; only returns workflow within window
cancelled        → terminal
refunded         → terminal
on_hold          → cancel possible; original-phase cancellation rules apply post-hold lift
```

### 4.6 Auto-cancellation triggers

| Trigger | Condition |
|---|---|
| Bank transfer timeout | payment_status='pending' AND payment_method='bank_transfer' AND placed_at < now() - 7 days |
| COD returned-to-sender | EVENT-SHIPMENT-RETURNED-TO-SENDER + payment_method='cod' (configurable per merchant) |
| Stock unavailable | placement-time stock check fails (handled in `12`) — order never reaches confirmed |
| Failed payment retry exhausted | payment_status='failed' after 3 retry attempts OR 24h without retry |
| Fraud review rejected | manual admin action while on_hold |

---

## 5. Business rules

### RULE-ORDER-001: Order number gapless per tenant per year

Sequence allocation atomic via `order_number_sequences` (analogous to invoices §15 RULE-TAX-009). Cancelled orders **keep** their number (no gap fill).

Number format: `ORD-2026-00001234`.

### RULE-ORDER-002: Order immutability — line items and amounts

`order_items.unit_price_amount`, `quantity`, `tax_amount`, etc. = immutable post-placement. Corrections via:
- Cancel line via `quantity_cancelled` partial cancel field
- Return flow via `quantity_returned`
- Compensating credit_note + refund

Editable post-placement (with audit):
- `staff_note` (internal)
- `tags`
- `delivery_instructions` (configurable per merchant; usually pre-fulfillment only)
- `shipping_address_snapshot` only via dedicated "address change" workflow (`PERM-ORDER-EDIT-ADDRESS`) and pre-shipment

### RULE-ORDER-003: Email mandatory

`orders.email` MUST be non-null. For guest orders: from checkout's `guest_email`. For logged-in: snapshot of `customer.email` at placement.

Receipt + tracking emails depend on it.

### RULE-ORDER-004: Snapshot completeness

At placement, `orders` row contains complete denormalized snapshot:
- All amounts
- Both addresses
- Tax breakdown
- Applied promotions (coupons, gift cards, discounts)
- Customer group, price list chain
- Shipping method
- Customer note

Reason: order lifecycle may span months/years; underlying customer/product/discount data may change, but order legal record stays consistent.

### RULE-ORDER-005: Status derivation is deterministic

`derive_status()` is pure function of `(cancelled_at, on_hold_count, payment_status, fulfillment_status, refunded_amount, paid_amount, completed_at)`. Run after any sub-status change.

Materialized as `orders.status` for query speed; recomputed on every change via trigger or service.

### RULE-ORDER-006: Append-only transitions

`order_transitions` rows immutable. New transition = new row.

Recording: every `orders.status`, `payment_status`, `fulfillment_status` change inserts row with from/to/actor/reason.

### RULE-ORDER-007: Customer-visible events curated

`order_events.is_customer_visible=true` events shown in customer order page. Examples:
- Order placed
- Order confirmed (payment received)
- Order shipped
- Out for delivery
- Delivered
- Refund issued

Internal events `is_customer_visible=false`:
- Fraud review started
- Manual hold applied
- Staff note added
- Risk score updated

Merchant can manually add customer-visible note via "Send update to customer" action.

### RULE-ORDER-008: On-hold composability

Multiple `order_holds` may exist concurrently (e.g., fraud_review + b2b_credit_check). Order remains on_hold while any active. Status reverts when all released.

Each hold tracks actor (who applied + who released).

### RULE-ORDER-009: Cancellation atomicity (saga)

Order cancellation triggers compensating actions:
1. Set `orders.status='cancelled'`, `cancelled_at`, `cancel_reason_code`
2. Cancel any pending shipments (if any) — call carriers
3. Void or refund payments (per `13`)
4. Release inventory reservations (per `09` — order kind reservations)
5. Mark gift card usage released (restore balance)
6. Mark coupon usage released (decrement `discount_usage.released_at`)
7. Emit EVENT-ORDER-CANCELLED
8. Notify customer (configurable)
9. Mark invoice as voided OR issue credit note (per `15`)

Atomic Tx for Postgres state; external calls (carrier, payment provider) follow saga compensation.

### RULE-ORDER-010: Partial cancellation

Pre-fulfillment: admin can cancel specific line items (not whole order). `order_items.quantity_cancelled` incremented. Subtotal/tax recomputed via compensating delta (without changing snapshot field values — `metadata.cancellation_adjustments` records delta).

Net effect: customer pays less; partial refund issued.

### RULE-ORDER-011: Address change pre-fulfillment

Allowed: customer service edits shipping address only if no shipments yet generated. Audit log entry.

Post-shipment: address change requires carrier coordination (some carriers allow in-flight redirect). Fáze 2+ feature.

### RULE-ORDER-012: Order edit privileges

| Field | Pre-fulfillment | Post-fulfillment | Post-completion |
|---|---|---|---|
| `staff_note` | ✅ | ✅ | ✅ |
| `tags` | ✅ | ✅ | ✅ |
| `customer_note` | ❌ (set at placement) | ❌ | ❌ |
| `shipping_address` | ✅ (with audit) | ⚠️ carrier coord | ❌ |
| `billing_address` | ✅ | ⚠️ invoice impl | ❌ |
| `email` | ✅ (corrective) | ✅ (corrective) | ✅ |
| `line items qty / price` | ❌ (immutable; use cancel + new order) | ❌ | ❌ |
| `tax_breakdown` | ❌ | ❌ | ❌ |

### RULE-ORDER-013: Order tags

Free-form tags from `order_tags_catalog` OR ad-hoc text. Multi-tag.

Auto-tagging rules (Fáze 2): e.g., "high_value" if total > X, "gift" if any item has gift_message.

### RULE-ORDER-014: Risk score lifecycle

Initial from checkout (per `12 RULE-CHK-021`). Can be re-evaluated on:
- Manual admin trigger
- Post-shipment if delivery anomaly
- Chargeback initiation

Updates `orders.risk_score`, may flag `is_high_risk=true`. Audit log entry.

### RULE-ORDER-015: Source attribution immutable

`orders.source` and `source_user_id` / `source_agent_token_id` set at placement; never changed. Important for analytics + accountability.

### RULE-ORDER-016: Parent / related orders

`parent_order_id`: pro recurring orders (subscriptions next billing cycle) — links to original subscription order. Detail v `24-subscriptions.md`.

`related_order_ids`: free-form linking (exchanges, group orders). Manual admin action OR auto by workflows (return → replacement order).

### RULE-ORDER-017: Order recovery (lost orders)

If checkout commits payment authorization but order creation fails (rare, network issue between Phase 3 and ack):
- `JOB-RECONCILE-CHECKOUT-PROVIDER-STATE` (z `12`) finds authorized payment without order
- Completes order creation atomic
- Emits EVENT-ORDER-RECOVERED

### RULE-ORDER-018: Bulk operations

Admin can:
- Bulk cancel (multiple orders → atomic per order)
- Bulk fulfill (mark as shipped with manual tracking numbers)
- Bulk export (CSV, JSON, accounting format)
- Bulk tag

Limits: 1000 orders per bulk operation (configurable). Returns 207 Multi-Status with per-order result.

### RULE-ORDER-019: Search index

Order search via Meilisearch index `orders:{tenant_id}` (paralelně k `products` index z `08`). Searchable fields:
- `number`, `customer_email`, `customer_name`, `phone`
- SKUs of items
- `tags`
- `shipping_address.city`, `postal_code`, `country`
- `purchase_order_number`

Updated via `JOB-INDEX-ORDER` on EVENT-ORDER-* and status changes.

### RULE-ORDER-020: Order lookup pub_id vs number

- `pub_id` (ord_NanoID): admin URLs, public-facing API (not guessable)
- `number` (ORD-2026-...): printed on invoices, customer-facing, gapless

Both unique per tenant.

### RULE-ORDER-021: Customer self-service permissions

Logged-in customer can:
- View own orders (filtered by `customer_id`)
- Track shipments
- Download invoices
- Initiate return (handoff to `17`)
- Cancel pre-fulfillment (configurable; default false → support request)

Guest order: accessed via signed token from confirmation email (`pub_id` + HMAC). Expires after 90 days.

### RULE-ORDER-022: B2B order specifics

If `company_id IS NOT NULL`:
- `purchase_order_number` displayed prominently
- `payment_terms_days` honored (e.g., NET 30; order may be `confirmed` without immediate payment, invoice issued, dues tracked)
- `vat_reverse_charge_applied=true` reflects tax treatment
- Multiple users from same company can view (per company_members; v1.0+ B2B)

### RULE-ORDER-023: Subscription order link

Subscription recurring charge creates new `orders` row with:
- `source='recurring'`
- `parent_order_id` = original subscription parent order
- `metadata.subscription_id` = subscription ID
- Items snapshot from subscription template

Detail v `24-subscriptions.md`.

### RULE-ORDER-024: POS order specifics

`source='pos'`, `source_user_id`=staff member, terminal_id v metadata. Often:
- Immediate payment (card/cash)
- No shipping (in-store pickup)
- Receipt format (not full invoice)

Detail v Fáze 2 POS doc.

### RULE-ORDER-025: Marketplace order routing (Fáze 4)

`source='marketplace'` + `metadata.seller_id` = third-party seller. Tax + payment routing per `25-marketplace.md`.

### RULE-ORDER-026: AI agent order signaling

`source='agent'` + `source_agent_token_id` = which agent placed. Customer notification per agent token settings (per `12 RULE-CHK-017`).

Tag automatic `agent-placed` for analytics distinction.

### RULE-ORDER-027: Total recomputation on partial events

After partial refund / partial cancel / partial return: `paid_amount`, `refunded_amount` updated. Other amounts (subtotal, tax, total) remain snapshotted; UI shows "net effect" = total - refunded.

Field `metadata.adjustments` may track running deltas for legal audit.

### RULE-ORDER-028: Order placement idempotency

Per `12 RULE-CHK-011`: `confirm_idempotency_key` in checkout_session. Order creation guarded by this key — re-running placement returns existing order.

### RULE-ORDER-029: Multi-currency orders

Order has single `currency`. All amounts in that currency. Cross-currency reporting via exchange_rates conversion at query time (not stored).

### RULE-ORDER-030: GDPR right-to-erasure

Customer GDPR delete: PII anonymized in `orders.shipping_address_snapshot`, `billing_address_snapshot`, `email`, `phone`. Order itself retained (accounting law per `15 RULE-TAX-030`).

Anonymized examples:
- `email` → `anonymized-{customer_id}@deleted.local`
- `recipient_name` → `Anonymous`
- IP hash kept (already anonymized)
- `customer_note` cleared

---

## 6. REST API endpoints

### 6.1 Admin

```
GET    /api/{date}/orders                                              # list, filterable
GET    /api/{date}/orders/{id_or_pub_id_or_number}                     # single (multi-key lookup)
PATCH  /api/{date}/orders/{id}                                          # limited fields per RULE-ORDER-012
GET    /api/{date}/orders/{id}/items
GET    /api/{date}/orders/{id}/transitions
GET    /api/{date}/orders/{id}/events                                   # full event timeline
GET    /api/{date}/orders/{id}/payments                                  # cross-domain pivot
GET    /api/{date}/orders/{id}/shipments
GET    /api/{date}/orders/{id}/invoices
GET    /api/{date}/orders/{id}/returns

POST   /api/{date}/orders/{id}:cancel                                   # body: { reason, reason_code, refund: 'full'|'none' }
POST   /api/{date}/orders/{id}:cancel-line                              # body: { order_item_id, quantity }
POST   /api/{date}/orders/{id}:on-hold                                  # body: { reason, notes }
POST   /api/{date}/orders/{id}:release-hold                             # body: { hold_id, release_notes }
POST   /api/{date}/orders/{id}:mark-complete                            # admin force complete
POST   /api/{date}/orders/{id}:re-score-risk                             # re-run fraud engine
POST   /api/{date}/orders/{id}:add-event                                 # custom customer-visible event
POST   /api/{date}/orders/{id}:add-tag                                   # add tag
DELETE /api/{date}/orders/{id}/tags/{tag}
POST   /api/{date}/orders/{id}:change-address                            # pre-fulfillment only
POST   /api/{date}/orders/{id}:send-notification                          # ad-hoc customer email

POST   /api/{date}/orders:bulk-cancel
POST   /api/{date}/orders:bulk-fulfill
POST   /api/{date}/orders:bulk-tag
POST   /api/{date}/orders:bulk-export                                    # async
POST   /api/{date}/orders:bulk-print-invoices                            # PDF batch
POST   /api/{date}/orders:bulk-print-packing-slips                       # PDF batch

GET    /api/{date}/orders:search?q=&status=&payment_status=&...           # search via Meilisearch
```

### 6.2 Storefront (customer)

```
GET    /api/{date}/storefront/orders                                      # my orders (logged-in)
GET    /api/{date}/storefront/orders/{number}                              # detail
GET    /api/{date}/storefront/orders/by-token?token={signed}                # guest access
POST   /api/{date}/storefront/orders/{number}:cancel                       # if allowed per RULE-ORDER-021
GET    /api/{date}/storefront/orders/{number}/events                        # customer-visible timeline
GET    /api/{date}/storefront/orders/{number}/tracking                       # all shipments tracking
POST   /api/{date}/storefront/orders/{number}/contact-merchant                # ad-hoc support message
```

### 6.3 Reporting + analytics endpoints

```
GET    /api/{date}/order-analytics/conversion-funnel
GET    /api/{date}/order-analytics/revenue-by-day?period=30d
GET    /api/{date}/order-analytics/revenue-by-channel
GET    /api/{date}/order-analytics/avg-order-value
GET    /api/{date}/order-analytics/repeat-customer-rate
GET    /api/{date}/order-analytics/top-products?period=30d
GET    /api/{date}/order-analytics/cancellation-reasons
```

### 6.4 Example: List orders (admin)

```http
GET /api/2026-05-19/orders?status=processing&placed_after=2026-05-01&limit=50 HTTP/1.1
Authorization: Bearer ...
```

```jsonc
HTTP/1.1 200 OK

{
  "data": [
    {
      "id": "01927bca-...",
      "pub_id": "ord_aB3cD",
      "type": "order",
      "attributes": {
        "number": "ORD-2026-00001234",
        "status": "processing",
        "payment_status": "paid",
        "fulfillment_status": "partially_fulfilled",
        "placed_at": "2026-05-19T14:45:00Z",
        "currency": "CZK",
        "subtotal_amount": 88200,
        "discount_amount": 9800,
        "tax_amount": 18522,
        "shipping_amount": 9900,
        "total_amount": 116622,
        "paid_amount": 116622,
        "refunded_amount": 0,
        "items_count": 3,
        "customer_email": "jan.novak@example.com",
        "shipping_city": "Praha",
        "tags": ["VIP"],
        "is_high_risk": false,
        "risk_score": 12,
        "source": "storefront"
      },
      "relationships": {
        "customer": { "id": "cus_...", "name": "Jan Novák" },
        "items": { "count": 3, "url": "/api/2026-05-19/orders/ord_aB3cD/items" },
        "shipments": { "count": 1, "url": "/api/2026-05-19/orders/ord_aB3cD/shipments" }
      }
    },
    ...
  ],
  "page": {
    "cursor": "eyJ...",
    "has_more": true,
    "total": 147
  }
}
```

### 6.5 Example: Get order detail

```http
GET /api/2026-05-19/orders/ORD-2026-00001234 HTTP/1.1
```

```jsonc
HTTP/1.1 200 OK

{
  "data": {
    "id": "01927bca-...",
    "pub_id": "ord_aB3cD",
    "type": "order",
    "attributes": {
      "number": "ORD-2026-00001234",
      "status": "processing",
      "payment_status": "paid",
      "fulfillment_status": "partially_fulfilled",
      "placed_at": "2026-05-19T14:45:00Z",
      "confirmed_at": "2026-05-19T14:45:30Z",
      "processing_started_at": "2026-05-19T15:30:00Z",
      "currency": "CZK",
      "subtotal_amount": 88200,
      "discount_amount": 9800,
      "shipping_amount": 9900,
      "shipping_discount_amount": 0,
      "tax_amount": 18522,
      "total_amount": 116622,
      "paid_amount": 116622,
      "refunded_amount": 0,
      "gift_card_redeemed_amount": 0,
      "shipping_address_snapshot": { ... },
      "billing_address_snapshot": { ... },
      "tax_breakdown": [
        { "tax_class": "standard", "rate_basis_points": 2100, "base_amount": 88200, "tax_amount": 18522 }
      ],
      "applied_coupons": ["SUMMER10"],
      "customer_note": "Prosím nezvonit, dítě spí",
      "staff_note": null,
      "tags": ["VIP"],
      "risk_score": 12,
      "is_high_risk": false,
      "source": "storefront",
      "locale": "cs-CZ",
      "email": "jan.novak@example.com",
      "phone": "+420777123456"
    },
    "relationships": {
      "customer": { "data": { "id": "cus_aB", "type": "customer" }},
      "items": { "links": { "related": "/api/2026-05-19/orders/ord_aB3cD/items" }, "count": 3 },
      "payments": { "links": { "related": "/api/2026-05-19/orders/ord_aB3cD/payments" }, "count": 1 },
      "shipments": { "links": { "related": "/api/2026-05-19/orders/ord_aB3cD/shipments" }, "count": 1 },
      "invoices": { "links": { "related": "/api/2026-05-19/orders/ord_aB3cD/invoices" }, "count": 1 }
    }
  },
  "meta": { "request_id": "req_..." }
}
```

### 6.6 Example: Cancel order

```http
POST /api/2026-05-19/orders/ord_aB:cancel HTTP/1.1
Authorization: Bearer ...
Idempotency-Key: ...

{
  "reason": "Customer requested via phone — out of country travel",
  "reason_code": "customer_request",
  "refund": "full"
}
```

```jsonc
HTTP/1.1 200 OK

{
  "data": {
    "order": {
      "id": "...",
      "status": "cancelled",
      "cancelled_at": "2026-05-19T16:00:00Z",
      "cancel_reason": "Customer requested via phone — out of country travel",
      "cancel_reason_code": "customer_request"
    },
    "refund": {
      "id": "rfd_...",
      "amount": 116622,
      "currency": "CZK",
      "status": "processing"
    },
    "actions_performed": [
      "voided_pending_shipments",
      "released_inventory_reservations",
      "issued_full_refund",
      "issued_credit_note",
      "sent_customer_notification"
    ]
  }
}
```

### 6.7 Example: On-hold

```http
POST /api/2026-05-19/orders/ord_aB:on-hold HTTP/1.1

{
  "reason": "fraud_review",
  "notes": "Risk score 78; IP from VPN; address mismatch"
}
```

```jsonc
HTTP/1.1 200 OK

{
  "data": {
    "order_status": "on_hold",
    "hold": {
      "id": "hld_...",
      "reason": "fraud_review",
      "created_at": "2026-05-19T15:00:00Z"
    }
  }
}
```

### 6.8 Example: Customer view

```http
GET /api/2026-05-19/storefront/orders/ORD-2026-00001234 HTTP/1.1
Authorization: Bearer customer_jwt...
```

```jsonc
HTTP/1.1 200 OK

{
  "data": {
    "number": "ORD-2026-00001234",
    "status_label": "V procesu doručení",
    "placed_at": "2026-05-19T14:45:00Z",
    "items": [
      {
        "title": "Stolní lampa Luna",
        "variant_title": "Bílá / Malá",
        "quantity": 2,
        "unit_price": { "amount": 49000, "currency": "CZK" },
        "primary_image_url": "...",
        "quantity_fulfilled": 2,
        "tracking_number": "Z123456789CZ",
        "tracking_url": "https://tracking.packeta.com/Z123456789CZ"
      }
    ],
    "totals": {
      "subtotal": { "amount": 88200, "currency": "CZK" },
      "discount": { "amount": 9800, "currency": "CZK" },
      "shipping": { "amount": 9900, "currency": "CZK" },
      "tax": { "amount": 18522, "currency": "CZK" },
      "total": { "amount": 116622, "currency": "CZK" }
    },
    "shipping_address": { ... },
    "billing_address": { ... },
    "events": [
      {
        "kind": "placed",
        "title": "Objednávka byla přijata",
        "occurred_at": "2026-05-19T14:45:00Z"
      },
      {
        "kind": "payment_received",
        "title": "Platba přijata",
        "occurred_at": "2026-05-19T14:45:30Z"
      },
      {
        "kind": "shipped",
        "title": "Vaše objednávka byla odeslána",
        "description": "Zásilkovna, Z-BOX Praha 5 — Anděl",
        "customer_facing_link": "https://tracking.packeta.com/Z123456789CZ",
        "occurred_at": "2026-05-19T17:00:00Z"
      }
    ],
    "invoices": [
      {
        "number": "INV-2026-00001234",
        "pdf_url": "https://cdn.shopio.com/...?sig=..."
      }
    ],
    "can_cancel": false,
    "can_initiate_return": true,
    "return_eligible_until": "2026-06-18T23:59:59Z"
  }
}
```

---

## 7. GraphQL schema

```graphql
type Order implements Node & Timestamped {
  id: ID!
  pubId: String!
  number: String!
  customer: Customer
  guestEmail: String
  email: String!
  phone: String
  company: Company
  customerGroup: CustomerGroup
  channel: Channel
  store: Store
  source: OrderSource!
  status: OrderStatus!
  paymentStatus: PaymentStatus!
  fulfillmentStatus: FulfillmentStatus!
  placedAt: DateTime!
  confirmedAt: DateTime
  processingStartedAt: DateTime
  fulfilledAt: DateTime
  completedAt: DateTime
  cancelledAt: DateTime
  cancelReason: String
  cancelReasonCode: OrderCancelReasonCode
  currency: String!
  subtotalAmount: Money!
  discountAmount: Money!
  shippingAmount: Money!
  shippingDiscountAmount: Money!
  taxAmount: Money!
  totalAmount: Money!
  paidAmount: Money!
  refundedAmount: Money!
  giftCardRedeemedAmount: Money!
  shippingAddress: Address!
  billingAddress: Address!
  taxBreakdown: [TaxBreakdownItem!]!
  appliedCoupons: [String!]!
  appliedDiscounts: JSON!
  appliedGiftCards: [GiftCard!]!
  vatIdProvided: String
  vatReverseChargeApplied: Boolean!
  icoProvided: String
  purchaseOrderNumber: String
  paymentTermsDays: Int
  selectedShippingMethod: ShippingMethod
  selectedPickupPoint: PickupPoint
  deliveryInstructions: String
  preferredDeliveryDate: Date
  customerNote: String
  staffNote: String
  tags: [String!]!
  riskScore: Int
  isHighRisk: Boolean!
  locale: String!
  items: [OrderItem!]!
  transitions: [OrderTransition!]!
  events(customerVisibleOnly: Boolean = false): [OrderEvent!]!
  holds(activeOnly: Boolean = true): [OrderHold!]!
  payments: [Payment!]!
  shipments: [Shipment!]!
  invoices: [Invoice!]!
  returns: [Return!]!
  parentOrder: Order
  relatedOrders: [Order!]!
  canCancel: Boolean!
  canInitiateReturn: Boolean!
  returnEligibleUntil: DateTime
  createdAt: DateTime!
  updatedAt: DateTime!
  metadata: JSON
}

enum OrderStatus {
  PENDING CONFIRMED PROCESSING FULFILLED COMPLETED
  CANCELLED REFUNDED PARTIALLY_REFUNDED ON_HOLD FAILED
}

enum PaymentStatus { PENDING AUTHORIZED PARTIALLY_PAID PAID PARTIALLY_REFUNDED REFUNDED FAILED VOIDED }
enum FulfillmentStatus { UNFULFILLED PARTIALLY_FULFILLED FULFILLED RETURNED PARTIALLY_RETURNED }

enum OrderSource { STOREFRONT POS ADMIN API AGENT MARKETPLACE IMPORTED RECURRING }
enum OrderCancelReasonCode {
  CUSTOMER_REQUEST PAYMENT_FAILED STOCK_UNAVAILABLE FRAUD
  INCORRECT_ADDRESS DUPLICATE MERCHANT_DECISION TIMEOUT_BANK_TRANSFER
  COD_RETURNED MANUAL_OTHER
}

type OrderItem {
  id: ID!
  position: Int!
  product: Product
  variant: ProductVariant
  sku: String!
  barcode: String
  title: String!
  variantTitle: String
  primaryImageUrl: String
  quantity: Int!
  unitPrice: Money!
  compareAtPrice: Money
  subtotalBeforeDiscount: Money!
  discountAmount: Money!
  taxClassCode: String
  taxRateBasisPoints: Int!
  taxAmount: Money!
  totalAmount: Money!
  weightGrams: Int
  requiresShipping: Boolean!
  isReverseCharge: Boolean!
  giftMessage: String
  customization: JSON
  bundleParentItem: OrderItem
  isBundleChild: Boolean!
  quantityFulfilled: Int!
  quantityReturned: Int!
  quantityCancelled: Int!
  digitalDeliveryUrl: String
  digitalDeliveryExpiresAt: DateTime
}

type OrderTransition {
  id: ID!
  transitionKind: OrderTransitionKind!
  fromValue: String
  toValue: String!
  reason: String
  reasonCode: String
  actor: Actor!
  relatedEntityType: String
  relatedEntityId: ID
  occurredAt: DateTime!
}

enum OrderTransitionKind { STATUS PAYMENT_STATUS FULFILLMENT_STATUS ON_HOLD MANUAL_OVERRIDE }

type OrderEvent {
  id: ID!
  kind: OrderEventKind!
  isCustomerVisible: Boolean!
  title: String!
  description: String
  relatedEntityType: String
  relatedEntityId: ID
  customerFacingLink: String
  occurredAt: DateTime!
}

enum OrderEventKind {
  PLACED CONFIRMED PAYMENT_RECEIVED PAYMENT_FAILED
  ON_HOLD HOLD_LIFTED CANCELLED
  SHIPPED PARTIALLY_SHIPPED OUT_FOR_DELIVERY DELIVERED COLLECTED
  FAILED_DELIVERY RETURNED
  INVOICE_ISSUED REFUND_ISSUED PARTIAL_REFUND_ISSUED
  NOTE_FROM_MERCHANT CUSTOM
}

type OrderHold {
  id: ID!
  reason: OrderHoldReason!
  notes: String
  createdBy: Actor!
  createdAt: DateTime!
  releasedAt: DateTime
  releasedBy: Actor
  releaseNotes: String
}

enum OrderHoldReason { FRAUD_REVIEW MANUAL STOCK_UNAVAILABLE PAYMENT_PENDING B2B_CREDIT_CHECK HIGH_RISK CUSTOM }

extend type Query {
  orders(first: Int, after: String, filter: OrderFilter, sort: [OrderSort!]): OrderConnection! @auth(requires: PERM_ORDER_VIEW)
  order(id: ID, pubId: String, number: String): Order
  myOrders(first: Int, after: String): OrderConnection!
  orderByGuestToken(token: String!): Order
  orderSearch(query: String!, first: Int = 20): [Order!]! @auth(requires: PERM_ORDER_VIEW)
}

input OrderFilter {
  status: [OrderStatus!]
  paymentStatus: [PaymentStatus!]
  fulfillmentStatus: [FulfillmentStatus!]
  channelId: ID
  customerId: ID
  companyId: ID
  source: [OrderSource!]
  isHighRisk: Boolean
  tags: [String!]
  placedAfter: DateTime
  placedBefore: DateTime
  minTotal: MoneyInput
  maxTotal: MoneyInput
  hasOpenHold: Boolean
}

extend type Mutation {
  cancelOrder(id: ID!, input: CancelOrderInput!, idempotencyKey: String!): CancelOrderResult! @auth(requires: PERM_ORDER_CANCEL)
  cancelOrderLine(id: ID!, orderItemId: ID!, quantity: Int!, idempotencyKey: String!): Order! @auth(requires: PERM_ORDER_CANCEL)
  putOrderOnHold(id: ID!, input: PutOnHoldInput!): Order! @auth(requires: PERM_ORDER_HOLD)
  releaseOrderHold(id: ID!, holdId: ID!, notes: String): Order! @auth(requires: PERM_ORDER_HOLD)
  markOrderComplete(id: ID!): Order! @auth(requires: PERM_ORDER_EDIT)
  rescoreOrderRisk(id: ID!): Order! @auth(requires: PERM_ORDER_VIEW)
  addOrderEvent(id: ID!, input: AddOrderEventInput!): OrderEvent! @auth(requires: PERM_ORDER_EDIT)
  addOrderTag(id: ID!, tag: String!): Order! @auth(requires: PERM_ORDER_EDIT)
  removeOrderTag(id: ID!, tag: String!): Order! @auth(requires: PERM_ORDER_EDIT)
  changeOrderShippingAddress(id: ID!, input: AddressInput!): Order! @auth(requires: PERM_ORDER_EDIT_ADDRESS)
  sendOrderNotification(id: ID!, input: SendNotificationInput!): MutationPayload! @auth(requires: PERM_ORDER_EDIT)

  bulkCancelOrders(ids: [ID!]!, input: CancelOrderInput!): [BulkOrderResult!]! @auth(requires: PERM_ORDER_CANCEL)
  bulkTagOrders(ids: [ID!]!, tag: String!): [BulkOrderResult!]! @auth(requires: PERM_ORDER_EDIT)
  bulkExportOrders(filter: OrderFilter!, format: ExportFormat!): Operation! @auth(requires: PERM_ORDER_EXPORT)
}

type CancelOrderResult {
  order: Order!
  refund: Refund
  actionsPerformed: [String!]!
}

type BulkOrderResult {
  orderId: ID!
  success: Boolean!
  error: String
}
```

---

## 8. Events

| Build-spec ID | Wire | Payload |
|---|---|---|
| `EVENT-ORDER-PLACED` | `order.placed` | `{ order }` |
| `EVENT-ORDER-CONFIRMED` | `order.confirmed` | `{ order, payment_id }` |
| `EVENT-ORDER-PROCESSING-STARTED` | `order.processing_started` | `{ order }` |
| `EVENT-ORDER-PARTIALLY-FULFILLED` | `order.partially_fulfilled` | `{ order, fulfilled_count, total_count }` |
| `EVENT-ORDER-FULFILLED` | `order.fulfilled` | `{ order }` |
| `EVENT-ORDER-COMPLETED` | `order.completed` | `{ order }` |
| `EVENT-ORDER-CANCELLED` | `order.cancelled` | `{ order, reason_code, refund_id? }` |
| `EVENT-ORDER-LINE-CANCELLED` | `order.line_cancelled` | `{ order_id, order_item_id, quantity_cancelled }` |
| `EVENT-ORDER-FAILED` | `order.failed` | `{ order, reason }` |
| `EVENT-ORDER-ON-HOLD` | `order.on_hold` | `{ order, hold }` |
| `EVENT-ORDER-HOLD-RELEASED` | `order.hold_released` | `{ order, hold }` |
| `EVENT-ORDER-PAYMENT-STATUS-CHANGED` | `order.payment_status_changed` | `{ order, from, to }` |
| `EVENT-ORDER-FULFILLMENT-STATUS-CHANGED` | `order.fulfillment_status_changed` | `{ order, from, to }` |
| `EVENT-ORDER-REFUNDED` | `order.refunded` | `{ order, total_refunded }` |
| `EVENT-ORDER-PARTIALLY-REFUNDED` | `order.partially_refunded` | `{ order, amount_refunded, total_refunded }` |
| `EVENT-ORDER-ADDRESS-CHANGED` | `order.address_changed` | `{ order, previous_address, new_address }` |
| `EVENT-ORDER-TAGGED` | `order.tagged` | `{ order, tag, actor }` |
| `EVENT-ORDER-NOTE-ADDED` | `order.note_added` | `{ order, note_kind, content }` |
| `EVENT-ORDER-RISK-RESCORED` | `order.risk_rescored` | `{ order, previous_score, new_score, signals }` |
| `EVENT-ORDER-RECOVERED` | `order.recovered` | `{ order }` |
| `EVENT-ORDER-BULK-OPERATION-COMPLETED` | `order.bulk_operation_completed` | `{ operation_id, summary }` |
| `EVENT-ORDER-NOTIFICATION-SENT` | `order.notification_sent` | `{ order, notification_kind, recipient }` |

**Konzumenti:**
- Customer notifications (`19-marketing-seo.md` automation) — emails per event
- Search indexer (`08`) — `JOB-INDEX-ORDER` reflects status changes
- Analytics (`20`) — funnel + revenue metrics
- Invoice issuance (`15`) — `EVENT-ORDER-PAID` triggers `JOB-ISSUE-INVOICE-FROM-ORDER`
- Inventory (`09`) — `EVENT-ORDER-CANCELLED` releases reservations
- Webhooks delivery — per merchant subscription
- ERP/CRM integrations — order push

---

## 9. Background jobs

| Job | Trigger | Queue | Frequency |
|---|---|---|---|
| `JOB-AUTO-CANCEL-UNPAID-ORDERS` | scheduled | `order-sweeper` | Hourly |
| `JOB-AUTO-CANCEL-COD-RETURNED` | EVENT-SHIPMENT-RETURNED-TO-SENDER | `orders` | On-demand |
| `JOB-RECOMPUTE-ORDER-STATUS` | EVENT-PAYMENT-*, EVENT-SHIPMENT-*, EVENT-REFUND-* | `orders` | On-demand |
| `JOB-SYNC-PAID-AMOUNT` | EVENT-PAYMENT-CAPTURED / EVENT-PAYMENT-PARTIALLY-CAPTURED | `orders` | On-demand |
| `JOB-SYNC-REFUNDED-AMOUNT` | EVENT-REFUND-SUCCEEDED | `orders` | On-demand |
| `JOB-SYNC-FULFILLMENT-STATUS` | EVENT-SHIPMENT-DELIVERED / RETURNED | `orders` | On-demand |
| `JOB-INDEX-ORDER` | EVENT-ORDER-* (debounced 5s) | `search-index` | On-demand |
| `JOB-AUTO-COMPLETE-FULFILLED-ORDERS` | scheduled | `orders` | Daily |
| `JOB-DETECT-STUCK-ORDERS` | scheduled | `order-sweeper` | Daily |
| `JOB-SEND-ORDER-CONFIRMATION-EMAIL` | EVENT-ORDER-CONFIRMED | `notifications` | On-demand |
| `JOB-SEND-ORDER-SHIPPED-EMAIL` | EVENT-ORDER-PARTIALLY-FULFILLED / FULFILLED (per shipment) | `notifications` | On-demand |
| `JOB-SEND-ORDER-DELIVERED-EMAIL` | EVENT-SHIPMENT-DELIVERED | `notifications` | On-demand |
| `JOB-SEND-ORDER-CANCELLED-EMAIL` | EVENT-ORDER-CANCELLED | `notifications` | On-demand |
| `JOB-COMPUTE-CUSTOMER-AGGREGATES` | EVENT-ORDER-COMPLETED | `analytics` | On-demand |
| `JOB-BULK-CANCEL-ORDERS` | manual | `bulk-ops` | On-demand |
| `JOB-BULK-EXPORT-ORDERS` | manual | `exports` | On-demand |
| `JOB-BULK-PRINT-PACKING-SLIPS` | manual | `printing` | On-demand |
| `JOB-RECOVER-LOST-ORDERS` | scheduled | `recovery` | Every 5 min (overlaps with checkout's reconcile) |
| `JOB-DETECT-FRAUD-PATTERNS` | scheduled | `fraud` | Hourly |
| `JOB-PURGE-OLD-TRANSITIONS` | scheduled | `maintenance` | Daily (retention per tenant) |

### 9.1 JOB-RECOMPUTE-ORDER-STATUS detail

```typescript
async function recomputeOrderStatus(orderId: string) {
  await pg.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('order:' + ${orderId})::bigint)`);
    
    const order = await loadOrder(tx, orderId);
    const payments = await tx.query(sql`SELECT * FROM payments WHERE order_id = ${orderId}`);
    const shipments = await tx.query(sql`SELECT * FROM shipments WHERE order_id = ${orderId}`);
    const refunds = await tx.query(sql`SELECT * FROM refunds WHERE order_id = ${orderId}`);
    
    const newPaymentStatus = computePaymentStatus(payments);
    const newFulfillmentStatus = computeFulfillmentStatus(order.items, shipments);
    const newPaidAmount = sumPaidAmounts(payments);
    const newRefundedAmount = sumRefundedAmounts(refunds);
    
    const newOrderStatus = deriveOrderStatus({
      cancelled_at: order.cancelled_at,
      on_hold_count: await countActiveHolds(tx, orderId),
      payment_status: newPaymentStatus,
      fulfillment_status: newFulfillmentStatus,
      refunded_amount: newRefundedAmount,
      paid_amount: newPaidAmount,
      completed_at: order.completed_at,
    });
    
    // Apply changes if different
    if (newOrderStatus !== order.status) {
      await insertTransition(tx, orderId, 'status', order.status, newOrderStatus, 'system-derive');
      await emitOrderEvent(tx, orderId, mapStatusToEventKind(newOrderStatus));
    }
    if (newPaymentStatus !== order.payment_status) {
      await insertTransition(tx, orderId, 'payment_status', order.payment_status, newPaymentStatus, 'system-derive');
    }
    if (newFulfillmentStatus !== order.fulfillment_status) {
      await insertTransition(tx, orderId, 'fulfillment_status', order.fulfillment_status, newFulfillmentStatus, 'system-derive');
    }
    
    await tx.execute(sql`UPDATE orders SET status = ${newOrderStatus}, payment_status = ${newPaymentStatus}, fulfillment_status = ${newFulfillmentStatus}, paid_amount = ${newPaidAmount}, refunded_amount = ${newRefundedAmount}, updated_at = now(), version = version + 1 WHERE id = ${orderId}`);
    
    // Emit outbox events
    await emitOutbox(tx, mapToOutboxEvent(newOrderStatus));
  });
}
```

### 9.2 JOB-AUTO-CANCEL-UNPAID-ORDERS

```
For orders where:
  status IN ('pending')
  AND payment_status = 'pending'
  AND placed_at < now() - tenant.settings.unpaid_order_timeout (default 7 days)
  AND payment_method_kind = 'bank_transfer' (configurable per method)
Do:
  Call cancelOrder(id, reason='timeout_bank_transfer')
```

---

## 10. UI/UX flows

### FLOW-ORDER-001: Admin views orders list

```
[Admin → Orders]
   - Tabs: All / Pending / Confirmed / Processing / Fulfilled / Cancelled / On hold
   - Filters: date range, customer, channel, payment status, fulfillment, tags, high-risk
   - Search bar (full-text)
   - Bulk select for actions
        │
   click row
        │
        ▼
[Order detail]
```

### FLOW-ORDER-002: Admin order detail

```
[/admin/orders/{number}]
   Layout (left main + right sidebar):
   - Header: order #, status badges (status / payment / fulfillment), tags
   - Customer card: email, name, link to profile
   - Line items table
   - Totals breakdown
   - Addresses (shipping + billing, edit pre-fulfillment)
   - Customer note + staff note (editable)
   - Activity timeline (transitions + events combined)
   - Actions:
     [Cancel order] [Mark complete] [On hold] [Refund] [Issue credit note]
     [Add note] [Add tag] [Re-score risk] [Send notification]
   
   Sidebar:
   - Payments list (link to payment detail per `13`)
   - Shipments list (link per `14`)
   - Invoices list (link per `15`)
   - Returns list (link per `17`)
```

### FLOW-ORDER-003: Cancel order

```
[Order detail → "Cancel order" button]
        │
        ▼
[Modal: Cancel order]
   - Reason free text + reason code dropdown
   - Refund option: [None] [Full refund] [Partial — specify amount]
   - Restock items? (default yes)
   - Notify customer? (default yes)
        │
   click "Confirm cancel"
        │
        ▼
[POST /orders/{id}:cancel → saga]
   - Multi-step progress: voiding shipments... → refunding payment... → issuing credit note... → notifying customer...
        │
        ▼
[Confirmation toast + redirect to order detail]
```

### FLOW-ORDER-004: Customer service partial cancel

```
[Order detail → Items table → "Cancel line"]
        │
        ▼
[Modal: Cancel line]
   - Quantity selector (default = remaining quantity)
   - Reason
   - Refund: [None] [Proportional refund]
        │
        ▼
[Apply changes]
   - order_items.quantity_cancelled incremented
   - Compensating refund issued
   - Inventory released
```

### FLOW-ORDER-005: Bulk fulfill

```
[Orders list → multi-select 30 orders → "Bulk fulfill" action]
        │
        ▼
[Bulk fulfill modal]
   - Select carrier + service
   - Generate labels? [Yes/No]
   - Mark handed-over? [Yes/No]
        │
        ▼
[POST /orders:bulk-fulfill → 202 operation]
   - Progress bar
   - Per-order success/fail toast
        │
        ▼
[Operation complete: download combined PDF labels]
```

### FLOW-ORDER-006: Customer views orders

```
[Customer account → Orders]
   - List with summary cards (number, status, total, items count)
        │
   click order
        │
        ▼
[Order detail (customer view)]
   - Items
   - Tracking section (one or more shipments with status + tracking_url)
   - Timeline (customer-visible events only)
   - Totals
   - Addresses (read-only post-confirm)
   - Actions:
     [Track shipment] [Download invoice] [Initiate return] [Cancel] (if eligible)
     [Contact merchant] (custom message)
```

### FLOW-ORDER-007: Guest order access

```
[Customer receives order confirmation email]
   - "View order" button with signed token URL
        │
   click
        │
        ▼
[/orders/by-token?token=...]
   - Server validates HMAC
   - Loads order
   - Same customer view as logged-in
   - Optional: prompt "Create account to save?"
```

### FLOW-ORDER-008: Fraud review workflow

```
[Risk score > 70 at checkout]
   - Order created with status='pending'
   - JOB-DETECT-FRAUD-PATTERNS may post-add hold
        │
        ▼
[Admin notification: "Manual review needed"]
[Fraud review dashboard]
   - Queue of held orders
   - Per order: risk signals, customer history, IP geo
        │
   admin clicks "Approve" or "Reject"
        │
        ▼
   Approve:
     - Release hold
     - Order proceeds through normal flow (capture payment if pre-auth)
   Reject:
     - Cancel order + refund + release inventory
     - Tag customer "fraud_suspected" (if recurring)
```

---

## 11. Edge cases & error handling

| Scenario | Behavior | Code |
|---|---|---|
| Cancel order with shipped items | Reject; must use return workflow | `CANNOT_CANCEL_SHIPPED`, 422 |
| Cancel partial line when product unique (qty=1) | Same as full line cancel | (handled) |
| Cancel order after refund issued already | Allow but recompute; no double-refund | (handled) |
| Order in `processing` with payment failed mid-flow | Status auto-reverts to `pending`; admin notified | (handled) |
| Concurrent status recompute (race) | Advisory lock per order_id; second waits | (handled) |
| Refund > paid_amount | Reject pre-call | `REFUND_EXCEEDS_PAID`, 422 |
| Address change post-shipment | Reject; suggest contact carrier | `SHIPMENT_ALREADY_GENERATED`, 422 |
| Customer cancel without permission | 403 | `INSUFFICIENT_PERMISSION`, 403 |
| Guest token expired | 410 | `TOKEN_EXPIRED`, 410 |
| Guest token wrong order | 404 (not 403) | `NOT_FOUND`, 404 |
| Order number collision (very rare) | Sequence allocation has UNIQUE; retry | (handled) |
| Bulk cancel includes cancelled orders | Skip those; return per-item OK with note | (handled) |
| Bulk operation > 1000 orders | Reject with hint to split | `BULK_LIMIT_EXCEEDED`, 422 |
| Order with deleted variant references | order_items keeps snapshot; variant_id NULL'd | (handled) |
| On-hold released but no holds active | No-op | (handled) |
| Multiple holds released independently | Status reverts to derived when last released | (handled) |
| Order placement crashed mid-Tx | `JOB-RECOVER-LOST-ORDERS` finds + completes | (handled per RULE-ORDER-017) |
| Subscription parent order cancelled | Children subscriptions also cancelled (cascade) | (handled per `24`) |
| GDPR delete on order with active hold | Anonymize PII; hold released and audit logged | (handled) |
| Search index out of sync with DB | `JOB-INDEX-ORDER-DRIFT-CHECK` (Fáze 2 like search index drift in `08`) | (handled) |
| Order with all items returned | fulfillment_status = 'returned'; status may need admin manual close | (handled) |
| Marketplace order with disputed seller | Hold whole order until resolved | (Fáze 4 per `25`) |
| Refund processed before order saved (very rare race) | Refund retries 1m later if order not found | (handled) |
| Negative discount adjustment edge (bundle credit) | quantity_cancelled with refund; metadata records adjustment | (handled) |
| Customer changes email mid-flow | Snapshot at placement immutable; new email only for notification routing | (handled) |
| Order in `pending` for > 30 days unpaid | `JOB-AUTO-CANCEL-UNPAID-ORDERS` cancels | (handled) |
| COD shipment lost in transit | Manual investigation; admin marks order based on findings | (manual) |
| Order with `is_high_risk` auto-completes (default not) | Configurable: high-risk requires manual completion | (per merchant policy) |

---

## 12. Performance

### 12.1 Targets

| Operation | p50 | p95 | p99 |
|---|---|---|---|
| `GET /orders` (paginated list) | 30 ms | 100 ms | 200 ms |
| `GET /orders/{id}` (full detail with items) | 25 ms | 80 ms | 180 ms |
| `POST /orders/{id}:cancel` (full saga) | 500 ms | 2000 ms | 5000 ms |
| `JOB-RECOMPUTE-ORDER-STATUS` | 20 ms | 60 ms | 150 ms |
| `JOB-INDEX-ORDER` (Meilisearch upsert) | 15 ms | 40 ms | 100 ms |
| `JOB-AUTO-CANCEL-UNPAID-ORDERS` (sweep 10k) | 5 s | 15 s | 30 s |
| Order search (Meilisearch) | 20 ms | 60 ms | 150 ms |
| `GET /storefront/orders` (customer's list) | 15 ms | 40 ms | 100 ms |

### 12.2 Optimization

- **BRIN index** on `placed_at` for time-range queries
- **Partial indexes** for status combinations (e.g., active orders)
- **DataLoader v GraphQL** for batched items, payments, shipments per order list
- **Read replica** for analytics queries (no real-time guarantee needed)
- **Cache hot orders** (in_progress, paid_not_fulfilled) in Redis 30s
- **Bulk operations** parallelize in worker pool, but throttle to avoid DB overload
- **Meilisearch order index** for fast search beyond filter combinations Postgres struggles with

### 12.3 Hot path queries

```sql
-- List orders for admin (filter + paginate)
SELECT * FROM orders
WHERE tenant_id = $1
  AND status = ANY($2)
  AND placed_at >= $3
ORDER BY placed_at DESC
LIMIT 50;
-- Uses idx_orders_status_period
```

```sql
-- Customer's orders
SELECT * FROM orders
WHERE customer_id = $1
ORDER BY placed_at DESC
LIMIT 20;
-- Uses idx_orders_customer
```

```sql
-- Detect unpaid > N days
SELECT id FROM orders
WHERE tenant_id = $1
  AND payment_status IN ('pending', 'authorized')
  AND status NOT IN ('cancelled', 'completed')
  AND placed_at < now() - interval '7 days';
-- Uses idx_orders_unpaid_old
```

### 12.4 Scaling

- Order volume: 1M orders/year per tenant manageable on single Postgres
- Beyond: read replicas + partitioning by month (BRIN already supports range)
- order_transitions + order_events partitioned monthly already

---

## 13. Security

### 13.1 Permissions

```
PERM-ORDER-VIEW
PERM-ORDER-EDIT                    # limited field edits
PERM-ORDER-EDIT-ADDRESS            # pre-fulfillment
PERM-ORDER-CANCEL
PERM-ORDER-HOLD
PERM-ORDER-FULFILL                  # mark shipments done
PERM-ORDER-FINANCIAL-REPORT
PERM-ORDER-EXPORT
PERM-ORDER-BULK-OPS
PERM-ORDER-VIEW-PII                 # sensitive customer info gate
PERM-ORDER-RE-SCORE-RISK
```

### 13.2 Customer access controls

- Logged-in customer accesses own orders only (`WHERE customer_id = $authenticated_customer_id`)
- Guest accesses via signed HMAC token (expires 90 days post-order)
- Staff impersonation logged (impersonate_user_id in audit log)
- Cross-tenant access prohibited (RLS reinforced)

### 13.3 Audit log

- 100% audit on: cancel, refund initiation, hold/release, address change, manual overrides, tag changes
- Sample 1% on reads (high volume)
- High-value orders (top 1% by amount): higher sampling

### 13.4 GDPR

- Right-to-erasure: PII anonymized per RULE-ORDER-030
- Right-to-portability: customer can export own order history (JSON)
- Retention: 10 years (CZ accounting); archived to cold storage after retention

### 13.5 Rate limits

| Endpoint | Free | Pro |
|---|---|---|
| `GET /orders` (admin list) | 300/min | 6000/min |
| `GET /storefront/orders` (customer) | 60/min per customer | 60/min |
| `POST /orders/{id}:cancel` | 30/min | 300/min |
| `POST /orders:bulk-*` | 6/hour (1000 max) | 60/hour |
| Order search | 60/min | 600/min |

### 13.6 PCI scope

Orders reference payment via foreign key but never store PAN. `paid_amount`, payment_status are aggregates only.

---

## 14. Testing

### 14.1 Unit

```
TEST-UNIT-ORDER-001  StatusDeriver — all combinations
TEST-UNIT-ORDER-002  CancellationPolicy — phase-based eligibility
TEST-UNIT-ORDER-003  CompositeOnHold — multi-hold composition
TEST-UNIT-ORDER-004  PaidAmountAggregator — multi-payment sum
TEST-UNIT-ORDER-005  RefundedAmountAggregator
TEST-UNIT-ORDER-006  FulfillmentStatusDeriver — per-line qty roll-up
TEST-UNIT-ORDER-007  OrderNumberFormatter
TEST-UNIT-ORDER-008  PartialCancellationAdjuster
TEST-UNIT-ORDER-009  GuestTokenValidator (HMAC + expiry)
TEST-UNIT-ORDER-010  OrderSearchQueryBuilder (Meilisearch)
```

### 14.2 Integration

```
TEST-INT-ORDER-001   Place order → all snapshots correct
TEST-INT-ORDER-002   Payment authorized → status='confirmed'
TEST-INT-ORDER-003   First shipment created → status='processing'
TEST-INT-ORDER-004   All shipments delivered → status='fulfilled'
TEST-INT-ORDER-005   Cancel order pre-fulfillment → atomic saga
TEST-INT-ORDER-006   Cancel order with shipped → reject
TEST-INT-ORDER-007   Partial cancel line → compensating refund
TEST-INT-ORDER-008   Partial refund → status='partially_refunded'
TEST-INT-ORDER-009   Full refund → status='refunded'
TEST-INT-ORDER-010   On-hold multi-hold composability
TEST-INT-ORDER-011   Order recovery from crashed placement
TEST-INT-ORDER-012   Concurrent status recompute (race) — serialized
TEST-INT-ORDER-013   Bulk cancel 100 orders
TEST-INT-ORDER-014   Search indexer reflects status changes
TEST-INT-ORDER-015   Customer accesses own orders only
TEST-INT-ORDER-016   Guest token validation + expiry
TEST-INT-ORDER-017   Auto-cancel unpaid bank transfer after 7d
TEST-INT-ORDER-018   COD returned → auto-cancel
TEST-INT-ORDER-019   GDPR anonymization preserves order, removes PII
TEST-INT-ORDER-020   Transitions log immutable + complete
TEST-INT-ORDER-021   Address change pre-shipment + audit
TEST-INT-ORDER-022   Risk re-score updates flag + signals
TEST-INT-ORDER-023   Tag add/remove + audit
TEST-INT-ORDER-024   Subscription child order links to parent
TEST-INT-ORDER-025   Bulk export 10k orders to CSV
```

### 14.3 E2E

```
TEST-E2E-ORDER-001  Customer places order → views in account
TEST-E2E-ORDER-002  Admin cancels order → customer receives email + refund
TEST-E2E-ORDER-003  Customer cancels eligible order from account
TEST-E2E-ORDER-004  Admin places order on hold + releases
TEST-E2E-ORDER-005  Fraud review flow (high risk → admin approves)
TEST-E2E-ORDER-006  Guest accesses order via email link
TEST-E2E-ORDER-007  Bulk fulfillment generates labels for selected orders
TEST-E2E-MCP-ORDER-001  Agent lists customer's orders via MCP
```

### 14.4 Load

```
TEST-LOAD-ORDER-001  10k concurrent order placements (Black Friday sim) → no number collisions, < 5s p95
TEST-LOAD-ORDER-002  500 RPS GET /orders → p95 < 100 ms
TEST-LOAD-ORDER-003  Bulk cancel 1000 orders → < 60s
TEST-LOAD-ORDER-004  Order search 50 RPS with complex filters → p95 < 100 ms
```

### 14.5 Chaos

```
TEST-CHAOS-ORDER-001  Backend crash during cancel saga → resume + complete
TEST-CHAOS-ORDER-002  Payment provider down → order stays pending; reconcile completes later
TEST-CHAOS-ORDER-003  Search index unavailable → graceful fallback to Postgres LIKE search
```

---

## 15. Implementation checklist

### Backend
- [ ] **[S]** Drizzle schema `packages/db/src/schema/orders/*.ts`
- [ ] **[S]** Migrace `20260530_001_create_order_tables.sql` (partitions for transitions + events)
- [ ] **[L]** `OrderService` core — get, list, search, cancel, on-hold, edit
- [ ] **[L]** `OrderStatusDeriver` — pure function + service
- [ ] **[M]** `OrderTransitionRecorder`
- [ ] **[M]** `OrderEventEmitter` (customer-visible timeline)
- [ ] **[L]** `OrderCancellationOrchestrator` — saga across payments, shipments, inventory, invoices
- [ ] **[M]** `OrderHoldManager`
- [ ] **[M]** `OrderNumberAllocator` — atomic
- [ ] **[M]** `OrderSearchIndexer` (Meilisearch)
- [ ] **[M]** `BulkOperationCoordinator`
- [ ] **[S]** `OrderTagManager`
- [ ] **[S]** `OrderRiskRescorer` — integrate fraud engine from `30`
- [ ] **[M]** REST endpoints per §6
- [ ] **[M]** GraphQL types + resolvers + DataLoaders
- [ ] **[S]** tRPC router (admin)
- [ ] **[M]** MCP tools `order.get_status`, `order.list_my_orders`
- [ ] **[S]** Guest token signer + validator

### Background jobs
- [ ] **[M]** JOB-AUTO-CANCEL-UNPAID-ORDERS
- [ ] **[S]** JOB-AUTO-CANCEL-COD-RETURNED
- [ ] **[L]** JOB-RECOMPUTE-ORDER-STATUS (core invocation point)
- [ ] **[M]** JOB-SYNC-PAID-AMOUNT, JOB-SYNC-REFUNDED-AMOUNT, JOB-SYNC-FULFILLMENT-STATUS
- [ ] **[M]** JOB-INDEX-ORDER
- [ ] **[S]** JOB-AUTO-COMPLETE-FULFILLED-ORDERS (configurable grace period)
- [ ] **[S]** JOB-DETECT-STUCK-ORDERS
- [ ] **[S]** JOB-SEND-ORDER-*-EMAIL (per event)
- [ ] **[S]** JOB-COMPUTE-CUSTOMER-AGGREGATES (per `18`)
- [ ] **[M]** JOB-BULK-CANCEL-ORDERS, JOB-BULK-EXPORT-ORDERS
- [ ] **[M]** JOB-RECOVER-LOST-ORDERS (overlap with checkout reconcile)
- [ ] **[S]** JOB-DETECT-FRAUD-PATTERNS
- [ ] **[S]** JOB-PURGE-OLD-TRANSITIONS (retention)

### Frontend — Admin
- [ ] **[L]** Orders list view (filters, search, bulk select)
- [ ] **[L]** Order detail view (left main + right sidebar with pivots)
- [ ] **[M]** Cancel order modal with refund option
- [ ] **[M]** Partial line cancel modal
- [ ] **[M]** On-hold modal + release UI
- [ ] **[M]** Bulk operations workflows (cancel, fulfill, export, print)
- [ ] **[M]** Fraud review dashboard
- [ ] **[S]** Tag manager
- [ ] **[S]** Custom event / note added UI
- [ ] **[S]** Send notification (ad-hoc email) modal
- [ ] **[S]** Order analytics dashboards

### Frontend — Storefront
- [ ] **[M]** "My orders" list page (logged-in)
- [ ] **[L]** Order detail page (customer view)
- [ ] **[S]** Guest order access page (token-based)
- [ ] **[S]** Cancel order self-service UI (if enabled)
- [ ] **[S]** Initiate return CTA (handoff to `17`)
- [ ] **[S]** Contact merchant form

### Tests
- [ ] **[M]** Per §14

### Docs
- [ ] **[S]** "Managing orders" merchant guide
- [ ] **[S]** "Bulk fulfillment workflow" warehouse guide
- [ ] **[S]** "Fraud review playbook" admin guide
- [ ] **[S]** "Customer order lifecycle" customer-facing help
- [ ] **[S]** Developer: order event hooks for plugins
- [ ] **[S]** Developer: MCP order tools integration

---

## 16. Open questions

### Q-ORDER-001: Auto-complete grace period
**Otázka:** After fulfilled, when does order auto-complete? Influences customer return eligibility window.

**Status:** Tenant configurable, default 14 days post-delivery (matches EU 14-day return right). Auto-complete via `JOB-AUTO-COMPLETE-FULFILLED-ORDERS` daily.

### Q-ORDER-002: Customer self-cancel
**Otázka:** Default off (support request). Enable as opt-in per tenant?

**Status:** Per tenant `tenant.settings.allow_customer_self_cancel ∈ ('never','pre_payment','pre_fulfillment','always')`. Default: `pre_payment`.

### Q-ORDER-003: Order edit history rich diff
**Otázka:** Transitions log records status changes. Should we also record field-level diff (e.g., address before/after)?

**Status:** Already part of `metadata.diff` in `order_transitions` for `manual_override` kind. Not for status auto-transitions (covered by from_value / to_value).

### Q-ORDER-004: Auto-tagging rules
**Otázka:** "high_value" auto-tag if total > X; "gift" if any gift_message; "international" if shipping_country ≠ tenant_country?

**Status:** Fáze 2 feature. MVP: manual tag only.

### Q-ORDER-005: Order forecasting / predictive ETA
**Otázka:** AI-based fulfillment timeline projection ("Likely shipped Friday, delivered Mon")?

**Status:** Fáze 3+ AI feature. MVP: shipping carrier estimates only.

### Q-ORDER-006: Order assigned to staff member
**Otázka:** Customer service rep ownership of order — for follow-up tracking?

**Status:** v1.0+ feature. Schema-ready via `metadata.assigned_to_user_id`. Workflow Fáze 2.

### Q-ORDER-007: Order priority field
**Otázka:** Some orders flagged "rush" for fulfillment prioritization?

**Status:** Via tags + sort by carriers (express service). Explicit priority field Fáze 2.

### Q-ORDER-008: Multiple payment methods (split)
**Otázka:** Gift card + card simultaneously — multiple payments rows per order. UI display?

**Status:** Supported (per `13`); UI shows sum + breakdown. Customer sees "Paid with gift card + Visa".

### Q-ORDER-009: Wholesale order workflow (B2B variant)
**Otázka:** PO acceptance, NET terms tracking, recurring delivery schedules?

**Status:** Fáze 2 in `21-b2b-complete.md`. Schema reuses orders + `metadata.po_workflow`.

### Q-ORDER-010: Sub-orders / split fulfillment models
**Otázka:** Multi-warehouse order → multiple shipments visible to customer as separate "orders"?

**Status:** Single order with multiple shipments (preferred). Sub-orders are anti-pattern for accounting. Detail v `14`.

### Q-ORDER-011: Order edit creates new invoice or amend
**Otázka:** Cancel line → existing invoice unchanged (snapshot legal); credit note issued instead?

**Status:** Per RULE-ORDER-002 + RULE-TAX-010: invoice immutable; credit note covers adjustment. Pricing engine recomputes adjustments for refund amount.

### Q-ORDER-012: Order cloning (re-order)
**Otázka:** "Order again" CTA for customer = create new cart with same items?

**Status:** Storefront feature, not order domain. `19-marketing-seo.md` or storefront helper.

### Q-ORDER-013: Order import from external system
**Otázka:** Legacy data migration — import orders with original numbers, history?

**Status:** Admin tool with explicit `source='imported'`, backdated `placed_at`. Sequences extended.

### Q-ORDER-014: Marketplace seller routing
**Otázka:** Order with items from multiple sellers — split orders or single order with seller breakdown?

**Status:** Fáze 4 marketplace. Detail v `25-marketplace.md`. Initial design: split into sub-orders per seller atomically.

### Q-ORDER-015: Order analytics — DAR (Days Active Receivable)
**Otázka:** Days from placement to payment (for cashflow forecasting)?

**Status:** Analytics in `20-analytics-reporting.md`. Computed from `placed_at` + `payments.captured_at`.

### Q-ORDER-016: Voice / phone order entry
**Otázka:** Customer service rep takes order over phone — manual creation in admin?

**Status:** Yes, `source='admin'`. UI flow: admin search customer, build cart, place order on behalf. Detail covered in `12-checkout.md` staff assist flow.

### Q-ORDER-017: Order recurrence (subscription parent)
**Otázka:** Subscription's first order vs recurring child orders — distinguishable?

**Status:** `source='recurring'` + `parent_order_id` distinguishes children. Detail v `24-subscriptions.md`.

### Q-ORDER-018: Order auto-completion considers reviews
**Otázka:** Hold completion until customer leaves review (post-delivery prompt)?

**Status:** Out of scope; not blocking. Review prompts in `19-marketing-seo.md`.

### Q-ORDER-019: Insider trading / employee orders
**Otázka:** Internal merchant employees can place test orders; tag for analytics exclusion?

**Status:** Schema-ready via `metadata.is_test=true` flag (Fáze 2). Tag-based exclusion in analytics queries.

### Q-ORDER-020: Order weight calculation for shipping
**Otázka:** Order's total weight computed from items — used for shipping rate; cached?

**Status:** Stored in `metadata.total_weight_grams` at placement for fulfillment workflow. Detail v `14`.

---

## 📅 Změny

| Datum | Změna |
|---|---|
| 2026-05-19 | Initial — Order management domain. Aggregate status derived from payment + fulfillment, append-only transitions, customer-visible events, saga cancellation, bulk operations, fraud review workflow. |

---

**Konec Order Management.**

➡️ Pokračovat na: [`17-returns-refunds.md`](17-returns-refunds.md)
