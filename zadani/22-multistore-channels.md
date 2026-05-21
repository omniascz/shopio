# 22 – MULTI-STORE & CHANNELS

> **Doména:** Tenant operates multiple **stores** (storefronts s vlastním brandem + doménou) a multiple **channels** (web, POS, mobile app, marketplace, agent, B2B portal). Shared catalog + customer database, but per-channel overrides: pricing, inventory allocation, shipping methods, payment methods, catalog visibility, themes, locale defaults, tax behavior.

**Datum:** 2026-05-20
**Verze:** 1.0
**Status:** 🟡 DESIGN (multi-channel runtime in MVP; multi-store activation v1.0+)
**Reference:** [03 §14](03-data-models-master.md#14-multistore--channels) · [06-catalog-pim.md](06-catalog-pim.md) · [09-inventory.md](09-inventory.md) · [10-pricing-promotions.md](10-pricing-promotions.md) · [26-themes-storefront.md](26-themes-storefront.md)

---

## 📑 Obsah

0. [Domain overview](#0-domain-overview)
1. [References](#1-references)
2. [Personas](#2-personas)
3. [Data models](#3-data-models)
4. [Channel routing](#4-channel-routing)
5. [Multi-store architecture](#5-multi-store-architecture)
6. [State machines](#6-state-machines)
7. [Business rules](#7-business-rules)
8. [REST API endpoints](#8-rest-api-endpoints)
9. [GraphQL schema](#9-graphql-schema)
10. [Events](#10-events)
11. [Background jobs](#11-background-jobs)
12. [UI/UX flows](#12-uiux-flows)
13. [Edge cases & error handling](#13-edge-cases--error-handling)
14. [Performance](#14-performance)
15. [Security](#15-security)
16. [Testing](#16-testing)
17. [Implementation checklist](#17-implementation-checklist)
18. [Open questions](#18-open-questions)

---

## 0. Domain overview

### 0.1 Co tato doména **je**

- **Channels** — sales channel types: `web`, `pos`, `mobile_app`, `marketplace`, `agent`, `b2b_portal`. Tenant config of which channels are enabled.
- **Stores** — multiple storefronts per tenant; each store has own brand, domain, default locale + currency, theme. Share catalog with tenant (or filtered subset).
- **Channel-specific config** — pricing (per-channel price lists), inventory allocation (caps per channel), shipping methods, payment methods, catalog visibility, theme, locale + currency
- **Cross-channel customers** — same customer across web + mobile + POS unified profile
- **Channel attribution** — every cart, order, customer tagged with `channel_id`
- **Headless commerce** — Storefront API accessible to custom frontends (not bound to bundled Next.js theme)
- **POS-as-channel** (Fáze 2+) — terminal-aware behavior (cash drawer, instant receipt, in-store pickup)
- **Marketplace as channel** (Fáze 4) — products exposed to multi-vendor marketplace context
- **Agent as channel** — MCP agent transactions categorized separately for analytics + risk
- **Per-channel webhooks** — different downstream systems per channel
- **Channel cutoff times** — order cut-off per channel for fulfillment SLAs
- **Channel-specific shipping/payment routing** — different carriers/providers per channel

### 0.2 Co tato doména **NENÍ**

- ❌ Theme content + design system (→ `26-themes-storefront.md`)
- ❌ Per-channel marketing automation (→ `19-marketing-seo.md`)
- ❌ POS hardware integration internals (→ Fáze 2+ separate doc; we provide channel framework)
- ❌ Marketplace seller multi-vendor mechanics (→ `25-marketplace.md` Fáze 4)
- ❌ Locale + currency translation logic (→ `23-i18n.md`)
- ❌ Per-channel customer auth (always uses unified per-tenant customers — channel is just context)
- ❌ Tax engine internals (→ `15-tax-compliance.md`)
- ❌ Inventory engine internals (→ `09-inventory.md`)
- ❌ Cloud SaaS multi-tenancy (different concept — `DEC-ARCH-004` for `tenant_id`)

### 0.3 Diferenciátory

1. **Single codebase, multiple frontends** ([DEC-ARCH-001](01-decisions-registry.md#dec-arch-001)) — bundled Next.js theme + headless API option side-by-side
2. **Channel = first-class identity** — orders, carts, customers tagged for analytics + behavior fork
3. **Agent channel native** — AI agents distinguished from human users (rate limits, fraud signals)
4. **Multi-store with shared catalog** — one product master, multiple branded storefronts
5. **POS-ready architecture** — schema supports POS workflows from day 1, full activation Fáze 2
6. **Channel-specific compliance** — different tax rules per channel possible (e.g., wholesale vs retail)
7. **Per-store domain mapping** — each store on own domain (custom or shopio.shop subdomain)

---

## 1. References

- [03 §14](03-data-models-master.md#14-multistore--channels) — ENT-CHANNEL-001, ENT-STORE-001
- [06-catalog-pim.md](06-catalog-pim.md) — catalog shared, per-channel filtering
- [07-categories-taxonomy.md](07-categories-taxonomy.md) — categories visible across channels
- [09-inventory.md](09-inventory.md) — channel stock overrides
- [10-pricing-promotions.md](10-pricing-promotions.md) — per-channel price lists
- [12-checkout.md](12-checkout.md) — channel-aware checkout
- [13-payments.md](13-payments.md) — per-channel payment methods
- [14-shipping.md](14-shipping.md) — per-channel shipping methods
- [15-tax-compliance.md](15-tax-compliance.md) — per-channel tax (rare)
- [16-order-management.md](16-order-management.md) — order.channel_id
- [18-customer-management.md](18-customer-management.md) — customers unified across channels
- [19-marketing-seo.md](19-marketing-seo.md) — per-channel marketing
- [20-analytics-reporting.md](20-analytics-reporting.md) — channel slicing
- [23-i18n.md](23-i18n.md) — per-channel locales
- [26-themes-storefront.md](26-themes-storefront.md) — themes per store
- [28-developer-platform.md](28-developer-platform.md) — Storefront API for headless
- [29-integrations.md](29-integrations.md) — POS hardware, marketplace integrations
- [25-marketplace.md](25-marketplace.md) — marketplace as channel
- [33-ai-features.md](33-ai-features.md) — agent channel routing
- [DEC-ARCH-001](01-decisions-registry.md#dec-arch-001-single-codebase-vs-separate-products) — single codebase

---

## 2. Personas

| Persona | Použití | Klíčové permissions |
|---|---|---|
| `PERSONA-MERCHANT-OWNER` | Configure channels + stores | `PERM-CHANNEL-*`, `PERM-STORE-*` |
| `PERSONA-CHANNEL-MANAGER` (e.g., dedicated POS manager) | Manage specific channel config | `PERM-CHANNEL-MANAGE` (scoped) |
| `PERSONA-STORE-MANAGER` | Per-store branding + content | `PERM-STORE-MANAGE` (specific store) |
| `PERSONA-POS-OPERATOR` | Use POS channel at terminal | `PERM-CHANNEL-POS-OPERATE` |
| `PERSONA-CUSTOMER-SERVICE` | View orders across channels | `PERM-ORDER-VIEW` (filtered by channel) |
| `PERSONA-MARKETING-MANAGER` | Per-channel campaigns + analytics | `PERM-MARKETING-CAMPAIGN-*`, channel-scoped |
| `PERSONA-CUSTOMER` | Browse + buy on any channel (unified profile) | None explicit |
| `PERSONA-AI-COPILOT` | Suggest channel-specific optimizations | `agent:channel:read` |
| `PERSONA-EXTERNAL-AGENT` | Agent channel transactions | `agent:channel:transact` (agent channel) |
| `PERSONA-DEVELOPER-INTEGRATOR` | Headless storefront via Storefront API | API key with channel scope |

---

## 3. Data models

### 3.1 `channels` ([ENT-CHANNEL-001](03-data-models-master.md#ent-channel-001))

```sql
CREATE TABLE channels (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  pub_id TEXT NOT NULL,                                                                            -- chn_ NanoID
  code TEXT NOT NULL,                                                                              -- 'web','pos','mobile_app','heureka','meta_shop','agent','b2b_portal'
  name TEXT NOT NULL,                                                                              -- "Main webshop", "POS Praha 1", "Mobile App"
  kind TEXT NOT NULL CHECK (kind IN ('web','pos','mobile_app','marketplace','agent','b2b_portal','wholesale','social_commerce','print_catalog','phone_order','custom')) DEFAULT 'web',
  -- defaults
  default_locale TEXT NOT NULL,
  default_currency CHAR(3) NOT NULL,
  default_country_code CHAR(2) NULL,
  -- behavior
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_storefront_visible BOOLEAN NOT NULL DEFAULT true,                                               -- false = backend-only (agent, marketplace push)
  is_b2b_only BOOLEAN NOT NULL DEFAULT false,
  requires_authentication BOOLEAN NOT NULL DEFAULT false,                                            -- e.g., B2B portal
  -- catalog filtering
  catalog_visibility_kind TEXT NOT NULL CHECK (catalog_visibility_kind IN ('full','catalog_id','custom_filter','tag_only')) DEFAULT 'full',
  visible_category_ids UUID[] NULL,
  visible_collection_ids UUID[] NULL,
  visible_product_tags TEXT[] NULL,
  excluded_product_tags TEXT[] NULL,
  -- pricing
  primary_price_list_id UUID NULL REFERENCES price_lists(id),                                        -- channel-specific pricing
  allow_discount_codes BOOLEAN NOT NULL DEFAULT true,
  allow_loyalty_points BOOLEAN NOT NULL DEFAULT true,                                                -- Fáze 2+
  -- payment methods (allowed)
  allowed_payment_method_kinds TEXT[] NULL,                                                          -- ['card','bank_transfer'] or NULL = all
  default_payment_provider_code TEXT NULL,
  -- shipping
  allowed_shipping_method_ids UUID[] NULL,                                                            -- NULL = all
  default_shipping_method_id UUID NULL,
  cutoff_time TIME NULL,                                                                              -- same-day fulfillment cutoff
  cutoff_timezone TEXT NULL,
  -- tax behavior
  tax_inclusive_display BOOLEAN NOT NULL DEFAULT true,                                                -- B2C default true; B2B false
  -- attribution
  utm_source_default TEXT NULL,                                                                       -- auto-applied to traffic from this channel
  -- limits / quotas
  inventory_allocation_kind TEXT NOT NULL CHECK (inventory_allocation_kind IN ('shared','reserved','exclusive')) DEFAULT 'shared',
  -- 'shared' = all channels see full stock
  -- 'reserved' = some stock reserved per channel (see warehouse_stock_overrides)
  -- 'exclusive' = channel has dedicated warehouse(s)
  exclusive_warehouse_ids UUID[] NULL,                                                                -- pro 'exclusive'
  -- API access
  api_key_id UUID NULL REFERENCES api_keys(id),                                                       -- automation channels (agent, headless integrators)
  webhook_endpoint_url TEXT NULL,
  -- branding (light; full theming in stores)
  display_icon_media_id UUID NULL REFERENCES media(id),
  display_color TEXT NULL,                                                                             -- hex
  -- fraud / risk
  default_risk_score_modifier INTEGER NOT NULL DEFAULT 0,                                              -- e.g., agent channel +10, B2B -10
  -- analytics
  -- (everything tagged at event-time per `20-analytics-reporting.md`)
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user_id UUID NULL,
  version INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_channels_tenant_code UNIQUE (tenant_id, code),
  CONSTRAINT uq_channels_pub_id UNIQUE (tenant_id, pub_id)
);

CREATE INDEX idx_channels_active ON channels (tenant_id, kind) WHERE is_active = true;
CREATE INDEX idx_channels_b2b ON channels (tenant_id) WHERE is_b2b_only = true;
```

**Default channels seeded per tenant at onboarding:**
- `web` (kind='web', default for storefront traffic)
- `pos` (kind='pos', inactive by default; activate Fáze 2)
- `mobile_app` (kind='mobile_app', inactive; Fáze 4)
- `agent` (kind='agent', inactive by default)
- `b2b_portal` (kind='b2b_portal', activate when first B2B customer signs up)

### 3.2 `stores` ([ENT-STORE-001](03-data-models-master.md#ent-store-001))

```sql
CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  pub_id TEXT NOT NULL,                                                                              -- str_ NanoID
  code TEXT NOT NULL,                                                                                -- 'main', 'cz', 'de', 'outlet'
  name TEXT NOT NULL,                                                                                -- display
  -- domain
  primary_domain TEXT NOT NULL,                                                                      -- e.g., "shop.example.com" or "shop-de.example.com"
  alternative_domains TEXT[] NULL,                                                                    -- aliases (e.g., www / non-www)
  uses_shopio_subdomain BOOLEAN NOT NULL DEFAULT true,                                                -- shopio.shop subdomain or custom
  domain_verified_at TIMESTAMPTZ NULL,
  -- defaults
  default_locale TEXT NOT NULL,                                                                      -- BCP-47
  default_currency CHAR(3) NOT NULL,
  default_country_code CHAR(2) NULL,
  supported_locales TEXT[] NOT NULL DEFAULT '{}',                                                     -- multi-language store
  supported_currencies CHAR(3)[] NOT NULL DEFAULT '{}',
  -- theming
  theme_id UUID NULL,                                                                                  -- → themes (per `26-themes-storefront.md`)
  logo_media_id UUID NULL REFERENCES media(id),
  favicon_media_id UUID NULL REFERENCES media(id),
  default_og_image_media_id UUID NULL REFERENCES media(id),
  brand_color_primary TEXT NULL,
  brand_color_secondary TEXT NULL,
  -- channel binding
  default_channel_id UUID NOT NULL REFERENCES channels(id),                                            -- store maps to specific channel (usually 'web')
  -- catalog scope
  catalog_visibility_kind TEXT NOT NULL CHECK (catalog_visibility_kind IN ('full','catalog_id','custom_filter','tag_only')) DEFAULT 'full',
  visible_category_ids UUID[] NULL,
  visible_product_tags TEXT[] NULL,
  excluded_product_tags TEXT[] NULL,
  -- contact
  contact_email CITEXT NULL,
  contact_phone TEXT NULL,
  legal_entity_info JSONB NULL,                                                                       -- footer legal display
  -- SEO defaults
  default_meta_title TEXT NULL,
  default_meta_description TEXT NULL,
  -- status
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,                                                          -- 1 default per tenant
  is_maintenance_mode BOOLEAN NOT NULL DEFAULT false,
  maintenance_message_html TEXT NULL,
  password_protected BOOLEAN NOT NULL DEFAULT false,                                                  -- staging behind password
  access_password_hash TEXT NULL,
  -- analytics
  analytics_property_id TEXT NULL,                                                                     -- GA4 property
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user_id UUID NULL,
  version INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_stores_tenant_code UNIQUE (tenant_id, code),
  CONSTRAINT uq_stores_pub_id UNIQUE (tenant_id, pub_id),
  CONSTRAINT uq_stores_primary_domain UNIQUE (primary_domain) DEFERRABLE INITIALLY IMMEDIATE          -- globally unique
);

CREATE UNIQUE INDEX uq_stores_default ON stores (tenant_id) WHERE is_default = true;
CREATE INDEX idx_stores_active ON stores (tenant_id) WHERE is_active = true;
```

**Per-store seeded at tenant onboarding:** 1 default store with `code='main'`, `primary_domain=<tenant>.shopio.shop`.

### 3.3 `channel_stock_overrides` *(reused from `09`)*

Already defined in `09-inventory.md §3.6`. Recap:

```sql
-- channel_stock_overrides (variant_id, warehouse_id, channel_id, reserved_for_channel, max_per_channel)
-- Active when channel.inventory_allocation_kind='reserved'.
```

### 3.4 `channel_payment_methods`

Per-channel payment provider config (extends `13-payments.md` `payment_provider_configs`).

```sql
CREATE TABLE channel_payment_methods (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  payment_provider_code TEXT NOT NULL,                                                                 -- 'stripe','gopay','comgate',...
  payment_method_kind TEXT NOT NULL,                                                                   -- 'card','bank_transfer','apple_pay',...
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  display_position INTEGER NOT NULL DEFAULT 0,
  display_name_override TEXT NULL,                                                                     -- per-channel display label override
  min_amount BIGINT NULL,                                                                              -- minimum order amount to show method
  max_amount BIGINT NULL,
  min_amount_currency CHAR(3) NULL,
  required_role TEXT NULL,                                                                              -- e.g., method only for company.role='admin'
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_channel_payment_methods UNIQUE (channel_id, payment_provider_code, payment_method_kind)
);

CREATE INDEX idx_channel_payment_methods_enabled ON channel_payment_methods (channel_id) WHERE is_enabled = true;
```

### 3.5 `channel_shipping_methods`

Same pattern pro shipping (extends `14-shipping.md` `shipping_rates`).

```sql
CREATE TABLE channel_shipping_methods (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  shipping_rate_id UUID NOT NULL REFERENCES shipping_rates(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  display_position INTEGER NOT NULL DEFAULT 0,
  display_name_override TEXT NULL,
  channel_specific_amount BIGINT NULL,                                                                  -- override rate amount for this channel
  channel_specific_amount_currency CHAR(3) NULL,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_channel_shipping_methods UNIQUE (channel_id, shipping_rate_id)
);

CREATE INDEX idx_channel_shipping_methods_enabled ON channel_shipping_methods (channel_id) WHERE is_enabled = true;
```

### 3.6 `channel_settings`

Free-form per-channel feature toggles + config.

```sql
CREATE TABLE channel_settings (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  setting_key TEXT NOT NULL,
  setting_value JSONB NOT NULL,
  -- audit
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_channel_settings UNIQUE (channel_id, setting_key)
);

CREATE INDEX idx_channel_settings_channel ON channel_settings (channel_id);
```

Examples of setting_keys:
- `checkout.allow_guest=true`
- `checkout.require_phone=false`
- `cart.max_items=50`
- `reviews.enabled=true`
- `wishlist.enabled=true`
- `auto_email_order_confirmation=true`

### 3.7 `store_translations`

Per-store + per-locale content overrides (legal text, headers, footers).

```sql
CREATE TABLE store_translations (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  locale TEXT NOT NULL,
  field TEXT NOT NULL,                                                                                 -- e.g., 'name','meta_title','legal_footer'
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_store_translations UNIQUE (store_id, locale, field)
);

CREATE INDEX idx_store_translations_store_locale ON store_translations (store_id, locale);
```

### 3.8 `pos_terminals` *(Fáze 2+)*

POS hardware terminal registration.

```sql
CREATE TABLE pos_terminals (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  pub_id TEXT NOT NULL,
  channel_id UUID NOT NULL REFERENCES channels(id),                                                    -- POS channel
  store_id UUID NULL REFERENCES stores(id),
  warehouse_id UUID NULL REFERENCES warehouses(id),                                                    -- terminal's home stock
  code TEXT NOT NULL,                                                                                  -- 'POS-PRAHA-01'
  name TEXT NOT NULL,
  hardware_kind TEXT NULL,                                                                              -- 'tablet','kiosk','register','mobile_pos'
  current_operator_user_id UUID NULL REFERENCES users(id),
  current_session_started_at TIMESTAMPTZ NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_ping_at TIMESTAMPTZ NULL,
  ip_hash TEXT NULL,                                                                                    -- detect terminal location
  -- cash drawer
  cash_drawer_open_balance BIGINT NOT NULL DEFAULT 0,
  cash_drawer_currency CHAR(3) NULL,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_pos_terminals_code UNIQUE (tenant_id, code),
  CONSTRAINT uq_pos_terminals_pub_id UNIQUE (tenant_id, pub_id)
);

CREATE INDEX idx_pos_terminals_channel ON pos_terminals (channel_id) WHERE is_active = true;
```

### 3.9 `pos_sessions` *(Fáze 2+)*

POS staff shift sessions.

```sql
CREATE TABLE pos_sessions (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  terminal_id UUID NOT NULL REFERENCES pos_terminals(id),
  operator_user_id UUID NOT NULL REFERENCES users(id),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ NULL,
  opening_cash_amount BIGINT NULL,
  closing_cash_amount BIGINT NULL,
  expected_cash_amount BIGINT NULL,                                                                      -- computed from sales
  cash_variance_amount BIGINT NULL,                                                                      -- expected - closing
  currency CHAR(3) NOT NULL,
  orders_count INTEGER NOT NULL DEFAULT 0,
  total_sales_amount BIGINT NOT NULL DEFAULT 0,
  total_refunds_amount BIGINT NOT NULL DEFAULT 0,
  notes TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
) PARTITION BY RANGE (opened_at);

CREATE INDEX idx_pos_sessions_terminal ON pos_sessions (terminal_id, opened_at DESC);
CREATE INDEX idx_pos_sessions_open ON pos_sessions (tenant_id) WHERE closed_at IS NULL;
```

### 3.10 `domain_redirects`

Custom domain → store routing.

```sql
CREATE TABLE domain_redirects (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  source_domain TEXT NOT NULL,                                                                          -- e.g., "old-shop.com"
  target_store_id UUID NOT NULL REFERENCES stores(id),
  preserve_path BOOLEAN NOT NULL DEFAULT true,
  status_code INTEGER NOT NULL DEFAULT 301 CHECK (status_code IN (301,302,308)),
  is_active BOOLEAN NOT NULL DEFAULT true,
  ssl_certificate_status TEXT NULL CHECK (ssl_certificate_status IN ('pending','issued','renewing','failed','expired') OR ssl_certificate_status IS NULL),
  ssl_certificate_provider TEXT NULL,                                                                   -- 'letsencrypt','cloudflare'
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_domain_redirects_source UNIQUE (source_domain) DEFERRABLE INITIALLY IMMEDIATE
);

CREATE INDEX idx_domain_redirects_target ON domain_redirects (target_store_id) WHERE is_active = true;
```

### 3.11 Vztahy

```
tenants (1)──(N) channels
tenants (1)──(N) stores
stores (N)──(1) channels                       [default_channel_id]
stores (1)──(0..1) themes                      [theme_id, from `26`]
channels (1)──(N) orders                       [order.channel_id]
channels (1)──(N) carts                        [cart.channel_id]
channels (1)──(N) customers                    [customer.signup_channel_id]
channels (1)──(N) channel_payment_methods
channels (1)──(N) channel_shipping_methods
channels (1)──(N) channel_settings
channels (0..1)──(N) pos_terminals             [POS channel]
pos_terminals (1)──(N) pos_sessions
pos_terminals (N)──(1) warehouses              [home stock]
stores (1)──(N) store_translations
domain_redirects (N)──(1) stores
```

---

## 4. Channel routing

### 4.1 How requests resolve to channel

```
Incoming request to API:
   1. Authorization header → API key has `channel_id` claim? → use that channel
   2. Else: cookie session has `channel_id`? → use it
   3. Else: request hostname matches `stores.primary_domain` → use store.default_channel_id
   4. Else: agent token claim `channel_id='agent'` → agent channel
   5. Else: explicit `X-Shopio-Channel: pos` header (admin/staff)
   6. Else: default web channel for tenant
```

Channel context attached to request `ctx.channel_id`. All downstream services see it.

### 4.2 Headless API requests

API key has `channel_id` claim:
- Storefront API for custom frontend: API key tied to specific channel
- Different channels for different headless frontends (e.g., separate channels for staging vs prod, web vs mobile)

### 4.3 Per-channel filter (catalog visibility)

Product list endpoint applies:
- `channels.visible_category_ids` filter if set
- `channels.visible_product_tags` filter if set
- `channels.excluded_product_tags` filter if set
- `products.metadata.b2b_only=true` excluded from non-B2B channels

Resolution chain:
```
visible products = (catalog × channel filters × store filters × company contract filters [if B2B] × tenant's active products)
```

### 4.4 Per-channel pricing

Pricing engine (per `10`) input includes `channel_id`. Lookup:
- `channels.primary_price_list_id` → primary price list for channel
- Fallback chain per `10 RULE-PRICING-001`

### 4.5 Per-channel inventory

Per `09-inventory.md`:
- `inventory_allocation_kind='shared'`: same stock visible to all channels (default)
- `'reserved'`: `channel_stock_overrides` defines per-channel caps
- `'exclusive'`: only `channels.exclusive_warehouse_ids` count toward channel stock

Stock visibility on PDP:
- Anonymous storefront (channel='web'): show aggregate of all warehouses minus reserved-for-other-channels
- POS terminal: show only terminal's warehouse stock (in-store availability)

### 4.6 Per-channel checkout

Checkout flow per `12-checkout.md` adapts:
- POS: minimal flow (no email required, optional customer link, immediate payment)
- B2B portal: extended flow (PO field, NET terms)
- Agent: scoped flow (limited to agent's allowed actions)
- Web/Mobile App: standard

### 4.7 Per-channel webhooks

Channel-specific webhook destinations:
- Marketplace channel → push order to marketplace platform
- POS channel → push to POS analytics
- Agent channel → push to agent operator notification

Configured in `channel_settings` with key `webhook.<event_kind>`.

---

## 5. Multi-store architecture

### 5.1 Why multi-store?

Common use cases:
- **Brand split** — different brands sharing back-office (e.g., parent company runs both "Shop CZ" and "Shop SK")
- **Geographic** — separate domains per country with different language/currency defaults (shop.cz, shop.de)
- **B2B vs B2C** — separate storefronts but unified catalog
- **Outlet store** — separate URL for discount-only products
- **White-label** — multiple partners' storefronts on shared platform

### 5.2 Store vs Channel

| Concept | Scope | Example |
|---|---|---|
| **Tenant** | Top-level merchant account | "Acme Inc." |
| **Store** | Branded storefront with domain | "Acme CZ" (shop.acme.cz), "Acme DE" (shop.acme.de) |
| **Channel** | Sales channel type | web, POS, mobile app |

One tenant can have multiple stores, each on a channel. Default 1:1 (1 store on `web` channel). Advanced: 1 store accessible via multiple channels (web + mobile app).

### 5.3 Catalog sharing model

Tenant owns master catalog (`products`, `categories`, `collections`). Stores filter:
- Default: all active products visible
- Override: per-store catalog visibility filter

Same product can be:
- Visible on Store A (CZ), priced in CZK with CZ tax
- Visible on Store B (DE), priced in EUR with DE tax (via translations + price list)
- Hidden on Outlet store

### 5.4 Customer sharing

Customers are tenant-wide, not store-bound. Single profile, but per-store interaction history.

`customers.signup_channel_id` records origin store/channel. `orders.store_id` + `channel_id` for slicing.

### 5.5 Order numbering

Per-tenant gapless sequence (per `16-order-management.md`). Across all stores.

Alternative (configurable per tenant): per-store sequences (e.g., `ORD-CZ-2026-N`, `ORD-DE-2026-N`). Schema-ready via `tenant.settings.order_sequence_per_store=true`.

### 5.6 Domain management

Each store maps to primary domain + alternative aliases. SSL certificate management:
- Subdomain (shopio.shop): Let's Encrypt managed by platform
- Custom domain: DNS verification + Let's Encrypt OR Cloudflare-issued
- Setup wizard in admin: verify ownership via DNS TXT or HTTP file

`JOB-VERIFY-DOMAIN-DNS` checks ownership; `JOB-RENEW-SSL` keeps cert fresh.

### 5.7 Default store fallback

Tenant has exactly 1 `is_default=true` store. Requests not matching any store's domain → routed to default. Useful pro:
- Catch-all subdomain
- Initial onboarding when no custom domain configured

---

## 6. State machines

### 6.1 Channel lifecycle

```
[inactive] → [active] → [inactive] (toggle)
```

Simple toggle; no complex lifecycle. Activation may require provisioning (e.g., POS terminal setup, mobile app build).

### 6.2 Store lifecycle

```
[draft] → [active] → [maintenance_mode] → [active]
              │
              └→ [archived] (admin closes; preserved for historical orders)
```

Domain verification:
```
[domain_pending] → [domain_verified] → [ssl_pending] → [ssl_issued]
                                              │
                                              └→ [ssl_failed] → retry
```

### 6.3 POS session

```
[opened] → [active orders processed] → [closed]
                                            │
                                            └→ cash variance reconciled
```

---

## 7. Business rules

### RULE-CHN-001: Channel always set on transactional records

Every `cart`, `order`, `payment`, `shipment`, `analytics_event` MUST have `channel_id` (or NULL for genuinely channel-agnostic backend events).

Default: web channel if not explicitly determined.

### RULE-CHN-002: Single default store per tenant

Exactly 1 `stores.is_default=true` per tenant. Partial UNIQUE index enforced.

### RULE-CHN-003: Channel activation requires base config

Activating new channel requires:
- At least 1 payment method enabled
- At least 1 shipping method (or `requires_shipping=false` products only)
- Storefront URL accessible (for visible channels)

`POST /channels/{id}:activate` validates pre-conditions.

### RULE-CHN-004: B2B channel requires authentication

`channels.is_b2b_only=true OR kind='b2b_portal'`: anonymous access blocked. Customer must log in with company_member role.

### RULE-CHN-005: POS channel inventory exclusive to terminal warehouse

When POS terminal sells, inventory deducted from `pos_terminals.warehouse_id`. If terminal has no stock: warning shown (cannot complete sale OR backorder per merchant config).

### RULE-CHN-006: Per-channel cutoff time

`channels.cutoff_time` applies for fulfillment estimation (per `14-shipping.md` RULE-SHIP-027). Past cutoff → ship next business day.

### RULE-CHN-007: Channel-specific catalog visibility

Storefront product list applies `channels.catalog_visibility_kind` filter. Direct URL access also blocked if filter excludes product.

For headless API: same filter applied automatically via API key's channel scope.

### RULE-CHN-008: Channel attribution in UTM

Storefront traffic from channel auto-tagged:
- `utm_source = channels.utm_source_default OR channels.code`
- `utm_medium = channel.kind`

Customer's `signup_channel_id` records first-touch channel.

### RULE-CHN-009: Single customer profile across channels

Customer with `customer_id=X` is same person regardless of channel they shop on. Orders aggregated. Address book shared. Preferences shared.

Exception: per-channel preferences in `customer.preferences.channel_overrides` JSONB if customer wants.

### RULE-CHN-010: Channel-specific notifications

Email templates can vary per channel (per `19-marketing-seo.md`):
- Order confirmation from `web` channel uses tenant's default template
- POS receipt is different format (printed at terminal, possibly emailed)
- B2B confirmation includes PO + NET terms

`channel_settings.notification_template_overrides` JSON.

### RULE-CHN-011: Per-store domain uniqueness

`stores.primary_domain` globally unique across all tenants. Prevents multi-tenant domain hijack.

`stores.alternative_domains` array also enforced globally (each entry must not appear elsewhere).

### RULE-CHN-012: Maintenance mode

`stores.is_maintenance_mode=true`: storefront returns 503 with `maintenance_message_html`. Admin + staff can still access (cookie bypass).

Useful for theme deployments, planned downtime.

### RULE-CHN-013: Password-protected staging

`stores.password_protected=true`: requires password gate before storefront access. Hash stored. Used for staging stores not yet public.

### RULE-CHN-014: POS session balancing

End-of-shift POS session close:
- Operator counts cash drawer
- `closing_cash_amount` recorded
- `expected_cash_amount` computed from sales (opening + cash sales - cash refunds)
- `cash_variance_amount = expected - closing`
- Variance > threshold → alert manager

### RULE-CHN-015: POS sale fast path

POS checkout skips:
- Email confirmation (optional)
- Shipping selection (in-store pickup default)
- Multi-step flow (single page)

Payment immediate (cash, card via terminal).

### RULE-CHN-016: Cross-channel order continuation

Customer started cart on web, finishes on mobile:
- Cart loaded by customer_id (per `11-cart.md`)
- New cart created for new channel BY DEFAULT (per `11-cart.md` RULE-CART-016)
- Tenant can override: `merge_carts_across_channels=true` setting

### RULE-CHN-017: Per-channel rate limits

Storefront API rate limits per channel (heavier for headless integrators, lighter for agent):

| Channel kind | Default rate limit |
|---|---|
| web | per `04 §13` (storefront baseline) |
| pos | 6000/min per terminal |
| mobile_app | 1500/min per session |
| agent | 60/min per agent token (strict) |
| b2b_portal | 1500/min per session |
| marketplace | per integration |

### RULE-CHN-018: Channel-specific tax behavior

`channels.tax_inclusive_display=false`: net prices shown (common B2B). Engine still computes tax for invoicing.

Per-channel `tax_class_override`: rare scenario where same product has different tax class per channel (e.g., wholesale tax-exempt).

### RULE-CHN-019: Per-channel SEO

Per `19-marketing-seo.md`:
- Sitemap per (channel, locale)
- Robots.txt per channel (different policies, e.g., agent channel may have permissive llms.txt)
- JSON-LD per channel context

### RULE-CHN-020: Marketplace channel push

Marketplace channels (Heuréka, Google Shopping, Meta) receive product feed (per `19-marketing-seo.md social_product_feeds`). Orders placed on marketplace may push back to us via integration plugin.

### RULE-CHN-021: Agent channel hardening

`channels.kind='agent'`:
- All requests require `agent_token` (per `30-security.md`)
- Stricter rate limits (RULE-CHN-017)
- Audit 100%
- Spending limits per agent_token enforced
- Higher fraud signal weight

### RULE-CHN-022: Per-channel return policy

Channel-specific return policies override default (per `17-returns-refunds.md`):
- POS: usually stricter (no return window, in-store only)
- B2B: per contract
- Marketplace: marketplace policy

Stored in `channel_settings.return_policy_id` referencing `return_policies`.

### RULE-CHN-023: Headless storefront tracking

Custom frontend (headless) uses Storefront API with API key. Same Analytics events expected; backend tracks via `ingest_source='backend_server'` for transactional events, `ingest_source='storefront_client'` for tracked events.

### RULE-CHN-024: Multi-currency per store

Store with `supported_currencies=['CZK','EUR','USD']` lets customer switch:
- Cart re-prices via exchange_rates (per `11-cart.md` RULE-CART-009)
- Final order in chosen currency
- Reporting normalizes to tenant default currency (per `20-analytics-reporting.md`)

### RULE-CHN-025: Domain SSL renewal

`JOB-RENEW-SSL` runs daily, renews certs 30 days before expiry. Let's Encrypt rate limits respected.

Failure → admin alert. Manual override option.

### RULE-CHN-026: Per-channel webhook subscriptions

Channel may have its own webhook subscriptions (per `28-developer-platform.md`):
- Marketplace channel → webhook to marketplace platform for stock updates
- POS channel → webhook to POS analytics service

### RULE-CHN-027: Per-channel risk score modifier

`channels.default_risk_score_modifier`:
- Agent channel: +10 (slightly riskier — automated, less predictable)
- B2B portal: -10 (authenticated, vetted companies)
- POS: -20 (in-person, low fraud risk)
- Web anonymous: 0 baseline

Added to per-customer risk score by fraud engine (per `30-security.md`).

### RULE-CHN-028: Channel-specific currencies enforcement

Order placed on channel MUST be in one of channel's supported currencies. Storefront UI selector filters accordingly.

Anomaly: API direct attempt with invalid currency → reject 422.

### RULE-CHN-029: Cross-store customer login

Customer logged in on Store A can also access Store B if they share tenant (single sign-on across stores). Session valid for entire tenant.

Configurable per tenant `tenant.settings.cross_store_sso=true` (default true).

### RULE-CHN-030: Per-channel locale fallback

Channel default_locale used when:
- Request has no `Accept-Language` header
- Customer has no locale preference

Store's locale chain (`supported_locales`) further constrains.

### RULE-CHN-031: POS terminal warehouse stock priority

When POS sells, allocation order:
1. Terminal's `warehouse_id` (preferred)
2. Other warehouses in same channel's `exclusive_warehouse_ids`
3. Tenant-default warehouse (fallback)

`channels.inventory_allocation_kind='exclusive'` enforces strict step 1+2 only.

### RULE-CHN-032: Channel deactivation grace

`channels.is_active=false`:
- New orders rejected
- Existing pending orders complete normally
- After 30 days: archive (still queryable for historical orders)

---

## 8. REST API endpoints

### 8.1 Channels

```
GET    /api/{date}/channels
POST   /api/{date}/channels
GET    /api/{date}/channels/{id}
PATCH  /api/{date}/channels/{id}
DELETE /api/{date}/channels/{id}                                                            # soft delete
POST   /api/{date}/channels/{id}:activate
POST   /api/{date}/channels/{id}:deactivate
GET    /api/{date}/channels/{id}/payment-methods
POST   /api/{date}/channels/{id}/payment-methods                                            # add
PATCH  /api/{date}/channels/{id}/payment-methods/{id}
DELETE /api/{date}/channels/{id}/payment-methods/{id}
GET    /api/{date}/channels/{id}/shipping-methods
POST   /api/{date}/channels/{id}/shipping-methods
PATCH  /api/{date}/channels/{id}/shipping-methods/{id}
DELETE /api/{date}/channels/{id}/shipping-methods/{id}
GET    /api/{date}/channels/{id}/settings
PATCH  /api/{date}/channels/{id}/settings                                                    # bulk update
GET    /api/{date}/channels/{id}/analytics                                                   # cross-ref `20`
```

### 8.2 Stores

```
GET    /api/{date}/stores
POST   /api/{date}/stores
GET    /api/{date}/stores/{id}
PATCH  /api/{date}/stores/{id}
DELETE /api/{date}/stores/{id}
POST   /api/{date}/stores/{id}:activate
POST   /api/{date}/stores/{id}:deactivate
POST   /api/{date}/stores/{id}:enter-maintenance-mode
POST   /api/{date}/stores/{id}:exit-maintenance-mode
POST   /api/{date}/stores/{id}:set-default
GET    /api/{date}/stores/{id}/domains
POST   /api/{date}/stores/{id}/domains                                                       # add custom domain
POST   /api/{date}/stores/{id}/domains/{domain}:verify
POST   /api/{date}/stores/{id}/domains/{domain}:request-ssl
DELETE /api/{date}/stores/{id}/domains/{domain}
GET    /api/{date}/stores/{id}/translations
PATCH  /api/{date}/stores/{id}/translations                                                  # bulk update
POST   /api/{date}/stores/{id}:set-password-protection
DELETE /api/{date}/stores/{id}:remove-password-protection
GET    /api/{date}/stores/{id}/analytics                                                     # cross-ref `20`
```

### 8.3 POS-specific (Fáze 2+)

```
GET    /api/{date}/pos/terminals
POST   /api/{date}/pos/terminals
GET    /api/{date}/pos/terminals/{id}
PATCH  /api/{date}/pos/terminals/{id}
DELETE /api/{date}/pos/terminals/{id}

POST   /api/{date}/pos/sessions:open                                                          # operator starts shift
POST   /api/{date}/pos/sessions/{id}:close                                                    # end shift + reconcile
GET    /api/{date}/pos/sessions
GET    /api/{date}/pos/sessions/{id}
GET    /api/{date}/pos/terminals/{id}/sales-today
GET    /api/{date}/pos/terminals/{id}/cash-drawer-balance
POST   /api/{date}/pos/terminals/{id}/cash-drawer:adjust                                       # add/remove cash (open/close)
```

### 8.4 Domain redirects

```
GET    /api/{date}/domain-redirects
POST   /api/{date}/domain-redirects
GET    /api/{date}/domain-redirects/{id}
DELETE /api/{date}/domain-redirects/{id}
```

### 8.5 Storefront API (headless)

```
GET    /api/{date}/storefront/channel                                                          # current channel info (resolved from request)
GET    /api/{date}/storefront/store                                                            # current store info
GET    /api/{date}/storefront/store/settings                                                   # public settings
GET    /api/{date}/storefront/store/branding                                                   # logo, colors, etc.
```

### 8.6 Example: Create channel

```http
POST /api/2026-05-20/channels HTTP/1.1
Authorization: Bearer ...

{
  "code": "heureka_feed",
  "name": "Heuréka katalog",
  "kind": "marketplace",
  "default_locale": "cs-CZ",
  "default_currency": "CZK",
  "is_storefront_visible": false,
  "primary_price_list_id": "prc_heureka",
  "utm_source_default": "heureka",
  "inventory_allocation_kind": "shared"
}
```

```jsonc
HTTP/1.1 201 Created

{
  "data": {
    "id": "...",
    "pub_id": "chn_aB",
    "type": "channel",
    "attributes": {
      "code": "heureka_feed",
      "kind": "marketplace",
      "is_active": true,
      "is_storefront_visible": false
    },
    "next_step": "Configure payment + shipping methods if customer-facing OR product feed (`19-marketing-seo.md`)"
  }
}
```

### 8.7 Example: Add custom domain to store

```http
POST /api/2026-05-20/stores/str_aB/domains HTTP/1.1

{
  "domain": "shop.example.com",
  "request_ssl": true
}
```

```jsonc
HTTP/1.1 202 Accepted

{
  "data": {
    "domain": "shop.example.com",
    "verification_required": true,
    "verification_record": {
      "kind": "TXT",
      "name": "_shopio-verify.shop.example.com",
      "value": "shopio-verify=abc123xyz"
    },
    "next_step": "Add TXT record to your DNS. We'll auto-verify within 1 hour."
  }
}
```

### 8.8 Example: Get current channel + store (storefront)

```http
GET /api/2026-05-20/storefront/store HTTP/1.1
Host: shop.example.com
Accept-Language: cs-CZ
```

```jsonc
HTTP/1.1 200 OK
Cache-Control: public, max-age=300

{
  "data": {
    "store": {
      "id": "str_aB",
      "name": "Shop Example",
      "primary_domain": "shop.example.com",
      "default_locale": "cs-CZ",
      "default_currency": "CZK",
      "supported_locales": ["cs-CZ", "en-US"],
      "supported_currencies": ["CZK", "EUR"],
      "logo_url": "https://cdn.shopio.com/...",
      "brand_color_primary": "#FF6B35",
      "theme_id": "thm_default",
      "contact_email": "info@shop.example.com"
    },
    "channel": {
      "id": "chn_web",
      "code": "web",
      "kind": "web",
      "default_locale": "cs-CZ",
      "default_currency": "CZK",
      "allow_discount_codes": true,
      "allowed_payment_method_kinds": ["card","bank_transfer","cod"]
    }
  }
}
```

---

## 9. GraphQL schema

```graphql
type Channel implements Node & Timestamped {
  id: ID!
  pubId: String!
  code: String!
  name: String!
  kind: ChannelKind!
  defaultLocale: String!
  defaultCurrency: String!
  defaultCountryCode: String
  isActive: Boolean!
  isStorefrontVisible: Boolean!
  isB2bOnly: Boolean!
  requiresAuthentication: Boolean!
  catalogVisibilityKind: CatalogVisibilityKind!
  visibleCategoryIds: [ID!]
  visibleProductTags: [String!]
  excludedProductTags: [String!]
  primaryPriceList: PriceList
  allowDiscountCodes: Boolean!
  allowedPaymentMethodKinds: [String!]
  allowedShippingMethods: [ShippingRate!]
  cutoffTime: String
  cutoffTimezone: String
  taxInclusiveDisplay: Boolean!
  utmSourceDefault: String
  inventoryAllocationKind: InventoryAllocationKind!
  exclusiveWarehouses: [Warehouse!]
  displayIcon: Media
  displayColor: String
  defaultRiskScoreModifier: Int!
  paymentMethods: [ChannelPaymentMethod!]!
  shippingMethods: [ChannelShippingMethod!]!
  settings: JSON!
  createdAt: DateTime!
  updatedAt: DateTime!
}

enum ChannelKind { WEB POS MOBILE_APP MARKETPLACE AGENT B2B_PORTAL WHOLESALE SOCIAL_COMMERCE PRINT_CATALOG PHONE_ORDER CUSTOM }
enum InventoryAllocationKind { SHARED RESERVED EXCLUSIVE }
enum CatalogVisibilityKind { FULL CATALOG_ID CUSTOM_FILTER TAG_ONLY }

type ChannelPaymentMethod {
  id: ID!
  channel: Channel!
  providerCode: String!
  methodKind: String!
  isEnabled: Boolean!
  displayPosition: Int!
  displayNameOverride: String
  minAmount: Money
  maxAmount: Money
}

type ChannelShippingMethod {
  id: ID!
  channel: Channel!
  shippingRate: ShippingRate!
  isEnabled: Boolean!
  displayPosition: Int!
  displayNameOverride: String
  channelSpecificAmount: Money
}

type Store implements Node & Timestamped {
  id: ID!
  pubId: String!
  code: String!
  name: String!
  primaryDomain: String!
  alternativeDomains: [String!]
  defaultLocale: String!
  defaultCurrency: String!
  defaultCountryCode: String
  supportedLocales: [String!]!
  supportedCurrencies: [String!]!
  theme: Theme
  logo: Media
  favicon: Media
  defaultOgImage: Media
  brandColorPrimary: String
  brandColorSecondary: String
  defaultChannel: Channel!
  catalogVisibilityKind: CatalogVisibilityKind!
  visibleCategoryIds: [ID!]
  visibleProductTags: [String!]
  contactEmail: String
  contactPhone: String
  legalEntityInfo: JSON
  defaultMetaTitle: String
  defaultMetaDescription: String
  isActive: Boolean!
  isDefault: Boolean!
  isMaintenanceMode: Boolean!
  maintenanceMessageHtml: String
  passwordProtected: Boolean!
  domainRedirects: [DomainRedirect!]!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type DomainRedirect {
  id: ID!
  sourceDomain: String!
  targetStore: Store!
  statusCode: Int!
  isActive: Boolean!
  sslCertificateStatus: SslCertificateStatus
}

enum SslCertificateStatus { PENDING ISSUED RENEWING FAILED EXPIRED }

type PosTerminal implements Node {
  id: ID!
  pubId: String!
  code: String!
  name: String!
  channel: Channel!
  store: Store
  warehouse: Warehouse
  hardwareKind: String
  currentOperator: User
  currentSessionStartedAt: DateTime
  isActive: Boolean!
  lastPingAt: DateTime
}

type PosSession {
  id: ID!
  terminal: PosTerminal!
  operator: User!
  openedAt: DateTime!
  closedAt: DateTime
  openingCashAmount: Money
  closingCashAmount: Money
  expectedCashAmount: Money
  cashVarianceAmount: Money
  ordersCount: Int!
  totalSalesAmount: Money!
  totalRefundsAmount: Money!
}

extend type Query {
  channels(filter: ChannelFilter): [Channel!]! @auth(requires: PERM_CHANNEL_VIEW)
  channel(id: ID, code: String): Channel @auth(requires: PERM_CHANNEL_VIEW)
  currentChannel: Channel!                                                                       # storefront context

  stores(filter: StoreFilter): [Store!]! @auth(requires: PERM_STORE_VIEW)
  store(id: ID, code: String, domain: String): Store
  currentStore: Store!                                                                            # storefront context

  posTerminals: [PosTerminal!]! @auth(requires: PERM_CHANNEL_POS_MANAGE)
  posTerminal(id: ID, code: String): PosTerminal
  posSessions(terminalId: ID, openOnly: Boolean = false): [PosSession!]!

  domainRedirects: [DomainRedirect!]! @auth(requires: PERM_STORE_MANAGE)
}

extend type Mutation {
  createChannel(input: ChannelInput!): Channel! @auth(requires: PERM_CHANNEL_MANAGE)
  updateChannel(id: ID!, input: ChannelInput!): Channel! @auth(requires: PERM_CHANNEL_MANAGE)
  activateChannel(id: ID!): Channel! @auth(requires: PERM_CHANNEL_MANAGE)
  deactivateChannel(id: ID!): Channel! @auth(requires: PERM_CHANNEL_MANAGE)
  configureChannelPaymentMethods(channelId: ID!, methods: [ChannelPaymentMethodInput!]!): [ChannelPaymentMethod!]! @auth(requires: PERM_CHANNEL_MANAGE)
  configureChannelShippingMethods(channelId: ID!, methods: [ChannelShippingMethodInput!]!): [ChannelShippingMethod!]! @auth(requires: PERM_CHANNEL_MANAGE)
  updateChannelSettings(channelId: ID!, settings: JSON!): Channel! @auth(requires: PERM_CHANNEL_MANAGE)

  createStore(input: StoreInput!): Store! @auth(requires: PERM_STORE_MANAGE)
  updateStore(id: ID!, input: StoreInput!): Store! @auth(requires: PERM_STORE_MANAGE)
  activateStore(id: ID!): Store! @auth(requires: PERM_STORE_MANAGE)
  setDefaultStore(id: ID!): Store! @auth(requires: PERM_STORE_MANAGE)
  enterMaintenanceMode(storeId: ID!, message: String): Store! @auth(requires: PERM_STORE_MANAGE)
  exitMaintenanceMode(storeId: ID!): Store! @auth(requires: PERM_STORE_MANAGE)
  setStorePasswordProtection(storeId: ID!, password: String!): Store! @auth(requires: PERM_STORE_MANAGE)
  addStoreDomain(storeId: ID!, domain: String!): DomainVerificationResult! @auth(requires: PERM_STORE_MANAGE)
  verifyStoreDomain(storeId: ID!, domain: String!): Store! @auth(requires: PERM_STORE_MANAGE)
  requestSslCertificate(storeId: ID!, domain: String!): MutationPayload! @auth(requires: PERM_STORE_MANAGE)

  createPosTerminal(input: PosTerminalInput!): PosTerminal! @auth(requires: PERM_CHANNEL_POS_MANAGE)
  openPosSession(input: OpenPosSessionInput!): PosSession! @auth(requires: PERM_CHANNEL_POS_OPERATE)
  closePosSession(id: ID!, input: ClosePosSessionInput!): PosSession! @auth(requires: PERM_CHANNEL_POS_OPERATE)
}

type DomainVerificationResult {
  domain: String!
  verificationKind: String!
  verificationName: String!
  verificationValue: String!
}
```

---

## 10. Events

| Build-spec ID | Wire | Payload |
|---|---|---|
| `EVENT-CHANNEL-CREATED` | `channel.created` | `{ channel }` |
| `EVENT-CHANNEL-UPDATED` | `channel.updated` | `{ channel, previous_attributes }` |
| `EVENT-CHANNEL-ACTIVATED` | `channel.activated` | `{ channel }` |
| `EVENT-CHANNEL-DEACTIVATED` | `channel.deactivated` | `{ channel, reason }` |
| `EVENT-CHANNEL-SETTINGS-CHANGED` | `channel.settings_changed` | `{ channel, changed_keys }` |
| `EVENT-STORE-CREATED` | `store.created` | `{ store }` |
| `EVENT-STORE-UPDATED` | `store.updated` | `{ store, previous_attributes }` |
| `EVENT-STORE-DOMAIN-ADDED` | `store.domain_added` | `{ store, domain }` |
| `EVENT-STORE-DOMAIN-VERIFIED` | `store.domain_verified` | `{ store, domain }` |
| `EVENT-STORE-SSL-ISSUED` | `store.ssl_issued` | `{ store, domain, expires_at }` |
| `EVENT-STORE-SSL-EXPIRED` | `store.ssl_expired` | `{ store, domain }` |
| `EVENT-STORE-MAINTENANCE-MODE-ENTERED` | `store.maintenance_entered` | `{ store, message }` |
| `EVENT-STORE-MAINTENANCE-MODE-EXITED` | `store.maintenance_exited` | `{ store }` |
| `EVENT-POS-TERMINAL-REGISTERED` | `pos.terminal_registered` | `{ terminal }` |
| `EVENT-POS-SESSION-OPENED` | `pos.session_opened` | `{ session, terminal, operator }` |
| `EVENT-POS-SESSION-CLOSED` | `pos.session_closed` | `{ session, cash_variance }` |
| `EVENT-POS-CASH-VARIANCE-HIGH` | `pos.cash_variance_high` | `{ session, variance }` |
| `EVENT-DOMAIN-REDIRECT-HIT` | `domain.redirect_hit` | `{ source, target }` (sampled, analytics) |

**Konzumenti:**
- Analytics — per-channel slicing
- Storefront cache invalidator — store changes purge CDN
- Notification — channel admin alerts
- Webhook delivery

---

## 11. Background jobs

| Job | Trigger | Queue | Frequency |
|---|---|---|---|
| `JOB-VERIFY-DOMAIN-DNS` | EVENT-STORE-DOMAIN-ADDED | `domains` | Every 5 min until verified or 24h |
| `JOB-REQUEST-SSL-CERT` | EVENT-STORE-DOMAIN-VERIFIED | `domains` | On-demand |
| `JOB-RENEW-SSL` | scheduled | `domains` | Daily |
| `JOB-NOTIFY-SSL-EXPIRING` | scheduled | `notifications` | Daily |
| `JOB-RECONCILE-POS-CASH` | EVENT-POS-SESSION-CLOSED | `pos` | On-demand |
| `JOB-DETECT-INACTIVE-CHANNELS` | scheduled | `channels` | Weekly |
| `JOB-ARCHIVE-DEACTIVATED-CHANNELS` | scheduled | `maintenance` | Daily (>30d inactive) |
| `JOB-COMPUTE-CHANNEL-METRICS` | scheduled | `analytics` | Daily (cross-ref `20`) |
| `JOB-WARM-STOREFRONT-CACHE-PER-CHANNEL` | EVENT-STORE-UPDATED | `cache-warm` | On-demand |
| `JOB-PING-POS-TERMINALS` | scheduled | `pos` | Every 5 min (health check) |
| `JOB-COMPUTE-CHANNEL-INVENTORY-ALLOCATION` | EVENT-STOCK-LEVEL-CHANGED + reserved channels exist | `channels` | On-demand |

---

## 12. UI/UX flows

### FLOW-CHN-001: Create new channel

```
[Admin → Settings → Channels → New]
        │
        ▼
[Channel wizard]
   Step 1: Pick kind (web / POS / marketplace / agent / b2b portal / mobile app)
   Step 2: Name + code + locale + currency
   Step 3: Catalog visibility (full / filter by category / tags)
   Step 4: Pricing (link to price list)
   Step 5: Payment methods enabled
   Step 6: Shipping methods enabled
   Step 7: Review + Activate (or save as inactive)
        │
        ▼
[POST /channels → status='inactive'] (admin review)
[POST /channels/{id}:activate]
   - Validates pre-conditions
   - Status='active' → orders start flowing
```

### FLOW-CHN-002: Add custom domain to store

```
[Admin → Settings → Stores → {store} → Domains]
        │
   click "Add domain"
        │
        ▼
[Modal]
   - Domain input: "shop.example.com"
   - "Request SSL automatically" toggle
        │
   submit
        │
        ▼
[Domain verification screen]
   - Instructions for DNS TXT record
   - "Verify now" button (manual trigger)
   - Auto-check every 5 min
        │
   ... DNS propagates ...
        │
        ▼
[Verified → SSL certificate requested]
   - Let's Encrypt ACME challenge
   - Cert issued within minutes
        │
        ▼
[Store now accessible at https://shop.example.com]
```

### FLOW-CHN-003: POS sale (Fáze 2+)

```
[POS terminal operator login]
   - Open session (count cash drawer)
        │
        ▼
[POS UI: barcode scanner / product picker]
   - Add items
   - Apply discount (if permitted)
   - Customer linking (optional: phone number lookup)
        │
        ▼
[Tender payment]
   - Cash (counts change)
   - Card (terminal device)
   - Mixed
        │
        ▼
[Receipt printed]
   - Order created with channel=POS
   - Cash drawer updated
   - Stock decremented from terminal's warehouse
```

### FLOW-CHN-004: Multi-store dashboard

```
[Admin home]
   - Store selector dropdown ("All stores" or specific)
   - Metrics scoped to selection
        │
   click "All stores"
        │
        ▼
[Aggregated view]
   - Revenue per store comparison
   - Orders breakdown
   - Per-store health (active customers, conversion)
        │
   click a specific store
        │
        ▼
[Store-specific dashboard]
   - Filtered to that store's orders, customers, etc.
```

### FLOW-CHN-005: Headless integrator setup

```
[Admin → Developer Platform → API keys]
   - Create API key
   - Assign to channel (e.g., dedicated headless channel)
        │
        ▼
[API key created with channel claim]
   - Developer uses key in custom frontend
   - All requests automatically scoped to channel
   - Catalog, pricing, inventory filtered per channel rules
```

---

## 13. Edge cases & error handling

| Scenario | Behavior | Code |
|---|---|---|
| Activate channel without payment methods | Reject | `CHANNEL_NEEDS_PAYMENT_METHOD`, 422 |
| Activate channel without shipping (and has shippable products) | Reject | `CHANNEL_NEEDS_SHIPPING_METHOD`, 422 |
| Domain already used by another tenant's store | Reject | `DOMAIN_ALREADY_USED`, 409 |
| Customer hits domain not mapped | Fallback to default store OR 404 | (configurable) |
| Channel deactivated while orders pending | Pending orders complete; new rejected | `CHANNEL_INACTIVE`, 422 |
| Store maintenance mode hit by customer | 503 + maintenance_message_html | (handled) |
| Password-protected store no password | Show password form | (handled) |
| SSL cert renewal fails | Retry + admin alert | (handled) |
| POS session not closed before next shift | Warning; force close OR continue | (configurable) |
| POS cash drawer variance > threshold | Alert manager; require notes | (handled) |
| Channel catalog filter removes all products | Storefront shows empty state with admin note | (handled) |
| Multi-store customer logs in but session for different store | Cross-store SSO (default on) — single session works for both | (handled per RULE-CHN-029) |
| Headless API request without channel-scoped key | Defaults to tenant's web channel | (handled) |
| Marketplace push to deactivated channel | Buffer events; skip until channel reactivated | (handled) |
| Domain DNS TXT record propagation delay | Auto-retry every 5 min for 24h | (handled) |
| Concurrent store domain changes | Optimistic lock | `RESOURCE_VERSION_MISMATCH`, 412 |
| Channel currency switching mid-cart | Re-prices per `11`; warn customer | (handled) |
| POS terminal offline (no network) | Cache orders locally; sync when online (Fáze 2+) | (designed) |

---

## 14. Performance

### 14.1 Targets

| Operation | p50 | p95 | p99 |
|---|---|---|---|
| Channel resolution (per request) | 1 ms | 5 ms | 15 ms |
| Store resolution by domain | 1 ms | 5 ms | 15 ms |
| Storefront `/storefront/store` (cached) | 5 ms | 15 ms | 40 ms |
| `GET /channels` (admin list) | 15 ms | 50 ms | 120 ms |
| Domain DNS verification check | 100 ms | 500 ms | 2000 ms |
| SSL cert issuance (Let's Encrypt) | 30 s | 90 s | 180 s |
| POS terminal heartbeat | 5 ms | 20 ms | 60 ms |

### 14.2 Optimization

- Channel + store config cached aggressively (Redis 60s TTL; event-invalidated)
- Domain → store lookup cached (rare changes; 5 min TTL)
- POS terminal config cached per terminal (rare changes)
- DataLoader v GraphQL pro batched channel queries

### 14.3 Hot path

```sql
-- Resolve store by domain
SELECT * FROM stores
WHERE primary_domain = $1 OR $1 = ANY(alternative_domains)
  AND is_active = true
LIMIT 1;
-- Uses uq_stores_primary_domain + GIN index on alternative_domains
```

---

## 15. Security

### 15.1 Permissions

```
PERM-CHANNEL-VIEW
PERM-CHANNEL-MANAGE
PERM-CHANNEL-POS-OPERATE
PERM-CHANNEL-POS-MANAGE
PERM-STORE-VIEW
PERM-STORE-MANAGE
PERM-DOMAIN-MANAGE
```

### 15.2 Domain hijack prevention

- Globally unique domain registration (per RULE-CHN-011)
- DNS TXT verification required before activation
- Audit log on domain add/remove
- Tenant cannot claim subdomain of other tenant

### 15.3 POS hardening

- POS terminal registered with hardware fingerprint (Fáze 2+)
- Operator authentication required per session
- Session-bound operator role
- Cash drawer audit (every action logged)

### 15.4 Audit

100% audit on:
- Channel create/activate/deactivate
- Store create/activate/maintenance/password change
- Domain add/verify/SSL request
- POS session open/close
- Cash drawer adjustments

---

## 16. Testing

### 16.1 Unit

```
TEST-UNIT-CHN-001  ChannelResolver — request → channel determination
TEST-UNIT-CHN-002  StoreResolver — domain → store
TEST-UNIT-CHN-003  CatalogVisibilityFilter
TEST-UNIT-CHN-004  PaymentMethodResolver per channel
TEST-UNIT-CHN-005  ShippingMethodResolver per channel
TEST-UNIT-CHN-006  PosSessionBalancer (cash variance computation)
TEST-UNIT-CHN-007  DomainVerifier
TEST-UNIT-CHN-008  ChannelInventoryAllocator
```

### 16.2 Integration

```
TEST-INT-CHN-001  Request to domain → resolves to correct store + channel
TEST-INT-CHN-002  Activate channel → validation pre-conditions
TEST-INT-CHN-003  Order placed on POS → stock from terminal warehouse
TEST-INT-CHN-004  Per-channel pricing applied
TEST-INT-CHN-005  Catalog filter excludes hidden products on channel
TEST-INT-CHN-006  Multi-store customer login (cross-store SSO)
TEST-INT-CHN-007  Domain verification + SSL flow
TEST-INT-CHN-008  Store maintenance mode 503
TEST-INT-CHN-009  Password-protected store blocks anonymous
TEST-INT-CHN-010  POS session open + close + cash balance
TEST-INT-CHN-011  Channel deactivation rejects new orders
TEST-INT-CHN-012  Concurrent store edits — optimistic lock
TEST-INT-CHN-013  Marketplace channel push to product feed
TEST-INT-CHN-014  Agent channel rate limit + audit
TEST-INT-CHN-015  Channel-specific webhook delivery
```

### 16.3 E2E

```
TEST-E2E-CHN-001  Customer browses on shop-cz.com (Czech) → switches to shop-de.com (German) — separate stores
TEST-E2E-CHN-002  POS terminal full sales day (Fáze 2+)
TEST-E2E-CHN-003  Headless integrator API key
TEST-E2E-CHN-004  Custom domain setup with SSL
TEST-E2E-CHN-005  B2B portal channel (auth required)
```

### 16.4 Load

```
TEST-LOAD-CHN-001  1000 RPS per channel routing → p95 < 5 ms
TEST-LOAD-CHN-002  Concurrent SSL cert issuance (10 stores) — Let's Encrypt rate limit respected
```

---

## 17. Implementation checklist

### Backend
- [ ] **[S]** Drizzle schema `packages/db/src/schema/channels/*.ts`
- [ ] **[S]** Migrace `20260605_001_create_channels_stores_tables.sql`
- [ ] **[M]** `ChannelService` — CRUD, activation, settings
- [ ] **[M]** `StoreService` — CRUD, domain management
- [ ] **[M]** `ChannelResolver` middleware (request → channel)
- [ ] **[M]** `StoreResolver` middleware (host → store)
- [ ] **[L]** `DomainManagementService` — verification, SSL, redirects
- [ ] **[M]** `PosService` — terminals, sessions, cash drawer (Fáze 2+)
- [ ] **[M]** REST endpoints per §8
- [ ] **[M]** GraphQL types + resolvers
- [ ] **[S]** tRPC router (admin)
- [ ] **[S]** Storefront API channel + store endpoints

### Background jobs
- [ ] **[M]** JOB-VERIFY-DOMAIN-DNS, JOB-REQUEST-SSL-CERT, JOB-RENEW-SSL
- [ ] **[S]** JOB-NOTIFY-SSL-EXPIRING
- [ ] **[M]** JOB-RECONCILE-POS-CASH
- [ ] **[S]** JOB-DETECT-INACTIVE-CHANNELS, JOB-ARCHIVE-DEACTIVATED-CHANNELS
- [ ] **[M]** JOB-COMPUTE-CHANNEL-METRICS
- [ ] **[M]** JOB-WARM-STOREFRONT-CACHE-PER-CHANNEL
- [ ] **[S]** JOB-PING-POS-TERMINALS
- [ ] **[S]** JOB-COMPUTE-CHANNEL-INVENTORY-ALLOCATION

### Frontend — Admin
- [ ] **[M]** Channels list + detail + wizard
- [ ] **[M]** Channel payment methods config
- [ ] **[M]** Channel shipping methods config
- [ ] **[M]** Channel settings (free-form)
- [ ] **[L]** Stores list + detail + branding
- [ ] **[L]** Domain management UI + SSL status
- [ ] **[M]** Multi-store dashboard with store selector
- [ ] **[L]** POS terminal management (Fáze 2+)
- [ ] **[L]** POS UI (Fáze 2+)
- [ ] **[M]** POS sessions + cash reconciliation
- [ ] **[S]** Maintenance mode toggle UI
- [ ] **[S]** Password protection setup

### Frontend — Storefront
- [ ] **[S]** Locale + currency selector (store-aware)
- [ ] **[S]** Maintenance mode page
- [ ] **[S]** Password protection page

### Tests
- [ ] **[M]** Per §16

### Docs
- [ ] **[M]** "Setting up multiple sales channels" merchant guide
- [ ] **[M]** "Creating a multi-store setup" guide
- [ ] **[M]** "Custom domain configuration" guide
- [ ] **[M]** "POS terminal operation" guide (Fáze 2+)
- [ ] **[S]** "Headless commerce setup" developer guide
- [ ] **[S]** Developer: channel-aware plugin hooks

---

## 18. Open questions

### Q-CHN-001: Multi-tenant subdomain collision
**Otázka:** What if two tenants want `acme.shopio.shop`?

**Status:** First-come-first-served. Subdomains globally unique. Custom domains avoid collision.

### Q-CHN-002: Per-store catalog inheritance
**Otázka:** Sub-stores inherit parent store catalog? Or full independence?

**Status:** v1.0+ feature. MVP: each store has own filter; no parent-child relationship.

### Q-CHN-003: POS offline mode
**Otázka:** Terminal can't reach internet briefly — queue locally + sync?

**Status:** Fáze 2+ feature. PWA-based POS with IndexedDB queue. Critical for retail reliability.

### Q-CHN-004: Mobile app channel as PWA vs native
**Otázka:** Native mobile (React Native) vs PWA shell?

**Status:** Fáze 4 mobile. Likely PWA first (cheaper, ours storefront wrapped), native v3.0+.

### Q-CHN-005: Marketplace channel two-way sync
**Otázka:** Heuréka, Google Shopping accept orders directly?

**Status:** Fáze 2+ per platform. Schema-ready (channel + integration plugin).

### Q-CHN-006: Per-channel API rate limits granularity
**Otázka:** Different limits per kind currently; finer per API key + channel?

**Status:** v1.0+ feature. Schema flexibility.

### Q-CHN-007: White-label / reseller channels
**Otázka:** Reseller channel where third party sells our catalog under their brand?

**Status:** Fáze 4 feature. Combines with marketplace (`25-marketplace.md`).

### Q-CHN-008: Channel-specific terms of service
**Otázka:** B2B channel has different ToS than B2C?

**Status:** v1.0+ via store_translations + channel settings.

### Q-CHN-009: Per-channel checkout language
**Otázka:** Override default locale per channel (e.g., English-only headless API)?

**Status:** Configurable via channel.default_locale.

### Q-CHN-010: Domain SSL via Cloudflare
**Otázka:** Cloudflare offers SSL via proxy — alternative to Let's Encrypt direct.

**Status:** Configurable per tenant; both options supported. Let's Encrypt default.

---

## 📅 Změny

| Datum | Změna |
|---|---|
| 2026-05-20 | Initial — Multi-store + channels architecture. Channels (web/POS/mobile/marketplace/agent/B2B), stores (multiple storefronts s domain mapping), per-channel pricing/inventory/payments/shipping/catalog, headless-ready, POS schema-ready Fáze 2+. |

---

**Konec Multi-store & Channels.**

➡️ Pokračovat na: [`23-i18n.md`](23-i18n.md)
