# Security Policy (Public) — DRAFT

> ⚠️ DRAFT. Veřejně publikovaná verze; condensed from `zadani/30-security.md`.

**Verze:** 0.1
**Účinné od:** TBD
**Trust center:** https://shopio.com/trust (po launch)

## Závazek

Shopio bere bezpečnost vážně. Tento dokument popisuje, jak data vašich zákazníků chráníme.

## Architektura

### Šifrování
- **In transit**: TLS 1.3 mandatorní
- **At rest**: AES-256-GCM
- **KMS**: Cloud KMS (AWS / GCP / Azure) nebo HashiCorp Vault (self-host)
- **Per-tenant DEK** envelope encryption — vaše data jsou izolována od ostatních

### Autentizace
- **Passkey-first** (WebAuthn) — phishing-resistant default
- **Password fallback**: argon2id (m=64MB, t=3, p=4) + server-side pepper
- **MFA**: TOTP nebo WebAuthn second factor
- **SSO**: SAML 2.0 + OIDC pro Enterprise tier
- **Session timeouts**: configurable per tenant

### Autorizace
- **RBAC**: ~180 permissions, 40+ personas
- **ABAC**: context-aware policies (step-up MFA, bulk operation approval)
- **RLS** (PostgreSQL Row-Level Security) — hardware-enforced tenant isolation
- **Audit log**: immutable, hash-chained, signed batches → S3 Glacier Deep Archive

### Network
- **Cloudflare** WAF + DDoS + Bot management
- **TLS termination** Cloudflare Origin Cert + mTLS k origin
- **Egress allowlist** — explicit list povolených external destinations
- **Network policies** Kubernetes default-deny

### Infrastruktura
- **Cloud provider**: AWS (primary EU Frankfurt + DR Paris)
- **Compute**: Kubernetes (EKS) s container image signing (cosign)
- **Databáze**: PostgreSQL 17, multi-AZ, automated backups + PITR
- **Cache**: Redis multi-AZ
- **Object storage**: S3 s versioning + cross-region replication

## Operations

### Deployments
- Trunk-based development
- All deploys via signed images (cosign verification)
- Canary rollout 5% → 25% → 50% → 100% s auto-rollback on SLO violation
- Zero-downtime deploys for backward-compat changes
- Hotfix path < 15 min for security patches

### Monitoring
- OpenTelemetry-based (traces + metrics + logs)
- Self-hosted Grafana stack v EU
- Sentry for application errors
- 24×7 alerting via PagerDuty (Year 2+)

### Backups
- Continuous WAL archiving (PITR)
- Daily compressed snapshots
- Retention: 7d PITR, 30d daily, 1y monthly, 7y yearly
- Monthly automated restore testing
- Cross-region replication

### Incident response
- NIST 800-61r2-based framework
- 4 severity tiers (SEV-1 → SEV-4)
- On-call rotation
- Pre-drafted communication templates
- Post-mortem within 5 business days for SEV-1/2

## Compliance

| Standard | Status | Target |
|---|---|---|
| GDPR | ✅ Compliant by design | Day 1 |
| PCI DSS SAQ A | ✅ Tokenization only (no card data) | Day 1 |
| ePrivacy Directive | ✅ Cookie consent + opt-in marketing | Day 1 |
| EU AI Act | ✅ Transparency + human-in-loop high-risk | Day 1 |
| ISO 27001 | 🟡 In progress | Year 1 |
| SOC 2 Type I | 🟡 In progress | Year 1 |
| SOC 2 Type II | 🟡 Plánováno | Year 2 |
| NIS2 | 🟡 Assessment | Year 2 |

## Vulnerability management

- **Continuous scanning**: SAST (Semgrep + CodeQL), DAST (ZAP), SCA (Snyk + Dependabot), container (Trivy), secrets (gitleaks)
- **SLA**: Critical 24h, High 7d, Medium 30d, Low 90d
- **Bug bounty** (Fáze 2): Intigriti (EU-based)

## Data protection

### Personal data (GDPR)
- Per-field classification (Public / Internal / Confidential / Restricted)
- Confidential + Restricted fields envelope-encrypted
- PII scrubbing před AI provider calls
- Sub-processor disclosure
- DSAR + erasure workflows automated
- Breach notification 72h to authority

### Payment data (PCI)
- **No PAN storage** — tokenization via Stripe / GoPay
- SAQ A self-assessment annual
- Quarterly ASV scans

### Audit logging
- Every privileged action logged
- Immutable (hash chain + signed batches)
- 5-year retention
- Customer can verify chain integrity (public verification key Year 2)

## Reporting security issues

Detail v [SECURITY.md](../SECURITY.md). Stručně:

- **Email**: security@shopio.com (PGP-encrypted preferováno)
- **Acknowledgment**: do 24 hodin
- **Triage**: do 7 dní
- **Coordinated disclosure**: 90-day default

Bug bounty rewards (Fáze 0-1 ad-hoc, Fáze 2+ formal):
- Critical: €1000-5000
- High: €500-2000
- Medium: €100-500
- Low: €50-200

## Customer security best practices

Doporučujeme všem merchantům:
- **Enable MFA** všech admin uživatelů
- **Použít passkeys** kde možné
- **IP allowlist** pro production access
- **Regular audit log review**
- **Strong passwords** (12+ chars, generated)
- **Limit team members** k principle of least privilege
- **Update plan** pravidelně
- **Configure DPA** s vlastními sub-processory v integrations

## Kontakt

- Security: security@shopio.com
- DPO: dpo@shopio.com
- General: support@shopio.com

---

**DRAFT — vyžaduje:**
- [ ] Final review po ISO 27001 audit
- [ ] PGP key generation + publikace fingerprint
- [ ] EN verze
- [ ] Trust center page live
