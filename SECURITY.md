# Security Policy

Per [`zadani/30-security.md`](./zadani/30-security.md).

## Reporting a vulnerability

**Neopisuj vulnerability v public GitHub issue, PR komentáři, ani Discord/Slack.** Použij private channel:

- Email: `security@shopio.com` (PGP-encrypted preferováno; klíč fingerprint TBD)
- GitHub Security Advisory (private; vytvoříme po obdržení emailu)

## Co očekávat

- **Acknowledgment:** do 24 hodin
- **Triage:** do 7 dnů
- **Fix:** podle severity (per `30 §12.2`):
  - Critical (CVSS 9.0+): 24 hodin
  - High (7.0-8.9): 7 dnů
  - Medium (4.0-6.9): 30 dnů
  - Low (<4.0): 90 dnů / next release
- **Disclosure:** coordinated, 90-day default; CVE assigned pro významné

## Scope

V scope:
- Shopio core (`apps/`, `packages/`)
- API endpoints (REST + GraphQL + tRPC + MCP)
- Admin UI + storefront UI
- Edge functions infrastructure
- Plugin runtime
- AI Copilot + MCP server
- Customer + admin auth

Out of scope:
- Third-party hosted services (Stripe, Anthropic, AWS — report to them)
- Social engineering / phishing reports
- Physical attacks
- DoS bez exploitu
- Scanner output without proof of exploit
- Tenant-misconfiguration issues without vulnerability in platform

## Bug bounty

Bug bounty program spustíme ve Fáze 2 (per `37 §11.3`) — pravděpodobně přes [Intigriti](https://www.intigriti.com/) (EU-based platform).

V Fáze 0-1 ad-hoc bounty pro reportované vulnerabilities (€100-2000 dle severity).

## Compliance

Shopio targets ISO 27001 (Year 1), SOC 2 Type II (Year 2), NIS2 readiness, GDPR by design, PCI SAQ A. Detail per `30 §14`.

## Hall of fame

Po prvním validovaném reportu zveřejníme list reportérů (s jejich souhlasem) na trust center page.

## PGP key

```
TBD — generated during Fáze 0 week 4
```
