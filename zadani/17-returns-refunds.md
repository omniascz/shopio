# 17 – RETURNS & REFUNDS

> **Doména:** RMA (Return Merchandise Authorization) workflow. Customer initiates → merchant approves → label issued → goods received → restock decision → refund/exchange. Coordinuje s payments (`13`), shipping (`14`), tax (`15`), inventory (`09`), orders (`16`).

**Datum:** 2026-05-20
**Verze:** 1.0
**Status:** 🟡 DESIGN
**Reference:** [03 §10](03-data-models-master.md#10-returns--refunds) · [13-payments.md](13-payments.md) · [14-shipping.md](14-shipping.md) · [15-tax-compliance.md](15-tax-compliance.md) · [16-order-management.md](16-order-management.md)

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
13. [Security & legal](#13-security--legal)
14. [Testing](#14-testing)
15. [Implementation checklist](#15-implementation-checklist)
16. [Open questions](#16-open-questions)

---

## 0. Domain overview

### 0.1 Co tato doména **je**

- **RMA (Return Merchandise Authorization)** — customer-initiated request to return delivered item(s)
- **Return reasons** — typed enum (`defective`, `wrong_item`, `not_as_described`, `changed_mind`, `shipping_damage`, `size_issue`, `quality_issue`, `other`)
- **Approval workflow** — auto-approve (per merchant policy) OR manual review queue
- **Return label generation** — handoff to `14-shipping.md`; carrier issues reverse label
- **Return shipment tracking** — incoming events update RMA status
- **Restocking decision** — `restock` (back to inventory) / `damage` (write-off) / `recycle` / `donate` / `quarantine` (Fáze 2 hazardous goods)
- **Refund issuance** — handoff to `13-payments.md`; original method or alternative
- **Credit notes** — handoff to `15-tax-compliance.md` for tax-compliant record
- **Exchange flow** — return + new order in 1 workflow (Fáze 2 advanced)
- **Partial returns** — subset of order_items, or fractional qty
- **Return shipping cost** — configurable (customer pays / merchant pays / free / above_threshold)
- **Self-service portal** — customer initiates via storefront (no support ticket needed)
- **Return windows** — per-tenant policy (EU 14-day mandatory, extended up to 100 days configurable)
- **Return fraud detection** — pattern matching (serial returner, abuse signals)
- **Return rate analytics** — per product/category/customer
- **EU consumer rights compliance** — 14-day cooling-off mandatory in EU
- **B2B returns** — different rules (often non-returnable; negotiated)

### 0.2 Co tato doména **NENÍ**

- ❌ Refund mechanic itself (→ `13-payments.md` — refund row creation, provider call)
- ❌ Credit note PDF/ISDOC (→ `15-tax-compliance.md` — invoice domain owns; we trigger)
- ❌ Reverse shipping carrier API (→ `14-shipping.md` — label generation; we trigger)
- ❌ Inventory restocking (→ `09-inventory.md` — stock_movements; we trigger)
- ❌ Order edits (→ `16-order-management.md`)
- ❌ Cancellation pre-fulfillment (→ `16-order-management.md` cancellation flow)
- ❌ Warranty / repair workflows (→ Fáze 3+ separate domain)
- ❌ Marketplace seller returns routing (→ `25-marketplace.md` Fáze 4)

### 0.3 Diferenciátory

1. **EU consumer rights nativně** — 14-day cooling-off enforced; reverse charge VAT handled correctly
2. **Self-service portal first-class** — customer doesn't need to email support; reduces merchant ops
3. **Restocking workflow integrated** — fyzicky received → automatic inventory restock OR damage write-off via shipping events
4. **Atomic refund + credit note** — saga ensures tax record + refund in lockstep
5. **Return label by carrier** — automatic via carrier API (Zásilkovna, PPL, ČP); customer doesn't pay upfront if merchant covers
6. **Fraud signals** — serial returner detection, "wardrobing" patterns
7. **Configurable policy per product** — non-returnable goods (perishables, hygiene, custom) flagged at order item level

---

## 1. References

- [03 §10](03-data-models-master.md#10-returns--refunds) — ENT-RETURN-001, ENT-RETURN-ITEM-001
- [13-payments.md](13-payments.md) — `refunds` rows, provider refund calls
- [14-shipping.md](14-shipping.md) — `generateReturnLabel(shipment_id)` API
- [15-tax-compliance.md](15-tax-compliance.md) — credit_note issuance triggered from EVENT-RETURN-REFUNDED
- [09-inventory.md](09-inventory.md) — restock movement (reason='return')
- [16-order-management.md](16-order-management.md) — order's `fulfillment_status` (`returned`/`partially_returned`), order's refunded_amount sync
- [18-customer-management.md](18-customer-management.md) — customer return rate
- [19-marketing-seo.md](19-marketing-seo.md) — return-related email automations
- [21-b2b-complete.md](21-b2b-complete.md) — B2B return restrictions
- [30-security.md](30-security.md) — fraud signal extension
- EU Consumer Rights Directive 2011/83/EU (14-day cooling-off)
- CZ: § 1829 občanského zákoníku (14-day right to withdraw from distance contract)

---

## 2. Personas

| Persona | Použití | Klíčové permissions |
|---|---|---|
| `PERSONA-MERCHANT-OWNER` | Configure policies, view all returns, approve/reject | `PERM-RETURN-*` |
| `PERSONA-CUSTOMER-SERVICE` | Process returns, approve/reject, refund | `PERM-RETURN-VIEW`, `PERM-RETURN-APPROVE`, `PERM-RETURN-PROCESS`, `PERM-PAYMENT-REFUND` |
| `PERSONA-WAREHOUSE-STAFF` | Receive returned goods, mark received, decide restock | `PERM-RETURN-VIEW`, `PERM-RETURN-RECEIVE`, `PERM-INVENTORY-ADJUST` |
| `PERSONA-CUSTOMER` | Initiate return, track status, view refund | Auth-gated to own orders |
| `PERSONA-GUEST` | Initiate return via order token | Token-gated |
| `PERSONA-AI-COPILOT` | Suggest approve/reject based on history, anomaly detection | `agent:returns:read`, `agent:returns:annotate` |
| `PERSONA-EXTERNAL-AGENT` | MCP `return.initiate`, `return.get_status` (per customer agent token, v1.0+) | `agent:returns:write` (scoped) |
| `PERSONA-FINANCE-MANAGER` | Return analytics, financial impact, write-off accounting | `PERM-RETURN-FINANCIAL-REPORT` |

---

## 3. Data models

### 3.1 `returns` ([ENT-RETURN-001](03-data-models-master.md#ent-return-001))

```sql
CREATE TABLE returns (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  pub_id TEXT NOT NULL,                                            -- ret_ NanoID
  number TEXT NOT NULL,                                              -- "RMA-2026-00000123" per tenant per year
  order_id UUID NOT NULL REFERENCES orders(id),
  customer_id UUID NULL REFERENCES customers(id),
  customer_email CITEXT NOT NULL,                                    -- snapshot for guest returns
  -- status
  status TEXT NOT NULL CHECK (status IN (
    'requested',           -- customer submitted; awaiting approval
    'approved',            -- merchant accepted; label may be sent
    'rejected',            -- merchant declined
    'label_issued',        -- return label generated; customer ships
    'in_transit',          -- carrier picked up
    'received',            -- merchant warehouse received goods
    'inspected',           -- restock decision made
    'refunded',            -- refund issued
    'partially_refunded',  -- some items refunded, others rejected at inspection
    'closed',              -- workflow complete
    'cancelled',           -- customer or merchant cancelled mid-flow
    'expired'              -- customer didn't ship within window
  )) DEFAULT 'requested',
  status_entered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- request meta
  reason_code TEXT NOT NULL CHECK (reason_code IN (
    'defective','wrong_item','not_as_described','changed_mind',
    'shipping_damage','size_issue','quality_issue','arrived_late',
    'duplicate_order','missing_parts','other'
  )),
  reason_notes TEXT NULL,
  customer_note TEXT NULL,
  staff_note TEXT NULL,
  -- refund preferences
  preferred_refund_method TEXT NOT NULL CHECK (preferred_refund_method IN (
    'original_payment','store_credit','exchange','bank_transfer','gift_card'
  )) DEFAULT 'original_payment',
  is_exchange_request BOOLEAN NOT NULL DEFAULT false,
  exchange_for_order_id UUID NULL REFERENCES orders(id),              -- linked replacement order (v1.0+ flow)
  -- shipping
  return_carrier_code TEXT NULL,                                       -- which carrier for return shipment
  return_service_code TEXT NULL,
  return_shipment_id UUID NULL REFERENCES shipments(id),                -- linked reverse shipment
  return_tracking_number TEXT NULL,
  return_label_media_id UUID NULL REFERENCES media(id),
  return_shipping_cost_amount BIGINT NULL,
  return_shipping_cost_currency CHAR(3) NULL,
  return_shipping_cost_payer TEXT NOT NULL CHECK (return_shipping_cost_payer IN ('customer','merchant','split')) DEFAULT 'customer',
  -- pickup point (for pickup-based returns)
  return_pickup_point_id UUID NULL REFERENCES pickup_points(id),
  -- amounts (computed)
  requested_refund_amount BIGINT NOT NULL DEFAULT 0,                    -- sum of items requested for refund
  approved_refund_amount BIGINT NOT NULL DEFAULT 0,                     -- after inspection adjustments
  actual_refund_amount BIGINT NOT NULL DEFAULT 0,                      -- final amount refunded
  restocking_fee_amount BIGINT NOT NULL DEFAULT 0,                     -- optional fee deduction
  refund_currency CHAR(3) NULL,
  -- timestamps
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ NULL,
  rejected_at TIMESTAMPTZ NULL,
  rejection_reason TEXT NULL,
  label_issued_at TIMESTAMPTZ NULL,
  received_at TIMESTAMPTZ NULL,
  inspected_at TIMESTAMPTZ NULL,
  refunded_at TIMESTAMPTZ NULL,
  closed_at TIMESTAMPTZ NULL,
  cancelled_at TIMESTAMPTZ NULL,
  expires_at TIMESTAMPTZ NULL,                                          -- customer must ship by this date
  -- attribution
  initiated_by_actor_kind TEXT NOT NULL CHECK (initiated_by_actor_kind IN ('customer','staff','agent','system')),
  initiated_by_actor_id UUID NULL,
  approved_by_user_id UUID NULL,
  received_by_user_id UUID NULL,
  inspected_by_user_id UUID NULL,
  -- linked credit note + refund
  credit_note_invoice_id UUID NULL REFERENCES invoices(id),              -- from `15`
  refund_payment_ids UUID[] NOT NULL DEFAULT '{}',                         -- from `13`
  -- fraud / risk
  fraud_risk_score INTEGER NULL,                                          -- 0-100
  fraud_signals JSONB NULL,
  is_flagged_for_review BOOLEAN NOT NULL DEFAULT false,
  -- compliance
  withdraws_from_eu_cooling_off BOOLEAN NOT NULL DEFAULT false,           -- explicit "I'm using my 14-day right"
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_returns_pub_id UNIQUE (tenant_id, pub_id),
  CONSTRAINT uq_returns_number UNIQUE (tenant_id, number),
  CONSTRAINT ck_amounts_non_negative CHECK (
    requested_refund_amount >= 0 AND approved_refund_amount >= 0 AND
    actual_refund_amount >= 0 AND restocking_fee_amount >= 0
  )
);

CREATE INDEX idx_returns_order ON returns (order_id, requested_at DESC);
CREATE INDEX idx_returns_customer ON returns (customer_id, requested_at DESC) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_returns_status ON returns (tenant_id, status, status_entered_at DESC);
CREATE INDEX idx_returns_pending_review ON returns (tenant_id, requested_at) WHERE status = 'requested';
CREATE INDEX idx_returns_flagged ON returns (tenant_id, requested_at) WHERE is_flagged_for_review = true;
CREATE INDEX idx_returns_expires ON returns (expires_at) WHERE status IN ('approved','label_issued') AND expires_at IS NOT NULL;
CREATE INDEX idx_returns_reason ON returns (tenant_id, reason_code, status);
```

### 3.2 `return_items` ([ENT-RETURN-ITEM-001](03-data-models-master.md#ent-return-item-001))

Line-level details of return.

```sql
CREATE TABLE return_items (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  return_id UUID NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES order_items(id),
  variant_id UUID NULL REFERENCES product_variants(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  quantity_received INTEGER NOT NULL DEFAULT 0,
  quantity_approved INTEGER NULL,                                       -- after inspection (may differ from received)
  quantity_rejected INTEGER NOT NULL DEFAULT 0,
  -- pricing snapshot from order_item
  unit_refund_amount BIGINT NOT NULL,                                    -- unit_price - applied discounts (from order_item)
  refund_currency CHAR(3) NOT NULL,
  tax_refund_amount BIGINT NOT NULL DEFAULT 0,                            -- proportional tax refund
  total_refund_amount BIGINT NOT NULL,                                    -- unit × qty + tax (line refund)
  -- condition
  condition_on_receipt TEXT NULL CHECK (condition_on_receipt IN (
    'new','like_new','used','damaged','missing_parts','wrong_item','contaminated'
  ) OR condition_on_receipt IS NULL),
  condition_notes TEXT NULL,
  condition_photos_media_ids UUID[] NULL,                                  -- inspector photos
  -- restock decision
  restock_decision TEXT NULL CHECK (restock_decision IN (
    'restock','quarantine','damage','recycle','donate','destroy','return_to_supplier'
  ) OR restock_decision IS NULL),
  restock_warehouse_id UUID NULL REFERENCES warehouses(id),
  restock_quantity INTEGER NOT NULL DEFAULT 0,
  restock_movement_id UUID NULL,                                            -- → stock_movements.id (per `09`)
  restocked_at TIMESTAMPTZ NULL,
  restocked_by_user_id UUID NULL,
  -- per-line reason override
  line_reason_code TEXT NULL,
  line_reason_notes TEXT NULL,
  -- audit
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT ck_received_le_quantity CHECK (quantity_received <= quantity),
  CONSTRAINT ck_approved_le_received CHECK (quantity_approved IS NULL OR quantity_approved <= quantity_received),
  CONSTRAINT ck_restock_le_approved CHECK (restock_quantity <= COALESCE(quantity_approved, 0))
);

CREATE INDEX idx_return_items_return ON return_items (return_id, position);
CREATE INDEX idx_return_items_order_item ON return_items (order_item_id);
CREATE INDEX idx_return_items_pending_restock ON return_items (tenant_id, return_id) WHERE quantity_approved IS NOT NULL AND restock_decision IS NULL;
```

### 3.3 `return_events` *(audit + customer-visible timeline)*

```sql
CREATE TABLE return_events (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  return_id UUID NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN (
    'requested','approved','rejected','label_issued','shipped_by_customer',
    'received_at_warehouse','inspected','restock_decided','refund_initiated',
    'refund_succeeded','refund_failed','exchange_created','closed','cancelled','expired',
    'note_from_merchant','note_from_customer','status_changed','manual_override'
  )),
  is_customer_visible BOOLEAN NOT NULL DEFAULT true,
  title TEXT NOT NULL,
  description TEXT NULL,
  customer_facing_link TEXT NULL,
  actor_kind TEXT NOT NULL,
  actor_id UUID NULL,
  related_entity_type TEXT NULL,
  related_entity_id UUID NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_return_events_return ON return_events (return_id, occurred_at DESC);
```

### 3.4 `return_number_sequences`

Atomic per (tenant, year). Analogous to invoices/orders sequences.

```sql
CREATE TABLE return_number_sequences (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  sequence_code TEXT NOT NULL DEFAULT 'RMA',
  year INTEGER NOT NULL,
  current_position INTEGER NOT NULL DEFAULT 0,
  format_pattern TEXT NOT NULL DEFAULT '{code}-{year}-{position:08d}',
  reset_strategy TEXT NOT NULL DEFAULT 'yearly',
  is_active BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT uq_return_number_sequences UNIQUE (tenant_id, sequence_code, year)
);
```

### 3.5 `return_policies`

Per-tenant policy configuration; can be scoped to channel, customer_group, or product category (Fáze 2).

```sql
CREATE TABLE return_policies (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  channel_id UUID NULL REFERENCES channels(id),
  customer_group_id UUID NULL REFERENCES customer_groups(id),
  product_category_id UUID NULL REFERENCES categories(id),               -- Fáze 2
  -- window
  return_window_days INTEGER NOT NULL DEFAULT 14,                         -- 14 = EU minimum
  extended_window_days_for_logged_in INTEGER NULL,                         -- e.g., 30 days for members
  -- conditions
  requires_original_packaging BOOLEAN NOT NULL DEFAULT false,
  requires_proof_of_purchase BOOLEAN NOT NULL DEFAULT true,
  excluded_reason_codes TEXT[] NOT NULL DEFAULT '{}',                       -- e.g., merchant doesn't accept 'changed_mind'
  excluded_product_tags TEXT[] NOT NULL DEFAULT '{}',                        -- non-returnable (hygiene, custom)
  -- restocking
  restocking_fee_percent_basis_points INTEGER NULL,                         -- e.g., 1500 = 15%
  restocking_fee_min_amount BIGINT NULL,
  restocking_fee_max_amount BIGINT NULL,
  -- shipping
  return_shipping_cost_payer_default TEXT NOT NULL CHECK (return_shipping_cost_payer_default IN ('customer','merchant','split','free_above_threshold')) DEFAULT 'customer',
  free_return_above_amount BIGINT NULL,                                      -- pro 'free_above_threshold'
  -- approval
  auto_approve BOOLEAN NOT NULL DEFAULT false,
  auto_approve_reason_codes TEXT[] NULL,                                      -- e.g., only auto-approve defective + wrong_item
  auto_approve_max_amount BIGINT NULL,
  -- expiry
  approval_to_ship_days INTEGER NOT NULL DEFAULT 14,                          -- customer has X days to ship after approval
  -- compliance
  applies_eu_consumer_rights BOOLEAN NOT NULL DEFAULT true,
  -- timestamps
  is_active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMPTZ NULL,
  ends_at TIMESTAMPTZ NULL,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_return_policies_tenant_name UNIQUE (tenant_id, name)
);

CREATE UNIQUE INDEX uq_return_policies_default
  ON return_policies (tenant_id)
  WHERE is_default = true AND is_active = true;

CREATE INDEX idx_return_policies_active ON return_policies (tenant_id) WHERE is_active = true;
```

### 3.6 `return_fraud_signals` *(detection logs)*

```sql
CREATE TABLE return_fraud_signals (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  return_id UUID NULL REFERENCES returns(id) ON DELETE CASCADE,
  customer_id UUID NULL REFERENCES customers(id),
  signal_kind TEXT NOT NULL CHECK (signal_kind IN (
    'serial_returner','high_return_rate','wardrobing_pattern','reason_inconsistency',
    'address_change_anomaly','rapid_returns','high_value_pattern','manual_flag'
  )),
  severity INTEGER NOT NULL CHECK (severity BETWEEN 0 AND 100),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  context JSONB NULL,
  acted_upon_at TIMESTAMPTZ NULL,
  action_taken TEXT NULL,                                                   -- 'rejected','flagged_for_review','customer_warned','no_action'
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_return_fraud_signals_customer ON return_fraud_signals (customer_id, detected_at DESC) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_return_fraud_signals_unacted ON return_fraud_signals (tenant_id, severity DESC) WHERE acted_upon_at IS NULL;
```

### 3.7 Vztahy

```
tenants (1)──(N) return_policies
orders (1)──(N) returns
returns (1)──(N) return_items
returns (1)──(N) return_events
returns (1)──(0..1) shipments                  [reverse shipment]
returns (1)──(0..1) invoices                   [credit_note]
returns (1)──(N) payments                      [refund payments via refund_payment_ids array]
return_items (N)──(1) order_items              [original line]
return_items (N)──(1) warehouses               [where restocked]
return_items (N)──(0..1) stock_movements       [restock movement]
customers (1)──(N) returns
customers (1)──(N) return_fraud_signals
returns (1)──(0..1) orders                     [exchange_for_order_id replacement]
```

---

## 4. State machines

### 4.1 Return status lifecycle

```
                               ┌─────────────────────────────────────────────────────┐
                               │                                                     │
                               ▼                                                     │
[requested] ──auto/manual──▶ [approved] ──label gen──▶ [label_issued] ─────┐         │
     │                            │                                        │         │
     │ reject                     │ cancel (customer or merchant)           │ ship    │
     ▼                            ▼                                        ▼         │
[rejected]                   [cancelled]                            [in_transit]    │
                                                                          │         │
                                                                          │ arrived │
                                                                          ▼         │
                                                                    [received]      │
                                                                          │         │
                                                                          │ inspect │
                                                                          ▼         │
                                                                    [inspected]     │
                                                                          │         │
                                                ┌─────────────────────────┤         │
                                                │                          │         │
                                                ▼                          ▼         │
                                  [refunded]                    [partially_refunded] │
                                                │                          │         │
                                                └─────────┬────────────────┘         │
                                                          ▼                          │
                                                      [closed]                        │
                                                                                      │
[expired] ◀── customer didn't ship within window ─────────────────────────────────────┘
```

**Allowed transitions:**

| From | Event | To | Trigger / actor |
|---|---|---|---|
| `(none)` | `customer_submits` | `requested` | Customer or admin on behalf |
| `requested` | `auto_approve` | `approved` | System per policy |
| `requested` | `manual_approve` | `approved` | Customer service |
| `requested` | `reject` | `rejected` | Customer service (with reason) |
| `requested` | `cancel` (customer changed mind) | `cancelled` | Customer |
| `approved` | `issue_label` | `label_issued` | System (auto on approve) or admin |
| `approved` / `label_issued` | `cancel` | `cancelled` | Customer or admin |
| `label_issued` | `carrier_picked_up` (webhook) | `in_transit` | Shipping events from `14` |
| `label_issued` | `expire` (window passed, customer didn't ship) | `expired` | System |
| `in_transit` | `arrived_at_warehouse` (webhook) | `received` | Shipping events from `14` |
| `received` | `inspect` | `inspected` | Warehouse staff |
| `inspected` | `refund_full` | `refunded` | System (after refund processed) |
| `inspected` | `refund_partial` (some items rejected) | `partially_refunded` | System |
| `refunded` / `partially_refunded` | `close` | `closed` | System (after grace period) |
| `inspected` | `reject_post_inspection` (counterfeit, damaged-by-customer) | `rejected` | Customer service |
| any non-terminal | `manual_override` | (target state) | Admin escalation |

### 4.2 Return item lifecycle

Per line item, separate from RMA status:

```
[pending] → [received] → [approved/rejected at inspection] → [restock_decided] → [restocked]
                                                                                     ↓
                                                                            [stock_movement applied via `09`]
```

### 4.3 Refund issuance flow (atomic)

Triggered post-inspection:

```
EVENT-RETURN-INSPECTED
  ▼
JOB-PROCESS-RETURN-REFUND
  ├─ Compute final refund amount:
  │     = sum(return_items.unit_refund × quantity_approved + proportional tax)
  │     - restocking_fee (per policy)
  │     - return_shipping_cost (if customer pays)
  ├─ Call payment domain to issue refund (per `13`)
  ├─ Trigger credit note issuance (per `15` JOB-ISSUE-CREDIT-NOTE-FROM-REFUND)
  ├─ Update order's refunded_amount (sync from `13`)
  ├─ Trigger inventory restock per restock_decision (per `09`)
  ├─ Update returns.status → refunded / partially_refunded
  ├─ Emit EVENT-RETURN-REFUNDED + EVENT-RETURN-PARTIALLY-REFUNDED
  └─ Notify customer
```

Saga compensation if refund fails:
- Mark `return.status='inspected'` (revert)
- Add manual review flag
- Admin notified

### 4.4 Exchange flow (v1.0+ advanced)

```
[requested with is_exchange_request=true]
  ▼
Approve → goods received → inspected
  ▼
JOB-CREATE-EXCHANGE-ORDER:
  - Create new order with same customer, same items (potentially different variant if size_issue)
  - Source: 'admin' with metadata.exchange_for_return_id
  - Skip payment if value matches (use original payment as cover)
  - Link via returns.exchange_for_order_id
  - Generate shipment for new items
  ▼
Customer receives replacement; original return closes as 'closed' (no monetary refund)
```

MVP: not implemented; manual workflow via "Issue refund + create new order".

---

## 5. Business rules

### RULE-RTN-001: Eligibility window enforced

Customer can request return only if:
- Order status ∈ ('fulfilled', 'completed', 'partially_refunded') — must have received goods
- `now() <= order.fulfilled_at + return_policy.return_window_days` (EU minimum 14)
- Item not in `excluded_product_tags` or `excluded_reason_codes`
- Item `quantity_returned < quantity_fulfilled - quantity_cancelled`

If outside window: reject with explanation; customer service can manually override (admin permission).

### RULE-RTN-002: EU 14-day cooling-off mandatory

If `return_policies.applies_eu_consumer_rights=true` and customer is EU consumer (B2C, shipping address EU):
- 14 days minimum from delivery date (per `14-shipping.md` shipment.delivered_at)
- Customer doesn't need to provide reason (changed_mind acceptable)
- Customer pays return shipping (configurable; merchant may cover)
- Full refund within 14 days of merchant receiving goods (CZ § 1829)

Returns flagged `withdraws_from_eu_cooling_off=true` get expedited treatment.

### RULE-RTN-003: Non-returnable goods

`excluded_product_tags` (e.g., `hygiene`, `perishable`, `personalized`, `digital`, `gift_card`): blocks return initiation.

Customer service may override with manual approval + reason.

### RULE-RTN-004: Auto-approval criteria

If `return_policies.auto_approve=true`:
- Reason in `auto_approve_reason_codes`
- Amount ≤ `auto_approve_max_amount`
- Customer not flagged for fraud
- Items eligible

Then status `requested → approved` automatically. Otherwise manual review queue.

### RULE-RTN-005: Restocking fee

If `return_policies.restocking_fee_percent_basis_points` set:
- Fee = `requested_refund_amount × percent / 10000`
- Clamped to [`restocking_fee_min_amount`, `restocking_fee_max_amount`]
- Deducted from refund

EU consumer rights override: 14-day cooling-off forbids restocking fee EXCEPT if goods used beyond inspection. Detail per local law; tenant configurable behavior.

### RULE-RTN-006: Return shipping cost

Per `return_policies.return_shipping_cost_payer_default`:
- `customer`: customer pays at label time OR cost deducted from refund
- `merchant`: free return label
- `split`: configurable (% or fixed)
- `free_above_threshold`: free if `order.total_amount >= free_return_above_amount`

EU directive: customer pays standard return cost unless merchant offered free (B2C). MVP: configurable per merchant policy.

### RULE-RTN-007: Label issuance via carrier

Triggered post-approval (auto or manual). Calls `14-shipping.md`:
- Default carrier per policy or per original shipment carrier
- Return label PDF stored in `returns.return_label_media_id`
- `return_tracking_number` populated
- Customer emailed label + instructions

If carrier doesn't support return labels (some COD methods): manual return process — customer ships at own initiative with receipt.

### RULE-RTN-008: Return expiry

After `approved_at + return_policies.approval_to_ship_days` (default 14): if no carrier pickup event (`shipped_by_customer` event):
- Status → `expired`
- Customer notified (final reminder + grace 7 days)
- After grace: closed without refund
- Admin can manually re-open with override

### RULE-RTN-009: Quantity received vs requested

At warehouse receipt, staff records `quantity_received` per line. Possible mismatches:
- Less received → partial refund only for received
- More received (customer sent extra by accident) → flag for review; admin contacts customer
- Different items received → flag; possible fraud signal

### RULE-RTN-010: Inspection condition assessment

Warehouse staff records `condition_on_receipt` per line:
- `new` (sealed) → restock
- `like_new` (opened, untested) → restock or recycle
- `used` → judgment call per policy
- `damaged` → write-off (damage_movement reason)
- `missing_parts` → reject or partial refund
- `wrong_item` → return to sender (customer's mistake) or accept as merchant error
- `contaminated` → quarantine/destroy

Photos taken (`condition_photos_media_ids`) for audit.

### RULE-RTN-011: Restock decision permissions

`PERSONA-WAREHOUSE-STAFF` makes restock decision per item. Triggers `09-inventory.md` movement:
- `restock` → quantity_delta=+received, reason='return'
- `damage` → no positive movement; separate `damage` movement adjusts inventory ledger
- `recycle` / `donate` / `destroy` → no inventory movement; logged in metadata
- `quarantine` → temporary "quarantine warehouse"; later admin decides
- `return_to_supplier` → metadata link to supplier (Fáze 2 supplier returns)

### RULE-RTN-012: Refund amount computation

```
refund_amount =
  sum(return_items where quantity_approved > 0):
    unit_refund_amount × quantity_approved
    + tax_refund_amount (proportional)
  - restocking_fee_amount (if applicable)
  - return_shipping_cost_amount (if customer pays)
```

Final stored in `returns.actual_refund_amount`. Cap at original order's paid_amount for that item (no over-refund).

### RULE-RTN-012b: Refund method default

Default `original_payment` per policy. Override allowed:
- `store_credit` → gift card created with refund balance
- `bank_transfer` → manual entry of customer IBAN; refund via merchant's banking
- `gift_card` → existing gift card top-up
- `exchange` → no monetary refund; new order created (v1.0+)

If original method unavailable (e.g., COD): fall back to `store_credit` or `bank_transfer`.

### RULE-RTN-013: Tax refund proportional

Refund includes proportional tax. Computed per line:
- Original: `order_items.tax_amount` for full qty
- Refund: `tax_amount × (quantity_approved / original_quantity)`

Credit note (per `15`) records the tax adjustment. VAT recovered by merchant via tax filing.

### RULE-RTN-014: Credit note linkage

Per RULE-TAX-017: every refund triggers credit note issuance (`15-tax-compliance.md`). Linked via `returns.credit_note_invoice_id`.

Credit note number sequence: `CRD-{year}-{position}`.

### RULE-RTN-015: Order status sync

When return progresses:
- `received` → no order status change
- `inspected` → no order status change
- `refunded` → order.refunded_amount += return.actual_refund_amount; recompute order.status (may → `partially_refunded` or `refunded`)
- `refunded` with full coverage of order items → order.fulfillment_status='returned'
- `partially_refunded` → order.fulfillment_status='partially_returned'

Triggered via `EVENT-RETURN-REFUNDED` → `JOB-SYNC-REFUNDED-AMOUNT` (from `16`).

### RULE-RTN-016: Customer return rate tracking

Aggregated per customer in `18-customer-management.md` for fraud detection:
- `customers.metadata.return_rate_30d`
- `customers.metadata.return_rate_lifetime`
- High rate (e.g., >40%) triggers `serial_returner` fraud signal

### RULE-RTN-017: Fraud detection signals

Computed via `JOB-DETECT-RETURN-FRAUD-PATTERNS` (hourly):

| Signal | Logic |
|---|---|
| `serial_returner` | customer.return_rate_lifetime > 30% AND total_returns > 5 |
| `high_return_rate` | customer.return_rate_30d > 50% |
| `wardrobing_pattern` | many returns of same category, all within 14d of purchase, all "changed_mind" |
| `reason_inconsistency` | customer's return reasons inconsistent across orders (e.g., always different reason) |
| `address_change_anomaly` | shipping address changes between order + return |
| `rapid_returns` | >3 returns in 7 days |
| `high_value_pattern` | returns concentrated on high-value items |
| `manual_flag` | admin manually flagged |

Severity 0-100. Threshold > 70 auto-flags `is_flagged_for_review=true`.

### RULE-RTN-018: Return number gapless

Atomic allocation via `return_number_sequences` (per RULE-ORDER-001 pattern). Format: `RMA-2026-00000123`.

### RULE-RTN-019: Customer self-service portal eligibility

Storefront return wizard accessible:
- Logged-in customer: orders directly accessible
- Guest: via signed token from order confirmation email (per `16 RULE-ORDER-021`)
- Order must be in eligible status (per RULE-RTN-001)

Configurable per tenant: `tenant.settings.allow_customer_self_service_returns ∈ ('always','logged_in_only','disabled')`.

### RULE-RTN-020: B2B return restrictions

For B2B orders (`order.company_id IS NOT NULL`):
- Default policy: returns by negotiation only (not auto-eligible)
- Merchant configurable per company contract
- Restocking fee typically applied
- Reverse charge VAT: credit note must mirror (per `15-tax-compliance.md`)

### RULE-RTN-021: Return label cost

If carrier charges for return label generation (some services):
- Cost stored in `returns.return_shipping_cost_amount`
- Deducted from refund if customer pays
- Internal cost tracked per `14-shipping.md` shipment cost

### RULE-RTN-022: Multiple returns per order

Order may have multiple `returns` rows (separate customer requests over time). Each independent. Tracking: `order_items.quantity_returned` accumulates across all returns.

Cannot return item already fully returned.

### RULE-RTN-023: Partial line return

Customer returns 1 of 3 ks of variant. Allowed: `return_items.quantity=1` with `order_items.quantity=3`. Proportional refund.

### RULE-RTN-024: Reverse shipment integration

When carrier delivers return shipment to warehouse:
- `EVENT-SHIPMENT-DELIVERED` from `14` → enriched payload includes `shipment.metadata.return_id`
- Triggers `JOB-MARK-RETURN-RECEIVED`
- Sets `returns.received_at`, `returns.status='received'`
- Notifies merchant warehouse staff

### RULE-RTN-025: Cancel return mid-flow

Customer or admin can cancel before warehouse receives goods:
- Status: any of `requested`, `approved`, `label_issued` → `cancelled`
- If label issued: void carrier label (call `14`)
- If items shipped already: not cancellable (refund flow proceeds)

### RULE-RTN-026: Reject post-inspection

If goods received but unsuitable (counterfeit, damaged-by-customer beyond accepted use, missing significant parts):
- Status: `inspected` → `rejected` with explanation
- No refund issued
- Customer notified with options:
  - Pay return shipping for goods to come back
  - Forfeit goods (merchant disposes/donates)

Audit log mandatory.

### RULE-RTN-027: Exchange flow tax handling

If customer exchanges defective for new variant of same SKU at same price:
- No net VAT change
- Credit note for original line + new invoice line in single transaction OR matched cancellation

If exchange involves price difference: refund or charge difference; credit note + new invoice with deltas.

### RULE-RTN-028: Customer-initiated cancel within cooling-off

EU customer using cooling-off can withdraw fully:
- Even after items shipped/received, customer has right to demand full refund
- Customer pays return shipping (unless merchant offered free)
- Restocking fee forbidden (per EU directive)

Edge: if merchant policy more generous than EU minimum, apply more generous.

### RULE-RTN-029: Return audit log

Immutable trail via `return_events` (append-only) + global `audit_log` for:
- Approve/reject decisions
- Manual amount overrides
- Restock decisions
- Customer service note adds
- Fraud signal triggers

### RULE-RTN-030: GDPR

`returns.customer_note`, `return_items.condition_notes` may contain PII; subject to deletion. Anonymize on customer GDPR request; retain for accounting per `15-tax-compliance.md`.

---

## 6. REST API endpoints

### 6.1 Customer (storefront)

```
GET    /api/{date}/storefront/orders/{number}/eligible-items-for-return     # what can be returned + reason options
POST   /api/{date}/storefront/returns                                        # initiate return
GET    /api/{date}/storefront/returns                                        # my returns (logged-in)
GET    /api/{date}/storefront/returns/{number}                                # detail
GET    /api/{date}/storefront/returns/by-token?token=...                      # guest access
POST   /api/{date}/storefront/returns/{id}:cancel                              # before shipment
POST   /api/{date}/storefront/returns/{id}:add-note                            # customer adds info
GET    /api/{date}/storefront/returns/{id}/label                                # download label PDF
GET    /api/{date}/storefront/returns/{id}/events                                # customer-visible timeline
GET    /api/{date}/storefront/returns/{id}/instructions                          # merchant-customized return instructions
```

### 6.2 Admin / customer service

```
GET    /api/{date}/returns                                                   # list, filterable
GET    /api/{date}/returns/{id}
POST   /api/{date}/returns                                                   # admin creates on behalf
PATCH  /api/{date}/returns/{id}                                              # update notes, override fields
POST   /api/{date}/returns/{id}:approve
POST   /api/{date}/returns/{id}:reject
POST   /api/{date}/returns/{id}:mark-received
POST   /api/{date}/returns/{id}:mark-inspected
POST   /api/{date}/returns/{id}:process-refund                                # explicit trigger
POST   /api/{date}/returns/{id}:cancel
POST   /api/{date}/returns/{id}:close
POST   /api/{date}/returns/{id}:add-note
POST   /api/{date}/returns/{id}:flag-for-review
POST   /api/{date}/returns/{id}:resolve-flag
POST   /api/{date}/returns/{id}:regenerate-label
GET    /api/{date}/returns/{id}/events
GET    /api/{date}/returns/{id}/items

PATCH  /api/{date}/return-items/{id}                                          # quantity_received, condition_on_receipt, restock_decision
POST   /api/{date}/return-items/{id}:set-restock-decision
POST   /api/{date}/return-items/{id}:apply-restock                              # triggers JOB-RESTOCK-RETURN-ITEM

POST   /api/{date}/returns:bulk-approve
POST   /api/{date}/returns:bulk-reject
POST   /api/{date}/returns:bulk-export
```

### 6.3 Return policies

```
GET    /api/{date}/return-policies
POST   /api/{date}/return-policies
GET    /api/{date}/return-policies/{id}
PATCH  /api/{date}/return-policies/{id}
DELETE /api/{date}/return-policies/{id}
POST   /api/{date}/return-policies/{id}:set-default
```

### 6.4 Analytics

```
GET    /api/{date}/return-analytics/rate-by-product?period=30d
GET    /api/{date}/return-analytics/rate-by-category?period=30d
GET    /api/{date}/return-analytics/rate-by-customer?period=lifetime
GET    /api/{date}/return-analytics/reasons-breakdown?period=30d
GET    /api/{date}/return-analytics/restock-decisions-summary?period=30d
GET    /api/{date}/return-analytics/avg-processing-time?period=30d
```

### 6.5 Example: Initiate return (customer)

```http
POST /api/2026-05-20/storefront/returns HTTP/1.1
Authorization: Bearer customer_jwt
Idempotency-Key: ...

{
  "order_id": "ord_aB",
  "items": [
    { "order_item_id": "oit_xY", "quantity": 1, "reason_code": "wrong_item", "line_reason_notes": "Dostal jsem černou místo bílé" }
  ],
  "customer_note": "Prosím o vrácení na původní kartu.",
  "preferred_refund_method": "original_payment",
  "withdraws_from_eu_cooling_off": false
}
```

```jsonc
HTTP/1.1 201 Created
Location: /api/2026-05-20/storefront/returns/ret_aB3cD

{
  "data": {
    "id": "01927bea-...",
    "pub_id": "ret_aB3cD",
    "type": "return",
    "attributes": {
      "number": "RMA-2026-00000123",
      "status": "approved",
      "reason_code": "wrong_item",
      "requested_refund_amount": 49000,
      "approved_refund_amount": 49000,
      "currency": "CZK",
      "return_shipping_cost_payer": "merchant",
      "return_carrier_code": "zasilkovna",
      "return_tracking_number": "Z987654321CZ",
      "return_label_url": "https://cdn.shopio.com/labels/...?sig=...",
      "expires_at": "2026-06-03T23:59:59Z",
      "next_step": "Vytiskněte přiložený štítek a předejte zásilku na podací místo Zásilkovny do 14 dnů.",
      "items": [
        {
          "id": "...",
          "order_item_id": "oit_xY",
          "quantity": 1,
          "title": "Stolní lampa Luna (Bílá / Malá)",
          "unit_refund_amount": 49000,
          "total_refund_amount": 59290,
          "tax_refund_amount": 10290,
          "reason_code": "wrong_item"
        }
      ]
    }
  }
}
```

### 6.6 Example: List returns (admin)

```http
GET /api/2026-05-20/returns?status=requested&limit=50 HTTP/1.1
```

```jsonc
HTTP/1.1 200 OK

{
  "data": [
    {
      "id": "...",
      "pub_id": "ret_aB",
      "attributes": {
        "number": "RMA-2026-00000123",
        "status": "requested",
        "order_number": "ORD-2026-00001234",
        "customer_email": "jan.novak@example.com",
        "reason_code": "wrong_item",
        "requested_at": "2026-05-20T10:30:00Z",
        "requested_refund_amount": 49000,
        "currency": "CZK",
        "is_flagged_for_review": false,
        "fraud_risk_score": 8,
        "items_count": 1
      }
    },
    ...
  ],
  "page": { "cursor": "...", "has_more": true, "total": 23 }
}
```

### 6.7 Example: Approve return

```http
POST /api/2026-05-20/returns/ret_aB:approve HTTP/1.1
Authorization: Bearer staff_jwt
Idempotency-Key: ...

{
  "approved_refund_amount": 49000,
  "issue_label": true,
  "return_shipping_cost_payer": "merchant",
  "carrier_code": "zasilkovna",
  "service_code": "pickup_point",
  "staff_note": "Confirmed wrong color shipped; covering return shipping"
}
```

```jsonc
HTTP/1.1 200 OK

{
  "data": {
    "id": "...",
    "attributes": {
      "status": "label_issued",
      "approved_at": "2026-05-20T11:00:00Z",
      "label_issued_at": "2026-05-20T11:00:05Z",
      "return_tracking_number": "Z987654321CZ",
      "return_label_url": "https://...",
      "expires_at": "2026-06-03T23:59:59Z"
    },
    "actions_performed": ["created_return_shipment","sent_customer_email"]
  }
}
```

### 6.8 Example: Mark received + inspect

```http
POST /api/2026-05-20/returns/ret_aB:mark-received HTTP/1.1
Authorization: Bearer warehouse_jwt

{
  "items": [
    { "return_item_id": "rit_xY", "quantity_received": 1, "condition_on_receipt": "like_new" }
  ]
}
```

```jsonc
HTTP/1.1 200 OK

{
  "data": {
    "id": "...",
    "attributes": {
      "status": "received",
      "received_at": "2026-05-21T14:00:00Z",
      "items": [
        { "id": "rit_xY", "quantity_received": 1, "condition_on_receipt": "like_new" }
      ]
    },
    "next_step": "Inspect and set restock decision"
  }
}
```

```http
POST /api/2026-05-20/returns/ret_aB:mark-inspected HTTP/1.1

{
  "items": [
    {
      "return_item_id": "rit_xY",
      "quantity_approved": 1,
      "restock_decision": "restock",
      "restock_warehouse_id": "wh_main"
    }
  ],
  "staff_note": "OK; returning to inventory"
}
```

```jsonc
HTTP/1.1 200 OK

{
  "data": {
    "attributes": {
      "status": "inspected",
      "inspected_at": "2026-05-21T14:15:00Z",
      "approved_refund_amount": 59290
    },
    "next_step": "Refund will be processed automatically",
    "scheduled_actions": ["JOB-PROCESS-RETURN-REFUND scheduled at 2026-05-21T14:15:05Z"]
  }
}
```

### 6.9 Example: Eligible items for return (storefront helper)

```http
GET /api/2026-05-20/storefront/orders/ORD-2026-00001234/eligible-items-for-return HTTP/1.1
```

```jsonc
HTTP/1.1 200 OK

{
  "data": {
    "order_number": "ORD-2026-00001234",
    "is_eligible_for_return": true,
    "return_window_ends_at": "2026-06-03T23:59:59Z",
    "policy": {
      "return_window_days": 14,
      "return_shipping_cost_payer_default": "customer",
      "restocking_fee_percent": 0,
      "auto_approval_enabled": false
    },
    "items": [
      {
        "order_item_id": "oit_xY",
        "title": "Stolní lampa Luna (Bílá / Malá)",
        "quantity_total": 2,
        "quantity_already_returned": 0,
        "quantity_eligible": 2,
        "unit_refund_amount": 49000,
        "available_reason_codes": [
          { "code": "wrong_item", "label": "Zboží neodpovídá objednávce" },
          { "code": "defective", "label": "Vadné zboží" },
          { "code": "not_as_described", "label": "Nesouhlasí s popisem" },
          { "code": "changed_mind", "label": "Změnil jsem názor (do 14 dní)" }
        ]
      }
    ]
  }
}
```

---

## 7. GraphQL schema

```graphql
type Return implements Node & Timestamped {
  id: ID!
  pubId: String!
  number: String!
  order: Order!
  customer: Customer
  customerEmail: String!
  status: ReturnStatus!
  reasonCode: ReturnReasonCode!
  reasonNotes: String
  customerNote: String
  staffNote: String
  preferredRefundMethod: RefundMethod!
  isExchangeRequest: Boolean!
  exchangeForOrder: Order
  returnCarrierCode: String
  returnServiceCode: String
  returnShipment: Shipment
  returnTrackingNumber: String
  returnTrackingUrl: String
  returnLabelUrl: String
  returnShippingCost: Money
  returnShippingCostPayer: ReturnShippingCostPayer!
  returnPickupPoint: PickupPoint
  requestedRefundAmount: Money!
  approvedRefundAmount: Money!
  actualRefundAmount: Money!
  restockingFeeAmount: Money!
  refundCurrency: String
  requestedAt: DateTime!
  approvedAt: DateTime
  rejectedAt: DateTime
  rejectionReason: String
  labelIssuedAt: DateTime
  receivedAt: DateTime
  inspectedAt: DateTime
  refundedAt: DateTime
  closedAt: DateTime
  cancelledAt: DateTime
  expiresAt: DateTime
  approvedBy: User
  receivedBy: User
  inspectedBy: User
  initiatedBy: Actor!
  creditNote: Invoice
  refundPayments: [Payment!]!
  withdrawsFromEuCoolingOff: Boolean!
  fraudRiskScore: Int
  isFlaggedForReview: Boolean!
  items: [ReturnItem!]!
  events(customerVisibleOnly: Boolean = false): [ReturnEvent!]!
  createdAt: DateTime!
  updatedAt: DateTime!
  metadata: JSON
}

enum ReturnStatus {
  REQUESTED APPROVED REJECTED LABEL_ISSUED IN_TRANSIT
  RECEIVED INSPECTED REFUNDED PARTIALLY_REFUNDED
  CLOSED CANCELLED EXPIRED
}

enum ReturnReasonCode {
  DEFECTIVE WRONG_ITEM NOT_AS_DESCRIBED CHANGED_MIND
  SHIPPING_DAMAGE SIZE_ISSUE QUALITY_ISSUE ARRIVED_LATE
  DUPLICATE_ORDER MISSING_PARTS OTHER
}

enum ReturnShippingCostPayer { CUSTOMER MERCHANT SPLIT }

type ReturnItem {
  id: ID!
  orderItem: OrderItem!
  variant: ProductVariant
  quantity: Int!
  quantityReceived: Int!
  quantityApproved: Int
  quantityRejected: Int!
  unitRefundAmount: Money!
  taxRefundAmount: Money!
  totalRefundAmount: Money!
  conditionOnReceipt: ReturnItemCondition
  conditionNotes: String
  conditionPhotosUrls: [String!]
  restockDecision: ReturnRestockDecision
  restockWarehouse: Warehouse
  restockQuantity: Int!
  restockedAt: DateTime
  lineReasonCode: ReturnReasonCode
  lineReasonNotes: String
  position: Int!
}

enum ReturnItemCondition {
  NEW LIKE_NEW USED DAMAGED MISSING_PARTS WRONG_ITEM CONTAMINATED
}

enum ReturnRestockDecision {
  RESTOCK QUARANTINE DAMAGE RECYCLE DONATE DESTROY RETURN_TO_SUPPLIER
}

type ReturnEvent {
  id: ID!
  kind: ReturnEventKind!
  isCustomerVisible: Boolean!
  title: String!
  description: String
  customerFacingLink: String
  actor: Actor!
  occurredAt: DateTime!
}

enum ReturnEventKind {
  REQUESTED APPROVED REJECTED LABEL_ISSUED SHIPPED_BY_CUSTOMER
  RECEIVED_AT_WAREHOUSE INSPECTED RESTOCK_DECIDED REFUND_INITIATED
  REFUND_SUCCEEDED REFUND_FAILED EXCHANGE_CREATED CLOSED CANCELLED
  EXPIRED NOTE_FROM_MERCHANT NOTE_FROM_CUSTOMER STATUS_CHANGED MANUAL_OVERRIDE
}

type ReturnPolicy implements Node {
  id: ID!
  name: String!
  isDefault: Boolean!
  channel: Channel
  customerGroup: CustomerGroup
  productCategory: Category
  returnWindowDays: Int!
  extendedWindowDaysForLoggedIn: Int
  requiresOriginalPackaging: Boolean!
  requiresProofOfPurchase: Boolean!
  excludedReasonCodes: [ReturnReasonCode!]!
  excludedProductTags: [String!]!
  restockingFeePercent: Float
  restockingFeeMinAmount: Money
  restockingFeeMaxAmount: Money
  returnShippingCostPayerDefault: ReturnShippingCostPayer!
  freeReturnAboveAmount: Money
  autoApprove: Boolean!
  autoApproveReasonCodes: [ReturnReasonCode!]
  autoApproveMaxAmount: Money
  approvalToShipDays: Int!
  appliesEuConsumerRights: Boolean!
  isActive: Boolean!
}

type ReturnEligibilityInfo {
  orderNumber: String!
  isEligibleForReturn: Boolean!
  returnWindowEndsAt: DateTime
  policy: ReturnPolicy!
  items: [ReturnEligibleItem!]!
  ineligibleReason: String
}

type ReturnEligibleItem {
  orderItem: OrderItem!
  quantityTotal: Int!
  quantityAlreadyReturned: Int!
  quantityEligible: Int!
  unitRefundAmount: Money!
  availableReasonCodes: [ReturnReasonOption!]!
}

type ReturnReasonOption {
  code: ReturnReasonCode!
  label: String!
}

extend type Query {
  returns(first: Int, after: String, filter: ReturnFilter): ReturnConnection! @auth(requires: PERM_RETURN_VIEW)
  return(id: ID, pubId: String, number: String): Return
  myReturns(first: Int, after: String): ReturnConnection!
  returnByGuestToken(token: String!): Return
  returnPolicies: [ReturnPolicy!]! @auth(requires: PERM_RETURN_POLICY_VIEW)
  returnEligibility(orderNumber: String!): ReturnEligibilityInfo!
}

input ReturnFilter {
  status: [ReturnStatus!]
  reasonCode: [ReturnReasonCode!]
  customerId: ID
  orderId: ID
  isFlaggedForReview: Boolean
  requestedAfter: DateTime
  requestedBefore: DateTime
  minRefundAmount: MoneyInput
  maxRefundAmount: MoneyInput
}

extend type Mutation {
  initiateReturn(input: InitiateReturnInput!, idempotencyKey: String!): Return!
  cancelReturn(id: ID!, reason: String): Return!
  addReturnNote(id: ID!, note: String!, visibleToCustomer: Boolean = false): Return!

  approveReturn(id: ID!, input: ApproveReturnInput!): Return! @auth(requires: PERM_RETURN_APPROVE)
  rejectReturn(id: ID!, reason: String!): Return! @auth(requires: PERM_RETURN_APPROVE)
  markReturnReceived(id: ID!, input: MarkReceivedInput!): Return! @auth(requires: PERM_RETURN_RECEIVE)
  markReturnInspected(id: ID!, input: MarkInspectedInput!): Return! @auth(requires: PERM_RETURN_PROCESS)
  processReturnRefund(id: ID!): Return! @auth(requires: PERM_PAYMENT_REFUND)
  flagReturnForReview(id: ID!, signal: String!): Return! @auth(requires: PERM_RETURN_FLAG)
  resolveReturnFlag(id: ID!, resolution: String!): Return! @auth(requires: PERM_RETURN_FLAG)
  regenerateReturnLabel(id: ID!): Return! @auth(requires: PERM_RETURN_APPROVE)
  closeReturn(id: ID!): Return! @auth(requires: PERM_RETURN_PROCESS)

  setRestockDecision(returnItemId: ID!, decision: ReturnRestockDecision!, warehouseId: ID): ReturnItem! @auth(requires: PERM_RETURN_PROCESS)
  applyRestock(returnItemId: ID!): ReturnItem! @auth(requires: PERM_INVENTORY_ADJUST)

  bulkApproveReturns(ids: [ID!]!): [BulkReturnResult!]! @auth(requires: PERM_RETURN_APPROVE)
  bulkRejectReturns(ids: [ID!]!, reason: String!): [BulkReturnResult!]! @auth(requires: PERM_RETURN_APPROVE)

  createReturnPolicy(input: ReturnPolicyInput!): ReturnPolicy! @auth(requires: PERM_RETURN_POLICY_MANAGE)
  updateReturnPolicy(id: ID!, input: ReturnPolicyInput!): ReturnPolicy! @auth(requires: PERM_RETURN_POLICY_MANAGE)
  setDefaultReturnPolicy(id: ID!): ReturnPolicy! @auth(requires: PERM_RETURN_POLICY_MANAGE)
}

type BulkReturnResult {
  returnId: ID!
  success: Boolean!
  error: String
}
```

---

## 8. Events

| Build-spec ID | Wire | Payload |
|---|---|---|
| `EVENT-RETURN-REQUESTED` | `return.requested` | `{ return }` |
| `EVENT-RETURN-APPROVED` | `return.approved` | `{ return, approver }` |
| `EVENT-RETURN-REJECTED` | `return.rejected` | `{ return, reason }` |
| `EVENT-RETURN-LABEL-ISSUED` | `return.label_issued` | `{ return, label_url, tracking_number }` |
| `EVENT-RETURN-IN-TRANSIT` | `return.in_transit` | `{ return }` |
| `EVENT-RETURN-RECEIVED` | `return.received` | `{ return }` |
| `EVENT-RETURN-INSPECTED` | `return.inspected` | `{ return, approved_amount }` |
| `EVENT-RETURN-RESTOCK-DECIDED` | `return.restock_decided` | `{ return_item, decision }` |
| `EVENT-RETURN-RESTOCKED` | `return.restocked` | `{ return_item, stock_movement_id, quantity }` |
| `EVENT-RETURN-REFUND-INITIATED` | `return.refund_initiated` | `{ return, refund_amount }` |
| `EVENT-RETURN-REFUNDED` | `return.refunded` | `{ return, actual_refund_amount }` |
| `EVENT-RETURN-PARTIALLY-REFUNDED` | `return.partially_refunded` | `{ return, actual_refund_amount, items_refunded, items_rejected }` |
| `EVENT-RETURN-REFUND-FAILED` | `return.refund_failed` | `{ return, error }` |
| `EVENT-RETURN-EXCHANGE-CREATED` | `return.exchange_created` | `{ return, new_order_id }` |
| `EVENT-RETURN-CLOSED` | `return.closed` | `{ return }` |
| `EVENT-RETURN-CANCELLED` | `return.cancelled` | `{ return, actor_kind }` |
| `EVENT-RETURN-EXPIRED` | `return.expired` | `{ return }` |
| `EVENT-RETURN-FLAGGED-FOR-REVIEW` | `return.flagged_for_review` | `{ return, signal }` |
| `EVENT-RETURN-FRAUD-SIGNAL-DETECTED` | `return.fraud_signal_detected` | `{ signal, customer_id }` |
| `EVENT-RETURN-POLICY-CHANGED` | `return_policy.changed` | `{ policy, previous_attributes }` |
| `EVENT-RETURN-NOTE-ADDED` | `return.note_added` | `{ return, note, visible_to_customer }` |

**Konzumenti:**
- Order management (`16`) — `EVENT-RETURN-REFUNDED` → JOB-SYNC-REFUNDED-AMOUNT
- Payments (`13`) — return triggers refund row creation
- Inventory (`09`) — restock decisions trigger stock_movements
- Tax/invoicing (`15`) — credit note issuance on refund success
- Shipping (`14`) — return label generation triggered on approve
- Customer notifications — emails per major events
- Fraud engine (`30`) — fraud signals updated
- Analytics — return rate tracking
- Webhooks delivery — per merchant subscription

---

## 9. Background jobs

| Job | Trigger | Queue | Frequency |
|---|---|---|---|
| `JOB-AUTO-APPROVE-RETURNS` | EVENT-RETURN-REQUESTED | `returns` | On-demand |
| `JOB-GENERATE-RETURN-LABEL` | EVENT-RETURN-APPROVED (if issue_label) | `shipping-labels` | On-demand |
| `JOB-MARK-RETURN-RECEIVED-FROM-SHIPMENT` | EVENT-SHIPMENT-DELIVERED (return shipment) | `returns` | On-demand |
| `JOB-PROCESS-RETURN-REFUND` | EVENT-RETURN-INSPECTED | `returns` | On-demand (after small delay) |
| `JOB-RESTOCK-RETURN-ITEM` | EVENT-RETURN-RESTOCK-DECIDED (decision='restock') | `inventory` | On-demand |
| `JOB-EXPIRE-PENDING-RETURNS` | scheduled | `returns-sweeper` | Daily |
| `JOB-SEND-RETURN-REMINDER` | scheduled | `notifications` | Daily (7 days before expiry) |
| `JOB-SEND-RETURN-STATUS-EMAIL` | EVENT-RETURN-* (configurable) | `notifications` | On-demand |
| `JOB-DETECT-RETURN-FRAUD-PATTERNS` | scheduled | `fraud` | Hourly |
| `JOB-UPDATE-CUSTOMER-RETURN-RATE` | EVENT-RETURN-CLOSED / REFUNDED | `analytics` | On-demand |
| `JOB-RETURN-ANALYTICS-DAILY` | scheduled | `analytics` | Daily |
| `JOB-CREATE-EXCHANGE-ORDER` | EVENT-RETURN-INSPECTED (if is_exchange_request) | `orders` | On-demand (v1.0+) |
| `JOB-AUTO-CLOSE-COMPLETED-RETURNS` | scheduled | `returns-sweeper` | Daily (close `refunded` returns after 7-day grace) |
| `JOB-RETRY-FAILED-REFUND` | EVENT-RETURN-REFUND-FAILED | `returns` | Exponential backoff |

### 9.1 JOB-PROCESS-RETURN-REFUND detail

```typescript
async function processReturnRefund(returnId: string) {
  return await pg.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('return:' + ${returnId})::bigint)`);
    
    const ret = await loadReturn(tx, returnId);
    if (ret.status !== 'inspected') return; // idempotent guard
    
    // Compute actual refund
    const items = await loadReturnItems(tx, returnId);
    const itemsRefund = sum(items, i => (i.unit_refund_amount * i.quantity_approved) + (i.tax_refund_amount * i.quantity_approved / i.quantity));
    const policy = await loadPolicy(tx, ret);
    const restockingFee = computeRestockingFee(policy, itemsRefund);
    const returnShippingCost = ret.return_shipping_cost_amount * (ret.return_shipping_cost_payer === 'customer' ? 1 : 0);
    
    const actualRefund = itemsRefund - restockingFee - returnShippingCost;
    if (actualRefund < 0) actualRefund = 0;
    
    // Create refund via payment service
    const refundResult = await paymentService.createRefund({
      orderId: ret.order_id,
      amount: actualRefund,
      currency: ret.refund_currency,
      reason: 'customer_request',
      returnId: ret.id,
      refundMethod: ret.preferred_refund_method,
    });
    
    // Update return
    await tx.execute(sql`
      UPDATE returns SET
        status = ${items.some(i => i.quantity_rejected > 0) ? 'partially_refunded' : 'refunded'},
        actual_refund_amount = ${actualRefund},
        restocking_fee_amount = ${restockingFee},
        refunded_at = now(),
        refund_payment_ids = array_append(refund_payment_ids, ${refundResult.payment_id}),
        updated_at = now()
      WHERE id = ${returnId}
    `);
    
    // Trigger credit note issuance via outbox (per `15`)
    await emitOutbox(tx, 'EVENT-REFUND-SUCCEEDED', { refund: refundResult, return: ret });
    await emitOutbox(tx, 'EVENT-RETURN-REFUNDED', { return: ret });
    
    // Sync order's refunded_amount (via `16`)
    await emitOutbox(tx, 'EVENT-ORDER-PAYMENT-STATUS-CHANGED', { order_id: ret.order_id });
    
    // Trigger restocks for items marked restock (via `09`)
    for (const item of items.filter(i => i.restock_decision === 'restock' && !i.restock_movement_id)) {
      await scheduleRestockJob(item);
    }
    
    return ret;
  });
}
```

### 9.2 JOB-DETECT-RETURN-FRAUD-PATTERNS

```typescript
async function detectReturnFraudPatterns() {
  // For each customer with returns in last 30 days:
  const customers = await getCustomersWithRecentReturns(30);
  
  for (const c of customers) {
    const lifetime = await getCustomerReturnStats(c.id, 'lifetime');
    const recent30 = await getCustomerReturnStats(c.id, 30);
    const recent7 = await getCustomerReturnStats(c.id, 7);
    
    if (lifetime.rate > 0.30 && lifetime.return_count > 5) {
      await recordFraudSignal(c.id, 'serial_returner', computeSeverity(lifetime.rate));
    }
    if (recent30.rate > 0.50) {
      await recordFraudSignal(c.id, 'high_return_rate', 70);
    }
    if (recent7.return_count > 3) {
      await recordFraudSignal(c.id, 'rapid_returns', 65);
    }
    // ... more pattern detections
  }
}
```

---

## 10. UI/UX flows

### FLOW-RTN-001: Customer initiates return

```
[Storefront /account/orders → click order]
   - Order detail with "Initiate return" button (if eligible per RULE-RTN-001)
        │
   click button
        │
        ▼
[Return wizard step 1: Select items]
   - List of order_items with checkbox + qty stepper
   - "Eligible until: 3. 6. 2026" badge
        │
        ▼
[Return wizard step 2: Reason per item]
   - Reason dropdown per selected item
   - Optional notes textarea
   - Photo upload (defective/damage cases)
        │
        ▼
[Return wizard step 3: Refund preferences]
   - Refund method dropdown
   - Optional: "Use my 14-day cooling-off right"
   - Note to merchant (optional)
        │
        ▼
[Return wizard step 4: Review + submit]
   - Summary: items, total refund, return shipping cost (who pays)
   - Submit
        │
        ▼
[POST /storefront/returns]
   - On success: redirect to /account/returns/{number}
   - Status: 'requested' or 'approved' (if auto)
   - If approved + label_issued: instruction page with PDF download
```

### FLOW-RTN-002: Admin review queue

```
[Admin → Returns → Pending review queue]
   - List of returns with status='requested'
   - Filters: fraud flag, reason, amount, customer
        │
   click return
        │
        ▼
[Return detail (admin view)]
   - Customer info + return rate history
   - Order context (link to order)
   - Items requested with reason per line
   - Customer photos
   - Customer note + staff note
   - Fraud signals + risk score
   - Actions:
     [Approve] → modal: confirm + label generation options
     [Reject] → modal: reason
     [Add note]
     [Flag for further review]
```

### FLOW-RTN-003: Warehouse receiving

```
[Warehouse app → Incoming returns]
   - Filter by expected today, by tracking number
        │
   scan tracking number on package
        │
        ▼
[Return detail (warehouse view)]
   - Quick action: "Mark received"
   - Per item: quantity_received input + condition dropdown
   - Photo upload per item
        │
        ▼
[POST /returns/{id}:mark-received]
   - Status → 'received'
   - Auto-prompt: "Inspect now?"
        │
        ▼
[Inspect mode]
   - Per item: quantity_approved + restock_decision
   - "Submit inspection"
        │
        ▼
[POST /returns/{id}:mark-inspected]
   - Status → 'inspected'
   - JOB-PROCESS-RETURN-REFUND scheduled (5s delay)
   - JOB-RESTOCK-RETURN-ITEM scheduled per restock=='restock' items
```

### FLOW-RTN-004: Customer tracks return

```
[Storefront /account/returns/{number}]
   - Status banner with current state ("Vaše vrácení je v přepravě")
   - Timeline:
     • "Žádost přijata, 20. 5. 10:30"
     • "Schváleno, štítek odeslán, 20. 5. 11:00"
     • "V přepravě, 21. 5. 09:00"
     • "Přijato na sklad, 22. 5. 14:00"
     • "Vráceno na účet, 23. 5. 11:00 — 590 Kč"
   - Tracking link to carrier
   - Items with status
   - Refund summary (amount, method, ETA)
   - "Contact support" CTA
```

### FLOW-RTN-005: Bulk approval

```
[Admin → Returns → Multi-select 20 returns matching criteria]
   - Bulk action menu → "Bulk approve"
        │
        ▼
[Bulk approve modal]
   - Confirmation: 20 returns will be approved
   - Auto-issue labels? [yes/no]
        │
        ▼
[POST /returns:bulk-approve]
   - 207 Multi-Status per result
```

### FLOW-RTN-006: Fraud review

```
[Admin → Returns → Flagged tab]
   - List of is_flagged_for_review=true
   - Per item: signals, severity, customer history
        │
   click return
        │
        ▼
[Fraud review panel]
   - Customer lifetime return rate: 45% (red)
   - Recent return reasons: 8x "changed_mind" in 30 days
   - Order pattern: always high-value items
   - Actions:
     [Approve anyway] → proceed normal flow
     [Reject all] → cancel return
     [Customer warning] → email customer about pattern
     [Add manual flag for future]
```

---

## 11. Edge cases & error handling

| Scenario | Behavior | Code |
|---|---|---|
| Return requested outside window | Reject; admin override possible | `RETURN_OUTSIDE_WINDOW`, 422 |
| Return for non-returnable item | Reject; admin override possible | `ITEM_NOT_RETURNABLE`, 422 |
| Return on cancelled order | Reject | `ORDER_NOT_ELIGIBLE`, 422 |
| Return on order not yet delivered | Reject | `ORDER_NOT_DELIVERED`, 422 |
| Return quantity exceeds order item qty | Reject | `QUANTITY_EXCEEDS_ORDER`, 422 |
| Item already fully returned | Reject | `ITEM_ALREADY_RETURNED`, 422 |
| Customer cancels post-shipment | Allow but flag; if goods arrive, process anyway | (graceful) |
| Carrier label generation fails | Mark `approved` (no label); retry async | (handled) |
| Goods received but no return record | Warehouse staff flags; admin investigates (might be misrouted) | (manual) |
| Goods received with wrong items | Quantity_received doesn't match; staff flags | (manual) |
| Refund fails (payment provider error) | Status reverts to 'inspected'; retry job; admin alert | (handled) |
| Partial inspection — some items missing from shipment | Approve received, reject missing; refund partial | (handled per RULE-RTN-009) |
| Customer disputes restock decision | Customer service notes; possible policy adjustment for future | (manual) |
| Exchange with stock unavailable | Notify customer; offer refund instead | (handled) |
| Return submitted multiple times for same item | Reject duplicate; show existing return | `DUPLICATE_RETURN`, 422 |
| Return for digital good (download) | Per policy; typically not refundable unless defective | (per policy) |
| Return for gift card purchase | Per policy; typically not refundable once activated | (per policy) |
| Customer's preferred refund method unavailable | Fall back to alternative (store_credit usually) | (handled) |
| Concurrent inspection by 2 warehouse staff | Advisory lock per return_id; second waits | (handled) |
| Restocking fee exceeds refund amount | Cap at refund_amount (refund=0) | (handled) |
| Return shipping cost > refund amount | Allow negative remit (customer owes); requires manual settlement | (rare; admin handles) |
| Goods received condition='damaged' but reason was 'wrong_item' | Inspector notes; admin reviews; possibly partial refund | (manual) |
| Customer cancels with label issued but already shipped | Cannot cancel; process as normal | (handled) |
| Window expires while goods in transit | Auto-receive when arrived; refund proceeds normally | (handled) |
| Customer accidentally ships wrong items | Inspect: condition='wrong_item'; reject from inspection; possibly return to customer | (manual) |
| EU customer claims cooling-off after 30 days | Per local law: rejected; merchant courtesy possible | (per policy) |
| B2B return not pre-negotiated | Reject; require merchant approval per contract | (per RULE-RTN-020) |
| Refund to gift card that was deleted | Reject; require alternative method | `GIFT_CARD_NOT_AVAILABLE`, 422 |
| Multiple returns racing for same order_item | Last-wins on quantity_returned (atomic check at request time) | (handled) |
| Counterfeit goods received | Inspector flags; rejection + possible authorities notification (Fáze 2) | (handled) |
| Mass return after promo abuse | Fraud signals trigger; admin reviews | (handled) |

---

## 12. Performance

### 12.1 Targets

| Operation | p50 | p95 | p99 |
|---|---|---|---|
| `POST /storefront/returns` (initiate) | 50 ms | 150 ms | 400 ms |
| `GET /returns` (admin list) | 30 ms | 100 ms | 250 ms |
| `POST /returns/{id}:approve` (with label) | 300 ms | 1000 ms | 2500 ms (carrier API) |
| `POST /returns/{id}:mark-inspected` | 30 ms | 100 ms | 250 ms |
| `JOB-PROCESS-RETURN-REFUND` (refund + credit_note + restock) | 500 ms | 2000 ms | 5000 ms |
| `GET /returns/eligibility` | 15 ms | 40 ms | 100 ms |
| Fraud detection job per customer | 50 ms | 200 ms | 500 ms |

### 12.2 Optimization

- **Eligibility check cached** Redis 5 min per (order_id, customer_id)
- **Bulk operations** parallelize per item; throttle to avoid carrier API limits
- **DataLoader v GraphQL** for batched items/events
- **Return policy lookup cached** per tenant (rarely changes)
- **Advisory locks** per return_id for state transitions

### 12.3 Scaling

- Return volume: ~5-20% of orders typically; manageable on single Postgres
- `return_events` partitioned monthly (Fáze 2 — not yet needed at MVP volume)

---

## 13. Security & legal

### 13.1 Permissions

```
PERM-RETURN-VIEW
PERM-RETURN-APPROVE
PERM-RETURN-RECEIVE              # warehouse staff
PERM-RETURN-PROCESS              # inspection + refund
PERM-RETURN-FLAG                  # mark for fraud review
PERM-RETURN-POLICY-VIEW
PERM-RETURN-POLICY-MANAGE
PERM-RETURN-FINANCIAL-REPORT
PERM-RETURN-OVERRIDE              # admin override for outside-window etc.
```

### 13.2 Customer access controls

- Logged-in customer: own returns only
- Guest: via signed token from order confirmation email
- Cross-tenant prohibited (RLS)

### 13.3 Legal — EU consumer rights

- 14-day cooling-off enforced when `applies_eu_consumer_rights=true`
- Restocking fee waived during cooling-off
- Refund within 14 days of merchant receiving goods (CZ § 1829)
- Withdrawal form template provided per CZ/SK/DE locale (per `15-tax-compliance.md`)

### 13.4 GDPR

- `customer_note`, `condition_notes` may contain PII; deletion request anonymizes
- Retain return records 10 years (per accounting law via `15`)
- Photos in `condition_photos_media_ids`: subject to PII rules

### 13.5 Audit

- 100% audit on: approve/reject, override, restock decision, manual amount override, policy changes
- Sample 1% on reads
- Fraud signals logged immutably

### 13.6 Rate limits

| Endpoint | Anon | Auth Free | Auth Pro |
|---|---|---|---|
| `POST /storefront/returns` | 5/hour per customer | 5/hour | 10/hour |
| `GET /storefront/returns` | n/a | 60/min | 60/min |
| `POST /returns/{id}:approve` | n/a | 60/min | 600/min |
| `POST /returns:bulk-*` | n/a | 1/hour | 12/hour |

---

## 14. Testing

### 14.1 Unit

```
TEST-UNIT-RTN-001  EligibilityChecker — window, items, exclusions
TEST-UNIT-RTN-002  AutoApprovalEvaluator — policy matching
TEST-UNIT-RTN-003  RestockingFeeCalculator
TEST-UNIT-RTN-004  RefundAmountCalculator — items + tax - fee - return_shipping
TEST-UNIT-RTN-005  ReturnStateMachine — valid transitions
TEST-UNIT-RTN-006  ReturnNumberFormatter
TEST-UNIT-RTN-007  FraudPatternDetector — each signal kind
TEST-UNIT-RTN-008  ConditionPolicyMapper — condition → restock decision
```

### 14.2 Integration

```
TEST-INT-RTN-001  Customer initiates return → status='requested'
TEST-INT-RTN-002  Auto-approval per policy
TEST-INT-RTN-003  Approve → label generated → status='label_issued'
TEST-INT-RTN-004  Carrier picks up → status='in_transit'
TEST-INT-RTN-005  Goods delivered to warehouse → status='received'
TEST-INT-RTN-006  Inspection records restock decisions
TEST-INT-RTN-007  Refund processed atomic with credit_note
TEST-INT-RTN-008  Inventory restock movement created
TEST-INT-RTN-009  Order refunded_amount synced
TEST-INT-RTN-010  Outside window rejection
TEST-INT-RTN-011  EU cooling-off override applied
TEST-INT-RTN-012  Restocking fee deducted correctly
TEST-INT-RTN-013  Return shipping cost handled
TEST-INT-RTN-014  Partial refund on quantity_rejected
TEST-INT-RTN-015  Fraud signal detected for serial returner
TEST-INT-RTN-016  Concurrent returns race (advisory lock)
TEST-INT-RTN-017  Expire pending returns after window
TEST-INT-RTN-018  Cancellation pre-receive
TEST-INT-RTN-019  Exchange flow creates new order (v1.0+)
TEST-INT-RTN-020  Refund failure compensates (status revert)
TEST-INT-RTN-021  Customer self-service portal flow end-to-end
TEST-INT-RTN-022  Guest token return access
TEST-INT-RTN-023  GDPR anonymization preserves financial record
TEST-INT-RTN-024  B2B return restriction enforced
TEST-INT-RTN-025  Multiple returns per order accumulate quantity_returned correctly
```

### 14.3 E2E

```
TEST-E2E-RTN-001  Customer initiates return from order page
TEST-E2E-RTN-002  Admin approves, customer receives label email
TEST-E2E-RTN-003  Warehouse receives, inspects, refund issued
TEST-E2E-RTN-004  Customer tracks return through timeline
TEST-E2E-RTN-005  Bulk approval workflow
TEST-E2E-RTN-006  Fraud-flagged return admin review
TEST-E2E-RTN-007  EU cooling-off scenario
TEST-E2E-RTN-008  Exchange flow (v1.0+)
```

### 14.4 Load

```
TEST-LOAD-RTN-001  100 concurrent return initiations → no deadlocks
TEST-LOAD-RTN-002  500 RPS GET /returns admin list → p95 < 150 ms
TEST-LOAD-RTN-003  Bulk approve 100 returns → < 60s
```

### 14.5 Chaos

```
TEST-CHAOS-RTN-001  Carrier API down during label issue → retry
TEST-CHAOS-RTN-002  Payment provider down during refund → revert + retry
TEST-CHAOS-RTN-003  Inventory service down during restock → defer
```

---

## 15. Implementation checklist

### Backend
- [ ] **[S]** Drizzle schema `packages/db/src/schema/returns/*.ts`
- [ ] **[S]** Migrace `20260531_001_create_returns_tables.sql`
- [ ] **[L]** `ReturnService` core — initiate, approve, reject, receive, inspect, close
- [ ] **[M]** `ReturnStateMachine`
- [ ] **[M]** `ReturnEligibilityChecker`
- [ ] **[M]** `ReturnPolicyResolver`
- [ ] **[M]** `RestockingFeeCalculator`
- [ ] **[M]** `RefundAmountCalculator`
- [ ] **[L]** `ReturnRefundOrchestrator` — saga across payment + tax + inventory + order sync
- [ ] **[M]** `ReturnNumberAllocator`
- [ ] **[M]** `ReturnFraudDetector` — signal computation
- [ ] **[S]** `ReturnLabelIssuanceService` — wraps `14-shipping.md` carrier call
- [ ] **[M]** `RestockOrchestrator` — wraps `09-inventory.md` movement
- [ ] **[M]** REST endpoints per §6
- [ ] **[M]** GraphQL types + resolvers
- [ ] **[S]** tRPC router (admin)
- [ ] **[S]** MCP tools `return.initiate`, `return.get_status` (v1.0+)
- [ ] **[S]** Guest token validator

### Background jobs
- [ ] **[M]** JOB-AUTO-APPROVE-RETURNS
- [ ] **[M]** JOB-GENERATE-RETURN-LABEL
- [ ] **[S]** JOB-MARK-RETURN-RECEIVED-FROM-SHIPMENT
- [ ] **[L]** JOB-PROCESS-RETURN-REFUND — core saga
- [ ] **[M]** JOB-RESTOCK-RETURN-ITEM
- [ ] **[S]** JOB-EXPIRE-PENDING-RETURNS
- [ ] **[S]** JOB-SEND-RETURN-REMINDER
- [ ] **[S]** JOB-SEND-RETURN-STATUS-EMAIL (per event)
- [ ] **[M]** JOB-DETECT-RETURN-FRAUD-PATTERNS
- [ ] **[S]** JOB-UPDATE-CUSTOMER-RETURN-RATE
- [ ] **[S]** JOB-RETURN-ANALYTICS-DAILY
- [ ] **[L]** JOB-CREATE-EXCHANGE-ORDER (v1.0+)
- [ ] **[S]** JOB-AUTO-CLOSE-COMPLETED-RETURNS
- [ ] **[S]** JOB-RETRY-FAILED-REFUND

### Frontend — Admin
- [ ] **[L]** Returns list (filter by status, fraud flag, customer)
- [ ] **[L]** Return detail view (timeline + items + actions)
- [ ] **[M]** Approve modal (label options, payer settings)
- [ ] **[M]** Reject modal (reason)
- [ ] **[M]** Inspection workflow (per item: quantity_received + condition + restock decision)
- [ ] **[M]** Bulk operations modals
- [ ] **[M]** Fraud review dashboard
- [ ] **[M]** Return policies management
- [ ] **[S]** Return analytics dashboards
- [ ] **[S]** Customer return history view

### Frontend — Storefront (customer)
- [ ] **[L]** "Initiate return" wizard (4 steps)
- [ ] **[M]** "My returns" list page
- [ ] **[L]** Return detail page (status, timeline, items, refund summary)
- [ ] **[S]** Return label download
- [ ] **[S]** Guest token return access page
- [ ] **[S]** Return cancellation UI
- [ ] **[S]** EU cooling-off explicit checkbox

### Frontend — Warehouse
- [ ] **[M]** Incoming returns view (mobile-friendly, barcode scan)
- [ ] **[M]** Mark received UI per shipment
- [ ] **[M]** Inspection UI per item (condition + photos + decision)

### Tests
- [ ] **[M]** Per §14

### Docs
- [ ] **[M]** "Return policies setup" merchant guide
- [ ] **[S]** "Processing returns" customer service guide
- [ ] **[S]** "Warehouse inspection workflow" guide
- [ ] **[S]** "EU consumer rights compliance" legal doc
- [ ] **[S]** "Detecting return fraud" guide
- [ ] **[S]** Customer-facing: "How to return" help article
- [ ] **[S]** Developer: return event hooks for plugins
- [ ] **[S]** Developer: MCP return tools integration

---

## 16. Open questions

### Q-RTN-001: Exchange flow MVP scope
**Otázka:** Full exchange (return + auto-create replacement order with delta charge) — v MVP nebo v1.0+?

**Status:** v1.0+ feature. MVP: customer service manually issues refund + new order.

### Q-RTN-002: Subscription return handling
**Otázka:** Return single delivery of subscription vs cancel subscription entirely?

**Status:** v2.0+ with `24-subscriptions.md`. MVP: subscription orders return like one-time orders, but separate workflow for subscription cancellation.

### Q-RTN-003: Marketplace return routing
**Otázka:** Multi-seller order with items from different sellers — returns split per seller?

**Status:** v4.0 marketplace feature. Detail v `25-marketplace.md`.

### Q-RTN-004: AI-powered approval suggestions
**Otázka:** AI Copilot suggests approve/reject based on customer history + reason + similar returns?

**Status:** v2.0+ feature in `33-ai-features.md`. MVP: manual review queue.

### Q-RTN-005: Customer return reason translation accuracy
**Otázka:** Customer enters free-text reason; backend should map to reason_code via NLP?

**Status:** v2.0+ AI feature. MVP: dropdown selection.

### Q-RTN-006: Return shipping insurance
**Otázka:** Optional insurance for high-value returns; cost passed to customer?

**Status:** Configurable per policy. MVP: merchant chooses default + override per return.

### Q-RTN-007: Return analytics extension
**Otázka:** Return rate by reason, by season, by customer cohort — detailed analytics?

**Status:** Part of `20-analytics-reporting.md`. MVP: basic counts; v1.0+ rich analytics.

### Q-RTN-008: Reverse logistics optimization
**Otázka:** Multi-package returns, consolidated drop-off, return-to-supplier routing?

**Status:** v2.0+ feature. MVP: simple 1 return = 1 shipment.

### Q-RTN-009: Withdrawal form template per country
**Otázka:** EU directive requires merchant provide template withdrawal form. PDF generation?

**Status:** Per-locale template in `15-tax-compliance.md` legal templates. Auto-attached to return label email.

### Q-RTN-010: Return fee for B2B vs B2C
**Otázka:** B2B contracts may include flat return fee; different from B2C consumer rights.

**Status:** Per-policy + per-company override. Detail v `21-b2b-complete.md`.

### Q-RTN-011: AI photo analysis for damage assessment
**Otázka:** Customer uploads photos; AI auto-classifies condition?

**Status:** v3.0+ feature. MVP: manual inspection by staff.

### Q-RTN-012: Return for items now archived/deleted
**Otázka:** Customer returns variant that was deleted. order_items snapshot preserves data; restock decision = damage (no inventory to restock to)?

**Status:** Restock decision options exclude restock if variant deleted; admin chose damage/donate/destroy. Handled gracefully.

### Q-RTN-013: Concurrent fraud signal aggregation
**Otázka:** Multiple signals on same customer — aggregate severity vs separate signals?

**Status:** Separate signal rows; customer's composite risk computed at query time.

### Q-RTN-014: Return label issuance for international
**Otázka:** Cross-border returns need customs declaration on return label.

**Status:** v1.0+ international handling. Detail v `14-shipping.md` Fáze 2 internationals.

### Q-RTN-015: Customer notification cadence
**Otázka:** Email at every status change vs digest?

**Status:** Configurable per tenant. Default: email at requested, approved, label_issued, refunded. Digest mode v1.0+.

---

## 📅 Změny

| Datum | Změna |
|---|---|
| 2026-05-20 | Initial — Returns & Refunds domain. RMA workflow, EU cooling-off, restocking decisions, fraud detection, refund saga, self-service portal, exchange v1.0+. |

---

**Konec Returns & Refunds.**

➡️ Pokračovat na: [`18-customer-management.md`](18-customer-management.md)
