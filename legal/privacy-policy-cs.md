# Zásady ochrany osobních údajů — Shopio — DRAFT

> ⚠️ DRAFT — vyžaduje kontrolu právníkem před publikací.

**Účinné od:** TBD
**Verze:** 0.1 (DRAFT)

## 1. Kdo jsme

Shopio je e-commerce platforma provozovaná společností:

**Shopio s.r.o.** *(nebo finální právní entita)*
Sídlo: TBD
IČO: TBD
DIČ: CZ-TBD
Zápis v OR: TBD
Email: privacy@shopio.com
DPO (Data Protection Officer): dpo@shopio.com

Jsme **správce** osobních údajů našich přímých zákazníků (merchantů — uživatelů admin rozhraní) ve smyslu GDPR Art. 4(7).

Pro koncové zákazníky merchantů (kupující v jejich e-shopech) jsme **zpracovatel** podle pokynů merchanta (Art. 4(8)). Detail v DPA s každým merchantem.

## 2. Kontaktní údaje

- Obecné dotazy: privacy@shopio.com
- DPO: dpo@shopio.com
- Adresa: viz výše
- Telefon: TBD

Pro stížnosti se můžete obrátit také na **Úřad pro ochranu osobních údajů ČR** (https://www.uoou.cz).

## 3. Jaké údaje zpracováváme

### 3.1 Údaje merchant účtů (správce)

Při registraci a používání admin rozhraní zpracováváme:

| Kategorie | Údaje | Důvod |
|---|---|---|
| Identifikační | Jméno, příjmení, název firmy, IČO, DIČ | Smluvní vztah, fakturace |
| Kontaktní | Email, telefon, fakturační adresa | Komunikace, fakturace |
| Autentizační | Hash hesla, passkey credentials, MFA secret (encrypted) | Bezpečnost přihlášení |
| Účetní | Platební metoda (tokenizovaná Stripe), historie plateb | Plnění smlouvy |
| Provozní | IP adresa, browser, log činnosti, audit log | Bezpečnost, ladění |
| Komunikace | Korespondence se support, ticket history | Plnění smlouvy + zlepšování služby |

### 3.2 Cookies + analytika

Viz [Cookie Policy](./cookie-policy-cs.md).

### 3.3 Údaje koncových zákazníků (zpracovatel pro merchanty)

Když je Shopio platforma použita konkrétním merchantem, jeho zákazníci poskytují merchantovi své údaje (jméno, adresa, email, telefon, historie nákupů, ...). Shopio je v tomto vztahu **zpracovatel** — řídí se pokyny daného merchanta. Detail v DPA mezi Shopio a daným merchantem.

## 4. Účel a právní základ zpracování

| Účel | Právní základ (GDPR Art. 6) | Doba uchování |
|---|---|---|
| Plnění smlouvy (poskytování platformy) | Smlouva (6.1.b) | Po dobu trvání + retenční periody |
| Fakturace + účetnictví | Právní povinnost (6.1.c — Zákon č. 563/1991 Sb.) | 10 let (CZ zákon o účetnictví) |
| Bezpečnost (audit log, anomalie) | Oprávněný zájem (6.1.f) | 2 roky hot, 5 let cold |
| Marketing (jen pokud souhlas) | Souhlas (6.1.a) | Do odvolání souhlasu |
| Komunikace se zákazníkem | Smlouva + oprávněný zájem | 5 let po posledním kontaktu |
| Vývoj produktu (anonymizované analytiky) | Oprávněný zájem | 2 roky |

## 5. Komu data sdílíme

Pouze **sub-processorům** (zpracovatelům s námi smluvně vázaným) — kompletní [seznam zde](./sub-processors.md).

Hlavní kategorie:
- AWS (hosting EU)
- Stripe (platby)
- Anthropic / OpenAI (AI features — s PII scrubbing)
- Cloudflare (CDN/WAF)
- Doprava (jen pro vyřízení dopravy: Zásilkovna, ČP, PPL, DPD)

**Nikdy** neposíláme údaje:
- Třetím stranám pro marketing bez souhlasu
- Mimo EU bez Standard Contractual Clauses (kde to platí)
- Pro AI training (zero-retention enterprise tier u providers)

## 6. Mezinárodní přenosy

Většina dat zůstává v EU (Frankfurt + Paris). Některé sub-processory (Anthropic, OpenAI, Mailchimp, Klaviyo) mají infrastrukturu v USA. Pro tyto přenosy používáme:

- **Standard Contractual Clauses (SCC)** EU Commission 2021/914
- Dodatečné technické záruky (pseudonymizace, šifrování v tranzitu i v klidu)
- Per-tenant možnost vyžádat EU-only zpracování (Enterprise tier)

## 7. Vaše práva (GDPR Art. 15-22)

Jako subjekt údajů máte právo na:

| Právo | Jak uplatnit |
|---|---|
| Přístup (Art. 15) | Email privacy@shopio.com nebo self-service v admin |
| Opravu (Art. 16) | Self-service v admin profilu |
| Vymazání (Art. 17) | Email dpo@shopio.com nebo "Smazat účet" v admin |
| Omezení zpracování (Art. 18) | Email dpo@shopio.com |
| Přenositelnost (Art. 20) | Export v admin (Settings → Data Export) |
| Námitka (Art. 21) | Email dpo@shopio.com |
| Stížnost u dozorového úřadu | ÚOOÚ (uoou.cz) |

**Reakční doba:** do 30 dnů od žádosti (GDPR Art. 12.3). První žádost zdarma.

## 8. Bezpečnost

Per Build-spec `zadani/30-security.md`:

- TLS 1.3 in transit
- AES-256 at rest (KMS-managed keys, per-tenant DEK)
- Passkey-first autentizace (WebAuthn)
- MFA enforced pro privileged accounts
- Audit log immutable + tamper-evident (hash chain + signed batches)
- Pravidelné penetration testy (annual external)
- ISO 27001 certifikace (cíl Year 1)
- SOC 2 Type II (cíl Year 2)

## 9. Incidenty (breach notification)

Pokud dojde k bezpečnostnímu incidentu, který může mít závažný dopad na vaše práva, **informujeme ÚOOÚ do 72 hodin** a vás bez zbytečného odkladu (GDPR Art. 33-34).

## 10. Děti

Shopio platformu nesměřujeme dětem mladším 16 let (CZ věk pro digital consent). Pokud zjistíme, že jsme nevědomky shromáždili data dítěte mladšího 16 let, údaje smažeme.

## 11. Změny této politiky

Aktualizace zveřejníme zde + notifikujeme registrované merchanty emailem **30 dní předem**. Pokračování v používání platformy po účinnosti změny = souhlas.

## 12. AI features + EU AI Act

Některé funkce platformy používají AI (AI Copilot, content generation, recommendations). Per EU AI Act:
- Při interakci s AI vás transparentně informujeme (badge "AI-generated" / "AI assistant")
- Vysokorizikové AI rozhodování (fraud scoring) má human review
- Máte právo požádat o lidský přezkum jakéhokoliv AI rozhodnutí
- AI vstupy procházejí PII scrubbingem před odesláním externím providerům

Detail: [Trust Center](https://shopio.com/trust) (po launchi).

---

**DRAFT — Pro publikaci vyžaduje:**
- [ ] Právní review (CZ + GDPR specialist)
- [ ] Finalizace firma IČO/DIČ/sídlo
- [ ] Datum účinnosti
- [ ] Validation že všechny sub-processors v `sub-processors.md` jsou skutečně používány
- [ ] EN verze synchronizovaná
- [ ] Cookie policy hotový
- [ ] DPO email funkční
