# Výrobní plán — chybějící moduly (ověřeno proti kódu)

> **Datum:** 2026-06-10
> **Zdroj:** (1) ověřený audit 8 hloubkových platforem `audit-hotovost-vs-konkurence-2026-06-10.md` + (2) `gap-analyza-cz-sk-pl.md` (dalších 15 platforem). Každá položka = modul, který v repu **reálně chybí nebo je stub** (ověřeno grep/read, ne odhad).
> **Pravidlo:** sem patří jen to, co NENÍ hotové. Co je hotové (commerce jádro, platby, feedy, ARES/VIES/Omnibus/ISDOC/Pohoda, multi-currency, promo engine, kolekce, flows-MVP, newsletter) viz audit, sekce „Co JE hotové".
> **Status legenda:** ❌ chybí úplně · ⚠️ stub/MVP (kód existuje, flow ne).

---

## P0 — Compliance & CZ/SK/PL blockery (nejvyšší priorita)

| # | Modul | Stav | Co konkrétně chybí | Náročnost |
|---|---|---|---|---|
| 1 | **Reální CZ dopravci nativně** | ❌ | PPL, DPD, Česká pošta, Balíkovna, GLS, DHL jsou v `lib/carriers/registry.ts` jako `real:false` → manuální fallback. Reálné API (štítky/tracking/výdejní místa) jen Packeta + InPost + Balíkobot agregátor. | Vysoká (per-dopravce API) |
| 2 | **SK dopravci + SK platby** | ❌ | Dopravci: Slovenská pošta, SPS, 123Kuriér. Platby: CardPay/TatraPay (Tatra banka) — ověřeno, v kódu nejsou. | Střední |
| 3 | **Účetní konektory mimo Pohodu** | ❌ | iDoklad, Fakturoid (CZ SaaS, REST API), SuperFaktura.sk (SK), Money S3, ABRA, FlexiBee. Dnes jen `lib/pohoda.ts` (XML) + ISDOC. | Nízká–střední |
| 4 | **OSS VAT (One-Stop-Shop)** | ⚠️ | `tax-resolver.ts` řeší destinační sazbu částečně; chybí threshold tracking (10 000 €), OSS evidence + reporting. Nutné pro EU/přeshraniční. | Střední |
| 5 | **EPR / DIVID evidence obalů** | ⚠️ | Recyklační poplatky (výpočet + faktura) hotové; chybí registrace obalů (EKO-KOM) + reporting + DIVID jednorázové plasty (CZ od 1/2025), SK obaly. | Střední |
| 6 | **Konfigurovatelná lhůta na odstoupení per země** | ❌ | SK 30 dní (zák. 108/2024 + 310/2025) vs CZ 14 dní — dnes není return-window config na úrovni tenant/země. | Nízká |
| 7 | **Heureka Ověřeno + Košík** | ❌ | „Ověřeno zákazníky" (verified reviews API) + Heureka/Zboží Košík (checkout na srovnávači). Heureka = 40–60 % objednávek CZ. | Střední |
| 8 | **Audit log — zápisy** | ⚠️ STUB | Tabulka `schema/audit-log-entries.ts` existuje, ale **nikde se do ní nezapisuje**. Pro enterprise/compliance prázdná schránka. | Nízká |
| 9 | **2FA / TOTP admin** | ❌ | Žádné dvoufaktorové ověření adminu (grep 2fa\|totp\|saml\|sso = prázdné). Bezpečnostní enterprise požadavek. | Nízká–střední |

## P1 — Marketplace & multichannel (region PL + omnichannel)

| # | Modul | Stav | Co chybí | Náročnost |
|---|---|---|---|---|
| 10 | **Allegro integrace** | ❌ | Obousměrný sync skladu/cen/objednávek + auto-relisting. PL #1 marketplace, expanduje CZ/SK. Dnes `marketplace.ts` = jen interní multi-vendor. | Vysoká |
| 11 | **Externí marketplace/social sync** | ❌ | Amazon, eBay, Instagram/Facebook Shop, TikTok Shop, Pinterest — catalog/order sync. Dnes jen XML feedy (jednosměrné). | Vysoká |
| 12 | **BaseLinker konektor** | ❌ | Alternativa k vlastním integracím — hodně CZ/PL prodejců ho používá. | Střední |
| 13 | **Multichannel inventory sync** | ❌ | Single source of truth skladu napříč web/Heureka/Allegro/Amazon. Souvisí s multi-warehouse (#14). | Vysoká |

## P2 — Enterprise hloubka

| # | Modul | Stav | Co chybí | Náročnost |
|---|---|---|---|---|
| 14 | **Multi-warehouse / MSI** | ❌ | `inventory.ts` natvrdo single-warehouse („Deferred: warehouses/MSI"). Žádné lokace, transfery, split orders, purchase orders, order routing. | Vysoká |
| 15 | **B2B hloubka** | ❌ ~80% deferred | `companies.ts:9-11`: quotes/RFQ, PO approval workflow, company members + RBAC, per-product/per-company price lists, buyer portal, sales-rep masquerade, kreditní limity. Dnes jen billing profil + NET terms + plochá %-sleva skupiny. | Vysoká |
| 16 | **Loyalty tiers + body** | ⚠️ | `lib/loyalty.ts` = jen store-credit ledger (earn %/redeem). Chybí body, VIP tiers (Bronze/Silver/Gold), body za registraci/recenzi/narozeniny, expirace. | Střední |
| 17 | **Subscriptions auto-charge** | ⚠️ | Scheduler generuje pending order + pay-link. Chybí MIT účtování uložené karty, dunning, proration, trials, pauza. | Střední |
| 18 | **Digital products fulfillment** | ⚠️ STUB | Typ `kind='digital'` v enumu, ale žádné doručení souboru / secure download link / expirace. Digitální zboží by se reálně nedoručilo. | Střední |
| 19 | **Metafields/metaobjects + attribute sets (PIM)** | ❌ | Dnes jen generický `metadata`/`attributes` JSONB bez UI/registrace polí. Chybí typovaná custom pole + šablony atributů per typ produktu. | Střední |
| 20 | **Flow Builder hloubka + Rule Builder** | ⚠️ | Flow = 4 order triggery + 3 akce. Chybí customer/product/cart/inventory eventy, delays/branches, webhook/SMS/email-to-customer akce. Rule Builder (sdílený IF→THEN engine napříč slevami/dopravou/platbou) zatím neexistuje. | Střední–vysoká |

## P3 — Headless & platforma

| # | Modul | Stav | Co chybí | Náročnost |
|---|---|---|---|---|
| 21 | **GraphQL Storefront/Admin API (headless)** | ❌ | Jen REST + Next.js storefront; `index.ts:5` = komentář „GraphQL (later)". | Vysoká |
| 22 | **POS modul** | ❌ | Channel `pos` seedovaný jako neaktivní. Žádný terminál, hardware, účtenky, cash management. Upgates ho má v ceně. | Vysoká |
| 23 | **Multi-storefront** | ❌ | `channels.ts` defers per-channel doménu/téma/cenu/katalog. Architektura (tenant+RLS) ready, vrstva chybí. | Vysoká |
| 24 | **Express checkout: wallets + saved cards** | ❌ | Apple/Google Pay one-tap + tokenizované uložené karty (1-click). Dnes jen express přes uloženou adresu. ~15 % konverze. | Střední |
| 25 | **Semantic / AI search** | ⚠️ | Meili facety + ILIKE fallback; pgvector semantic „Deferred". | Střední |
| 26 | **BNPL CZ/SK** | ❌ | Skip Pay, MallPay, Home Credit, Essox (v CZ/SK žádané). Dnes Twisto/Klarna/Alma. | Nízká–střední |

## P4 — Diferenciace (volitelné dle pozice)

| # | Modul | Stav | Pozn. |
|---|---|---|---|
| 27 | **Page builder hloubka / drag-drop editor** | ⚠️ | Dnes fixních 7 bloků (`page-blocks.ts`). Wix/Squarespace/Shopware-level editor chybí. |
| 28 | **AI rozšíření** | ⚠️ | Dnes jen popis + SEO. Chybí překlad katalogu, alt-texty, background removal, recommendations engine, chatbot, NL search. |
| 29 | **Embed widget / Buy Button** | ❌ | Ecwid signature — vlož obchod do cizího webu. Silné pro open-core/WordPress CZ/PL trh. |
| 30 | **Member areas / kurzy / gated content** | ❌ | Squarespace — pro lifestyle creatory. |
| 31 | **Bookings / rezervace služeb** | ❌ | Wix Bookings/Acuity — pokud cílíme i na služby. |
| 32 | **Branded tracking page** | ❌ | Máme tracking endpoint, ne brandovanou stránku. |
| 33 | **3-email abandoned cart sekvence** | ⚠️ | Dnes 1 email; chybí 1h/24h/72h sekvence + sleva. |
| 34 | **Drobné SEO/UX** | ❌ | 301 redirects manager, storefront sitemap.xml, product Q&A, foto-recenze, produktové štítky/badge, product scheduling (od-do). |

---

## Doporučené pořadí výroby
1. **Čistě-kódové P0 (bez externích klíčů, hned):** audit-log zápisy (#8), 2FA admin (#9), return-window per země (#6), OSS threshold (#4), EPR reporting (#5).
2. **P0 integrace (čekají na reálné klíče/účty):** CZ dopravci (#1), SK dopravci+platby (#2), účetní konektory iDoklad/Fakturoid (#3), Heureka Ověřeno+Košík (#7).
3. **P1 region:** Allegro (#10) → multichannel inventory sync (#13) → BaseLinker (#12).
4. **P2 enterprise:** multi-warehouse (#14) → B2B hloubka (#15) → digital fulfillment (#18) → loyalty tiers (#16) → subscriptions auto-charge (#17) → metafields/PIM (#19) → Flow/Rule Builder (#20).
5. **P3 platforma:** express checkout wallets (#24) → semantic search (#25) → BNPL CZ/SK (#26) → GraphQL (#21) → multi-storefront (#23) → POS (#22).
6. **P4:** dle strategie a pozice.

> Pozn.: Náročnost a „čeká na klíče" jsou orientační. Před každým modulem ověřit aktuální stav v kódu (něco mohlo přibýt) — neopakovat chybu „odškrtnu z paměti".

---

## DOPLNĚK z live výzkumu 29 platforem / 7 trhů (2026-06-10)

Plná matice: `research/konkurence-featury-matice-2026-06-10.md`. Co live data **změnila/přidala** oproti seznamu výše:

**Re-prioritizace (povýšit):**
- **#10 Externí marketplace sync → P0/P1 (povýšit):** není to jen Allegro. Skoro celá konkurence to má (plentyONE 150+ kanálů, BaseLinker 250–400, JTL eazyAuction, IdoSell). Vzor = central inventory + 2-way sync. Největší jediná díra napříč trhy.
- **#22 POS → P2 (povýšit z P3):** mají ho i malé CZ/PL/DACH platformy (JTL-POS, IdoSell, plentyONE, Webareál, Eshop-rychle). Regionální table-stakes, ne luxus.
- **#3 účetní konektory + #1 CZ dopravci + #26 BNPL CZ/SK:** potvrzeno jako standard u VŠECH CZ/SK hráčů — drž na P0.

**Nově zachycené moduly (nebyly v seznamu, přidat):**
| # | Modul | Stav | Kdo to má | Priorita |
|---|---|---|---|---|
| 35 | **A/B testing (nativní)** | ❌ | SFCC, Adobe, IdoSell | P3 |
| 36 | **Customer segments** (dotazovací engine, ne flat groups) | ❌ | Adobe, SFCC | P2 |
| 37 | **Product modifiers** (gift-wrap/engraving/file-upload/text) | ❌ | Adobe, Woo, PrestaShop, BigCommerce | P2 |
| 38 | **AI semantic + image search** | ❌ (jen keyword facety) | Adobe, SFCC, RedCart, IdoSell | P2 |
| 39 | **AI chatbot / nákupní asistent** | ❌ | SFCC Agentforce, BiznisWeb, plentyONE, WiziShop | P3 |
| 40 | **AI překlad katalogu** (rozšířit AI item #28) | ❌ | WiziShop, BiznisWeb, Woo (WPML AI) | P3 |
| 41 | **B2B punchout / OCI / EDI** (procurement integrace) | ❌ | OXID (OCI), SFCC, Adobe | P3 (DACH/enterprise) |
| 42 | **Dropshipping / supplier síť** | ❌ | Sky-Shop 547+, RedCart 500+, IdoSell | P4 (volitelné, silné v PL) |

**Potvrzené naše silné stránky (NEpřestavovat):** CZ/SK/EU compliance (ARES/VIES/ISDOC/Omnibus/recyklace — globální hráči nemají), 20+ CZ/SK/PL bran, srovnávací feedy + AI feed, multi-tenant RLS, OAuth dev platforma, nativní gift cards/subscriptions/loyalty-ledger/returns.

---

## DOPLNĚK z vlny 3a — enterprise & composable (~48 platforem, 2026-06-10)

Plné nálezy: `konkurence-featury-matice-2026-06-10.md` (addendum). Enterprise/composable hráči (SAP Commerce, VTEX, Spryker, OroCommerce, Elastic Path, NetSuite) + PL ERP-platformy (Comarch, AtomStore) + CZ enterprise (Shopsys) odhalili tyto **nové moduly** (převážně B2B/enterprise — pro Shopio P3/P4 dle strategie, ale zaznamenat):

| # | Modul | Stav | Kdo to má | Priorita |
|---|---|---|---|---|
| 43 | **Distribuovaný OMS / order routing** (ship-from-store, split shipment, sourcing rules) — nad rámec multi-skladu #14 | ❌ | SAP OMS, VTEX OMS, NetSuite, Shopgate Go | P3 |
| 44 | **B2B units of measure + packaging pricing** (kus/balení/paleta s cenou per jednotka) | ❌ | OroCommerce (signature), JTL | P3 |
| 45 | **B2B quick-order pad + CSV cart upload + shopping lists** | ❌ | Oro, SAP, VTEX, Spryker, AtomStore, NetSuite | P2 (rychlá B2B výhra) |
| 46 | **Sales-rep assisted service / masquerade** („business-on-behalf", Panel Handlowca) | ❌ | Spryker, AtomStore, SAP (ASM) | P3 |
| 47 | **Real-time ERP integrační hub** (2-way stock/cena/objednávky — víc než účetní export #3) | ❌ | Comarch, AtomStore, ShopCentrik (10+ konektorů), NetSuite, JTL | P2 (CZ/PL klíč) |
| 48 | **Marketplace payouts** (Stripe Connect / split payments / seller portal) — upgrade interního vendor modelu | ⚠️ (jen commission ledger) | VTEX, Spryker, Mirakl, OroMarketplace | P3 |

**Co enterprise vlna POTVRDILA jako standard (drž priority):**
- **2FA/MFA** — VTEX ho má dokonce povinné pro admin, Spryker MFA (passkey/TOTP), NetSuite/SAP/Oro nativně → náš #9 je oprávněně vysoko.
- **Audit log se zápisy** — VTEX, OroCommerce (Data Audit), NetSuite, SAP nativně → náš #8 (prázdná tabulka) je díra.
- **B2B punchout/OCI/EDI** (#41) — SAP (cXML/OCI), Spryker, Oro (Greenwing), Elastic Path → potvrzeno pro DACH/enterprise.
- **GraphQL/headless** (#21) — Saleor (GraphQL-only!), Shopsys (GraphQL-first), VTEX, OXID, Spryker (REST Glue), Medusa → standard u moderních.
- **AI search by image / semantic** (#38) + **AI chatbot** (#39) — Spryker (Search by Image), VTEX (AI Personal Shopper), SAP (Joule), Oro (SmartAgent) → rychle rostoucí pole.

**Naše silné stránky potvrzené i proti enterprise:** ani SAP/VTEX/Adobe/SFCC nemají nativně CZ/SK compliance (ARES/ISDOC/Omnibus/recyklace) ani CZ/SK/PL brány — to je pořád náš příkop pro region.

---

## DOPLNĚK z vlny 3b — long-tail (~68 platforem, 2026-06-10)

Long-tail (Kibo, fabric, Sylius, Vendure, Volusion, Big Cartel, GoDaddy, Miva, xt:Commerce, VersaCommerce, STRATO, IONOS, oXyShop, ByznysWeb, Selly, Sellingo, SOTESHOP, Oxatis, PowerBoutique, Bluepark, Sellerdeck) **nepřinesl nové kategorie featur** — replikuje vzory už zachycené. Odhalil ale **2 frontier moduly (2026 trend)**:

| # | Modul | Stav | Kdo to tlačí | Priorita |
|---|---|---|---|---|
| 49 | **Agentic commerce readiness** (MCP server + UCP/ACP protokoly + AEO — katalog objevitelný a transakční pro AI agenty/LLM; „aby ChatGPT/Gemini/Claude doporučovaly náš obchod") | ⚠️ (máme AI feed, ne plný agentic) | Adobe (Joule/UCP), VTEX, Mirakl (Nexus), fabric (NEON), Kibo (MCP), Elastic Path (MCP), SOTESHOP (AEO) | P3 — strategicky rostoucí; navazuje na náš AI feed (náskok) |
| 50 | **Landed cost / clo (IOSS/DDP) cross-border** | ❌ | Bluepark (Zonos), Oxatis | P3 (EU cross-border) |

**Co long-tail potvrdil jako naše silné stránky:** AI feed (agentic-ready základ — máme dřív než většina), CZ/SK compliance, šíře CZ/SK/PL bran. **Pozn.:** IONOS Online Store běží na Ecwid enginu (ne Shopify); Oxatis ≠ WiziShop (oddělené firmy).

---

## SHRNUTÍ: kompletní výzkum 7 trhů uzavřen (~68 platforem)
Pokrytí global/US/UK/FR/DACH/CZ/SK/PL je **kompletní** (hlavní+mid+malí). Výrobní backlog = **moduly #1–50** výše, prioritně:
- **Hned (čistě kód):** #8 audit-log, #9 2FA, #45 B2B quick-order, #6 return-window, #36 segments, #37 modifiers.
- **Region table-stakes:** #10 marketplace sync, #22 POS, #3 účetní konektory, #1 CZ dopravci, #47 ERP hub.
- **Enterprise hloubka:** #14 multi-warehouse/#43 OMS, #15 B2B + #41 punchout, #16 loyalty tiers, #17 subscriptions auto-charge, #19 metafields.
- **Frontier:** #49 agentic commerce (náskok přes AI feed), #38/#39 AI search/chatbot.
