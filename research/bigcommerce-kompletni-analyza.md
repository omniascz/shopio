# BigCommerce (Commerce.com) – Kompletní hloubková analýza všech funkcí, modulů a featur

> **Stav:** duben 2026 (zahrnuty BigSummit 2025 oznámení, rebranding na Commerce.com, Catalyst 2.0, Makeswift integrace, Feedonomics SMB expansion)
> **Rozsah:** celá platforma BigCommerce – Essentials, Enterprise, B2B Edition, Catalyst, Feedonomics, Makeswift, Multi-Storefront, APIs
> **Zdroje:** oficiální BigCommerce Help Center, developer.bigcommerce.com, BigCommerce Blog, BigSummit 2024/2025 oznámení, nezávislé analýzy

---

## Obsah

1. [Co je BigCommerce a firemní kontext](#1-co-je-bigcommerce-a-firemní-kontext)
2. [BigCommerce Essentials vs. Enterprise](#2-bigcommerce-essentials-vs-enterprise)
3. [Tarify a cenové plány](#3-tarify-a-cenové-plány)
4. [BigCommerce Control Panel – administrace](#4-bigcommerce-control-panel--administrace)
5. [Produkty a katalog](#5-produkty-a-katalog)
6. [Sklad a inventory management](#6-sklad-a-inventory-management)
7. [Objednávky a fulfillment](#7-objednávky-a-fulfillment)
8. [Zákazníci a customer management](#8-zákazníci-a-customer-management)
9. [Checkout a platební systém](#9-checkout-a-platební-systém)
10. [Doprava a dodání](#10-doprava-a-dodání)
11. [Daně a compliance](#11-daně-a-compliance)
12. [Stencil – tématický engine](#12-stencil--tématický-engine)
13. [Page Builder a Makeswift](#13-page-builder-a-makeswift)
14. [Catalyst – headless storefront](#14-catalyst--headless-storefront)
15. [Multi-Storefront – více obchodů pod jedním účtem](#15-multi-storefront--více-obchodů-pod-jedním-účtem)
16. [B2B Edition](#16-b2b-edition)
17. [International – mezinárodní prodej](#17-international--mezinárodní-prodej)
18. [Marketing a prodejní kanály](#18-marketing-a-prodejní-kanály)
19. [Feedonomics – omnichannel feed management](#19-feedonomics--omnichannel-feed-management)
20. [Slevy, promoakce a věrnostní programy](#20-slevy-promoakce-a-věrnostní-programy)
21. [SEO a obsah](#21-seo-a-obsah)
22. [Analytika a reporting](#22-analytika-a-reporting)
23. [AI v BigCommerce](#23-ai-v-bigcommerce)
24. [Developer platforma – API, Stencil CLI, Webhooks](#24-developer-platforma--api-stencil-cli-webhooks)
25. [BigCommerce App Marketplace](#25-bigcommerce-app-marketplace)
26. [Bezpečnost, hosting a infrastruktura](#26-bezpečnost-hosting-a-infrastruktura)
27. [Podpora a vzdělávání](#27-podpora-a-vzdělávání)
28. [Známá omezení a nevýhody](#28-známá-omezení-a-nevýhody)

---

## 1. Co je BigCommerce a firemní kontext

BigCommerce (od 2025 zastřešeno značkou **Commerce.com**) je americká SaaS e-commerce platforma založená 2009 v Sydney v Austrálii, s pozdějším přesunem hlavního sídla do Austinu v Texasu (USA). Veřejně obchodovaná na NASDAQ (ticker: **BIGC**) od srpna 2020.

**Zakladatelé:** Eddie Machaalani a Mitchell Harper

**Klíčová čísla (2026):**

- Přes **40 000** aktivních obchodů
- **0,3 % globálního podílu** na e-commerce platformách (podle StoreLeads)
- ~3–5 % globálního trhu e-commerce platforem (podle dalších zdrojů)
- **#1 B2B platforma v Paradigm 2025 Mid-Market Report**
- **12M+ produktů synced** napříč kanály přes Feedonomics
- Zaměstnanci: ~1 500

**Akvizice:**

- **Feedonomics** (2021, ~$300M) – omnichannel product feed management
- **Makeswift** (2024) – vizuální page builder
- **Mythic Markets** (menší)

**Rebranding 2025:**
Na BigSummit 2025 oznámeno, že mateřská značka bude **Commerce.com** – zastřešuje tři hlavní produkty:

- **BigCommerce** (e-commerce platforma)
- **Feedonomics** (feed management)
- **Makeswift** (page builder)

**Pozicování:**

- "Open SaaS" – kombinace SaaS pohodlí + open flexibilita
- Cílová skupina: **mid-market B2B a B2C** s obraty 500K – 100M USD
- Konkurent Shopify, silnější v B2B, slabší v mass-market

**Hlavní výhody:**

- **Žádné transaction fees** na všech plánech
- **Nativní B2B funkce** (nikoliv jen apps)
- **Headless-first approach** s Catalyst
- **Multi-Storefront** z jednoho dashboardu
- **140+ měn**, **65+ platebních poskytovatelů**
- **Feedonomics** integrovaný pro marketplace selling
- Povinné upgrady plánů podle GMV (automatické)

**Slabé stránky:**

- Méně apps než Shopify (1 000+ vs. 8 000+)
- Méně populární → menší komunita designérů
- Strmější learning curve (složitější než Shopify)
- Některé pokročilé features jen na Enterprise
- Povinný upgrade plánu při překročení GMV cap

---

## 2. BigCommerce Essentials vs. Enterprise

BigCommerce má **dvě hlavní varianty**:

### 2.1 BigCommerce Essentials

- Self-serve tier
- Standard, Plus, Pro plány
- Do obratu ~400 000 USD/rok
- Kreditní karta, sign-up online
- Bez dedicated account managera
- Cílí na SME (small to medium enterprises)

### 2.2 BigCommerce Enterprise

- Negotiated pricing (od ~$1 000/měs., reálně $2 000–$15 000+/měs.)
- Custom contract
- **Dedicated Customer Success Manager**
- **Priority support**
- **Advanced API limits**
- **Custom SLAs**
- **B2B Edition** bundled (nebo add-on)
- **Multi-Storefront** plně
- **Catalyst** optimalizovaný
- Cílí na mid-market a enterprise

### 2.3 Commerce.com struktura (2025+)

Pod Commerce.com značkou:

- **BigCommerce** → platforma
- **Feedonomics** → marketplace feeds (+ SMB varianta)
- **Makeswift** → visual page builder (pro Stencil i Catalyst)

Všechno se dá kombinovat, ale Enterprise plán typicky zahrnuje víc v ceně.

---

## 3. Tarify a cenové plány

BigCommerce má unikátní **revenue-based tier system** – musíte upgradovat, když překročíte určitý GMV cap.

### 3.1 Free Trial

- **15denní trial** (bez kreditní karty)
- Plný přístup ke všem funkcím
- Nemůžete přijímat reálné platby
- Dostatečné na setup a test

### 3.2 Standard – 39 USD/měs. (měsíčně) / 29 USD/měs. (roční)

**GMV cap: 50 000 USD/rok**

- Neomezené produkty
- Neomezená bandwidth a storage
- **Unlimited staff accounts** (!)
- Apple Pay, Google Pay, Amazon Pay support
- **0% transaction fee** (zásadní výhoda)
- **Real-time shipping quotes** (v základu)
- **Product reviews**
- **Reporting tools** (základní)
- **Multi-channel selling** (Google Shopping, Facebook, Instagram, TikTok, Amazon, eBay, Walmart, Pinterest)
- **Basic discounts** a coupons
- **Basic blog**
- **SSL zdarma**
- **24/7 live chat** support
- **Stencil themes**
- **Page Builder**
- **BigDesign framework**

**Credit card rates (USA):** 2,9% + 0,30 USD (karty online)

### 3.3 Plus – 105 USD/měs. (měsíčně) / 79 USD/měs. (roční)

**GMV cap: 180 000 USD/rok**

Přidává:

- **Customer groups** (custom pricing)
- **Persistent cart** (uložený košík mezi zařízeními)
- **Abandoned cart saver** (automatic recovery emails)
- **Stored credit cards** (returning customers, PCI-compliant tokenization)
- **Custom checkout**
- **Customer segments** (pro marketing)

**Credit card rates:** 2,5% + 0,30 USD (lower než Standard)

### 3.4 Pro – 399 USD/měs. (měsíčně) / 299 USD/měs. (roční)

**GMV cap: 400 000 USD/rok**

Přidává:

- **Google customer reviews**
- **Product filtering** (faceted search)
- **Custom SSL certificate** (brand domain SSL)
- **Product filtering search**
- **Priority support**
- **Advanced reporting** (custom reports)
- **Faceted search** (ultra-flexible filtering)
- **Store credit**

**Credit card rates:** 2,2% + 0,30 USD (nejnižší v standard plánech)

### 3.5 Enterprise – od 1 000–2 300 USD/měs. (custom)

**Bez GMV capu** (negotiated)

Přidává:

- **Price lists** (advanced B2B pricing)
- **Customer provisioning API**
- **Dedicated Customer Success Manager**
- **Priority technical support**
- **Advanced reporting** (BI level)
- **Higher API limits** (400% vs. Pro)
- **Multi-Storefront** (B2B, regional, brand variants)
- **Single Sign-On (SSO)**
- **Advanced security** (penetration testing, compliance audits)
- **Custom contract terms**
- **Uptime SLA**
- **B2B Edition available**
- **Unlimited API calls** (effectively)

### 3.6 B2B Edition (add-on)

Samostatný add-on pro pokročilé B2B funkce. Dostupný na Pro+ plánech.

- Custom pricing (100–1 000+ USD/měs. podle velikosti)
- Přináší Buyer Portal, quote management, PO workflows, company accounts

### 3.7 Srovnávací tabulka

| Funkce               | Standard  | Plus      | Pro       | Enterprise      |
| -------------------- | --------- | --------- | --------- | --------------- |
| Cena (roční) USD     | 29        | 79        | 299       | 1 000+          |
| GMV cap              | $50K      | $180K     | $400K     | ∞               |
| Neomezené produkty   | ✅        | ✅        | ✅        | ✅              |
| Staff accounts       | ∞         | ∞         | ∞         | ∞               |
| Transaction fee      | 0%        | 0%        | 0%        | 0%              |
| CC rate (online, US) | 2,9%+0,30 | 2,5%+0,30 | 2,2%+0,30 | negotiated      |
| Abandoned cart       | ❌        | ✅        | ✅        | ✅              |
| Persistent cart      | ❌        | ✅        | ✅        | ✅              |
| Customer groups      | ❌        | ✅        | ✅        | ✅              |
| Custom SSL           | ❌        | ❌        | ✅        | ✅              |
| Product filtering    | ❌        | ❌        | ✅        | ✅              |
| Price lists          | ❌        | ❌        | ❌        | ✅              |
| Priority support     | ❌        | ❌        | ✅        | ✅              |
| Multi-Storefront     | ❌        | ❌        | limited   | ✅              |
| B2B Edition          | add-on    | add-on    | add-on    | included/add-on |

### 3.8 Automatic plan upgrade

⚠️ **Unique feature (a taky potenciální nevýhoda):**

Když váš rolling 12-month GMV dosáhne capu, BigCommerce vás automaticky upgraduje na vyšší plán. Nevyhnete se – musíte buď zaplatit víc, nebo migrovat.

- Standard → Plus při $50K GMV
- Plus → Pro při $180K GMV
- Pro → Enterprise při $400K GMV (jednání)

Toto je některými merchants kritizováno jako "penalizace za růst", ale na druhou stranu získáváte pokročilé funkce automaticky.

### 3.9 Skryté náklady

- **Domain**: 10–25 USD/rok (BigCommerce neprodává domény – musíte u registrátora)
- **Premium themes:** 150–400 USD jednorázově
- **Apps:** 10–200 USD/měs. (subscriptions, loyalty, reviews, atd.)
- **Feedonomics:** custom pricing
- **B2B Edition:** custom pricing
- **Makeswift Pro:** custom pricing
- **Implementation partners:** 5 000–100 000+ USD (agentury)
- **Catalyst development:** developer costs (Next.js expertise)

---

## 4. BigCommerce Control Panel – administrace

Control Panel (admin) je webové rozhraní pro správu všech aspektů obchodu.

### 4.1 Home / Dashboard

- **Sales overview** (dnes, 7 dní, 30 dní, custom)
- **Order count**
- **Visitor count**
- **Conversion rate**
- **Popular products**
- **Top traffic sources**
- **Latest orders**
- **Abandoned carts** (Plus+)
- **Alerts & notifications**
- **Quick actions**

### 4.2 Orders

- **View orders** – filtry, search, bulk actions
- **Order details** – comprehensive detail
- **Draft orders** – manual order creation
- **Abandoned carts** (Plus+)
- **Gift certificates**
- **RMA (Returns Merchandise Authorization)**
- **Transactions**
- **Shipping manifests**

### 4.3 Products

- **View products**
- **Add product**
- **Import / export**
- **Categories**
- **Brands**
- **Product options** (variants)
- **Option sets**
- **Modifier options**
- **Product reviews**
- **Product videos**

### 4.4 Customers

- **View customers**
- **Customer groups**
- **Add customer**
- **Import / export**
- **Customer segments**
- **Reviews**

### 4.5 Marketing

- **Promotions** (automatic discounts)
- **Coupon codes**
- **Gift certificates**
- **Abandoned cart emails** (Plus+)
- **Banners**
- **Email templates**

### 4.6 Analytics

- **Dashboard**
- **Marketing**
- **Merchandising**
- **Orders**
- **Customers**
- **Store overview**
- **In-store search**
- **Real-time** (live view)
- **Custom reports** (Pro+)

### 4.7 Storefront

- **Themes**
- **Pages**
- **Navigation**
- **Web pages**
- **Script Manager** (custom JS)
- **Email templates**
- **Currencies**
- **Blog**
- **Newsletter subscribers**

### 4.8 Channel Manager

- **Sales channels** (online store, marketplaces, POS, social, headless)
- **Storefront channels** (více Stencil nebo Catalyst storefronts)
- **App channels** (custom channels přes API)
- **Multi-Storefront management**

### 4.9 Apps

- **Marketplace** (BigCommerce App Store)
- **My Apps** (installed)
- **My Drafts** (custom apps in progress)

### 4.10 Settings

- **Store settings** – profile, logo, localization
- **Domain names**
- **SSL certificates**
- **Checkout**
- **Shipping**
- **Tax**
- **Payments**
- **Currencies**
- **Accounts**
- **Notifications**
- **Permissions** (staff roles)
- **Data solutions**
- **API accounts**
- **Webhooks**
- **Advanced settings**

### 4.11 BigCommerce mobile app

- iOS, Android
- Orders overview
- Customer management
- Product editing
- Push notifications
- Limited ve srovnání s desktopem

---

## 5. Produkty a katalog

### 5.1 Product types

- **Physical product**
- **Digital product** (download)
- **Service** (no shipping)
- **Gift certificate**
- **Event/ticket** (přes apps)
- **Subscription** (přes apps)

### 5.2 Product details

Každý produkt má:

- **Product name** (max. 250 znaků)
- **Description** (rich text editor s HTML)
- **Short description**
- **Categories** (unlimited, hierarchical)
- **Brand** (assigned or created)
- **Product type** (custom field)
- **SKU**
- **Product weight**
- **Product width / height / depth** (dimensions)
- **Price**
- **Cost price** (for margin reports)
- **Retail price** (MSRP comparison)
- **Sale price**
- **Tax class**
- **Product images** – **unlimited**, až 20 MB každý
- **Product videos** (YouTube, Vimeo, hosted)
- **Custom fields** (unlimited key-value)
- **Product UPC/EAN/ISBN**
- **Manufacturer Part Number (MPN)**
- **Warranty info**
- **Availability text**
- **Available for sale/not**
- **Product tax code**
- **Pre-order** settings
- **Minimum purchase quantity**
- **Maximum purchase quantity**

### 5.3 SEO per produkt

- **Page title** (custom)
- **Meta description**
- **Meta keywords** (legacy)
- **URL slug** (editovatelný)
- **Search keywords**

### 5.4 Product variants (options)

BigCommerce má sofistikovaný **product options system**:

**Product Options:**

- Velikost, barva, materiál, styl, atd.
- Unlimited options per product
- Unlimited choices per option
- **Rectangles, swatches, radio buttons, dropdown, checkbox**

**Option Sets:**

- Reusable option groups
- Pro konzistenci napříč produkty

**Variants:**

- Auto-generated kombinace options
- Per-variant SKU, price, weight, image, inventory
- **Modifier options** (nejsou varianta, ale customizace):
  - Text field
  - Text area
  - File upload
  - Date picker
  - Checkbox

### 5.5 Related/Featured products

- **Related products** (auto or manual)
- **Featured products**
- **Bestsellers**
- **Top products** (automatic)
- **Recently viewed**

### 5.6 Product images

- **Unlimited images** per produkt
- **Max 20 MB** per obrázek
- **Automatic CDN delivery**
- **Multiple product images**
- **Variant-specific images**
- **Image zoom**
- **Image optimization** (WebP, responsive)
- **Alt text** (SEO)
- **Thumbnail customization**

### 5.7 Product videos

- **YouTube embed**
- **Vimeo embed**
- **Self-hosted video** (přes external hosting)

### 5.8 Digital products

- **File size:** až 512 MB per file
- **Multiple files** per produkt
- **Automatic delivery** po zaplacení
- **Download limit** (počet stažení)
- **Link expiration**
- **Max downloads per customer**

### 5.9 Custom fields

Unlimited custom fields per produkt:

- Key-value pairs
- Visible on storefront (volitelně)
- Useful pro specifications, care instructions, technical data

### 5.10 Product categories

- **Unlimited hierarchy**
- **Subcategories**
- **Category images**
- **Category descriptions**
- **Category SEO**
- **Custom category sorting**
- **Featured products per category**

### 5.11 Brands

- Samostatná entita
- Brand pages (SEO)
- Brand logo, description
- Produkty attachnuté k brandu
- Brand filter

### 5.12 Bulk operations

- **CSV import/export** pro produkty, kategorie, brands, customers
- **Bulk edit** v admin (select, change field)
- **Bulk delete**
- **API bulk** (pro velké množství)

### 5.13 Product limit

- **Unlimited products** na všech plánech
- Practical limit: 10 000+ produktů začíná zpomalovat admin bez optimalizace
- Enterprise může mít 100 000+ SKU bez problémů

### 5.14 Product Feed

- Auto-generated XML/JSON feed
- Google Shopping feed
- Facebook Catalog
- Přes Feedonomics (viz sekce 19)

### 5.15 Stock levels

- Track stock per product/variant
- Low stock notifications
- Out of stock handling
- Pre-order options
- Back-in-stock notifications (přes apps)

### 5.16 Pre-orders

- Allow pre-order
- Custom pre-order message
- Expected ship date
- Preorder-specific pricing

### 5.17 Product tags

- Unlimited tags
- Filter products by tag
- SEO benefits (tag pages)

### 5.18 Bulk pricing (native)

- **Bulk discount rules** per produkt
- Tier: Buy 5+ get 10% off
- Automatic application
- Dostupné na všech plánech (!)

### 5.19 Gift wrapping

- Offer gift wrapping as option
- Paid or free
- Per-order or per-item
- Custom message

### 5.20 Product reviews (native)

- **Built-in review system** (všechny plány)
- **Star ratings** (1-5)
- **Text reviews**
- **Photo reviews**
- **Moderation**
- **Email request** post-purchase
- **Google Customer Reviews** integrace (Pro+)
- **Schema.org markup**

---

## 6. Sklad a inventory management

### 6.1 Inventory tracking

BigCommerce má tři úrovně inventory tracking:

- **Don't track inventory** (unlimited stock)
- **Track by product** (jeden stock per produkt)
- **Track by variant** (individuální stock per varianta)

### 6.2 Inventory levels

- **Current stock**
- **Low stock level** (threshold for alerts)
- **Out of stock behavior:**
  - Hide product
  - Show as "out of stock"
  - Allow purchase (backorder)

### 6.3 Bulk inventory updates

- CSV import
- API endpoints
- Manual bulk edit

### 6.4 Low stock alerts

- Email notifications
- Dashboard warnings
- Customizable thresholds

### 6.5 Multi-location inventory (Enterprise)

BigCommerce přidal multi-location inventory v 2023:

- **Multiple warehouses/locations**
- **Per-location stock levels**
- **Order routing** podle locations
- **Transfer mezi locations** (přes API)
- **Location-specific shipping rules**

⚠️ **Na Essentials plánech (Standard, Plus, Pro) je multi-location omezené.** Plná funkcionalita je na Enterprise.

### 6.6 Inventory history

- Activity log (kdo, co, kdy)
- Adjustments s reasons
- Export historie

### 6.7 Inventory APIs

- **Read inventory** API
- **Update inventory** API
- **Webhooks** při změně stocku
- Sync s ERP/WMS systems

### 6.8 Integrace s inventory management

Přes apps:

- **Cin7**
- **SKULabs**
- **Brightpearl**
- **Katana**
- **Ordoro**
- **ShipBob WMS**
- **Linnworks**

### 6.9 Omezení

- **Bez nativního purchase orders** (přes apps)
- **Bez forecasting** nativně
- **Multi-location plně jen na Enterprise**
- **Omezený barcode scanner** (přes 3rd party POS)

MARKDOWN_EOF
wc -l /home/claude/bigcommerce/bigcommerce-kompletni-analyza.md

---

## 7. Objednávky a fulfillment

### 7.1 Order lifecycle

BigCommerce používá detailní stavový systém:

**Order Statuses:**

- Incomplete
- Pending
- Awaiting Payment
- Awaiting Fulfillment
- Awaiting Shipment
- Awaiting Pickup
- Partially Shipped
- Completed
- Shipped
- Cancelled
- Declined
- Refunded
- Disputed
- Manual Verification Required
- Partially Refunded

### 7.2 Order detail

- **Order ID** (customizable prefix)
- **Customer info** (name, email, phone, billing, shipping)
- **Products ordered** s variants
- **Subtotal, tax, shipping, discount, total**
- **Payment method** (s transaction IDs)
- **Tracking numbers** (multiple per objednávce)
- **Custom fields**
- **Order notes** (internal + customer)
- **Activity log**
- **Shipments**
- **Returns (RMA)**

### 7.3 Fulfillment workflow

- **Manual fulfillment**
- **Partial fulfillment** (různé položky různě)
- **Multiple shipments**
- **Bulk fulfillment**
- **Automatic** (pro digital products)
- **Print packing slip**
- **Print shipping label**
- **Export** to ShipStation, Shippo

### 7.4 Shipping labels

**Native shipping labels (USA):**

- **USPS, UPS, FedEx, DHL Express**
- Discounted rates
- Batch printing
- Void labels

**Přes apps (globálně):**

- **ShipStation**
- **Shippo**
- **Sendcloud** (EU)
- **ShipBob** (3PL)
- **Easyship**

### 7.5 Tracking

- **Manual tracking number** entry
- **Auto-email** zákazníkovi
- **Multiple tracking numbers** per objednávce
- **Tracking URL**
- **AfterShip integration**

### 7.6 Email notifications

Pre-built templates:

- Order confirmation
- Order shipped
- Order completed
- Refund confirmation
- Order cancellation
- Admin new order
- Admin low inventory
- Return authorization
- Gift certificate sent
- Welcome email
- Abandoned cart (Plus+)

Customizable v admin nebo přes HTML.

### 7.7 Abandoned cart recovery (Plus+)

- **Up to 3 automated emails**
- **Customizable timing** (1 hour, 24 hours, 48 hours)
- **Discount coupons** v emailu
- **Conversion tracking**
- **Dashboard reporting**

### 7.8 Persistent cart (Plus+)

- Košík zachovaný mezi zařízeními
- Signed-in customer vidí košík na všech zařízeních
- Zvyšuje konverzi

### 7.9 Draft orders

- Manual order creation
- Pro phone orders, B2B quotes
- Send payment link
- Custom pricing

### 7.10 Refunds

- **Full / partial refund**
- **Refund specific items**
- **Refund shipping**
- **Refund to original payment method**
- **Store credit** refund

### 7.11 Returns (RMA)

**Native RMA system:**

- Customer-initiated return requests
- Return reasons (customizable)
- Return status tracking
- Exchange support
- Refund nebo store credit
- Admin approval workflow

### 7.12 Fraud detection

- **Native fraud scoring**
- **3D Secure** support
- **AVS + CVV checks**
- **Flagged orders** review
- **Manual verification**
- Integrace s NoFraud, Signifyd

### 7.13 Gift certificates

- Digital gift certificates
- Custom values
- Redemption code
- Expiration dates
- Scheduled delivery
- Balance tracking

### 7.14 Store credit

- Issue store credit (refunds, promotions)
- Customer account balance
- Applied automatically at checkout

---

## 8. Zákazníci a customer management

### 8.1 Customer accounts

- **Guest checkout**
- **Customer registration**
- **Account login** (password nebo magic link)
- **Order history**
- **Saved addresses**
- **Stored credit cards** (Plus+, tokenized)
- **Wishlist** (přes apps)
- **Reviews**
- **Store credit balance**
- **Gift certificate balance**

### 8.2 Customer groups (Plus+)

Segmentace se speciálními pravidly:

- **Custom pricing per skupina**
- **Visible products per skupina**
- **Category access restrictions**
- **Custom discounts**
- **Tax-exempt statuses**
- Great pro B2B (VIP, wholesale, dealer)

### 8.3 Customer segments (Plus+)

Dynamic segmenty pro marketing:

- Based on order history
- Based on total spend
- Based on location
- Based on custom attributes
- Used in promotions, email targeting

### 8.4 Customer import/export

- CSV import with all fields
- Bulk assign to groups
- Export pro CRM sync

### 8.5 Customer notes

- Internal notes per zákazníka
- Visible k admin staff
- Activity timeline

### 8.6 Customer communication

Přes apps:

- **Gorgias** (help desk)
- **Zendesk**
- **Intercom**
- **LiveChat**
- **Tidio**

### 8.7 Wishlist

⚠️ **Wishlist v Stencil themes je v core od 2025.** Předtím jen přes apps.

- Customer-side wishlist page
- Share wishlist (URL)
- Move to cart
- Multiple wishlists per customer

### 8.8 Customer reviews

- Request review emails automaticky
- Star ratings + text + photo
- Moderation
- Display na product pages
- Google Customer Reviews (Pro+)

### 8.9 Privacy

- **GDPR compliance**
- **CCPA compliance**
- **Cookie consent**
- **Right to erasure**
- **Data export**

---

## 9. Checkout a platební systém

### 9.1 Native checkout (Optimized One-Page Checkout)

- **Single-page checkout**
- **Express payment buttons** nahoře (Apple Pay, Google Pay, PayPal, Amazon Pay)
- **Guest checkout**
- **Account checkout**
- **Discount code field**
- **Gift certificate redemption**
- **Order comments**
- **Custom fields**
- **Shipping options**
- **Tax display**

### 9.2 Customizable checkout

Na **Plus+ plánech:**

- Custom CSS
- Custom fields
- Brand logo, colors
- Reorder sections
- Terms & conditions display

Na **Pro / Enterprise:**

- Full checkout SDK
- Custom checkout JS API
- Rebuild checkout from scratch
- Headless checkout (přes API)

### 9.3 Payment gateways

**65+ platebních poskytovatelů v 2026:**

**Global:**

- **Stripe** (most popular)
- **PayPal**
- **Amazon Pay**
- **Apple Pay, Google Pay** (přes Stripe/Adyen)
- **Square**
- **Adyen**
- **Braintree**
- **Authorize.Net**
- **WorldPay**
- **Cybersource**
- **Checkout.com**
- **Klarna** (BNPL)
- **Afterpay / Clearpay** (BNPL)
- **Affirm** (BNPL)
- **Zip** (BNPL)

**Regional:**

- **Bolt** (USA)
- **Sezzle** (USA)
- **Digital River**
- **Mollie** (EU)
- **iDEAL** (NL)
- **Bancontact** (BE)
- **Sofort** (DE)
- **Giropay** (DE)
- **SEPA Direct Debit**
- **PayU** (East EU, LATAM)
- **Razorpay** (India)
- **2Checkout** (global)

**ČR:**

- **Stripe** (hlavní)
- **PayPal**
- **Mollie** (pokud aktivní v ČR)
- **Manual / bank transfer**
- **Cash on delivery** (COD)
- ❌ ComGate, GoPay, ThePay **pouze přes custom integrace** (ne v oficiálním seznamu)

### 9.4 0% Transaction fee

**Unique BigCommerce advantage:**

- Žádné transaction fees na jakémkoliv plánu
- Ušetří významné částky oproti Shopify Basic (2%)
- Platí se jen processing fees brány

### 9.5 Credit card rates

Nativní CC processing (přes BigCommerce Payments):

- **Standard:** 2,9% + 0,30 USD
- **Plus:** 2,5% + 0,30 USD
- **Pro:** 2,2% + 0,30 USD
- **Enterprise:** negotiated (can go below 2%)

### 9.6 3D Secure 2

- SCA compliance (EU)
- Automatic trigger for qualifying transactions
- Fraud protection

### 9.7 PCI compliance

- **PCI DSS Level 1** out of the box
- **Automatic compliance** (BigCommerce handles)
- No PCI surveys required pro merchant

### 9.8 Subscriptions

⚠️ **BigCommerce nemá native subscriptions.** Nutno:

- **Recharge** (app)
- **Bold Subscriptions**
- **PayWhirl**
- **Ordergroove**

### 9.9 BOPIS (Buy Online, Pickup In Store)

Oznámeno na BigSummit 2024 jako nativní v Stencil (Cornerstone), Catalyst a Checkout:

- Pick up at store
- Delivery window
- Store locator
- Inventory per location

### 9.10 Checkout speed

BigCommerce checkout je známý **rychlostí** – průměr **2,9 s page load**, což je lepší než mnoho konkurentů.

---

## 10. Doprava a dodání

### 10.1 Shipping zones

- **Unlimited zones** by country, state, ZIP
- **Rest of World** fallback
- **Priority** pro zone ordering

### 10.2 Shipping methods

- **Flat rate**
- **Free shipping**
- **Free shipping threshold** (nad X USD)
- **Per item rate**
- **Weight-based**
- **Real-time carrier rates** (USPS, UPS, FedEx, DHL Express) – **dostupné na všech plánech**
- **Custom methods**

### 10.3 Real-time shipping

BigCommerce má **real-time shipping na všech plánech** (Shopify jen na Advanced+):

- USPS
- UPS
- FedEx
- DHL Express
- Canada Post
- Australia Post
- Royal Mail

To je zásadní výhoda proti Shopify Basic.

### 10.4 Shipping rules

- **Per-product shipping**
- **Per-category shipping**
- **Conditional shipping** (if weight > X)
- **Shipping origins** (multi-location)

### 10.5 Pickup

- **In-store pickup**
- **Pickup locations** (multi-location inventory)
- **Custom pickup messages**
- **BOPIS** (nativně od 2024)

### 10.6 Local delivery

- **Delivery zones** by ZIP
- **Per-mile pricing**
- **Time slot booking** (přes apps)
- **Same-day delivery** (přes Onfleet, DoorDash Drive integrations)

### 10.7 Shipping labels

**Native (USA):**

- **USPS Priority, First Class, Express** discounted
- **UPS** Ground, Next Day Air
- **FedEx** Home, 2Day

**Přes apps:**

- ShipStation
- Shippo
- Sendcloud (EU – Zásilkovna, DPD, GLS, PPL)

### 10.8 Tracking

- Auto-email s tracking
- Branded tracking page (přes AfterShip)
- ParcelPanel integration
- Route Protection

### 10.9 Shipping insurance

- Přes Route, Navidium, Shipsurance
- Add-on v checkoutu
- Damage/theft protection

### 10.10 Multi-location inventory shipping

- Order routing based na closest warehouse
- Split shipments
- Partial fulfillment

### 10.11 International shipping

- **Duties & taxes** calculation (Pro+)
- **DDP (Delivered Duty Paid)**
- **DDU (Delivered Duty Unpaid)**
- **Customs forms** (přes ShipStation)
- **Landed cost** display

### 10.12 ČR specifika

- **Žádné nativní integrace** na Zásilkovnu, ČP, PPL, DPD, GLS
- Řešení:
  - **Sendcloud** (EU carriers hub)
  - **Packeta** app (pokud dostupná)
  - **Custom API integrace**
  - **Flat rates** + manual podání

---

## 11. Daně a compliance

### 11.1 Tax management

**Native tax engine:**

- **Manual tax rates** per zone
- **Automatic tax** (Avalara AvaTax integrace – Pro+)
- **Tax classes** (per produkt type)
- **Tax-inclusive vs. exclusive pricing**
- **Tax-exempt customers** (per customer group)

### 11.2 Tax automation

**Avalara AvaTax:**

- Real-time calculation
- USA rooftop-level accuracy
- EU VAT rates
- Automatic nexus tracking
- Compliance filing (add-on)

**TaxJar integration** (alternative)

### 11.3 EU VAT

- EU VAT rates
- Reverse charge (B2B)
- OSS compliance
- VAT ID validation (přes apps)
- Digital goods VAT

### 11.4 USA Tax

- Sales tax
- Marketplace facilitator compliance
- Economic nexus tracking
- Multi-state filing (Avalara)

### 11.5 International

- **GST** (Australia, India, Canada)
- **HST, PST** (Canada)
- **JCT** (Japan)
- **UK VAT**
- Custom tax rules per country

### 11.6 Compliance certifikace

- **PCI DSS Level 1**
- **SOC 2 Type II**
- **SOC 3**
- **ISO 27001**
- **GDPR compliant**
- **CCPA compliant**
- **LGPD** (Brazílie)
- **HIPAA-ready** (Enterprise, limited)

### 11.7 ČR specifika

- **Manual VAT setup** (21%, 15%, 10%, 0%)
- **Bez nativní EET**
- **Bez ARES**
- **Účetní systémy** (Pohoda, Money, FlexiBee) přes Zapier/Make

---

## 12. Stencil – tématický engine

Stencil je BigCommerce's theme framework (analogie Liquid u Shopify).

### 12.1 Stencil architecture

- **Handlebars templating** (ne Liquid jako Shopify)
- **Sass/SCSS** pro styly
- **JavaScript** frontend
- **Responsive mobile-first**
- **Page Builder integration**
- **Widgets system**
- **Theme variations** (až 4 per téma)
- **PCI 4.0 compliance** (nonce-based authorization od v6.16)

### 12.2 Cornerstone

- **Open-source reference theme** od BigCommerce
- Starting point pro custom themes
- Maintained na GitHub
- Responsive, optimalizovaný, SEO-friendly
- 3 variations v základu

### 12.3 Stencil CLI

Command-line tool pro vývoj témat:

- Local development environment
- Live preview před publishem
- Theme push/pull
- Variations management
- Auto-reload při změnách

### 12.4 Theme Store

- **100+ oficiálních Stencil themes**
- Free a premium
- Cena premium: 145–395 USD jednorázově
- Populární vendors: Halo, Pixel Union, Papathemes, Stencil Marketplace

### 12.5 Theme customization

**Pro non-developers (Page Builder):**

- Drag-and-drop editor
- Colors, fonts, layout
- Featured products count
- Banner management
- Text blocks, images
- Custom HTML widgets

**Pro developers:**

- Full HTML/CSS/JS access
- Handlebars templating
- Custom widgets
- Schema extensions
- Custom templates per page type
- Custom category/brand/product layouts

### 12.6 Theme limits

- Max 4 variations per theme
- Size limit per theme
- Scripts must be nonce-authorized (PCI 4.0)

### 12.7 Blueprint (legacy)

Starší theme engine z ere před Stencil – v 2026 prakticky deprecated. Stávající obchody migrují na Stencil.

---

## 13. Page Builder a Makeswift

### 13.1 Page Builder (nativní)

Drag-and-drop editor pro non-developers:

- **Text blocks**
- **Images** (single, galleries)
- **Banners**
- **Carousels / sliders**
- **Product lists** (featured, new, bestsellers)
- **Custom HTML**
- **Video embeds**
- **Buttons s CTA**
- **Spacers**

Limitations:

- Pracuje v rámci dané sekce
- Ne plně volný canvas jako Wix
- Visuální úpravy omezené

### 13.2 Widget system

- **Custom widgets** (developers)
- **JSON schema pro nastavení**
- **Template file per widget**
- Merchants drag-drop přes Page Builder
- Preview před publishem

### 13.3 Makeswift (acquired 2024)

**Visual page builder s headless architekturou:**

- **Drag-and-drop** s real componenty
- **Multiplayer editing** (kolaborace v real-time)
- **Primary pro Catalyst** (headless)
- **Nově dostupný i pro Stencil** (od BigSummit 2025)
- **React-based**
- **Professional designer toolkit**

**Makeswift přínosy:**

- Design system import
- Custom components
- Type-safe
- GitHub-like workflow
- Figma-like precision

### 13.4 Makeswift vs. Page Builder

| Feature                 | Page Builder | Makeswift |
| ----------------------- | ------------ | --------- |
| Stencil                 | ✅           | ✅ (nové) |
| Catalyst                | ❌           | ✅        |
| Multiplayer             | ❌           | ✅        |
| React components        | ❌           | ✅        |
| Real-time collaboration | ❌           | ✅        |
| Custom code             | limited      | unlimited |
| Learning curve          | low          | medium    |

### 13.5 Pricing

- **Page Builder:** zdarma, na všech plánech
- **Makeswift:** součást Commerce.com tiers, custom pricing

---

## 14. Catalyst – headless storefront

Catalyst je BigCommerce's **next-gen headless storefront framework**, launched February 2024.

### 14.1 Co je Catalyst

- **React / Next.js** based
- **GraphQL Storefront API**
- **Reference implementation** z 4 000+ headless obchodů
- **Google Lighthouse score 100** out-of-the-box
- Open-source na GitHub
- Designed pro mid-market a enterprise

### 14.2 Tech stack

- **Next.js 14+** (App Router)
- **React 18+** (Server Components)
- **TypeScript**
- **Tailwind CSS**
- **GraphQL**
- **Deployment**: Vercel, Netlify, AWS Amplify

### 14.3 Catalyst features

**Performance:**

- Google Lighthouse 100
- Server-side rendering
- Edge caching
- Optimized images
- Core Web Vitals leadership

**E-commerce components:**

- Product listing
- Product detail
- Cart management
- Checkout integration (s BigCommerce Checkout SDK)
- Search
- Account pages
- B2B Buyer Portal

**Customization:**

- Custom components
- Theming
- Routing flexibility
- Data fetching patterns

### 14.4 Catalyst CLI

```bash
pnpm create @bigcommerce/catalyst@latest
```

- Scaffold new project
- B2B variant option
- Custom configurations

### 14.5 Makeswift pro Catalyst

- **Visual page builder** pro Catalyst
- Non-developers mohou editovat pages
- Multiplayer editing
- React components z kódu → drag-drop UI

### 14.6 B2B Catalyst

- Enable B2B na Catalyst
- Buyer Portal integration
- Company accounts, quotes, PO workflows
- Custom pricing per company

### 14.7 Catalyst vs. Stencil

|                    | Stencil     | Catalyst                   |
| ------------------ | ----------- | -------------------------- |
| Tech               | Handlebars  | React/Next.js              |
| Hosting            | BigCommerce | Self-hosted (Vercel, AWS)  |
| Performance        | Good        | Excellent (Lighthouse 100) |
| Flexibility        | Moderate    | Unlimited                  |
| Developer required | Optional    | Required                   |
| Learning curve     | Low         | High                       |
| Best for           | SMB         | Mid-market, Enterprise     |

### 14.8 Catalyst demo

- Live demo: catalyst-demo.site
- GitHub repo: github.com/bigcommerce/catalyst
- Docs: catalyst.dev

### 14.9 Session syncing (headless ↔ checkout)

- Maintain customer session mezi headless storefront a BigCommerce checkout
- Cart persistence
- Login state

### 14.10 Catalyst limitations

- **Vyžaduje developer team** (Next.js expertise)
- **Hosting náklady** (Vercel, AWS)
- **Initial setup time** (versus Stencil)
- **Custom development** pro unique features

---

## 15. Multi-Storefront – více obchodů pod jedním účtem

**Unique BigCommerce feature** – spravujte více samostatných storefrontů z jednoho adminu.

### 15.1 Use cases

- **Multi-brand:** různé značky pod jednou firmou
- **B2B + B2C:** oddělené experience pro wholesale a retail
- **Regionální:** USA, UK, EU storefronts
- **Jazykové verze:** DE, FR, ES stores
- **A/B testing:** test storefront koncepcí

### 15.2 Co je sdíleno

- **Catalog** (produkty)
- **Inventory**
- **Orders**
- **Customers** (shared customer data)
- **Reports**
- **Backend admin**

### 15.3 Co je per-storefront

- **Theme a design**
- **Domain**
- **Currency**
- **Language**
- **Pricing** (currency or lists)
- **Products available** (podle kategorií)
- **Payment methods**
- **Shipping methods**
- **Tax rules**
- **SEO**
- **Content** (blog, pages)

### 15.4 Storefront channels

- **Stencil storefront**
- **Catalyst storefront**
- **App channel** (Amazon, eBay, Walmart)
- **Custom API channel**

### 15.5 Dostupnost

- **Pro plán:** limited (typically 1-3 storefronts)
- **Enterprise:** unlimited (custom)
- **B2B Edition:** lze rozšířit na více storefrontů

### 15.6 Management

- Channel Manager v Control Panelu
- Přepínání mezi storefronts
- Per-storefront reports
- Per-storefront analytics

### 15.7 Pricing pro Multi-Storefront

- Enterprise plán inherently zahrnuje
- Pro plán: add-on per storefront
- Cena se liší podle potřeb

---

## 16. B2B Edition

BigCommerce B2B Edition je **pokročilý B2B add-on** – dostupný na Pro+ plánech jako samostatný subscription.

### 16.1 Company accounts

- **Company profile** s multiple buyers
- **Company hierarchy** (parent-child)
- **Multiple locations** per company
- **Custom billing/shipping**
- **Tax-exempt status**
- **Payment terms**

### 16.2 Buyer Portal

- **Branded portal** pro B2B buyers
- **Order history** napříč firmou
- **Quote management**
- **Address book**
- **Payment methods** saved
- **Approval workflows**
- **Buy again**
- **Invoice management**
- **Shopping lists**
- **Bulk ordering** (SKU paste)

### 16.3 Custom pricing (Price Lists)

- **Company-specific pricing**
- **Customer group pricing**
- **Volume discounts**
- **Percentage off catalog**
- **Fixed prices**
- Unlimited price lists (na Enterprise)
- Assign automatically na login

### 16.4 Quote management

- **Buyer-initiated quotes**
- **Sales rep quoting**
- **Approval workflow**
- **Negotiated pricing**
- **Quote-to-order conversion**
- **Quote expiration**
- **PDF export**

### 16.5 Purchase Orders

- **PO field in checkout**
- **Net terms** (Net 7, 15, 30, 60, 90)
- **Automatic invoice generation**
- **Credit limit tracking**
- **Purchase order tracking**

### 16.6 User roles & permissions

- **Admin** (manage company)
- **Purchaser** (place orders, view history)
- **Requisitioner** (submit quotes for approval)
- **Manager** (approve purchases up to limit)
- **Custom roles** možné
- **Per-role permissions**

### 16.7 Approval workflows

- **Multi-level approvals**
- **Spending limits** per user
- **Auto-approval under X**
- **Email notifications**
- **Audit log**

### 16.8 Super Admin Masquerade

- **Admin can login as customer** (for support)
- **View their pricing**
- **Place orders on their behalf**
- **Activity logged**

### 16.9 Sales Staff Quoting

- Sales rep nástroje
- **Create quotes** na customer's account
- **Custom pricing** v quote
- **Tier pricing access**
- **Commission tracking**

### 16.10 Multi-Storefront B2B

Unique k BigCommerce: **B2B Edition funguje across multiple storefronts** – jednotný Buyer Portal napříč všemi.

### 16.11 Headless B2B

- B2B Edition **podporuje headless** (Catalyst)
- Buyer Portal API
- Custom UI possible
- MACH architecture alignment

### 16.12 Import/Export

- CSV import company accounts
- Bulk user creation
- Price list import
- Export orders, quotes

### 16.13 Reporting

- B2B-specific reports
- Revenue per company
- Top buyers
- Quote conversion rates
- Sales rep performance

### 16.14 Integrations

- **ERP:** NetSuite, SAP, Microsoft Dynamics, Acumatica
- **PIM:** Akeneo, Salsify
- **CRM:** Salesforce, HubSpot
- **Accounting:** QuickBooks, Xero

### 16.15 B2B vs. Shopify Plus B2B

BigCommerce B2B Edition je často hodnocena jako **pokročilejší** než Shopify Plus B2B:

- Více workflow options
- Multi-storefront B2B
- Native headless support
- Lower cost
- **#1 B2B platform v Paradigm 2025 Mid-Market Report**

---

## 17. International – mezinárodní prodej

### 17.1 Multi-currency

- **140+ měn podporováno**
- **Auto-conversion** přes exchange rate providers
- **Manual pricing** per currency
- **Currency selector** widget
- **Rounding rules**
- **Customer preference** uložena

### 17.2 Multi-language

**Native features:**

- **Multi-Storefront per jazyk**
- Každý storefront má vlastní language
- **Product translations** přes APIs nebo apps
- **hreflang tags** automaticky

**Přes apps:**

- **Weglot**
- **GTranslate**
- **Translate.io**
- **LangShop**

### 17.3 Geolocation

- **Auto-redirect** based na IP (přes apps)
- **Country popup** suggestions
- **Currency auto-selection**

### 17.4 International checkout

- Lokalizované payment methods
- Lokalizované shipping
- Tax/VAT auto
- Duties calculation (Pro+)

### 17.5 Cross-border

- **Duties & taxes** pre-calculation
- **DDP / DDU options**
- **Customs forms**
- **Harmonized codes** per product
- **Landed cost** display

### 17.6 Multi-storefront pro mezinárodní

Typicky doporučeno nastavit:

- USA store → USD
- UK store → GBP
- EU store → EUR
- Každý s vlastním checkoutem, payments, shipping

### 17.7 Omezení

- **Multi-language stále trochu awkward** (nejlepší přes Multi-Storefront)
- **Bez vlastního Managed Markets** jako Shopify
- **Duties auto jen na Pro+**

---

## 18. Marketing a prodejní kanály

### 18.1 Native marketing tools

**Promotions (automatic discounts):**

- Bez potřeby kódů
- Triggery (cart value, products, customer groups)
- Unlimited na všech plánech

**Coupon codes:**

- Percentage / fixed / BOGO / free shipping
- Expiration, usage limits
- Customer-specific

**Email marketing:**

- Basic email templates
- **Klaviyo** native integration (zdarma base)
- **Mailchimp**
- **Omnisend**

**Banners:**

- Storefront banners
- Category-specific
- Scheduled display

**Abandoned cart recovery** (Plus+)

### 18.2 Sales channels

**Marketplaces (přes Feedonomics + native):**

- **Amazon** (native integration)
- **eBay**
- **Walmart Marketplace**
- **Google Shopping**
- **Facebook Shop / Instagram**
- **TikTok Shop**
- **Pinterest Shopping**
- **Shein** (nové 2024)
- **Target Plus**
- **Wayfair**
- **Best Buy Marketplace**

**Social:**

- Facebook, Instagram shopping tags
- TikTok Pixel
- Pinterest catalog
- Snapchat catalog

**Price comparison:**

- Google Shopping
- Shopzilla
- NexTag

### 18.3 Social selling

- **Facebook Shop** (native)
- **Instagram Shopping** (native)
- **TikTok Shop** (native od 2024)
- **Pinterest Product Pins**

### 18.4 Email marketing partners

- **Klaviyo** (e-commerce fokus, most popular)
- **Mailchimp** (generic)
- **Omnisend** (e-commerce)
- **HubSpot**
- **ActiveCampaign**
- **Bloomreach**

### 18.5 Affiliate marketing

- Impact.com integration
- ShareASale
- Commission Junction (CJ)
- Awin
- Refersion

### 18.6 SMS marketing

- Attentive
- Postscript
- SimpleTexting

### 18.7 Content marketing

- Native blog
- SEO optimalizace
- Blog scheduling

### 18.8 Google Ads integration

- Google Merchant Center sync
- Dynamic remarketing
- Conversion tracking
- Smart Shopping

### 18.9 Facebook Ads

- Pixel auto-install
- Dynamic ads catalog
- Retargeting
- Conversion API

### 18.10 Influencer marketing

- Aspire
- CreatorIQ
- GRIN (integrace přes apps)

---

## 19. Feedonomics – omnichannel feed management

Feedonomics je **zásadní součást BigCommerce ekosystému** – akviz 2021, dnes centrální hub pro marketplace selling.

### 19.1 Co je Feedonomics

- **Omnichannel product feed management**
- Optimalizace product dat pro marketplaces
- **1 000+ channels podporováno**
- Orders flow zpět do BigCommerce
- Dříve enterprise-only, **SMB verze od 2025**

### 19.2 Podporované channels

**Marketplaces:**

- Amazon (USA + globally)
- Walmart Marketplace
- eBay
- Target+
- Wayfair
- Shein
- TikTok Shop
- Instagram/Facebook Shop
- Google Shopping
- Kohl's
- Best Buy
- Overstock

**Comparison engines:**

- Google Shopping
- Microsoft Shopping
- Connexity
- Shopzilla

**Affiliate networks:**

- Rakuten
- CJ
- Impact

### 19.3 Features

- **Feed optimization** (automatic)
- **Product data transformation** (name, description, attributes)
- **AI content rewriting** (od 2024)
- **Inventory sync**
- **Price sync**
- **Order sync** (real-time z Amazon, TikTok Shop)
- **Automated rules engine**
- **Quality scoring**
- **Compliance** pro channel-specific requirements
- **Multi-language feeds**

### 19.4 AI features (2024+)

- **Intelligent content rewriting** pro marketplace optimization
- **AI-powered product descriptions** per channel
- **Auto-categorization**
- **Image optimization**

### 19.5 Pricing

- **Traditional:** enterprise pricing (tisíce USD/měs.)
- **SMB tier (2025):** nižší pricing pro SME
- Per SKU-based
- Per channel-based
- Typicky 300–5 000+ USD/měs.

### 19.6 BigCommerce vs. standalone

- **BigCommerce integrovaný:** seamless s Control Panelem
- **Standalone:** Feedonomics umí i weby mimo BigCommerce (Shopify, Magento)

### 19.7 Real-time order sync

- Amazon real-time (od BigSummit 2024)
- TikTok Shop real-time
- Shein integration
- TikTok returns support (upcoming)

---

## 20. Slevy, promoakce a věrnostní programy

### 20.1 Promotions (automatic discounts)

**Unlimited** na všech plánech.

**Typy:**

- **Discount off product**
- **Discount off order**
- **Discount off shipping**
- **Free gift**
- **BOGO** (buy one get one)
- **BXGY** (buy X get Y)
- **Spend X save Y**
- **Category discounts**
- **Brand discounts**

**Podmínky:**

- Min. order amount
- Specific products / categories
- Customer groups (Plus+)
- Date range
- Usage limits
- First-time customers

### 20.2 Coupon codes

- Pevná částka / %
- Single use / multi use
- Per-customer limit
- Expiration
- Combination rules
- Stacking prevention

### 20.3 Customer group pricing (Plus+)

- Custom prices per group
- Wholesale pricing
- VIP pricing
- Tier-based

### 20.4 Bulk pricing (native)

- **Tier pricing per produkt**
- Buy 5+ get 10% off
- Buy 10+ get 20% off
- Automatic application

### 20.5 Gift certificates (native)

- Custom values
- Digital delivery
- Balance tracking
- Expiration
- Scheduled send

### 20.6 Store credit

- Issue v refunds
- Promotional credits
- Customer account balance
- Auto-applied at checkout

### 20.7 Loyalty programs

⚠️ **Žádný nativní loyalty program** – přes apps:

- **Smile.io**
- **LoyaltyLion**
- **Yotpo Loyalty**
- **Stamped**
- **Marsello**

### 20.8 Referral programs

- Přes apps:
  - Referral Candy
  - ReferralHero
  - Friendbuy

### 20.9 Wishlists

- **Native v Stencil** (od 2025)
- Customer wishlist
- Share wishlist
- Multiple wishlists
- Move to cart

### 20.10 Subscribe & save

- Přes apps (Recharge, Bold)
- Discount pro subscriptions
- Cancel anytime

---

## 21. SEO a obsah

### 21.1 On-page SEO

- **Meta title & description** per page/produkt/category
- **URL structure** customizable
- **Canonical URLs**
- **Schema.org markup** (Product, Breadcrumb, Organization, Article)
- **Open Graph tags**
- **Twitter Cards**
- **H1-H6** heading structure
- **Alt text** na images
- **Internal linking** tools

### 21.2 Technické SEO

- **SSL** zdarma (all plans, Let's Encrypt)
- **HTTPS enforced**
- **Custom SSL** (Pro+)
- **Sitemap.xml** auto-generated
- **robots.txt** editable
- **Mobile responsive**
- **Page speed** – **#3 nejrychlejší platforma** (361ms response)
- **CDN globally** (Akamai + CloudFront)
- **WebP + lazy loading**
- **301 redirects** manager
- **Rich snippets** support

### 21.3 URL structure

- Customizable URL patterns
- Per product/category/brand
- Multi-language support (přes Multi-Storefront)
- No /products/ forced prefix (lze customizovat)

### 21.4 Blog

- **Native blog** na všech plánech
- Categories, tags
- Author pages
- Scheduled publishing
- RSS feed
- SEO-optimized
- Comments (moderated)

### 21.5 Pages management

- **Web pages** (static)
- **Landing pages**
- **Category pages** (SEO-optimized)
- **Brand pages**

### 21.6 Product filtering (Pro+)

- **Faceted search**
- Filter by price, brand, category, custom attributes
- SEO-friendly URLs pro filtry
- Indexable by search engines

### 21.7 Search

- **Native search** (good)
- **Elasticsearch** based
- **Search suggestions**
- **Search analytics** (popular queries)
- **Synonyms**
- **Third-party search:**
  - Searchanise
  - Boost AI Search
  - Klevu
  - Algolia

### 21.8 Page speed

BigCommerce je **známý rychlostí:**

- Průměr 361ms server response
- Třetí nejrychlejší platforma (po Catalyst storefront a vlastních custom)
- Good Core Web Vitals scores
- Lighthouse 90+ s Stencil
- Lighthouse 100 s Catalyst

### 21.9 Google Search Console

- Easy verifikace
- Sitemap submit
- Performance data

### 21.10 Rich snippets

- **Product** rich results
- **Reviews** stars in SERP
- **FAQ** schemas
- **Breadcrumbs**
- **Organization**

### 21.11 SEO apps

- Smart SEO
- SEO Expert Prime
- Ahrefs, Semrush connectors

---

## 22. Analytika a reporting

### 22.1 Analytics Dashboard

- **Sales overview**
- **Orders**
- **Visitors**
- **Conversion rate**
- **Average order value (AOV)**
- **Customer lifetime value**
- **Revenue trends**
- **Top products**
- **Top categories**

### 22.2 Marketing Analytics

- **Traffic sources** (direct, organic, paid, social)
- **Top referrers**
- **Search terms**
- **Conversion by source**
- **Campaign performance**

### 22.3 Merchandising Analytics

- **Product performance**
- **Category performance**
- **Bestsellers**
- **Underperformers**
- **Cross-sell effectiveness**

### 22.4 Customer Analytics

- **New vs. returning**
- **Customer lifetime value**
- **Churn rate**
- **Cohort analysis** (Pro+)
- **Segment performance**

### 22.5 In-store search analytics

- **Popular search terms**
- **Zero-result searches**
- **Conversion per search**
- **Search improvement opportunities**

### 22.6 Real-time dashboard

- Live visitors
- Active carts
- Today's sales
- Recent orders

### 22.7 Custom Reports (Pro+)

- Drag-and-drop builder
- Custom metrics
- Scheduled email delivery
- CSV export

### 22.8 Integrations

- **Google Analytics 4** (native setup)
- **Google Tag Manager**
- **Meta Pixel** (Facebook)
- **TikTok Pixel**
- **Microsoft Clarity**
- **Mixpanel, Amplitude** (přes apps)
- **Glew.io** (e-commerce analytics)
- **Littledata**

### 22.9 Analytics API

- Export data programmatically
- Build custom dashboards
- BI tool integrace (Looker, Tableau, Power BI)

### 22.10 Commerce360 (Enterprise)

Advanced BI tools pro enterprise merchants.

---

## 23. AI v BigCommerce

BigCommerce má AI funkce méně expandovanější než Shopify Sidekick nebo Wix Astro, ale rostoucí pokrytí.

### 23.1 Feedonomics AI

**Content rewriting:**

- AI přepisuje product descriptions per channel
- Optimizes pro Amazon, Google Shopping, TikTok atd.
- Compliance s channel-specific requirements

**AI categorization:**

- Auto-assign products do kategorie
- Attribute extraction z popisů
- Error detection

### 23.2 Catalyst AI (2025+)

- **AI-powered search** (semantic)
- **Personalized recommendations**
- **Product recommendations** napříč storefront

### 23.3 Makeswift AI

- **Layout suggestions**
- **Copy generation** pro sekce
- **Image generation** (limited)

### 23.4 AI Product Descriptions

- Dostupné přes apps (JoshAI, DescriptionAI, BCAI)
- Ne native v 2026 na BigCommerce side
- Feedonomics má pro marketplace feeds

### 23.5 AI Search

- Přes apps (Searchanise, Algolia, Klevu)
- Semantic understanding
- Personalizované výsledky

### 23.6 AI-assisted Help

- Docs search
- Chatbot v help centru
- Smart suggestions

### 23.7 AI roadmap

Na BigSummit 2025 BigCommerce oznámil:

- Expanded AI content features
- AI-powered merchandising
- Predictive analytics
- Customer behavior AI

### 23.8 Omezení

- **BigCommerce AI je menší v scope než** Shopify (Sidekick), Wix (Astro/Harmony/Vibe)
- **Primárně v Feedonomics a Makeswift** místo platformy
- **Méně natural language admin commands**
- **Méně AI image tools** nativně

---

## 24. Developer platforma – API, Stencil CLI, Webhooks

BigCommerce má **silnou developer platformu**, podobnou Shopify v kvalitě API.

### 24.1 REST API

- **Well-documented REST endpoints**
- **v3 latest version**
- **OAuth 2.0 authentication**
- **API keys per integration**
- **Rate limits** (různé per plan)

**Hlavní endpoints:**

- **Catalog** (products, categories, brands, variants)
- **Orders**
- **Customers**
- **Carts**
- **Checkouts**
- **Inventory**
- **Payments**
- **Shipping**
- **Taxes**
- **Themes**
- **Content** (pages, blog)
- **Store info**
- **Channels**
- **Widgets**

### 24.2 GraphQL Storefront API

- **GraphQL endpoint** pro Catalyst a headless
- Type-safe queries
- Efficient data fetching
- Real-time subscriptions (limited)
- **Session syncing** s BigCommerce checkout

### 24.3 GraphQL Admin API

- Limited (primarily v3 REST dominates admin)
- Pro core admin operations REST je stále default

### 24.4 Webhooks

- **40+ webhook topics**
- HMAC signature verification
- Retry logic
- Topic examples:
  - `store/order/created`
  - `store/order/updated`
  - `store/order/statusUpdated`
  - `store/product/created`
  - `store/product/updated`
  - `store/customer/created`
  - `store/cart/created`
  - `store/cart/updated`
  - `store/subscriber/created`
  - `store/sku/inventory/updated`

### 24.5 Stencil CLI

- Local theme development
- Live preview
- Theme variations management
- Push/pull themes
- Cornerstone starter

### 24.6 Checkout SDK

Pro custom checkout experiences:

- **JavaScript SDK**
- Build custom checkout UI
- Headless checkout flow
- Integration s custom payment gateways
- A/B testing checkout variations

### 24.7 BigDesign (design system)

- React component library
- Matches BigCommerce admin UI
- Open-source na GitHub
- Pro building apps v admin

### 24.8 Single-Click Apps (SCA)

- **App framework** pro BigCommerce App Store
- OAuth flow
- iframe embedding v admin
- Polaris-like design (BigDesign)
- Easy distribution

### 24.9 Draft orders API

- Vytvoření draft orders programmatically
- Pro B2B workflows
- Quote management
- Custom pricing

### 24.10 Catalyst (headless)

Celá sekce 14 pokrývá Catalyst.

### 24.11 API rate limits

- **Standard:** 20 000 požadavků/hour
- **Plus:** 20 000 požadavků/hour
- **Pro:** 60 000 požadavků/hour
- **Enterprise:** 400% navíc vs. Pro
- Burst limits
- Throttling pro overages

### 24.12 Sandbox / Developer accounts

- Unlimited free developer stores
- Full feature access
- Pro testing apps
- Sandbox API environments

### 24.13 Developer Center

- **developer.bigcommerce.com**
- Documentation
- API reference
- Code samples
- Changelog
- Release notes

### 24.14 API versioning

- CalVer versioning
- Deprecation warnings
- 12-month support after deprecation
- Backward compatibility

### 24.15 Custom apps

- **Draft apps** (for single store)
- **Public apps** (BigCommerce App Store)
- **Channel apps** (custom sales channels)
- **Headless apps**

---

## 25. BigCommerce App Marketplace

### 25.1 Přehled

- **~1 000+ aplikací** v App Store
- Menší než Shopify (8 000+), srovnatelný s Wix (500)
- Kategorizováno:
  - Marketing
  - Shipping & Fulfillment
  - Inventory & Products
  - Sales & Marketing
  - Finance
  - Customer Service
  - Analytics & Reporting
  - Headless

### 25.2 Top kategorie aplikací

**Email marketing:**

- Klaviyo, Mailchimp, Omnisend, ActiveCampaign

**Reviews:**

- Yotpo, Judge.me, Loox, Stamped

**Shipping:**

- ShipStation, Shippo, AfterShip, Sendcloud, Easyship

**Subscriptions:**

- Recharge, Bold Subscriptions, PayWhirl

**Loyalty:**

- Smile.io, LoyaltyLion, Yotpo Loyalty

**Search:**

- Searchanise, Algolia, Klevu, Boost AI Search

**Accounting:**

- QuickBooks, Xero, NetSuite

**CRM:**

- HubSpot, Salesforce, Zoho

**Translation:**

- Weglot, GTranslate

**Chat:**

- Gorgias, Zendesk, LiveChat, Tidio

**Print-on-demand:**

- Printful, Printify, Gelato

**Dropshipping:**

- Syncee, Modalyst, Spocket

### 25.3 BigCommerce Native Apps (zdarma)

- Channel Manager
- Feedonomics (s základním tier)
- Google Shopping
- Facebook / Instagram
- TikTok Shop
- Amazon (native integration)
- eBay
- Walmart Marketplace

### 25.4 App pricing

- Free
- Freemium
- Subscription (5–500 USD/měs.)
- Usage-based
- One-time

### 25.5 App installation

- One-click install
- OAuth flow
- Automatic setup
- Permissions review

### 25.6 Omezení

- Menší app ecosystem než Shopify
- Někdy nižší kvalita apps
- Méně specializovaných apps pro niche use cases

---

## 26. Bezpečnost, hosting a infrastruktura

### 26.1 Hosting

- **Multi-cloud** (AWS + Google Cloud)
- **Globální CDN** (Akamai + CloudFront)
- **Auto-scaling**
- **Multiple data centers**
- **99,99% uptime SLA** (Enterprise)

### 26.2 Performance

- **#3 nejrychlejší platforma** (361ms average)
- **99,99% uptime track record**
- Handling high-traffic (Black Friday)
- Edge caching

### 26.3 SSL

- **Zdarma SSL** (Let's Encrypt) na všech plánech
- **Custom SSL** na Pro+
- **Extended Validation** (EV) SSL podporováno
- **Automatic renewal**

### 26.4 DDoS protection

- Akamai DDoS mitigation
- Multi-layer protection
- Bot detection
- Rate limiting

### 26.5 Backups

- **Automatic backups**
- **Point-in-time recovery** (Enterprise)
- **Data redundancy** multi-region

### 26.6 Platební bezpečnost

- **PCI DSS Level 1** compliant
- **Merchant offloaded** – no PCI surveys needed
- **3D Secure 2** (SCA compliance)
- **Tokenization**
- **Fraud scoring**

### 26.7 Data privacy

- **GDPR compliant**
- **CCPA compliant**
- **LGPD** (Brazílie)
- **APPI** (Japonsko)
- **Customer Privacy API**
- **Right to erasure**
- **Data export**

### 26.8 Certifikace

- **PCI DSS Level 1**
- **SOC 2 Type II**
- **SOC 3**
- **ISO 27001**
- **ISO 27017** (cloud security)
- **ISO 27018** (PII)
- **HIPAA-ready** (Enterprise)

### 26.9 User security

- **2FA** (TOTP, SMS)
- **SSO / SAML 2.0** (Enterprise)
- **Staff permissions** (granular)
- **IP whitelisting** (Enterprise)
- **Audit logs** (Enterprise)
- **Password policies**

### 26.10 PCI 4.0 (2025+)

BigCommerce implementoval PCI 4.0 compliance:

- Nonce-based script authorization
- Integrity checks
- Justification pro scripts
- Stencil theme v6.16+ required

### 26.11 Penetration testing

- Regular penetration tests (Enterprise)
- Bug bounty program
- Security advisories

### 26.12 Status page

- **status.bigcommerce.com**
- Real-time incident tracking
- Historical uptime
- Subscribe to updates

---

## 27. Podpora a vzdělávání

### 27.1 Support tiers

| Plán       | Support                                |
| ---------- | -------------------------------------- |
| Standard   | 24/7 chat + email                      |
| Plus       | 24/7 chat + email                      |
| Pro        | Priority chat + email + priority phone |
| Enterprise | Dedicated CSM, priority 24/7, SLA      |

### 27.2 Help Center

- **support.bigcommerce.com**
- Thousands of articles
- Video tutorials
- Searchable
- Community Q&A

### 27.3 BigCommerce University

- **Free courses** online
- Certifications
- Topics: merchandising, marketing, development, design
- Self-paced

### 27.4 Community

- **BigCommerce Community Forum**
- Merchant community
- Developer community
- User groups

### 27.5 BigCommerce Academy

- Formal training programs
- Partner certifications
- Developer certifications
- Advanced Stencil / Catalyst courses

### 27.6 BigSummit

Annual conference:

- Product announcements
- Keynote sessions
- Hands-on workshops
- Partner sessions
- Networking

### 27.7 Partner Program

- **Agency Partners**
- **Technology Partners**
- **Solution Architects**
- Commission tiers
- Co-selling opportunities
- Partner Portal

### 27.8 Professional services

- **Implementation Services**
- **Migration assistance**
- **Custom development**
- **Strategic consulting**

### 27.9 Documentation

- **developer.bigcommerce.com** (dev docs)
- **support.bigcommerce.com** (merchant docs)
- **catalyst.dev** (Catalyst specific)
- **Release notes** regularly updated
- **API changelog**

---

## 28. Známá omezení a nevýhody

### 28.1 Pricing limitations

- **GMV caps** force upgrades (Standard $50K, Plus $180K, Pro $400K)
- **Nemůžete zůstat na levnějším plánu při růstu**
- Kritizováno jako "penalizace za růst"
- Nakonec může být dražší než Shopify (podle situace)

### 28.2 Design flexibility

- **Méně šablon** (100+) než Shopify (200+) nebo Wix (2 500+)
- **Page Builder** méně flexible než Wix drag-drop
- **Stencil learning curve** (Handlebars, ne tak široká komunita jako Liquid)
- **Design vyžaduje developer** pro advanced customization

### 28.3 Ecosystem

- **Menší app store** (~1 000 vs. Shopify 8 000+)
- **Méně theme vendors**
- **Menší community** designerů a developerů
- **Méně tutorials** na YouTube

### 28.4 E-commerce omezení

- **Subscriptions jen přes apps** (ne native)
- **Loyalty programs jen přes apps**
- **Wishlists historicky jen přes apps** (nově native)
- **POS nativně slabší** než Shopify POS Pro
- **Bez native email marketing** (přes Klaviyo, Mailchimp apps)

### 28.5 Admin UX

- **Komplexnější interface** než Shopify
- **Steeper learning curve**
- **Mnoho nastavení rozptýlených**
- **Menší polish** než Shopify

### 28.6 International

- **Multi-currency je dobrá**, ale multi-language složitější (přes Multi-Storefront)
- **Bez nativního Managed Markets** equivalent (jako Shopify)
- **US-focused defaults**

### 28.7 B2B advantages & challenges

- **B2B Edition je na Pro+ plánu** (vysoká vstupní bariéra)
- **B2B Edition samostatně placená**
- Enterprise orientace může být overkill pro menší B2B

### 28.8 Mobile admin

- **BigCommerce mobile app je limited**
- Méně features než na desktopu
- Horší pro ongoing management on-the-go

### 28.9 Migration challenges

- **Z Shopify na BigCommerce** možná, ale vyžaduje úsilí
- **Apps nejsou přenosné**
- **Theme rework required**
- **URL structure differences**

### 28.10 Lock-in

- **Stencil themes** proprietární
- **Catalyst portable** (open-source Next.js)
- Migrace z BigCommerce stále snazší než z Shopify díky open API

### 28.11 Specifika pro ČR

⚠️ **BigCommerce pro český trh je velmi slabá volba** – podobně jako Squarespace:

- **Žádná nativní integrace na Zásilkovnu, ČP, PPL, DPD, GLS**
- Řešení: **Sendcloud** jako jediná rozumná volba
- **BigCommerce Payments není v ČR**
- Hlavní platba: **Stripe** + PayPal
- **Žádný ComGate, GoPay, ThePay** v oficiální seznamu (přes custom)
- **Čeština v UI není plně lokalizovaná**
- **Žádná EET, ARES** podpora
- **Účetní systémy** (Pohoda, Money, FlexiBee) přes Zapier/Make
- **Heureka, Zboží.cz** – jen custom feed creation
- **Dobírka (COD)** – custom offline method
- **Minimální česká komunita** merchants a developerů
- **Žádné české Stencil themes**

BigCommerce je v ČR téměř neznámý – **neexistují čeští Partner Agencies** specializovaní na BigCommerce.

### 28.12 Marketing

- **Méně AI features** než Shopify nebo Wix
- **Menší ecosystem marketing apps**
- **Email nutný externí** (Klaviyo, Mailchimp)

### 28.13 Developer platform

- **Silné APIs**, ale menší komunita developerů
- **Méně tutoriálů**
- **Stencil je Handlebars, ne Liquid** (jiný skill set)
- **Catalyst je Next.js (+), ale vyžaduje advanced React expertise**

---

## Závěr

BigCommerce v roce 2026 představuje **silnou mid-market a B2B-first platformu** s několika zásadními výhodami, ale i specifickými omezeními.

### Silné stránky

- **0% transaction fees** na všech plánech (ušetří tisíce USD/rok)
- **Unlimited staff accounts** i na Standard plánu
- **Real-time shipping** na všech plánech (Shopify jen Advanced)
- **Native B2B Edition** – #1 B2B platforma v Paradigm 2025
- **Multi-Storefront** ze stejného adminu (unikátní)
- **Catalyst (headless)** s Lighthouse 100
- **Feedonomics** integrovaný pro 1 000+ marketplaces
- **65+ platebních brán** podporováno
- **140+ měn**
- **Silná API platforma** (REST + GraphQL)
- **Native bulk pricing**
- **PCI DSS Level 1** merchant-offloaded
- **Customer groups** na Plus+ s custom pricing

### Slabé stránky

- **GMV caps vynutí upgrade** (penalizace za růst)
- **Menší app ecosystem** (~1 000 vs. Shopify 8 000+)
- **Méně design flexibility** než Wix nebo Squarespace
- **AI funkce slabší** než Shopify Sidekick nebo Wix Astro
- **Subscriptions jen přes apps**
- **Loyalty programs jen přes apps**
- **POS slabší** než Shopify POS Pro
- **Bez native email marketing**
- **Steeper learning curve**
- **US-focused orientation** (international funkce slabší než Shopify Markets)

### Pro koho se BigCommerce hodí

✅ **Ideální pro:**

- **Mid-market B2B** ($500K – $10M GMV) – nejlepší volba po Shopify Plus
- **Enterprise B2B s multi-storefront** potřebami
- **Obchody chtějící headless** (Catalyst)
- **Merchants se silnou marketplace strategií** (Amazon, eBay, Walmart)
- **B2C + B2B hybrid businesses**
- **Obchody s komplexním katalogem** (10 000+ SKU)
- **Large-scale product feed management** (Feedonomics)
- **Merchants who hate transaction fees**

### Pro koho méně

❌ **Méně vhodné pro:**

- **Small starters / solopreneurs** (Shopify Basic, Wix Core, Squarespace Core levnější a jednodušší)
- **Design-first brands** (Squarespace, Wix lepší)
- **Creators s digital products / courses** (Squarespace, Kajabi lepší)
- **Service-based businesses** (Wix Bookings, Squarespace Acuity lepší)
- **Rychlý launch bez developera** (Wix, Squarespace snazší)
- **České obchody** s potřebou lokálních integrací
- **Restaurants, salons, fitness** (Wix lepší s multi-business solutions)

### Pozice na trhu

BigCommerce se pozicuje jako **"open SaaS" alternativa k Shopify**:

- **Open:** flexibilnější APIs, headless-first s Catalyst, Multi-Storefront
- **SaaS:** hostované, žádná infrastruktura starost
- **B2B-leader** v mid-market segmentu
- **Marketplace dominance** přes Feedonomics

### Shrnutí v kontextu ČR

V České republice má BigCommerce **mizivý podíl** – podobně jako Squarespace. Důvody:

- **Chybí lokalizace** (jazyk, platby, dopravci, účetnictví, EET)
- **Žádné české agency partnerství** oficiálně
- **Minimální komunita** Czech merchants

Pro český obchod jsou lepší volby:

- **Shoptet / Upgates** (lokální SaaS)
- **Shopify** (s lokálními apps přes Zásilkovnu, ComGate)
- **WooCommerce** (flexibility + open-source)
- **Shopware** (B2B, DACH region, silné v CZ/SK)

BigCommerce by měl smysl jen pro **mezinárodně orientovaný český B2B obchod**, který cílí na USA/UK trhy a potřebuje silné B2B funkce bez Shopify Plus ceny.

---

### Srovnání všech 4 platforem (Shopify, Wix, Squarespace, BigCommerce)

| Kritérium               | Shopify               | Wix                     | Squarespace                    | BigCommerce              |
| ----------------------- | --------------------- | ----------------------- | ------------------------------ | ------------------------ |
| **Cena (entry)**        | 29 USD                | 17 USD                  | 16 USD                         | 29 USD                   |
| **Design freedom**      | ⭐⭐⭐                | ⭐⭐⭐⭐⭐              | ⭐⭐⭐⭐                       | ⭐⭐                     |
| **Templates**           | 200+                  | 2 500+                  | 200+                           | 100+                     |
| **E-commerce depth**    | ⭐⭐⭐⭐⭐            | ⭐⭐⭐                  | ⭐⭐⭐                         | ⭐⭐⭐⭐⭐               |
| **B2B**                 | ⭐⭐⭐⭐ (Plus)       | ⭐⭐                    | ⭐                             | ⭐⭐⭐⭐⭐ (#1)          |
| **App ecosystem**       | ⭐⭐⭐⭐⭐ (8 000+)   | ⭐⭐⭐ (500)            | ⭐⭐ (50-80)                   | ⭐⭐⭐ (~1 000)          |
| **Transaction fees**    | 2% Basic              | 0%                      | 3% Basic                       | 0% všechny               |
| **Real-time shipping**  | jen Advanced          | add-on                  | jen Advanced                   | ✅ všechny               |
| **Multi-currency**      | ⭐⭐⭐⭐⭐            | ⭐⭐⭐⭐                | ⭐                             | ⭐⭐⭐⭐                 |
| **Multi-language**      | ⭐⭐⭐⭐⭐            | ⭐⭐⭐⭐                | ⭐⭐                           | ⭐⭐⭐                   |
| **Multi-storefront**    | ⭐⭐ (Plus only)      | ⭐⭐                    | ❌                             | ⭐⭐⭐⭐⭐ (unikátní)    |
| **Headless**            | ⭐⭐⭐⭐⭐ (Hydrogen) | ⭐⭐⭐⭐ (Vibe)         | ⭐                             | ⭐⭐⭐⭐⭐ (Catalyst)    |
| **AI**                  | ⭐⭐⭐⭐ (Sidekick)   | ⭐⭐⭐⭐⭐ (Astro)      | ⭐⭐⭐⭐ (Design Intelligence) | ⭐⭐⭐ (Feedonomics AI)  |
| **POS**                 | ⭐⭐⭐⭐⭐ (global)   | ⭐⭐⭐ (USA/CA)         | ⭐⭐ (USA)                     | ⭐⭐⭐ (Square)          |
| **Digital products**    | ⭐⭐⭐                | ⭐⭐⭐⭐                | ⭐⭐⭐⭐⭐                     | ⭐⭐⭐                   |
| **Booking / Services**  | ⭐⭐                  | ⭐⭐⭐⭐ (Wix Bookings) | ⭐⭐⭐⭐⭐ (Acuity)            | ⭐⭐                     |
| **Marketplaces**        | ⭐⭐⭐⭐              | ⭐⭐⭐                  | ⭐⭐                           | ⭐⭐⭐⭐⭐ (Feedonomics) |
| **Ease of use**         | ⭐⭐⭐⭐              | ⭐⭐⭐⭐                | ⭐⭐⭐⭐⭐                     | ⭐⭐⭐                   |
| **ČR lokalizace**       | ⭐⭐⭐                | ⭐⭐⭐                  | ⭐⭐                           | ⭐                       |
| **Overall positioning** | #1 e-commerce         | All-in-one              | Design-first                   | B2B / Mid-market         |

---

_Dokument sestaven na základě oficiální dokumentace BigCommerce (support.bigcommerce.com, developer.bigcommerce.com, bigcommerce.com/blog), Catalyst documentation (catalyst.dev), BigSummit 2024/2025 oznámení, Commerce.com rebranding announcement, a nezávislých analýz (Ecommerce Paradise, WebsiteBuilderExpert, LitExtension, Netsolutions, Folio3, Anchor Group, WizCommerce, Duck Soup Ecommerce, Hypa, Kensium) – duben 2026._
