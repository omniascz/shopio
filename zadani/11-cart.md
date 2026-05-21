# 11 – CART

> **Doména:** Nákupní košík. Persistentní (DB) + cache-friendly (Redis), guest i logged-in, multi-currency, koordinuje rezervaci skladu (`09`) a snapshot ceny (`10`). Hand-off do Checkout (`12`).

**Datum:** 2026-05-19
**Verze:** 1.0
**Status:** 🟡 DESIGN
**Reference:** [03 §8](03-data-models-master.md#8-cart--checkout) · [09-inventory.md](09-inventory.md) · [10-pricing-promotions.md](10-pricing-promotions.md) · [12-checkout.md](12-checkout.md)

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

- **Persistent cart** — uloženo v Postgres, zachová se napříč sessions, devices (pro logged-in customery)
- **Guest cart** — anonymous customer, identifikovaný session cookie nebo `session_token` v URL
- **Cart items** — line items s SKU snapshot, quantity, customization, snapshot ceny
- **Cart merging** — guest cart → customer cart při login/signup (deduplicate items)
- **Cart pricing recompute** — on every mutation, debounced; snapshot v `cart_items.unit_price_amount`
- **Inventory reservation coordination** — každý add/update creates / extends reservation (per `09 RULE-INV-005`)
- **Customizable items** — gift message, engraving, color picker, attachments (file upload)
- **Cart-level notes** — customer note pro merchant
- **Multi-currency switching** — re-price cart at exchange rate; warning customer
- **Cart abandonment** — automatic state transition + recovery email pipeline
- **Saved-for-later** — wishlist-cart hybrid (Fáze 2)
- **Multi-cart per customer** (B2B) — Fáze 2, MVP = 1 active cart per customer
- **Cart sharing** — share via signed URL (Fáze 2+)
- **Hand-off do Checkout** — `cart_id` → `checkout_session` (12)

### 0.2 Co tato doména **NENÍ**

- ❌ Pricing calculation logic (→ `10-pricing-promotions.md` — cart calls pricing engine)
- ❌ Inventory reservation core (→ `09-inventory.md` — cart triggers reservation)
- ❌ Checkout flow (→ `12-checkout.md` — cart končí, checkout začíná)
- ❌ Order persistence (→ `16-order-management.md`)
- ❌ Wishlist samostatně (→ `19-marketing-seo.md` or future `wishlist` doc — wishlist je permanent, cart je transient)
- ❌ Saved payment methods (→ `13-payments.md` + `18-customer-management.md`)
- ❌ Gift cards as products (→ `10-pricing-promotions.md` — gift card purchase is just a product in cart)

### 0.3 Diferenciátory

1. **Single source of truth = Postgres** — Redis je read-side cache, ne autoritativní store; failover safe
2. **Guest → logged-in seamless merge** — deduplication logic, žádný "ztracený" cart při login
3. **Real-time cart sync** — multi-device (mobile + desktop same customer) — push via SSE / WebSocket on cart change (v1.0+)
4. **Atomic cart mutation** — add item + reserve inventory + price snapshot v 1 Postgres Tx
5. **Cart expiration s sliding extend** — aktivita refreshuje TTL
6. **Stale price detection** — `last_priced_at` field; checkout odmítne starý snapshot, re-prices + warns

---

## 1. References

- [03 §8](03-data-models-master.md#8-cart--checkout) — entity ENT-CART-001 a ENT-CART-ITEM-001
- [09-inventory.md](09-inventory.md) — reservation lifecycle, advisory locking
- [10-pricing-promotions.md](10-pricing-promotions.md) — pricing engine, snapshot pricing (RULE-PRICING-005)
- [12-checkout.md](12-checkout.md) — handoff: cart → checkout session
- [06-catalog-pim.md](06-catalog-pim.md) — variant validation, customization metadata
- [18-customer-management.md](18-customer-management.md) — customer identity, group membership
- [19-marketing-seo.md](19-marketing-seo.md) — abandoned cart email triggers
- [22-multistore-channels.md](22-multistore-channels.md) — cart channel context
- [23-i18n.md](23-i18n.md) — locale + currency switching
- [DEC-EVENTS-001](01-decisions-registry.md#dec-events-001-event-bus--background-jobs) — outbox pattern pro cart events
- [DEC-DB-004](01-decisions-registry.md#dec-db-004-cache-strategy) — Redis L4 cache strategy

---

## 2. Personas

| Persona | Použití | Klíčové permissions |
|---|---|---|
| `PERSONA-CUSTOMER` | Storefront cart management (add/update/remove) | Anon nebo auth, žádné explicit permission |
| `PERSONA-B2B-EMPLOYEE` | B2B cart s company context, quote requests (v1.0+) | Auth, `cart:write` scope |
| `PERSONA-MERCHANT-OWNER` | View carts dashboard, intervence (POS, admin-created cart) | `PERM-CART-VIEW`, `PERM-CART-CREATE-ON-BEHALF`, `PERM-CART-EDIT` |
| `PERSONA-CUSTOMER-SERVICE` | Help customer (search cart, modify, send recovery) | `PERM-CART-VIEW`, `PERM-CART-EDIT`, `PERM-CART-SEND-RECOVERY` |
| `PERSONA-POS-OPERATOR` | Cart na POS terminálu (v2.0+) | `PERM-CART-POS` |
| `PERSONA-AI-COPILOT` | Suggestions na cart (upsell, complete-the-look) | `agent:cart:read`, `agent:cart:suggest` |
| `PERSONA-EXTERNAL-AGENT` | MCP `cart.add_item`, `cart.get` | `agent:cart:read`, `agent:cart:write` (v1.0+ scoped) |

---

## 3. Data models

### 3.1 `carts` ([ENT-CART-001](03-data-models-master.md#ent-cart-001))

```sql
CREATE TABLE carts (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  pub_id TEXT NOT NULL,                                     -- NanoID 12, public reference
  customer_id UUID NULL REFERENCES customers(id),            -- NULL = guest
  session_token TEXT NULL,                                   -- pro guest cart linking
  channel_id UUID NULL REFERENCES channels(id),
  store_id UUID NULL REFERENCES stores(id),                   -- multi-store context
  currency CHAR(3) NOT NULL,
  locale TEXT NOT NULL,                                       -- BCP-47 (cs-CZ)
  company_id UUID NULL REFERENCES companies(id),              -- B2B context
  customer_group_id UUID NULL REFERENCES customer_groups(id), -- snapshot pro pricing
  price_list_id_chain UUID[] NULL,                            -- snapshot resolved chain
  status TEXT NOT NULL CHECK (status IN ('active','abandoned','converted','expired','merged','cancelled')) DEFAULT 'active',
  -- price snapshots
  subtotal_amount BIGINT NOT NULL DEFAULT 0,
  discount_amount BIGINT NOT NULL DEFAULT 0,
  tax_amount BIGINT NOT NULL DEFAULT 0,
  shipping_amount BIGINT NOT NULL DEFAULT 0,
  shipping_discount_amount BIGINT NOT NULL DEFAULT 0,
  total_amount BIGINT NOT NULL DEFAULT 0,
  applied_coupon_codes TEXT[] NOT NULL DEFAULT '{}',
  applied_gift_card_ids UUID[] NOT NULL DEFAULT '{}',
  gift_card_redeemed_amount BIGINT NOT NULL DEFAULT 0,
  -- shipping placeholder (set v checkout, but cart může zobrazit estimate)
  estimated_shipping_country CHAR(2) NULL,
  estimated_shipping_postal_code TEXT NULL,
  selected_shipping_method_id UUID NULL,
  -- notes
  customer_note TEXT NULL,
  staff_note TEXT NULL,                                       -- pro admin-edited carts
  -- timestamps
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_priced_at TIMESTAMPTZ NULL,                            -- last successful pricing snapshot
  pricing_stale BOOLEAN NOT NULL DEFAULT false,                -- flag set by background job
  expires_at TIMESTAMPTZ NULL,                                 -- default 30 days, sliding via activity
  abandoned_at TIMESTAMPTZ NULL,                                -- transition timestamp
  converted_to_order_id UUID NULL REFERENCES orders(id),
  merged_into_cart_id UUID NULL REFERENCES carts(id),
  -- IP / device tracking (anonymized after consent expire)
  origin_ip_hash TEXT NULL,
  origin_user_agent_family TEXT NULL,                          -- 'chrome', 'safari', 'mobile_safari'
  origin_referrer TEXT NULL,
  attribution_utm JSONB NULL,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  version INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_carts_tenant_pub_id UNIQUE (tenant_id, pub_id),
  CONSTRAINT ck_cart_identity CHECK (
    customer_id IS NOT NULL OR session_token IS NOT NULL
  ),
  CONSTRAINT ck_status_terminal CHECK (
    (status = 'converted' AND converted_to_order_id IS NOT NULL) OR
    (status = 'merged' AND merged_into_cart_id IS NOT NULL) OR
    (status NOT IN ('converted','merged'))
  ),
  CONSTRAINT ck_cart_totals_non_negative CHECK (
    subtotal_amount >= 0 AND tax_amount >= 0 AND
    shipping_amount >= 0 AND total_amount >= 0 AND
    discount_amount >= 0 AND gift_card_redeemed_amount >= 0
  )
);

CREATE INDEX idx_carts_customer_active ON carts (customer_id, status, last_activity_at DESC)
  WHERE deleted_at IS NULL AND status = 'active';

CREATE INDEX idx_carts_session_token ON carts (tenant_id, session_token)
  WHERE session_token IS NOT NULL AND deleted_at IS NULL AND status = 'active';

CREATE INDEX idx_carts_expires_at ON carts (expires_at)
  WHERE status = 'active' AND deleted_at IS NULL;

CREATE INDEX idx_carts_abandoned ON carts (tenant_id, abandoned_at DESC)
  WHERE status = 'abandoned' AND deleted_at IS NULL;

CREATE INDEX idx_carts_pricing_stale ON carts (last_priced_at)
  WHERE pricing_stale = true AND status = 'active';
```

**Customer cart unique invariant:** Per RULE-CART-001 (viz §5), customer má max 1 active cart per (channel × company) v MVP. Vynucené partial unique index:

```sql
CREATE UNIQUE INDEX uq_carts_customer_active_per_channel
  ON carts (customer_id, COALESCE(channel_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE status = 'active' AND deleted_at IS NULL AND customer_id IS NOT NULL;
```

### 3.2 `cart_items` ([ENT-CART-ITEM-001](03-data-models-master.md#ent-cart-item-001))

```sql
CREATE TABLE cart_items (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES product_variants(id),
  product_id UUID NOT NULL REFERENCES products(id),           -- denormalized for query speed
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  -- snapshots (immutable while in cart, refreshed on re-pricing)
  sku TEXT NOT NULL,
  title TEXT NOT NULL,
  variant_title TEXT NULL,
  primary_image_url TEXT NULL,
  -- pricing snapshot (from pricing engine output, RULE-PRICING-005)
  unit_price_amount BIGINT NOT NULL,
  unit_price_currency CHAR(3) NOT NULL,
  compare_at_amount BIGINT NULL,
  price_list_id UUID NULL REFERENCES price_lists(id),
  subtotal_before_discount BIGINT NOT NULL,                    -- unit_price × quantity
  discount_amount BIGINT NOT NULL DEFAULT 0,
  discount_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,        -- [{discount_id, amount, kind}]
  tax_amount BIGINT NOT NULL DEFAULT 0,
  tax_rate_basis_points INTEGER NOT NULL DEFAULT 0,
  total_amount BIGINT NOT NULL,                                  -- subtotal - discount + tax
  -- customization
  customization JSONB NULL,                                      -- {"engraving":"For John","gift_wrap":true}
  customization_hash TEXT NULL,                                  -- sha256 pro deduplikaci items
  gift_message TEXT NULL,
  custom_attachments JSONB NULL,                                  -- [{filename, storage_key, size}]
  -- bundle parent tracking (v případě, že item je child bundle)
  bundle_parent_item_id UUID NULL REFERENCES cart_items(id),
  is_bundle_child BOOLEAN NOT NULL DEFAULT false,
  -- inventory reservation linkage
  reservation_id UUID NULL,                                       -- → stock_reservations.id (no FK to allow soft state)
  -- timestamps
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_modified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- audit
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  position INTEGER NOT NULL DEFAULT 0,                            -- display order

  CONSTRAINT uq_cart_items_cart_variant_custom
    UNIQUE (cart_id, variant_id, customization_hash),
  CONSTRAINT ck_unit_price_non_negative CHECK (unit_price_amount >= 0)
);

CREATE INDEX idx_cart_items_cart_position ON cart_items (cart_id, position);
CREATE INDEX idx_cart_items_variant ON cart_items (variant_id);
```

**Customization hash:** `customization_hash = sha256(canonical_json(customization || gift_message))`. NULL pro items bez customization. Umožňuje deduplikaci — 2× stejný produkt s **stejnou** customizací = 1 line s qty=2; **různá** customizace = 2 separate lines.

### 3.3 `cart_recovery_tokens` *(abandoned cart email recovery)*

Signed token pro recovery URL ("Pokračovat v nákupu").

```sql
CREATE TABLE cart_recovery_tokens (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,                                       -- HMAC-SHA256(tenant_secret, cart_id + nonce)
  emitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ NULL,
  recovery_stage TEXT NOT NULL CHECK (recovery_stage IN ('hour_1','day_1','day_3','manual','staff_send')),
  CONSTRAINT uq_recovery_tokens_hash UNIQUE (token_hash)
);

CREATE INDEX idx_recovery_tokens_cart ON cart_recovery_tokens (cart_id);
CREATE INDEX idx_recovery_tokens_expires ON cart_recovery_tokens (expires_at) WHERE used_at IS NULL;
```

### 3.4 `cart_history` *(audit / analytics)*

Append-only snapshots major cart transitions. Pro analytics (funnel analysis) i debugging customer support tickets.

```sql
CREATE TABLE cart_history (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  cart_id UUID NOT NULL,
  event_kind TEXT NOT NULL CHECK (event_kind IN (
    'created','item_added','item_updated','item_removed','customer_set','customer_changed',
    'coupon_applied','coupon_removed','gift_card_applied','gift_card_removed',
    'currency_changed','locale_changed','channel_changed',
    'merged','abandoned','recovered','converted','expired','cancelled',
    'staff_modified'
  )),
  actor_kind TEXT NOT NULL,
  actor_id UUID NULL,
  snapshot JSONB NULL,                                            -- relevant cart state at time of event
  delta JSONB NULL,                                                -- what changed
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
) PARTITION BY RANGE (occurred_at);

CREATE INDEX idx_cart_history_cart ON cart_history (cart_id, occurred_at DESC);
CREATE INDEX brin_cart_history_occurred_at ON cart_history USING BRIN (occurred_at);
```

Retention 90 dní default, 12 měsíců Pro+, 24 měsíců Enterprise.

### 3.5 Cache structure (Redis)

```
key: cart:{cart_id}                       value: serialized PricedCart JSON       TTL: 300s
key: cart:session:{session_token}        value: cart_id                           TTL: 30 days (sliding)
key: cart:customer:{customer_id}:{channel_id?}:{company_id?}  value: cart_id     TTL: 30 days (sliding)
key: cart:lock:{cart_id}                  value: lock token                       TTL: 5s (mutex pro mutation)
```

Read-through: GET cart → Redis hit → return; miss → Postgres → cache → return.
Write-through: mutation → Postgres commit → Redis invalidate → reload.

### 3.6 Vztahy

```
tenants (1)──(N) carts
customers (0..1)──(N) carts          [nullable, guest cart]
channels (0..1)──(N) carts
stores (0..1)──(N) carts
companies (0..1)──(N) carts          [B2B]
customer_groups (0..1)──(N) carts    [pricing snapshot]
carts (1)──(N) cart_items
cart_items (N)──(1) product_variants
cart_items (N)──(1) products          [denormalized]
cart_items (0..1)──(1) cart_items     [bundle_parent_item_id]
cart_items (0..1)──(1) stock_reservations  [reservation_id]
carts (0..1)──(1) orders              [converted_to_order_id]
carts (0..1)──(1) carts               [merged_into_cart_id]
carts (1)──(N) cart_recovery_tokens
carts (1)──(N) cart_history
```

---

## 4. State machines

### 4.1 Cart status

```
                  ┌──────────────────────────────────────────┐
                  │                                          │
                  ▼                                          │
   ┌─── create ──[active]───┬─── place order ──▶[converted]  │
   │                         │                                │
   │                         ├─── merge into other ──▶[merged]│
   │                         │                                │
   │                         ├─── abandon (inactivity 24h) ──▶[abandoned]
   │                         │                                          │
   │                         │                              recover ────┤
   │                         │                                          │
   │                         ├─── expire (TTL 30d) ──▶[expired]         │
   │                         │                                          │
   │                         └─── cancel (manual) ──▶[cancelled]        │
   │                                                                    │
   └────────────────────────────────────────────────────────────────────┘
```

**Přechody:**

| From | Event | To | Side-effect |
|---|---|---|---|
| `(none)` | `create` | `active` | INSERT row, set `expires_at=now+30d`, emit EVENT-CART-CREATED |
| `active` | `add_item / update / remove` | `active` | bump `last_activity_at`, `expires_at`; re-price; reservation adjust |
| `active` | `convert_to_order` | `converted` | set `converted_to_order_id`, transition stock_reservations kind='order' (RULE-INV-006) |
| `active` | `merge_into` | `merged` | move items to target cart, deduplicate; release this cart's reservations |
| `active` | `abandon` (no activity 24h) | `abandoned` | set `abandoned_at`; emit EVENT-CART-ABANDONED → recovery pipeline |
| `abandoned` | `recover` (customer activity) | `active` | bump `last_activity_at`; re-price |
| `active` / `abandoned` | `expire` (TTL hit) | `expired` | release reservations; eventually soft-delete |
| `active` / `abandoned` | `cancel` (manual / staff) | `cancelled` | release reservations |

### 4.2 Cart mutation pipeline (atomic)

Each mutation (add/update/remove/apply-coupon) follows this sequence:

```
BEGIN TX
  Acquire advisory lock: pg_advisory_xact_lock(hash('cart:' + cart_id))
  Load cart + items
  Apply mutation (insert/update/delete row)
  Validate state (sufficient stock, coupon valid, etc.)
  Adjust inventory reservation (atomic Tx with cart change)
  Re-run pricing engine (PRICING-001)
  Update cart aggregates (subtotal, tax, total)
  Set last_activity_at = now(), last_priced_at = now(), pricing_stale=false
  Bump expires_at if sliding
  Append cart_history entry
  Write outbox event(s)
COMMIT
Invalidate Redis cache
Return updated PricedCart
```

**Advisory lock per cart_id:** Drobnozrnný; různé carts can mutate paralelně.

### 4.3 Stale pricing detection

```
JOB-DETECT-STALE-PRICING (every 15 min)
  For each active cart where last_priced_at < now() - 1 hour:
    Set pricing_stale = true
    Optionally re-price proactively for high-value carts (subtotal > X)
```

Checkout endpoint vždy validates `last_priced_at >= now() - 5 min`; pokud starší → force re-price před initialization. Pokud drift > 0 (cena změnila): show warning + require user confirm.

---

## 5. Business rules

### RULE-CART-001: Single active cart per customer per channel

Customer (logged-in) má max **1 active cart** per (channel × company combination). Vynucené partial unique index v §3.1.

Pokud customer otevře web na 2 zařízeních paralelně, oba devices share **stejný cart** (Postgres single source of truth). Real-time sync přes SSE (v1.0+) udržuje UI synced.

V MVP: optimistic concurrency — mutation z device A invaliduje cart cache; device B vidí change při next load nebo manual refresh.

### RULE-CART-002: Guest cart identifier

Guest cart identifikován `session_token` (httpOnly cookie `shopio_cart_session`, randomized at first visit, TTL 30 days sliding).

Když customer login, server hledá guest cart by `session_token` a merge do customer cart (RULE-CART-006).

### RULE-CART-003: Cart item deduplication

Items s `(variant_id, customization_hash)` jsou unique v rámci cartu. Druhý add stejné kombinace = inkrement `quantity`. Různá customizace = separate lines.

NULL customization_hash treats jako "no customization", deduplicates s jinými no-customization adds.

### RULE-CART-004: Inventory reservation per cart item

Každý cart_item má `reservation_id` ukazatel na `stock_reservations` row (`kind='cart'`). Reservation TTL je 30 minut sliding (per `09 RULE-INV-005`).

Mutation pravidla:
- **Add new item:** create reservation atomic s cart_item insert (advisory lock on (variant, warehouse))
- **Update qty (Q1 → Q2):** UPDATE reservation.quantity, update stock_levels.reserved by delta
- **Remove item:** release reservation, soft-delete cart_item
- **Cart abandon / expire:** release all reservations (cascade via sweeper job)

### RULE-CART-005: Pricing recompute on every mutation

Po každé mutation engine re-runs pricing (RULE-PRICING-018 — deterministic). Cart aggregates update. `last_priced_at = now()`.

**Debounce edge case:** rapid mutations (e.g., +1 +1 +1 kvantity v 100ms): per-cart debounce 200ms; final pricing run with last state. UI dostane updated cart po debounce window.

### RULE-CART-006: Guest → customer merge

Customer login s active guest cart triggeruje merge:

```
target_cart = customer's existing active cart (or null)
source_cart = guest cart by session_token

if target_cart is null:
  source_cart.customer_id = customer_id
  source_cart.session_token = null
  source_cart.status = active
  (no merge needed)
else:
  for each source_item in source_cart.items:
    key = (variant_id, customization_hash)
    if target_cart.items has key:
      target_item.quantity += source_item.quantity  // capped at variant max_per_order
      adjust reservation
    else:
      move source_item to target_cart (re-link reservation_id)
  source_cart.status = 'merged'
  source_cart.merged_into_cart_id = target_cart.id
  // release any duplicate reservations (the ones we adjusted instead of moving)
  re-run pricing on target_cart
```

**Conflict:** If source uses different currency than target → 422 with prompt "Choose which cart to keep" (UI flow); default: prefer target currency, drop incompatible items, log warning.

### RULE-CART-007: Cart abandonment

After **24 hours of inactivity** (configurable: `tenant.settings.cart_abandon_threshold_seconds`), `JOB-DETECT-ABANDONED-CARTS` flips status to `abandoned` + emits EVENT-CART-ABANDONED.

This triggers:
- Recovery email pipeline (1h post-abandon, 24h, 72h — configurable per tenant via marketing automation)
- Inventory reservations are NOT released at this point (still held); held until `JOB-SWEEP-EXPIRED-RESERVATIONS` finds individual reservation `expires_at` hit (30 min per RULE-INV-005)

**Note:** reservation TTL (30 min) je shorter než cart abandonment threshold (24h). To je úmyslné: stock se uvolní brzy, ale cart kontext (items, coupons) zůstává pro recovery. Při customer return z recovery email: cart reactivate, but inventory must be re-checked.

### RULE-CART-008: Cart expiration

Carts expire after **30 days** (configurable). `JOB-EXPIRE-CARTS` (daily):
- Find carts where `expires_at <= now()` AND `status IN ('active','abandoned')`
- Release any remaining reservations
- Mark `status='expired'`
- Soft-delete after 90 days (retention pro analytics)

### RULE-CART-009: Currency switching

When customer switches currency (UI dropdown), cart is re-priced via exchange rates from `exchange_rates` table. Items keep `variant_id`, but `unit_price_amount` recalculated.

Warning UI: "Prices may differ from your original currency due to exchange rates."

Affected cart entries:
- `cart.currency` updated
- All `cart_items.unit_price_amount`, `compare_at_amount` recomputed (via pricing engine using target currency price_list if available; fallback to exchange_rates conversion)

### RULE-CART-010: Stock revalidation at checkout init

Checkout init (transition to `checkout_session`) **always** re-validates inventory:
- For each cart_item: assert `stock_reservations.released_at IS NULL` AND `quantity` matches cart_item.quantity
- If stale (reservation expired during cart idle): re-attempt reservation; if fails → 422 `STOCK_INSUFFICIENT` with details

Detail v `12-checkout.md §5`.

### RULE-CART-011: Customization size limits

`cart_items.customization` JSONB:
- Max size 10 KB
- Max keys 50
- Max value string length 1000 chars
- Max file attachments: 5 files, each ≤ 5 MB

Enforced application-side; oversized → 422 `CUSTOMIZATION_TOO_LARGE`.

### RULE-CART-012: Bundle parent tracking

When customer adds bundle product (`products.type='bundle'`):
- 1 cart_item for the bundle parent (`is_bundle_child=false`, `bundle_parent_item_id=null`)
- N cart_items for each `product_bundle_items.child_variant_id` (`is_bundle_child=true`, `bundle_parent_item_id=parent.id`)
- Child items have `unit_price_amount = 0` (parent has the bundle price); or proportionally allocated for tax breakdown
- Removing parent cascades to children

Quantity changes apply to parent; children scale proportionally.

### RULE-CART-013: Coupon storage at cart level

`carts.applied_coupon_codes` is text[]. On apply:
- Validate coupon (RULE-PRICING-010)
- Add to array
- Re-run pricing (engine considers all applied coupons)
- Atomic with `discount_usage` row creation (released_at=null while in cart)

On cart abandon/expire: `discount_usage.released_at` set; usage_count decremented (if not yet converted to order).

### RULE-CART-014: Gift card application

Up to 5 gift cards per cart. Applied gift cards visible in `applied_gift_card_ids`. Total `gift_card_redeemed_amount` precomputed in cart aggregates. **Gift card is payment, not discount** (per `10` RULE-PRICING-014) — pricing engine just records the intent; actual redemption happens at order placement.

### RULE-CART-015: Cart access (logged-in customer)

`GET /carts/{id}` requires:
- If cart has `customer_id`: requester must be that customer (or staff with permission)
- If cart has `session_token`: requester must present matching session cookie
- Staff with `PERM-CART-VIEW` can access any cart in tenant

### RULE-CART-016: Cross-channel cart visibility

A cart created on web channel is NOT automatically visible in mobile app channel (different `channel_id`). Customer has separate cart per channel.

Exception: customer settings `merge_carts_across_channels=true` → single cart for customer regardless of channel. Default: per-channel isolation.

### RULE-CART-017: Channel switching during cart life

If customer switches channel mid-session (web → mobile app), system loads/creates cart for new channel. Old cart on web persists (active) but not visible in new channel UI.

### RULE-CART-018: Max items per cart

Configurable `tenant.settings.cart_max_items` (default 50 distinct items). Excess → 422 `CART_TOO_LARGE`.

### RULE-CART-019: Max quantity per item

- Variant-level: `inventory_items.max_per_order` (if set)
- Tenant-level: `tenant.settings.cart_max_quantity_per_item` (default 999)

Excess → 422 `QUANTITY_EXCEEDS_LIMIT`.

### RULE-CART-020: Cart pub_id for sharing

`carts.pub_id` (NanoID 12) lze share přes signed URL: `/cart/shared/{pub_id}?token=...` (signed HMAC). Viewer (not owner) sees read-only snapshot.

Sharing feature je v1.0+, schema ready v MVP.

### RULE-CART-021: Anonymous cart attribution

Marketing attribution (UTM params, referrer, IP-derived geo) snapshot v cart row při create. Pro abandoned cart analytics + funnel.

GDPR: anonymize `origin_ip_hash` after consent expiration (90 days default).

### RULE-CART-022: Read-only cart view for staff

`PERSONA-CUSTOMER-SERVICE` může otevřít customer's cart pro debugging / support. UI marks as "Viewing customer cart — changes will be visible to customer". Modifikace audited (cart_history actor_kind='user').

### RULE-CART-023: Cart cancel by customer

Customer může explicitně "Clear cart" → status='cancelled'. Releases reservations. Cannot revert; nový cart starts fresh.

Soft-delete pro audit; UI shows as gone.

---

## 6. REST API endpoints

### 6.1 Storefront cart endpoints

```
GET    /api/{date}/storefront/cart                          # current cart (resolved from session/customer)
POST   /api/{date}/storefront/cart                          # create explicit (rare; usually implicit on first add)
GET    /api/{date}/storefront/cart/{id}                     # specific cart by pub_id (own + sharing flow)

POST   /api/{date}/storefront/cart/items                    # add item
PATCH  /api/{date}/storefront/cart/items/{item_id}          # update qty / customization
DELETE /api/{date}/storefront/cart/items/{item_id}          # remove item
POST   /api/{date}/storefront/cart/items:bulk               # bulk add (e.g., "buy again" flow)

POST   /api/{date}/storefront/cart/apply-coupon
DELETE /api/{date}/storefront/cart/coupons/{code}
POST   /api/{date}/storefront/cart/apply-gift-card
DELETE /api/{date}/storefront/cart/gift-cards/{id}

POST   /api/{date}/storefront/cart/switch-currency          # body: { currency: "EUR" }
POST   /api/{date}/storefront/cart/switch-locale            # body: { locale: "en-US" }
PATCH  /api/{date}/storefront/cart/note                     # customer_note
PATCH  /api/{date}/storefront/cart/estimated-shipping       # postal_code / country for tax+shipping estimate

DELETE /api/{date}/storefront/cart                          # clear (status=cancelled)

POST   /api/{date}/storefront/cart/merge                    # explicit merge guest → customer (typically auto on login)
POST   /api/{date}/storefront/cart/recover                  # recover from abandoned token
POST   /api/{date}/storefront/cart/share                    # generate signed share URL (v1.0+)
```

### 6.2 Admin endpoints

```
GET    /api/{date}/carts                                    # list, filterable by status, customer_id, abandoned, value
GET    /api/{date}/carts/{id}
PATCH  /api/{date}/carts/{id}                               # staff edit (notes, items)
POST   /api/{date}/carts/{id}:cancel                        # staff cancel
POST   /api/{date}/carts/{id}:send-recovery                 # trigger recovery email manually
POST   /api/{date}/carts/{id}:convert-to-quote              # B2B quote conversion (v1.0+)
POST   /api/{date}/carts:create-on-behalf                   # staff creates cart for customer (POS, phone order)
GET    /api/{date}/carts/{id}/history                       # audit trail
```

### 6.3 Analytics endpoints

```
GET    /api/{date}/cart-analytics/abandonment-rate?period=30d
GET    /api/{date}/cart-analytics/conversion-funnel
GET    /api/{date}/cart-analytics/avg-cart-value
GET    /api/{date}/cart-analytics/top-abandoned-products
```

### 6.4 Example: Get cart

```http
GET /api/2026-05-19/storefront/cart HTTP/1.1
Cookie: shopio_cart_session=abc123...
Accept-Language: cs-CZ
```

```jsonc
HTTP/1.1 200 OK
ETag: "v17-7f8c"
Cache-Control: private, no-cache

{
  "data": {
    "id": "01927bca-...",
    "pub_id": "crt_aB3cD4eF5g6h",
    "type": "cart",
    "attributes": {
      "currency": "CZK",
      "locale": "cs-CZ",
      "status": "active",
      "customer_id": null,
      "channel_id": "ch_web",
      "items": [
        {
          "id": "itm_xY...",
          "variant_id": "var_aB",
          "product_id": "prd_aB",
          "sku": "LUNA-WHITE-S",
          "title": "Stolní lampa Luna",
          "variant_title": "Bílá / Malá",
          "primary_image_url": "https://cdn.shopio.com/...",
          "quantity": 2,
          "unit_price": { "amount": 49000, "currency": "CZK" },
          "compare_at_price": { "amount": 59000, "currency": "CZK" },
          "subtotal_before_discount": 98000,
          "discount_amount": 9800,
          "tax_amount": 18522,
          "total_amount": 106722,
          "customization": null,
          "added_at": "2026-05-19T14:25:00Z"
        }
      ],
      "subtotal_amount": 88200,
      "discount_amount": 9800,
      "tax_amount": 18522,
      "shipping_amount": 9900,
      "total_amount": 116622,
      "applied_coupon_codes": ["SUMMER10"],
      "applied_gift_card_ids": [],
      "gift_card_redeemed_amount": 0,
      "customer_note": null,
      "last_priced_at": "2026-05-19T14:30:00Z",
      "pricing_stale": false,
      "expires_at": "2026-06-18T14:30:00Z",
      "created_at": "2026-05-19T14:25:00Z",
      "updated_at": "2026-05-19T14:30:00Z"
    }
  },
  "meta": { "request_id": "req_...", "version": "2026-05-19" }
}
```

### 6.5 Example: Add item

```http
POST /api/2026-05-19/storefront/cart/items HTTP/1.1
Cookie: shopio_cart_session=abc123...
Content-Type: application/json
Idempotency-Key: 9c9f5e2a-...

{
  "variant_id": "var_xY",
  "quantity": 1,
  "customization": {
    "engraving": "For Anna",
    "gift_wrap": true
  }
}
```

```http
HTTP/1.1 200 OK
ETag: "v18-..."

{
  "data": {
    "cart": { ... full updated cart object ... },
    "added_item": {
      "id": "itm_zZ...",
      "quantity": 1,
      ...
    }
  }
}
```

Stock insufficient:
```http
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/problem+json

{
  "type": "https://docs.shopio.com/errors/stock-insufficient",
  "title": "Not enough in stock",
  "status": 422,
  "code": "STOCK_INSUFFICIENT",
  "detail": "Variant var_xY has only 2 units available; 5 requested (cart has 3 already).",
  "errors": [{
    "code": "STOCK_INSUFFICIENT",
    "path": "quantity",
    "context": {
      "variant_id": "var_xY",
      "available": 2,
      "in_cart": 3,
      "requested_additional": 5,
      "can_backorder": false
    }
  }]
}
```

### 6.6 Example: Apply coupon (success)

```http
POST /api/2026-05-19/storefront/cart/apply-coupon HTTP/1.1

{ "code": "SUMMER10" }
```

```http
HTTP/1.1 200 OK

{
  "data": {
    "cart": { ... updated PricedCart ... },
    "applied_coupon": {
      "code": "SUMMER10",
      "discount_id": "dsc_summer10",
      "amount_saved": 9800,
      "amount_currency": "CZK"
    }
  }
}
```

### 6.7 Example: Switch currency

```http
POST /api/2026-05-19/storefront/cart/switch-currency HTTP/1.1

{ "currency": "EUR" }
```

```jsonc
HTTP/1.1 200 OK

{
  "data": {
    "cart": { ... cart re-priced in EUR ... },
    "previous_currency": "CZK",
    "exchange_rate_used": 24.5,
    "exchange_rate_source": "cnb",
    "exchange_rate_date": "2026-05-19"
  },
  "meta": {
    "warning": "Prices recalculated from CZK at CNB rate 24.50. Original cart preserved as historical reference."
  }
}
```

### 6.8 Example: Recover abandoned cart

```http
POST /api/2026-05-19/storefront/cart/recover HTTP/1.1

{ "token": "eyJ...signed_HMAC..." }
```

```http
HTTP/1.1 200 OK

{
  "data": {
    "cart": { ... cart status reverted to 'active' ... },
    "recovered_from_stage": "day_1"
  },
  "meta": {
    "warnings": [
      "Some prices have changed since you last viewed your cart.",
      "1 item is no longer available."
    ]
  }
}
```

---

## 7. GraphQL schema

```graphql
type Cart implements Node & Timestamped {
  id: ID!
  pubId: String!
  customer: Customer
  channel: Channel
  store: Store
  company: Company
  customerGroup: CustomerGroup
  currency: String!
  locale: String!
  status: CartStatus!
  items: [CartItem!]!
  itemCount: Int!                        # sum of all line quantities
  distinctItemCount: Int!                # number of lines
  subtotalAmount: Money!
  discountAmount: Money!
  taxAmount: Money!
  shippingAmount: Money!
  shippingDiscountAmount: Money!
  giftCardRedeemedAmount: Money!
  totalAmount: Money!
  appliedCouponCodes: [String!]!
  appliedGiftCards: [GiftCard!]!
  discountBreakdown: [DiscountApplication!]!
  taxBreakdown: [TaxBreakdownItem!]!
  customerNote: String
  estimatedShippingCountry: String
  estimatedShippingPostalCode: String
  selectedShippingMethod: ShippingMethod
  lastActivityAt: DateTime!
  lastPricedAt: DateTime
  pricingStale: Boolean!
  expiresAt: DateTime
  abandonedAt: DateTime
  convertedToOrder: Order
  createdAt: DateTime!
  updatedAt: DateTime!
  metadata: JSON
}

enum CartStatus { ACTIVE ABANDONED CONVERTED EXPIRED MERGED CANCELLED }

type CartItem implements Node {
  id: ID!
  cart: Cart!
  product: Product!
  variant: ProductVariant!
  quantity: Int!
  sku: String!
  title: String!
  variantTitle: String
  primaryImageUrl: String
  unitPrice: Money!
  compareAtPrice: Money
  priceList: PriceList
  subtotalBeforeDiscount: Money!
  discountAmount: Money!
  discountBreakdown: [DiscountApplication!]!
  taxAmount: Money!
  taxRateBasisPoints: Int!
  totalAmount: Money!
  customization: JSON
  giftMessage: String
  customAttachments: [CartItemAttachment!]
  bundleParentItem: CartItem
  isBundleChild: Boolean!
  reservation: StockReservation              # nullable, may have expired
  position: Int!
  addedAt: DateTime!
  lastModifiedAt: DateTime!
}

type CartItemAttachment {
  filename: String!
  url: String!
  size: Int!
}

extend type Query {
  cart: Cart                                  # current customer/session
  cartById(id: ID!): Cart
  cartByPubId(pubId: String!): Cart
  cartByShareToken(token: String!): Cart!     # public share view (v1.0+)
  myCarts(first: Int, after: String): CartConnection!   # logged-in: all carts across channels

  # Admin
  carts(first: Int, after: String, filter: CartFilter): CartConnection! @auth(requires: PERM_CART_VIEW)
}

input CartFilter {
  status: [CartStatus!]
  customerId: ID
  channelId: ID
  abandonedSince: DateTime
  minValue: MoneyInput
  search: String
}

extend type Mutation {
  addCartItem(input: AddCartItemInput!): CartMutationPayload!
  updateCartItem(itemId: ID!, input: UpdateCartItemInput!): CartMutationPayload!
  removeCartItem(itemId: ID!): CartMutationPayload!
  bulkAddCartItems(items: [AddCartItemInput!]!): CartMutationPayload!

  applyCoupon(code: String!): CartMutationPayload!
  removeCoupon(code: String!): CartMutationPayload!
  applyGiftCard(code: String!): CartMutationPayload!
  removeGiftCard(giftCardId: ID!): CartMutationPayload!

  setCartCurrency(currency: String!): CartMutationPayload!
  setCartLocale(locale: String!): CartMutationPayload!
  setCartNote(note: String): CartMutationPayload!
  setEstimatedShipping(country: String, postalCode: String): CartMutationPayload!

  clearCart: CartMutationPayload!
  mergeGuestCart(targetCartId: ID, sessionToken: String!): CartMutationPayload!
  recoverCart(token: String!): CartMutationPayload!

  # Admin / staff
  staffCreateCartOnBehalf(input: StaffCartCreateInput!): Cart! @auth(requires: PERM_CART_CREATE_ON_BEHALF)
  staffEditCart(cartId: ID!, input: StaffCartEditInput!): Cart! @auth(requires: PERM_CART_EDIT)
  sendCartRecoveryEmail(cartId: ID!, stage: CartRecoveryStage = MANUAL): MutationPayload! @auth(requires: PERM_CART_SEND_RECOVERY)
}

enum CartRecoveryStage { HOUR_1 DAY_1 DAY_3 MANUAL STAFF_SEND }

type CartMutationPayload {
  cart: Cart!
  userErrors: [UserError!]!
  warnings: [String!]!                       # e.g., "Some prices changed"
}

input AddCartItemInput {
  variantId: ID!
  quantity: Int! = 1
  customization: JSON
  giftMessage: String
  bundleConfig: JSON                          # for variable bundles (v1.0+)
}

input UpdateCartItemInput {
  quantity: Int
  customization: JSON
  giftMessage: String
}
```

---

## 8. Events

| Build-spec ID | Wire | Payload |
|---|---|---|
| `EVENT-CART-CREATED` | `cart.created` | `{ cart }` |
| `EVENT-CART-UPDATED` | `cart.updated` | `{ cart, delta }` |
| `EVENT-CART-ITEM-ADDED` | `cart.item_added` | `{ cart_id, item, customer_id? }` |
| `EVENT-CART-ITEM-UPDATED` | `cart.item_updated` | `{ cart_id, item, previous_quantity }` |
| `EVENT-CART-ITEM-REMOVED` | `cart.item_removed` | `{ cart_id, item_snapshot }` |
| `EVENT-CART-COUPON-APPLIED` | `cart.coupon_applied` | `{ cart_id, code, discount_id, amount_saved }` |
| `EVENT-CART-COUPON-REMOVED` | `cart.coupon_removed` | `{ cart_id, code }` |
| `EVENT-CART-GIFT-CARD-APPLIED` | `cart.gift_card_applied` | `{ cart_id, gift_card_id, amount }` |
| `EVENT-CART-CURRENCY-CHANGED` | `cart.currency_changed` | `{ cart_id, previous, current, exchange_rate }` |
| `EVENT-CART-MERGED` | `cart.merged` | `{ source_cart_id, target_cart_id, items_moved, items_deduplicated }` |
| `EVENT-CART-ABANDONED` | `cart.abandoned` | `{ cart_id, items_count, value, customer_id?, customer_email? }` |
| `EVENT-CART-RECOVERED` | `cart.recovered` | `{ cart_id, stage, recovered_at }` |
| `EVENT-CART-CONVERTED` | `cart.converted` | `{ cart_id, order_id, customer_id }` |
| `EVENT-CART-EXPIRED` | `cart.expired` | `{ cart_id, items_count }` |
| `EVENT-CART-CANCELLED` | `cart.cancelled` | `{ cart_id, reason, actor_kind }` |
| `EVENT-CART-STAFF-EDITED` | `cart.staff_edited` | `{ cart_id, staff_user_id, delta }` |
| `EVENT-CART-SHARE-CREATED` | `cart.share_created` | `{ cart_id, share_url, expires_at }` |
| `EVENT-CART-PRICING-STALE` | `cart.pricing_stale` | `{ cart_id }` |

**Konzumenti:**
- **Marketing automation** — abandoned cart email pipeline (1h, 24h, 72h drip)
- **Search analytics** — track which products end up in carts (vs viewed); correlation
- **Inventory** — reservation lifecycle aligned with cart events
- **Customer 360 view** — cart history in CRM
- **Fraud detection** — anomaly patterns (rapid cart fill + abandon, unusual cart values)
- **Recommendation engine** — "Customers who added X also added Y" (Fáze 2+)
- **Webhook delivery** — per merchant subscription
- **External CDP** (Segment, RudderStack) — Fáze 2+ integration

---

## 9. Background jobs

| Job | Trigger | Queue | Frequency |
|---|---|---|---|
| `JOB-DETECT-ABANDONED-CARTS` | scheduled | `cart-sweeper` | Every 15 min |
| `JOB-EXPIRE-CARTS` | scheduled | `cart-sweeper` | Daily 03:00 |
| `JOB-DETECT-STALE-PRICING` | scheduled | `cart-sweeper` | Every 15 min |
| `JOB-RE-PRICE-CART` | EVENT-PRICE-CHANGED affecting cart variants (debounced) | `cart-pricing` | On-demand |
| `JOB-SEND-CART-RECOVERY-EMAIL` | abandoned cart at 1h/24h/72h marks | `notifications` | Scheduled per stage |
| `JOB-CLEANUP-EXPIRED-RECOVERY-TOKENS` | scheduled | `maintenance` | Daily 04:00 |
| `JOB-CART-ATTACHMENT-VIRUS-SCAN` | EVENT-CART-ITEM-ATTACHMENT-UPLOADED | `security` | On-demand |
| `JOB-COMPUTE-CART-ANALYTICS-DAILY` | scheduled | `analytics` | Daily 05:00 |
| `JOB-CLEANUP-SOFT-DELETED-CARTS` | scheduled | `maintenance` | Daily 03:30 |
| `JOB-CART-OUTBOX-PUBLISH` | continuous | `outbox-publisher` | Always |
| `JOB-NOTIFY-BACK-IN-STOCK-FROM-CART` | EVENT-STOCK-RESTOCKED + cart has variant | `notifications` | On-demand |

### 9.1 JOB-DETECT-ABANDONED-CARTS detail

```
Steps:
  Threshold := tenant.settings.cart_abandon_threshold_seconds (default 86400 = 24h)
  Query:
    SELECT id FROM carts
    WHERE status = 'active'
      AND last_activity_at < now() - interval Threshold seconds
      AND deleted_at IS NULL
    LIMIT 1000;
  
  For each cart (batch atomic):
    UPDATE carts SET status='abandoned', abandoned_at=now()
    INSERT cart_history (event_kind='abandoned')
    INSERT outbox_events (event_type='cart.abandoned', payload={cart_id, items_count, value, customer_email})
  
Schedule recovery emails at 1h, 24h, 72h relative to abandoned_at.
Per-tenant settings can disable recovery.
```

### 9.2 JOB-SEND-CART-RECOVERY-EMAIL detail

```
Steps:
  Cart info: items still in cart, total value, customer email (or guest email if captured)
  Recovery token: generate HMAC-signed token, store in cart_recovery_tokens
  Email template: based on stage (hour_1, day_1, day_3)
    - Item images, prices (with current prices NOT cart snapshot — RULE-CART-007 nuance)
    - Recovery URL: /storefront/cart/recover?token={signed}
    - Optional discount incentive (configurable per stage; e.g., day_3 includes 10% coupon)
  Send via email provider (DEC-DEPS: Resend / SES / SMTP)
  Mark token emitted_at, mark stage
```

### 9.3 JOB-RE-PRICE-CART detail

Reactivně re-prices carts affected by price/discount/inventory events:

```
Trigger: EVENT-PRICE-CHANGED, EVENT-DISCOUNT-ACTIVATED/EXPIRED, EVENT-STOCK-LEVEL-CHANGED
Filter: find active carts containing affected variants

Steps:
  For each affected cart (batch atomic, advisory lock per cart):
    Re-run pricing engine (10 RULE-PRICING-018)
    Update cart aggregates + cart_items.unit_price_amount/discount/tax
    Set last_priced_at = now(), pricing_stale = false
    Emit EVENT-CART-UPDATED with delta describing change
    Notify customer if delta exceeds threshold (e.g., > 10% change) — push notification or banner on next visit
```

**Throughput:** debounced 5 min per affected variant to prevent storm during bulk import.

---

## 10. UI/UX flows

### FLOW-CART-001: Add to cart (storefront)

```
[PDP product detail page]
   - Select variant (color/size)
   - Quantity selector
   - "Add to cart" CTA
        │
   click
        │
        ▼
[POST /storefront/cart/items]
   - Loading spinner on CTA
   - On success:
     - Toast: "Added to cart"
     - Mini-cart drawer slides open (optional, configurable per theme)
     - Header cart count badge updates (+1)
   - On fail:
     - Error toast: "Out of stock" / "Cart limit reached" etc.
     - CTA reset
```

### FLOW-CART-002: Cart page

```
[/cart]
   - Item list with: image, title, variant, qty stepper, line price + discount, remove btn
   - Order summary panel (right side desktop / bottom mobile):
     - Subtotal
     - Discounts (with code badges)
     - Estimated shipping (if postal entered)
     - Tax
     - Total
   - Coupon input box
   - Gift card input box
   - Customer note textarea
   - "Continue shopping" + "Checkout" CTAs
   - "You may also like" recommended products (Fáze 2)
```

### FLOW-CART-003: Quantity update

```
[Cart item row — qty stepper]
   click +/− or input change
        │
        │  debounced 300ms (prevent rapid-fire mutations)
        ▼
[PATCH /cart/items/{id} with new quantity]
   - Optimistic UI update (qty + line total)
   - On success: refresh cart totals
   - On fail (stock):
     - Revert UI
     - Toast: "Only N available"
     - Auto-set qty to N (configurable)
```

### FLOW-CART-004: Guest checkout login → merge

```
[Cart page — guest]
   click "Continue to checkout"
        │
        ▼
[Checkout step 1: Account]
   - "Sign in" link
   - Email field (guest)
        │
   user clicks "Sign in"
        │
        ▼
[Login modal]
   submit credentials
        │
        ▼
[Backend detects:
   - Guest cart by session_token: present
   - Customer existing cart: present (or not)]
        │
        ▼
   if no customer cart: guest cart adopted as customer's cart (status remains active)
   if customer cart exists:
      [Merge confirm modal: "We found another cart from a previous session. Merge?"]
        │
        ├─ "Merge" → POST /cart/merge → items deduplicated
        ├─ "Replace with previous" → cancel guest cart, use customer's
        └─ "Cancel" → abort login
```

### FLOW-CART-005: Abandoned cart recovery email

```
[Customer leaves cart, no checkout]
   24h passes, JOB-DETECT-ABANDONED-CARTS marks abandoned
        │
        ▼
[JOB-SEND-CART-RECOVERY-EMAIL at hour_1, day_1, day_3 stages]
   Email arrives:
   - "Your cart is waiting"
   - Item thumbnails + prices (current at send time)
   - "Resume your purchase" → URL with recovery token
   - Optional: incentive coupon for day_3
        │
   customer clicks URL
        │
        ▼
[POST /storefront/cart/recover with token]
   - Token validated, cart reactivated (status=active)
   - Inventory re-checked (reservations may have expired):
     - Items with insufficient stock removed or qty-reduced; warning shown
   - Prices refreshed (warning if changed)
        │
        ▼
[Storefront /cart page, customer continues]
```

### FLOW-CART-006: Customer service — create cart on behalf

```
[Admin → Customers → {customer} → "Create cart on behalf"]
   or [Admin → Carts → "New cart for customer X"]
        │
        ▼
[Cart creation form]
   - Customer pickr (search)
   - Channel: typically web; for POS use mobile/pos channel
   - Currency, locale
        │
        ▼
[POST /carts:create-on-behalf]
   - Cart created, status=active, staff_note auto-set "Created by {staff_email}"
        │
        ▼
[Admin cart editor view]
   - Same as storefront but admin context
   - Add items via product picker
   - Apply discount manually (PERM-PROMOTION-APPLY-MANUAL)
   - "Send to customer" → email with recovery link, customer continues checkout
```

### FLOW-CART-007: Switch currency (storefront)

```
[Header currency dropdown — customer selects EUR]
        │
        ▼
[POST /storefront/cart/switch-currency]
   - Cart re-priced via exchange_rates
   - Confirmation banner: "Prices updated. Exchange rate: 1 EUR = 24.50 CZK (CNB, 2026-05-19)"
   - All product pages now show EUR
```

---

## 11. Edge cases & error handling

| Scenario | Behavior | Code |
|---|---|---|
| Add item, variant deleted | Reject | `PRODUCT_UNAVAILABLE`, 422 |
| Add item, variant inactive (`is_active=false`) | Reject | `PRODUCT_UNAVAILABLE`, 422 |
| Add item, exceeds max_per_order | Reject | `QUANTITY_EXCEEDS_LIMIT`, 422 |
| Add item, cart at max items | Reject | `CART_TOO_LARGE`, 422 |
| Add item, stock insufficient (incl. backorder check) | Reject (per `09`) | `STOCK_INSUFFICIENT`, 422 |
| Add same variant + same customization twice | Increment existing line | (success) |
| Add same variant + different customization | New line | (success) |
| Update qty to 0 | Treat as remove | (success) |
| Update qty when reservation expired | Auto-retry reservation; if fails → 422 | (handled) |
| Concurrent edits from 2 devices on same cart | Advisory lock serializes; later edit sees updated state | (handled) |
| Remove last item from cart | Cart stays (status=active, empty); total=0 | (success) |
| Apply coupon, customer not eligible | Reject | `COUPON_NOT_ELIGIBLE`, 422 (delegated to `10`) |
| Switch currency, no exchange rate available | Reject; fallback configurable | `EXCHANGE_RATE_UNAVAILABLE`, 422 |
| Merge guest cart, target cart already converted | Reject merge | `TARGET_CART_NOT_ACTIVE`, 422 |
| Merge guest cart, currencies differ | UI flow: user picks; default = target currency | (handled per RULE-CART-006) |
| Cart pricing stale (>1h) during checkout init | Force re-price before continuing; show diff | (handled per RULE-CART-010) |
| Customization JSONB >10KB | Reject | `CUSTOMIZATION_TOO_LARGE`, 422 |
| Custom attachment file >5MB or virus detected | Reject | `ATTACHMENT_REJECTED`, 422 |
| Apply same coupon twice | Reject second | `COUPON_ALREADY_APPLIED`, 422 |
| Cart expired while in checkout | Return to cart page, restore items where possible; warning | (handled) |
| Customer logs in, has guest cart, has another customer cart on different channel | Per RULE-CART-016: separate carts maintained; merge flow only applies to same channel | (handled) |
| Bundle parent removed | Children cascade (delete cart_items where bundle_parent_item_id=...) | (handled) |
| Cart share URL accessed after share expired | 410 Gone | `SHARE_EXPIRED`, 410 |
| Cart access by wrong customer | 404 (not 403, prevent enum) | `NOT_FOUND`, 404 |
| Stale ETag on PATCH cart | 412 | `RESOURCE_VERSION_MISMATCH`, 412 |
| Cart with all items removed but coupon still applied | Coupon stays in `applied_coupon_codes`; pricing recompute shows zero discount; UI option "Clear coupon" | (handled) |
| Customer changes customer_group mid-cart (admin action) | Re-price cart with new group's price_list | (handled) |
| Tenant currency disabled, customer has cart in that currency | Force-convert to tenant default at next mutation; warning | (handled) |
| Variant deleted while in cart | cart_item stays (snapshot preserves data); marked unavailable in UI; cannot checkout until removed | (handled) |
| Storefront request without session cookie | Generate new session_token, set cookie, create new empty cart implicitly on first item add | (handled) |

---

## 12. Performance

### 12.1 Targets

| Operation | p50 | p95 | p99 |
|---|---|---|---|
| `GET /storefront/cart` (cached Redis) | 5 ms | 15 ms | 40 ms |
| `GET /storefront/cart` (cache miss) | 25 ms | 80 ms | 150 ms |
| `POST /cart/items` (add, includes pricing + reservation) | 30 ms | 100 ms | 250 ms |
| `PATCH /cart/items/{id}` (qty update) | 25 ms | 80 ms | 180 ms |
| `DELETE /cart/items/{id}` | 20 ms | 60 ms | 150 ms |
| `POST /cart/apply-coupon` | 35 ms | 120 ms | 250 ms |
| `POST /cart/switch-currency` (rebuild with exchange rates) | 40 ms | 150 ms | 300 ms |
| `POST /cart/merge` (10 items) | 80 ms | 250 ms | 600 ms |
| `JOB-DETECT-ABANDONED-CARTS` (1000 carts) | 500 ms | 2000 ms | 5000 ms |
| `JOB-RE-PRICE-CART` per cart | 30 ms | 100 ms | 250 ms |

### 12.2 Optimization

- **Redis L4 cache** pro full PricedCart JSON (TTL 5 min, invalidated on every mutation)
- **Advisory lock per cart** for serialization — fine-grained, no global cart lock
- **Single transaction per mutation:** pricing + reservation + history + outbox in 1 Tx
- **Debounced pricing recompute** for rapid mutations (e.g., qty 1→2→3 in 100ms)
- **Lazy load full PricedCart** — list endpoints return cart summary, detail endpoints return full
- **DataLoader** for GraphQL batching across multiple cart items' variants, products, media
- **Bulk merge** uses single Tx for all items moved
- **Partitioned cart_history** by month (BRIN index)

### 12.3 Hot path queries

```sql
-- Get cart by session token (anonymous)
SELECT * FROM carts
WHERE tenant_id = $1 AND session_token = $2 AND status = 'active' AND deleted_at IS NULL
LIMIT 1;
-- Uses idx_carts_session_token

-- Get cart by customer (logged-in)
SELECT * FROM carts
WHERE tenant_id = $1 AND customer_id = $2 
  AND COALESCE(channel_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE($3::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
  AND status = 'active' AND deleted_at IS NULL
LIMIT 1;
-- Uses uq_carts_customer_active_per_channel
```

```sql
-- Find affected carts when price changes
SELECT DISTINCT cart_id FROM cart_items
WHERE variant_id = $variant_id;
-- Uses idx_cart_items_variant
```

### 12.4 Cache invalidation strategy

- **Redis cart cache** invalidated by tag `cart:{cart_id}` on every cart mutation
- **CDN edge cache** — carts are `private, no-cache`, never CDN-cached
- **Cross-device sync** — for v1.0+ real-time, SSE channel `cart:{customer_id}` notifies all connected devices

### 12.5 Scaling notes

- **Cart table growth:** ~5–20 carts per active customer per month; 30-day TTL = manageable
- **cart_history table:** larger, partitioned monthly, BRIN-indexed
- **Active cart count budget:** ~1M concurrent active carts per Postgres instance (with proper indexes)
- **Beyond 1M:** consider per-tenant cart DB partition (already designed for in 03 §1.4 tenant_id)

---

## 13. Security

### 13.1 Permissions

```
PERM-CART-VIEW                    # staff view any cart
PERM-CART-CREATE-ON-BEHALF        # POS, phone orders
PERM-CART-EDIT                    # staff modify cart
PERM-CART-SEND-RECOVERY           # trigger recovery email
PERM-CART-CANCEL                  # staff cancel
PERM-CART-VIEW-PII                # view customer PII attached to cart
PERM-CART-ANALYTICS-VIEW
PERM-CART-POS                     # POS terminal operations
```

### 13.2 Cart access control

- Per RULE-CART-015: customer can only access own carts; session_token verifies guest carts
- Staff `PERM-CART-VIEW` grants access to all tenant carts; audit logged
- Share token URLs use HMAC signature + expiration

### 13.3 PII handling

- `carts.origin_ip_hash` (SHA-256 of IP with salt) — anonymized; can be cascaded to NULL after GDPR consent expire
- `carts.customer_note` may contain PII (gift recipient address etc.) — treated as PII for export/delete
- Custom attachments — virus scanned (ClamAV), signed URLs only

### 13.4 Idempotency

All mutations require `Idempotency-Key` header (per `04 §11`). Mutations are idempotent — replaying same key = same result.

### 13.5 Audit log

- 100% mutations logged to cart_history
- Sensitive (staff_edit, manual_discount) also written to global audit_log
- High-value cart access (>10K Kč) by staff: extra audit entry

### 13.6 Rate limits

| Endpoint | Anon | Auth Free | Auth Pro |
|---|---|---|---|
| `POST /cart/items` (add) | 60/min/session | 300/min | 1500/min |
| `PATCH /cart/items/{id}` | 120/min/session | 600/min | 6000/min |
| `POST /cart/apply-coupon` | 30/min/session | 30/min | 30/min |
| `POST /cart/switch-currency` | 10/min/session | 30/min | 100/min |
| `POST /cart/recover` | 10/min/IP | 30/min | 100/min |
| `GET /carts` (admin list) | n/a | 60/min | 600/min |

### 13.7 Coupon brute-force protection

`POST /cart/apply-coupon` rate-limited stringently (30/min per session). Beyond limit: 429 + CAPTCHA challenge (Fáze 2).

### 13.8 CSRF

Storefront mutations require:
- For session-cookie: CSRF token in header `X-CSRF-Token`
- For Bearer JWT: implicit (token in Authorization header)

---

## 14. Testing

### 14.1 Unit

```
TEST-UNIT-CART-001  CustomizationHasher — canonical JSON deterministic
TEST-UNIT-CART-002  CartMergeStrategy — guest into customer, dedup logic
TEST-UNIT-CART-003  AbandonmentDetector — threshold computation
TEST-UNIT-CART-004  StaleDetector — last_priced_at threshold
TEST-UNIT-CART-005  RecoveryTokenSigner — HMAC verification
TEST-UNIT-CART-006  CartAggregator — sum from items, deterministic
```

### 14.2 Integration

```
TEST-INT-CART-001   Create cart implicitly on first add
TEST-INT-CART-002   Add item creates reservation + cart_item + cart_history
TEST-INT-CART-003   Update qty adjusts reservation
TEST-INT-CART-004   Remove item releases reservation
TEST-INT-CART-005   Cart expire releases reservations via sweeper
TEST-INT-CART-006   Concurrent add to same cart (50 parallel) — serialized correctly
TEST-INT-CART-007   Customer login merges guest cart, dedup items
TEST-INT-CART-008   Currency switch re-prices via exchange rates
TEST-INT-CART-009   Stale pricing detected → checkout re-prices
TEST-INT-CART-010   Coupon apply atomic with usage tracking
TEST-INT-CART-011   Coupon usage released on cart abandon
TEST-INT-CART-012   Bundle item add cascades child items
TEST-INT-CART-013   Cart with mixed price list items rerprices correctly
TEST-INT-CART-014   Abandoned cart recovery token validates + reactivates
TEST-INT-CART-015   Cart history records all mutations
TEST-INT-CART-016   Outbox events emitted in same Tx as cart change
TEST-INT-CART-017   Staff create on behalf + customer continues checkout
```

### 14.3 E2E (Playwright)

```
TEST-E2E-CART-001  Guest browses, adds 3 items, views cart, applies coupon, proceeds to checkout
TEST-E2E-CART-002  Guest adds, refreshes browser, cart persists (session cookie)
TEST-E2E-CART-003  Guest checkout → customer login → cart merges seamlessly
TEST-E2E-CART-004  Customer on desktop + mobile: sync (v1.0+) OR both load from server on refresh (MVP)
TEST-E2E-CART-005  Abandoned cart email recovery flow end-to-end
TEST-E2E-CART-006  Customer customizes item (engraving), 2nd add increments qty, different engraving = 2nd line
TEST-E2E-CART-007  Storefront switch currency — cart and PDP update
TEST-E2E-CART-008  Staff creates cart on behalf, sends to customer, customer continues
TEST-E2E-CART-009  Cart pricing stale warning → user accepts re-priced cart
TEST-E2E-MCP-CART-001  External agent calls cart.add_item with scoped token
```

### 14.4 Load (k6)

```
TEST-LOAD-CART-001  500 concurrent add-to-cart for hot variant — proper serialization, no oversell
TEST-LOAD-CART-002  10k carts, 100 RPS GET /cart — p95 < 50 ms (cache hit dominant)
TEST-LOAD-CART-003  100k abandoned carts swept in < 60s
TEST-LOAD-CART-004  Bulk merge 1000 guest carts to customer carts simulating Black Friday rush
```

### 14.5 Chaos

```
TEST-CHAOS-CART-001  Redis cache outage — Postgres serves direct reads, latency degraded but correct
TEST-CHAOS-CART-002  Pricing engine timeout (>5s) — cart returns stale snapshot with warning
TEST-CHAOS-CART-003  Inventory service outage — cart mutation rejects with 503 + retry-after
```

---

## 15. Implementation checklist

### Backend
- [ ] **[S]** Drizzle schema `packages/db/src/schema/cart/*.ts`
- [ ] **[S]** Migrace `20260525_001_create_cart_tables.sql` + partitions + indexes
- [ ] **[L]** `CartService` core — get, create, mutate, merge (atomic Tx, advisory locking)
- [ ] **[M]** `CartItemService` — add/update/remove with reservation coordination
- [ ] **[S]** `CustomizationHasher` — deterministic canonical JSON hash
- [ ] **[M]** `CartMergeService` — guest → customer logic
- [ ] **[M]** `CartRecoveryService` — token generation, validation, reactivation
- [ ] **[S]** `CartAggregator` — pure function totals from items
- [ ] **[M]** `CartCacheLayer` — Redis read-through + invalidation
- [ ] **[M]** REST endpoints per §6
- [ ] **[M]** GraphQL types + resolvers + DataLoaders
- [ ] **[S]** tRPC router (admin)
- [ ] **[M]** MCP tool `cart.get`, `cart.add_item` (v1.0+ scoped)
- [ ] **[S]** Storefront helpers: `useCart()` hook, `<MiniCart>` component primitives

### Background jobs
- [ ] **[M]** JOB-DETECT-ABANDONED-CARTS — batched
- [ ] **[M]** JOB-EXPIRE-CARTS — daily
- [ ] **[S]** JOB-DETECT-STALE-PRICING
- [ ] **[L]** JOB-RE-PRICE-CART — reactive to price/discount events, debounced
- [ ] **[M]** JOB-SEND-CART-RECOVERY-EMAIL — staged delivery
- [ ] **[S]** JOB-CLEANUP-EXPIRED-RECOVERY-TOKENS
- [ ] **[S]** JOB-CART-ATTACHMENT-VIRUS-SCAN
- [ ] **[S]** JOB-COMPUTE-CART-ANALYTICS-DAILY
- [ ] **[S]** JOB-NOTIFY-BACK-IN-STOCK-FROM-CART
- [ ] **[S]** JOB-CLEANUP-SOFT-DELETED-CARTS

### Frontend — Admin
- [ ] **[M]** Carts list view (filter by status, customer, value)
- [ ] **[M]** Cart detail view (line items, totals, history)
- [ ] **[M]** Staff edit cart UI (with audit warnings)
- [ ] **[M]** Abandoned carts dashboard (action: send recovery)
- [ ] **[M]** Create cart on behalf flow (POS / phone order)
- [ ] **[S]** Cart history timeline component
- [ ] **[S]** Cart analytics dashboards (abandonment rate, conversion funnel)

### Frontend — Storefront
- [ ] **[L]** Cart page layout (item list, summary, coupon, gift card, notes, CTAs)
- [ ] **[M]** Mini-cart drawer (slide-in)
- [ ] **[S]** Header cart badge with count
- [ ] **[M]** Add-to-cart button states (default, loading, success, error)
- [ ] **[M]** Quantity stepper (debounced, optimistic UI)
- [ ] **[S]** Coupon input + applied chips UI
- [ ] **[S]** Gift card input + applied UI
- [ ] **[S]** Customer note textarea
- [ ] **[S]** Customization modal (gift wrap, engraving, attachments)
- [ ] **[S]** Currency / locale switcher
- [ ] **[M]** Merge cart confirmation modal (on login)
- [ ] **[S]** "Resume cart" recovery landing page (from email link)
- [ ] **[S]** Stale pricing warning banner

### Tests
- [ ] **[M]** Per §14 (unit + integration + E2E + load + chaos)

### Docs
- [ ] **[S]** "Managing customer carts" admin guide
- [ ] **[S]** "Recovery email automation" merchant guide
- [ ] **[S]** Developer: "Cart event hooks for plugins"
- [ ] **[S]** API: cart endpoints reference
- [ ] **[S]** "MCP cart tool" agent integration guide

---

## 16. Open questions

### Q-CART-001: Real-time cross-device cart sync
**Otázka:** SSE / WebSocket channel notifying all customer devices on cart change?

**Status:** v1.0+ feature. MVP: customer must refresh on second device to see changes (eventual consistency).

### Q-CART-002: Multi-cart per customer
**Otázka:** B2B customer with multiple ongoing carts (different projects, different ship-to addresses)?

**Status:** v1.0+ B2B feature. MVP enforces 1 active cart per (customer, channel, company).

### Q-CART-003: Cart sharing
**Otázka:** Customer shares cart URL with friend ("look at this gift idea") — friend adds items?

**Status:** v1.0+ feature. Read-only sharing via signed URL in MVP planned but UI deferred.

### Q-CART-004: Saved-for-later (wishlist-cart hybrid)
**Otázka:** "Move to saved for later" — distinct list, doesn't reserve stock, doesn't expire?

**Status:** v1.0+ feature. MVP: separate wishlist via `19-marketing-seo.md` (TBD).

### Q-CART-005: Subscription items in cart
**Otázka:** Mix one-time + subscription items in one cart?

**Status:** v2.0+ when subscriptions launch. Detail in `24-subscriptions.md`.

### Q-CART-006: Cart limits by tier
**Otázka:** Free tier merchants — cart max 20 items; Enterprise — unlimited?

**Status:** Configurable via `tenant.settings.cart_max_items`. Defaults different per plan, not enforced as hard tier feature.

### Q-CART-007: Storage cost of long-lived carts
**Otázka:** 30-day cart TTL + history retention = sizable Postgres table.

**Status:** Monitor; partition cart_history monthly. Aggressive expire for low-value carts (configurable).

### Q-CART-008: AI suggestions in cart
**Otázka:** "Complete the look" — recommendation based on cart contents?

**Status:** Fáze 2+ feature in `33-ai-features.md`. Integration point: `EVENT-CART-ITEM-ADDED` → recommendation engine.

### Q-CART-009: Bundle in cart with variant choice
**Otázka:** Bundle with "any of these 3 variants" — customer picks at cart level or PDP?

**Status:** MVP: PDP-locked (bundle config). v1.0+: cart-level variant choice via composable bundle (see `06 Q-PIM-003`).

### Q-CART-010: Webhook on every cart event
**Otázka:** Some events high-volume (every quantity update). Subscribers may not want all.

**Status:** Default subscription is opt-in per event_type. Webhook destination supports filter expression (Fáze 2+).

### Q-CART-011: Pre-checkout shipping calc
**Otázka:** Cart already calls shipping service for "estimated shipping" — overhead?

**Status:** Cached per (cart_hash, postal_code) for 5 min. Storefront UI toggles "Calculate shipping" lazily.

### Q-CART-012: Cart import/export (B2B replenishment)
**Otázka:** B2B customer uploads CSV of SKUs + qty → instant cart fill?

**Status:** v1.0+ B2B feature. MVP: API endpoint `POST /cart/items:bulk` supports up to 100 items per call (covers most cases).

---

## 📅 Změny

| Datum | Změna |
|---|---|
| 2026-05-19 | Initial — Cart domain. Atomic mutation pipeline, guest→customer merge, abandonment recovery, multi-currency, inventory + pricing coordination. |

---

**Konec Cart.**

➡️ Pokračovat na: [`12-checkout.md`](12-checkout.md)
