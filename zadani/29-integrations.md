# 29 – INTEGRATIONS

> **Doména:** Pre-built first-party integrace mezi Shopio a třetími stranami (accounting, ERP, marketing, comparison shopping, social ads, reviews, customer support, analytics, translation, POS hardware). Postaveno na developer platformě (`28`) — vlastní integrace jsou apps, ale udržované Shopio týmem (vs. community plugins). EU-first roster (Pohoda, iDoklad, Heuréka, Zásilkovna, ...). Adapter pattern + Sync Engine + Field Mapper.

**Datum:** 2026-05-20
**Verze:** 1.0
**Status:** 🟡 DESIGN
**Reference:** [28-developer-platform.md](28-developer-platform.md) · [15-tax-compliance.md](15-tax-compliance.md) · [14-shipping.md](14-shipping.md) · [13-payments.md](13-payments.md) · [19-marketing-seo.md](19-marketing-seo.md)

---

## 📑 Obsah

0. [Domain overview](#0-domain-overview)
1. [References](#1-references)
2. [Personas](#2-personas)
3. [Data models](#3-data-models)
4. [Integration roster (MVP + Fáze 2/3)](#4-integration-roster-mvp--fáze-23)
5. [Adapter architecture](#5-adapter-architecture)
6. [Sync engine](#6-sync-engine)
7. [State machines](#7-state-machines)
8. [Business rules](#8-business-rules)
9. [REST API endpoints](#9-rest-api-endpoints)
10. [GraphQL schema](#10-graphql-schema)
11. [Events](#11-events)
12. [Background jobs](#12-background-jobs)
13. [UI/UX flows](#13-uiux-flows)
14. [Per-integration specifics](#14-per-integration-specifics)
15. [Edge cases & error handling](#15-edge-cases--error-handling)
16. [Performance, security, testing](#16-performance-security-testing)
17. [Implementation checklist](#17-implementation-checklist)
18. [Open questions](#18-open-questions)

---

## 0. Domain overview

### 0.1 Co tato doména **je**

- **Pre-built first-party integrations** — udržované Shopio core týmem, oficiálně podporované, prioritní bug fixes, SLA
- **Implementované jako interní apps** — používají developer platform z `28` (OAuth, webhooks, edge functions) → jednotná architektura
- **EU-first roster** — primárně CZ/SK/PL/DE/EU partneři (Pohoda, iDoklad, Heuréka, Mall, ...) — co se globálně používá taky (Stripe, Google, Meta, Klaviyo)
- **Bidirectional sync** kde to dává smysl (produkty CZ ↔ Pohoda; objednávky Shopio → účetní)
- **Field mapper** — UI pro mapování Shopio polí ↔ external system polí (custom fields per tenant)
- **Sync engine** — incremental sync s cursors, retries, dead letter queue, conflict resolution
- **Health monitoring** — per-integration dashboard (sync latency, error rate, last successful sync)
- **Connection wizard** — guided OAuth / API key setup per integration
- **Test mode** — vyzkoušet integraci v sandbox bez ovlivnění produkce
- **Field-level audit** — co se synchronizovalo, kdy, výsledek
- **Cross-integration data flow** — orchestration mezi několika integracemi (např. order → accounting → email confirmation)
- **Custom field mapping** — mapování `metafields` (per `04`) na external fields
- **Bulk operations** — historický backfill při prvním connect
- **Disaster recovery** — manual resync, selective re-sync
- **Webhook receivers** — některé integrace pushují k nám (např. Pohoda export → Shopio order status update)

### 0.2 Co tato doména **NENÍ**

- ❌ Developer platform SDK / OAuth / webhooks infrastructure (→ `28-developer-platform.md`)
- ❌ Community apps marketplace (→ `28 §8.9`)
- ❌ Payment provider integrace (Stripe/GoPay/ComGate/...) — `13-payments.md` má vlastní abstrakci
- ❌ Shipping carrier integrace (Zásilkovna/PPL/...) — `14-shipping.md` má vlastní abstrakci
- ❌ Tax engine (VIES, ARES) — `15-tax-compliance.md`
- ❌ Specific accounting business logic (ISDOC, Pohoda XML format) — `15-tax-compliance.md` má export rules; tento doc má sync engine
- ❌ Auth providers (Google, Microsoft) pro merchant login — `30-security.md`
- ❌ POS frontend itself — POS app je standalone (Fáze 3+); tady jen integrace s POS hardware (printery, drawer, scanner)
- ❌ AI provider integrace (Anthropic, OpenAI) — `33-ai-features.md`
- ❌ Cloud infra (AWS, GCP) — `31-operations.md`

### 0.3 Diferenciátory

1. **EU-first roster den 1** — Pohoda, iDoklad, Heuréka, Zboží.cz, Glami, Ecomail (vs. globální platformy, které mají hlavně US partnery)
2. **First-party SLA** — interní integrace mají SLA stejné jako platforma; community apps mají best-effort
3. **Adapter pattern unified** — všechny integrace stejnou architekturu (Connection, Adapter, FieldMapper, SyncEngine) — snadno přidávat nové
4. **Conflict resolution UI** — když se data odlišují mezi Shopio a external, merchant rozhoduje (overwrite/ignore/merge per field)
5. **Idempotency native** — sync engine používá business keys + checksums; opakované sync nedělají duplicity
6. **Visual field mapper** — drag-drop UI, žádný JSON config
7. **Test connections kvalitně** — connect wizard verifikuje API key/OAuth okamžitě + dummy data flow

---

## 1. References

- [28-developer-platform.md](28-developer-platform.md) — OAuth, webhooks, edge functions
- [13-payments.md](13-payments.md) — payment provider abstraction (parallel pattern)
- [14-shipping.md](14-shipping.md) — shipping carrier abstraction (parallel pattern)
- [15-tax-compliance.md](15-tax-compliance.md) — ISDOC, Pohoda/iDoklad export formats
- [19-marketing-seo.md](19-marketing-seo.md) — email marketing context (Mailchimp etc. sync targets)
- [20-analytics-reporting.md](20-analytics-reporting.md) — event tracking (GA4 client + server side)
- [22-multistore-channels.md](22-multistore-channels.md) — channels (Heuréka = channel; comparison shopping)
- [30-security.md](30-security.md) — credentials storage (encrypted KMS-wrapped)
- [33-ai-features.md](33-ai-features.md) — AI assist field mapper (suggest mappings)
- Pohoda XML/ISDOC documentation
- iDoklad API v3
- Heuréka XML feed spec
- Zboží.cz XML feed spec
- Google Shopping Content API
- Meta Commerce API (Catalog + Conversions)
- TikTok Events API
- Mailchimp REST API
- Klaviyo APIs
- Brevo (Sendinblue) API
- Ecomail.cz API
- GA4 Measurement Protocol (server-side)
- DeepL API
- Zendesk REST API + webhook
- Intercom API
- Trustpilot API
- ESC/POS protocol (POS receipt printers)

---

## 2. Personas

| Persona | Použití | Klíčové permissions |
|---|---|---|
| `PERSONA-MERCHANT-OWNER` | Aktivuje + konfiguruje integrace | `PERM-INTEGRATION-MANAGE` |
| `PERSONA-OPS-MANAGER` | Konfiguruje pravidla sync, řeší konflikty | `PERM-INTEGRATION-MANAGE`, `PERM-INTEGRATION-RESOLVE-CONFLICTS` |
| `PERSONA-ACCOUNTANT` | Connect účetní systém, kontroluje exporty | `PERM-INTEGRATION-ACCOUNTING-MANAGE`, `PERM-FINANCE-VIEW` |
| `PERSONA-MARKETING-MANAGER` | Mailchimp/Klaviyo/comparison shopping connection | `PERM-INTEGRATION-MARKETING-MANAGE` |
| `PERSONA-CUSTOMER-SERVICE-LEAD` | Zendesk/Intercom integration | `PERM-INTEGRATION-SUPPORT-MANAGE` |
| `PERSONA-DEVELOPER` (in-house) | Sleduje webhook health, debug sync errors | `PERM-INTEGRATION-DEBUG` |
| `PERSONA-AI-COPILOT` | Suggest mapping, diagnose sync errors | `agent:integrations:read` |
| `PERSONA-PLATFORM-STAFF` | Spravuje globální integration registry | `PERM-PLATFORM-INTEGRATION-REGISTRY-MANAGE` |

---

## 3. Data models

### 3.1 `integration_definitions` (platform-managed catalog)

```sql
CREATE TABLE integration_definitions (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  code TEXT NOT NULL,                                                                                                            -- 'pohoda','idoklad','mailchimp','heureka',...
  display_name TEXT NOT NULL,
  description_html TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'accounting','erp','marketing_email','marketing_automation','marketing_attribution',
    'social_ads','comparison_shopping','reviews','customer_support','analytics',
    'translation','pos_hardware','crm','helpdesk','project_management','custom'
  )),
  region_codes CHAR(2)[] NULL,                                                                                                     -- ['CZ','SK','EU']
  publisher_kind TEXT NOT NULL CHECK (publisher_kind IN ('first_party','third_party_certified','community')) DEFAULT 'first_party',
  -- capabilities
  capabilities TEXT[] NOT NULL DEFAULT '{}',                                                                                        -- 'sync_products','sync_customers','sync_orders','sync_invoices','webhook_inbound','field_mapping'
  required_scopes TEXT[] NOT NULL DEFAULT '{}',
  data_flow_direction TEXT NOT NULL CHECK (data_flow_direction IN ('outbound','inbound','bidirectional')),
  -- connect config
  connect_kind TEXT NOT NULL CHECK (connect_kind IN ('oauth','api_key','basic_auth','file_export_import','no_auth','custom_jwt')),
  connect_config_schema JSONB NOT NULL,                                                                                              -- JSON schema of fields to collect from merchant
  -- adapter info
  adapter_package TEXT NOT NULL,                                                                                                       -- e.g., '@shopio/integration-pohoda'
  adapter_version TEXT NOT NULL,
  min_api_version TEXT NULL,                                                                                                            -- min platform API version
  -- defaults
  default_sync_interval_minutes INTEGER NOT NULL DEFAULT 15,
  default_field_mappings JSONB NULL,
  default_filters JSONB NULL,
  -- compliance
  gdpr_processor BOOLEAN NOT NULL DEFAULT false,
  privacy_policy_url TEXT NULL,
  data_processor_disclosure_html TEXT NULL,
  -- icon + branding
  icon_url TEXT NULL,
  brand_color TEXT NULL,
  -- status
  status TEXT NOT NULL CHECK (status IN ('beta','stable','deprecated','retired')) DEFAULT 'stable',
  deprecated_at TIMESTAMPTZ NULL,
  retired_at TIMESTAMPTZ NULL,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_integration_definitions_code UNIQUE (code)
);

CREATE INDEX idx_integration_definitions_category ON integration_definitions (category) WHERE status = 'stable';
CREATE INDEX idx_integration_definitions_region ON integration_definitions USING GIN (region_codes) WHERE status = 'stable';
```

### 3.2 `integration_connections` — per-tenant active connections

```sql
CREATE TABLE integration_connections (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pub_id TEXT NOT NULL,                                                                                                                  -- icn_ NanoID
  -- which integration
  integration_definition_id UUID NOT NULL REFERENCES integration_definitions(id),
  integration_code TEXT NOT NULL,                                                                                                          -- denormalized for fast access
  -- naming
  display_name TEXT NOT NULL,                                                                                                                -- "Production Pohoda", "Test Mailchimp"
  description TEXT NULL,
  -- scope
  applies_to_store_ids UUID[] NULL,                                                                                                          -- NULL = all stores
  -- credentials (encrypted at rest via KMS envelope)
  credentials_encrypted JSONB NOT NULL,                                                                                                       -- { dek_id, ciphertext } per `30-security.md`
  oauth_app_installation_id UUID NULL REFERENCES app_installations(id),                                                                       -- when OAuth backed
  -- environment
  environment_kind TEXT NOT NULL CHECK (environment_kind IN ('production','sandbox','test')) DEFAULT 'production',
  external_account_id TEXT NULL,                                                                                                               -- external system's account ID for reference
  external_account_label TEXT NULL,                                                                                                            -- e.g., user's email at external service
  -- sync config
  sync_interval_minutes INTEGER NOT NULL DEFAULT 15,
  sync_enabled BOOLEAN NOT NULL DEFAULT true,
  field_mappings JSONB NULL,                                                                                                                    -- override default
  filters JSONB NULL,                                                                                                                              -- e.g., { "sync_products_with_tag": "for_external_xyz" }
  conflict_resolution_policy TEXT NOT NULL CHECK (conflict_resolution_policy IN ('shopio_wins','external_wins','manual_review','newest_wins')) DEFAULT 'manual_review',
  -- status
  status TEXT NOT NULL CHECK (status IN (
    'connecting','connected','syncing','healthy','degraded','error','paused','disconnecting','disconnected','requires_reauth'
  )) DEFAULT 'connecting',
  status_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status_message TEXT NULL,
  -- timing
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  disconnected_at TIMESTAMPTZ NULL,
  last_successful_sync_at TIMESTAMPTZ NULL,
  last_sync_attempt_at TIMESTAMPTZ NULL,
  next_scheduled_sync_at TIMESTAMPTZ NULL,
  -- counters
  total_records_synced BIGINT NOT NULL DEFAULT 0,
  total_sync_runs INTEGER NOT NULL DEFAULT 0,
  total_sync_errors INTEGER NOT NULL DEFAULT 0,
  consecutive_sync_failures INTEGER NOT NULL DEFAULT 0,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user_id UUID NULL REFERENCES users(id),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_integration_connections_pub_id UNIQUE (tenant_id, pub_id)
);

CREATE INDEX idx_integration_connections_status ON integration_connections (tenant_id, status) WHERE status IN ('healthy','degraded','error','requires_reauth');
CREATE INDEX idx_integration_connections_due_for_sync ON integration_connections (next_scheduled_sync_at) WHERE sync_enabled = true AND status IN ('healthy','degraded');
CREATE INDEX idx_integration_connections_definition ON integration_connections (integration_definition_id);
```

### 3.3 `integration_sync_runs` (append-only audit log)

```sql
CREATE TABLE integration_sync_runs (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  connection_id UUID NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  pub_id TEXT NOT NULL,
  -- scope
  sync_kind TEXT NOT NULL CHECK (sync_kind IN (
    'incremental','full_backfill','manual','retry','reconcile','test'
  )),
  resource_kinds TEXT[] NOT NULL,                                                                                                                 -- 'products','customers','orders','invoices',...
  -- direction
  direction TEXT NOT NULL CHECK (direction IN ('outbound','inbound','bidirectional')),
  -- cursor (for incremental)
  cursor_before JSONB NULL,
  cursor_after JSONB NULL,
  -- counts
  records_attempted INTEGER NOT NULL DEFAULT 0,
  records_synced INTEGER NOT NULL DEFAULT 0,
  records_failed INTEGER NOT NULL DEFAULT 0,
  records_conflict INTEGER NOT NULL DEFAULT 0,
  records_skipped INTEGER NOT NULL DEFAULT 0,
  -- status
  status TEXT NOT NULL CHECK (status IN ('queued','running','completed','partial','failed','cancelled')) DEFAULT 'queued',
  -- timing
  started_at TIMESTAMPTZ NULL,
  finished_at TIMESTAMPTZ NULL,
  duration_ms INTEGER NULL,
  -- error
  error_summary TEXT NULL,
  error_details JSONB NULL,                                                                                                                          -- aggregated errors
  -- audit
  triggered_by_kind TEXT NOT NULL CHECK (triggered_by_kind IN ('schedule','manual','event_driven','retry','webhook_inbound')),
  triggered_by_user_id UUID NULL,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
) PARTITION BY RANGE (created_at);

CREATE INDEX idx_integration_sync_runs_connection ON integration_sync_runs (connection_id, created_at DESC);
CREATE INDEX idx_integration_sync_runs_running ON integration_sync_runs (status) WHERE status IN ('queued','running');
```

### 3.4 `integration_sync_records` — per-record telemetry (sample only, not all)

Volitelně. MVP: pouze pro neúspěšné záznamy + konflikty. Plný log při debug mode per connection.

```sql
CREATE TABLE integration_sync_records (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  sync_run_id UUID NOT NULL REFERENCES integration_sync_runs(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL,
  -- entity
  shopio_resource_kind TEXT NOT NULL,                                                                                                                  -- 'product','customer','order'
  shopio_resource_id UUID NULL,
  shopio_resource_pub_id TEXT NULL,
  external_resource_id TEXT NULL,
  external_resource_kind TEXT NULL,
  -- direction + outcome
  direction TEXT NOT NULL CHECK (direction IN ('outbound','inbound')),
  outcome TEXT NOT NULL CHECK (outcome IN ('synced','skipped','conflict','failed')),
  reason_kind TEXT NULL,                                                                                                                                  -- 'validation_error','rate_limited','field_mismatch','not_found','duplicate','permission_denied'
  reason_detail TEXT NULL,
  -- field-level changes
  field_changes JSONB NULL,                                                                                                                                  -- { field_path: { before, after } }
  -- audit
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
) PARTITION BY RANGE (occurred_at);

CREATE INDEX idx_integration_sync_records_run ON integration_sync_records (sync_run_id);
CREATE INDEX idx_integration_sync_records_resource ON integration_sync_records (shopio_resource_id, occurred_at DESC) WHERE shopio_resource_id IS NOT NULL;
CREATE INDEX idx_integration_sync_records_conflict ON integration_sync_records (tenant_id, occurred_at DESC) WHERE outcome = 'conflict';
```

### 3.5 `integration_id_mappings` — Shopio ↔ external ID linkage

```sql
CREATE TABLE integration_id_mappings (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  connection_id UUID NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  shopio_resource_kind TEXT NOT NULL,                                                                                                                          -- 'product','customer',...
  shopio_resource_id UUID NOT NULL,
  external_resource_id TEXT NOT NULL,
  external_resource_kind TEXT NULL,
  -- sync metadata
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_synced_direction TEXT NOT NULL CHECK (last_synced_direction IN ('outbound','inbound')),
  shopio_checksum TEXT NULL,                                                                                                                                      -- to detect changes
  external_checksum TEXT NULL,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_integration_id_mappings_shopio UNIQUE (connection_id, shopio_resource_kind, shopio_resource_id),
  CONSTRAINT uq_integration_id_mappings_external UNIQUE (connection_id, shopio_resource_kind, external_resource_id)
);

CREATE INDEX idx_integration_id_mappings_external ON integration_id_mappings (external_resource_id, shopio_resource_kind);
```

### 3.6 `integration_conflicts` — pending resolution

```sql
CREATE TABLE integration_conflicts (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  connection_id UUID NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  pub_id TEXT NOT NULL,
  shopio_resource_kind TEXT NOT NULL,
  shopio_resource_id UUID NOT NULL,
  external_resource_id TEXT NULL,
  -- conflict details
  conflict_kind TEXT NOT NULL CHECK (conflict_kind IN (
    'concurrent_edit','field_mismatch','schema_drift','missing_external','missing_shopio','duplicate_external'
  )),
  field_diffs JSONB NOT NULL,                                                                                                                                       -- per-field { shopio_value, external_value, last_change_kind: ... }
  -- status
  status TEXT NOT NULL CHECK (status IN ('pending','resolved','dismissed')) DEFAULT 'pending',
  resolution TEXT NULL CHECK (resolution IN ('used_shopio','used_external','manual_merge','skip','create_new') OR resolution IS NULL),
  resolution_notes TEXT NULL,
  -- audit
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ NULL,
  resolved_by_user_id UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_integration_conflicts_pub_id UNIQUE (tenant_id, pub_id)
);

CREATE INDEX idx_integration_conflicts_pending ON integration_conflicts (tenant_id, detected_at DESC) WHERE status = 'pending';
CREATE INDEX idx_integration_conflicts_connection ON integration_conflicts (connection_id, status);
```

### 3.7 `integration_field_mappings` — declarative mappings per connection

```sql
CREATE TABLE integration_field_mappings (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  connection_id UUID NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  resource_kind TEXT NOT NULL,                                                                                                                                          -- 'product','customer','order'
  shopio_field_path TEXT NOT NULL,                                                                                                                                       -- 'title' or 'metafields.custom_color'
  external_field_path TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('outbound','inbound','bidirectional')),
  transform_kind TEXT NULL CHECK (transform_kind IN (
    'noop','to_upper','to_lower','currency_convert','date_format','number_format','boolean_to_yn','custom_function'
  ) OR transform_kind IS NULL) DEFAULT 'noop',
  transform_config JSONB NULL,
  -- conflict policy at field level (overrides connection-level)
  conflict_policy TEXT NULL CHECK (conflict_policy IN ('shopio_wins','external_wins','manual_review','newest_wins') OR conflict_policy IS NULL),
  -- toggle
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_integration_field_mappings UNIQUE (connection_id, resource_kind, shopio_field_path, external_field_path)
);

CREATE INDEX idx_integration_field_mappings_connection ON integration_field_mappings (connection_id, resource_kind) WHERE is_enabled = true;
```

### 3.8 `integration_health_checks`

```sql
CREATE TABLE integration_health_checks (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  connection_id UUID NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  check_kind TEXT NOT NULL CHECK (check_kind IN ('ping','auth','rate_limit_probe','quota_probe','schema_compatibility')),
  status TEXT NOT NULL CHECK (status IN ('passed','warning','failed')),
  latency_ms INTEGER NULL,
  details JSONB NULL,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_integration_health_checks_connection ON integration_health_checks (connection_id, checked_at DESC);
```

### 3.9 `integration_webhook_inbound_events`

External system pushuje k nám.

```sql
CREATE TABLE integration_webhook_inbound_events (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  connection_id UUID NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  external_event_id TEXT NULL,                                                                                                                                                -- for idempotency
  external_event_kind TEXT NOT NULL,                                                                                                                                            -- 'order.status_changed' from external
  raw_payload JSONB NOT NULL,
  signature_verified BOOLEAN NOT NULL DEFAULT false,
  processing_status TEXT NOT NULL CHECK (processing_status IN ('received','processing','processed','failed','duplicate','ignored')) DEFAULT 'received',
  processing_error TEXT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_integration_webhook_inbound_external_event UNIQUE (connection_id, external_event_id) DEFERRABLE INITIALLY IMMEDIATE
) PARTITION BY RANGE (received_at);

CREATE INDEX idx_integration_webhook_inbound_connection ON integration_webhook_inbound_events (connection_id, received_at DESC);
CREATE INDEX idx_integration_webhook_inbound_pending ON integration_webhook_inbound_events (processing_status, received_at) WHERE processing_status IN ('received','processing');
```

### 3.10 Vztahy

```
integration_definitions (1)──(N) integration_connections
integration_connections (1)──(N) integration_sync_runs
integration_connections (1)──(N) integration_id_mappings
integration_connections (1)──(N) integration_conflicts
integration_connections (1)──(N) integration_field_mappings
integration_connections (1)──(N) integration_health_checks
integration_connections (1)──(N) integration_webhook_inbound_events
integration_sync_runs (1)──(N) integration_sync_records
integration_connections (0..1)──(1) app_installations                                                                                                                                                       [pokud OAuth-backed]
```

---

## 4. Integration roster (MVP + Fáze 2/3)

| Integrace | Kategorie | Region | Status | Fáze | Capabilities |
|---|---|---|---|---|---|
| **Pohoda** (Stormware) | accounting | CZ/SK | first-party | MVP | sync orders → invoices (Pohoda XML), sync products bidirectional, customers bidirectional |
| **iDoklad** (Solitea) | accounting | CZ/SK | first-party | MVP | invoices outbound, customers bidirectional, payments inbound |
| **Money S3** (Solitea) | accounting | CZ/SK | first-party | Fáze 2 | invoices outbound, products bidirectional |
| **ABRA FlexiBee** | accounting/ERP | CZ/SK | first-party | Fáze 2 | bidirectional invoice + product + stock |
| **Stormware MRP/ERP** | ERP | CZ | community | Fáze 3+ | — |
| **SAP Business One** | ERP | EU/global | first-party | Fáze 3+ | invoice + product + customer + stock |
| **Microsoft Dynamics 365 BC** | ERP | global | first-party | Fáze 3+ | full sync |
| **Heuréka.cz** | comparison_shopping | CZ/SK | first-party | MVP | XML feed outbound (per `19-marketing-seo.md` extended) |
| **Zboží.cz** | comparison_shopping | CZ | first-party | MVP | XML feed outbound |
| **Glami** | comparison_shopping | EU | first-party | MVP | XML feed outbound (fashion) |
| **Modio** | comparison_shopping | CZ | first-party | Fáze 2 | XML feed |
| **Mall.cz** | marketplace | CZ/SK/PL | first-party | Fáze 2 | bidirectional via Mall Partner API (orders inbound, products outbound, stock outbound) |
| **Allegro** | marketplace | PL | first-party | Fáze 2 | bidirectional |
| **Amazon Seller** | marketplace | EU/global | first-party | Fáze 3+ | bidirectional via SP-API |
| **eBay** | marketplace | global | first-party | Fáze 3+ | bidirectional |
| **Google Shopping** | comparison_shopping | global | first-party | MVP | Content API + product feed |
| **Google Ads** (Enhanced Conversions) | social_ads | global | first-party | MVP | CAPI conversion uploads |
| **Meta** (Facebook, Instagram, WhatsApp) — Commerce + Pixel + CAPI | social_ads / marketplace | global | first-party | MVP | Catalog API + Conversions API (server-side); Shop integration |
| **TikTok** Events API + Catalog | social_ads | global | first-party | MVP | server-side events; product feed |
| **Pinterest** Tag + API | social_ads | global | first-party | Fáze 2 | CAPI |
| **Snapchat** Events API | social_ads | global | community | Fáze 3+ | — |
| **GA4** (Google Analytics 4) | analytics | global | first-party | MVP | client-side gtag + server-side Measurement Protocol |
| **Plausible** | analytics | EU | first-party | Fáze 2 | cookieless tracking |
| **Mailchimp** | marketing_email | global | first-party | MVP | sync customers + segments + transactional (Mandrill optional) |
| **Klaviyo** | marketing_automation | global | first-party | MVP | event-based sync (`order_placed`, `cart_abandoned`, ...) + profiles |
| **Brevo (Sendinblue)** | marketing_email | EU | first-party | MVP | contacts + templates + transactional |
| **Ecomail.cz** | marketing_email | CZ | first-party | MVP | contacts + campaigns + automation |
| **Smartemailing** | marketing_email | CZ | first-party | Fáze 2 | contacts |
| **Mailerlite** | marketing_email | EU | community | Fáze 2 | contacts |
| **Trustpilot** | reviews | global | first-party | MVP | request reviews post-purchase; aggregate score inbound |
| **Heureka Recenze** | reviews | CZ/SK | first-party | MVP | Ověřeno zákazníky API |
| **Google Reviews** | reviews | global | community | Fáze 2 | request reviews; aggregate |
| **Yotpo / Stamped.io** | reviews/UGC | global | community | Fáze 3+ | — |
| **Zendesk** | customer_support | global | first-party | Fáze 2 | tickets bidirectional, order context |
| **Intercom** | customer_support | global | first-party | Fáze 2 | conversations + user identification |
| **Tawk.to** | customer_support | global | community | Fáze 3+ | — |
| **HubSpot** | crm | global | first-party | Fáze 2 | contacts + companies + deals |
| **Pipedrive** | crm | global | community | Fáze 3+ | — |
| **Salesforce Commerce Cloud** | crm | global | community | Fáze 3+ | — |
| **DeepL** | translation | EU | first-party | Fáze 2 | product description auto-translation |
| **Google Translate** | translation | global | first-party | Fáze 2 | fallback |
| **Cloudflare** (Cache + DDoS) | infra | global | platform-managed | MVP | (configured at platform level; per-tenant custom domains) |
| **Sentry** | monitoring | platform | platform-managed | MVP | error reporting from app code |
| **Datadog / Grafana** | monitoring | platform | platform-managed | MVP | per `31-operations.md` |
| **Zapier** | automation | global | community | MVP | webhooks consumer (uses public webhook API) |
| **Make (Integromat)** | automation | EU | community | MVP | webhooks consumer |
| **n8n** | automation | self-host | community | Fáze 2 | self-host workflow |
| **Calendly** | services_booking | global | community | Fáze 3+ | for service businesses |
| **Vimeo OTT** | digital_subscriptions | global | community | Fáze 3+ | for video-on-demand subscription products |
| **Star Micronics / Epson** POS receipt printers | pos_hardware | global | first-party | Fáze 3+ (with POS app) | ESC/POS protocol |
| **Sunmi** POS terminals | pos_hardware | global | first-party | Fáze 3+ | — |
| **Webcredible barcode scanners** | pos_hardware | global | community | Fáze 3+ | — |

**MVP first-party priority order:**
1. Pohoda + iDoklad (CZ accounting essential)
2. Heuréka + Zboží.cz + Glami (CZ marketing essential)
3. Meta CAPI + Google Ads CAPI + GA4 (global ads tracking)
4. Mailchimp + Klaviyo + Brevo + Ecomail (email marketing)
5. Trustpilot + Heureka Recenze (reviews)
6. Google Shopping (paid acquisition)
7. Zapier + Make (low-code consumers)

---

## 5. Adapter architecture

### 5.1 Core abstraction

```ts
// packages/integrations-core/src/adapter.ts

export interface IntegrationAdapter {
  readonly code: string;                                                                                                                                                          // 'pohoda','mailchimp','heureka'
  readonly capabilities: Capability[];

  // Connection lifecycle
  validateCredentials(creds: Credentials): Promise<ValidationResult>;
  testConnection(connection: Connection): Promise<HealthResult>;
  refreshAuth?(connection: Connection): Promise<Credentials>;
  disconnect(connection: Connection): Promise<void>;

  // Sync operations
  syncOutbound?(ctx: SyncContext): Promise<SyncRunResult>;                                                                                                                          // push Shopio → external
  syncInbound?(ctx: SyncContext): Promise<SyncRunResult>;                                                                                                                            // pull external → Shopio
  syncBidirectional?(ctx: SyncContext): Promise<SyncRunResult>;

  // Webhook inbound
  verifyWebhookSignature?(payload: Buffer, headers: Record<string,string>, secret: string): boolean;
  processWebhookEvent?(event: InboundWebhookEvent, connection: Connection): Promise<void>;

  // Field mapping
  getFieldSchema(resourceKind: string, direction: 'outbound'|'inbound'): FieldSchema;

  // Conflict resolution
  resolveConflict?(conflict: Conflict, resolution: Resolution): Promise<void>;
}

interface SyncContext {
  tenantId: string;
  connection: Connection;
  resourceKinds: string[];
  cursor?: any;
  filters?: any;
  fieldMappings: FieldMapping[];
  conflictPolicy: ConflictResolutionPolicy;
  shopioApi: ShopioClient;                                                                                                                                                              // SDK client preconfigured
  externalApi: any;                                                                                                                                                                       // adapter-specific
  log: Logger;
  abortSignal: AbortSignal;
}

interface SyncRunResult {
  recordsSynced: number;
  recordsFailed: number;
  recordsConflict: number;
  recordsSkipped: number;
  nextCursor?: any;
  errors?: SyncError[];
}
```

### 5.2 Adapter package layout

Každá integrace = NPM package `@shopio/integration-{code}`:

```
@shopio/integration-pohoda/
├── package.json
├── src/
│   ├── index.ts                                                                                                                                                                                            # implements IntegrationAdapter
│   ├── client.ts                                                                                                                                                                                            # HTTP/SOAP client wrapper
│   ├── mappers/
│   │   ├── product-mapper.ts
│   │   ├── order-to-invoice-mapper.ts
│   │   ├── customer-mapper.ts
│   │   └── xml-builder.ts                                                                                                                                                                                    # Pohoda XML format per ISDOC
│   ├── sync/
│   │   ├── product-sync.ts
│   │   ├── invoice-sync.ts
│   │   └── customer-sync.ts
│   ├── schemas/
│   │   ├── credentials.ts                                                                                                                                                                                     # Zod
│   │   └── field-schemas.ts
│   └── tests/
└── tsconfig.json
```

### 5.3 Adapter registry

```ts
// packages/integrations-core/src/registry.ts

export class IntegrationRegistry {
  private adapters = new Map<string, IntegrationAdapter>();

  register(adapter: IntegrationAdapter) {
    this.adapters.set(adapter.code, adapter);
  }

  get(code: string): IntegrationAdapter {
    const a = this.adapters.get(code);
    if (!a) throw new Error(`Unknown integration: ${code}`);
    return a;
  }

  list(): IntegrationAdapter[] {
    return Array.from(this.adapters.values());
  }
}

// On platform startup, load all first-party adapters
import pohodaAdapter from '@shopio/integration-pohoda';
import idokladAdapter from '@shopio/integration-idoklad';
import mailchimpAdapter from '@shopio/integration-mailchimp';
// ... etc

registry.register(pohodaAdapter);
registry.register(idokladAdapter);
registry.register(mailchimpAdapter);
// ...
```

### 5.4 Connection wizard flow

Per `integration_definitions.connect_kind`:

```
connect_kind = 'oauth':
  1. Merchant clicks "Connect" in admin
  2. Redirect to external provider's OAuth
  3. Callback handled by Shopio
  4. Tokens stored encrypted in integration_connections.credentials_encrypted
  5. Test connection: GET external API /me or /ping
  6. If pass: status='connected'; emit EVENT-INT-CONNECTED

connect_kind = 'api_key':
  1. Wizard shows form with required fields per definition schema
     (e.g., for Mailchimp: API key + datacenter)
  2. Validate via adapter.validateCredentials()
  3. Encrypt + store
  4. Test connection
  5. status='connected'

connect_kind = 'basic_auth':
  Similar to api_key but with username+password.

connect_kind = 'custom_jwt':
  Adapter-specific (e.g., SAP B1 has bespoke handshake).

connect_kind = 'file_export_import':
  No credentials. Just sync settings (file format, S3 bucket, etc.). Used for legacy systems that consume CSV.

connect_kind = 'no_auth':
  Public-feed only (XML for Heureka — no auth, just URL config).
```

### 5.5 Credentials encryption

Per `30-security.md`:
- Plaintext credentials never stored
- DEK (data encryption key) per connection
- DEK wrapped by KEK (key encryption key) in KMS
- Decryption only at adapter invocation, scrubbed from memory after use
- Audit logged on access

```ts
async function loadCredentials(connection: Connection): Promise<Credentials> {
  const { dek_id, ciphertext } = connection.credentials_encrypted;
  const dek = await kms.unwrap(dek_id);
  try {
    const plaintext = aesGcm.decrypt(ciphertext, dek);
    return JSON.parse(plaintext);
  } finally {
    zeroize(dek);
  }
}
```

### 5.6 Field schema discovery

```ts
adapter.getFieldSchema('product', 'outbound') → {
  shopio_fields: [
    { path: 'title', kind: 'string', required: true },
    { path: 'description_html', kind: 'string' },
    { path: 'price_amount', kind: 'integer' },
    { path: 'currency', kind: 'string' },
    { path: 'metafields.*', kind: 'object', dynamic: true }
  ],
  external_fields: [
    { path: 'Name', kind: 'string', required: true, max_length: 255 },
    { path: 'Description', kind: 'string', max_length: 2000 },
    { path: 'UnitPrice', kind: 'decimal' },
    { path: 'Currency', kind: 'string', enum: ['CZK','EUR','USD'] }
  ],
  suggested_mappings: [
    { shopio: 'title', external: 'Name' },
    { shopio: 'description_html', external: 'Description', transform: 'strip_html_to_text' },
    { shopio: 'price_amount', external: 'UnitPrice', transform: 'cents_to_decimal' },
    { shopio: 'currency', external: 'Currency' }
  ]
}
```

UI uses this to render visual mapper + suggest defaults.

### 5.7 Adapter testing harness

Each adapter ships:
- Unit tests for mappers (pure functions)
- Contract tests against recorded fixtures (VCR/Polly.js)
- E2E test against sandbox external account (optional, gated)
- Schema drift tests (verify external API hasn't changed)

CI runs daily contract tests against sandbox accounts; alert if external API changes.

---

## 6. Sync engine

### 6.1 Sync kinds

| Kind | Trigger | Scope |
|---|---|---|
| `incremental` | Schedule per `sync_interval_minutes` | Changed since `cursor_before` |
| `full_backfill` | First connect; manual re-trigger | All records |
| `manual` | User clicks "Sync now" | Configurable |
| `retry` | Previous failed | Same scope as failed |
| `reconcile` | Periodic (weekly) | Validate Shopio ↔ external consistency |
| `test` | During connect wizard | Sample records only |

### 6.2 Incremental sync with cursors

```
Outbound (Shopio → external):
  cursor = { last_updated_at: '2026-05-19T15:00:00Z' }
  query Shopio events log since cursor:
    SELECT * FROM events_outbox
    WHERE topic IN ('product.updated','product.created') AND occurred_at > cursor.last_updated_at
    ORDER BY occurred_at ASC
    LIMIT 100
  for each event:
    transform via field mapper
    call external API
    update cursor on success
  next cursor: { last_updated_at: max(occurred_at) }

Inbound (external → Shopio):
  cursor = external system's cursor (e.g., pagination token, last_modified_since)
  fetch external API page-by-page
  for each external record:
    look up integration_id_mappings to find Shopio entity (or create new)
    transform via field mapper
    call Shopio internal API
    update mapping + cursor
```

### 6.3 Conflict detection

Při bidirectional sync:
- Při outbound: porovnat external_checksum z `integration_id_mappings` s aktuálním external (pokud existuje); pokud nesouhlasí → external byl změněn mimo náš push → potenciální konflikt
- Při inbound: porovnat shopio_checksum s aktuálním Shopio; pokud nesouhlasí → konflikt

Když konflikt:
- per `conflict_resolution_policy`:
  - `shopio_wins`: overwrite external
  - `external_wins`: overwrite Shopio
  - `newest_wins`: porovnat timestamps; novější vyhrává
  - `manual_review`: log do `integration_conflicts` table; merchant rozhodne v UI

### 6.4 Idempotency

Outbound calls:
- Adapter posílá business key (Shopio `pub_id` jako external metadata field nebo custom external_id)
- External: pokud již existuje by business key → update místo create
- Retry-safe: opakované volání nedělá duplicity

### 6.5 Retry strategy

```
attempt 1: immediate
attempt 2: +1 min
attempt 3: +5 min
attempt 4: +15 min
attempt 5: +1 hour
attempt 6: +6 hours
attempt 7: dead-letter (manual intervention)
```

Per `connection.metadata.retry_strategy` override-able.

### 6.6 Rate limiting awareness

External APIs mají vlastní rate limits. Adapter musí:
- Respektovat `Retry-After` headers
- Implementovat exponential backoff
- Sledovat custom quota (např. Meta CAPI = 1M events / hour)
- Per-connection vlastní throttle if needed

### 6.7 Batch operations

Některé APIs preferují batch (např. Mailchimp `/lists/{id}/members` accepts up to 500 ops per call). Adapter musí:
- Sbírat operace per batch_size
- Flushnout pravidelně + na konci sync run
- Per-record outcomes (success/fail) reportovat zpět

### 6.8 Dead-letter queue

Záznamy které selhaly po max retries:
- Uložené v `integration_sync_records` s `outcome='failed'`
- Visible v admin UI per connection → "Failed records" tab
- Bulk retry option
- Bulk dismiss option
- AI Copilot assist: "Why did these 23 records fail?" → root-cause analysis

### 6.9 Reconciliation jobs

Týdně (per connection):
- Compare Shopio records vs external (sample-based pro big datasets)
- Detect:
  - Records v Shopio bez external counterpart (drift)
  - Records v external bez Shopio counterpart (orphan)
  - Records s field divergence
- Create conflicts pro manual review nebo auto-fix per policy

### 6.10 Webhook inbound processing

Adapter declares webhook endpoint:
```
POST /api/{date}/integrations/{connection_id}/webhook-inbound
```

Server:
1. Authenticates source (HMAC nebo IP allowlist nebo OAuth callback signing)
2. Idempotency check via `external_event_id`
3. Persists into `integration_webhook_inbound_events` (status='received')
4. Enqueues processing job
5. Returns 200 immediately (subscriber timeout safety)

Background job:
1. Loads event
2. Calls `adapter.processWebhookEvent()`
3. Adapter performs sync (create order, update status, ...)
4. Status='processed' or 'failed'

---

## 7. State machines

### 7.1 Connection lifecycle

```
connecting → connected → syncing → healthy ↔ degraded ↔ error
                                                                  ↘ paused (manual or auto after consecutive failures)
                                                                  ↘ requires_reauth (token expired without refresh capability)
                                                                  ↘ disconnecting → disconnected (terminal)
```

### 7.2 Sync run

```
queued → running → completed
                 → partial (some records failed)
                 → failed
                 → cancelled (manual or timeout)
```

### 7.3 Conflict

```
pending → resolved (used_shopio | used_external | manual_merge | skip | create_new)
        → dismissed (no action; resync may re-detect)
```

### 7.4 Inbound webhook event

```
received → processing → processed (terminal)
                      → failed (terminal; retry possible)
                      → duplicate (terminal; idempotency hit)
                      → ignored (filter excluded)
```

---

## 8. Business rules

### RULE-INT-001: First-party integrations same support SLA as platform

Critical bug fixed within 24h business. Bug v community plugins = best effort, vlastník odpovědný.

### RULE-INT-002: Credentials always encrypted

Plaintext never stored. KMS-wrapped DEK per `5.5`. Audit logs every access. Per `30-security.md`.

### RULE-INT-003: Connection wizard always tests connectivity

Nejde uložit connection, dokud `validateCredentials` + `testConnection` neprošly. Žádné "save and hope".

### RULE-INT-004: Reauth grace period 7 dní

When OAuth token expires bez refresh capability (token revoked externally, app uninstalled externally): connection → `requires_reauth`. Sync paused. Email + in-app notification merchanta. Po 7 dnech: konexion `disconnected`; data mapping retained 30 days then purged.

### RULE-INT-005: Auto-pause after consecutive sync failures

`consecutive_sync_failures > 10` → `status='error'`, sync paused, notifikace. Merchant must investigate + manual resume.

### RULE-INT-006: Conflict resolution UI mandatory pro `manual_review` policy

Pokud konflikt + policy=`manual_review` → záznam zaparkován v `integration_conflicts`. Sync pokračuje pro ostatní records. Merchant v UI vyřeší per field. Bulk resolve allowed.

### RULE-INT-007: Field mapper drag-drop UX

Vizuální UI s left panel (Shopio fields), right panel (external fields). Drag mezi → mapping. Default mappings pre-suggested per `5.6`. Transform per field (drag transform from dropdown). Test preview shows resulting external payload for sample Shopio record.

### RULE-INT-008: ID mapping table is source of truth

Pro každý sync record záznam v `integration_id_mappings`. Bez něj: treat as new (create v external). Pokud mapping je ale external nenajdeme: konflikt `missing_external`.

### RULE-INT-009: Outbound respects external rate limits

Per integration definition declared limits. Adapter retries on 429 with Retry-After. Excessive retries → throttle subsequent calls (token bucket per connection).

### RULE-INT-010: Inbound webhook idempotent

`external_event_id` musí být unique per connection. Duplicate → `processing_status='duplicate'`, no-op. Critical pro at-least-once semantics z external systému.

### RULE-INT-011: PII flows GDPR compliant

External system processing EU PII → connection definition `gdpr_processor=true`. DPA template provided. Connection UI shows badge + disclosure. Customer right-to-erasure: triggers `integration.customer_erasure_requested` webhook → external adapter implements deletion (or queue manual task).

### RULE-INT-012: Multi-store connections

Connection může apply na all stores (`applies_to_store_ids=NULL`) nebo specific. Mailchimp config typicky per-store (každý store own audience). Pohoda typicky single per tenant.

### RULE-INT-013: Test mode environment

`environment_kind='sandbox'`: adapter musí použít sandbox endpoints (Heureka má testovací XML feed, Stripe sandbox, Mailchimp test list). Sandbox data nikdy nezprávní s production.

### RULE-INT-014: Sync orchestration order

Některé sync musí přijít před jinými:
- Customers před Orders (orders reference customers)
- Products před Orders (orders reference products)
- Categories před Products

Adapter declares dependencies; engine respektuje topological order.

### RULE-INT-015: Bulk operations chunked

`full_backfill` rozdělit na chunks (100-500 records per chunk). Pause mezi chunks (per rate limit). Progress reported per chunk.

### RULE-INT-016: Test data clearly marked

Sandbox sync records flagged `metadata.is_test_data=true`. Production reports filtrují out.

### RULE-INT-017: Sync logs retention

`integration_sync_runs`: 90 dní hot, 1 year cold storage.
`integration_sync_records`: 30 dní hot (jen failed/conflict; success nelogujeme by default).
`integration_webhook_inbound_events`: 30 dní hot, 90 dní cold.

### RULE-INT-018: Concurrent sync run per connection blocked

Pouze 1 sync run per connection at a time. Pokud overlap (scheduled triggered while manual running): nový queued and runs after current completes.

### RULE-INT-019: Field mapping versions

Když adapter version updates schema (např. nový external field): old mappings stay valid. New fields available v UI. Removed fields → warning in mapper, marked deprecated.

### RULE-INT-020: Cross-connection identity (same external system)

Tenant může mít 2 connections same integration (dev + prod). ID mappings scoped per connection. Pohoda dev environment data nesynchronizovat s prod Pohoda.

### RULE-INT-021: AI assist field mapping

AI Copilot může:
- Suggest mappings (na základě field name similarity, popisu, vzoru data v sample records)
- Diagnose sync errors ("23 products failed sync because Pohoda doesn't accept HTML in name; AI suggests transform=strip_html")
- Recommend integrations (per `33-ai-features.md`)

### RULE-INT-022: Pre-built filter templates

Některé sync často filtered (např. Heuréka feed: "only published products with stock > 0"). Definitions ship default filters; merchant může customize.

### RULE-INT-023: Webhook secret rotation

Per webhook subscription (per `28 §5`) signing secret rotatable. Při rotation: starý secret platný 7 dní (overlapping). Email merchanta. Pro inbound webhooks: external system musí update; UI tutorial per integration.

### RULE-INT-024: Disconnection clean-up

Manual disconnect or auto after grace period:
- All sync jobs cancelled
- ID mappings retained 30 days (for potential reconnect)
- Inbound webhook secrets revoked
- OAuth tokens revoked
- Connection status='disconnected', data retained 90 days for audit then anonymized

### RULE-INT-025: Multi-tenant adapter isolation

Adapter code runs in shared process, ale all state per-tenant. No leaks. Common pitfalls: HTTP keep-alive pools per tenant; logging context per tenant.

### RULE-INT-026: Comparison shopping feed updates

`19-marketing-seo.md` cross-ref. Heuréka/Zboží.cz/Glami XML feeds:
- Regenerated incrementally on product changes (debounced 5 min)
- Full regeneration daily
- CDN-cached
- External system polls URL (no push)
- Feed available at predictable URL per store: `/feeds/heureka.xml`, `/feeds/google-shopping.xml`, ...

### RULE-INT-027: Marketing email — consent gating

Customers without `marketing_email` consent NEVER synced to Mailchimp/Klaviyo etc. Per `18-customer-management.md` consent ledger. Audit log captures sync decisions.

### RULE-INT-028: Ads CAPI server-side over client-side

Meta/TikTok/Google CAPI (server-side) je primární — accurate even with ad blockers + ITP. Client-side Pixel parallel for redundancy. Deduplication via `event_id`.

### RULE-INT-029: Translation auto-translate human review

DeepL auto-translate fill, merchant may review + edit. Translation marked `is_machine_translated=true` until reviewed. AI Copilot suggests review for high-value pages.

### RULE-INT-030: Custom adapter development

Tenant nebo agency může vyvinout custom adapter (per `28 §8.6` edge functions, nebo full app). Vlastní integration definition jen vidí daný tenant. Public-share přes app marketplace per `28 §8.9`.

### RULE-INT-031: Health checks scheduled

Per connection: ping + auth + rate_limit probe každých 6h. Anomalie → `degraded` status, alert merchant.

### RULE-INT-032: Disaster recovery

`reconcile` job (weekly): comparing Shopio vs external. Discrepancies → conflicts. Tool "Force re-sync all" (admin) → full backfill nezávisle na cursors. Tool "Replay from date X" → re-process events.

### RULE-INT-033: Adapter version pinning

Tenant connection pins `adapter_version`. New adapter version → notification "Upgrade available, changelog". Merchant can defer (within 6-month deprecation window).

### RULE-INT-034: Integration analytics dashboard

Per integration globally + per connection:
- Total records synced (cumulative)
- Success rate (daily)
- Avg latency
- Error breakdown (by reason_kind)
- Last sync timestamp
- Health status timeline

Drives data-driven adapter maintenance decisions.

### RULE-INT-035: License + ToS

First-party adapters Apache 2.0 (per `01-DEC-LICENSE-001`). Third-party adapters vlastní license. Tenant souhlasí s integrate's ToS při connect (link na ToS visible in wizard).

---

## 9. REST API endpoints

### 9.1 Integration definitions (read-only catalog)

```
GET    /api/{date}/integrations/definitions                                                                                                                                                                                                          # browse
GET    /api/{date}/integrations/definitions/{code}
GET    /api/{date}/integrations/definitions/by-category?category=accounting
GET    /api/{date}/integrations/definitions/{code}/schema                                                                                                                                                                                              # connect form schema
GET    /api/{date}/integrations/definitions/{code}/field-schema?resource_kind=product
```

### 9.2 Connections lifecycle

```
GET    /api/{date}/integrations/connections                                                                                                                                                                                                              # list active per tenant
POST   /api/{date}/integrations/connections                                                                                                                                                                                                              # create (start wizard)
GET    /api/{date}/integrations/connections/{id}
PATCH  /api/{date}/integrations/connections/{id}
DELETE /api/{date}/integrations/connections/{id}                                                                                                                                                                                                          # disconnect
POST   /api/{date}/integrations/connections/{id}:test                                                                                                                                                                                                      # ad-hoc connection test
POST   /api/{date}/integrations/connections/{id}:pause
POST   /api/{date}/integrations/connections/{id}:resume
POST   /api/{date}/integrations/connections/{id}:reauth                                                                                                                                                                                                    # re-trigger OAuth
GET    /api/{date}/integrations/connections/{id}/health                                                                                                                                                                                                    # recent health checks
```

### 9.3 Sync operations

```
GET    /api/{date}/integrations/connections/{id}/sync-runs
POST   /api/{date}/integrations/connections/{id}/sync-runs                                                                                                                                                                                                  # trigger manual sync
GET    /api/{date}/integrations/connections/{id}/sync-runs/{run_id}
POST   /api/{date}/integrations/connections/{id}/sync-runs/{run_id}:cancel
POST   /api/{date}/integrations/connections/{id}/sync:full-backfill
POST   /api/{date}/integrations/connections/{id}/sync:reconcile
GET    /api/{date}/integrations/connections/{id}/sync-records?status=failed
POST   /api/{date}/integrations/connections/{id}/sync-records:bulk-retry
POST   /api/{date}/integrations/connections/{id}/sync-records:bulk-dismiss
```

### 9.4 Field mappings

```
GET    /api/{date}/integrations/connections/{id}/field-mappings?resource_kind=product
POST   /api/{date}/integrations/connections/{id}/field-mappings                                                                                                                                                                                                # create / replace
PATCH  /api/{date}/integrations/connections/{id}/field-mappings/{mapping_id}
DELETE /api/{date}/integrations/connections/{id}/field-mappings/{mapping_id}
POST   /api/{date}/integrations/connections/{id}/field-mappings:preview                                                                                                                                                                                         # body: sample shopio record → external payload
POST   /api/{date}/integrations/connections/{id}/field-mappings:suggest                                                                                                                                                                                          # AI-assisted
POST   /api/{date}/integrations/connections/{id}/field-mappings:reset-defaults
```

### 9.5 Conflicts

```
GET    /api/{date}/integrations/connections/{id}/conflicts?status=pending
GET    /api/{date}/integrations/connections/{id}/conflicts/{conflict_id}
POST   /api/{date}/integrations/connections/{id}/conflicts/{conflict_id}:resolve                                                                                                                                                                                  # body: { resolution, field_choices? }
POST   /api/{date}/integrations/connections/{id}/conflicts/{conflict_id}:dismiss
POST   /api/{date}/integrations/connections/{id}/conflicts:bulk-resolve                                                                                                                                                                                            # body: { ids, resolution }
```

### 9.6 Inbound webhooks (per connection)

```
POST   /api/{date}/integrations/{connection_id}/webhook-inbound                                                                                                                                                                                                     # external systems POST here; signature verified per adapter
GET    /api/{date}/integrations/{connection_id}/webhook-inbound-events?status=failed
GET    /api/{date}/integrations/{connection_id}/webhook-inbound-events/{event_id}
POST   /api/{date}/integrations/{connection_id}/webhook-inbound-events/{event_id}:retry
```

### 9.7 Analytics

```
GET    /api/{date}/integrations/analytics/overview                                                                                                                                                                                                                    # KPIs per tenant
GET    /api/{date}/integrations/analytics/connection/{id}/timeline
GET    /api/{date}/integrations/analytics/by-integration                                                                                                                                                                                                                # cross-tenant adoption (platform staff only)
```

### 9.8 Example: Create Pohoda connection

```http
POST /api/2026-05-20/integrations/connections HTTP/1.1
Authorization: Bearer <admin>

{
  "integration_code": "pohoda",
  "display_name": "Production Pohoda",
  "environment_kind": "production",
  "credentials": {
    "api_endpoint_url": "https://my-pohoda-mserver.local:443",
    "ico": "12345678",
    "auth_kind": "basic",
    "username": "admin",
    "password": "********"
  },
  "applies_to_store_ids": null,
  "sync_interval_minutes": 30
}
```

Server validates credentials, encrypts, returns:

```jsonc
HTTP/1.1 201 Created

{
  "data": {
    "id": "icn_aB",
    "integration_code": "pohoda",
    "status": "connected",
    "external_account_label": "ICO 12345678",
    "next_scheduled_sync_at": "2026-05-20T15:30:00Z",
    "field_mappings_ready": true
  }
}
```

### 9.9 Example: Trigger manual sync

```http
POST /api/2026-05-20/integrations/connections/icn_aB/sync-runs HTTP/1.1

{
  "sync_kind": "manual",
  "resource_kinds": ["products","customers"],
  "direction": "bidirectional"
}
```

```jsonc
HTTP/1.1 202 Accepted

{
  "data": {
    "sync_run_id": "isr_xY",
    "status": "queued",
    "estimated_duration_seconds": 120
  }
}
```

### 9.10 Example: Resolve conflict

```http
POST /api/2026-05-20/integrations/connections/icn_aB/conflicts/cft_aB:resolve HTTP/1.1

{
  "resolution": "manual_merge",
  "field_choices": {
    "title": "shopio",
    "description": "external",
    "price_amount": "shopio"
  },
  "notes": "Manually merged after reviewing both versions"
}
```

```jsonc
HTTP/1.1 200 OK

{
  "data": {
    "id": "cft_aB",
    "status": "resolved",
    "resolution": "manual_merge",
    "resolved_at": "2026-05-20T16:00:00Z"
  }
}
```

### 9.11 Example: Inbound webhook (from Pohoda XML export)

External system (Pohoda XML push from XSLT processor) POSTs:

```http
POST /api/2026-05-20/integrations/icn_aB/webhook-inbound HTTP/1.1
Content-Type: application/xml
X-Pohoda-Signature: <HMAC>

<dataPack>
  <dataPackItem>
    <invoice>
      <header>
        <numberRequested>2026000123</numberRequested>
        <invoiceType>issuedInvoice</invoiceType>
      </header>
      ...
    </invoice>
  </dataPackItem>
</dataPack>
```

Adapter verifies signature, persists, enqueues processing:

```
HTTP/1.1 200 OK
```

### 9.12 Example: Field mapping preview

```http
POST /api/2026-05-20/integrations/connections/icn_aB/field-mappings:preview HTTP/1.1

{
  "resource_kind": "product",
  "direction": "outbound",
  "sample_shopio_record_id": "prd_aB"
}
```

```jsonc
HTTP/1.1 200 OK

{
  "data": {
    "shopio_record": { "id": "prd_aB", "title": "Black T-Shirt", ... },
    "external_payload": {
      "Name": "Black T-Shirt",
      "Description": "Comfortable cotton...",
      "UnitPrice": "499.00",
      "Currency": "CZK"
    },
    "warnings": [
      { "field": "description_html", "message": "HTML stripped to plain text" }
    ]
  }
}
```

---

## 10. GraphQL schema

```graphql
type IntegrationDefinition implements Node {
  id: ID!
  code: String!
  displayName: String!
  descriptionHtml: String!
  category: IntegrationCategory!
  regionCodes: [String!]
  publisherKind: IntegrationPublisherKind!
  capabilities: [String!]!
  requiredScopes: [String!]!
  dataFlowDirection: IntegrationDataFlowDirection!
  connectKind: IntegrationConnectKind!
  connectConfigSchema: JSON!
  adapterPackage: String!
  adapterVersion: String!
  defaultSyncIntervalMinutes: Int!
  gdprProcessor: Boolean!
  privacyPolicyUrl: String
  iconUrl: String
  brandColor: String
  status: IntegrationDefinitionStatus!
}

enum IntegrationCategory {
  ACCOUNTING ERP MARKETING_EMAIL MARKETING_AUTOMATION MARKETING_ATTRIBUTION
  SOCIAL_ADS COMPARISON_SHOPPING REVIEWS CUSTOMER_SUPPORT ANALYTICS
  TRANSLATION POS_HARDWARE CRM HELPDESK PROJECT_MANAGEMENT CUSTOM
}
enum IntegrationPublisherKind { FIRST_PARTY THIRD_PARTY_CERTIFIED COMMUNITY }
enum IntegrationDataFlowDirection { OUTBOUND INBOUND BIDIRECTIONAL }
enum IntegrationConnectKind { OAUTH API_KEY BASIC_AUTH FILE_EXPORT_IMPORT NO_AUTH CUSTOM_JWT }
enum IntegrationDefinitionStatus { BETA STABLE DEPRECATED RETIRED }

type IntegrationConnection implements Node {
  id: ID!
  pubId: String!
  definition: IntegrationDefinition!
  integrationCode: String!
  displayName: String!
  description: String
  environmentKind: IntegrationEnvironmentKind!
  externalAccountLabel: String
  status: IntegrationConnectionStatus!
  statusMessage: String
  syncIntervalMinutes: Int!
  syncEnabled: Boolean!
  fieldMappings: [IntegrationFieldMapping!]!
  conflictResolutionPolicy: ConflictResolutionPolicy!
  connectedAt: DateTime!
  disconnectedAt: DateTime
  lastSuccessfulSyncAt: DateTime
  lastSyncAttemptAt: DateTime
  nextScheduledSyncAt: DateTime
  totalRecordsSynced: Int!
  totalSyncRuns: Int!
  totalSyncErrors: Int!
  consecutiveSyncFailures: Int!
  recentSyncRuns(first: Int = 20): IntegrationSyncRunConnection!
  pendingConflictsCount: Int!
  healthSnapshot: IntegrationHealthSnapshot!
  appliesToStores: [Store!]
  createdAt: DateTime!
}

enum IntegrationEnvironmentKind { PRODUCTION SANDBOX TEST }
enum IntegrationConnectionStatus {
  CONNECTING CONNECTED SYNCING HEALTHY DEGRADED ERROR PAUSED
  DISCONNECTING DISCONNECTED REQUIRES_REAUTH
}
enum ConflictResolutionPolicy { SHOPIO_WINS EXTERNAL_WINS MANUAL_REVIEW NEWEST_WINS }

type IntegrationHealthSnapshot {
  pingPassed: Boolean!
  authPassed: Boolean!
  rateLimitProbePassed: Boolean!
  lastCheckedAt: DateTime!
  latencyMs: Int
}

type IntegrationSyncRun implements Node {
  id: ID!
  pubId: String!
  connection: IntegrationConnection!
  syncKind: SyncKind!
  resourceKinds: [String!]!
  direction: IntegrationDataFlowDirection!
  recordsAttempted: Int!
  recordsSynced: Int!
  recordsFailed: Int!
  recordsConflict: Int!
  recordsSkipped: Int!
  status: SyncRunStatus!
  startedAt: DateTime
  finishedAt: DateTime
  durationMs: Int
  errorSummary: String
  errorDetails: JSON
  triggeredByKind: SyncTriggeredByKind!
  triggeredBy: User
  triggeredAt: DateTime!
}

enum SyncKind { INCREMENTAL FULL_BACKFILL MANUAL RETRY RECONCILE TEST }
enum SyncRunStatus { QUEUED RUNNING COMPLETED PARTIAL FAILED CANCELLED }
enum SyncTriggeredByKind { SCHEDULE MANUAL EVENT_DRIVEN RETRY WEBHOOK_INBOUND }

type IntegrationSyncRecord {
  id: ID!
  syncRun: IntegrationSyncRun!
  shopioResourceKind: String!
  shopioResourceId: String
  externalResourceId: String
  direction: IntegrationDataFlowDirection!
  outcome: SyncRecordOutcome!
  reasonKind: String
  reasonDetail: String
  fieldChanges: JSON
  occurredAt: DateTime!
}

enum SyncRecordOutcome { SYNCED SKIPPED CONFLICT FAILED }

type IntegrationFieldMapping {
  id: ID!
  connection: IntegrationConnection!
  resourceKind: String!
  shopioFieldPath: String!
  externalFieldPath: String!
  direction: IntegrationDataFlowDirection!
  transformKind: TransformKind
  transformConfig: JSON
  conflictPolicy: ConflictResolutionPolicy
  isEnabled: Boolean!
}

enum TransformKind {
  NOOP TO_UPPER TO_LOWER CURRENCY_CONVERT DATE_FORMAT NUMBER_FORMAT
  BOOLEAN_TO_YN STRIP_HTML_TO_TEXT CENTS_TO_DECIMAL JSON_FLATTEN CUSTOM_FUNCTION
}

type IntegrationConflict implements Node {
  id: ID!
  pubId: String!
  connection: IntegrationConnection!
  shopioResourceKind: String!
  shopioResourceId: String!
  externalResourceId: String
  conflictKind: ConflictKind!
  fieldDiffs: JSON!
  status: ConflictStatus!
  resolution: ConflictResolution
  resolutionNotes: String
  detectedAt: DateTime!
  resolvedAt: DateTime
  resolvedBy: User
}

enum ConflictKind { CONCURRENT_EDIT FIELD_MISMATCH SCHEMA_DRIFT MISSING_EXTERNAL MISSING_SHOPIO DUPLICATE_EXTERNAL }
enum ConflictStatus { PENDING RESOLVED DISMISSED }
enum ConflictResolution { USED_SHOPIO USED_EXTERNAL MANUAL_MERGE SKIP CREATE_NEW }

extend type Query {
  integrationDefinitions(category: IntegrationCategory, region: String): [IntegrationDefinition!]!
  integrationDefinition(code: String!): IntegrationDefinition

  integrationConnections(filter: IntegrationConnectionFilter): [IntegrationConnection!]! @auth(requires: PERM_INTEGRATION_VIEW)
  integrationConnection(id: ID, pubId: String): IntegrationConnection @auth(requires: PERM_INTEGRATION_VIEW)
  integrationConnectionByCode(code: String!): IntegrationConnection @auth(requires: PERM_INTEGRATION_VIEW)

  integrationSyncRuns(connectionId: ID!, status: [SyncRunStatus!], first: Int, after: String): IntegrationSyncRunConnection!
  integrationSyncRun(id: ID!): IntegrationSyncRun
  integrationSyncRecords(syncRunId: ID, connectionId: ID, outcome: [SyncRecordOutcome!]): IntegrationSyncRecordConnection!

  integrationConflicts(connectionId: ID, status: [ConflictStatus!] = [PENDING]): [IntegrationConflict!]!
  integrationConflict(id: ID): IntegrationConflict

  integrationFieldMappings(connectionId: ID!, resourceKind: String): [IntegrationFieldMapping!]!
  integrationFieldSchemaForResource(connectionId: ID!, resourceKind: String!, direction: IntegrationDataFlowDirection!): FieldSchema!

  integrationAnalyticsOverview: IntegrationAnalyticsOverview! @auth(requires: PERM_INTEGRATION_VIEW)
}

extend type Mutation {
  # Lifecycle
  startIntegrationConnect(input: StartIntegrationConnectInput!): IntegrationConnectChallenge! @auth(requires: PERM_INTEGRATION_MANAGE)
  completeIntegrationConnect(input: CompleteIntegrationConnectInput!): IntegrationConnection! @auth(requires: PERM_INTEGRATION_MANAGE)
  updateIntegrationConnection(id: ID!, input: UpdateIntegrationConnectionInput!): IntegrationConnection! @auth(requires: PERM_INTEGRATION_MANAGE)
  pauseIntegrationConnection(id: ID!): IntegrationConnection! @auth(requires: PERM_INTEGRATION_MANAGE)
  resumeIntegrationConnection(id: ID!): IntegrationConnection! @auth(requires: PERM_INTEGRATION_MANAGE)
  disconnectIntegration(id: ID!, reason: String): DeletePayload! @auth(requires: PERM_INTEGRATION_MANAGE)
  testIntegrationConnection(id: ID!): IntegrationHealthSnapshot! @auth(requires: PERM_INTEGRATION_MANAGE)
  reauthIntegrationConnection(id: ID!): IntegrationConnectChallenge! @auth(requires: PERM_INTEGRATION_MANAGE)

  # Sync
  triggerIntegrationSync(input: TriggerIntegrationSyncInput!): IntegrationSyncRun! @auth(requires: PERM_INTEGRATION_MANAGE)
  cancelIntegrationSyncRun(id: ID!): IntegrationSyncRun!
  triggerFullBackfill(connectionId: ID!): IntegrationSyncRun! @auth(requires: PERM_INTEGRATION_MANAGE)
  triggerReconcile(connectionId: ID!): IntegrationSyncRun! @auth(requires: PERM_INTEGRATION_MANAGE)
  retrySyncRecords(connectionId: ID!, recordIds: [ID!]!): MutationPayload!
  dismissSyncRecords(connectionId: ID!, recordIds: [ID!]!): MutationPayload!

  # Field mappings
  updateFieldMappings(connectionId: ID!, resourceKind: String!, mappings: [FieldMappingInput!]!): [IntegrationFieldMapping!]! @auth(requires: PERM_INTEGRATION_MANAGE)
  resetFieldMappingsToDefaults(connectionId: ID!, resourceKind: String!): [IntegrationFieldMapping!]! @auth(requires: PERM_INTEGRATION_MANAGE)
  suggestFieldMappings(connectionId: ID!, resourceKind: String!): [SuggestedFieldMapping!]!
  previewFieldMapping(connectionId: ID!, input: PreviewMappingInput!): FieldMappingPreview!

  # Conflicts
  resolveIntegrationConflict(id: ID!, input: ResolveConflictInput!): IntegrationConflict! @auth(requires: PERM_INTEGRATION_RESOLVE_CONFLICTS)
  dismissIntegrationConflict(id: ID!): IntegrationConflict! @auth(requires: PERM_INTEGRATION_RESOLVE_CONFLICTS)
  bulkResolveConflicts(ids: [ID!]!, resolution: ConflictResolution!): MutationPayload! @auth(requires: PERM_INTEGRATION_RESOLVE_CONFLICTS)
}
```

---

## 11. Events

| Build-spec ID | Wire | Payload |
|---|---|---|
| `EVENT-INT-CONNECTION-CREATED` | `integration.connection_created` | `{ connection }` |
| `EVENT-INT-CONNECTED` | `integration.connected` | `{ connection }` |
| `EVENT-INT-DISCONNECTED` | `integration.disconnected` | `{ connection, reason }` |
| `EVENT-INT-REAUTH-REQUIRED` | `integration.reauth_required` | `{ connection }` |
| `EVENT-INT-STATUS-CHANGED` | `integration.status_changed` | `{ connection, previous, new }` |
| `EVENT-INT-SYNC-QUEUED` | `integration.sync_queued` | `{ sync_run }` |
| `EVENT-INT-SYNC-STARTED` | `integration.sync_started` | `{ sync_run }` |
| `EVENT-INT-SYNC-COMPLETED` | `integration.sync_completed` | `{ sync_run, summary }` |
| `EVENT-INT-SYNC-FAILED` | `integration.sync_failed` | `{ sync_run, error }` |
| `EVENT-INT-SYNC-PARTIAL` | `integration.sync_partial` | `{ sync_run, summary }` |
| `EVENT-INT-RECORDS-FAILED` | `integration.records_failed` | `{ connection, sync_run, count, sample_records }` |
| `EVENT-INT-CONFLICT-DETECTED` | `integration.conflict_detected` | `{ conflict }` |
| `EVENT-INT-CONFLICT-RESOLVED` | `integration.conflict_resolved` | `{ conflict, resolution }` |
| `EVENT-INT-WEBHOOK-INBOUND-RECEIVED` | `integration.webhook_inbound_received` | `{ event }` |
| `EVENT-INT-WEBHOOK-INBOUND-PROCESSED` | `integration.webhook_inbound_processed` | `{ event }` |
| `EVENT-INT-WEBHOOK-INBOUND-FAILED` | `integration.webhook_inbound_failed` | `{ event, error }` |
| `EVENT-INT-HEALTH-CHECK-FAILED` | `integration.health_check_failed` | `{ connection, check_kind, details }` |
| `EVENT-INT-AUTO-PAUSED-CONSECUTIVE-FAILURES` | `integration.auto_paused` | `{ connection, failures_count }` |
| `EVENT-INT-FIELD-MAPPING-UPDATED` | `integration.field_mapping_updated` | `{ connection, resource_kind }` |
| `EVENT-INT-RECONCILIATION-DISCREPANCY` | `integration.reconciliation_discrepancy` | `{ connection, count }` |
| `EVENT-INT-ADAPTER-VERSION-UPDATE-AVAILABLE` | `integration.adapter_version_update_available` | `{ connection, current, new }` |
| `EVENT-INT-CUSTOMER-ERASURE-REQUESTED` | `integration.customer_erasure_requested` | `{ connection, customer }` (GDPR forward) |

**Konzumenti:**
- Notification center (per `27 §13`) — sync failures, conflicts, reauth
- Email alerts pro merchant (degraded health, repeated failures)
- AI Copilot — diagnose patterns
- Per-connection dashboard
- External webhooks (when tenant subscribes via `28`)

---

## 12. Background jobs

| Job | Trigger | Queue | Frequency |
|---|---|---|---|
| `JOB-VALIDATE-INTEGRATION-CREDENTIALS` | new connection | `integrations` | On-demand |
| `JOB-RUN-INTEGRATION-SYNC` | scheduled per connection | `integrations-sync` | Per `sync_interval_minutes` |
| `JOB-RUN-FULL-BACKFILL` | manual trigger | `integrations-bulk` | On-demand |
| `JOB-RUN-RECONCILIATION` | scheduled | `integrations-reconcile` | Weekly per connection |
| `JOB-PROCESS-INBOUND-WEBHOOK-EVENT` | inbound webhook | `integrations-inbound` | Continuous |
| `JOB-RETRY-FAILED-SYNC-RECORDS` | scheduled | `integrations-retry` | Hourly |
| `JOB-AUTO-PAUSE-FAILING-CONNECTIONS` | EVENT-INT-SYNC-FAILED | `integrations` | On-demand |
| `JOB-HEALTH-CHECK-CONNECTIONS` | scheduled | `integrations-health` | Every 6h per connection |
| `JOB-EXPIRE-OAUTH-TOKENS` | scheduled | `maintenance` | Hourly |
| `JOB-NOTIFY-REAUTH-REQUIRED` | EVENT-INT-REAUTH-REQUIRED | `notifications` | On-demand |
| `JOB-DETECT-SCHEMA-DRIFT` | scheduled | `integrations-contract-tests` | Daily |
| `JOB-CLEANUP-OLD-SYNC-RUNS` | scheduled | `maintenance` | Daily (>90d archived) |
| `JOB-CLEANUP-OLD-WEBHOOK-EVENTS` | scheduled | `maintenance` | Daily (>30d archived) |
| `JOB-REGENERATE-COMPARISON-SHOPPING-FEED` | EVENT-PRODUCT-UPDATED (debounced) | `feeds` | Continuous (5-min debounce) |
| `JOB-REGENERATE-COMPARISON-SHOPPING-FEED-FULL` | scheduled | `feeds` | Daily 02:00 |
| `JOB-DISPATCH-META-CAPI-EVENTS` | EVENT-ORDER-PLACED + others | `meta-capi` | Continuous |
| `JOB-DISPATCH-TIKTOK-EVENTS` | EVENT-ORDER-PLACED + others | `tiktok-events` | Continuous |
| `JOB-DISPATCH-GOOGLE-ADS-CONVERSIONS` | EVENT-ORDER-PLACED + others | `google-ads` | Continuous |
| `JOB-SYNC-MAILCHIMP-AUDIENCE` | EVENT-CUSTOMER-CREATED, EVENT-CUSTOMER-UPDATED | `marketing-email` | Continuous |
| `JOB-SYNC-KLAVIYO-PROFILES` | various events | `marketing-automation` | Continuous |
| `JOB-EXPORT-INVOICE-TO-POHODA` | EVENT-INVOICE-ISSUED | `accounting-pohoda` | Continuous |
| `JOB-EXPORT-INVOICE-TO-IDOKLAD` | EVENT-INVOICE-ISSUED | `accounting-idoklad` | Continuous |
| `JOB-FORWARD-GDPR-ERASURE` | EVENT-CUSTOMER-ERASED | `gdpr-forward` | Continuous |
| `JOB-COMPUTE-INTEGRATION-ANALYTICS` | scheduled | `analytics` | Hourly aggregate |
| `JOB-DETECT-INTEGRATION-ABUSE` | scheduled | `security` | Hourly (anomalous rate/scope use) |

---

## 13. UI/UX flows

### FLOW-INT-001: Connect Pohoda

```
[Admin → Integrations → Browse]
   - Catalog s ikonami, kategoriemi (Accounting, Marketing, ...)
   - Filtr: region=CZ, capability=invoices
        ↓
   click Pohoda
        ↓
[Pohoda definition page]
   - Description, screenshots, capabilities, GDPR badge
   - "Connect" button
        ↓
   click Connect
        ↓
[Connect wizard step 1: Environment]
   - Production / Sandbox / Test
   - Display name: "Production Pohoda"
        ↓
[Step 2: Credentials — schema-driven form]
   - Pohoda mServer URL: [____________]
   - ICO: [____________]
   - Auth kind: Basic Auth / API Key
   - Username + password
   - "Test connection" button (live verify)
        ↓
   click Test → green badge "Connection successful"
        ↓
[Step 3: Sync settings]
   - Sync interval: 30 min
   - Stores covered: all
   - Resources to sync:
     ☑ Products (bidirectional)
     ☑ Customers (bidirectional)
     ☑ Orders → Invoices (outbound)
   - Conflict policy: Manual review
        ↓
[Step 4: Field mappings — visual mapper]
   - For each resource: show suggested mappings
   - User can adjust drag-drop
   - "Preview with sample data" button
        ↓
[Step 5: Initial sync]
   - Choice: "Full backfill now" / "Start incremental"
   - Click "Connect"
        ↓
[Connection created: status='connected']
   - Backfill running in background
   - Notification when complete
   - Dashboard tile for connection
```

### FLOW-INT-002: Connect Mailchimp (OAuth)

```
[Admin → Integrations → Mailchimp → Connect]
        ↓
[Step 1: OAuth handoff]
   - Redirect to Mailchimp OAuth
        ↓
   user logs in / authorizes
        ↓
[Callback: code → token exchange]
   - Server retrieves access token + datacenter from Mailchimp
   - Persists encrypted
        ↓
[Step 2: Pick audience (list)]
   - Dropdown: existing Mailchimp lists
   - Or "Create new audience" → spawns new list in Mailchimp
        ↓
[Step 3: Sync settings]
   - Sync only customers with marketing consent: ☑
   - Tags to apply: order_count, total_spent, last_order_date
   - Frequency: real-time (event-driven)
        ↓
[Step 4: Field mappings (pre-suggested)]
   - email_address → email
   - first_name → merge_fields.FNAME
   - tags → tags
        ↓
   Save & Connect
        ↓
[Background: initial backfill of consented customers]
   - Email after complete
```

### FLOW-INT-003: Receive Pohoda inbound webhook (payment confirmation)

```
[Customer pays invoice]
        ↓
[Accountant marks payment in Pohoda]
        ↓
[Pohoda exports XML to URL (configured one-time)]
   POST /api/.../integrations/icn_aB/webhook-inbound
   <dataPack> ... payment confirmation ... </dataPack>
        ↓
[Server: signature verify + persist + 200 OK]
        ↓
[Background JOB-PROCESS-INBOUND-WEBHOOK-EVENT]
   - Adapter parses XML
   - Identifies Shopio invoice (via mapping)
   - Updates invoice.paid_at, payment_status='paid'
   - Emits EVENT-INVOICE-PAID
        ↓
[Order status updated; customer email sent]
```

### FLOW-INT-004: Sync failure → conflict resolution

```
[Scheduled JOB-RUN-INTEGRATION-SYNC for Pohoda]
        ↓
   detects: product P1 title differs in Shopio vs Pohoda
   policy = manual_review
        ↓
[Conflict created: integration_conflicts row]
   - status='pending'
   - field_diffs: { title: { shopio: 'Black Shirt v2', external: 'Black Shirt' } }
        ↓
[Notification to merchant]
   - Bell badge increments
        ↓
[Admin → Integrations → Pohoda → Conflicts tab (badge: 1)]
   - Conflicts table
        ↓
   click conflict
        ↓
[Conflict detail page]
   - Side-by-side diff
   - Per-field choice (use Shopio, use external, manual)
   - "Apply to all similar conflicts" option (bulk)
        ↓
   user selects: title → external; submits
        ↓
[Shopio product updated → external takes priority for this conflict]
[ID mapping checksums refreshed]
[Status='resolved'; logged]
```

### FLOW-INT-005: AI suggests field mapping

```
[Connect wizard step 4: Field mapping]
   - Default mappings pre-filled
   - User confused about external field "Brand_Code_Pohoda"
        ↓
   clicks "Ask AI"
        ↓
[AI panel slides in]
   - Sees current mapping context
   - Suggests: "Map Shopio.brand.code → Pohoda.Brand_Code_Pohoda; we see Shopio brand.code values match Pohoda's existing brand list 87%"
   - Shows samples
        ↓
   user accepts → mapping added
```

### FLOW-INT-006: Reauth required

```
[Mailchimp OAuth token expired without refresh]
        ↓
[Connection status='requires_reauth']
[Sync paused]
        ↓
[Email + in-app banner: "Mailchimp connection requires re-authorization"]
        ↓
[Admin → Integrations → Mailchimp → "Reauthorize"]
   - Redirect to Mailchimp OAuth (same flow as initial)
        ↓
[Callback: new tokens]
[Connection back to status='healthy']
[Sync resumes from last cursor]
```

### FLOW-INT-007: Reconciliation detection

```
[Weekly JOB-RUN-RECONCILIATION for Pohoda]
        ↓
   compares: Shopio products vs Pohoda products
   detects: 5 products exist in Pohoda without Shopio counterparts (orphans)
        ↓
[Conflicts created: kind='missing_shopio']
[Notification: "Pohoda has 5 products not in Shopio. Review?"]
        ↓
   user reviews:
     - 3 are legacy items → resolve='skip'
     - 2 are valid → resolve='create_new' (creates in Shopio)
        ↓
[Resolved; ID mappings updated]
```

---

## 14. Per-integration specifics

### 14.1 Pohoda

- **Connect kind:** mServer HTTP API + Basic Auth + ICO; OR file-based ISDOC export
- **XML format:** Pohoda DataPack (XSD-validated) + ISDOC 6.0.1 (per `15-tax-compliance.md`)
- **Capabilities:**
  - Orders → Invoices outbound (real-time on `order.placed` with payment captured)
  - Products bidirectional (master = configurable per tenant)
  - Customers bidirectional
  - Payment confirmations inbound (Pohoda exports paid invoices XML → we update)
- **Stock sync:** optional — bidirectional. Default master = Shopio.
- **Edge cases:** Pohoda doesn't support multi-currency products elegantly; transform handles.

### 14.2 iDoklad

- **Connect kind:** OAuth 2.0 (iDoklad provides standard OAuth)
- **Capabilities:** REST API; invoices, customers, payments bidirectional
- **Stock:** N/A (iDoklad doesn't track stock)
- **Real-time:** event-driven on `invoice.issued`

### 14.3 Heuréka.cz

- **Connect kind:** No-auth (XML feed URL public; feed verified by Heureka periodically)
- **Capabilities:** Outbound product feed only; Heureka pulls
- **Feed URL:** `/feeds/heureka.xml?store_id={id}`
- **Update frequency:** incremental cache invalidation on product changes (debounced 5 min); full regenerate daily 02:00
- **Feed format:** Heureka XML spec (CATEGORYTEXT, ITEM, PRODUCT, etc.)
- **Filtering:** Default: products with stock>0, published, no internal tag `exclude_heureka`
- **Reviews integration:** "Ověřeno zákazníky" (Verified by customers) — order info pushed for follow-up review request

### 14.4 Zboží.cz

- **Connect kind:** No-auth (Seznam Wallet integration for paid leads)
- **Capabilities:** Outbound product feed; Zbozi.cz XML spec
- **Pricing:** CPC bidding through Seznam Wallet
- **Categories:** Mapping to Zbozi.cz hierarchy

### 14.5 Glami

- **Connect kind:** No-auth (XML feed)
- **Capabilities:** Outbound product feed (fashion focus)
- **Special fields:** size, color, brand, gender required for Glami

### 14.6 Google Shopping

- **Connect kind:** OAuth (Google Merchant Center)
- **Capabilities:** Content API for Products; bulk product sync
- **Real-time:** product updates within minutes
- **Validation:** Google strict; adapter validates locally first

### 14.7 Meta Commerce + CAPI

- **Connect kind:** OAuth (Meta Business)
- **Capabilities:**
  - Catalog sync (Catalog API)
  - Conversions API (server-side) — primary
  - Pixel client-side (parallel for redundancy + deduplication)
  - Shop checkout (Meta-native checkout opt-in Fáze 2+)
- **Events:** PageView, ViewContent, AddToCart, InitiateCheckout, Purchase, ...
- **Deduplication:** Use `event_id` shared between client + server

### 14.8 TikTok Events API + Catalog

- **Connect kind:** OAuth (TikTok Business)
- **Capabilities:** Same shape as Meta — Catalog + Events API server-side
- **TikTok Shop:** Marketplace integration (Fáze 2+)

### 14.9 Google Ads (Enhanced Conversions)

- **Connect kind:** OAuth (Google Ads Manager)
- **Capabilities:** Enhanced Conversions API (server-side); offline conversion imports
- **Privacy:** Customer email hashed (SHA-256) before send (per Google spec)

### 14.10 GA4

- **Connect kind:** API key (Measurement Protocol Secret)
- **Capabilities:**
  - Client-side: gtag.js auto-injected (per `19-marketing-seo.md`)
  - Server-side: Measurement Protocol for resilient tracking
- **Events:** view_item, add_to_cart, begin_checkout, purchase, refund

### 14.11 Mailchimp

- **Connect kind:** OAuth
- **Capabilities:**
  - Audience (list) management
  - Member sync (consented customers)
  - Tags + merge fields
  - Transactional (via Mandrill bridge optional Fáze 2)
- **GDPR:** Consent ledger respected; un-consent triggers Mailchimp `permission_reminder = false` + tag

### 14.12 Klaviyo

- **Connect kind:** API key (Klaviyo private key)
- **Capabilities:**
  - Event-based: Placed Order, Started Checkout, Viewed Product, ...
  - Profile sync
  - Custom properties (RFM segments per `20-analytics-reporting.md`)
- **Real-time:** event-driven; sub-second propagation

### 14.13 Brevo (Sendinblue)

- **Connect kind:** API key
- **Capabilities:** Contacts + templates + transactional + automation
- **EU data residency:** Brevo EU servers

### 14.14 Ecomail.cz

- **Connect kind:** API key
- **Capabilities:** Contacts + lists + automations
- **Czech-native:** UTF-8, diacritics, GDPR-friendly setup

### 14.15 Trustpilot

- **Connect kind:** OAuth + Business Account
- **Capabilities:**
  - Outbound: post-purchase review invitation (Service review or Product review)
  - Inbound: review aggregate fetched daily (avg rating, review count)

### 14.16 Heureka Recenze ("Ověřeno zákazníky")

- **Connect kind:** API key from Heureka
- **Capabilities:** order info pushed; Heureka emails customer for review

### 14.17 Zendesk + Intercom

- **Connect kind:** OAuth
- **Capabilities:**
  - Tickets created from `contact_form_submitted` + manual creation
  - Bidirectional ticket status sync
  - Customer context: order history available in Zendesk sidebar (via Apps framework)

### 14.18 DeepL

- **Connect kind:** API key
- **Capabilities:**
  - Auto-translate product descriptions, page content
  - Translation memory (cache to reduce API calls)
  - Per `23-i18n.md` integrace

### 14.19 Zapier / Make

- **Connect kind:** Public webhook API (per `28 §5`)
- **Capabilities:** Tenant connects Zapier zap to Shopio webhook subscription; no special adapter needed (uses standard webhook infrastructure)

### 14.20 POS receipt printers (Fáze 3+)

- **Connect kind:** Local connection (USB / network) — driver-based
- **Protocol:** ESC/POS standard
- **Capabilities:** Print order receipts, refunds, cash drawer open
- **Architecture:** POS app (Fáze 3+) interfaces directly with printer; integration registry stores configuration only

---

## 15. Edge cases & error handling

| Scenario | Behavior | Code |
|---|---|---|
| External API returns 401 (token revoked) | Connection → `requires_reauth`; sync paused | `INTEGRATION_AUTH_INVALID`, 401 |
| External rate limit (429) | Respect `Retry-After`; exponential backoff | (handled) |
| External 5xx | Retry per schedule | (handled) |
| External schema changed (new required field) | Sync fails; AI Copilot diagnoses; adapter version bump | (handled) |
| Credentials encrypted-at-rest fail to decrypt | Connection inoperable; alert security | `CREDENTIALS_DECRYPT_FAILED`, 500 |
| Concurrent edit conflict | Per `RULE-INT-006` policy | (handled) |
| Inbound webhook signature invalid | 401, log security event | `WEBHOOK_SIGNATURE_INVALID`, 401 |
| Inbound webhook idempotency duplicate | `processing_status='duplicate'`, 200 (idempotent) | (handled) |
| Sync run timeout (> max duration) | Cancelled; partial completion recorded; retry next interval | (handled) |
| External account suspended/closed | `connection.status='error'`; merchant notified | (handled) |
| GDPR erasure conflict (external system can't delete) | Manual task created; compliance officer notified | (handled per `RULE-INT-011`) |
| Multiple connections same integration sync overlapping changes | Last-write-wins per timestamp; conflict if both same timestamp | (handled) |
| Adapter package missing dependency at runtime | Sync fails; alert; auto-fallback to last good version | (handled) |
| External returns success but data not persisted | Adapter detects via subsequent read-back; alerts as schema_drift | (handled) |
| Tenant deletion | All connections disconnected; data purged per retention rules | (handled) |
| Test data leaking to production | environment_kind enforced; flagged in metadata | (handled per `RULE-INT-013`, `RULE-INT-016`) |
| Marketing email sync to non-consented customer | Pre-filter blocks; logged as `outcome='skipped'`, `reason_kind='consent_missing'` | (handled per `RULE-INT-027`) |
| Heureka feed regeneration concurrent | Locks per feed; debounce 5 min ensures single regen | (handled) |
| Pohoda mServer offline | Sync fails; retries; alerts after consecutive failures | (handled) |
| Currency unsupported by external | Transform: convert at last known rate (per `23-i18n.md`); flag in metadata | (handled) |
| Custom adapter (tenant-specific) crashes | Sandboxed in edge function isolate; one crash doesn't affect other tenants | (handled per `28 §8.6`) |

---

## 16. Performance, security, testing

### 16.1 Performance targets

| Operation | p50 | p95 | p99 |
|---|---|---|---|
| Connection creation + validation | 500 ms | 2000 ms | 5000 ms |
| Connect wizard credentials test | 200 ms | 1000 ms | 3000 ms |
| Incremental sync (100 records) | 5 s | 30 s | 60 s |
| Full backfill (10k products) | 5 min | 20 min | 60 min |
| Inbound webhook receive→200 | 50 ms | 200 ms | 500 ms |
| Webhook processing (background) | 200 ms | 1000 ms | 5000 ms |
| Conflict creation | 20 ms | 100 ms | 300 ms |
| Field mapping preview | 100 ms | 500 ms | 1500 ms |
| Heureka feed regen incremental | 30 s | 2 min | 5 min |
| Heureka feed regen full | 5 min | 15 min | 30 min |
| Meta CAPI dispatch | 200 ms | 800 ms | 2000 ms |

### 16.2 Scaling targets

- 100k connections across tenants
- 10M sync records per day
- 1M inbound webhooks per day
- 100k comparison shopping feed updates per minute (cache invalidations)

### 16.3 Security

#### 16.3.1 Permissions

```
PERM-INTEGRATION-VIEW
PERM-INTEGRATION-MANAGE
PERM-INTEGRATION-RESOLVE-CONFLICTS
PERM-INTEGRATION-ACCOUNTING-MANAGE                                                                                                                                                                                                                                                                              # finer scope per category
PERM-INTEGRATION-MARKETING-MANAGE
PERM-INTEGRATION-SUPPORT-MANAGE
PERM-INTEGRATION-DEBUG                                                                                                                                                                                                                                                                                            # access to detailed sync records
PERM-PLATFORM-INTEGRATION-REGISTRY-MANAGE                                                                                                                                                                                                                                                                          # platform staff
```

#### 16.3.2 Credentials at rest

- Encrypted via AES-GCM with KMS-wrapped DEK
- Per `30-security.md`
- Plaintext never logged
- Access audit-logged

#### 16.3.3 Webhook inbound security

- HMAC signature verification per adapter
- Replay protection via timestamp + idempotency keys
- IP allowlist optional (configurable per connection)
- TLS-only

#### 16.3.4 Outbound calls

- TLS-only
- Certificate pinning for high-trust integrations (Pohoda, banks)
- Egress proxy with allow-listed domains (per `30-security.md`)
- Per-adapter timeout enforcement

#### 16.3.5 Audit

All security-relevant events logged:
- Connection create/update/delete
- Credentials access
- Conflict resolutions
- Webhook signature failures (sampled)
- Adapter version upgrades

### 16.4 Testing

#### 16.4.1 Unit (per adapter)

```
TEST-UNIT-INT-{ADAPTER}-001  Credentials schema validation
TEST-UNIT-INT-{ADAPTER}-002  Field mappers (pure functions)
TEST-UNIT-INT-{ADAPTER}-003  Outbound payload construction
TEST-UNIT-INT-{ADAPTER}-004  Inbound payload parsing
TEST-UNIT-INT-{ADAPTER}-005  Webhook signature verification
TEST-UNIT-INT-{ADAPTER}-006  Error mapping (external errors → SyncError)
```

#### 16.4.2 Integration (per adapter against sandbox)

```
TEST-INT-INT-{ADAPTER}-001  Connect flow end-to-end
TEST-INT-INT-{ADAPTER}-002  Outbound sync (create + update + delete)
TEST-INT-INT-{ADAPTER}-003  Inbound sync
TEST-INT-INT-{ADAPTER}-004  Conflict detection on bidirectional
TEST-INT-INT-{ADAPTER}-005  Webhook inbound processing
TEST-INT-INT-{ADAPTER}-006  Reauth flow
TEST-INT-INT-{ADAPTER}-007  Disconnect cleanup
```

#### 16.4.3 Contract tests (daily against sandbox)

```
TEST-CONTRACT-INT-{ADAPTER}-001  External API schema unchanged (per resource)
TEST-CONTRACT-INT-{ADAPTER}-002  Required fields still required
TEST-CONTRACT-INT-{ADAPTER}-003  Authentication still works
TEST-CONTRACT-INT-{ADAPTER}-004  Rate limit headers exposed
```

CI alerts when contract breaks → schema drift detected → adapter author paged.

#### 16.4.4 E2E

```
TEST-E2E-INT-001  Merchant connects Pohoda + initial sync completes
TEST-E2E-INT-002  Order placed → invoice in Pohoda within 30s
TEST-E2E-INT-003  Pohoda payment inbound → order status updated
TEST-E2E-INT-004  Conflict resolution UI flow
TEST-E2E-INT-005  Connect Mailchimp OAuth + audience sync
TEST-E2E-INT-006  Marketing consent revoked → customer untagged in Mailchimp
TEST-E2E-INT-007  Heureka feed regeneration + Heureka validation
TEST-E2E-INT-008  Meta CAPI event dispatch + Meta Test Events tool verifies
TEST-E2E-INT-009  Reauth flow for expired OAuth
TEST-E2E-INT-010  Tenant deletion → all integrations disconnected, data purged
```

#### 16.4.5 Load + chaos

```
TEST-LOAD-INT-001  10 connections per tenant, 100k tenants, scheduled sync within window
TEST-LOAD-INT-002  Heureka feed 100k products regen < 5 min
TEST-LOAD-INT-003  Meta CAPI 10k events/sec dispatch
TEST-CHAOS-INT-001 External API down 1 hour → sync queue + recover
TEST-CHAOS-INT-002 Network partition mid-sync → retry resume
TEST-CHAOS-INT-003 KMS unavailable → connections inoperable but no data loss
```

#### 16.4.6 Security

```
TEST-SEC-INT-001  Credentials never appear in logs
TEST-SEC-INT-002  Webhook signature tampering rejected
TEST-SEC-INT-003  Cross-tenant credential access blocked
TEST-SEC-INT-004  SQL injection via mapping transform input
TEST-SEC-INT-005  SSRF via inbound URL config blocked (allowlist)
TEST-SEC-INT-006  GDPR erasure propagation verified per adapter
```

---

## 17. Implementation checklist

### Core integrations infrastructure
- [ ] **[S]** Drizzle schema `packages/db/src/schema/integrations/*.ts`
- [ ] **[S]** Migrace `20260612_001_create_integration_tables.sql`
- [ ] **[L]** `IntegrationsCore` package: adapter interface, registry, runner
- [ ] **[L]** `SyncEngine` — incremental, full_backfill, retry, reconcile
- [ ] **[L]** `FieldMapper` — schema, transforms, preview
- [ ] **[M]** `ConflictDetector` + `ConflictResolver`
- [ ] **[L]** `CredentialsVault` (KMS-wrapped DEK)
- [ ] **[M]** `WebhookInboundReceiver` + signature verification framework
- [ ] **[M]** `HealthCheckRunner`
- [ ] **[M]** `IntegrationAnalyticsAggregator`
- [ ] **[M]** REST endpoints per §9
- [ ] **[M]** GraphQL types + resolvers
- [ ] **[S]** tRPC for admin

### First-party adapters (MVP)
- [ ] **[XL]** `@shopio/integration-pohoda`
- [ ] **[L]** `@shopio/integration-idoklad`
- [ ] **[M]** `@shopio/integration-heureka`
- [ ] **[M]** `@shopio/integration-zbozi`
- [ ] **[M]** `@shopio/integration-glami`
- [ ] **[M]** `@shopio/integration-google-shopping`
- [ ] **[L]** `@shopio/integration-meta` (Catalog + CAPI)
- [ ] **[L]** `@shopio/integration-tiktok`
- [ ] **[M]** `@shopio/integration-google-ads`
- [ ] **[M]** `@shopio/integration-ga4`
- [ ] **[L]** `@shopio/integration-mailchimp`
- [ ] **[L]** `@shopio/integration-klaviyo`
- [ ] **[M]** `@shopio/integration-brevo`
- [ ] **[M]** `@shopio/integration-ecomail`
- [ ] **[M]** `@shopio/integration-trustpilot`
- [ ] **[M]** `@shopio/integration-heureka-recenze`

### First-party adapters (Fáze 2)
- [ ] `@shopio/integration-money-s3`
- [ ] `@shopio/integration-abra-flexibee`
- [ ] `@shopio/integration-mall`
- [ ] `@shopio/integration-allegro`
- [ ] `@shopio/integration-pinterest`
- [ ] `@shopio/integration-plausible`
- [ ] `@shopio/integration-smartemailing`
- [ ] `@shopio/integration-modio`
- [ ] `@shopio/integration-zendesk`
- [ ] `@shopio/integration-intercom`
- [ ] `@shopio/integration-hubspot`
- [ ] `@shopio/integration-deepl`
- [ ] `@shopio/integration-google-translate`

### Background jobs
- [ ] **[M]** JOB-VALIDATE-INTEGRATION-CREDENTIALS
- [ ] **[XL]** JOB-RUN-INTEGRATION-SYNC + sub-flows per direction
- [ ] **[L]** JOB-RUN-FULL-BACKFILL (chunked)
- [ ] **[L]** JOB-RUN-RECONCILIATION
- [ ] **[L]** JOB-PROCESS-INBOUND-WEBHOOK-EVENT
- [ ] **[M]** JOB-RETRY-FAILED-SYNC-RECORDS
- [ ] **[M]** JOB-AUTO-PAUSE-FAILING-CONNECTIONS
- [ ] **[M]** JOB-HEALTH-CHECK-CONNECTIONS
- [ ] **[S]** JOB-EXPIRE-OAUTH-TOKENS + JOB-NOTIFY-REAUTH-REQUIRED
- [ ] **[M]** JOB-DETECT-SCHEMA-DRIFT (daily contract tests)
- [ ] **[S]** JOB-CLEANUP-OLD-SYNC-RUNS + WEBHOOK-EVENTS
- [ ] **[L]** JOB-REGENERATE-COMPARISON-SHOPPING-FEED (incremental + full)
- [ ] **[L]** JOB-DISPATCH-META-CAPI-EVENTS
- [ ] **[L]** JOB-DISPATCH-TIKTOK-EVENTS
- [ ] **[L]** JOB-DISPATCH-GOOGLE-ADS-CONVERSIONS
- [ ] **[L]** JOB-SYNC-MAILCHIMP-AUDIENCE
- [ ] **[L]** JOB-SYNC-KLAVIYO-PROFILES
- [ ] **[L]** JOB-EXPORT-INVOICE-TO-POHODA + JOB-EXPORT-INVOICE-TO-IDOKLAD
- [ ] **[M]** JOB-FORWARD-GDPR-ERASURE
- [ ] **[M]** JOB-COMPUTE-INTEGRATION-ANALYTICS
- [ ] **[M]** JOB-DETECT-INTEGRATION-ABUSE

### Frontend — Admin
- [ ] **[L]** Integration browse + filter
- [ ] **[XL]** Connection wizard (schema-driven, OAuth handoff)
- [ ] **[L]** Connection detail dashboard (KPIs, recent syncs, health)
- [ ] **[XL]** Visual field mapper (drag-drop)
- [ ] **[L]** Sync runs viewer + record-level detail
- [ ] **[L]** Conflicts resolution UI (side-by-side, bulk)
- [ ] **[M]** Inbound webhook events viewer
- [ ] **[M]** Integration analytics dashboard
- [ ] **[M]** AI assist panel (suggest mappings, diagnose errors)
- [ ] **[S]** Marketplace browse extension for community integrations (per `28`)

### Tests
- [ ] **[L]** Per §16.4 — per adapter unit + integration + contract
- [ ] **[L]** Sync engine load tests
- [ ] **[M]** Security tests

### Docs
- [ ] **[M]** "Connecting accounting (Pohoda)" guide
- [ ] **[M]** "Setting up marketing email" guide
- [ ] **[M]** "Comparison shopping feeds" guide
- [ ] **[M]** "Building a custom adapter" developer guide
- [ ] **[M]** "Field mapping deep dive"
- [ ] **[S]** Per-integration setup tutorials
- [ ] **[S]** Troubleshooting common sync errors

---

## 18. Open questions

### Q-INT-001: Community vs first-party split for marketplaces (Mall, Allegro, Amazon)
**Otázka:** Mall.cz/Allegro Marketplaces nejsou tradičně "integrace" — jsou to channels. Cross-ref s `22-multistore-channels.md`.

**Status:** Both. Adapter v 29; channel registration v 22. Adapter publishes/syncs catalog + inbound orders; channel routing/aggregation per 22.

### Q-INT-002: Bulk operations across integrations (e.g., bulk-publish to Heureka + Google + Meta from single action)
**Otázka:** UI shortcut "Publish to all comparison channels"?

**Status:** Fáze 2 feature. UI batches per-integration but executes in parallel.

### Q-INT-003: Custom transforms in field mapper (JS sandboxed?)
**Otázka:** Beyond declarative transforms, allow custom JS function?

**Status:** Fáze 2 via edge function (`28 §8.6`). Tenant defines function → call from field mapping.

### Q-INT-004: Integration analytics for cross-tenant benchmarks
**Otázka:** Anonymized "How my Mailchimp performs vs benchmark"?

**Status:** Out of scope MVP. Fáze 3+.

### Q-INT-005: Versioning external schemas + auto-upgrade
**Otázka:** When external API releases breaking change v2, how to migrate tenants?

**Status:** Per `RULE-INT-019` field mappings compatible. New adapter versions per `RULE-INT-033`. Manual review for breaking changes; 6-month deprecation window.

### Q-INT-006: Multi-tenant adapter resource pooling
**Otázka:** Shared HTTP keep-alive pool, Redis caches per adapter? Or strict per-tenant isolation?

**Status:** Per-tenant isolated for credentials + state. Pool/cache for stateless responses (e.g., category trees from external) acceptable if keyed by tenant.

### Q-INT-007: AI-generated adapters
**Otázka:** AI gen adapter code from external API docs?

**Status:** Fáze 4+ experiment. MVP: hand-written + reviewed.

### Q-INT-008: White-label integrations for agencies
**Otázka:** Agency wants to rebrand "Powered by Shopio" integrations for their merchants?

**Status:** Per `28 §8.x` agency mode. Adapter UI branding configurable.

### Q-INT-009: Migration tools from competing platforms (Shopify, WooCommerce import)
**Otázka:** Are imports "integrations"? Or separate migration domain?

**Status:** Separate. Migration tooling = onboarding wizard's "Import from..." flow (per `27`). Not always sync — often one-time import.

### Q-INT-010: Real-time stream vs polling
**Otázka:** Some external systems support push (Mailchimp webhooks); should we always prefer push over poll?

**Status:** Yes when available. Adapter declares supported modes; engine prefers push. Polling fallback if push unavailable.

### Q-INT-011: GDPR data residency cross-border
**Otázka:** EU tenant + US-based integration (e.g., Klaviyo HQ in US). Need explicit consent?

**Status:** Yes — disclosure in connection UI + DPA template. Per `RULE-INT-011`.

### Q-INT-012: Cost attribution per integration (track $ spent on external API quotas)
**Otázka:** Tenant billed by external for API calls; track to optimize?

**Status:** Fáze 3+ analytics. MVP: just count.

---

## 📅 Změny

| Datum | Změna |
|---|---|
| 2026-05-20 | Initial — Integrations domain. First-party adapter pattern + Sync Engine + Field Mapper + Conflict Resolution + Health Monitoring. EU-first MVP roster: Pohoda, iDoklad, Heureka, Zboží, Glami, Meta/TikTok/Google CAPI, Mailchimp/Klaviyo/Brevo/Ecomail, Trustpilot/Heureka Recenze. 35 business rules, 22 events, 25 background jobs. |

---

**Konec Integrations.**

➡️ Pokračovat na: [`30-security.md`](30-security.md)
