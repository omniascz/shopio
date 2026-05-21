# 03 – DATA MODELS MASTER

> **Účel:** Kanonický katalog všech entit napříč platformou. Každá entita má unikátní ID `ENT-{DOMAIN}-{NNN}`, definované klíčové pole, vztahy a odkaz na doménový dokument, kde je detailně rozpracována.
>
> **Pravidlo:** Pokud je v doménovém dokumentu jiná definice než zde, **tento dokument vítězí**. Doménový dokument může entitu **rozšířit** (přidat pole, business rules, indexy), ale **nesmí měnit** sémantiku ani odebírat povinná pole.

**Datum:** 2026-05-19
**Verze:** 1.0
**Status:** 🟢 Foundation – schema base pro Fázi 0–1
**Reference:** [01-decisions-registry.md](01-decisions-registry.md) · [02-glossary.md](02-glossary.md) · [05-naming-conventions.md](05-naming-conventions.md)

---

## 📑 Obsah

1. [Konvence](#1-konvence)
2. [Cross-cutting (auditní) pole](#2-cross-cutting-auditní-pole)
3. [Platform-level entity (Tenant, User, Session, …)](#3-platform-level-entity)
4. [Catalog & PIM](#4-catalog--pim)
5. [Categories & Collections](#5-categories--collections)
6. [Inventory & Warehousing](#6-inventory--warehousing)
7. [Pricing, Promotions & Tax](#7-pricing-promotions--tax)
8. [Cart & Checkout](#8-cart--checkout)
9. [Orders, Payments, Shipments](#9-orders-payments-shipments)
10. [Returns & Refunds](#10-returns--refunds)
11. [Customers & B2B](#11-customers--b2b)
12. [Marketing, SEO & CMS](#12-marketing-seo--cms)
13. [Subscriptions](#13-subscriptions)
14. [Multistore & Channels](#14-multistore--channels)
15. [i18n & Currency](#15-i18n--currency)
16. [Marketplace (multi-vendor)](#16-marketplace-multi-vendor)
17. [Developer Platform (plugins, API, webhooks)](#17-developer-platform)
18. [AI & Agents](#18-ai--agents)
19. [Themes & Storefront customization](#19-themes--storefront-customization)
20. [Industry profiles](#20-industry-profiles)
21. [Audit, Notifikace, Background jobs](#21-audit-notifikace-background-jobs)
22. [Vztahy – high-level ER diagram](#22-vztahy--high-level-er-diagram)
23. [Indexy a performance hints](#23-indexy-a-performance-hints)
24. [Změny](#24-změny)

---

## 1. Konvence

### 1.1 Naming

- Tabulky: `snake_case`, plurál (`products`, `order_items`)
- Sloupce: `snake_case` (`created_at`, `tenant_id`, `total_amount`)
- ID sloupec: vždy `id`
- Foreign key: `{entity_singular}_id` (`product_id`, `tenant_id`)
- Boolean: prefix `is_`, `has_`, `can_` (`is_active`, `has_variants`, `can_backorder`)
- Timestamp: suffix `_at` (`created_at`, `published_at`, `archived_at`)
- Enum: PostgreSQL native enum nebo `text` + CHECK constraint (preferujeme CHECK pro snadnější migrace)
- Detail: `05-naming-conventions.md`

### 1.2 ID strategie (viz DEC-DB-003)

```
Interní PK:     UUID v7 (time-ordered, native PG 17)
Public API:     NanoID 12 chars pro pretty URLs (`pub_id`)
Order number:   custom formát `ORD-YYYY-NNNNNNNN` (sekvence per tenant per rok)
Invoice number: `INV-YYYY-NNNNNNNN` (zákonná sekvence per tenant)
SKU:            merchant-defined string, unique per tenant
Slug:           kebab-case, unique per (tenant_id, locale, entity_type)
```

### 1.3 Multi-tenancy (viz DEC-ARCH-004)

**Každá doménová tabulka má `tenant_id UUID NOT NULL`.**

Výjimky (platform-wide, žádný `tenant_id`):
- `tenants`
- `currencies` (referenční číselník)
- `countries`
- `tax_jurisdictions` (statický číselník EU/UK/CH/US)
- `plugin_registry` (marketplace katalog, ne instalace)

RLS policies napsané pro každou tabulku s `tenant_id`, ale **vypnuté v CE flagem** `ENABLE_RLS=false`. Aktivace ve Fázi 3 (Cloud SaaS).

### 1.4 Soft delete

Většina entit používá `deleted_at TIMESTAMPTZ NULL`. Při delete:
- DB řádek **zůstává** (audit, undo, foreign key integrity)
- Query musí filtrovat `deleted_at IS NULL` (řeší ORM scope helper)
- Hard delete jen přes scheduled job `JOB-PURGE-DELETED` po retention period (default 90 dní)

**Hard-delete entity** (žádný `deleted_at`):
- `sessions` (krátkodobé)
- `webhook_deliveries` (rotated)
- `audit_log` (immutable, append-only)
- `cart_items` (cart sám má `deleted_at`, items kaskádují)

### 1.5 Metadata (extensibility)

Každá kořenová entita (Product, Order, Customer, …) má `metadata JSONB DEFAULT '{}'::jsonb` pro plugin/merchant custom data. Žádné EAV tabulky.

Plugin registruje typovanou key spec přes `plugin-kit`, runtime validace přes Zod.

### 1.6 Měnové částky

- Uložené jako `bigint` v **minor unit** (centy, halíře) — žádný `decimal`, žádný `float`
- Sloupec: `{name}_amount bigint NOT NULL` + `{name}_currency char(3) NOT NULL` (ISO 4217)
- Příklad: `subtotal_amount bigint`, `subtotal_currency char(3)`
- Helper view může vrátit formatted string podle locale

### 1.7 Časové údaje

- Vše `TIMESTAMPTZ` (s timezone), uložené v UTC
- Display v lokále uživatele řeší frontend
- Datum bez času: `DATE` (např. `birth_date`)

### 1.8 Stavy a state machines

State enumy uloženy jako `text` s CHECK constraint, ne native enum (snadnější migrace).

```sql
status text NOT NULL CHECK (status IN ('draft','pending','paid','shipped','delivered','cancelled','refunded'))
```

Přechod stavů řízen v aplikaci (state machine v `packages/core/src/state-machines/`). Detail v doménových dokumentech.

---

## 2. Cross-cutting (auditní) pole

Každá doménová entita má **minimum**:

```
id              uuid PRIMARY KEY DEFAULT uuidv7()
tenant_id       uuid NOT NULL REFERENCES tenants(id)
created_at      timestamptz NOT NULL DEFAULT now()
updated_at      timestamptz NOT NULL DEFAULT now()   -- bumped přes trigger
deleted_at      timestamptz NULL                      -- soft delete
created_by      uuid NULL REFERENCES users(id)        -- kdo vytvořil (NULL = system/anonymous)
updated_by      uuid NULL REFERENCES users(id)
version         integer NOT NULL DEFAULT 1            -- optimistic locking
metadata        jsonb NOT NULL DEFAULT '{}'::jsonb    -- plugin/custom data
```

**Výjimky:** `tenants`, `currencies`, `countries`, `sessions`, `audit_log`, `webhook_deliveries`.

---

## 3. Platform-level entity

### ENT-TENANT-001 · `tenants`
Identita merchanta na platformě. V CE single-tenant = `DEFAULT_TENANT` seed.

| Pole | Typ | Pozn. |
|---|---|---|
| `id` | uuid PK | UUID v7 |
| `slug` | text UNIQUE | URL-safe (`my-shop`) |
| `name` | text | Display name |
| `status` | text | `active`, `suspended`, `deleted` |
| `plan_tier` | text | `community`, `starter`, `pro`, `enterprise` (DEC-BIZ-001) |
| `default_locale` | text | BCP-47 (`cs-CZ`) |
| `default_currency` | char(3) | ISO 4217 |
| `country_code` | char(2) | ISO 3166-1 (`CZ`) |
| `vat_id` | text | Volitelné, validováno přes VIES |
| `settings` | jsonb | Per-tenant config blob |
| `feature_flags` | jsonb | Override platform flags (Enterprise) |

**Vztahy:** rodič pro **každou** doménovou entitu. Doc: `22-multistore-channels.md`, `36-personas-rbac.md`.

---

### ENT-USER-001 · `users`
Backoffice uživatel (merchant staff, admin). **Není** customer.

| Pole | Typ | Pozn. |
|---|---|---|
| `email` | citext UNIQUE per tenant | |
| `password_hash` | text NULL | Argon2id (DEC-SEC-001) |
| `is_2fa_enabled` | boolean | TOTP nebo passkey |
| `totp_secret_encrypted` | bytea NULL | pgcrypto + Vault transit |
| `last_login_at` | timestamptz NULL | |
| `locked_until` | timestamptz NULL | Brute-force lockout |
| `default_locale` | text | UI jazyk uživatele |

**Vztahy:** N:M na `roles` přes `user_roles`. Doc: `27-admin-backoffice.md`, `36-personas-rbac.md`.

---

### ENT-USER-002 · `roles`
Sada permissions (RBAC).

| Pole | Typ | Pozn. |
|---|---|---|
| `name` | text | `owner`, `admin`, `manager`, `editor`, `viewer`, `custom-*` |
| `is_system` | boolean | System role nelze smazat ani upravit |
| `permissions` | text[] | Array `PERM-*` keys |

Doc: `36-personas-rbac.md`.

---

### ENT-USER-003 · `permissions` (referenční)
Read-only katalog permission keys (`PERM-PRODUCT-CREATE`, …). Generován z kódu, **ne** editovatelný v UI.

---

### ENT-USER-004 · `user_roles`
M:N join table. `(user_id, role_id, tenant_id)` UNIQUE.

---

### ENT-SESSION-001 · `sessions`
Backoffice session (cookie-based). **Hard delete** při logout/expire.

| Pole | Typ | Pozn. |
|---|---|---|
| `id` | uuid PK | Session token (httpOnly cookie) |
| `user_id` | uuid FK | |
| `expires_at` | timestamptz | TTL 7 dní idle / 30 dní absolute |
| `ip_address` | inet NULL | Pro fraud detection |
| `user_agent` | text NULL | |
| `revoked_at` | timestamptz NULL | Manuální revoke = nelze refresh |

Storage: Redis s mirror v Postgres pro audit. Doc: `30-security.md`.

---

### ENT-API-KEY-001 · `api_keys`
Long-lived API credentials pro integrace a plugins.

| Pole | Typ | Pozn. |
|---|---|---|
| `prefix` | text | Display prefix `sk_live_abcd` |
| `key_hash` | text | Argon2id hash (raw key se nikam neukládá) |
| `scopes` | text[] | `products:read`, `orders:write`, … |
| `expires_at` | timestamptz NULL | NULL = bez expirace |
| `last_used_at` | timestamptz NULL | |
| `rate_limit_tier` | text | `default`, `partner`, `enterprise` |

Doc: `28-developer-platform.md`, `30-security.md`.

---

## 4. Catalog & PIM

Doc: `06-catalog-pim.md`.

### ENT-PRODUCT-001 · `products`
Master produkt. Varianta drží SKU, sklad, cenu.

| Pole | Typ | Pozn. |
|---|---|---|
| `pub_id` | text UNIQUE per tenant | NanoID 12, public URL |
| `slug` | text | `{tenant_id, locale, slug}` UNIQUE |
| `title` | text | Default locale (i18n přes `translations`) |
| `description_html` | text NULL | Sanitized HTML |
| `type` | text | `simple`, `variable`, `bundle`, `digital`, `service`, `gift_card` |
| `status` | text | `draft`, `active`, `archived` |
| `vendor_id` | uuid FK NULL | → `vendors` |
| `brand_id` | uuid FK NULL | → `brands` |
| `primary_category_id` | uuid FK NULL | → `categories` |
| `is_taxable` | boolean | Některé produkty (knihy, jídlo) mají speciální tax |
| `tax_class_code` | text NULL | `standard`, `reduced`, `super_reduced`, `zero` |
| `available_from` | timestamptz NULL | Scheduled publish |
| `available_until` | timestamptz NULL | |
| `seo_title` | text NULL | |
| `seo_description` | text NULL | |
| `weight_grams` | int NULL | Default pro varianty bez explicit weight |

**Indexy:** `(tenant_id, status)`, `(tenant_id, slug)`, GIN na `metadata`.

---

### ENT-PRODUCT-002 · `product_variants`
Konkrétní prodejná jednotka. Vždy existuje alespoň 1 variant per product (i pro `simple`).

| Pole | Typ | Pozn. |
|---|---|---|
| `product_id` | uuid FK | |
| `sku` | text | UNIQUE per tenant |
| `barcode` | text NULL | EAN/UPC |
| `title` | text NULL | Override produktu (Red / Size M) |
| `option_values` | jsonb | `{"color":"red","size":"M"}` |
| `weight_grams` | int NULL | |
| `dimensions` | jsonb NULL | `{"length_mm":120,"width_mm":80,"height_mm":40}` |
| `is_active` | boolean | |
| `requires_shipping` | boolean | Digital/service = false |
| `position` | int | Sort order v rámci produktu |

**Indexy:** `(tenant_id, sku)`, `(product_id, position)`.

---

### ENT-PRODUCT-003 · `product_options`
Definice variantní osy (color, size, material) pro produkt.

| Pole | Typ | Pozn. |
|---|---|---|
| `product_id` | uuid FK | |
| `name` | text | `color`, `size`, … |
| `values` | text[] | `['red','blue','green']` |
| `position` | int | |

---

### ENT-PRODUCT-004 · `product_media`
Obrázky, videa per produkt/varianta.

| Pole | Typ | Pozn. |
|---|---|---|
| `product_id` | uuid FK NULL | |
| `variant_id` | uuid FK NULL | Optional, jinak default per produkt |
| `media_id` | uuid FK | → `media` |
| `alt_text` | text NULL | AI-generated (DEC-AI-001) nebo manual |
| `position` | int | |
| `role` | text | `gallery`, `swatch`, `lifestyle`, `360` |

---

### ENT-PRODUCT-005 · `product_bundle_items`
Pro `type='bundle'`: které child produkty s jakým množstvím.

| Pole | Typ | Pozn. |
|---|---|---|
| `bundle_id` | uuid FK | → products |
| `variant_id` | uuid FK | child variant |
| `quantity` | int | |
| `is_optional` | boolean | Nucle nuclear-style "build your bundle" |

---

### ENT-VENDOR-001 · `vendors`
Dodavatel (i pro single-vendor merchant slouží pro reporting).

| Pole | Typ |
|---|---|
| `name` | text |
| `email` | citext NULL |
| `contact_phone` | text NULL |
| `default_lead_time_days` | int NULL |

---

### ENT-BRAND-001 · `brands`
| Pole | Typ |
|---|---|
| `name` | text |
| `slug` | text |
| `logo_media_id` | uuid FK NULL |
| `description_html` | text NULL |

---

### ENT-ATTRIBUTE-001 · `attributes` *(plugin-extensible)*
Definice merchant-level vlastních polí (mimo metadata JSONB když chce facetovat).

| Pole | Typ |
|---|---|
| `key` | text UNIQUE per tenant |
| `label` | text |
| `data_type` | text CHECK (`text`,`number`,`boolean`,`enum`,`date`,`url`,`color`) |
| `is_facetable` | boolean |
| `is_searchable` | boolean |
| `enum_values` | text[] NULL |
| `applies_to` | text[] | `['product','variant','category','customer']` |

---

### ENT-MEDIA-001 · `media`
Univerzální asset storage.

| Pole | Typ | Pozn. |
|---|---|---|
| `kind` | text | `image`, `video`, `document`, `audio`, `3d` |
| `storage_key` | text | S3 object key |
| `mime_type` | text | |
| `bytes` | bigint | |
| `width_px` | int NULL | Pro `image`/`video` |
| `height_px` | int NULL | |
| `duration_ms` | int NULL | Pro `video`/`audio` |
| `checksum_sha256` | text | Pro dedup |
| `processing_status` | text | `pending`,`ready`,`failed` |

Doc: `06-catalog-pim.md`, `32-cms-content.md`.

---

## 5. Categories & Collections

Doc: `07-categories-taxonomy.md`.

### ENT-CATEGORY-001 · `categories`
Hierarchická taxonomie (merchant-driven). **Materialized path** pro rychlé queries.

| Pole | Typ | Pozn. |
|---|---|---|
| `parent_id` | uuid FK NULL | |
| `path` | ltree | Postgres ltree extension (`electronics.phones.smartphones`) |
| `depth` | int | Generated z `path` |
| `slug` | text | UNIQUE per locale |
| `name` | text | |
| `position` | int | |
| `seo_title` | text NULL | |
| `seo_description` | text NULL | |
| `display_mode` | text | `grid`, `list`, `editorial` |

---

### ENT-COLLECTION-001 · `collections`
Manuální nebo automatická skupina produktů (Smart Collection style).

| Pole | Typ | Pozn. |
|---|---|---|
| `name` | text | |
| `slug` | text | |
| `kind` | text | `manual`, `smart` |
| `rules` | jsonb NULL | Pro `smart`: query DSL (price < X, tag = Y, …) |
| `sort_strategy` | text | `manual`, `best_selling`, `price_asc`, `created_desc`, `random` |

---

### ENT-CATEGORY-002 · `product_categories`
M:N. Plus `primary_category_id` v products pro main.

```
(product_id, category_id, tenant_id) UNIQUE
```

### ENT-COLLECTION-002 · `product_collections`
M:N pro `manual` collections. Pro `smart` se materializuje read-modelem.

---

## 6. Inventory & Warehousing

Doc: `09-inventory.md`. **V MVP zapnut jen 1 default warehouse** (schema připraveno pro MSI ve v1.0).

### ENT-WAREHOUSE-001 · `warehouses`
| Pole | Typ | Pozn. |
|---|---|---|
| `code` | text UNIQUE per tenant | `main`, `warsaw-01` |
| `name` | text | |
| `address_id` | uuid FK | → `addresses` |
| `is_default` | boolean | Přesně 1 default per tenant (partial unique idx) |
| `is_active` | boolean | |
| `pickup_enabled` | boolean | BOPIS |
| `priority` | int | Allocation order |

---

### ENT-INVENTORY-001 · `inventory_items`
1:1 s `product_variants` (přesně 1 inventory tracking record per variant).

| Pole | Typ |
|---|---|
| `variant_id` | uuid FK UNIQUE |
| `tracking_mode` | text CHECK (`tracked`,`not_tracked`,`backorder_allowed`) |
| `safety_stock` | int | Buffer před `out_of_stock` |

---

### ENT-STOCK-LEVEL-001 · `stock_levels`
Per-warehouse stav.

| Pole | Typ | Pozn. |
|---|---|---|
| `inventory_item_id` | uuid FK | |
| `warehouse_id` | uuid FK | |
| `on_hand` | int | Fyzicky |
| `reserved` | int | Allocated do open orders |
| `available` | int GENERATED | `on_hand - reserved` |
| `incoming` | int | Z purchase orders, ETA známé |
| `last_counted_at` | timestamptz NULL | |

UNIQUE `(inventory_item_id, warehouse_id)`.

---

### ENT-STOCK-RESERVATION-001 · `stock_reservations`
Hold na položku v rámci open cart/order. **Time-bound** — release přes job.

| Pole | Typ | Pozn. |
|---|---|---|
| `variant_id` | uuid FK | |
| `warehouse_id` | uuid FK | |
| `quantity` | int | |
| `cart_id` | uuid FK NULL | |
| `order_id` | uuid FK NULL | |
| `expires_at` | timestamptz | Default 30 min pro cart, null pro placed order |
| `released_at` | timestamptz NULL | |

---

### ENT-STOCK-MOVEMENT-001 · `stock_movements`
Append-only ledger všech pohybů (immutable, audit).

| Pole | Typ | Pozn. |
|---|---|---|
| `variant_id` | uuid FK | |
| `warehouse_id` | uuid FK | |
| `quantity_delta` | int | Záporné = decrement |
| `reason` | text | `sale`,`return`,`adjustment`,`transfer_in`,`transfer_out`,`receive`,`damage`,`shrinkage` |
| `reference_type` | text NULL | `order`,`return`,`po`,`transfer`,`manual` |
| `reference_id` | uuid NULL | |

**Indexy:** `(variant_id, created_at DESC)`, BRIN na `created_at` (pro velké archivy).

---

## 7. Pricing, Promotions & Tax

Doc: `10-pricing-promotions.md`, `15-tax-compliance.md`.

### ENT-PRICE-LIST-001 · `price_lists`
Sada cen aplikovatelná na customer group / company / channel.

| Pole | Typ | Pozn. |
|---|---|---|
| `name` | text | |
| `currency` | char(3) | |
| `kind` | text | `retail`,`b2b`,`promotional`,`channel` |
| `customer_group_id` | uuid FK NULL | |
| `company_id` | uuid FK NULL | |
| `channel_id` | uuid FK NULL | |
| `starts_at` | timestamptz NULL | |
| `ends_at` | timestamptz NULL | |
| `priority` | int | Conflict resolution (vyšší vyhrává) |

---

### ENT-PRICE-001 · `prices`
Per-variant per-price-list částka. Time-bound možné (sale period).

| Pole | Typ | Pozn. |
|---|---|---|
| `price_list_id` | uuid FK | |
| `variant_id` | uuid FK | |
| `amount` | bigint | Minor unit |
| `currency` | char(3) | |
| `min_quantity` | int DEFAULT 1 | Pro tier pricing |
| `starts_at` | timestamptz NULL | |
| `ends_at` | timestamptz NULL | |

UNIQUE `(price_list_id, variant_id, min_quantity, starts_at)`.

---

### ENT-TIER-PRICE-001 · `tier_prices`
Volumetric pricing (per-customer-group nebo per-company).

Modelováno přes `prices.min_quantity > 1` v rámci konkrétního `price_list`. Žádná separátní tabulka — udržujeme jednoduché.

---

### ENT-DISCOUNT-001 · `discounts`
Pravidlo slevy (automatic nebo coupon-gated).

| Pole | Typ | Pozn. |
|---|---|---|
| `name` | text | |
| `kind` | text | `percentage`,`fixed`,`bogo`,`free_shipping`,`bundle` |
| `value` | bigint NULL | % \* 100 nebo amount v minor unit |
| `currency` | char(3) NULL | Pro `fixed` |
| `scope` | text | `cart`,`line_item`,`shipping` |
| `applies_to` | jsonb | Filter expression (product IDs, categories, tags) |
| `min_purchase_amount` | bigint NULL | |
| `max_uses_total` | int NULL | |
| `max_uses_per_customer` | int NULL | |
| `usage_count` | int DEFAULT 0 | |
| `requires_coupon` | boolean | |
| `is_stackable` | boolean | Kombinovatelné s jinými |
| `priority` | int | |
| `starts_at` | timestamptz NULL | |
| `ends_at` | timestamptz NULL | |
| `status` | text | `active`,`paused`,`expired` |

---

### ENT-COUPON-001 · `coupons`
Kód, který odemyká discount.

| Pole | Typ | Pozn. |
|---|---|---|
| `discount_id` | uuid FK | |
| `code` | citext UNIQUE per tenant | |
| `single_use_token` | boolean | Per-customer unique code |
| `customer_id` | uuid FK NULL | Targeted coupon |
| `usage_count` | int DEFAULT 0 | |

---

### ENT-PROMOTION-RULE-001 · `promotion_rules` *(future)*
Visual rule builder output (Shopware-inspired) — vstoupí ve v1.0 (4.2.10 v todo.md). V MVP slouží JSONB `discounts.applies_to` jako jednodušší DSL.

---

### ENT-GIFT-CARD-001 · `gift_cards`
| Pole | Typ |
|---|---|
| `code_hash` | text | Hashed (jako API key) |
| `initial_amount` | bigint |
| `balance` | bigint |
| `currency` | char(3) |
| `issued_to_email` | citext NULL |
| `expires_at` | timestamptz NULL |
| `status` | text CHECK (`active`,`spent`,`expired`,`revoked`) |

Doc: `10-pricing-promotions.md`.

---

### ENT-TAX-ZONE-001 · `tax_zones`
Geographic seskupení pro tax pravidla.

| Pole | Typ | Pozn. |
|---|---|---|
| `name` | text | `EU`, `CZ`, `DE`, `Outside EU` |
| `country_codes` | char(2)[] | |
| `region_codes` | text[] NULL | US states, DE Bundesländer |

---

### ENT-TAX-RATE-001 · `tax_rates`
Konkrétní sazba pro zone × tax_class.

| Pole | Typ | Pozn. |
|---|---|---|
| `tax_zone_id` | uuid FK | |
| `tax_class_code` | text | `standard`,`reduced`,`super_reduced`,`zero` |
| `rate_basis_points` | int | 2100 = 21.00 % |
| `name` | text | `DPH 21 %` |
| `compound` | boolean | Stacks on previous (Quebec QST style) |
| `priority` | int | |
| `valid_from` | date | |
| `valid_until` | date NULL | |

UNIQUE `(tax_zone_id, tax_class_code, valid_from)`.

---

### ENT-TAX-EXEMPTION-001 · `tax_exemptions`
Per-customer/company doklad o osvobození (reverse charge, charity).

| Pole | Typ | Pozn. |
|---|---|---|
| `customer_id` | uuid FK NULL | |
| `company_id` | uuid FK NULL | |
| `kind` | text | `vat_reverse_charge`,`zero_rate_export`,`non_profit`,`b2b_eu` |
| `vat_id` | text NULL | Validováno přes VIES, snapshot value |
| `vies_validated_at` | timestamptz NULL | |
| `valid_until` | date NULL | |

---

## 8. Cart & Checkout

Doc: `11-cart.md`, `12-checkout.md`.

### ENT-CART-001 · `carts`
Persistent shopping cart (guest i logged-in).

| Pole | Typ | Pozn. |
|---|---|---|
| `customer_id` | uuid FK NULL | NULL = guest |
| `session_token` | text NULL | Pro guest cart linking |
| `currency` | char(3) | |
| `locale` | text | BCP-47 |
| `channel_id` | uuid FK NULL | Multi-channel |
| `status` | text | `active`,`abandoned`,`converted`,`expired` |
| `expires_at` | timestamptz | Default 30 dní inactivity |
| `subtotal_amount` | bigint | Snapshot, recalc on dirty |
| `tax_amount` | bigint | |
| `discount_amount` | bigint | |
| `shipping_amount` | bigint | |
| `total_amount` | bigint | |
| `note` | text NULL | Customer note |
| `applied_coupon_codes` | text[] | |

---

### ENT-CART-ITEM-001 · `cart_items`
| Pole | Typ | Pozn. |
|---|---|---|
| `cart_id` | uuid FK | |
| `variant_id` | uuid FK | |
| `quantity` | int CHECK (> 0) | |
| `unit_price_amount` | bigint | Snapshot |
| `unit_price_currency` | char(3) | |
| `discount_amount` | bigint | |
| `tax_amount` | bigint | |
| `gift_message` | text NULL | |
| `customization` | jsonb NULL | Engraving, color picker, etc. |

UNIQUE `(cart_id, variant_id, customization_hash)`.

---

### ENT-CHECKOUT-SESSION-001 · `checkout_sessions`
Krátkodobý state mezi cart → order. Drží shipping/billing addresses, vybranou platbu, dopravu.

| Pole | Typ | Pozn. |
|---|---|---|
| `cart_id` | uuid FK | |
| `email` | citext NULL | Guest email |
| `shipping_address_id` | uuid FK NULL | → `addresses` |
| `billing_address_id` | uuid FK NULL | |
| `shipping_method_id` | uuid FK NULL | |
| `payment_method_id` | uuid FK NULL | |
| `state` | text | `address`,`shipping`,`payment`,`review`,`completed`,`expired` |
| `idempotency_key` | text NULL | Anti-double-submit |
| `expires_at` | timestamptz | 1h default |

Hard delete po expire/completion + 24h (audit retention).

---

## 9. Orders, Payments, Shipments

Doc: `16-order-management.md`, `13-payments.md`, `14-shipping.md`.

### ENT-ORDER-001 · `orders`
HPOS-inspired flat schema (žádný EAV).

| Pole | Typ | Pozn. |
|---|---|---|
| `number` | text UNIQUE per tenant | `ORD-2026-00001234` |
| `pub_id` | text UNIQUE | NanoID pro public URLs |
| `customer_id` | uuid FK NULL | NULL = guest |
| `email` | citext | Snapshot (nutný pro guest) |
| `company_id` | uuid FK NULL | B2B |
| `channel_id` | uuid FK NULL | |
| `currency` | char(3) | |
| `status` | text | `pending`,`confirmed`,`processing`,`fulfilled`,`completed`,`cancelled`,`refunded` |
| `payment_status` | text | `pending`,`authorized`,`paid`,`partially_paid`,`refunded`,`partially_refunded`,`failed` |
| `fulfillment_status` | text | `unfulfilled`,`partially_fulfilled`,`fulfilled`,`returned` |
| `placed_at` | timestamptz | |
| `confirmed_at` | timestamptz NULL | |
| `cancelled_at` | timestamptz NULL | |
| `cancel_reason` | text NULL | |
| `subtotal_amount` | bigint | |
| `tax_amount` | bigint | |
| `discount_amount` | bigint | |
| `shipping_amount` | bigint | |
| `total_amount` | bigint | |
| `paid_amount` | bigint | Running total z payments |
| `refunded_amount` | bigint | |
| `shipping_address_snapshot` | jsonb | Immutable snapshot |
| `billing_address_snapshot` | jsonb | |
| `tax_breakdown` | jsonb | Pro účetnictví |
| `applied_coupons` | text[] | Snapshot codes |
| `customer_note` | text NULL | |
| `risk_score` | int NULL | Fraud detection (0-100) |
| `source` | text | `storefront`,`pos`,`admin`,`api`,`agent` |

**Indexy:** `(tenant_id, status)`, `(tenant_id, placed_at DESC)`, `(tenant_id, customer_id, placed_at DESC)`.

---

### ENT-ORDER-ITEM-001 · `order_items`
| Pole | Typ | Pozn. |
|---|---|---|
| `order_id` | uuid FK | |
| `variant_id` | uuid FK NULL | NULL pokud variant deleted (snapshot zůstává) |
| `sku` | text | Snapshot |
| `title` | text | Snapshot |
| `quantity` | int | |
| `unit_price_amount` | bigint | |
| `unit_price_currency` | char(3) | |
| `discount_amount` | bigint | |
| `tax_amount` | bigint | |
| `total_amount` | bigint | |
| `tax_rate_basis_points` | int | Snapshot |
| `requires_shipping` | boolean | |
| `weight_grams` | int NULL | |
| `fulfillment_status` | text | Per-line tracking |
| `quantity_fulfilled` | int DEFAULT 0 | |
| `quantity_returned` | int DEFAULT 0 | |

---

### ENT-ORDER-TRANSITION-001 · `order_transitions`
Append-only state machine log.

| Pole | Typ | Pozn. |
|---|---|---|
| `order_id` | uuid FK | |
| `from_status` | text NULL | |
| `to_status` | text | |
| `actor_kind` | text | `user`,`customer`,`system`,`agent`,`webhook` |
| `actor_id` | uuid NULL | |
| `reason` | text NULL | |
| `notes` | text NULL | |

---

### ENT-ORDER-EVENT-001 · `order_events`
Customer-facing timeline (emaily, status changes, shipped, …) pro storefront "Where is my order".

| Pole | Typ |
|---|---|
| `order_id` | uuid FK |
| `kind` | text |
| `is_customer_visible` | boolean |
| `title` | text |
| `description` | text NULL |
| `occurred_at` | timestamptz |

---

### ENT-INVOICE-001 · `invoices`
Účetní doklad.

| Pole | Typ | Pozn. |
|---|---|---|
| `number` | text UNIQUE per tenant | `INV-2026-00001234` (zákonná sekvence) |
| `order_id` | uuid FK | |
| `kind` | text | `invoice`,`proforma`,`credit_note`,`advance` |
| `issued_at` | timestamptz | |
| `due_at` | timestamptz NULL | |
| `paid_at` | timestamptz NULL | |
| `currency` | char(3) | |
| `subtotal_amount` | bigint | |
| `tax_amount` | bigint | |
| `total_amount` | bigint | |
| `pdf_media_id` | uuid FK NULL | |
| `isdoc_xml` | text NULL | ISDOC 6.0.1 (CZ) |
| `seller_snapshot` | jsonb | Snapshot legal entity |
| `buyer_snapshot` | jsonb | |

Doc: `15-tax-compliance.md`.

---

### ENT-PAYMENT-001 · `payments`
Záznam o platební transakci.

| Pole | Typ | Pozn. |
|---|---|---|
| `order_id` | uuid FK | |
| `provider_code` | text | `stripe`,`gopay`,`comgate`,`thepay`,`paypal`,`bank_transfer`,`cod` |
| `provider_payment_id` | text NULL | External ID |
| `kind` | text | `charge`,`authorization`,`capture`,`void`,`refund` |
| `amount` | bigint | |
| `currency` | char(3) | |
| `status` | text | `pending`,`authorized`,`captured`,`failed`,`refunded`,`cancelled` |
| `method_brand` | text NULL | `visa`,`mastercard`,`maestro`,`apple_pay`,`bank_transfer` |
| `method_last4` | text NULL | Tokenized only (PCI scope, DEC-PAY-002) |
| `failure_code` | text NULL | |
| `failure_message` | text NULL | |
| `idempotency_key` | text NULL | |
| `raw_payload` | jsonb NULL | Provider response (sanitized) |

UNIQUE `(provider_code, provider_payment_id)`.

---

### ENT-REFUND-001 · `refunds`
| Pole | Typ |
|---|---|
| `order_id` | uuid FK |
| `payment_id` | uuid FK |
| `amount` | bigint |
| `currency` | char(3) |
| `reason` | text |
| `status` | text |
| `processed_at` | timestamptz NULL |

---

### ENT-SHIPMENT-001 · `shipments`
| Pole | Typ | Pozn. |
|---|---|---|
| `order_id` | uuid FK | |
| `carrier_code` | text | `zasilkovna`,`ppl`,`ceska_posta`,`dpd`,`packeta_sk`,… |
| `service_code` | text | `home`,`pickup_point`,`express` |
| `tracking_number` | text NULL | |
| `tracking_url` | text NULL | |
| `label_media_id` | uuid FK NULL | PDF label |
| `pickup_point_id` | uuid FK NULL | |
| `status` | text | `pending`,`ready`,`in_transit`,`delivered`,`returned`,`failed` |
| `shipped_at` | timestamptz NULL | |
| `delivered_at` | timestamptz NULL | |
| `weight_grams` | int NULL | |
| `dimensions` | jsonb NULL | |
| `cost_amount` | bigint NULL | Naše interní náklady |

---

### ENT-SHIPMENT-ITEM-001 · `shipment_items`
Partial fulfillment — který order_item v kterém shipment v jakém množství.

```
(shipment_id, order_item_id, quantity)
```

---

### ENT-SHIPMENT-EVENT-001 · `shipment_events`
Tracking events od carrier webhooks.

| Pole | Typ |
|---|---|
| `shipment_id` | uuid FK |
| `status` | text |
| `description` | text |
| `location` | text NULL |
| `occurred_at` | timestamptz |
| `raw_payload` | jsonb |

---

### ENT-SHIPPING-ZONE-001 · `shipping_zones`
Geografická skupina pro doručovací pravidla.

| Pole | Typ |
|---|---|
| `name` | text |
| `country_codes` | char(2)[] |
| `region_codes` | text[] NULL |

---

### ENT-SHIPPING-RATE-001 · `shipping_rates`
| Pole | Typ | Pozn. |
|---|---|---|
| `shipping_zone_id` | uuid FK | |
| `carrier_code` | text | |
| `service_code` | text | |
| `name` | text | Display name |
| `kind` | text | `flat`,`weight_based`,`price_based`,`free_above` |
| `amount` | bigint NULL | Flat |
| `tiers` | jsonb NULL | Pro weight/price-based |
| `min_amount` | bigint NULL | Pro `free_above` |
| `currency` | char(3) | |
| `estimated_days_min` | int NULL | |
| `estimated_days_max` | int NULL | |
| `pickup_only` | boolean | |

---

### ENT-PICKUP-POINT-001 · `pickup_points` *(cache)*
Locally cached pickup locations z carrier feeds (Zásilkovna, Packeta).

| Pole | Typ |
|---|---|
| `carrier_code` | text |
| `external_id` | text |
| `name` | text |
| `address_snapshot` | jsonb |
| `latitude` | numeric(9,6) |
| `longitude` | numeric(9,6) |
| `opening_hours` | jsonb NULL |
| `last_synced_at` | timestamptz |

UNIQUE `(carrier_code, external_id)`. Refresh přes `JOB-PICKUP-SYNC`.

---

## 10. Returns & Refunds

Doc: `17-returns-refunds.md`.

### ENT-RETURN-001 · `returns`
| Pole | Typ | Pozn. |
|---|---|---|
| `order_id` | uuid FK | |
| `number` | text UNIQUE per tenant | `RMA-2026-NNNN` |
| `status` | text | `requested`,`approved`,`rejected`,`received`,`refunded`,`closed` |
| `reason_code` | text | `defective`,`wrong_item`,`not_as_described`,`changed_mind`,`shipping_damage` |
| `customer_note` | text NULL | |
| `staff_note` | text NULL | |
| `refund_method` | text | `original_payment`,`store_credit`,`bank_transfer`,`exchange` |
| `restock_decision` | text | `restock`,`damage`,`recycle`,`unknown` |
| `requested_at` | timestamptz | |
| `approved_at` | timestamptz NULL | |
| `received_at` | timestamptz NULL | |
| `refunded_at` | timestamptz NULL | |

---

### ENT-RETURN-ITEM-001 · `return_items`
```
(return_id, order_item_id, quantity, condition, refund_amount)
condition: 'new','damaged','used','missing_parts'
```

---

## 11. Customers & B2B

Doc: `18-customer-management.md`, `21-b2b-complete.md`.

### ENT-CUSTOMER-001 · `customers`
B2C customer + B2B-lite (može mít vazbu na company).

| Pole | Typ | Pozn. |
|---|---|---|
| `email` | citext | UNIQUE per tenant |
| `password_hash` | text NULL | NULL pro guest-only / OAuth-only |
| `first_name` | text NULL | |
| `last_name` | text NULL | |
| `phone` | text NULL | E.164 |
| `birth_date` | date NULL | |
| `default_locale` | text | |
| `default_currency` | char(3) NULL | |
| `accepts_marketing` | boolean | GDPR opt-in |
| `marketing_consent_at` | timestamptz NULL | |
| `tax_id` | text NULL | DIČ pro individual sole proprietors |
| `is_verified_email` | boolean | |
| `total_spent_amount` | bigint DEFAULT 0 | Materialized, recalc via job |
| `total_orders` | int DEFAULT 0 | |
| `last_order_at` | timestamptz NULL | |
| `risk_score` | int NULL | Fraud signal |
| `notes` | text NULL | Internal CRM notes |
| `tags` | text[] | |

---

### ENT-CUSTOMER-002 · `addresses`
| Pole | Typ | Pozn. |
|---|---|---|
| `customer_id` | uuid FK NULL | NULL = ad-hoc address (např. ve `tenants.legal_address`) |
| `company_id` | uuid FK NULL | |
| `kind` | text | `shipping`,`billing`,`both` |
| `is_default` | boolean | |
| `recipient_name` | text | |
| `company_name` | text NULL | |
| `street1` | text | |
| `street2` | text NULL | |
| `city` | text | |
| `region` | text NULL | Stát/kraj |
| `postal_code` | text | |
| `country_code` | char(2) | |
| `phone` | text NULL | |

---

### ENT-CUSTOMER-003 · `customer_groups`
| Pole | Typ |
|---|---|
| `name` | text |
| `description` | text NULL |
| `default_price_list_id` | uuid FK NULL |
| `default_tax_class_code` | text NULL |
| `auto_assignment_rules` | jsonb NULL |

`(customer_id, customer_group_id)` přes `customer_group_members`.

---

### ENT-CUSTOMER-004 · `customer_consents`
GDPR consent ledger (immutable, append-only).

| Pole | Typ |
|---|---|
| `customer_id` | uuid FK |
| `purpose` | text |
| `granted` | boolean |
| `granted_at` | timestamptz |
| `revoked_at` | timestamptz NULL |
| `source` | text | `signup`,`checkout`,`preferences`,`cookie_banner` |
| `policy_version` | text | |

Doc: `30-security.md`, `15-tax-compliance.md`.

---

### ENT-COMPANY-001 · `companies`
B2B entity (B2B-lite MVP, full B2B v1.0).

| Pole | Typ | Pozn. |
|---|---|---|
| `name` | text | |
| `registration_number` | text NULL | IČO (CZ), Handelsregister (DE), … |
| `vat_id` | text NULL | DIČ (CZ), USt-IdNr (DE) |
| `vies_validated_at` | timestamptz NULL | |
| `default_price_list_id` | uuid FK NULL | |
| `default_payment_terms_days` | int NULL | NET 30 / 60 |
| `credit_limit_amount` | bigint NULL | |
| `account_status` | text | `pending`,`approved`,`suspended` |
| `default_billing_address_id` | uuid FK NULL | |
| `default_shipping_address_id` | uuid FK NULL | |

---

### ENT-COMPANY-002 · `company_members`
| Pole | Typ |
|---|---|
| `company_id` | uuid FK |
| `customer_id` | uuid FK |
| `role` | text | `admin`,`buyer`,`approver`,`viewer` |
| `purchase_limit_amount` | bigint NULL |

---

### ENT-QUOTE-001 · `quotes` *(v1.0 komerční modul)*
B2B quote request → approve → convert to order.

| Pole | Typ |
|---|---|
| `number` | text |
| `company_id` | uuid FK |
| `customer_id` | uuid FK |
| `status` | text | `draft`,`requested`,`negotiating`,`approved`,`rejected`,`expired`,`converted` |
| `valid_until` | date NULL |
| `total_amount` | bigint |
| `currency` | char(3) |

Doc: `21-b2b-complete.md`.

---

### ENT-PURCHASE-ORDER-001 · `purchase_orders` *(v1.0)*
B2B PO matching s objednávkou.

| Pole | Typ |
|---|---|
| `company_id` | uuid FK |
| `po_number_external` | text |
| `linked_order_id` | uuid FK NULL |
| `amount` | bigint |
| `currency` | char(3) |
| `status` | text |

---

## 12. Marketing, SEO & CMS

Doc: `19-marketing-seo.md`, `32-cms-content.md`.

### ENT-SEO-METADATA-001 · `seo_metadata`
Per-entity SEO overrides (product, category, page).

| Pole | Typ |
|---|---|
| `entity_type` | text |
| `entity_id` | uuid |
| `locale` | text |
| `title` | text NULL |
| `description` | text NULL |
| `canonical_url` | text NULL |
| `og_title` | text NULL |
| `og_description` | text NULL |
| `og_image_media_id` | uuid FK NULL |
| `robots` | text NULL | `index,follow` default |
| `schema_jsonld` | jsonb NULL | Override default JSON-LD |

UNIQUE `(entity_type, entity_id, locale)`.

---

### ENT-REDIRECT-001 · `redirects`
| Pole | Typ |
|---|---|
| `from_path` | text |
| `to_path` | text |
| `status_code` | int | 301 / 302 / 308 |
| `is_active` | boolean |

---

### ENT-PAGE-001 · `cms_pages`
| Pole | Typ |
|---|---|
| `slug` | text |
| `locale` | text |
| `title` | text |
| `status` | text | `draft`,`published`,`scheduled`,`archived` |
| `published_at` | timestamptz NULL |
| `content_blocks` | jsonb | Blocks tree (CMS-lite) |
| `template` | text | `default`,`landing`,`policy` |
| `seo_metadata_id` | uuid FK NULL |

---

### ENT-MENU-001 · `menus`
```
menus(name, location)
menu_items(menu_id, parent_id, position, title, target_type, target_id, url, locale)
target_type: 'page','category','collection','product','url','custom'
```

---

### ENT-BLOG-POST-001 · `blog_posts` *(volitelné v MVP)*
| Pole | Typ |
|---|---|
| `slug` | text |
| `locale` | text |
| `title` | text |
| `excerpt` | text NULL |
| `content_blocks` | jsonb |
| `author_id` | uuid FK NULL |
| `published_at` | timestamptz NULL |
| `cover_media_id` | uuid FK NULL |
| `tags` | text[] |

---

## 13. Subscriptions

Doc: `24-subscriptions.md`. **Komerční modul v1.0+**, schema připravené.

### ENT-SUBSCRIPTION-001 · `subscriptions`
| Pole | Typ |
|---|---|
| `customer_id` | uuid FK |
| `status` | text | `active`,`paused`,`past_due`,`cancelled`,`expired` |
| `started_at` | timestamptz |
| `cancelled_at` | timestamptz NULL |
| `current_period_start` | timestamptz |
| `current_period_end` | timestamptz |
| `billing_cycle` | text | `weekly`,`monthly`,`quarterly`,`yearly`,`custom` |
| `billing_anchor_day` | int NULL |
| `next_billing_at` | timestamptz NULL |
| `payment_method_token` | text NULL |
| `shipping_address_id` | uuid FK |

### ENT-SUBSCRIPTION-ITEM-001 · `subscription_items`
```
(subscription_id, variant_id, quantity, unit_price_amount, currency)
```

### ENT-BILLING-CYCLE-001 · `subscription_invoices` *(historie)*
Per-period invoice + payment attempt log.

---

## 14. Multistore & Channels

Doc: `22-multistore-channels.md`.

### ENT-CHANNEL-001 · `channels`
Sales channel — storefront, POS, marketplace export, agent endpoint, mobile app.

| Pole | Typ |
|---|---|
| `code` | text |
| `name` | text |
| `kind` | text | `web`,`pos`,`marketplace`,`agent`,`mobile`,`b2b_portal` |
| `default_locale` | text |
| `default_currency` | char(3) |
| `is_active` | boolean |
| `settings` | jsonb |

### ENT-CHANNEL-PRICE-001 · *(modelováno přes `price_lists.channel_id`)*

### ENT-CHANNEL-INVENTORY-001 · `channel_stock_overrides`
Optional per-channel allocation cap (např. "z 100 ks půjde 30 na Heuréka feed").

---

### ENT-STORE-001 · `stores`
Per-tenant podstoreem (multi-store: vlastní brand, vlastní doména, sdílí katalog).

| Pole | Typ |
|---|---|
| `name` | text |
| `domain` | text |
| `default_locale` | text |
| `default_currency` | char(3) |
| `theme_id` | uuid FK NULL |
| `default_channel_id` | uuid FK |

---

## 15. i18n & Currency

Doc: `23-i18n.md`.

### ENT-TRANSLATION-001 · `translations`
Univerzální per-field per-locale překlad.

| Pole | Typ |
|---|---|
| `entity_type` | text |
| `entity_id` | uuid |
| `field` | text |
| `locale` | text |
| `value` | text |

UNIQUE `(entity_type, entity_id, field, locale)`.

**Alternativní design** (zvážit per-domain): translatable sloupce přímo v entitě jako `title_translations jsonb`. Master schema používá separátní table pro flexibilitu (search index, fallback chain, missing translation report).

---

### ENT-LOCALE-001 · `locales`
| Pole | Typ |
|---|---|
| `code` | text PK | BCP-47 (`cs-CZ`) |
| `name_native` | text |
| `direction` | text | `ltr`,`rtl` |
| `is_active` | boolean |
| `fallback_locale_code` | text NULL |

### ENT-CURRENCY-001 · `currencies`
Platform-wide číselník (ISO 4217).

| Pole | Typ |
|---|---|
| `code` | char(3) PK |
| `name` | text |
| `symbol` | text |
| `minor_units` | int | 2 pro EUR/USD, 0 pro JPY |
| `is_active` | boolean |

### ENT-EXCHANGE-RATE-001 · `exchange_rates`
Snapshot per (date, base, quote).

| Pole | Typ |
|---|---|
| `base_currency` | char(3) |
| `quote_currency` | char(3) |
| `rate` | numeric(20,10) |
| `valid_for_date` | date |
| `source` | text | `ecb`,`cnb`,`manual` |

UNIQUE `(base_currency, quote_currency, valid_for_date)`.

---

## 16. Marketplace (multi-vendor)

Doc: `25-marketplace.md`. **Fáze 4** — schema rezerva, MVP necílí.

### ENT-SELLER-001 · `sellers`
| Pole | Typ |
|---|---|
| `tenant_id` | uuid FK | Platform tenant |
| `name` | text |
| `slug` | text |
| `payout_method_id` | uuid FK NULL |
| `commission_rate_basis_points` | int |
| `status` | text |

### ENT-SELLER-PRODUCT-001 · `seller_products`
Mapping product → seller (multi-vendor catalog).

### ENT-PAYOUT-001 · `payouts`
Disbursement per seller per period.

---

## 17. Developer Platform

Doc: `28-developer-platform.md`.

### ENT-PLUGIN-001 · `plugins`
Instalovaný plugin per tenant.

| Pole | Typ |
|---|---|
| `package_name` | text | `@shopio-plugin/heureka-feed` |
| `version` | text |
| `status` | text | `installed`,`enabled`,`disabled`,`failed` |
| `config` | jsonb |
| `installed_at` | timestamptz |
| `installed_by` | uuid FK |
| `last_error` | text NULL |

### ENT-PLUGIN-002 · `plugin_registry` *(platform-wide)*
Marketplace katalog (Fáze 2). Žádný `tenant_id`.

| Pole | Typ |
|---|---|
| `package_name` | text PK |
| `display_name` | text |
| `developer_id` | uuid FK |
| `current_version` | text |
| `license_kind` | text | `oss`,`free`,`paid_one_time`,`paid_subscription` |
| `price_amount` | bigint NULL |
| `pricing_currency` | char(3) NULL |
| `rating_avg` | numeric(3,2) NULL |
| `install_count` | int |
| `last_published_at` | timestamptz |

### ENT-WEBHOOK-001 · `webhooks`
| Pole | Typ |
|---|---|
| `endpoint_url` | text |
| `secret_hash` | text |
| `events` | text[] | `EVENT-ORDER-PLACED`, `EVENT-PRODUCT-UPDATED`, … |
| `is_active` | boolean |
| `last_success_at` | timestamptz NULL |
| `last_failure_at` | timestamptz NULL |
| `failure_count` | int |

### ENT-WEBHOOK-DELIVERY-001 · `webhook_deliveries`
Per-attempt log. **Hard delete** po retention 30 dní.

| Pole | Typ |
|---|---|
| `webhook_id` | uuid FK |
| `event_type` | text |
| `payload_hash` | text |
| `request_body` | jsonb |
| `response_status` | int NULL |
| `response_body` | text NULL |
| `attempt` | int |
| `next_retry_at` | timestamptz NULL |
| `delivered_at` | timestamptz NULL |

---

### ENT-INTEGRATION-001 · `integrations`
3rd-party konektory (Heuréka, Pohoda, Mailchimp, Klaviyo, …).

| Pole | Typ |
|---|---|
| `provider_code` | text |
| `name` | text |
| `status` | text |
| `credentials_encrypted` | bytea | Vault transit |
| `config` | jsonb |
| `last_synced_at` | timestamptz NULL |

Doc: `29-integrations.md`.

---

## 18. AI & Agents

Doc: `33-ai-features.md`. DEC-AI-001 + MCP server v `packages/api-mcp`.

### ENT-AGENT-TOKEN-001 · `agent_tokens`
Signed, scoped, time-bound tokeny pro AI agenty (DEC-AUTH-001).

| Pole | Typ |
|---|---|
| `customer_id` | uuid FK NULL | Agent jednající za customera |
| `name` | text | `OpenAI Operator`, `Claude Computer Use` |
| `scopes` | text[] | `cart:write`, `checkout:initiate`, … |
| `spending_limit_amount` | bigint NULL | Per-task cap |
| `expires_at` | timestamptz |
| `revoked_at` | timestamptz NULL |
| `last_used_at` | timestamptz NULL |
| `dpop_jkt` | text NULL | DPoP JWK thumbprint |

### ENT-AI-SESSION-001 · `ai_sessions`
Chatbot / copilot conversation tracking.

| Pole | Typ |
|---|---|
| `actor_kind` | text | `customer`,`staff`,`agent` |
| `actor_id` | uuid NULL |
| `purpose` | text | `support`,`product_search`,`description_gen`,`anomaly_review` |
| `provider_code` | text | `anthropic`,`openai` (DEC-AI-001) |
| `model_id` | text |
| `started_at` | timestamptz |
| `ended_at` | timestamptz NULL |

### ENT-AI-USAGE-001 · `ai_usage`
Per-call token usage pro billing/limits.

```
(session_id, provider_code, model_id, input_tokens, output_tokens, cost_amount, currency, called_at)
```

### ENT-AI-INSTRUCTION-001 · `ai_instructions`
Per-tenant system prompts a guidelines (přepisuje defaults).

---

## 19. Themes & Storefront customization

Doc: `26-themes-storefront.md`, `35-graphic-templates.md`.

### ENT-THEME-001 · `themes`
Instalovaná theme (Apache 2.0 default + Free/Premium z marketplace).

| Pole | Typ |
|---|---|
| `package_name` | text |
| `version` | text |
| `status` | text | `installed`,`active`,`disabled` |
| `is_default` | boolean |

### ENT-THEME-SETTINGS-001 · `theme_settings`
Per-tenant theme tokens (color palette, typography, layout overrides).

```
(theme_id, key, value_jsonb)
```

### ENT-THEME-ASSET-001 · `theme_assets`
Custom CSS/JS/imagery override.

---

## 20. Industry profiles

Doc: `34-industry-profiles.md`.

### ENT-INDUSTRY-PROFILE-001 · `industry_profiles`
Vertical preset (fashion, pharmacy, B2B-industrial, wine-USA, …).

| Pole | Typ |
|---|---|
| `code` | text |
| `name` | text |
| `applies_to_tenant_id` | uuid FK NULL | NULL = platform template |
| `default_attributes` | jsonb | Atribut packs |
| `default_categories` | jsonb |
| `default_tax_classes` | text[] |
| `compliance_flags` | text[] | `age_restricted`,`prescription`,`hazmat`,`alcohol` |

---

## 21. Audit, Notifikace, Background jobs

Doc: `30-security.md`, `31-operations.md`.

### ENT-AUDIT-LOG-001 · `audit_log`
Append-only, immutable. **Žádný `updated_at`, žádný delete** (mimo retention purge přes partitioning).

| Pole | Typ |
|---|---|
| `id` | uuid PK |
| `tenant_id` | uuid |
| `occurred_at` | timestamptz |
| `actor_kind` | text |
| `actor_id` | uuid NULL |
| `actor_ip` | inet NULL |
| `action` | text | `product.create`,`order.refund`,`user.login`,… |
| `entity_type` | text NULL |
| `entity_id` | uuid NULL |
| `before` | jsonb NULL |
| `after` | jsonb NULL |
| `context` | jsonb NULL | request_id, user_agent, session_id |

**Storage:** monthly partitioning, BRIN index na `occurred_at`. Retention 2 roky default, Enterprise 7 let.

---

### ENT-NOTIFICATION-001 · `notifications` *(in-app)*
Staff notifications v adminu (low stock, new order, plugin failed).

| Pole | Typ |
|---|---|
| `user_id` | uuid FK |
| `kind` | text |
| `title` | text |
| `body` | text |
| `link_url` | text NULL |
| `read_at` | timestamptz NULL |
| `severity` | text | `info`,`warning`,`error` |

---

### ENT-EMAIL-TEMPLATE-001 · `email_templates`
Per-tenant override default emailů.

| Pole | Typ |
|---|---|
| `code` | text | `order_confirmation`, `shipping_notification`, … |
| `locale` | text |
| `subject` | text |
| `body_mjml` | text | Source |
| `body_html` | text | Rendered |
| `is_active` | boolean |

UNIQUE `(tenant_id, code, locale)`.

---

### ENT-JOB-LOG-001 · `job_log`
BullMQ wraps Redis; pro audit a long-running monitoring zrcadlíme klíčové joby do Postgres.

| Pole | Typ |
|---|---|
| `job_name` | text |
| `queue_name` | text |
| `payload_summary` | jsonb |
| `status` | text |
| `started_at` | timestamptz |
| `finished_at` | timestamptz NULL |
| `error` | text NULL |

---

### ENT-OUTBOX-001 · `outbox_events`
Transactional outbox (DEC-EVENTS-001) — eventy zapsané ve stejné Tx jako business data, pak poller publish → BullMQ / webhooks.

| Pole | Typ |
|---|---|
| `event_type` | text |
| `payload` | jsonb |
| `aggregate_type` | text |
| `aggregate_id` | uuid |
| `created_at` | timestamptz |
| `processed_at` | timestamptz NULL |
| `error_count` | int |

**Indexy:** `(processed_at NULLS FIRST, created_at)` partial pro pollerový scan.

---

## 22. Vztahy – high-level ER diagram

```
                          tenants (1)
                              │
       ┌──────────────┬───────┴──────────┬─────────────────┐
       │              │                  │                 │
     users        customers          products          channels
       │              │                  │                 │
       │              ├─ companies ──┐   ├─ variants       │
       │              │              │   │     │           │
       │              ├─ addresses   │   │     ├─ inventory_items
       │              │              │   │     │     │
       │              ├─ consents    │   │     │     ├─ stock_levels (per warehouse)
       │              │              │   │     │     └─ stock_reservations
       │              └─ groups      │   │     │
       │                             │   │     ├─ prices (per price_list)
       │                             │   │     │
       │                             │   ├─ media
       │                             │   ├─ options
       │                             │   ├─ bundle_items
       │                             │   └─ categories (M:N)
       │                             │
       │                             └─ orders ──┬─ order_items
       │                                          ├─ payments ── refunds
       │                                          ├─ shipments ── shipment_items ── shipment_events
       │                                          ├─ invoices
       │                                          ├─ transitions
       │                                          ├─ events
       │                                          └─ returns ── return_items
       │
       ├─ carts ── cart_items ── (variant_id snapshot)
       ├─ checkout_sessions
       ├─ webhooks ── webhook_deliveries
       ├─ plugins
       ├─ themes ── theme_settings
       ├─ api_keys
       ├─ agent_tokens
       └─ audit_log (cross-cutting)

  Platform-wide (no tenant_id):
       currencies · countries · tax_jurisdictions · plugin_registry · exchange_rates
```

---

## 23. Indexy a performance hints

### 23.1 Vždy indexovat
- `tenant_id` jako leading column ve většině compound indexů
- FK sloupce (Postgres neindexuje automaticky)
- `slug`, `code`, `number` — vždy UNIQUE
- `(tenant_id, status)` na `products`, `orders`, `customers`
- `(tenant_id, created_at DESC)` pro list views s pagination

### 23.2 BRIN indexy (append-only large tables)
- `audit_log(occurred_at)`
- `stock_movements(created_at)`
- `webhook_deliveries(created_at)`
- `outbox_events(created_at)`

### 23.3 GIN indexy
- `products.metadata` (JSONB)
- `products.tags` (text[])
- Search columns + tsvector pro fulltext fallback (Meilisearch je primary, viz DEC-SEARCH-001)

### 23.4 pgvector
- `products.embedding vector(1024)` jako optional pro semantic similarity (Fáze 1 trailing, plný v 4.2.4 AI Copilot)

### 23.5 Partial indexy
- `WHERE deleted_at IS NULL` na často query'ovaných tabulkách
- `WHERE is_active = true` na `prices`, `shipping_rates`, `tax_rates`

### 23.6 Generated columns
- `stock_levels.available = on_hand - reserved` (STORED)
- `categories.depth = nlevel(path)` (STORED)

### 23.7 Constraint pravidla
- Měnové sloupce: vždy s `amount` + `currency` doublet
- Žádný NULL měnový amount bez `is_*` flagu nebo `kind` definujícího proč
- Foreign keys: `ON DELETE RESTRICT` default, `CASCADE` jen na owned child entities (`cart_items` z `carts`, `order_items` z `orders` audit-only není cascade)
- Soft-deleted parent: aplikace odmítne create child (DB triggery jen jako defense in depth)

---

## 24. Změny

| Datum | Změna |
|---|---|
| 2026-05-19 | Initial — kompletní master katalog entit pro Foundation. Pokrývá MVP (Fáze 1) + schema rezervaci pro v1.0/v2.0/v3.0 entity (B2B, subscriptions, marketplace, AI agents). |

---

## ⚠️ Pravidla pro úpravy

```
1. Nová entita = nový ENT-* ID, žádné recyklování
2. Změna sémantiky pole = bump tabulky verze + migration ADR
3. Odebrání pole = deprecation cycle (2 minor versions)
4. Doménový dokument může přidat pole, nesmí měnit definici
5. Konfliktní definice = master vyhrává; otevřít issue pro reconcile
6. Nové entity musí mít odkaz na doménový dokument (i pokud je 🟡)
```

---

**Konec Data Models Master.**

➡️ Pokračovat na: [`04-api-conventions.md`](04-api-conventions.md)
