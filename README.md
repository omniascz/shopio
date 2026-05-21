# Shopio

> EU-first open-source e-commerce platform — Czech roots, European scope. Built with TypeScript, AI-native, GDPR-by-default.

**Status:** 🟡 Fáze 0 — Foundation (Q2 2026). Specifikace hotová (39 dokumentů v [`zadani/`](./zadani/)), aktivně skladáme codebase.

---

## ✨ Co Shopio dělá jinak

- **AI Copilot built-in** napříč admin + storefront — kontextová asistence, ne přilepený chatbot
- **Hosted MCP server per tenant** — AI agenti (Claude Desktop, Cursor, ChatGPT Desktop) se připojí přes OAuth → klíčový differentiátor
- **EU-first compliance** native — GDPR / PCI SAQ A / EU AI Act / ISO 27001 / SOC 2 / NIS2 / Pohoda + iDoklad accounting integrations
- **Apache 2.0 core** + MIT SDK + komerční moduly — self-host friendly
- **80/20 plugin marketplace rev share** — developer-friendly (per [`28-developer-platform.md`](./zadani/28-developer-platform.md))
- **Multi-tenant** SaaS + self-host obě cesty first-class

## 📐 Architektura — overview

```
Storefront (Next.js 16 RSC + Cache Components)    apps/storefront
Admin SPA  (Vite + React 19)                       apps/admin
API        (Fastify + tRPC + GraphQL Yoga)         apps/api

Database   PostgreSQL 17 + pgvector + ltree        packages/db (Drizzle ORM)
Cache      Redis 7
Search     Meilisearch + pgvector
Storage    S3-compatible (AWS/MinIO/Hetzner)
KMS        AWS KMS / GCP / Vault / local-dev
AI         Anthropic primary + OpenAI fallback + BYOK
Queues     BullMQ + Postgres LISTEN/NOTIFY
```

Detailní spec: [`zadani/00-MASTER-INDEX.md`](./zadani/00-MASTER-INDEX.md)

## 🚀 Local development quick-start

Per [`zadani/38-deployment-guide.md §3`](./zadani/38-deployment-guide.md).

### Prerekvizity

- Node.js 22 LTS+ (`fnm install 22 && fnm use 22`)
- pnpm 10+ (`corepack enable && corepack prepare pnpm@latest --activate`)
- Docker Desktop 4.30+ nebo Docker Engine 26+
- 16 GB RAM doporučeno, 50 GB volného disku

### Setup

```bash
# 1. Naklonovat
git clone https://github.com/shopio/shopio.git
cd shopio

# 2. Nastavit env
cp .env.example .env
#    (vyplň ANTHROPIC_API_KEY, STRIPE_SECRET_KEY pokud chceš testovat)

# 3. Spustit services (Postgres + Redis + Meilisearch + MinIO + Mailpit)
docker compose up -d

# 4. Nainstalovat dependencies
pnpm install

# 5. (TODO Fáze 1) Spustit migrace a seed
pnpm db:migrate
pnpm db:seed

# 6. Spustit dev (paralelně všechny apps)
pnpm dev
```

### Access points

| Service | URL |
|---|---|
| Storefront | http://localhost:3030 |
| Admin | http://localhost:3031 |
| API | http://localhost:4040 |
| Postgres | localhost:5435 (user `shopio` / db `shopio_dev`) |
| Redis | localhost:6385 |
| Meilisearch | http://localhost:7700 |
| MinIO S3 API | http://localhost:9100 |
| MinIO console | http://localhost:9101 |
| Mailpit (email preview) | http://localhost:8027 |

Všechny porty jsou Shopio-specific (`30xx`/`40xx`/`5435`/`6385`/...) aby nekonfliktovaly s jinými lokálními projekty.

## 🗂️ Repo struktura

```
shopio/
├── apps/
│   ├── storefront/         # Next.js 16 storefront
│   ├── admin/              # Vite + React 19 admin SPA
│   └── api/                # Fastify API gateway
├── packages/
│   ├── db/                 # Drizzle schemas, migrations, client
│   ├── ui/                 # Shared component library + design tokens
│   ├── sdk/                # @shopio/sdk (MIT license)
│   ├── authz/              # Permissions + personas + ABAC
│   └── ai-core/            # AI provider abstraction
├── integrations/           # First-party integration adapters (Fáze 1+)
├── docker/                 # Docker init scripts
├── zadani/                 # Build spec (39 dokumentů, 3 MB ref material)
├── .github/                # CI/CD + dependabot
└── docker-compose.yml      # Local dev services
```

## 📜 Licence

- **Core (apps/ + packages/)** — Apache License 2.0 (per `01-DEC-LICENSE-001`)
- **SDK (`packages/sdk`)** — MIT License
- **Commercial modules** — proprietary EULA (TBD; nejsou v tomto repu)

Viz [`LICENSE`](./LICENSE).

## 🤝 Contributing

Viz [`CONTRIBUTING.md`](./CONTRIBUTING.md). Trunk-based development; PR review required; commits per Conventional Commits.

## 🛡️ Security

Pro reportování security vulnerabilities viz [`SECURITY.md`](./SECURITY.md). Bug bounty Fáze 2 (Intigriti).

## 📚 Dokumentace

- **Build spec:** [`zadani/`](./zadani/) — 39 dokumentů, kompletní referenční specifikace
- **Master index:** [`zadani/00-MASTER-INDEX.md`](./zadani/00-MASTER-INDEX.md)
- **Decisions registry:** [`zadani/01-decisions-registry.md`](./zadani/01-decisions-registry.md)
- **Deployment guide:** [`zadani/38-deployment-guide.md`](./zadani/38-deployment-guide.md)
- **Execution plan:** [`zadani/37-build-execution-plan.md`](./zadani/37-build-execution-plan.md)

## 🌍 Roadmap

Per `zadani/37 §`. Stručně:

- **Fáze 0** Q2 2026 — Foundation (právě teď)
- **Fáze 1** Q3 2026 → Q1 2027 — MVP launch (CZ)
- **Fáze 2** 2027 — Growth (SK + PL + DE expansion, B2B + marketplace)
- **Fáze 3** 2028 — Scale (€1M MRR, SOC 2 Type II, NIS2)
- **Fáze 4+** 2029+ — Maturity → Long-term

---

Powered by 1 founder + Claude. ☕ Made in Czech Republic, designed for the EU.
