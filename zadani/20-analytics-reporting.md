# 20 – ANALYTICS & REPORTING

> **Doména:** Event collection (storefront + backend), pre-aggregated dashboards (revenue, conversion, AOV, LTV, churn), cohort/RFM/funnel analysis, custom report builder, scheduled email/PDF reports, ETL exports do BigQuery/Snowflake/CSV (Fáze 2+). GDPR-compliant: anonymized aggregates, opt-in raw event collection, retention windows.

**Datum:** 2026-05-20
**Verze:** 1.0
**Status:** 🟡 DESIGN
**Reference:** [16-order-management.md](16-order-management.md) · [18-customer-management.md](18-customer-management.md) · [11-cart.md](11-cart.md) · [19-marketing-seo.md](19-marketing-seo.md) · [DEC-DB-001](01-decisions-registry.md#dec-db-001-primary-database)

---

## 📑 Obsah

0. [Domain overview](#0-domain-overview)
1. [References](#1-references)
2. [Personas](#2-personas)
3. [Data models](#3-data-models)
4. [Event collection pipeline](#4-event-collection-pipeline)
5. [Aggregation model](#5-aggregation-model)
6. [Standard metrics & dashboards](#6-standard-metrics--dashboards)
7. [State machines](#7-state-machines)
8. [Business rules](#8-business-rules)
9. [REST API endpoints](#9-rest-api-endpoints)
10. [GraphQL schema](#10-graphql-schema)
11. [Events](#11-events)
12. [Background jobs](#12-background-jobs)
13. [UI/UX flows](#13-uiux-flows)
14. [Edge cases & error handling](#14-edge-cases--error-handling)
15. [Performance](#15-performance)
16. [Security & GDPR](#16-security--gdpr)
17. [Testing](#17-testing)
18. [Implementation checklist](#18-implementation-checklist)
19. [Open questions](#19-open-questions)

---

## 0. Domain overview

### 0.1 Co tato doména **je**

- **Event collection** — server-side + storefront client events (page_view, product_view, add_to_cart, checkout_step, order_placed, etc.)
- **Pre-aggregated rollups** — daily/weekly/monthly tables for dashboard query speed
- **Standard dashboards** — revenue, orders, conversion, AOV, top products, top customers, traffic sources, customer lifetime metrics
- **Cohort analysis** — retention, repeat purchase, LTV by acquisition cohort
- **RFM segmentation** — Recency / Frequency / Monetary scoring
- **Funnel analytics** — storefront browse → cart → checkout → order
- **Custom reports builder** — drag-drop fields + filters + group-by (Fáze 2)
- **Scheduled reports** — daily/weekly/monthly PDF or CSV emailed
- **Real-time stream** — recent activity feed (orders, abandoned carts) v admin (light push, not deep analytics)
- **ETL exports** — periodic dump to BigQuery, Snowflake, Postgres replica, CSV S3 (Fáze 2+)
- **Attribution** — multi-touch attribution UTM-based (last-click MVP, multi-touch Fáze 3+)
- **Performance metrics** — site speed, error rates (Core Web Vitals collected; deeper APM via OpenTelemetry per `31-operations.md`)
- **A/B test results** — campaign + product page A/B testing (Fáze 2+)
- **Goals & KPIs** — merchant-defined targets with progress tracking

### 0.2 Co tato doména **NENÍ**

- ❌ Operational monitoring (Grafana/Prometheus) → `31-operations.md`
- ❌ Marketing campaign metrics core → `19-marketing-seo.md` (we surface; they own send-side metrics)
- ❌ Order lifecycle → `16-order-management.md` (we read snapshots)
- ❌ Real-time admin order feed (websockets) → `27-admin-backoffice.md`
- ❌ AI insights generation → `33-ai-features.md` (uses our data)
- ❌ Customer-facing analytics (their own purchase history) → `18-customer-management.md`
- ❌ Plugin telemetry → `28-developer-platform.md`
- ❌ Tax reporting → `15-tax-compliance.md` (different goal — legal)
- ❌ Financial accounting → `15-tax-compliance.md` exports
- ❌ Fraud analytics → `30-security.md`

### 0.3 Diferenciátory

1. **Cohorted by default** — every report can pivot by acquisition cohort, channel, country, customer group
2. **Multi-currency native** — reports normalize to tenant base currency via daily exchange rate snapshot
3. **GDPR-safe by default** — raw events anonymized; aggregates contain no PII
4. **No external analytics required** — Google Analytics replacement built-in (privacy-friendly, EU-compliant)
5. **Open data export** — full BigQuery / Snowflake ETL pipeline (Fáze 2+); merchants own their data
6. **AI-augmented insights** — natural-language queries → SQL (Fáze 3+, per `33-ai-features.md`)
7. **EU compliance native** — cookie-less analytics via server-side events (no client cookies needed for core metrics)

---

## 1. References

- [16-order-management.md](16-order-management.md) — orders as source of truth
- [18-customer-management.md](18-customer-management.md) — customer aggregates
- [11-cart.md](11-cart.md) — cart events
- [19-marketing-seo.md](19-marketing-seo.md) — campaign metrics (we extend)
- [10-pricing-promotions.md](10-pricing-promotions.md) — discount analytics
- [09-inventory.md](09-inventory.md) — inventory metrics (sell-through rate)
- [22-multistore-channels.md](22-multistore-channels.md) — per-channel slicing
- [29-integrations.md](29-integrations.md) — BigQuery, Snowflake, GA4 integrations
- [30-security.md](30-security.md) — GDPR + retention policies
- [31-operations.md](31-operations.md) — OpenTelemetry, Grafana
- [33-ai-features.md](33-ai-features.md) — AI insights
- [DEC-DB-001](01-decisions-registry.md#dec-db-001-primary-database) — PostgreSQL primary
- [DEC-DB-004](01-decisions-registry.md#dec-db-004-cache-strategy) — caching
- [DEC-EVENTS-001](01-decisions-registry.md#dec-events-001-event-bus--background-jobs) — outbox + BullMQ
- EU GDPR (Regulation 2016/679) — anonymization, retention
- ePrivacy Directive (cookie consent)
- Plausible / Fathom / Matomo — privacy-friendly analytics inspiration

---

## 2. Personas

| Persona | Použití | Klíčové permissions |
|---|---|---|
| `PERSONA-MERCHANT-OWNER` | All dashboards, custom reports, exports | `PERM-ANALYTICS-*` |
| `PERSONA-FINANCE-MANAGER` | Revenue, profit, cohorts | `PERM-ANALYTICS-VIEW`, `PERM-ANALYTICS-EXPORT-FINANCIAL` |
| `PERSONA-MARKETING-MANAGER` | Campaign metrics, traffic sources, conversion | `PERM-ANALYTICS-VIEW-MARKETING` |
| `PERSONA-CATALOG-MANAGER` | Product performance, sell-through, search | `PERM-ANALYTICS-VIEW-CATALOG` |
| `PERSONA-MERCHANT-VIEWER` | Read-only dashboards | `PERM-ANALYTICS-VIEW` |
| `PERSONA-ACCOUNTANT` (external) | Limited financial export access | `PERM-ANALYTICS-EXPORT-FINANCIAL` |
| `PERSONA-DATA-ANALYST` | Custom report builder, raw export | `PERM-ANALYTICS-CUSTOM-REPORTS`, `PERM-ANALYTICS-RAW-EXPORT` |
| `PERSONA-CUSTOMER` | None (own purchase history is in `18`) | n/a |
| `PERSONA-AI-COPILOT` | Generate natural-language reports, anomaly alerts | `agent:analytics:read` |
| `PERSONA-COMPLIANCE-OFFICER` | Verify data minimization, retention compliance | `PERM-ANALYTICS-COMPLIANCE-VIEW` |

---

## 3. Data models

### 3.1 `analytics_events`

Raw event stream — append-only, partitioned by month, BRIN-indexed.

```sql
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  occurred_at TIMESTAMPTZ NOT NULL,
  -- identity (cookie-less first-party)
  visitor_hash TEXT NULL,                                                          -- daily-rotated anonymized hash
  session_hash TEXT NULL,                                                          -- 30-min sliding window hash
  customer_id UUID NULL REFERENCES customers(id),                                  -- logged-in only
  guest_email_hash TEXT NULL,                                                       -- hashed for guest checkout attribution
  -- event categorization
  event_kind TEXT NOT NULL CHECK (event_kind IN (
    -- pageview
    'page_view','page_leave',
    -- product
    'product_viewed','product_search','product_click',
    -- cart
    'cart_viewed','cart_item_added','cart_item_removed','cart_item_quantity_changed',
    'cart_coupon_applied','cart_currency_changed','cart_abandoned',
    -- checkout
    'checkout_started','checkout_step_completed','checkout_payment_method_selected',
    'checkout_completed','checkout_abandoned',
    -- order
    'order_placed','order_paid','order_fulfilled','order_cancelled','order_refunded',
    -- customer
    'customer_signup','customer_login','customer_logout','customer_email_verified',
    -- marketing
    'email_opened','email_clicked','newsletter_subscribed',
    -- review
    'review_submitted','review_voted_helpful',
    -- wishlist
    'wishlist_item_added',
    -- search
    'search_performed','search_zero_result','search_click',
    -- agent
    'agent_request','agent_order_placed',
    -- custom
    'custom'
  )),
  -- subject
  entity_type TEXT NULL,                                                            -- 'product','category','order','customer','cart','page'
  entity_id UUID NULL,
  -- channel + context
  channel_id UUID NULL REFERENCES channels(id),
  store_id UUID NULL REFERENCES stores(id),
  locale TEXT NULL,
  currency CHAR(3) NULL,
  -- attribution (UTM + referrer)
  utm_source TEXT NULL,
  utm_medium TEXT NULL,
  utm_campaign TEXT NULL,
  utm_content TEXT NULL,
  utm_term TEXT NULL,
  referrer_host TEXT NULL,                                                          -- domain only for privacy
  referrer_path TEXT NULL,
  landing_page_path TEXT NULL,                                                       -- first page of session
  -- device + geo (low-resolution for privacy)
  device_kind TEXT NULL CHECK (device_kind IN ('desktop','mobile','tablet','tv','watch','bot','pos','app') OR device_kind IS NULL),
  os_family TEXT NULL,                                                              -- 'macOS','Windows','iOS','Android'
  browser_family TEXT NULL,                                                          -- 'Chrome','Safari','Firefox'
  country_code CHAR(2) NULL,
  region TEXT NULL,                                                                  -- coarse; not city for privacy
  -- payload (event-specific)
  properties JSONB NULL,                                                             -- e.g., { "variant_id": "...", "quantity": 2, "price": 12990 }
  revenue_amount BIGINT NULL,                                                        -- denormalized for order events
  revenue_currency CHAR(3) NULL,
  -- de-dup / source
  ingest_source TEXT NOT NULL CHECK (ingest_source IN ('storefront_client','admin_client','backend_server','webhook','batch_import','mcp_agent')) DEFAULT 'backend_server',
  client_event_id TEXT NULL,                                                          -- client-generated for dedupe
  ip_hash TEXT NULL,                                                                  -- truncated /24 for IPv4, /48 for IPv6
  user_agent_family TEXT NULL,                                                        -- truncated (no full UA string)
  -- consent gating
  consent_marketing BOOLEAN NULL,                                                     -- snapshot at event time
  consent_analytics BOOLEAN NULL,
  consent_personalization BOOLEAN NULL,
  -- A/B
  experiment_ids TEXT[] NULL,                                                          -- list of active experiments
  variant_ids TEXT[] NULL,                                                              -- assignments
  -- ingestion meta
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now()
) PARTITION BY RANGE (occurred_at);

-- Monthly partitions
CREATE INDEX brin_analytics_events_occurred ON analytics_events USING BRIN (occurred_at);
CREATE INDEX idx_analytics_events_tenant_kind_at ON analytics_events (tenant_id, event_kind, occurred_at DESC);
CREATE INDEX idx_analytics_events_customer ON analytics_events (customer_id, occurred_at DESC) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_analytics_events_visitor ON analytics_events (visitor_hash, occurred_at DESC) WHERE visitor_hash IS NOT NULL;
CREATE INDEX idx_analytics_events_session ON analytics_events (session_hash, occurred_at DESC) WHERE session_hash IS NOT NULL;
CREATE INDEX idx_analytics_events_entity ON analytics_events (entity_type, entity_id, occurred_at DESC) WHERE entity_id IS NOT NULL;
CREATE INDEX idx_analytics_events_utm ON analytics_events (tenant_id, utm_campaign, occurred_at DESC) WHERE utm_campaign IS NOT NULL;
```

**Retention:**
- Free: 90 days raw events
- Starter: 365 days
- Pro: 2 years
- Enterprise: configurable up to 7 years

After retention: drop partitions. Aggregates retained indefinitely.

### 3.2 `analytics_daily_rollups`

Pre-aggregated daily metrics per (tenant, date, channel, currency).

```sql
CREATE TABLE analytics_daily_rollups (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  date DATE NOT NULL,
  channel_id UUID NULL REFERENCES channels(id),
  store_id UUID NULL REFERENCES stores(id),
  currency CHAR(3) NOT NULL,                                                          -- amounts in this currency
  -- traffic
  unique_visitors INTEGER NOT NULL DEFAULT 0,
  total_sessions INTEGER NOT NULL DEFAULT 0,
  page_views INTEGER NOT NULL DEFAULT 0,
  product_views INTEGER NOT NULL DEFAULT 0,
  bounce_sessions INTEGER NOT NULL DEFAULT 0,                                          -- 1-page sessions
  avg_session_duration_seconds INTEGER NULL,
  -- conversion funnel
  carts_created INTEGER NOT NULL DEFAULT 0,
  cart_items_added INTEGER NOT NULL DEFAULT 0,
  checkouts_started INTEGER NOT NULL DEFAULT 0,
  checkouts_completed INTEGER NOT NULL DEFAULT 0,
  carts_abandoned INTEGER NOT NULL DEFAULT 0,
  -- orders
  orders_placed INTEGER NOT NULL DEFAULT 0,
  orders_paid INTEGER NOT NULL DEFAULT 0,
  orders_cancelled INTEGER NOT NULL DEFAULT 0,
  orders_refunded INTEGER NOT NULL DEFAULT 0,
  -- revenue (gross)
  gross_sales_amount BIGINT NOT NULL DEFAULT 0,                                        -- sum of order subtotals (pre-discount, pre-tax)
  discounts_amount BIGINT NOT NULL DEFAULT 0,
  net_sales_amount BIGINT NOT NULL DEFAULT 0,                                          -- gross - discounts
  shipping_amount BIGINT NOT NULL DEFAULT 0,
  tax_amount BIGINT NOT NULL DEFAULT 0,
  total_revenue_amount BIGINT NOT NULL DEFAULT 0,                                       -- net + shipping + tax
  refunded_amount BIGINT NOT NULL DEFAULT 0,
  net_revenue_amount BIGINT NOT NULL DEFAULT 0,                                          -- total - refunds
  -- product metrics
  units_sold INTEGER NOT NULL DEFAULT 0,
  unique_products_sold INTEGER NOT NULL DEFAULT 0,
  -- customer
  new_customers INTEGER NOT NULL DEFAULT 0,
  returning_customers INTEGER NOT NULL DEFAULT 0,
  customer_signups INTEGER NOT NULL DEFAULT 0,
  -- AOV
  avg_order_value_amount BIGINT NULL,
  -- conversion rate (orders / sessions × 10000 = basis points)
  conversion_rate_basis_points INTEGER NULL,
  -- cart abandonment rate
  cart_abandonment_rate_basis_points INTEGER NULL,
  -- top product (denormalized for fast dashboards)
  top_product_id UUID NULL,
  top_product_revenue_amount BIGINT NULL,
  top_category_id UUID NULL,
  -- meta
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_finalized BOOLEAN NOT NULL DEFAULT false,                                          -- true after day completely closed + 24h buffer
  CONSTRAINT uq_analytics_daily_rollups UNIQUE (tenant_id, date, COALESCE(channel_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(store_id, '00000000-0000-0000-0000-000000000000'::uuid), currency)
);

CREATE INDEX idx_analytics_daily_tenant_date ON analytics_daily_rollups (tenant_id, date DESC);
CREATE INDEX idx_analytics_daily_finalized ON analytics_daily_rollups (tenant_id, is_finalized, date);
```

### 3.3 `analytics_product_daily_rollups`

Per-product per-day metrics.

```sql
CREATE TABLE analytics_product_daily_rollups (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  date DATE NOT NULL,
  product_id UUID NOT NULL REFERENCES products(id),
  variant_id UUID NULL REFERENCES product_variants(id),                                 -- nullable for product-level rollup
  channel_id UUID NULL,
  currency CHAR(3) NOT NULL,
  -- views
  views INTEGER NOT NULL DEFAULT 0,
  unique_viewers INTEGER NOT NULL DEFAULT 0,
  -- engagement
  cart_adds INTEGER NOT NULL DEFAULT 0,
  wishlist_adds INTEGER NOT NULL DEFAULT 0,
  -- conversion
  orders_with_product INTEGER NOT NULL DEFAULT 0,
  units_sold INTEGER NOT NULL DEFAULT 0,
  revenue_amount BIGINT NOT NULL DEFAULT 0,
  refunded_amount BIGINT NOT NULL DEFAULT 0,
  -- rates (basis points)
  view_to_cart_rate_basis_points INTEGER NULL,
  cart_to_order_rate_basis_points INTEGER NULL,
  -- returns
  return_rate_basis_points INTEGER NULL,                                                  -- units returned / units sold
  -- search
  search_impressions INTEGER NOT NULL DEFAULT 0,                                          -- appeared in search results
  search_clicks INTEGER NOT NULL DEFAULT 0,
  search_zero_result_queries TEXT[] NULL,                                                  -- top queries that didn't return this product (Fáze 2)
  -- meta
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_finalized BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT uq_analytics_product_daily UNIQUE (tenant_id, date, product_id, COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(channel_id, '00000000-0000-0000-0000-000000000000'::uuid), currency)
);

CREATE INDEX idx_analytics_product_daily_tenant_product ON analytics_product_daily_rollups (tenant_id, product_id, date DESC);
CREATE INDEX idx_analytics_product_daily_revenue ON analytics_product_daily_rollups (tenant_id, date, revenue_amount DESC);
```

### 3.4 `analytics_customer_daily_rollups`

Per-customer-cohort daily aggregates.

```sql
CREATE TABLE analytics_customer_daily_rollups (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  date DATE NOT NULL,
  acquisition_cohort_month DATE NOT NULL,                                                 -- truncated to first-of-month
  customer_group_id UUID NULL REFERENCES customer_groups(id),
  signup_channel_id UUID NULL,
  signup_country_code CHAR(2) NULL,
  currency CHAR(3) NOT NULL,
  -- counts
  cohort_size INTEGER NOT NULL,                                                            -- active customers in cohort on this date
  active_customers INTEGER NOT NULL,                                                       -- customers with order in last 30d
  new_customers INTEGER NOT NULL DEFAULT 0,                                                -- first order on this date
  -- revenue
  cohort_revenue_amount BIGINT NOT NULL DEFAULT 0,                                          -- from this cohort on this date
  cohort_orders INTEGER NOT NULL DEFAULT 0,
  -- LTV
  avg_ltv_amount BIGINT NULL,                                                              -- avg cumulative spent per cohort customer
  -- retention
  retention_d1_pct INTEGER NULL,                                                            -- % of cohort still active 1 day later (basis points)
  retention_d7_pct INTEGER NULL,
  retention_d30_pct INTEGER NULL,
  retention_d90_pct INTEGER NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_analytics_customer_daily UNIQUE (tenant_id, date, acquisition_cohort_month, COALESCE(customer_group_id, '00000000-0000-0000-0000-000000000000'::uuid), currency)
);

CREATE INDEX idx_analytics_customer_daily_cohort ON analytics_customer_daily_rollups (tenant_id, acquisition_cohort_month, date);
```

### 3.5 `analytics_rfm_scores`

RFM segmentation per customer, recomputed weekly.

```sql
CREATE TABLE analytics_rfm_scores (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- raw values
  recency_days INTEGER NOT NULL,                                                            -- days since last order
  frequency_count INTEGER NOT NULL,                                                          -- total orders
  monetary_amount BIGINT NOT NULL,                                                            -- total spent
  -- normalized 1-5 scores (quintiles per tenant)
  recency_score INTEGER NOT NULL CHECK (recency_score BETWEEN 1 AND 5),
  frequency_score INTEGER NOT NULL CHECK (frequency_score BETWEEN 1 AND 5),
  monetary_score INTEGER NOT NULL CHECK (monetary_score BETWEEN 1 AND 5),
  combined_rfm TEXT NOT NULL,                                                                -- "555" = top, "111" = worst
  -- derived segment label
  segment_label TEXT NOT NULL CHECK (segment_label IN (
    'champions','loyal','potential_loyalist','new_customers','promising',
    'need_attention','about_to_sleep','cant_lose','at_risk','hibernating','lost'
  )),

  CONSTRAINT uq_analytics_rfm UNIQUE (tenant_id, customer_id, computed_at::date)
);

CREATE INDEX idx_analytics_rfm_customer ON analytics_rfm_scores (customer_id, computed_at DESC);
CREATE INDEX idx_analytics_rfm_segment ON analytics_rfm_scores (tenant_id, segment_label, computed_at);
```

### 3.6 `analytics_funnel_definitions`

Configurable funnels (default + custom).

```sql
CREATE TABLE analytics_funnel_definitions (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  pub_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  steps JSONB NOT NULL,                                                                      -- ordered array of step definitions
  window_seconds INTEGER NOT NULL DEFAULT 86400,                                              -- max time between steps (1 day default)
  channel_id UUID NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user_id UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_analytics_funnel_definitions_pub_id UNIQUE (tenant_id, pub_id)
);
```

Funnel step example:
```jsonc
{
  "steps": [
    { "id": "view", "name": "Product view", "event_kind": "product_viewed", "filter": null },
    { "id": "cart", "name": "Add to cart", "event_kind": "cart_item_added", "filter": null },
    { "id": "checkout", "name": "Checkout started", "event_kind": "checkout_started" },
    { "id": "order", "name": "Order placed", "event_kind": "order_placed" }
  ]
}
```

### 3.7 `analytics_funnel_daily_rollups`

Pre-computed funnel conversion per day.

```sql
CREATE TABLE analytics_funnel_daily_rollups (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  funnel_id UUID NOT NULL REFERENCES analytics_funnel_definitions(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  channel_id UUID NULL,
  step_counts JSONB NOT NULL,                                                                -- [{ step_id, unique_visitors, conversions }]
  drop_off JSONB NOT NULL,                                                                   -- per-step drop-off rates basis points
  total_conversions INTEGER NOT NULL DEFAULT 0,
  overall_conversion_rate_basis_points INTEGER NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_analytics_funnel_daily UNIQUE (tenant_id, funnel_id, date, COALESCE(channel_id, '00000000-0000-0000-0000-000000000000'::uuid))
);

CREATE INDEX idx_analytics_funnel_daily ON analytics_funnel_daily_rollups (funnel_id, date DESC);
```

### 3.8 `analytics_reports`

Saved custom reports + scheduled deliveries.

```sql
CREATE TABLE analytics_reports (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  pub_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NULL,
  report_kind TEXT NOT NULL CHECK (report_kind IN (
    'revenue_summary','top_products','customer_cohorts','rfm_segments',
    'funnel','traffic_sources','conversion_breakdown',
    'inventory_turnover','discount_usage','refund_analysis',
    'custom_query'
  )),
  filter JSONB NULL,                                                                          -- date range, channel, customer_group, ...
  group_by TEXT[] NULL,                                                                        -- ['date','channel','country']
  metrics TEXT[] NULL,                                                                          -- ['orders','revenue','units_sold']
  custom_sql TEXT NULL,                                                                          -- pro report_kind='custom_query' (Fáze 2; sandboxed)
  visualization TEXT NOT NULL CHECK (visualization IN ('table','line_chart','bar_chart','pie_chart','heatmap','funnel','cohort_matrix')) DEFAULT 'table',
  -- scheduling
  schedule_cron TEXT NULL,                                                                       -- '0 9 * * 1' = Monday 9am
  schedule_timezone TEXT NULL,
  schedule_recipients CITEXT[] NULL,
  schedule_format TEXT NULL CHECK (schedule_format IN ('pdf','csv','xlsx','json') OR schedule_format IS NULL),
  last_delivered_at TIMESTAMPTZ NULL,
  next_delivery_at TIMESTAMPTZ NULL,
  -- access
  is_shared BOOLEAN NOT NULL DEFAULT false,                                                       -- visible to other admin users
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user_id UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_analytics_reports_pub_id UNIQUE (tenant_id, pub_id)
);

CREATE INDEX idx_analytics_reports_owner ON analytics_reports (tenant_id, created_by_user_id);
CREATE INDEX idx_analytics_reports_scheduled ON analytics_reports (next_delivery_at) WHERE schedule_cron IS NOT NULL;
```

### 3.9 `analytics_report_executions`

Audit + result cache of executed reports.

```sql
CREATE TABLE analytics_report_executions (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  report_id UUID NULL REFERENCES analytics_reports(id) ON DELETE CASCADE,
  execution_kind TEXT NOT NULL CHECK (execution_kind IN ('ad_hoc','scheduled','api')),
  filter_snapshot JSONB NULL,
  result_storage_key TEXT NULL,                                                                  -- S3 path
  result_row_count INTEGER NULL,
  result_format TEXT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued','running','completed','failed','timed_out')) DEFAULT 'queued',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ NULL,
  duration_ms INTEGER NULL,
  delivered_recipients CITEXT[] NULL,
  failure_reason TEXT NULL,
  executed_by_user_id UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
) PARTITION BY RANGE (started_at);

CREATE INDEX idx_analytics_report_executions_report ON analytics_report_executions (report_id, started_at DESC);
CREATE INDEX brin_analytics_report_executions_started ON analytics_report_executions USING BRIN (started_at);
```

### 3.10 `analytics_exchange_rate_snapshots`

Daily exchange rates snapshot for multi-currency normalization.

```sql
CREATE TABLE analytics_exchange_rate_snapshots (
  date DATE NOT NULL,
  base_currency CHAR(3) NOT NULL,
  quote_currency CHAR(3) NOT NULL,
  rate NUMERIC(20,10) NOT NULL,
  source TEXT NOT NULL,                                                                          -- 'ecb','cnb','manual'
  PRIMARY KEY (date, base_currency, quote_currency)
);

CREATE INDEX idx_analytics_exchange_rate_recent ON analytics_exchange_rate_snapshots (base_currency, quote_currency, date DESC);
```

Reuse from `15-tax-compliance.md` if convenient; this is read-only snapshot for analytics queries.

### 3.11 `analytics_export_jobs`

ETL exports to external warehouses.

```sql
CREATE TABLE analytics_export_jobs (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  pub_id TEXT NOT NULL,
  destination TEXT NOT NULL CHECK (destination IN ('bigquery','snowflake','redshift','postgres_replica','s3_csv','s3_parquet','ga4','plausible','custom_webhook')),
  destination_config JSONB NOT NULL,                                                              -- credentials reference + table mappings
  data_scope TEXT NOT NULL CHECK (data_scope IN ('events','rollups','orders','customers','everything')),
  filter JSONB NULL,
  schedule_cron TEXT NULL,
  last_export_at TIMESTAMPTZ NULL,
  next_export_at TIMESTAMPTZ NULL,
  total_rows_exported BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('active','paused','failed','archived')) DEFAULT 'active',
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user_id UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_analytics_export_jobs_pub_id UNIQUE (tenant_id, pub_id)
);
```

### 3.12 `analytics_kpi_goals`

Merchant-defined KPI targets.

```sql
CREATE TABLE analytics_kpi_goals (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  metric TEXT NOT NULL CHECK (metric IN (
    'monthly_revenue','monthly_orders','conversion_rate','avg_order_value',
    'new_customers','repeat_purchase_rate','cart_abandonment_rate','review_count','ltv'
  )),
  target_value BIGINT NOT NULL,                                                                  -- amount in minor unit OR count OR basis points
  target_currency CHAR(3) NULL,
  period TEXT NOT NULL CHECK (period IN ('daily','weekly','monthly','quarterly','yearly')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  alert_when_off_track BOOLEAN NOT NULL DEFAULT true,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user_id UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_analytics_kpi_active ON analytics_kpi_goals (tenant_id, metric, period) WHERE is_active = true;
```

### 3.13 `analytics_experiments` *(A/B testing — Fáze 2+)*

```sql
CREATE TABLE analytics_experiments (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  pub_id TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('storefront_page','email_subject','product_recommendation','search_ranking','checkout_layout','price_test')),
  hypothesis TEXT NULL,
  variants JSONB NOT NULL,                                                                        -- [{ id, name, split_percent, config }]
  traffic_allocation_percent INTEGER NOT NULL DEFAULT 100,
  status TEXT NOT NULL CHECK (status IN ('draft','running','paused','completed','archived')) DEFAULT 'draft',
  started_at TIMESTAMPTZ NULL,
  ended_at TIMESTAMPTZ NULL,
  winner_variant_id TEXT NULL,
  statistical_significance NUMERIC(5,4) NULL,
  primary_metric TEXT NULL,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user_id UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_analytics_experiments_pub_id UNIQUE (tenant_id, pub_id)
);
```

### 3.14 Vztahy

```
tenants (1)──(N) analytics_events                  [partitioned, raw stream]
tenants (1)──(N) analytics_daily_rollups            [aggregate]
tenants (1)──(N) analytics_product_daily_rollups
tenants (1)──(N) analytics_customer_daily_rollups
tenants (1)──(N) analytics_rfm_scores
tenants (1)──(N) analytics_funnel_definitions ──(N) analytics_funnel_daily_rollups
tenants (1)──(N) analytics_reports                   [user-created]
analytics_reports (1)──(N) analytics_report_executions  [history]
tenants (1)──(N) analytics_export_jobs
tenants (1)──(N) analytics_kpi_goals
tenants (1)──(N) analytics_experiments
customers (1)──(N) analytics_events                 [denormalized customer_id]
products (1)──(N) analytics_events                  [entity_type='product']
```

---

## 4. Event collection pipeline

### 4.1 Ingestion sources

```
┌──────────────────────────┐
│ Storefront client (JS)   │ ──POST /api/{date}/analytics/events──┐
└──────────────────────────┘                                       │
┌──────────────────────────┐                                       │
│ Admin client (admin UI)  │ ──POST /api/{date}/analytics/events──┤
└──────────────────────────┘                                       │
┌──────────────────────────┐                                       │
│ Backend (event emitters) │ ──direct DB insert via service───────┤
└──────────────────────────┘                                       │
                                                                   ▼
                                                  Server-side validation + enrichment
                                                                   │
                                                                   ▼
                                                         analytics_events (raw)
                                                                   │
                                                                   ▼
                                                  outbox → BullMQ → aggregator
                                                                   │
                                                                   ▼
                                                  analytics_*_daily_rollups
```

### 4.2 Server-side first collection

**Storefront events**:
- `page_view`, `product_view`, `search_performed`, `add_to_cart`, `checkout_step`, ...
- Client posts to `/api/{date}/analytics/events` with batch (up to 50 events per request, debounced)
- Server validates + enriches: IP → country, UA → device, current consent state, session/visitor hash
- Server-side rate limit per IP (anti-abuse)
- Bot detection: `device_kind='bot'` flag — excluded from default reports

**Backend events**:
- Order placement, customer signup, payment captured → emitted directly via internal service
- Most accurate (no client tampering)
- Always logged regardless of consent (legitimate interest — service operation, anonymized for analytics)

### 4.3 Cookie-less identity

**Visitor hash** (daily-rotated):
```
visitor_hash = SHA-256(ip_truncated + user_agent_family + daily_salt)
```
Same IP/UA on same day → same hash. Different day → different hash (cannot link across days without consent).

**Session hash** (30-min sliding):
```
session_hash = SHA-256(ip_truncated + user_agent_family + session_window_start)
```
Reset on 30-min inactivity.

This provides cookie-less analytics (compliant with EU ePrivacy without consent banner for these basic metrics).

**Logged-in customer:** `customer_id` directly linked. No need for hash.

**Consent-required tracking** (e.g., precise device fingerprint, multi-day visitor tracking via cookie): only with explicit opt-in (`consent_analytics=true` from `18`).

### 4.4 Event validation

```typescript
const eventSchema = z.object({
  event_kind: z.enum([...]),
  occurred_at: z.string().datetime(),                                                              // client clock; server may override if drift > 1 min
  entity_type: z.string().optional(),
  entity_id: z.string().uuid().optional(),
  properties: z.record(z.unknown()).optional(),
  client_event_id: z.string().optional(),                                                          // for dedup
  utm: z.object({ ... }).optional(),
});
```

Reject:
- Invalid event_kind
- Future timestamp > 1 hour
- Past timestamp > 7 days (likely replay)
- Properties payload > 10 KB

### 4.5 Deduplication

`client_event_id` checked against last 24h:
```sql
INSERT INTO analytics_events (...)
VALUES (...)
ON CONFLICT (tenant_id, client_event_id) WHERE client_event_id IS NOT NULL DO NOTHING
RETURNING id;
```

Returns null = dedup hit; client retries handled.

### 4.6 Enrichment

Server adds:
- `country_code`: via MaxMind GeoIP2 (free version) or Cloudflare CF-IPCountry header
- `device_kind`, `os_family`, `browser_family`: parse UA via ua-parser
- `ip_hash`: truncated + salted
- `consent_*`: from cookie session OR customer_consents
- `experiment_ids`, `variant_ids`: from cookie / customer assignment (Fáze 2+)

### 4.7 Bot exclusion

Heuristics:
- User-Agent contains known bot patterns (Googlebot, GPTBot, etc.) → mark `device_kind='bot'`
- Missing or generic UA → flag
- High request rate from single IP → flag

Bots tracked but excluded from default conversion/revenue dashboards (filter `device_kind != 'bot'`). Visible separately in "Crawler traffic" view.

---

## 5. Aggregation model

### 5.1 Rollup strategy

```
raw events → hourly buffer → daily rollup → monthly rollup
                                  │
                                  ├─ analytics_daily_rollups (per channel)
                                  ├─ analytics_product_daily_rollups
                                  ├─ analytics_customer_daily_rollups
                                  └─ analytics_funnel_daily_rollups
```

Jobs:
- **`JOB-COMPUTE-ANALYTICS-HOURLY-PROVISIONAL`** (every hour): compute partial daily rollup based on events so far (provisional, `is_finalized=false`)
- **`JOB-COMPUTE-ANALYTICS-DAILY-FINAL`** (daily at 03:00): finalize previous day's rollup; locks `is_finalized=true`
- **`JOB-COMPUTE-ANALYTICS-WEEKLY`** (weekly): cohort retention update
- **`JOB-COMPUTE-RFM`** (weekly): RFM score per customer
- **`JOB-COMPUTE-FUNNEL-DAILY`** (daily): per-funnel conversion rollup

### 5.2 Provisional vs finalized

Current day data labeled "provisional" — may change as more events arrive. Yesterday data finalized after 24h buffer (allows late events ingestion).

UI shows badge "Including last hour" for provisional data.

### 5.3 Multi-currency normalization

Revenue stored in **order's currency** in rollups. For dashboards in tenant base currency:
- Query joins `analytics_exchange_rate_snapshots` (date = rollup date)
- Convert: `revenue × rate(currency → tenant_base, date)`
- Stale exchange rate (> 7 days old) → warning in UI

### 5.4 Pre-aggregated convenience views

Materialized views (refreshed daily):
- `mv_last_30d_revenue` — quick dashboard
- `mv_top_products_30d` — top sellers
- `mv_customer_ltv_segments` — CLV distribution
- `mv_funnel_conversion_30d`

Postgres `REFRESH MATERIALIZED VIEW CONCURRENTLY` to avoid downtime.

### 5.5 Pre-computed dimensions

For dashboards: dimension tables for fast group-by:
- `dim_dates` (date, day_of_week, week_of_year, month, quarter, year)
- `dim_channels` (channel_id → name, kind)
- `dim_countries` (code → name, continent)

Maintained automatically; small + read-heavy.

---

## 6. Standard metrics & dashboards

### 6.1 Revenue dashboard

| Metric | Definition |
|---|---|
| **Gross sales** | sum(`orders.subtotal_amount`) |
| **Discounts** | sum(`orders.discount_amount`) |
| **Net sales** | gross_sales - discounts |
| **Shipping revenue** | sum(`orders.shipping_amount`) |
| **Tax collected** | sum(`orders.tax_amount`) |
| **Total revenue (gross)** | net_sales + shipping + tax |
| **Refunds** | sum(`refunds.amount`) |
| **Net revenue** | total_revenue - refunds |
| **Total orders** | count(orders WHERE status NOT IN ('cancelled','failed')) |
| **Average order value (AOV)** | total_revenue / total_orders |

Filters: date range, channel, store, country, customer_group, currency

Visualizations: line chart (over time), bar (by period), drill-down by channel/country

### 6.2 Conversion funnel

Default funnel:
```
Visitors → Product viewers → Cart adds → Checkout starts → Orders placed
```

Per-step:
- Unique visitors at step
- Conversion rate to next step
- Drop-off %
- Average time at step

### 6.3 Customer analytics

| Metric | Definition |
|---|---|
| **New customers** | first_order_at in period |
| **Returning customers** | order in period AND first_order_at < period_start |
| **Repeat purchase rate** | returning / total active customers (basis points) |
| **Average customer lifespan** | avg(last_order_at - first_order_at) for non-active |
| **Customer Lifetime Value (CLV)** | avg(total_spent) per cohort |
| **Churn rate** | customers without order in last 90d / total previously active |
| **Customer Acquisition Cost (CAC)** | (Fáze 2+) marketing spend / new customers — requires ad spend integration |
| **LTV:CAC ratio** | LTV / CAC |

### 6.4 Product analytics

| Metric | Definition |
|---|---|
| **Top products** | by revenue, units sold, view-to-cart rate, cart-to-order rate |
| **Slow movers** | products with low view-to-cart in period |
| **Out-of-stock impact** | revenue lost to OOS (estimated from search/view miss) |
| **Cross-sell affinity** | products often bought together (Fáze 2 with recommendation engine) |
| **Return rate by product** | units_returned / units_sold |
| **Inventory turnover** | units_sold / avg_on_hand |

### 6.5 Marketing analytics

| Metric | Definition |
|---|---|
| **Traffic sources** | sessions by utm_source, utm_medium, referrer_host |
| **Campaign ROI** | revenue attributed / campaign spend (if known) |
| **Email performance** | open rate, click rate, conversion rate per campaign (per `19`) |
| **Top landing pages** | first session page → conversion |
| **Bounce rate** | 1-page sessions / total sessions |
| **Top exit pages** | last page in session |

### 6.6 RFM segments

11 standard segments (Champions, Loyal, Potential Loyalist, New, Promising, Need Attention, About to Sleep, Can't Lose, At Risk, Hibernating, Lost) per quintile combinations.

Segment definitions (configurable, defaults):
- **Champions** R5 F4-5 M4-5 — best customers; reward, ask for reviews
- **Loyal** R3-5 F3-5 M3-5 — frequent, profitable
- **At Risk** R2-3 F3-5 M3-5 — were good, slowing down → win-back
- **Lost** R1 F1-2 M1-2 — gone; minimal touch

UI: segment list with counts + per-segment actions ("Email Champions with thank-you", "Win-back At Risk with 15% coupon").

### 6.7 Real-time activity feed

Live (lightweight, not full event stream):
- New orders (last hour)
- Active visitors (sessions in last 5 min)
- Cart adds (last hour)
- Top viewed products (last hour)

Server-Sent Events (SSE) to admin dashboard. Pushed from outbox of EVENT-ORDER-PLACED etc.

---

## 7. State machines

### 7.1 Report execution

```
[queued] → [running] → [completed]
              │
              ├─→ [failed]
              └─→ [timed_out]
```

Timeout: 30 seconds for ad-hoc, 5 minutes for scheduled.

### 7.2 Experiment lifecycle

```
[draft] → [running] (started_at set)
              │
              ├─→ [paused] → [running]
              ├─→ [completed] (ended_at set, winner picked)
              └─→ [archived]
```

Statistical significance auto-computed; admin alerted when significance reached (default p < 0.05).

### 7.3 Daily rollup lifecycle

```
[not yet computed] → [provisional] (during day + 24h buffer) → [finalized]
```

After finalization: read-only. Late events that would change finalized day stored in `analytics_events_late_arrivals` log (audit).

---

## 8. Business rules

### RULE-ANL-001: Event-driven aggregation

All aggregations computed from raw events. Single source of truth.

Backend events (order_placed, etc.) emitted via outbox; aggregator job consumes.

### RULE-ANL-002: GDPR — consent gating

For storefront events with consent-required fields:
- `consent_analytics=false`: event recorded with anonymized `visitor_hash` only (no `customer_id`, no `ip_hash`)
- `consent_analytics=true`: full event recorded
- Transactional events (order_placed) always recorded (legitimate interest); customer_id linked when known

### RULE-ANL-003: Cookie-less by default

Visitor + session hash derived without cookies (per §4.3). Cookies optional for cross-device tracking (opt-in).

Some metrics (multi-day visitor counts, return rate by individual) impossible without consent — UI clearly indicates.

### RULE-ANL-004: Retention windows

Per plan:
- Free: 90 days raw events
- Starter: 365 days
- Pro: 2 years
- Enterprise: 7 years configurable

After retention: drop partitions. Rollups retained indefinitely (aggregate stats, no PII).

### RULE-ANL-005: Multi-tenancy isolation

All queries explicit `WHERE tenant_id = $1`. RLS reinforced. Cross-tenant queries impossible.

### RULE-ANL-006: Multi-currency consistency

Revenue stored in order currency. Dashboards display in tenant base currency via exchange rate.

Reports option: "show in original currencies" vs "normalize to base currency".

### RULE-ANL-007: Bot exclusion default

All default dashboards filter `device_kind != 'bot'`. Bot traffic visible in separate "Crawler" view.

### RULE-ANL-008: Provisional vs finalized

UI clearly distinguishes (yellow badge "Provisional"). API includes `is_finalized` flag per rollup row.

### RULE-ANL-009: Custom SQL sandboxing

If `analytics_reports.custom_sql` allowed (Fáze 2 power user feature):
- Query runs in read-only Postgres role
- Tenant_id parameter forced
- Read replicas only (no impact on writes)
- 30-second timeout
- Result row limit 100,000
- No `pg_*` system tables access
- No file functions, no extensions

Default: custom SQL **disabled**. Enterprise opt-in.

### RULE-ANL-010: Report sharing

`analytics_reports.is_shared=true` visible to all admin users with `PERM-ANALYTICS-VIEW`. Else only `created_by_user_id`.

Recipient list for scheduled reports: emails verified per `18-customer-management.md` consent.

### RULE-ANL-011: Report execution audit

Every execution logged in `analytics_report_executions`. 100% audit log entry for Enterprise tier (compliance).

### RULE-ANL-012: Late event handling

Event arriving for finalized day:
- Inserted into `analytics_events` (raw)
- NOT applied to finalized rollups
- Logged in `metadata.late_arrivals_log` of next rollup
- Daily reconciliation job detects + alerts if cumulative late arrivals > 1% of day's events

### RULE-ANL-013: Rollup reconciliation

`JOB-RECONCILE-ANALYTICS-ROLLUPS` weekly:
- For finalized days: recompute from raw events, compare to stored rollup
- Drift > 0.5%: alert admin; document discrepancy

### RULE-ANL-014: Export job security

`analytics_export_jobs.destination_config` may contain credentials (BigQuery service account JSON, Snowflake password). Stored in Vault (per DEC-SEC-002).

ETL runs in worker process; no direct customer-facing exposure.

### RULE-ANL-015: Real-time activity feed

Lightweight (no deep events, only summaries). Pushed via SSE to admin UI. Default 60-second polling fallback if SSE not supported.

Sensitive data filtered (customer name shown only to `PERM-CUSTOMER-VIEW`-permitted users).

### RULE-ANL-016: Funnel attribution window

Default 24h max between funnel steps. Configurable per funnel.

If `customer_id` known across sessions: cross-session funnel tracked. Else: per-session only.

### RULE-ANL-017: KPI alerting

`analytics_kpi_goals.alert_when_off_track=true`:
- Daily job evaluates period-to-date vs prorated target
- If behind by > 20% with > half period remaining: alert admin
- If period ended without hitting target: post-mortem note

### RULE-ANL-018: Experiment statistical significance

For A/B tests:
- Compute p-value via chi-squared (categorical, e.g., conversion) or t-test (continuous, e.g., revenue)
- Multiple-testing correction (Bonferroni) for >2 variants
- Alert when significance reached (configurable threshold, default p<0.05)
- Require minimum sample size (default 1000 visitors per variant) to avoid early-call

### RULE-ANL-019: Data export rate limits

ETL job execution per tenant: max 1 per hour per destination (configurable). Prevent runaway exports.

### RULE-ANL-020: Raw event export consent

Export of raw events (PII potentially in customer_id, ip_hash) to external warehouse:
- Requires merchant attestation of compliance with destination jurisdiction
- Audit log per export job
- Anonymization option: strip customer_id, ip_hash before export

### RULE-ANL-021: Time zone in reports

All rollups in UTC. Dashboards display in admin user's timezone (or tenant's `default_timezone`). "Daily" rollup = midnight-to-midnight in tenant timezone (computed accordingly).

### RULE-ANL-022: AI insights privacy

AI Copilot natural-language queries (Fáze 3+):
- Use anonymized aggregates only
- No individual customer data passed to LLM
- Query results cached
- Disclosure in UI: "Generated by AI"

### RULE-ANL-023: Cross-channel deduplication

Customer signs up on web, then logs in on mobile app. Both events recorded with same `customer_id`. Dashboards deduplicate by `customer_id` for unique counts.

Pre-login session activity linked retroactively if `session_hash` carries over (typically not). Strict accuracy → only post-login.

### RULE-ANL-024: Discount usage analytics

Per-discount metrics (cross-ref `10`):
- Usage count
- Total amount saved
- Average order value with vs without
- Cumulative revenue attributed

Surfaced in marketing dashboard.

### RULE-ANL-025: Return rate per product window

Computed over 90-day window (configurable). Excludes returns that exceed return window (rare edge case).

Surfaced in product analytics; flag if > 20% (high return rate).

### RULE-ANL-026: Bot-generated false positives

If specific UA pattern shows high activity but no conversions: flag for manual review (could be bot evading detection).

Admin can manually mark a UA/IP as bot via UI; backfill `device_kind='bot'` for last 7 days.

### RULE-ANL-027: Real-time activity feed retention

Recent activity feed shows last 1000 events. Older accessible via reports.

### RULE-ANL-028: Custom event payload limits

`analytics_events.properties` JSONB max 10 KB. Larger payloads truncated; warning logged.

Customer/PII fields filtered: any property name matching `email`, `phone`, `name`, `address` automatically scrubbed before storage.

### RULE-ANL-029: Public benchmarks (Fáze 3+)

Aggregate (anonymized across tenants) industry benchmarks: "Your conversion rate vs CZ e-commerce average". Opt-in by tenant for data contribution.

### RULE-ANL-030: GDPR delete impact

Customer GDPR delete:
- `analytics_events.customer_id` → NULL
- `analytics_events.guest_email_hash` → NULL
- `analytics_events.ip_hash` → NULL (anonymized further)
- Aggregates preserved (no PII inside)

---

## 9. REST API endpoints

### 9.1 Event ingestion

```
POST   /api/{date}/analytics/events                                           # batch ingest (up to 50 events)
POST   /api/{date}/analytics/events/identify                                 # link session → customer post-login
```

### 9.2 Dashboards (read)

```
GET    /api/{date}/analytics/dashboard/overview?period=30d&channel_id=&currency=CZK
GET    /api/{date}/analytics/dashboard/revenue?period=30d&granularity=day
GET    /api/{date}/analytics/dashboard/orders?period=30d
GET    /api/{date}/analytics/dashboard/conversion?period=30d
GET    /api/{date}/analytics/dashboard/customers?period=30d
GET    /api/{date}/analytics/dashboard/products?period=30d&top=20&metric=revenue
GET    /api/{date}/analytics/dashboard/categories?period=30d
GET    /api/{date}/analytics/dashboard/traffic-sources?period=30d
GET    /api/{date}/analytics/dashboard/geo?period=30d
GET    /api/{date}/analytics/dashboard/devices?period=30d
GET    /api/{date}/analytics/dashboard/marketing?period=30d
GET    /api/{date}/analytics/dashboard/rfm-segments
GET    /api/{date}/analytics/dashboard/funnel/{funnel_id}?period=30d
GET    /api/{date}/analytics/dashboard/cohorts?period=monthly&metric=retention
```

### 9.3 Custom reports

```
GET    /api/{date}/analytics/reports                                            # list saved reports
POST   /api/{date}/analytics/reports
GET    /api/{date}/analytics/reports/{id}
PATCH  /api/{date}/analytics/reports/{id}
DELETE /api/{date}/analytics/reports/{id}
POST   /api/{date}/analytics/reports/{id}:execute                                 # ad-hoc run
GET    /api/{date}/analytics/reports/{id}/executions
GET    /api/{date}/analytics/report-executions/{id}/download                       # CSV/PDF/JSON
POST   /api/{date}/analytics/reports/{id}:duplicate
POST   /api/{date}/analytics/reports/{id}:schedule
```

### 9.4 Funnels

```
GET    /api/{date}/analytics/funnels
POST   /api/{date}/analytics/funnels
GET    /api/{date}/analytics/funnels/{id}
PATCH  /api/{date}/analytics/funnels/{id}
DELETE /api/{date}/analytics/funnels/{id}
GET    /api/{date}/analytics/funnels/{id}/conversion?period=30d
```

### 9.5 RFM segments

```
GET    /api/{date}/analytics/rfm/segments                                          # list segments + counts
GET    /api/{date}/analytics/rfm/segments/{label}/customers                         # customers in segment
POST   /api/{date}/analytics/rfm:recompute                                         # manual trigger
```

### 9.6 KPI goals

```
GET    /api/{date}/analytics/kpi-goals
POST   /api/{date}/analytics/kpi-goals
GET    /api/{date}/analytics/kpi-goals/{id}/progress?period=current_month
PATCH  /api/{date}/analytics/kpi-goals/{id}
DELETE /api/{date}/analytics/kpi-goals/{id}
```

### 9.7 Exports

```
GET    /api/{date}/analytics/export-jobs
POST   /api/{date}/analytics/export-jobs
GET    /api/{date}/analytics/export-jobs/{id}
PATCH  /api/{date}/analytics/export-jobs/{id}
DELETE /api/{date}/analytics/export-jobs/{id}
POST   /api/{date}/analytics/export-jobs/{id}:run-now
GET    /api/{date}/analytics/export-jobs/{id}/history
```

### 9.8 Experiments (A/B tests, Fáze 2+)

```
GET    /api/{date}/analytics/experiments
POST   /api/{date}/analytics/experiments
GET    /api/{date}/analytics/experiments/{id}
PATCH  /api/{date}/analytics/experiments/{id}
POST   /api/{date}/analytics/experiments/{id}:start
POST   /api/{date}/analytics/experiments/{id}:pause
POST   /api/{date}/analytics/experiments/{id}:complete
GET    /api/{date}/analytics/experiments/{id}/results
```

### 9.9 Real-time activity feed

```
GET    /api/{date}/analytics/activity/recent                                       # last N events
GET    /api/{date}/analytics/activity/stream                                       # SSE endpoint
GET    /api/{date}/analytics/activity/live-stats                                   # active visitors, cart adds last hour
```

### 9.10 Example: Track event (storefront)

```http
POST /api/2026-05-20/analytics/events HTTP/1.1
Content-Type: application/json
Cookie: shopio_session=...

{
  "events": [
    {
      "event_kind": "product_viewed",
      "occurred_at": "2026-05-20T10:15:30Z",
      "entity_type": "product",
      "entity_id": "prd_aB3cD",
      "client_event_id": "evt_client_abc123",
      "properties": {
        "from_category": "cat_lighting",
        "scroll_depth_percent": 80
      },
      "utm": { "source": "google", "medium": "cpc", "campaign": "lighting-spring" },
      "referrer_host": "google.com",
      "page_path": "/products/stolni-lampa-luna",
      "consent": { "analytics": true, "personalization": false }
    },
    {
      "event_kind": "cart_item_added",
      "occurred_at": "2026-05-20T10:16:45Z",
      "entity_type": "cart",
      "entity_id": "crt_xY",
      "client_event_id": "evt_client_def456",
      "properties": { "variant_id": "var_aB", "quantity": 1, "price_amount": 12990, "currency": "CZK" }
    }
  ]
}
```

```jsonc
HTTP/1.1 202 Accepted

{
  "data": {
    "events_received": 2,
    "events_accepted": 2,
    "events_deduplicated": 0,
    "events_rejected": 0
  }
}
```

### 9.11 Example: Revenue dashboard

```http
GET /api/2026-05-20/analytics/dashboard/revenue?period=30d&granularity=day&channel_id=ch_web&currency=CZK HTTP/1.1
```

```jsonc
HTTP/1.1 200 OK

{
  "data": {
    "period": { "from": "2026-04-20", "to": "2026-05-19" },
    "channel_id": "ch_web",
    "currency": "CZK",
    "totals": {
      "gross_sales_amount": 4872310,
      "discounts_amount": 247500,
      "net_sales_amount": 4624810,
      "shipping_amount": 397800,
      "tax_amount": 1037700,
      "total_revenue_amount": 6060310,
      "refunded_amount": 84500,
      "net_revenue_amount": 5975810,
      "orders": 487,
      "avg_order_value_amount": 12446
    },
    "series": [
      { "date": "2026-04-20", "net_revenue_amount": 198400, "orders": 16, "is_finalized": true },
      { "date": "2026-04-21", "net_revenue_amount": 215600, "orders": 19, "is_finalized": true },
      ...
      { "date": "2026-05-19", "net_revenue_amount": 145600, "orders": 12, "is_finalized": false }
    ],
    "comparison_previous_period": {
      "net_revenue_amount": 5340210,
      "change_percent_basis_points": 1191
    }
  },
  "meta": {
    "computed_at": "2026-05-20T10:30:00Z",
    "request_id": "req_..."
  }
}
```

### 9.12 Example: Cohort analysis

```http
GET /api/2026-05-20/analytics/dashboard/cohorts?period=monthly&metric=retention&cohort_count=12 HTTP/1.1
```

```jsonc
HTTP/1.1 200 OK

{
  "data": {
    "metric": "retention",
    "cohorts": [
      {
        "cohort_month": "2025-06",
        "cohort_size": 124,
        "retention_by_offset": {
          "0": 12400,   // 100.00% (first purchase)
          "1": 4200,    // 42.00% in month +1
          "2": 2800,
          "3": 2100,
          "6": 1500,
          "12": 800
        }
      },
      ...
    ],
    "average_retention": {
      "1": 4100,
      "2": 2700,
      "3": 2000
    }
  }
}
```

### 9.13 Example: Create custom report

```http
POST /api/2026-05-20/analytics/reports HTTP/1.1

{
  "name": "Top brands monthly",
  "report_kind": "top_products",
  "filter": {
    "period": "current_month",
    "channel_id": "ch_web",
    "currency": "CZK",
    "min_orders": 10
  },
  "group_by": ["brand_id"],
  "metrics": ["revenue","units_sold","unique_customers"],
  "visualization": "bar_chart",
  "schedule_cron": "0 9 1 * *",
  "schedule_timezone": "Europe/Prague",
  "schedule_recipients": ["manager@example.com"],
  "schedule_format": "pdf",
  "is_shared": true
}
```

```jsonc
HTTP/1.1 201 Created

{
  "data": {
    "id": "...",
    "pub_id": "rpt_aB",
    "attributes": {
      "name": "Top brands monthly",
      "schedule_cron": "0 9 1 * *",
      "next_delivery_at": "2026-06-01T09:00:00+02:00"
    }
  }
}
```

### 9.14 Example: RFM segments

```http
GET /api/2026-05-20/analytics/rfm/segments HTTP/1.1
```

```jsonc
HTTP/1.1 200 OK

{
  "data": [
    {
      "segment_label": "champions",
      "customer_count": 47,
      "avg_total_spent": 87400,
      "avg_orders": 12,
      "currency": "CZK",
      "share_basis_points": 282         // % of total customers
    },
    {
      "segment_label": "loyal",
      "customer_count": 124,
      "avg_total_spent": 32100,
      "avg_orders": 7
    },
    ...
  ],
  "meta": { "computed_at": "2026-05-19T03:15:00Z" }
}
```

---

## 10. GraphQL schema

```graphql
type AnalyticsOverview {
  period: PeriodRange!
  currency: String!
  totals: AnalyticsTotals!
  comparisonPreviousPeriod: AnalyticsComparison
  trend: [DailyMetric!]!
}

type PeriodRange { from: Date!  to: Date! }

type AnalyticsTotals {
  grossSalesAmount: Money!
  discountsAmount: Money!
  netSalesAmount: Money!
  shippingAmount: Money!
  taxAmount: Money!
  totalRevenueAmount: Money!
  refundedAmount: Money!
  netRevenueAmount: Money!
  orders: Int!
  avgOrderValueAmount: Money!
  conversionRate: Float!
  uniqueVisitors: Int
  newCustomers: Int
  returningCustomers: Int
}

type AnalyticsComparison {
  netRevenueAmount: Money!
  changePercent: Float!
}

type DailyMetric {
  date: Date!
  netRevenueAmount: Money!
  orders: Int!
  isFinalized: Boolean!
}

type AnalyticsFunnel {
  funnel: AnalyticsFunnelDefinition!
  period: PeriodRange!
  steps: [FunnelStepResult!]!
  totalConversions: Int!
  overallConversionRate: Float!
}

type FunnelStepResult {
  stepId: String!
  stepName: String!
  uniqueVisitors: Int!
  conversionsToNext: Int
  conversionRate: Float
  dropOffRate: Float
}

type AnalyticsFunnelDefinition implements Node {
  id: ID!
  pubId: String!
  name: String!
  description: String
  isDefault: Boolean!
  steps: JSON!
  windowSeconds: Int!
  channel: Channel
  isActive: Boolean!
}

type CohortMatrix {
  cohorts: [CohortRow!]!
  averageRetention: JSON!
}

type CohortRow {
  cohortMonth: Date!
  cohortSize: Int!
  retentionByOffset: JSON!                  # { "0": 10000, "1": 4200, ... }
}

type RfmSegment {
  label: String!
  customerCount: Int!
  avgTotalSpent: Money!
  avgOrders: Float!
  share: Float!
}

type AnalyticsReport implements Node {
  id: ID!
  pubId: String!
  name: String!
  description: String
  reportKind: AnalyticsReportKind!
  filter: JSON
  groupBy: [String!]
  metrics: [String!]
  customSql: String
  visualization: AnalyticsVisualization!
  scheduleCron: String
  scheduleRecipients: [String!]
  scheduleFormat: ReportExportFormat
  lastDeliveredAt: DateTime
  nextDeliveryAt: DateTime
  isShared: Boolean!
  createdBy: User
  createdAt: DateTime!
}

enum AnalyticsReportKind {
  REVENUE_SUMMARY TOP_PRODUCTS CUSTOMER_COHORTS RFM_SEGMENTS
  FUNNEL TRAFFIC_SOURCES CONVERSION_BREAKDOWN
  INVENTORY_TURNOVER DISCOUNT_USAGE REFUND_ANALYSIS
  CUSTOM_QUERY
}

enum AnalyticsVisualization { TABLE LINE_CHART BAR_CHART PIE_CHART HEATMAP FUNNEL COHORT_MATRIX }
enum ReportExportFormat { PDF CSV XLSX JSON }

type AnalyticsKpiGoal implements Node {
  id: ID!
  name: String!
  metric: AnalyticsKpiMetric!
  targetValue: Int!
  targetCurrency: String
  period: AnalyticsKpiPeriod!
  currentProgress: Float!                     # 0.0 - 1.0+
  isOnTrack: Boolean!
  isActive: Boolean!
}

enum AnalyticsKpiMetric {
  MONTHLY_REVENUE MONTHLY_ORDERS CONVERSION_RATE AVG_ORDER_VALUE
  NEW_CUSTOMERS REPEAT_PURCHASE_RATE CART_ABANDONMENT_RATE REVIEW_COUNT LTV
}

enum AnalyticsKpiPeriod { DAILY WEEKLY MONTHLY QUARTERLY YEARLY }

type AnalyticsExperiment implements Node {
  id: ID!
  pubId: String!
  name: String!
  kind: ExperimentKind!
  hypothesis: String
  variants: JSON!
  status: ExperimentStatus!
  startedAt: DateTime
  endedAt: DateTime
  winnerVariantId: String
  statisticalSignificance: Float
  primaryMetric: String
}

enum ExperimentKind { STOREFRONT_PAGE EMAIL_SUBJECT PRODUCT_RECOMMENDATION SEARCH_RANKING CHECKOUT_LAYOUT PRICE_TEST }
enum ExperimentStatus { DRAFT RUNNING PAUSED COMPLETED ARCHIVED }

extend type Query {
  analyticsOverview(period: PeriodInput!, channelId: ID, currency: String): AnalyticsOverview! @auth(requires: PERM_ANALYTICS_VIEW)
  analyticsRevenue(period: PeriodInput!, granularity: TimeGranularity = DAY, channelId: ID, currency: String): AnalyticsOverview! @auth(requires: PERM_ANALYTICS_VIEW)
  analyticsConversion(period: PeriodInput!, channelId: ID): AnalyticsFunnel! @auth(requires: PERM_ANALYTICS_VIEW)
  analyticsCustomers(period: PeriodInput!): CustomerAnalytics! @auth(requires: PERM_ANALYTICS_VIEW)
  analyticsProducts(period: PeriodInput!, top: Int = 20, metric: String = "revenue"): [ProductPerformance!]! @auth(requires: PERM_ANALYTICS_VIEW)
  analyticsTrafficSources(period: PeriodInput!): TrafficSourcesBreakdown! @auth(requires: PERM_ANALYTICS_VIEW)
  analyticsCohorts(period: PeriodInput!, metric: String = "retention"): CohortMatrix! @auth(requires: PERM_ANALYTICS_VIEW)
  analyticsFunnels: [AnalyticsFunnelDefinition!]! @auth(requires: PERM_ANALYTICS_VIEW)
  analyticsFunnel(id: ID!, period: PeriodInput!): AnalyticsFunnel! @auth(requires: PERM_ANALYTICS_VIEW)
  rfmSegments: [RfmSegment!]! @auth(requires: PERM_ANALYTICS_VIEW)
  rfmSegmentCustomers(label: String!, first: Int = 100, after: String): CustomerConnection! @auth(requires: PERM_ANALYTICS_VIEW)
  analyticsReports: [AnalyticsReport!]! @auth(requires: PERM_ANALYTICS_VIEW)
  analyticsReport(id: ID, pubId: String): AnalyticsReport @auth(requires: PERM_ANALYTICS_VIEW)
  kpiGoals: [AnalyticsKpiGoal!]! @auth(requires: PERM_ANALYTICS_VIEW)
  analyticsExperiments: [AnalyticsExperiment!]! @auth(requires: PERM_ANALYTICS_VIEW)
  analyticsActivityRecent(first: Int = 100): [ActivityEvent!]! @auth(requires: PERM_ANALYTICS_VIEW)
  analyticsLiveStats: LiveStats! @auth(requires: PERM_ANALYTICS_VIEW)
}

input PeriodInput {
  from: Date
  to: Date
  preset: PeriodPreset
}

enum PeriodPreset { TODAY YESTERDAY LAST_7D LAST_30D LAST_90D LAST_YEAR THIS_MONTH THIS_QUARTER THIS_YEAR }
enum TimeGranularity { HOUR DAY WEEK MONTH QUARTER YEAR }

type LiveStats {
  activeVisitors: Int!
  cartAddsLastHour: Int!
  ordersLastHour: Int!
  topViewedProducts: [Product!]!
}

extend type Mutation {
  trackEvents(events: [AnalyticsEventInput!]!): TrackEventsResult!
  identifyVisitor(sessionHash: String!, customerId: ID!): MutationPayload!

  createFunnelDefinition(input: AnalyticsFunnelInput!): AnalyticsFunnelDefinition! @auth(requires: PERM_ANALYTICS_MANAGE)
  updateFunnelDefinition(id: ID!, input: AnalyticsFunnelInput!): AnalyticsFunnelDefinition! @auth(requires: PERM_ANALYTICS_MANAGE)
  deleteFunnelDefinition(id: ID!): DeletePayload! @auth(requires: PERM_ANALYTICS_MANAGE)

  createAnalyticsReport(input: AnalyticsReportInput!): AnalyticsReport! @auth(requires: PERM_ANALYTICS_CUSTOM_REPORTS)
  updateAnalyticsReport(id: ID!, input: AnalyticsReportInput!): AnalyticsReport! @auth(requires: PERM_ANALYTICS_CUSTOM_REPORTS)
  deleteAnalyticsReport(id: ID!): DeletePayload! @auth(requires: PERM_ANALYTICS_CUSTOM_REPORTS)
  executeAnalyticsReport(id: ID!): Operation! @auth(requires: PERM_ANALYTICS_VIEW)
  scheduleAnalyticsReport(id: ID!, cron: String!, timezone: String!, recipients: [String!]!): AnalyticsReport! @auth(requires: PERM_ANALYTICS_CUSTOM_REPORTS)

  createKpiGoal(input: KpiGoalInput!): AnalyticsKpiGoal! @auth(requires: PERM_ANALYTICS_MANAGE)
  updateKpiGoal(id: ID!, input: KpiGoalInput!): AnalyticsKpiGoal! @auth(requires: PERM_ANALYTICS_MANAGE)

  createExperiment(input: ExperimentInput!): AnalyticsExperiment! @auth(requires: PERM_ANALYTICS_EXPERIMENT_MANAGE)
  startExperiment(id: ID!): AnalyticsExperiment! @auth(requires: PERM_ANALYTICS_EXPERIMENT_MANAGE)
  completeExperiment(id: ID!, winnerVariantId: String!): AnalyticsExperiment! @auth(requires: PERM_ANALYTICS_EXPERIMENT_MANAGE)

  createExportJob(input: AnalyticsExportJobInput!): Operation! @auth(requires: PERM_ANALYTICS_RAW_EXPORT)
  runExportJobNow(id: ID!): Operation! @auth(requires: PERM_ANALYTICS_RAW_EXPORT)
}

input AnalyticsEventInput {
  eventKind: String!
  occurredAt: DateTime!
  entityType: String
  entityId: ID
  properties: JSON
  clientEventId: String
}

type TrackEventsResult {
  eventsReceived: Int!
  eventsAccepted: Int!
  eventsDeduplicated: Int!
  eventsRejected: Int!
}
```

---

## 11. Events

| Build-spec ID | Wire | Payload |
|---|---|---|
| `EVENT-ANALYTICS-EVENT-INGESTED` | (internal) | `{ event_id, kind, tenant }` |
| `EVENT-ANALYTICS-DAILY-ROLLUP-FINALIZED` | `analytics.daily_rollup_finalized` | `{ tenant_id, date }` |
| `EVENT-ANALYTICS-MILESTONE-REACHED` | `analytics.milestone_reached` | `{ tenant_id, milestone, value }` (e.g., 1000 orders) |
| `EVENT-ANALYTICS-KPI-OFF-TRACK` | `analytics.kpi_off_track` | `{ goal, progress_percent, period_remaining_days }` |
| `EVENT-ANALYTICS-KPI-ACHIEVED` | `analytics.kpi_achieved` | `{ goal, actual_value }` |
| `EVENT-ANALYTICS-EXPERIMENT-SIGNIFICANT` | `analytics.experiment_significant` | `{ experiment, winning_variant, p_value }` |
| `EVENT-ANALYTICS-ANOMALY-DETECTED` | `analytics.anomaly_detected` | `{ metric, expected, actual, severity }` |
| `EVENT-ANALYTICS-REPORT-EXECUTED` | `analytics.report_executed` | `{ execution, status, row_count }` |
| `EVENT-ANALYTICS-REPORT-DELIVERED` | `analytics.report_delivered` | `{ report, recipients }` |
| `EVENT-ANALYTICS-EXPORT-COMPLETED` | `analytics.export_completed` | `{ export_job, rows_exported }` |
| `EVENT-ANALYTICS-EXPORT-FAILED` | `analytics.export_failed` | `{ export_job, reason }` |
| `EVENT-ANALYTICS-LATE-EVENT-DETECTED` | `analytics.late_event_detected` | `{ tenant_id, original_date, late_count }` |

**Konzumenti:**
- Notification system — milestone celebrations, KPI alerts, anomaly alerts
- AI Copilot — anomaly investigation prompts (Fáze 3+)
- Webhook delivery
- Marketing automation — milestone triggers (e.g., 1000th customer)

---

## 12. Background jobs

| Job | Trigger | Queue | Frequency |
|---|---|---|---|
| `JOB-INGEST-EVENT-BATCH` | API POST or event emit | `analytics-ingest` | On-demand |
| `JOB-ENRICH-EVENT` | EVENT-ANALYTICS-EVENT-INGESTED | `analytics-ingest` | On-demand |
| `JOB-COMPUTE-ANALYTICS-HOURLY-PROVISIONAL` | scheduled | `analytics-compute` | Hourly |
| `JOB-COMPUTE-ANALYTICS-DAILY-FINAL` | scheduled | `analytics-compute` | Daily 03:00 |
| `JOB-COMPUTE-ANALYTICS-PRODUCT-DAILY` | scheduled | `analytics-compute` | Daily 03:30 |
| `JOB-COMPUTE-ANALYTICS-CUSTOMER-COHORT` | scheduled | `analytics-compute` | Daily 04:00 |
| `JOB-COMPUTE-RFM` | scheduled | `analytics-compute` | Weekly (Sunday 04:00) |
| `JOB-COMPUTE-FUNNEL-DAILY` | scheduled | `analytics-compute` | Daily 04:30 |
| `JOB-REFRESH-MATERIALIZED-VIEWS` | scheduled | `analytics-compute` | Daily 05:00 |
| `JOB-RECONCILE-ANALYTICS-ROLLUPS` | scheduled | `analytics-compute` | Weekly Saturday |
| `JOB-EXECUTE-REPORT` | API trigger or scheduled | `analytics-reports` | On-demand |
| `JOB-DELIVER-SCHEDULED-REPORT` | cron per report's schedule | `analytics-reports` | Per schedule |
| `JOB-EVALUATE-KPI-GOALS` | scheduled | `analytics-compute` | Daily 06:00 |
| `JOB-DETECT-ANALYTICS-ANOMALIES` | scheduled | `analytics-compute` | Hourly |
| `JOB-COMPUTE-EXPERIMENT-RESULTS` | scheduled | `analytics-compute` | Hourly (only running experiments) |
| `JOB-RUN-EXPORT-JOB` | scheduled per export | `analytics-exports` | Configurable |
| `JOB-PURGE-OLD-EVENTS` | scheduled | `maintenance` | Daily (drop partitions per retention) |
| `JOB-ANONYMIZE-EVENTS-ON-CUSTOMER-DELETE` | EVENT-CUSTOMER-ANONYMIZED | `analytics-ingest` | On-demand |
| `JOB-COMPUTE-LIVE-STATS-CACHE` | scheduled | `analytics-ingest` | Every minute |
| `JOB-UPDATE-EXCHANGE-RATE-SNAPSHOTS` | scheduled | `analytics-compute` | Daily 01:00 (from ECB/CNB) |
| `JOB-BACKFILL-LATE-ARRIVAL-NOTE` | EVENT-ANALYTICS-LATE-EVENT-DETECTED | `analytics-compute` | On-demand |

### 12.1 JOB-COMPUTE-ANALYTICS-DAILY-FINAL detail

```typescript
async function computeAnalyticsDailyFinal(tenantId: string, date: Date) {
  // Compute from raw events for the day (already in tenant timezone)
  const result = await pg.query(sql`
    SELECT
      channel_id,
      currency,
      COUNT(DISTINCT visitor_hash) AS unique_visitors,
      COUNT(DISTINCT session_hash) AS total_sessions,
      COUNT(*) FILTER (WHERE event_kind = 'page_view') AS page_views,
      COUNT(*) FILTER (WHERE event_kind = 'product_viewed') AS product_views,
      COUNT(*) FILTER (WHERE event_kind = 'cart_item_added') AS cart_items_added,
      COUNT(*) FILTER (WHERE event_kind = 'checkout_started') AS checkouts_started,
      COUNT(*) FILTER (WHERE event_kind = 'order_placed') AS orders_placed,
      COALESCE(SUM(revenue_amount) FILTER (WHERE event_kind = 'order_placed'), 0) AS gross_sales_amount,
      ...
    FROM analytics_events
    WHERE tenant_id = ${tenantId}
      AND occurred_at >= ${dayStart}::timestamptz
      AND occurred_at < ${dayEnd}::timestamptz
      AND device_kind != 'bot'
    GROUP BY channel_id, currency
  `);
  
  for (const row of result) {
    await upsertRollup(tenantId, date, row);
  }
  
  // Mark finalized
  await pg.execute(sql`
    UPDATE analytics_daily_rollups
    SET is_finalized = true, computed_at = now()
    WHERE tenant_id = ${tenantId} AND date = ${date}
  `);
  
  await emitOutbox('EVENT-ANALYTICS-DAILY-ROLLUP-FINALIZED', { tenant_id: tenantId, date });
}
```

### 12.2 JOB-COMPUTE-RFM detail

```typescript
async function computeRfm(tenantId: string) {
  // Quintile thresholds per tenant
  const thresholds = await computeQuintileThresholds(tenantId);
  
  // Process customers in batches
  await processBatched(tenantId, async (customer) => {
    const r = computeRecencyScore(customer.last_order_at, thresholds.recency);
    const f = computeFrequencyScore(customer.total_orders, thresholds.frequency);
    const m = computeMonetaryScore(customer.total_spent_amount, thresholds.monetary);
    const label = mapToSegmentLabel(r, f, m);
    
    await upsertRfmScore(customer.id, r, f, m, label);
  });
}
```

### 12.3 JOB-DETECT-ANALYTICS-ANOMALIES detail

```typescript
async function detectAnomalies(tenantId: string) {
  // For each key metric, compare current hour vs same hour last 7 days
  const metrics = ['orders_placed', 'gross_sales_amount', 'unique_visitors'];
  
  for (const metric of metrics) {
    const current = await getCurrentHourMetric(tenantId, metric);
    const historical = await getHistoricalHourMetric(tenantId, metric, 7);
    const z = (current - mean(historical)) / stddev(historical);
    
    if (Math.abs(z) > 3) {  // > 3 std devs
      const severity = z > 0 ? 'positive_spike' : 'negative_drop';
      await emitOutbox('EVENT-ANALYTICS-ANOMALY-DETECTED', {
        tenant_id: tenantId,
        metric,
        expected: mean(historical),
        actual: current,
        severity,
        z_score: z,
      });
    }
  }
}
```

---

## 13. UI/UX flows

### FLOW-ANL-001: Admin home dashboard

```
[/admin (home)]
   Hero stats (current month vs previous month):
   - Total revenue: 487,231 CZK ↑ 12%
   - Orders: 47 ↑ 8%
   - Conversion rate: 3.2% ↑ 0.4pp
   - AOV: 10,366 CZK ↑ 4%
   
   Cards:
   - Revenue trend (line chart, last 30 days)
   - Top products (top 5)
   - Recent orders (live)
   - RFM segments (donut chart with quick links to act)
   - KPI goals progress bars
   
   Quick actions: [View full analytics] [Create report]
```

### FLOW-ANL-002: Deep dive revenue

```
[/admin/analytics/revenue]
   - Filter bar: date range, channel, store, country, customer_group, currency
   - Big number: net revenue with comparison (previous period + previous year)
   - Time series chart (granularity selector: hour/day/week/month)
   - Breakdown table:
     • By day | By channel | By country | By customer_group | By payment_method
   - Funnel inline (sessions → cart → checkout → order)
   - Export button (CSV / XLSX / PDF)
```

### FLOW-ANL-003: Cohort matrix

```
[/admin/analytics/cohorts]
   - Metric selector: Retention | Revenue | Orders
   - Cohort size: monthly / quarterly
   - Matrix view:
     • Rows: cohort months (last 12)
     • Columns: offset months (0, 1, 2, ..., 11)
     • Cell: % retained
   - Color heatmap (darker = better retention)
   - Hover cell: customer count, revenue
   - Click cell: drill-down to specific cohort customers
```

### FLOW-ANL-004: Create custom report

```
[/admin/analytics/reports/new]
   Wizard:
   Step 1: Choose report kind (Revenue / Top products / Cohorts / Funnel / Custom...)
   Step 2: Pick filters (date range, channel, ...)
   Step 3: Pick group-by + metrics
   Step 4: Choose visualization
   Step 5: Schedule (optional)
     - Cron schedule, recipients, format
   Step 6: Preview + Save
        │
        ▼
[POST /analytics/reports]
   - Save report
   - Run preview
```

### FLOW-ANL-005: Schedule report delivery

```
[Report → "Schedule" button]
   - Cron picker (visual: "Every Monday at 9:00 AM")
   - Timezone selector
   - Recipients (multi-email)
   - Format: PDF / CSV / XLSX
        │
        ▼
[Schedule saved → next_delivery_at computed]
        │
   ... at scheduled time, JOB-DELIVER-SCHEDULED-REPORT runs ...
        │
        ▼
[Email sent with attachment]
```

### FLOW-ANL-006: RFM segment action

```
[/admin/analytics/rfm]
   - Donut chart of segments
   - Table: segment | count | avg LTV | suggested action
        │
   click "Champions" segment
        │
        ▼
[Segment detail]
   - Customer list with totals
   - "Create campaign for this segment" button
        │
   click button
        │
        ▼
[Create email campaign with segment pre-filled (cross to `19`)]
```

### FLOW-ANL-007: KPI goal tracking

```
[/admin/analytics/kpi]
   - List of active KPI goals
   - Each: name | metric | target | current progress (% with bar) | status (on-track / behind / achieved)
        │
   click goal
        │
        ▼
[Goal detail]
   - Daily progress chart
   - Forecast (linear extrapolation) → "Will achieve X% if continues"
   - Adjust target | Pause | Delete
```

### FLOW-ANL-008: A/B experiment (Fáze 2+)

```
[/admin/analytics/experiments/new]
   - Type: storefront page A/B
   - Hypothesis: "Hero image variant B will increase conversion 5%"
   - Variants: A (control), B (test)
   - Traffic split: 50/50
   - Primary metric: conversion rate
   - Sample size estimator
        │
   start
        │
        ▼
[Experiment running]
   - Real-time results: variant A vs B
   - Statistical significance progress
   - "Stop early if significance < 0.05" toggle
        │
   ... 14 days later ...
        │
        ▼
[Results page]
   - Winner: Variant B with 4.2% lift, p=0.023
   - "Promote winner" button
   - Detailed metrics per variant
```

---

## 14. Edge cases & error handling

| Scenario | Behavior | Code |
|---|---|---|
| Event timestamp 1h in future | Reject (clock skew) | `INVALID_TIMESTAMP`, 400 |
| Event timestamp > 7 days old | Reject (likely replay) | `EVENT_TOO_OLD`, 400 |
| Event payload > 10 KB | Reject | `EVENT_TOO_LARGE`, 413 |
| Event with unknown event_kind | Reject | `UNKNOWN_EVENT_KIND`, 400 |
| Client posts duplicate client_event_id | Idempotent skip (dedup) | (silent) |
| High event rate from single IP | Rate limit; possible bot | (rate limited) |
| Late event for finalized day | Stored raw, not applied to rollup; logged | (handled per RULE-ANL-012) |
| Rollup computation fails partial | Retry from raw events | (handled) |
| Multi-currency comparison without exchange rate | Show with disclaimer; fallback to UTC daily avg | (handled) |
| Empty dashboard (new tenant, no data) | Show onboarding hints, sample data preview | (UX) |
| Report query timeout | Cancel job, mark failed; suggest narrower filter | `REPORT_TIMEOUT`, 504 |
| Custom SQL with syntax error | Validate at save, runtime catch with friendly error | (handled) |
| Export to BigQuery fails (auth) | Retry 3x; admin alert; pause job | (handled) |
| Scheduled report recipient unsubscribed | Skip; admin notified | (handled) |
| KPI goal target unrealistic (target = 0) | Reject | `INVALID_TARGET`, 422 |
| Experiment with < min sample size | Don't compute significance | (graceful) |
| RFM recompute on tenant with < 100 customers | Use simpler thresholds (deciles → quintiles fallback) | (handled) |
| Funnel step references deleted product | Skip step; warning | (handled) |
| Anomaly detector false positive (low traffic) | Suppress alerts for low-volume tenants | (configurable) |
| Bot exclusion catches legitimate user | Per-tenant override allow-list | (handled) |
| Cross-tenant data leak attempt via custom SQL | Sandbox enforces tenant_id; reject if missing | (security) |
| GDPR delete on customer with 10k events | Background anonymization async; UI shows progress | (handled) |

---

## 15. Performance

### 15.1 Targets

| Operation | p50 | p95 | p99 |
|---|---|---|---|
| `POST /analytics/events` (batch 50) | 30 ms | 100 ms | 300 ms |
| `GET /analytics/dashboard/overview` (cached) | 15 ms | 50 ms | 120 ms |
| `GET /analytics/dashboard/revenue` (30d) | 50 ms | 200 ms | 500 ms |
| `GET /analytics/dashboard/cohorts` | 100 ms | 400 ms | 1000 ms |
| `JOB-COMPUTE-ANALYTICS-DAILY-FINAL` (10M events) | 30 s | 120 s | 300 s |
| `JOB-COMPUTE-RFM` (100k customers) | 60 s | 240 s | 600 s |
| `JOB-EXECUTE-REPORT` (custom) | 5 s | 30 s | 60 s (timeout 30s ad-hoc) |
| Live stats query (cached 1 min) | 5 ms | 15 ms | 40 ms |

### 15.2 Optimization

- **BRIN indexes** on `occurred_at` (huge time-series tables)
- **Partitioned tables** (events, executions) monthly
- **Pre-aggregated rollups** for dashboards (no live aggregation on raw events)
- **Materialized views** for hot reports (refreshed daily)
- **Read replicas** for analytics queries (no impact on writes)
- **Redis cache** for dashboard responses (60s TTL)
- **Batching** for event ingestion (insert 100 at a time)
- **Late event handling** doesn't recompute rollups (saves cost)
- **DataLoader v GraphQL** for batched cohort queries

### 15.3 Scaling

- Event volume: 100M events/month manageable on single Postgres with monthly partitioning
- 1B+ events/month: consider ClickHouse / TimescaleDB / BigQuery as primary store (Fáze 3+)
- Aggregation workers: horizontally scale per tenant batch
- Hot data (last 30 days) in primary; cold data archived/queried via read replica or BigQuery

### 15.4 Hot path queries

```sql
-- Dashboard revenue last 30 days (pre-aggregated)
SELECT date, net_revenue_amount, orders_placed
FROM analytics_daily_rollups
WHERE tenant_id = $1
  AND date >= now() - interval '30 days'
  AND date <= now()
  AND channel_id IS NULL
  AND currency = $2
ORDER BY date;
-- Uses idx_analytics_daily_tenant_date
```

```sql
-- Funnel rollup for past 30 days
SELECT date, step_counts, drop_off
FROM analytics_funnel_daily_rollups
WHERE tenant_id = $1 AND funnel_id = $2
  AND date >= now() - interval '30 days'
ORDER BY date;
```

---

## 16. Security & GDPR

### 16.1 Permissions

```
PERM-ANALYTICS-VIEW
PERM-ANALYTICS-VIEW-MARKETING
PERM-ANALYTICS-VIEW-CATALOG
PERM-ANALYTICS-MANAGE                          # funnels, KPI goals
PERM-ANALYTICS-CUSTOM-REPORTS
PERM-ANALYTICS-RAW-EXPORT
PERM-ANALYTICS-EXPORT-FINANCIAL
PERM-ANALYTICS-EXPERIMENT-MANAGE
PERM-ANALYTICS-COMPLIANCE-VIEW
```

### 16.2 GDPR

- Cookie-less first-party analytics by default
- Consent gating per RULE-ANL-002
- Retention per RULE-ANL-004
- GDPR delete cascades to anonymize per RULE-ANL-030
- Aggregates have no PII; can be retained indefinitely

### 16.3 Audit

100% audit on:
- Custom report creation/edit (includes SQL if custom_query)
- Raw export job creation
- Experiment start/complete
- Data deletion

### 16.4 Multi-tenancy

Hard enforced. Cross-tenant impossible (RLS + app-level WHERE tenant_id).

### 16.5 Export security

Credentials in Vault. Export jobs run in isolated worker. Output to S3 with signed URLs (7-day TTL).

### 16.6 Rate limits

| Endpoint | Free | Pro |
|---|---|---|
| `POST /analytics/events` (storefront client) | 1000/min per IP | 10000/min |
| `GET /analytics/dashboard/*` | 60/min | 600/min |
| `POST /analytics/reports/{id}:execute` | 10/hour | 60/hour |
| Export job runs | 1/hour per job | 12/hour per job |

---

## 17. Testing

### 17.1 Unit

```
TEST-UNIT-ANL-001  EventValidator
TEST-UNIT-ANL-002  VisitorHashGenerator (consistency + daily rotation)
TEST-UNIT-ANL-003  EventDeduplicator (client_event_id)
TEST-UNIT-ANL-004  EventEnricher (geo, device, consent)
TEST-UNIT-ANL-005  RollupComputer (aggregation correctness)
TEST-UNIT-ANL-006  CurrencyNormalizer (with exchange rates)
TEST-UNIT-ANL-007  RfmScorer (quintile thresholds + label mapping)
TEST-UNIT-ANL-008  FunnelComputer (step conversion + drop-off)
TEST-UNIT-ANL-009  CohortBuilder
TEST-UNIT-ANL-010  AnomalyDetector (z-score)
TEST-UNIT-ANL-011  KpiProgressCalculator
TEST-UNIT-ANL-012  ExperimentSignificanceCalculator (chi-squared, t-test)
TEST-UNIT-ANL-013  BotClassifier (UA patterns)
TEST-UNIT-ANL-014  ReportSqlBuilder (group_by, filters → SQL)
TEST-UNIT-ANL-015  PiiScrubber (event properties)
```

### 17.2 Integration

```
TEST-INT-ANL-001   Ingest event batch → analytics_events row
TEST-INT-ANL-002   Dedup: same client_event_id within 24h
TEST-INT-ANL-003   Daily rollup matches raw events sum
TEST-INT-ANL-004   Multi-currency rollup with exchange rates
TEST-INT-ANL-005   Funnel step computation accuracy
TEST-INT-ANL-006   RFM scoring + segment assignment
TEST-INT-ANL-007   Cohort retention matrix correctness
TEST-INT-ANL-008   Materialized view refresh
TEST-INT-ANL-009   Custom report execution (table)
TEST-INT-ANL-010   Scheduled report delivery via email
TEST-INT-ANL-011   KPI goal evaluation + off-track alert
TEST-INT-ANL-012   Anomaly detection fires
TEST-INT-ANL-013   Experiment significance reaches threshold → event
TEST-INT-ANL-014   Export to S3 CSV
TEST-INT-ANL-015   GDPR delete anonymizes events
TEST-INT-ANL-016   Late event detection + log
TEST-INT-ANL-017   Bot exclusion in dashboards
TEST-INT-ANL-018   Multi-tenancy isolation enforced
TEST-INT-ANL-019   Reconciliation detects drift
TEST-INT-ANL-020   Real-time activity feed (SSE)
```

### 17.3 E2E

```
TEST-E2E-ANL-001  Customer browses → adds to cart → orders → all events flow
TEST-E2E-ANL-002  Admin opens dashboard, sees today's stats
TEST-E2E-ANL-003  Admin creates custom report + schedules
TEST-E2E-ANL-004  Admin views cohort matrix, drills down
TEST-E2E-ANL-005  Admin tracks KPI goal progress
TEST-E2E-ANL-006  A/B experiment from creation to completion
```

### 17.4 Load

```
TEST-LOAD-ANL-001  10k events/sec ingestion → no backlog
TEST-LOAD-ANL-002  1000 RPS dashboard requests → p95 < 100 ms (cached)
TEST-LOAD-ANL-003  Daily aggregation 100M events in < 5 min
TEST-LOAD-ANL-004  Custom report on 10M events → < 30s
```

---

## 18. Implementation checklist

### Backend
- [ ] **[S]** Drizzle schema `packages/db/src/schema/analytics/*.ts`
- [ ] **[S]** Migrace `20260603_001_create_analytics_tables.sql` (partitions for events + report_executions)
- [ ] **[L]** `EventIngestionService` — validation + enrichment + dedup
- [ ] **[M]** `EventEnricher` — geo, device, consent snapshot
- [ ] **[M]** `VisitorHasher` — daily rotation
- [ ] **[L]** `RollupAggregator` — daily/product/customer/funnel
- [ ] **[M]** `RfmComputer`
- [ ] **[M]** `FunnelComputer`
- [ ] **[M]** `CohortBuilder`
- [ ] **[M]** `AnomalyDetector`
- [ ] **[L]** `ReportEngine` — execute + format (PDF/CSV/XLSX)
- [ ] **[L]** `ScheduledReportDeliverer`
- [ ] **[M]** `KpiGoalEvaluator`
- [ ] **[M]** `ExperimentEngine` — variant assignment + significance
- [ ] **[L]** `ExportEngine` — BigQuery, Snowflake, S3 destinations
- [ ] **[M]** `BotClassifier`
- [ ] **[M]** REST endpoints per §9
- [ ] **[M]** GraphQL types + resolvers
- [ ] **[S]** tRPC router (admin)
- [ ] **[S]** MCP tools `analytics.get_dashboard` (read-only)
- [ ] **[M]** Real-time SSE endpoint

### Background jobs
- [ ] **[M]** JOB-INGEST-EVENT-BATCH, JOB-ENRICH-EVENT
- [ ] **[M]** JOB-COMPUTE-ANALYTICS-HOURLY-PROVISIONAL
- [ ] **[L]** JOB-COMPUTE-ANALYTICS-DAILY-FINAL
- [ ] **[M]** JOB-COMPUTE-ANALYTICS-PRODUCT-DAILY, JOB-COMPUTE-ANALYTICS-CUSTOMER-COHORT
- [ ] **[M]** JOB-COMPUTE-RFM
- [ ] **[M]** JOB-COMPUTE-FUNNEL-DAILY
- [ ] **[S]** JOB-REFRESH-MATERIALIZED-VIEWS
- [ ] **[S]** JOB-RECONCILE-ANALYTICS-ROLLUPS
- [ ] **[M]** JOB-EXECUTE-REPORT, JOB-DELIVER-SCHEDULED-REPORT
- [ ] **[S]** JOB-EVALUATE-KPI-GOALS
- [ ] **[M]** JOB-DETECT-ANALYTICS-ANOMALIES
- [ ] **[M]** JOB-COMPUTE-EXPERIMENT-RESULTS
- [ ] **[L]** JOB-RUN-EXPORT-JOB
- [ ] **[S]** JOB-PURGE-OLD-EVENTS
- [ ] **[M]** JOB-ANONYMIZE-EVENTS-ON-CUSTOMER-DELETE
- [ ] **[S]** JOB-COMPUTE-LIVE-STATS-CACHE
- [ ] **[S]** JOB-UPDATE-EXCHANGE-RATE-SNAPSHOTS

### Frontend — Admin
- [ ] **[L]** Home dashboard with hero stats + cards
- [ ] **[L]** Revenue analytics deep dive page
- [ ] **[L]** Conversion funnel page (visual funnel chart)
- [ ] **[L]** Customer analytics page (cohorts, retention, RFM)
- [ ] **[M]** Product analytics page (top products, slow movers)
- [ ] **[M]** Traffic sources page
- [ ] **[M]** Marketing analytics page (cross-ref `19`)
- [ ] **[L]** Cohort matrix interactive
- [ ] **[L]** Custom report builder wizard
- [ ] **[M]** Report scheduling UI
- [ ] **[M]** KPI goals management
- [ ] **[L]** Experiment management (Fáze 2+)
- [ ] **[M]** Export job management
- [ ] **[M]** Real-time activity feed widget

### Frontend — Storefront client
- [ ] **[M]** Analytics JS library (auto-collects page_view, scroll, etc.)
- [ ] **[S]** Cookie-less identifier management
- [ ] **[S]** Consent integration (cookie banner respect)
- [ ] **[S]** Event batching + retry

### Tests
- [ ] **[M]** Per §17

### Docs
- [ ] **[M]** "Understanding your dashboards" merchant guide
- [ ] **[M]** "Building custom reports" merchant guide
- [ ] **[S]** "Setting up KPI goals" guide
- [ ] **[S]** "Cohort analysis explained" guide
- [ ] **[S]** "Connecting BigQuery" technical guide
- [ ] **[S]** Developer: tracking custom events from plugins
- [ ] **[S]** Privacy doc: how analytics work, what data is collected

---

## 19. Open questions

### Q-ANL-001: ClickHouse / TimescaleDB for events
**Otázka:** Postgres struggles at billions of events. Switch to specialized OLAP?

**Status:** MVP: Postgres + partitioning + BRIN. Fáze 3+: ClickHouse or TimescaleDB if needed. Schema layer abstraction allows swap.

### Q-ANL-002: Cookie consent UX
**Otázka:** Cookie-less analytics work without banner, but A/B testing / personalization need cookies. UX?

**Status:** Tiered consent: "Essential" (always), "Analytics" (anonymous OK without consent), "Personalization" (explicit opt-in). Detail v cookie banner UI.

### Q-ANL-003: AI natural-language queries
**Otázka:** "Show me revenue by city for top 10 customers" → SQL via Claude?

**Status:** Fáze 3+ feature in `33-ai-features.md`. Safety: sandboxed SQL, no DML, tenant_id forced.

### Q-ANL-004: Server-side Google Analytics 4 mirror
**Otázka:** Send events to GA4 for merchants who want Google ecosystem?

**Status:** v1.0+ integration plugin (`29-integrations.md`).

### Q-ANL-005: Plausible / Fathom mirror
**Otázka:** Privacy-friendly external analytics — push events to merchant's Plausible instance?

**Status:** v1.0+ via export plugin.

### Q-ANL-006: Real-time vs near-real-time
**Otázka:** Dashboard refresh — every 1 min, 5 min, or on-demand?

**Status:** 60s cache default. SSE push for orders/visitors (immediate). Configurable.

### Q-ANL-007: Predictive analytics
**Otázka:** Forecast next month revenue based on trend?

**Status:** Fáze 2+ feature. Basic linear extrapolation MVP for KPI projection; ML-based v3.0+.

### Q-ANL-008: Multi-touch attribution
**Otázka:** Currently last-click UTM. Multi-touch attribution model?

**Status:** Fáze 3+ feature. Schema-ready (multiple touchpoints stored in events).

### Q-ANL-009: Customer journey visualization
**Otázka:** Sankey diagram of customer paths (search → product → cart → ...)?

**Status:** Fáze 2+ visualization feature.

### Q-ANL-010: Plugin custom events
**Otázka:** Plugins can emit custom events with own kind names?

**Status:** Yes, supported via `event_kind='custom'` + `properties.custom_kind`. Detail v `28-developer-platform.md`.

### Q-ANL-011: Aggregate benchmarks (industry comparison)
**Otázka:** "Your conversion rate vs CZ e-commerce average" — needs aggregate across tenants.

**Status:** Fáze 3+. Strict anonymization; opt-in per tenant to contribute data.

### Q-ANL-012: GDPR-compliant tracking without consent
**Otázka:** What can we track without explicit consent?

**Status:** Server-side events (orders, etc.) with anonymized hash — yes. Client-side events with consent_analytics=false — limited to aggregates without identity linking. Documented.

### Q-ANL-013: External CDP integration
**Otázka:** Segment.io / RudderStack / mParticle integration?

**Status:** Fáze 2+ via plugin marketplace.

### Q-ANL-014: Profit margin tracking
**Otázka:** Requires cost data per item; cross-ref `09-inventory.md` cost_amount.

**Status:** v1.0+ when cost data populated. Margin = revenue - cost - refunds.

### Q-ANL-015: Custom dashboards
**Otázka:** Drag-drop dashboard builder?

**Status:** Fáze 2+ feature. MVP: standard dashboards + custom reports list.

---

## 📅 Změny

| Datum | Změna |
|---|---|
| 2026-05-20 | Initial — Analytics & Reporting domain. Event collection, daily/product/customer rollups, RFM, funnel, cohort, custom reports, scheduled delivery, KPI goals, A/B experiments (Fáze 2+), ETL exports (Fáze 2+). |

---

**Konec Analytics & Reporting.**

➡️ Pokračovat na: [`21-b2b-complete.md`](21-b2b-complete.md)
