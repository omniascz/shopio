# 30 – SECURITY

> **Doména:** Bezpečnostní baseline platformy — authentication (passkey-first), authorization (RBAC+ABAC+RLS), session management, secrets management (KMS envelope encryption), PII + GDPR, PCI SAQ A, fraud detection, rate limiting, audit logging, vulnerability management, incident response, CSP, encryption everywhere, data classification, DDoS protection, EU compliance (GDPR, NIS2, DORA-readiness). SOC2 Type II + ISO 27001 timeline.

**Datum:** 2026-05-20
**Verze:** 1.0
**Status:** 🟡 DESIGN
**Reference:** [01-decisions-registry.md](01-decisions-registry.md) DEC-SEC-* · [18-customer-management.md](18-customer-management.md) · [28-developer-platform.md](28-developer-platform.md) · [29-integrations.md](29-integrations.md) · [36-personas-rbac.md](36-personas-rbac.md)

---

## 📑 Obsah

0. [Domain overview](#0-domain-overview)
1. [References](#1-references)
2. [Personas](#2-personas)
3. [Data classification](#3-data-classification)
4. [Authentication](#4-authentication)
5. [Authorization](#5-authorization)
6. [Data models](#6-data-models)
7. [Secrets & key management](#7-secrets--key-management)
8. [Audit logging](#8-audit-logging)
9. [Encryption](#9-encryption)
10. [Network & application security](#10-network--application-security)
11. [Fraud detection](#11-fraud-detection)
12. [Vulnerability & patch management](#12-vulnerability--patch-management)
13. [Incident response](#13-incident-response)
14. [Compliance & certifications](#14-compliance--certifications)
15. [Business rules](#15-business-rules)
16. [REST API endpoints](#16-rest-api-endpoints)
17. [GraphQL schema](#17-graphql-schema)
18. [Events](#18-events)
19. [Background jobs](#19-background-jobs)
20. [UI/UX flows](#20-uiux-flows)
21. [Performance, testing](#21-performance-testing)
22. [Implementation checklist](#22-implementation-checklist)
23. [Open questions](#23-open-questions)

---

## 0. Domain overview

### 0.1 Co tato doména **je**

- **Authentication infrastructure** — passkey-first (WebAuthn) + password fallback (argon2id) + TOTP MFA + SSO (SAML 2.0, OIDC for enterprise tenants); single-sign-on across admin + storefront customer login
- **Authorization model** — RBAC (Personas + Permissions) + ABAC (context-aware policies) + Row-Level Security (PostgreSQL RLS) for hard tenant isolation
- **Session management** — refresh tokens v HTTP-only secure cookies, short-lived access tokens, session revocation, concurrent session tracking, anomaly detection
- **Secrets & key management** — KMS-wrapped DEKs (envelope encryption); per-tenant + per-resource keys where required; automated rotation; HSM-backed root keys (AWS KMS / GCP Cloud KMS / dedicated HSM for SOC2 Year 2)
- **Audit logging** — immutable, append-only audit log of all security-relevant actions, integrity-protected (hash chain or signed batches)
- **Encryption** — at rest (AES-256-GCM), in transit (TLS 1.3 mandatory), application-level encryption for sensitive fields (PII, payment tokens, OAuth secrets), envelope encryption for credentials
- **Data classification** — 4 tiers (public, internal, confidential, restricted) → drives encryption + access + retention policies
- **PII handling** — minimization, pseudonymization where possible, right-to-erasure GDPR per `18`, consent ledger
- **PCI compliance** — SAQ A (tokenization only — no card data touches our infra per `13-payments.md`)
- **Fraud detection** — for customer orders (cards, accounts, content), for merchants (signup), for plugin developers, for AI agents
- **Rate limiting** — multi-layer (per IP, per user, per token, per tenant, global)
- **Bot management** — Cloudflare WAF + Turnstile (better than reCAPTCHA, EU-friendly) for signup, login, checkout
- **DDoS protection** — Cloudflare baseline + Anycast network
- **Vulnerability management** — dependency scanning (Snyk/Dependabot), SAST (Semgrep), DAST (ZAP), container scanning (Trivy), secret scanning (gitleaks), bug bounty program
- **Incident response** — SOP, runbooks, on-call rotation, post-mortem template, customer notification SLA per GDPR (72h)
- **CSP & security headers** — strict CSP per `27`/`26`, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- **Compliance roadmap** — GDPR (mandatory MVP), ISO 27001 (Year 1), SOC 2 Type II (Year 2), NIS2 (assess; Shopio likely NIS2 "important entity" given >250 employees or >50M revenue ... → assess gradually), DORA (only if we serve financial institutions; out of scope MVP), TISAX/ENS (sector-specific; out of scope)

### 0.2 Co tato doména **NENÍ**

- ❌ Customer auth implementation details (→ `18-customer-management.md`) — tato doc dává policy a baseline; implementace tam
- ❌ Permission catalog per persona (→ `36-personas-rbac.md`)
- ❌ Payment processor security (PCI scope details) — `13-payments.md`
- ❌ Tax authority compliance (DPH, EET) — `15-tax-compliance.md`
- ❌ Specific RBAC permissions per resource — `36-personas-rbac.md`
- ❌ Storefront-specific security (CSRF for checkout, anti-bot in storefront) — `12-checkout.md` má vlastní; tato doc dává baseline
- ❌ Theme/plugin sandbox internals — `26 §16.x` + `28 §16.x`
- ❌ Marketing email anti-spam (DMARC, DKIM) — `19-marketing-seo.md`
- ❌ Plugin author security review — `28 §8.x` má vlastní
- ❌ Operational monitoring (uptime, latency dashboards) — `31-operations.md`

### 0.3 Diferenciátory

1. **Passkey-first** — výchozí registrace bez hesla (WebAuthn), heslo jako fallback. Méně útoků (no password = no phishing of password); lepší UX.
2. **EU-first compliance** — GDPR-by-default settings, EU data residency (Frankfurt primary, Prague secondary; cf. `31`), Turnstile místo reCAPTCHA, no US-only providers v hot-path
3. **Per-tenant DEK** — i přes shared schema, každý tenant má vlastní DEK pro sensitive fields → bezpečnější + per-tenant erasure jednoduché (drop DEK = data unrecoverable)
4. **Hash-chained audit log** — tamper-evident (každý záznam hashuje předchozí); periodically signed batches; immutable storage
5. **Open source by default** — security through transparency; security advisories veřejné; bug bounty program
6. **AI-aware threat model** — explicit attacker = AI agent (prompt injection, credential exfiltration via tool use); MCP audit log per `28 §11`; agent scope minimum
7. **Self-host friendly security** — open-source customers můžou audit code; secure-by-default config; KMS-pluggable (AWS KMS, GCP, on-prem HashiCorp Vault)

### 0.4 Threat model summary

| Attacker | Targets | Primary mitigations |
|---|---|---|
| Opportunistic credential stuffer | Customer accounts | Passkey-first, MFA optional, anomaly detection, rate limit per IP/UA |
| Targeted account takeover | High-value merchant accounts | MFA enforced for sensitive ops, IP allowlists, session fingerprinting, anomaly alerts |
| Marketplace fraud | Fake sellers, money laundering | KYC (per `25`), sanctions screening, payout holds |
| Order fraud (cards) | Stolen card use | 3DS (per `13`), velocity checks, IP/email reputation, ML fraud score |
| Insider threat | Platform staff exfiltrating tenant data | Privileged access controls, just-in-time access, audit log, dual-control for production access |
| Supply chain | Compromised npm package | Dependency scanning, SBOM, locked versions, signed releases |
| Malicious plugin author | Steal tenant data via legitimate scopes | Scope review, sandboxing (per `28 §8.6`), behavioral monitoring |
| AI prompt injection | Make AI agent leak data or perform unauthorized actions | Scope minimum, confirmation for write ops, tool input sanitization, audit |
| DDoS | Service unavailable | Cloudflare + rate limit + circuit breakers |
| Web app exploit (XSS, SQLi, SSRF, CSRF) | Tenant data, platform compromise | Defense in depth, CSP, parameterized queries, egress allowlist, SameSite cookies |
| Phishing of customer | Account credentials | Passkey eliminates; otherwise MFA + suspicious login detection |
| GDPR data subject erasure non-compliance | Regulatory fines | Erasure orchestration per `18` + integration forward per `29` |

---

## 1. References

- [01-decisions-registry.md](01-decisions-registry.md) DEC-SEC-* (TBD — sečíst do registry: passkey-first, KMS provider, MFA TOTP, audit hash chain)
- [18-customer-management.md](18-customer-management.md) — customer auth implementation, GDPR consent ledger
- [13-payments.md](13-payments.md) — PCI scope, tokenization
- [25-marketplace.md](25-marketplace.md) — KYC, sanctions screening (extends this doc)
- [28-developer-platform.md](28-developer-platform.md) — OAuth + token security, MCP audit
- [29-integrations.md](29-integrations.md) — credentials encryption, GDPR forward
- [27-admin-backoffice.md](27-admin-backoffice.md) — admin session timeout, CSP
- [31-operations.md](31-operations.md) — backup security, disaster recovery
- [33-ai-features.md](33-ai-features.md) — AI agent threat model
- [36-personas-rbac.md](36-personas-rbac.md) — permission catalog
- OWASP ASVS 4.0
- OWASP Top 10 (2021) + API Top 10 (2023)
- NIST SP 800-63B (auth guidelines)
- NIST SP 800-207 (zero trust)
- FIDO2 / WebAuthn Level 3
- PCI-DSS 4.0 SAQ A
- GDPR (EU) 2016/679
- ePrivacy Directive 2002/58
- NIS2 Directive (EU) 2022/2555
- ISO/IEC 27001:2022
- SOC 2 Type II (AICPA TSC)
- CIS Controls v8
- Cloudflare WAF + Turnstile docs
- ENISA threat landscape reports

---

## 2. Personas

| Persona | Použití | Klíčové permissions |
|---|---|---|
| `PERSONA-MERCHANT-OWNER` | Spravuje vlastní bezpečnostní nastavení (MFA, IP allowlist, audit log view) | `PERM-SECURITY-VIEW`, `PERM-SECURITY-MANAGE` |
| `PERSONA-MERCHANT-SECURITY-OFFICER` | Dedicated security role pro velké tenanty | `PERM-SECURITY-MANAGE`, `PERM-AUDIT-LOG-VIEW`, `PERM-INCIDENT-MANAGE` |
| `PERSONA-CUSTOMER` | Spravuje vlastní auth (passkeys, MFA, sessions) | self-only |
| `PERSONA-PLATFORM-SECURITY` | Platform-wide security ops, incident response | `PERM-PLATFORM-SECURITY-*` |
| `PERSONA-PLATFORM-SOC` | Security Operations Center (24/7 monitoring; Year 2) | `PERM-PLATFORM-SOC-MONITOR` |
| `PERSONA-PLATFORM-COMPLIANCE-OFFICER` | Compliance program management | `PERM-PLATFORM-COMPLIANCE-*` |
| `PERSONA-PLATFORM-DPO` | Data Protection Officer (GDPR mandate if >250 employees or large-scale processing) | `PERM-PLATFORM-DPO-*` |
| `PERSONA-AUDITOR` (external) | Read-only access during audits | scoped temporary access |
| `PERSONA-AI-AGENT` | Treated as untrusted; scope-limited | `agent:*` scopes |
| `PERSONA-BUG-BOUNTY-RESEARCHER` | Submits vulnerabilities via program | external, no platform account |

---

## 3. Data classification

### 3.1 Tiers

| Tier | Definition | Examples | Encryption | Retention |
|---|---|---|---|---|
| **Public** | Intentionally public | Product catalog, marketing pages, public blog | TLS in transit; no special at-rest | Indefinite |
| **Internal** | Operational data, non-sensitive | Internal logs, metrics, non-PII analytics | TLS + AES-256 at rest (standard DB) | Per business need |
| **Confidential** | PII, business-sensitive | Customer profiles, order history, inventory, pricing | TLS + application-level encryption for select fields + DB encryption | Per GDPR / business + legal |
| **Restricted** | Highly sensitive — regulatory | Card tokens (we DON'T store PANs), API tokens, OAuth tokens, KYC documents, passkeys raw material, MFA secrets, audit log | TLS + envelope encryption + restricted access + HSM-backed keys + audit | Strict; tokens 30 days post-expiry; KYC per AML 5 years |

### 3.2 Classification at field level

Each table field classified in schema annotations (via Drizzle metadata or comments):

```ts
// example
export const customers = pgTable('customers', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull(),                                                                                                                                                                                                  // CONFIDENTIAL (PII)
  password_hash: text('password_hash'),                                                                                                                                                                                              // RESTRICTED (credential)
  full_name: text('full_name'),                                                                                                                                                                                                       // CONFIDENTIAL
  phone_e164: text('phone_e164'),                                                                                                                                                                                                      // CONFIDENTIAL
  tax_id: text('tax_id'),                                                                                                                                                                                                                // CONFIDENTIAL
  marketing_email_consent: boolean('marketing_email_consent'),                                                                                                                                                                            // CONFIDENTIAL
  total_spent_amount: bigint('total_spent_amount'),                                                                                                                                                                                       // INTERNAL (derived)
  created_at: timestamptz('created_at').notNull(),                                                                                                                                                                                          // INTERNAL
  // ...
});
```

Tooling generates:
- Data inventory dashboard per tenant
- GDPR DSAR export shape
- Field-level access policy enforcement (e.g., support staff sees masked tax_id)
- Erasure scripts

### 3.3 PII identification

Automatically tagged PII (configurable):
- Email, phone, address, name, IP, DOB, gov ID, tax ID
- Order context (purchase history)
- Browsing behavior (cookies, fingerprints)
- Biometric/passkeys raw material (RESTRICTED)
- Payment method labels (last4, brand) — CONFIDENTIAL but not card data

### 3.4 Restricted handling rules

For RESTRICTED data:
- Application-level encryption (per-tenant DEK)
- Audit log every read/write
- Dual control for bulk export
- Cannot leave production env without legal hold approval
- Backups encrypted with separate key (key escrow for compliance)

---

## 4. Authentication

### 4.1 Authentication factors

**Possession factors:**
- Passkey (WebAuthn, primary; FIDO2 platform authenticators preferred)
- TOTP authenticator app (Google Authenticator, Authy, 1Password)
- Hardware security key (FIDO2, YubiKey)
- SMS one-time code (last resort; less secure, not recommended)

**Knowledge factors:**
- Password (argon2id; minimum 12 chars; not in HIBP breach list per `RULE-SEC-007`)

**Recovery factors:**
- Recovery codes (10 one-time codes, generated at MFA enrollment; argon2id-hashed)
- Email-based reset (if no passkey; flagged as lower assurance)

### 4.2 Authentication flows

#### 4.2.1 New customer registration (passkey-first)

```
1. /signup → enter email
2. Server: send email magic link OR verification code
3. User confirms email
4. Browser: prompt to create passkey (WebAuthn navigator.credentials.create)
5. If supported + accepted: passkey registered → user logged in
6. If declined or unsupported:
   - Offer password (with passkey reminder badge)
   - Set password via flow including HIBP check
```

#### 4.2.2 Returning user login (passkey-first)

```
1. /login → enter email (or username)
2. Server: check what auth methods user has
3. If passkey: prompt navigator.credentials.get → user authenticates with biometric/PIN → done (very fast)
4. If password only:
   - Prompt password
   - If MFA enabled: prompt MFA challenge
   - Optional: prompt to add passkey ("Skip password next time")
5. Issue session
```

#### 4.2.3 Admin user login

Per `27 §7`. Stricter:
- MFA recommended; enforced for accounts with `PERM-ADMIN-FULL`
- Concurrent session detection
- IP allowlist optional per tenant
- Stricter session timeout (60 min idle default; configurable per tenant; max 240 min)

#### 4.2.4 SSO (enterprise tenants — Fáze 2+)

- SAML 2.0 (idp-initiated + sp-initiated)
- OIDC (modern preferred)
- Just-in-time provisioning of admin users from IdP attributes
- SCIM for user lifecycle (provisioning, deprovisioning)
- Per-tenant config

### 4.3 Password policy

When password is used:
- Minimum 12 chars
- No upper limit; passphrases encouraged
- Not in HIBP (Have I Been Pwned) breach list (check via k-anonymity API client-side)
- Not user's email, name, or trivial variants
- Stored as argon2id (memory=64MB, iterations=3, parallelism=4)
- Pepper (server-side secret added to hash; rotates per `7.6`)
- Rate limited login attempts (per `RULE-SEC-014`)

### 4.4 MFA

#### 4.4.1 TOTP

- RFC 6238, SHA-1, 6 digits, 30-sec period
- QR code provisioning
- Backup codes (10 one-time)
- Time skew tolerance ±1 step

#### 4.4.2 WebAuthn second factor

- Hardware keys (YubiKey etc.)
- Used as MFA when primary is password
- Cannot be used as only factor (use as primary instead — passkey)

#### 4.4.3 Enforcement

- Optional by default for customers
- Required for high-value actions (per `RULE-SEC-019`)
- Configurable enforcement per role/permission (admin can require MFA for all staff)
- Step-up authentication: certain actions trigger MFA prompt even within an active session

### 4.5 Passkey storage

- WebAuthn credentials (public key + credential ID) stored per user
- No private key on server
- Per-user multiple passkeys (cross-device + recovery passkey)
- User can list + revoke per device

```sql
-- per 18-customer-management.md; details:
CREATE TABLE webauthn_credentials (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id BYTEA NOT NULL,                                                                                                                                                                                                                                                                  -- WebAuthn credential ID
  public_key BYTEA NOT NULL,                                                                                                                                                                                                                                                                       -- COSE-encoded public key
  signature_counter BIGINT NOT NULL DEFAULT 0,
  aaguid UUID NULL,                                                                                                                                                                                                                                                                                  -- authenticator ID (informational)
  transports TEXT[] NULL,                                                                                                                                                                                                                                                                            -- 'usb','nfc','ble','internal','hybrid'
  device_label TEXT NULL,                                                                                                                                                                                                                                                                              -- user-named
  last_used_at TIMESTAMPTZ NULL,
  last_used_ip INET NULL,
  attestation_kind TEXT NULL,
  is_backup_eligible BOOLEAN NOT NULL DEFAULT false,                                                                                                                                                                                                                                                     -- BE flag from WebAuthn
  is_backup_state BOOLEAN NOT NULL DEFAULT false,                                                                                                                                                                                                                                                          -- BS flag
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_webauthn_credentials UNIQUE (user_id, credential_id)
);

CREATE INDEX idx_webauthn_credentials_user ON webauthn_credentials (user_id) WHERE revoked_at IS NULL;
```

### 4.6 Session model

#### 4.6.1 Tokens

- **Refresh token:** HTTP-only Secure SameSite=Strict cookie. Long-lived (30 days customer, 14 days admin). Family-tracked for theft detection (per `28 §4.5`).
- **Access token:** Short-lived JWT (15 min) — sent in `Authorization: Bearer` header for API calls. Memory-only.
- **CSRF token:** Double-submit cookie pattern for state-changing requests from browser.

#### 4.6.2 Session table

```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NULL,                                                                                                                                                                                                                                                                                          -- NULL for customer sessions (scoped to store at token level)
  family_id UUID NOT NULL,                                                                                                                                                                                                                                                                                          -- refresh token rotation chain
  refresh_token_hash TEXT NOT NULL,                                                                                                                                                                                                                                                                                  -- argon2id hash
  device_fingerprint_hash TEXT NULL,                                                                                                                                                                                                                                                                                  -- browser fingerprint
  user_agent TEXT NULL,
  ip_address INET NULL,
  country_code CHAR(2) NULL,                                                                                                                                                                                                                                                                                          -- from GeoIP
  city TEXT NULL,
  -- assurance
  assurance_level TEXT NOT NULL CHECK (assurance_level IN ('low','mfa_verified','step_up')),
  mfa_verified_at TIMESTAMPTZ NULL,
  -- timing
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ NULL,
  revoked_reason TEXT NULL,
  -- audit
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_sessions_refresh_hash UNIQUE (refresh_token_hash)
);

CREATE INDEX idx_sessions_user_active ON sessions (user_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_sessions_expiry ON sessions (expires_at) WHERE revoked_at IS NULL;
CREATE INDEX idx_sessions_family ON sessions (family_id);
```

#### 4.6.3 Session revocation

- User can list + revoke own sessions
- Admin can revoke per-user (suspended, password reset)
- Bulk revoke per security incident
- Server-side revoke flags broadcast via BroadcastChannel + SSE to live tabs (per `27 §8`)

#### 4.6.4 Anomaly detection

Per session:
- IP geolocation change > 500 km in < 60 min ("impossible travel")
- Sudden ASN change
- User-agent fingerprint change
- New device → email notify; require MFA step-up for sensitive ops
- IP in known bad reputation (TOR exit, abuse list)

Triggers alert, optional auto-step-up MFA challenge, log security event.

### 4.7 Recovery flows

#### 4.7.1 Password reset

```
1. /forgot-password → email
2. Email: signed token link (15 min TTL)
3. Click link → verify token
4. Optionally: require MFA challenge before reset (if user has it)
5. Set new password (per policy)
6. Revoke all existing sessions
7. Email: "Password changed from <IP> at <time>"
```

#### 4.7.2 MFA recovery

If user lost TOTP device:
- Use recovery code → re-enroll
- Or: passkey present → use passkey (passkey is higher assurance, can replace MFA)
- Or: admin-assisted reset (for organizational users; logged + auditable)

#### 4.7.3 Account locked / forgotten

- Cooling-off period (1h soft lock after 5 failed attempts; 24h after 20)
- Identity verification (KYC-light) — answer security questions OR provide last invoice + email match
- Manual support unlock (heavy verification — for high-value accounts)

---

## 5. Authorization

### 5.1 Model

**Multi-layered:**

1. **Tenant isolation** (Row-Level Security in PostgreSQL) — every query implicitly filtered by `tenant_id`
2. **Permission check (RBAC)** — does user have `PERM-X-Y` permission?
3. **Resource ownership (ABAC)** — does user have access to *this specific* resource? (e.g., seller_members can only see own seller)
4. **Action context (ABAC)** — additional context-aware policies (e.g., refund > $10000 requires MFA step-up; bulk operations require approval per threshold)

### 5.2 Permissions catalog

Per `36-personas-rbac.md`. Format: `PERM-{RESOURCE}-{ACTION}`.

Approx 200 permissions distributed across:
- Catalog (products, categories, brands, ...)
- Orders, fulfillment, returns
- Customers + B2B
- Marketing (campaigns, coupons)
- Content (CMS, themes)
- Analytics, reports
- Settings (general, tax, shipping)
- Finance (invoices, payouts)
- Developer (tokens, webhooks, plugins)
- Integrations
- Admin (team, billing)
- Security (audit log, MFA enforcement)

### 5.3 Personas → Permissions

Each persona is a bundle of permissions. Default personas (per `36`):
- `PERSONA-MERCHANT-OWNER`: all permissions
- `PERSONA-MERCHANT-ADMIN`: most non-billing
- `PERSONA-MERCHANT-STAFF`: domain-limited (orders, customers)
- `PERSONA-WAREHOUSE-STAFF`: inventory + fulfillment
- `PERSONA-CUSTOMER-SERVICE`: orders + customers + returns
- `PERSONA-MARKETING-MANAGER`: marketing + content + themes
- `PERSONA-ACCOUNTANT`: read finance + reports + exports
- `PERSONA-DEVELOPER`: developer platform
- `PERSONA-AGENCY`: multi-tenant access
- `PERSONA-PLATFORM-*`: cross-tenant (platform staff)

Custom roles: tenant can create custom roles = subset of permissions (Fáze 2+).

### 5.4 Row-Level Security (RLS)

PostgreSQL RLS enforced on every tenant-scoped table:

```sql
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON products
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

Application sets `app.current_tenant_id` at connection start (per request context). Cross-tenant queries impossible at DB level.

Platform staff bypass: explicit `SET ROLE platform_staff;` + audit log. Requires elevated permission `PERM-PLATFORM-STAFF-DB-ACCESS`.

### 5.5 ABAC policies

Higher-level rules expressed as policies. Examples:

```yaml
# Allowed automatically if simple permission:
- name: order_view_basic
  resource: order
  action: view
  permission: PERM-ORDER-VIEW

# ABAC: only own seller's orders
- name: seller_member_own_orders
  resource: order
  action: view
  permission: PERM-SELLER-OWN-VIEW
  condition: order.marketplace_seller_id IN (user.seller_members[].seller_id)

# ABAC: refund cap based on role
- name: high_value_refund_step_up
  resource: order
  action: refund
  condition: refund.amount > 500000 AND session.assurance_level != 'step_up'
  enforce: require_step_up_mfa

# ABAC: bulk operation approval
- name: bulk_delete_requires_approval
  resource: product
  action: bulk_delete
  condition: bulk.count > 100 AND user.role != 'OWNER'
  enforce: require_approval_from(OWNER)
```

Policy engine evaluates at request time. Failed → 403 with reason.

### 5.6 Permission token (claim) in access JWT

JWT payload includes:
```jsonc
{
  "sub": "usr_aB",
  "tnt": "tnt_aB",
  "permissions": ["PERM-PRODUCT-VIEW","PERM-PRODUCT-MANAGE","..."],
  "scope": "admin",
  "assurance_level": "mfa_verified",
  "session_id": "ses_aB",
  "exp": 1716220860,
  "iat": 1716220000,
  "iss": "shopio.com",
  "aud": "api.shopio.com"
}
```

Permissions cached in JWT — saves DB lookup per request. Drawback: changes take up to access-token lifetime (15 min) to propagate. Mitigation: short access token TTL + SSE push on permission change to force reload (per `27 §RULE-ADM-008`).

### 5.7 Just-in-time access (Fáze 2+)

For platform staff accessing tenant data:
- Request access with justification + duration
- Auto-approve for low-risk; review for high-risk
- Time-bound (1-8 hours)
- Full audit log
- Tenant notified of access (post-hoc or pre-hoc per consent)

---

## 6. Data models

### 6.1 `audit_log_entries`

Append-only, hash-chained, immutable.

```sql
CREATE TABLE audit_log_entries (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NULL,                                                                                                                                                                                                                                                                                            -- NULL for platform-level
  pub_id TEXT NOT NULL,                                                                                                                                                                                                                                                                                              -- aud_ NanoID
  sequence_number BIGINT NOT NULL,                                                                                                                                                                                                                                                                                    -- per tenant; ensures ordering + tamper detection
  -- action
  category TEXT NOT NULL CHECK (category IN (
    'auth','authz','data_access','data_modification','config_change','security_event',
    'admin_action','platform_action','billing','privacy','impersonation','plugin','agent'
  )),
  action TEXT NOT NULL,                                                                                                                                                                                                                                                                                                  -- 'user.login','product.delete','token.revoke','rbac.permission_changed'
  outcome TEXT NOT NULL CHECK (outcome IN ('success','failure','denied','pending')),
  -- subject (who)
  actor_kind TEXT NOT NULL CHECK (actor_kind IN ('user','service_account','api_token','app_installation','platform_staff','system','agent')),
  actor_user_id UUID NULL,
  actor_token_id UUID NULL,
  actor_app_installation_id UUID NULL,
  actor_label TEXT NULL,                                                                                                                                                                                                                                                                                                  -- human readable
  -- target (what)
  resource_kind TEXT NULL,
  resource_id UUID NULL,
  resource_label TEXT NULL,
  -- context
  ip_address INET NULL,
  user_agent TEXT NULL,
  session_id UUID NULL,
  request_id TEXT NULL,                                                                                                                                                                                                                                                                                                    -- correlation
  -- detail
  reason TEXT NULL,
  details JSONB NULL,                                                                                                                                                                                                                                                                                                       -- before/after, additional context
  -- tamper-evidence
  prev_entry_hash TEXT NULL,                                                                                                                                                                                                                                                                                                 -- SHA-256 of previous entry; first per tenant = NULL
  entry_hash TEXT NOT NULL,                                                                                                                                                                                                                                                                                                  -- SHA-256(canonicalize(this entry sans hash) || prev_entry_hash)
  signed_batch_id UUID NULL,                                                                                                                                                                                                                                                                                                  -- references signing batch (filled by periodic signer job)
  -- timing
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_audit_log_pub_id UNIQUE (pub_id),
  CONSTRAINT uq_audit_log_sequence UNIQUE (tenant_id, sequence_number)
) PARTITION BY RANGE (occurred_at);

CREATE INDEX idx_audit_log_tenant ON audit_log_entries (tenant_id, occurred_at DESC);
CREATE INDEX idx_audit_log_actor ON audit_log_entries (actor_user_id, occurred_at DESC) WHERE actor_user_id IS NOT NULL;
CREATE INDEX idx_audit_log_resource ON audit_log_entries (resource_kind, resource_id, occurred_at DESC) WHERE resource_id IS NOT NULL;
CREATE INDEX idx_audit_log_category ON audit_log_entries (tenant_id, category, occurred_at DESC);
CREATE INDEX idx_audit_log_outcome_failure ON audit_log_entries (tenant_id, occurred_at DESC) WHERE outcome IN ('failure','denied');
```

### 6.2 `audit_log_signed_batches`

Periodically sign batches of audit entries for non-repudiation.

```sql
CREATE TABLE audit_log_signed_batches (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NULL,
  start_sequence BIGINT NOT NULL,
  end_sequence BIGINT NOT NULL,
  start_occurred_at TIMESTAMPTZ NOT NULL,
  end_occurred_at TIMESTAMPTZ NOT NULL,
  merkle_root_hash TEXT NOT NULL,                                                                                                                                                                                                                                                                                              -- hash of merkle tree of entry hashes
  signature TEXT NOT NULL,                                                                                                                                                                                                                                                                                                       -- ed25519 sig by platform signing key (rotated per `7.x`)
  signing_key_id TEXT NOT NULL,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archive_storage_key TEXT NULL,                                                                                                                                                                                                                                                                                                    -- S3 immutable
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_signed_batches_tenant ON audit_log_signed_batches (tenant_id, end_occurred_at DESC);
```

### 6.3 `security_events`

Higher-level security events (anomalies, fraud signals, alerts).

```sql
CREATE TABLE security_events (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NULL,
  pub_id TEXT NOT NULL,
  -- kind
  event_kind TEXT NOT NULL CHECK (event_kind IN (
    'failed_login','account_locked','password_reset_requested','password_reset_completed',
    'mfa_enrolled','mfa_removed','mfa_bypass_requested','impossible_travel','suspicious_ip',
    'session_anomaly','privilege_escalation_attempt','permission_change','user_suspended',
    'tenant_suspended','api_rate_limit_violation','token_compromised','token_reuse_detected',
    'csrf_failure','suspicious_browser_fingerprint','bot_detected','ddos_mitigation',
    'fraud_signal','dlp_violation','exfiltration_pattern','sql_injection_attempt',
    'xss_attempt','ssrf_attempt','dependency_vulnerability','secret_in_code',
    'plugin_security_review_failed','agent_unauthorized_action','export_blocked'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('info','low','medium','high','critical')),
  -- subjects
  user_id UUID NULL,
  customer_id UUID NULL,
  token_id UUID NULL,
  app_installation_id UUID NULL,
  related_audit_entry_id UUID NULL,
  -- context
  ip_address INET NULL,
  user_agent TEXT NULL,
  geo_country_code CHAR(2) NULL,
  details JSONB NULL,
  -- response
  status TEXT NOT NULL CHECK (status IN ('open','acknowledged','investigating','resolved','false_positive','suppressed')) DEFAULT 'open',
  status_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_by_user_id UUID NULL,
  resolution_notes TEXT NULL,
  -- correlation
  incident_id UUID NULL,                                                                                                                                                                                                                                                                                                              -- if part of incident
  -- audit
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ NULL,
  resolved_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_security_events_pub_id UNIQUE (pub_id)
);

CREATE INDEX idx_security_events_open ON security_events (severity, detected_at DESC) WHERE status = 'open';
CREATE INDEX idx_security_events_tenant ON security_events (tenant_id, detected_at DESC);
CREATE INDEX idx_security_events_user ON security_events (user_id, detected_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX idx_security_events_kind ON security_events (event_kind, detected_at DESC);
```

### 6.4 `security_incidents`

Coordinated response containers.

```sql
CREATE TABLE security_incidents (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  pub_id TEXT NOT NULL,                                                                                                                                                                                                                                                                                                                  -- inc_ NanoID
  number TEXT NOT NULL,                                                                                                                                                                                                                                                                                                                      -- INC-2026-00000123
  title TEXT NOT NULL,
  description_html TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('sev1','sev2','sev3','sev4')),                                                                                                                                                                                                                                                                    -- sev1 highest
  category TEXT NOT NULL CHECK (category IN (
    'data_breach','account_takeover','platform_outage','ddos','vulnerability_disclosed',
    'compliance_finding','insider_threat','supply_chain','phishing','other'
  )),
  status TEXT NOT NULL CHECK (status IN ('open','investigating','contained','remediated','closed')) DEFAULT 'open',
  status_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- impact
  tenants_affected TEXT[] NULL,                                                                                                                                                                                                                                                                                                                  -- tenant pub_ids
  customers_affected_count INTEGER NULL,
  data_exfil_suspected BOOLEAN NOT NULL DEFAULT false,
  data_exfil_confirmed BOOLEAN NOT NULL DEFAULT false,
  -- timing
  detected_at TIMESTAMPTZ NOT NULL,
  acknowledged_at TIMESTAMPTZ NULL,
  contained_at TIMESTAMPTZ NULL,
  remediated_at TIMESTAMPTZ NULL,
  closed_at TIMESTAMPTZ NULL,
  -- regulatory
  gdpr_notification_required BOOLEAN NOT NULL DEFAULT false,
  gdpr_notification_sent_at TIMESTAMPTZ NULL,
  gdpr_72h_deadline_at TIMESTAMPTZ NULL,
  authority_notified BOOLEAN NOT NULL DEFAULT false,
  authority_notification_ref TEXT NULL,                                                                                                                                                                                                                                                                                                            -- e.g., ÚOOÚ reference
  -- response team
  incident_commander_user_id UUID NULL,
  responders JSONB NULL,                                                                                                                                                                                                                                                                                                                              -- [{ user_id, role }]
  -- post-mortem
  postmortem_url TEXT NULL,
  postmortem_published_at TIMESTAMPTZ NULL,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user_id UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_security_incidents_pub_id UNIQUE (pub_id),
  CONSTRAINT uq_security_incidents_number UNIQUE (number)
);

CREATE INDEX idx_security_incidents_open ON security_incidents (severity, detected_at DESC) WHERE status NOT IN ('closed');
CREATE INDEX idx_security_incidents_gdpr ON security_incidents (gdpr_72h_deadline_at) WHERE gdpr_notification_required = true AND gdpr_notification_sent_at IS NULL;
```

### 6.5 `tenant_security_settings`

```sql
CREATE TABLE tenant_security_settings (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  -- MFA
  mfa_required_for_owners BOOLEAN NOT NULL DEFAULT true,
  mfa_required_for_admins BOOLEAN NOT NULL DEFAULT false,
  mfa_required_for_all_staff BOOLEAN NOT NULL DEFAULT false,
  passkey_required_for_owners BOOLEAN NOT NULL DEFAULT false,
  -- session
  session_timeout_idle_minutes INTEGER NOT NULL DEFAULT 60,
  session_timeout_absolute_minutes INTEGER NOT NULL DEFAULT 4320,                                                                                                                                                                                                                                                                                       -- 3 days
  concurrent_sessions_max INTEGER NULL,                                                                                                                                                                                                                                                                                                                    -- NULL = unlimited
  -- IP
  ip_allowlist CIDR[] NULL,                                                                                                                                                                                                                                                                                                                                  -- restrict admin login
  ip_denylist CIDR[] NULL,
  -- password policy override
  password_min_length INTEGER NOT NULL DEFAULT 12,
  password_check_hibp BOOLEAN NOT NULL DEFAULT true,
  password_rotation_days INTEGER NULL,                                                                                                                                                                                                                                                                                                                          -- not recommended; opt-in
  -- step-up
  require_step_up_mfa_for_high_value_refunds BOOLEAN NOT NULL DEFAULT true,
  high_value_refund_threshold_amount BIGINT NOT NULL DEFAULT 500000,                                                                                                                                                                                                                                                                                              -- 5000 CZK or equiv
  -- SSO (Fáze 2+)
  sso_enabled BOOLEAN NOT NULL DEFAULT false,
  sso_provider_kind TEXT NULL CHECK (sso_provider_kind IN ('saml','oidc') OR sso_provider_kind IS NULL),
  sso_provider_config JSONB NULL,                                                                                                                                                                                                                                                                                                                                    -- encrypted
  sso_require_for_admins BOOLEAN NOT NULL DEFAULT false,
  sso_jit_provisioning BOOLEAN NOT NULL DEFAULT true,
  -- notifications
  security_alert_email TEXT NULL,                                                                                                                                                                                                                                                                                                                                       -- typed alert recipient
  notify_on_new_device_login BOOLEAN NOT NULL DEFAULT true,
  notify_on_failed_login_threshold BOOLEAN NOT NULL DEFAULT true,
  failed_login_threshold INTEGER NOT NULL DEFAULT 5,
  -- audit log retention (hot)
  audit_log_hot_retention_days INTEGER NOT NULL DEFAULT 730,                                                                                                                                                                                                                                                                                                              -- 2 years
  audit_log_cold_retention_days INTEGER NOT NULL DEFAULT 1825,                                                                                                                                                                                                                                                                                                              -- 5 years total
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
```

### 6.6 `kms_keys` (metadata; secrets v KMS)

```sql
CREATE TABLE kms_keys (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  -- identification
  key_kind TEXT NOT NULL CHECK (key_kind IN (
    'tenant_dek_master','tenant_dek','field_dek','audit_signing','jwt_signing',
    'session_pepper','webhook_signing','platform_secret','backup_encryption'
  )),
  key_id_external TEXT NOT NULL,                                                                                                                                                                                                                                                                                                                                            -- e.g., AWS KMS ARN or alias
  provider TEXT NOT NULL CHECK (provider IN ('aws_kms','gcp_kms','hashicorp_vault','local_dev')),
  -- scope
  tenant_id UUID NULL,                                                                                                                                                                                                                                                                                                                                                            -- per-tenant keys
  resource_kind TEXT NULL,
  -- lifecycle
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL CHECK (status IN ('active','rotating','retired','disabled','compromised')) DEFAULT 'active',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  rotated_from_key_id UUID NULL REFERENCES kms_keys(id),
  rotation_due_at TIMESTAMPTZ NULL,
  retired_at TIMESTAMPTZ NULL,
  -- audit
  description TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_kms_keys_external UNIQUE (key_id_external)
);

CREATE INDEX idx_kms_keys_active ON kms_keys (key_kind, status) WHERE status = 'active';
CREATE INDEX idx_kms_keys_rotation_due ON kms_keys (rotation_due_at) WHERE status = 'active' AND rotation_due_at IS NOT NULL;
```

### 6.7 `bug_bounty_submissions`

```sql
CREATE TABLE bug_bounty_submissions (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  pub_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description_markdown TEXT NOT NULL,
  reporter_handle TEXT NOT NULL,
  reporter_email CITEXT NOT NULL,
  reporter_kind TEXT NOT NULL CHECK (reporter_kind IN ('independent','platform_partner','customer')),
  -- triage
  severity_initial TEXT NULL CHECK (severity_initial IN ('low','medium','high','critical') OR severity_initial IS NULL),
  severity_validated TEXT NULL,
  category TEXT NULL,
  attack_vector TEXT NULL,
  affected_components TEXT[] NULL,
  -- status
  status TEXT NOT NULL CHECK (status IN ('triage','accepted','duplicate','out_of_scope','informative','fixed','disputed','disclosed','closed')) DEFAULT 'triage',
  status_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  triager_user_id UUID NULL,
  triage_notes TEXT NULL,
  -- payout
  bounty_amount BIGINT NULL,
  bounty_currency CHAR(3) NULL,
  bounty_paid_at TIMESTAMPTZ NULL,
  -- disclosure
  cve_id TEXT NULL,
  public_advisory_url TEXT NULL,
  disclosed_at TIMESTAMPTZ NULL,
  -- audit
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_bug_bounty_submissions_pub_id UNIQUE (pub_id)
);

CREATE INDEX idx_bug_bounty_submissions_open ON bug_bounty_submissions (severity_validated, submitted_at DESC) WHERE status NOT IN ('disclosed','closed','out_of_scope','duplicate','informative');
```

### 6.8 `fraud_scores`

Per `11-cart.md` / `12-checkout.md` cross-ref; stored centrally.

```sql
CREATE TABLE fraud_scores (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  -- subject
  subject_kind TEXT NOT NULL CHECK (subject_kind IN ('order','signup','login','marketplace_seller_application','plugin_publish','review_submission')),
  subject_id UUID NOT NULL,
  -- signals
  score NUMERIC(5,4) NOT NULL,                                                                                                                                                                                                                                                                                                                                                                                                     -- 0.0000 - 1.0000
  signals JSONB NOT NULL,                                                                                                                                                                                                                                                                                                                                                                                                            -- { ip_reputation: 0.8, velocity: 0.2, email_age: 0.3, device_fingerprint: ..., ... }
  recommendation TEXT NOT NULL CHECK (recommendation IN ('allow','review','challenge','deny')),
  recommendation_applied TEXT NULL,                                                                                                                                                                                                                                                                                                                                                                                                     -- actual decision after merchant rules
  -- model
  model_name TEXT NOT NULL,
  model_version TEXT NOT NULL,
  -- audit
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
) PARTITION BY RANGE (computed_at);

CREATE INDEX idx_fraud_scores_subject ON fraud_scores (subject_kind, subject_id);
CREATE INDEX idx_fraud_scores_high ON fraud_scores (tenant_id, score DESC) WHERE recommendation IN ('review','challenge','deny');
```

### 6.9 Vztahy

```
tenants (1)──(1) tenant_security_settings
tenants (1)──(N) audit_log_entries
tenants (1)──(N) security_events
tenants (1)──(N) security_incidents
tenants (1)──(N) fraud_scores
users (1)──(N) sessions
users (1)──(N) webauthn_credentials                                                                                                                                                                                                                                                                                                                                                                                                                                                                       [per `18`]
audit_log_entries (1)──(0..1) audit_log_signed_batches                                                                                                                                                                                                                                                                                                                                                                                                                                                       [via batch range]
security_events (1)──(0..1) security_incidents
kms_keys (1)──(N) (encrypted resources)                                                                                                                                                                                                                                                                                                                                                                                                                                                                       [via metadata key_id refs]
```

---

## 7. Secrets & key management

### 7.1 Hierarchy

```
HSM / Cloud KMS Root Key (KEK = Key Encryption Key)
  ↓ unwraps
Per-tenant DEK (Data Encryption Key) — wrapped by KEK; stored encrypted
  ↓ encrypts
Application secrets (OAuth tokens, integration credentials, sensitive PII fields, ...)

Audit signing key (ed25519, platform-wide; rotated)
JWT signing key (platform-wide; rotated)
Session pepper (platform-wide; rotated)
Webhook signing secrets (per webhook subscription; stored hashed)
```

### 7.2 KMS providers

| Provider | Use case |
|---|---|
| AWS KMS | Default for AWS deployments |
| GCP Cloud KMS | GCP deployments |
| Azure Key Vault | Azure deployments |
| HashiCorp Vault | Self-host / on-prem |
| Local dev (sealed file) | Local dev only — never production |

Pluggable via adapter interface. Configured per environment in `apps/.../config/security.ts`.

### 7.3 Envelope encryption

For each "encrypted at app level" field:

```ts
// encrypt
const dek = await kms.generateDataKey({ keyId: tenant.kekArn, keySpec: 'AES_256' });
//  → { plaintext: <bytes 32>, ciphertextBlob: <wrapped DEK> }
const iv = randomBytes(12);
const aad = JSON.stringify({ tenant: tenantId, kind: 'integration_credentials', resource: connectionId });
const cipher = aesGcm.encrypt(plaintext, dek.plaintext, iv, aad);
zeroize(dek.plaintext);

const stored = {
  dek_ciphertext: dek.ciphertextBlob,                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              // wrapped DEK
  iv,
  ciphertext: cipher.ciphertext,
  auth_tag: cipher.authTag,
  aad
};

// decrypt
const dek_plain = await kms.decrypt(stored.dek_ciphertext);
try {
  const plaintext = aesGcm.decrypt(stored.ciphertext, stored.auth_tag, dek_plain, stored.iv, stored.aad);
  return plaintext;
} finally {
  zeroize(dek_plain);
}
```

### 7.4 Per-tenant KEK

Each tenant has own KEK (a KMS-managed alias). On tenant creation:
- KMS createKey + setAlias `alias/shopio/tenant/{tenant_pub_id}`
- Stored in `tenants.kek_arn`
- All app-level encryption per tenant uses this KEK

Tenant deletion (GDPR right-to-erasure full):
- Schedule KEK destruction (KMS schedule, 30-day grace)
- After destruction: tenant data unrecoverable (defense in depth even if DB backups leaked)

### 7.5 Field-level DEKs (optional Fáze 2)

For RESTRICTED fields, separate DEKs per resource. Allows finer-grained access control + revocation per resource.

MVP: single tenant DEK per envelope; field categories use AAD to bind contexts.

### 7.6 Rotation

| Key | Rotation frequency | Method |
|---|---|---|
| Tenant KEK | Yearly automatic + on-demand | KMS rotation; previous version retained for decryption |
| JWT signing key | Monthly | Dual-key rolling; access tokens signed with new, old accepted for verification 30 days |
| Audit signing key | Quarterly | Same dual-key approach; verifier uses correct key per batch's `signing_key_id` |
| Session pepper | Quarterly | Re-hash on next login |
| Webhook signing secrets | Per request (manual rotation by tenant or app) | UI button; 7-day overlap (old + new accepted) |
| Integration OAuth refresh tokens | Per use (per `28 §4.5`) | Rotation chain |
| API tokens (PAT, SA) | User-initiated | `rotate` endpoint atomic |

### 7.7 Secret detection in code

CI runs gitleaks + Semgrep secret rules. Pre-commit hook (husky) scans staged files. Findings: block commit + alert.

Found in main branch: revoke immediately + rotate + incident.

### 7.8 Backups

Backups encrypted with separate KEK (not tenant KEK — survives tenant deletion for compliance retention if needed).

Restoration requires:
- KMS access for backup KEK
- Application secret pepper from secure store
- Audit log entry

### 7.9 Pepper

Server-side secret added to password hash:
```
hash = argon2id(password || pepper, salt)
```

Pepper stored in KMS (separate from DB). Compromise of DB alone doesn't allow offline password cracking — attacker needs KMS access too.

Pepper rotation: each user's password rehashed on next successful login (lazy migration).

---

## 8. Audit logging

### 8.1 What gets logged

| Category | Events |
|---|---|
| **auth** | login_success, login_failure, logout, password_changed, mfa_enrolled, mfa_removed, password_reset_requested, passkey_added, passkey_removed |
| **authz** | permission_granted, permission_revoked, role_assigned, role_removed, scope_change, just_in_time_access_granted, impersonation_started, impersonation_ended |
| **data_access** | sensitive_field_read (RESTRICTED only), bulk_export, gdpr_dsar_export, dpo_data_view |
| **data_modification** | resource_created, resource_updated, resource_deleted (per kind), bulk_update, bulk_delete |
| **config_change** | settings_updated (per setting), feature_flag_toggled, security_setting_changed |
| **security_event** | session_anomaly, suspicious_login, account_lockout, fraud_signal, dlp_violation |
| **admin_action** | user_invited, user_removed, role_modified, billing_changed, tenant_owner_changed |
| **platform_action** | tenant_created, tenant_suspended, tenant_deleted, platform_staff_access |
| **billing** | subscription_changed, payment_method_added, invoice_paid |
| **privacy** | gdpr_dsar_requested, gdpr_dsar_fulfilled, erasure_requested, erasure_completed, consent_changed |
| **impersonation** | impersonation_session_started, impersonation_session_ended, action_during_impersonation |
| **plugin** | plugin_installed, plugin_uninstalled, plugin_scopes_modified, plugin_data_export |
| **agent** | mcp_tool_invoked, mcp_unauthorized_action, mcp_session_started |

### 8.2 Storage

- Hot: PostgreSQL `audit_log_entries` (partitioned monthly); 2 years
- Warm: S3 immutable archives (Glacier Deep Archive) signed + compressed; 5 years
- Tamper-evident: hash chain + periodic ed25519 signed batches

### 8.3 Hash chain

```
entry_n.entry_hash = SHA-256(canonicalize(entry_n sans hash) || entry_{n-1}.entry_hash)
```

Canonicalization: deterministic JSON serialization (RFC 8785 JCS).

Verification:
- Fetch entry + previous → recompute hash → compare
- Detect insertions: sequence_number gap or hash chain break
- Periodic verifier job sweeps; alerts on anomaly

### 8.4 Signed batches

Every hour (configurable):
- Collect new entries (sequence_number ranges) per tenant
- Build merkle tree (leaves = entry_hash)
- Sign root with ed25519 platform key
- Store `audit_log_signed_batches` row
- Archive batch + signature to S3 immutable

Allows compliance auditors to verify subset without revealing all entries (merkle proof).

### 8.5 Privacy in audit log

- Audit entries may reference sensitive data (e.g., what was changed)
- For RESTRICTED: store hash or reference, not value
- For CONFIDENTIAL: log changed field names + truncated values
- Audit log access itself audited (meta-audit)
- DPO access requires reason logged

### 8.6 Audit log viewer (admin UI)

Per `27 §RULE-ADM-014`:
- Filter: actor, resource, action, date, outcome
- Search full-text
- Export CSV for compliance audits
- Chain integrity verifier button (verify last N entries)
- Linked to incidents

### 8.7 Retention + erasure

Even GDPR erasure doesn't always purge audit. Legitimate interest (security, regulatory):
- Personal identifiers replaced with pseudonyms after erasure (e.g., "user_anon_aB1")
- Audit semantics preserved (who did what when)
- Per `RULE-SEC-038`

---

## 9. Encryption

### 9.1 In transit

- **TLS 1.3 only** (TLS 1.2 acceptable for older integrations; documented).
- HSTS with `max-age=31536000; includeSubDomains; preload`
- Certificate transparency monitoring
- Strong cipher suites only (no RC4, no MD5, no 3DES)
- HTTP/3 (QUIC) where supported
- mTLS for internal service-to-service (Fáze 2; baseline = service mesh per `31`)

### 9.2 At rest — disk

- AWS EBS / GCP PD: encrypted at rest by default with CMK (Customer Managed Key)
- PostgreSQL: full-disk encryption (AWS RDS storage encryption with KMS)
- Object storage (S3): SSE-KMS with platform CMK
- Backups: same + separate backup KEK

### 9.3 At rest — application level

For CONFIDENTIAL + RESTRICTED fields, envelope encryption:
- Customer email-at-rest: optional Fáze 2 (impacts search; balanced approach: hash for lookup, encrypted full)
- Customer phone, address: encrypted Fáze 2
- Integration credentials: encrypted (mandatory MVP)
- OAuth tokens: encrypted (mandatory MVP)
- API tokens: hashed only (no decryption needed)
- KYC documents: encrypted + per-tenant DEK
- Payment tokens (network tokens, payment provider IDs): treated as RESTRICTED but verified non-PCI scope (Stripe verifies)

### 9.4 In memory

- Sensitive values cleared after use (zeroize)
- No unnecessary copies
- Avoid logging structures containing secrets

### 9.5 In CI/CD

- Build secrets fetched from secret manager (GitHub OIDC + AWS STS for repo workflows)
- No secrets in workflow files
- Container images don't bake secrets
- Deploy-time injection only

---

## 10. Network & application security

### 10.1 Network architecture

Per `31-operations.md`:
- VPC with public/private subnets
- NAT for outbound from private
- Public services behind ALB + Cloudflare
- Internal services service-mesh (Linkerd or Istio Fáze 2)
- Egress allowlist (services only call approved external)

### 10.2 Cloudflare (edge layer)

- WAF (Web Application Firewall) — OWASP Core Rule Set + custom rules
- DDoS Protection (L3/4 + L7)
- Bot Management (heuristics + ML)
- Turnstile (cookie-less CAPTCHA, EU-friendly)
- Rate limiting (per IP, path, method)
- IP reputation (TOR, abuse list)
- Cache rules (static + edge cache for storefronts)
- TLS termination + mTLS to origin (Cloudflare Origin Cert)

### 10.3 Security headers

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Content-Security-Policy: <strict per app — admin per `27 §16.2`, storefront per `26 §16.7`>
X-Content-Type-Options: nosniff
X-Frame-Options: DENY                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       # (admin); SAMEORIGIN for embed-capable
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(self), payment=(self)
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          # for embedded apps
Cross-Origin-Resource-Policy: same-origin
```

### 10.4 CSRF protection

State-changing requests from browser require:
- SameSite=Strict cookies (default refresh token)
- CSRF token (double-submit pattern) for forms not using token
- Origin/Referer header verification on critical endpoints

### 10.5 Input validation

- Zod schemas on every API input (per `04-api-conventions.md`)
- Parameterized queries only (Drizzle ORM enforces; no raw SQL with user input)
- Output encoding (React handles JSX; we never `dangerouslySetInnerHTML` from user input)
- File uploads: MIME validated, magic bytes checked, size limited, virus-scanned (ClamAV gateway)

### 10.6 SSRF protection

Outbound HTTP from server-side code:
- Allowlist of approved external domains per integration
- DNS resolution outside loopback / link-local / private ranges (deny RFC 1918)
- HTTP client wrapper enforces
- Egress proxy in production

### 10.7 Dependency hygiene

- Lockfile committed (pnpm-lock.yaml)
- Renovate / Dependabot weekly PRs
- Snyk daily scans of dependencies + Docker images
- Trivy for container scanning in CI
- SBOM generation (CycloneDX) for releases
- Critical vulns: SLA 24h patch
- High: 7 days
- Medium: 30 days
- Low: 90 days or next release

### 10.8 Container security

- Minimal base images (distroless or Alpine)
- Non-root user
- Read-only root filesystem (where possible)
- Limit syscalls (seccomp profile)
- Drop all capabilities except needed
- Image signing (cosign) — verified on deploy
- Runtime: Falco for anomaly detection (Fáze 2)

### 10.9 Privileged access

Platform staff access to production:
- SSO via IdP with MFA enforced
- Just-in-time elevation
- Session recording for shell access
- Dual control for destructive operations
- Audit log every command

### 10.10 Email security

- SPF, DKIM, DMARC for all outgoing domains
- DMARC `p=reject` once verified clean
- TLS-RPT + MTA-STS
- Per `19-marketing-seo.md` extends

---

## 11. Fraud detection

### 11.1 Subject domains

- **Order fraud:** card-not-present, account takeover, friendly fraud
- **Signup fraud:** fake accounts, bot signups
- **Marketplace fraud:** fake sellers, money laundering (KYC per `25`)
- **Plugin fraud:** scope abuse, data exfil attempts
- **Review fraud:** fake reviews, review brigading
- **Refund fraud:** chargeback abuse

### 11.2 Signals

- IP reputation (provider integrations)
- Device fingerprint (browser characteristics)
- Velocity (orders/min, signups/min, refunds/period)
- Email age + reputation
- Address verification (CSC mismatch on card)
- 3DS authentication result
- BIN ↔ shipping address mismatch
- Phone validation
- Behavioral biometrics (typing patterns, mouse — Fáze 3+)
- ML model output (combining all signals)

### 11.3 Scoring + decisions

```
score = ml_model(signals, customer_history, tenant_baseline)

if score > 0.85: deny (or queue for manual)
if score > 0.6: challenge (3DS, MFA, etc.)
if score > 0.4: review (admin gets task)
else: allow
```

Tenant configures thresholds. Default conservative for new tenants.

### 11.4 ML model

- Training data: historical orders labeled by chargeback outcome + manual review labels
- Per `33-ai-features.md` extends with ML platform
- Updated weekly
- Per-tenant fine-tuning Fáze 3+ (cold start uses global model)

### 11.5 Manual review queue

Admin → /security/fraud-queue:
- Pending review items
- Detail page with signals + recommendation
- Approve / Deny / Add to allowlist
- Outcome feeds back to model training (label)

### 11.6 Allowlists / denylists

Per tenant:
- Email allowlist (known good repeat customers)
- Email denylist (known abusers)
- IP allowlist / denylist
- Card BIN allowlist / denylist
- Address pattern denylist

### 11.7 Friendly fraud (chargeback abuse)

Track per customer:
- Total chargebacks
- Chargeback rate
- Chargeback ratio to lifetime spend
- Pattern-based detection (always disputes specific category)

High-risk customers: require pre-payment, deny COD, etc.

### 11.8 Plugin / AI agent fraud

- Plugin scope abuse: anomalous API call patterns (e.g., bulk product read when scope is for analytics only)
- AI agent: tool calls outside normal patterns (e.g., agent reading all customers)
- Detection: per `28 §10` and `33-ai-features.md`

### 11.9 Feedback loop

- All fraud decisions logged
- Chargebacks → labeled outcome
- Manual reviews → labels
- Model retrained weekly
- A/B testing of thresholds

---

## 12. Vulnerability & patch management

### 12.1 Discovery sources

- **SAST** (Semgrep, CodeQL) in CI
- **DAST** (OWASP ZAP, Burp scheduled) against staging
- **Dependency scanning** (Snyk, Dependabot, npm audit) in CI + daily
- **Container scanning** (Trivy) in CI + daily on running images
- **Secret scanning** (gitleaks, GitGuardian) in CI + pre-commit
- **Cloud config scanning** (Prowler, Steampipe) weekly
- **Bug bounty** (Intigriti or HackerOne) — public Fáze 2
- **Manual pen test** (annual + post-major-release; certified vendor)
- **Customer reports** (security@shopio.com PGP-protected mailbox)
- **Threat intelligence** (CISA KEV, EU cybersec advisories)

### 12.2 Severity scoring

CVSS 3.1 + Shopio adjustment factors:
- Tenant data exposure +1 (compared to public CVSS)
- Auth bypass +1
- Multi-tenant impact +2
- Pre-auth exploitability +1

Resulting severity:
- **Critical** (9.0+ adjusted): patch within 24h
- **High** (7.0-8.9): patch within 7 days
- **Medium** (4.0-6.9): patch within 30 days
- **Low** (<4.0): patch within 90 days or next release

### 12.3 Patch workflow

```
1. Vulnerability identified
2. Assigned to engineer + tracked in vulnerability tracker (Jira / Linear)
3. Reproduction (private repo)
4. Fix developed (private branch, sec-* prefix)
5. Code review by security team
6. Security regression test added
7. Merge + deploy via standard pipeline (per `31-operations.md`)
8. Verify in production
9. Disclosure (advisory + CVE if applicable)
10. Bug bounty payout (if external reporter)
```

### 12.4 Disclosure policy

Coordinated disclosure:
- 90-day window from report (industry standard)
- Acknowledgment within 24h
- Triage within 7 days
- Fix per severity SLA
- Public advisory after fix deployed + customers notified (if customer-impacting)

CVE assigned for: pre-auth issues, data exposure issues, RCE.

Security advisories at `https://shopio.com/security/advisories` (RSS feed).

### 12.5 Patch deployment

Critical patches:
- Deploy via standard pipeline if low-risk
- Hotfix branch + emergency change process if needed
- Roll-forward strategy (rollback discouraged due to security context)
- Customer notification post-deploy

### 12.6 Customer notification

Customer-impacting vulnerabilities:
- Email + in-app banner
- Severity-based wording
- Recommended actions (e.g., reset passwords if mass-impact)
- GDPR notification per `13.x` if applicable

---

## 13. Incident response

### 13.1 SOP framework

Based on NIST 800-61r2 + SANS Incident Handler's Handbook:

1. **Preparation** — runbooks, on-call rotation, tooling
2. **Detection & Analysis** — security events → triage
3. **Containment** — isolate affected systems
4. **Eradication** — remove root cause
5. **Recovery** — restore normal operations
6. **Post-incident review** — post-mortem + improvements

### 13.2 Severity definitions

| Severity | Definition | Response |
|---|---|---|
| **SEV-1** | Confirmed data breach / production outage / RCE in prod / authentication bypass | All hands, IC assigned, hourly updates, customer notification ASAP |
| **SEV-2** | High-risk vulnerability exploited (no confirmed exfil) / partial outage / multi-tenant impact | IC + responders, 4h updates, prep customer comms |
| **SEV-3** | Suspicious activity contained / single-tenant impact / minor data exposure | On-call investigates, post-mortem |
| **SEV-4** | Anomaly detected / false positive likely | Tracked, monitored |

### 13.3 Roles

- **Incident Commander (IC)** — coordinates response; not technical worker
- **Communications Lead** — handles internal + customer + media comms
- **Technical Lead** — leads investigation
- **Legal/Compliance Lead** — GDPR notification, regulatory comms
- **Scribe** — captures timeline + decisions

### 13.4 GDPR breach notification

If personal data breach risks rights/freedoms of EU data subjects:
- **72-hour rule** — notify supervisory authority (ÚOOÚ in CZ; or lead authority)
- Notify affected data subjects without undue delay (if high risk)
- Document all breaches even if not notifiable

Breach defined by GDPR Art 4(12).

### 13.5 Runbooks (samples)

- `RUN-SEC-001` — Detected credential leak in public repo
- `RUN-SEC-002` — DDoS attack mitigation
- `RUN-SEC-003` — Suspected tenant data exfiltration
- `RUN-SEC-004` — Compromised dependency
- `RUN-SEC-005` — Compromised platform staff credentials
- `RUN-SEC-006` — Mass account takeover wave
- `RUN-SEC-007` — Payment provider security incident (escalate to provider)
- `RUN-SEC-008` — KMS key suspected compromised
- `RUN-SEC-009` — Audit log integrity verification failure

### 13.6 Communication templates

Pre-drafted templates (per `RUN-SEC-001` etc.) approved by legal:
- Customer notification email
- Status page update
- Authority notification letter
- Internal Slack incident channel template
- Press statement (if needed; legal approval required)

### 13.7 Post-mortem

Within 5 business days of resolution:
- Timeline
- Root cause
- Contributing factors
- Customer impact
- What went well
- What needs improvement
- Action items with owners + deadlines

Blameless culture. Public-facing summaries for SEV-1/SEV-2 (transparency).

### 13.8 Tabletop exercises

Quarterly: simulated incidents to test runbooks + team readiness. Score on response time, escalation, communication. Identify gaps.

---

## 14. Compliance & certifications

### 14.1 Mandatory (Day 1)

- **GDPR** (EU 2016/679)
  - DPO appointed (Shopio core team or external; mandate triggered by scale)
  - DPIA for high-risk processing (e.g., AI features, fraud scoring)
  - Records of processing activities (RoPA)
  - DPA template for sub-processors (per `29 §RULE-INT-013` per integration)
  - DSAR (right of access/erasure/rectification) supported (per `18`)
  - Breach notification process (per `13.4`)
  - Privacy by Design throughout
- **PCI-DSS 4.0 SAQ A** (tokenization only; per `13-payments.md`)
  - Annual self-assessment
  - No card data stored or processed by Shopio infra
  - Payment provider attestations on file
- **CZ accounting law compliance** (per `15-tax-compliance.md`)
- **EU consumer protection** (14-day cooling-off, transparent pricing — per `17`, `12`, `19`)
- **ePrivacy Directive** (cookie consent — per `18`, `19`)

### 14.2 Roadmap

| Year | Target |
|---|---|
| **Year 1 (2026)** | ISO 27001:2022 certification (initiate; certified by end of Year 1 if scope tight) |
| **Year 1** | SOC 2 Type I (point-in-time) |
| **Year 2 (2027)** | SOC 2 Type II (annual audit period) |
| **Year 2** | NIS2 readiness assessment (if Shopio qualifies as "important entity" by EU criteria) |
| **Year 3** | Re-certifications + scope expansion |

Note: Per `01-DEC-COMPLIANCE-*` registry, exact timeline TBD. This document captures the strategic direction.

### 14.3 ISO 27001 controls (Annex A) high-level

Implementing ISMS (Information Security Management System). Notable controls:
- A.5 Information security policies
- A.6 People controls (HR, screening, awareness)
- A.7 Physical (data center provider attests)
- A.8 Technological (most of this document)

Process: gap analysis → policies + procedures → implementation → internal audit → external audit → certification.

### 14.4 SOC 2 Trust Service Criteria

- **Security** (CC1-CC9) — primary
- **Availability** (per `31-operations.md`)
- **Confidentiality** — for B2B tenants
- **Processing Integrity** (financial transactions)
- **Privacy** — overlap with GDPR

SOC 2 Type II demonstrates controls operate effectively over time (vs Type I point-in-time).

### 14.5 NIS2 (EU)

Cybersecurity directive for "essential" + "important" entities. Likely Shopio qualifies as **important** given:
- Digital service provider category
- B2B service to many businesses
- EU operations

Requirements:
- Risk management measures (technical + organizational)
- Incident reporting to national CSIRT (24h early warning, 72h notification, 1mo final report)
- Supply chain security
- Vulnerability disclosure
- Crisis management

Assessment Fáze 2. Full alignment Fáze 3+.

### 14.6 DORA (EU; for financial entities)

DORA applies to financial entities + their ICT providers. Shopio is not a financial entity. If serving financial-sector customers Fáze 3+: assess as "ICT third-party service provider"; otherwise out of scope.

### 14.7 Certifications NOT pursued

- HIPAA — US healthcare; not core market
- FedRAMP — US gov; not core market
- TISAX — automotive; out of scope unless customer demand
- ENS (Esquema Nacional de Seguridad) — Spanish govt; not initial market
- Customer-specific (e.g., bank-mandated) — case-by-case

### 14.8 Customer trust artifacts

Public:
- Privacy policy
- Terms of service
- Sub-processor list
- Status page (per `31`)
- Security advisories RSS
- Trust center (shopio.com/trust): compliance status, audit reports (NDA-gated), security FAQ

Enterprise customers:
- DPA signature
- Security questionnaire response
- Pen test summary (NDA)
- SOC 2 report (NDA)
- Insurance certs

---

## 15. Business rules

### RULE-SEC-001: Passkey-first registration

New customer signup defaults to passkey enrollment. Password optional fallback. Marketing copy + UX prefer passkey.

### RULE-SEC-002: MFA mandatory for high-privilege roles

`PERM-ADMIN-FULL` users must have MFA enabled. Cannot complete login without it.

### RULE-SEC-003: Session timeout idle vs absolute

Idle timeout: configurable per tenant, default 60 min admin / 90 min customer. Absolute timeout: default 3 days admin / 30 days customer. Both reset on activity (idle) or re-auth (absolute).

### RULE-SEC-004: HTTP-only cookies for refresh tokens

Refresh tokens never accessible to JavaScript. Mitigates XSS impact.

### RULE-SEC-005: Token theft detection

Per `28 §4.5`. Refresh reuse → family revoked + security event.

### RULE-SEC-006: Step-up authentication for sensitive operations

Operations requiring step-up MFA:
- Refunds > threshold
- Adding new MFA device
- Removing MFA
- Changing email
- Adding API tokens with broad scope
- Changing billing payment method
- Approving plugin install with sensitive scopes
- Exporting customer data (DSAR or bulk export)

Step-up = MFA prompt within active session, even if recently authenticated.

### RULE-SEC-007: Password not in HIBP

At password set/change, client-side k-anonymity check vs Pwned Passwords API. Match → reject + require different password.

### RULE-SEC-008: argon2id parameters

Memory ≥ 64 MB, iterations ≥ 3, parallelism = 4. Tune for ~250ms per hash on production hardware. Re-tune yearly.

### RULE-SEC-009: TLS 1.3 mandatory

TLS 1.2 acceptable for legacy integrations only (whitelisted). Default rejects.

### RULE-SEC-010: All sensitive fields envelope-encrypted

PII, credentials, OAuth tokens encrypted at application layer with KMS-wrapped DEK. AAD bound to context.

### RULE-SEC-011: Per-tenant KEK

Each tenant has own KEK. Deletion schedules KEK destruction (defense in depth).

### RULE-SEC-012: Audit log immutable + hash-chained

Cannot delete or modify entries. Hash chain detects tampering. Hourly signed batches archive to immutable storage.

### RULE-SEC-013: All security-relevant actions audited

Per `8.1`. Audit log entries written synchronously (atomic with action) — failure to audit fails the operation.

### RULE-SEC-014: Rate limiting multi-layer

- Login attempts: 5/15min per IP, 10/24h per account, cooldown after
- API: per token (per `28 §10`) + per IP for unauthenticated
- Forgot-password: 3/hour per IP, 3/24h per email
- Signup: 3/IP/hour
- Per tenant aggregated (DDoS guard)

### RULE-SEC-015: CSRF protection

SameSite=Strict cookies + Origin/Referer check + double-submit token for state-changing requests.

### RULE-SEC-016: CSP strict

Admin: `default-src 'self'`; strict per `27 §16.2`.
Storefront: per theme config + tenant CSP customizations per `26 §RULE-THM-022`.

### RULE-SEC-017: All inputs validated

Zod schema or equivalent. No raw SQL with user input. Parameterized queries only.

### RULE-SEC-018: SSRF egress allowlist

Server-side HTTP calls only to approved domains. Egress proxy enforces in production.

### RULE-SEC-019: IP allowlist optional per tenant

For admin login, tenant can configure IP allowlist. Reject login outside list.

### RULE-SEC-020: New device login notification

Login from new device fingerprint → email customer/admin within 5 min.

### RULE-SEC-021: Impossible travel detection

Geolocation jump > 500 km in < 60 min → security event + optional step-up MFA.

### RULE-SEC-022: Concurrent session detection

Multiple sessions per user OK. But anomalies (different devices) raised. User can list + revoke.

### RULE-SEC-023: Privileged access just-in-time

Platform staff cannot access tenant data without explicit JIT grant (audit + tenant notification).

### RULE-SEC-024: Dual control for production destructive ops

Drop production database, delete tenant, mass user revocation: require two-person approval.

### RULE-SEC-025: Secrets never in code or logs

Pre-commit hooks + CI scan. Log redaction middleware (auto-strip `Authorization`, `password`, etc.).

### RULE-SEC-026: All releases signed

cosign for container images. Verified at deploy time. Reject unsigned.

### RULE-SEC-027: Bug bounty in scope

Customer-facing endpoints + admin + APIs + plugins infra in scope. Out of scope: third-party hosted services, social engineering, physical, DoS, scanner output without exploit.

### RULE-SEC-028: GDPR DSAR within 30 days

Right of access/erasure/rectification fulfilled within 30 days. Free for first request. Per `18`.

### RULE-SEC-029: GDPR breach notification 72h

If breach affects EU data subjects: notify ÚOOÚ (CZ) within 72h. Affected subjects without undue delay if high risk.

### RULE-SEC-030: ePrivacy cookie consent

Non-essential cookies require opt-in consent. Cookie banner per `18` + `19`.

### RULE-SEC-031: Data residency EU primary

Production data in EU regions (AWS eu-central-1 Frankfurt + eu-west-3 Paris). Customer data does not leave EU without explicit DPA.

### RULE-SEC-032: Sub-processor disclosure

Sub-processors (AWS, Cloudflare, Stripe, SendGrid, etc.) listed publicly with reason + region. Tenant notified 30 days before adding new sub-processor.

### RULE-SEC-033: PII minimization

Collect only necessary PII. Optional fields don't request unnecessarily.

### RULE-SEC-034: Pseudonymization where possible

Customer IDs are pub_ids (NanoID); not exposing internal UUIDs. Email hashed for analytics (k-anonymous bucketing).

### RULE-SEC-035: Backups encrypted + tested

Daily backups encrypted with separate KEK. Restore tested monthly. Geographic replication EU regions.

### RULE-SEC-036: Vulnerability SLA enforced

Critical 24h, High 7d, Medium 30d, Low 90d. Tracked in vulnerability registry; weekly review.

### RULE-SEC-037: Pen test annual

External penetration test annually + post-major-architecture-change. Findings tracked + fixed per SLA. Public summary in trust center.

### RULE-SEC-038: Erasure preserves audit pseudonymized

GDPR erasure replaces personal identifiers in audit log with pseudonyms. Audit semantics preserved.

### RULE-SEC-039: Plugin / agent threat model

Plugins + AI agents treated as untrusted. Scopes minimum. Behavior monitored. Anomalies → security events.

### RULE-SEC-040: SaaS sub-processor security review

Each sub-processor reviewed annually: SOC 2 / ISO 27001 review, DPA, residency, breach history.

### RULE-SEC-041: Employee security awareness

All employees (initial = founder + AI; scaling Fáze 2+): annual security training, phishing simulations, secure coding training for engineers.

### RULE-SEC-042: SAST/DAST/SCA in CI

Required CI checks; failures block merge to main. Override only with security team approval + tracked exception.

### RULE-SEC-043: KMS access audited

Every KMS key use audited (KMS CloudTrail / equivalent). Anomalies → alert.

### RULE-SEC-044: Signed batches verifiable offline

Audit log signed batches verifiable with public verification key (published on trust center). Customers can run verification on their copy of audit log export.

### RULE-SEC-045: AI agent confirmation for write ops

Agent (MCP) write operations require user confirmation in conversation UI (per `33-ai-features.md`). Read operations allowed within scope.

### RULE-SEC-046: Tenant deletion 30-day grace

Tenant marked deleted: data retained 30 days for restore. After 30 days: KEK destruction + permanent. Audit log retained per regulatory.

### RULE-SEC-047: Default deny for permissions

New roles start with zero permissions. Explicit add required. No implicit grants.

### RULE-SEC-048: Account lockout backoff

Failed login attempts:
- 1-2 failures: no penalty
- 3-5: CAPTCHA / Turnstile
- 6-10: 1-min cooldown
- 11+: 15-min cooldown, alert account owner
- 20+: account locked, manual unlock

Configurable per tenant for high-security setups.

### RULE-SEC-049: Browser fingerprint hashed

Device fingerprints hashed (not reversible). Used for anomaly detection only.

### RULE-SEC-050: Compliance evidence collection automated

Per ISO 27001 / SOC 2: evidence (logs, configs, screenshots) collected continuously via automation; auditor-ready reports generated.

---

## 16. REST API endpoints

### 16.1 User auth (me-scope)

```
POST   /api/{date}/auth/login                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          # email+password OR passkey challenge
POST   /api/{date}/auth/login/passkey:challenge                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            # initiate WebAuthn
POST   /api/{date}/auth/login/passkey:verify
POST   /api/{date}/auth/mfa:verify
POST   /api/{date}/auth/logout
POST   /api/{date}/auth/refresh                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              # rotate access token
POST   /api/{date}/auth/forgot-password
POST   /api/{date}/auth/reset-password
POST   /api/{date}/auth/verify-email
POST   /api/{date}/auth/signup
POST   /api/{date}/auth/oauth/{provider}:start                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              # SSO start (Fáze 2+)
GET    /api/{date}/auth/oauth/{provider}/callback
```

### 16.2 Passkey + MFA management

```
GET    /api/{date}/me/passkeys
POST   /api/{date}/me/passkeys:register-challenge
POST   /api/{date}/me/passkeys:register-verify
PATCH  /api/{date}/me/passkeys/{id}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            # rename
DELETE /api/{date}/me/passkeys/{id}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            # revoke
GET    /api/{date}/me/mfa
POST   /api/{date}/me/mfa/totp:enroll
POST   /api/{date}/me/mfa/totp:verify
POST   /api/{date}/me/mfa:disable                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              # requires step-up
GET    /api/{date}/me/mfa/recovery-codes
POST   /api/{date}/me/mfa/recovery-codes:regenerate
```

### 16.3 Sessions

```
GET    /api/{date}/me/sessions
DELETE /api/{date}/me/sessions/{id}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              # revoke specific
POST   /api/{date}/me/sessions:revoke-all-others                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                # keep current session, revoke others
```

### 16.4 Tenant security settings

```
GET    /api/{date}/security/settings
PATCH  /api/{date}/security/settings
GET    /api/{date}/security/ip-allowlist
PUT    /api/{date}/security/ip-allowlist
```

### 16.5 Audit log

```
GET    /api/{date}/security/audit-log?from=...&to=...&category=...&actor=...
GET    /api/{date}/security/audit-log/{entry_id}
POST   /api/{date}/security/audit-log:export                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          # async CSV export
POST   /api/{date}/security/audit-log:verify-integrity                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                # hash chain verification
GET    /api/{date}/security/audit-log/signed-batches                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  # for offline verification
```

### 16.6 Security events

```
GET    /api/{date}/security/events?severity=...&status=...&from=...
GET    /api/{date}/security/events/{id}
POST   /api/{date}/security/events/{id}:acknowledge
POST   /api/{date}/security/events/{id}:resolve
POST   /api/{date}/security/events/{id}:mark-false-positive
GET    /api/{date}/security/events/dashboard                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              # KPIs
```

### 16.7 Incidents

```
GET    /api/{date}/security/incidents
GET    /api/{date}/security/incidents/{id}
POST   /api/{date}/security/incidents                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  # platform staff only
PATCH  /api/{date}/security/incidents/{id}
POST   /api/{date}/security/incidents/{id}:close
POST   /api/{date}/security/incidents/{id}:publish-postmortem
```

### 16.8 Fraud queue

```
GET    /api/{date}/security/fraud-queue
GET    /api/{date}/security/fraud-queue/{id}
POST   /api/{date}/security/fraud-queue/{id}:approve
POST   /api/{date}/security/fraud-queue/{id}:deny
POST   /api/{date}/security/fraud-queue/{id}:add-to-allowlist
```

### 16.9 Vulnerability + bug bounty

```
GET    /api/{date}/security/vulnerabilities                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  # internal
POST   /api/{date}/security/vulnerabilities
PATCH  /api/{date}/security/vulnerabilities/{id}

POST   /api/{date}/security/bug-bounty/submissions                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                # public-ish (rate limited)
GET    /api/{date}/security/bug-bounty/submissions                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  # platform staff
GET    /api/{date}/security/bug-bounty/submissions/{id}
PATCH  /api/{date}/security/bug-bounty/submissions/{id}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              # triage actions
```

### 16.10 Compliance + trust center

```
GET    /api/{date}/security/compliance/status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  # certifications, audit dates
GET    /api/{date}/security/compliance/sub-processors                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  # public list
GET    /api/{date}/security/compliance/data-residency
GET    /api/{date}/security/compliance/dpa                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            # download DPA PDF
```

### 16.11 KMS / key rotation (platform admin)

```
GET    /api/{date}/security/kms/keys                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  # internal only
POST   /api/{date}/security/kms/keys/{id}:rotate
GET    /api/{date}/security/kms/keys:audit-trail
```

### 16.12 Privileged access (just-in-time, platform)

```
POST   /api/{date}/security/privileged-access:request                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          # body: { tenant_id, reason, duration_hours }
POST   /api/{date}/security/privileged-access/{id}:approve
POST   /api/{date}/security/privileged-access/{id}:revoke
GET    /api/{date}/security/privileged-access:active
```

### 16.13 Example: Login with passkey

```http
POST /api/2026-05-20/auth/login/passkey:challenge HTTP/1.1
Content-Type: application/json

{
  "email": "user@example.com"
}
```

```jsonc
HTTP/1.1 200 OK

{
  "data": {
    "challenge": "<base64url>",
    "rp_id": "shopio.com",
    "user_handle": "<base64url>",
    "allow_credentials": [
      { "type": "public-key", "id": "<base64url credential_id>", "transports": ["internal","hybrid"] }
    ],
    "timeout_ms": 60000
  }
}
```

Browser does `navigator.credentials.get(...)`, sends:

```http
POST /api/2026-05-20/auth/login/passkey:verify HTTP/1.1

{
  "credential_id": "<base64url>",
  "client_data_json": "<base64url>",
  "authenticator_data": "<base64url>",
  "signature": "<base64url>"
}
```

Server verifies, issues:

```jsonc
HTTP/1.1 200 OK
Set-Cookie: shopio_refresh=<...>; HttpOnly; Secure; SameSite=Strict; Max-Age=...

{
  "data": {
    "access_token": "<JWT>",
    "expires_in": 900,
    "user": { "id": "usr_aB", "email": "...", "personas": ["MERCHANT-OWNER"] }
  }
}
```

### 16.14 Example: Audit log verification

```http
POST /api/2026-05-20/security/audit-log:verify-integrity HTTP/1.1

{
  "from_sequence": 100000,
  "to_sequence": 110000
}
```

```jsonc
HTTP/1.1 200 OK

{
  "data": {
    "verified": true,
    "entries_checked": 10000,
    "hash_chain_breaks": [],
    "signed_batches_verified": 7,
    "all_signatures_valid": true,
    "duration_ms": 2300
  }
}
```

### 16.15 Example: GDPR breach incident notification

```http
POST /api/2026-05-20/security/incidents HTTP/1.1
Authorization: Bearer <platform_staff>

{
  "title": "Suspected exfiltration via compromised integration plugin",
  "severity": "sev2",
  "category": "data_breach",
  "tenants_affected": ["tnt_aB","tnt_xY"],
  "customers_affected_count": 4200,
  "data_exfil_suspected": true,
  "gdpr_notification_required": true,
  "description_html": "<p>Detected anomalous bulk customer exports from app installation ...</p>"
}
```

```jsonc
HTTP/1.1 201 Created

{
  "data": {
    "id": "inc_aB",
    "number": "INC-2026-00000123",
    "status": "open",
    "gdpr_72h_deadline_at": "2026-05-23T15:00:00Z",
    "incident_commander_user_id": "<assigned>"
  }
}
```

---

## 17. GraphQL schema

```graphql
type SecuritySettings {
  tenantId: ID!
  mfaRequiredForOwners: Boolean!
  mfaRequiredForAdmins: Boolean!
  mfaRequiredForAllStaff: Boolean!
  passkeyRequiredForOwners: Boolean!
  sessionTimeoutIdleMinutes: Int!
  sessionTimeoutAbsoluteMinutes: Int!
  concurrentSessionsMax: Int
  ipAllowlist: [String!]
  ipDenylist: [String!]
  passwordMinLength: Int!
  passwordCheckHibp: Boolean!
  passwordRotationDays: Int
  requireStepUpMfaForHighValueRefunds: Boolean!
  highValueRefundThreshold: Money!
  ssoEnabled: Boolean!
  ssoProviderKind: SsoProviderKind
  ssoRequireForAdmins: Boolean!
  ssoJitProvisioning: Boolean!
  notifyOnNewDeviceLogin: Boolean!
  notifyOnFailedLoginThreshold: Boolean!
  failedLoginThreshold: Int!
  auditLogHotRetentionDays: Int!
  auditLogColdRetentionDays: Int!
}

enum SsoProviderKind { SAML OIDC }

type AuditLogEntry implements Node {
  id: ID!
  pubId: String!
  sequenceNumber: String!                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  # bigint as string
  category: AuditCategory!
  action: String!
  outcome: AuditOutcome!
  actorKind: AuditActorKind!
  actorLabel: String
  actorUser: User
  resourceKind: String
  resourceId: String
  resourceLabel: String
  ipAddress: String
  userAgent: String
  sessionId: String
  reason: String
  details: JSON
  occurredAt: DateTime!
}

enum AuditCategory {
  AUTH AUTHZ DATA_ACCESS DATA_MODIFICATION CONFIG_CHANGE SECURITY_EVENT
  ADMIN_ACTION PLATFORM_ACTION BILLING PRIVACY IMPERSONATION PLUGIN AGENT
}
enum AuditOutcome { SUCCESS FAILURE DENIED PENDING }
enum AuditActorKind { USER SERVICE_ACCOUNT API_TOKEN APP_INSTALLATION PLATFORM_STAFF SYSTEM AGENT }

type SecurityEvent implements Node {
  id: ID!
  pubId: String!
  eventKind: SecurityEventKind!
  severity: SecuritySeverity!
  user: User
  customer: Customer
  ipAddress: String
  geoCountryCode: String
  details: JSON
  status: SecurityEventStatus!
  resolutionNotes: String
  incident: SecurityIncident
  detectedAt: DateTime!
  resolvedAt: DateTime
}

enum SecurityEventKind {
  FAILED_LOGIN ACCOUNT_LOCKED PASSWORD_RESET_REQUESTED PASSWORD_RESET_COMPLETED
  MFA_ENROLLED MFA_REMOVED MFA_BYPASS_REQUESTED IMPOSSIBLE_TRAVEL SUSPICIOUS_IP
  SESSION_ANOMALY PRIVILEGE_ESCALATION_ATTEMPT PERMISSION_CHANGE USER_SUSPENDED
  TENANT_SUSPENDED API_RATE_LIMIT_VIOLATION TOKEN_COMPROMISED TOKEN_REUSE_DETECTED
  CSRF_FAILURE SUSPICIOUS_BROWSER_FINGERPRINT BOT_DETECTED DDOS_MITIGATION
  FRAUD_SIGNAL DLP_VIOLATION EXFILTRATION_PATTERN SQL_INJECTION_ATTEMPT
  XSS_ATTEMPT SSRF_ATTEMPT DEPENDENCY_VULNERABILITY SECRET_IN_CODE
  PLUGIN_SECURITY_REVIEW_FAILED AGENT_UNAUTHORIZED_ACTION EXPORT_BLOCKED
}

enum SecuritySeverity { INFO LOW MEDIUM HIGH CRITICAL }
enum SecurityEventStatus { OPEN ACKNOWLEDGED INVESTIGATING RESOLVED FALSE_POSITIVE SUPPRESSED }

type SecurityIncident implements Node {
  id: ID!
  pubId: String!
  number: String!
  title: String!
  descriptionHtml: String!
  severity: IncidentSeverity!
  category: IncidentCategory!
  status: IncidentStatus!
  tenantsAffected: [String!]
  customersAffectedCount: Int
  dataExfilSuspected: Boolean!
  dataExfilConfirmed: Boolean!
  detectedAt: DateTime!
  contained: DateTime
  remediated: DateTime
  closedAt: DateTime
  gdprNotificationRequired: Boolean!
  gdprNotificationSentAt: DateTime
  gdpr72hDeadlineAt: DateTime
  authorityNotified: Boolean!
  incidentCommander: User
  responders: JSON
  postmortemUrl: String
  postmortemPublishedAt: DateTime
}

enum IncidentSeverity { SEV1 SEV2 SEV3 SEV4 }
enum IncidentCategory {
  DATA_BREACH ACCOUNT_TAKEOVER PLATFORM_OUTAGE DDOS VULNERABILITY_DISCLOSED
  COMPLIANCE_FINDING INSIDER_THREAT SUPPLY_CHAIN PHISHING OTHER
}
enum IncidentStatus { OPEN INVESTIGATING CONTAINED REMEDIATED CLOSED }

type Session implements Node {
  id: ID!
  user: User!
  deviceLabel: String
  userAgent: String
  ipAddress: String
  countryCode: String
  city: String
  assuranceLevel: AssuranceLevel!
  createdAt: DateTime!
  lastUsedAt: DateTime!
  expiresAt: DateTime!
  isCurrent: Boolean!                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  # true for the session viewing
}

enum AssuranceLevel { LOW MFA_VERIFIED STEP_UP }

type FraudScore {
  id: ID!
  subjectKind: FraudSubjectKind!
  subjectId: String!
  score: Float!
  signals: JSON!
  recommendation: FraudRecommendation!
  recommendationApplied: String
  modelName: String!
  modelVersion: String!
  computedAt: DateTime!
}

enum FraudSubjectKind { ORDER SIGNUP LOGIN MARKETPLACE_SELLER_APPLICATION PLUGIN_PUBLISH REVIEW_SUBMISSION }
enum FraudRecommendation { ALLOW REVIEW CHALLENGE DENY }

type BugBountySubmission {
  id: ID!
  pubId: String!
  title: String!
  reporterHandle: String!
  severity: BountySeverity
  status: BountyStatus!
  bountyAmount: Money
  bountyPaidAt: DateTime
  cveId: String
  publicAdvisoryUrl: String
  submittedAt: DateTime!
}

enum BountySeverity { LOW MEDIUM HIGH CRITICAL }
enum BountyStatus { TRIAGE ACCEPTED DUPLICATE OUT_OF_SCOPE INFORMATIVE FIXED DISPUTED DISCLOSED CLOSED }

extend type Query {
  securitySettings: SecuritySettings! @auth(requires: PERM_SECURITY_VIEW)
  myActiveSessions: [Session!]!
  myMfaStatus: MfaStatus!
  myPasskeys: [Passkey!]!
  auditLogEntries(filter: AuditLogFilter, first: Int, after: String): AuditLogEntryConnection! @auth(requires: PERM_AUDIT_LOG_VIEW)
  auditLogEntry(id: ID!): AuditLogEntry @auth(requires: PERM_AUDIT_LOG_VIEW)
  securityEvents(filter: SecurityEventFilter, first: Int, after: String): SecurityEventConnection! @auth(requires: PERM_SECURITY_EVENT_VIEW)
  securityEvent(id: ID!): SecurityEvent @auth(requires: PERM_SECURITY_EVENT_VIEW)
  securityIncidents(filter: SecurityIncidentFilter): [SecurityIncident!]! @auth(requires: PERM_INCIDENT_VIEW)
  securityIncident(id: ID, pubId: String, number: String): SecurityIncident
  fraudQueue(status: [FraudRecommendation!]): [FraudScore!]! @auth(requires: PERM_SECURITY_FRAUD_VIEW)
  bugBountySubmissions(filter: BountyFilter): [BugBountySubmission!]! @auth(requires: PERM_PLATFORM_SECURITY_INVESTIGATE)
  complianceStatus: ComplianceStatus!                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              # public
  subProcessors: [SubProcessor!]!                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  # public
}

extend type Mutation {
  # Auth + MFA
  startPasskeyLogin(email: String!): PasskeyLoginChallenge!
  completePasskeyLogin(input: CompletePasskeyLoginInput!): AuthPayload!
  startPasswordLogin(email: String!, password: String!): AuthPayload!
  verifyMfa(input: VerifyMfaInput!): AuthPayload!
  logout: MutationPayload!
  refresh: AuthPayload!
  signup(input: SignupInput!): AuthPayload!
  forgotPassword(email: String!): MutationPayload!
  resetPassword(input: ResetPasswordInput!): MutationPayload!

  # Passkey management
  startPasskeyRegistration: PasskeyRegistrationChallenge!
  completePasskeyRegistration(input: CompletePasskeyRegistrationInput!): Passkey!
  renamePasskey(id: ID!, label: String!): Passkey!
  revokePasskey(id: ID!): DeletePayload!

  # MFA management
  enrollTotp: TotpEnrollChallenge!
  verifyTotpEnrollment(code: String!): MutationPayload!
  disableMfa: MutationPayload!                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  # requires step-up
  regenerateRecoveryCodes: [String!]!

  # Sessions
  revokeSession(id: ID!): MutationPayload!
  revokeAllOtherSessions: MutationPayload!

  # Security settings
  updateSecuritySettings(input: SecuritySettingsInput!): SecuritySettings! @auth(requires: PERM_SECURITY_MANAGE)

  # Security events
  acknowledgeSecurityEvent(id: ID!): SecurityEvent! @auth(requires: PERM_SECURITY_EVENT_MANAGE)
  resolveSecurityEvent(id: ID!, notes: String!): SecurityEvent! @auth(requires: PERM_SECURITY_EVENT_MANAGE)
  markSecurityEventFalsePositive(id: ID!, notes: String): SecurityEvent! @auth(requires: PERM_SECURITY_EVENT_MANAGE)

  # Incidents
  createSecurityIncident(input: CreateIncidentInput!): SecurityIncident! @auth(requires: PERM_PLATFORM_SECURITY_INVESTIGATE)
  updateSecurityIncident(id: ID!, input: UpdateIncidentInput!): SecurityIncident!
  closeSecurityIncident(id: ID!): SecurityIncident!

  # Fraud
  approveFraudQueueItem(id: ID!, notes: String): MutationPayload! @auth(requires: PERM_SECURITY_FRAUD_MANAGE)
  denyFraudQueueItem(id: ID!, reason: String!): MutationPayload! @auth(requires: PERM_SECURITY_FRAUD_MANAGE)
  addFraudAllowlistEntry(input: FraudAllowlistEntryInput!): MutationPayload! @auth(requires: PERM_SECURITY_FRAUD_MANAGE)

  # Bug bounty
  submitBugBountyReport(input: BugBountySubmissionInput!): BugBountySubmission!                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  # public submit
  triageBountySubmission(id: ID!, input: TriageBountyInput!): BugBountySubmission! @auth(requires: PERM_PLATFORM_SECURITY_INVESTIGATE)

  # Privileged access
  requestPrivilegedAccess(input: RequestPrivilegedAccessInput!): PrivilegedAccessGrant! @auth(requires: PERM_PLATFORM_STAFF)
  approvePrivilegedAccess(id: ID!): PrivilegedAccessGrant!
  revokePrivilegedAccess(id: ID!): MutationPayload!
}

type ComplianceStatus {
  gdprCompliant: Boolean!
  pciSaqACompliant: Boolean!
  iso27001Status: CertificationStatus!
  soc2Type1Status: CertificationStatus!
  soc2Type2Status: CertificationStatus!
  lastPenTestAt: DateTime
  publicAdvisoriesUrl: String!
  trustCenterUrl: String!
}

enum CertificationStatus { NOT_PURSUED PLANNING IN_PROGRESS ACHIEVED LAPSED }
```

---

## 18. Events

| Build-spec ID | Wire | Payload |
|---|---|---|
| `EVENT-SEC-LOGIN-SUCCESS` | `security.login_success` | `{ user, session, ip }` |
| `EVENT-SEC-LOGIN-FAILURE` | `security.login_failure` | `{ email_hash, ip, reason }` |
| `EVENT-SEC-MFA-CHALLENGE-PASSED` | `security.mfa_challenge_passed` | `{ user, method }` |
| `EVENT-SEC-MFA-CHALLENGE-FAILED` | `security.mfa_challenge_failed` | `{ user, method }` |
| `EVENT-SEC-PASSKEY-REGISTERED` | `security.passkey_registered` | `{ user, credential_id }` |
| `EVENT-SEC-PASSKEY-REVOKED` | `security.passkey_revoked` | `{ user, credential_id }` |
| `EVENT-SEC-PASSWORD-CHANGED` | `security.password_changed` | `{ user }` |
| `EVENT-SEC-SESSION-REVOKED` | `security.session_revoked` | `{ session, reason }` |
| `EVENT-SEC-NEW-DEVICE-LOGIN` | `security.new_device_login` | `{ user, ip, ua_fingerprint }` |
| `EVENT-SEC-IMPOSSIBLE-TRAVEL-DETECTED` | `security.impossible_travel` | `{ user, ips, distance_km, time_delta_seconds }` |
| `EVENT-SEC-ACCOUNT-LOCKED` | `security.account_locked` | `{ user, reason }` |
| `EVENT-SEC-IP-DENYLISTED` | `security.ip_denylisted` | `{ ip, reason }` |
| `EVENT-SEC-RATE-LIMIT-VIOLATION` | `security.rate_limit_violation` | `{ subject, endpoint, count }` |
| `EVENT-SEC-CSRF-VIOLATION` | `security.csrf_violation` | `{ request_id }` |
| `EVENT-SEC-AUDIT-LOG-INTEGRITY-FAILURE` | `security.audit_log_integrity_failure` | `{ tenant, broken_sequence }` |
| `EVENT-SEC-KMS-ACCESS-DENIED` | `security.kms_access_denied` | `{ key_id, reason }` |
| `EVENT-SEC-KEY-ROTATION-COMPLETED` | `security.key_rotation_completed` | `{ key_kind, new_version }` |
| `EVENT-SEC-SECURITY-EVENT-OPENED` | `security.security_event_opened` | `{ event }` |
| `EVENT-SEC-INCIDENT-OPENED` | `security.incident_opened` | `{ incident }` |
| `EVENT-SEC-INCIDENT-RESOLVED` | `security.incident_resolved` | `{ incident }` |
| `EVENT-SEC-GDPR-72H-DEADLINE-APPROACHING` | `security.gdpr_72h_deadline_approaching` | `{ incident, hours_remaining }` |
| `EVENT-SEC-FRAUD-FLAGGED` | `security.fraud_flagged` | `{ score }` |
| `EVENT-SEC-PRIVILEGED-ACCESS-GRANTED` | `security.privileged_access_granted` | `{ grant }` |
| `EVENT-SEC-PRIVILEGED-ACCESS-USED` | `security.privileged_access_used` | `{ grant, action }` |
| `EVENT-SEC-VULNERABILITY-DISCOVERED` | `security.vulnerability_discovered` | `{ vuln, severity }` |
| `EVENT-SEC-VULNERABILITY-PATCHED` | `security.vulnerability_patched` | `{ vuln }` |
| `EVENT-SEC-BOT-DETECTED` | `security.bot_detected` | `{ ip, ua }` |
| `EVENT-SEC-DDOS-MITIGATION-TRIGGERED` | `security.ddos_mitigation_triggered` | `{ traffic_profile }` |
| `EVENT-SEC-DEPENDENCY-VULN-DETECTED` | `security.dependency_vuln_detected` | `{ package, severity }` |
| `EVENT-SEC-SECRET-LEAKED` | `security.secret_leaked` | `{ secret_kind, source }` (alerts immediately) |
| `EVENT-SEC-PEN-TEST-COMPLETED` | `security.pen_test_completed` | `{ findings_count }` |
| `EVENT-SEC-CERTIFICATION-RENEWAL-DUE` | `security.certification_renewal_due` | `{ standard, days_until }` |

**Konzumenti:**
- Notification center (per `27`)
- SOC/SIEM (per `31`)
- Email alerts to security@tenant
- Webhooks (subscribed via `28`)
- Compliance reporting

---

## 19. Background jobs

| Job | Trigger | Queue | Frequency |
|---|---|---|---|
| `JOB-EXPIRE-SESSIONS` | scheduled | `security` | Every 5 min |
| `JOB-EXPIRE-AUTH-TOKENS` | scheduled | `security` | Hourly |
| `JOB-DETECT-ANOMALIES-PER-SESSION` | EVENT-SEC-LOGIN-SUCCESS | `security` | On-demand |
| `JOB-DETECT-IMPOSSIBLE-TRAVEL` | EVENT-SEC-LOGIN-SUCCESS | `security` | On-demand |
| `JOB-DETECT-NEW-DEVICE-LOGIN` | EVENT-SEC-LOGIN-SUCCESS | `security` | On-demand |
| `JOB-DELIVER-NEW-DEVICE-NOTIFICATION` | EVENT-SEC-NEW-DEVICE-LOGIN | `notifications` | On-demand |
| `JOB-COMPUTE-FRAUD-SCORE` | order placed, signup, etc. | `fraud-ml` | On-demand |
| `JOB-RETRAIN-FRAUD-MODEL` | scheduled | `ml-training` | Weekly |
| `JOB-SIGN-AUDIT-LOG-BATCH` | scheduled | `audit` | Hourly |
| `JOB-VERIFY-AUDIT-LOG-INTEGRITY` | scheduled | `audit` | Daily |
| `JOB-ARCHIVE-AUDIT-LOG-COLD` | scheduled | `archival` | Daily (after retention threshold) |
| `JOB-ROTATE-JWT-SIGNING-KEY` | scheduled (monthly) | `kms` | Monthly |
| `JOB-ROTATE-AUDIT-SIGNING-KEY` | scheduled (quarterly) | `kms` | Quarterly |
| `JOB-ROTATE-TENANT-KEKS` | scheduled (yearly per tenant) | `kms` | Yearly per tenant |
| `JOB-PURGE-RETIRED-KEYS` | scheduled (after retention) | `kms` | Daily |
| `JOB-DETECT-DEPENDENCY-VULNERABILITIES` | scheduled | `scanning` | Daily |
| `JOB-DETECT-CONTAINER-VULNERABILITIES` | scheduled | `scanning` | Daily |
| `JOB-SCAN-SECRETS-IN-CODE` | git push (CI hook) | `scanning` | On-demand |
| `JOB-RUN-DAST-AGAINST-STAGING` | scheduled | `scanning` | Weekly |
| `JOB-GENERATE-SBOM` | release tag | `release` | On-demand |
| `JOB-CHECK-CERTIFICATE-EXPIRATION` | scheduled | `monitoring` | Daily |
| `JOB-GDPR-72H-COUNTDOWN-ALERT` | EVENT-SEC-INCIDENT-OPENED (gdpr_notification_required) | `compliance` | Continuous (alerts at 48h/24h/12h remaining) |
| `JOB-PROCESS-DSAR-REQUEST` | DSAR submitted | `privacy` | On-demand |
| `JOB-PROCESS-ERASURE-REQUEST` | erasure submitted | `privacy` | On-demand |
| `JOB-PROPAGATE-ERASURE-TO-INTEGRATIONS` | EVENT-CUSTOMER-ERASED | `privacy` | On-demand |
| `JOB-AGGREGATE-SECURITY-METRICS` | scheduled | `analytics` | Hourly |
| `JOB-DETECT-CREDENTIAL-STUFFING` | scheduled | `security` | Every 5 min |
| `JOB-EVALUATE-IP-REPUTATION` | scheduled | `security` | Continuous (cache TTL 1h) |
| `JOB-ASSEMBLE-COMPLIANCE-EVIDENCE` | scheduled | `compliance` | Daily |
| `JOB-CERTIFICATION-RENEWAL-REMINDER` | scheduled | `compliance` | Monthly (90/60/30 days before) |
| `JOB-BUG-BOUNTY-TRIAGE-ESCALATION` | new submission | `security-triage` | Continuous (escalate if > 7 days untriaged) |
| `JOB-PURGE-PII-ON-DELETED-TENANT` | tenant deleted | `privacy` | Scheduled (30 days grace then delete) |

---

## 20. UI/UX flows

### FLOW-SEC-001: Customer signup → passkey enrollment

```
[storefront/signup]
   - email field
        ↓
[Submit → /auth/signup]
   - Email verification sent
        ↓
[customer clicks link in email]
   - lands on /auth/verify-email?token=...
   - Token consumed; user verified
        ↓
[Browser prompts WebAuthn registration]
   - "Save passkey on this device?"
   - Touch ID / Face ID / Windows Hello / hardware key
        ↓
[Passkey registered → user logged in]
   - Account complete
   - Optional: prompt to add password (fallback)
   - Optional: prompt to add MFA (recovery codes)
```

If passkey unavailable / declined:
```
[Browser → "Set password instead?"]
   - Form: password (with strength meter, HIBP check via JS)
   - Submit
   - Account created with password
   - Strongly recommend MFA enrollment
```

### FLOW-SEC-002: Admin login with MFA

```
[/admin/login → email + password]
   - Credentials verified
        ↓
[If MFA enabled]
   - MFA challenge UI
   - Options: TOTP code / WebAuthn second factor / Recovery code
        ↓
[code entered → /auth/mfa:verify]
   - Verified → session issued (assurance_level='mfa_verified')
        ↓
[Redirect to /admin (or last requested route)]
```

### FLOW-SEC-003: Step-up MFA for high-value refund

```
[Admin processing refund > 5000 CZK]
        ↓
[Click "Refund" button]
   - Backend: session.assurance_level != 'step_up' → require step-up
        ↓
[Modal: "This action requires verification"]
   - MFA prompt
        ↓
[User completes MFA]
   - session.assurance_level='step_up'
   - Refund processed
   - Audit log entry
```

### FLOW-SEC-004: Add second passkey + revoke old

```
[Admin → /settings/security/passkeys]
   - List: "MacBook Pro Touch ID (used 2 hours ago)" + "iPhone Face ID (used 3 days ago)"
   - "Add new passkey" button
        ↓
[Click → WebAuthn registration with new device]
   - Sign with current passkey (proof of identity)
   - Register new
        ↓
[List now shows 3 passkeys]
   - User decides to revoke old (lost USB key)
   - Click trash icon next to passkey
   - Confirmation modal
   - Revoked → log entry + email confirmation
```

### FLOW-SEC-005: Security event triage (admin)

```
[Notification: "Suspicious login from new country"]
        ↓
[/security/events → event detail]
   - IP: 203.0.113.45 (Czech Republic)
   - User: admin@acme.com
   - Time: 2026-05-20 16:32 UTC
   - Previous login from CZ; this from US
   - Distance: 7000 km in 2 hours = impossible travel
   - Auto-step-up MFA triggered + required
   - Status: open
        ↓
[Investigator reviews]
   - User confirms it was a VPN (legitimate)
   - Mark false_positive
        ↓
[Audit log + event resolved]
   - Whitelist VPN IP? (offered)
```

### FLOW-SEC-006: GDPR data subject erasure (customer)

```
[Customer logs in to storefront]
        ↓
[/account/privacy → "Delete my account and data"]
   - Warning text + checkbox confirmations
   - Reason (optional)
   - "Verify my identity" (MFA prompt)
        ↓
[Submit → erasure request created]
   - Audit log
   - Email confirmation
        ↓
[Background: JOB-PROCESS-ERASURE-REQUEST]
   - Anonymize customer record (pseudonym)
   - Forward to integrations (Mailchimp etc.) via integration.customer_erasure_requested webhook (per `29`)
   - Audit log of erasure complete
        ↓
[Customer notified: "Erasure complete; some data retained per legal obligation (orders, invoices) per regulation"]
```

### FLOW-SEC-007: Incident response — suspected exfiltration

```
[Anomaly detected: bulk customer export via integration API]
   - EVENT-SEC-EXFILTRATION-PATTERN
   - SecurityEvent severity=critical, status=open
        ↓
[On-call paged via PagerDuty]
   - Acknowledges within 5 min
        ↓
[Investigation kicks off]
   - IC assigned
   - Slack incident channel #inc-2026-00000123
   - Affected app installation suspended (revoke tokens)
        ↓
[Determine scope]
   - 4200 customer records accessed
   - Confirm exfil (yes/no)
        ↓
[If confirmed]
   - SecurityIncident created (sev1)
   - gdpr_72h_deadline_at = now + 72h
   - Legal involved
   - Customers identified
        ↓
[Within 24h]
   - Notification to ÚOOÚ drafted
   - Customer notification drafted
   - Post deploy fix
        ↓
[Within 72h]
   - ÚOOÚ notified
   - Affected customers notified
        ↓
[Post-incident]
   - Post-mortem within 5 business days
   - Root cause + improvements
   - Public summary on trust center
```

### FLOW-SEC-008: Bug bounty submission

```
[Researcher visits shopio.com/security/report]
   - Form: title, description, affected_endpoint, repro steps, expected impact
   - Optional: PGP-signed attachment
        ↓
[Submit → BugBountySubmission created]
   - Auto-ack email to researcher
   - Triager assigned (round-robin)
        ↓
[Triage within 7 days]
   - Reproduce
   - Validate severity
   - Accept / dispute / dup / out-of-scope
        ↓
[If accepted]
   - Bounty amount decided per severity matrix
   - Fix tracked in private repo (sec-*)
   - Coordinated disclosure
        ↓
[Fix deployed → CVE assigned (if applicable) → advisory published → bounty paid]
```

---

## 21. Performance, testing

### 21.1 Performance targets

| Operation | p50 | p95 | p99 |
|---|---|---|---|
| Password login (argon2id) | 250 ms | 400 ms | 600 ms |
| Passkey login (WebAuthn verify) | 50 ms | 150 ms | 300 ms |
| Session refresh | 20 ms | 80 ms | 200 ms |
| Permission check (cached) | < 1 ms | 3 ms | 10 ms |
| Permission check (cold from DB) | 5 ms | 20 ms | 50 ms |
| Audit log write | 5 ms | 20 ms | 50 ms |
| KMS DEK unwrap | 10 ms | 50 ms | 150 ms |
| Audit log query (filtered, 100 rows) | 30 ms | 150 ms | 400 ms |
| Audit hash chain verify (10k entries) | 500 ms | 2000 ms | 5000 ms |
| Fraud score compute | 100 ms | 400 ms | 1000 ms |
| WebAuthn challenge issuance | 20 ms | 80 ms | 200 ms |
| Login rate limit check | < 5 ms | 15 ms | 40 ms |

### 21.2 Scaling

- 1M concurrent sessions
- 10k logins/min peak
- 100M audit log entries / month per region
- 1k KMS ops/sec sustained
- Security events ingest 10k/min

### 21.3 Testing

#### 21.3.1 Unit

```
TEST-UNIT-SEC-001  argon2id hash + verify
TEST-UNIT-SEC-002  HIBP k-anonymity check
TEST-UNIT-SEC-003  WebAuthn attestation parser
TEST-UNIT-SEC-004  TOTP RFC 6238 verify with skew
TEST-UNIT-SEC-005  JWT signing + verification
TEST-UNIT-SEC-006  Refresh token family tracker
TEST-UNIT-SEC-007  Permission check (RBAC) — basic + ABAC policies
TEST-UNIT-SEC-008  Hash chain entry builder
TEST-UNIT-SEC-009  Merkle tree builder for batch signing
TEST-UNIT-SEC-010  Envelope encryption (AES-GCM with AAD)
TEST-UNIT-SEC-011  CSRF double-submit verifier
TEST-UNIT-SEC-012  Rate limiter (token bucket)
TEST-UNIT-SEC-013  Fraud score combinator
TEST-UNIT-SEC-014  SSRF allowlist resolver
TEST-UNIT-SEC-015  Egress proxy URL parser
```

#### 21.3.2 Integration

```
TEST-INT-SEC-001  Full password login + session issuance
TEST-INT-SEC-002  Full passkey login flow
TEST-INT-SEC-003  TOTP enrollment + login MFA
TEST-INT-SEC-004  WebAuthn second factor
TEST-INT-SEC-005  Refresh token rotation + theft detection
TEST-INT-SEC-006  Step-up MFA for high-value op
TEST-INT-SEC-007  Audit log entry written for every action category
TEST-INT-SEC-008  Audit hash chain integrity after 1000 entries
TEST-INT-SEC-009  KMS envelope encrypt + decrypt + AAD binding
TEST-INT-SEC-010  RLS prevents cross-tenant access
TEST-INT-SEC-011  Account lockout after threshold failures
TEST-INT-SEC-012  Impossible travel detection
TEST-INT-SEC-013  New device login notification
TEST-INT-SEC-014  Permission revocation propagates within 15 min (access token TTL)
TEST-INT-SEC-015  Fraud score blocks high-risk order
TEST-INT-SEC-016  CSRF token rejected on missing/mismatch
TEST-INT-SEC-017  SSRF blocked when calling private IP
TEST-INT-SEC-018  Erasure propagates to integrations
TEST-INT-SEC-019  GDPR 72h deadline countdown
TEST-INT-SEC-020  Tenant KEK destruction renders data unrecoverable
```

#### 21.3.3 E2E (Playwright)

```
TEST-E2E-SEC-001  Customer signup → passkey
TEST-E2E-SEC-002  Admin login → MFA → admin dashboard
TEST-E2E-SEC-003  Step-up MFA UX
TEST-E2E-SEC-004  Session revoke kicks out other tab
TEST-E2E-SEC-005  Password reset flow
TEST-E2E-SEC-006  Audit log viewer + verify integrity button
TEST-E2E-SEC-007  Bug bounty submission flow
TEST-E2E-SEC-008  DSAR + erasure flow customer-facing
```

#### 21.3.4 Security tests (offensive)

```
TEST-SEC-OFFENSIVE-001  SQL injection attempts (sqlmap profile)
TEST-SEC-OFFENSIVE-002  XSS attempts (DOMPurify boundary tests)
TEST-SEC-OFFENSIVE-003  CSRF attempts
TEST-SEC-OFFENSIVE-004  Token replay attacks
TEST-SEC-OFFENSIVE-005  PKCE downgrade
TEST-SEC-OFFENSIVE-006  SSRF via user-supplied URLs
TEST-SEC-OFFENSIVE-007  Mass assignment (extra fields in JSON ignored)
TEST-SEC-OFFENSIVE-008  IDOR — accessing other tenant's resources
TEST-SEC-OFFENSIVE-009  Permission bypass via API
TEST-SEC-OFFENSIVE-010  Rate limit bypass attempts
TEST-SEC-OFFENSIVE-011  Header injection
TEST-SEC-OFFENSIVE-012  Open redirect
TEST-SEC-OFFENSIVE-013  XXE in file uploads
TEST-SEC-OFFENSIVE-014  Zip-bomb in uploads
TEST-SEC-OFFENSIVE-015  Server-Side Template Injection
TEST-SEC-OFFENSIVE-016  Brute force lockout enforcement
TEST-SEC-OFFENSIVE-017  Session fixation
TEST-SEC-OFFENSIVE-018  Cookie attributes (HttpOnly, Secure, SameSite)
TEST-SEC-OFFENSIVE-019  CORS misconfig
TEST-SEC-OFFENSIVE-020  Plugin escape attempts (per `28 §16`)
```

#### 21.3.5 Compliance tests

```
TEST-COMPLY-SEC-001  GDPR DSAR fulfilled within 30 days
TEST-COMPLY-SEC-002  Erasure removes all PII references
TEST-COMPLY-SEC-003  Audit log retention enforced
TEST-COMPLY-SEC-004  PCI scope verified (no card data in our infra)
TEST-COMPLY-SEC-005  EU data residency enforced
TEST-COMPLY-SEC-006  Sub-processor list published
TEST-COMPLY-SEC-007  Cookie consent enforced (no non-essential cookies pre-consent)
TEST-COMPLY-SEC-008  Breach notification template + workflow
```

---

## 22. Implementation checklist

### Auth core
- [ ] **[L]** `AuthService` — password (argon2id), passkey (WebAuthn), TOTP, recovery codes, session
- [ ] **[M]** HIBP integration (k-anonymity)
- [ ] **[L]** WebAuthn relying party implementation (Level 3)
- [ ] **[M]** TOTP enroll + verify (RFC 6238)
- [ ] **[M]** Recovery codes generator + verifier (hashed)
- [ ] **[L]** Session model + refresh family rotation + theft detection
- [ ] **[M]** Anomaly detection (geo, device fingerprint, ASN change)
- [ ] **[M]** New device notification
- [ ] **[M]** Account lockout backoff
- [ ] **[L]** SSO (SAML + OIDC) — Fáze 2
- [ ] **[M]** SCIM provisioning — Fáze 2
- [ ] **[S]** REST + GraphQL endpoints per §16, §17

### Authorization core
- [ ] **[M]** Permission catalog implementation (with `36`)
- [ ] **[M]** Persona → permission resolution
- [ ] **[M]** Permission check middleware (REST + GraphQL + tRPC)
- [ ] **[M]** ABAC policy engine
- [ ] **[L]** RLS policies on all tenant-scoped tables
- [ ] **[S]** Permission cache invalidation (SSE on change)
- [ ] **[M]** Just-in-time access flow (Fáze 2)
- [ ] **[M]** Custom roles (Fáze 2)

### KMS + secrets
- [ ] **[L]** KMS provider abstraction (AWS/GCP/Vault/local)
- [ ] **[L]** Envelope encryption helpers (encrypt/decrypt with AAD)
- [ ] **[M]** Per-tenant KEK provisioning on tenant creation
- [ ] **[M]** Key rotation jobs (JWT monthly, audit quarterly, KEK yearly)
- [ ] **[M]** Pepper for password hashes
- [ ] **[M]** Secret scanning in CI (gitleaks)
- [ ] **[S]** KMS access audit hook

### Audit logging
- [ ] **[L]** `AuditLogger` library with category-typed actions
- [ ] **[M]** Hash chain implementation
- [ ] **[L]** Periodic batch signer job (merkle + ed25519)
- [ ] **[M]** Immutable archive to S3 Glacier Deep Archive
- [ ] **[M]** Integrity verifier job + manual button
- [ ] **[M]** Audit log viewer UI + filters
- [ ] **[S]** CSV export
- [ ] **[M]** Auto-redact sensitive values per category

### Security events + incidents
- [ ] **[M]** `SecurityEventEmitter` library — all detectors emit
- [ ] **[M]** Anomaly detectors:
  - [ ] Impossible travel
  - [ ] New device
  - [ ] Suspicious browser fingerprint
  - [ ] Bot patterns
  - [ ] Token replay
  - [ ] Privilege escalation attempts
- [ ] **[M]** SecurityEvent triage UI (admin + platform)
- [ ] **[L]** SecurityIncident management UI
- [ ] **[M]** Post-mortem template + publishing
- [ ] **[M]** GDPR 72h deadline tracker + alerts
- [ ] **[S]** PagerDuty / OpsGenie integration (per `31`)

### Fraud detection
- [ ] **[L]** FraudScorer service (ML pipeline)
- [ ] **[M]** Signal collectors (IP rep, velocity, device, email age)
- [ ] **[M]** Fraud queue UI + actions
- [ ] **[M]** Allowlist / denylist management
- [ ] **[L]** Model training pipeline + retraining (Fáze 2)
- [ ] **[S]** Per-tenant threshold config

### Network + WAF
- [ ] **[M]** Cloudflare WAF + Turnstile + rate limit configuration
- [ ] **[M]** Egress proxy + SSRF allowlist
- [ ] **[M]** Security headers middleware
- [ ] **[M]** CSRF middleware
- [ ] **[M]** Bot management config
- [ ] **[S]** TLS cert auto-renewal (Let's Encrypt + ACM)
- [ ] **[S]** mTLS internal services (Fáze 2)

### Vulnerability management
- [ ] **[M]** Dependency scanning in CI (Snyk + npm audit + Dependabot)
- [ ] **[M]** SAST in CI (Semgrep + CodeQL)
- [ ] **[M]** Container scanning (Trivy)
- [ ] **[M]** DAST scheduled (ZAP against staging)
- [ ] **[M]** Image signing (cosign) + verification at deploy
- [ ] **[S]** SBOM generation
- [ ] **[M]** Vulnerability tracker + SLA enforcement
- [ ] **[S]** Public advisory page + RSS feed

### Bug bounty
- [ ] **[M]** Submission form (public)
- [ ] **[M]** Triage workflow
- [ ] **[S]** Bounty payout integration (PayPal/Stripe Connect)
- [ ] **[S]** Researcher communications portal

### Compliance
- [ ] **[L]** GDPR DPIA template + completion process
- [ ] **[L]** Records of Processing Activities (RoPA) — automated where possible
- [ ] **[M]** DSAR workflow (per `18`)
- [ ] **[M]** Erasure orchestration + integration forward (per `29`)
- [ ] **[M]** Sub-processor list (public)
- [ ] **[M]** DPA template
- [ ] **[M]** Trust center page
- [ ] **[L]** ISO 27001 readiness — policies, procedures, controls (Fáze 2)
- [ ] **[L]** SOC 2 readiness (Fáze 2)
- [ ] **[L]** Compliance evidence collection automation
- [ ] **[M]** Annual pen test scheduling + finding tracking

### Incident response
- [ ] **[M]** Runbook authoring (initial 10 runbooks)
- [ ] **[M]** On-call rotation (PagerDuty)
- [ ] **[M]** Incident channel automation (Slack)
- [ ] **[S]** Comm templates approved by legal
- [ ] **[S]** Tabletop exercise schedule + facilitator notes

### Background jobs
- [ ] **[M]** Per §19 — many small jobs; reuse BullMQ infrastructure

### Tests
- [ ] **[L]** Per §21 — extensive offensive + compliance tests in CI

### Docs
- [ ] **[M]** Internal security playbook
- [ ] **[M]** "Security best practices" for customers (passkey, MFA, IP allowlist)
- [ ] **[M]** Developer security guide
- [ ] **[M]** Incident response procedures (private)
- [ ] **[M]** Bug bounty program docs
- [ ] **[M]** GDPR compliance guide for merchants
- [ ] **[M]** Trust center content (public)

---

## 23. Open questions

### Q-SEC-001: SOC 2 Type II scope
**Otázka:** Plánovaný Year 2 (per `01-DEC-COMPLIANCE-*`); zahrnout všechny TSC nebo jen Security + Availability MVP?

**Status:** Security + Availability + Confidentiality MVP. Privacy + Processing Integrity přidat Year 3 podle B2B customer demand. Záznam do `01`.

### Q-SEC-002: SSO provider — Fáze 2 priorita
**Otázka:** Které IdP integrace první? Microsoft Entra (Azure AD) vs Okta vs Google Workspace?

**Status:** Microsoft Entra ID první (EU enterprise demand), pak Okta. Google Workspace via OIDC z velké části zdarma. SAML + OIDC abstrakce supportuje vše.

### Q-SEC-003: AI-generated content & DLP
**Otázka:** AI Copilot může neúmyslně exposed sensitive data v generovaném textu (např. customer PII v product descriptions). DLP detector?

**Status:** Fáze 2+ feature. Per `33-ai-features.md`. Output scanning před commit.

### Q-SEC-004: Hardware token requirement
**Otázka:** Pro nejvyšší privilegia (platform staff prod access) — vyžadovat FIDO2 hardware key, ne jen passkey?

**Status:** Yes; platform staff prod access vyžaduje YubiKey nebo Titan key. Passkey OK pro tenant admins.

### Q-SEC-005: Public verification key publishing
**Otázka:** Pro audit log signed batches — publikovat verifier key na trust center?

**Status:** Yes. ed25519 public verifier key + key history + rotation announcement. Customers můžou nezávisle ověřit.

### Q-SEC-006: Per-feature MFA enforcement
**Otázka:** Step-up je per operation, ale měl by být per-feature configurable tenantem? (e.g., "vždy MFA při exportu zákazníků")

**Status:** Fáze 2 — granularní per-action MFA požadavek per tenant config. MVP: pevný seznam high-value actions.

### Q-SEC-007: AI agent attestation
**Otázka:** Můžeme verifikovat, že agent connecting je skutečně Claude (signed assertion od Anthropic)?

**Status:** Out of scope MVP. Token-based trust. Fáze 3+ when MCP spec evolves.

### Q-SEC-008: Quantum-resistant cryptography
**Otázka:** Plánovat migrate na post-quantum algorithms (CRYSTALS-Kyber, Dilithium)?

**Status:** Sledovat NIST standardizaci. Plán: hybrid (current + PQ) po finalizaci standardů, ~Year 2-3.

### Q-SEC-009: Compliance for sector-specific tenants
**Otázka:** Healthcare merchanti = HIPAA-light? Financial = DORA?

**Status:** Out of scope MVP. Pokud customer demand → BAA / financial DPA case-by-case.

### Q-SEC-010: Bug bounty program tier
**Otázka:** Self-hosted (custom platform), Intigriti (EU), HackerOne (US-based ale globální).

**Status:** Intigriti preferred (EU-based, GDPR-friendly). HackerOne consider pokud volume vyžaduje.

### Q-SEC-011: Insider risk monitoring
**Otázka:** Engineer-level monitoring pro detect insider threat (USB exfil, suspicious DB query patterns)?

**Status:** Fáze 2+ — endpoint security on engineering workstations, query pattern anomaly detection. MVP: trust + audit + JIT access.

### Q-SEC-012: Privacy Sandbox for storefronts
**Otázka:** Migrace z third-party cookies na Privacy Sandbox APIs (Topics, FedCM, Trust Tokens)?

**Status:** Fáze 3+. Sledovat Chrome rollout. Server-side tracking (per `19-marketing-seo.md`, `29 §14.7`) je primární cesta nezávisle.

### Q-SEC-013: Customer-managed encryption keys (BYOK)
**Otázka:** Enterprise tenants přinést vlastní KMS keys (HYOK / Hold Your Own Key)?

**Status:** Fáze 3+ enterprise tier. Současně podporujeme provider abstrakce (AWS KMS / Azure / GCP / Vault) což pokrývá většinu.

### Q-SEC-014: Zero-knowledge / E2E encryption
**Otázka:** Customer PII end-to-end encrypted s key držený customerem (server nikdy nevidí)?

**Status:** Out of scope. Konfliktní s operational requirements (search, indexing, ML). Pro vysokou citlivost: oddělené E2E komponenty (per-tenant secure messaging Fáze 5+).

### Q-SEC-015: Behavioral biometrics
**Otázka:** Typing rhythm, mouse movement as additional auth factor?

**Status:** Fáze 3+ experiment. ML model + opt-in. Privacy-sensitive (per GDPR).

---

## 📅 Změny

| Datum | Změna |
|---|---|
| 2026-05-20 | Initial — Security domain baseline. Passkey-first auth, RBAC + ABAC + RLS, KMS envelope encryption, hash-chained audit log, fraud detection, multi-layer rate limiting, incident response framework, GDPR + PCI SAQ A compliance + ISO 27001/SOC 2 roadmap, NIS2 assessment, 50 business rules, 32 events, 32 background jobs. |

---

**Konec Security.**

➡️ Pokračovat na: [`31-operations.md`](31-operations.md)
