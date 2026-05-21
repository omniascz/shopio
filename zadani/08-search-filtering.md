# 08 – SEARCH & FILTERING

> **Doména:** Fulltextové vyhledávání, faceted filtering, autocomplete, "search as you type", semantic (vector) search a search analytics. Primární engine: **Meilisearch** ([DEC-SEARCH-001](01-decisions-registry.md#dec-search-001-default-search-engine)). Postgres `pgvector` jako companion pro semantic similarity. Pgsql FTS jen jako fallback při outage.

**Datum:** 2026-05-19
**Verze:** 1.0
**Status:** 🟡 DESIGN
**Reference:** [03 §4 (products)](03-data-models-master.md#4-catalog--pim) · [06-catalog-pim.md](06-catalog-pim.md) · [07-categories-taxonomy.md](07-categories-taxonomy.md) · [DEC-SEARCH-001](01-decisions-registry.md#dec-search-001-default-search-engine)

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

- **Fulltextové vyhledávání** — Meilisearch indexer, typo tolerance, multi-language analyzery (CZ/SK/DE/EN/PL na start)
- **Faceted filtering** — multi-select facets (brand, kategorie, atributy, ceny, dostupnost) s counts
- **Autocomplete / search-as-you-type** — sub-50ms latence, top-N suggestions
- **Sorting** — custom ranking rules (relevance, price, rating, novinky, popularity)
- **Semantic search** — pgvector + embeddings (DEC-AI-001) pro "show me products like this"
- **Search analytics** — top queries, zero-result queries, CTR, conversion attribution
- **Synonyms a stop words** — per tenant + per locale
- **Search redirects** — "iphone" → category page
- **Personalization** — per-customer query history (opt-in, GDPR-aware, Fáze 2+)
- **A/B testing search relevance** (Fáze 2+)

### 0.2 Co tato doména **NENÍ**

- ❌ Product taxonomie samotná (→ `07`)
- ❌ Product CRUD (→ `06`)
- ❌ AI Copilot chat / RAG search (→ `33`)
- ❌ Recommendation engine (related products, "you may also like" — Fáze 2 v `33-ai-features.md`)
- ❌ Site-wide search napříč CMS pages, blog posts, FAQ — to je `32-cms-content.md` (může indexovat do stejného Meilisearch instance ale jiný index)

### 0.3 Diferenciátory

1. **Sub-50ms p95 search** — Meilisearch in-memory, per-tenant index sharding
2. **Multi-language analyzery per locale** — CZ diacritics handling, SK/PL stemming, DE compound words splitting
3. **Hybrid search** — Meilisearch lexical + pgvector semantic — merge results s configurable weight (Fáze 1 trailing → v1.0)
4. **Zero-result recovery** — automatický fallback: typo suggest → semantic search → "did you mean X" → most relevant category
5. **Agent-native search** — MCP `catalog.search_products` tool s structured filter input

---

## 1. References

- [DEC-SEARCH-001](01-decisions-registry.md#dec-search-001-default-search-engine) — Meilisearch default + OpenSearch upgrade
- [DEC-AI-001](01-decisions-registry.md#dec-ai-001-default-ai-provider) — embeddings provider
- [DEC-EVENTS-001](01-decisions-registry.md#dec-events-001-event-bus--background-jobs) — outbox + BullMQ pro indexer pipeline
- [DEC-PERF-001](01-decisions-registry.md#dec-perf-001-performance-targets) — sub-150ms p95 target pro `/search`
- [03 §4](03-data-models-master.md#4-catalog--pim) — products, variants schema
- [06-catalog-pim.md](06-catalog-pim.md) — kanonické produkt data
- [07-categories-taxonomy.md](07-categories-taxonomy.md) — category filter
- [10-pricing-promotions.md](10-pricing-promotions.md) — price filter (multi-currency)
- [09-inventory.md](09-inventory.md) — stock status filter
- [20-analytics-reporting.md](20-analytics-reporting.md) — search analytics export
- [22-multistore-channels.md](22-multistore-channels.md) — per-channel search overrides
- [23-i18n.md](23-i18n.md) — per-locale indexes
- [33-ai-features.md](33-ai-features.md) — semantic / vector / AI-augmented search
- Meilisearch docs (v1.10+ assumed)

---

## 2. Personas

| Persona | Použití | Permissions |
|---|---|---|
| `PERSONA-MERCHANT-OWNER` | Spravuje synonymy, ranking rules, redirects, analytics | `PERM-SEARCH-*` |
| `PERSONA-MARKETING-MANAGER` | Synonymy, redirects, "search merchandising" (pinned results) | `PERM-SEARCH-CONFIG-VIEW/UPDATE`, `PERM-SEARCH-ANALYTICS-VIEW` |
| `PERSONA-CATALOG-MANAGER` | Trigger reindex, view index health | `PERM-SEARCH-REINDEX`, `PERM-SEARCH-CONFIG-VIEW` |
| `PERSONA-CUSTOMER` | Storefront search + autocomplete | Anon endpoints |
| `PERSONA-AI-COPILOT` | Query rewrite suggestions, semantic query expansion (Fáze 2+) | `agent:catalog:read` + `agent:search:rewrite` |
| `PERSONA-EXTERNAL-AGENT` | MCP `catalog.search_products` | `agent:catalog:read` |

---

## 3. Data models

### 3.1 Meilisearch indexes

Meilisearch je **externí stav**, ne Postgres tabulka. Index naming convention:

```
products:{tenant_id}:{locale}         # main product index per tenant per locale
collections:{tenant_id}:{locale}      # collection landing search
categories:{tenant_id}:{locale}       # category search (autocomplete usage)
search_history:{tenant_id}            # query log (analytics input)
content:{tenant_id}:{locale}          # CMS pages, blog posts (viz 32)
```

**Per-locale rationale:** Meilisearch volí analyzer per index, jeden tenant s 5 locales = 5 product indexes. Master-index aggregation by storefront query layer.

### 3.2 Product index document shape

```jsonc
{
  "id": "01927bca-...",                    // Meilisearch primary key — product UUID
  "pub_id": "prd_aB3cD4eF5g6h",
  "slug": "stolni-lampa-luna",
  "tenant_id": "...",
  "locale": "cs-CZ",
  "title": "Stolní lampa Luna",
  "short_description": "Designová LED lampa...",
  "description_text": "...",               // HTML stripped, lemmatized per locale
  "brand_id": "brd_...",
  "brand_name": "Luna Design",             // denormalized for facet
  "vendor_id": "vnd_...",
  "vendor_name": "Innogy s.r.o.",
  "category_ids": ["cat_root", "cat_phones", "cat_smartphones"],   // self + all ancestor paths
  "category_paths": ["electronics", "electronics.phones", "electronics.phones.smartphones"],
  "category_names": ["Elektronika", "Telefony", "Smartphony"],
  "primary_category_id": "cat_phones",
  "collection_ids": ["col_summer_sale", "col_best_sellers"],
  "tags": ["lighting", "led", "design"],
  "type": "variable",
  "status": "active",
  "is_available": true,                    // computed: status=active AND now ∈ window AND has_active_variants
  "tax_class_code": "standard",
  "weight_grams": 1200,
  "metadata": {                            // whitelisted facetable attributes only
    "color": ["white", "black"],
    "size": ["small", "large"],
    "warranty_months": 24,
    "country_of_origin": "CZ"
  },

  // Pricing snapshot (denormalized, refreshed on price change events):
  "price_min": 12990,                      // cents, in tenant default currency
  "price_max": 18990,
  "price_currency": "CZK",
  "prices_by_list": {                      // pre-computed pro per-customer-group filtering
    "retail": { "min": 12990, "max": 18990 },
    "vip": { "min": 11990, "max": 17990 }
  },
  "compare_at_price_min": 15990,
  "has_discount": true,
  "discount_percent_max": 30,

  // Inventory snapshot:
  "stock_status": "in_stock",              // "in_stock" | "low_stock" | "out_of_stock" | "backorder"
  "in_stock_variant_count": 4,
  "total_variant_count": 4,

  // Variant-level facet inputs (aggregated):
  "available_colors": ["white", "black"],
  "available_sizes": ["small", "large"],
  "skus": ["LUNA-WHITE-S", "LUNA-WHITE-L", ...],
  "barcodes": ["8590000000001", ...],

  // Rating (denormalized z reviews — Fáze 2):
  "rating_avg": 4.6,
  "rating_count": 47,

  // Popularity signals:
  "view_count_30d": 1247,
  "purchase_count_30d": 89,
  "conversion_rate_30d": 0.071,
  "popularity_score": 0.83,                // computed per CRON-RECOMPUTE-POPULARITY

  // Sort / ranking fields:
  "created_at_ts": 1747749600,             // epoch seconds (Meilisearch needs int for sort)
  "updated_at_ts": 1747836000,
  "published_at_ts": 1747750000,

  // Media:
  "primary_image_url": "https://cdn.shopio.com/...",
  "primary_image_lqip": "data:image/webp;base64,...",  // low-quality placeholder
  "image_count": 12,

  // Search-only / discoverability:
  "search_keywords": ["lampa", "led", "design", "stolní", "luna"],  // manual boost
  "synonyms_match_bag": ["LED lamp", "table lamp", "designer lamp"],  // for cross-language fallback
  "embedding_id": "01927bca-..."           // pointer to pgvector row; not stored in MS
}
```

**Důležité:** Meilisearch dokument je **read model**. Plain truth žije v Postgres. Indexer (JOB-REINDEX-PRODUCT) je jediný writer.

### 3.3 Meilisearch index settings

Per `products:{tenant_id}:{locale}`:

```jsonc
{
  "searchableAttributes": [
    "title",
    "search_keywords",
    "short_description",
    "synonyms_match_bag",
    "brand_name",
    "category_names",
    "tags",
    "skus",
    "barcodes",
    "description_text"
  ],
  "filterableAttributes": [
    "tenant_id",
    "status",
    "is_available",
    "type",
    "brand_id",
    "vendor_id",
    "category_ids",
    "category_paths",
    "primary_category_id",
    "collection_ids",
    "tags",
    "tax_class_code",
    "stock_status",
    "has_discount",
    "price_min",
    "price_max",
    "rating_avg",
    "available_colors",
    "available_sizes",
    "metadata.color",
    "metadata.size",
    "metadata.warranty_months",
    "metadata.country_of_origin",
    "created_at_ts",
    "published_at_ts"
  ],
  "sortableAttributes": [
    "price_min",
    "created_at_ts",
    "updated_at_ts",
    "published_at_ts",
    "popularity_score",
    "rating_avg",
    "purchase_count_30d"
  ],
  "rankingRules": [
    "words",
    "typo",
    "proximity",
    "attribute",
    "sort",
    "exactness",
    "popularity_score:desc"     // custom: tie-breaker by popularity
  ],
  "synonyms": {
    "lampa": ["lampička", "svítidlo"],
    "iphone": ["apple iphone", "iphone"]
  },
  "stopWords": ["a", "an", "the", "v", "na", "do", "z", "se"],
  "typoTolerance": {
    "enabled": true,
    "minWordSizeForTypos": { "oneTypo": 4, "twoTypos": 8 },
    "disableOnAttributes": ["skus", "barcodes"]
  },
  "faceting": { "maxValuesPerFacet": 200 },
  "pagination": { "maxTotalHits": 10000 },
  "displayedAttributes": ["*"],
  "distinctAttribute": null,
  "proximityPrecision": "byWord"
}
```

### 3.4 Postgres companion tables

#### `search_synonyms`

Per-tenant + per-locale synonym sets, mirrored do Meilisearch.

```sql
CREATE TABLE search_synonyms (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  locale TEXT NOT NULL,
  primary_term TEXT NOT NULL,
  synonyms TEXT[] NOT NULL DEFAULT '{}',
  is_bidirectional BOOLEAN NOT NULL DEFAULT true,
  notes TEXT NULL,
  -- audit fields
  CONSTRAINT uq_synonyms_tenant_locale_term UNIQUE (tenant_id, locale, primary_term)
);
```

#### `search_redirects`

Specific query → URL redirect (e.g., "iphone" → category page).

```sql
CREATE TABLE search_redirects (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  locale TEXT NULL,                                  -- NULL = all locales
  query TEXT NOT NULL,                                -- exact match (case-insensitive)
  match_kind TEXT NOT NULL CHECK (match_kind IN ('exact','prefix','contains')) DEFAULT 'exact',
  redirect_to_url TEXT NOT NULL,
  redirect_to_kind TEXT NOT NULL CHECK (redirect_to_kind IN ('category','collection','product','cms_page','external')) DEFAULT 'external',
  redirect_to_id UUID NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  -- audit fields
  CONSTRAINT uq_search_redirects UNIQUE (tenant_id, locale, query, match_kind) DEFERRABLE INITIALLY IMMEDIATE
);

CREATE INDEX idx_search_redirects_active ON search_redirects (tenant_id, query) WHERE is_active = true;
```

#### `search_pinned_results`

Merchandising: manual boost konkrétních produktů pro konkrétní query ("search merchandising").

```sql
CREATE TABLE search_pinned_results (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  locale TEXT NULL,
  query TEXT NOT NULL,
  product_id UUID NOT NULL REFERENCES products(id),
  position INTEGER NOT NULL,                          -- 1-based, target slot in result list
  starts_at TIMESTAMPTZ NULL,
  ends_at TIMESTAMPTZ NULL,
  -- audit fields
  CONSTRAINT uq_pinned UNIQUE (tenant_id, locale, query, product_id)
);

CREATE INDEX idx_pinned_query ON search_pinned_results (tenant_id, query) WHERE (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at > now());
```

Pinned results jsou **post-process** v API gateway (Meilisearch nepodporuje per-query result manipulation), ne jako Meilisearch boosting.

#### `search_queries_log`

Analytics: každý search request logovaný (sample 100% v MVP, později 10%).

```sql
CREATE TABLE search_queries_log (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locale TEXT NULL,
  channel_id UUID NULL,
  query_raw TEXT NOT NULL,
  query_normalized TEXT NOT NULL,                     -- lowercase, trimmed, diacritics-stripped
  filters JSONB NULL,
  sort TEXT NULL,
  result_count INTEGER NOT NULL,
  clicked_product_id UUID NULL,
  clicked_position INTEGER NULL,
  customer_id UUID NULL,                              -- anonymized if no consent
  session_hash TEXT NULL,                             -- anonymized session correlator
  duration_ms INTEGER NULL,
  zero_result BOOLEAN GENERATED ALWAYS AS (result_count = 0) STORED,
  source TEXT NOT NULL CHECK (source IN ('storefront','admin','agent','api')) DEFAULT 'storefront'
) PARTITION BY RANGE (occurred_at);

-- Monthly partitions, BRIN index
CREATE INDEX brin_search_queries_log_occurred_at ON search_queries_log USING BRIN (occurred_at);
CREATE INDEX idx_search_queries_zero ON search_queries_log (tenant_id, query_normalized) WHERE zero_result = true;
```

Retention 90 dní default (Free), 12 měsíců Pro+, 2 roky Enterprise.

#### `search_query_aggregates`

Materializovaný read model pro analytics dashboards (recomputed denně).

```sql
CREATE TABLE search_query_aggregates (
  tenant_id UUID NOT NULL,
  period DATE NOT NULL,                              -- daily bucket
  locale TEXT NULL,
  query_normalized TEXT NOT NULL,
  search_count INTEGER NOT NULL,
  zero_result_count INTEGER NOT NULL,
  click_count INTEGER NOT NULL,
  avg_clicked_position NUMERIC(6,2) NULL,
  unique_sessions INTEGER NOT NULL,
  PRIMARY KEY (tenant_id, period, locale, query_normalized)
);
```

#### Vector embeddings

`products.embedding vector(1536)` (viz [03 §23.4](03-data-models-master.md#234-pgvector) + [06 §3.1](06-catalog-pim.md#31-products-ent-product-001)). Provider default OpenAI `text-embedding-3-small` (DEC-AI-001, Q-PIM-002).

```sql
CREATE INDEX idx_products_embedding_hnsw
  ON products USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL AND deleted_at IS NULL;
```

Semantic search query: cosine distance threshold (configurable per tenant, default 0.30).

---

## 4. State machines

### 4.1 Index lifecycle

```
              create_index
[no index] ─────────────────▶ [empty]
                                   │
                                   │ initial bulk insert
                                   ▼
                              [populated]
                                   │
                                   │ incremental updates (per product event)
                                   ▼
                              [populated, in-sync]
                                   │
                                   │ rebuild trigger (settings change, schema drift)
                                   ▼
                              [populated, rebuilding]
                                   │
                                   │ swap alias → new index
                                   ▼
                              [populated, in-sync]
```

**Zero-downtime reindex pattern:**
1. Create new index `products:{tenant}:{locale}:rebuild_{ts}`
2. Bulk populate from Postgres (paginated, parallel)
3. Atomically swap Meilisearch index alias `products:{tenant}:{locale}` → new index
4. Delete old index after grace period (1h)

### 4.2 Document lifecycle (per product)

```
EVENT-PRODUCT-CREATED      → JOB-INDEX-PRODUCT (upsert)
EVENT-PRODUCT-UPDATED      → JOB-INDEX-PRODUCT (upsert, debounced 5s)
EVENT-PRODUCT-PUBLISHED    → JOB-INDEX-PRODUCT (upsert)
EVENT-PRODUCT-ARCHIVED     → JOB-INDEX-PRODUCT (upsert with is_available=false)
EVENT-PRODUCT-DELETED      → JOB-INDEX-PRODUCT (delete document)
EVENT-VARIANT-*            → JOB-INDEX-PRODUCT (parent product upsert)
EVENT-STOCK-LEVEL-CHANGED  → JOB-INDEX-PRODUCT (debounced 30s, lightweight stock_status patch)
EVENT-PRICE-CHANGED        → JOB-INDEX-PRODUCT (debounced 30s, price_min/max patch)
EVENT-PRODUCT-CATEGORY-*   → JOB-INDEX-PRODUCT
EVENT-PRODUCT-COLLECTION-* → JOB-INDEX-PRODUCT
```

### 4.3 Embedding lifecycle

```
EVENT-PRODUCT-CREATED      → JOB-PRODUCT-EMBED (immediate)
EVENT-PRODUCT-UPDATED      → JOB-PRODUCT-EMBED (debounced 60s) — only if title/description/tags changed
                              (other field changes skip embed regen)
EVENT-PRODUCT-DELETED      → embedding cleared (set NULL)
```

---

## 5. Business rules

### RULE-SEARCH-001: Single-tenant index isolation
Každý tenant má vlastní Meilisearch index `products:{tenant_id}:{locale}`. Query napříč tenanty **není možné** ani v Cloud kontextu. Multi-tenant isolation = strong tenant boundary.

### RULE-SEARCH-002: Storefront vždy filter `status=active AND is_available=true`
Anonymous storefront search nesmí vrátit draft/archived/expired produkty. Filter aplikován **server-side**, ne klient-side (security: klient by mohl odstranit filter z requestu).

Admin search má opt-in `include_drafts=true` přes `PERM-PRODUCT-VIEW`.

### RULE-SEARCH-003: Per-locale fallback
Pokud customer locale `sk-SK` neexistuje (tenant disabled SK), padá na default locale tenanta. Response header `Shopio-Translation-Fallback: cs-CZ` signalizuje.

### RULE-SEARCH-004: Synonyms aplikované per-locale
Synonym definovaný pro `cs-CZ` neplatí v `en-US` indexu. Plugin / merchant explicitně mirror synonyma napříč locales pokud chce univerzální platnost.

### RULE-SEARCH-005: Index sync target lag ≤ 5s
Cílový lag mezi DB commit a Meilisearch reflect ≤ 5 sekund (p95). Při překročení: alert + admin notification + auto-bulk re-sync (catch-up).

Eventual consistency je explicit contract: klient nemůže předpokládat read-your-write z search endpointu.

### RULE-SEARCH-006: Faceted filter — ALL `AND`, multiple values `OR`
- Multi-select v rámci jednoho faceted filtru: OR (`brand IN (Nike, Adidas)`)
- Mezi různými facety: AND (`brand IN (Nike) AND color = red`)
- Custom `mode=AND` lze přes API explicitně pro multi-value (pro tag-style filtry, `?tags.mode=and`)

### RULE-SEARCH-007: Price filter používá customer's price list
Storefront search query přijímá kontext `customer_group_id` (pokud logged-in). Filter `price_min/max` se vztahuje k `prices_by_list.{group}` field, ne k retail. Anonymous fallback = `prices_by_list.retail`.

### RULE-SEARCH-008: Zero-result recovery chain
Když query vrací 0 výsledků, server zkouší fallbacky:
1. **Typo retry** — Meilisearch `typoTolerance` automaticky pokrývá
2. **Semantic search** — generate embedding query → pgvector cosine search, threshold 0.40, max 10 výsledků; vrátí jako `suggested_results`
3. **Synonym suggestion** — fuzzy match query proti `search_synonyms.primary_term`, vrátí "Did you mean X?"
4. **Most clicked recent queries** — vyšle 5 nedávných top queries jako "Try these"

Response signalizuje `meta.fallback_applied: "semantic" | "synonym" | "popular_queries"`.

### RULE-SEARCH-009: Search redirects mají prioritu před výsledky
Pokud query matchuje aktivní `search_redirects` row: 302 redirect (storefront browser) nebo JSON `{ redirect: { url, kind } }` (API).

### RULE-SEARCH-010: Pinned results post-process
Po Meilisearch query, server přesune pinned products na deklarovanou pozici. Pokud pinned product už není v výsledcích (filtered out facetou), pin se ignoruje.

### RULE-SEARCH-011: Autocomplete latency budget 50ms
Autocomplete endpoint vyhraje sub-50ms p95 — používá lite Meilisearch query s `attributesToRetrieve` omezenými na `[title, slug, primary_image_url, price_min]`, max 10 výsledků, žádné facets.

### RULE-SEARCH-012: PII v query logs
Customer ID logujeme **jen** s consent (`customer_consents.purpose='search_personalization'`). Bez consent: anonymized `session_hash` (rotovaný daily).

GDPR right-to-erasure: cascade delete `search_queries_log WHERE customer_id = X`. Anonymized hash zůstává (no link to PII).

### RULE-SEARCH-013: Stop words per-locale
Stop words list per locale (např. CZ: `a, na, do, z, se, je, …`). Configurable per tenant override.

### RULE-SEARCH-014: Vector search opt-in per tenant
Semantic search vyžaduje embedding generation (DEC-AI-001 token cost). Default opt-in pro Pro+ tier; Free tier má lexical jen.

### RULE-SEARCH-015: Per-channel search overrides
Channel může mít vlastní synonyms / pinned results / redirect set (přes `channel_id` discriminator v companion tables). Default cascade z tenant-level pokud channel-level absent.

### RULE-SEARCH-016: Search query normalization
Query input je normalizovaný před zápisem do log a před lookup v redirects:
- Lowercase
- Trim whitespace, collapse multiple spaces
- Strip diacritics pro storage (`café` → `cafe`); raw query zachovaný v `query_raw` pro display
- Maximum 200 chars (longer → 422)
- Žádné kontrolní znaky, no SQL injection (parametrized queries vždy)

---

## 6. REST API endpoints

### 6.1 Storefront search (anonymous)

```
GET    /api/{date}/storefront/search?q={query}&limit=50&cursor=...&filter={...}&sort=...
POST   /api/{date}/storefront/search                    # complex query, JSON body (filters DSL)
GET    /api/{date}/storefront/autocomplete?q={prefix}&limit=10
GET    /api/{date}/storefront/search/zero-result-recovery?q={query}
POST   /api/{date}/storefront/search/click              # log click for analytics (fire-and-forget)
GET    /api/{date}/storefront/search/popular            # top queries (cached)
GET    /api/{date}/storefront/search/recent             # logged-in customer's recent (consent-gated)
```

### 6.2 Admin: config

```
GET    /api/{date}/search/config                        # current settings, synonyms, stopwords
PATCH  /api/{date}/search/config

GET    /api/{date}/search/synonyms
POST   /api/{date}/search/synonyms
PATCH  /api/{date}/search/synonyms/{id}
DELETE /api/{date}/search/synonyms/{id}
POST   /api/{date}/search/synonyms:import-csv

GET    /api/{date}/search/redirects
POST   /api/{date}/search/redirects
PATCH  /api/{date}/search/redirects/{id}
DELETE /api/{date}/search/redirects/{id}

GET    /api/{date}/search/pinned-results
POST   /api/{date}/search/pinned-results
PATCH  /api/{date}/search/pinned-results/{id}
DELETE /api/{date}/search/pinned-results/{id}

POST   /api/{date}/search/preview                       # admin preview search results pro testing
POST   /api/{date}/search/reindex                       # full rebuild → 202 + operation
POST   /api/{date}/search/reindex/{tenant_or_locale}    # partial rebuild
GET    /api/{date}/search/index-status                  # health check per index
```

### 6.3 Admin: analytics

```
GET    /api/{date}/search/analytics/top-queries?period=7d&limit=100
GET    /api/{date}/search/analytics/zero-results?period=7d&limit=100
GET    /api/{date}/search/analytics/no-click-queries?period=7d         # high search, low CTR
GET    /api/{date}/search/analytics/click-positions                    # CTR per position histogram
GET    /api/{date}/search/analytics/queries/{query_normalized}         # drill-down for single query
POST   /api/{date}/search/analytics/export                              # async CSV export
```

### 6.4 Example: Storefront search

```http
GET /api/2026-05-19/storefront/search?q=lampa&limit=24&filter[brand_id]=brd_aB,brd_xY&filter[price_min]=100&filter[price_max]=5000&sort=relevance HTTP/1.1
Accept-Language: cs-CZ
```

```jsonc
HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: public, max-age=60, stale-while-revalidate=300
Content-Language: cs-CZ

{
  "data": [
    {
      "id": "01927bca-...",
      "pub_id": "prd_aB3cD...",
      "type": "product",
      "attributes": {
        "title": "Stolní lampa Luna",
        "slug": "stolni-lampa-luna",
        "primary_image_url": "https://cdn.shopio.com/...",
        "primary_image_lqip": "data:image/webp;base64,...",
        "price": { "amount": 12990, "currency": "CZK" },
        "compare_at_price": { "amount": 15990, "currency": "CZK" },
        "stock_status": "in_stock",
        "rating_avg": 4.6,
        "rating_count": 47,
        "highlight": {
          "title": "Stolní <em>lampa</em> Luna"   // Meilisearch highlight
        }
      }
    },
    ...
  ],
  "facets": {
    "brand_id": [
      { "value": "brd_aB", "label": "Luna Design", "count": 12 },
      { "value": "brd_xY", "label": "Philips", "count": 8 }
    ],
    "category_paths": [
      { "value": "electronics.lighting.desk-lamps", "label": "Stolní lampy", "count": 18 }
    ],
    "price_range": {
      "min": 590,
      "max": 9990,
      "histogram": [
        { "bucket": "0-1000", "count": 5 },
        { "bucket": "1000-3000", "count": 12 }
      ]
    },
    "available_colors": [
      { "value": "white", "label": "Bílá", "count": 14 },
      { "value": "black", "label": "Černá", "count": 10 }
    ],
    "stock_status": [
      { "value": "in_stock", "count": 18 },
      { "value": "low_stock", "count": 2 }
    ],
    "rating_avg": [
      { "value": "4+", "count": 19 },
      { "value": "3+", "count": 22 }
    ]
  },
  "page": {
    "cursor": "eyJvZmZzZXQiOjI0fQ",
    "has_more": true,
    "total": 87
  },
  "meta": {
    "query": "lampa",
    "query_normalized": "lampa",
    "duration_ms": 28,
    "engine": "meilisearch",
    "applied_synonyms": ["lampička", "svítidlo"],
    "fallback_applied": null,
    "redirect": null,
    "request_id": "req_..."
  }
}
```

### 6.5 Example: Autocomplete

```http
GET /api/2026-05-19/storefront/autocomplete?q=lam&limit=10 HTTP/1.1
```

```jsonc
HTTP/1.1 200 OK
Cache-Control: public, max-age=10

{
  "data": {
    "products": [
      { "pub_id": "prd_aB...", "title": "Stolní lampa Luna", "slug": "stolni-lampa-luna", "primary_image_url": "...", "price": { "amount": 12990, "currency": "CZK" }}
    ],
    "categories": [
      { "id": "cat_lighting", "name": "Osvětlení", "url": "/c/elektronika/osvetleni" }
    ],
    "collections": [
      { "id": "col_summer", "name": "Letní výprodej 2026", "url": "/collections/letni-vyprodej-2026" }
    ],
    "suggestions": ["lampa", "lampička", "lampa stolní LED"]
  },
  "meta": {
    "duration_ms": 12
  }
}
```

### 6.6 Example: Zero-result with recovery

```http
GET /api/2026-05-19/storefront/search?q=lamp%20rgb%20velka HTTP/1.1
```

```jsonc
HTTP/1.1 200 OK

{
  "data": [],
  "facets": {},
  "page": { "has_more": false, "total": 0 },
  "meta": {
    "query": "lamp rgb velka",
    "fallback_applied": "semantic",
    "suggestions": ["lampa RGB", "LED pásek RGB", "velká stolní lampa"],
    "suggested_results": [
      { "pub_id": "prd_xY...", "title": "RGB LED lampa Aura", "similarity_score": 0.72 },
      { "pub_id": "prd_zZ...", "title": "Velká stojací lampa", "similarity_score": 0.65 }
    ],
    "popular_queries": ["LED lampa", "stolní lampa", "noční lampa"]
  }
}
```

### 6.7 Example: Search redirect hit

```http
GET /api/2026-05-19/storefront/search?q=iphone HTTP/1.1
```

```jsonc
HTTP/1.1 200 OK

{
  "data": [],
  "meta": {
    "redirect": {
      "url": "/c/elektronika/telefony/apple",
      "kind": "category",
      "id": "cat_apple",
      "match_query": "iphone",
      "match_kind": "exact"
    }
  }
}
```

Storefront frontend detects `redirect` field → `router.replace(url)`.

### 6.8 Click logging

```http
POST /api/2026-05-19/storefront/search/click HTTP/1.1
Content-Type: application/json

{
  "query": "lampa",
  "product_id": "prd_aB...",
  "position": 3,
  "session_hash": "s_..."
}
```

```http
HTTP/1.1 204 No Content
```

Fire-and-forget; klient nezablokuje navigation.

### 6.9 Example: Search synonym create

```http
POST /api/2026-05-19/search/synonyms HTTP/1.1

{
  "locale": "cs-CZ",
  "primary_term": "lampa",
  "synonyms": ["lampička", "svítidlo"],
  "is_bidirectional": true
}
```

```http
HTTP/1.1 201 Created
{
  "data": { "id": "...", "primary_term": "lampa", ... },
  "meta": {
    "operations": {
      "meilisearch_sync_job_id": "op_..."
    }
  }
}
```

---

## 7. GraphQL schema

```graphql
type SearchResult {
  query: String!
  queryNormalized: String!
  hits: [Product!]!
  facets: SearchFacets!
  pageInfo: PageInfo!
  totalCount: Int!
  durationMs: Int!
  engine: String!                          # "meilisearch" | "pgvector_fallback"
  appliedSynonyms: [String!]!
  fallbackApplied: SearchFallback
  suggestions: [String!]!
  suggestedResults: [SearchSuggestedProduct!]!
  popularQueries: [String!]!
  redirect: SearchRedirect
}

enum SearchFallback {
  TYPO
  SEMANTIC
  SYNONYM
  POPULAR_QUERIES
}

type SearchSuggestedProduct {
  product: Product!
  similarityScore: Float!
}

type SearchRedirect {
  url: String!
  kind: SearchRedirectKind!
  matchQuery: String!
  matchKind: SearchRedirectMatchKind!
}

enum SearchRedirectKind { CATEGORY COLLECTION PRODUCT CMS_PAGE EXTERNAL }
enum SearchRedirectMatchKind { EXACT PREFIX CONTAINS }

type SearchFacets {
  brandId: [FacetBucket!]!
  categoryPaths: [FacetBucket!]!
  collectionIds: [FacetBucket!]!
  tags: [FacetBucket!]!
  type: [FacetBucket!]!
  stockStatus: [FacetBucket!]!
  ratingAvg: [FacetBucket!]!
  availableColors: [FacetBucket!]!
  availableSizes: [FacetBucket!]!
  priceRange: PriceRangeFacet!
  customAttributes: JSON                   # metadata.* facets
}

type FacetBucket {
  value: String!
  label: String
  count: Int!
  isSelected: Boolean!
}

type PriceRangeFacet {
  min: Int!                                # cents
  max: Int!
  currency: String!
  histogram: [PriceBucket!]!
}
type PriceBucket { bucket: String!  count: Int! }

input SearchInput {
  query: String!
  locale: String
  channelId: ID
  filter: SearchFilter
  sort: SearchSort = RELEVANCE
  first: Int = 24
  after: String
  customerGroupId: ID                       # affects price list selection
  includeFacets: Boolean = true
  includeFallbacks: Boolean = true
}

input SearchFilter {
  brandIds: [ID!]
  categoryIds: [ID!]
  collectionIds: [ID!]
  tags: [String!]
  type: [ProductKind!]
  stockStatus: [String!]
  hasDiscount: Boolean
  priceMin: Int
  priceMax: Int
  ratingMin: Float
  availableColors: [String!]
  availableSizes: [String!]
  customAttributes: JSON                    # { "metadata.country_of_origin": "CZ" }
}

enum SearchSort {
  RELEVANCE
  PRICE_ASC
  PRICE_DESC
  NEWEST
  RATING_DESC
  POPULARITY
}

extend type Query {
  search(input: SearchInput!): SearchResult!
  autocomplete(query: String!, limit: Int = 10, locale: String): AutocompleteResult!
  popularSearchQueries(limit: Int = 10, locale: String): [String!]!
  myRecentSearchQueries(limit: Int = 10): [String!]!   # logged-in customer, consent-gated
}

type AutocompleteResult {
  products: [Product!]!
  categories: [Category!]!
  collections: [Collection!]!
  suggestions: [String!]!
  durationMs: Int!
}

extend type Mutation {
  logSearchClick(query: String!, productId: ID!, position: Int!, sessionHash: String): Boolean!
}
```

---

## 8. Events

| Build-spec ID | Wire | Payload |
|---|---|---|
| `EVENT-INDEX-REBUILD-STARTED` | `search.index_rebuild_started` | `{ tenant_id, index_name, requested_by }` |
| `EVENT-INDEX-REBUILD-COMPLETED` | `search.index_rebuild_completed` | `{ tenant_id, index_name, document_count, duration_ms }` |
| `EVENT-INDEX-REBUILD-FAILED` | `search.index_rebuild_failed` | `{ tenant_id, index_name, error }` |
| `EVENT-INDEX-DRIFT-DETECTED` | `search.index_drift_detected` | `{ tenant_id, index_name, drift_count }` |
| `EVENT-SEARCH-QUERY-LOGGED` | (internal only) | basic query log payload |
| `EVENT-SEARCH-SYNONYM-CREATED` | `search.synonym.created` | `{ synonym: Synonym }` |
| `EVENT-SEARCH-SYNONYM-UPDATED` | `search.synonym.updated` | `{ synonym, previous_attributes }` |
| `EVENT-SEARCH-REDIRECT-CREATED` | `search.redirect.created` | `{ redirect: Redirect }` |
| `EVENT-SEARCH-PINNED-CREATED` | `search.pinned.created` | `{ pinned }` |
| `EVENT-ZERO-RESULT-SPIKE-DETECTED` | `search.zero_result_spike_detected` | `{ tenant_id, query_normalized, count_24h, prev_24h }` |

**Konzumenti:**
- Meilisearch indexer (`JOB-INDEX-PRODUCT`, `JOB-SYNC-SYNONYMS`, …) konzumuje product/category/synonym events
- Analytics aggregator (`JOB-AGGREGATE-SEARCH-QUERIES`) ingestuje query logs denně
- Notification system informuje admina o zero-result spikes (auto-suggest přidat synonym/redirect)
- Webhook merchantského pluginu (např. Klaviyo) může reagovat na `search.zero_result_spike_detected`

---

## 9. Background jobs

| Job | Trigger | Queue | Frequency |
|---|---|---|---|
| `JOB-INDEX-PRODUCT` | EVENT-PRODUCT-*, EVENT-VARIANT-*, EVENT-STOCK-LEVEL-CHANGED, EVENT-PRICE-CHANGED | `search-index` | On-demand, debounced |
| `JOB-INDEX-CATEGORY` | EVENT-CATEGORY-* | `search-index` | On-demand |
| `JOB-INDEX-COLLECTION` | EVENT-COLLECTION-MATERIALIZED, EVENT-COLLECTION-* | `search-index` | On-demand |
| `JOB-REINDEX-FULL` | manual API call nebo schema change | `search-reindex` | On-demand |
| `JOB-SYNC-MEILISEARCH-SETTINGS` | EVENT-SEARCH-SYNONYM-*, EVENT-SEARCH-CONFIG-UPDATED | `search-config` | On-demand |
| `JOB-PRODUCT-EMBED` | EVENT-PRODUCT-CREATED/UPDATED (debounced 60s) | `ai-tasks` | On-demand |
| `JOB-AGGREGATE-SEARCH-QUERIES` | scheduled | `analytics` | Daily 02:00 |
| `JOB-DETECT-ZERO-RESULT-SPIKE` | scheduled | `analytics` | Hourly |
| `JOB-RECOMPUTE-POPULARITY` | scheduled | `analytics` | Hourly |
| `JOB-INDEX-DRIFT-CHECK` | scheduled | `integrity-checks` | Daily 04:00 |
| `JOB-PURGE-SEARCH-LOGS` | scheduled | `maintenance` | Daily (per retention policy) |
| `JOB-CLEANUP-OLD-MEILI-INDEXES` | scheduled | `maintenance` | Daily |
| `CRON-WARM-AUTOCOMPLETE-CACHE` | scheduled | `cache-warm` | Every 15 min (top-100 queries) |

### 9.1 JOB-INDEX-PRODUCT detail

```
Input: { product_id, locale (optional, default all enabled) }
Steps:
  1. Acquire row-level lock on outbox entry (already locked by BullMQ worker)
  2. Load product + variants + category memberships + collection memberships + price lists + inventory snapshots
  3. For each enabled locale:
     a. Build Meilisearch document per §3.2
     b. Apply translations from `translations` table
     c. Upsert to Meilisearch via API: POST /indexes/products:{tenant}:{locale}/documents
  4. Update product_search_status.last_indexed_at, last_indexed_version
  5. Emit EVENT-INDEX-DOCUMENT-UPSERTED (internal)

Retry: 5× exponential backoff. Persistent fail → admin alert + add to manual review queue.
Idempotency: Meilisearch upsert is idempotent by document id. Job dedupe key = (tenant, product_id, locale, source_event_id).
```

### 9.2 JOB-REINDEX-FULL detail

Zero-downtime full reindex (per §4.1):

```
Input: { tenant_id, locale (optional) }
Steps:
  1. Create new index alias suffix: products:{tenant}:{locale}:rebuild_{ts}
  2. Apply settings (searchable, filterable, sortable, synonyms, …)
  3. Stream products from Postgres in batches of 1000 (cursor pagination)
  4. Bulk insert each batch to new index
  5. Verify document count matches source (within 1% tolerance for in-flight changes)
  6. Atomic swap: rename old index → backup_{ts}, rename new → products:{tenant}:{locale}
     Meilisearch v1.10+ podporuje SWAP INDEXES atomicky
  7. Schedule deletion of backup after 1h grace period
  8. Emit EVENT-INDEX-REBUILD-COMPLETED
```

### 9.3 JOB-PRODUCT-EMBED detail

```
Input: { product_id }
Steps:
  1. Load product fields used for embedding: title, short_description, description_text (stripped),
     tags, brand_name, category_names, primary attribute values
  2. Compose embedding input text (configurable template per tenant):
     "{title}\n\n{short_description}\n\nBrand: {brand_name}\nCategories: {category_names}\nTags: {tags}\nColor: {color}\nMaterial: {material}"
  3. Truncate to provider token limit (text-embedding-3-small: 8191 tokens)
  4. Call DEC-AI-001 provider:
     - Default: OpenAI text-embedding-3-small, vector(1536)
     - Per-tenant override via tenant.settings.embedding_provider
  5. UPDATE products SET embedding = $1, embedding_provider = $2, embedding_model = $3, embedding_generated_at = now() WHERE id = $4
  6. Emit EVENT-PRODUCT-EMBEDDED (internal, for search-index reindex of embedding_id ref)

Retry: 3× backoff. Persistent fail (provider down) → schedule retry 1h later, no admin alert (graceful degradation).
Idempotency: regenerate is safe; cost monitored via ai_usage table.
```

### 9.4 JOB-INDEX-DRIFT-CHECK detail

```
Steps:
  1. For each enabled (tenant, locale) pair:
     a. Postgres: SELECT count(*) FROM products WHERE tenant_id=$1 AND deleted_at IS NULL AND status='active'
     b. Meilisearch: GET /indexes/products:{tenant}:{locale}/stats → numberOfDocuments where filters status=active
     c. Compute drift = |postgres_count - meili_count|
     d. If drift > 5 or drift_pct > 1% → emit EVENT-INDEX-DRIFT-DETECTED + enqueue JOB-REINDEX-FULL (low priority)
```

---

## 10. UI/UX flows

### FLOW-SEARCH-001: Storefront search box (customer)

```
[Storefront header — search input]
   user types "lam"
        │
        │  debounced 150ms
        ▼
[GET /storefront/autocomplete?q=lam]
   - dropdown shows products + categories + suggestions
        │
   user types more: "lampa"
        │
        ▼
[continued autocomplete]
        │
   user presses Enter / clicks "Search"
        │
        ▼
[GET /storefront/search?q=lampa]
   - landing /search?q=lampa results page
   - facets sidebar
   - "No results" recovery if applicable
        │
   user clicks product
        │
        ▼
[POST /storefront/search/click] (fire-and-forget)
[navigate to product page]
```

### FLOW-SEARCH-002: Admin search merchandising

```
[Search → Merchandising for query "lampa"]
        │
        ▼
[Search preview]
   - current top 50 results displayed
   - drag-drop reorder = pin
   - "+ Pin product" button → product picker modal
   - "Hide product" → exclude from results
   - Per pinned: set position, optional schedule (starts_at/ends_at)
        │
        │  Save
        ▼
[Pinned results stored, sync to Meilisearch][PATCH search/pinned-results]
[Confirmation toast]
```

### FLOW-SEARCH-003: Admin reviews zero-result queries

```
[Search analytics → Zero results report]
   - table: query | count | last_searched
   - sort by count desc
        │
   admin clicks query "lampa rbg"
        │
        ▼
[Drill-down]
   - last 10 searches with timestamps
   - inferred intent (AI suggestion, v1.0)
   - actions:
     [Add synonym] "rbg" → ["rgb"]
     [Add redirect] "lampa rbg" → /c/osvetleni/rgb
     [Manually pin top product]
   - history of resolutions
```

### FLOW-SEARCH-004: Reindex flow

```
[Admin → Search → Index health]
   - per-locale index status: docs, last_synced_at, drift_count
        │
   click "Rebuild index"
        │
        ▼
[Confirmation modal]
   - "Estimated duration: 4 min (12,000 products × 5 locales)"
   - Warnings if recent reindex < 1h ago
        │
   confirm
        │
        ▼
[POST /search/reindex → 202 + operation]
[Progress tracking panel — live]
   - per-locale progress bar
   - estimated completion
[On done: toast + refresh status]
```

### FLOW-SEARCH-005: External agent via MCP

```
[Agent (Claude, Operator, …)]
   1. MCP discovers tool catalog.search_products
   2. Agent calls with structured args:
      { query: "stolní lampa do 2000 Kč v bílé barvě", locale: "cs-CZ" }
   3. Server parses natural language to query + filters via Claude (DEC-AI-001) — Fáze 2+ feature
      OR agent splits manually:
      { query: "stolní lampa", filter: { price_max: 200000, available_colors: ["white"] }}
   4. Server executes Meilisearch query
   5. Response includes top 10 products, structured for agent consumption
   6. Agent presents to end-user OR continues (cart.add_item)
```

---

## 11. Edge cases & error handling

| Scenario | Behavior | Code |
|---|---|---|
| Query empty string | Reject | `INVALID_QUERY`, 400 |
| Query length > 200 chars | Reject | `QUERY_TOO_LONG`, 400 |
| Query contains only stop words | Treat as zero-result with `fallback_applied="popular_queries"` | (200) |
| Meilisearch down / timeout 5s | Fallback to Postgres FTS (degraded mode); response includes `meta.engine="pgsql_fts_fallback"`; log alert | (200 degraded) |
| Filter value invalid (e.g., non-existent category_id) | Return empty results + warning in meta (`meta.warnings: ["unknown_facet_value:..."]`) | (200) |
| Sort field not in `sortableAttributes` | Reject | `INVALID_SORT`, 400 |
| Pagination cursor invalid / expired | Reject | `INVALID_CURSOR`, 400 |
| Cursor pagination beyond `maxTotalHits` (10000) | Reject with hint "use filter to narrow" | `PAGINATION_LIMIT_EXCEEDED`, 400 |
| Embedding provider down | Skip semantic fallback silently; lexical only | (200) |
| Synonym create with empty primary_term | Reject | `VALIDATION_FAILED`, 422 |
| Synonym create conflict (duplicate primary_term) | Reject | `DUPLICATE_SYNONYM`, 409 |
| Reindex requested while another in progress | Queue (single concurrent per tenant) | `OPERATION_PENDING`, 202 |
| Search by SKU exact match | Should always work, even with typo tolerance disabled on attribute; lookup by exact SKU first, fallback to fulltext | (success) |
| Multi-word query with stop words ("the lamp") | Stop words ignored; lexical match on "lamp" | (success) |
| Customer search with personalization but no consent | Server ignores customer_id, anonymous search | (success) |
| Pinned product no longer in results (filtered out) | Pin ignored, log warning | (success with warning) |
| Index drift > threshold (e.g., 100 docs) | Auto-enqueue `JOB-REINDEX-FULL` low priority + admin notification | (background) |
| Search agent token with wrong scope | Reject | `INSUFFICIENT_SCOPE`, 403 |
| Locale not enabled for tenant | Fallback to default locale + `Shopio-Translation-Fallback` header | (success with warning) |
| Boolean string in filter ("true"/"false") instead of typed | Coerce; otherwise 400 | (handled) |
| Price filter with wrong currency | Convert via exchange_rates table to tenant default; warn if rate stale (> 24h) | (success with warning) |
| Empty Meilisearch index (fresh tenant, before reindex) | Empty results; meta includes `meta.warnings: ["index_empty"]`; suggest admin trigger reindex | (200) |
| pgvector HNSW index missing | Fallback to brute-force sequential scan; warning logged | (200 degraded) |
| Multiple synonyms registered for same term across locales — conflict | OK, isolated per locale; cross-locale propagation is opt-in | (success) |
| Search log writing fails (Postgres down for write) | Don't block user response; log to fallback file/queue for replay | (200) |

---

## 12. Performance

### 12.1 Targets

| Operation | p50 | p95 | p99 |
|---|---|---|---|
| `GET /storefront/autocomplete` | 8 ms | 25 ms | 50 ms |
| `GET /storefront/search` (cached) | 5 ms | 20 ms | 50 ms |
| `GET /storefront/search` (cache miss, simple query) | 20 ms | 60 ms | 120 ms |
| `GET /storefront/search` (with facets, 5+ filters) | 35 ms | 100 ms | 200 ms |
| Semantic search fallback (pgvector + cosine) | 40 ms | 120 ms | 250 ms |
| `JOB-INDEX-PRODUCT` per document | 20 ms | 60 ms | 150 ms |
| `JOB-REINDEX-FULL` (10k products, 1 locale) | 60 s | 180 s | 300 s |
| `JOB-AGGREGATE-SEARCH-QUERIES` (1M log rows) | 10 s | 30 s | 60 s |

### 12.2 Optimization

- **In-memory Meilisearch:** keep indexes warm (configure `MEILI_MAX_INDEXING_MEMORY`, `MEILI_MAX_INDEXING_THREADS`)
- **CDN cache** pro storefront search responses — TTL 60s with surrogate keys
- **Autocomplete cache:** Redis L4 cache pro top-1000 queries per tenant per locale (TTL 5 min), warm-up CRON-WARM-AUTOCOMPLETE-CACHE
- **Embedding cache:** Anthropic/OpenAI embedding API responses cached by content hash (immutable, 7-day Redis); rebuild idempotent
- **Index batching:** debounce 5s pro product upserts (batch 50 docs per Meilisearch call)
- **Stock/price patch lightweight:** when only stock_status or price_min changes, partial update v Meilisearch (1 KB payload), skip full document recompute
- **Per-locale separate indexes:** dedicated index per locale = no cross-language ranking interference
- **Cursor pagination only:** offset pagination zakázaná v search (RULE-SEARCH cf. `04 §9.2`)
- **maxTotalHits 10000:** limit pro Meilisearch — deeper pages vyžadují re-filter (use cases pro 10k+ jsou ALWAYS export/feed, ne user browse)

### 12.3 Scaling

| Catalog size | Approach |
|---|---|
| 0 – 100k products per tenant | Single Meilisearch instance shared all tenants |
| 100k – 1M | Tenant-dedicated Meilisearch indexes; shared instance |
| 1M – 10M | Per-tenant Meilisearch instance (Enterprise dedicated, DEC-ARCH-004) |
| 10M+ | OpenSearch upgrade per DEC-SEARCH-001 |

### 12.4 Capacity planning

- Meilisearch RAM per 1M docs ~ 800 MB
- pgvector embedding storage: 1536-dim × 4 bytes = ~6 KB per product → 6 GB per 1M products
- Search log volume: ~10 KB per query × 1M queries/month = ~10 GB/month per active tenant Pro+

---

## 13. Security

### 13.1 Permissions

```
PERM-SEARCH-CONFIG-VIEW
PERM-SEARCH-CONFIG-UPDATE
PERM-SEARCH-SYNONYM-MANAGE
PERM-SEARCH-REDIRECT-MANAGE
PERM-SEARCH-PINNED-MANAGE
PERM-SEARCH-REINDEX
PERM-SEARCH-ANALYTICS-VIEW
PERM-SEARCH-ANALYTICS-EXPORT
```

### 13.2 Storefront query injection

- Query parametr sanitized — žádný direct passthrough do Meilisearch (validate via Zod)
- Filter DSL: whitelist polí + values (no arbitrary SQL/operator)
- Rate limit per IP a per session (viz [04 §13](04-api-conventions.md#13-rate-limiting))

### 13.3 Cross-tenant isolation

- Meilisearch master key v Vault (DEC-SEC-002); per-tenant API key generated dynamically (tenant-scoped)
- Application layer: vždy enforce `tenant_id` filter v každém query (defense in depth)
- Cloud SaaS: separate Meilisearch instance per Enterprise tier optional

### 13.4 PII v logs

- Customer ID logujeme jen s consent (RULE-SEARCH-012)
- IP/UA anonymizováno (truncate IP to /24, UA reduced to browser family)
- Session hash rotuje denně
- Right-to-erasure: cascade delete logs s customer_id

### 13.5 Rate limits

| Endpoint | Anon | Auth Free | Auth Pro |
|---|---|---|---|
| `GET /storefront/search` | 60/min/IP | 300/min | 1500/min |
| `GET /storefront/autocomplete` | 300/min/IP | 1500/min | 6000/min |
| `POST /search/click` | 600/min/session | 600/min | 6000/min |
| `POST /search/reindex` | n/a | 1/hour | 12/hour |
| `GET /search/analytics/*` | n/a | 60/min | 600/min |
| MCP `catalog.search_products` | per agent token: 60/min | n/a | 1500/min |

### 13.6 Audit

- Synonym/redirect/pinned changes — 100% audit log
- Reindex operations — 100% audit log + operation record
- Storefront searches NOT in audit_log (volume too high) — separately v `search_queries_log`

---

## 14. Testing

### 14.1 Unit

```
TEST-UNIT-SEARCH-001  QueryNormalizer (diacritics, case, whitespace)
TEST-UNIT-SEARCH-002  FilterDslValidator (whitelist, type coerce)
TEST-UNIT-SEARCH-003  FacetMerger (Meilisearch facets + pinned post-process)
TEST-UNIT-SEARCH-004  EmbeddingInputBuilder (template, truncation)
TEST-UNIT-SEARCH-005  RankingTieBreaker (popularity_score sort stability)
TEST-UNIT-SEARCH-006  IndexDocumentBuilder (snapshot fields denormalized)
TEST-UNIT-SEARCH-007  SearchRedirectMatcher (exact, prefix, contains)
```

### 14.2 Integration (real Meilisearch + Postgres + Redis)

```
TEST-INT-SEARCH-001   Index a product → query → hit
TEST-INT-SEARCH-002   Update product → re-query (eventual consistency within 5s)
TEST-INT-SEARCH-003   Delete product → not in results
TEST-INT-SEARCH-004   Synonym applied (lampa ↔ svítidlo)
TEST-INT-SEARCH-005   Faceted search with multi-select and AND/OR semantics
TEST-INT-SEARCH-006   Zero-result recovery — semantic fallback returns suggestions
TEST-INT-SEARCH-007   Search redirect — exact match returns redirect
TEST-INT-SEARCH-008   Pinned result post-process — moves product to slot 1
TEST-INT-SEARCH-009   Per-customer-group pricing filter
TEST-INT-SEARCH-010   Index drift detection + auto-reindex trigger
TEST-INT-SEARCH-011   Meilisearch down → Postgres FTS fallback engages
TEST-INT-SEARCH-012   Embedding regen on title change
TEST-INT-SEARCH-013   Click logging → aggregate denormalizes daily
TEST-INT-SEARCH-014   Multi-locale: same product different language indexed correctly
TEST-INT-SEARCH-015   GDPR delete: customer_id removed from search_queries_log
```

### 14.3 E2E (Playwright)

```
TEST-E2E-SEARCH-001  Customer types in storefront → autocomplete appears
TEST-E2E-SEARCH-002  Customer filters by brand + price → updated results + correct facet counts
TEST-E2E-SEARCH-003  Customer searches "iphone" → redirects to category
TEST-E2E-SEARCH-004  Customer searches nonsense → zero-result recovery suggestions shown
TEST-E2E-SEARCH-005  Admin adds synonym → propagates within 30s → reflected in search
TEST-E2E-SEARCH-006  Admin pins product for "lampa" → product appears at position 1
TEST-E2E-MCP-SEARCH-001  External agent calls catalog.search_products with filters
```

### 14.4 Load (k6)

```
TEST-LOAD-SEARCH-001  1000 RPS autocomplete (10 chars query) → p95 < 30 ms
TEST-LOAD-SEARCH-002  500 RPS storefront search with facets → p95 < 100 ms
TEST-LOAD-SEARCH-003  Index 10k product updates in 60s → no queue backlog
TEST-LOAD-SEARCH-004  Reindex full 50k products → < 5 min
```

### 14.5 Relevance / quality

- **Golden query set** (per tenant): 50–100 representative queries with expected top-3 results, evaluated weekly via JOB-RELEVANCE-CHECK
- **A/B test framework** (Fáze 2): split traffic between ranking rules variants, measure CTR + conversion
- **Manual relevance review** dashboard pro merchant tým

---

## 15. Implementation checklist

### Backend
- [ ] **[S]** Postgres tables: `search_synonyms`, `search_redirects`, `search_pinned_results`, `search_queries_log` (partitioned), `search_query_aggregates`
- [ ] **[S]** Migrace `20260522_001_create_search_tables.sql` + indexy + partitions
- [ ] **[M]** Meilisearch client wrapper (`packages/core/src/search/meilisearch-client.ts`)
- [ ] **[L]** `SearchIndexerService` — document builder, batch upsert, debounce queue, drift checker
- [ ] **[M]** `SearchService` — query builder, facet builder, redirect lookup, pinned post-process, fallback chain
- [ ] **[M]** `EmbeddingService` — provider abstraction (OpenAI default, swappable)
- [ ] **[S]** `QueryNormalizer`
- [ ] **[S]** `FilterDslValidator` (Zod schema)
- [ ] **[S]** `SearchRedirectMatcher`
- [ ] **[M]** REST endpoints per §6
- [ ] **[M]** GraphQL types + resolvers + DataLoaders
- [ ] **[S]** tRPC router (admin config + analytics)
- [ ] **[M]** MCP tool `catalog.search_products` + `catalog.autocomplete`
- [ ] **[S]** Postgres FTS fallback service (`packages/core/src/search/pgsql-fts-fallback.ts`)
- [ ] **[S]** Health check endpoint `/api/{date}/search/index-status`

### Background jobs
- [ ] **[L]** JOB-INDEX-PRODUCT — full lifecycle
- [ ] **[M]** JOB-INDEX-CATEGORY, JOB-INDEX-COLLECTION
- [ ] **[L]** JOB-REINDEX-FULL — zero-downtime swap pattern
- [ ] **[S]** JOB-SYNC-MEILISEARCH-SETTINGS
- [ ] **[M]** JOB-PRODUCT-EMBED — provider call, retry, cost tracking
- [ ] **[M]** JOB-AGGREGATE-SEARCH-QUERIES — denní rollup
- [ ] **[S]** JOB-DETECT-ZERO-RESULT-SPIKE
- [ ] **[S]** JOB-RECOMPUTE-POPULARITY
- [ ] **[S]** JOB-INDEX-DRIFT-CHECK
- [ ] **[S]** JOB-PURGE-SEARCH-LOGS — per retention policy
- [ ] **[S]** JOB-CLEANUP-OLD-MEILI-INDEXES
- [ ] **[S]** CRON-WARM-AUTOCOMPLETE-CACHE

### Frontend — Admin
- [ ] **[M]** Search settings page (synonyms list/editor, redirects, stopwords)
- [ ] **[M]** Search merchandising UI (per-query pinned results, drag-drop)
- [ ] **[L]** Search analytics dashboard (top queries, zero-results, CTR by position)
- [ ] **[M]** Index health page (per-locale stats, drift indicator, reindex button)
- [ ] **[S]** Synonym CSV import wizard
- [ ] **[S]** Zero-result drill-down with "Add synonym/redirect" quick actions

### Frontend — Storefront (Next.js 16)
- [ ] **[M]** Search box header component s debounced autocomplete
- [ ] **[L]** Search results page `/search?q=...` (RSC + Client Components for filters)
- [ ] **[L]** Faceted filter sidebar (multi-select, price slider, rating)
- [ ] **[S]** Sort dropdown
- [ ] **[S]** No-results recovery component
- [ ] **[S]** Pagination/load-more (cursor-based)
- [ ] **[S]** Search analytics tracking (click logging on result click)

### Tests
- [ ] **[M]** Per §14 (unit + integration + E2E + load)
- [ ] **[S]** Golden query relevance set + JOB-RELEVANCE-CHECK

### Docs
- [ ] **[S]** "Optimizing your search" merchant guide
- [ ] **[S]** "Synonyms and redirects" admin guide
- [ ] **[S]** Developer: "Plugin filter providers" (custom facet types)
- [ ] **[S]** Developer: "Configuring embeddings provider"

---

## 16. Open questions

### Q-SEARCH-001: Embedding model standardization
**Otázka:** OpenAI `text-embedding-3-small` (1536) vs `-large` (3072) vs Cohere multilingual vs Voyage AI. Multilingual queries (CZ → EN product) lépe pokrývá multilingual embedding.

**Status:** MVP default `text-embedding-3-small`. Per-tenant override v `tenant.settings.embedding_provider`. Cross-language semantic je v1.0+ feature.

### Q-SEARCH-002: Hybrid search merging algorithm
**Otázka:** Když kombinujeme Meilisearch lexical + pgvector semantic, jak skóre normalize a merge? RRF (Reciprocal Rank Fusion) vs weighted sum?

**Status:** v1.0+ feature. MVP: lexical primary, semantic jen pro zero-result fallback.

### Q-SEARCH-003: Personalized search per customer
**Otázka:** Boostovat výsledky podle customer's purchase history, viewed products, wishlist?

**Status:** v2.0+ — vyžaduje session/customer feature store, GDPR consent flow. Detail v `33-ai-features.md`.

### Q-SEARCH-004: Visual search (image upload)
**Otázka:** "Hledat podobné produkty podle fotky"?

**Status:** v3.0+ — vyžaduje image embedding model (CLIP, ResNet). Out of scope MVP.

### Q-SEARCH-005: Voice / natural language search
**Otázka:** "Najdi mi modrou lampu pod 1500 Kč" — automatic intent extraction?

**Status:** v1.0+ pro MCP agent tokens (agents inherently NL). Storefront customers: v2.0+ feature s Claude tool calling.

### Q-SEARCH-006: Search log volume vs analytics quality
**Otázka:** 100% sampling může být drahé pro Pro+ tenanty s 100k+ queries/den. Adaptive sampling (100% for low-volume, 10% for high)?

**Status:** MVP: 100% pro Free+Starter, 10% pro Pro+ (configurable). Aggregates jsou primary analytics source, raw logs jen drill-down.

### Q-SEARCH-007: Meilisearch upgrade strategy
**Otázka:** Meilisearch má breaking changes mezi major versions (1.x → 2.x). Jak migrate s minimal downtime?

**Status:** Per-tenant rolling upgrade: build new index in new version → swap atomically. Detail v ops doc `31-operations.md`.

### Q-SEARCH-008: OpenSearch migration trigger
**Otázka:** Kdy concrete switch z Meilisearch na OpenSearch? Catalog size? Feature need (e.g., vector search at scale)?

**Status:** DEC-SEARCH-001 říká "Fáze 3+". Konkrétní trigger TBD; nejspíš 1M+ products per tenant nebo dedicated Enterprise customer s vector volumes.

### Q-SEARCH-009: Pinned results UX při filter conflict
**Otázka:** Pinned produkt je filtered out (např. customer filtruje brand=Adidas, pinned je Nike). Skrýt pin nebo zobrazit warning?

**Status:** MVP: silently skip pin. UI v1.0: show "X pinned products hidden by your filters" v meta panelu.

### Q-SEARCH-010: Multi-currency price filter
**Otázka:** Customer prohlíží v EUR, ale prices_by_list je v CZK. Convert on the fly přes exchange_rates? Pre-compute prices in multiple currencies?

**Status:** Pre-compute do `prices_by_list_currency` mapy v indexovaném dokumentu (e.g., `{ "retail.CZK": {...}, "retail.EUR": {...} }`) pro top 3-5 tenant currencies. Filter direct lookup. Detail v `10-pricing-promotions.md` + `15-i18n.md`.

---

## 📅 Změny

| Datum | Změna |
|---|---|
| 2026-05-19 | Initial — Meilisearch primary, pgvector companion, indexer pipeline, faceted filtering, autocomplete, zero-result recovery chain, analytics. |

---

**Konec Search & Filtering.**

➡️ Pokračovat na: [`09-inventory.md`](09-inventory.md)
