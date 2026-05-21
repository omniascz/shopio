# 28 – DEVELOPER PLATFORM

> **Doména:** Vše, co potřebují vývojáři pro stavění na Shopio — REST/GraphQL/tRPC/MCP API, SDK (TypeScript), API tokens & OAuth apps, webhooks, plugin/app systém, app marketplace, edge functions, MCP server hosting, admin UI extensions, storefront extensions. Veřejně dokumentované, semverem versionované API. Plugin Apache 2.0 core + komerční marketplace s revenue share.

**Datum:** 2026-05-20
**Verze:** 1.0
**Status:** 🟡 DESIGN
**Reference:** [04-api-conventions.md](04-api-conventions.md) · [01 DEC-PLUGIN-*](01-decisions-registry.md) · [27-admin-backoffice.md](27-admin-backoffice.md) · [26-themes-storefront.md](26-themes-storefront.md)

---

## 📑 Obsah

0. [Domain overview](#0-domain-overview)
1. [References](#1-references)
2. [Personas](#2-personas)
3. [Data models](#3-data-models)
4. [API tokens & OAuth](#4-api-tokens--oauth)
5. [Webhooks](#5-webhooks)
6. [SDK packages](#6-sdk-packages)
7. [State machines](#7-state-machines)
8. [Plugin / app system](#8-plugin--app-system)
9. [Edge functions](#9-edge-functions)
10. [Business rules](#10-business-rules)
11. [REST API endpoints](#11-rest-api-endpoints)
12. [GraphQL schema](#12-graphql-schema)
13. [Events](#13-events)
14. [Background jobs](#14-background-jobs)
15. [UI/UX flows](#15-uiux-flows)
16. [Performance, security, testing](#16-performance-security-testing)
17. [Implementation checklist](#17-implementation-checklist)
18. [Open questions](#18-open-questions)

---

## 0. Domain overview

### 0.1 Co tato doména **je**

- **Public APIs** — REST, GraphQL, tRPC, MCP, Storefront API (per `04-api-conventions.md`)
- **API tokens** — Personal Access Tokens (PAT) pro skripty, service accounts pro automatizaci
- **OAuth 2.1 apps** — third-party apps požadují přístup od merchanta s scoped permissions
- **Webhooks** — outbound HTTP delivery s HMAC signing, retry, debugging UI
- **SDK** — `@shopio/sdk-ts` (TypeScript/Node + browser), generovaný z OpenAPI + GraphQL schema
- **Plugin / app systém** — extensibility platform; aplikace běží:
  - **Embedded** (iframe v admin UI, App Bridge)
  - **External** (vlastní hosting, OAuth + webhooks)
  - **Edge functions** (sandboxed JS/TS běžící v Shopio infrastruktuře, podobné Shopify Functions / Cloudflare Workers)
- **App marketplace** — katalog veřejných aplikací; instalovatelné z admin; revenue share (per `DEC-PLUGIN-001`)
- **MCP server hosting** — Shopio hostí MCP server per tenant; AI agenti (Claude Desktop, Cursor, ...) se připojí
- **Admin UI extensions** — apps injektují vlastní UI bloky do admin (App Bridge SDK)
- **Storefront extensions** — apps poskytují theme sections, scripts, checkout UI extensions
- **Edge functions hosting** — `@shopio/functions` SDK; kód běží v sandboxu (Cloudflare Workers / Deno Deploy)
- **Developer dashboard** — partners.shopio.com pro plugin authors; vytvoření app, OAuth credentials, analytics, listing v marketplace
- **API versioning** — date-based (`2026-05-20`) per `04`; backward compat 12 months
- **Rate limiting** — token-aware; per app + per tenant
- **API analytics** — per-app usage, error rates, latency dashboards pro merchanty

### 0.2 Co tato doména **NENÍ**

- ❌ API conventions (request/response struktura) — patří do `04-api-conventions.md`
- ❌ Auth interní (admin user login) — `30-security.md`, `18-customer-management.md`
- ❌ Theme marketplace (themes ≠ apps) — `26-themes-storefront.md`
- ❌ Marketplace (multi-vendor commerce) — `25-marketplace.md`
- ❌ Specifické integrace (Stripe, GoPay, Heuréka) — `29-integrations.md` (pre-built integrations)
- ❌ Build orchestration platformy (CI/CD pro plugin authors) — out of scope MVP
- ❌ Plugin sandbox internals (V8 isolates, security model) — Fáze 3+ deep-dive
- ❌ Vlastní hostingové prostředí pro merchant code (Heroku-like PaaS) — out of scope

### 0.3 Diferenciátory

1. **MCP first-class** — všechny tenanty automaticky dostanou MCP server endpoint; AI agenti (Claude Desktop, Cursor, ...) se připojí přes OAuth scopy → unique value vs Shopify
2. **Open API + Apache 2.0 core SDK** — vývojáři můžou self-host; nezávislost na Shopio Cloud
3. **Edge functions = Apache 2.0 standard** — ne proprietární DSL (na rozdíl od Shopify Functions)
4. **Plugin marketplace 80/20 revenue share** — favoring developers (per todo.md; vs původně 90/10/85/15/80/20 v 01-DEC); rozhodnuto níže
5. **MCP tools auto-generované z OpenAPI** — žádný separát manifest; jeden API zdroj
6. **EU-first compliance** — apps must declare GDPR scopes, data processing intent
7. **Sandboxed extensions** — embedded apps v iframe s strict CSP; edge functions ve V8 isolates s timeouts
8. **Stripe-quality docs** — interaktivní playground, code samples všech SDK, OpenAPI explorer

### 0.4 Rozhodnutí: revenue share

**Otevřený rozpor (per `shopio_zadani_progress`):** 01-DEC říká 10/8/5%, todo.md říká 80/20.

**Rozhodnutí MVP:** **80/20 ve prospěch vývojářů** (Apple/Shopify style). Důvod:
- Atraktivnější pro early-stage app developers (musíme naplnit marketplace)
- Konkurenceschopné se Shopify (80% rev share pro nové apps)
- 20% kryje Shopio náklady (hosting, infra, marketplace promotion, fraud)

**Plánovaná tiered struktura post-rok-1:**
- First 1M EUR yearly revenue per app: **80%** developer / 20% Shopio
- Above 1M EUR: **85%** developer / 15% Shopio
- Featured apps (curated): **70%** developer / 30% Shopio (more marketing in exchange)

Zapsat to nově do `01-decisions-registry` jako `DEC-PLUGIN-001` (override předchozího rozhodnutí).

---

## 1. References

- [04-api-conventions.md](04-api-conventions.md) — API tvar, versioning, error format, MCP rules
- [01 DEC-API-001 -- DEC-PLUGIN-*](01-decisions-registry.md) — license, marketplace
- [18-customer-management.md](18-customer-management.md) — user accounts, OAuth subject = customer
- [26-themes-storefront.md](26-themes-storefront.md) — theme extensions overlap
- [27-admin-backoffice.md](27-admin-backoffice.md) — admin UI extensibility
- [29-integrations.md](29-integrations.md) — pre-built integrations (use this SDK)
- [30-security.md](30-security.md) — token hashing, secrets storage
- [33-ai-features.md](33-ai-features.md) — MCP usage by Claude
- [36-personas-rbac.md](36-personas-rbac.md) — permission scopes definition
- OAuth 2.1 (draft) + PKCE
- RFC 8707 — Resource Indicators
- HMAC RFC 2104
- Model Context Protocol (Anthropic spec)
- Cloudflare Workers / Deno Deploy edge runtime patterns
- Shopify App Bridge (reference UI extension model)
- Stripe API design (rate limiting + versioning best practice)

---

## 2. Personas

| Persona | Použití | Klíčové permissions |
|---|---|---|
| `PERSONA-IN-HOUSE-DEVELOPER` | Tenant's dev integrující external systém | `PERM-DEVELOPER-*` |
| `PERSONA-APP-DEVELOPER` (3rd-party) | Buduje plugin na marketplace | partners.shopio.com account |
| `PERSONA-APP-PUBLISHER` | App owner; spravuje listing + revenue | `PERM-PARTNER-APP-MANAGE` |
| `PERSONA-MERCHANT-OWNER` | Instaluje apps, spravuje API tokens | `PERM-DEVELOPER-APP-INSTALL`, `PERM-DEVELOPER-TOKEN-MANAGE` |
| `PERSONA-WEBHOOK-CONSUMER` | External system příjímá webhooks | (none — verified via HMAC) |
| `PERSONA-AI-AGENT` | Claude / Cursor / other AI s MCP | OAuth scopes (`agent:*`) |
| `PERSONA-PLATFORM-STAFF` | Schvaluje apps v marketplace | `PERM-PLATFORM-APP-REVIEW` |
| `PERSONA-PLATFORM-SECURITY` | Vyšetřuje security incidenty plugin authors | `PERM-PLATFORM-SECURITY-INVESTIGATE` |

---

## 3. Data models

### 3.1 `apps` — published applications

```sql
CREATE TABLE apps (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  pub_id TEXT NOT NULL,                                                                                                       -- app_ NanoID (globally unique, not per-tenant)
  slug TEXT NOT NULL,
  -- ownership
  publisher_account_id UUID NOT NULL,                                                                                          -- partner account on partners.shopio.com
  publisher_display_name TEXT NOT NULL,
  publisher_email CITEXT NOT NULL,
  publisher_url TEXT NULL,
  -- identity
  name TEXT NOT NULL,
  description_short TEXT NOT NULL,
  description_html TEXT NOT NULL,
  icon_url TEXT NULL,
  preview_images JSONB NULL,
  category TEXT NULL,                                                                                                           -- 'analytics','marketing','shipping','accounting',...
  tags TEXT[] NULL,
  -- distribution
  distribution_kind TEXT NOT NULL CHECK (distribution_kind IN ('public_marketplace','private_install_only','custom_install')) DEFAULT 'public_marketplace',
  install_url_template TEXT NULL,                                                                                                -- e.g., https://myapp.com/install?tenant={tenant_id}
  oauth_redirect_urls TEXT[] NOT NULL DEFAULT '{}',
  embedded BOOLEAN NOT NULL DEFAULT false,                                                                                       -- embedded in admin via iframe
  embedded_app_url TEXT NULL,                                                                                                     -- if embedded
  -- versions
  latest_version TEXT NOT NULL,                                                                                                    -- semver
  -- pricing
  pricing_kind TEXT NOT NULL CHECK (pricing_kind IN ('free','one_time','subscription','usage_based','custom')) DEFAULT 'free',
  pricing_plans JSONB NULL,
  free_trial_days INTEGER NULL,
  -- scopes
  required_scopes TEXT[] NOT NULL DEFAULT '{}',                                                                                    -- OAuth scopes app requests
  optional_scopes TEXT[] NULL,
  webhook_topics TEXT[] NULL,                                                                                                       -- subscribed topics
  -- compliance
  gdpr_processor BOOLEAN NOT NULL DEFAULT false,                                                                                     -- processes EU customer data
  data_processing_disclosure_html TEXT NULL,
  privacy_policy_url TEXT NULL,
  terms_url TEXT NULL,
  -- status
  status TEXT NOT NULL CHECK (status IN (
    'draft','under_review','approved','rejected','published','suspended','deprecated'
  )) DEFAULT 'draft',
  status_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  rejection_reason TEXT NULL,
  -- stats
  total_installs INTEGER NOT NULL DEFAULT 0,
  active_installs INTEGER NOT NULL DEFAULT 0,
  average_rating NUMERIC(3,2) NULL,
  rating_count INTEGER NOT NULL DEFAULT 0,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ NULL,
  approved_by_user_id UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_apps_pub_id UNIQUE (pub_id),
  CONSTRAINT uq_apps_slug UNIQUE (slug)
);

CREATE INDEX idx_apps_published ON apps (status) WHERE status = 'published';
CREATE INDEX idx_apps_category ON apps (category) WHERE status = 'published';
CREATE INDEX idx_apps_publisher ON apps (publisher_account_id);
```

### 3.2 `app_versions`

```sql
CREATE TABLE app_versions (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  version TEXT NOT NULL,                                                                                                              -- semver
  -- code references
  edge_function_bundle_url TEXT NULL,                                                                                                   -- S3 if edge_function app
  edge_function_bundle_hash TEXT NULL,                                                                                                  -- SHA-256
  -- changelog
  release_notes_html TEXT NULL,
  -- compatibility
  min_platform_version TEXT NOT NULL DEFAULT '1.0.0',
  api_version TEXT NOT NULL,                                                                                                              -- which API version this app uses
  -- review
  review_status TEXT NOT NULL CHECK (review_status IN ('pending','approved','rejected')) DEFAULT 'pending',
  reviewed_at TIMESTAMPTZ NULL,
  reviewed_by_user_id UUID NULL,
  review_notes TEXT NULL,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_app_versions UNIQUE (app_id, version)
);

CREATE INDEX idx_app_versions_app ON app_versions (app_id, version DESC);
```

### 3.3 `app_installations` — per-tenant install record

```sql
CREATE TABLE app_installations (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  app_id UUID NOT NULL REFERENCES apps(id),
  pub_id TEXT NOT NULL,
  installed_version TEXT NOT NULL,
  -- OAuth
  oauth_client_id TEXT NOT NULL,
  granted_scopes TEXT[] NOT NULL,
  oauth_access_token_hash TEXT NOT NULL,                                                                                                 -- never store plaintext
  oauth_refresh_token_hash TEXT NULL,
  oauth_token_issued_at TIMESTAMPTZ NOT NULL,
  oauth_token_expires_at TIMESTAMPTZ NULL,
  -- config
  app_settings JSONB NOT NULL DEFAULT '{}'::jsonb,                                                                                        -- app-specific config
  -- billing
  billing_status TEXT NULL CHECK (billing_status IN ('trial','active','past_due','cancelled') OR billing_status IS NULL),
  billing_plan TEXT NULL,
  billing_period_end TIMESTAMPTZ NULL,
  -- lifecycle
  status TEXT NOT NULL CHECK (status IN (
    'installing','installed','active','disabled','uninstalling','uninstalled','suspended'
  )) DEFAULT 'installing',
  status_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  installed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  uninstalled_at TIMESTAMPTZ NULL,
  uninstall_reason TEXT NULL,
  -- audit
  installed_by_user_id UUID NULL REFERENCES users(id),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_app_installations UNIQUE (tenant_id, app_id),                                                                            -- 1 install per tenant per app
  CONSTRAINT uq_app_installations_pub_id UNIQUE (tenant_id, pub_id)
);

CREATE INDEX idx_app_installations_app ON app_installations (app_id) WHERE status = 'active';
CREATE INDEX idx_app_installations_status ON app_installations (status, status_changed_at) WHERE status IN ('installing','uninstalling');
```

### 3.4 `api_tokens` — Personal Access Tokens + service accounts

```sql
CREATE TABLE api_tokens (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pub_id TEXT NOT NULL,
  -- kind
  token_kind TEXT NOT NULL CHECK (token_kind IN ('personal_access','service_account','admin_api_legacy')),
  -- ownership
  owner_user_id UUID NULL REFERENCES users(id),                                                                                            -- personal_access only
  service_account_name TEXT NULL,                                                                                                            -- service_account only
  -- identity
  name TEXT NOT NULL,                                                                                                                          -- 'CI deploy script','Zapier integration'
  description TEXT NULL,
  -- secret
  token_prefix TEXT NOT NULL,                                                                                                                   -- e.g., 'sho_pat_' or 'sho_sa_' visible
  token_hash TEXT NOT NULL,                                                                                                                     -- argon2id hash; never plaintext
  token_hint TEXT NOT NULL,                                                                                                                      -- last 4 chars visible (UX)
  -- scopes
  scopes TEXT[] NOT NULL,
  ip_allowlist CIDR[] NULL,
  -- expiry
  expires_at TIMESTAMPTZ NULL,
  -- revocation
  status TEXT NOT NULL CHECK (status IN ('active','revoked','expired')) DEFAULT 'active',
  revoked_at TIMESTAMPTZ NULL,
  revoked_by_user_id UUID NULL,
  revoked_reason TEXT NULL,
  -- usage
  last_used_at TIMESTAMPTZ NULL,
  last_used_ip INET NULL,
  use_count BIGINT NOT NULL DEFAULT 0,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user_id UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_api_tokens_pub_id UNIQUE (tenant_id, pub_id),
  CONSTRAINT uq_api_tokens_hash UNIQUE (token_hash)                                                                                              -- DB-level uniqueness on hash
);

CREATE INDEX idx_api_tokens_owner ON api_tokens (owner_user_id) WHERE status = 'active';
CREATE INDEX idx_api_tokens_active ON api_tokens (tenant_id, status) WHERE status = 'active';
CREATE INDEX idx_api_tokens_expiring ON api_tokens (expires_at) WHERE status = 'active' AND expires_at IS NOT NULL;
```

### 3.5 `oauth_clients` — OAuth 2.1 client registrations

```sql
CREATE TABLE oauth_clients (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,                                                                                       -- 1:1 s app
  client_id TEXT NOT NULL,                                                                                                                            -- public identifier
  client_secret_hash TEXT NOT NULL,                                                                                                                    -- argon2id (only for confidential clients)
  client_secret_hint TEXT NOT NULL,                                                                                                                     -- last 4 chars
  client_kind TEXT NOT NULL CHECK (client_kind IN ('confidential','public_pkce')),
  redirect_uris TEXT[] NOT NULL,
  -- grants
  allowed_grants TEXT[] NOT NULL DEFAULT '{"authorization_code"}',
  pkce_required BOOLEAN NOT NULL DEFAULT true,
  -- token policy
  access_token_ttl_seconds INTEGER NOT NULL DEFAULT 3600,
  refresh_token_ttl_seconds INTEGER NOT NULL DEFAULT 2592000,
  -- status
  status TEXT NOT NULL CHECK (status IN ('active','disabled')) DEFAULT 'active',
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_oauth_clients_client_id UNIQUE (client_id)
);
```

### 3.6 `oauth_authorization_codes` — short-lived per OAuth flow

```sql
CREATE TABLE oauth_authorization_codes (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  client_id TEXT NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  code_hash TEXT NOT NULL,
  code_challenge TEXT NOT NULL,                                                                                                                            -- PKCE
  code_challenge_method TEXT NOT NULL DEFAULT 'S256',
  redirect_uri TEXT NOT NULL,
  scopes TEXT[] NOT NULL,
  state TEXT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_oauth_authorization_codes_hash ON oauth_authorization_codes (code_hash) WHERE consumed_at IS NULL;
CREATE INDEX idx_oauth_authorization_codes_expiry ON oauth_authorization_codes (expires_at) WHERE consumed_at IS NULL;
```

### 3.7 `oauth_access_tokens` + `oauth_refresh_tokens`

```sql
CREATE TABLE oauth_access_tokens (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  client_id TEXT NOT NULL,
  user_id UUID NULL,                                                                                                                                          -- delegation; NULL for client_credentials
  app_installation_id UUID NULL REFERENCES app_installations(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  token_hint TEXT NOT NULL,
  scopes TEXT[] NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ NULL,
  last_used_at TIMESTAMPTZ NULL,
  use_count BIGINT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_oauth_access_tokens_hash UNIQUE (token_hash)
);

CREATE INDEX idx_oauth_access_tokens_active ON oauth_access_tokens (tenant_id, client_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_oauth_access_tokens_expiry ON oauth_access_tokens (expires_at) WHERE revoked_at IS NULL;

CREATE TABLE oauth_refresh_tokens (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  client_id TEXT NOT NULL,
  user_id UUID NULL,
  app_installation_id UUID NULL REFERENCES app_installations(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  family_id UUID NOT NULL,                                                                                                                                        -- rotation chain
  scopes TEXT[] NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ NULL,
  replaced_by_token_id UUID NULL REFERENCES oauth_refresh_tokens(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_oauth_refresh_tokens_hash UNIQUE (token_hash)
);

CREATE INDEX idx_oauth_refresh_tokens_family ON oauth_refresh_tokens (family_id);
```

### 3.8 `webhook_subscriptions`

```sql
CREATE TABLE webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pub_id TEXT NOT NULL,                                                                                                                                              -- whk_ NanoID
  -- source
  owner_kind TEXT NOT NULL CHECK (owner_kind IN ('app_installation','manual_subscriber')),
  app_installation_id UUID NULL REFERENCES app_installations(id) ON DELETE CASCADE,
  -- target
  endpoint_url TEXT NOT NULL,
  topics TEXT[] NOT NULL,                                                                                                                                              -- event wire names: 'order.placed','product.updated'
  api_version TEXT NOT NULL,                                                                                                                                            -- payload shape
  -- security
  signing_secret_hash TEXT NOT NULL,                                                                                                                                     -- argon2id
  signing_secret_hint TEXT NOT NULL,
  -- delivery
  is_active BOOLEAN NOT NULL DEFAULT true,
  retry_strategy TEXT NOT NULL CHECK (retry_strategy IN ('exponential','linear','immediate_then_exponential')) DEFAULT 'exponential',
  max_retry_attempts INTEGER NOT NULL DEFAULT 6,
  -- filtering (optional)
  filter_expression TEXT NULL,                                                                                                                                            -- JSONPath-like; ex. "$.order.tags[*] == 'priority'"
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user_id UUID NULL,
  -- health (computed)
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  paused_due_to_failures BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_webhook_subscriptions_pub_id UNIQUE (tenant_id, pub_id)
);

CREATE INDEX idx_webhook_subscriptions_topics ON webhook_subscriptions USING GIN (topics) WHERE is_active = true;
CREATE INDEX idx_webhook_subscriptions_app ON webhook_subscriptions (app_installation_id) WHERE is_active = true;
CREATE INDEX idx_webhook_subscriptions_paused ON webhook_subscriptions (tenant_id) WHERE paused_due_to_failures = true;
```

### 3.9 `webhook_deliveries`

```sql
CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  subscription_id UUID NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
  -- event
  event_id UUID NOT NULL,                                                                                                                                                  -- → events table per outbox
  topic TEXT NOT NULL,
  payload JSONB NOT NULL,
  payload_signature TEXT NOT NULL,
  api_version TEXT NOT NULL,
  -- status
  status TEXT NOT NULL CHECK (status IN ('pending','delivered','failed','retrying','abandoned')) DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  -- timing
  scheduled_at TIMESTAMPTZ NOT NULL,
  first_attempt_at TIMESTAMPTZ NULL,
  last_attempt_at TIMESTAMPTZ NULL,
  next_attempt_at TIMESTAMPTZ NULL,
  delivered_at TIMESTAMPTZ NULL,
  abandoned_at TIMESTAMPTZ NULL,
  -- response (last attempt)
  last_response_status_code INTEGER NULL,
  last_response_body_excerpt TEXT NULL,                                                                                                                                       -- first 2KB
  last_response_headers JSONB NULL,
  last_error_message TEXT NULL,
  total_latency_ms INTEGER NULL,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
) PARTITION BY RANGE (created_at);

CREATE INDEX idx_webhook_deliveries_pending ON webhook_deliveries (next_attempt_at) WHERE status IN ('pending','retrying');
CREATE INDEX idx_webhook_deliveries_subscription ON webhook_deliveries (subscription_id, created_at DESC);
CREATE INDEX idx_webhook_deliveries_event ON webhook_deliveries (event_id);
```

### 3.10 `edge_functions`

```sql
CREATE TABLE edge_functions (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pub_id TEXT NOT NULL,
  -- ownership
  owner_kind TEXT NOT NULL CHECK (owner_kind IN ('tenant_custom','app_installation')),
  app_installation_id UUID NULL REFERENCES app_installations(id) ON DELETE CASCADE,
  -- identity
  name TEXT NOT NULL,
  description TEXT NULL,
  -- code
  function_kind TEXT NOT NULL CHECK (function_kind IN (
    'cart_validate','cart_transform','checkout_validate','discount_compute',
    'shipping_compute','tax_compute','payment_method_filter','order_process','custom'
  )),
  bundle_storage_key TEXT NOT NULL,                                                                                                                                                -- S3 path to compiled JS
  bundle_hash TEXT NOT NULL,
  bundle_size_bytes INTEGER NOT NULL,
  -- runtime config
  runtime_kind TEXT NOT NULL DEFAULT 'deno_isolate',                                                                                                                                  -- deno_isolate | cf_workers
  timeout_ms INTEGER NOT NULL DEFAULT 100,                                                                                                                                              -- hard timeout
  memory_limit_mb INTEGER NOT NULL DEFAULT 128,
  environment_variables JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- versioning
  version INTEGER NOT NULL DEFAULT 1,
  -- status
  status TEXT NOT NULL CHECK (status IN ('disabled','enabled','deploying','failed_deploy','suspended')) DEFAULT 'disabled',
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deployed_at TIMESTAMPTZ NULL,
  -- stats
  total_invocations BIGINT NOT NULL DEFAULT 0,
  total_errors BIGINT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_edge_functions_pub_id UNIQUE (tenant_id, pub_id)
);

CREATE INDEX idx_edge_functions_kind ON edge_functions (tenant_id, function_kind) WHERE status = 'enabled';
CREATE INDEX idx_edge_functions_app ON edge_functions (app_installation_id) WHERE status = 'enabled';
```

### 3.11 `edge_function_invocations` *(append-only telemetry)*

```sql
CREATE TABLE edge_function_invocations (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  function_id UUID NOT NULL,
  function_version INTEGER NOT NULL,
  triggered_by_kind TEXT NOT NULL,                                                                                                                                                      -- 'cart_event','checkout_validation','manual_test'
  trigger_payload_excerpt JSONB NULL,
  status TEXT NOT NULL CHECK (status IN ('success','error','timeout','memory_exceeded','rate_limited')),
  duration_ms INTEGER NOT NULL,
  memory_used_mb INTEGER NULL,
  log_lines INTEGER NOT NULL DEFAULT 0,
  error_message TEXT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
) PARTITION BY RANGE (occurred_at);

CREATE INDEX idx_edge_function_invocations_function ON edge_function_invocations (function_id, occurred_at DESC);
CREATE INDEX idx_edge_function_invocations_errors ON edge_function_invocations (function_id, occurred_at DESC) WHERE status NOT IN ('success');
```

### 3.12 `app_reviews`

```sql
CREATE TABLE app_reviews (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  app_id UUID NOT NULL REFERENCES apps(id),
  tenant_id UUID NOT NULL,
  installation_id UUID NULL REFERENCES app_installations(id),
  customer_user_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title TEXT NULL,
  body TEXT NULL,
  publisher_response TEXT NULL,
  publisher_response_at TIMESTAMPTZ NULL,
  status TEXT NOT NULL CHECK (status IN ('published','pending_moderation','hidden')) DEFAULT 'published',
  helpful_count INTEGER NOT NULL DEFAULT 0,
  reported_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_app_reviews UNIQUE (app_id, tenant_id, customer_user_id)
);

CREATE INDEX idx_app_reviews_app ON app_reviews (app_id, created_at DESC) WHERE status = 'published';
```

### 3.13 `app_billing_events` *(MVP minimal; Fáze 2 hluboké)*

```sql
CREATE TABLE app_billing_events (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  installation_id UUID NOT NULL REFERENCES app_installations(id) ON DELETE CASCADE,
  app_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  publisher_account_id UUID NOT NULL,
  event_kind TEXT NOT NULL CHECK (event_kind IN ('charge','refund','adjustment','plan_change','trial_start','trial_end')),
  amount BIGINT NOT NULL,
  currency CHAR(3) NOT NULL,
  shopio_commission_amount BIGINT NOT NULL,                                                                                                                                                  -- 20%
  publisher_payout_amount BIGINT NOT NULL,                                                                                                                                                    -- 80%
  description TEXT NULL,
  invoice_id UUID NULL,                                                                                                                                                                         -- Stripe Subscription/Invoice for embedded billing
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_app_billing_events_publisher ON app_billing_events (publisher_account_id, occurred_at DESC);
CREATE INDEX idx_app_billing_events_app ON app_billing_events (app_id, occurred_at DESC);
```

### 3.14 Vztahy

```
apps (1)──(N) app_versions
apps (1)──(1) oauth_clients                                                                                                                                                                      [if OAuth-enabled]
apps (1)──(N) app_installations                                                                                                                                                                   [per tenant]
apps (1)──(N) app_reviews
app_installations (1)──(0..N) webhook_subscriptions
app_installations (1)──(0..N) edge_functions
oauth_clients (1)──(N) oauth_access_tokens
oauth_clients (1)──(N) oauth_refresh_tokens
oauth_clients (1)──(N) oauth_authorization_codes                                                                                                                                                   [short-lived]
webhook_subscriptions (1)──(N) webhook_deliveries
edge_functions (1)──(N) edge_function_invocations
app_installations (1)──(N) app_billing_events
tenants (1)──(N) api_tokens
users (1)──(N) api_tokens                                                                                                                                                                            [personal_access tokens]
```

---

## 4. API tokens & OAuth

### 4.1 Token kinds

| Kind | Use case | Auth | Lifetime |
|---|---|---|---|
| **PAT (Personal Access Token)** | Admin user's own scripts, CI deploys | Bearer in `Authorization: Bearer sho_pat_...` | Configurable, max 1 year |
| **Service account token** | Long-running automation (Zapier, custom backends) | Bearer `sho_sa_...` | Configurable, no max |
| **OAuth access token** | Apps installed by merchant | Bearer `sho_at_...` | 1 hour default; refresh-rotated |
| **OAuth refresh token** | Apps; rotates access token | `sho_rt_...`; sent to /token endpoint | 30 days default; family-rotated |
| **Admin API legacy** | Backward compat for simple secrets | Bearer | Discouraged; opt-in |

### 4.2 Token format

```
sho_<kind>_<entropy>

Examples:
  sho_pat_01abXYz...                                                                                                                                                                                       (PAT)
  sho_sa_01abXYz...                                                                                                                                                                                         (service account)
  sho_at_01abXYz...                                                                                                                                                                                         (OAuth access)
  sho_rt_01abXYz...                                                                                                                                                                                         (OAuth refresh)
```

- Prefix visible in UI for identification (`sho_pat_`)
- Entropy: 32 bytes base32 encoded (~52 chars)
- Stored as argon2id hash + last 4 chars (`token_hint`) for UX identification
- Constant-time comparison on lookup

### 4.3 OAuth 2.1 flow (authorization_code + PKCE)

Mandatorní PKCE pro všechny apps (per OAuth 2.1 draft).

```
1. App generates code_verifier (43-128 chars random) + code_challenge = SHA256(code_verifier)
2. App redirects merchant to:
   GET https://api.shopio.com/oauth/authorize?
     client_id=...&
     redirect_uri=...&
     scope=read_products,write_orders&
     state=<csrf>&
     code_challenge=<challenge>&
     code_challenge_method=S256
3. Merchant logs in (if not) + sees consent screen
   → "App 'XYZ' wants access to:
        - Read products
        - Write orders
        - [...]"
4. Merchant approves → server generates authorization_code (10-min TTL), redirects:
   GET <redirect_uri>?code=<code>&state=<state>
5. App exchanges code at /oauth/token:
   POST /oauth/token
     grant_type=authorization_code
     code=<code>
     code_verifier=<verifier>
     redirect_uri=<same>
     client_id=...
     client_secret=...                                                                                                                                                                                          (if confidential client)
6. Server validates:
   - code matches & not consumed & not expired
   - code_challenge == SHA256(code_verifier)
   - redirect_uri matches
   - client_id / client_secret match
   → issues:
     {
       access_token: "sho_at_...",
       refresh_token: "sho_rt_...",
       token_type: "Bearer",
       expires_in: 3600,
       scope: "read_products write_orders",
       installation_id: "ins_aB"
     }
7. App stores tokens in app_installations row (back-channel to Shopio API or installation webhook)
```

### 4.4 OAuth scopes catalog

Granularní per resource + akce. Příklady:

| Scope | Description |
|---|---|
| `read_products` | List + read products |
| `write_products` | Create + update + delete products |
| `read_orders` | List + read orders |
| `write_orders` | Modify orders |
| `read_customers` | List + read customers (PII!) |
| `write_customers` | Modify customers |
| `read_inventory` | Read stock |
| `write_inventory` | Adjust stock |
| `read_themes` | Read theme config |
| `write_themes` | Modify themes |
| `read_analytics` | Read analytics data |
| `write_webhooks` | Subscribe to webhooks |
| `write_edge_functions` | Deploy edge functions |
| `read_marketplace` | Read marketplace (multi-vendor) data |
| `agent:read_catalog` | AI agent narrow scope for product search |
| `agent:place_order` | AI agent place orders on behalf |
| `agent:*` | All agent scopes |

Total ~40-60 scopes; verze 1.

### 4.5 Token refresh

```
POST /oauth/token
  grant_type=refresh_token
  refresh_token=sho_rt_...
  client_id=...
  client_secret=...                                                                                                                                                                                              (if confidential)

→ {
    access_token: "sho_at_<new>",
    refresh_token: "sho_rt_<new>",                                                                                                                                                                                  // rotated; old marked consumed
    expires_in: 3600,
    ...
  }
```

**Refresh token rotation:**
- Each refresh issues new pair, marks old refresh as consumed (`replaced_by_token_id`)
- If consumed refresh used again → entire token family revoked (theft detection)
- App must update stored refresh token after each use

### 4.6 Revocation

```
POST /oauth/revoke
  token=sho_at_... | sho_rt_...
  client_id=...
  client_secret=...

→ 204 No Content
```

Also:
- Merchant can revoke from /settings/team and /settings/developer/installations
- App uninstall revokes all tokens automatically
- Security incident: bulk revoke per client_id

### 4.7 IP allowlist

PAT / service account tokens můžou mít IP allowlist (CIDR). Token bez allowlist akceptuje kterákoli IP. S allowlist: 401 z neauthorized IPs.

### 4.8 Scopes enforcement

Every request:
1. Extract token from `Authorization: Bearer ...`
2. Lookup hash → token row
3. Validate not revoked, not expired
4. Match request to required scope (per endpoint)
5. If insufficient scope: 403 `INSUFFICIENT_SCOPE` with `WWW-Authenticate` header listing missing
6. Update `last_used_at`, `use_count`, `last_used_ip`

---

## 5. Webhooks

### 5.1 Subscription model

App nebo manual subscriber subscribes to topics:
- Topic = event wire name (per `04 §10` events table)
- Examples: `order.placed`, `product.updated`, `customer.created`

Multiple subscribers per topic OK. Each gets independent delivery + retry.

### 5.2 Delivery semantics

**At-least-once delivery** (per `DEC-EVENTS-001`):
- Outbox pattern guarantees event emission
- Webhook dispatcher reads from event outbox
- Subscriber may receive duplicate (use `event_id` for idempotency)

### 5.3 HTTP request format

```
POST <endpoint_url> HTTP/1.1
Content-Type: application/json
X-Shopio-Topic: order.placed
X-Shopio-Event-Id: evt_01abXYz
X-Shopio-Tenant-Id: tnt_aB
X-Shopio-Delivery-Id: del_xY
X-Shopio-Delivery-Attempt: 1
X-Shopio-Timestamp: 1716220800
X-Shopio-Signature: sha256=<HMAC>
X-Shopio-Api-Version: 2026-05-20
User-Agent: Shopio-Webhooks/1.0

{
  "event_id": "evt_01abXYz",
  "topic": "order.placed",
  "occurred_at": "2026-05-20T15:30:00Z",
  "tenant_id": "tnt_aB",
  "data": {
    "order": { ... }
  }
}
```

### 5.4 HMAC signature

```
signing_input = X-Shopio-Timestamp + "." + raw_request_body
signature = HMAC-SHA256(signing_secret, signing_input)
X-Shopio-Signature: sha256=<hex>
```

**Subscriber verification:**
```ts
import { createHmac, timingSafeEqual } from 'node:crypto';

function verify(headers, rawBody, secret) {
  const timestamp = headers['x-shopio-timestamp'];
  const signature = headers['x-shopio-signature'].replace('sha256=', '');
  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  if (!timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))) {
    throw new Error('Invalid signature');
  }
  if (Math.abs(Date.now() / 1000 - parseInt(timestamp)) > 300) {                                                                                                                                                          // 5-min skew
    throw new Error('Timestamp too old');
  }
}
```

### 5.5 Retry strategy

```
attempt 1: immediate
attempt 2: +30s
attempt 3: +2m
attempt 4: +10m
attempt 5: +1h
attempt 6: +6h
attempt 7: abandoned (after 7+ hours)
```

Configurable per subscription (`max_retry_attempts`, `retry_strategy`).

**Trigger retry:**
- HTTP status 4xx (except 410 Gone — permanent fail, no retry)
- HTTP status 5xx
- Connection timeout (default 10s)
- TLS errors

**Treat as success:**
- HTTP 2xx
- Subscriber should return 200 quickly (< 5s); long processing → enqueue + return 200

### 5.6 Auto-pause on consecutive failures

If 100 consecutive failures: subscription auto-paused (`paused_due_to_failures = true`). Tenant notified to fix endpoint. Manual resume required.

### 5.7 Webhook replay + debugging UI

Admin → Developer → Webhooks → {subscription}:
- List recent deliveries with status
- Click delivery → details (request, response, error)
- "Replay" button to manually re-send
- Filter by topic, status, date

### 5.8 Filtering

Optional `filter_expression` per subscription (JSONPath subset):
```
$.order.tags[*] == 'priority'
$.product.vendor.id == 'ven_aB'
```

Pre-evaluated server-side; only matching events delivered.

### 5.9 Topic catalog

Domain-prefixed wire names per `04`. Selected commonly subscribed:
- `order.placed`, `order.cancelled`, `order.fulfilled`, `order.refunded`
- `product.created`, `product.updated`, `product.deleted`, `product.archived`
- `customer.created`, `customer.updated`, `customer.deleted`
- `inventory.stock_changed`, `inventory.low_stock`
- `cart.abandoned`
- `subscription.charged`, `subscription.cancelled`
- `marketplace.payout_processed`
- `app.uninstalled` (notify your own app)
- `app.uninstall_requested` (graceful uninstall hook)

Full list per `04 §10` + each domain's §11 events.

---

## 6. SDK packages

### 6.1 `@shopio/sdk-ts` — official TypeScript SDK

NPM published. Works in Node.js 22+, modern browsers, Deno, Bun.

```bash
npm install @shopio/sdk-ts
```

### 6.2 Initialization

```ts
import { Shopio } from '@shopio/sdk-ts';

const sho = new Shopio({
  apiKey: process.env.SHOPIO_API_KEY,                                                                                                                                                                                       // PAT or service account
  tenantId: 'tnt_aB',
  apiVersion: '2026-05-20',
  // OR
  oauth: {
    clientId: '...',
    clientSecret: '...',
    accessToken: '...',
    refreshToken: '...',
    onTokenRefresh: (tokens) => savePersisted(tokens),
  },
});
```

### 6.3 Resource access — typed clients

```ts
// REST clients generated from OpenAPI
const product = await sho.products.get('prd_aB');
const orders = await sho.orders.list({ status: 'pending', limit: 50 });
const updated = await sho.products.update('prd_aB', { title: 'New name' });

// GraphQL
const { products } = await sho.graphql<{ products: ProductConnection }>(`
  query GetProducts($first: Int) {
    products(first: $first) {
      edges { node { id title } }
    }
  }
`, { first: 10 });

// tRPC (server-side only)
const result = await sho.trpc.products.search.query({ q: 'shirt' });

// Realtime via GraphQL subscriptions
sho.subscribe(
  `subscription { orderPlaced { id total { amount } } }`,
  (event) => console.log('new order', event)
);

// Webhooks
const sub = await sho.webhooks.subscribe({
  endpointUrl: 'https://myapp.com/webhooks',
  topics: ['order.placed','order.fulfilled'],
});
console.log('signing secret', sub.signingSecret);                                                                                                                                                                              // shown once
```

### 6.4 Auto-pagination + cursors

```ts
for await (const product of sho.products.listAll({ status: 'published' })) {
  console.log(product.title);
}
```

### 6.5 Rate limiting + retries (automatic)

SDK automatically:
- Respects `Retry-After` header on 429
- Exponential backoff on 5xx
- Up to 3 retries per request
- Token refresh on 401 (OAuth flows)

### 6.6 Error types

```ts
import { ShopioError, RateLimitError, ValidationError, NotFoundError } from '@shopio/sdk-ts';

try {
  await sho.products.create({ title: '' });
} catch (err) {
  if (err instanceof ValidationError) {
    console.log(err.fieldErrors);
  } else if (err instanceof RateLimitError) {
    console.log('Wait', err.retryAfterSeconds);
  }
}
```

### 6.7 Webhook helpers

```ts
import { verifyWebhook } from '@shopio/sdk-ts/webhooks';

// Express middleware
app.post('/webhooks', express.raw({type:'application/json'}), (req, res) => {
  try {
    const event = verifyWebhook({
      rawBody: req.body,
      headers: req.headers,
      secret: process.env.SHOPIO_WEBHOOK_SECRET,
    });
    handleEvent(event);
    res.status(200).send('ok');
  } catch {
    res.status(401).send('invalid');
  }
});
```

### 6.8 Other SDK packages

| Package | Purpose | Status |
|---|---|---|
| `@shopio/sdk-ts` | Main TS/Node SDK | MVP |
| `@shopio/sdk-react` | React hooks (useProduct, useCart) for storefronts | Fáze 2 |
| `@shopio/app-bridge-react` | Embedded admin apps SDK | Fáze 2 |
| `@shopio/functions` | Edge function definition helpers | Fáze 2 |
| `@shopio/cli` | CLI for scaffolding apps + deploy | Fáze 2 |
| `@shopio/sdk-go` | Go SDK | Fáze 3+ |
| `@shopio/sdk-python` | Python SDK | Fáze 3+ |
| `@shopio/sdk-php` | PHP SDK (popular w/ Wordpress shops) | Fáze 3+ |
| Mobile SDKs (Swift / Kotlin) | — | Fáze 4+ |

### 6.9 License

Per `01-decisions-registry` `DEC-LICENSE-001` — MIT (SDK), distinct od Apache 2.0 (core).

---

## 7. State machines

### 7.1 App lifecycle (publisher side)

```
draft → under_review → approved → published ↔ suspended → deprecated
                     → rejected (terminal)
```

### 7.2 App installation lifecycle (tenant side)

```
installing → installed → active ↔ disabled
                              ↓
                       uninstalling → uninstalled (terminal-ish)
                                                ↘
                                              suspended (admin action)
```

### 7.3 Webhook delivery

```
pending → retrying → delivered (terminal)
                    → abandoned (terminal, after max attempts)
                    → failed (per attempt; transitions back to retrying)
```

### 7.4 Edge function

```
draft → deploying → enabled ↔ disabled
                  → failed_deploy
                              ↘
                         suspended (security incident)
```

### 7.5 OAuth refresh token rotation

```
issued → consumed (used once, replaced) → terminal
                                       ↘ revoked_family (if reuse detected)
```

---

## 8. Plugin / app system

### 8.1 App types

| Type | Hosting | Use case |
|---|---|---|
| **External + OAuth** | App developer hosts | Backend integrations (Zapier-like), connectors, reporting |
| **Embedded (iframe)** | App developer hosts | Admin UI extensions (Klaviyo dashboard in admin) |
| **Edge function** | Shopio runtime | Business logic (custom discount rules, shipping calc, cart transform) |
| **Pure data consumer** | App developer hosts | Webhooks-only, no UI |
| **Theme block extension** *(Fáze 2+)* | Shopio runtime | Section components installable into storefront themes |
| **Checkout UI extension** *(Fáze 3+)* | Shopio runtime | Custom checkout fields, post-purchase upsells |

### 8.2 App development lifecycle

```
1. Developer signs up on partners.shopio.com
2. Creates app in partner dashboard:
   - Name, description, icon
   - Distribution kind (public_marketplace | private | custom)
   - OAuth redirect URLs
   - Required scopes
   - Webhook topics planned
   - Pricing plan
3. Develops app locally
   - Use @shopio/cli scaffold: `shopio app create my-app --template embedded`
   - Test in dev tenant (sandbox)
4. Submit for review
   - Status: draft → under_review
   - Platform staff reviews: code quality, security, scope justification, GDPR compliance
5. Approval
   - Status: approved → published in marketplace
6. Iterate: new versions go through review again
```

### 8.3 Install flow (merchant side)

```
1. Merchant browses app marketplace (in admin → /apps/marketplace)
2. Clicks "Install" on app card
3. Redirected to /oauth/authorize with app's client_id, scopes
4. Consent screen:
   - "App XYZ wants to:
     - Read products
     - Write orders
     - Send webhooks on order events
     - [GDPR notice if processor]"
5. Merchant approves
6. Server creates app_installations row, issues tokens
7. Redirected back to app's install URL with installation_id
8. App receives webhook app.installed with installation details
9. App may need additional setup (its own UI) — embedded apps show config screen in admin iframe
10. status='installed' → 'active'
```

### 8.4 Embedded apps (App Bridge)

Embedded apps render in iframe within admin at `/apps/{installation_id}`. SDK `@shopio/app-bridge-react` provides:

```ts
import { AppBridgeProvider, useShopioContext, useToast } from '@shopio/app-bridge-react';

function MyApp() {
  const { tenantId, storeId, session } = useShopioContext();
  const toast = useToast();

  return (
    <button onClick={() => toast.success('Hello from embedded app')}>
      Click me
    </button>
  );
}

// Mount
<AppBridgeProvider>
  <MyApp />
</AppBridgeProvider>
```

App Bridge features:
- Session token (short-lived JWT) for authenticated calls back to Shopio
- Toast / modal / navigation primitives (consistent UX)
- Context (current resource being edited)
- Resource picker (`useResourcePicker`)
- Sandboxed iframe (strict CSP, postMessage protocol)

### 8.5 Embedded app session tokens

Embedded apps don't have direct user credentials. Instead:
1. Admin loads iframe with signed session token in URL
2. App calls Shopio API with `Authorization: Bearer <session_token>`
3. Server validates JWT signature, ensures scopes match app's grants
4. Session token TTL: 60 sec; auto-refresh via App Bridge

### 8.6 Plugin sandboxing — edge functions

Edge functions run in V8 isolates (Deno Deploy or Cloudflare Workers):

```ts
// my-function.ts
import { defineFunction, CartTransform } from '@shopio/functions';

export default defineFunction<CartTransform>({
  kind: 'cart_transform',
  handler: async ({ cart, customer, context }) => {
    if (customer?.tags?.includes('vip')) {
      return {
        operations: [
          { kind: 'discount_apply', value_kind: 'percent', value: 1000, target: 'subtotal' }                                                                                                                                       // 10%
        ]
      };
    }
    return { operations: [] };
  }
});
```

**Constraints:**
- 100ms execution timeout (configurable up to 500ms; affects checkout latency)
- 128 MB memory
- No network access (read-only context provided)
- No filesystem
- No `eval`, no dynamic imports
- Whitelisted std lib (date, JSON, crypto basic)
- Output schema validated server-side

**Deploy flow:**
1. App author bundles function (Rollup/esbuild)
2. `shopio functions deploy --tenant tnt_aB` (CLI)
3. Bundle uploaded to S3, validated (size, AST checks)
4. Edge runtime invalidates cache, new version active

### 8.7 Plugin permission scopes (extra agent scopes)

Beyond OAuth scopes (per `4.4`), apps can declare:

- `webhook_topics` they want to subscribe (some require review)
- `function_kinds` they want to register (e.g., `cart_transform`, `discount_compute`)
- `admin_extensions` they want to render (slot ID: e.g., `product_detail.sidebar`, `order_detail.actions`)
- `storefront_extensions` they want to inject (Fáze 2+)

Reviewed at app approval time.

### 8.8 App uninstall

```
1. Merchant clicks "Uninstall" in /apps/installed
2. Confirmation modal (warning about data loss)
3. Server marks installation status='uninstalling'
4. Emits app.uninstall_requested webhook
5. Webhook handler (app) has 24h to gracefully clean up (its own data)
6. After 24h OR upon app confirming via API: status='uninstalled'
7. OAuth tokens revoked
8. Webhook subscriptions cancelled
9. Edge functions disabled
10. Embedded UI access blocked
11. App's stored config (app_installations.app_settings) retained 30 days then deleted
```

### 8.9 App marketplace

`/apps/marketplace` (admin):
- Browse by category
- Search
- Filter by free/paid, rating, ratings count
- App detail page with screenshots, reviews, pricing, scopes requested
- "Install" CTA

Platform staff reviews:
- Code submission (for edge functions; binary review)
- Security review (OAuth scopes justification)
- UX review (screenshots, demo)
- Privacy policy compliance
- Pricing transparency

Approved apps published to public marketplace.

### 8.10 App billing (Fáze 2)

Embedded billing handled via Shopio:
- App declares pricing plans
- Merchant subscribes at install (or upgrade later)
- Shopio charges merchant via tenant's billing
- 80/20 revenue split:
  - 80% paid out to publisher (Stripe Connect)
  - 20% retained by Shopio

App can also charge externally (Stripe Connect direct); declared in app config.

MVP: basic charge events tracked; full embedded billing Fáze 2.

### 8.11 App analytics for publishers

`partners.shopio.com` shows:
- Installs over time
- Active installs
- Churn (uninstalls)
- Revenue (if paid)
- Reviews + ratings
- Webhook delivery success rate (their endpoints' health)
- Edge function invocation success rate + latency

### 8.12 Admin UI extension slots

Apps can register UI extensions at named slots:

| Slot ID | Where in admin |
|---|---|
| `product_detail.sidebar` | Right sidebar of product editor |
| `product_detail.tabs` | New tab in product editor |
| `order_detail.actions` | Order detail page action buttons |
| `order_detail.timeline` | Timeline entries |
| `customer_detail.sidebar` | Right sidebar customer detail |
| `dashboard.widgets` | Dashboard custom widgets |
| `settings.menu` | Settings sub-menu entry |
| `bulk_actions.{resource}` | Bulk action items (e.g., `bulk_actions.products`) |

Each rendering = iframe with App Bridge context.

### 8.13 MCP server hosting (key differentiator)

Every tenant automatically gets MCP server endpoint:
```
wss://api.shopio.com/mcp/{tenant_id}
```

AI agents (Claude Desktop, Cursor, custom clients) connect:
1. User configures MCP client with URL + OAuth credentials
2. Client OAuth flow → gets `agent:*` scoped token
3. Client connects to MCP endpoint, lists available tools
4. Tools auto-generated from OpenAPI spec (per `04 §11`):
   - Each read endpoint → `mcp_tool` (read-only)
   - Each write endpoint with safe semantics → tool (with confirmation requirements)
   - Each unsafe endpoint excluded by default

**Pre-registered tool sets:**
- `agent_catalog`: search products, get product, list categories
- `agent_orders`: search orders, get order, place order, refund order
- `agent_customers`: search customers, get customer
- `agent_analytics`: query analytics
- `agent_full`: ALL tools (requires `agent:*` scope)

Merchant configures in /settings/developer/mcp:
- Toggle MCP server enabled (default: yes)
- Per-scope rate limits
- Token issuance + revocation
- Audit log of AI agent calls

---

## 9. Edge functions

### 9.1 Function kinds (extension points)

| Kind | When invoked | Input | Output |
|---|---|---|---|
| `cart_validate` | Cart updated | Cart + context | Validation errors |
| `cart_transform` | Cart computed | Cart + customer | Operations (add/remove/discount) |
| `checkout_validate` | Checkout step | Checkout state | Validation errors |
| `discount_compute` | Pricing engine eval | Cart + customer + applicable coupons | Applied discounts |
| `shipping_compute` | Shipping rate query | Cart + address | Rate options (overrides defaults) |
| `tax_compute` | Tax engine | Cart + jurisdiction | Tax overrides |
| `payment_method_filter` | Checkout payment selector | Available methods + context | Filtered methods |
| `order_process` | Order placed | Order | Post-process actions (tag, route to warehouse) |
| `custom` | Manual invocation via API | Anything | Anything |

### 9.2 Development workflow

```bash
# Scaffold
shopio functions init --kind cart_transform my-function
cd my-function

# Code in src/index.ts
# Local test (mocked runtime)
shopio functions test --input ./tests/sample-cart.json

# Deploy to staging tenant
shopio functions deploy --tenant tnt_staging --version preview

# Test live
# Promote to production
shopio functions deploy --tenant tnt_prod --version 1.0.0
```

### 9.3 Function bundle requirements

- Bundled with esbuild (single JS file)
- < 1 MB compressed
- No external network calls
- No filesystem
- No `eval` / `Function` constructor
- TypeScript supported (transpiled to JS)
- ESM only (no CommonJS)

### 9.4 Function context API

Read-only context object passed:

```ts
interface FunctionContext {
  tenant: { id: string; settings: TenantSettings };
  store: { id: string };
  customer?: CustomerSnapshot;
  cart?: CartSnapshot;
  order?: OrderSnapshot;
  request: { ip: string; locale: string; currency: string };
  features: { mcp_enabled: boolean; ... };
  log: (level: 'info'|'warn'|'error', msg: string, extra?: any) => void;                                                                                                                                                                  // captured
}
```

### 9.5 Function invocation telemetry

Every invocation logged in `edge_function_invocations`:
- Duration, status, memory
- First 5 log lines retained
- Errors with stack traces

Merchant + developer can view in dashboards.

### 9.6 Rate limits per function

Per function-kind global tenant limit:
- `cart_transform`: 5000/min
- `discount_compute`: 10000/min
- `order_process`: 100/min

Exceeded → invocation skipped (no failure to merchant; default behavior applied).

### 9.7 Multi-function ordering

If multiple functions registered for same kind (e.g., 2 apps both register `cart_transform`):
- Execute in deterministic order (by app install date, tie-break by app_id)
- Outputs composed sequentially (later function sees earlier's effects)
- Total budget shared (sum of all functions' timeouts) — enforced

---

## 10. Business rules

### RULE-DEV-001: API versioning date-based

Per `04`. Version in URL path `/api/2026-05-20/...`. Apps declare `api_version` they use in `app_versions`. SDK pins version.

### RULE-DEV-002: Breaking changes require new version

Removing fields, changing required fields, changing semantics → new API version. Old version supported 12 months minimum.

### RULE-DEV-003: Tokens hashed at rest

argon2id. Never logged. Never returned after creation (PAT/SA only shown once at creation).

### RULE-DEV-004: PKCE mandatory

All OAuth flows require PKCE (S256). Even confidential clients.

### RULE-DEV-005: Refresh token rotation + theft detection

Each refresh issues new pair, consumes old. Reuse of consumed refresh → entire family revoked. App must re-auth via OAuth.

### RULE-DEV-006: Scope minimum principle

App's listing must justify each requested scope. Platform reviews. Over-requesting → review rejection.

### RULE-DEV-007: HMAC webhook signing mandatory

All webhooks signed (HMAC-SHA256). Subscribers verify (per §5.4). 5-min timestamp tolerance to prevent replay.

### RULE-DEV-008: Webhook delivery at-least-once

Subscriber must deduplicate using `event_id`. Outbox ensures emission.

### RULE-DEV-009: Webhook auto-pause on consecutive failures

100 consecutive 4xx/5xx/timeout → subscription auto-paused. Tenant notified. Manual resume + endpoint fix.

### RULE-DEV-010: API rate limits

Per token, per endpoint:
- Default: 60/min (most endpoints)
- Bulk endpoints (search, exports): 10/min
- Burst: 2× limit for 10s window
- Per tenant: aggregated across all tokens

Returned in headers:
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 42
X-RateLimit-Reset: 1716220860
Retry-After: 30                                                                                                                                                                                                                              (on 429)
```

### RULE-DEV-011: 429 with backoff

On 429, SDK respects `Retry-After`. Manual clients should too. Repeated 429 spam → temporary token throttle (5 min).

### RULE-DEV-012: API analytics per tenant

Tenant sees per-token + per-app:
- Request count
- Error count by status
- p50/p95/p99 latency
- Top endpoints
- Recent errors with samples

### RULE-DEV-013: Apps declare GDPR processor status

If app processes EU customer PII → must declare `gdpr_processor=true`. Listing shows badge. DPA template provided.

### RULE-DEV-014: App scopes shown at consent

Consent screen shows human-readable scope descriptions. Required vs optional split.

### RULE-DEV-015: Embedded apps strict CSP

iframe sandbox attributes: `allow-scripts allow-same-origin allow-forms`. No `allow-top-navigation`. CSP via headers.

### RULE-DEV-016: App Bridge session token TTL 60s

Short-lived. Auto-refresh via App Bridge SDK. Reduces blast radius if leaked.

### RULE-DEV-017: Edge function timeout enforcement

Hard kill at timeout (default 100ms). Caller default behavior applied if function exceeds (cart_transform: no transform applied).

### RULE-DEV-018: Edge function bundle size limit

< 1 MB compressed. Larger → deploy rejected. Encourages small focused functions.

### RULE-DEV-019: Edge function no network

`fetch`, `XMLHttpRequest`, WebSocket disabled. Only read-only context.

### RULE-DEV-020: Multi-function deterministic ordering

Function kind composed by install date. Visible in admin per kind. Disable individual functions allowed.

### RULE-DEV-021: App review process

Platform staff review every app + every version. Criteria:
- Security (scope justification, code patterns)
- UX (consent screen clear, install flow smooth)
- GDPR compliance (privacy policy, processor declaration)
- Functionality (does what listing claims)

SLA: 5 business days first review; 2 days subsequent versions.

### RULE-DEV-022: Revenue share 80/20

Per §0.4. Updated in `DEC-PLUGIN-001`. Tiered above 1M EUR yearly.

### RULE-DEV-023: App suspension

Platform may suspend app for:
- Security incident
- TOS violation
- Excessive complaints/reports
- Failure to fix critical bug within SLA

Suspended → no new installs; existing tokens revoked; merchants notified.

### RULE-DEV-024: App data deletion (GDPR)

On tenant deletion OR merchant explicit request:
- All `app_installations` data deleted within 30 days
- App owners notified via `app.tenant_data_delete_requested` webhook
- App has 30 days to delete its own copy of tenant data

### RULE-DEV-025: MCP server tenant-scoped

Each tenant has own MCP endpoint with isolated context. Cross-tenant tool calls impossible.

### RULE-DEV-026: MCP audit log

Every MCP tool invocation logged with:
- Agent token (which AI)
- Tool name
- Input (truncated)
- Output (truncated)
- User who initiated (if applicable)
- Timestamp

Per `30-security.md`.

### RULE-DEV-027: Storefront API public

Storefront API endpoints (read-only product catalog, cart operations) accessible with public Storefront API key (separate from OAuth). Limited scopes. Rate-limited per IP.

### RULE-DEV-028: API versioning sunsetting

12 months minimum support post-deprecation. Last 30 days: hard deprecation warning in response headers. After: 410 Gone with migration link.

### RULE-DEV-029: Apps must handle deprecation

App author notified when their declared `api_version` reaches deprecation:
- 6 months before: email warning
- 3 months: dashboard alert
- 1 month: forced upgrade banner in admin app listing

Failure to update by sunset: app suspended from new installs (existing installs continue temporarily on legacy fallback if possible).

### RULE-DEV-030: Webhook payload max size

10 MB compressed. Larger events split or referenced (event includes URL to fetch full payload).

---

## 11. REST API endpoints

### 11.1 API tokens (admin)

```
GET    /api/{date}/developer/api-tokens
POST   /api/{date}/developer/api-tokens                                                                                                                                                                                                            # creates PAT or service account
GET    /api/{date}/developer/api-tokens/{id}
DELETE /api/{date}/developer/api-tokens/{id}                                                                                                                                                                                                        # revoke
POST   /api/{date}/developer/api-tokens/{id}:rotate                                                                                                                                                                                                  # issue new + revoke old
```

### 11.2 OAuth endpoints (well-known)

```
GET    /oauth/authorize                                                                                                                                                                                                                                # consent screen
POST   /oauth/token                                                                                                                                                                                                                                     # token issuance
POST   /oauth/revoke
POST   /oauth/introspect                                                                                                                                                                                                                                # RFC 7662
GET    /.well-known/oauth-authorization-server                                                                                                                                                                                                          # metadata
GET    /.well-known/openid-configuration                                                                                                                                                                                                                 # if OIDC supported
```

### 11.3 Apps + installations (admin)

```
GET    /api/{date}/developer/apps                                                                                                                                                                                                                          # browse marketplace
GET    /api/{date}/developer/apps/{id}
GET    /api/{date}/developer/installations                                                                                                                                                                                                                  # installed in tenant
GET    /api/{date}/developer/installations/{id}
POST   /api/{date}/developer/installations/{id}:disable
POST   /api/{date}/developer/installations/{id}:enable
DELETE /api/{date}/developer/installations/{id}                                                                                                                                                                                                              # uninstall
GET    /api/{date}/developer/installations/{id}/usage                                                                                                                                                                                                       # API calls, webhook deliveries
```

### 11.4 Webhooks (admin)

```
GET    /api/{date}/developer/webhooks
POST   /api/{date}/developer/webhooks
GET    /api/{date}/developer/webhooks/{id}
PATCH  /api/{date}/developer/webhooks/{id}
DELETE /api/{date}/developer/webhooks/{id}
POST   /api/{date}/developer/webhooks/{id}:pause
POST   /api/{date}/developer/webhooks/{id}:resume
GET    /api/{date}/developer/webhooks/{id}/deliveries
GET    /api/{date}/developer/webhooks/{id}/deliveries/{delivery_id}
POST   /api/{date}/developer/webhooks/{id}/deliveries/{delivery_id}:replay
POST   /api/{date}/developer/webhooks/{id}:test                                                                                                                                                                                                                # send test payload
GET    /api/{date}/developer/webhooks/topics                                                                                                                                                                                                                    # catalog of available topics
```

### 11.5 Edge functions (admin)

```
GET    /api/{date}/developer/functions
POST   /api/{date}/developer/functions                                                                                                                                                                                                                          # deploy
GET    /api/{date}/developer/functions/{id}
PATCH  /api/{date}/developer/functions/{id}
DELETE /api/{date}/developer/functions/{id}
POST   /api/{date}/developer/functions/{id}:enable
POST   /api/{date}/developer/functions/{id}:disable
POST   /api/{date}/developer/functions/{id}:invoke-test                                                                                                                                                                                                          # body: input payload
GET    /api/{date}/developer/functions/{id}/invocations
GET    /api/{date}/developer/functions/{id}/invocations/{invocation_id}
GET    /api/{date}/developer/functions/{id}/logs
GET    /api/{date}/developer/functions/{id}/metrics
```

### 11.6 MCP server (per tenant)

```
WS     wss://api.shopio.com/mcp/{tenant_id}                                                                                                                                                                                                                       # MCP protocol over WebSocket
GET    /api/{date}/developer/mcp/tools                                                                                                                                                                                                                             # list available tools (by scope)
GET    /api/{date}/developer/mcp/audit-log                                                                                                                                                                                                                          # AI agent activity
PATCH  /api/{date}/developer/mcp/settings                                                                                                                                                                                                                            # toggle enabled, configure
```

### 11.7 Marketplace (public, partner side)

```
GET    /api/{date}/marketplace/apps                                                                                                                                                                                                                                  # public catalog
GET    /api/{date}/marketplace/apps/{slug}
GET    /api/{date}/marketplace/apps/{slug}/versions
GET    /api/{date}/marketplace/apps/{slug}/reviews
GET    /api/{date}/marketplace/categories
```

### 11.8 Partner dashboard (partners.shopio.com)

```
GET    /partner/api/apps                                                                                                                                                                                                                                              # MY apps
POST   /partner/api/apps                                                                                                                                                                                                                                              # create
GET    /partner/api/apps/{id}
PATCH  /partner/api/apps/{id}
POST   /partner/api/apps/{id}/versions                                                                                                                                                                                                                                # publish new version
POST   /partner/api/apps/{id}:submit-for-review
GET    /partner/api/apps/{id}/installations                                                                                                                                                                                                                            # which tenants installed
GET    /partner/api/apps/{id}/analytics
GET    /partner/api/apps/{id}/revenue
GET    /partner/api/apps/{id}/reviews
POST   /partner/api/apps/{id}/reviews/{review_id}:respond
GET    /partner/api/payouts                                                                                                                                                                                                                                              # publisher payouts
GET    /partner/api/billing-events
```

### 11.9 API analytics (admin)

```
GET    /api/{date}/developer/analytics/usage                                                                                                                                                                                                                              # per token + endpoint
GET    /api/{date}/developer/analytics/errors                                                                                                                                                                                                                              # 4xx/5xx breakdown
GET    /api/{date}/developer/analytics/latency
GET    /api/{date}/developer/analytics/webhook-delivery-rate
```

### 11.10 Example: Create PAT

```http
POST /api/2026-05-20/developer/api-tokens HTTP/1.1
Authorization: Bearer <admin_session>
Content-Type: application/json

{
  "kind": "personal_access",
  "name": "CI Deploy Script",
  "description": "Used by GitHub Actions for product imports",
  "scopes": ["read_products","write_products","read_orders"],
  "expires_at": "2027-05-20T00:00:00Z",
  "ip_allowlist": ["192.0.2.0/24"]
}
```

```jsonc
HTTP/1.1 201 Created

{
  "data": {
    "id": "tok_aB",
    "pub_id": "tok_aB1",
    "token_kind": "personal_access",
    "name": "CI Deploy Script",
    "token": "sho_pat_01ABXYZabcdefghijklmnopqrstuvw1234567890abcd",    // SHOWN ONCE — never again
    "token_hint": "abcd",
    "scopes": ["read_products","write_products","read_orders"],
    "expires_at": "2027-05-20T00:00:00Z",
    "created_at": "2026-05-20T15:00:00Z"
  }
}
```

### 11.11 Example: Subscribe webhook

```http
POST /api/2026-05-20/developer/webhooks HTTP/1.1

{
  "endpoint_url": "https://myapp.com/shopio-webhooks",
  "topics": ["order.placed","order.fulfilled","order.refunded"],
  "api_version": "2026-05-20"
}
```

```jsonc
HTTP/1.1 201 Created

{
  "data": {
    "id": "whk_aB",
    "endpoint_url": "https://myapp.com/shopio-webhooks",
    "topics": ["order.placed","order.fulfilled","order.refunded"],
    "signing_secret": "wsec_01ABXYZ...",                                  // SHOWN ONCE
    "signing_secret_hint": "XYZ...",
    "is_active": true,
    "created_at": "2026-05-20T15:00:00Z"
  }
}
```

### 11.12 Example: Test webhook delivery

```http
POST /api/2026-05-20/developer/webhooks/whk_aB:test HTTP/1.1

{
  "topic": "order.placed"
}
```

Server sends a synthetic event to subscriber.

```jsonc
HTTP/1.1 200 OK

{
  "data": {
    "delivery_id": "del_xY",
    "status": "delivered",
    "response_status_code": 200,
    "latency_ms": 142
  }
}
```

### 11.13 Example: OAuth token exchange

```http
POST /oauth/token HTTP/1.1
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code=auth_xyz
&code_verifier=abc...
&redirect_uri=https://myapp.com/oauth/callback
&client_id=app_aB
&client_secret=sec_xyz
```

```jsonc
HTTP/1.1 200 OK
Cache-Control: no-store

{
  "access_token": "sho_at_01ABXYZ...",
  "refresh_token": "sho_rt_01ABXYZ...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "read_products write_orders",
  "installation_id": "ins_aB",
  "tenant_id": "tnt_aB"
}
```

---

## 12. GraphQL schema

```graphql
type App implements Node {
  id: ID!
  pubId: String!
  slug: String!
  name: String!
  descriptionShort: String!
  descriptionHtml: String!
  iconUrl: String
  previewImages: JSON
  category: String
  tags: [String!]
  publisher: AppPublisher!
  distributionKind: AppDistributionKind!
  embedded: Boolean!
  embeddedAppUrl: String
  latestVersion: String!
  pricingKind: AppPricingKind!
  pricingPlans: JSON
  freeTrialDays: Int
  requiredScopes: [String!]!
  optionalScopes: [String!]
  webhookTopics: [String!]
  gdprProcessor: Boolean!
  dataProcessingDisclosureHtml: String
  privacyPolicyUrl: String
  termsUrl: String
  status: AppStatus!
  totalInstalls: Int!
  activeInstalls: Int!
  averageRating: Float
  ratingCount: Int!
  reviews(first: Int = 10): AppReviewConnection!
  versions: [AppVersion!]!
  createdAt: DateTime!
}

enum AppStatus { DRAFT UNDER_REVIEW APPROVED REJECTED PUBLISHED SUSPENDED DEPRECATED }
enum AppDistributionKind { PUBLIC_MARKETPLACE PRIVATE_INSTALL_ONLY CUSTOM_INSTALL }
enum AppPricingKind { FREE ONE_TIME SUBSCRIPTION USAGE_BASED CUSTOM }

type AppPublisher {
  accountId: ID!
  displayName: String!
  email: String!
  url: String
}

type AppVersion {
  id: ID!
  app: App!
  version: String!
  releaseNotesHtml: String
  minPlatformVersion: String!
  apiVersion: String!
  reviewStatus: AppReviewStatus!
  publishedAt: DateTime
}

enum AppReviewStatus { PENDING APPROVED REJECTED }

type AppInstallation implements Node {
  id: ID!
  pubId: String!
  app: App!
  installedVersion: String!
  status: AppInstallationStatus!
  grantedScopes: [String!]!
  appSettings: JSON
  billingStatus: AppBillingStatus
  billingPlan: String
  installedBy: User
  installedAt: DateTime!
  uninstalledAt: DateTime
}

enum AppInstallationStatus { INSTALLING INSTALLED ACTIVE DISABLED UNINSTALLING UNINSTALLED SUSPENDED }
enum AppBillingStatus { TRIAL ACTIVE PAST_DUE CANCELLED }

type ApiToken implements Node {
  id: ID!
  pubId: String!
  tokenKind: ApiTokenKind!
  name: String!
  description: String
  tokenPrefix: String!
  tokenHint: String!
  scopes: [String!]!
  ipAllowlist: [String!]
  expiresAt: DateTime
  status: ApiTokenStatus!
  lastUsedAt: DateTime
  useCount: Int!
  createdAt: DateTime!
  createdBy: User
}

enum ApiTokenKind { PERSONAL_ACCESS SERVICE_ACCOUNT ADMIN_API_LEGACY }
enum ApiTokenStatus { ACTIVE REVOKED EXPIRED }

type WebhookSubscription implements Node {
  id: ID!
  pubId: String!
  ownerKind: WebhookOwnerKind!
  appInstallation: AppInstallation
  endpointUrl: String!
  topics: [String!]!
  apiVersion: String!
  signingSecretHint: String!
  isActive: Boolean!
  retryStrategy: WebhookRetryStrategy!
  maxRetryAttempts: Int!
  consecutiveFailures: Int!
  pausedDueToFailures: Boolean!
  filterExpression: String
  createdAt: DateTime!
  recentDeliveries(first: Int = 20): WebhookDeliveryConnection!
}

enum WebhookOwnerKind { APP_INSTALLATION MANUAL_SUBSCRIBER }
enum WebhookRetryStrategy { EXPONENTIAL LINEAR IMMEDIATE_THEN_EXPONENTIAL }

type WebhookDelivery implements Node {
  id: ID!
  subscription: WebhookSubscription!
  eventId: ID!
  topic: String!
  payload: JSON!
  status: WebhookDeliveryStatus!
  attempts: Int!
  scheduledAt: DateTime!
  firstAttemptAt: DateTime
  lastAttemptAt: DateTime
  deliveredAt: DateTime
  abandonedAt: DateTime
  lastResponseStatusCode: Int
  lastResponseBodyExcerpt: String
  lastErrorMessage: String
  totalLatencyMs: Int
}

enum WebhookDeliveryStatus { PENDING DELIVERED FAILED RETRYING ABANDONED }

type EdgeFunction implements Node {
  id: ID!
  pubId: String!
  name: String!
  description: String
  functionKind: EdgeFunctionKind!
  ownerKind: EdgeFunctionOwnerKind!
  appInstallation: AppInstallation
  bundleHash: String!
  bundleSizeBytes: Int!
  timeoutMs: Int!
  memoryLimitMb: Int!
  environmentVariables: JSON!
  version: Int!
  status: EdgeFunctionStatus!
  totalInvocations: Int!
  totalErrors: Int!
  deployedAt: DateTime
  createdAt: DateTime!
}

enum EdgeFunctionKind {
  CART_VALIDATE CART_TRANSFORM CHECKOUT_VALIDATE DISCOUNT_COMPUTE
  SHIPPING_COMPUTE TAX_COMPUTE PAYMENT_METHOD_FILTER ORDER_PROCESS CUSTOM
}
enum EdgeFunctionOwnerKind { TENANT_CUSTOM APP_INSTALLATION }
enum EdgeFunctionStatus { DRAFT DEPLOYING ENABLED DISABLED FAILED_DEPLOY SUSPENDED }

type EdgeFunctionInvocation {
  id: ID!
  function: EdgeFunction!
  functionVersion: Int!
  triggeredByKind: String!
  status: EdgeFunctionInvocationStatus!
  durationMs: Int!
  memoryUsedMb: Int
  logLines: Int!
  errorMessage: String
  occurredAt: DateTime!
}

enum EdgeFunctionInvocationStatus { SUCCESS ERROR TIMEOUT MEMORY_EXCEEDED RATE_LIMITED }

type AppReview {
  id: ID!
  app: App!
  rating: Int!
  title: String
  body: String
  publisherResponse: String
  publisherResponseAt: DateTime
  helpfulCount: Int!
  createdAt: DateTime!
}

type ApiUsageMetric {
  endpoint: String!
  method: String!
  count: Int!
  errorCount: Int!
  p50Ms: Int!
  p95Ms: Int!
  p99Ms: Int!
}

extend type Query {
  # Marketplace browse
  marketplaceApps(filter: AppFilter, first: Int, after: String): AppConnection!
  marketplaceApp(id: ID, slug: String): App
  marketplaceCategories: [String!]!

  # Installations
  myAppInstallations(status: [AppInstallationStatus!]): [AppInstallation!]!
  appInstallation(id: ID): AppInstallation

  # API tokens
  apiTokens(filter: ApiTokenFilter): [ApiToken!]! @auth(requires: PERM_DEVELOPER_TOKEN_VIEW)
  apiToken(id: ID!): ApiToken @auth(requires: PERM_DEVELOPER_TOKEN_VIEW)

  # Webhooks
  webhookSubscriptions(filter: WebhookFilter): [WebhookSubscription!]! @auth(requires: PERM_DEVELOPER_WEBHOOK_VIEW)
  webhookSubscription(id: ID!): WebhookSubscription
  webhookDelivery(id: ID!): WebhookDelivery
  webhookTopics: [WebhookTopic!]!                                                                                                                                                                                                                                                       # catalog

  # Functions
  edgeFunctions(filter: EdgeFunctionFilter): [EdgeFunction!]! @auth(requires: PERM_DEVELOPER_FUNCTION_VIEW)
  edgeFunction(id: ID!): EdgeFunction
  edgeFunctionInvocations(functionId: ID!, first: Int, after: String): EdgeFunctionInvocationConnection!

  # API analytics
  apiUsage(period: PeriodInput!, tokenId: ID, endpoint: String): [ApiUsageMetric!]! @auth(requires: PERM_DEVELOPER_ANALYTICS_VIEW)

  # MCP
  mcpAvailableTools: [MCPTool!]!
  mcpAuditLog(period: PeriodInput!, agentName: String): [MCPInvocationLog!]! @auth(requires: PERM_DEVELOPER_MCP_VIEW)
}

extend type Mutation {
  # API tokens
  createApiToken(input: CreateApiTokenInput!): ApiTokenCreatePayload! @auth(requires: PERM_DEVELOPER_TOKEN_MANAGE)
  revokeApiToken(id: ID!, reason: String): ApiToken! @auth(requires: PERM_DEVELOPER_TOKEN_MANAGE)
  rotateApiToken(id: ID!): ApiTokenCreatePayload! @auth(requires: PERM_DEVELOPER_TOKEN_MANAGE)

  # App lifecycle
  startAppInstall(appId: ID!, redirectUri: String): AppInstallChallenge! @auth(requires: PERM_DEVELOPER_APP_INSTALL)
  disableAppInstallation(id: ID!): AppInstallation! @auth(requires: PERM_DEVELOPER_APP_MANAGE)
  enableAppInstallation(id: ID!): AppInstallation! @auth(requires: PERM_DEVELOPER_APP_MANAGE)
  uninstallApp(id: ID!, reason: String): DeletePayload! @auth(requires: PERM_DEVELOPER_APP_MANAGE)

  # App reviews
  submitAppReview(input: AppReviewInput!): AppReview!
  reportAppReview(reviewId: ID!, reason: String!): MutationPayload!

  # Webhooks
  createWebhookSubscription(input: CreateWebhookInput!): WebhookSubscriptionCreatePayload! @auth(requires: PERM_DEVELOPER_WEBHOOK_MANAGE)
  updateWebhookSubscription(id: ID!, input: UpdateWebhookInput!): WebhookSubscription! @auth(requires: PERM_DEVELOPER_WEBHOOK_MANAGE)
  pauseWebhookSubscription(id: ID!): WebhookSubscription! @auth(requires: PERM_DEVELOPER_WEBHOOK_MANAGE)
  resumeWebhookSubscription(id: ID!): WebhookSubscription! @auth(requires: PERM_DEVELOPER_WEBHOOK_MANAGE)
  deleteWebhookSubscription(id: ID!): DeletePayload! @auth(requires: PERM_DEVELOPER_WEBHOOK_MANAGE)
  testWebhookSubscription(id: ID!, topic: String!): WebhookDelivery! @auth(requires: PERM_DEVELOPER_WEBHOOK_MANAGE)
  replayWebhookDelivery(id: ID!): WebhookDelivery! @auth(requires: PERM_DEVELOPER_WEBHOOK_MANAGE)

  # Edge functions
  deployEdgeFunction(input: DeployEdgeFunctionInput!): EdgeFunction! @auth(requires: PERM_DEVELOPER_FUNCTION_MANAGE)
  updateEdgeFunctionSettings(id: ID!, input: EdgeFunctionSettingsInput!): EdgeFunction! @auth(requires: PERM_DEVELOPER_FUNCTION_MANAGE)
  enableEdgeFunction(id: ID!): EdgeFunction! @auth(requires: PERM_DEVELOPER_FUNCTION_MANAGE)
  disableEdgeFunction(id: ID!): EdgeFunction! @auth(requires: PERM_DEVELOPER_FUNCTION_MANAGE)
  invokeEdgeFunctionTest(id: ID!, payload: JSON!): EdgeFunctionInvocation! @auth(requires: PERM_DEVELOPER_FUNCTION_MANAGE)
  deleteEdgeFunction(id: ID!): DeletePayload! @auth(requires: PERM_DEVELOPER_FUNCTION_MANAGE)

  # MCP
  updateMcpSettings(input: McpSettingsInput!): McpSettings! @auth(requires: PERM_DEVELOPER_MCP_MANAGE)
}

type ApiTokenCreatePayload {
  apiToken: ApiToken!
  token: String!                                                                                                                                                                                                                                                                                # plaintext, shown once
}

type WebhookSubscriptionCreatePayload {
  webhookSubscription: WebhookSubscription!
  signingSecret: String!                                                                                                                                                                                                                                                                          # plaintext, shown once
}

type AppInstallChallenge {
  authorizationUrl: String!
  state: String!
}

type WebhookTopic {
  name: String!
  description: String!
  category: String!
  requiresReview: Boolean!
  payloadSchemaJson: String!
}

type MCPTool {
  name: String!
  description: String!
  requiredScope: String!
  inputSchemaJson: String!
}

type MCPInvocationLog {
  id: ID!
  toolName: String!
  agentName: String!
  inputExcerpt: String
  outputExcerpt: String
  status: String!
  durationMs: Int!
  occurredAt: DateTime!
}
```

---

## 13. Events

| Build-spec ID | Wire | Payload |
|---|---|---|
| `EVENT-DEV-APP-CREATED` | `dev.app_created` | `{ app }` |
| `EVENT-DEV-APP-SUBMITTED-FOR-REVIEW` | `dev.app_submitted_for_review` | `{ app, version }` |
| `EVENT-DEV-APP-APPROVED` | `dev.app_approved` | `{ app, version }` |
| `EVENT-DEV-APP-REJECTED` | `dev.app_rejected` | `{ app, version, reason }` |
| `EVENT-DEV-APP-PUBLISHED` | `dev.app_published` | `{ app, version }` |
| `EVENT-DEV-APP-SUSPENDED` | `dev.app_suspended` | `{ app, reason }` |
| `EVENT-DEV-APP-DEPRECATED` | `dev.app_deprecated` | `{ app, sunset_date }` |
| `EVENT-DEV-APP-INSTALLED` | `dev.app_installed` | `{ installation }` |
| `EVENT-DEV-APP-UPGRADED` | `dev.app_upgraded` | `{ installation, previous_version, new_version }` |
| `EVENT-DEV-APP-UNINSTALL-REQUESTED` | `dev.app_uninstall_requested` | `{ installation }` |
| `EVENT-DEV-APP-UNINSTALLED` | `dev.app_uninstalled` | `{ installation }` |
| `EVENT-DEV-APP-CONFIG-UPDATED` | `dev.app_config_updated` | `{ installation }` |
| `EVENT-DEV-OAUTH-TOKEN-ISSUED` | `dev.oauth_token_issued` | `{ token_hint, client_id, scopes }` |
| `EVENT-DEV-OAUTH-TOKEN-REVOKED` | `dev.oauth_token_revoked` | `{ token_hint }` |
| `EVENT-DEV-OAUTH-REFRESH-REUSE-DETECTED` | `dev.oauth_refresh_reuse_detected` | `{ family_id, client_id }` (security alert) |
| `EVENT-DEV-API-TOKEN-CREATED` | `dev.api_token_created` | `{ token_hint, scopes }` |
| `EVENT-DEV-API-TOKEN-REVOKED` | `dev.api_token_revoked` | `{ token_hint, reason }` |
| `EVENT-DEV-WEBHOOK-SUBSCRIBED` | `dev.webhook_subscribed` | `{ subscription }` |
| `EVENT-DEV-WEBHOOK-DELIVERED` | `dev.webhook_delivered` | `{ delivery }` (sampled) |
| `EVENT-DEV-WEBHOOK-FAILED-PERMANENTLY` | `dev.webhook_failed_permanently` | `{ delivery }` |
| `EVENT-DEV-WEBHOOK-AUTO-PAUSED` | `dev.webhook_auto_paused` | `{ subscription, consecutive_failures }` |
| `EVENT-DEV-FUNCTION-DEPLOYED` | `dev.function_deployed` | `{ function }` |
| `EVENT-DEV-FUNCTION-FAILED` | `dev.function_failed` | `{ function, invocation }` (sampled errors) |
| `EVENT-DEV-FUNCTION-RATE-LIMITED` | `dev.function_rate_limited` | `{ function, function_kind }` |
| `EVENT-DEV-MCP-TOOL-INVOKED` | `dev.mcp_tool_invoked` | `{ tool_name, agent_name }` (sampled; volume) |
| `EVENT-DEV-MCP-TOOL-REJECTED` | `dev.mcp_tool_rejected` | `{ tool_name, reason }` |
| `EVENT-DEV-API-RATE-LIMITED` | `dev.api_rate_limited` | `{ token_hint, endpoint }` (sampled) |
| `EVENT-DEV-API-VERSION-DEPRECATION-WARNING` | `dev.api_version_deprecation_warning` | `{ app, current_version, sunset_date }` |
| `EVENT-DEV-APP-REVIEW-SUBMITTED` | `dev.app_review_submitted` | `{ review }` |
| `EVENT-DEV-APP-DATA-DELETE-REQUESTED` | `dev.app_tenant_data_delete_requested` | `{ tenant, app }` (sent to app webhook) |
| `EVENT-DEV-PARTNER-PAYOUT-PROCESSED` | `dev.partner_payout_processed` | `{ payout }` |

**Konzumenti:**
- Partner dashboard analytics
- Tenant developer dashboard
- Security alerts (refresh reuse, repeated 401)
- Email notifications (app upgrades available, webhook paused)
- Sentry integration for app errors

---

## 14. Background jobs

| Job | Trigger | Queue | Frequency |
|---|---|---|---|
| `JOB-DELIVER-WEBHOOK` | outbox event for subscribed topic | `webhooks` | Per event |
| `JOB-RETRY-WEBHOOK-DELIVERY` | EVENT-DEV-WEBHOOK delivery failure | `webhooks-retry` | Per retry schedule |
| `JOB-AUTO-PAUSE-WEBHOOK` | consecutive failures > 100 | `webhooks` | On-demand |
| `JOB-CLEANUP-OLD-WEBHOOK-DELIVERIES` | scheduled | `maintenance` | Daily (90d retention) |
| `JOB-VALIDATE-WEBHOOK-ENDPOINT` | new subscription | `webhooks` | On-demand |
| `JOB-EXPIRE-OAUTH-AUTHORIZATION-CODES` | scheduled | `maintenance` | Every 5 min |
| `JOB-ROTATE-OAUTH-TOKENS-FAMILY` | EVENT-DEV-OAUTH-REFRESH-REUSE-DETECTED | `security` | On-demand |
| `JOB-DEPLOY-EDGE-FUNCTION` | function deploy request | `functions` | On-demand |
| `JOB-VALIDATE-EDGE-FUNCTION-BUNDLE` | function upload | `functions` | On-demand |
| `JOB-INVALIDATE-FUNCTION-CACHE-AT-EDGE` | function enable / update | `functions` | On-demand |
| `JOB-AGGREGATE-FUNCTION-METRICS` | scheduled | `analytics` | Hourly |
| `JOB-REVIEW-APP-SUBMISSION-NOTIFICATION` | EVENT-DEV-APP-SUBMITTED-FOR-REVIEW | `platform-ops` | On-demand (notify staff) |
| `JOB-NOTIFY-APP-DEPRECATION` | api version deprecation timeline | `notifications` | Scheduled (6mo, 3mo, 1mo before) |
| `JOB-COMPUTE-API-USAGE-METRICS` | scheduled | `analytics` | Hourly |
| `JOB-COMPUTE-PARTNER-REVENUE` | scheduled | `analytics` | Daily |
| `JOB-EXECUTE-PARTNER-PAYOUT` | scheduled per partner schedule | `payouts` | Monthly (default) |
| `JOB-SEND-APP-DATA-DELETE-WEBHOOK` | tenant deletion request | `webhooks` | On-demand |
| `JOB-RECOMPUTE-APP-RATINGS` | EVENT-DEV-APP-REVIEW-SUBMITTED | `marketplace` | Debounced 5 min |
| `JOB-DETECT-ABUSE-PATTERNS` | scheduled | `security` | Hourly (rate limit abuse, scope escalation) |
| `JOB-CLEANUP-EXPIRED-TOKENS` | scheduled | `maintenance` | Daily |
| `JOB-WARN-EXPIRING-TOKENS` | scheduled | `notifications` | Daily (warn 7d before expiry) |
| `JOB-AUDIT-MCP-INVOCATIONS-DAILY` | scheduled | `analytics` | Daily aggregate |

---

## 15. UI/UX flows

### FLOW-DEV-001: Merchant installs app from marketplace

```
[Admin → /apps/marketplace]
   - Grid of apps with icons, names, ratings, "Free" or pricing
        ↓
   click app
        ↓
[App detail /apps/marketplace/{slug}]
   - Hero with screenshots
   - Description
   - Pricing (free / $X/mo / trial)
   - Reviews
   - "Install" CTA
        ↓
   click Install
        ↓
[OAuth consent screen /oauth/authorize]
   - "App XYZ wants to:
     ✓ Read products
     ✓ Write orders
     ✓ Send webhooks on order events
     ▸ Optional: read customer emails for marketing"
   - Privacy policy link
   - Approve / Cancel
        ↓
   Approve
        ↓
[Redirect to app's install URL with code]
        ↓
[App exchanges code → tokens; calls Shopio API to confirm install]
        ↓
[Embedded app shown in admin iframe at /apps/{installation_id}]
   - First-time setup wizard from app
   - Configure settings
   - Save
        ↓
[Status: active]
   - Notification: "App XYZ installed"
```

### FLOW-DEV-002: Developer publishes app

```
[partners.shopio.com signup]
   - Email + verify
   - Account created
        ↓
[Dashboard → Create app]
   - Name, description, category, icon
   - Distribution: public marketplace
   - OAuth redirect URLs
   - Scopes requested
        ↓
   Save draft
        ↓
[Develop locally]
   - `shopio app create my-app --template embedded`
   - Code, test against dev tenant
        ↓
[Dashboard → Submit for review]
   - Form: changelog, demo URL, justification for scopes
        ↓
   Submit → status='under_review'
        ↓
[Platform staff reviews — 5 business days SLA]
   - Code/security review (for edge functions)
   - UX review
   - GDPR check
   - Pricing transparency
        ↓
[Approved → status='approved' → published]
   - Email: "Your app is live"
   - Appears in marketplace
```

### FLOW-DEV-003: Subscribe + verify webhook

```
[Admin → Developer → Webhooks → "Add subscription"]
   - Endpoint URL: https://myapp.com/shopio-webhooks
   - Topics: order.placed, order.fulfilled
   - API version: 2026-05-20
        ↓
   Save
        ↓
[Server validates endpoint (test ping with synthetic event)]
   - If 200 OK → subscription created
   - If non-2xx → warning shown but subscription saved (admin can retry)
        ↓
[Subscription detail page shows:]
   - Signing secret (shown ONCE; copy to clipboard banner)
   - Topics list
   - Delivery history
   - "Test delivery" button
   - "Pause" button
   - "View recent deliveries" link
        ↓
   real event fires:
        ↓
[Delivery: POST to endpoint with HMAC signature]
   - Success (200): delivered_at recorded
   - Fail: retry per schedule
        ↓
[Delivery details accessible at /developer/webhooks/{id}/deliveries/{delivery_id}]
   - Request body, headers
   - Response status, body excerpt
   - Latency
   - "Replay" button
```

### FLOW-DEV-004: Deploy edge function

```
[Local development]
   $ shopio functions init --kind cart_transform vip-discount
   $ cd vip-discount
   ... edit src/index.ts ...
   $ shopio functions test
        ↓
   $ shopio functions deploy --tenant tnt_aB --version 1.0.0
        ↓
[CLI bundles + uploads to S3 + calls deploy API]
        ↓
[Server validates]
   - Bundle size < 1 MB
   - AST check (no eval, no fetch, ...)
   - TypeScript optional check
   - Schema validation of declared kind
        ↓
[Status: deploying → enabled]
   - Edge runtime cache invalidated
   - Active for all cart updates
        ↓
[Admin → Developer → Functions → vip-discount]
   - Status: enabled
   - Stats: invocations, errors, p95 duration
   - Recent invocations table
   - "Disable" button
   - "Edit settings" (env vars, timeout)
   - Logs (live tail)
```

### FLOW-DEV-005: Create PAT for CI

```
[Admin → /settings/developer/api-tokens → "Create token"]
   - Kind: Personal access token
   - Name: "GitHub Actions deploy"
   - Description: "Used for product imports in CI"
   - Scopes: read_products, write_products
   - Expires: 1 year
   - IP allowlist: 192.0.2.0/24 (optional)
        ↓
   Create
        ↓
[Token shown ONE TIME in modal]
   - Plaintext: sho_pat_01ABXYZ...
   - "Copy to clipboard" + "I've saved it" button
   - Warning: "Cannot be retrieved later. Save it now."
        ↓
   confirm saved
        ↓
[Token list]
   - Name: GitHub Actions deploy
   - Prefix: sho_pat_
   - Hint: ...XYZ
   - Scopes
   - Last used: never
   - Expires in: 365 days
   - [Revoke] [Rotate]
```

### FLOW-DEV-006: AI agent connects via MCP

```
[User opens Claude Desktop]
   - Settings → MCP Servers → Add new
        ↓
   - URL: wss://api.shopio.com/mcp/tnt_aB
   - OAuth: redirect to login
        ↓
[Shopio OAuth consent for agent scopes]
   - "Claude wants to:
     ✓ Search products
     ✓ Read orders
     ▸ Optional: Place orders (requires confirmation each time)"
        ↓
   Approve
        ↓
[Claude connects via WebSocket]
   - Discovers available tools (from OpenAPI auto-generated)
   - Tools available in conversation
        ↓
[User in Claude: "What were my top selling products last month?"]
   - Claude calls mcp tool `agent_analytics.top_products`
   - Result returned, formatted, shown to user
        ↓
[Audit log entry in /developer/mcp/audit-log]
   - Tool: agent_analytics.top_products
   - Agent: claude-desktop-v1
   - Input: { period: '2026-04' }
   - Output: [...]
   - Duration: 142ms
```

### FLOW-DEV-007: Webhook auto-pause

```
[Subscription endpoint returning 500 consistently]
   - 1 failure → retry per schedule
   - 10 failures → email warning to merchant
   - 50 failures → urgent email
   - 100 consecutive failures → auto-pause
        ↓
[Status: paused_due_to_failures=true]
   - In admin: red banner on subscription detail
   - Notification: "Webhook XXX auto-paused due to repeated failures"
        ↓
   merchant investigates endpoint, fixes
        ↓
[Admin → /developer/webhooks/{id} → "Resume"]
   - confirms endpoint working
   - clicks Resume
        ↓
[Resumes delivery; consecutive_failures reset]
```

---

## 16. Performance, security, testing

### 16.1 Performance targets

| Operation | p50 | p95 | p99 |
|---|---|---|---|
| OAuth token issuance | 50 ms | 150 ms | 400 ms |
| OAuth token refresh | 30 ms | 100 ms | 300 ms |
| API request authentication | 5 ms | 20 ms | 50 ms |
| API list endpoint (50 items) | 50 ms | 200 ms | 500 ms |
| Webhook delivery (subscriber response time) | 200 ms | 1000 ms | 5000 ms |
| Webhook dispatch latency (event → first attempt) | 100 ms | 500 ms | 2000 ms |
| Edge function cold start | 20 ms | 80 ms | 200 ms |
| Edge function warm execution | 5 ms | 30 ms | 100 ms |
| MCP tool invocation | 100 ms | 500 ms | 1500 ms |
| App marketplace browse | 50 ms | 200 ms | 500 ms (CDN cached) |
| App install OAuth round-trip | 1000 ms | 3000 ms | 8000 ms (includes user interaction) |

### 16.2 Scaling targets

- 1M tenants × 5 apps each = 5M installations
- 100k webhook deliveries / minute peak
- 1M edge function invocations / minute peak
- 10k OAuth tokens issued / minute
- 100k MCP tool calls / minute aggregated

### 16.3 Security

#### 16.3.1 Permissions

```
PERM-DEVELOPER-TOKEN-VIEW
PERM-DEVELOPER-TOKEN-MANAGE
PERM-DEVELOPER-WEBHOOK-VIEW
PERM-DEVELOPER-WEBHOOK-MANAGE
PERM-DEVELOPER-FUNCTION-VIEW
PERM-DEVELOPER-FUNCTION-MANAGE
PERM-DEVELOPER-APP-INSTALL
PERM-DEVELOPER-APP-MANAGE
PERM-DEVELOPER-ANALYTICS-VIEW
PERM-DEVELOPER-MCP-VIEW
PERM-DEVELOPER-MCP-MANAGE
PERM-PARTNER-APP-MANAGE                                                                                                                                                                                                                                                                              # partner dashboard
PERM-PLATFORM-APP-REVIEW                                                                                                                                                                                                                                                                              # platform staff
PERM-PLATFORM-SECURITY-INVESTIGATE
```

#### 16.3.2 Token storage

- Hashed argon2id (32 MB memory, 3 iter)
- Plaintext shown only at creation
- Hash + last-4 visible in admin
- Never logged, never in error messages
- Token rotation supported (issue new + revoke old atomic)

#### 16.3.3 OAuth security

- PKCE mandatory
- State parameter required (CSRF protection)
- Authorization code one-time use, 10-min TTL
- Refresh rotation + theft detection
- redirect_uri strictly validated (exact match)
- Confidential clients: client_secret in `Authorization` header (basic auth) OR body

#### 16.3.4 Webhook security

- HMAC-SHA256 signing
- Timestamp in signing input (replay protection)
- 5-min skew tolerance
- TLS required (HTTPS only)
- Per-subscription unique signing secret
- Secret rotation supported

#### 16.3.5 Edge function sandbox

- V8 isolate (Deno Deploy or Cloudflare Workers)
- No filesystem
- No network
- Strict timeout (hard kill)
- Memory limit
- Whitelisted std lib
- AST scan on deploy (prevent obvious attacks)

#### 16.3.6 Embedded apps

- iframe sandbox attributes
- Strict CSP
- App Bridge session token short TTL
- postMessage with origin verification
- No top-level navigation from iframe

#### 16.3.7 Rate limiting

Multi-layered:
- Per token: per-endpoint + global
- Per IP (for unauthenticated)
- Per tenant: aggregated
- Burst tolerance: 2× sustained
- 429 responses with Retry-After

#### 16.3.8 Audit

All security-relevant events to audit log (per `30-security.md`):
- Token creation / revocation
- OAuth consent grants / revocations
- App installations / uninstallations
- Refresh token reuse detection
- MCP tool invocations
- Edge function deploys
- API rate limit violations (sampled)

### 16.4 Testing

#### 16.4.1 Unit

```
TEST-UNIT-DEV-001  Token format generation + parsing
TEST-UNIT-DEV-002  argon2id hash + verify
TEST-UNIT-DEV-003  PKCE code_challenge computation
TEST-UNIT-DEV-004  HMAC signature computation + timing-safe verify
TEST-UNIT-DEV-005  OAuth scope subset check
TEST-UNIT-DEV-006  Refresh token family tracker
TEST-UNIT-DEV-007  Webhook retry schedule (exponential)
TEST-UNIT-DEV-008  Edge function bundle AST validator
TEST-UNIT-DEV-009  Rate limiter (token bucket)
TEST-UNIT-DEV-010  MCP tool generator from OpenAPI
```

#### 16.4.2 Integration

```
TEST-INT-DEV-001  Full OAuth authorization_code + PKCE flow
TEST-INT-DEV-002  Refresh token rotation
TEST-INT-DEV-003  Refresh reuse → family revocation
TEST-INT-DEV-004  PAT auth → API call → scope enforcement
TEST-INT-DEV-005  App install end-to-end
TEST-INT-DEV-006  App uninstall + graceful cleanup
TEST-INT-DEV-007  Webhook subscribe → event fires → delivered with HMAC
TEST-INT-DEV-008  Webhook retry on 500
TEST-INT-DEV-009  Webhook auto-pause after 100 failures
TEST-INT-DEV-010  Webhook replay
TEST-INT-DEV-011  Edge function deploy + invoke
TEST-INT-DEV-012  Edge function timeout enforcement
TEST-INT-DEV-013  Edge function memory limit enforcement
TEST-INT-DEV-014  MCP server connect + tool discovery
TEST-INT-DEV-015  MCP tool invocation with scope enforcement
TEST-INT-DEV-016  Rate limit returns 429 with Retry-After
TEST-INT-DEV-017  API version sunset enforcement (410 Gone)
TEST-INT-DEV-018  App scope insufficient → 403
TEST-INT-DEV-019  Cross-tenant data access blocked
TEST-INT-DEV-020  Embedded app session token validation
```

#### 16.4.3 E2E (Playwright)

```
TEST-E2E-DEV-001  Merchant: install app from marketplace
TEST-E2E-DEV-002  Merchant: create PAT, copy to clipboard, use in CLI
TEST-E2E-DEV-003  Merchant: subscribe webhook, receive event
TEST-E2E-DEV-004  Developer: create app in partner dashboard, submit for review
TEST-E2E-DEV-005  Developer: deploy edge function via CLI
TEST-E2E-DEV-006  AI agent: connect Claude Desktop to tenant MCP
TEST-E2E-DEV-007  Merchant: uninstall app, verify data deleted from app
TEST-E2E-DEV-008  Embedded app: render in admin iframe, call API
```

#### 16.4.4 Load + chaos

```
TEST-LOAD-DEV-001  10k webhooks/sec dispatch + retry
TEST-LOAD-DEV-002  100k API requests/min with rate limiting
TEST-LOAD-DEV-003  10k edge function invocations/sec
TEST-LOAD-DEV-004  1k MCP concurrent connections
TEST-CHAOS-DEV-001 Webhook endpoint slow → queue backpressure
TEST-CHAOS-DEV-002 Edge runtime down → fallback graceful
TEST-CHAOS-DEV-003 OAuth provider DB lag → token refresh resilient
```

#### 16.4.5 Security

```
TEST-SEC-DEV-001  PKCE downgrade attack rejected
TEST-SEC-DEV-002  Refresh token replay → family revoked
TEST-SEC-DEV-003  HMAC tampering rejected
TEST-SEC-DEV-004  Webhook timestamp replay (> 5 min) rejected
TEST-SEC-DEV-005  Edge function escape attempt (eval, fetch) blocked
TEST-SEC-DEV-006  Cross-tenant token blocked
TEST-SEC-DEV-007  Scope escalation attempted via token swap rejected
TEST-SEC-DEV-008  Embedded app cross-origin postMessage blocked
TEST-SEC-DEV-009  IP allowlist enforcement
TEST-SEC-DEV-010  SQL injection via tool input blocked (param sanitization)
```

---

## 17. Implementation checklist

### Backend — core
- [ ] **[S]** Drizzle schema `packages/db/src/schema/developer/*.ts`
- [ ] **[S]** Migrace `20260610_001_create_developer_tables.sql`
- [ ] **[L]** `ApiTokenService` — generate, hash, validate, revoke, rotate
- [ ] **[L]** `OAuthService` — authorize, token, refresh, revoke, introspect
- [ ] **[L]** `PkceValidator` + `RefreshFamilyTracker`
- [ ] **[L]** `ScopeEnforcer` middleware
- [ ] **[M]** `RateLimiter` (token-aware)
- [ ] **[M]** `IPAllowlistValidator`
- [ ] **[XL]** `WebhookDispatcher` (outbox reader → HTTP delivery + retry)
- [ ] **[L]** `WebhookSignatureSigner` + `WebhookEndpointValidator`
- [ ] **[L]** `EdgeFunctionRegistry` + `EdgeFunctionDeployer`
- [ ] **[XL]** `EdgeFunctionRunner` (V8 isolate orchestration; integrates Deno Deploy / CF Workers)
- [ ] **[L]** `MCPServerHandler` (WebSocket; tools from OpenAPI)
- [ ] **[M]** `MCPToolGenerator` (OpenAPI → tool definitions)
- [ ] **[M]** `MCPAuditLogger`
- [ ] **[L]** `AppLifecycleService` (install/upgrade/uninstall)
- [ ] **[M]** `AppReviewService` (platform staff workflow)
- [ ] **[M]** `AppMarketplaceService`
- [ ] **[M]** `AppRevenueService` (billing events, 80/20 calc)
- [ ] **[M]** `AppEmbeddedSessionTokenIssuer`
- [ ] **[S]** API version dispatcher (date-based routing per `04`)
- [ ] **[M]** REST endpoints per §11
- [ ] **[L]** GraphQL types + resolvers
- [ ] **[L]** tRPC procedures for admin
- [ ] **[M]** OpenAPI spec generation (input for MCP tools)

### Background jobs
- [ ] **[L]** JOB-DELIVER-WEBHOOK + JOB-RETRY-WEBHOOK-DELIVERY
- [ ] **[M]** JOB-AUTO-PAUSE-WEBHOOK
- [ ] **[S]** JOB-CLEANUP-OLD-WEBHOOK-DELIVERIES
- [ ] **[M]** JOB-VALIDATE-WEBHOOK-ENDPOINT (synthetic test)
- [ ] **[S]** JOB-EXPIRE-OAUTH-AUTHORIZATION-CODES
- [ ] **[M]** JOB-ROTATE-OAUTH-TOKENS-FAMILY
- [ ] **[L]** JOB-DEPLOY-EDGE-FUNCTION (with AST validation)
- [ ] **[M]** JOB-VALIDATE-EDGE-FUNCTION-BUNDLE
- [ ] **[M]** JOB-INVALIDATE-FUNCTION-CACHE-AT-EDGE
- [ ] **[M]** JOB-AGGREGATE-FUNCTION-METRICS
- [ ] **[S]** JOB-REVIEW-APP-SUBMISSION-NOTIFICATION
- [ ] **[M]** JOB-NOTIFY-APP-DEPRECATION (timeline)
- [ ] **[M]** JOB-COMPUTE-API-USAGE-METRICS
- [ ] **[M]** JOB-COMPUTE-PARTNER-REVENUE
- [ ] **[M]** JOB-EXECUTE-PARTNER-PAYOUT
- [ ] **[M]** JOB-SEND-APP-DATA-DELETE-WEBHOOK
- [ ] **[S]** JOB-RECOMPUTE-APP-RATINGS
- [ ] **[L]** JOB-DETECT-ABUSE-PATTERNS
- [ ] **[S]** JOB-CLEANUP-EXPIRED-TOKENS
- [ ] **[S]** JOB-WARN-EXPIRING-TOKENS
- [ ] **[M]** JOB-AUDIT-MCP-INVOCATIONS-DAILY

### SDK
- [ ] **[XL]** `@shopio/sdk-ts` — core resources (REST + GraphQL + tRPC clients)
- [ ] **[M]** SDK generated from OpenAPI + GraphQL Codegen (CI)
- [ ] **[M]** Auto-pagination iterators
- [ ] **[M]** Webhook verification helpers
- [ ] **[M]** Error type hierarchy
- [ ] **[M]** Rate limit handling + retry
- [ ] **[S]** OAuth client helpers
- [ ] **[L]** `@shopio/cli` (Fáze 2) — scaffold, deploy, login
- [ ] **[L]** `@shopio/app-bridge-react` (Fáze 2)
- [ ] **[L]** `@shopio/functions` (Fáze 2) — type helpers + local runner
- [ ] **[M]** `@shopio/sdk-react` (Fáze 2)

### Frontend — Admin (developer UI)
- [ ] **[L]** API tokens management page
- [ ] **[L]** Webhooks management page + delivery log
- [ ] **[L]** Apps installed page + browse marketplace
- [ ] **[L]** Edge functions management + logs viewer + live tail
- [ ] **[M]** MCP settings page + audit log viewer
- [ ] **[M]** OAuth consent screen
- [ ] **[M]** API analytics dashboards (per token, per app, latency)
- [ ] **[S]** Help center + interactive API playground integrated

### Frontend — partners.shopio.com
- [ ] **[XL]** Partner dashboard (separate Vite app)
- [ ] **[L]** App creation + edit
- [ ] **[L]** Submit for review + status tracking
- [ ] **[M]** Analytics (installs, churn, revenue)
- [ ] **[M]** Reviews + responses
- [ ] **[M]** Payouts ledger
- [ ] **[S]** API key for partner dashboard auth

### Documentation
- [ ] **[XL]** API reference (auto-generated OpenAPI → Mintlify/similar)
- [ ] **[L]** "Building your first Shopio app" tutorial
- [ ] **[M]** "OAuth integration guide"
- [ ] **[M]** "Webhook integration guide"
- [ ] **[M]** "Edge functions cookbook"
- [ ] **[M]** "MCP server guide for AI developers"
- [ ] **[M]** SDK reference per package
- [ ] **[M]** "Listing your app in the marketplace" partner guide
- [ ] **[S]** Migration guides per API version

### Tests
- [ ] **[L]** Per §16.4

---

## 18. Open questions

### Q-DEV-001: Storefront API public access without OAuth
**Otázka:** Storefront API uses separate public key (cf. Shopify Storefront Access Token), not OAuth. Limited scopes (read catalog, write cart). MVP scope?

**Status:** Yes. Public Storefront API key issued per store. Rate-limited per IP + per key. Distinct table `storefront_api_keys` (Fáze 1).

### Q-DEV-002: SDK code generation pipeline
**Otázka:** Source of truth: hand-written or generated from OpenAPI? Multi-language strategy?

**Status:** Hybrid. Core types + REST clients generated. Convenience wrappers hand-written. CI fails if drift.

### Q-DEV-003: Edge function runtime: Deno Deploy vs Cloudflare Workers vs self-hosted
**Otázka:** Vendor lock-in vs ops simplicity vs performance.

**Status:** Default: Deno Deploy (V8 isolates, fast cold start, EU regions). Fallback / alt: Cloudflare Workers. Self-hosted V8 isolates Fáze 3+. Abstraction layer hides choice from app code.

### Q-DEV-004: App billing — embedded vs external
**Otázka:** Force apps to use Shopio billing (revenue share enforced) or allow external Stripe Connect (apps charge merchants directly)?

**Status:** Both allowed. Embedded billing = revenue share auto-calculated. External = app declares; report to platform for analytics (no enforcement). Featured apps require embedded.

### Q-DEV-005: GraphQL persisted queries
**Otázka:** Enforce persisted query IDs to reduce attack surface + bandwidth?

**Status:** Fáze 2+. MVP allows ad-hoc queries. Production apps encouraged to use persisted (better performance + security).

### Q-DEV-006: MCP authentication transport
**Otázka:** OAuth bearer over WSS, or MCP-native auth handshake?

**Status:** OAuth bearer at connect + verified on each tool call. Per MCP spec evolves; track upstream.

### Q-DEV-007: Per-resource scopes vs operation-based
**Otázka:** `read_products` (resource) vs `product:read` (verb-noun).

**Status:** Resource-prefixed verbs: `read_products`, `write_products` (Shopify-aligned). 40-60 scopes total.

### Q-DEV-008: Custom OAuth provider integration
**Otázka:** Apps need their own OAuth (Google, GitHub) to authenticate THEIR users; do we provide SSO bridge?

**Status:** Out of scope MVP. Apps handle own auth. SSO bridge Fáze 4+.

### Q-DEV-009: App pricing model variants
**Otázka:** Beyond subscription + one-time: usage-based (per API call), tiered, freemium?

**Status:** Subscription + one-time + free MVP. Usage-based + tiered Fáze 2.

### Q-DEV-010: Multi-region MCP server
**Otázka:** Latency: AI agent in US → tenant data in EU.

**Status:** EU-first for MVP (Shopio EU). Multi-region Fáze 3+. Agent location-aware routing.

### Q-DEV-011: App version compatibility matrix
**Otázka:** App version X requires API version Y; merchant's tenant is on API version Z. How to reconcile?

**Status:** App pins minimum API version. Latest API supported by app retrieved on install. Auto-update prompts for outdated app versions when API sunsets.

### Q-DEV-012: Edge function language support beyond TypeScript
**Otázka:** Rust → WASM? Python?

**Status:** TypeScript MVP. WASM Fáze 3+. Python Fáze 5+ (if demand).

### Q-DEV-013: App "uninstall on suspended tenant"
**Otázka:** Tenant suspended/closed; what happens to app's stored data + webhooks?

**Status:** Webhooks paused. Apps notified via `app.tenant_suspended` and `app.tenant_deleted` events. 30-day grace + delete.

---

## 📅 Změny

| Datum | Změna |
|---|---|
| 2026-05-20 | Initial — Developer platform domain. PAT + service accounts + OAuth 2.1 with PKCE, webhooks with HMAC + retry, TypeScript SDK, plugin/app system, edge functions in V8 isolates, MCP server hosting (key differentiator), 80/20 revenue share (override DEC-PLUGIN-001), 30 business rules. |

---

**Konec Developer Platform.**

➡️ Pokračovat na: [`29-integrations.md`](29-integrations.md)

