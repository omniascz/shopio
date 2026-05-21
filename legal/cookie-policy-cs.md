# Cookie Policy — Shopio — DRAFT

> ⚠️ DRAFT. Vyžaduje právní + UX review.

**Účinné od:** TBD
**Verze:** 0.1

## Co jsou cookies

Cookies jsou malé textové soubory ukládané ve vašem prohlížeči. Některé jsou **nezbytné** (pro fungování stránky), jiné slouží k **analytice / preferencím / marketingu**.

## Naše cookies

### Nezbytné (vždy aktivní)

| Cookie | Účel | Doba |
|---|---|---|
| `shopio_session` | Přihlášení do admin | Session |
| `shopio_csrf` | CSRF ochrana | Session |
| `shopio_locale` | Jazyková preference | 1 rok |
| `cf_clearance` | Cloudflare bot detection | 30 dní |

**Právní základ:** Oprávněný zájem (GDPR Art. 6.1.f) + nutnost pro plnění smlouvy (6.1.b). Souhlas nevyžadován per ePrivacy Directive (functional necessity exception).

### Analytické (pouze se souhlasem)

| Cookie | Účel | Doba |
|---|---|---|
| `_ga` | Google Analytics 4 (anonymizované) | 2 roky |
| `_shopio_analytics` | Internal product analytics | 1 rok |

**Právní základ:** Souhlas (GDPR Art. 6.1.a).

### Marketingové (pouze se souhlasem)

| Cookie | Účel | Doba |
|---|---|---|
| `_fbp` | Meta Pixel (pokud merchant aktivuje) | 90 dní |
| `_ttp` | TikTok pixel | 13 měsíců |

## Vaše volby

- **Cookie banner** vám umožní souhlas / nesouhlas / customize
- **Změnit** kdykoliv: Footer → "Cookie settings"
- **Browser settings** mohou taky blokovat cookies (může degradovat funkčnost)

## "Do Not Track"

Respektujeme browser DNT header. Pokud DNT=1, marketingové cookies vůbec nenastavíme.

## Více informací

- [Privacy Policy](./privacy-policy-cs.md)
- [Sub-processors](./sub-processors.md)
- ÚOOÚ: https://www.uoou.cz/cookies
- Browser-specific guides: aboutcookies.org

---

**DRAFT — vyžaduje:**
- [ ] Cookie audit po aktivaci skutečných služeb (GA4, Meta atd.)
- [ ] Sync s cookie banner implementací (per `zadani/19 §`)
- [ ] EN verze
