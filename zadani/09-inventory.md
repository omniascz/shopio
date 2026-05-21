# 09 – INVENTORY & WAREHOUSING

> **Doména:** Sklad. Kolik produktů, kde a co je dostupné k objednání. Pokrývá inventory tracking, stock reservations s deterministickým TTL, append-only stock ledger, multi-source inventory připravený v schema (MVP = 1 default warehouse, MSI aktivace ve v1.0).

**Datum:** 2026-05-19
**Verze:** 1.0
**Status:** 🟡 DESIGN
**Reference:** [03 §6](03-data-models-master.md#6-inventory--warehousing) · [06-catalog-pim.md](06-catalog-pim.md) · [11-cart.md](11-cart.md) · [12-checkout.md](12-checkout.md) · [16-order-management.md](16-order-management.md)

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

- **Warehouses** — fyzické nebo logické lokace skladu (MVP: 1 default; v1.0+: multi-source)
- **Inventory items** — 1:1 s product variantami, tracking mode (`tracked` / `not_tracked` / `backorder_allowed`)
- **Stock levels** — per (variant × warehouse) snapshot `on_hand`, `reserved`, `available`, `incoming`
- **Stock reservations** — time-bound holds na variant (cart, order, manual) s automatic expiry
- **Stock movements** — append-only ledger každé změny (`sale`, `return`, `adjustment`, `transfer_*`, `receive`, `damage`, `shrinkage`)
- **Backorder** — povolit prodej i při `on_hand=0`, ETA na restock signalizovaný customerovi
- **Safety stock + reorder point** — alerty pro merchant při low stock
- **Stock import/export CSV** — bulk adjustments, fyzická inventura
- **Cross-warehouse transfers** (v1.0+)

### 0.2 Co tato doména **NENÍ**

- ❌ Product master data (→ `06-catalog-pim.md`)
- ❌ Pricing (→ `10-pricing-promotions.md`)
- ❌ Order management, fulfillment (→ `16-order-management.md`)
- ❌ Shipping/carriers (→ `14-shipping.md`)
- ❌ Purchase orders / supplier management (→ Fáze 2 ERP integration v `29-integrations.md`)
- ❌ Demand forecasting, AI replenishment (→ `33-ai-features.md` Fáze 3+)
- ❌ Marketplace third-party fulfillment (→ `25-marketplace.md`)

### 0.3 Klíčové invarianty (NEVER violate)

```
INV-1:  on_hand >= 0                    -- never negative (backorder = separate flag)
INV-2:  reserved >= 0
INV-3:  reserved <= on_hand              -- pokud backorder NEpovolen
INV-4:  available = on_hand - reserved   -- generated column
INV-5:  Each stock_movement is atomic    -- záznam vs. delta aplikace v 1 transakci
INV-6:  Sum of movements over time = current on_hand   -- ledger consistency
```

### 0.4 Diferenciátory

1. **Schema ready for MSI od dne 1** — `warehouses` tabulka existuje v MVP s 1 default row, multi-warehouse aktivace přes flag `FEATURES.MULTI_SOURCE_INVENTORY=true` bez DB rewritu
2. **Advisory lock-based allocation** — `pg_advisory_xact_lock(variant_id_hash)` při reservation, žádný row lock degradation pod load
3. **Outbox pattern pro stock events** — guaranteed-once delivery do search indexer + webhooks
4. **Backorder s ETA** — customer vidí "doručení do 14 dní" místo plochého "vyprodáno"
5. **Append-only ledger** — kompletní audit trail, schopnost reconstruct stav k libovolnému timestamp (pro účetní inventory valuation)

---

## 1. References

- [03 §6 Inventory & Warehousing](03-data-models-master.md#6-inventory--warehousing) — entity ENT-WAREHOUSE-001 až ENT-STOCK-MOVEMENT-001
- [DEC-ARCH-004](01-decisions-registry.md#dec-arch-004-multi-tenancy-model) — multi-tenancy strategy
- [DEC-EVENTS-001](01-decisions-registry.md#dec-events-001-event-bus--background-jobs) — outbox + BullMQ + Postgres LISTEN/NOTIFY
- [DEC-DB-001](01-decisions-registry.md#dec-db-001-primary-database) — PostgreSQL 17, advisory locks support
- [06-catalog-pim.md](06-catalog-pim.md) — `product_variants` 1:1 s `inventory_items`
- [08-search-filtering.md](08-search-filtering.md) — stock_status filter v search index
- [11-cart.md](11-cart.md) — cart vytváří reservations
- [12-checkout.md](12-checkout.md) — checkout convert reservations → order holds
- [16-order-management.md](16-order-management.md) — order placement decrement stock; cancellation release
- [17-returns-refunds.md](17-returns-refunds.md) — returns restock or write-off
- [22-multistore-channels.md](22-multistore-channels.md) — per-channel inventory overrides (Fáze 2)
- [29-integrations.md](29-integrations.md) — ERP/WMS connectors (Pohoda, SAP, Odoo, …)

---

## 2. Personas

| Persona | Použití | Klíčové permissions |
|---|---|---|
| `PERSONA-MERCHANT-OWNER` | Plná správa skladů | `PERM-INVENTORY-*` |
| `PERSONA-WAREHOUSE-MANAGER` | Stock adjustments, inventory counts, transfers | `PERM-INVENTORY-VIEW/ADJUST/TRANSFER/COUNT`, `PERM-WAREHOUSE-MANAGE` |
| `PERSONA-WAREHOUSE-STAFF` | Pick & pack, stock decrements via order fulfillment | `PERM-INVENTORY-VIEW`, `PERM-ORDER-FULFILL` |
| `PERSONA-CATALOG-MANAGER` | View stock per product, set safety stock | `PERM-INVENTORY-VIEW`, `PERM-INVENTORY-SAFETY-STOCK-MANAGE` |
| `PERSONA-CUSTOMER` | Storefront stock badge view | Anon endpoints (read-only stock_status) |
| `PERSONA-AI-COPILOT` | Reorder suggestions, demand forecasting (Fáze 3+) | `agent:inventory:read` |
| `PERSONA-EXTERNAL-AGENT` | MCP `inventory.check_availability` | `agent:inventory:read` |
| `PERSONA-ERP-SYSTEM` (integrace) | Bidirectional sync via API key + webhooks | `inventory:read`, `inventory:write` scopes |

---

## 3. Data models

### 3.1 `warehouses` ([ENT-WAREHOUSE-001](03-data-models-master.md#ent-warehouse-001))

```sql
CREATE TABLE warehouses (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  code TEXT NOT NULL,                                  -- 'main', 'warsaw-01', 'pickup-prague'
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('physical','virtual','dropship','pickup_point','external')) DEFAULT 'physical',
  address_id UUID NULL REFERENCES addresses(id),
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  pickup_enabled BOOLEAN NOT NULL DEFAULT false,        -- BOPIS support
  is_fulfilling BOOLEAN NOT NULL DEFAULT true,          -- false = read-only / display only
  priority INTEGER NOT NULL DEFAULT 0,                  -- allocation priority
  cutoff_time TIME NULL,                                -- same-day shipping cutoff
  timezone TEXT NULL,                                   -- 'Europe/Prague'
  operating_hours JSONB NULL,                           -- weekly schedule
  external_id TEXT NULL,                                -- WMS / ERP reference
  external_provider TEXT NULL,                          -- 'pohoda', 'sap', 'odoo'
  notes TEXT NULL,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  version INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_warehouses_tenant_code UNIQUE (tenant_id, code)
);

CREATE UNIQUE INDEX uq_warehouses_tenant_default
  ON warehouses (tenant_id)
  WHERE is_default = true AND deleted_at IS NULL;

CREATE INDEX idx_warehouses_tenant_active
  ON warehouses (tenant_id, priority)
  WHERE is_active = true AND deleted_at IS NULL;
```

**MVP seed:** automatický `code='main'`, `name='Main warehouse'`, `is_default=true`, `priority=0` při tenant creation.

### 3.2 `inventory_items` ([ENT-INVENTORY-001](03-data-models-master.md#ent-inventory-001))

```sql
CREATE TABLE inventory_items (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  tracking_mode TEXT NOT NULL CHECK (tracking_mode IN ('tracked','not_tracked','backorder_allowed','preorder_only')) DEFAULT 'tracked',
  safety_stock INTEGER NOT NULL DEFAULT 0,
  reorder_point INTEGER NULL,                           -- alert threshold
  reorder_quantity INTEGER NULL,                        -- typical replenishment qty (hint pro PO)
  lead_time_days INTEGER NULL,                          -- supplier lead time
  backorder_eta_days INTEGER NULL,                      -- displayed pro customer
  preorder_release_date DATE NULL,                      -- pro preorder_only mode
  max_per_order INTEGER NULL,                           -- soft limit, např. limited edition
  inventory_cost_amount BIGINT NULL,                    -- pro inventory valuation (minor unit)
  inventory_cost_currency CHAR(3) NULL,
  cost_method TEXT NULL CHECK (cost_method IN ('fifo','lifo','weighted_avg','specific')) DEFAULT NULL,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_inventory_items_variant UNIQUE (variant_id),
  CONSTRAINT ck_safety_stock_non_negative CHECK (safety_stock >= 0),
  CONSTRAINT ck_reorder_point_non_negative CHECK (reorder_point IS NULL OR reorder_point >= 0)
);

CREATE INDEX idx_inventory_items_tenant ON inventory_items (tenant_id);
```

**Vztah 1:1 s variant:** trigger nebo aplikační logika auto-creates inventory_item při variant create. Kaskáda na delete.

### 3.3 `stock_levels` ([ENT-STOCK-LEVEL-001](03-data-models-master.md#ent-stock-level-001))

```sql
CREATE TABLE stock_levels (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES product_variants(id),   -- denormalized for join speed
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  on_hand INTEGER NOT NULL DEFAULT 0,
  reserved INTEGER NOT NULL DEFAULT 0,
  available INTEGER GENERATED ALWAYS AS (on_hand - reserved) STORED,
  incoming INTEGER NOT NULL DEFAULT 0,                  -- expected from PO/transfers, ETA known
  last_counted_at TIMESTAMPTZ NULL,                     -- physical inventory check
  last_counted_value INTEGER NULL,
  last_movement_at TIMESTAMPTZ NULL,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT uq_stock_levels UNIQUE (inventory_item_id, warehouse_id),
  CONSTRAINT ck_on_hand_non_negative CHECK (on_hand >= 0),
  CONSTRAINT ck_reserved_non_negative CHECK (reserved >= 0),
  CONSTRAINT ck_incoming_non_negative CHECK (incoming >= 0)
);

CREATE INDEX idx_stock_levels_variant_wh ON stock_levels (variant_id, warehouse_id);
CREATE INDEX idx_stock_levels_warehouse_available ON stock_levels (warehouse_id, available) WHERE available > 0;
CREATE INDEX idx_stock_levels_low ON stock_levels (tenant_id, available);
```

**Reserved ≤ on_hand soft constraint:** pro tracking_mode='tracked' vynucené aplikační logikou před commit; pro backorder_allowed může `reserved > on_hand` (záporný `available` znamená backorder queue depth).

### 3.4 `stock_reservations` ([ENT-STOCK-RESERVATION-001](03-data-models-master.md#ent-stock-reservation-001))

```sql
CREATE TABLE stock_reservations (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  variant_id UUID NOT NULL REFERENCES product_variants(id),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  kind TEXT NOT NULL CHECK (kind IN ('cart','order','manual','transfer','allocation_hold')) DEFAULT 'cart',
  cart_id UUID NULL REFERENCES carts(id) ON DELETE CASCADE,
  order_id UUID NULL REFERENCES orders(id) ON DELETE SET NULL,
  external_ref TEXT NULL,                               -- e.g., third-party reservation ID
  reserved_by_actor_kind TEXT NULL,                     -- 'customer','staff','system','agent'
  reserved_by_actor_id UUID NULL,
  reason TEXT NULL,                                     -- pro manual reservations
  expires_at TIMESTAMPTZ NULL,                          -- NULL = no expiry (order holds)
  released_at TIMESTAMPTZ NULL,
  released_reason TEXT NULL,                            -- 'expired','converted','cancelled','manual'
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT ck_reservation_owner CHECK (
    (kind = 'cart' AND cart_id IS NOT NULL AND order_id IS NULL) OR
    (kind = 'order' AND order_id IS NOT NULL AND cart_id IS NULL) OR
    (kind IN ('manual','transfer','allocation_hold'))
  ),
  CONSTRAINT ck_reservation_release CHECK (
    (released_at IS NULL AND released_reason IS NULL) OR
    (released_at IS NOT NULL AND released_reason IS NOT NULL)
  )
);

CREATE INDEX idx_reservations_variant_wh_active
  ON stock_reservations (variant_id, warehouse_id)
  WHERE released_at IS NULL;

CREATE INDEX idx_reservations_expires
  ON stock_reservations (expires_at)
  WHERE released_at IS NULL AND expires_at IS NOT NULL;

CREATE INDEX idx_reservations_cart ON stock_reservations (cart_id) WHERE cart_id IS NOT NULL;
CREATE INDEX idx_reservations_order ON stock_reservations (order_id) WHERE order_id IS NOT NULL;
```

**Default TTLs (configurable per tenant):**
- `kind='cart'`: 30 minut z `now()`
- `kind='order'`: NULL (no expiry, decrement on fulfillment)
- `kind='manual'`: explicit, default 24h
- `kind='transfer'`: NULL nebo specifický
- `kind='allocation_hold'`: 5 minut (transient hold during checkout)

### 3.5 `stock_movements` ([ENT-STOCK-MOVEMENT-001](03-data-models-master.md#ent-stock-movement-001))

```sql
CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  variant_id UUID NOT NULL REFERENCES product_variants(id),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  quantity_delta INTEGER NOT NULL,                      -- negative = decrement
  reason TEXT NOT NULL CHECK (reason IN (
    'sale','return','adjustment_positive','adjustment_negative',
    'transfer_in','transfer_out','receive','damage','shrinkage',
    'count_correction','initial_load','reservation_release','manual_other'
  )),
  reference_type TEXT NULL CHECK (reference_type IN ('order','return','purchase_order','transfer','count','manual','initial','plugin') OR reference_type IS NULL),
  reference_id UUID NULL,
  reference_external TEXT NULL,                         -- pro external systems (ERP doc number)
  unit_cost_amount BIGINT NULL,                         -- pro inventory valuation
  unit_cost_currency CHAR(3) NULL,
  resulting_on_hand INTEGER NOT NULL,                    -- snapshot post-apply (audit aid)
  notes TEXT NULL,
  actor_kind TEXT NOT NULL CHECK (actor_kind IN ('user','customer','system','agent','webhook','integration')),
  actor_id UUID NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT ck_quantity_delta_non_zero CHECK (quantity_delta <> 0),
  CONSTRAINT ck_resulting_on_hand_non_negative CHECK (resulting_on_hand >= 0)
) PARTITION BY RANGE (occurred_at);

-- Monthly partitions; BRIN index
CREATE INDEX brin_stock_movements_occurred_at ON stock_movements USING BRIN (occurred_at);
CREATE INDEX idx_stock_movements_variant_wh ON stock_movements (variant_id, warehouse_id, occurred_at DESC);
CREATE INDEX idx_stock_movements_reference ON stock_movements (reference_type, reference_id) WHERE reference_id IS NOT NULL;
```

**Append-only:** žádný UPDATE, žádný DELETE. Korekce = nový movement s opačným delta + reason='count_correction'.

### 3.6 `warehouse_stock_overrides` *(v1.0+ Multi-source Inventory)*

Per-channel overrides — částečně rezervovaná kapacita pro konkrétní channel (např. "max 30 ks na Heuréka feed z celkového stocku 100").

```sql
CREATE TABLE warehouse_stock_overrides (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  variant_id UUID NOT NULL REFERENCES product_variants(id),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  channel_id UUID NOT NULL REFERENCES channels(id),
  reserved_for_channel INTEGER NOT NULL DEFAULT 0,
  max_per_channel INTEGER NULL,
  CONSTRAINT uq_wh_stock_overrides UNIQUE (variant_id, warehouse_id, channel_id)
);
```

V MVP tabulka existuje (schema ready), ale není dotazována. Aktivace ve v1.0 přes `FEATURES.MULTI_SOURCE_INVENTORY=true`.

### 3.7 `inventory_counts` *(physical inventory check)*

Cycle counts a full inventory snapshots.

```sql
CREATE TABLE inventory_counts (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  warehouse_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('full','cycle','spot')),
  status TEXT NOT NULL CHECK (status IN ('draft','in_progress','completed','cancelled')) DEFAULT 'draft',
  started_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  total_lines INTEGER NOT NULL DEFAULT 0,
  total_discrepancies INTEGER NOT NULL DEFAULT 0,
  created_by UUID NULL,
  notes TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE inventory_count_lines (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  count_id UUID NOT NULL REFERENCES inventory_counts(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES product_variants(id),
  expected_quantity INTEGER NOT NULL,                   -- z stock_levels v okamžiku start
  counted_quantity INTEGER NULL,
  discrepancy INTEGER GENERATED ALWAYS AS (COALESCE(counted_quantity, 0) - expected_quantity) STORED,
  counted_by UUID NULL,
  counted_at TIMESTAMPTZ NULL,
  notes TEXT NULL,
  CONSTRAINT uq_count_lines UNIQUE (count_id, variant_id)
);

CREATE INDEX idx_count_lines_count ON inventory_count_lines (count_id);
```

Pri `inventory_counts.completed`: trigger generates `stock_movements` reason='count_correction' pro každý line s discrepancy ≠ 0.

### 3.8 Vztahy

```
products (1)──(N) product_variants (1)──(1) inventory_items
                                            │
                                            │ (N) per warehouse
                                            ▼
                                       stock_levels  (1 row per (item, warehouse))
                                            
product_variants ──(N) stock_reservations  [cart/order holds, expiring]
product_variants ──(N) stock_movements     [append-only ledger]
warehouses (1)──(N) stock_levels
warehouses (1)──(N) stock_reservations
warehouses (1)──(N) stock_movements
warehouses (1)──(N) inventory_counts
inventory_counts (1)──(N) inventory_count_lines
```

---

## 4. State machines

### 4.1 Reservation lifecycle

```
              create
[null] ─────────────────▶ [active]
                              │
                              │
                              ├─── expire (TTL hit, async sweeper) ─▶ [released, reason='expired']
                              │
                              ├─── convert_to_order ─▶ [active, kind='order']  (cart → order migration)
                              │
                              ├─── manual_release ─▶ [released, reason='manual']
                              │
                              ├─── consumed_by_fulfillment ─▶ [released, reason='converted']
                              │
                              └─── cart_deleted ─▶ [released, reason='cancelled']  (cascade)
```

### 4.2 Stock movement application (atomic)

Pro každý ledger movement v transakci:

```sql
BEGIN;
  -- Acquire advisory lock by hash(variant_id, warehouse_id)
  SELECT pg_advisory_xact_lock(hashtext($variant_id || ':' || $warehouse_id)::bigint);

  -- Read current stock_level
  SELECT on_hand INTO @current FROM stock_levels
    WHERE variant_id = $1 AND warehouse_id = $2;

  -- Validate (e.g., not negative unless backorder)
  IF @current + $delta < 0 AND NOT @backorder_allowed THEN
    RAISE EXCEPTION 'STOCK_INSUFFICIENT';
  END IF;

  -- Insert ledger entry
  INSERT INTO stock_movements (
    variant_id, warehouse_id, quantity_delta, reason, reference_type, reference_id,
    resulting_on_hand, actor_kind, actor_id, occurred_at
  ) VALUES (...);

  -- Update aggregate
  UPDATE stock_levels
    SET on_hand = on_hand + $delta,
        last_movement_at = now(),
        version = version + 1
    WHERE variant_id = $1 AND warehouse_id = $2;

  -- Emit outbox event
  INSERT INTO outbox_events (event_type, payload, ...) VALUES ('stock.level_changed', ...);

COMMIT;
```

**Advisory lock granularity:** per `(variant_id, warehouse_id)` — minimální kontence, paralelní writes na různé varianty / sklady nejsou blokované.

### 4.3 Reservation → Order flow

```
Cart add → POST /carts/{id}/items
  └─► Create reservation (kind='cart', cart_id=X, quantity=Q, expires_at=now+30m)
      └─► UPDATE stock_levels SET reserved = reserved + Q
      └─► Emit EVENT-STOCK-LEVEL-CHANGED

Cart abandon (no activity 30m)
  └─► JOB-SWEEP-EXPIRED-RESERVATIONS finds reservation
      └─► UPDATE stock_levels SET reserved = reserved - Q
      └─► Mark reservation released_at=now, released_reason='expired'
      └─► Emit EVENT-STOCK-LEVEL-CHANGED, EVENT-RESERVATION-RELEASED

Checkout initiation → POST /checkouts
  └─► Convert reservations: UPDATE stock_reservations SET kind='order', order_id=X, cart_id=NULL, expires_at=NULL
  └─► (Reserved stays the same on stock_levels — no double-counting)

Order placed → confirmed
  └─► No stock change at placement (already reserved)

Order fulfillment (shipment created)
  └─► Apply stock movement: quantity_delta = -shipped_qty, reason='sale'
  └─► UPDATE stock_levels SET on_hand = on_hand - shipped_qty
  └─► UPDATE stock_levels SET reserved = reserved - shipped_qty  (release the hold)
  └─► Mark reservation released_at, reason='converted'
  └─► Emit EVENT-STOCK-LEVEL-CHANGED

Order cancellation
  └─► UPDATE stock_levels SET reserved = reserved - cancelled_qty
  └─► Mark reservation released_at, reason='cancelled'
  └─► Emit EVENT-STOCK-LEVEL-CHANGED

Return received → restock decision = 'restock'
  └─► Apply movement: quantity_delta = +returned_qty, reason='return'
  └─► UPDATE stock_levels SET on_hand = on_hand + returned_qty
```

### 4.4 Inventory count lifecycle

```
draft → in_progress → completed
              │
              └─── cancelled
```

Při `completed`: aplikační logika generuje `stock_movements` pro každou discrepancy (reason='count_correction').

---

## 5. Business rules

### RULE-INV-001: 1:1 inventory_item per variant
Trigger `tg_variants_after_insert_create_inventory_item` auto-creates `inventory_items` row při variant create. `tracking_mode` default 'tracked'.

### RULE-INV-002: Stock level lazy-created
`stock_levels` row se vytváří on-demand při prvním movement nebo manual init pro daný `(inventory_item, warehouse)` pár. Žádný auto-create kartézského produktu N variantů × M skladů.

### RULE-INV-003: on_hand never negative
`CHECK (on_hand >= 0)` na DB úrovni. Aplikační logika ověřuje před apply:
- `tracked` mode: reject pokud `on_hand + delta < 0` → 422 `STOCK_INSUFFICIENT`
- `backorder_allowed`: allow `available = on_hand - reserved` jít negative (reserved > on_hand), ale `on_hand >= 0` stále platí
- `not_tracked`: skip check úplně, žádný stock_movement se nezapisuje

### RULE-INV-004: Advisory lock pro každý stock mutation
Každá změna `stock_levels` MUSÍ být v transakci s `pg_advisory_xact_lock(hash(variant_id, warehouse_id))`. Důvod: prevence race condition pri cart concurrent add během flash sale.

**Bez advisory locku** by 1000 paralelních cart adds na 1 položku se 100 kusy mohlo prodat 1100+ kusů (TOCTOU race).

### RULE-INV-005: Reservation expiry granularity 30 min cart
Default cart reservation TTL = 30 minut z create. Configurable per tenant `tenant.settings.cart_reservation_ttl_seconds`.

Sweeper job (JOB-SWEEP-EXPIRED-RESERVATIONS) běží každou minutu, vyčistí expired, emit events.

**Sliding extend:** každý cart update (add/remove item, qty change) extend `expires_at = now() + ttl`. Idle cart vyprší.

### RULE-INV-006: Order reservation no expiry
Když cart → order, reservation `kind='order'`, `expires_at=NULL`. Drží stock dokud:
- Order fulfilled → release on movement
- Order cancelled → release explicit

### RULE-INV-007: Backorder ETA
Backorder-enabled variant s `available < 0` (i.e., `reserved > on_hand`): storefront ukazuje "Doručení do {backorder_eta_days} dní". Backorder customer dostane email při restock.

Tracking backorder waiting list — implicitní z order timestamp (FIFO).

### RULE-INV-008: Preorder mode
`tracking_mode='preorder_only'`: prodej je povolen, ale shipment je blokován do `preorder_release_date`. Order status `confirmed` ale fulfillment hold. Při release date: auto-emit notification do fulfillment queue.

### RULE-INV-009: Safety stock alerts
Storefront vidí `stock_status='low_stock'` když `available <= safety_stock + reorder_point_buffer` (configurable buffer, default 0). Admin dostane email/notification.

### RULE-INV-010: Cart add must verify availability
Endpoint `POST /carts/{id}/items` musí:
1. Acquire advisory lock
2. Read current available
3. Verify `available >= requested_qty` (s respektováním backorder flag)
4. Create reservation + update stock_level atomic
5. Release advisory lock

Pokud insufficient: 422 `STOCK_INSUFFICIENT` s payload `{ available, requested, can_backorder }`.

### RULE-INV-011: Cart quantity change adjusts reservation
Cart item update qty `Q1 → Q2`:
- Pokud Q2 > Q1: incremental reservation (atomic)
- Pokud Q2 < Q1: partial release
- Pokud Q2 = 0: remove item, full release

Reservation row stays same; quantity column updated.

### RULE-INV-012: Multi-warehouse allocation strategy (v1.0+)
Při checkout s multi-source enabled, alokace per order_item:
1. Pokud `available` ≥ qty na 1 warehouse: use that warehouse (single shipment preferred)
2. Pokud žádný single wh nestačí: split podle priority + proximity (customer address → nearest first)
3. Split pravidla configurable: `prefer_single_shipment`, `prefer_closest`, `prefer_lowest_cost`, `custom_rule`

MVP: vždy default warehouse, žádná alokace logika.

### RULE-INV-013: Transfer between warehouses
Cross-warehouse transfer = 2 movements:
- Source: `quantity_delta=-Q, reason='transfer_out', reference_type='transfer', reference_id=T`
- Destination: `quantity_delta=+Q, reason='transfer_in', reference_type='transfer', reference_id=T`

Pre-transfer: source warehouse vytvoří `stock_reservations` kind='transfer' pro Q ks, dokud destination nedokončí receive.

### RULE-INV-014: Inventory count freezes effective stock?
**No.** Count probíhá při běžícím provozu. Discrepancy se počítá k `started_at` snapshot. Změny mezi `started_at` a `completed_at` se reflect ve final count_correction movement.

**Optimal pattern:** počítat během low-traffic okna, ale platforma nesmí blokovat business hours.

### RULE-INV-015: Stock movements ledger immutability
Žádný UPDATE, žádný DELETE na `stock_movements`. Correction = nový movement, ne edit. Audit log requirement.

### RULE-INV-016: Cost tracking (FIFO / LIFO / weighted avg)
`inventory_items.cost_method` říká, jakou metodu použít. Při `receive`: `stock_movements.unit_cost_amount` snapshots cost. Při `sale`: helper view nebo recurring job počítá COGS per metoda.

MVP: cost field jen logging, žádné automatické COGS computation. v1.0+ feature.

### RULE-INV-017: Channel-level inventory caps (v1.0+ MSI)
Pokud `FEATURES.MULTI_SOURCE_INVENTORY=true` a existuje `warehouse_stock_overrides` row:
- Available pro channel X = `MIN(stock_levels.available, warehouse_stock_overrides.max_per_channel - reserved_for_channel)`
- Reservation s `channel_id=X` incrementuje `reserved_for_channel`

MVP: ignorováno.

### RULE-INV-018: Stock status enum derivation
Pro storefront + search index (denormalized field):

```
stock_status = 
  CASE
    WHEN tracking_mode = 'not_tracked' THEN 'in_stock'                  -- treat as always available
    WHEN tracking_mode = 'preorder_only' THEN 'preorder'
    WHEN tracking_mode = 'backorder_allowed' AND available <= 0 THEN 'backorder'
    WHEN available <= 0 THEN 'out_of_stock'
    WHEN available <= safety_stock + low_threshold THEN 'low_stock'
    ELSE 'in_stock'
  END
```

`low_threshold` configurable per tenant (default 5).

### RULE-INV-019: Reservation cleanup on cart soft-delete
Při `carts.deleted_at` set: cascade release všech reservations (cart kind). Trigger nebo event handler.

### RULE-INV-020: Initial stock load
Při tenant onboarding nebo CSV import: movement reason='initial_load', kterým se zapíše baseline. Žádný negative initial_load (use 'adjustment_*' pro corrections).

### RULE-INV-021: Idempotent stock import
Stock CSV import musí být idempotent — re-run stejného CSV s `idempotency_key` nesmí double-apply. Import service tracks applied imports v `idempotency_log`.

### RULE-INV-022: Audit per movement
Každý `stock_movement` má `actor_kind` + `actor_id`. Žádný "anonymous" actor — pokud z webhooku, `actor_kind='webhook'` + reference do webhook delivery.

---

## 6. REST API endpoints

### 6.1 Warehouses (admin)

```
GET    /api/{date}/warehouses
POST   /api/{date}/warehouses
GET    /api/{date}/warehouses/{id}
PATCH  /api/{date}/warehouses/{id}
DELETE /api/{date}/warehouses/{id}
POST   /api/{date}/warehouses/{id}:set-default
POST   /api/{date}/warehouses/{id}:activate
POST   /api/{date}/warehouses/{id}:deactivate
```

### 6.2 Inventory items + stock levels

```
GET    /api/{date}/inventory-items                       # list, filterable by tracking_mode, low-stock
GET    /api/{date}/inventory-items/{id}
PATCH  /api/{date}/inventory-items/{id}                  # tracking_mode, safety_stock, reorder_point
GET    /api/{date}/inventory-items/by-variant/{variant_id}
GET    /api/{date}/inventory-items/{id}/stock-levels    # all warehouses for this item

GET    /api/{date}/stock-levels                          # query multiple
GET    /api/{date}/stock-levels/{variant_id}/{warehouse_id}
POST   /api/{date}/stock-levels:adjust                   # apply movement
POST   /api/{date}/stock-levels:adjust-bulk              # bulk movements (1 transaction)
POST   /api/{date}/stock-levels:import-csv               # async
POST   /api/{date}/stock-levels:export-csv               # async
```

### 6.3 Reservations

```
GET    /api/{date}/stock-reservations                    # filterable by variant/cart/order
POST   /api/{date}/stock-reservations                    # manual reservation
DELETE /api/{date}/stock-reservations/{id}                # release
POST   /api/{date}/stock-reservations/{id}:extend         # bump expires_at
```

### 6.4 Movements (ledger)

```
GET    /api/{date}/stock-movements                       # paginated, filterable
GET    /api/{date}/stock-movements/{id}
GET    /api/{date}/stock-movements:by-reference?reference_type=order&reference_id=...
```

(Žádný POST přímo — movements se vytváří via `:adjust` nebo systémovými flowy.)

### 6.5 Transfers (v1.0+)

```
POST   /api/{date}/stock-transfers                       # create transfer (Q from wh A to wh B)
GET    /api/{date}/stock-transfers
GET    /api/{date}/stock-transfers/{id}
POST   /api/{date}/stock-transfers/{id}:complete         # destination wh confirms receive
POST   /api/{date}/stock-transfers/{id}:cancel
```

### 6.6 Counts

```
POST   /api/{date}/inventory-counts                       # create draft
PATCH  /api/{date}/inventory-counts/{id}
GET    /api/{date}/inventory-counts/{id}
POST   /api/{date}/inventory-counts/{id}:start            # status=in_progress, snapshot expected
PATCH  /api/{date}/inventory-counts/{id}/lines/{line_id}  # set counted_quantity
POST   /api/{date}/inventory-counts/{id}:complete         # apply discrepancies as movements
POST   /api/{date}/inventory-counts/{id}:cancel
GET    /api/{date}/inventory-counts/{id}/lines
```

### 6.7 Storefront / public

```
GET    /api/{date}/storefront/inventory/check?variant_id=...&quantity=1
        Response: { variant_id, available, can_backorder, stock_status, eta_days }
GET    /api/{date}/storefront/products/{slug}/availability
        Response: per-variant availability summary
```

### 6.8 Example: Adjust stock

```http
POST /api/2026-05-19/stock-levels:adjust HTTP/1.1
Authorization: Bearer sk_live_...
Content-Type: application/json
Idempotency-Key: ...

{
  "variant_id": "prd_var_aB3cD",
  "warehouse_id": "wh_main",
  "quantity_delta": 50,
  "reason": "receive",
  "reference_type": "purchase_order",
  "reference_id": "po_xy789",
  "unit_cost": { "amount": 25000, "currency": "CZK" },
  "notes": "PO #2026-0042 from Innogy"
}
```

```http
HTTP/1.1 200 OK

{
  "data": {
    "movement_id": "01927bcd-...",
    "stock_level": {
      "variant_id": "prd_var_aB3cD",
      "warehouse_id": "wh_main",
      "on_hand": 150,
      "reserved": 12,
      "available": 138,
      "incoming": 0
    },
    "movement": {
      "quantity_delta": 50,
      "reason": "receive",
      "resulting_on_hand": 150,
      "occurred_at": "2026-05-19T14:30:00Z"
    }
  }
}
```

### 6.9 Example: Bulk adjust

```http
POST /api/2026-05-19/stock-levels:adjust-bulk HTTP/1.1
Idempotency-Key: ...

{
  "movements": [
    { "variant_id": "...", "warehouse_id": "...", "quantity_delta": -2, "reason": "damage", "notes": "broken on shelf" },
    { "variant_id": "...", "warehouse_id": "...", "quantity_delta": +10, "reason": "receive", "reference_type": "purchase_order", "reference_id": "..." }
  ],
  "transactional": true     // all-or-nothing
}
```

Response 207 Multi-Status (jako bulk pattern v `04 §18`).

### 6.10 Example: Storefront check

```http
GET /api/2026-05-19/storefront/inventory/check?variant_id=prd_var_aB&quantity=3 HTTP/1.1
```

```jsonc
HTTP/1.1 200 OK
Cache-Control: private, max-age=30

{
  "data": {
    "variant_id": "prd_var_aB",
    "warehouse_aggregated": {
      "on_hand": 120,
      "reserved": 8,
      "available": 112,
      "stock_status": "in_stock"
    },
    "can_fulfill_quantity": 3,
    "can_backorder": false,
    "backorder_eta_days": null,
    "preorder_release_date": null,
    "max_per_order": null
  },
  "meta": {
    "as_of": "2026-05-19T14:30:00.123Z",
    "request_id": "req_..."
  }
}
```

### 6.11 Example: Insufficient stock error

```http
POST /api/2026-05-19/carts/crt_aB/items HTTP/1.1
{
  "variant_id": "prd_var_xyz",
  "quantity": 100
}
```

```http
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/problem+json

{
  "type": "https://docs.shopio.com/errors/stock-insufficient",
  "title": "Insufficient stock",
  "status": 422,
  "code": "STOCK_INSUFFICIENT",
  "detail": "Variant prd_var_xyz has only 12 units available; 100 requested.",
  "instance": "/api/2026-05-19/carts/crt_aB/items",
  "errors": [
    {
      "code": "STOCK_INSUFFICIENT",
      "path": "quantity",
      "context": {
        "variant_id": "prd_var_xyz",
        "requested": 100,
        "available": 12,
        "can_backorder": false
      }
    }
  ]
}
```

---

## 7. GraphQL schema

```graphql
type Warehouse implements Node & Timestamped {
  id: ID!
  pubId: String!
  code: String!
  name: String!
  kind: WarehouseKind!
  address: Address
  isDefault: Boolean!
  isActive: Boolean!
  pickupEnabled: Boolean!
  priority: Int!
  cutoffTime: String                    # "16:00"
  timezone: String
  operatingHours: JSON
  createdAt: DateTime!
  updatedAt: DateTime!
}
enum WarehouseKind { PHYSICAL VIRTUAL DROPSHIP PICKUP_POINT EXTERNAL }

type InventoryItem implements Node {
  id: ID!
  variant: ProductVariant!
  trackingMode: InventoryTrackingMode!
  safetyStock: Int!
  reorderPoint: Int
  reorderQuantity: Int
  leadTimeDays: Int
  backorderEtaDays: Int
  preorderReleaseDate: Date
  maxPerOrder: Int
  inventoryCost: Money
  stockLevels: [StockLevel!]!           # all warehouses
  aggregatedStock: AggregatedStock!     # sum across warehouses
}
enum InventoryTrackingMode { TRACKED NOT_TRACKED BACKORDER_ALLOWED PREORDER_ONLY }

type StockLevel {
  id: ID!
  inventoryItem: InventoryItem!
  warehouse: Warehouse!
  onHand: Int!
  reserved: Int!
  available: Int!
  incoming: Int!
  lastCountedAt: DateTime
  lastMovementAt: DateTime
}

type AggregatedStock {
  onHand: Int!
  reserved: Int!
  available: Int!
  incoming: Int!
  stockStatus: StockStatus!
  canBackorder: Boolean!
  backorderEtaDays: Int
}
enum StockStatus {
  IN_STOCK
  LOW_STOCK
  OUT_OF_STOCK
  BACKORDER
  PREORDER
}

type StockReservation implements Node {
  id: ID!
  variant: ProductVariant!
  warehouse: Warehouse!
  quantity: Int!
  kind: StockReservationKind!
  cart: Cart
  order: Order
  reason: String
  expiresAt: DateTime
  releasedAt: DateTime
  releasedReason: String
  createdAt: DateTime!
}
enum StockReservationKind { CART ORDER MANUAL TRANSFER ALLOCATION_HOLD }

type StockMovement implements Node {
  id: ID!
  variant: ProductVariant!
  warehouse: Warehouse!
  quantityDelta: Int!
  reason: StockMovementReason!
  referenceType: String
  referenceId: ID
  unitCost: Money
  resultingOnHand: Int!
  actorKind: ActorKind!
  actor: Actor
  notes: String
  occurredAt: DateTime!
}
enum StockMovementReason {
  SALE
  RETURN
  ADJUSTMENT_POSITIVE
  ADJUSTMENT_NEGATIVE
  TRANSFER_IN
  TRANSFER_OUT
  RECEIVE
  DAMAGE
  SHRINKAGE
  COUNT_CORRECTION
  INITIAL_LOAD
  RESERVATION_RELEASE
  MANUAL_OTHER
}

# Cross-domain: ProductVariant.inventory resolves to InventoryView for storefront
type InventoryView {
  stockStatus: StockStatus!
  available: Int                        # nullable — hidden on FREE tier for privacy
  canBackorder: Boolean!
  backorderEtaDays: Int
  preorderReleaseDate: Date
  isLowStock: Boolean!
  maxPerOrder: Int
}

extend type Query {
  warehouses(first: Int, after: String): WarehouseConnection!
  warehouse(id: ID, code: String): Warehouse
  inventoryItem(id: ID, variantId: ID): InventoryItem
  stockLevels(variantId: ID, warehouseId: ID, lowStockOnly: Boolean): [StockLevel!]!
  stockReservations(variantId: ID, cartId: ID, orderId: ID, includeReleased: Boolean = false): [StockReservation!]!
  stockMovements(
    variantId: ID, warehouseId: ID,
    reason: [StockMovementReason!],
    occurredAfter: DateTime, occurredBefore: DateTime,
    first: Int = 50, after: String
  ): StockMovementConnection!
  inventoryAvailability(variantId: ID!, quantity: Int = 1): InventoryAvailability!
}

type InventoryAvailability {
  variantId: ID!
  available: Int!
  canFulfillQuantity: Int!
  canBackorder: Boolean!
  backorderEtaDays: Int
  preorderReleaseDate: Date
  warehouses: [WarehouseAvailability!]!
  asOf: DateTime!
}
type WarehouseAvailability {
  warehouse: Warehouse!
  available: Int!
  canPickup: Boolean!
}

extend type Mutation {
  createWarehouse(input: WarehouseInput!): Warehouse!
    @auth(requires: PERM_WAREHOUSE_MANAGE)
  updateWarehouse(id: ID!, input: WarehouseUpdateInput!): Warehouse!
    @auth(requires: PERM_WAREHOUSE_MANAGE)
  setDefaultWarehouse(id: ID!): Warehouse!
    @auth(requires: PERM_WAREHOUSE_MANAGE)

  updateInventoryItem(id: ID!, input: InventoryItemUpdateInput!): InventoryItem!
    @auth(requires: PERM_INVENTORY_MANAGE)

  adjustStock(input: StockAdjustInput!): StockLevel!
    @auth(requires: PERM_INVENTORY_ADJUST)
  adjustStockBulk(movements: [StockAdjustInput!]!, transactional: Boolean = true): [StockAdjustResult!]!
    @auth(requires: PERM_INVENTORY_ADJUST)

  createStockReservation(input: ReservationInput!): StockReservation!
    @auth(requires: PERM_INVENTORY_MANAGE)
  releaseStockReservation(id: ID!, reason: String): StockReservation!
    @auth(requires: PERM_INVENTORY_MANAGE)
  extendStockReservation(id: ID!, newExpiresAt: DateTime!): StockReservation!
    @auth(requires: PERM_INVENTORY_MANAGE)

  createStockTransfer(input: StockTransferInput!): StockTransfer!
    @auth(requires: PERM_INVENTORY_TRANSFER)

  startInventoryCount(input: InventoryCountInput!): InventoryCount!
    @auth(requires: PERM_INVENTORY_COUNT)
  completeInventoryCount(id: ID!): InventoryCount!
    @auth(requires: PERM_INVENTORY_COUNT)
}

input StockAdjustInput {
  variantId: ID!
  warehouseId: ID!
  quantityDelta: Int!
  reason: StockMovementReason!
  referenceType: String
  referenceId: ID
  unitCost: MoneyInput
  notes: String
}
```

---

## 8. Events

| Build-spec ID | Wire | Payload |
|---|---|---|
| `EVENT-WAREHOUSE-CREATED` | `warehouse.created` | `{ warehouse }` |
| `EVENT-WAREHOUSE-UPDATED` | `warehouse.updated` | `{ warehouse, previous_attributes }` |
| `EVENT-WAREHOUSE-DEACTIVATED` | `warehouse.deactivated` | `{ warehouse_id }` |
| `EVENT-STOCK-LEVEL-CHANGED` | `stock.level_changed` | `{ variant_id, warehouse_id, on_hand, reserved, available, previous: { on_hand, available }}` |
| `EVENT-STOCK-MOVEMENT-RECORDED` | `stock.movement_recorded` | `{ movement }` |
| `EVENT-STOCK-RESERVATION-CREATED` | `stock.reservation_created` | `{ reservation }` |
| `EVENT-STOCK-RESERVATION-RELEASED` | `stock.reservation_released` | `{ reservation_id, variant_id, warehouse_id, quantity, reason }` |
| `EVENT-STOCK-LOW-DETECTED` | `stock.low_detected` | `{ variant_id, warehouse_id, available, safety_stock, reorder_point }` |
| `EVENT-STOCK-OUT-DETECTED` | `stock.out_detected` | `{ variant_id, warehouse_id }` |
| `EVENT-STOCK-RESTOCKED` | `stock.restocked` | `{ variant_id, warehouse_id, available, was_backorder: bool }` |
| `EVENT-INVENTORY-COUNT-STARTED` | `inventory_count.started` | `{ count }` |
| `EVENT-INVENTORY-COUNT-COMPLETED` | `inventory_count.completed` | `{ count, total_discrepancies, applied_movement_ids }` |
| `EVENT-STOCK-TRANSFER-CREATED` | `stock_transfer.created` | `{ transfer }` |
| `EVENT-STOCK-TRANSFER-COMPLETED` | `stock_transfer.completed` | `{ transfer }` |

**Konzumenti:**
- **Search indexer** (`08`) — patch `stock_status`, `available`, `in_stock_variant_count` fields v Meilisearch documentu
- **Cache invalidator** — purge `product:{id}` + `inventory:{variant_id}` keys
- **Customer notifications** — `EVENT-STOCK-RESTOCKED` triggers "back in stock" email pro customer waitlist
- **Admin notifications** — `EVENT-STOCK-LOW-DETECTED` + `OUT-DETECTED` → admin dashboard / email
- **Webhook delivery** — per merchant subscription
- **ERP/WMS integrations** — bidirectional sync (Pohoda, SAP, ...)

**Debouncing pravidla:**
- `EVENT-STOCK-LEVEL-CHANGED` debounced 30s na search indexer (avoid storm při bulk import)
- Low/Out detection: prevent duplicate notifications — emit jen na transition `in_stock → low_stock`, `low_stock → out_of_stock`, ne každý drop

---

## 9. Background jobs

| Job | Trigger | Queue | Frequency |
|---|---|---|---|
| `JOB-SWEEP-EXPIRED-RESERVATIONS` | scheduled | `inventory-sweeper` | Every minute |
| `JOB-DETECT-LOW-STOCK` | EVENT-STOCK-LEVEL-CHANGED (debounced 5m per variant) | `inventory-alerts` | On-demand |
| `JOB-DETECT-RESTOCK` | EVENT-STOCK-LEVEL-CHANGED | `inventory-alerts` | On-demand |
| `JOB-NOTIFY-BACK-IN-STOCK` | EVENT-STOCK-RESTOCKED | `notifications` | On-demand |
| `JOB-INDEX-PATCH-STOCK` | EVENT-STOCK-LEVEL-CHANGED (debounced 30s) | `search-index` | On-demand |
| `JOB-RECONCILE-STOCK-LEDGER` | scheduled | `integrity-checks` | Daily 04:00 |
| `JOB-INVENTORY-COUNT-APPLY` | inventory_count completed | `inventory` | On-demand |
| `JOB-INVENTORY-COUNT-EXPORT` | manual API call | `exports` | On-demand |
| `JOB-IMPORT-STOCK-CSV` | manual API call | `imports` | On-demand |
| `JOB-EXPORT-STOCK-CSV` | manual API call | `exports` | On-demand |
| `JOB-WAREHOUSE-PROXIMITY-RECALC` (v1.0+) | warehouse address update | `geo-calc` | On-demand |
| `JOB-ERP-SYNC-STOCK` | scheduled (ERP polling) nebo webhook | `integrations` | Hourly (configurable) |
| `JOB-FORECAST-DEMAND` (v3.0+) | scheduled | `ai-tasks` | Daily |
| `CRON-CHECK-PREORDER-RELEASE` | scheduled | `scheduler` | Hourly |
| `CRON-REORDER-POINT-ALERT-DIGEST` | scheduled | `notifications` | Daily 09:00 |

### 9.1 JOB-SWEEP-EXPIRED-RESERVATIONS detail

```
Steps:
  1. SELECT id, variant_id, warehouse_id, quantity FROM stock_reservations
     WHERE released_at IS NULL AND expires_at <= now()
     ORDER BY expires_at ASC LIMIT 1000;
  2. For each reservation (batch atomic transactions, 50 per batch):
     a. Acquire advisory lock (variant_id, warehouse_id)
     b. UPDATE stock_reservations SET released_at=now(), released_reason='expired' WHERE id=...
     c. UPDATE stock_levels SET reserved = reserved - quantity WHERE variant_id=... AND warehouse_id=...
     d. INSERT outbox_events EVENT-STOCK-RESERVATION-RELEASED + EVENT-STOCK-LEVEL-CHANGED
  3. Log batch stats (total released, total qty freed)
```

**Throughput target:** 1000+ reservations/sec sweepable (bulk transaction batching).

### 9.2 JOB-RECONCILE-STOCK-LEDGER detail

Daily integrity check: ověřit, že sum movements = current on_hand.

```sql
WITH ledger AS (
  SELECT variant_id, warehouse_id, SUM(quantity_delta) AS computed_on_hand
  FROM stock_movements
  WHERE tenant_id = $1
  GROUP BY variant_id, warehouse_id
)
SELECT sl.variant_id, sl.warehouse_id, sl.on_hand, l.computed_on_hand,
       sl.on_hand - l.computed_on_hand AS drift
FROM stock_levels sl
JOIN ledger l USING (variant_id, warehouse_id)
WHERE sl.on_hand <> l.computed_on_hand AND sl.tenant_id = $1;
```

Drift > 0 → admin alert + automated remediation (insert reconciliation movement).

### 9.3 JOB-INDEX-PATCH-STOCK detail

Lightweight Meilisearch document patch (jen stock fields):

```jsonc
PATCH /indexes/products:{tenant}:{locale}/documents/{product_id}
{
  "stock_status": "in_stock",
  "in_stock_variant_count": 3,
  "available_colors": ["white", "black"]   // recomputed z active variants
}
```

Debounced 30s per `(tenant, product_id)` aby flash sale s tisícem updates nezahltil Meilisearch.

---

## 10. UI/UX flows

### FLOW-INV-001: Stock adjustment (admin)

```
[Product detail → Inventory tab]
   - Per-variant stock breakdown per warehouse table
        │
   click "Adjust" on row
        │
        ▼
[Adjust modal]
   - Current on_hand: 120
   - Adjustment: [+ / −] [number input]
   - Reason: dropdown (receive, damage, shrinkage, ...)
   - Reference: optional PO number / notes
   - Cost: optional, defaults from variant
        │
   click Apply
        │
        ▼
[POST /stock-levels:adjust → atomic transaction]
   - Optimistic UI update + spinner
   - On success: refresh row + movement appears in "Recent movements" timeline
   - On fail (e.g., negative): toast + revert UI
```

### FLOW-INV-002: Low stock alert (admin)

```
[Dashboard widget: "Low stock alerts (12)"]
   click widget
        │
        ▼
[Low stock report]
   - Table: variant | warehouse | on_hand | reserved | available | safety_stock | reorder_qty | last_movement
   - Bulk select → "Create PO draft" (v1.0+ feature)
   - Per row: "Adjust", "Set new reorder point", "Mute alert"
```

### FLOW-INV-003: Physical inventory count

```
[Inventory → Counts → New count]
        │
        ▼
[Count wizard]
   Step 1: Select kind (full, cycle, spot) + warehouse
   Step 2: Select scope (all variants / by category / by location / specific SKUs / from import CSV)
   Step 3: Generate count sheet → status='draft'
        │
   click "Start counting"
        │
        ▼
[status='in_progress', expected_quantity snapshot taken]
   - Mobile-friendly count interface
   - Scan barcode → row selected → input counted_quantity
   - Or upload CSV: SKU,counted_qty
   - Discrepancy column live computed
        │
   click "Complete count"
        │
        ▼
[Confirmation modal]
   - Total discrepancy: +12 / −47
   - Will apply 35 stock_movements (count_correction)
        │
   confirm
        │
        ▼
[status='completed', JOB-INVENTORY-COUNT-APPLY runs]
   - Movements applied
   - Discrepancy report exportable PDF/CSV
```

### FLOW-INV-004: Customer back-in-stock notify (storefront)

```
[Product page, variant out of stock]
   - Stock badge: "Out of stock"
   - "Notify me when available" button
        │
   click → modal: enter email + optional SMS opt-in
        │
        ▼
[Create back_in_stock_subscriptions row]
   (separátní tabulka, je v 19-marketing-seo.md nebo 06)
        │
   ... (later, restock event) ...
        │
        ▼
[EVENT-STOCK-RESTOCKED → JOB-NOTIFY-BACK-IN-STOCK]
   - Email/SMS sent to subscribers
   - Subscription marked notified_at + auto-expires
```

### FLOW-INV-005: ERP sync flow

```
External ERP (Pohoda, SAP, ...)
   └─► Webhook → POST /api/{date}/integrations/{provider}/stock-update
        │ Payload: { sku, quantity, warehouse_code, reason }
        ▼
[Authenticated integration endpoint]
   - Validate signature
   - Resolve variant_id from SKU
   - Apply stock adjust (idempotent via external_ref)
        │
        ▼
[Update applied, EVENT-STOCK-LEVEL-CHANGED emitted]
```

Reverse direction: outgoing webhook on `EVENT-STOCK-LEVEL-CHANGED` → ERP receives.

---

## 11. Edge cases & error handling

| Scenario | Behavior | Code |
|---|---|---|
| Cart add when variant out of stock, backorder disabled | Reject | `STOCK_INSUFFICIENT`, 422 |
| Cart add when backorder enabled | Allow, available may go negative | (success) |
| Race: 2 concurrent cart adds with last 1 in stock | Advisory lock serializes; one succeeds, one gets 422 | (handled) |
| Reservation expire while in checkout step | Detect mid-checkout, re-attempt reservation; if still insufficient → 422 with cart state | (handled, retry) |
| Order cancellation during fulfillment (already shipped) | Cannot fully reverse; only refund flow, no stock restore | (handled in 16) |
| Adjust quantity_delta = 0 | Reject | `INVALID_DELTA`, 422 |
| Adjust making on_hand negative (tracked mode) | Reject | `STOCK_WOULD_GO_NEGATIVE`, 422 |
| Bulk adjust with mixed success | 207 Multi-Status with per-row results | (handled) |
| Bulk adjust transactional=true with any failure | Roll back all | `BULK_OPERATION_FAILED`, 422 |
| Delete warehouse with non-zero stock | Reject; suggest transfer first | `WAREHOUSE_HAS_STOCK`, 422 |
| Delete default warehouse | Reject | `CANNOT_DELETE_DEFAULT_WAREHOUSE`, 422 |
| Set default warehouse: another already default | Auto-unset previous in same Tx | (success) |
| Inventory count line counted_quantity < 0 | Reject | `INVALID_COUNT_VALUE`, 422 |
| Inventory count completed without all lines counted | Optionally apply only counted; warning | (configurable; default: require all) |
| External ERP sends stock for unknown SKU | Log + return 422 + admin alert | `SKU_NOT_FOUND`, 422 |
| External ERP duplicate webhook (same external_ref) | Idempotent: detect & skip | (success, no-op) |
| Reservation extend past max TTL (24h cap) | Reject | `RESERVATION_TTL_EXCEEDED`, 422 |
| Stock movement timestamp in future | Reject (clock skew safeguard) | `INVALID_TIMESTAMP`, 422 |
| Stock movement timestamp older than 1 year | Allow but flag (rare; usually only for migration) | (success with warning) |
| Multi-source allocation: no warehouse can fulfill | Backorder if enabled else 422 | (handled per RULE-INV-012) |
| Concurrent inventory count + adjustment | Adjustment applies normally; count discrepancy reflects post-adjustment state | (eventual consistency) |
| Preorder customer attempts to checkout before release date | Order placed but fulfillment held | (handled per RULE-INV-008) |
| Variant deleted while reservations active | Cascade release (DELETE reservation rows) | (handled by FK ON DELETE) |
| Stock import CSV with invalid SKUs | Per-row validation; report errors | (handled in JOB-IMPORT-STOCK-CSV) |

---

## 12. Performance

### 12.1 Targets

| Operation | p50 | p95 | p99 |
|---|---|---|---|
| `GET /storefront/inventory/check` | 5 ms | 15 ms | 40 ms |
| `POST /stock-levels:adjust` (single) | 15 ms | 40 ms | 100 ms |
| `POST /stock-levels:adjust-bulk` (50 movements transactional) | 100 ms | 300 ms | 600 ms |
| Cart add (with reservation create) | 20 ms | 60 ms | 150 ms |
| `JOB-SWEEP-EXPIRED-RESERVATIONS` (1000 reservations) | 500 ms | 2000 ms | 5000 ms |
| `JOB-INDEX-PATCH-STOCK` per variant | 10 ms | 30 ms | 80 ms |
| `JOB-RECONCILE-STOCK-LEDGER` per tenant (1M movements) | 5 s | 20 s | 60 s |

### 12.2 Optimization

- **Advisory locks** ne row locks — locks osvobozené po Tx commit, nezablokují readers
- **Generated column `available`** — žádný compute v query, indexovatelné
- **Outbox + debounced indexing** — 30s debounce per variant, batch upserts do Meilisearch
- **Stock check cache:** Redis L4 cache pro `stock_status` per variant (TTL 30s, invalidated by event)
- **Partition stock_movements** monthly — staré data BRIN-indexed, neúčastní se hot queries
- **DataLoader v GraphQL** pro batched stock_levels fetch per product list page
- **Reservation cleanup:** ne každá minuta sweepem celé tabulky — index `(expires_at) WHERE released_at IS NULL` umožňuje selektivní lookup

### 12.3 Hot path queries

```sql
-- Cart add: check + reserve atomic
BEGIN;
  SELECT pg_advisory_xact_lock(hashtext('inv:' || $variant_id || ':' || $warehouse_id)::bigint);
  
  SELECT on_hand, reserved, available
  FROM stock_levels
  WHERE variant_id = $1 AND warehouse_id = $2
  FOR UPDATE;
  -- Validate available >= requested
  
  INSERT INTO stock_reservations (...) VALUES (...);
  UPDATE stock_levels SET reserved = reserved + $qty WHERE ...;
COMMIT;
-- Uses uq_stock_levels unique constraint + advisory lock
```

```sql
-- Storefront stock status (cached, very hot)
SELECT
  COALESCE(SUM(sl.available), 0) AS total_available,
  ii.tracking_mode,
  ii.backorder_eta_days,
  ii.safety_stock,
  ii.preorder_release_date
FROM inventory_items ii
LEFT JOIN stock_levels sl ON sl.inventory_item_id = ii.id
  AND sl.warehouse_id IN (SELECT id FROM warehouses WHERE tenant_id = $1 AND is_active = true AND is_fulfilling = true)
WHERE ii.variant_id = $variant_id AND ii.tenant_id = $1
GROUP BY ii.tracking_mode, ii.backorder_eta_days, ii.safety_stock, ii.preorder_release_date;
```

### 12.4 Concurrency safety patterns

**Pessimistic via advisory locks:**
```typescript
async function reserveStock(tx, variantId, warehouseId, qty) {
  // Advisory lock automatically released at tx commit
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'inv:' + variantId + ':' + warehouseId})::bigint)`);
  
  const current = await tx.execute(sql`SELECT on_hand, reserved FROM stock_levels WHERE variant_id = ${variantId} AND warehouse_id = ${warehouseId} FOR UPDATE`);
  
  if (current.on_hand - current.reserved < qty && !canBackorder) {
    throw new StockInsufficientError({ available: current.on_hand - current.reserved, requested: qty });
  }
  
  await tx.execute(sql`UPDATE stock_levels SET reserved = reserved + ${qty}, version = version + 1 WHERE variant_id = ${variantId} AND warehouse_id = ${warehouseId}`);
  // Insert reservation row, insert movement (if applicable), insert outbox event
}
```

**Optimistic via version (for non-critical updates like safety_stock):**
```typescript
await tx.execute(sql`UPDATE inventory_items SET safety_stock = ${newValue}, version = version + 1 WHERE id = ${id} AND version = ${expectedVersion}`);
// affected_rows = 0 → conflict → throw
```

---

## 13. Security

### 13.1 Permissions

```
PERM-WAREHOUSE-MANAGE
PERM-INVENTORY-VIEW
PERM-INVENTORY-ADJUST
PERM-INVENTORY-MANAGE         # tracking_mode, safety_stock, reorder_point
PERM-INVENTORY-TRANSFER
PERM-INVENTORY-COUNT
PERM-INVENTORY-SAFETY-STOCK-MANAGE
PERM-INVENTORY-VIEW-COST       # cost-sensitive field (inventory valuation)
```

### 13.2 Storefront exposure

- Storefront returns `stock_status` enum (always) and `available` integer (configurable per tenant — Free tier always shows specific count, Enterprise může hide exact qty pro "competitive secrecy" use cases)
- Žádná exposure `reserved`, `on_hand` rozlišení storefrontu — anonymous customer vidí jen aggregated `available`
- Per-warehouse breakdown jen authenticated admin context

### 13.3 Cost field protection

`inventory_cost_amount` + `unit_cost_amount` v movements — sensitive (purchasing intelligence). Hidden v default views; vyžaduje `PERM-INVENTORY-VIEW-COST`.

### 13.4 Audit

- 100% audit log entries pro stock adjustments
- 100% audit log entries pro warehouse management
- Sample 10% audit log pro reads (storefront stock check) — high volume

### 13.5 Rate limits

| Endpoint | Free | Pro |
|---|---|---|
| `GET /storefront/inventory/check` | 60/min/IP | 1500/min/IP |
| `POST /stock-levels:adjust` | 60/min | 600/min |
| `POST /stock-levels:adjust-bulk` | 10/min | 60/min |
| `POST /stock-levels:import-csv` | 1/hour | 12/hour |
| ERP integration webhook | 600/min per API key | 6000/min |

### 13.6 GDPR

- `stock_reservations.reserved_by_actor_id` — pokud customer, cascade delete při right-to-erasure (reservation row anonymized: actor_id=NULL)
- `stock_movements.actor_id` — keep (audit retention), but if customer deleted, anonymize after grace period

---

## 14. Testing

### 14.1 Unit

```
TEST-UNIT-INV-001  StockMovementApplicator — apply + reject negative
TEST-UNIT-INV-002  StockStatusDeriver — všechny enum branches
TEST-UNIT-INV-003  ReservationTTLCalculator — sliding extend
TEST-UNIT-INV-004  AdvisoryLockKeyHasher — deterministic, no collisions across (variant, wh) pairs
TEST-UNIT-INV-005  AggregatedStockComputer — sum across warehouses
```

### 14.2 Integration (Postgres + Redis)

```
TEST-INT-INV-001   Create variant → inventory_item auto-created
TEST-INT-INV-002   Adjust receive → on_hand increases + movement recorded
TEST-INT-INV-003   Cart add → reservation created + reserved bumps
TEST-INT-INV-004   Cart abandon → sweeper releases after TTL
TEST-INT-INV-005   Order placed → reservation kind transitions to 'order' (no expiry)
TEST-INT-INV-006   Order fulfilled → movement reason='sale' + reservation released
TEST-INT-INV-007   Order cancelled → reservation released, no movement
TEST-INT-INV-008   Return restock → movement reason='return'
TEST-INT-INV-009   Backorder enabled → cart add succeeds at zero stock
TEST-INT-INV-010   Concurrent cart adds (50 parallel) — advisory lock serializes correctly
TEST-INT-INV-011   Concurrent adjust + cart add (race) — both apply atomically
TEST-INT-INV-012   Bulk adjust transactional — all-or-nothing
TEST-INT-INV-013   Inventory count complete → movements applied per discrepancy
TEST-INT-INV-014   Reconcile job detects drift + auto-corrects
TEST-INT-INV-015   ERP webhook idempotent — duplicate ref skipped
TEST-INT-INV-016   Multi-warehouse aggregation
TEST-INT-INV-017   Outbox event written in same Tx as movement
TEST-INT-INV-018   Reservation extend bumps expires_at
TEST-INT-INV-019   Cart deletion → cascade reservation release
TEST-INT-INV-020   Preorder hold during fulfillment
```

### 14.3 E2E

```
TEST-E2E-INV-001  Admin adjust stock from product detail
TEST-E2E-INV-002  Customer cart add when 1 left → success
TEST-E2E-INV-003  2 customers race for last item — one succeeds, one sees "out of stock"
TEST-E2E-INV-004  Customer subscribes to back-in-stock notification
TEST-E2E-INV-005  Admin completes inventory count
TEST-E2E-INV-006  Bulk CSV stock import
```

### 14.4 Load (k6)

```
TEST-LOAD-INV-001  1000 concurrent cart adds on hot variant — no oversell, throughput >= 200 ops/sec
TEST-LOAD-INV-002  Reservation sweeper handles 100k expired reservations in < 60s
TEST-LOAD-INV-003  Stock indexer keeps up with 1000 updates/sec
TEST-LOAD-INV-004  ERP bulk sync 10k SKUs in < 30s
```

### 14.5 Chaos / failure modes

```
TEST-CHAOS-INV-001  Postgres restart mid-Tx → no partial state (atomic guarantee)
TEST-CHAOS-INV-002  Redis BullMQ outage → outbox holds events, replays on recovery
TEST-CHAOS-INV-003  Webhook delivery failure → retry per delivery policy
TEST-CHAOS-INV-004  Meilisearch unavailable → search indexer queues events, replays on recovery
```

---

## 15. Implementation checklist

### Backend
- [ ] **[S]** Drizzle schema `packages/db/src/schema/inventory/*.ts`
- [ ] **[S]** Migrace `20260523_001_create_inventory_tables.sql` + partitions + indexes + triggers
- [ ] **[S]** Seed: default warehouse per tenant při onboarding
- [ ] **[L]** `InventoryService` — adjust, reserve, release, transfer (advisory locking, atomic Tx)
- [ ] **[M]** `WarehouseService` — CRUD + default management
- [ ] **[S]** `StockStatusDeriver` — pure function pro denormalized field
- [ ] **[S]** `ReservationManager` — TTL extend, release, conversion
- [ ] **[M]** `InventoryCountService` — count lifecycle + apply
- [ ] **[S]** `StockMovementApplicator` — write ledger + apply aggregate (atomic)
- [ ] **[M]** REST endpoints per §6
- [ ] **[M]** GraphQL types + resolvers + DataLoaders (per-product stock aggregation)
- [ ] **[S]** tRPC router (admin)
- [ ] **[M]** MCP tool `inventory.check_availability`
- [ ] **[S]** Storefront-facing `InventoryView` resolver (privacy-aware)
- [ ] **[S]** Triggers: `tg_variants_after_insert_create_inventory_item`, `tg_inventory_counts_complete_apply`

### Background jobs
- [ ] **[L]** JOB-SWEEP-EXPIRED-RESERVATIONS — batched, advisory locks
- [ ] **[S]** JOB-DETECT-LOW-STOCK — threshold + dedupe
- [ ] **[S]** JOB-DETECT-RESTOCK — transition detection
- [ ] **[M]** JOB-NOTIFY-BACK-IN-STOCK — query subscription list, send notifications
- [ ] **[S]** JOB-INDEX-PATCH-STOCK — Meilisearch patch
- [ ] **[M]** JOB-RECONCILE-STOCK-LEDGER — ledger consistency
- [ ] **[M]** JOB-INVENTORY-COUNT-APPLY — atomic batch apply
- [ ] **[M]** JOB-IMPORT-STOCK-CSV — streaming, idempotent
- [ ] **[S]** JOB-EXPORT-STOCK-CSV
- [ ] **[S]** CRON-CHECK-PREORDER-RELEASE
- [ ] **[S]** CRON-REORDER-POINT-ALERT-DIGEST

### Frontend — Admin
- [ ] **[L]** Inventory page (per-variant table, filters: low-stock, out-of-stock, by warehouse)
- [ ] **[M]** Adjust stock modal (single + bulk)
- [ ] **[L]** Inventory count wizard (mobile-friendly, barcode scan)
- [ ] **[M]** Warehouse management page
- [ ] **[M]** Stock movements timeline (per variant)
- [ ] **[S]** Low stock alert dashboard widget
- [ ] **[S]** Stock CSV import wizard
- [ ] **[S]** Cost field visibility toggle (permission-gated)

### Frontend — Storefront
- [ ] **[S]** Stock badge component (`in_stock`, `low_stock`, `out_of_stock`, `backorder`, `preorder`)
- [ ] **[S]** "Notify me" back-in-stock subscription button + modal
- [ ] **[S]** Preorder banner with release date countdown
- [ ] **[S]** Pickup-in-store availability indicator (BOPIS, v1.0+)

### Tests
- [ ] **[M]** Per §14
- [ ] **[S]** Chaos tests in CI nightly

### Docs
- [ ] **[S]** "Managing inventory" merchant guide
- [ ] **[S]** "Running an inventory count" merchant guide
- [ ] **[S]** "Multi-source inventory setup" (v1.0+)
- [ ] **[S]** Developer docs: stock event hooks for plugins
- [ ] **[S]** Developer docs: ERP integration patterns

---

## 16. Open questions

### Q-INV-001: Reservation TTL strategy
**Otázka:** Default 30 min sliding extend pro cart. Alternativa: hard expiry (no extend) ke snížení reservation pressure.

**Status:** MVP: sliding extend default; per-tenant configurable `cart_reservation_ttl_seconds` + `cart_reservation_sliding`. Doplnit po pilot data.

### Q-INV-002: Backorder waitlist FIFO ordering
**Otázka:** Při restock, customer s prvním backorder dostane prioritu? Currently jen email notification, no auto-allocation.

**Status:** MVP: email blast all subscribers, no priority. v1.0+: configurable "FIFO allocation" — restock auto-creates reservations pro top N backorder orders.

### Q-INV-003: Pickup-in-store stock pool
**Otázka:** Storefront vidí "available in {warehouse} for pickup". Per-warehouse view vs aggregated?

**Status:** v1.0+ MSI feature. UI ukazuje per-warehouse availability v product detail s pickup_enabled filter.

### Q-INV-004: Demand forecasting AI
**Otázka:** Které features AI Copilot (v3.0+) řeší — reorder point auto-tuning, seasonal forecasting, dead stock detection?

**Status:** Out of scope MVP. Detail v `33-ai-features.md`.

### Q-INV-005: Negative stock during transition
**Otázka:** Při ERP migration nebo bulk import, on_hand může být počítané z movements. Co když user spustí import s "set absolute value" místo delta?

**Status:** API podporuje obě: `adjust` (delta) vs `set` (absolute, internally calculates delta). Set endpoint vyžaduje explicit `set_to_value` field, ne `quantity_delta`.

### Q-INV-006: Locked quantity in inventory_items
**Otázka:** Pro audited items (luxury, weapons, controlled substances) potřebujeme "locked qty" mimo reservations.

**Status:** v2.0+ regulated industries feature. MVP: použít `metadata.locked_quantity` JSONB + admin discipline.

### Q-INV-007: Stock allocation simulator
**Otázka:** Admin tool pro "what if" — simulate cart placement bez actual reservation.

**Status:** Out of scope MVP. Lze řešit přes `?dry_run=true` flag na storefront check endpoint.

### Q-INV-008: Cost method default
**Otázka:** FIFO vs Weighted Average jako default cost method?

**Status:** TBD per geography — CZ účetnictví preferuje FIFO; DE Weighted Average. Default: Weighted Average (industry standard pro e-commerce); merchant override v settings.

### Q-INV-009: Storefront available exact count
**Otázka:** Zobrazit přesný počet ("3 ks skladem") nebo jen status badge?

**Status:** Configurable per tenant + per channel. Default storefront ukazuje status + threshold low_stock badge; agent (MCP) dostává přesný integer. Detail v `26-themes-storefront.md`.

### Q-INV-010: Cross-tenant supplier inventory feed
**Otázka:** Dropship scenario — supplier provozuje vlastní platformu, posílá nám stock data per webhook. Stačí integrace nebo "virtual warehouse" model?

**Status:** Virtual warehouse model (`warehouses.kind='dropship'`) + ERP sync přes integration plugin. MVP: documented pattern, no first-party plugin. v1.0+ plugin marketplace listing.

---

## 📅 Změny

| Datum | Změna |
|---|---|
| 2026-05-19 | Initial — kompletní Inventory & Warehousing domain. MVP single-warehouse + MSI-ready schema. Advisory lock concurrency pattern, append-only ledger, sweeper-based reservation cleanup. |

---

**Konec Inventory & Warehousing.**

➡️ Pokračovat na: [`10-pricing-promotions.md`](10-pricing-promotions.md)
