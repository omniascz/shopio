# Jeden systém nebo dva? Strategické rozhodnutí pro SaaS + Open Source

> **Otázka:** Mám stavět **jednu codebase**, která se distribuuje jako SaaS i jako Open Source? Nebo **dva separátní systémy**?
> **Tohle je fundamentální rozhodnutí**, které ovlivní **10 let** vývoje, ekonomiky, týmu a produktu.
> **Datum:** duben 2026

---

## Obsah

1. [Shrnutí a doporučení](#1-shrnutí-a-doporučení)
2. [Tři možné modely – přehled](#2-tři-možné-modely--přehled)
3. [Model A: Dva systémy (fork strategy)](#3-model-a-dva-systémy-fork-strategy)
4. [Model B: Single codebase + open core](#4-model-b-single-codebase--open-core)
5. [Model C: Pure SaaS + otevřené SDKs](#5-model-c-pure-saas--otevřené-sdks)
6. [Jak to dělají ostatní – case studies](#6-jak-to-dělají-ostatní--case-studies)
7. [Technická analýza – co znamená "jedna codebase"](#7-technická-analýza--co-znamená-jedna-codebase)
8. [Ekonomika rozhodnutí](#8-ekonomika-rozhodnutí)
9. [Týmová struktura a kultura](#9-týmová-struktura-a-kultura)
10. [Časový horizont – krátko/středně/dlouhodobě](#10-časový-horizont--krátkostředndlouhodobě)
11. [Lock-in rizika a exit strategie](#11-lock-in-rizika-a-exit-strategie)
12. [Co se může pokazit](#12-co-se-může-pokazit)
13. [Doporučená architektura pro Model B](#13-doporučená-architektura-pro-model-b)
14. [Licenční strategie detail](#14-licenční-strategie-detail)
15. [Monetizační strategie](#15-monetizační-strategie)
16. [Rozhodovací framework](#16-rozhodovací-framework)
17. [Roadmap implementace](#17-roadmap-implementace)
18. [Klíčová rozhodnutí k validaci](#18-klíčová-rozhodnutí-k-validaci)
19. [Red flags – kdy model B/C NEBRAT](#19-red-flags--kdy-model-bc-nebrat)
20. [Závěr](#20-závěr)

---

## 1. Shrnutí a doporučení

### 1.1 TL;DR doporučení

**Dělej jednu codebase (monorepo) s architekturou Open Core:**

- **1 core platforma** – TypeScript, modulární
- **3 distribuční modely** z té samé codebase:
  1. **SaaS Cloud** (náš hlavní produkt, většina merchants)
  2. **Self-hosted Commercial** (enterprise s vlastním hostingem)
  3. **Open Source Community Edition** (free tier, komunita, ekosystém)
- **Commercial features** jako samostatné moduly (nejsou v CE)

Tohle je **Model B**. Je to **stejný model, co používá GitLab** (a úspěšně).

### 1.2 Proč NE dva systémy

**Nevolit Model A (dva systémy):**
- **2× vývojové náklady** (duplicate work)
- **Drift mezi verzemi** (features se rozcházejí)
- **Migrace mezi nimi obtížná** (merchants nemůžou přejít bez re-platform)
- **Rozdělený týmová struktura** (dva týmy = dvě kultury)
- **Dvojnásobná maintenance, testing, dokumentace**
- **Brand matoucí** (která je "ta pravá"?)
- **Nikdy nejde zpátky** (single codebase lze kdykoliv, opačně ne)

### 1.3 Proč NE pure closed SaaS

**Nevolit Model C (pure SaaS):**
- **Ztráta ekosystému** (WooCommerce/Magento komunita = 20+ let talent pool)
- **Data sovereignty concerns** (EU trend)
- **Enterprise vyžaduje self-host** (defense, healthcare, government)
- **Migration magnet** (open source merchants nemají kam jít)
- **Developer mindshare** (přitáhne talent)

### 1.4 Proč Model B je nejlepší

**Výhody Model B (single codebase + open core):**
- ✅ **Jeden codebase** = žádný drift, jedna pravda
- ✅ **Společný vývoj** = economies of scale
- ✅ **Seamless upgrade path** (CE → self-hosted Enterprise → SaaS)
- ✅ **Community contributions** rostou ekosystém
- ✅ **Developer talent** přitahuje modernost
- ✅ **Enterprise flexibility** (cloud/dedicated/self-host)
- ✅ **Monetizace je jasná** (CE free, commercial features paid)
- ✅ **Funguje prokazatelně** (GitLab, Mattermost, Sentry, PostHog)

### 1.5 Klíčové principy rozhodnutí

**5 principů, které určily doporučení:**

1. **Startup nemá kapacitu na 2 codebases**
2. **Merchants chtějí seamless upgrade path**
3. **Developers chtějí otevřenost**
4. **Enterprise chce kontrolu**
5. **Investoři chtějí jasný business model**

**Model B splňuje všech 5.**

---

## 2. Tři možné modely – přehled

### 2.1 Přehled modelů

| Model | Popis | Příklad známé firmy | Doporučení pro nás |
|---|---|---|---|
| **A: Dva systémy** | Separátní codebase pro SaaS a OS | **Shopware** (6.x cloud + self-hosted, ale stejná codebase!) | ❌ **NE** |
| **B: Open Core (single codebase)** | Jedna codebase, různé distribuce | **GitLab, Mattermost, Sentry, PostHog, Grafana** | ✅ **ANO** |
| **C: Pure SaaS + open SDKs** | Closed platform, open jen klienti | **Shopify, Stripe, Twilio** | ⚠️ Možné, ale ztratí ekosystem |

### 2.2 Detailní srovnání

| Kritérium | A (dva systémy) | B (open core) | C (pure SaaS) |
|---|---|---|---|
| **Vývojové náklady** | 🔴 2× | 🟢 1× | 🟢 1× |
| **Feature parity** | 🔴 nemožná | 🟢 automatická | N/A (jen 1 verze) |
| **Komunita** | 🟡 rozdělená | 🟢 silná | 🔴 žádná |
| **Enterprise adoption** | 🟢 flex | 🟢 flex | 🟡 omezená |
| **Lock-in rizika** | 🔴 vysoká | 🟢 nízká | 🔴 vysoká |
| **Data sovereignty** | 🟢 ano | 🟢 ano | 🔴 ne |
| **Time-to-market** | 🔴 pomalé | 🟡 střední | 🟢 rychlé |
| **Business model clarity** | 🔴 zmatek | 🟢 jasný | 🟢 jasný |
| **Maintenance** | 🔴 2× | 🟢 1× | 🟢 1× |
| **Ekosystem growth** | 🟡 střední | 🟢 rychlý | 🟡 pomalý |
| **Investor attraction** | 🔴 drahé | 🟢 proven model | 🟢 proven model |
| **Developer talent** | 🔴 rozptýlené | 🟢 unified | 🟡 limited |
| **Migrace mezi tiers** | 🔴 re-platform | 🟢 seamless | N/A |
| **EU compliance story** | 🟢 silná | 🟢 silná | 🔴 slabá |

**Model B vyhrává v 11 z 14 kategorií.**

### 2.3 Rozhodovací strom

```
Chceš build e-commerce platformu?
│
├── Jsi enterprise s unlimited budgetem?
│   └── ANO → Model A možný (Oracle, SAP style)
│       NE → Pokračuj
│
├── Máš zdroje na 2 teams + 2 codebases?
│   └── ANO → Model A možný, ale proč?
│       NE → Pokračuj (95 % startupů)
│
├── Chceš developer/komunity ekosystem?
│   └── ANO → Model B nebo C
│       NE → Model C
│
├── Chceš self-host option pro enterprise?
│   └── ANO → Model B
│       NE → Model C
│
└── → Model B
```

**Pro nás:** Chceme komunitu + enterprise = **Model B**.

---

## 3. Model A: Dva systémy (fork strategy)

### 3.1 Co to znamená

**Dvě oddělené codebases:**
- **Systém X (SaaS):** moderní, optimalizovaný pro cloud
- **Systém Y (Open Source):** tradiční, self-hosted

**Features se vyvíjejí nezávisle.**

### 3.2 Výhody Model A

✅ **Optimalizace per use-case**
- SaaS: multi-tenant, cloud-native, edge
- OS: self-contained, monolitický
- Každý může být **perfektně designovaný** pro svůj účel

✅ **Nezávislé verzování**
- SaaS continuous deployment
- OS tagged releases
- Merchants nemusí updatovat lockstep

✅ **Různé monetizace**
- OS = free + paid support
- SaaS = subscription
- Různé customer segments

### 3.3 Nevýhody Model A

🔴 **Dvojité vývojové náklady**
- Feature X ve SaaS musí být naimplementována v OS (a naopak)
- **2× engineering hours**
- **2× QA**
- **2× dokumentace**

**Konkrétní příklad:**
```
Rule Builder engine
├── SaaS verze: TypeScript, optimalizovaná pro cloud
└── OS verze: PHP, optimalizovaná pro self-host

=  2× code, 2× tests, 2× docs, 2× bugs, 2× maintenance
```

🔴 **Feature drift**
- Po 2-3 letech **SaaS a OS mají jiné features**
- SaaS má AI Copilot. OS nemá.
- OS má specifický hook. SaaS nemá.
- **Merchants zmatení** ("kterou verzi chci?")

🔴 **Migrace nemožná**
- Merchant na OS chce přejít na SaaS = **kompletní re-platforming**
- Custom code v OS nefunguje v SaaS
- **Ztracená data** nebo drahá migrace

🔴 **Double maintenance**
- Security patch v OS musí jít do SaaS
- Ale kódy jsou jiné
- **Duplicate work forever**

🔴 **Týmová frustrace**
- "My děláme SaaS, oni dělají legacy OS"
- Nebo naopak
- **Žádná týmová identita**

🔴 **Brand konfúze**
- Která je "ta pravá" platforma?
- Marketing musí propagovat obě
- Prospects jsou zmatení

### 3.4 Kdy Model A dává smysl

**Model A má smysl jen pokud:**
- **Máte $500M+ ARR** (můžete si dovolit 2 týmy)
- **Máte 2 různé cílové skupiny** s **radikálně** odlišnými potřebami
- **OS verze je marketing tool**, ne revenue generator
- **SaaS verze je primary business**, OS je "ohlávka" do ekosystému

**Konkrétní příklady, kdy to funguje:**
- **Elastic** (ElasticSearch OS + Elastic Cloud) – ale i oni mají problémy
- **MongoDB** (MongoDB CE + Atlas) – ale licence boje (SSPL)
- **Confluent** (Apache Kafka + Confluent Cloud)

### 3.5 Historie fork strategy v e-commerce

**Příklady z e-commerce světa:**

**Magento (před Adobe):**
- Magento CE (open source) + Magento EE (commercial)
- Po letech **feature drift**, EE stále vpředu
- Adobe acquisition = **kompletní shift**
- Dnes = Adobe Commerce (SaaS) + Magento Open Source (legacy)
- **Mess**

**Shopware:**
- **Jedna codebase** (CE + commercial features)
- Works better než Magento
- Model B, ne Model A

**WooCommerce:**
- **Jen open source** + paid extensions
- Funguje, ale WooCommerce nemá vlastní SaaS (Automattic to nezkusil pořádně)

### 3.6 Verdikt

**Pro nás Model A je špatná volba, protože:**
- Nejsme enterprise s nelimitovaným rozpočtem
- Chceme rychlý time-to-market
- Chceme ekosystem, ne dva ekosystémy
- Chceme seamless upgrade path pro merchants

---

## 4. Model B: Single codebase + open core

### 4.1 Co to znamená

**Jedna codebase, různé distribuce:**

```
Monorepo
├── /packages/
│   ├── core/           ← core commerce (MIT, open source)
│   ├── modules/        ← modules (mixed licensing)
│   │   ├── products/   ← MIT (open source)
│   │   ├── checkout/   ← MIT (open source)
│   │   ├── b2b/        ← Commercial
│   │   ├── ai-copilot/ ← Commercial
│   │   └── analytics/  ← Commercial
│   ├── sdk/            ← MIT (open source)
│   ├── storefront-starters/ ← MIT
│   └── admin/          ← mixed (open base + commercial widgets)
└── /distributions/
    ├── community-edition/  ← build config (only MIT modules)
    ├── enterprise/         ← build config (all modules)
    └── cloud/              ← build config + cloud-specific infra
```

**Builds:**
- **CE build:** jen MIT moduly, self-hostable, zdarma
- **Enterprise build:** všechny moduly, self-hostable, license fee
- **Cloud build:** všechny moduly + cloud infra + multi-tenancy

### 4.2 Výhody Model B

✅ **Jeden codebase**
- Feature napsaná jednou funguje všude
- **Žádný drift**
- **1× testing, dokumentace, vývoj**

✅ **Community growth**
- Open source magnet
- Stars, forks, contributions
- **Developer talent pool roste**
- GitHub presence = SEO + brand

✅ **Commercial features clear**
- B2B, AI, Enterprise analytics = **commercial modules**
- Jasná value prop pro paid tiers
- **Revenue stream jasný**

✅ **Seamless upgrade path**
- Merchant začne na CE (free)
- Přejde na Enterprise (self-hosted, paid)
- Přejde na Cloud (SaaS, paid)
- **Žádné re-platforming**

✅ **Data sovereignty story**
- Merchants **můžou self-host** pokud chtějí
- EU/government/healthcare **reassured**
- **Trust magnet**

✅ **Enterprise adoption**
- Velké firmy často chtějí on-premise
- Model B to umožňuje
- **Enterprise sales easier**

✅ **Funguje v praxi**
- GitLab: $5B valuation, publicly traded
- Mattermost: silný enterprise
- Sentry: ~$3B valuation
- PostHog: rychle rostoucí
- **Proven model**

### 4.3 Nevýhody Model B

🔴 **Composition complexity**
- **Jeden codebase** musí podporovat 3 distribuce
- Build configs různé
- **Tests per distribution**

🔴 **Commercial feature leak**
- Jak zajistit, že commercial features nejsou v CE buildu?
- **Build tooling** musí být robustní
- **License enforcement**

🔴 **Community balance**
- Jaké features dát do CE vs. commercial?
- **Too much v CE** = nulové revenue
- **Too little v CE** = komunita odejde

🔴 **Technical debt shared**
- CE a commercial sdílí kód
- Rychlé shipování pro commercial ovlivní CE quality
- **Test coverage** musí být vysoká

🔴 **Licencing complexity**
- Různé licence per modul
- Právní zázemí potřebné
- **Enforcement složitý**

### 4.4 Jak tohle řešit

**Technical:**
- **Monorepo** (Nx, Turborepo, Lerna)
- **Feature flags** pro conditional builds
- **Package-level licensing** (per-package LICENSE file)
- **Build-time enforcement** (CE build fails if commercial module imported)

**Product:**
- **CE = solid baseline** (co 80 % merchants potřebuje)
- **Commercial = differentiators** (B2B, AI, enterprise features)
- **Pravidlo:** Commercial feature musí být **clearly value-add**

**Legal:**
- **Dual licensing**: MIT for CE, commercial for Enterprise
- **CLA (Contributor License Agreement)** pro komunitu (aby commercial features byly legálně OK)
- **Clear boundaries** dokumentované

### 4.5 Modulární struktura per tier

**Community Edition (MIT):**
- Core commerce engine
- Products, categories, customers
- Orders, checkout
- Basic B2C features
- REST + GraphQL API
- Admin UI (base)
- Built-in payment gateway interfaces
- Storefront templates
- CLI tools
- SDKs

**Commercial Enterprise Edition (proprietary):**
- B2B Components (Shopware-style)
- AI Copilot (agentic commerce)
- Advanced analytics
- Multi-source inventory
- Advanced workflows
- SSO, audit logs
- Priority support
- SLA guarantees

**Cloud-only Features (SaaS-specific):**
- Multi-tenant infrastructure
- Auto-scaling
- Cloud observability
- Managed services
- Edge CDN
- Zero-downtime deploys

### 4.6 Historie úspěšných Model B

**GitLab:**
- **Unified codebase** (archivovali separate EE repo v 2025)
- CE features pomáhají komunitě
- EE features pay the bills
- **$5B+ market cap** (NASDAQ: GTLB)

**Sentry:**
- Sentry OSS (self-host) + Sentry Cloud (SaaS)
- Same codebase
- Cloud má paid features
- **$3B+ valuation**

**PostHog:**
- Open source analytics
- Cloud + self-host options
- **Hot start-up** 2023-2026

**Mattermost:**
- Open source Slack alternative
- Enterprise edition paid
- Successful in gov/defense sector

**Grafana:**
- Open source monitoring
- Grafana Cloud paid
- **$6B+ valuation**

**Supabase:**
- Open source Firebase alternative
- Supabase Cloud
- $2B+ valuation

**Vývoj ukazuje:** Model B je **dominantní trend** pro moderní dev-tools a SaaS.

---

## 5. Model C: Pure SaaS + otevřené SDKs

### 5.1 Co to znamená

**Closed SaaS platforma:**
- Backend = proprietary
- Frontend SDK = open source (MIT)
- Storefront starters = open source
- Core platform = **nelze self-host**

**Příklady:**
- **Shopify** (closed platform, Liquid + SDKs open)
- **Stripe** (closed, ale skvělé SDKs)
- **Twilio** (closed, open SDKs)
- **Vercel** (closed, Next.js open)

### 5.2 Výhody Model C

✅ **Maximum focus**
- Jeden deployment model
- Žádné "ale jak to funguje self-host?"
- **Rychlejší vývoj** features

✅ **Clear business model**
- SaaS subscription = jediný revenue
- **Investors pochopí**
- **Metriky jasné**

✅ **No open source baggage**
- Nemusíš řešit komunitu
- Nemusíš řešit contributions
- **Žádné security vulnerabilities** od community code

✅ **Full control**
- Platform evolution
- Breaking changes when needed
- **Rychlejší innovation**

### 5.3 Nevýhody Model C

🔴 **Žádný ekosystem magnet**
- Developers nemají důvod přispívat
- Komunita malá
- **Talent pool limited**

🔴 **Data sovereignty concerns**
- "Co když Shopify/my skončíme?"
- **Enterprise nervous**
- **EU regulátoři** nelibí

🔴 **No self-host option**
- **Ztrácíš enterprise** segment (gov, defense, healthcare)
- **Ztrácíš merchants** z open source platforms

🔴 **Lock-in narrative**
- "Další Shopify" není sexy
- **Existující Shopify dominuje** Model C segment

🔴 **Competition vs. Shopify**
- Shopify má 15 let advantage
- **Model C = přímý konkurenční boj**
- Model B = **differentiation**

### 5.4 Kdy Model C dává smysl

**Model C je dobrá volba pokud:**
- **Máte massive marketing budget** (compete with Shopify)
- **Cílíte čistě B2C SMB** (enterprise nepotřebujete)
- **Developer ekosystem není priorita**
- **Speed-to-market je top priorita**

### 5.5 Verdikt

**Model C by fungoval**, ale **Model B je lepší** pro naše cíle, protože:
- Chceme přilákat komunitu
- Chceme enterprise
- Chceme EU sovereignty story
- Chceme ekosystem magnet

**Model C je "bezpečná volba", Model B je "vítězná volba".**

---

## 6. Jak to dělají ostatní – case studies

### 6.1 GitLab – Model B gold standard

**Timeline:**
- 2011: Založen jako open source
- 2013: Začali SaaS (GitLab.com)
- 2015: Představili Enterprise Edition (EE) jako separátní repo
- **2025: Sjednotili do single codebase** – "GitLab now operates under a single codebase"

**Poučení:** **I GitLab (který měl 2 repos) přešel na single codebase.** Potvrzuje správnost Model B.

**Čísla:**
- **$5B+ market cap**
- **30M+ registered users**
- Veřejně obchodovaný (NASDAQ: GTLB)
- **Komunita + enterprise** = oba silné

**Jak to dělají:**
- Single repo
- **Feature flags** pro EE vs. CE
- **Tiered licensing** (Free, Premium, Ultimate)
- **SaaS.com + self-hosted**
- **Community contributions** welcomed

### 6.2 Mattermost – B2B Slack alternative

**Model:**
- Open source core (MIT)
- **Enterprise addons** (commercial)
- Self-hostable primary, SaaS secondary
- **Dominates gov/defense** (security conscious)

**Poučení:** Open source + enterprise = **specific segments love it**.

### 6.3 Sentry – Error tracking

**Model:**
- **Full open source** core
- Cloud SaaS primary revenue
- Self-hosted option (fewer features)

**Pivot 2019:** Changed license od BSD na **Business Source License** aby chránili před AWS.

**Poučení:** License ochrana důležitá.

### 6.4 Grafana – Monitoring

**Model:**
- **AGPL open source core**
- Grafana Cloud SaaS
- Enterprise plugins paid
- **$6B+ valuation**

**Poučení:** Model B funguje i s AGPL (copyleft).

### 6.5 MongoDB – Lekce z chyb

**Model:**
- Původně BSD open source
- 2018: Změnili na **SSPL** (kvůli AWS reselling)
- **Community backlash**

**Poučení:** License změny jsou **hazard**. Volit correctly hned.

### 6.6 Elastic – Další lekce

**Model:**
- Elasticsearch open source
- Elastic Cloud SaaS
- 2021: Změnili licenci (kvůli AWS)
- **Fork** – OpenSearch (AWS)

**Poučení:** Pokud je licence příliš permissive, AWS si to může vzít a resellovat. **Dual licensing** (MIT + commercial) = safer.

### 6.7 Shopify – Model C

**Model:**
- **Closed platform**
- Open SDKs (Hydrogen, Liquid)
- App Store
- **$150B+ market cap**

**Ale:** Shopify **nemá komunitní open source alternativu**. To je mezera, kterou využijeme.

### 6.8 Shopware – Model B v e-commerce

**Model:**
- Community Edition (open source, MIT)
- Commercial plans (Rise/Evolve/Beyond)
- **Self-hosted + Cloud**
- **Same codebase**
- **Fair Usage Policy 2025** (do 1M EUR GMV)

**Poučení:** Shopware dokazuje, že Model B **funguje v e-commerce**. Jejich slabina je jen CZ lokalizace – my to uděláme lépe.

### 6.9 WooCommerce – Hybrid

**Model:**
- **100 % open source**
- **Paid extensions**
- Self-hosted na WordPress
- WooCommerce Payments (SaaS)

**Poučení:** Plná openness může fungovat, ale **závislost na WordPressu** = limitation.

### 6.10 Summary case studies

| Firma | Model | Revenue | Komunita | Úspěch |
|---|---|---|---|---|
| **GitLab** | B | $700M+ | Obrovská | ✅ $5B+ cap |
| **Mattermost** | B | $50M+ | Silná | ✅ Profitable |
| **Sentry** | B | $200M+ | Silná | ✅ $3B+ val |
| **Grafana** | B | $300M+ | Obrovská | ✅ $6B+ val |
| **PostHog** | B | $30M+ | Rychle roste | ✅ Hot startup |
| **Supabase** | B | $40M+ | Silná | ✅ $2B+ val |
| **MongoDB** | B (komplex) | $1.9B | Silná | ✅ $25B+ val |
| **Shopware** | B | ~€100M | Středně | ✅ Profitable |
| **Shopify** | C | $7B | Slabší | ✅ $150B+ cap |
| **WooCommerce** | Hybrid | ~$200M | Obrovská | ✅ Dominant |

**Všechny úspěšné Model B firmy mají jedno společné: single codebase.**

---

## 7. Technická analýza – co znamená "jedna codebase"

### 7.1 Co to znamená v praxi

**Jedna codebase ≠ jedna aplikace.** Znamená to:
- **Jeden git repozitář** (monorepo)
- **Sdílené knihovny**
- **Modulární architektura**
- **Build konfigurace** per distribuce

### 7.2 Struktura monorepa

**Doporučená struktura:**

```
commerce-platform/
├── packages/
│   ├── core/                 ← MIT, open source
│   │   ├── commerce-engine/
│   │   ├── catalog/
│   │   ├── orders/
│   │   ├── customers/
│   │   └── checkout/
│   ├── enterprise/           ← Commercial
│   │   ├── b2b-components/
│   │   ├── ai-copilot/
│   │   ├── advanced-analytics/
│   │   ├── multi-source-inventory/
│   │   └── enterprise-sso/
│   ├── cloud/                ← Cloud-only
│   │   ├── multi-tenancy/
│   │   ├── auto-scaling/
│   │   └── managed-services/
│   ├── sdk/                  ← MIT
│   │   ├── js-sdk/
│   │   ├── python-sdk/
│   │   └── php-sdk/
│   └── storefront/           ← MIT
│       ├── nextjs-starter/
│       ├── nuxt-starter/
│       └── astro-starter/
├── apps/
│   ├── admin/                ← Base MIT + commercial widgets
│   ├── storefront-default/
│   └── cli/
├── distributions/
│   ├── community-edition/    ← Build config (MIT only)
│   │   └── build.config.ts
│   ├── enterprise/           ← Build config (all)
│   │   └── build.config.ts
│   └── cloud/                ← Build config + cloud infra
│       └── build.config.ts
├── infrastructure/           ← Cloud-only, proprietary
│   ├── terraform/
│   ├── kubernetes/
│   └── cloud-config/
├── docs/                     ← Public docs
└── tooling/
    ├── build/
    ├── testing/
    └── release/
```

### 7.3 Build tooling

**Nástroje:**
- **Monorepo:** Nx, Turborepo, Rush, Lerna
- **Package manager:** pnpm (best for monorepos), yarn berry
- **Bundler:** Vite, esbuild, Rolldown
- **CI/CD:** GitHub Actions / GitLab CI s path-based triggers

**Výhoda monorepa:**
- Change v core = auto triggers všech dependent packages
- Change v commercial modulu = triggers jen relevant
- **Selective builds** šetří CI time

### 7.4 Licensing v codebase

**Per-package licensing:**
- `packages/core/LICENSE` = MIT
- `packages/enterprise/b2b-components/LICENSE` = Commercial
- `packages/sdk/LICENSE` = MIT
- `packages/cloud/LICENSE` = Proprietary

**Root LICENSE.md:**
- Vysvětluje strukturu
- Odkazuje na per-package licenses
- **Clear rules**

### 7.5 Build-time enforcement

**Problém:** Zajistit, že CE build **neobsahuje** commercial code.

**Řešení:**

```typescript
// distributions/community-edition/build.config.ts
export default defineConfig({
  name: 'community-edition',
  include: [
    'packages/core/**',
    'packages/sdk/**',
    'packages/storefront/**',
    'apps/admin/base/**',
    'apps/storefront-default/**',
    'apps/cli/**',
  ],
  exclude: [
    'packages/enterprise/**',  // Commercial - EXCLUDED
    'packages/cloud/**',       // Cloud-only - EXCLUDED
    'infrastructure/**',       // Proprietary - EXCLUDED
  ],
  validate: (bundle) => {
    // CI step: check that no commercial code leaked
    if (bundle.includes('@commerce/enterprise')) {
      throw new Error('Commercial code in CE build!');
    }
  },
});
```

**CI step:**
```yaml
- name: Validate CE build
  run: |
    pnpm build:ce
    pnpm validate:ce-purity  # Fails if commercial deps
```

### 7.6 Feature flags vs. modular separation

**Dvě strategie:**

**Strategie A: Feature flags**
```typescript
if (ENTERPRISE_MODE) {
  enableB2BComponents();
}
```
- Jedna binarka, runtime check
- **Nevýhoda:** Commercial code v CE binárce
- **Nevýhoda:** Reverse engineering možné
- **Výhoda:** Snazší development

**Strategie B: Modular (recommended)**
```typescript
// Only loaded if enterprise package installed
import { B2BComponents } from '@commerce/enterprise-b2b';
```
- Separátní balíčky
- CE binárka neobsahuje commercial code
- **Výhoda:** Clear separation
- **Výhoda:** Legal clarity
- **Nevýhoda:** Složitější development

**Doporučení:** **Strategie B pro produktové features, Strategie A pro minor toggles.**

### 7.7 Deployment configs

**Community Edition deployment:**
- Docker Compose
- Single-node
- SQLite or PostgreSQL
- Nginx
- **Simple install**

**Enterprise self-hosted:**
- Kubernetes manifests
- Multi-node
- PostgreSQL cluster
- Redis cluster
- Elasticsearch
- **Production-grade**

**Cloud SaaS:**
- Multi-tenant k8s
- Cloud-specific infra (AWS/Azure/GCP)
- Auto-scaling groups
- Edge CDN (Cloudflare)
- Managed databases

### 7.8 Testing strategy

**Testing per distribution:**
- **Unit tests** shared (all distributions)
- **Integration tests** per distribution
- **E2E tests** per distribution
- **Smoke tests** před release

**CI matrix:**
```yaml
strategy:
  matrix:
    distribution: [ce, enterprise, cloud]
    node: [20, 22]
```

### 7.9 Release management

**Versioning:**
- **Semantic versioning**
- **Monorepo managed versions** (all packages synchronized nebo independent)
- **Community Edition releases** tagged na GitHubu
- **Enterprise releases** přes customer portal
- **Cloud** continuous deployment

**Release cadence:**
- **Cloud:** continuous (feature flags control rollout)
- **Enterprise:** monthly LTS releases
- **Community Edition:** aligned with Enterprise

### 7.10 Documentation strategy

**Single docs site** (jako GitLab):
- Tag sections per tier
- "Available in: CE / Enterprise / Cloud"
- Clear badges
- Searchable

---

## 8. Ekonomika rozhodnutí

### 8.1 Vývojové náklady srovnání (5 let)

**Odhad Team size per Model:**

| Fáze | Model A (dva systémy) | Model B (single) | Model C (pure SaaS) |
|---|---|---|---|
| Year 1 | 30 engineers | 20 engineers | 15 engineers |
| Year 2 | 50 | 35 | 25 |
| Year 3 | 80 | 55 | 40 |
| Year 4 | 120 | 80 | 60 |
| Year 5 | 180 | 120 | 90 |
| **Total headcount-years** | **460** | **310** | **230** |

**Cost assumption:** €100k/year per engineer (fully loaded, EU)

| Model | 5-year cost |
|---|---|
| A (dva systémy) | **€46M** |
| B (single codebase) | **€31M** |
| C (pure SaaS) | **€23M** |

**Model B ušetří €15M oproti Model A.** To je masivní.

### 8.2 Revenue potenciál

**Model A potenciál:**
- 2 produkty = 2 revenue streams
- Ale **rozdělený focus** může snížit velikost každého
- **Dvojnásobné marketing náklady**

**Model B potenciál:**
- **3 revenue streams:** CE license, Enterprise, Cloud subs
- Community = free marketing
- **Smaller team** = vyšší margin per employee

**Model C potenciál:**
- 1 revenue stream (SaaS subs)
- Ale **konkurence Shopify** tvrdá
- Menší upside pokud není enterprise

### 8.3 5-year revenue projekce

**Konservativní odhady:**

**Model A:**
- Year 3: €50M ARR (rozdělený)
- Year 5: €150M ARR

**Model B (naše volba):**
- Year 3: €75M ARR (unified platform, větší každý sales)
- Year 5: €300M ARR

**Model C:**
- Year 3: €40M ARR (menší TAM bez enterprise)
- Year 5: €150M ARR

**Model B má nejvyšší ROI.**

### 8.4 Fundraising implications

**Model A:**
- Need **$50-100M series A/B**
- Hard to justify 2 teams
- **Investors skeptical**

**Model B:**
- **$20-30M series A** stačí
- Proven model (GitLab, Sentry comps)
- **Easier fundraising**

**Model C:**
- **$15-25M series A**
- Competing with Shopify harder
- **Valuation lower**

### 8.5 Unit economics

**Per-merchant LTV srovnání:**

**Model A:**
- Merchant na OS = $500 LTV (support + addons)
- Merchant na SaaS = $5 000 LTV
- **Weighted average: $2 500**

**Model B:**
- Merchant na CE = $200 LTV (conversion path)
- Merchant na Enterprise self-host = $30 000 LTV
- Merchant na Cloud = $5 000 LTV
- **Weighted average: $4 000**
- **Migration path value** = upgrade from CE to paid

**Model C:**
- Merchant na SaaS = $5 000 LTV
- **Weighted average: $5 000**
- Ale **smaller top-of-funnel** bez CE

### 8.6 Exit scenarios

**Model A exit:**
- Harder to value (dva produkty)
- **Multiples lower**
- Potential acquirer confused

**Model B exit:**
- **Clear story** (GitLab model)
- **Higher multiples** (8-15× revenue)
- IPO-friendly

**Model C exit:**
- Like Shopify
- **Clear story**
- Multiples ok

### 8.7 Ekonomický závěr

**Model B vyhrává:**
- **Nejnižší development cost** (-€15M vs A)
- **Nejvyšší revenue potenciál** (triple stream)
- **Nejjednodušší fundraising** (proven model)
- **Nejlepší exit** potential

---

## 9. Týmová struktura a kultura

### 9.1 Model A – Rozdělený tým

**Struktura:**
- SaaS team (30+ lidí)
- Open Source team (15+ lidí)
- Shared infra team (10+ lidí)

**Problémy:**
- **"Us vs. them"** dynamika
- Rezouvroj mezi týmy
- Jiné priority
- Jiná culture
- **Duplicate learnings**

**Management nightmare:**
- 2 roadmaps
- 2 release cycles
- 2 support teams
- Coordination overhead

### 9.2 Model B – Unified tým

**Struktura:**
- Platform team (core, shared)
- Product teams (per feature area)
- Enterprise team (commercial modules)
- Cloud team (SaaS infra)

**Ale všichni ve stejném monorepu.**

**Kultura:**
- **Shared vision**
- **Shared codebase**
- **Cross-team collaboration** natural
- **Internal mobility** easy

**Management jednodušší:**
- 1 roadmap
- 1 release cycle
- 1 support team (s tiers)
- **Unified metrics**

### 9.3 Model C – SaaS tým

**Struktura:**
- Product teams
- Infrastructure team
- Growth team

**Jednoduché**, ale:
- **Malá open source presence**
- **Community management** minimal
- **Less ecosystem** investment

### 9.4 Hiring implications

**Model A:**
- Harder to hire (proč bych dělal na legacy OS?)
- **Split talent pool**

**Model B:**
- **Attractive to senior engineers** (unified, modern, impact)
- **Open source contributions** = recruitment magnet
- **Career growth** clear

**Model C:**
- Like other SaaS hiring
- Competing for same talent as Shopify

### 9.5 Kulturní implikace

**Model B kultura:**
- **"We build in the open"**
- **Transparent roadmap**
- **Community-first** mindset
- **Quality matters** (community sees code)
- **Documentation priority**

**Tohle je zdravá kultura pro startup.**

---

## 10. Časový horizont – krátko/středně/dlouhodobě

### 10.1 Krátkodobě (0-12 měsíců)

**Model A:**
- **Pomalý start** (2 codebases = 2× práce)
- Launch of both = 18+ months

**Model B:**
- **Moderate start** (design pro composability)
- Launch CE + Enterprise = **12-15 months**
- Launch Cloud = **15-18 months**

**Model C:**
- **Nejrychlejší launch** (single product)
- Launch = **9-12 months**

**Winner 0-12 months:** Model C
**Model B: solid second**

### 10.2 Střednědobě (1-3 roky)

**Model A:**
- **Drift problems** začínají
- Features se rozcházejí
- **Maintenance růst** drastic
- Merchants confused

**Model B:**
- **Community growth** accelerates
- **Ecosystem builds**
- **Enterprise sales** ramp
- **Cloud MRR** grows

**Model C:**
- **SaaS growth** continues
- Ale **no ecosystem effect**
- **Still competing** s Shopify

**Winner 1-3 years:** Model B (ecosystem compounding)

### 10.3 Dlouhodobě (3-10 let)

**Model A:**
- **Drift nepřekonatelný**
- Decision to merge (late, painful) or fork further
- **GitLab příklad**: merged after years of separation

**Model B:**
- **Ecosystem dominant**
- **Developer mindshare**
- **IPO-ready** (GitLab trajectory)
- **Multiple revenue streams** mature

**Model C:**
- Zralý SaaS business
- Ale **boundary s Shopify** je problém
- **Limited upside**

**Winner 3-10 years:** Model B (compounding advantages)

### 10.4 Total trajectory

```
Revenue
  |
  |                              Model B ****
  |                          ****
  |                      ****
  |                  ****
  |              ****      Model C ------
  |         *****         --------
  |     ****       -------
  |  ****    ------
  | ** ------
  |*-----
  |-----  Model A (slower, bounded)
  ........
  +-------------------------> Time (years)
  0    1    2    3    5    7   10
```

**Model B vyhrává v dlouhodobém horizontu.**

---

## 11. Lock-in rizika a exit strategie

### 11.1 Lock-in z pohledu merchantů

**Model A (dva systémy):**
- Merchant na OS nemůže na SaaS (re-platform)
- **Lock-in tam i zpátky**

**Model B:**
- CE → Enterprise self-hosted: **seamless**
- CE → Cloud: **seamless migration tool**
- Enterprise self-host → Cloud: **seamless**
- **Žádný lock-in** mezi našimi tiers
- Export dat out: **možný**

**Model C:**
- SaaS-only = merchant **závislý na nás**
- Export dat: snad ano
- **No self-host fallback**

**Model B má nejnižší lock-in** = **merchants důvěřují** víc.

### 11.2 Lock-in z pohledu business

**Model B exit:**
- Pokud platforma skončí, **CE zůstává** (komunita může forkovat)
- **Žádný apocalypse scenario**
- **Enterprise merchants safe**

**Model C risk:**
- Pokud skončíme, merchants **zničení**
- **Zero fallback**
- **Reputation damage** industry-wide

### 11.3 Open source fork rizika

**Pokud používáme MIT license:**
- **Někdo může forknout** (legálně)
- AWS/Azure/GCP může resellovat
- **MongoDB/Elastic problem**

**Mitigace:**
- **Dual licensing** (MIT pro use, commercial pro resell)
- **CLA** pro contributors
- **Trademark ochrana**
- **Fast innovation** (forks nemůžou dohonit)

**Alternatives:**
- **BUSL** (Business Source License) – restricted pro 3 roky, pak MIT
- **AGPL** – copyleft, viral clause

### 11.4 Doporučení licencing

**Pro core:** **Apache 2.0** nebo **MIT**
- Permissive
- Attract maximum developers
- **Risk AWS reselling** managed by commercial features

**Pro commercial modules:** **Proprietary**
- Clear IP
- Revenue protection

**Pro SDKs, starters:** **MIT**
- Maximum adoption
- Developer joy

---

## 12. Co se může pokazit

### 12.1 Model A risks

🔴 **Feature drift nepřekonatelný**
- Po 3 letech SaaS a OS jsou odlišné platformy
- Merchants confused
- Support nightmare

🔴 **Jedna verze opuštěna**
- Typically OS verze cannibalized
- Community feels betrayed
- **Magento 1 story**

🔴 **Budget crunch = kill one**
- V crisis = kterou verzi zabít?
- **Any choice = disappointment**

### 12.2 Model B risks

🟡 **License leak**
- Commercial code v CE build (bug)
- **Solution:** Strict build enforcement

🟡 **Community backlash** při license změnách
- MongoDB/Elastic learned hard way
- **Solution:** Clear rules from day 1, no mid-flight changes

🟡 **Commercial features insufficient**
- CE má příliš mnoho = zero revenue
- **Solution:** Product judgment

🟡 **Fork risk**
- Někdo forkne, AWS resellne
- **Solution:** Dual licensing, fast innovation

🟡 **Complexity**
- Monorepo musí být well-tooled
- **Solution:** Invest in tooling (Nx/Turbo)

### 12.3 Model C risks

🔴 **Shopify competition**
- They have 15-year lead
- **Hard to win B2C**

🔴 **Data sovereignty stigma**
- EU regulatory increasing
- **Merchants hesitant**

🔴 **No ecosystem**
- Developers won't contribute
- **Slower innovation**

🔴 **Single point of failure**
- If we die, merchants die
- **Enterprise scared**

### 12.4 General risks (all models)

🔴 **Competition intensifies**
- Shopify, Shopware reagují
- **Fast execution key**

🔴 **Market timing**
- Too early / too late
- **Validate early**

🔴 **Team burnout**
- Ambitious scope
- **Healthy pace**

---

## 13. Doporučená architektura pro Model B

### 13.1 High-level architektura

```
┌─────────────────────────────────────────────────────────┐
│                  MONOREPO (Git)                          │
│                                                          │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────┐ │
│  │  CORE (CE) │  │ ENTERPRISE │  │       CLOUD        │ │
│  │   (MIT)    │  │ (License)  │  │   (Proprietary)    │ │
│  └────────────┘  └────────────┘  └────────────────────┘ │
│       │               │                    │             │
│       └───────┬───────┘                    │             │
│               ▼                            │             │
│      ┌────────────────┐                    │             │
│      │   BUILD TOOLS  │                    │             │
│      │     (Nx/Turbo) │                    │             │
│      └────────────────┘                    │             │
│               │                            │             │
│       ┌───────┼────────────────────────────┘             │
│       ▼       ▼            ▼                             │
│  ┌────────┐ ┌──────────────┐ ┌───────────────────────┐  │
│  │   CE   │ │ SELF-HOSTED  │ │      CLOUD SaaS       │  │
│  │ Build  │ │  Enterprise  │ │  Multi-tenant build   │  │
│  │  (MIT) │ │    Build     │ │   + Cloud infra       │  │
│  └────────┘ └──────────────┘ └───────────────────────┘  │
│       │           │                   │                  │
│       ▼           ▼                   ▼                  │
│  GitHub Releases  Customer Portal  Live Production       │
│  (free download)  (license key)    (our servers)         │
└─────────────────────────────────────────────────────────┘
```

### 13.2 Technology stack

**Core platform:**
- **TypeScript** (primary language)
- **Node.js** runtime (Bun considered for 2027)
- **PostgreSQL** primary database
- **Redis** caching
- **GraphQL + REST APIs**

**Build & tooling:**
- **Nx** monorepo (or Turborepo)
- **pnpm** package manager
- **Vite** / esbuild bundler
- **TypeScript project references**

**Admin UI:**
- **React** + TypeScript
- **Shadcn/ui** components
- **TanStack Query + Router**

**Default storefront:**
- **Next.js 16** (or latest)
- **React Server Components**
- **Tailwind CSS**

**Infrastructure:**
- **Kubernetes** (cloud)
- **Docker** (self-host)
- **Terraform** (IaC)
- **GitHub Actions / GitLab CI**

### 13.3 Modulární struktura

**Každý modul je samostatný package:**

```
packages/core-commerce-engine/
├── package.json        ← license: MIT
├── src/
├── tests/
└── README.md

packages/enterprise-b2b-components/
├── package.json        ← license: Commercial
├── src/
├── tests/
└── README.md
```

**Dependencies mezi balíčky:**
- Core **nezávisí** na Enterprise
- Enterprise **může záviset** na Core
- Cloud **může záviset** na Enterprise + Core

**Enforcement:**
- **Nx enforced module boundaries**
- **ESLint rules** against wrong imports
- **Build fails** pokud dependency wrong direction

### 13.4 Per-tier features matrix

**Illustrative (ne final):**

| Feature | CE | Enterprise | Cloud |
|---|---|---|---|
| Core catalog | ✅ | ✅ | ✅ |
| Basic checkout | ✅ | ✅ | ✅ |
| Single-storefront | ✅ | ✅ | ✅ |
| Basic admin | ✅ | ✅ | ✅ |
| Basic REST/GraphQL API | ✅ | ✅ | ✅ |
| Default storefront template | ✅ | ✅ | ✅ |
| Basic B2B (guest checkout) | ✅ | ✅ | ✅ |
| Rule Builder basic | ✅ | ✅ | ✅ |
| Flow Builder basic | ✅ | ✅ | ✅ |
| Multi-language basic | ✅ | ✅ | ✅ |
| Multi-currency basic | ✅ | ✅ | ✅ |
| **B2B Components (full)** | ❌ | ✅ | ✅ |
| **AI Copilot** | ❌ | ✅ | ✅ |
| **Multi-Source Inventory** | ❌ | ✅ | ✅ |
| **Advanced analytics** | ❌ | ✅ | ✅ |
| **Enterprise SSO** | ❌ | ✅ | ✅ |
| **Agentic commerce** | ❌ | ✅ | ✅ |
| **Priority support** | ❌ | ✅ | ✅ |
| **SLA** | ❌ | ✅ | ✅ |
| **Multi-tenant infra** | N/A | N/A | ✅ |
| **Auto-scaling** | N/A | N/A | ✅ |
| **Managed updates** | N/A | N/A | ✅ |
| **Edge CDN** | N/A | N/A | ✅ |

### 13.5 Data migration path

**CE → Enterprise self-hosted:**
```bash
commerce migrate-license --tier=enterprise --key=xxx
```
- Aktivuje commercial modules
- **Žádná data migration** (same codebase)
- Downtime: <1 minuta

**Self-hosted → Cloud:**
```bash
commerce cloud-migrate --source=/self-host --target=cloud.commerce.eu
```
- Exportuje data
- Naimportuje do Cloudu
- DNS switch
- **Typical downtime:** 1-4 hours

**Cloud → Self-hosted (rare, but possible):**
- Data export
- Self-hosted install
- Data import
- **No lock-in**

### 13.6 Multi-tenancy approach

**Cloud tier používá:**
- **Shared infrastructure** for small merchants
- **Dedicated instances** for enterprise cloud
- **Isolation:** per-tenant databases, shared services

**Důvod:**
- **Small merchants** = economies of scale
- **Enterprise cloud** = isolation, compliance, performance

### 13.7 Observability

**Unified observability:**
- **Sentry** pro error tracking
- **Grafana Cloud** pro metrics
- **Tracing** (OpenTelemetry)
- **Logs aggregation**

**Self-hosted merchants** mohou opt-in (anonymized data).

---

## 14. Licenční strategie detail

### 14.1 Per-component licenses

**Core commerce engine:** **Apache 2.0**
- Permissive
- Patent grants
- **Best-in-class** pro enterprise adoption

**Why Apache 2.0 over MIT:**
- Explicit patent grant
- Attribution requirements
- **Enterprise-friendly**

**SDKs, starter templates:** **MIT**
- Maximum permissive
- Developer adoption

**Default storefront template:** **MIT**
- Merchants můžou use, modify, redistribute

**Commercial modules:** **Proprietary**
- License key required
- Clear TOS

**Cloud-specific code:** **Proprietary**
- Not distributed
- Internal only

### 14.2 Dual licensing strategy

**Core repo:**
- Available under **Apache 2.0** for most uses
- Available under **Commercial License** for entities that need:
  - Embed in proprietary product
  - No attribution
  - Custom support

**Like MongoDB did (before SSPL).**

### 14.3 Contributor License Agreement (CLA)

**All contributors sign CLA:**
- Grants us **rights to relicense**
- Necessary for commercial relationship
- **Industry standard**

**Tools:**
- **CLA Assistant** (GitHub integration)
- **DCO** (Developer Certificate of Origin) alternative

### 14.4 Trademark ochrana

**Register:**
- **"Commerce.eu"** (or our chosen name)
- **Logo**
- **"Commerce Cloud"**
- **"Commerce Enterprise"**

**Trademark policy:**
- Can use name for compatibility
- Cannot rebrand our product as your own
- **Prevents confusion**

### 14.5 AWS / Cloud reseller risk

**Scenario:** AWS takes our open source, sells it as "AWS Commerce."

**Mitigation:**
1. **Trademark ochrana** (they can't use our name)
2. **Commercial modules** = differentiation (they only have CE)
3. **Fast innovation** (they can't keep up)
4. **Community loyalty** (we're the real deal)
5. **Enterprise features in commercial only** (enterprise won't go to AWS)

**If worst case happens:**
- Consider license change to **BUSL** (Business Source License)
- **MongoDB, Elastic learned from this**

### 14.6 License enforcement

**Commercial modules:**
- **License key required**
- **Online activation** (or offline for air-gapped)
- **Auto-deactivation** on subscription end
- **Grace period** before hard-stop

**Tools:**
- **Custom license server**
- **Or**: CryptLex, Keygen (existing solutions)

---

## 15. Monetizační strategie

### 15.1 Three revenue streams

**Stream 1: SaaS Cloud (primary, 70% revenue)**
- Subscription model
- Tiers based on usage
- €0–€299/měsíc + enterprise custom

**Stream 2: Enterprise self-hosted (25% revenue)**
- Annual license fee
- €10 000–€100 000+/rok
- Support SLA included

**Stream 3: Services & commerce (5% revenue)**
- **Commerce marketplace** (extensions)
- **Professional services**
- **Training & certifications**
- **Premium support**

### 15.2 Pricing philosophy (re-stated)

**From previous strategy document:**
- **No transaction fees** ever
- **All features in all Cloud tiers**
- **Tiers scale by capacity** (orders, products, users)
- **Transparent pricing**

**Enterprise self-hosted:**
- **Price per instance** + per-user
- **Volume discounts**
- **Multi-year commits** discount

### 15.3 CE conversion funnel

**CE user journey:**
1. **Discovers** on GitHub (stars, community)
2. **Downloads** CE, installs
3. **Uses free** for hobby/start
4. **Grows** business
5. **Needs** enterprise features
6. **Upgrades** to Enterprise self-hosted or Cloud

**Conversion rate target:** **2-5 %** CE → paid (industry standard).

**Acquisition cost:** **Near zero** (organic).
**LTV impact:** **Massive** (CE = top of funnel).

### 15.4 Freemium dynamics

**CE = true free forever:**
- **No ads**
- **No limits** (hosting is your responsibility)
- **No forced upgrade** messages

**This builds trust.** Merchants know we're not predators.

**Monetization through:**
- **Value** (Enterprise features worth paying)
- **Convenience** (Cloud = less management)
- **Support** (Enterprise = SLA)

### 15.5 Marketplace revenue

**Extension marketplace:**
- **70/30 split** (developer/us) – same as Shopify
- **Or 80/20** for premium positioning

**Theme marketplace:**
- Similar splits

**Revenue from marketplace:**
- **Long-tail of merchants**
- **Not primary**, but compounds

### 15.6 Services revenue

**Professional services:**
- **Enterprise migrations**
- **Custom development**
- **Training**
- **Consulting**

**Typically 10-20 % of revenue** for hybrid companies.

### 15.7 Comparison to competitors

| Company | Primary revenue | Secondary |
|---|---|---|
| **Shopify** | SaaS subs (70%), payments (25%), apps (5%) |
| **Shopware** | Licenses (60%), services (30%), marketplace (10%) |
| **GitLab** | SaaS (50%), Enterprise self-host (40%), services (10%) |
| **Us (target)** | Cloud SaaS (70%), Enterprise (25%), marketplace+services (5%) |

### 15.8 Unit economics target

**Gross margin:**
- Cloud: **75-80 %** (SaaS standard)
- Enterprise: **80-85 %** (software licensing)
- Services: **40-50 %** (labor heavy)

**Blended:** **70-75 %** target.

**CAC:LTV:**
- Target: **1:5** (standard SaaS)
- CE top-of-funnel helps reduce CAC

**Payback period:**
- Target: **<12 months**

---

## 16. Rozhodovací framework

### 16.1 Decision matrix

**Validuj rozhodnutí podle těchto kritérií:**

| Kritérium | Váha | Model A score | Model B score | Model C score |
|---|---|---|---|---|
| Time to MVP | 10% | 3/10 | 7/10 | 9/10 |
| Development cost | 15% | 3/10 | 8/10 | 9/10 |
| Revenue potential | 20% | 6/10 | 9/10 | 7/10 |
| Market positioning | 15% | 5/10 | 9/10 | 6/10 |
| Community/ecosystem | 10% | 5/10 | 10/10 | 3/10 |
| Enterprise adoption | 10% | 8/10 | 9/10 | 5/10 |
| Team culture | 5% | 4/10 | 9/10 | 7/10 |
| Exit potential | 10% | 5/10 | 9/10 | 7/10 |
| Maintenance cost | 5% | 3/10 | 8/10 | 9/10 |

**Weighted scores:**
- Model A: **4.85/10**
- Model B: **8.65/10**
- Model C: **7.00/10**

**Model B wins by significant margin.**

### 16.2 Gut check otázky

**Ptejte se sebe:**

1. **Mám budget na 2 týmy × 5 let?**
   - Ne → Model B nebo C
   - Ano → Model A možný

2. **Chci enterprise adoption?**
   - Ano → Model B nebo A
   - Ne → Model C

3. **Chci komunitu?**
   - Ano → Model B
   - Ne → Model C

4. **Cítím, že EU sovereignty je competitive advantage?**
   - Ano → Model B
   - Ne → Model C

5. **Jsem přesvědčený o Model B proven track record?**
   - Ano (GitLab, Sentry, Grafana) → Model B
   - Pochyby → Model C (safer)

### 16.3 Validation experiments

**Než se commitnete, otestujte:**

**Experiment 1: Community willingness**
- Post na Hacker News "We're building this"
- **Sledujte upvotes, comments**
- **200+ upvotes** = healthy interest

**Experiment 2: Talent availability**
- Post job listing senior engineer
- **20+ qualified applicants** za měsíc = talent available
- **5 or less** = red flag

**Experiment 3: Merchant willingness**
- Talk to 20 potential customers
- **50+ % excited** = market demand
- **Less than 30 %** = pivot needed

**Experiment 4: Investor reception**
- 10 pitches to relevant investors
- **3+ term sheets** = fundable
- **Zero interest** = model problem

---

## 17. Roadmap implementace

### 17.1 Phase 0: Foundation (Month 0-3)

**Decisions:**
- ✅ Model B chosen
- ✅ Monorepo tooling (Nx selected)
- ✅ License strategy (Apache 2.0 + commercial)
- ✅ Technology stack (TypeScript, Node, PostgreSQL)
- ✅ Initial team (5 founders + 10 engineers)

**Outputs:**
- Project setup
- CI/CD foundation
- Dev environment
- **First public commit**

### 17.2 Phase 1: Core MVP (Month 3-9)

**Focus:** Build **core commerce engine** (CE-level features).

**Features:**
- Catalog management
- Order management
- Customer management
- Basic checkout
- Admin UI
- REST + GraphQL APIs
- Default storefront template
- CLI tools

**Distribution:**
- **GitHub** public release
- **Docker image**
- **Documentation**

**Community:**
- **Launch on HN/Reddit**
- **First 1000 stars target**
- **10 pilot merchants**

### 17.3 Phase 2: Commercial Enterprise (Month 9-15)

**Add commercial modules:**
- B2B Components
- AI Copilot
- Advanced analytics
- Multi-Source Inventory
- Enterprise SSO

**Enterprise offering:**
- **License portal**
- **Customer success team**
- **SLA**
- **Enterprise pricing**

**Pilot customers:**
- **5 enterprise pilots**
- **Case studies**

### 17.4 Phase 3: Cloud launch (Month 15-18)

**Cloud infrastructure:**
- Multi-tenant architecture
- Auto-scaling
- Cloud-specific features
- Pricing tiers

**Cloud offering:**
- **Free tier** (generous)
- **Starter, Growth, Scale** tiers
- **Migration tools** from CE

**Marketing:**
- **Public launch**
- **Press coverage**
- **Trade shows**

### 17.5 Phase 4: Scale (Year 2+)

**Expand:**
- **More countries** (localization)
- **More features** (agentic, sustainability, etc.)
- **More agency partners**
- **More developer community**

**Milestones:**
- **Year 2:** 10 000 merchants, €10M ARR
- **Year 3:** 50 000 merchants, €75M ARR
- **Year 5:** 500 000 merchants, €300M ARR

---

## 18. Klíčová rozhodnutí k validaci

### 18.1 Before committing

**Must validate:**

**1. Technical feasibility**
- **Build prototype** 1 měsíc
- Validate monorepo tooling
- Validate build separation (CE vs commercial)

**2. Market demand**
- **20 customer interviews**
- Validate pain points
- Validate willingness to pay

**3. Team capability**
- **Can we hire senior engineers?**
- **Do we have domain expertise?**
- **Is leadership aligned?**

**4. Funding availability**
- **Can we raise €5M seed?**
- **Is path to €30M series A realistic?**

**5. Legal structure**
- **Licensing advice** (open source lawyer)
- **Trademark registration**
- **Patent strategy**

### 18.2 Kill criteria

**Pokud kterékoliv z těchto, rethink:**

- **Nemůžeme najmout** 10+ senior engineers za 6 měsíců
- **Nemůžeme raise** €5M seed za 6 měsíců
- **Méně než 30 %** interviewed merchants zajímá
- **Neexistuje jasný** differentiator vs Shopify/Shopware
- **Legal/IP rizika** unmanageable

### 18.3 Green light criteria

**All must be true:**

- ✅ **10 senior engineers** committed to join
- ✅ **€5M seed** secured
- ✅ **50+ % merchants** excited about product
- ✅ **Clear differentiator** identified (per strategie dokument)
- ✅ **Legal structure** sound
- ✅ **Team aligned** on Model B
- ✅ **5-year plan** realistic

---

## 19. Red flags – kdy model B/C NEBRAT

### 19.1 Kdy Model B NEBRAT

**Model B nevolit pokud:**

🔴 **Nemáte kapacitu na community management**
- Open source vyžaduje engagement
- **Neaktivní komunita = mrtvý projekt**

🔴 **Nemáte budget na dual support** (CE + commercial)
- Komunita chce help
- Enterprise chce SLA
- **Both need resources**

🔴 **Security culture slabá**
- Open source = visible code
- Vulnerabilities exposed
- **Must be security-first**

🔴 **Documentation quality slabá**
- Open source vyžaduje great docs
- **Bez toho adoption neroste**

🔴 **Nejste připraveni být public**
- Roadmap public
- Code public
- Issues public
- **No hiding**

### 19.2 Kdy Model C volit místo B

**Model C má smysl pokud:**

- Cílíte čistě B2C SMB
- Nemáte expertise s open source
- Chcete maximum speed
- **Máte dobrý competitive advantage vs Shopify** (co?)

### 19.3 Kdy Model A volit

**Model A je legitimate pokud:**

- **Máte $50M+ series A** secured
- **Tradiční enterprise customers** (banks, gov, healthcare)
- **Radically different needs** SaaS vs OS
- **SAP/Oracle style** business

**99% startupů ne.**

---

## 20. Závěr

### 20.1 Doporučení

**Pro váš projekt: Model B (single codebase, open core).**

**Důvody:**
1. **Nejnižší vývojové náklady** (1 codebase)
2. **Nejvyšší revenue potenciál** (3 streams)
3. **Proven model** (GitLab, Sentry, Grafana)
4. **Community magnet** (ecosystem growth)
5. **EU sovereignty story** (differenciator)
6. **Enterprise flexibility** (self-host option)
7. **No lock-in** pro merchants (trust)
8. **IPO-ready** (clear story)

### 20.2 Klíčové principy implementace

**Pamatuj si:**

1. **Jedna codebase, multiple distributions**
2. **Apache 2.0 core, Proprietary commercial, MIT SDKs**
3. **CE jako top-of-funnel, Cloud jako primary revenue**
4. **Komunita = investice** (long-term payback)
5. **Build tooling first** (Nx/Turbo správně nastavený)
6. **Security culture** from day 1
7. **Documentation** paralelní k code
8. **Transparent roadmap**
9. **Dual licensing** for safety
10. **CLA** for contributors

### 20.3 Časová osa

**Ideal trajectory:**

- **Month 0-3:** Foundation, team, funding
- **Month 3-9:** Core MVP (CE public)
- **Month 9-15:** Enterprise modules
- **Month 15-18:** Cloud launch
- **Year 2:** Scale community + enterprise
- **Year 3-5:** Dominant in EU, expanding global
- **Year 5-7:** IPO consideration

### 20.4 Final thoughts

**Tato volba (Model B) je:**
- **Ambiciózní** (vyžaduje 5-7 let committed work)
- **Risky** (community dynamics nepředvídatelné)
- **Rewarding** (highest upside)
- **Meaningful** (EU sovereignty, developer community)

**Není to volba pro:**
- Quick flip
- Pasivní investory
- Lidi hledající "safe" bet

**Je to volba pro:**
- Builders
- Long-term thinkers
- Ti, kteří chtějí něco významného postavit

---

### 20.5 Klíčová tabulka pro rozhodnutí

| Aspekt | Model A | **Model B** | Model C |
|---|---|---|---|
| Rychlost launchu | 🔴 Pomalá | 🟡 Střední | 🟢 Rychlá |
| Vývojové náklady 5 let | 🔴 €46M | 🟢 €31M | 🟢 €23M |
| Revenue potenciál 5 let | 🟡 €150M | 🟢 €300M | 🟡 €150M |
| Komunita | 🟡 Rozdělená | 🟢 Silná | 🔴 Žádná |
| Enterprise | 🟢 Dobrá | 🟢 Excellent | 🟡 Limited |
| Maintenance | 🔴 2× | 🟢 1× | 🟢 1× |
| Exit potenciál | 🟡 Limited | 🟢 High (IPO) | 🟢 Standard SaaS |
| Proven model | 🟡 Rare success | 🟢 GitLab, Sentry | 🟢 Shopify, Stripe |
| EU sovereignty story | 🟢 Ano | 🟢 Ano | 🔴 Ne |
| Developer talent magnet | 🔴 Split | 🟢 Unified | 🟡 Standard |
| **OVERALL** | 🔴 **Nedoporučuju** | 🟢 **DOPORUČUJU** | 🟡 **Second choice** |

---

*Dokument vytvořen jako strategické rozhodnutí mezi single-codebase (Model B) vs dvěma systémy (Model A) vs pure SaaS (Model C) pro ultimátní e-commerce platformu. Analýza založená na case studies (GitLab, Sentry, Grafana, Shopware, Shopify) a ekonomické projekce. Duben 2026.*

MARKDOWN_EOF
wc -l /home/claude/arch/jeden-nebo-dva-systemy.md
echo "---"
ls -lh /home/claude/arch/jeden-nebo-dva-systemy.md