# Data Processing Agreement (DPA) Template — DRAFT

> ⚠️ DRAFT. Vyžaduje právní review (GDPR specialist). Toto je B2B DPA mezi Shopio (zpracovatel) a Merchant (správce) per GDPR Art. 28.

**Verze:** 0.1
**Účinné od:** TBD

---

## Smluvní strany

**Správce** (Controller):

- [Merchant company name]
- IČO: [_______]
- Sídlo: [_______]
- Email: [_______]

**Zpracovatel** (Processor):

- Shopio s.r.o.
- IČO: TBD
- Sídlo: TBD
- DPO email: dpo@shopio.com

(společně dále "Strany")

---

## 1. Předmět DPA

Tato dohoda upravuje zpracování osobních údajů ze strany Shopio (jako processor) pro Merchant (jako controller) v souladu s GDPR Art. 28.

DPA je nedílnou součástí **Smlouvy o poskytování služeb Shopio platformy** (Master Service Agreement / ToS).

## 2. Definice

- **GDPR**: Nařízení EU 2016/679
- **Osobní údaje** / **Personal Data**: Per GDPR Art. 4(1)
- **Zpracování** / **Processing**: Per GDPR Art. 4(2)
- **Sub-processor**: Třetí strana provádějící zpracování pro Shopio
- **Standard Contractual Clauses (SCC)**: EU Commission Decision 2021/914

## 3. Předmět + doba + povaha zpracování (Art. 28.3)

| Atribut     | Detail                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------- |
| **Předmět** | Poskytování Shopio platformy (e-commerce) Merchantovi                                                   |
| **Doba**    | Doba trvání Smlouvy + 90 dní grace period pro export                                                    |
| **Povaha**  | Hosting + zpracování dat v rámci platformy                                                              |
| **Účel**    | Plnění funkcí e-commerce platformy: catalog, orders, customers, payments, marketing, analytics, support |

## 4. Kategorie subjektů údajů

| Kategorie                   | Příklad                                         |
| --------------------------- | ----------------------------------------------- |
| Koncoví zákazníci Merchanta | Kupující v e-shopu Merchanta                    |
| Zaměstnanci Merchanta       | Admin uživatelé v Merchant tenantu              |
| Návštěvníci e-shopu         | Anonymní (cookies, IP)                          |
| Marketing audience          | Pokud Merchant používá email marketing features |

## 5. Kategorie osobních údajů

| Kategorie         | Příklad                                      | Citlivost |
| ----------------- | -------------------------------------------- | --------- |
| Identifikační     | Jméno, příjmení, email                       | Běžná     |
| Kontaktní         | Telefon, adresy                              | Běžná     |
| Účetní            | Faktury, historie nákupů                     | Běžná     |
| Komunikační       | Zprávy mezi merchantem a koncovým zákazníkem | Běžná     |
| IP / device       | IP, browser fingerprint, cookies             | Běžná     |
| Authentication    | Hash hesel, passkeys, MFA                    | Důvěrná   |
| Behavioral        | Analytika, search history (anonymizováno)    | Běžná     |
| Marketing consent | Souhlas s emailem                            | Běžná     |

**Zvláštní kategorie údajů (Art. 9):** Standardně Shopio nezpracovává. Pokud Merchant prodává kategorií vyžadujících speciální údaje (např. zdravotní pomůcky vyžadující healthcare data), musí se Strany dohodnout zvlášť.

## 6. Práva a povinnosti Stran

### 6.1 Shopio (Processor) bude:

- Zpracovávat údaje **pouze podle pokynů Merchanta** (rozsah Smlouvy + tento DPA)
- Implementovat technical + organizational measures per Art. 32 (viz §8)
- Zajistit důvěrnost zaměstnanců majících přístup k údajům
- **Notifikovat Merchant bez zbytečného odkladu** v případě data breach (do 48h od detekce — interní cíl; GDPR Art. 33 pak Merchant notifikuje DPA do 72h)
- Podporovat Merchant při plnění žádostí subjektů údajů (DSAR)
- Pomáhat Merchantovi s DPIA pokud relevant
- Po ukončení smlouvy: na pokyn vrátit/smazat všechna data (Art. 28.3.g) — 90 dní grace period
- Umožnit audit Merchanta (jednou ročně, on-site nebo SOC 2 report)

### 6.2 Merchant (Controller) odpovídá:

- Za legalitu zpracování (právní základ per GDPR Art. 6)
- Za získání souhlasů koncových zákazníků (pokud applicable)
- Za informování koncových zákazníků (privacy policy svého e-shopu)
- Za vyřízení žádostí subjektů údajů (Shopio poskytne tooling)
- Za přesnost údajů poskytnutých do platformy

## 7. Sub-processors

Shopio používá sub-processory dle [aktuálního seznamu](./sub-processors.md).

- **Předchozí obecný souhlas**: Merchant souhlasí s aktuálním seznamem podpisem této DPA
- **Notifikace nových sub-processorů**: 30 dní předem (email + in-app)
- **Právo námitky**: Merchant má 30 dní právo námitky → Shopio buď nepoužije, nebo Merchant ukončí Smlouvu
- **Smlouva se sub-processorem**: Shopio uzavírá DPA s každým sub-processorem na stejné úrovni (pass-through clauses)

## 8. Technická a organizační opatření (Art. 32)

Podrobně v [Security Policy](./security-policy-public.md) a `zadani/30-security.md`:

- Šifrování in transit (TLS 1.3) + at rest (AES-256-GCM)
- KMS-managed keys, per-tenant DEK envelope encryption
- Pseudonymizace + minimalizace
- MFA enforced pro privileged accounts
- Audit log immutable + tamper-evident
- Backup + tested restore
- Incident response procedures
- Pravidelné penetration testy
- ISO 27001 certifikace (Year 1 cíl)
- SOC 2 Type II (Year 2 cíl)

## 9. Mezinárodní přenosy (Chapter V GDPR)

Většina dat zůstává v EU. Pro přenosy do USA (Anthropic, OpenAI, Mailchimp, Klaviyo) Shopio:

- Používá **Standard Contractual Clauses (SCC)** modul 2 (Controller-to-Processor)
- Implementuje supplementary measures (encryption, pseudonymization)
- Provádí Transfer Impact Assessment (TIA) per Schrems II

Merchant souhlasí s těmito přenosy podpisem DPA. Pro Enterprise tier možnost EU-only zpracování (vyžaduje plan upgrade).

## 10. Doba uchování + smazání

Per `Privacy Policy §4`:

- Tenant + customer data: po dobu Smlouvy + 90 dní grace
- Účetní data: 10 let (CZ zákonná povinnost)
- Audit log: 5 let (GDPR + security best practice)
- Backup: 7 let (z bezpečnostních důvodů)

Po expiraci retention period: permanentní smazání (KMS key destruction pro Tenant KEK = data unrecoverable).

## 11. Audit + compliance

- Shopio poskytuje **SOC 2 Type II report** (od Year 2; NDA-gated)
- Shopio poskytuje **ISO 27001 certifikát** (od Year 1)
- Merchant má právo na **on-site audit** 1× ročně (s 30-day notice) — pouze pro Enterprise tier
- Other tiers: audit dokumentace dostatečná

## 12. Odpovědnost + náhrada škody

- Per Master Service Agreement §9
- Specific GDPR breach: každá strana odpovídá za svou roli (controller / processor)
- Joint liability vůči subjektům údajů per GDPR Art. 82

## 13. Závěrečná ustanovení

- DPA má prioritu nad MSA v případě rozporu týkajícího se ochrany osobních údajů
- Změny DPA: 30 dní notice; mlčící souhlas / možnost ukončit
- Rozhodné právo: české
- Soudní příslušnost: per MSA (Praha)

---

**Acceptance:**

Touto DPA se obě Strany zavazují k souladu s GDPR. Smlouva se uzavírá elektronicky při registraci Merchanta nebo na vyžádání jako samostatný dokument pro Enterprise tier.

**Za Shopio:**
[Statutory representative]
Datum: TBD

**Za Merchanta:**
[Auto-signed při registraci / elektronicky podepsáno per dokumentu]

---

**DRAFT — vyžaduje:**

- [ ] Legal review (GDPR specialist)
- [ ] Validace sub-processor list (per `sub-processors.md`)
- [ ] SCC moduly 2 + 3 přiložené jako appendix (po consultation)
- [ ] Variant pro Enterprise tier (more flexible audit clauses)
- [ ] EN verze
