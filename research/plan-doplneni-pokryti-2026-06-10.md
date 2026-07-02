# Plán doplnění: pokrytí konkurence + build moduly (2026-06-10)

> Čestné přiznání: pokrytí 29 platforem NENÍ kompletní napříč CZ/SK/PL/DACH/UK/US. Tento plán (1) dohání chybějící platformy, (2) konsoliduje build moduly z nově zachycených věcí.

## STAV 2026-06-10 po vlně 3a — DOPLNĚNO +19 platforem (celkem ~48)
✅ Nově ověřeno živě: SAP Commerce Cloud, VTEX, Spryker, OroCommerce, Saleor, Medusa, Elastic Path, NetSuite SuiteCommerce (US/global enterprise+composable); Comarch e-Sklep, AtomStore (PL); Shopsys, ShopCentrik (CZ); ePages, Shopgate (DACH); Shift4Shop, Square Online, Webflow (US SMB); Mirakl (FR/marketplace); ShopWired (UK).
**Trhy teď solidně pokryté:** global/enterprise, FR, DACH, CZ, SK, PL, UK — všechny mají hlavní + mid hráče.
**ZBÝVÁ jen long-tail (nízká marginální hodnota, malí/niche — nepravděpodobné nové kategorie featur):** Kibo, fabric, Sylius, Vendure (composable/OSS); Volusion, Big Cartel, GoDaddy, Miva (US SMB); xt:Commerce/modified, VersaCommerce, Strato/IONOS (DACH); oXyShop, ByznysWeb (CZ); Selly, Sellingo (PL); Oxatis, PowerBoutique (FR); Bluepark, Sellerdeck (UK). → doplnit dle potřeby, ne blocker.

## STAV 2026-06-10 po vlně 3b — LONG-TAIL HOTOVÝ (+21, celkem ~68 platforem)
✅ Doplněno: Kibo, fabric, Sylius, Vendure (composable/OSS); Volusion, Big Cartel, GoDaddy, Miva (US SMB); xt:Commerce/modified, VersaCommerce, STRATO Webshop, IONOS (=Ecwid engine) (DACH); oXyShop, ByznysWeb (CZ — pozn.: byznysweb.cz a biznisweb.sk jsou sesterské produkty 1 firmy); Selly, Sellingo (ex-ClickShop), SOTESHOP (PL); Oxatis, PowerBoutique, Bluepark, Sellerdeck (FR/UK).
**POKRYTÍ KOMPLETNÍ** napříč global/US/UK/FR/DACH/CZ/SK/PL — hlavní, mid i malí hráči.
**Čestné mezery v datech:** (1) **Inteo / WebJET eShop (SK)** se nepodařilo ověřit jako reálný distinct e-commerce produkt → nevymýšleno, vynecháno. (2) **Korekce: Oxatis NENÍ sloučen s WiziShop** — oddělené firmy (Oxatis → Lundi Matin, koupil PowerBoutique 2018; WiziShop nezávislý). (3) U agenturních/bespoke (ShopCentrik) a malých SaaS zůstalo dost „Unknown" — nezveřejňují feature matici; nehádáno.
**Závěr z long-tailu:** potvrzeno, že malé platformy **nepřinášejí nové kategorie featur** — replikují vzory velkých (Allegro/dropshipping v PL, POS+účetní konektory v CZ/DACH, B2B trade pricing v UK). Jediné nové frontier věci viz moduly #49–50 níže.

## ČÁST A — díry v pokrytí konkurence (co dohnat)

Stav: ✅ hotovo (live ověřeno) · 🔄 ve výzkumu teď · ⬜ zbývá.

### US / global enterprise & composable (NEJSLABŠÍ pokrytí)
| Platforma | Proč důležitá | Stav |
|---|---|---|
| SAP Commerce Cloud (Hybris) | enterprise B2B/B2C leader | 🔄 |
| VTEX | global enterprise (LATAM/EU), marketplace+OMS | 🔄 |
| Spryker | composable enterprise (DACH-origin, global B2B) | 🔄 |
| Elastic Path | composable/headless B2B | 🔄 |
| Oracle NetSuite SuiteCommerce | ERP-native commerce | 🔄 |
| OroCommerce | open-source B2B leader | 🔄 |
| Medusa | open-source headless (JS) | 🔄 |
| Saleor | open-source GraphQL-native | 🔄 |
| Kibo, fabric, Sylius, Vendure | composable/OSS long-tail | ⬜ |

### US SMB
| Shift4Shop, Square Online (Weebly), Webflow Ecommerce | 🔄 |
| Volusion, Big Cartel, GoDaddy, Miva | ⬜ |

### DACH (doplnit k Shopware/JTL/plentyONE/OXID/Gambio)
| ePages, Shopgate | 🔄 |
| xt:Commerce/modified, VersaCommerce, Strato/IONOS | ⬜ |

### CZ (doplnit k Shoptet/Upgates/FastCentrik/Eshop-rychle/Webareál)
| Shopsys (enterprise B2B framework) | 🔄 |
| ShopCentrik (B2B, NetDirect) | 🔄 |
| oXyShop, ByznysWeb | ⬜ |

### PL (doplnit k Shoper/IdoSell/BaseLinker/Sky-Shop/RedCart)
| Comarch e-Sklep (ERP-backed, velký) | 🔄 |
| AtomStore (B2B), SOTESHOP | 🔄 |
| Selly, Sellingo/ClickShop | ⬜ |

### FR (doplnit k PrestaShop/WiziShop)
| Mirakl (marketplace-as-a-service) | 🔄 |
| Oxatis (→WiziShop), PowerBoutique | ⬜ |

### UK (doplnit k EKM/Visualsoft)
| ShopWired | 🔄 |
| Bluepark, Sellerdeck | ⬜ |

### SK
Trh tenký, hlavní hráči pokryti (Shoptet SK, Upgates SK, BiznisWeb). Volitelně ⬜ WebSupport eshop, Inteo.

## ČÁST B — build moduly (konsolidace „nově zachycených věcí")

Plný backlog: `plan-vyroby-chybejici-moduly.md` (moduly 1–42). Pořadí dle rozšířenosti × dopad CZ/SK/PL:

**Vlna výroby 1 — čistě kód, bez klíčů (začít hned):**
1. Audit-log zápisy (#8) · 2. 2FA admin (#9) · 3. Return-window per země (#6) · 4. OSS threshold (#4) · 5. EPR reporting (#5) · 6. Customer segments (#36) · 7. Product modifiers (#37)

**Vlna 2 — region table-stakes (potvrzeno live daty):**
8. **Externí marketplace sync** (#10, povýšeno — největší díra napříč všemi) · 9. **POS** (#22, povýšeno) · 10. Účetní konektory iDoklad/Fakturoid (#3) · 11. CZ dopravci nativně (#1) · 12. BNPL CZ/SK (#26)

**Vlna 3 — enterprise hloubka:**
13. Multi-warehouse (#14) · 14. B2B hloubka + punchout/OCI (#15,#41) · 15. Digital fulfillment (#18) · 16. Loyalty tiers (#16) · 17. Subscriptions auto-charge (#17) · 18. Metafields/PIM (#19) · 19. Flow/Rule Builder (#20)

**Vlna 4 — platforma & AI:**
20. AI semantic+image search (#38) · 21. AI chatbot (#39) · 22. AI překlad (#40) · 23. Express wallets (#24) · 24. GraphQL/headless (#21) · 25. Multi-storefront (#23) · 26. A/B testing (#35) · 27. Dropshipping síť (#42)

> Po doběhnutí výzkumu chybějících platforem (ČÁST A) tento build backlog re-zkontrolovat — můžou přibýt nové moduly (zvlášť z enterprise composable a US).
