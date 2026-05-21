# Shopio — plán vývoje

> Jediný zdroj pravdy pro stavbu e-commerce platformy. Solo founder (ty) + Claude jako AI kopilot. Bez deadline, bez externího financování, bez týmu. Cíl: postavit nejlepší open-source e-commerce platformu v EU — v horizontu 7–10+ let, incrementálně, s každou fází použitelnou samostatně.

---

## 1. Přehled projektu

**Shopio** (pracovní název, finalize později) je e-commerce platforma stavěná jako **single codebase s otevřeným jádrem**. Primární distribuce: **Community Edition** (zdarma, self-host, Apache 2.0). Později, až se objeví tým nebo investor, lze aktivovat **Cloud SaaS** a **Enterprise** tier ze stejné kódové základny bez rewritu — architektura je od dne 1 připravená na multi-tenancy, feature flagy, plugin systém, moduly.

**Ambice (dlouhodobá):** Postavit platformu, která má kurátorsku UX Shopify, lokalizaci Shoptet/Upgates, modularitu Shopware/Saleor a provozní vyspělost Magento — a přidat čtyři diferenciátory: (1) **agent-native commerce** (MCP, A2A, structured product feeds) jako first-class občan, (2) **EU-first compliance** (GDPR, DSA, EU AI Act, CSRD, DPP), (3) **hluboká lokalizace per země**, (4) **0 % transaction fee** napořád.

**Realita solo + Claude:** postavit **kód** jde pro všechno. **Provozovat** SaaS 24/7, dělat SOC 2/ISO audit, enterprise sales cycle, nebo mít komunitu v 10 jazycích — nejde solo. Proto tyhle části plánu odsouváme do fáze "až přijde tým/partner/investor", ale **kód a architektura pro ně jsou připravené od MVP**.

**Očekávaný časový horizont (full-time, solo + AI):**
- **MVP (CZ/SK self-host):** 12–18 měsíců
- **v1.0 (+ DE, B2B, MSI, agent-native, plugin marketplace):** 3–4 roky
- **v2.0+ (CEE, Cloud SaaS aktivace, mobile):** 5–7 let
- **v3.0+ (CRDT, live/AR/voice, US/Asie, enterprise sales):** 7–10+ let

---

## 2. Technologický stack

Vedoucí princip: **proven nad trendy**. Solo maintainer = nesmím si dovolit chytit nestabilní knihovnu, která za 18 měsíců umře. Žádný framework mladší 2 let v kritické cestě.

| Vrstva | Volba | Proč |
|---|---|---|
| Jazyk backendu | **TypeScript (Node.js 22 LTS)** | Jeden jazyk FE+BE, zralý ekosystém, solo-friendly, Medusa/Saleor dokazují produkci |
| Runtime | **Node.js**, Bun jen pro CLI/scripty | Node 10 let operational track record |
| Framework BE | **Fastify + tRPC + GraphQL Yoga** | Fastify rychlé, tRPC pro admin, GraphQL Yoga pro storefront/public |
| API | **REST (OpenAPI 3.1) + GraphQL** obojí | REST canonical, GraphQL convenience nad stejnou doménou |
| Databáze | **PostgreSQL 17** | Standard, JSONB pro flexibilní atributy, pgvector pro AI, logical replication pro pozdější multi-region |
| ORM | **Drizzle** | Typed SQL bez magie, rychlejší než Prisma na commerce queries |
| Cache / session | **Redis 7** | Rate-limit + BullMQ queue + session store |
| Fronty | **BullMQ** | Redis-based, jednodušší než Kafka. Kafka později jen pokud opravdu potřeba event streaming |
| Search | **Meilisearch** | Jednoduchý, zdarma, rychlý setup. OpenSearch pozdní fáze |
| Payments | **Stripe** (global), **GoPay/ComGate/ThePay** (CZ), **Adyen** (enterprise), **Klarna/iDEAL/BLIK/Bizum** (per země) | Pluggable interface, žádná exkluzivita |
| File storage | **S3-compatible** (MinIO pro self-host, AWS S3 / Cloudflare R2 pro Cloud) | Standard, MinIO drop-in |
| Media | **imgproxy** (self-host), **Cloudflare** (Cloud) | On-the-fly transformace |
| Auth | **Lucia Auth** nebo vlastní JWT + session | Lehčí než Keycloak; Keycloak jen jako volitelný SSO provider v v1.0 |
| Frontend admin | **React 19 + Shadcn/ui + TanStack Query/Router + Vite** | Copy-paste komponenty (ne lock-in), nativní ownership |
| Storefront (default) | **Next.js 16 (App Router, RSC)** | Proven, self-hostovatelné, SEO + Core Web Vitals |
| Mobile (v3) | **React Native (Expo)** | Jeden codebase iOS+Android, sdílení s webem |
| Monorepo | **Turborepo + pnpm workspaces** | Rychlejší než Nx pro JS-only repo |
| Containerization | **Docker + Docker Compose** (OSS), **Kubernetes + Helm** (Cloud později) | Compose pro self-host, k8s pro škálu |
| IaC | **Terraform** (Cloud fáze), **Ansible** (self-host hardening) | |
| Observability | **OpenTelemetry → Grafana/Loki/Tempo/Mimir** | Open standard, self-hostovatelné |
| CI/CD | **GitHub Actions** | Standard, free pro public repo |
| Testing | **Vitest + Playwright + k6** | |
| Email | **React Email + Resend** (Cloud), **SMTP/SES** (self-host) | |

**Odmítnuto:** Prisma (výkon na složitých queries), NestJS (moc magie), Deno (nezralý commerce ekosystém), Elixir/Phoenix (malý hiring pool), Go (druhý jazyk bez jasného benefitu solo), microservices od dne 1.

---

## 3. Architektura

### 3.1. Model B — Open Core, monorepo, ready-for-everything

**Rozhodnutí:** Model B (single codebase, 3 distribuce long-term) podle `jeden-nebo-dva-systemy.md`. V MVP shipujeme jen CE. Enterprise a Cloud balíčky existují v repozitáři (pro budoucí tým), ale obsahují jen stub/scaffold.

### 3.2. Struktura repozitáře

```
shopio/
├── packages/
│   ├── core/                    # Apache 2.0 — business logika, entity, plugin API
│   ├── db/                      # Drizzle schema + migrace (Apache 2.0)
│   ├── api-rest/                # REST handlers + OpenAPI spec (Apache 2.0)
│   ├── api-graphql/             # GraphQL schema + resolvers (Apache 2.0)
│   ├── api-mcp/                 # MCP server pro AI agenty (Apache 2.0) — DIFERENCIÁTOR
│   ├── admin/                   # Admin React app (Apache 2.0)
│   ├── storefront-next/         # Default Next.js storefront (MIT)
│   ├── sdk-js/                  # Klient SDK JS/TS (MIT)
│   ├── cli/                     # shopio CLI (Apache 2.0)
│   ├── plugin-kit/              # SDK pro plugin developery (Apache 2.0)
│   ├── enterprise/              # BUDOUCÍ — stub v MVP, obsah ve v1.0+
│   │   ├── b2b/
│   │   ├── msi/
│   │   ├── ai-copilot/
│   │   ├── sso-saml/
│   │   └── audit-log/
│   └── cloud/                   # BUDOUCÍ — stub v MVP, obsah ve v2.0+
│       ├── tenant-manager/
│       ├── billing/
│       └── control-plane/
├── distributions/
│   ├── community-edition/       # docker-compose.yml + install skripty — MVP
│   ├── enterprise/              # Helm chart + license gate — v1.0+
│   └── cloud/                   # interní — v2.0+
├── apps/
│   ├── docs/                    # Docusaurus nebo Nextra (MIT)
│   └── marketing-site/          # shopio.com (MIT)
├── tools/
│   ├── scripts/
│   └── license-checker/         # Build-time guard: CE nesmí importovat z enterprise/cloud
├── turbo.json
├── pnpm-workspace.yaml
└── LICENSE                      # Apache 2.0 root
```

### 3.3. Modulární monolit, microservices nikdy nebudou potřeba pro lifestyle

MVP a v1.0 = **jeden Node.js proces**, interně rozdělený přes packages. Microservices zvažovat až s týmem 10+ inženýrů. Interface-layer (EventBus, ServiceRegistry) od dne 1, aby extrakce byla možná, ale **nevynucujeme**.

### 3.4. Extensibility od dne 1

- **Plugin systém:** hooks & filters (WooCommerce-style) + event observers (Magento-style) + workflow hooks (Medusa v2-style s compensation).
- **Feature flags:** `FEATURES.B2B`, `FEATURES.MULTI_TENANT` atd. — rozhodují build-time i runtime. V MVP vše `false` mimo `CORE`.
- **License enforcement:** build skript v `tools/license-checker` zakáže CE build importovat z `packages/enterprise/*` nebo `packages/cloud/*`.
- **Flexibilní atributy:** každá entita má `metadata JSONB` pole + plugin registrace custom polí (ne EAV tabulky).

### 3.5. Multi-tenancy — připraveno, neaktivní

Každá tabulka má `tenant_id uuid NOT NULL` od MVP. V single-tenant self-host instalaci je `tenant_id = DEFAULT_TENANT`. Postgres RLS policies jsou napsané, ale v CE vypnuté (flag). Když jednou aktivujeme Cloud, stačí zapnout RLS + tenant router — žádný rewrite schema.

### 3.6. Agent-native od dne 1 (klíčový diferenciátor)

- **MCP server** (`packages/api-mcp`) — Anthropic Model Context Protocol, aby AI agenti mohli číst katalog a stav objednávek od MVP.
- **Structured Product Feeds** (JSON-LD, Schema.org Product/Offer/AggregateRating) — pro GPT/Gemini/Perplexity crawling od MVP.
- **A2A (Agent-to-Agent) protokol** — v2.0, pro B2B agent commerce.
- **ACO/AEO** — v1.0, answer engine optimization v admin UI.

---

## 4. Fáze vývoje

Časy jsou pesimistické odhady pro **solo dev + Claude, full-time**. Nebude-li full-time, roztáhnout adekvátně.

---

### Fáze 0 — Příprava (Měsíc 1–2)

**Cíl:** Hotová infrastruktura. Na konci Fáze 0 existuje privátní repo, CI, docker-compose dev stack, auth, základní DB schema, skeleton adminu + storefrontu, v0.0.1 internal alpha tag.

**Celkový odhad:** ~80 hodin = 2–3 týdny full-time.

---

#### 0.1. GitHub org + privátní repo [S, 2h]

- [ ] Založit GitHub org (pracovně `shopio` nebo alternativa, finální name TBD)
- [ ] Privátní repo s `main` branch
- [ ] Branch protection: require PR (solo můžeš self-approve), require CI green, no force push
- [ ] CODEOWNERS (ty)
- [ ] Public switch až před launchem MVP

**Acceptance:** repo existuje, clone funguje, PR flow testnut na dummy commitu.
**Dependencies:** žádné.

---

#### 0.2. Monorepo scaffold [M, 8h]

- [ ] Turborepo + pnpm workspaces
- [ ] Struktura packages (prázdné stuby s package.json + src/index.ts): `core`, `db`, `api-rest`, `api-graphql`, `api-mcp`, `admin`, `storefront-next`, `sdk-js`, `cli`, `plugin-kit`, `enterprise` (stub), `cloud` (stub)
- [ ] Struktura apps: `docs`, `marketing-site` (lze odložit)
- [ ] Distributions: `community-edition/`
- [ ] Tools: `license-checker/`
- [ ] `tsconfig.base.json` strict mode, per-package `tsconfig.json` extends base
- [ ] Biome (lint + format, rychlejší než ESLint + Prettier)
- [ ] Vitest pro unit/integration
- [ ] Playwright pro E2E
- [ ] Changesets pro versioning + release notes
- [ ] Root `package.json` s scripts: `dev`, `build`, `test`, `lint`, `typecheck`

**Acceptance:** `pnpm install && pnpm build && pnpm test && pnpm lint` projde. Každý package má smysluplný package.json.
**Dependencies:** 0.1.

---

#### 0.3. License + právní texty [S, 3h]

- [ ] `LICENSE` Apache 2.0 v rootu
- [ ] Per-package `LICENSE` pokud se liší (MIT pro storefront-next a sdk-js)
- [ ] `CONTRIBUTING.md` (DCO sign-off, code style, PR proces)
- [ ] `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1)
- [ ] `SECURITY.md` (email pro disclosure, SLA response 72h)
- [ ] `NOTICE` (attribution Apache deps)

**Acceptance:** soubory v rootu, odkazované v README.
**Dependencies:** 0.1.

---

#### 0.4. CLA setup [S, 2h]

- [ ] CLA Assistant (GitHub App) — lehčí než EasyCLA pro malý projekt
- [ ] Individual CLA text (kopie Apache ICLA)
- [ ] Corporate CLA template (pro budoucí firemní contributors)

**Acceptance:** testovací PR automaticky triggeruje CLA check.
**Dependencies:** 0.3.

---

#### 0.5. CI/CD pipeline [M, 6h]

- [ ] `.github/workflows/ci.yml` — on PR + push main: lint → typecheck → unit tests → build
- [ ] `.github/workflows/e2e.yml` — on PR: integration + Playwright proti docker services
- [ ] `.github/workflows/release.yml` — on tag: changesets publish → docker images → GitHub release
- [ ] `.github/workflows/security.yml` — weekly: CodeQL, Snyk
- [ ] Dependabot config
- [ ] Turborepo remote cache (GitHub cache pro start, později vlastní)
- [ ] Status badges v README

**Acceptance:** PR triggeruje full CI zeleně; tag `v0.0.1` vydá Docker image.
**Dependencies:** 0.2.

---

#### 0.6. Docker Compose dev stack [M, 5h]

- [ ] `distributions/community-edition/docker-compose.yml`
- [ ] Services: postgres:17 (s init SQL pro `shopio_dev`), redis:7, meilisearch, minio (auto-create bucket), mailhog
- [ ] Healthchecks pro každý service
- [ ] `.env.example` s všemi vars a komentáři
- [ ] Root scripts: `pnpm dev:up`, `pnpm dev:down`, `pnpm dev:logs`, `pnpm dev:reset`

**Acceptance:** fresh clone → `pnpm dev:up` → všechny services healthy do 30s.
**Dependencies:** 0.2.

---

#### 0.7. Drizzle DB schema základ [M, 8h]

- [ ] `packages/db/src/schema/`:
  - `tenants.ts` (id, name, slug, timestamps)
  - `users.ts` (id, tenant_id, email, password_hash, role, is_2fa_enabled, …)
  - `sessions.ts`
  - `audit_log.ts` (minimální)
- [ ] Každá tabulka má `tenant_id` od dne 1 (i když single-tenant v CE)
- [ ] RLS policies napsané, aktivace přes flag `ENABLE_RLS=false` v CE
- [ ] Migration CLI integrovaná do `shopio` CLI (`shopio db migrate|seed|reset|status`)
- [ ] Seed data: `DEFAULT_TENANT` + admin user (email `admin@localhost`, password `admin` v dev seedu)

**Acceptance:** `pnpm db:migrate && pnpm db:seed` projde bez chyb; manuální SQL dotaz potvrdí tenant + admin.
**Dependencies:** 0.6.

---

#### 0.8. Config + Logger + Error handling [S, 4h]

- [ ] `packages/core/src/config/` — env var schema (zod) + validace při startu, fail-fast s čitelnou chybou
- [ ] `packages/core/src/logger/` — pino wrapper, JSON output, levels, request ID correlation
- [ ] `packages/core/src/errors/` — hierarchie (DomainError, ValidationError, NotFoundError, ConflictError, UnauthorizedError, …)

**Acceptance:** invalid env → fail fast; logy v JSON; chyby serializované konzistentně.
**Dependencies:** 0.2.

---

#### 0.9. Auth scaffold [M, 8h]

- [ ] Volba: Lucia Auth vs vlastní (rozhodni po PoC — Lucia pokud session management postačuje, vlastní pokud potřebujeme víc kontroly)
- [ ] Session-based (cookie, HttpOnly, Secure, SameSite=Lax) pro admin
- [ ] JWT pro API clients (access + refresh token)
- [ ] Argon2id password hashing
- [ ] 2FA TOTP (schema připravené, UI aktivuje v MVP)
- [ ] Rate limit na auth endpoints (Redis token bucket)

**Acceptance:** login → session v Redis → logout invalidates; žádný plaintext password v DB nebo logu.
**Dependencies:** 0.7, 0.8.

---

#### 0.10. API scaffold [M, 6h]

- [ ] `packages/api-rest/` — Fastify app
  - `GET /health` (liveness), `GET /ready` (readiness: db + redis ping)
  - OpenAPI 3.1 auto-gen, Swagger UI na `/docs`
- [ ] `packages/api-graphql/` — GraphQL Yoga
  - `{ hello }` query jako proof
  - Schema stitching připravené pro future packages
- [ ] Common middlewares: request ID, logger correlation, error handler, auth, rate limit, CORS

**Acceptance:** `GET /health` → 200; OpenAPI dostupný; GraphQL playground funguje.
**Dependencies:** 0.8, 0.9.

---

#### 0.11. Admin scaffold [M, 6h]

- [ ] `packages/admin/` — Vite + React 19 + Shadcn/ui + TanStack Router + TanStack Query
- [ ] Základní layout (sidebar, topbar, content)
- [ ] Login page → API auth
- [ ] Protected route wrapper
- [ ] Dashboard stub ("Hello, {user.email}")
- [ ] Logout flow
- [ ] Dark mode toggle (Shadcn default)

**Acceptance:** login přes formulář → redirect na dashboard → logout funguje.
**Dependencies:** 0.10.

---

#### 0.12. Storefront scaffold [M, 5h]

- [ ] `packages/storefront-next/` — Next.js 16 App Router, RSC
- [ ] Layout, homepage stub, product list stub, product detail stub
- [ ] API client (fetch wrapper nebo tRPC client generated from backend)
- [ ] Tailwind + CSS variables pro theming
- [ ] i18n routing (CZ default, EN, SK, DE jako placeholder)

**Acceptance:** `pnpm dev` → `localhost:3000` zobrazí homepage, fetch z API vrátí prázdný seznam produktů.
**Dependencies:** 0.10.

---

#### 0.13. License checker + feature flags [S, 4h]

- [ ] `tools/license-checker/` — skript, který selže CE build při importu z `packages/enterprise/*` nebo `packages/cloud/*`
- [ ] Integrace do CI jako `lint-licenses` step
- [ ] `packages/core/src/features/` — feature flag registry (typované klíče, build-time + runtime)
- [ ] Test: úmyslný "bad import" → CE build selže; `FEATURES.B2B=true` lze zapnout

**Acceptance:** CE build selže na bad import; feature flag lze přečíst v runtime.
**Dependencies:** 0.2, 0.5.

---

#### 0.14. Dokumentace scaffold [S, 4h]

- [ ] `apps/docs/` — Docusaurus nebo Nextra
- [ ] Stránky: Getting Started, Architecture, Contributing, API Reference (placeholder)
- [ ] `README.md` v root — hero, quick install (5 řádků), feature highlights, linky na docs
- [ ] `llms.txt` (guidelines pro LLM crawlery, emerging standard)

**Acceptance:** `pnpm docs:dev` → local docs běží; README má všechny hlavní sekce.
**Dependencies:** 0.3.

---

#### 0.15. Issue/PR templates + project board [S, 2h]

- [ ] `.github/ISSUE_TEMPLATE/bug.yml`, `feature.yml`, `question.yml`
- [ ] `.github/PULL_REQUEST_TEMPLATE.md` (checklist)
- [ ] GitHub Project (kanban): Todo / In Progress / Review / Done
- [ ] Labels: `good-first-issue`, `help-wanted`, `priority:{low,med,high}`, `area:{catalog,checkout,admin,…}`, `type:{bug,feature,docs,refactor}`

**Acceptance:** první dummy issue jde vytvořit přes template.
**Dependencies:** 0.1.

---

#### 0.16. Telemetry stack (opt-in) [S, 4h]

- [ ] OpenTelemetry SDK v `core` + `api-rest` (tracing)
- [ ] Prometheus metrics endpoint (`/metrics`)
- [ ] `TELEMETRY_ENABLED=false` default v CE (opt-in)
- [ ] Dokument `docs/telemetry.md` — co posíláme, jak vypnout, privacy policy
- [ ] Volitelné rozšíření docker-compose o Jaeger/Grafana pro local debugging

**Acceptance:** traces viditelné v local Jaeger když aktivováno.
**Dependencies:** 0.8.

---

#### 0.17. v0.0.1 internal alpha release [S, 3h]

- [ ] Tag `v0.0.1`
- [ ] Release notes přes changesets
- [ ] Docker image publikovaný (privátně na `ghcr.io`)
- [ ] Smoke test: fresh VPS / čistý stroj → `curl | bash` install → login → dashboard → logout
- [ ] Dokumentovaný install postup v README

**Acceptance:** install postup funguje na čistém Linux stroji za ≤10 minut.
**Dependencies:** všechny 0.1–0.16.

---

#### Doporučené pořadí (full-time)

| Týden | Tasky |
|---|---|
| **Týden 1** | 0.1 → 0.2 → 0.3 → 0.15 |
| **Týden 2** | 0.5 → 0.6 → 0.4 |
| **Týden 3** | 0.7 → 0.8 → 0.9 |
| **Týden 4** | 0.10 → 0.11 → 0.12 |
| **Týden 5** | 0.13 → 0.14 → 0.16 → 0.17 |

**První task (Den 1):** **0.1** — GitHub org + repo. Jednorázová formalita, která odblokuje všechno ostatní. Nezávislá.

**Blokery pro Fázi 1:** žádné po 0.17. Fáze 1 začíná katalog servicem jako první doménou (nejširší závislost, brzký feedback na architekturu).

---

### Fáze 1 — MVP Community Edition (Měsíc 3–18)

**Cíl:** Použitelný single-tenant self-host e-shop v CZ/SK. Publikovaný jako OSS na GitHub. REST + GraphQL API, admin UI, default Next.js storefront, CZ/SK platby/dopravci/faktury, plugin systém, MCP server, Docker Compose install "curl | bash" za 1 minutu.

#### 4.1.1. Datový model a DB [XL]

- [ ] **[M]** Drizzle schema: `tenants` (s `DEFAULT_TENANT` seed), `users`, `roles`, `permissions`, `sessions`
- [ ] **[M]** `products`, `product_variants`, `product_options`, `product_metadata` (JSONB)
- [ ] **[M]** `categories` (materialized path), `collections`, `product_categories`
- [ ] **[M]** `inventory_items`, `stock_levels`, `warehouses` (MVP = 1 default warehouse, schema ready pro MSI)
- [ ] **[M]** `prices`, `price_lists`, `currencies`, `tax_rates`, `tax_zones`
- [ ] **[M]** `customers`, `addresses`, `customer_groups`
- [ ] **[M]** `companies`, `company_members` (B2B-lite: customer může mít volitelnou vazbu na company)
- [ ] **[S]** `tier_prices` (per-company / per-customer-group pricing, plné UI ve v1.0)
- [ ] **[M]** `carts`, `cart_items` (persistent + guest)
- [ ] **[L]** `orders`, `order_items`, `order_transitions`, `order_events` (HPOS-inspired flat, ne meta polymorfismus)
- [ ] **[M]** `payments`, `refunds`, `shipments`, `shipment_events`
- [ ] **[M]** `discounts`, `coupons`, `promotion_rules`
- [ ] **[S]** `media`, `media_variants`
- [ ] **[S]** `translations` (i18n per entity/field)
- [ ] **[S]** `plugins`, `plugin_config` (metadata o nainstalovaných pluginech)
- [ ] **[S]** `webhooks`, `webhook_deliveries`
- [ ] **[S]** `audit_log` (základ — who/what/when)
- [ ] **[M]** `tenant_id` ve všech tabulkách + RLS policies (vypnuté v CE)
- [ ] **[S]** Seed data pro dev + demo shop
- [ ] **[S]** Drizzle migrace + CLI (`shopio db migrate|seed|reset`)

**Závislosti:** Fáze 0.

#### 4.1.2. Core commerce engine [XL]

- [ ] **[L]** Katalog service (CRUD produktů, variant, kategorií, atributů)
- [ ] **[L]** Cart service (add/remove/update, persistent, guest, merge on login)
- [ ] **[XL]** Checkout workflow (shipping → payment → review → confirm), workflow engine s compensation (Medusa v2-inspired)
- [ ] **[XL]** Order service (creation, state machine, cancellation, refund, partial fulfillment)
- [ ] **[M]** Inventory service (allocation, reservation, deallocation on cancel/expire)
- [ ] **[M]** Pricing engine (price lists per customer group, currency conversion, tax-inclusive/exclusive)
- [ ] **[L]** Tax engine (CZ 21/12/0, SK 23/19/5, EU OSS, B2B reverse charge, VIES validace)
- [ ] **[M]** B2B checkout varianta (VAT ID ověření, reverse charge cross-border B2B, VAT-exclusive display pro B2B customery, company billing adresa)
- [ ] **[L]** Discount/promotion engine (fixed, %, BOGO, free shipping, coupons, tier pricing)
- [ ] **[M]** Customer service (register, profile, address book, order history)
- [ ] **[M]** Search (Meilisearch indexer, produkt/kategorie facets, synonyms, CZ/SK analyzer)
- [ ] **[S]** Wishlist
- [ ] **[S]** Reviews & ratings (moderation queue)
- [ ] **[M]** Event bus (internal) — emit events pro hooks/webhooks/plugins

**Závislosti:** 4.1.1.

#### 4.1.3. API vrstva [L]

- [ ] **[M]** REST API (všechny domény, OpenAPI 3.1 auto-generated, Swagger UI v adminu)
- [ ] **[M]** GraphQL API (Yoga, schema stitching mezi packages, codegen pro klient)
- [ ] **[M]** MCP server basic (read-only: produkty, kategorie, stav objednávky)
- [ ] **[S]** Webhooks (configurable, exponential backoff, signatures)
- [ ] **[S]** API keys + scopes
- [ ] **[M]** Rate limiting (Redis token bucket, per-key)
- [ ] **[S]** Idempotency keys (povinné pro payment/order mutations)
- [ ] **[S]** Pagination convention (cursor-based)

**Závislosti:** 4.1.2.

#### 4.1.4. Admin UI [XL]

- [ ] **[M]** Login, 2FA (TOTP), password reset, invite flow
- [ ] **[L]** Dashboard (KPI widgety, recent orders, low stock, alerts)
- [ ] **[L]** Katalog UI (produkty, varianty, hromadné úpravy, import CSV, drag-drop kategorií)
- [ ] **[L]** Order management (seznam, detail, edit, refund, print invoice/label)
- [ ] **[M]** Customer management (seznam, detail, GDPR export/delete UI)
- [ ] **[M]** Discount/promotion builder
- [ ] **[L]** Nastavení (obecné, platby, doprava, daně, emaily, lokalizace, domény, plugins)
- [ ] **[M]** Media manager (upload, organize, transformations)
- [ ] **[M]** Content pages (CMS-lite: stránky, bloky, menu)
- [ ] **[S]** Role & permissions UI
- [ ] **[M]** Audit log viewer
- [ ] **[S]** Global search (cmd+k)
- [ ] **[S]** Dark mode
- [ ] **[M]** Responsive (funkční na tabletu)
- [ ] **[S]** i18n (CZ, SK, EN, DE)

**Závislosti:** 4.1.3.

#### 4.1.5. Default storefront (Next.js 16) [L]

- [ ] **[M]** App Router setup, RSC + Server Actions
- [ ] **[M]** Product listing + filters + sort + infinite scroll
- [ ] **[M]** Product detail (varianty, galerie, reviews, related)
- [ ] **[M]** Cart + mini-cart
- [ ] **[L]** Checkout flow (guest + logged-in)
- [ ] **[M]** Account area (objednávky, adresy, heslo, GDPR export)
- [ ] **[S]** CMS stránky render
- [ ] **[S]** SEO (metadata, sitemap, robots, JSON-LD Product/Organization/Breadcrumb/Offer)
- [ ] **[M]** Theming přes CSS variables + tailwind, headless-friendly
- [ ] **[S]** Accessibility audit (WCAG 2.2 AA minimum)
- [ ] **[S]** Core Web Vitals optimalizace (LCP <2.5s)
- [ ] **[S]** Multi-language (CZ, SK, EN na start)

**Závislosti:** 4.1.3.

#### 4.1.6. Platební brány (CZ/SK first) [L]

- [ ] **[S]** Payment provider interface (abstrakce)
- [ ] **[M]** Stripe adapter
- [ ] **[M]** GoPay adapter (CZ)
- [ ] **[M]** ComGate adapter (CZ)
- [ ] **[M]** ThePay adapter (CZ)
- [ ] **[S]** PayPal adapter
- [ ] **[S]** Bank transfer + QR platba SPAYD (CZ)
- [ ] **[S]** Cash on delivery
- [ ] **[S]** 3DS2 flow (přes provider)
- [ ] **[S]** Refunds + partial refunds

**Závislosti:** 4.1.3.

#### 4.1.7. Dopravci a logistika (CZ/SK) [M]

- [ ] **[S]** Shipping provider interface
- [ ] **[M]** Zásilkovna adapter (labels, tracking, výdejní místa)
- [ ] **[M]** PPL adapter
- [ ] **[M]** Česká pošta adapter (Balík Do ruky, Do balíkovny)
- [ ] **[S]** DPD adapter
- [ ] **[S]** Slovenská pošta + Packeta SK
- [ ] **[S]** Shipping zones + weight/price-based rules
- [ ] **[S]** Pickup points widget (storefront)

**Závislosti:** 4.1.3.

#### 4.1.8. Faktury, účetnictví, compliance (CZ/SK) [L]

- [ ] **[M]** Generování faktury (PDF, řada, ISDOC 6.0.1 export)
- [ ] **[S]** EET rozhraní připravené (zatím ne-povinné, kód ready)
- [ ] **[M]** Pohoda XML export
- [ ] **[S]** Money S3 export
- [ ] **[S]** iDoklad API
- [ ] **[M]** GDPR: consent management, data export, right-to-be-forgotten workflow
- [ ] **[S]** Cookie banner (built-in, customizable)
- [ ] **[M]** ARES validace IČO (CZ)
- [ ] **[S]** ORSR validace (SK)
- [ ] **[M]** VIES validace DIČ (EU)
- [ ] **[M]** OSS (One-Stop-Shop) reporting helper
- [ ] **[S]** EKO-KOM reporting helper (CZ recyklační)

**Závislosti:** 4.1.2.

#### 4.1.9. Email a notifikace [M]

- [ ] **[M]** React Email templates (order confirmation, shipping, invoice, password reset, etc.)
- [ ] **[S]** Multi-language templates
- [ ] **[S]** Email provider adapter (Resend, SES, SMTP)
- [ ] **[S]** Per-tenant email config (ready pro Cloud)
- [ ] **[S]** Email preview v admin

**Závislosti:** 4.1.4.

#### 4.1.10. CLI a installer [M]

- [ ] **[S]** `shopio init` — bootstrap nového projektu
- [ ] **[M]** `shopio db migrate|seed|reset|dump|restore`
- [ ] **[S]** `shopio plugin install|remove|list`
- [ ] **[S]** `shopio export|import` (shop-level backup)
- [ ] **[M]** Docker Compose stack (postgres, redis, meilisearch, minio, shopio)
- [ ] **[S]** `curl | bash` installer skript (Linux + macOS)
- [ ] **[M]** Getting-started docs (install za 5 minut)

**Závislosti:** 4.1.1, 4.1.4.

#### 4.1.11. Plugin systém [L]

- [ ] **[M]** Plugin loader (npm package based, `@shopio-plugin/*` namespace)
- [ ] **[M]** Hook system (before/after events pro všechny domain operace)
- [ ] **[M]** Custom entity fields registration (rozšíření JSONB metadata + UI)
- [ ] **[S]** Admin UI slots (pluginy přidávají stránky/widgety)
- [ ] **[S]** Migration hooks (plugin má vlastní DB schema v namespace)
- [ ] **[M]** Example plugin + developer docs
- [ ] **[S]** Plugin dev kit (scaffolding: `shopio plugin create`)

**Závislosti:** 4.1.2.

#### 4.1.12. Agent-native MVP [M]

- [ ] **[M]** MCP server — read katalog, kategorie, stav objednávky
- [ ] **[S]** Structured Product Feed (JSON-LD sitemap pro AI crawlery)
- [ ] **[S]** Robots.txt + llms.txt (nový standard pro LLM crawling guidelines)
- [ ] **[S]** OpenAPI spec publikovaný veřejně (pro agent integration)

**Závislosti:** 4.1.3.

#### 4.1.13. Observability a bezpečnost [M]

- [ ] **[S]** Structured logging (pino, JSON)
- [ ] **[S]** OpenTelemetry tracing (HTTP endpoints)
- [ ] **[S]** Metrics (Prometheus-compatible endpoint)
- [ ] **[S]** Health + readiness endpoints
- [ ] **[M]** Security headers (CSP, HSTS, X-Frame-Options, …)
- [ ] **[S]** CSRF protection (admin)
- [ ] **[S]** Rate limit na auth endpoints
- [ ] **[S]** Argon2 password hashing
- [ ] **[S]** Automated security scan (CodeQL, Snyk, Dependabot)
- [ ] **[S]** Secret rotation konvence

**Závislosti:** kontinuálně.

#### 4.1.14. Testy [L]

- [ ] **[M]** Unit testy core logiky (>70 % coverage services, >90 % order/payment/tax)
- [ ] **[M]** Integration testy API proti real Postgres + Redis v CI
- [ ] **[M]** E2E Playwright (checkout happy path, admin flows, GDPR flow)
- [ ] **[S]** k6 baseline load test

**Závislosti:** průběžně.

#### 4.1.15. Dokumentace [M]

- [ ] **[M]** Developer docs (getting started, architecture, plugin authoring, API reference)
- [ ] **[M]** User docs (admin guide, jak nastavit obchod)
- [ ] **[S]** API reference auto-generated (OpenAPI + GraphQL schema)
- [ ] **[S]** Video tutorial pro install
- [ ] **[M]** Docusaurus/Nextra site na docs.shopio.com

**Závislosti:** průběžně.

#### 4.1.16. Go-live MVP [M]

- [ ] **[M]** Private beta: 3–5 pilotních merchantů (CZ/SK, vlastní outreach)
- [ ] **[S]** Bug triage proces
- [ ] **[S]** Public launch: GitHub, Hacker News, r/selfhosted, CZ tech komunity
- [ ] **[S]** Marketing web shopio.com (jednoduché, později)
- [ ] **[S]** Discord nebo GitHub Discussions community
- [ ] **[S]** První release v0.1.0 (semver, changesets)

---

### Fáze 2 — v1.0 (po MVP, +24–36 měsíců)

**Cíl:** Přidat DE lokalizaci, komerční moduly (B2B, MSI, AI Copilot, SSO), plugin marketplace infrastructure, advanced agent-native, managed hosting option. Monetizace začíná.

#### 4.2.1. DE lokalizace [L]

- [ ] **[M]** DE platby: Klarna, PayPal Plus, SEPA direct debit, giropay, Sofort
- [ ] **[M]** DE dopravci: DHL, Hermes, DPD DE, GLS
- [ ] **[M]** DATEV export pro účetnictví
- [ ] **[S]** Handelsregister validace
- [ ] **[S]** DSD (duales System) recyklační reporting
- [ ] **[S]** USt-Voranmeldung helper
- [ ] **[M]** Německý překlad admin + storefront
- [ ] **[S]** DE-specifické default tax rules (19 % / 7 %)

**Závislosti:** MVP core.

#### 4.2.2. B2B Components (komerční modul) [L]

- [ ] **[M]** Company accounts, multiple buyers per company
- [ ] **[M]** Quote requests + quote approval workflow
- [ ] **[M]** Purchase orders, NET 30/60 payment terms
- [ ] **[M]** Custom catalogs per company
- [ ] **[S]** Tier pricing per company
- [ ] **[S]** B2B checkout flow varianty

**Závislosti:** MVP core.

#### 4.2.3. Multi-Source Inventory (komerční) [L]

- [ ] **[M]** Multi-warehouse aktivace (schema už existuje z MVP)
- [ ] **[M]** Stock sources + stock allocations
- [ ] **[M]** Reservation system (race-condition safe, Postgres advisory locks)
- [ ] **[M]** Warehouse picker (priorita, blízkost, stav, custom rules)
- [ ] **[S]** Inter-warehouse transfers

**Závislosti:** MVP 4.1.1.

#### 4.2.4. AI Copilot (komerční) [L]

- [ ] **[M]** Produkt description generátor (Claude/GPT passthrough)
- [ ] **[S]** Image alt-text auto-generation
- [ ] **[S]** SEO suggestions
- [ ] **[M]** Customer support chatbot (RAG nad docs + FAQ)
- [ ] **[M]** Anomaly detection (order fraud, stock spikes)
- [ ] **[S]** BYO API key pro enterprise

**Závislosti:** MVP core.

#### 4.2.5. SSO / SAML (komerční) [M]

- [ ] **[M]** SAML 2.0 provider
- [ ] **[M]** OIDC provider
- [ ] **[S]** SCIM user provisioning
- [ ] **[S]** Okta, Azure AD, Google Workspace konektory

**Závislosti:** MVP core.

#### 4.2.6. Pokročilá analytics [M]

- [ ] **[M]** Cohort analysis, RFM, LTV
- [ ] **[M]** Funnel analytics
- [ ] **[M]** Attribution modeling
- [ ] **[S]** Custom reports builder
- [ ] **[S]** Export do BigQuery/Snowflake

**Závislosti:** MVP core.

#### 4.2.7. Plugin marketplace infrastructure [L]

- [ ] **[M]** Plugin registry backend (vlastní, ne npm — pro komerční pluginy)
- [ ] **[M]** Developer portal (plugin submission, reviews, sales)
- [ ] **[M]** Licensing server (license keys pro paid pluginy)
- [ ] **[S]** Revenue share accounting (80/20 initial, později TBD)
- [ ] **[M]** Plugin sandbox pro bezpečnostní audit
- [ ] **[S]** Rating/review system pro pluginy

**Závislosti:** 4.1.11.

#### 4.2.8. Advanced agent-native [M]

- [ ] **[M]** MCP server write operations (create order, update cart) s permissionami
- [ ] **[M]** A2A (Agent-to-Agent) protokol pro B2B
- [ ] **[S]** Agent-checkout flow (one-shot checkout URL)
- [ ] **[S]** AEO optimization tool v adminu
- [ ] **[S]** Conversational commerce primitives

**Závislosti:** 4.1.12.

#### 4.2.9. Managed hosting option (lifestyle monetizace) [M]

**Ne pravý multi-tenant SaaS — 1 VPS per zákazník, solo operovatelné.**

- [ ] **[M]** Provisioning automatizace (Terraform + Ansible, deploy na Hetzner/Contabo)
- [ ] **[M]** Onboarding flow (merchant objedná → automatizace nasadí → předá přístupy)
- [ ] **[M]** Monitoring (Grafana dashboard, alerting do Telegram/email)
- [ ] **[S]** Backup automatizace (daily snapshots → S3/Wasabi)
- [ ] **[S]** SSL automation (Let's Encrypt)
- [ ] **[M]** Billing (Stripe Billing, monthly invoice, manual dunning)
- [ ] **[S]** Customer support SLA dokumentovaně (response 24h, resolution best-effort)
- [ ] **[S]** Upgrade/update automation (zero-downtime deploy)

**Závislosti:** MVP stabilní.

#### 4.2.10. Rule Builder + Flow Builder [L]

- [ ] **[L]** Visual rule builder (Shopware-inspired) pro promotions, shipping rules
- [ ] **[L]** Visual flow builder pro automations (trigger → condition → action)
- [ ] **[M]** Pre-built templates (abandoned cart, restock notifications, win-back)

**Závislosti:** MVP core.

---

### Fáze 3 — v2.0 (po v1.0, +24–36 měsíců)

**Cíl:** CEE expanze, Cloud SaaS aktivace (až přijde tým/partner), Shopping Experiences, subscriptions.

- [ ] **[XL]** PL lokalizace: Przelewy24, BLIK, InPost, GUS validace, JPK_V7 export
- [ ] **[XL]** HU lokalizace: SimplePay, Barion, GLS, NAV online invoice reporting
- [ ] **[XL]** RO lokalizace: Netopia, FanCourier, ANAF SAF-T e-Factura
- [ ] **[L]** AT: Bank99, Austrian Post, compliance
- [ ] **[XL]** Marketplace konektory: Heureka (CZ/SK), Zboží.cz, Allegro (PL), eMag (RO), Bol.com (NL)
- [ ] **[L]** Google Shopping + Meta catalog feed
- [ ] **[XL]** Multi-tenancy aktivace (RLS zapnutí, tenant router, subdomains)
- [ ] **[XL]** Cloud SaaS operations (JEN pokud přijde tým nebo partner)
  - Tenant manager service
  - Billing integrace (Stripe Billing)
  - Control plane (staff admin, impersonate, monitoring)
  - On-call rotation a incident response proces
  - SOC 2 Type I readiness
- [ ] **[L]** Shopping Experiences (visual CMS, per-customer-group personalization, Shopware-inspired)
- [ ] **[L]** Subscriptions & recurring billing (komerční modul)
- [ ] **[M]** POS integrace (Stripe Terminal, SumUp)
- [ ] **[M]** Zero-party data + CDP primitives

---

### Fáze 4 — v3.0+ (Rok 7–10+)

**Cíl:** Advanced features, emerging commerce, global reach, enterprise readiness.

- [ ] **[XL]** Mobile merchant app (React Native/Expo)
- [ ] **[XL]** Real-time collaboration (CRDT/Yjs) v adminu
- [ ] **[L]** Live shopping / video commerce
- [ ] **[L]** AR try-on (produkty)
- [ ] **[L]** Voice commerce (Alexa/Google Assistant)
- [ ] **[XL]** CSRD / CSDDD reporting automation (sustainability)
- [ ] **[L]** Digital Product Passport (DPP 2027+ EU regulace)
- [ ] **[XL]** Enterprise Cloud tier (dedicated clusters, SLA 99.99 %)
- [ ] **[XL]** SOC 2 Type II, ISO 27001 audity (předpokládá enterprise zákazníky)
- [ ] **[L]** US expanze (Stripe, USPS, UPS, Avalara tax, sales tax per state)
- [ ] **[L]** Asia expanze (Alipay, WeChat Pay, Line Pay, per-country compliance)
- [ ] **[L]** Marketplace jako feature (sám provozovatel může hostovat third-party sellery)
- [ ] **[L]** Composable commerce moduly (každý service nezávisle škálovatelný)

---

## 5. Solo + AI reality check

### Co solo + Claude **zvládne**:
- Napsat kód pro vše výše (katalog, checkout, multi-tenancy, B2B, MSI, AI, plugins).
- Vydat releases, psát dokumentaci, reagovat na GitHub issues.
- Provozovat 1–10 merchantů na managed hostingu (1 VPS per merchant, zero-downtime deploys, business-hours support).
- Integrovat se s 5–10 platebními branami a dopravci.

### Co solo **nezvládne**:
- Provozovat multi-tenant SaaS 24/7 (on-call rotace, incident response, SLA 99.99 %).
- Customer support v 10 jazycích.
- Enterprise sales cycle (6–18 měsíců per deal, pre-sales engineering, PoC builds).
- SOC 2 Type II / ISO 27001 (roční cyklus, €30K+ náklady, dedicated security officer).
- Komunitní management na globální úrovni (triage 100+ PR/měsíc, release every 2 weeks, conference talks).
- Marketing + sales pro 500K+ merchantů.
- 24/7 dohled nad infrastrukturou.

### Implikace:
- **Fáze 1 a 2** jsou reálné solo.
- **Fáze 3 Cloud SaaS** vyžaduje minimálně 3–4 lidi (2 eng + 1 ops + 1 support). Do té doby shipujeme jen **managed hosting** (single-tenant VPS per merchant, levnější operations).
- **Fáze 4 enterprise sales** vyžaduje tým 10+. Dokud nepřijde, odsouváme.

---

## 6. Monetizace (lifestyle, postupná)

**Fáze 1 (MVP):** Zero revenue. Cíl = adopce, feedback, stability.

**Fáze 2 (v1.0) — konkrétní ceny TBD po pilotní fázi:**
- **Managed hosting** — tiered monthly fee per merchant (traffic/features)
- **Placená podpora** — prioritní support subscription + one-time setup/migration
- **Komerční pluginy** — individuální subscription (AI Copilot, B2B Full, MSI, SSO, …)
- **Premium šablony** — one-time

Ceny se rozhodnou až budou reálná data z pilotní fáze (operational náklady, API provolání, support hours). Benchmark pro kalkulaci: Shopware Rise €600/mo, Shopify Basic $29/mo, Shoptet Standard 890 Kč/mo.

**Fáze 3 (v2.0, pokud přijde tým):**
- **Cloud SaaS** — Starter €29, Growth €99, Scale €299, Enterprise custom
- **Plugin marketplace revenue share** — 80/20 developer/platforma

**Cílový lifestyle příjem Fáze 2:** 20–50 managed merchantů × €100 průměr + 50–100 plugin subscribers × €50 průměr = **€4–10K/měsíc MRR**.

---

## 7. Společný kód a procesy

- **Feature flags** — jedna implementace, rozhoduje CE/Enterprise/Cloud jak je flag nastaven (build-time i runtime). V MVP všechny `false` mimo core.
- **License checker** — build skript v `tools/license-checker` zakáže CE importovat z `packages/enterprise/*` a `packages/cloud/*`.
- **Upstream merge** — core je jediný source of truth. Komerční moduly patchují, ne forkují.
- **Versioning** — semver per package, changesets pro release notes.
- **Branch strategie** — trunk-based, short-lived feature branches.
- **Breaking changes** — RFC + deprecation window 2 major version pro CE.
- **Kompatibilita DB** — každá migrace testovaná single-tenant i multi-tenant mode.

---

## 8. Otázky k vyjasnění — všechny zodpovězené

- ✅ **Q1 Jméno:** Shopio (pracovní), finalize později
- ✅ **Q2 Cílové trhy:** CZ → DE → CEE (PL, HU, RO, AT) → US/Asie
- ✅ **Q3 API:** REST + GraphQL obojí
- ✅ **Q4 Licence core:** Apache 2.0 + komerční moduly (B2B, MSI, SSO, AI Copilot, Cloud) pod proprietary EULA
- ✅ **Q5 Multi-tenancy:** shared DB + `tenant_id` + Postgres RLS. Schema ready v MVP (RLS vypnuté flagem), aktivace ve Fázi 3 až přijde tým pro SaaS ops
- ✅ **Q6 Pilotní merchanti:** 3 na start private beta, po 2–3 měsících stability +2 další (CZ/SK)
- ✅ **Q7 Cílová kategorie MVP:** B2C (micro + mid) **+ B2B-lite**. B2B-lite = Company entity, per-company tier pricing, reverse charge VAT, VIES validace, basic B2B checkout varianta. Plný B2B (quote workflow, PO approval chains, custom catalogs) ve v1.0 jako komerční modul.
- ✅ **Q8 Storefront:** bundled Next.js default jako separable package. Ne-technický merchant dostane shop out-of-box, developer může použít jen API.
- ✅ **Q9 Mobile:** odloženo do v3+
- 🕗 **Q10 Cenová struktura:** TBD — konkrétní čísla se rozhodnou po datech z pilotní fáze (náklady na support, infra, API provolání). Benchmark: Shopware Rise €600/mo, Shopify Basic $29/mo, Shoptet Standard 890 Kč/mo.
- ✅ **Q11 0 % transaction fee:** platí — my nejsme payment processor, poplatky jdou k branám (Stripe, GoPay, ThePay). Diferenciátor proti Shopify, který bere 2 % pokud nepoužíváš Shopify Payments.
- ✅ **Q12 AI modely:** Anthropic Claude passthrough primary, OpenAI GPT fallback, BYO-key pro Enterprise. Abstrakce umožní výměnu providera.
- ✅ **Q13 Headless:** bundled default, všechny storefront operace přístupné přes REST+GraphQL API, developer může postavit vlastní frontend na stejném backendu
- ✅ **Q14 Plugin marketplace:** Fáze 2 (v1.0). V MVP jen plugin systém + instalace, ne marketplace (prázdný marketplace = špatný první dojem)
- ✅ **Q15 Plugin revenue share:** 80/20 (developer/platforma) první 3 roky pro přilákání ekosystému, pak review
- ✅ **Q16 Trademark:** odloženo, řeší se později (před public launch MVP)
- ✅ **Q17 API style:** vyřešeno v Q3
- ✅ **Q18 Test coverage:** >70 % services, >90 % critical engines (order/payment/tax/pricing), E2E Playwright pro checkout + admin flows + GDPR, k6 baseline load test v CI

---

## 9. Rizika a rozhodnutí

### 9.1. Strategická

- **Opuštění projektu.** Solo founder = single point of failure. Buď vyhoříš, nebo přijde životní změna. Mitigace: od dne 1 psát kvalitně dokumentovaný kód, aby někdo mohl pokračovat; OSS licence zajistí survivorship i kdyby entity zmizela.
- **Scope creep.** Chceš vše. OK, ale MVP **musí** zůstat omezený. Jinak 18 měsíců se protáhne na 48 a ztratíš motivaci. Každá feature v MVP musí být odůvodnitelná: "bez tohoto pilotní merchant neprodá".
- **Commoditizace.** Medusa, Saleor, Vendure už existují zdarma. Náš moat = **CEE lokalizace + agent-native + UX kvalita**, ne "další backend".
- **Distribuce.** Shoptet má 34K merchantů v CZ ne protože je nejlepší, ale protože má sales. Ty nebudeš mít sales team. Mitigace: OSS organic growth, content marketing (blog, YouTube), Hacker News + Reddit launch, partnerství s CZ/SK dev komunitou.

### 9.2. Technická

- **Drizzle vs Prisma** — Drizzle (rozhodnuto, rychlost).
- **Postgres jedna DB.** Sharding až ve Fázi 3+. V MVP OK.
- **RLS performance.** Při aktivaci multi-tenancy ve v2 testovat pod zátěží.
- **Plugin sandboxing.** JS pluginy ve stejném procesu = security risk. V MVP pluginy jen pro self-host (merchant ručí). Cloud pluginy sandboxed až ve Fázi 3 (isolated-vm nebo Cloudflare Workers).
- **Dependency rot.** Solo maintainer = nepřetržitě aktualizovat dependencies. Dependabot + Renovate nastavit od Fáze 0. Rozpočet 2h/týden na upgrady.

### 9.3. Právní

- **Trademark Shopio.** Zkontrolovat EUIPO + USPTO před launch.
- **GDPR.** DPA template ve v2 pro managed hosting zákazníky.
- **EU AI Act (2026–2027).** AI Copilot modul musí splňovat transparency.
- **CSRD.** Relevantní jen pro enterprise zákazníky. Ve Fázi 4.
- **DPP (2027+).** Schema už teď flexibilní (JSONB metadata).
- **CLA.** Nutné od dne 1, jinak nemůžeš do budoucna vytvářet komerční moduly nad contributions.

### 9.4. Klíčová rozhodnutí — finalizováno

| # | Rozhodnutí | Finální volba |
|---|---|---|
| 1 | Licence core | **Apache 2.0** + komerční moduly pod proprietary EULA |
| 2 | ORM | **Drizzle** |
| 3 | Monorepo | **Turborepo + pnpm** |
| 4 | Storefront default | **Next.js 16 bundled** jako separable package, headless umožněn |
| 5 | API strategy | **REST + GraphQL** obojí |
| 6 | MVP pilot vlna | **3 na start + 2 po 2–3 měsících** (CZ/SK) |
| 7 | Cílová kategorie MVP | **B2C (micro + mid) + B2B-lite** (Company entity, tier pricing, reverse charge VAT). Full B2B ve v1.0 jako komerční modul |
| 8 | Plugin marketplace | **Fáze 2 (v1.0)** |
| 9 | 0 % transaction fee | **Napořád** (nejsme payment processor) |
| 10 | AI modely | **Anthropic primary + OpenAI fallback + BYO-key** pro Enterprise |
| 11 | Multi-tenancy v kódu | **Shared DB + `tenant_id` + RLS**, schema ready v MVP, aktivace ve Fázi 3 |
| 12 | Test coverage | **>70 % services, >90 % critical engines** (order/payment/tax/pricing) |
| 13 | Cenová struktura | **TBD** — po datech z pilotní fáze |
| 14 | Trademark | **Odloženo** (před public launch MVP) |

---

## 10. Další kroky

Všech 18 otázek zodpovězeno, 14 rozhodnutí finalizováno. Teď:

1. **Detailní sprint plán Fáze 0** (Měsíc 1–2) — konkrétní tasky v pořadí, co je blocker pro start Fáze 1.
2. **Stack setup PoC** — monorepo scaffold, CI, Docker Compose dev stack, Drizzle schema základ, základní package layout.
3. **První commit + public GitHub repo.**
4. **Start Fáze 1 MVP** — katalog service jako první doména (nejširší závislost, brzký feedback na architekturu).

**Nic z Fáze 1 neimplementujeme, dokud není Fáze 0 hotová.**
