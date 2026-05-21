# Shopware Cloud – Kompletní hloubková analýza všech funkcí, modulů a featur

> **Stav:** duben 2026 (zahrnuty Shopware 6.7 features, AI Copilot, Fair Usage Policy 2025, cloud-first strategie, nové plány Rise/Evolve/Beyond)
> **Rozsah:** celá platforma Shopware 6 Cloud – Community Edition, Rise, Evolve, Beyond, AI Copilot, B2B Components, Shopping Experiences, Rule/Flow Builder, headless commerce
> **Zdroje:** oficiální Shopware dokumentace (shopware.com, docs.shopware.com, store.shopware.com), Shopware Community Day announcements, nezávislé analýzy

---

## Obsah

1. [Co je Shopware a firemní kontext](#1-co-je-shopware-a-firemní-kontext)
2. [Shopware 6 – architektura platformy](#2-shopware-6--architektura-platformy)
3. [Community Edition vs. Commercial Plans](#3-community-edition-vs-commercial-plans)
4. [Tarify a cenové plány](#4-tarify-a-cenové-plány)
5. [Fair Usage Policy 2025](#5-fair-usage-policy-2025)
6. [Cloud vs. Self-Hosted](#6-cloud-vs-self-hosted)
7. [Shopware Administration](#7-shopware-administration)
8. [Shopping Experiences – CMS a storytelling](#8-shopping-experiences--cms-a-storytelling)
9. [Rule Builder – pravidlový engine](#9-rule-builder--pravidlový-engine)
10. [Flow Builder – business automatizace](#10-flow-builder--business-automatizace)
11. [AI Copilot – AI funkce](#11-ai-copilot--ai-funkce)
12. [Produkty a katalog](#12-produkty-a-katalog)
13. [Skladové hospodářství a Multi-Inventory](#13-skladové-hospodářství-a-multi-inventory)
14. [Objednávky a fulfillment](#14-objednávky-a-fulfillment)
15. [Zákazníci a customer groups](#15-zákazníci-a-customer-groups)
16. [Checkout a platební brány](#16-checkout-a-platební-brány)
17. [Doprava a dodání](#17-doprava-a-dodání)
18. [Daně a compliance](#18-daně-a-compliance)
19. [Multi-language a multi-currency](#19-multi-language-a-multi-currency)
20. [Sales Channels – multi-channel strategie](#20-sales-channels--multi-channel-strategie)
21. [B2B Components – pokročilé B2B](#21-b2b-components--pokročilé-b2b)
22. [Advanced Search – Elasticsearch](#22-advanced-search--elasticsearch)
23. [Marketing a personalizace](#23-marketing-a-personalizace)
24. [SEO a obsah](#24-seo-a-obsah)
25. [Analytika a reporting](#25-analytika-a-reporting)
26. [Developer platforma – API a plugins](#26-developer-platforma--api-a-plugins)
27. [Shopware Store – plugin ecosystem](#27-shopware-store--plugin-ecosystem)
28. [Headless commerce a storefronts](#28-headless-commerce-a-storefronts)
29. [Bezpečnost, hosting a infrastruktura](#29-bezpečnost-hosting-a-infrastruktura)
30. [Podpora a komunita](#30-podpora-a-komunita)
31. [Známá omezení a nevýhody](#31-známá-omezení-a-nevýhody)

---

## 1. Co je Shopware a firemní kontext

Shopware je **německá e-commerce platforma** – jeden z nejuznávanějších hráčů v DACH regionu (Německo, Rakousko, Švýcarsko) a rostoucí v celé Evropě. Kombinuje **open-source flexibilitu** s **enterprise-grade funkčností**.

**Zakladatel:** Stefan Hamann (spolu s bratrem Sebastianem)

**Klíčová čísla (2026):**

- **100 000+ aktivních obchodů** po celém světě
- **~30 % tržní podíl** v DACH regionu (Německo, Rakousko)
- Silný růst v **Nizozemsku, Belgii, UK, CEE**
- **Headquartery:** Schöppingen, Německo
- **Zaměstnanci:** 400+
- **Členem MACH Alliance** (microservices, API-first, cloud-native, headless)

**Historie:**

- **2000:** Založení
- **2007:** První verze Shopware
- **2019:** Shopware 6 spuštěn (kompletně přepracovaná platforma)
- **2022:** Nové pricing plány – Rise, Evolve, Beyond (cloud-first approach)
- **2024 (duben):** Shopware 6.6 release
- **2025 (březen):** Fair Usage Policy (Community Edition do 1M EUR GMV)
- **2025 (červen):** Shopware 6.7 release
- **2025–2026:** AI Copilot expanze
- **2026:** Agentic commerce initiative

**Pozicování:**

- **"Professional e-commerce for mid-market and enterprise"**
- **B2B-first s silnou B2C support** (oproti Shopify, který je B2C-first)
- **Open Source + Commercial** model (flexibility + enterprise features)
- **Cílová skupina:** střední a velké obchody, B2B manufacturers, D2C brands
- **DACH lídr** – přirozená volba pro německé/rakouské/švýcarské obchody
- **#2 na evropském enterprise trhu** (po Adobe Commerce/Magento)

**Silné stránky:**

- **Open Source core** (Community Edition zdarma)
- **Nejlepší native B2B** v mid-market segmentu
- **Headless-first** (API-first architektura od 6.0)
- **Shopping Experiences** (unikátní CMS pro kreativní obchody)
- **Rule Builder a Flow Builder** (pokročilé automatizace bez kódu)
- **AI Copilot** (nejmodernější AI v e-commerce platformách 2026)
- **Silná komunita v DACH** (1 000+ agentur)
- **Multi-inventory, multi-warehouse** nativně (Beyond)
- **Advanced Search** (Elasticsearch-based)
- **Customizovatelnost** neomezená (díky open-source)

**Slabé stránky:**

- **Drahé commercial plány** (Rise €600, Evolve €2 400, Beyond €6 500/měs.)
- **Vysoké setup costs** (mid-market €20 000–50 000, enterprise €100 000+)
- **Potřeba developera** pro pokročilou customizaci
- **Menší ekosystém než Shopify** (~5 000 pluginů vs. 8 000+)
- **Slabší AI než Wix** (i když rapidně dohání)
- **Méně šablon** než Shopify
- **Steep learning curve**
- **Pro ČR specifické integrace** omezené (žádné nativní GoPay, Zásilkovna, Heureka)

**ČR/SR kontext:**

- Používaný v ČR zejména **mid-market B2B obchody** (strojírenství, automotive, velkoobchody)
- **Sílící přítomnost** díky DACH orientaci (obchody prodávající do Německa)
- **Chybí nativní CZ integrace** (musí přes pluginy nebo custom dev)
- **České partnerské agentury** existují (např. Shopsys, Kiwee, Netdirect)
- **Lokalizace storefrontu** dobrá (čeština plně podporovaná přes plugin)

---

## 2. Shopware 6 – architektura platformy

**Shopware 6** je kompletně přepracovaná verze (2019) postavená na moderních technologiích. To je **signifikantně odlišné od Shopware 5** (legacy).

### 2.1 Technologický stack

**Backend:**

- **PHP 8.1+** (povinné)
- **Symfony framework** (profesionální PHP framework)
- **Doctrine ORM** (databáze abstrakce)
- **MySQL 8.0+** nebo **MariaDB 10.11+**
- **Elasticsearch** (search, doporučeno od 10 000 produktů)
- **RabbitMQ** (message queue, background processes)

**Frontend:**

- **Twig** templating
- **Vue.js** (admin UI)
- **Bootstrap 5** (default storefront)
- **Twig + Vue možné pro custom**

**Architecture:**

- **API-first** (REST + GraphQL)
- **Headless-ready**
- **Microservices architecture**
- **MACH Alliance member**

### 2.2 Shopware 5 vs. Shopware 6

**Shopware 5 (legacy):**

- Starší verze (deprecated)
- Support ending
- Mnoho obchodů stále používá
- Omezený roadmap

**Shopware 6 (current):**

- Moderní architecture
- API-first
- Active development
- Plugin ecosystem v 6
- Cloud-first approach

### 2.3 Verze a release cycle

**Major verze (2024–2026):**

- **6.5** (2023)
- **6.6** (duben 2024) – major upgrade
- **6.7** (červen 2025) – major upgrade, AI Copilot launched
- **6.8** (plánované 2026) – agentic commerce

**Minor verze každé cca 6 týdnů** s features a bugfixy.

### 2.4 Modulární architektura

**Shopware 6 je modulární:**

- **Core** = Community Edition (open-source)
- **Commercial plugins** = pro Rise, Evolve, Beyond
- **B2B Components** = separátní plugin (Evolve+)
- **AI Copilot** = plugin (Rise+)
- **Custom plugins** = vlastní funkce
- **Third-party plugins** = Shopware Store

### 2.5 Cloud-first strategie (2022+)

Shopware pivot k cloudovému modelu:

- **SaaS cloud hosting** (jako Shopify)
- **Fully managed**
- **Auto-updates**
- **Auto-scaling**
- **Stále self-hosted option** dostupná

### 2.6 API-first design

**Všechno je API:**

- Admin API (pro management)
- Storefront API (pro nákupní experience)
- GraphQL Storefront API
- Webhooks
- REST API

**Výsledek:**

- Můžete napojit cokoliv
- Headless storefronty
- Multi-channel experience
- Vlastní integrace

### 2.7 Design system (Meteor)

**Meteor Design System** – Shopware's unified component library:

- React components pro admin
- Vue 3 components
- TypeScript
- Accessible (WCAG)
- Storybook documentation

---

## 3. Community Edition vs. Commercial Plans

Toto je **klíčový koncept Shopware** – existuje zdarma Community Edition a placené commercial plány.

### 3.1 Community Edition (Open Source)

**Free forever** pod **MIT licencí** (nejpermissivnější open-source licence).

**Co zahrnuje:**

- **Všechny základní e-commerce funkce**
- Produkty, kategorie, objednávky
- Shopping Experiences (limited)
- Rule Builder
- Flow Builder (limited)
- Storefront (default theme)
- Multi-language
- Multi-currency
- API access
- Self-hosting
- Plugin ecosystem (tisíce pluginů)

**Co NENÍ:**

- AI Copilot
- B2B Components
- Advanced Search (Elasticsearch)
- Multi-Inventory
- Advanced SLA
- Shopware Support (paid)
- Commercial Shopping Experiences features

### 3.2 Fair Usage Policy 2025 ⚠️

**Kritická změna od března 2025:**

**Community Edition je zdarma do 1 milionu EUR GMV ročně.**

Nad tuto hranici merchants musí:

1. **Upgrade na Rise/Evolve/Beyond** (placené plány)
2. Nebo **custom contract** s Shopware
3. Nebo **zůstat na Community Edition bez podpory** (s rizikem)

**Důvod:** Shopware chce podporovat profi merchants a mít revenue z větších obchodů.

### 3.3 Commercial Plans

**Rise, Evolve, Beyond:**

- Zahrnují Community Edition **+ commercial features**
- **SaaS cloud** nebo **self-hosted** (licence platí v obou)
- **Support** a **SLA**
- **AI Copilot, B2B Components, atd.**

### 3.4 Professional Edition a Enterprise Edition (legacy)

**Shopware 5 používal** Professional a Enterprise editions.

**V Shopware 6** nahrazeno:

- Professional → **Rise** + **Evolve**
- Enterprise → **Beyond**

### 3.5 Kdy vystačí Community Edition

**CE je vhodná pro:**

- Menší obchody (do 1M EUR GMV)
- Merchants s technickým týmem
- Development studios testující platformu
- Rychlý start bez nákladů

### 3.6 Kdy je potřeba upgrade

**Commercial plán potřebujete pro:**

- GMV nad 1 milion EUR (Fair Usage Policy)
- B2B features (B2B Components)
- AI Copilot
- Multi-Inventory
- Advanced Search
- Official support a SLA

---

## 4. Tarify a cenové plány

Shopware má **4 tiery v 2026:**

### 4.1 Community Edition – €0 (open source)

- **Zdarma** do 1 milionu EUR GMV/rok (Fair Usage Policy 2025)
- **Open source** pod MIT licencí
- **Self-hosted** (vy hostujete)
- **Základní funkce**
- **Komunita support** (fórum, Discord)
- **Žádný oficiální support**

**Náklady:**

- License: €0
- Hosting: €20–500/měs. (podle provideru)
- Development: €5 000–50 000 setup
- Pluginy: €0–€200/měs. každý

### 4.2 Rise – od €600/měsíčně

**Entry-level commercial plan.**

- **B2C a D2C obchody**
- **Up to small-medium obchody**
- Cena se **škáluje s GMV**

**Co přidává k CE:**

- **AI Copilot** (základní)
- **Shopping Experiences** (pokročilé)
- **SLA support** (standardní)
- **Cloud hosting** (optional)
- **Extension licenses**

**Setup cost:** €20 000–50 000 (agency implementation)

**Pro koho:** Střední B2C/D2C obchody, startupy s rozpočtem

### 4.3 Evolve – od €2 400/měsíčně

**Middle tier, positioned as bestseller.**

- **Mid-market obchody**
- **B2B + B2C hybrid**
- Cena **škáluje s GMV**

**Co přidává k Rise:**

- **B2B Components** (kompletní B2B suite) ✅
- **Advanced Search** (Elasticsearch)
- **Advanced Flow Builder** (more automations)
- **Webhooks unlimited**
- **Multi-language management**
- **Priority support SLA**
- **Custom pricing per customer**

**B2B Components zahrnují:**

- Quote management
- Customer-specific pricing
- Budget management
- Role-based access
- Order approval workflows
- Quick orders
- Shopping lists
- Employee management

**Setup cost:** €50 000–100 000+

**Pro koho:** Mid-market B2B/B2C obchody, velkoobchody

### 4.4 Beyond – od €6 500/měsíčně (custom)

**Enterprise tier.**

- **Large enterprise obchody**
- **Complex requirements**
- Cena **plně custom** (podle GMV a requirements)

**Co přidává k Evolve:**

- **Multi-Inventory** (multi-warehouse, stock allocation)
- **24/7 support** (dedicated team)
- **Custom SLA** (guaranteed uptime, response time)
- **Dedicated account manager**
- **Custom pricing tiers** (very advanced)
- **Priority development** requests
- **Enterprise integrations**

**Setup cost:** €100 000–500 000+

**Pro koho:** Enterprise, large B2B, multi-country operations

### 4.5 Srovnávací tabulka

| Funkce               | Community | Rise     | Evolve      | Beyond      |
| -------------------- | --------- | -------- | ----------- | ----------- |
| Cena/měs.            | €0        | €600     | €2 400      | €6 500+     |
| GMV limit            | 1M EUR    | škáluje  | škáluje     | škáluje     |
| Open source core     | ✅        | ✅       | ✅          | ✅          |
| Cloud hosting        | ❌        | ✅       | ✅          | ✅          |
| Self-hosted          | ✅        | ✅       | ✅          | ✅          |
| Shopping Experiences | limited   | ✅       | ✅          | ✅          |
| AI Copilot           | ❌        | ✅ basic | ✅ full     | ✅ full     |
| Rule Builder         | ✅        | ✅       | ✅          | ✅          |
| Flow Builder         | limited   | ✅       | ✅ advanced | ✅ advanced |
| Advanced Search      | ❌        | ❌       | ✅          | ✅          |
| B2B Components       | ❌        | ❌       | ✅          | ✅          |
| Multi-Inventory      | ❌        | ❌       | ❌          | ✅          |
| Support              | community | standard | priority    | 24/7        |
| Account manager      | ❌        | ❌       | limited     | dedicated   |
| SLA                  | ❌        | standard | priority    | enterprise  |

### 4.6 First-year TCO (total cost of ownership)

**Podle nezávislých analýz pro professional obchod:**

| Tier          | License (year) | Setup      | Development | Hosting  | Plugins | Total year 1   |
| ------------- | -------------- | ---------- | ----------- | -------- | ------- | -------------- |
| **Community** | €0             | €5–15k     | €10–30k     | €2–5k    | €1–5k   | **€18–55k**    |
| **Rise**      | €7 200         | €20–50k    | €15–30k     | included | €1–5k   | **€43–92k**    |
| **Evolve**    | €28 800        | €50–100k   | €30–50k     | included | €2–10k  | **€111–189k**  |
| **Beyond**    | €78 000+       | €100–200k+ | €50–100k+   | included | €5–20k  | **€233–398k+** |

**Tři-roční TCO pro mid-market (Evolve):** **cca €287 000**

### 4.7 Srovnání s konkurencí

| Platforma               | Entry commercial | Mid-market       | Enterprise           |
| ----------------------- | ---------------- | ---------------- | -------------------- |
| **Shopify**             | $29 (Basic)      | $299 (Advanced)  | $2 000+ (Plus)       |
| **BigCommerce**         | $29 (Standard)   | $299 (Pro)       | $1 000+ (Enterprise) |
| **Shopware**            | €600 (Rise)      | €2 400 (Evolve)  | €6 500+ (Beyond)     |
| **Adobe Commerce**      | -                | €22 000+ (Cloud) | €60 000+             |
| **Salesforce Commerce** | -                | -                | €100 000+            |

**Shopware je:**

- **Dražší** než Shopify, BigCommerce
- **Levnější** než Adobe Commerce, Salesforce
- **Pozice:** premium mid-market/enterprise

### 4.8 Proč je Shopware dražší než Shopify

**Shopware pro merchants platí víc za:**

- Native B2B funkce (Shopify vyžaduje Plus + apps)
- Advanced customization flexibility
- Open source foundation
- Enterprise-grade features
- European/DACH preferences
- Premium support

**Shopify pro merchants platí víc za:**

- Transaction fees (2% Basic, 0.5% Plus)
- Apps ecosystem (mnoho funkcí jen přes placené apps)
- Currency conversion fees
- Payment gateway restriction

**Při srovnání TCO na 3 roky pro B2B mid-market** může Shopware vyjít **levněji nebo srovnatelně** s Shopify Plus + apps.

### 4.9 Scaling pricing

**Evolve a Beyond** cena škáluje s:

- **GMV** (gross merchandise value)
- **Počet API volání**
- **Počet storefrontů**
- **Další individual factors**

Pro konkrétní cenu je **nutno kontaktovat Shopware sales**.

MARKDOWN_EOF
wc -l /home/claude/shopware/shopware-cloud-kompletni-analyza.md

---

## 5. Fair Usage Policy 2025

V **březnu 2025** Shopware spustil **Fair Usage Policy** – signifikantní změna v tom, jak je Community Edition dostupná.

### 5.1 Co se změnilo

**Před Fair Usage Policy:**

- Community Edition zdarma **bez jakýchkoliv limitů**
- I velké obchody používaly CE bez platby
- Shopware ztrácel revenue od velkých merchants

**Po Fair Usage Policy 2025:**

- **Community Edition zdarma jen do 1 milionu EUR GMV ročně**
- Nad tuto hranici: **nutný upgrade** na Rise/Evolve/Beyond
- Nebo custom contract se Shopware
- Cílem je **fair share** revenue od velkých merchants

### 5.2 Jak se GMV měří

- **Celkové tržby obchodu za rok**
- **Včetně DPH**
- **Sledováno Shopware** (přes telemetrii / reporty)
- **Roční vyhodnocení**

### 5.3 Co se stane při překročení

**Shopware vás kontaktuje:**

1. Notifikace 3–6 měsíců předem
2. Nabídka upgradu (Rise typically)
3. Custom enterprise contract negotiation
4. Timeline na upgrade

**Pokud merchant neupgrade:**

- Continued use je technicky možný (MIT licence)
- Ale bez support, bez security updates garance
- Reputační riziko
- Shopware může pozastavit access k marketplaces features

### 5.4 Reakce komunity

**Pozitivní:**

- Fair model pro platform development
- Podporuje profesionální merchants
- Jasná pravidla

**Negativní:**

- Omezení "truly free" přístupu
- Menší flexibilita pro rostoucí obchody
- Nutnost predikce GMV

### 5.5 Alternativy

**Pro merchants nad 1M EUR nechtějící upgrade:**

- **Adobe Commerce** (dražší)
- **Medusa** (open source headless)
- **Sylius** (Symfony-based open source)
- **Shopify Plus**
- **BigCommerce Enterprise**

### 5.6 Dopad na ČR merchants

**V ČR je 1M EUR (~25M Kč) GMV docela significant** – většina českých obchodů je pod touto hranicí:

- Malé a střední obchody (do 25M Kč tržeb) → Community Edition bezplatně
- Větší obchody → nutný upgrade nebo migrace

---

## 6. Cloud vs. Self-Hosted

Shopware nabízí **dvě deployment options** – cloud SaaS nebo self-hosted.

### 6.1 Shopware Cloud (SaaS)

**Fully managed Shopware:**

- Shopware hostuje platformu
- Auto-updates, security patches
- Auto-scaling
- Bez správy serverů
- Podobně jako Shopify

**Klíčové výhody:**

- ✅ Žádná správa infrastruktury
- ✅ Automatic updates
- ✅ Built-in CDN
- ✅ Security handling
- ✅ Compliance (GDPR, PCI)
- ✅ Performance monitoring

**Omezení:**

- ❌ Menší flexibilita custom backend modifikací
- ❌ Omezené některé plugins vyžadující server access
- ❌ Platíte Shopware za hosting
- ❌ Lock-in na Shopware cloud infrastrukturu

### 6.2 Self-Hosted Shopware

**Vy hostujete Shopware** (na vlastním serveru nebo cloud providera).

**Klíčové výhody:**

- ✅ **Plná kontrola** nad infrastrukturou
- ✅ **Custom server configurations**
- ✅ **Výběr vlastního hosting providera** (AWS, Hetzner, OVH, atd.)
- ✅ **Custom integrace** bez omezení
- ✅ **Lokální hosting** pro compliance (EU data)
- ✅ **Community Edition zdarma** bez měsíčních poplatků

**Omezení:**

- ❌ **Vaše odpovědnost** za updates, security
- ❌ **Server management** (DevOps know-how)
- ❌ **Scaling** sami
- ❌ **Downtime risk** pokud není dobře nastavené

### 6.3 Hosting requirements (Self-Hosted)

**Minimální požadavky:**

- **PHP 8.1+** (nutné)
- **MySQL 8.0+** nebo **MariaDB 10.11+**
- **Elasticsearch** (doporučeno pro 10 000+ produktů)
- **RabbitMQ** (Flow Builder background processes)
- **Redis / Memcached** (caching)
- **Min. 2 GB RAM** (nebo 4 GB pro production)
- **SSD storage** nezbytné
- **HTTPS SSL certifikát**

**Doporučená infrastructure:**

- **Load balancer**
- **Multi-server setup** pro production
- **CDN** (Cloudflare, AWS CloudFront)
- **Database clustering**
- **Backup strategy**

### 6.4 Typical hosting costs (Self-Hosted)

| Velikost obchodu              | Monthly hosting |
| ----------------------------- | --------------- |
| **Small (Community Edition)** | €20–80          |
| **Medium (1-10k products)**   | €100–300        |
| **Large (10k+ products)**     | €300–1 000      |
| **Enterprise**                | €1 000–5 000+   |

### 6.5 Cloud pricing vs. Self-hosted

**Cloud (Rise/Evolve/Beyond):**

- Hosting **zahrnut v license fee**
- No hidden costs
- Predikovatelné

**Self-hosted (Community Edition):**

- License €0
- Hosting €20–1 000+/měs. sami
- Potřeba DevOps

**Self-hosted (Rise/Evolve/Beyond):**

- License fee
- - hosting costs sami
- Menší pro cloud merchants

### 6.6 Kdy cloud, kdy self-hosted

**Cloud vhodné pro:**

- Merchants bez DevOps týmu
- Rychlý time-to-market
- Menší obchody (do 10k produktů)
- Focus na byznys, ne na infrastructure

**Self-hosted vhodné pro:**

- Merchants s technickým týmem
- Custom infrastructure requirements
- Plná flexibilita custom development
- GDPR compliance (EU servers, specific datacentrá)
- Enterprise s dedicated hosting preferencí

### 6.7 Hybrid approach

**Populární model v DACH:**

- **Self-hosted** pro production (flexibility)
- **Shopware Cloud** pro staging/dev
- **Hybrid CDN** (Shopware + vlastní)

### 6.8 ČR/SR specifika

Pro české merchants **self-hosted preferovaný**, protože:

- Možnost hostingu v ČR (Active24, Wedos, WEBGLOBE)
- Lokální dev agencies (Shopsys, Kiwee) preferují self-hosted
- Flexibility pro CZ-specific integrace
- Levnější dlouhodobě

---

## 7. Shopware Administration

Shopware admin je **Vue.js-based**, moderní a pokročilé rozhraní pro správu obchodu.

### 7.1 Technologie

- **Vue 3** framework
- **Meteor Design System** (Shopware's component library)
- **Twig + Vue** pro templating
- **Responsive** (funguje na tabletech, limited mobile)

### 7.2 Dashboard

**Homepage admina:**

- Sales overview (dnes, týden, měsíc)
- Recent orders
- Top products
- Customer activity
- Quick actions
- Notifications
- News od Shopware

### 7.3 Hlavní sekce

**Catalogues:**

- **Products** (CRUD)
- **Categories**
- **Properties**
- **Manufacturers**
- **Reviews**

**Orders:**

- **Orders overview**
- **Documents** (invoices, delivery notes)
- **Returns**

**Customers:**

- **Customer database**
- **Groups**
- **Address management**

**Content:**

- **Shopping Experiences** (unikátní CMS)
- **CMS pages**
- **Layouts**
- **Email templates**
- **Blog (přes plugin)**

**Marketing:**

- **Promotions**
- **Newsletter**
- **Vouchers**

**Sales Channels:**

- **Multi-storefront management**

**Extensions:**

- **My extensions**
- **Shopware Store**

**Settings:**

- **Shop settings**
- **Languages, currencies**
- **Taxes**
- **Shipping, payments**
- **API access**
- **Rule Builder**
- **Flow Builder**

### 7.4 Role-based permissions

**Pokročilé role management:**

- **Admin** (full access)
- **Shop manager**
- **Content manager**
- **Customer service**
- **Custom roles** (granular permissions)

### 7.5 Activity log

- **Audit trail** všech změn
- **User actions**
- **IP tracking**
- **Compliance reports**

### 7.6 Multi-user

- **Unlimited admin users**
- **Concurrent access**
- **Collaboration features**
- **Activity tracking**

### 7.7 Customizace admina

- **Custom pages** (přes pluginy)
- **Dashboard widgets**
- **Custom modules**
- **Theming admin UI**

### 7.8 Admin API

- Admin functions přes API
- Automation
- External tool integration
- Programmatic management

### 7.9 Language support

**Admin dostupný v:**

- Angličtina (výchozí)
- **Němčina** (primární)
- Francouzština
- Italština
- Španělština
- Polština
- **Čeština** (přes plugin Internationalization Czech Republic)
- Další jazyky

### 7.10 Search

- **Global search** napříč admin
- **Fulltext** přes produkty, zákazníky, objednávky
- **Keyboard shortcuts**

### 7.11 Srovnání admin UX

| Platforma       | Admin quality                                |
| --------------- | -------------------------------------------- |
| **Shopify**     | ⭐⭐⭐⭐⭐ (nejlepší UX v oboru)             |
| **Shopware**    | ⭐⭐⭐⭐ (moderní, ale steep learning curve) |
| **BigCommerce** | ⭐⭐⭐⭐                                     |
| **Wix**         | ⭐⭐⭐⭐                                     |
| **Shoptet**     | ⭐⭐⭐                                       |
| **Upgates**     | ⭐⭐⭐⭐                                     |

**Shopware admin je pokročilejší**, ale **komplikovanější pro začátečníky**.

---

## 8. Shopping Experiences – CMS a storytelling

**Shopping Experiences** (historicky "Experience Worlds") je jedním z **nejunikátnějších features Shopware** – pokročilý drag-and-drop CMS pro storytelling.

### 8.1 Co je Shopping Experiences

- **Drag-and-drop visual builder**
- **Pro content-rich pages** (homepage, landing pages, kategorie)
- **Target storytelling** (nikoli jen produktové listing)
- **Per-customer group** content (!)
- **Bez technických znalostí**

### 8.2 Typy bloků

**Content:**

- **Image blocks** (full-width, grid, gallery)
- **Video blocks** (YouTube, Vimeo, self-hosted)
- **Text blocks** (rich text editor)
- **Hero banners**
- **Carousels**

**Commerce:**

- **Product slider**
- **Product box**
- **Product listing** (filtered)
- **Category display**
- **Featured products**

**Interactive:**

- **Forms**
- **Accordions / FAQs**
- **Tabs**
- **Countdowns**
- **Maps**
- **Social media embeds**

**Custom:**

- **HTML/Twig** custom blocks
- **JavaScript** embeddable widgets

### 8.3 Personalization per Customer Group

**Unikátní feature:**

- **Different content** pro B2B vs. B2C
- **Different prices** zobrazení
- **Different hero banners**
- **Different featured products**
- Pomocí **Rule Builder** integrace

### 8.4 Responsive design

- **Automatic responsive**
- **Custom breakpoints**
- **Per-device preview**
- **Mobile-first design**

### 8.5 Preview a publishing

- **Live preview** jak bude vypadat
- **Save as draft**
- **Scheduled publishing** (od data X)
- **A/B testing** (přes Evolve+)
- **Rollback** to previous version

### 8.6 Template library

- **Shopware provides templates**
- **Partner templates**
- **Custom templates** (save for reuse)

### 8.7 Use cases

**B2C:**

- Homepage s hero bannerem + storytelling
- Landing pages pro marketing kampaně
- Seasonal themes (Christmas, Black Friday)
- Category pages s rich content
- About Us, Story pages

**B2B:**

- **Personalized per customer group** homepages
- **Industry-specific** landing pages
- **Product catalog** rich presentation
- **Technical documentation** integration
- **Sales material** showcase

### 8.8 AI Copilot integrace v Shopping Experiences

**AI Copilot | content:**

- **Generate text content** (headlines, descriptions)
- **Spellcheck**
- **Translate** do jiných jazyků
- **Generate images** z promptů

Výrazně zrychluje tvorbu obsahu.

### 8.9 Rule Builder v Shopping Experiences

- **Conditional content** (visible jen za určitých podmínek)
- **Time-based** content (akce od-do)
- **Customer-group-based**
- **Location-based**
- **Cart-based** (personalized based on co mají v košíku)

### 8.10 Srovnání s konkurencí

| Platforma                           | Visual CMS                                  |
| ----------------------------------- | ------------------------------------------- |
| **Shopware Shopping Experiences**   | ⭐⭐⭐⭐⭐ (best-in-class pro B2B commerce) |
| **Shopify Sections / Theme Editor** | ⭐⭐⭐⭐                                    |
| **BigCommerce Page Builder**        | ⭐⭐⭐⭐ (+ Makeswift)                      |
| **Wix Editor**                      | ⭐⭐⭐⭐⭐ (best pro design-first)          |
| **Squarespace Fluid Engine**        | ⭐⭐⭐⭐⭐                                  |
| **Shoptet**                         | ⭐⭐⭐                                      |
| **Upgates Designer**                | ⭐⭐⭐⭐                                    |

**Shopware Shopping Experiences je unikátní** v **B2B commerce segmentu** – žádná konkurence nenabízí tak pokročilé personalization per customer group.

---

## 9. Rule Builder – pravidlový engine

**Rule Builder** je jedna z **nejsilnějších featur Shopware** – vizuální engine pro vytváření business pravidel bez kódu.

### 9.1 Co Rule Builder umí

**Vytvořte pravidlo jednou, použijte všude:**

- Různé ceny pro různé zákaznické skupiny
- Slevy za určitých podmínek
- Conditional shipping costs
- Custom content zobrazení
- Promoce a kupony
- Payment method availability

### 9.2 Struktura pravidel

**Pravidlo = IF (podmínky) THEN (akce):**

**Podmínky (conditions):**

- Customer attributes (group, country, VAT)
- Order attributes (total, items, weight)
- Product attributes (category, brand, tags)
- Time/date
- Location
- Session attributes
- Line items

**Akce (actions):**

- Apply discount
- Show/hide content
- Enable/disable payment method
- Enable/disable shipping method
- Send email (Flow Builder trigger)
- Custom action (přes plugin)

### 9.3 Globální logika

**Klíčový design principle:**

- **Pravidlo vytvoříte jednou**
- **Použijete napříč systémem:**
  - V promocích
  - V shipping rules
  - V payment rules
  - V Shopping Experiences
  - V Flow Builder workflows

### 9.4 Composed rules

- **Nest pravidla** (rule within rule)
- **AND / OR** logika
- **NOT conditions**
- **Complex expressions**

### 9.5 Examples pravidel

**Příklad 1: B2B discount**

```
IF customer_group = "Wholesale" AND cart_total >= 1000 EUR
THEN apply 15% discount
```

**Příklad 2: Free shipping**

```
IF country = "Germany" AND cart_total >= 50 EUR
THEN shipping = FREE
```

**Příklad 3: VIP content**

```
IF customer_tag = "VIP" AND cart_items > 3
THEN show Shopping Experience "VIP_Promo"
```

### 9.6 Integrace s Flow Builder

Rule Builder pravidla triggerují Flow Builder automatizace:

- Pravidlo je "podmínka"
- Flow Builder je "akce" (email, webhook, data update)

### 9.7 Rule builder UI

- **Drag-and-drop**
- **Visual representation**
- **Test mode** (preview jak pravidlo funguje)
- **Validation** (error detection)
- **Version control** (historie změn)

### 9.8 Dostupnost

**Rule Builder v ceně:**

- **Community Edition** ✅
- **Rise** ✅
- **Evolve** ✅
- **Beyond** ✅

(Na rozdíl od některých konkurentů, kde podobné features jsou za paywall.)

### 9.9 Srovnání

| Platforma                  | Rule engine                |
| -------------------------- | -------------------------- |
| **Shopware Rule Builder**  | ⭐⭐⭐⭐⭐ (best-in-class) |
| **Shopify Flow (Plus)**    | ⭐⭐⭐⭐                   |
| **BigCommerce Promotions** | ⭐⭐⭐                     |
| **Adobe Commerce Rules**   | ⭐⭐⭐⭐                   |
| **Shoptet**                | ⭐⭐ (basic)               |
| **Upgates**                | ⭐⭐ (basic)               |

Shopware Rule Builder je **v ceně i v Community Edition** – mimořádná hodnota.

---

## 10. Flow Builder – business automatizace

**Flow Builder** je engine pro **business process automation** – workflow bez kódu.

### 10.1 Co Flow Builder umí

**Trigger → Actions:**

- Když se něco stane (trigger), proveď akce
- **Multi-step workflows**
- **Conditional branches**
- **Delays and scheduling**
- **Integration with Rule Builder**

### 10.2 Triggers (spouštěče)

**Order events:**

- Order placed
- Order paid
- Order shipped
- Order delivered
- Order cancelled
- Order status change

**Customer events:**

- Customer registered
- Customer logged in
- Customer placed first order
- Customer reached loyalty tier
- Customer birthday

**Product events:**

- Product low stock
- Product back in stock
- Product created/updated
- Product deleted

**Cart events:**

- Cart abandoned
- Cart updated
- Product added to cart

**Custom events:**

- Webhook triggers
- API triggers
- Time-based (cron-like)
- Plugin triggers

### 10.3 Actions (akce)

**Communication:**

- **Send email** (to customer, admin, custom)
- **Send SMS** (via plugin)
- **Slack notification**
- **Webhook call**

**Data operations:**

- **Update order status**
- **Update customer data**
- **Tag customer**
- **Tag product**
- **Update custom fields**

**Marketing:**

- **Add to newsletter**
- **Apply discount**
- **Send voucher**

**Integration:**

- **Sync to ERP/CRM** (webhook)
- **Sync to email marketing** tool
- **Sync to analytics**

**Custom:**

- **Custom plugin actions**
- **PHP script execution**

### 10.4 Complex workflows

**Branching:**

- **IF/ELSE** logic
- **Parallel actions**
- **Sequential actions**
- **Wait steps** (delay X hours/days)

### 10.5 Example flows

**Abandoned cart recovery:**

```
TRIGGER: Cart abandoned
WAIT: 1 hour
ACTION: Send email "Don't forget your items"
WAIT: 23 hours
IF cart still abandoned:
    ACTION: Send email "10% off discount"
WAIT: 48 hours
IF cart still abandoned:
    ACTION: Add customer to "Lost customers" segment
```

**B2B onboarding:**

```
TRIGGER: B2B customer registered
ACTION: Send approval email to admin
IF admin approves:
    ACTION: Send welcome email to customer
    ACTION: Add to "Approved B2B" group
    ACTION: Send pricing catalog PDF
ELSE:
    ACTION: Send rejection email
```

**Stock low alert:**

```
TRIGGER: Product stock < 10
ACTION: Email warehouse manager
ACTION: Create reorder suggestion in ERP (webhook)
ACTION: Add product tag "Low stock"
```

### 10.6 Integration with external systems

**Webhooks pro:**

- **ERP systems** (SAP, Microsoft Dynamics, Sage)
- **CRM systems** (Salesforce, HubSpot)
- **Email marketing** (Mailchimp, Klaviyo)
- **Analytics** (Google, custom)
- **Accounting** (DATEV, Lexware, Pohoda)

### 10.7 Dostupnost

| Edition       | Flow Builder                             |
| ------------- | ---------------------------------------- |
| **Community** | ✅ limited                               |
| **Rise**      | ✅ standard                              |
| **Evolve**    | ✅ **advanced** (more triggers, actions) |
| **Beyond**    | ✅ **enterprise** (unlimited, custom)    |

### 10.8 RabbitMQ requirement

**Pro performant Flow Builder:**

- **RabbitMQ** message queue
- **Asynchronous processing**
- **Doesn't slow down storefront**
- **Scales to thousands of actions/hour**

### 10.9 Monitoring a debugging

- **Flow execution log**
- **Success/failure tracking**
- **Retry logic**
- **Error notifications**

### 10.10 Srovnání s konkurencí

| Platforma                 | Workflow automation   |
| ------------------------- | --------------------- |
| **Shopify Flow (Plus)**   | ⭐⭐⭐⭐⭐            |
| **Shopware Flow Builder** | ⭐⭐⭐⭐⭐            |
| **BigCommerce Workflows** | ⭐⭐⭐ (limited)      |
| **Adobe Commerce**        | ⭐⭐⭐⭐              |
| **Shoptet**               | ❌                    |
| **Upgates**               | ❌ (přes Zapier/Make) |

Shopware Flow Builder je **na úrovni Shopify Flow** – oba jsou best-in-class.

### 10.11 Zapier/Make integrace

Shopware podporuje externí automation platformy:

- **Zapier** (tisíce integrací)
- **Make** (Integromat) – populární v Evropě
- **n8n** (open source)

Kombinace **Flow Builder + external automation** = téměř neomezené možnosti.

---

## 11. AI Copilot – AI funkce

**Shopware AI Copilot** je nativní AI asistent v Shopware adminu, dostupný od verze **6.7+** (červen 2025) na placených plánech.

### 11.1 Co je AI Copilot

**AI asistent přímo v adminu:**

- Natural language queries
- Content generation
- Image analysis
- Data export assistance
- **GDPR-compliant** (EU data processing)
- **Bez nutnosti dalších extensions**

### 11.2 Hlavní features

**Chat-based knowledge assistant:**

- Instant answers o features
- Best practices advice
- Configuration guides
- Troubleshooting
- Tailored to your Shopware version and plan

**On-demand guidance:**

- Contextual help v admin
- "How do I...?" questions
- Step-by-step guidance

**AI-powered export assistant:**

- **Natural language queries**
- "Give me all yesterday's orders"
- Converts to database queries
- **CSV preview**
- Export with one click

**AI-driven content tools:**

- **Product descriptions** generation
- **Translations** into any language
- **Review summaries**
- **Custom checkout messages**
- **Image generation** from prompts
- **Context and image-based product search**

### 11.3 AI Copilot | content pro Shopping Experiences

- **Generate text** pro různé types obsahu
- **Spellcheck**
- **Translate** do libovolného jazyka
- **Tone adjustment** (formal, casual, enthusiastic)

### 11.4 AI Copilot | image keyword assistant

- **Upload image**
- **AI analyzes** image
- **Assigns relevant keywords**
- Improves **SEO and search**
- Auto-tag obrázky v media library

### 11.5 AI Copilot | product properties suggestion

- **Based on product description**
- **AI suggests properties** (color, size, material)
- **Auto-fill** product forms
- Rychlejší product creation

### 11.6 AI Copilot | custom checkout message

- **AI-generated message** po nákupu
- **Based on cart contents**
- **Personalized přístup**
- **Increases customer loyalty**

### 11.7 AI Copilot | natural language data export

**Převratný feature:**

- "Show me all B2B customers who ordered more than €1 000 last month"
- **AI translates** into database query
- **Preview results**
- **Export as CSV**

Bez SQL znalostí!

### 11.8 AI Copilot | customer tags

- **AI analyzes** customer behavior
- **Creates tags** ("Bargain hunter", "VIP", "Inactive")
- **Clusters customers** for targeting
- **Suggests naming** and selection rules
- Use in **Rule Builder** for automation

### 11.9 GDPR compliance

- **Data processing in EU**
- **No personal data** sent to third-party AI services bez consent
- **Audit trail**
- **Configurable** data usage

### 11.10 Agentic commerce (roadmap 2026)

**Shopware announced agentic commerce:**

- **AI agents** making purchase decisions
- Preparation for **ChatGPT Commerce**, **Perplexity Commerce**
- **Structured data** for AI crawlers
- **LLM-ready APIs**

### 11.11 Dostupnost

| Edition       | AI Copilot                     |
| ------------- | ------------------------------ |
| **Community** | ❌ (self-implement AI)         |
| **Rise**      | ✅ basic                       |
| **Evolve**    | ✅ full                        |
| **Beyond**    | ✅ full + priority AI features |

### 11.12 Srovnání s konkurencí

| Platforma                           | AI stack                                  |
| ----------------------------------- | ----------------------------------------- |
| **Wix**                             | ⭐⭐⭐⭐⭐ (Astro, Harmony, Vibe, Base44) |
| **Shopify Sidekick**                | ⭐⭐⭐⭐                                  |
| **Squarespace Design Intelligence** | ⭐⭐⭐⭐                                  |
| **Shopware AI Copilot**             | ⭐⭐⭐⭐ (B2B focus)                      |
| **BigCommerce Feedonomics AI**      | ⭐⭐⭐                                    |
| **Shoptet**                         | ⭐⭐                                      |
| **Upgates**                         | ⭐⭐                                      |

**Shopware AI Copilot** je **silnější v B2B context** než konkurence – chat-based admin help + natural language exports jsou unique features.

### 11.13 Integration s dalšími AI nástroji

- **OpenAI API** (přes pluginy)
- **Claude API** (přes pluginy)
- **Azure AI** (enterprise)
- **Custom AI models** (self-hosted)

---

## 12. Produkty a katalog

### 12.1 Produktové údaje

**Core fields:**

- **Name**
- **Description** (rich text)
- **Short description**
- **Product number** (SKU)
- **EAN / UPC / ISBN**
- **Categories**
- **Manufacturer**
- **Price** (multi-currency)
- **Stock**
- **Weight, dimensions**
- **Tax class**
- **Delivery time**
- **Status** (active, inactive)

### 12.2 Kategorie

- **Unlimited hierarchical**
- **SEO-optimized URLs**
- **Category descriptions** (rich content)
- **Shopping Experiences per category**
- **Category-specific layouts**

### 12.3 Properties

**Advanced property system:**

- **Global properties** (color, size)
- **Custom properties**
- **Filterable** in storefront
- **Searchable**
- **Translation support**

### 12.4 Variants

- **Unlimited variants**
- **Generated from properties**
- **Per-variant:**
  - Price
  - Stock
  - Weight
  - SKU
  - Images
  - Custom fields

### 12.5 Cross-selling

- **Related products**
- **Upsells**
- **Cross-sells**
- **"Customers also bought"**
- **Recommendations** (AI-driven)

### 12.6 Product reviews

- **Native reviews system**
- **Star ratings (1-5)**
- **Photo reviews**
- **Admin moderation**
- **Email request po nákupu**
- **Schema.org markup** pro Google SERP
- **AI Copilot | review summaries** (Evolve+)

### 12.7 Product images

- **Unlimited images per product**
- **Automatic thumbnails**
- **Alt text**
- **Image ordering**
- **Variant-specific images**
- **Media management** centralizovaný

### 12.8 Custom fields

**Velmi pokročilé:**

- **Add custom fields** ke všem entities
- **Product, category, customer, order**
- **Types:** text, number, date, select, multi-select, rich text, JSON
- **Translatable**
- **Usable in Rule Builder, Flow Builder**

### 12.9 Digital products

- **Download products**
- **License keys**
- **Access after payment**
- **Download limits**
- **Expiration**

### 12.10 Configurable products

- **Product bundles**
- **Set products**
- **Configurable options**
- **B2B quote configuration**

### 12.11 Import / Export

**Formats:**

- **CSV**
- **XML**
- **JSON** (API)

**Import options:**

- **Bulk product import**
- **Update existing products**
- **Partial updates**
- **Custom mapping**
- **Validation**

### 12.12 Product streams

**Unique feature:**

- **Dynamic product groups** based on rules
- **Used in Shopping Experiences**
- **Auto-updating** categories
- Example: "All products with stock > 0 and price < €100"

### 12.13 SEO per product

- **Meta title** (per language)
- **Meta description**
- **Canonical URL**
- **Custom URL slug**
- **Schema.org Product markup**
- **Open Graph**
- **AI Copilot** může generate meta

### 12.14 Stock management

- **Per-warehouse stock** (Beyond: Multi-Inventory)
- **Reserved stock**
- **Low stock warnings**
- **Backorder settings**
- **"Available from" date**

### 12.15 Pricing

**Flexible pricing:**

- **Base price**
- **Tier pricing** (quantity discounts)
- **Customer group pricing** (B2B)
- **Promotional pricing**
- **Advanced pricing** (B2B Components)
- **Per-currency** pricing
- **Per-sales-channel** pricing

### 12.16 Product limits

**Šopware 6 je škálovatelný:**

- **Community Edition:** limited by hosting
- **Cloud plans:** scales with plan
- **Beyond:** millions of products

Real-world: obchody s **100 000+ produkty** running smoothly.

---

## 13. Skladové hospodářství a Multi-Inventory

### 13.1 Základní stock management

**Community Edition / Rise / Evolve:**

- **Single-warehouse stock**
- **Basic stock tracking**
- **Reserved stock**
- **Backorders**
- **Low stock alerts**

### 13.2 Multi-Inventory (Beyond only)

**Advanced warehouse management:**

- **Multiple warehouses**
- **Stock allocation** rules
- **Best warehouse** selection per order
- **Distance-based** fulfillment
- **Stock transfers**
- **Real-time sync**

### 13.3 Stock attribution

**Per-warehouse features:**

- **Stock per location**
- **Location priorities**
- **Availability calculation**
- **Split orders** across warehouses

### 13.4 Reservation system

- **Cart reservation** (nastavitelný timeout)
- **Order reservation**
- **Auto-release** při opuštění

### 13.5 Stock movements

- **Incoming** (receiving)
- **Outgoing** (shipping)
- **Transfers** between warehouses
- **Adjustments**
- **Write-offs**

### 13.6 Low stock alerts

- **Per-product threshold**
- **Email notifications**
- **Dashboard warnings**
- **Flow Builder triggers**

### 13.7 Backorders

- **Allow orders when out of stock**
- **Expected delivery date**
- **Customer notification**
- **Priority fulfillment**

### 13.8 Inventory reporting

- **Stock levels**
- **Movement history**
- **Turn-over rates**
- **Valuation reports**
- **Export to ERP**

### 13.9 ERP integration

**Shopware napojení na:**

- **SAP Business One**
- **Microsoft Dynamics 365**
- **Sage**
- **Odoo**
- **Plentymarkets**
- **JTL-Wawi** (populární v DACH)
- **Custom ERP** (API)

### 13.10 Warehouse Management Systems

**Integrace s WMS:**

- **Pickware** (populární v DACH)
- **Descartes**
- **Manhattan**
- **Custom WMS** (API)

### 13.11 Fulfillment services

**3PL integrations:**

- **Byrd**
- **DHL Supply Chain**
- **Amazon FBA** (přes plugin)
- **Custom 3PL** (API)

### 13.12 Barcode support

- **Barcode scanning** (via WMS)
- **Auto-print** labels
- **Quality control** workflows

### 13.13 Srovnání

| Platforma                  | Multi-warehouse                     |
| -------------------------- | ----------------------------------- |
| **Shopware Beyond**        | ⭐⭐⭐⭐⭐ (Multi-Inventory native) |
| **Shopify Plus**           | ⭐⭐⭐⭐                            |
| **BigCommerce Enterprise** | ⭐⭐⭐⭐                            |
| **Adobe Commerce**         | ⭐⭐⭐⭐⭐                          |
| **Shoptet**                | ⭐⭐⭐ (Enterprise sync)            |
| **Upgates**                | ⭐⭐                                |
| **Wix**                    | ⭐⭐⭐ (Enterprise)                 |

**Shopware Beyond Multi-Inventory** je na úrovni enterprise systémů.

---

## 14. Objednávky a fulfillment

### 14.1 Order lifecycle

**Default states:**

- **Open** (paid, ready to ship)
- **In progress** (picking, packing)
- **Completed** (shipped/delivered)
- **Cancelled**

**Customizable:** add custom states.

### 14.2 Order detail

- **Customer data**
- **Line items** s quantities, prices
- **Shipping** info
- **Payment** info
- **Documents** (invoice, delivery note, credit note)
- **Activity log**
- **Internal notes**
- **Customer notes**

### 14.3 Documents

**Auto-generated PDFs:**

- **Invoice**
- **Delivery note**
- **Credit note**
- **Cancellation invoice**
- **Storno invoice**

**Customizable:**

- Logo
- Colors
- Custom fields
- Multi-language

### 14.4 Payment statuses

- **Open**
- **Paid**
- **Partially paid**
- **Refunded**
- **Partially refunded**
- **Cancelled**
- **Failed**

### 14.5 Returns / refunds

**Return workflow:**

- **Customer initiates** return
- **Admin approves**
- **Return label** (shipping provider)
- **Refund** (payment provider)
- **Credit note** auto-generated
- **Stock adjustment**

### 14.6 Order notifications

**Automatic emails:**

- Order received
- Payment confirmed
- Order shipped
- Order delivered
- Order cancelled

**Customizable** per language, per sales channel.

### 14.7 Order approval workflows (B2B)

**B2B Components (Evolve+):**

- **Multi-level approvals**
- **Budget-based approvals**
- **Manager sign-off**
- **Automated approval**
- **Audit trail**

### 14.8 Draft orders

- **Admin creates order** for customer
- **Phone orders**
- **Quote-to-order** conversion
- **Send payment link**

### 14.9 Batch operations

- **Bulk state change**
- **Bulk shipping labels**
- **Bulk invoice generation**
- **Bulk email**
- **Bulk export**

### 14.10 Shipping integration

**Native shipping providers:**

- **DHL** (most popular in DACH)
- **UPS**
- **FedEx**
- **DPD**
- **Hermes** (DACH)
- **GLS**

**Přes pluginy:**

- **Zásilkovna / Packeta** (CZ/SK/EU)
- **Česká pošta** (CZ)
- **PPL** (CZ)
- **InPost** (PL)
- A další

### 14.11 Order export

- **CSV**
- **XML**
- **JSON** (API)
- **DATEV** (DACH accounting)
- **Lexware** (DACH)
- **Custom formats**

### 14.12 Fraud prevention

- **3D Secure 2**
- **Payment provider fraud scoring**
- **Custom rules** (Rule Builder)
- **Manual review** flagged orders

---

## 15. Zákazníci a customer groups

### 15.1 Customer database

- **Unlimited customers**
- **Full profile**
- **Addresses** (multiple shipping, billing)
- **Order history**
- **Custom fields**
- **Tags**
- **Activity timeline**

### 15.2 Customer groups

**Unique advantage Shopware:**

- **Unlimited customer groups**
- **Per-group pricing**
- **Per-group visibility** (products)
- **Per-group payment methods**
- **Per-group shipping methods**
- **Per-group Shopping Experiences content**

**Standard groups:**

- **Default** (retail)
- **Wholesale**
- **VIP**
- **Custom**

### 15.3 B2B customer attributes

**For B2B customers:**

- **Company name**
- **VAT ID** (validated via VIES)
- **Commercial registration**
- **Multiple contacts** (Employee Management)
- **Department**
- **Budget allocations**

### 15.4 Reverse charge

- **EU B2B reverse charge** automatic
- **VAT exempt** for valid VAT IDs
- **Non-EU export** tax handling

### 15.5 Customer registration

- **Default registration**
- **Double opt-in**
- **Account activation**
- **B2B separate registration**
- **Custom registration fields**

### 15.6 Customer login

- **Standard login**
- **Social login** (přes pluginy)
- **SSO** (enterprise)
- **2FA** (přes pluginy)
- **Magic links**

### 15.7 Customer account features

**Frontend customer account:**

- **Order history**
- **Order tracking**
- **Reorder**
- **Address management**
- **Payment methods**
- **Wishlist**
- **Saved carts**
- **Documents** (invoices download)
- **Returns**
- **Loyalty points** (přes pluginy)

### 15.8 Wishlist

- **Native wishlist**
- **Multiple wishlists** (přes pluginy)
- **Share wishlist URL**
- **Email alerts** (price drops)

### 15.9 Saved carts

- **Save cart for later**
- **Multiple saved carts**
- **Retrieve** anytime
- **B2B frequently ordered**

### 15.10 Customer tagging

**AI Copilot** integration:

- **AI-suggested tags**
- **Manual tagging**
- **Tags in Rule Builder**
- **Automated actions** based on tags

### 15.11 GDPR compliance

- **Consent management**
- **Data export** (customer request)
- **Right to erasure**
- **Anonymization**
- **Audit log**

### 15.12 Segmentation

**Advanced segmentation:**

- **By purchase history**
- **By product preferences**
- **By geography**
- **By behavior**
- **By AI-generated tags**
- **Used in marketing** automation

---

## 16. Checkout a platební brány

### 16.1 Checkout design

**Shopware's native checkout:**

- **Single-page checkout**
- **Step-based** (nastavitelné)
- **Guest checkout**
- **Account checkout**
- **Express checkout** (přes wallets)

### 16.2 Customization

- **Full theme control**
- **Custom steps**
- **Custom fields**
- **Conditional fields** (Rule Builder)
- **Multi-language**
- **Multi-currency**

### 16.3 Payment providers

**Native / most popular:**

- **PayPal**
- **Stripe** (free plugin)
- **Klarna** (BNPL populární v DACH)
- **Adyen**
- **Mollie**
- **Worldpay**
- **SOFORT** (DACH banking)

**Pay. plugin** (multi-payment):

- IN3, Riverty, Klarna, Giropay, SOFORT, iDEAL, Credit Cards, PayPal, Bancontact, a další
- **Single plugin** pro all payment methods

**Enterprise:**

- **Custom payment gateway**
- **Direct bank integrations**
- **Custom processors**

### 16.4 Pro ČR/SR specifické

**Chybí nativní integrace:**

- **GoPay** ❌ (nutno custom plugin nebo Pay. integration)
- **ComGate** ❌
- **ThePay** ❌
- **Shoptet Pay** ❌ (proprietary)

**Dostupné přes:**

- **Stripe** (mezinárodní, free plugin)
- **Pay.** (multi-method EU)
- **Custom development** (CZ agentura)
- **Mollie** (podporuje iDEAL, bank transfer)

⚠️ **Pro CZ trh je Shopware slabší** v oblasti platebních brán vs. Shoptet/Upgates.

### 16.5 Payment method rules

**Per Rule Builder:**

- **Enable/disable** payment per customer group
- **Min/max cart value** limits
- **Country restrictions**
- **Currency restrictions**
- **Product-based** restrictions

### 16.6 Multi-currency checkout

- **Automatic currency detection**
- **Manual currency switcher**
- **Exchange rates** (ECB automatic nebo custom)
- **Per-currency pricing** (custom)
- **Rounding rules**

### 16.7 BNPL (Buy Now Pay Later)

**Popular v DACH:**

- **Klarna**
- **PayPal Pay in 4**
- **Riverty**
- **Billie** (B2B BNPL)

### 16.8 B2B checkout

**B2B Components enhance checkout:**

- **Purchase order** payment
- **Net payment terms** (Net 14, 30, 60)
- **Invoice payment**
- **Budget approval** workflow
- **Multi-signatory** checkout

### 16.9 Express checkout

**Wallet support:**

- **Apple Pay**
- **Google Pay**
- **PayPal Express**
- **Shopify Pay** style one-click (via specific plugins)

### 16.10 Checkout conversion optimization

**Features pro vyšší conversion:**

- **Autofill** adres
- **Address validation**
- **Inline errors**
- **Loading states**
- **Trust signals** (security badges)
- **Reviews display**
- **Delivery estimates**

### 16.11 3D Secure 2

- **SCA compliance** (EU)
- **Built-in** all payment gateways
- **Friction-less flow** when possible

### 16.12 PCI compliance

- **PCI DSS Level 1** (Cloud)
- **Tokenization** (no card storage)
- **Self-hosted** vyžaduje vlastní compliance

### 16.13 Custom checkout workflows

**Pro B2B customization:**

- **Separate B2B checkout**
- **Quote-to-order** checkout
- **Approval step** před placením
- **Blanket orders** checkout

---

## 17. Doprava a dodání

### 17.1 Shipping methods

**Unlimited shipping methods:**

- Create custom names
- Per-sales-channel availability
- Per-country availability
- Per-customer-group availability

### 17.2 Shipping cost calculation

**Flexible pricing:**

- **Flat rate**
- **Weight-based** tiers
- **Price-based** (dle hodnoty košíku)
- **Quantity-based** (počet položek)
- **Distance-based** (Multi-Inventory)
- **Free shipping threshold**
- **Custom rules** (Rule Builder)

### 17.3 Native carrier integrations

**DACH focus:**

- **DHL** (nejvýznamnější v DACH)
- **UPS**
- **DPD**
- **GLS**
- **Hermes**

### 17.4 CZ/SK carriers

**Přes pluginy (ne nativně):**

- **Zásilkovna / Packeta** (community + paid pluginy)
- **Česká pošta** (custom pluginy)
- **PPL** (pluginy)
- **DPD CZ** (DPD Europe plugin pokrývá)
- **GLS CZ**

⚠️ **Slabší pokrytí** CZ dopravců oproti Shoptet/Upgates.

### 17.5 Shipping rules

**Via Rule Builder:**

- **Country restrictions**
- **Product-based** (velké, křehké)
- **Customer group** (B2B different shipping)
- **Min/max weight**
- **Combined with payment rules**

### 17.6 Pickup points

- **Store pickup**
- **Partner pickup** (přes pluginy – Zásilkovna Z-BOX, DHL Packstation)

### 17.7 Express shipping

- **Next-day delivery**
- **Same-day delivery** (DACH large cities)
- **Custom SLAs**

### 17.8 International shipping

- **Multi-country** shipping
- **Customs documents** auto (DDP/DDU)
- **EORI numbers** support
- **Tariff codes** (HS codes)
- **Customs value** calculation

### 17.9 Tracking

- **Carrier tracking integration**
- **Tracking numbers** auto-sync
- **Customer notifications**
- **Tracking page** (branded)

### 17.10 Fulfillment partners

**3PL:**

- **Byrd** (European 3PL)
- **DHL Supply Chain**
- **Amazon FBA**
- **Custom 3PL**

### 17.11 Dropshipping

- **Supplier sync**
- **Auto-forward** orders
- **Split orders** per supplier
- **Stock sync**

### 17.12 Returns shipping

- **Return labels** generation
- **Prepaid labels**
- **Customer self-service**
- **Return tracking**

---

## 18. Daně a compliance

### 18.1 Tax system

**Flexible tax management:**

- **Per-product tax class**
- **Per-category tax default**
- **Per-country rules**
- **EU VAT** compliance
- **Reverse charge** (B2B)
- **Export tax exemption**

### 18.2 Tax rates

**Configurable:**

- **DE rates:** 19%, 7%, 0%
- **AT rates:** 20%, 13%, 10%, 0%
- **CZ rates:** 21%, 15%, 10%, 0%
- **SK rates:** 20%, 10%, 0%
- **Custom rates**

### 18.3 VAT ID validation

- **VIES** API integration
- **Real-time validation**
- **Auto-assign** to customer group
- **Exemption** from VAT

### 18.4 Inclusive vs. exclusive pricing

**Per customer group:**

- **Retail:** prices with VAT
- **B2B:** prices without VAT (+ VAT displayed)
- **Mixed display** options

### 18.5 EU OSS (One Stop Shop)

- **Digital services** compliance
- **Distance selling** reporting
- **Export documentation**

### 18.6 Invoice compliance

**Per country:**

- **DE:** DATEV compatibility
- **AT:** RKSV (Registrierkasse)
- **CZ:** DUZP, dobropisy (via plugin)
- **Multi-language** invoices

### 18.7 GDPR compliance

- **Built-in consent** management
- **Cookie banner**
- **Data export** tools
- **Right to erasure**
- **Audit logs**
- **Privacy Policy** generator
- **DPA** agreements available

### 18.8 GoBD compliance (DACH)

- **German accounting standards**
- **Immutable records**
- **10-year retention**
- **Audit-ready exports**

### 18.9 Slovenian / Romanian e-invoicing

- **Compliance** with local e-invoicing requirements
- Přes pluginy a custom

### 18.10 Pro ČR specifika

**Český Internationalization plugin** (zdarma):

- **Překlad frontend + backend snippets**
- **Czech language** complete
- Základ pro CZ obchody

**Chybí nativně:**

- ❌ **ARES validation** (jako Shoptet má)
- ❌ **DUZP** automatic
- ❌ **Dobropisy** (české formát)
- ❌ **Recyklační příspěvky** (EKO-KOM)
- ❌ **Kontrolní hlášení**
- ❌ **Pohoda integration** (custom)

**Nutno custom nebo community pluginy** od českých agentur.

### 18.11 PCI DSS

- **Level 1 compliance** (Cloud)
- **Tokenization**
- **Secure payments**

### 18.12 SOC 2

- **Shopware Cloud** je **SOC 2 Type II** compliant (Beyond especially)

### 18.13 Certifikace

- **PCI DSS Level 1**
- **GDPR compliant**
- **SOC 2 Type II** (Cloud)
- **ISO 27001** (partial)
- **GoBD** (DACH accounting)

---

## 19. Multi-language a multi-currency

### 19.1 Multi-language core

**V ceně všech edicí** (Community includována):

- **Unlimited languages**
- **Per-storefront language**
- **Auto-translation** (AI Copilot)
- **Manual override**
- **Translation workflow**

### 19.2 Translation management

**Sekce přeložitelné:**

- **Products** (name, description, meta)
- **Categories**
- **Properties**
- **Shopping Experiences content**
- **CMS pages**
- **Email templates**
- **Admin UI** (per user)

### 19.3 Supported languages

**Plně podporované:**

- Němčina (primární)
- Angličtina (primární)
- Francouzština, italština, španělština
- Nizozemština, polština
- **Čeština** (plně přes plugin)
- Slovenština, maďarština, rumunština
- Bulharština, chorvatština
- A další

### 19.4 AI translations

**AI Copilot | translate:**

- **One-click translation** celého produktu
- **Batch translations** catalog
- **Editable** translations
- **Context-aware**

### 19.5 Multi-currency

**V ceně všech edicí:**

- **Unlimited currencies**
- **Per-storefront currency**
- **Per-customer currency**
- **Automatic exchange rates** (ECB)
- **Manual override** rates
- **Rounding rules**

### 19.6 Currency display

- **Symbol placement** (before/after)
- **Decimal separators**
- **Thousand separators**
- **Per-locale formatting**

### 19.7 Multi-storefront

**Sales Channels** umožňují:

- **Jeden Shopware → více storefrontů**
- **Per-storefront:**
  - Domain / URL
  - Language
  - Currency
  - Theme
  - Products (shared nebo exclusive)
  - Pricing
  - Payment methods
  - Shipping methods

### 19.8 Hreflang a SEO

- **Automatic hreflang**
- **Per-language sitemap**
- **Canonical** handling
- **Multi-region SEO**

### 19.9 Use case: DACH + CEE expansion

**Typický setup:**

- **Domain A:** DE, in German, EUR, DACH shipping
- **Domain B:** EN, in English, EUR, EU shipping
- **Domain C:** CZ, in Czech, CZK, CZ shipping
- **All managed** from one Shopware admin

### 19.10 Srovnání

| Platforma                        | Multi-language/currency    |
| -------------------------------- | -------------------------- |
| **Shopify Markets**              | ⭐⭐⭐⭐⭐                 |
| **BigCommerce Multi-Storefront** | ⭐⭐⭐⭐                   |
| **Shopware**                     | ⭐⭐⭐⭐⭐ (v ceně všech!) |
| **Wix**                          | ⭐⭐⭐⭐                   |
| **Shoptet**                      | ⭐⭐ (Profi/Enterprise)    |
| **Upgates**                      | ⭐⭐⭐⭐ (i v Bronze)      |

**Shopware má multi-language/currency v ceně všech tarifů** – stejně jako Upgates, lépe než Shoptet.

---

## 20. Sales Channels – multi-channel strategie

**Sales Channels** je Shopware koncept pro **multi-channel selling**.

### 20.1 Co je Sales Channel

**Self-contained obchodní kanál:**

- **Storefront** (website)
- **API channel** (headless, mobile app)
- **Marketplace integration** (Amazon, eBay)
- **Google Shopping feed**
- **Comparison engines**

### 20.2 Storefront Sales Channel

**Pro traditional websites:**

- **Default storefront** (Bootstrap-based)
- **Custom domain**
- **Unique theme**
- **Unique language/currency**
- **Unique product selection**

### 20.3 API Sales Channel

**Pro headless:**

- **REST + GraphQL API**
- **Custom frontend** (Next.js, Vue, React Native)
- **Mobile apps**
- **Progressive Web Apps**
- **Custom touchpoints**

### 20.4 Product Comparison Sales Channel

**Pro Google Shopping, srovnávače:**

- **Product feed export** (XML, CSV)
- **Google Merchant Center**
- **Facebook Catalog**
- **Comparison engines** (Heureka feed přes custom)

### 20.5 Multi-storefront use cases

**B2B + B2C hybrid:**

- Jeden storefront B2C, druhý B2B
- **Different pricing, products, payment methods**

**Geographic expansion:**

- Jeden per country
- **Local language, currency, shipping**

**Brand separation:**

- Multi-brand retailer
- **Different themes** per brand
- **Shared inventory**

### 20.6 Shared catalog

**Advantages:**

- **Single product master**
- **Sync across channels**
- **Bulk updates**
- **Consistent data**

### 20.7 Channel-specific settings

- **Different prices** per channel
- **Different products visible**
- **Different payment methods**
- **Different shipping methods**
- **Different theme/design**
- **Different language/currency**
- **Different email templates**

### 20.8 Srovnání

| Platforma                        | Multi-channel strategy       |
| -------------------------------- | ---------------------------- |
| **Shopware Sales Channels**      | ⭐⭐⭐⭐⭐ (unique approach) |
| **BigCommerce Multi-Storefront** | ⭐⭐⭐⭐⭐                   |
| **Shopify (with apps)**          | ⭐⭐⭐⭐                     |
| **Wix**                          | ⭐⭐⭐                       |
| **Shoptet**                      | ⭐⭐⭐ (Allegro 2026)        |
| **Upgates**                      | ⭐⭐⭐                       |

---

## 21. B2B Components – pokročilé B2B

**B2B Components** jsou Shopware's **killer feature pro B2B** – dostupné od **Evolve plánu**.

### 21.1 Co jsou B2B Components

**Kompletní B2B suite:**

- **Employee management**
- **Role-based access**
- **Order approval workflows**
- **Budget management**
- **Quote management**
- **Quick orders**
- **Shopping lists**
- **Customer-specific pricing** (Beyond only)

### 21.2 Company accounts

**Multi-level company structure:**

- **Company** (main account)
- **Departments** / sub-companies
- **Employees** (sub-accounts)
- **Roles** (permissions)
- **Approval hierarchies**

### 21.3 Employee Management

**Company admin může:**

- **Add / remove employees**
- **Assign roles**
- **Set spending limits per employee**
- **Control access** to products/categories
- **View all employee orders**

### 21.4 Role-based access

**Predefined roles:**

- **Company admin**
- **Purchasing manager**
- **Buyer** (can place orders)
- **Viewer** (read-only)
- **Custom roles**

**Per role:**

- **Permissions**
- **Approval requirements**
- **Budget limits**
- **Product visibility**

### 21.5 Order approval workflows

**Multi-level approvals:**

```
Employee places order
    ↓
IF order_total > budget_limit:
    → Send to Manager for approval
    ↓
IF approved AND total > €10 000:
    → Send to Director for approval
    ↓
Final approval → Order processed
```

**Configurable:**

- **Approval chains**
- **Parallel approvals**
- **Budget-based** routing
- **Category-based** routing
- **Time limits** (auto-approve po X dnech)

### 21.6 Quote management

**Request for quote workflow:**

1. **Customer selects products** (add to cart)
2. **Request quote** instead of order
3. **Admin sees quote request**
4. **Custom pricing** per quote
5. **Custom delivery terms**
6. **Send quote** to customer
7. **Customer accepts** → order

**Features:**

- **Quote expiration**
- **Negotiation history**
- **Version control**
- **PDF export**

### 21.7 Customer-specific pricing (Beyond only!)

**Most advanced B2B pricing:**

- **Per-customer** price lists
- **Per-company** discounts
- **Contract pricing** (valid from-to)
- **Volume tiers** per customer
- **Category-based** discounts per customer
- **Bulk import** price lists

⚠️ **Jen v Beyond plánu** (€6 500+/měs.).

### 21.8 Budget management

**Spending controls:**

- **Per-employee budget**
- **Per-department budget**
- **Per-period** (monthly, quarterly, annual)
- **Budget tracking** real-time
- **Alerts** when approaching limit
- **Budget requests** workflow

### 21.9 Quick orders

**For repeat B2B customers:**

- **SKU-based** quick order
- **CSV upload** cart
- **Excel import**
- **Past order reorder**
- **Frequently ordered** template

### 21.10 Shopping lists

**Save frequently ordered:**

- **Multiple lists** per customer
- **Named lists** ("Monthly supplies", "Project X")
- **Share lists** within company
- **Quick add** to cart
- **Scheduled recurring** orders (přes pluginy)

### 21.11 B2B product catalog

**Per-customer visibility:**

- **Hide products** from certain customers
- **Show exclusive** B2B products
- **Contract-specific** catalog
- **Category restrictions**

### 21.12 B2B documents

- **Custom invoices** (B2B branding)
- **Proforma invoices**
- **Delivery notes** with PO numbers
- **Credit notes**
- **Account statements**
- **Export to ERP**

### 21.13 Net payment terms

- **Invoice payment** method
- **Net 14, 30, 60, 90** terms
- **Payment tracking**
- **Overdue notifications**
- **Credit limits**

### 21.14 B2B checkout

**Special B2B checkout features:**

- **Purchase Order** number field
- **Cost center** selection
- **Approval step** if required
- **Budget check** real-time
- **Multiple delivery addresses**

### 21.15 Punch-out catalog (enterprise)

**For enterprise procurement:**

- **OCI 4.0** protocol support
- **cXML** support
- **Integration** with SAP Ariba, Coupa
- **Punch-out from** customer ERP
- Přes pluginy nebo custom

### 21.16 Srovnání B2B s konkurencí

| Platforma                   | B2B plán                       |
| --------------------------- | ------------------------------ |
| **Shopware Evolve/Beyond**  | ⭐⭐⭐⭐⭐ (unified B2B suite) |
| **BigCommerce B2B Edition** | ⭐⭐⭐⭐⭐                     |
| **Shopify Plus B2B**        | ⭐⭐⭐⭐                       |
| **Adobe Commerce B2B**      | ⭐⭐⭐⭐⭐                     |
| **Upgates**                 | ⭐⭐⭐ (in Bronze!)            |
| **Shoptet**                 | ⭐⭐                           |
| **Wix**                     | ⭐⭐                           |

**Shopware B2B Components jsou best-in-class pro mid-market.**

### 21.17 B2B + B2C hybrid

**Shopware zvládá hybrid** skvěle:

- **Same platform**
- **Different customer groups**
- **Different experiences**
- **Unified inventory**
- **Shared marketing** nebo separate

---

## 22. Advanced Search – Elasticsearch

**Advanced Search** je pokročilý search powered by **Elasticsearch** – dostupný od **Evolve** plánu.

### 22.1 Default search vs. Advanced Search

**Default (Community, Rise):**

- MySQL-based search
- Basic fulltext
- Acceptable for <10 000 products
- Slows down at scale

**Advanced Search (Evolve+):**

- **Elasticsearch-based**
- **Lightning-fast** regardless of catalog size
- **Intelligent** ranking
- **Typo tolerance**
- **Synonyms**
- **Filters** fast

### 22.2 Features Advanced Search

**Customer-facing:**

- **Instant search** (search-as-you-type)
- **Auto-suggestions**
- **Product previews** in suggestions
- **Category suggestions**
- **Content suggestions** (blog, pages)
- **Typo tolerance**
- **Synonyms** handling

**Admin-facing:**

- **Search analytics** (what customers search)
- **Zero-result queries** tracking
- **Popular searches**
- **Trending searches**
- **Custom ranking** rules
- **Boost products** manually

### 22.3 Filtering / faceted search

- **Category filters**
- **Property filters** (color, size, brand)
- **Price range**
- **Availability**
- **Reviews** stars
- **Custom filters**
- **Multi-select**
- **Hierarchical filters**

### 22.4 Search rules (Rule Builder integrace)

- **Per-customer-group** search results
- **Boost certain products** for certain customers
- **Hide products** from search
- **Custom ranking** per context

### 22.5 AI-powered search (2025+)

**AI Copilot | search:**

- **Natural language queries**
- "Show me red dresses under €100"
- **Image-based search** (upload image, find similar)
- **Context-aware** (past behavior)
- **Recommendation engine**

### 22.6 Multi-language search

- **Language-specific** indexing
- **Language-specific** synonyms
- **Stop words** per language
- **Stemming** per language

### 22.7 Infrastructure

**Elasticsearch requirements:**

- **Recommended for 10 000+ products**
- **Dedicated Elasticsearch** instance
- **Cloud: managed** by Shopware
- **Self-hosted: setup** required

### 22.8 Srovnání

| Platforma                          | Search quality             |
| ---------------------------------- | -------------------------- |
| **Shopware Advanced Search**       | ⭐⭐⭐⭐⭐ (Elasticsearch) |
| **Shopify (Search & Discovery)**   | ⭐⭐⭐⭐                   |
| **Adobe Commerce (Elasticsearch)** | ⭐⭐⭐⭐⭐                 |
| **Klevu / Algolia** (external)     | ⭐⭐⭐⭐⭐                 |
| **Shoptet**                        | ⭐⭐                       |
| **Upgates**                        | ⭐⭐⭐                     |

---

## 23. Marketing a personalizace

### 23.1 Email marketing native

**Built-in:**

- **Newsletter** signup
- **Double opt-in**
- **Customer segmentation**
- **Basic templates**

**Přes pluginy:**

- **Mailchimp** integration
- **Klaviyo** integration
- **Sendinblue / Brevo**
- **CleverReach** (DACH popular)

### 23.2 Promotions engine

**Rule Builder + Promotions:**

- **Percentage discounts**
- **Fixed amount discounts**
- **Free shipping**
- **Buy X Get Y**
- **Bundle discounts**
- **Cart-level** promotions
- **Product-level** promotions
- **Category-level** promotions

### 23.3 Vouchers / coupons

- **Custom codes**
- **Generated codes**
- **Single-use** or **multi-use**
- **Expiration** dates
- **Usage limits**
- **Per-customer** limits
- **Combined discounts**

### 23.4 Personalization

**Shopping Experiences + Rule Builder:**

- **Per-customer-group** content
- **Per-location** content
- **Per-time-of-day** content
- **Per-behavior** personalization
- **AI-driven recommendations**

### 23.5 Cross-sell / Upsell

- **Related products**
- **Cross-sell** at cart
- **Upsell** at product page
- **Post-purchase** upsells
- **AI recommendations**

### 23.6 Abandoned cart

- **Email automation** via Flow Builder
- **Multi-step campaigns**
- **Discount triggers**
- **Recovery analytics**

### 23.7 Loyalty program (via plugins)

**Popular plugins:**

- **LoyaltyLion**
- **Smile.io**
- **Custom loyalty** via API

### 23.8 Wishlist marketing

- **Wishlist abandonment** emails
- **Price drop** notifications
- **Back-in-stock** alerts
- **Sharing** tracking

### 23.9 Referral programs

**Via plugins:**

- **Referral Candy**
- **Custom referral** systems

### 23.10 Social commerce

**Native:**

- **Facebook Pixel**
- **Google Analytics 4**
- **TikTok Pixel** (via plugin)

**Shopping integrations:**

- **Facebook Shop**
- **Instagram Shopping**
- **Google Shopping**
- **TikTok Shop** (via plugin)

### 23.11 Content marketing

- **Blog** via plugins (Shopware Blog plugin)
- **Landing pages** via Shopping Experiences
- **SEO-optimized** by default
- **Rich content** capabilities

### 23.12 Dynamic pricing

**Rule Builder:**

- **Time-based** pricing
- **Demand-based** pricing
- **Customer-specific** pricing
- **Automated adjustments**

### 23.13 Marketing automation

**Flow Builder:**

- **Customer lifecycle** campaigns
- **Welcome series**
- **Win-back campaigns**
- **VIP nurturing**
- **Birthday offers**

---

## 24. SEO a obsah

### 24.1 Core SEO features

**Built-in:**

- **Meta title** per entity
- **Meta description**
- **Custom URL slugs**
- **Canonical URLs**
- **Robots.txt**
- **XML sitemap** auto-generated
- **Schema.org markup** (Product, Breadcrumb, Organization)
- **Open Graph**
- **Twitter Cards**

### 24.2 URL structure

- **Customizable URL** templates
- **Category paths**
- **Language prefixes**
- **Clean URLs**
- **301 redirects** manager

### 24.3 Multi-language SEO

- **Hreflang** automatic
- **Per-language** meta
- **Per-language sitemap**
- **Canonical** handling

### 24.4 Schema.org

**Automatic markup:**

- **Product** (with price, availability, reviews)
- **Organization**
- **Breadcrumb**
- **FAQ**
- **Article** (blog)
- **LocalBusiness**

### 24.5 AI-powered SEO (Copilot)

- **AI-generated meta tags**
- **AI-optimized descriptions**
- **Translation SEO**
- **Keyword suggestions**

### 24.6 Performance / Core Web Vitals

**Shopware optimization:**

- **Lazy loading** images
- **WebP / AVIF** image formats
- **Minified CSS/JS**
- **HTTP/2, HTTP/3**
- **CDN** integration
- **Caching** (Redis, Varnish)

**Typical scores:**

- **LCP:** 1.5–2.5s
- **FID:** <100ms
- **CLS:** <0.1

### 24.7 Blog and content

**Via plugins:**

- **Shopware Blog plugin**
- **Custom blog** implementations
- **Third-party blogs** via API

### 24.8 Redirects

- **301 redirects manager**
- **Bulk import**
- **Pattern matching**
- **Automatic redirects** (URL changes)

### 24.9 SEO tools integration

- **Google Search Console**
- **Google Analytics 4**
- **Ahrefs, SEMrush** via API
- **Custom SEO** tools

### 24.10 Technical SEO

- **SSL** (mandatory)
- **HTTPS enforced**
- **Mobile-first** indexing ready
- **AMP** (via plugins, less relevant 2026)
- **Structured data** validators

### 24.11 LLM feed (2026)

**Preparations pro AI commerce:**

- **Structured data** for LLMs
- **LLM-friendly APIs**
- **ChatGPT Commerce** ready

---

## 25. Analytika a reporting

### 25.1 Native analytics

**Admin dashboard:**

- **Sales overview**
- **Recent orders**
- **Top products**
- **Traffic sources**
- **Conversion rates**
- **Customer analytics**

### 25.2 Reports

**Built-in reports:**

- **Sales reports**
- **Product performance**
- **Customer reports**
- **Marketing reports**
- **Stock reports**
- **Payment reports**
- **Shipping reports**

### 25.3 Custom reports (Evolve+)

- **Custom metrics**
- **Custom dimensions**
- **Custom date ranges**
- **Export to CSV/Excel**
- **Scheduled reports** (email)

### 25.4 External analytics integration

**Google Analytics 4:**

- **Native integration**
- **Enhanced e-commerce** tracking
- **Custom events**
- **Conversions**

**Google Tag Manager:**

- **Native support**
- **Custom triggers**

**Meta Pixel:**

- **Auto-installation**
- **Conversions API**
- **Custom events**

**Microsoft Clarity:**

- **Session recording**
- **Heatmaps**

**Hotjar:**

- **User behavior**
- **Surveys**

### 25.5 AI Copilot analytics

- **Natural language queries**
- **"How many orders yesterday?"**
- **AI-generated insights**
- **Trend detection**

### 25.6 Data export

- **CSV**
- **Excel**
- **API access** (all data)
- **Webhook streams**
- **DATEV** (DACH accounting)

### 25.7 Business Intelligence

**Shopware + BI tools:**

- **Tableau** connectors
- **Power BI** connectors
- **Looker**
- **Custom data warehouse**

### 25.8 A/B testing

**Via plugins:**

- **Convert.com**
- **VWO**
- **Google Optimize** (deprecated)
- **Custom implementations**

### 25.9 Srovnání

| Platforma                  | Analytics                   |
| -------------------------- | --------------------------- |
| **Shopify Plus**           | ⭐⭐⭐⭐⭐ (custom reports) |
| **Shopware Beyond**        | ⭐⭐⭐⭐                    |
| **BigCommerce Enterprise** | ⭐⭐⭐⭐⭐                  |
| **Adobe Commerce**         | ⭐⭐⭐⭐⭐                  |
| **Wix**                    | ⭐⭐⭐⭐                    |
| **Shoptet**                | ⭐⭐⭐⭐                    |
| **Upgates**                | ⭐⭐⭐⭐                    |

---

## 26. Developer platforma – API a plugins

Shopware je **developer-first platforma** s pokročilým API a rozsáhlými customization možnostmi.

### 26.1 API architektura

**Multiple APIs:**

- **Admin API** (REST + OpenAPI)
- **Store API** (REST for storefront)
- **GraphQL Storefront API**
- **Sync API** (bulk operations)
- **Webhooks**

### 26.2 API capabilities

**Admin API:**

- **Full CRUD** na všechny entities
- **Bulk operations**
- **Complex queries** (filters, associations)
- **OAuth 2.0 authentication**
- **API tokens**

**Store API:**

- **Product browsing**
- **Cart management**
- **Checkout**
- **Customer management**
- **Optimized pro storefront**

**GraphQL Storefront API:**

- **Modern query language**
- **Efficient data fetching**
- **Real-time subscriptions** (limited)
- **For headless frontends**

### 26.3 Webhooks

- **Subscribe to events**
- **Real-time data sync**
- **HMAC signature** verification
- **Retry logic**
- **Queue-based** delivery (RabbitMQ)

### 26.4 Plugin development

**Core architecture:**

- **PHP + Symfony**
- **Vue.js admin extensions**
- **Twig templates**
- **Plugin skeleton** generator
- **Dependency injection**
- **Event-driven**

### 26.5 App system (cloud-compatible)

**Shopware App System:**

- **Cloud-compatible** apps (vs. plugins)
- **External hosting**
- **API-based** integration
- **OAuth flow**
- **Marketplace distribution**
- **App store approval** process

### 26.6 CLI tools

- **Shopware CLI** (shopware-cli)
- **Theme development**
- **Plugin development**
- **Database operations**
- **Cache management**

### 26.7 Documentation

- **docs.shopware.com** (comprehensive)
- **API reference**
- **Plugin tutorials**
- **Video tutorials**
- **Community examples**

### 26.8 Developer community

- **Shopware Community Day** (annual conference)
- **Shopware Academy** (training)
- **Slack/Discord** community
- **GitHub** (open source)
- **Stack Overflow**
- **Shopware Developer Forums**

### 26.9 Testing

- **PHPUnit**
- **Jest** (JavaScript)
- **Cypress** (E2E)
- **Built-in** testing utilities

### 26.10 DevOps

- **CI/CD** pipelines (GitLab, GitHub Actions)
- **Docker** images provided
- **Kubernetes** deployment
- **Auto-scaling** infrastructure

### 26.11 Rate limits

**API rate limits per tier:**

- **Community:** self-managed
- **Rise:** standard limits
- **Evolve:** increased limits
- **Beyond:** custom limits

### 26.12 Srovnání API

| Platforma          | API quality                              |
| ------------------ | ---------------------------------------- |
| **Shopify**        | ⭐⭐⭐⭐⭐ (REST + GraphQL + Hydrogen)   |
| **Shopware**       | ⭐⭐⭐⭐⭐ (REST + GraphQL + App System) |
| **BigCommerce**    | ⭐⭐⭐⭐⭐ (REST + GraphQL + Catalyst)   |
| **Adobe Commerce** | ⭐⭐⭐⭐⭐ (REST + GraphQL)              |
| **Wix**            | ⭐⭐⭐⭐ (Velo)                          |
| **Shoptet**        | ⭐⭐⭐ (REST)                            |
| **Upgates**        | ⭐⭐⭐ (REST, placené)                   |

**Shopware API je na úrovni Shopify / BigCommerce** – best-in-class.

---

## 27. Shopware Store – plugin ecosystem

**Shopware Store** je oficiální marketplace pro pluginy a extensions.

### 27.1 Přehled

- **~5 000 pluginů**
- **store.shopware.com**
- **Certified by Shopware Academy**
- **Paid + free**

### 27.2 Kategorie pluginů

**Core business:**

- **Payment** (GoPay, Stripe, PayPal, Klarna, Mollie, Adyen, Pay., Worldpay)
- **Shipping** (DHL, DPD, UPS, Zásilkovna, GLS, Hermes)
- **ERP integrations** (SAP, DATEV, Lexware, JTL-Wawi, Pickware)
- **CRM** (Salesforce, HubSpot)
- **Accounting** (DATEV, Pohoda-addon, Lexware)

**Marketing:**

- **Email marketing** (Mailchimp, Klaviyo, CleverReach)
- **SEO tools**
- **Social media**
- **Abandoned cart**
- **Reviews** (Trusted Shops, Trustpilot)

**Analytics:**

- **Google Analytics** enhancements
- **Matomo** (GDPR-friendly)
- **Piwik Pro**

**UX/UI:**

- **Themes**
- **Custom widgets**
- **Cookie consent** (Usercentrics, Cookiebot)

**B2B:**

- **ERP connectors**
- **Quote extensions**
- **Punch-out catalogs**

**International:**

- **Language packs**
- **Currency tools**
- **Country-specific** (DE, FR, IT, CZ, PL)

**Search:**

- **Klevu**
- **Algolia**
- **Findologic**

### 27.3 Plugin quality

**Certifikace:**

- **Shopware certified** (partnerships)
- **Community reviews**
- **Ratings**
- **Code review** by Shopware

### 27.4 Pricing model

**Paid plugins:**

- **One-time** fee (typically €50–500)
- **Monthly subscriptions** (€10–200/měs.)
- **Tier pricing** based on shop size
- **Support included**

### 27.5 Free plugins

**Many free options:**

- **Stripe Payments**
- **PayPal**
- **Basic shipping integrations**
- **Community extensions**

### 27.6 Popular plugins

**Top plugins (často doporučované):**

- **Pay.** (multi-payment) ⭐⭐⭐⭐⭐
- **Stripe Payments** (free) ⭐⭐⭐⭐⭐
- **DHL integration**
- **Klarna**
- **Mailchimp**
- **Google Shopping**
- **Pickware ERP** (DACH-favorite)
- **JTL-Wawi connector**
- **DATEV**
- **Trusted Shops**
- **Cookiebot / Usercentrics**
- **Findologic** (advanced search)

### 27.7 Czech-specific plugins

**Pro CZ obchody:**

- **Internationalization Czech Republic** (zdarma, český překlad)
- **Community Zásilkovna plugins** (různá kvalita)
- **ThePay** (limited availability)
- **Pohoda konektory** (přes třetí strany)
- **Custom agentury** (Shopsys, Kiwee, Netdirect)

⚠️ **ČR specifické pluginy menej než pro DE/AT** – často nutno custom development.

### 27.8 Plugin development

**Pro agentury:**

- **Shopware Partner Program**
- **Marketplace distribution**
- **Revenue sharing**
- **Code review process**

### 27.9 Custom pluginy

- **Private plugins** (jen pro váš obchod)
- **Custom functionality**
- **Internal tools**
- **Bez marketplace approval**

### 27.10 Srovnání

| Platforma                  | Počet apps/pluginů |
| -------------------------- | ------------------ |
| **Shopify**                | 8 000+             |
| **WordPress/WooCommerce**  | 50 000+            |
| **Shopware**               | **~5 000**         |
| **Magento/Adobe Commerce** | ~3 500             |
| **BigCommerce**            | ~1 000             |
| **Wix**                    | ~500               |
| **Shoptet**                | ~400+              |
| **Ecwid**                  | ~200               |
| **Upgates**                | ~100+              |

---

## 28. Headless commerce a storefronts

**Shopware je API-first** – headless commerce je **native feature**, ne afterthought.

### 28.1 Co je headless

**Traditional (monolithic):**

- Backend + Frontend = jedna aplikace
- Frontend generated from backend
- Limited flexibility

**Headless:**

- **Backend = commerce engine**
- **Frontend = custom** (React, Vue, Next.js, mobile app)
- **Connected via API**
- **Unlimited flexibility**

### 28.2 Shopware headless advantage

**Od Shopware 6.0** je headless native:

- **REST + GraphQL Storefront API**
- **Decoupled architecture**
- **Multiple frontends** from one backend
- **Progressive Web Apps (PWA)**

### 28.3 Shopware's official frontends

**Default Storefront:**

- **Bootstrap-based**
- **Twig templates**
- **Server-side rendered**
- **Best for traditional** e-commerce

**Shopware PWA (legacy):**

- Starší approach
- Vue.js-based
- Postupně nahrazováno

**Nuxt / Vue Storefront integrations:**

- **Vue Storefront** integration
- **Nuxt.js** starter projects
- **Frontends.js** library

### 28.4 Custom frontends

**Popular choices v 2026:**

**Next.js (React):**

- Most popular choice
- **Excellent SEO**
- **Vercel hosting**
- **React ecosystem**

**Nuxt.js (Vue):**

- **Vue ecosystem**
- **Matches Shopware admin Vue stack**

**Astro:**

- **Content-focused**
- **Island architecture**
- **Super fast**

**Remix:**

- **Web standards focused**
- **Nested routing**

**SvelteKit:**

- **Compiler-based**
- **Smaller bundles**

**React Native / Flutter:**

- **Mobile apps**
- **Native performance**

### 28.5 MACH Alliance

Shopware je **member of MACH Alliance**:

- **Microservices**
- **API-first**
- **Cloud-native**
- **Headless**

Guarantees modern architecture standards.

### 28.6 Composable commerce

**Shopware supports composable architecture:**

- **Best-of-breed** services
- **CMS** (Shopware nebo external – Storyblok, Contentful)
- **Commerce** (Shopware)
- **Search** (Elasticsearch, Algolia)
- **Payments** (best-fit processor)
- **Email** (SendGrid, Mailgun)

### 28.7 Use cases pro headless Shopware

**B2B customer portals:**

- Custom frontend pro B2B
- Integration s customer ERP
- **Portal-like** experience

**Mobile apps:**

- Native iOS / Android
- **Same backend** as web

**IoT commerce:**

- **Voice assistants** (Alexa, Google Home)
- **Smart devices**
- **Connected cars**

**Multi-brand:**

- **Different frontends** per brand
- **Same backend**

**Progressive Web Apps:**

- **App-like experience** bez app store
- **Offline support**

### 28.8 Hosting headless frontends

- **Vercel** (Next.js)
- **Netlify**
- **AWS Amplify**
- **Cloudflare Pages**
- **Custom hosting**

### 28.9 Development complexity

**Headless vyžaduje:**

- **Senior developers**
- **Frontend + backend** expertise
- **API knowledge**
- **DevOps capabilities**

**Costs:** **€50 000–500 000+** for custom headless frontend.

### 28.10 Kdy headless, kdy not

**Headless vhodné pro:**

- **Large enterprises** s IT týmy
- **Multi-channel** strategy
- **Custom UX** requirements
- **Performance-critical** obchody
- **Mobile app** + web

**Default storefront stačí pro:**

- **Small-to-mid** obchody
- **Standard e-commerce** needs
- **Budget-conscious** projects
- **Rychlejší time-to-market**

### 28.11 Srovnání headless

| Platforma                | Headless capabilities                  |
| ------------------------ | -------------------------------------- |
| **Shopware**             | ⭐⭐⭐⭐⭐ (MACH-compliant, API-first) |
| **Shopify Hydrogen**     | ⭐⭐⭐⭐⭐ (Oxygen hosting)            |
| **BigCommerce Catalyst** | ⭐⭐⭐⭐⭐ (Next.js-based)             |
| **Adobe Commerce**       | ⭐⭐⭐⭐ (PWA Studio)                  |
| **Medusa**               | ⭐⭐⭐⭐⭐ (headless-only)             |
| **Wix Studio**           | ⭐⭐⭐⭐ (Velo)                        |
| **Shoptet**              | ⭐⭐ (only Premium)                    |
| **Upgates**              | ⭐⭐ (Enterprise only)                 |

**Shopware je v top tieru** pro headless commerce.

---

## 29. Bezpečnost, hosting a infrastruktura

### 29.1 Shopware Cloud hosting

**Fully managed infrastructure:**

- **AWS-based** cloud (primárně)
- **EU datacentra** (GDPR compliance)
- **Auto-scaling**
- **Load balancing**
- **99.9%+ uptime SLA**
- **Managed updates**

### 29.2 CDN

- **Global CDN**
- **Image optimization**
- **Static assets delivery**
- **Edge caching**

### 29.3 Self-hosted options

**Pro flexibilitu:**

- **AWS** (most common)
- **Hetzner** (DACH, cost-effective)
- **OVH**
- **Azure, GCP**
- **Self-managed** datacenters

### 29.4 Security

**Built-in security:**

- **SSL/TLS** (mandatory)
- **DDoS protection**
- **WAF** (Web Application Firewall)
- **Rate limiting**
- **Bot detection**
- **Security audits** regular

### 29.5 Compliance

**Certifications:**

- **PCI DSS Level 1** (Cloud)
- **GDPR compliant**
- **SOC 2 Type II** (Cloud)
- **ISO 27001** (partial)
- **GoBD** (DACH accounting)

### 29.6 Data residency

**EU data residency** guaranteed:

- **Data stored in EU**
- **GDPR compliance**
- **No data transfer** mimo EU without consent

### 29.7 Backups

**Automatic:**

- **Daily backups**
- **Retention:** 30 days standard
- **Point-in-time recovery** (enterprise)
- **Custom backup** strategies (self-hosted)

### 29.8 Disaster recovery

- **Multi-region** redundancy (Beyond)
- **Failover** infrastructure
- **RTO / RPO** guarantees (custom SLA)

### 29.9 Two-factor authentication

- **TOTP** (Google Authenticator, Authy)
- **Hardware tokens** (YubiKey)
- **Mandatory** for admin users

### 29.10 Audit logs

- **Admin activities**
- **API calls**
- **Customer data** access
- **Security events**
- **Compliance reporting**

### 29.11 Incident response

- **24/7 security team** (Beyond)
- **Incident notifications**
- **Post-incident reviews**
- **Customer communication**

### 29.12 Performance

**Shopware 6 performance:**

- **Page load:** 1.5–3s (optimized)
- **Time to first byte (TTFB):** <500ms
- **Lighthouse scores:** 80–95
- **Core Web Vitals:** all green (proper setup)

**Enterprise:**

- **Sub-second** page loads
- **99.99% uptime** guarantees
- **<100ms API** response

### 29.13 Monitoring

- **Built-in monitoring** (Cloud)
- **Custom monitoring** (self-hosted)
- **Alerts**
- **Performance dashboards**
- **Uptime tracking**

### 29.14 Status page

- **status.shopware.com**
- **Real-time incident** tracking
- **Historical uptime**
- **RSS/email** subscriptions

### 29.15 Srovnání security

| Platforma                  | Enterprise security                   |
| -------------------------- | ------------------------------------- |
| **Shopify Plus**           | ⭐⭐⭐⭐⭐ (PCI L1, SOC 2, ISO 27001) |
| **Shopware Beyond**        | ⭐⭐⭐⭐⭐ (PCI L1, SOC 2, GoBD)      |
| **BigCommerce Enterprise** | ⭐⭐⭐⭐⭐                            |
| **Adobe Commerce**         | ⭐⭐⭐⭐⭐                            |
| **Wix Enterprise**         | ⭐⭐⭐⭐                              |
| **Shoptet**                | ⭐⭐⭐⭐                              |
| **Upgates**                | ⭐⭐⭐⭐                              |

---

## 30. Podpora a komunita

### 30.1 Support tiers

| Edition       | Support level                    |
| ------------- | -------------------------------- |
| **Community** | Community only (forum, Discord)  |
| **Rise**      | Standard support (email, ticket) |
| **Evolve**    | Priority support                 |
| **Beyond**    | 24/7 dedicated + account manager |

### 30.2 Support channels

**Official:**

- **Ticket system** (customer portal)
- **Email support**
- **Phone support** (Beyond)
- **Dedicated account manager** (Beyond)

**Community:**

- **Shopware Forums**
- **Discord** server
- **Slack** community
- **Stack Overflow** (tag: shopware)
- **GitHub issues**

### 30.3 Language support

**Official:**

- **English**
- **German** (primární)
- **Limited French, Spanish, Italian**

**Community:**

- **Čeština** (Shopsys, Kiwee agentury)
- **Polština**
- **Ostatní EU jazyky**

### 30.4 Response times

**SLA guarantees:**

- **Rise:** 24–48 hours
- **Evolve:** 4–24 hours
- **Beyond:** 1–4 hours (critical issues)

### 30.5 Shopware Academy

**Official training:**

- **Online courses**
- **Certifications**
- **Developer tutorials**
- **Merchant training**
- **Partner certifications**

**Certification levels:**

- **Shopware Certified Developer**
- **Shopware Certified Partner**
- **Shopware Certified Solutions Architect**

### 30.6 Shopware Community Day

**Annual conference:**

- **Largest Shopware event**
- **Schöppingen, Germany**
- **1 000+ attendees**
- **Product announcements**
- **Developer workshops**
- **Networking**

### 30.7 Regional events

- **Shopware User Groups** (v DACH)
- **Meetups** (v různých zemích)
- **Webinars**
- **Online trainings**

### 30.8 Partner ecosystem

**Globally:**

- **1 000+ certifikovaných agentur**
- **Largest in DACH region**
- **Spread across Europe**

**V ČR:**

- **Shopsys** (největší CZ agentura)
- **Kiwee**
- **Netdirect**
- **Imper.cz**
- **Shortcut**
- Ostatní menší

### 30.9 Knowledge base

- **docs.shopware.com** (comprehensive)
- **Blog** (marketing + tech)
- **Success stories**
- **Case studies**
- **Whitepapers**

### 30.10 Srovnání podpory

| Platforma                  | Support quality                          |
| -------------------------- | ---------------------------------------- |
| **Shopify Plus**           | ⭐⭐⭐⭐⭐ (24/7 global, multi-language) |
| **Shopware Beyond**        | ⭐⭐⭐⭐ (24/7 dedicated)                |
| **BigCommerce Enterprise** | ⭐⭐⭐⭐⭐                               |
| **Adobe Commerce**         | ⭐⭐⭐⭐⭐ (enterprise)                  |
| **Shoptet (CZ)**           | ⭐⭐⭐⭐⭐ (pro CZ)                      |
| **Upgates (CZ)**           | ⭐⭐⭐⭐                                 |

**Shopware má excellent support pro DACH** – pro ČR záleží na konkrétní agentuře.

---

## 31. Známá omezení a nevýhody

### 31.1 Vysoká cena pro small businesses

- **Rise od €600/měs.** (už dost pro mid-market, ale drahé pro malé)
- **Evolve €2 400/měs.** (enterprise-level cost)
- **Beyond €6 500+** (nejdražší v CZ/SK kontextu)
- **Community Edition** vyžaduje dev tým

### 31.2 Complexity

- **Steep learning curve**
- **Vyžaduje developery** pro customizaci
- **Komplexní admin** (oproti Shopify)
- **Setup time** delší (týdny až měsíce)

### 31.3 Slabší CZ lokalizace

**Oproti Shoptet/Upgates:**

- ❌ **Žádná nativní Heureka integrace**
- ❌ **Žádná nativní Zboží.cz**
- ❌ **Žádný nativní GoPay** (Stripe ano)
- ❌ **Žádná nativní ComGate, ThePay**
- ❌ **Žádná nativní Zásilkovna** (community pluginy)
- ❌ **Žádná nativní Pohoda** (custom)
- ❌ **Žádná ARES validation**
- ❌ **Žádné recyklační příspěvky** (EKO-KOM)
- ❌ **Žádné kontrolní hlášení** (CZ)

**Musí se řešit přes:**

- Custom development (CZ agentury)
- Placené pluginy z třetích stran
- Community extensions (variable quality)

### 31.4 Menší ekosystém než Shopify

- **~5 000 pluginů vs. Shopify 8 000+**
- **Méně specialistů** globally
- **Menší SaaS integration** ecosystem
- **Méně themes** than Shopify

### 31.5 Fair Usage Policy 2025

- **Community Edition omezení 1M EUR GMV**
- **Nárůst o Shopware** investments
- **Některé merchants upgrade** neplánovaný

### 31.6 Hosting nároky (self-hosted)

- **PHP 8.1+, MySQL 8.0+, Elasticsearch, RabbitMQ**
- **DevOps vyžaduje** expertise
- **Maintenance** odpovědnost

### 31.7 Slabší AI než Wix

- **AI Copilot** solid, ale ne na úrovni Wix Astro/Harmony
- **Rozvíjí se**, ale startovní pozice slabší

### 31.8 Mobilní admin

- **Mobile admin responsive**, ale ne native app
- **Shopify má lepší** mobile management experience

### 31.9 Marketplace integrace

- **Slabší** marketplace integration než BigCommerce Feedonomics
- **Amazon/eBay** přes pluginy
- **Heureka** přes custom dev pro ČR

### 31.10 Documentation v EN primárně

- **Většina docs v angličtině**
- **Němčina druhá**
- **Čeština limited** (community)

### 31.11 Lock-in rizika

- **Open source core** snižuje lock-in
- **Ale custom plugins, themes** lock-in k Shopware
- **Migrace** k alternative stejně složitá

### 31.12 Shopware 5 → 6 migration

- **Legacy Shopware 5** obchody mají výzvu
- **Ne automatic migration**
- **Vyžaduje development** effort
- **Support pro 5 končí**

### 31.13 Updates a backward compatibility

- **Major updates (6.5 → 6.6 → 6.7)** introduce breaking changes
- **Plugin compatibility** často problematic
- **Merchants musí update** pluginy po major version

### 31.14 Pro ČR: nutnost partner agentury

- **Neznalost CZ specifik**
- **Custom integrace** vyžaduje CZ agentura
- **Cena agentury:** 1 500–3 000 Kč/hod
- **Total CZ custom setup:** často **€20 000–80 000+**

---

## Závěr

Shopware je **premium e-commerce platforma** pro **mid-market a enterprise obchody**, zejména v DACH regionu. Kombinuje **open-source flexibilitu** s **enterprise-grade funkčností** a má **nejlepší native B2B support** v mid-market segmentu.

### Silné stránky

- **Open Source core** (MIT licence, Community Edition)
- **Nejlepší native B2B** v mid-market segmentu (B2B Components)
- **API-first headless-ready** architektura
- **Shopping Experiences** – unikátní CMS pro content-rich obchody
- **Rule Builder + Flow Builder** – automatizace bez kódu
- **AI Copilot** (nativní AI v 6.7+)
- **Multi-language / multi-currency** v ceně všech edicí
- **Advanced Search** (Elasticsearch) pro velké katalogy
- **Multi-Inventory** (Beyond) pro multi-warehouse
- **DACH-first approach** s lokalizací
- **MACH Alliance member** (modern architecture)
- **Silná komunita developers** (1 000+ agentur)
- **Plugin ecosystem** (~5 000 pluginů)
- **Enterprise-grade security** (PCI L1, SOC 2)
- **Flexibilita customizace** (self-hosted option)

### Slabé stránky

- **Vysoké vstupní náklady** (Rise €600/měs., Evolve €2 400+)
- **Vysoké setup costs** (€20 000–100 000+)
- **Potřeba developerů** pro customizaci
- **Slabší CZ lokalizace** (chybí Heureka, GoPay, Zásilkovna, Pohoda, ARES nativně)
- **Menší plugin ecosystem** než Shopify (5 000 vs. 8 000+)
- **Steep learning curve**
- **Fair Usage Policy 2025** (limit 1M EUR GMV pro Community)
- **AI slabší** než Wix (ale dohání)
- **Žádná free tier** pro cloud (jen Community self-hosted)
- **Self-hosted vyžaduje DevOps**

### Pro koho se Shopware hodí

✅ **Ideální pro:**

- **Mid-market obchody** (€1M–50M GMV)
- **B2B manufacturers a velkoobchody**
- **DACH (DE/AT/CH) obchody**
- **B2B + B2C hybrid obchody**
- **Obchody s komplexními produkty** (configurable, variants)
- **Headless commerce** projekty
- **Obchody s multi-country expansion**
- **Obchody s own dev team** (nebo agency partnership)
- **Content-rich obchody** (Shopping Experiences)
- **Enterprise B2B** potřebující quote management, approvals

### Pro koho méně

❌ **Méně vhodné pro:**

- **Small businesses** bez rozpočtu (Shoptet/Upgates lepší)
- **Quick start** obchody (Shopify rychlejší)
- **Bez technického týmu** (Shoptet, Wix easier)
- **Primárně ČR-focused** obchody (Shoptet lepší)
- **Pure B2C startupy** (Shopify lepší)
- **Design-first obchody** (Wix, Squarespace lepší)
- **Embed widget potřeba** (Ecwid lepší)

### Shrnutí v CZ/SK kontextu

**Shopware v ČR/SK:**

**Komu v ČR doporučit:**

1. **Mid-market B2B obchody** (strojírenství, velkoobchody, automotive parts)
2. **Obchody exportující do DACH** (DE/AT primární trh)
3. **Obchody s komplexními B2B workflow** (quotes, approvals, budgets)
4. **Enterprise obchody** s IT týmem
5. **Headless commerce** ambition
6. **Multi-brand retailers** potřebující multi-storefront

**Komu v ČR nedoporučit:**

1. **Pure B2C startupy** bez rozpočtu (Shoptet Free → Business)
2. **Malé obchody** do €500k GMV (Shoptet/Upgates lepší)
3. **Obchody primárně prodávající přes Heureku/Zboží.cz** (Shoptet)
4. **Obchody bez dev partnera** (too complex)
5. **Rychlý time-to-market** projekty (Shopify rychlejší)

### Shopware vs. české platformy

**Shopware vs. Shoptet:**

- **Shopware** pro mid-market B2B, komplexní workflow, DACH expansion, headless
- **Shoptet** pro CZ mainstream, jednoduchý start, Heureka/Zboží.cz/GoPay nativně

**Shopware vs. Upgates:**

- **Shopware** pro enterprise, komplexní B2B, headless
- **Upgates** pro střední CZ/SK obchody s "vše v ceně" filozofií

### Shopware vs. globální konkurence

**Shopware vs. Shopify Plus:**

- **Shopware** pro B2B-first, open source flexibility, DACH focus, komplexní products
- **Shopify Plus** pro B2C dominant, globální ambice, nejrychlejší time-to-market, ecosystem

**Shopware vs. BigCommerce:**

- **Shopware** pro DACH/EU, lepší Shopping Experiences, MACH-compliant
- **BigCommerce** pro USA-centric, Feedonomics marketplaces, Catalyst headless

**Shopware vs. Adobe Commerce (Magento):**

- **Shopware** pro moderní architecture, lepší UX, rychlejší
- **Adobe Commerce** pro biggest enterprise, Adobe ecosystem, legacy migration

### Závěrečné doporučení

**Shopware je ideální volba pro mid-market B2B obchody a enterprise retailers s:**

- Rozpočtem €50 000+ pro první rok
- IT týmem nebo spolehlivou dev agencií
- Komplexními B2B workflow requirements
- Multi-country/multi-currency potřebami
- Ambicí na headless commerce
- Preferencí EU/DACH ekosystému

**V ČR/SK je Shopware silnější pro:**

- **Velkoobchody a B2B manufacturers**
- **Obchody s německými/rakouskými zákazníky**
- **Enterprise retailers**
- **Multi-brand skupiny**

**Pro klasický český B2C e-shop s CZ zákazníky je Shoptet nebo Upgates stále lepší volba** díky nativním CZ integracím.

---

### Srovnání všech 8 platforem (globální + CZ pohled)

| Kritérium                     | Shopify               | Wix          | Squarespace  | BigCommerce           | Ecwid      | Shoptet        | Upgates           | **Shopware**                            |
| ----------------------------- | --------------------- | ------------ | ------------ | --------------------- | ---------- | -------------- | ----------------- | --------------------------------------- |
| **Cena (entry)**              | $29                   | $17          | $16          | $29                   | $0         | 0 Kč           | 450 Kč            | €0 (CE) / €600 (Rise)                   |
| **Free plán**                 | ❌                    | ✅           | ❌           | ❌                    | ✅         | ✅             | ❌                | ✅ (CE do 1M EUR)                       |
| **CZ lokalizace**             | ⭐⭐⭐                | ⭐⭐⭐       | ⭐⭐         | ⭐                    | ⭐⭐       | ⭐⭐⭐⭐⭐     | ⭐⭐⭐⭐⭐        | **⭐⭐ (chybí nativně)**                |
| **Heureka/Zboží native**      | ❌                    | ❌           | ❌           | ❌                    | ❌         | ✅             | ✅                | **❌**                                  |
| **Zásilkovna native**         | ❌                    | ❌           | ❌           | ❌                    | ❌         | ✅             | ✅                | **❌ (přes plugin)**                    |
| **GoPay/ComGate native**      | ❌                    | ❌           | ❌           | ❌                    | ❌         | ✅             | ✅                | **❌**                                  |
| **Pohoda/Money native**       | ❌                    | ❌           | ❌           | ❌                    | ❌         | ✅             | ✅                | **❌ (custom)**                         |
| **ARES validace**             | ❌                    | ❌           | ❌           | ❌                    | ❌         | ✅             | ✅                | **❌**                                  |
| **CZ podpora**                | ⭐⭐                  | ⭐⭐         | ⭐           | ⭐                    | ⭐         | ⭐⭐⭐⭐⭐     | ⭐⭐⭐⭐          | **⭐⭐ (přes partnera)**                |
| **B2B native**                | ⭐⭐⭐ (Plus)         | ⭐⭐         | ⭐           | ⭐⭐⭐⭐⭐            | ⭐⭐       | ⭐⭐           | ⭐⭐⭐⭐          | **⭐⭐⭐⭐⭐ (B2B Components)**         |
| **Multi-language**            | ⭐⭐⭐⭐⭐            | ⭐⭐⭐⭐     | ⭐⭐         | ⭐⭐⭐ (Storefront)   | ⭐⭐⭐     | ⭐⭐ (Profi+)  | ⭐⭐⭐⭐ (Bronze) | **⭐⭐⭐⭐⭐ (CE v ceně)**              |
| **Multi-currency**            | ⭐⭐⭐⭐⭐            | ⭐⭐⭐⭐     | ⭐           | ⭐⭐⭐⭐              | ⭐⭐       | ⭐ (Ent)       | ⭐⭐⭐⭐ (Bronze) | **⭐⭐⭐⭐⭐ (CE v ceně)**              |
| **Design freedom**            | ⭐⭐⭐                | ⭐⭐⭐⭐⭐   | ⭐⭐⭐⭐⭐   | ⭐⭐                  | ⭐         | ⭐⭐⭐         | ⭐⭐⭐⭐          | **⭐⭐⭐⭐⭐ (Shopping Experiences)**   |
| **AI**                        | ⭐⭐⭐⭐              | ⭐⭐⭐⭐⭐   | ⭐⭐⭐⭐     | ⭐⭐⭐                | ⭐⭐       | ⭐⭐           | ⭐⭐              | **⭐⭐⭐⭐ (Copilot)**                  |
| **App ekosystem**             | ⭐⭐⭐⭐⭐ (8k+)      | ⭐⭐⭐ (500) | ⭐⭐         | ⭐⭐⭐ (1k)           | ⭐⭐ (200) | ⭐⭐⭐ (400+)  | ⭐⭐ (100+)       | **⭐⭐⭐⭐ (5k)**                       |
| **Headless commerce**         | ⭐⭐⭐⭐⭐ (Hydrogen) | ⭐⭐⭐⭐     | ⭐           | ⭐⭐⭐⭐⭐ (Catalyst) | ⭐         | ⭐⭐ (Premium) | ⭐⭐ (Ent)        | **⭐⭐⭐⭐⭐ (API-first, MACH)**        |
| **Rule / Flow engine**        | ⭐⭐⭐⭐ (Plus Flow)  | ⭐⭐         | ⭐⭐         | ⭐⭐⭐                | ⭐         | ⭐⭐           | ⭐⭐              | **⭐⭐⭐⭐⭐ (Rule+Flow)**              |
| **Personalization per group** | ⭐⭐⭐                | ⭐⭐⭐       | ⭐⭐         | ⭐⭐⭐⭐              | ⭐⭐       | ⭐⭐⭐         | ⭐⭐⭐            | **⭐⭐⭐⭐⭐**                          |
| **Quote/approval workflow**   | ⭐⭐⭐ (Plus)         | ⭐           | ⭐           | ⭐⭐⭐⭐⭐            | ⭐         | ⭐⭐           | ⭐⭐⭐            | **⭐⭐⭐⭐⭐**                          |
| **Multi-warehouse**           | ⭐⭐⭐⭐ (Plus)       | ⭐⭐⭐       | ⭐⭐         | ⭐⭐⭐⭐              | ⭐⭐       | ⭐⭐⭐ (Ent)   | ⭐⭐              | **⭐⭐⭐⭐⭐ (Beyond)**                 |
| **POS**                       | ⭐⭐⭐⭐⭐            | ⭐⭐⭐       | ⭐⭐         | ⭐⭐⭐                | ⭐⭐⭐⭐   | ⭐⭐⭐         | ⭐⭐⭐            | **⭐⭐⭐ (přes pluginy)**               |
| **Enterprise security**       | ⭐⭐⭐⭐⭐            | ⭐⭐⭐⭐     | ⭐⭐⭐⭐     | ⭐⭐⭐⭐⭐            | ⭐⭐⭐⭐   | ⭐⭐⭐⭐       | ⭐⭐⭐⭐          | **⭐⭐⭐⭐⭐**                          |
| **Pro CZ e-shop**             | ⭐⭐⭐                | ⭐⭐⭐       | ⭐⭐         | ⭐                    | ⭐⭐       | ⭐⭐⭐⭐⭐     | ⭐⭐⭐⭐          | **⭐⭐⭐ (jen pro specific use-cases)** |
| **Pro B2B manufacturing**     | ⭐⭐⭐                | ⭐⭐         | ⭐           | ⭐⭐⭐⭐⭐            | ⭐         | ⭐⭐           | ⭐⭐⭐            | **⭐⭐⭐⭐⭐**                          |
| **Pro DACH expansion**        | ⭐⭐⭐⭐              | ⭐⭐⭐       | ⭐⭐         | ⭐⭐⭐                | ⭐⭐       | ⭐⭐           | ⭐⭐⭐            | **⭐⭐⭐⭐⭐**                          |
| **Overall positioning**       | #1 global             | AI-first     | Design-first | B2B mid-market        | Embed      | **#1 ČR mass** | **#2 ČR quality** | **Premium EU B2B/mid-market**           |

---

### Kdy zvolit Shopware Cloud

**Zvolit Shopware, pokud:**

- Jste **mid-market B2B** obchod s €500k+ GMV
- Potřebujete **komplexní B2B workflow** (quotes, approvals, multi-level companies)
- **Expandujete do DACH** nebo **západní Evropy**
- Máte **IT team nebo agency partnership**
- Plánujete **headless commerce**
- Potřebujete **Shopping Experiences** pro personalization
- **Multi-brand / multi-storefront** je součást strategy
- Máte **rozpočet €50 000+** pro setup a první rok operations

**Nevolit Shopware, pokud:**

- Jste **pure B2C startup** bez IT
- Chcete **quick start** (under 2 měsíce)
- Primárně prodáváte **přes Heureku/Zboží.cz** (Shoptet lepší)
- Máte **€0 IT rozpočet**
- **Šablony z krabice** stačí (Wix/Squarespace lepší)
- Potřebujete **native mobile app** pro customers (Shopify Shop App, Ecwid ShopApp)

---

_Dokument sestaven na základě oficiální dokumentace Shopware (shopware.com, docs.shopware.com, store.shopware.com), Shopware Copilot announcements, Fair Usage Policy March 2025, nezávislých analýz (Qualimero, Kiwee Tech Radar, Swell, LitExtension, Tobias Schäfer blog, Brainstream Technolabs), release notes Shopware 6.6 a 6.7 – duben 2026._
