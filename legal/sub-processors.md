# Sub-processors — DRAFT

> ⚠️ DRAFT. Aktualizovat až po finálních volbách v Fázi 0 setup.

**Last updated:** 2026-05-21
**Effective from:** TBD (před Fáze 1 launch)

## Co je sub-processor

Sub-processor (dílčí zpracovatel) je třetí strana, kterou Shopio jako data processor pověřuje zpracováním osobních údajů svých zákazníků (merchantů). Per GDPR Art. 28 musíme tyto sub-processory disclosovat předem a získat souhlas merchantů.

## Notification policy

- **Nový sub-processor:** notifikace všem merchantům **30 dní předem** (email + in-app)
- **Merchant má 30 dní právo námitky** — pokud merchant nesouhlasí, můžeme buď přestat sub-processor používat NEBO merchant smlouvu vypovědět
- **Sub-processor change** (e.g., upgrade plan): notifikace + update této stránky
- **Sub-processor removal:** notifikace na vědomí

## Současný seznam sub-processorů

### Infrastruktura

| Sub-processor | Účel | Data zpracovávaná | Region | Compliance |
|---|---|---|---|---|
| **AWS (Amazon Web Services EMEA SARL)** | Compute, storage, databáze | Veškerá tenant + customer data | eu-central-1 (Frankfurt) + eu-west-3 (Paris) DR | ISO 27001, SOC 2 Type II, GDPR DPA |
| **Cloudflare, Inc.** | CDN, WAF, DDoS, DNS | Network metadata, request headers | EU edge | ISO 27001, SOC 2, GDPR DPA |

### Platby

| Sub-processor | Účel | Data | Region | Compliance |
|---|---|---|---|---|
| **Stripe Payments Europe Ltd.** | Card processing, Connect payouts | Card tokens (NE PAN), customer email, billing address | EU + US | PCI DSS Level 1, SOC 2, GDPR DPA |
| **GoPay s.r.o.** | CZ payment gateway | Order metadata, customer email | CZ | PCI DSS, GDPR DPA |
| **ComGate Payments a.s.** | CZ payment gateway | Order metadata | CZ | PCI DSS, GDPR DPA |
| **ThePay a.s.** | CZ payment gateway | Order metadata | CZ | PCI DSS, GDPR DPA |
| **PayPal (Europe) S.à r.l. et Cie, S.C.A.** | International payments | Customer email | Luxembourg | PCI DSS, GDPR DPA |

### Doprava

| Sub-processor | Účel | Data | Region | Compliance |
|---|---|---|---|---|
| **Zásilkovna s.r.o.** | CZ/SK package delivery | Recipient name, address, phone | CZ | GDPR DPA |
| **Česká pošta s.p.** | CZ delivery | Recipient name, address | CZ | Statutory data protection |
| **PPL CZ s.r.o.** | CZ delivery | Recipient name, address, phone | CZ | GDPR DPA |
| **DPD CZ s.r.o.** | CZ/EU delivery | Recipient name, address, phone | CZ/EU | GDPR DPA |

### Komunikace + marketing

| Sub-processor | Účel | Data | Region | Compliance |
|---|---|---|---|---|
| **Twilio SendGrid** (nebo **Postmark / Brevo**) | Transakční email | Recipient email, content | EU/US | SOC 2, GDPR DPA |
| **Mailchimp (Intuit)** | Marketing email (pokud merchant connect) | Subscriber email, behavior | US (DPA + SCC) | GDPR DPA + Standard Contractual Clauses |
| **Klaviyo, Inc.** | Marketing automation (pokud merchant connect) | Customer email, behavior | US | SOC 2, GDPR DPA + SCC |

### AI providers

| Sub-processor | Účel | Data | Region | Compliance |
|---|---|---|---|---|
| **Anthropic PBC** | Claude AI (primary) | Prompts (subject to PII scrubbing per `30 §7.1.1`) | EU + US (zero-retention enterprise tier) | SOC 2, GDPR DPA |
| **OpenAI Ireland Ltd.** | GPT (fallback) | Prompts (PII-scrubbed) | EU + US | SOC 2, GDPR DPA |

### Vývojářské + monitoring

| Sub-processor | Účel | Data | Region | Compliance |
|---|---|---|---|---|
| **Sentry (Functional Software, Inc.)** | Error tracking | Stack traces, sanitized request data | EU + US | SOC 2, GDPR DPA |
| **GitHub, Inc.** | Source code repository | Code (no customer data) | US | SOC 2, GDPR DPA |
| **Anthropic Claude Code** | AI-assisted development | Code snippets, internal docs (no customer PII) | US | DPA, internal use only |

### Účetnictví

| Sub-processor | Účel | Data | Region | Compliance |
|---|---|---|---|---|
| **Stormware s.r.o. (Pohoda)** | Účetní software (pokud merchant connect) | Faktury, customer data | CZ | GDPR DPA |
| **Solitea Česká republika a.s. (iDoklad)** | Účetní software | Faktury | CZ | GDPR DPA |

### Comparison shopping (per merchant config)

| Sub-processor | Účel | Data | Region | Compliance |
|---|---|---|---|---|
| **Heureka Group a.s.** | Cenový srovnávač CZ/SK | Product catalog only | CZ | Standard provider |
| **Seznam.cz a.s. (Zboží.cz)** | Cenový srovnávač CZ | Product catalog only | CZ | Standard provider |
| **Glami a.s.** | Fashion shopping | Product catalog only | EU | Standard provider |
| **Google Ireland Ltd. (Google Shopping, GA4, Google Ads)** | Shopping feed + analytics + ads | Product catalog, anonymized analytics | EU+US | GDPR DPA + SCC |
| **Meta Platforms Ireland Ltd. (Meta CAPI, Catalog)** | Catalog feed + ads | Product catalog, server-side events (hashed customer email) | EU+US | GDPR DPA + SCC |
| **TikTok Information Technologies UK Ltd.** | Catalog + ads | Same | EU+US | GDPR DPA + SCC |

### Pomocné (na žádost merchanta)

| Sub-processor | Účel | Data | Region |
|---|---|---|---|
| **Trustpilot A/S** | Reviews (pokud merchant connect) | Review post-purchase email | DK |
| **Heureka Recenze ("Ověřeno zákazníky")** | Reviews CZ | Order email | CZ |

## Sub-processors NOT used (záměrně)

Z důvodů EU data sovereignty + cost + GDPR considerations Shopio záměrně nepoužívá:

- **Datadog** (US-only observability — používáme Grafana stack self-host)
- **New Relic** (US-only)
- **AWS US regions** (kromě DR replikací nikdy)
- **Cloudflare Workers AI** (nemá EU-only opt-in)
- **Vercel** (US-based; používáme self-host EU)
- **Twilio Segment** (US-only CDP)
- **HubSpot Operations Hub** (US-only iPaaS)

## Customer data flow shrnutí

```
Storefront (customer) → Shopio API (EU)
                          ↓
                  Postgres (EU Frankfurt)
                          ↓
              ┌───────────┴───────────┐
              ↓                       ↓
         Payment provider       AI provider
         (Stripe / GoPay)       (Anthropic EU
                                  zero-retention)
              ↓
         Shipping carrier
         (Zásilkovna / ČP)
```

## Žádosti o detail

Pro detailní DPA + processing details kontaktujte: **dpo@shopio.com** (po Fáze 0 setup).

---

**Verze:** 0.1 (DRAFT)
**Datum poslední aktualizace:** 2026-05-21
**Schválil:** TBD (DPO + legal review)
