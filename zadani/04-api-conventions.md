# 04 – API CONVENTIONS

> **Účel:** Pravidla, která platí pro každé veřejné i interní API platformy. REST, GraphQL, tRPC, MCP — vše konzistentní. Pokud doménový dokument říká něco jiného, **tento dokument vítězí**.

**Datum:** 2026-05-19
**Verze:** 1.0
**Reference:** [01-decisions-registry.md](01-decisions-registry.md) (DEC-API-001, DEC-API-002, DEC-ARCH-005) · [03-data-models-master.md](03-data-models-master.md) · [05-naming-conventions.md](05-naming-conventions.md) · [30-security.md](30-security.md)

---

## 📑 Obsah

1. [Protocol matrix — co se k čemu používá](#1-protocol-matrix)
2. [URL & path konvence](#2-url--path-konvence)
3. [HTTP metody](#3-http-metody)
4. [HTTP status kódy](#4-http-status-kódy)
5. [Request envelope](#5-request-envelope)
6. [Response envelope](#6-response-envelope)
7. [Errors — RFC 7807 Problem Details](#7-errors--rfc-7807-problem-details)
8. [Versioning](#8-versioning)
9. [Pagination](#9-pagination)
10. [Filtering & sorting](#10-filtering--sorting)
11. [Idempotency](#11-idempotency)
12. [Concurrency control](#12-concurrency-control)
13. [Rate limiting](#13-rate-limiting)
14. [Authentication & authorization](#14-authentication--authorization)
15. [CORS](#15-cors)
16. [Caching & ETags](#16-caching--etags)
17. [Async / long-running operations](#17-async--long-running-operations)
18. [Bulk operations](#18-bulk-operations)
19. [Webhooks](#19-webhooks)
20. [GraphQL specifika](#20-graphql-specifika)
21. [tRPC specifika](#21-trpc-specifika)
22. [MCP specifika](#22-mcp-specifika)
23. [OpenAPI 3.1 konvence](#23-openapi-31-konvence)
24. [Observability headers](#24-observability-headers)
25. [Lokalizace, časy a měny v API](#25-lokalizace-časy-a-měny-v-api)
26. [Schema evolution & deprecation](#26-schema-evolution--deprecation)
27. [Testing requirements](#27-testing-requirements)
28. [Změny](#28-změny)

---

## 1. Protocol matrix

Platform má **jeden Fastify proces** (DEC-ARCH-005), který hostuje 4 protokoly:

| Protokol | Mount path | Cílový klient | Když použít | Když NE |
|---|---|---|---|---|
| **REST** | `/api/v1/*` (legacy) + `/api/{YYYY-MM-DD}/*` | Pluginy, integrace, mobile apps, webhooks (receive) | Veřejné API, kde klient nemá TypeScript, kde webhook receivers | Vnitřní volání mezi admin ↔ API |
| **GraphQL** | `/graphql` | Storefront (Next.js), headless customers, plugin marketplace search, agent batched queries | Selektivní data fetching, nested queries, schema introspection | Mutations s side-effecty (preferuj REST), file upload (preferuj REST multipart) |
| **tRPC** | `/trpc/*` | Admin (Vite + React 19 SPA), interní package-to-package volání | End-to-end TypeScript, RPC styl, žádný codegen | Žádný TS klient (mobile, plugin v PHP, …) |
| **MCP** | `/mcp` (HTTP+SSE) | AI agenti (Claude, GPT, OpenAI Operator, …) | Agent-native read operations (katalog, stav objednávky), write operace s scoped tokens ve v1.0+ | Cokoliv, co není určeno pro autonomous agent |

**Princip:** všechny protokoly sdílí **stejnou doménovou logiku** v `packages/core`. Zod schemas jsou source of truth pro request/response; REST OpenAPI, GraphQL SDL i tRPC router se generují / odvozují z nich.

**Žádný gRPC, žádný SOAP, žádný JSON-RPC mimo MCP.**

---

## 2. URL & path konvence

### 2.1 Base URLs

```
Production:    https://api.{tenant-domain}/...
Multi-tenant:  https://api.shopio.com/t/{tenant_slug}/...   (Cloud SaaS Fáze 3+)
Self-host:     https://{merchant-domain}/api/...
Admin:         https://{merchant-domain}/admin/...
Storefront:    https://{merchant-domain}/...
Docs:          https://docs.shopio.com
Status:        https://status.shopio.com
```

### 2.2 Path patterns (REST)

```
/api/{date}/products                     # collection
/api/{date}/products/{id}                # item by internal id (UUID) nebo pub_id (NanoID)
/api/{date}/products/{id}/variants       # nested collection (vždy max 1 úroveň zanoření)
/api/{date}/products:bulk                # custom action (Google AIP style)
/api/{date}/products/{id}:archive        # imperative action na resource
/api/{date}/health                       # bez verze (technický endpoint)
/api/{date}/_meta/openapi.json           # spec self-discovery
```

**Pravidla:**
- Plurál pro collections, ne singulár (`products` ne `product`)
- `kebab-case` v URL segmentech (`order-items` ne `order_items` ani `orderItems`)
- Lowercase only
- Žádné trailing slashes
- Identifikátor v cestě: preferuj `pub_id` (NanoID) pro public-facing, `id` (UUID) pro server-to-server
- Custom actions: `{resource}:{verb}` (Google AIP-136), `:` ne `/`, slovesa pouze pro non-CRUD (`:archive`, `:restore`, `:duplicate`)
- Nested zanoření **max 1 úroveň**. Místo `/products/{id}/variants/{vid}/media` použij `/variants/{vid}/media` jako top-level

### 2.3 Query string

- `kebab-case` pro params s pomlčkou? **NE — používáme `snake_case`**, je to konzistentní s DB sloupci a backendem v Node/TS (Zod schemas přebírají raw field names). Příklad: `?price_min=100&sort_by=created_at`.
- Hodnoty: comma-separated lists `?status=draft,active`; vícenásobné stejné klíče **NE** (`?status=draft&status=active` — vede k mismatch napříč implementacemi)
- Boolean: `true` / `false` (ne `1`/`0`, ne `yes`/`no`)
- Datum/čas: ISO 8601 (`?placed_after=2026-05-19T00:00:00Z`)
- Null hodnota: vynech parametr, ne `?foo=null` ani `?foo=`

---

## 3. HTTP metody

| Metoda | Použití | Idempotentní | Cacheable |
|---|---|---|---|
| `GET` | Číst resource / collection | ✅ | ✅ |
| `POST` | Vytvořit, custom action, async trigger | ❌ | ❌ |
| `PUT` | **Nepoužíváme** (full replace je zdroj bugů) | ✅ | ❌ |
| `PATCH` | Partial update (JSON Merge Patch — RFC 7396) | ❌ (volat s `Idempotency-Key`) | ❌ |
| `DELETE` | Soft delete; podruhé 404 ne 410 | ✅ | ❌ |
| `OPTIONS` | CORS preflight (handled Fastify automatically) | ✅ | ✅ |
| `HEAD` | Metadata bez body (ETag check) | ✅ | ✅ |

**Pravidla:**
- `PUT` se v platformě **nepoužívá**. Všechno je `PATCH` s JSON Merge Patch sémantikou — `null` mazává pole, missing pole nemění.
- `DELETE` na neexistující resource vrací `404`, ne `410` (klient nemá rozlišovat "nikdy neexistoval" vs "byl smazaný").
- `POST` na `/{resource}:{verb}` pro imperativní akce (`:cancel`, `:archive`, `:duplicate`).
- Velký GET (search s mnoha filtry) → fallback `POST /{resource}:search` s body. Důvod: URL délka, citlivá data v access logu.

---

## 4. HTTP status kódy

Striktně:

| Status | Význam | Použití |
|---|---|---|
| `200 OK` | Úspěch s body | GET, PATCH, custom action s výsledkem |
| `201 Created` | Created s body + `Location` headerem | POST → nový resource |
| `202 Accepted` | Async, body obsahuje job/task ID | Long-running operations |
| `204 No Content` | Úspěch bez body | DELETE, no-result PATCH |
| `301 Moved Permanently` | Permanentní redirect (kanonické URL) | Storefront pretty URLs |
| `304 Not Modified` | Klient má valid cache | ETag/If-None-Match match |
| `400 Bad Request` | Špatná struktura requestu | Malformed JSON, missing required field — Zod validation fail |
| `401 Unauthorized` | Chybí / invalid auth | No token, expired token |
| `403 Forbidden` | Auth OK, ale missing permission | RBAC/ABAC deny |
| `404 Not Found` | Resource neexistuje **nebo** uživatel nemá právo ho vidět | Vždy preferuj 404 nad 403, když by 403 prozradil existenci |
| `409 Conflict` | Optimistic locking, unique constraint violation | `If-Match` neshoda, duplicate SKU |
| `410 Gone` | Endpoint deprecated + sunset (viz §8.4) | Removed API version |
| `412 Precondition Failed` | `If-Match` / `If-Unmodified-Since` fail | Concurrency control |
| `415 Unsupported Media Type` | Špatný `Content-Type` | Neposlali `application/json` |
| `422 Unprocessable Entity` | Validní JSON ale business rule fail | Negative quantity, expired coupon |
| `423 Locked` | Resource je in-progress operation | Bulk operation lock |
| `425 Too Early` | Replay protection | Anti-replay window |
| `428 Precondition Required` | Endpoint vyžaduje `If-Match` | Mutace concurrency-sensitive resource |
| `429 Too Many Requests` | Rate limit hit | + `Retry-After` header |
| `500 Internal Server Error` | Náš bug | + correlation ID v body |
| `502 Bad Gateway` | Upstream chyba (payment provider, …) | Provider down |
| `503 Service Unavailable` | Maintenance / overload | + `Retry-After` |
| `504 Gateway Timeout` | Upstream timeout | |

**Pravidla:**
- `400` = struktura. `422` = business rule. Tohle **není** zaměnitelné.
- `401` = klient může retry s novými credentials. `403` = retry je zbytečný.
- `404` na chráněné resource místo `403` chrání před enumeration attack.
- `429` má vždy `Retry-After` (sekundy) a `RateLimit-*` headers (RFC 9331).
- Nikdy nevracíme `200 OK` s `{"success": false}` — chyba má status 4xx/5xx.

---

## 5. Request envelope

### 5.1 Content-Type

- `application/json; charset=utf-8` default
- `multipart/form-data` pro upload (media)
- `application/x-www-form-urlencoded` jen pro OAuth callbacks
- `application/merge-patch+json` pro `PATCH` (RFC 7396)
- Vše ostatní → `415`

### 5.2 Required headers

```
Authorization: Bearer {token}             # všechno mimo /health, /ready, /api/{date}/_meta/*
Content-Type: application/json            # mutace
Accept-Language: cs-CZ                    # locale negotiation (viz §25)
Idempotency-Key: {uuid|nanoid}            # POST/PATCH/DELETE mutace (viz §11)
Shopio-Version: 2026-05-19                # API version (viz §8)
X-Request-ID: {uuid}                      # volitelné z klienta, jinak server vygeneruje
```

### 5.3 Request body

JSON object. Top-level je vždy object, **nikdy array** (pro budoucí kompatibilitu — array nelze rozšířit o paging/meta).

```jsonc
// ✅ správně
{ "items": [ ... ] }

// ❌ špatně
[ ... ]
```

Pole jména: `snake_case`. Důvod: konzistence s DB, Zod schemas, OpenAPI. Frontend SDK může mapovat na camelCase na hranicí klient, pokud preferuje, ale wire format je snake_case.

---

## 6. Response envelope

### 6.1 Single resource

```jsonc
{
  "data": {
    "id": "01927bca-...",
    "pub_id": "prd_aB3cD4eF5g6h",
    "type": "product",
    "attributes": {
      "title": "Lampa Luna",
      "status": "active"
    }
  },
  "meta": {
    "request_id": "req_01h9...",
    "version": "2026-05-19"
  }
}
```

### 6.2 Collection

```jsonc
{
  "data": [ { ... }, { ... } ],
  "page": {
    "cursor": "eyJpZCI6IjAxOTI3YmNhLi4uIn0",
    "has_more": true,
    "total": 1247
  },
  "meta": {
    "request_id": "req_01h9...",
    "version": "2026-05-19"
  }
}
```

### 6.3 Pravidla

- Top-level vždy `{ "data": ..., "meta": ... }`
- `data` může být object (single), array (collection), nebo `null` (pro DELETE).
- `page` jen u collection responses.
- **Žádný** `data: { data: ... }` double-wrap (JSON:API style).
- `meta.request_id` se zrcadlí s `X-Request-ID` response headerem.
- Vždy include `pub_id` u public-facing entit. `id` (UUID) se vrací jen pokud volající má `internal` scope.
- Datumy: ISO 8601 v UTC s `Z` suffixem (`2026-05-19T14:30:00Z`).
- Měny: `{ "amount": 12990, "currency": "CZK" }` — vždy v minor unit (centy/halíře), nikdy decimal.

### 6.4 Polymorfní typy

Vždy s `type` discriminator field na top-level objektu:

```jsonc
{
  "type": "payment.stripe",
  "id": "pay_...",
  "provider_payment_id": "pi_..."
}
```

Klient může safe parse přes `if (data.type === "payment.stripe") { ... }`.

---

## 7. Errors — RFC 7807 Problem Details

Každá 4xx/5xx odpověď používá `application/problem+json` (RFC 7807).

```jsonc
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/problem+json

{
  "type": "https://docs.shopio.com/errors/cart-item-out-of-stock",
  "title": "Cart item is out of stock",
  "status": 422,
  "code": "CART_ITEM_OUT_OF_STOCK",
  "detail": "Variant prd_aB3cD4eF5g6h is not available in requested quantity.",
  "instance": "/api/2026-05-19/carts/crt_xyz/items/itm_abc",
  "request_id": "req_01h9...",
  "errors": [
    {
      "code": "INSUFFICIENT_STOCK",
      "path": "items[0].quantity",
      "message": "Requested 5, available 2.",
      "context": { "variant_id": "prd_aB...", "available": 2, "requested": 5 }
    }
  ],
  "retry_after_seconds": null
}
```

### 7.1 Required fields

- `type` — stable URI do docs, **nikdy nemění význam** (klient může branch na něm)
- `title` — human readable, lokalizovatelný přes `Accept-Language`
- `status` — kopie HTTP status (zjednodušuje klientské handling)
- `code` — stable `SCREAMING_SNAKE_CASE` (klient se sem váže místo `title`)
- `detail` — kontextuálně specifická zpráva
- `instance` — request path (debug)
- `request_id` — correlation ID
- `errors` — array per-field problems (jen u validačních chyb)

### 7.2 Error code namespace

```
AUTH_*            authentication (UNAUTHENTICATED, TOKEN_EXPIRED, MFA_REQUIRED)
PERM_*            permissions  (PERMISSION_DENIED, INSUFFICIENT_SCOPE)
VALIDATION_*      input shape (VALIDATION_FAILED, INVALID_JSON)
BUSINESS_*        domain rule (CART_ITEM_OUT_OF_STOCK, ORDER_ALREADY_PAID)
CONFLICT_*        concurrency (RESOURCE_VERSION_MISMATCH, DUPLICATE_KEY)
RATE_*            limits (RATE_LIMIT_EXCEEDED)
PROVIDER_*        upstream (PAYMENT_PROVIDER_DOWN, CARRIER_TIMEOUT)
INTERNAL_*        server (INTERNAL_ERROR, NOT_IMPLEMENTED)
```

Codes jsou stable napříč versions; přidáváme, neperedefinováváme. Deprecated code zůstává s `Sunset` headerem.

### 7.3 Lokalizace

`title` a `detail` se lokalizují přes `Accept-Language`. `code` zůstává anglicky pro programmatic handling.

---

## 8. Versioning

DEC-API-002 = **date-based** versioning pro REST (Stripe style).

### 8.1 Klientovo opt-in

```
Shopio-Version: 2026-05-19
```

Default (no header): **latest stable**. Doporučujeme klientům pin na konkrétní datum.

### 8.2 Lifecycle

```
Active        Aktuální + 2 starší stabilní data
Deprecated    Označeno; klient dostává Sunset header
Sunset        Odebráno; 410 Gone s Link → upgrade guide
```

Minimum support window: **12 měsíců po deprecation**, **24 měsíců total lifecycle**.

### 8.3 Co je breaking change

```
✅ Breaking (vyžaduje new version date):
   - Odebrání pole z response
   - Změna typu pole (string → object)
   - Přejmenování pole
   - Změna povinnosti pole (optional → required)
   - Změna sémantiky existující hodnoty enumu
   - Nová požadovaná validace existujícího pole
   - Změna chování existujícího endpointu (např. side effect)

❌ Není breaking (může do current version):
   - Přidání optional pole do request
   - Přidání pole do response
   - Přidání nového enum value (klient musí MÍT default branch)
   - Přidání nového endpointu
   - Zpřísnění bezpečnostní validace (= bug fix)
```

### 8.4 Sunset & Deprecation headers

```
Sunset: Wed, 19 May 2027 00:00:00 GMT
Deprecation: Wed, 19 May 2026 00:00:00 GMT
Link: <https://docs.shopio.com/upgrade/2027-01-01>; rel="successor-version"
```

Klient dostávající `Sunset` má strojově detekovat a vyvolat varování.

### 8.5 GraphQL

GraphQL nemá date version. Místo toho:
- **Field deprecation** přes `@deprecated(reason: "...")` directive
- Nová pole se přidávají non-breaking
- Breaking change = nový field s novým jménem + deprecation starého

### 8.6 tRPC

tRPC není veřejné API → no versioning policy. Routes se mění synchronně s klientem (admin), oba jdou v jednom monorepo deploy.

---

## 9. Pagination

### 9.1 Default: cursor-based

```
GET /api/{date}/orders?limit=50&cursor=eyJpZCI6...
```

Response:
```jsonc
{
  "data": [ ... ],
  "page": {
    "cursor": "eyJpZCI6IjAxOTI3Yz...",
    "has_more": true,
    "total": 1247    // optional, opt-in přes ?include_total=true
  }
}
```

- `limit` default **50**, max **200**, exceeding → `400`
- `cursor` je opaque base64-encoded JSON, klient si ho nikdy ne-parsuje
- Forward only (žádný `prev_cursor`). Pro back-navigation klient drží seznam předchozích cursors
- `total` je drahý (`COUNT(*)`), opt-in přes query param

### 9.2 Žádný offset pagination

`?offset=10000` je **zakázané**. Důvod: O(N) Postgres scan, nestability při concurrent inserts.

Výjimka: admin UI tabulka s `total` známé a malé (< 10k). Pak `?offset=...&limit=...&include_total=true` povoleno, ale klient dostane warning header `X-Pagination-Strategy: offset-discouraged`.

### 9.3 Sorting + pagination

Cursor je generovaný ze sort key + ID. Default sort: `created_at DESC, id DESC` (deterministické pořadí, ID jako tiebreaker).

---

## 10. Filtering & sorting

### 10.1 Filtering

```
?status=active                    # equality
?status=active,draft              # IN (comma-separated)
?price_min=100&price_max=500      # range (suffix _min/_max)
?created_after=2026-01-01         # date range (suffix _after/_before)
?tag=sale&tag=new                 # ❌ nepoužíváme
?tag.in=sale,new                  # ❌ nepoužíváme RHS DSL
?q=lamp                           # fulltext (jen relevantní endpointy)
```

Pravidla:
- Jednoduché ploché `field=value` nebo `field=val1,val2`
- Range: suffix `_min`, `_max`, `_after`, `_before`
- Žádné nested filtering DSL v query (LHS/RHS Bracket style) — vede ke špatně cachovatelným URL
- Komplexní filter → fallback `POST /{resource}:search` s JSON body (viz §3)

### 10.2 Search

```
?q=text                           # fulltext (Meilisearch, DEC-SEARCH-001)
&q_fields=title,description        # explicit fields scope (default all searchable)
&q_typo_tolerance=true
```

### 10.3 Sorting

```
?sort=created_at:desc
?sort=price:asc,created_at:desc   # multi-key
```

- Default sort: `created_at:desc` u většiny list endpointů
- Whitelist sortable polí per endpoint (OpenAPI doc je vyjmenuje)
- `sort_by` + `sort_order` jako alternativa **nepřijímáme** — vždy `sort=field:direction`

### 10.4 Field selection (sparse fieldsets)

```
?fields=id,title,status           # vrátit jen vybraná pole
```

- Klient může opt-in pro úsporu bandwidth
- Default = vše neselectionable (`metadata`, large nested) je vyloučené, klient si je vyžádá explicitně
- GraphQL je preferovaná cesta pro selective fetching

---

## 11. Idempotency

### 11.1 Kdy je idempotency povinná

Všechny **side-effect** mutace (POST, PATCH, DELETE):
- Vytváření orders, payments, refunds, shipments
- Charge / capture / refund payment
- Webhook delivery (out)
- Mutace cart items
- Custom actions (`:cancel`, `:duplicate`, …)

**Není povinná** pro:
- GET, HEAD, OPTIONS
- Idempotentní endpointy implicitně (PUT-like full state replace — ale ty nepoužíváme)

### 11.2 Mechanismus

```
Idempotency-Key: 9c9f5e2a-...        # UUID, NanoID, nebo libovolný unique string ≤128 znaků
```

- Server uloží `(tenant_id, idempotency_key)` + hash request body + cached response do Redis (TTL **24h**)
- Druhý request se stejným klíčem **a stejným body** → vrátí cached response
- Druhý request se stejným klíčem **a jiným body** → `409 Conflict` s code `IDEMPOTENCY_KEY_REUSED`
- Klíč musí být unique per tenant per logical operation; klient typicky generuje 1 klíč per try

### 11.3 Storage

```
key:   idemp:{tenant_id}:{idempotency_key}
value: {
  request_body_sha256,
  response_status,
  response_body,
  created_at
}
TTL:   24 hours
```

### 11.4 Klientův pattern

```typescript
const key = crypto.randomUUID();
let attempt = 0;
while (attempt < 5) {
  try {
    return await api.post('/orders', body, { headers: { 'Idempotency-Key': key }});
  } catch (e) {
    if (isRetriable(e)) { attempt++; await backoff(attempt); continue; }
    throw e;
  }
}
```

---

## 12. Concurrency control

### 12.1 ETags + If-Match (optimistic locking)

GET vrací ETag (entity version):

```
HTTP/1.1 200 OK
ETag: "v17-7f8c..."
```

Klient při PATCH:

```
PATCH /api/{date}/products/prd_aB3cD
If-Match: "v17-7f8c..."
```

Server porovná s aktuální `version` v DB. Mismatch → `412 Precondition Failed` s code `RESOURCE_VERSION_MISMATCH`.

### 12.2 If-Match povinné pro

Endpointy s vysokým concurrent risk:
- `PATCH /products/{id}`
- `PATCH /orders/{id}`
- `POST /orders/{id}:cancel`
- `PATCH /stock_levels/{id}`

Endpoint vrátí `428 Precondition Required` pokud klient neposlal `If-Match`.

### 12.3 If-None-Match (cache validation)

```
GET /api/{date}/products/prd_aB
If-None-Match: "v17-..."
```

Hit cache → `304 Not Modified` bez body.

### 12.4 Implementace

`version integer` sloupec v každé tabulce (viz [03 §2](03-data-models-master.md#2-cross-cutting-auditní-pole)). Bump v každém UPDATE přes trigger nebo aplikační vrstva. ETag = `"v{version}-{content_hash[:8]}"`.

---

## 13. Rate limiting

### 13.1 Implementace

Redis token bucket per `(tenant_id, principal_id, endpoint_class)`. Configurable per plan tier (DEC-BIZ-001 community/starter/pro/enterprise).

### 13.2 Defaults

| Endpoint class | Free | Starter | Pro | Enterprise |
|---|---|---|---|---|
| Public read (anon) | 60/min | 300/min | 1200/min | 6000/min |
| Authenticated read | 300/min | 1500/min | 6000/min | unlimited |
| Mutation (write) | 30/min | 150/min | 600/min | 6000/min |
| Auth endpoints (login) | 5/min | 10/min | 30/min | 100/min |
| Search | 60/min | 300/min | 1500/min | unlimited |
| Webhook delivery (out) | per webhook 60/min | 300/min | 1500/min | unlimited |
| Burst tolerance | 2× | 3× | 5× | 10× |

### 13.3 Response headers (RFC 9331)

```
RateLimit-Limit: 1500
RateLimit-Remaining: 1472
RateLimit-Reset: 42         # sekund do resetu okna
RateLimit-Policy: "1500;w=60;burst=4500"   # 1500/min, burst 3× = 4500
```

Při 429:

```
HTTP/1.1 429 Too Many Requests
Retry-After: 12
RateLimit-Remaining: 0
```

### 13.4 Per-IP fallback

Pro anonymní traffic: per-IP bucket (CIDR /24 aggregation pro CG-NAT). Pokud se IP traffic chová podezřele → tighter throttle + captcha challenge.

### 13.5 Bypass

- Whitelisted IPs (merchant office, support tooling) přes `bypass_rate_limit: true` v `api_keys`
- Internal calls (modular monolith) neprochází rate limiterem

---

## 14. Authentication & authorization

### 14.1 Methods

| Method | Header | Použití |
|---|---|---|
| **Session cookie** | `Cookie: shopio_session=...` (HttpOnly, Secure, SameSite=Lax) | Browser-based admin a storefront |
| **Bearer JWT (access token)** | `Authorization: Bearer eyJ...` | API klienti (SDK, mobile) — krátké TTL (15 min) |
| **Refresh token** | rotated cookie + body | Renew access token |
| **API key** | `Authorization: Bearer sk_live_...` | Pluginy, server-to-server integrace |
| **Agent token** | `Authorization: Bearer agt_... ; DPoP: ...` | AI agenti (DEC-AUTH-001) |
| **OAuth 2.1 + OIDC** | Standard OAuth flow | 3rd-party apps na behalf of merchant |

### 14.2 Scopes

API keys a OAuth tokens mají scope list:

```
products:read
products:write
orders:read
orders:write
customers:read
customers:write
payments:write
admin:full      # rovnocenné s permissionou owner role
```

Endpoint deklaruje required scope v OpenAPI metadata. Server validuje při requestu.

### 14.3 Tenant resolution

```
1. Self-host:   tenant = DEFAULT_TENANT (single-tenant)
2. Cloud SaaS:  tenant z (a) subdomain {slug}.shopio.app, (b) custom domain → tenant_domains lookup
3. Multi-tenant API key: api_key.tenant_id určuje tenant
4. Admin user session: session.tenant_id (z poslední switched tenant)
```

Tenant ID je v `request.context.tenant_id`, nikdy jako URL param (kromě výslovných admin Cloud endpoints `/t/{slug}/...`).

### 14.4 Authorization (RBAC + ABAC)

Detail v `36-personas-rbac.md`. V API kontrolujeme:

```typescript
const ctx = await resolveContext(request);   // tenant, user, scopes, agent token claims
ctx.requirePermission('PERM-ORDER-REFUND', { order_id });
ctx.requireScope('orders:write');
```

Selhání → `403` s code `PERMISSION_DENIED` nebo `INSUFFICIENT_SCOPE`.

### 14.5 Audit

Každý authentikovaný request loguje do `audit_log` (sample 1% pro reads, 100% pro mutations + 100% pro permission checks na sensitive resources jako customer PII).

---

## 15. CORS

### 15.1 Storefront API (public)

```
Access-Control-Allow-Origin: *                   # public read endpoints
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Accept-Language, Shopio-Version
Access-Control-Max-Age: 86400
```

### 15.2 Admin API + customer account

```
Access-Control-Allow-Origin: {explicit-origin}   # echo whitelist, never *
Access-Control-Allow-Credentials: true
Access-Control-Allow-Headers: Content-Type, Authorization, Idempotency-Key, If-Match, Shopio-Version, X-Request-ID
```

Whitelist je per-tenant `tenant.allowed_origins` jsonb array. Default: tenant's primary domain + admin domain.

### 15.3 Preflight cache

`Max-Age: 86400` (24h) pro stable endpoints, `300` (5 min) pro endpointy v rapid iteration.

---

## 16. Caching & ETags

### 16.1 Response cache headers

```
GET /api/{date}/products/prd_aB
Cache-Control: public, max-age=60, stale-while-revalidate=300
ETag: "v17-7f8c..."
Last-Modified: Sat, 19 May 2026 14:30:00 GMT
Vary: Accept-Language, Shopio-Version, Authorization
```

| Endpoint kind | Cache-Control |
|---|---|
| Public catalog (product listing, product detail) | `public, max-age=60, swr=300` |
| Authenticated user data (cart, account) | `private, no-cache` |
| Admin endpoints | `private, no-store` |
| Static reference (currencies, countries) | `public, max-age=86400, immutable` |
| Auth endpoints | `no-store` (vždy) |

### 16.2 CDN

Storefront prochází CDN (Cloudflare Cache, viz DEC-DB-004 L2). Backend posílá `Surrogate-Control` header pro CDN-specifické TTL:

```
Surrogate-Control: max-age=3600
Surrogate-Key: tenant:{id} product:{id} category:{ids}
```

Purge přes event-driven invalidation (změna produktu → `EVENT-PRODUCT-UPDATED` → purge `product:{id}` + `category:{primary_id}` keys).

### 16.3 Vary header

Vždy include `Vary: Accept-Language, Shopio-Version`. Pokud endpoint závisí na auth → také `Vary: Authorization, Cookie`.

---

## 17. Async / long-running operations

### 17.1 Pattern

```
POST /api/{date}/exports:product-feed
→ 202 Accepted
Location: /api/{date}/operations/op_aB3cD
{
  "data": {
    "id": "op_aB3cD",
    "status": "queued",
    "created_at": "2026-05-19T14:30:00Z",
    "kind": "export.product_feed"
  }
}
```

```
GET /api/{date}/operations/op_aB3cD
→ 200 OK
{
  "data": {
    "id": "op_aB3cD",
    "status": "running",     // queued | running | completed | failed | cancelled
    "progress_percent": 42,
    "started_at": "...",
    "estimated_completion_at": "...",
    "result_url": null,
    "error": null
  }
}
```

Po dokončení:

```
{
  "status": "completed",
  "completed_at": "...",
  "result_url": "https://storage.shopio.com/exports/feed-xyz.json?sig=...",
  "expires_at": "..."        // signed URL TTL 1h
}
```

### 17.2 Operations tabulka

Reálná entita `operations` (přidám do 03 ve future revisi pokud potřeba) drží task state. BullMQ řídí execution (DEC-EVENTS-001).

### 17.3 Polling cadence

Doporučená:
- Pomalý job: 5s interval první minutu, pak exponential backoff
- Rychlý job (< 10s): 1s interval, max 30 pollů
- Webhook callback option: klient pošle `callback_url` v request body → server zavolá při done

### 17.4 Cancellation

```
POST /api/{date}/operations/op_aB:cancel
→ 200 OK
```

Best-effort, job může už být committed.

---

## 18. Bulk operations

### 18.1 Bulk create / update

```
POST /api/{date}/products:bulk
Content-Type: application/json
Idempotency-Key: ...

{
  "operations": [
    { "op": "create", "data": { ... } },
    { "op": "update", "id": "prd_...", "if_match": "v3-...", "data": { ... } },
    { "op": "delete", "id": "prd_..." }
  ]
}
```

Response (multi-status):

```jsonc
HTTP/1.1 207 Multi-Status
{
  "data": [
    { "index": 0, "status": 201, "result": { "id": "prd_new1" } },
    { "index": 1, "status": 409, "error": { "code": "RESOURCE_VERSION_MISMATCH" } },
    { "index": 2, "status": 204, "result": null }
  ],
  "meta": {
    "succeeded": 2,
    "failed": 1,
    "total": 3
  }
}
```

### 18.2 Limits

- Max **100** operations per bulk request (extend přes async export/import pro větší)
- Transactional mode: `?transactional=true` → buď všechny succeed nebo žádná (default je per-op)
- Bulk je počítáno jako N requests proti rate limit (ne 1)

### 18.3 Import/Export

Velká data (>100 items) → async job pattern (§17):

```
POST /api/{date}/imports:product-csv         → 202 → job ID
POST /api/{date}/exports:order-feed           → 202 → job ID
```

CSV/JSONL formát, signed URL pro file download/upload.

---

## 19. Webhooks

### 19.1 Out — platform sends to merchant

Detail v [03 ENT-WEBHOOK-001](03-data-models-master.md#17-developer-platform).

**Delivery contract:**

```
POST {merchant.endpoint_url}
Content-Type: application/json
Shopio-Event: order.placed
Shopio-Event-Version: 1
Shopio-Delivery-Id: dlv_aB3cD
Shopio-Webhook-Id: wh_xyz
Shopio-Timestamp: 1747837200
Shopio-Signature: t=1747837200,v1=hex(hmac_sha256(secret, "{timestamp}.{body}"))
User-Agent: Shopio-Webhook/1.0
```

Body:

```jsonc
{
  "id": "dlv_aB3cD",
  "type": "order.placed",
  "tenant_id": "...",
  "created_at": "2026-05-19T14:30:00Z",
  "data": { /* event-specific payload */ },
  "previous_attributes": null   // jen u *.updated
}
```

### 19.2 Signature ověření

```typescript
const expected = hmacSha256(secret, `${timestamp}.${rawBody}`);
const valid = constantTimeEqual(expected, signature.v1);
const fresh = Math.abs(Date.now()/1000 - timestamp) < 300;  // 5 min anti-replay
```

### 19.3 Retry policy

- Exponential backoff: `1m, 5m, 30m, 1h, 6h, 24h` (6 attempts)
- 2xx response = delivered. 4xx (non-422) = mark failed, skip retry. 5xx + timeout = retry.
- Po 6 failures → webhook flagged `failure_count`, after 24h continuous failure auto-disable + email notification

### 19.4 In — platform receives from upstream (payment provider, carrier, marketplace)

```
POST /api/{date}/webhooks/incoming/{provider}
```

Provider-specific signature validation. Idempotent processing (`provider_event_id` UNIQUE per provider).

---

## 20. GraphQL specifika

### 20.1 Schema

- Mount: `POST /graphql` (no GET, kromě GraphiQL UI in dev)
- Schema-first via SDL v `packages/api-graphql/schema/*.graphql`, type-checked přes codegen
- Federation: žádné (DEC-API-001) — schema stitching uvnitř monolithu

### 20.2 Naming

- Types: `PascalCase` (`Product`, `OrderItem`)
- Fields: `camelCase` (`createdAt`, `totalAmount`)
- Enums: `SCREAMING_SNAKE_CASE` values
- Interfaces: `PascalCase` prefix `I`? **NE** (bez prefixu, `Node`, `Timestamped`)

> **Pozn.** GraphQL je jediný protokol, kde používáme camelCase pro field jména — je to GraphQL community standard. REST a wire JSON jsou snake_case. Toto je vědomá nekonzistence; SDK ji řeší per-protocol.

### 20.3 Required directives

- `@deprecated(reason: "...")` na deprecated fields
- Custom `@auth(requires: PERMISSION)` na chráněných polích
- Custom `@cost(complexity: N)` pro query complexity limiting

### 20.4 Pagination — Relay Connection spec

```graphql
type Query {
  products(first: Int, after: String, filter: ProductFilter, sort: ProductSort): ProductConnection!
}

type ProductConnection {
  edges: [ProductEdge!]!
  pageInfo: PageInfo!
  totalCount: Int
}
type ProductEdge { node: Product!  cursor: String! }
type PageInfo { hasNextPage: Boolean!  hasPreviousPage: Boolean!  startCursor: String  endCursor: String }
```

`first` max 100; `last` zakázáno (žádné back navigation server-side, stejně jako REST §9).

### 20.5 Errors

GraphQL spec `errors[]` + náš RFC 7807 extensions:

```jsonc
{
  "data": null,
  "errors": [
    {
      "message": "Cart item is out of stock",
      "path": ["addToCart"],
      "extensions": {
        "code": "CART_ITEM_OUT_OF_STOCK",
        "type": "https://docs.shopio.com/errors/cart-item-out-of-stock",
        "status": 422,
        "request_id": "req_..."
      }
    }
  ]
}
```

### 20.6 Query complexity

- Max depth: **10**
- Max complexity score: **1000** (per query)
- Persisted queries doporučené (CDN-friendly, security)
- GraphQL Yoga plugin `@envelop/depth-limit` + custom complexity calculator

### 20.7 Subscriptions

V MVP **ne**. Storefront real-time potřeby (live inventory, cart sync) řešit přes SSE polling endpointy v REST (`GET /api/{date}/sse/inventory`). Subscriptions zvážit ve Fázi 3+ pokud potřeba.

---

## 21. tRPC specifika

### 21.1 Setup

```
packages/api-trpc/
├── routers/
│   ├── products.ts        # productsRouter
│   ├── orders.ts
│   └── ...
├── context.ts             # createContext (auth, tenant resolution)
└── index.ts               # appRouter = router({ products, orders, ... })
```

Mount jako Fastify plugin na `/trpc/*`. Klient generated z `AppRouter` type.

### 21.2 Procedure naming

```typescript
products.list           // list, query
products.byId          // single, query
products.create        // mutation
products.update        // mutation
products.archive       // mutation
products.duplicate     // mutation
```

`camelCase`, dot-separated logical grouping. Žádné HTTP slovesa v názvu.

### 21.3 Input/output validation

**Vždy** přes Zod schema, sdílené s REST OpenAPI:

```typescript
import { productCreateSchema, productSchema } from '@shopio/schemas';

export const productsRouter = router({
  create: protectedProcedure
    .input(productCreateSchema)
    .output(productSchema)
    .mutation(async ({ input, ctx }) => { ... })
});
```

### 21.4 Auth + scopes

Middleware `protectedProcedure` checks session/JWT. `requireScope('products:write')` middleware před mutací.

### 21.5 Errors

tRPC `TRPCError` mapuje na náš error namespace:

```typescript
throw new TRPCError({
  code: 'BAD_REQUEST',         // tRPC code
  message: 'Cart item out of stock',
  cause: {
    type: 'https://docs.shopio.com/errors/cart-item-out-of-stock',
    code: 'CART_ITEM_OUT_OF_STOCK',
    status: 422
  }
});
```

Klient SDK transparent-přemapuje na sjednocený `ShopioError` object.

### 21.6 Žádné side-effect public API přes tRPC

tRPC slouží **jen** pro admin a interní volání. Pluginy a 3rd-party integrace **vždy** REST.

---

## 22. MCP specifika

### 22.1 Mount

```
GET  /mcp                      # SSE stream (events)
POST /mcp/rpc                  # JSON-RPC 2.0 messages
```

Anthropic Model Context Protocol. Detail v `33-ai-features.md` + spec na modelcontextprotocol.io.

### 22.2 Tool naming

```
catalog.search_products
catalog.get_product
catalog.list_categories
inventory.check_availability
order.get_status         # MVP read-only
cart.add_item            # v1.0 write
checkout.initiate        # v1.0 write s agent token
```

`snake_case` + dot-separated category. Stable napříč versions (deprecation rules per §8.3).

### 22.3 Resource URIs

```
shopio://product/{pub_id}
shopio://order/{number}
shopio://category/{slug}
```

### 22.4 Auth

Agent token (viz `03 ENT-AGENT-TOKEN-001` + DEC-AUTH-001):

```
Authorization: Bearer agt_aB3cD...
DPoP: eyJ...                       # JWT-signed proof-of-possession
```

Token claims:

```jsonc
{
  "sub": "agt_aB3cD",
  "tenant_id": "...",
  "customer_id": null,           // null = anonymous agent, jinak agent na behalf customera
  "scopes": ["catalog:read", "order:read"],
  "spending_limit_amount": null,
  "exp": 1747923600,
  "iat": 1747837200,
  "jti": "..."
}
```

### 22.5 Žádné write bez explicit scope

Default agent token má **jen read scopes** (`catalog:read`, `order:read`). Write akce (`cart:write`, `checkout:write`) vyžadují per-action explicit scope a `spending_limit_amount`. Žádný `admin:full` scope pro agenty.

### 22.6 Auditing

100% MCP calls do `audit_log` (žádný sampling). `actor_kind: 'agent'`.

---

## 23. OpenAPI 3.1 konvence

### 23.1 Source of truth

OpenAPI je **generovaný** z Fastify route schemas + Zod (zod-openapi). Žádný manuálně psaný OpenAPI YAML.

```typescript
fastify.route({
  method: 'POST',
  url: '/products',
  schema: {
    summary: 'Create a product',
    description: 'Creates a new product...',
    tags: ['Catalog'],
    body: productCreateSchema,
    response: { 201: productSchema, 422: problemDetailsSchema },
    security: [{ apiKey: ['products:write'] }]
  },
  handler: async (req, reply) => { ... }
});
```

### 23.2 Tags

Per doménový dokument: `Catalog`, `Inventory`, `Pricing`, `Cart`, `Checkout`, `Orders`, `Payments`, `Shipping`, `Customers`, `B2B`, `Marketing`, `Analytics`, `Admin`, `Plugins`, `Webhooks`, `Agents`.

### 23.3 Discovery

```
GET /api/{date}/_meta/openapi.json
GET /api/{date}/_meta/openapi.yaml
GET /api/{date}/_meta/postman.json
GET /docs                              # Scalar nebo Swagger UI
```

### 23.4 examples + descriptions

Každý endpoint musí mít:
- `summary` (max 80 znaků)
- `description` (markdown, > 0 znaků)
- `examples` pro request a response (min 1 success + 1 error)
- `tags` (alespoň 1)
- `security` (explicit, žádné implicit)

### 23.5 Codegen SDKs

```
packages/sdk-js          # TypeScript, generated z OpenAPI + GraphQL codegen
packages/sdk-php         # Future, generated z OpenAPI
packages/sdk-python      # Future, generated z OpenAPI
```

Auto-publish na NPM/Packagist/PyPI při each API version release.

---

## 24. Observability headers

### 24.1 Request correlation

```
X-Request-ID: req_01h9...              # klient může poslat, jinak server gen
X-Correlation-ID: cor_01h9...          # cross-service / OTEL trace ID
X-Tenant-ID: ...                       # debug only, not auth boundary
```

Response zrcadlí `X-Request-ID` + přidá `X-Server-Region: eu-central-1`.

### 24.2 Timing

```
Server-Timing: db;dur=12.3, redis;dur=2.1, total;dur=45.7
```

Klient může parsovat pro debug.

### 24.3 Tracing

OTEL trace propagation přes W3C Traceparent:

```
traceparent: 00-{trace_id}-{span_id}-01
tracestate: shopio=...
```

---

## 25. Lokalizace, časy a měny v API

### 25.1 Locale negotiation

```
Accept-Language: cs-CZ, sk-SK;q=0.9, en;q=0.8
```

Server vybere best match z `tenant.locales`, fallback na `tenant.default_locale`.

Response volitelně vrátí:

```
Content-Language: cs-CZ
```

### 25.2 Datum/čas

- API wire format: **ISO 8601 v UTC s Z suffixem** vždy. `2026-05-19T14:30:00.123Z`.
- Žádné epoch milliseconds, žádné date-only stringy pro datetime
- Locale formatting je client-side concern

### 25.3 Měny

```jsonc
{
  "subtotal": { "amount": 12990, "currency": "CZK" },
  "tax":      { "amount": 2728,  "currency": "CZK" },
  "total":    { "amount": 15718, "currency": "CZK" }
}
```

- `amount` vždy **minor unit** integer (`bigint` v Postgres, `string` na wire pro JavaScript safety nad 2^53)
  - Toleranceí: hodnoty < 2^53 mohou být number; větší (subscription LTV, gift card large) jako string. Zod schema rozhoduje per endpoint.
- `currency` ISO 4217 (3 znaky uppercase)

### 25.4 Numbers obecně

Pro běžné integer hodnoty (quantity, count): `number`.
Pro identifikátory: vždy `string` (nikdy se nesnaž parsovat).

---

## 26. Schema evolution & deprecation

### 26.1 Pravidla přidávání

```
✅ Free:
   - Nová optional pole do request body
   - Nová pole do response body
   - Nové endpointy
   - Nové enum values (client musí mít default branch — viz §26.3)
   - Nové query parameters (optional)

⚠️ Vyžaduje new version date:
   - Změna existujícího field typu
   - Změna existujícího field semantiky
   - Existing field z optional → required
   - Odebrání pole / endpointu
   - Změna default chování existujícího endpointu
   - Zpřísnění existující validace (pokud blokuje validní existing data)
```

### 26.2 Field deprecation

Pole zůstává, ale v OpenAPI:

```yaml
deprecated: true
description: "Deprecated since 2026-05-19, use `tax_amount` instead. Will be removed 2027-05-19."
x-sunset: "2027-05-19"
```

V response volitelně `Deprecation` header (per endpoint, ne per field).

### 26.3 Enum forward-compat

Klient musí mít `default` branch pro neznámé enum values:

```typescript
switch (order.status) {
  case 'pending':   ...
  case 'paid':      ...
  default:          /* neznámý status, treat as unknown, neházej výjimku */
}
```

Server pošle do response `Shopio-Forward-Compat-Warning: unknown_enum_value_seen` pokud detekuje, že klient používá starý SDK.

### 26.4 Removed endpoints

```
HTTP/1.1 410 Gone
Sunset: Wed, 19 May 2027 00:00:00 GMT
Link: <https://docs.shopio.com/upgrade/2027-05-19#orders-endpoint>; rel="successor-version"

{
  "type": "https://docs.shopio.com/errors/endpoint-sunset",
  "code": "ENDPOINT_SUNSET",
  "title": "This endpoint has been removed",
  "detail": "POST /api/2025-01-01/orders was sunset on 2027-05-19. Use POST /api/2027-05-19/orders.",
  "status": 410
}
```

---

## 27. Testing requirements

### 27.1 Contract tests

Každý REST endpoint musí mít:
- ✅ Successful path (2xx)
- ✅ Auth failure (401)
- ✅ Permission denied (403) where applicable
- ✅ Not found (404)
- ✅ Validation error (400 / 422)
- ✅ Idempotency replay test (kde idempotency povinná)
- ✅ ETag concurrency test (kde If-Match povinný)

Tests běží proti real Fastify + real Postgres + real Redis přes testcontainers (viz DEC-DEV-002).

### 27.2 Schema snapshot

OpenAPI spec snapshot v repo. PR měnící spec triggeruje review check `[breaking-change-review]` label.

### 27.3 SDK integration

Auto-generated SDK runs vs deployed staging API v CI (smoke pak).

### 27.4 Performance budgets

Per endpoint v `DEC-PERF-001`:

```
GET /products (list) p95 < 200ms
GET /products/:id    p95 < 80ms
POST /cart/add       p95 < 250ms
POST /checkout       p95 < 500ms
GET /search          p95 < 150ms
```

k6 testy v CI failují build při regression > 20 %.

---

## 28. Změny

| Datum | Změna |
|---|---|
| 2026-05-19 | Initial — kompletní konvence pro REST + GraphQL + tRPC + MCP. Date-based versioning (DEC-API-002), RFC 7807 errors, cursor pagination, Idempotency-Key, ETag concurrency, rate limit RFC 9331, OpenAPI 3.1 generated z Zod schemas. |

---

## ⚠️ Pravidla pro úpravy

```
1. Žádná konvence se nemění bez explicitního DEC update
2. Změna konvence = nový DEC-API-* + migration window 2 versions
3. Doménový dokument může konvenci zpřísnit, nikdy uvolnit
4. Konfliktní design v doméně = master vyhrává; otevřít issue pro reconcile
5. Nová API metoda / styl (gRPC, SSE, ...) = nový DEC-API-* + sekce v tomto dokumentu
```

---

**Konec API Conventions.**

➡️ Pokračovat na: [`05-naming-conventions.md`](05-naming-conventions.md)
