# 05 – NAMING CONVENTIONS

> **Účel:** Pojmenovací pravidla napříč celou platformou — kód, DB, API, eventy, packages, ID, env vars, Git, testy, dokumenty. Pokud doménový dokument říká něco jiného, **tento dokument vítězí**.

**Datum:** 2026-05-19
**Verze:** 1.0
**Reference:** [01-decisions-registry.md](01-decisions-registry.md) · [03-data-models-master.md](03-data-models-master.md) · [04-api-conventions.md](04-api-conventions.md)

---

## 📑 Obsah

1. [Univerzální pravidla](#1-univerzální-pravidla)
2. [Case styles cheatsheet](#2-case-styles-cheatsheet)
3. [TypeScript / JavaScript](#3-typescript--javascript)
4. [React komponenty + hooks](#4-react-komponenty--hooks)
5. [CSS / Tailwind / design tokens](#5-css--tailwind--design-tokens)
6. [Database (PostgreSQL)](#6-database-postgresql)
7. [Drizzle schema](#7-drizzle-schema)
8. [Migrations](#8-migrations)
9. [API (URL, JSON, headers)](#9-api-url-json-headers)
10. [GraphQL](#10-graphql)
11. [Identifikátory (ID prefixy)](#11-identifikátory-id-prefixy)
12. [Events & jobs](#12-events--jobs)
13. [Permissions & scopes](#13-permissions--scopes)
14. [Feature flags](#14-feature-flags)
15. [Environment variables](#15-environment-variables)
16. [Packages, apps, services](#16-packages-apps-services)
17. [Soubory a složky](#17-soubory-a-složky)
18. [Plugin a theme packages](#18-plugin-a-theme-packages)
19. [Git — branch, commit, tag](#19-git--branch-commit-tag)
20. [Testy](#20-testy)
21. [Logs, metrics, traces](#21-logs-metrics-traces)
22. [Build spec ID systém](#22-build-spec-id-systém)
23. [Email + notification kódy](#23-email--notification-kódy)
24. [Dokumenty a markdown](#24-dokumenty-a-markdown)
25. [Slovník zakázaných slov + reserved](#25-slovník-zakázaných-slov--reserved)
26. [Anti-patterns — co NIKDY](#26-anti-patterns--co-nikdy)
27. [Změny](#27-změny)

---

## 1. Univerzální pravidla

```
✅ Angličtina pro všechny identifikátory v kódu, DB, API, gitu, testech, eventech
✅ Jasnější jméno > kratší jméno  (createOrderInvoice > createOrdInv)
✅ Singulární typy, plurální kolekce  (Product / products)
✅ Žádné zkratky, kromě industry-standardních (id, url, http, sku, pdf, gdpr, vat)
✅ Domain language z 02-glossary.md  (cart, ne basket; product, ne item)
✅ Pozitivní polarita pro boolean  (isActive, ne isInactive)
✅ Žádné magic numbers — pojmenuj konstantou
✅ Nejednoznačné nepoužívej  (data, info, manager, helper, util)  pouze jako poslední resort
```

**Čeština** je povolená **jen** v:
- Customer-facing texty (storefront copy, email subjects, admin labels) — přes i18n
- Doménová dokumentace v `zadani/` (tato sada)
- Code comments? **Ne** — komentáře anglicky
- Test names? **Ne** — anglicky

---

## 2. Case styles cheatsheet

| Styl | Příklad | Kde používat |
|---|---|---|
| `camelCase` | `createOrder`, `totalAmount` | TS proměnné, funkce, GraphQL fields, JSON na klient SDK (pokud SDK mapuje) |
| `PascalCase` | `Product`, `OrderItem`, `EventBus` | TS classes, types, interfaces, React components, GraphQL types |
| `snake_case` | `tenant_id`, `created_at`, `order_items` | **DB tabulky + sloupce, wire JSON, env vars (lower)** |
| `SCREAMING_SNAKE_CASE` | `MAX_RETRY_ATTEMPTS`, `STRIPE_API_KEY` | TS konstanty (top-level immutable), env vars, GraphQL enum values, permission keys |
| `kebab-case` | `order-management`, `api-rest` | URL paths, file names (non-component), package names, branch names, CSS classes, slugs |
| `dot.case` | `catalog.search_products`, `EVENT-ORDER-PLACED` (parts) | MCP tools, log fields, telemetry attribute names |

**Klíčová nekonzistence** (vědomá): wire JSON je `snake_case`, GraphQL fields jsou `camelCase`, TS in-memory objekty jsou `camelCase`. Mapping na hranicích řeší SDK / GraphQL codegen / Zod transform.

---

## 3. TypeScript / JavaScript

### 3.1 Identifiers

```typescript
// ✅ proměnné, funkce, parametry — camelCase
const orderTotal = 12990;
function calculateTax(amount: number, rateBasisPoints: number) { ... }

// ✅ classes, types, interfaces, enums — PascalCase
class OrderService { ... }
type ProductId = string;
interface CheckoutSession { ... }
enum OrderStatus { ... }    // (raději union typy — viz 3.4)

// ✅ konstanty (true const, immutable, top-level) — SCREAMING_SNAKE_CASE
const MAX_CART_ITEMS = 100;
const STRIPE_API_VERSION = '2026-04-15';

// ❌ lokální const proměnné NEjsou SCREAMING_SNAKE
function foo() {
  const userId = ctx.userId;       // ✅ camelCase
  // ne USER_ID
}

// ✅ Generics — single uppercase preferred, descriptive když >1 nebo context
function map<T, U>(items: T[], fn: (item: T) => U): U[] { ... }
type Repository<TEntity, TId = string> = { ... }
```

### 3.2 Boolean prefix

```typescript
isActive, isAdmin, isPending          // stav
hasVariants, hasShipping, hasAccess    // vlastnictví / přítomnost
canEdit, canDelete, canRefund          // schopnost
shouldRetry, shouldNotify              // doporučení
willExpire                             // budoucnost
wasModified, didFail                   // minulost (pro events / past tense facts)
```

Nikdy: `active: boolean`, `admin: boolean` bez prefixu (ambivalentní — je to enum hodnota? string status?).

### 3.3 Funkce

```typescript
// Akce — slovesa
createOrder(), updateProduct(), deleteCustomer(), archiveTenant()

// Getters / queries — get, find, list (rozlišení!)
getOrder(id)        // hodí throw NotFoundError pokud neexistuje
findOrder(id)       // vrací Order | null (lookup that may miss)
listOrders(filter)  // collection, paginated
countOrders(filter) // jen count

// Side-effect-less computations — calculate, derive, compose
calculateOrderTotal(...)
deriveTaxBreakdown(...)
composeAddressLabel(...)

// Validace — validate (throw on fail) vs check (return bool/result)
validateVatId(id)               // throws ValidationError
checkVatId(id): ValidationResult
isValidVatId(id): boolean       // pure boolean test

// Async toggling — assert prefix když throw
assertOwner(userId, orderId)    // throws if not owner
```

### 3.4 Union types over enums

```typescript
// ✅ Preferuj string literal union — sjednocené s DB CHECK constraint
type OrderStatus = 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';

// Enum jen pro: bit flags, public API kde potřebuješ runtime introspection
enum PermissionFlags {
  Read = 1 << 0,
  Write = 1 << 1,
  Admin = 1 << 2,
}
```

### 3.5 Async/Promise konvence

```typescript
async function fetchProducts() { ... }    // ✅ async řekne všechno
function fetchProductsAsync() { ... }     // ❌ suffix `Async` redundantní v TS

// Cancellation: AbortSignal vždy poslední optional param
async function fetchProducts(filter: ProductFilter, signal?: AbortSignal) { ... }
```

### 3.6 Error classes

```typescript
class DomainError extends Error { code: string; status: number; }
class ValidationError extends DomainError { fields: FieldError[]; }
class NotFoundError extends DomainError { ... }
class ConflictError extends DomainError { ... }
class UnauthorizedError extends DomainError { ... }
class ForbiddenError extends DomainError { ... }
class RateLimitError extends DomainError { retryAfterSeconds: number; }
```

**Vždy** suffix `Error`, **vždy** rozšíření `DomainError` (mapování na HTTP status + error code v jednom místě, viz `04 §7`).

### 3.7 Reserved suffixy

| Suffix | Význam |
|---|---|
| `*Service` | Business logic v `packages/core/src/services/` |
| `*Repository` | DB access, výlučně z Service |
| `*Handler` | HTTP route handler (Fastify) |
| `*Resolver` | GraphQL resolver |
| `*Procedure` | tRPC procedure |
| `*Job` | BullMQ background job |
| `*Event` | Doménový event payload type |
| `*Schema` | Zod schema |
| `*Dto` | **NE** — DTO pojem nepoužíváme; máme Zod schemas |

---

## 4. React komponenty + hooks

### 4.1 Komponenty

```tsx
// ✅ PascalCase, file = component name
function ProductCard({ product }: ProductCardProps) { ... }
function OrderStatusBadge({ status }: OrderStatusBadgeProps) { ... }

// Props type: {ComponentName}Props
interface ProductCardProps { product: Product; onSelect?: (id: string) => void; }

// File: ProductCard.tsx  (PascalCase, .tsx)
// Folder pro multi-file komponenty: kebab-case
//   product-card/
//   ├── ProductCard.tsx
//   ├── ProductCard.stories.tsx
//   ├── ProductCard.test.tsx
//   └── index.ts          (re-export, ne barrel napříč packages)
```

### 4.2 Hooks

```tsx
// ✅ camelCase s `use` prefixem (React rule)
useOrder(id)
useCartItems()
useCheckoutFlow()

// Custom hooks pro server state — TanStack Query pattern
useOrderQuery(id)        // query
useOrderMutation()        // mutation
useOrdersInfiniteQuery()  // infinite scroll

// File: useOrder.ts (camelCase!)
```

### 4.3 Form handlers + event handlers

```tsx
onClick={handleSubmit}            // handle{Action}
onChange={handleQuantityChange}
onSubmit={handleCheckoutSubmit}

// Props předávané dolů — on{Event}
<ProductCard onSelect={handleProductSelect} />
```

### 4.4 Composition helpers

```tsx
// ✅ Higher-order components — withFeatureFlag, withAuth
const ProtectedOrder = withAuth(OrderDetail);

// ✅ Render props — render{Thing}
<DataTable renderRow={(row) => ...} />

// ❌ Nepoužíváme `*Container` / `*Connector` pattern — TanStack Query nahradila Redux-style containers
```

### 4.5 Storefront vs Admin component naming

- **Storefront** komponenty (Next.js 16) v `packages/storefront-next/src/components/` — kebab-case folders, PascalCase files
- **Admin** komponenty (Vite + React 19) v `packages/admin/src/components/` — stejné konvence
- Sdílené komponenty: `packages/ui-shared/` — pouze framework-agnostic primitives, žádný router/data fetching uvnitř

---

## 5. CSS / Tailwind / design tokens

### 5.1 Tailwind first, vlastní CSS jen pro complex cases

```tsx
// ✅ Tailwind utility classes — kebab-case, framework-defined
<div className="flex items-center gap-4 p-6 rounded-lg bg-surface text-fg">

// Vlastní CSS classy v sass/postcss souborech:
.product-card { ... }
.product-card__image { ... }      // BEM element — __
.product-card--featured { ... }    // BEM modifier — --
```

BEM jen pro **kořenové komponenty**, kde Tailwind class list překračuje 8–10 tříd a stěhování do CSS dává smysl.

### 5.2 Design tokens (CSS variables)

```css
:root {
  --color-brand-primary: #0066ff;
  --color-bg-surface: #ffffff;
  --color-fg-default: #0a0a0a;
  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --font-family-sans: 'Inter', system-ui, sans-serif;
  --radius-sm: 4px;
  --radius-md: 8px;
}
```

Konvence: `--{category}-{semantic-name}` (`--color-brand-primary`, ne `--blue` nebo `--primary-blue`).

Detail design system: `35-graphic-templates.md`.

### 5.3 Tailwind theme tokeny

```javascript
// tailwind.config.ts
extend: {
  colors: {
    'brand-primary': 'var(--color-brand-primary)',
    'bg-surface': 'var(--color-bg-surface)',
    'fg-default': 'var(--color-fg-default)',
  }
}
```

V JSX pak `bg-bg-surface text-fg-default` (lehce ošklivé, ale konzistentní s tokens).

---

## 6. Database (PostgreSQL)

### 6.1 Tabulky

```
✅ snake_case, plurál
   products, order_items, stock_movements, audit_log
   
✅ Junction tables — both_plural nebo {entity}_{entity}s
   product_categories  (preferred)
   product_to_category (ne)
   
✅ Append-only / log tables — singular nebo *_log
   audit_log, job_log, stock_movements, order_transitions
```

**Žádné** prefixy `tbl_`, `t_`, `app_`. Pokud potřebujeme schema namespace, použij Postgres SCHEMA (`plugin_acme.something`).

### 6.2 Sloupce

```
✅ snake_case
   tenant_id, created_at, total_amount, is_active

✅ Foreign key — {referenced_table_singular}_id
   product_id, customer_id, shipping_address_id

✅ Timestamp — suffix _at (TIMESTAMPTZ)
   created_at, updated_at, deleted_at, published_at, last_login_at

✅ Boolean — prefix is_, has_, can_
   is_active, has_variants, can_backorder

✅ Money — suffix _amount + companion _currency
   total_amount BIGINT, total_currency CHAR(3)

✅ Counts / quantities — descriptive int
   quantity, on_hand, reserved, max_uses_total

✅ Percentages — basis points (10000 = 100 %)
   rate_basis_points INT, commission_basis_points INT

✅ Enum-like — text + CHECK constraint
   status TEXT CHECK (status IN ('draft','active','archived'))
```

**Reserved column names** (vždy dodrž):

```
id              UUID PRIMARY KEY (UUID v7)
tenant_id       UUID NOT NULL
created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
deleted_at      TIMESTAMPTZ NULL
created_by      UUID NULL
updated_by      UUID NULL
version         INTEGER NOT NULL DEFAULT 1
metadata        JSONB NOT NULL DEFAULT '{}'::jsonb
```

### 6.3 Primární a cizí klíče

```sql
-- ✅ PK vždy `id`
id UUID PRIMARY KEY DEFAULT uuidv7()

-- ✅ FK constraint name
CONSTRAINT fk_order_items_order_id
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
  
-- Convention: fk_{table}_{column}
```

### 6.4 Indexy

```
✅ Pojmenování: idx_{table}_{column}[_{column2}][_{condition}]
   idx_products_tenant_id
   idx_orders_tenant_id_placed_at_desc
   idx_products_metadata_gin
   idx_products_tenant_id_status_partial   -- WHERE deleted_at IS NULL
   
✅ UNIQUE indexes: uq_{table}_{column}
   uq_products_tenant_id_slug
   uq_users_tenant_id_email
   
✅ BRIN indexes: brin_{table}_{column}
   brin_audit_log_occurred_at
   brin_stock_movements_created_at
```

### 6.5 CHECK constraints

```
✅ ck_{table}_{description}
   ck_products_status
   ck_cart_items_quantity_positive
   ck_orders_total_amount_non_negative
```

### 6.6 Triggers a funkce

```
✅ Triggery: tg_{table}_{event}_{action}
   tg_products_before_update_bump_version
   tg_orders_after_insert_emit_event
   
✅ Funkce: fn_{purpose}
   fn_bump_updated_at()
   fn_uuidv7()
   fn_validate_tenant_id()
```

### 6.7 Views a materialized views

```
✅ Views: v_{purpose}
   v_active_products
   v_low_stock_alert
   
✅ Materialized views: mv_{purpose}
   mv_customer_lifetime_value
   mv_product_sales_30d
```

### 6.8 Sequences

```
✅ seq_{table}_{column}
   seq_orders_number
   seq_invoices_number_2026   -- per-year sequence
```

### 6.9 RLS policies

```
✅ rls_{table}_{purpose}
   rls_products_tenant_isolation
   rls_orders_customer_owned_read
```

### 6.10 Reserved SQL keywords

Vyhýbej se kolizím s SQL keywords i když Postgres je povolí: `user`, `order`, `group`, `select`, `from`, `table`, `time`, `type`.

Místo toho: `users`, `orders`, `groups`, …. (Naše `orders` je plurál tak jako tak; problém řeší.)

---

## 7. Drizzle schema

```typescript
// packages/db/src/schema/products.ts
import { pgTable, uuid, text, timestamp, bigint, integer, boolean, jsonb } from 'drizzle-orm/pg-core';

// ✅ Variable name = singular PascalCase (table object)
//    Table name (DB) = plural snake_case (1. arg)
export const products = pgTable('products', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  pubId: text('pub_id').notNull(),
  slug: text('slug').notNull(),
  title: text('title').notNull(),
  status: text('status').notNull().$type<'draft' | 'active' | 'archived'>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  // ...
});
```

**Pravidla:**
- DB sloupec (1. arg `text('column_name')`): `snake_case`
- TS property (`tenantId`): `camelCase`
- Tabulkový proměnný export: `camelCase` plural (`products`) — to je standardně Drizzle pattern
- Type export: `Product` (singular PascalCase) + `NewProduct` (insert type)

```typescript
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
```

---

## 8. Migrations

```
packages/db/migrations/
├── 20260520_001_create_tenants.sql
├── 20260520_002_create_users.sql
├── 20260520_003_create_products.sql
├── 20260521_001_add_products_metadata_gin.sql
└── ...
```

**Pravidla:**
- `YYYYMMDD_NNN_{snake_case_description}.sql`
- `NNN` per-day sequence (001, 002, …) — řeší více migrací stejný den
- Description: imperativní `create_`, `add_`, `drop_`, `rename_`, `backfill_`
- Vždy reversible kdekoliv to jde — Drizzle `up()` + `down()` (drizzle-kit handle)
- Žádné `update_*` migrace bez konkrétního důvodu — `backfill_*` je explicitnější

**Příklady:**
```
20260520_001_create_tenants.sql
20260520_002_create_products_table.sql
20260521_001_add_products_metadata_gin_index.sql
20260521_002_backfill_products_pub_id.sql
20260522_001_drop_legacy_orders_view.sql
20260601_001_rename_customer_phone_to_contact_phone.sql
```

---

## 9. API (URL, JSON, headers)

Detail v `04-api-conventions.md`, zde sumarizace pro naming.

### 9.1 URL paths

```
✅ kebab-case, lowercase, plurál
   /api/2026-05-19/products
   /api/2026-05-19/orders/{id}
   /api/2026-05-19/order-items
   /api/2026-05-19/products/{id}:archive
   
❌ /api/2026-05-19/Products
❌ /api/2026-05-19/order_items
❌ /api/2026-05-19/orderItems
❌ /api/2026-05-19/product             (singulár collection)
```

### 9.2 Query parameters

```
✅ snake_case
   ?status=active&price_min=100&sort=created_at:desc

❌ camelCase ?statusActive=true
❌ kebab-case ?price-min=100
```

### 9.3 JSON wire body

```jsonc
{
  "tenant_id": "...",         // snake_case
  "created_at": "2026-05-19T...",
  "total_amount": 12990,
  "total_currency": "CZK",
  "is_active": true
}
```

SDK může v klient kódu prezentovat jako camelCase přes mapper, ale **wire = snake_case**.

### 9.4 HTTP headers

```
Authorization                       # standard, Title-Case-Hyphenated
Content-Type
Accept-Language
Idempotency-Key                     # standard / RFC
If-Match
ETag
Retry-After
RateLimit-Limit                     # RFC 9331

Shopio-Version                      # vlastní — prefix Shopio-, Title-Case
Shopio-Event                        # webhook event type
Shopio-Signature
Shopio-Delivery-Id
Shopio-Forward-Compat-Warning

X-Request-ID                        # tradiční X- prefix pro debug-only headers (legacy ok)
X-Correlation-ID
```

**Pravidla:**
- Vlastní headers prefix `Shopio-` (nikoliv `X-Shopio-` — `X-` je deprecated dle RFC 6648, ale toleruje se pro request/response IDs jakožto established)
- Title-Case-Hyphenated
- Žádný `_underscore_`

---

## 10. GraphQL

Tady jediná disciplína, kde používáme **camelCase** pro fields (GraphQL community standard).

```graphql
type Product {
  id: ID!
  pubId: String!
  slug: String!
  title: String!
  totalAmount: Money
  createdAt: DateTime!
  status: ProductStatus!
}

enum ProductStatus {
  DRAFT
  ACTIVE
  ARCHIVED
}

input ProductCreateInput {
  title: String!
  slug: String
  status: ProductStatus = DRAFT
}

type Query {
  products(first: Int, after: String, filter: ProductFilter): ProductConnection!
  productById(id: ID!): Product
}

type Mutation {
  createProduct(input: ProductCreateInput!): CreateProductPayload!
  updateProduct(id: ID!, input: ProductUpdateInput!): UpdateProductPayload!
}
```

**Konvence:**
- Types, interfaces, unions: `PascalCase`
- Fields, arguments: `camelCase`
- Enum values: `SCREAMING_SNAKE_CASE`
- Input types: suffix `Input` (`ProductCreateInput`)
- Mutation payload: suffix `Payload` (`CreateProductPayload`)
- Connection types (Relay): suffix `Connection` + `Edge`
- Query name = field name (`products`, ne `getProducts` — `get` redundant v GraphQL)

---

## 11. Identifikátory (ID prefixy)

NanoID public IDs s typovým prefixem (čitelné v UI/URL, identifikuje typ entity).

```
Format: {prefix}_{12-char NanoID alphabet "0-9A-Za-z"}
Example: prd_aB3cD4eF5g6h
```

| Prefix | Entita | Příklad |
|---|---|---|
| `tnt_` | tenant | `tnt_aB3cD4eF5g6h` |
| `usr_` | user | `usr_...` |
| `cus_` | customer | `cus_...` |
| `cmp_` | company | `cmp_...` |
| `adr_` | address | `adr_...` |
| `prd_` | product | `prd_...` |
| `var_` | variant | `var_...` |
| `cat_` | category | `cat_...` |
| `col_` | collection | `col_...` |
| `crt_` | cart | `crt_...` |
| `chk_` | checkout_session | `chk_...` |
| `ord_` | order — pozor: order **number** je `ORD-2026-00001234`, **pub_id** je `ord_aB3cD` | `ord_...` |
| `oit_` | order_item | `oit_...` |
| `pay_` | payment | `pay_...` |
| `ref_` | refund | `ref_...` |
| `shp_` | shipment | `shp_...` |
| `inv_` | invoice | `inv_...` (pozor: invoice **number** je `INV-2026-...`) |
| `ret_` | return / RMA | `ret_...` |
| `whs_` | warehouse | `whs_...` |
| `prc_` | price_list | `prc_...` |
| `dsc_` | discount | `dsc_...` |
| `cpn_` | coupon | `cpn_...` |
| `txz_` | tax_zone | `txz_...` |
| `txr_` | tax_rate | `txr_...` |
| `chn_` | channel | `chn_...` |
| `str_` | store | `str_...` |
| `thm_` | theme | `thm_...` |
| `mdi_` | media | `mdi_...` |
| `pag_` | cms_page | `pag_...` |
| `sub_` | subscription | `sub_...` |
| `plg_` | plugin | `plg_...` |
| `whk_` | webhook | `whk_...` |
| `dlv_` | webhook_delivery | `dlv_...` |
| `ses_` | session | `ses_...` |
| `sk_live_` | api_key live | `sk_live_aB3cD4eF...` |
| `sk_test_` | api_key test | `sk_test_...` |
| `agt_` | agent_token | `agt_...` |
| `op_`  | operation (async job handle) | `op_...` |
| `evt_` | event (outbox/audit) | `evt_...` |

**Pravidla:**
- 3 znaky + `_` jako oddělovač
- Prefix musí být **unikátní napříč všemi entitami** (žádné dva prefix `_or_` collisions)
- API keys používají Stripe-style dvouvrstvý prefix (`sk_live_*`, `sk_test_*`)
- Interní `id` (UUID v7) **nikdy** nevidí klient mimo internal endpoints

### 11.1 Document numbers (zákonné sekvence)

```
ORD-2026-00001234         # order number, sequence reset per year per tenant
INV-2026-00001234         # invoice (zákonná sekvence)
RMA-2026-00000123         # return/RMA
PRO-2026-00000045         # proforma
CRD-2026-00000012         # credit note
```

Formát: `{KIND}-{YEAR}-{8-digit zero-padded}`. Sekvence per (tenant_id, kind, year) ve `seq_{kind}_number_{year}` Postgres sequence nebo single table s row-level lock.

---

## 12. Events & jobs

### 12.1 Doménové eventy

Format: `EVENT-{DOMAIN}-{ACTION_PAST_TENSE}`

```
EVENT-ORDER-PLACED
EVENT-ORDER-PAID
EVENT-ORDER-FULFILLED
EVENT-ORDER-CANCELLED
EVENT-PRODUCT-CREATED
EVENT-PRODUCT-UPDATED
EVENT-PRODUCT-ARCHIVED
EVENT-CART-ITEM-ADDED
EVENT-PAYMENT-CAPTURED
EVENT-PAYMENT-FAILED
EVENT-SHIPMENT-DELIVERED
EVENT-CUSTOMER-REGISTERED
EVENT-WEBHOOK-DELIVERED
```

**Konvence:**
- `SCREAMING-KEBAB-CASE` (rozdíl od permissions = `PERM-X-Y` plochý)
- Action v **past tense** (events fakta minulosti, ne příkazy)
- Hierarchie `DOMAIN-SUBDOMAIN-ACTION` povolená max 3 úrovně

**Wire format** (webhook out, viz `04 §19`):
```
order.placed
order.paid
cart_item.added
webhook.delivered
```

Tj. wire je `dot.snake_case` (industry standard Stripe/Shopify). Mapping mezi build-spec ID a wire je 1:1, převod v generated code.

### 12.2 Background jobs

Format: `JOB-{NAME}` v dokumentaci, `kebab-case` v BullMQ queue names.

```
JOB-SEND-ORDER-CONFIRMATION-EMAIL    → queue: send-order-confirmation-email
JOB-DELIVER-WEBHOOK                   → queue: deliver-webhook
JOB-REINDEX-PRODUCT-SEARCH            → queue: reindex-product-search
JOB-EXPORT-PRODUCT-FEED               → queue: export-product-feed
JOB-PURGE-DELETED                     → queue: purge-deleted
JOB-VALIDATE-VAT-ID                   → queue: validate-vat-id
JOB-RECONCILE-PAYMENT                 → queue: reconcile-payment
JOB-PICKUP-SYNC                       → queue: pickup-sync
```

### 12.3 Cron jobs / scheduled

```
CRON-DAILY-LOW-STOCK-CHECK            → schedule: '0 8 * * *'
CRON-HOURLY-EXCHANGE-RATE-SYNC        → schedule: '0 * * * *'
CRON-WEEKLY-EKO-KOM-REPORT            → schedule: '0 9 * * 1'
```

---

## 13. Permissions & scopes

### 13.1 Permission keys (interní RBAC)

Format: `PERM-{RESOURCE}-{ACTION}`

```
PERM-PRODUCT-VIEW
PERM-PRODUCT-CREATE
PERM-PRODUCT-UPDATE
PERM-PRODUCT-DELETE
PERM-PRODUCT-EXPORT
PERM-ORDER-VIEW
PERM-ORDER-REFUND
PERM-ORDER-CANCEL
PERM-CUSTOMER-VIEW-PII
PERM-CUSTOMER-EXPORT-GDPR
PERM-SETTINGS-MANAGE
PERM-PLUGIN-INSTALL
PERM-USER-INVITE
PERM-AUDIT-LOG-VIEW
```

**Konvence:**
- `SCREAMING-KEBAB`
- Akce typicky `VIEW`, `CREATE`, `UPDATE`, `DELETE`, `LIST`, `EXPORT`, `IMPORT`, `MANAGE`, `INSTALL`, `INVOKE`
- Sensitive: `VIEW-PII`, `VIEW-PAYMENT-DETAILS`, `IMPERSONATE`

### 13.2 API scopes (OAuth + API keys)

Format: `{resource}:{action}`

```
products:read
products:write
orders:read
orders:write
customers:read
customers:write
payments:write
shipments:write
catalog:read           # superset products + categories + collections
admin:full              # ekvivalent owner role
agent:catalog:read      # agent-specific scopes mají agent: prefix
agent:cart:write
agent:checkout:initiate
```

**Konvence:**
- `lowercase:dot.colon.separated`
- Read implies less than write; write **neimplikuje** read (klient musí mít oba pokud potřebuje)
- Wildcard: `*:read` (all read) jen pro Enterprise + audit log

---

## 14. Feature flags

Format: `FEATURES.{DOMAIN}` jako TS objekt, `FEATURE_{DOMAIN}` jako env var.

```typescript
// packages/core/src/features/index.ts
export const FEATURES = {
  CORE: true,
  B2B_LITE: true,
  B2B_FULL: false,                    // v1.0 commercial module
  MULTI_TENANT: false,                 // v3.0 Cloud SaaS
  MULTI_SOURCE_INVENTORY: false,       // v1.0
  AI_COPILOT: false,                   // v1.0 commercial
  SSO_SAML: false,                     // v1.0 commercial
  SUBSCRIPTIONS: false,                // v2.0
  MARKETPLACE: false,                  // v4.0
  ENABLE_RLS: false,                   // v3.0 Cloud activation
  ENABLE_TELEMETRY: false,             // opt-in
} as const;
```

Env override: `FEATURE_B2B_FULL=true` → runtime override (jen pro Enterprise / Cloud paid tier).

License-gated flags ověřuje `tools/license-checker` při buildu (DEC-ARCH-001).

---

## 15. Environment variables

### 15.1 Pravidla

```
✅ SCREAMING_SNAKE_CASE
✅ Prefix by skupinu:
   DATABASE_*       (DATABASE_URL, DATABASE_POOL_SIZE)
   REDIS_*          (REDIS_URL, REDIS_PASSWORD)
   AUTH_*           (AUTH_JWT_SECRET, AUTH_SESSION_TTL_SECONDS)
   STRIPE_*         (STRIPE_API_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_API_VERSION)
   GOPAY_*, COMGATE_*, THEPAY_*, PAYPAL_*
   AWS_*, S3_*      (S3_ENDPOINT, S3_BUCKET, S3_REGION, S3_ACCESS_KEY)
   SMTP_*           (SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD)
   RESEND_*, MAILGUN_*
   MEILISEARCH_*
   ANTHROPIC_API_KEY, OPENAI_API_KEY    (DEC-AI-001)
   SENTRY_*
   GRAFANA_*
   FEATURE_*        (runtime feature flag override)
   SHOPIO_*         (platform-specific: SHOPIO_LOG_LEVEL, SHOPIO_PORT, SHOPIO_BASE_URL)

✅ TTL suffix _SECONDS / _MS / _MINUTES (be explicit)
   AUTH_SESSION_TTL_SECONDS=2592000
   WEBHOOK_TIMEOUT_MS=30000

✅ Boolean: ENABLE_*=true / false (lowercase strings, zod coerced)
   ENABLE_TELEMETRY=false
   ENABLE_RLS=false
   ENABLE_DEBUG_LOGS=false
```

### 15.2 .env file conventions

```
.env.example       # checked-in template s comments
.env               # local dev, gitignored
.env.test          # CI test env
.env.production    # NEVER committed; deployed via Vault / secrets manager
```

Validace přes Zod při startu (DEC-SEC-002 secrets management).

---

## 16. Packages, apps, services

### 16.1 NPM package names

```
@shopio/core                # business logika
@shopio/db                  # Drizzle schema + migrations
@shopio/api-rest
@shopio/api-graphql
@shopio/api-trpc
@shopio/api-mcp
@shopio/admin
@shopio/storefront-next
@shopio/sdk-js
@shopio/cli
@shopio/plugin-kit
@shopio/ui-shared
@shopio/schemas             # sdílené Zod schemas

@shopio/enterprise-b2b      # commercial
@shopio/enterprise-msi
@shopio/enterprise-ai-copilot
@shopio/enterprise-sso

@shopio-plugin/{name}       # community / 3rd-party pluginy
@shopio-theme/{name}        # themes
```

**Konvence:**
- Scope `@shopio` pro platform-owned
- Scope `@shopio-plugin` pro 3rd-party pluginy (marketplace namespace)
- Scope `@shopio-theme` pro themes
- Package name: `kebab-case` (NPM standard)

### 16.2 Adresářová struktura (workspace)

```
shopio/
├── packages/
│   ├── core/
│   ├── db/
│   ├── api-rest/
│   ├── api-graphql/
│   ├── api-trpc/
│   ├── api-mcp/
│   ├── admin/
│   ├── storefront-next/
│   ├── sdk-js/
│   ├── cli/
│   ├── plugin-kit/
│   ├── ui-shared/
│   ├── schemas/
│   ├── enterprise/        # commercial moduly (stuby v MVP)
│   └── cloud/             # Cloud-specific (stuby v MVP)
├── apps/
│   ├── docs/
│   └── marketing-site/
├── distributions/
│   ├── community-edition/
│   ├── enterprise/
│   └── cloud/
├── tools/
│   ├── license-checker/
│   ├── scripts/
│   └── codegen/
├── tests/
│   ├── e2e/
│   └── load/
└── zadani/                 # tato build-spec
```

Detail v `todo.md §3.2`.

---

## 17. Soubory a složky

### 17.1 TypeScript

```
✅ kebab-case pro non-component soubory
   order-service.ts
   create-order.ts
   validate-vat-id.ts
   
✅ PascalCase pro React/JSX komponenty
   ProductCard.tsx
   OrderStatusBadge.tsx
   
✅ camelCase pro hooks
   useOrder.ts
   useCheckoutFlow.ts
   
✅ Index files re-export current folder
   src/services/index.ts → export * from './order-service'
   
   POZOR: barrel files napříč packages = build bottleneck. Index jen v rámci jedné folder úrovně,
   import napříč packages přímo z deep path je OK.
```

### 17.2 Asset files

```
✅ kebab-case + descriptive
   product-placeholder.png
   logo-dark.svg
   icon-warning.svg
   
❌ IMG_001.png, screenshot.png, file (1).png
```

### 17.3 Test files

```
{name}.test.ts          # unit / integration tests
{name}.test.tsx          # React component tests
{name}.spec.ts           # alternativní (preferujeme .test.)
{name}.e2e.ts            # Playwright E2E
{name}.bench.ts          # benchmarks
{name}.stories.tsx       # Storybook stories
```

### 17.4 Markdown docs

```
✅ kebab-case
   getting-started.md
   architecture-overview.md
   plugin-authoring.md

   Výjimka: BUILD-SPEC v zadani/ má číselný prefix:
   00-master-index.md
   01-decisions-registry.md
   …
   
   Velká písmena povolená jen pro:
   README.md
   CHANGELOG.md
   LICENSE
   CONTRIBUTING.md
   SECURITY.md
   CODE_OF_CONDUCT.md
   NOTICE
```

---

## 18. Plugin a theme packages

### 18.1 Plugin package

```
@shopio-plugin/heureka-feed
@shopio-plugin/pohoda-export
@shopio-plugin/zboží-cz       # transliterate: zbozi-cz (NPM nepovoluje non-ASCII)
@shopio-plugin/mailchimp
@shopio-plugin/klaviyo
@shopio-plugin/eko-kom-report
```

### 18.2 Plugin source structure

```
@shopio-plugin/heureka-feed/
├── package.json
├── shopio-plugin.json       # manifest (id, name, version, hooks, ui slots, perms)
├── src/
│   ├── index.ts             # entry: registerPlugin(...)
│   ├── handlers/
│   ├── jobs/
│   ├── ui/                  # admin slot components
│   └── migrations/          # plugin owns separate schema namespace
└── README.md
```

### 18.3 Plugin manifest (`shopio-plugin.json`)

```jsonc
{
  "id": "heureka-feed",
  "name": "Heureka.cz feed",
  "version": "1.2.3",
  "minPlatformVersion": "1.0.0",
  "permissions": ["products:read", "orders:read"],
  "hooks": ["product.updated", "order.placed"],
  "ui_slots": ["admin.settings.integrations"],
  "schema_namespace": "plugin_heureka_feed"
}
```

### 18.4 Theme packages

```
@shopio-theme/minimal
@shopio-theme/electronics
@shopio-theme/fashion-cz
```

Manifest: `shopio-theme.json` (settings schema, screenshots, demo URL).

---

## 19. Git — branch, commit, tag

### 19.1 Branch names

```
✅ kebab-case + prefix:
   feature/catalog-product-variants
   fix/checkout-tax-calculation
   refactor/event-bus-types
   docs/plugin-authoring-guide
   chore/upgrade-fastify-5
   release/v1.2.0
   hotfix/v1.1.3-payment-retry
   
❌ Bez prefixu / vágně
   my-changes
   wip
   john/stuff
```

### 19.2 Commit messages

Conventional Commits 1.0 + scope:

```
feat(catalog): add product bundle support
fix(checkout): correct VAT calculation for B2B reverse charge
refactor(events): unify EventBus interface across packages
docs(api): document Idempotency-Key requirement
test(orders): add E2E for partial refund flow
chore(deps): bump fastify to 5.1.0
perf(search): switch product reindex to incremental updates
revert: revert "feat(catalog): add product bundle support"
build(ci): cache pnpm store across jobs
ci(actions): add codeql scan
style(admin): apply biome formatting
```

**Scope** = package nebo doména (catalog, checkout, orders, admin, storefront, db, api, ci, deps, …).

**Pravidla:**
- Subject ≤ 72 znaků, imperativ, žádná tečka na konci
- Tělo (volitelné, 1+ blank line za subjectem, wrap 80 chars) vysvětluje **proč**
- Breaking changes: `feat(api)!:` nebo `BREAKING CHANGE:` footer

### 19.3 Tag names

```
v1.0.0
v1.0.1
v1.1.0-beta.1
v1.1.0-rc.2
v2.0.0
```

Semver vždy s `v` prefix.

### 19.4 PR title

Stejný formát jako commit message subject. PR description má sekce:

```
## What changed
## Why
## How to test
## Risk / rollback
## Linked issues  (Closes #123)
```

---

## 20. Testy

### 20.1 Test ID systém

`TEST-{TYPE}-{NUMBER}` v dokumentaci pro klíčové scénáře. V kódu jen popis.

```
TEST-E2E-CHECKOUT-001       Happy path B2C checkout
TEST-E2E-CHECKOUT-002       Guest checkout
TEST-E2E-CHECKOUT-003       B2B checkout with reverse charge
TEST-E2E-REFUND-001         Partial refund + restock
TEST-UNIT-PRICING-001       Tier pricing with overlap
TEST-INT-WEBHOOK-001        HMAC signature validation
TEST-LOAD-CART-001          1000 concurrent add-to-cart
```

### 20.2 Test naming v kódu

```typescript
// Vitest / Playwright — describe block describes the unit
describe('OrderService', () => {
  describe('createOrder', () => {
    it('creates an order when cart is valid and stock available', () => { ... });
    it('throws CartItemOutOfStockError when stock is insufficient', () => { ... });
    it('reserves inventory before payment authorization', () => { ... });
  });
});
```

**Pravidla:**
- `describe(ClassOrFeatureName, ...)` outer
- `describe(methodName, ...)` middle
- `it('does X when Y', ...)` — Gherkin-ish: outcome + condition
- Anglicky
- Žádné `it('should ...')` — present tense direct (`it('returns the order')` ne `it('should return the order')`)

### 20.3 Test files placement

```
packages/core/src/services/order-service.ts
packages/core/src/services/order-service.test.ts    # ko-located (preferred)

tests/e2e/checkout.e2e.ts                            # cross-package Playwright
tests/load/cart-stress.k6.ts                         # k6 load testy
tests/integration/webhook-delivery.test.ts            # cross-service integration
```

### 20.4 Test data factories

```typescript
// packages/test-fixtures/src/factories/
function makeProduct(overrides: Partial<Product> = {}): Product { ... }
function makeOrder(overrides: Partial<Order> = {}): Order { ... }

// V testech:
const product = makeProduct({ status: 'active' });
```

Convention: `make{Entity}` prefix. Avoid `create{Entity}` (clash with service methods).

### 20.5 Fixture data

`tests/fixtures/*.json` + `tests/fixtures/*.csv`. Naming `{domain}-{scenario}.{ext}`.

```
tests/fixtures/products-electronics-100.json
tests/fixtures/orders-b2b-with-reverse-charge.json
tests/fixtures/customers-czech.csv
```

---

## 21. Logs, metrics, traces

### 21.1 Log structured fields (pino)

```jsonc
{
  "level": "info",
  "time": "2026-05-19T14:30:00.123Z",
  "msg": "Order created",
  "tenant_id": "...",
  "request_id": "req_...",
  "trace_id": "...",
  "actor_kind": "user",
  "actor_id": "...",
  "entity_type": "order",
  "entity_id": "ord_...",
  "duration_ms": 42
}
```

**Konvence:**
- `snake_case` field names
- `msg` je kompaktní lidská zpráva (statická, ne template) — variabilní hodnoty jdou do strukturovaných polí
- Levels: `trace`, `debug`, `info`, `warn`, `error`, `fatal`
- Žádné `console.log` v produkčním kódu (lint rule)

### 21.2 Metrics names (Prometheus)

```
shopio_http_request_duration_seconds_bucket
shopio_http_requests_total
shopio_db_query_duration_seconds_bucket
shopio_order_placed_total
shopio_payment_authorized_total
shopio_cache_hit_ratio
shopio_queue_job_duration_seconds_bucket
shopio_queue_pending_jobs
shopio_active_carts
```

**Konvence:**
- Prefix `shopio_`
- `snake_case`
- Suffix `_total` pro Counter, `_seconds`/`_bytes`/`_count` pro units, `_ratio` pro 0-1
- Labels: `tenant_id` (pozor cardinality!), `endpoint`, `status_code`, `queue_name`, `result`

### 21.3 Trace attributes (OpenTelemetry)

```
shopio.tenant_id
shopio.actor_kind
shopio.entity_type
shopio.entity_id
shopio.request_id
http.method
http.route
http.status_code
db.system = "postgresql"
db.statement (sanitized)
```

OpenTelemetry semantic conventions + naše custom `shopio.*` namespace.

---

## 22. Build spec ID systém

Sumarizace z `00-MASTER-INDEX §1.2`:

```
ENT-{DOMAIN}-{NNN}              Entity (datový model)
   ENT-PRODUCT-001 = entita Product (definováno v 03)

RULE-{DOMAIN}-{NNN}             Business rule
   RULE-CART-001 = pravidlo košíku

API-{METHOD}-{RESOURCE}-{NNN}   API endpoint
   API-POST-CART-001

FLOW-{DOMAIN}-{NNN}             UX flow
   FLOW-CHECKOUT-001

PERSONA-{ROLE}                  Uživatelská role
   PERSONA-MERCHANT-OWNER

DEC-{DOMAIN}-{NNN}              Architectural decision
   DEC-DB-001

PERM-{RESOURCE}-{ACTION}        Permission
   PERM-PRODUCT-CREATE

EVENT-{DOMAIN}-{NAME}           Doménová událost (build-spec ID)
   EVENT-ORDER-PLACED            (wire: order.placed)

JOB-{NAME}                      Background job
   JOB-INVENTORY-SYNC

CRON-{NAME}                     Cron / scheduled
   CRON-DAILY-LOW-STOCK-CHECK

TEST-{TYPE}-{DOMAIN}-{NNN}      Test scenario
   TEST-E2E-CHECKOUT-001
   TEST-UNIT-PRICING-001
   TEST-INT-WEBHOOK-001
   TEST-LOAD-CART-001
```

**Pravidla:**
- `NNN` je zero-padded 3-digit (`001`, `042`, `127`) — extend na 4 pokud jednou potřeba
- `DOMAIN` z fixed seznamu (Catalog, Inventory, Pricing, Cart, Checkout, Orders, Payments, Shipping, Tax, Customers, B2B, Marketing, SEO, Analytics, Admin, Plugins, Webhooks, Agents, Themes, …)
- Cross-reference v markdown: `[ENT-PRODUCT-001](03-data-models-master.md#ent-product-001)`

---

## 23. Email + notification kódy

Format: `{domain}.{event}` v `email_templates.code`:

```
order.placed_customer
order.placed_admin
order.paid
order.shipped
order.cancelled
order.refunded

customer.welcome
customer.password_reset
customer.email_verification
customer.account_locked

invoice.issued
invoice.payment_reminder
invoice.overdue

subscription.renewed
subscription.payment_failed
subscription.cancellation_confirmed

cart.abandoned_1h
cart.abandoned_24h
cart.abandoned_7d

product.back_in_stock          # customer notification

admin.low_stock_alert
admin.new_order
admin.payment_failed
admin.plugin_failed
admin.security_alert
```

**Konvence:**
- `lowercase.snake_case`
- Per locale variant joined na DB level (`email_templates.locale`), ne v code

In-app notification kinds (`notifications.kind`):

```
order.new                       # admin
order.payment_failed
order.refund_requested
inventory.low_stock
plugin.installation_failed
plugin.update_available
security.suspicious_login
```

---

## 24. Dokumenty a markdown

### 24.1 Soubory v `zadani/`

```
{NN}-{kebab-case-title}.md
```

`NN` je 2-digit (00-99). Specifikováno v `00-MASTER-INDEX §2`.

### 24.2 Markdown headings

```markdown
# Titul dokumentu                  (H1 — jen 1× v dokumentu, jako title)

## 1. Sekce                         (H2 — top-level sekce, číslované)

### 1.1 Podsekce                    (H3 — substante.subsection)

#### 1.1.1 Detail                   (H4 — drill-down detail)

##### vzácně použito                (H5+ vyhýbat se — refactor strukturu)
```

### 24.3 Cross-references

```markdown
- Doménový dokument: [03-data-models-master.md](03-data-models-master.md)
- Konkrétní ID: [ENT-PRODUCT-001](03-data-models-master.md#ent-product-001)
- Sekce: [§7.2 Filtering](04-api-conventions.md#72-filtering)
- DEC: [DEC-ARCH-005](01-decisions-registry.md#dec-arch-005-backend-framework)
- Glossary: [Headless commerce](02-glossary.md#headless-commerce)
```

### 24.4 Code blocks

```markdown
```typescript          ← jazyk vždy specifikuj
```sql
```jsonc               ← JSON with comments povolený pro examples
```bash
```text                ← pro pure text / ASCII diagrams
```

### 24.5 Status emoji v dokumentech

```
🔴 NOT_IMPLEMENTED
🟡 DESIGN
🟢 IMPLEMENTED
✅ DONE
⚠️ DEPRECATED
🔄 PROPOSED
❌ REJECTED
```

Žádné jiné emoji v kódu, dokumentace má strict povolený set.

---

## 25. Slovník zakázaných slov + reserved

### 25.1 Doménová synonyma — vyber JEDNO

Z [02-glossary.md](02-glossary.md):

| ✅ Preferuj | ❌ Nepoužívej | Důvod |
|---|---|---|
| `cart` | `basket`, `shopping_cart` (jako prefix) | Cart je krátké, mezinárodní |
| `product` | `item`, `article`, `sku` (sku je field, ne synonyma) | |
| `variant` | `sku`, `style`, `option_combination` | |
| `customer` | `user`, `buyer`, `client`, `shopper` | User = backoffice |
| `order` | `purchase`, `transaction`, `booking` | |
| `tenant` | `merchant`, `shop`, `store`, `organization`, `account` | Store = sub-entity tenanta |
| `merchant` | (jen v marketingovém kontextu) | Tech kód používá `tenant` |
| `discount` | `promo`, `promotion`, `deal`, `offer`, `markdown` | Promotion = builder rule, deal = vágní |
| `coupon` | `voucher`, `code`, `promo_code` | |
| `shipment` | `delivery`, `package`, `parcel` | |
| `inventory` | `stock` (acceptable v stock_levels/stock_movements pro DB legacy) | |
| `refund` | `reimbursement`, `return_money` | Return = RMA, ne refund |
| `return` (RMA) | `refund`, `exchange` | Refund = peníze zpět; return = fyzické vrácení zboží |
| `invoice` | `receipt`, `bill` | Receipt = POS doklad, bill = vágní |
| `tax` | `vat`, `duty` (jako synonyma) | VAT = field/pojem na fakturu; tax je strukturální pojem |
| `addressline1` / `street1` | `address_line_1`, `addr1` | Konzistentní s ISO postal |
| `metadata` | `attrs`, `props`, `extra`, `custom_fields` | |

### 25.2 Reserved jména v kódu

Neperedefinováváme JS/TS globals:

```
class Map, Set, Symbol, Object, Array, Promise, Date, Error
function fetch, eval, alert, confirm
```

Nepojmenovávat proměnné: `data`, `info`, `value`, `result`, `temp`, `obj`, `item` na top-level. V `forEach((item) => ...)` lokálně OK.

### 25.3 Reserved v DB

Postgres reserved keywords (vyhýbat se i kde Postgres povolí):

```
user, order, group, table, select, from, where, time, type, default, role, column, row, key, index
```

### 25.4 PII / sensitive — nikdy v název

Sloupce, log fields, eventy: **nedávej do názvu** PII hodnotu.

```
❌ log: "User john@example.com logged in"
✅ log: { msg: "user.login", user_id: "...", email_hash: "sha256:..." }

❌ DB sloupec: full_credit_card_number
✅ DB sloupec: card_last4, card_brand  (PCI scope minimalizovat — DEC-PAY-002)
```

---

## 26. Anti-patterns — co NIKDY

```
❌ camelCase v DB / SQL
❌ snake_case v GraphQL field name
❌ Smíchaný case v rámci jednoho identifikátoru (orderID, getURLfromAPI)
❌ Maďarská notace (strName, iCount, bIsActive)
❌ Generická slova bez kontextu (data, info, manager, handler, helper, utils, common, shared)
❌ Zkratky bez nutnosti (usr, prd, ctgry, qty, addr) — v identifikátorech ne, v ID prefixech ano (3-char konvence)
❌ Singulár u kolekcí (product table, ne products)
❌ Plurál u single resource handler (createProducts() když dělá jeden product)
❌ Negativní booleans (isNotActive, hasNoAccess) — flip logiku
❌ Magic strings/numbers — extract konstantou
❌ Stejné jméno pro type a value (class Order { ... } + const Order = ...)
❌ Pojmenování by implementační detail (RedisCache, KafkaQueue) — preferuj doménovou abstrakci (Cache, EventBus)
❌ Vendor v identifikátoru, když je swappable (StripePaymentService → PaymentService + Stripe provider)
❌ Past tense pro neudálost (createdOrder, updatedProduct jako proměnná) — Order, currentProduct
❌ Slovník "manager" / "controller" / "service" stacked (OrderManagerControllerHelper)
❌ "v2", "new", "old" v názvu (vede k legacy debt — refactor in place, deprecate clean)
```

---

## 27. Změny

| Datum | Změna |
|---|---|
| 2026-05-19 | Initial — kompletní naming pravidla pro kód, DB, API, eventy, Git, dokumenty. Sjednocuje TypeScript camelCase, DB snake_case, GraphQL camelCase (vědomá nekonzistence), URL kebab-case. ID prefix katalog pro všechny entity z 03. |

---

## ⚠️ Pravidla pro úpravy

```
1. Nová konvence = nová sekce + příklad ✅ vs ❌
2. Změna existující konvence = bump verze + migration plan (žádný silent rebrand kódu)
3. Konfliktní volba v doménovém dokumentu = master vyhrává, otevři issue
4. Nová ID prefixy do §11 přidat hned při schválení nové entity v 03
5. Vyber jednu konvenci a drž ji — žádná "obě jsou ok" pravidla
```

---

**Konec Naming Conventions.**

➡️ Foundation fáze hotová. Pokračovat na: doménové dokumenty [`06-catalog-pim.md`](06-catalog-pim.md) a dál.
