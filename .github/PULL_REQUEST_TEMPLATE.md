<!-- Per `31-operations.md §5.4` trunk-based development conventions -->

## Summary

<!-- 1-2 sentence description -->

## Type of change

- [ ] `feat` — new feature
- [ ] `fix` — bug fix
- [ ] `refactor` — internal refactor; no behavior change
- [ ] `perf` — performance
- [ ] `docs` — documentation
- [ ] `test` — tests only
- [ ] `chore` — tooling, deps, build
- [ ] `ci` — CI/CD changes
- [ ] `security` / `hotfix` — security or production-blocking fix

## References

- Build spec: <!-- e.g., `30 §RULE-SEC-006` -->
- Issue / ticket: <!-- e.g., #123 -->

## Test plan

- [ ] Tests added / updated
- [ ] Manually tested locally
- [ ] CI green

## Checklist

- [ ] Follows conventions in `05-naming-conventions.md`
- [ ] No secrets in code (verified by gitleaks)
- [ ] Permission checks added where applicable (per `36`)
- [ ] Audit log entries added for sensitive ops (per `30 §8`)
- [ ] PII fields encrypted at rest if applicable (per `30 §9.3`)
- [ ] Docs updated (CLAUDE.md / README / domain doc)
