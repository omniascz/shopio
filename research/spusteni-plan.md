# Shopio — plán ke spuštění (odškrtávací)

> **Stav:** 2026-06-08 · **Cíl dokumentu:** konkrétní pořadí kroků k tomu, aby **první reálný prodejce přijal první reálnou objednávku**. Odškrtáváme shora dolů.
> **Klíčové zjištění:** Shopio má **víc featur než potřebuje ke spuštění** (často víc než Shoptet). Mezera NENÍ „přidat featury", ale: (1) ověřit integrace proti reálným API, (2) dodělat UI k hotovému backendu, (3) nasadit na produkční infra, (4) jedna funkční platba + doprava, (5) účtování prodejců, ať to vydělává.

---

## Definice hotova (launch milestone)
✅ Reálný prodejce se zaregistruje → nahraje produkty → zákazník zaplatí **reálnou kartou/dobírkou** → přijde **reálný e-mail** → vytiskne se **reálný štítek Zásilkovny** → prodejce dostane peníze na svůj účet → **Shopio si strhne poplatek**.

---

## TRACK A — co musíš udělat TY (externí, blokuje, nedá se nakódovat)

Tohle jsou účty/registrace/rozhodnutí, bez kterých se nehne produkce. Dělej paralelně s Track B.

- [ ] **A1. Platební brána** — vyber **JEDNU** na start (doporučuji **ComGate** nebo **GoPay**, obě CZ/SK). Zaregistruj merchant účet, získej **sandbox** klíče (a později produkční). → odemkne B1.
- [ ] **A2. Transakční e-mail** — zaregistruj **Postmark** (nejjednodušší) nebo AWS SES. Nastav **SPF + DKIM + DMARC** na doméně. → odemkne B2.
- [ ] **A3. Zásilkovna/Packeta** — zaregistruj účet, získej **API password** (`PACKETA_API_PASSWORD`). → odemkne B3.
- [ ] **A4. Hosting + doména** — rozhodni kde (VPS Hetzner/DigitalOcean, nebo managed). Potřebuješ: **managed Postgres 17** (se zálohami!), **Redis**, **S3-kompatibilní storage** (Hetzner Object Storage / Cloudflare R2 / AWS S3), **doménu**. → odemkne B4.
- [ ] **A5. Právní dokumenty** — obchodní podmínky, reklamační řád, zásady ochrany osobních údajů (GDPR), cookies. Šablona (Shoptet/advokát) → vlož jako CMS stránky.
- [ ] **A6. Vlastní firma** — IČO/DIČ Shopia, bankovní účet pro příjem poplatků od prodejců (až bude A7/B9).
- [ ] **A7. Stripe (pro účtování PRODEJCŮ)** — platformní Stripe účet, na kterém budeš účtovat prodejcům předplatné. → odemkne B9.

---

## TRACK B — co stavím JÁ (Claude), v pořadí priority

### 🔴 SPRINT 1 — „první prodej" (kritická cesta, nejvyšší priorita)

- [ ] **B1. Ověřit JEDNU platební bránu proti reálnému sandboxu.** Dnes je 16 bran „kódovaných z dokumentace, jen mock-test". Vybranou (A1) projedu proti reálnému sandbox API, opravím adaptér (podpisy, přesný flow, webhook), ověřím celý cyklus platba→webhook→paid→faktura. *Bez tohohle nelze vzít peníze.*
- [ ] **B2. Reálný e-mail (SMTP).** Napojit Postmark/SES (config + ověřit doručení order/paid/expedice e-mailů). Dnes jen Mailpit (dev).
- [ ] **B3. Ověřit reálný štítek Zásilkovny.** S `PACKETA_API_PASSWORD` projet reálné createPacket + label PDF + tracking webhook.
- [ ] **B4. Produkční nasazení.** Docker stack (`deploy/`) už existuje — dotáhnout: produkční ENV/secrets, napojení na managed Postgres/Redis/S3, healthchecky, SSL (Caddy/Traefik), migrace na produkční DB. Ověřit celý stack na produkčním hostu.
- [ ] **B5. Zálohy + monitoring (minimální).** Automatické denní zálohy Postgresu, základní uptime/error alerting (Sentry + uptime ping). *Bez záloh nelze pustit reálná data.*

→ **Po Sprintu 1 + Track A je možné spustit pilotního prodejce.**

### 🟠 SPRINT 2 — Admin UI k hotovému backendu (aby prodejce mohl ovládat, co umíme)

Tyto featury mají hotový backend+API, ale **chybí jim admin stránka**:

- [ ] **B6a. Slevy/promo** — stránka pro automatické slevy + BOGO (`/admin/promotions`).
- [ ] **B6b. Automatizace (Flow Builder)** — UI builder trigger→podmínky→akce (`/admin/flows`, máme `/meta` endpoint).
- [ ] **B6c. Kolekce** — dynamické kolekce s pravidly + preview (`/admin/collections`).
- [ ] **B6d. Newsletter** — odběratelé + editor kampaní + odeslat (`/admin/newsletter`).
- [ ] **B6e. Měny** — zapnutí presentment měn (EUR/PLN) + tlačítko „aktualizovat ČNB kurzy" (settings).
- [ ] **B6f. Drobnosti** — ARES „načíst z IČO" tlačítko ve formuláři firmy; reverse-charge je automatický (jen ověřit zobrazení na faktuře).

### 🟡 SPRINT 3 — Storefront UI k hotovému backendu (aby to zákazník využil)

Hotový API, chybí zákaznické UI (Next.js storefront):

- [ ] **B7a. Přepínač měny** + zobrazování cen v EUR/PLN (tenant-info `supported_currencies`).
- [ ] **B7b. Server-side wishlist** + adresář adres v `/ucet` (dnes oblíbené jen localStorage).
- [ ] **B7c. Express checkout** — výběr uložené adresy + „koupit znovu" (reorder) — API hotové.
- [ ] **B7d. Doporučení** („často kupováno spolu") na detailu produktu.
- [ ] **B7e. Stránky kolekcí** + newsletter box + EU Omnibus „nejnižší cena za 30 dní" u slev.

### 🟢 SPRINT 4 — Aby to VYDĚLÁVALO

- [ ] **B8. Pickup-point widget** ve storefront checkoutu (Zásilkovna/InPost — výběr výdejního místa mapou). Dnes jen API přijme externalId.
- [ ] **B9. Účtování prodejců (platform billing).** Stripe subscription pro tarify (Free/Growth/Scale/Pro) + per-order fee + dunning. **Tohle je jak vyděláváš.** Dnes plány jen evidované, nevymáhané.

### 🔵 SPRINT 5+ — rozšiřování (až poběží byznys)

- [ ] Ověřit další platební brány proti sandboxu (dle poptávky prodejců).
- [ ] Reální další CZ dopravci (PPL/DPD/ČP) proti reálnému API.
- [ ] Recyklační příspěvky (EKO-KOM), OSS VAT threshold tracking, iDoklad/Fakturoid konektory.
- [ ] PL trh: Allegro konektor, InPost Paczkomaty geowidget.
- [ ] Semantic search (embeddings: Meili vectors / pgvector), AI recommendations rozšíření.
- [ ] POS, multi-warehouse, Rule Builder (až bude reálná poptávka — překrývá se s promo/flow).

---

## Co je NAOPAK už hotové (nestavět znovu)
Katalog/varianty/bundly/kategorie, sklady+rezervace, objednávky+fulfillment+returns, **ISDOC faktury + Pohoda**, **16 platebních bran (kód)**, feedy (Heureka/Zboží/Glami/Google/Ceneo/AI), gift cards, věrnost/store-credit, předplatné, kupóny+promo+BOGO, recommendations, wishlist (API), CMS+page-builder, B2B+reverse-charge+ARES/VIES, marketplace, OAuth+webhooky+API klíče, RLS+GDPR+master-admin, multi-currency, EU Omnibus, Flow Builder, dynamické kolekce, newsletter, **media upload do MinIO/S3** (`lib/storage.ts`), **deploy Docker stack** (`deploy/`).

---

## Doporučené pořadí pro TEBE právě teď
1. **Začni Track A** (A1 platba + A2 e-mail + A4 hosting) — to jsou registrace, trvají dny a blokují všechno.
2. **Já paralelně Sprint 1** (B4 nasazení + B5 zálohy můžu hned; B1/B2/B3 jakmile dáš klíče).
3. Pak **Sprint 2 (admin UI)** — aby pilotní prodejce mohl vše ovládat.
4. Pak **Sprint 3 (storefront UI)** + **B9 účtování**.

**První konkrétní krok ode mě:** můžu hned začít **B4 (dotáhnout produkční nasazení)** + **B5 (zálohy/monitoring)** — nepotřebují tvoje klíče. Nebo Sprint 2 (admin UI), pokud chceš nejdřív vidět ovladatelnost. Řekni a jedu.
