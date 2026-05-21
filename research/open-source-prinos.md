# Co přinesou open source e-commerce systémy do naší platformy

> **Cíl:** Analyzovat hlavní open source platformy (WooCommerce, PrestaShop, Magento/Adobe Commerce, Sylius, Medusa, OpenCart, Spree, Saleor) a **vybrat to nejlepší** – co můžeme přinést / inspirovat se / převzít filozofii pro náš ultimátní systém.
> **Datum:** duben 2026
> **Návaznost:** předchozí strategický dokument "Ultimátní platforma"

---

## Obsah

1. [Proč se zabývat open source (když děláme SaaS)](#1-proč-se-zabývat-open-source-když-děláme-saas)
2. [Přehled hlavních open source platforem](#2-přehled-hlavních-open-source-platforem)
3. [WooCommerce – co si vzít](#3-woocommerce--co-si-vzít)
4. [PrestaShop – co si vzít](#4-prestashop--co-si-vzít)
5. [Magento / Adobe Commerce – co si vzít](#5-magento--adobe-commerce--co-si-vzít)
6. [Sylius – co si vzít](#6-sylius--co-si-vzít)
7. [Medusa – co si vzít](#7-medusa--co-si-vzít)
8. [OpenCart – co si vzít](#8-opencart--co-si-vzít)
9. [Spree Commerce – co si vzít](#9-spree-commerce--co-si-vzít)
10. [Saleor – co si vzít](#10-saleor--co-si-vzít)
11. [Shopware CE – co si vzít](#11-shopware-ce--co-si-vzít)
12. [Unikátní vychytávky open source světa](#12-unikátní-vychytávky-open-source-světa)
13. [Slabiny open source, kterým se vyhnout](#13-slabiny-open-source-kterým-se-vyhnout)
14. [Open source filozofie v našem systému](#14-open-source-filozofie-v-našem-systému)
15. [Hybrid model – SaaS + Open Source](#15-hybrid-model--saas--open-source)
16. [Konkrétní features, které přidáme](#16-konkrétní-features-které-přidáme)
17. [Ekosystem strategy](#17-ekosystem-strategy)
18. [Developer community strategy](#18-developer-community-strategy)
19. [Risk analysis a mitigation](#19-risk-analysis-a-mitigation)
20. [Závěr a next steps](#20-závěr-a-next-steps)

---

## 1. Proč se zabývat open source (když děláme SaaS)

### 1.1 Open source je obrovský trh

**Fakta (2026):**

- **WooCommerce:** 33–38 % globálního e-commerce market share, **6+ milionů aktivních obchodů**, **9 milionů instalací historicky**
- **Magento / Adobe Commerce:** 2 % market share, ale obsluhuje **top enterprise** (Coca-Cola, Nike, Asus, HP)
- **PrestaShop:** 300 000+ obchodů, silný v **Evropě a Latinské Americe**
- **Shopware CE:** 100 000+ obchodů
- **Sylius, Medusa, Saleor:** rostoucí (moderní headless)

**Dohromady open source obsluhuje cca 40–45 % e-commerce trhu.** Ignorovat to nelze.

### 1.2 Co od nich merchants očekávají

Merchants, kteří **přichází z open source na SaaS**, očekávají:

- **Flexibilitu customizace** (open source má nekonečnou)
- **Data ownership** (open source je úplný vlastník)
- **Žádný lock-in**
- **Obrovský ekosystém** (WooCommerce = 59 000+ pluginů)
- **Developer-friendly** (API, hooks, filters)

**Pokud jim to SaaS nedá → zůstávají u open source.**

### 1.3 Proč open source merchants migrují

**Hlavní důvody opuštění open source:**

- **Updates = peklo** (WooCommerce/Magento update rozbije pluginy)
- **Security** (denní útoky na WordPress → WooCommerce)
- **Performance** (špatný hosting → pomalý web)
- **Maintenance cost** (developer potřeba neustále)
- **Plugin conflicts** (desítky pluginů se hádají)
- **Žádná oficiální podpora**

**Opportunity:** Dát jim **open source výhody (flexibility, data ownership) + SaaS výhody (hotová, bezpečná, rychlá).**

### 1.4 Dvě strategie získání open source merchants

**Strategie A: Migrace na plný SaaS**

- Zoufalí open source merchants chtějí **end to pain**
- Lákáme je na: managed everything, žádná údržba, stále flexibilní

**Strategie B: Hybrid model**

- **Self-host option** dostupný pro náročné
- **SaaS** pro pohodlí
- Merchant si vybírá

**Naše doporučení:** Primárně A, B jako fallback pro enterprise (jak dělá Shopware).

### 1.5 Proč kombinovat nejlepší z open source s SaaS

Open source platformy vyvíjejí **15-20 let** a mají **stovky komunitních nápadů**, které SaaS platformy nemají:

- Hooks & filters systém (WordPress/WooCommerce)
- Event observers (Magento)
- Template overrides (všechny)
- CLI tools
- Migration scripts
- Test frameworks
- Module scaffolding

**My tyhle nápady přeneseme** a dáme merchants **nejlepší obou světů**.

---

## 2. Přehled hlavních open source platforem

**Rychlý snapshot hlavních hráčů, jejich charakteristik a co nás u nich zajímá:**

| Platforma                    | Obchodů | Jazyk            | Cílí na               | Hlavní síla                  | Co si vzít                             |
| ---------------------------- | ------- | ---------------- | --------------------- | ---------------------------- | -------------------------------------- |
| **WooCommerce**              | 6M+     | PHP / WP         | SMB, content-first    | Obří ekosystém, WordPress    | Hooks, pluginy, HPOS, block checkout   |
| **PrestaShop**               | 300k    | PHP              | SMB, EU               | Lokalizace, dostupnost       | Multi-store, překlady, SMB focus       |
| **Magento / Adobe Commerce** | 120k    | PHP              | Enterprise            | B2B, škálovatelnost          | Modularity, multi-store, GraphQL, Hyvä |
| **Sylius**                   | 10k+    | PHP / Symfony    | Enterprise custom     | Code quality, testovatelnost | Modern architecture, Symfony patterns  |
| **Medusa**                   | 5k+     | Node.js / TS     | Headless první        | Developer experience, API    | TypeScript-first, modular, Next.js     |
| **OpenCart**                 | 300k+   | PHP              | SMB, jednoduché       | Rychlý start, jednoduchý     | Simplicity wins, multi-store lite      |
| **Spree Commerce**           | 10k+    | Ruby on Rails    | Enterprise custom     | Rails quality                | Event-driven, flexibility              |
| **Saleor**                   | 5k+     | Python / GraphQL | Mid-market composable | GraphQL-only, headless       | API-first, Django patterns             |
| **Shopware CE**              | 100k+   | PHP / Symfony    | Mid-market            | B2B, Shopping Experiences    | Už rozebráno v jiném dokumentu         |

### 2.1 Vývojářská popularita

**Z GitHubu (hvězdičky, duben 2026):**

- Medusa: **25 000+ stars** (nejaktivnější)
- Saleor: **21 000+ stars**
- Spree Commerce: **13 000+ stars**
- Sylius: **7 500+ stars**
- Magento: **11 000+ stars**
- PrestaShop: **8 500+ stars**
- WooCommerce: **9 000+ stars**

**Medusa a Saleor jsou "next-gen"** – mladé, moderní, headless-first. Magento/WooCommerce jsou "legacy gold standards".

---

## 3. WooCommerce – co si vzít

WooCommerce je **největší e-commerce platforma světa** (36 % online stores). Od roku 2011 WordPress plugin. Dnes vlastní Automattic.

### 3.1 Klíčové statistiky 2026

- **6+ milionů aktivních obchodů**
- **33–38 % globální market share**
- **$30–35 miliard ročního obratu** across ecosystem
- **211 milionů stažení** plugin historicky
- **30 000 stažení denně**
- **800+ oficiálních extensions** + 6 000+ third-party + 59 000+ kompatibilních WP pluginů
- **13 000+ themes**

### 3.2 Co je na WooCommerce unikátní

**1. WordPress symbióza**

- Content + commerce pod jednou střechou
- **Blog + e-shop** nativně (bez integrací)
- SEO síla WordPressu (mocná)
- Gutenberg block editor integrated

**2. Hook system**
WordPress má **actions** (do něčeho) a **filters** (modify něčeho). WooCommerce je staví extrémně **extensible**:

- `woocommerce_before_add_to_cart_button` (před tlačítkem)
- `woocommerce_calculated_total` (modify calculation)
- 3 000+ hooks napříč codebase
- **Developer může přepsat cokoliv bez editace core**

**3. Free core**

- 100 % zdarma
- **Placené jsou jen extensions**
- Merchant má **kontrolu nad každým aspektem**

**4. Ohromný ekosystém**

- **59 000+ WordPress pluginů** technicky kompatibilních
- Yoast SEO, WPML (multi-language), ElementorPro
- Tisíce agentur globálně
- 80+ WordCampů ročně

**5. Block Checkout (2024+)**
Nový checkout based on Gutenberg blocks:

- Drag-and-drop editovatelný
- Konverze-optimized
- **Fast**
- Extensible přes blocks

**6. High-Performance Order Storage (HPOS)**
Od 2024:

- Objednávky v **dedikovaných tabulkách** (ne WP posts)
- **10× rychlejší** queries
- Škálovatelnost **milionů objednávek**

### 3.3 Co si z WooCommerce VZÍT pro náš systém

#### A. Hook & Filter systém (PRIORITA 1)

**Proč:** Nejextensibelnější architektura v e-commerce. Every developer WordPress toto zná.

**Jak implementovat:**

- **Event bus** napříč platformou
- **Pre/post hooks** pro každou akci (order created, product updated, payment received)
- **Filter hooks** pro modifikaci dat (order total, product price, cart items)
- **Developer SDK** dokumentující všechny hooks
- **Visual hook explorer** (ukáže, co se kdy volá)

**Výhoda pro nás:**

- Developers z WordPress/WooCommerce se snadno **přenesou** na naši platformu
- **Migration-friendly** (jejich custom code funguje podobně)
- Nemusíme vymýšlet API, jen hooks

#### B. "WordPress symbiosis" – content + commerce

**Proč:** WooCommerce výhra = content marketing obchody (fashion blogs, gourmet, hobby).

**Jak:**

- **Blog built-in** jako first-class citizen
- **Content-to-commerce** linking snadno
- **Shoppable articles**
- **Rich content editor** (blog-level quality, ne jen produkty)
- **SEO parity** s WordPress

**Výhoda:** Lákáme merchants, kteří **potřebují blog + e-shop** bez dvou systémů.

#### C. HPOS-style architektura

**Proč:** WooCommerce ukázal, že **monolithic order storage nescaluje**.

**Jak:**

- **Orders v dedikovaných tabulkách** od začátku
- **Event sourcing** pro order changes
- **Scalable na miliony orders**
- **Read replicas** pro analytics

**Výhoda:** Od prvního dne připraveni na 10M+ orders/month merchants.

#### D. Block-based admin & storefront

**Proč:** Gutenberg blocks = future of editing.

**Jak:**

- **Block editor** pro product pages
- **Block editor** pro email templates
- **Block editor** pro PDF invoices
- **Block editor** pro storefront themes
- **Shared block library** across platform

**Výhoda:** Konzistentní UX napříč platform.

#### E. Plugin scaffolding & CLI

**Proč:** `wp plugin create` je best-in-class developer experience.

**Jak:**

- `commerce-cli plugin create my-plugin`
- **Scaffolding** generates complete plugin structure
- **Hot reload** during development
- **Testing framework** included
- **Automatic docs** generation

**Výhoda:** Developer joy → ekosystém roste.

#### F. Open source extensions marketplace

**Proč:** WooCommerce marketplace má **free + paid** model fungující.

**Jak:**

- Podpora **free plugins** (community)
- Podpora **paid plugins** (revenue share developers)
- **Reviews, ratings, security audits**
- **Auto-updates**
- **Compatibility badges** per verze

**Výhoda:** Ekosystém roste rychleji než closed marketplace.

### 3.4 Co si z WooCommerce NEBRAT

#### A. WordPress dependency ❌

- Security issues
- Performance issues z WP stack
- **Nebudeme na WordPress**

#### B. "Everything is a post" architektura ❌

- Zastaralé
- Performance limits
- **HPOS to řeší, ale lépe začít čistě**

#### C. Plugin compatibility pekla ❌

- "Nainstaloval jsem plugin, rozbil se web"
- Konflikty mezi pluginy
- **Musí být přísnější sandbox**

#### D. Fragmentace ekosystému ❌

- **8 000 pluginů, polovina deprecated, třetina placená, čtvrtina rozbitá**
- Merchant nemá jak vybrat
- **Náš marketplace musí být kurovaný**

---

## 4. PrestaShop – co si vzít

**PrestaShop** je francouzská open source platforma od 2007. Silná v **Evropě, Latinské Americe, Africe**. **300 000+ obchodů**, **5 000+ modulů**.

### 4.1 Klíčové statistiky 2026

- **300 000+ aktivních obchodů**
- **Silný v FR, IT, ES, PT, LATAM, severní Afrika**
- **65+ jazyků** podporováno
- **5 000+ modulů** na PrestaShop Addons
- **3 000+ themes**
- **Komunita:** aktivní vývojáři zejména v FR, IT, ES

### 4.2 Co je na PrestaShop unikátní

**1. Multi-store v ceně**
Od Prestashop 1.5:

- **Multiple shops** z jedné instalace
- **Shared inventory** optional
- **Shared customers** optional
- **Per-store theming, pricing, shipping**
- **Konkurence:** Shopify Plus $2 000/měs., Shopware Evolve €2 400/měs.

**2. Multilanguage od první verze**

- **65+ jazyků** built-in
- **Per-language content**
- **Per-language URLs**
- **Automatic translation** tools
- **Silná lokalizace** per country

**3. Affiliate Program modul**

- Nativní affiliate systém
- Commission tiers
- Partner dashboards
- **Free modul** (ne placený addon)

**4. Product combinations**

- Varianty produktů ve velké detailu
- **Attribute groups** (color → size → material → ...)
- **Combinaton generator**
- **Per-combination** photos, prices, stock
- **Weight adjustments**

**5. SMB focus a dostupnost**

- **Nižší technické nároky** než Magento
- **Rychlejší setup**
- **Levnější** hosting
- **Srozumitelnější** pro merchants bez devů

**6. European focus**

- **GDPR** compliance priorita
- **French legal** (defaultní OP, záruky)
- **EU VAT** handling
- **SEPA** payments
- **Local carriers** (DPD, Colissimo, Chronopost)

### 4.3 Co si z PrestaShop VZÍT

#### A. Multi-store architektura (PRIORITA 1)

**Proč:** Jejich multi-store je **nejlépe navržený** mezi SMB platforms.

**Jak:**

- **Shared catalog option** (master + branches)
- **Independent catalog option** (úplně separate)
- **Shared customer option**
- **Per-store everything** (theme, pricing, shipping, taxes)
- **Centralized admin** pro všechny stores
- **Fast switching** mezi stores

**Výhoda:** Merchant může mít **brand A (B2C) + brand B (B2B) + brand C (different country)** z jednoho admin.

#### B. Translation ecosystem

**Proč:** PrestaShop **65+ jazyků** je nepřekonatelné (WooCommerce 67 jazyků, Shopware ~20, Shopify ~20).

**Jak:**

- **Community translation portal** (like Crowdin)
- **AI translations** pro všechno
- **Human review** workflow
- **Per-country** local legal překlady
- **67+ languages** supported z dne 1

**Výhoda:** Okamžitě relevantní v každé evropské zemi.

#### C. Attribute & combinations engine

**Proč:** PrestaShop to má nejpropracovanější pro **konfigurovatelné produkty**.

**Jak:**

- **Attribute groups** (hierarchické)
- **Attribute dependencies** (pokud color = red, size only M/L)
- **Combination generator** (auto-create all combinations)
- **Per-combination** overrides (price, SKU, stock, weight, photos)
- **Bulk editing** combinations

**Výhoda:** Lepší než Shopify variants, lepší než WooCommerce attributes.

#### D. Local compliance (EU)

**Proč:** PrestaShop je **z Francie**, takže EU compliance je DNA.

**Jak:**

- **Default legal texts** per country
- **Required fields** per country (ICAO codes, VAT IDs)
- **EU VAT rules** (reverse charge, OSS)
- **Consumer rights** (14denní odstoupení) built-in
- **Cookie law** compliance automatic

**Výhoda:** Merchant nepotřebuje právníka per země.

#### E. Modul ecosystem curation

**Proč:** PrestaShop Addons marketplace (placené moduly) je **velmi přísně kurovaný**.

**Jak:**

- **Ověření kvality** před publish
- **Security audit** automaticky
- **Performance benchmarks** per module
- **Compatibility testing**
- **Approved developers** (nejen whoever)

**Výhoda:** Merchant **důvěřuje marketplace**, kupuje víc, ekosystém zdravější.

#### F. SMB-first UX

**Proč:** PrestaShop admin je **přístupnější** než Magento pro malé merchants.

**Jak:**

- **Progressive disclosure** (start simple, advanced unlocks)
- **Guided setup** wizard
- **Default to sensible** options
- **Tooltips everywhere**
- **Video tutorials** integrated

**Výhoda:** **Zkrátíme time-to-first-order** z dní na hodiny.

### 4.4 Co si z PrestaShop NEBRAT

#### A. Performance problémy ❌

- Velké katalogy = pomalé
- Cache složitý
- **My máme edge-first**

#### B. Fragmentace verzí ❌

- 1.5, 1.6, 1.7, 8.x, moduly kompatibilní jen s some
- **Jednoznačná verzovací strategie** u nás

#### C. Nedostatek B2B features ❌

- PrestaShop = B2C first
- B2B jen přes placené moduly
- **U nás B2B nativně** (viz strategy dokument)

---

## 5. Magento / Adobe Commerce – co si vzít

**Magento** (založeno 2008, koupeno Adobe 2018) je **král enterprise e-commerce**. **120 000+ obchodů**, ale obrovská jména (Coca-Cola, Nike, Asus, HP).

### 5.1 Klíčové statistiky 2026

- **120 000+ aktivních obchodů**
- **2 % global market share** (ale top enterprise segment)
- **Adobe Commerce** (placené): **$22 000+/rok** license + enterprise costs
- **Magento Open Source**: zdarma, self-hosted
- **5 000+ extensions** na Marketplace
- **Enterprise clients:** top brands, $5M+ revenue merchants

### 5.2 Co je na Magento unikátní

**1. Modular architektura od základu**
Magento je **100 % modulární**:

- Každá feature = module
- **Core modules** (Catalog, Sales, Checkout)
- **Custom modules** bez editace core
- **Module disable** jednoduše
- **Dependency graph**

**2. Event-driven architecture**

- **Event observers** (subscribe na events)
- **Plugins/interceptors** (AOP-style intercepts)
- **Extension points** everywhere
- **Clean separation** concerns

**3. Nejlepší B2B v open source**

- **Companies accounts**
- **Multiple buyers** per company
- **Shared catalogs**
- **Custom pricing** per customer
- **Quote management**
- **Purchase orders**
- **Credit limits**
- **Requisition lists**
- Všechno v Adobe Commerce

**4. EAV (Entity-Attribute-Value) model**

- **Ultra-flexible** product attributes
- **Add any attribute** without schema change
- **Per-category** attribute sets
- **Attribute inheritance**
- Kritizované za performance, ale nepřekonané ve flexibilitě

**5. Multi-store a multi-website**
Tří-úrovňová hierarchie:

- **Global scope** (all stores)
- **Website scope** (group of stores)
- **Store scope** (individual storefront)
- **Store view scope** (language variant)

**Per-scope override** všech nastavení.

**6. GraphQL API (2.3+)**

- **Native GraphQL** Storefront API
- **Ekvivalent Shopify Storefront API**
- **Headless ready**
- **Hyvä theme** ekosystém (nejrychlejší)

**7. Pricing rules engine**

- **Shopping cart rules** (complex conditions)
- **Catalog rules** (per product/category)
- **Tier pricing** advanced
- **Customer segments** s dynamic conditions

**8. Inventory (Multi-Source)**
Od Magento 2.3:

- **Multiple inventory sources**
- **Stock allocation** per source
- **Source priority** rules
- **Reservations**
- **Source selection algorithm**

### 5.3 Co si z Magento VZÍT

#### A. EAV-inspired flexible attributes (PRIORITA 1)

**Proč:** Merchants potřebují **custom fields** bez devů.

**Jak (modernizovaný EAV):**

- **JSON-based** custom attributes (ne EAV tabulky – pomalé)
- **Attribute sets** per category/product type
- **Inheritance**
- **Validation rules**
- **Visibility rules** (per customer group, per store)
- **Search indexing** automatic

**Výhoda:** Shopify to neumí. My ano.

#### B. Event observer system

**Proč:** Magento event observers = **top-tier extensibility**.

**Jak:**

- **Observable events** napříč systémem
- **Subscribe handlers** (Flow Builder-style visual nebo code)
- **Priority** ordering
- **Async/sync** execution
- **Error handling** robust

**Výhoda:** Enterprise developers se cítí jako doma.

#### C. Multi-Source Inventory (MSI)

**Proč:** Nejlepší multi-warehouse open source.

**Jak:**

- **Multiple sources** per product
- **Stock priority** algorithms (distance, cost, availability)
- **Reservations** system
- **Source selection** per order
- **Transfer workflows**

**Výhoda:** Enterprise fulfillment capability z dne 1.

#### D. Pricing rules engine (advanced)

**Proč:** Nejkomplexnější rules engine.

**Jak:**

- **Visual rule builder** (jako Shopware Rule Builder)
- **Cart rules** (celkové objednávky)
- **Catalog rules** (per produkt)
- **Customer segment rules**
- **Combined rules**
- **Priority ordering**
- **Apply to X get Y free**

**Výhoda:** Merchants mohou tvořit **libovolnou promo** bez devů.

#### E. Multi-website / multi-store hierarchie

**Proč:** Tri-level hierarchie je **jedinečná flexibilita**.

**Jak:**

- **Global settings** (apply all)
- **Website settings** (group)
- **Store settings** (individual)
- **Store view** (language)
- **Override on any level**

**Výhoda:** Enterprise brands managed one place.

#### F. GraphQL Storefront API

**Proč:** Magento's GraphQL je **enterprise standard**.

**Jak:**

- **GraphQL-first** design
- **Federated schema** (z modulů)
- **Subscriptions** support
- **Optimized queries**
- **Built-in docs**

**Výhoda:** Headless-ready z dne 1.

#### G. Customer segments

**Proč:** Nejpokročilejší segmentace mezi open source.

**Jak:**

- **Dynamic segments** (auto-updated)
- **Conditions** (purchase history, demographics, behavior)
- **Used in:** pricing, promotions, content, email
- **Real-time evaluation**

**Výhoda:** Personalizace bez dalších nástrojů.

#### H. Hyvä theme philosophy

**Proč:** Hyvä (community theme pro Magento) ukázal, že **modernizace starého frontend enormně rychle**.

**Jak (inspirace):**

- **Alpine.js + Tailwind** stack (lightweight)
- **No jQuery**
- **Server-side rendered** + hydration
- **Fast by default**
- **Developer joy**

**Výhoda:** Storefront performance benchmark.

### 5.4 Co si z Magento NEBRAT

#### A. Extreme complexity ❌

- Steep learning curve (6-12 měsíců)
- Over-engineered pro 95 % merchants
- **Composable ano, ale ne pro non-devs**

#### B. Performance problémy ❌

- EAV pomalý
- Bootstrap slow
- Cache jako umění
- **Náš systém rychlý z defaultu**

#### C. Cena Adobe Commerce ❌

- $22 000+/rok license
- $100k+ implementation
- **My levnější a stejně mocní**

#### D. Developer-only mindset ❌

- Admin vyžaduje devy pro mnoho tasks
- **Our admin = non-devs friendly + dev-friendly**

---

## 6. Sylius – co si vzít

**Sylius** je **Symfony-based** open source platforma. Mladší (2015+), ale **vývojářsky elitní**. Cíl: **headless, customizable, testovatelné**.

### 6.1 Co je unikátní

**1. Symfony framework**

- **Best PHP framework** (mimo Laravel)
- **Clean architecture**
- **SOLID principles**
- **Testable code** (PHPUnit, Behat)
- **Dependency injection**

**2. Plus Edition (commercial)**

- **Sylius Plus** = open core model
- Commercial features (B2B, multi-store, partial shipments)
- **License fee** for commercial features
- **Still self-hosted**

**3. Plugin-first**

- **Every feature = plugin**
- **Core je minimal**
- **Plugins composable**
- **Easy testing**

**4. API Platform integration**

- **API Platform** (Symfony-based REST/GraphQL)
- **Auto-generated API** z entit
- **OpenAPI docs** automatic
- **Headless z dne 1**

**5. Behat / BDD**

- **Behavior-driven development** built into culture
- **User story tests**
- **Readable specs**
- **Quality assured**

### 6.2 Co si z Sylius VZÍT

#### A. Code quality culture

**Proč:** Sylius ukázal, že **clean code + tests** jsou možné v e-commerce.

**Jak:**

- **100 % test coverage** target
- **BDD specs** pro features
- **Clean architecture** enforced
- **Code review** mandatory
- **Open source** core (community audit)

**Výhoda:** Naše platforma = **nejstabilnější v oboru**.

#### B. Open core model

**Proč:** "Core open, addons commercial" je proven model.

**Jak:**

- **Core open source** (attract devs)
- **Commercial extensions** (our revenue)
- **Self-hosting** option
- **SaaS** option

**Výhoda:** Lákáme enterprise s preferencí self-host + máme SaaS pro SMB.

#### C. API Platform approach

**Proč:** **Auto-generated API z entit** = massive dev time savings.

**Jak:**

- **Define entity once**
- **API endpoints auto-generated** (REST + GraphQL)
- **Docs auto-generated**
- **Validation, serialization** auto
- **Developers happy**

**Výhoda:** Developers mohou customizovat rychle.

#### D. Symfony patterns

**Proč:** Sylius = gold standard **moderní PHP e-commerce**.

**Jak:**

- **Service container** DI
- **Event dispatcher**
- **Messenger** (async processing)
- **Forms** framework
- **Workflow component**

**Výhoda:** Enterprise Symfony developers (DACH, Nederlanden, Polsko) se k nám přesunou.

#### E. Plugin architecture

**Proč:** Sylius plugin architecture je **composable před tím, než to bylo trendy**.

**Jak:**

- **Plugins standalone** (instalable/uninstallable)
- **Dependencies** explicit
- **Override any service**
- **Compose shop** z plugins

**Výhoda:** True composable commerce.

### 6.3 Co si z Sylius NEBRAT

#### A. Developer-only audience ❌

- Admin = funkční, ale prostý
- **Non-devs se na to nekoukají**

#### B. Malá komunita ❌

- ~7 500 GitHub stars
- **Nemůžeme spoléhat jen na komunitu**

---

## 7. Medusa – co si vzít

**Medusa** je **next-gen headless commerce** (založen 2021). TypeScript-first, Node.js, Next.js. **Rychle rostoucí**, populární u modern startups.

### 7.1 Co je unikátní

**1. TypeScript first**

- Ne PHP
- Ne Ruby
- **TypeScript everywhere**
- **Type safety** across stack
- **Modern JS** tooling

**2. Headless-only**

- Ne "monolith s API"
- **API-first from day 1**
- Admin **separate** (React)
- Storefront **separate** (Next.js)

**3. Admin in React**

- Modern React admin
- Hot reload
- Developer joy
- Customizable

**4. Next.js starter**

- **Official Next.js** storefront
- **Production-ready**
- **SEO-optimized**
- **Server components**
- **Streaming**

**5. Flexible cart**

- **Unified cart abstraction**
- Support: standard, subscription, split orders
- **Line item modifiers**

**6. Modular v2.0 (2024)**

- Kompletní redesign
- **Modules** přes packages
- **Independent deployability**
- **Workflows** engine
- **Admin extensions**

**7. MikroORM**

- Modern ORM
- Better than TypeORM, Prisma
- **Data migrations** friendly

### 7.2 Co si z Medusa VZÍT

#### A. TypeScript stack (PRIORITA 1)

**Proč:** **Budoucnost backend** je TypeScript (nebo Rust/Go).

**Jak:**

- **TypeScript** everywhere
- **Shared types** frontend-backend
- **Fullstack** type safety
- **Modern tooling** (Bun, Deno kde relevantní)
- **IDE support** excellent

**Výhoda:** **10× lepší DX** než PHP platformy.

#### B. Workflow engine

**Proč:** Medusa's workflow engine je **next-gen Flow Builder**.

**Jak:**

- **Define workflows** in TypeScript
- **Compensation logic** (rollback on failure)
- **Retry strategies**
- **Observability**
- **Testable**

**Výhoda:** **Enterprise reliability** pro custom logic.

#### C. Module-based architecture v2

**Proč:** **Independent modules** = composable reality.

**Jak:**

- **Product module** standalone
- **Cart module** standalone
- **Order module** standalone
- **Each deployable** separately
- **Communicate via events**

**Výhoda:** Skutečná composability.

#### D. Next.js starter kit

**Proč:** Medusa + Next.js = **best-in-class modern storefront**.

**Jak:**

- **Official Next.js starter** v 15 nebo 16
- **App Router**
- **Server components**
- **Streaming**
- **Production-ready**
- **MIT licensed**

**Výhoda:** Merchant dostane **Vercel-quality storefront** free.

#### E. Admin extensions

**Proč:** Medusa admin je **React-based, extensible**.

**Jak:**

- **Widgets** (add to existing pages)
- **Routes** (entire custom pages)
- **Form fields** (extend existing forms)
- **React components** library

**Výhoda:** Developers přidávají funkce rychle.

#### F. Cart abstraction

**Proč:** Medusa cart je **nejflexibilnější**.

**Jak:**

- **Line items** s modifiers
- **Multi-warehouse** shipping
- **Split orders** automatic
- **Discount codes** advanced
- **Custom line item types** (subscription, rental, digital)

**Výhoda:** Unusual business models supported.

### 7.3 Co si z Medusa NEBRAT

#### A. Immaturity (2026) ❌

- Ještě se vyvíjí rychle
- Breaking changes
- **My musíme být stabilnější**

#### B. Developer-only ❌

- Žádný non-dev admin (zatím)
- **My musíme být pro obě skupiny**

#### C. Small ecosystem ❌

- ~5k obchodů vs. WooCommerce 6M
- **Ecosystem time**

---

## 8. OpenCart – co si vzít

**OpenCart** je **lightweight** open source platforma. **300 000+ obchodů**, populární pro **malé obchody** (jednoduchost > features).

### 8.1 Co je unikátní

**1. Simplicity**

- **Install in 5 minutes**
- **Lehký** na hosting
- **Jednoduchá** struktura
- **Málo pluginů potřeba** pro start

**2. Multi-store built-in**

- Even v open version
- **Basic multi-store**
- **Shared admin**

**3. Low resource requirements**

- Runs on **shared hosting**
- **Fast** na slabém hardware
- **Minimal dependencies**

### 8.2 Co si z OpenCart VZÍT

#### A. Simplicity first principle

**Proč:** OpenCart ukazuje, že **simplicity wins** pro SMB.

**Jak:**

- **Default admin** ultra-jednoduchý
- **Advanced features** hidden (unlock-able)
- **Progressive disclosure**
- **Minimum required fields** pro setup

**Výhoda:** **Time-to-first-sale** extrémně rychlý.

#### B. Fast onboarding

**Proč:** OpenCart setup **minuty, ne dny**.

**Jak:**

- **One-click deploy**
- **Templates** ready-to-sell
- **Sample data** optional
- **Guided tour**
- **First-product wizard**

**Výhoda:** Non-devs úspěšní.

#### C. Lightweight approach

**Proč:** OpenCart **nedělá příliš**, a to je jeho síla pro SMB.

**Jak:**

- **Core features** only in default
- **Add-ons** optional
- **Fast by default**
- **No bloat**

**Výhoda:** Merchants neutonou ve features.

---

## 9. Spree Commerce – co si vzít

**Spree** je **Ruby on Rails** open source platforma (založena 2007). **10 000+ obchodů**, silná **Rails komunita**, používaná např. GoDaddy.

### 9.1 Co je unikátní

**1. Ruby on Rails elegance**

- **Convention over configuration**
- **Rapid development**
- **Beautiful code**
- **Strong conventions**

**2. Modular engine architecture**

- Každý modul = **Rails engine**
- **Mountable** in any Rails app
- **Extensible** deeply
- **Composable**

**3. Event-driven notifications**

- **ActiveSupport notifications**
- **Subscribe to anything**
- **Perfect for integrations**

**4. Enterprise adoption**

- GoDaddy bought Spree (2015)
- **Enterprise-grade** support
- **Stable** core

### 9.2 Co si z Spree VZÍT

#### A. Convention over configuration

**Proč:** Rails-style DX = merchants/devs **productive instantly**.

**Jak:**

- **Sensible defaults**
- **Minimal config** pro 90 % cases
- **Override when needed**
- **Documentation** as convention

**Výhoda:** Faster onboarding.

#### B. Mountable engines concept

**Proč:** Module = deployable unit = **true composable**.

**Jak (adaptace pro náš stack):**

- **Modules as packages**
- **Mount in different deployments**
- **Independent scaling**
- **Isolated failure**

**Výhoda:** Enterprise architecture.

---

## 10. Saleor – co si vzít

**Saleor** je **Python / GraphQL** open source. Modern headless (2018+). **Polsko-based**. Populární u **headless enthusiasts**.

### 10.1 Co je unikátní

**1. GraphQL-only**

- **Ne REST**
- **GraphQL everywhere**
- **Type-safe**
- **Subscriptions**

**2. Python / Django**

- Moderní Python stack
- **AsyncIO** for performance
- **PostgreSQL** only (no MySQL)
- **Type hints** everywhere

**3. Headless-first**

- Ne "with headless option"
- **Headless is the only way**
- Admin is separate React app
- Storefront is separate

**4. Multichannel**

- **Channel concept** (per-region/brand/customer segment)
- **Per-channel pricing, inventory, availability**
- **Strong separation**

**5. Saleor Apps platform**

- **Third-party apps** mimo core
- **Webhooks** heavy
- **OAuth** for installations

### 10.2 Co si ze Saleor VZÍT

#### A. GraphQL-first design

**Proč:** Saleor dokázal, že **pure GraphQL platforma** funguje.

**Jak:**

- **GraphQL primary API**
- **REST secondary** (for backwards compatibility)
- **Subscriptions** for real-time
- **Federated schema**

**Výhoda:** Modern developers love it.

#### B. Channel architecture

**Proč:** Saleor's channels = **lepší multi-store koncept**.

**Jak:**

- **Channel = namespace** for pricing, inventory, availability
- **Products assignable** to multiple channels
- **Clean separation** of concerns
- **Flexible**

**Výhoda:** **Lepší než Magento websites/stores**.

#### C. Apps-as-microservices

**Proč:** Saleor Apps **nejsou in-process plugins**, ale **external services**.

**Jak:**

- **Apps** hostovány externally
- **Webhooks** pro komunikaci
- **OAuth** for permissions
- **Isolation** naturally

**Výhoda:** **Žádné plugin conflicts**, true microservices.

---

## 11. Shopware CE – co si vzít

Už rozebráno v samostatném dokumentu (shopware-cloud-kompletni-analyza.md), ale shrnutí **specificky pro open source přínos**.

### 11.1 Co je z Shopware CE (open source)

**1. MIT licence**

- Permissive
- **Bez GPL copyleft**
- Commercial plugins OK

**2. Shopping Experiences**

- **Best-in-class CMS** v open source
- **Per-customer-group content**

**3. Rule Builder**

- **Visual rule engine**
- **Bez kódu**
- **Napříč systémem**

**4. Flow Builder**

- **Business automation**
- **Symfony Messenger** pod kapotou

**5. Symfony stack**

- Same as Sylius
- **Modern PHP**

### 11.2 Co si z Shopware VZÍT (nad rámec předchozího dokumentu)

**(Již zmíněno v strategickém dokumentu – sekce 8, 9, 10 původního dokumentu.)**

Klíčové:

- **Shopping Experiences** UX
- **Rule Builder** napříč systémem
- **Flow Builder** automation
- **B2B Components** přístup
- **Symfony patterns**

---

## MARKDOWN_EOF

## 12. Unikátní vychytávky open source světa

Sebraná sbírka **konkrétních vychytávek**, které SaaS platformy nemají a my je přeneseme:

### 12.1 Developer-side vychytávky

**1. Hooks & filters (WooCommerce)**

- 3 000+ events napříč codebase
- Developer může interceptovat **cokoliv**
- **Naše verze:** TypeScript event bus s autocomplete

**2. Event observers (Magento)**

- Subscribe to events
- Priority ordering
- Sync/async
- **Naše verze:** dekorátory v TypeScript

**3. Theme override system**

- **Copy file to override** (WooCommerce style)
- Inheritance
- Fallback to core
- **Naše verze:** layer-based themes

**4. Dependency injection (Magento, Sylius)**

- Service container
- Override any service
- **Naše verze:** Nest.js DI (TypeScript-native)

**5. CLI tools (WooCommerce WP-CLI, Magento bin/magento)**

- Scaffolding
- Cache management
- Database operations
- Cron management
- **Naše verze:** `commerce-cli`

**6. Docker dev environments (všechny moderní)**

- **One-command setup**
- **Identical to production**
- **Fast iteration**
- **Naše verze:** Bun-based zero-config

**7. Database migrations**

- Version-controlled schema changes
- **Upgrade path** automatic
- **Downgrade** possible
- **Naše verze:** Prisma/Drizzle migrations

**8. Indexing system (Magento)**

- **Background indexing** heavy data
- **Flat tables** for reading
- **Product, category, price indexers**
- **Naše verze:** Materialized views + edge cache

**9. Cron job management (Magento, WooCommerce)**

- Scheduled tasks
- **WP-Cron** style UI
- **Recurring jobs**
- **Naše verze:** Edge cron + Temporal.io patterns

**10. Translation systems (PrestaShop)**

- **In-admin editing**
- **Community contributions**
- **Export/import** translations
- **Naše verze:** AI + community + professional

**11. Error reporting (všechny)**

- **Logs accessible**
- **Debugging mode**
- **Stack traces**
- **Naše verze:** Sentry-like with AI suggestions

**12. Caching layers (Magento)**

- **Multi-level cache** (Redis, Varnish, Browser)
- **Tag-based invalidation**
- **Full page cache**
- **Naše verze:** Edge-first caching

### 12.2 Merchant-side vychytávky

**1. Unlimited categories / products (vše open source)**

- **Soft limits only**
- **Hosting-based**
- **Naše verze:** Truly unlimited (cloud-based)

**2. Bulk editing (Magento)**

- **Edit thousands of products** at once
- **CSV import/export**
- **Conditional updates**
- **Naše verze:** AI-assisted bulk + CSV/Excel

**3. Price rules (Magento)**

- **Catalog rules** (per produkt)
- **Cart rules** (per order)
- **Complex conditions**
- **Naše verze:** Rule Builder visual

**4. Customer segmentation (Magento)**

- **Dynamic segments**
- **Auto-updating**
- **Used in promotions**
- **Naše verze:** AI-powered segments

**5. Attribute sets (Magento)**

- **Per product type**
- **Different fields** pro různé products
- **Shared attributes** across sets
- **Naše verze:** Flexible schema per category

**6. Product combinations (PrestaShop)**

- **All variations** auto-generated
- **Per-combination** data
- **Bulk combination** edits
- **Naše verze:** Advanced variant matrix

**7. Multi-store (PrestaShop, Magento)**

- **Independent stores** from one admin
- **Shared or separate** inventory
- **Different themes**
- **Naše verze:** Sales Channels-style

**8. Multi-language (PrestaShop)**

- **65+ languages**
- **Per-language content**
- **Community translations**
- **Naše verze:** 70+ languages, AI-assisted

**9. Tax engine (Magento)**

- **Complex tax rules**
- **Per-region**
- **Per-product**
- **Per-customer**
- **Naše verze:** All EU/US/global taxes

**10. Inventory (Multi-Source Inventory - Magento)**

- **Multiple warehouses**
- **Source priority**
- **Reservations**
- **Naše verze:** Multi-warehouse native

### 12.3 Unikátní "small" features

**1. "Wish you had" price alerts (PrestaShop)**

- Customer signs for price drop
- Auto-notify
- Conversion boost

**2. Loyalty points (PrestaShop modules)**

- Points per purchase
- Redemption
- Tiers

**3. Store credit (Magento)**

- Customer wallet
- Refund as credit
- Gift cards too

**4. Wishlist sharing (WooCommerce, Magento)**

- Email wishlist
- Social share
- Gift registry

**5. Product comparison (Magento)**

- Compare 2-4 products side-by-side
- Feature table
- Print-friendly

**6. "Check Stock" per store location (Magento MSI)**

- Customer sees stock per location
- Pick-up in store
- Reserve online

**7. Downloadable products with access limits (Magento)**

- Digital downloads
- X downloads allowed
- Time-limited access

**8. Gift cards engine (Magento, others)**

- Custom amounts
- Custom designs
- Email delivery
- Balance tracking
- Redemption

**9. Reward programs with complex rules (Magento)**

- Points per purchase
- Points per review
- Points per referral
- Tier benefits

**10. Abandoned cart emails with incentive escalation (WooCommerce Follow-Ups)**

- Email 1: reminder
- Email 2: 5% off
- Email 3: 10% off
- Email 4: final chance

**11. Follow-up emails sequence (WooCommerce)**

- Post-purchase emails
- Review request
- Upsell sequences
- Win-back

**12. Backorders & preorders (Magento, WooCommerce)**

- Allow orders sold out
- Partial payment
- Expected delivery

**13. Product questions (Magento Commerce)**

- Customer Q&A per product
- Admin response
- FAQ effect

**14. Advanced search with weighting (Magento)**

- Search by multiple attributes
- Weighted relevance
- Synonyms
- Typo tolerance

**15. Customizable URL structure (všechny)**

- `/produkty/kategorie/nazev`
- Or `/nazev-produktu`
- Or flat
- SEO benefit

### 12.4 Compliance & legal vychytávky

**1. German-specific: FireGento MageSetup** (Magento)

- Default tax rates
- Legal texts
- **EU compliance** ready

**2. PrestaShop: OSS compliance**

- EU VAT OSS
- IOSS for imports
- Auto-generated reports

**3. WooCommerce: WPML for legal** (plugin)

- Legal texts per language
- Court-required translations
- GDPR per country

### 12.5 B2B open source vychytávky

**1. Magento Commerce B2B**

- Corporate accounts
- Multiple buyers
- Payment terms
- Credit limits
- **Gold standard** in open source

**2. Sylius Plus B2B**

- Multi-source inventory
- B2B portal
- Wholesale pricing

**3. WooCommerce B2B Plugins**

- Wholesale Suite
- B2B King
- **Fragmented** but functional

---

## 13. Slabiny open source, kterým se vyhnout

**Rovněž důležité**: co **nepřinést** z open source světa. Slabiny, kterým se vyhneme:

### 13.1 Plugin pekla

**Problém:**

- WooCommerce: nainstalujete 10 pluginů, stránka pomalá, conflicts
- Magento: plugin compatibility matrix noční můra
- PrestaShop: placené moduly různé kvality

**Naše řešení:**

- **Strict sandbox** mezi plugins
- **Compatibility checks** automatic
- **Performance budgets** per plugin
- **Deprecation warnings** early
- **Quality ratings** visible
- **Kurovaný** marketplace

### 13.2 Upgrade peklo

**Problém:**

- Magento 1 → 2: celé přepisování
- WooCommerce 3 → 4 → 5: plugin breaks
- Shopware 5 → 6: migration project

**Naše řešení:**

- **Semantic versioning** strict
- **Backward compatibility** guarantees
- **Automated migration** tools
- **Deprecation periods** long (2+ let)
- **No major breaking** changes without path

### 13.3 Security nightmare

**Problém:**

- WordPress/WooCommerce: **most-attacked** platform (30 % all websites)
- Magento: **critical CVEs** regularly
- PrestaShop: **outdated modules** vulnerabilities

**Naše řešení:**

- **SaaS** = we handle security
- **Auto-updates** mandatory
- **WAF** built-in
- **Penetration testing** regular
- **Bug bounty** program
- **Security-audit** plugins before listing

### 13.4 Performance problems

**Problém:**

- WooCommerce + 20 plugins = **10-sekundový page load**
- Magento untuned = **brutal slow**
- Shared hosting = pain

**Naše řešení:**

- **Edge-first** architecture
- **Performance budget** per plugin
- **Lazy loading** defaults
- **Auto-optimization**
- **Performance dashboard** per store
- **Fast by default** (no tuning needed)

### 13.5 Maintenance overhead

**Problém:**

- Self-hosted = **DevOps burden**
- Security patching
- Backups
- Scaling
- Monitoring

**Naše řešení:**

- **Fully managed** SaaS
- **Merchant focuses on business**
- **Infrastructure = us**

### 13.6 Fragmentace ekosystému

**Problém:**

- **59 000 WooCommerce plugins** = analysis paralysis
- **5 000 Magento extensions** = quality varies
- Merchant nemá jak vybrat

**Naše řešení:**

- **Kurovaný** marketplace
- **Categorized** by use case
- **Recommendations** AI-driven
- **Compatibility tested**
- **Quality scored**

### 13.7 Lack of official support

**Problém:**

- "Check the forum" jako odpověď
- Community help variable quality
- Enterprise potřebuje SLA

**Naše řešení:**

- **Professional support** from day 1
- **SLA** for paid tiers
- **Community** as bonus, not primary
- **Expert hours** available

### 13.8 Outdated code quality

**Problém:**

- WooCommerce: legacy WP patterns
- Magento: over-engineered
- Old PHP practices
- No types

**Naše řešení:**

- **TypeScript** everywhere
- **Modern patterns**
- **Clean architecture**
- **Documented**

### 13.9 Vendor lock-in (ironicky)

**Problém:**

- Self-host = lock-in to your infrastructure
- Custom code accumulates
- Migration to another platform stejně bolestivá

**Naše řešení:**

- **Data export** always
- **Migration tools** built-in
- **Open standards** where possible
- **MIT-licensed SDKs**

### 13.10 Documentation quality

**Problém:**

- Open source docs often outdated
- Tutorials for old versions
- Stack Overflow = hit or miss

**Naše řešení:**

- **Official docs** maintained
- **Video tutorials** current
- **Interactive examples**
- **AI-assisted** search

---

## 14. Open source filozofie v našem systému

**Co z open source mindsetu adoptujeme – i když jsme SaaS:**

### 14.1 Data ownership

**Merchant vlastní vše:**

- **Export anything** anytime (CSV, JSON, API)
- **No hostage** data
- **Migration-friendly**
- **Open data formats**

### 14.2 No lock-in

- **Data portable**
- **Themes exportable** (readable format)
- **Custom code exportable**
- **Can migrate** to self-host fork (enterprise)

### 14.3 Transparent development

**Inspired by open source:**

- **Public roadmap** (GitHub projects)
- **RFC process** for major features
- **Public changelogs**
- **Developer blog** with technical deep-dives
- **Security disclosures** public

### 14.4 Open standards

- **MCP protocol** (commerce-agent communication)
- **OpenAPI specs**
- **GraphQL schema** public
- **Webhook standards**
- **Open data formats**

### 14.5 Community contributions

**Merchants and developers can contribute:**

- **Translation platform** (Crowdin-style)
- **Theme marketplace** (community themes)
- **Plugin marketplace** (community plugins)
- **Documentation** (community edits)
- **Feature requests** (voted)

### 14.6 Open source SDKs

**Release open source:**

- **JavaScript SDK** (npm, MIT)
- **Python SDK**
- **PHP SDK**
- **Go SDK**
- **Rust SDK**
- **Storefront starters** (Next.js, Nuxt, Astro, Remix)
- **Admin UI components** (React, Vue)

### 14.7 Developer-first documentation

**Inspired by Stripe docs:**

- **Beautifully written**
- **Code examples** in every language
- **Interactive tutorials**
- **Video explanations**
- **API reference** browsable

### 14.8 Hybrid hosting option (enterprise)

**For enterprise customers:**

- **Self-host option** available
- **Dedicated cloud** option
- **On-premise** option
- **Air-gapped** deployments

**Similar to Shopware, but better:**

- **Same codebase** as SaaS
- **Same features**
- **Same updates**
- **Choice of operation model**

---

## 15. Hybrid model – SaaS + Open Source

**Nejlepší přístup: SaaS primary + open source option for enterprise.**

### 15.1 Model struktura

**Tier 1: SaaS Cloud (our main product)**

- Fully managed
- Latest features
- Highest velocity
- **For 95 % merchants**

**Tier 2: Dedicated Cloud (enterprise)**

- Our infrastructure
- But dedicated instances
- Custom SLAs
- **For large enterprise**

**Tier 3: Self-hosted Enterprise (specific needs)**

- Same codebase
- You host
- Commercial license
- **For specific industries** (defense, healthcare, gov)

### 15.2 Open source components

**What's open source:**

- **Storefront starters** (MIT)
- **SDKs** (MIT)
- **Admin UI components** (MIT)
- **CLI tools** (MIT)
- **Headless commerce SDK** (MIT)
- **Plugins templates** (MIT)
- **Themes** (can be open source)

**What's proprietary:**

- **Core platform** (our IP)
- **Cloud infrastructure**
- **Commercial features** (AI, agentic, enterprise)
- **Managed services**

### 15.3 Why hybrid works

**For merchants:**

- **Choice** of operation model
- **No lock-in** concerns
- **Data ownership** guaranteed
- **Migration path** always

**For us:**

- **SaaS revenue** primary
- **Enterprise contracts** secondary
- **Ecosystem growth** from open source
- **Developer mindshare**

### 15.4 Open core model

**Like GitLab, Mattermost, MongoDB:**

- **Community Edition** = open source (free)
- **Commercial Edition** = paid features
- **Same underlying** code

**Not like:**

- **Shopify** (closed)
- **WooCommerce** (all open, but fragmented)

**Most like:**

- **Shopware** (open + commercial)
- **Sylius Plus** (open core)
- **GitLab** (perfect model)

### 15.5 License strategy

**Community code:** **MIT License**

- Permissive
- Commercial use OK
- No copyleft
- **Attractive to developers**

**Commercial features:** **Proprietary license**

- Pay to use
- Commercial support
- **Our revenue**

**Avoid:**

- **GPL / AGPL** (copyleft issues)
- **SSPL** (MongoDB style – controversial)
- **BUSL** (business source – confusing)

---

## 16. Konkrétní features, které přidáme

**Konkrétní seznam featur inspirovaných open source, které doplníme do naší platformy** (nad rámec předchozího strategického dokumentu):

### 16.1 Developer Experience (DX)

1. **Hooks & filters system** (from WooCommerce)
2. **Event observers** (from Magento)
3. **Dependency injection** (from Sylius)
4. **CLI tools** (from WP-CLI)
5. **Theme override system** (from all)
6. **Module scaffolding** (from all)
7. **Hot reload** (from Medusa)
8. **TypeScript types** auto-generated (from Medusa)
9. **Open API specs** (from Saleor)
10. **GraphQL federation** (from Saleor)
11. **Workflow engine** (from Medusa v2)
12. **Test frameworks** BDD/unit (from Sylius)
13. **Local Docker env** (from Shopware)
14. **Preview deployments** (from Vercel inspiration)
15. **Migration tools** (from Shopware)

### 16.2 Admin features

16. **Attribute sets per category** (from Magento)
17. **Customer segments dynamic** (from Magento)
18. **Price rules engine** advanced (from Magento)
19. **Multi-source inventory** (from Magento MSI)
20. **Multi-store hierarchy** 3-level (from Magento)
21. **Channel-based architecture** (from Saleor)
22. **Shopping Experiences** (from Shopware – rozebráno)
23. **Rule Builder visual** (from Shopware – rozebráno)
24. **Flow Builder** (from Shopware – rozebráno)
25. **Product combinations engine** (from PrestaShop)
26. **Configurable products** advanced (from Magento)
27. **Flexible pricing** (from Magento)
28. **Store credit / wallet** (from Magento)
29. **Gift cards engine** (from Magento)
30. **Loyalty points** advanced (from PrestaShop)
31. **Customer segments** with AI (unique)
32. **Bulk editing** with conditions (from Magento)
33. **Import/export** CSV/XML (from all)
34. **Cron job UI** (from WooCommerce/Magento)
35. **Indexing system** transparent (from Magento)
36. **Cache management** UI (from Magento)
37. **Translation editor** in-admin (from PrestaShop)
38. **Theme editor** block-based (from WooCommerce)
39. **Email template editor** drag-drop (from all)
40. **PDF template editor** (unique)

### 16.3 B2B features

41. **Corporate accounts** (from Magento Commerce)
42. **Multiple buyers per company** (from Magento)
43. **Credit limits** (from Magento)
44. **Payment terms** (Net 30/60/90)
45. **Quote-to-order** workflow (from Shopware)
46. **Requisition lists** (from Magento)
47. **Quick order forms** (from Magento)
48. **Punch-out catalogs** (from Magento)
49. **Approval workflows** (from Shopware)
50. **Budget management** (from Shopware)
51. **Role-based permissions** (from Shopware)
52. **B2B company registration** (from Magento)
53. **B2B specific pricing** (from all)

### 16.4 Product features

54. **Product comparison** (from Magento)
55. **Product questions Q&A** (from Magento)
56. **Related products smart** (from all)
57. **Cross-sells** (from all)
58. **Upsells** (from all)
59. **Product bundles** (from Magento)
60. **Grouped products** (from Magento)
61. **Virtual products** (from Magento)
62. **Downloadable products** (from Magento)
63. **Subscription products** (from WooCommerce Subscriptions)
64. **Gift products** (from all)
65. **Reserved stock** (from Magento)
66. **Backorders** (from all)
67. **Preorders** (from all)
68. **Stock alerts customer** (from PrestaShop)
69. **Product labels** (from PrestaShop)
70. **Product attributes** unlimited (from Magento EAV inspired)

### 16.5 Marketing features

71. **Discount rules** advanced (from Magento)
72. **Catalog price rules** (from Magento)
73. **Cart price rules** (from Magento)
74. **Coupon codes** (from all)
75. **Free shipping** rules (from all)
76. **BOGO** (buy one get one) (from all)
77. **Quantity discounts** (from all)
78. **Customer group discounts** (from Magento)
79. **Affiliate system** (from PrestaShop)
80. **Newsletter** (from all)
81. **Follow-up emails** (from WooCommerce)
82. **Abandoned cart recovery** escalating (from WooCommerce)
83. **Email templates** library (from all)

### 16.6 SEO & content

84. **Blog integrated** (from WooCommerce/WordPress)
85. **Rich content editor** blocks (from WooCommerce)
86. **URL rewrites** (from Magento)
87. **Canonical management** (from Magento)
88. **XML sitemaps** (from all)
89. **Schema.org markup** (from all)
90. **Open Graph** (from all)
91. **Robots.txt editor** (from all)
92. **301 redirects** manager (from all)
93. **SEO tags per product** (from all)
94. **Hreflang** auto (from PrestaShop)
95. **Meta templates** per category (from Magento)

### 16.7 Checkout & orders

96. **One-page checkout** (from Magento 2)
97. **Multi-step checkout** (from all)
98. **Guest checkout** (from all)
99. **Block-based checkout** (from WooCommerce)
100.  **Address book** (from all)
101.  **Order status custom** (from all)
102.  **Partial shipments** (from Sylius Plus)
103.  **Split payments** (from all)
104.  **Store pickup** (from Magento)
105.  **Delivery date picker** (from PrestaShop)
106.  **Gift wrapping** (from Magento)
107.  **Gift messages** (from all)

### 16.8 Operational

108. **Multi-warehouse** (from Magento MSI)
109. **Stock reservations** (from Magento)
110. **Stock transfers** (from Magento)
111. **Inventory reports** (from all)
112. **Low stock alerts** (from all)
113. **Order processing workflows** (from Magento)
114. **Return management** (from PrestaShop, Magento)
115. **Refund workflows** (from all)
116. **Store credit for returns** (from Magento)

### 16.9 Analytics

117. **Sales reports** (from all)
118. **Product reports** (from all)
119. **Customer reports** (from all)
120. **Search reports** (from Magento)
121. **Abandoned carts report** (from WooCommerce)
122. **Coupon usage** (from Magento)
123. **Review reports** (from all)
124. **Tax reports** (from Magento)

### 16.10 Multi-store / multi-region

125. **Multi-store** basic (from PrestaShop)
126. **Multi-website** hierarchy (from Magento)
127. **Store views** for languages (from Magento)
128. **Channels** for regions (from Saleor)
129. **Per-store pricing** (from Magento)
130. **Per-store inventory** (from Magento)
131. **Per-store theming** (from all)
132. **Per-store payment methods** (from all)
133. **Per-store shipping** (from all)
134. **Centralized customer** optional (from PrestaShop)
135. **Global catalog** with overrides (from Magento)

**Celkem 135 konkrétních features inspirovaných open source světem.**

---

## 17. Ekosystem strategy

**Jak vybudovat ekosystem inspirovaný open source (ale lepší).**

### 17.1 Plugin/app marketplace

**Model:**

- **Free plugins** (community)
- **Paid plugins** (developers revenue share)
- **Certified plugins** (our approval)
- **Featured plugins** (promoted)

**Quality process:**

- **Automated security scan**
- **Performance benchmarks**
- **Code review** (random sample)
- **User ratings** weighted
- **Deprecation** of unmaintained

**Discoverability:**

- **Categories** clear
- **Search** powerful
- **Recommendations** AI-driven
- **Use case matching**

### 17.2 Theme marketplace

**Similar to plugin but:**

- **Design focus**
- **Performance audits** strict
- **Accessibility audits**
- **Mobile-first testing**

### 17.3 Agency directory

**Like Shopify Experts:**

- **Partner tiers** (bronze, silver, gold, platinum)
- **Verified expertise**
- **Case studies**
- **Client reviews**
- **Specializations** tagged

**Merchant picks agency easily.**

### 17.4 Community translation

**Crowdin-style:**

- **Any community member** can translate
- **Vetted contributions**
- **Multiple translators** per language
- **Quality ratings**
- **70+ languages** goal

### 17.5 GitHub presence

**Open source repositories:**

- **Storefront starters** (Next.js, Nuxt, Astro, Remix, Svelte)
- **Admin UI components**
- **SDK for 10+ languages**
- **CLI tool**
- **Plugin templates**

**Contributions:**

- **Public roadmap**
- **RFC process**
- **Good first issues** labeled
- **Contribution guide**

### 17.6 Developer certifications

**Like Shopify Partners:**

- **Certified Developer**
- **Certified Solutions Architect**
- **Certified Designer**
- **Certified Admin**

**Exams, training, benefits.**

### 17.7 Annual conference

**Like WordCamp / Shopware Community Day:**

- **Our conference**
- **Keynotes** about roadmap
- **Developer workshops**
- **Merchant success stories**
- **Networking**
- **Product announcements**

**First event:** 12 months after launch.

### 17.8 Regional meetups

**Local community building:**

- **Prague, Warsaw, Budapest, Berlin, Amsterdam** meetups
- **Monthly or quarterly**
- **Open** to all
- **Partner agencies** host
- **Sponsored** by us

### 17.9 Documentation hub

**Best-in-class docs:**

- **API reference** (auto-generated)
- **Guides** (narrative)
- **Tutorials** (step-by-step)
- **Video tutorials**
- **Interactive examples**
- **Code samples** multiple languages
- **Search** fast
- **Versioned** per release

### 17.10 Support channels

**Paid:**

- **Email ticket** (all tiers)
- **Phone** (Growth+)
- **Dedicated manager** (Scale+)
- **24/7** (Enterprise)

**Community:**

- **Forum** (like Stack Overflow for us)
- **Discord** / Slack
- **GitHub discussions**
- **Regional** community groups

---

## 18. Developer community strategy

**Jak přitáhnout developery od open source platforem.**

### 18.1 Why developers matter

**Statistics:**

- WooCommerce **thousands of agencies** globally
- Magento **certified developers** prestige
- Shopware **DACH mindshare**

**Our challenge:** **Build developer mindshare** from scratch.

### 18.2 Developer attraction tactics

**1. Best-in-class DX**

- Modern stack (TypeScript)
- Beautiful docs (Stripe-level)
- Fast setup (5 minutes)
- Great error messages
- **Developers = happy**

**2. Open source contributions**

- **Storefront starters** (widely used)
- **Admin UI components**
- **SDKs**
- **Open on GitHub**

**3. Developer blog**

- Technical deep-dives
- Architecture posts
- Case studies
- Best practices

**4. Conference talks**

- Speak at: JSConf, React Conf, Symfony Con, PHP conferences, e-commerce conferences
- **Build mindshare**

**5. Sponsorships**

- Open source projects (Next.js, Symfony, specific libs)
- Podcasts
- Newsletters

**6. Hackathons**

- Annual our hackathon
- Sponsor community hackathons
- **Developer engagement**

**7. Bounty program**

- **Security bounties**
- **Feature bounties**
- **Bug bounties**
- **Incentivize contributions**

**8. Developer tokens**

- **Free hosting** for non-commercial projects
- **Dev certifications free**
- **Reward community** helpers

### 18.3 Migration paths

**Make it easy to migrate TO us:**

**From WooCommerce:**

- **One-click migration** tool
- **All data** preserved (products, orders, customers, reviews)
- **SEO preserved** (301 redirects)
- **Theme conversion** (WooCommerce blocks → our blocks)
- **Plugin equivalents** suggested

**From Magento:**

- **Similar migration tool**
- **Extension mapping** (Magento extension → our plugin)
- **Multi-store preserved**
- **B2B data preserved**

**From Shopify:**

- **Migration tool** (products, orders, customers)
- **Theme conversion** (Liquid → our templates)
- **App equivalents**
- **Data ownership** reminder (Shopify's key pain)

**From Shopware:**

- **Same devs** (Symfony)
- **Similar concepts**
- **Migration tool**

**From PrestaShop:**

- **Data migration**
- **Module equivalents**
- **Multi-language preserved**

### 18.4 Incentives for developers

**For agencies:**

- **Revenue share** on marketplace
- **Partner tier benefits**
- **Marketing co-op**
- **Lead generation**
- **Early access** to features

**For individual devs:**

- **Free dev accounts** (unlimited)
- **Sandbox environments**
- **Beta access**
- **Swag and perks**
- **Recognition** (hall of fame)

### 18.5 Open source marketing

**Differentiation:**

- _"More open than SaaS, more managed than open source."_
- _"The platform that respects developers AND merchants."_
- _"Open source soul, SaaS convenience."_

---

## 19. Risk analysis a mitigation

### 19.1 Risk: Open source communities are suspicious of SaaS

**Concern:** Developers vidí SaaS jako "commercial exploitation of open source values."

**Mitigation:**

- **Open source SDKs** (truly open, MIT)
- **Transparent development** (roadmap, RFCs)
- **Community contributions** welcomed
- **Developer-friendly licensing**
- **Be authentic** (nejsme predators)

### 19.2 Risk: Ecosystem chicken-and-egg

**Concern:** Bez pluginů merchants nepřijdou. Bez merchants developers nepřijdou.

**Mitigation:**

- **Build 100 core plugins** ourselves (top used across open source)
- **Migration paths** from WooCommerce/Shopify (instant equivalents)
- **Incentivize early developers** heavily
- **Free tier** brings merchants fast

### 19.3 Risk: Feature parity takes years

**Concern:** WooCommerce má 15 let vývoje. Nikdy nedosáhneme parity.

**Mitigation:**

- **Parity not the goal** – **better in core areas**
- **80/20 principle** (covered most-used features)
- **Fast development** (modern stack)
- **Community extensions** fill gaps

### 19.4 Risk: Merchants prefer self-host for data ownership

**Concern:** Enterprise merchants stále preferují self-host.

**Mitigation:**

- **Offer self-host** for enterprise
- **Data export** always available
- **No lock-in** messaging
- **Portability guarantees**

### 19.5 Risk: Competition reacts (Shopify opens up)

**Concern:** Shopify sees merchants migrating to us, opens up platform.

**Mitigation:**

- **First-mover** advantage
- **Deep EU localization** (Shopify struggles)
- **Agentic commerce** lead
- **Community moat**

### 19.6 Risk: Open source platforms fight back

**Concern:** WooCommerce / Shopware improve drastically.

**Mitigation:**

- **We watch them closely**
- **Feature velocity** faster (modern stack)
- **SaaS convenience** they can't match
- **EU focus** advantage

---

## 20. Závěr a next steps

### 20.1 Shrnutí

**Open source platformy přinášejí 15-20 let zkušeností** a tisíce nápadů, které **můžeme adoptovat**.

**Top 10 věcí, které si bereme:**

1. **Hook & filter system** (WooCommerce) – extensibility
2. **EAV-inspired flexible attributes** (Magento) – customizace
3. **Multi-Source Inventory** (Magento) – multi-warehouse
4. **Multi-store hierarchy** (Magento) – multi-brand
5. **Shopping Experiences** (Shopware) – content commerce
6. **Rule Builder + Flow Builder** (Shopware) – automatizace
7. **TypeScript stack** (Medusa) – modern DX
8. **GraphQL-first** (Saleor) – modern API
9. **Multi-language** (PrestaShop) – EU fokus
10. **Clean code culture** (Sylius) – quality

### 20.2 Hybrid model vítězí

**SaaS primary + open source components + self-host option for enterprise:**

- **SMB:** SaaS, managed, convenient
- **Mid-market:** SaaS, more features
- **Enterprise:** Choice of SaaS / Dedicated / Self-host

**Inspired by:** GitLab, MongoDB, Shopware.

### 20.3 135 konkrétních features

**K naší platformě přidáme 135 konkrétních features** inspirovaných open source. Rozprostřené do:

- **15** DX features
- **25** Admin features
- **13** B2B features
- **17** Product features
- **13** Marketing features
- **12** SEO & content features
- **12** Checkout & orders features
- **9** Operational features
- **8** Analytics features
- **11** Multi-store features

### 20.4 Ekosystem strategy

**Kurovaný marketplace** inspirovaný nejlepším z WooCommerce/Magento/Shopware:

- Kvalita nad kvantitou
- Revenue share pro developers
- Migration paths z existujících platform
- Best-in-class DX

### 20.5 Developer community

**Open source mindset i v komerční platformě:**

- Open source SDKs, starters, CLI (MIT)
- Transparent development
- Community contributions
- Developer-first culture

### 20.6 Next steps

**Po tomto dokumentu:**

1. **Prioritization:** Které z 135 features jsou **must-have** pro MVP?
2. **Technical architecture** document (jak to technicky vybudovat)
3. **Plugin ecosystem design** (marketplace, revenue share, quality)
4. **Migration tools** plan (priority source platforms)
5. **Developer acquisition** strategy (jak získat devs od open source)

### 20.7 Klíčová otázka

**Jak moc otevřená má být naše platforma?**

**Volby:**

- **A) Closed SaaS** (Shopify model) – lehčí development, meníší ekosystem
- **B) Hybrid** (Shopware model) – komplexnější, lepší enterprise
- **C) Open core** (GitLab model) – maximální community, harder monetization

**Doporučení:** **B+C mix** – open source SDKs/starters (C), closed core platform (A), self-host option enterprise (B).

---

### Srovnávací tabulka: Co si bereme z každé platformy

| Platforma       | Co nejvíce                                                       | Proč                                   |
| --------------- | ---------------------------------------------------------------- | -------------------------------------- |
| **WooCommerce** | Hooks/filters, HPOS, block checkout, WordPress symbióza          | Největší komunita, extensibility       |
| **PrestaShop**  | Multi-store, překlady, SMB UX, EU compliance                     | Evropa + SMB fokus                     |
| **Magento**     | B2B, MSI, multi-website, pricing rules, EAV attributes           | Enterprise gold standard               |
| **Sylius**      | Code quality, Symfony patterns, tests, open core model           | Modern PHP                             |
| **Medusa**      | TypeScript, workflows, Next.js starter, v2 architecture          | Modern JS stack                        |
| **OpenCart**    | Simplicity, fast onboarding                                      | SMB UX                                 |
| **Spree**       | Convention over configuration, engines                           | Rails elegance                         |
| **Saleor**      | GraphQL-only, channels, apps-as-microservices                    | Modern API-first                       |
| **Shopware CE** | Shopping Experiences, Rule Builder, Flow Builder, B2B Components | Best-in-class B2B UX (rozebráno jinde) |

---

_Dokument vytvořen na základě analýzy 9 hlavních open source e-commerce platforem (WooCommerce, PrestaShop, Magento/Adobe Commerce, Sylius, Medusa, OpenCart, Spree, Saleor, Shopware CE) a jejich ekosystémů. Cílem je identifikovat nejlepší praktiky, features a filozofie, které můžeme přenést do našeho SaaS systému. Duben 2026._
