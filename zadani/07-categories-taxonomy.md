# 07 – CATEGORIES & TAXONOMY

> **Doména:** Kategorizace produktů. Hierarchické **categories** (taxonomy tree, ltree-based) + manuální/smart **collections** (curated groups). Mapování produktů na kategorie a kolekce.

**Datum:** 2026-05-19
**Verze:** 1.0
**Status:** 🟡 DESIGN
**Reference:** [03 §5](03-data-models-master.md#5-categories--collections) · [06-catalog-pim.md](06-catalog-pim.md) · [08-search-filtering.md](08-search-filtering.md)

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

- **Categories** — hierarchický strom (max 7 úrovní), merchant-driven taxonomy, ltree-based pro O(log N) ancestor/descendant queries
- **Collections** — flat curated groups produktů; **manual** (explicit list) nebo **smart** (rule-based, materialized read model)
- Primary category per produkt (1) + secondary categories (M:N)
- Multi-language slugs a názvy (per locale)
- Per-category SEO metadata, display mode (grid/list/editorial), default sort
- Category banner image, hero content
- Soft delete s undo

### 0.2 Co tato doména **NENÍ**

- ❌ Produkty samotné (→ `06-catalog-pim.md`)
- ❌ Search & facets (→ `08-search-filtering.md`)
- ❌ Pricing per category (→ `10-pricing-promotions.md` přes price_lists; collection může být audience)
- ❌ CMS landing pages (→ `32-cms-content.md` — category může mít přiřazenou landing page, ale samotný page systém je tam)
- ❌ Marketplace seller-driven categories (→ `25-marketplace.md`)

### 0.3 Categories vs Collections — kdy co

| Aspekt | Category | Collection |
|---|---|---|
| **Účel** | Permanent taxonomy ("Stolní lampy" v rámci "Osvětlení") | Curated marketing groups ("Letní výprodej 2026", "Best sellers") |
| **Hierarchie** | Strom (parent / children) | Flat |
| **Membership** | M:N explicit (`product_categories`); primary + secondary | M:N (manual) nebo rule-based (smart) |
| **URL** | `/c/{path}` nebo `/category/{slug}` | `/collections/{slug}` |
| **Multiplicity** | Produkt typicky v 1-3 kategoriích | Produkt může být v desítkách collections |
| **Lifecycle** | Stable, mění se zřídka | Časté (sezona, kampaň) |
| **Storefront UX** | Browsing/filter navigation | Marketing tiles, recommendation feeds, campaign landing pages |
| **Sort default** | `position` ASC (manual) nebo `best_selling` | Per collection setting |
| **SEO** | Strong (kanonické URL, breadcrumbs) | Medium (často `noindex` pro time-bound kampaně) |

### 0.4 Diferenciátory

1. **ltree** pro materializovanou cestu (`electronics.phones.smartphones`) — Postgres native extension, instant subtree queries, no recursive CTE
2. **Smart collections** — read model materialized do `collection_products`, reindex přes BullMQ job (eventually consistent, max lag 60 s)
3. **Per-locale slug paths** přes `category_translations` — multi-language SEO bez duplicit
4. **Industry profile templates** — vertical (fashion, pharmacy) pre-loadne typický category tree

---

## 1. References

- [03 §5 Categories & Collections](03-data-models-master.md#5-categories--collections) — entity ENT-CATEGORY-001 až ENT-COLLECTION-002
- [02 §2](02-glossary.md#2-catalog--pim) — pojmy Category, Collection, Taxonomy
- [06-catalog-pim.md](06-catalog-pim.md) — `products.primary_category_id` + M:N
- [08-search-filtering.md](08-search-filtering.md) — facet filter `category`, Meilisearch attribute mapping
- [19-marketing-seo.md](19-marketing-seo.md) — category SEO (breadcrumb JSON-LD, canonical URLs)
- [23-i18n.md](23-i18n.md) — `translations` univerzální table
- [32-cms-content.md](32-cms-content.md) — category landing page assignment
- [34-industry-profiles.md](34-industry-profiles.md) — default taxonomy per vertical
- [DEC-EVENTS-001](01-decisions-registry.md#dec-events-001-event-bus--background-jobs) — smart collection reindex pattern

---

## 2. Personas

| Persona | Použití | Klíčové permissions |
|---|---|---|
| `PERSONA-MERCHANT-OWNER` | Plná správa taxonomy a collections | `PERM-CATEGORY-*`, `PERM-COLLECTION-*` |
| `PERSONA-CATALOG-MANAGER` | Tree edit, product assignments | `PERM-CATEGORY-VIEW/CREATE/UPDATE/DELETE`, `PERM-COLLECTION-*` |
| `PERSONA-CATALOG-EDITOR` | Content jen (banner, description, SEO), žádný tree restructure | `PERM-CATEGORY-VIEW/UPDATE` (field-level: bez `parent_id`, `position`) |
| `PERSONA-MARKETING-MANAGER` | Smart collections, kampaně | `PERM-COLLECTION-*` (vč. SMART rules), `PERM-CATEGORY-VIEW` |
| `PERSONA-CUSTOMER` | Browse categories/collections | Storefront public endpointy (anon) |
| `PERSONA-AI-COPILOT` | Auto-suggest category/collection assignment | `agent:catalog:read`, `agent:catalog:suggest-categorization` |
| `PERSONA-EXTERNAL-AGENT` | MCP `catalog.list_categories` | `agent:catalog:read` |

---

## 3. Data models

Definováno v `03-data-models-master.md §5`. Zde rozšíření s constraints, indexy a triggery.

### 3.1 `categories` ([ENT-CATEGORY-001](03-data-models-master.md#ent-category-001))

```sql
CREATE EXTENSION IF NOT EXISTS ltree;

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  parent_id UUID NULL REFERENCES categories(id),
  path LTREE NOT NULL,                              -- 'electronics.phones.smartphones'
  depth INTEGER GENERATED ALWAYS AS (nlevel(path)) STORED,
  slug TEXT NOT NULL,                                -- default locale slug
  name TEXT NOT NULL,                                -- default locale name
  description_html TEXT NULL,
  short_description TEXT NULL,
  position INTEGER NOT NULL DEFAULT 0,                -- sibling order
  display_mode TEXT NOT NULL CHECK (display_mode IN ('grid','list','editorial','featured')) DEFAULT 'grid',
  default_sort TEXT NOT NULL CHECK (default_sort IN ('position_asc','price_asc','price_desc','best_selling','newest','rating_desc','random')) DEFAULT 'best_selling',
  banner_media_id UUID NULL REFERENCES media(id),
  hero_media_id UUID NULL REFERENCES media(id),
  is_visible BOOLEAN NOT NULL DEFAULT true,
  is_visible_in_menu BOOLEAN NOT NULL DEFAULT true,
  cms_page_id UUID NULL REFERENCES cms_pages(id),      -- optional landing page override
  seo_title TEXT NULL,
  seo_description TEXT NULL,
  seo_canonical_path TEXT NULL,                        -- override `/c/{path}`
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL REFERENCES users(id),
  updated_by UUID NULL REFERENCES users(id),
  version INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT uq_categories_tenant_path UNIQUE (tenant_id, path),
  CONSTRAINT ck_categories_max_depth CHECK (nlevel(path) <= 7),
  CONSTRAINT ck_categories_parent_root CHECK (
    (parent_id IS NULL AND nlevel(path) = 1) OR
    (parent_id IS NOT NULL AND nlevel(path) > 1)
  )
);

CREATE UNIQUE INDEX uq_categories_tenant_slug_root
  ON categories (tenant_id, slug)
  WHERE parent_id IS NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX uq_categories_tenant_parent_slug
  ON categories (tenant_id, parent_id, slug)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_categories_tenant_path_gist
  ON categories USING GIST (tenant_id, path);

CREATE INDEX idx_categories_tenant_path_btree
  ON categories USING BTREE (tenant_id, path);

CREATE INDEX idx_categories_parent
  ON categories (parent_id, position)
  WHERE deleted_at IS NULL;
```

**Path computation:** `path` se generuje z `parent.path + slug` v aplikační vrstvě při create/move. Slug v path je sanitized lowercase a-z 0-9 underscores (ltree limitation: žádné pomlčky, ale storefront URL používá vlastní slug, ne path).

**Rename slug → path update:** trigger updatuje path všech descendantů (subtree update přes ltree `set_path`).

### 3.2 `collections` ([ENT-COLLECTION-001](03-data-models-master.md#ent-collection-001))

```sql
CREATE TABLE collections (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  short_description TEXT NULL,
  description_html TEXT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('manual','smart','hybrid')) DEFAULT 'manual',
  rules JSONB NULL,                                  -- pro smart/hybrid
  sort_strategy TEXT NOT NULL CHECK (sort_strategy IN ('manual','best_selling','price_asc','price_desc','created_desc','random','rating_desc')) DEFAULT 'manual',
  status TEXT NOT NULL CHECK (status IN ('draft','active','archived')) DEFAULT 'draft',
  is_visible BOOLEAN NOT NULL DEFAULT true,
  banner_media_id UUID NULL REFERENCES media(id),
  hero_media_id UUID NULL REFERENCES media(id),
  cms_page_id UUID NULL REFERENCES cms_pages(id),
  available_from TIMESTAMPTZ NULL,                    -- campaign window
  available_until TIMESTAMPTZ NULL,
  seo_title TEXT NULL,
  seo_description TEXT NULL,
  seo_noindex BOOLEAN NOT NULL DEFAULT false,         -- time-bound campaigns často noindex
  last_materialized_at TIMESTAMPTZ NULL,               -- pro smart/hybrid
  member_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL REFERENCES users(id),
  updated_by UUID NULL REFERENCES users(id),
  version INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT uq_collections_tenant_slug UNIQUE (tenant_id, slug),
  CONSTRAINT ck_collections_rules_when_smart CHECK (
    (kind = 'manual' AND rules IS NULL) OR
    (kind IN ('smart','hybrid') AND rules IS NOT NULL)
  ),
  CONSTRAINT ck_collections_window CHECK (
    available_until IS NULL OR available_from IS NULL OR available_until > available_from
  )
);

CREATE INDEX idx_collections_tenant_status ON collections (tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_collections_window ON collections (tenant_id, available_from, available_until) WHERE status = 'active';
```

### 3.3 `product_categories` ([ENT-CATEGORY-002](03-data-models-master.md#ent-category-002))

```sql
CREATE TABLE product_categories (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL DEFAULT 0,                -- pro manual sort v rámci kategorie
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_product_categories UNIQUE (product_id, category_id)
);

CREATE UNIQUE INDEX uq_product_categories_one_primary
  ON product_categories (product_id)
  WHERE is_primary = true;

CREATE INDEX idx_product_categories_category
  ON product_categories (category_id, position);
```

**Synchronizace s `products.primary_category_id`:** `products.primary_category_id` je denormalized convenience pole. Trigger synchronizuje s `product_categories.is_primary`.

### 3.4 `product_collections` ([ENT-COLLECTION-002](03-data-models-master.md#ent-collection-002))

```sql
CREATE TABLE product_collections (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL CHECK (source IN ('manual','smart','imported')) DEFAULT 'manual',
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_product_collections UNIQUE (product_id, collection_id)
);

CREATE INDEX idx_product_collections_collection
  ON product_collections (collection_id, position);

CREATE INDEX idx_product_collections_smart_source
  ON product_collections (collection_id, source)
  WHERE source = 'smart';
```

**Materialized read model:** Pro `smart` collections — JOB-MATERIALIZE-SMART-COLLECTION zapisuje sem rows s `source='smart'`. Při remateriaalize: DELETE WHERE source='smart' AND collection_id=X, then INSERT new rows.

### 3.5 `category_translations` + `collection_translations`

Per-locale obsah (slug, name, descriptions, SEO). Modelované přes univerzální `translations` table z `03 §15`:

```
translations:
  entity_type = 'category' | 'collection'
  entity_id   = categories.id | collections.id
  field       = 'name' | 'slug' | 'description_html' | 'seo_title' | 'seo_description'
  locale      = 'en-US' | 'de-DE' | …
  value       = text
```

UNIQUE `(tenant_id, entity_type, entity_id, field, locale)` — viz `23-i18n.md`.

**Slug uniqueness per locale:** dodatečný UNIQUE partial index na `translations` přes generated identity column nebo aplikační check (rozhodnuto v Q-CAT-001).

### 3.6 Smart collection rules DSL

`collections.rules` JSONB:

```jsonc
{
  "operator": "AND",
  "conditions": [
    { "field": "price", "op": "lt", "value": 200000, "currency": "CZK" },
    { "field": "category", "op": "in", "value": ["cat_abc", "cat_xyz"] },
    { "field": "tags", "op": "contains_any", "value": ["sale", "new"] },
    {
      "operator": "OR",
      "conditions": [
        { "field": "brand", "op": "eq", "value": "brd_..." },
        { "field": "vendor", "op": "eq", "value": "vnd_..." }
      ]
    },
    { "field": "created_at", "op": "gte", "value": "2026-01-01" },
    { "field": "stock_status", "op": "eq", "value": "in_stock" },
    { "field": "metadata.country_of_origin", "op": "eq", "value": "CZ" }
  ]
}
```

**Supported operators:** `eq`, `ne`, `lt`, `lte`, `gt`, `gte`, `in`, `not_in`, `contains_any`, `contains_all`, `starts_with`, `is_set`, `is_not_set`.

**Supported fields:** `price`, `compare_at_price`, `category`, `tags`, `brand`, `vendor`, `created_at`, `updated_at`, `published_at`, `stock_status`, `type`, `tax_class_code`, `weight_grams`, `metadata.*` (whitelist přes `attributes` registry).

**Validace:** Zod schema rekurzivní; max nesting depth 4; max conditions 50; AI Copilot may auto-suggest rules from natural language v v1.0.

---

## 4. State machines

### 4.1 Category lifecycle

Categories nemají formální status (visible/hidden + soft delete jsou flagy).

```
[exists, is_visible=true]  ⇌  [exists, is_visible=false]  →  [deleted_at set, retention 90d]
                                                                          │
                                                                          ▼
                                                                  [hard purge by CRON]
```

### 4.2 Collection lifecycle

```
   ┌──────────┐  publish     ┌──────────┐
   │  draft   │ ───────────▶│  active  │
   └──────────┘             └─────┬────┘
                                   │ archive
                                   ▼
                             ┌──────────┐
                             │ archived │
                             └──────────┘
```

**Přechody pro smart collections:**
- Při `publish`: vyžaduje validní `rules` JSON (Zod check) a successful first materialization (test query proti Postgres timeout 5s, max 50 výsledků v sample run); fail → 422

### 4.3 Smart collection materialization pipeline

```
collection (kind='smart', rules set)
   │
   │ EVENT-COLLECTION-RULES-CHANGED nebo CRON-MATERIALIZE-SMART-COLLECTIONS (každých 5 min)
   ▼
JOB-MATERIALIZE-SMART-COLLECTION
   1. Lock collection row (advisory lock by collection_id)
   2. Query products matching rules (Postgres, paginated chunks)
   3. Compute diff vs existing product_collections WHERE source='smart'
   4. Apply: INSERT new, DELETE removed (preserve manual entries kind='hybrid')
   5. Update collection.last_materialized_at, member_count
   6. Emit EVENT-COLLECTION-MATERIALIZED
   7. Release lock
```

**Trigger conditions pro full remateriaalize:**
- `rules` field changed → immediate job enqueue
- `EVENT-PRODUCT-PUBLISHED` / `EVENT-PRODUCT-ARCHIVED` / `EVENT-PRODUCT-UPDATED` → debounced 60s incremental check (per-product evaluation against all smart rules with relevant fields touched)
- CRON every 5 min — full sweep (catch missed events)

### 4.4 Category move operation

Atomicky:
1. Validate target parent is not descendant of current node (no cycles)
2. Validate target depth ≤ 7
3. Update `parent_id`
4. Recompute `path` for moved node and all descendants (single recursive update via ltree `set_path`)
5. Emit `EVENT-CATEGORY-MOVED` with old_path, new_path payload

---

## 5. Business rules

### RULE-CAT-001: Max depth 7
Category tree nesmí překročit hloubku 7 (root = depth 1). Důvod: breadcrumb UX, ltree performance, navigation menus.

**Vynucení:** CHECK constraint `nlevel(path) <= 7`. Při violation → `422 MAX_DEPTH_EXCEEDED`.

### RULE-CAT-002: Slug unique per parent
Slug je unikátní v rámci sourozenců (root-level slugs + per-parent slugs). Důvod: URL ambiguity prevention.

**Vynucení:** Partial UNIQUE indexy `uq_categories_tenant_slug_root` a `uq_categories_tenant_parent_slug`.

Při kolizi auto-suffix (`-2`, `-3`) konfigurovatelné — default = reject s 409.

### RULE-CAT-003: No cycle
Category nesmí být svým ancestorem. Move/parent_id update validuje target přes `path` lookup.

**Algoritmus:** `target.path <@ source.path` ⇒ reject (target je descendant of source).

### RULE-CAT-004: Primary category constraint
Produkt má **přesně 1** primary category (volitelné — může být NULL). UNIQUE partial index `uq_product_categories_one_primary`.

Při set new primary: trigger nebo aplikační logika auto-clear existing primary v rámci transakce.

`products.primary_category_id` je derived denormalization synchronized triggerem.

### RULE-CAT-005: Soft-delete s descendants
Delete category, která má descendant kategorie nebo produkty → reject (422 `CATEGORY_HAS_CHILDREN`).

**Force delete:** Admin "Delete + reassign" workflow:
1. Move products do parent category (nebo "Uncategorized" fallback)
2. Move descendant categories to parent
3. Soft delete this category

### RULE-CAT-006: Visible vs visible_in_menu
- `is_visible=false` → kategorie není dostupná na storefrontu (404), produkty v ní nejsou zobrazené v category browse, ale samy o sobě (v search nebo direct URL) jsou
- `is_visible_in_menu=false` → kategorie existuje a je accessible přes URL, ale nezobrazuje se v navigation menu / breadcrumbs

### RULE-CAT-007: Industry profile seed
Při tenant onboarding s industry profile selection (fashion, electronics, pharmacy, …): preset category tree z `34-industry-profiles.md` se importuje (idempotentně — pokud kategorie už existují, skip).

### RULE-COL-001: Smart collection rules validation
`rules` JSON musí projít Zod validation:
- Max nesting depth 4
- Max conditions 50
- All `field` values v whitelist
- All `metadata.*` keys musí být registered v `attributes` table

### RULE-COL-002: Smart collection visibility delay
Smart collection vytvořená merchantem může mít před první materialization `member_count=0`. Storefront ji ukáže jako prázdnou s placeholder textem (configurable). Admin uvidí badge "Materializing…" do dokončení prvního JOB-MATERIALIZE-SMART-COLLECTION.

### RULE-COL-003: Hybrid collection
`kind='hybrid'` = smart rules + manual additions. Při materialization:
- DELETE WHERE collection_id=X AND source='smart' AND product_id NOT IN (current_rule_matches)
- INSERT new smart matches
- **Preserve** entries with `source='manual'`

Manual entry overrides smart removal (i pokud product už neodpovídá rules, manual ho drží).

### RULE-COL-004: Time-bound campaign
Collection s `available_from > now()` na storefrontu nezobrazujeme (404). Admin vidí "Scheduled" badge. CRON-PUBLISH-SCHEDULED-COLLECTIONS každých 5 min toggle visibility on/off.

### RULE-COL-005: Archive on expiry
Collection s `available_until < now()` automaticky není zobrazená na storefrontu. Auto-archive je opt-in setting (default off — merchant rozhodne). EVENT-COLLECTION-EXPIRED emit při crossing.

### RULE-COL-006: Sort strategy + manual override
- `sort_strategy='manual'` — `product_collections.position` určuje pořadí
- Ostatní strategies — sort se počítá při query time (na storefrontu, ne v DB pre-computed)
- Pro velké collections (10k+ items) doporučujeme materialized sort přes view (Fáze 3)

### RULE-COL-007: Smart collection nesmí referencovat self/cycle
Pole `category` v rules nesmí způsobit nekonečnou rekurzi. (Není riziko ve current DSL — collection rules neumí referencovat jiné collections jako podmínku.)

### RULE-CAT-008: ltree slug normalizace
Slug v `categories.path` segment je normalizovaný:
- Lowercase ASCII
- Replace `-` → `_` (ltree limitation)
- Remove diacritics (`č` → `c`, `š` → `s`, …) přes transliteration

Storefront URL používá lidsky čitelný slug z `categories.slug` field (s pomlčkami a diacritics zachované v locale-specific verzi přes translations). Path je interní storage; URL může být `/c/elektronika/telefony/smartphony` ale path je `electronics.phones.smartphones`.

**Mapping:** URL → category lookup přes `slug` per locale + parent traversal, ne přes path direct.

---

## 6. REST API endpoints

### 6.1 Categories

```
GET    /api/{date}/categories                          # flat list, filterable
GET    /api/{date}/categories/tree                     # hierarchical tree (cached, eager loaded)
POST   /api/{date}/categories                          # create
GET    /api/{date}/categories/{id}                     # single
PATCH  /api/{date}/categories/{id}                     # update (no parent change — use :move)
DELETE /api/{date}/categories/{id}                     # soft delete (fail if children)
POST   /api/{date}/categories/{id}:move                # change parent_id (recompute paths)
POST   /api/{date}/categories/{id}:reorder-children    # set sibling positions
POST   /api/{date}/categories/{id}:duplicate           # clone subtree
POST   /api/{date}/categories/{id}:delete-and-reassign # force delete with product reassignment
POST   /api/{date}/categories:bulk                     # bulk operations
GET    /api/{date}/categories/{id}/products            # products in category (paginated)
POST   /api/{date}/categories/{id}/products            # bulk attach products
DELETE /api/{date}/categories/{id}/products/{product_id}  # detach
POST   /api/{date}/categories/{id}/products/{product_id}:set-primary  # mark as primary category
POST   /api/{date}/categories:import-from-template     # industry profile preset
```

### 6.2 Collections

```
GET    /api/{date}/collections
POST   /api/{date}/collections
GET    /api/{date}/collections/{id}
PATCH  /api/{date}/collections/{id}
DELETE /api/{date}/collections/{id}
POST   /api/{date}/collections/{id}:publish
POST   /api/{date}/collections/{id}:archive
POST   /api/{date}/collections/{id}:duplicate
POST   /api/{date}/collections/{id}:materialize        # force smart re-materialization
POST   /api/{date}/collections/{id}:preview-rules      # dry-run smart rules → product list
GET    /api/{date}/collections/{id}/products
POST   /api/{date}/collections/{id}/products           # manual add (rejected pro pure smart)
DELETE /api/{date}/collections/{id}/products/{product_id}
POST   /api/{date}/collections/{id}/products:reorder   # for manual sort_strategy
```

### 6.3 Storefront (anonymní)

```
GET    /api/{date}/storefront/categories/tree
GET    /api/{date}/storefront/categories/{slug}        # by slug + locale (resolved via path traversal)
GET    /api/{date}/storefront/categories/{slug}/products  # paginated, facet-aware
GET    /api/{date}/storefront/collections
GET    /api/{date}/storefront/collections/{slug}
GET    /api/{date}/storefront/collections/{slug}/products
```

### 6.4 Example: Get category tree

**Request:**
```http
GET /api/2026-05-19/storefront/categories/tree HTTP/1.1
Accept-Language: cs-CZ
```

**Response:**
```jsonc
HTTP/1.1 200 OK
Cache-Control: public, max-age=300, stale-while-revalidate=3600
Content-Language: cs-CZ
ETag: "tree-v42-..."

{
  "data": [
    {
      "id": "cat_root1",
      "pub_id": "cat_aB3cD...",
      "type": "category",
      "attributes": {
        "name": "Elektronika",
        "slug": "elektronika",
        "path": "electronics",
        "depth": 1,
        "is_visible_in_menu": true,
        "display_mode": "grid",
        "product_count": 1247,
        "url": "/c/elektronika"
      },
      "children": [
        {
          "id": "cat_phones",
          "attributes": {
            "name": "Telefony",
            "slug": "telefony",
            "path": "electronics.phones",
            "depth": 2,
            "product_count": 342,
            "url": "/c/elektronika/telefony"
          },
          "children": [ ... ]
        }
      ]
    }
  ],
  "meta": {
    "request_id": "req_...",
    "version": "2026-05-19",
    "tree_version": "42"
  }
}
```

**Cache strategy:** Tree response je heavy cached. Invalidation surrogate keys `category-tree:{tenant_id}` purged at any category mutation.

### 6.5 Example: Create category

```http
POST /api/2026-05-19/categories HTTP/1.1
Idempotency-Key: ...

{
  "name": "Smartphony",
  "slug": "smartphony",
  "parent_id": "cat_phones_id",
  "display_mode": "grid",
  "default_sort": "best_selling",
  "seo_title": "Smartphony | E-shop XYZ",
  "metadata": { "feature_filter": "battery_capacity" }
}
```

```http
HTTP/1.1 201 Created
Location: /api/2026-05-19/categories/cat_new_id

{
  "data": {
    "id": "...",
    "pub_id": "cat_aB3cD...",
    "type": "category",
    "attributes": {
      "name": "Smartphony",
      "slug": "smartphony",
      "path": "electronics.phones.smartphony",
      "depth": 3,
      ...
    }
  }
}
```

### 6.6 Example: Create smart collection

```http
POST /api/2026-05-19/collections HTTP/1.1

{
  "name": "Letní výprodej 2026",
  "slug": "letni-vyprodej-2026",
  "kind": "smart",
  "rules": {
    "operator": "AND",
    "conditions": [
      { "field": "tags", "op": "contains_any", "value": ["sale", "summer"] },
      { "field": "stock_status", "op": "eq", "value": "in_stock" }
    ]
  },
  "sort_strategy": "price_asc",
  "available_from": "2026-06-01T00:00:00Z",
  "available_until": "2026-08-31T23:59:59Z",
  "seo_noindex": false
}
```

Response:
```jsonc
HTTP/1.1 201 Created

{
  "data": {
    "id": "...",
    "attributes": {
      "kind": "smart",
      "status": "draft",
      "rules": { ... },
      "member_count": 0,
      "last_materialized_at": null
    }
  },
  "meta": {
    "operations": {
      "materialize_job_id": "op_..."         // job auto-enqueued on rules set
    }
  }
}
```

### 6.7 Example: Preview smart rules

Dry-run pro merchant UI před save:

```http
POST /api/2026-05-19/collections:preview-rules

{
  "rules": { ... },
  "limit": 50
}
```

```jsonc
{
  "data": {
    "matching_count": 234,
    "sample_products": [
      { "id": "...", "title": "...", "price": { "amount": 12990, "currency": "CZK" }},
      ...
    ],
    "execution_ms": 47
  }
}
```

Limit 5 second timeout; matching_count je estimated nad 10k.

---

## 7. GraphQL schema

```graphql
type Category implements Node & Timestamped {
  id: ID!
  pubId: String!
  name: String!
  slug: String!
  path: String!
  depth: Int!
  parent: Category
  children(first: Int, after: String): CategoryConnection!
  ancestors: [Category!]!               # breadcrumb chain (root → this)
  descendants(maxDepth: Int): [Category!]!
  shortDescription: String
  descriptionHtml: String
  displayMode: CategoryDisplayMode!
  defaultSort: CategorySortStrategy!
  bannerMedia: Media
  heroMedia: Media
  isVisible: Boolean!
  isVisibleInMenu: Boolean!
  productCount: Int!                     # cached, recomputed periodically
  seoTitle: String
  seoDescription: String
  canonicalUrl: String!
  cmsPage: CmsPage
  products(first: Int, after: String, filter: ProductFilter, sort: [ProductSort!]): ProductConnection!
  metadata: JSON!
  createdAt: DateTime!
  updatedAt: DateTime!
}

enum CategoryDisplayMode { GRID LIST EDITORIAL FEATURED }
enum CategorySortStrategy {
  POSITION_ASC
  PRICE_ASC
  PRICE_DESC
  BEST_SELLING
  NEWEST
  RATING_DESC
  RANDOM
}

type CategoryConnection {
  edges: [CategoryEdge!]!
  pageInfo: PageInfo!
  totalCount: Int
}
type CategoryEdge { node: Category!  cursor: String! }

type Collection implements Node & Timestamped {
  id: ID!
  pubId: String!
  name: String!
  slug: String!
  shortDescription: String
  descriptionHtml: String
  kind: CollectionKind!
  status: CollectionStatus!
  sortStrategy: CollectionSortStrategy!
  rules: JSON                            # null pokud kind=MANUAL
  bannerMedia: Media
  heroMedia: Media
  isVisible: Boolean!
  availableFrom: DateTime
  availableUntil: DateTime
  isCurrentlyAvailable: Boolean!         # computed: now ∈ window AND status=ACTIVE
  memberCount: Int!
  lastMaterializedAt: DateTime
  seoTitle: String
  seoDescription: String
  seoNoindex: Boolean!
  cmsPage: CmsPage
  products(first: Int, after: String, sort: [ProductSort!]): ProductConnection!
  metadata: JSON!
  createdAt: DateTime!
  updatedAt: DateTime!
}

enum CollectionKind { MANUAL SMART HYBRID }
enum CollectionStatus { DRAFT ACTIVE ARCHIVED }
enum CollectionSortStrategy {
  MANUAL
  BEST_SELLING
  PRICE_ASC
  PRICE_DESC
  CREATED_DESC
  RANDOM
  RATING_DESC
}

extend type Query {
  categories(first: Int = 100, after: String, filter: CategoryFilter): CategoryConnection!
  categoriesTree: [Category!]!           # root categories with eager-loaded children
  category(id: ID, slug: String, path: String): Category
  categoryByPath(path: String!): Category

  collections(first: Int, after: String, filter: CollectionFilter): CollectionConnection!
  collection(id: ID, slug: String): Collection
}

input CategoryFilter {
  parentId: ID
  isVisible: Boolean
  depthMax: Int
  search: String
}

input CollectionFilter {
  status: [CollectionStatus!]
  kind: [CollectionKind!]
  isCurrentlyAvailable: Boolean
  search: String
}

extend type Mutation {
  createCategory(input: CategoryCreateInput!): CategoryPayload! @auth(requires: PERM_CATEGORY_CREATE)
  updateCategory(id: ID!, input: CategoryUpdateInput!, ifMatch: String): CategoryPayload! @auth(requires: PERM_CATEGORY_UPDATE)
  moveCategory(id: ID!, newParentId: ID): CategoryPayload! @auth(requires: PERM_CATEGORY_UPDATE)
  reorderCategoryChildren(parentId: ID, orderedIds: [ID!]!): CategoryPayload! @auth(requires: PERM_CATEGORY_UPDATE)
  deleteCategory(id: ID!, reassignProductsTo: ID): DeletePayload! @auth(requires: PERM_CATEGORY_DELETE)

  createCollection(input: CollectionCreateInput!): CollectionPayload! @auth(requires: PERM_COLLECTION_CREATE)
  updateCollection(id: ID!, input: CollectionUpdateInput!, ifMatch: String): CollectionPayload! @auth(requires: PERM_COLLECTION_UPDATE)
  publishCollection(id: ID!): CollectionPayload! @auth(requires: PERM_COLLECTION_UPDATE)
  archiveCollection(id: ID!): CollectionPayload! @auth(requires: PERM_COLLECTION_UPDATE)
  materializeCollection(id: ID!): CollectionPayload! @auth(requires: PERM_COLLECTION_UPDATE)
  previewCollectionRules(rules: JSON!, limit: Int = 50): CollectionRulesPreview! @auth(requires: PERM_COLLECTION_CREATE)

  attachProductsToCategory(categoryId: ID!, productIds: [ID!]!, primary: Boolean = false): MutationPayload! @auth(requires: PERM_CATEGORY_UPDATE)
  detachProductFromCategory(categoryId: ID!, productId: ID!): MutationPayload! @auth(requires: PERM_CATEGORY_UPDATE)
  setPrimaryCategory(productId: ID!, categoryId: ID!): MutationPayload! @auth(requires: PERM_PRODUCT_UPDATE)
}

type CollectionRulesPreview {
  matchingCount: Int!
  sampleProducts: [Product!]!
  executionMs: Int!
}
```

---

## 8. Events

| Build-spec ID | Wire | Payload |
|---|---|---|
| `EVENT-CATEGORY-CREATED` | `category.created` | `{ category: Category }` |
| `EVENT-CATEGORY-UPDATED` | `category.updated` | `{ category: Category, previous_attributes }` |
| `EVENT-CATEGORY-MOVED` | `category.moved` | `{ category: Category, old_path, new_path, affected_descendant_count }` |
| `EVENT-CATEGORY-DELETED` | `category.deleted` | `{ category_id, path, reassigned_product_count }` |
| `EVENT-CATEGORY-RESTORED` | `category.restored` | `{ category: Category }` |
| `EVENT-COLLECTION-CREATED` | `collection.created` | `{ collection: Collection }` |
| `EVENT-COLLECTION-UPDATED` | `collection.updated` | `{ collection: Collection, previous_attributes }` |
| `EVENT-COLLECTION-PUBLISHED` | `collection.published` | `{ collection: Collection }` |
| `EVENT-COLLECTION-ARCHIVED` | `collection.archived` | `{ collection: Collection }` |
| `EVENT-COLLECTION-EXPIRED` | `collection.expired` | `{ collection_id, expired_at }` |
| `EVENT-COLLECTION-RULES-CHANGED` | `collection.rules_changed` | `{ collection_id, new_rules, previous_rules }` |
| `EVENT-COLLECTION-MATERIALIZED` | `collection.materialized` | `{ collection_id, member_count, materialized_at, duration_ms }` |
| `EVENT-PRODUCT-CATEGORY-ATTACHED` | `product.category_attached` | `{ product_id, category_id, is_primary }` |
| `EVENT-PRODUCT-CATEGORY-DETACHED` | `product.category_detached` | `{ product_id, category_id }` |
| `EVENT-PRODUCT-COLLECTION-ATTACHED` | `product.collection_attached` | `{ product_id, collection_id, source }` |
| `EVENT-PRODUCT-COLLECTION-DETACHED` | `product.collection_detached` | `{ product_id, collection_id }` |

**Konzumenti:**
- Search indexer (`08`) reindexes affected products on category/collection changes
- Cache invalidator purges `category-tree:{tenant_id}` + `category:{id}` keys
- Sitemap generator (`19`) regenerates on category structure changes (debounced 5 min)
- Smart collection trigger: `EVENT-PRODUCT-*` může re-evaluate matching smart collections (incremental)

---

## 9. Background jobs

| Job | Trigger | Queue | Frequency |
|---|---|---|---|
| `JOB-MATERIALIZE-SMART-COLLECTION` | EVENT-COLLECTION-RULES-CHANGED, product changes | `smart-collections` | On-demand, debounced |
| `JOB-RECOMPUTE-CATEGORY-PRODUCT-COUNT` | scheduled | `analytics` | Hourly |
| `JOB-PURGE-DELETED-CATEGORIES` | scheduled | `maintenance` | Daily 03:00 |
| `JOB-EVALUATE-CATEGORY-TREE-HEALTH` | scheduled | `integrity-checks` | Daily |
| `CRON-MATERIALIZE-SMART-COLLECTIONS-SWEEP` | scheduled | `smart-collections` | Every 5 min (catch missed) |
| `CRON-PUBLISH-SCHEDULED-COLLECTIONS` | scheduled | `scheduler` | Every 5 min |
| `CRON-EXPIRE-COLLECTIONS` | scheduled | `scheduler` | Every 5 min |
| `JOB-IMPORT-CATEGORY-TEMPLATE` | POST `/categories:import-from-template` | `imports` | On-demand |
| `JOB-RECOMPUTE-CATEGORY-PATHS` | EVENT-CATEGORY-MOVED (large subtree) | `maintenance` | On-demand |

### 9.1 JOB-MATERIALIZE-SMART-COLLECTION detail

```
Input: collection_id
Steps:
  1. Acquire advisory lock by hash(collection_id) — prevent concurrent runs
  2. Load collection + parse rules
  3. Build SQL from rules DSL:
     - WHERE clause assembled from rule conditions
     - JOIN-as-needed (prices for price field, product_categories for category field)
  4. Execute query with statement_timeout=30s
  5. Compute diff:
     existing := SELECT product_id FROM product_collections WHERE collection_id=X AND source='smart'
     desired  := matched product ids
     to_add    := desired - existing
     to_remove := existing - desired (preserve source='manual' in hybrid)
  6. Apply in batches of 500
  7. UPDATE collections SET last_materialized_at=now(), member_count=cardinality(desired)
  8. Emit EVENT-COLLECTION-MATERIALIZED with duration_ms
  9. Release lock

Retry: 3× exponential backoff. After 3 fails:
  - Mark collection.metadata.materialization_error = { message, last_attempt_at }
  - Emit warning event for admin notification
  - Do NOT mark collection failed (keep last good state)
```

---

## 10. UI/UX flows

### FLOW-CATEGORY-001: Tree editor (admin)

```
[Catalog → Categories]
        │
        ▼
[Tree view, drag-drop reorder]
   - Root level: drag to reorder horizontally
   - Drag node onto another → make child
   - Right-click context: New, Rename, Delete, Move to root, Duplicate
   - Inline edit: click name to rename slug + name
   - Sidebar: filter by name, depth, visibility
        │
        │  drop / context action
        ▼
[Optimistic UI update + API call]
   - Failed move (cycle, depth exceeded) → revert UI + toast error
   - On success → refresh subtree counts
```

### FLOW-CATEGORY-002: Bulk product attach

```
[Category detail page]
   tab: Products
        │
        ▼
[Product picker modal]
   - Search products (Meilisearch facet-aware)
   - Filter by current category exclusion ("not yet in this category")
   - Multi-select with checkbox
        │
        │  Confirm (selected N products)
        ▼
[Bulk attach API call → 207 Multi-Status response]
   - Per product success/fail toast
   - Refresh product count
```

### FLOW-COLLECTION-001: Smart collection builder

```
[Marketing → Collections → New Smart]
        │
        ▼
[Visual rule builder]
   - Condition rows: field dropdown → op dropdown → value input
   - AND / OR toggle per group
   - "Add condition" + "Add group" buttons (recursive)
   - Live preview panel: count + first 10 products (debounced 800ms)
        │
        ▼
[Settings panel]
   - Name, slug, banner, hero
   - Sort strategy
   - Campaign window (available_from/until)
   - SEO settings
        │
        │  Save Draft  |  Publish
        ▼
[Async materialize job → toast]
   - "Materializing... (47 products matched)"
   - On complete: redirect to collection detail
```

### FLOW-CATEGORY-003: Storefront category browse

```
[/c/elektronika/telefony]
        │
        ▼
[Category page]
   - Breadcrumbs: Home > Elektronika > Telefony
   - Banner image (if banner_media_id)
   - Category description (top)
   - Subcategory tiles (if has children, display_mode dependent)
   - Filter sidebar (left): facets from 08-search-filtering.md
   - Product grid/list (right): paginated, sorted per default_sort
   - Sort dropdown (override default)
```

### FLOW-COLLECTION-002: Customer browses collection landing

```
[/collections/letni-vyprodej-2026]
        │
        ▼
[Collection landing]
   - Hero image full-width
   - Collection title + description
   - Optional CMS page content (if cms_page_id set)
   - Countdown timer (if available_until set)
   - Product grid (sorted per collection.sort_strategy)
   - JSON-LD: ItemList schema
```

---

## 11. Edge cases & error handling

| Scenario | Behavior | Error code |
|---|---|---|
| Create category with parent depth=7 | Reject | `MAX_DEPTH_EXCEEDED`, 422 |
| Move category making cycle | Reject | `CATEGORY_CYCLE_DETECTED`, 422 |
| Delete category with children | Reject (or suggest force endpoint) | `CATEGORY_HAS_CHILDREN`, 422 |
| Delete category with products | Default reject; force-delete-and-reassign endpoint applies | `CATEGORY_HAS_PRODUCTS`, 422 |
| Slug collision per parent | Auto-suffix `-2` OR reject (configurable) | `SLUG_CONFLICT`, 409 |
| Concurrent move (two admins move same category) | Optimistic lock via version | `RESOURCE_VERSION_MISMATCH`, 412 |
| Smart rules with invalid field name | Reject | `INVALID_RULE_FIELD`, 422 |
| Smart rules query timeout (>30s) | Mark materialize failed, keep previous state | `RULES_QUERY_TIMEOUT` |
| Storefront request for hidden category | 404 | `NOT_FOUND`, 404 |
| Storefront request for category with `is_visible=true` but `is_visible_in_menu=false` | OK, displays category page; menu does not list it | (success) |
| Category soft-deleted, products orphaned | Products retain category id reference; UI shows "Deleted category" badge | (warning) |
| Industry profile import: existing slug conflict | Skip conflicting; report skipped count | (success with warning) |
| Collection materialize while another job running | Acquire advisory lock; queue waits | (success, possibly delayed) |
| Smart collection preview returns 0 products | OK, allow save but warn merchant | (warning) |
| Hybrid collection manual entry references deleted product | Cascade DELETE | (transparent) |
| Categories tree with 10k nodes | Response paginated/virtualized in admin tree view; storefront tree endpoint limited to depth 3 + lazy-load deeper | (handled) |

---

## 12. Performance

### 12.1 Targets

| Operation | p50 | p95 | p99 |
|---|---|---|---|
| `GET /storefront/categories/tree` (cached) | 5 ms | 20 ms | 50 ms |
| `GET /storefront/categories/tree` (cache miss) | 50 ms | 150 ms | 300 ms |
| `GET /storefront/categories/{slug}` | 20 ms | 60 ms | 120 ms |
| `GET /storefront/categories/{slug}/products` (Meilisearch) | 40 ms | 120 ms | 250 ms |
| `POST /categories` (create) | 50 ms | 150 ms | 300 ms |
| `POST /categories/{id}:move` (small subtree) | 80 ms | 200 ms | 500 ms |
| `POST /categories/{id}:move` (1000+ descendants) | 500 ms | 2000 ms | 5000 ms |
| `POST /collections:preview-rules` (≤50 matches) | 50 ms | 200 ms | 800 ms |
| `JOB-MATERIALIZE-SMART-COLLECTION` (1000 products) | 500 ms | 2000 ms | 8000 ms |

### 12.2 Optimization

- **Tree cache:** entire tree response cached in Redis (TTL 5 min, surrogate key `category-tree:{tenant_id}`). Invalidation event-driven.
- **ltree GiST index** pro O(log N) ancestor/descendant queries
- **Materialized smart collections** zapisují do `product_collections` — storefront query je standardní JOIN, ne dynamic rule evaluation
- **Lazy descendants:** Storefront tree endpoint vrací depth 2 default; client lazy-loads deeper via `GET /categories/{id}/children`
- **Smart collection re-evaluation:** debounced 60s per collection; product event triggers `evaluateCollectionsAffectedBy(product_changed_fields)` filtered subset (jen collections jejichž rules mention changed field)

### 12.3 Hot path queries

```sql
-- Get category by path (storefront URL resolution)
SELECT * FROM categories
WHERE tenant_id = $1 AND path = $2::ltree
  AND deleted_at IS NULL AND is_visible = true
LIMIT 1;
-- Uses idx_categories_tenant_path_btree

-- List descendants (e.g., "show all products under Electronics including subcategories")
SELECT id FROM categories
WHERE tenant_id = $1 AND path <@ $2::ltree
  AND deleted_at IS NULL AND is_visible = true;
-- Uses idx_categories_tenant_path_gist (ltree GiST)

-- Get tree (root + 2 levels deep, for storefront tree endpoint)
SELECT * FROM categories
WHERE tenant_id = $1 AND nlevel(path) <= 3
  AND deleted_at IS NULL AND is_visible_in_menu = true
ORDER BY path;
-- Single query, then app-level tree assembly
```

---

## 13. Security

### 13.1 Permissions

```
PERM-CATEGORY-VIEW
PERM-CATEGORY-CREATE
PERM-CATEGORY-UPDATE
PERM-CATEGORY-DELETE
PERM-CATEGORY-MOVE        # gated separately (high impact)
PERM-CATEGORY-IMPORT-TEMPLATE
PERM-COLLECTION-VIEW
PERM-COLLECTION-CREATE
PERM-COLLECTION-UPDATE
PERM-COLLECTION-DELETE
PERM-COLLECTION-MATERIALIZE
```

### 13.2 Field-level

- `CATALOG-EDITOR` může update `name`, `description_html`, `banner_media_id`, `seo_*` — ale **ne** `parent_id`, `position`, `is_visible`, `is_visible_in_menu`
- Smart collection rules edit vyžaduje `PERM-COLLECTION-UPDATE` + extra check (kompletní rule set kontroly přístupu k referenced fields)

### 13.3 HTML sanitization

`description_html` v category i collection prochází stejnou sanitization jako product HTML (viz `06 §13.3`).

### 13.4 Rate limits

| Endpoint | Free | Pro |
|---|---|---|
| `GET /storefront/categories/tree` | 60/min/IP | 1200/min/IP |
| `POST /collections:preview-rules` | 30/min | 300/min |
| `POST /categories/{id}:move` | 30/min | 300/min |
| `POST /collections/{id}:materialize` | 5/min | 60/min |

### 13.5 Audit

- Tree mutations (move, delete) — 100% audit log entry s actor, before/after path
- Rules changes (smart collection) — 100% audit log entry s rules diff

---

## 14. Testing

### 14.1 Unit

```
TEST-UNIT-CATEGORY-001  CycleDetector — direct parent
TEST-UNIT-CATEGORY-002  CycleDetector — distant ancestor
TEST-UNIT-CATEGORY-003  PathRecomputer — single move
TEST-UNIT-CATEGORY-004  PathRecomputer — subtree move
TEST-UNIT-CATEGORY-005  SlugNormalizer (ltree-safe)
TEST-UNIT-COLLECTION-001  RulesValidator — valid DSL
TEST-UNIT-COLLECTION-002  RulesValidator — invalid field
TEST-UNIT-COLLECTION-003  RulesValidator — max depth
TEST-UNIT-COLLECTION-004  SqlBuilder from rules DSL — basic AND
TEST-UNIT-COLLECTION-005  SqlBuilder from rules DSL — nested OR
```

### 14.2 Integration

```
TEST-INT-CATEGORY-001  Create root → path set correctly
TEST-INT-CATEGORY-002  Create child → path extends parent
TEST-INT-CATEGORY-003  Move subtree → all descendant paths recomputed
TEST-INT-CATEGORY-004  Delete with children → reject
TEST-INT-CATEGORY-005  Force delete with reassignment
TEST-INT-CATEGORY-006  Primary category constraint (unique per product)
TEST-INT-CATEGORY-007  Concurrent move → optimistic lock conflict
TEST-INT-COLLECTION-001  Manual collection — add/remove products
TEST-INT-COLLECTION-002  Smart materialize — basic rule
TEST-INT-COLLECTION-003  Smart materialize — diff (no full rewrite)
TEST-INT-COLLECTION-004  Hybrid — manual entries preserved on remateriaalize
TEST-INT-COLLECTION-005  Materialize lock — no concurrent runs same collection
TEST-INT-COLLECTION-006  Campaign window — visibility toggling via cron
```

### 14.3 E2E

```
TEST-E2E-CATEGORY-001  Admin drag-drop reorder tree
TEST-E2E-CATEGORY-002  Storefront category browse + breadcrumb
TEST-E2E-COLLECTION-001  Admin smart collection builder + preview
TEST-E2E-COLLECTION-002  Storefront collection landing page
```

### 14.4 Load

```
TEST-LOAD-CATEGORY-001  10k concurrent GET /storefront/categories/tree (cached) → p95 < 20 ms
TEST-LOAD-COLLECTION-001  100 simultaneous smart collection materializations → no deadlocks
```

---

## 15. Implementation checklist

### Backend
- [ ] **[S]** Drizzle schema `packages/db/src/schema/categories.ts`, `collections.ts`, `product_categories.ts`, `product_collections.ts`
- [ ] **[S]** Migrace `20260521_001_create_categories_collections.sql` + ltree extension + indexy + triggers (path bump, primary constraint sync)
- [ ] **[S]** Seed: 5 root categories + 20 child categories pro demo shop
- [ ] **[M]** `CategoryService` — CRUD + move + cycle detection + path recompute
- [ ] **[M]** `CollectionService` — CRUD + publish + materialize trigger
- [ ] **[M]** `CollectionRulesEngine` — Zod validator + SQL builder + preview
- [ ] **[S]** `CategoryTreeBuilder` — efficient flat list → tree assembly
- [ ] **[S]** `SlugNormalizer` (ltree-safe transliteration)
- [ ] **[S]** Triggers: primary category constraint sync, path subtree update on rename
- [ ] **[M]** REST endpoints per §6
- [ ] **[M]** GraphQL types + resolvers + DataLoaders (parent, children, products)
- [ ] **[S]** tRPC router (admin)
- [ ] **[S]** MCP tool `catalog.list_categories`

### Background jobs
- [ ] **[L]** JOB-MATERIALIZE-SMART-COLLECTION — locking, diff, batched apply
- [ ] **[S]** JOB-RECOMPUTE-CATEGORY-PRODUCT-COUNT — hourly
- [ ] **[S]** CRON-MATERIALIZE-SMART-COLLECTIONS-SWEEP — 5 min
- [ ] **[S]** CRON-PUBLISH-SCHEDULED-COLLECTIONS
- [ ] **[S]** CRON-EXPIRE-COLLECTIONS
- [ ] **[S]** JOB-IMPORT-CATEGORY-TEMPLATE (industry profile preset)

### Frontend — Admin
- [ ] **[L]** Category tree editor (drag-drop, inline rename, context menu)
- [ ] **[M]** Category detail editor (general, products, SEO, banner)
- [ ] **[M]** Bulk product attach modal
- [ ] **[L]** Collection list + manual editor
- [ ] **[L]** Smart collection rule builder (visual)
- [ ] **[M]** Collection detail (preview, materialize button, audit log of materializations)
- [ ] **[S]** Industry profile import wizard

### Frontend — Storefront
- [ ] **[M]** Category landing page (`/c/{path}` — multi-segment route)
- [ ] **[S]** Subcategory tiles component
- [ ] **[S]** Breadcrumb component (uses Category.ancestors)
- [ ] **[M]** Collection landing page (`/collections/{slug}`)
- [ ] **[S]** Collection countdown component (when available_until set)
- [ ] **[S]** JSON-LD: BreadcrumbList + ItemList schemas

### Tests
- [ ] **[M]** Per §14 (unit + integration + E2E + load)

### Docs
- [ ] **[S]** "Managing your category tree" admin guide
- [ ] **[S]** "Building smart collections with rules" admin guide
- [ ] **[S]** Developer docs: rules DSL spec + extension hooks

---

## 16. Open questions

### Q-CAT-001: Slug uniqueness across locales
**Otázka:** Slug `lampa` v `cs-CZ` může konfliktovat se slugem `lampa` jiné kategorie v `en-US`? Storefront URL routing je locale-prefixed (`/cs/c/lampa` vs `/en/c/lampa`), takže technicky NE. Ale admin UI bude bezpečnější zachovat konzistenci.

**Status:** TBD — pravděpodobně decision: slug unique per (tenant, locale, parent_id). Detail v `23-i18n.md`.

### Q-CAT-002: Auto-archive po smazání parent kategorie
**Otázka:** Pokud merchant smaže parent kategorii a "force delete + reassign", co s descendants? Reassign do grandparent? Move pod "Uncategorized"?

**Status:** MVP: move descendants pod parent (next level up). UI flow ukáže preview tree po reassignment.

### Q-CAT-003: Per-customer-group visible categories
**Otázka:** B2B scenario — některé kategorie viditelné jen pro logged-in B2B customery. Jak modelovat? `category.visible_to_groups[]` array?

**Status:** v1.0+ feature. MVP: pouze global `is_visible`. Detail v `21-b2b-complete.md`.

### Q-COL-001: Smart rules — datetime relative
**Otázka:** Jak modelovat "v posledních 30 dnech"? Hardcoded date (musí se updatovat denně) vs relative expression (`"value": "30d_ago"`)?

**Status:** Relative expression preferred — engine resolve při query time. MVP: support `7d_ago`, `30d_ago`, `90d_ago`, `start_of_month`, `start_of_year`. Doc DSL detail.

### Q-COL-002: Smart rules — aggregate conditions
**Otázka:** "Products with rating >= 4.5 averaged across reviews"? Vyžaduje JOIN s reviews + aggregation.

**Status:** v1.0+ — supportovat přes `aggregate_*` field names. MVP: jen scalar fields.

### Q-COL-003: Collection priority / order pro produkty v multiple collections
**Otázka:** Pokud produkt je v 5 collections, jak storefront vybere primary collection pro breadcrumb? (Categories mají `primary_category_id`. Collections ne — explicit.)

**Status:** Collections nikdy nejsou breadcrumb-relevant (categories ano). Žádný "primary collection" potřeba.

### Q-CAT-004: Versioning category tree
**Otázka:** Můžu se vrátit ke staré verzi tree?

**Status:** Out of scope MVP. Audit log zachycuje all changes — admin může manuálně revert přes UI. Plný versioning by vyžadoval append-only `category_revisions` table — Fáze 3+.

### Q-COL-004: AI-suggested smart rules
**Otázka:** DEC-AI-001 — AI Copilot navrhuje rules ze natural language ("vytvoř collection pro letní výprodej pod 500 Kč")?

**Status:** v1.0+ feature v `33-ai-features.md`. MVP: jen visual builder.

---

## 📅 Změny

| Datum | Změna |
|---|---|
| 2026-05-19 | Initial — kompletní Categories & Collections domain. ltree-based hierarchy, smart collection rules DSL, materialized read model. |

---

**Konec Categories & Taxonomy.**

➡️ Pokračovat na: [`08-search-filtering.md`](08-search-filtering.md)
