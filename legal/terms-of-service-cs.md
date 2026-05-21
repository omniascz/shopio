# Obchodní podmínky platformy Shopio — DRAFT

> ⚠️ DRAFT — vyžaduje kontrolu právníkem.

**Účinné od:** TBD
**Verze:** 0.1 (DRAFT)

## 1. Smluvní strany

**Poskytovatel:**
Shopio s.r.o. *(finální entita TBD)*
Sídlo: TBD
IČO: TBD
DIČ: CZ-TBD
Email: support@shopio.com

**Zákazník (Merchant):**
Fyzická nebo právnická osoba registrovaná na shopio.com nebo self-host operátor používající Shopio software.

## 2. Předmět smlouvy

Shopio poskytuje **e-commerce platformu** jako:
- **Shopio Cloud** — managed SaaS (poskytovaná Shopio)
- **Apache 2.0 self-host distribuce** — open-source verze pro vlastní hosting

Tyto OP se vztahují primárně na Shopio Cloud. Self-host uživatelé používají Apache 2.0 licenci (zdarma, bez SLA).

## 3. Registrace a účet

- Pro Shopio Cloud nutná registrace na shopio.com
- Merchant musí být **18+ let** a oprávněn uzavírat smlouvy
- Poskytnuté údaje musí být **pravdivé a aktuální** (povinnost aktualizace)
- Merchant odpovídá za bezpečnost svého účtu (heslo, MFA, passkeys)
- **Jeden účet vlastníka per tenant** (převody účtů přes funkci "Owner transfer")

## 4. Pricing a fakturace

Detail viz [shopio.com/pricing](https://shopio.com/pricing).

Tier MVP:
| Plan | Měsíčně | Transakční fee | Limit |
|---|---|---|---|
| Free | 0 € | 0.5% | 50k AI tokenů, 1 store |
| Growth | 29 € | 0.3% | 1M tokenů, 2 stores |
| Scale | 99 € | 0.1% | 10M tokenů, 5 stores |
| Pro | 299 € | 0% | 100M tokenů + overage, 25 stores |
| Enterprise | Custom | Custom | Vlastní DPA, BYOK |

- **Měsíční fakturace** v Eurech
- Splatnost 14 dní od vystavení
- Po splatnosti +5 dní toleranceperiod → suspension účtu
- Storno: kdykoliv k konci běžícího období; **bez vrácení peněz** za běžící období (poměrová politika v Enterprise tier)
- Změna tarifu: okamžitě (pro-rata calculation)

VAT/DPH:
- CZ merchants: DPH 21% standardní
- EU merchants s VAT ID: reverse charge (bez DPH)
- Non-EU: bez DPH

## 5. Použití platformy

Merchant smí používat platformu pouze k legálním účelům. Zakázané je:

- Prodej **zakázaných produktů**: zbraně bez licence, drogy, ukradené zboží, padělané zboží, hodiny obsahující ohrožující dětského pornografie nebo extremistický obsah
- Spam / unsolicited komunikace (kromě GDPR-compliant emailingu)
- **Manipulace recenzí** (fake reviews, brigading)
- **Daňové podvody**, praní špinavých peněz
- Reverse engineering platformy (s výjimkou OSS core)
- Pokus o **interferenci s jinými merchanty** (security incident)

Shopio si vyhrazuje právo **suspend nebo terminate** účty porušující toto, s notifikací 7 dní předem (kromě bezpečnostních incidentů — okamžitě).

## 6. SLA (Service Level Agreement)

Per `zadani/31-operations.md §9.1`:

| Tier | Měsíční uptime SLA | Refund credit |
|---|---|---|
| Free | best effort | žádný |
| Growth | 99.5% | 10% za missed |
| Scale | 99.9% | 25% za missed |
| Pro | 99.9% | 25% |
| Enterprise | 99.95% + custom MTTR | Custom |

Vyloučené z SLA:
- Plánovaná údržba (oznámeno 7 dní předem)
- Customer-caused issues (invalid input, neplatná karta)
- Třetí strany (Stripe outage atd. s atestací)

## 7. Licence + duševní vlastnictví

### 7.1 Apache 2.0 core
- Open-source verze Shopio platformy pod **Apache License 2.0** (viz `LICENSE`)
- Merchant smí self-host, upravit, redistribuovat per Apache 2.0 terms
- "Shopio" ochranná známka NENÍ pokryta Apache 2.0 (viz odd. 8)

### 7.2 Commercial modules
- Některé moduly (AI Copilot enterprise, advanced analytics) pod proprietary EULA
- License key povinný pro aktivaci

### 7.3 Merchant data
- **Merchant vlastní svá data** (catalog, customers, orders, content)
- Shopio má licenci je zpracovávat výhradně za účelem provozu platformy (per privacy policy)
- Při ukončení smlouvy: merchant má 90 dní na export před permanentním smazáním

## 8. Ochranná známka

"Shopio" je registrovaná ochranná známka Shopio s.r.o. *(po finální registraci)*.

Smí použít:
- Self-host operátoři pro popis "Built on Shopio" / "Powered by Shopio"
- Plugin developers v marketplace listings

Nesmí použít:
- Konkurentní produkty
- Misleading branding (např. "Shopio Pro Hosting" když nejste přidruženi)
- V názvech subdomén bez explicit povolení

## 9. Odpovědnost a omezení

### 9.1 Vyloučení záruk

Shopio platforma je poskytována **"as-is"**. Vyjma SLA neposkytujeme záruky funkčnosti, vhodnosti pro konkrétní účel atd.

### 9.2 Omezení odpovědnosti

Maximální odpovědnost Shopio za škody = **suma plateb merchantem za posledních 12 měsíců**. Nevztahuje se na případy:
- úmyslné porušení smlouvy
- hrubá nedbalost
- porušení GDPR vůči koncovým zákazníkům (zákonná odpovědnost)

### 9.3 Indemnifikace

Merchant odpovídá za obsah svého e-shopu (produkty, popis, marketing). Pokud Shopio dostane právní nárok od třetí strany kvůli merchant content, merchant odpovídá za náklady obrany.

## 10. Marketplace + plugins

Per `zadani/28-developer-platform.md`:

- Plugin marketplace 80/20 revenue share (80% developer, 20% Shopio)
- Plugins reviewed před zveřejněním (security + UX)
- Merchant si instaluje plugins na vlastní zodpovědnost
- Shopio nezodpovídá za škody způsobené 3rd-party plugins (kromě platformy infra)

## 11. AI features + EU AI Act

Per `zadani/33-ai-features.md`:

- AI features jsou součástí platformy, použití nepovinné
- Vysokorizikové AI rozhodování (fraud scoring) má human review
- Merchant smí použít BYOK (vlastní AI API key) bez Shopio účtování
- AI generated obsah označen badge (transparentnost per EU AI Act)
- Merchant odpovídá za obsah generovaný AI, který publikuje na svém e-shopu

## 12. Ochrana osobních údajů

Detail viz [Privacy Policy](./privacy-policy-cs.md). DPA podepsaná automaticky při registraci nebo separately pro Enterprise tier.

## 13. Ukončení smlouvy

### 13.1 Ze strany merchanta
- Kdykoliv, oznámení v admin "Cancel subscription"
- Účet zůstane aktivní do konce zaplaceného období
- Po vypršení: 90 dní grace pro export → permanentní smazání

### 13.2 Ze strany Shopio
- Porušení OP (s notifikací 7 dní, výjimka security)
- Nezaplacení po toleranceperiod
- Insolvence merchanta / likvidace Shopio
- **Force majeure** (regulatory shutdown, war, etc.)

### 13.3 Survival klauzule
Klauzule, které přetrvávají po ukončení:
- Účetní povinnosti (Shopio uchová účetní data 10 let)
- Audit log (5 let)
- IP rights
- Pending platby
- Confidentiality

## 14. Rozhodné právo a soudní příslušnost

- **Rozhodné právo:** Česká republika
- **Soudní příslušnost:** věcně + místně příslušný soud podle sídla Shopio (Praha)
- B2C consumer overrides: pokud merchant = fyzická osoba kupující jako spotřebitel (rare), platí spotřebitelská ochrana podle jeho domovského práva (Brusel I bis / Řím II)

## 15. Změny OP

- Aktualizace OP: notifikace **30 dní předem** (email + in-app)
- Merchant má právo neaktivovat — vypovědět smlouvu
- Pokračování v používání po datu účinnosti = souhlas

## 16. Komunikace + jazyk

- Smlouva uzavřena v **češtině** primárně; anglická verze pro non-CZ merchants
- V případě rozporu vítězí česká verze (kromě EN tier customers s EN smlouvou)
- Oficiální komunikace: email registrovaný v admin

## 17. Salvátorská klauzule

Pokud je některé ustanovení neplatné/neúčinné, ostatní zůstávají v platnosti. Strany se dohodnou na náhradě nejbližšího významu.

## 18. Závěrečná ustanovení

- OP nahrazují všechny předchozí dohody
- Žádné ústní dohody — všechno písemně nebo elektronicky
- Příjem registrace = akceptace OP v aktuálním znění

---

**DRAFT — vyžaduje:**
- [ ] Právní review (CZ obchodní právo + EU consumer)
- [ ] Finalizace pricing tiers (Fáze 0 sign-off)
- [ ] Doplnění firemních údajů (IČO/sídlo)
- [ ] Účetní úprava DPH klauzulí dle účetní
- [ ] Sync se Privacy Policy + DPA
- [ ] EN verze
