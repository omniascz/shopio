# 06 – CATALOG & PIM

> **Doména:** Product Information Management. Produkty, varianty, atributy, brandy, vendoři, média. Vše, co popisuje **co prodáváme**, ne **kolik máme** (to je Inventory) ani **za kolik** (Pricing).

**Datum:** 2026-05-19
**Verze:** 1.0
**Status:** 🟡 DESIGN
**Reference:** [03-data-models-master.md](03-data-models-master.md) · [04-api-conventions.md](04-api-conventions.md) · [05-naming-conventions.md](05-naming-conventions.md)

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

- Produkt jako master entita s metadaty (title, description, brand, vendor, kategorie)
- Varianty (prodejné SKU) s option values (color, size, …)
- Multi-language obsah (titles, descriptions, SEO) přes i18n
- Media management (obrázky, videa, 3D, dokumenty) per produkt/varianta
- Bundle products (skládané z child variant)
- Digital/service/gift card produkty (ne-shippable)
- Custom attributes přes Zod-validated schema (plugin-extensible)
- Brand a vendor číselník
- Lifecycle: draft → active → archived

### 0.2 Co tato doména **NENÍ**

- ❌ Sklad / stock (→ `09-inventory.md`)
- ❌ Cena (→ `10-pricing-promotions.md`)
- ❌ Daně (→ `15-tax-compliance.md` — tax_class_code je jen identifikátor)
- ❌ Kategorie a kolekce (→ `07-categories-taxonomy.md`)
- ❌ Search a fasety (→ `08-search-filtering.md`)
- ❌ Reviews & ratings (→ `19-marketing-seo.md` v MVP, separátní doc později)
- ❌ Marketplace third-party seller produkty (→ `25-marketplace.md`)
- ❌ CMS content blocks (→ `32-cms-content.md`)

### 0.3 Diferenciátory v této doméně

1. **Agent-native struktura** — každý produkt má JSON-LD output (Product/Offer/AggregateRating) generovaný backendem, ne lepený na frontend; MCP read endpointy od dne 1
2. **Plugin-driven attributes** — pluginy registrují typované custom fieldy bez EAV tabulek (přes Zod schema do `attributes` + `metadata` JSONB)
3. **Multi-locale first** — translations table univerzální, ne per-field sloupce
4. **Industry profiles** — vertikální preset přidá doménová pole (fashion: size_chart, material; pharmacy: active_ingredient, prescription_required)

---

## 1. References

- [03 §4 Catalog & PIM](03-data-models-master.md#4-catalog--pim) — entity ENT-PRODUCT-001 až ENT-MEDIA-001
- [02 §2 Catalog & PIM](02-glossary.md#2-catalog--pim) — definice pojmů (Product, Variant, Option, SKU, Bundle, ...)
- [04-api-conventions.md](04-api-conventions.md) — všechny REST/GraphQL/tRPC pravidla
- [07-categories-taxonomy.md](07-categories-taxonomy.md) — kategorie + kolekce (M:N s produkty)
- [08-search-filtering.md](08-search-filtering.md) — Meilisearch indexer konzumuje EVENT-PRODUCT-*
- [09-inventory.md](09-inventory.md) — `inventory_items` 1:1 s `product_variants`
- [10-pricing-promotions.md](10-pricing-promotions.md) — `prices` per (price_list, variant)
- [15-tax-compliance.md](15-tax-compliance.md) — tax_class_code mapping
- [23-i18n.md](23-i18n.md) — `translations` univerzální tabulka
- [28-developer-platform.md](28-developer-platform.md) — plugin hooks + custom attribute registration
- [33-ai-features.md](33-ai-features.md) — AI Copilot: description gen, alt-text gen
- [34-industry-profiles.md](34-industry-profiles.md) — vertical attribute packs

---

## 2. Personas

Detail v [36-personas-rbac.md](36-personas-rbac.md). Pro PIM doménu relevantní:

| Persona | Použití | Klíčové permissions |
|---|---|---|
| `PERSONA-MERCHANT-OWNER` | Full kontrola katalogu | `PERM-PRODUCT-*` (all) |
| `PERSONA-CATALOG-MANAGER` | Produktový manager, edituje produkty + varianty + media | `PERM-PRODUCT-VIEW/CREATE/UPDATE/DELETE`, `PERM-PRODUCT-IMPORT/EXPORT` |
| `PERSONA-CATALOG-EDITOR` | Pisatel obsahu (jen text + media, ne ceny ani sklad) | `PERM-PRODUCT-VIEW/UPDATE` (s field-level: jen `title`, `description_html`, `seo_*`, `media`) |
| `PERSONA-MERCHANT-VIEWER` | Read-only | `PERM-PRODUCT-VIEW` |
| `PERSONA-PLATFORM-STAFF` | Support staff impersonate | `PERM-PRODUCT-*` + audit log |
| `PERSONA-AI-COPILOT` (agent) | Description gen, alt-text gen, tagging | `agent:catalog:read`, `agent:catalog:write` (scope `description`, `alt_text`, `tags`) |
| `PERSONA-CUSTOMER` | Storefront browsing | žádné DB permissions — public REST/GraphQL endpointy s anon scope |
| `PERSONA-EXTERNAL-AGENT` (např. OpenAI Operator) | Read katalog přes MCP | `agent:catalog:read` |

---

## 3. Data models

Definováno v `03-data-models-master.md`. Zde rozšíření, indexy a vztahy specifické pro tuto doménu.

### 3.1 `products` ([ENT-PRODUCT-001](03-data-models-master.md#ent-product-001))

Rozšíření z `03 §4`:

```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  pub_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description_html TEXT NULL,
  short_description TEXT NULL,                    -- meta description / list view
  type TEXT NOT NULL CHECK (type IN ('simple','variable','bundle','digital','service','gift_card')),
  status TEXT NOT NULL CHECK (status IN ('draft','active','archived')) DEFAULT 'draft',
  vendor_id UUID NULL REFERENCES vendors(id),
  brand_id UUID NULL REFERENCES brands(id),
  primary_category_id UUID NULL REFERENCES categories(id),
  is_taxable BOOLEAN NOT NULL DEFAULT true,
  tax_class_code TEXT NULL,                        -- viz 15-tax-compliance.md
  available_from TIMESTAMPTZ NULL,
  available_until TIMESTAMPTZ NULL,
  seo_title TEXT NULL,
  seo_description TEXT NULL,
  weight_grams INTEGER NULL,                        -- default pro varianty
  tags TEXT[] NOT NULL DEFAULT '{}',                -- merchant-defined tags
  embedding VECTOR(1024) NULL,                      -- pgvector, semantic search (opt-in)
  -- standard audit fields:
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL REFERENCES users(id),
  updated_by UUID NULL REFERENCES users(id),
  version INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_products_tenant_pub_id UNIQUE (tenant_id, pub_id),
  CONSTRAINT ck_products_available_window CHECK (available_until IS NULL OR available_from IS NULL OR available_until > available_from)
);

CREATE UNIQUE INDEX uq_products_tenant_slug_default_locale
  ON products (tenant_id, slug)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_products_tenant_status
  ON products (tenant_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_products_tenant_type
  ON products (tenant_id, type)
  WHERE deleted_at IS NULL AND status = 'active';

CREATE INDEX idx_products_metadata_gin
  ON products USING GIN (metadata jsonb_path_ops);

CREATE INDEX idx_products_tags_gin
  ON products USING GIN (tags);

CREATE INDEX idx_products_brand_id
  ON products (brand_id)
  WHERE brand_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_products_embedding_hnsw
  ON products USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL;
```

**RLS policy:**

```sql
CREATE POLICY rls_products_tenant_isolation ON products
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
-- Disabled v CE flagem ENABLE_RLS=false (DEC-ARCH-004)
```

### 3.2 `product_variants` ([ENT-PRODUCT-002](03-data-models-master.md#ent-product-002))

```sql
CREATE TABLE product_variants (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  barcode TEXT NULL,
  title TEXT NULL,
  option_values JSONB NOT NULL DEFAULT '{}'::jsonb,  -- {"color":"red","size":"M"}
  weight_grams INTEGER NULL,
  dimensions JSONB NULL,                              -- {"length_mm","width_mm","height_mm"}
  is_active BOOLEAN NOT NULL DEFAULT true,
  requires_shipping BOOLEAN NOT NULL DEFAULT true,
  position INTEGER NOT NULL DEFAULT 0,
  -- standard audit fields ...

  CONSTRAINT uq_variants_tenant_sku UNIQUE (tenant_id, sku),
  CONSTRAINT ck_variants_position_non_negative CHECK (position >= 0)
);

CREATE INDEX idx_variants_product ON product_variants (product_id, position);
CREATE INDEX idx_variants_barcode ON product_variants (tenant_id, barcode) WHERE barcode IS NOT NULL;
```

**Invariant:** Každý produkt má alespoň 1 variant (i `simple` produkt). Vynucené aplikační vrstvou v `ProductService.create()` (atomická vlastnost).

### 3.3 `product_options` ([ENT-PRODUCT-003](03-data-models-master.md#ent-product-003))

```sql
CREATE TABLE product_options (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                              -- 'color', 'size', 'material'
  display_name TEXT NULL,                          -- per-default-locale display
  values TEXT[] NOT NULL DEFAULT '{}',
  display_strategy TEXT NOT NULL CHECK (display_strategy IN ('select','swatch','radio')) DEFAULT 'select',
  position INTEGER NOT NULL DEFAULT 0,
  -- audit fields ...

  CONSTRAINT uq_options_product_name UNIQUE (product_id, name)
);
```

### 3.4 `product_media` ([ENT-PRODUCT-004](03-data-models-master.md#ent-product-004))

```sql
CREATE TABLE product_media (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  product_id UUID NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  media_id UUID NOT NULL REFERENCES media(id),
  alt_text TEXT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  role TEXT NOT NULL CHECK (role IN ('gallery','swatch','lifestyle','360','video','document')) DEFAULT 'gallery',
  -- audit fields ...

  CONSTRAINT ck_product_media_owner CHECK (
    (product_id IS NOT NULL AND variant_id IS NULL) OR
    (variant_id IS NOT NULL)
  )
);

CREATE INDEX idx_product_media_product ON product_media (product_id, position) WHERE product_id IS NOT NULL;
CREATE INDEX idx_product_media_variant ON product_media (variant_id, position) WHERE variant_id IS NOT NULL;
```

### 3.5 `product_bundle_items` ([ENT-PRODUCT-005](03-data-models-master.md#ent-product-005))

```sql
CREATE TABLE product_bundle_items (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  bundle_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  child_variant_id UUID NOT NULL REFERENCES product_variants(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  is_optional BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL DEFAULT 0,
  -- audit fields ...

  CONSTRAINT uq_bundle_items UNIQUE (bundle_id, child_variant_id),
  CONSTRAINT ck_bundle_no_self_reference CHECK (bundle_id <> child_variant_id::text::uuid)
);

-- Trigger zakáže cyklus (bundle → child_variant → product → bundle)
-- Implementováno v aplikační vrstvě (snadnější testovat než PL/pgSQL recursive CTE check)
```

**Invariant:** Bundle (`products.type='bundle'`) má 1+ bundle_items; non-bundle nemá žádný. Vynucené v aplikační vrstvě + opt-in DB trigger.

### 3.6 Vendors, Brands, Attributes

```sql
CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  contact_email CITEXT NULL,
  contact_phone TEXT NULL,
  default_lead_time_days INTEGER NULL,
  notes TEXT NULL,
  -- audit fields ...
  CONSTRAINT uq_vendors_tenant_name UNIQUE (tenant_id, name)
);

CREATE TABLE brands (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  logo_media_id UUID NULL REFERENCES media(id),
  description_html TEXT NULL,
  website_url TEXT NULL,
  -- audit fields ...
  CONSTRAINT uq_brands_tenant_slug UNIQUE (tenant_id, slug),
  CONSTRAINT uq_brands_tenant_name UNIQUE (tenant_id, name)
);

CREATE TABLE attributes (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  key TEXT NOT NULL,                                       -- snake_case, used in metadata.{key}
  label TEXT NOT NULL,
  data_type TEXT NOT NULL CHECK (data_type IN ('text','number','boolean','enum','date','url','color','json')),
  is_facetable BOOLEAN NOT NULL DEFAULT false,
  is_searchable BOOLEAN NOT NULL DEFAULT false,
  is_required BOOLEAN NOT NULL DEFAULT false,
  enum_values TEXT[] NULL,
  applies_to TEXT[] NOT NULL DEFAULT '{}',                  -- ['product','variant','category','customer']
  unit TEXT NULL,                                           -- 'kg', 'cm', 'ml', '%', display only
  validation JSONB NULL,                                    -- {min, max, pattern, ...}
  position INTEGER NOT NULL DEFAULT 0,
  group_code TEXT NULL,                                     -- pro UI seskupení (Specifications, Care, ...)
  industry_profile_code TEXT NULL,                           -- viz 34-industry-profiles.md
  -- audit fields ...
  CONSTRAINT uq_attributes_tenant_key UNIQUE (tenant_id, key)
);
```

### 3.7 `media`

```sql
CREATE TABLE media (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('image','video','document','audio','3d')),
  storage_key TEXT NOT NULL,
  storage_provider TEXT NOT NULL DEFAULT 's3',
  mime_type TEXT NOT NULL,
  bytes BIGINT NOT NULL,
  width_px INTEGER NULL,
  height_px INTEGER NULL,
  duration_ms INTEGER NULL,
  checksum_sha256 TEXT NOT NULL,
  processing_status TEXT NOT NULL CHECK (processing_status IN ('pending','ready','failed')) DEFAULT 'pending',
  processing_error TEXT NULL,
  ai_generated_alt JSONB NULL,                              -- per-locale AI alt-text
  ai_generated_tags TEXT[] NULL,
  original_filename TEXT NULL,
  -- audit fields ...
  CONSTRAINT uq_media_tenant_checksum UNIQUE (tenant_id, checksum_sha256)
);

CREATE INDEX idx_media_processing_pending
  ON media (created_at)
  WHERE processing_status = 'pending';
```

### 3.8 Vztahy (per-table summary)

```
products (1)──(N) product_variants
products (1)──(N) product_options
products (1)──(N) product_media
products (1)──(N) product_bundle_items   [pro type='bundle']
products (N)──(1) vendors                 [nullable]
products (N)──(1) brands                  [nullable]
products (N)──(1) categories              [primary_category, nullable]
products (N)──(M) categories              [všechny kategorie via product_categories — viz 07]
products (N)──(M) collections             [via product_collections — viz 07]
product_variants (1)──(1) inventory_items [viz 09]
product_variants (1)──(N) prices          [via price_lists — viz 10]
product_variants (1)──(N) product_media   [variant-specific images]
product_media (N)──(1) media              [storage layer]
product_bundle_items (N)──(1) product_variants  [child]
attributes (N)──(?) products              [via metadata JSONB key=value — žádná join table]
```

---

## 4. State machines

### 4.1 Product lifecycle

```
        ┌──────────┐  publish      ┌──────────┐
        │  draft   │ ─────────────▶│  active  │
        └──────────┘               └─────┬────┘
              ▲                          │
              │ restore                  │ archive
              │                          ▼
              │                    ┌──────────┐
              └────────────────────│ archived │
                  unarchive        └──────────┘
                                         │
                                         │ delete (soft, retention 90d)
                                         ▼
                                    [deleted_at set]
```

**Přechody:**

| From | Event | To | Side-effect |
|---|---|---|---|
| `draft` | `publish` | `active` | EVENT-PRODUCT-PUBLISHED; trigger search reindex; require `tax_class_code` set; require ≥1 active variant; require ≥1 image (warning, ne hard-fail) |
| `active` | `archive` | `archived` | EVENT-PRODUCT-ARCHIVED; remove from search index; remove from active collections (manual ones zachovat, automatic preserve link) |
| `archived` | `unarchive` | `active` | EVENT-PRODUCT-PUBLISHED; reindex |
| `archived` / `draft` | `restore` (po soft-delete) | předchozí status | EVENT-PRODUCT-RESTORED |
| any | `soft_delete` | (deleted_at set) | EVENT-PRODUCT-DELETED; remove from search index; orphan checks v open carts/orders trigger warning to merchant |

**Žádné** `pending_review` ani `scheduled` jako samostatný status — `available_from` v budoucnosti = produkt je `active` ale storefront filtr ho skryje. Detail v RULE-PRODUCT-005.

### 4.2 Variant lifecycle

```
[exists, is_active=false] ◀──── [exists, is_active=true]
```

Mazání variantu je **soft delete + flag is_active=false**. Hard delete jen pokud variant nikdy nebyl v žádné order_item nebo cart_item (referenční integrita).

### 4.3 Media processing pipeline

```
upload      → [pending]   → [processing_status='pending']
   │
   ▼ JOB-MEDIA-PROCESS
process variants (resize, format) → [ready]
   │
   ▼ JOB-AI-GENERATE-ALT (volitelně, async)
AI alt-text generation → ai_generated_alt populated
```

**Failure path:** `processing_status='failed'` + `processing_error` text. Retry přes admin "Reprocess" akci nebo automatický job 3× s exponential backoff.

---

## 5. Business rules

### RULE-PRODUCT-001: Unikátní SKU per tenant
SKU je merchant-defined, **musí být unikátní v rámci tenanta** napříč všemi variants (i archived a soft-deleted). Důvod: integrace s POS, účetnictvím, marketplace exporty potřebují stable identifier.

**Vynucení:** `UNIQUE (tenant_id, sku)` constraint. Při violation → `409 Conflict` s code `DUPLICATE_SKU`.

### RULE-PRODUCT-002: Slug unikátní per locale
`(tenant_id, slug)` UNIQUE v default locale. Per-locale slugs v `translations` tabulce mají vlastní UNIQUE `(tenant_id, locale, slug)`.

Při kolizi auto-suffix `lampa-luna` → `lampa-luna-2` (configurable).

### RULE-PRODUCT-003: Variable produkt musí mít options
Pokud `products.type = 'variable'`, musí existovat ≥1 `product_options` a každá `product_variants.option_values` musí mít všechny option names jako klíče.

```jsonc
// product.type = 'variable'
// product_options: [{ name: 'color', values: ['red','blue'] }, { name: 'size', values: ['M','L'] }]
// variant.option_values MUST be: { "color": "red", "size": "M" }
```

### RULE-PRODUCT-004: Bundle nesmí cyklit
`product_bundle_items.child_variant_id` nesmí ukazovat na variant produktu, který je sám bundle a (rekurzivně) obsahuje původní produkt.

**Vynucení:** aplikační check + opt-in DB trigger s recursive CTE.

### RULE-PRODUCT-005: Available window
- Pokud `available_from` v budoucnosti: produkt je `active` v DB, ale storefront query filtruje `available_from <= now()`
- Pokud `available_until` v minulosti: storefront ho skryje, admin vidí jako "expired" badge; **status zůstává `active`** (auto-archive je merchant decision, ne automatic)
- B2B/Cloud "scheduled publish" feature může auto-toggle status přes CRON-PUBLISH-SCHEDULED-PRODUCTS (Fáze 2)

### RULE-PRODUCT-006: Tax class povinný před publish
Při `status` přechodu `draft → active`: `tax_class_code` musí být set (default `standard` při auto-fill, ale merchant musí potvrdit). Důvod: tax engine bude failovat při checkout, lepší blokovat publish.

### RULE-PRODUCT-007: Active produkt potřebuje ≥1 active variant
Publish failuje pokud produkt nemá ani jednu `is_active=true` variantu.

Edge: `simple` produkt automaticky má 1 default variant při create (ProductService.create internal logic).

### RULE-PRODUCT-008: Variant delete vs order references
Variant lze hard-delete **pouze** pokud:
- Nikdy nebyl v `order_items`
- Nikdy nebyl v `cart_items`
- Nemá `inventory_items` s `on_hand > 0`

Jinak → soft delete (`is_active=false`, `deleted_at` set). Storefront ho nezobrazuje, ale historické objednávky zůstávají platné (order_items mají snapshot title/sku/price).

### RULE-PRODUCT-009: Digital/service produkty
- `type IN ('digital','service','gift_card')` → `requires_shipping=false` na všech variantách (vynuceno trigger)
- `weight_grams` ignorován v shipping calc
- Při fulfillment: digital → email s download link; service → no fulfillment workflow (manual); gift_card → generate code (viz `10` pricing)

### RULE-PRODUCT-010: Brand a Vendor jsou nezávislé
Brand = customer-facing značka (Nike, Apple). Vendor = supplier (Innogy s.r.o., dropshipping partner). Mohou se překrývat (Nike samo prodává), ale modelově odděleno.

### RULE-PRODUCT-011: Custom attribute validace
Attributes registered v `attributes` table mají validation rules (JSONB). PIM service validuje `products.metadata` proti registered attributes při create/update.

```jsonc
// attributes record:
{ "key": "warranty_months", "data_type": "number", "validation": { "min": 0, "max": 240 }}

// product.metadata: { "warranty_months": 24 } ✅
// product.metadata: { "warranty_months": -1 } ❌ → 422 VALIDATION_FAILED
```

### RULE-PRODUCT-012: Media alt-text accessibility
Při publish: warning (ne hard-fail) pokud produkt má media bez `alt_text` v default locale. AI alt-text generation lze auto-trigger (DEC-AI-001), ale merchant musí potvrdit (WCAG accuracy concern).

### RULE-PRODUCT-013: Bundle pricing
Bundle cena **NENÍ** automaticky součet child variant cen. Bundle má vlastní záznam v `prices` tabulce. Discount oproti součtu řeší `discounts` engine (typ `bundle`).

### RULE-PRODUCT-014: Soft-deleted parent zakazuje cart add
Pokud produkt nebo variant je soft-deleted (`deleted_at IS NOT NULL`) nebo `is_active=false`: cart add → `422 PRODUCT_UNAVAILABLE`. Stávající cart_items s tímto variantem jsou flagged jako "unavailable" — checkout je odmítne.

### RULE-PRODUCT-015: Embedding lazy generation
`embedding vector(1024)` se generuje **on-demand** přes JOB-PRODUCT-EMBED z `title + description_html + tags`. Trigger: `EVENT-PRODUCT-UPDATED` při změně sémantického obsahu (debounced 60s). Provider per DEC-AI-001 (Anthropic Claude pro embeddings v1 — pozor, Claude embeddings nejsou nativně, používáme OpenAI `text-embedding-3-small` jako default, override per tenant).

---

## 6. REST API endpoints

Konvence v `04-api-conventions.md`. Verze `{date}` = `2026-05-19` (initial).

### 6.1 Products

```
GET    /api/{date}/products                          # list, paginated, filterable
POST   /api/{date}/products                          # create
GET    /api/{date}/products/{id}                     # single (UUID nebo pub_id)
PATCH  /api/{date}/products/{id}                     # update (merge patch)
DELETE /api/{date}/products/{id}                     # soft delete
POST   /api/{date}/products/{id}:publish             # status: draft → active
POST   /api/{date}/products/{id}:archive             # status: active → archived
POST   /api/{date}/products/{id}:unarchive           # status: archived → active
POST   /api/{date}/products/{id}:restore             # undo soft delete
POST   /api/{date}/products/{id}:duplicate           # clone with new SKU
POST   /api/{date}/products:bulk                     # bulk create/update/delete
POST   /api/{date}/products:search                   # complex search (POST body for filter DSL)
POST   /api/{date}/products:import-csv               # async import → 202 + operation
POST   /api/{date}/products:export-csv               # async export → 202 + operation
GET    /api/{date}/products/{id}/json-ld             # SEO JSON-LD output (public storefront use)
```

### 6.2 Variants

```
GET    /api/{date}/products/{product_id}/variants    # list per product
POST   /api/{date}/products/{product_id}/variants    # create variant
GET    /api/{date}/variants/{id}                     # single (top-level pro lookup by ID)
PATCH  /api/{date}/variants/{id}                     # update
DELETE /api/{date}/variants/{id}                     # soft delete
POST   /api/{date}/variants/{id}:activate            # is_active=true
POST   /api/{date}/variants/{id}:deactivate          # is_active=false
GET    /api/{date}/variants/by-sku/{sku}             # lookup by SKU
GET    /api/{date}/variants/by-barcode/{barcode}     # lookup by barcode (POS use)
```

### 6.3 Product options

```
GET    /api/{date}/products/{product_id}/options
POST   /api/{date}/products/{product_id}/options
PATCH  /api/{date}/products/{product_id}/options/{id}
DELETE /api/{date}/products/{product_id}/options/{id}
POST   /api/{date}/products/{product_id}/options:reorder
```

### 6.4 Product media

```
GET    /api/{date}/products/{product_id}/media
POST   /api/{date}/products/{product_id}/media       # attach existing media_id
DELETE /api/{date}/products/{product_id}/media/{id}
POST   /api/{date}/products/{product_id}/media:reorder
POST   /api/{date}/products/{product_id}/media/{id}:set-alt-text     # update alt
POST   /api/{date}/products/{product_id}/media/{id}:generate-alt-text # AI gen (async)
```

### 6.5 Bundle items

```
GET    /api/{date}/products/{bundle_id}/bundle-items
POST   /api/{date}/products/{bundle_id}/bundle-items
PATCH  /api/{date}/products/{bundle_id}/bundle-items/{id}
DELETE /api/{date}/products/{bundle_id}/bundle-items/{id}
```

### 6.6 Vendors

```
GET    /api/{date}/vendors
POST   /api/{date}/vendors
GET    /api/{date}/vendors/{id}
PATCH  /api/{date}/vendors/{id}
DELETE /api/{date}/vendors/{id}
```

### 6.7 Brands

```
GET    /api/{date}/brands
POST   /api/{date}/brands
GET    /api/{date}/brands/{id}
PATCH  /api/{date}/brands/{id}
DELETE /api/{date}/brands/{id}
```

### 6.8 Attributes (schema)

```
GET    /api/{date}/attributes                         # list registered attributes
POST   /api/{date}/attributes                         # register new
GET    /api/{date}/attributes/{id}
PATCH  /api/{date}/attributes/{id}                    # update label, validation; key immutable
DELETE /api/{date}/attributes/{id}                    # soft delete, existing data preserved
```

### 6.9 Media

```
POST   /api/{date}/media:upload-init                  # signed URL flow (large files)
POST   /api/{date}/media                              # direct upload (≤5MB)
GET    /api/{date}/media/{id}
DELETE /api/{date}/media/{id}                         # detach from all products + soft delete
POST   /api/{date}/media/{id}:reprocess               # re-run transformation pipeline
```

### 6.10 Public storefront endpointy (anonymní)

```
GET    /api/{date}/storefront/products                # list active, available, in stock
GET    /api/{date}/storefront/products/{slug}          # by slug (locale negotiated)
GET    /api/{date}/storefront/products/{slug}/related  # related products
GET    /api/{date}/storefront/feeds/json              # JSON-LD feed pro AI agenty
GET    /api/{date}/storefront/feeds/google-shopping   # Google Shopping XML (Fáze 2)
GET    /api/{date}/storefront/feeds/heureka           # Heureka XML (CZ, Fáze 2 plugin)
```

### 6.11 Example: GET single product

**Request:**
```http
GET /api/2026-05-19/products/prd_aB3cD4eF5g6h HTTP/1.1
Authorization: Bearer sk_live_...
Accept-Language: cs-CZ
Shopio-Version: 2026-05-19
```

**Response:**
```jsonc
HTTP/1.1 200 OK
Content-Type: application/json
ETag: "v17-7f8c1a"
Cache-Control: private, max-age=60
Content-Language: cs-CZ

{
  "data": {
    "id": "01927bca-...",
    "pub_id": "prd_aB3cD4eF5g6h",
    "type": "product",
    "attributes": {
      "slug": "stolni-lampa-luna",
      "title": "Stolní lampa Luna",
      "short_description": "Designová LED lampa s teplým osvětlením.",
      "description_html": "<p>...</p>",
      "kind": "variable",
      "status": "active",
      "available_from": null,
      "available_until": null,
      "is_taxable": true,
      "tax_class_code": "standard",
      "weight_grams": 1200,
      "tags": ["lighting", "led", "design"],
      "seo_title": "Stolní lampa Luna | E-shop XYZ",
      "seo_description": "...",
      "metadata": {
        "warranty_months": 24,
        "country_of_origin": "CZ"
      },
      "created_at": "2026-05-10T12:34:56Z",
      "updated_at": "2026-05-18T08:21:00Z",
      "version": 17
    },
    "relationships": {
      "brand": { "id": "brd_...", "name": "Luna Design" },
      "vendor": { "id": "vnd_..." },
      "primary_category": { "id": "cat_...", "name": "Stolní lampy" },
      "variants": {
        "count": 6,
        "url": "/api/2026-05-19/products/prd_aB3cD4eF5g6h/variants"
      },
      "media": {
        "count": 12,
        "url": "/api/2026-05-19/products/prd_aB3cD4eF5g6h/media"
      }
    }
  },
  "meta": {
    "request_id": "req_01h9...",
    "version": "2026-05-19"
  }
}
```

### 6.12 Example: Create product

**Request:**
```http
POST /api/2026-05-19/products HTTP/1.1
Authorization: Bearer sk_live_...
Content-Type: application/json
Idempotency-Key: 9c9f5e2a-...

{
  "title": "Stolní lampa Luna",
  "type": "variable",
  "tax_class_code": "standard",
  "brand_id": "brd_...",
  "primary_category_id": "cat_...",
  "weight_grams": 1200,
  "tags": ["lighting", "led"],
  "options": [
    { "name": "color", "values": ["white", "black"], "display_strategy": "swatch" },
    { "name": "size", "values": ["small", "large"], "display_strategy": "select" }
  ],
  "variants": [
    { "sku": "LUNA-WHITE-S", "option_values": { "color": "white", "size": "small" }},
    { "sku": "LUNA-WHITE-L", "option_values": { "color": "white", "size": "large" }},
    { "sku": "LUNA-BLACK-S", "option_values": { "color": "black", "size": "small" }},
    { "sku": "LUNA-BLACK-L", "option_values": { "color": "black", "size": "large" }}
  ],
  "metadata": {
    "warranty_months": 24,
    "country_of_origin": "CZ"
  }
}
```

**Response:**
```http
HTTP/1.1 201 Created
Location: /api/2026-05-19/products/prd_aB3cD4eF5g6h
ETag: "v1-..."

{
  "data": { ... },
  "meta": { ... }
}
```

### 6.13 Example: Validation error

```http
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/problem+json

{
  "type": "https://docs.shopio.com/errors/validation-failed",
  "title": "Validation failed",
  "status": 422,
  "code": "VALIDATION_FAILED",
  "detail": "One or more fields failed validation.",
  "instance": "/api/2026-05-19/products",
  "request_id": "req_...",
  "errors": [
    {
      "code": "REQUIRED",
      "path": "title",
      "message": "Title is required."
    },
    {
      "code": "INVALID_ENUM",
      "path": "type",
      "message": "Type must be one of: simple, variable, bundle, digital, service, gift_card.",
      "context": { "received": "physical" }
    }
  ]
}
```

---

## 7. GraphQL schema

Mount: `/graphql`. Storefront a headless customers, plugin marketplace search.

```graphql
"""
A Product is the master entity for a sellable thing.
"""
type Product implements Node & Timestamped {
  id: ID!
  pubId: String!
  slug: String!
  title: String!
  shortDescription: String
  descriptionHtml: String
  kind: ProductKind!
  status: ProductStatus!
  isAvailable: Boolean!                         # computed: status=active AND now ∈ available window
  taxClassCode: String
  brand: Brand
  vendor: Vendor
  primaryCategory: Category
  categories: [Category!]!
  collections: [Collection!]!
  variants: [ProductVariant!]!
  options: [ProductOption!]!
  media(role: ProductMediaRole, first: Int = 20): [ProductMedia!]!
  bundleItems: [ProductBundleItem!]!            # null pro non-bundle
  weightGrams: Int
  tags: [String!]!
  seoTitle: String
  seoDescription: String
  metadata: JSON!
  availableFrom: DateTime
  availableUntil: DateTime
  createdAt: DateTime!
  updatedAt: DateTime!
  jsonLd: JSON!                                  # Product/Offer schema.org
  # Pricing & inventory live on variants (see 09, 10)
}

enum ProductKind {
  SIMPLE
  VARIABLE
  BUNDLE
  DIGITAL
  SERVICE
  GIFT_CARD
}

enum ProductStatus {
  DRAFT
  ACTIVE
  ARCHIVED
}

type ProductVariant implements Node & Timestamped {
  id: ID!
  pubId: String!
  product: Product!
  sku: String!
  barcode: String
  title: String                                   # null = "{product.title} ({option_values})"
  displayTitle: String!                           # computed
  optionValues: JSON!
  isActive: Boolean!
  requiresShipping: Boolean!
  weightGrams: Int
  dimensions: VariantDimensions
  media: [ProductMedia!]!
  # Cross-domain (resolvers fetch z 09, 10):
  inventory: InventoryView!                        # viz 09-inventory.md
  price(priceListId: ID, currency: String): Money  # viz 10-pricing-promotions.md
  createdAt: DateTime!
  updatedAt: DateTime!
}

type VariantDimensions {
  lengthMm: Int
  widthMm: Int
  heightMm: Int
}

type ProductOption {
  id: ID!
  name: String!
  displayName: String!
  values: [String!]!
  displayStrategy: ProductOptionDisplayStrategy!
  position: Int!
}

enum ProductOptionDisplayStrategy {
  SELECT
  SWATCH
  RADIO
}

type ProductMedia {
  id: ID!
  media: Media!
  altText: String
  role: ProductMediaRole!
  position: Int!
}

enum ProductMediaRole {
  GALLERY
  SWATCH
  LIFESTYLE
  THREE_SIXTY
  VIDEO
  DOCUMENT
}

type Media {
  id: ID!
  kind: MediaKind!
  url(transform: MediaTransform): String!         # signed URL with imgproxy params
  mimeType: String!
  bytes: Int!
  widthPx: Int
  heightPx: Int
  durationMs: Int
}

enum MediaKind { IMAGE VIDEO DOCUMENT AUDIO THREE_D }

input MediaTransform {
  width: Int
  height: Int
  format: MediaFormat
  fit: MediaFit
  quality: Int
}

type ProductBundleItem {
  id: ID!
  childVariant: ProductVariant!
  quantity: Int!
  isOptional: Boolean!
  position: Int!
}

type Brand implements Node {
  id: ID!
  name: String!
  slug: String!
  description: String
  logo: Media
  website: String
}

type Vendor implements Node {
  id: ID!
  name: String!
}

# Connection types (Relay)
type ProductConnection {
  edges: [ProductEdge!]!
  pageInfo: PageInfo!
  totalCount: Int
}
type ProductEdge { node: Product!  cursor: String! }

# Queries
extend type Query {
  products(
    first: Int = 50
    after: String
    filter: ProductFilter
    sort: [ProductSort!]
  ): ProductConnection!

  product(id: ID, slug: String): Product           # one-of (validated by resolver)
  productByPubId(pubId: String!): Product
  variant(id: ID, sku: String): ProductVariant
  brands(first: Int = 50, after: String): BrandConnection!
  brand(id: ID, slug: String): Brand
}

input ProductFilter {
  status: [ProductStatus!]
  kind: [ProductKind!]
  brandId: ID
  primaryCategoryId: ID
  tags: [String!]
  available: Boolean                                # storefront default = true
  search: String                                    # full-text via Meilisearch
  priceMin: Money                                   # cross-domain → viz 10
  priceMax: Money
}

input ProductSort {
  field: ProductSortField!
  direction: SortDirection! = ASC
}

enum ProductSortField {
  CREATED_AT
  UPDATED_AT
  TITLE
  PRICE
  POPULARITY                                       # derived metric (Fáze 2)
}

# Mutations (admin only via @auth directive)
extend type Mutation {
  createProduct(input: ProductCreateInput!): ProductPayload!
    @auth(requires: PERM_PRODUCT_CREATE)

  updateProduct(id: ID!, input: ProductUpdateInput!, ifMatch: String): ProductPayload!
    @auth(requires: PERM_PRODUCT_UPDATE)

  publishProduct(id: ID!): ProductPayload!
    @auth(requires: PERM_PRODUCT_UPDATE)

  archiveProduct(id: ID!): ProductPayload!
    @auth(requires: PERM_PRODUCT_UPDATE)

  deleteProduct(id: ID!): DeletePayload!
    @auth(requires: PERM_PRODUCT_DELETE)

  duplicateProduct(id: ID!, newSku: String!): ProductPayload!
    @auth(requires: PERM_PRODUCT_CREATE)
}

type ProductPayload {
  product: Product
  userErrors: [UserError!]!
}

input ProductCreateInput {
  title: String!
  slug: String
  shortDescription: String
  descriptionHtml: String
  kind: ProductKind = SIMPLE
  taxClassCode: String!
  brandId: ID
  primaryCategoryId: ID
  weightGrams: Int
  tags: [String!]
  metadata: JSON
  options: [ProductOptionInput!]
  variants: [ProductVariantInput!]
}

input ProductUpdateInput {
  title: String
  slug: String
  shortDescription: String
  descriptionHtml: String
  taxClassCode: String
  brandId: ID
  primaryCategoryId: ID
  weightGrams: Int
  tags: [String!]
  metadata: JSON
}

input ProductOptionInput {
  name: String!
  values: [String!]!
  displayStrategy: ProductOptionDisplayStrategy = SELECT
}

input ProductVariantInput {
  sku: String!
  barcode: String
  optionValues: JSON!
  weightGrams: Int
  requiresShipping: Boolean = true
}
```

**Query complexity:** Product s `variants.inventory + variants.price + media` má cost ~30. Default limit per request = 1000 (DEC-API-001 — viz `04 §20.6`).

---

## 8. Events

Vše přes EventBus + outbox pattern (DEC-EVENTS-001). Build-spec ID + wire jméno:

| Build-spec ID | Wire (webhook out) | Payload |
|---|---|---|
| `EVENT-PRODUCT-CREATED` | `product.created` | `{ product: Product }` |
| `EVENT-PRODUCT-UPDATED` | `product.updated` | `{ product: Product, previous_attributes: Partial<Product> }` |
| `EVENT-PRODUCT-PUBLISHED` | `product.published` | `{ product: Product }` |
| `EVENT-PRODUCT-ARCHIVED` | `product.archived` | `{ product: Product }` |
| `EVENT-PRODUCT-DELETED` | `product.deleted` | `{ product_id, pub_id, soft_deleted_at }` |
| `EVENT-PRODUCT-RESTORED` | `product.restored` | `{ product: Product }` |
| `EVENT-VARIANT-CREATED` | `variant.created` | `{ variant: Variant }` |
| `EVENT-VARIANT-UPDATED` | `variant.updated` | `{ variant: Variant, previous_attributes: Partial<Variant> }` |
| `EVENT-VARIANT-DEACTIVATED` | `variant.deactivated` | `{ variant: Variant }` |
| `EVENT-VARIANT-DELETED` | `variant.deleted` | `{ variant_id, sku, product_id }` |
| `EVENT-MEDIA-UPLOADED` | `media.uploaded` | `{ media: Media }` |
| `EVENT-MEDIA-PROCESSED` | `media.processed` | `{ media: Media }` |
| `EVENT-MEDIA-PROCESSING-FAILED` | `media.processing_failed` | `{ media_id, error }` |
| `EVENT-BRAND-CREATED` | `brand.created` | `{ brand: Brand }` |
| `EVENT-BRAND-UPDATED` | `brand.updated` | `{ brand: Brand }` |
| `EVENT-ATTRIBUTE-REGISTERED` | `attribute.registered` | `{ attribute: Attribute }` |

**Konzumenti (interní):**
- **Search indexer** (`08`) konzumuje `product.*`, `variant.*` → reindex Meilisearch
- **Cache invalidator** (CDN, `31`) konzumuje `product.*` → purge `product:{id}` keys
- **Embedding generator** (`33`) konzumuje `product.updated` debounced → JOB-PRODUCT-EMBED
- **Audit log** (`30`) konzumuje vše s actor kontext
- **Webhook delivery** (`28`) fanout dle merchant subscriptions

**Payload pravidla:**
- Vždy `tenant_id`, `event_id`, `event_type`, `occurred_at`, `actor_kind`, `actor_id` na top-level (added by EventBus wrapper)
- Plný product snapshot vs delta — full snapshot pro `*.created`, `*.published`, `*.archived`; delta + full pro `*.updated`
- Žádné PII v product events (catalog je publicly visible)

---

## 9. Background jobs

| Job | Trigger | Queue | Frequency |
|---|---|---|---|
| `JOB-MEDIA-PROCESS` | EVENT-MEDIA-UPLOADED | `media-process` | On-demand |
| `JOB-MEDIA-GENERATE-ALT` | manual API call nebo auto-flag | `ai-tasks` | On-demand |
| `JOB-PRODUCT-EMBED` | EVENT-PRODUCT-UPDATED (debounced 60s) | `ai-tasks` | On-demand |
| `JOB-IMPORT-PRODUCTS-CSV` | POST `/products:import-csv` | `imports` | On-demand |
| `JOB-EXPORT-PRODUCTS-CSV` | POST `/products:export-csv` | `exports` | On-demand |
| `JOB-PURGE-DELETED-PRODUCTS` | scheduled | `maintenance` | Daily 03:00 |
| `JOB-RECALCULATE-PRODUCT-METRICS` | scheduled | `analytics` | Hourly |
| `JOB-DETECT-BUNDLE-CYCLES` | EVENT-PRODUCT-CREATED s type=bundle nebo EVENT-PRODUCT-BUNDLE-UPDATED | `integrity-checks` | On-demand |
| `JOB-VALIDATE-PRODUCT-COMPLIANCE` | EVENT-PRODUCT-PUBLISHED + scheduled audit | `compliance` | On publish + daily |
| `CRON-PUBLISH-SCHEDULED-PRODUCTS` | scheduled | `scheduler` | Every 5 minutes |
| `CRON-DETECT-MISSING-ALT-TEXT` | scheduled | `accessibility` | Daily |

### 9.1 JOB-MEDIA-PROCESS detail

Vstup: `media_id`. Steps:
1. Stáhni original z S3 dle `storage_key`
2. Generuj variant sizes (1x, 2x, 3x) pro web (responsive img srcset) — typicky 320, 640, 960, 1280, 1920 px wide
3. Generuj formaty: original, WebP, AVIF (next-gen kde supported)
4. Strip EXIF metadata (privacy)
5. Calculate dominant color (pro placeholder při lazy load)
6. Generate LQIP (low quality image placeholder) base64 inline
7. Update `media`: `processing_status='ready'`, `width_px`, `height_px`, `metadata.dominant_color`, `metadata.lqip`
8. Emit `EVENT-MEDIA-PROCESSED`

**Failure:** 3× retry s exponential backoff. Pak `processing_status='failed'` + admin notification.

**Self-host:** imgproxy on-the-fly (no pre-generated variants on disk). Cloud: Cloudflare Images (pre-flight optimization).

### 9.2 JOB-IMPORT-PRODUCTS-CSV detail

Vstup: signed URL pro CSV soubor, mapping config. Steps:
1. Stream parse CSV (streaming, ne load do paměti — file může mít 100k+ řádků)
2. Per řádek: validate via Zod schema; collect errors do report buffer
3. Při error count < threshold (configurable, default 100): batch insert/update v transakcích po 500 řádcích
4. Při error count ≥ threshold: abort, vrať report bez aplikování změn
5. Vygeneruj report (success count, error count, per-error detail) → upload S3, vrať signed URL klientovi přes `operations.result_url`
6. Audit log: `import.products` s aggregate stats

**Idempotency:** `idempotency_key` v requestu mapuje na `imports.operation_id`. Druhé spuštění stejného CSV → reuse, vrať identický result.

---

## 10. UI/UX flows

Detail wireframes v `35-graphic-templates.md`. Zde flow-level.

### FLOW-PRODUCT-001: Create new product (admin)

```
[Catalog dashboard]
        │
        │  click "New product"
        ▼
[New product form — wizard]
   Step 1: Basic info (title, slug, kind, brand)
        │
        ▼
   Step 2: Variants (if kind=variable: options + matrix; else: skip)
        │
        ▼
   Step 3: Media (drag-drop upload, set primary, alt text)
        │
        ▼
   Step 4: Pricing (per variant; cross-domain hand-off to 10)
        │
        ▼
   Step 5: Inventory (per variant; cross-domain hand-off to 09)
        │
        ▼
   Step 6: Categorization (primary + additional cats, tags, collections)
        │
        ▼
   Step 7: SEO (auto-generated default + override)
        │
        ▼
   Step 8: Custom attributes (per registered attributes for tenant)
        │
        ▼
   Step 9: Review & Publish
        │
        │  Save as Draft  |  Publish now  |  Schedule publish
        ▼
[Product detail view]
```

**Non-wizard fallback:** "Quick create" — title + SKU + price → creates draft → redirect to full editor.

### FLOW-PRODUCT-002: Bulk edit (admin)

```
[Product list]
        │
        │  Select N products (checkbox)
        ▼
[Bulk action menu]
   Options: Edit prices · Change status · Add tags · Move to category · Delete · Export
        │
        ▼
[Bulk edit modal — specific to action]
        │
        │  Preview affected products (N)  |  Confirm
        ▼
[Async job → operation toast]
        │
        ▼
[Refresh list with badge "N products updated"]
```

### FLOW-PRODUCT-003: CSV import (admin)

```
[Catalog dashboard]
   click "Import"
        │
        ▼
[Import wizard]
   Step 1: Upload CSV file (drag-drop, max 100 MB)
   Step 2: Map CSV columns to product fields (visual mapper)
   Step 3: Preview (first 10 rows mapped)
   Step 4: Validate dry-run → show error count + sample errors
   Step 5: Confirm → start async job → 202 + operation ID
        │
        ▼
[Operation tracking panel]
   Live progress (websocket or polling)
   On complete: download report
```

### FLOW-PRODUCT-004: Storefront product detail (customer)

```
[Storefront /products/{slug}]
   - Hero image gallery (swipeable, zoomable)
   - Title, brand, price, rating
   - Variant picker (color swatches, size dropdowns)
   - Quantity stepper
   - "Add to cart" CTA (sticky on mobile scroll)
   - Stock badge (in stock / low stock / pre-order)
   - Tabs: Description · Specifications · Shipping · Reviews
   - Related products (collection-based + AI-recommended)
   - Recently viewed
   - JSON-LD inline (SEO)
```

**Mobile:** sticky bottom bar s price + add-to-cart vždy viditelný.

### FLOW-PRODUCT-005: Customer browses via AI agent (MCP)

```
[External AI agent (Claude, Operator)]
   1. agent.discover_tools → seznam MCP tools
   2. agent.call("catalog.search_products", { query: "stolní lampa do 2000 Kč", filters: { brand: "Luna" }})
   3. server returns top 10 products with: id, pub_id, title, price, image_url, rating, in_stock
   4. agent.call("catalog.get_product", { pub_id: "prd_aB3cD..." })
   5. server returns full Product + variants + media
   6. (v1.0+) agent.call("cart.add_item", { variant_id: "...", quantity: 1 }) — vyžaduje agent token s cart:write scope
```

---

## 11. Edge cases & error handling

| Scenario | Behavior | Error code |
|---|---|---|
| Create product with duplicate SKU | Reject | `DUPLICATE_SKU`, 409 |
| Create variable product without options | Reject | `MISSING_OPTIONS`, 422 |
| Create variant with option_values not matching options | Reject | `INVALID_OPTION_VALUES`, 422 |
| Bundle product cycle | Reject | `BUNDLE_CYCLE_DETECTED`, 422 |
| Publish product without tax_class_code | Reject | `MISSING_TAX_CLASS`, 422 |
| Publish product with no active variants | Reject | `NO_ACTIVE_VARIANTS`, 422 |
| Delete variant with open orders | Soft delete (`is_active=false`, `deleted_at` set), preserve historical orders | (success, soft delete is intended behavior) |
| Update product with stale ETag (If-Match mismatch) | Reject | `RESOURCE_VERSION_MISMATCH`, 412 |
| Upload media exceeding 5MB via direct upload | Reject, suggest signed URL flow | `FILE_TOO_LARGE`, 413 |
| Upload media with virus/malware detection (ClamAV) | Reject, audit log alert | `MEDIA_REJECTED`, 422 |
| Image upload with EXIF GPS location | Strip (privacy by default) | (success, transparent) |
| Slug collision on create (same slug exists) | Auto-suffix `-2`, `-3`, … (configurable; alternative: 409) | (success) |
| Translation missing for non-default locale | Fallback to default locale + `Shopio-Translation-Fallback: cs-CZ` header | (success with warning) |
| Storefront request for archived/draft product | 404 (don't reveal existence) | `NOT_FOUND`, 404 |
| Admin request for soft-deleted product | 410 with restore option link | `RESOURCE_DELETED`, 410 |
| Concurrent variant SKU rename | Optimistic lock via version | `RESOURCE_VERSION_MISMATCH`, 412 |
| Custom attribute key conflicts with reserved field (e.g., `title`) | Reject | `ATTRIBUTE_KEY_RESERVED`, 422 |
| Import CSV with > 10 % error rows | Abort transaction, return report; do not apply | `IMPORT_ERROR_THRESHOLD_EXCEEDED`, 422 |
| Media upload with `processing_status=failed` → still attach to product | Allow attach, but warn at publish | (warning, not error) |
| Bundle item references soft-deleted variant | Block publish; show "missing items" in admin | `BUNDLE_INVALID_REFERENCE`, 422 |
| Product with `available_from > now()` → cart add | Reject | `PRODUCT_NOT_YET_AVAILABLE`, 422 |
| Product with `available_until < now()` → cart add | Reject | `PRODUCT_EXPIRED`, 422 |

---

## 12. Performance

Reference [DEC-PERF-001](01-decisions-registry.md#dec-perf-001-performance-targets).

### 12.1 Targets

| Operation | p50 | p95 | p99 |
|---|---|---|---|
| `GET /products/{id}` (cached) | 15 ms | 40 ms | 80 ms |
| `GET /products/{id}` (cache miss) | 30 ms | 80 ms | 150 ms |
| `GET /products` (list, paginated 50) | 50 ms | 150 ms | 300 ms |
| `POST /products` (create simple) | 80 ms | 200 ms | 400 ms |
| `POST /products` (create variable, 10 variants) | 200 ms | 500 ms | 1000 ms |
| `PATCH /products/{id}` | 50 ms | 150 ms | 300 ms |
| `POST /products:search` (Meilisearch) | 30 ms | 100 ms | 200 ms |
| `POST /storefront/products` (anonymous, cached) | 5 ms | 15 ms | 40 ms |
| GraphQL `products` query (50 items) | 60 ms | 180 ms | 400 ms |
| Media upload init (signed URL gen) | 20 ms | 50 ms | 100 ms |
| MCP `catalog.search_products` | 40 ms | 120 ms | 250 ms |

### 12.2 Optimization techniques

- **Read-heavy:** Cloudflare CDN cache pro public storefront endpointy (TTL 60 s, swr 5 min); Redis L4 cache pro auth-aware reads (per-user 30 s)
- **N+1 prevence:** GraphQL DataLoader pattern napříč všemi resolvery (brand, vendor, primary_category, media[], variants[])
- **Bulk write:** import CSV používá batch inserts po 500 řádcích v 1 transakci, ne row-by-row
- **Embeddings async:** never block product save; debounced 60 s job
- **Media processing async:** never block upload response; signed URL → 202
- **Search index lag:** acceptable 1-5 s lag mezi product update a search reflect (eventual consistency)
- **Variant list pagination:** produkt s 1000+ variants (např. fashion) → variants paginated v GraphQL/REST; default first 50

### 12.3 Hot path queries

```sql
-- Get product by slug (storefront, very hot)
SELECT * FROM products
WHERE tenant_id = $1 AND slug = $2 AND deleted_at IS NULL AND status = 'active'
  AND (available_from IS NULL OR available_from <= now())
  AND (available_until IS NULL OR available_until > now())
LIMIT 1;
-- Index used: uq_products_tenant_slug_default_locale + idx_products_tenant_status
```

```sql
-- List products for category (storefront)
SELECT p.* FROM products p
JOIN product_categories pc ON pc.product_id = p.id
WHERE p.tenant_id = $1
  AND pc.category_id = $2
  AND p.deleted_at IS NULL
  AND p.status = 'active'
ORDER BY p.created_at DESC
LIMIT 50;
```

**Note:** Storefront category listing v praxi řeší Meilisearch (přes facet filter), ne Postgres přímý query. Postgres je fallback / admin path.

### 12.4 Scaling thresholds

| Catalog size | Approach |
|---|---|
| 0 – 10k products | Postgres only, default config |
| 10k – 100k | Meilisearch reindex 1× nightly + incremental; Postgres read replica (Cloud) |
| 100k – 1M | Meilisearch shards; consider OpenSearch (DEC-SEARCH-001 upgrade path); partition `products` by tenant_id |
| 1M+ | Per-tenant catalog DB (Enterprise dedicated, DEC-ARCH-004) |

---

## 13. Security

### 13.1 Permissions (referenční seznam)

```
PERM-PRODUCT-VIEW
PERM-PRODUCT-CREATE
PERM-PRODUCT-UPDATE
PERM-PRODUCT-DELETE
PERM-PRODUCT-PUBLISH        # gated separately z UPDATE (workflow approval scenarios)
PERM-PRODUCT-IMPORT
PERM-PRODUCT-EXPORT
PERM-PRODUCT-BULK-EDIT
PERM-BRAND-MANAGE
PERM-VENDOR-MANAGE
PERM-ATTRIBUTE-MANAGE
PERM-MEDIA-UPLOAD
PERM-MEDIA-DELETE
```

### 13.2 Field-level security

- `PERSONA-CATALOG-EDITOR` smí update `title`, `description_html`, `seo_*`, `media`, `tags` — ale **ne** `tax_class_code`, `is_taxable`, `brand_id`, `vendor_id` (manager-only). Implementováno přes field-level CASL policy.
- `metadata.*` access scoped per registered attribute (sensitive attributes mohou mít `is_sensitive: true` v `attributes` definici → vyžaduje `PERM-PRODUCT-VIEW-SENSITIVE`).

### 13.3 HTML sanitization

`description_html` a `short_description` (pokud HTML allowed) procházejí **server-side sanitization** přes DOMPurify-compatible knihovnu (např. `sanitize-html`):

- Allowed tags: `p`, `br`, `strong`, `em`, `u`, `s`, `h2`, `h3`, `h4`, `ul`, `ol`, `li`, `a`, `img`, `figure`, `figcaption`, `blockquote`, `code`, `pre`, `table`, `thead`, `tbody`, `tr`, `td`, `th`
- Allowed attrs: `href` (whitelisted protocols `http`, `https`, `mailto`), `src` (whitelisted domains), `alt`, `title`, `class` (whitelist), `id`
- Žádné `<script>`, `<iframe>`, `<style>`, `<form>`, event handlers (`onclick=…`), inline `style=` (povolené jen vybrané CSS properties)
- Pluginy mohou rozšířit allow list přes `extendSanitizerConfig()` hook

### 13.4 Media security

- **Virus scan** při upload (ClamAV worker, JOB-MEDIA-PROCESS step)
- **EXIF strip** (privacy: location, camera serial)
- **Content-Type sniffing** — verify uploaded `mime_type` matches magic bytes; reject mismatch
- **Storage signed URLs** — všechny media URLs jsou signed s TTL (1h default pro private, public storefront media mají CDN-friendly URLs bez podpisu)
- **Hot link prevention** — referer check + signed URL pro non-public media
- **Quota** per tenant — `tenant.settings.media_quota_bytes` (default Free: 1 GB, Pro: 100 GB)

### 13.5 GDPR

- `created_by` audit field — kdo vytvořil/editoval (PII v admin context, ne customer)
- Žádné PII v product samotném (catalog = veřejně visible)
- Audit log retention: 2 roky (Community), 7 let (Enterprise) — viz `30-security.md`

### 13.6 Rate limits

Detail v [04 §13](04-api-conventions.md#13-rate-limiting). Pro PIM endpoints:

| Endpoint | Free | Pro |
|---|---|---|
| `GET /products` (auth) | 300/min | 6000/min |
| `GET /products/{id}` (auth) | 1000/min | unlimited |
| `POST /products` | 30/min | 600/min |
| `POST /products:bulk` | 5/min | 50/min |
| `POST /media` upload | 30/min | 300/min (size-weighted) |
| `POST /products:import-csv` | 1/hour | 10/hour |
| Anonymous storefront `GET /storefront/products` | 60/min per IP | 1200/min per IP |
| MCP `catalog.search_products` | 60/min per agent token | 1500/min |

---

## 14. Testing

### 14.1 Unit tests

| Suite | Coverage target |
|---|---|
| `ProductService.create` | 95 % |
| `ProductService.update` | 95 % |
| `ProductService.publish` (state machine) | 100 % |
| `VariantService.*` | 95 % |
| `BundleValidator.detectCycle` | 100 % |
| `AttributeValidator.validate` (Zod-based) | 100 % |
| `HtmlSanitizer` (config + sanitize) | 100 % |
| `OptionMatrixGenerator` | 100 % |

### 14.2 Integration tests (real Postgres + Redis via testcontainers)

```
TEST-INT-PRODUCT-001  Create simple product → 1 default variant auto-created
TEST-INT-PRODUCT-002  Create variable product with options → variants validate
TEST-INT-PRODUCT-003  Publish flow → status transitions + EVENT-PRODUCT-PUBLISHED emitted
TEST-INT-PRODUCT-004  Concurrent update → ETag conflict → 412
TEST-INT-PRODUCT-005  Soft delete + restore round-trip
TEST-INT-PRODUCT-006  Bundle cycle detection
TEST-INT-PRODUCT-007  Custom attribute validation (zod schema enforced)
TEST-INT-PRODUCT-008  SKU uniqueness enforced across tenant
TEST-INT-PRODUCT-009  Slug auto-suffix on collision
TEST-INT-PRODUCT-010  Outbox event written in same Tx as product insert
TEST-INT-MEDIA-001    Upload + JOB-MEDIA-PROCESS pipeline → ready
TEST-INT-MEDIA-002    Media virus scan reject
TEST-INT-IMPORT-001   CSV import dry-run + apply
TEST-INT-IMPORT-002   CSV import error threshold abort
```

### 14.3 E2E (Playwright)

```
TEST-E2E-PRODUCT-001  Admin create variable product (wizard) end-to-end
TEST-E2E-PRODUCT-002  Storefront product page renders (RSC + variant picker)
TEST-E2E-PRODUCT-003  Storefront variant switch updates price + image + stock badge
TEST-E2E-PRODUCT-004  Admin bulk delete 100 products
TEST-E2E-PRODUCT-005  CSV import 1000 rows
TEST-E2E-PRODUCT-006  Admin search products by SKU
TEST-E2E-MCP-001       External agent uses MCP catalog.search_products + catalog.get_product
```

### 14.4 Load (k6)

```
TEST-LOAD-PRODUCT-001  10k concurrent GET /storefront/products/{slug} → p95 < 50 ms (cached)
TEST-LOAD-PRODUCT-002  1000 concurrent POST /products → p95 < 500 ms
TEST-LOAD-PRODUCT-003  100 concurrent /products:bulk (50 ops each) → no deadlocks
```

### 14.5 Contract tests

- OpenAPI snapshot v repo; PR měnící spec triggeruje review label
- GraphQL schema snapshot
- SDK generated z OpenAPI běží proti staging API v CI smoke

### 14.6 Accessibility

- Admin product editor — axe-core CI (no critical violations)
- Storefront product page — Lighthouse a11y >= 95

---

## 15. Implementation checklist

**Pre-req:** Foundation (0.1 – 0.17) hotová podle `todo.md §4`.

### Backend

- [ ] **[S]** Drizzle schema `packages/db/src/schema/catalog/*.ts` (products, variants, options, media, bundle_items, vendors, brands, attributes)
- [ ] **[S]** Migrace `20260520_010_create_catalog_tables.sql` + indexy + RLS policies
- [ ] **[S]** Seed data: 1 brand (`Demo Brand`), 1 vendor, 5 attributes, 10 demo products
- [ ] **[M]** `packages/core/src/services/product-service.ts` — CRUD + state machine
- [ ] **[M]** `packages/core/src/services/variant-service.ts` — CRUD + soft-delete logic
- [ ] **[M]** `packages/core/src/services/media-service.ts` — upload init, attach, reprocess
- [ ] **[S]** `packages/core/src/services/brand-service.ts`, `vendor-service.ts`, `attribute-service.ts`
- [ ] **[S]** `packages/core/src/validators/bundle-validator.ts` — cycle detection
- [ ] **[S]** `packages/core/src/validators/option-matrix-validator.ts`
- [ ] **[S]** `packages/core/src/sanitizers/html-sanitizer.ts` — sanitize-html wrapper s konfigurací
- [ ] **[S]** `packages/schemas/src/catalog/*.ts` — Zod schemas (sdílené REST + GraphQL + tRPC)
- [ ] **[M]** `packages/api-rest/src/routes/products.ts` — všechny endpointy z §6
- [ ] **[M]** `packages/api-rest/src/routes/variants.ts`
- [ ] **[M]** `packages/api-rest/src/routes/media.ts`
- [ ] **[S]** `packages/api-rest/src/routes/brands.ts`, `vendors.ts`, `attributes.ts`
- [ ] **[M]** `packages/api-graphql/src/types/catalog.graphql` + resolvers
- [ ] **[S]** GraphQL DataLoaders pro brand, vendor, primary_category, media batching
- [ ] **[S]** `packages/api-trpc/src/routers/catalog.ts` (admin)
- [ ] **[M]** `packages/api-mcp/src/tools/catalog/*.ts` — search_products, get_product, list_categories tools

### Background jobs

- [ ] **[M]** JOB-MEDIA-PROCESS — imgproxy (self-host) nebo Cloudflare Images SDK
- [ ] **[S]** JOB-MEDIA-GENERATE-ALT — DEC-AI-001 provider call
- [ ] **[S]** JOB-PRODUCT-EMBED — embeddings provider call (OpenAI default)
- [ ] **[M]** JOB-IMPORT-PRODUCTS-CSV — streaming parser + batch insert
- [ ] **[S]** JOB-EXPORT-PRODUCTS-CSV
- [ ] **[S]** JOB-PURGE-DELETED-PRODUCTS — daily cron
- [ ] **[S]** JOB-DETECT-BUNDLE-CYCLES — defense in depth
- [ ] **[S]** CRON-PUBLISH-SCHEDULED-PRODUCTS — 5-min cron
- [ ] **[S]** CRON-DETECT-MISSING-ALT-TEXT — daily audit + admin notification

### Frontend — Admin

- [ ] **[L]** Product list page (TanStack Table, filters, bulk select, infinite scroll)
- [ ] **[L]** Product detail / editor (tabs: General, Variants, Media, Pricing*, Inventory*, SEO, Custom attrs)
- [ ] **[M]** Variant matrix editor (variable products)
- [ ] **[M]** Media manager modal (upload, organize, set primary, alt text editor)
- [ ] **[M]** Bulk edit modal (multiple actions)
- [ ] **[M]** CSV import wizard (mapping UI)
- [ ] **[S]** Brand list + editor
- [ ] **[S]** Vendor list + editor
- [ ] **[S]** Attribute manager (custom field schema)
- [ ] **[S]** Quick create modal
- [ ] **[S]** Duplicate product confirmation
- [ ] **[S]** AI generate alt text / description (DEC-AI-001 integration)

### Frontend — Storefront (Next.js 16)

- [ ] **[M]** Product list page (`/products`, `/categories/{slug}`) — RSC + Meilisearch query
- [ ] **[M]** Product detail page (`/products/{slug}`) — RSC, Variant picker (client), JSON-LD
- [ ] **[S]** Product card component (shared)
- [ ] **[S]** Variant picker (color swatches, size dropdowns) — client component
- [ ] **[S]** Image gallery (lightbox, zoom, mobile swipe)
- [ ] **[S]** Stock badge (delegated to 09)
- [ ] **[S]** Related products (collection-based v MVP, AI-recommended v v1.0)

### Tests

- [ ] **[M]** Unit tests per §14.1
- [ ] **[M]** Integration tests TEST-INT-PRODUCT-001..010, TEST-INT-MEDIA-001..002, TEST-INT-IMPORT-001..002
- [ ] **[M]** E2E tests TEST-E2E-PRODUCT-001..006, TEST-E2E-MCP-001
- [ ] **[S]** Load tests TEST-LOAD-PRODUCT-001..003

### Docs

- [ ] **[S]** Developer docs: "Authoring a custom attribute plugin"
- [ ] **[S]** User docs: "Creating your first product" (admin guide)
- [ ] **[S]** User docs: "Importing products from CSV"
- [ ] **[S]** API reference auto-generated from OpenAPI + GraphQL schema

\* Pricing a Inventory tabs jsou rendered with cross-domain components z `09` a `10` — vlastnictví doménového dokumentu, ne tady.

---

## 16. Open questions

### Q-PIM-001: Translation table vs translatable JSONB column
**Otázka:** Master schema používá `translations` univerzální tabulku per (entity, field, locale). Alternativa: `title_translations JSONB` přímo v `products`.

**Argumenty pro `translations` table:**
- Snadný report "missing translations across all entities"
- Plugin může query napříč entitami
- Fallback chain implementovatelný v 1 query

**Argumenty pro JSONB sloupec:**
- Méně joinů (perf)
- Snadnější diff/audit (jeden record per locale set)

**Status:** Master schema (`03-data-models-master.md` ENT-TRANSLATION-001) hlasuje pro tabulku. Rozhodnutí potvrdit v `23-i18n.md`.

### Q-PIM-002: Embedding provider
**Otázka:** OpenAI `text-embedding-3-small` (1536 dim) vs `text-embedding-3-large` (3072 dim) vs Cohere multilingual vs Voyage AI?

**Implication:** Vektor v Postgres `vector(N)` — N je fixed. Změna provideru = full reindex.

**Status:** Default `text-embedding-3-small` (cheap, dobrý multilingual), `vector(1536)` v schematu. Override per tenant. Rozhodnutí v `33-ai-features.md`.

### Q-PIM-003: Bundle variant matrix
**Otázka:** Pokud bundle obsahuje variable produkt jako child, jaký variant child se nakupuje?

**Možnosti:**
- A) Bundle items odkazují přímo na konkrétní variant (current schema). Bundle nemá runtime variant choice.
- B) Bundle items mohou odkazovat na produkt (any variant); customer si vybírá u checkoutu — composable bundle.

**Status:** MVP = A (concrete variant). Composable bundle = v1.0 feature, separátní `bundle_items.choice_strategy` field.

### Q-PIM-004: Product variants soft-delete cascade
**Otázka:** Soft-delete produktu kaskáduje na varianty (set `is_active=false`)? Nebo zůstávají active samostatně?

**Status:** MVP = kaskáda. Varianty samostatně aktivní bez produktu nedávají sens.

### Q-PIM-005: Multi-language SKU?
**Otázka:** SKU je per tenant unikátní. Stačí to, nebo by SKU měl být per channel (Heuréka vs vlastní web)?

**Status:** SKU = tenant-wide. Per-channel mapping přes `channel_product_overrides` table (Fáze 2 v `22-multistore-channels.md`).

### Q-PIM-006: Inventory in PIM vs separate domain?
**Otázka:** Stock badge na produkt detail vyžaduje query do `09`. Buffered cache OK?

**Status:** Storefront cache `stock_status` (in_stock / low_stock / out_of_stock) per variant v Redis L4 cache, TTL 30 s. Event `EVENT-STOCK-LEVEL-CHANGED` invaliduje. Detail v `09-inventory.md`.

### Q-PIM-007: Industry profile inheritance
**Otázka:** Industry profile registruje doménová pole. Pokud tenant aktivuje profile později (po vytvoření produktů), aplikují se attributes na existing produkty?

**Status:** Attributes definice je tenant-wide. Existing produkty mohou mít hodnoty `null` pro nová pole; required validation se aktivuje jen na new/updated produktů (grandfather existing). Detail v `34-industry-profiles.md`.

### Q-PIM-008: AI description generation governance
**Otázka:** AI Copilot generuje description draft. Co když merchant publishe bez review?

**Status:** AI-generated content má `metadata.ai_generated: true` flag + `metadata.ai_provider`, `metadata.ai_generated_at`. UI warning při publish ("description je AI-generated, review doporučeno"). Auto-publish AI content lze opt-in přes settings. EU AI Act transparency: storefront může přidat badge "AI-assisted content" do JSON-LD (Fáze 3).

---

## 📅 Změny

| Datum | Změna |
|---|---|
| 2026-05-19 | Initial draft — kompletní PIM domain spec dle 16-section template, založené na ENT-* katalogu z 03. |

---

**Konec Catalog & PIM.**

➡️ Pokračovat na: [`07-categories-taxonomy.md`](07-categories-taxonomy.md)
