# Infrastructure

Operational infrastructure for Shopio platform — Fáze 0 setup + ongoing ops.

## Contents

- [`SETUP-CHECKLIST.md`](./SETUP-CHECKLIST.md) — Step-by-step Fáze 0 account setup sequence
- `terraform/` (TODO Fáze 1) — Terraform modules for AWS infra-as-code
- `helm/` (TODO Fáze 2) — Helm charts for Kubernetes deployments
- `runbooks/` (TODO Fáze 1) — Operational runbooks (per `zadani/31 §13.5`)

## Quick reference

- **Cloud:** AWS eu-central-1 Frankfurt (primary) + eu-west-3 Paris (DR)
- **Edge:** Cloudflare (CDN + WAF + DNS)
- **Cluster:** Kubernetes via EKS (Fáze 1+)
- **Observability:** OpenTelemetry → Grafana stack self-host EU (per `31 §7`)
- **CI/CD:** GitHub Actions → ArgoCD (Fáze 1+)

## Status

🟡 **Fáze 0** — accounts setup. No production infrastructure yet.
