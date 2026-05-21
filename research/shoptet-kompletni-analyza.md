# Shoptet – Kompletní hloubková analýza všech funkcí, modulů a featur

> **Stav:** duben 2026 (zahrnuty tarify platné od 1. 9. 2025, Shoptet mobilní aplikace, Marketplace Napojení na Allegro, LLM feed pro OpenAI, belgická akvizice 2025)
> **Rozsah:** celá platforma Shoptet – Free, Basic, Business, Profi, Enterprise, Shoptet Premium, Shoptet Pay, Shoptet Balíky, Shoptet Kampaně, Návrhář šablon, doplňky
> **Zdroje:** oficiální Shoptet dokumentace (shoptet.cz, podpora.shoptet.cz, blog.shoptet.cz, doplnky.shoptet.cz), nezávislé recenze, Shoptet produktové novinky 2025–2026

---

## Obsah

1. [Co je Shoptet a firemní kontext](#1-co-je-shoptet-a-firemní-kontext)
2. [Postavení Shoptetu v ČR a SR](#2-postavení-shoptetu-v-čr-a-sr)
3. [Tarify a cenové plány](#3-tarify-a-cenové-plány)
4. [Administrace a ovládání](#4-administrace-a-ovládání)
5. [Šablony a design](#5-šablony-a-design)
6. [Návrhář šablon – vizuální editor](#6-návrhář-šablon--vizuální-editor)
7. [Produkty a katalog](#7-produkty-a-katalog)
8. [Skladové hospodářství](#8-skladové-hospodářství)
9. [Objednávky a fulfillment](#9-objednávky-a-fulfillment)
10. [Zákazníci a věrnostní funkce](#10-zákazníci-a-věrnostní-funkce)
11. [Shoptet Pay a platební brány](#11-shoptet-pay-a-platební-brány)
12. [Shoptet Balíky a doprava](#12-shoptet-balíky-a-doprava)
13. [Srovnávače zboží a XML feedy](#13-srovnávače-zboží-a-xml-feedy)
14. [Účetnictví a fakturace](#14-účetnictví-a-fakturace)
15. [Daně a legislativa (ČR)](#15-daně-a-legislativa-čr)
16. [Mezinárodní prodej](#16-mezinárodní-prodej)
17. [Marketing – Shoptet Kampaně](#17-marketing--shoptet-kampaně)
18. [Slevy, kupony, věrnostní systém](#18-slevy-kupony-věrnostní-systém)
19. [SEO a obsah](#19-seo-a-obsah)
20. [Statistiky a reporting](#20-statistiky-a-reporting)
21. [AI v Shoptetu](#21-ai-v-shoptetu)
22. [Shoptet mobilní aplikace](#22-shoptet-mobilní-aplikace)
23. [Marketplace Napojení – Allegro](#23-marketplace-napojení--allegro)
24. [Shoptet Doplňky – ekosystém rozšíření](#24-shoptet-doplňky--ekosystém-rozšíření)
25. [API a developerská platforma](#25-api-a-developerská-platforma)
26. [Shoptet Premium – řešení na míru](#26-shoptet-premium--řešení-na-míru)
27. [Bezpečnost a infrastruktura](#27-bezpečnost-a-infrastruktura)
28. [Podpora a vzdělávání](#28-podpora-a-vzdělávání)
29. [Známá omezení a nevýhody](#29-známá-omezení-a-nevýhody)

---

## 1. Co je Shoptet a firemní kontext

Shoptet je **český cloudový (SaaS) e-shopový systém**, navržený primárně pro český a slovenský trh. Jde o největší e-commerce platformu v ČR s dominantním tržním podílem.

**Zakladatelé:** Miroslav Uďan a tým (2008–2009)

**Klíčová čísla (2026):**

- **~30 000 aktivních e-shopů** na platformě
- **24–28 % podíl** na českém e-commerce trhu (největší v ČR)
- Tržby 2025: cca **900 milionů Kč** (blíží se k miliardě)
- Zaměstnanci: ~250
- Hlavní sídlo: Praha
- Nová strategie 2026: **zaměření na AI a expanze do Evropy**

**Historie a změny vlastnictví:**

- **2008–2009:** Založení (Miroslav Uďan)
- **2019:** Investice Ondřeje Tomka
- **2021:** Miroslav Uďan odchází z pozice CEO
- **2025 (září):** **Shoptet mění vlastníka – akvize belgickou firmou** (Prosus / další strategický investor)
- **2026:** Nový CEO, strategické zaměření na AI a evropskou expanzi

**Pozicování:**

- **#1 pro český a slovenský trh**
- **Lokalizace first** – každá funkce navržena pro CZ/SK legislativu, dopravce, brány, srovnávače
- Cílí na **malé, střední i větší** e-shopy v ČR/SR
- Pro enterprise obchody: **Shoptet Premium** (řešení na míru)

**Silné stránky:**

- **Unikátní lokalizace pro český/slovenský trh**
- **Nativní integrace na Zásilkovnu, ČP, PPL, DPD, GLS, DHL, Balíkobot**
- **Nativní integrace na GoPay, ComGate, ThePay, PayPal + Shoptet Pay**
- **Heureka, Zboží.cz, Google Nákupy, Glami, Srovnáme** – XML feedy v ceně
- **Pohoda, Money S3, FlexiBee, ABRA** – napojení na české účetní systémy
- **EET historicky podporované** (dnes nepovinné)
- **Česká a slovenská zákaznická podpora**
- **Česká komunita**, tisíce partnerských agentur
- **Shoptet Pay** – vlastní platební brána za 0 Kč měsíčně
- **Shoptet Balíky** – integrovaný logistický nástroj
- **Shoptet Kampaně** – Google Ads kampaně z administrace
- **Marketplace Napojení** – Allegro od 2026
- **Mobilní aplikace** pro správu e-shopu (Q2 2025)

**Slabé stránky:**

- **Horší pro mezinárodní expanzi** mimo CZ/SK/střední Evropu
- **Menší flexibility designu** než Shopify, Wix
- **Šablony méně moderní** než globální konkurence
- **Slabší B2B funkce** než BigCommerce, Shopify Plus
- **Žádné headless** (kromě Shoptet Premium)
- **Méně AI funkcí** než Wix, Squarespace, Shopify
- **Povinné doplňky** pro pokročilejší funkce (dražší v praxi)

---

## 2. Postavení Shoptetu v ČR a SR

### 2.1 Tržní podíl ČR

- **Největší platforma v ČR** – cca 25–28 % všech českých e-shopů
- Bez konkurence v segmentu SaaS pro malé/střední obchody
- Hlavní konkurenti v ČR: **Upgates, Eshop-rychle, WooCommerce, Shopify**

### 2.2 Proč Shoptet dominuje v ČR

**Unikátní lokalizace:**

- Všechny české dopravce nativně (na rozdíl od Shopify/Wix/Squarespace)
- Všechny české platební brány nativně
- Heureka, Zboží.cz, Glami feedy v základu
- České účetní systémy napojení
- Čeština/slovenština v administraci 100%
- Česká zákaznická podpora
- České faktury, DPH, legislativa

**Lokální komunita:**

- Stovky českých agentur/freelancerů specializovaných na Shoptet
- Facebook skupiny (Shoptet Poradna – 20 000+ členů)
- České konference, webináře, školení
- Shoptet Expo – největší e-commerce konference v ČR

**Cenová dostupnost:**

- Free tarif
- Levnější než Shopify pro střední obchody
- Platíte v Kč, bez currency rizika

### 2.3 Mezinárodní dostupnost

**Primární trhy:**

- **Česká republika** (hlavní)
- **Slovensko** (silné zastoupení)
- **Maďarsko** (rostoucí)
- **Polsko** (rostoucí)

**Podporované jazyky administrace:**

- **Čeština** ✅ (primární)
- **Slovenština** ✅ (primární)
- **Angličtina**
- **Němčina**
- **Maďarština**
- **Polština**
- **Rumunština**
- **Bulharština** (nově 2026)

### 2.4 Cizojazyčná verze

Shoptet podporuje **multijazyčnost pro storefront** – můžete mít e-shop v češtině, slovenštině, angličtině, němčině, polštině, maďarštině, a dalších jazycích současně.

### 2.5 Nový trend – evropská expanze (2026)

S novým vlastníkem a CEO se Shoptet zaměřuje na:

- **Evropskou expanzi** (další země střední a východní Evropy)
- **AI-first features**
- **Marketplace integrace** (Allegro, časem další)
- **Přeshraniční prodej** (multicurrency, multilanguage)

---

## 3. Tarify a cenové plány

⚠️ **Aktualizace cen od 1. září 2025** – Shoptet upravil tarify, přidal 2, 4, 8, nebo 12 nových rozšiřujících funkcí zdarma (podle tarifu) a mírně zdražil.

Ceny jsou uvedeny **bez 21% DPH**.

### 3.1 Shoptet Free – 0 Kč/měs.

**Navždy zdarma**, ideální pro úplné začátečníky.

- **Max. 10 produktů**
- **27 rozšiřujících funkcí v ceně**
- **Shoptet Pay** v ceně
- **Shoptet Balíky** napojení
- Nákup přes Heureku, Zboží.cz, Google Nákupy, Glami, Seznam
- Zásilkovna nativní
- Základní SEO
- Mobilní responzivita
- HTTPS/SSL zdarma
- Základní varianty produktů
- Recyklační příspěvky
- Kampaně (Google Ads přes Shoptet Kampaně)
- XML exporty
- Zálohy
- Česká podpora (e-mail)

**Omezení:**

- Max 10 produktů
- Základní design
- Bez pokročilých funkcí (A/B testy, pokročilé SEO, B2B)

**Pro koho:** úplní začátečníci, hobby projekty, test platformy

### 3.2 Basic – cca 490 Kč/měs. (roční) / 549 Kč/měs. (měsíční)

**Startovní tarif pro reálné podnikání.**

- **Až 100 produktů**
- **48 rozšiřujících funkcí v ceně** (původně 36)

**Nové od 2025 v Basic (přidáno):**

- **Podobné produkty**
- **Sady produktů**
- **Top nejprodávanější v kategorii**
- **Mailchimp** integrace
- **Opuštěný košík**
- **Dárky k objednávce a produktům**
- **Filtry podle výrobců a značek**
- **Ukazatel Top 10 nejprodávanějších**

**Další features Basic:**

- Varianty produktů
- Vlastní doména
- 3 e-mailové schránky
- Neomezení administrátoři
- Základní SEO
- Blog
- Google Analytics 4
- Meta Pixel
- Hodnocení produktů

**Pro koho:** Malé e-shopy, začínající podnikatelé, prodej do 100 produktů

### 3.3 Business – cca 990 Kč/měs. (roční) / 1 099 Kč/měs. (měsíční)

**Nejčastěji volený tarif pro SME e-shopy.**

- **Až 1 000 produktů**
- **56 rozšiřujících funkcí v ceně** (původně 48)

**Nové v Business (2025):**

- **Provizní systém** (affiliate program)
- **Min&Max objednatelné množství**
- **Slovník pojmů**

**Další features Business:**

- **Skladové hospodářství** (stavy zásob, rezervace, dostupnost)
- **Množstevní slevy**
- **SMS upozornění**
- **Související produkty**
- **Hodnocení produktů a obchodu**
- **Parametrické filtrování**
- **B2B funkce** (cenové hladiny)
- **Export objednávek do účetních systémů**
- **Google Tag Manager**
- **Přizpůsobené šablony**
- 5 e-mailových schránek

**Pro koho:** Rozvíjející se e-shopy, 100–1 000 produktů, pokročilejší marketing

### 3.4 Profi – cca 1 999 Kč/měs. (roční) / 2 199 Kč/měs. (měsíční)

**Nejoblíbenější řešení pro středně velké obchody.**

- **Až 5 000 produktů**
- **59 rozšiřujících funkcí v ceně**

**Nové v Profi (2025):**

- Rozšířené slevové mechaniky
- Další nástroje pro optimalizaci

**Další features Profi:**

- Pokročilé statistiky
- A/B testy
- Vylepšená SEO analýza
- Multi-jazyčná verze storefrontu
- Vlastní jazykové mutace
- Loyalty program nativně
- Email automation (nad rámec Mailchimp)
- **Automatický překlad produktů**
- 10 e-mailových schránek
- **Vícedoménová struktura**

**Pro koho:** Střední obchody, multi-language, B2B + B2C, automatizace

### 3.5 Enterprise – cca 3 749 Kč/měs. (roční) / 4 199 Kč/měs. (měsíční)

**Největší standardní tarif.**

- **Až 50 000 produktů**
- **69 rozšiřujících funkcí v ceně** (původně 66, přidána 3)

**Nové v Enterprise (2025):**

- **Modul pro synchronizaci skladů** (mezi hlavním a napojenými sklady)
- **Pokročilé SEO**
- **Pokročilé B2B**

**Další features Enterprise:**

- Multiplejeh skladů
- Pokročilé B2B (customer groups, price lists)
- Dedicated account management (limited)
- Priority support
- Multi-currency storefront
- Pokročilé reporting
- 15 e-mailových schránek
- **Pokročilé SEO** (canonical, hreflang, rich snippets customization)

**Pro koho:** Větší obchody, 5 000+ produktů, B2B/B2C hybrid, international

### 3.6 Shoptet Premium – individuální cena (řešení na míru)

**Pro e-shopy nad 50 000 produktů nebo s custom requirements.**

Viz sekce 26 pro detaily.

- Individuální ceny (typicky desítky tisíc Kč/měs.)
- Dedicated account manager
- Custom development
- Open REST API
- Headless commerce možné
- Multi-storefront, multi-language, multi-currency
- Škálování bez omezení

**Pro koho:** Velké e-shopy, enterprise, multi-brand, přeshraniční

### 3.7 Srovnávací tabulka tarifů

| Tarif                     | Free    | Basic   | Business | Profi         | Enterprise | Premium      |
| ------------------------- | ------- | ------- | -------- | ------------- | ---------- | ------------ |
| Cena (roční, Kč bez DPH)  | 0       | ~490    | ~990     | ~1 999        | ~3 749     | individuálně |
| Max. produktů             | 10      | 100     | 1 000    | 5 000         | 50 000     | ∞            |
| Rozšiřující funkce v ceně | 27      | 48      | 56       | 59            | 69         | vše + custom |
| Skladové hospodářství     | ❌      | ❌      | ✅       | ✅            | ✅         | ✅           |
| B2B funkce                | ❌      | ❌      | základní | pokročilé     | pokročilé  | plné         |
| Multi-language            | ❌      | ❌      | ❌       | ✅            | ✅         | ✅           |
| Multi-currency            | ❌      | ❌      | ❌       | ❌            | ✅         | ✅           |
| Synchronizace skladů      | ❌      | ❌      | ❌       | ❌            | ✅         | ✅           |
| E-mailové schránky        | 1       | 3       | 5        | 10            | 15         | ∞            |
| Administrátoři            | ∞       | ∞       | ∞        | ∞             | ∞          | ∞            |
| Shoptet Pay               | ✅      | ✅      | ✅       | ✅            | ✅         | ✅           |
| Česká podpora             | email   | email   | email    | email+telefon | priority   | dedicated    |
| API access                | limited | limited | ✅       | ✅            | ✅         | ✅           |

### 3.8 Slevy za delší platbu

- **Měsíční platba:** bez slevy (výchozí)
- **Roční platba:** **sleva 10%**
- **2letá platba:** **sleva 20%**

### 3.9 Skryté náklady

**Co může výrazně zvýšit celkovou cenu:**

- **Placené doplňky (plugins):** 49 – 2 000+ Kč/měs. za jeden (viz sekce 24)
- **Platební brány:** GoPay, ComGate, ThePay mají vlastní transakční poplatky (0,95%–2,5%+)
- **Shoptet Pay:** 0 Kč měsíčně, ale per-transaction fee (~1,1–1,8%)
- **Premium šablony:** 3 000–15 000 Kč jednorázově
- **Individuální úpravy:** 500–3 000 Kč/h (agenturní práce)
- **Expresní podpora:** extra poplatek u některých tarifů
- **Doplňky od třetích stran:** různé ceny
- **Shoptet Balíky:** dopravci mají vlastní sazby (ale bez měsíčních poplatků)

### 3.10 Doporučení volby tarifu

- **Začátečník s 5–10 produkty:** Free
- **Start-up e-shop:** Basic
- **Rostoucí e-shop 100–1 000 produktů:** Business
- **Střední e-shop 1 000–5 000 produktů + B2B:** Profi
- **Velký e-shop s pokročilými požadavky:** Enterprise
- **Enterprise / custom:** Shoptet Premium

### 3.11 Možnost testovat

- **30denní trial** – plný přístup ke všem funkcím
- Bez nutnosti zadat kartu
- Po skončení automatický převod na Free tarif (pokud nedojde k upgradu)

MARKDOWN_EOF
wc -l /home/claude/shoptet/shoptet-kompletni-analyza.md

---

## 4. Administrace a ovládání

Shoptet admin je webové rozhraní optimalizované pro česky mluvící uživatele.

### 4.1 Přihlášení a URL

- URL: `admin.shoptet.cz` (nebo vlastní doména/admin)
- Přihlášení: e-mail + heslo
- 2FA (dvoufaktorové ověření)
- Role-based access (neomezení administrátoři na všech tarifech)

### 4.2 Dashboard (úvodní obrazovka)

- **Přehled denních prodejů**
- **Nové objednávky**
- **Návštěvnost**
- **Nejprodávanější produkty**
- **Rychlé akce**
- **Notifikace a upozornění**
- **Checklist pro nové obchody**
- **Oznámení od Shoptetu**

### 4.3 Hlavní menu

**Standardní struktura administrace:**

- **Objednávky** – přehled, detail, export, stavy, dobropisy
- **Zboží** – produkty, kategorie, varianty, parametry
- **Sklady** – skladové hospodářství, stavy, pohyby
- **Zákazníci** – databáze, skupiny, cenové hladiny
- **Marketing** – slevy, kupony, newsletter, opuštěný košík, kampaně
- **Statistiky** – prodeje, návštěvnost, konverze, reporty
- **Obsah** – články, stránky, články, menu
- **Vzhled** – šablony, Návrhář, editor HTML
- **Nastavení** – e-shop, doprava, platby, daně, účty, propojení
- **Doplňky** – přehled nainstalovaných + marketplace
- **Propojení** – API, webhooks, integrace

### 4.4 Objednávky

**Přehled:**

- Tabulka objednávek s filtry (datum, stav, zákazník, platba)
- Barevné značení stavů
- Rychlé akce (stav, platba, expedice)

**Detail objednávky:**

- Zákaznická data
- Produkty (cena, varianta, množství)
- Doprava a platba
- Historie (audit log)
- Zasílání e-mailů
- Refundace / dobropisy
- **Generování faktur automaticky**
- Poznámky (interní, pro zákazníka)

### 4.5 Zboží (produkty)

- CRUD produktů
- Bulk úpravy
- Import/export CSV, XML
- Kategorie (strom)
- Parametry (specifikace)
- Varianty (kombinace)
- Související/podobné produkty
- Doplňkové produkty
- Sady / balíčky
- Dostupnost a sklad

### 4.6 Zákazníci

- Databáze zákazníků
- **Cenové hladiny** (B2B, VIP, Wholesale)
- Skupiny zákazníků
- Slevy per zákazník
- Kredit / store credit
- Historie objednávek
- GDPR nástroje

### 4.7 Nastavení

Kompletní sekce pro:

- **Obecné nastavení e-shopu**
- **Kontakty a firma**
- **Doprava a platby**
- **Daně** (DPH rates)
- **Měny**
- **Jazyky**
- **Objednávky** (stavy, notifikace, DUZP)
- **Emailové šablony** (customizable)
- **Recyklační příspěvky**
- **DPH evidence**
- **Propojení** (Heureka, Zboží.cz, Pohoda, etc.)
- **API klíče**

### 4.8 Oprávnění a role

- **Neomezení administrátoři** (na všech tarifech!)
- Custom role
- Granularní oprávnění (per sekce, per akce)
- 2FA pro uživatele
- Aktivita log

### 4.9 Quick search

- Fulltext vyhledávání v admin
- Přes produkty, objednávky, zákazníky
- Klávesové zkratky

### 4.10 Dark mode

- Tmavý režim pro admin
- Přepínání mezi light/dark
- Per-uživatel nastavení

### 4.11 Přístupnost (2026 novinky)

Shoptet v 2026 pracuje na **lepší přístupnosti** (a11y):

- Ovládání klávesnicí
- Screen reader support
- Barevná schémata splňující WCAG
- Aria labels
- Fullscreen přihlašovací okno

---

## 5. Šablony a design

### 5.1 Přehled šablon

Shoptet nabízí **cca 32 oficiálních šablon:**

- **11 zdarma**
- **21 placených**

**Bezplatné šablony:**

- **Tango** (moderní, univerzální)
- **Techno** (technika, elektronika)
- **Step** (sportovní)
- **Merlot** (víno, gastronomie)
- **Baletka** (móda, elegantní)
- A další

**Placené (pojmenované podle tanců a hudebních stylů):**

- **Titan** – pro velké obchody s mnoha produkty
- **Rubin** – moderní s carouselem a sticky hlavičkou
- **Opal** – minimalistický
- **Adamin** – zaměřená na potraviny a doplňky stravy
- **Jive, Foxtrot, Polka, Salsa, Rumba, Cha-cha** a další
- Ceny placených šablon: **1 500–15 000 Kč jednorázově**

### 5.2 Vlastnosti šablon

**Všechny šablony:**

- **Responzivní** (mobile-first od 2020+)
- **SEO-ready**
- **Průběžně aktualizované**
- **Rychlost načítání** optimalizovaná
- **Kompatibilní s Shoptet funkcemi**
- **Schema.org markup**
- **Hreflang** pro multilanguage

### 5.3 Barevná schémata

- **8 barevných variant** per šablona
- Customizace barev (CSS)
- V 2026 Shoptet přidává **předdefinovaná schémata splňující WCAG přístupnost**

### 5.4 Úprava šablon

**Možnosti:**

**1. Přes administraci (bez kódu):**

- Výběr barev, fontů (základní)
- Úprava loga, banerů
- Rozložení sekcí

**2. Přes Návrhář šablon (viz sekce 6):**

- Visual drag-and-drop editor
- Moderní přístup od 2023+

**3. Přes HTML editor (vývojáři):**

- Úprava šablony v Twig/HTML/CSS/JS
- Pro pokročilé customizace
- V administraci nebo přes Shoptet Developer Tools

**4. Individuální úpravy od partnera:**

- Najmutí Shoptet partnerské agentury/freelancera
- Redesign, custom funkce
- 500–3 000 Kč/h
- 15 000–100 000+ Kč za kompletní redesign

### 5.5 Vlastnosti šablon

- **Layout editor** pro hlavní stránku
- **Bloky** (hero, produkty, kategorie, bannery, newsletter)
- **Sticky menu** (moderní šablony)
- **Mobilní hlavička** optimalizovaná
- **Image carouselu**
- **Product quick view**
- **Dropdown cart**

### 5.6 Externí partnerské šablony

Vedle oficiálních Shoptet šablon existují **šablony od externích agentur**:

- **Shoptak.cz**
- **Shopable.cz**
- **Eshopove-sablony.cz**
- A další

Typicky **2 000–20 000 Kč** jednorázově.

### 5.7 Migrace designu mezi šablonami

- Při změně šablony se automaticky nepřenáší všechny prvky
- Individuální úpravy HTML/CSS musí být znovu aplikovány
- Shoptet nabízí **Odložené aktualizace šablon** – pro merchants s custom úpravami, aby měli čas adaptovat změny

### 5.8 Porovnání s konkurencí

| Platforma        | Počet šablon | Design kvalita |
| ---------------- | ------------ | -------------- |
| **Wix**          | 2 500+       | ⭐⭐⭐⭐⭐     |
| **Squarespace**  | 200+         | ⭐⭐⭐⭐⭐     |
| **Shopify**      | 200+         | ⭐⭐⭐⭐       |
| **BigCommerce**  | 100+         | ⭐⭐⭐         |
| **Shoptet**      | 32           | ⭐⭐⭐         |
| **Upgates**      | 10           | ⭐⭐⭐⭐       |
| **Eshop-rychle** | 100+         | ⭐⭐⭐         |

⚠️ **Slabší stránka Shoptetu** – méně šablon a designově konzervativnější než globální konkurence.

---

## 6. Návrhář šablon – vizuální editor

Shoptet spustil **Návrhář šablon** – moderní vizuální editor pro úpravu šablon bez kódu. Od roku 2023 postupně vyvíjen.

### 6.1 Co Návrhář umí

**Visual drag-and-drop úpravy:**

- **Inspektor prvků** (klikněte na prvek, upravte)
- **Panel nastavení** (barvy, fonty, spacing)
- **Preview na různých stránkách** (homepage, kategorie, detail produktu, článek)
- **Historie změn** (undo/redo)
- **Koncept** ukládání (nenaliveno, dokud nezveřejníte)

### 6.2 Typy upravitelných prvků

- **Barvy** (globální paleta, specifické prvky)
- **Fonty** (typografie, velikosti)
- **Spacing** (paddings, margins)
- **Obrázky** (loga, bannery, pozadí)
- **Texty** (v rámci struktury šablony)
- **Sekce homepage**
- **Produktová detaily** (základní layout)

### 6.3 Omezení Návrháře

⚠️ **Návrhář má omezení vs. plný editor:**

- **Není dostupný na mobilních zařízeních** (mobile admin používá standardní admin)
- **Neumožňuje přesun prvků mimo povolené pozice** (ne pixel-perfect jako Wix)
- **Nemění samotnou strukturu šablony** (spíše její styly)
- **Pro hlubší změny nutno editovat HTML/CSS**
- **Omezená customizace mobilního layoutu** (automatic responsive)

### 6.4 Koncept ukládání

- Všechny změny se **ukládají automaticky do konceptu**
- **Koncept vidí jen aktuálně přihlášený uživatel**
- **Publikace jedním kliknutím** (tlačítko "Zveřejnit")
- Možnost vrátit změny zpět

### 6.5 Integrace s HTML editorem

- **Pokročilé úpravy stále přes HTML editor** v administraci
- Změny v Návrháři + úpravy HTML se kombinují
- Některé změny lze pouze v HTML (custom sekce, JavaScript)

### 6.6 Srovnání s konkurencí

| Platforma       | Visual editor                         |
| --------------- | ------------------------------------- |
| **Wix**         | Editor X / Wix Studio (pixel-perfect) |
| **Squarespace** | Fluid Engine (24-col grid)            |
| **Shopify**     | Theme Editor (sekce-based)            |
| **BigCommerce** | Page Builder + Makeswift              |
| **Shoptet**     | Návrhář šablon (základnější)          |

Shoptet's Návrhář je **slabší** než globální konkurence, ale postupně se vyvíjí. Pro rok 2026 Shoptet plánuje rozšíření capabilities.

### 6.7 Pro koho je Návrhář vhodný

✅ **Dobrý pro:**

- Merchants bez technických znalostí
- Rychlé úpravy barev, fontů, logo
- Preview před publikováním

❌ **Horší pro:**

- Pokročilé custom designy (nutno partner)
- Pixel-perfect layouty
- Komplexní interaktivní prvky

---

## 7. Produkty a katalog

### 7.1 Produktové údaje

**Povinné a základní:**

- **Název produktu**
- **Krátký popis**
- **Dlouhý popis** (WYSIWYG editor)
- **SKU / kód**
- **Kategorie** (unlimited hierarchical)
- **Cena** (s DPH, bez DPH)
- **Akční cena**
- **Dostupnost**
- **Obrázky** (unlimited)
- **Video** (YouTube, Vimeo embed)

**Rozšířené:**

- **EAN, MPN, UPC**
- **Výrobce / značka**
- **Hmotnost** (pro dopravu)
- **Rozměry**
- **Parametry** (specifikace)
- **Varianty** (size, color, atd.)
- **Doplňkové produkty**
- **Sady / balíčky**
- **Recyklační příspěvky**
- **Dárky** (k produktu)

### 7.2 Kategorie

- **Unlimited hierarchy**
- **Kategorie obrázky**
- **Kategorie popisy**
- **SEO per kategorie**
- **Filtrace v kategorii** (parametry, cena)
- **Řazení produktů**
- **Featured produkty v kategorii**
- **Menu struktura**

### 7.3 Produktové varianty

- **Unlimited varianty** per produkt
- **Unlimited parametry variant** (velikost, barva, materiál)
- **Per-variant:**
  - Cena
  - Akční cena
  - SKU
  - EAN
  - Dostupnost (sklad)
  - Hmotnost
  - Obrázky

### 7.4 Parametry a filtrování

- **Parametrické filtrování** (faceted search)
- Kategoriální filtry
- Rozsahy (cena, hmotnost)
- Multi-select
- Dynamic filters podle kategorie
- SEO-friendly filter URLs

### 7.5 Produktové obrázky

- **Unlimited obrázky** per produkt
- **Automatické generování thumbnails**
- **Water-mark** možnost (automatic)
- **Alt texty**
- **Pořadí obrázků**
- **Zoom na detailu**
- **Image gallery**
- **Video embed**

### 7.6 Doplňkové produkty

- Automatické nabídky při košíku
- Cross-sell
- Upsell
- "Často kupováno společně"

### 7.7 Sady / balíčky

- **Create balíček** z více produktů
- Pevná cena balíčku
- Automatická sleva
- Sklad synchronizace s komponenty

### 7.8 Dárky k objednávce a produktům

- Automatický dárek k objednávce (od X Kč)
- Dárek k produktu (free)
- Dárek jako volba (customer vybírá)

### 7.9 Recyklační příspěvky

**České specifikum** – zákonem povinné recyklační příspěvky:

- **EKO-KOM** (obaly)
- **ASEKOL** (elektro)
- **ELEKTROWIN** (elektrospotřebiče)
- **ECOBAT** (baterie)
- Automatický výpočet a zobrazení
- V ceně produktu nebo jako separátní položka

### 7.10 Import / Export

**Podporované formáty:**

- **CSV** (hlavní)
- **XML** (Heureka, Zboží.cz format)
- **XLSX**

**Import from:**

- Shoptet export (migrace mezi Shoptet obchody)
- Heureka XML feed
- Generic CSV
- Custom mapping

### 7.11 Bulk úpravy

- **Hromadná úprava** cen (%, Kč, +/-)
- **Bulk visibility** (zobrazit/skrýt)
- **Bulk category assignment**
- **Bulk tagging**
- **Bulk delete**
- **Bulk stock update**

### 7.12 Produktové limity per tarif

| Tarif      | Max. produktů |
| ---------- | ------------- |
| Free       | 10            |
| Basic      | 100           |
| Business   | 1 000         |
| Profi      | 5 000         |
| Enterprise | 50 000        |
| Premium    | ∞             |

### 7.13 Produktové štítky

- **Novinka**
- **Akce**
- **Doprodej**
- **Tip**
- **Bestseller**
- Custom štítky

### 7.14 Rezervace zboží

- Zákazník rezervuje produkt
- E-mail notifikace
- Automatická expirace rezervace

### 7.15 Dotazy k produktům

- Customer může položit dotaz
- Admin odpovídá
- Zobrazeno na detailu produktu
- FAQ efekt

### 7.16 Hodnocení produktů

- **Hvězdy + text** od zákazníků
- **Foto hodnocení**
- **Moderace** admin
- Email request po nákupu
- **Schema.org markup** pro Google
- Integrace s Heureka reviews

### 7.17 Produktová videa

- YouTube embed
- Vimeo embed
- Self-hosted (limited)
- Multiple videa per produkt

### 7.18 Minimální a maximální objednatelné množství (Business+)

- Nastavitelné per produkt
- Per variant
- Forces customer zvolit správné množství

### 7.19 Digital products / soubory ke stažení

**Přes doplňky:**

- **Download po zaplacení**
- PDF, video, audio, software
- License keys
- Download limit

### 7.20 Produkt scheduling

- **Zveřejnit od data**
- **Ukončit k datu**
- Pro collection drops, sezónní zboží

---

## 8. Skladové hospodářství

Shoptet má pokročilé skladové hospodářství **od tarifu Business**.

### 8.1 Typy skladů

- **Hlavní sklad**
- **Podřízené sklady** (pobočky, vlastní prodejny)
- **Externí sklady** (dropshipping, fulfillment centra)

### 8.2 Skladové stavy

- **Na skladě** (available)
- **Rezervováno**
- **Objednáno (u dodavatele)**
- **Minimum** (low stock threshold)
- **Maximum** (overstock alerts)

### 8.3 Skladové pohyby

- **Příjem** (naskladnění)
- **Výdej** (prodej)
- **Přesun** (mezi sklady)
- **Korekce** (inventura)
- **Odpis** (poškozené, expirované)

### 8.4 Synchronizace skladů (Enterprise)

**Nově v 2025 přidáno do Enterprise tarifu:**

- Automatická synchronizace stavů mezi hlavním a napojenými sklady
- Real-time sync
- Rezervace napříč sklady
- Dostupnost zboží v reálném čase

### 8.5 Multi-location inventory

- **Více skladů / poboček**
- **Per-location stock**
- **Pick from closest warehouse**
- **Split orders** mezi sklady

### 8.6 Rezervace

- Automatická rezervace při vložení do košíku
- Timeout (nastavitelný, 15 min default)
- Reservation holding
- Release při opuštění

### 8.7 Dostupnost zboží

**Nastavitelné:**

- **Skladem** (zelená)
- **Skladem u dodavatele** (modrá)
- **Na objednávku** (oranžová)
- **Není skladem** (červená)
- Per-kategorie nebo per-produkt

### 8.8 Inventury

- Manuální inventura (bulk edit)
- **Import ze čtečky** čárových kódů
- Srovnání s aktuálními stavy
- Report rozdílů

### 8.9 Dodavatelské informace

- Kontakt na dodavatele
- Nákupní cena
- Marže automaticky
- Poznámky

### 8.10 Low stock alerts

- Email notifikace
- Admin dashboard warning
- Nastavitelný threshold per produkt

### 8.11 Reporting

- Aktuální stavy
- Historie pohybů
- Marže reports
- Obrátka zásob

### 8.12 Napojení na čtečky

- **Bluetooth čtečky**
- **Mobile aplikace** (SmartScanner)
- Skenování při příjmu a výdeji
- Rychlejší inventura

### 8.13 Externí skladové systémy

Přes doplňky:

- **Napojení na WMS** (warehouse management systems)
- **3PL integrace** (third-party logistics)
- **Dropshipping platforms**
- **Fulfillment partners**

### 8.14 Omezení

- **Pokročilé skladové hospodářství až od Business**
- **Synchronizace skladů jen v Enterprise**
- **Bez native barcode printing** (přes doplňky)
- **Bez purchase orders** workflow nativně (přes externí)

---

## 9. Objednávky a fulfillment

### 9.1 Životní cyklus objednávky

**Výchozí stavy:**

- **Nová**
- **Vyřizuje se**
- **Platba přijata**
- **Připraveno k expedici**
- **Expedováno**
- **Doručeno**
- **Zrušeno**
- **Vráceno**

**Customizable:**

- Můžete si **přidat vlastní stavy** (např. "Na prodejně", "Čeká na schválení")
- Emaily automatické při změně stavu

### 9.2 Detail objednávky

- **Číslo objednávky** (formát customizable)
- **Zákazník** (údaje + historie)
- **Produkty** + varianty
- **Doprava a platba**
- **Celková cena** (subtotal, DPH, doprava, sleva)
- **Platba** (stav, transakční ID)
- **Doručení** (tracking)
- **Interní poznámky** (admin only)
- **Poznámky pro zákazníka**
- **Aktivity log** (audit)
- **Faktury a dobropisy**
- **Doklady** (PDF export)

### 9.3 Automatické emaily

**Přednastavené šablony:**

- Nová objednávka (zákazník)
- Nová objednávka (admin notifikace)
- Platba přijata
- Expedováno
- Doručeno
- Zrušeno
- Vráceno
- Opuštěný košík (Venture+)
- Poděkování za nákup
- Pre-order ready

**Všechny šablony lze:**

- **Editovat** (HTML editor)
- **Přidat logo, barvy**
- **Přidat custom field**
- **Testovat** před ostrým odesláním
- **Překládat** do jazyků

### 9.4 Doklady a faktury

**Automaticky generováno:**

- **Faktura** (PDF)
- **Zálohová faktura** (proforma)
- **Daňový doklad k záloze**
- **Dobropis** (refund)
- **Dodací list**
- **Výdejka** (warehouse)

**Shoptet Fakturace** (součást tarifu):

- Automatické číslování
- Správné DPH handling
- České legislativní požadavky
- PDF export
- Export do účetních systémů

### 9.5 Export do účetnictví

**Nativní napojení na:**

- **Pohoda** (XML export)
- **Money S3**
- **FlexiBee**
- **ABRA**
- **iDoklad**
- **Fakturoid**

⚠️ **Poznámka:** Napojení na Pohodu je **export XML** (manuální import v Pohodě), ne přímá real-time sync.

### 9.6 DPH a daňové doklady

**Specifika ČR:**

- Různé sazby DPH (21%, 15%, 10%, 0%)
- Reverse charge (B2B)
- **DUZP** (Datum Uskutečnění Zdanitelného Plnění)
- **Dobropisy DUZP** automatic
- **Intrastat** reporting (manuálně)
- **EU sales list** (manuálně)

### 9.7 Dobropisy

- **Plný dobropis** (full refund)
- **Částečný dobropis**
- **Dobropis na dopravu**
- **Automatické vytvoření** při refundu
- **Custom DUZP**

### 9.8 Opuštěný košík

**Na tarifech Basic+:**

- Automatický email po 1 h, 24 h, 72 h
- Discount code v emailu
- Recovery statistiky

### 9.9 Expedice objednávek

**Ruční workflow:**

1. Objednávka přijde
2. Admin označí "Připraveno k expedici"
3. Vytiskne fakturu + dodací list
4. Vytiskne štítek (přes Shoptet Balíky)
5. Předá přepravci
6. Označí "Expedováno" + tracking number
7. Email zákazníkovi s tracking

**Automatizovaný workflow (přes Shoptet Balíky):**

- Automatické štítky
- Automatický tracking
- Batch printing
- Sync stavů

### 9.10 Přehled zásilek

**Shoptet Balíky nabízí:**

- 6 přednastavených stavů
- Barevná indikace
- **Automatická aktualizace 4x denně** (+ manual)
- Jednotné stavy pro všechny dopravce

### 9.11 Vrácení zboží (reklamace)

- Zákazník vyplní formulář reklamace
- Admin schvaluje/zamítá
- Trackování reklamací
- Automatické emaily

### 9.12 Reklamace hromadně

- Přes doplňky (pokročilé RMA)
- Customer-facing portal
- Self-service returns

### 9.13 Fraud prevention

- Přes platební brány (GoPay, ComGate – vlastní fraud scoring)
- 3D Secure povinné pro karty
- Manual review flagged orders
- Doplňky pro pokročilé fraud detection

### 9.14 Objednávky z marketplaces

**Sync s Allegro** (Marketplace Napojení 2026):

- Objednávky z Allegro → Shoptet admin
- Unifikovaný orders view
- Automatické stavy sync

---

## 10. Zákazníci a věrnostní funkce

### 10.1 Zákaznická databáze

- **Unlimited zákazníci**
- **Údaje:** jméno, email, telefon, adresy, firma, IČO, DIČ
- **Historie objednávek**
- **Poznámky**
- **Aktivita timeline**
- **GDPR nástroje**

### 10.2 Typy zákazníků

- **Registrovaný zákazník** (account)
- **Guest** (bez registrace)
- **Firemní zákazník** (IČO, DIČ, B2B)
- **Administrátor** (staff)

### 10.3 Cenové hladiny (B2B)

**Na Business+:**

- **Unlimited cenových hladin**
- **B2B ceny** (jen přihlášeným)
- **Wholesale ceny**
- **VIP ceny**
- Per-hladina:
  - Sleva procentuálně
  - Konkrétní ceny per produkt
  - Viditelnost produktů
  - Osvobození od DPH (reverse charge)

### 10.4 Skupiny zákazníků

- Segmentace dle:
  - Total spent
  - Last order date
  - Source
  - Custom tags
- Newsletter targeting
- Discount targeting

### 10.5 Zákaznický účet (storefront)

Zákazník po přihlášení:

- **Přehled objednávek**
- **Stav objednávek** (tracking)
- **Opakovat objednávku**
- **Adresáře** (save multiple)
- **Oblíbené produkty** (wishlist)
- **Body/kredit** (loyalty)
- **Změna hesla / údajů**
- **Odhlášení z newsletteru**

### 10.6 Nákup na firmu (B2B)

- **IČO / DIČ validace** (česká ARES integrace! ✅)
- **Automatické načtení firmy** z ARES
- **Reverse charge** pro EU B2B
- **Proforma faktury**
- **Net terms** (přes doplňky)

### 10.7 Oblíbené produkty (wishlist)

- Customer saves produkty
- "Přidat do oblíbených"
- Sdílet wishlist
- Email pokud sleva

### 10.8 Věrnostní program (Profi+)

**Nativní v Profi+ tarifech:**

- **Body za nákup** (configurable)
- **Body za registraci**
- **Body za hodnocení**
- **Body za narozeniny**
- **Redemption** na slevy
- **VIP úrovně** (bronze, silver, gold)
- **Double points akce**

Pro nižší tarify přes doplňky.

### 10.9 Kreditový systém

- **Store credit** per zákazník
- Issue při refundu
- Issue manuálně
- Auto-applied at checkout
- Balance tracking

### 10.10 GDPR nástroje

- **Cookie banner** (customizable)
- **Souhlasy** (marketing, profiling)
- **Export osobních údajů** (customer request)
- **Smazání osobních údajů** (right to erasure)
- **Anonymizace** objednávek
- **Audit log souhlasů**

### 10.11 Komunikace se zákazníky

**Native:**

- **Newsletter** (Mailchimp integrace)
- **Email automation** (opuštěný košík)
- **SMS notifikace** (placené, přes SMSBrana nebo jiné)

**Přes doplňky:**

- **Smartsupp** chat
- **Zopim (Zendesk Chat)**
- **LiveAgent**
- **Daktela** (call center)

### 10.12 Importy zákazníků

- **CSV import**
- **XLSX import**
- Migrace ze Shoptetu
- Migrace z WooCommerce, Shopify, atd. (přes CSV)

### 10.13 Komunikace pro B2B

- **Dotazník** na registraci (firma, koncentrace nákupu)
- **Schvalování B2B účtů** admin
- **Custom přivítací email**
- **Price list export**

---

## 11. Shoptet Pay a platební brány

### 11.1 Shoptet Pay

**Shoptet Pay** je vlastní platební brána Shoptetu, vytvořená "na míru e-shopu".

**Key features:**

- ✅ **Vedení brány zdarma** (žádné měsíční poplatky)
- ✅ **Platby pouze za reálné transakce**
- ✅ **Aktivace do druhého dne** (bez zdlouhavého papírování)
- ✅ **Vše spravuje v administraci Shoptet** (aktivace, správa, refundace)
- ✅ **Frekvence výplat** nastavitelná (denně, týdně, měsíčně)
- ✅ **Využito přes 10 000 e-shopy** v ČR
- ✅ **Refundace přímo z administrace**
- ✅ **Podpora Apple Pay, Google Pay**
- ✅ **3D Secure 2** (SCA compliance)

**Platební metody:**

- Platební karty (Visa, MasterCard, Maestro)
- Apple Pay
- Google Pay
- Online bankovní převody (Komerční banka, ČSOB, Raiffeisen, Česká spořitelna)

**Cena:**

- **0 Kč měsíčně**
- **Poplatky per transakce** (výše dle tarifu Shoptet)
- Typicky **1,1–1,8% per transakce**
- Bez fixních transakčních poplatků (např. 0,30 USD jako Stripe)

### 11.2 GoPay+

**GoPay** je nejpopulárnější česká platební brána (přes 19 000 e-shopů v ČR+SR).

**GoPay+ v Shoptetu:**

- **56 platebních metod**
- **8 měn**
- **19 jazyků**
- **Apple Pay, Google Pay**
- **Click to Pay**
- **PSD2 bankovní platby**
- **Zapamatování karty**
- **10 barevných schémat**
- **Custom logo**
- Nastavitelné výplaty
- PayWithGoPay odkazy

**Cena (zaváděcí pro Shoptet):**

- **Platby kartou a online bankovními převody:** 0,95 % + 0 Kč za transakci
- **Garance, že sazbu nezmění** po měsíci (na rozdíl od jiných brán)
- **Bez poplatku 200 Kč** za doplněk (GoPay vrací kompenzačním bonusem)
- **Tarif Start:** první rok zdarma do 50 000 Kč měsíčně

### 11.3 ComGate

**ComGate Payments** – česká platební brána s širokou oblibou.

**Features:**

- Platby kartou
- Bankovní platby (všechny CZ banky)
- Apple Pay, Google Pay
- **Bez měsíčních poplatků**
- Transakční poplatky 0,8–1,8% (dle objemu)
- Pay later

### 11.4 ThePay

**ThePay** – česká brána s důrazem na rychlost integrace.

**Features:**

- Platby kartou
- Bankovní platby
- Apple Pay, Google Pay
- Nástroje pro refundaci
- Recurring payments

### 11.5 PayPal

- Mezinárodní brána
- Karty + PayPal accounts
- Buyer protection
- Vyšší fees (3,4% + fixed fee pro mezinárodní)

### 11.6 Další platební metody

**Dobírka (COD):**

- **Oblíbená v ČR** (u některých kategorií až 40% objednávek)
- Nastavitelná per způsob dopravy
- Poplatek za dobírku
- Reálné prachy vyplácí přepravce

**Bankovní převod:**

- Manuální platba
- Proforma faktura
- Email s platebními údaji

**Hotově při osobním odběru**

### 11.7 BNPL (Buy Now Pay Later)

**Přes doplňky:**

- **Twisto** (česká BNPL)
- **Skip Pay**
- **Home Credit** (splátky)
- **Cofidis**
- **PayU Later**

### 11.8 Srovnání brán

| Brána           | Měsíční poplatek | Transakční fee       | Metody                         |
| --------------- | ---------------- | -------------------- | ------------------------------ |
| **Shoptet Pay** | 0 Kč             | 1,1–1,8%             | karta, Apple/Google Pay, banky |
| **GoPay**       | 0 Kč (s GoPay+)  | 0,95% + 0 Kč (start) | 56 metod, multi-currency       |
| **ComGate**     | 0 Kč             | 0,8–1,8%             | karta, banky                   |
| **ThePay**      | 0 Kč             | 1–2%                 | karta, banky                   |
| **PayPal**      | 0 Kč             | 3,4% + fee           | karta, PayPal                  |

### 11.9 Nastavení brány

- **Jednotné rozhraní** v administraci
- **Propojení:** Nastavení → Propojení → [brána]
- **Platební metody:** Nastavení → Doprava a platby → Způsoby platby
- **Propojení** s vlastním účtem v bráně
- **Test mode** pro testování

### 11.10 3D Secure

- **Povinné pro EU** (SCA compliance)
- Automaticky aktivní
- Všechny brány podporují

### 11.11 Currency a mezinárodní platby

- **CZK** (primární v ČR)
- **EUR** (SR, EU)
- **USD, GBP** (přes GoPay multi-currency)
- **Multi-currency** display přes Profi+

### 11.12 PCI compliance

- **PCI DSS Level 1** (Shoptet + brány)
- **Žádné PCI surveys** pro merchants
- **Tokenizace karet**

---

## 12. Shoptet Balíky a doprava

**Shoptet Balíky** je **integrovaný logistický nástroj** – konkurence Balíkobota přímo od Shoptetu.

### 12.1 Co je Shoptet Balíky

**Všechno v jednom:**

- **Přímé napojení na dopravce**
- **Vytváření štítků přímo v administraci**
- **Sledování zásilek**
- **Jednotné stavy** pro všechny dopravce
- **Automatická aktualizace 4x denně**
- **Bez měsíčního poplatku**
- **Placení pouze za reálně podané balíky** (u dopravců vlastní sazba)

### 12.2 Podporovaní dopravci v Shoptet Balíky

**České:**

- **Zásilkovna** (Packeta)
- **Česká pošta**
- **PPL** (CZ + GLS)
- **DPD**
- **GLS**
- **DHL Express**
- **Messenger**
- **Gebrüder Weiss**

**Slovenské:**

- **Slovenská pošta**
- **GLS SK**
- **123Kuriér**
- **Packeta SK**

### 12.3 Výdejní místa

**Huge advantage v ČR:**

- **Zásilkovna** (10 000+ výdejních míst v ČR+SR+EU)
- **Balíkovna** (Česká pošta – 3 000+ míst)
- **PPL ParcelShop** (4 000+ míst)
- **DPD Pickup**
- **GLS ParcelShop**

Zákazník si vybere výdejní místo v checkoutu.

### 12.4 Štítky a expedice

**Workflow:**

1. Objednávka přijde do administrace
2. Admin vytvoří štítek jedním kliknutím
3. Automatické vygenerování tracking number
4. Tisk štítků (single nebo batch)
5. Předání dopravci

**Funkce:**

- **Batch printing** (více štítků najednou)
- **Štítky na A4 nebo 100×150 mm**
- **Customizable**
- **Opravné štítky**

### 12.5 Tracking

- **Unifikované stavy** pro všechny dopravce
- **Automatická aktualizace** (4x denně)
- **Manuální vynucení** update
- **Email zákazníkovi** při změně stavu
- **Tracking page** (branded, přes doplňky)

### 12.6 Alternativa: Balíkobot

**Balíkobot** je historicky oblíbený doplněk pro Shoptet:

- Podporuje více dopravců
- **Placený doplněk** (na rozdíl od Shoptet Balíky)
- Pokročilejší features (starší, stabilní)
- Kritizovaný pro **dlouhou výpovědní lhůtu** (3 měsíce) a agresivní obchodní politiku

**Od 2024+ mnoho merchants migrovalo na Shoptet Balíky** (zdarma, integrované).

### 12.7 Doprava pro zákazníka

**V checkoutu:**

- Výběr dopravy (Zásilkovna, ČP, PPL, DPD, GLS, DHL)
- Výběr výdejního místa (mapa)
- Automatický výpočet ceny
- Zobrazení odhadu doručení

### 12.8 Nastavení dopravy

- **Ceny dopravy** (fixed, by weight, by price)
- **Free shipping threshold** (nad X Kč zdarma)
- **Vázání dopravy na platbu** (některé dopravy jen s určitými platbami)
- **Hmotnostní intervaly**
- **Regionalizace** (různé ceny per region)

### 12.9 Dobírka

- **Povolit dobírku** per dopravu
- **Poplatek za dobírku** (30–100 Kč)
- Přepravce vybírá peníze

### 12.10 Osobní odběr

- **Vlastní prodejna/výdejna**
- Adresa + otevírací doba
- Zdarma nebo paušální poplatek

### 12.11 Mezinárodní doprava

- **Evropské dopravce** (DPD, DHL, GLS, UPS)
- **Custom form** pro celní prohlášení
- **DDP / DDU** options
- **Zásilkovna** rozšířená síť v EU

### 12.12 Reklamace zásilky

- Workflow v administraci
- Automatické dokumenty
- Komunikace s dopravcem

### 12.13 Srovnání s konkurencí

| Platforma                   | Česká doprava              |
| --------------------------- | -------------------------- |
| **Shoptet**                 | ⭐⭐⭐⭐⭐ (nativně vše)   |
| **Upgates**                 | ⭐⭐⭐⭐ (většina nativně) |
| **WooCommerce + ČR plugin** | ⭐⭐⭐⭐ (přes CZ plugins) |
| **Shopify**                 | ⭐⭐ (přes Packeta plugin) |
| **Wix**                     | ⭐ (přes Sendcloud)        |
| **Squarespace**             | ⭐ (přes Sendcloud)        |
| **BigCommerce**             | ⭐ (přes Sendcloud)        |
| **Ecwid**                   | ⭐ (přes Sendcloud)        |

**Zde je Shoptet jasně nejsilnější** – proto dominuje v ČR.

---

## 13. Srovnávače zboží a XML feedy

**Kritický feature pro český e-commerce.** V ČR je většina objednávek z **Heureky** a **Zboží.cz**.

### 13.1 Nativní napojení (v ceně všech tarifů)

**Shoptet generuje XML feedy automaticky pro:**

**Hlavní CZ/SK srovnávače:**

- **Heureka** (CZ + SK)
- **Zboží.cz** (Seznam.cz)
- **Google Nákupy** (Google Shopping)
- **Glami** (móda, oblečení)
- **Árukereső** (HU)
- **Srovnáme** (CZ)

**Ostatní podporované:**

- **HledejCeny.cz**
- **HyperZbozi.cz**
- **Monitor.cz**
- **Naakup.cz**
- **NejlepsiCeny.cz**
- **Pricemania.sk** (SK)
- **Další specializované** (móda, elektro, atd.)

### 13.2 Heureka

**Nejvýznamnější CZ srovnávač** – přes Heureku prochází 40-60% objednávek mnoha CZ e-shopů.

**Shoptet integrace:**

- **Automatický XML feed** v předepsaném formátu
- **Heureka Košík** (checkout bez opuštění Heureky) přes doplněk
- **Heureka Ověřeno zákazníky** – získávání recenzí
- **Heureka Reviews** – zobrazení na e-shopu
- **Produkt map** – propojení s Heureka kategoriemi

### 13.3 Zboží.cz

**Druhý nejvýznamnější** srovnávač (Seznam.cz).

**Features:**

- Automatický XML feed
- **Zboží.cz Checkout**
- Listing v Seznam.cz vyhledávání
- CPC model

**Nové v 2025:**

- **Seznam Email integrace** (objednávky z Shoptet e-shopů se zobrazují v Seznam Email inboxu zákazníků)
- Strukturovaná data pro lepší viditelnost

### 13.4 Google Shopping / Google Nákupy

- **Google Merchant Center** feed
- **Free listings** (Shopping tab)
- **Google Shopping Ads**
- **Performance Max** campaigns
- **Automated feeds**

### 13.5 Glami

**Module specializovaný** – prodej módy a oblečení.

- Automatický feed
- Produkty na Glami.cz

### 13.6 XML feed customization

- Editace mapping polí
- Custom fields
- Filtrace produktů (exclude některé)
- Různé feedy per kategorie
- **Per-feed ceny** (možnost jiných cen pro Heureku)

### 13.7 Price comparison insights

- Přes doplňky (monitoring cen konkurence)
- **Shoptet Boost** (cenové doporučení)
- **Dataweps** (pokročilé monitoring)

### 13.8 Heureka.sk, Pricemania.sk (SK trh)

Automatická podpora slovenských srovnávačů:

- **Heureka.sk**
- **Pricemania.sk**
- **Najlacnejsie.sk**
- **Nay.sk**

### 13.9 Novinky 2026 – LLM feed pro OpenAI

**Shoptet připravuje prodej přes ChatGPT:**

- **LLM feed** specifický pro AI vyhledávače
- Waiting list v administraci
- Aktivuje se, jakmile OpenAI launch v EU
- **Instant Checkout** původně, nyní otevřenější k checkout merchants

### 13.10 Omezení

- **Primárně česko-slovenský focus** (pro globální srovnávače menší pokrytí)
- **Některé specializované srovnávače** přes placené doplňky
- **Feedy v češtině** (pro mezinárodní nutnost překladu)

---

## 14. Účetnictví a fakturace

### 14.1 Shoptet Fakturace (v ceně)

**Integrovaný fakturační systém:**

- **Automatické faktury** pro každou objednávku
- **Proforma faktury** (zálohy)
- **Daňové doklady k záloze**
- **Dobropisy**
- **Dodací listy**
- **Výdejky**

### 14.2 Česká legislativa

**Všechny doklady splňují:**

- **Zákon o DPH** (21%, 15%, 10%, 0%)
- **Datum uskutečnění zdanitelného plnění (DUZP)**
- **Osvobození od DPH** (export mimo EU)
- **Reverse charge** (B2B EU)
- **Přenesená daňová povinnost**
- **Recyklační příspěvky** evidence

### 14.3 Číslování dokladů

- **Automatické** číslování
- **Year-based** (2026001, 2026002...)
- **Custom prefix** nastavitelný
- **Separátní řady** pro faktury / zálohy / dobropisy

### 14.4 Firma a kontakty

- **IČO, DIČ** validation (ARES integrace!)
- **Plátce DPH** status
- **Automatické načtení firmy** z ARES
- **Kontaktní osoby**

### 14.5 Export do účetních systémů

**Nativní napojení/export:**

- **Pohoda** – XML export (manual upload v Pohodě)
- **Money S3** – export
- **FlexiBee** – export
- **ABRA** – export
- **iDoklad** – integrace
- **Fakturoid** – integrace
- **Premier** – export

⚠️ **Poznámka:** Pohoda napojení je **XML export, ne real-time API sync**. Pro plnou automatizaci nutno přes doplňky jako **ASW** (Automatický systém pro Pohodu).

### 14.6 EET (elektronická evidence tržeb)

- **Historicky** podporované
- **Dnes nepovinné** (zrušeno 2023)
- Stále funkcionality dostupné pro legacy

### 14.7 Daně per stát

**Pro ČR:** 21%, 15%, 10%, 0%
**Pro SK:** 20%, 10%, 0%
**Pro EU exporty:** reverse charge (B2B)
**Pro mimo EU:** export osvobozen

### 14.8 Recyklační příspěvky

- **EKO-KOM** (obaly)
- **ASEKOL** (elektro)
- **ELEKTROWIN**
- **ECOBAT**
- **Automatický výpočet**
- **Samostatná evidence**

### 14.9 Intrastat

**B2B obchod s EU:**

- Vykazování přes Intrastat
- Manuální export v administraci
- Podklady pro daňového poradce

### 14.10 Daňové reporty

- **Sumář DPH** za období
- **DPH přiznání** podklady
- **Kontrolní hlášení** (CZ)
- **Souhrnné hlášení**
- Export do PDF / XLSX

### 14.11 Fakturační údaje

**Zákazník vidí na faktuře:**

- Logo e-shopu
- Kontaktní údaje prodávajícího
- IČO, DIČ prodávajícího
- Údaje zákazníka (firma)
- Čárový kód / QR kód pro rychlou platbu
- **IBAN, SWIFT** pro mezinárodní

### 14.12 Platební QR kód

- **Automaticky na faktuře**
- **QR platba** (česká standardizace)
- Rychlá platba přes bank app

### 14.13 Multi-jazyčné faktury

- **Faktury v češtině** (default)
- **Faktury v slovenštině, angličtině, němčině**
- Custom překlady možné

### 14.14 Přizpůsobení dokladů

- **Logo** upload
- **Barevné schéma**
- **Custom text** (fotr, záhlaví)
- **PDF šablona** (pro vývojáře)

---

## 15. Daně a legislativa (ČR)

Shoptet je **primárně navržen pro českou legislativu** – tady vyniká nad všemi globálními platformami.

### 15.1 DPH (Daň z přidané hodnoty)

**České sazby 2026:**

- **Základní:** 21%
- **První snížená:** 15%
- **Druhá snížená:** 10%
- **Nulová:** 0% (osvobození)

**Nastavení:**

- Per produkt tax class
- Per kategorie default
- **Inclusive / exclusive** pricing (s DPH / bez DPH)
- **B2B reverse charge** pro EU zákazníky s VAT ID

### 15.2 ARES integrace

⚠️ **Unikát oproti globálním platformám** – Shoptet má **nativní integraci s českým registrem ARES**.

- Customer zadá IČO
- Automatické načtení:
  - Název firmy
  - DIČ
  - Adresa sídla
  - Plátce DPH status
- **Validace IČO** formátu
- **Kontrola proti neplatným** IČO

### 15.3 EU VAT handling

- **EU VAT ID validation** (VIES API)
- **Reverse charge** pro B2B EU
- **Digital services** (MOSS pro digital goods)
- **OSS / One Stop Shop** support

### 15.4 Recyklační příspěvky

**České specifikum:**

- **EKO-KOM:** obaly (per kg obalu)
- **ASEKOL:** elektro (per kus)
- **ELEKTROWIN:** bílé zboží (per kus)
- **ECOBAT:** baterie (per kg)

**Shoptet features:**

- Nastavitelné per produkt
- Automatický výpočet
- **Samostatná evidence** na faktuře
- **Report pro organizace**
- Historically EU WEEE directive compliance

### 15.5 GDPR

**Nativní GDPR nástroje:**

- **Cookie consent banner**
- **Souhlasy** (marketing, profilace)
- **Audit log** souhlasů
- **Export osobních dat** (customer request)
- **Smazání dat** (right to erasure)
- **Anonymizace objednávek**
- **Privacy Policy generator**

### 15.6 Zákon o ochraně spotřebitele (ČR)

- **14denní odstoupení** (evropský standard)
- **Záruka 24 měsíců**
- **Reklamační řád**
- **Obchodní podmínky** generator
- **Informace před uzavřením smlouvy**

### 15.7 EET (legacy)

- Historicky povinné
- **2023 zrušeno**
- Shoptet stále nabízí feature pro legacy systémy
- Nová generace merchants to nepotřebuje

### 15.8 Intrastat reporting

**Pro obchody s EU:**

- Export podkladů pro Intrastat hlášení
- Měsíční / čtvrtletní
- Manuální upload do eDaně

### 15.9 Přenesená daňová povinnost

- **Pro specifické zboží** (stavební práce, elektronika některé)
- Automatický handling
- Správné vykazování

### 15.10 Srovnání s konkurencí

| Funkce               | Shoptet | Shopify | WooCommerce | Wix    |
| -------------------- | ------- | ------- | ----------- | ------ |
| České DPH sazby      | ✅ auto | manual  | manual      | manual |
| ARES napojení        | ✅      | ❌      | CZ plugin   | ❌     |
| Recyklační příspěvky | ✅      | ❌      | CZ plugin   | ❌     |
| EET historicky       | ✅      | ❌      | CZ plugin   | ❌     |
| České dobropisy      | ✅      | partial | CZ plugin   | ❌     |
| CZ reverse charge    | ✅      | manual  | CZ plugin   | manual |
| Kontrolní hlášení    | ✅      | ❌      | CZ plugin   | ❌     |

**Zde je Shoptet výrazně nejsilnější pro CZ trh.**

---

## 16. Mezinárodní prodej

Shoptet podporuje mezinárodní prodej, ale s určitými omezeními ve srovnání s Shopify Markets.

### 16.1 Multi-language storefront

**Tarify Profi+:**

- **Neomezená jazyková mutace** storefrontu
- **Překlad produktů** (názvy, popisy, kategorie)
- **Překlad SEO meta**
- **Vícejazyčné menu, články, stránky**
- **Language switcher** v headeru

**Podporované jazyky storefrontu:**

- **Čeština** ✅
- **Slovenština** ✅
- **Angličtina** ✅
- **Němčina** ✅
- **Polština** ✅
- **Maďarština** ✅
- **Rumunština** ✅
- **Bulharština** ✅ (nově 2026)
- **Italština**
- **Francouzština**
- **Chorvatština**
- **Ukrajinština**
- **Srbština**
- A další (AI překlady)

### 16.2 Multi-currency (Enterprise+)

**Tarify Enterprise+:**

- **Prodej v různých měnách**
- **Currency switcher**
- **Automatic exchange rates** (ČNB)
- **Manual override**
- **Zaokrouhlení**

**Podporované měny:**

- **CZK** (primární)
- **EUR**
- **USD, GBP**
- **PLN, HUF, RON, BGN** (střední Evropa)
- A další

### 16.3 Automatický překlad (Profi+)

**Nové:**

- AI překlad produktů i kategorií
- Překlad při editaci
- Batch překlad celého katalogu
- Automation pro nové produkty
- Manuál editování translations

### 16.4 Mezinárodní prodej (tarifní funkce)

**Na Free+ tarifech:**

- **Mezinárodní prodej** jako rozšiřující funkce
- Mimo-EU obchody
- Celní handling (limited)

### 16.5 Hraniční obchod

**DDP / DDU:**

- Customer platí cla při doručení (default)
- Nebo pre-calculated v checkoutu (přes doplňky)

**Customs documents:**

- Automatické přes Shoptet Balíky
- **CN22 / CN23** forms

### 16.6 Expansion do Slovenska

**Největší exportní trh pro CZ e-shopy.**

Shoptet features:

- **SK jazyk** v storefrontu
- **SK dopravce** (Slovenská pošta, GLS SK, 123Kuriér, Packeta SK)
- **SK srovnávače** (Heureka.sk, Pricemania.sk)
- **EUR platby** (Shoptet Pay, GoPay)
- **SK legislativa** (DPH, GDPR)

### 16.7 Expansion do Polska

- PL jazyk storefrontu
- PL dopravce (přes Zásilkovnu)
- PL srovnávače (Ceneo přes feed)
- **Allegro marketplace** (Marketplace Napojení od 2026!)
- PLN měna (Enterprise+)

### 16.8 Expansion do Maďarska

- HU jazyk
- HU srovnávače (Árukereső)
- HUF měna
- HU dopravce (přes Packeta)

### 16.9 Expansion do Rumunska a Bulharska

- RO, BG jazyk (2026)
- Limited support zatím
- **Bulharsko přešlo na EUR v 2026** (+ e-commerce barriers down)

### 16.10 Omezení mezinárodního prodeje

- **Primárně střední/východní Evropa focus**
- **Slabší než Shopify Markets** pro globální (multi-country tax, duties automation)
- **Multi-currency jen od Enterprise**
- **Multi-language jen od Profi**
- **Méně globálních platebních metod**
- **US, UK, LATAM, Asia – limited**

### 16.11 Srovnání s konkurencí

| Platforma           | Multi-currency       | Multi-language            | Global expansion    |
| ------------------- | -------------------- | ------------------------- | ------------------- |
| **Shopify Markets** | ⭐⭐⭐⭐⭐           | ⭐⭐⭐⭐⭐                | ⭐⭐⭐⭐⭐          |
| **BigCommerce**     | ⭐⭐⭐⭐             | ⭐⭐⭐ (multi-storefront) | ⭐⭐⭐⭐            |
| **Wix**             | ⭐⭐⭐⭐             | ⭐⭐⭐⭐                  | ⭐⭐⭐⭐            |
| **Shoptet**         | ⭐⭐⭐ (Enterprise+) | ⭐⭐⭐⭐ (Profi+)         | ⭐⭐⭐ (regionální) |
| **Squarespace**     | ⭐                   | ⭐⭐                      | ⭐⭐⭐              |
| **Ecwid**           | ⭐⭐                 | ⭐⭐⭐                    | ⭐⭐⭐              |

**Shoptet je dobrý pro CZ/SK + střední Evropa, horší pro globální.**

---

## 17. Marketing – Shoptet Kampaně

### 17.1 Shoptet Kampaně

**Shoptet Kampaně** je nástroj pro správu online reklamy **přímo z administrace e-shopu** (launched 2024).

**Features:**

- **Google Ads** kampaně z administrace
- **Microsoft Ads** (Bing)
- **Automatická optimalizace** (od 2026 nová feature)
- **Smart Shopping** campaigns
- **Remarketing**
- **Dynamické produktové reklamy**
- **Budget management**
- **Reports**

### 17.2 Nové 2026 – Automatická optimalizace

- **AI-driven campaign optimization**
- Automatic bid adjustments
- Target ROAS optimization
- Audience expansion

### 17.3 Email marketing

**Native:**

- **Newsletter** (basic)
- **Opuštěný košík** (Basic+)
- **Transactional emails** (order confirmation, atd.)

**Přes doplňky (hlavní):**

- **Mailchimp** (nativní integrace, v Basic+ v ceně)
- **Ecomail** (česká platforma, velmi oblíbená v ČR)
- **SmartEmailing**
- **Klaviyo**
- **ActiveCampaign**

### 17.4 Ecomail (česká email marketing platforma)

**Populární volba v ČR** – hluboká Shoptet integrace:

- Product feed sync
- Customer segments
- Automations (welcome, win-back, VIP)
- Abandoned cart
- Newsletter
- A/B testing
- **Ceny:** cca 500–5 000 Kč/měs. dle velikosti databáze

### 17.5 Facebook a Instagram

- **Meta Pixel** auto-install
- **Facebook Shop** (přes Meta Catalog)
- **Instagram Shopping**
- **Facebook Ads** (přes doplněk)
- **Meta Conversions API**

### 17.6 TikTok

- **TikTok Pixel**
- **TikTok Shop** (přes doplňky, limited)
- **TikTok Ads** integrace

### 17.7 Google

- **Google Analytics 4** (native setup)
- **Google Tag Manager**
- **Google Merchant Center**
- **Google Shopping Ads**
- **Google Customer Reviews**

### 17.8 Remarketing

- **Google Remarketing**
- **Facebook Retargeting**
- **Dynamic product ads**
- **Klaviyo / Ecomail** email remarketing
- **Display Ads**

### 17.9 Propagace na e-shopu

- **Pop-ups** (přes doplňky – Smartsupp, Optinly)
- **Announcement banners**
- **Product badges** (Novinka, Akce, Bestseller)
- **Hero banners** (homepage)
- **Exit-intent** pop-ups

### 17.10 Srovnávače (již popsáno v sekci 13)

Heureka, Zboží.cz, Glami jako hlavní marketing kanály.

### 17.11 Affiliate / Provizní systém (Business+)

**Nové v Business tarifu od 2025:**

- **Vytvoření vlastního affiliate programu**
- **Partner dashboard**
- **Unique referral URLs**
- **Commission tracking**
- **Payment management**
- **Performance reports**

Přes doplňky pro pokročilé:

- **Dognet**
- **PartnerBox**
- **Affilbox**

### 17.12 SEO kampaně

Propojení s:

- **Ahrefs**
- **SEMrush**
- **Collabim** (česká SEO agency)

### 17.13 Influencer marketing

- Přes externí nástroje
- **Tracking přes affiliate links**
- **Promo codes** per influencer

### 17.14 Content marketing

- **Blog** v administraci
- **Články a stránky**
- **SEO-optimized**
- **Šablony článků**

### 17.15 Sociální sítě

- **Auto-share** nových produktů (přes doplňky)
- **Social proof** notifications (Proofly, Fomo)

### 17.16 Srovnání s konkurencí

| Feature                | Shoptet                       | Shopify                  | Wix      | Ecwid |
| ---------------------- | ----------------------------- | ------------------------ | -------- | ----- |
| Ads management v admin | ⭐⭐⭐⭐ (Shoptet Kampaně)    | ⭐⭐⭐⭐                 | ⭐⭐⭐   | ⭐⭐  |
| Email marketing native | ⭐⭐ (přes Mailchimp/Ecomail) | ⭐⭐⭐⭐ (Shopify Email) | ⭐⭐⭐⭐ | ⭐⭐  |
| Czech Heureka support  | ⭐⭐⭐⭐⭐                    | ⭐                       | ⭐       | ⭐    |
| Affiliate native       | ⭐⭐⭐⭐ (od 2025)            | ⭐⭐                     | ⭐⭐     | ⭐⭐  |

---

## 18. Slevy, kupony, věrnostní systém

### 18.1 Slevové kupony

**Na všech tarifech:**

- **Procentuální sleva** (např. 10%)
- **Pevná sleva** (např. 500 Kč)
- **Sleva na dopravu**
- **Sleva na produkt**
- **BOGO** (buy one get one)

**Podmínky:**

- Minimum objednávky
- Specifické produkty/kategorie
- Pro konkrétní zákazníky
- Pro first-time customers
- Limit použití (celkově, per customer)
- Expiration date
- Platnost od/do

### 18.2 Automatické slevy

- **Aplikované bez kódu**
- **Tier discounts** (množstevní)
- **Kategorie slevy**
- **Časově omezené akce**

### 18.3 Množstevní slevy (Business+)

- **Buy 3+ get 10% off**
- **Buy 10+ get 20% off**
- Unlimited tiers
- Per product or category
- Automatic application

### 18.4 Akční ceny

- **Akční cena produktu**
- **Ukazatel Top 10 nejprodávanějších**
- **Scheduled akce** (od-do)
- **Countdown** na end akce

### 18.5 Cenové hladiny (B2B)

**Profi+:**

- Customer groups s custom prices
- B2B přihlášení pro speciální ceny
- VIP zákazníci

### 18.6 Dárky

- **Dárek k objednávce** (nad X Kč)
- **Dárek k produktu**
- **Dárek jako volba** (customer choose)
- **Automatic** nebo **manual**

### 18.7 Sady / balíčky

- **Vytvoření balíčku** z několika produktů
- **Automatická sleva** (oproti jednotlivým cenám)
- **Dynamic sady** (customer choose combo)

### 18.8 Dárkové poukazy

- **Elektronické poukazy**
- **Custom hodnoty**
- **Email delivery**
- **Balance tracking**
- **Expiration**
- Typicky přes doplňky

### 18.9 Věrnostní program (Profi+)

**Nativně v Profi+:**

- **Body za nákup** (např. 1 bod = 1 Kč)
- **Body za registraci**
- **Body za hodnocení produktu**
- **Body za narozeniny**
- **Body za reference** (doporučení)
- **VIP úrovně** (Bronze, Silver, Gold)
- **Double points** akce
- **Body redemption** (převod na slevu)
- **Point history** customer view

### 18.10 Doplňky pro pokročilejší věrnostní systémy

Pro nižší tarify nebo pokročilejší features:

- **Loyalty.cz**
- **Sprinklr**
- **Custom věrnostní systémy**

### 18.11 Store credit / kredit

- **Issue na refundu**
- **Promotional kredit**
- **Customer account balance**
- **Auto-apply at checkout**

### 18.12 Opuštěný košík (Basic+)

**Automatické emaily:**

- **1 hodina** po opuštění
- **24 hodiny**
- **72 hodin**
- **Discount code** v emailu (incentive)
- **Conversion tracking**
- Dashboard report

### 18.13 Min&Max množství (Business+, nové 2025)

- **Minimum objednatelné množství** per produkt
- **Maximum** per produkt
- Forces customer vybrat správné množství
- Pro regulaci objednávek, velkoobchodu

### 18.14 Slovník pojmů (Profi+, nové 2025)

- Vytvoření glossary e-shopu
- Odborné termíny vysvětlené
- Linking z produktových popisů
- SEO benefit

---

## 19. SEO a obsah

### 19.1 Základní SEO (v ceně všech tarifů)

**Na všech tarifech:**

- **Meta title** per stránka/produkt/kategorie
- **Meta description**
- **URL slugs** (customizable)
- **Canonical URLs**
- **Alt texty** na obrázcích
- **H1-H6** heading struktura
- **XML sitemap** auto-generated
- **Robots.txt** nastavitelný
- **Schema.org markup** (Product, Breadcrumb, Organization, Review)
- **Open Graph** tags
- **Twitter Cards**

### 19.2 Pokročilé SEO (Enterprise)

**Rozšířené v Enterprise:**

- **Hreflang** tags (multi-language SEO)
- **Canonical customization**
- **Rich snippets customization**
- **Pokročilá redirects management**
- **URL structure customization**
- **Breadcrumb customization**

### 19.3 Technické SEO

- **SSL zdarma** (všechny tarify)
- **HTTPS enforced**
- **Mobile responsive**
- **CDN** globally
- **Image optimization** (WebP, lazy loading)
- **Automatic image compression**
- **Minified CSS/JS**
- **Clean HTML**

### 19.4 Page speed

Shoptet performance:

- **Průměrný page load:** 2–3 sekundy
- **Lighthouse score:** 70–90 (průměr)
- **Core Web Vitals:** OK pro standard templates
- **Cloudflare CDN**
- **Caching**

### 19.5 Schema.org

**Automaticky pro:**

- **Product** (name, price, availability, rating, reviews)
- **Breadcrumb**
- **Organization**
- **Article** (blog)
- **Review** (Heureka integrace)
- **FAQ** (některé šablony)
- **LocalBusiness** (pokud máte prodejnu)

### 19.6 Redirects

- **301 redirects** manager
- **Bulk import** z CSV
- **Pattern matching** (redirect starých URL)
- Nutno po change URL

### 19.7 Sitemap

- **Auto-generated XML sitemap**
- **Indexace všech stránek**
- **Priorities a frequencies**
- Submit do Google Search Console

### 19.8 Robots.txt

- **Default** robots.txt
- **Customizable** (Business+)
- **Blokování** určitých sekcí

### 19.9 Blog

- **Native blog** v administraci
- **Categories, tags**
- **SEO per článek**
- **Rich text editor**
- **Image gallery**
- **Embed content**
- **Comments** (moderated, přes doplňky)
- **RSS feed**

### 19.10 Články a stránky

- **Custom stránky** (About, Contact, Terms)
- **CMS-like editor**
- **SEO per stránka**
- **Custom URLs**

### 19.11 SEO nástroje pro analýzu

**Přes doplňky a externí:**

- **Marketing Miner** (česká SEO platforma)
- **Collabim**
- **Ahrefs, SEMrush**
- **Google Search Console** integrace

### 19.12 Heureka SEO boost

- **Integrace s Heureka** (top pozice v Google pro produktové dotazy)
- **Heureka Reviews** na produktech (Google SERP stars)

### 19.13 Structured data pro produkty

- **Price, availability, reviews**
- **Rich snippets** v Google
- **Heureka** reviews propagation

### 19.14 Omezení SEO

- **Méně kontroly** nad URL structure (vs. WordPress)
- **Default URL patterns** (lze upravit jen s omezením)
- **Filter URL SEO** - limited canonical control
- **Technical SEO hacks** vyžadují HTML editor / partner
- **Slabší blog** než dedicated blog platformy (vs. WordPress, Squarespace)

### 19.15 AI SEO (nové 2026)

- **AI-generated meta tags** (přes doplňky)
- **AI content optimization**
- **LLM feed pro OpenAI** (2026 novinka)

---

## 20. Statistiky a reporting

### 20.1 Nativní statistiky

**Na všech tarifech:**

- **Prodeje** (dnes, týden, měsíc, rok, custom)
- **Počet objednávek**
- **Průměrná hodnota objednávky (AOV)**
- **Nejprodávanější produkty**
- **Nejprodávanější kategorie**
- **Top zákazníci**
- **Konverze**

### 20.2 Marketing statistiky

- **Zdroje návštěvnosti** (direct, organic, paid, social, referral)
- **Top referrers**
- **Kampaně performance**
- **Email open/click rates** (přes Mailchimp)
- **Slevové kódy usage**

### 20.3 Reporty návštěvnosti

- **Visitors**
- **Unique visitors**
- **Pageviews**
- **Bounce rate**
- **Conversion rate**
- **Time on site**

### 20.4 Reporty zboží

- **Bestsellers**
- **Underperformers**
- **Out of stock**
- **Low stock**
- **Marže reports** (Business+)

### 20.5 Reporty zákazníků

- **Noví vs. returning**
- **Customer LTV**
- **Top customers**
- **Customer geography**

### 20.6 Pokročilé reporty (Profi+)

- **A/B testy výsledků**
- **Cohort analysis** (limited)
- **Custom date ranges**
- **Export to CSV/XLSX**
- **Scheduled reports** (email)

### 20.7 Integrace s externími analytics

- **Google Analytics 4** (native setup)
- **Google Tag Manager**
- **Meta Pixel**
- **TikTok Pixel**
- **Pinterest Tag**
- **Microsoft Clarity** (session recording)
- **Hotjar** (přes code injection)
- **Smartlook** (česká platforma)

### 20.8 Data export

- **CSV export** reports
- **XML feeds** produktů
- **API access** (všechny statistiky přes API)

### 20.9 Dashboardy

- **Přehled v admin home**
- **Customizable widgets** (limited)
- **Quick stats**

### 20.10 Srovnání s konkurencí

| Feature          | Shoptet       | Shopify         | BigCommerce     |
| ---------------- | ------------- | --------------- | --------------- |
| Native analytics | ⭐⭐⭐⭐      | ⭐⭐⭐⭐⭐      | ⭐⭐⭐⭐⭐      |
| Custom reports   | ⭐⭐ (Profi+) | ⭐⭐⭐⭐ (Plus) | ⭐⭐⭐⭐ (Pro+) |
| GA4 integrace    | ✅            | ✅              | ✅              |
| BI tool support  | basic         | ✅              | ✅              |
| AI insights      | ❌            | ⭐⭐⭐⭐        | ⭐⭐⭐          |

---

## 21. AI v Shoptetu

Shoptet má **AI funkce slabší než Wix, Shopify, Squarespace**, ale intenzivně investuje pod novým vedením (2026).

### 21.1 Aktuální AI funkce

**Překlad produktů:**

- **AI překlad** produktů, kategorií, popisů
- Batch překlad katalogu
- Multiple jazyky
- Editovatelné po překladu

**AI pro kampaně:**

- **Automatická optimalizace Shoptet Kampaní** (nové 2026)
- AI-driven bid management
- Target ROAS optimization

**AI content (omezené):**

- Přes doplňky pro product descriptions
- ChatGPT-based generators
- Není native

### 21.2 LLM feed pro OpenAI (novinka 2026)

**Připravovaná feature:**

- **Speciální feed pro AI vyhledávače** (ChatGPT, Claude, Perplexity)
- **Waiting list** v administraci
- **Aktivuje se** jakmile OpenAI ChatGPT Commerce v EU
- Původně **Instant Checkout**, nyní **flexibilní checkout přístup**

### 21.3 AI roadmap (2026–2027)

**Shoptet strategy pod novým vedením:**

- **AI-first features** napříč produktem
- **Smart recommendations**
- **Predictive analytics**
- **AI chatbots** pro customer service
- **AI content generation** (popisky, emaily)
- **Personalized shopping experiences**

### 21.4 AI přes doplňky

**Pro pokročilejší AI features merchants používají:**

- **Chat GPT plugin** pro product descriptions
- **Jasper AI** connections
- **Copy.ai** integrations
- **AI chatbots** (Smartsupp AI, Tidio AI)
- **AI search** (přes Searchanise, Algolia)
- **AI image generation** (externí)
- **Image background remover** (apps)

### 21.5 Smartsupp AI

**Česká AI chatbot platforma**:

- Nativní integrace s Shoptet
- GPT-powered chat
- Czech/Slovak support
- Help desk functions

### 21.6 Dataweps AI

Česká platforma pro cenovou analýzu a optimalizaci:

- **AI-driven pricing**
- **Competitor monitoring**
- **Dynamic pricing**

### 21.7 Srovnání AI s konkurencí

| Platforma       | AI stack                                          |
| --------------- | ------------------------------------------------- |
| **Wix**         | ⭐⭐⭐⭐⭐ (Astro, Harmony, Vibe, Base44)         |
| **Shopify**     | ⭐⭐⭐⭐ (Sidekick)                               |
| **Squarespace** | ⭐⭐⭐⭐ (Design Intelligence, Blueprint, Beacon) |
| **BigCommerce** | ⭐⭐⭐ (Feedonomics AI)                           |
| **Shoptet**     | ⭐⭐ (základy, rozvíjí se)                        |
| **Ecwid**       | ⭐⭐                                              |

**Shoptet AI je aktuálně slabší**, ale to má změnit nové vedení.

### 21.8 AI pro obsah

**Shoptet doporučuje používat:**

- **ChatGPT** externě pro product descriptions
- **DeepL** pro překlady (kvalitnější než Google Translate pro evropské jazyky)
- **Canva AI** pro obrázky

---

## 22. Shoptet mobilní aplikace

**Shoptet spustil mobilní aplikaci v Q2 2025** (po neúspěšném prvním pokusu před lety).

### 22.1 Co aplikace umí

**Pro admin (majitele/manažery):**

- **Přehled objednávek** v real-time
- **Push notifikace** o nových objednávkách
- **Detail objednávky** (zákazník, produkty, platba)
- **Změna stavu objednávky**
- **Stornování / refund**
- **Správa zákazníků**
- **Statistiky** (prodeje, konverze)
- **Správa produktů** (editace, přidávání)
- **Notifikace stocku** (low stock alerts)

### 22.2 Platformy

- **iOS** (App Store)
- **Android** (Google Play)

### 22.3 Nové ve 2026 (Q1)

**Přidáno v jaru 2026:**

- **Řazení produktů podle stáří**
- **Zobrazení předložky "od"** u produktů s variantami cen
- **Vysvětlující obrazovky** pro nedostupné akce
- **Obecné UI vylepšení**

### 22.4 Use cases

- **Majitel na dovolené** – kontrola objednávek odkudkoliv
- **Manažer mimo kancelář** – rychlé akce
- **Personál v skladě** – potvrzování expedice
- **Push notifikace** pro kritické události

### 22.5 Omezení mobilní app

- **Ne plně zastupuje desktop admin** (některé pokročilé funkce jen v browseru)
- **Návrhář šablon** není v mobilní app
- **Některá nastavení** jen v desktop admin

### 22.6 Aplikace pro zákazníky

⚠️ **Shoptet nemá branded mobile app** pro koncové zákazníky (na rozdíl od Ecwid ShopApp).

Zákazníci používají:

- **Web verzi** (responsive)
- **Progresivní web app** (PWA) – některé šablony
- **Vlastní branded app** – jen Premium + externí dodavatel

### 22.7 Srovnání s konkurencí

| Platforma       | Admin mobile app | Customer branded app            |
| --------------- | ---------------- | ------------------------------- |
| **Shoptet**     | ✅ (Q2 2025)     | ❌ (jen Premium custom)         |
| **Shopify**     | ✅               | Shop App (universal)            |
| **Wix**         | ✅               | Wix Mobile App (limited)        |
| **BigCommerce** | ✅ (limited)     | ❌                              |
| **Squarespace** | ✅               | ❌                              |
| **Ecwid**       | ✅               | ✅ **ShopApp (Unlimited plán)** |

---

## 23. Marketplace Napojení – Allegro

**Nová klíčová feature od Q1 2026** – prodej na marketplaces přímo z administrace.

### 23.1 Co je Marketplace Napojení

**Službu Shoptet spustil 2026** jako integrovaný nástroj pro expanzi na marketplaces:

- **Nabídka produktů na Allegro** přímo ze Shoptet admin
- **Bez složitých integrací**
- **Bez zbytečné administrativy**
- **Sync produktů, cen, objednávek**

### 23.2 Allegro

**Největší polský marketplace** – kritický pro expanzi do Polska (38 milionů obyvatel, obrovský e-commerce trh).

**Co Shoptet napojení umí:**

- **Sync produktů** ze Shoptet katalogu
- **Mapping na Allegro kategorie**
- **Cena, množství, popisy**
- **Objednávky z Allegro** → Shoptet admin
- **Unified order management**
- **Automatic fulfillment**

### 23.3 Pro koho je Marketplace Napojení

**Vhodné pro:**

- **Menší e-shopy** chtějící rozšířit prodej
- **Větší hráče** pro další kanál
- **E-shopy směřující do Polska** (zásadní)
- **Nové zákazníky** z marketplace
- **Expanze do zahraničí** bez potřeby vlastního PL e-shopu

### 23.4 Umístění v administraci

- **Prodejní kanály** → Marketplace Napojení
- Nová sekce v admin menu

### 23.5 Plánovaná expanze

**Shoptet plánuje přidat:**

- **Emag** (Rumunsko, Bulharsko)
- **Vinted** (módní marketplace)
- **Glami** jako marketplace (ne jen feed)
- **Další CEE marketplaces**
- **Potenciálně Amazon, eBay** (long-term)

### 23.6 Srovnání

**Aktuálně je Shoptet Marketplace Napojení primárně pro Allegro** – v budoucnu se rozšíří.

**Konkurence pro globální marketplaces:**

- **Shopify Amazon/eBay integration** (nativní)
- **BigCommerce + Feedonomics** (1 000+ kanálů)
- **Ecwid Amazon/eBay/Walmart** (od Business plánu)

Shoptet zde dohání, ale focus na CEE marketplaces (Allegro) je **strategicky velmi dobrý** pro svoje obchodníky.

---

## 24. Shoptet Doplňky – ekosystém rozšíření

**Shoptet Doplňky** je marketplace rozšíření pro Shoptet e-shopy – podobně jako Shopify App Store nebo Wix App Market.

### 24.1 Přehled

- **~400+ doplňků** ve 2026
- **Zdarma i placené**
- **Oficiální + partner**
- **Instalace přes administraci**
- URL: `doplnky.shoptet.cz`

### 24.2 Kategorie doplňků

**Platby:**

- **Shoptet Pay** (vlastní)
- **GoPay+**
- **ComGate**
- **ThePay**
- **PayPal**
- **Twisto** (BNPL)
- **Skip Pay** (BNPL)
- **Home Credit** (splátky)
- **Mollie**

**Doprava a logistika:**

- **Shoptet Balíky** (vlastní)
- **Balíkobot** (historicky dominant)
- **Zásilkovna** (nativní)
- **Česká pošta Balík do ruky / Balíkovna**
- **PPL Parcel**
- **DPD**
- **GLS**
- **DHL Express**
- **Gebrüder Weiss**

**Marketing a reklama:**

- **Ecomail** (česká email marketing)
- **Mailchimp**
- **SmartEmailing**
- **Klaviyo**
- **Smartsupp** (chat + AI)
- **Dognet** (affiliate)
- **Collabim** (SEO)
- **Marketing Miner**
- **Dataweps** (pricing)

**Účetnictví:**

- **Pohoda**
- **Money S3**
- **FlexiBee**
- **ABRA**
- **iDoklad**
- **Fakturoid**
- **Premier**
- **Stormware**

**Srovnávače a feedy:**

- **Heureka doplňky**
- **Zboží.cz**
- **Google Shopping**
- **Glami**
- **Pricemania**

**Produktivita:**

- **Bulk importy**
- **Skladové systémy**
- **CSV/XML managers**
- **Inventura**

**Design a vzhled:**

- **Šablony** od externích dodavatelů
- **Banner creators**
- **Pop-ups**

**Analytika:**

- **Google Analytics helpers**
- **Heatmaps (Smartlook, Hotjar)**
- **Conversion tracking**

**AI:**

- **Smartsupp AI**
- **ChatGPT integrace**
- **AI překlad**

**Mezinárodní:**

- **Překladače**
- **Multi-currency tools**
- **Mezinárodní dopravci**

**Dropshipping:**

- **Syncee**
- **BigBuy**
- **eMAG dropshipping**

**Zákaznická podpora:**

- **LiveAgent**
- **Daktela**
- **Zendesk**
- **Smartsupp**

**Fulfillment:**

- **Shipmonk**
- **3PL partnerské služby**
- **Warehouse systems**

### 24.3 Cena doplňků

**Spektrum cen:**

- **Zdarma** (mnohé základní)
- **0–500 Kč/měs.** (většina)
- **500–2 000 Kč/měs.** (pokročilejší)
- **2 000+ Kč/měs.** (enterprise tools)
- **One-time** (některé)
- **Transaction-based** (brány, dopravci)

### 24.4 Populární doplňky

**TOP adoption:**

1. **Shoptet Pay** (platby)
2. **Zásilkovna** (doprava)
3. **Heureka** (marketing)
4. **Shoptet Balíky** (logistika)
5. **GoPay** (platby)
6. **Ecomail** (email marketing)
7. **Balíkobot** (doprava legacy)
8. **Smartsupp** (chat)
9. **Mailchimp** (email)
10. **Pohoda** (účetnictví)

### 24.5 Instalace doplňku

**Workflow:**

1. V administraci otevřete **Doplňky**
2. Vyberte doplněk z marketplace
3. Klikněte **Instalovat**
4. Autorizujete propojení (OAuth)
5. Nakonfigurujete nastavení
6. Doplněk je aktivní

### 24.6 Kvalita doplňků

**Variabilní kvalita:**

- **Oficiální doplňky** (od Shoptet) – vysoká kvalita
- **Partner doplňky** (certifikovaní partneři) – dobrá kvalita
- **Community doplňky** – variabilní
- **Hodnocení a recenze** od merchants

### 24.7 Custom doplňky

**Pro vývojáře:**

- Můžete vytvořit vlastní doplněk
- **Shoptet Developer Tools**
- Distribuce přes oficiální marketplace (s approval)
- Private apps pro single store

### 24.8 Srovnání s konkurencí

| Platforma       | Počet apps/doplňků |
| --------------- | ------------------ |
| **Shopify**     | 8 000+             |
| **BigCommerce** | ~1 000             |
| **Wix**         | ~500               |
| **Shoptet**     | **~400+**          |
| **Ecwid**       | ~200               |
| **Squarespace** | 50–80              |

### 24.9 Nejčastější problémy

- **Placené doplňky navýší celkovou cenu** (TCO může být 2-3x tarif)
- **Ne vždy kompatibilní** s všemi šablonami
- **Po změně tarifu** některé funkce mohou zmizet
- **Integration problems** mezi doplňky občas

---

## 25. API a developerská platforma

### 25.1 Shoptet API

**REST API:**

- **developer.shoptet.cz** docs
- **OAuth 2.0** autentikace
- **JSON responses**
- **Standardní HTTP methods** (GET, POST, PUT, DELETE)

### 25.2 Hlavní endpointy

- **Orders** (čtení, vytvoření, update)
- **Products** (CRUD)
- **Categories**
- **Customers**
- **Stocks**
- **Invoices**
- **Statistics**
- **Settings**

### 25.3 Webhooks

- **Order created**
- **Order updated**
- **Product created/updated**
- **Customer created**
- **Stock changed**
- HMAC signature verifikace

### 25.4 Rate limits

- Různé limits per tarif
- **Enterprise+** má výrazně vyšší limity
- Typicky **1 request/s** default

### 25.5 Shoptet Developer Tools

- **Sandbox environment**
- **Test obchody**
- **API playground**
- **Documentation**

### 25.6 Vývoj šablon

- **Twig templating** language
- **SCSS/CSS** styling
- **JavaScript** framework (vanilla + některé libraries)
- **HTML editor** v administraci
- **Shoptet Developer Tools** pro local development

### 25.7 Custom doplňky

- **Partner developer program**
- **Marketplace distribuce**
- **OAuth flow**
- **API access**
- **Review process** od Shoptet

### 25.8 Omezení developer platformy

- **Menší komunita** než Shopify, WooCommerce
- **Čeština/slovenština** většina docs
- **Angličtina docs** limited
- **Žádná oficiální SDK** (REST API přímo)
- **Žádné GraphQL**
- **Žádné real-time subscriptions**

### 25.9 Headless commerce

⚠️ **Shoptet Basic/Business/Profi/Enterprise nepodporují plné headless commerce**.

**Pouze Shoptet Premium:**

- **Otevřené REST API**
- **Vlastní storefront možnost**
- **Custom integrace**
- **Vlastní checkout**
- Typicky přes Next.js / React / Vue

### 25.10 Integrace přes Zapier / Make

- **Zapier** – tisíce apps
- **Make** (Integromat) – lokální oblíbená
- **n8n** (open-source)
- **Automatizace** workflow

---

## 26. Shoptet Premium – řešení na míru

**Shoptet Premium** je enterprise tier pro obchody s pokročilými požadavky.

### 26.1 Co je Shoptet Premium

- **Řešení na míru**
- **Dedicated account manager** ve vašem jazyce
- **Custom development**
- **Open REST API**
- **Headless commerce** možné
- **Bez limitů produktů**
- **Bez limitů objednávek**
- **Custom šablony**
- **Custom funkce**

### 26.2 Cena

- **Individuální**
- Typicky **10 000 – 100 000+ Kč/měs.**
- Platba ročně nebo pololetně
- Custom kontrakt
- Bez GMV capů

### 26.3 Pro koho

**Shoptet Premium vhodné pro:**

- **Velké e-shopy** (50 000+ produktů)
- **Multi-brand retailers**
- **B2B dominant obchody**
- **Přeshraniční obchody** (více zemí, měn, jazyků)
- **Obchody s custom requirements**
- **Obchody s vysokými requirements na performance**
- **Enterprise značky**

### 26.4 Features Premium

**Všechno z Enterprise +:**

- **Custom development** (hodiny zahrnuty)
- **Custom design / UX**
- **Custom integrace**
- **Headless commerce** support
- **Priority development** (nové features first)
- **Dedicated infrastructure** (dle potřeby)
- **Custom SLA**
- **Dedicated staging environment**
- **Priority 24/7 support**

### 26.5 Shoptet Premium partneři

**Spolupráce s certifikovanými partnery:**

- **Vývojáři na míru**
- **UX/UI designéři**
- **Marketing specialisté**
- **Migrace specialisté**

### 26.6 Use cases Shoptet Premium

**Příklady:**

- **Alza-like** e-shop (velké katalogy, multi-kategorie)
- **Luxusní značka** s custom design
- **B2B velkoobchod** s komplexní price logic
- **Omnichannel** (online + desítky prodejen)
- **Multi-brand skupina** (více e-shopů pod jednou společností)
- **International** (ČR + SR + PL + HU + RO + BG)

### 26.7 Srovnání

| Feature            | Enterprise | Shoptet Premium |
| ------------------ | ---------- | --------------- |
| Max produkty       | 50 000     | ∞               |
| Custom development | limited    | ✅ zahrnuto     |
| Headless           | ❌         | ✅              |
| Custom design      | šablony    | ✅ na míru      |
| Dedicated manager  | limited    | ✅              |
| Priority support   | ✅         | ✅ 24/7         |
| Custom SLA         | ❌         | ✅              |
| Custom API limits  | ❌         | ✅              |
| Multi-currency     | ✅         | ✅              |
| Multi-language     | ✅         | ✅              |

### 26.8 Srovnání s konkurencí

| Platforma       | Enterprise solution    |
| --------------- | ---------------------- |
| **Shoptet**     | Shoptet Premium        |
| **Shopify**     | Shopify Plus           |
| **BigCommerce** | BigCommerce Enterprise |
| **Wix**         | Wix Enterprise         |
| **Squarespace** | Squarespace Enterprise |

**Shoptet Premium je konkurenční alternativa** pro CZ/SK merchants, kteří nechtějí migrovat na drahý Shopify Plus.

---

## 27. Bezpečnost a infrastruktura

### 27.1 Hosting

- **Cloud-based** (SaaS)
- **Datacentra v EU** (primárně)
- **Global CDN** (Cloudflare)
- **Auto-scaling**
- **99,9%+ uptime SLA**

### 27.2 Performance

- **Průměrný page load:** 2–3 sekundy
- **Cloudflare caching**
- **Image optimization** (WebP, lazy loading)
- **Minified assets**
- **HTTP/2**

### 27.3 SSL

- **Zdarma SSL** (Let's Encrypt) na všech tarifech
- **Automatic renewal**
- **HTTPS enforced**
- **Custom SSL** (Pro+ via domain)

### 27.4 Bezpečnost

- **DDoS protection** (Cloudflare)
- **WAF (Web Application Firewall)**
- **Rate limiting**
- **Bot detection**

### 27.5 Zálohy

- **Automatické denní zálohy**
- **Retention:** 30 dní
- **Point-in-time restore** (limited)
- **Manual backup download** via API

### 27.6 PCI compliance

- **PCI DSS** compliant
- **Tokenizace karet** přes brány
- **Žádné uložené karty** v Shoptet
- **Merchant offloaded** PCI

### 27.7 GDPR

- **Plně GDPR-compliant**
- **Data processing agreement** k dispozici
- **Customer consent** management
- **Data export / erasure** tools

### 27.8 2FA

- **Dvoufaktorové ověření** pro admin
- **TOTP** (Google Authenticator, Authy)
- **SMS** (nové 2025)
- Povinné pro některé role

### 27.9 Audit log

- **Aktivity administrátorů**
- **Změny produktů, cen, objednávek**
- **Login history**
- **IP tracking**

### 27.10 Certifikace

- **PCI DSS**
- **GDPR compliant**
- **ISO 27001** (částečně)
- **Česká certifikace** kyber bezpečnosti

### 27.11 Status page

- **status.shoptet.cz**
- Real-time incident tracking
- Historical uptime
- Email notifications

### 27.12 Bezpečnostní novinky

- **PCI 4.0 compliance** (nové 2025)
- **Updated TLS** (minimum TLS 1.2, preference 1.3)
- **Cookie consent** v souladu s e-Privacy

### 27.13 Omezení

- **Žádné SOC 2 Type II** nativně (Shopify má)
- **Žádné HIPAA** support
- **Žádné enterprise SLA** na standard tarifech (jen Premium)

---

## 28. Podpora a vzdělávání

### 28.1 Podpora tier

| Tarif          | Support                           |
| -------------- | --------------------------------- |
| **Free**       | Help center + email               |
| **Basic**      | Email + chat                      |
| **Business**   | Email + chat + telefon            |
| **Profi**      | Priority email + chat + telefon   |
| **Enterprise** | Priority 24/7 + manager (limited) |
| **Premium**    | Dedicated account manager 24/7    |

### 28.2 Podpora v češtině

- **100% česká a slovenská podpora** ✅
- Na rozdíl od Shopify, Wix, Squarespace, Ecwid, BigCommerce
- **Rodilí mluvčí**
- Rychlá odezva
- Znalost české legislativy

### 28.3 Kontakt

- **Email:** info@shoptet.cz
- **Telefon:** 420 488 991 111 (Business+)
- **Chat:** v administraci
- **Facebook skupina:** Shoptet Poradna (20 000+ členů)

### 28.4 Help Center

- **podpora.shoptet.cz**
- Tisíce článků v češtině
- Video tutorials
- Step-by-step guides
- Searchable

### 28.5 Shoptet Blog

- **blog.shoptet.cz**
- Produktové novinky
- Marketing tipy
- Success stories
- Czech e-commerce insights

### 28.6 Shoptet Univerzita (vzdělávání)

- **Online kurzy**
- **Zdarma**
- Pro začátečníky i pokročilé
- Certifikace (limited)

### 28.7 Shoptet Expo

**Největší e-commerce konference v ČR.**

- Každoročně (Praha)
- Tisíce účastníků
- Produktové novinky
- Networking
- Vzdělávací workshopy
- Partnerství s e-commerce komunitou

### 28.8 Webináře a školení

- **Pravidelné webináře** (zdarma)
- **Workshopy** pro začátečníky
- **Pokročilé kurzy** pro zkušené merchants
- **Partnerská školení** pro vývojáře

### 28.9 Shoptet Poradna

**Facebook skupina (20 000+ členů):**

- Peer support
- Oficiální Shoptet přítomnost
- Diskuze o produktu
- Sharing best practices
- Velmi aktivní česká komunita

### 28.10 Partner program

**Shoptet Partneři:**

- **Stovky agentur/freelancerů**
- **Shoptet Certifikovaní partneři** (vyšší tier)
- **Specializace** (design, marketing, development)
- **Directory** na shoptet.cz
- Možnost pronajmout experta pro váš projekt

### 28.11 Komunita

- **Facebook Shoptet Poradna**
- **LinkedIn Shoptet síť**
- **Shoptet Expo**
- **Lokální meetupy**
- **České e-commerce fórum**

### 28.12 Srovnání podpory

| Platforma       | CZ/SK podpora         | Community           |
| --------------- | --------------------- | ------------------- |
| **Shoptet**     | ⭐⭐⭐⭐⭐ native     | ⭐⭐⭐⭐⭐ obrovská |
| **Shopify**     | ⭐⭐ (EN, partial CS) | ⭐⭐⭐              |
| **Wix**         | ⭐⭐ (EN)             | ⭐⭐                |
| **Ecwid**       | ⭐ (EN)               | ⭐                  |
| **Squarespace** | ⭐ (EN)               | ⭐                  |

**V ČR je Shoptet support a community jednoznačně nejlepší.**

---

## 29. Známá omezení a nevýhody

### 29.1 Design omezení

- **Málo šablon** (32 oficiálních) vs. Wix 2 500+, Squarespace 200+, Shopify 200+
- **Šablony vypadají podobně** (konzervativnější design)
- **Návrhář šablon omezený** vs. Wix Editor / Squarespace Fluid Engine
- **Pro advanced design** nutno najmout partnera (10–100k Kč)
- **Mobile customization** omezená (automatic responsive)

### 29.2 Funkční omezení

- **Mnoho funkcí za paywall** (rozšiřující doplňky = extra náklady)
- **TCO (total cost of ownership)** se zvyšuje s doplňky
- **Placené doplňky** mohou měsíčně přesáhnout cenu samotného tarifu
- **Některé základní funkce** až ve vyšších tarifech (multi-language jen Profi+)

### 29.3 AI omezení

- **Slabší AI** než Wix, Squarespace, Shopify
- **Žádný conversational AI assistant**
- **Žádný AI website builder**
- **Minimal AI content generation** nativně
- **Rozvoj AI** teprve postupuje pod novým vedením

### 29.4 Mezinárodní omezení

- **Primárně CZ/SK/střední Evropa**
- **Slabší pro USA, UK, západní Evropu**
- **Multi-currency až od Enterprise**
- **Multi-language až od Profi**
- **Méně globálních platebních metod** (Afterpay US, Klarna globální)
- **Limited globální marketplaces** (jen Allegro, zatím)

### 29.5 Headless omezení

- **Žádné headless nativně** (jen Shoptet Premium)
- **Bez Next.js / Hydrogen / Catalyst equivalent**
- **Frontend uzamčený** na Shoptet šablony (kromě Premium)

### 29.6 Developer platforma

- **Menší komunita** než Shopify, WooCommerce
- **Omezená EN dokumentace**
- **Žádná oficiální SDK**
- **Žádné GraphQL**
- **Méně třetích stran tools**

### 29.7 Scalability

- **Enterprise limit 50 000 produktů** (více jen Premium)
- **Admin zpomaluje** při velkých katalozích
- **Pro enterprise obchody** nutno Premium (vysoká cena)

### 29.8 Mezinárodní expanze

Pokud chcete **prodávat v USA, Austrálii, Japonsku, LATAM**:

- **Shoptet je horší volba** než Shopify
- Chybí lokální integrace, měny, jazyky, dopravci, brány
- Shoptet se soustředí na CEE

### 29.9 Povinný upgrade

- **Produktový limit** nutí upgrade (100 → 1 000 → 5 000 → 50 000)
- Při překročení nelze přidávat produkty
- **Tarif-based pricing** (ne usage-based) – méně flexibilní pro seasonal

### 29.10 Performance

- **Průměrný page speed** (2–3 s)
- **Ne tak rychlé** jako Shopify (custom Hydrogen) nebo BigCommerce (Catalyst headless)
- **Závislost na CDN** (Cloudflare)

### 29.11 Specifika pro zahraniční trh

⚠️ **Pokud chcete prodávat globálně, Shoptet není ideální:**

- Chybí kanály pro velké zahraniční marketplaces (Amazon, eBay, Walmart) – zatím jen Allegro
- Chybí globální lokalizace (Shopify Markets je lepší)
- Limited USA/UK integrations

### 29.12 Lock-in

- **Export produktů / zákazníků** OK (CSV)
- **Export designu / šablon** obtížný
- **Migration na jinou platformu** vyžaduje hodně práce
- **Lokální integrace (Heureka, Shoptet Pay)** nepřenosné

### 29.13 Nové vedení / akvizice

- **Akvizice belgickou firmou (2025)** přináší nejistotu
- **Nová strategie** se postupně formuluje
- **Některé změny v cenách** (zdražení 2025)
- **Rozvoj AI** teprve rozbíhá

---

## Závěr

Shoptet je **jednoznačný lídr české e-commerce scény** s dominantním tržním podílem (~25-28%). V oblasti lokalizace pro český a slovenský trh nemá konkurenci – žádná globální platforma (Shopify, Wix, BigCommerce, Squarespace, Ecwid) nenabízí takové pokrytí českých specifik.

### Silné stránky

- **#1 pro český a slovenský trh**
- **Nativní integrace na vše české:** Zásilkovna, ČP, PPL, DPD, GLS, GoPay, ComGate, ThePay, Heureka, Zboží.cz, Pohoda, Money, FlexiBee
- **ARES validace IČO** automatic
- **České faktury, DPH, DUZP, dobropisy** správně
- **Recyklační příspěvky** (EKO-KOM, ASEKOL)
- **100% česká podpora** (e-mail, chat, telefon)
- **Obrovská česká komunita** (20 000+ Shoptet Poradna, stovky partnerů)
- **Shoptet Pay** (platby bez měsíčního poplatku)
- **Shoptet Balíky** (integrovaná logistika)
- **Shoptet Kampaně** (Google Ads v admin)
- **Free tarif** (10 produktů navždy)
- **Nejoblíbenější platforma mezi českými e-shopy**
- **Mobilní aplikace** (Q2 2025)
- **Marketplace Napojení** – Allegro (2026)

### Slabé stránky

- **Méně šablon** (32 vs. Wix 2 500+)
- **Designově konzervativnější**
- **AI funkce slabší** než globální konkurence (Wix, Shopify)
- **Mezinárodní prodej slabší** (primárně CEE)
- **Headless jen v Premium** (vysoká cena)
- **Placené doplňky navyšují TCO**
- **Multi-language jen od Profi**
- **Multi-currency jen od Enterprise**
- **Limited global marketplaces** (zatím jen Allegro)
- **Menší developer komunita**

### Pro koho se Shoptet hodí

✅ **Ideální pro:**

- **Jakýkoliv český e-shop** (malý i střední)
- **Slovenské e-shopy**
- **Středoevropské obchody** (PL, HU, RO, BG)
- **Obchody potřebující Zásilkovnu, GoPay, Heureku** (vše nativně)
- **Obchody s Pohodou / Money / FlexiBee** účetnictvím
- **Začínající podnikatele** (Free tarif)
- **Střední obchody 1 000–50 000 produktů**
- **B2B + B2C hybrid obchody**
- **Obchody v CZ/SK obchodním prostředí**

### Pro koho méně

❌ **Méně vhodné pro:**

- **Obchody cílící primárně na USA, UK, západní Evropu**
- **Design-first brands** (Wix, Squarespace lepší)
- **Enterprise obchody s custom infrastrukturou** (Shopify Plus vhodnější, ale dražší)
- **Multi-country globální obchody** (Shopify Markets lepší)
- **Headless commerce projekty** (BigCommerce Catalyst, Shopify Hydrogen)
- **Obchody s 50 000+ produkty bez speciálního rozpočtu** (nutno Premium)
- **AI-first startupy** (Wix lepší)

### Shrnutí v kontextu ČR

**Shoptet je bezkonkurenční volba pro většinu českých e-shopů.** Důvody:

1. **Lokální ekosystém** – nativní integrace na všechny české služby
2. **Česká podpora** – rodilí mluvčí, rychlá odezva
3. **Komunita** – stovky agentur, desítky tisíc merchants, Shoptet Poradna
4. **Legislativa** – DPH, DUZP, dobropisy, ARES, EET historicky
5. **Cena** – konkurenční pro ČR (v Kč, bez currency rizika)
6. **Scalability** – od free tarif až po Premium pro enterprise

**Ostatní platformy (Shopify, Wix, Squarespace, BigCommerce, Ecwid) v ČR ztrácejí** protože:

- Chybí nativní integrace
- Drahé customizace
- Anglická podpora
- Malá česká komunita
- Překlad / lokalizace nejsou 100%

### Kdy zvolit Shoptet nad jinými

**Shoptet vs. Shopify:**

- **Shoptet** pokud primárně CZ/SK zákazníci, potřebujete Heureku/Zásilkovnu/GoPay nativně, chcete českou podporu
- **Shopify** pokud globální ambice, USA/UK/international obchod, potřebujete pokročilejší ekosystém (8 000+ apps)

**Shoptet vs. Wix / Squarespace:**

- **Shoptet** pro skutečný e-shop s českými integracemi
- **Wix/Squarespace** pro design-first projekty (portfolio, creative, malý ecommerce)

**Shoptet vs. WooCommerce:**

- **Shoptet** pokud chcete hotové SaaS řešení, žádná správa hostingu, okamžitý start
- **WooCommerce** pokud máte WordPress developera, chcete plnou kontrolu, open-source, nižší dlouhodobé náklady pro velké obchody

**Shoptet vs. Upgates:**

- **Shoptet** největší komunita, nejvíce integrace, zavedená značka
- **Upgates** modernější design, rychlejší development některých funkcí, konkurenční cena

**Shoptet vs. Eshop-rychle:**

- **Shoptet** pokročilejší funkce, větší ekosystém, lepší škálování
- **Eshop-rychle** jednodušší pro začátečníky, více šablon, nižší vstupní cena

### Shoptet Premium vs. Shopify Plus

- **Shoptet Premium** pokud CEE fokus, potřebujete CZ/SK dedicated support, nižší cena
- **Shopify Plus** pokud globální ambice, pokročilý B2B, bigger ecosystem

### Závěrečné doporučení

**Pokud máte e-shop cílící primárně na český (a slovenský) trh, Shoptet je skoro vždy nejlepší volba.** Kombinace lokálních integrací, české podpory, komunity a konkurenčních cen je nepřekonatelná žádnou globální platformou.

**Pouze v případě, že:**

- Chcete skutečně globální obchod (Shopify)
- Potřebujete headless architekturu (BigCommerce, Shopify Hydrogen)
- Máte design-first brand bez komplexních e-commerce potřeb (Wix, Squarespace)
- Jste hobby/small (Ecwid Free)

...zvážte jinou platformu. Pro klasický český e-shop s české zákazníky Shoptet vyhrává.

---

### Srovnání všech 6 platforem

| Kritérium                 | Shopify               | Wix             | Squarespace  | BigCommerce              | Ecwid         | **Shoptet**            |
| ------------------------- | --------------------- | --------------- | ------------ | ------------------------ | ------------- | ---------------------- |
| **Cena (entry)**          | 29 USD                | 17 USD          | 16 USD       | 29 USD                   | 0 USD (Free)  | 0 Kč (Free)            |
| **Free plán**             | ❌ (trial)            | ✅              | ❌           | ❌                       | ✅ (10 prod.) | **✅ (10 prod.)**      |
| **CZ lokalizace**         | ⭐⭐⭐                | ⭐⭐⭐          | ⭐⭐         | ⭐                       | ⭐⭐          | **⭐⭐⭐⭐⭐**         |
| **Heureka/Zboží native**  | ❌                    | ❌              | ❌           | ❌                       | ❌            | **✅**                 |
| **Zásilkovna native**     | ❌                    | ❌              | ❌           | ❌                       | ❌            | **✅**                 |
| **GoPay/ComGate native**  | ❌                    | ❌              | ❌           | ❌                       | ❌            | **✅**                 |
| **Pohoda/Money native**   | ❌                    | ❌              | ❌           | ❌                       | ❌            | **✅**                 |
| **ARES validace**         | ❌                    | ❌              | ❌           | ❌                       | ❌            | **✅**                 |
| **České DPH/DUZP**        | ⭐⭐                  | ⭐⭐            | ⭐           | ⭐⭐                     | ⭐⭐          | **⭐⭐⭐⭐⭐**         |
| **CZ podpora**            | ⭐⭐                  | ⭐⭐            | ⭐           | ⭐                       | ⭐            | **⭐⭐⭐⭐⭐**         |
| **Design freedom**        | ⭐⭐⭐                | ⭐⭐⭐⭐⭐      | ⭐⭐⭐⭐     | ⭐⭐                     | ⭐            | ⭐⭐⭐                 |
| **Templates count**       | 200+                  | 2 500+          | 200+         | 100+                     | 15            | 32                     |
| **App/doplňky ecosystem** | ⭐⭐⭐⭐⭐ (8k+)      | ⭐⭐⭐ (500)    | ⭐⭐ (50-80) | ⭐⭐⭐ (1k)              | ⭐⭐ (200)    | ⭐⭐⭐ (400+)          |
| **AI**                    | ⭐⭐⭐⭐              | ⭐⭐⭐⭐⭐      | ⭐⭐⭐⭐     | ⭐⭐⭐                   | ⭐⭐          | ⭐⭐                   |
| **B2B**                   | ⭐⭐⭐⭐ (Plus)       | ⭐⭐            | ⭐           | ⭐⭐⭐⭐⭐               | ⭐⭐          | ⭐⭐⭐                 |
| **Multi-currency**        | ⭐⭐⭐⭐⭐            | ⭐⭐⭐⭐        | ⭐           | ⭐⭐⭐⭐                 | ⭐⭐          | ⭐⭐⭐                 |
| **Multi-language**        | ⭐⭐⭐⭐⭐            | ⭐⭐⭐⭐        | ⭐⭐         | ⭐⭐⭐                   | ⭐⭐⭐        | ⭐⭐⭐⭐               |
| **Headless**              | ⭐⭐⭐⭐⭐ (Hydrogen) | ⭐⭐⭐⭐ (Vibe) | ⭐           | ⭐⭐⭐⭐⭐ (Catalyst)    | ⭐            | ⭐⭐ (Premium)         |
| **POS**                   | ⭐⭐⭐⭐⭐ (global)   | ⭐⭐⭐          | ⭐⭐         | ⭐⭐⭐                   | ⭐⭐⭐⭐      | ⭐⭐⭐                 |
| **Marketplaces**          | ⭐⭐⭐⭐              | ⭐⭐⭐          | ⭐⭐         | ⭐⭐⭐⭐⭐ (Feedonomics) | ⭐⭐⭐        | ⭐⭐⭐ (Allegro 2026+) |
| **Pro CZ e-shop**         | ⭐⭐⭐                | ⭐⭐⭐          | ⭐⭐         | ⭐                       | ⭐⭐          | **⭐⭐⭐⭐⭐**         |
| **Overall positioning**   | #1 global             | All-in-one AI   | Design-first | B2B / Mid-market         | Embed widget  | **#1 ČR/SR**           |

---

_Dokument sestaven na základě oficiální dokumentace Shoptet (shoptet.cz, podpora.shoptet.cz, blog.shoptet.cz, doplnky.shoptet.cz, developer.shoptet.cz), Shoptet produktových novinek 2025/2026, akvizičních oznámení 2025, nezávislých recenzí (5nej.cz, aicko.cz, nastrojeproweb.cz, vybrat-eshop.cz, eshopradar.cz) – duben 2026._
