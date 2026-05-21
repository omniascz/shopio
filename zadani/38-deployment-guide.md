# 38 – DEPLOYMENT GUIDE

> **Doména:** Self-host instalační příručka pro Shopio Apache 2.0 OSS distribuci. Pokrývá: deployment options overview, system requirements, local dev (docker-compose), single-server Docker, Kubernetes (Helm), cloud-specific (AWS EKS, GCP GKE, Azure AKS, Hetzner, on-prem), DB + Redis + S3 + Meilisearch + KMS setup, TLS/DNS configuration, first-run initialization, env var reference, backup + monitoring setup, upgrade procedures, troubleshooting, hardening checklist, compliance considerations.

**Datum:** 2026-05-20
**Verze:** 1.0
**Status:** 🟡 DESIGN
**Reference:** [31-operations.md](31-operations.md) · [30-security.md](30-security.md) · [01-decisions-registry.md](01-decisions-registry.md) DEC-OPS-*

---

## 📑 Obsah

0. [Overview](#0-overview)
1. [Deployment options](#1-deployment-options)
2. [System requirements](#2-system-requirements)
3. [Local development](#3-local-development)
4. [Single-server Docker deployment](#4-single-server-docker-deployment)
5. [Kubernetes deployment](#5-kubernetes-deployment)
6. [Cloud-specific guides](#6-cloud-specific-guides)
7. [Database setup](#7-database-setup)
8. [Redis setup](#8-redis-setup)
9. [Object storage](#9-object-storage)
10. [Search (Meilisearch)](#10-search-meilisearch)
11. [KMS / secrets](#11-kms--secrets)
12. [TLS + DNS](#12-tls--dns)
13. [First-run initialization](#13-first-run-initialization)
14. [Configuration reference](#14-configuration-reference)
15. [Backups](#15-backups)
16. [Monitoring + observability](#16-monitoring--observability)
17. [Upgrade procedures](#17-upgrade-procedures)
18. [Troubleshooting](#18-troubleshooting)
19. [Hardening checklist](#19-hardening-checklist)
20. [Compliance for self-host](#20-compliance-for-self-host)
21. [Open questions](#21-open-questions)

---

## 0. Overview

### 0.1 Audience

Tato příručka je pro:
- **Self-host operators** — IT týmy, které instalují Shopio na vlastní infrastrukturu
- **Agency administrators** — agentury hostující Shopio pro klienty
- **Enterprise IT** — corporate prostředí s on-prem nebo private cloud requirements
- **Developers** — místní development setup

Pro **Shopio Cloud** (managed SaaS hosted by Shopio) tato příručka neplatí — Shopio Cloud customer's just sign up at shopio.com bez deployment kroků.

### 0.2 Open source distribution

Per `01 DEC-LICENSE-001`:
- **Apache 2.0 core** — full platform open source
- **Commercial modules** — proprietary EULA (e.g., enterprise SSO, AI Copilot premium, advanced analytics)
- **MIT SDK** — `@shopio/sdk-ts` and related developer packages

Self-host distribuce: Apache 2.0 core funguje plně samostatně. Commercial modules vyžadují license key.

### 0.3 Minimum viable deployment

For development / pilot:
- 1 server (4 vCPU, 8 GB RAM, 100 GB disk)
- Docker Compose
- Local PostgreSQL + Redis + Meilisearch
- Cloudflare or self-signed TLS

For production:
- Kubernetes cluster (3+ nodes recommended)
- Managed PostgreSQL (RDS, Cloud SQL, or self-hosted with replication)
- Managed Redis (ElastiCache, Memorystore)
- S3-compatible storage
- Cloudflare or equivalent CDN
- KMS provider (AWS KMS, GCP Cloud KMS, HashiCorp Vault)

### 0.4 Source code structure

Self-host distribuce pulled from:
- `github.com/shopio/shopio` (main monorepo; private until Apache 2.0 OSS release)
- Docker images: `ghcr.io/shopio/*` or `quay.io/shopio/*`
- Helm charts: `oci://ghcr.io/shopio/charts`
- Terraform modules: `github.com/shopio/terraform-modules`

---

## 1. Deployment options

### 1.1 Comparison matrix

| Option | Use case | Complexity | Cost | Scale |
|---|---|---|---|---|
| **Local dev** | Development | Low | $0 | 1 user |
| **Single-server Docker** | Pilot / small biz | Low | $20-100/mo | < 10 merchants |
| **Kubernetes (single cluster)** | Production small-medium | Medium | $200-2k/mo | < 1000 merchants |
| **Kubernetes (multi-region)** | Production large | High | $5k+/mo | Unlimited |
| **Managed Kubernetes (EKS/GKE/AKS)** | Production cloud-native | Medium | $500+/mo | Scales |
| **Hetzner / bare metal** | Cost-sensitive prod | Medium-High | $100-1k/mo | Medium |
| **Shopio Cloud** | Fully managed | None (just sign up) | Per pricing tier | Unlimited |

### 1.2 Decision tree

```
Need it now for dev? → Local development (§3)
   ↓ no
Pilot or small production? → Single-server Docker (§4)
   ↓ no
Cost-sensitive but production? → Hetzner / bare metal (§6.4)
   ↓ no
AWS-aligned? → EKS (§6.1)
GCP-aligned? → GKE (§6.2)
Azure-aligned? → AKS (§6.3)
Multi-cloud / on-prem? → Self-managed Kubernetes (§5)
```

### 1.3 Recommended path for most

1. Start: **local development** with docker-compose
2. Pilot: **single-server Docker** for first customers
3. Production growth: migrate to **Kubernetes** at ~50-100 active merchants
4. Scale: **multi-region Kubernetes** when SLA + DR critical

Migration paths documented per pair.

---

## 2. System requirements

### 2.1 Hardware

#### Local development
- CPU: 4 cores (modern x86_64 or ARM64)
- RAM: 16 GB minimum (8 GB tight)
- Disk: 50 GB SSD
- OS: macOS, Linux, Windows (WSL2 recommended for Windows)
- Docker Desktop 4.30+ or Docker Engine 26+

#### Pilot / small production (single server)
- CPU: 4 vCPU
- RAM: 8-16 GB
- Disk: 100 GB SSD (NVMe preferred)
- Network: 1 Gbps
- OS: Ubuntu 24.04 LTS or Debian 12+
- Docker Engine 26+ + Docker Compose 2.27+

#### Production Kubernetes (single cluster, ~100-500 merchants)
- 3+ nodes minimum (HA)
- Per node: 4 vCPU, 16 GB RAM, 100 GB SSD
- Total cluster: 12+ vCPU, 48+ GB RAM, 300+ GB SSD
- Database: separate managed instance OR dedicated node (16 GB RAM)
- Network: 10 Gbps internal, 1 Gbps external
- Optional: NVMe-backed storage class for PostgreSQL

#### Production multi-region (1000+ merchants)
- Per `31-operations.md §3.2` reference architecture

### 2.2 Software stack

| Component | Version | Notes |
|---|---|---|
| **PostgreSQL** | 17+ | per `DEC-DB-001` |
| **Redis** | 7+ | for cache + BullMQ |
| **Meilisearch** | 1.10+ | search engine |
| **Node.js** | 22 LTS+ | runtime for services |
| **Docker** | 26+ | container runtime |
| **Kubernetes** | 1.30+ | (if K8s deployment) |
| **Helm** | 3.15+ | (if K8s deployment) |
| **kubectl** | matched to cluster | |
| **Terraform** | 1.9+ | optional infra-as-code |
| **OS** | Linux x86_64 or ARM64 | Ubuntu 24.04 LTS recommended |

### 2.3 Network requirements

**Outbound (egress) — required:**
- HTTPS to Anthropic API (`api.anthropic.com:443`)
- HTTPS to payment providers (Stripe, GoPay, ComGate, ...)
- HTTPS to integrations (Pohoda mServer, Mailchimp, Heuréka, ...)
- DNS resolution
- NTP for time sync

**Outbound — optional but recommended:**
- Sentry (`*.sentry.io`)
- npm registry / Docker Hub for updates

**Inbound (ingress) — required:**
- HTTPS 443 from customers (storefront + admin)
- Webhook callbacks (Stripe, integrations)

**Internal:**
- Kubernetes pod-to-pod (private network)
- Database access from app pods (private)

### 2.4 Browser requirements (customer-facing)

Last 2 versions of Chrome, Firefox, Safari, Edge. No IE. Mobile Safari 17+, Chrome Android 124+.

---

## 3. Local development

### 3.1 Prerequisites

```bash
# Install Docker Desktop / Docker Engine
# Install Node.js 22 via fnm or nvm
fnm install 22 && fnm use 22

# Install pnpm
corepack enable
corepack prepare pnpm@latest --activate

# Clone repository
git clone https://github.com/shopio/shopio.git
cd shopio

# Install dependencies
pnpm install
```

### 3.2 Start services

```bash
# Spin up Postgres + Redis + Meilisearch + MinIO via docker-compose
docker compose up -d

# Run database migrations
pnpm db:migrate

# Seed initial data (sample tenant, sample products)
pnpm db:seed

# Start all apps in dev mode (Turbo)
pnpm dev
```

### 3.3 Access points (default ports)

| Service | URL |
|---|---|
| Storefront (Next.js 16) | http://localhost:3000 |
| Admin SPA (Vite + React 19) | http://localhost:3001 |
| API Gateway (Fastify) | http://localhost:4000 |
| GraphQL playground | http://localhost:4000/graphql |
| Storybook | http://localhost:6006 |
| Mailpit (email preview) | http://localhost:8025 |
| MinIO (S3) | http://localhost:9000 (console: 9001) |
| Meilisearch | http://localhost:7700 |
| Postgres | localhost:5432 |
| Redis | localhost:6379 |

### 3.4 Default credentials (dev only)

- Admin user: `admin@shopio.local` / `dev-password-123!`
- Test customer: `customer@example.com` / `customer-pass`
- Postgres: `shopio` / `shopio_dev_password`
- Redis: no password (dev only)
- MinIO: `minioadmin` / `minioadmin`

⚠️ **Never use these in production.** Generated random secrets in production setup.

### 3.5 docker-compose.yaml (excerpt)

```yaml
version: '3.9'
services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: shopio
      POSTGRES_PASSWORD: shopio_dev_password
      POSTGRES_DB: shopio_dev
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  meilisearch:
    image: getmeili/meilisearch:v1.10
    environment:
      MEILI_MASTER_KEY: dev_master_key
    volumes:
      - meilisearch_data:/meili_data
    ports:
      - "7700:7700"

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data

  mailpit:
    image: axllent/mailpit:latest
    ports:
      - "1025:1025"
      - "8025:8025"

volumes:
  postgres_data:
  redis_data:
  meilisearch_data:
  minio_data:
```

### 3.6 Hot reload

Turbo runs all services with watch mode:
- Storefront (Next.js): HMR < 1s
- Admin SPA (Vite): HMR < 200ms
- API services (Fastify): tsx watch, restart < 2s
- Workers (BullMQ): restart on file change

### 3.7 Testing locally

```bash
# Unit tests
pnpm test

# E2E tests (Playwright)
pnpm test:e2e

# Type check
pnpm typecheck

# Lint
pnpm lint
```

### 3.8 Resetting state

```bash
# Stop + remove all containers + volumes
docker compose down -v

# Restart fresh
docker compose up -d
pnpm db:migrate && pnpm db:seed
```

---

## 4. Single-server Docker deployment

### 4.1 When to use

- Pilot deployment (1-50 merchants)
- Single tenant or small multi-tenant
- Cost < €100/month target
- No HA required

### 4.2 Prerequisites

- Ubuntu 24.04 LTS server (Hetzner, DigitalOcean, Linode, Vultr, on-prem)
- Public IPv4
- Domain pointed (A record)
- SSH access
- Sudo privileges

### 4.3 Server preparation

```bash
# SSH to server
ssh root@your-server.example.com

# Update system
apt update && apt upgrade -y

# Create non-root user
adduser shopio
usermod -aG sudo shopio
mkdir -p /home/shopio/.ssh
cp ~/.ssh/authorized_keys /home/shopio/.ssh/
chown -R shopio:shopio /home/shopio/.ssh
chmod 700 /home/shopio/.ssh
chmod 600 /home/shopio/.ssh/authorized_keys

# Switch to shopio user
su - shopio

# Install Docker (Ubuntu repos approach)
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add user to docker group
sudo usermod -aG docker shopio
newgrp docker

# Verify
docker --version
docker compose version
```

### 4.4 Firewall

```bash
# UFW basic firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp        # SSH
sudo ufw allow 80/tcp        # HTTP
sudo ufw allow 443/tcp       # HTTPS
sudo ufw enable
```

### 4.5 Deploy Shopio

```bash
# Clone deployment repo
git clone https://github.com/shopio/shopio-self-host.git
cd shopio-self-host

# Copy + edit environment
cp .env.example .env
nano .env
# Set:
# SHOPIO_BASE_URL=https://your-domain.com
# SHOPIO_ADMIN_URL=https://admin.your-domain.com
# POSTGRES_PASSWORD=<random-32-char>
# REDIS_PASSWORD=<random-32-char>
# MEILI_MASTER_KEY=<random-32-char>
# SHOPIO_JWT_SECRET=<random-64-char>
# SHOPIO_ENCRYPTION_KEY=<random-32-byte-base64>
# STRIPE_SECRET_KEY=sk_live_...
# ANTHROPIC_API_KEY=sk-ant-...
# CLOUDFLARE_API_TOKEN=...
# SMTP_HOST=...
# (full reference in §14)

# Pull images + start
docker compose -f docker-compose.prod.yaml up -d

# Run migrations (first time)
docker compose -f docker-compose.prod.yaml exec api pnpm db:migrate

# Create initial admin user
docker compose -f docker-compose.prod.yaml exec api pnpm shopio:init-admin \
  --email admin@your-company.com \
  --password 'change-this-strong-password!' \
  --tenant-name "Your Company"
```

### 4.6 Reverse proxy (Caddy)

Caddy automaticky obstará TLS via Let's Encrypt:

```caddyfile
# /etc/caddy/Caddyfile
your-domain.com {
    reverse_proxy localhost:3000
    encode gzip zstd
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
    }
}

admin.your-domain.com {
    reverse_proxy localhost:3001
}

api.your-domain.com {
    reverse_proxy localhost:4000
}
```

```bash
sudo apt install -y caddy
sudo nano /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

### 4.7 First login

1. Otevři `https://admin.your-domain.com`
2. Přihlas se s admin credentials z §4.5
3. Onboarding wizard (per `27 §RULE-ADM-021`)
4. Aktivuj industry profile (per `34`)
5. Konfiguruj Stripe + email + integrace

### 4.8 Daily ops

```bash
# Check status
docker compose -f docker-compose.prod.yaml ps

# Logs
docker compose -f docker-compose.prod.yaml logs -f api

# Restart specific service
docker compose -f docker-compose.prod.yaml restart api

# Update to new version
docker compose -f docker-compose.prod.yaml pull
docker compose -f docker-compose.prod.yaml up -d
docker compose -f docker-compose.prod.yaml exec api pnpm db:migrate
```

### 4.9 Backups (single-server)

```bash
# Postgres dump (nightly via cron)
sudo nano /etc/cron.daily/shopio-backup

#!/bin/bash
set -e
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/var/backups/shopio
mkdir -p $BACKUP_DIR

docker compose -f /home/shopio/shopio-self-host/docker-compose.prod.yaml exec -T postgres \
  pg_dump -U shopio shopio_prod | gzip > $BACKUP_DIR/postgres_$TIMESTAMP.sql.gz

# Upload to S3 (per `15`)
aws s3 cp $BACKUP_DIR/postgres_$TIMESTAMP.sql.gz s3://your-backup-bucket/

# Retention: keep last 30 days locally
find $BACKUP_DIR -name "postgres_*.sql.gz" -mtime +30 -delete
```

```bash
sudo chmod +x /etc/cron.daily/shopio-backup
```

---

## 5. Kubernetes deployment

### 5.1 When to use

- Production with 100+ merchants
- HA + auto-scaling required
- Multi-region or DR capability
- Compliance audit requires (ISO 27001, SOC 2)

### 5.2 Cluster prerequisites

- Kubernetes 1.30+
- 3+ worker nodes (each ≥ 4 vCPU + 16 GB RAM)
- StorageClass with dynamic provisioning (gp3 / pd-balanced / managed-premium)
- LoadBalancer support (cloud provider native or MetalLB on-prem)
- Helm 3.15+
- kubectl configured for cluster access
- cert-manager 1.15+ installed (for TLS)
- External DNS controller (optional but recommended)

### 5.3 Architecture overview

```
                       Ingress (NGINX or cloud LB)
                              │
                ┌─────────────┼─────────────┐
                │             │             │
          [storefront]   [admin SPA]    [api-gateway]
           (Next.js 16)   (Vite static)   (Fastify)
                              │
                ┌─────────────┼─────────────┐
                │             │             │
        [api-storefront] [api-admin]  [api-developer]
                              │
       ┌──────────────────────┼──────────────────────┐
       │                      │                      │
  [workers-*]            [mcp-server]         [edge-runtime]
  (BullMQ; 7 queues)     (WebSocket)          (Deno or CF)
       │                      │
       └──────────┬───────────┘
                  │
       ┌──────────┼──────────┬──────────┐
       │          │          │          │
   [postgres] [redis]  [meilisearch]  [S3]
   (StatefulSet     (StatefulSet  (StatefulSet  (external)
    + PVC)           + PVC)        + PVC)
```

### 5.4 Helm chart layout

```
shopio/
├── Chart.yaml
├── values.yaml                                                                                                                                                                                                                                                                                            # defaults
├── values-aws.yaml                                                                                                                                                                                                                                                                                            # AWS-specific overrides
├── values-gcp.yaml
├── values-azure.yaml
├── values-hetzner.yaml
├── values-production.yaml                                                                                                                                                                                                                                                                                              # production tier defaults
├── templates/
│   ├── _helpers.tpl
│   ├── secrets.yaml
│   ├── configmap.yaml
│   ├── postgres/
│   │   ├── statefulset.yaml
│   │   ├── service.yaml
│   │   └── pvc.yaml
│   ├── redis/
│   ├── meilisearch/
│   ├── storefront/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   ├── hpa.yaml
│   │   └── ingress.yaml
│   ├── admin/
│   ├── api-gateway/
│   ├── api-storefront/
│   ├── api-admin/
│   ├── api-developer/
│   ├── workers-orders/
│   ├── workers-marketing/
│   ├── workers-integrations/
│   ├── workers-webhooks/
│   ├── workers-analytics/
│   ├── workers-ai/
│   ├── workers-search-indexer/
│   ├── mcp-server/
│   ├── edge-runtime/
│   ├── networkpolicies/
│   └── rbac/
```

### 5.5 Install via Helm

```bash
# Add Shopio Helm repo
helm repo add shopio oci://ghcr.io/shopio/charts

# Create namespace
kubectl create namespace shopio

# Create secret from values file
kubectl -n shopio create secret generic shopio-secrets \
  --from-env-file=secrets.env

# Install Shopio
helm install shopio shopio/shopio \
  --namespace shopio \
  --values values-production.yaml \
  --version 1.0.0
```

### 5.6 Sample values-production.yaml

```yaml
global:
  baseUrl: https://your-domain.com
  region: eu-central-1
  imageRegistry: ghcr.io/shopio
  imageTag: 1.0.0
  storageClass: gp3

postgres:
  enabled: true                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  # set false to use external (RDS)
  external:
    host: ""
    port: 5432
    database: shopio_prod
  resources:
    requests:
      cpu: 2
      memory: 8Gi
    limits:
      cpu: 4
      memory: 16Gi
  storage: 200Gi

redis:
  enabled: true                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  # set false to use external (ElastiCache)
  external:
    host: ""
    port: 6379
  resources:
    requests:
      cpu: 1
      memory: 2Gi
    limits:
      cpu: 2
      memory: 4Gi

meilisearch:
  enabled: true
  replicas: 3
  storage: 50Gi

storefront:
  replicas: 5
  autoscaling:
    enabled: true
    minReplicas: 5
    maxReplicas: 50
    targetCPUUtilizationPercentage: 70
  resources:
    requests:
      cpu: 500m
      memory: 1Gi
    limits:
      cpu: 2
      memory: 4Gi
  ingress:
    enabled: true
    host: your-domain.com
    tls: true

admin:
  replicas: 2
  ingress:
    host: admin.your-domain.com

apiGateway:
  replicas: 3
  autoscaling:
    enabled: true
    minReplicas: 3
    maxReplicas: 30
  ingress:
    host: api.your-domain.com

workers:
  orders:
    replicas: 3
    autoscaling: { enabled: true, max: 20 }
  marketing:
    replicas: 2
  integrations:
    replicas: 3
  webhooks:
    replicas: 3
  analytics:
    replicas: 1
  ai:
    replicas: 1
  searchIndexer:
    replicas: 1

mcpServer:
  enabled: true
  replicas: 2
  ingress:
    host: mcp.your-domain.com

certManager:
  email: admin@your-domain.com
  issuer: letsencrypt-prod

monitoring:
  prometheus:
    enabled: true
  grafana:
    enabled: true
  sentry:
    enabled: false                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          # external if used

kms:
  provider: aws_kms                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  # aws_kms | gcp_kms | hashicorp_vault | local_dev
  awsKms:
    keyArn: arn:aws:kms:eu-central-1:...:key/...
```

### 5.7 Verify deployment

```bash
# Watch pods
kubectl -n shopio get pods -w

# Check ingress
kubectl -n shopio get ingress

# Logs
kubectl -n shopio logs -f deploy/api-gateway

# Run migrations
kubectl -n shopio exec deploy/api-admin -- pnpm db:migrate
```

### 5.8 Ingress + TLS

cert-manager + Let's Encrypt issues TLS certs automatically:

```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@your-domain.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
      - http01:
          ingress:
            class: nginx
```

Each Ingress annotated:
```yaml
annotations:
  cert-manager.io/cluster-issuer: letsencrypt-prod
```

### 5.9 Auto-scaling

HPA (Horizontal Pod Autoscaler) per service:
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-gateway
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-gateway
  minReplicas: 3
  maxReplicas: 30
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

Cluster autoscaler (cloud-specific) adds nodes when HPA can't fit.

### 5.10 Network policies

Default deny all; explicit allow:
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-gateway-allow
spec:
  podSelector:
    matchLabels:
      app: api-gateway
  policyTypes: [Ingress, Egress]
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: storefront
        - podSelector:
            matchLabels:
              app: admin
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: postgres
        - podSelector:
            matchLabels:
              app: redis
```

### 5.11 RBAC for Kubernetes

Per `30 §10.9` privileged access principles applied to Kubernetes:
- Service accounts per app pod
- Read-only access to other namespaces by default
- Operator role for admins (kubectl access)
- Audit logging enabled on API server

---

## 6. Cloud-specific guides

### 6.1 AWS (EKS)

#### Infrastructure (Terraform)

```hcl
module "shopio_aws" {
  source = "github.com/shopio/terraform-modules//aws-eks"
  region = "eu-central-1"
  cluster_name = "shopio-prod"
  kubernetes_version = "1.30"
  node_groups = {
    app = {
      instance_types = ["m6i.xlarge"]
      min_size = 3
      max_size = 30
      desired_size = 5
    }
    workers = {
      instance_types = ["m6i.large"]
      min_size = 3
      max_size = 20
      desired_size = 3
    }
  }
  vpc_cidr = "10.0.0.0/16"
}

module "shopio_rds" {
  source = "github.com/shopio/terraform-modules//aws-rds"
  identifier = "shopio-prod"
  engine_version = "17.0"
  instance_class = "db.m6g.xlarge"
  allocated_storage = 200
  multi_az = true
  backup_retention_period = 30
}

module "shopio_elasticache" {
  source = "github.com/shopio/terraform-modules//aws-elasticache"
  cluster_id = "shopio-prod-redis"
  node_type = "cache.t4g.medium"
  num_cache_nodes = 3
}

module "shopio_s3" {
  source = "github.com/shopio/terraform-modules//aws-s3"
  bucket_name = "shopio-prod-media"
  enable_versioning = true
  enable_lifecycle = true
}

module "shopio_kms" {
  source = "github.com/shopio/terraform-modules//aws-kms"
  alias = "shopio/prod/master"
  enable_rotation = true
}
```

```bash
terraform init
terraform apply
```

#### Helm install with AWS overrides

```bash
helm install shopio shopio/shopio \
  --namespace shopio \
  --values values-aws.yaml \
  --set global.kms.provider=aws_kms \
  --set global.kms.awsKms.keyArn=$(terraform output -raw kms_key_arn) \
  --set postgres.enabled=false \
  --set postgres.external.host=$(terraform output -raw rds_endpoint) \
  --set redis.enabled=false \
  --set redis.external.host=$(terraform output -raw redis_endpoint)
```

#### AWS-specific features

- **AWS Load Balancer Controller** for ALB ingress
- **EBS CSI driver** for gp3 volumes
- **External DNS** with Route 53
- **AWS Secrets Manager** for runtime secrets
- **CloudWatch** for logs (alternative to Loki)
- **WAF** in front (cf. `30 §10.2` Cloudflare option)

### 6.2 GCP (GKE)

#### Infrastructure (Terraform)

```hcl
module "shopio_gcp" {
  source = "github.com/shopio/terraform-modules//gcp-gke"
  project_id = "shopio-prod"
  region = "europe-west3"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          # Frankfurt
  cluster_name = "shopio-prod"
  node_pools = {
    app = {
      machine_type = "n2-standard-4"
      min_count = 3
      max_count = 30
    }
  }
}

module "shopio_cloud_sql" {
  source = "github.com/shopio/terraform-modules//gcp-cloud-sql"
  instance_name = "shopio-prod"
  database_version = "POSTGRES_17"
  tier = "db-custom-4-16384"
  region = "europe-west3"
  availability_type = "REGIONAL"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  # multi-zone HA
}

module "shopio_memorystore" {
  source = "github.com/shopio/terraform-modules//gcp-memorystore"
  name = "shopio-prod-redis"
  tier = "STANDARD_HA"
  memory_size_gb = 4
}

module "shopio_gcs" {
  source = "github.com/shopio/terraform-modules//gcp-gcs"
  bucket_name = "shopio-prod-media"
  location = "EUROPE-WEST3"
}

module "shopio_gcp_kms" {
  source = "github.com/shopio/terraform-modules//gcp-kms"
  key_ring_name = "shopio-prod"
  location = "europe-west3"
}
```

#### Helm install GCP

```bash
helm install shopio shopio/shopio \
  --namespace shopio \
  --values values-gcp.yaml \
  --set global.kms.provider=gcp_kms \
  --set global.kms.gcpKms.keyName=$(terraform output -raw kms_key_name)
```

#### GCP-specific features

- **Workload Identity** for pod-to-GCP-service auth
- **Persistent Disk CSI** for storage
- **Cloud DNS** for DNS management
- **Cloud Armor** for WAF
- **Cloud Logging** alternative to Loki

### 6.3 Azure (AKS)

#### Infrastructure (Terraform)

```hcl
module "shopio_azure" {
  source = "github.com/shopio/terraform-modules//azure-aks"
  location = "germanywestcentral"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  # Frankfurt
  cluster_name = "shopio-prod"
  kubernetes_version = "1.30"
}

module "shopio_postgres_flexible" {
  source = "github.com/shopio/terraform-modules//azure-postgres"
  name = "shopio-prod-pg"
  version = "17"
  sku_name = "GP_Standard_D4ds_v5"
  high_availability_mode = "ZoneRedundant"
}

module "shopio_redis_azure" {
  source = "github.com/shopio/terraform-modules//azure-redis"
  name = "shopio-prod-redis"
  sku_name = "Premium"
  capacity = 1
}

module "shopio_storage_account" {
  source = "github.com/shopio/terraform-modules//azure-storage"
  name = "shopiomedia"
  account_tier = "Standard"
  account_replication_type = "ZRS"
}

module "shopio_keyvault" {
  source = "github.com/shopio/terraform-modules//azure-keyvault"
  name = "shopio-prod-kv"
  enable_purge_protection = true
}
```

#### Azure-specific features

- **Azure AD pod identity** / **Workload Identity**
- **Azure Managed Disk CSI**
- **Azure Application Gateway** alternative to NGINX
- **Azure Front Door** for WAF + CDN
- **Azure Monitor** for logs

### 6.4 Hetzner Cloud / bare metal

Cost-effective EU option (€100-1k/month for production).

#### Infrastructure (Terraform)

```hcl
module "shopio_hetzner" {
  source = "github.com/shopio/terraform-modules//hetzner-k3s"
  cluster_name = "shopio-prod"
  location = "fsn1"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  # Falkenstein DE
  control_plane_count = 3
  control_plane_server_type = "cax21"
  worker_count = 5
  worker_server_type = "cax31"
  ingress_load_balancer_type = "lb11"
}
```

#### K3s lightweight Kubernetes

```bash
# Master node setup
curl -sfL https://get.k3s.io | sh -s - server \
  --cluster-init \
  --tls-san hetzner.example.com

# Worker join
curl -sfL https://get.k3s.io | K3S_URL=https://master.example.com:6443 \
  K3S_TOKEN=<token> sh -
```

#### Hetzner-specific features

- **hcloud-cloud-controller-manager** for Hetzner load balancer integration
- **Hetzner CSI driver** for block storage
- **External Postgres** — use Postgres on dedicated VPS or Hetzner Cloud DB (Beta) OR self-managed
- **External Redis** — self-managed on VPS
- **External KMS** — HashiCorp Vault recommended

#### Backup strategy

- Hetzner Snapshots for VPS
- Postgres pg_dump to Hetzner S3-compatible Object Storage
- Cross-region replication to Helsinki

### 6.5 On-prem / private cloud

Full control deployment for enterprise + regulated industries.

#### Requirements

- VMware vSphere, Proxmox, or bare metal
- Kubernetes via kubeadm, k3s, RKE2, or OpenShift
- MetalLB for LoadBalancer support
- HashiCorp Vault for KMS
- Self-managed Postgres + Redis + Meilisearch
- Local object storage (Ceph, MinIO, or external NAS)
- Internal DNS + TLS via internal CA

#### Air-gapped option (Fáze 3+ enterprise)

For ultra-restricted environments:
- Local container registry (Harbor)
- Mirror dependencies (npm, Docker)
- Local AI provider (Ollama / vLLM with local models per `33 §4.9`)
- DeepL Enterprise on-prem (for translation)
- Local Anthropic API not supported; document waiver process

---

## 7. Database setup

### 7.1 PostgreSQL 17 requirements

Per `DEC-DB-001`:
- Postgres 17.x
- Extensions: `pgvector` (for AI RAG, per `08`+`33`), `pgcrypto`, `uuid-ossp`, `pg_trgm`, `btree_gin`, `ltree` (per `07`)
- UTF-8 encoding
- Locale: en_US.UTF-8 or cs_CZ.UTF-8 acceptable
- `shared_preload_libraries = 'pg_stat_statements,pgvector'`

### 7.2 Recommended configuration

For production (16 GB RAM dedicated):
```
shared_buffers = 4GB
effective_cache_size = 12GB
work_mem = 32MB
maintenance_work_mem = 1GB
max_connections = 200
wal_buffers = 64MB
checkpoint_completion_target = 0.9
random_page_cost = 1.1                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              # SSD
effective_io_concurrency = 200
max_worker_processes = 8
max_parallel_workers_per_gather = 4
```

### 7.3 Connection pooling

PgBouncer transaction-mode (per `31 §RULE-OPS-038`):
```
[databases]
shopio_prod = host=localhost port=5432 dbname=shopio_prod

[pgbouncer]
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
reserve_pool_size = 5
```

### 7.4 Replication

Production: streaming replication + logical for cross-region:
- Primary in eu-central-1
- 2 read replicas in same region
- 1 read replica cross-region (Paris) for DR

### 7.5 Backups

Per `31 §11.1`:
- WAL archive continuous (PITR support)
- Daily pg_dump compressed → S3
- Retention: 7d PITR, 30d daily, 1y monthly, 7y yearly
- Restore tested monthly

### 7.6 Initial schema setup

```bash
# Run all migrations
pnpm db:migrate

# Verify
psql -h <host> -U shopio -d shopio_prod -c '\dt'
# Should see ~150+ tables across 32 domains
```

### 7.7 RLS verification

After migration:
```sql
-- Check RLS enabled on tenant-scoped tables
SELECT tablename FROM pg_tables
  WHERE schemaname = 'public'
  AND tablename NOT IN (
    SELECT tablename FROM pg_tables t
      WHERE EXISTS (
        SELECT 1 FROM pg_policies p WHERE p.tablename = t.tablename
      )
  );
-- Should return only platform-wide tables (industry_profiles, ai_providers, etc.)
```

---

## 8. Redis setup

### 8.1 Requirements

- Redis 7.0+
- Persistence: AOF + RDB hybrid
- Maxmemory policy: `allkeys-lru` for cache, `noeviction` for BullMQ instances

### 8.2 Separate instances recommended (production)

```
redis-cache (volatile cache; allkeys-lru; 4GB)
redis-bullmq (job queues; noeviction; 8GB)
redis-sessions (user sessions; allkeys-lru; 2GB; AOF strict)
```

### 8.3 Managed alternatives

- AWS ElastiCache (Redis OSS or ValKey)
- GCP Memorystore
- Azure Cache for Redis
- Upstash (serverless, EU regions)

### 8.4 Configuration

```
maxmemory 8gb
maxmemory-policy noeviction
appendonly yes
appendfsync everysec
save 900 1
save 300 10
save 60 10000
```

### 8.5 Multi-AZ HA

Production: 3-node replica set with automatic failover via Sentinel OR managed service Multi-AZ.

---

## 9. Object storage

### 9.1 S3-compatible required

- AWS S3
- GCP Cloud Storage
- Azure Blob Storage
- Hetzner Object Storage
- MinIO (self-host)
- Ceph RGW (on-prem)
- Backblaze B2 / Wasabi (cost-effective alternatives)

### 9.2 Buckets needed

```
shopio-{env}-media          (product images, customer uploads)
shopio-{env}-backups        (database + Redis backups)
shopio-{env}-exports        (CSV exports, GDPR DSAR exports)
shopio-{env}-edge-bundles   (edge function bundles per `28`)
shopio-{env}-archives       (audit log cold storage per `30`)
```

### 9.3 Configuration

```bash
SHOPIO_S3_ENDPOINT=https://s3.eu-central-1.amazonaws.com
SHOPIO_S3_REGION=eu-central-1
SHOPIO_S3_ACCESS_KEY=<from-IAM>
SHOPIO_S3_SECRET_KEY=<from-IAM>
SHOPIO_S3_BUCKET_MEDIA=shopio-prod-media
SHOPIO_S3_BUCKET_BACKUPS=shopio-prod-backups
SHOPIO_S3_USE_SSL=true
```

### 9.4 Lifecycle policies

- `media/`: Standard tier, no expiry
- `backups/`: Move to Glacier after 30 days, delete after 7 years
- `exports/`: Delete after 90 days
- `archives/`: Glacier Deep Archive after 90 days

### 9.5 CDN front

CloudFront / Cloudflare R2 + Cache or similar pro static assets. Direct S3 only for backend.

---

## 10. Search (Meilisearch)

### 10.1 Why Meilisearch

Per `DEC-SEARCH-001`. Lightweight, fast, EU-friendly, easy ops.

### 10.2 Deployment

```yaml
# Helm chart values for Meilisearch
meilisearch:
  enabled: true
  replicas: 3
  persistence:
    enabled: true
    size: 50Gi
    storageClass: gp3
  resources:
    requests:
      cpu: 1
      memory: 4Gi
    limits:
      cpu: 4
      memory: 16Gi
  config:
    MEILI_ENV: production
    MEILI_MASTER_KEY: <strong-random>
    MEILI_DB_PATH: /meili_data
    MEILI_HTTP_ADDR: 0.0.0.0:7700
```

### 10.3 Initial indexing

```bash
kubectl -n shopio exec deploy/api-admin -- pnpm shopio:search:reindex --all
```

### 10.4 pgvector alternative

For AI RAG semantic search per `33 §6.1`, pgvector v Postgres je primární; Meilisearch jen keyword + facets. Není potřeba samostatný vector DB.

### 10.5 Backup

```bash
# Daily snapshot via Meilisearch API
curl -X POST -H "Authorization: Bearer <master-key>" \
  http://meilisearch:7700/snapshots
```

---

## 11. KMS / secrets

### 11.1 Provider choice

Per `30 §7.2`:

| Provider | Use case |
|---|---|
| AWS KMS | AWS deployment |
| GCP Cloud KMS | GCP deployment |
| Azure Key Vault | Azure deployment |
| HashiCorp Vault | Self-host / on-prem |
| Local sealed file | Dev only |

### 11.2 AWS KMS setup

```hcl
resource "aws_kms_key" "master" {
  description = "Shopio production master KEK"
  deletion_window_in_days = 30
  enable_key_rotation = true
  policy = data.aws_iam_policy_document.kms_master.json
}

resource "aws_kms_alias" "master" {
  name = "alias/shopio/prod/master"
  target_key_id = aws_kms_key.master.key_id
}
```

App access via IAM role (IRSA on EKS).

### 11.3 HashiCorp Vault setup

```bash
# Initialize Vault
vault operator init -key-shares=5 -key-threshold=3

# Enable transit secrets engine
vault secrets enable transit
vault write -f transit/keys/shopio-master

# App reads via Vault Agent or Kubernetes auth
```

### 11.4 Secrets at runtime

App reads via:
- IRSA (AWS) / Workload Identity (GCP) / Pod Identity (Azure)
- Vault Agent sidecar
- Kubernetes Secrets (less secure; only for local dev)

Per `30 §7.3` envelope encryption.

### 11.5 Required secrets

```
SHOPIO_JWT_SECRET (64 char random)
SHOPIO_ENCRYPTION_KEY (32 byte base64)
SHOPIO_SESSION_PEPPER (32 char random)
POSTGRES_PASSWORD
REDIS_PASSWORD
MEILI_MASTER_KEY
STRIPE_SECRET_KEY
ANTHROPIC_API_KEY
OPENAI_API_KEY (fallback)
SMTP_PASSWORD
CLOUDFLARE_API_TOKEN
SENTRY_DSN
```

---

## 12. TLS + DNS

### 12.1 Domain layout

```
your-domain.com              → Storefront (Next.js 16)
admin.your-domain.com        → Admin SPA (Vite + React 19)
api.your-domain.com          → API Gateway (Fastify)
mcp.your-domain.com          → MCP WebSocket server
cdn.your-domain.com          → Optional CDN (Cloudflare R2 / S3)
status.your-domain.com       → Status page
feeds.your-domain.com        → Comparison shopping feeds (Heuréka, etc.)
```

### 12.2 DNS records

```
A     your-domain.com         → <load_balancer_ip>
A     admin.your-domain.com   → <load_balancer_ip>
A     api.your-domain.com     → <load_balancer_ip>
A     mcp.your-domain.com     → <load_balancer_ip>
A     status.your-domain.com  → <load_balancer_ip>
A     feeds.your-domain.com   → <load_balancer_ip>
CNAME *.preview.your-domain.com → <preview_lb_ip>
TXT   _dmarc.your-domain.com  → "v=DMARC1; p=reject; rua=mailto:dmarc@your-domain.com"
TXT   your-domain.com         → "v=spf1 include:_spf.sendgrid.net -all"
TXT   selector1._domainkey.your-domain.com → "k=rsa; p=..." (DKIM)
```

### 12.3 Cloudflare front (recommended)

```bash
# Cloudflare API token + zone ID configured
# Origin pull: Cloudflare Origin Cert with mTLS to LB
# Page rules: aggressive cache for static + storefront edge
# WAF: OWASP CRS + custom rules
# Bot management + Turnstile
# Rate limiting at edge
```

### 12.4 TLS certificates

- **Cloud LB**: ACM (AWS), Google-managed (GCP), App Service Cert (Azure)
- **Self-managed**: cert-manager + Let's Encrypt
- **Cloudflare**: Origin Cert (free, 15-year)
- **Wildcard certs**: for `*.preview.your-domain.com` preview environments

### 12.5 Custom tenant domains

Tenants bring own domain (e.g., `shop.acme.com`):
1. Tenant adds custom domain in admin (per `22 §0.1`)
2. Tenant configures CNAME → `*.shopio-app.com`
3. Shopio verifies + auto-issues TLS via cert-manager
4. Stores in `domains` table per `22`

### 12.6 Verification

```bash
# Test TLS
curl -vI https://your-domain.com 2>&1 | grep -E '(SSL|HTTP)'

# Test DNS
dig +short your-domain.com
dig +short admin.your-domain.com

# Test HTTP→HTTPS redirect
curl -I http://your-domain.com
# Should return 301 → https
```

---

## 13. First-run initialization

### 13.1 Database migrations

```bash
# Apply all migrations
pnpm db:migrate

# Verify schema
pnpm db:status
# Should show "All migrations applied"
```

### 13.2 Seed core data

```bash
# Seed personas, permissions, AI use cases, integrations catalog, industry profiles, regulatory checklists
pnpm shopio:seed:core

# Verify
pnpm shopio:seed:core --dry-run --verify
```

### 13.3 Create first tenant + admin

```bash
pnpm shopio:init-tenant \
  --tenant-name "Your Company" \
  --tenant-slug "your-company" \
  --owner-email admin@your-company.com \
  --owner-password 'change-this-strong-password!' \
  --country-code CZ \
  --default-locale cs-CZ \
  --default-currency CZK
```

### 13.4 Configure essentials

After first login, complete:
- Onboarding wizard (per `27 §RULE-ADM-021`)
- Industry profile activation (per `34`)
- Payment provider connection
- Email provider configuration (transactional)
- Default theme installation
- Sub-processor disclosure review (per `30 §RULE-SEC-032`)

### 13.5 Verify deployment

```bash
# Health check endpoints
curl https://api.your-domain.com/health/live
curl https://api.your-domain.com/health/ready

# Storefront loads
curl -I https://your-domain.com

# Admin loads
curl -I https://admin.your-domain.com

# AI Copilot configured
# Try /admin/ai/copilot test prompt
```

### 13.6 Smoke tests

```bash
pnpm test:smoke --target https://your-domain.com
# Runs: signup → create product → place test order → fulfill → refund
# Should pass all
```

---

## 14. Configuration reference

### 14.1 Environment variables overview

Configured via `.env` (single-server) or Kubernetes Secrets (K8s). Common categories:

#### Core
```
NODE_ENV=production
SHOPIO_BASE_URL=https://your-domain.com
SHOPIO_ADMIN_URL=https://admin.your-domain.com
SHOPIO_API_URL=https://api.your-domain.com
SHOPIO_REGION=eu-central-1
SHOPIO_LOG_LEVEL=info
```

#### Database
```
DATABASE_URL=postgres://shopio:password@host:5432/shopio_prod?sslmode=require
DATABASE_REPLICA_URL=postgres://shopio:password@replica:5432/shopio_prod?sslmode=require
DATABASE_POOL_MAX=20
```

#### Redis
```
REDIS_URL=redis://:password@host:6379/0
REDIS_BULLMQ_URL=redis://:password@host:6379/1
REDIS_SESSIONS_URL=redis://:password@host:6379/2
```

#### Search
```
MEILISEARCH_HOST=http://meilisearch:7700
MEILISEARCH_API_KEY=<master-key>
```

#### Object storage
```
SHOPIO_S3_ENDPOINT=https://s3.eu-central-1.amazonaws.com
SHOPIO_S3_REGION=eu-central-1
SHOPIO_S3_ACCESS_KEY=AKIA...
SHOPIO_S3_SECRET_KEY=...
SHOPIO_S3_BUCKET_MEDIA=shopio-prod-media
SHOPIO_S3_BUCKET_BACKUPS=shopio-prod-backups
SHOPIO_S3_BUCKET_EXPORTS=shopio-prod-exports
SHOPIO_S3_BUCKET_ARCHIVES=shopio-prod-archives
SHOPIO_S3_BUCKET_EDGE_BUNDLES=shopio-prod-edge-bundles
SHOPIO_S3_USE_SSL=true
```

#### Security / KMS
```
SHOPIO_JWT_SECRET=<64-char-random>
SHOPIO_SESSION_PEPPER=<32-char-random>
SHOPIO_KMS_PROVIDER=aws_kms
SHOPIO_KMS_AWS_KEY_ARN=arn:aws:kms:eu-central-1:...:key/...
# Alternative for HashiCorp Vault:
# SHOPIO_KMS_PROVIDER=hashicorp_vault
# SHOPIO_VAULT_ADDR=https://vault.internal:8200
# SHOPIO_VAULT_TOKEN=<token>
SHOPIO_MFA_ISSUER=Shopio
SHOPIO_SESSION_IDLE_TIMEOUT_MIN=60
SHOPIO_SESSION_ABSOLUTE_TIMEOUT_MIN=4320
```

#### AI providers
```
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
SHOPIO_AI_DEFAULT_PROVIDER=anthropic
SHOPIO_AI_FALLBACK_PROVIDER=openai
SHOPIO_AI_DEFAULT_TOKEN_BUDGET_MONTHLY=1000000
```

#### Payment providers
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
GOPAY_GOID=...
GOPAY_CLIENT_ID=...
GOPAY_CLIENT_SECRET=...
COMGATE_MERCHANT_ID=...
COMGATE_SECRET=...
THEPAY_MERCHANT_ID=...
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
```

#### Email
```
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=<api-key>
SMTP_FROM=Shopio <hello@your-domain.com>
```

#### Cloudflare
```
CLOUDFLARE_API_TOKEN=<token>
CLOUDFLARE_ACCOUNT_ID=<account-id>
CLOUDFLARE_ZONE_ID=<zone-id>
```

#### Observability
```
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
OTEL_SERVICE_NAME=shopio
OTEL_RESOURCE_ATTRIBUTES=deployment.environment=production
SENTRY_DSN=https://....ingest.sentry.io/...
SENTRY_TRACES_SAMPLE_RATE=0.1
```

#### Feature flags
```
UNLEASH_URL=http://unleash:4242/api
UNLEASH_API_TOKEN=*:production.<token>
```

### 14.2 Tenant-specific config

Stored in `tenants.settings` JSONB (per `03 §1`). Per-tenant via admin UI:
- Default locale + currency
- Industry profiles activated
- Theme
- Payment / shipping config
- Tax config
- Security settings (per `30 §6.5`)
- AI settings (per `33 §3.3`)
- Integration credentials (encrypted)

### 14.3 Feature flags

Operational flags via Unleash (per `31 §6.3`):
- `new_checkout_flow`, `customer_chatbot_enabled`, `marketplace_mode`, `subscriptions_v2`, etc.

---

## 15. Backups

### 15.1 What to back up

Per `31 §11.1`:

| Resource | Method | Frequency | Retention |
|---|---|---|---|
| Postgres | PITR + daily snapshot | continuous + nightly | 7d PITR, 30d daily, 1y monthly, 7y yearly |
| Redis | RDB snapshot + AOF | hourly RDB | 7d |
| Meilisearch | snapshot to S3 | daily | 14d |
| S3 media | versioning + CRR | continuous | 30d versions, 7y archive |
| KMS keys | provider-managed replication | continuous | per provider |
| Audit log | dump to immutable S3 Glacier | hourly | 5 years |
| Helm values + Terraform state | git commits + S3 versioned | continuous | indefinite |

### 15.2 Postgres backup (self-managed)

```bash
# WAL archiving
archive_mode = on
archive_command = 'aws s3 cp %p s3://shopio-prod-wal/%f'

# Daily pg_dump
pg_dump -Fc -d shopio_prod | gzip | aws s3 cp - s3://shopio-prod-backups/postgres/$(date +%Y%m%d).dump.gz
```

### 15.3 Postgres backup (managed)

- RDS automated backups + manual snapshots
- Cloud SQL automated backups
- Azure Postgres Flexible Server geo-redundant backups

Configure per cloud-specific Terraform module.

### 15.4 Backup encryption

Per `30 §7.8`. Backups encrypted with separate KEK; KEK escrowed for business continuity.

### 15.5 Restore testing

Monthly automated:
```bash
# Pull random backup, restore to isolated cluster
pnpm shopio:backup:restore-test --backup-date <random>
# Verify schema + sample queries
# Smoke tests pass
# Report results
```

### 15.6 Disaster recovery

Per `31 §10`. Multi-region active-warm:
- Primary writes → async logical replication → DR region
- Failover runbook `RUN-OPS-001`
- Quarterly DR drills

---

## 16. Monitoring + observability

### 16.1 OpenTelemetry instrumentation

Apps emit traces + metrics + logs via OpenTelemetry SDK. Per `31 §7`.

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
OTEL_SERVICE_NAME=api-gateway
OTEL_RESOURCE_ATTRIBUTES=deployment.environment=production,service.version=1.0.0
```

### 16.2 Grafana stack (recommended)

Self-host EU:
- **Mimir** — metrics (Prometheus-compatible)
- **Loki** — logs
- **Tempo** — traces
- **Grafana** — dashboards + alerting

Install via Helm:
```bash
helm repo add grafana https://grafana.github.io/helm-charts
helm install grafana-stack grafana/loki-stack \
  --namespace observability \
  --create-namespace \
  --values monitoring-values.yaml
```

### 16.3 Sentry self-host

For application errors. Per `31 §7.1`.

```bash
git clone https://github.com/getsentry/self-hosted sentry
cd sentry
./install.sh
```

Apps configured with `SENTRY_DSN=https://...self-hosted-sentry/...`.

### 16.4 Alerting

Alertmanager (bundled with Mimir) routes to:
- PagerDuty (P1/P2)
- Slack (P2/P3)
- Email (P4 weekly digest)

Standard alert rules per `31 §8.3`.

### 16.5 Status page

Per `31 §12.7`. Cachet self-host OR statuspage.io.

```bash
# Self-host Cachet
docker run -d \
  -e DB_DRIVER=pgsql \
  -e DB_HOST=postgres \
  -e DB_DATABASE=cachet \
  -p 8000:8000 \
  cachethq/docker:latest
```

Configure auto-update from monitoring.

### 16.6 Health endpoints

Every service exposes:
- `/health/live` — process up
- `/health/ready` — dependencies healthy
- `/health/startup` — initial load complete
- `/metrics` — Prometheus metrics (internal only)

Kubernetes uses these for liveness/readiness/startup probes.

### 16.7 SLO tracking

Per `31 §9`. Burn-rate alerts configured. Dashboards available at `https://grafana.your-domain.com`.

---

## 17. Upgrade procedures

### 17.1 Version compatibility

Shopio follows semver:
- **Major** (1.x → 2.x): breaking changes; manual migration steps
- **Minor** (1.0 → 1.1): backward-compat features; database migration
- **Patch** (1.0.0 → 1.0.1): bug fixes; safe

Upgrade path:
- Patch: anytime
- Minor: planned maintenance window recommended
- Major: announced 90 days prior; migration guide provided

### 17.2 Pre-upgrade checklist

- [ ] Read release notes
- [ ] Run backup
- [ ] Test in staging first
- [ ] Schedule maintenance window if downtime expected
- [ ] Notify customers if SLA-impacting

### 17.3 Single-server Docker upgrade

```bash
# Backup first!
/etc/cron.daily/shopio-backup

# Pull new images
cd /home/shopio/shopio-self-host
git pull
docker compose -f docker-compose.prod.yaml pull

# Restart with new images
docker compose -f docker-compose.prod.yaml up -d

# Run migrations
docker compose -f docker-compose.prod.yaml exec api pnpm db:migrate

# Verify
docker compose -f docker-compose.prod.yaml ps
curl https://api.your-domain.com/health/ready
```

### 17.4 Kubernetes upgrade

```bash
# Backup first
pnpm shopio:backup:trigger

# Upgrade Helm release
helm upgrade shopio shopio/shopio \
  --namespace shopio \
  --values values-production.yaml \
  --version 1.1.0 \
  --atomic \
  --timeout 10m

# Watch progress
kubectl -n shopio get pods -w

# Verify
kubectl -n shopio rollout status deployment/api-gateway
```

ArgoCD recommended over manual `helm upgrade` for GitOps (per `31 §5.2`).

### 17.5 Database schema migrations

Per `31 §5.7`. Backward-compatible only. Migrations run during deploy:

```bash
kubectl -n shopio exec deploy/api-admin -- pnpm db:migrate
```

Long migrations (>10s lock): scheduled maintenance window OR online via pgroll-like patterns.

### 17.6 Rollback

```bash
# Helm rollback
helm rollback shopio --namespace shopio

# ArgoCD: click "Rollback" in UI

# Database: forward-only typically; restore from backup if needed
```

### 17.7 API version compatibility

Per `28 §RULE-DEV-001`. Date-versioned API; 12-month minimum support. Apps + integrations should update before sunset.

### 17.8 Plugin / app compatibility

Plugin authors notified at major version upgrades. Apps tested against new platform version before tenant migration. Per `28 §RULE-DEV-029`.

---

## 18. Troubleshooting

### 18.1 Common issues

#### 18.1.1 Pods crashing on startup

```bash
kubectl -n shopio describe pod <pod-name>
kubectl -n shopio logs <pod-name> --previous
```

Common causes:
- Missing env var → check Secret + ConfigMap
- Database unreachable → check DB host + port + creds
- Migration not run → `pnpm db:migrate`
- Permission denied → check IAM / RBAC

#### 18.1.2 Slow database queries

```sql
-- Check slow queries
SELECT query, calls, mean_exec_time, total_exec_time
  FROM pg_stat_statements
  ORDER BY total_exec_time DESC
  LIMIT 20;

-- Check missing indexes (look for high seq_scan)
SELECT schemaname, tablename, seq_scan, seq_tup_read, idx_scan, idx_tup_fetch
  FROM pg_stat_user_tables
  WHERE seq_scan > 10000
  ORDER BY seq_tup_read DESC;
```

Common: missing index on tenant_id-prefixed query.

#### 18.1.3 Memory pressure

```bash
kubectl -n shopio top pods
# Identify high-memory pods
# Check OOMKilled events in describe
```

Tune `requests` + `limits` per service.

#### 18.1.4 Queue backlog

```bash
# Check BullMQ queue depth
redis-cli -h <redis-host> -p 6379 -a <password>
> KEYS bull:*:waiting
> LLEN bull:orders:waiting
```

If > 10k:
- Scale up worker replicas
- Check for worker errors (Sentry)
- Verify external dependencies (rate limits, downstream APIs)

#### 18.1.5 High AI cost

Per `33 §8.7`. Check usage dashboard:
- Which use case dominates
- Which model dominates
- Consider downgrade to Haiku
- Enable prompt caching aggressively
- Adjust per-tenant budgets

#### 18.1.6 Webhook delivery failures

```bash
# Check delivery log per `28`
kubectl -n shopio exec deploy/api-developer -- pnpm shopio:webhooks:diagnose <subscription_id>
```

Common: subscriber endpoint slow / unreachable, signature mismatch, idempotency duplicates.

#### 18.1.7 Search not indexing

```bash
# Trigger reindex
kubectl -n shopio exec deploy/api-admin -- pnpm shopio:search:reindex --all
```

Check Meilisearch logs + pgvector for AI semantic separately.

### 18.2 Diagnostic commands

```bash
# Cluster health
kubectl get nodes
kubectl get pods --all-namespaces | grep -v Running

# Resource usage
kubectl top nodes
kubectl top pods -n shopio

# Recent events
kubectl get events -n shopio --sort-by=.lastTimestamp

# Postgres connections
psql -U shopio -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';"

# Redis info
redis-cli -h <host> -a <pass> INFO memory
redis-cli -h <host> -a <pass> INFO clients
```

### 18.3 Runbooks

Per `31 §13.5`. 30+ runbooks shipped in `docs/runbooks/`:
- `RUN-OPS-001` DR failover Frankfurt → Paris
- `RUN-SEC-001` Suspected credential leak
- `RUN-SEC-006` Mass account takeover wave
- `RUN-PAY-001` Payment provider outage
- `RUN-AI-001` AI provider circuit breaker open
- ...

### 18.4 Support channels

- **Documentation**: docs.shopio.com
- **Community**: community.shopio.com (Discourse forum)
- **GitHub Issues**: github.com/shopio/shopio/issues (OSS)
- **Discord/Slack**: community channels
- **Commercial support** (Shopio Cloud): support@shopio.com SLA
- **Enterprise support**: dedicated TAM (Fáze 3+)

---

## 19. Hardening checklist

### 19.1 Network

- [ ] Cloudflare or equivalent CDN/WAF in front
- [ ] Origin LB private (Cloudflare Origin Cert + mTLS)
- [ ] All public services HTTPS-only (HSTS preload)
- [ ] Internal services on private subnets
- [ ] Egress allowlist enforced (per `30 §10.6`)
- [ ] Firewall rules (UFW / Cloud SG) reviewed
- [ ] DDoS protection enabled
- [ ] Rate limiting at edge

### 19.2 Auth

- [ ] MFA enforced for admins (per `30 §RULE-SEC-002`)
- [ ] Passkey-first signup enabled
- [ ] Password policy enforced (12+ chars, HIBP check)
- [ ] Session timeouts configured
- [ ] IP allowlist for super-sensitive tenants (optional)
- [ ] SSO configured for enterprise tenants (Fáze 2)

### 19.3 Secrets

- [ ] KMS provider configured (not local sealed)
- [ ] Per-tenant KEK provisioning enabled
- [ ] Pepper rotated quarterly
- [ ] JWT signing key rotated monthly
- [ ] All secrets in KMS / Vault, never in plaintext
- [ ] CI secret scanning enabled
- [ ] No secrets in container images

### 19.4 Audit + compliance

- [ ] Audit log immutable + hash-chained
- [ ] Hourly signed batches to S3 Glacier
- [ ] GDPR DSAR + erasure workflows tested
- [ ] PCI SAQ A confirmed (no card data in our infra)
- [ ] Sub-processor list public
- [ ] DPA templates ready
- [ ] Privacy policy + ToS published
- [ ] Cookie consent banner active

### 19.5 Operations

- [ ] All deployments via signed images (cosign)
- [ ] Image vulnerability scans gate deploys
- [ ] Backup tested monthly
- [ ] DR drill quarterly
- [ ] On-call rotation configured
- [ ] Runbooks for top 30 alerts
- [ ] Status page live
- [ ] Maintenance window communication ready

### 19.6 Data

- [ ] PII fields envelope-encrypted (per `30 §9.3`)
- [ ] RLS enabled all tenant tables
- [ ] Database connections SSL-required
- [ ] Backups encrypted with separate KEK
- [ ] Backup access dual-control
- [ ] Data residency EU primary

### 19.7 Code

- [ ] SAST / DAST / SCA in CI (per `30 §12.1`)
- [ ] Dependency lockfiles committed
- [ ] Dependabot / Renovate weekly PRs
- [ ] Pre-commit hooks (gitleaks, lint)
- [ ] Code review required (2 reviewers for security-sensitive)

### 19.8 Application

- [ ] Strict CSP headers (per `30 §10.3`)
- [ ] All security headers set
- [ ] CSRF protection enabled
- [ ] SSRF egress allowlist enforced
- [ ] Input validation Zod schemas
- [ ] File upload virus scan
- [ ] Rate limiting per endpoint

---

## 20. Compliance for self-host

### 20.1 GDPR

Self-host operator becomes **data controller** for their merchants/customers. Responsibilities:
- Privacy policy + ToS reflecting your role
- DSAR + erasure workflows (platform supports; operator triggers)
- Breach notification 72h to local DPA
- DPA with sub-processors (AWS, Anthropic, Stripe, ...)
- Records of Processing Activities (RoPA)
- DPIA for high-risk processing

Platform provides tools; operator owns process.

### 20.2 PCI DSS

Per `13`. Shopio = SAQ A (tokenization only; no card data). Self-host operator:
- Annual SAQ A self-assessment
- Quarterly ASV scans
- Network segmentation
- Access controls per PCI

If you process / store card data (deviate from SAQ A): full SAQ D / level 1 audit required. Strongly discouraged.

### 20.3 ISO 27001

Self-host operator can pursue own certification:
- Shopio core helps via security controls
- Operator's responsibility for:
  - ISMS policies
  - Risk assessment
  - Incident management
  - Continuous improvement

Annual external audit by accredited body.

### 20.4 SOC 2

Similar pattern. Operator pursues own SOC 2 Type II for their service. Shopio provides controls evidence; operator's process responsibility.

### 20.5 NIS2 (EU)

If self-host operator qualifies as "essential" or "important entity" per NIS2:
- Risk management measures (technical + organizational)
- Incident reporting to national CSIRT (24h early warning, 72h notification, 1mo final)
- Supply chain security
- Vulnerability disclosure process
- Crisis management procedures

Platform doesn't make operator NIS2-compliant; operator must implement.

### 20.6 EU AI Act

For AI features (per `33`):
- DPIA for high-risk use cases
- Transparency disclosures to customers
- Human-in-loop for high-risk decisions
- 5-year audit log retention for high-risk
- AI literacy program for staff

Operator owns deployment-specific compliance.

### 20.7 Local laws

Czech Republic:
- ZÁKON č. 235/2004 Sb. (DPH/VAT)
- ZÁKON č. 110/2019 Sb. (GDPR national implementation)
- Účetnictví ZÁKON č. 563/1991 Sb.

Other EU countries: similar national implementations of GDPR + tax + accounting.

Engage local accountant + lawyer.

### 20.8 Customer DPA (operator → merchants)

When you self-host for paying customers, you become data processor under GDPR for them:
- Sign DPA with each merchant
- Implement appropriate technical + organizational measures (which platform provides)
- Sub-processor list disclosure
- Audit cooperation

Shopio provides template DPAs.

---

## 21. Open questions

### Q-DEPLOY-001: Helm chart distribution
**Otázka:** Public OCI registry (ghcr.io) free OR paid (Artifact Hub paid tier)?

**Status:** Public OCI registry primary. Mirror to Artifact Hub for discovery. Paid options Fáze 3+ if needed.

### Q-DEPLOY-002: Air-gapped distribution
**Otázka:** Full Apache 2.0 distro including mirror of dependencies for air-gap?

**Status:** Fáze 3+. Shopio provides reference Harbor + dependency mirror docs. Customers responsible for execution.

### Q-DEPLOY-003: Terraform module versioning
**Otázka:** Pin modules per Shopio version OR independent?

**Status:** Independent versioning; module supports last 2 Shopio versions. Documented compatibility matrix.

### Q-DEPLOY-004: Database choice flexibility
**Otázka:** Support Postgres 17+ only, or also Postgres-compatible (CockroachDB, YugabyteDB)?

**Status:** Postgres 17+ primary. CockroachDB experimental Fáze 3+ for global tenants. Other variants untested.

### Q-DEPLOY-005: Operator SLA when self-hosting
**Otázka:** Self-host operator gets Shopio's SLA OR responsible themselves?

**Status:** Self-host: operator owns SLA. Shopio supports via community + paid support tier (Fáze 2+).

### Q-DEPLOY-006: License key validation
**Otázka:** Commercial modules license key online check OR offline?

**Status:** Offline by default (privacy-respecting); periodic online check for renewal (Fáze 2). Air-gap exemption documented.

### Q-DEPLOY-007: Multi-tenant self-host
**Otázka:** Single self-hosted instance running multiple tenants (e.g., agency hosting clients)?

**Status:** Yes — Shopio multi-tenant by default. Agency operator manages tenants per `36 §9` agency mode.

### Q-DEPLOY-008: Backup retention regulatory
**Otázka:** EU regulations may require longer retention than 7 years?

**Status:** 7 years matches CZ accounting law (§28 Zákon č. 563/1991 Sb.). Other regulations (e.g., medical) may extend; operator configures.

### Q-DEPLOY-009: GPU support for self-host AI
**Otázka:** Local LLM (Ollama) needs GPU. Supported deployment patterns?

**Status:** Documented patterns for NVIDIA GPUs (CUDA), AWS / GCP / Azure GPU node pools. AMD ROCm Fáze 3+.

### Q-DEPLOY-010: Edge function runtime self-host
**Otázka:** Deno Deploy is hosted; for self-host?

**Status:** Self-host: Deno standalone with sandboxing OR custom V8 runtime. Documented per `28 §9`. CF Workers not self-hostable.

### Q-DEPLOY-011: Service mesh choice
**Otázka:** Linkerd primary, but operator may prefer Istio / Cilium?

**Status:** Linkerd default (lightweight). Istio + Cilium compatible (operator config). Documented values.yaml overrides.

### Q-DEPLOY-012: Migration self-host → Shopio Cloud
**Otázka:** Path for self-host customer to move to Shopio Cloud?

**Status:** Export → import workflow. Shopio team assists migration. Fáze 2+ documented.

### Q-DEPLOY-013: Reverse migration (Cloud → self-host)
**Otázka:** Cloud customer wants to migrate to self-host (data sovereignty, cost)?

**Status:** Full export (DB dump + media + config). Operator imports. Shopio doesn't charge migration; supports as community.

### Q-DEPLOY-014: Premium / enterprise support tiers
**Otázka:** Paid support for self-host operators?

**Status:** Fáze 2 launch:
- **Community** — free, GitHub + Discord
- **Pro Support** — €500/month, business hours, response SLA
- **Enterprise Support** — Custom, 24×7, dedicated TAM, on-site option

### Q-DEPLOY-015: Compliance attestations + certifications shared
**Otázka:** Shopio Cloud's ISO 27001 / SOC 2 — extends to self-host?

**Status:** Cloud certifications apply only to Shopio Cloud. Self-host operator certifies own deployment. Shopio provides controls documentation to support operator audits.

---

## 📅 Změny

| Datum | Změna |
|---|---|
| 2026-05-20 | Initial — Deployment Guide. Self-host instalace pro Apache 2.0 distro. Local dev (docker-compose) → single-server Docker → Kubernetes (Helm) → cloud-specific (AWS EKS / GCP GKE / Azure AKS / Hetzner / on-prem). Detailed setup pro Postgres 17 + Redis 7 + Meilisearch + S3 + KMS (AWS/GCP/Azure/Vault). TLS + DNS guidance. First-run init + smoke tests. Configuration env var reference (~50 vars). Backup + DR + monitoring + status page setup. Upgrade procedures. Troubleshooting catalog + runbook references. Hardening checklist (8 sections, 50+ items). Compliance considerations (GDPR / PCI / ISO 27001 / SOC 2 / NIS2 / EU AI Act / CZ local). 15 open questions. |

---

**Konec Deployment Guide.**

➡️ **Phase 6 (AI & Industry-specific) kompletní.**

➡️ **Build specification — všech 39 dokumentů hotových** 🎯

Návrat: [`00-MASTER-INDEX.md`](00-MASTER-INDEX.md)







