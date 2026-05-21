# Ecwid by Lightspeed – Kompletní hloubková analýza všech funkcí, modulů a featur

> **Stav:** duben 2026 (zahrnuty změny cen od 2. března 2026, Lightspeed Ecom E-Series rebranding, nejnovější Ecwid Igniter updates)
> **Rozsah:** celá platforma Ecwid – Free plán, Venture, Business, Unlimited, Instant Site, embed widget, ShopApp, Lightspeed integrace, POS, App Market
> **Zdroje:** oficiální Ecwid Help Center (support.ecwid.com), ecwid.com, Lightspeed Commerce dokumentace, nezávislé recenze

---

## Obsah

1. [Co je Ecwid a firemní kontext](#1-co-je-ecwid-a-firemní-kontext)
2. [Ecwid vs. Lightspeed Ecom E-Series](#2-ecwid-vs-lightspeed-ecom-e-series)
3. [Tarify a cenové plány](#3-tarify-a-cenové-plány)
4. [Ecwid Admin – rozhraní](#4-ecwid-admin--rozhraní)
5. [Unikátní embed widget přístup](#5-unikátní-embed-widget-přístup)
6. [Instant Site – vestavěný website builder](#6-instant-site--vestavěný-website-builder)
7. [Produkty a katalog](#7-produkty-a-katalog)
8. [Sklad a inventory management](#8-sklad-a-inventory-management)
9. [Objednávky a fulfillment](#9-objednávky-a-fulfillment)
10. [Zákazníci a customer management](#10-zákazníci-a-customer-management)
11. [Checkout a platební systém](#11-checkout-a-platební-systém)
12. [Doprava a dodání](#12-doprava-a-dodání)
13. [Daně a compliance](#13-daně-a-compliance)
14. [Mezinárodní prodej](#14-mezinárodní-prodej)
15. [Sales channels – omnichannel selling](#15-sales-channels--omnichannel-selling)
16. [Marketplaces – Amazon, eBay, Walmart](#16-marketplaces--amazon-ebay-walmart)
17. [POS integrace](#17-pos-integrace)
18. [ShopApp – mobilní branded aplikace](#18-shopapp--mobilní-branded-aplikace)
19. [Marketing a propagace](#19-marketing-a-propagace)
20. [Slevy, kupony, věrnostní programy](#20-slevy-kupony-věrnostní-programy)
21. [SEO a obsah](#21-seo-a-obsah)
22. [Analytika a reporting](#22-analytika-a-reporting)
23. [AI v Ecwid](#23-ai-v-ecwid)
24. [Developer platforma – API a Apps](#24-developer-platforma--api-a-apps)
25. [Ecwid App Market](#25-ecwid-app-market)
26. [Integrace s dalšími platformami](#26-integrace-s-dalšími-platformami)
27. [Bezpečnost, hosting, infrastruktura](#27-bezpečnost-hosting-infrastruktura)
28. [Podpora a vzdělávání](#28-podpora-a-vzdělávání)
29. [Známá omezení a nevýhody](#29-známá-omezení-a-nevýhody)

---

## 1. Co je Ecwid a firemní kontext

Ecwid je e-commerce platforma **primárně určená k embedování do existujících webů** – na rozdíl od Shopify, Wix nebo BigCommerce, které jsou standalone platformy, Ecwid se specializuje na přidání online obchodu k webu, který už máte na WordPressu, Wix, Squarespace, Joomla, Drupal, Weebly, nebo dokonce na statickém HTML.

Název **Ecwid** je zkratka z **"E-Commerce WIDget"** – platforma začala jako e-commerce widget pro vkládání do webů.

**Klíčová čísla (2026):**

- **1 000 000+ aktivních obchodů** v 175 zemích
- Zaměstnanci: ~500
- Založeno 2009 v Ulyanovsku, Rusko, zakladatel **Ruslan Fazlyev**
- Později přesun HQ do **San Diego, California** (USA)
- Ve 2021 akvizice **Lightspeed Commerce** za **$500 milionů** cash + stock
- Po akvizici rebranding v rámci Lightspeed ekosystému

**Lightspeed Commerce kontext:**

- **Lightspeed** je kanadská platforma (Montreal) zaměřená na retail/restaurace POS
- Akvize Ecwid (2021) pro rozšíření do online/e-commerce
- Ecwid je součástí **Lightspeed One** strategie (unified commerce platform)

**Pozicování:**

- **Nejlevnější cesta k online obchodu** (Free plán zdarma navždy)
- **Embed-first přístup** – přidejte obchod k existujícímu webu
- Cílí primárně na **small business, artisans, solopreneurs, side hustles**
- **NON-enterprise** orientace (Enterprise/mid-market obchody typicky používají Shopify nebo BigCommerce)

**Silné stránky:**

- **Free plán forever** (10 produktů)
- **0% transaction fees** na všech plánech
- **Embed widget** pro WordPress, Wix, Squarespace, Joomla, atd.
- **175 zemí** – celosvětové pokrytí
- **51+ jazyků** storefrontu
- **70+ platebních poskytovatelů**
- **Integrace s Lightspeed Retail POS**
- **ShopApp** – nativní mobilní aplikace s vaší značkou
- **Extrémně nízká vstupní bariéra**

**Slabé stránky:**

- **Velmi limitovaný design** (málo šablon)
- **Funkčně slabší** než Shopify, Wix, BigCommerce
- **Multilingual jen od Business plánu**
- **Amazon, eBay, Walmart jen od Business**
- **Pokročilé funkce (subscriptions, reviews) jen od Business+**
- **Malá česká komunita** developerů/partnerů

**ČR kontext:**

- Používaný spíše jako doplněk k existujícím českým webům
- Chybí nativní integrace na Zásilkovnu, ČP, GoPay, ComGate
- Čeština v UI částečně podporovaná
- Méně populární než Shoptet, Upgates, WooCommerce

---

## 2. Ecwid vs. Lightspeed Ecom E-Series

Tuto dvojakou identitu je důležité pochopit – **Ecwid je stejná platforma, ale prodává se pod dvěma jmény:**

### 2.1 Ecwid (standalone)

- Pro merchants, kteří **chtějí jen e-commerce**
- Nemusí mít Lightspeed Retail POS
- Platí přímo Ecwid plány (Starter, Venture, Business, Unlimited)
- Přístup přes `my.ecwid.com`

### 2.2 Lightspeed Ecom (E-Series)

- Součást **Lightspeed Retail POS (X-Series)** subscription
- **Business plán je zahrnutý zdarma** v Retail POS Core/Plus plánech
- Primárně pro merchants s kamennými prodejnami
- Stejné features jako Ecwid Business, ale přístup přes Lightspeed BackOffice
- Nutné nastavení v E-Series admin panelu (Ecwid backend)

### 2.3 Co je rozdíl?

Funkčně téměř žádný – **Lightspeed Ecom E-Series je Ecwid s Retail POS integrací** v ceně. Pokud máte Lightspeed Retail, máte Ecwid Business zdarma.

### 2.4 Brand migrace

Lightspeed postupně sjednocuje branding – místo "Ecwid" se stále více používá "Lightspeed Ecom". V dokumentech a UI najdete obě jména.

**Aktuální stav (2026):**

- Web: `ecwid.com` redirectuje na `www.lightspeedhq.com/ecommerce`
- Admin: stále používá Ecwid branding
- Pomoc: help.ecwid.com i support.lightspeedhq.com
- Mobile app: stále "Ecwid" na App Store / Google Play

---

## 3. Tarify a cenové plány

⚠️ **Důležité upozornění:** Ceny se změnily **2. března 2026** – Venture, Business, Unlimited plány byly zvýšeny. Starter zůstal beze změny.

### 3.1 Přehled plánů (po 2.3.2026)

**Ceny roční (přepočteno na měsíční):**

| Plán               | Měsíční cena | Roční cena (/měs.) | Roční úspora |
| ------------------ | ------------ | ------------------ | ------------ |
| **Starter (Free)** | 0 USD        | 0 USD              | -            |
| **Venture**        | 25 USD       | 19 USD             | 16%          |
| **Business**       | 45 USD       | 39 USD             | 13%          |
| **Unlimited**      | 105 USD      | 89 USD             | 15%          |

### 3.2 Starter (Free Forever) – 0 USD

**Navždy zdarma**, bez časového limitu.

**Limity:**

- **Pouze 10 produktů** (původně 5, zvýšeno v 2024)
- **Pouze fyzické produkty** (bez digital downloads)
- **Bez Instant Site** (jen embed)
- **Bez e-mailové podpory** (jen help center po 30 dnech)

**Co získáte:**

- Obchod v 1 jazyku
- Unlimited bandwidth
- Embed na WordPress, Wix, atd.
- Základní checkout
- PayPal, Stripe, Square
- Mobile-responsive
- SSL zdarma
- 0% transaction fees
- Livechat podpora prvních 30 dní

**Pro koho:** Testování platformy, hobby projekty, prodej 1–5 produktů měsíčně

### 3.3 Venture – 19 USD/měs. (roční) / 25 USD/měs. (měsíční)

**Small business starter plán.**

Přidává k Starter:

- **100 produktů**
- **Digital downloads** (max 1 GB per soubor)
- **Instant Site** builder
- **Facebook Shop**
- **Instagram Shop**
- **TikTok Shop**
- **Pinterest Shopping**
- **Google Shopping**
- **Basic advertising** (Google Ads, Facebook Ads)
- **Email marketing** (Mailchimp integrace)
- **Custom domain** support
- **Product filters**
- **Discount coupons**
- **Abandoned cart emails**
- **Mobile POS** (Square, Clover integrace)
- **LiveChat podpora**

### 3.4 Business – 39 USD/měs. (roční) / 45 USD/měs. (měsíční)

**Optimální plán pro většinu SME obchodů.**

Přidává k Venture:

- **2 500 produktů**
- **Product variants** (size, color, atd.)
- **Wholesale pricing groups**
- **Customer groups**
- **Staff accounts** (2)
- **Amazon integrace**
- **eBay integrace**
- **Automated tax calculations** (přes Avalara)
- **Subscriptions** (recurring billing)
- **Product reviews** (nativní)
- **Advanced SEO**
- **Customer notifications customization**
- **Multilingual catalog** (multi-language support)
- **Lightspeed Retail POS integrace** ✅
- **Phone support**
- **2 hours custom development** (roční plán)

### 3.5 Unlimited – 89 USD/měs. (roční) / 105 USD/měs. (měsíční)

**Enterprise-like plán pro velké nebo rostoucí obchody.**

Přidává k Business:

- **Neomezené produkty**
- **Neomezené staff accounts**
- **ShopApp** – branded mobile app (iOS + Android)
- **Walmart Marketplace**
- **Priority support**
- **12 hours custom development** (roční plán)
- **Priority onboarding**

### 3.6 Srovnávací tabulka plánů

| Funkce                  | Starter | Venture | Business | Unlimited |
| ----------------------- | ------- | ------- | -------- | --------- |
| Cena (roční, USD/měs.)  | 0       | 19      | 39       | 89        |
| Produkty                | 10      | 100     | 2 500    | ∞         |
| Staff accounts          | 1       | 1       | 2        | ∞         |
| Transaction fee         | 0%      | 0%      | 0%       | 0%        |
| Digital products        | ❌      | ✅      | ✅       | ✅        |
| Instant Site            | ❌      | ✅      | ✅       | ✅        |
| Custom domain           | ❌      | ✅      | ✅       | ✅        |
| Facebook/Instagram Shop | ❌      | ✅      | ✅       | ✅        |
| Google Shopping         | ❌      | ✅      | ✅       | ✅        |
| Abandoned cart          | ❌      | ✅      | ✅       | ✅        |
| Product variants        | ❌      | ❌      | ✅       | ✅        |
| Product filters         | ❌      | ✅      | ✅       | ✅        |
| Multilingual catalog    | ❌      | ❌      | ✅       | ✅        |
| Wholesale groups        | ❌      | ❌      | ✅       | ✅        |
| Subscriptions           | ❌      | ❌      | ✅       | ✅        |
| Product reviews         | ❌      | ❌      | ✅       | ✅        |
| Amazon                  | ❌      | ❌      | ✅       | ✅        |
| eBay                    | ❌      | ❌      | ✅       | ✅        |
| Walmart                 | ❌      | ❌      | ❌       | ✅        |
| Lightspeed POS          | ❌      | ❌      | ✅       | ✅        |
| ShopApp (branded)       | ❌      | ❌      | ❌       | ✅        |
| Phone support           | ❌      | ❌      | ✅       | ✅        |
| Custom development      | 0 h     | 0 h     | 2 h      | 12 h      |

### 3.7 Skryté náklady

- **Domain:** 15–25 USD/rok (pokud koupíte přes Ecwid) nebo u externího registrátora
- **Premium apps:** 5–50 USD/měs. v App Marketu
- **ShopApp build fee:** 500–5 000 USD pro custom native app (obvykle v Unlimited plánu zdarma, ale s publishing fees Apple/Google)
- **Payment processing fees:** 2,6% – 2,9% + 0,30 USD (Stripe, PayPal, Lightspeed Payments)
- **Mailchimp premium:** navíc za email marketing

### 3.8 Speciální nabídky

- **Neziskovky:** 6 měsíců Venture zdarma
- **Nonprofit pricing:** slevy pro non-profit organizace
- **Studenti / edu:** limitní nabídky
- **Promo 14 dnů trial** na placené plány (pro non-free users)

### 3.9 Billing měny

Fakturace v závislosti na zemi:

- USD (USA, výchozí)
- EUR (EU)
- GBP (UK)
- AUD (Austrálie)
- MXN (Mexiko)
- INR (Indie)

Pro ČR: **fakturace v EUR** (pokud ČR/EU) nebo USD.

---

## 4. Ecwid Admin – rozhraní

Ecwid admin (`my.ecwid.com`) je centrální dashboard pro správu obchodu.

### 4.1 Dashboard (Home)

- **Sales overview** (dnes, 7 dní, 30 dní, custom)
- **Latest orders**
- **Top products**
- **Store visitors**
- **Conversion rate**
- **Getting started checklist** (pro nové merchants)
- **Quick actions**

### 4.2 Catalog

- **Products**
- **Categories**
- **Filters** (pro storefront)
- **Product search** v adminu
- **Bulk actions**

### 4.3 My Sales

- **Orders**
- **Abandoned carts**
- **Subscriptions** (Business+)
- **Customers**
- **Discounts**
- **Gift cards** (přes apps)

### 4.4 Marketing

- **Email campaigns** (přes Mailchimp integraci)
- **Newsletter subscribers**
- **Abandoned cart recovery**
- **Product promotions**
- **Automated emails**
- **Pop-ups** (přes apps)

### 4.5 Sales channels

- **Instant Site**
- **Custom website** (embed code)
- **Facebook Shop**
- **Instagram Shop**
- **TikTok Shop**
- **Pinterest Shopping**
- **Google Shopping**
- **Amazon** (Business+)
- **eBay** (Business+)
- **Walmart** (Unlimited)
- **Mobile app** (ShopApp na Unlimited)
- **POS** (Lightspeed Retail, Square, Clover)

### 4.6 Reports

- **Sales reports**
- **Products reports**
- **Customer reports**
- **Tax reports**
- **Store traffic**
- Pokročilejší reporty přes **Google Analytics integraci**

### 4.7 Apps (App Market)

- **Installed apps**
- **App Market** (browse & install)
- **Recommendations**

### 4.8 Website (Instant Site editor)

Pokud používáte Instant Site:

- **Edit Site** (visual editor)
- **Pages**
- **Design** (templates, colors, fonts)
- **Header & Footer**
- **Blog** (limited)

### 4.9 Settings

- **General** (store profile, currency, time zone)
- **Payment** (payment gateways)
- **Shipping & Pickup**
- **Taxes**
- **Checkout** (settings, fields)
- **Mail** (email templates)
- **Legal** (privacy policy, terms)
- **Account** (billing, staff, permissions)
- **API access**
- **Integrations**

### 4.10 My Profile

- **Account info**
- **Billing and Plans** (subscription management)
- **Staff accounts**
- **Domain & security**

### 4.11 Ecwid Mobile App

- **iOS + Android**
- Management store kdekoliv
- Push notifikace pro orders
- Catalog editing
- Customer management
- Orders processing
- Mobile POS (Square Reader integrace)
- Zobrazit statistiky
- Přijímat platby (Apple Pay v appce)

### 4.12 Legacy Instant Site vs. New-Gen

Ecwid migroval na **New-Gen Instant Site** v 2023–2024:

- Modernější editor
- Více šablon
- Lepší performance
- Support pro custom code sekce

Legacy verze stále funguje pro stávající merchants, ale nové funkce přicházejí jen do New-Gen.

MARKDOWN_EOF
wc -l /home/claude/ecwid/ecwid-kompletni-analyza.md

---

## 5. Unikátní embed widget přístup

**Ecwid's signature feature** – schopnost embedovat obchod do prakticky jakéhokoliv webu. Toto ho odlišuje od Shopify, Wix, Squarespace a BigCommerce.

### 5.1 Jak to funguje

M�sto toho, abyste museli přebudovat váš web na Ecwid, jednoduše:

1. Vytvoříte si Ecwid účet a katalog produktů
2. Zkopírujete integrační kód
3. Vložíte kód na libovolnou stránku vašeho webu
4. Zákazníci nakupují bez opuštění vašeho webu

### 5.2 Podporované platformy (oficiální pluginy)

**CMS:**

- **WordPress** (nejpopulárnější, oficiální plugin)
- **Drupal**
- **Joomla**
- **ExpressionEngine**
- **Contao**

**Website builders:**

- **Wix** (oficiální integrace přes Wix App Market)
- **Squarespace** (embed code)
- **Weebly**
- **Google Sites**
- **Tilda**
- **Jimdo**
- **Adobe Muse** (legacy)

**Statické weby:**

- **HTML/CSS weby** (embed code)
- **Jekyll, Hugo, Gatsby, Next.js** statické stránky
- **GitHub Pages**
- **Netlify, Vercel** deployment

**Blogging:**

- **Blogger**
- **Tumblr** (legacy, omezeně)

### 5.3 Co můžete embedovat

Ecwid není jen celý obchod – můžete na web vložit:

**Celý obchod:**

- Product Catalog widget (hlavní obchod)

**Jednotlivé prvky:**

- **Product Card** (jeden produkt na stránce)
- **Buy Now Button** (1 tlačítko s vybraným produktem)
- **Category widget** (jedna kategorie zobrazená)
- **Search widget**
- **Cart icon (shopping bag)** s floating cart
- **Mini-cart widget**

### 5.4 WordPress plugin

Nejpropracovanější integrace:

- **Free plugin v WP repozitáři**
- Plně konfigurovatelný přes WP admin
- Customization přes shortcodes
- Custom post types
- SEO optimalizace
- WooCommerce import možný
- Podporuje Elementor, Beaver Builder, WP Bakery
- Multisite WordPress

### 5.5 Wix integrace

- **Oficiální Ecwid App** v Wix App Market
- Drag-drop na libovolnou Wix stránku
- Sync s Ecwid adminem
- Ecwid běží ve Wix iframe s full functionality

### 5.6 Kód (general embed)

```html
<div id="my-store-STORE_ID"></div>
<div>
  <script
    data-cfasync="false"
    type="text/javascript"
    src="https://app.ecwid.com/script.js?STORE_ID&data_platform=code"
    charset="utf-8"
  ></script>
  <script>
    xProductBrowser(
      'categoriesPerRow=3',
      'views=grid(20,3) list(60) table(60)',
      'categoryView=grid',
      'searchView=list',
      'id=my-store-STORE_ID',
    );
  </script>
</div>
```

### 5.7 Výhody embed přístupu

- **Žádná migrace webu** – nechte si váš stávající web
- **Zachování SEO** – vaše stávající stránky zůstanou
- **Zachování designu** – Ecwid se přizpůsobí
- **Jednoduchá implementace** – 5 minut setup
- **Lze testovat zdarma** (Free plán)
- **Ideální pro blogery, portfolio weby, restaurace, NGO**

### 5.8 Nevýhody embed přístupu

- **SEO je omezené** – obchod běží v JavaScript widgetu (ne vždy ideální pro SEO, na rozdíl od nativních Shopify/Shoptet stránek)
- **Product pages mohou mít problém s Google indexováním** (záleží na implementaci)
- **Design limitace** – Ecwid widget musí respektovat styl vašeho hostingu
- **Závislost na hosting performance** vašeho webu

### 5.9 Alternativa: Instant Site

Pokud nemáte web, Ecwid nabízí **Instant Site** – vlastní jednoduchý website builder (viz sekce 6).

### 5.10 Migrace z jedné platformy na druhou

Jelikož je Ecwid widget, můžete ho snadno **přenést z jednoho webu na druhý**. Pokud změníte z WordPress na Wix, můžete prostě zkopírovat Ecwid integraci – váš katalog, zákazníci a objednávky zůstávají.

---

## 6. Instant Site – vestavěný website builder

Pro merchants bez existujícího webu nabízí Ecwid **Instant Site** – jednoduchý one-page (nebo multi-page) website builder.

### 6.1 Přehled Instant Site

- **Single-page** (default) nebo multi-page
- **Hostovaný Ecwid** (subdoména `STOREID.company.site`)
- **Custom domain** na Venture+
- **Mobile-responsive**
- **SSL zdarma**
- **Unlimited bandwidth**

### 6.2 Šablony (New-Gen)

**Cca 15 templates** (oproti 200+ u Squarespace, 2500+ u Wixu):

- Classic
- Bold
- Minimal
- Vibrant
- Elegant
- Dark
- Modern

⚠️ **Designově výrazně omezenější** než Wix nebo Squarespace.

### 6.3 Sekce (blocks)

Instant Site používá blokovou architekturu:

- **Header** (logo, navigation, cart)
- **Hero / Cover** (velký banner)
- **About** (o firmě)
- **Categories** (zobrazí kategorie produktů)
- **Featured Products** (vybrané produkty)
- **All Products** (celý katalog)
- **Gallery** (foto galerie)
- **Text** (blog-style text)
- **Contact** (form + map)
- **Testimonials**
- **FAQ**
- **Newsletter signup**
- **Social links**
- **Custom HTML/CSS/JS** (New-Gen)
- **Google Maps**
- **Video embed**
- **Image + text columns**

### 6.4 Editor

- **Drag-and-drop sekcí** (v rámci stránky)
- **Barvy, fonty** (limited palety)
- **Logo upload**
- **Hero image/video**
- **Section-level styling**
- Ne tak flexible jako Wix Editor nebo Squarespace Fluid Engine

### 6.5 Pages (multi-page)

Instant Site podporuje **více stránek** (od 2023–2024):

- Homepage
- Shop (catalog)
- Blog
- About
- Contact
- FAQ
- Custom pages

Navigation mezi stránkami v header.

### 6.6 Custom code sections (New-Gen)

Lze přidat **Custom Code Section** s HTML/CSS/JavaScript:

- Google Calendar widget
- 3D viewer
- Live chat widgets
- Embedded forms
- Custom UI elements

### 6.7 Blog (limited)

- Blog sekce v Instant Site
- Categories, tags
- Comments přes Disqus (přes custom code)
- SEO per post
- ⚠️ Méně features než Wix / Squarespace blog

### 6.8 SEO v Instant Site

- Meta title & description
- Open Graph tags
- SEO URLs
- Sitemap.xml auto
- Structured data
- Google verification (na Venture+)

### 6.9 Custom domain

Na Venture+:

- Připojení vlastní domény
- Nebo koupě přes Ecwid Domains
- SSL automatic
- DNS management

### 6.10 Headers & Footers

Nastavitelné:

- Logo
- Navigation menu
- Social icons
- Cart icon (shopping bag)
- Contact info
- Copyright
- Multi-language selector (Business+)

### 6.11 Legacy Instant Site

Před 2023 existovala **legacy Instant Site** (jednoduchý one-page builder):

- Stále funguje pro stávající obchody
- Nové funkce jen v New-Gen
- Migrace z legacy manuálně

### 6.12 Limitace Instant Site

- **Méně šablon** (15 vs. 200+ u Squarespace)
- **Méně customization** (vs. Wix Editor)
- **Slabší blog** (vs. Squarespace)
- **Bez pokročilých interaktivních prvků**
- **Omezené animace**
- **Menší kontrola nad mobilním layoutem**

### 6.13 Kdy použít Instant Site vs. embed?

**Instant Site ideální pro:**

- Nemáte existující web
- Jednoduchý obchod
- Rychlý launch
- Minimum úsilí

**Embed widget ideální pro:**

- Máte existující WordPress / Wix / Squarespace web
- Chcete zachovat design a SEO
- Potřebujete bohatší obsah než Instant Site nabízí
- Blogger, portfolio, content creator

---

## 7. Produkty a katalog

### 7.1 Typy produktů

- **Physical product** (fyzické zboží)
- **Digital product** (download, na Venture+)
- **Service** (bez shipping)
- **Subscription product** (recurring, Business+)
- **Gift card** (přes apps)
- **Event ticket** (přes apps)

### 7.2 Product details

Každý produkt obsahuje:

- **Name** (product title)
- **Description** (rich text editor)
- **Short description**
- **SKU**
- **Price**
- **Sale price** / **Compare at price**
- **Cost price** (pro margin reporting)
- **Categories** (unlimited, nested)
- **Product images** (unlimited, multiple angles)
- **Product videos** (YouTube, Vimeo embed)
- **Product options** (varianty)
- **Weight** (for shipping)
- **Dimensions** (LxWxH)
- **Tax class**
- **Product visibility** (published, hidden, scheduled)
- **SEO fields** (meta title, description, URL)
- **Custom attributes**

### 7.3 Product variants (Business+)

⚠️ **Varianta produktu jen od Business plánu!** Na Free a Venture nelze mít produkty s variantami (size, color, atd.).

**Business+:**

- **Unlimited options** per produkt (size, color, material)
- **Unlimited choices** per option
- **Per-variant:**
  - Price
  - SKU
  - Weight
  - Stock
  - Image (unique)
- **Variant combinations** auto-generated
- **Variant picker** – dropdown, radio, buttons, swatches

### 7.4 Product options types

Pro Business+:

- **Dropdown**
- **Radio buttons**
- **Text field** (personalization)
- **Upload file**
- **Checkbox**
- **Date picker**
- **Color swatch**
- **Size swatch**
- **Image swatch**

### 7.5 Categories

- **Unlimited categories**
- **Nested subcategories** (unlimited depth)
- **Category images**
- **Category descriptions**
- **SEO per category**
- **Category-specific product display**

### 7.6 Product images

- **Unlimited images** per produkt
- **Automatic image optimization**
- **Responsive images**
- **Zoom on hover/click**
- **Gallery view**
- **360° images** (přes apps)
- **Alt text**

### 7.7 Product videos

- YouTube embed
- Vimeo embed
- Self-hosted (omezeně)
- Auto-play, loop možnosti

### 7.8 Digital products

**Venture+:**

- **Max file size:** 1 GB per soubor
- **Multiple files** per produkt
- **Automatic delivery** po zaplacení
- **Download limit** (počet stažení)
- **Download link expiration**
- Typy: PDF, video, audio, archives, software

### 7.9 Bulk operations

- **CSV import/export**
- **Bulk edit** v admin
- **Bulk price change**
- **Bulk category assignment**
- **Bulk delete**

### 7.10 Product filters

Na Venture+:

- Filtrace produktů v katalogu
- **Price range**
- **Categories**
- **Options** (size, color)
- **Stock availability**
- **Custom attributes**

### 7.11 Product search

- **Native search** v storefrontu
- Search by name, SKU, description
- Auto-suggestions
- Search analytics v reports

### 7.12 Product variants limit

- **Business plán:** 250 variant per produkt
- **Unlimited plán:** neomezené varianty

### 7.13 Custom attributes

- Pre-defined atributy (brand, material, color)
- Custom attributes (manufacturer, warranty, etc.)
- Searchable and filterable
- SEO benefit

### 7.14 Product tags

- Unlimited tagy
- Display v storefrontu
- Filterable
- Useful pro merchandising

### 7.15 Related products

- Manual nebo automatic
- Zobrazeno na product page
- Cross-sell opportunity

### 7.16 Pre-orders

Přes apps:

- Waiting List App
- Pre-order buttons
- Back-in-stock notifications

### 7.17 Product reviews (Business+)

**Native review system:**

- Star ratings (1-5)
- Text reviews
- Photo reviews (přes apps)
- Email request po purchase
- Moderation
- Display na product page
- Schema.org markup

### 7.18 Import from other platforms

Přes oficiální migration tools nebo třetí strany:

- **Shopify** → Ecwid (přes Cart2Cart, LitExtension)
- **WooCommerce** → Ecwid
- **Squarespace** → Ecwid
- **BigCommerce** → Ecwid
- **Etsy** (limited, CSV)

---

## 8. Sklad a inventory management

### 8.1 Stock tracking

- **Track quantity** (kolik kusů)
- **Unlimited stock** (no tracking)
- Per-product nebo per-variant (Business+)

### 8.2 Low stock alerts

- Email notifikace
- Nastavitelný threshold
- Admin dashboard alerty

### 8.3 Out of stock handling

- **Hide product** když není skladem
- **Show as out of stock** (grayed out)
- **Allow backorder** (Business+)

### 8.4 Inventory management

- **Bulk stock update** přes CSV
- **API endpoints**
- **Manual editing**
- **Activity log**

### 8.5 Multiple locations

⚠️ **Ecwid standardně nepodporuje multi-location inventory.** Existuje přes:

- Lightspeed Retail POS integrace
- Třetí strany apps

### 8.6 POS inventory sync

Přes Lightspeed Retail:

- Unified online + offline inventory
- Auto-decrement při prodeji (online i v-store)
- Sync produktů mezi systémy

### 8.7 Barcode support

- **SKU jako barcode** (v POS)
- **Barcode scanning** přes Lightspeed Retail nebo Square
- Není nativně v Ecwid web adminu

### 8.8 Inventory reports

- **Stock levels** per produkt
- **Low stock** report
- **Out of stock** list
- Export do CSV

### 8.9 Omezení inventory

- **Bez nativního purchase orders**
- **Bez forecasting**
- **Bez multi-warehouse** nativně (jen přes Lightspeed)
- **Bez barcode printing**

---

## 9. Objednávky a fulfillment

### 9.1 Order lifecycle

**Payment statuses:**

- Paid
- Awaiting Payment
- Refunded
- Partially Refunded
- Cancelled
- Processing

**Fulfillment statuses:**

- New
- Awaiting Processing
- Processing
- Shipped
- Delivered
- Ready for Pickup
- Cancelled
- Returned

### 9.2 Order detail

- Order ID
- Customer info
- Products + varianty
- Subtotal, tax, shipping, discount, total
- Payment method
- Shipping address
- Tracking numbers
- Order notes (internal, external)
- Activity log

### 9.3 Fulfillment workflow

- **Manual fulfillment**
- **Partial fulfillment** (různé položky zvlášť)
- **Automatic** pro digital products
- **Mark as shipped** button
- **Auto-email** zákazníkovi s tracking

### 9.4 Shipping labels

**Ecwid Shipping Labels** (jen USA, Německo, Belgie, Nizozemsko):

- Nakupte poštovné přímo v Ecwid
- Tisk štítků
- Supported carriers:
  - **USPS** (USA)
  - **Deutsche Post / DHL** (Německo)
  - **bpost** (Belgie)
  - **PostNL** (Nizozemsko)

**Pro ostatní země** – přes apps:

- **Shippo**
- **ShipStation**
- **Sendcloud** (EU – Zásilkovna, DPD, atd.)
- **Easyship**

### 9.5 Tracking

- Manual zadání tracking number
- Auto-email
- Customer vidí v account
- Branded tracking pages (přes AfterShip)

### 9.6 Email notifications

Pre-built templates:

- Order confirmation
- Payment received
- Order shipped
- Order delivered
- Order cancelled
- Refund processed
- Admin new order
- Low inventory (admin)
- Abandoned cart recovery (Venture+)

Templates lze customizovat (HTML).

### 9.7 Abandoned cart recovery (Venture+)

- **Automatic emails** po 1 hodině, 6 hodinách, 24 hodinách
- Discount code v emailu
- Recovery tracking
- Dashboard přehled

### 9.8 Refunds

- **Full / partial refund**
- **Refund to original payment method**
- **Store credit** refund (přes apps)
- **Inventory restock** option

### 9.9 Returns (RMA)

- **Nativně omezené** – manual proces
- Email komunikace
- Přes apps pro self-service returns:
  - **Returnly**
  - **Narvar**

### 9.10 Draft orders

- **Nativně omezené**
- Manual order creation možná přes admin
- Pro B2B quotes nebo phone orders

### 9.11 Invoice generation

- **Automatic** pro každou objednávku
- **PDF download**
- **Customizable templates**
- Email delivery customers

### 9.12 Fraud prevention

- Přes payment processors (Stripe Radar, PayPal fraud detection)
- 3D Secure
- AVS + CVV check
- Manual review

### 9.13 Order export

- **CSV export**
- Filtry (date, status)
- Pro accounting software import

---

## 10. Zákazníci a customer management

### 10.1 Customer database

- **Zákaznické profily**
- **Order history**
- **Total spent**
- **Average order value**
- **Last order date**
- **Addresses**
- **Email**
- **Phone**
- **Custom fields**

### 10.2 Customer Accounts

Zákazníci mohou:

- **Register** (email + password nebo OAuth)
- **Login** a view order history
- **Manage addresses**
- **Manage subscriptions** (Business+)
- **Re-order** previous orders
- **Track orders**

### 10.3 Guest checkout

- Default na
- Fast checkout
- No account required

### 10.4 Customer groups (Business+)

- **B2B pricing**
- **VIP zákazníci**
- **Wholesale groups**
- **Custom discount %**
- **Custom visible produkty**
- **Tax-exempt statuses**

### 10.5 Customer segments

- Manual labels
- Filter by:
  - Total orders
  - Total spent
  - Last order
  - Location
- Export pro email marketing

### 10.6 Customer import/export

- **CSV import** customers
- **CSV export** pro CRM sync
- Bulk assign to groups

### 10.7 GDPR / privacy

- **Right to erasure** – delete customer
- **Data export** pro zákazníka
- **Cookie consent** banner
- **Privacy policy** page
- **Opt-in marketing**

### 10.8 Customer notes

- Internal notes per customer
- Admin-only view
- Activity timeline

### 10.9 CRM integrations

Přes apps:

- **HubSpot**
- **Salesforce**
- **Mailchimp** (marketing CRM)
- **ActiveCampaign**
- **Zoho CRM**

---

## 11. Checkout a platební systém

### 11.1 Native checkout

- **Single-page checkout**
- **Mobile-optimized**
- **Guest nebo account**
- **Express payment buttons** (Apple Pay, Google Pay)
- **Discount code field**
- **Custom fields** (Business+)
- **Terms & conditions**
- **Order comments**

### 11.2 Checkout customization

- **Colors a fonts** (via Instant Site or embed styling)
- **Custom fields** (Business+)
- **Required/optional fields**
- **Custom post-purchase page** (limited)

### 11.3 Payment gateways

**70+ platebních poskytovatelů podporováno globálně.**

**Nejpopulárnější:**

- **Stripe** (globální, karty + wallets)
- **PayPal** (globální)
- **Square** (USA, UK, Austrálie, Kanada)
- **Lightspeed Payments** (BE, AU, IE, CA, NL, US, UK)
- **Authorize.Net** (USA)
- **Braintree** (globální)
- **2Checkout / Verifone**
- **Worldpay**
- **Adyen**

**Regional:**

- **Mollie** (EU, incl. iDEAL, Bancontact, SEPA)
- **Klarna** (BNPL)
- **Afterpay / Clearpay** (BNPL)
- **Razorpay** (Indie)
- **PayU** (LATAM, EU)
- **Mercado Pago** (LATAM)
- **Paystack** (Afrika)
- **Yandex.Checkout** (Rusko)
- **Alipay, WeChat Pay** (Čína)

**Dobírka (Cash on Delivery):**

- Manual offline payment
- Configurable per shipping method

### 11.4 Lightspeed Payments

**Nativní brána** vyvíjená Lightspeed (konkurence Stripe):

**Dostupnost:**

- **Belgie**
- **Austrálie**
- **Irsko**
- **Kanada**
- **Nizozemsko**
- **USA**
- **UK**

⚠️ **Není dostupná v ČR** (2026).

**Features:**

- Všechny major credit/debit karty
- **Google Pay + Apple Pay**
- **One-click checkout** (Lightspeed specific)
- **Subscription billing** support
- **iDEAL** (NL)
- **Bancontact** (BE)
- **Refunds** přímo z admin

**Processing fees:** závislé na zemi, typicky 2,6% – 2,9% + fixed fee

### 11.5 0% Transaction fees

**Unique Ecwid advantage:**

- Ecwid nevybírá transaction fee na žádném plánu
- Platí se jen fee brány (Stripe, PayPal)
- Úspora oproti Shopify (až 2% na Basic)

### 11.6 Subscriptions (Business+)

**Native recurring billing:**

- Weekly, biweekly, monthly, quarterly, yearly
- Přes Stripe nebo PayPal
- Customer can manage v account
- Skip delivery option
- Cancel anytime

### 11.7 Multi-currency display

- Display v customer's currency (via apps)
- Selling v primary currency
- **Nenativní multi-currency checkout**

### 11.8 PCI compliance

- **PCI DSS Level 1 validated**
- **3D Secure 2** (SCA compliance)
- **Tokenization** (stored cards)
- **Merchant offloaded** PCI

### 11.9 ČR specifika

**Pro ČR je Ecwid slabší na platby:**

- **Hlavní možnost: Stripe** (karty, Apple Pay, Google Pay)
- **PayPal** (limited v ČR)
- **Mollie** (pokud operates v ČR)
- **Manual bank transfer**
- **Dobírka (COD)** – manual method
- ❌ **Žádný ComGate, GoPay, ThePay** nativně
- ❌ **Lightspeed Payments není v ČR**
- ❌ **Žádná EET** (již nepovinné, ale historicky absence)

Pro lokálních bran – nutnost custom integrace přes API nebo třetí strany.

### 11.10 BNPL (Buy Now Pay Later)

- **Klarna**
- **Afterpay / Clearpay**
- **Affirm** (USA)
- **Sezzle** (USA)
- Zobrazeno v checkoutu jako option

---

## 12. Doprava a dodání

### 12.1 Shipping zones

- **Unlimited zones** podle země, státu, ZIP
- **Global zone** (rest of world)
- **Local zone** (radius-based)

### 12.2 Shipping methods

- **Flat rate** per order
- **Free shipping** (s minimum order podmínkou)
- **Per item** shipping rate
- **Weight-based**
- **Price-based** tiered rates
- **Real-time carrier rates** (via carrier integrations)

### 12.3 Real-time shipping rates

Přes carrier integrations:

- **USPS** (USA)
- **UPS** (USA, limited int.)
- **FedEx**
- **DHL**
- **Canada Post**
- **Australia Post**

### 12.4 Shipping label printing

**Ecwid Shipping Labels** (jen 4 země):

- **USA:** USPS labels
- **Německo:** DHL, Deutsche Post
- **Belgie:** bpost
- **Nizozemsko:** PostNL

V ostatních zemích nutno použít externí apps.

### 12.5 Local delivery & pickup

- **Local delivery** (by radius, postal code)
- **In-store pickup** (customers pick up osobně)
- **Custom pickup locations**
- **Delivery time slots** (přes apps)

### 12.6 Curbside pickup

- Nastavitelné jako shipping option
- Pickup instructions
- Email notification s time

### 12.7 Shipping extensions

Přes App Market:

- **Sendcloud** (EU – Zásilkovna, DPD, PPL, GLS, DHL, UPS)
- **ShipStation** (USA, global)
- **Shippo** (USA)
- **Easyship** (international)
- **AfterShip** (tracking pages)
- **Route** (insurance + tracking)

### 12.8 Tracking

- Manual tracking number entry
- Automatický email s tracking
- Branded tracking (přes apps)

### 12.9 Shipping insurance

- Přes Route, Navidium (USA)
- Add-on v checkoutu

### 12.10 International shipping

- **DDU (Delivered Duty Unpaid)** – customer platí cla
- **DDP (Delivered Duty Paid)** – merchant platí cla
- Customs documentation (přes ShipStation, Sendcloud)

### 12.11 ČR specifika

**Pro české merchants chybí nativní integrace:**

- ❌ **Zásilkovna** (nutno přes Sendcloud)
- ❌ **Česká pošta**
- ❌ **PPL**
- ❌ **DPD, GLS, DHL**
- ❌ **Výdejní místa**

**Řešení:**

- **Sendcloud app** (EU carriers hub, včetně CZ)
- **Manual flat rates** + vlastní podání
- **Custom API integrace** (pro dev týmy)

### 12.12 Shipping policies

- Customer-facing shipping info page
- Estimated delivery times
- Delivery promises

---

## 13. Daně a compliance

### 13.1 Manual tax rates

**Na všech plánech:**

- **Unlimited tax zones** per country, state, ZIP
- **Tax rates** per zone
- **Tax classes** (standard, reduced, zero)
- **Tax-inclusive vs. exclusive** pricing
- **Per-product tax class**

### 13.2 Automatic tax calculations (Business+)

**Přes Avalara AvaTax integraci:**

- Automatic sales tax v USA
- Real-time rate updates
- Address validation
- Multi-state compliance
- EU VAT rates

### 13.3 EU VAT

- Manual VAT rates setup (21%, 15%, 10%, 5%, 0%)
- **Reverse charge** (B2B s VAT ID)
- **OSS compliance** možná přes Avalara
- **Digital goods VAT**

### 13.4 USA Sales Tax

- Per-state rates
- Marketplace facilitator compliance
- Economic nexus tracking (Avalara)

### 13.5 International

- **GST** (Austrálie, Kanada, Indie)
- **HST, PST** (Kanada)
- **VAT** (UK, EU)
- **JCT** (Japonsko)

### 13.6 Tax reports

- Sales by tax region
- Collected tax summary
- Tax by product
- Export pro accounting

### 13.7 Compliance certifikace

- **PCI DSS Level 1** validated
- **SOC 2** compliance
- **GDPR compliant**
- **CCPA compliant**
- **PIPEDA** (Kanada)

### 13.8 ČR specifika

**Pro české merchants:**

- Manual DPH setup (21%, 15%, 10%, 0%)
- ❌ **EET** (není podpora, ale dnes nepovinné)
- ❌ **ARES** validace
- **Účetní systémy** (Pohoda, Money, FlexiBee) jen přes Zapier/Make
- **Intrastat** reporting – manual

---

## 14. Mezinárodní prodej

### 14.1 Multi-language storefront

**Default:**

- **51+ jazyků** překlad UI storefrontu
- Automatic detection podle browser
- Manual selector

**Podporované jazyky (vzorek):**

- English, Spanish, French, German, Italian
- Portuguese (BR, PT), Dutch, Polish, Czech ✅
- Russian, Ukrainian, Chinese (Simplified, Traditional)
- Japanese, Korean, Vietnamese, Thai
- Arabic, Hebrew (RTL support)
- Swedish, Norwegian, Danish, Finnish
- Turkish, Greek, Romanian, Hungarian, Bulgarian
- A další

### 14.2 Multilingual catalog (Business+)

⚠️ **Multi-language content (product names, descriptions, kategorie) jen od Business plánu!**

Features:

- **Translated product titles**
- **Translated descriptions**
- **Translated category names**
- **Translated SEO meta**
- Customer vidí v jeho jazyce

### 14.3 Multi-currency

- **Display** v customer currency (přes apps, geolocation)
- **Selling v jedné primární měně**
- Auto-conversion pro customer zobrazení
- ⚠️ **Není pravý multi-currency checkout** (na rozdíl od Shopify Markets)

### 14.4 Geolocation

- Přes apps (Geolocation App)
- Auto-redirect, currency switch
- Country popup

### 14.5 International shipping

- Unlimited countries
- Per-country rates
- Customs documents
- DDP/DDU options

### 14.6 International payments

- 70+ brán globálně
- Lokalizované methods per country
- Multiple currencies accepted

### 14.7 International tax

- EU VAT (přes Avalara)
- UK VAT post-Brexit
- USA sales tax
- Canada GST/HST/PST

### 14.8 Omezení international

- **Nenativní multi-currency checkout**
- **Bez Shopify Markets equivalent**
- **Slabší geolocation** (vs. Wix)
- **Komplexnější setup** pro multi-country
- **Limited duties automation**

---

## 15. Sales channels – omnichannel selling

Ecwid je silný v **omnichannel approach** – prodávat všude z jednoho dashboardu.

### 15.1 Přehled channels

**Web:**

- Instant Site
- Embed na vlastním webu (WordPress, Wix, Squarespace, atd.)

**Social:**

- **Facebook Shop**
- **Instagram Shopping + Checkout**
- **TikTok Shop**
- **Pinterest Shopping**
- **Snapchat** (limited)
- **YouTube Shopping**
- **WhatsApp Business**

**Marketplaces:**

- **Google Shopping**
- **Amazon** (Business+)
- **eBay** (Business+)
- **Walmart Marketplace** (Unlimited)

**In-person:**

- **Lightspeed Retail POS** (Business+)
- **Square POS** (všechny plány)
- **Clover POS**
- **Mobile POS** přes Ecwid iOS app

**Mobile:**

- **ShopApp** (Unlimited) – branded iOS/Android app

**Link-in-bio:**

- **Linkup** (Ecwid vlastní link-in-bio tool)

### 15.2 Centralized management

**Všechny kanály z Ecwid adminu:**

- Unified inventory
- Unified orders
- Unified customer data
- Unified catalog
- Automatic sync napříč kanály

### 15.3 Facebook Shop (Venture+)

- **Native Meta integration**
- Catalog sync automatic
- Instagram Shopping tags
- Facebook Shops + Marketplace
- Facebook Pixel auto-install
- Messenger checkout

### 15.4 Instagram Shopping (Venture+)

- **Product tags v příspěvcích**
- **Stories shopping stickers**
- **Reels shopping**
- **Instagram Checkout** (USA)
- Meta Catalog sync

### 15.5 TikTok Shop (Venture+)

- **TikTok catalog sync**
- **Shoppable TikToks**
- **Live shopping** (TikTok)
- Pixel install

### 15.6 Pinterest Shopping (Venture+)

- **Rich Pins**
- **Catalog sync**
- **Pinterest Tag**
- **Shopping Ads**

### 15.7 Google Shopping (Venture+)

- **Google Merchant Center** sync
- **Free listings** na Google
- **Google Shopping Ads**
- **Smart Shopping campaigns**

### 15.8 YouTube Shopping

- YouTube Shopping (přes Google Merchant)
- Video product tags
- Shop section na kanálu

### 15.9 WhatsApp Business

- **Share products** via WhatsApp
- **Order notifications**
- **Customer service**
- WhatsApp "Buy Now" button (limited)

### 15.10 Snapchat

- Limited integrace
- Přes Google Merchant Center

### 15.11 Link-in-bio (Linkup)

Ecwid's vlastní link-in-bio tool:

- **Free s Ecwid účtem**
- Single URL pro všechny social links
- Showcase products
- Alternative k Linktree
- Integrace s Ecwid katalogem

### 15.12 Sales channel management

- **Enable/disable** per kanál
- **Product visibility** per kanál (které produkty na Amazon vs. Instagram)
- **Price override** per kanál (přes apps)
- **Reports** per kanál

---

## 16. Marketplaces – Amazon, eBay, Walmart

Ecwid umožňuje prodej na velkých marketplaces, ale vyžaduje vyšší plán.

### 16.1 Amazon (Business+)

**Požadavek:** Amazon Professional Seller account (39,99 USD/měs. separate fee Amazon).

**Features:**

- **Catalog sync** – produkty z Ecwid → Amazon listing
- **Inventory sync** (unified stock levels)
- **Order sync** – Amazon orders zobrazí se v Ecwid adminu
- **Price sync**
- **Multi-region:** Amazon US, UK, DE, FR, IT, ES, CA
- **Bulk listing** creation

**Omezení:**

- Requires Amazon approval pro některé kategorie
- Amazon SKU mapping
- Category-specific requirements

### 16.2 eBay (Business+)

**Features:**

- **Native eBay integrace**
- **Product listings sync**
- **Inventory sync**
- **Order sync**
- **Variant support**
- **Multi-region:** eBay US, UK, DE, a další
- **Automated pricing rules**

### 16.3 Walmart Marketplace (Unlimited plán)

**Pouze Unlimited plán** – vyšší vstupní bariéra.

**Features:**

- **Walmart.com listings**
- **Inventory sync**
- **Order sync**
- Requires Walmart approval (ne každý merchant)

### 16.4 Google Shopping (Venture+)

- **Google Merchant Center** sync
- **Free listings** (Shopping tab)
- **Google Shopping Ads**
- **Performance Max** campaigns

### 16.5 Multi-marketplace apps

Přes App Market:

- **Codisto** (multi-marketplace – Amazon, eBay, Walmart, Google)
- **CedCommerce** (více marketplaces)
- **Sellbrite** (multichannel)
- **Sellercloud**

### 16.6 500+ marketplaces (přes apps)

S 3rd-party apps můžete prodávat na:

- Etsy
- Bonanza
- Rakuten
- Shein
- Target+
- Best Buy
- Wayfair
- Zalando
- Flipkart
- JD.com
- Mercado Libre
- A mnoho dalších

### 16.7 Marketplace order fulfillment

- **Orders se zobrazí v Ecwid adminu**
- **Fulfill přes Ecwid** (sync tracking zpět na marketplace)
- Nebo **FBA** (Fulfilled by Amazon) – Amazon handles shipping

### 16.8 Omezení

- **Amazon, eBay jen od Business**
- **Walmart jen Unlimited**
- **Etsy chybí native** (přes apps)
- **Requires marketplace approval**
- **Menší rozsah integrací** než Shopify (8 000+ apps)

---

## 17. POS integrace

Ecwid má silnou **POS story** díky akvizici Lightspeed.

### 17.1 Lightspeed Retail POS (X-Series)

**Primárně integrace** – nejsilnější kombinace.

**Business+ plán:**

- **Bi-directional sync:**
  - Products
  - Inventory
  - Orders
  - Customers
- **Unified backend** (Lightspeed BackOffice)
- **In-store + online** jednotný management
- **Multi-location** inventory
- **Advanced reporting**

**Dostupnost:** USA, Kanada, Austrálie, Nový Zéland, Japonsko, UK, a další.

**Lightspeed Retail hardware:**

- iPad POS
- Barcode scanners
- Receipt printers
- Cash drawers
- Card readers
- Customer displays

### 17.2 Lightspeed Ecom E-Series

**Pokud máte Retail POS**, dostáváte **Ecwid Business zdarma** jako součást Retail POS Core/Plus plánu. Viz sekce 2.

### 17.3 Square POS

**Free Ecwid plán kompatibilní** s Square:

- **Square Reader** (USB, Bluetooth)
- **Square Stand**
- **Square Terminal**
- **Product sync**
- **Order sync**
- **Mobile payments** via Square
- **USA, UK, Austrálie, Kanada, Japonsko, Irsko, Francie, Španělsko**

### 17.4 Clover POS

- **Native Ecwid integrace**
- Product sync
- Inventory sync
- Order sync
- USA hardware

### 17.5 Mobile POS (Ecwid iOS app)

**Accept payments anywhere:**

- Bluetooth Square Reader
- Apple Pay on iPhone (USA)
- Manual card entry
- Take orders at events, pop-ups, trade shows

### 17.6 POS features

**Bi-directional sync:**

- Product updates propagate in real-time
- Inventory decrement při prodeji (online i v-store)
- Customer data sdíleno
- Order history unified

### 17.7 POS hardware

Ecwid nemá vlastní hardware, ale integruje s:

- **Lightspeed Retail** hardware ecosystem
- **Square** hardware
- **Clover** hardware

### 17.8 In-person payments

**Co je nativně podporováno:**

- **Lightspeed Payments** (BE, AU, IE, CA, NL, US, UK)
- **Square Payments** (USA, UK, AU, CA, JP, IE, FR, ES)
- **Clover Payments** (USA)
- **Stripe Terminal** (přes apps)

**V ČR:**

- ❌ **Lightspeed Payments není v ČR**
- ❌ **Square není v ČR**
- Alternativa: **Manual card readers** (přes Stripe Terminal, SumUp, iZettle)

### 17.9 Omezení POS

- **Žádný nativní Ecwid POS** (vs. Shopify POS)
- **Závislost na 3rd-party** hardware
- **Pro plný POS** – nutno Lightspeed Retail subscription
- **Méně pokročilé** než Shopify POS Pro

---

## 18. ShopApp – mobilní branded aplikace

**Unique Ecwid feature** – pro Unlimited plán můžete mít **vlastní branded mobile aplikaci**.

### 18.1 Co je ShopApp

- **Native iOS + Android app**
- **Vaše značka** (logo, barvy, název)
- **Publikováno ve vašem jménu** na App Store + Google Play
- **Automatic updates** z Ecwid katalogu

### 18.2 Dostupnost

**Pouze Unlimited plán** (89 USD/měs. ročně / 105 USD/měs. měsíčně).

### 18.3 Features aplikace

**Shopping experience:**

- Product catalog
- Categories
- Product detail s images, variants
- Cart management
- Checkout (native in-app)
- Customer account
- Order history

**Engagement:**

- **Push notifications** (promo, abandoned cart, order updates)
- **Exclusive app offers**
- **Member-only deals**
- **Wishlist**

**Technické:**

- Apple Pay, Google Pay
- Biometric login (Face ID, Touch ID)
- Offline browsing (catalog cache)
- Share products
- Deep linking

### 18.4 Branding

- **Custom app icon**
- **Splash screen** s vaším logem
- **Color scheme** matching váš brand
- **Custom name** aplikace (ne "Ecwid")

### 18.5 Publishing process

- **Ecwid pomáhá s approval procesem** na Apple App Store + Google Play
- **Apple Developer Account** (99 USD/rok, merchant's cost)
- **Google Play Developer** (25 USD jednorázově)
- **Review process** Apple/Google (2–7 dní)

### 18.6 Technical setup

- **Build fee** obvykle zahrnutý v Unlimited plánu
- **Updates automatic** když měníte katalog
- **Push notifications** via Ecwid dashboard
- **Analytics** per app

### 18.7 Mobile-specific features

- **Push notification campaigns**
- **Segmented push** (by customer group, purchase history)
- **In-app promotions**
- **Geo-targeted** offers (limited)
- **Loyalty points** (přes apps)

### 18.8 Porovnání s konkurencí

| Platforma       | Branded mobile app                     |
| --------------- | -------------------------------------- |
| **Ecwid**       | ShopApp (Unlimited plán, ~89 USD/měs.) |
| **Shopify**     | Ne (Shop App je univerzální)           |
| **Wix**         | Wix Mobile App (limited branding)      |
| **Squarespace** | Ne                                     |
| **BigCommerce** | Ne (přes 3rd party apps)               |
| **WooCommerce** | Jen přes 3rd party (5 000+ USD)        |

Pro malé a střední obchody, které chtějí branded mobile app, je Ecwid Unlimited **nejekonomičtější řešení** (89 USD/měs. vs. custom dev za 10 000+ USD).

### 18.9 Omezení

- **Jen Unlimited plán**
- **Customization omezené** (nemůžete přidávat custom features)
- **Design template-based**
- **Závislé na Ecwid** (pokud zrušíte subscription, app přestane fungovat)
- **Publishing proces** může trvat

---

## 19. Marketing a propagace

### 19.1 Email marketing

**Ecwid nemá vlastní email marketing platformu** – závisí na integracích:

**Nejpopulárnější:**

- **Mailchimp** (oficiální integrace, free tier)
- **Klaviyo** (e-commerce fokus)
- **ActiveCampaign**
- **Omnisend**
- **HubSpot**
- **ConvertKit**

**Features přes integrace:**

- Customer sync
- Abandoned cart emails
- Product recommendations
- Automations
- Segmentation

### 19.2 Abandoned cart recovery (Venture+)

**Native feature:**

- **Automatic emails** (1 hr, 6 hr, 24 hr after cart abandonment)
- **Discount codes** v recovery email
- **Recovery tracking** v reports
- Basic templates, customizable

### 19.3 Customer newsletters

- Newsletter signup form na storefrontu
- Sync s Mailchimp / Klaviyo
- Double opt-in (volitelně)

### 19.4 Promotions a discounts

Viz sekce 20 pro detaily.

### 19.5 Advertising

**Přes Kliken (native Ecwid partner):**

- **Google Ads** campaigns
- **Facebook Ads** campaigns
- **Remarketing**
- **Dynamic product ads**
- **Automated campaign creation**

**Pixel setup (native):**

- **Google Analytics 4**
- **Meta Pixel** (Facebook)
- **TikTok Pixel**
- **Pinterest Tag**
- **Google Tag Manager**

### 19.6 Social media

- **Auto-share new products** na social media
- **Social sharing buttons** na product pages
- **Social proof** notifications (přes apps)

### 19.7 Content marketing

- **Blog** v Instant Site (limited)
- **Product landing pages**
- **Category pages**

### 19.8 Pop-ups

⚠️ **Nativně omezené.** Přes apps:

- **Privy**
- **OptinMonster**
- **Sumo**
- **Poptin**

### 19.9 Affiliate marketing

Přes apps:

- **Refersion**
- **Affiliatly**
- **LeadDyno**
- **Post Affiliate Pro**

### 19.10 SMS marketing

- Přes **Attentive**, **Postscript** (USA primarily)
- Limited globally

### 19.11 Influencer marketing

- Manual (outside Ecwid)
- Přes apps (limited)

### 19.12 Affiliate programs

- Ecwid má **Affiliate program** (pro merchants getting others to use Ecwid)
- Separate od merchants' vlastních affiliate programů

### 19.13 Loyalty programs

⚠️ **Nativně omezené.** Přes apps:

- **Smile.io**
- **LoyaltyLion**
- **Yotpo Loyalty**
- **Stamped Loyalty**

---

## 20. Slevy, kupony, věrnostní programy

### 20.1 Discount coupons

**Na všech plánech:**

- **Percentage off** (např. 20%)
- **Fixed amount off** (např. 10 USD)
- **Free shipping**
- **Buy X get Y** (BOGO)

**Podmínky:**

- Minimum order amount
- Specific products
- Specific categories
- Single use / multi-use
- Expiration date
- Usage limits
- First-time customer only

### 20.2 Automatic discounts

- **Apply automatically** (bez kódu)
- **Tier discounts** (volume-based)
- **Category-specific**
- **Per customer group** (Business+)

### 20.3 Wholesale pricing (Business+)

- **Customer groups** s custom prices
- **Bulk tier pricing** (buy 5+ get 10% off)
- **B2B quote support** (limited)
- **Tax-exempt** groups

### 20.4 Gift cards

⚠️ **Nativně omezené** – přes apps:

- **Gift card app**
- Custom values
- Digital delivery
- Balance tracking

### 20.5 Store credit

- Přes apps
- Issue on refunds
- Loyalty rewards

### 20.6 Loyalty points

**Jen přes apps** (Ecwid nemá vlastní):

- **Smile.io** (nejpopulárnější)
- **LoyaltyLion**
- **Yotpo Loyalty**
- Points per purchase
- Referrals
- Tier systems
- Redemption

### 20.7 Referral programs

**Přes apps:**

- Referral Rock
- Invite Referrals
- ReferralCandy

### 20.8 Wishlists

**Nativně omezené** – přes apps.

### 20.9 Product reviews (Business+)

**Native:**

- Star ratings
- Text reviews
- Moderation
- Email requests

### 20.10 Free shipping thresholds

- **Free shipping nad X USD**
- Display v checkout
- Encouragement na storefront

---

## 21. SEO a obsah

### 21.1 On-page SEO

**Na všech plánech:**

- **Meta title** per product/category/page
- **Meta description**
- **URL slugs** (customizable)
- **Alt texts** na obrázcích
- **H1-H6** heading structure
- **Schema.org markup** (Product, Breadcrumb, Review)
- **Open Graph** tags
- **Twitter Cards**

### 21.2 Technical SEO

- **SSL** zdarma
- **HTTPS enforced**
- **Mobile-responsive**
- **Sitemap.xml** auto (na Venture+)
- **robots.txt** (limited customization)
- **Canonical URLs**
- **Image optimization** (WebP, lazy loading)
- **CDN** globally

### 21.3 URL structure

- Default URL format
- Customizable slugs na Business+
- SEO-friendly URLs
- Historical URL redirects manual

### 21.4 Embed vs. Instant Site SEO

⚠️ **Důležitý rozdíl:**

**Embed widget:**

- Produkty jsou loadované via JavaScript
- **Může omezovat Google indexování**
- Hosting site SEO dominuje
- **Product pages mohou mít problém** s crawling

**Instant Site:**

- Stránky jsou server-rendered
- **Lepší pro SEO**
- Plné crawlování
- Vlastní URL structure

### 21.5 Google Shopping integrace (Venture+)

- Google Merchant Center feed
- Free listings
- Shopping Ads
- Rich results v Search

### 21.6 Schema.org structured data

Automatic pro:

- **Product schema** (name, price, availability, reviews)
- **Breadcrumb schema**
- **Organization schema**
- **Review schema** (Business+, reviews)
- **FAQ schema** (limited)

### 21.7 Blog (Instant Site)

- Basic blog capability
- SEO per post
- Categories, tags
- RSS feed
- Comments (přes Disqus custom code)

### 21.8 Search

- Native storefront search
- Auto-suggestions
- Search analytics
- Third-party enhancers (přes apps):
  - Algolia
  - Searchanise
  - Boost AI Search

### 21.9 Redirects

- Manual 301 redirects (Business+)
- URL changes handling

### 21.10 Google Search Console

- Easy verification
- Sitemap submit
- Performance data

### 21.11 Omezení SEO

- **JavaScript-heavy rendering** v embed widget (horší crawling)
- **Limited blog features** (vs. Squarespace, WordPress)
- **Méně kontroly** nad URL structure
- **Limited structured data** customization
- **Robots.txt omezená úprava**

### 21.12 AI SEO

⚠️ **Ecwid nemá nativní AI SEO tools** (na rozdíl od Wix, Squarespace, Shopify).

Přes apps nebo external:

- SEO Expert Prime
- Ahrefs, SEMrush integrace

---

## 22. Analytika a reporting

### 22.1 Native analytics

**Dashboard overview:**

- Sales (revenue, orders, AOV)
- Traffic
- Top products
- Top categories
- Customer metrics

### 22.2 Sales reports

- **Sales by date range**
- **Sales by product**
- **Sales by category**
- **Sales by customer**
- **Sales by payment method**
- **Tax reports**
- **Shipping reports**
- **Refunds & returns**

### 22.3 Customer reports

- New vs. returning
- Lifetime value
- Most frequent buyers
- Geographic distribution

### 22.4 Product reports

- Bestsellers
- Low-performing products
- Out of stock
- Product views
- Cart adds

### 22.5 Traffic reports

- Visitors
- Pageviews
- Unique visitors
- Bounce rate
- Conversion rate
- Traffic sources (direct, organic, social, referral)

### 22.6 Marketing reports

- Abandoned cart recovery
- Email campaign performance (přes Mailchimp)
- Coupon usage
- Discount impact

### 22.7 Real-time

- Live visitor count
- Active carts
- Today's sales

### 22.8 Third-party integrations

- **Google Analytics 4** (native setup)
- **Google Tag Manager**
- **Meta Pixel** (Facebook)
- **TikTok Pixel**
- **Pinterest Tag**
- **Microsoft Clarity** (session recording, zdarma)

### 22.9 Export

- **CSV export** reports
- Pro accounting / BI tools
- Scheduled reports (limited)

### 22.10 Limitations

- **Méně pokročilé** než Shopify Analytics
- **Žádné cohort analysis** nativně
- **Žádné funnel tracking**
- **Bez custom dashboards**
- **Bez BI tool** nativní integrace

---

## 23. AI v Ecwid

⚠️ **Ecwid má AI funkce nejslabší ze všech porovnávaných platforem.** Na rozdíl od Shopify (Sidekick), Wix (Astro, Harmony, Vibe), Squarespace (Design Intelligence, Blueprint, Beacon) – Ecwid má jen základní AI pokrytí.

### 23.1 AI product descriptions

- **AI-generated product descriptions** (od 2024)
- Založeno na product name a kategorii
- Basic text generation
- Editable before save

### 23.2 AI content (Instant Site)

- **AI-suggested website copy**
- Limited scope
- Basic templates

### 23.3 AI image tools

- **Background remover** (basic, přes integrace)
- Image cropping suggestions

### 23.4 AI chatbot

- Help center search s AI
- Basic recommendations

### 23.5 Přes apps (3rd party AI)

**AI features přes App Market:**

- **ChatGPT apps** pro product descriptions
- **AI image generators**
- **Recommendation engines**
- **AI search** (Searchanise AI, Boost AI)

### 23.6 Lightspeed AI (coming)

Lightspeed Commerce investuje do AI napříč ekosystémem:

- **Lightspeed Capital** (AI pro lending decisions)
- **Advanced Insights** (AI reporting)
- **Customer segmentation AI**
- Postupný roll-out do Ecwid

### 23.7 AI omezení v Ecwid

- **Žádný conversational AI assistant** (vs. Shopify Sidekick)
- **Žádná AI website builder** (vs. Wix Astro, Squarespace Blueprint)
- **Žádné AI mockups** (vs. Wix Imagen)
- **Žádný AI image generator** nativně
- **Žádná AI analytics** (vs. Squarespace Beacon)
- **Slabé AI SEO tools**

### 23.8 Pozice na trhu

Ecwid's AI je **minimální** proti konkurenci. Merchants hledající AI-first platformu by měli volit:

- **Wix** (nejpokročilejší AI suite)
- **Shopify** (Sidekick)
- **Squarespace** (Design Intelligence)

---

## 24. Developer platforma – API a Apps

Ecwid má **slušnou developer platformu**, ale menší než Shopify nebo BigCommerce.

### 24.1 REST API

**Hlavní API endpoints:**

- **Products API** (CRUD products, categories, variants)
- **Orders API** (read, update orders)
- **Customers API**
- **Inventory API**
- **Discount coupons API**
- **Subscriptions API** (Business+)
- **Store profile API**
- **Payment options API**
- **Shipping options API**

### 24.2 API authentication

- **OAuth 2.0** (pro public apps)
- **API tokens** (pro private apps)
- **Access scopes** (read/write permissions)

### 24.3 Webhooks

Events notifications:

- **Order events** (created, updated, cancelled, shipped, paid)
- **Product events** (created, updated, deleted)
- **Customer events**
- **Subscription events**
- HMAC signature pro bezpečnost

### 24.4 Storefront JavaScript API

- **In-page customization**
- Add listeners pro events
- Modify cart, checkout
- Dynamic content

### 24.5 Ecwid Apps platforma

M�žete vytvářet:

**Public Apps (v App Marketu):**

- Monetize přes subscription
- Distribuce přes Ecwid App Market
- Review proces Ecwid

**Private Apps:**

- Pro jeden konkrétní store
- Pro internal tooling
- Bez schválení

**Custom Apps:**

- Bez distribuce
- Custom integrace

### 24.6 App architecture

- **OAuth flow** pro install
- **Iframe-based** UI v Ecwid admin
- **API webhooks** pro sync
- **Static pages** v admin menu

### 24.7 Developer resources

- **developers.ecwid.com**
- API documentation
- Code samples
- Tutorials
- Community forum
- App submission guidelines

### 24.8 SDKs

- **PHP SDK**
- **Python SDK**
- **Node.js SDK**
- **Ruby SDK**
- Community-driven, mnoho unofficial SDKs

### 24.9 API rate limits

- **Default:** 1 request per second per store
- **Bursts:** allowed do určité míry
- **Higher limits** po dohodě s Ecwid

### 24.10 App Market revenue

- **Developer revenue sharing** (70% developer, 30% Ecwid)
- Monthly subscription nebo one-time fee
- In-app purchases possible

### 24.11 Storefront customization

**Přes Custom JS / CSS:**

- Inject custom code do storefront
- Override default styly
- Custom behavior
- Ne tak mocné jako Liquid (Shopify) nebo Handlebars (BigCommerce)

### 24.12 Limitace developer platformy

- **Menší komunita** než Shopify
- **Méně dokumentace** než Shopify
- **Slabší rate limits**
- **Méně SDK jazyků** oficiálně
- **Omezený template language** (na rozdíl od Liquid)
- **Bez headless story** (na rozdíl od Shopify Hydrogen, BigCommerce Catalyst)

---

## 25. Ecwid App Market

Ecwid App Market je marketplace s apps pro rozšíření funkčnosti.

### 25.1 Přehled

- **~200 aplikací**
- Menší než Shopify (8 000+), srovnatelný s Squarespace (50-80), menší než Wix (500) a BigCommerce (1 000+)
- Kategorizováno:
  - Marketing
  - Shipping & Fulfillment
  - Accounting & Finance
  - Customer Support
  - Inventory
  - Sales channels
  - Reviews & Reputation
  - POS
  - Translation

### 25.2 Dostupnost App Marketu

- **Starter (Free):** limited access
- **Venture+:** plný přístup
- **Business+:** i premium apps
- **Unlimited:** vše

### 25.3 Populární kategorie a apps

**Email marketing:**

- **Mailchimp** (oficiální)
- **Klaviyo**
- **Omnisend**
- **ActiveCampaign**

**Reviews:**

- **Yotpo**
- **Judge.me**
- **Stamped**
- **Trustpilot**

**Shipping:**

- **ShipStation**
- **Shippo**
- **Sendcloud** (EU)
- **Easyship**
- **AfterShip**

**Marketplaces:**

- **Codisto** (Amazon, eBay, Walmart, Google)
- **CedCommerce**
- **Sellbrite**

**Loyalty:**

- **Smile.io**
- **LoyaltyLion**
- **Yotpo Loyalty**

**Accounting:**

- **QuickBooks**
- **Xero**
- **FreshBooks**

**Search:**

- **Searchanise**
- **Boost AI Search**
- **Algolia**

**Print-on-demand:**

- **Printful**
- **Printify**
- **Gelato**

**Dropshipping:**

- **Syncee**
- **Spocket**
- **Modalyst**

**Live chat:**

- **Tidio**
- **LiveChat**
- **Gorgias**

**Pop-ups:**

- **Privy**
- **Poptin**
- **Sumo**

### 25.4 App pricing

- **Free** (plno základních apps)
- **Freemium** (base free, pro paid)
- **Subscription** (5–50 USD/měs. typicky)
- **One-time** (limited)

### 25.5 App install

- **One-click install**
- **OAuth flow**
- **Automatic setup**
- **Permissions review**

### 25.6 App reviews

- Ratings od merchants
- Text reviews
- Response od developers

### 25.7 Omezení

- **Mnohem menší než Shopify App Store**
- **Kvalita variabilní** (ne vždy udržované)
- **Méně alternativ** pro specifické use cases
- **Některé apps omezené pro US/EU markets**

---

## 26. Integrace s dalšími platformami

### 26.1 CMS / Website builders

**Nejlepší integrace:**

- **WordPress** (oficiální plugin, nejpopulárnější)
- **Wix** (App Market)
- **Squarespace** (embed code)
- **Joomla** (extension)
- **Drupal** (module)
- **Weebly** (embed)
- **Tilda** (embed)
- **Jimdo** (embed)
- **Google Sites** (Instant Site redirect)
- **Blogger**
- **Static HTML** weby

### 26.2 Payment gateways

70+ brán (viz sekce 11.3)

### 26.3 Shipping

Viz sekce 12.7

### 26.4 Marketing tools

- **Mailchimp** (primární)
- **Klaviyo**
- **HubSpot**
- **Google Analytics 4**
- **Google Ads**
- **Meta Ads**
- **TikTok Ads**

### 26.5 POS systems

- **Lightspeed Retail** (primary)
- **Square**
- **Clover**

### 26.6 Accounting

- **QuickBooks** (via app)
- **Xero**
- **FreshBooks**
- **Wave**

### 26.7 CRM

- **HubSpot CRM**
- **Salesforce** (přes apps)
- **Zoho CRM**

### 26.8 ERP (limited)

- **NetSuite** (limited, přes apps)
- **SAP** (custom only)

### 26.9 Zapier / Make

- **Full Zapier integrace** – 5 000+ apps connect
- **Make (dříve Integromat)** integrace
- **n8n** (open-source alternativa)

### 26.10 Chat & Support

- **Tidio**
- **LiveChat**
- **Intercom**
- **Zendesk**
- **Drift**

### 26.11 Translation

- **Weglot**
- **GTranslate**
- **LangShop**

### 26.12 Migration tools

- **Cart2Cart** (ze Shopify, WooCommerce, Magento)
- **LitExtension** (z jiných platforem do Ecwid)
- **Ecwid import** (CSV, specific platform importers)

---

## 27. Bezpečnost, hosting, infrastruktura

### 27.1 Hosting

- **Fully-managed cloud hosting**
- **AWS infrastructure**
- **CDN globally** (CloudFront)
- **Auto-scaling**
- **99,98% uptime** average

### 27.2 Performance

- **Page load:** ~2–3 sekundy průměr
- **Lighthouse score:** 70–85 (průměr)
- **Core Web Vitals:** průměrné (embed widget loading affects)
- Ne tak rychlé jako Shopify nebo Squarespace

### 27.3 SSL

- **Free SSL** (Let's Encrypt) na všech plánech
- **Automatic renewal**
- **HTTPS enforced**

### 27.4 DDoS protection

- CloudFront DDoS mitigation
- AWS Shield
- Rate limiting

### 27.5 Backups

- **Automatic backups** (Ecwid-managed)
- Data redundancy
- Recovery procedures

### 27.6 PCI compliance

- **PCI DSS Level 1 Service Provider**
- **Merchant-offloaded** (merchants don't need PCI certification)
- Stored payment information tokenized

### 27.7 3D Secure

- **3D Secure 2** (SCA compliance)
- Automatic trigger pro qualifying transactions
- EU SCA compliant

### 27.8 Data privacy

- **GDPR compliant**
- **CCPA compliant**
- **PIPEDA** (Kanada)
- **LGPD** (Brazílie)
- Cookie consent banners
- Right to erasure
- Data export

### 27.9 Certifikace

- **PCI DSS Level 1**
- **SOC 2 Type II**
- **ISO 27001** (partial)
- **GDPR compliance**

### 27.10 User security

- **2FA** (Two-Factor Authentication)
- **Staff permissions** (role-based)
- **Activity log**
- **Session management**
- **Password policies**

### 27.11 Status page

- **status.ecwid.com**
- Incident reports
- Historical uptime
- Scheduled maintenance

### 27.12 Omezení

- **Bez SSO/SAML** enterprise features
- **Bez advanced audit logs**
- **Bez custom SLAs**
- **Bez HIPAA** compliance
- **Méně certifikací** než Shopify, BigCommerce

---

## 28. Podpora a vzdělávání

### 28.1 Support tiers

| Plán               | Support                                         |
| ------------------ | ----------------------------------------------- |
| **Starter (Free)** | Help Center + LiveChat 30 dní                   |
| **Venture**        | Email + LiveChat                                |
| **Business**       | Email + LiveChat + Phone support                |
| **Unlimited**      | Email + LiveChat + Phone + **Priority support** |

### 28.2 Support jazyky

**Zákaznická podpora v 7 jazycích:**

- **English**
- **German (Deutsch)**
- **Dutch (Nederlands)**
- **Italian (Italiano)**
- **French (Français)**
- **Russian (Русский)**
- **Spanish (Español)**

⚠️ **Čeština není mezi podporovanými jazyky podpory.**

### 28.3 Help Center

- **support.ecwid.com**
- Tisíce článků
- Step-by-step guides
- Video tutorials
- Searchable

### 28.4 Ecwid Academy

- **Free courses** online
- Tutorials pro začátečníky
- Advanced topics
- Self-paced learning
- Certifications (limited)

### 28.5 Ecwid Blog

- Merchant tips
- Marketing advice
- Success stories
- Product updates

### 28.6 Podcast

- Ecwid podcast
- Interviews s merchants
- Industry insights

### 28.7 Community

- Community forum
- Facebook groups
- Merchant meetups (limited)

### 28.8 Custom development hours

Roční plány zahrnují:

- **Starter:** 0 h
- **Venture:** 0 h
- **Business:** 2 h
- **Unlimited:** 12 h

Pro custom requirements jako:

- Third-party integrations
- Design customization
- Custom functionality
- Migration assistance

### 28.9 Partner program

- **Ecwid Experts** directory
- Certified developers/agencies
- Můžete najmout experts pro custom work
- Limited partner ecosystem vs. Shopify Partners

### 28.10 Changelog

- **Ecwid Igniter Series** (quarterly updates)
- Release notes
- New features announcements

### 28.11 Omezení podpory

- **Bez 24/7 podpory** (standard business hours)
- **Žádný dedicated account manager** (ani na Unlimited)
- **Malá česká komunita**
- **Méně oficiálních partner agentur** v ČR
- **Priority support je vágně definovaný** – ne konkrétní SLA

---

## 29. Známá omezení a nevýhody

### 29.1 Design omezení

- **Jen ~15 Instant Site šablon** (vs. Wix 2 500+, Squarespace 200+)
- **Ecwid widget design je omezený** barvami a fonty
- **Málo pre-built sekcí** v Instant Site
- **Slabší mobile customization**
- **Méně theme vendors** než Shopify
- **Embed widget má vizuální konzistenci závislou na hosting site**

### 29.2 E-commerce funkční omezení

- **Product variants až od Business** (výrazné omezení Free/Venture)
- **Amazon/eBay až od Business**
- **Walmart jen na Unlimited**
- **Subscriptions jen od Business**
- **Reviews nativně jen od Business**
- **Multilingual content jen od Business**
- **Multi-location inventory** jen přes Lightspeed POS
- **Wholesale pricing jen od Business**

### 29.3 SEO omezení

- **Embed widget SEO slabší** než nativní stránky
- **JavaScript rendering** může snižovat indexaci
- **URL customization omezená**
- **Robots.txt omezená úprava**
- **Schema.org markup limited customization**

### 29.4 POS omezení

- **Lightspeed Payments není v ČR**
- **Square není v ČR**
- **Závislost na 3rd-party hardware**
- **Full POS vyžaduje Lightspeed Retail subscription**

### 29.5 Marketing omezení

- **Žádný nativní email marketing** (závisí na Mailchimp, Klaviyo)
- **Žádný nativní loyalty program**
- **Omezené marketing automation**
- **Slabé pop-ups nativně**
- **Bez affiliate program native**

### 29.6 Analytics omezení

- **Méně pokročilé** než Shopify Analytics
- **Žádné cohort analysis**
- **Žádné funnel tracking**
- **Bez custom dashboards**
- **Základní reports**

### 29.7 AI omezení

- **Nejslabší AI ze všech platforem**
- **Žádný conversational assistant** (vs. Shopify Sidekick)
- **Žádný AI website builder** (vs. Wix, Squarespace)
- **Omezené AI content tools**

### 29.8 Developer platforma

- **Menší app ecosystem** (~200 apps)
- **Menší komunita developerů**
- **Méně dokumentace**
- **Bez headless story**
- **Slabší rate limits**

### 29.9 Multi-currency/multi-language

- **Nenativní multi-currency checkout**
- **Multilingual content jen od Business**
- **Méně pokročilé mezinárodní prodeje** (vs. Shopify Markets)

### 29.10 Omezení specifická pro ČR

⚠️ **Pro český trh je Ecwid velmi slabá volba** – srovnatelné se Squarespace a BigCommerce:

**Chybí integrace:**

- ❌ **Zásilkovna** (přes Sendcloud jako workaround)
- ❌ **Česká pošta, PPL, DPD, GLS, DHL** (přes Sendcloud)
- ❌ **ComGate, GoPay, ThePay** (přes Stripe jen)
- ❌ **Heureka, Zboží.cz** nativní feed
- ❌ **EET** (dnes nepovinné)
- ❌ **ARES** validace
- ❌ **Pohoda, Money, FlexiBee** (jen přes Zapier/Make)
- ❌ **Lightspeed Payments v ČR**
- ❌ **Square v ČR**

**Ostatní:**

- **Čeština v UI jen částečně** (ne 100%)
- **Podpora v češtině chybí** (jen EN, DE, NL, IT, FR, RU, ES)
- **Mizivá česká komunita** merchants
- **Žádné české Partner Agencies** oficiálně
- **Žádné české Instant Site šablony**
- **Dobírka (COD)** jen jako manual offline method

### 29.11 Lock-in

- **Export omezený** (CSV products, customers, orders)
- **Design nelze exportovat**
- **Migrace na jinou platformu** – product data OK, ale design a customizations nepřenosné

### 29.12 Performance

- **Page load průměrný** (2–3 s)
- **Embed widget** zpomalování na pomalejších hosting sites
- **JS rendering** časy
- **Ne tak rychlé** jako Shopify, Squarespace, BigCommerce

### 29.13 Škálování

- **Ecwid Unlimited plán omezený** pro velké obchody (10 000+ produktů)
- **Admin interface zpomaluje** při velkých katalozích
- **Enterprise features chybí** (SSO, advanced audit, custom SLA)

---

## Závěr

Ecwid (Ecwid by Lightspeed) v roce 2026 zůstává **unikátní platformou s specifickou nikou**: embed e-commerce widget pro existující weby a malé podnikatele s minimálním rozpočtem.

### Silné stránky

- **Free plán forever** (10 produktů) – **nejštědřejší free tier** ze všech hlavních platforem
- **0% transaction fees** na všech plánech
- **Unikátní embed widget** – přidejte obchod k libovolnému webu
- **WordPress, Wix, Squarespace integrace** (oficiální pluginy)
- **1 000 000+ obchodů** ve 175 zemích
- **51+ jazyků** storefrontu
- **70+ platebních poskytovatelů**
- **Lightspeed POS integrace** (pokud máte Retail)
- **ShopApp** – branded mobile app na Unlimited plánu (unikát pro tuto cenovku)
- **Low barrier of entry** – ideální pro začátečníky
- **Multi-channel selling** z jednoho dashboardu

### Slabé stránky

- **Design velmi omezený** (15 Instant Site šablon)
- **Funkčně slabší** než Shopify, Wix, BigCommerce
- **Product variants, subscriptions, reviews jen od Business**
- **Nenativní multi-currency checkout**
- **Multilingual content jen od Business**
- **Menší app ecosystem** (~200 apps)
- **AI tools nejslabší** ze všech platforem
- **Embed widget SEO** horší než native pages
- **Amazon/eBay/Walmart** za paywallem
- **Performance průměrný**
- **Omezená podpora v češtině** (jen částečné UI, žádná CS podpora)

### Pro koho se Ecwid hodí

✅ **Ideální pro:**

- **Začátečníci s omezeným rozpočtem** (Free plán)
- **Blogers, umělci, kreativci** s existujícím WordPress / Squarespace / Wix webem, kteří chtějí přidat prodej produktů
- **Malé lokální obchody** s jednoduchým katalogem
- **Solopreneurs, hobby projekty, side hustles**
- **Restaurace a kavárny** (se základním menu ordering)
- **Neziskovky** (6 měsíců Venture zdarma)
- **Lightspeed Retail POS merchants** (Ecwid Business je zdarma v retailu)
- **Multi-channel selling SME** (social, marketplaces z jednoho místa)
- **Rychlý launch bez webového vývojáře**

### Pro koho méně

❌ **Méně vhodné pro:**

- **Design-first brands** (Wix, Squarespace krásnější)
- **Mid-market obchody** ($500K+ GMV) – funkčně nedostatečné
- **Enterprise e-commerce** – chybí enterprise features
- **B2B s komplexními pravidly** (BigCommerce lepší)
- **Rychlý scale** – admin zpomaluje při 10K+ produktech
- **AI-first obchody** (Wix, Shopify, Squarespace lepší)
- **Headless commerce** (Shopify, BigCommerce vhodnější)
- **České obchody** s potřebou lokalizace (Shoptet, Upgates lepší)

### Shrnutí v kontextu ČR

V České republice má Ecwid **velmi malý podíl** – podobně jako Squarespace a BigCommerce. Důvody:

- **Chybí lokalizace** (jazyk, platby, dopravci, účetnictví)
- **Velmi slabá česká komunita** merchants i partner agencies
- **Žádná česká podpora**
- **Konkurence je výrazně lokalizovanější:** Shoptet (~45-50% ČR podíl), Upgates (~6-8%), WooCommerce (15-18%)

**Pro český merchant má Ecwid smysl ve velmi specifickém use case:**

- Máte **existující český web na WordPressu** a chcete přidat jen jednoduchý eshop (5–50 produktů)
- Hledáte **nejlevnější cestu** k online prodeji (Free plán)
- Hlavní zákaznická základna je **mimo ČR** (USA, EU)
- Potřebujete **mezinárodní multi-channel selling** (Amazon, eBay + US trh)

Pro plnohodnotný český e-shop s Zásilkovnou, GoPay/ComGate, dobírkou, Heureka feedem, Pohodou napojením – **Ecwid to prostě neumí nativně**.

---

### Srovnání všech 5 platforem (Shopify, Wix, Squarespace, BigCommerce, Ecwid)

| Kritérium               | Shopify             | Wix             | Squarespace    | BigCommerce      | **Ecwid**                                   |
| ----------------------- | ------------------- | --------------- | -------------- | ---------------- | ------------------------------------------- |
| **Cena (entry)**        | 29 USD              | 17 USD          | 16 USD         | 29 USD           | **0 USD (Free forever)**                    |
| **Free plán**           | ❌ (jen trial)      | ✅ (limit. web) | ❌ (jen trial) | ❌ (jen trial)   | **✅ (10 produktů)**                        |
| **Design freedom**      | ⭐⭐⭐              | ⭐⭐⭐⭐⭐      | ⭐⭐⭐⭐       | ⭐⭐             | **⭐**                                      |
| **Templates**           | 200+                | 2 500+          | 200+           | 100+             | **15**                                      |
| **E-commerce depth**    | ⭐⭐⭐⭐⭐          | ⭐⭐⭐          | ⭐⭐⭐         | ⭐⭐⭐⭐⭐       | **⭐⭐**                                    |
| **B2B**                 | ⭐⭐⭐⭐            | ⭐⭐            | ⭐             | ⭐⭐⭐⭐⭐       | **⭐⭐**                                    |
| **App ecosystem**       | ⭐⭐⭐⭐⭐ (8 000+) | ⭐⭐⭐ (500)    | ⭐⭐ (50-80)   | ⭐⭐⭐ (~1 000)  | **⭐⭐ (~200)**                             |
| **Transaction fees**    | 2% Basic            | 0%              | 3% Basic       | 0%               | **0% všechny**                              |
| **Embed widget**        | ⭐ (Buy Button)     | ❌              | ❌             | ⭐⭐ (limited)   | **⭐⭐⭐⭐⭐ (core feature)**               |
| **Multi-currency**      | ⭐⭐⭐⭐⭐          | ⭐⭐⭐⭐        | ⭐             | ⭐⭐⭐⭐         | **⭐⭐**                                    |
| **Multi-language**      | ⭐⭐⭐⭐⭐          | ⭐⭐⭐⭐        | ⭐⭐           | ⭐⭐⭐           | **⭐⭐⭐ (51 UI, content jen Business+)**   |
| **Multi-storefront**    | ⭐⭐                | ⭐⭐            | ❌             | ⭐⭐⭐⭐⭐       | **❌**                                      |
| **Headless**            | ⭐⭐⭐⭐⭐          | ⭐⭐⭐⭐        | ⭐             | ⭐⭐⭐⭐⭐       | **⭐**                                      |
| **AI**                  | ⭐⭐⭐⭐            | ⭐⭐⭐⭐⭐      | ⭐⭐⭐⭐       | ⭐⭐⭐           | **⭐⭐**                                    |
| **POS**                 | ⭐⭐⭐⭐⭐ (global) | ⭐⭐⭐ (USA/CA) | ⭐⭐ (USA)     | ⭐⭐⭐ (Square)  | **⭐⭐⭐⭐ (Lightspeed + Square + Clover)** |
| **Digital products**    | ⭐⭐⭐              | ⭐⭐⭐⭐        | ⭐⭐⭐⭐⭐     | ⭐⭐⭐           | **⭐⭐⭐ (Venture+)**                       |
| **Booking / Services**  | ⭐⭐                | ⭐⭐⭐⭐        | ⭐⭐⭐⭐⭐     | ⭐⭐             | **⭐⭐**                                    |
| **Marketplaces**        | ⭐⭐⭐⭐            | ⭐⭐⭐          | ⭐⭐           | ⭐⭐⭐⭐⭐       | **⭐⭐⭐ (Business+)**                      |
| **Branded mobile app**  | ❌                  | ⭐⭐            | ❌             | ⭐⭐             | **⭐⭐⭐⭐⭐ (ShopApp na Unlimited)**       |
| **Ease of use**         | ⭐⭐⭐⭐            | ⭐⭐⭐⭐        | ⭐⭐⭐⭐⭐     | ⭐⭐⭐           | **⭐⭐⭐⭐⭐**                              |
| **ČR lokalizace**       | ⭐⭐⭐              | ⭐⭐⭐          | ⭐⭐           | ⭐               | **⭐⭐ (UI jen)**                           |
| **Overall positioning** | #1 e-commerce       | All-in-one      | Design-first   | B2B / Mid-market | **Embed widget / SME budget**               |

---

### Kdy zvolit Ecwid nad jinými platformami?

**Ecwid vs. Shopify:**

- **Zvolte Ecwid** pokud: chcete zachovat existující web (WordPress, Wix), máte omezený rozpočet, prodáváte < 100 produktů, startujete z free
- **Zvolte Shopify** pokud: chcete dedicated e-shop, potřebujete pokročilé funkce, škálujete rychle, potřebujete lepší app ecosystem

**Ecwid vs. Wix:**

- **Zvolte Ecwid** pokud: váš web je jinde (ne na Wix), chcete multi-channel selling z jednoho dashboardu
- **Zvolte Wix** pokud: stavíte web + e-shop od nuly, chcete krásný design, potřebujete AI-first nástroje

**Ecwid vs. Squarespace:**

- **Zvolte Ecwid** pokud: chcete embed do WordPressu, potřebujete Amazon/eBay/POS/branded app
- **Zvolte Squarespace** pokud: chcete design-first, digital products/courses, portfolio, booking (Acuity)

**Ecwid vs. BigCommerce:**

- **Zvolte Ecwid** pokud: jste small business, chcete free plán, embed do existujícího webu
- **Zvolte BigCommerce** pokud: jste mid-market B2B, chcete multi-storefront, headless (Catalyst), pokročilé e-commerce

**Ecwid vs. Shoptet (pro ČR):**

- **Zvolte Shoptet** pokud: primárně cílíte na český trh (Zásilkovna, GoPay, Heureka, dobírka, Pohoda – vše nativně)
- **Zvolte Ecwid** pokud: máte mezinárodní ambice (USA, EU), potřebujete embed do existujícího webu, Lightspeed POS

### Závěrečné doporučení

Ecwid je **velmi specifická platforma s úzkou nikou**, kde je **nejlepší volbou ze všech**:

1. **Pro začátečníky s 0 rozpočtem** (Free plán = zdarma skutečně forever)
2. **Pro embed do existujících webů** (WordPress, Wix, Squarespace integrace)
3. **Pro merchants s Lightspeed Retail POS** (Ecwid Business zdarma součást subscription)
4. **Pro multi-channel selling na malé škále** (Amazon, eBay, Instagram, Facebook, TikTok z jednoho dashboardu na Business plánu)
5. **Pro branded mobile app za malý rozpočet** (ShopApp na Unlimited plánu za 89 USD/měs. je výrazně levnější než custom dev za 10 000+ USD)

Pro klasický český e-shop, plnohodnotné standalone obchody, design-first brands, nebo velké B2B operace – **existují lepší platformy**.

---

_Dokument sestaven na základě oficiální dokumentace Ecwid (support.ecwid.com, developers.ecwid.com, ecwid.com), Lightspeed Commerce (lightspeedhq.com), Ecwid Igniter release notes, nezávislých analýz (G2, Capterra, TrustRadius, Tooltester, Softwaresuggest, LitExtension, ShopWired, Shift4Shop, TopBubbleIndex, Style Factory Productions) a Ecwid pricing changes po 2. březnu 2026 – duben 2026._
