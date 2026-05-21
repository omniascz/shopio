# 37 – BUILD EXECUTION PLAN

> **Doména:** Strategický + taktický execution plán pro Shopio. 6 fází (0 — Foundation, 1 — MVP, 2 — Growth, 3 — Scale, 4 — Maturity, 5 — Long-term). Solo founder + AI copilot execution model (per `01-decisions-registry.md`). Per fáze: goals, features delivered, milestones (technical + business + compliance), team additions, risks + mitigations. Go-to-market strategy, pricing tier rollout, marketing + sales motion, partnerships, hiring roadmap, funding considerations.

**Datum:** 2026-05-20
**Verze:** 1.0
**Status:** 🟡 DESIGN (continuously updated; spec for execution)
**Reference:** [00-MASTER-INDEX.md](00-MASTER-INDEX.md) · [01-decisions-registry.md](01-decisions-registry.md) · `todo.md` historical · vše domain doc 06-36

---

## 📑 Obsah

0. [Overview](#0-overview)
1. [Execution model: solo founder + AI](#1-execution-model-solo-founder--ai)
2. [Fáze 0 — Foundation (Q2 2026)](#2-fáze-0--foundation-q2-2026)
3. [Fáze 1 — MVP (Q3 2026 — Q1 2027)](#3-fáze-1--mvp-q3-2026--q1-2027)
4. [Fáze 2 — Growth (Q2 2027 — Q4 2027)](#4-fáze-2--growth-q2-2027--q4-2027)
5. [Fáze 3 — Scale (2028)](#5-fáze-3--scale-2028)
6. [Fáze 4 — Maturity (2029)](#6-fáze-4--maturity-2029)
7. [Fáze 5 — Long-term (2030+)](#7-fáze-5--long-term-2030)
8. [Go-to-market strategy](#8-go-to-market-strategy)
9. [Pricing rollout](#9-pricing-rollout)
10. [Sales motion](#10-sales-motion)
11. [Marketing milestones](#11-marketing-milestones)
12. [Partnerships](#12-partnerships)
13. [Hiring roadmap](#13-hiring-roadmap)
14. [Funding considerations](#14-funding-considerations)
15. [Risk register + mitigations](#15-risk-register--mitigations)
16. [KPIs + success metrics](#16-kpis--success-metrics)
17. [Decision log](#17-decision-log)
18. [Open questions](#18-open-questions)

---

## 0. Overview

### 0.1 Mission

Build EU-first, open-source-core e-commerce platform jako alternative ke Shopify pro malé a střední podniky, s důrazem na:
- EU compliance native (GDPR, EU AI Act, accounting integrations)
- Open source core (Apache 2.0) + commercial modules
- AI Copilot + hosted MCP server (klíčové differentiátory)
- EU data residency (Frankfurt + Paris)
- Czech-first + EU expansion (DE, SK, PL → broader EU)
- Solo founder + AI execution → lean ops, lifestyle-compatible operating model

### 0.2 5-year vision

End of 2030:
- 50k+ active merchants (free + paid mix)
- €15-30M ARR
- Team 12-20 people (intentionally small)
- Sustainable / profitable (no VC dependency for survival)
- Recognized EU alternative to Shopify in CZ/SK/PL/DE market
- Active plugin ecosystem (500+ apps)
- AI agent commerce category leader in EU
- ISO 27001 + SOC 2 Type II certified
- Profitable from year 2-3; growth-funded thereafter from cashflow OR strategic capital

### 0.3 Strategic principles

1. **Default Czech, then EU, then English-speaking global** — geographic discipline first 3 years
2. **Open core wins long term** — Apache 2.0 core + commercial modules; SDKs MIT; theme + plugin marketplaces open
3. **AI is differentiator, not feature** — every domain has AI-aware capability; MCP host first class
4. **Lifestyle scale ≠ ambition** — solo + AI for 18+ months; hire selectively; avoid headcount-driven valuation
5. **Quality over speed** — accept slower feature shipping for stability + EU compliance
6. **Customer = partner** — early customers become reference; agency partnerships scale reach
7. **Build vs buy** — build proprietary core; integrate everything else (Stripe Connect, KMS, observability stack)
8. **Documentation = product** — Shopio's docs need to be Stripe-tier; AI agents read it

### 0.4 Anti-goals

- VC-funded hypergrowth path (not desired this stage; preserves optionality)
- US enterprise sales motion (out of regional focus + ops complexity)
- Becoming "everything for everyone" too early
- Hiring before product-market fit clear

---

## 1. Execution model: solo founder + AI

### 1.1 Why solo + AI

Founder + Claude Code + commercial AI tooling (Anthropic Claude, GitHub Copilot, Cursor) jako extension týmu:
- 1 person decision speed
- AI handles boilerplate + code review + documentation + research
- No coordination overhead pre-product-market-fit
- Funds extend longer (no salary burn while shipping MVP)
- AI compounds capability — engineering productivity 3-5× vs solo dev pre-LLM era

### 1.2 Roles fulfilled by founder

- Product manager
- Lead engineer (full-stack TypeScript)
- DevOps / SRE (manual ops, automate incrementally)
- Designer (Figma + Storybook)
- Customer support (initial phase)
- Sales (founder-led close)
- Marketing (content + SEO)
- Finance + ops

### 1.3 AI tools in the loop

| Tool | Role |
|---|---|
| Claude Code | Implementation assist, refactoring, debugging |
| Claude (Anthropic API) | Long-form analysis, planning, doc generation |
| GitHub Copilot | Inline code completion |
| Cursor | IDE with AI native |
| ChatGPT (multimodal) | Image analysis, varied use cases |
| Notion AI / Linear AI | Project management |
| v0 / Lovable | UI prototype generation |
| MidJourney / DALL-E | Marketing imagery (with disclosure) |
| Anthropic Claude (deployed) | Production AI Copilot for Shopio itself |

### 1.4 First hire criteria

Hire when:
1. Recurring task takes > 8 hrs/week sustained
2. Specialized expertise needed > what AI provides (e.g., growth marketing, EU enterprise sales)
3. Customer-facing burden > founder bandwidth (technical support)
4. Revenue justifies (≥ €25k MRR before first hire ideally)

### 1.5 Founder time allocation

Per week guidance (40-50 hr):
- 50% engineering + AI orchestration
- 15% product + design decisions
- 10% customer support + sales
- 10% content + marketing
- 5% ops + admin
- 10% strategic thinking + planning

Czech labor culture compatible (no all-night startup grind expected).

### 1.6 Failure modes

- **Burnout** — strict working hours, weekly retros, mandatory time off
- **Decision fatigue** — pre-commit decisions in build spec (this document set), revisit at fáze boundaries
- **AI over-reliance** — every PR reviewed manually before merge; tests catch regressions
- **Isolation** — community engagement (Czech tech meetups, online), mentor + advisor relationships

---

## 2. Fáze 0 — Foundation (Q2 2026)

**Duration:** 8-12 weeks (April — June 2026)
**Goal:** Spec done + infrastructure scaffolded + first commits

### 2.1 Deliverables

#### Spec completion
- [x] Build spec (39 docs) — this repository
- [x] Decisions registry baseline
- [x] Tech stack finalized

#### Infrastructure foundations
- [ ] AWS account setup (eu-central-1 Frankfurt primary)
- [ ] Cloudflare account + DNS for shopio.com + subdomains
- [ ] GitHub organization + private monorepo
- [ ] CI/CD basic skeleton (GitHub Actions per `31 §5`)
- [ ] Anthropic + OpenAI API accounts (Tier 2+ Anthropic for production)
- [ ] Stripe Connect platform account (test mode initially)
- [ ] Email infrastructure (SendGrid / Postmark; EU residency)
- [ ] Sentry account
- [ ] Linear / Notion for project mgmt

#### Legal + compliance setup
- [ ] Czech s.r.o. company founded (if not already)
- [ ] DIČ + IČO registered
- [ ] EU OSS registration for digital products
- [ ] Privacy policy + ToS template drafted (legal review)
- [ ] DPA template for sub-processors
- [ ] Initial trademark check (Shopio brand)
- [ ] Bank account business
- [ ] Accountant engaged (CZ-local; Pohoda or iDoklad expertise)

#### Brand + identity
- [ ] Logo finalized (per `35 §2.1`)
- [ ] Brand guidelines doc
- [ ] Domain registrations (shopio.com, shopio.app, shopio.cloud, shopio.dev, shopio.cz)
- [ ] Email shopio.com / hello@ setup
- [ ] Marketing site mockup (Figma)

#### Codebase foundation
- [ ] Monorepo structure (pnpm workspaces + turbo)
- [ ] Shared packages skeleton (`@shopio/db`, `@shopio/ui`, `@shopio/sdk`, `@shopio/authz`, `@shopio/ai-core`)
- [ ] Drizzle base schema (tenants, users, sessions, audit_log_entries)
- [ ] Auth scaffolding (per `30 §4`)
- [ ] Local dev docker-compose

### 2.2 Success criteria

- [x] All 39 docs complete + cross-referenced
- [ ] First green CI build on `main`
- [ ] Local dev environment functional (per `31 §4.2`)
- [ ] Sentry receiving errors from dev
- [ ] Founder can articulate Shopio in 60 seconds to stranger
- [ ] First 5 design partners identified (CZ-based; signed LOI for free MVP access)

### 2.3 No revenue yet

This fáze is investment. Burn rate low (founder solo, ~€2-5k/month infra + tooling).

### 2.4 Risks

- **Scope creep on spec** — discipline: ship MVP small first, expand later
- **Solo motivation** — community + advisor + clear weekly goals
- **Tech stack regret** — major decisions in `01-DEC-*`; lock in; revisit only at fáze boundary

---

## 3. Fáze 1 — MVP (Q3 2026 — Q1 2027)

**Duration:** 6-9 months (July 2026 — March 2027)
**Goal:** Functional platform with first 50-100 paying merchants in CZ

### 3.1 Feature scope MVP

Implementation order (per priority + dependency):

#### Wave 1 (months 1-2 of MVP) — Core platform
- Tenants + auth (`30`, `36`)
- Storefront skeleton (`26`)
- Admin SPA (`27`)
- Products + variants + media (`06`)
- Categories (`07`)
- Inventory (`09`)
- Pricing (`10`)
- Cart (`11`)
- Checkout multi-step (`12`)
- Payments Stripe + GoPay + ComGate (`13`)
- Shipping Zásilkovna + ČP + PPL (`14`)
- Tax (CZ VAT) + ISDOC invoices (`15`)
- Orders + fulfillment (`16`)

#### Wave 2 (months 3-4) — Customer & marketing
- Customer accounts + passkey + MFA (`18`)
- Returns + refunds (`17`)
- Email transactional (`19` subset)
- Email marketing (`19`)
- Comparison shopping feeds Heuréka + Zboží.cz + Glami (`19`, `29`)
- GA4 + Meta CAPI (`29`)
- Search Meilisearch (`08`)
- CMS pages + blog (`32`)
- SEO basics (`19`)

#### Wave 3 (months 5-6) — Operations
- Themes + customizer (`26`)
- Multi-store (1-3 stores per tenant initial) (`22`)
- i18n CZ + SK + EN (`23`)
- Integrations Pohoda + iDoklad + Mailchimp + Ecomail (`29`)
- AI Copilot basic — content gen + SEO (`33`)
- Analytics basic (`20`)
- Industry profiles (Fashion, Food, Crafts, Electronics, B2B Industrial initial 5 of 15) (`34`)

#### Wave 4 (months 7-9) — Polish & launch
- B2B basic (companies + tax exempt + bulk pricing) (`21` subset)
- Subscriptions basic (recurring orders) (`24`)
- Status page + ops dashboards (`31`)
- Hosted MCP server + agent OAuth (`28`)
- Marketplace mode stub (Fáze 4+ activation; schema-ready)
- Marketing site live
- First 10 design partners onboarded
- Public launch

### 3.2 Compliance milestones

- [ ] GDPR DSAR + erasure functional (`18`, `30`)
- [ ] PCI SAQ A attestation (`13`, `30`)
- [ ] EU VAT MOSS / OSS registration if non-CZ EU sales
- [ ] ISDOC 6.0.1 invoice format verified by accountant
- [ ] Cookie consent + ePrivacy compliance (`18`, `19`)
- [ ] Imprint + ToS + Privacy on marketing site
- [ ] First DPA template signed with sub-processor (Stripe / AWS)

### 3.3 Operations milestones

- [ ] Production deployed eu-central-1
- [ ] Daily backups + restore tested monthly
- [ ] Cloudflare WAF + DDoS active
- [ ] Status page live (status.shopio.com)
- [ ] On-call alerts (PagerDuty solo)
- [ ] Sentry receiving prod errors with redaction

### 3.4 Hires (if any)

- **Month 7-9**: First hire if revenue justifies
  - Likely: Frontend engineer (full-stack TS) — to free founder for sales + customer
  - OR: Growth marketer (CZ-based; content + paid + partnerships)
- Hold off if revenue < €15k MRR

### 3.5 Success criteria

- [ ] 100+ merchants signed up (paying or trial)
- [ ] 20+ paying merchants on Growth / Scale plan
- [ ] €5-10k MRR
- [ ] Average uptime ≥ 99.5% over 30 days
- [ ] 0 SEV-1 incidents in launch month
- [ ] At least 5 active integrations (Pohoda + Heuréka + Zboží + Stripe + Mailchimp)
- [ ] AI Copilot used by ≥ 50% of paying merchants weekly

### 3.6 Risks

- **MVP scope too large** — cut ruthlessly per Wave 4 polishing; ship Wave 1-3 minimum
- **Pricing wrong** — Free tier easy to abuse; paid tier too cheap to sustain
- **Customer acquisition slow** — focus on agency partnerships + Czech ecommerce community + reference customers
- **AI provider cost overrun** — strict budgets per `33 §8`; Haiku-default routing
- **Support burden** — Slack community channel for design partners, deflects 1:1 questions

---

## 4. Fáze 2 — Growth (Q2 2027 — Q4 2027)

**Duration:** 6-9 months
**Goal:** 500-1000 paying merchants, EU geographic expansion (SK, PL, DE)

### 4.1 Feature additions

#### Platform expansion
- **B2B complete** (`21`) — quotes, POs, contracts, NET terms, approval workflows
- **Subscriptions complete** (`24`) — MRR/ARR, dunning, customer self-service
- **Marketplace mode** (`25`) — multi-vendor activation, Stripe Connect payouts, seller dashboards, KYC flow
- **Edge functions** (`28 §9`) — custom business logic
- **SSO (SAML + OIDC)** (`30`, `36`) — enterprise auth
- **Custom roles + ABAC scopes** (`36`)
- **A/B testing themes** (`26 §3.9`)
- **Customer chatbot** (`33`) — storefront RAG-powered
- **Visual search** (`33 §5.4`)

#### Integrations wave 2
- Money S3, ABRA FlexiBee, SAP B1 (basic)
- Mall.cz, Allegro
- Pinterest, Snapchat CAPI
- Klaviyo, Brevo, Smartemailing
- Zendesk, Intercom
- HubSpot
- DeepL + Google Translate
- Plausible Analytics

#### Industry profiles wave 2
- Health & Beauty, Books & Media, Furniture & Home, Jewelry & Watches, Wine & Spirits, Toys & Kids, Sports & Outdoor, Pet Supplies, Services & Bookings, Digital Products, Crafts & Handmade (remaining 10 of 15)

#### Compliance
- ISO 27001 certification audit (initiated Q2, awarded Q4)
- SOC 2 Type I
- DSA (Digital Services Act) compliance review
- NIS2 readiness assessment
- EU AI Act conformity check per use case
- Drata or Vanta engaged for compliance automation

### 4.2 Geographic expansion

- **Slovakia** — same language; reuse CZ + minor adjustments (Pohoda SK, ČP SK, currency EUR by default)
- **Poland** — local payment providers (Przelewy24, BLIK), Polish translations, Allegro integration
- **Germany** — German translations, local payment (SEPA + Klarna), DPD/DHL, complex VAT rules
- **Country site .pl / .de / .sk** (separate localized marketing)

### 4.3 Hires (3-5 people Q2-Q4)

- Senior backend engineer (TypeScript / Postgres / EU resident)
- Senior frontend engineer (Next.js + React)
- Growth marketer / customer success (full-time)
- Customer support specialist (CZ + EN + DE language)
- Sales engineer / partnership manager

Hire criteria per `1.4`. Total team ~5-7 by end Fáze 2.

### 4.4 Revenue milestones

- Q2 2027: €30k MRR
- Q3 2027: €70k MRR
- Q4 2027: €150k MRR (≈ €1.8M ARR run rate)
- First profitability quarter Q4 2027 (with hiring controlled)

### 4.5 Marketing scale

- Czech ecommerce conferences (sponsored)
- SK + PL launch press
- DACH market awareness (PR push)
- Content marketing: case studies + technical blog
- Agency partnerships formalized

### 4.6 Plugin marketplace launch

- 20+ third-party apps approved at launch
- 80/20 revenue share (per `28 §0.4`)
- Top vertical apps: ERP connectors, marketing tools, fulfillment

### 4.7 Success criteria

- [ ] 500-1000 paying merchants
- [ ] €150k MRR
- [ ] ISO 27001 certified
- [ ] SOC 2 Type I report
- [ ] 99.9% uptime SLA actually achieved
- [ ] 50+ apps in marketplace
- [ ] 5+ themes in theme marketplace
- [ ] 3+ EU countries actively served
- [ ] NPS ≥ 40 from merchants

### 4.8 Risks

- **Hiring quality** — slow hire, fire fast principle; trial periods
- **Multi-region complexity** — language QA, currency edge cases
- **Compliance cost overrun** — auditors charge premium; budget €50-80k Year 2 compliance
- **Plugin marketplace quality** — strict review prevents reputation damage
- **Founder bandwidth** — hire-to-relieve early signals of burnout

---

## 5. Fáze 3 — Scale (2028)

**Duration:** 12 months
**Goal:** 5000+ merchants, €5M+ ARR, SOC 2 Type II, EU recognition

### 5.1 Feature additions

#### Advanced platform
- **Pricing optimization AI** (`33`) — dynamic pricing suggestions
- **Smart inventory** (`33`) — AI-driven replenishment
- **Multi-warehouse + 3PL** integrations
- **POS app** (Fáze 3+ React Native) — physical retail clients
- **Mobile customer app** (white-label, Fáze 3+)
- **Marketplace facilitator tax** (US states; if needed)
- **Custom SAP / MS Dynamics integrations** — enterprise
- **Edge function language support** beyond TypeScript (WASM)

#### Compliance + certifications
- SOC 2 Type II awarded (audit period Q2-Q4 2028)
- NIS2 active compliance (Shopio "important entity" likely)
- DSA compliance (for marketplace mode)
- EU AI Act conformity for high-risk use cases (fraud, marketplace assessment)
- ENISA cyber assessment

#### Multi-region infra
- **DR Paris fully active-warm** (per `31`)
- **Multi-region per-tenant routing** (data residency per customer choice)
- **AWS GovCloud** consideration (if EU public sector demand)

### 5.2 Geographic expansion

- **Austria, Hungary, Slovenia, Romania, Bulgaria** — fuller CEE
- **UK** — Brexit-aware (post-EU but adjacent)
- **Benelux** — Netherlands first, Belgium second
- **Scandinavia** — Denmark / Sweden / Norway / Finland (alternative to local platforms like Voog)

### 5.3 Team growth

Hire 6-10 people Q1-Q4:
- Senior platform engineer × 2
- Frontend engineer × 2
- Data engineer (analytics + ML)
- ML / AI engineer
- DevOps / SRE
- Designer (full-time, replace founder design work)
- Sales / partnerships × 2 (DE, NL local)
- Customer success manager × 2
- Compliance officer (full-time for SOC 2 II + NIS2)

Total team end Fáze 3: ~15-20 people.

### 5.4 Revenue milestones

- Q1 2028: €250k MRR
- Q2: €400k MRR
- Q3: €600k MRR
- Q4: €1M MRR (€12M ARR run rate)

### 5.5 Funding decision point

Two paths:
- **Bootstrap continuation** — profitable Q4 2027 onward; scale from cashflow; preserves equity
- **Strategic capital** — €5-15M Series A; accelerate hiring + marketing; preserve EU independence (avoid US VC concentration)

Decision Q2 2028 based on:
- Market opportunity assessment
- Competitor moves (Shopify EU push, Magento decline, local players)
- Founder ambition + lifestyle preference

Default: bootstrap unless strategic value clear.

### 5.6 Success criteria

- [ ] 5,000-8,000 paying merchants
- [ ] €1M MRR
- [ ] SOC 2 Type II awarded
- [ ] NIS2 compliant
- [ ] 200+ apps in marketplace
- [ ] Active EU presence (8+ countries)
- [ ] Press recognition: "European Shopify"
- [ ] Profitable on cashflow basis (or unit economics positive if growing)

### 5.7 Risks

- **Shopify EU aggression** — competitive response; differentiate via EU compliance + AI
- **Hiring velocity** — quality > speed
- **Complexity ceiling** — adding features may slow iteration; periodic spec consolidation
- **Customer concentration** — diversify across verticals + countries
- **Regulatory shifts** — DSA + AI Act enforcement evolves; track + adapt

---

## 6. Fáze 4 — Maturity (2029)

**Duration:** 12 months
**Goal:** €25M ARR, mature ecosystem, optionality on exit/scale

### 6.1 Feature additions

- **Fine-tuned per-tenant AI models** (Fáze 4+ per `33`)
- **AI agent commerce maturity** — agent-driven shopping with full trust
- **Quantum-resistant crypto** preparation
- **Mobile apps** native iOS + Android (white-label per merchant + Shopio default)
- **Voice commerce** experiments
- **Carbon-aware ops** + emissions reporting
- **Multi-currency wallet** + Open Banking integrations
- **AR product try-on** (fashion + furniture)
- **Edge functions in multiple languages** (Rust, Python, Go via WASM)
- **Plugin marketplace v2** — featured + curated tiers

### 6.2 Geographic expansion

- **Iberian Peninsula** — Spain + Portugal
- **France** — challenging market; local competition; PrestaShop adjacency
- **Greece, Cyprus, Malta**
- **Selective ROW** — only via demand pull (existing customers expanding)

### 6.3 Team growth

Reach 25-40 people:
- More specialized engineering (security team, ML team, infra team)
- VP Engineering hire
- VP Sales / VP Marketing
- Country managers (DE, FR, ES dedicated leads)
- Partnerships director

### 6.4 Revenue + business

- €25-30M ARR
- Profitability or growth investment trade-off
- Possible secondary sale of founder equity (partial exit liquidity without selling company)
- M&A opportunities — selective tuck-in acquisitions (Czech competitor consolidation possible)

### 6.5 Risks

- **Founder fatigue** — second-in-command established; founder transitions to Chairman possible
- **Market saturation EU** — ROW expansion calls
- **Hyperscaler entry** — AWS / GCP retail solutions; differentiate via vertical focus + EU compliance

---

## 7. Fáze 5 — Long-term (2030+)

### 7.1 Vision options

| Path | Description |
|---|---|
| **Sustainable independent** | Cashflow-funded growth; €100M+ ARR possible by 2032; founder retains majority |
| **Strategic acquisition** | Sold to larger EU player (SAP, Visma) or US (Adobe, Salesforce) at €500M-1B+; founder exits |
| **IPO** | Public listing (Prague + Frankfurt dual); rare for EU SaaS but possible if scale + profitability |
| **PE-backed scale-up** | Private equity acquires; founder semi-retains; aggressive scale |
| **Cooperative / employee-owned** | Convert to cooperative; long-term sustainable |

Decision driven by:
- Founder preferences
- Market conditions
- Team aspirations
- Capital structure

### 7.2 Continuous improvements

- AI capability evolves; Shopio incorporates latest models
- EU regulatory landscape evolves; Shopio adapts
- New verticals; new geographies as opportunities arise
- Plugin ecosystem reaches 1000+ apps

### 7.3 Mission persistence

Regardless of corporate structure:
- EU-first identity preserved
- Open source core maintained
- AI agent commerce category leadership in EU
- Czech tech ecosystem contribution

---

## 8. Go-to-market strategy

### 8.1 ICP (Ideal Customer Profile)

#### Primary ICP (Fáze 1-2)
- Czech / Slovak small + mid-sized e-commerce business
- €100k - €5M annual revenue
- 5-50 employees
- Currently using: Shoptet (CZ leader), Eshop-rychle, Magento (legacy), WooCommerce
- Pain points: hidden fees, accounting integration gaps (especially Pohoda), no native AI, support quality
- Decision maker: founder/owner (not large IT team)

#### Secondary ICP (Fáze 2-3)
- DACH SMB e-commerce — DE-Mittelstand
- EU-wide B2B distributors needing modern catalog + ERP
- Marketplace operators wanting EU alternative to Shopify Plus

#### Tertiary (Fáze 3+)
- Enterprise (€10M+ revenue) — selectively
- Multi-store retail chains
- Service-based businesses with bookings

### 8.2 Positioning statements

#### Against Shopify
- "Shopify but EU-first" — data residency, GDPR-by-default, Czech accounting native, EU AI Act compliant, EU support hours
- Open source core (self-host if needed)

#### Against local CZ (Shoptet)
- "Shoptet feature-parity + AI Copilot + modern stack + lower fees"
- Better international + B2B + marketplace capabilities

#### Against WooCommerce / Magento
- "Modern alternative without the maintenance burden"
- AI-first vs plugin-cobbled

#### Against PrestaShop
- "EU-native but actually current technology"

### 8.3 Acquisition channels (priority order)

1. **Founder-led referrals** — early customer network
2. **Agency partnerships** — Czech digital agencies refer + service
3. **SEO content** — long-tail Czech e-commerce keywords
4. **Comparison shopping (we eat our own dog food)** — own Heuréka feed
5. **Czech tech community** — meetups, podcasts, open source
6. **Plugin developer ecosystem** — they bring their customer base
7. **Paid acquisition** (Fáze 2+) — Google Ads + Meta + LinkedIn limited
8. **Partner ecosystem** — Stripe, Anthropic, Cloudflare partner programs

### 8.4 Sales motion stages

- **Awareness** — content + community + ads
- **Interest** — webinar, demo video, free trial
- **Consideration** — sandbox + ROI calculator
- **Decision** — founder-led close OR self-serve checkout
- **Adoption** — onboarding wizard (per `27 §RULE-ADM-021`)
- **Expansion** — upgrade plan, add stores, add integrations
- **Advocacy** — case studies + referrals

### 8.5 Migration strategy

Critical pre-launch acquisition lever — make switching FROM competitor easy.

Migration tools:
- **Shoptet → Shopio** (CZ priority) — automated importer
- **Shopify → Shopio** — automated importer
- **WooCommerce → Shopio** — automated importer
- **Magento → Shopio** — assisted (more complex)
- **PrestaShop → Shopio** — automated importer

Founder-led migration assistance for first 50 customers (white-glove). Tooling matures from manual.

### 8.6 Free tier strategy

Per `1 DEC-PRICING-001` (placeholder):
- Free Starter — enough to legitimately start (no fake limits)
- 0.5% transaction fee (no monthly cost)
- All AI features but limited token budget
- Single store, EN/CS UI
- Community support

Free tier serves:
- Funnel for paid conversions
- Brand awareness
- Lower-end market access
- Reduces switching cost from competitors

### 8.7 Conversion to paid

Convert at:
- Volume threshold (e.g., €X monthly GMV)
- Feature needs (B2B, multi-store, custom domain)
- AI usage (token budget exhaustion → upgrade)
- Support needs (priority support paid)

---

## 9. Pricing rollout

### 9.1 Initial tiers (Fáze 1 launch)

Per existing `01 DEC-PRICING-*` (placeholder; to be locked at launch):

| Tier | Monthly | Transaction fee | AI tokens | Stores | Notes |
|---|---|---|---|---|---|
| **Free** | €0 | 0.5% | 50k Haiku-only | 1 | Forever-free starter |
| **Growth** | €29 | 0.3% | 1M | 2 | First serious tier |
| **Scale** | €99 | 0.1% | 10M | 5 | Pro features |
| **Pro** | €299 | 0% | 100M + overage | 25 | Heavy usage |
| **Enterprise** | Custom | Custom | BYOK | Unlimited | Custom |

### 9.2 Pricing evolution

- Fáze 1 launch: stable tiers
- Fáze 2 mid: introduce annual discount (10-15% off vs monthly)
- Fáze 2 end: introduce volume tiers (revenue-based pricing for high-GMV merchants)
- Fáze 3: tiered Enterprise (multiple Enterprise SKUs)
- Fáze 4: Plugin marketplace revenue share scaling (per `28 §0.4`)

### 9.3 Discounts + incentives

- **Annual plans**: 10-15% discount
- **Migration credits**: €100-500 for migrating from competitor
- **Agency rev share**: 20% for first year of customer
- **Non-profit / education**: 50% off

### 9.4 Price changes communication

- Grandfather existing customers 12 months on old pricing
- 60-day notice before changes
- Customer opt-out windows respected

---

## 10. Sales motion

### 10.1 Self-serve dominant (Fáze 1-2)

Most customers sign up + onboard themselves:
- Marketing site → free trial → onboarding wizard
- AI Copilot assists
- Knowledge base + community

No SDR / AE team needed initially.

### 10.2 Founder-led close (Fáze 1)

For:
- Top-tier (€500+ MRR) deals
- Enterprise inquiries
- Agency partnerships
- Migration help

Founder spends ~10 hrs/week on this.

### 10.3 Sales team (Fáze 2-3)

Hire Sales Engineer (Fáze 2) + AE / Partner Manager (Fáze 2-3):
- Outbound to identified mid-market accounts
- Inbound from larger trial conversions
- Land + expand within existing customers
- Agency partner cultivation

### 10.4 Enterprise sales (Fáze 3+)

Dedicated Enterprise AEs for:
- €50k+ ARR opportunities
- Government / regulated
- Multi-region / multi-tenant deployments
- Custom contract terms

### 10.5 Partner channel (Fáze 2+)

Czech + EU digital agencies become co-sellers:
- Tiered partner program (Bronze / Silver / Gold)
- Referral commissions (20% Year 1)
- Co-marketing
- Implementation services partners

---

## 11. Marketing milestones

### 11.1 Fáze 0 prep

- Brand identity locked
- Marketing site mockups
- Initial content calendar (10 pillar articles drafted)

### 11.2 Fáze 1 launch

- Marketing site live (CZ + EN)
- Launch on:
  - ProductHunt
  - Czech tech sites (Lupa.cz, Root.cz, Živě.cz)
  - r/ecommerce + r/czech subreddits
  - LinkedIn EU SaaS communities
- Founder-as-thought-leader content (blog + podcast appearances)
- First 10 case studies published

### 11.3 Fáze 2 expansion

- DE + PL + SK marketing sites
- Conference speaking (Czech eCommerce, dmexco, others)
- PR push (TechCrunch EU, Sifted, EU-Startups)
- Plugin marketplace launch announcement
- Plugin developer outreach
- Webinar series (monthly)
- Customer advisory board formed (10 merchants)

### 11.4 Fáze 3 thought leadership

- Annual conference (Shopio Connect — virtual + Prague in-person)
- Open source contributions visible (e.g., contribute to relevant OSS projects)
- Research publications (e.g., EU eCommerce trends report)
- ISO 27001 + SOC 2 announcement marketing

### 11.5 Fáze 4+ category leadership

- "AI agent commerce" thought leadership
- EU AI Act practitioner content
- M&A narrative if applicable

---

## 12. Partnerships

### 12.1 Technology partners

- **Anthropic** — Claude models partner; co-marketing AI agent commerce
- **Cloudflare** — CDN + WAF + Workers; case study material
- **Stripe** — Connect partner; payment + payouts
- **AWS** — startup credits; EU partner
- **GitHub** — Codespaces + Actions OSS partner
- **Cursor / Linear** — workflow tools featured customers

### 12.2 Integration partners (per `29`)

- **Pohoda (Stormware)** — official integration certification
- **iDoklad (Solitea)** — partner certified
- **Heuréka, Zboží, Glami** — featured integrations
- **Mailchimp, Klaviyo, Brevo** — partner directory listings

### 12.3 Agency partnerships

- Czech: top 10 digital agencies → cultivate as resellers + implementation partners
- DE: top SaaS implementation agencies
- EU multi-country: cross-border specialized agencies

### 12.4 Community partnerships

- Czech ecommerce associations (e.g., APEK)
- EU SMB associations
- Open source communities (Postgres, OpenTelemetry, Next.js)

---

## 13. Hiring roadmap

| Phase | Hires | Total team |
|---|---|---|
| Fáze 0 | Founder only | 1 |
| Fáze 1 (Q3 26 - Q1 27) | 0-1 (frontend OR growth) | 1-2 |
| Fáze 2 (Q2 27 - Q4 27) | 3-5 (engineering + growth + customer success) | 5-7 |
| Fáze 3 (2028) | 6-10 (engineering + sales + compliance + ML) | 12-17 |
| Fáze 4 (2029) | 10-15 (VPs + country managers + specialized) | 25-32 |
| Fáze 5 (2030+) | scale as needed; aim small | up to 50-100 |

### 13.1 Hiring principles

- **Remote-first** — anywhere in EU + time zone overlap
- **Async-first** — minimal mandatory meetings; documentation culture
- **Czech HQ** — Prague office space optional Fáze 3+; primarily distributed
- **No 996** — sustainable hours; respect Czech labor law
- **Generalists early, specialists later**
- **Trial period** — 3-month probation rigorously evaluated
- **Equity** — meaningful for early hires (no FAANG-equivalent salary expected)

### 13.2 Diversity + culture

- Diverse hiring (gender, background, life stage)
- Pro-parent culture (parental leave generous)
- No bro-culture (founder enforces)
- Mental health awareness (no toxic productivity)

### 13.3 Compensation

- Base salary at 70-80% of CZ market rate for early hires (compensated by meaningful equity)
- After Fáze 2-3: at-market or above
- Equity vesting: 4-year, 1-year cliff standard
- Bonus tied to company milestones, not individual quotas (except sales)

---

## 14. Funding considerations

### 14.1 Funding timeline options

#### Bootstrap path (preferred)
- Fáze 0-1: founder savings + revenue
- Fáze 2: cashflow from paying customers
- Fáze 3+: profitable; capital from cashflow + selective debt

Pro: equity preserved, optionality, no investor pressure
Con: slower growth, higher founder risk, potential market loss to better-funded competitors

#### Angel round (Fáze 1-2)
- €100-500k pre-seed
- Czech / EU angels (e.g., Credo Ventures, Reflex Capital networks)
- Stage Fáze 1 launch — optional safety net
- 10-15% dilution acceptable

#### Seed round (Fáze 2)
- €1-3M seed
- EU-focused VCs (e.g., Project A, Speedinvest, Visionaries Club)
- Trigger: clear PMF + €15-30k MRR + plans for hiring 5-10
- 15-20% dilution

#### Series A (Fáze 3)
- €5-15M
- Trigger: €1M+ MRR + clear path to €10M+
- Used for: hiring + geographic expansion + ML/AI investment
- 20-25% dilution

### 14.2 Strategic capital considerations

- Strategic investor (e.g., Anthropic, Stripe, AWS) over financial-only
- EU-investor preference (alignment on EU sovereignty)
- Reject toxic terms (heavy preferences, board control)
- Founder-friendly term sheets only

### 14.3 Burn discipline

- Always 12+ months runway
- Hiring controlled to revenue milestones
- Don't out-spend competitors; out-position them
- Tools + infra cost-controlled (AWS reservation, Anthropic batch API, etc.)

---

## 15. Risk register + mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | Founder burnout | M | H | Strict hours, advisor, hire early support, mental health resources |
| 2 | Shopify EU aggression | H | H | Differentiate via EU compliance + AI + open source; agility |
| 3 | Local competitor (Shoptet) defensive | M | M | Direct migration tools + better tech narrative |
| 4 | Tech stack regret (e.g., Fastify limitations) | L | M | Modular architecture allows partial replacement |
| 5 | AI provider cost explosion | M | H | Per-tenant budgets, BYOK Fáze 2, self-host option |
| 6 | EU AI Act enforcement disruption | M | H | Compliance-first design; consult specialists |
| 7 | Hiring quality issues | M | H | Trial period strict; advisor for senior hires |
| 8 | Customer acquisition slower than projected | M | H | Multiple channels diversified; agency partnerships |
| 9 | Funding market deterioration | M | M | Bootstrap path viable; profitability target Year 2 |
| 10 | Plugin marketplace doesn't grow | M | M | Strong launch partners, dev-experience focus |
| 11 | Compliance audit failure | L | H | Continuous compliance automation (Drata), regular internal audits |
| 12 | Security breach | L | C | Defense in depth per `30`, incident response drills |
| 13 | Major outage (SEV-1) | M | M | Multi-region DR, runbook discipline |
| 14 | Founder departure (illness) | L | C | Document all decisions (this spec!); advisor / cofounder plan B Fáze 2 |
| 15 | Czech labor law disputes | L | M | HR advisor; clear contracts |
| 16 | Currency volatility EU-CZ | M | L | Multi-currency revenue; hedge if needed Fáze 3 |
| 17 | Regulatory change (CZ accounting) | M | M | Active accountant relationship; adapt fast |
| 18 | Vendor failure (AWS / Anthropic) | L | H | Multi-vendor abstraction; fallback providers |
| 19 | Open source community fragmentation | L | M | Active engagement; sponsor relevant OSS |
| 20 | Reputation damage (security or content) | L | H | Strong incident response + comms playbook |

Legend: L=Low, M=Medium, H=High, C=Critical

---

## 16. KPIs + success metrics

### 16.1 Product

- Active merchants (MAU)
- Paying merchants
- Free → paid conversion rate
- Average revenue per merchant (ARPM)
- Customer churn (logo + revenue)
- NPS

### 16.2 Engineering

- Deployment frequency
- Lead time for changes
- Mean time to recovery (MTTR)
- SLO compliance (per `31 §9`)
- Bug escape rate

### 16.3 Business

- MRR + ARR
- Gross margin (target ≥ 75% Year 2+)
- CAC (customer acquisition cost)
- LTV / CAC ratio (target ≥ 3:1)
- Months to recover CAC (target ≤ 12)
- Burn rate
- Runway

### 16.4 Compliance + security

- 100% audit log retention
- 0 unaddressed critical vulnerabilities
- DSAR response time (target ≤ 7 days, max 30)
- GDPR breach response < 72h compliance rate
- Annual pen test findings remediated

### 16.5 Ecosystem

- Apps in marketplace
- Active app installations per merchant (target ≥ 3)
- Themes installed
- API requests / day
- MCP agents connected

### 16.6 Reporting cadence

- Weekly: engineering velocity, customer support ticket count
- Monthly: revenue + churn + NPS
- Quarterly: full business review (KPIs, OKRs, retro)
- Annually: strategic planning + board (if any)

---

## 17. Decision log

Major decisions tracked in `01-decisions-registry.md`. This section captures execution-level milestones decisions:

| Date | Decision | Reasoning |
|---|---|---|
| 2026-05-20 | Solo + AI execution Fáze 0-1 | Capital efficiency + flexibility |
| 2026-05-20 | EU-first (CZ → SK → DE → PL) | Regulatory clarity + market knowledge |
| 2026-05-20 | Apache 2.0 core + commercial modules | Aligns with open culture + sustainable business |
| 2026-05-20 | Anthropic primary + OpenAI fallback | Per `01 DEC-AI-001` |
| 2026-05-20 | AWS eu-central-1 primary | EU residency + mature managed services |
| 2026-05-20 | 80/20 plugin marketplace rev share | Developer-friendly per `28 §0.4` |
| 2026-05-20 | Bootstrap path preferred | Optionality + founder control |
| 2026-05-20 | Hosted MCP server free | Key differentiator + ecosystem builder |
| 2026-05-20 | Czech accounting integrations Day 1 | Local market entry necessity |
| 2026-05-20 | Lifestyle-compatible scale | No 996 / unicorn hyper-growth required |

---

## 18. Open questions

### Q-EXEC-001: Final pricing locking
**Otázka:** Pricing tiers locked when?

**Status:** Locked before Fáze 1 launch (Q3 2026). Per `01 DEC-PRICING-*` placeholder; finalize after benchmarking + customer interviews Fáze 0 end.

### Q-EXEC-002: Co-founder add
**Otázka:** Should add technical co-founder?

**Status:** Solo for Fáze 0-1. If clear gap (e.g., growth/sales) emerges + right person available, consider Fáze 2. Equity 10-20%. Default: no — hire executives later.

### Q-EXEC-003: First hire timing
**Otázka:** Hire before or after €25k MRR target?

**Status:** Bias toward "after"; exception if burnout signals OR specific gap (e.g., compliance review can't be founder).

### Q-EXEC-004: VC vs bootstrap
**Otázka:** When to take VC if at all?

**Status:** Bootstrap default. VC considered if Shopify EU push accelerates OR strategic value > dilution cost. Decision Q2 2028 typically.

### Q-EXEC-005: International expansion order
**Otázka:** DE first or PL first after CZ+SK?

**Status:** PL larger market, but DE higher ARPU. Likely PL Q2 2027 (easier infra + payment), DE Q3 2027 (more legal complexity).

### Q-EXEC-006: Enterprise focus timing
**Otázka:** Enterprise > €50k ARR deals — Fáze 2 or 3?

**Status:** Selectively Fáze 2 (referral-driven); systematic Fáze 3.

### Q-EXEC-007: M&A strategy
**Otázka:** Acquisitions to accelerate growth?

**Status:** Considered Fáze 3+. Czech competitor consolidation (Shoptet acquisition unlikely; smaller players possible). Tuck-in tech acquisitions (e.g., specialized integration company) more likely.

### Q-EXEC-008: AI agent commerce vision
**Otázka:** How aggressively bet on AI agent commerce as primary channel?

**Status:** Track + build infrastructure; don't bet farm. Optimistic ~10% of GMV via agents by 2028; could be much more if agents accelerate consumer adoption.

### Q-EXEC-009: Hardware + POS expansion
**Otázka:** POS terminals + physical retail features priority?

**Status:** Fáze 3+ secondary. SaaS-only Fáze 1-2.

### Q-EXEC-010: Exit considerations
**Otázka:** Build for exit or build for sustainable independence?

**Status:** Build for both — sustainable business that exits well IF founder chooses. Avoid optimizing only for exit (drives bad decisions).

### Q-EXEC-011: Open source maintainer commitments
**Otázka:** Engagement level with OSS communities?

**Status:** Contribute upstream pragmatically (Postgres, Next.js, OpenTelemetry); Shopio's own OSS responsibly maintained. Avoid being primary maintainer of unrelated OSS.

### Q-EXEC-012: Public visibility of founder
**Otázka:** Public-facing founder narrative — high or low?

**Status:** Moderate. Czech tech scene visibility helpful for talent + customers. Avoid celebrity-founder cult. Focus on product + customers in narrative.

### Q-EXEC-013: Beta vs production launch
**Otázka:** When does Fáze 1 transition from "beta" to "GA"?

**Status:** GA Q1 2027 once: SLA 99.5% achieved + 50+ paying customers + compliance + security baselines met.

### Q-EXEC-014: Lifestyle vs ambition trade-off
**Otázka:** Founder lifestyle compatibility with scaling demands?

**Status:** Foundational principle. Hire when needed; delegate; preserve evenings + weekends. Reject opportunities that require sustained crunch.

### Q-EXEC-015: Multi-region team timezone
**Otázka:** Hire only EU timezone or accept others?

**Status:** EU + adjacent (UK, Israel, North Africa) MVP. US time zone hires considered Fáze 3+ if US customer support need.

---

## 📅 Změny

| Datum | Změna |
|---|---|
| 2026-05-20 | Initial — Build Execution Plan. 6 fází (Foundation Q2 2026 → Long-term 2030+), solo founder + AI execution model, EU-first GTM (CZ → SK → PL → DE → broader EU), bootstrap-preferred funding path, hiring roadmap (1 → 50+), risk register (20 risks), KPIs catalog, partnerships strategy, marketing milestones, 15 open questions. |

---

**Konec Build Execution Plan.**

➡️ Pokračovat na: [`38-deployment-guide.md`](38-deployment-guide.md)
