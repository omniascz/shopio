# Shopio Fáze 0 — Infrastructure Setup Checklist

> Sekvence založení provozních účtů. Cílem je mít vše ready pro Fáze 1 implementation (Q3 2026).

**Update logs:** poznamenat datum + IDs jakmile něco založíš.

---

## 🚦 Sequence (doporučené pořadí)

```
Week 1-2: Legal foundation
  └─ s.r.o. setup (máš) → bank account → accountant

Week 2-3: Domain + identity
  └─ Domains → email → Google Workspace / Proton Business

Week 3-4: Core infrastructure accounts
  └─ GitHub → AWS → Cloudflare → KMS

Week 4-6: Service accounts (development blockers)
  └─ Anthropic → OpenAI → Stripe (test) → Sentry → Linear

Week 6-8: Email + comms
  └─ SendGrid/Postmark/Brevo → Discord/Slack community

Week 8-10: Compliance + business tooling
  └─ Drata (Fáze 2) → DPO designation → CRM (Fáze 1)
```

---

## 📋 Detailed checklist

### 1. Domains (Week 1-2)

#### Primary registrations

- [ ] `shopio.com` — primary marketing + production
- [ ] `shopio.app` — alternative; or as backup
- [ ] `shopio.cloud` — Shopio Cloud SaaS
- [ ] `shopio.dev` — developer portal
- [ ] `shopio.cz` — Czech local
- [ ] `shopio.sk` — Slovak (Fáze 2)
- [ ] `shopio.de` — German (Fáze 2)
- [ ] `shopio.pl` — Polish (Fáze 2)

**Registrar doporučení:** Cloudflare Registrar (cost +- ICANN fee, no markup, free WHOIS privacy, easy DNS migration). Alternative: Porkbun, Namecheap, GoDaddy (drahé).

**Cost:** 8-15 EUR / .com / rok via Cloudflare. Celkem ~80 EUR / Fáze 0 setup.

#### DNS setup

- [ ] Cloudflare DNS aktivní pro všechny domains
- [ ] DNSSEC enabled
- [ ] DMARC record (`v=DMARC1; p=quarantine; rua=mailto:dmarc@shopio.com`)
- [ ] SPF record (`v=spf1 include:_spf.sendgrid.net -all`)
- [ ] DKIM nastavena s email providerem
- [ ] Hostname verification záznamy pro SaaS účty

**Zaznamenat tady:**

- Registrar account ID: \***\*\_\_\_\*\***
- Date acquired: \***\*\_\_\_\*\***

---

### 2. Email + Identity (Week 2-3)

#### Email service

**Doporučení:** **Google Workspace Business Starter** (€6/user/month) NEBO **Proton Business** (€7/user/month — EU + E2E encrypted).

Founder-only Fáze 0 → 1-2 emaily:

- [ ] `hello@shopio.com` (public)
- [ ] `support@shopio.com` (forwarding alias initially)
- [ ] `privacy@shopio.com` (forwarding to founder)
- [ ] `dpo@shopio.com` (forwarding to founder)
- [ ] `security@shopio.com` (forwarding)
- [ ] `contributors@shopio.com` (forwarding)
- [ ] `noreply@shopio.com` (send-only via SendGrid)

#### Identity choice

- [ ] **Founder personal Google account** — fastest start; migrate later
- [ ] **Shopio Workspace** — professional from day 1; €6-7/month

**Doporučuji:** Shopio Workspace Day 1. Founder personal email pro registraci pak migrate.

**Zaznamenat:**

- Email provider: \***\*\_\_\_\*\***
- Admin account: \***\*\_\_\_\*\***
- Date: \***\*\_\_\_\*\***

---

### 3. GitHub (Week 2-3)

- [ ] GitHub repo `github.com/omniascz/shopio` created (per Track A)
- [ ] Branch protection on `main` (1 reviewer, status checks)
- [ ] Secrets configured in CI:
  - `ANTHROPIC_API_KEY` (test tier)
  - `CODECOV_TOKEN` (if using)
- [ ] Dependabot ON (per `.github/dependabot.yml`)
- [ ] Security advisories enabled
- [ ] GitHub Sponsors / GitHub Stars (consider Fáze 2+)
- [ ] **Možná v budoucnu**: přejít na GitHub Organization `shopio` (až je org name dostupné)

**Plan tier:** Free tier dostatečný pro Fáze 0-1. **Team tier** ($4/user/month) až přidáš collaborators (Fáze 2).

---

### 4. AWS (Week 3-4)

**Primary cloud per `01 DEC-OPS-001`.**

- [ ] AWS account vytvořen (root email = founder Shopio Workspace email)
- [ ] Root MFA aktivován (hardware token preferred: YubiKey)
- [ ] **IAM Identity Center (SSO)** zapnutý — root nikdy pro daily use
- [ ] AWS Organization created (pro budoucí accounts splitting)
- [ ] Billing alerts: €50, €200, €500, €1000 thresholds
- [ ] Service control policies (blokovat US regions, jen EU)
- [ ] Cost Explorer + Cost Anomaly Detection aktivováno
- [ ] CloudTrail enabled (audit log)
- [ ] EU region selected: **eu-central-1** (Frankfurt) primary
- [ ] DR region prepared: **eu-west-3** (Paris) — později

**Initial costs:** prakticky €0 dokud nezačneš provisionovat resources. Fáze 0 setup nemá production load.

**Service quota requests** (Fáze 1 pre-requisite):

- [ ] EKS cluster quota: 2-3 clusters
- [ ] EC2 vCPU quota: 50+ vCPUs
- [ ] RDS instance class: db.m6g.large

---

### 5. Cloudflare (Week 3-4)

**Edge per `30 §10.2` + `31 §3.5`.**

- [ ] Cloudflare account (může být stejný co používáš pro domain registrar)
- [ ] Zone added pro každý domain
- [ ] DNS nameservers updated (4-12 hodin propagation)
- [ ] **Plan tier**:
  - Fáze 0-1: **Free** (sufficient for development)
  - Fáze 2+: **Pro** ($20/month) for image optimization
  - Production: **Business** ($200/month) for advanced WAF + page rules
- [ ] WAF ruleset: OWASP Core Rule Set enabled
- [ ] Turnstile site key generated (per `30 §RULE-SEC-014`)
- [ ] API token created (scoped: DNS + WAF management; for CI)

**Estimated cost:** €0-20/month Fáze 0-1. €200-500/month production.

---

### 6. KMS (Week 4)

Per `30 §7.2`.

**Option A: AWS KMS** (recommended pro AWS-aligned)

- [ ] KMS master key vytvořen (alias `alias/shopio/dev/master`)
- [ ] Per-tenant KEK provisioning automation (via Terraform Fáze 1)
- [ ] Cross-region replication for DR
- [ ] **Cost**: ~$1/key/month + $0.03/10k API calls

**Option B: HashiCorp Vault** (recommended self-host + air-gap)

- [ ] HCP Vault free tier OR self-hosted on AWS EC2
- [ ] Transit secrets engine enabled
- [ ] Kubernetes auth method (Fáze 1)
- [ ] **Cost**: HCP Vault €0 dev tier; self-host EC2 t3.medium ~$30/month

**Doporučení:** AWS KMS Fáze 0-1 (simpler). Vault assessment Fáze 3 pro air-gap customers.

---

### 7. AI providers (Week 4-6)

#### Anthropic (PRIMARY per `01 DEC-AI-001`)

- [ ] Account at https://console.anthropic.com
- [ ] **Tier 2+** (pre-pay €100+ to unlock production quotas)
- [ ] DPA signed (Workspace settings)
- [ ] **Zero-retention enterprise** mode requested (essential pro GDPR)
- [ ] API key vytvořen + uložen v secrets manager (NOT v `.env` committed)
- [ ] Usage budget alert: €50/month dev, €500/month Fáze 1

**Models používané:**

- `claude-opus-4-7[1m]` — flagship (analytics, complex reasoning)
- `claude-sonnet-4-6` — balanced (most use cases)
- `claude-haiku-4-5-20251001` — fast (translation, classify)

**Initial cost:** €0-50/month dev usage.

#### OpenAI (FALLBACK per `01 DEC-AI-001`)

- [ ] Account at https://platform.openai.com
- [ ] **Tier 2+** ($50 pre-pay)
- [ ] EU data residency selected
- [ ] DPA signed
- [ ] API key
- [ ] Budget alert: $50/month dev

---

### 8. Payment providers (Week 5-6)

#### Stripe (PRIMARY)

- [ ] Account at https://dashboard.stripe.com (Shopio Workspace email)
- [ ] Czech entity onboarded (IČO + business verification)
- [ ] **Stripe Connect platform** (pro marketplace mode Fáze 4)
- [ ] Test mode keys obtained (publishable + secret)
- [ ] Webhook endpoint configured (později když máš deployment)
- [ ] **DPA signed**
- [ ] Activation pending live mode (vyžaduje bank account + verified business)

**Cost:** No monthly fee. Standard Stripe rates 1.4% + 0.25 EUR for EEA cards.

#### GoPay (CZ secondary)

- [ ] Account at https://www.gopay.com
- [ ] Czech entity onboarded
- [ ] Test merchant ID + credentials
- [ ] DPA signed

#### ComGate (CZ secondary)

- [ ] Account at https://comgate.cz
- [ ] Same setup

**Strategy:** Stripe pro initial Fáze 1, add GoPay + ComGate jako Czech alternative pre-MVP launch.

---

### 9. Email service (Week 6)

Per `01 DEC-EMAIL-001` (TBD finalize):

**Option A: SendGrid** (global popular)

- [ ] Account + DKIM verified
- [ ] **EU region** selected
- [ ] DPA signed
- [ ] Plan: Free 100/day → Essentials €19.95/month (50k emails)

**Option B: Postmark** (EU-friendly, transactional focus)

- [ ] Account + DKIM
- [ ] EU server selected
- [ ] DPA
- [ ] Cost: $10/month 10k emails

**Option C: Brevo (Sendinblue)** (EU-native + transactional + marketing combined)

- [ ] Account
- [ ] DKIM + IP warmup
- [ ] DPA (already EU-based)
- [ ] Cost: Free 300/day → €25/month 20k emails

**Doporučení:** **Brevo** pro EU + integrated marketing capability. SendGrid backup.

---

### 10. Monitoring + observability (Week 6-8)

#### Sentry

- [ ] Self-host Sentry on AWS EC2 (free) OR cloud Sentry (Team €26/month)
- [ ] EU region (if cloud)
- [ ] DSN generated for each app (storefront, admin, api)
- [ ] PII scrubbing rules configured

**Doporučení:** Cloud Sentry pro Fáze 0-1 (rychlejší setup). Self-host Fáze 2+ pro full EU sovereignty.

#### Grafana stack (Fáze 1+)

- [ ] Grafana Cloud free tier (cheap) OR self-host on K8s (Fáze 2)
- [ ] OpenTelemetry collector configured
- [ ] Initial dashboards from `31-operations.md §7.6`

---

### 11. Project management + collaboration (Week 2-4)

#### Linear (recommended)

- [ ] Free workspace (founder solo OK)
- [ ] Initial projects: "Fáze 0 Foundation", "Fáze 1 MVP — Wave 1 Core"
- [ ] Webhook do Slack (later)

#### Alternative: Notion

- [ ] Workspace
- [ ] Docs database
- [ ] Roadmap kanban

#### Communication (later)

- [ ] Discord community server (Fáze 1 launch)
- [ ] Slack pro team comms (Fáze 2 first hire)

---

### 12. Compliance tooling (Fáze 2 preparation)

- [ ] **Drata** assessment for ISO 27001 + SOC 2 prep (~€5-10k/year; sign Fáze 1)
- [ ] **DPO assignment**: external DPO service contract (CZ providers: Aignos, Vědící spol.) — €200-500/month
- [ ] **Legal counsel**: retainer with EU SaaS-savvy firma (€500/month basic)
- [ ] **Accountant** for monthly bookkeeping (CZ: ~€100-300/month)

---

## 💰 Estimated Fáze 0 costs

| Category                         | Monthly           | One-time                   |
| -------------------------------- | ----------------- | -------------------------- |
| Domains (Cloudflare)             | €0                | €80 (4-5 domains × 1 year) |
| Google/Proton Workspace (1 user) | €6-7              | —                          |
| GitHub                           | €0 (free tier)    | —                          |
| AWS (no resources yet)           | €0-10             | —                          |
| Cloudflare                       | €0 (free tier)    | —                          |
| Anthropic dev usage              | €0-30             | —                          |
| OpenAI dev usage                 | €0-20             | —                          |
| Stripe (no production)           | €0                | —                          |
| Sentry team                      | €0-26             | —                          |
| Brevo (test send)                | €0 (free tier)    | —                          |
| Linear                           | €0 (free tier)    | —                          |
| **Subtotal Fáze 0**              | **€10-100/month** | **€100-200**               |

**Účetní + DPO** přijde až Fáze 1 (post-launch), takže Fáze 0 burn rate je velmi nízký.

---

## ✅ Sign-off před Fáze 1 start

Před Fáze 1 launch musíš mít:

- [ ] All Fáze 0 accounts vytvořeny + secured (MFA všude)
- [ ] All DPAs podepsány s sub-processory
- [ ] Sub-processor list aktualizovaný v `legal/sub-processors.md`
- [ ] Privacy Policy + ToS reviewed by lawyer (CZ)
- [ ] First 5 design partners identifikováni + LOI signed
- [ ] First Drizzle migration deployed (Fáze 1 wave 1 start)
- [ ] Test order placed end-to-end (Stripe test mode + email + storage)

---

## 📞 Doporučení k onboardingu

Pro každý service:

1. Použij **Shopio Workspace email** (ne osobní) pro account registration
2. **MFA okamžitě** (Authy nebo Bitwarden TOTP)
3. **Password manager** (1Password, Bitwarden) pro všechna credentials
4. **Document credentials** v secure team vault (1Password Business € 8/user/month — investice se vyplatí)
5. **Sign DPAs** ASAP — některé providers blokují production až po DPA

---

**DRAFT — vyžaduje:**

- [ ] Customer feedback po Fáze 0 walk-through
- [ ] Actual cost tracking
- [ ] Sequence adjustment based on dependencies
