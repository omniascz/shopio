# Gap analýza Shopio vs. konkurence — fokus CZ/SK/PL

> **Stav:** 2026-06-08 · **Metoda:** feature matice z 8 hloubkových analýz (Shoptet, Upgates, Shopify, BigCommerce, Ecwid, Squarespace, Wix, Shopware) × inventura reálného kódu Shopia (routes/schema/admin).
> **Cíl:** co mají největší a nejlepší hráči, co Shopio (ne)umí, a co se vyplatí dodělat pro dominantní trh **CZ/SK/PL**.

---

## 0. Sebereflexe — co jsem dotáhl mimo cíl

Na dřívější pokyn „pokracuj dach, uk, fr" jsem přidal věci, které pro CZ/SK/PL trh nemají hodnotu:

- **Alma** (platební brána) — čistě FR BNPL, v CZ/SK/PL nepůsobí → balast.
- **Mondial Relay, Colissimo, Chronopost** (FR), **Royal Mail, Evri** (UK), **Hermes** (DE) — dopravci mimo region.
- **Klarna** — okrajově relevantní (roste v PL/CZ), ale ne dominantní.

Naopak **správně regionálně**: Przelewy24 + TrustPay + InPost (PL/SK), Zásilkovna/PPL/DPD/ČP/Balíkovna/GLS katalog, GoPay/ComGate/ThePay/Pays/GPwebpay + QR platba + dobírka (CZ).

**Doporučení:** FR/UK brány a dopravce nechat zaparkované (kód neškodí, ale neinvestovat), prioritu dát níže uvedeným CZ/SK/PL věcem.

---

## 1. Kde je Shopio už SILNÉ (parita nebo lépe — NESTAVĚT znovu)

| Oblast | Stav Shopia | Srovnání |
|---|---|---|
| **Platební brány** | 20 kódů: GoPay, ComGate, ThePay, Pays, GPwebpay, PayU, Barion, Besteron, Stripe, PayPal, Przelewy24, TrustPay, Twisto + dobírka, převod, **QR platba**, gift_card | **Lepší než Shopify/BigCommerce pro CZ** (ti nemají nativní GoPay/ComGate/QR/dobírku). Na úrovni Shoptet/Upgates. |
| **Feedy** | Heureka, Zboží.cz, Glami, Google Shopping, **Ceneo.pl**, **AI/agentic feed** | Parita s CZ leadery + navíc AI feed (2026 trend), který Shoptet teprve plánuje. |
| **Gift cards + loyalty/store-credit** | Nativní (ledger, tender nemění VAT base) | **Lepší než Shopify/BigCommerce** (ti jen přes placené appky). |
| **Předplatné** | Nativní (bez auto-charge) | Shopify/BC jen přes apps. |
| **Faktury + účetnictví** | ISDOC 6.0.1 + PDF + Pohoda XML export, bezmezerové číslování, DUZP | Parita s CZ leadery (Pohoda). |
| **Bundly, varianty, kategorie (ltree)** | Plně | Parita. |
| **Developer platforma** | API klíče + outbound webhooky (HMAC) + **OAuth 2.0 apps + marketplace** | **Lepší než Shoptet/Upgates** (ti nemají OAuth apps marketplace; Upgates API je dokonce placené). |
| **RLS multi-tenancy + GDPR + master-admin** | Plně (Postgres RLS, export/erasure, platform tooling) | Nad rámec CZ leaderů. |
| **B2B-lite** | Companies + IČO/DIČ + NET terms (platba na fakturu) | Základ hotový. |

→ **Závěr:** jádro commerce + CZ platby/feedy/faktury/věrnost je hotové a konkurenceschopné. Nepřestavovat. Energie patří do mezer níže.

---

## 2. P0 — CZ/SK/PL adopční blockery (nejvyšší priorita)

Tohle mají Shoptet i Upgates nativně a **bez toho s nimi v regionu nesoupeříme**:

| # | Mezera | Co chybí konkrétně | Proč P0 | Náročnost |
|---|---|---|---|---|
| 1 | **Reální dopravci CZ** | PPL, DPD, Česká pošta, Balíkovna, GLS jsou jen „label-only" katalog — žádné reálné API (štítky/tracking/výdejní místa). Reálně máme jen Zásilkovnu + InPost. | Dopravci jsou #1 důvod, proč si CZ prodejce vybere platformu. Bez nativního PPL/DPD/ČP jsme nepoužitelní pro většinu. | Vysoká (per-dopravce API jako Packeta) |
| 2 | **ARES validace IČO/DIČ** | Ověř, zda existuje auto-načtení firmy z ARES při B2B registraci/checkoutu (inventura nepotvrdila). SK ekvivalent = ORIS/RÚZ. | Standard CZ B2B; bez toho ruční opis údajů. Levné, vysoká vnímaná hodnota. | Nízká (veřejné ARES API) |
| 3 | **Recyklační příspěvky** | EKO-KOM / ASEKOL / ELEKTROWIN / ECOBAT — auto výpočet + evidence na faktuře + report. | Zákonná povinnost pro elektro/obaly v ČR. | Střední |
| 4 | **EU B2B daně** | Reverse charge + **VIES** validace DIČ, **OSS/MOSS** pro přeshraniční EU prodej. | Nutné pro SK/PL/EU expanzi a B2B. Dnes reverse-charge „deferred". | Střední |
| 5 | **Účetní konektory** | Jen Pohoda XML export. Chybí **iDoklad, Fakturoid** (SaaS, API-friendly), Money S3, ABRA, FlexiBee. | Ne každý CZ prodejce má Pohodu; Fakturoid/iDoklad jsou u malých nejčastější. | Nízká–střední (iDoklad/Fakturoid mají REST API) |
| 6 | **Heureka Ověřeno + Košík** | Heureka „Ověřeno zákazníky" (verified reviews API) + Heureka/Zboží **Košík** (checkout na srovnávači). | Heureka = 40–60 % objednávek CZ e-shopů. Recenze + Košík jsou velký konverzní/akviziční kanál. | Střední |
| 7 | **Zákaznický return portál** | Máme admin RMA, ale chybí self-service vrácení z účtu zákazníka. | Shoptet/Upgates i Shopify/BC to mají; snižuje zátěž podpory. | Nízká (logika RMA hotová, jen storefront UI + endpoint) |

---

## 3. P1 — Multi-currency (strategický odemykač SK/PL)

- **Dnes:** Shopio je **jednoměnové per tenant** (cart/objednávka dědí `tenant.defaultCurrency`). Žádné FX, žádná presentment currency.
- **Problém:** SK trh = EUR, PL trh = PLN. Bez multi-currency neumíme jeden e-shop prodávající do CZ (CZK) i SK (EUR) i PL (PLN) — a to je celý smysl „CZ/SK/PL dominantní trh".
- **Co postavit:** presentment currency + **ČNB kurzy** (auto, jako Shoptet/Upgates) + rounding rules + currency switcher; ceny buď přepočtem nebo manuální per-měna.
- **Náročnost:** vysoká (dotýká se pricing/tax/checkout/feedů), ale **strategicky nejdůležitější jeden kus** pro deklarovaný trh. Shopify/BC to mají jako samozřejmost.

---

## 4. P2 — Best-in-class konverzní featury (přenositelné na SME)

Co mají nejlepší globální hráči a přímo zvedá tržbu; všechno realistické pro malého CZ/SK/PL prodejce:

| Featura | Kdo to má nejlépe | Stav Shopia | Hodnota |
|---|---|---|---|
| **Automatické slevy (no-code) + BOGO/BXGY** | Shopify, BigCommerce | Jen kupóny (manuální kód); chybí auto-slevy a „1+1 zdarma" | Nejúčinnější promo mechaniky; přímý dopad na AOV |
| **Express checkout: Apple/Google Pay + uložené karty (1-click)** | Shopify (Shop Pay), BC (tokenized cards) | Máme express přes uloženou adresu, ale **ne saved payment methods ani wallet buttons** | ~15 % vyšší konverze; klíčové pro returning customers |
| **Product recommendations** (frequently bought together, related, recently viewed) | obě globální | Chybí (máme jen related přes kategorie?) | Cross-sell, vyšší AOV |
| **Semantic / AI search** | Shopify, BC, Wix | Máme Meili facety + ILIKE fallback, ale ne sémantické | Lepší findability, méně zero-result |
| **Server-side wishlist** | BigCommerce, Wix (nativní) | Máme jen client-side localStorage oblíbené | Remarketing signál + engagement |
| **Vylepšený abandoned cart** (3-email sekvence + sleva) | všichni | Máme základ (`lib/abandoned-cart`) | Přímá záchrana tržby |
| **Branded tracking page** | Shopify, BC (AfterShip) | Máme tracking endpoint, ne brandovanou stránku | Snižuje „kde je objednávka" dotazy |
| **Faceted filtering s SEO URL** | BigCommerce | Máme facety v search, ne SEO-friendly filtr URL | UX + indexovatelnost |

---

## 5. P3 — Platform moat (Shopware-inspired; už ve strategii Shopia)

Tyto jsou ve `todo.md` plánované na Fázi 2/3 — potvrzuji jako správné, vysoká páka:

| Featura | Vzor | Co to dá |
|---|---|---|
| **Rule Builder** (vizuální IF→THEN napříč slevami/dopravou/platbou/viditelností) | Shopware | No-code engine, jednou nastav → použij všude. Univerzální. |
| **Flow Builder** (trigger→podmínka→akce: e-mail/webhook/změna stavu) | Shopware, Shopify Flow | Automatizace provozu (abandoned cart, low-stock, B2B onboarding). Máme BullMQ. |
| **Nativní email marketing** | Shopify Email, Wix | Newsletter + kampaně bez externího Mailchimpu/Ecomailu. Máme jen newsletter blok. |
| **Smart/dynamické kolekce** (Product Streams) | Shopify, Shopware | Auto-kolekce dle pravidel („skladem pod 500 Kč") bez ruční údržby. Máme `attributes`, logická extenze. |
| **Custom fields UI (metafields)** | Shopify, Shopware, BC | Máme `metadata JSONB`, ale chybí UI/registrace polí pro merchanta. |
| **POS** (pokladna v prohlížeči) | Upgates (nativně!), Shopify | V regionu relevantní (Upgates má v ceně). Omnichannel. |
| **Multi-warehouse / MSI** | Shopify, Shopware | Při růstu/omnichannel; schema „ready", chybí logika. |

---

## 6. P4 — Diferenciace / SMB & lifestyle (volitelné, dle pozice)

| Featura | Vzor | Pozn. pro CZ/SK/PL |
|---|---|---|
| **Embed widget / Buy Button** (vlož obchod do cizího webu) | Ecwid (signature) | Silný pro **open-core** a WordPress-heavy CZ/SK/PL trh. |
| **Member areas / kurzy / gated obsah** | Squarespace | Pro lifestyle creatory monetizující znalosti. Máme `digital` produkt, ne členství. |
| **Rezervace / booking** (služby) | Wix Bookings, Acuity | Pokud Shopio cílí i na služby (workshopy, konzultace). |
| **AI rozšíření**: recommendations, semantic search, **alt-texty**, **background removal**, kvalitní **CS/SK/PL copy** | Shopify Magic, Wix | Máme jen AI popis + SEO. CS/SK/PL kvalita je **díra u všech** → příležitost odlišit se. |
| **Multilingual + auto hreflang + AI překlad** | Wix Multilingual | Máme i18n (produkty/kategorie ručně), chybí AI překlad + ověřit hreflang. |
| **Multi-storefront** (více obchodů z 1 adminu, sdílený katalog) | BigCommerce | Máme `tenant_id` + RLS — architektura ready. |

---

## 7. Doporučené pořadí (kdyby šlo jen postupně)

1. **Reální CZ dopravci** (PPL, DPD, Česká pošta, Balíkovna) — P0, největší adopční blocker.
2. **ARES validace + iDoklad/Fakturoid konektor + zákaznický return portál** — rychlé P0 výhry, nízká náročnost.
3. **Multi-currency + ČNB kurzy** — odemyká SK/PL trh (P1, strategické jádro).
4. **Promo engine: automatické slevy + BOGO/BXGY** + **express checkout (wallet + saved cards)** — P2 konverze.
5. **Product recommendations + semantic search + server-side wishlist** — P2 merchandising.
6. **Reverse charge/VIES + OSS/MOSS + recyklační příspěvky** — P0 compliance pro EU/B2B (paralelně, legal-heavy).
7. **Rule Builder + Flow Builder + nativní email** — P3 platform moat.
8. **POS, multi-warehouse, embed widget, member areas, AI rozšíření** — P3/P4 dle strategie a pozice.

---

## 8. Co bylo zbytečné (nečerpat na to další čas)

- FR/UK dopravci (Mondial Relay, Colissimo, Chronopost, Royal Mail, Evri) + Hermes (DE) — mimo region.
- Alma (FR BNPL) — mimo region.
- (Klarna ponechat, ale neprioritizovat — okrajová v CZ/SK/PL.)

> Nic z toho nemazat (kód je izolovaný a neškodí), jen na tyto trhy zatím neinvestovat.

---

## 9. ADDENDUM — rozšířený výzkum (15+ dalších platforem)

Doplněno o PL (Shoper, IdoSell, **BaseLinker**, Sky-Shop, RedCart), open-source/FR (**WooCommerce, PrestaShop, Saleor**, WiziShop), enterprise/DACH (**Magento/Adobe Commerce**, JTL-Shop, plentyONE, SFCC) a další CZ/SK (FastCentrik, Webareal, Eshop-rychle, **BiznisWeb**, Websupport).

### 9.1 Nové architektonické vzory (severní hvězdy)
- **Saleor channel model** — `Channel` jako first-class entita s **per-channel měnou, cenami, skladem, dostupností, platbami**. Toto je PŘESNĚ řešení našeho P1 multi-currency: jeden katalog, kanály cs-CZ (CZK) / sk-SK (EUR) / pl-PL (PLN), každý s vlastní cenotvorbou. → použít jako vzor pro multi-currency.
- **Magento dvouvrstvý promo engine** — **Catalog Price Rules** (automatické, podmínkové, vidět už ve výpisu, bez kódu) vs. **Cart Price Rules** (nad košíkem, kupóny, BOGO). Nejčistší vzor pro náš P2 promo engine.
- **Saleor sync vs async webhooks + Transaction API** — platby/doprava/daň jako sync-webhook „apps", ne hardcoded. + **two-axis RBAC** (data permission × channel scoping). Vzor pro app ekosystém (navazuje na náš OAuth/webhooks).
- **WooCommerce HPOS** — potvrzení, že objednávky patří do normalizovaných tabulek (máme), ne EAV/meta.

### 9.2 Nové CZ/SK/PL must-have featury (doplnění P0)
- **Allegro integrace** (PL #1 marketplace, expanduje do CZ/SK) — obousměrný sync skladu/cen/objednávek, auto-relisting. V PL **rozhodující** nákupní kritérium platformy. → nový P0/P1 pro PL.
- **BaseLinker-style Automatic Actions** (event-driven: trigger → akce: status/faktura/zásilka/notifikace) — nejvyšší-hodnotová featura PL ekosystému. = náš plánovaný **Flow Builder** (P3), ale potvrzeno jako vyšší priorita pro region. Alternativa: prvotřídní **BaseLinker konektor** (hodně CZ/PL prodejců ho stejně používá).
- **Generický pickup-point picker** napříč zeměmi (Zásilkovna/Z-BOX, InPost Paczkomaty, Balíkovna, Heureka Point, Orlen Paczka) — výdejní místa jsou v CZ/PL dominantní doručení; potřeba jednotná abstrakce + checkout widget.
- **SK platby**: TrustPay ✓, **CardPay/TatraPay (Tatra banka)**, Besteron ✓ → chybí CardPay/TatraPay. **SK dopravci**: Packeta SK, Slovenská pošta, **SPS**, **123Kuriér**.
- **Splátkový/odložený prodej**: Twisto ✓, **Skip Pay, MallPay, Home Credit, Essox** (v CZ/SK velmi žádané).
- **Účetnictví**: + **iDoklad, Fakturoid** (CZ SaaS), **SuperFaktura.sk** (SK), ABRA FlexiBee/Helios (enterprise). Dnes jen Pohoda.

### 9.3 Nové LEGISLATIVNÍ povinnosti (kritické P0 — compliance)
- **EU Omnibus / zákaz pseudoslev** — povinné zobrazení **nejnižší ceny za posledních 30 dní** u každé slevy. Na SK přísně vymáháno. = **cenová/produktová featura**, ne jen text. Potřeba trackovat cenovou historii.
- **OSS VAT (One-Stop-Shop)** — přeshraniční EU DPH (cílová země nad prahem 10 000 €). Pro EU-first ambici povinnost.
- **EPR / DIVID** — evidence obalů + jednorázových plastů (CZ od 1/2025), SK registrace obalů. Recyklační příspěvky (EKO-KOM/ASEKOL) souvisí.
- **SK 30denní lhůta na odstoupení** (zákon 108/2024, novela 310/2025) — vs CZ 14 dní → **konfigurovatelné per země**.
- **Ověřené recenze** — povinnost prokázat původ recenze od reálného zákazníka (máme `verifiedPurchase` ✓, ale je třeba to legálně komunikovat).

### 9.4 Best-of merchandising (doplnění P2)
- **Magento Customer Groups + Tier/Group Pricing** — jeden mechanismus pro B2B/VIP/wholesale + množstevní slevy.
- **Magento Attribute Sets** — šablony atributů per typ produktu (základ PIM + faset + pravidel).
- **AI Product Recommendations** (Adobe Sensei/Einstein: „často kupováno spolu", trending, similarity) — nejrychlejší měřitelná ROI; lze stavět na lehčích heuristikách z našich order dat.
- **Predictive sort + auto-synonyma z reálných hledání** (Einstein) — postupně.
- **Multichannel inventory sync** (plentyONE/JTL: single source of truth napříč Heureka/Allegro/Amazon) — největší provozní hodnota pro multi-kanálové prodejce.

### 9.5 Aktualizovaná priorita (po rozšíření)
P0 zůstává (CZ dopravci, ARES, return portál, účetní konektory, Heureka Ověřeno) + **přidat compliance**: EU Omnibus (lowest-price-30d), OSS VAT, EPR, SK 30denní lhůta. P1 multi-currency stavět dle **Saleor channel modelu**. P2 promo engine dle **Magento dvouvrstvého modelu** + recommendations. P3 **Flow Builder = BaseLinker Automatic Actions** + Allegro konektor.
