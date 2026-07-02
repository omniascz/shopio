# Audit hotovosti Shopio vs. konkurence (ověřeno proti kódu)

> **Datum:** 2026-06-10
> **Metoda:** Pro každou z 8 konkurenčních analýz v `research/` extrahován seznam funkcí → každá ověřena proti **reálnému kódu** v repu (grep/read, file:line evidence). Status: ✅ implementováno / ⚠️ částečné nebo stub / ❌ chybí.
> **Omezení (poctivě):** ✅ = kód existuje a implementuje danou logiku, **NE** ověřený běh naživo. Rozlišuj „kód existuje" vs „otestováno v provozu". ⚠️ často znamená doložený „Deferred/MVP" komentář přímo v kódu.

## Souhrnné skóre (ověřeno)

| Platforma | Checked | ✅ | ⚠️ | ❌ |
|---|---|---|---|---|
| Shoptet | 78 | 55 (71 %) | 12 (15 %) | 11 (14 %) |
| Upgates | 72 | 47 (65 %) | 14 (19 %) | 11 (15 %) |
| Ecwid | 40 | 21 (53 %) | 7 (18 %) | 12 (30 %) |
| BigCommerce | 40 | 22 (55 %) | 7 (18 %) | 11 (28 %) |
| Shopify | 75 | 38 (51 %) | 17 (23 %) | 20 (27 %) |
| Wix | 40 | 19 (48 %) | 8 (20 %) | 13 (33 %) |
| Squarespace | 40 | 18 (45 %) | 9 (22 %) | 13 (33 %) |
| Shopware | 26 | 12 (46 %) | 9 (35 %) | 5 (19 %) |

**Čtení:** proti českým SaaS (Shoptet/Upgates) jsme na ~65–71 % funkcí. Proti globálním enterprise hráčům (Shopify/BigCommerce/Shopware) jsme na ~45–55 %, protože jim chybí hloubka v B2B, headless a multi-store/multi-warehouse vrstvách. Proti design-first (Wix/Squarespace) jsme silní v commerce a slabí v website-builderu/vertikálách.

## Systémové díry, které se opakují NAPŘÍČ platformami

Tohle jsou věci, kde audit potvrdil, že to buď **chybí**, nebo je to **mělčí, než „hotovo" naznačovalo**. Toto je jádro toho, proč tvůj enterprise seznam „nesedl":

1. **Multi-sklad / multi-location inventory — CHYBÍ úplně.** `packages/db/src/schema/inventory.ts` je natvrdo single-warehouse („Deferred: warehouses/MSI"). Týká se Shopify, BigCommerce, Shopware, Shoptet Enterprise. Žádné lokace, transfery, split orders, purchase orders.
2. **B2B do hloubky — z ~80 % odloženo.** `companies.ts:9-11` explicitně defers: quotes/RFQ, purchase-order approval, company members + RBAC, per-product/per-company price lists, kreditní limity. Máme jen company billing profil + NET terms + plochou %-slevu na skupinu. (Shopify B2B, BigCommerce B2B Edition, Shopware B2B Suite.)
3. **Audit log je STUB.** Tabulka `schema/audit-log-entries.ts` existuje, ale **nikde se do ní nezapisuje** — pro enterprise/compliance je to prázdná schránka.
4. **2FA / TOTP / SSO admin — CHYBÍ.** Žádné dvoufaktorové ověření adminu (grep 2fa|totp|saml|sso = prázdné).
5. **GraphQL / headless API — CHYBÍ.** Jen REST + Next.js storefront. `index.ts:5` má jen komentář „GraphQL … (later)". Týká se Shopify (Storefront API), BigCommerce, Shopware (Store/Admin API).
6. **Page builder je mělký.** `lib/page-blocks.ts` = fixních 7 bloků. Není to drag-drop editor (Wix), Fluid Engine (Squarespace) ani Shopping Experiences (Shopware).
7. **Loyalty = jen store-credit ledger.** `lib/loyalty.ts` umí earn %/redeem. Chybí body, VIP tiers (Bronze/Silver/Gold), body za registraci/recenzi/narozeniny, expirace.
8. **Digital products bez fulfillmentu.** Typ `kind='digital'` je v enumu, ale **žádné doručení souboru / secure download link** nikde v `apps/api`. Digitální zboží by se reálně nedoručilo.
9. **POS — jen enum hodnota.** Channel `pos` je seedovaný jako neaktivní. Žádný terminál, hardware, účtenky, cash management.
10. **AI = 2 endpointy.** `lib/ai.ts` umí jen popis produktu + SEO meta. Chatbot, recommendations, překlad, vision, image-gen — vše odloženo.
11. **Subscriptions bez auto-charge.** Scheduler generuje pending objednávky + pay-link; žádné MIT účtování uložené karty, dunning, proration, trials.
12. **Flow automatizace je mělká.** `lib/flows.ts` = 4 order triggery + 3 akce. Žádné customer/product/cart eventy, delays, branches, webhook/SMS akce.
13. **Externí marketplace / social channel sync — CHYBÍ.** `marketplace.ts` je interní multi-vendor model, ne sync na Allegro/Amazon/eBay/Instagram/TikTok. Existují jen XML feedy (Google/Heureka/Zboží/Glami/Ceneo).
14. **Účetní konektory mimo Pohodu — CHYBÍ.** Money S3, FlexiBee, ABRA, iDoklad, Fakturoid nejsou (jen Pohoda XML + ISDOC).
15. **Reálné API štítky jen pro Packeta/InPost/Balíkobot.** ČP/PPL/DPD/GLS/DHL jsou v katalogu jako `real:false` → manuální fallback bez generování štítků (kromě přes Balíkobot agregátor).

## Co naopak JE reálně hotové a ověřené (ne stub)

Aby to bylo vyvážené — tohle audit potvrdil jako skutečnou implementaci s kódem, ne názvy souborů:

- **Platební brány:** Stripe, GoPay, ComGate, ThePay, PayU, PayPal, GP webpay, Pays, Barion, Besteron, TrustPay, Przelewy24, COD, bank-transfer, BNPL (Twisto/Klarna/Alma) — reálné implementace v `lib/payments/*`, ne stuby.
- **Dopravci:** Packeta/Zásilkovna (+ výdejní místa), InPost, Balíkobot agregátor — reálné API.
- **CZ/EU compliance:** ARES (IČO auto-fill), VIES (EU VAT), reverse charge, ČNB FX, ISDOC 6.0.1, Pohoda XML, EU Omnibus 30-day-low price history, unit pricing, recyklační poplatky + vratná záloha, DPH třídy, GDPR export/erasure.
- **Commerce jádro:** produkty/varianty/média, kategorie, kolekce (smart), bundles, košík, objednávky, faktury (PDF), returns (RMA state machine), inventory s rezervacemi + ledger, recenze (verified purchase + moderace), wishlist, gift cards, kupony, promotions (stackable + gift-with-purchase), newsletter, CMS/blog, content extras (slovník/anketa), multi-language, multi-currency (presentment), subscriptions (bez auto-charge), reálná OAuth + API keys + outbound webhooks, multi-tenant + RLS izolace (testy).

## Proč dřívější „mapování" nesedělo s tvým enterprise seznamem

Tři chyby v dřívějším postupu (přiznáno):

1. **Seznam konkurenta z hlavy, ne z reality.** Enterprise funkce (zvlášť Shopify Plus / BigCommerce B2B Edition / Shopware B2B Suite) jsem neměl kompletně — model je nezná do detailu bez stažení živé dokumentace. Tenhle audit je proti `research/*` analýzám; pro 100% pokrytí by chtělo ještě refresh přímo z živých docs konkurentů.
2. **Hotovost z paměti, ne z kódu.** Dřív jsem si odškrtával „P0–P3 hotové", aniž bych ověřil každý bod proti běžícímu kódu. Stuby (audit log, digital products, POS, single-warehouse) vypadají v indexu jako „je", ale reálně chybí flow.
3. **„Popsal jsem v docu" ≠ „je v kódu" ≠ „běží naživo".** Tyto tři roviny jsem dřív směšoval. Tento audit odděluje ✅ (kód) od ⚠️ (stub/MVP) — ale ani ✅ zatím neznamená ověřený běh naživo.
