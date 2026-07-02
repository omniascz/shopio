# Konkurence — featury napříč 7 trhy + co Shopiu chybí (živě ověřeno)

> **Datum:** 2026-06-10
> **Pokrytí:** 29 platforem, 7 trhů (global/enterprise, UK, FR, DACH, CZ, SK, PL).
> **Metoda:** konkurenti = **živě stažené oficiální stránky/dokumentace** (každý s citacemi URL, ~45-dimenzionální taxonomie, „Unknown" když zdroj nepotvrdil — žádné odhady). Stav Shopia = **ověřený kód** (audit `audit-hotovost-vs-konkurence-2026-06-10.md`).
> **Caveat:** konkurentské „Yes" = doloženo na oficiálním zdroji k 6/2026; Shopio „✅" = kód existuje (ne nutně ověřený běh naživo).

## Které platformy + jejich signature featura

| Trh | Platforma | Čím je silná (1 věta) |
|---|---|---|
| Global ent. | **Adobe Commerce (Magento)** | MSI multi-warehouse, hluboké nativní B2B (company hierarchy, quotes, shared catalogs), Sensei/Firefly AI, multi-site. |
| Global ent. | **Salesforce Commerce Cloud** | Einstein AI + Agentforce agenti, unified B2C+B2B+OMS na Customer 360, OCI omnichannel inventory. |
| Global ent. | **commercetools** | čistý API-first/MACH (REST+GraphQL), Business Units + Associate Roles B2B, standalone prices. |
| Global OSS | **WooCommerce** | největší ekosystém rozšíření, plný WordPress CMS, Subscriptions/Bookings/Memberships oficiálně. |
| FR | **PrestaShop** | **nativní multistore** v core, 3000+ addons, silný FR carrier/payment ekosystém. |
| FR | **WiziShop** | vestavěné SEO (50+ optimalizací) + neomezené AI (Maia asistent, Pizi: foto→produktová stránka za 45 s). |
| DACH | **JTL-Shop** | zdarma ERP (Wawi) + WMS + **JTL-POS** + eazyAuction marketplace sync — vše z jednoho zdroje. |
| DACH | **plentyONE** | **150+ předintegrovaných marketplaců/kanálů**, all-in-one ERP, drag-drop Flow automatizace. |
| DACH | **OXID eSales** | enterprise multishop/mall, B2B Edition (11 modulů) + **OCI punchout**, first-class GraphQL. |
| DACH | **Gambio** | batteries-included DE compliance, magnalister marketplace sync předinstalovaný, 2FA nativně. |
| UK | **EKM** | dedikovaný UK account manager (managed model), EKMPay, vestavěný B2B portál. |
| UK | **Visualsoft** | agency/managed model + done-for-you marketing, VS Pay (+8 % konverze), suppliers+PO management. |
| PL | **Shoper** | hluboká Allegro integrace + nativní InPost (Paczkomaty), Autopay platby, Opisy AI. |
| PL | **IdoSell** | **IdoSell Broker** (carrier agregátor bez smluv), nativní WMS+POS, omnichannel, IAI RS doporučovač. |
| PL | **BaseLinker** | ops vrstva: **~250–400 marketplace integrací** + Automatic Actions (event→akce) + hromadný tisk štítků. |
| PL | **Sky-Shop** | 547+ dropshipping dodavatelů, Sky-Pay + financování, certifikovaná Allegro integrace. |
| PL | **RedCart** | vestavěné AI (semantic + image search, sales assistant), open API (MCP-formát docs), headless. |
| CZ | **FastCentrik** | hluboké CZ napojení (Heureka/Pohoda/Balíkobot) + 9 účetních konektorů, široké BNPL. |
| CZ | **Eshop-rychle** | parametrické SEO kategorie, nativní **POS**, personalizace + opuštěný košík + hlídací pes. |
| CZ | **Webareál** | integrovaný **POS** (Kasareal), 10+ bran + crypto, hluboké účetní konektory (vč. SAP, Fakturoid, iDoklad). |
| SK | **BiznisWeb (FLOX)** | SK local stack (TatraPay/SporoPay/Packeta/SPS), AI chatbot + AI překlad (FlowHunt), GraphQL API. |
| (code-audit) | Shopify, BigCommerce, Shopware, Wix, Squarespace, Ecwid, Shoptet, Upgates | viz `audit-hotovost-vs-konkurence-2026-06-10.md`. |

## Kapacitní matice — co umí konkurence vs. Shopio

Legenda Shopio: ✅ máme (kód) · ⚠️ stub/mělké · ❌ nemáme. „Rozšířenost" = jak běžné to je u konkurence (signál priority).

| Schopnost | Shopio | Rozšířenost u konkurence | Kdo to dělá nejlíp |
|---|---|---|---|
| **Externí marketplace sync** (Allegro/Amazon/eBay/Kaufland/OTTO) | ❌ | **Velmi vysoká** — skoro všichni regionální i ERP hráči | plentyONE (150+), BaseLinker (250–400), JTL, IdoSell, Shoper |
| **Multi-warehouse / MSI** | ❌ (single-warehouse) | **Vysoká** (enterprise + ERP) | Adobe MSI, SFCC OCI, JTL-WMS, plentyONE, IdoSell |
| **POS** (kasa/terminál) | ❌ (neaktivní enum) | **Vysoká** — i malé CZ/PL/DACH platformy | JTL-POS, IdoSell, plentyONE, Webareál, Eshop-rychle |
| **B2B hloubka** (quotes/RFQ, approval, role/RBAC, per-product price lists, buyer portal) | ❌ (jen NET terms + flat %) | **Vysoká** (enterprise + PL/DACH) | Adobe, SFCC, commercetools, OXID, BigCommerce, IdoSell |
| **B2B punchout / OCI / EDI** | ❌ | Střední (DACH/enterprise) | OXID (OCI), SFCC, Adobe |
| **Účetní konektory** (mimo Pohodu) | ❌ (jen Pohoda) | **Vysoká** v CZ/SK | Webareál, FastCentrik (Money/ABRA/iDoklad/Fakturoid/SAP) |
| **Reálné štítky CZ dopravců** (PPL/DPD/ČP/GLS direct) | ⚠️ (jen Packeta/InPost/Balíkobot) | **Vysoká** v CZ | FastCentrik, Eshop-rychle, Webareál |
| **BNPL CZ/SK** (Skip Pay/MallPay/Essox/Home Credit/Cofidis) | ❌ (jen Twisto/Klarna/Alma) | **Vysoká** v CZ/SK | FastCentrik, Eshop-rychle, Webareál, BiznisWeb |
| **Loyalty body + VIP tiers** | ⚠️ (jen store credit) | Vysoká | Adobe (reward points), Woo (Points&Rewards), Shoper, Sky-Shop |
| **Subscriptions auto-charge** (MIT/uložená karta, dunning) | ⚠️ (jen pay-link) | Vysoká | Woo Subscriptions, commercetools, Adobe (ext) |
| **Express checkout** (Apple/Google Pay one-tap, uložené karty) | ❌ | **Vysoká** | SFCC, Adobe, Shopify, Shoper, IdoSell |
| **Headless / GraphQL API** | ❌ (jen REST) | Vysoká (enterprise) | commercetools, Adobe, OXID, SFCC, Woo(WPGraphQL), BiznisWeb |
| **Page builder hloubka** (drag-drop, conditional/A-B) | ⚠️ (7 bloků) | Vysoká | SFCC Page Designer, Adobe Page Builder, commercetools Studio, Wix |
| **AI: semantic + image search** | ❌ (jen keyword facety) | Roste rychle | Adobe Live Search, SFCC Einstein, RedCart, IdoSell |
| **AI: chatbot / asistent** | ❌ | Roste rychle | SFCC Agentforce, BiznisWeb, plentyONE, WiziShop (Maia) |
| **AI: překlad katalogu** | ❌ (jen popis+SEO) | Střední, roste | WiziShop, BiznisWeb, Woo (WPML AI) |
| **Flow/Rule automatizace hloubka** | ⚠️ (4 triggery/3 akce) | Vysoká | BaseLinker Automatic Actions, plentyONE, JTL, Shopware, Adobe |
| **A/B testing nativní** | ❌ | Střední (enterprise) | SFCC, Adobe (Target), IdoSell |
| **Customer segments** (dotazovací engine) | ❌ (jen flat groups) | Střední (enterprise) | Adobe, SFCC |
| **Metafields/metaobjects + attribute sets (PIM)** | ❌ (jen JSONB) | Vysoká (enterprise) | Adobe, commercetools, BigCommerce, Shopify |
| **Native multistore** (per-store doména/téma/cena) | ⚠️ (deferred) | Střední–vysoká | PrestaShop (core!), OXID EE, Adobe, plentyONE |
| **Digital product delivery** (download/licence) | ⚠️ (enum bez fulfillmentu) | Vysoká | Woo, PrestaShop, FastCentrik, Sky-Shop |
| **Dropshipping/supplier síť** | ❌ | Vysoká v PL | Sky-Shop (547+), RedCart (500+), IdoSell |
| **2FA / SSO admin** | ❌ | Střední, roste | PrestaShop, Gambio, WiziShop, Adobe, SFCC |
| **Audit log** (zápisy) | ⚠️ (tabulka prázdná) | Střední (enterprise) | Adobe, plentyONE (GoBD), commercetools |
| **Product modifiers** (gift-wrap/engraving/file upload) | ❌ | Vysoká | Adobe, Woo (Add-Ons), PrestaShop, BigCommerce |
| **Bookings / courses / memberships** (vertikály) | ❌ | Nízká (jen design-first) | Wix, Squarespace, Woo |
| **Embed widget / Buy Button** | ❌ | Nízká | Ecwid (signature) |

## V čem je Shopio NAOPAK silné (parita nebo lépe — nepřestavovat)

Live výzkum potvrdil, že tohle máme často lepší než i velcí hráči:
- **CZ/SK/EU compliance baked-in:** ARES + VIES + reverse charge + ISDOC 6.0.1 + **EU Omnibus (lowest-30-day)** + recyklační poplatky + vratná záloha + unit pricing + GDPR export/erasure. Globální hráči (Shopify/Adobe/SFCC) Omnibus/ARES/ISDOC nativně **nemají**; jen IdoSell má Omnibus na kartě.
- **Platební brány CZ/SK/PL:** 20+ bran nativně (GoPay/ComGate/ThePay/Pays/GPwebpay/Barion/Besteron/TrustPay/Przelewy24/PayU/QR/COD) — globální platformy je nemají.
- **Srovnávací feedy:** Heureka/Zboží/Glami/Ceneo/Google + **AI/agentic feed** (2026 trend).
- **Multi-tenant + Postgres RLS izolace** s testy — nad rámec většiny SaaS.
- **Developer platforma** (OAuth 2.0 apps + webhooks HMAC) — lepší než Shoptet/Upgates.
- **Nativní gift cards + subscriptions + loyalty-ledger + returns RMA** — věci, co Shopify/BigCommerce řeší placenými appkami.

## Konsolidované DÍRY → doplnit do výrobního plánu

Tohle live výzkum **přidává nebo zostřuje** oproti `plan-vyroby-chybejici-moduly.md` (priorita dle rozšířenosti):

**Potvrzeno jako nejnaléhavější (skoro všichni to mají, my ne):**
1. **Externí marketplace sync** — povýšit; není to jen Allegro, ale vzor plentyONE/BaseLinker (150+ kanálů, central inventory).
2. **POS** — povýšit z P3: mají ho i malé CZ/PL/DACH platformy, je to regionální table-stakes, ne luxus.
3. **Účetní konektory iDoklad/Fakturoid** (+ Money/ABRA/SAP) — CZ konkurenti mají 6–9, my 1.
4. **Reálné CZ dopravce + BNPL CZ/SK** — standard u všech CZ/SK hráčů.

**Nově zachycené moduly (zatím NEbyly v plánu — přidat):**
5. **A/B testing** (nativní) — SFCC/Adobe/IdoSell.
6. **Customer segments** — dotazovací segmentační engine (Adobe/SFCC).
7. **Product modifiers** — gift-wrap/engraving/file-upload/text (Adobe/Woo/PrestaShop/BigCommerce).
8. **AI semantic + image search** a **AI chatbot/asistent** a **AI překlad katalogu** — rozšířit „AI" položku; je to nejrychleji rostoucí konkurenční pole (RedCart, SFCC Agentforce, WiziShop, BiznisWeb).
9. **B2B punchout / OCI / EDI** — pro DACH/enterprise B2B (OXID/SFCC).
10. **Dropshipping/supplier síť** — silné v PL (Sky-Shop/RedCart/IdoSell); volitelné P4 dle strategie.

**Plně potvrzené velké díry (už v plánu, jen utvrzeno daty):** multi-warehouse, B2B hloubka, headless/GraphQL, page builder hloubka, loyalty tiers, subscriptions auto-charge, digital fulfillment, metafields/PIM, 2FA/SSO, audit-log zápisy, native multistore, express wallets.

## Zdroje
Každá platforma má ve své dílčí analýze citované oficiální URL (stahováno 6/2026). Plné per-platform taxonomie (45 dimenzí × 29 platforem) byly pořízeny živým fetchem; tento dokument je jejich syntéza. Pro plné rozpisy 8 hloubkových viz `research/*-kompletni-analyza.md`; pro zbylých 21 byly taxonomie sebrány v auditní session 2026-06-10.
