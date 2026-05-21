# Shopify – Kompletní hloubková analýza všech funkcí, modulů a featur

> **Stav:** duben 2026 (Winter '26 Edition „RenAIssance" zahrnuta)
> **Rozsah:** všechny tarify (Starter, Basic, Grow, Advanced, Plus, Retail), POS, B2B, Markets, API, AI, ekosystém aplikací, integrace
> **Zdroje:** oficiální dokumentace Shopify, Help Center, Shopify.dev, Shopify Editions a aktuální analýzy třetích stran

---

## Obsah

1. [Co je Shopify a firemní kontext](#1-co-je-shopify-a-firemní-kontext)
2. [Tarify a cenové plány](#2-tarify-a-cenové-plány)
3. [Shopify Admin – kontrolní centrum](#3-shopify-admin--kontrolní-centrum)
4. [Produkty a katalog](#4-produkty-a-katalog)
5. [Sklad a inventory management](#5-sklad-a-inventory-management)
6. [Objednávky a fulfillment](#6-objednávky-a-fulfillment)
7. [Zákazníci a segmentace](#7-zákazníci-a-segmentace)
8. [Checkout a platby](#8-checkout-a-platby)
9. [Doprava a dodání](#9-doprava-a-dodání)
10. [Daně, cla a compliance](#10-daně-cla-a-compliance)
11. [Online Store – frontend, témata, Liquid](#11-online-store--frontend-témata-liquid)
12. [Marketing a prodejní kanály](#12-marketing-a-prodejní-kanály)
13. [Slevy, promoakce a věrnostní programy](#13-slevy-promoakce-a-věrnostní-programy)
14. [SEO a obsah](#14-seo-a-obsah)
15. [Analytika a reporting](#15-analytika-a-reporting)
16. [AI – Shopify Magic a Sidekick](#16-ai--shopify-magic-a-sidekick)
17. [Shopify POS – prodej v kamenných prodejnách](#17-shopify-pos--prodej-v-kamenných-prodejnách)
18. [Shopify B2B a Wholesale](#18-shopify-b2b-a-wholesale)
19. [Shopify Markets – mezinárodní prodej](#19-shopify-markets--mezinárodní-prodej)
20. [Shopify Plus – enterprise funkce](#20-shopify-plus--enterprise-funkce)
21. [Automatizace – Shopify Flow, Launchpad](#21-automatizace--shopify-flow-launchpad)
22. [Developer platforma – API, Functions, Hydrogen, Oxygen](#22-developer-platforma--api-functions-hydrogen-oxygen)
23. [App Store a ekosystém aplikací](#23-app-store-a-ekosystém-aplikací)
24. [Bezpečnost, compliance a infrastruktura](#24-bezpečnost-compliance-a-infrastruktura)
25. [Podpora, vzdělávání a služby](#25-podpora-vzdělávání-a-služby)
26. [Shopify Editions – roadmapa a novinky](#26-shopify-editions--roadmapa-a-novinky)
27. [Známá omezení a nevýhody](#27-známá-omezení-a-nevýhody)

---

## 1. Co je Shopify a firemní kontext

Shopify je hostovaná (SaaS) e-commerce platforma založená v roce 2006 v kanadské Ottawě. Provozovatelům umožňuje založit, řídit a škálovat online obchod bez nutnosti starat se o servery, aktualizace, zabezpečení nebo PCI-DSS compliance.

**Klíčová čísla (2026):**

- Přes **2,4 milionu** aktivních obchodů ve 175+ zemích
- Kumulativní GMV přes **1 bilion USD**
- Shopify GMV za 2024: **292 mld. USD**, v roce 2025 přes **350 mld. USD**
- Shop Pay drží rekord nejrychlejšího akcelerovaného checkoutu (konverze o ~10 % vyšší než konkurence)
- Black Friday / Cyber Monday 2025: **14,6 mld. USD** za čtyři dny, špičkový průtok **5,1 mil. USD / min**

**Hlavní výhody:**

- Vše v jednom – hosting, doména, SSL, platby, pokladna, POS, analytika
- 99,9% uptime, globální CDN (Fastly), edge rendering
- Největší e-commerce app store na světě (8 000+ aplikací)
- Dedikovaný AI asistent Sidekick a sada AI tooling Shopify Magic

---

## 2. Tarify a cenové plány

Shopify aktuálně nabízí **6 placených úrovní**. Všechny placené tarify mají 3denní zkušební verzi zdarma a první 3 měsíce za 1 USD (v kombinaci 3 USD za první tři měsíce).

### 2.1 Shopify Starter – 5 USD/měs.

Minimalistický plán pro sociální prodej a prodej v messengerech.

- Spotlight téma (nelze rozšířit o sekce/bloky)
- Prodej přes Link in Bio, Facebook, Instagram, Messenger, WhatsApp
- Mobilní POS pro ruční prodej
- Bez plnohodnotného e-shopu (nemá klasický checkout)
- **Fee: 5 % transaction fee** na orders mimo Shopify Payments
- Neomezené produkty
- 1 účet (bez staff)

### 2.2 Shopify Basic – 29 USD/měs. (19 USD při ročním předplatném)

Základní plán pro malé e-shopy, solopreneurs a freelancery.

- Kompletní online obchod s doménou, SSL, pokladnou
- **2 staff accounts**
- Neomezené produkty, šířka pásma, objednávky
- Obnovení opuštěných košíků (abandoned cart recovery)
- Analýza podvodů (fraud analysis)
- 24/7 podpora (chat)
- Shopify Magic (AI)
- 10 lokací pro sklady
- Základní reporty
- **Kreditní karty online: 2,9 % + 0,30 USD** (USA); **poplatek za třetí strany 2 %**, pokud neuseje Shopify Payments

### 2.3 Shopify Grow (dříve „Shopify") – 79 USD/měs. (49 USD ročně)

Pro rostoucí firmy s malým týmem.

- Vše z Basic
- **5 staff accounts**
- Profesionální reporty
- Lokality až 10
- Lower card rates: **2,7 % + 0,30 USD** online
- Automaticky generované multi-location inventory

### 2.4 Shopify Advanced – 299 USD/měs. (199 USD ročně)

Vrchol standardních plánů. Cílí na e-shopy s obratem pod 1 M USD ročně, které ale potřebují hlubší reporting a nižší poplatky.

- Vše z Grow
- **15 staff accounts**
- Vlastní stavba reportů (custom report builder)
- **Carrier-calculated shipping** (reálné sazby dopravců)
- **Duties & Import Tax calculation** (zobrazení celních poplatků v checkoutu)
- Shopify Flow (automatizace)
- Nižší platební sazby: **2,5 % + 0,30 USD**
- Transaction fee mimo Shopify Payments: **0,5 %**
- Prediktivní hodnoty v analytice

### 2.5 Shopify Plus – od 2 300 USD/měs. (variabilně)

Enterprise plán pro vysokoobjemové obchody.

- **Neomezený počet staff accounts**
- Až **9 expansion stores** pod jednou smlouvou (B2B, regionální, značkové)
- **Plná customizace checkoutu** (Checkout Extensibility, Checkout UI, Checkout Blocks)
- **Shopify Functions** (vlastní server-side logika – slevy, dopravní metody, platební metody, validace košíku, fulfillment routing)
- **Launchpad** – plánování eventů, flash sale, time-based launches
- **Shopify Flow** (pokročilejší akce)
- **Organization Admin** – centrální řízení více obchodů
- **Higher API call limits** (40x vyšší než standard)
- **Bulk Operations API**
- **Shopify B2B** (viz sekce 18) v základu
- Dedikovaná technická podpora (Launch Manager, Merchant Success Manager)
- Priority 24/7 telefonická podpora
- **POS Pro** pro prvních 20 lokací zdarma
- Přístup do **Shopify Editions** previews
- Hydrogen + Oxygen (headless) bez limitu
- **ShopifyQL Notebooks** a rozšířené BI

### 2.6 Shopify Retail – 79 USD/měs.

Speciální plán pro kamenné obchody bez klasického e-shopu.

- POS Pro na jedné lokaci
- Staff účty pro POS
- Bez plnohodnotného online obchodu

### 2.7 Srovnávací tabulka hlavních plánů

| Funkce                     | Basic        | Grow            | Advanced     | Plus         |
| -------------------------- | ------------ | --------------- | ------------ | ------------ |
| Cena měsíčně (USD)         | 29           | 79              | 299          | 2 300+       |
| Staff accounts             | 2            | 5               | 15           | neomezeně    |
| Inventory locations        | 10           | 10              | 10           | 200          |
| Online kreditní karty (US) | 2,9 % + 0,30 | 2,7 % + 0,30    | 2,5 % + 0,30 | negotiated   |
| Transaction fee mimo SP    | 2 %          | 1 %             | 0,5 %        | 0,15 %       |
| Custom reports             | ❌           | ✅              | ✅           | ✅           |
| Shopify Flow               | ❌           | ❌              | ✅           | ✅           |
| Checkout Extensibility     | ✅ (omezeně) | ✅              | ✅           | ✅ plné      |
| B2B                        | ❌           | ✅ (3 katalogy) | ✅           | ✅ neomezeně |
| Expansion Stores           | ❌           | ❌              | ❌           | 9            |
| Hydrogen + Oxygen          | ✅           | ✅              | ✅           | ✅           |

---

## 3. Shopify Admin – kontrolní centrum

Shopify Admin je webová i mobilní aplikace, přes kterou obchodník řídí celý obchod. Zahrnuje následující sekce v levém navigačním menu:

### 3.1 Home

- Personalizovaný dashboard (přehled objednávek, obratu, návštěv)
- Sidekick widget (AI návrhy)
- Sidekick Pulse (proaktivní insights – nové od Winter '26)
- Getting started checklist
- Upozornění (inventory alerts, payout holds, výpadky)
- Live visitor counter
- „Today at a glance" – klíčové metriky

### 3.2 Orders

- Přehled, filtrování, vyhledávání objednávek
- Timeline každé objednávky (log akcí)
- Draft orders (manuální / telefonické objednávky)
- Abandoned checkouts
- Checkout recovery (automatické e-maily)
- Returns & exchanges (včetně self-service portalů)
- Archivace
- Refundy (částečné i plné)
- Tagy pro objednávky
- Ruční zachycení platby
- Editace adresy, položek, poznámek
- Export do CSV, tisk štítků, faktur

### 3.3 Products

- Seznam produktů s filtrováním (tagy, typ, kolekce, vendor)
- Produktové detaily (titulek, popis, SEO pole, obrázky, varianty, SKU, barcode, cena, porovnávací cena, cost, daňová třída, harmonizovaný kód, hmotnost)
- Varianty (až 2 000 na produkt / až 100 pro B2B)
- Metafields (vlastní pole pro libovolná data)
- Metaobjects (vlastní datové struktury – např. autori, velikostní tabulky, ingredience)
- Kolekce (ruční nebo smart – automatické na základě pravidel)
- Categories (nově v 2026 – Shopify Standard Product Taxonomy, automaticky mapuje ke Google Shopping)
- Giftcards (pokud aktivní)
- Transfers (přesuny mezi sklady)
- Inventory
- Purchase Orders (vytváření a správa objednávek u dodavatelů)
- Tisk štítků (SKU, cenovek)
- Hromadný editor (bulk edit) – rychlá úprava mnoha polí najednou
- CSV import/export
- Shopify Magic: generování popisů, tagů, alt textů, titulků

### 3.4 Customers

- Seznam, profily, segmenty
- Customer Account (klasický vs. nová verze přihlášení přes e-mail kód)
- Companies (B2B)
- Lifetime value, průměrná objednávka, historie
- Tagy, poznámky
- Marketing subscription status
- Importy, exporty

### 3.5 Marketing

- Automatizace (welcome, abandoned cart, post-purchase)
- Kampaně (Facebook, Google, Instagram, TikTok, e-mail)
- Shopify Email (10 000 e-mailů / měsíc zdarma, potom pay-as-you-go)
- Shopify Inbox (live chat)
- Landing pages
- Sledování UTM

### 3.6 Discounts

- Automatické slevy
- Slevové kódy
- Discount combinations (kombinování více typů)
- Volume discounts (B2B)
- Price lists
- Free gift with purchase (skrze Shopify Functions nebo aplikace)

### 3.7 Content

- Stránky (About, Contact, Shipping policy, FAQ atd.)
- Blog posts
- Navigace (hlavní menu, patička, vlastní menu)
- Metaobjekty
- Soubory (media library)

### 3.8 Analytics

- Reporty, dashboardy, live view

### 3.9 Online Store

- Themes (správa, editor, code editor)
- Blog posts (přes Content)
- Pages (přes Content)
- Navigation
- Domains
- Preferences (favicon, meta description, password protection)

### 3.10 Sales Channels

- Online Store
- POS
- Shop (Shop app channel)
- Facebook & Instagram
- Google & YouTube
- TikTok
- Amazon (přes aplikaci)
- eBay (přes aplikaci)
- Walmart
- Handshake (B2B marketplace od Shopify)
- Point of Sale
- Hydrogen (headless sales channel)
- Headless (pro vlastní frontend bez Hydrogenu)
- Buy Button (embed na externí weby)

### 3.11 Apps

- Shopify App Store přímo v adminu
- Správa instalovaných aplikací
- Private apps / custom apps

### 3.12 Settings

Obsahuje přes 25 konfiguračních sekcí:

- General (info o obchodu, adresa, časová zóna, měna, jednotky)
- Plan (tarif, fakturace, upgrade/downgrade)
- Users and permissions (staff, role, 2FA)
- Payments
- Checkout (nastavení košíku a pokladny)
- Customer accounts
- Shipping and delivery
- Taxes and duties
- Locations
- Markets
- Apps and sales channels
- Domains
- Notifications (e-maily, SMS, webhooky)
- Policies (reklamační řád, obchodní podmínky, GDPR)
- Metafields and metaobjects
- Files
- Brand (logo, barvy, fonty – používá se v checkoutu i e-mailech)
- Languages
- Store activity log
- Customer events (pixel management)
- Custom data
- Gift cards
- Store details
- Billing

### 3.13 Mobilní aplikace Shopify (iOS, Android)

- Push notifikace objednávek
- Úprava produktů, zásob, cen
- Fulfillment z mobilu
- Přístup k Sidekick AI
- Analytics na cestách
- Live chat se zákazníky
- QR kódy pro produkty
- Sharing produktů do sociálních sítí

### 3.14 Bulk actions

Hromadné úpravy lze dělat na stránkách **Orders, Products, Customers, Discounts, Inventory**. Na webu bez limitu, na mobilu max. 25 položek najednou.

### 3.15 Search bar + Shopify Magic

- Univerzální vyhledávání přes celý admin
- Předvyplněné akce (např. „ukaž mi objednávky za posledních 7 dní")
- Kontextové nápovědy

---

## 4. Produkty a katalog

### 4.1 Struktura produktu

Každý produkt má následující atributy:

- **Title** (název – max. 255 znaků)
- **Description** (rich text editor s HTML, Shopify Magic pro AI generování)
- **Media** (obrázky až 20 MB, videa až 1 GB, 3D modely .glb/.usdz, externí YouTube/Vimeo)
- **Product category** (Shopify Standard Product Taxonomy – mapuje na Google, Meta, TikTok)
- **Product type** (vlastní textové pole)
- **Vendor**
- **Collections** (včetně automatických)
- **Tags** (libovolné štítky pro filtrování a automatizace)
- **SEO title & description** (přepsatelné meta tagy)
- **URL handle** (slug)
- **Status** (active / draft / archived)
- **Sales channels availability** (kde je produkt publikován)
- **Markets availability** (ve kterých trzích je produkt k dispozici)

### 4.2 Varianty

- Až **3 atributy** (velikost, barva, materiál)
- Až **2 000 variant** na produkt (100 pro B2B na Plus)
- Každá varianta: SKU, barcode (UPC/EAN/ISBN), price, compare-at price, cost per item, inventory, weight, requires shipping, taxable, tax code (TaxJar/Avalara)
- Automatické generování kombinací
- Unikátní obrázky pro varianty

### 4.3 Metafields

**Zásadní funkce pro rozšiřitelnost** – přidávání libovolných datových polí k produktům, kolekcím, objednávkám, zákazníkům, stránkám, blogům, variantám, order draftům, shopu, markets, lokacím atd.

**Typy metafields:**

- Text (single/multi-line, rich text)
- Number (integer, decimal)
- Date, Date and time
- Boolean
- Color
- Weight, dimension, volume
- URL
- JSON
- Rating (1–5)
- Money
- File reference (odkaz na obrázek/PDF)
- Product reference, variant reference, collection reference, page reference
- Metaobject reference (odkaz na vlastní strukturu)
- List of any of the above

### 4.4 Metaobjects (vlastní datové struktury)

Příklady použití: autoři knih, velikostní tabulky, ingredience, testimonials, FAQ, lookbooky, pobočky. Každý metaobject má vlastní schéma polí a lze jej referencovat z produktů, témat, Liquidu a API.

### 4.5 Import / export

- CSV s předepsaným formátem (šablona od Shopify)
- Hromadný editor (bulk editor) na 50 produktů najednou
- API pro jakýkoliv počet
- Matrixify, Excelify a další aplikace pro pokročilé importy

### 4.6 Shopify Collabs (dříve Dovetale)

Nástroj pro spolupráci s influencery / affiliate partnery přímo v adminu – náborové stránky, provize, sledování prodejů.

### 4.7 Shopify Collective

Marketplace mezi Shopify obchody – umožňuje prodávat produkty jiných Shopify obchodů ve vlastním e-shopu (dropshipping mezi značkami).

### 4.8 Gift Cards

- Digitální dárkové karty s vlastní hodnotou nebo přednastavenými částkami
- QR kód pro offline uplatnění
- Scheduled delivery (doručení k datu)
- Zůstatek se dá uplatnit v POS i online
- Vypršení platnosti (volitelné)
- Hromadné generování kódů
- Emailové notifikace

---

## 5. Sklad a inventory management

### 5.1 Multi-location inventory

- **Basic, Grow, Advanced:** až 10 lokací
- **Plus:** až 200 lokací
- Každá lokace má vlastní adresu, inventář, fulfillment nastavení
- Typy lokací: sklad, prodejna, dropshipping, 3PL, vlastní fulfillment
- Každá lokace má nezávislý stav zásob (nelze sdílet)

### 5.2 Inventory tracking

Stavy zásob:

- **On hand** – fyzicky dostupné
- **Committed** – rezervované k již přijatým objednávkám
- **Available** – skutečně prodejné (On hand – Committed – Unavailable)
- **Unavailable** – damaged, quality control, safety stock, nebo vlastní důvody
- **Incoming** – zaplaceno, ale ještě nepřijato (z purchase order nebo transferu)

### 5.3 Funkce inventory

- Track quantity (zapnout/vypnout pro jednotlivé produkty)
- Continue selling when out of stock (volitelné)
- 180denní historie změn zásob
- Low stock alerts (přes aplikace)
- Auto-reorder z přednastavené úrovně
- Custom reason pro úpravy (damaged, theft, promotion atd.)

### 5.4 Transfers

Přesun zásob mezi vašimi lokacemi:

- Create → Send → Receive workflow
- Tracking number dopravce
- Částečné příjmy
- Automatická aktualizace zásob obou stran

### 5.5 Purchase Orders

- Objednávky u dodavatelů
- Track stavu (Pending, Ordered, Partial, Received)
- Reference cost, tax, shipping
- Příjem (receive) aktualizuje inventory
- Šablony pro opakované objednávky

### 5.6 Stocky (Shopify's Inventory Management App)

Zahrnuta pro Advanced a Plus:

- Pokročilé forecasting
- Demand forecasting
- Stock transfers s barcode skenováním
- Pokročilé reporty obrátky zásob
- ABC analýza
- Safety stock calculator
- Sales velocity

### 5.7 Order routing (Plus)

Automatické přiřazení objednávek k optimální lokaci podle:

- Geografické vzdálenosti
- Stavu zásob
- Priority lokací
- Shipping zones

---

## 6. Objednávky a fulfillment

### 6.1 Order lifecycle

Každá objednávka má:

- **Payment status** (authorized, paid, partially paid, pending, refunded, voided)
- **Fulfillment status** (unfulfilled, partially fulfilled, fulfilled, restocked)
- **Financial status** timeline
- **Tags** pro kategorizaci
- **Risk score** (low/medium/high + detaily)

### 6.2 Fulfillment workflow

- Manuální fulfillment
- Hromadný fulfillment
- Částečný fulfillment (různé položky z různých lokací)
- Split shipping
- Pick list generation
- Pack slips (customizovatelné)
- Print shipping labels (Shopify Shipping)
- Shipping notifications (automaticky)

### 6.3 Shopify Shipping

Dostupné v USA, Kanadě, UK, Austrálii – snížené sazby s USPS, UPS, DHL Express, Canada Post, Royal Mail, Sendle, Evri, Australia Post:

- Slevy až 88 %
- Tisk štítků přímo v adminu
- Batch printing
- Insurance
- Tracking automaticky zasílán zákazníkovi
- Integrace s přepravci třetích stran

### 6.4 Shopify Fulfillment Network (SFN)

Dříve vlastní síť skladů Shopify (ve 2023 prodána do Flexport, ale stále integrovaná):

- Orders automaticky routing do skladů
- 2denní doručení v USA
- Vratky (returns) zpracování
- Packaging

### 6.5 Returns & Refunds

- **Self-service returns portal** – zákazník si požádá sám
- **Return labels** – automatické generování
- **Return reasons** (customizovatelné)
- **Restocking fees**
- **Exchange for new item**
- **Store credit** místo refundace
- **Partial refunds**
- **Refund shipping**

### 6.6 Draft orders

- Ruční vytvoření objednávky (telefonický prodej, B2B, custom quote)
- Odeslání zákazníkovi přes e-mail s platební linkou (payment request)
- Nastavení slevy, custom ceny, custom produktu
- Uložení a odeslání později

### 6.7 Order editing

- Přidání/odebrání položek (s automatickým refundem/doplatkem)
- Změna adresy
- Změna dopravce
- Přidání poznámek (interní i pro zákazníka)

### 6.8 Notifications

Předkonfigurované e-mailové a SMS šablony:

- Order confirmation
- Order cancellation
- Order edited
- Order paid
- Shipping confirmation
- Shipping update
- Out for delivery
- Delivered
- Abandoned checkout
- Customer account invite, welcome, password reset
- POS receipt
- Gift card notifications

Všechny lze přepsat, překládat, přidávat HTML/Liquid. Na Plus lze napojit SendGrid, Klaviyo apod. přes webhooky.

### 6.9 Fraud analysis

Zdarma u všech plánů:

- Automatické skórování každé objednávky
- Faktory: IP adresa, BIN karty, shodnost adres, velocity, CVV, AVS
- Manuální kontrola, zamítnutí platby
- Shopify Protect (zdarma pro Shop Pay transakce, chargeback protection)

---

## 7. Zákazníci a segmentace

### 7.1 Customer profiles

Každý zákazník má:

- Jméno, e-mail, telefon
- Adresy (více adres)
- Historie objednávek, celková útrata, průměrná objednávka
- Tagy
- Poznámky
- Marketing consent (e-mail, SMS)
- Preferred language
- Company (pro B2B)
- Customer events (timeline akcí)

### 7.2 Customer accounts (dvě verze)

**Classic Accounts:**

- Klasické přihlášení přes email a heslo
- Základní self-service

**New Customer Accounts:**

- Bezheslový login – jednorázový kód e-mailem
- Pokročilý self-service:
  - Historie objednávek
  - Returns self-service
  - Re-order
  - Úprava adres
  - Stav členství / věrnostního programu
  - Extensions přes apps (na Plus)

### 7.3 Segmenty

Dynamické segmenty postavené na **query language**:

- Filtrace podle útraty, počtu objednávek, lokace, tagů, produktu
- Poslední objednávka
- Churned customers
- High-value customers
- Custom události (pixel)

Segmenty lze použít v:

- Marketingových e-mailech
- Automatizacích
- Discount targeting
- B2B price lists
- Reports

### 7.4 Customer events (pixel)

Klientská i serverová událostní architektura:

- Page viewed
- Product viewed
- Collection viewed
- Search submitted
- Cart viewed, updated
- Checkout started, completed
- Custom events

Slouží jako jednotný zdroj pro analytics aplikace, personalizaci, remarketing, AI.

### 7.5 Customer Privacy API

Compliance rámec pro GDPR, CCPA, PIPEDA – cookie banner, souhlas, data access/erasure requests.

---

## 8. Checkout a platby

### 8.1 Shopify Checkout

**Shopify checkout konvertuje v průměru o 15 % lépe než jiné platformy.** Vlastnosti:

- **One-page checkout** (nová verze, Winter '24+)
- Branded design (logo, barvy, fonty z Brand settings)
- Express payment buttons v hlavičce
- Discount code / gift card field
- Shipping adresa s autofill (Google address API)
- Shipping method výběr s reálnými cenami
- Tax calculation
- Duties (pro mezinárodní)
- Tip jar (dobrovolné spropitné)
- Delivery date picker (přes aplikace)
- Custom fields (přes Functions / Extensions)
- Post-purchase page (upsell, survey)
- Thank-you page customization

### 8.2 Checkout Extensibility

Nová architektura (povinná od srpna 2024):

- **Checkout UI Extensions** – React/Preact komponenty v checkoutu
- **Checkout Blocks** – no-code vkládání obsahu (Plus i Basic+ v roce 2026)
- **Post-purchase Extensions**
- **Thank-you page customization**
- **Order status page customization**

### 8.3 Shop Pay

Nejrychlejší akcelerovaná pokladna na webu. Zdarma, pokud používáte Shopify Payments.

- **One-tap checkout** (uložené údaje)
- **Shop Pay Installments** (BNPL přes Affirm – 4× bez úroku nebo 3–24 měsíců s úrokem)
- **Shopify Protect** – chargeback protection zdarma pro eligible transakce v USA
- **Sign in with Shop** – Single Sign-On přes Shop účet
- **Sell with Shop** – produkty se zobrazují v Shop app (více než 150 M uživatelů)
- **Shop Campaigns** – performance marketing platforma s pay-per-conversion
- **QR kód checkout** v POS
- Funguje na webu, Shop app, Facebook, Instagram, Google
- **Podpora iDEAL | Wero** (Evropa)
- **USDC cryptocurrency** (USA Shopify Payments)

### 8.4 Shopify Payments

Nativní payment gateway v 23 zemích (USA, UK, Kanada, Austrálie, Nový Zéland, Irsko, Německo, Francie, Nizozemsko, Španělsko, Itálie, Belgie, Rakousko, Dánsko, Švédsko, Finsko, Japonsko, Singapur, Hongkong, Portugalsko, Česko je dostupné přes třetí strany).

- Powered by Stripe
- Automaticky: PCI-DSS compliance, 3D Secure 2, SCA
- Payouts v domácí měně
- Multi-currency payouts (Plus)
- Integrované financial reporty (payouts, fees, refunds)
- Manual capture možné
- Dispute management v adminu

### 8.5 Další platební brány (100+ v seznamu)

Mimo Shopify Payments jsou podporované brány jako PayPal Express, Amazon Pay, Apple Pay, Google Pay, Klarna, Afterpay, Zip, Clearpay, Mollie, Stripe, Adyen, Authorize.net, Braintree, Worldpay, Bank transfer, Cash on delivery, manual methods atd.

Pro ČR se typicky používá: **GoPay, ComGate, Stripe, Adyen, PayU, ThePay**. Bez Shopify Payments se platí přídavný **third-party transaction fee** (0,15 % – 2 % podle tarifu).

### 8.6 Shop Cash

Věrnostní měna fungující napříč obchody na Shop app – zákazník získává 1 % cashback na kvalifikovaných objednávkách.

### 8.7 Checkout a Thank-you rozšiřitelnost (2026)

- Shopify Functions pro:
  - Custom slevy
  - Úpravu dopravních sazeb
  - Přejmenování/skrytí platebních metod
  - Validace košíku (např. min. objednávka)
  - Delivery customizations
- Pixel API pro server-side události
- Web Pixels pro analytics bez narušení výkonu

---

## 9. Doprava a dodání

### 9.1 Shipping zones

- Neomezený počet zón
- Zóny podle země, státu, ZIP kódu
- Priority zón

### 9.2 Shipping rates

- **Flat rate** (pevná sazba)
- **Price-based** (zdarma nad X USD)
- **Weight-based** (podle hmotnosti)
- **Item-based** (podle počtu kusů)
- **Carrier-calculated** (reálné sazby od USPS, UPS, FedEx, DHL, Canada Post, Royal Mail) – Advanced a Plus
- **Free shipping**
- **Custom method s podmínkami**

### 9.3 Shipping profiles

Různé sazby pro různé produkty:

- Custom profile pro fragile items, oversized, frozen goods
- Origin-based (z různých skladů jiné ceny)
- Kombinace dopravce pro různé destinace

### 9.4 Delivery methods

- Standard shipping
- Expedited
- Same-day delivery
- Local delivery (s mapou radius, min. order)
- Local pickup (BOPIS – buy online, pickup in store)
- Curbside pickup
- Lockers (integrace s Packeta, UPS Access Point)
- Doba dodání
- Slot selection (přes aplikace)

### 9.5 Packaging

- Vlastní baličky – nastavení rozměrů a hmotnosti
- Multi-package shipments
- Automatické dimensional weight calculation

### 9.6 Labels a tracking

- Tisk štítků (4x6, letter)
- Batch printing až 100 štítků najednou
- Void labels (před expedicí)
- Return labels
- Tracking number sync s carriers
- Custom tracking URL

### 9.7 Managed Markets (Plus)

- Shopify ve spolupráci s Global-e zařídí clo, daň, dopravu do 150+ zemí
- Automatická konverze měn
- Local payments

---

## 10. Daně, cla a compliance

### 10.1 Tax engine

- **Shopify Tax** (nové, US-only – automatické výpočty podle jurisdikcí, rooftop-level accuracy)
- **Basic Tax** (manuální nastavení sazeb)
- **Manual taxes** (vlastní definice)
- Tax overrides pro jednotlivé produkty/zóny
- Digital goods VAT (EU – reverse charge, OSS)
- Automatické tax reports

### 10.2 Nexus tracking (USA)

- Automatické hlídání, kdy musíte registrovat daň v novém státě
- Liability tracker
- Doporučení k registraci

### 10.3 EU VAT

- Auto-registrace OSS
- Intrastat reporty přes aplikace
- DPH compliant faktury (třeba Sufio, Order Printer Pro)
- VAT ID validace

### 10.4 Duties & Import tax

- Výpočet podle Harmonized System Code
- Landed cost v checkoutu
- DDP (Delivered Duty Paid) vs. DDU
- Automatická integrace s přepravci

### 10.5 Compliance certifikace

- PCI DSS Level 1
- SOC 2 Type II
- SOC 3
- ISO 27001
- HIPAA-ready (pro určité sektory)
- GDPR compliance
- CCPA compliance

---

## 11. Online Store – frontend, témata, Liquid

### 11.1 Themes – architektura

Shopify používá vlastní šablonový jazyk **Liquid** (open-source, vytvořen Shopify v roce 2006). Současný standard je **Online Store 2.0** s JSON templatey.

### 11.2 Theme Store

- Přes **200 oficiálních témat** (zdarma i placených)
- Ceny placených šablon: **100 – 400 USD** jednorázově
- Oficiální free téma: **Dawn** (reference implementation)
- Populární: Sense, Studio, Craft, Ride, Colorblock, Refresh, Crave, Spotlight (Starter), Trade (B2B)

### 11.3 Theme editor

Drag-and-drop visual editor:

- **Sections** – přetahovatelné sekce na stránce
- **Blocks** – menší komponenty uvnitř sekcí
- **App blocks** – bloky od nainstalovaných aplikací
- **Static sections** – neodstranitelné (header, footer)
- **Templates** – pro produkt, kolekci, košík, domovskou stránku, stránku, blog post atd.
- **JSON templates** (na rozdíl od Liquid templates – umožňují drag-and-drop)
- **Theme settings** (barvy, fonty, typografie, layout)
- **Preview** před publikací
- **Multiple unpublished themes** v knihovně

**Limity:**

- Max. **25 sekcí** na template
- Max. **1 250 bloků** napříč všemi sekcemi v template
- Max. **8 úrovní** nested bloků

### 11.4 Code editor

Přímá úprava kódu tématu:

- Liquid soubory (.liquid)
- CSS, SCSS
- JavaScript
- JSON konfigurace
- Assets
- Locales (překladové soubory)
- Sections, Templates, Snippets, Layout, Config, Blocks

### 11.5 Liquid objects a taggy

Hlavní Liquid objekty:

- `product`, `variant`, `collection`
- `cart`, `checkout`, `order`
- `customer`, `shop`, `settings`
- `request`, `routes`, `content_for_*`
- `section`, `block`, `app`
- `localization`, `market`

Operace: filtry (asi 200), control flow, assign, capture, for loops, paginate, render/include, layout, section, form.

### 11.6 Customer Account UI Extensions

Vlastní komponenty v New Customer Accounts – loyalty widget, subscription management, custom fields.

### 11.7 Checkout UI Extensions

- Komponenty na pokladně, thank-you page, order status, B2B order submission page
- Rozhraní: Banner, Button, ChoiceList, TextField, Stepper, MoneyLine, Image, atd.
- API: applyCartLinesChange, applyDiscountCodeChange, applyShippingAddressChange
- Běh v sandboxed iframe s jasnou permissions boundary

### 11.8 Theme Blocks (generace nových bloků přes AI)

Shopify Magic umí vygenerovat nové bloky přímo z popisu – například „sekce s countdown timerem". Kód (.liquid soubor) se uloží do `/blocks/`.

### 11.9 App blocks

Aplikace třetích stran se integrují jako bloky do libovolné sekce – tj. není nutné upravovat kód tématu. Standardní API pro vývojáře aplikací.

### 11.10 Dawn (referenční téma)

Postavené na:

- Minimalistickém JS (web components, žádný framework)
- Lazy loading obrázků, SVG sprites
- Accessibility-first přístupu
- Lighthouse skóre 90+

### 11.11 Content Security Policy

Shopify implementuje CSP hlavičky pro checkout a customer accounts – ochrana proti XSS.

### 11.12 Translate & Adapt (Shopify app)

- Oficiální překladová aplikace zdarma
- Auto-translation přes strojový překlad
- Manuální úprava překladů
- Překlady produktů, kolekcí, stránek, blog postů, tématu, meta polí, e-mailů
- Per-market adaptace obsahu (stejný jazyk, různé texty pro různé trhy)

### 11.13 Theme performance

- Automatické obrázky: WebP, srcset, lazy loading
- CDN: Fastly (globální)
- Brotli kompresze
- Critical CSS inlining
- Font subsetting

---

## 12. Marketing a prodejní kanály

### 12.1 Shopify Email

- Nativní e-mailový marketing
- Zdarma prvních **10 000 e-mailů / měsíc**, poté ~1 USD / 1 000 e-mailů
- Templaty podle brand settings
- Segmentace
- A/B testing subject line
- AI asistent pro texty
- Analytics: open rate, click rate, revenue per send
- Automatizace (welcome, abandoned cart, winback, post-purchase, VIP)

### 12.2 Shopify Inbox

- Live chat integrovaný do obchodu
- Unified inbox (Shop app, Instagram, Facebook, e-mail, SMS)
- Automatické odpovědi (FAQ, quick replies)
- AI Sidekick pro doporučení produktů v chatu
- Conversion tracking (chaty vs. tržby)

### 12.3 Shop Campaigns

Performance marketing:

- **Pay-per-conversion** model
- Targeting 100+ M uživatelů Shop app
- Shopify Audiences (viz níže)
- Incrementality measurement

### 12.4 Shopify Audiences (Plus)

- Machine learning na Shopify síti (opt-in)
- Custom audiences pro Facebook, Google, TikTok, Pinterest, Snap, Criteo
- **Lowers CAC** až o 50 %
- Lookalike modeling na objednávkových datech

### 12.5 Sales channels

Kromě online obchodu lze publikovat produkty do:

#### Facebook & Instagram

- Shop tab na FB stránce
- Instagram Shopping (tagování produktů v postech, reels, stories)
- Advantage+ shopping campaigns
- Catalog sync
- Live shopping

#### TikTok Shop

- Nativní integrace od února 2026
- In-feed shopping
- Live commerce
- Creator collaboration

#### Google & YouTube

- Google Merchant Center sync
- Free Google Shopping listings
- YouTube Shopping (tagování produktů ve videích)
- Google Ads napojení

#### Amazon

- Přes oficiální aplikaci Amazon
- Sync produktů do FBA
- Order import

#### eBay, Walmart, Etsy (přes apps)

#### Shop app

- Shopify Shop mobilní aplikace s 150+ M uživateli
- Browse, buy, track
- Personalizované doporučení
- Shop Cash (věrnostní cashback)

#### Handshake

- B2B marketplace od Shopify
- Kurátorovaný výběr značek pro retailery

#### Roblox, Spotify (experimentální)

#### AI Commerce Channel (Winter '26)

- Produkty se automaticky zobrazují v **ChatGPT, Perplexity, Microsoft Copilot**
- Orders from AI searches vzrostly **15×** mezi lednem 2025 a lednem 2026
- AOV z AI vyšší než z direct trafficu

### 12.6 Marketing Automations

Předpřipravené cesty:

- Welcome new customers
- Abandoned cart (až 3 e-maily)
- Abandoned checkout
- Abandoned browse
- Winback lapsed customers
- Post-purchase thank-you
- Post-purchase cross-sell
- Customer re-engagement

### 12.7 SMS marketing

Přes aplikace (Postscript, Attentive, Klaviyo SMS, Yotpo). Shopify má vlastní SMS consent management.

### 12.8 Paid ad integrace

- Facebook Pixel (Meta)
- Google Ads conversion tracking
- TikTok Pixel
- Pinterest Tag
- Snapchat Pixel
- LinkedIn Insight Tag
- Bing Ads

### 12.9 UTM a attribution

- UTM parametry standardně sledované
- Multi-touch attribution (first-click, last-click, linear)
- Marketing reports (revenue by channel)

---

## 13. Slevy, promoakce a věrnostní programy

### 13.1 Typy slev

- **Amount off products** (pevná částka / procento)
- **Amount off order** (pevná částka / procento)
- **Buy X, Get Y** (BXGY – 1+1 zdarma, 2+1, atd.)
- **Free shipping**
- **Automatic discount** (aplikuje se bez kódu)
- **Discount code**

### 13.2 Podmínky slev

- Minimum purchase amount
- Minimum quantity
- Customer eligibility (všichni / segmenty / konkrétní zákazníci)
- Usage limits (celkem, jedna na zákazníka)
- Aktivní období (start/end date)
- Combine with product / shipping / order discounts

### 13.3 Discount combinations

Nová funkce – možnost kombinovat více slev najednou:

- Order + Product
- Shipping + Product
- Shipping + Order

### 13.4 Volume discounts (B2B)

- Tier 1: 1–9 ks → základní cena
- Tier 2: 10–49 ks → -10 %
- Tier 3: 50+ ks → -20 %
- Per product / per price list

### 13.5 Custom discount logic (Functions)

Shopify Functions umožňují jakoukoliv slevovou logiku:

- Multi-tier slevy
- Bundle discounts
- Loyalty tier přirážky
- Time-based dynamic pricing

### 13.6 Gift cards jako incentive

- Dát gift card místo slevy
- Přednastavené hodnoty
- Loyalty milestones

### 13.7 Loyalty programs

Nativně Shopify nemá loyalty program – řeší se přes aplikace:

- **Smile.io**, **LoyaltyLion**, **Yotpo**, **Rewardify**, **Stamped**
- Integrace přímo do customer accounts
- Points, tiers, referrals, VIP rewards

---

## 14. SEO a obsah

### 14.1 Built-in SEO features

- Auto-generované `sitemap.xml`
- Auto-generovaný `robots.txt` (editovatelný)
- Canonical tags
- Structured data (Product, Breadcrumb, Organization, FAQ) – Dawn má JSON-LD
- Meta title / description pro produkty, kolekce, stránky, blog
- URL handle editovatelný
- 301 redirects (manuálně i automaticky při změně URL)
- Alt texty na obrázcích
- hreflang pro international SEO (automaticky u Markets)
- Mobile-friendly checkout
- Schnell page speed (CDN, CSS optimization, lazy load)
- SSL zdarma
- HTTPS enforce

### 14.2 URL struktura

- `/products/product-handle`
- `/collections/collection-handle`
- `/collections/handle/products/product-handle`
- `/blogs/blog-handle/post-handle`
- `/pages/page-handle`
- Jazykové / tržní prefixy: `/fr-ca/`, `/de/`

### 14.3 Blog

- Neomezený počet blogů
- Autoři
- Tagy
- Komentáře (s moderací)
- RSS feed
- Excerpts, featured image
- Scheduled publishing

### 14.4 AI-powered SEO (Shopify Magic)

- Generování meta titulů a descriptions
- Generování alt textů
- Předpoklad relevantních klíčových slov z popisů

### 14.5 Integrace SEO nástrojů

- Google Search Console (verifikace)
- Bing Webmaster Tools
- Semrush, Ahrefs, Smart SEO, SearchPie (aplikace)

---

## 15. Analytika a reporting

### 15.1 Home dashboard

- Total sales
- Total orders
- Sessions
- Conversion rate
- Returning customer rate
- Average order value
- Top products, top referrers
- Sales by channel
- Live view (realtime)

### 15.2 Reports (podle tarifu)

**Basic:**

- Finance reporty
- Sales reports
- Acquisition reports
- Inventory reports

**Grow přidává:**

- Behavior reports (sessions, devices)
- Marketing reports
- Customer reports
- Profit reports

**Advanced/Plus přidává:**

- Custom report builder (drag-and-drop)
- Prediktivní hodnoty (LTV forecast, CAC)
- Cohort analysis
- ShopifyQL Notebooks (query language podobný SQL)

### 15.3 ShopifyQL

Vlastní dotazovací jazyk pro analytics – např.:

```
FROM orders
SHOW total_sales
WHERE order_date BETWEEN '2026-01-01' AND '2026-03-31'
GROUP BY product_title
ORDER BY total_sales DESC
LIMIT 10
```

Notebooks umožňují kombinovat texty, dotazy a vizualizace.

### 15.4 Live View

- Mapa s realtime návštěvníky
- Aktivní pokladny
- Total sessions, carts, orders za posledních 10 minut
- Rozlišení mobile vs. desktop
- Traffic sources

### 15.5 Shopify Pixel

- Server-side event tracking
- Integrace s GA4, Meta Pixel, TikTok, Klaviyo
- Consent-aware

### 15.6 Finance summary

- Payouts
- Fees (Shopify, transaction, refund)
- Chargebacks
- Disputes
- Tax collected

### 15.7 Export do BI

- Přímý export CSV
- Webhooks
- API
- Integrace s Looker, Tableau, Power BI (přes aplikace)

---

## 16. AI – Shopify Magic a Sidekick

### 16.1 Shopify Magic (embedded AI features)

Sada AI nástrojů zabudovaných do adminu (všechny zdarma):

**Produktové:**

- Generátor produktových popisů (tón, délka, keywords)
- Generátor produktových tagů z obrázků a popisů
- Generátor alt textů pro obrázky
- AI background removal a image editor
- AI variant generator (z popisu vygeneruje varianty)

**E-mailové:**

- Subject line generator
- Body text writer
- AI suggested send times
- A/B variant generation

**Admin:**

- FAQ generator pro Shopify Inbox
- Response suggestions v Inbox
- Blog post generator
- Page text generator
- Meta description generator

**Theme editor:**

- Text content generator pro bloky
- **Theme block generator** – vygeneruje nový Liquid block z popisu
- Color palette suggestions

### 16.2 Sidekick (AI commerce assistant)

Konverzační AI agent integrovaný do celého adminu:

**Schopnosti (rozšířené Winter '26):**

- Odpovídání na otázky o obchodě („Jak se mi dařilo minulý týden?", „Které produkty nejvíce prodávají v Evropě?")
- Generování ShopifyQL dotazů
- Vytváření slev a kampaní („Vytvoř 20% slevu na všechny batohy na Black Friday")
- Editace tématu („Změň barvu hlavičky na černou")
- Nastavení Shopify Flow automatizace
- Generování reportů
- **Sidekick Pulse** – proaktivní návrhy tailored na váš byznys
- **Sidekick Agent Mode** – plánuje a vykonává vícestupňové úkoly autonomně
- Generace custom aplikací („Postav mi jednoduchou aplikaci, která zobrazí mým zákazníkům nejbližší pobočku")

**Jazyková podpora:** angličtina (plná), němčina, španělština, francouzština, italština, japonština, portugalština (BR), zjednodušená čínština (omezeně)

**Dostupnost:** všechny placené tarify (Basic+)

### 16.3 AI Commerce Channel

Nový sales channel od Winter '26:

- Produkty se automaticky zobrazují v **ChatGPT, Perplexity, Microsoft Copilot, Claude**
- Vlastní schema pro AI crawlery
- Agentic checkout (zákazník nakupuje přímo v chatu)
- 15× nárůst orders z AI mezi 1/2025 a 1/2026

### 16.4 Semantic search

Vnitřní vyhledávání v obchodě využívá embeddings pro sémantické vyhledávání – zákazník může hledat „léto na pláži" a najde plavky, ručníky, deky.

### 16.5 AI recommendations

- Related products
- Complementary products (frequently bought together)
- Recently viewed
- Based on browsing
- Personalized on customer history

### 16.6 Native A/B testing (Winter '26)

Nové: možnost testovat varianty stránek, cen, textů přímo v Shopify – bez aplikací třetích stran.

---

## 17. Shopify POS – prodej v kamenných prodejnách

### 17.1 POS Lite (zdarma, zahrnuto ve všech plánech)

Pro mobile checkout a pop-up prodeje:

- iOS / Android nativní aplikace
- Základní checkout (karty, hotovost, digital wallets)
- Inventory sync
- Customer capture
- Orders v adminu
- Tap to Pay na iPhone / Android
- Receipts (print, e-mail, SMS)

### 17.2 POS Pro – 89 USD/měs. za lokaci

Pokročilé retail funkce:

- **Smart grid** (customizable UI)
- **Save carts** (uložené nákupy s návratem)
- **BOPIS** (Buy Online, Pickup In Store)
- **Ship from store**
- **Exchange** (složité výměny s money difference)
- **Custom discounts** at checkout
- **Role-based staff permissions**
- **Staff sales attribution** (komise)
- **Unlimited registers per location**
- **Custom receipts** (code editor)
- **Clienteling tools** (profily zákazníků, VIP notes)
- **Lookup** přes camera barcode scan
- **Automatic EOD** (end-of-day) cash management
- **Custom line items** (služby, bundle prices)
- **Retail-specific analytics** (per-location)
- **Offline mode** (až 24h bez internetu)

**Prvních 20 POS Pro lokací je pro Plus plán zdarma.**

### 17.3 POS Hardware

Oficiální hardware od Shopify:

**Card Readers:**

- **Shopify Tap & Chip Reader** (~49 USD) – Bluetooth
- **WisePad 3** – multi-payment reader
- **POS Go** – all-in-one handheld device (Android-based)
- **Shopify POS Terminal** (~349 USD) – countertop
- **Shopify POS Terminal Countertop** – Winter '26, s customer display

**Další:**

- Barcode scanners (Socket Mobile)
- Receipt printers (Star Micronics, Epson)
- Cash drawers
- iPad stands
- Label printers (DYMO, Zebra)
- Kitchen printers

### 17.4 POS Go

- Handheld zařízení s vestavěnou čtečkou karet, skenerem, tiskárnou receiptů
- Android OS
- LTE + Wi-Fi
- Od 399 USD

### 17.5 Offline mode

- Prodej funguje bez internetu až 24h
- Orders se synchronizují při obnovení spojení
- Inventory reservation lokálně

### 17.6 Clienteling

- Profily zákazníků s útratovými daty
- Wishlists
- Previous purchases recall
- VIP tags
- Personal shopper notes
- Text/e-mail customer directly from POS

### 17.7 Retail Loyalty

- Zákazníci využívají stejný Shop účet online i v POS
- Body se načítají napříč kanály
- Gift cards napříč kanály

---

## 18. Shopify B2B a Wholesale

### 18.1 Dostupnost

- Do roku 2024 jen na **Shopify Plus**
- Od 2026: **B2B na Grow** (3 katalogy, základní funkce), **Advanced a Plus** plné B2B

### 18.2 Company profiles

- Korporátní účet (jméno společnosti)
- Více kontaktů (buyers) přiřazených k jedné firmě
- Role a oprávnění na úrovni buyer (ordering only, admin, location manager)
- Více lokací (shipping adress) na jednu firmu
- Tax exempt status
- Default payment method

### 18.3 Catalogs (Price lists)

- Neomezený počet katalogů (Plus); 3 na Grow
- Custom ceny per produkt / variant
- Fixed price nebo % discount
- Volume pricing (tiered)
- Assign catalog to company / company location
- Publish / unpublish per market

### 18.4 B2B checkout

- **Payment terms** (Net 7, 14, 30, 60, 90)
- **Purchase order (PO) number field**
- **Automatic tax exemption** (pokud firma má VAT ID)
- **Approval workflows** (přes Functions nebo aplikace)
- **Minimum order quantity** (MOQ)
- **Maximum quantity**
- **Quantity increments** (násobky kartonů)
- **Draft orders jako quotes** (obchodník posílá nabídku)
- **Deferred payment** (platba po fakturaci)
- **Order submissions** (buyer zadá, admin schválí a pošle k platbě)

### 18.5 B2B customer experience

- **Passwordless login** (nové customer accounts povinné)
- **Company dashboard** v účtu
- **Reorder** (1-click)
- **Order history** napříč celou firmou
- **Invoice download** (PDF)
- **Shopping lists**
- **Buyer impersonation** (sales rep může nakupovat jménem zákazníka)

### 18.6 B2B automatizace

Shopify Flow pro B2B:

- Tag high-value companies
- Auto-approve orders pod prahem
- Notifikace při nových registracích
- Kreditní limity
- Suspended accounts

### 18.7 Sales rep tools

- Staff může prohlížet obchod jménem firmy
- Place orders na buyer's account
- Sledování provizí (přes aplikace)

### 18.8 Trade téma

Oficiální Shopify téma optimalizované pro B2B:

- Kompaktní list-style navigace
- Bulk ordering UI (qty per variant v řádku)
- Clean reorder-driven layout
- Zdarma

---

## 19. Shopify Markets – mezinárodní prodej

### 19.1 Markets overview

Centrální hub pro cross-border commerce:

- **Primary market** (výchozí země)
- **Additional markets** (regionální nebo per-country)
- **International market** (default catch-all)
- **Countries/regions you don't sell to** (nelze smazat)

### 19.2 Per-market customizace

- **Domain / subdomain / subfolder** (`shop.com`, `de.shop.com`, `shop.com/de`)
- **Currency** (fixed nebo auto-conversion)
- **Language**
- **Product availability** (které produkty jsou kde k mání)
- **Pricing** (manuál, auto-conversion, markup %)
- **Tax settings**
- **Payment methods**
- **Shipping zones**
- **Custom checkout**

### 19.3 Multi-currency

- **133+ měn** podporováno (přes Shopify Payments)
- Auto-conversion na základě exchange rate (XE.com)
- Manual pricing per currency
- Rounding rules (na 0,99, 9,00 atd.)
- Currency selector v tématu

### 19.4 Multi-language

- **Translate & Adapt** app od Shopify (zdarma, AI + manuální)
- Localized pricing per language
- hreflang tagy automaticky
- Language selector

### 19.5 Geolocation

- Shopify Geolocation app (zdarma)
- Doporučení trhu v popupu
- Auto-redirect (volitelné)
- IP-based detection (GeoIP)
- Browser language fallback

### 19.6 Managed Markets (Plus, USA)

- Partnerství s **Global-e**
- Shopify spravuje:
  - Cla a daně (DDP)
  - Mezinárodní doprava
  - Lokální platební metody (Alipay, WeChat Pay, Sofort, iDEAL…)
  - Vratky z cross-border objednávek
  - Compliance
- Obchodník dostává USD bez starostí

### 19.7 Cross-border features

- Duties calculation
- Harmonized System codes na produktech
- Country of origin
- Landed cost display
- Restricted countries
- Customs declaration

### 19.8 Markets Pro

Rozšířená služba (pouze USA):

- Merchant of record (Shopify fakturuje zákazníkovi)
- Tax, customs, fraud – Shopify přebírá rizika
- Lokální placení

---

## 20. Shopify Plus – enterprise funkce

### 20.1 Expansion Stores

- Až **9 dodatečných obchodů** pod jednou Plus smlouvou
- Každý má vlastní doménu, téma, apps, payments
- Centrální management přes Organization Admin
- Ideální pro: regionální značky (DE, US, UK), B2B vs. D2C, více značek pod jednou skupinou

### 20.2 Organization Admin

- Single sign-on pro vlastníka
- Unified billing
- Staff permissions napříč obchody
- Consolidated analytics

### 20.3 Checkout Extensibility (plná)

- **Checkout UI Extensions**
- **Checkout Functions**
- **Checkout Blocks** (no-code)
- **Thank-you page**
- **Order status page**
- **Post-purchase offers**
- Plná kontrola nad CSS, layoutem, flow

### 20.4 Shopify Functions

Server-side TypeScript/Rust code, který běží v Shopify infrastruktuře:

- **Product discount function**
- **Order discount function**
- **Shipping discount function**
- **Delivery customization function** (hide/rename methods)
- **Payment customization function**
- **Cart and Checkout Validation**
- **Cart Transform** (bundle, split, merge)
- **Fulfillment Constraints**
- **Order Routing**
- **Cart Scale Transform**
- **Local pickup delivery option generator**
- **Pickup point delivery option generator**

Max. 5 ms CPU time per request. Napsané jako WebAssembly moduly.

### 20.5 Launchpad

Plánovač akcí pro časově omezené kampaně:

- Scheduled theme changes
- Product publishing
- Discount activation
- Script activation
- Inventory changes
- Reporting za kampaň
- Ideální pro: Black Friday, flash sale, product launch

### 20.6 Shopify Flow

Workflow automation:

- **Triggers** (new order, customer created, inventory low, product updated, cart abandoned, refund…)
- **Conditions** (if/else, multiple branches)
- **Actions** (add tag, send e-mail, update product, call webhook, run custom code)
- Pre-built templates (100+)
- Integrace s externími službami (Slack, Zapier, Google Sheets)
- Flow history & logging

### 20.7 Shopify Scripts (legacy)

Původní skriptovací systém (Ruby) pro checkout customization. **Končí v srpnu 2024**, nahrazeny Functions. V roce 2026 už jen v legacy obchodech.

### 20.8 Wholesale Channel (legacy)

Starý B2B kanál, nahrazen nativním B2B od 2022. Plně funkční, postupně deprecovaný.

### 20.9 API limits (Plus)

- **Admin API:** 1 000 call/s (standard: 40 call/s)
- **Storefront API:** neomezený
- **Bulk Operations API:** pro velké dávkové operace
- **GraphQL cost points:** 20 000/s (standard: 1 000/s)

### 20.10 Priority support

- **24/7 phone support** s 15minutovým SLA
- **Merchant Success Manager** (strategický partner)
- **Launch Engineer** při migracii
- **Priority app review**

### 20.11 Shopify Plus Academy

- Certifikace pro partnery
- Exkluzivní webináře
- Early access k novým funkcím

### 20.12 Shopify Plus Partners

Síť agentur, SI a technologických partnerů prověřených Shopify.

---

## 21. Automatizace – Shopify Flow, Launchpad

### 21.1 Shopify Flow – triggery (výběr)

- **Order:** created, paid, fulfilled, cancelled, refunded, risk changed
- **Customer:** created, account enabled, tagged, subscribed
- **Product:** created, updated, deleted, out of stock, low stock
- **Cart:** abandoned
- **Inventory:** quantity changed, out of stock
- **Draft order:** created, completed
- **Fulfillment:** created, updated
- **Metafield:** value updated
- **Subscription:** created, cancelled (přes aplikace)

### 21.2 Flow – akce

- Tag / untag
- Send Slack / Microsoft Teams message
- Send HTTP request (webhook)
- Send e-mail
- Add to segment
- Capture payment
- Cancel order
- Fulfill order
- Create draft order
- Update product / variant
- Update inventory
- Send customer account invite
- Custom actions (app-defined)

### 21.3 Použití Flow

- Flag podezřelé objednávky (risk = high → tag → e-mail admin)
- VIP program (objednávka > 500 USD → tag VIP)
- Preorder logistika (produkt „coming soon" → email při naskladnění)
- B2B auto-tagging
- Restock waitlist notifications
- Automatické refund pro fraud orders

### 21.4 Launchpad pro flash sale

Příklad scénáře:

1. 23:59 – theme swap na „Black Friday" téma
2. 00:00 – aktivace discount code
3. 00:00 – publish Black Friday kolekce
4. 06:00 – SMS kampaň (přes aplikaci)
5. 23:59 následujícího dne – deaktivace slevy, návrat theme

---

## 22. Developer platforma – API, Functions, Hydrogen, Oxygen

### 22.1 Admin API (GraphQL + REST)

**GraphQL (doporučeno):**

- Endpoint: `https://{shop}.myshopify.com/admin/api/2026-01/graphql.json`
- Zdroje: Products, Orders, Customers, Collections, Inventory, Metafields, Discounts, Fulfillments, Locations, Markets, Apps…
- Rate limits: cost-based (1 000 points / s standard, 20 000 Plus)

**REST:**

- Legacy, postupně deprecovaný
- Rate limit: 2 calls/s (standard), 20 calls/s (Plus)

### 22.2 Storefront API

Pro frontend aplikace (Hydrogen, custom React apps, mobile):

- Public token (client-safe)
- Product data, collections, cart, checkout
- Search, predictive search
- Languages, markets

### 22.3 Customer Account API

Pro customer-facing funkce:

- Přihlášení, registrace
- Historie objednávek
- Subscription management
- Returns

### 22.4 Partner API

Pro tvůrce aplikací:

- App installs statistics
- Revenue reports
- Dispute handling

### 22.5 Shopify Functions

Server-side výpočty v izolovaném WebAssembly sandboxu:

- Jazyky: JavaScript, TypeScript, Rust
- Max. 5ms CPU / call
- Běh na Shopify infrastruktuře – milisekundová latence
- Deployment přes Shopify CLI

### 22.6 Hydrogen

React-based framework pro headless storefronty:

- Postavený na **React Router** (dříve Remix)
- **Server Components** (RSC)
- Optimalizovaný pro Oxygen
- Built-in Shopify Storefront API klient
- Pre-built commerce komponenty (Cart, Shop Pay, Analytics)
- Type-safe s TypeScriptem
- CLI pro scaffolding
- Demo Store a Hello World templates

### 22.7 Oxygen

Hosting platforma pro Hydrogen (zdarma u placených plánů):

- Cloudflare Workers-based (workerd runtime)
- **V8 isolates** – globální distribuce
- **Full-page cache**
- **Built-in bot mitigation**
- **Colocated se Shopify infrastructure** (API calls jsou lokální)
- Logs retained 72h
- Nepodporuje: Node.js-only API, proxies, monorepos, více buildů per store

### 22.8 Shopify CLI

Command-line tool:

- `shopify theme dev` – live preview theme
- `shopify app dev` – local app development
- `shopify hydrogen dev`
- `shopify extension create`
- Theme check (linting)
- Deploy, version

### 22.9 Shopify App Extensions

Způsoby, jak aplikace rozšiřují Shopify:

- **Admin UI Extensions** – komponenty v adminu (produkt, order detail)
- **Theme app extensions** – app blocks v tématu
- **Checkout UI Extensions**
- **Customer Account UI Extensions**
- **POS UI Extensions**
- **Functions**
- **Flow Actions & Triggers**
- **Marketing Activities**
- **Subscription APIs**
- **Payment Apps** (vlastní platební brány)
- **Shipping Apps** (vlastní carriers)
- **Fulfillment Apps** (3PL, dropshipping)

### 22.10 Webhooks

40+ topiků:

- orders/create, orders/updated, orders/paid, orders/cancelled, orders/fulfilled
- products/create, products/update
- customers/create, customers/update
- fulfillments/create, fulfillments/update
- app/uninstalled
- checkouts/create, checkouts/update
- inventory_levels/update
- refunds/create
- shop/update
- GDPR topics: customers/redact, customers/data_request, shop/redact

HMAC verification, retry logic (19 retries přes 48 hodin).

### 22.11 Dev Tools

- **Shopify Partners Dashboard**
- **Development stores** (unlimited, free)
- **Shopify App Bridge** (React library pro embedded apps)
- **Polaris** (design system – komponenty pro admin apps)
- **Liquid Ninja** (linting, testing)
- **GraphiQL App** pro testování dotazů

### 22.12 API verzování

- Verze release každé 3 měsíce (leden, duben, červenec, říjen)
- Každá verze supported 12 měsíců
- Deprecation warnings v odpovědích
- CalVer (např. `2026-01`, `2026-04`)

---

## 23. App Store a ekosystém aplikací

### 23.1 Přehled

- **8 000+ aplikací** v Shopify App Store
- Kategorie: marketing, sales channels, sklady, doprava, customer service, věrnost, reporting, finance, dropshipping, sourcing…
- Pricing modely: free, subscription, usage-based, one-time, revenue share

### 23.2 Must-have kategorie aplikací

**Reviews:**

- Judge.me, Loox, Yotpo, Stamped.io, Okendo

**Email & SMS:**

- Klaviyo, Omnisend, Mailchimp, Attentive, Postscript

**Subscriptions:**

- Recharge, Bold Subscriptions, Appstle, Subscripify, Seal Subscriptions

**Věrnostní programy:**

- Smile.io, LoyaltyLion, Yotpo Loyalty, Rise.ai (gift cards & store credit)

**Upsell / Cross-sell:**

- ReConvert, Zipify OCU, Honeycomb, Candy Rack

**Page builders:**

- PageFly, GemPages, Shogun, Zipify Pages

**Search & Filter:**

- Searchanise, Boost AI Search, Algolia, Fast Simon

**Shipping & tracking:**

- AfterShip, ShipStation, ShippingEasy, 17track, ParcelPanel

**Dropshipping:**

- DSers, Spocket, Zendrop, Printful, Printify, Gelato

**Accounting:**

- QuickBooks, Xero, Bench

**SEO:**

- Smart SEO, SearchPie, SEO King, Plug In SEO

**Bundles:**

- Shopify Bundles (nativní), Bundler, Fast Bundle

**Inventory:**

- Stocky, Katana, Cin7, DEAR, Linnworks

**Customer service:**

- Gorgias, Tidio, Zendesk, Re:amaze

**Analytics:**

- Triple Whale, Polar Analytics, Littledata, Glew, Lifetimely

**Checkout:**

- Rebuy, Slide Cart, Checkout Blocks

**B2B:**

- SparkLayer, Wholesale Club, B2B/Wholesale Solution (BSS)

### 23.3 Shopify-made apps (zdarma)

- Shopify Email
- Shopify Inbox
- Shopify Collabs
- Shop Channel
- Shopify Forms
- Shopify Marketplace Connect (Amazon, eBay, Walmart)
- Shopify Bundles
- Translate & Adapt
- Search & Discovery
- Shopify Flow
- Shopify Shipping (kde dostupné)
- Geolocation
- Audiences (Plus)
- Markets Pro
- Order Printer

### 23.4 Custom apps

- **Custom apps** (per-shop, development)
- **Public apps** (na App Store)
- **Private apps** (legacy, končí)
- **App Store review** (typicky 5–10 pracovních dní)

### 23.5 App Bridge

React knihovna pro integraci aplikací do adminu:

- Embedded UI (iframe v adminu)
- Shared session tokens
- Polaris komponenty
- Navigation
- Toast notifications
- Modal, ResourcePicker, ContextualSaveBar

---

## 24. Bezpečnost, compliance a infrastruktura

### 24.1 Infrastruktura

- **Hosted on Google Cloud Platform + vlastní data centers**
- **Globální CDN (Fastly)**
- **DDoS protection**
- **99,9% uptime SLA**
- **Automatické aktualizace**
- **Daily backups**
- **Dedikované edge nodes**

### 24.2 Platební bezpečnost

- **PCI DSS Level 1** (nejvyšší level)
- **3D Secure 2** (silná autentizace v EU)
- **Fraud analysis** (built-in machine learning)
- **Shopify Protect** (chargeback protection)
- **Card tokenization**

### 24.3 Account bezpečnost

- **Two-factor authentication** (SMS, authenticator app, security keys FIDO2)
- **SSO** (SAML na Plus)
- **Staff permissions** (granulární práva)
- **IP restrictions** (Plus, přes aplikace)
- **Audit logs** (Plus – store activity log)
- **Session management**
- **Passwordless customer accounts**

### 24.4 Data privacy

- **GDPR compliant**
- **CCPA compliant**
- **LGPD (Brazílie)**
- **PIPEDA (Kanada)**
- **APPI (Japonsko)**
- Customer privacy API pro cookie consent
- Right to erasure (automaticky přes webhooks)
- Data residency (EU customers data in EU – Plus)

### 24.5 Certifikace

- ISO 27001
- SOC 2 Type II
- SOC 3
- PCI DSS Level 1
- HIPAA-ready

### 24.6 Bug bounty

Shopify provozuje veřejný bug bounty program na HackerOne.

### 24.7 Shopify Trust Center

- Realtime status page: status.shopify.com
- Incident history
- Compliance dokumenty
- SOC 2 reports (na vyžádání)

---

## 25. Podpora, vzdělávání a služby

### 25.1 Support tiers

| Plán     | Support                                             |
| -------- | --------------------------------------------------- |
| Starter  | E-mail, chat (omezený)                              |
| Basic    | 24/7 chat                                           |
| Grow     | 24/7 chat, e-mail                                   |
| Advanced | 24/7 chat, e-mail, priority                         |
| Plus     | Priority phone 24/7, dedicated MSM, Launch Engineer |

### 25.2 Help Center

- **help.shopify.com** – stovky článků
- Video tutoriály
- Searchable knowledge base
- Community forum (10M+ členů)

### 25.3 Shopify Academy

- Zdarma kurzy
- Certifikace pro partnery
- Merchant-oriented kurzy (SEO, ads, email)
- Video on-demand

### 25.4 Shopify Compass

- Step-by-step workflows
- Recommended strategies
- Zaměřeno na začátečníky

### 25.5 Shopify Experts marketplace

- Ověření freelanceři a agentury
- Kategorie: design, development, marketing, SEO, photography, copywriting, translation
- Ratings a recenze

### 25.6 Shopify Partners program

- Pro agentury a developery
- Revenue share (20 % z Shopify subscription + 20 % z apps po 12 měsíců)
- Partner Academy
- Preview environments

### 25.7 Shopify Plus Academy

Exkluzivní vzdělávání pro Plus merchants a agentury.

### 25.8 Shopify Editions

2× ročně (zima, léto) – veřejná showcase nových funkcí. Vysíláno online, doprovodná web experience.

### 25.9 Unite

Vývojářská konference Shopify.

---

## 26. Shopify Editions – roadmapa a novinky

### 26.1 Winter '26 Edition („RenAIssance")

Vydáno 20. ledna 2026 – **150+ novinek**. Nejdůležitější:

**AI a Sidekick:**

- **Sidekick Pulse** – proaktivní insights
- **Sidekick Agent Mode** – vícekrokové úkoly
- Sidekick staví aplikace, flows, theme změny
- AI Commerce Channel (ChatGPT, Perplexity, Copilot)

**Checkout:**

- Checkout Blocks nyní i na Basic+ (dříve jen Plus)
- Customer Account extensions (40+ partner apps)

**B2B:**

- B2B na Grow plánu (3 katalogy)
- Rozšířené na Advanced plně
- 42 B2B funkcí vestavěných

**A/B testing:**

- Nativní A/B testy bez aplikací třetích stran

**Ostatní:**

- Shopify Bundles 2.0
- Managed Markets v Evropě
- Hydrogen 3.0
- POS Terminal s customer display

### 26.2 Starší editions (highlights)

- **Summer '25 ("Horizon"):** AI theme generátor (Horizon téma postavené od základů pro AI generování bloků)
- **Winter '25:** Checkout Extensibility povinné
- **Summer '24:** Shop Pay pro POS
- **Winter '24:** Unified checkout on one page

### 26.3 Co se očekává v Summer '26

Podle Shopify náznaků:

- Rozšířené AI subscriptions
- Další agentic commerce funkce
- Rozšíření Managed Markets
- Vyšší inventory accuracy tools
- Více POS features

---

## 27. Známá omezení a nevýhody

Pro úplnost – ne všechno je růžové:

### 27.1 Technická omezení

- **Max. 100 variant** (nebo 2 000 s aplikací)
- **Max. 3 product options** nativně
- **25 sekcí per template**
- **1 250 bloků per template**
- Liquid má pomalejší renderování u komplexních šablon
- API rate limits u standardních plánů (40 calls/s)

### 27.2 Finanční aspekty

- **Transaction fees** pro třetí strany (pokud nepoužijete Shopify Payments)
- **Shopify Payments** není dostupný v ČR (a mnoha dalších zemích)
- Měsíční poplatky za aplikace se rychle sčítají
- Cena Plus vyšší než některá enterprise řešení

### 27.3 Customizace

- Bez Plus omezená customizace checkoutu
- Liquid nemá zdaleka moc backendu
- Omezené reporting bez custom řešení
- Multi-store management jen na Plus

### 27.4 Lock-in

- Těžká migrace pryč (unikátní Liquid struktura)
- Shopify Payments lock-in (opustíte = platíte transaction fees)
- Hydrogen optimalizován pouze pro Oxygen

### 27.5 Specifika pro ČR

- Chybí nativní integrace na **Zásilkovnu, Českou poštu, PPL** bez aplikací třetích stran
- Chybí **EET/EESR** napojení (nutné přes aplikace)
- Chybí **ARES** validace IČO
- Účetní systémy (Pohoda, Money S3, FlexiBee) jen přes aplikace
- **ComGate, GoPay, ThePay** přes aplikace (bez Shopify Payments)
- Jazyková lokalizace CZ/SK je dobrá, ale některá menší UI místa zůstávají v angličtině

---

## Závěr

Shopify v roce 2026 představuje **nejkompletnější e-commerce platformu na světě** pokud jde o:

- Šířku funkcí od Starter (5 USD) až po Plus enterprise (2 300+ USD)
- Hloubku nástrojů v každé doméně (produkty, zásoby, marketing, POS, B2B, mezinárodní)
- Největší ekosystém aplikací (8 000+)
- Moderní AI integrace (Sidekick + Magic)
- Nejrychlejší konvertující checkout (Shop Pay)
- Vyspělou developer platformu (Hydrogen, Oxygen, Functions, GraphQL API)
- Enterprise škálovatelnost (14,6 mld. USD za BFCM 2025)
- Compliance a bezpečnost na úrovni světových standardů

**Pro koho se hodí:**

- Začínající e-shopy (Basic)
- Rostoucí značky (Grow, Advanced)
- Enterprise D2C (Plus)
- B2B wholesale (Plus / Advanced)
- Retail s kamennými prodejnami (POS)
- Mezinárodní značky (Markets, Managed Markets)

**Pro koho méně:**

- Extrémně specifické lokální potřeby bez kvalitní aplikace (některé specifikem ČR)
- Obchody s miliony SKU a komplexní B2B bez standardních vzorců (tam může být Magento / Sylius lepší)
- Organizace preferující self-hosted open-source řešení

---

_Dokument sestaven na základě veřejně dostupné dokumentace Shopify, Help Center, Shopify.dev, Shopify Editions a analýz nezávislých partnerů (Ask Phill, On Tap Group, Kensium, Fyresite, BSS Commerce, Elogic, Ecommerce Pro, Latori, Makro Agency, Mobiloud a další) – duben 2026._
