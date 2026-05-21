# 36 – PERSONAS & RBAC

> **Doména:** Kompletní katalog persona definicí (zákazník, merchant tiers, B2B role, marketplace seller, platform staff, agency, AI agent) + permission catalog (~200 permissions napříč doménami) + persona→permission mapping + custom roles (Fáze 2) + ABAC policy reference (per `30 §5.5`) + scopes per token kind (per `28`) + RLS policies + multi-tenant permissions (agency mode) + just-in-time access + permission audit + migration patterns.

**Datum:** 2026-05-20
**Verze:** 1.0
**Status:** 🟡 DESIGN
**Reference:** [30-security.md §5](30-security.md#5-authorization) · [28-developer-platform.md §4.4](28-developer-platform.md#44-oauth-scopes-catalog) · [18-customer-management.md](18-customer-management.md) · [21-b2b-complete.md](21-b2b-complete.md) · [25-marketplace.md](25-marketplace.md)

---

## 📑 Obsah

0. [Domain overview](#0-domain-overview)
1. [References](#1-references)
2. [Persona taxonomy](#2-persona-taxonomy)
3. [Personas — detailed catalog](#3-personas--detailed-catalog)
4. [Permission catalog](#4-permission-catalog)
5. [Persona → permission mappings](#5-persona--permission-mappings)
6. [Custom roles](#6-custom-roles)
7. [ABAC policies](#7-abac-policies)
8. [Scopes for tokens + agents](#8-scopes-for-tokens--agents)
9. [Multi-tenant + agency mode](#9-multi-tenant--agency-mode)
10. [Just-in-time access](#10-just-in-time-access)
11. [RLS policies](#11-rls-policies)
12. [Data models](#12-data-models)
13. [Business rules](#13-business-rules)
14. [REST API endpoints](#14-rest-api-endpoints)
15. [GraphQL schema](#15-graphql-schema)
16. [Events](#16-events)
17. [Background jobs](#17-background-jobs)
18. [Testing](#18-testing)
19. [Implementation checklist](#19-implementation-checklist)
20. [Open questions](#20-open-questions)

---

## 0. Domain overview

### 0.1 Co tato doména **je**

- **Single source of truth** pro persony + permissions napříč platformou
- **Persona = bundle of permissions** + intended user profile + UI tailored experience
- **Permission = atomic capability** `PERM-{RESOURCE}-{ACTION}` (cca 200 z toho ~150 v MVP)
- **Two assignment models**: persona-based (rychlé, většina tenants) + custom role-based (Fáze 2, granular per-tenant)
- **ABAC layer** nad RBAC pro context-aware policies (per `30 §5.5`)
- **Multi-tenant agency mode** — single user může mít přístup k více tenantům s různými permissions
- **Token scopes** — PAT / service accounts / OAuth tokens / agents (per `28`) mají scoped subset of user's permissions
- **RLS policies** v Postgres pro hardware tenant isolation
- **Just-in-time access** pro platform staff (audit trail, time-bound)
- **Permission migration** — when persona definitions evolve, existing users get updated permissions deterministically
- **Audit-first** — every permission check + permission change logged (per `30 §8`)

### 0.2 Co tato doména **NENÍ**

- ❌ Authentication implementation (→ `30 §4`); tato doc dává čistě autorizaci
- ❌ Session management (→ `30 §4.6`)
- ❌ Specific UI rendering of permission-gated elements (→ `27 §RULE-ADM-003`)
- ❌ Customer auth/passkey (→ `18-customer-management.md`)
- ❌ MCP agent auth flow (→ `28 §4.3`)
- ❌ Per-domain business logic enforcing permissions (každý doc v `06`-`34` v §16 lists own permissions)
- ❌ Compliance certifications (→ `30 §14`)
- ❌ Fraud prevention (→ `30 §11`)
- ❌ KYC for marketplace sellers (→ `25 §4.2`)

### 0.3 Diferenciátory

1. **Comprehensive catalog Day 1** — žádné "ad-hoc permission strings"; každá kontrola má registered permission code
2. **Persona-first UX** — merchant zvolí persona type (Owner / Admin / Staff) a okamžitě dostane správné permissions; ne builder approach
3. **Composable + customizable** — persony jako default; custom roles jako power-user option
4. **ABAC integrated** — context-aware (refund > threshold → step-up; bulk > N → approval); nejen flat RBAC
5. **Agency mode native** — multi-tenant access first-class persona kind, nepřilepené dodatečně
6. **EU compliance** — separation of duties patterns (DPO, compliance officer) explicit
7. **AI agent first-class** — agent persony s vlastními scopes, ne "treated like API token"

---

## 1. References

- [30-security.md §5](30-security.md#5-authorization) — authorization model, RLS, ABAC
- [28-developer-platform.md §4.4](28-developer-platform.md#44-oauth-scopes-catalog) — token scopes
- [18-customer-management.md](18-customer-management.md) — customer profiles + B2B company members
- [21-b2b-complete.md](21-b2b-complete.md) — B2B roles + approval workflows
- [25-marketplace.md §2](25-marketplace.md#2-personas) — marketplace seller personas
- [27-admin-backoffice.md §2](27-admin-backoffice.md#2-personas) — admin personas
- [33-ai-features.md §2](33-ai-features.md#2-personas) — AI agent persona
- Each domain doc §16 — domain-specific permissions list
- OWASP Authorization Cheat Sheet
- NIST SP 800-162 (ABAC guide)
- OWASP API Top 10 — Broken Object Level Authorization

---

## 2. Persona taxonomy

### 2.1 Surface dimension

Persony rozdělené po surface (kde user vystupuje):

| Surface | Personas |
|---|---|
| **Storefront** (customer-facing) | Customer (anonymous, registered), B2B Buyer, AI Customer Agent |
| **Admin** (tenant admin app) | Owner, Admin, Staff, Domain specialists (Warehouse, CSM, Marketing, Accountant, Developer, Security, Compliance, DPO) |
| **Partner dashboard** (partners.shopio.com) | App developer, App publisher, Theme developer |
| **Platform** (Shopio internal) | Platform staff (Operations, Security, Support, Sales, Finance, Compliance) |
| **Agency** (cross-tenant) | Agency admin, Agency staff |
| **Marketplace** (multi-vendor) | Seller owner, Seller staff, Seller finance |
| **MCP / API** | Personal access user, Service account, OAuth app, AI agent |

### 2.2 Persona naming convention

`PERSONA-{SURFACE}-{ROLE}` where appropriate; or just `PERSONA-{ROLE}` pro běžné. Per `00-MASTER-INDEX.md §1.3` ID systém.

### 2.3 Persona hierarchy

```
PLATFORM-STAFF
  ├─ PLATFORM-ENGINEERING-*
  ├─ PLATFORM-OPS-*
  ├─ PLATFORM-SECURITY
  ├─ PLATFORM-SUPPORT
  ├─ PLATFORM-COMPLIANCE-OFFICER
  ├─ PLATFORM-DPO
  └─ PLATFORM-SALES / FINANCE / etc.

TENANT (a.k.a. MERCHANT) personas:
  MERCHANT-OWNER (root)
    ├─ MERCHANT-ADMIN (most permissions, no billing)
    │    ├─ MERCHANT-STAFF (operations, no settings)
    │    ├─ MERCHANT-WAREHOUSE-STAFF (inventory + fulfillment)
    │    ├─ MERCHANT-CUSTOMER-SERVICE (orders + customers + returns)
    │    ├─ MERCHANT-MARKETING-MANAGER (marketing + content + themes)
    │    ├─ MERCHANT-ACCOUNTANT (finance read + reports + exports)
    │    ├─ MERCHANT-DEVELOPER (developer platform)
    │    ├─ MERCHANT-SECURITY-OFFICER (security + audit log)
    │    └─ MERCHANT-COMPLIANCE (compliance dashboard)
    └─ (custom roles — Fáze 2)

CUSTOMER personas:
  CUSTOMER-ANONYMOUS (storefront browse)
  CUSTOMER-REGISTERED (logged-in)
  CUSTOMER-B2B-COMPANY-OWNER (B2B per `21`)
    ├─ CUSTOMER-B2B-COMPANY-ADMIN
    │    ├─ CUSTOMER-B2B-PURCHASER
    │    ├─ CUSTOMER-B2B-APPROVER (multi-buyer approval)
    │    └─ CUSTOMER-B2B-VIEWER (read-only)

MARKETPLACE personas:
  MARKETPLACE-OPERATOR (= MERCHANT-OWNER of marketplace tenant)
    ├─ MARKETPLACE-CATEGORY-MANAGER
    ├─ MARKETPLACE-DISPUTE-MEDIATOR
    └─ MARKETPLACE-COMPLIANCE-OFFICER

  SELLER-OWNER (third-party seller)
    ├─ SELLER-ADMIN
    ├─ SELLER-STAFF
    ├─ SELLER-FINANCE
    ├─ SELLER-SUPPORT
    └─ SELLER-VIEWER

DEVELOPER personas:
  APP-PUBLISHER (partners.shopio.com)
  APP-DEVELOPER (working under publisher)
  THEME-DEVELOPER

AGENCY personas:
  AGENCY-ADMIN (multi-tenant root)
  AGENCY-STAFF (multi-tenant operational)

AI / AGENT personas:
  AI-COPILOT (in-platform AI; bound by tenant scope)
  AI-AGENT-EXTERNAL (MCP-connected; bound by OAuth scopes)
  AI-AGENT-WORKFLOW (internal background jobs)

NON-USER personas (referenced):
  WEBHOOK-CONSUMER (no auth; verified via HMAC)
  EXTERNAL-INTEGRATION (per `29`)
```

---

## 3. Personas — detailed catalog

### 3.1 Platform staff personas

#### `PERSONA-PLATFORM-STAFF` (umbrella; not directly assigned)

Base for all internal Shopio staff. Includes `PERM-PLATFORM-LOGIN`.

#### `PERSONA-PLATFORM-SRE`
On-call infrastructure, incident response, capacity, deploys. Per `31 §2`.
- `PERM-OPS-*`, `PERM-PLATFORM-PRODUCTION-ACCESS`
- Just-in-time elevated access (per `10`)

#### `PERSONA-PLATFORM-DEVOPS-ENGINEER`
Infra-as-code, pipeline, observability config.
- `PERM-OPS-INFRA-MANAGE`, `PERM-OPS-PIPELINE-MANAGE`, `PERM-OPS-OBSERVABILITY-MANAGE`

#### `PERSONA-PLATFORM-RELEASE-MANAGER`
Coordinates releases, rollbacks, feature flags.
- `PERM-OPS-RELEASE-MANAGE`, `PERM-OPS-FEATURE-FLAGS-MANAGE`

#### `PERSONA-PLATFORM-SECURITY`
Security ops, incident response, vulnerability triage.
- `PERM-PLATFORM-SECURITY-*`, `PERM-AUDIT-LOG-VIEW-CROSS-TENANT` (with JIT)

#### `PERSONA-PLATFORM-COMPLIANCE-OFFICER`
ISO 27001 / SOC 2 / GDPR compliance program.
- `PERM-PLATFORM-COMPLIANCE-*`

#### `PERSONA-PLATFORM-DPO` (Data Protection Officer)
GDPR mandate; oversees personal data processing.
- `PERM-PLATFORM-DPO-*` (special category data access via JIT)

#### `PERSONA-PLATFORM-SUPPORT`
Customer support — reads service health, helps tenants (with consent for tenant data access).
- `PERM-OPS-OBSERVABILITY-VIEW`, `PERM-OPS-RUNBOOK-VIEW`, `PERM-PLATFORM-SUPPORT`
- Tenant data access via JIT impersonation (per `10` + `30 §5.7`)

#### `PERSONA-PLATFORM-SALES` / `PERSONA-PLATFORM-FINANCE` / `PERSONA-PLATFORM-MARKETING`
Internal business roles; limited or no access to tenant production data.

#### `PERSONA-PLATFORM-DATA-ENGINEER`
DB migrations, performance, backups.
- `PERM-OPS-DB-MANAGE`, scoped DB access

#### `PERSONA-PLATFORM-FINOPS`
Cost monitoring, budget enforcement.
- `PERM-OPS-COSTS-VIEW`, `PERM-OPS-BUDGETS-MANAGE`

#### `PERSONA-PLATFORM-APP-REVIEWER`
Reviews apps in marketplace (per `28 §RULE-DEV-021`).
- `PERM-PLATFORM-APP-REVIEW`

#### `PERSONA-PLATFORM-MARKETPLACE-STAFF`
Reviews seller applications, mediates disputes.
- `PERM-PLATFORM-MARKETPLACE-APPROVE`, `PERM-MARKETPLACE-DISPUTE-MANAGE` (cross-tenant via JIT)

#### `PERSONA-PLATFORM-AI-OPS`
Monitor AI quality + cost, tune prompts.
- `PERM-PLATFORM-AI-OPS`

### 3.2 Merchant (tenant) personas

#### `PERSONA-MERCHANT-OWNER`
Tenant root. Created at signup. Full access including billing + team management. Solo founders default to this.
- All `PERM-*` except `PERM-PLATFORM-*`
- Cannot revoke own owner role (transfer required)

#### `PERSONA-MERCHANT-ADMIN`
Most permissions except billing + ownership transfer.
- All `PERM-*` except `PERM-MERCHANT-BILLING-*`, `PERM-MERCHANT-OWNER-TRANSFER`

#### `PERSONA-MERCHANT-STAFF`
General staff. Operations-focused.
- `PERM-ORDER-*`, `PERM-CUSTOMER-*` (excluding delete), `PERM-PRODUCT-VIEW`, `PERM-PRODUCT-EDIT`, `PERM-INVENTORY-VIEW`
- No settings access, no billing, no security audit

#### `PERSONA-MERCHANT-WAREHOUSE-STAFF`
Inventory + fulfillment focused.
- `PERM-INVENTORY-*`, `PERM-FULFILLMENT-*`, `PERM-ORDER-FULFILL`, `PERM-PRODUCT-VIEW`
- No pricing, no customer PII beyond shipping address

#### `PERSONA-MERCHANT-CUSTOMER-SERVICE`
Orders + customers + returns + reviews.
- `PERM-ORDER-*`, `PERM-CUSTOMER-*` (including edit), `PERM-RETURN-*`, `PERM-REVIEW-MODERATE`
- No catalog editing, no settings

#### `PERSONA-MERCHANT-MARKETING-MANAGER`
Marketing + content + themes + analytics view.
- `PERM-MARKETING-*`, `PERM-CMS-*` (cross-ref `32`), `PERM-THEME-*` (cross-ref `26`), `PERM-ANALYTICS-VIEW`, `PERM-INTEGRATION-MARKETING-MANAGE`
- No order operations, no customer PII export

#### `PERSONA-MERCHANT-ACCOUNTANT`
Finance read + reports + exports.
- `PERM-FINANCE-VIEW`, `PERM-REPORT-*`, `PERM-INVOICE-VIEW`, `PERM-INVOICE-EXPORT`, `PERM-INTEGRATION-ACCOUNTING-MANAGE`, `PERM-CUSTOMER-VIEW`
- Read-mostly; modify only accounting-relevant

#### `PERSONA-MERCHANT-DEVELOPER`
API tokens, webhooks, edge functions, plugins.
- `PERM-DEVELOPER-*`, `PERM-INTEGRATION-DEBUG`
- No business operations

#### `PERSONA-MERCHANT-SECURITY-OFFICER`
Security settings + audit log + incident.
- `PERM-SECURITY-*`, `PERM-AUDIT-LOG-VIEW`, `PERM-INCIDENT-MANAGE`
- Often combined with Owner / Admin

#### `PERSONA-MERCHANT-COMPLIANCE`
Compliance dashboard + regulatory checklists.
- `PERM-COMPLIANCE-*`, `PERM-INDUSTRY-PROFILE-VIEW` (cross-ref `34`)

#### `PERSONA-MERCHANT-CONTENT-EDITOR`
Subset of marketing — content only.
- `PERM-CMS-EDIT`, `PERM-CMS-PUBLISH` (own resources via ABAC)

### 3.3 Customer personas

#### `PERSONA-CUSTOMER-ANONYMOUS`
Browses storefront without account.
- Storefront read scope only

#### `PERSONA-CUSTOMER-REGISTERED`
Logged-in customer.
- Self-only data access; orders/wishlist/account scoped to own customer_id

#### `PERSONA-CUSTOMER-B2B-COMPANY-OWNER`
Owner of B2B company account (per `21`).
- Company-scoped: manage members, see all orders, set credit terms

#### `PERSONA-CUSTOMER-B2B-COMPANY-ADMIN`
Company admin; can manage other members.

#### `PERSONA-CUSTOMER-B2B-PURCHASER`
Places orders for company.

#### `PERSONA-CUSTOMER-B2B-APPROVER`
Approves orders > threshold (per `21` approval workflows).

#### `PERSONA-CUSTOMER-B2B-VIEWER`
Read-only — sees catalog + own orders.

### 3.4 Marketplace personas

Per `25 §2`.

#### `PERSONA-MARKETPLACE-OPERATOR` (= tenant owner of marketplace mode)
Per `25 §0.1`.

#### `PERSONA-MARKETPLACE-CATEGORY-MANAGER`
Manages specific categories, vets seller listings.

#### `PERSONA-MARKETPLACE-DISPUTE-MEDIATOR`
Resolves buyer-seller disputes.

#### `PERSONA-MARKETPLACE-FINANCE-MANAGER`
Payouts, commission reports, settlement.

#### `PERSONA-MARKETPLACE-COMPLIANCE-OFFICER`
KYC review, regulatory audits, sanctions.

#### `PERSONA-SELLER-OWNER` (third-party vendor)
Seller's owner; full control of seller resources.

#### `PERSONA-SELLER-ADMIN` / `PERSONA-SELLER-STAFF` / `PERSONA-SELLER-FINANCE` / `PERSONA-SELLER-SUPPORT` / `PERSONA-SELLER-VIEWER`
Per `25 §3.2` seller_members roles.

### 3.5 Developer personas

#### `PERSONA-APP-PUBLISHER`
Owns app on partners.shopio.com.

#### `PERSONA-APP-DEVELOPER`
Works under publisher account (Fáze 2+ team accounts).

#### `PERSONA-THEME-DEVELOPER`
Builds themes for theme marketplace (per `26 §3.10`).

### 3.6 Agency personas

#### `PERSONA-AGENCY-ADMIN`
Multi-tenant access; manages tenants under agency.

#### `PERSONA-AGENCY-STAFF`
Multi-tenant operational; scoped per tenant per assignment.

### 3.7 AI / agent personas

#### `PERSONA-AI-COPILOT` (internal AI)
AI Copilot operating within tenant. Inherits permissions from user invoking but limited to "read + suggest"; write actions require user confirmation (per `30 §RULE-SEC-045`).

#### `PERSONA-AI-AGENT-EXTERNAL` (MCP-connected)
External agent (Claude Desktop, Cursor, ChatGPT Desktop) connected via MCP. Scoped via `agent:*` OAuth scopes (per `28 §4.4`).

#### `PERSONA-AI-AGENT-WORKFLOW` (internal background)
AI used inside background jobs (e.g., fraud scoring assist, content moderation). System-level scope; not tied to user.

### 3.8 Non-user personas

#### `PERSONA-WEBHOOK-CONSUMER`
External system receiving webhooks. No auth (verified via HMAC). No permission system — outbound only.

#### `PERSONA-EXTERNAL-INTEGRATION`
External system calling via OAuth app or API token. Scopes per token (per `28`).

---

## 4. Permission catalog

~200 permissions organized by domain. Format `PERM-{RESOURCE}-{ACTION}`. Action vocabulary:
- `VIEW` — read list / detail
- `CREATE` — new resource
- `EDIT` — update existing
- `DELETE` — remove / archive
- `PUBLISH` / `UNPUBLISH` — visibility lifecycle
- `MANAGE` — bundle (view + create + edit + delete, no publish)
- `*` (in tables) — wildcard for granular per-domain ops

### 4.1 Catalog (Catalog & PIM)

Per `06`.

```
PERM-PRODUCT-VIEW
PERM-PRODUCT-CREATE
PERM-PRODUCT-EDIT
PERM-PRODUCT-DELETE
PERM-PRODUCT-PUBLISH
PERM-PRODUCT-UNPUBLISH
PERM-PRODUCT-BULK-EDIT
PERM-PRODUCT-BULK-DELETE
PERM-PRODUCT-EXPORT
PERM-PRODUCT-IMPORT
PERM-PRODUCT-MEDIA-MANAGE
PERM-PRODUCT-VARIANT-MANAGE
PERM-CATEGORY-VIEW
PERM-CATEGORY-MANAGE
PERM-COLLECTION-VIEW
PERM-COLLECTION-MANAGE
PERM-BRAND-MANAGE
PERM-VENDOR-MANAGE
PERM-ATTRIBUTE-MANAGE
PERM-OPTION-TEMPLATE-MANAGE
PERM-METAFIELD-DEFINITION-MANAGE
```

### 4.2 Inventory + Fulfillment

Per `09`, `16`, `14`.

```
PERM-INVENTORY-VIEW
PERM-INVENTORY-ADJUST
PERM-INVENTORY-TRANSFER
PERM-INVENTORY-RECEIVE
PERM-INVENTORY-COUNT-MANAGE
PERM-WAREHOUSE-MANAGE
PERM-STOCK-MOVEMENT-VIEW
PERM-LOW-STOCK-ALERT-MANAGE
PERM-FULFILLMENT-VIEW
PERM-FULFILLMENT-CREATE
PERM-FULFILLMENT-CANCEL
PERM-SHIPPING-METHOD-MANAGE
PERM-SHIPPING-ZONE-MANAGE
PERM-SHIPPING-LABEL-PRINT
PERM-SHIPPING-CARRIER-CONFIG-MANAGE
PERM-PICKUP-POINT-MANAGE
```

### 4.3 Orders + Returns

Per `12`, `16`, `17`.

```
PERM-ORDER-VIEW
PERM-ORDER-VIEW-FULL-PII
PERM-ORDER-CREATE
PERM-ORDER-EDIT
PERM-ORDER-CANCEL
PERM-ORDER-FULFILL
PERM-ORDER-REFUND
PERM-ORDER-REFUND-HIGH-VALUE                                                                                                                                                                                                                  # > threshold; step-up MFA
PERM-ORDER-NOTE-ADD
PERM-ORDER-TAG-MANAGE
PERM-ORDER-BULK-EDIT
PERM-ORDER-EXPORT
PERM-DRAFT-ORDER-MANAGE
PERM-ABANDONED-CART-VIEW
PERM-RETURN-VIEW
PERM-RETURN-CREATE
PERM-RETURN-APPROVE
PERM-RETURN-REJECT
PERM-RETURN-PROCESS
PERM-RETURN-REFUND
PERM-RMA-MANAGE
```

### 4.4 Payments + Finance

Per `13`, `15`.

```
PERM-PAYMENT-VIEW
PERM-PAYMENT-CAPTURE
PERM-PAYMENT-VOID
PERM-PAYMENT-REFUND
PERM-PAYMENT-PROVIDER-CONFIG-MANAGE
PERM-PAYMENT-METHOD-MANAGE
PERM-INVOICE-VIEW
PERM-INVOICE-CREATE
PERM-INVOICE-CANCEL
PERM-INVOICE-EXPORT
PERM-FINANCE-VIEW
PERM-FINANCE-RECONCILE
PERM-TAX-CONFIG-MANAGE
PERM-TAX-REPORT-VIEW
PERM-TAX-REPORT-EXPORT
```

### 4.5 Customers + B2B

Per `18`, `21`.

```
PERM-CUSTOMER-VIEW
PERM-CUSTOMER-VIEW-FULL-PII                                                                                                                                                                                                                  # full PII view (vs masked)
PERM-CUSTOMER-CREATE
PERM-CUSTOMER-EDIT
PERM-CUSTOMER-DELETE                                                                                                                                                                                                                            # GDPR erasure trigger; restricted
PERM-CUSTOMER-EXPORT
PERM-CUSTOMER-MERGE
PERM-CUSTOMER-IMPERSONATE                                                                                                                                                                                                                       # admin views storefront as customer; audited
PERM-CUSTOMER-TAG-MANAGE
PERM-CUSTOMER-SEGMENT-MANAGE
PERM-CUSTOMER-NOTE-MANAGE
PERM-CUSTOMER-CONSENT-VIEW
PERM-CUSTOMER-CONSENT-OVERRIDE                                                                                                                                                                                                                    # rare; with audit
PERM-COMPANY-VIEW                                                                                                                                                                                                                                  # B2B company entities
PERM-COMPANY-CREATE
PERM-COMPANY-EDIT
PERM-COMPANY-MEMBER-MANAGE
PERM-COMPANY-CREDIT-MANAGE
PERM-COMPANY-CONTRACT-MANAGE
PERM-COMPANY-APPROVAL-WORKFLOW-MANAGE
PERM-QUOTE-VIEW
PERM-QUOTE-CREATE
PERM-QUOTE-EDIT
PERM-QUOTE-APPROVE
PERM-PURCHASE-ORDER-VIEW
PERM-PURCHASE-ORDER-MANAGE
```

### 4.6 Pricing + Promotions

Per `10`.

```
PERM-PRICE-LIST-MANAGE
PERM-PROMOTION-VIEW
PERM-PROMOTION-MANAGE
PERM-COUPON-MANAGE
PERM-GIFT-CARD-MANAGE
PERM-GIFT-CARD-ISSUE
PERM-DISCOUNT-RULE-MANAGE
```

### 4.7 Marketing + SEO

Per `19`.

```
PERM-MARKETING-CAMPAIGN-VIEW
PERM-MARKETING-CAMPAIGN-MANAGE
PERM-MARKETING-CAMPAIGN-SEND                                                                                                                                                                                                                                                                                  # final blast trigger
PERM-MARKETING-FLOW-MANAGE                                                                                                                                                                                                                                                                                          # automation
PERM-MARKETING-AUDIENCE-MANAGE
PERM-EMAIL-TEMPLATE-MANAGE
PERM-EMAIL-SEND-TRANSACTIONAL                                                                                                                                                                                                                                                                                          # one-off transactional via admin
PERM-SEO-EDIT
PERM-SEO-AUDIT-VIEW
PERM-REVIEW-VIEW
PERM-REVIEW-MODERATE
```

### 4.8 Analytics + Reports

Per `20`.

```
PERM-ANALYTICS-VIEW
PERM-ANALYTICS-EXPORT
PERM-REPORT-VIEW
PERM-REPORT-CUSTOM-CREATE
PERM-REPORT-SCHEDULE-MANAGE
PERM-DASHBOARD-CUSTOMIZE
PERM-COHORT-VIEW
PERM-RFM-VIEW
```

### 4.9 CMS + Content

Per `32`.

```
PERM-CMS-VIEW
PERM-CMS-EDIT
PERM-CMS-EDIT-OWN                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          # author limited to own
PERM-CMS-EDIT-HTML                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              # raw HTML block
PERM-CMS-DRAFT
PERM-CMS-PUBLISH
PERM-CMS-PUBLISH-ALL                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  # any resource
PERM-CMS-APPROVE
PERM-CMS-TRANSLATE
PERM-CMS-SEO-EDIT
PERM-CMS-MENUS-EDIT
PERM-CMS-REDIRECTS-VIEW
PERM-CMS-REDIRECTS-MANAGE
PERM-CMS-FORMS-VIEW
PERM-CMS-FORMS-MANAGE
PERM-CMS-KB-MANAGE
PERM-CMS-BLOCKS-DEVELOP                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          # custom block kinds (Fáze 2)
```

### 4.10 Themes + Storefront

Per `26`.

```
PERM-THEME-VIEW
PERM-THEME-INSTALL
PERM-THEME-CUSTOMIZE
PERM-THEME-PUBLISH
PERM-THEME-DEVELOP
PERM-THEME-AB-TEST
PERM-THEME-AUDIT-VIEW
PERM-THEME-FORCE-PUBLISH                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  # bypass validation
PERM-THEME-MARKETPLACE-APPROVE                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  # platform staff
```

### 4.11 Multi-store + Channels + Locales

Per `22`, `23`.

```
PERM-STORE-VIEW
PERM-STORE-CREATE
PERM-STORE-MANAGE
PERM-CHANNEL-MANAGE
PERM-LOCALE-MANAGE
PERM-CURRENCY-MANAGE
PERM-DOMAIN-MANAGE
```

### 4.12 Subscriptions

Per `24`.

```
PERM-SUBSCRIPTION-VIEW
PERM-SUBSCRIPTION-MANAGE
PERM-SUBSCRIPTION-CANCEL
PERM-SUBSCRIPTION-MODIFY
PERM-SUBSCRIPTION-PLAN-MANAGE
PERM-MRR-VIEW
```

### 4.13 Marketplace

Per `25`.

```
PERM-MARKETPLACE-SELLER-VIEW
PERM-MARKETPLACE-SELLER-MANAGE
PERM-MARKETPLACE-LISTING-APPROVE
PERM-MARKETPLACE-PAYOUT-VIEW
PERM-MARKETPLACE-PAYOUT-MANAGE
PERM-MARKETPLACE-DISPUTE-VIEW
PERM-MARKETPLACE-DISPUTE-RESOLVE
PERM-MARKETPLACE-DISPUTE-MANAGE
PERM-MARKETPLACE-VIOLATION-MANAGE
PERM-MARKETPLACE-COMPLIANCE-VIEW
PERM-MARKETPLACE-ANALYTICS-VIEW
PERM-MARKETPLACE-CATEGORY-MANAGE
PERM-MARKETPLACE-SUPPORT
PERM-SELLER-OWN-VIEW                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          # seller's own ops
PERM-SELLER-OWN-MANAGE
PERM-SELLER-OWN-PAYOUT-VIEW
PERM-SELLER-OWN-DISPUTE-RESPOND
```

### 4.14 Developer Platform

Per `28`.

```
PERM-DEVELOPER-TOKEN-VIEW
PERM-DEVELOPER-TOKEN-MANAGE
PERM-DEVELOPER-WEBHOOK-VIEW
PERM-DEVELOPER-WEBHOOK-MANAGE
PERM-DEVELOPER-FUNCTION-VIEW
PERM-DEVELOPER-FUNCTION-MANAGE
PERM-DEVELOPER-APP-INSTALL
PERM-DEVELOPER-APP-MANAGE
PERM-DEVELOPER-ANALYTICS-VIEW
PERM-DEVELOPER-MCP-VIEW
PERM-DEVELOPER-MCP-MANAGE
PERM-PARTNER-APP-MANAGE                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          # partner dashboard
PERM-PLATFORM-APP-REVIEW                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            # platform staff
```

### 4.15 Integrations

Per `29`.

```
PERM-INTEGRATION-VIEW
PERM-INTEGRATION-MANAGE
PERM-INTEGRATION-RESOLVE-CONFLICTS
PERM-INTEGRATION-ACCOUNTING-MANAGE
PERM-INTEGRATION-MARKETING-MANAGE
PERM-INTEGRATION-SUPPORT-MANAGE
PERM-INTEGRATION-DEBUG
PERM-PLATFORM-INTEGRATION-REGISTRY-MANAGE                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            # platform staff
```

### 4.16 Security + Compliance

Per `30`.

```
PERM-SECURITY-VIEW
PERM-SECURITY-MANAGE
PERM-AUDIT-LOG-VIEW
PERM-AUDIT-LOG-EXPORT
PERM-SECURITY-EVENT-VIEW
PERM-SECURITY-EVENT-MANAGE
PERM-INCIDENT-VIEW
PERM-INCIDENT-MANAGE
PERM-SECURITY-FRAUD-VIEW
PERM-SECURITY-FRAUD-MANAGE
PERM-COMPLIANCE-VIEW
PERM-COMPLIANCE-MANAGE
PERM-AUDIT-LOG-VIEW-CROSS-TENANT                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              # platform; JIT
PERM-PLATFORM-SECURITY-INVESTIGATE                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                # platform staff
PERM-PLATFORM-COMPLIANCE                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              # platform staff
PERM-PLATFORM-DPO                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          # DPO; can access special category data with audit
PERM-PLATFORM-DPO-DSAR                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          # DSAR fulfillment
```

### 4.17 Operations

Per `31`.

```
PERM-OPS-DEPLOY-VIEW
PERM-OPS-DEPLOY-MANAGE
PERM-OPS-DEPLOY-NON-PROD                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          # engineers deploy non-prod
PERM-OPS-FEATURE-FLAGS-VIEW
PERM-OPS-FEATURE-FLAGS-MANAGE
PERM-OPS-MAINTENANCE-VIEW
PERM-OPS-MAINTENANCE-MANAGE
PERM-OPS-SLO-VIEW
PERM-OPS-INVENTORY-VIEW                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                # service inventory
PERM-OPS-INVENTORY-MANAGE
PERM-OPS-OBSERVABILITY-VIEW
PERM-OPS-OBSERVABILITY-MANAGE
PERM-OPS-COSTS-VIEW
PERM-OPS-BUDGETS-MANAGE
PERM-OPS-STATUS-MANAGE
PERM-OPS-DR-FAILOVER                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              # highly restricted
PERM-OPS-INFRA-MANAGE
PERM-OPS-PIPELINE-MANAGE
PERM-OPS-RELEASE-MANAGE
PERM-OPS-DB-MANAGE
PERM-OPS-RUNBOOK-VIEW
PERM-PLATFORM-PRODUCTION-ACCESS                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                # JIT required per `30`
PERM-PLATFORM-STAFF-DB-ACCESS                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  # bypass RLS for support; audited
PERM-PLATFORM-AI-OPS
```

### 4.18 AI Features

Per `33`.

```
PERM-AI-VIEW
PERM-AI-MANAGE
PERM-AI-VIEW-COSTS
PERM-AI-USE-CONTENT
PERM-AI-USE-MARKETING
PERM-AI-USE-SUPPORT
PERM-AI-USE-ANALYTICS
PERM-AI-USE-DEVELOPER
PERM-PLATFORM-AI-COMPLIANCE                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          # platform AI Act compliance
```

### 4.19 Industry Profiles

Per `34`.

```
PERM-INDUSTRY-PROFILE-VIEW
PERM-INDUSTRY-PROFILE-MANAGE
PERM-PLATFORM-PROFILE-DEFINE                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              # platform staff
```

### 4.20 Admin app + meta

Per `27`.

```
PERM-ADMIN-ACCESS                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              # basic admin login
PERM-ADMIN-FULL                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                # superuser
PERM-ADMIN-TEAM-MANAGE
PERM-ADMIN-IMPERSONATE                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                # platform staff only
PERM-ADMIN-AGENCY-MODE                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  # multi-tenant access
PERM-MERCHANT-BILLING-VIEW                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          # Shopio subscription billing
PERM-MERCHANT-BILLING-MANAGE
PERM-MERCHANT-OWNER-TRANSFER
PERM-PLATFORM-LOGIN                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                # platform staff login enabled
PERM-PLATFORM-SUPPORT
PERM-PLATFORM-SOC-MONITOR                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                # SOC (Fáze 2)
```

### 4.21 Total count

Approximately **180 permissions in MVP**, with ~30 reserved for Fáze 2 features (subscriptions deep, edge functions, fine-grained CMS). Each permission has:
- Canonical code
- Display name (per locale)
- Description
- Category (resource grouping)
- Default minimum persona (which persona has it by default)
- AI Act tier (limited / minimal — affects audit retention)
- Sensitive flag (extra audit when used)

Stored in `permission_definitions` table (per `12`).

---

## 5. Persona → permission mappings

Default permission bundles per persona. Stored as `persona_definitions` rows (per `12`). Versioned; migration on changes per `13`.

### 5.1 Merchant personas

#### `PERSONA-MERCHANT-OWNER`
**Wildcard** — all `PERM-*` except `PERM-PLATFORM-*`.

#### `PERSONA-MERCHANT-ADMIN`
All Owner minus:
- `PERM-MERCHANT-BILLING-*`
- `PERM-MERCHANT-OWNER-TRANSFER`

#### `PERSONA-MERCHANT-STAFF`
```
PERM-ADMIN-ACCESS
PERM-PRODUCT-VIEW, PERM-PRODUCT-EDIT
PERM-CATEGORY-VIEW, PERM-COLLECTION-VIEW, PERM-BRAND-VIEW
PERM-INVENTORY-VIEW
PERM-ORDER-VIEW, PERM-ORDER-EDIT, PERM-ORDER-NOTE-ADD, PERM-ORDER-TAG-MANAGE
PERM-CUSTOMER-VIEW, PERM-CUSTOMER-EDIT (no DELETE, no full PII)
PERM-RETURN-VIEW, PERM-RETURN-CREATE, PERM-RETURN-APPROVE, PERM-RETURN-PROCESS
PERM-REVIEW-VIEW, PERM-REVIEW-MODERATE
PERM-CMS-VIEW
PERM-ANALYTICS-VIEW (limited)
PERM-AI-USE-CONTENT (limited)
```

#### `PERSONA-MERCHANT-WAREHOUSE-STAFF`
```
PERM-ADMIN-ACCESS
PERM-PRODUCT-VIEW
PERM-INVENTORY-VIEW, PERM-INVENTORY-ADJUST, PERM-INVENTORY-TRANSFER, PERM-INVENTORY-RECEIVE, PERM-INVENTORY-COUNT-MANAGE
PERM-WAREHOUSE-MANAGE
PERM-STOCK-MOVEMENT-VIEW, PERM-LOW-STOCK-ALERT-MANAGE
PERM-FULFILLMENT-VIEW, PERM-FULFILLMENT-CREATE, PERM-FULFILLMENT-CANCEL
PERM-SHIPPING-LABEL-PRINT
PERM-ORDER-VIEW, PERM-ORDER-FULFILL
PERM-PICKUP-POINT-MANAGE
```

#### `PERSONA-MERCHANT-CUSTOMER-SERVICE`
```
PERM-ADMIN-ACCESS
PERM-ORDER-VIEW, PERM-ORDER-VIEW-FULL-PII, PERM-ORDER-EDIT, PERM-ORDER-CANCEL, PERM-ORDER-REFUND, PERM-ORDER-NOTE-ADD, PERM-ORDER-TAG-MANAGE
PERM-CUSTOMER-VIEW, PERM-CUSTOMER-VIEW-FULL-PII, PERM-CUSTOMER-EDIT, PERM-CUSTOMER-MERGE, PERM-CUSTOMER-IMPERSONATE
PERM-CUSTOMER-NOTE-MANAGE, PERM-CUSTOMER-TAG-MANAGE
PERM-CUSTOMER-CONSENT-VIEW
PERM-RETURN-*, PERM-RMA-MANAGE
PERM-REVIEW-VIEW, PERM-REVIEW-MODERATE
PERM-COMPANY-VIEW (read-only B2B)
PERM-QUOTE-VIEW
PERM-AI-USE-SUPPORT
```

Note: `PERM-CUSTOMER-DELETE` separate (GDPR erasure) — usually only DPO/Owner.

#### `PERSONA-MERCHANT-MARKETING-MANAGER`
```
PERM-ADMIN-ACCESS
PERM-MARKETING-*
PERM-CMS-*
PERM-THEME-*
PERM-ANALYTICS-VIEW, PERM-ANALYTICS-EXPORT
PERM-REPORT-VIEW
PERM-COHORT-VIEW, PERM-RFM-VIEW
PERM-INTEGRATION-MARKETING-MANAGE
PERM-PROMOTION-*, PERM-COUPON-MANAGE, PERM-GIFT-CARD-MANAGE
PERM-PRODUCT-VIEW (no edit)
PERM-COLLECTION-MANAGE
PERM-CUSTOMER-VIEW (limited), PERM-CUSTOMER-SEGMENT-MANAGE
PERM-AI-USE-MARKETING, PERM-AI-USE-CONTENT
```

#### `PERSONA-MERCHANT-ACCOUNTANT`
```
PERM-ADMIN-ACCESS
PERM-FINANCE-VIEW, PERM-FINANCE-RECONCILE
PERM-INVOICE-VIEW, PERM-INVOICE-CREATE, PERM-INVOICE-CANCEL, PERM-INVOICE-EXPORT
PERM-PAYMENT-VIEW
PERM-TAX-CONFIG-MANAGE, PERM-TAX-REPORT-VIEW, PERM-TAX-REPORT-EXPORT
PERM-REPORT-VIEW, PERM-REPORT-CUSTOM-CREATE, PERM-REPORT-SCHEDULE-MANAGE
PERM-INTEGRATION-ACCOUNTING-MANAGE
PERM-CUSTOMER-VIEW, PERM-COMPANY-VIEW
PERM-ORDER-VIEW, PERM-ORDER-EXPORT
PERM-RETURN-VIEW (refund visibility)
PERM-MARKETPLACE-PAYOUT-VIEW (if marketplace)
```

#### `PERSONA-MERCHANT-DEVELOPER`
```
PERM-ADMIN-ACCESS
PERM-DEVELOPER-*
PERM-INTEGRATION-VIEW, PERM-INTEGRATION-DEBUG
PERM-PRODUCT-VIEW, PERM-ORDER-VIEW (for testing)
PERM-AI-USE-DEVELOPER
PERM-OPS-OBSERVABILITY-VIEW (own integrations)
PERM-AUDIT-LOG-VIEW (own actions)
```

#### `PERSONA-MERCHANT-SECURITY-OFFICER`
```
PERM-ADMIN-ACCESS
PERM-SECURITY-*
PERM-AUDIT-LOG-VIEW, PERM-AUDIT-LOG-EXPORT
PERM-SECURITY-EVENT-*
PERM-INCIDENT-*
PERM-SECURITY-FRAUD-*
PERM-COMPLIANCE-VIEW
PERM-ADMIN-TEAM-MANAGE
```

#### `PERSONA-MERCHANT-COMPLIANCE`
```
PERM-ADMIN-ACCESS
PERM-COMPLIANCE-*
PERM-INDUSTRY-PROFILE-VIEW, PERM-INDUSTRY-PROFILE-MANAGE
PERM-AUDIT-LOG-VIEW
PERM-CUSTOMER-CONSENT-VIEW
PERM-TAX-REPORT-VIEW
```

#### `PERSONA-MERCHANT-CONTENT-EDITOR`
```
PERM-ADMIN-ACCESS
PERM-CMS-VIEW, PERM-CMS-EDIT-OWN, PERM-CMS-DRAFT
PERM-CMS-TRANSLATE
PERM-CMS-SEO-EDIT
PERM-CMS-MENUS-EDIT (limited)
PERM-AI-USE-CONTENT
```

(No `PERM-CMS-PUBLISH` — must request approval per `32 §5.5`.)

### 5.2 Customer + B2B

#### `PERSONA-CUSTOMER-ANONYMOUS`
- No platform permissions
- Storefront read access (scope-based, public)

#### `PERSONA-CUSTOMER-REGISTERED`
- Self-only:
  - View own profile
  - View own orders
  - View own wishlist
  - Edit own profile + addresses
  - Place orders
  - Submit reviews on purchased products

#### `PERSONA-CUSTOMER-B2B-COMPANY-OWNER`
Per `21 §2`. Company-scoped:
- Manage company profile
- Manage members (invite, remove, set roles)
- View all company orders + invoices
- Manage credit limit (set up, not unilaterally raise — admin approval)
- Sign contracts

#### `PERSONA-CUSTOMER-B2B-COMPANY-ADMIN`
Same as Owner minus billing + ownership transfer (analog to merchant Owner→Admin).

#### `PERSONA-CUSTOMER-B2B-PURCHASER`
- Browse + place orders for company
- View own + team orders
- Cannot modify other members

#### `PERSONA-CUSTOMER-B2B-APPROVER`
- Above + approve orders > threshold (per `21` approval workflows)
- View all company orders requiring approval

#### `PERSONA-CUSTOMER-B2B-VIEWER`
- Catalog browsing only
- View own past orders read-only

### 5.3 Marketplace

#### `PERSONA-MARKETPLACE-OPERATOR`
Inherits `PERSONA-MERCHANT-OWNER` + marketplace permissions:
```
+ PERM-MARKETPLACE-* (all)
```

#### `PERSONA-MARKETPLACE-CATEGORY-MANAGER`
```
PERM-ADMIN-ACCESS
PERM-MARKETPLACE-LISTING-APPROVE
PERM-MARKETPLACE-CATEGORY-MANAGE
PERM-MARKETPLACE-SELLER-VIEW
PERM-CATEGORY-VIEW
```

#### `PERSONA-MARKETPLACE-DISPUTE-MEDIATOR`
```
PERM-ADMIN-ACCESS
PERM-MARKETPLACE-DISPUTE-VIEW, PERM-MARKETPLACE-DISPUTE-RESOLVE
PERM-ORDER-VIEW, PERM-ORDER-REFUND
PERM-MARKETPLACE-SELLER-VIEW
PERM-CUSTOMER-VIEW, PERM-CUSTOMER-NOTE-MANAGE
PERM-AI-USE-SUPPORT
```

#### `PERSONA-MARKETPLACE-FINANCE-MANAGER`
```
PERM-ADMIN-ACCESS
PERM-MARKETPLACE-PAYOUT-VIEW, PERM-MARKETPLACE-PAYOUT-MANAGE
PERM-MARKETPLACE-ANALYTICS-VIEW
PERM-FINANCE-VIEW
PERM-MARKETPLACE-SELLER-VIEW
PERM-INVOICE-VIEW
```

#### `PERSONA-MARKETPLACE-COMPLIANCE-OFFICER`
```
PERM-ADMIN-ACCESS
PERM-MARKETPLACE-COMPLIANCE-VIEW
PERM-MARKETPLACE-SELLER-MANAGE (KYC review)
PERM-COMPLIANCE-*
PERM-AUDIT-LOG-VIEW
```

#### `PERSONA-SELLER-OWNER`
Per `25 §3.2`. Seller-scoped (self-only via ABAC):
```
PERM-SELLER-OWN-VIEW, PERM-SELLER-OWN-MANAGE
PERM-PRODUCT-VIEW, PERM-PRODUCT-CREATE, PERM-PRODUCT-EDIT, PERM-PRODUCT-DELETE (scoped to seller_id)
PERM-ORDER-VIEW, PERM-ORDER-FULFILL (scoped)
PERM-RETURN-* (scoped)
PERM-SELLER-OWN-PAYOUT-VIEW
PERM-SELLER-OWN-DISPUTE-RESPOND
PERM-CUSTOMER-VIEW (limited; only customers who ordered)
PERM-ANALYTICS-VIEW (own data only)
PERM-AI-USE-CONTENT, PERM-AI-USE-SUPPORT
PERM-CMS-EDIT-OWN (seller storefront content)
```

#### `PERSONA-SELLER-ADMIN` / `STAFF` / `FINANCE` / `SUPPORT` / `VIEWER`
Subsets per `25 §3.2`.

### 5.4 Platform staff

#### `PERSONA-PLATFORM-SRE`
```
PERM-PLATFORM-LOGIN
PERM-PLATFORM-PRODUCTION-ACCESS (JIT)
PERM-OPS-*
PERM-PLATFORM-STAFF-DB-ACCESS (JIT)
PERM-OPS-DR-FAILOVER
```

#### `PERSONA-PLATFORM-DEVOPS-ENGINEER`
```
PERM-PLATFORM-LOGIN
PERM-OPS-INFRA-MANAGE, PERM-OPS-PIPELINE-MANAGE, PERM-OPS-OBSERVABILITY-MANAGE
PERM-OPS-DEPLOY-NON-PROD
PERM-OPS-DEPLOY-VIEW
```

#### `PERSONA-PLATFORM-RELEASE-MANAGER`
```
PERM-PLATFORM-LOGIN
PERM-OPS-DEPLOY-MANAGE
PERM-OPS-RELEASE-MANAGE
PERM-OPS-FEATURE-FLAGS-MANAGE
PERM-OPS-MAINTENANCE-MANAGE
PERM-OPS-STATUS-MANAGE
```

#### `PERSONA-PLATFORM-SECURITY`
```
PERM-PLATFORM-LOGIN
PERM-PLATFORM-SECURITY-INVESTIGATE
PERM-AUDIT-LOG-VIEW-CROSS-TENANT (JIT)
PERM-SECURITY-EVENT-MANAGE (cross-tenant via JIT)
PERM-INCIDENT-MANAGE (cross-tenant)
PERM-OPS-OBSERVABILITY-VIEW
```

#### `PERSONA-PLATFORM-COMPLIANCE-OFFICER`
```
PERM-PLATFORM-LOGIN
PERM-PLATFORM-COMPLIANCE
PERM-COMPLIANCE-VIEW (cross-tenant)
PERM-AUDIT-LOG-VIEW-CROSS-TENANT (JIT)
PERM-PLATFORM-AI-COMPLIANCE
PERM-PLATFORM-INTEGRATION-REGISTRY-MANAGE
```

#### `PERSONA-PLATFORM-DPO`
```
PERM-PLATFORM-LOGIN
PERM-PLATFORM-DPO, PERM-PLATFORM-DPO-DSAR
PERM-CUSTOMER-CONSENT-VIEW (cross-tenant via JIT)
PERM-AUDIT-LOG-VIEW-CROSS-TENANT (JIT)
PERM-CUSTOMER-VIEW-FULL-PII (special category data; JIT + audit)
```

#### `PERSONA-PLATFORM-SUPPORT`
```
PERM-PLATFORM-LOGIN
PERM-PLATFORM-SUPPORT
PERM-OPS-OBSERVABILITY-VIEW
PERM-OPS-RUNBOOK-VIEW
PERM-ADMIN-IMPERSONATE (JIT + tenant consent)
```

### 5.5 Developer + Agency

#### `PERSONA-APP-PUBLISHER`
- partners.shopio.com scope
- `PERM-PARTNER-APP-MANAGE` (own apps)
- Cannot access tenant data unless tenant installed app + granted scopes

#### `PERSONA-AGENCY-ADMIN`
- `PERM-ADMIN-AGENCY-MODE`
- Per-tenant assignment: inherits `PERSONA-MERCHANT-ADMIN` per assigned tenant

#### `PERSONA-AGENCY-STAFF`
- `PERM-ADMIN-AGENCY-MODE`
- Per-tenant: inherits `PERSONA-MERCHANT-STAFF` or custom per assignment

### 5.6 AI agents

#### `PERSONA-AI-COPILOT` (internal)
Inherits user's permissions for read; write actions explicit user confirmation per request.

#### `PERSONA-AI-AGENT-EXTERNAL` (MCP)
OAuth scopes only (per `28 §4.4`):
- `agent:read_catalog`, `agent:read_orders`, `agent:read_customers`, `agent:place_order` (with confirmation), `agent:manage_cart`, `agent:read_analytics`, `agent:read_kb`, etc.
- Maps to subset of merchant permissions; tenant grants when installing agent OAuth client

#### `PERSONA-AI-AGENT-WORKFLOW`
System-level; tied to specific use case (e.g., fraud scoring). Not user-impersonating.

---

## 6. Custom roles

Fáze 2 feature.

### 6.1 Use case

Default personas pokrývají 95% potřeb. Power users (enterprise, agencies) chtějí custom roles:
- "Junior Buyer" — view all + create draft orders, cannot publish
- "Auditor" — read-only everywhere
- "Regional Manager EMEA" — full access but scoped to EMEA stores
- Custom mix of permissions

### 6.2 Custom role definition

`custom_roles` table (per `12`):
- Code (tenant-unique slug)
- Display name + description
- Permission set (array of PERM-* codes)
- Optional: ABAC scope (e.g., store_ids, region, customer_segment)
- Status (active / disabled)

### 6.3 Assignment

`user_role_assignments`:
- user_id → either persona_code OR custom_role_id
- Multiple roles per user allowed (union of permissions)
- Per-store assignment (multi-store environments)

### 6.4 Limits

- Max 20 custom roles per tenant (MVP)
- Cannot exceed Owner's permissions (Owner permission set is union of all available)
- Cannot assign platform-staff permissions to merchant users
- Validation prevents permission combinations that violate separation of duties (e.g., approver + initiator on same workflow — warning)

### 6.5 UI

Settings → Team → Roles:
- Browse default personas (read-only catalog)
- Create custom role (form): name + description + permission picker (categorized + searchable)
- Assignment per user

### 6.6 Migration

When platform adds new permission to system:
- Custom roles don't automatically include new permission
- Tenant notified; admin reviews + opts-in per role
- Default personas auto-include where appropriate

---

## 7. ABAC policies

Per `30 §5.5`. ABAC = Attribute-Based Access Control — context-aware policies layered on top of RBAC.

### 7.1 Policy shape

```yaml
- code: high_value_refund_step_up
  resource: order
  action: refund
  applies_when: refund.amount > 500000 AND session.assurance_level != 'step_up'
  enforce: require_step_up_mfa
  audit: true
```

### 7.2 Common ABAC patterns

#### 7.2.1 Resource ownership scoping

```yaml
- code: seller_member_own_orders
  resource: order
  action: view
  applies_when: user.has_permission(PERM-SELLER-OWN-VIEW) AND NOT user.has_permission(PERM-ORDER-VIEW)
  enforce: filter_by(order.marketplace_seller_id IN user.seller_member.seller_ids)
```

```yaml
- code: customer_self_orders
  resource: order
  action: view
  applies_when: user.persona == 'CUSTOMER-REGISTERED'
  enforce: filter_by(order.customer_id == user.customer_id)
```

#### 7.2.2 B2B company scoping

```yaml
- code: b2b_company_orders
  resource: order
  action: view
  applies_when: user.has_persona('CUSTOMER-B2B-*')
  enforce: filter_by(order.company_id == user.company_id) AND (user.role >= ADMIN OR order.buyer_user_id == user.id)
```

#### 7.2.3 Step-up MFA required

```yaml
- code: high_value_refund_step_up
  resource: order, action: refund
  applies_when: refund.amount > tenant.high_value_refund_threshold
  enforce: require_step_up_mfa

- code: mfa_setting_change_step_up
  resource: security_settings, action: edit
  applies_when: settings.field IN ['mfa_required', 'sso_enabled']
  enforce: require_step_up_mfa

- code: data_export_step_up
  resource: customer, action: export
  applies_when: export.row_count > 1000
  enforce: require_step_up_mfa
```

#### 7.2.4 Bulk operation approval

```yaml
- code: bulk_delete_threshold
  resource: product, action: bulk_delete
  applies_when: bulk.count > 100 AND user.role != 'OWNER'
  enforce: require_approval(OWNER OR PERM-PRODUCT-BULK-DELETE-APPROVE)

- code: bulk_unpublish_threshold
  resource: product, action: bulk_unpublish
  applies_when: bulk.count > 500
  enforce: require_approval
```

#### 7.2.5 Time-bound permissions

```yaml
- code: maintenance_window_only
  resource: tenant_settings, action: edit_critical
  applies_when: NOT in_maintenance_window(tenant)
  enforce: deny
```

#### 7.2.6 IP-based restriction

```yaml
- code: admin_ip_allowlist
  resource: admin_session, action: any
  applies_when: tenant.ip_allowlist IS NOT NULL AND request.ip NOT IN tenant.ip_allowlist
  enforce: deny

- code: production_db_internal_only
  resource: platform_db_admin, action: any
  applies_when: request.source != 'corporate_vpn'
  enforce: deny
```

#### 7.2.7 GDPR special category

```yaml
- code: special_category_data_audit
  resource: customer, action: view_full_pii
  applies_when: customer.has_special_category_data == true
  enforce: log_audit + require_reason_capture
```

### 7.3 Policy engine

- Implemented in `@shopio/authz` package
- Policies declared in TypeScript (OR YAML loaded at startup)
- Cached at session start (per access token)
- Evaluated synchronously at request time
- Failure path: 403 with reason; logged as security event (per `30 §6.3`)

### 7.4 Policy versioning

- Policies versioned per release
- Hot-reload supported
- Audit log captures policy version at decision time

---

## 8. Scopes for tokens + agents

Per `28 §4.4` OAuth scopes catalog. Brief here:

### 8.1 Scope vs permission

- **Permission** — fine-grained capability for users
- **Scope** — bundle of permissions granted to token/app/agent

Scope maps to N permissions. E.g., `write_orders` → `PERM-ORDER-CREATE`, `PERM-ORDER-EDIT`, `PERM-ORDER-CANCEL`, `PERM-ORDER-FULFILL`.

### 8.2 Scope categories

| Scope category | Examples |
|---|---|
| Resource read | `read_products`, `read_orders`, `read_customers`, `read_inventory`, `read_themes`, `read_analytics` |
| Resource write | `write_products`, `write_orders`, `write_customers`, `write_inventory`, `write_themes` |
| Developer ops | `write_webhooks`, `write_edge_functions`, `write_api_tokens` |
| Marketplace | `read_marketplace`, `write_marketplace_seller`, `read_payouts` |
| Agent scopes | `agent:read_catalog`, `agent:read_orders`, `agent:place_order`, `agent:read_analytics`, `agent:read_customers`, `agent:read_kb`, `agent:*` |
| Admin scopes | `admin:full` (rare; only for SDK testing) |

### 8.3 Scope vs persona

Token scope = subset of user's permissions:
```
effective_permissions_on_token =
  user.persona_permissions ∩ scope_to_permissions(token.scopes)
```

User can't grant more than they have. Tokens always equal or less.

### 8.4 Agent scopes special handling

`agent:*` scopes:
- Are subset of normal scopes
- Audit logged separately (per `30 §RULE-AI-026`)
- Write operations require user confirmation per call (per `30 §RULE-SEC-045`)
- May be revoked by tenant any time
- Per-agent rate limits stricter

### 8.5 Scope discovery via API

```
GET /api/{date}/developer/scopes
```

Returns scope catalog + which permissions each scope unlocks. Used by app developers to declare needed scopes minimum.

---

## 9. Multi-tenant + agency mode

### 9.1 Agency mode

User has `PERM-ADMIN-AGENCY-MODE`. UI shows tenant switcher (per `27 §RULE-ADM-010`). Each tenant assignment has its own persona/role.

### 9.2 Assignment model

`user_tenant_memberships`:
- user_id
- tenant_id
- persona_code OR custom_role_id (per tenant)
- assigned_by_user_id
- assigned_at
- status (active / suspended / revoked)
- expires_at (optional time-bound)

### 9.3 Switching tenant

- Topbar switcher (per `27 §RULE-ADM-009`)
- New JWT issued for new tenant context
- Permissions reloaded
- Audit log: `user.tenant_switched`

### 9.4 Cross-tenant operations

Generally not allowed. Specific exceptions:
- Bulk export across agency's tenants (Fáze 3+ feature)
- Cross-tenant search (find product across all agency tenants)
- Per-tenant action still requires being in that tenant's context

### 9.5 Agency-level analytics

Aggregate dashboards across agency's tenants:
- Total revenue
- Open issues
- License usage

Stored in `agency_aggregates`; computed daily. Not real-time per-tenant.

### 9.6 Agency billing

- Agency invoices Shopio for all assigned tenants (consolidated billing)
- Per-tenant resource attribution still tracked

### 9.7 White-label agency

Fáze 3+. Agency can rebrand:
- Custom admin login domain
- Custom logo in admin shell
- "Powered by Shopio" footer optional

---

## 10. Just-in-time access

For platform staff + sensitive merchant operations.

### 10.1 Use cases

- **Platform support → tenant data**: with tenant consent, access tenant admin to help debug
- **Platform DPO → DSAR response**: access tenant customer data for compliance request
- **Platform SRE → production DB**: emergency debugging
- **Platform security → audit log cross-tenant**: incident investigation
- **Custom merchant role → admin temporary elevation**: power user task

### 10.2 Flow

```
[User requests JIT access via UI]
   - Form: target (tenant_id / resource), reason, duration (1h-8h)
        ↓
[Auto-approve if low-risk + within policy]
[Else: route to approver (manager / DPO / security)]
        ↓
[Approver decides + comments]
        ↓
[Approved → grant active]
   - Token issued with elevated permissions
   - Expires at duration end
        ↓
[All actions during grant audited extensively]
        ↓
[Grant expires / revoked → permissions removed]
[Post-grant report sent to grantee + approver]
```

### 10.3 Tenant notification

For platform→tenant JIT:
- Pre-hoc (preferred): tenant approves before access granted
- Post-hoc (emergency): tenant notified immediately after access used; option to dispute

Per `30 §RULE-SEC-023`.

### 10.4 Auto-approve criteria

- Tenant has pre-authorized "support access during incident"
- Active SEV-1/2 incident on tenant
- Duration ≤ 1h
- Low-sensitivity scope (read-only logs, no PII)

### 10.5 Implementation

`privileged_access_grants` table per `30 §16.12`. JWT during grant includes:
- Original user identity
- JIT grant ID
- Expiry timestamp
- Scope (permissions added)

Audit log captures every action with `jit_grant_id` correlation.

---

## 11. RLS policies

Per `30 §5.4`. PostgreSQL Row-Level Security pro hardware tenant isolation.

### 11.1 Standard tenant RLS

Pro každou tenant-scoped tabulku:

```sql
ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON {table}
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_insert ON {table}
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
```

Tabulky bez `tenant_id` (platform-wide): `industry_profiles`, `ai_providers`, `regulatory_checklists`, atd. — RLS-exempt nebo platform-only policy.

### 11.2 Application sets context

Před každým query:
```sql
SET LOCAL app.current_tenant_id = 'tnt_aB';
SET LOCAL app.current_user_id = 'usr_xY';
SET LOCAL app.current_jit_grant_id = '';  -- empty unless JIT active
```

### 11.3 Platform staff bypass

`PERM-PLATFORM-STAFF-DB-ACCESS` (JIT) → app sets:
```sql
SET LOCAL ROLE platform_staff;
```

`platform_staff` Postgres role má `BYPASSRLS`. Audit log captures each query during this session.

### 11.4 Seller scoping (marketplace)

Sellers vidí jen own data:

```sql
CREATE POLICY seller_own_products ON products
  USING (
    seller_id IS NULL  -- platform-owned products visible to all sellers
    OR seller_id = current_setting('app.current_seller_id', true)::uuid
    OR current_setting('app.current_user_persona', true) IN ('MERCHANT-OWNER','MARKETPLACE-OPERATOR')
  );
```

### 11.5 Customer self-scoping

Customer-facing tabulky:

```sql
CREATE POLICY customer_own_orders ON orders
  FOR SELECT
  USING (
    customer_id = current_setting('app.current_customer_id', true)::uuid
    OR current_setting('app.current_role', true) = 'merchant'
  );
```

Storefront API se chová jako customer-scoped; admin API jako merchant-scoped.

### 11.6 B2B company scoping

```sql
CREATE POLICY b2b_company_orders ON orders
  USING (
    company_id = current_setting('app.current_company_id', true)::uuid
    OR current_setting('app.current_role', true) = 'merchant'
  );
```

### 11.7 RLS performance

- RLS přidává WHERE clause na každý dotaz
- Indexy s `tenant_id` prefix essential (e.g., `INDEX (tenant_id, status)` ne `INDEX (status)`)
- Per `06`-`32` všechny doménové schemas mají tenant_id v indexes

---

## 12. Data models

### 12.1 `personas` (catalog)

```sql
CREATE TABLE personas (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  code TEXT NOT NULL,                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            -- 'MERCHANT-OWNER', 'CUSTOMER-B2B-PURCHASER'
  display_name TEXT NOT NULL,
  description TEXT NULL,
  surface TEXT NOT NULL CHECK (surface IN ('storefront','admin','partner','platform','agency','marketplace','mcp_api')),
  parent_persona_code TEXT NULL,                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          -- hierarchy
  permission_codes TEXT[] NOT NULL DEFAULT '{}',                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            -- core permissions
  is_system BOOLEAN NOT NULL DEFAULT true,                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      -- platform-defined vs tenant
  is_assignable BOOLEAN NOT NULL DEFAULT true,                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      -- some are abstract umbrella personas
  default_for_new_users BOOLEAN NOT NULL DEFAULT false,
  version INTEGER NOT NULL DEFAULT 1,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_personas_code UNIQUE (code)
);

CREATE INDEX idx_personas_surface ON personas (surface) WHERE is_assignable = true;
```

### 12.2 `permission_definitions`

```sql
CREATE TABLE permission_definitions (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  code TEXT NOT NULL,                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          -- 'PERM-PRODUCT-VIEW'
  display_name TEXT NOT NULL,
  description TEXT NULL,
  category TEXT NOT NULL,                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              -- 'catalog','orders','customers','marketing',...
  resource TEXT NOT NULL,                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  -- 'PRODUCT','ORDER',...
  action TEXT NOT NULL,                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      -- 'VIEW','EDIT',...
  is_sensitive BOOLEAN NOT NULL DEFAULT false,                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  -- extra audit when used
  ai_act_tier TEXT NULL CHECK (ai_act_tier IN ('minimal','limited','high') OR ai_act_tier IS NULL),
  requires_mfa BOOLEAN NOT NULL DEFAULT false,
  introduced_in_version TEXT NULL,
  deprecated BOOLEAN NOT NULL DEFAULT false,
  deprecated_at TIMESTAMPTZ NULL,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_permission_definitions_code UNIQUE (code)
);

CREATE INDEX idx_permission_definitions_category ON permission_definitions (category);
```

### 12.3 `custom_roles` (tenant-defined; Fáze 2)

```sql
CREATE TABLE custom_roles (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pub_id TEXT NOT NULL,
  code TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT NULL,
  permission_codes TEXT[] NOT NULL DEFAULT '{}',
  abac_scope JSONB NULL,                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          -- per-store, per-region, etc.
  status TEXT NOT NULL CHECK (status IN ('active','disabled')) DEFAULT 'active',
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user_id UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_custom_roles_code UNIQUE (tenant_id, code)
);
```

### 12.4 `user_tenant_memberships`

```sql
CREATE TABLE user_tenant_memberships (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  persona_code TEXT NULL REFERENCES personas(code),
  custom_role_id UUID NULL REFERENCES custom_roles(id),
  -- ABAC scope
  scope_store_ids UUID[] NULL,                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  -- scope to specific stores
  scope_region_codes TEXT[] NULL,
  -- status
  status TEXT NOT NULL CHECK (status IN ('active','suspended','revoked','pending_acceptance')) DEFAULT 'pending_acceptance',
  -- audit
  invited_at TIMESTAMPTZ NULL,
  accepted_at TIMESTAMPTZ NULL,
  assigned_by_user_id UUID NULL,
  revoked_at TIMESTAMPTZ NULL,
  expires_at TIMESTAMPTZ NULL,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_user_tenant_memberships UNIQUE (tenant_id, user_id),
  CONSTRAINT chk_persona_or_role CHECK ((persona_code IS NOT NULL) OR (custom_role_id IS NOT NULL))
);

CREATE INDEX idx_user_tenant_memberships_user ON user_tenant_memberships (user_id) WHERE status = 'active';
CREATE INDEX idx_user_tenant_memberships_tenant ON user_tenant_memberships (tenant_id) WHERE status = 'active';
CREATE INDEX idx_user_tenant_memberships_expiring ON user_tenant_memberships (expires_at) WHERE status = 'active' AND expires_at IS NOT NULL;
```

### 12.5 `privileged_access_grants` (JIT)

Per `30 §16.12`. Definováno tam; tato doc referuje.

### 12.6 `permission_audit_entries`

Per `30 §6.1` `audit_log_entries` s category='authz'. Tato doc nedefinuje separátní tabulku.

### 12.7 Vztahy

```
tenants (1)──(N) user_tenant_memberships
users (1)──(N) user_tenant_memberships
personas (1)──(N) user_tenant_memberships                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          [via persona_code]
custom_roles (1)──(N) user_tenant_memberships
personas (1)──(N) personas                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              [parent_persona_code hierarchy]
tenants (1)──(N) custom_roles
permission_definitions  →  referenced from  →  personas.permission_codes + custom_roles.permission_codes
```

---

## 13. Business rules

### RULE-RBAC-001: Default deny

New roles + new users start s zero permissions. Explicit grant required. Per `30 §RULE-SEC-047`.

### RULE-RBAC-002: Persona vs custom role

User has either persona OR custom role per tenant (not both). Custom role can mimic persona + customize.

### RULE-RBAC-003: Owner cannot revoke self

Tenant owner cannot revoke own ownership; transfer to another user required first.

### RULE-RBAC-004: Owner transfer requires owner

Only current owner triggers transfer. New owner accepts via email confirmation (anti-hijack).

### RULE-RBAC-005: At least one owner

Tenant must have exactly 1 active owner. Cannot delete or suspend last owner.

### RULE-RBAC-006: Permission check synchronous + auditable

Every permission check synchronous (no async lookup that may stall). Cached at session start. Re-evaluated on permission change events via SSE (per `27 §RULE-ADM-008`).

### RULE-RBAC-007: Backend re-validates always

Per `27 §RULE-ADM-004`. UI hiding button doesn't prevent API call from being forged. Backend authoritative.

### RULE-RBAC-008: Permission cached in JWT

Access token includes permissions claim (per `30 §5.6`). 15-min TTL. Permission changes propagate within TTL or via session.permission_updated SSE event.

### RULE-RBAC-009: Permission revocation immediate via SSE

On revocation: SSE event `permission.updated` pushed to active sessions of affected user. UI re-fetches permissions + re-renders. Affected actions become unavailable within seconds.

### RULE-RBAC-010: Audit every permission check failure

403 responses → audit log entry category='authz' outcome='denied'. Reason + user + resource captured.

### RULE-RBAC-011: ABAC policies blocking

Failed ABAC policy = 403 same as RBAC failure. Reason explicit in error.

### RULE-RBAC-012: Step-up MFA per ABAC

Some actions require step-up regardless of permission (per `30 §RULE-SEC-006`). Step-up token TTL 15 min.

### RULE-RBAC-013: Separation of duties patterns

Detected combinations:
- User who initiated workflow cannot approve own (orders > threshold, content publishing if approval required)
- Reviewer of fraud case cannot be customer service that touched the case
- Auditor (PERM-AUDIT-LOG-VIEW) cannot also be PERM-ADMIN-FULL (in same tenant; separation)

Soft enforcement: UI warns; hard enforcement: ABAC policy denies own-approval.

### RULE-RBAC-014: Custom roles cap

Max 20 active custom roles per tenant. Soft limit (warning at 15, hard at 20). Enterprise unlimited.

### RULE-RBAC-015: Custom roles can't exceed Owner

`custom_role.permission_codes ⊆ all_owner_permissions`. Reject creation if violates.

### RULE-RBAC-016: Platform-only permissions inaccessible to tenants

`PERM-PLATFORM-*` can't be assigned to merchant personas. Hard rule.

### RULE-RBAC-017: Persona migration on definition update

When platform updates persona definition (e.g., adds new permission): existing assignments auto-include new permission (since they assigned persona, not literal permissions). Tenant notified of diff.

### RULE-RBAC-018: Custom roles don't auto-include new perms

When new permission added to system: custom roles NOT automatically updated. Tenant reviews + opts-in per role (per `6.6`).

### RULE-RBAC-019: Persona deprecation grace

Deprecated persona: existing assignments work for 6 months. Tenant migrates to successor or custom role.

### RULE-RBAC-020: Multi-tenant permissions deterministic

User per tenant has exactly 1 persona OR 1 custom_role. Multiple memberships across tenants = multi-tenant; each tenant separate.

### RULE-RBAC-021: Agency mode users

`PERM-ADMIN-AGENCY-MODE` user can switch tenants via topbar. Audit log captures every tenant switch.

### RULE-RBAC-022: Pending invitations

User invited to tenant gets pending membership. Activates on email click + accept. Expires after 14 days.

### RULE-RBAC-023: Email-based invitation security

Invite link single-use, signed JWT, 14-day expiry. Re-invite possible after expiry.

### RULE-RBAC-024: Suspended user

Suspended membership: user cannot log into that tenant. Memberships in other tenants unaffected. Resume by admin.

### RULE-RBAC-025: Revoked membership data retention

Revoked: 30 days audit retention; then anonymized in tenant. User can re-invite (new membership row).

### RULE-RBAC-026: Customer ≠ merchant user

Customer accounts (storefront login) separate from merchant admin accounts. Same email allowed both — separate user entities (per `18`).

### RULE-RBAC-027: B2B company role hierarchy

B2B owner > admin > approver > purchaser > viewer. Higher includes lower permissions. Per `21`.

### RULE-RBAC-028: Marketplace seller scoping

Seller's user persona automatically scoped to own seller_id via ABAC (per `7.2.1`). Cross-seller access blocked.

### RULE-RBAC-029: JIT grant max duration

8 hours default cap. 24 hours with manager approval. > 24h requires DPO + security review.

### RULE-RBAC-030: JIT grant audit

Every action during JIT grant tagged with `jit_grant_id` in audit log. Post-grant report sent to grantee + approver.

### RULE-RBAC-031: Tenant-data access without consent prohibited

Platform staff can't access tenant production data without:
- Active SEV-1/2 incident on that tenant (auto-consent)
- OR explicit tenant consent (pre-hoc approval)
- OR DPO authorization (DSAR / legal obligation)

### RULE-RBAC-032: Impersonation audit

`PERM-CUSTOMER-IMPERSONATE` (admin views as customer) + `PERM-ADMIN-IMPERSONATE` (platform views as admin) — every action during impersonation prefixed audit entry "Impersonated by {actor}".

### RULE-RBAC-033: Service account separate from user

Service accounts (per `28 §4.1`) are non-human identities. Cannot have human-only permissions (e.g., `PERM-MERCHANT-OWNER-TRANSFER`). Restricted to API operations.

### RULE-RBAC-034: API token scope ≤ user permissions

Token issued by user has effective permissions = user permissions ∩ token scopes. Per `8.3`.

### RULE-RBAC-035: AI agent confirmation for write

`agent:*` write tools require user confirmation (per `30 §RULE-SEC-045`). Per call in agent UI.

### RULE-RBAC-036: Permission UI gating

Per `27 §RULE-ADM-003`. Buttons / menu items not rendered (vs disabled) when user lacks permission.

### RULE-RBAC-037: Permission discovery API

`GET /api/{date}/auth/me/permissions` returns user's effective permission codes. Used by UI for rendering decisions.

### RULE-RBAC-038: SSO group → persona mapping (Fáze 2)

SAML/OIDC SSO: groups from IdP claims mapped to Shopio personas via tenant config. Just-in-time provisioning per `30 §4.2.4`.

### RULE-RBAC-039: Permission category aggregation

UI shows permissions grouped by category for readability. Not flat list. Categories per `4.x` sections.

### RULE-RBAC-040: GDPR right to access permission

Customer's own data view via account self-service = `PERM-CUSTOMER-VIEW-OWN` (implicit; no explicit grant; per `18`). User-tenant memberships not customer-relevant.

### RULE-RBAC-041: Persona table per locale

Display names + descriptions localized (per `23-i18n.md`). Code immutable English.

### RULE-RBAC-042: Cross-region staff restriction

Platform staff can be regionally scoped (EU vs APAC team). EU staff can't access APAC tenants without JIT. Future regulatory compliance.

### RULE-RBAC-043: Auto-suspend on credential compromise

If user credentials compromised (per `30`): all memberships suspended; tenant admins notified.

### RULE-RBAC-044: Per-store role assignment (Fáze 2)

Custom role can be scoped to specific store(s) via ABAC `scope_store_ids`. Multi-store setups allow regional managers.

### RULE-RBAC-045: AI Act high-risk action requires human

`PERM-*` actions tagged `ai_act_tier='high'` cannot be performed by AI agents alone. Human user must initiate or confirm.

---

## 14. REST API endpoints

### 14.1 Permissions discovery (current user)

```
GET    /api/{date}/auth/me/permissions
GET    /api/{date}/auth/me/personas
GET    /api/{date}/auth/me/tenants                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  # for agency mode
POST   /api/{date}/auth/me/switch-tenant                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          # body: { tenant_id }
```

### 14.2 Personas catalog

```
GET    /api/{date}/personas                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              # browse
GET    /api/{date}/personas/{code}
GET    /api/{date}/personas/by-surface/{surface}
GET    /api/{date}/personas/{code}/permissions
```

### 14.3 Permissions catalog

```
GET    /api/{date}/permissions                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          # all
GET    /api/{date}/permissions/{code}
GET    /api/{date}/permissions/by-category/{category}
```

### 14.4 Team management

```
GET    /api/{date}/team/members
POST   /api/{date}/team/members:invite                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          # body: { email, persona_code OR custom_role_id, scope?, expires_at? }
POST   /api/{date}/team/members/{id}:resend-invite
GET    /api/{date}/team/members/{id}
PATCH  /api/{date}/team/members/{id}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                # change persona/role
POST   /api/{date}/team/members/{id}:suspend
POST   /api/{date}/team/members/{id}:reactivate
DELETE /api/{date}/team/members/{id}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  # revoke
POST   /api/{date}/team/owner-transfer:initiate                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          # body: { new_owner_user_id }
POST   /api/{date}/team/owner-transfer:accept
POST   /api/{date}/team/owner-transfer:cancel
```

### 14.5 Custom roles (Fáze 2)

```
GET    /api/{date}/team/custom-roles
POST   /api/{date}/team/custom-roles
GET    /api/{date}/team/custom-roles/{id}
PATCH  /api/{date}/team/custom-roles/{id}
DELETE /api/{date}/team/custom-roles/{id}
POST   /api/{date}/team/custom-roles/{id}:disable
POST   /api/{date}/team/custom-roles/{id}:enable
GET    /api/{date}/team/custom-roles/{id}/usage                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              # users assigned
```

### 14.6 JIT access

```
POST   /api/{date}/auth/privileged-access:request                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          # body: { tenant_id, reason, duration_hours, scope }
GET    /api/{date}/auth/privileged-access/grants
POST   /api/{date}/auth/privileged-access/grants/{id}:approve
POST   /api/{date}/auth/privileged-access/grants/{id}:reject
POST   /api/{date}/auth/privileged-access/grants/{id}:revoke
GET    /api/{date}/auth/privileged-access/active                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              # mine + others (admin)
```

### 14.7 Permission audit

```
GET    /api/{date}/security/audit-log?category=authz                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              # filter to authz events
GET    /api/{date}/security/audit-log/permission-denials                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          # denied actions
```

### 14.8 Example: Invite team member

```http
POST /api/2026-05-20/team/members:invite HTTP/1.1
Authorization: Bearer <admin>

{
  "email": "anna@example.com",
  "persona_code": "MERCHANT-CUSTOMER-SERVICE",
  "scope_store_ids": ["str_main"],
  "expires_at": null
}
```

```jsonc
HTTP/1.1 201 Created

{
  "data": {
    "membership_id": "utm_aB",
    "status": "pending_acceptance",
    "invite_email_sent": true,
    "expires_at": "2026-06-03T15:00:00Z"
  }
}
```

### 14.9 Example: Current user permissions

```http
GET /api/2026-05-20/auth/me/permissions HTTP/1.1
```

```jsonc
HTTP/1.1 200 OK

{
  "data": {
    "user_id": "usr_aB",
    "tenant_id": "tnt_xY",
    "persona_code": "MERCHANT-CUSTOMER-SERVICE",
    "custom_role_id": null,
    "permissions": [
      "PERM-ADMIN-ACCESS",
      "PERM-ORDER-VIEW",
      "PERM-ORDER-EDIT",
      "..."
    ],
    "scope_store_ids": ["str_main"],
    "assurance_level": "mfa_verified",
    "session_expires_at": "2026-05-20T16:00:00Z"
  }
}
```

### 14.10 Example: Switch tenant (agency)

```http
POST /api/2026-05-20/auth/me/switch-tenant HTTP/1.1
Authorization: Bearer <agency_user>

{
  "tenant_id": "tnt_acme"
}
```

```jsonc
HTTP/1.1 200 OK

{
  "data": {
    "tenant_id": "tnt_acme",
    "tenant_display_name": "Acme Pottery",
    "persona_code": "MERCHANT-ADMIN",
    "access_token": "sho_at_new...",
    "expires_in": 900
  }
}
```

### 14.11 Example: Request JIT access

```http
POST /api/2026-05-20/auth/privileged-access:request HTTP/1.1
Authorization: Bearer <platform_staff>

{
  "tenant_id": "tnt_aB",
  "reason": "Customer reported broken checkout; investigating",
  "duration_hours": 2,
  "scope": ["read_orders","read_customers","view_audit_log"]
}
```

```jsonc
HTTP/1.1 202 Accepted

{
  "data": {
    "grant_id": "jit_aB",
    "status": "pending_approval",
    "approver_kind": "manager",
    "tenant_notified": false,
    "auto_approve_eligible": false
  }
}
```

---

## 15. GraphQL schema

```graphql
type Persona {
  code: String!
  displayName: String!
  description: String
  surface: PersonaSurface!
  parentPersona: Persona
  permissionCodes: [String!]!
  isSystem: Boolean!
  isAssignable: Boolean!
  defaultForNewUsers: Boolean!
  version: Int!
}

enum PersonaSurface { STOREFRONT ADMIN PARTNER PLATFORM AGENCY MARKETPLACE MCP_API }

type PermissionDefinition {
  code: String!
  displayName: String!
  description: String
  category: String!
  resource: String!
  action: String!
  isSensitive: Boolean!
  aiActTier: AiActTier
  requiresMfa: Boolean!
  deprecated: Boolean!
}

enum AiActTier { MINIMAL LIMITED HIGH }

type CustomRole implements Node {
  id: ID!
  pubId: String!
  code: String!
  displayName: String!
  description: String
  permissionCodes: [String!]!
  abacScope: JSON
  status: CustomRoleStatus!
  usersAssignedCount: Int!
  createdAt: DateTime!
  updatedAt: DateTime!
}

enum CustomRoleStatus { ACTIVE DISABLED }

type TeamMember implements Node {
  id: ID!
  user: User!
  persona: Persona
  customRole: CustomRole
  scopeStoreIds: [ID!]
  scopeRegionCodes: [String!]
  status: MembershipStatus!
  invitedAt: DateTime
  acceptedAt: DateTime
  assignedBy: User
  revokedAt: DateTime
  expiresAt: DateTime
  effectivePermissions: [String!]!
}

enum MembershipStatus { ACTIVE SUSPENDED REVOKED PENDING_ACCEPTANCE }

type Me {
  user: User!
  tenant: Tenant
  persona: Persona
  customRole: CustomRole
  permissions: [String!]!
  scopeStoreIds: [ID!]
  scopeRegionCodes: [String!]
  assuranceLevel: AssuranceLevel!
  availableTenants: [TenantMembership!]!
}

type TenantMembership {
  tenant: Tenant!
  persona: Persona
  customRole: CustomRole
  status: MembershipStatus!
}

type PrivilegedAccessGrant implements Node {
  id: ID!
  requestedBy: User!
  targetTenant: Tenant!
  reason: String!
  durationHours: Int!
  scope: [String!]!
  status: PrivilegedAccessStatus!
  approvedBy: User
  approvedAt: DateTime
  expiresAt: DateTime
  revokedAt: DateTime
  tenantNotified: Boolean!
  autoApproveEligible: Boolean!
  createdAt: DateTime!
}

enum PrivilegedAccessStatus { PENDING_APPROVAL APPROVED REJECTED ACTIVE EXPIRED REVOKED }

extend type Query {
  me: Me!
  myPermissions: [String!]!
  myTenants: [TenantMembership!]!
  personas(surface: PersonaSurface): [Persona!]!
  persona(code: String!): Persona
  permissions(category: String): [PermissionDefinition!]!
  permission(code: String!): PermissionDefinition

  teamMembers(filter: TeamMemberFilter, first: Int, after: String): TeamMemberConnection! @auth(requires: PERM_ADMIN_TEAM_MANAGE)
  teamMember(id: ID!): TeamMember

  customRoles: [CustomRole!]! @auth(requires: PERM_ADMIN_TEAM_MANAGE)
  customRole(id: ID, code: String): CustomRole

  myPrivilegedAccessGrants: [PrivilegedAccessGrant!]!
  privilegedAccessGrants(filter: PrivilegedAccessGrantFilter): [PrivilegedAccessGrant!]! @auth(requires: PERM_PLATFORM_SECURITY_INVESTIGATE)
}

extend type Mutation {
  switchTenant(tenantId: ID!): AuthPayload!

  inviteTeamMember(input: InviteTeamMemberInput!): TeamMember! @auth(requires: PERM_ADMIN_TEAM_MANAGE)
  resendTeamInvite(membershipId: ID!): TeamMember! @auth(requires: PERM_ADMIN_TEAM_MANAGE)
  updateTeamMember(membershipId: ID!, input: UpdateTeamMemberInput!): TeamMember! @auth(requires: PERM_ADMIN_TEAM_MANAGE)
  suspendTeamMember(membershipId: ID!, reason: String!): TeamMember! @auth(requires: PERM_ADMIN_TEAM_MANAGE)
  reactivateTeamMember(membershipId: ID!): TeamMember! @auth(requires: PERM_ADMIN_TEAM_MANAGE)
  revokeTeamMember(membershipId: ID!, reason: String): DeletePayload! @auth(requires: PERM_ADMIN_TEAM_MANAGE)
  acceptTeamInvite(token: String!): TeamMember!

  initiateOwnerTransfer(newOwnerUserId: ID!): MutationPayload! @auth(requires: PERM_MERCHANT_OWNER_TRANSFER)
  acceptOwnerTransfer(token: String!): Tenant!
  cancelOwnerTransfer: MutationPayload! @auth(requires: PERM_MERCHANT_OWNER_TRANSFER)

  createCustomRole(input: CreateCustomRoleInput!): CustomRole! @auth(requires: PERM_ADMIN_TEAM_MANAGE)
  updateCustomRole(id: ID!, input: UpdateCustomRoleInput!): CustomRole! @auth(requires: PERM_ADMIN_TEAM_MANAGE)
  disableCustomRole(id: ID!): CustomRole! @auth(requires: PERM_ADMIN_TEAM_MANAGE)
  enableCustomRole(id: ID!): CustomRole! @auth(requires: PERM_ADMIN_TEAM_MANAGE)
  deleteCustomRole(id: ID!): DeletePayload! @auth(requires: PERM_ADMIN_TEAM_MANAGE)

  requestPrivilegedAccess(input: RequestPrivilegedAccessInput!): PrivilegedAccessGrant! @auth(requires: PERM_PLATFORM_LOGIN)
  approvePrivilegedAccess(id: ID!): PrivilegedAccessGrant!
  rejectPrivilegedAccess(id: ID!, reason: String!): PrivilegedAccessGrant!
  revokePrivilegedAccess(id: ID!): PrivilegedAccessGrant!
}
```

---

## 16. Events

| Build-spec ID | Wire | Payload |
|---|---|---|
| `EVENT-RBAC-MEMBERSHIP-INVITED` | `rbac.membership_invited` | `{ membership }` |
| `EVENT-RBAC-MEMBERSHIP-ACCEPTED` | `rbac.membership_accepted` | `{ membership }` |
| `EVENT-RBAC-MEMBERSHIP-SUSPENDED` | `rbac.membership_suspended` | `{ membership, reason }` |
| `EVENT-RBAC-MEMBERSHIP-REVOKED` | `rbac.membership_revoked` | `{ membership, reason }` |
| `EVENT-RBAC-PERSONA-CHANGED` | `rbac.persona_changed` | `{ user, tenant, old_persona, new_persona }` |
| `EVENT-RBAC-CUSTOM-ROLE-ASSIGNED` | `rbac.custom_role_assigned` | `{ user, tenant, role }` |
| `EVENT-RBAC-PERMISSION-UPDATED` | `rbac.permission_updated` | `{ user, tenant }` (consumed by SSE to active sessions) |
| `EVENT-RBAC-OWNER-TRANSFER-INITIATED` | `rbac.owner_transfer_initiated` | `{ tenant, current_owner, new_owner }` |
| `EVENT-RBAC-OWNER-TRANSFER-ACCEPTED` | `rbac.owner_transfer_accepted` | `{ tenant, old_owner, new_owner }` |
| `EVENT-RBAC-OWNER-TRANSFER-CANCELLED` | `rbac.owner_transfer_cancelled` | `{ tenant }` |
| `EVENT-RBAC-CUSTOM-ROLE-CREATED` | `rbac.custom_role_created` | `{ role }` |
| `EVENT-RBAC-CUSTOM-ROLE-UPDATED` | `rbac.custom_role_updated` | `{ role, changes }` |
| `EVENT-RBAC-CUSTOM-ROLE-DELETED` | `rbac.custom_role_deleted` | `{ role_id }` |
| `EVENT-RBAC-PERMISSION-DENIED` | `rbac.permission_denied` | `{ user, permission, resource, reason }` (sampled) |
| `EVENT-RBAC-PERSONA-DEFINITION-UPDATED` | `rbac.persona_definition_updated` | `{ persona, version, changes }` (platform-wide) |
| `EVENT-RBAC-PERMISSION-INTRODUCED` | `rbac.permission_introduced` | `{ permission, default_personas }` |
| `EVENT-RBAC-PERMISSION-DEPRECATED` | `rbac.permission_deprecated` | `{ permission, successor }` |
| `EVENT-RBAC-TENANT-SWITCHED` | `rbac.tenant_switched` | `{ user, from_tenant, to_tenant }` |
| `EVENT-RBAC-JIT-GRANT-REQUESTED` | `rbac.jit_grant_requested` | `{ grant }` |
| `EVENT-RBAC-JIT-GRANT-APPROVED` | `rbac.jit_grant_approved` | `{ grant, approver }` |
| `EVENT-RBAC-JIT-GRANT-REJECTED` | `rbac.jit_grant_rejected` | `{ grant, reason }` |
| `EVENT-RBAC-JIT-GRANT-EXPIRED` | `rbac.jit_grant_expired` | `{ grant }` |
| `EVENT-RBAC-JIT-GRANT-REVOKED` | `rbac.jit_grant_revoked` | `{ grant, revoker }` |
| `EVENT-RBAC-IMPERSONATION-STARTED` | `rbac.impersonation_started` | `{ actor, target }` |
| `EVENT-RBAC-IMPERSONATION-ENDED` | `rbac.impersonation_ended` | `{ actor, target, duration_seconds }` |
| `EVENT-RBAC-AGENCY-MODE-ACTIVATED` | `rbac.agency_mode_activated` | `{ user }` |

**Konzumenti:**
- Audit log (per `30 §8`) — every event mirrored
- Notification center — invites, persona changes
- SSE channel → active sessions (permission refresh)
- Email notifications (invites, owner transfer confirmation, JIT decisions)
- Security alerts (suspended user, denied permissions sampling)

---

## 17. Background jobs

| Job | Trigger | Queue | Frequency |
|---|---|---|---|
| `JOB-SEND-TEAM-INVITE-EMAIL` | EVENT-RBAC-MEMBERSHIP-INVITED | `notifications` | On-demand |
| `JOB-EXPIRE-PENDING-INVITES` | scheduled | `rbac` | Daily (14d expiry) |
| `JOB-SEND-OWNER-TRANSFER-EMAIL` | EVENT-RBAC-OWNER-TRANSFER-INITIATED | `notifications` | On-demand |
| `JOB-MIGRATE-PERSONA-DEFINITIONS` | EVENT-RBAC-PERSONA-DEFINITION-UPDATED | `rbac` | On-demand |
| `JOB-PROPAGATE-PERMISSION-CHANGE-SSE` | EVENT-RBAC-PERMISSION-UPDATED | `realtime` | On-demand |
| `JOB-EXPIRE-JIT-GRANTS` | scheduled | `rbac` | Every 5 min |
| `JOB-NOTIFY-JIT-DECISION` | EVENT-RBAC-JIT-GRANT-APPROVED / REJECTED | `notifications` | On-demand |
| `JOB-SEND-JIT-POST-GRANT-REPORT` | EVENT-RBAC-JIT-GRANT-EXPIRED | `notifications` | On-demand |
| `JOB-DETECT-PRIVILEGE-ESCALATION-ATTEMPTS` | scheduled | `security` | Every 5 min |
| `JOB-COMPUTE-PERSONA-USAGE-METRICS` | scheduled | `analytics` | Daily |
| `JOB-DETECT-UNUSED-CUSTOM-ROLES` | scheduled | `rbac` | Weekly |
| `JOB-PURGE-REVOKED-MEMBERSHIPS-AFTER-RETENTION` | scheduled | `gdpr` | Daily (30d) |
| `JOB-NOTIFY-PERMISSION-DEPRECATION` | EVENT-RBAC-PERMISSION-DEPRECATED | `notifications` | On-demand |
| `JOB-AUDIT-IMPERSONATION-ACTIVITY` | EVENT-RBAC-IMPERSONATION-ENDED | `audit` | On-demand |
| `JOB-RECONCILE-RLS-POLICIES` | scheduled | `rbac` | Weekly (sanity check) |

---

## 18. Testing

### 18.1 Unit

```
TEST-UNIT-RBAC-001  Permission code parser + category extraction
TEST-UNIT-RBAC-002  Persona → permissions resolution (incl. parent hierarchy)
TEST-UNIT-RBAC-003  Custom role + persona union check
TEST-UNIT-RBAC-004  ABAC policy evaluator (per rule)
TEST-UNIT-RBAC-005  JWT permission claim builder
TEST-UNIT-RBAC-006  Owner transfer state machine
TEST-UNIT-RBAC-007  Membership status transitions
TEST-UNIT-RBAC-008  JIT grant scope resolver
TEST-UNIT-RBAC-009  Separation-of-duties detector
TEST-UNIT-RBAC-010  Persona migration script (additive permissions)
```

### 18.2 Integration

```
TEST-INT-RBAC-001  Invite team member end-to-end
TEST-INT-RBAC-002  Persona change propagates via SSE within 1s
TEST-INT-RBAC-003  Permission denied 403 with audit log entry
TEST-INT-RBAC-004  ABAC step-up MFA enforces on high-value refund
TEST-INT-RBAC-005  RLS blocks cross-tenant queries from app
TEST-INT-RBAC-006  Platform staff JIT access workflow
TEST-INT-RBAC-007  Owner transfer accepts via email link
TEST-INT-RBAC-008  Cannot revoke last owner
TEST-INT-RBAC-009  Custom role permissions cannot exceed Owner
TEST-INT-RBAC-010  Agency mode tenant switching reloads permissions
TEST-INT-RBAC-011  Persona definition update propagates additive
TEST-INT-RBAC-012  New permission added — custom roles don't auto-include
TEST-INT-RBAC-013  Seller scoping via ABAC (own seller_id only)
TEST-INT-RBAC-014  B2B company member scoping
TEST-INT-RBAC-015  Customer self-data scoping
TEST-INT-RBAC-016  Impersonation audited per action
TEST-INT-RBAC-017  API token scope ≤ user permissions
TEST-INT-RBAC-018  Agent MCP write tool requires user confirmation
```

### 18.3 E2E

```
TEST-E2E-RBAC-001  Merchant owner invites + assigns roles
TEST-E2E-RBAC-002  Warehouse staff can't access pricing or finance
TEST-E2E-RBAC-003  Marketing manager publishes content, can't refund order
TEST-E2E-RBAC-004  Customer service refund > threshold triggers step-up MFA
TEST-E2E-RBAC-005  Agency admin switches tenants seamlessly
TEST-E2E-RBAC-006  Platform support requests + uses JIT access
TEST-E2E-RBAC-007  DPO accesses customer data with audit + reason
TEST-E2E-RBAC-008  Owner transfer end-to-end (initiate, accept, persona swap)
TEST-E2E-RBAC-009  Custom role creation + assignment (Fáze 2)
TEST-E2E-RBAC-010  Permission revocation kicks user out of restricted pages
```

### 18.4 Security (offensive)

```
TEST-SEC-RBAC-001  IDOR — user A tries to access user B's order via API
TEST-SEC-RBAC-002  Permission bypass attempt via token swap
TEST-SEC-RBAC-003  Cross-tenant read attempt via crafted query
TEST-SEC-RBAC-004  Privilege escalation via persona forgery
TEST-SEC-RBAC-005  ABAC bypass via header manipulation
TEST-SEC-RBAC-006  RLS bypass attempt (raw SQL via tool input)
TEST-SEC-RBAC-007  Impersonation without permission rejected
TEST-SEC-RBAC-008  Self-approval blocked (separation of duties)
TEST-SEC-RBAC-009  Stale JWT after permission revoked (within TTL window)
TEST-SEC-RBAC-010  JIT grant scope cannot be expanded post-approval
```

### 18.5 Compliance

```
TEST-COMPLY-RBAC-001  Audit log captures all permission denials
TEST-COMPLY-RBAC-002  GDPR DSAR — customer's data view scoped to self
TEST-COMPLY-RBAC-003  Platform staff data access requires JIT + audit
TEST-COMPLY-RBAC-004  DPO impersonation tagged in audit
TEST-COMPLY-RBAC-005  Tenant data residency respected per region scope
```

---

## 19. Implementation checklist

### Core
- [ ] **[S]** Drizzle schema `packages/db/src/schema/rbac/*.ts`
- [ ] **[S]** Migrace `20260616_001_create_rbac_tables.sql`
- [ ] **[M]** `@shopio/authz` package — permission catalog + persona definitions + check helpers
- [ ] **[M]** `PermissionCheckMiddleware` — REST + GraphQL + tRPC integration
- [ ] **[M]** `ABACPolicyEngine` — policy registration + evaluation
- [ ] **[M]** `PersonaResolver` — user → persona → permissions resolution with parent hierarchy
- [ ] **[M]** JWT permission claim builder
- [ ] **[M]** Permission update SSE propagation
- [ ] **[M]** RLS policy generator + per-table application (CI check)

### Personas + permissions catalog
- [ ] **[L]** Seed all default personas (40+ personas per §3)
- [ ] **[L]** Seed all permissions (~180 per §4)
- [ ] **[M]** Localization (display_name + description per locale)
- [ ] **[M]** Permission-to-scope mapping for OAuth (per `28`)

### Team management
- [ ] **[L]** Team management UI (settings → team)
- [ ] **[M]** Invitation flow (send + accept)
- [ ] **[M]** Owner transfer flow (two-step accept)
- [ ] **[S]** Custom roles UI (Fáze 2)
- [ ] **[M]** REST + GraphQL endpoints per §14, §15

### Agency mode
- [ ] **[M]** Multi-tenant membership data model
- [ ] **[M]** Tenant switcher (per `27 §RULE-ADM-010`)
- [ ] **[S]** Agency-level analytics (Fáze 3+)

### JIT access
- [ ] **[M]** JIT request flow + approval workflow
- [ ] **[M]** Time-bound grant tokens
- [ ] **[M]** Tenant notification logic (pre-hoc / post-hoc)
- [ ] **[S]** Auto-approve policy engine
- [ ] **[S]** Post-grant report generation

### ABAC
- [ ] **[L]** Policy library (~20 policies per `7.2`)
- [ ] **[M]** Policy hot-reload
- [ ] **[S]** Policy authoring UI (Fáze 3+; MVP: code-only)

### Background jobs
- [ ] Per §17

### Tests
- [ ] **[L]** Per §18

### Docs
- [ ] **[M]** "Permissions reference" (auto-generated from catalog)
- [ ] **[M]** "Personas guide" — which persona for which role
- [ ] **[M]** "Custom roles guide" (Fáze 2)
- [ ] **[M]** "Agency mode setup"
- [ ] **[M]** "Just-in-time access" (internal)
- [ ] **[M]** Migration guide for adding/removing permissions

---

## 20. Open questions

### Q-RBAC-001: Per-store role scope MVP vs Fáze 2
**Otázka:** Per-store ABAC scope — implementovat MVP nebo Fáze 2?

**Status:** Fáze 2. MVP: tenant-wide assignments. Per-store via custom roles + ABAC scope_store_ids Fáze 2.

### Q-RBAC-002: Owner = 1 vs multiple owners
**Otázka:** Allow multiple owners (per `RULE-RBAC-005` říká přesně 1)?

**Status:** MVP 1 owner per tenant (clear chain of authority). Co-owner concept Fáze 3+ if customer demand. "Admin with billing" satisfies most needs.

### Q-RBAC-003: SSO group mapping syntax
**Otázka:** Jak mapovat IdP groups na personas/custom roles?

**Status:** Per `30 §4.2.4`. JSON config per tenant: `{ "azure_group_id": "abc", "shopio_persona": "MERCHANT-MARKETING-MANAGER" }`. Fáze 2.

### Q-RBAC-004: Permission for AI-generated actions
**Otázka:** When AI Copilot drafts product description, kdo "owns" the action?

**Status:** Initiating user owns; AI is a tool. Audit log captures `initiated_by: usr_aB, ai_assisted: true, model: claude-sonnet-4-6`.

### Q-RBAC-005: B2B viewer cross-company isolation
**Otázka:** B2B viewer should see "company" catalog (custom prices) but not other companies'?

**Status:** Per `21`. ABAC + RLS scoped to `company_id`. Catalog price lists per company linked.

### Q-RBAC-006: Persona localized display
**Otázka:** Display "Customer Service" in EN but "Zákaznický servis" in CZ. Synced how?

**Status:** Per `RULE-RBAC-041`. i18n table mirrors `personas` with localized fields. Per `23`.

### Q-RBAC-007: Permission set for "everything except billing"
**Otázka:** Currently MERCHANT-ADMIN = "everything except billing + ownership transfer". Cleanly expressed?

**Status:** Negative-list approach (wildcard minus exclusions) works but error-prone. Future: positive enumeration with auto-update on new permissions.

### Q-RBAC-008: Bulk permission revocation on security incident
**Otázka:** Per `30`: incident → bulk revoke certain permissions across tenant?

**Status:** Yes. `JOB-BULK-REVOKE-PERMISSIONS` per incident. Surgical (specific permissions) vs sweeping (all custom roles disabled). Manual trigger.

### Q-RBAC-009: Custom role permission diff visualization
**Otázka:** When user changes custom role, show what they could vs couldn't before?

**Status:** Diff preview UI before apply. Fáze 2 with custom roles.

### Q-RBAC-010: ABAC policy testing tooling
**Otázka:** How to test ABAC policies before deploying?

**Status:** Policy simulator (Fáze 2): input scenario → policy decision + reasoning. Critical for compliance audits.

### Q-RBAC-011: External directory sync (Okta, Entra)
**Otázka:** Pull user list + group membership from IdP automatically?

**Status:** SCIM provisioning per `30 §4.2.4`. Fáze 2 enterprise.

### Q-RBAC-012: Time-bound assignments
**Otázka:** "Anna is admin only for Q4 2026" — supported?

**Status:** `expires_at` field on memberships per `12.4`. Implementation MVP. UI Fáze 2.

### Q-RBAC-013: Permission for outgoing communications
**Otázka:** Can marketing manager send email blast to all customers? Or needs Owner approval?

**Status:** `PERM-MARKETING-CAMPAIGN-SEND` separate from create. Threshold-based ABAC (>10k recipients → require approval).

### Q-RBAC-014: AI agent permission inheritance
**Otázka:** Agent inherits invoking user's permissions OR has fixed `agent:*` scope?

**Status:** Per `5.6` AI Copilot inherits user (read); MCP external agents use fixed `agent:*` scopes granted via OAuth. Two distinct models.

### Q-RBAC-015: Cross-tenant operations for agencies
**Otázka:** Bulk export across all agency tenants — single permission OR per-tenant aggregation?

**Status:** Fáze 3+. New permission `PERM-AGENCY-CROSS-TENANT-OPS` distinct from per-tenant ops.

---

## 📅 Změny

| Datum | Změna |
|---|---|
| 2026-05-20 | Initial — Personas & RBAC catalog. 40+ personas across 7 surfaces, ~180 permissions, persona→permission mappings, ABAC policy library (~20 policies), token scopes (per `28`), RLS policies, multi-tenant + agency mode, JIT access, custom roles (Fáze 2), 45 business rules, 25 events, 15 background jobs, ~120 test cases. |

---

**Konec Personas & RBAC.**

➡️ Pokračovat na: [`37-build-execution-plan.md`](37-build-execution-plan.md)








