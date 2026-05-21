# Wix (Wix Stores / Wix eCommerce) – Kompletní hloubková analýza všech funkcí, modulů a featur

> **Stav:** duben 2026 (zahrnuty Wix Harmony z 21. 1. 2026, Catalog V3, nové plány Light/Core/Business/Business Elite)
> **Rozsah:** celá platforma Wix – Editor, ADI, Studio, Velo, Wix Stores, Wix Payments, POS, Bookings, Events, Restaurants, Hotels, Blog, Members, Marketing, AI, developer tooling
> **Zdroje:** oficiální Wix Help Center, dev.wix.com, Wix App Market, produktové stránky a nezávislé analýzy

---

## Obsah

1. [Co je Wix a firemní kontext](#1-co-je-wix-a-firemní-kontext)
2. [Rozdíl Wix vs. Wix Stores vs. Wix Studio](#2-rozdíl-wix-vs-wix-stores-vs-wix-studio)
3. [Tarify a cenové plány](#3-tarify-a-cenové-plány)
4. [Wix Editor – vizuální tvorba webu](#4-wix-editor--vizuální-tvorba-webu)
5. [Wix Dashboard – administrace](#5-wix-dashboard--administrace)
6. [Wix Stores – produkty a katalog](#6-wix-stores--produkty-a-katalog)
7. [Sklad a inventory management](#7-sklad-a-inventory-management)
8. [Objednávky a fulfillment](#8-objednávky-a-fulfillment)
9. [Zákazníci a Members Area](#9-zákazníci-a-members-area)
10. [Checkout, Wix Payments a platby](#10-checkout-wix-payments-a-platby)
11. [Doprava a dodání](#11-doprava-a-dodání)
12. [Daně a compliance](#12-daně-a-compliance)
13. [Mezinárodní prodej a Multi-currency](#13-mezinárodní-prodej-a-multi-currency)
14. [Marketing a prodejní kanály](#14-marketing-a-prodejní-kanály)
15. [Slevy, kupóny a věrnostní programy](#15-slevy-kupóny-a-věrnostní-programy)
16. [SEO a obsah](#16-seo-a-obsah)
17. [Analytika a reporting](#17-analytika-a-reporting)
18. [AI – Wix Astro, Harmony, Vibe](#18-ai--wix-astro-harmony-vibe)
19. [Wix POS – prodej v kamenných prodejnách](#19-wix-pos--prodej-v-kamenných-prodejnách)
20. [Wix Bookings – rezervace služeb](#20-wix-bookings--rezervace-služeb)
21. [Wix Events – akce a ticketing](#21-wix-events--akce-a-ticketing)
22. [Wix Restaurants](#22-wix-restaurants)
23. [Wix Hotels by HotelRunner](#23-wix-hotels-by-hotelrunner)
24. [Wix Blog a komunitní nástroje](#24-wix-blog-a-komunitní-nástroje)
25. [Wix Studio – profesionální platforma](#25-wix-studio--profesionální-platforma)
26. [Developer platforma – Velo, SDK, API, Headless](#26-developer-platforma--velo-sdk-api-headless)
27. [Wix App Market](#27-wix-app-market)
28. [Bezpečnost, hosting a infrastruktura](#28-bezpečnost-hosting-a-infrastruktura)
29. [Podpora a vzdělávání](#29-podpora-a-vzdělávání)
30. [Známá omezení a nevýhody](#30-známá-omezení-a-nevýhody)

---

## 1. Co je Wix a firemní kontext

Wix.com Ltd. je izraelská SaaS společnost založená v roce 2006 (Avishai Abrahami, Nadav Abrahami, Giora Kaplan), sídlo Tel Aviv. Veřejně obchodovaná na NASDAQ (tickr: **WIX**).

**Klíčová čísla (2026):**
- Přes **300 milionů** registrovaných uživatelů celosvětově
- Přes **700 000** aktivních e-shopů (Wix Stores)
- Globální podíl ve website builderech: ~17,8 %
- V USA ~20,8 % podíl na e-commerce platformách (druhé místo za Shopify)
- Kancelářové centrály: Tel Aviv, New York, San Francisco, Dublin, Berlín, Kyjev, Vilnius, Vancouver, Buenos Aires
- 5 000+ zaměstnanců

**Klíčové vlastnosti:**
- Drag-and-drop vizuální editor s absolutní volností (žádný grid)
- Vše v jednom – hosting, doména, SSL, e-mail, CRM, e-shop, rezervace, restaurace, POS
- 2 500+ šablon
- Silná AI integrace od 2016 (Astro, Harmony, Vibe, Base44)
- Globální CDN, multi-cloud hosting
- Velo – developer platforma s JavaScriptem
- Wix Studio – profesionální varianta pro agentury
- POS hardware ve spolupráci s HP a Stripe (USA, Kanada)

**Pozicování Wix vs. konkurence:**
- Jednodušší a designově flexibilnější než Shopify
- Více všestranné než Squarespace (víc funkcí nad rámec webu)
- Pro e-shopy menší než Shopify, ale lepší pro kombinaci webu + rezervací + e-shopu
- Dominantní u startujících podnikatelů a kreativců

---

## 2. Rozdíl Wix vs. Wix Stores vs. Wix Studio

**Terminologie je trochu matoucí, proto na úvod:**

- **Wix** = celá platforma / firma / website builder
- **Wix Stores** = e-commerce modul (aplikace) uvnitř Wixu, která přidává funkce online obchodu
- **Wix eCommerce** = marketingové označení celé e-commerce nabídky (Wix Stores + POS + Payments + Bookings + ...)
- **Wix Studio** = profesionální verze platformy cílená na agentury, freelancery a designéry; má pokročilejší editor, responzivní grid, real-time collaboration
- **Wix ADI** (původní AI Design Intelligence) – legacy AI nástroj, nahrazen Astro/Harmony
- **Wix Harmony** = nový AI website builder (leden 2026)
- **Wix Vibe** = headless AI developer environment (Astro + React + GitHub)
- **Wix Base44** = AI app builder (ne website builder)
- **Velo by Wix** = vývojářská platforma (dříve Corvid)
- **Wix Headless** = headless CMS varianta s vlastním frontendem

Tento dokument pokrývá **celou platformu Wix s důrazem na e-commerce (Wix Stores)**.

---

## 3. Tarify a cenové plány

Wix kompletně přestrukturoval plány v roce 2025. Aktuálně má **5 hlavních úrovní**: Free, Light, Core, Business, Business Elite + Enterprise.

### 3.1 Wix Free – 0 USD/měs.

- Plný přístup k editoru a šablonám
- Wix reklamy na stránkách (banner nahoře a dole)
- Wix subdoména (např. `uzivatel.wixsite.com/nazev`)
- Bez vlastní domény
- **Nelze prodávat** (platby jsou zablokované)
- Omezený storage (~500 MB)
- Bandwidth (~500 MB/měs.)
- Dobré pro: testování, učení, osobní stránky

### 3.2 Wix Light – 17 USD/měs. (roční)

- Odstraněny Wix reklamy
- Vlastní doména (zdarma 1. rok)
- 2 GB storage, 30 min video
- **Stále nelze prodávat online** (není e-shop)
- Základní marketing suite (Light)
- Dobré pro: osobní weby, portfolia, blogy

### 3.3 Wix Core – 29 USD/měs.

**Nejlevnější plán s e-shopem** – sem patří Wix Stores v základu.

- Všechno z Light
- **Wix Stores aktivní** (online obchod)
- 50 GB storage
- 5 GB video
- **5 collaborators**
- Basic marketing suite
- Zero platform fees (jen procesingové poplatky Wix Payments)
- Základní analytics
- Accept payments, prodej přes Wix Payments, Stripe, PayPal
- Wix Bookings (omezeně)
- Dobré pro: malé a začínající e-shopy, drobné podnikatele

### 3.4 Wix Business – 36–39 USD/měs.

- Všechno z Core
- 100 GB storage, 10 GB video
- **10 collaborators**
- Standard marketing suite
- **Automatické tax calculation** (až 100 transakcí / měs.)
- **Dropshipping** (integrace)
- **Multi-currency** (Business+)
- Advanced shipping options (carrier-calculated)
- Subscriptions (prodávání předplatného)
- Wix Analytics Standard
- Dobré pro: rostoucí e-shopy se zahraničními zákazníky

### 3.5 Wix Business Elite – 159–172 USD/měs.

- Všechno z Business
- **Neomezený storage**
- Neomezené video
- **100 collaborators**
- Advanced marketing suite
- Priority support
- Customized reports
- Advanced e-commerce features
- Scheduling tools
- Developer tools (Velo plně)
- Dobré pro: velké obchody, agentury, enterprise segment

### 3.6 Wix Enterprise – od 500 USD/měs. (individuální)

- Dedicated account manager
- SLA 99,98 %
- Advanced permissions
- SSO (Single Sign-On)
- Audit logs
- Priority phone support 24/7
- Advanced security (penetration testing, custom compliance)
- Velké marketingové balíčky

### 3.7 Processing fees (Wix Payments)

| Transakce | Poplatek |
|---|---|
| Domácí karta (USA) | 2,9 % + 0,30 USD |
| AmEx | 3,5 % + 0,30 USD |
| Cross-border | +1 % |
| Currency conversion | +1 % |
| Chargeback | 15 USD |

**Wix neúčtuje platform transaction fees** jako Shopify (u základního plánu). Jen procesingové poplatky brány.

### 3.8 Srovnávací tabulka plánů (e-commerce relevantní)

| Funkce | Light | Core | Business | Business Elite |
|---|---|---|---|---|
| Cena (roční) USD | 17 | 29 | 36 | 159 |
| E-shop (Wix Stores) | ❌ | ✅ | ✅ | ✅ |
| Storage | 2 GB | 50 GB | 100 GB | neomezeně |
| Collaborators | – | 5 | 10 | 100 |
| Auto tax calc. | ❌ | ❌ | ✅ (100/měs) | ✅ |
| Multi-currency | ❌ | ❌ | ✅ | ✅ |
| Subscriptions | ❌ | ❌ | ✅ | ✅ |
| Dropshipping | ❌ | ❌ | ✅ | ✅ |
| Priority support | ❌ | ❌ | ❌ | ✅ |
| Custom reports | ❌ | ❌ | ❌ | ✅ |
| Velo Dev Mode | ✅ | ✅ | ✅ | ✅ plné |

### 3.9 Skryté náklady

- **Obnovení domény po 1. roce:** 14,95–17,79 USD/rok
- **Premium aplikace z App Marketu:** 3–20 USD/měs.
- **Profesionální e-mail (Google Workspace):** 6 USD/uživatel/měs.
- **POS hardware:** 499–1 499 USD
- **Velo databáze:** dodatečné storage limity
- **Custom šablony od designérů:** 200–2 000 USD

---

## 4. Wix Editor – vizuální tvorba webu

Wix má **jedinečnou drag-and-drop volnost** – na rozdíl od Shopify (tématicky vázaný Liquid) a Squarespace (grid-based). Můžete umístit jakýkoliv prvek kamkoliv na stránce.

### 4.1 Editory (více variant)

**Wix Editor (klasický):**
- Pixel-level freedom (volné umístění)
- Drag-and-drop
- 2 500+ šablon
- Mobilní verze se generuje automaticky (s možností manuální úpravy)
- **Pozor:** šablonu nelze po zvolení měnit bez přestavby webu

**Wix Studio Editor (nový, profesionální):**
- Responsive grid
- Real-time collaboration (více uživatelů najednou)
- Re-usable components (master sekce)
- Breakpoints (custom pro každý screen size)
- CSS grid layouts
- Advanced animations
- Agency-focused features

**Wix ADI (Artificial Design Intelligence):**
- Legacy, stále dostupný
- Konverzační vytváření webu (odpoví na otázky)
- Omezená customizace po vygenerování

**Wix Harmony (leden 2026):**
- Nejnovější AI builder
- Generuje kompletní web z textu
- Kombinuje AI rychlost s manuální úpravou
- Postaven na novém SDK

**Wix Vibe:**
- Pro vývojáře
- Astro + React + GitHub
- Headless workflow

### 4.2 Šablony

- **2 500+ šablon** napříč kategoriemi
- Kategorie: Business, Online Store, Photography, Music, Restaurants, Blog, Events, Portfolio, Beauty & Wellness, Fashion, Health, Real Estate, Technology, Education, Non-profit
- Speciálně pro e-commerce: 900+ šablon
- Free i premium
- **Šablonu nelze změnit po zveřejnění** (nutné začít znovu nebo ruční migrace)

### 4.3 Design prvky

**Textové elementy:**
- Nadpisy (H1-H6)
- Paragrafy
- Collapsible text
- Typewriter effects
- Vertical text
- Custom CSS přes Velo

**Obrázky a media:**
- Fotogalerie (20+ typů – grid, slideshow, masonry, Pinterest-style)
- Lightbox
- Image hover effects
- SVG podpora
- WebP, automatická optimalizace
- Video Wix (hosted), YouTube, Vimeo embed
- 360° fotky
- Stock photos (Wix knihovna + Unsplash + Shutterstock integrace)

**Tvary a grafika:**
- Shapes (100+)
- Lines, arrows
- Icons (knihovna)
- Vector art
- Decorative elements

**Interaktivní elementy:**
- Buttons (100+ stylů)
- Hover animations
- Page transitions
- Parallax scrolling
- Sticky elements
- Strip
- Columns
- Boxes
- Grids

**Forms & inputs:**
- Contact forms
- Subscribe forms
- Quote requests
- Custom forms (Wix Forms)
- Advanced fields (file upload, signature, conditional logic)

**Menu:**
- Horizontal, vertical, mega menu
- Mobile hamburger
- Anchor menu
- Multi-level dropdowns

**Dynamic pages:**
- Collection-driven pages (z databáze Velo)
- Dynamic URL patterns
- Filtrované seznamy

### 4.4 Animace a efekty

- 30+ animací vstupu (fade, slide, zoom, bounce)
- Scroll-triggered animations
- Hover effects
- Lightboxes
- Video backgrounds
- Sticky scroll

### 4.5 Mobile editor

- Oddělený mobile view
- Hidden elements pro mobile
- Mobile-only elements
- Mobile action bar (rychlá CTA na mobilu)
- Quick action buttons (call, map, email)
- Mobilní menu

### 4.6 Breakpoints (Wix Studio)

Ve Wix Studio lze definovat vlastní breakpointy pro desktop, tablet, mobile, plus custom. Každý prvek může mít v každém breakpointu jiné vlastnosti.

### 4.7 Code mode (Velo Dev Mode)

Zapnutí Velo otevře:
- Kódový editor s JavaScriptem
- Databáze (Wix CMS)
- API endpoints (web modules)
- npm packages
- Custom elements (React komponenty)
- Externí API integrace

### 4.8 Preview & publish

- Live preview před publikací
- Site history (verze, rollback)
- Publish to staging vs. production
- Password protection pro staging
- Draft mode

---

## 5. Wix Dashboard – administrace

Hlavní administrativní rozhraní Wixu, kompletně oddělené od editoru. Sjednocuje všechny obchodní nástroje.

### 5.1 Home (Dashboard)

- Personalizovaný widget layout
- Důležitá metrika (orders, sales, visitors, conversion rate)
- Setup checklist pro nové weby
- Upozornění (low stock, new orders, messages)
- AI Business Assistant (Astro)
- Quick actions

### 5.2 Sales

- Orders – přehled, filtrování, editace
- Abandoned checkouts
- Bookings (pokud aktivní)
- Subscriptions
- Invoices
- Price Quotes
- Gift Cards
- Products (katalog)
- Inventory
- Coupons
- Reviews

### 5.3 Catalog

- Store Products (hlavní seznam)
- Categories (kategorie produktů)
- Digital Products
- Services (pro Bookings)
- Restaurants Menus (pokud Restaurants)
- Events (pokud aktivní)
- Inventory
- Dropshipping apps
- Print on Demand

### 5.4 Customers & Leads

- Contact list (CRM)
- Tasks & Reminders
- Inbox (sjednocené zprávy)
- Labels (tagy)
- Forms (formulářová data)
- Members area (pokud aktivní)
- Site Visitors (analytics)

### 5.5 Marketing & SEO

- Marketing Home
- Email Marketing (Wix Email)
- Automations
- Coupons
- Social posts
- SEO tools
- Google Ads
- Facebook Ads
- Pinterest for Business
- Email Marketing templates
- Forms

### 5.6 Finances

- Wix Payments dashboard
- Payouts history
- Transaction history
- Invoices
- Recurring invoices
- Price Quotes
- Tax settings
- Chargebacks

### 5.7 Analytics & Reports

- Site Analytics
- Store Analytics
- Booking Analytics
- Members Analytics
- Reports (standardní i custom na Business Elite)
- Traffic sources
- Conversion funnels
- Session recordings (přes aplikace)

### 5.8 Automations

- Wix Automations – workflow builder
- Pre-made templates
- Trigger → Condition → Action

### 5.9 Apps

- Installed apps
- Wix App Market link
- My Business Apps

### 5.10 Settings

- Business Info
- Billing & Payments
- Domains
- Email accounts
- Staff & Roles
- Notifications
- Accept Payments
- Checkout customization
- Shipping & Delivery
- Store policies
- Tax

### 5.11 Wix Owner App (mobilní)

- iOS a Android
- Push notifikace pro orders, bookings, messages
- Live chat s návštěvníky
- Správa produktů
- POS funkce (mobile checkout)
- Wix Inbox
- Analytics
- Member management

---

## 6. Wix Stores – produkty a katalog

### 6.1 Katalog – základní údaje produktu

Každý produkt obsahuje:

- **Název** (max. 80 znaků)
- **Popis** (rich text editor, HTML, embedded media)
- **Ribbon** (promo labely: "Sale", "New", "Featured", custom)
- **Kategorie** (hierarchie, nested kategorie)
- **Obrázky** (až 15 obrázků + video + 360° foto)
- **Cena** (regular, sale, cost)
- **SKU**
- **Barcode** (EAN, UPC, ISBN)
- **Inventory** (tracked/in-stock-out)
- **Weight + dimensions** (pro výpočet dopravy)
- **Product options** (až 6 options, např. Size, Color, Material)
- **Variants** (až 100 option choices celkem – kombinace)
- **Modifiers** (customizace bez vlivu na inventory – např. gift wrapping)
- **Custom text fields** (zákazník může napsat text na produkt)
- **Digital download** (pro digitální produkty – až 1 GB file)
- **Pre-order** (předobjednávky)
- **Subscription** (opakovaný prodej)
- **Additional info sections** (reusable – ingredience, složení, care instructions)
- **Related products**
- **SEO fields** (meta title, description, URL handle)
- **Visibility** (draft/published, hidden from catalog)
- **Tax class**

### 6.2 Catalog V3 (nový od Q4 2025)

Wix v průběhu roku 2025/2026 rolluje **Catalog V3** – nová API architektura s:

- **Universal variants** – každý produkt má alespoň jednu variantu (i když bez options)
- **Advanced variant handling** – pricing, SKU, barcode, weight, inventory per varianta
- **Bulk operations** – efektivní hromadné operace
- **Inventory Items API** – per varianta a per lokace
- **Brands API** – správa značek
- **Ribbons API** – promo badges
- **Info Sections API** – reusable informační bloky

V roce 2026 existují paralelně V1 (staré obchody) a V3 (nové).

### 6.3 Product options & variants

- **Až 6 options** (např. Size, Color, Material, Style, Pattern, Finish)
- **Až 100 option choices** celkem (např. Small, Medium, Large, Red, Blue, Cotton)
- **Varianty** jako kombinace (2 options × 2 choices = 4 varianty)
- **Per-variant pricing** (individuální ceny)
- **Per-variant inventory** (individuální stavy skladu)
- **Per-variant SKU a barcode**
- **Per-variant images** (přímé napojení na varianty barev)
- **Color swatches** (automatic color/image mapping)
- **Text swatches**
- **Image swatches**
- **Dropdown** (pro velké množství choice)

### 6.4 Product modifiers

Na rozdíl od variant modifikátory nemění inventory:
- Gift wrapping
- Engraving (monogramming)
- Custom notes from customer
- Add-on services
- Free textový input
- File upload (pro custom print)

### 6.5 Digital products

- Stažení po zaplacení
- Download link v emailu + v accounts portálu
- Max. 1 GB per soubor
- DRM free
- Licence keys (přes aplikace)
- Limited download (počet stažení / expirace)

### 6.6 Subscription products

- Monthly, quarterly, annual billing
- Free trial
- Cancel anytime (zákaznická self-service)
- Rebilling přes Wix Payments
- Pouze kartami (ne BNPL, ne PayPal recurring)

### 6.7 Pre-order

- Produkt lze prodávat před naskladněním
- Explicit "pre-order" label
- Expected ship date zobrazen v checkoutu
- Email notifikace při odeslání

### 6.8 Custom text fields

Zákazník může při objednávce napsat text – např. jméno na personalizované zboží, rok, věnování. Text se přenese do objednávky.

### 6.9 Product categories

- Hierarchie s nested kategoriemi
- Category-level SEO (meta, URL)
- Category images
- Sorting: manual, alphabetical, price, newest, best sellers
- Filters: by price, option, brand, tag, availability

### 6.10 Ribbons (štítky)

- Predefined: Sale, New, Featured, Best Seller, Free Shipping, Limited Stock
- Custom: libovolný text a barva
- Per-product nebo hromadně

### 6.11 Brands

- Reusable entity
- Brand page se všemi produkty
- Brand logo, description, SEO
- Filter v katalogu

### 6.12 Bulk operations

- Hromadné úpravy cen (fixed, %)
- Hromadné tagy
- Hromadná aktualizace inventory
- CSV import/export
- Třetí strany: Wix Velocity, WooStorExporter pro pokročilé bulk edit

### 6.13 Import/Export

- CSV import/export
- Shopify-style template
- Max. ~5 000 produktů per CSV
- Pro větší katalogy: Velo API / třetí strany
- Mapping kolonek

### 6.14 Print on Demand

- Integrace: Printful, Printify, Gelato, Teelaunch
- Automatické předání order
- Žádné inventory (Wix pouze frontend)

### 6.15 Dropshipping

- Integrace: Modalyst, Spocket, Printful, AliExpress (přes Syncee)
- Automated product import
- Auto order fulfillment
- Price markup rules

### 6.16 Limit produktů

- **Wix Stores:** až **50 000 produktů** per site (standard)
- **Wix Studio / Enterprise:** až **500 000 produktů**
- Reálně: nad 10 000 produktů editor zpomaluje, nutno optimalizovat

---

## 7. Sklad a inventory management

### 7.1 Dva režimy sledování zásob

**Track inventory (kvantita):**
- Wix sleduje přesný počet kusů
- Automatické odečítání při prodeji
- Oznámení při low stock
- Per-varianta tracking

**In Stock / Out of Stock (binární):**
- Manuální přepínač
- Pro obchody bez přesného počtu
- Nejjednodušší varianta

### 7.2 Inventory Items API (Catalog V3)

- Per-variant inventory
- Per-location inventory (multi-location)
- Incoming inventory tracking
- Reserved inventory (při abandoned checkoutu)
- Available = On hand − Reserved

### 7.3 Multi-location inventory

- Možno přiřadit inventory k různým lokacím (sklady, prodejny)
- Per-location stock levels
- Order routing podle dostupnosti
- Vyžaduje Business+ plán

### 7.4 Low stock alerts

- Nastavitelný threshold (např. 5 ks)
- Email notifikace
- Push notifikace v Owner App
- Dashboard upozornění

### 7.5 Inventory adjustments

- Ruční úpravy s důvodem (damaged, found, received, count correction)
- Historie změn
- Per-user log (kdo změnil)

### 7.6 Bundles & Connected Inventory

Přes oficiální Wix aplikaci:
- Bundles = kombinace několika produktů prodávané jako jeden
- Connected inventory = propojení různých SKU (např. prodej v 1 ks i v 6-packu odečítá ze stejného stocku)

### 7.7 Barcode scanning

- Přes Wix Owner App
- Fotoaparát telefonu skenuje barcode
- Rychlý lookup při příjmu zboží / POS

### 7.8 Inventory reports

- Inventory value (celková hodnota skladu)
- Items sold vs. remaining
- Top sellers
- Low stock report
- Out of stock tracking

### 7.9 Omezení

- **Žádné transfers mezi lokacemi** nativně (jen přes API)
- **Žádné purchase orders** nativně (jen přes aplikace)
- **Omezené forecasting** ve srovnání se Shopify Stocky

---

## 8. Objednávky a fulfillment

### 8.1 Order lifecycle

Každá objednávka má stavy:

- **Payment:** Paid, Not paid, Refunded, Partially refunded, Pending, Authorized, Declined
- **Fulfillment:** Not fulfilled, Fulfilled, Partially fulfilled, Cancelled
- **Dispute:** None, Chargeback, Fraud alert

### 8.2 Order detail

Každá objednávka obsahuje:
- Order number (automatický)
- Customer info (name, email, phone, addresses)
- Products (incl. variants a modifiers)
- Payment method
- Shipping method + tracking
- Discounts applied
- Taxes breakdown
- Notes (customer + internal)
- Activity log (akce v čase)

### 8.3 Fulfillment workflow

- **Manual fulfillment:** administrátor označí jako odeslané
- **Auto-fulfillment:** pro digitální produkty
- **Partial fulfillment:** různé položky odeslány zvlášť
- **Tracking number:** manuálně zadán + automaticky odeslán zákazníkovi
- **Supported carriers:** USPS, UPS, FedEx, DHL, Canada Post, Royal Mail, Australia Post, atd. (via Shippo/EasyPost)
- **Pick & pack lists:** generování tisku

### 8.4 Email notifications

Pre-built emailové šablony:
- Order confirmation
- Order cancelled
- Order refunded
- Order shipped (s tracking)
- Order delivered
- Abandoned cart reminder
- Back in stock

Všechny lze:
- Překládat do jiných jazyků
- Upravit text, logo, barvy
- Přidat vlastní sekce
- Blokovat/odblokovat

### 8.5 Abandoned cart recovery

- Automatické sledování opuštěných košíků
- 3 automatizační e-maily (konfigurovatelné)
- Timing: 1h, 10h, 20h po opuštění
- Discount code v emailu (volitelně)
- Dashboard přehled ztracených košíků

### 8.6 Refunds

- Full refund
- Partial refund
- Refund na původní platební metodu
- Gift card refund (store credit)
- Restock při refundu (volitelně)

### 8.7 Returns

- Nativně **jen základní** (bez self-service portálu)
- Pro pokročilé returns: aplikace ReturnGo, AfterShip Returns
- Return reasons, exchange, store credit

### 8.8 Draft orders

- Ruční vytvoření objednávky
- Send payment link zákazníkovi
- Custom pricing
- Offline orders (telefonické)

### 8.9 Invoice generation

- Automatické invoices pro každou objednávku
- PDF download
- Customizable template
- Recurring invoices (pro subscriptions)
- Wix Invoices app (zdarma)

### 8.10 Fraud prevention

- Integrováno do Wix Payments
- Risk scoring (low/medium/high)
- 3D Secure (povinné v EU)
- CVV + AVS check
- IP geolocation check
- Velocity rules
- Manuální review

---

## 9. Zákazníci a Members Area

### 9.1 Contacts (CRM)

Wix má vestavěné CRM napříč všemi produkty:
- Unified contact list (z e-shopu, rezervací, formulářů, live chat)
- Labels (tagy)
- Activity timeline
- Notes & tasks
- Custom fields
- Import/export CSV
- Lifecycle stages
- Last activity

### 9.2 Members Area

**Unified přihlášení** napříč všemi Wix funkcemi:
- **Store orders** (historie objednávek, re-order)
- **Bookings** (rezervace, rebooking)
- **Events** (registrace, tickets)
- **Subscriptions** (správa pricing plans)
- **Loyalty points** (sbírání a uplatnění)
- **Addresses book**
- **Saved payment methods**
- **Wishlist**
- **Following / Followers** (community)
- **Badges** (ocenění)
- **Member profile**
- **Privacy settings**

### 9.3 Login options

- Email + password
- Sign in with Google
- Sign in with Facebook
- Sign in with Apple
- Passwordless (email code)
- Social logins přes Velo

### 9.4 Member permissions

- Public members
- Private members (approval required)
- Admin-created accounts
- Gated content (pouze pro přihlášené)

### 9.5 Member segmentation

- Labels
- Last purchase date
- Total spent
- Contact source
- Custom fields
- Pricing plan ownership

### 9.6 Customer lifetime value tracking

- Total orders
- Total revenue per customer
- Average order value
- Reorder rate
- Last order date

### 9.7 Customer communications

- **Wix Inbox** – sjednocené zprávy (email, live chat, Facebook, Instagram, SMS)
- **Auto-replies**
- **Chatbots** (Wix Chat + aplikace)
- **SMS messaging** (přes integraci)

### 9.8 Privacy & GDPR

- Privacy request handling
- Right to be forgotten
- Cookie consent (Wix Cookie Banner zdarma)
- CCPA compliance
- Data export for user

### 9.9 Wix Forms

Pro sběr zákaznických dat mimo e-shop:
- Contact forms
- Quote requests
- Surveys
- Job applications
- Event registration
- File upload
- Payment forms
- Conditional logic
- Multi-step forms
- Integration s Google Sheets, Mailchimp, Zapier

---

## 10. Checkout, Wix Payments a platby

### 10.1 Wix checkout

- **One-page checkout** (defaultně)
- Guest checkout (bez registrace)
- Express checkout (Apple Pay, Google Pay)
- **Customizable checkout** (Business Elite)
- Custom fields
- Delivery date picker
- Gift message option
- Coupon/gift card field
- Order notes
- Upsells v košíku (přes aplikace)
- Post-purchase upsells (aplikace)

### 10.2 Wix Payments (nativní brána)

Wix Payments je vlastní platební brána, powered by Stripe/Adyen infrastructure.

**Dostupnost:** USA, Kanada, UK, Austrálie, Nový Zéland, Německo, Francie, Španělsko, Itálie, Nizozemsko, Belgie, Portugalsko, Rakousko, Irsko, Dánsko, Švédsko, Norsko, Finsko, Brazílie, Mexiko, Japonsko, Singapur, Hongkong, Izrael, Argentina (rozšiřuje se).

**⚠️ Pro ČR zatím není Wix Payments nativně** – používá se Stripe, PayPal, PayU.

**Podporované platební metody přes Wix Payments:**
- Kreditní a debetní karty (Visa, Mastercard, AmEx, Discover, JCB, UnionPay)
- Apple Pay
- Google Pay
- Klarna (BNPL)
- Afterpay (BNPL)
- Affirm (BNPL)
- iDEAL (NL)
- Bancontact (BE)
- Sofort (DE)
- Giropay (DE)
- SEPA Direct Debit
- ACH (USA)

### 10.3 Třetí strany – platební brány

Wix podporuje přes 80 platebních bran, např.:
- **Stripe** (nejčastější volba v ČR)
- **PayPal**
- **Square**
- **Authorize.Net**
- **Braintree** (PayPal)
- **Adyen**
- **Mollie** (dobrá pro EU)
- **2Checkout (Verifone)**
- **WorldPay**
- **PayU** (východní Evropa)
- **Razorpay** (Indie)
- **Cybersource**
- **Checkout.com**

Pro ČR lze získat:
- Stripe (karty)
- PayPal
- Manuální bankovní převod
- Dobírka (COD)
- PayU (přes aplikaci)
- ComGate (omezeně, přes Velo custom integraci)

### 10.4 Offline payment methods

- Manual bank transfer
- Cash on delivery (COD)
- Pay at pickup
- Check
- Custom offline method

### 10.5 Subscriptions (recurring)

- Pouze přes Wix Payments a PayPal
- Jen kartami (ne BNPL)
- Monthly/quarterly/annual cycle
- Free trial period
- Paused subscriptions
- Canceled subscriptions

### 10.6 Gift cards

- Digital gift cards
- Custom values nebo pevné ceny
- Redemption in checkout
- Balance tracking
- Multi-currency (kupuje se v jiné měně, ale ukládá se v hlavní)
- Scheduled delivery (doručení k datu)
- Personalized message

### 10.7 Price Quotes

- Vystavování cenových nabídek
- Expiration date
- Accept via link
- Convert to invoice

### 10.8 Invoicing

- Automatické invoices
- Recurring invoices
- Payment reminders
- Payment link
- PDF export
- Custom branding

### 10.9 Checkout customization

- Logo, barvy, fonty (branded checkout)
- Custom text fields
- Terms & conditions
- Privacy policy links
- Custom footer
- Advanced (Business Elite + Velo) – přidávání vlastních sekcí

### 10.10 Express checkout buttons

- Apple Pay (na zařízeních Apple)
- Google Pay (Chrome + Android)
- PayPal express
- Tlačítka viditelná už v košíku a na produktech

### 10.11 Tax-inclusive/exclusive pricing

- USA, Kanada: taxes exclusive (přidáno v checkoutu)
- EU, UK, AU: taxes inclusive (daň v ceně)
- Customizable per market

---

## 11. Doprava a dodání

### 11.1 Shipping regions

- Neomezený počet regionů
- Definice podle země, státu, ZIP kódu
- Rest of World fallback

### 11.2 Shipping rates

- **Flat rate** (pevná cena)
- **Free shipping**
- **Free over amount** (free nad X)
- **By weight** (tiered podle váhy)
- **By price** (tiered podle ceny košíku)
- **By item quantity**
- **Calculated rates** (carrier-calculated, Business+)

### 11.3 Shipping carriers (calculated rates)

Pro USA/Canada přes:
- USPS
- UPS
- FedEx
- DHL Express
- Canada Post

Pro Evropu typicky přes aplikace třetích stran (Packlink, Shippo, Sendcloud).

### 11.4 Shipping integrations

- **Shippo** (USA)
- **EasyPost** (USA)
- **Sendcloud** (EU – podpora Zásilkovny, DPD, GLS)
- **Packlink PRO** (EU)
- **ShipStation** (USA, Canada, UK, AU)

### 11.5 Local delivery

- Místní doručení s polygonem na mapě
- Cena per area
- Delivery instructions
- Time slot booking (aplikace)

### 11.6 Pickup

- Pickup in store (BOPIS)
- Multiple locations
- Pickup instructions
- Email s pokyny

### 11.7 Shipping labels

- Tisk přímo ze Wixu (přes Shippo)
- Batch printing
- Discounted rates (USPS commercial)
- Void labels
- Customs forms (international)

### 11.8 Tracking

- Automatic tracking number v email
- Tracking URL
- Order status v Members Area
- Integrace AfterShip (aplikace)

### 11.9 Shipping profiles

- Různé sazby pro různé produkty
- Fragile items, oversized
- Origin-based (z různých lokací)

### 11.10 Specifika pro ČR

⚠️ Wix nemá nativní integraci na:
- Zásilkovnu/Packetu (jen přes Sendcloud nebo custom Velo)
- Českou poštu (jen přes Sendcloud)
- PPL, DPD, GLS (přes Sendcloud)

Většina českých Wix obchodů řeší dopravu:
1. **Sendcloud** jako aggregator
2. **Fixed shipping rates** + manuální podání u dopravce
3. **Custom Velo integrace**

---

## 12. Daně a compliance

### 12.1 Tax setup

- **Manual tax rates** (sami definujete)
- **Automatic tax calculation** (Business+) – up to 100 transactions/month
- **Tax per region** (country, state, ZIP)
- **Tax-inclusive vs exclusive pricing**
- **Tax-exempt products** (knihy, jídlo)
- **Tax codes** (harmonized codes)

### 12.2 Automatic Tax (Avalara)

Na Business a Business Elite Wix integruje Avalara/TaxJar pro:
- USA (nexus tracking)
- EU VAT (všechny sazby)
- Canada (GST, PST, HST)
- Australia (GST)
- UK (VAT)

Nad 100 transakcí/měs. dodatečný poplatek.

### 12.3 EU VAT

- EU OSS podpora
- DPH compliance
- Reverse charge pro B2B s VAT ID
- Digital goods VAT (VAT MOSS legacy)

### 12.4 VAT IDs validation

- VIES lookup (EU VAT IDs)
- Přes aplikace třetích stran

### 12.5 Duties & import tax

- Limited nativní (přes Global-e partnership)
- Landed cost (Business Elite)

### 12.6 Tax reports

- Sales by tax region
- Tax collected summary
- Export pro účetní

### 12.7 Certifikace a compliance

- **PCI DSS Level 1** (jako merchant service)
- **GDPR compliance**
- **CCPA compliance**
- **SOC 2 Type II**
- **ISO 27001**
- **HIPAA** limited (pro healthcare weby, Enterprise only)

### 12.8 Specifika pro ČR

- **Žádná nativní EET integrace** (už nepovinná, ale některé obchody ji chtěly)
- **Žádná ARES validace IČO**
- DPH lze nastavit manuálně (21 %, 15 %, 10 %, 0 %)
- Pro účetnictví (Pohoda, Money, FlexiBee) nutné přes Zapier/Make/custom

---

## 13. Mezinárodní prodej a Multi-currency

### 13.1 Multi-currency

Multi-currency je dostupná pro eligible Wix Payments obchody a pro obchody používající PayPal nebo Stripe. Vyžaduje **Business plán** a vyšší.

**Jak funguje:**
- Zákazník vidí ceny v lokální měně
- Currency switcher na stránce
- Platba v lokální měně (nebo v hlavní, pokud "display-only")
- Konverze přes XE.com exchange rates
- Fees: processing fee + currency conversion fee + cross-border fee

**Supported currencies:**
- Přes 30 měn v Wix Payments
- Přes Stripe: 135+ měn
- Přes PayPal: 25+ měn

### 13.2 Global-e partnership

Wix má strategické partnerství s **Global-e** pro cross-border commerce:
- Over 100 currencies v ceně a platbách
- Localized checkout per market
- Duty & tax pre-payment
- Country-specific pricing
- International payment processing
- Fraud prevention for cross-border

### 13.3 Multi-language

- **Wix Multilingual** – oficiální integrace (zdarma v Core+)
- Auto-translate přes Google Translate
- Manuální úpravy překladů
- Překlady produktů, kategorií, stránek, blog postů, checkoutu, emailů
- **URL structure:** `/en/`, `/de/`, `/fr/` prefixy
- hreflang tagy automaticky
- Language switcher widget

### 13.4 Geolocation

- Automatická detekce IP
- Redirect na lokalizovanou verzi (volitelné)
- Language suggestion popup
- Přes Velo lze customizovat

### 13.5 Omezení pro mezinárodní prodej

- **Manuální orders nepodporují multi-currency**
- **Subscriptions exchange rate fix** při pořízení (další billing cykly v původním kurzu)
- **Gift cards vždy v hlavní měně** (konverze při čerpání)
- **Pouze 1 hlavní měna** (payouts chodí v hlavní měně)

---

## 14. Marketing a prodejní kanály

### 14.1 Wix Email Marketing

- Vestavěný email marketing
- Drag-and-drop editor
- Pre-built templates (stovky)
- Automations
- Segmentace
- A/B testing (Business+)
- Send time optimization
- Subscriber lists
- **Free tier:** 3 kampaně/měs. + 500 e-mailů/měs.
- **Placené:** $10+ /měs. (3 000 e-mailů) až enterprise

### 14.2 Marketing Automations

- Triggery: new signup, abandoned cart, purchase, birthday, inactive customer, milestone
- Actions: send email, SMS, add tag, add to list, push notification, wait, condition
- Pre-built workflows
- Visual workflow editor

### 14.3 SMS marketing

- Přes Wix Marketing + TextMagic / Twilio
- Transactional (order notifications)
- Promotional (kampaně)

### 14.4 Social integration

**Facebook & Instagram:**
- Shop integration (Meta Commerce Catalog)
- Instagram Shopping tags
- Facebook Pixel auto
- Dynamic ads retargeting
- Live Shopping

**TikTok:**
- TikTok Pixel
- TikTok Shop integration (USA, UK)
- Spark Ads

**Pinterest:**
- Pinterest Pixel
- Rich Pins
- Catalog sync
- Pinterest for Business

**Google:**
- Google Merchant Center
- Free Shopping listings
- YouTube tags
- Google Ads conversion tracking

**Snapchat, LinkedIn, X (Twitter):**
- Pixely přes Wix Marketing Integrations

### 14.5 Marketplaces

- **eBay** (přes aplikaci CedCommerce)
- **Amazon** (přes aplikaci)
- **Walmart** (přes aplikaci)
- **Etsy** (přes aplikace)

### 14.6 Marketing Suite tiers

| Tier | Obsahuje |
|---|---|
| Light | Základní form builder, 500 emailů/měs. |
| Basic (Core) | Email templates, základní automations |
| Standard (Business) | Automations, segmentace, A/B testing |
| Advanced (Business Elite) | Rozšířené automations, higher email sends, CRM integrace |

### 14.7 Ads Management

- **Wix Ads Manager** (placená služba)
- Centralizovaná správa Facebook + Google Ads
- AI-driven optimalization
- Performance dashboard

### 14.8 SEO & Content Marketing

- Wix Blog (viz sekce 24)
- AI Meta Tags generator
- AI content writer

### 14.9 Referral program

- Přes aplikace (Smile.io, ReferralCandy, Growave)
- Tracking codes
- Rewards

---

## 15. Slevy, kupóny a věrnostní programy

### 15.1 Coupons (slevové kódy)

**Typy:**
- Percentage off (napr. 20 %)
- Fixed amount off
- Free shipping
- Buy X Get Y (1+1 free)
- Tier discounts (min. spend)

**Podmínky:**
- Expiration date
- Usage limit (celkem / per customer)
- Minimum purchase
- Specific products / collections
- New customers only
- Exclude sale items

### 15.2 Automatic discounts

- Sales bez kuponu
- Promotional banners
- "X % off everything" campaigns
- Flash sales

### 15.3 Price Lists (pouze limitně)

Wix nemá tak robustní price lists jako Shopify B2B. Na Business+ lze:
- Create member-only pricing (pro přihlášené)
- Wholesale pricing přes Velo
- Subscriber-only prices

### 15.4 Volume discounts

Přes aplikace třetích stran:
- Wix Multi Buy Offers
- Bogo Simple
- Bundle Builder

### 15.5 Gift cards

Viz sekce 10.6.

### 15.6 Loyalty program

**Wix Loyalty Program** (nativní):
- Points earning (z nákupu, review, signup, birthday)
- Tiers (Bronze, Silver, Gold, Platinum)
- Custom earning rules
- Rewards:
  - Discount coupons
  - Free shipping
  - Free product
  - Store credit
  - Custom rewards
- Member dashboard pro body
- Expiration rules

### 15.7 Referral rewards

- Give-get model
- Refer friend → both get coupon
- Tracking
- Přes Wix Loyalty + custom

### 15.8 Badges

- Gamifikace (First Purchase, VIP, Top Reviewer)
- Zobrazené v member profile
- Permissions na základě badges

### 15.9 Wishlist

- Přes aplikaci (Wix Wishlist od třetí strany)
- Save for later
- Email reminder

### 15.10 Reviews

- **Wix Reviews** (nativní zdarma app)
- Hvězdičkový rating
- Text + photos
- Moderation
- Verified purchase badge
- Display on product + collection pages
- Email request post-purchase
- Schema.org markup pro SEO

---

## 16. SEO a obsah

### 16.1 On-page SEO

- **Meta title & description** per stránka
- **URL slugs** editovatelné
- **H1-H6** struktura
- **Alt texts** na obrázcích (AI auto-generate)
- **Schema.org markup** (Product, Breadcrumb, Organization, FAQ)
- **Open Graph tags**
- **Twitter Cards**
- **Canonical tags** (auto)
- **robots.txt** editor
- **sitemap.xml** auto-generated

### 16.2 Technické SEO

- **SSL certifikát** zdarma (Let's Encrypt)
- **HTTPS enforced**
- **Mobile-friendly** (responsive + AMP volitelné)
- **Fast loading** (globální CDN)
- **Lazy loading obrázků**
- **WebP + responsive images**
- **Structured data wizard**

### 16.3 Wix SEO Wiz

AI asistent:
- Personalizovaný SEO plan
- Keyword suggestions
- Step-by-step checklist
- Progress tracking

### 16.4 Wix Semrush integration

- Keyword research přímo v dashboardu
- Competition analysis
- Domain overview

### 16.5 URL struktura

- `/product-page/handle`
- `/category/handle`
- `/blog/post-slug`
- `/bookings/service-handle`
- `/events/event-handle`
- Multi-language: `/en/`, `/de/`, atd.

### 16.6 301 redirects

- URL Redirect manager
- Bulk import
- Automatic při změně URL

### 16.7 Google Search Console integrace

- Verifikace jedním klikem
- Index status
- Performance data
- Coverage issues

### 16.8 AI SEO Suite

Nové v roce 2026:
- AI-generated meta tags pro všechny stránky
- AI blog post ideas
- AI keyword suggestions
- Automated internal linking
- Content gap analysis

### 16.9 Blog SEO

- Categories & tags
- Related posts
- Author profiles (schema.org)
- Featured image
- RSS feed
- Pagination

### 16.10 International SEO

- **hreflang** tags automaticky
- Country-specific URLs
- Language targeting v Google Search Console

### 16.11 Omezení Wix SEO

- Starší Wix weby měly problémy se Google indexing (historicky)
- Nyní je to vyřešené, ale pořád je o něco pomalejší než statické weby
- Core Web Vitals: dobré, ale ne perfektní
- Některé pokročilé SEO vyžadují Velo coding

---

## 17. Analytika a reporting

### 17.1 Wix Analytics (standardní)

**Site Analytics:**
- Visitors
- Sessions
- Pageviews
- Bounce rate
- Average session duration
- Top pages
- Traffic sources (direct, organic, referral, social, paid)
- Devices (desktop/mobile/tablet)
- Browsers
- Countries
- New vs returning visitors

### 17.2 Store Analytics

- Total sales
- Total orders
- Average order value
- Conversion rate
- Revenue by channel
- Top products
- Top categories
- Customer acquisition
- Repeat purchase rate

### 17.3 Booking Analytics

- Bookings per service
- Revenue per service
- Staff performance
- Busy times

### 17.4 Custom Reports (Business Elite)

- Drag-and-drop report builder
- Vlastní metriky
- Schedule reports (email)
- Export CSV/PDF

### 17.5 Marketing Analytics

- Campaign performance
- Email open/click rates
- ROI per channel
- Ad spend vs. revenue
- Attribution models

### 17.6 Member Analytics

- New signups
- Member activity
- Engagement metrics
- Churn rate

### 17.7 Real-time data

- Live visitor counter
- Active sessions
- Recent purchases

### 17.8 Integrations

- **Google Analytics 4** (native setup)
- **Google Tag Manager**
- **Meta Pixel** (Facebook)
- **TikTok Pixel**
- **Microsoft Clarity** (free session recording)
- **Hotjar** (přes app)
- **Mixpanel, Amplitude** (přes Velo)

### 17.9 Wix Insights (beta)

AI-driven insights:
- Proaktivní doporučení
- Anomaly detection
- Trend analysis
- Predictions

---

## 18. AI – Wix Astro, Harmony, Vibe

Wix je jeden z **lídrů v AI website building** – první AI feature od 2016.

### 18.1 Wix Astro

Univerzální AI asistent napříč platformou:
- **AI Website Builder** (konverzační tvorba webu)
- **AI Business Assistant** (rady pro podnikání)
- **AI Content Writer** (texty napříč stránkou)
- **Image creator** (generace obrázků)
- **Video maker**
- **Logo Maker**

### 18.2 Wix Harmony (leden 2026)

Nejnovější AI builder:
- Natural language site creation
- Kombinace AI rychlosti + manuální úpravy
- Dobře optimalizovaný pro SEO
- Vhodný pro business weby

### 18.3 Wix Vibe

AI-assisted developer environment:
- Astro framework + React
- GitHub integrace
- Code editing
- Headless deployment
- Pro technické týmy

### 18.4 Wix Base44

AI app builder (ne website):
- Vytvoření apps z promptů
- Logic flows
- Databázové schéma
- Frontend components

### 18.5 AI Text Creator

- Blog posts
- Product descriptions (3 tóny: professional, enthusiastic, informative)
- Page texts
- Social posts
- Email subject lines
- Meta descriptions
- **20+ jazyků** translation
- Regenerate, refine, simplify

### 18.6 AI Image tools

- **AI Image Creator** (text-to-image)
- **Background Remover** (jedním klikem)
- **Image Editor** (AI úpravy – light, shadow, focus)
- **Object removal**
- **Image upscaling**

### 18.7 AI SEO tools

- Meta tag generator
- Keyword suggestions
- Alt text auto-generator
- Content suggestions
- Internal linking

### 18.8 AI pro e-commerce

- **AI Product Descriptions** (pro Stores)
- **AI Product Tag generator**
- **AI Pricing suggestions** (z market data)
- **AI Related products**
- **AI Search** (sémantické vyhledávání)

### 18.9 AI Chat & Support

- AI chatbot pro návštěvníky (přes Wix Inbox)
- Auto-replies
- Faq AI
- Sentiment analysis v inboxu

### 18.10 Business Launcher

AI nástroj pro tvorbu business plánu:
- Profilování schopností
- AI-generated business ideas
- Personalizovaný launch kit
- Market research suggestions

### 18.11 Logo Maker

- AI-generated loga z description
- Vector výstupy
- Brand kit (barvy, fonty) napříč webem

### 18.12 Srovnání AI pokrytí

Wix pokrývá AI nejšíře ze všech website builderů:
- 20+ AI features napříč produkty
- Integrace do každé oblasti (web, content, commerce, marketing, support)

---

## 19. Wix POS – prodej v kamenných prodejnách

### 19.1 Dostupnost

⚠️ **Wix POS je dostupný pouze v USA a Kanadě.** V Evropě zatím není (2026).

### 19.2 Wix POS hardware balíčky

**Wix Complete POS Retail Package:**
- HP Engage One Prime Tablet (premium)
- Customer-facing display
- Cash drawer
- Barcode scanner
- Receipt printer
- Stripe Terminal card reader

**Wix Retail Essential Package:**
- Terminal s customer display
- Stripe Terminal card reader

**Wix Mobile POS:**
- Wix Owner App (iOS, Android)
- Stripe Terminal Bluetooth card reader

**À la carte hardware:**
- POS tablet
- Card reader (Bluetooth / network)
- Receipt printer
- Cash drawer
- Barcode scanner
- Kitchen printer (pro restaurace)

### 19.3 POS software

Předinstalovaný na HP tabletu. Automaticky synchronizuje s online Wix obchodem.

### 19.4 POS features

- **Unified inventory** (online + offline)
- **Unified orders** (jeden seznam)
- **Staff management**:
  - Unlimited staff
  - Individual PIN codes
  - Predefined roles (store manager, cashier) nebo custom
  - Staff permissions
  - Sales tracking per staff
  - Scheduling
- **Customer-facing display** (ukazuje zákazníkovi položky a cenu)
- **Accept payments**: chip, contactless, magstripe, Apple Pay, Google Pay
- **Email/print receipts**
- **Returns & exchanges**
- **Discounts at checkout**
- **Taxes**
- **Tip options**
- **Barcode scanning** (produkty lookup)
- **Product search** (by name, SKU, barcode)
- **Cash management** (opening/closing float)
- **End of day reports**
- **Appointment booking** (pro Bookings walk-ins)
- **Event ticket sales** (pro Events)
- **Loyalty program integration**

### 19.5 Hardware záruka

- **1-year limited warranty**
- **30-day money-back guarantee**
- **Free shipping**
- Stripe Terminal card reader pod podmínkou použití Wix Payments

### 19.6 POS Pro plán

- Vyžadován Wix Retail POS Pro plán pro card acceptance
- Měsíční poplatek kromě standardního Wix plánu

### 19.7 Typy retailu podporované

- Retail stores
- Boutiques
- Cafes
- Restaurants (s Wix Restaurants)
- Pop-up stores
- Markets / fairs
- Service providers (bookings)

### 19.8 Omezení

- **Pouze USA / Kanada**
- **Vyžaduje Wix Payments**
- **Bez offline mode** (nutné internetové připojení)
- **Limitované advanced retail features** (žádný clienteling, BOPIS má omezení)

---

## 20. Wix Bookings – rezervace služeb

### 20.1 Typy služeb

- **Appointments** (1-on-1)
- **Classes** (group sessions)
- **Courses** (multi-session programs)
- **Workshops**

### 20.2 Calendar features

- Staff calendars
- Google Calendar sync (two-way)
- Outlook sync
- iCal
- Custom working hours per staff
- Breaks, unavailability
- Multi-location

### 20.3 Booking flow

- Service catalog
- Staff selection
- Date/time picker
- Location choice
- Customer info form
- Payment
- Confirmation

### 20.4 Payment options

- Full payment at booking
- Deposit
- Pay later
- Online / in-person
- Memberships (pricing plans)
- Punch cards (buy 10 use 10)

### 20.5 Memberships & Packages

- Unlimited monthly
- Weekly limit
- Specific number of sessions
- Free trials
- Auto-renewal

### 20.6 Automations

- Reminders (email + SMS)
- No-show tracking
- Waitlist
- Rebooking links
- Review request post-service

### 20.7 Staff features

- Individual profiles
- Booking permissions
- Availability
- Commission tracking (přes integraci)
- Performance analytics

### 20.8 Virtual services

- Zoom integrace (auto-generate meeting link)
- Google Meet
- Microsoft Teams
- Custom URL

### 20.9 Group classes

- Capacity limit
- Participant list
- Waitlist
- Check-in

### 20.10 Courses

- Multi-session programs
- Fixed start date or anytime
- Progress tracking
- Certificates (přes aplikace)

### 20.11 Booking page customization

- Layout options
- Service filters
- Staff filters
- Calendar/list view

---

## 21. Wix Events – akce a ticketing

### 21.1 Event types

- In-person events
- Virtual events
- Hybrid events
- Recurring events

### 21.2 Event page

- Customizable design
- Countdown timer
- Agenda / schedule
- Speakers
- Location with map
- Video embed
- RSVP form

### 21.3 Tickets

- Multiple tier types (VIP, regular, early bird)
- Group tickets
- Free events (RSVP)
- Paid events
- Discount codes
- Sold out handling
- Quantity limits

### 21.4 Seating plans

- **Seating map designer**
- Row-by-row ticket types
- Individual seat selection
- Zones

### 21.5 Guest management

- Guest list
- Check-in (mobile scanner QR code)
- Waitlist
- Attendee communication
- Custom registration fields

### 21.6 Promotional tools

- Email invitations
- Social sharing
- Event feed
- SEO optimized event pages

### 21.7 Post-event

- Attendee emails
- Photo albums
- Recording links
- Survey

---

## 22. Wix Restaurants

Plně vybavená platforma pro restaurace.

### 22.1 Online Ordering

- Menu builder
- Menu items s fotkami
- Variants (size, add-ons)
- Modifiers (no onions, extra cheese)
- Dietary labels (vegan, gluten-free)
- Availability rules (breakfast menu jen ráno)
- Order types:
  - Pickup
  - Delivery
  - Dine-in (QR code menu)
- Tip options
- Utensils request
- Scheduled orders (order ahead)

### 22.2 Table Reservations

- Customizable table layout
- Party size limits
- Time slots
- Deposit požadavek
- Confirmation SMS/email
- Waitlist
- Walk-in management

### 22.3 POS integration

S Wix POS (USA/Canada):
- Tableside ordering
- Split checks
- Kitchen printer
- Tip management

### 22.4 Menu management

- Multiple menus (lunch, dinner, brunch)
- Seasonal menus
- Specials
- 86 items (temporarily unavailable)

### 22.5 Delivery integration

- Nativní delivery zones
- Integrace s Uber Eats, DoorDash, Grubhub (USA)
- Third-party couriers

### 22.6 Gift cards for restaurants

- Digital gift cards
- Redemption in restaurant + online

### 22.7 Loyalty for restaurants

- Punch cards
- Points-based
- Birthday rewards

### 22.8 Marketing

- Email campaigns pro new menu items
- Weekly specials
- SMS reminders

---

## 23. Wix Hotels by HotelRunner

Partnership s HotelRunner pro hospitality management.

### 23.1 Features

- Room inventory management
- Availability calendar
- Dynamic pricing
- Package deals
- Guest profiles
- Multi-language
- Payment collection

### 23.2 Channel Manager

Integrace s OTAs:
- Booking.com
- Airbnb
- Expedia
- Agoda
- Hotels.com

### 23.3 Booking engine

- Direct bookings (commission-free)
- Date picker
- Guest count
- Special requests
- Upsells (breakfast, parking, late checkout)

### 23.4 Cílové podniky

- B&Bs
- Boutique hotely
- Vacation rentals
- Apartment buildings
- Hostels
- Resorts

---

## 24. Wix Blog a komunitní nástroje

### 24.1 Wix Blog

**Základní funkce:**
- Unlimited posts
- Rich text editor
- Embedded media (images, video, GIFs)
- Featured image
- Author profiles
- Categories & tags
- Scheduled publishing
- Draft mode
- Co-authoring
- Comments (moderated)
- Likes & shares
- RSS feed
- Related posts
- Search
- Archive pages

### 24.2 Blog SEO

- Per-post meta
- Schema.org Article markup
- OG tags
- Breadcrumbs
- Pagination

### 24.3 AI Blog Writer

- Topic ideas
- Full post generation
- SEO-optimized drafts
- Image suggestions

### 24.4 Wix Forum (deprecated, existing users)

- Categories
- Topics
- Replies
- Upvotes
- Reputation
- Moderation

### 24.5 Wix Groups

- Public / private groups
- Posts, discussions
- Member management
- Events v groups
- File sharing

### 24.6 Wix Challenges

- Multi-day programs
- Steps / modules
- Participant progress
- Completion rewards
- Paid nebo free

### 24.7 Wix Forms

- Contact forms
- Quotes
- Surveys
- Job applications
- Conditional logic
- File upload
- Multi-step
- Captcha

### 24.8 Wix Video

- Video library
- Monetization (buy, rent, subscribe)
- Channels
- Live streaming (přes aplikace)

### 24.9 Wix File Share

- Downloadable files
- Access control (member-only)
- Categories

### 24.10 Wix Podcast

- Host podcasts
- Episodes
- Subscriptions
- Analytics

---

## 25. Wix Studio – profesionální platforma

Wix Studio je premium varianta pro agentury, freelancery, designéry.

### 25.1 Studio Editor

- **Responsive design** (ne volné umístění – grid-based)
- **Custom breakpoints**
- **CSS grid layouts**
- **Flexbox support**
- **Reusable components** (master sections)
- **Design tokens** (barvy, fonty, spacing)
- **Advanced animations** (keyframe-based)
- **CMS collections**
- **Dynamic pages**

### 25.2 Collaboration

- **Real-time multiplayer editing** (více lidí současně)
- **Comments na prvky**
- **Version history**
- **Staging / production**
- **Team permissions**

### 25.3 Client workspaces

- Klient dashboard
- White-label access
- Billing management
- Handoff mode

### 25.4 Workspace (studio org)

- Agency-wide settings
- Team members
- Client portfolio
- Revenue dashboard

### 25.5 Advanced dev tools

- Full Velo access
- GitHub integrace
- npm packages
- TypeScript support
- React components
- CI/CD pipelines (experimental)

### 25.6 Marketplace

- Studio Marketplace pro agency leads
- Portfolio showcase
- Partner tiers
- Verified badge

### 25.7 Pricing

- Start za 39 USD/měs. (studio workspace)
- Client sites plány (Light, Core, Business, Elite)
- Agency discounts


---

## 26. Developer platforma – Velo, SDK, API, Headless

### 26.1 Velo by Wix (dříve Corvid)

Fully-stack developer platforma pro rozšíření Wixu:

**Frontend:**
- JavaScript + TypeScript
- **`$w` API** pro manipulaci s page elementy
- Event handlers (onClick, onChange, onReady)
- Dynamic content
- Custom animations
- Third-party libraries přes npm

**Backend:**
- **Web Modules** (server-side functions)
- Event handlers (beforeSaveOrder, onOrderPaid, atd.)
- Scheduled jobs (cron-like)
- **HTTP Functions** (REST endpoints)
- **Service Plugins** (custom integrace)

**Database:**
- **Wix CMS** (formálně Data Collections)
- Typed collections
- Reference fields
- Permissions per collection
- External database integration (MySQL, MongoDB přes connectors)

### 26.2 Wix SDK (2026)

Nová unified SDK – nahrazuje Velo client API:
- **Lightweight**
- **TypeScript-first**
- **Modular** (importujete jen co potřebujete)
- **Cross-platform** (web, headless, mobile apps)
- **React components**
- **Astro framework** (pro Vibe / Harmony)

### 26.3 Wix Headless

Pro vlastní frontend mimo Wix Editor:
- Connect existing React / Next.js / Astro / Vue / Svelte app
- Wix jako CMS + backend
- Use Wix APIs pro produkty, orders, checkout
- Oxygen-like hosting přes Wix (limited)
- Or bring-your-own-hosting (Vercel, Netlify, Cloudflare)

### 26.4 APIs

**Wix APIs (REST + JavaScript SDK):**
- **Stores API**
  - Products V3 (nový)
  - Collections
  - Inventory Items
  - Variants
  - Brands
  - Ribbons
  - Customizations
  - Info Sections
- **Orders API**
- **Cart API**
- **Checkout API**
- **Payments API**
- **Subscriptions API**
- **Shipping API**
- **Taxes API**
- **Bookings API**
- **Events API**
- **Blog API**
- **CMS API**
- **Members API**
- **Contacts API**
- **Marketing API** (Email, Automations, Coupons)
- **Loyalty API**
- **Reviews API**
- **Forms API**
- **Files API**
- **SEO API**

### 26.5 Webhooks

- Orders created / updated / fulfilled / cancelled / refunded
- Products created / updated / deleted
- Customer created / updated
- Booking created / canceled
- Form submission
- Member registered
- Event RSVP
- Subscription renewed

### 26.6 OAuth & Authentication

- OAuth 2.0 pro third-party apps
- JWT tokens
- Member SSO
- SAML (Enterprise)

### 26.7 Custom Apps

- Public apps (na Wix App Market)
- Private apps (pro jednu instalaci)
- Dashboard extensions
- Site plugins
- Business solutions integrations

### 26.8 App development

- **Wix Developers Center**
- **CLI** (Astro CLI, Wix CLI)
- **Local development** s emulátorem
- **Preview mode**
- **App review** (5–15 pracovních dní)

### 26.9 External APIs & Integrations

- npm packages (většina)
- External databases (MongoDB, MySQL, Postgres)
- Third-party APIs (fetch, axios)
- Zapier (1 000+ apps)
- Make (Integromat)
- IFTTT

### 26.10 Limity

- Velo kód má rate limits
- Některé backend operace limit 10 000 read/write per day (základní tier)
- File size limits (max. 25 MB per soubor v CMS)
- Funkce timeout (30 s)

### 26.11 Version control

- Velo má vestavěný version history
- Git integrace přes Wix Studio (experimental)
- GitHub sync pro Vibe projects

---

## 27. Wix App Market

### 27.1 Přehled

- Přes **500 aplikací** (oproti 8 000+ u Shopify)
- Kategorizované do oblastí:
  - Marketing
  - Sales
  - Analytics
  - Finance
  - Customer service
  - Social
  - Booking & Scheduling
  - Forms
  - Design
  - Productivity

### 27.2 Nativní Wix aplikace (zdarma)

**E-commerce:**
- Wix Stores
- Wix Invoices
- Wix Loyalty Program
- Wix Reviews
- Wix Pricing Plans (subscriptions)
- Wix Forms

**Marketing:**
- Wix Email Marketing
- Wix Automations
- Wix Chat
- Wix Inbox
- Wix Ads Manager
- Wix Social Post

**Content:**
- Wix Blog
- Wix Video
- Wix Podcast
- Wix Forum (deprecated)
- Wix Challenges

**Community:**
- Wix Members Area
- Wix Groups
- Wix Events

**Services:**
- Wix Bookings
- Wix Restaurants
- Wix Hotels
- Wix Table Reservations

**Utility:**
- Wix Forms
- Wix File Share
- Wix Multilingual
- Wix SEO Wiz

### 27.3 Populární třetí strany

**Marketing:**
- Mailchimp
- ActiveCampaign
- Klaviyo
- HubSpot
- Intercom

**Analytics:**
- Google Analytics 4
- Facebook Pixel
- Microsoft Clarity
- Hotjar

**Shipping:**
- Sendcloud
- Shippo
- ShipStation
- AfterShip

**Dropshipping:**
- Printful
- Printify
- Modalyst
- Spocket
- Syncee (AliExpress)
- DSers

**Reviews:**
- Judge.me
- Loox
- Yotpo

**Accounting:**
- QuickBooks
- Xero
- FreshBooks

**CRM:**
- HubSpot
- Salesforce
- Pipedrive

**Chat:**
- Tidio
- LiveChat
- Drift
- Tawk.to

**Social proof:**
- Fomo
- Trustpilot
- Site Reviews

### 27.4 App pricing

- Free (s limitated features)
- Freemium
- Subscription (3–50+ USD/měs.)
- One-time fee
- Transaction-based

### 27.5 Omezení App Marketu

- **Výrazně menší než Shopify App Store** (500 vs 8 000+)
- **Méně pokročilých apps** v některých kategoriích (B2B, warehouse management)
- **App blocks nejsou standardizované** jako u Shopify
- **Quality varies** – některé apps jsou staré

---

## 28. Bezpečnost, hosting a infrastruktura

### 28.1 Hosting

- **Multi-cloud infrastruktura** (AWS + Google Cloud + vlastní)
- **Globální CDN** (Wix, plus CloudFlare integrace)
- **Auto-scaling**
- **DDoS protection**
- **99,98 % uptime SLA** (Enterprise)

### 28.2 Automatické aktualizace

- Platform updates bez downtime
- Security patches automaticky
- Feature releases průběžně

### 28.3 Zálohy

- Daily backups
- Site history (rollback previous versions)
- Data redundancy (multi-region)

### 28.4 SSL

- **Free SSL certifikát** (Let's Encrypt)
- Automatická obnova
- Wildcard podpora (Enterprise)

### 28.5 DDoS protection

- Multi-layered
- Rate limiting
- Bot detection
- Traffic analysis

### 28.6 Platební bezpečnost

- **PCI DSS Level 1**
- **3D Secure 2**
- **Tokenization**
- **Fraud analysis**
- **Chargeback protection** (přes Wix Payments)

### 28.7 Data privacy

- **GDPR compliant**
- **CCPA compliant**
- **LGPD (Brazílie)**
- **Customer Privacy API**
- **Cookie banner** (zdarma)
- **Right to erasure** (GDPR)
- **Data export** (user)

### 28.8 Certifikace

- **PCI DSS Level 1**
- **SOC 2 Type II**
- **ISO 27001**
- **ISO 27017** (cloud security)
- **ISO 27018** (PII in cloud)
- **HIPAA-ready** (Enterprise, healthcare)

### 28.9 User security

- **2FA** (SMS, authenticator app)
- **SSO** (Enterprise, SAML 2.0)
- **Session management**
- **IP restrictions** (Enterprise)
- **Audit logs** (Enterprise)
- **Password policies**

### 28.10 Reporting

- **Wix Security Status** page
- **Bug bounty** program na HackerOne
- **Security advisories** subscribing

---

## 29. Podpora a vzdělávání

### 29.1 Support tiers

| Plán | Support |
|---|---|
| Free | Help Center jen |
| Light | 24/7 chat + callback |
| Core | 24/7 chat + callback + priority |
| Business | 24/7 chat + priority callback |
| Business Elite | Priority 24/7 phone + dedicated |
| Enterprise | Dedicated account manager, SLA |

### 29.2 Help Center

- **support.wix.com** – tisíce článků
- Searchable
- Video tutorials
- Step-by-step guides
- Known issues tracker

### 29.3 Wix Learn

- Free online courses
- Certifications
- Webinars
- Workshop videos
- SEO Learning Hub
- Design University

### 29.4 Wix Blog

- Tutorials
- Industry insights
- Tips for merchants

### 29.5 Community

- Wix Community Forum
- Official Facebook groups
- Reddit r/WixHelp

### 29.6 Wix Partners program

- **Wix Partners** – pro web professionals
- **Wix Studio Partners** – pro agentury
- Partner certifications
- Revenue share / referrals
- Early access k novým funkcím
- Partner Academy

### 29.7 Marketplace of Experts

- Hire Wix expert pro design, SEO, marketing, development
- Ratings & reviews
- Fixed pricing tiers

### 29.8 Wix Events & Conferences

- Wix Playground (design community)
- Tel Aviv Studio events
- Virtual summits

---

## 30. Známá omezení a nevýhody

### 30.1 Technická omezení

- **Šablonu nelze změnit** po publikaci (musíte začít znovu)
- **Export dat** omezený – Wix vás drží uvnitř ekosystému
- **Velo má rate limits** a funkce timeout (30 s)
- **Max. 50 000 produktů** (standard), 500 000 (Enterprise)
- **Max. 6 product options + 100 choices**
- **Pouze 1 hlavní měna** pro payouts
- **Starší obchody na Catalog V1** mají menší flexibility

### 30.2 E-commerce omezení

- **App Market menší** než u Shopify (500 vs 8 000+)
- **Méně pokročilé B2B** (žádné company accounts, price lists na úrovni Shopify)
- **Returns portal** ne tak robustní jako u Shopify
- **Žádné Order Routing** nativně
- **Žádný bulk discount tool** nativně (jen přes apps)
- **Žádné pokročilé analytics** srovnatelné s Shopify Advanced
- **Multi-currency omezené** (ne na všech platebních branách)

### 30.3 POS omezení

- **Dostupný pouze v USA / Kanadě**
- **Offline mode chybí**
- **Clienteling omezený**
- **Vyžaduje Wix Payments** (lock-in)

### 30.4 Specifika pro ČR

⚠️ Pro český trh je Wix **slabší volba než Shoptet, Upgates nebo Shopify** kvůli:

- **Chybějící nativní integrace** na Zásilkovnu, Českou poštu, PPL, DPD, GLS
- **Wix Payments není v ČR** – nutno Stripe / PayPal / manuální převod
- **Účetní systémy** (Pohoda, Money, FlexiBee) nutné přes Zapier / Make / Velo
- **EET / ARES** – žádná nativní podpora
- **Čeština v editoru** je dostupná, ale některé pokročilé features zůstávají v EN
- **Heureka / Zboží.cz** – export jen přes custom Velo scripting
- **Dobírka** – jen jako custom offline method
- **ComGate / GoPay / ThePay** – integrace jen přes custom Velo

### 30.5 Design / UX omezení

- **Pixel-level volnost → nekonzistence** mezi desktop a mobile
- **Mobile editor** musí být ručně doladěn
- **Šablony někdy "vypadají jako Wix"** (brand recognition)
- **Performance** na komplexních stránkách může být pomalá (vs. statické weby / Shopify)
- **Migrace pryč** je velmi těžká (nejsou standardní exports)

### 30.6 SEO

- **Dříve špatná SEO reputace** (legacy obchody), dnes OK, ale pořád:
- Pomalejší loading než statické sites
- Core Web Vitals nejsou top tier
- Structured data vyžaduje manuální úpravu pro komplexní případy

### 30.7 Lock-in

- **Custom doména můžete odebrat**, ale obsah zůstává ve Wixu
- **Export dat omezený** (jen CSV produktů, orders, contacts)
- **Žádná standardní migrační cesta** k Shopify, WooCommerce, apod.
- **Velo kód nelze přenést** (proprietární)

### 30.8 Cena

- Wix se jeví levně, ale s apps + domain + email + payment fees může rychle narůst
- Enterprise je cenově podobný Shopify Plus, ale méně funkcí v některých kategoriích

---

## Závěr

Wix v roce 2026 představuje **nejflexibilnější all-in-one platformu** pro tvorbu webů a online obchodů, s unikátními výhodami:

**Silné stránky:**
- **Nepřekonatelná designová volnost** (drag-and-drop)
- **AI nejširší v oboru** (Astro, Harmony, Vibe, Base44)
- **All-in-one** – web + e-shop + rezervace + restaurace + events + hotely + CRM + email
- **2 500+ šablon**
- **Multi-channel** (social, marketplaces, POS v USA/CA)
- **Nízká vstupní bariéra** (free tier, Light 17 USD)
- **Členská oblast a komunitní funkce** na úrovni nikoho jiného

**Slabé stránky:**
- **Menší App Market** než Shopify
- **Omezené pokročilé e-commerce** (B2B, returns, warehouse)
- **POS jen v USA/CA**
- **Chybějící lokalizace pro ČR** (brány, dopravci, účetnictví)
- **Lock-in efekt** – obtížná migrace pryč

**Pro koho se Wix hodí:**
- Kreativci a freelanceři (portfolio + prodej)
- Malé obchody s orientací na design
- Restaurace a cafe
- Poskytovatelé služeb s rezervacemi (terapeuti, kosmetičky, fitness)
- Multi-business (web + e-shop + blog + events)
- Startupy s AI podporou vývoje
- Lokální podniky v USA/Kanadě (POS)

**Pro koho méně:**
- Vysokoobjemové e-shopy (Shopify je lepší)
- B2B / wholesale (Shopify Plus / Shopware)
- Enterprise s komplexní infrastrukturou (Magento / Adobe Commerce)
- České obchody s potřebou integrace na Zásilkovnu, EET, účetnictví (Shoptet / Upgates)
- Headless-first projekty (Hydrogen, vlastní stack)

**Shrnutí v kontextu ČR:**
V Česku je Wix jasně **lepší volba pro malé obchody s kombinací služeb, blogu a e-shopu**, ale **slabší pro klasické e-commerce** kvůli chybějícím integracím na lokální dopravce, platby a účetnictví. Většina českých e-shopů i nadále volí **Shoptet (SaaS lokální) nebo WooCommerce (open-source)**, zatímco Wix se uplatňuje u kreativců, malých značek, restaurací a freelancerů.

---

*Dokument sestaven na základě oficiální dokumentace Wix (support.wix.com, dev.wix.com, www.wix.com), Help Center článků, nezávislých analýz (Tooltester, WebsiteBuilderExpert, ALM Corp, LitExtension, FireBear Studio, Craftybase, Kensium a další) a Wix produktových oznámení (Wix Harmony leden 2026, Catalog V3 rollout 2025/2026) – duben 2026.*

