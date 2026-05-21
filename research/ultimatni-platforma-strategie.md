# Ultimátní e-commerce platforma – Strategický dokument konkurenční výhody

> **Cíl:** Vytvořit platformu, která kombinuje nejlepší z 8 analyzovaných (Shopify, Wix, Squarespace, BigCommerce, Ecwid, Shoptet, Upgates, Shopware) a přidá **future-proof features**, které konkurence nemá nebo teprve plánuje.
> **Horizont:** 2026–2030 (5 let)
> **Výchozí analýza:** 8 hloubkových dokumentů platform
> **Datum:** duben 2026

---

## Obsah

1. [Executive summary](#1-executive-summary)
2. [Gap analýza – co chybí všem 8 platformám](#2-gap-analýza--co-chybí-všem-8-platformám)
3. [Future trendy e-commerce 2026–2030](#3-future-trendy-e-commerce-20262030)
4. [Konkurenční výhody našeho systému – Core Pillars](#4-konkurenční-výhody-našeho-systému--core-pillars)
5. [Pilíř 1: Agent-native commerce (AI-first)](#5-pilíř-1-agent-native-commerce-ai-first)
6. [Pilíř 2: Unified B2B/B2C/D2C/C2C](#6-pilíř-2-unified-b2bb2cd2cc2c)
7. [Pilíř 3: Lokalizace na úrovni každého státu](#7-pilíř-3-lokalizace-na-úrovni-každého-státu)
8. [Pilíř 4: True Composable Architecture](#8-pilíř-4-true-composable-architecture)
9. [Pilíř 5: Sustainability & Regulatory Compliance](#9-pilíř-5-sustainability--regulatory-compliance)
10. [Pilíř 6: Data ownership a privacy](#10-pilíř-6-data-ownership-a-privacy)
11. [Pilíř 7: Unified Commerce (online + offline + social)](#11-pilíř-7-unified-commerce-online--offline--social)
12. [Pilíř 8: Real-time collaboration](#12-pilíř-8-real-time-collaboration)
13. [Pilíř 9: Predictive everything](#13-pilíř-9-predictive-everything)
14. [Pilíř 10: Ekosystem a marketplace features](#14-pilíř-10-ekosystem-a-marketplace-features)
15. [Cenová strategie](#15-cenová-strategie)
16. [Go-to-market strategy](#16-go-to-market-strategy)
17. [Konkurenční positioning](#17-konkurenční-positioning)
18. [Roadmap 2026–2030](#18-roadmap-20262030)
19. [Rizika a mitigation](#19-rizika-a-mitigation)
20. [Závěr a souhrn USP](#20-závěr-a-souhrn-usp)

---

## 1. Executive summary

### 1.1 Problém trhu

Po analýze 8 největších e-commerce platform je jasné, že **žádná z nich nepokrývá všechny potřeby komplexně**:

- **Shopify** – nejlepší ekosystém, ale drahé scaling, slabá lokalizace, nemá skutečné B2B základy
- **Wix / Squarespace** – krásný design, slabé e-commerce core, nevhodné pro vážný byznys
- **BigCommerce** – silný B2B, slabá UX, menší ekosystém
- **Ecwid** – skvělý embed, ale platforma jako celek slabá
- **Shoptet** – dominantní ČR, slabý globálně, doplňky navyšují TCO
- **Upgates** – kvalitní, malá komunita, placené API
- **Shopware** – best-in-class B2B, drahé, slabá CZ lokalizace, komplexní

**Klíčová mezera na trhu:**

> Neexistuje jediná platforma, která by byla **current-best pro lokální trhy (DACH, CEE, UK, Nordics), AI-native a agent-ready od prvního dne, s enterprise-grade B2B v ceně entry tarifu, true composable architekturou a radikálně férovým pricing modelem**.

### 1.2 Naše vize – "Ultimate Commerce Platform"

**Tagline:** _"Built for the agent-era. Localized for your country. Enterprise-ready from day one."_

**Core thesis:**

1. **Agent-first** – první platforma navržená od základu pro AI agent éru (2026+)
2. **Radikální lokalizace** – nativní integrace v 30+ zemích (ne "přes pluginy")
3. **B2B/B2C/D2C/C2C unified** – všechny modely v jednom bez upgradu
4. **True composable** – skutečná MACH s nízkou vstupní barierou
5. **Férový pricing** – transparentní, predikovatelný, bez transaction fees
6. **Privacy-first** – EU-compliant from day zero, zero-party data ownership

### 1.3 Target market

**Primární:**

- **Mid-market obchody** (€500k–€50M GMV)
- **B2B manufacturers a velkoobchody**
- **D2C brands** s globálními ambicemi
- **Omnichannel retailers** (online + retail)

**Sekundární:**

- **SMB s ambicemi růstu** (nechtějí migrovat platformu každé 2 roky)
- **Enterprise replatforming** (z Magento 1, Shopware 5, legacy systémů)

**Geografické:**

- **Primární:** CEE (ČR, SK, PL, HU), DACH (DE, AT, CH)
- **Sekundární:** Nordics, Benelux, UK, Ireland
- **Rozšíření:** Balkán, Pobaltí, Iberia (2028+)

---

## 2. Gap analýza – co chybí všem 8 platformám

Detailní rozbor mezer v jednotlivých oblastech, které **žádná platforma neuspokojivě neřeší**:

### 2.1 Agent-native architecture ⚠️ KRITICKÉ

**Status trhu (duben 2026):**

- Shopify, Shopware, BigCommerce pracují na agentic commerce (early stage)
- **Žádná platforma** nemá production-ready AI agent infrastructure
- **90 % B2B nákupů bude AI-agent-intermediated do 2028** (Forrester)
- $20.9B retail spend v 2026 přes AI platformy (eMarketer)
- **MCP, A2A, UCP protokoly** – rané fáze adopce

**Co chybí:**

- ❌ **Native MCP (Model Context Protocol)** server in-box
- ❌ **Agent-readable product schemas** (strukturovaná data pro LLMs)
- ❌ **Agent authentication** a authorization flows
- ❌ **Agent-to-agent (A2A) messaging** pro negotiation
- ❌ **Agent commerce analytics** (tracking AI-sourced traffic)
- ❌ **Agent-specific checkout** (bez friction pro authenticated agents)
- ❌ **AEO (Answer Engine Optimization)** tools
- ❌ **ACO (Agentic Commerce Optimization)** infrastructure

**Opportunity:**

> **Být první platformou s truly agent-native architekturou.** Konkurence se tomu bude přizpůsobovat 2–3 roky. Náš okno: 2026–2028.

### 2.2 Lokalizace napříč Evropou

**Status trhu:**

- Shoptet/Upgates – výborná CZ/SK lokalizace, slabé globálně
- Shopify Markets – dobré, ale povrchní v CEE
- Shopware – dobré DACH, slabé CEE

**Co chybí kdekoli:**

- ❌ **Nativní support pro 30+ evropských zemí** v jedné platformě
- ❌ **Automatic ARES/ORSR/handelsregister** validace napříč EU
- ❌ **EU-wide carrier integrations** out-of-the-box (Zásilkovna + DHL + InPost + PostNord + ...)
- ❌ **Local payment gateways** nativně (GoPay, BLIK, iDEAL, Klarna, Satispay, Sofort, Bancontact...)
- ❌ **Local accounting systems** (Pohoda, DATEV, Fortnox, Exact, InfoSys...)
- ❌ **Per-country tax compliance** (DUZP CZ, e-faktury IT, JPK PL, SAF-T...)
- ❌ **Local marketplaces** (Heureka, Allegro, eMag, Bol.com, Prisjakt...)
- ❌ **Local legal templates** (GDPR ano, ale české OP, německé AGB nativně)
- ❌ **Local banking** (ARS direct integrace, SEPA, Fio, ČSOB...)

**Opportunity:**

> **Být jediná platforma, kde nemusíte hledat "doplněk Zásilkovna" – je tam od prvního dne jako nativní funkce.** A to platí pro všech 30+ zemí.

### 2.3 B2B v entry tarifu

**Status trhu:**

- Shopify – B2B jen v Plus ($2 000+)
- Shopware – B2B Components v Evolve (€2 400+)
- BigCommerce – B2B Edition (enterprise)
- Shoptet – B2B v Profi+ (1 999 Kč+)
- **Upgates** – je jediný s B2B v entry tarifu!

**Co chybí:**

- ❌ **Quote management** v entry tarifu kdekoli (kromě Upgates basic)
- ❌ **Employee management / company accounts** v entry
- ❌ **Budget management** v entry
- ❌ **Order approval workflows** v entry
- ❌ **Customer-specific pricing** v entry (Shopware jen Beyond €6 500+)
- ❌ **Punch-out catalogs** (OCI 4.0) mimo enterprise

**Opportunity:**

> **B2B + B2C + D2C + C2C v jedné platformě, všechny modely v ceně entry tarifu.** Konkurence donutit zákazníky k upgradu – my ne.

### 2.4 Mobilní aplikace pro zákazníky (white-label)

**Status trhu:**

- **Ecwid ShopApp** – jediný s nativní zákaznickou mobilní aplikací (Unlimited plán, cca $99/měs.)
- **Shopify Shop App** – univerzální (ne per-merchant branded)
- Ostatní platformy – **žádná white-label mobilní app** pro koncové zákazníky

**Co chybí:**

- ❌ **Branded mobilní app** v ceně entry tarifu
- ❌ **Push notifications** pro customers
- ❌ **Offline shopping** support
- ❌ **Mobile-specific features** (barcode scan, AR preview)
- ❌ **Deep linking** pro marketing kampaně
- ❌ **App Store publishing** assistance

**Opportunity:**

> **Branded mobile app for every merchant** – generated from storefront, publishable to App Store / Play Store, customer retention via push notifications.

### 2.5 Real-time collaboration

**Status trhu:**

- Shopify – multi-user bez real-time collaboration
- Wix – slušný multi-user
- **Žádná platforma** nemá Figma/Google Docs-style real-time collab

**Co chybí:**

- ❌ **Live cursors** v adminu (vidět, kdo kde pracuje)
- ❌ **Commenting** na produktech / objednávkách
- ❌ **Mentions** (@kolega)
- ❌ **Version history** s rollback
- ❌ **Tasks / todos** integrované
- ❌ **Screen sharing** / sessions
- ❌ **Handoff workflows** mezi rolí

**Opportunity:**

> **First truly collaborative e-commerce admin** – jako Figma/Notion pro e-commerce.

### 2.6 Developer experience (DX)

**Status trhu:**

- Shopify – nejlepší DX, ale closed ecosystem
- Shopware – open-source, ale complex
- BigCommerce – solid API, slabší docs

**Co chybí:**

- ❌ **Modern TypeScript SDK** napříč jazyky (JS, Python, Go, Rust, PHP)
- ❌ **Local development** environment (Docker one-command setup)
- ❌ **Preview deployments** (jako Vercel)
- ❌ **Built-in CI/CD** pro theme/plugin development
- ❌ **AI-assisted plugin development** (GitHub Copilot for commerce)
- ❌ **Plugin hot-reload**
- ❌ **GraphQL-first** design (REST jen jako backup)
- ❌ **SDK pro mobile frameworks** (React Native, Flutter, SwiftUI, Jetpack Compose)

**Opportunity:**

> **Best-in-class DX** – developers si nás zamilují. A kde jsou developeři, tam je ekosystém.

### 2.7 Sustainability a ESG reporting

**Status trhu:**

- Shopify – Sustainability Fund, offset shipping
- Shopware – limited
- Ostatní – téměř nic

**Co chybí:**

- ❌ **Carbon footprint tracking** per order
- ❌ **CSRD (Corporate Sustainability Reporting Directive)** compliance tools
- ❌ **Packaging optimization** (reduce)
- ❌ **Circular economy features** (resell, repair, recycle)
- ❌ **Supply chain transparency**
- ❌ **Second-hand / refurbished** dedicated features
- ❌ **Offset programs** integrated

**Opportunity:**

> **EU Green Deal je reality.** Od 2025 velké firmy reportují CSRD, od 2026 střední firmy. Náš systém = automatický CSRD report.

### 2.8 Privacy a zero-party data

**Status trhu:**

- Všechny platformy – basic GDPR compliance
- **Žádná** – zero-party data strategy

**Co chybí:**

- ❌ **Zero-party data collection** tools (customer explicitly shares preferences)
- ❌ **Progressive profiling** (gradually learn about customers)
- ❌ **Consent orchestration** (granular)
- ❌ **Data portability** (customer exports own data)
- ❌ **Post-cookie marketing** infrastructure
- ❌ **Privacy-preserving analytics** (bez third-party cookies)
- ❌ **On-device personalization** (data stays on client)

**Opportunity:**

> **Cookie era končí** (Chrome deprecation, Apple ATT). Zero-party strategy = future-proof marketing.

### 2.9 Unified Commerce (omnichannel)

**Status trhu:**

- Shopify POS – nejlepší pro retail
- Shoptet / Upgates – Pokladna moduly
- **Žádná platforma** skutečný omnichannel se social commerce, live shopping, marketplaces, B2B portál

**Co chybí:**

- ❌ **Live shopping** native (video + chat + checkout)
- ❌ **Social commerce** unified (TikTok Shop + Instagram + Facebook + WhatsApp v jednom dashboardu)
- ❌ **Conversational commerce** (WhatsApp Business API, Instagram DM)
- ❌ **Voice commerce** (Alexa, Google Assistant, Siri)
- ❌ **QR commerce** (scan to buy in real world)
- ❌ **AR/VR shopping** native
- ❌ **Connected TV commerce** (smart TV apps)
- ❌ **Vending machine / kiosk mode**

**Opportunity:**

> **Jedna platforma, všechny kanály.** Merchant spravuje TikTok Shop, Instagram Store, Alexa skill, kiosk v obchodě – z jednoho dashboardu.

### 2.10 Finanční služby

**Status trhu:**

- Shopify Capital – lending
- Shopify Balance – banking
- **Žádná jiná platforma** nemá embedded finance

**Co chybí:**

- ❌ **Embedded banking** (merchant account)
- ❌ **Lending / cash advance** (financing growth)
- ❌ **Insurance** (shipping, product, liability)
- ❌ **Multi-currency accounts**
- ❌ **Automated tax provisioning**
- ❌ **Expense management** tools
- ❌ **Payroll** integration
- ❌ **Expense cards** for team

**Opportunity:**

> **E-commerce + FinTech = moat.** Shopify to ví, ale žádný evropský hráč to nedělá.

### 2.11 AI-powered merchandising

**Status trhu:**

- Wix Astro – AI design
- Shopify Sidekick – AI assistant
- Shopware Copilot – AI admin
- **Žádná** – AI merchandising jako Netflix/Spotify

**Co chybí:**

- ❌ **AI-driven category pages** (personalized per visitor)
- ❌ **Dynamic pricing** (AI-optimized per customer/time/stock)
- ❌ **Predictive stocking** (AI forecasts)
- ❌ **Churn prediction** s intervention
- ❌ **LTV prediction**
- ❌ **Visual search** (upload foto → najdi produkt)
- ❌ **Outfit assembly** AI (fashion)
- ❌ **Product feed optimization** for each channel

**Opportunity:**

> **AI merchandising layer** – konverze +30 % bez merchant úsilí.

### 2.12 Composability bez complexity

**Status trhu:**

- MACH Alliance – pouze enterprise
- commercetools, Crystallize, Medusa – developers only
- Shopify – closed, Shopware – open ale complex

**Co chybí:**

- ❌ **Composable ale ne-technical** (jako Notion blocks, ale pro e-commerce)
- ❌ **"Rip and replace"** jednotlivé moduly bez migrace
- ❌ **Bring-your-own-CMS** (Contentful, Storyblok, Sanity) plug-and-play
- ❌ **Bring-your-own-search** (Algolia, Elasticsearch, Typesense)
- ❌ **Bring-your-own-payment** (jakákoli globální brána)
- ❌ **Bring-your-own-frontend** (Next.js, Nuxt, Astro one-click)

**Opportunity:**

> **Composable pro každého.** Merchant může být technicky pokročilý – a stále používat vizuální admin.

---

## 3. Future trendy e-commerce 2026–2030

Analýza tam, kam směřuje trh, abychom **byli tam, než to konkurence udělá**.

### 3.1 Trend 1: Agentic Commerce (breakout 2026)

**Data:**

- 38 % spotřebitelů používá AI při nákupu (dnes, IAB 2026)
- 80 % plánuje používat víc
- **4 700 % růst traffic z AI asistentů** 2024→2025 (WSJ)
- **$20.9B retail spend v 2026** přes AI platformy
- **90 % B2B nákupů AI-mediated do 2028**

**Co to znamená:**

- SEO → AEO (Answer Engine Optimization)
- SEO → ACO (Agentic Commerce Optimization)
- Tradiční ad channels slábnou (jako Google Ads 2000s)
- **Merchant potřebuje "agent-ready"** infrastrukturu

**Naše response:**

- **Agent-first** platforma od prvního dne
- **MCP server native** v admin
- **Agent analytics** (track AI-sourced revenue)
- **Agent commerce SDK** (pro custom agents)

### 3.2 Trend 2: Composable commerce mainstream (2027+)

**Data:**

- Headless adoption: 6 % (2024) → 14 % (2026) → **25 % (2028)** projected
- Mid-market composable – od 2027 standard
- MACH Alliance rychlý růst

**Co to znamená:**

- Monolithic platformy budou ztrácet mid-market
- Composable/headless = enterprise standard
- **Ale current composable = jen pro developer teams**

**Naše response:**

- **Composable pro non-developers** – visual admin, pod kapotou headless
- **Bring-your-own-everything** mentality
- **Plug-and-play CMS, search, payment, shipping**

### 3.3 Trend 3: Privacy & cookie-less future (2026–2027)

**Data:**

- Chrome 3rd party cookies – rolling deprecation
- Apple ATT – 96 % opt-out v US
- EU GDPR enforcement intenzifikuje
- **Cookieless marketing = realita 2027**

**Co to znamená:**

- Retargeting traditional – končí
- Zero-party data = zlato
- Consent-based everything

**Naše response:**

- **Zero-party data collection** tools native
- **Progressive profiling**
- **Consent orchestration**
- **On-device personalization**
- **EU-first privacy** design

### 3.4 Trend 4: Sustainability reporting (CSRD wave 2025–2027)

**Data:**

- **CSRD povinný od 2025** pro velké firmy (>€40M rev, >250 emp)
- **Od 2026** pro střední firmy
- **Od 2027** pro listed SME
- **EU Green Deal** – €1 trillion commitment

**Co to znamená:**

- E-commerce obchody **musí reportovat** uhlíkovou stopu
- Supply chain transparency = nutnost
- Packaging, shipping emissions tracked

**Naše response:**

- **CSRD report** auto-generated z platform data
- **Carbon footprint per order**
- **Packaging optimization AI**
- **Circular economy tools** (resell, repair)
- **ESG scorecard** pro zákazníky (zobrazit dopad)

### 3.5 Trend 5: Unified Commerce (already here, intensifies)

**Data:**

- **73 % spotřebitelů** nakupuje omnichannel
- Social commerce: **$1.2T do 2028** globálně
- Live shopping: **$68B v 2026**, **$150B v 2028** (Asia vede)
- WhatsApp Business: **200M+ firem** používá

**Co to znamená:**

- Single storefront = pozadu
- Social + live + voice + TV commerce
- Conversational commerce = major channel

**Naše response:**

- **15+ kanálů nativně** (TikTok Shop, IG, FB, WhatsApp, YouTube, Twitch, Alexa, Google...)
- **Live shopping built-in**
- **Conversational commerce** platform
- **One dashboard** pro všechny kanály

### 3.6 Trend 6: Hyperpersonalization (AI-driven 2026–2030)

**Data:**

- **26 % AOV lift** z AI personalizace
- **34 % shoppers používá AI** pro discovery
- **71 %** očekává personalizovaný experience

**Co to znamená:**

- Same-page-for-all = uniform = dying
- Každý visitor = unique experience
- **AI merchandising** = default

**Naše response:**

- **AI personalization layer** z krabice
- **Real-time merchandising**
- **Dynamic everything** (prices, products, content, promotions)
- **Customer AI profile** (with consent)

### 3.7 Trend 7: Sub-second commerce (performance)

**Data:**

- **1 sekunda** delay = **7 %** conversion drop
- **Core Web Vitals** = ranking factor Google
- **Speed = competitive advantage**

**Co to znamená:**

- Edge computing = nutnost
- Edge functions everywhere
- < 500ms TTFB = standard

**Naše response:**

- **Edge-first architecture** (Cloudflare Workers / Deno Deploy style)
- **Distributed data layer**
- **Automatic optimization**
- **Global CDN** na každém tarifu

### 3.8 Trend 8: Finanční embedded services (2026–2028)

**Data:**

- **Shopify Capital**: $5B+ financed
- **BNPL v B2B**: rapid growth
- **Embedded finance**: $230B market 2026

**Co to znamená:**

- Platform = bank
- Merchants expect lending, accounts, cards

**Naše response:**

- **Embedded banking** (EU license)
- **Lending / cash advance**
- **Multi-currency accounts**
- **Expense cards**
- **Insurance products**

### 3.9 Trend 9: AI voice & AR commerce (2027+)

**Data:**

- **Voice commerce**: $80B do 2028
- **AR try-on**: 71 % shoppers zájem
- **Smart glasses** (Apple Vision Pro, Meta) mainstreaming 2027

**Co to znamená:**

- Voice-first interfaces
- 3D product models = expected
- AR try-on standard pro módu, beauty, nábytek

**Naše response:**

- **3D product models** support from day one
- **AR try-on SDK** (WebAR, native)
- **Voice commerce** (Alexa, Siri, Google)
- **Vision Pro / Quest** commerce apps

### 3.10 Trend 10: Regulatory compliance automation (EU regulace wave)

**Data:**

- **EU Digital Services Act** (DSA) – 2024+
- **EU AI Act** – 2026 enforcement
- **EU Data Act** – 2025
- **EU Cyber Resilience Act** – 2027
- **EU DMA** (Digital Markets Act) – ongoing

**Co to znamená:**

- Compliance complexity roste
- Merchants se v tom ztrácejí
- Opportunity to automate

**Naše response:**

- **Compliance automation suite** (DSA, AI Act, GDPR, CSRD, DMA...)
- **Auto-updated templates**
- **Regulatory alerts**
- **Documentation generator**

---

## MARKDOWN_EOF

## 4. Konkurenční výhody našeho systému – Core Pillars

Následujících **10 pilířů** definuje, proč bude náš systém **ultimátní volba** oproti všem 8 analyzovaným platformám.

**Každý pilíř řeší konkrétní mezeru + future-proof element.**

| #   | Pilíř                       | Řeší mezeru                      | Future-proof pro            |
| --- | --------------------------- | -------------------------------- | --------------------------- |
| 1   | **Agent-native commerce**   | Žádná platforma není agent-ready | 2026–2030 agentic boom      |
| 2   | **Unified B2B/B2C/D2C/C2C** | Upgrades pro B2B features        | Hybrid business models      |
| 3   | **Lokalizace per stát**     | Shoptet jen CZ, Shopware slabě   | EU expansion era            |
| 4   | **True composable**         | Complex for non-devs             | Mid-market composable 2027+ |
| 5   | **Sustainability native**   | Žádná nemá CSRD                  | EU Green Deal compliance    |
| 6   | **Privacy-first**           | GDPR povrchně                    | Post-cookie 2027            |
| 7   | **Unified Commerce**        | Fragmented kanály                | 15+ channel commerce        |
| 8   | **Real-time collaboration** | Žádná nemá                       | Remote team era             |
| 9   | **Predictive everything**   | AI tools omezené                 | Hyperpersonalization        |
| 10  | **Open marketplace**        | Closed platforms                 | Composable mindset          |

---

## 5. Pilíř 1: Agent-native commerce (AI-first)

**Nejdůležitější pilíř.** Agentic commerce je největší shift od mobile → cloud éry. Kdo to udělá první, vyhraje dekádu.

### 5.1 Co je agent-native commerce

**Definice:** Platforma navržená **od základu** pro svět, kde AI agenti (ChatGPT, Claude, Gemini, Perplexity, custom enterprise agents) jsou **primary buyers** vedle lidských zákazníků.

**Konkurence:**

- **Shopware** – announced agentic initiative (no production features)
- **Shopify** – Sidekick pro admin (no buyer-side agents)
- **commercetools** – announcements, early PoC
- **Naše pozice:** **první production-ready agent-native platforma v Evropě**

### 5.2 Native MCP server

**Model Context Protocol (MCP)** – standard by Anthropic pro AI-to-system komunikaci.

**Co implementujeme:**

- **Built-in MCP server** v každém obchodě
- **Auto-generated schema** z product catalog
- **Agent authentication** a rate limiting
- **Agent audit log**
- **MCP marketplace** pro custom tools

**Merchants získají:**

- Obchod je okamžitě "discoverable" pro AI agenty
- ChatGPT, Claude, Perplexity najdou produkty rychleji
- **Konkurenční výhoda** v agent-sourced traffic

### 5.3 Strukturovaná data pro LLM

**Generování feedů:**

- **LLM-optimized product feed** (odlišný od Google Shopping)
- **Q&A pro každý produkt** (auto-generated + merchant customizable)
- **Semantic descriptions** (ne jen features, ale use-cases)
- **Decision tree** pro složité produkty (guided selling)
- **Context embeddings** pre-computed

### 5.4 Agent checkout

**Special checkout flow pro authenticated AI agents:**

- **Zero friction** (agent je pre-authorized)
- **Agent wallet** (pre-funded)
- **Transaction signing** (cryptographic)
- **Refund automation**
- **Agent identity verification**

**Protokoly podporované:**

- **MCP** (Model Context Protocol)
- **A2A** (Agent-to-Agent)
- **UCP** (Unified Commerce Protocol)
- **Shopify Agent Checkout** (compatibility)
- **Apple Pay Agent** (rumored 2026)

### 5.5 Agent-to-Agent (A2A) negotiation

**Pro B2B – revoluční:**

- **Buyer agent** (customer's AI) negotiates s **seller agent** (merchant's AI)
- **Automated pricing** discussions
- **Volume discounts** negotiated
- **Delivery terms** negotiated
- **Payment terms** agreed
- **Result = order** s full audit trail

**Use case:**

> Procurement manager v B2B firmě říká svému agentu: "Potřebuji 500 šroubů M6 dodaných do pátku, max €500." Agent kontaktuje 5 dodavatelů. Naše platforma má AI seller agent, který automaticky odpovídá, vyjednává, a uzavírá obchod.

### 5.6 AEO a ACO toolkit

**Answer Engine Optimization** (AEO) – nové SEO pro AI:

- **Auto-generated FAQ** z dat
- **Question-first** content strategy
- **Direct answer** optimization
- **Citation-worthy** product data

**Agentic Commerce Optimization** (ACO):

- **Agent-preference signals** (jak agenti vybírají)
- **Trust score** optimization
- **Response time** optimization
- **Schema markup** pro agents
- **Merchant reputation** pro agents

### 5.7 Agent analytics

**Dashboard s:**

- **Agent-sourced traffic** (z ChatGPT, Claude, Perplexity, Gemini)
- **Agent vs. human** conversion rates
- **Top queries** from agents
- **Missed opportunities** (co agent hledal, neměl jsi)
- **Agent revenue attribution**

### 5.8 Custom agent SDK

**Pro advanced merchants:**

- **Build custom seller agent** s našim SDK
- **Train on your catalog**
- **Custom negotiation** logic
- **Multi-agent orchestration**
- **Deploy na vlastní infra** nebo naše

### 5.9 AI Copilot (enhanced)

**Lepší než Shopify Sidekick / Shopware Copilot:**

**Kernel features:**

- **Natural language** admin (cokoliv napíšete → provede)
- **Multi-modal** (text, voice, image, video input)
- **Proactive suggestions** (ne jen reactive)
- **Learning** (adapts to your business)

**Advanced:**

- **Meeting mode** – AI vede whole strategic session
- **Crisis mode** – AI detects anomalies, alerts
- **Growth mode** – AI suggests scaling opportunities
- **Competitor mode** – monitors competition, recommends

**Pro developers:**

- **AI pair programming** pro plugin development
- **Auto-generated** tests
- **Auto-generated** docs

### 5.10 Privacy-preserving AI

**Unlike Shopify AI (data sent to OpenAI):**

- **EU-hosted** models (Mistral, Claude EU, custom)
- **Data never leaves EU** option
- **Opt-in** data usage pro training
- **Zero-retention** mode dostupný
- **Own AI model** option (enterprise)

---

## 6. Pilíř 2: Unified B2B/B2C/D2C/C2C

Jedna platforma, všechny obchodní modely. **V ceně entry tarifu.**

### 6.1 Co znamená "unified"

**Dnes merchants mají:**

- Shopify pro B2C
- Shopify Plus **upgrade** pro B2B (drahé)
- Separate platform pro marketplace functionality
- Extra app pro rental/subscription
- Custom dev pro C2C

**Náš přístup:**

- **Jeden tarif = všechny modely**
- **B2B Components** v Basic
- **Marketplace** v Basic (sellers, commissions, payouts)
- **Subscription / rental** v Basic
- **C2C** v Basic (peer-to-peer listings)
- **D2C** jako default

### 6.2 B2B feature set (v ceně)

**Úroveň Shopware Evolve + Beyond, ale v našem Basic:**

**Company accounts:**

- Multi-level hierarchie (HQ → subsidiary → department → employee)
- Unlimited employees
- Role-based permissions granularly

**Pricing:**

- **Customer-specific** price lists
- **Contract pricing** (from-to dates)
- **Tiered pricing** per customer
- **Volume discounts** per customer
- **Category discounts** per customer
- **Promotional overrides**

**Quote management:**

- Full RFQ workflow
- Multi-version quotes
- Negotiation history
- Expiration dates
- PDF quote generation
- **AI-assisted** quote creation

**Order workflows:**

- Multi-level approval chains
- Budget-based routing
- Category-based approval
- Auto-approval thresholds
- Emergency override

**Budget management:**

- Per-employee budgets
- Per-department budgets
- Per-period (monthly/quarterly/yearly)
- Real-time tracking
- Alert systems
- Budget request workflow

**Employee management:**

- SSO (SAML, OIDC)
- Active Directory sync
- Okta, Auth0, Microsoft Entra
- Custom IdP

**Procurement integrations:**

- **Punch-out catalogs** (OCI 4.0)
- **cXML**
- **SAP Ariba** plug-and-play
- **Coupa** integration
- **Oracle Procurement**
- **Jaggaer**
- **Mercateo**

**Payment terms:**

- Net 14, 30, 60, 90
- Credit limits
- Automated dunning
- Invoice payments
- Purchase orders

### 6.3 Marketplace features

**Multi-vendor marketplace v ceně:**

- **Vendor onboarding** flow
- **Vendor dashboards**
- **Commission management** (flexible rules)
- **Payouts** (automated, multi-currency)
- **Vendor ratings**
- **Vendor-specific** shipping
- **Order splitting** automaticky
- **Dispute resolution**
- **KYC/AML** compliance

**Why this matters:**

> Shoptet/Shopify/Upgates – merchant **nemůže postavit marketplace**. My ano.

### 6.4 Subscription / rental commerce

**Native support:**

- **Subscription products** (monthly, yearly, custom intervals)
- **Flexible plans** (pause, swap, cancel)
- **Prorated billing**
- **Rental periods** (with return dates)
- **Deposit handling**
- **Insurance options**
- **Churn prediction**
- **Win-back automations**

### 6.5 C2C features

**Peer-to-peer marketplace:**

- **User-generated listings**
- **Seller verification**
- **Escrow payments**
- **Rating systems** (oba směry)
- **Dispute resolution**
- **Messaging** (buyer-seller)
- **Promotion tools** pro sellers

**Use case:**

> Vintage fashion značka umožní zákazníkům **resell použité kousky** přes svůj e-shop. Circular economy – novinka v EU.

### 6.6 Hybrid models

**Mix & match možné:**

- **B2C + Marketplace** (primary + secondary sellers)
- **B2B + C2C** (velkoobchod + refurbish from business customers)
- **D2C + Subscription** (brand s membership)
- **B2C + Rental** (sports equipment, fashion)

### 6.7 Business model switching

**Pro merchants:**

- **Start as B2C** → add B2B later (1-click enable)
- **Add marketplace** after 12 months
- **Add subscriptions** anytime
- **Migration** bez re-platforming

**Konkurence:**

- Shopify: **Plus upgrade** vyžadován pro B2B
- Shopware: **Evolve upgrade** vyžadován
- My: **Feature flag toggle**, v ceně

---

## 7. Pilíř 3: Lokalizace na úrovni každého státu

**Single most differentiating feature** pro EU market. Shopify/Shopware tohle nedokážou.

### 7.1 Princip: "Native in every country"

**Dnešní přístup konkurence:**

- "Přidáme plugin pro Zásilkovnu, Heureku, Pohodu..."
- Variable quality
- Extra náklady
- Different vendors, different support
- Breaking changes

**Náš přístup:**

- **Nativní integrace** jako core feature
- **Shopware level pro DACH + Shoptet level pro CZ/SK + ekvivalent pro PL, HU, RO, BG, DE, AT, CH, NL, BE, FR, IT, ES, PT, UK, IE, DK, SE, NO, FI, EE, LV, LT, HR, SI, GR, CY**

### 7.2 Country modules (30+)

Každý "country module" obsahuje:

**Legal & Compliance:**

- Local legal templates (Terms, Privacy, Returns)
- Tax rules (VAT rates, reduced rates, exemptions)
- Invoice format (legally compliant)
- Local regulatory requirements

**Business validation:**

- **ARES** (CZ) – IČO validation, auto-fill
- **ORSR** (SK)
- **Handelsregister** (DE, AT)
- **KRS** (PL)
- **Companies House** (UK)
- **KVK** (NL)
- **BCE** (BE)
- - 23 more

**Payment gateways (native):**

- **CZ:** GoPay, ComGate, ThePay, Shoptet Pay equivalents
- **DE:** Klarna, SOFORT, Giropay, EPS
- **NL:** iDEAL, Bancontact
- **PL:** BLIK, Przelewy24, PayU
- **IT:** Satispay, Nexi, Postepay
- **HU:** OTP, SimplePay, Barion
- **SE/NO/DK:** Klarna, Swish, MobilePay, Vipps
- **FR:** Cartes Bancaires, Paylib
- **ES:** Bizum, Redsys
- - 50+ more

**Shipping carriers (native):**

- **CZ:** Zásilkovna, Česká pošta, PPL, DPD, GLS, DHL, Uloženka
- **SK:** Slovenská pošta, Packeta SK, 123Kuriér
- **PL:** InPost, Poczta Polska, DPD, DHL, Furgonetka
- **DE:** DHL, Hermes, DPD, GLS, UPS
- **NL:** PostNL, DHL, Bol.com Logistics
- **IT:** Poste Italiane, BRT, GLS
- **UK:** Royal Mail, DPD, Evri (Hermes), DHL
- **Nordics:** PostNord, Bring, Posti
- - 30+ more

**Accounting integrations:**

- **CZ:** Pohoda, Money S3, FlexiBee, ABRA, iDoklad, Fakturoid
- **SK:** Pohoda SK, Money, Omega
- **DE:** DATEV, Lexware, SevDesk, Lexoffice
- **AT:** BMD, RZL
- **NL:** Exact, Twinfield, AFAS
- **PL:** Comarch, Fakturownia, iFirma
- **UK:** Xero, QuickBooks, Sage
- **Nordics:** Fortnox, Visma
- - 20+ more

**Marketplaces:**

- **CZ:** Heureka, Zboží.cz, Glami, Biano
- **SK:** Heureka.sk, Pricemania
- **PL:** Allegro, Ceneo, Morele
- **HU:** Árukereső, eMag, Vatera
- **DE:** Amazon DE, eBay DE, Otto, Kaufland
- **AT:** Geizhals, Shöpping
- **NL:** Bol.com, Marktplaats
- **IT:** Amazon IT, ePrice
- **UK:** Amazon UK, eBay UK, OnBuy
- **Nordics:** Prisjakt, Pricespy

**Tax compliance:**

- **CZ:** DPH rates, DUZP, Kontrolní hlášení
- **SK:** DPH, nové sazby 2025
- **DE:** USt rates, DATEV export, GoBD compliance
- **PL:** JPK files (JPK_VAT, JPK_FA)
- **IT:** SdI (Sistema di Interscambio) e-invoicing
- **FR:** Factur-X, DGFiP
- **ES:** SII (Suministro Inmediato de Información)
- **HU:** NAV online invoicing
- **RO:** e-Factura
- All countries: **EU OSS, IOSS**

**Recyclation fees (where applicable):**

- **CZ:** EKO-KOM, ASEKOL, ELEKTROWIN, ECOBAT
- **DE:** DSD (Der Grüne Punkt), VerpackG registrace
- **AT:** ARA, ERA
- **FR:** CITEO, Ecosystem
- **PL:** Rekopol
- **IT:** CONAI
- **SK:** ENVI-PAK

**Marketing & SEO:**

- **Local Google My Business**
- **Local schema.org** variations
- **hreflang** per region
- **Local review platforms** (Trustpilot varies by country)
- **Local sitemaps**
- **ccTLDs** support (multiple domains)

### 7.3 Automatic country detection & routing

- **IP-based** detection
- **Browser language** fallback
- **User selection** memory
- **Auto-redirect** rules (configurable)
- **Hreflang correct**
- **Separate inventory** per country (optional)
- **Per-country pricing**

### 7.4 Expansion wizard

**Merchant wants to add new country:**

1. Clicks "Add Poland"
2. **Wizard asks:** language? currency? warehouse?
3. **Auto-provisions:**
   - PL legal templates
   - PL tax rules
   - InPost integration
   - Allegro marketplace
   - BLIK payment
   - Comarch accounting
   - PL-specific SEO
   - .pl domain setup guide
4. **Ready in 15 minut.**

**Competitor would take months.**

### 7.5 Local support

**Native language support v:**

- ČR, SK (rodilí mluvčí)
- DE, AT, CH
- PL, HU, RO, BG, HR, SI
- NL, BE (Dutch + French)
- IT, ES, PT
- FR
- UK, IE
- DK, SE, NO, FI

**SLA:** Response time during local business hours.

### 7.6 Local partner network

**Certified agency network per country:**

- **CZ:** 50+ certified agencies
- **DE:** 100+
- **PL:** 50+
- **NL:** 30+
- etc.

**Merchant finds partner in their country in 2 clicks.**

### 7.7 Competitive positioning

| Feature        | Shopify | Shopware | Shoptet | Upgates | **Náš systém** |
| -------------- | ------- | -------- | ------- | ------- | -------------- |
| CZ native      | Partial | Weak     | ✅      | ✅      | **✅**         |
| SK native      | Partial | Weak     | ✅      | ✅      | **✅**         |
| PL native      | Partial | Partial  | ❌      | ❌      | **✅**         |
| HU native      | Partial | Partial  | ❌      | ❌      | **✅**         |
| RO native      | ❌      | Partial  | ❌      | ❌      | **✅**         |
| BG native      | ❌      | ❌       | ❌      | ❌      | **✅**         |
| DE native      | ✅      | ✅       | ❌      | ❌      | **✅**         |
| AT native      | Partial | ✅       | ❌      | ❌      | **✅**         |
| NL native      | Partial | Partial  | ❌      | ❌      | **✅**         |
| UK native      | ✅      | Partial  | ❌      | ❌      | **✅**         |
| Nordics native | Partial | Weak     | ❌      | ❌      | **✅**         |

**Náš systém vyhrává v každé evropské zemi.** To nikdo jiný nemá.

---

## 8. Pilíř 4: True Composable Architecture

**Composable pro každého, ne jen pro developers.**

### 8.1 Problém současného composable

**Dnes composable = MACH = enterprise only:**

- **commercetools** – API-first, but no UI, developers-only
- **Crystallize** – headless CMS + commerce, steep learning
- **Medusa** – open-source, self-host, devs only
- **Shopware** – commercial, developers + admin, still complex

**Non-technical merchant:** "Nerozumím tomu, zůstanu u Shopify."

### 8.2 Náš přístup: "Composable with training wheels"

**Vizuální admin nad composable kernelem:**

- **Merchant vidí** traditional admin (Shopify-like UX)
- **Pod kapotou** = full MACH architecture
- **Advanced merchants** mohou vyměňovat moduly
- **Beginners** mají hotové preset

### 8.3 Pluggable modules

**Vyměňte si co potřebujete:**

**CMS module:**

- **Default:** Vlastní Shopping Experiences (Shopware-style)
- **Swap to:** Storyblok, Contentful, Sanity, Strapi
- **One-click migration**
- **Data sync automatic**

**Search module:**

- **Default:** Built-in (Typesense-based)
- **Swap to:** Algolia, Klevu, Findologic, Elasticsearch, Vector search
- **One-click**

**Payment module:**

- **Default:** Our gateway aggregator
- **Swap to:** Direct Stripe, Direct Adyen, Custom processor
- **Multi-processor** routing rules

**Frontend module:**

- **Default:** Our theme engine
- **Swap to:** Next.js, Nuxt, Astro, Remix, custom
- **Storefront API** consistent

**Checkout module:**

- **Default:** Our optimized checkout
- **Swap to:** Custom checkout, Bolt, Fast, Rye
- **Data integrity** maintained

**Email module:**

- **Default:** Built-in transactional
- **Swap to:** SendGrid, Postmark, Resend, AWS SES
- **Template compatibility**

**Analytics module:**

- **Default:** Built-in analytics
- **Add:** GA4, Matomo, Mixpanel, Amplitude, Heap
- **Data warehousing:** Snowflake, BigQuery, Databricks

**Reviews module:**

- **Default:** Built-in
- **Swap to:** Trustpilot, Reviews.io, Yotpo, Bazaarvoice, Heureka
- **Data-consistent**

**Loyalty module:**

- **Default:** Built-in
- **Swap to:** Smile.io, LoyaltyLion, Yotpo Loyalty, custom
- **Points sync**

### 8.4 API-first unified layer

**Vše přes jeden API layer:**

- **GraphQL Federation** architecture
- **Single endpoint** per merchant
- **Federated schemas** z každého modulu
- **Real-time subscriptions**
- **Edge caching**
- **Rate limiting** smart

### 8.5 Developer experience (DX)

**Best-in-class DX:**

- **TypeScript SDK** everywhere (auto-generated)
- **Python, Go, Rust, PHP, Ruby SDK**
- **CLI tool** (`commerce-cli`)
- **Local dev** (Docker Compose one-liner)
- **Hot reload** for plugins/themes
- **Preview deployments** (Vercel-style)
- **Git-based** deployment
- **CI/CD templates** (GitHub Actions, GitLab)

### 8.6 AI-assisted development

**GitHub Copilot for commerce:**

- **AI-generated plugins** from description
- **AI-generated themes**
- **AI-generated integrations**
- **Code review AI**
- **Auto-testing** suggestions
- **Migration assistants**

### 8.7 Composable pro non-developers

**Vizuální moduly:**

- **Block-based builder** (Notion-style)
- **"Connect this to that"** visual flow
- **Pre-built recipes** (e-commerce workflows)
- **No-code webhook** builder
- **Visual API composition**

### 8.8 Module marketplace

**Kdokoli může publikovat modul:**

- **Revenue share** (80/20 ve prospěch developera)
- **Certification** process
- **Quality scores**
- **User reviews**
- **Free + paid** tiers

### 8.9 Enterprise-grade

Pro enterprise:

- **On-premise** deployment option (k8s)
- **Air-gapped** environments
- **Private cloud** (AWS, Azure, GCP)
- **Multi-tenant** isolation
- **SSO/SAML**
- **Audit logs** detailed
- **Custom SLA**

---

## 9. Pilíř 5: Sustainability & Regulatory Compliance

**EU Green Deal je reality. Naše platforma = automatická compliance.**

### 9.1 CSRD automated reporting

**Corporate Sustainability Reporting Directive:**

- **Scope 1, 2, 3 emissions** tracking
- **Per-order carbon footprint**
- **Supply chain mapping**
- **Packaging material** tracking
- **Energy consumption** monitoring
- **Annual CSRD report** auto-generated
- **Audit-ready** documentation

**Merchant přihlásí → má hotovo. Konkurence tohle nemá.**

### 9.2 Carbon footprint per product

**Data pro každý produkt:**

- **Manufacturing emissions** (from supplier data)
- **Shipping emissions** (calculated per route)
- **Packaging emissions**
- **Use-phase emissions** (electronics)
- **End-of-life** assumptions

**Zobrazit v storefront:**

- Customer vidí CO2e per produkt
- Může filtrovat "low carbon options"
- Offset v checkoutu (opt-in)
- **"Climate-conscious" badge**

### 9.3 Packaging optimization

**AI-driven:**

- **Optimize box sizes** per order (least waste)
- **Material recommendations** (recyclable preferred)
- **Void-fill optimization**
- **Multi-item consolidation**
- **Return-optimized** packaging

### 9.4 Supply chain transparency

- **Supplier data** integration
- **Origin tracking** (per component)
- **Fair trade verification**
- **Blockchain-backed** traceability (optional)
- **EUDR compliance** (Deforestation Regulation)

### 9.5 Circular economy features

**Native resell/repair/recycle:**

- **Take-back programs** (merchant accepts used items)
- **Refurbished section** built-in
- **Repair scheduling** and quotes
- **Recycling instructions** per product
- **Product passport** (digital) – **EU mandatory 2027+**

### 9.6 EU Digital Product Passport (DPP)

**EU povinnost 2027 pro:**

- Batteries (2027)
- Textiles (2028)
- Electronics (2028)
- Construction (2029)

**Naše platforma:**

- **Auto-generate DPP** per product
- **QR code** on product
- **Full lifecycle** data
- **Integrated** with catalog

### 9.7 Regulatory compliance suite

**Built-in compliance pro:**

**GDPR:**

- Consent management (granular)
- Data portability
- Right to erasure automated
- DPA templates
- Breach notification workflows

**DSA (Digital Services Act):**

- Notice & takedown system
- Trusted flaggers
- Transparency reports
- Ad library
- Algorithmic transparency

**DMA (Digital Markets Act):**

- Interoperability requirements
- Fair trading practices
- Data access rules

**EU AI Act:**

- AI use disclosure
- High-risk AI audit trails
- Bias testing
- Human oversight proof

**Cyber Resilience Act (2027):**

- Product security baselines
- Vulnerability disclosure
- Patching obligations

**EU Data Act:**

- Data sharing rules
- Contract fairness
- Switching rights

### 9.8 Compliance automation dashboard

**Merchant vidí:**

- **Compliance score** (per regulation)
- **Missing items** (actionable)
- **Upcoming changes** (regulatory calendar)
- **Auto-fix** options where possible
- **Legal partner** network (if needed)

### 9.9 Sustainability marketing

**Storefront features:**

- **ESG score** widget
- **Sustainability story** builder
- **Impact reports** shareable
- **Certifications** display (B Corp, Fair Trade, organic)
- **Before/after** reduction stories

### 9.10 Why this matters

**Research shows:**

- **73 % consumers** consider sustainability
- **+25 % willingness to pay** for sustainable products
- **CSRD deadlines** force merchants to act
- **Investors** demand ESG data

**Being "sustainability-native" = 5-year competitive moat.**

---

## 10. Pilíř 6: Data ownership a privacy

**Post-cookie éra = zero-party data = gold. Merchants si data musí vlastnit.**

### 10.1 Zero-party data platform

**Definice:** Data which customer **proactively shares** (ne 3rd party tracking).

**Jak sbíráme:**

- **Preference center** (customer vyplní)
- **Quiz / interactive surveys**
- **Wishlist patterns**
- **Progressive profiling** (postupně)
- **Customer feedback loops**

**Merchants vlastní 100 %.**

### 10.2 Customer Data Platform (CDP) built-in

**Feature CDP v ceně:**

- **Unified customer profiles**
- **Cross-channel** data unification
- **Real-time segmentation**
- **Predictive traits**
- **Event streams**
- **Audience sync** (to ads platforms, with consent)
- **Identity resolution**

**Level Salesforce / Segment, ale v ceně.**

### 10.3 Consent orchestration

**Granular consent management:**

- **Per-purpose** consent (marketing, personalization, analytics, AI training)
- **Per-channel** consent (email, SMS, push, in-app)
- **Per-jurisdiction** rules (GDPR, CCPA, LGPD, UK DPA)
- **Consent history** audit trail
- **Customer self-service** management
- **API-driven** consent propagation

### 10.4 Privacy-preserving analytics

**Unlike GA4 (3rd party cookies):**

- **First-party** data only
- **Server-side** tracking
- **Cookieless** fallback
- **Differential privacy** (individual data protected)
- **Aggregated metrics** always
- **GDPR compliant** from day one

### 10.5 On-device personalization

**Edge AI:**

- **Personalization runs on client** (not server)
- **Customer data stays on device**
- **Only aggregated insights** sent to us
- **Sub-100ms** personalization
- **Works offline**

### 10.6 Data portability (customer side)

**Customer can:**

- **Export all data** (1 click)
- **Transfer to another merchant** (if API support)
- **Delete everything** (right to erasure)
- **Partial deletion** (specific categories)
- **Anonymization** request
- **Data lineage** view (what data, where)

### 10.7 Data portability (merchant side)

**Merchant can:**

- **Export all data** easily (CSV, JSON, Parquet)
- **Migrate out** without lock-in
- **Bring own identity** provider
- **Own customer relationship** (not platform's)

### 10.8 Compliance certifications

**From day one:**

- **GDPR** (EU)
- **CCPA/CPRA** (California)
- **LGPD** (Brazil)
- **PIPEDA** (Canada)
- **UK DPA**
- **SOC 2 Type II**
- **ISO 27001**
- **ISO 27701** (privacy)
- **PCI DSS Level 1**

### 10.9 Data residency options

**Merchant chooses:**

- **EU** (default in EU)
- **US**
- **UK**
- **Australia**
- **Canada**
- **Custom** (enterprise)

**Guaranteed** data never leaves chosen region.

### 10.10 Privacy as USP

**Marketing message:**

> _"Your data. Your customers. Your business. Period."_

**Vs. Shopify:**

- Shopify vlastní ton data (uses for their AI, benchmarking)
- **Merchant concerns** growing
- **Our advantage** = merchants migrate to us

## 11. Pilíř 7: Unified Commerce (online + offline + social)

**Jedna platforma, 15+ kanálů. Merchant spravuje všechno z jednoho místa.**

### 11.1 Online storefront

**Traditional web:**

- Headless or traditional
- PWA support
- SEO optimized
- Fast, beautiful

### 11.2 Branded mobile app

**Auto-generated z storefrontu:**

- **iOS native** (SwiftUI)
- **Android native** (Jetpack Compose)
- **Publish to stores** (assisted)
- **Merchant's branding**
- **Push notifications**
- **Offline support**
- **Deep linking**
- **App-exclusive** promotions
- **AR try-on**
- **Barcode scanning**

**V ceně entry tarifu** (konkurence: Ecwid $99, Shopify custom).

### 11.3 POS (Point of Sale)

**Best-in-class POS:**

- **iPad POS app**
- **Android POS app**
- **Web POS** (any device)
- **Hardware agnostic** (any payment terminal)
- **Unified inventory** online + offline
- **Customer profiles** across channels
- **Offline mode** (syncs later)
- **Multi-register**
- **Multi-location**
- **Tip support**
- **Receipt options** (email, SMS, print, QR)

### 11.4 Social commerce (unified dashboard)

**Native integration s:**

- **TikTok Shop** (full catalog sync, orders, ads)
- **Instagram Shopping**
- **Facebook Shop**
- **YouTube Shopping**
- **Pinterest Product Pins**
- **Twitter / X Shopping**
- **Reddit Commerce** (if launched)

**Merchant uploads once, syncs everywhere.**

### 11.5 Conversational commerce

**WhatsApp Business API:**

- **Product catalog** in WhatsApp
- **Checkout** in chat
- **Order status** updates
- **Abandoned cart** recovery
- **Customer support**
- **Broadcast lists**

**Other platforms:**

- **Facebook Messenger**
- **Instagram DM**
- **Telegram**
- **Viber**
- **Line** (Asia)
- **WeChat** (Asia, enterprise)

**AI chatbot:**

- **Multi-channel** unified
- **Handoff to human**
- **Multi-language**
- **LLM-powered**

### 11.6 Live shopping (native)

**Built-in live commerce:**

- **Live video streaming**
- **Real-time chat**
- **In-stream checkout**
- **Product highlighting**
- **Viewer analytics**
- **Replay with shoppable moments**
- **Multi-platform** broadcasting (YouTube, TikTok, Facebook simultaneously)
- **Influencer collab** tools

**Market:** $150B do 2028 (Asia vede, Europe catching up).

### 11.7 Voice commerce

**Alexa Skill** auto-generated:

- Voice-activated shopping
- Order status queries
- Reorder commands
- Custom voice responses

**Google Assistant** actions.

**Siri Shortcuts** integration.

**Custom voice experiences** (enterprise).

### 11.8 Connected TV commerce

**Apple TV, Android TV, Samsung TV apps:**

- Large-screen optimized catalog
- Remote-friendly navigation
- QR checkout (scan with phone)
- Shoppable video content

**Roku, Fire TV** support.

### 11.9 AR/VR commerce

**WebAR:**

- **Try-on** (beauty, fashion, eyewear)
- **Room placement** (furniture, art)
- **Size visualization**
- **Works in browser** (no app)

**Native AR:**

- **iOS ARKit** support
- **Android ARCore**
- **Apple Vision Pro** apps (future)
- **Meta Quest** apps (future)

**3D product models:**

- Upload GLB/GLTF
- Auto-optimization
- Web rendering
- AR-ready

### 11.10 QR commerce

**Offline-to-online:**

- **Dynamic QR codes** per product
- **QR in print** (magazines, packaging)
- **Scan → product page**
- **Scan → checkout directly**
- **Scan → AR**
- **Tracked attribution**

### 11.11 Kiosk / vending mode

**Dedicated modes:**

- **Tablet kiosk** (in-store)
- **Self-checkout**
- **Vending machine** integration
- **Pickup locker** integration
- **Bright, touch-friendly** UI

### 11.12 IoT commerce

**Smart devices:**

- **Amazon Dash Replenishment** style
- **Smart fridge** reorders
- **Printer supplies** auto-reorder
- **Industrial IoT** for B2B (supplies, maintenance)

### 11.13 Marketplace selling (syndication)

**Sell on major marketplaces:**

- **Amazon** (FBA / FBM)
- **eBay**
- **Walmart**
- **Allegro** (PL)
- **Bol.com** (NL)
- **Kaufland** (DE)
- **eMag** (RO)
- **Heureka Marketplace** (CZ/SK)
- **Zalando Partner Program**
- **Otto**
- **Fruugo**

**Order sync, inventory sync, pricing automation.**

### 11.14 Unified inventory across all

**One stock → all channels:**

- **Real-time sync**
- **Multi-warehouse** allocation
- **Channel-specific** buffers
- **Overselling prevention**

### 11.15 Unified customer across all

**One customer → all channels:**

- **Recognize returning** customers
- **Preferences across channels**
- **Order history unified**
- **Points/loyalty unified**
- **Support history unified**

---

## 12. Pilíř 8: Real-time collaboration

**Figma / Google Docs / Notion experience for e-commerce admin.**

### 12.1 Live presence

- **Live cursors** (see who's looking at what)
- **User avatars** in corners
- **"Jane is editing product X"** indicators
- **Online/offline** status
- **Current page** visible to team

### 12.2 Real-time editing

- **Simultaneous editing** (multiple admins same product)
- **Operational Transform** (OT) or CRDTs
- **Conflict resolution** automatic
- **Change highlighting**
- **Undo/redo** per user

### 12.3 Commenting system

- **Comment on anything** (product, order, customer, page)
- **Threaded discussions**
- **Mentions** (@kolega)
- **Emoji reactions**
- **Resolve comments**
- **Filter by "my mentions"**
- **Email digest**

### 12.4 Tasks & workflow

- **Tasks** linkable to entities
- **Assign to** team members
- **Due dates**
- **Status tracking**
- **Notifications**
- **Board view** (Kanban)
- **List view**
- **Calendar view**

### 12.5 Version history

- **Every change tracked**
- **Who did what when**
- **Visual diff** (before/after)
- **Rollback** to any version
- **Branch** (try changes safely)
- **Merge** branches

### 12.6 Screen sharing / co-browsing

- **Share admin session** with colleague
- **Co-browsing** customer's session (support)
- **Guided onboarding** for new team members
- **Live handoff** workflows

### 12.7 Shared dashboards

- **Team dashboards** (custom metrics)
- **Personal dashboards**
- **TV mode** (for office display)
- **Real-time** updates
- **Annotations** on charts

### 12.8 Notification system

**Granular control:**

- **Email** (digest or instant)
- **Mobile push** (via admin app)
- **Slack integration**
- **Microsoft Teams**
- **Discord**
- **Browser push**

### 12.9 Audit log accessible

- **Who, what, when** for every action
- **Filterable**
- **Exportable**
- **Retention policy** configurable

### 12.10 Use cases

**Merchandiser + designer:**

> Merchandiser updates prices. Designer simultaneously updates hero banner. Both see each other's changes. No conflicts. Collaboration feels natural.

**B2B sales team:**

> 5 sales reps work on quotes simultaneously. They tag colleagues for questions. Manager sees all activity in real-time dashboard.

**Customer support:**

> Support agent co-browses customer's session. Colleagues can jump in to help. Handoff is seamless.

### 12.11 Why konkurence nemá

**Technical difficulty:**

- CRDTs / OT hard to implement
- Real-time infrastructure expensive
- Edge cases many

**Konkurence zatím nedávala prioritu** – mi ano. **First-mover advantage.**

---

## 13. Pilíř 9: Predictive everything

**AI doesn't just assist. AI predicts.**

### 13.1 Demand forecasting

- **Per SKU** demand predictions
- **Seasonal patterns**
- **Event-based** spikes (Black Friday, holidays)
- **Trend detection**
- **Ad campaign impact** modeling
- **Supplier lead time** factoring

**Actionable output:**

- **Reorder suggestions** with timing
- **Safety stock** recommendations
- **Overstock warnings**

### 13.2 Dynamic pricing

**AI-optimized prices:**

- **Per customer** (with consent)
- **Per time of day**
- **Per demand signals**
- **Per competitor** (monitoring)
- **Per inventory level** (clear old stock)
- **Margin optimization**

**Rules engine** controls AI:

- Min/max prices
- Never below cost
- Competitive thresholds
- Brand protection

### 13.3 Churn prediction

**Customer CLV management:**

- **Churn risk score** per customer (0–100)
- **Warning signals** detected
- **Intervention triggers** (offer, email, discount)
- **Win-back automation**
- **Success rate** tracking

### 13.4 Lifetime value prediction

- **LTV prediction** after 1st order
- **Customer segments** by LTV
- **Acquisition channel** optimization (spend more on high-LTV sources)
- **Budget allocation** AI-driven

### 13.5 Next best action

**Per customer recommendation:**

- **What to recommend** next
- **When to email**
- **What offer** to give
- **What content** to show
- **Best channel** to reach

**Maximizes conversion, minimizes spam.**

### 13.6 Product recommendation engine

**Beyond collaborative filtering:**

- **Visual similarity** (computer vision)
- **Style matching**
- **Semantic understanding** (LLM-powered)
- **Outfit assembly** (fashion)
- **Complementary products**
- **Cross-category** (not just "frequently bought together")

### 13.7 Search intelligence

**AI-powered search:**

- **Intent understanding** (semantic)
- **Typo tolerance**
- **Synonyms automatically**
- **Personalized results** per customer
- **Visual search** (photo → product)
- **Voice search**
- **Natural language** queries ("blue dress under €50 with free shipping")
- **Zero-result** intelligent suggestions

### 13.8 Fraud prediction

**ML-powered fraud detection:**

- **Real-time scoring**
- **Pattern recognition**
- **Network analysis** (shared devices/IPs/addresses)
- **Behavioral signals**
- **Integrate with** Stripe Radar, Riskified, Signifyd
- **Custom model** training per merchant

### 13.9 Return prediction

- **Which orders** likely to return
- **Reason prediction**
- **Preventive actions** (size chart, clearer photos)
- **Proactive outreach**
- **Reduce return rate** by 15-25%

### 13.10 Content generation

**AI content factory:**

- **Product descriptions** at scale
- **Meta tags** SEO-optimized
- **Blog posts** from products
- **Email campaigns**
- **Social media posts**
- **Video scripts**
- **Image generation** (brand-consistent)
- **Product photos** (AI-enhanced or generated)

### 13.11 Competitive intelligence

**Track competitors automatically:**

- **Price monitoring**
- **Inventory signals** (out of stock?)
- **New products** detected
- **Marketing campaigns** observed
- **Reviews analysis**
- **Strategy suggestions**

### 13.12 Anomaly detection

**Monitor business health:**

- **Unusual traffic** drops/spikes
- **Conversion anomalies**
- **Sales patterns** breaks
- **Supplier issues** early warning
- **Fraud waves**

**Alert with context and suggested action.**

### 13.13 Proactive AI assistant

**Unlike reactive chatbots:**

- **Proactively** messages merchant
- "Sales of product X dropped 30 % this week. Here are 3 reasons why and what to do."
- **Weekly/monthly insights** reports
- **Strategic suggestions**
- **Celebrates wins**

### 13.14 Privacy-preserved ML

**All ML:**

- **EU-hosted models** option
- **Federated learning** (model trained across merchants without sharing data)
- **Differential privacy**
- **Merchant's own** model option
- **GDPR-compliant**

---

## 14. Pilíř 10: Ekosystem a marketplace features

**Open platform > closed platform.**

### 14.1 App marketplace (developer-friendly)

**Lepší než Shopify App Store:**

- **Revenue share:** 80/20 (developer-favorable, vs. Shopify 70/30 over $1M)
- **Faster approvals** (AI-assisted review + human)
- **Better tooling** for devs
- **No arbitrary rejections**
- **Transparent metrics**

### 14.2 Theme marketplace

**Curated + community:**

- **Official themes** (built by us)
- **Partner themes** (certified agencies)
- **Community themes**
- **Quality scores**
- **Performance badges** (Lighthouse scores)
- **Accessibility badges** (WCAG)
- **Regular updates** mandated

### 14.3 Agency network

**Partner tiers:**

- **Discovery** (entry, training provided)
- **Select** (proven track record)
- **Expert** (case studies, certifications)
- **Platinum** (top tier, co-marketing)

**Benefits:**

- Lead generation
- Training resources
- Early access to features
- Co-marketing
- Revenue share (referrals)
- **Directory in admin** (merchants find partners easily)

### 14.4 Developer program

**Public API + developer tools:**

- **Full docs** (searchable, versioned)
- **Sandbox environments** (free, unlimited)
- **Webhooks testing** tools
- **Rate limit transparency**
- **SLA guarantees**
- **Postman collections**
- **OpenAPI specs**
- **GraphQL schema**
- **Code generators**

### 14.5 AI agent marketplace (novinka)

**Unikátní feature:**

- **Pre-built AI agents** per use-case
- **Customer service agent**
- **Sales rep agent**
- **B2B procurement agent**
- **Personal shopper agent**
- **Analytics agent**
- **Buy, try, deploy** in minutes
- **Custom agents** from developers

### 14.6 Data marketplace

**With merchant consent:**

- **Benchmark data** (anonymized, aggregated)
- **Trend reports** (by industry, by country)
- **Pricing intelligence**
- **Customer insights** (anonymized cohorts)

**Merchants** can **opt-in** to share (anonymous) in exchange for insights.

### 14.7 Ecosystem partnerships

**Strategic integrations pre-built:**

- **ERPs:** SAP, Microsoft Dynamics, Oracle, NetSuite, Odoo
- **CRMs:** Salesforce, HubSpot, Pipedrive, Zoho
- **Email:** Mailchimp, Klaviyo, Brevo, HubSpot, ActiveCampaign
- **Analytics:** GA4, Matomo, Mixpanel, Amplitude
- **Customer support:** Zendesk, Intercom, Freshdesk, Front
- **Accounting:** (covered in localization)
- **Payments:** (covered in localization)
- **Shipping:** (covered in localization)

### 14.8 Webhook & automation platform

**Built-in iPaaS:**

- **Native integration** with Zapier, Make, n8n, Workato
- **Custom webhook** builder (visual)
- **Automation templates** library
- **Event bus** (subscribe to any event)
- **Retry logic**
- **Error handling**

### 14.9 Headless starter kits

**Open source starters:**

- **Next.js** starter (best-in-class)
- **Nuxt.js** starter
- **Astro** starter
- **Remix** starter
- **SvelteKit** starter
- **Solid Start** starter
- **React Native** (mobile)
- **Flutter** (mobile)

**All on GitHub, MIT licence, community-maintained.**

### 14.10 Hackathons & events

**Build ecosystem:**

- **Annual conference** (our own)
- **Monthly webinars**
- **Quarterly hackathons**
- **Developer workshops**
- **Merchant summits**
- **Regional meetups** (every country)

### 14.11 Open-source contributions

**Publicly release:**

- **Storefront starter kits**
- **Admin UI components**
- **SDK source code**
- **Reference implementations**
- **Community** contributions encouraged
- **Transparent roadmap**

---

## 15. Cenová strategie

**Radikálně férový pricing. No surprises.**

### 15.1 Philosophy

**Principles:**

1. **No transaction fees ever** (unless using our processor)
2. **All features in every tier** (differenciace jen kapacitou)
3. **Transparent scaling** (predictable as business grows)
4. **EU VAT inclusive** (ceny s DPH jasné)
5. **Multi-currency** pricing (platíte v local currency)
6. **No forced upgrade** (features unlock, not take away)

### 15.2 Tier structure

**4 tiers + Enterprise:**

#### Free tier (Launch)

**€0/měs. forever**

- **10 produktů**
- **100 orders/měs.**
- **Our domain** (merchant.ourplatform.com)
- **Community support**
- **All features included** (marketplace, B2B, everything)
- **Agent-native** built-in
- **Limited:** bandwidth, storage

**Pro koho:** startups testing idea, hobby merchants, students

#### Starter – €29/měs.

- **1 000 produktů**
- **1 000 orders/měs.**
- **Custom domain**
- **Email support**
- **All features**
- **Mobile app** (branded, published)
- **B2B features** included

**Pro koho:** small merchants, side businesses

#### Growth – €99/měs.

- **25 000 produktů**
- **25 000 orders/měs.**
- **Priority support**
- **Advanced analytics**
- **Multi-currency**
- **Multi-language** (unlimited)
- **3 users**
- **A/B testing**

**Pro koho:** growing businesses, mid-market

#### Scale – €299/měs.

- **Unlimited products**
- **100 000 orders/měs.**
- **24/7 support**
- **Dedicated success manager** (limited)
- **10 users**
- **Priority AI features**
- **Advanced B2B** (punch-out catalogs, enterprise SSO)
- **Custom SLA**

**Pro koho:** successful mid-market, B2B operations

#### Enterprise – custom

- **Custom everything**
- **Dedicated infrastructure** option
- **Dedicated account manager**
- **Custom SLAs**
- **White-glove migration**
- **On-premise** option
- **Custom contracts**

### 15.3 Co není zpoplatněno navíc

**V ceně všech tarifů:**

- ✅ All marketplaces selling (TikTok, IG, FB, Amazon, eBay, Allegro)
- ✅ B2B features
- ✅ Multi-language, multi-currency
- ✅ AI Copilot
- ✅ Agent-native features
- ✅ Branded mobile app
- ✅ POS module
- ✅ All payment gateways (you pay gateway fees only)
- ✅ All shipping providers
- ✅ Local integrations (all countries)
- ✅ Compliance tools (GDPR, CSRD)
- ✅ API access (unlimited)
- ✅ Headless storefront
- ✅ Real-time collaboration

### 15.4 Tiers jsou o kapacitě, ne funkcích

**Limity škálují s:**

- **Produkty** (10 → 1k → 25k → unlimited)
- **Orders/month**
- **Team members**
- **Bandwidth**
- **Storage**
- **API calls**
- **Support level**

### 15.5 No transaction fees

**Unlike Shopify:**

- Shopify Basic: 2 % transakční fee pro non-Shopify Payments
- Shopify Plus: 0.5 %

**Náš model:**

- **0 % transaction fees** vždy
- Merchants mohou použít **jakoukoliv platební bránu**
- **Freedom of choice**

### 15.6 Fair usage

**Hybrid model:**

- **Tier base price**
- **Overage** charges transparent (if exceed limits)
- **Auto-upgrade** option
- **Never unexpected** bills

### 15.7 Add-ons (optional)

**Pokud chcete víc:**

- **Additional mobile app features** (in-app purchases, etc.)
- **Advanced AI** packages
- **Custom development** hours
- **Professional services**

### 15.8 Commission model (marketplace sellers)

**Multi-vendor marketplace:**

- **Platform charges merchant** (as above)
- **Merchant sets commissions** with vendors
- **We don't take a cut** of vendor sales
- **Transparent**

### 15.9 Anti-lock-in pricing

**Merchant can:**

- **Downgrade anytime**
- **Pause subscription**
- **Cancel with 30-day notice**
- **Export all data** anytime
- **Migrate out** (we assist)

### 15.10 Competitive comparison

| Platform        | Entry   | Mid-tier         | Top standard          | Transaction fees |
| --------------- | ------- | ---------------- | --------------------- | ---------------- |
| **Shopify**     | $29     | $299             | $2 000+ (Plus)        | 0.5-2%           |
| **BigCommerce** | $29     | $299             | $1 000+               | 0%               |
| **Shopware**    | €0 (CE) | €2 400 (Evolve)  | €6 500+ (Beyond)      | 0%               |
| **Wix**         | $17     | $36              | $159                  | 0%               |
| **Shoptet**     | 0 Kč    | 1 999 Kč (Profi) | 3 749 Kč (Enterprise) | 0%               |
| **Upgates**     | 450 Kč  | 2 100 Kč (Gold)  | 3 250 Kč (Platinum)   | 0%               |
| **Náš**         | **€0**  | **€99 (Growth)** | **€299 (Scale)**      | **0% always**    |

**Naše Growth €99 ≈ Shopify Basic ($29) + všechny apps needed.**

### 15.11 Why merchants switch

**TCO comparison pro mid-market:**

**Shopify Plus + apps:** ~€30 000 / rok
**Shopware Evolve + agency:** ~€100 000 / rok
**Shoptet Enterprise + doplňky + custom dev:** ~€20 000 / rok
**Naše platforma Scale:** **~€3 600 / rok + optional services**

**10-25x cheaper** pro equivalent functionality.

---

## 16. Go-to-market strategy

### 16.1 Phase 1: Foundation (2026)

**Focus:**

- CZ + SK launch
- Core platform stable
- Agent-native features v1
- 500 pilot merchants
- Community building

**Targets:**

- 1 000 active merchants end of 2026
- €500k ARR
- NPS 50+

### 16.2 Phase 2: CEE expansion (2027)

**Focus:**

- PL, HU, RO, BG launch
- Marketplace features
- More integrations
- Agency network building

**Targets:**

- 10 000 merchants
- €10M ARR
- 50 partner agencies

### 16.3 Phase 3: DACH + Benelux (2028)

**Focus:**

- DE, AT, CH, NL, BE launch
- Enterprise tier
- Advanced B2B push
- MACH Alliance membership

**Targets:**

- 50 000 merchants
- €75M ARR
- 200 partner agencies

### 16.4 Phase 4: Nordics + Southern Europe (2029)

**Focus:**

- SE, NO, DK, FI, IE, UK, IT, ES, FR, PT
- Scale infrastructure
- Big enterprise wins

**Targets:**

- 150 000 merchants
- €250M ARR

### 16.5 Phase 5: Global / IPO (2030)

**Focus:**

- US market entry
- Asia-Pacific (Japan, Australia)
- IPO preparation
- Mature ecosystem

**Targets:**

- 500 000 merchants
- €1B ARR
- Global presence

### 16.6 Customer acquisition channels

**Organic:**

- **Content marketing** (SEO, thought leadership)
- **Open source** (GitHub projekty)
- **Community** (forum, Discord, Reddit)
- **Developer evangelism**

**Paid:**

- **Google Ads** (targeted)
- **LinkedIn Ads** (B2B focused)
- **Podcasts** (e-commerce, tech)
- **Trade shows** (e-shop expos)

**Partnership:**

- **Agencies** (primary channel for mid-market+)
- **Integrators** (ERP, CRM partners)
- **Consultants** (referrals)

**Viral:**

- **Referral program** (merchant → merchant)
- **Affiliate program** (bloggers, influencers)
- **Free tier** (try before buy)

### 16.7 Pricing strategy launch

**Aggressive pricing to gain market share:**

- **Free tier generous**
- **First year 50 % off** for early adopters
- **Migration assistance free** (from any platform)
- **6 months free** if coming from Magento 1 / Shopware 5 (replatforming)

### 16.8 Marketing positioning

**Primary tagline:**

> _"The commerce platform built for the agent era. Native in every country. Fair by design."_

**Alternate:**

- _"Stop paying per feature. Start paying for growth."_
- _"Your local platform, globally capable."_
- _"B2B. B2C. D2C. C2C. One platform. One price."_

### 16.9 Thought leadership

**Build authority:**

- **Annual state of EU e-commerce** report
- **Agentic commerce playbook** (first comprehensive)
- **Sustainability in commerce** guide
- **Open source** projects

**Voice in industry:**

- **Conferences** speaking
- **Podcasts** guesting
- **Media** commentary
- **Analyst** relations

### 16.10 Customer success

**White-glove onboarding:**

- **Dedicated migrations** team
- **Free migration** services (from any platform)
- **Data migration** tools
- **Theme migration** tools
- **Training programs**
- **Certification** merchants

---

## 17. Konkurenční positioning

### 17.1 Position matrix

**Pro každého konkurenta unikátní hook:**

**vs. Shopify:**

- **No transaction fees**
- **B2B v Basic** (ne až Plus)
- **EU-native** (ne US-first)
- **Better privacy** (data ownership)
- **Open ecosystem** (ne walled garden)

**vs. Shopware:**

- **10x cheaper** for equivalent
- **No setup complexity**
- **CZ/CEE native** out-of-box
- **No Fair Usage Policy** restrictions
- **Modern UX** (less complex)

**vs. Shoptet:**

- **Skutečný globální** expansion
- **Lepší design**
- **AI-first**
- **True B2B**
- **Headless**

**vs. Upgates:**

- **Větší komunita**
- **Globální dosah**
- **API v ceně**
- **AI-first**

**vs. Wix / Squarespace:**

- **Serious commerce** features
- **B2B capability**
- **Enterprise-ready**
- **Developer-friendly**

**vs. BigCommerce:**

- **Better UX**
- **EU-first**
- **Free mobile app**
- **Agentic commerce**

**vs. Ecwid:**

- **Full platform** (not just embed)
- **Branded mobile app** v ceně (ne $99)

### 17.2 Ideal Customer Profiles (ICPs)

**ICP 1: Growing CZ/SK B2B manufacturer**

- Currently: Shoptet Enterprise + doplňky, or custom Magento
- Pain: Can't expand internationally, B2B features basic
- Our value: Shopware-level B2B + CZ native + international in ceně

**ICP 2: DACH mid-market replatformer**

- Currently: Shopware 5 (legacy) or Magento 1
- Pain: Platform obsolete, migration looming
- Our value: Modern Shopware-quality + better DX + cheaper

**ICP 3: D2C brand expanding to CEE**

- Currently: Shopify or Shopify Plus
- Pain: Shopify weak for CZ/PL/RO, high transaction fees
- Our value: CEE native + no fees + similar UX

**ICP 4: Fast-growing marketplace**

- Currently: Custom development
- Pain: Maintenance nightmare, rigid
- Our value: Multi-vendor platform out-of-box + full customizability

**ICP 5: Sustainability-focused brand**

- Currently: Shopify + many apps
- Pain: ESG reporting manual, no circular commerce
- Our value: CSRD automated + circular commerce native

**ICP 6: AI-forward startup**

- Currently: Shopify
- Pain: AI features limited, can't leverage agents
- Our value: Agent-native from day one

### 17.3 Battle cards

**Pro sales tým** – quick reference pro competitive situations:

**"Why not Shopify?"**

- Transaction fees 0.5-2 %
- Apps add €500-5 000/měs.
- Weak in CEE
- Data stays with Shopify
- B2B only in Plus

**"Why not Shopware?"**

- €600-6 500/měs. license
- €20k-200k setup
- Needs dev team
- Weak CZ integration
- Complex UX

**"Why not Shoptet?"**

- Can't expand beyond CZ/SK
- Design limited
- AI minimal
- Closed ecosystem

### 17.4 Migration incentives

**Free migration from any platform:**

- **Automated migration tools**
- **Data integrity** guaranteed
- **No downtime**
- **SEO preservation**
- **Training included**
- **6 months free** if coming from specific platforms

### 17.5 Customer testimonials strategy

**Early wins to highlight:**

- **Replatform from Shopware 5** case study
- **€1M GMV growth** case study
- **Multi-country expansion** case study
- **B2B transformation** case study
- **Agentic commerce pioneer** case study

---

## 18. Roadmap 2026–2030

### 18.1 2026: Foundation year

**Q1 2026:**

- Core platform MVP
- CZ + SK launch
- Agent-native v1 (MCP server)
- Free tier + Starter + Growth tarifs

**Q2 2026:**

- Scale tier
- Mobile app (iOS + Android)
- B2B Components (v Starter)
- 100 pilot merchants

**Q3 2026:**

- POS module
- Real-time collaboration v1
- Marketplace module
- 500 merchants

**Q4 2026:**

- CSRD reporting
- Advanced AI Copilot
- Social commerce unified
- 1 000 merchants

### 18.2 2027: CEE expansion + composable

**Q1 2027:**

- Polish launch (InPost, Allegro, BLIK, PL legal)
- Hungarian launch (Árukereső, SimplePay)

**Q2 2027:**

- Composable modules (swap-in CMS, search, etc.)
- Developer SDK v1
- GraphQL API stable

**Q3 2027:**

- Romanian launch (eMag, eFactura)
- Bulgarian launch
- Multi-vendor marketplace v2

**Q4 2027:**

- 10 000 merchants
- Live shopping
- AR/VR commerce
- Voice commerce

### 18.3 2028: DACH + Benelux + agentic boom

**Q1 2028:**

- DE launch (DATEV, Klarna, DHL, Amazon DE)
- AT launch
- MACH Alliance member

**Q2 2028:**

- NL launch (iDEAL, Bol.com, PostNL)
- BE launch (Bancontact)
- A2A agent commerce

**Q3 2028:**

- CH launch
- AEO/ACO tools v2
- Digital Product Passport

**Q4 2028:**

- 50 000 merchants
- Enterprise tier mature
- Big brand wins

### 18.4 2029: Nordics + Southern Europe

**Q1 2029:** SE, NO launch
**Q2 2029:** DK, FI launch
**Q3 2029:** IT, ES, FR launch
**Q4 2029:** UK, IE, PT launch

**End of 2029:** 150 000 merchants

### 18.5 2030: Global scale + IPO prep

**Q1 2030:** US market entry
**Q2 2030:** Asia-Pacific pilot
**Q3 2030:** IPO preparation
**Q4 2030:** Ecosystem mature

**End of 2030:** 500 000 merchants, €1B ARR

### 18.6 Technology roadmap

**2026:**

- Stable v1 platform
- Agent-native v1
- AI Copilot v1
- Real-time collab

**2027:**

- Composable modules
- Better AI (own models)
- Edge computing
- Performance optimization

**2028:**

- A2A commerce
- AR/VR native
- Voice commerce
- Quantum-safe crypto prep

**2029:**

- Fully autonomous AI agents
- Predictive commerce mature
- IoT commerce
- Metaverse commerce (if still relevant)

**2030:**

- Next-gen interfaces (brain-computer?)
- Global infrastructure
- Commerce OS platform
- New paradigms

---

## 19. Rizika a mitigation

### 19.1 Risk: Shopify / Shopware react

**Risk:** Big players copy our features.

**Mitigation:**

- **First-mover** in agent-native (12-24 month head start)
- **Deep EU integrations** (2+ years build time)
- **Community moat** (merchants + devs + agencies)
- **Data network effects**
- **Keep innovating** ahead

### 19.2 Risk: Funding / runway

**Risk:** Building this requires €50-100M investment.

**Mitigation:**

- **Staged rollout** (CZ/SK first, prove model)
- **Revenue from day 1** (paid tiers)
- **Open source** parts (community contribution)
- **Strategic investors** (Earlybird, Index, Accel, Sequoia)
- **Grant opportunities** (EU Digital Europe Programme)

### 19.3 Risk: Technical complexity

**Risk:** Too ambitious, can't deliver.

**Mitigation:**

- **Modular architecture** (ship incrementally)
- **Leverage open source** (don't reinvent)
- **Core team senior** (10+ years e-commerce experience)
- **Strategic advisors** (ex-Shopify, ex-Shopware leadership)

### 19.4 Risk: Market timing (agentic)

**Risk:** Agentic commerce slower than expected.

**Mitigation:**

- **Non-agentic features** still best-in-class
- **Can pivot emphasis** easily
- **Other pillars** valuable alone
- **Adjacent markets** (regular e-commerce)

### 19.5 Risk: Regulatory changes

**Risk:** EU regulation changes break features.

**Mitigation:**

- **Compliance team** dedicated
- **Legal partners** in every country
- **Architectural flexibility**
- **Regulatory monitoring** tools

### 19.6 Risk: Ecosystem chicken-and-egg

**Risk:** No apps → no merchants → no apps.

**Mitigation:**

- **Build core integrations** ourselves (top 100 apps)
- **Dev incentives** (favorable revenue share)
- **Agency partnerships** early
- **Migration tools** (port apps from Shopify)

### 19.7 Risk: Localization bandwidth

**Risk:** 30+ countries = huge engineering burden.

**Mitigation:**

- **Phased rollout** (not all at once)
- **Local partners** for country-specific
- **Acquisition strategy** (buy local platform in target country)
- **Community contributions** (some integrations crowdsourced)

### 19.8 Risk: AI hallucinations / quality

**Risk:** AI features unreliable, hurt merchants.

**Mitigation:**

- **Human-in-the-loop** everywhere initially
- **Opt-in** AI features
- **Quality benchmarks** per feature
- **Rapid iteration**
- **Multiple model** providers

### 19.9 Risk: Talent acquisition

**Risk:** Can't hire enough senior engineers.

**Mitigation:**

- **Remote-first** (global talent pool)
- **Competitive compensation** (equity + salary)
- **Meaningful mission** (EU sovereignty in commerce)
- **Strong engineering brand** (open source, blog posts)

### 19.10 Risk: Customer acquisition cost

**Risk:** CAC too high, unit economics bad.

**Mitigation:**

- **Free tier** as lead gen
- **Community-driven** growth
- **Partner-led** (agencies do sales)
- **Content marketing** (organic)
- **Product-led growth**

---

## 20. Závěr a souhrn USP

### 20.1 Top 10 unique selling points

1. **Agent-native commerce** – první platforma built for 2026-2030 AI agent era
2. **Radikální lokalizace** – nativní v 30+ evropských zemích (ne přes pluginy)
3. **B2B/B2C/D2C/C2C v entry tarifu** – žádný forced upgrade
4. **True composable** – MACH flexibility s non-technical UX
5. **Sustainability & CSRD native** – EU Green Deal compliance auto
6. **Privacy-first & data ownership** – EU-sovereign, merchant owns data
7. **Unified Commerce 15+ kanálů** – z jednoho dashboardu
8. **Real-time collaboration** – Figma/Notion UX pro commerce
9. **Predictive everything** – AI předvídá, ne jen asistuje
10. **Fair, transparent pricing** – žádné transaction fees, features nescreenují

### 20.2 Vision statement

> _"We believe commerce should be open, fair, and localized. We're building the platform merchants wish Shopify, Shopware, and the rest had become. A platform that belongs to Europe. That speaks every European language natively. That's ready for the agent era. That doesn't force upgrades or take cuts of your sales. That grows with you from €0 to €1B GMV — without migration."_

### 20.3 Why now

**Three converging tailwinds:**

1. **Agentic commerce** – technological shift, first-mover opportunity
2. **EU digital sovereignty** – regulatory tailwind
3. **Composable mainstream** – architectural shift

**Waiting 2 years = too late.** Need to build now.

### 20.4 What success looks like (5 years)

**End of 2030:**

- **500 000+ merchants**
- **€1B+ ARR**
- **Leading platform in CEE, competitive in DACH, emerging in Nordics**
- **Ecosystem of 5 000+ apps**
- **Partner network of 1 000+ agencies**
- **IPO-ready**
- **New commerce paradigm established**

### 20.5 First 90 days action items

**Week 1-4:**

- Core team hiring
- Tech stack decisions
- Investor outreach
- Domain / brand

**Week 5-8:**

- Architecture design
- Prototyping (agent-native kernel)
- Early partner conversations
- Pilot merchant recruitment

**Week 9-12:**

- Alpha platform (closed)
- First pilot merchants onboarded
- Feedback iteration
- Marketing positioning finalized

### 20.6 Klíčová otázka pro rozhodování

**Jsme ochotni investovat 5-7 let a €100M+ do budování platformy, která fundamentálně předefinuje e-commerce v Evropě?**

Pokud ano → tato strategie je blueprint.
Pokud ne → lepší zvolit úzký niche a dominovat tam.

---

### Závěrečná tabulka: Kde jsme lepší než všichni

| Kategorie                       | Shopify  | Wix      | Squarespace | BigCommerce | Ecwid          | Shoptet | Upgates  | Shopware | **My**           |
| ------------------------------- | -------- | -------- | ----------- | ----------- | -------------- | ------- | -------- | -------- | ---------------- |
| **Agent-native**                | ⭐⭐     | ⭐       | ⭐          | ⭐          | ⭐             | ⭐      | ⭐       | ⭐⭐     | **⭐⭐⭐⭐⭐**   |
| **EU multi-country native**     | ⭐⭐⭐   | ⭐⭐⭐   | ⭐⭐        | ⭐⭐        | ⭐⭐           | ⭐⭐    | ⭐⭐     | ⭐⭐⭐   | **⭐⭐⭐⭐⭐**   |
| **B2B v entry**                 | ⭐       | ⭐       | ⭐          | ⭐⭐⭐      | ⭐             | ⭐      | ⭐⭐⭐⭐ | ⭐       | **⭐⭐⭐⭐⭐**   |
| **Composable (non-tech)**       | ⭐⭐     | ⭐⭐     | ⭐⭐        | ⭐⭐⭐      | ⭐             | ⭐      | ⭐⭐     | ⭐⭐⭐   | **⭐⭐⭐⭐⭐**   |
| **Sustainability/CSRD**         | ⭐⭐⭐   | ⭐       | ⭐          | ⭐⭐        | ⭐             | ⭐      | ⭐       | ⭐⭐     | **⭐⭐⭐⭐⭐**   |
| **Privacy/data ownership**      | ⭐⭐     | ⭐⭐     | ⭐⭐        | ⭐⭐⭐      | ⭐⭐           | ⭐⭐⭐  | ⭐⭐⭐   | ⭐⭐⭐   | **⭐⭐⭐⭐⭐**   |
| **Unified Commerce 15+ kanálů** | ⭐⭐⭐⭐ | ⭐⭐⭐   | ⭐⭐        | ⭐⭐⭐      | ⭐⭐⭐         | ⭐⭐    | ⭐⭐     | ⭐⭐⭐   | **⭐⭐⭐⭐⭐**   |
| **Real-time collaboration**     | ⭐       | ⭐⭐     | ⭐⭐        | ⭐          | ⭐             | ⭐      | ⭐       | ⭐       | **⭐⭐⭐⭐⭐**   |
| **Predictive AI**               | ⭐⭐⭐   | ⭐⭐⭐⭐ | ⭐⭐⭐      | ⭐⭐        | ⭐⭐           | ⭐⭐    | ⭐⭐     | ⭐⭐⭐   | **⭐⭐⭐⭐⭐**   |
| **Open ecosystem**              | ⭐⭐⭐   | ⭐⭐     | ⭐⭐        | ⭐⭐⭐      | ⭐⭐           | ⭐⭐    | ⭐⭐     | ⭐⭐⭐⭐ | **⭐⭐⭐⭐⭐**   |
| **No transaction fees**         | ❌       | ✅       | ✅          | ✅          | ✅             | ✅      | ✅       | ✅       | **✅**           |
| **Branded mobile app**          | partial  | partial  | ❌          | ❌          | ✅ (Unlimited) | ❌      | ❌       | partial  | **✅ all tiers** |
| **Free tier**                   | ❌       | ✅       | ❌          | ❌          | ✅             | ✅      | ❌       | ✅ (CE)  | **✅**           |
| **Entry price**                 | $29      | $17      | $16         | $29         | $0             | 0 Kč    | 450 Kč   | €0/€600  | **€0/€29**       |

---

_Dokument vytvořen na základě hloubkové analýzy 8 e-commerce platforem (Shopify, Wix, Squarespace, BigCommerce, Ecwid, Shoptet, Upgates, Shopware Cloud) a strategického výhledu na trendy 2026–2030 (agentic commerce, composable, sustainability, EU regulatory landscape). Duben 2026._
