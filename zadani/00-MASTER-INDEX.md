# 🗺️ MASTER INDEX – Executable Build Specification

> **Účel:** Tento dokument je vstupní bod pro celou build specifikaci e-commerce platformy. Poskytuje navigaci, popisuje strukturu, konvence a vztahy mezi všemi dokumenty.

**Verze:** 1.0
**Datum:** 2026-05-03
**Status:** Foundation phase – in progress
**Cíl:** Executable specification – po dokončení lze podle této dokumentace postavit kompletní platformu

---

## 📑 1. Jak číst tuto dokumentaci

### 1.1 Pořadí čtení

**Pro Project Managera / Tech Lead:**
1. Tento dokument (00)
2. 01-decisions-registry – co je rozhodnuto a proč
3. 37-build-execution-plan – jak postavit
4. 38-deployment-guide – jak nasadit

**Pro Backend Developera:**
1. 03-data-models-master – datové modely
2. 04-api-conventions – API pravidla
3. Doménové dokumenty (06-32) – konkrétní implementace
4. 30-security – bezpečnostní pravidla

**Pro Frontend Developera:**
1. 26-themes-storefront – frontend architektura
2. 35-graphic-templates – design system
3. 27-admin-backoffice – admin UI
4. 23-i18n – lokalizace

**Pro DevOps / Platform Engineera:**
1. 31-operations – provoz, monitoring
2. 38-deployment-guide – deployment
3. 30-security – bezpečnost infrastruktury
4. 28-developer-platform – API platform

**Pro AI Agenta provádějícího build:**
1. 00 (tento) → 01 → 03 → 04 → 05
2. 37-build-execution-plan – sekvence kroků
3. Pro každou doménu: konkrétní dokument

### 1.2 Konvence v dokumentech

**ID systém – každý prvek má jednoznačný identifikátor:**

```
ENT-{DOMAIN}-{NUMBER}        Entity (datový model)
   Příklad: ENT-PRODUCT-001 = entita Product

RULE-{DOMAIN}-{NUMBER}       Business rule
   Příklad: RULE-CART-001 = pravidlo košíku

API-{METHOD}-{RESOURCE}-{NUMBER}   API endpoint
   Příklad: API-POST-CART-001

FLOW-{DOMAIN}-{NUMBER}       UX flow
   Příklad: FLOW-CHECKOUT-001

PERSONA-{ROLE}               Uživatelská role
   Příklad: PERSONA-MERCHANT-OWNER

DEC-{DOMAIN}-{NUMBER}        Architectural decision
   Příklad: DEC-DB-001

PERM-{RESOURCE}-{ACTION}     Permission
   Příklad: PERM-PRODUCT-CREATE

EVENT-{DOMAIN}-{NAME}        Doménová událost
   Příklad: EVENT-ORDER-PLACED

JOB-{NAME}                   Background job
   Příklad: JOB-INVENTORY-SYNC

TEST-{TYPE}-{NUMBER}         Test scenario
   Příklad: TEST-E2E-CHECKOUT-001
```

**Cross-reference notace:**

```markdown
[ENT-PRODUCT-001](03-data-models-master.md#ent-product-001)
[RULE-CART-001](10-pricing-promotions.md#rule-cart-001)
```

**Status každé položky:**

```
🔴 NOT_IMPLEMENTED  – nenavrženo nebo zatím není v rozsahu
🟡 DESIGN          – navrženo, čeká na implementaci
🟢 IMPLEMENTED     – v aktuální fázi vývoje
✅ DONE            – hotovo, otestováno, deployed
⚠️ DEPRECATED      – přestáváme používat
```

**Priorita:**

```
P0 – MVP, blokující
P1 – Phase 1 launch
P2 – Phase 2 (do 6 měsíců po launchi)
P3 – Phase 3 (do 12 měsíců)
P4 – Long-term
```

### 1.3 Šablona doménového dokumentu

Každý doménový dokument (06-34) má následující strukturu:

```markdown
# {NUMBER}-{DOMAIN-NAME}

## 0. Domain overview
## 1. References (na jaké dokumenty navazuje)
## 2. Personas zapojené v této doméně
## 3. Data models (entity)
## 4. State machines (pokud relevantní)
## 5. Business rules
## 6. API endpoints (REST)
## 7. GraphQL schema (pokud relevantní)
## 8. Events (doménové události)
## 9. Background jobs
## 10. UI/UX flows (s wireframes)
## 11. Edge cases & error handling
## 12. Performance requirements
## 13. Security requirements
## 14. Testing requirements
## 15. Implementation checklist
## 16. Open questions / future
```

---

## 📚 2. Kompletní seznam dokumentů

### Fáze 1: Foundation (SSOT – Single Source of Truth)

| ID | Soubor | Účel | Status |
|----|--------|------|--------|
| 00 | `00-MASTER-INDEX.md` | Tento dokument | 🟢 |
| 01 | `01-decisions-registry.md` | Architektonická rozhodnutí | 🟢 |
| 02 | `02-glossary.md` | Pojmosloví | 🟢 |
| 03 | `03-data-models-master.md` | Kanonické datové modely | 🟢 |
| 04 | `04-api-conventions.md` | API pravidla a konvence | 🟢 |
| 05 | `05-naming-conventions.md` | Pojmenování (kód, DB, API) | 🟢 |

### Fáze 2: Core Catalog & Commerce

| ID | Soubor | Účel | Status |
|----|--------|------|--------|
| 06 | `06-catalog-pim.md` | Product Information Management | 🟡 |
| 07 | `07-categories-taxonomy.md` | Kategorie a taxonomie | 🟡 |
| 08 | `08-search-filtering.md` | Vyhledávání a filtrování | 🟡 |
| 09 | `09-inventory.md` | Skladové hospodářství | 🟡 |
| 10 | `10-pricing-promotions.md` | Ceny, slevy, promo akce | 🟡 |
| 11 | `11-cart.md` | Nákupní košík | 🟡 |
| 12 | `12-checkout.md` | Checkout flow | 🟡 |

### Fáze 3: Transactions & Fulfillment

| ID | Soubor | Účel | Status |
|----|--------|------|--------|
| 13 | `13-payments.md` | Platby a platební brány | 🟡 |
| 14 | `14-shipping.md` | Doprava a doručení | 🟡 |
| 15 | `15-tax-compliance.md` | DPH, daně, compliance | 🟡 |
| 16 | `16-order-management.md` | Správa objednávek | 🟡 |
| 17 | `17-returns-refunds.md` | Vratky a refundace | 🟡 |
| 18 | `18-customer-management.md` | Správa zákazníků | 🟡 |

### Fáze 4: Business Functions

| ID | Soubor | Účel | Status |
|----|--------|------|--------|
| 19 | `19-marketing-seo.md` | Marketing a SEO | 🟡 |
| 20 | `20-analytics-reporting.md` | Analytika a reporty | 🟡 |
| 21 | `21-b2b-complete.md` | B2B funkcionalita kompletně | 🟡 |
| 22 | `22-multistore-channels.md` | Multi-store, multi-channel | 🟡 |
| 23 | `23-i18n.md` | Internacionalizace | 🟡 |
| 24 | `24-subscriptions.md` | Subscription commerce | 🟡 |
| 25 | `25-marketplace.md` | Marketplace (multi-vendor) | 🟡 |

### Fáze 5: Platform & Tech

| ID | Soubor | Účel | Status |
|----|--------|------|--------|
| 26 | `26-themes-storefront.md` | Témata a storefront | 🟡 |
| 27 | `27-admin-backoffice.md` | Administrace | 🟡 |
| 28 | `28-developer-platform.md` | API, SDK, pluginy | 🟡 |
| 29 | `29-integrations.md` | Integrace třetích stran | 🟡 |
| 30 | `30-security.md` | Bezpečnost a compliance | 🟡 |
| 31 | `31-operations.md` | Provoz, monitoring | 🟡 |
| 32 | `32-cms-content.md` | Content management | 🟡 |

### Fáze 6: Differentiators & Build

| ID | Soubor | Účel | Status |
|----|--------|------|--------|
| 33 | `33-ai-features.md` | AI features, AI agents | 🟡 |
| 34 | `34-industry-profiles.md` | Vertikální profily | 🟡 |
| 35 | `35-graphic-templates.md` | Design system, UI šablony | 🟡 |
| 36 | `36-personas-rbac.md` | Personas a oprávnění (matrix) | 🟡 |
| 37 | `37-build-execution-plan.md` | Sekvenční plán builderu | 🟡 |
| 38 | `38-deployment-guide.md` | Deployment a infrastructure | 🟡 |

**Celkem: 39 dokumentů**

---

## 🎯 3. Mise platformy

### 3.1 Vize v 1 větě

**Postavit nejlepší e-commerce platformu na světě – open-core, EU-sovereign, agent-native, vertical-aware, no transaction fees ever.**

### 3.2 Klíčové diferenciátory

```
1. NO TRANSACTION FEES EVER
   – Platíš za kapacitu, ne za úspěch
   – Žádných 2% z každé objednávky jako Shopify

2. EU SOVEREIGNTY
   – Data v EU, vlastnictví u merchanta
   – Self-host možný, vendor lock-in zakázán
   – Apache 2.0 core

3. AGENT-NATIVE
   – AI agents jsou first-class user (ne plugin)
   – Native MCP server, agent checkout, A2A negotiation

4. VERTICAL PROFILES
   – Industry-specific konfigurace native
   – Fashion, Pharmacy, B2B Industrial, Wine USA, atd.

5. SINGLE CODEBASE
   – Žádné dva produkty, žádný legacy
   – Tier-based feature flags, ne fork

6. PLUGIN ECONOMY (vstřícná)
   – 0% rev share na první $1M (vs Shopify 15-20%)
   – Apache 2.0 core, MIT SDK
```

### 3.3 Cílové persony platformy (zákazníci)

```
PRIMARY:
- Solopreneurs / startupy (€0-29/měsíc)
- Rostoucí merchanti (€29-99/měsíc)
- Established e-commerce (€99-299/měsíc)
- Enterprise (€299+/měsíc, custom)

VERTICAL FOCUS:
- Fashion & apparel (CEE/DACH primárně)
- Electronics & tech
- B2B Industrial (Czech Republic, Slovakia, Germany)
- Pharmacy
- Wine USA (specifický market)
```

### 3.4 Cílové trhy

```
Phase 1: Czech Republic, Slovakia
Phase 2: Germany, Austria, Poland
Phase 3: EU expansion (NL, BE, FR, IT, ES)
Phase 4: USA (vertikálně – Wine, B2B)
Phase 5: Global
```

---

## 🏗️ 4. Architektura platformy – high-level

### 4.1 Topologie

```
┌─────────────────────────────────────────────────────┐
│                    CDN / Edge                        │
│            (Cloudflare / Fastly)                     │
└────────────────────┬────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
┌───────▼──────┐         ┌───────▼──────┐
│  Storefront  │         │     Admin    │
│  (Next.js)   │         │   (Next.js)  │
└───────┬──────┘         └───────┬──────┘
        │                        │
        └────────────┬───────────┘
                     │
        ┌────────────▼────────────┐
        │      API Gateway         │
        │      (REST + GraphQL)    │
        └────────────┬─────────────┘
                     │
    ┌────────────────┼────────────────┐
    │                │                │
┌───▼────┐    ┌─────▼──────┐    ┌────▼────┐
│Catalog │    │   Order    │    │ Customer│
│Service │    │  Service   │    │ Service │
└───┬────┘    └─────┬──────┘    └────┬────┘
    │               │                 │
    └───────────────┼─────────────────┘
                    │
        ┌───────────▼───────────┐
        │   Event Bus (NATS)    │
        └───────────┬───────────┘
                    │
    ┌───────────────┼───────────────┐
    │               │               │
┌───▼────┐    ┌────▼─────┐    ┌────▼─────┐
│Postgres│    │  Redis   │    │Meilisearch│
└────────┘    └──────────┘    └──────────┘
```

### 4.2 Tech stack (rozhodnuto v 01-decisions-registry.md)

```
Backend:
- Language: TypeScript 5.x
- Runtime: Node.js 22 LTS
- Framework: Fastify + tRPC + GraphQL Yoga (DEC-ARCH-005)
- ORM: Drizzle (typed, performant)
- Validation: Zod
- API: tRPC (admin) + REST OpenAPI 3.1 (public) + GraphQL Yoga (storefront/headless) + MCP (agents)

Frontend (storefront):
- Framework: Next.js 16 (App Router, RSC, Cache Components) (DEC-FE-001)
- UI: React 19
- Styling: Tailwind CSS v4
- State: Zustand + TanStack Query
- Forms: React Hook Form + Zod

Frontend (admin):
- Framework: Vite + React 19 SPA (ne Next.js — admin je behind-login, žádný SEO)
- Router: TanStack Router (file-based, type-safe)
- UI: shadcn/ui (copy-paste komponenty, žádný lock-in)
- Tables: TanStack Table
- Charts: Recharts
- Server state: TanStack Query

Mobile (Fáze 4):
- Framework: React Native + Expo
- Sdílení: SDK client (@shopio/sdk-js), business logic v packages

Database:
- Primary: PostgreSQL 17 (s row-level security, pgvector, pg_trgm) (DEC-DB-001)
- Cache + queue store: Redis 7
- Search: Meilisearch (default), OpenSearch jako upgrade path Fáze 3+ (DEC-SEARCH-001)
- File storage: S3-compatible (MinIO self-host, AWS S3 / Cloudflare R2 cloud)
- Media transformation: imgproxy (self-host), Cloudflare Images (Cloud)

Background jobs + events:
- Job queue: BullMQ (Redis-based) (DEC-EVENTS-001)
- In-process event bus: type-safe Node EventEmitter wrapper
- Cross-instance fanout: Postgres LISTEN/NOTIFY
- Outbox pattern: transactional outbox table v Postgres pro guaranteed delivery
- (Žádný NATS, žádná Kafka v MVP)

Infrastructure:
- Container: Docker + Docker Compose (self-host)
- Orchestration: Kubernetes (k3s pro small Cloud, managed pro large) — JEN Fáze 3+
- IaC: Terraform (Cloud), Ansible (self-host hardening)
- (Žádný service mesh v MVP — modular monolith jeden proces)

AI:
- Primary: Anthropic Claude (DEC-AI-001)
- Fallback: OpenAI GPT
- Enterprise: BYO-key
- Protokol pro agenty: MCP (Model Context Protocol) v `packages/api-mcp`

Observability:
- Logs: Loki + Grafana
- Metrics: Prometheus + Grafana
- Traces: Tempo (OpenTelemetry)
- Errors: Sentry (self-host možný)
- Uptime: vlastní status page

Monorepo:
- Tool: Turborepo
- Package manager: pnpm
- TypeScript: shared configs
- Linting: ESLint + Prettier
- Git hooks: Husky + lint-staged

CI/CD:
- Platform: GitHub Actions (primary), GitLab CI (alternative)
- Testing: Vitest (unit), Playwright (E2E)
- Coverage: c8/Istanbul
- Deployment: ArgoCD (GitOps)
```

### 4.3 Repo struktura

```
ecommerce-platform/
├── apps/
│   ├── storefront/         # Next.js storefront
│   ├── admin/              # Next.js admin
│   ├── api/                # NestJS API gateway
│   ├── docs/               # Public docs site
│   ├── status/             # Status page
│   └── mobile/             # React Native (future)
├── services/
│   ├── catalog/            # Product/PIM service
│   ├── inventory/          # Stock service
│   ├── order/              # Order service
│   ├── customer/           # Customer service
│   ├── pricing/            # Pricing engine
│   ├── checkout/           # Checkout orchestrator
│   ├── payment/            # Payment service
│   ├── shipping/           # Shipping service
│   ├── tax/                # Tax engine
│   ├── search/             # Search service (proxy to Meili)
│   ├── notification/       # Email/SMS/push
│   ├── analytics/          # Event collection
│   ├── auth/               # Auth service
│   └── plugin-runtime/     # Plugin sandbox
├── packages/
│   ├── shared-types/       # TypeScript types shared
│   ├── shared-ui/          # React components
│   ├── shared-utils/       # Utility functions
│   ├── shared-config/      # Configs (eslint, ts, tailwind)
│   ├── domain-events/      # Event definitions
│   ├── api-client/         # Auto-generated client
│   └── plugin-sdk/         # SDK for plugin developers
├── plugins/
│   ├── core/               # Bundled plugins
│   └── examples/           # Example plugins
├── themes/
│   └── default/            # Default theme
├── infra/
│   ├── k8s/                # Kubernetes manifests
│   ├── terraform/          # IaC
│   ├── docker/             # Dockerfiles
│   └── scripts/            # Deploy scripts
├── tools/
│   ├── codegen/            # Code generators
│   ├── migration/          # Migration tools (Shopify → us)
│   └── seed/               # DB seeders
├── docs-internal/          # Internal docs (this build spec)
├── tests/
│   ├── e2e/                # Playwright tests
│   ├── load/               # k6 load tests
│   └── integration/        # Cross-service tests
├── .github/
│   └── workflows/
├── turbo.json
├── pnpm-workspace.yaml
└── README.md
```

---

## 🔗 5. Vztahy mezi dokumenty (dependency graph)

```
00 (Master Index)
 │
 ├── 01 (Decisions) ──────────────────────────┐
 ├── 02 (Glossary) ───────────────────────────┤
 ├── 03 (Data Models) ──────┐                 │
 ├── 04 (API Conventions) ──┤                 │
 └── 05 (Naming) ───────────┤                 │
                            │                 │
        ┌───────────────────┴─────────────────┘
        │
        ▼
   Foundation use všude jinde
        │
        ▼
   Doménové dokumenty (06-32)
        │
        ▼
   Differentiators (33-34)
        │
        ▼
   Implementation (35-38)
```

**Pravidlo:**
- Dokumenty 06+ **se odkazují** na 00-05, ale **ne naopak**
- Dokumenty 33-34 **se odkazují** na 06-32
- Dokumenty 35-38 **se odkazují** na vše

---

## 📋 6. Checklist pro každý doménový dokument

Před označením dokumentu za hotový:

```
□ Domain overview je jasný a stručný
□ References uvedeny (na jaké dokumenty navazuje)
□ Všechny relevantní personas identifikovány
□ Data modely mají ID (ENT-...)
□ State machines diagramy (pokud relevantní)
□ Business rules číslovány (RULE-...)
□ Všechny API endpoints definovány (API-...)
□ GraphQL schema (pokud relevantní)
□ Doménové eventy definovány (EVENT-...)
□ Background jobs identifikovány (JOB-...)
□ UI/UX flows zdokumentovány (FLOW-...)
□ Wireframes pro klíčové obrazovky
□ Edge cases pokryty (alespoň 5 per flow)
□ Error handling specifikován
□ Performance targets stanoveny (p50/p95/p99)
□ Security requirements (RBAC, validation, auditing)
□ Testing requirements (E2E, integration, unit)
□ Implementation checklist (kroky pro builder)
□ Open questions / future considerations
□ Cross-references do jiných dokumentů aktuální
```

---

## 🚀 7. Build flow – jak postupovat při implementaci

### 7.1 Vysoká úroveň

```
1. Setup monorepo (apps, services, packages)
2. Setup CI/CD pipeline
3. Setup local dev environment (Docker Compose)
4. Implement Foundation (auth, RBAC, multi-tenancy)
5. Implement Catalog & PIM
6. Implement Inventory
7. Implement Pricing
8. Implement Cart
9. Implement Checkout (the big one)
10. Implement Payments (integrace Stripe + GoPay + ComGate)
11. Implement Shipping (carriers integrations)
12. Implement Tax
13. Implement Order Management
14. Implement Customer Management
15. Implement Returns & Refunds
16. Implement Marketing & SEO
17. Implement Analytics
18. Implement B2B layer
19. Implement Multi-store
20. Implement i18n
21. Implement Themes & Storefront
22. Implement Admin UI
23. Implement Developer Platform (API, plugins)
24. Implement Integrations
25. Implement Security hardening
26. Implement Operations (monitoring)
27. Implement CMS
28. Implement Subscriptions
29. Implement Marketplace
30. Implement AI features
31. Implement Industry profiles
32. Theme polish, design system finalization
33. Performance tuning
34. Security audit
35. Beta program (10 merchants)
36. GA launch
```

**Detailní krok-za-krokem plán:** viz `37-build-execution-plan.md`

### 7.2 Časové odhady

| Fáze | Tým | Trvání |
|------|-----|--------|
| Setup + Foundation | 5 senior FTE | 4 týdny |
| Catalog → Order Mgmt (kroky 4-13) | 7 FTE | 10 týdnů |
| Customer → SEO (kroky 14-16) | 7 FTE | 6 týdnů |
| Analytics → i18n (kroky 17-20) | 7 FTE | 6 týdnů |
| Themes → Operations (kroky 21-26) | 8 FTE | 8 týdnů |
| CMS → Industry (kroky 27-31) | 8 FTE | 8 týdnů |
| Polish + Beta (kroky 32-35) | 10 FTE | 6 týdnů |
| Launch | 10 FTE | 2 týdny |
| **Total MVP** | – | **~50 týdnů (~12 měsíců)** |

---

## 🎓 8. Pro AI agenta provádějícího build

Pokud jsi AI agent provádějící implementaci, postupuj takto:

```
1. Načti a zpracuj 00-MASTER-INDEX (tento dokument)
2. Načti 01-decisions-registry → znej všechna rozhodnutí
3. Načti 02-glossary → ujasni si pojmy
4. Načti 03-data-models-master → znej entity
5. Načti 04-api-conventions → API pravidla
6. Načti 05-naming-conventions → naming
7. Načti 37-build-execution-plan → sekvence
8. Pro každý krok build planu:
   a) Načti relevantní doménový dokument
   b) Implementuj podle implementation checklistu
   c) Spusť tests
   d) Aktualizuj status v 00-MASTER-INDEX
9. Pokud nejasné, **NEHADEJ** – zastav a zeptej se
10. Pokud rozhodnutí v 01 odporuje doménovému dokumentu,
    **rozhodnutí v 01 vítězí** (je to SSOT)
```

**Pravidla pro AI builder:**

```
✅ DODRŽUJ ID systém (ENT-, RULE-, API- atd.)
✅ DODRŽUJ naming conventions z 05
✅ KAŽDÝ feature má testy
✅ KAŽDÝ commit má jasný scope
✅ DOKUMENTUJ co děláš

❌ NEMĚŇ rozhodnutí v 01 bez explicitního schválení
❌ NEPŘIDÁVEJ nové entity bez reference v 03
❌ NEVYTVÁŘEJ "kreativní" naming – drž se 05
❌ NEPŘESKAKUJ testy
❌ NEHÁDEJ business logiku – musí být v dokumentu
```

---

## 📞 9. Kontakty a vlastnictví

```
Document owner: Strategic foundation team
Tech lead: TBD
Security officer: TBD
Compliance officer: TBD
Architecture review: weekly
Document review: před každým release
```

---

## 📅 10. Změny tohoto dokumentu

| Verze | Datum | Změna | Autor |
|-------|-------|-------|-------|
| 1.0 | 2026-05-03 | Initial creation, Phase 1 foundation | Build Spec Team |
| 1.1 | 2026-05-19 | Stack sjednocení s todo.md: Fastify, PG 17, Next.js 16, BullMQ, Meilisearch, Anthropic AI; viz DEC-ARCH-005, DEC-AI/SEARCH/EVENTS-001 | — |

---

## ⚖️ 11. Licence

Tato dokumentace je interní strategický dokument. Veřejnost stack:

```
- Platforma core: Apache 2.0
- SDK & client libraries: MIT
- Pluginy (community): MIT recommended
- Pluginy (commercial): Custom licensing
- Documentation site: CC BY-SA 4.0
```

Detail: viz `01-decisions-registry.md → DEC-LEGAL-001`

---

**Konec MASTER INDEX dokumentu.**

➡️ Pokračovat na: [`01-decisions-registry.md`](01-decisions-registry.md)
