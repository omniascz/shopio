# 02 – GLOSSARY

> **Účel:** Kanonický slovník pojmů. Každý pojem má **JEDNU** definici v platformě. Pokud někde v dokumentaci najdeš pojem nejasně použitý, **tento glossary vítězí**.

**Konvence:**
- Pojmy řazeny abecedně v každé sekci
- Pro každý pojem: definice + příklad + související pojmy
- Anglické termíny preferované (industry standard), s českými ekvivalenty

---

## 📑 Obsah

1. [Obecné e-commerce pojmy](#1-obecné-e-commerce-pojmy)
2. [Catalog & PIM](#2-catalog--pim)
3. [Inventory & Warehousing](#3-inventory--warehousing)
4. [Pricing & Promotions](#4-pricing--promotions)
5. [Cart & Checkout](#5-cart--checkout)
6. [Payments](#6-payments)
7. [Shipping & Fulfillment](#7-shipping--fulfillment)
8. [Tax & Compliance](#8-tax--compliance)
9. [Customer & B2B](#9-customer--b2b)
10. [Orders & Fulfillment](#10-orders--fulfillment)
11. [Marketing & SEO](#11-marketing--seo)
12. [Analytics](#12-analytics)
13. [Architecture & Tech](#13-architecture--tech)
14. [Personas & Roles](#14-personas--roles)

---

## 1. Obecné e-commerce pojmy

### **AOV** (Average Order Value)
Průměrná hodnota objednávky.
**Vzorec:** Total revenue / Number of orders
**Příklad:** 100,000 Kč / 50 orders = 2,000 Kč AOV
**Související:** GMV, CLV

### **AOQ** (Average Order Quantity)
Průměrný počet položek na objednávku.

### **B2B** (Business to Business)
Prodej firma firmě. Specifický features: contract pricing, approval workflows, Net terms.
**Související:** B2C, Persona-B2B-EMPLOYEE

### **B2C** (Business to Consumer)
Prodej firma koncovému zákazníkovi.

### **BOPIS** (Buy Online, Pickup In Store)
Online objednávka, vyzvednutí na prodejně. Aka "click & collect".

### **BORIS** (Buy Online, Return In Store)
Online objednávka, vrácení na prodejně.

### **Cart abandonment**
Opuštění košíku před dokončením objednávky.
**Typická míra:** 70% global average
**Cílí na:** Recovery emails, exit popups
**Související:** Conversion rate, FLOW-CART-RECOVERY

### **CLV** / **CLTV** (Customer Lifetime Value)
Predikce celkového revenue, který zákazník přinese za celou dobu vztahu.
**Vzorec (zjednodušený):** AOV × Purchase frequency × Customer lifespan

### **Conversion rate**
Procento návštěvníků, kteří udělají požadovanou akci (typicky nákup).
**Vzorec:** Conversions / Total visitors × 100%
**Typická hodnota e-commerce:** 1-3%

### **D2C** (Direct to Consumer)
Brand prodává přímo zákazníkovi (bez retailera).

### **GMV** (Gross Merchandise Value)
Celková hodnota prodaného zboží před vrácením, slevami, fees.
**Příklad platformy:** Sum of all completed orders across all merchants.

### **Headless commerce**
Architektura, kde frontend (storefront) je oddělený od backendu (commerce engine), komunikují přes API.
**Naše implementace:** Storefront API + API-first architecture.

### **Marketplace**
Platforma, kde více vendorů prodává přes jeden storefront. Platforma typicky bere fee z každé transakce.
**Příklady:** Amazon, eBay, Etsy.
**Naše:** Volitelná feature (Pro+ tier).

### **Omnichannel**
Sjednocený nákupní zážitek napříč kanály (online, mobile, in-store, social).
**Související:** BOPIS, multi-channel.

### **PDP** (Product Detail Page)
Stránka detailu produktu. Klíčová pro konverzi.

### **PLP** (Product Listing Page)
Stránka seznamu produktů (kategorie, search results).

### **Refund**
Vrácení peněz zákazníkovi po vrácení zboží nebo nesplnění služby.
**Související:** Return, RMA, credit memo.

### **RMA** (Return Merchandise Authorization)
Autorizace vrácení zboží. Číslo, které zákazník dostane pro identifikaci.

### **SaaS** (Software as a Service)
Náš produktový model. Merchant si neinstaluje software, používá hostovanou platformu.

### **SKU** (Stock Keeping Unit)
Unikátní identifikátor konkrétní varianty produktu.
**Příklad:** "Tričko Bavlna Černá XL" = SKU `TS-COTTON-BLK-XL`
**Související:** Variant, Product.

### **SOR** (System of Record)
Autoritativní zdroj pravdy pro daný typ dat.
**Příklad:** Order SOR je naše OMS, ne ERP customer.

### **Storefront**
Veřejná část e-shopu, kterou vidí zákazníci.

### **Vendor lock-in**
Stav, kdy je obtížné migrovat pryč. **Naše platforma EXPLICITNĚ proti.**

---

## 2. Catalog & PIM

### **Attribute**
Vlastnost produktu. Má typ (text, number, select...), může být searchable, filterable, comparable.
**Příklad:** "Color: Red", "Material: Cotton", "Weight: 0.5 kg"
**Příklad TV:** "Display Size: 55 inch", "Resolution: 4K"

### **Attribute group**
Logická skupina atributů.
**Příklad TV:** "Display" group má atributy: size, type, resolution, refresh rate.

### **Attribute set**
Set atributů aplikovaný na kategorii produktů.
**Příklad:** "Electronics > TV" má attribute set s 30 atributy.

### **Bundle**
Produkt složený z více produktů, prodávaný jako celek.
**Typy:**
- Fixed bundle: pevné složení
- Customizable bundle: zákazník vybírá komponenty
- Dynamic bundle: na základě pravidel

### **Category** (Kategorie)
Hierarchická organizace produktů.
**Příklad:** Electronics > TVs > 4K TVs

### **Collection**
Volnější seskupení produktů (může být manuální nebo na základě pravidel).
**Příklad:** "Summer Sale 2026", "New Arrivals"
**Rozdíl od kategorie:** Kategorie = strom, Collection = flat list, often dynamic.

### **Configurable product**
Produkt s konfigurátorem (zákazník skládá vlastní variantu).
**Příklad:** Konfigurace nábytku (rozměr, barva, materiál).

### **Custom field** / **Metafield**
Custom data attached to entity.
**Příklad:** Product custom field "Care instructions", Order custom field "Gift message".

### **Digital product**
Produkt, který se nedoručuje fyzicky (ebook, software, předplatné).

### **Master product**
Konceptuální entita, která má varianty.
**Příklad:** "Tričko Bavlna" je master, varianty jsou kombinace barvy a velikosti.
**Související:** Variant, SKU.

### **Manufacturer**
Výrobce produktu. Často ≠ brand (Nike outsourcuje výrobu, ale brand je Nike).

### **Media**
Obrázky, videa, 3D modely, PDFs spojené s produktem.

### **PIM** (Product Information Management)
Systém pro správu produktových informací. Center master data o produktech.
**Naše:** Vestavěný PIM, ne separátní app.

### **Product**
Položka v katalogu. Může být fyzická, digitální, služba, předplatné, gift card.

### **Product feed**
Export katalogu pro 3rd party (Google Shopping, Facebook, comparison sites).
**Formáty:** XML, CSV, JSON, JSON-LD.

### **Product type**
```
Physical:    Hmotný produkt (vyžaduje shipping)
Digital:     Stažitelný (license key, download)
Subscription: Recurring billing
Bundle:      Composition of products
Gift card:   Voucher
Service:     Booking, consultation
Configurable: Customer builds variant
```

### **Slug**
URL-friendly identifier produktu.
**Příklad:** product `Červené tričko` → slug `cervene-tricko`
**SEO:** Should not change after publication (use redirects).

### **Spec template** (Specification template)
Šablona atributů per kategorie. Při vytváření produktu v kategorii X automaticky předvyplní attribute set X.

### **Variant**
Konkrétní varianta master produktu, identifikovaná kombinací attribute values.
**Příklad:** Master "Tričko" → Variant "Tričko / Černá / XL"
**Reflektuje se v SKU.**

---

## 3. Inventory & Warehousing

### **Allocated stock**
Stock rezervovaný pro konkrétní objednávku (in pending order).

### **Available stock**
Stock dostupný k prodeji = On hand - Allocated - Reserved.

### **Backorder**
Objednávka zboží, které není skladem, ale očekává se. Zákazník ví, že čeká.

### **Drop-shipping**
Merchant nemá zboží na skladě – objednávka jde k dodavateli, který doručí přímo zákazníkovi.

### **Lot** / **Batch**
Skupina produktů ze stejné výrobní šarže. Důležité pro food, pharma (expiry tracking).

### **Multi-warehouse**
Stock je rozprostřen ve více skladech. Order routing rozhoduje, který sklad fulfilluje.

### **On hand**
Fyzický počet kusů ve skladě.

### **Pre-order**
Objednávka produktu, který ještě není v prodeji (release date v budoucnu).

### **Reorder point**
Hladina stocku, při které se automaticky vystaví replenishment order.

### **Reserved stock**
Stock rezervovaný (např. pro display product, marketing samples).

### **Safety stock**
Buffer stock pro neočekávané events (delays, demand spike).

### **Stock count** / **Cycle count**
Inventura. Audit on-hand vs system records.

### **Stock movement**
Záznam změny stocku (inbound, outbound, transfer, adjustment).

### **Stock transfer**
Pohyb stocku mezi sklady.

### **3PL** (Third-Party Logistics)
Externí firma, která spravuje sklad a logistiku.
**Příklady:** ShipBob, ShipMonk, lokálně Toptrans, DPD warehousing.

---

## 4. Pricing & Promotions

### **Catalog pricing rule**
Pravidlo, které mění cenu produktu před vložením do košíku.
**Příklad:** "10% off all products in category Electronics for VIP customers".

### **Cart pricing rule**
Pravidlo, které mění cenu na úrovni košíku.
**Příklad:** "Buy 2 get 1 free", "Free shipping over 1500 Kč".

### **Compare-at price**
Původní cena, zobrazená přeškrtnutá. Označení slevy.
**Aka:** MSRP, list price.

### **Coupon** / **Promo code** / **Voucher**
Kód, který odemyká slevu při zadání.

### **Discount**
Snížení ceny. Může být:
- Percentage (10% off)
- Fixed amount (100 Kč off)
- Free shipping
- BOGO (buy one get one)
- Tiered (buy 2 = 5% off, buy 5 = 10% off)

### **Dynamic pricing**
Cena se mění na základě pravidel (čas, demand, customer segment, inventory).

### **Gift card**
Pre-paid voucher, který lze použít jako platbu.

### **Loyalty points**
Body, které zákazník získává nákupy a může je směnit za slevy/produkty.

### **MAP** (Minimum Advertised Price)
Minimální cena, za kterou smí merchant produkt inzerovat (často diktuje brand).

### **Price list**
Seznam cen aplikovaný na customer group nebo specifický kontext.
**Příklad:** "B2B price list", "Wholesale price list", "VIP price list".

### **Sale price**
Snížená cena, často time-limited.

### **Tier pricing** / **Quantity break**
Sleva při nákupu většího množství.
**Příklad:** 1-9 ks: 100 Kč/ks, 10-49 ks: 90 Kč/ks, 50+ ks: 80 Kč/ks.

### **Volume discount**
Sleva za celkový objem nákupu (často B2B kontextu).

---

## 5. Cart & Checkout

### **Abandoned cart**
Košík, kde zákazník přidal položky, ale nedokončil objednávku.
**Recovery:** Email, push, retargeting.

### **Cart**
Dočasný kontejner produktů před checkout. Persistent across sessions (logged in).

### **Cart line item**
Jeden produkt v košíku (1 row).
**Obsahuje:** Product/variant ID, quantity, price snapshot, custom data.

### **Cart token**
Anonymní identifikátor košíku pro guest users.

### **Checkout**
Proces dokončení objednávky. Steps: address → shipping → payment → review → place order.

### **Express checkout**
Rychlý checkout přes wallet (Apple Pay, Google Pay, PayPal Express, Shop Pay). Skip address/payment forms.

### **Guest checkout**
Checkout bez registrace.

### **Mini cart**
Drawer/popup zobrazující košík bez navigace na cart page.

### **Sticky cart**
Cart bar, který se zobrazuje napříč stránkami (typicky mobile).

---

## 6. Payments

### **3D Secure 2** (3DS2)
Authentication protocol pro card payments (mandatory pro EU SCA).

### **Authorization**
První krok payment – ověření, že karta má prostředky a je validní. Reservuje peníze.

### **BNPL** (Buy Now Pay Later)
Splátkový produkt (Klarna, Afterpay, Twisto).

### **Capture**
Druhý krok payment – skutečně vyhradí peníze (po authorization).

### **Chargeback**
Spor iniciovaný zákazníkem u karty banky. Merchant musí evidence.

### **COD** (Cash On Delivery)
Platba při doručení (Czech-popular).

### **Currency conversion**
Přepočet z jedné měny na jinou. Display vs settlement currency.

### **Decline**
Odmítnutí platby (insufficient funds, fraud, etc.).

### **DPO** (Days Payable Outstanding)
B2B termín – kolik dní má kupující na zaplacení.

### **Idempotency key**
Unikátní key, který zajistí, že duplicate request nepovede k double-charge.

### **Mandate**
Souhlas zákazníka s opakovanou platbou (subscription).

### **MOR** (Merchant of Record)
Entita zodpovědná za prodej (tax, refunds, chargebacks).
**Naše platforma:** MOR je merchant, ne my (kromě Enterprise s special arrangement).

### **PSP** (Payment Service Provider)
Platební brána (Stripe, Adyen, GoPay).

### **PSD2**
EU regulace pro platby. Vyžaduje SCA.

### **Refund**
Vrácení peněz. Může být:
- Full refund: celá částka
- Partial refund: část
- Store credit refund: do walletu místo na kartu

### **SCA** (Strong Customer Authentication)
EU mandatory authentication pro online platby > €30. Splnění = 3DS2.

### **Tokenization**
Nahrazení citlivých dat (PAN) tokenem. Snižuje PCI scope.

### **Vault**
Storage for tokenized payment methods (saved cards).

### **Void**
Zrušení authorization před capture.

---

## 7. Shipping & Fulfillment

### **Carrier**
Doručovací firma (DHL, UPS, DPD, Czech Post, Zásilkovna).

### **Click & Collect**
Online objednávka, vyzvednutí v store. Aka BOPIS.

### **Cold chain**
Doručování s teplotním režimem (frozen, refrigerated). Pharmacy, food.

### **DDP** (Delivered Duty Paid)
Cross-border shipping kde merchant pre-paid duties.

### **DDU** (Delivered Duty Unpaid)
Cross-border shipping kde customer paid duties on delivery.

### **Fulfillment**
Proces přípravy a doručení objednávky. Steps: pick → pack → ship → deliver.

### **Last-mile delivery**
Final segment doručení (warehouse → customer door).

### **Pickup point** / **Parcel locker**
Místo, kde si zákazník vyzvedne zásilku (Zásilkovna, DHL ServicePoint, Packeta).

### **Pick list**
Seznam položek pro warehouse worker k vyskladnění z objednávky.

### **Pre-paid label**
Předplacená přepravní etiketa (často pro returns).

### **Real-time rates**
Shipping ceny získané live z carrier API (vs flat rates).

### **Same-day delivery**
Doručení v den objednávky.

### **Shipping rule**
Pravidlo určující shipping cost / availability.
**Příklad:** "Free shipping over 1500 Kč", "No shipping to Sicily".

### **Shipping zone**
Geografická oblast s vlastními shipping rules.
**Příklad:** Zone "EU", Zone "Czech Republic", Zone "Worldwide".

### **Tracking**
Sledování zásilky. Number → carrier portal nebo platform tracking page.

### **White-glove delivery**
Premium doručení s instalací/montáží (často furniture, appliances).

---

## 8. Tax & Compliance

### **DPH** / **VAT** (Value Added Tax)
Daň z přidané hodnoty. EU mandatory.

### **EORI**
Economic Operators Registration and Identification number. EU customs.

### **Excise tax**
Spotřební daň (alkohol, tabák, paliva).

### **GST** (Goods and Services Tax)
Daňová obdoba VAT v některých zemích (UK, AU, IN, CA).

### **HS code** (Harmonized System code)
International product classification pro celní účely.

### **Intrastat**
EU statistical reporting pro intra-EU trade.

### **Nexus** (Sales tax nexus, US)
Connection mezi business a state, vyžadující sales tax collection.

### **OSS** (One Stop Shop)
EU scheme pro VAT reporting cross-border B2C.

### **Reverse charge**
B2B EU mechanism kde buyer self-accounts VAT.

### **Sales tax**
US tax (per state, per ZIP). Bez VAT-style chain.

### **Tax exemption**
Zákazník osvobozen od daně (B2B with VAT ID, non-profits, government).

### **VIES**
EU VAT ID validation system.

---

## 9. Customer & B2B

### **Approval workflow**
Mandatory approval flow před objednávkou (B2B).
**Typický:** Employee creates order → Manager approves → Order placed.

### **Buyer**
B2B termín pro osobu, která nakupuje za firmu.

### **Company account**
B2B parent entita, pod kterou jsou employees a orders.

### **Contract pricing**
Negotiated ceny pro konkrétního customera.

### **Credit limit**
Maximální částka, kterou customer může objednat na credit (Net terms).

### **Credit memo**
Dokument udělující credit (po refundu, adjustment).

### **Customer group**
Segment zákazníků s společnými pravidly (B2C, B2B Standard, B2B VIP, Wholesale).

### **Customer of Record**
Customer entity v platformě.

### **EDI** (Electronic Data Interchange)
Standardizovaný format pro B2B data exchange.
**Klíčové dokumenty:** 850 PO, 855 PO Ack, 856 ASN, 810 Invoice.

### **Net terms**
Payment terms (Net 15, Net 30, Net 60).
**Net 30 = zaplať do 30 dnů od invoice date.**

### **PO** (Purchase Order)
B2B objednávkový dokument.

### **Punch-out** (cXML, OCI)
B2B integration kde buyer's procurement system "punches out" do supplier's catalog, vrátí košík.

### **Quote** / **RFQ** (Request for Quote)
B2B – buyer žádá o cenovou nabídku, supplier odpovídá kotací.

### **Sales rep** (Sales representative)
Person assigned k customer accountu (B2B). Často commission-based.

### **Statement**
Měsíční přehled customer transactions a balance (B2B).

### **Tax exempt**
Customer osvobozen od daně.

---

## 10. Orders & Fulfillment

### **Backorder**
Order pro zboží not in stock, ale expected.

### **Cancel**
Zrušení objednávky (zákazníkem nebo merchant) před fulfilled.

### **Draft order**
Order ve stavu draft, ještě nezveřejněn.

### **Exchange**
Customer vrací item, dostává jiný. Conceptually = return + new order.

### **Fulfillment status**
Stav fulfillu objednávky:
```
unfulfilled → partial → fulfilled
```

### **Manual order**
Order vytvořený admin (phone order, B2B sales).

### **Order**
Komitment customer-merchant. Header + line items.

### **Order line item**
Jeden produkt v objednávce (1 row).

### **Order number**
Public-facing identifier objednávky.
**Naše konvence:** `ORD-2026-00001234`

### **Order state**
Stav v rámci order lifecycle. Viz `16-order-management.md` pro state machine.
```
created → paid → processing → shipped → delivered → completed
                              → cancelled
                              → refunded
```

### **Partial shipment**
Část order shipped, zbytek čeká.

### **Pre-order**
Order pro produkt not yet released.

### **Reorder**
Vytvoření nové objednávky kopírováním z předchozí.

### **Subscription order** / **Recurring order**
Order generovaný automaticky podle subscription schedule.

---

## 11. Marketing & SEO

### **A/B testing**
Test dvou variant (A vs B) na subset usersech, výběr winnera.

### **Abandoned cart email**
Email pro recovery košíku.

### **AI overview** (Google Search)
Google AI-generated summary v search results. Optimization = AEO.

### **AOV-boosting techniques**
Cross-sell, upsell, free shipping threshold, bundle pricing.

### **AEO** (Answer Engine Optimization)
Optimization pro AI search engines (vs traditional SEO).

### **Attribution**
Připisování conversion specifickému marketing channelu / kampani.
**Models:** First-touch, last-touch, linear, time-decay, data-driven.

### **Campaign**
Marketing aktivita s cílem (např. Black Friday 2026).

### **Canonical URL**
Authoritative URL pro page (pro SEO duplicates).

### **CDP** (Customer Data Platform)
Platform pro unified customer data (Segment, Rudderstack).

### **CRO** (Conversion Rate Optimization)
Discipline of improving conversion rates.

### **CTA** (Call to Action)
Akce, kterou chceme od uživatele (button "Add to cart", "Subscribe").

### **Landing page**
Specifická stránka pro marketing campaign.

### **Lead magnet**
Free value výměnou za email (newsletter, ebook, discount).

### **Lookalike audience**
Audience podobná existing customerům (Facebook Ads, Google).

### **MOFU / TOFU / BOFU**
Funnel stages: Top of funnel (awareness), Middle (consideration), Bottom (decision).

### **OG tags** (Open Graph)
Meta tagy pro social media link previews.

### **Pop-up**
Modal okno pro lead capture, promo.

### **Retargeting**
Ad showing to users who visited but didn't convert.

### **Schema.org**
Structured data vocabulary pro SEO. Critical: Product, Review, Breadcrumb, FAQ, Article.

### **SERP** (Search Engine Results Page)
Stránka results po search.

### **Sitemap**
XML soubor s seznamem URL pro search engines.

### **UTM parameters**
URL parameters pro tracking (utm_source, utm_medium, utm_campaign).

### **WMM** (Win-back / Win-Maybe / Maybe campaign)
Retention email automation.

---

## 12. Analytics

### **Bounce rate**
Procento návštěvníků, kteří odejdou z první stránky bez interakce.

### **Cohort analysis**
Analýza skupiny zákazníků (cohort) v čase.

### **Conversion funnel**
Sequence kroků k conversion. Tracking drop-off na každém kroku.

### **Dashboard**
Visual representation klíčových metrik.

### **Event**
Tracked action user (page view, click, add to cart, purchase).

### **First-party data**
Data vlastněná merchantem (zákaznická data, behavioral). Vs third-party.

### **Funnel**
See "conversion funnel".

### **GA4** (Google Analytics 4)
Standard tracking platform.

### **Heatmap**
Visualization clicks/scrolls/movements na page.

### **Pageview**
Načtení stránky.

### **RFM** (Recency, Frequency, Monetary)
Customer segmentation framework.

### **RUM** (Real User Monitoring)
Performance tracking od skutečných uživatelů.

### **Sessions**
Period of activity (default 30 min idle = nová session).

### **Session replay**
Recording user session pro UX analýzu (FullStory, LogRocket).

### **TanStack Query**
Server state management (formerly React Query).

---

## 13. Architecture & Tech

### **API Gateway**
Centralizovaný entry point pro API requests.

### **APM** (Application Performance Monitoring)
Tools jako New Relic, Datadog, Sentry pro performance tracking.

### **CDC** (Change Data Capture)
Pattern pro stream changes z DB do downstream systems.

### **CDN** (Content Delivery Network)
Distributed servers pro fast content delivery.

### **Circuit breaker**
Pattern pro graceful degradation při service failure.

### **CQRS** (Command Query Responsibility Segregation)
Pattern oddělující reads od writes.

### **DDD** (Domain-Driven Design)
Software design approach focused on domain modeling.

### **Event sourcing**
Pattern kde state je reconstructed from events.

### **Eventual consistency**
Pattern kde data eventually become consistent across replicas.

### **gRPC**
RPC framework using HTTP/2 + Protocol Buffers.

### **Hexagonal architecture** / **Ports & Adapters**
Architecture pattern oddělující business logic od infrastructure.

### **JWT** (JSON Web Token)
Standard pro signed tokens (auth).

### **K8s** (Kubernetes)
Container orchestration platform.

### **Microservices**
Architecture style with small, independent services.

### **OAuth 2.1**
Authorization framework. PKCE mandatory.

### **OIDC** (OpenID Connect)
Authentication layer on top of OAuth 2.

### **Rate limiting**
Restricting requests per time window.

### **RBAC** (Role-Based Access Control)
Authorization based on roles assigned to users.

### **REST**
Architectural style for APIs (HTTP-based).

### **RLS** (Row Level Security)
DB-level access control per row.

### **Saga**
Pattern pro distributed transactions.

### **Sidecar**
Pattern kde supporting service runs alongside main service.

### **SLA** (Service Level Agreement)
Komitment pro uptime, performance.

### **SLO** (Service Level Objective)
Internal target (often stricter than SLA).

### **SSE** (Server-Sent Events)
Server → client one-way streaming.

### **SSR** (Server-Side Rendering)
Rendering HTML on server.

### **SSG** (Static Site Generation)
Pre-rendering pages at build time.

### **TLS** (Transport Layer Security)
Cryptographic protocol for secure communication.

### **WebSocket**
Bidirectional communication over single TCP connection.

### **Webhook**
HTTP callback pro events.

### **Worker**
Background job processor.

---

## 14. Personas & Roles

> **Detail:** viz `36-personas-rbac.md`

### **PERSONA-SUPER-ADMIN**
Nejvyšší práva v platformě. Náš (provider) team. Vidí vše.

### **PERSONA-PLATFORM-ADMIN**
Platform admin (provider team). Provoz, support, billing.

### **PERSONA-MERCHANT-OWNER**
Vlastník merchant accountu. Plný přístup ve svém tenantu.

### **PERSONA-MERCHANT-STAFF**
Zaměstnanci merchanta. Sub-roles:
- WAREHOUSE-WORKER
- MARKETING-MANAGER
- ACCOUNTING
- CUSTOMER-SERVICE-REP

### **PERSONA-MERCHANT-GUEST**
Read-only přístup pro outside parties (auditor, accountant).

### **PERSONA-B2B-COMPANY-ADMIN**
Admin v B2B company account. Spravuje employees, approval rules.

### **PERSONA-B2B-EMPLOYEE**
Zaměstnanec B2B firmy. Kupuje za firmu, podléhá approval rules.

### **PERSONA-B2C-REGISTERED**
Registrovaný zákazník B2C.

### **PERSONA-GUEST-CUSTOMER**
Anonymní zákazník (guest checkout).

### **PERSONA-DEVELOPER**
Plugin/theme developer. Sandbox, API access.

### **PERSONA-AGENCY-PARTNER**
Agency spravující multiple merchants.

### **PERSONA-AFFILIATE-PARTNER**
Affiliate referrer (commission-based).

### **PERSONA-AI-AGENT**
AI agent acting on behalf of customer/admin. First-class user.

### **PERSONA-MARKETPLACE-VENDOR**
Vendor v multi-vendor marketplace.

---

## 📅 Změny

| Verze | Datum | Změna |
|-------|-------|-------|
| 1.0 | 2026-05-03 | Initial glossary |

---

**Konec Glossary.**

➡️ Pokračovat na: [`03-data-models-master.md`](03-data-models-master.md)
