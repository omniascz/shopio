# 10 – PRICING, PROMOTIONS & DISCOUNTS

> **Doména:** Cenotvorba. Price lists, ceny per variant, tier pricing, slevy, kupóny, gift cards, promotion rules. Pricing engine je **deterministický** — stejné vstupy = stejný výstup. Bez side effects.

**Datum:** 2026-05-19
**Verze:** 1.0
**Status:** 🟡 DESIGN
**Reference:** [03 §7](03-data-models-master.md#7-pricing-promotions--tax) · [06-catalog-pim.md](06-catalog-pim.md) · [11-cart.md](11-cart.md) · [15-tax-compliance.md](15-tax-compliance.md)

---

## 📑 Obsah

0. [Domain overview](#0-domain-overview)
1. [References](#1-references)
2. [Personas](#2-personas)
3. [Data models](#3-data-models)
4. [State machines](#4-state-machines)
5. [Business rules](#5-business-rules)
6. [Pricing calculation pipeline](#6-pricing-calculation-pipeline)
7. [REST API endpoints](#7-rest-api-endpoints)
8. [GraphQL schema](#8-graphql-schema)
9. [Events](#9-events)
10. [Background jobs](#10-background-jobs)
11. [UI/UX flows](#11-uiux-flows)
12. [Edge cases & error handling](#12-edge-cases--error-handling)
13. [Performance](#13-performance)
14. [Security](#14-security)
15. [Testing](#15-testing)
16. [Implementation checklist](#16-implementation-checklist)
17. [Open questions](#17-open-questions)

> **Poznámka k structure:** Pricing engine pipeline je tak ústřední, že má vlastní sekci 6. Ostatní template sekce posunuté +1.

---

## 0. Domain overview

### 0.1 Co tato doména **je**

- **Price lists** — sady cen (retail, B2B, channel-specific, promotional). Selected at runtime podle customer/company/channel context
- **Prices** — per (price_list, variant) s time-bound (sale period) + tier-based (volume)
- **Discounts** — pravidla, která srazí cenu: `percentage`, `fixed`, `bogo`, `free_shipping`, `bundle`
- **Coupons** — codes gating discount activation, optional per-customer single-use
- **Gift cards** — pay-with-balance instrument (separate od discount)
- **Promotion rules** — advanced rule builder (Shopware-inspired visual editor, v1.0+)
- **Compare-at-price** — strike-through "was 1990, now 1490" UX
- **Tier pricing** — volume discounts ("nakupuj 10+ ks za nižší cenu")
- **Multi-currency** — per price_list měna; conversion při display
- **Stacking rules** — kdy lze kombinovat slevy, kdy ne

### 0.2 Co tato doména **NENÍ**

- ❌ Tax / DPH calculation (→ `15-tax-compliance.md`) — pricing dává **net** nebo **gross** cenu podle merchant config; tax engine přidá nebo extrahuje VAT
- ❌ Payment methods, gateway routing (→ `13-payments.md`)
- ❌ Shipping cost calc (→ `14-shipping.md`) — shipping rates mohou být price-listované, ale doménově patří k shipping
- ❌ Order totals snapshot (→ `16-order-management.md`) — pricing computes; order snapshots
- ❌ Subscription billing cycles (→ `24-subscriptions.md`)
- ❌ Marketplace seller commissions (→ `25-marketplace.md`)

### 0.3 Diferenciátory

1. **Deterministický pricing engine** — stejné vstupy (variant, qty, customer_group, channel, coupons, time) = vždy stejný output. Žádný global state, žádné side-effects.
2. **Snapshot at checkout** — cena snapshotnutá v order_items v moment placement; pozdější změny ceník neovlivní existing orders.
3. **Composable discount engine** — discounts jsou data, ne kód; lze definovat přes API, plugin může přidat custom discount type
4. **0 % transaction fee** napořád ([DEC-BIZ-001](01-decisions-registry.md#dec-biz-001-pricing-model)) — žádný platform cut z ceny
5. **B2B-lite ready od MVP** — per-company tier pricing přes `price_lists.company_id`, plný B2B v1.0

---

## 1. References

- [03 §7](03-data-models-master.md#7-pricing-promotions--tax) — entity ENT-PRICE-LIST-001 až ENT-GIFT-CARD-001
- [DEC-BIZ-001](01-decisions-registry.md#dec-biz-001-pricing-model) — no transaction fees, capacity-based plan tiers
- [06-catalog-pim.md](06-catalog-pim.md) — products + variants; `is_taxable`, `tax_class_code`
- [11-cart.md](11-cart.md) — cart snapshot cen
- [12-checkout.md](12-checkout.md) — finalizace pricing před order placement
- [15-tax-compliance.md](15-tax-compliance.md) — tax engine (tax-inclusive vs exclusive)
- [16-order-management.md](16-order-management.md) — order_items snapshot
- [18-customer-management.md](18-customer-management.md) — customer_group selection
- [21-b2b-complete.md](21-b2b-complete.md) — company-specific pricing (v1.0+)
- [22-multistore-channels.md](22-multistore-channels.md) — channel-scoped price_lists
- [13-payments.md](13-payments.md) — gift card payment integration
- [DEC-EVENTS-001](01-decisions-registry.md#dec-events-001-event-bus--background-jobs) — outbox pro price change events

---

## 2. Personas

| Persona | Použití | Klíčové permissions |
|---|---|---|
| `PERSONA-MERCHANT-OWNER` | Vše | `PERM-PRICING-*`, `PERM-PROMOTION-*` |
| `PERSONA-PRICING-MANAGER` | Price lists, base prices, tier pricing | `PERM-PRICING-MANAGE` |
| `PERSONA-MARKETING-MANAGER` | Discounts, coupons, promotion rules | `PERM-PROMOTION-*`, `PERM-COUPON-MANAGE` |
| `PERSONA-CATALOG-MANAGER` | View prices; edit per-product if tier permits | `PERM-PRICING-VIEW`, `PERM-PRICING-MANAGE` (field-limited) |
| `PERSONA-CUSTOMER-SERVICE` | Apply discount na order (manual override) | `PERM-PROMOTION-APPLY-MANUAL`, `PERM-ORDER-EDIT` |
| `PERSONA-CUSTOMER` | View prices, redeem coupons | Anon (storefront) |
| `PERSONA-B2B-EMPLOYEE` | Sees company-tier prices | Auth (logged-in B2B) |
| `PERSONA-AI-COPILOT` | Suggest promo strategies, A/B test pricing (Fáze 3+) | `agent:pricing:read` |
| `PERSONA-EXTERNAL-AGENT` | MCP `pricing.get_price` | `agent:catalog:read` |

---

## 3. Data models

### 3.1 `price_lists` ([ENT-PRICE-LIST-001](03-data-models-master.md#ent-price-list-001))

```sql
CREATE TABLE price_lists (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  description TEXT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('retail','b2b','promotional','channel','customer_specific','agent')) DEFAULT 'retail',
  currency CHAR(3) NOT NULL,
  customer_group_id UUID NULL REFERENCES customer_groups(id),
  company_id UUID NULL REFERENCES companies(id),
  channel_id UUID NULL REFERENCES channels(id),
  customer_id UUID NULL REFERENCES customers(id),         -- per-customer pricing
  starts_at TIMESTAMPTZ NULL,
  ends_at TIMESTAMPTZ NULL,
  priority INTEGER NOT NULL DEFAULT 0,                     -- vyšší vyhrává v rezoluci
  includes_tax BOOLEAN NOT NULL DEFAULT false,             -- true = stored gross, false = net
  is_active BOOLEAN NOT NULL DEFAULT true,
  fallback_price_list_id UUID NULL REFERENCES price_lists(id),
  notes TEXT NULL,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  version INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_price_lists_tenant_name UNIQUE (tenant_id, name),
  CONSTRAINT ck_window CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at),
  CONSTRAINT ck_audience_scope CHECK (
    -- price list má alespoň 1 scope dimenzi, nebo je default (kind=retail, no scope)
    (customer_group_id IS NOT NULL)::int +
    (company_id IS NOT NULL)::int +
    (channel_id IS NOT NULL)::int +
    (customer_id IS NOT NULL)::int <= 4
  )
);

CREATE INDEX idx_price_lists_tenant_kind ON price_lists (tenant_id, kind) WHERE deleted_at IS NULL AND is_active = true;
CREATE INDEX idx_price_lists_customer_group ON price_lists (customer_group_id) WHERE customer_group_id IS NOT NULL;
CREATE INDEX idx_price_lists_company ON price_lists (company_id) WHERE company_id IS NOT NULL;
CREATE INDEX idx_price_lists_channel ON price_lists (channel_id) WHERE channel_id IS NOT NULL;
CREATE INDEX idx_price_lists_active_window
  ON price_lists (tenant_id, priority DESC)
  WHERE is_active = true AND deleted_at IS NULL
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at > now());
```

**Seed při tenant onboarding:** automaticky `name='Retail'`, `kind='retail'`, `priority=0`, `currency=tenant.default_currency`, `is_active=true`. Je to fallback price list pro všechen anonymous traffic.

### 3.2 `prices` ([ENT-PRICE-001](03-data-models-master.md#ent-price-001))

```sql
CREATE TABLE prices (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  price_list_id UUID NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  amount BIGINT NOT NULL,                                  -- minor unit (centy/halíře)
  currency CHAR(3) NOT NULL,                                -- denormalized z price_list pro index speed
  compare_at_amount BIGINT NULL,                            -- "regular" cena pro strike-through
  cost_amount BIGINT NULL,                                  -- COGS reference (často hidden)
  min_quantity INTEGER NOT NULL DEFAULT 1 CHECK (min_quantity >= 1),
  max_quantity INTEGER NULL CHECK (max_quantity IS NULL OR max_quantity >= min_quantity),
  starts_at TIMESTAMPTZ NULL,                                -- sale window override price_list window
  ends_at TIMESTAMPTZ NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_prices_list_variant_qty_window
    UNIQUE (price_list_id, variant_id, min_quantity, starts_at),
  CONSTRAINT ck_amount_non_negative CHECK (amount >= 0),
  CONSTRAINT ck_compare_at_higher CHECK (compare_at_amount IS NULL OR compare_at_amount > amount),
  CONSTRAINT ck_window CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at),
  CONSTRAINT ck_currency_matches_list CHECK (currency = (SELECT currency FROM price_lists WHERE id = price_list_id))
    -- ^ může být relaxováno pokud chceme multi-currency v rámci 1 list; default striktně 1 currency per list
);

CREATE INDEX idx_prices_variant ON prices (variant_id) WHERE is_active = true;
CREATE INDEX idx_prices_list_variant ON prices (price_list_id, variant_id) WHERE is_active = true;
CREATE INDEX idx_prices_active_window
  ON prices (variant_id, price_list_id, min_quantity)
  WHERE is_active = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at > now());
```

**Tier pricing modelování:** rows s různými `min_quantity` pro stejný `(price_list_id, variant_id)`. Příklad:
```
qty 1+:  100 Kč
qty 10+:  90 Kč
qty 50+:  80 Kč
qty 100+: 70 Kč
```

Engine vybere row s nejvyšším `min_quantity` ≤ requested qty.

### 3.3 `discounts` ([ENT-DISCOUNT-001](03-data-models-master.md#ent-discount-001))

```sql
CREATE TABLE discounts (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('percentage','fixed','bogo','free_shipping','bundle','tiered','plugin')),
  value BIGINT NULL,                                      -- % × 100 (e.g., 1500 = 15.00%) nebo amount v minor unit
  currency CHAR(3) NULL,                                   -- pro 'fixed' a 'bundle'
  scope TEXT NOT NULL CHECK (scope IN ('cart','line_item','shipping','specific_products')) DEFAULT 'line_item',
  applies_to JSONB NULL,                                   -- filter expression (product_ids, category_ids, tags, ...)
  bogo_config JSONB NULL,                                  -- {"buy_qty":2,"get_qty":1,"get_discount_percent":100,"applies_to_cheaper":true}
  bundle_config JSONB NULL,                                -- {"required_variants":[{"id":"...","qty":1}],"discount_amount":...}
  tiered_config JSONB NULL,                                -- [{"min_subtotal":1000_00,"value":500},{"min_subtotal":2000_00,"value":1500}]
  min_purchase_amount BIGINT NULL,                          -- min cart subtotal pro aktivaci
  min_purchase_currency CHAR(3) NULL,
  min_quantity INTEGER NULL,                                -- min total items v cart
  max_discount_amount BIGINT NULL,                          -- cap pro percentage discounts
  max_uses_total INTEGER NULL,                              -- globální usage cap
  max_uses_per_customer INTEGER NULL,                       -- per-customer limit
  usage_count INTEGER NOT NULL DEFAULT 0,                   -- aktuální usage (atomic increment)
  requires_coupon BOOLEAN NOT NULL DEFAULT false,
  is_stackable BOOLEAN NOT NULL DEFAULT false,              -- lze kombinovat s jinými discounts
  not_combinable_with TEXT[] NOT NULL DEFAULT '{}',         -- array discount_ids, které vylučují tento
  customer_eligibility TEXT NOT NULL CHECK (customer_eligibility IN ('all','guests_only','logged_in_only','specific_groups','specific_customers','first_purchase_only')) DEFAULT 'all',
  eligible_customer_group_ids UUID[] NULL,
  eligible_customer_ids UUID[] NULL,
  priority INTEGER NOT NULL DEFAULT 0,                      -- vyšší vyhrává při konfliktu
  starts_at TIMESTAMPTZ NULL,
  ends_at TIMESTAMPTZ NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','active','paused','expired')) DEFAULT 'draft',
  channel_id UUID NULL REFERENCES channels(id),             -- channel-scoped
  plugin_handler TEXT NULL,                                  -- pro kind='plugin' — qualified handler name
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  version INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_discounts_tenant_name UNIQUE (tenant_id, name),
  CONSTRAINT ck_window CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at),
  CONSTRAINT ck_percentage_value CHECK (
    kind <> 'percentage' OR (value IS NOT NULL AND value > 0 AND value <= 10000)
  ),
  CONSTRAINT ck_fixed_currency CHECK (
    kind <> 'fixed' OR (value IS NOT NULL AND currency IS NOT NULL)
  )
);

CREATE INDEX idx_discounts_tenant_active
  ON discounts (tenant_id, priority DESC)
  WHERE status = 'active' AND deleted_at IS NULL
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at > now());

CREATE INDEX idx_discounts_requires_coupon ON discounts (tenant_id, requires_coupon) WHERE deleted_at IS NULL;
CREATE INDEX idx_discounts_applies_to_gin ON discounts USING GIN (applies_to);
```

### 3.4 `coupons` ([ENT-COUPON-001](03-data-models-master.md#ent-coupon-001))

```sql
CREATE TABLE coupons (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  discount_id UUID NOT NULL REFERENCES discounts(id) ON DELETE CASCADE,
  code CITEXT NOT NULL,                                    -- case-insensitive matching
  is_single_use_token BOOLEAN NOT NULL DEFAULT false,       -- unique per generated code
  customer_id UUID NULL REFERENCES customers(id),           -- targeted coupon
  usage_count INTEGER NOT NULL DEFAULT 0,
  max_uses INTEGER NULL,                                     -- per code cap (e.g., influencer code lim 100)
  notes TEXT NULL,
  expires_at TIMESTAMPTZ NULL,                                -- can override discount.ends_at
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_coupons_tenant_code UNIQUE (tenant_id, code)
);

CREATE INDEX idx_coupons_discount ON coupons (discount_id) WHERE is_active = true;
CREATE INDEX idx_coupons_customer ON coupons (customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_coupons_expires ON coupons (expires_at) WHERE expires_at IS NOT NULL;
```

### 3.5 `discount_usage` *(usage tracking)*

Append-only log usage instances — pro per-customer max_uses, fraud detection, analytics.

```sql
CREATE TABLE discount_usage (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  discount_id UUID NOT NULL REFERENCES discounts(id),
  coupon_id UUID NULL REFERENCES coupons(id),
  customer_id UUID NULL,                                    -- nullable pro guest
  cart_id UUID NULL,
  order_id UUID NULL,
  amount_saved BIGINT NOT NULL,
  amount_currency CHAR(3) NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_at TIMESTAMPTZ NULL,                              -- při cart abandon / order cancel
  release_reason TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_discount_usage_discount ON discount_usage (discount_id, applied_at DESC);
CREATE INDEX idx_discount_usage_customer ON discount_usage (customer_id, discount_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_discount_usage_order ON discount_usage (order_id) WHERE order_id IS NOT NULL;
```

### 3.6 `promotion_rules` ([ENT-PROMOTION-RULE-001](03-data-models-master.md#ent-promotion-rule-001))

V MVP jako stub (Shopware-inspired visual rule builder ve v1.0+). Schema:

```sql
CREATE TABLE promotion_rules (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT NULL,
  rule_dsl JSONB NOT NULL,                                  -- visual builder output (operators, conditions)
  action_dsl JSONB NOT NULL,                                -- what to do when matched (apply discount X, change shipping, ...)
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('draft','active','paused','archived')) DEFAULT 'draft',
  starts_at TIMESTAMPTZ NULL,
  ends_at TIMESTAMPTZ NULL,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_promotion_rules_tenant_name UNIQUE (tenant_id, name)
);
```

V MVP: rule_dsl je jednodušší JSONB v `discounts.applies_to` field. Plný rule builder od v1.0+.

### 3.7 `gift_cards` ([ENT-GIFT-CARD-001](03-data-models-master.md#ent-gift-card-001))

```sql
CREATE TABLE gift_cards (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  code_hash TEXT NOT NULL,                                  -- Argon2id hash; raw code never stored
  code_prefix TEXT NOT NULL,                                -- first 4 chars pro display "ABCD-...-XXXX"
  code_last4 TEXT NOT NULL,
  initial_amount BIGINT NOT NULL,
  balance BIGINT NOT NULL,
  currency CHAR(3) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','spent','expired','revoked','pending_activation')) DEFAULT 'active',
  issued_to_email CITEXT NULL,
  issued_to_customer_id UUID NULL REFERENCES customers(id),
  issued_by_order_id UUID NULL REFERENCES orders(id),       -- pokud zakoupen jako product
  notes TEXT NULL,
  expires_at TIMESTAMPTZ NULL,                                -- per CZ law max 1 year if anonymous; tenant configurable
  activated_at TIMESTAMPTZ NULL,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_gift_cards_code_hash UNIQUE (tenant_id, code_hash),
  CONSTRAINT ck_balance_non_negative CHECK (balance >= 0),
  CONSTRAINT ck_balance_le_initial CHECK (balance <= initial_amount)
);

CREATE INDEX idx_gift_cards_status ON gift_cards (tenant_id, status, expires_at);
CREATE INDEX idx_gift_cards_customer ON gift_cards (issued_to_customer_id) WHERE issued_to_customer_id IS NOT NULL;
```

### 3.8 `gift_card_transactions` *(ledger)*

Append-only ledger každého použití / nabití.

```sql
CREATE TABLE gift_card_transactions (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  gift_card_id UUID NOT NULL REFERENCES gift_cards(id),
  kind TEXT NOT NULL CHECK (kind IN ('issue','redeem','refund','topup','adjustment','expire','revoke')),
  amount BIGINT NOT NULL,                                   -- signed: +issue/+refund/+topup, -redeem/-expire/-revoke
  currency CHAR(3) NOT NULL,
  reference_type TEXT NULL,
  reference_id UUID NULL,
  resulting_balance BIGINT NOT NULL,
  notes TEXT NULL,
  actor_kind TEXT NOT NULL,
  actor_id UUID NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_gift_card_transactions_card ON gift_card_transactions (gift_card_id, occurred_at DESC);
```

### 3.9 `tier_prices` ([ENT-TIER-PRICE-001](03-data-models-master.md#ent-tier-price-001))

Modeled přes `prices.min_quantity > 1` v rámci konkrétního `price_list` (viz `03 §7`). Žádná separátní tabulka.

---

## 4. State machines

### 4.1 Discount lifecycle

```
[draft] ─── publish ──▶ [active]
                            │
                            ├─── pause ──▶ [paused]
                            │                  │
                            │                  └─── resume ──▶ [active]
                            │
                            ├─── reach ends_at ──▶ [expired]
                            │
                            └─── archive ──▶ [archived]
```

### 4.2 Coupon lifecycle

```
[created, is_active=true] ─── redeem ──▶ usage_count++ (if max_uses reached → is_active=false)
                              │
                              └─── revoke ──▶ [is_active=false]
                              │
                              └─── reach expires_at ──▶ [effectively inactive]
```

### 4.3 Gift card lifecycle

```
[pending_activation] ─── activate ──▶ [active] ──┬─ redeem (balance → 0) ──▶ [spent]
   (purchased,                                     │
    awaiting email)                                ├─ expire (expires_at)   ──▶ [expired]
                                                   │
                                                   └─ revoke (admin / fraud) ──▶ [revoked]
```

---

## 5. Business rules

### RULE-PRICING-001: Price list resolution priority

Pro pricing query `(tenant, variant, customer, channel, quantity, time)`:

1. **Filter eligible price lists** (active, in window, audience matches):
   - `tenant_id` match
   - `is_active=true`, `deleted_at IS NULL`
   - `(starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at > now())`
   - `customer_id` matches, NEBO `company_id` matches customer's company, NEBO `customer_group_id` matches customer's group, NEBO scope dimensions all NULL (default retail)
   - `channel_id` matches request channel, NEBO NULL (channel-agnostic)
2. **Order by priority DESC, kind precedence** (customer_specific > company > group > channel > promotional > b2b > retail), `created_at ASC` jako tie-breaker
3. **For each list in order:** check if `prices` row exists pro `variant_id` with `min_quantity <= requested_qty` and in window. Vrátí highest `min_quantity` matching row.
4. **First match wins.** Pokud no match, fallback do `price_list.fallback_price_list_id` (rekurzivně, max 3 levels).
5. **Final fallback:** default Retail price list (auto-created při onboarding).

### RULE-PRICING-002: Tier pricing volume break

Pro variant s tier prices `[1 → 100 Kč, 10 → 90 Kč, 50 → 80 Kč]` při requested qty=15:
- Engine vybere tier `min_quantity=10` (highest matching ≤ requested)
- Vrátí `90 Kč × 15 = 1350 Kč`

**Single-tier per line:** nesoučítáme tiery napříč (např. 9 ks za 100 + 6 ks za 90 — to ne). Celá quantity dostane jednu tier rate.

### RULE-PRICING-003: Compare-at-price displays

Jen pokud `compare_at_amount > amount` a oba ze stejného price list. Storefront render `<s>1990 Kč</s> 1490 Kč` (savings -25%). Search index má `has_discount`, `discount_percent_max` fields denormalized.

### RULE-PRICING-004: Tax inclusive vs exclusive

`price_lists.includes_tax` určuje, jestli `prices.amount` je net (without VAT) nebo gross (with VAT).
- **Storefront display per locale:** EU B2C konvence = gross display; B2B = net display. Detail v `15-tax-compliance.md`.
- **API output:** vrací oba `net_amount` a `gross_amount` + meta `display_mode`.
- **Tax-class-dependent:** convert mezi net/gross uses `tax_rates` per variant `tax_class_code` + shipping address.

### RULE-PRICING-005: Snapshot v cart a order

`cart_items.unit_price_amount` snapshotnuté **v okamžiku add to cart**. Při změně ceny v price_list, existing cart items zachovávají snapshot. Storefront ukáže warning pokud expired snapshot:
- `cart.last_priced_at` field
- Při checkout `validateCartPricing` re-runs pricing, porovná s snapshot; pokud drift > 0, ukáže "Some prices changed, review your cart" + auto-refresh

`order_items.unit_price_amount` snapshotnuté **při order placement**. Immutable. Subsequent price changes nepostihnou order.

### RULE-PRICING-006: Currency consistency v cart

Cart má `currency` field. Všechny items v cart musí být ve stejné měně. Pokud customer přepne currency (storefront tool), cart se re-prices přes exchange rates → nová cart entry. Detail v `11-cart.md`.

### RULE-PRICING-007: Discount stacking

Default: discounts NEjsou stackable. Pro stack:
- Oba discounts musí mít `is_stackable=true`
- Žádný z nich není v `not_combinable_with` druhého
- Application order: priority DESC

Pokud konflikt (dvě non-stackable discounts kandidátky pro stejnou cart): vybere s **highest customer benefit** (largest amount saved). Tie-breaker: priority DESC, created_at DESC.

### RULE-PRICING-008: Discount apply order

Pricing pipeline (viz §6) aplikuje discounts v daném pořadí:
1. **Line-item discounts** (scope=`line_item` nebo `specific_products`) — slevy konkrétních produktů
2. **Cart discounts** (scope=`cart`) — % nebo fixed sleva z subtotálu
3. **Shipping discounts** (scope=`shipping`) — free shipping, % off shipping

Tax applied **po všech discounts** (viz `15-tax-compliance.md` pro EU pravidla — VAT je z final taxable amount).

### RULE-PRICING-009: BOGO mechanics

BOGO config: `{"buy_qty":2,"get_qty":1,"get_discount_percent":100,"applies_to_cheaper":true}` = "kup 2, 1 zdarma".

Algoritmus:
1. Find cart items matching `discounts.applies_to` filter
2. Sort by unit_price ASC (`applies_to_cheaper=true`) nebo DESC
3. Compute eligible sets: `eligible_count = floor(total_qty / (buy_qty + get_qty))`
4. Apply discount na `get_qty * eligible_count` items, starting from cheapest/most-expensive

### RULE-PRICING-010: Coupon redemption atomic

Při apply coupon:
1. Acquire advisory lock by `hash(tenant, coupon_code)`
2. Validate:
   - Coupon exists, is_active, not expired
   - Discount active, in window, status='active'
   - max_uses not reached (`coupon.usage_count < coupon.max_uses`)
   - max_uses_per_customer not exceeded (count from discount_usage)
   - customer_id matches if targeted
   - min_purchase_amount met
3. Create `discount_usage` row (kind=apply)
4. Increment `coupons.usage_count` and `discounts.usage_count`
5. Update cart totals
6. Emit `EVENT-DISCOUNT-APPLIED`

Při cart abandon nebo discount remove: release usage (mark `discount_usage.released_at`, decrement counts).

### RULE-PRICING-011: Coupon code generation

Generated codes: `[A-Z0-9]{8-16}`, no ambiguous chars (`0`, `O`, `I`, `1`, `L`). Generated via crypto random.

Bulk generation (e.g., influencer codes, single-use tokens): bulk API endpoint, max 10000 per request, async job.

### RULE-PRICING-012: Customer eligibility check

- `guests_only`: customer_id IS NULL v cart
- `logged_in_only`: customer_id IS NOT NULL
- `specific_groups`: customer's customer_group_id IN discount.eligible_customer_group_ids
- `specific_customers`: customer_id IN discount.eligible_customer_ids
- `first_purchase_only`: customer has 0 prior orders (count from orders WHERE customer_id=X)
- `all`: vždy

Check happens při each `applyDiscountToCart` call. Failure → 422 with `INELIGIBLE`.

### RULE-PRICING-013: Free shipping discount

`kind='free_shipping'` aplikuje 100% slevu na shipping line item. Optional `applies_to.shipping_methods_ids` zúží rozsah.

Při tier-shipping (per weight/price), discount zruší entire shipping cost.

### RULE-PRICING-014: Gift card application

Gift card je **payment method**, ne discount. Aplikuje se v checkout payment step:
- `payments` row s `provider_code='gift_card'`, `amount = min(cart.total, gift_card.balance)`
- `gift_card_transactions` row reason='redeem'
- Decrement gift_card.balance
- Remaining cart total goes to other payment method

Z pohledu pricing: total se nezmění, jen split mezi gift_card + ostatní. Discount na items neuplatňujeme.

### RULE-PRICING-015: Multi-coupon stacking

Max počet currently applied coupons per cart: configurable per tenant, default 3. Vynucené v `applyCoupon` endpointu.

### RULE-PRICING-016: Per-line discount cap

`max_discount_amount` cap aplikovaný per cart, ne per line. Pokud percentage discount × subtotal > cap, použije cap.

Příklad: `kind='percentage', value=5000 (50%), max_discount_amount=200_00 (200 Kč)`. Cart subtotal 1000 Kč → percentage = 500 Kč; cap = 200 Kč; applied = 200 Kč.

### RULE-PRICING-017: Negative line total prohibited

Discount aplikace nesmí způsobit `line_total < 0`. Pokud applikace překročí line price, cap na 0.

Vzácný case: kombinace 100% percentage + fixed discount na stejnou line.

### RULE-PRICING-018: Idempotent re-calculation

Pricing engine je **pure function** — žádné side effects během calc. Stejný input always produces stejný output. Atomic state change (incremening usage counts) happens **after** successful calc, mimo engine.

### RULE-PRICING-019: Channel-scoped pricing

Channel-specific price list (např. "Heuréka feed prices" `channel_id=ch_heureka, kind='channel'`) má prioritu nad retail pro requests s `channel_id=ch_heureka`.

### RULE-PRICING-020: Cost field protection

`prices.cost_amount` (COGS reference) je sensitive — visible jen s `PERM-PRICING-VIEW-COST`. Storefront ho nikdy nevrací.

### RULE-PRICING-021: Promotional price priority over base price

Multiple price lists matching, including `kind='promotional'` time-bound. Promotional **vždy** vyhrává nad retail/b2b if active a customer-eligible. (Implicit via `priority` field convention — promotional listy mají vyšší priority numerically.)

Merchant může opt-out: nastavit promotional priority=0 stejně jako retail; pak normální priority resolution.

### RULE-PRICING-022: Price events propagation

Změny `prices` triggerují:
- `EVENT-PRICE-CHANGED` → search indexer patch (debounced 30s)
- `EVENT-PRICE-LIST-UPDATED` (parent list metadata) → cache invalidation
- Carts touching ovlivněný variant: NO auto-recalc, ale `cart.last_priced_at` becomes stale → checkout will warn

### RULE-PRICING-023: Tax-aware price list mixing

Cart může mít items z různých price lists. Engine **musí** ověřit consistency includes_tax flag (mixing net + gross within cart confusing). Pokud mixed: warn, force konverze do tenant default convention.

### RULE-PRICING-024: Gift card never discount stackable

Gift cards aplikované jako payment NEvylučují discounts. Customer může mít coupon + gift card simultaneously.

### RULE-PRICING-025: Manual discount override (CS)

Customer service může applyovat custom discount na konkrétní order (post-placement order edit, ne při checkout). Vyžaduje `PERM-PROMOTION-APPLY-MANUAL`. Vytvoří `discounts` row s `kind='fixed'`, `status='active'`, scope=`cart`, applies_to filter na order_id only, `max_uses_total=1` — used immediately.

Audit log: actor, original price, override amount, reason free-text.

---

## 6. Pricing calculation pipeline

Stěžejní sekce. **Deterministic pure function** vstup → output.

### 6.1 Pipeline stages

```
INPUT:
  - cart (items: [{variant_id, quantity, customization?}, ...])
  - customer_context (customer_id, customer_group_id, company_id, channel_id)
  - currency (target currency for display)
  - coupon_codes[]                   (user-applied)
  - timestamp (default now())

PIPELINE:

  Stage 1: BASE PRICING per line
    For each cart item:
      a. Resolve eligible price_lists (RULE-PRICING-001)
      b. For top list, find matching price row by min_quantity (RULE-PRICING-002)
      c. Compute line.unit_price = price.amount
      d. Compute line.compare_at_price = price.compare_at_amount (optional)
      e. Compute line.subtotal_before_discount = unit_price × quantity

  Stage 2: LINE-ITEM DISCOUNTS
    For each active line-item-scoped discount in priority DESC order:
      a. Check eligibility (customer, channel, min_purchase, applies_to filter, stacking rules)
      b. If matches: compute amount_saved per line
      c. Update line.discount_amount += amount_saved
      d. Mark discount as applied
      e. Skip non-stackable conflicts

  Stage 3: CART-LEVEL DISCOUNTS
    Compute cart.subtotal = sum(line.subtotal_before_discount - line.discount_amount)
    For each active cart-scoped discount (priority DESC):
      a. Check eligibility (incl. min_purchase met by current subtotal)
      b. Compute cart.discount_amount += amount
      c. Cap at max_discount_amount
      d. Distribute proportionally to lines (for tax calc later)

  Stage 4: SHIPPING (resolved later by 14, pricing engine just passes through)
    cart.shipping_subtotal = shipping_service.calculate(...)
    For shipping-scoped discounts:
      cart.shipping_discount_amount += amount

  Stage 5: COUPON VALIDATION
    For each user-provided coupon_code:
      a. Lookup coupons + discount
      b. Validate eligibility (RULE-PRICING-010, -012)
      c. Apply as line-item or cart discount per discount.scope
      d. Add to applied_coupons[]

  Stage 6: TAX CALCULATION (delegated to 15)
    tax_engine.calculate(cart, customer.shipping_address):
      Per line: line.tax_amount = compute_vat(line.subtotal - line.discount_amount, tax_class, country)
      Cart total tax = sum + shipping tax

  Stage 7: FINAL TOTALS
    cart.subtotal_amount = sum(line.subtotal - line.discount)
    cart.discount_amount = sum(line.discount) + cart.discount  // (no double count of line.discount)
    cart.tax_amount = sum(line.tax) + cart.shipping_tax
    cart.shipping_amount = cart.shipping_subtotal - cart.shipping_discount_amount
    cart.total_amount = cart.subtotal_amount + cart.tax_amount + cart.shipping_amount
                       (when stored net) OR
                     = cart.subtotal_amount + cart.shipping_amount
                       (when stored gross, tax included)

OUTPUT:
  PricedCart {
    currency,
    lines: [{
      variant_id, quantity,
      unit_price_amount, unit_price_currency,
      compare_at_price_amount?,
      subtotal_before_discount,
      discount_amount, discount_breakdown: [{discount_id, amount, kind}],
      tax_amount, tax_rate_basis_points,
      total_amount
    }],
    subtotal_amount,
    discount_amount,
    discount_breakdown: [{discount_id, amount, kind, applied_to: 'line'|'cart'|'shipping'}],
    tax_amount,
    tax_breakdown: [{tax_class, country, rate_basis_points, base_amount, tax_amount}],
    shipping_amount,
    shipping_discount_amount,
    total_amount,
    applied_coupons: [{code, discount_id}],
    skipped_discounts: [{discount_id, reason}],
    warnings: ["mixed_tax_modes", ...]
  }
```

### 6.2 Pseudocode

```typescript
function priceCart(input: PricingInput): PricedCart {
  const context = resolveContext(input);  // customer_group, company, channel
  
  // Stage 1: base pricing per line
  const lines = input.cart.items.map(item => {
    const priceListChain = resolvePriceLists(context, item, input.timestamp);
    const priceRow = findMatchingPrice(priceListChain, item.variant_id, item.quantity, input.timestamp);
    return {
      ...item,
      unit_price_amount: priceRow.amount,
      unit_price_currency: priceRow.currency,
      compare_at_price_amount: priceRow.compare_at_amount,
      subtotal_before_discount: priceRow.amount * item.quantity,
      price_list_id: priceRow.price_list_id,
    };
  });
  
  // Stage 2: line-item discounts
  const lineDiscountCandidates = loadActiveDiscounts(context, scope=['line_item','specific_products']);
  for (const discount of sortByPriority(lineDiscountCandidates)) {
    if (!checkEligibility(discount, context, lines)) continue;
    if (conflictsWithApplied(discount, appliedDiscounts)) continue;
    applyLineDiscount(discount, lines, appliedDiscounts);
  }
  
  // Stage 3: cart discounts
  const cartSubtotal = sumLineSubtotalsAfterDiscount(lines);
  const cartDiscountCandidates = loadActiveDiscounts(context, scope=['cart']);
  let cartDiscount = 0;
  for (const discount of sortByPriority(cartDiscountCandidates)) {
    if (!checkEligibility(discount, context, lines, cartSubtotal)) continue;
    if (conflictsWithApplied(discount, appliedDiscounts)) continue;
    cartDiscount += applyCartDiscount(discount, lines, cartSubtotal, appliedDiscounts);
  }
  
  // Stage 4: shipping (delegated)
  const shipping = shippingService.calculate(input.cart, context);
  let shippingDiscount = 0;
  const shippingDiscountCandidates = loadActiveDiscounts(context, scope=['shipping']);
  for (const discount of shippingDiscountCandidates) {
    if (!checkEligibility(discount, context, lines)) continue;
    shippingDiscount += applyShippingDiscount(discount, shipping, appliedDiscounts);
  }
  
  // Stage 5: coupons
  const couponDiscounts = applyCoupons(input.coupon_codes, context, lines, cartSubtotal, appliedDiscounts);
  
  // Stage 6: tax (delegated to tax-engine, RULE-PRICING-004)
  const taxResult = taxEngine.calculate({ lines, shipping_amount: shipping - shippingDiscount, customer: context });
  
  // Stage 7: totals
  return assembleResult(lines, cartDiscount, taxResult, shipping, shippingDiscount, appliedDiscounts);
}
```

### 6.3 Deterministicity guarantees

- Pricing engine **nepoužívá** `now()` interně — vstup explicit `timestamp`
- **Nezpůsobuje** žádné side effects: žádný INSERT, UPDATE, žádný emit event
- **Nezvyšuje** discount_usage / coupons.usage_count — to dělá separátní `commitDiscountUsage()` po úspěšné checkout placement
- Round/snap je deterministický (banker's rounding na minor unit)
- Iterace přes Set vs Array: enforce deterministic ordering (sort by id)

### 6.4 Rounding

- Vše v minor unit integer (BIGINT v Postgres) — žádné float
- Discount `kind='percentage'` × subtotal: `Math.floor((subtotal * basis_points) / 10000)` (rounds down — favours merchant; alternative banker's rounding configurable per tenant)
- Tax computation: per-line rounding (avoid Penny mismatch when sum vs individual)
- Currency display: locale-aware (cs-CZ: `1 490,00 Kč`; en-US: `$14.90`)

---

## 7. REST API endpoints

### 7.1 Price lists

```
GET    /api/{date}/price-lists
POST   /api/{date}/price-lists
GET    /api/{date}/price-lists/{id}
PATCH  /api/{date}/price-lists/{id}
DELETE /api/{date}/price-lists/{id}            # soft delete, blocked if has active prices
POST   /api/{date}/price-lists/{id}:activate
POST   /api/{date}/price-lists/{id}:deactivate
POST   /api/{date}/price-lists/{id}:duplicate
```

### 7.2 Prices

```
GET    /api/{date}/prices                       # list, filterable by price_list_id, variant_id
POST   /api/{date}/prices                       # set price
GET    /api/{date}/prices/{id}
PATCH  /api/{date}/prices/{id}
DELETE /api/{date}/prices/{id}
POST   /api/{date}/prices:bulk                   # bulk create/update (CSV-like via API)
POST   /api/{date}/prices:import-csv             # async
POST   /api/{date}/prices:export-csv
POST   /api/{date}/price-lists/{id}/prices:copy-from   # copy prices from another list with markup/markdown
```

### 7.3 Discounts

```
GET    /api/{date}/discounts
POST   /api/{date}/discounts
GET    /api/{date}/discounts/{id}
PATCH  /api/{date}/discounts/{id}
DELETE /api/{date}/discounts/{id}
POST   /api/{date}/discounts/{id}:activate
POST   /api/{date}/discounts/{id}:pause
POST   /api/{date}/discounts/{id}:resume
POST   /api/{date}/discounts/{id}:archive
POST   /api/{date}/discounts/{id}:preview         # dry-run: simulate apply on sample cart
GET    /api/{date}/discounts/{id}/usage          # usage report
```

### 7.4 Coupons

```
GET    /api/{date}/discounts/{discount_id}/coupons
POST   /api/{date}/discounts/{discount_id}/coupons             # create single
POST   /api/{date}/discounts/{discount_id}/coupons:bulk-generate   # generate N codes async
GET    /api/{date}/coupons/{id}
PATCH  /api/{date}/coupons/{id}
DELETE /api/{date}/coupons/{id}                                # revoke
POST   /api/{date}/coupons:validate                            # check code, returns discount + eligibility
```

### 7.5 Gift cards

```
GET    /api/{date}/gift-cards
POST   /api/{date}/gift-cards                                  # admin issue
POST   /api/{date}/gift-cards:bulk-issue                       # async, returns operation
GET    /api/{date}/gift-cards/{id}                             # detail (no raw code)
GET    /api/{date}/gift-cards/{id}/transactions
POST   /api/{date}/gift-cards/{id}:revoke
POST   /api/{date}/gift-cards/{id}:topup
POST   /api/{date}/gift-cards:check-balance                    # validate code → masked balance
POST   /api/{date}/gift-cards:apply-to-cart                    # storefront use
```

### 7.6 Pricing engine

```
POST   /api/{date}/pricing:calculate            # dry-run pricing: input = cart + context, output = PricedCart
POST   /api/{date}/pricing:simulate-discount     # check what a discount would do to a sample cart
GET    /api/{date}/pricing/variants/{variant_id}/price    # storefront: get effective price for current context
```

### 7.7 Storefront

```
GET    /api/{date}/storefront/products/{slug}/price          # locale + currency aware
POST   /api/{date}/storefront/cart/apply-coupon
DELETE /api/{date}/storefront/cart/coupons/{code}
POST   /api/{date}/storefront/cart/apply-gift-card
DELETE /api/{date}/storefront/cart/gift-cards/{id}
```

### 7.8 Example: Calculate pricing

```http
POST /api/2026-05-19/pricing:calculate HTTP/1.1

{
  "cart": {
    "currency": "CZK",
    "items": [
      { "variant_id": "var_aB", "quantity": 3 },
      { "variant_id": "var_xY", "quantity": 1 }
    ]
  },
  "customer_context": {
    "customer_id": "cus_aB",
    "customer_group_id": "grp_vip",
    "channel_id": "ch_web"
  },
  "coupon_codes": ["SUMMER10"]
}
```

```jsonc
HTTP/1.1 200 OK

{
  "data": {
    "currency": "CZK",
    "lines": [
      {
        "variant_id": "var_aB",
        "quantity": 3,
        "unit_price": { "amount": 49000, "currency": "CZK" },
        "compare_at_price": { "amount": 59000, "currency": "CZK" },
        "price_list_id": "prc_vip",
        "subtotal_before_discount": 147000,
        "discount_amount": 14700,
        "discount_breakdown": [
          { "discount_id": "dsc_summer10", "amount": 14700, "kind": "percentage", "coupon_code": "SUMMER10" }
        ],
        "tax_amount": 27783,
        "tax_rate_basis_points": 2100,
        "total_amount": 160083
      },
      ...
    ],
    "subtotal_amount": 132300,
    "discount_amount": 14700,
    "discount_breakdown": [
      { "discount_id": "dsc_summer10", "amount": 14700, "kind": "percentage", "applied_to": "line_item", "coupon_code": "SUMMER10" }
    ],
    "tax_amount": 27783,
    "tax_breakdown": [
      { "tax_class": "standard", "country": "CZ", "rate_basis_points": 2100, "base_amount": 132300, "tax_amount": 27783 }
    ],
    "shipping_amount": 9900,
    "shipping_discount_amount": 0,
    "total_amount": 169983,
    "applied_coupons": [{ "code": "SUMMER10", "discount_id": "dsc_summer10" }],
    "skipped_discounts": [],
    "warnings": []
  },
  "meta": {
    "engine_version": "1.0",
    "calculated_at": "2026-05-19T14:30:00Z",
    "duration_ms": 18,
    "request_id": "req_..."
  }
}
```

### 7.9 Example: Apply coupon

```http
POST /api/2026-05-19/storefront/cart/apply-coupon HTTP/1.1
Authorization: Bearer ...

{
  "cart_id": "crt_aB",
  "code": "SUMMER10"
}
```

Success:
```http
HTTP/1.1 200 OK

{
  "data": {
    "cart": { ... updated PricedCart ... },
    "applied_coupon": {
      "code": "SUMMER10",
      "discount_id": "dsc_summer10",
      "amount_saved": 14700,
      "amount_currency": "CZK"
    }
  }
}
```

Failure (expired):
```http
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/problem+json

{
  "type": "https://docs.shopio.com/errors/coupon-expired",
  "code": "COUPON_EXPIRED",
  "title": "This coupon has expired",
  "detail": "Code SUMMER10 expired on 2026-04-30T23:59:59Z.",
  "status": 422
}
```

### 7.10 Example: Bulk coupon generation

```http
POST /api/2026-05-19/discounts/dsc_summer10/coupons:bulk-generate HTTP/1.1

{
  "count": 5000,
  "code_pattern": "SUMMER-{8}",        // SUMMER- prefix + 8 random alphanumeric
  "single_use_token": true,
  "max_uses": 1,
  "expires_at": "2026-08-31T23:59:59Z"
}
```

```http
HTTP/1.1 202 Accepted
Location: /api/2026-05-19/operations/op_aB

{
  "data": {
    "id": "op_aB",
    "status": "queued",
    "kind": "coupon.bulk_generate",
    "expected_output_url": "https://storage.shopio.com/exports/coupons-{job_id}.csv?sig=..."
  }
}
```

---

## 8. GraphQL schema

```graphql
type Money {
  amount: Int!                          # minor unit (bigint serialized as Int for amounts < 2^53)
  currency: String!
}

type PriceList implements Node {
  id: ID!
  name: String!
  kind: PriceListKind!
  currency: String!
  customerGroup: CustomerGroup
  company: Company
  channel: Channel
  startsAt: DateTime
  endsAt: DateTime
  priority: Int!
  includesTax: Boolean!
  isActive: Boolean!
  fallbackPriceList: PriceList
}
enum PriceListKind { RETAIL B2B PROMOTIONAL CHANNEL CUSTOMER_SPECIFIC AGENT }

type Price implements Node {
  id: ID!
  priceList: PriceList!
  variant: ProductVariant!
  amount: Money!
  compareAtAmount: Money
  costAmount: Money                     # gated by PERM-PRICING-VIEW-COST
  minQuantity: Int!
  maxQuantity: Int
  startsAt: DateTime
  endsAt: DateTime
  isActive: Boolean!
}

type Discount implements Node {
  id: ID!
  name: String!
  description: String
  kind: DiscountKind!
  value: Int                            # % * 100 or amount
  currency: String
  scope: DiscountScope!
  appliesTo: JSON
  bogoConfig: JSON
  bundleConfig: JSON
  minPurchaseAmount: Money
  minQuantity: Int
  maxDiscountAmount: Money
  maxUsesTotal: Int
  maxUsesPerCustomer: Int
  usageCount: Int!
  requiresCoupon: Boolean!
  isStackable: Boolean!
  customerEligibility: DiscountCustomerEligibility!
  priority: Int!
  startsAt: DateTime
  endsAt: DateTime
  status: DiscountStatus!
}

enum DiscountKind { PERCENTAGE FIXED BOGO FREE_SHIPPING BUNDLE TIERED PLUGIN }
enum DiscountScope { CART LINE_ITEM SHIPPING SPECIFIC_PRODUCTS }
enum DiscountStatus { DRAFT ACTIVE PAUSED EXPIRED ARCHIVED }
enum DiscountCustomerEligibility {
  ALL
  GUESTS_ONLY
  LOGGED_IN_ONLY
  SPECIFIC_GROUPS
  SPECIFIC_CUSTOMERS
  FIRST_PURCHASE_ONLY
}

type Coupon implements Node {
  id: ID!
  discount: Discount!
  code: String!
  isSingleUseToken: Boolean!
  customer: Customer
  usageCount: Int!
  maxUses: Int
  expiresAt: DateTime
  isActive: Boolean!
}

type GiftCard implements Node {
  id: ID!
  codePrefix: String!                   # masked
  codeLast4: String!
  initialAmount: Money!
  balance: Money!
  status: GiftCardStatus!
  expiresAt: DateTime
  issuedToCustomer: Customer
  issuedAt: DateTime!
}
enum GiftCardStatus { ACTIVE SPENT EXPIRED REVOKED PENDING_ACTIVATION }

type PricedCart {
  currency: String!
  lines: [PricedCartLine!]!
  subtotalAmount: Money!
  discountAmount: Money!
  discountBreakdown: [DiscountApplication!]!
  taxAmount: Money!
  taxBreakdown: [TaxBreakdownItem!]!
  shippingAmount: Money!
  shippingDiscountAmount: Money!
  totalAmount: Money!
  appliedCoupons: [AppliedCoupon!]!
  skippedDiscounts: [SkippedDiscount!]!
  warnings: [String!]!
}

type PricedCartLine {
  variantId: ID!
  quantity: Int!
  unitPrice: Money!
  compareAtPrice: Money
  priceListId: ID!
  subtotalBeforeDiscount: Money!
  discountAmount: Money!
  discountBreakdown: [DiscountApplication!]!
  taxAmount: Money!
  taxRateBasisPoints: Int!
  totalAmount: Money!
}

type DiscountApplication {
  discountId: ID!
  amount: Money!
  kind: DiscountKind!
  appliedTo: DiscountAppliedScope!
  couponCode: String
}
enum DiscountAppliedScope { LINE CART SHIPPING }

type AppliedCoupon { code: String!  discountId: ID! }
type SkippedDiscount { discountId: ID!  reason: String! }

type TaxBreakdownItem {
  taxClass: String!
  country: String!
  rateBasisPoints: Int!
  baseAmount: Money!
  taxAmount: Money!
}

extend type Query {
  priceLists(first: Int, after: String, filter: PriceListFilter): PriceListConnection!
  priceList(id: ID): PriceList
  discounts(first: Int, after: String, filter: DiscountFilter): DiscountConnection!
  discount(id: ID): Discount
  validateCoupon(code: String!, cartId: ID): CouponValidationResult!
  giftCards(first: Int, after: String): GiftCardConnection! @auth(requires: PERM_GIFT_CARD_MANAGE)
  giftCardBalance(code: String!): GiftCardBalanceResult!
  calculatePricing(input: PricingInput!): PricedCart!
}

type CouponValidationResult {
  isValid: Boolean!
  coupon: Coupon
  discount: Discount
  estimatedAmountSaved: Money
  ineligibleReason: String
}

type GiftCardBalanceResult {
  balance: Money
  status: GiftCardStatus
  expiresAt: DateTime
  isValid: Boolean!
  errorReason: String
}

input PricingInput {
  cart: CartInputForPricing!
  customerContext: CustomerContextInput
  couponCodes: [String!]
  timestamp: DateTime
}

extend type Mutation {
  createPriceList(input: PriceListInput!): PriceList! @auth(requires: PERM_PRICING_MANAGE)
  updatePriceList(id: ID!, input: PriceListUpdateInput!): PriceList! @auth(requires: PERM_PRICING_MANAGE)
  setPrice(input: PriceInput!): Price! @auth(requires: PERM_PRICING_MANAGE)
  setPriceBulk(prices: [PriceInput!]!): [Price!]! @auth(requires: PERM_PRICING_MANAGE)

  createDiscount(input: DiscountInput!): Discount! @auth(requires: PERM_PROMOTION_MANAGE)
  updateDiscount(id: ID!, input: DiscountUpdateInput!): Discount! @auth(requires: PERM_PROMOTION_MANAGE)
  activateDiscount(id: ID!): Discount! @auth(requires: PERM_PROMOTION_MANAGE)
  pauseDiscount(id: ID!): Discount! @auth(requires: PERM_PROMOTION_MANAGE)

  createCoupon(discountId: ID!, input: CouponInput!): Coupon! @auth(requires: PERM_COUPON_MANAGE)
  bulkGenerateCoupons(discountId: ID!, input: BulkGenerateCouponInput!): Operation! @auth(requires: PERM_COUPON_MANAGE)
  revokeCoupon(id: ID!): Coupon! @auth(requires: PERM_COUPON_MANAGE)

  applyCouponToCart(cartId: ID!, code: String!): PricedCart!
  removeCouponFromCart(cartId: ID!, code: String!): PricedCart!

  issueGiftCard(input: GiftCardIssueInput!): GiftCard! @auth(requires: PERM_GIFT_CARD_MANAGE)
  topupGiftCard(id: ID!, amount: MoneyInput!): GiftCard! @auth(requires: PERM_GIFT_CARD_MANAGE)
  revokeGiftCard(id: ID!): GiftCard! @auth(requires: PERM_GIFT_CARD_MANAGE)
  applyGiftCardToCart(cartId: ID!, code: String!): PricedCart!
}
```

---

## 9. Events

| Build-spec ID | Wire | Payload |
|---|---|---|
| `EVENT-PRICE-LIST-CREATED` | `price_list.created` | `{ price_list }` |
| `EVENT-PRICE-LIST-UPDATED` | `price_list.updated` | `{ price_list, previous_attributes }` |
| `EVENT-PRICE-LIST-DEACTIVATED` | `price_list.deactivated` | `{ price_list_id }` |
| `EVENT-PRICE-CHANGED` | `price.changed` | `{ price_list_id, variant_id, amount, currency, previous_amount }` |
| `EVENT-PRICE-BULK-IMPORTED` | `price.bulk_imported` | `{ price_list_id, success_count, failure_count }` |
| `EVENT-DISCOUNT-CREATED` | `discount.created` | `{ discount }` |
| `EVENT-DISCOUNT-UPDATED` | `discount.updated` | `{ discount, previous_attributes }` |
| `EVENT-DISCOUNT-ACTIVATED` | `discount.activated` | `{ discount }` |
| `EVENT-DISCOUNT-EXPIRED` | `discount.expired` | `{ discount }` |
| `EVENT-DISCOUNT-APPLIED` | `discount.applied` | `{ discount_id, cart_id?, order_id?, amount_saved, customer_id? }` |
| `EVENT-DISCOUNT-RELEASED` | `discount.released` | `{ usage_id, reason }` |
| `EVENT-COUPON-CREATED` | `coupon.created` | `{ coupon }` |
| `EVENT-COUPON-REVOKED` | `coupon.revoked` | `{ coupon }` |
| `EVENT-COUPON-REDEEMED` | `coupon.redeemed` | `{ coupon, customer_id?, amount_saved }` |
| `EVENT-COUPON-USAGE-CAP-REACHED` | `coupon.usage_cap_reached` | `{ coupon_id }` |
| `EVENT-GIFT-CARD-ISSUED` | `gift_card.issued` | `{ gift_card }` |
| `EVENT-GIFT-CARD-REDEEMED` | `gift_card.redeemed` | `{ gift_card_id, amount, order_id }` |
| `EVENT-GIFT-CARD-EXPIRED` | `gift_card.expired` | `{ gift_card_id }` |
| `EVENT-GIFT-CARD-REVOKED` | `gift_card.revoked` | `{ gift_card_id, reason }` |
| `EVENT-PRICING-WARNING` | `pricing.warning` | `{ tenant_id, warning_code, context }` |

**Konzumenti:**
- Search indexer (`08`) — patch `price_min`, `price_max`, `has_discount`, `discount_percent_max` na `EVENT-PRICE-CHANGED`, `EVENT-DISCOUNT-ACTIVATED/EXPIRED`
- Cache invalidator — purge product+variant cache keys
- Email service — discount-related triggers (welcome coupon at signup, "you saved $X" post-purchase)
- ERP/Accounting integrations — gift card transactions
- Webhook delivery — per merchant subscription

---

## 10. Background jobs

| Job | Trigger | Queue | Frequency |
|---|---|---|---|
| `JOB-EXPIRE-DISCOUNTS` | scheduled | `pricing` | Every 5 min |
| `JOB-EXPIRE-COUPONS` | scheduled | `pricing` | Every 5 min |
| `JOB-EXPIRE-GIFT-CARDS` | scheduled | `pricing` | Daily 02:00 |
| `JOB-BULK-GENERATE-COUPONS` | manual API call | `imports` | On-demand |
| `JOB-IMPORT-PRICES-CSV` | manual API call | `imports` | On-demand |
| `JOB-EXPORT-PRICES-CSV` | manual API call | `exports` | On-demand |
| `JOB-COPY-PRICES-WITH-MARKUP` | manual API call | `pricing` | On-demand |
| `JOB-RECONCILE-COUPON-USAGE` | scheduled | `integrity-checks` | Daily 04:00 |
| `JOB-INDEX-PATCH-PRICE` | EVENT-PRICE-CHANGED (debounced 30s) | `search-index` | On-demand |
| `JOB-NOTIFY-DISCOUNT-LAUNCH` | EVENT-DISCOUNT-ACTIVATED (if starts_at near now) | `notifications` | On-demand |
| `JOB-ANALYZE-DISCOUNT-PERFORMANCE` | scheduled | `analytics` | Daily |
| `JOB-DETECT-COUPON-ABUSE` | scheduled | `fraud-detection` | Hourly |
| `CRON-PUBLISH-SCHEDULED-DISCOUNTS` | scheduled | `scheduler` | Every 5 min |
| `CRON-DEACTIVATE-EXPIRED-PRICE-LISTS` | scheduled | `scheduler` | Every 5 min |

---

## 11. UI/UX flows

### FLOW-PRICING-001: Create price list (admin)

```
[Pricing → Price lists → New]
        │
        ▼
[Form]
   - Name, kind (retail/b2b/promotional/...)
   - Currency
   - Audience scope: customer group / company / channel / customer (any combination)
   - Time window (optional)
   - Priority
   - Includes tax (net/gross)
   - Fallback price list (optional)
        │
        ▼
[Save Draft → status=draft]
        │
        ▼
[Prices tab — bulk add variants + amounts]
   - Search variants, set amount per row
   - Or import CSV
   - Or "Copy from {other price list}" with markup % / markdown %
        │
        ▼
[Activate → status=active]
   - All carts/searches honor new prices immediately
```

### FLOW-PRICING-002: Discount builder

```
[Promotions → Discounts → New]
        │
        ▼
[Wizard]
   Step 1: Type (Percentage / Fixed / BOGO / Free shipping / Bundle / Tiered)
   Step 2: Value + caps (max_discount_amount)
   Step 3: Applies to (all products / specific products / categories / collections / tags)
   Step 4: Eligibility (all / logged-in only / specific groups / first purchase)
   Step 5: Constraints (min purchase, max uses, per-customer limit)
   Step 6: Stacking rules
   Step 7: Schedule (starts_at, ends_at)
   Step 8: Coupon (none / single code / bulk-generated)
   Step 9: Preview on sample cart + go-live checklist
        │
        ▼
[Save → status=draft]
[Activate when ready]
```

### FLOW-PRICING-003: Storefront cart with coupon

```
[Storefront cart page]
   - Item list with line prices + line discounts (strikethrough)
   - Subtotal, discounts breakdown, tax, shipping, total
        │
   user enters "SUMMER10" in coupon box, click Apply
        │
        ▼
[POST /storefront/cart/apply-coupon]
   - on success: total updates, "−147 Kč" badge
   - on fail: friendly error message ("This code has expired" / "Doesn't apply to your cart")
```

### FLOW-PRICING-004: Customer service manual override

```
[Order detail → "Apply manual discount"]
   - Reason input (required)
   - Amount fixed or percentage
   - Limit to specific line or whole order
        │
        ▼
[Confirmation modal]
   - "This will reduce order total by 250 Kč"
        │
        ▼
[Apply → audit log + EVENT-DISCOUNT-APPLIED]
   - Order total updated
   - Customer notified (configurable)
```

### FLOW-PRICING-005: Gift card purchase (customer)

```
[Storefront product: "E-Gift Card"]
   - Pick amount (preset 500/1000/2000 Kč or custom)
   - Recipient email + name + personal message
   - Send date (now or scheduled)
        │
   add to cart, checkout normally
        │
        ▼
[Order placed]
   - JOB-GIFT-CARD-ACTIVATE creates gift_cards row (status=active)
   - Email sent to recipient with code + message
   - Original purchaser sees confirmation
```

### FLOW-PRICING-006: Bulk coupon generation

```
[Discount detail → Coupons tab → "Generate codes"]
   - Count: 5000
   - Pattern: "INFLU-{8}"
   - Single-use token: yes
   - Max uses per code: 1
   - Expires: 2026-08-31
        │
        ▼
[POST /coupons:bulk-generate → 202 operation]
   - Async job
        │
        ▼
[On complete → CSV download link emailed]
```

---

## 12. Edge cases & error handling

| Scenario | Behavior | Code |
|---|---|---|
| Customer with no group → discount eligibility 'specific_groups' | Ineligible | (skipped silently) |
| Coupon code unknown | Reject | `COUPON_NOT_FOUND`, 422 |
| Coupon expired | Reject | `COUPON_EXPIRED`, 422 |
| Coupon usage cap reached | Reject | `COUPON_USAGE_CAP`, 422 |
| Coupon per-customer cap reached | Reject | `COUPON_USAGE_PER_CUSTOMER_CAP`, 422 |
| Coupon targets another customer | Reject | `COUPON_NOT_ELIGIBLE`, 422 |
| Coupon discount paused | Reject | `DISCOUNT_NOT_ACTIVE`, 422 |
| Coupon min purchase not met | Reject | `MIN_PURCHASE_NOT_MET`, 422 |
| Coupon doesn't apply to any cart item | Reject | `COUPON_NOT_APPLICABLE`, 422 |
| Multiple coupons exceed max per cart | Reject latest | `COUPON_MAX_PER_CART`, 422 |
| Two non-stackable discounts both eligible | Apply one with highest customer benefit | (handled) |
| BOGO with only 1 eligible item (needs 2+) | Skip | (skipped silently) |
| Discount percentage > 100% | Reject creation | `INVALID_DISCOUNT_VALUE`, 422 |
| Discount fixed amount > line total | Cap to line total (no negative) | (handled per RULE-PRICING-017) |
| Price list with no prices set | Falls through to fallback / default | (success) |
| Price list reaching ends_at while in cart | Cart line shows snapshot price; checkout re-validates and warns | (handled) |
| Concurrent coupon redemption (race for last single-use) | Advisory lock; one succeeds, others get COUPON_USAGE_CAP | (handled) |
| Customer changes currency mid-checkout | Cart re-prices via exchange rates; warns customer of new totals | (handled) |
| Discount applies_to filter references deleted product | Skip silently | (handled) |
| Gift card with insufficient balance for cart | Apply available balance, rest goes to other payment method | (handled per RULE-PRICING-014) |
| Gift card revoked while in cart | Show "this gift card is no longer valid", remove | (handled) |
| Manual discount override > original price | Reject | `INVALID_OVERRIDE_AMOUNT`, 422 |
| Tax-inclusive price list mixed with tax-exclusive in same cart | Warn + force-convert to tenant convention | (handled, warning) |
| Discount with bogo_config + kind='percentage' | Reject (wrong kind+config) | `INVALID_DISCOUNT_CONFIG`, 422 |
| Discount on cart with all gift card items | Reject (gift cards shouldn't be discountable) | `GIFT_CARD_NOT_DISCOUNTABLE`, 422 |
| Tier price min_quantity overlap (two rows with same min) | Reject create | `TIER_OVERLAP`, 422 |
| Currency mismatch: price.currency ≠ price_list.currency | Reject create | `CURRENCY_MISMATCH`, 422 |

---

## 13. Performance

### 13.1 Targets

| Operation | p50 | p95 | p99 |
|---|---|---|---|
| `POST /pricing:calculate` (cart 5 items, no discount) | 8 ms | 20 ms | 50 ms |
| `POST /pricing:calculate` (cart 20 items, 3 discounts) | 25 ms | 80 ms | 150 ms |
| `POST /coupons:validate` | 5 ms | 15 ms | 40 ms |
| `POST /storefront/cart/apply-coupon` (incl. usage atomic update) | 20 ms | 60 ms | 150 ms |
| `GET /storefront/products/{slug}/price` (cached) | 3 ms | 10 ms | 30 ms |
| Bulk price import (1000 prices, transactional) | 200 ms | 800 ms | 2000 ms |
| `JOB-EXPIRE-DISCOUNTS` (1000 discounts) | 500 ms | 1500 ms | 3000 ms |
| `JOB-INDEX-PATCH-PRICE` per variant | 8 ms | 25 ms | 60 ms |

### 13.2 Optimization

- **Price list resolution cache:** Redis L4 cache per `(tenant, customer_group, channel)` → list of active price_list_ids (TTL 5 min, event-invalidated)
- **Effective price cache:** per `(variant, customer_group, currency)` → snapshot price (TTL 60s, event-invalidated)
- **Discount loader:** all active discounts loaded once per pricing call into in-memory map, indexed by (kind, scope)
- **DataLoader v GraphQL** pro batched `price()` resolver per variant list
- **Outbox events** debounced 30s před search reindex (avoid storm on bulk import)
- **Tax engine** delegated — pricing engine doesn't compute VAT internally (separation of concerns + cacheable)
- **Pre-computed price_min / price_max** v search index (no real-time price resolution v search query)

### 13.3 Hot path queries

```sql
-- Resolve effective price for (variant, context, qty)
WITH eligible_lists AS (
  SELECT id, priority, fallback_price_list_id
  FROM price_lists
  WHERE tenant_id = $1
    AND is_active = true AND deleted_at IS NULL
    AND (starts_at IS NULL OR starts_at <= $now)
    AND (ends_at IS NULL OR ends_at > $now)
    AND (customer_id = $customer_id OR customer_id IS NULL)
    AND (company_id = $company_id OR company_id IS NULL)
    AND (customer_group_id = $customer_group_id OR customer_group_id IS NULL)
    AND (channel_id = $channel_id OR channel_id IS NULL)
  ORDER BY priority DESC
)
SELECT p.* FROM prices p
JOIN eligible_lists el ON el.id = p.price_list_id
WHERE p.variant_id = $variant_id
  AND p.is_active = true
  AND p.min_quantity <= $qty
  AND (p.max_quantity IS NULL OR p.max_quantity >= $qty)
  AND (p.starts_at IS NULL OR p.starts_at <= $now)
  AND (p.ends_at IS NULL OR p.ends_at > $now)
ORDER BY el.priority DESC, p.min_quantity DESC
LIMIT 1;
```

```sql
-- Load active discounts for cart eligibility check
SELECT * FROM discounts
WHERE tenant_id = $1 AND status = 'active' AND deleted_at IS NULL
  AND (starts_at IS NULL OR starts_at <= $now)
  AND (ends_at IS NULL OR ends_at > $now)
  AND (channel_id = $channel_id OR channel_id IS NULL)
ORDER BY priority DESC;
-- App-level eligibility check then prunes per customer/group/cart criteria
```

---

## 14. Security

### 14.1 Permissions

```
PERM-PRICING-VIEW
PERM-PRICING-MANAGE
PERM-PRICING-VIEW-COST          # cost_amount field
PERM-PRICING-IMPORT
PERM-PRICING-EXPORT
PERM-PROMOTION-VIEW
PERM-PROMOTION-MANAGE
PERM-PROMOTION-APPLY-MANUAL     # customer service override
PERM-COUPON-MANAGE
PERM-COUPON-BULK-GENERATE
PERM-GIFT-CARD-MANAGE
PERM-GIFT-CARD-ISSUE
PERM-GIFT-CARD-REVOKE
```

### 14.2 Sensitive fields

- `prices.cost_amount` — hidden unless `PERM-PRICING-VIEW-COST`
- `discounts.bundle_config`, `bogo_config` interní DSL — admin only
- `gift_cards.code_hash` — never returned by API (only display prefix + last4)
- Raw gift card codes shown **once** at issuance, never retrievable

### 14.3 Fraud prevention

- **Coupon abuse detection** (JOB-DETECT-COUPON-ABUSE): patterns jako rapid usage from single IP, geo anomaly, related accounts
- **Single-use token enforcement**: code becomes inactive after first redeem
- **Rate limiting** na coupon apply: 30 attempts/min per IP, 10/min per session (anti-brute-force on coupon codes)
- **Gift card brute force**: code length minimum 16 chars (~10^28 search space), rate limit 5/min per IP

### 14.4 Audit log

- 100% audit log entries pro price changes, discount creates/updates, manual overrides
- 100% audit log entries pro gift card issue/revoke
- Coupon redemptions logged via `discount_usage` + sampled `audit_log` (1%)

### 14.5 Rate limits

| Endpoint | Free | Pro |
|---|---|---|
| `POST /pricing:calculate` | 600/min | 6000/min |
| `POST /coupons:validate` | 60/min per IP, 600/min auth | 1500/min |
| `POST /storefront/cart/apply-coupon` | 30/min per session | 30/min per session |
| `POST /gift-cards:check-balance` | 5/min per IP | 60/min |
| `POST /gift-cards:bulk-issue` | 1/hour | 12/hour |
| `POST /prices:import-csv` | 1/hour | 12/hour |

---

## 15. Testing

### 15.1 Unit

```
TEST-UNIT-PRICING-001  PriceListResolver — priority + fallback chain
TEST-UNIT-PRICING-002  TierPriceMatcher — qty=15 picks min_quantity=10
TEST-UNIT-PRICING-003  DiscountStackingValidator — non-stackable conflict resolution
TEST-UNIT-PRICING-004  BogoCalculator — eligibility groups
TEST-UNIT-PRICING-005  PercentageDiscount with max_discount_amount cap
TEST-UNIT-PRICING-006  FreeShippingDiscount applies to selected methods
TEST-UNIT-PRICING-007  CouponEligibility — customer group, time window, min_purchase
TEST-UNIT-PRICING-008  RoundingEngine — banker's rounding, minor units
TEST-UNIT-PRICING-009  PricingPipeline — full integration, deterministic output
TEST-UNIT-PRICING-010  TaxIntegration — pricing → tax engine handoff
```

### 15.2 Integration

```
TEST-INT-PRICING-001  Create price list → set prices → query for context returns correct price
TEST-INT-PRICING-002  B2B customer gets company price, not retail
TEST-INT-PRICING-003  Tier pricing kicks in at qty threshold
TEST-INT-PRICING-004  Time-bound sale price activates at starts_at via cron
TEST-INT-PRICING-005  Coupon apply → usage_count atomic increment
TEST-INT-PRICING-006  Coupon usage cap → next attempt rejected
TEST-INT-PRICING-007  Discount expires via cron → no longer applies
TEST-INT-PRICING-008  Bundle discount: cart with required variants → discount applied
TEST-INT-PRICING-009  Manual order override → audit log entry
TEST-INT-PRICING-010  Gift card redeem ledger entry + balance decrement atomic
TEST-INT-PRICING-011  Gift card expire job processes batch
TEST-INT-PRICING-012  Bulk price import 5000 rows < 2s
TEST-INT-PRICING-013  Bulk coupon generation 10k codes → CSV
TEST-INT-PRICING-014  Concurrent coupon redemption (50 parallel) — only 1 succeeds for single-use
TEST-INT-PRICING-015  Order placement snapshots prices to order_items (immutable after)
```

### 15.3 E2E

```
TEST-E2E-PRICING-001  Admin creates % discount + coupon → customer applies → total reduces
TEST-E2E-PRICING-002  B2B login → sees company prices on PDP
TEST-E2E-PRICING-003  Storefront tier pricing displays "Save when buying 10+"
TEST-E2E-PRICING-004  BOGO product page banner + cart application
TEST-E2E-PRICING-005  Free shipping discount applies at checkout
TEST-E2E-PRICING-006  Customer purchases gift card → recipient receives email + redeems
TEST-E2E-PRICING-007  Manual customer service refund + override flow
```

### 15.4 Load

```
TEST-LOAD-PRICING-001  1000 RPS pricing:calculate (5-item carts) → p95 < 30 ms
TEST-LOAD-PRICING-002  500 concurrent apply-coupon (single-use token) — exactly 1 succeeds per code
TEST-LOAD-PRICING-003  Bulk import 100k prices in < 60s
```

### 15.5 Snapshot tests

- **Pricing engine snapshot:** golden carts (catalog samples) with expected output. Any change to engine logic invalidates → review required.
- **Tax integration snapshot** — per country VAT calculations.

---

## 16. Implementation checklist

### Backend
- [ ] **[S]** Drizzle schema `packages/db/src/schema/pricing/*.ts`
- [ ] **[S]** Migrace `20260524_001_create_pricing_tables.sql`
- [ ] **[S]** Seed: default Retail price list per tenant
- [ ] **[L]** `PricingEngine` core — pure function, no DB writes; the deterministic pipeline (§6)
- [ ] **[M]** `PriceListResolver` — eligibility + priority + fallback chain
- [ ] **[M]** `DiscountEvaluator` — eligibility + stacking + conflict resolution
- [ ] **[M]** `CouponValidator` — atomic validation + usage tracking
- [ ] **[M]** `GiftCardService` — issue, redeem, ledger writes
- [ ] **[S]** `BogoCalculator`, `TieredCalculator`, `BundleCalculator` (per discount kind)
- [ ] **[S]** `RoundingEngine` (banker's rounding, locale-aware display)
- [ ] **[M]** REST endpoints per §7
- [ ] **[M]** GraphQL types + resolvers + DataLoaders
- [ ] **[S]** tRPC router (admin)
- [ ] **[S]** MCP tool `pricing.get_price` + `pricing.calculate`
- [ ] **[M]** Storefront pricing helpers (`getEffectivePrice`, `formatMoney`, `formatDiscount`)

### Background jobs
- [ ] **[S]** JOB-EXPIRE-DISCOUNTS, JOB-EXPIRE-COUPONS, JOB-EXPIRE-GIFT-CARDS
- [ ] **[M]** JOB-BULK-GENERATE-COUPONS
- [ ] **[M]** JOB-IMPORT-PRICES-CSV, JOB-EXPORT-PRICES-CSV
- [ ] **[S]** JOB-COPY-PRICES-WITH-MARKUP
- [ ] **[S]** JOB-RECONCILE-COUPON-USAGE
- [ ] **[M]** JOB-INDEX-PATCH-PRICE — search index sync
- [ ] **[S]** JOB-DETECT-COUPON-ABUSE
- [ ] **[S]** JOB-ANALYZE-DISCOUNT-PERFORMANCE
- [ ] **[S]** CRON-PUBLISH-SCHEDULED-DISCOUNTS

### Frontend — Admin
- [ ] **[L]** Price list management (list, detail, prices table)
- [ ] **[M]** Bulk price editor s CSV import/export
- [ ] **[L]** Discount builder wizard (per §11)
- [ ] **[M]** Discount list s usage stats
- [ ] **[M]** Coupon management (single + bulk generate)
- [ ] **[M]** Gift card management (issue, list, transactions)
- [ ] **[M]** Pricing simulator (admin tool — preview cart with sample data)
- [ ] **[S]** Manual discount override modal v order detail
- [ ] **[S]** Analytics: discount performance, top coupons, gift card redemption rates

### Frontend — Storefront
- [ ] **[M]** Price display (gross/net per locale + compare-at-price strike-through)
- [ ] **[S]** Tier pricing badge on PDP ("Save 10% when buying 10+")
- [ ] **[S]** BOGO banner ("Buy 2, get 1 free")
- [ ] **[M]** Coupon input box on cart + checkout
- [ ] **[S]** Gift card balance check page
- [ ] **[S]** Gift card application UI v checkout
- [ ] **[S]** "You saved X Kč" summary v cart total

### Tests
- [ ] **[M]** Per §15
- [ ] **[M]** Pricing engine golden snapshot suite (req for any engine change)

### Docs
- [ ] **[S]** "Managing your pricing strategy" merchant guide
- [ ] **[S]** "Creating promotions and discounts" merchant guide
- [ ] **[S]** "Issuing gift cards" merchant guide
- [ ] **[S]** Developer docs: pricing engine integration + plugin hooks
- [ ] **[S]** API: pricing:calculate reference

---

## 17. Open questions

### Q-PRICING-001: Multi-currency v jednom price list
**Otázka:** Současné schema vyžaduje 1 currency per price list. Alternative: 1 list s `prices_by_currency JSONB`. Lepší pro merchants s multi-currency stores.

**Status:** MVP: 1 currency per list (jednoduché). v1.0+: zvážit "currency-agnostic" price list option pro Pro/Enterprise.

### Q-PRICING-002: Strikethrough vs sale badge logic
**Otázka:** Storefront ukazuje "was 1990, now 1490 (−25%)" — kdy use compare_at_price vs detected sale period?

**Status:** Compare_at_price je merchant-set explicit. Sale detection automatic z time-bound prices. Storefront uses BOTH: compare_at if set, fallback to sale detection from prices.starts_at. Detail v `26-themes-storefront.md`.

### Q-PRICING-003: Customer-level prices vs customer-group prices
**Otázka:** Per-customer prices (1 customer, custom price list) jako edge case nebo common feature?

**Status:** MVP: schema supports (price_lists.customer_id). UI hidden, available via API for plugins. v1.0+: enterprise B2B feature.

### Q-PRICING-004: Promotion rules visual builder
**Otázka:** Shopware-inspired drag-drop visual rule builder. Implementace složitá.

**Status:** v1.0+ feature (4.2.10 v `todo.md`). MVP: JSONB DSL editable via JSON editor; visual builder later.

### Q-PRICING-005: Cross-channel coupon validity
**Otázka:** Coupon vytvořen na web channel — má fungovat i v POS / mobile app channels?

**Status:** Configurable per discount via `channel_id` field. NULL = all channels. UI defaults to "all channels" pro simplicitu.

### Q-PRICING-006: Auto-apply discounts at threshold
**Otázka:** "Spend over 1500 → auto-discount 10%" bez nutnosti coupon code?

**Status:** Supported via `requires_coupon=false` + `min_purchase_amount`. Storefront auto-applies in cart view + checkout. Visual indicator on PDP ("Add 250 Kč more to save 10%") jako v1.0+ feature.

### Q-PRICING-007: Subscription pricing
**Otázka:** Subscription product pricing — fixed monthly fee, prorated, discount stacking?

**Status:** v2.0+ feature, detailed in `24-subscriptions.md`. Pricing engine extension via plugin hooks.

### Q-PRICING-008: Negotiated B2B quotes
**Otázka:** B2B customer žádá quote → merchant approves custom prices. Override price_lists or separate quote_pricing?

**Status:** v1.0+ B2B feature (`21-b2b-complete.md`). Quotes jako separátní entity overrides automatic pricing.

### Q-PRICING-009: AI-suggested promotional strategies
**Otázka:** DEC-AI-001 + AI Copilot suggests "create a 20% discount for X to boost slow movers"?

**Status:** Fáze 3+ feature v `33-ai-features.md`. Out of scope MVP.

### Q-PRICING-010: Plugin discount kind
**Otázka:** `discounts.kind='plugin'` + `plugin_handler` — extension point pro plugins to define custom discount logic (např. "Loyalty points × 0.01 per Kč spent")?

**Status:** Supported v MVP schema, but plugin SDK detail in `28-developer-platform.md`. First-party loyalty plugin v2.0+.

### Q-PRICING-011: Gift card vs store credit distinction
**Otázka:** Store credit (refund credit) vs gift card (purchased). Same table or separate?

**Status:** MVP: single `gift_cards` table; `kind` field distinguishes (`kind='store_credit'` vs default `'gift'`). UI nuance per kind. v1.0+: zvážit oddělení if features diverge.

### Q-PRICING-012: Discount code on referral
**Otázka:** "Share with friend → get discount" → friend gets coupon → both reward?

**Status:** Out of scope MVP. v1.0+ referral plugin v marketplace.

---

## 📅 Změny

| Datum | Změna |
|---|---|
| 2026-05-19 | Initial — kompletní Pricing & Promotions doména. Deterministic pricing engine pipeline, price list resolution, discount stacking, coupons, gift cards. Pricing engine pure function s explicit timestamp. |

---

**Konec Pricing, Promotions & Discounts.**

➡️ Pokračovat na: [`11-cart.md`](11-cart.md)
