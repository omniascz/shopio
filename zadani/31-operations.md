# 31 – OPERATIONS

> **Doména:** Provoz platformy — infrastructure, deployment pipeline (CI/CD), environments, observability (metrics/logs/traces přes OpenTelemetry), monitoring + alerting (Grafana + Tempo + Loki + Mimir + Alertmanager), SLA/SLO/SLI, disaster recovery (RTO/RPO), backups, multi-region EU primary, caching, queue ops (BullMQ), storage, status page, release management, feature flags, blue/green + canary deploys, DB migrations, capacity planning, FinOps, chaos engineering.

**Datum:** 2026-05-20
**Verze:** 1.0
**Status:** 🟡 DESIGN
**Reference:** [01-decisions-registry.md](01-decisions-registry.md) DEC-OPS-* · [30-security.md](30-security.md) · [00-MASTER-INDEX.md](00-MASTER-INDEX.md) §4.2

---

## 📑 Obsah

0. [Domain overview](#0-domain-overview)
1. [References](#1-references)
2. [Personas](#2-personas)
3. [Infrastructure topology](#3-infrastructure-topology)
4. [Environments](#4-environments)
5. [CI/CD pipeline](#5-cicd-pipeline)
6. [Deployment strategies](#6-deployment-strategies)
7. [Observability](#7-observability)
8. [Monitoring & alerting](#8-monitoring--alerting)
9. [SLA / SLO / SLI](#9-sla--slo--sli)
10. [Disaster recovery](#10-disaster-recovery)
11. [Backups](#11-backups)
12. [Data models](#12-data-models)
13. [Business rules](#13-business-rules)
14. [REST API endpoints](#14-rest-api-endpoints)
15. [GraphQL schema](#15-graphql-schema)
16. [Events](#16-events)
17. [Background jobs](#17-background-jobs)
18. [UI/UX flows](#18-uiux-flows)
19. [Performance, testing](#19-performance-testing)
20. [Cost & FinOps](#20-cost--finops)
21. [Implementation checklist](#21-implementation-checklist)
22. [Open questions](#22-open-questions)

---

## 0. Domain overview

### 0.1 Co tato doména **je**

- **Cloud infrastructure** — AWS jako primární cloud (EU regions Frankfurt + Paris pro DR), abstrakce přes Terraform; pluggable pro self-host (Kubernetes manifests v Apache 2.0 OSS distro)
- **Multi-environment strategy** — local dev, ephemeral preview (per-PR), staging, production; each isolated networks + databases + secrets
- **CI/CD pipeline** — GitHub Actions; build/test/sign/deploy s policy gates; trunk-based development + short-lived feature branches; protected main
- **Observability stack** — OpenTelemetry SDKs (traces + metrics + logs) → OTel Collector → Grafana stack (Tempo for traces, Loki for logs, Mimir for metrics) self-hosted EU + Cloudflare Logs for edge; Sentry for errors
- **SLO-driven operations** — Service Level Objectives explicit + tracked, error budgets, alert policies tied to SLOs (not just thresholds)
- **Multi-region DR** — primary Frankfurt + warm-standby Paris; RPO ≤ 5 min, RTO ≤ 30 min for tier-1 services
- **Database operations** — PostgreSQL 17 with logical + physical replication, PITR (Point-in-Time Recovery), automated weekly schema migration windows, online migrations via pgroll/Skeema patterns
- **Container orchestration** — Kubernetes (EKS managed); Helm charts; ArgoCD for GitOps continuous deployment; per-service horizontal pod autoscaler + cluster autoscaler
- **Edge layer** — Cloudflare (CDN, WAF per `30`, DNS, load balancing); Cloudflare Workers for low-latency endpoints (Fáze 2)
- **Background workers** — BullMQ per `DEC-EVENTS-001`; Redis (ElastiCache Multi-AZ); Postgres LISTEN/NOTIFY pro fast event fanout
- **Caching** — Redis hot cache, Cloudflare edge cache, Next.js Cache Components per `26`
- **Storage** — S3 for object storage (media, archives, backups); EBS gp3 for DBs; lifecycle policies (hot → cold → glacier)
- **Status page** — public status.shopio.com via Statuspage.io or self-hosted (Cachet-fork); auto-updates from incident system
- **Release management** — semantic versioning for packages; date-versioned APIs (per `04`); release notes auto-generated; gradual rollout with feature flags
- **Feature flags** — Unleash (OSS, EU-friendly) self-hosted; per-tenant, per-user, per-percentage targeting; kill switches
- **Capacity planning** — utilization dashboards, growth projections, scaling rehearsals
- **FinOps** — cost dashboards per service/tenant; budget alerts; right-sizing recommendations
- **Chaos engineering** — Litmus / chaos-mesh experiments quarterly; game days

### 0.2 Co tato doména **NENÍ**

- ❌ Specific app code architecture (→ doménové dokumenty 06-29)
- ❌ Security baseline (→ `30-security.md`); tato doc volá do security pro auth/audit
- ❌ Business analytics (→ `20-analytics-reporting.md`); tato doc dělá *technical* metrics
- ❌ Marketing / SEO automation (→ `19`)
- ❌ Customer-facing AI runtime (→ `33-ai-features.md`)
- ❌ Detailní billing platformy (Shopio's vlastní billing pro merchant subscriptions) — Fáze 2 separately
- ❌ HR / people ops — out of scope build-spec
- ❌ Office IT / endpoint mgmt — out of scope build-spec
- ❌ Customer support tooling (Zendesk integraci popisuje `29`)

### 0.3 Diferenciátory

1. **EU-first by default** — primary Frankfurt, DR Paris; žádný US-only komponent v hot path; Grafana stack self-hosted v EU (vs vendor-locked New Relic / Datadog US-East default)
2. **Open observability** — OpenTelemetry standard end-to-end; data export possible; no vendor lock-in
3. **GitOps + signed deploys** — vše declarative v Gitu, ArgoCD continuous deploy, cosign-signed images (per `30 §RULE-SEC-026`)
4. **Trunk-based + tight feedback loop** — PR preview environments na každý PR (in <5 min); main always-deployable
5. **SLO-first culture** — error budgets enforced; if budget exhausted: freeze feature shipping until repaid
6. **Chaos engineering as practice** — quarterly game days; resilience verified periodically
7. **Cost transparency** — per-tenant cost attribution (Fáze 2 cost showback for self-hosted enterprise)
8. **Self-host viable** — OSS distro (Apache 2.0 core) ships docker-compose + Helm; runs on any Kubernetes; minimal vendor lock-in

### 0.4 High-level architecture

```
                   ┌─────────────────────────────────┐
                   │      Cloudflare (Edge)          │
                   │   WAF + CDN + DNS + Bot mgmt    │
                   └──────────┬──────────────────────┘
                              ↓ TLS 1.3
        ┌─────────────────────┴─────────────────────┐
        │            AWS ALB (EU primary)            │
        │  + AWS Global Accelerator (EU multi-AZ)    │
        └─────────────────────┬─────────────────────┘
                              ↓
   ┌──────────────────────────┴──────────────────────────┐
   │              Kubernetes Cluster (EKS)               │
   │                                                      │
   │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐       │
   │  │Storefr.│ │ Admin  │ │ API    │ │Workers │       │
   │  │ Next16 │ │ SPA    │ │Fastify │ │BullMQ  │       │
   │  └───┬────┘ └───┬────┘ └───┬────┘ └───┬────┘       │
   │      └──────────┴──────────┴──────────┘            │
   │                       ↓                              │
   │  ┌─────────────────────────────────────────────┐   │
   │  │   Internal service mesh + tRPC + GraphQL    │   │
   │  └──────────────────────┬──────────────────────┘   │
   └─────────────────────────┴──────────────────────────┘
                              ↓
   ┌──────────────────────────┴──────────────────────────┐
   │                  Data layer                          │
   │                                                       │
   │  ┌─────────────┐  ┌──────────┐  ┌────────────────┐  │
   │  │ Postgres 17 │  │  Redis   │  │ Meilisearch    │  │
   │  │   (RDS)     │  │ElastiCach│  │  (self-host)   │  │
   │  │  Multi-AZ   │  │ Cluster  │  │                 │  │
   │  └──────┬──────┘  └──────────┘  └────────────────┘  │
   │         ↓ logical repl                                │
   │  ┌─────────────┐  ┌──────────────────────────────┐   │
   │  │ Postgres 17 │  │       S3 (object storage)    │   │
   │  │  Read repl  │  │ media + backups + archives   │   │
   │  └─────────────┘  └──────────────────────────────┘   │
   └──────────────────────────────────────────────────────┘

   DR region (Paris): warm standby, async logical replication,
   promoted on failover (manual or auto per RTO target).

   Observability (separate cluster, EU):
   Grafana + Tempo (traces) + Loki (logs) + Mimir (metrics)
   + Alertmanager + Sentry (errors) + Statuspage.io.
```

---

## 1. References

- [01-decisions-registry.md](01-decisions-registry.md) DEC-OPS-* (TBD: AWS/EU primary, Grafana stack, Cloudflare edge, EKS, ArgoCD, Unleash flags, OpenTelemetry, Sentry)
- [00-MASTER-INDEX.md](00-MASTER-INDEX.md) §4.2 — tech stack canonical list
- [30-security.md](30-security.md) — backup encryption, network security, incident response cross-ref
- [DEC-EVENTS-001](01-decisions-registry.md) — BullMQ + Postgres LISTEN/NOTIFY
- [DEC-DB-001](01-decisions-registry.md) — Postgres 17, multi-AZ
- [DEC-FE-001](01-decisions-registry.md) — Next.js 16 + Vite admin
- [26 §15](26-themes-storefront.md#15-performance--accessibility) — performance targets storefront
- [27 §15](27-admin-backoffice.md#15-performance) — performance targets admin
- [28 §16.1](28-developer-platform.md#16-performance-security-testing) — dev platform performance
- AWS Well-Architected Framework
- Google SRE Book + Workbook
- CNCF Landscape (open-source-first)
- OpenTelemetry specification
- Site Reliability Engineering at Google
- Twelve-Factor App (12factor.net)
- HashiCorp Terraform Enterprise patterns
- ArgoCD docs
- Unleash Feature Flag patterns

---

## 2. Personas

| Persona | Použití | Klíčové permissions |
|---|---|---|
| `PERSONA-PLATFORM-SRE` | On-call, incident response, capacity, deploys | `PERM-OPS-*`, `PERM-PLATFORM-PRODUCTION-ACCESS` |
| `PERSONA-PLATFORM-DEVOPS-ENGINEER` | Infra-as-code, pipeline, observability config | `PERM-OPS-INFRA-MANAGE`, `PERM-OPS-PIPELINE-MANAGE` |
| `PERSONA-PLATFORM-RELEASE-MANAGER` | Coordinates releases, rollbacks, feature flags | `PERM-OPS-RELEASE-MANAGE`, `PERM-OPS-FEATURE-FLAGS-MANAGE` |
| `PERSONA-PLATFORM-DATA-ENGINEER` | DB migrations, performance, backups | `PERM-OPS-DB-MANAGE` |
| `PERSONA-PLATFORM-FINOPS` | Cost monitoring, budget enforcement | `PERM-OPS-COSTS-VIEW`, `PERM-OPS-BUDGETS-MANAGE` |
| `PERSONA-PLATFORM-SECURITY` | Security ops (per `30-security.md`) | `PERM-PLATFORM-SECURITY-*` |
| `PERSONA-DEVELOPER` (in-house engineer) | Pushes code, reviews PRs, watches own service | `PERM-OPS-DEPLOY-NON-PROD`, `PERM-OPS-OBSERVABILITY-VIEW` |
| `PERSONA-MERCHANT-OWNER` | Views status page, gets uptime SLA | Public (no auth needed for status) |
| `PERSONA-MERCHANT-DEVELOPER` (tenant's dev) | Monitors own integrations health | `PERM-DEVELOPER-ANALYTICS-VIEW` |
| `PERSONA-PLATFORM-SUPPORT` | Customer support — reads service health | `PERM-OPS-OBSERVABILITY-VIEW`, `PERM-OPS-RUNBOOK-VIEW` |

---

## 3. Infrastructure topology

### 3.1 Cloud provider

**Primary:** AWS — region `eu-central-1` (Frankfurt)
**DR:** AWS — region `eu-west-3` (Paris)

Volba AWS:
- Frankfurt + Paris EU regions s good latency
- Mature managed services (RDS, EKS, ElastiCache, S3, KMS, ALB)
- AWS Outposts for on-prem hybrid (Fáze 4+ enterprise)
- Cost predictable s reserved instances + savings plans
- Strong compliance (ISO 27001, SOC 2, PCI, GDPR)

**Alternative providers (for self-host customers):**
- GCP (europe-west3 Frankfurt + europe-west9 Paris)
- Azure (Germany West Central + France Central)
- Hetzner (Falkenstein + Helsinki) — Apache 2.0 distro
- On-prem (Kubernetes anywhere via Helm)

### 3.2 Kubernetes layout

```
Production cluster (eu-central-1):
  - 3 control plane nodes (managed by EKS)
  - Node groups:
    - app-general (m6i.xlarge, 4 vCPU, 16 GiB) ×3-30 autoscaled
    - app-compute-heavy (m6i.2xlarge, 8 vCPU, 32 GiB) ×0-10 autoscaled (search indexing, ML)
    - workers (m6i.large, 2 vCPU, 8 GiB) ×3-20 autoscaled (BullMQ workers)
    - data-edge (r6i.xlarge) ×3 fixed (Meilisearch, in-cluster Redis if not on managed)
  - Spot instances: 30% of compute-heavy + workers (interruptible workloads)
  - Multi-AZ across eu-central-1a, 1b, 1c
```

```
Observability cluster (separate; eu-central-1):
  - 3 nodes m6i.xlarge fixed (Grafana, Tempo, Loki, Mimir, Alertmanager, Sentry self-host)
  - Optional: managed Grafana Cloud (Fáze 2 — cost-effective for early stage)
```

```
DR cluster (eu-west-3):
  - Warm standby; reduced capacity (50% of prod)
  - Promoted on failover
  - Same node group structure
```

### 3.3 Service decomposition

Per Twelve-Factor App + service-oriented:

| Service | Tech | Replicas | Purpose |
|---|---|---|---|
| `storefront` | Next.js 16 (RSC + Cache Components) | 5-50 HPA | Customer-facing storefront SSR |
| `admin` | Vite + React 19 SPA (static + CDN) | N/A (static) | Admin UI |
| `api-gateway` | Fastify | 3-30 HPA | tRPC + REST + GraphQL ingress |
| `api-storefront` | Fastify | 3-30 HPA | Storefront API (low latency) |
| `api-admin` | Fastify | 3-20 HPA | Admin API (high consistency) |
| `api-developer` | Fastify | 2-10 HPA | OAuth, webhooks (per `28`) |
| `workers-orders` | BullMQ workers | 3-20 HPA | Order processing, fulfillment |
| `workers-marketing` | BullMQ workers | 2-15 HPA | Email send, abandoned cart, campaigns |
| `workers-integrations` | BullMQ workers | 3-20 HPA | Sync engines (per `29`) |
| `workers-webhooks` | BullMQ workers | 3-15 HPA | Outbound webhook delivery (per `28 §5`) |
| `workers-analytics` | BullMQ + spark/duckdb | 1-10 HPA | Reporting aggregations (per `20`) |
| `workers-ai` | BullMQ workers | 1-15 HPA | AI feature jobs (per `33`) |
| `workers-search-indexer` | BullMQ workers | 1-5 HPA | Meilisearch / pgvector indexing |
| `edge-functions-runtime` | Deno Deploy / CF Workers | external | Edge functions execution (per `28 §9`) |
| `mcp-server` | Fastify + WebSocket | 2-10 HPA | MCP per tenant (per `28 §8.13`) |
| `search-meilisearch` | Meilisearch | 3 (cluster) | Full-text + faceted search |
| `cache-redis` | Redis 7 (managed ElastiCache) | Multi-AZ | Cache + sessions + BullMQ |
| `db-primary` | Postgres 17 (RDS) | Multi-AZ primary + 2 read replicas | Source of truth |
| `db-read-replica` | Postgres 17 | 2 in-region + 1 cross-region (Paris) | Reads |
| `object-storage` | S3 | EU | Media, backups, exports |

### 3.4 Networking

```
VPC: 10.0.0.0/16 (Frankfurt)
  Public subnets (NAT + ALB):
    10.0.0.0/24 (AZ-a)
    10.0.1.0/24 (AZ-b)
    10.0.2.0/24 (AZ-c)
  Private subnets (services):
    10.0.10.0/22 (AZ-a)
    10.0.14.0/22 (AZ-b)
    10.0.18.0/22 (AZ-c)
  Database subnets:
    10.0.30.0/24 (AZ-a)
    10.0.31.0/24 (AZ-b)
    10.0.32.0/24 (AZ-c)

Egress: NAT gateways (1 per AZ) + egress proxy (Squid + allowlist per `30 §10.6`)
Ingress: ALB in public subnets → services in private
Cloudflare → ALB via authenticated origin pull (mTLS Cloudflare Origin Cert)
```

### 3.5 DNS

- `*.shopio.com` → Cloudflare DNS
- `api.shopio.com`, `app.shopio.com`, `cdn.shopio.com`, etc.
- Per-tenant custom domains: tenant configures CNAME → Cloudflare verifies → cert provisioned via Cloudflare SaaS
- ACM for AWS-side certs
- DNSSEC enabled
- DMARC/SPF/DKIM per `30 §10.10`

### 3.6 Internal service mesh (Fáze 2+)

- Linkerd (lightweight, less ops overhead than Istio)
- mTLS service-to-service
- Traffic splitting (canary)
- Retries + circuit breakers

MVP: standard Kubernetes Services + Ingress; mesh later.

---

## 4. Environments

### 4.1 Tiers

| Environment | Purpose | Data | Cost class |
|---|---|---|---|
| `local` | Developer machine | seeded fake | dev-only |
| `preview` | Per-PR ephemeral | shared seed snapshot | low (auto-cleanup) |
| `dev` | Long-lived dev environment | seeded fake | low |
| `staging` | Pre-prod testing | sanitized prod snapshot (PII scrubbed) | medium |
| `production` | Live customers | real | high |
| `dr` | DR standby (Paris) | replicated prod | medium |
| `sandbox` | Customer sandbox (Fáze 2 for plugin devs) | per-tenant isolated | per-tenant |

### 4.2 Local dev setup

```bash
# Quick-start
git clone https://github.com/shopio/shopio
cd shopio
pnpm install
docker-compose up                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  # Postgres + Redis + Meilisearch + MinIO
pnpm db:migrate
pnpm db:seed
pnpm dev                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          # turbo run starts all services + watches
```

- Hot reload across services
- Mailpit for emails (no real send)
- Stripe test mode
- All apps accessible at predictable local URLs

### 4.3 Preview environments

- Every PR triggers ephemeral preview
- Deployed to `pr-{number}.preview.shopio.dev`
- Shared seeded Postgres (snapshot per PR; auto-cleanup on PR close)
- Auto-comment on PR with preview URL
- Auto-destroy on PR close or after 7 days inactive

### 4.4 Staging

- Mirrors prod topology (smaller node groups)
- Sanitized prod data (weekly snapshot, PII scrubbed automated)
- All integrations sandbox mode
- Used for: pre-release verification, E2E test runs, customer demos

### 4.5 Production

- Full infrastructure
- Multi-AZ
- Backups + DR per `10`-`11`
- All secrets via KMS (per `30 §7`)

### 4.6 Promotion flow

```
[Feature branch]
        ↓ open PR
[Preview env auto-spawned]
        ↓ tests + review approval
[Merge to main]
        ↓ ArgoCD auto-deploys
[Staging]
        ↓ smoke tests pass
        ↓ manual approval OR auto-promote per change-class
[Production canary 5%]
        ↓ canary health checks 30 min
[Production canary 25%]
        ↓ 30 min
[Production canary 50%]
        ↓ 30 min
[Production 100%]
```

Override: hotfix bypasses staging with elevated approval.

---

## 5. CI/CD pipeline

### 5.1 Trigger model

- Pull request → preview env + tests + checks
- Merge to `main` → staging deploy + integration tests + canary plan
- Tag `v*.*.*` → production release (rare; mostly continuous)
- Manual workflow → hotfix, rollback, emergency

### 5.2 Pipeline stages (GitHub Actions)

```yaml
on: [pull_request, push to main]

jobs:
  lint:                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  # parallel
    - eslint, prettier check, typescript check
  test-unit:                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  # parallel
    - vitest run --coverage
  test-integration:                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            # parallel
    - vitest with testcontainers (postgres, redis)
  test-e2e:                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          # parallel
    - playwright against preview env
  scan-security:                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    # parallel
    - semgrep, codeql, snyk, gitleaks, trivy
  build:                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              # depends-on: lint, test-unit
    - docker buildx multi-arch (amd64 + arm64)
    - cosign sign image
    - push to ECR
  deploy-preview:                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          # depends-on: build (PR only)
    - terraform apply for preview namespace
    - ArgoCD sync to preview cluster
  deploy-staging:                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            # depends-on: tests + build (main branch only)
    - ArgoCD sync to staging
    - smoke tests
  canary-prod:                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                # depends-on: staging smoke (main branch only)
    - ArgoCD canary 5% → 25% → 50% → 100% with auto-rollback on SLO violation
  publish-release-notes:                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          # post-deploy
    - generate from conventional commits
```

### 5.3 Image signing + verification

- `cosign sign --key cosign.key shopio.com/api:abc123`
- Kubernetes admission controller (cosign policy controller) verifies signature before pod start
- Reject unsigned images

### 5.4 Trunk-based development rules

- Short-lived feature branches (< 3 days)
- Squash-merge to main (clean history)
- Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `perf:`, `test:`, `build:`, `ci:`, `revert:`, `breaking:`)
- Required reviews: 1 approval + passing CI
- No direct push to main (branch protection)
- Force-push to main disabled
- Tags signed (`git tag -s`)

### 5.5 Hotfix flow

```
1. Branch from main: `hotfix/SEC-001-fix-xss`
2. Implement fix + tests
3. Open PR with `hotfix:` label
4. Expedited review (1 reviewer + on-call security)
5. Merge to main
6. Cherry-pick to release branch if needed (rare; we deploy main)
7. Canary 5% → fast roll-forward to 100% in 15 min (if monitoring clean)
8. Customer notification if security-relevant (per `30 §13`)
```

### 5.6 Rollback strategy

- ArgoCD: previous synced revision retained; one-click rollback
- Database: rollback typically NOT done (migrations forward-only — see `5.7`)
- Feature flags: kill-switch flag to disable feature without redeploy
- Roll-forward preferred over rollback for code; rollback is acceptable for infrastructure

### 5.7 Database migrations

- Migrations in Drizzle Kit, versioned
- Backward-compatible always:
  - Add column nullable + default → backfill async → make NOT NULL (separate migration)
  - Never DROP column in same release as code that stops using it
  - Renames via add new + dual-write + cutover + drop old (3 releases)
- pgroll-inspired patterns for zero-downtime
- Migration window: continuous (small changes); preferred Tue-Thu off-peak; never Friday
- Locking checks (acquire-with-timeout, retry)
- Long migrations (>10s lock): scheduled maintenance window OR online via pgroll-like tooling

### 5.8 Change classification

| Class | Examples | Approval | Window |
|---|---|---|---|
| **Standard** | Routine feature, bug fix, dependency bump | 1 reviewer + CI | Anytime weekday |
| **Sensitive** | Auth changes, payment flow, audit log changes | 2 reviewers (incl security) | Weekday business hours |
| **High-risk** | DB schema (large tables), KMS rotation, infrastructure | 2 reviewers + change advisory + scheduled window | Off-peak |
| **Hotfix** | Security patch, prod-down | On-call + security | Anytime, expedited |
| **Emergency** | Active incident response | IC approval | Anytime |

---

## 6. Deployment strategies

### 6.1 Default: progressive rollout

ArgoCD + Argo Rollouts (or Flagger):
1. Deploy new version to 5% of pods (1-3 pods initially)
2. Wait 30 min
3. Check SLOs (error rate, latency p95, success rate)
4. If pass: progress to 25%
5. Repeat → 50% → 100%
6. If fail at any step: auto-rollback + alert

### 6.2 Blue-green (specific services)

For services with stateful or singleton concerns (e.g., search indexer, scheduler):
- Blue = current, Green = new
- Both running; cutover via service config flag
- Easier rollback (flip back)
- Higher cost (2× resources during deployment)

### 6.3 Feature flags + dark launch

For risky features:
- Code merged with flag off
- Enable for internal users (employee accounts)
- Enable for 1% of tenants
- Monitor → ramp up
- Eventually: remove flag (cleanup PR)

Flags managed in Unleash UI; per-tenant + per-user + percentage targeting.

### 6.4 Database deploys

- Schema migrations precede code (backward-compatible only)
- App code that reads/writes new schema deployed in subsequent release
- Avoid coupling DB + code in same deploy
- DB migrations recorded in `db_migrations` table + audit log

### 6.5 Migration patterns

| Pattern | Use |
|---|---|
| **Add nullable column** | Forward-compat add |
| **Backfill** | Online via background job |
| **Make NOT NULL** | After backfill complete |
| **Rename column** | new + dual-write + cutover + drop old |
| **Drop column** | Stop writing → wait one release → drop |
| **Add index** | `CONCURRENTLY` |
| **Partitioning** | One-time; planned downtime if huge |
| **Large data change** | Batched background job; not transactional |

### 6.6 Edge function deploys

Per `28 §9.5`. Deploy via `shopio functions deploy`. Adapter publishes to edge runtime (Deno Deploy / CF Workers). Validation + cache invalidation.

### 6.7 Storefront / admin static deploys

- Storefront (Next.js): built per release, deployed to Vercel-style infrastructure on Kubernetes OR Cloudflare Pages (Fáze 2 alt)
- Admin (Vite SPA): built to S3 + CloudFront / Cloudflare Pages
- Cache busting via filename hashing
- CDN purge per release

---

## 7. Observability

### 7.1 Three pillars + events

| Pillar | Tool | Retention |
|---|---|---|
| **Metrics** | Prometheus → Grafana Mimir | 30d hot, 1y cold |
| **Logs** | Loki | 30d hot, 1y cold (audit per `30` separate) |
| **Traces** | Tempo (OTel) | 7d hot, 30d sampled |
| **Errors** | Sentry self-host | 90d |
| **Events** | Internal event log (per `04 §10`) | per domain |
| **Profiling** | Pyroscope (Fáze 2) | 7d |

### 7.2 Instrumentation

All services emit OpenTelemetry:
- Auto-instrumented HTTP server / client
- Auto-instrumented DB clients (pg-otel)
- Auto-instrumented BullMQ (custom wrapper)
- Manual spans around business logic
- Baggage propagation: `tenant_id`, `request_id`, `user_id`

Exported to OTel Collector (sidecar or DaemonSet) → routed to backends.

### 7.3 Trace structure

Each request gets `trace_id` (TraceContext W3C). Propagated through:
- HTTP → headers (`traceparent`, `tracestate`)
- BullMQ jobs → job data field
- Webhooks → header (custom)
- AI agent → MCP context

End-to-end traces visible in Grafana Tempo.

### 7.4 Structured logging

- JSON output (logger: pino)
- Required fields: `level`, `time`, `service`, `tenant_id` (where applicable), `request_id`, `trace_id`, `msg`
- Optional: `user_id`, `session_id`, business context
- No PII in logs (per `30 §RULE-SEC-025` redaction middleware)

```jsonc
{
  "level": "info",
  "time": "2026-05-20T15:30:00.123Z",
  "service": "api-admin",
  "tenant_id": "tnt_aB",
  "user_id": "usr_xY",
  "request_id": "req_aBC",
  "trace_id": "1234abcd...",
  "span_id": "5678efgh...",
  "msg": "product.update succeeded",
  "duration_ms": 45,
  "resource_id": "prd_zZ"
}
```

### 7.5 Metrics

Standard prometheus metrics:
- `http_request_duration_seconds_bucket{service, method, route, status}` — histogram
- `http_request_total{service, method, route, status}` — counter
- `db_query_duration_seconds_bucket{op, table}` — histogram
- `bullmq_job_duration_seconds_bucket{queue, name, status}` — histogram
- `bullmq_queue_size{queue, state}` — gauge
- `cache_hit_total{cache, key_class}` / `cache_miss_total{cache, key_class}` — counter
- `business_*` (e.g., `business_orders_placed_total`) per domain

RED method (Rate, Errors, Duration) + USE method (Utilization, Saturation, Errors) for infrastructure.

### 7.6 Dashboards

Standard Grafana dashboards per service:
- **Service overview** — RED + USE
- **Latency breakdown** — p50/p95/p99
- **Error rate by endpoint**
- **DB query performance**
- **Queue health**
- **Cache hit ratio**
- **Tenant top-N by traffic**

Business dashboards:
- **GMV** (per region, per tenant tier)
- **Active tenants**
- **API usage** (per `28`)
- **Integration health** (per `29`)
- **Fraud queue** (per `30`)
- **AI cost + usage** (per `33`)

### 7.7 Alerting integration

Alertmanager → routes to:
- PagerDuty (SEV-1/SEV-2 — on-call)
- Slack (#alerts-platform, #alerts-customer-impact)
- Email (low severity, weekly digest)
- StatusPage (auto-update incidents)

Per §8.

### 7.8 Distributed tracing examples

A single API request fetched by a merchant:
```
http_request "POST /api/2026-05-20/products"
└─ permission_check (3ms)
└─ db_query "SELECT * FROM tenants" (2ms)
└─ db_query "INSERT INTO products" (15ms)
└─ db_query "INSERT INTO product_variants" (10ms)
└─ search_index_publish "product.created" (5ms; async to BullMQ)
└─ audit_log_write (4ms)
total: 45ms
```

Cross-service: outbound webhook delivery:
```
webhook_delivery_job
└─ external_http "POST https://merchant.com/webhooks/orders" (380ms)
   └─ network_dns_resolve (15ms)
   └─ tls_handshake (50ms)
   └─ request_response (315ms)
```

### 7.9 Privacy in observability

- PII redacted per logger middleware
- Customer-identifiable data hashed in metrics
- Trace baggage doesn't contain PII (only IDs)
- Sentry scrubbing rules
- Per `30 §RULE-SEC-025`

---

## 8. Monitoring & alerting

### 8.1 Alert philosophy

- **Symptom-based**, not cause-based — alert on user impact (latency, errors, availability), not internal state (CPU)
- **SLO-driven** — alert when error budget burning at unsustainable rate
- **Actionable** — each alert has runbook link
- **Prioritized** — SEV mapping
- **Reviewed** — quarterly alert hygiene review (delete noisy alerts)

### 8.2 Alert tiers

| Tier | Notification | Examples |
|---|---|---|
| **P1 — page** | PagerDuty wake on-call | SEV-1 incident, production down, SLO burn fast |
| **P2 — high** | PagerDuty business hours | SLO burn slow, partial outage, growing error rate |
| **P3 — medium** | Slack #alerts-platform | Capacity warnings, slow queries |
| **P4 — info** | Slack digest, email weekly | Cost overruns, certificate expiring soon |

### 8.3 Key alerts catalog

**Storefront:**
- `Storefront p95 latency > 1.5s for 5m` → P2
- `Storefront 5xx error rate > 2% for 5m` → P1
- `Cart conversion drop > 30% vs 7d avg for 1h` → P2 (business signal)
- `LCP regressed > 50% for 30m` → P3

**API:**
- `API p99 latency > 2s for 5m` → P2
- `API 5xx > 5% for 5m` → P1
- `Authentication failure spike > 100/min` → P2 (possible attack per `30`)
- `Rate limit violations > 1k/min` → P3 (capacity or attack)

**Workers:**
- `BullMQ queue X depth > 10000 for 15m` → P2
- `BullMQ X dead-letter count > 1000` → P2
- `Webhook delivery failure rate > 10% for 30m` → P2
- `Edge function error rate > 5% for 15m` → P2

**Database:**
- `Primary CPU > 80% for 15m` → P2
- `Replication lag > 60s` → P2
- `Connection pool > 90% saturated for 10m` → P2
- `Slow query count > 50/min` → P3
- `Disk usage > 85%` → P2
- `Long-running transaction > 5min` → P3

**Cache:**
- `Redis memory > 85%` → P3
- `Redis evictions spike` → P3
- `Cache hit ratio < expected baseline` → P4

**Infra:**
- `Pod restart count > 5 in 10m for any service` → P2
- `Cluster capacity < 20% headroom` → P2
- `Node count at autoscale max` → P2
- `Certificate expiring < 14 days` → P3

**Security (per `30`):**
- `Suspicious login spike` → P2
- `KMS access anomaly` → P1
- `Audit log integrity failure` → P1

**Business / SLO:**
- `Order checkout success rate < 95% for 15m` → P1
- `Payment provider error rate > 5%` → P2
- `Daily GMV drop > 30% vs 7d avg` → P2 (business)

### 8.4 SLO burn-rate alerts

Multi-window multi-burn-rate alerts (Google SRE Workbook ch 6):

For 99.9% monthly SLO (allowed: ~43 min downtime/month):
- 5% budget burned in 1 hour (14.4× burn rate) → P1 fast burn
- 10% burned in 6 hours → P2
- 20% burned in 1 day → P2 slow burn
- 30% burned in 3 days → P3
- Budget exhausted → freeze feature rollouts

### 8.5 Runbooks

Each alert links to runbook in `docs/runbooks/`:
- Symptoms
- Confirm + diagnose
- Mitigations (immediate)
- Permanent fixes
- Escalation path
- Customer comms template (if needed)

### 8.6 On-call rotation

- 7-day rotation (Mon 09:00 → Mon 09:00)
- Primary + secondary (backup)
- Mobile + laptop access required
- Compensated (CZ labor law compliant)
- Quarterly review of load (page volume, after-hours pages)
- Aim: < 2 wake-ups/week sustained → if higher, fix root causes

### 8.7 Pager fatigue prevention

- Alert hygiene quarterly
- Suppression rules for maintenance windows
- Aggregate similar alerts (alertgroup)
- Auto-resolve when condition clears
- Track MTTR + alert noise → improvement KPIs

---

## 9. SLA / SLO / SLI

### 9.1 Public SLA tiers

| Tier | Plan | Monthly uptime SLA | Credit |
|---|---|---|---|
| **Starter / Free** | Free / €29 | None (best effort) | None |
| **Growth** | €99 | 99.5% | 10% if missed |
| **Scale** | €299 | 99.9% | 25% if missed |
| **Enterprise** | Custom | 99.95% + custom MTTR | Custom |

### 9.2 SLI definitions

| SLI | Metric | Target (Scale tier) |
|---|---|---|
| **Storefront availability** | (200/300/400 responses) / total | ≥ 99.9% |
| **Storefront latency** | p95 LCP-equivalent server response | ≤ 500ms |
| **Admin API availability** | 2xx / (2xx + 5xx) | ≥ 99.9% |
| **Admin API latency** | p95 request duration | ≤ 800ms |
| **Checkout success rate** | successful_checkouts / attempts | ≥ 99% |
| **Payment success rate** | (excludes user-caused failures) | ≥ 95% (provider-dependent) |
| **Webhook delivery success** | (within 24h) | ≥ 99% |
| **Order processing latency** | order placed → fulfillment ready | ≤ 60s p95 |
| **Search latency** | p95 query | ≤ 200ms |
| **Background job latency** | enqueue → start (priority queues) | ≤ 5s p95 |
| **Email delivery latency** | enqueue → provider accept | ≤ 30s p95 |

### 9.3 Error budget

Per SLO. For 99.9%: 43 min/month or 0.1% requests can fail.

When budget burned >50%: alert. >90%: freeze new feature rollouts until budget recovers (next month).

### 9.4 SLO dashboards

- Real-time burn rate graphs
- Monthly burn trend
- Component contribution (which service caused most budget consumption)
- Per-tenant SLO (Enterprise tier — per-tenant SLA reporting)

### 9.5 Measurement boundaries

- Excluded from SLA: scheduled maintenance (announced 7d ahead)
- Excluded: customer-caused issues (invalid input, expired card)
- Excluded: third-party provider outages declared by provider (with proof)
- Included: everything else

### 9.6 SLA credit issuance

Auto-detected from monitoring:
- Monthly SLA computed automatically
- If missed: credit auto-applied to next invoice
- Customer notified

---

## 10. Disaster recovery

### 10.1 Objectives

| Tier | RPO | RTO |
|---|---|---|
| **Tier 1** (storefronts, checkout, API) | ≤ 5 min | ≤ 30 min |
| **Tier 2** (admin, search) | ≤ 5 min | ≤ 60 min |
| **Tier 3** (analytics, reporting) | ≤ 1 h | ≤ 4 h |
| **Tier 4** (archived data, audit log replay) | ≤ 24 h | Best effort |

### 10.2 DR architecture

**Active-warm:** primary Frankfurt active; Paris warm standby.

```
[Postgres primary Frankfurt]
   ↓ logical replication async
[Postgres standby Paris]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  (RPO 1-5 min)

[Redis Frankfurt]
   ↓ ElastiCache Global Datastore
[Redis Paris]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  (RPO ~1 min)

[S3 Frankfurt buckets]
   ↓ S3 Cross-Region Replication
[S3 Paris buckets]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  (RPO ~15 min)

[Kubernetes Frankfurt]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  active
[Kubernetes Paris]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  warm standby (smaller, scale up on failover)

[Cloudflare DNS/load balancer]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  routes to active region
```

### 10.3 Failover trigger

- Manual: PERSONA-PLATFORM-SRE initiates failover via runbook
- Automatic: Cloudflare health check + scripted promotion (Fáze 2; risk of split-brain in MVP — manual preferred)

### 10.4 Failover procedure (runbook RUN-OPS-001)

```
1. Confirm primary region down (not just intermittent)
2. Stop writes at primary (if possible)
3. Verify standby replication lag acceptable
4. Promote Postgres standby to primary
5. Update Cloudflare DNS / load balancer to point to Paris
6. Scale up Paris Kubernetes node groups
7. Verify functionality (smoke tests)
8. Status page update: customers notified
9. Post-incident: rebuild Frankfurt; flip back (or remain Paris-primary indefinitely)
```

### 10.5 Failback

After Frankfurt restored:
1. Catch-up replication to Frankfurt
2. Scheduled brief maintenance window
3. Stop writes Paris
4. Promote Frankfurt
5. Re-establish Paris as standby
6. Update Cloudflare back

### 10.6 DR testing

- Quarterly: failover drill (planned, low-risk service)
- Annually: full DR exercise (all services failover Frankfurt → Paris and back)
- Report: time to fail, RPO achieved, customer impact (zero ideally)

### 10.7 Backup restoration tests

Monthly: restore random backup to isolated cluster, verify data integrity, smoke tests.

### 10.8 Multi-cloud DR (Fáze 3+)

For enterprise customers requiring cloud-provider DR: GCP standby (europe-west3). Higher cost; opt-in.

---

## 11. Backups

### 11.1 What we back up

| Resource | Method | Frequency | Retention |
|---|---|---|---|
| **Postgres** | PITR + daily snapshot | continuous + nightly | 7d PITR, 30d daily, 1y monthly, 7y yearly |
| **Redis** | RDB snapshot + AOF | hourly RDB, AOF continuous | 7d |
| **Meilisearch** | snapshot to S3 | daily | 14d (reindex easy) |
| **S3 object storage** | versioning + Cross-Region Replication | continuous | 30d versions, 7y archive |
| **KMS keys** | per provider's resilience | provider-managed | per key kind |
| **Audit log** | dump to immutable S3 Glacier | hourly | 5 years (per `30 §8.7`) |
| **Configuration / Terraform state** | git + S3 versioned | continuous | indefinite |
| **Helm/Kubernetes manifests** | git | continuous | indefinite |
| **Secret manager (Vault/KMS aliases)** | provider replication | continuous | per provider |

### 11.2 Backup encryption

- Backups encrypted with separate KEK (not tenant KEK, per `30 §7.8`)
- Backup KEK escrowed (legal hold + business continuity)
- Restoration audit logged

### 11.3 Backup integrity

- Hash-checked on write
- Periodic restore tests
- Cross-region replication

### 11.4 Tenant-level backups (Fáze 2 enterprise feature)

For enterprise tenants: per-tenant export available on demand (full data dump encrypted with tenant key). Customer can restore to own systems for compliance.

### 11.5 Backup access control

- Restoration requires: SRE on-call + security approval
- Audit logged
- Dual control for production restore

---

## 12. Data models

### 12.1 `deployments`

```sql
CREATE TABLE deployments (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  pub_id TEXT NOT NULL,                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  -- dep_ NanoID
  service TEXT NOT NULL,                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      -- 'api-admin','storefront','workers-orders',...
  environment TEXT NOT NULL CHECK (environment IN ('preview','dev','staging','production','dr')),
  version TEXT NOT NULL,                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          -- semver or git sha
  git_commit_sha TEXT NOT NULL,
  image_digest TEXT NOT NULL,                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      -- sha256:...
  image_signature TEXT NOT NULL,                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  -- cosign signature
  -- rollout
  rollout_strategy TEXT NOT NULL CHECK (rollout_strategy IN ('canary','blue_green','recreate','rolling','one_shot')) DEFAULT 'canary',
  rollout_percent INTEGER NOT NULL DEFAULT 100,
  status TEXT NOT NULL CHECK (status IN ('queued','rolling_out','healthy','degraded','rolled_back','completed','failed')) DEFAULT 'queued',
  status_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- timing
  initiated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  initiated_by_user_id UUID NULL,
  initiated_by_kind TEXT NOT NULL CHECK (initiated_by_kind IN ('argocd_auto','manual','hotfix','rollback','emergency')) DEFAULT 'argocd_auto',
  rollout_started_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  rolled_back_at TIMESTAMPTZ NULL,
  rolled_back_to_deployment_id UUID NULL REFERENCES deployments(id),
  -- diagnostics
  slo_check_passed BOOLEAN NULL,
  smoke_tests_passed BOOLEAN NULL,
  failure_reason TEXT NULL,
  -- audit
  release_notes_md TEXT NULL,
  release_url TEXT NULL,                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  -- GitHub release link
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_deployments_pub_id UNIQUE (pub_id)
);

CREATE INDEX idx_deployments_service_env ON deployments (service, environment, initiated_at DESC);
CREATE INDEX idx_deployments_in_progress ON deployments (status, initiated_at DESC) WHERE status IN ('queued','rolling_out');
CREATE INDEX idx_deployments_git_sha ON deployments (git_commit_sha);
```

### 12.2 `feature_flags`

```sql
CREATE TABLE feature_flags (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  code TEXT NOT NULL,                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  -- 'new_checkout_flow','ai_copilot_enabled'
  name TEXT NOT NULL,
  description TEXT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('release','experiment','operational_toggle','permission','kill_switch')),
  default_value JSONB NOT NULL,                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          -- e.g., false or {"variant":"A"}
  targeting_rules JSONB NOT NULL DEFAULT '[]'::jsonb,                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          -- per-tenant, per-user, percentage
  enabled BOOLEAN NOT NULL DEFAULT false,
  -- lifecycle
  status TEXT NOT NULL CHECK (status IN ('planned','in_development','ramping','complete','retired')) DEFAULT 'planned',
  status_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cleanup_due_at TIMESTAMPTZ NULL,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user_id UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_feature_flags_code UNIQUE (code)
);

CREATE INDEX idx_feature_flags_status ON feature_flags (status) WHERE status IN ('ramping','complete') AND cleanup_due_at IS NOT NULL;
```

### 12.3 `maintenance_windows`

```sql
CREATE TABLE maintenance_windows (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  pub_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description_md TEXT NOT NULL,
  scope_kind TEXT NOT NULL CHECK (scope_kind IN ('platform_wide','region','service','tenant')),
  region TEXT NULL,
  service TEXT NULL,
  tenant_id UUID NULL,
  scheduled_start TIMESTAMPTZ NOT NULL,
  scheduled_end TIMESTAMPTZ NOT NULL,
  actual_start TIMESTAMPTZ NULL,
  actual_end TIMESTAMPTZ NULL,
  status TEXT NOT NULL CHECK (status IN ('scheduled','in_progress','completed','cancelled')) DEFAULT 'scheduled',
  impact_level TEXT NOT NULL CHECK (impact_level IN ('no_impact','partial_degradation','full_outage')),
  notification_sent_at TIMESTAMPTZ NULL,
  reminder_sent_at TIMESTAMPTZ NULL,
  status_page_published BOOLEAN NOT NULL DEFAULT false,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user_id UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_maintenance_windows_pub_id UNIQUE (pub_id)
);

CREATE INDEX idx_maintenance_windows_upcoming ON maintenance_windows (scheduled_start) WHERE status IN ('scheduled');
```

### 12.4 `slo_definitions` + `slo_burn_state`

```sql
CREATE TABLE slo_definitions (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  code TEXT NOT NULL,                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              -- 'storefront_availability','api_admin_latency'
  service TEXT NOT NULL,
  sli_query TEXT NOT NULL,                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  -- PromQL
  good_query TEXT NOT NULL,                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  -- requests/events counted as "good"
  total_query TEXT NOT NULL,
  target_percentage NUMERIC(6,4) NOT NULL,                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  -- e.g., 99.9000
  rolling_window TEXT NOT NULL CHECK (rolling_window IN ('1h','24h','7d','30d')) DEFAULT '30d',
  tier TEXT NOT NULL CHECK (tier IN ('tier1','tier2','tier3','tier4')),
  description TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_slo_definitions_code UNIQUE (code)
);

CREATE TABLE slo_burn_states (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  slo_id UUID NOT NULL REFERENCES slo_definitions(id) ON DELETE CASCADE,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_sli NUMERIC(6,4) NOT NULL,                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  -- e.g., 99.8700
  error_budget_consumed_percentage NUMERIC(6,4) NOT NULL,
  burn_rate_1h NUMERIC(6,2) NOT NULL,                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  -- multiplier vs sustainable rate
  burn_rate_6h NUMERIC(6,2) NOT NULL,
  alert_status TEXT NOT NULL CHECK (alert_status IN ('healthy','warning','critical','exhausted')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_slo_burn_states_slo ON slo_burn_states (slo_id, computed_at DESC);
```

### 12.5 `service_inventory`

```sql
CREATE TABLE service_inventory (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  code TEXT NOT NULL,                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  -- 'api-admin'
  display_name TEXT NOT NULL,
  description TEXT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('tier1','tier2','tier3','tier4')),
  language TEXT NOT NULL,                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  -- typescript
  repository_url TEXT NULL,
  runbook_url TEXT NULL,
  dashboard_url TEXT NULL,
  owner_team TEXT NULL,
  on_call_contact TEXT NULL,
  internal_endpoints TEXT[] NULL,
  external_dependencies TEXT[] NULL,                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  -- ['stripe','pohoda','mailchimp']
  data_classification_handled TEXT[] NULL,                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  -- ['restricted','confidential','internal','public']
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_service_inventory_code UNIQUE (code)
);
```

### 12.6 `cost_attribution_records`

```sql
CREATE TABLE cost_attribution_records (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  period_date DATE NOT NULL,
  scope_kind TEXT NOT NULL CHECK (scope_kind IN ('platform','service','tenant','environment')),
  scope_id TEXT NOT NULL,                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  -- tenant_pub_id or service code
  cost_kind TEXT NOT NULL CHECK (cost_kind IN ('compute','storage','network','data_transfer','managed_service','third_party_api','support','observability','other')),
  amount_cents BIGINT NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  vendor TEXT NOT NULL,                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  -- 'aws','cloudflare','anthropic','sendgrid'
  details JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
) PARTITION BY RANGE (period_date);

CREATE INDEX idx_cost_attribution_scope ON cost_attribution_records (scope_kind, scope_id, period_date DESC);
CREATE INDEX idx_cost_attribution_vendor ON cost_attribution_records (vendor, period_date DESC);
```

### 12.7 `status_page_incidents`

```sql
CREATE TABLE status_page_incidents (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  pub_id TEXT NOT NULL,                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  -- spi_ NanoID
  related_incident_id UUID NULL,                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  -- → security_incidents.id if linked
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('investigating','identified','monitoring','resolved')) DEFAULT 'investigating',
  impact TEXT NOT NULL CHECK (impact IN ('none','minor','major','critical')),
  affected_services TEXT[] NULL,
  affected_regions TEXT[] NULL,
  -- timing
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  identified_at TIMESTAMPTZ NULL,
  monitoring_at TIMESTAMPTZ NULL,
  resolved_at TIMESTAMPTZ NULL,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user_id UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_status_page_incidents_pub_id UNIQUE (pub_id)
);

CREATE TABLE status_page_incident_updates (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  incident_id UUID NOT NULL REFERENCES status_page_incidents(id) ON DELETE CASCADE,
  body_md TEXT NOT NULL,
  status_at_time TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  posted_by_user_id UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_status_page_incidents_active ON status_page_incidents (status, started_at DESC) WHERE status NOT IN ('resolved');
CREATE INDEX idx_status_page_incident_updates_incident ON status_page_incident_updates (incident_id, occurred_at);
```

### 12.8 Vztahy

```
deployments (1)──(0..1) deployments                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              [rolled_back_to_deployment_id]
deployments (N)──(1) service_inventory                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  [via service code]
slo_definitions (1)──(N) slo_burn_states
status_page_incidents (1)──(N) status_page_incident_updates
status_page_incidents (0..1)──(1) security_incidents                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  [related_incident_id]
maintenance_windows (N)──(0..1) tenants                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  [tenant-scoped]
cost_attribution_records (N)──(1) service_inventory                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          [via service code in scope_id when scope_kind='service']
cost_attribution_records (N)──(1) tenants                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      [scope_kind='tenant']
```

---

## 13. Business rules

### RULE-OPS-001: Trunk-based + main always deployable

`main` branch must always be deployable. Broken main → P1 incident, revert immediately.

### RULE-OPS-002: All deploys via pipeline

No manual deploys to production. Only via ArgoCD synced from git. Manual override requires emergency change + 2-person approval + audit log.

### RULE-OPS-003: Signed images only

Per `30 §RULE-SEC-026`. Cosign signatures required; admission controller rejects unsigned.

### RULE-OPS-004: Backward-compatible migrations

Migrations must be backward-compatible (per `5.7`). Code can run against new schema OR old schema during rollout window.

### RULE-OPS-005: Friday freeze

No production deploys after Thursday 16:00 UTC unless emergency. Sufficient time for issues to surface during business hours.

### RULE-OPS-006: Canary auto-rollback

If SLO violation during canary phase (error rate, latency p95 burn): auto-rollback within 5 minutes. Alert on-call.

### RULE-OPS-007: Feature flag default

New features land behind flag, default off. Ramped after merge. Cleanup PR removes flag once stable (30 days post-100%).

### RULE-OPS-008: Flag cleanup SLA

Flags with `status='complete'` for > 90 days flagged for cleanup. Tech debt review monthly.

### RULE-OPS-009: Kill-switch always available

Each high-risk feature has kill-switch flag. SRE can disable feature without redeploy via Unleash UI.

### RULE-OPS-010: Maintenance window 7-day notice

Customer-impacting maintenance announced 7 days prior via status page + email (Scale/Enterprise tiers). Best effort for Starter.

### RULE-OPS-011: SLO error budget enforcement

If error budget consumption > 90% for 30d window: freeze new feature rollouts for service until budget recovers next window. Bug fixes + security patches allowed.

### RULE-OPS-012: On-call response SLA

- Page acknowledged within 5 min
- SEV-1 mitigation started within 15 min
- SEV-2 within 30 min
- SEV-3 next business day

### RULE-OPS-013: Runbook required for every alert

Each alert links to runbook with: symptoms, diagnosis, mitigation, escalation. Alerts without runbooks not allowed in production.

### RULE-OPS-014: Post-incident review mandatory

Every SEV-1/SEV-2 incident: post-mortem within 5 business days. Blameless. Action items tracked.

### RULE-OPS-015: Quarterly DR drill

Failover Frankfurt → Paris quarterly (planned, low-risk service). Annually: full DR.

### RULE-OPS-016: Monthly backup restoration test

Random backup restored to isolated cluster, verified. Failures investigated immediately.

### RULE-OPS-017: Capacity headroom 20%

Cluster sized so peak utilization < 80%. Autoscaling provides additional 20% burst. Below 20% headroom → P2 alert.

### RULE-OPS-018: All services in service_inventory

Every running service must have entry. Includes owner, on-call, runbook, dashboard. Audited quarterly.

### RULE-OPS-019: Observability mandatory

Every service emits OpenTelemetry traces + metrics + logs. Missing instrumentation blocks deploy (CI check).

### RULE-OPS-020: PII redaction in logs

Logger middleware auto-strips per `30 §RULE-SEC-025`. Engineers cannot bypass without security review.

### RULE-OPS-021: Cost attribution per tenant (Fáze 2)

Compute/storage costs attributable to tenants. Heavy tenants identifiable. Enterprise tier customers get cost showback in admin.

### RULE-OPS-022: Budget alerts

Per service + per tenant + platform-wide. Alerts at 50%/75%/90%/100% of monthly budget.

### RULE-OPS-023: Right-sizing review quarterly

Over-provisioned services identified. Recommendations to ops team. Implement via Helm chart updates.

### RULE-OPS-024: Spot instances for interruptible workloads

Workers (analytics, search indexing) on spot 30%. Stateful + tier-1 always on-demand.

### RULE-OPS-025: Reserved capacity for baseline

Steady-state production: 60-70% Reserved Instances + 30-40% on-demand for elasticity.

### RULE-OPS-026: Status page accuracy

Status page reflects actual service health. Auto-updated from monitoring; manual override SRE-only.

### RULE-OPS-027: Public retrospectives

Major incidents: public retrospective within 30 days. Transparency builds trust.

### RULE-OPS-028: Tenant data residency

Tenant data primary EU (Frankfurt or Paris). No transit to non-EU regions without explicit DPA. Per `30 §RULE-SEC-031`.

### RULE-OPS-029: Multi-AZ for production

All stateful services Multi-AZ. Single-AZ → P2 alert + remediation.

### RULE-OPS-030: Chaos engineering quarterly

Quarterly game day: simulated failures (pod kill, network partition, DB failover, region outage). Findings → resilience improvements.

### RULE-OPS-031: Image vulnerability gating

Per `30 §12.x`. Critical / High vulns block deploy unless suppressed with security review approval.

### RULE-OPS-032: Dependency lockfile committed

`pnpm-lock.yaml` checked in + verified in CI. Reproducible builds.

### RULE-OPS-033: SBOM published per release

CycloneDX SBOM generated + signed + attached to GitHub Release. Customer transparency.

### RULE-OPS-034: Egress monitored + allowlisted

Server outbound HTTP via egress proxy with allowlist. Anomalies logged + reviewed (per `30 §10.6`).

### RULE-OPS-035: Configuration in code (GitOps)

All infrastructure + Kubernetes + ArgoCD applications declared in git. No `kubectl apply` against prod from laptops.

### RULE-OPS-036: Secrets never in repo

Per `30 §7.7`. Secrets in KMS / Vault, referenced by environment-variable injection at runtime.

### RULE-OPS-037: Multi-region for tier-1 services

Tier-1 services must run in primary + DR region. Single-region tier-1 → P2 alert.

### RULE-OPS-038: Connection pooling enforced

DB connections via PgBouncer transaction-mode pool. Direct connections discouraged.

### RULE-OPS-039: Query timeout enforced

Default 30s API request timeout. Long-running queries via background jobs.

### RULE-OPS-040: Long-running migrations off-peak

Schema migrations affecting tables > 100M rows: scheduled off-peak window. Customer notification 7 days ahead if maintenance window required.

### RULE-OPS-041: Health endpoints standard

Every service exposes:
- `/health/live` — liveness (process up)
- `/health/ready` — readiness (deps healthy)
- `/health/startup` — startup (initial load complete)

Kubernetes uses these.

### RULE-OPS-042: Graceful shutdown 30s

Services drain in-flight requests + workers finish in-flight jobs in 30s grace period. After: SIGKILL. Connection pool closes cleanly.

### RULE-OPS-043: Backpressure + circuit breakers

Outbound HTTP calls have circuit breakers. Inbound: rate limiting + queue depth caps.

### RULE-OPS-044: Tracing sampling tail-based

100% errors sampled; 1% successes sampled. Tail-based sampling via OTel Collector.

### RULE-OPS-045: Log retention enforced

Standard logs: 30d hot, 1y cold. Audit log per `30 §8.7` separately. After: deleted.

### RULE-OPS-046: Cardinality control

Prometheus labels limited (no high-cardinality user_id / order_id as label). Use trace ID + log correlation instead.

### RULE-OPS-047: Service dependency mapping

Service graph maintained (auto-discovered from traces + manual annotation). Used for change impact analysis + DR planning.

### RULE-OPS-048: Cron jobs in BullMQ

Scheduled jobs via BullMQ `repeat` (not K8s CronJob unless explicitly needed). Single source of truth for scheduled work.

### RULE-OPS-049: Dead-letter queue review

Each queue's DLQ reviewed weekly. Persistent failures → bug.

### RULE-OPS-050: AI cost monitoring (per 33-ai-features.md)

AI token spend tracked per tenant. Budget alerts. Per `33` cross-ref.

---

## 14. REST API endpoints

### 14.1 Status page (public)

```
GET    /api/{date}/status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  # current overall status
GET    /api/{date}/status/services                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              # per service
GET    /api/{date}/status/incidents                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                # past + active
GET    /api/{date}/status/incidents/{id}
GET    /api/{date}/status/maintenance                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                # upcoming + recent
GET    /api/{date}/status/rss                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          # feed
```

### 14.2 Deployments (internal)

```
GET    /api/{date}/ops/deployments
GET    /api/{date}/ops/deployments/{id}
POST   /api/{date}/ops/deployments                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                # internal — ArgoCD callback
POST   /api/{date}/ops/deployments/{id}:rollback
GET    /api/{date}/ops/deployments/recent?service=...&env=...
GET    /api/{date}/ops/deployments/active                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  # rolling out now
```

### 14.3 Feature flags

```
GET    /api/{date}/ops/feature-flags
POST   /api/{date}/ops/feature-flags
PATCH  /api/{date}/ops/feature-flags/{code}
DELETE /api/{date}/ops/feature-flags/{code}
POST   /api/{date}/ops/feature-flags/{code}:kill                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              # emergency disable
POST   /api/{date}/ops/feature-flags/{code}:evaluate                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                # body: { context: { tenant_id, user_id, ... } }
GET    /api/{date}/ops/feature-flags/cleanup-due                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  # flags ready to remove
```

### 14.4 Maintenance windows

```
GET    /api/{date}/ops/maintenance-windows                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          # upcoming + past
POST   /api/{date}/ops/maintenance-windows                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            # schedule
PATCH  /api/{date}/ops/maintenance-windows/{id}
POST   /api/{date}/ops/maintenance-windows/{id}:cancel
POST   /api/{date}/ops/maintenance-windows/{id}:start
POST   /api/{date}/ops/maintenance-windows/{id}:complete
```

### 14.5 SLO

```
GET    /api/{date}/ops/slos
GET    /api/{date}/ops/slos/{code}
GET    /api/{date}/ops/slos/{code}/burn-state
GET    /api/{date}/ops/slos/{code}/history?period=30d
GET    /api/{date}/ops/slos/dashboard
```

### 14.6 Service inventory

```
GET    /api/{date}/ops/services
GET    /api/{date}/ops/services/{code}
POST   /api/{date}/ops/services
PATCH  /api/{date}/ops/services/{code}
GET    /api/{date}/ops/services/{code}/dependencies                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            # service graph
```

### 14.7 Cost + FinOps

```
GET    /api/{date}/ops/costs/overview
GET    /api/{date}/ops/costs/by-service?period=...
GET    /api/{date}/ops/costs/by-tenant?period=...                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                # Fáze 2 enterprise
GET    /api/{date}/ops/costs/by-vendor
GET    /api/{date}/ops/costs/anomalies                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  # auto-detected
GET    /api/{date}/ops/budgets
POST   /api/{date}/ops/budgets
PATCH  /api/{date}/ops/budgets/{id}
```

### 14.8 DR + backup

```
GET    /api/{date}/ops/backups/latest                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          # per resource
POST   /api/{date}/ops/backups:trigger-snapshot                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                # manual snapshot
POST   /api/{date}/ops/restore:request                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            # body: { resource, point_in_time, target_env }
GET    /api/{date}/ops/restore/{id}
GET    /api/{date}/ops/dr/status
POST   /api/{date}/ops/dr:initiate-failover                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              # restricted SRE only
GET    /api/{date}/ops/dr/drills
```

### 14.9 Capacity + auto-scaling

```
GET    /api/{date}/ops/capacity/clusters
GET    /api/{date}/ops/capacity/services/{code}/utilization
GET    /api/{date}/ops/autoscaling/recommendations
POST   /api/{date}/ops/scaling:adjust                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          # body: { service, min, max, target_cpu }
```

### 14.10 Example: Trigger rollback

```http
POST /api/2026-05-20/ops/deployments/dep_aB:rollback HTTP/1.1
Authorization: Bearer <sre>

{
  "reason": "p99 latency spiked 3x; SLO burn fast",
  "target_deployment_id": "dep_xY"
}
```

```jsonc
HTTP/1.1 202 Accepted

{
  "data": {
    "rollback_initiated_at": "2026-05-20T15:30:00Z",
    "target_deployment_id": "dep_xY",
    "estimated_complete_at": "2026-05-20T15:35:00Z"
  }
}
```

### 14.11 Example: Evaluate feature flag

```http
POST /api/2026-05-20/ops/feature-flags/new_checkout_flow:evaluate HTTP/1.1

{
  "context": {
    "tenant_id": "tnt_aB",
    "user_id": "usr_xY",
    "country_code": "CZ"
  }
}
```

```jsonc
HTTP/1.1 200 OK

{
  "data": {
    "flag": "new_checkout_flow",
    "value": true,
    "matched_rule": "rule_3_country_cz_tenant_subset",
    "evaluation_id": "fle_aB"
  }
}
```

### 14.12 Example: Status page snapshot

```http
GET /api/2026-05-20/status HTTP/1.1
```

```jsonc
HTTP/1.1 200 OK
Cache-Control: max-age=30

{
  "data": {
    "overall_status": "operational",                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          # operational / degraded / partial_outage / major_outage / maintenance
    "components": [
      { "code": "storefront", "status": "operational" },
      { "code": "admin", "status": "operational" },
      { "code": "checkout", "status": "operational" },
      { "code": "search", "status": "degraded", "since": "2026-05-20T14:00:00Z" },
      { "code": "webhooks", "status": "operational" }
    ],
    "active_incidents": [
      {
        "id": "spi_aB",
        "title": "Elevated search latency in EU",
        "status": "monitoring",
        "impact": "minor",
        "started_at": "2026-05-20T14:00:00Z",
        "updates_count": 3
      }
    ],
    "upcoming_maintenance": [
      {
        "id": "mw_aB",
        "title": "Database minor version upgrade",
        "scheduled_start": "2026-05-23T02:00:00Z",
        "scheduled_end": "2026-05-23T02:30:00Z",
        "impact_level": "no_impact"
      }
    ]
  }
}
```

---

## 15. GraphQL schema

```graphql
type Deployment implements Node {
  id: ID!
  pubId: String!
  service: String!
  environment: DeploymentEnvironment!
  version: String!
  gitCommitSha: String!
  imageDigest: String!
  rolloutStrategy: RolloutStrategy!
  rolloutPercent: Int!
  status: DeploymentStatus!
  initiatedBy: User
  initiatedByKind: DeploymentInitiator!
  initiatedAt: DateTime!
  rolloutStartedAt: DateTime
  completedAt: DateTime
  rolledBackAt: DateTime
  rolledBackTo: Deployment
  sloCheckPassed: Boolean
  smokeTestsPassed: Boolean
  failureReason: String
  releaseNotesMd: String
  releaseUrl: String
}

enum DeploymentEnvironment { PREVIEW DEV STAGING PRODUCTION DR }
enum RolloutStrategy { CANARY BLUE_GREEN RECREATE ROLLING ONE_SHOT }
enum DeploymentStatus { QUEUED ROLLING_OUT HEALTHY DEGRADED ROLLED_BACK COMPLETED FAILED }
enum DeploymentInitiator { ARGOCD_AUTO MANUAL HOTFIX ROLLBACK EMERGENCY }

type FeatureFlag {
  id: ID!
  code: String!
  name: String!
  description: String
  kind: FeatureFlagKind!
  defaultValue: JSON!
  targetingRules: JSON!
  enabled: Boolean!
  status: FeatureFlagStatus!
  cleanupDueAt: DateTime
  createdAt: DateTime!
  updatedAt: DateTime!
}

enum FeatureFlagKind { RELEASE EXPERIMENT OPERATIONAL_TOGGLE PERMISSION KILL_SWITCH }
enum FeatureFlagStatus { PLANNED IN_DEVELOPMENT RAMPING COMPLETE RETIRED }

type SLODefinition {
  id: ID!
  code: String!
  service: String!
  targetPercentage: Float!
  rollingWindow: SLORollingWindow!
  tier: ServiceTier!
  description: String
  isActive: Boolean!
  currentBurnState: SLOBurnState!
  burnHistory(period: PeriodInput!): [SLOBurnState!]!
}

enum SLORollingWindow { ONE_HOUR TWENTY_FOUR_HOURS SEVEN_DAYS THIRTY_DAYS }
enum ServiceTier { TIER1 TIER2 TIER3 TIER4 }

type SLOBurnState {
  slo: SLODefinition!
  computedAt: DateTime!
  currentSli: Float!
  errorBudgetConsumedPercentage: Float!
  burnRate1h: Float!
  burnRate6h: Float!
  alertStatus: SLOAlertStatus!
}

enum SLOAlertStatus { HEALTHY WARNING CRITICAL EXHAUSTED }

type MaintenanceWindow implements Node {
  id: ID!
  pubId: String!
  title: String!
  descriptionMd: String!
  scopeKind: MaintenanceScopeKind!
  scheduledStart: DateTime!
  scheduledEnd: DateTime!
  actualStart: DateTime
  actualEnd: DateTime
  status: MaintenanceStatus!
  impactLevel: MaintenanceImpact!
}

enum MaintenanceScopeKind { PLATFORM_WIDE REGION SERVICE TENANT }
enum MaintenanceStatus { SCHEDULED IN_PROGRESS COMPLETED CANCELLED }
enum MaintenanceImpact { NO_IMPACT PARTIAL_DEGRADATION FULL_OUTAGE }

type ServiceInventoryEntry {
  id: ID!
  code: String!
  displayName: String!
  description: String
  tier: ServiceTier!
  language: String!
  repositoryUrl: String
  runbookUrl: String
  dashboardUrl: String
  ownerTeam: String
  onCallContact: String
  internalEndpoints: [String!]
  externalDependencies: [String!]
  dataClassificationHandled: [String!]
}

type StatusPageIncident implements Node {
  id: ID!
  pubId: String!
  title: String!
  status: StatusPageIncidentStatus!
  impact: StatusPageIncidentImpact!
  affectedServices: [String!]
  affectedRegions: [String!]
  startedAt: DateTime!
  identifiedAt: DateTime
  monitoringAt: DateTime
  resolvedAt: DateTime
  updates: [StatusPageIncidentUpdate!]!
  relatedSecurityIncident: SecurityIncident
}

enum StatusPageIncidentStatus { INVESTIGATING IDENTIFIED MONITORING RESOLVED }
enum StatusPageIncidentImpact { NONE MINOR MAJOR CRITICAL }

type StatusPageIncidentUpdate {
  id: ID!
  bodyMd: String!
  statusAtTime: String!
  occurredAt: DateTime!
}

type CostAttribution {
  scopeKind: CostScopeKind!
  scopeId: String!
  period: String!
  totals: [CostByKind!]!
  totalCents: Int!
  currency: String!
}

enum CostScopeKind { PLATFORM SERVICE TENANT ENVIRONMENT }

type CostByKind {
  costKind: String!
  vendor: String!
  amountCents: Int!
}

extend type Query {
  # Public status
  statusOverview: StatusOverview!
  statusServices: [StatusComponent!]!
  statusIncidents(active: Boolean = true, first: Int, after: String): StatusPageIncidentConnection!
  statusIncident(id: ID, pubId: String): StatusPageIncident
  upcomingMaintenance: [MaintenanceWindow!]!

  # Internal ops
  deployments(filter: DeploymentFilter): [Deployment!]! @auth(requires: PERM_OPS_DEPLOY_VIEW)
  deployment(id: ID!): Deployment
  activeDeployments: [Deployment!]!

  featureFlags(filter: FeatureFlagFilter): [FeatureFlag!]! @auth(requires: PERM_OPS_FEATURE_FLAGS_VIEW)
  featureFlag(code: String!): FeatureFlag
  evaluateFeatureFlag(code: String!, context: JSON): FeatureFlagEvaluation!

  slos: [SLODefinition!]! @auth(requires: PERM_OPS_SLO_VIEW)
  slo(code: String!): SLODefinition

  maintenanceWindows(status: [MaintenanceStatus!]): [MaintenanceWindow!]! @auth(requires: PERM_OPS_MAINTENANCE_VIEW)
  maintenanceWindow(id: ID!): MaintenanceWindow

  serviceInventory: [ServiceInventoryEntry!]! @auth(requires: PERM_OPS_INVENTORY_VIEW)
  serviceInventoryEntry(code: String!): ServiceInventoryEntry

  costOverview(period: PeriodInput!): CostAttribution! @auth(requires: PERM_OPS_COSTS_VIEW)
  costByService(period: PeriodInput!): [CostAttribution!]!
  costByTenant(period: PeriodInput!): [CostAttribution!]!
  costByVendor(period: PeriodInput!): [CostAttribution!]!
  costAnomalies: [CostAnomaly!]!
}

type StatusOverview {
  overallStatus: OverallStatus!
  components: [StatusComponent!]!
  activeIncidents: [StatusPageIncident!]!
  upcomingMaintenance: [MaintenanceWindow!]!
}

enum OverallStatus { OPERATIONAL DEGRADED PARTIAL_OUTAGE MAJOR_OUTAGE MAINTENANCE }

type StatusComponent {
  code: String!
  displayName: String!
  status: ComponentStatus!
  since: DateTime
}

enum ComponentStatus { OPERATIONAL DEGRADED PARTIAL_OUTAGE MAJOR_OUTAGE MAINTENANCE }

type FeatureFlagEvaluation {
  flag: String!
  value: JSON!
  matchedRule: String
  evaluationId: ID!
}

extend type Mutation {
  # Deployments (internal)
  rollbackDeployment(id: ID!, reason: String!, targetDeploymentId: ID): Deployment! @auth(requires: PERM_OPS_DEPLOY_MANAGE)

  # Feature flags
  createFeatureFlag(input: FeatureFlagInput!): FeatureFlag! @auth(requires: PERM_OPS_FEATURE_FLAGS_MANAGE)
  updateFeatureFlag(code: String!, input: FeatureFlagInput!): FeatureFlag! @auth(requires: PERM_OPS_FEATURE_FLAGS_MANAGE)
  killFeatureFlag(code: String!, reason: String!): FeatureFlag! @auth(requires: PERM_OPS_FEATURE_FLAGS_MANAGE)
  deleteFeatureFlag(code: String!): DeletePayload! @auth(requires: PERM_OPS_FEATURE_FLAGS_MANAGE)

  # Maintenance
  scheduleMaintenance(input: ScheduleMaintenanceInput!): MaintenanceWindow! @auth(requires: PERM_OPS_MAINTENANCE_MANAGE)
  updateMaintenance(id: ID!, input: UpdateMaintenanceInput!): MaintenanceWindow!
  cancelMaintenance(id: ID!, reason: String): MaintenanceWindow!
  startMaintenance(id: ID!): MaintenanceWindow!
  completeMaintenance(id: ID!): MaintenanceWindow!

  # Status page
  publishStatusIncident(input: PublishStatusIncidentInput!): StatusPageIncident! @auth(requires: PERM_OPS_STATUS_MANAGE)
  updateStatusIncident(id: ID!, input: UpdateStatusIncidentInput!): StatusPageIncident!
  addStatusIncidentUpdate(incidentId: ID!, bodyMd: String!, status: String!): StatusPageIncidentUpdate!
  resolveStatusIncident(id: ID!): StatusPageIncident!

  # DR / failover (highly restricted)
  initiateDrFailover(targetRegion: String!, reason: String!): MutationPayload! @auth(requires: PERM_OPS_DR_FAILOVER)

  # Service inventory
  upsertServiceInventoryEntry(input: ServiceInventoryEntryInput!): ServiceInventoryEntry! @auth(requires: PERM_OPS_INVENTORY_MANAGE)
}
```

---

## 16. Events

| Build-spec ID | Wire | Payload |
|---|---|---|
| `EVENT-OPS-DEPLOYMENT-INITIATED` | `ops.deployment_initiated` | `{ deployment }` |
| `EVENT-OPS-DEPLOYMENT-CANARY-START` | `ops.deployment_canary_start` | `{ deployment, percent }` |
| `EVENT-OPS-DEPLOYMENT-CANARY-PROGRESS` | `ops.deployment_canary_progress` | `{ deployment, percent }` |
| `EVENT-OPS-DEPLOYMENT-COMPLETED` | `ops.deployment_completed` | `{ deployment, duration_ms }` |
| `EVENT-OPS-DEPLOYMENT-FAILED` | `ops.deployment_failed` | `{ deployment, reason }` |
| `EVENT-OPS-DEPLOYMENT-ROLLED-BACK` | `ops.deployment_rolled_back` | `{ deployment, target_deployment }` |
| `EVENT-OPS-FEATURE-FLAG-CHANGED` | `ops.feature_flag_changed` | `{ flag, previous, new }` |
| `EVENT-OPS-FEATURE-FLAG-KILLED` | `ops.feature_flag_killed` | `{ flag, reason }` |
| `EVENT-OPS-MAINTENANCE-SCHEDULED` | `ops.maintenance_scheduled` | `{ window }` |
| `EVENT-OPS-MAINTENANCE-STARTED` | `ops.maintenance_started` | `{ window }` |
| `EVENT-OPS-MAINTENANCE-COMPLETED` | `ops.maintenance_completed` | `{ window, duration }` |
| `EVENT-OPS-MAINTENANCE-CANCELLED` | `ops.maintenance_cancelled` | `{ window, reason }` |
| `EVENT-OPS-SLO-BURN-FAST` | `ops.slo_burn_fast` | `{ slo, current_burn_rate }` |
| `EVENT-OPS-SLO-BUDGET-EXHAUSTED` | `ops.slo_budget_exhausted` | `{ slo }` (freeze feature rollouts) |
| `EVENT-OPS-SLO-BUDGET-RECOVERED` | `ops.slo_budget_recovered` | `{ slo }` |
| `EVENT-OPS-AUTOSCALE-UP` | `ops.autoscale_up` | `{ service, from, to }` |
| `EVENT-OPS-AUTOSCALE-DOWN` | `ops.autoscale_down` | `{ service, from, to }` |
| `EVENT-OPS-NODE-FAILURE` | `ops.node_failure` | `{ node, region }` |
| `EVENT-OPS-AZ-DEGRADATION` | `ops.az_degradation` | `{ region, az }` |
| `EVENT-OPS-DR-FAILOVER-INITIATED` | `ops.dr_failover_initiated` | `{ from_region, to_region }` |
| `EVENT-OPS-DR-FAILOVER-COMPLETED` | `ops.dr_failover_completed` | `{ region, rpo_seconds, rto_seconds }` |
| `EVENT-OPS-BACKUP-SUCCEEDED` | `ops.backup_succeeded` | `{ resource, snapshot_id }` |
| `EVENT-OPS-BACKUP-FAILED` | `ops.backup_failed` | `{ resource, error }` |
| `EVENT-OPS-RESTORE-REQUESTED` | `ops.restore_requested` | `{ request }` |
| `EVENT-OPS-RESTORE-COMPLETED` | `ops.restore_completed` | `{ request, duration_seconds }` |
| `EVENT-OPS-COST-ANOMALY-DETECTED` | `ops.cost_anomaly_detected` | `{ scope, baseline, current, deviation_percent }` |
| `EVENT-OPS-BUDGET-ALERT` | `ops.budget_alert` | `{ budget, consumed_percent }` |
| `EVENT-OPS-CAPACITY-LOW` | `ops.capacity_low` | `{ cluster, headroom_percent }` |
| `EVENT-OPS-CHAOS-EXPERIMENT-STARTED` | `ops.chaos_experiment_started` | `{ experiment }` |
| `EVENT-OPS-CHAOS-EXPERIMENT-FINISHED` | `ops.chaos_experiment_finished` | `{ experiment, findings }` |
| `EVENT-OPS-STATUS-PAGE-INCIDENT-PUBLISHED` | `ops.status_page_incident_published` | `{ incident }` |
| `EVENT-OPS-STATUS-PAGE-INCIDENT-RESOLVED` | `ops.status_page_incident_resolved` | `{ incident, duration_seconds }` |
| `EVENT-OPS-CERTIFICATE-EXPIRING-SOON` | `ops.certificate_expiring_soon` | `{ cert, days_remaining }` |

**Konzumenti:**
- PagerDuty / on-call notifications
- Status page (auto-update)
- Customer email (maintenance, major incidents)
- Slack alerts (#alerts-platform, #alerts-customer-impact)
- Webhooks (subscribed via `28` — e.g., for partner SLO reporting)
- Cost dashboards
- Compliance evidence

---

## 17. Background jobs

| Job | Trigger | Queue | Frequency |
|---|---|---|---|
| `JOB-COMPUTE-SLO-BURN-STATES` | scheduled | `ops` | Every 1 min |
| `JOB-DETECT-SLO-FAST-BURN` | EVENT-OPS-SLO-BURN-FAST | `ops` | On-demand |
| `JOB-FREEZE-FEATURE-ROLLOUTS-ON-BUDGET-EXHAUSTION` | EVENT-OPS-SLO-BUDGET-EXHAUSTED | `ops` | On-demand |
| `JOB-AUTO-ROLLBACK-CANARY-ON-SLO-VIOLATION` | EVENT-OPS-DEPLOYMENT-CANARY-PROGRESS + SLO check | `ops` | On-demand |
| `JOB-AGGREGATE-COST-RECORDS` | scheduled | `finops` | Daily |
| `JOB-DETECT-COST-ANOMALIES` | scheduled | `finops` | Daily |
| `JOB-SEND-BUDGET-ALERTS` | budget threshold cross | `notifications` | On-demand |
| `JOB-COMPUTE-MONTHLY-SLA-CREDITS` | scheduled | `billing` | Monthly |
| `JOB-PUBLISH-STATUS-PAGE-AUTO-UPDATES` | EVENT-OPS-STATUS-PAGE-* | `ops` | Continuous |
| `JOB-SEND-MAINTENANCE-NOTIFICATIONS` | scheduled (7d/24h before) | `notifications` | On-demand |
| `JOB-CHECK-CERTIFICATE-EXPIRATIONS` | scheduled | `ops` | Daily |
| `JOB-CLEANUP-PREVIEW-ENVIRONMENTS` | scheduled | `ops` | Hourly (close PRs older than 7d) |
| `JOB-PROBE-FAILED-DEPLOYMENT-METRICS` | scheduled | `ops` | Every 5 min (during canary windows) |
| `JOB-SCHEDULE-DR-DRILL` | scheduled | `ops` | Quarterly |
| `JOB-EXECUTE-RESTORE-TEST` | scheduled | `ops` | Monthly |
| `JOB-VERIFY-BACKUP-INTEGRITY` | EVENT-OPS-BACKUP-SUCCEEDED | `ops` | On-demand (sample-based) |
| `JOB-DETECT-FEATURE-FLAG-CLEANUP-DUE` | scheduled | `ops` | Weekly |
| `JOB-DETECT-CAPACITY-HEADROOM` | scheduled | `ops` | Every 5 min |
| `JOB-COMPUTE-AUTOSCALING-RECOMMENDATIONS` | scheduled | `ops` | Daily |
| `JOB-DETECT-OBSOLETE-DEPLOYMENTS` | scheduled | `ops` | Weekly (old preview env / unused service) |
| `JOB-CHAOS-EXPERIMENT-RUN` | scheduled | `ops` | Quarterly |
| `JOB-SBOM-GENERATE` | release tag | `release` | Per release |
| `JOB-RECONCILE-SERVICE-INVENTORY` | scheduled | `ops` | Weekly (auto-discover services vs declared) |

---

## 18. UI/UX flows

### FLOW-OPS-001: Engineer pushes PR → preview env

```
[Engineer pushes feature branch + opens PR]
        ↓
[GitHub Actions: lint + tests + scan-security + build]
   - All passing → image signed + pushed to ECR
        ↓
[ArgoCD: spawns preview namespace + seeded DB]
   - preview env URL: pr-1234.preview.shopio.dev
        ↓
[Bot comments on PR with preview URL + dashboard link]
        ↓
[Reviewer tests in browser, approves]
        ↓
[Merge to main → preview env auto-destroyed in 1 hour]
[ArgoCD auto-deploys to staging]
```

### FLOW-OPS-002: Canary deployment + auto-rollback

```
[ArgoCD: new deployment for service api-admin to production]
   - Status: rolling_out, percent=5
   - 1-3 pods running new version
        ↓
[30 min canary observation]
   - Metrics scraped: error rate, p95 latency, success rate
        ↓
[SLO check]
   - error rate < 1% ✓
   - p95 latency within 10% of baseline ✓
   - success rate > 99% ✓
        ↓
[Progress: percent=25 → wait 30min → percent=50 → wait → percent=100]
        ↓
[Completed; old version removed; release notes published]
```

If SLO violation:
```
[Canary phase 25%]
   - p95 latency spiked 3× (250ms → 750ms)
        ↓
[JOB-AUTO-ROLLBACK-CANARY-ON-SLO-VIOLATION triggered]
   - ArgoCD reverts to previous revision
   - Status: rolled_back
        ↓
[PagerDuty page to on-call]
   - Investigation
   - Status page may update if customer-visible
        ↓
[Post-mortem within 5 business days]
```

### FLOW-OPS-003: On-call incident response

```
[PagerDuty page at 03:14 — "Storefront 5xx > 5%"]
        ↓
[On-call acknowledges within 5 min]
        ↓
[Open runbook RUN-OPS-STOREFRONT-5XX]
   - Step 1: Check Grafana dashboard "Storefront overview"
   - Step 2: Identify affected service / region
   - Step 3: Check recent deploys
        ↓
[Diagnosis: Latest deploy of api-storefront introduced query regression]
        ↓
[Mitigation: rollback to previous]
   - API call: POST /ops/deployments/dep_aB:rollback
        ↓
[Verify: error rate back to baseline]
        ↓
[Update status page if customer-impact threshold met]
        ↓
[Post-mortem next business day]
```

### FLOW-OPS-004: Maintenance window

```
[SRE creates maintenance window in admin]
   - title, description, scope, scheduled_start, scheduled_end, impact_level
        ↓
[7 days prior: email notification to affected tenants]
[24h prior: reminder email + status page banner]
        ↓
[At scheduled_start - 5 min: status page transition to "Scheduled maintenance"]
        ↓
[SRE marks "in_progress"]
   - Maintenance executed
        ↓
[Done → "completed"]
   - Status page resolved
   - Confirmation email to tenants
```

### FLOW-OPS-005: Feature flag rampup

```
[Engineer creates flag in Unleash + merges feature behind it (default off)]
        ↓
[Day 1: enable for internal users (employees)]
   - Manual test
        ↓
[Day 3: enable for 1% of tenants (beta cohort)]
   - Monitor error rates + metrics
        ↓
[Day 7: 10%]
[Day 14: 50%]
[Day 21: 100%]
        ↓
[Day 30: flag marked status='complete']
        ↓
[Day 60: cleanup PR removes flag from code]
        ↓
[Day 90: cleanup_due_at alert if not removed]
```

### FLOW-OPS-006: DR drill

```
[Quarterly scheduled DR drill]
        ↓
[Pre-drill: announcement to engineering team]
   - "We're failing over Y service from Frankfurt to Paris on 2026-XX-XX 10:00 UTC"
        ↓
[T-0: SRE executes runbook]
   - Step 1: Stop writes
   - Step 2: Promote Paris standby
   - Step 3: Update DNS
   - Step 4: Scale up Paris
   - Step 5: Smoke tests
        ↓
[Observed metrics: RPO 3 min, RTO 22 min]
        ↓
[Failback]
   - Frankfurt restored
   - Failback executed in next maintenance window
        ↓
[Post-drill report]
   - Findings + improvements
   - Update runbook
```

### FLOW-OPS-007: Cost anomaly detection

```
[JOB-DETECT-COST-ANOMALIES detects: AWS data transfer +250% vs 7d baseline]
        ↓
[EVENT-OPS-COST-ANOMALY-DETECTED → Slack alert + dashboard tile]
        ↓
[FinOps engineer investigates]
   - Identify: misconfigured S3 cross-region rep
   - Fix: adjust replication policy
        ↓
[Cost back to normal within 24h]
```

### FLOW-OPS-008: Status page incident lifecycle

```
[Incident occurs — investigated by on-call]
   - Severity assessed: SEV-2 (customer-visible)
        ↓
[Comms lead publishes status page]
   - POST /ops/status-page-incidents
   - title, impact, affected services
   - Status: investigating
        ↓
[Customers see banner on storefronts + admin + status.shopio.com]
        ↓
[Updates posted every 30 min minimum]
   - "Identified — root cause found"
   - "Monitoring — fix deployed"
        ↓
[Resolved → status page banner removed, retrospective published if SEV-1/SEV-2]
```

---

## 19. Performance, testing

### 19.1 Performance budgets (per service)

| Service | p50 latency | p95 latency | p99 latency | Throughput |
|---|---|---|---|---|
| Storefront SSR | 100 ms | 400 ms | 800 ms | 10k req/s |
| Admin API | 50 ms | 200 ms | 500 ms | 5k req/s |
| Storefront API | 30 ms | 150 ms | 400 ms | 20k req/s |
| Auth endpoints | 50 ms | 200 ms | 600 ms | 5k req/s (login) |
| Webhook delivery (subscriber response) | 200 ms | 1000 ms | 5000 ms | 100k/min total |
| Search query | 30 ms | 200 ms | 500 ms | 10k/min |
| Order placement (e2e) | 500 ms | 2000 ms | 5000 ms | 10k/min |
| Background job pickup | 1 s | 5 s | 30 s | 1M/day |

### 19.2 Load testing

- **k6** for HTTP load tests
- Scheduled: weekly automated runs against staging
- Pre-launch: full load test mirroring expected production traffic
- Black Friday rehearsal annually (4× peak)

### 19.3 Chaos engineering

Quarterly experiments:
- Pod kill (random)
- Network partition (zone isolation)
- DB failover
- Region outage simulation
- Slow third-party API
- Webhook subscriber refusing
- DDoS simulation (collaborate with Cloudflare)

Each experiment: hypothesis + blast radius + abort criteria + findings.

### 19.4 Testing matrix

```
TEST-UNIT-OPS-001  SLO burn rate calculation
TEST-UNIT-OPS-002  Cost attribution aggregation
TEST-UNIT-OPS-003  Feature flag rule evaluation
TEST-UNIT-OPS-004  Deployment state machine
TEST-UNIT-OPS-005  Maintenance window scheduler
TEST-UNIT-OPS-006  Image signature verification

TEST-INT-OPS-001  Full deploy pipeline (PR → preview → staging → canary)
TEST-INT-OPS-002  Auto-rollback on SLO violation
TEST-INT-OPS-003  Feature flag targeting precision
TEST-INT-OPS-004  Maintenance notification flow
TEST-INT-OPS-005  Status page auto-publish on alert
TEST-INT-OPS-006  Cost anomaly detection
TEST-INT-OPS-007  Backup restoration verification
TEST-INT-OPS-008  Multi-AZ failover for stateful services

TEST-E2E-OPS-001  Engineer pushes PR → reviewer tests on preview → merge → staging → prod
TEST-E2E-OPS-002  SRE rollbacks via UI
TEST-E2E-OPS-003  Maintenance schedule + notification + execution
TEST-E2E-OPS-004  DR failover drill executed against staging-DR

TEST-CHAOS-OPS-001 Pod kill resilience
TEST-CHAOS-OPS-002 DB primary failover
TEST-CHAOS-OPS-003 Network partition between regions
TEST-CHAOS-OPS-004 Cloudflare layer outage simulation
TEST-CHAOS-OPS-005 BullMQ Redis outage
```

### 19.5 Performance regression detection

- CI runs subset of perf tests on every PR (smoke)
- Full perf tests nightly
- Regression > 10% → CI fails with detail
- Performance dashboard tracks long-term trends per release

---

## 20. Cost & FinOps

### 20.1 Cost structure

Approximate split for healthy SaaS at scale:

| Category | % of revenue |
|---|---|
| AWS compute (EC2, EKS, RDS, ElastiCache) | 12-18% |
| AWS network (data transfer, NAT, ALB) | 2-4% |
| Cloudflare | 1-2% |
| S3 + glacier | 1-3% |
| Observability (Grafana stack or vendor) | 1-3% |
| Email send (SendGrid/SES) | 1-2% |
| Third-party APIs (Anthropic for AI, etc.) | 2-8% (per `33`) |
| Compliance + audits | 1-2% |
| Total infra | 20-40% (target: ≤ 30%) |

### 20.2 Budget mechanism

- Monthly budgets per service + per vendor
- Alerts at 50%/75%/90%/100%
- Hard caps for non-essential (e.g., experimental AI features) — auto-disable on 110%
- Quarterly review

### 20.3 Cost optimization techniques

- **Reserved Instances** for steady-state (~60-70% of compute)
- **Spot Instances** for interruptible (workers, batch)
- **Right-sizing** quarterly review (over-provisioned services)
- **Cache hit ratio optimization** (CDN, Redis)
- **S3 Intelligent Tiering** + lifecycle to Glacier
- **Compression** at API level (gzip/brotli)
- **Image optimization** (lossy WebP/AVIF where appropriate)
- **AI cost** (per `33`): model selection (Haiku for simple → Sonnet → Opus for complex), prompt caching, batch API

### 20.4 Per-tenant cost attribution (Fáze 2)

- Resource consumption tagged with `tenant_id` (compute time, API calls, storage, AI tokens)
- Daily aggregation
- Cost showback in admin (Enterprise tier)
- Detect outlier tenants consuming disproportionate resources
- Tier-based pricing adjustments

### 20.5 Vendor negotiations

- AWS Enterprise Discount Program at $X spend threshold
- Cloudflare Enterprise plan for SLA + features
- Anthropic enterprise tier at $X monthly
- Annual contracts vs monthly trade-offs

### 20.6 FinOps culture

- Monthly cost review meeting (SRE + Finance + Eng leads)
- Cost-as-a-feature mindset (engineers care about $/req)
- Public dashboard internally (transparency)
- "Money saved" KPI tracked

---

## 21. Implementation checklist

### Infrastructure foundation
- [ ] **[L]** Terraform modules for AWS (VPC, EKS, RDS, ElastiCache, S3, KMS, ALB, ACM)
- [ ] **[L]** Multi-region setup (Frankfurt primary, Paris DR)
- [ ] **[M]** Cloudflare configuration (DNS, WAF, CDN, Turnstile, rate limits)
- [ ] **[M]** Egress proxy + allowlist
- [ ] **[M]** Network policies (Calico)
- [ ] **[M]** Image registry (ECR + cosign signing)
- [ ] **[S]** Secrets management (KMS aliases, IAM roles for service accounts)

### CI/CD
- [ ] **[L]** GitHub Actions workflows per service (lint, test, build, sign, deploy)
- [ ] **[L]** ArgoCD installation + per-environment applications
- [ ] **[M]** Argo Rollouts for canary
- [ ] **[M]** Preview env automation (per-PR namespace + seed DB)
- [ ] **[M]** Cosign signing + admission controller
- [ ] **[M]** SBOM generation (CycloneDX)
- [ ] **[S]** Release notes auto-gen (conventional commits → changesets)

### Observability
- [ ] **[L]** OpenTelemetry SDKs integrated in all services
- [ ] **[L]** OTel Collector deployment
- [ ] **[L]** Grafana stack (Mimir, Loki, Tempo, Alertmanager) self-host EU
- [ ] **[L]** Sentry self-host
- [ ] **[M]** Dashboard library (Grafana JSON exports versioned)
- [ ] **[M]** Alert rules (PromQL) per service tier
- [ ] **[M]** PagerDuty / OpsGenie integration
- [ ] **[S]** Slack alert routing
- [ ] **[M]** Log redaction middleware

### SLO + monitoring
- [ ] **[M]** SLO definitions in code (terraform / yaml)
- [ ] **[M]** Burn-rate alert configuration
- [ ] **[M]** Error budget tracking
- [ ] **[M]** Feature freeze automation on budget exhaustion
- [ ] **[S]** SLO dashboard UI in admin

### Deployment + release
- [ ] **[M]** Deployment tracking (`deployments` table + UI)
- [ ] **[M]** Rollback UI + API
- [ ] **[M]** Feature flag service (Unleash self-host)
- [ ] **[M]** Feature flag SDK clients
- [ ] **[S]** Kill-switch UI
- [ ] **[M]** Maintenance window scheduler + notifications
- [ ] **[S]** Cleanup-due flag dashboard

### Disaster recovery + backups
- [ ] **[L]** Postgres PITR + cross-region logical replication
- [ ] **[M]** Redis Global Datastore
- [ ] **[M]** S3 Cross-Region Replication
- [ ] **[L]** Failover runbook + automation scaffolding
- [ ] **[M]** Backup verification jobs (monthly restore tests)
- [ ] **[M]** DR drill scheduling

### Status page
- [ ] **[M]** Status page (statuspage.io or self-host Cachet)
- [ ] **[M]** Auto-update from monitoring
- [ ] **[S]** RSS feed
- [ ] **[S]** Public history archive

### Capacity + cost
- [ ] **[M]** Capacity dashboards (utilization vs limits)
- [ ] **[M]** Cost attribution pipeline (AWS CUR + Cloudflare billing + others)
- [ ] **[M]** Budget alert engine
- [ ] **[M]** Cost anomaly detection
- [ ] **[M]** Per-tenant cost showback (Fáze 2)

### Chaos engineering
- [ ] **[M]** Litmus / chaos-mesh installation
- [ ] **[M]** Quarterly game day schedule + runbooks
- [ ] **[S]** Experiment results tracking

### Database operations
- [ ] **[M]** PgBouncer transaction-mode pool
- [ ] **[L]** Migration tooling (Drizzle Kit + online migration patterns)
- [ ] **[M]** Migration window scheduler
- [ ] **[S]** Slow query monitor + alert
- [ ] **[S]** Long-running transaction detector

### Service inventory + ownership
- [ ] **[M]** Service inventory data model + UI
- [ ] **[M]** Backstage-like service catalog (Fáze 2; MVP: simple DB-backed)
- [ ] **[S]** Owner / on-call mapping

### Background jobs
- [ ] Per §17 (many small jobs)

### Tests
- [ ] Per §19

### Docs
- [ ] **[M]** "On-call handbook"
- [ ] **[M]** "Runbook library" (initial 30+ runbooks)
- [ ] **[M]** "Release process" engineer guide
- [ ] **[M]** "Disaster recovery playbook" (private)
- [ ] **[M]** "FinOps practices" internal
- [ ] **[M]** "Self-host operations guide" (for OSS Apache 2.0 distro)

---

## 22. Open questions

### Q-OPS-001: Vendor lock-in vs OSS observability stack
**Otázka:** Grafana stack self-hosted vs managed (Grafana Cloud, Datadog, New Relic).

**Status:** Self-hosted preferred (cost + EU sovereignty + OSS-first). Grafana Cloud as cost-optimized backup for early stage. Datadog excluded (US lock-in + cost).

### Q-OPS-002: Service mesh — Istio vs Linkerd vs Cilium
**Otázka:** mTLS service-to-service + observability.

**Status:** Linkerd (lightweight, less complexity). Cilium considered for eBPF networking benefits. Istio rejected (complexity > value at our scale). Decision Fáze 2.

### Q-OPS-003: GitOps tool — ArgoCD vs Flux
**Otázka:** Continuous delivery.

**Status:** ArgoCD (UI better, Argo Rollouts integration, more popular in EU). Recordat to `01-DEC-OPS-002`.

### Q-OPS-004: Status page — self-host vs vendor
**Otázka:** statuspage.io ($79+/mo) vs self-hosted Cachet/Statping (free).

**Status:** Self-host MVP for cost. Migrate to statuspage.io Fáze 2 once revenue justifies. Cachet maintenance fork seems best OSS option.

### Q-OPS-005: Multi-cloud
**Otázka:** AWS-only vs multi-cloud (AWS+GCP, AWS+on-prem).

**Status:** AWS-only MVP. Multi-cloud Fáze 3+ for enterprise demand. OSS distro (Apache 2.0) supports any K8s; self-host customers can run on whatever.

### Q-OPS-006: Database choice for analytics
**Otázka:** Postgres + duckdb for analytics OR dedicated (ClickHouse, BigQuery)?

**Status:** Postgres + materialized views MVP per `DEC-DB-001`. ClickHouse evaluation Fáze 2 if analytics workloads outpace. Per `20-analytics-reporting.md`.

### Q-OPS-007: SLO bucketing per tenant tier
**Otázka:** Free vs Scale should have different SLAs.

**Status:** Defined per `9.1`. Implementation: per-tenant SLO tracking Fáze 2 (Enterprise tier).

### Q-OPS-008: Edge compute strategy
**Otázka:** Cloudflare Workers vs Deno Deploy vs AWS Lambda@Edge.

**Status:** Cloudflare Workers for storefront edge perks (Fáze 2). Deno Deploy for edge functions (per `28 §9`). Lambda@Edge rejected (cold start). Hybrid acceptable.

### Q-OPS-009: Database sharding strategy
**Otázka:** At what scale do we shard? Per-tenant DB? Per-region?

**Status:** Single Postgres + read replicas MVP. Sharding Fáze 3+ at ~5M tenants or specific tenant size. Per-tenant DB option for enterprise. Plan multi-tenant separation strategy in `01-DEC-DB-002`.

### Q-OPS-010: On-call compensation
**Otázka:** CZ labor law requires compensation for after-hours on-call. Rate?

**Status:** Per Czech labor law (Zákoník práce §95). Calculate: standby rate + actual time worked. HR handles. Out of scope of build-spec.

### Q-OPS-011: Carbon-aware operations
**Otázka:** Carbon-aware scheduling (run jobs when grid is greener)?

**Status:** Fáze 3+. AWS Frankfurt has reasonable energy mix. Carbon footprint reporting for customers may become regulatory.

### Q-OPS-012: Internal developer platform (IDP)
**Otázka:** Backstage / Port for service catalog + developer self-service?

**Status:** Backstage Fáze 3+ (overkill MVP). MVP: simple DB-backed service catalog UI.

### Q-OPS-013: Database connection pooling
**Otázka:** PgBouncer transaction mode universally? Some workloads need session mode.

**Status:** Mixed: transaction mode for most, session mode for migrations + long transactions. Documented in service inventory.

### Q-OPS-014: Cost showback vs chargeback
**Otázka:** Show tenants their cost (informational) vs charge them (pricing model)?

**Status:** Showback Fáze 2 Enterprise. Chargeback (usage-based pricing tier) Fáze 3+ business decision.

### Q-OPS-015: Compliance evidence automation
**Otázka:** Drata / Vanta vs manual evidence collection?

**Status:** Drata recommended for ISO 27001 + SOC 2 prep. ~$5-10k/year, saves vast manual work. Per `30 §14`.

### Q-OPS-016: Internal developer support (DX)
**Otázka:** DX-focused team mandate? Or each engineer's responsibility?

**Status:** Solo founder + AI MVP. Fáze 4+ DevX engineer hire as team grows. Documented in `01-DEC-OPS-*`.

---

## 📅 Změny

| Datum | Změna |
|---|---|
| 2026-05-20 | Initial — Operations baseline. AWS primary (Frankfurt + Paris DR), Kubernetes (EKS) + ArgoCD GitOps, OpenTelemetry-based observability with self-hosted Grafana stack, SLO-driven monitoring + error budgets, multi-region DR with RPO ≤5min RTO ≤30min for tier-1, signed image deploys, feature flags via Unleash, status page + maintenance windows, FinOps cost attribution, chaos engineering, 50 business rules, 32 events, 23 background jobs. |

---

**Konec Operations.**

➡️ Pokračovat na: [`32-cms-content.md`](32-cms-content.md)
