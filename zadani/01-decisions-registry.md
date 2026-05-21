# 01 – DECISIONS REGISTRY

> **Účel:** Registr všech architektonických a strategických rozhodnutí. Každé rozhodnutí má unikátní ID, kontext, alternativy, důvod volby a důsledky. Toto je **Single Source of Truth** pro rozhodnutí napříč celou platformou.

**Formát:** Architecture Decision Record (ADR) – upravená šablona

**Status legenda:**
- ✅ ACCEPTED – závazné rozhodnutí
- 🔄 PROPOSED – návrh, ještě nezáväzné
- ⚠️ DEPRECATED – staré rozhodnutí, nahrazeno
- ❌ REJECTED – navrženo, ale odmítnuto

---

## 📑 Obsah rozhodnutí

```
DEC-ARCH-*    Architektura
DEC-DB-*      Databáze
DEC-API-*     API
DEC-FE-*      Frontend
DEC-AUTH-*    Autentizace, autorizace
DEC-PAY-*     Platby
DEC-PERF-*    Výkon
DEC-SEC-*     Bezpečnost
DEC-LEGAL-*   Licence, právní
DEC-OPS-*     Operations
DEC-BIZ-*     Business model
DEC-DEV-*     Developer experience
DEC-I18N-*    Internacionalizace
```

---

## DEC-ARCH-001: Single codebase vs separate products

**Status:** ✅ ACCEPTED
**Datum:** 2026-04-15

**Kontext:**
Při návrhu vícetierního SaaS (Free, Starter, Pro, Enterprise) máme dvě možnosti – jeden codebase s feature flags, nebo separate produkty.

**Alternativy:**
1. Jeden codebase + tier-based feature flags (Model B)
2. Dva produkty: SaaS (uzavřený) + Self-hosted (open source)
3. Tři produkty: open source core + cloud SaaS + enterprise on-prem

**Rozhodnutí:** Model B – jeden codebase, feature flags podle tieru

**Důvod:**
- Žádný duplicitní vývoj
- Žádný drift mezi verzemi
- Migrace mezi tiery je instant (toggle flag)
- Open core: 80% kódu Apache 2.0, premium features commercial
- Self-host = odebrat premium flagy a běžet free tier

**Důsledky:**
- Každá feature musí mít definovanou tier-availability
- Build process musí umět produkovat různé balíčky (community, enterprise)
- License management klíčem k premium features
- Může být složitější testovat všechny tier kombinace

**Související:**
- `DEC-LEGAL-001` (licence)
- `DEC-BIZ-001` (pricing)

---

## DEC-ARCH-002: Monorepo vs polyrepo

**Status:** ✅ ACCEPTED

**Kontext:**
Platform má apps (storefront, admin), services (catalog, order...), shared packages, plugins, themes. Jak organizovat repository?

**Alternativy:**
1. Monorepo (vše v jednom repo)
2. Polyrepo (každá služba má svůj repo)
3. Hybrid (monorepo per zone)

**Rozhodnutí:** Monorepo s Turborepo + pnpm workspaces

**Důvod:**
- Atomic commits napříč apps/services
- Snadnější refactoring sdílených interfaces
- Jeden CI pipeline
- Jediná verze dependencies (predictable)
- Turborepo má excellent caching

**Důsledky:**
- Repo bude velký (10+ apps, 14+ services)
- CI musí umět partial builds (jen co se změnilo)
- Permissions management v rámci repo (CODEOWNERS)
- Větší cognitive load pro nového developera

**Související:**
- `DEC-DEV-001` (developer experience)

---

## DEC-ARCH-003: Microservices vs modular monolith

**Status:** ✅ ACCEPTED

**Kontext:**
Architektura backend služeb – jak rozdělit?

**Alternativy:**
1. Modular monolith (jeden deployable, jasné moduly uvnitř)
2. Microservices od dne 1 (každá doména má svou službu)
3. Hybrid – core jako monolith, periferie jako services

**Rozhodnutí:** Modular monolith pro start, připravený k dekompozici

**Důvod:**
- Microservices od dne 1 = příliš operations complexity pro startup
- Modular monolith s jasnými hranicemi domén lze později rozdělit
- Domain-Driven Design hranice = kde lze udělat řez
- 1 deployable = 1 ops headache místo 14

**Důsledky:**
- Každý modul musí mít explicitní API (jako kdyby byl service)
- Komunikace mezi moduly přes events nebo facade interfaces
- Žádné cross-module DB joiny (každý modul vlastní svou data)
- Při scaling: konkrétní moduly extrahovat do služeb (catalog service, order service)

**Migration path k microservices:**
```
Phase 1 (MVP): Modular monolith, vše v 1 Fastify procesu (viz DEC-ARCH-005)
Phase 2 (10k merchants): Extract catalog, order, payment do separate services
Phase 3 (50k merchants): Full microservices
```

**Solo + AI reality check:**
Microservices od dne 1 = příliš ops complexity pro solo founder + AI kopilota.
Modular monolith je single deployable, single log stream, single Postgres connection
pool. Extrakce do services je možná, ale není povinná dokud nepřijde tým.

**Související:**
- `DEC-API-001`
- `DEC-DB-002`
- `DEC-ARCH-005` (backend framework)

---

## DEC-ARCH-005: Backend framework

**Status:** ✅ ACCEPTED
**Datum:** 2026-05-19
**Nahrazuje:** implicitní volbu NestJS v DEC-ARCH-003 (původní znění)

**Kontext:**
Volba HTTP framework pro Node.js backend. Original draft předpokládal NestJS (enterprise standard), ale solo + AI realita říká něco jiného.

**Alternativy:**
1. NestJS (decorators, DI container, Angular-style modules)
2. Fastify (lightweight, JSON Schema first, plugin system)
3. Express (de facto standard, ale starší, méně rychlý)
4. Hono (edge-first, ale méně zralé pro full backend)

**Rozhodnutí:** Fastify + tRPC + GraphQL Yoga (vrstvený stack)

**Detail:**
```
HTTP server:           Fastify (rychlý, JSON Schema, plugin ekosystém)
Internal/admin API:    tRPC (FE+BE TypeScript end-to-end)
Public REST API:       Fastify routes + OpenAPI 3.1 (zod-openapi)
Public GraphQL API:    GraphQL Yoga (zapojený jako Fastify plugin)
Validation:            Zod (sdílené FE+BE)
Background jobs:       BullMQ (Redis-based, viz DEC-EVENTS-001)
```

**Důvod (proč ne NestJS):**
- NestJS = moc magie (decorators, DI container) — pro solo + AI horší debugging
- Fastify je 2× rychlejší než NestJS pro REST endpointy
- JSON Schema validation built-in (žádný class-validator overhead)
- Plugin ekosystém je explicit (žádné "kde se to registruje"), AI lépe orientace
- tRPC dává type safety bez generated client overhead
- GraphQL Yoga je framework-agnostic, lze nasadit jako Fastify plugin

**Důvod (proč Fastify, ne Express):**
- Express je 5× pomalejší
- Express není maintained tak aktivně
- Fastify má built-in schema validation + serialization
- Industry trend: Astro, Remix, Hono — všichni utíkají od Express

**Důsledky:**
- Žádný `@nestjs/*` v dependencies
- Plugin systém pluginů platformy (viz `28-developer-platform.md`) bude Fastify-style hooks, ne NestJS modules
- Existující draft snippety v `01`–`38` které říkají "NestJS" musí být přečteny jako Fastify
- Solo developer se učí 1 framework (Fastify), ne celý NestJS svět

**Související:**
- `DEC-ARCH-003` (modular monolith)
- `DEC-API-001` (API protocol — tRPC + REST + GraphQL)
- `DEC-EVENTS-001` (queues)

---

## DEC-ARCH-004: Multi-tenancy model

**Status:** ✅ ACCEPTED

**Kontext:**
Platform podporuje tisíce merchantů. Jak izolovat data?

**Alternativy:**
1. Shared schema, tenant_id column (cheapest, single DB)
2. Schema per tenant (PostgreSQL schemas)
3. Database per tenant (most isolated, expensive)
4. Hybrid – Free/Starter/Pro shared, Enterprise dedicated

**Rozhodnutí:** Hybrid – shared schema for non-Enterprise, optional dedicated DB for Enterprise

**Důvod:**
- Shared schema s tenant_id + Row Level Security (RLS) na PostgreSQL
- Defense in depth: app-level + RLS-level + audit
- Enterprise může vyžadovat data isolation pro compliance
- Cost-effective pro 99% merchantů

**Důsledky:**
- KAŽDÁ tabulka (kromě platform-wide) má `tenant_id` column
- KAŽDÝ query MUSÍ mít tenant filter (enforced via Drizzle middleware)
- RLS policies pro defense in depth
- Migration mezi shared a dedicated musí být řešena (ETL process)

**Implementace:**
```sql
-- Příklad: products table
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  ...
);

CREATE INDEX idx_products_tenant ON products(tenant_id);

-- RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON products
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

**Související:**
- `DEC-DB-003`
- `DEC-SEC-001`

---

## DEC-DB-001: Primary database

**Status:** ✅ ACCEPTED

**Kontext:**
Volba primární databáze pro persistence.

**Alternativy:**
1. PostgreSQL
2. MySQL
3. MongoDB
4. CockroachDB

**Rozhodnutí:** PostgreSQL 17+

**Důvod:**
- Industry standard pro e-commerce
- ACID, JSON support, full-text search, geo, RLS
- Excellent ecosystem (Drizzle, Prisma, pg drivers)
- Self-hostable + managed options (RDS, Supabase, Neon)
- EU sovereignty: Hetzner managed PostgreSQL dostupný

**Důsledky:**
- Verze: minimum PostgreSQL 17 (vylepšený VACUUM, MERGE RETURNING, JSON_TABLE, logical replication slot sync)
- Extensions: pgvector (semantic search), pg_trgm (fuzzy), citext, pgcrypto
- Connection pooling: PgBouncer (min), pro Cloud fázi pgcat nebo Supabase Supavisor
- Logical replication pro pozdější multi-region read replicas (Fáze 3+)

---

## DEC-DB-002: ORM vs raw SQL

**Status:** ✅ ACCEPTED

**Kontext:**
Jak komunikovat s databází.

**Alternativy:**
1. Raw SQL (postgres-js, pg)
2. Prisma
3. Drizzle
4. TypeORM
5. Knex.js + custom

**Rozhodnutí:** Drizzle ORM

**Důvod:**
- TypeScript-first, excellent type inference
- Lightweight (no rust bindings, no separate process)
- SQL-like syntax (low learning curve)
- Performance: blízko raw SQL
- Excellent tooling (drizzle-kit migrations)
- Active development, dobré DX

**Proč ne Prisma:**
- Velký runtime, separate engine
- Slower in serverless cold starts
- Nepodporuje plně všechny PostgreSQL features

**Důsledky:**
- Schemas v TypeScript jako source of truth
- Migrations generovány z schema diff
- Raw SQL fallback pro performance critical operace

---

## DEC-DB-003: ID strategy

**Status:** ✅ ACCEPTED

**Kontext:**
Volba primary key formátu pro entity.

**Alternativy:**
1. Auto-increment integer (sequential)
2. UUID v4 (random)
3. UUID v7 (time-ordered)
4. CUID2
5. Snowflake (Twitter-style)
6. NanoID

**Rozhodnutí:** UUID v7 pro většinu, NanoID pro public-facing IDs

**Důvod UUID v7:**
- Time-ordered (lepší index performance než UUID v4)
- Globally unique (bez sekvenční DB závislosti)
- Snadná replikace, sharding
- PostgreSQL 16 nativní podpora

**Důvod NanoID pro public:**
- UUID je 36 znaků – ošklivé v URL
- NanoID je 21 znaků default, customizable
- Použití: order number, public product slug fallback

**Příklad použití:**
```
products.id        → UUID v7 (interní)
products.public_id → NanoID 12 chars (public API)
orders.id          → UUID v7
orders.number      → custom format "ORD-2026-00001234"
```

**Důsledky:**
- Migrace ze starých DB vyžaduje ID mapping
- Frontend nikdy neukazuje raw UUID (vždy public_id nebo number)

---

## DEC-DB-004: Cache strategy

**Status:** ✅ ACCEPTED

**Kontext:**
Caching strategie napříč platformou.

**Rozhodnutí:** Multi-layer caching

```
L1: Browser cache       (immutable assets, 1 year)
L2: CDN                 (HTML 5min, JSON 60s, images 30 days)
L3: Edge KV / Workers   (sessions, feature flags)
L4: Redis               (cart, session, recently viewed, rate limiting)
L5: PostgreSQL          (s materialized views pro reports)
L6: Search engine cache (Meilisearch built-in)
```

**Cache invalidation:**
- Tag-based invalidation (cache:product:123 invalidates all keys with tag)
- Event-driven (product.updated → invalidate caches)
- TTL fallback (vše má max TTL i bez explicit invalidation)

**Implementace:**
- Redis: ioredis client, BullMQ pro queues
- Cache helpers v `packages/shared-cache`

**Související:**
- `DEC-PERF-001`

---

## DEC-API-001: API protocol

**Status:** ✅ ACCEPTED

**Kontext:**
Jak vystavit API klientům (storefront, admin, mobile, plugins).

**Alternativy:**
1. REST only
2. GraphQL only
3. tRPC only (TypeScript end-to-end)
4. Hybrid: tRPC internal + REST + GraphQL external

**Rozhodnutí:** Hybrid

**Vrstvení (Fastify jako transport, viz DEC-ARCH-005):**
```
Fastify (HTTP server) — jediný proces, mountuje:
  ├─ tRPC router         → admin (oba TypeScript, end-to-end types)
  ├─ Fastify REST routes → public API + plugins + webhooks
  └─ GraphQL Yoga plugin → storefront headless + agent queries
```

**Použití:**
```
tRPC:
  - Admin ↔ API (oba TypeScript, sdílený package types)
  - Interní volání mezi packages monolithu (kde RPC styl je čistší)

REST (OpenAPI 3.1 auto-gen):
  - Public API pro plugins/integrations
  - 3rd party integrations
  - Webhook receivers (z platebních bran)
  - Mobile apps (REST je standardnější)
  - Webhook delivery (out)

GraphQL (Yoga):
  - Storefront (Next.js 16) — RSC fetchuje GraphQL pro batched queries
  - Headless customers (vlastní frontend)
  - Plugin marketplace search
  - Complex queries kde REST je bolestivý

MCP (`packages/api-mcp`):
  - AI agenti čtou katalog, stav objednávky (read-only v MVP, write ve v1.0)
  - První-class občan, ne plugin (viz DEC-AI-001)
```

**Důvody:**
- tRPC = developer experience, type safety, žádný codegen step
- REST = univerzální, pluginy, webhooks, standardizovaný OpenAPI ekosystém
- GraphQL = flexibilita pro headless, klient si bere co potřebuje
- MCP = agent-native diferenciátor (viz 33-ai-features.md)

**Důsledky:**
- Všechny protokoly sdílí stejnou doménovou logiku (zod schemas v `packages/core`)
- Versioning pro REST (date-based, viz DEC-API-002)
- GraphQL schema stitching v rámci monolithu (žádný Apollo Federation v MVP)
- Klient SDK auto-generated z OpenAPI (`@shopio/sdk-js`) a GraphQL schema (codegen)
- Žádný gRPC, žádný SOAP, žádný JSON-RPC mimo MCP

---

## DEC-API-002: API versioning

**Status:** ✅ ACCEPTED

**Kontext:**
Jak verzovat veřejné API.

**Alternativy:**
1. URL versioning (`/v1/products`)
2. Header versioning (`API-Version: 1`)
3. Date-based versioning (Stripe style: `2026-04-15`)

**Rozhodnutí:** Date-based versioning pro REST + URL versioning pro GraphQL

**Stripe-style:**
```
Header: Stripe-Version: 2026-04-15
Default: latest
Older versions supported: 2 years
Breaking changes: new version date
```

**Důvod:**
- Nejflexibilnější
- Klient explicitně volí version
- Žádné `v1` ←→ `v2` migrace problémy
- Industry best practice (Stripe, Twilio)

**Důsledky:**
- Backend musí podporovat více verzí současně
- Documentation per verze
- Deprecation policy: 12 měsíců warning, 24 měsíců sunset

---

## DEC-FE-001: Frontend framework

**Status:** ✅ ACCEPTED

**Rozhodnutí:** Next.js 16 (App Router) pro storefront, Vite + React 19 pro admin

**Důvod (storefront — Next.js 16):**
- Industry standard pro React production
- App Router = Server Components (SEO, Core Web Vitals)
- Streaming, Suspense, Partial Prerendering, Cache Components (`use cache`)
- Image optimization, font optimization built-in
- Self-hostable (`next start`) i serverless
- React Server Actions pro forms

**Důvod (admin — Vite + React 19):**
- Admin je behind-login SPA — žádný SEO benefit z RSC
- Vite je 3–5× rychlejší v dev HMR než Next.js
- TanStack Router (file-based, type-safe) > Next.js App Router pro SPA workflow
- Žádný server runtime pro admin = jednodušší self-host (single Node procces serves API + static admin bundle)
- Bundle size pod kontrolou (admin je dashboard, ne marketing)

**Důsledky:**
- Verze: Next.js 16+ (Cache Components stable), React 19+
- Storefront: Server Components default, Client Components opt-in
- Admin: pure CSR, shadcn/ui + TanStack Query + TanStack Router + TanStack Table
- Edge runtime kde to dává smysl (Storefront middleware pro A/B, geo redirect)
- Storefront a admin sdílí `packages/sdk-js` pro API volání

**Související:**
- `DEC-FE-002` (styling)
- `DEC-FE-003` (state management)

---

## DEC-FE-002: Styling strategy

**Status:** ✅ ACCEPTED

**Rozhodnutí:** Tailwind CSS v4 + shadcn/ui pro admin, custom for storefront themes

**Důvod:**
- Tailwind = rychlé, configurable, no naming bikeshedding
- shadcn/ui = own your components, no library lock-in
- v4 = significant performance improvements

**Storefront themes:**
- Tailwind base, ale **theme system** umožňuje override
- CSS variables pro theming
- Headless možnost (Storefront API → custom frontend)

---

## DEC-FE-003: State management

**Status:** ✅ ACCEPTED

**Rozhodnutí:** Zustand + TanStack Query

**Použití:**
```
Zustand:
  - Client UI state (cart drawer open?, modal stack)
  - Theme settings
  - User preferences (last selected currency, etc.)
  
TanStack Query:
  - Server state (products, orders, customers)
  - Cache, refetch, optimistic updates
  - Mutations
  
Žádný:
  - Redux (overkill pro většinu)
  - MobX (méně mainstream)
  - Recoil/Jotai (dobré, ale Zustand vyhrává simplicity)
```

---

## DEC-AUTH-001: Authentication strategy

**Status:** ✅ ACCEPTED

**Kontext:**
Jak autentizovat různé typy uživatelů (B2C customer, B2B employee, merchant staff, admin, developer, AI agent).

**Rozhodnutí:** OAuth 2.1 + OIDC, multi-strategy

**Strategie:**
```
Storefront (B2C/B2B customers):
  - Email + password
  - Magic link (passwordless)
  - Social: Google, Apple, Facebook
  - Passkeys (WebAuthn) – preferred
  
Admin (merchant staff):
  - Email + password + MFA mandatory
  - SSO (SAML, OIDC) for Enterprise
  - Passkeys preferred
  
Developer / API:
  - API keys (long-lived)
  - OAuth 2.1 (for plugins on behalf of merchant)
  - JWT (short-lived access tokens)
  
AI Agent:
  - Agent tokens (signed, scoped, time-bound)
  - DPoP (Demonstrating Proof of Possession)
  - Per-task spending limits
```

**Implementace:**
- Auth service postavený na Lucia v3 nebo Auth.js
- Sessions v Redis (short-lived JWTs + refresh tokens)
- Password hashing: Argon2id (winner of PHC)

**Související:**
- `DEC-SEC-001`
- `DEC-SEC-002`

---

## DEC-AUTH-002: RBAC vs ABAC

**Status:** ✅ ACCEPTED

**Rozhodnutí:** RBAC pro většinu, ABAC pro complex cases

**RBAC:**
- 14 personas (viz `36-personas-rbac.md`)
- Permissions: PERM-{RESOURCE}-{ACTION}
- Roles: collection of permissions

**ABAC (kde RBAC nestačí):**
- Customer service může refundovat do XYZ Kč BEZ schválení
- B2B Employee vidí jen své objednávky, ne kolegovy
- Plugin permissions per scope

**Implementace:**
- CASL (TypeScript) pro complex policies
- Postgres RLS pro defense in depth
- Auditní log každé permission check (sample 1% v prod)

---

## DEC-PAY-001: Payment provider strategy

**Status:** ✅ ACCEPTED

**Kontext:**
Které platební brány podporovat?

**Rozhodnutí:** Multi-provider, Stripe + GoPay + ComGate v MVP, další pak

**MVP (Phase 1):**
- Stripe (kartové platby, Apple/Google Pay, mezinárodní)
- GoPay (Czech market local methods)
- ComGate (Czech market alternative)
- Bank transfer (manual)
- Cash on Delivery (Czech essential)

**Phase 2:**
- Adyen (Enterprise, mezinárodní)
- PayU (Polsko, jihovýchodní Evropa)
- Klarna (BNPL)
- TWINT (Switzerland)

**Phase 3:**
- Mollie, Worldline
- Crypto (USDC, ETH via Coinbase Commerce)
- Local methods (BLIK PL, iDEAL NL, MB Way PT)

**Architektura:**
- Provider abstraction layer (Strategy pattern)
- Common interface: `PaymentProvider` (charge, refund, void, capture)
- Provider-specific code v separate package per provider
- Failover: pokud primary down, route to secondary

---

## DEC-PAY-002: PCI DSS scope

**Status:** ✅ ACCEPTED

**Rozhodnutí:** Minimize PCI scope – tokenization only

**Implementace:**
- Card data NIKDY na našich serverech
- Stripe Elements / iframes pro card input
- Tokenization → uložíme jen tokeny
- 3D Secure 2 mandatory pro EU karty

**Důsledky:**
- PCI DSS SAQ A (lowest tier) místo SAQ D (top tier)
- Žádný direct PAN handling
- Webhook validation: HMAC signature

**Compliance:**
- PCI DSS Level 1 certifikace pro platformu (jako merchant of record neplatí, jako tech provider ANO pro Enterprise)

---

## DEC-AI-001: Default AI provider

**Status:** ✅ ACCEPTED
**Datum:** 2026-05-19
**Nahrazuje:** 🔄 PROPOSED položku v roadmap

**Kontext:**
AI features (product descriptions, alt-text, support chatbot, anomaly detection, agent commerce) potřebují LLM provider. Volba ovlivňuje kvalitu výstupu, cenu, EU compliance, vendor lock-in.

**Alternativy:**
1. OpenAI only (GPT-4/5)
2. Anthropic only (Claude)
3. Multi-provider via abstrakční vrstvu
4. Self-hosted (Llama, Mistral, Qwen) přes Ollama / vLLM

**Rozhodnutí:** Anthropic Claude primary + OpenAI GPT fallback + BYO-key pro Enterprise

**Důvod (Anthropic primary):**
- Lepší kvalita strukturovaného výstupu (JSON tool use) pro commerce use-cases
- Lepší EU data residency komitmenty (no training on customer data by default)
- MCP protokol vyšel z Anthropic = first-party support pro `packages/api-mcp`
- 200K context = celý katalog malého merchanta v jednom prompt
- Cenově srovnatelné s OpenAI per token

**Důvod (OpenAI fallback):**
- Redundance pro outage scenarios
- Některé funkce (Realtime API, image gen) jsou v OpenAI zralejší
- Provider abstrakce zaručí, že přepnutí je config change, ne rewrite

**Důvod (BYO-key pro Enterprise):**
- Enterprise zákazníci mají vlastní AI vendor contracty (compliance, billing)
- BYO-key obchází per-token margin platformy → atraktivnější pricing pro large customer
- Žádná data jdou přes platform AI accounts → silnější GDPR/DPA argument

**Implementace:**
- `packages/core/src/ai/` — provider-agnostic interface (`AiProvider`)
- Default config: `ANTHROPIC_API_KEY` primary, `OPENAI_API_KEY` fallback
- Per-tenant override (Enterprise): tenant nastaví vlastní credentials přes admin UI
- Žádný hardcoded model name — vždy přes config (`AI_MODEL_PRIMARY`, `AI_MODEL_FALLBACK`)

**Důsledky:**
- Žádný direct import `openai` nebo `@anthropic-ai/sdk` mimo `packages/core/src/ai/`
- Self-hosted Ollama option v Fáze 3+ (Enterprise on-prem)
- AI Copilot komerční modul počítá s passthrough — žádný margin na tokens v platform fee

**Související:**
- `33-ai-features.md`
- `DEC-LEGAL-001` (commercial licensing pro AI Copilot)

---

## DEC-SEARCH-001: Default search engine

**Status:** ✅ ACCEPTED
**Datum:** 2026-05-19
**Nahrazuje:** 🔄 PROPOSED položku v roadmap

**Kontext:**
E-commerce platforma potřebuje full-text search nad produkty + facetované filtrování + autocomplete. Volba ovlivňuje DX, ops complexity, cost, search relevance.

**Alternativy:**
1. PostgreSQL full-text + pg_trgm only
2. Meilisearch (Rust, search-first)
3. Typesense (C++, search-first)
4. OpenSearch (Java, fork Elasticsearch)
5. Algolia (SaaS, paid)

**Rozhodnutí:** Meilisearch default, OpenSearch jako upgrade path v Fáze 3+

**Důvod (Meilisearch):**
- Single binary, ~80MB RAM idle → vejde se do small VPS spolu s Postgres+Redis
- Setup < 5 minut, zero-config pro 90% use-cases
- Typo tolerance built-in (důležité pro CZ "iphoone" → "iphone")
- Excellent CZ/SK/DE/PL analyzers (Unicode normalizace, diakritika)
- MIT licence, EU-friendly (francouzský původ)
- Saleor a Medusa potvrdily produkční nasaditelnost

**Důvod (proč ne Typesense):**
- Velmi blízká alternativa, ale Meilisearch má lepší community + nedávno Series A funding
- Jeden z dvou by nedával hodnotu — volíme Meilisearch a držíme

**Důvod (proč ne Algolia):**
- SaaS-only = porušuje self-host first princip
- Cena škáluje s počtem operations → záporné cash flow pro large catalogs
- Vendor lock-in (proprietary query DSL)
- US-based = GDPR friction

**Důvod (OpenSearch v Fáze 3+):**
- Když enterprise zákazník překročí 1M+ produktů nebo potřebuje vector search at scale
- OpenSearch lze nasadit on-prem (Apache 2.0)
- Provider abstrakce v `packages/core/src/search/` umožní hot-swap

**Implementace:**
- `packages/core/src/search/` — `SearchProvider` interface
- Default Meilisearch adapter
- Indexing přes BullMQ jobs (eventually consistent)
- Reindex na demand přes `shopio search reindex`

**Důsledky:**
- Docker Compose dev stack obsahuje Meilisearch service
- Žádný direct dependency na Algolia v core
- pgvector v PostgreSQL pro semantic search (zatím samostatně od Meilisearch)

**Související:**
- `08-search-filtering.md`
- `DEC-EVENTS-001` (indexing via queues)

---

## DEC-EVENTS-001: Event bus + background jobs

**Status:** ✅ ACCEPTED
**Datum:** 2026-05-19
**Nahrazuje:** 🔄 PROPOSED položku v roadmap; opravuje master index 4.2 (NATS)

**Kontext:**
Platforma potřebuje (a) background job queue (send email, sync invoice, reindex search, webhook delivery) a (b) doménový event bus (`OrderPlaced`, `ProductUpdated`) pro hooks/plugins/webhooks.

**Alternativy:**
1. NATS / NATS JetStream (lightweight broker)
2. Kafka / Redpanda (enterprise event streaming)
3. RabbitMQ (mature AMQP)
4. Redis Streams + BullMQ (Redis-only stack)
5. Postgres LISTEN/NOTIFY + outbox pattern

**Rozhodnutí:** BullMQ (background jobs) + in-process EventBus + Postgres LISTEN/NOTIFY (cross-instance fanout). Žádná Kafka, žádný NATS v MVP.

**Detail:**
```
Background jobs:           BullMQ (Redis sorted sets, retry, schedule, priority)
Doménový event bus:        in-process emitter (Node EventEmitter wrapper, type-safe)
Cross-instance event fanout: Postgres LISTEN/NOTIFY (1 channel per event type)
Outbox pattern:            transactional outbox table v Postgres (pro guaranteed-once)
Webhook delivery:           BullMQ job s exponential backoff
```

**Důvod (proč ne NATS):**
- Master index 4.2 původně psal NATS, ale solo + AI nepotřebuje extra broker
- Redis už máme (session, cache, rate limit) → další service = další SPOF
- BullMQ vyřeší 95% use-cases (jobs, schedule, priority, retries)

**Důvod (proč ne Kafka):**
- Operations complexity: zookeeper/KRaft, JVM, partitioning strategie
- Solo founder cluster Kafka = death wish
- Kafka má smysl při 100K+ events/sec — my máme 1–100/sec v MVP

**Důvod (in-process + LISTEN/NOTIFY):**
- Modular monolith (DEC-ARCH-003) = většina handlerů ve stejném procesu
- Pro multi-instance deployment (load-balanced HTTP nodes) potřebujeme fanout — Postgres LISTEN/NOTIFY je zdarma, transactional, hot-path už existuje
- Pro guaranteed-once delivery: outbox table + BullMQ poller (vyhne se 2-phase commit nightmare)

**Důsledky:**
- Redis je load-bearing service (session + cache + queues) → backup + HA strategie pro Cloud fázi
- Postgres LISTEN/NOTIFY má limity (~8KB payload, no replay) → události větší než to jdou přes outbox table + queue
- Migration path: pokud někdy potřebujeme Kafka, swap je za `packages/core/src/events/` interface, ne rewrite celé platformy
- Plugin authors píší listeners proti `EventBus` interface, ne přímo BullMQ/Redis

**Implementace:**
- `packages/core/src/queues/` — BullMQ wrapper, registry queue names, common configs
- `packages/core/src/events/` — type-safe EventBus (`EVENT-ORDER-PLACED` payload typed)
- `packages/core/src/outbox/` — transactional outbox pattern
- Per-event configurable: in-process only (low-latency) vs. cross-instance (LISTEN/NOTIFY)

**Související:**
- `DEC-ARCH-003` (modular monolith)
- `DEC-ARCH-005` (Fastify — žádný cross-process IPC)
- `28-developer-platform.md` (plugin hooks)

---

## DEC-PERF-001: Performance targets

**Status:** ✅ ACCEPTED

**Rozhodnutí:** Aggressive performance targets

**Core Web Vitals (75th percentile):**
```
LCP < 1.8s  (vs Google good: 2.5s)
FID < 50ms  (vs Google good: 100ms)
INP < 150ms (vs Google good: 200ms)
CLS < 0.05  (vs Google good: 0.1)
TTFB < 400ms (vs Google good: 800ms)
```

**API response (p95):**
```
GET /products (list): 200ms
GET /products/:id:    80ms
POST /cart/add:       250ms
POST /checkout:       500ms
GET /search:          150ms
```

**Throughput:**
- 10,000 concurrent users per node
- 100 orders/sec sustained
- 500 orders/sec burst (1 hour)

**Důsledky:**
- Performance budget v CI (fail build pokud regression)
- Lighthouse score >= 90 mandatory
- Real User Monitoring (RUM) v production
- Core Web Vitals tracking per merchant

---

## DEC-SEC-001: Security baseline

**Status:** ✅ ACCEPTED

**Rozhodnutí:** OWASP ASVS Level 2 minimum, Level 3 pro Enterprise

**Mandatory:**
- TLS 1.3 only
- CSP strict
- HSTS preload
- HTTPOnly + Secure + SameSite cookies
- Argon2id passwords
- Rate limiting per endpoint, per user, per IP
- Brute-force protection (account lockout)
- 2FA available (mandatory pro admin)
- Encryption at rest (AES-256-GCM)
- Audit logging (immutable)
- Penetration test annually
- Bug bounty program (HackerOne after 1 year)

**Compliance roadmap:**
```
Year 1: SOC 2 Type II
Year 1: GDPR DPA, sub-processors public
Year 2: ISO 27001
Year 2: PCI DSS Level 1
Year 3: HIPAA (pro pharmacy vertical)
```

---

## DEC-SEC-002: Secrets management

**Status:** ✅ ACCEPTED

**Rozhodnutí:** HashiCorp Vault (self-host) nebo cloud KMS

**Hierarchy:**
```
Production secrets:    Vault (self-hosted)
Cloud KMS option:      AWS KMS / Cloudflare for offload
Per-tenant keys:       Customer-managed keys (BYOK) for Enterprise
Database encryption:   pgcrypto + Vault transit
```

**Pravidla:**
- Žádný secret v gitu (pre-commit hook check)
- Žádný secret v env vars (kromě Vault token bootstrap)
- Rotation: 90 dní default, 30 dní pro citlivé
- Audit access: každý read/write logovaný

---

## DEC-LEGAL-001: Open source license

**Status:** ✅ ACCEPTED

**Rozhodnutí:** Apache 2.0 core, MIT SDKs, commercial pluginy

**Detail:**
```
Core platform:
  License: Apache 2.0
  Repo: github.com/our-org/platform-core
  
SDKs:
  License: MIT
  Repos: 
    github.com/our-org/sdk-js
    github.com/our-org/sdk-php
    github.com/our-org/sdk-python
    
Commercial features (premium):
  License: Custom commercial
  Distribution: Compiled, license server
  
Themes:
  Free themes: MIT
  Premium themes: Custom commercial
  
Plugins:
  Community: MIT recommended (their choice)
  Commercial: Their license
```

**Důvod Apache 2.0 vs MIT pro core:**
- Patent grant clause
- Better protection pro contributors
- Industry standard pro larger projects (Kubernetes, Apache Foundation)

**Důvod MIT pro SDKs:**
- Maximum permissivity pro plugin developery
- No friction adoption

**Související:**
- `DEC-ARCH-001` (single codebase)
- `DEC-BIZ-001` (pricing)

---

## DEC-BIZ-001: Pricing model

**Status:** ✅ ACCEPTED

**Rozhodnutí:** Capacity-based, NO transaction fees

**Tiers:**
```
Free:        €0/měsíc
  - 100 products
  - 50 orders/měsíc
  - 1 staff user
  - Komunitní support
  
Starter:     €29/měsíc
  - 1,000 products
  - Unlimited orders
  - 3 staff users
  - Email support
  
Pro:         €99/měsíc
  - 10,000 products
  - Unlimited orders
  - 10 staff users
  - Priority support
  - Advanced analytics
  
Enterprise:  €299/měsíc + custom
  - Unlimited
  - Dedicated support
  - SLA 99.99%
  - SSO, dedicated DB optional
  - Custom contracts
```

**ZÁKAZY (red lines):**
```
❌ NIKDY transaction fees
❌ NIKDY % from GMV
❌ NIKDY hidden fees
❌ NIKDY paid features ≤ Starter tier
❌ NIKDY vendor lock-in via data hostage
```

**Důvod:**
- Differentiátor proti Shopify (2-2.9% transaction fee)
- Trust signal (jasné ceny, jasné očekávání)
- Merchanti rostou bez penalty

---

## DEC-BIZ-002: Plugin marketplace revenue share

**Status:** ✅ ACCEPTED

**Rozhodnutí:** Tiered, vstřícné k developerům

**Tiers:**
```
0% rev share na první $1M plugin revenue
10% rev share od $1M do $5M
8% rev share od $5M do $10M
5% rev share nad $10M
```

**Srovnání:**
- Shopify App Store: 0% do $1M, pak 15%
- BigCommerce: 0% do $50k, pak 15%
- WooCommerce: 0% (ale extra ekosystém)
- Apple App Store: 30% (15% small)

**Důvod:**
- Atraktivnější než Shopify pro developery
- Network effects: čím víc pluginů, tím lepší platform value
- Sustainable: ne každý plugin udělá $1M, ale top 10% táhne ekosystém

---

## DEC-OPS-001: Hosting strategy

**Status:** ✅ ACCEPTED

**Rozhodnutí:** Multi-cloud capable, EU-first

**Primary:**
- Hetzner (EU sovereignty, cost-effective)
- AWS Frankfurt/Stockholm (managed services kde potřeba)

**Self-host option:**
- Docker compose pro single-node
- Kubernetes (k3s) pro HA
- Helm charts published

**CDN:**
- Cloudflare (Free tier excellent, paid for production)

**Backup:**
- Cross-region replication (Hetzner DE → FI)
- Cold storage S3 Glacier

**Compliance:**
- Data residency: EU only by default
- US transfers: SCCs + TIA + opt-in
- Schrems II compliant

---

## DEC-OPS-002: Deployment strategy

**Status:** ✅ ACCEPTED

**Rozhodnutí:** GitOps with ArgoCD, blue-green deployments

**Flow:**
```
1. Developer pushes to PR
2. CI runs: tests, lint, security scan, build
3. Merge to main → CD triggered
4. ArgoCD detects change → deploys to staging
5. Smoke tests in staging
6. Manual approval → deploy to production (blue-green)
7. Health checks → switch traffic
8. Monitor → rollback if issues
```

**Frequency:**
- Multiple deploys per day for non-breaking changes
- Coordinated weekly for breaking changes
- Hotfix anytime (with abbreviated process)

---

## DEC-DEV-001: Developer experience priority

**Status:** ✅ ACCEPTED

**Rozhodnutí:** DX is a feature, treated as such

**Targets:**
- New developer to first contribution: < 1 day
- Local dev environment setup: < 30 minutes
- Hot reload latency: < 1 second
- Test suite (unit): < 30 seconds full
- E2E suite: < 10 minutes critical path
- Build time: < 5 minutes incremental
- Plugin developer: scaffold to deployed plugin: < 1 hour

**Tools:**
- Docker Compose for local stack
- Devcontainers (VS Code)
- Storybook for components
- TypeDoc for API docs
- Insomnia/Bruno collections committed
- Comprehensive seed data
- Reset DB script

---

## DEC-I18N-001: Internationalization approach

**Status:** ✅ ACCEPTED

**Rozhodnutí:** True i18n, ne jen translation

**Rozsah:**
```
UI: Multi-language
Content: Multi-language (products, categories, blog)
Currency: Multi-currency display + transaction
Date/Time: Locale-aware
Numbers: Locale-aware (decimal separator, thousand separator)
Plurals: ICU MessageFormat (čeština, polština, ruština complex)
RTL: Support arabštinu, hebrejštinu (Phase 3)
CJK: Support vertical text, fonts (Phase 4)
Address: Per-country format
Phone: libphonenumber, E.164 storage
Tax: Per-country VAT, sales tax US
```

**Tools:**
- next-intl pro i18n routing
- ICU MessageFormat pro plurals/gender
- Locize / Crowdin pro translation management
- Self-host translation memory (TM)

---

## DEC-DEV-002: Testing strategy

**Status:** ✅ ACCEPTED

**Rozhodnutí:** Test pyramid, automated everywhere

```
Unit tests (Vitest):
  - 80% coverage minimum overall
  - 95% coverage pro business logic (pricing, tax, checkout)
  
Integration tests:
  - DB tests s testcontainers
  - Service-to-service contracts (Pact)
  
E2E tests (Playwright):
  - Critical user journeys (40+ scenarios)
  - Run na staging před každým prod deploy
  - Run nightly v production-like
  
Performance tests (k6):
  - Load: simulate 10k concurrent users
  - Stress: find breaking point
  - Spike: sudden traffic surge
  
Security tests:
  - SAST (SonarQube, Semgrep) per PR
  - DAST (OWASP ZAP) weekly
  - Dependency scan (Snyk, Dependabot)
  
Accessibility:
  - axe-core in CI
  - Manual screen reader monthly
  - WCAG 2.1 AA mandatory, AAA preferred
```

---

## 📋 Decisions roadmap (ještě nerozhodnuté)

```
✅ DEC-AI-001:     RESOLVED 2026-05-19 → Anthropic primary + OpenAI fallback + BYO-key
✅ DEC-SEARCH-001: RESOLVED 2026-05-19 → Meilisearch default, OpenSearch upgrade path
✅ DEC-EVENTS-001: RESOLVED 2026-05-19 → BullMQ + Postgres LISTEN/NOTIFY, no Kafka
🔄 DEC-MOBILE-001:      Native apps timeline (Fáze 4 / rok 7+, viz todo.md)
🔄 DEC-MARKETPLACE-001: Marketplace launch tier (Pro vs Enterprise?)
🔄 DEC-PRICING-001:     Konkrétní cenové tiery (TBD po pilotní fázi, viz todo.md Q10)
🔄 DEC-COMPLIANCE-001:  SOC 2 / ISO 27001 timeline (solo-friendly: Fáze 4, ne Year 1)
```

**Otevřené strategické rozpory s todo.md (nevyřešené):**
- `DEC-BIZ-001` má konkrétní tiery (€29/€99/€299) — todo.md říká TBD. **Řeš až po datech z pilotní fáze.**
- `DEC-BIZ-002` má 0% / 10% / 8% / 5% rev share — todo.md říká 80/20 první 3 roky. **Sjednoť před plugin marketplace launch (Fáze 2).**
- `DEC-SEC-001` slibuje SOC 2 Type II Year 1 + ISO 27001 Year 2 — todo.md říká až Fáze 4 (po týmu). **Solo + AI realita říká todo.md; DEC-SEC-001 přeplánovat až s týmem.**
- `DEC-AUTH-001` zmiňuje Lucia v3 nebo Auth.js — todo.md říká "Lucia Auth nebo vlastní JWT + session". **Rozhodni se PoC v Fázi 0.9.**

---

## 📅 Změny

| Datum | DEC ID | Typ | Poznámka |
|-------|--------|-----|----------|
| 2026-04-15 | DEC-ARCH-001 | ACCEPTED | Initial |
| 2026-04-20 | DEC-ARCH-002 | ACCEPTED | Initial |
| 2026-05-03 | All | Documented | First registry version |
| 2026-05-19 | DEC-ARCH-003 | UPDATED | Migration path: NestJS → Fastify (viz DEC-ARCH-005) |
| 2026-05-19 | DEC-ARCH-005 | ACCEPTED | NEW: Backend framework = Fastify + tRPC + GraphQL Yoga |
| 2026-05-19 | DEC-DB-001  | UPDATED | PostgreSQL 16+ → 17+ |
| 2026-05-19 | DEC-API-001 | UPDATED | Vrstvení (Fastify transport, MCP jako 4. protokol) |
| 2026-05-19 | DEC-FE-001  | UPDATED | Next.js 15 → Next.js 16; admin = Vite + React 19 SPA |
| 2026-05-19 | DEC-AI-001  | ACCEPTED | NEW: Anthropic primary + OpenAI fallback + BYO-key |
| 2026-05-19 | DEC-SEARCH-001 | ACCEPTED | NEW: Meilisearch default, OpenSearch upgrade |
| 2026-05-19 | DEC-EVENTS-001 | ACCEPTED | NEW: BullMQ + LISTEN/NOTIFY, no NATS/Kafka |

---

## ⚠️ Pravidla pro úpravy

```
1. Žádné rozhodnutí se NEMĚNÍ bez explicitního schválení
2. Změna rozhodnutí = nový DEC ID, staré označeno DEPRECATED
3. Cross-reference: pokud DEC X mění DEC Y, oba musí být update
4. Notifikace: změna v DEC = email všem stakeholders
5. Audit: měsíčně review otevřených (PROPOSED) decisions
```

---

**Konec Decisions Registry.**

➡️ Pokračovat na: [`02-glossary.md`](02-glossary.md)
