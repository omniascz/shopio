# Contributing to Shopio

Vítej. Shopio je projekt s jasným záměrem (EU-first commerce platform) a striktními conventions. Tento dokument popisuje, jak přispívat.

## Před prvním PR

1. Přečti [`zadani/00-MASTER-INDEX.md`](./zadani/00-MASTER-INDEX.md) — kontextový přehled
2. Přečti [`zadani/01-decisions-registry.md`](./zadani/01-decisions-registry.md) — architectural decisions
3. Přečti [`zadani/05-naming-conventions.md`](./zadani/05-naming-conventions.md) — všechny naming conventions
4. Setup lokální dev per [README](./README.md)

## Trunk-based development

Per [`zadani/31-operations.md §5.4`](./zadani/31-operations.md):

- Krátké feature branches (< 3 dny)
- Squash-merge do `main`
- Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `perf:`, `test:`, `build:`, `ci:`, `security:`, `breaking:`)
- 1 reviewer + passing CI mandatorní
- Bez direct push do `main` (branch protection)
- Force-push na `main` disabled

## Commit messages

```
feat(catalog): add bulk import via CSV

Implements per `06-catalog-pim.md §RULE-CAT-014` — chunked import s
per-row validation a dry-run preview.

Refs: zadani/06 §15.x
```

## Pull request

Použij [`PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md). Klíčové:

- Link na spec section (`zadani/XX §Y`)
- Test coverage (unit + integration kde relevantní)
- Žádná secrets v kódu (gitleaks gate v CI)
- Permission checks per `36-personas-rbac.md`
- Audit log entries pro sensitive ops per `30 §8`

## Code style

- **TypeScript strict** — `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, atd. (per [`tsconfig.base.json`](./tsconfig.base.json))
- **Prettier** — automated; `pnpm format` před commit
- **ESLint** — `pnpm lint` zelený mandatorně
- **No emojis v kódu** — per [`zadani/35 §7.7`](./zadani/35-graphic-templates.md)
- **Naming** — per `05`; ID prefixy (prd_, cus_, ord_, ...) striktní

## Testy

- **Unit** — Vitest v každém package; `pnpm test`
- **Integration** — Vitest s Testcontainers (Postgres + Redis)
- **E2E** — Playwright; `pnpm test:e2e`
- **Coverage** — > 80% pro nový kód aspirational

## Documentation

Per `35-graphic-templates.md` "Documentation = product" — Shopio docs musí být Stripe-tier kvalita:

- README + dev docs pro každý package
- Storybook stories pro UI komponenty
- API docs auto-generated z OpenAPI + GraphQL Codegen
- Spec docs (`zadani/`) updates pro nové features

## Architecture decisions

- Nové DEC-* záznam v [`zadani/01-decisions-registry.md`](./zadani/01-decisions-registry.md) pro významná rozhodnutí
- Cross-reference jen směrem dolů (06+ → 00-05, 33+ → 06-32)
- Master entity v `03-data-models-master.md` vítězí; doménový doc rozšiřuje, ne mění

## Code of Conduct

Viz [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md). Contributor Covenant 2.1.

## Security

Pro security issues neposílej PR. Viz [`SECURITY.md`](./SECURITY.md) — coordinated disclosure.

## Licence

Příspěvky do `apps/` + `packages/` (kromě `packages/sdk`) jsou Apache 2.0. `packages/sdk` MIT. Submit = souhlas s touto licencí.

## Otázky?

- GitHub Discussions (community channel)
- Discord (link v README po launch)
- email: contributors@shopio.com (až bude reachable)

Děkuji za příspěvek. 🙏
