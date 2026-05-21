# 27 – ADMIN BACKOFFICE

> **Doména:** Admin SPA pro správu tenanta — products, orders, customers, marketing, content, settings. Vite + React 19 SPA per [DEC-FE-001](01-decisions-registry.md#dec-fe-001-frontend-framework) (NOT Next.js — admin is internal app, no SEO need). Tailwind + shadcn/ui per [DEC-FE-002](01-decisions-registry.md#dec-fe-002-styling-strategy). Zustand + TanStack Query per [DEC-FE-003](01-decisions-registry.md#dec-fe-003-state-management). Globální command palette, RBAC throughout, multi-tenant + multi-store switching, real-time updates via SSE.

**Datum:** 2026-05-20
**Verze:** 1.0
**Status:** 🟡 DESIGN
**Reference:** [DEC-FE-001](01-decisions-registry.md#dec-fe-001-frontend-framework) · [DEC-FE-002](01-decisions-registry.md#dec-fe-002-styling-strategy) · [DEC-FE-003](01-decisions-registry.md#dec-fe-003-state-management) · [36-personas-rbac.md](36-personas-rbac.md)

---

## 📑 Obsah

0. [Domain overview](#0-domain-overview)
1. [References](#1-references)
2. [Personas](#2-personas)
3. [App architecture](#3-app-architecture)
4. [Routing & navigation](#4-routing--navigation)
5. [Component library](#5-component-library)
6. [State management](#6-state-management)
7. [Authentication & session](#7-authentication--session)
8. [Business rules](#8-business-rules)
9. [REST API endpoints](#9-rest-api-endpoints)
10. [GraphQL schema](#10-graphql-schema)
11. [Events](#11-events)
12. [Background jobs](#12-background-jobs)
13. [UI/UX flows](#13-uiux-flows)
14. [Edge cases & error handling](#14-edge-cases--error-handling)
15. [Performance](#15-performance)
16. [Security & accessibility](#16-security--accessibility)
17. [Testing](#17-testing)
18. [Implementation checklist](#18-implementation-checklist)
19. [Open questions](#19-open-questions)

---

## 0. Domain overview

### 0.1 Co tato doména **je**

- **Vite + React 19 SPA** — `apps/admin/`, build to static HTML + JS, served from CDN at `admin.{tenant_domain}` or `app.shopio.com/t/{tenant_slug}`
- **No SSR** — internal app, no SEO; instant route transitions matter more than first paint
- **Talks to backend via tRPC + GraphQL + REST** (per `04-api-conventions.md`)
- **RBAC throughout** — every route, every action gated by permissions (per `36-personas-rbac.md`)
- **Multi-tenant aware** — single admin URL can serve multiple tenants (org switcher) for agencies/freelancers
- **Multi-store switching** — within tenant, switch active store (per `22-multistore-channels.md`)
- **Global command palette** (⌘K / Ctrl+K) — search anything: products, orders, customers, settings, actions
- **Keyboard-first** — every common action has shortcut
- **Real-time updates** via SSE (Server-Sent Events) — new orders, payouts, alerts
- **Notification center** — in-app inbox for system events
- **Audit log viewer** — who did what when (cross-ref `30-security.md`)
- **Dashboards** — sales today, low stock, pending orders, customers
- **Data tables** — paginated, sortable, filterable, with bulk actions, CSV export
- **Inline editing** — many fields editable in-place
- **Optimistic UI** — instant feedback; rollback on error
- **Onboarding wizard** — guided first-time tenant setup
- **Settings hierarchy** — tenant → store → channel level config
- **In-app help** — contextual help, tooltips, embedded docs
- **AI copilot panel** — slide-out chat with embedded Claude (per `33-ai-features.md`)
- **Theme system inheritance** — admin uses shadcn/ui tokens; respects user's OS preference (light/dark) + tenant brand color injection

### 0.2 Co tato doména **NENÍ**

- ❌ Storefront (→ `26-themes-storefront.md`)
- ❌ Mobile app (Fáze 4+ React Native; uses same backend API)
- ❌ Public marketing site for Shopio platform (separate Astro/Next.js app, not in scope of build spec)
- ❌ Theme customizer UI internals (→ `26` §5 lives within admin app but logically separate)
- ❌ Auth provider (→ `30-security.md`)
- ❌ Permission system definition (→ `36-personas-rbac.md`)
- ❌ Specific page implementations (each domain doc covers its own admin UX in §13 "UI/UX flows")
- ❌ Email content (→ `19-marketing-seo.md`)
- ❌ POS frontend (Fáze 3+ separate React app sharing admin component library)

### 0.3 Diferenciátory

1. **No bloated framework** — Vite + React 19, no Next.js for admin (per `DEC-FE-001`). Cold start < 200ms in dev; production bundle < 350 KB gzipped initial.
2. **Command palette as primary navigation** — anything reachable in 2 keystrokes
3. **Keyboard-first throughout** — power users don't touch mouse for 80% of work
4. **Optimistic mutations** — every state change instant; backend confirms async
5. **AI copilot bolted into UI** — sidebar with chat context-aware to current page
6. **Smart defaults** — onboarding wizard pre-populates 80% of settings based on industry + country
7. **Inline + page-level editing** — quick edits in tables; deep edits in dedicated pages
8. **Real-time everywhere** — list of orders updates live without refresh; user A sees user B's edits live

---

## 1. References

- [DEC-FE-001](01-decisions-registry.md#dec-fe-001-frontend-framework) — Vite + React 19 admin
- [DEC-FE-002](01-decisions-registry.md#dec-fe-002-styling-strategy) — Tailwind + shadcn/ui
- [DEC-FE-003](01-decisions-registry.md#dec-fe-003-state-management) — Zustand + TanStack Query
- [04-api-conventions.md](04-api-conventions.md) — REST/GraphQL/tRPC conventions
- [18-customer-management.md](18-customer-management.md) — user accounts (admin users = customers with PERSONA flag)
- [22-multistore-channels.md](22-multistore-channels.md) — multi-store switching
- [26-themes-storefront.md](26-themes-storefront.md) — theme customizer lives in admin
- [30-security.md](30-security.md) — auth, session, MFA
- [33-ai-features.md](33-ai-features.md) — AI copilot integration
- [36-personas-rbac.md](36-personas-rbac.md) — permissions
- React 19 docs (Actions, useOptimistic, useFormStatus)
- shadcn/ui patterns
- TanStack Query v5
- TanStack Router (chosen over React Router for type safety)
- Zustand v5
- cmdk (command palette)
- WCAG 2.2 AA admin UI compliance

---

## 2. Personas

| Persona | Použití | Klíčové permissions |
|---|---|---|
| `PERSONA-MERCHANT-OWNER` | Full admin access | `PERM-ADMIN-FULL` |
| `PERSONA-MERCHANT-ADMIN` | Most operations | `PERM-ADMIN-*` (granular) |
| `PERSONA-MERCHANT-STAFF` | Limited (orders, customers, content) | Domain-scoped permissions |
| `PERSONA-WAREHOUSE-STAFF` | Inventory + fulfillment | `PERM-INVENTORY-*`, `PERM-FULFILLMENT-*` |
| `PERSONA-CUSTOMER-SERVICE` | Customers + orders + returns | `PERM-ORDER-*`, `PERM-CUSTOMER-*`, `PERM-RETURN-*` |
| `PERSONA-MARKETING-MANAGER` | Marketing, promos, content, themes | `PERM-MARKETING-*`, `PERM-THEME-*` |
| `PERSONA-ACCOUNTANT` | Reports, invoices, exports | `PERM-FINANCE-VIEW`, `PERM-REPORT-*` |
| `PERSONA-DEVELOPER` (in-house) | API tokens, webhooks, plugins | `PERM-DEVELOPER-*` |
| `PERSONA-AGENCY` | Multi-tenant access | Per-tenant grants via [Agency Mode] |
| `PERSONA-PLATFORM-STAFF` | Cross-tenant support (with consent) | `PERM-PLATFORM-SUPPORT` |
| `PERSONA-AI-COPILOT` | Inline AI assistant via chat panel | `agent:*` scopes (read-mostly) |

---

## 3. App architecture

### 3.1 Stack

- **Build:** Vite 6+
- **Framework:** React 19 (Actions, Server Components are server-only; admin uses client components)
- **Routing:** TanStack Router (type-safe, code-split per route)
- **State (server):** TanStack Query v5
- **State (client):** Zustand v5
- **Styling:** Tailwind CSS 4 + shadcn/ui primitives
- **Forms:** React Hook Form + Zod
- **Tables:** TanStack Table v8
- **Command palette:** cmdk
- **Charts:** Recharts (light) + Tremor (dashboards)
- **Date:** date-fns (NOT moment, NOT Day.js)
- **Icons:** Lucide React
- **i18n:** vocab (lightweight) or i18next (per `23-i18n.md`)
- **API client:** generated from OpenAPI + GraphQL Codegen + tRPC client
- **Realtime:** EventSource (SSE) for server-push
- **Notifications:** sonner (toast) + custom notification center
- **Testing:** Vitest + Playwright + Storybook

### 3.2 Folder structure

```
apps/admin/
├── src/
│   ├── main.tsx                                                                                                                                          # entry, TanStack Router init
│   ├── App.tsx
│   ├── routes/                                                                                                                                            # file-based routing
│   │   ├── _layout.tsx                                                                                                                                    # shell with sidebar + topbar
│   │   ├── index.tsx                                                                                                                                       # dashboard
│   │   ├── login.tsx                                                                                                                                       # public
│   │   ├── onboarding/                                                                                                                                     # wizard
│   │   ├── catalog/
│   │   │   ├── products/
│   │   │   │   ├── index.tsx
│   │   │   │   ├── new.tsx
│   │   │   │   └── $productId.tsx
│   │   │   ├── categories.tsx
│   │   │   ├── brands.tsx
│   │   │   └── ...
│   │   ├── orders/
│   │   ├── customers/
│   │   ├── marketing/
│   │   ├── content/
│   │   ├── analytics/
│   │   ├── settings/
│   │   └── developer/
│   ├── components/                                                                                                                                          # shared UI
│   │   ├── ui/                                                                                                                                              # shadcn primitives
│   │   ├── data-table/
│   │   ├── command-palette/
│   │   ├── notification-center/
│   │   ├── ai-copilot/
│   │   └── ...
│   ├── features/                                                                                                                                            # domain modules
│   │   ├── products/
│   │   │   ├── api.ts                                                                                                                                       # TanStack Query hooks
│   │   │   ├── components/
│   │   │   │   ├── ProductForm.tsx
│   │   │   │   ├── ProductTable.tsx
│   │   │   │   └── ProductMediaGallery.tsx
│   │   │   ├── schemas.ts                                                                                                                                    # Zod
│   │   │   └── store.ts                                                                                                                                      # Zustand slice
│   │   ├── orders/
│   │   └── ...
│   ├── hooks/                                                                                                                                                 # shared hooks (useDebounce, useMediaQuery, ...)
│   ├── lib/
│   │   ├── api-client.ts                                                                                                                                      # tRPC + GraphQL clients
│   │   ├── auth.ts
│   │   ├── permissions.ts                                                                                                                                     # can() helper
│   │   ├── realtime.ts                                                                                                                                        # SSE client
│   │   └── formatters.ts                                                                                                                                      # currency, date, etc.
│   ├── stores/                                                                                                                                                # Zustand global stores
│   │   ├── auth-store.ts
│   │   ├── tenant-store.ts                                                                                                                                    # current tenant + store
│   │   ├── ui-store.ts                                                                                                                                        # modals, sidebar collapsed
│   │   └── notification-store.ts
│   ├── styles/
│   │   └── globals.css                                                                                                                                        # Tailwind + theme tokens
│   └── types/
├── public/
├── index.html
├── vite.config.ts
└── tsconfig.json
```

### 3.3 Bundle splitting

- **Vendor bundle** — React, TanStack Router/Query, Zustand
- **Per-route chunks** — each top-level route lazy-loaded
- **Per-feature chunks** — heavy features (PDF viewer, chart libs) deferred
- **Initial bundle target** — < 200 KB gzipped (JS), < 50 KB CSS

### 3.4 Layout shell

```
┌─────────────────────────────────────────────────────────────────────────┐
│ TopBar: [Logo] [Store switcher] [Search ⌘K] [Notifications] [User menu] │
├──────────┬──────────────────────────────────────────────────────────────┤
│ Sidebar: │ Page content                                                  │
│ Dashboard│                                                                │
│ Catalog  │                                                                │
│  - Prods │                                                                │
│  - Cats  │                                                                │
│  - Brands│                                                                │
│ Orders   │                                                                │
│ Customers│                                                                │
│ ...      │                                                                │
│          │                                                                │
│ [AI▶]    │                                                                │ (collapsible AI copilot panel)
└──────────┴──────────────────────────────────────────────────────────────┘
```

Sidebar:
- Collapsible (icon-only mode)
- Items dynamically filtered by user's permissions (don't show what user can't access)
- Keyboard navigable
- Pinned shortcuts (user-customizable)

---

## 4. Routing & navigation

### 4.1 Route hierarchy

```
/                                                                                                                                                                # dashboard
/login
/logout
/onboarding/*                                                                                                                                                     # first-time setup

/catalog
  /products                                                                                                                                                       # list with filters
  /products/new
  /products/{id}                                                                                                                                                    # detail with tabs (general, variants, media, SEO, advanced)
  /categories                                                                                                                                                       # tree editor
  /collections
  /brands
  /vendors
  /attributes
  /option-templates
  /import-export                                                                                                                                                    # bulk

/orders
  /orders                                                                                                                                                            # list
  /orders/{id}                                                                                                                                                       # detail with tabs (timeline, items, fulfillments, refunds, notes)
  /drafts                                                                                                                                                             # draft orders
  /abandoned-carts
  /returns
  /returns/{id}

/customers
  /customers
  /customers/{id}
  /segments
  /companies                                                                                                                                                          # B2B
  /companies/{id}
  /reviews

/marketing
  /campaigns
  /campaigns/{id}
  /flows                                                                                                                                                               # automation
  /promotions
  /coupons
  /gift-cards
  /seo
  /reviews

/content
  /pages
  /blog
  /navigation                                                                                                                                                          # menus
  /media-library
  /forms                                                                                                                                                                # custom forms
  /redirects

/analytics
  /overview
  /sales
  /customers
  /products
  /traffic
  /custom-reports

/inventory
  /stock
  /warehouses
  /stock-transfers
  /stock-adjustments
  /low-stock-alerts

/finance
  /invoices
  /refunds
  /payouts                                                                                                                                                                # marketplace
  /tax-reports
  /accounting-exports

/themes
  /themes
  /themes/{id}/customize                                                                                                                                                  # visual customizer
  /themes/marketplace
  /pages-builder                                                                                                                                                          # CMS

/integrations
  /apps
  /channels                                                                                                                                                                # POS, marketplaces, social
  /shipping-carriers
  /payment-providers
  /accounting
  /marketing-platforms

/developer
  /api-tokens
  /webhooks
  /event-log
  /plugins
  /functions                                                                                                                                                                # edge functions
  /api-docs

/settings
  /general                                                                                                                                                                  # tenant info
  /stores
  /locales
  /currencies
  /taxes
  /shipping
  /payments
  /checkout
  /notifications
  /policies                                                                                                                                                                  # terms, privacy
  /team                                                                                                                                                                      # users + roles
  /billing                                                                                                                                                                    # Shopio subscription
  /domains
  /custom-fields                                                                                                                                                              # metafield definitions
  /audit-log
  /data-export                                                                                                                                                                # GDPR
```

### 4.2 Route guarding

```tsx
// routes/catalog/products/$productId.tsx
import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '~/lib/permissions';

export const Route = createFileRoute('/catalog/products/$productId')({
  beforeLoad: ({ context }) => {
    requirePermission(context.auth, 'PERM-PRODUCT-VIEW');
  },
  loader: ({ params, context }) => {
    return context.queryClient.ensureQueryData(productQueryOptions(params.productId));
  },
  component: ProductDetailPage,
});
```

### 4.3 Breadcrumbs

Each route declares breadcrumb segment. Auto-rendered in topbar:
```
Catalog → Products → Black T-Shirt
```

### 4.4 Navigation features

- **Back/forward** — browser history works
- **Deep linking** — every state in URL where possible (tab, filter, sort)
- **Filter persistence** — table filter state in URL search params
- **Tab persistence** — last active tab per product/order saved in localStorage
- **Pinned navigation** — user can pin frequently used routes to sidebar
- **Recent items** — last 10 visited products/orders/customers in quick-access menu

---

## 5. Component library

### 5.1 Design system

shadcn/ui base + custom Shopio components. Component categories:

| Category | Components |
|---|---|
| **Primitives** | Button, Input, Textarea, Select, Checkbox, Radio, Switch, Slider, Dialog, Sheet (drawer), Popover, Tooltip, DropdownMenu, ContextMenu, Tabs, Accordion, Toast, Skeleton, Spinner |
| **Forms** | Form (RHF wrapper), FormField, FormError, FormHint, FileUpload, MediaPicker, ColorPicker, DateRangePicker, RichTextEditor, MarkdownEditor, JsonEditor |
| **Data display** | DataTable, Card, Stat, Badge, Tag, Avatar, Timeline, EmptyState, ErrorBoundary, Status (with semantic colors) |
| **Layout** | PageHeader, PageContent, Sidebar, SidebarItem, TopBar, Breadcrumb, SplitLayout, EmptyView |
| **Navigation** | CommandPalette, SearchBox, Pagination, StepIndicator, BackButton |
| **Feedback** | Banner (warning/info/error), ProgressBar, ConfirmationDialog, BulkActionBar |
| **Specialized** | ProductCard, OrderTimeline, CustomerCard, AddressBlock, MoneyDisplay, PercentDisplay |

### 5.2 DataTable (the most reused complex component)

Features:
- Server-side pagination, sort, filter
- Column visibility toggle
- Column resizing
- Row selection (single, multi, all)
- Bulk actions toolbar (visible when selection > 0)
- Inline cell editing (some columns)
- Column-level filters (text, range, select, date)
- Saved views (named filter+sort+visibility presets)
- CSV/Excel export
- Sticky header on scroll
- Empty state with action CTA
- Loading skeleton on first load
- Optimistic mutations integrate (row updates show pending state)

```tsx
<DataTable
  queryKey={['products', filters]}
  queryFn={() => api.products.list(filters)}
  columns={productColumns}
  filters={productFilterSchema}
  bulkActions={[
    { label: 'Publish', icon: <Eye />, action: handleBulkPublish },
    { label: 'Archive', icon: <Archive />, action: handleBulkArchive, requires: 'PERM-PRODUCT-DELETE' },
  ]}
  rowActions={(row) => [
    { label: 'Edit', onClick: () => navigate(`/catalog/products/${row.id}`) },
    { label: 'Duplicate', onClick: () => duplicate(row.id) },
    { label: 'Delete', destructive: true, onClick: () => deleteOne(row.id) },
  ]}
  emptyState={{ title: 'No products yet', cta: 'Create your first product' }}
/>
```

### 5.3 Form pattern

Every form:
- React Hook Form + Zod resolver
- Auto-save draft to localStorage every 5s (with discard option)
- Dirty state detection → unsaved changes warning on navigate away
- Submit via Server Actions (React 19) where possible
- Optimistic updates via TanStack Query mutations
- Error toast on failure with retry
- Success toast + smart redirect

```tsx
const schema = z.object({
  title: z.string().min(1).max(255),
  price: z.number().positive(),
  description: z.string().optional(),
});

function ProductForm({ initial }: { initial?: Product }) {
  const form = useForm({ resolver: zodResolver(schema), defaultValues: initial });
  const mutation = useUpdateProduct();
  const onSubmit = form.handleSubmit((data) => mutation.mutate(data));

  return (
    <Form {...form}>
      <form onSubmit={onSubmit}>
        <FormField name="title" label="Title" />
        <FormField name="price" type="number" label="Price" />
        <FormField name="description" type="textarea" label="Description" />
        <Button type="submit" loading={mutation.isPending}>Save</Button>
      </form>
    </Form>
  );
}
```

### 5.4 Modal vs Drawer vs Page

- **Modal** — single decision (delete confirm, simple form < 5 fields)
- **Drawer (Sheet)** — secondary task without losing context (quick edit, view details, add note)
- **Page** — primary task (create/edit product, configure complex setting)
- **Inline** — small edits (rename, single field)

### 5.5 Empty states

Every list page has thoughtful empty state:
- Hero illustration
- Title: "No products yet" / "No orders for this period"
- Description: explanation
- Primary CTA: "Create product" / "Connect sales channel"
- Secondary link: "Learn more" → docs

---

## 6. State management

### 6.1 Server state (TanStack Query)

All data fetched via TanStack Query:
- `useQuery` for reads
- `useMutation` for writes
- `useInfiniteQuery` for paginated lists where appropriate
- Optimistic updates via `onMutate`
- Cache invalidation via `queryClient.invalidateQueries`
- Stale time: 30s default
- Refetch on window focus: enabled

```tsx
function useProducts(filters: ProductFilters) {
  return useQuery({
    queryKey: ['products', filters],
    queryFn: () => api.products.list(filters),
    staleTime: 30_000,
  });
}

function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.products.update,
    onMutate: async (newProduct) => {
      await queryClient.cancelQueries({ queryKey: ['products'] });
      const previous = queryClient.getQueryData(['products']);
      queryClient.setQueryData(['products'], (old: any) =>
        old.map((p: any) => p.id === newProduct.id ? newProduct : p)
      );
      return { previous };
    },
    onError: (_, __, context) => {
      queryClient.setQueryData(['products'], context?.previous);
      toast.error('Update failed');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}
```

### 6.2 Client state (Zustand)

Global UI state in Zustand stores:
- `auth-store`: current user, session, MFA state
- `tenant-store`: current tenant, current store, role
- `ui-store`: sidebar collapsed, theme (light/dark), AI copilot open
- `notification-store`: in-app notification list

Each store thin (no business logic; that's in TanStack Query mutations).

```tsx
// stores/tenant-store.ts
export const useTenantStore = create<TenantState>((set) => ({
  currentTenantId: null,
  currentStoreId: null,
  setTenant: (id) => set({ currentTenantId: id }),
  setStore: (id) => set({ currentStoreId: id }),
}));
```

### 6.3 URL state (TanStack Router)

Filters, sorts, pagination, active tabs → URL search params. Allows:
- Shareable URLs
- Browser back/forward
- Bookmarkable views

```tsx
const { sortBy, sortOrder, page, search } = Route.useSearch();
```

### 6.4 Form state (React Hook Form)

Per-form, ephemeral until save.

### 6.5 Persistence

- **Filters per table** — saved in URL (current view) + optional named "saved views" stored backend
- **Sidebar collapsed** — localStorage
- **Theme** — localStorage + sync with backend preference
- **Recent items** — localStorage + sync with backend
- **Last visited route** — localStorage (auto-redirect after login)

---

## 7. Authentication & session

### 7.1 Login flow

```
[/login]
  → email + password OR passkey OR SSO (depending on tenant config per `30-security.md`)
  → MFA challenge if enabled
  → 302 to last visited route OR /
```

Session:
- HTTP-only cookies for refresh token
- Short-lived access token (15 min) in memory
- Auto-refresh via silent endpoint
- Detect concurrent session in different tab → reload

### 7.2 Tenant + store selection

After login:
- If user has access to 1 tenant: auto-select
- If multi-tenant (agency): show tenant picker
- After tenant: if multiple stores: show store picker (or remember last)

### 7.3 Session detection

- Background SSE channel `session.invalidated` → logout
- Background SSE channel `permission.updated` → reload permissions
- Idle timeout (60 min default; configurable per tenant) → re-authenticate

### 7.4 Permission-based UI rendering

Every action gated:
```tsx
const { can } = usePermissions();

return (
  <>
    {can('PERM-PRODUCT-CREATE') && (
      <Button onClick={() => navigate('/catalog/products/new')}>New Product</Button>
    )}
  </>
);
```

Sidebar items filtered by permissions. Routes guard via `beforeLoad`. Backend always re-validates (don't trust UI).

---

## 8. Business rules

### RULE-ADM-001: SPA — no SSR for admin

Per `DEC-FE-001`. Admin is post-login, no SEO need. Vite-built static assets served from CDN. Initial render shows skeleton; data fetched client-side. Fast time-to-interactive trumps first contentful paint.

### RULE-ADM-002: Permission-gated routes

Every route declares required permission via `beforeLoad`. If lacking: 403 page with "Request access" CTA (notifies admin).

### RULE-ADM-003: Permission-gated UI elements

Buttons / menu items not rendered (not just disabled) when user lacks permission. Reduces UI clutter + makes permission errors impossible to trigger from UI.

### RULE-ADM-004: Don't trust UI

Backend re-validates every request. UI hiding a button doesn't prevent API call from being forged. Server is source of truth.

### RULE-ADM-005: Optimistic mutations with rollback

State changes apply locally before server confirms. On error: rollback + error toast. On success: confirm + success toast.

### RULE-ADM-006: Dirty state warning

Unsaved changes on form → confirmation dialog on navigation away. Override: "Discard changes" button explicit.

### RULE-ADM-007: Auto-save drafts

Long forms (product editor, page editor) auto-save to localStorage every 5s. On reload: prompt "Restore unsaved draft?" if exists.

### RULE-ADM-008: Real-time updates via SSE

Single SSE connection per user session. Server pushes:
- Order placed (notify ops)
- Inventory low (notify warehouse)
- Refund processed (notify accounting)
- AI suggestion ready
- Session events (logout, permission change)

UI: relevant lists auto-refresh; toasts for important events.

### RULE-ADM-009: Multi-store switcher

Top-right dropdown shows current store + list of all stores user has access to. Switch:
- Updates `tenant-store.currentStoreId`
- Invalidates queries (store-scoped data refetched)
- URL doesn't change (store_id implicit in query context)

### RULE-ADM-010: Multi-tenant switcher (agency mode)

For users with access to multiple tenants:
- Topbar shows tenant logo + name
- Click → list of accessible tenants
- Switch tenant → full app reload (different DB context per tenant per `DEC-DB-001` RLS)

### RULE-ADM-011: Command palette ⌘K

Always available. Searches:
- Routes ("go to products")
- Recent items (last 50 viewed)
- Specific entities by ID/name (products, orders, customers, settings)
- Actions ("create product", "export orders")
- Help articles
- AI ("ask AI: how do I...")

Keyboard nav (↑↓ Enter Esc). Results ranked by relevance + recency.

### RULE-ADM-012: Keyboard shortcuts catalog

Standard shortcuts:
- `⌘K` — command palette
- `⌘/` — show keyboard shortcuts help
- `⌘.` — toggle AI copilot panel
- `⌘B` — toggle sidebar
- `gd` — go to dashboard
- `gp` — go to products
- `go` — go to orders
- `gc` — go to customers
- `?` — context help for current page
- `n` — new (context: new product on products page, new order on orders page)
- `e` — edit (when entity selected)
- `j`/`k` — next/prev (in lists)
- `Esc` — close modal/drawer/cancel

User can customize via Settings → Keyboard shortcuts.

### RULE-ADM-013: Notification center

Top-right bell icon → dropdown with recent notifications. Categories:
- System (announcements from platform)
- Orders (new, urgent, refund requests)
- Inventory (low stock, out of stock)
- Customer (new review, complaint)
- AI (suggestions ready)
- Tasks (mentioned in note, assigned)

Each notification: title, time, link to entity. Mark read/unread. Bulk mark all read. Sound/desktop notification configurable.

### RULE-ADM-014: Audit log viewer

`/settings/audit-log` shows table of all actions:
- Who (user)
- What (action + entity)
- When (timestamp)
- IP, user agent
- Before/after diff (where applicable)

Searchable + exportable. Per `30-security.md`.

### RULE-ADM-015: Locale + currency display

Admin UI itself localized per `23-i18n.md` (default English; Czech + German for MVP). Money values rendered with `Intl.NumberFormat`. Dates with `Intl.DateTimeFormat`. Timezone respects user setting (default: tenant timezone).

### RULE-ADM-016: Theming — light + dark

Admin respects user's OS preference. Manual override in user menu. Tenant brand color injected as accent (does NOT override entire palette; only accent + button highlights).

### RULE-ADM-017: Accessibility WCAG 2.2 AA

Same standards as storefront:
- Keyboard navigable everything
- Screen reader friendly
- 4.5:1 color contrast
- Focus visible
- Respects `prefers-reduced-motion`

### RULE-ADM-018: Inline editing

Tables where appropriate support double-click cell to edit. Saves on blur or Enter. Esc cancels. Loading state per cell. Errors shown inline.

Supported on: product price/stock, customer email/tags, order notes/tags.

### RULE-ADM-019: Bulk actions

When table has selected rows: floating action bar appears. Actions depend on context. Confirmations for destructive ops (delete, archive). Progress bar for long-running bulk (e.g., update 1000 products) with cancel.

### RULE-ADM-020: Saved views

Tables remember last filter+sort. Users can save named views ("My low-stock products", "This month's orders"). Shared with team optional. Stored backend per user.

### RULE-ADM-021: Onboarding wizard

First-time tenant: guided 8-step wizard:
1. Tenant info (name, country, industry)
2. Currency + tax setup
3. Shipping zones (based on country)
4. Payment provider connect
5. Branding (logo, colors)
6. First product (skip ok)
7. Domain (custom or use default)
8. Invite team members

Skippable; resume later. Progress in localStorage + backend.

### RULE-ADM-022: Help system

Every page has `?` shortcut → context help drawer with:
- Quick tips
- Related docs links
- Video tutorials embedded
- "Ask AI" CTA

Help content per page in CMS-like config (per `32-cms-content.md` internal docs).

### RULE-ADM-023: AI copilot panel

Slide-out right panel (toggle `⌘.`). Chat with Claude with:
- Context: current page, current entity (e.g., product being edited)
- Capabilities: explain feature, suggest fields, draft content, run analytics queries (read-only)
- Tools: search docs, search entities, suggest action (user approves before execute)

Per `33-ai-features.md`.

### RULE-ADM-024: Error boundaries

Per-route error boundary catches crashes. Shows friendly error with:
- "Something went wrong" message
- Error reference ID (for support)
- "Reload page" + "Go home" buttons
- Sentry-captured stack trace (backend)

### RULE-ADM-025: Offline-aware

If network drops:
- Banner: "You're offline. Changes will sync when reconnected."
- Mutations queued in IndexedDB (Fáze 2+; MVP: just reject)
- TanStack Query handles offline gracefully (last cached data shown)

### RULE-ADM-026: CSP + cross-origin

Admin SPA strict CSP:
- `default-src 'self'`
- `connect-src 'self' api.{tenant}.shopio.com`
- No inline scripts (except CSP-allowed nonces)
- `frame-ancestors 'none'`

### RULE-ADM-027: Session timeout

Inactivity > 60 min (default) → prompt "Still here?" If no response in 5 min → logout. Configurable per tenant.

### RULE-ADM-028: Multi-tab session

Multiple tabs share session via BroadcastChannel. Logout in one tab → logout all. Permission change → reload all.

### RULE-ADM-029: Performance budget

Admin app meets:
- LCP < 1.5s (post-login on dashboard)
- INP < 100ms
- TTI < 2.5s
- Initial bundle < 200 KB gzipped
- Per-route chunk < 100 KB gzipped

CI fails if exceeded.

### RULE-ADM-030: Browser support

Last 2 versions of: Chrome, Firefox, Safari, Edge. No IE. Mobile Safari 17+, Chrome Android 124+.

---

## 9. REST API endpoints

Admin app calls backend APIs that exist in other domain docs. This doc defines admin-specific endpoints:

### 9.1 User session + preferences

```
GET    /api/{date}/me                                                                                                                                                            # current user
PATCH  /api/{date}/me                                                                                                                                                             # update preferences
GET    /api/{date}/me/permissions                                                                                                                                                 # effective permissions
GET    /api/{date}/me/sessions                                                                                                                                                     # active sessions
DELETE /api/{date}/me/sessions/{id}                                                                                                                                                 # logout specific
POST   /api/{date}/me/sessions:logout-all
GET    /api/{date}/me/recent-items
POST   /api/{date}/me/recent-items                                                                                                                                                  # add to recent
GET    /api/{date}/me/saved-views
POST   /api/{date}/me/saved-views
DELETE /api/{date}/me/saved-views/{id}
GET    /api/{date}/me/pinned-routes
POST   /api/{date}/me/pinned-routes
DELETE /api/{date}/me/pinned-routes/{id}
GET    /api/{date}/me/keyboard-shortcuts
PATCH  /api/{date}/me/keyboard-shortcuts                                                                                                                                              # customizations
```

### 9.2 Notifications

```
GET    /api/{date}/notifications                                                                                                                                                       # list (paginated)
GET    /api/{date}/notifications/unread-count
POST   /api/{date}/notifications/{id}:mark-read
POST   /api/{date}/notifications:mark-all-read
DELETE /api/{date}/notifications/{id}
GET    /api/{date}/notifications/preferences                                                                                                                                            # per-category
PATCH  /api/{date}/notifications/preferences
```

### 9.3 Command palette

```
POST   /api/{date}/admin/command-palette/search                                                                                                                                          # body: { query, scope, limit }
                                                                                                                                                                                          # response: { results: [{ kind, label, url, icon, metadata }, ...] }
```

### 9.4 Onboarding

```
GET    /api/{date}/onboarding/status                                                                                                                                                       # current step, progress
POST   /api/{date}/onboarding/step:complete                                                                                                                                                 # body: { step, data }
POST   /api/{date}/onboarding:skip
POST   /api/{date}/onboarding:resume
```

### 9.5 SSE real-time channel

```
GET    /api/{date}/admin/events?since={cursor}                                                                                                                                              # SSE long-lived connection
                                                                                                                                                                                            # events: order.placed, inventory.low_stock, system.notification, session.permission_updated, ...
```

### 9.6 Help system

```
GET    /api/{date}/admin/help-articles?context={page_id}
GET    /api/{date}/admin/help-articles/{slug}
POST   /api/{date}/admin/help-feedback                                                                                                                                                       # was this helpful?
```

### 9.7 Example: Command palette search

```http
POST /api/2026-05-20/admin/command-palette/search HTTP/1.1
Authorization: Bearer ...

{
  "query": "black t-sh",
  "limit": 10
}
```

```jsonc
HTTP/1.1 200 OK

{
  "data": {
    "results": [
      { "kind": "product", "label": "Black T-Shirt", "url": "/catalog/products/prd_aB", "icon": "package", "metadata": { "sku": "BLT-001", "stock": 42 }},
      { "kind": "product", "label": "Black T-Shirt v2", "url": "/catalog/products/prd_xY", "icon": "package" },
      { "kind": "action", "label": "Create product 'black t-sh'", "url": "/catalog/products/new?title=black+t-sh", "icon": "plus" },
      { "kind": "ai", "label": "Ask AI about: black t-sh", "url": "ai:black+t-sh", "icon": "sparkles" }
    ],
    "total_estimated": 4
  }
}
```

### 9.8 Example: SSE stream

```http
GET /api/2026-05-20/admin/events HTTP/1.1
Accept: text/event-stream
Authorization: Bearer ...
```

```
event: order.placed
data: {"order_id":"ord_aB","number":"ORD-2026-12345","total":{"amount":12500,"currency":"CZK"},"timestamp":"2026-05-20T15:30:00Z"}

event: inventory.low_stock
data: {"product_id":"prd_xY","sku":"SKU-001","current_stock":3,"threshold":5}

event: system.notification
data: {"notification_id":"ntf_aB","kind":"feature_announcement","title":"New: AI-powered SEO"}

: keepalive
```

---

## 10. GraphQL schema

```graphql
type Me {
  user: User!
  tenant: Tenant!
  currentStore: Store
  permissions: [String!]!
  preferences: UserPreferences!
  recentItems: [RecentItem!]!
  pinnedRoutes: [PinnedRoute!]!
  notifications(filter: NotificationFilter): NotificationConnection!
  notificationUnreadCount: Int!
  sessions: [Session!]!
}

type UserPreferences {
  language: String!
  timezone: String!
  themeKind: ThemeKind!                                                                                                                                                                       # LIGHT, DARK, AUTO
  notificationCategories: JSON!
  keyboardShortcuts: JSON                                                                                                                                                                       # overrides
  defaultDashboard: String
  emailNotificationsEnabled: Boolean!
}

enum ThemeKind { LIGHT DARK AUTO }

type RecentItem {
  id: ID!
  kind: RecentItemKind!                                                                                                                                                                          # PRODUCT, ORDER, CUSTOMER, ...
  entityId: String!
  label: String!
  url: String!
  visitedAt: DateTime!
}

enum RecentItemKind { PRODUCT ORDER CUSTOMER COMPANY CATEGORY COLLECTION PAGE CAMPAIGN }

type PinnedRoute {
  id: ID!
  routePath: String!
  label: String!
  iconName: String
  position: Int!
}

type SavedView {
  id: ID!
  userId: ID!
  routePath: String!
  name: String!
  filterState: JSON!
  isShared: Boolean!
  createdAt: DateTime!
}

type AdminNotification implements Node {
  id: ID!
  category: NotificationCategory!
  title: String!
  body: String
  linkUrl: String
  iconName: String
  isRead: Boolean!
  occurredAt: DateTime!
}

enum NotificationCategory { SYSTEM ORDER INVENTORY CUSTOMER MARKETING AI TASK PAYMENT SECURITY }

type CommandPaletteResult {
  kind: CommandResultKind!
  label: String!
  description: String
  url: String!
  iconName: String
  metadata: JSON
  relevanceScore: Float
}

enum CommandResultKind { ROUTE PRODUCT ORDER CUSTOMER COMPANY SETTING ACTION RECENT HELP_ARTICLE AI }

type OnboardingProgress {
  currentStep: String!
  completedSteps: [String!]!
  totalSteps: Int!
  percentComplete: Float!
  canSkip: Boolean!
  startedAt: DateTime!
}

extend type Query {
  me: Me!
  notification(id: ID!): AdminNotification
  myNotifications(filter: NotificationFilter): NotificationConnection!
  mySavedViews(routePath: String): [SavedView!]!
  myRecentItems(kind: RecentItemKind, limit: Int = 20): [RecentItem!]!
  commandPaletteSearch(query: String!, limit: Int = 10): [CommandPaletteResult!]!
  onboardingProgress: OnboardingProgress!
  helpArticles(contextPageId: String): [HelpArticle!]!
}

extend type Mutation {
  updateMyPreferences(input: UserPreferencesInput!): UserPreferences!
  markNotificationRead(id: ID!): AdminNotification!
  markAllNotificationsRead: MutationPayload!
  pinRoute(input: PinRouteInput!): PinnedRoute!
  unpinRoute(id: ID!): DeletePayload!
  saveCurrentView(input: SaveViewInput!): SavedView!
  deleteSavedView(id: ID!): DeletePayload!
  trackRecentItem(input: RecentItemInput!): RecentItem!
  completeOnboardingStep(step: String!, data: JSON): OnboardingProgress!
  skipOnboarding: OnboardingProgress!
}

extend type Subscription {
  adminEvents(channels: [AdminEventChannel!]): AdminEvent!
}

union AdminEvent =
    OrderPlacedEvent
  | InventoryLowStockEvent
  | NotificationCreatedEvent
  | SessionInvalidatedEvent
  | PermissionUpdatedEvent
  | AiSuggestionReadyEvent

enum AdminEventChannel { ORDERS INVENTORY NOTIFICATIONS SESSION AI }
```

---

## 11. Events

| Build-spec ID | Wire | Payload |
|---|---|---|
| `EVENT-ADMIN-SESSION-STARTED` | `admin.session_started` | `{ user, tenant, ip }` |
| `EVENT-ADMIN-SESSION-INVALIDATED` | `admin.session_invalidated` | `{ user, reason }` |
| `EVENT-ADMIN-USER-LOGIN` | `admin.user_login` | `{ user }` |
| `EVENT-ADMIN-USER-LOGOUT` | `admin.user_logout` | `{ user, session_duration_seconds }` |
| `EVENT-ADMIN-ONBOARDING-STARTED` | `admin.onboarding_started` | `{ tenant }` |
| `EVENT-ADMIN-ONBOARDING-COMPLETED` | `admin.onboarding_completed` | `{ tenant, duration_minutes }` |
| `EVENT-ADMIN-ONBOARDING-SKIPPED` | `admin.onboarding_skipped` | `{ tenant, step }` |
| `EVENT-ADMIN-PREFERENCE-CHANGED` | `admin.preference_changed` | `{ user, key, value }` |
| `EVENT-ADMIN-NOTIFICATION-CREATED` | `admin.notification_created` | `{ notification }` |
| `EVENT-ADMIN-COMMAND-PALETTE-USED` | `admin.command_palette_used` | `{ query, result_kind }` (analytics) |
| `EVENT-ADMIN-BULK-ACTION-EXECUTED` | `admin.bulk_action_executed` | `{ action, count, duration_ms }` |
| `EVENT-ADMIN-INLINE-EDIT-MADE` | `admin.inline_edit` | `{ entity, field }` |
| `EVENT-ADMIN-HELP-VIEWED` | `admin.help_article_viewed` | `{ article_slug, context_page }` |
| `EVENT-ADMIN-AI-PANEL-OPENED` | `admin.ai_panel_opened` | `{ context_page }` |
| `EVENT-ADMIN-ERROR-BOUNDARY-CAUGHT` | `admin.error_boundary` | `{ route, error_message }` |

**Konzumenti:**
- Analytics (per `20-analytics-reporting.md`) — usage patterns
- Sentry — error reporting
- Onboarding emails (per `19-marketing-seo.md`) — abandoned onboarding follow-ups

---

## 12. Background jobs

| Job | Trigger | Queue | Frequency |
|---|---|---|---|
| `JOB-CLEANUP-EXPIRED-SESSIONS` | scheduled | `maintenance` | Hourly |
| `JOB-AGGREGATE-COMMAND-PALETTE-ANALYTICS` | scheduled | `analytics` | Daily |
| `JOB-SEND-ONBOARDING-REMINDER-EMAIL` | scheduled (24h after start if not complete) | `notifications` | Hourly |
| `JOB-DELIVER-IN-APP-NOTIFICATIONS` | EVENT-ORDER-PLACED + many others | `notifications` | Continuous |
| `JOB-CLEANUP-OLD-NOTIFICATIONS` | scheduled | `maintenance` | Daily (notifications > 90d archived) |
| `JOB-COMPUTE-RECENT-ITEMS-FROM-EVENT-LOG` | scheduled (backup) | `maintenance` | Daily |
| `JOB-WARM-DASHBOARD-CACHE-PER-USER` | scheduled | `cache-warm` | Hourly per active user |
| `JOB-DETECT-ADMIN-SUSPICIOUS-ACTIVITY` | EVENT-ADMIN-SESSION-STARTED | `security` | On-demand |
| `JOB-EXPORT-AUDIT-LOG-TO-COLD-STORAGE` | scheduled | `archival` | Monthly |

---

## 13. UI/UX flows

### FLOW-ADM-001: First-time login + onboarding

```
[Login at app.shopio.com/login]
   - Email + password OR passkey OR SSO
   - MFA challenge (if enabled)
        ↓
[Tenant created automatically OR existing]
        ↓
[Onboarding wizard /onboarding]
   - Step 1/8: Welcome + tenant info
   - Step 2/8: Currency + tax setup (defaults from country)
   - Step 3/8: Shipping zones
   - Step 4/8: Connect payment provider (Stripe quick connect)
   - Step 5/8: Branding (upload logo, pick brand colors)
   - Step 6/8: First product (or skip)
   - Step 7/8: Choose domain (use shopio.app subdomain OR custom)
   - Step 8/8: Invite team
   - Progress saved each step
   - Skippable at any point → resume later
        ↓
[Dashboard]
   - Empty state: "No orders yet. Share your storefront link to get started."
   - Quick actions: View storefront, Create product, Set up shipping, Invite team
```

### FLOW-ADM-002: Daily workflow — sales overview

```
[Login → Dashboard]
   - Top KPI cards: Revenue today / orders today / new customers / conversion
   - Sales chart: last 30 days
   - Recent orders table (last 10)
   - Low stock alerts
   - Pending actions (refund requests, returns, reviews to moderate)
   - Smart inserts: "Your conversion dropped 12% this week — check checkout funnel"
        ↓
   user notices low stock alert
        ↓
[Click → /inventory/low-stock-alerts]
   - Filtered table of products under reorder threshold
   - Bulk select → "Reorder" action
        ↓
[Reorder modal]
   - Suggested quantities per supplier
   - Confirm
        ↓
[Stock orders created; suppliers emailed]
```

### FLOW-ADM-003: Power user via command palette

```
[Anywhere in app]
   ⌘K
        ↓
[Command palette modal]
   - Cursor in search input
        ↓
   types: "create order"
        ↓
   results:
     - Action: Create draft order (Enter)
     - Recent: ORD-2026-12345 (visited yesterday)
     - Help: How to create draft orders
        ↓
   Enter on first
        ↓
[Navigate to /orders/drafts/new]
```

### FLOW-ADM-004: Inline edit product price

```
[/catalog/products list]
   - Table with columns: Image, Title, SKU, Price, Stock, Status
        ↓
   double-click Price cell for product P
        ↓
[Cell becomes editable input]
   - Current value pre-selected
   - Save on blur or Enter; Cancel on Esc
        ↓
   user types new price + Enter
        ↓
[Optimistic update: cell shows new value with spinner]
   - useMutation fires
   - On success: spinner → check briefly; cell normalizes
   - On error: revert + toast "Failed to update price"
```

### FLOW-ADM-005: Multi-store switch

```
[Topbar shows "Store: Acme Main (CZ)" dropdown]
        ↓
   click dropdown
        ↓
[List of stores user has access to]
   - Acme Main (CZ) ✓ [current]
   - Acme DE
   - Acme Outlet
        ↓
   click Acme DE
        ↓
[App re-renders for new store context]
   - Data refetched
   - Currency in UI changes (EUR)
   - Locale per store changes
   - URL doesn't change but query context updated
```

### FLOW-ADM-006: Bulk action

```
[/catalog/products list]
        ↓
   Shift+click 25 products
        ↓
[Bulk action bar appears at bottom]
   - "25 selected"
   - Buttons: Publish / Archive / Add tag / Delete / Export CSV / ...
        ↓
   click "Add tag"
        ↓
[Modal: Pick or create tags]
   - Multi-select tags
   - Confirm
        ↓
[Progress bar: "Updating 25 products..."]
   - Cancel button (stops queue; already-applied unchanged)
   - On complete: toast "25 products tagged"
   - List re-filters to show new tags
```

### FLOW-ADM-007: AI copilot use

```
[On product edit page]
   ⌘.
        ↓
[AI panel slides in from right]
   - Context: "You're editing Product 'Black T-Shirt'"
   - Suggestions:
     - "Generate SEO description"
     - "Suggest related products"
     - "Translate to German"
        ↓
   click "Generate SEO description"
        ↓
[AI streaming response in chat]
   - SEO title + meta description generated
   - "Apply to product" button
        ↓
   user clicks Apply
        ↓
[Form fields populated; user reviews + saves]
```

### FLOW-ADM-008: Real-time order notification

```
[User on /orders list]
        ↓
   new order placed by customer
        ↓
[SSE event: order.placed]
        ↓
   in admin:
     - Toast: "New order ORD-2026-12346 — 1250 CZK"
     - Notification badge increments
     - Orders list shows new row with "NEW" badge highlighted
     - Sound chime (configurable)
```

### FLOW-ADM-009: Permission-denied gracefully

```
[Staff user navigates to /finance/payouts]
        ↓
[Route beforeLoad: lacks PERM-FINANCE-VIEW]
        ↓
[403 page]
   - "You don't have access to this page"
   - "Request access from your admin" button
   - Link to /settings/team
        ↓
   user clicks Request access
        ↓
[Modal opens with prefilled message to admin]
   - "I'd like access to: Finance > Payouts"
   - Optional reason
   - Send
        ↓
[Admin notified in own notification center]
```

---

## 14. Edge cases & error handling

| Scenario | Behavior | Code |
|---|---|---|
| Session expires mid-action | Refresh attempt; if fail → login modal preserves form state | (handled) |
| Concurrent edit conflict | Optimistic lock version mismatch → "Page has newer changes" dialog | `RESOURCE_VERSION_MISMATCH`, 412 |
| Permission revoked mid-session | SSE event → reload permissions; affected UI elements disappear | (handled) |
| User in tab A logs out → tab B | BroadcastChannel → tab B redirects to login | (handled) |
| Network drops during save | Mutation retries 3x with exponential backoff; then queue (Fáze 2+) | (handled) |
| Invalid local storage state | Detect on app boot; clear corrupted; reload | (handled) |
| App version mismatch (stale tab) | `/version` endpoint compared on focus; banner "App updated, please reload" | (handled) |
| Browser unsupported | Detect on load; show "Please upgrade browser" page | (handled) |
| Mobile device | Layout responsive; some features simplified; redirect to mobile-optimized POS app for warehouse staff (Fáze 3+) | (handled) |
| Tenant suspended | Login allowed; dashboard shows "Account suspended" banner; only billing accessible | (handled) |
| Tenant trial expired | Same as suspended; "Upgrade plan" CTA prominent | (handled) |
| Command palette no results | Show "No matches. Try: [suggestions]" | (handled) |
| Notification flood | Throttle SSE pushes per minute; aggregate similar events | (handled) |
| Bulk action interrupted | Mark in-progress items; show retry button for failed | (handled) |
| Inline edit value invalid | Inline error message + retain edit mode | (handled) |
| Save draft can't reach localStorage | Fall back to memory; warn user | (handled) |
| AI copilot rate limit | Show "Rate limit reached, try again in N seconds" | (handled per `33-ai-features.md`) |
| User uploads large file | Show progress bar; chunked upload; resume on failure | (handled) |
| Onboarding skip mid-step | Save partial progress; allow resume | (handled) |
| Audit log too large | Paginate; allow date range filter; export to CSV | (handled) |
| Multi-tenant access revoked | Tenant switcher reflects; user kicked back to picker if currently in revoked tenant | (handled) |

---

## 15. Performance

### 15.1 Targets

| Metric | Target |
|---|---|
| LCP (post-login dashboard) | < 1.5s |
| INP | < 100ms |
| Initial JS bundle | < 200 KB gzipped |
| Per-route chunk | < 100 KB gzipped |
| Time to interactive | < 2.5s |
| Cold start (dev mode) | < 200ms |
| Hot module reload | < 100ms |
| Route transition | < 50ms (instant feel) |

### 15.2 Optimization

- **Code splitting** per route (TanStack Router lazy components)
- **Tree shaking** strict (no full lodash; cherry-pick)
- **Image optimization** (CDN-served WebP)
- **Font subset** (only Latin + Czech extended)
- **Virtualized lists** (TanStack Virtual) for long tables
- **Memoization** judicious (React 19 compiler handles most)
- **Web Workers** for heavy client computation (CSV parsing, image processing)
- **Service worker** for offline cache (Fáze 2+)
- **HTTP/2 multiplexing** server-side
- **Resource hints** (`<link rel="prefetch">` for likely next routes)

### 15.3 Monitoring

- Real User Monitoring (Web Vitals API)
- Sentry for errors
- Custom analytics on slow routes (per `20-analytics-reporting.md`)

---

## 16. Security & accessibility

### 16.1 Permissions

```
PERM-ADMIN-ACCESS                                                                                                                                                                                  # basic admin login
PERM-ADMIN-FULL                                                                                                                                                                                     # superuser within tenant
PERM-ADMIN-AUDIT-LOG-VIEW
PERM-ADMIN-TEAM-MANAGE
PERM-ADMIN-IMPERSONATE                                                                                                                                                                              # platform staff only
PERM-ADMIN-AGENCY-MODE                                                                                                                                                                              # multi-tenant access
```

### 16.2 CSP

```
default-src 'self';
script-src 'self' 'nonce-{nonce}';
style-src 'self' 'unsafe-inline';                                                                                                                                                                    # Tailwind needs (Fáze 2+: nonce'd inline only)
img-src 'self' data: https://cdn.shopio.com https://*.{tenant}.shopio.com;
font-src 'self' data:;
connect-src 'self' https://api.{tenant}.shopio.com wss://api.{tenant}.shopio.com;
frame-ancestors 'none';
form-action 'self';
base-uri 'self';
```

### 16.3 Authentication

- Refresh tokens HTTP-only secure cookies
- Access tokens in memory (not localStorage)
- MFA enforced for sensitive actions (per `30-security.md`)

### 16.4 Audit

Every action captured in audit log (per `30-security.md`):
- Mutation calls
- Settings changes
- Bulk actions
- Permission changes
- Impersonation (platform staff)

### 16.5 Accessibility WCAG 2.2 AA

- Keyboard nav for everything
- Screen reader friendly (ARIA, semantic HTML)
- 4.5:1 contrast
- Focus visible
- Respects `prefers-reduced-motion`
- Resize text up to 200% without breakage
- All forms have labels
- Error messages associated with fields

Validated via axe-core in CI + manual testing.

### 16.6 Rate limits

| Endpoint | Limit |
|---|---|
| Command palette search | 30/min per user |
| Notification mark read | 100/min per user |
| Save view | 20/min per user |

---

## 17. Testing

### 17.1 Unit (Vitest)

```
TEST-UNIT-ADM-001  Permission helper can()
TEST-UNIT-ADM-002  Recent items deduplication
TEST-UNIT-ADM-003  Command palette ranking
TEST-UNIT-ADM-004  Saved view serialization
TEST-UNIT-ADM-005  Optimistic mutation rollback
TEST-UNIT-ADM-006  Auto-save draft localStorage
TEST-UNIT-ADM-007  Notification sorting
TEST-UNIT-ADM-008  Onboarding step navigator
TEST-UNIT-ADM-009  Tenant + store context provider
TEST-UNIT-ADM-010  SSE reconnection logic
```

### 17.2 Component (Storybook + Vitest)

```
TEST-COMP-ADM-001  DataTable with various states (loading, empty, error, populated)
TEST-COMP-ADM-002  Form with validation errors
TEST-COMP-ADM-003  CommandPalette keyboard navigation
TEST-COMP-ADM-004  NotificationCenter list + actions
TEST-COMP-ADM-005  Sidebar item permission filtering
TEST-COMP-ADM-006  Bulk action bar appears + dismisses
TEST-COMP-ADM-007  Inline edit cell flow
TEST-COMP-ADM-008  Modal vs Drawer vs Page transitions
```

### 17.3 Integration

```
TEST-INT-ADM-001  Login → MFA → tenant select → dashboard
TEST-INT-ADM-002  Onboarding wizard completion
TEST-INT-ADM-003  Permission-based route gating
TEST-INT-ADM-004  Multi-store switching invalidates cache
TEST-INT-ADM-005  Command palette finds entities + routes + actions
TEST-INT-ADM-006  SSE delivers real-time events
TEST-INT-ADM-007  Bulk action with progress + cancel
TEST-INT-ADM-008  Inline edit with optimistic update + rollback
```

### 17.4 E2E (Playwright)

```
TEST-E2E-ADM-001  Login → create product → publish → verify on storefront
TEST-E2E-ADM-002  Order fulfillment workflow
TEST-E2E-ADM-003  Refund workflow
TEST-E2E-ADM-004  Customer detail with order history
TEST-E2E-ADM-005  Customize theme + publish
TEST-E2E-ADM-006  Multi-tenant agency mode switch
TEST-E2E-ADM-007  Mobile responsive admin (tablet size)
TEST-E2E-ADM-008  Keyboard-only navigation (no mouse)
TEST-E2E-ADM-009  Screen reader smoke test
```

### 17.5 Performance

```
TEST-PERF-ADM-001  Bundle size budget (CI fails if exceeded)
TEST-PERF-ADM-002  Lighthouse score ≥ 90
TEST-PERF-ADM-003  Route transition < 50ms
TEST-PERF-ADM-004  Large data table (10000 rows) virtualized smoothly
```

---

## 18. Implementation checklist

### Foundation
- [ ] **[M]** Vite + React 19 setup with TypeScript strict
- [ ] **[M]** TanStack Router configuration with file-based routing
- [ ] **[M]** TanStack Query setup with default options
- [ ] **[M]** shadcn/ui base components installed
- [ ] **[S]** Tailwind config with design tokens
- [ ] **[S]** Auth context + token refresh
- [ ] **[S]** Permission helper + route guards
- [ ] **[S]** API client (tRPC + GraphQL + REST) with type generation
- [ ] **[M]** SSE client + reconnection
- [ ] **[S]** Sentry integration + error boundaries

### Shell & navigation
- [ ] **[L]** Layout shell (topbar, sidebar, content area)
- [ ] **[M]** Sidebar with permission-filtered items
- [ ] **[M]** Topbar with store switcher, search, notifications, user menu
- [ ] **[L]** Command palette (cmdk)
- [ ] **[M]** Notification center
- [ ] **[M]** Onboarding wizard
- [ ] **[M]** Tenant + store context providers
- [ ] **[S]** Breadcrumb auto-generation

### Component library
- [ ] **[XL]** DataTable with all features (filter, sort, pagination, bulk, inline edit, export, saved views)
- [ ] **[L]** Form components (RHF wrappers + validation UX)
- [ ] **[M]** MediaPicker + upload
- [ ] **[M]** Rich text editor
- [ ] **[M]** Markdown editor
- [ ] **[S]** JSON editor
- [ ] **[S]** Date range picker
- [ ] **[S]** Color picker
- [ ] **[M]** Charts (Recharts wrappers)
- [ ] **[M]** Money + percent display components
- [ ] **[S]** Status badges with semantic colors

### Pages (cross-references — each domain doc owns)
- [ ] **[X-LARGE]** All product/order/customer/etc. pages per other domain docs

### State management
- [ ] **[S]** Auth store
- [ ] **[S]** Tenant store
- [ ] **[S]** UI store
- [ ] **[S]** Notification store
- [ ] **[M]** TanStack Query default options + invalidation patterns
- [ ] **[S]** localStorage sync wrappers

### AI integration
- [ ] **[L]** AI copilot slide-out panel
- [ ] **[M]** Context-aware suggestions per route
- [ ] **[M]** Apply-to-form actions
- [ ] **[S]** Rate limiting + cost display

### Performance
- [ ] **[M]** Route-level code splitting
- [ ] **[M]** Bundle analyzer + budget enforcement
- [ ] **[S]** Image optimization
- [ ] **[M]** Virtualized lists for long tables
- [ ] **[S]** Resource hints

### Accessibility
- [ ] **[M]** axe-core integration in CI
- [ ] **[M]** Keyboard navigation throughout
- [ ] **[S]** Screen reader testing
- [ ] **[S]** `prefers-reduced-motion` respect

### Tests
- [ ] **[L]** Per §17

### Docs
- [ ] **[M]** Storybook for components
- [ ] **[M]** "Admin user guide" for merchants
- [ ] **[S]** "Keyboard shortcuts reference"
- [ ] **[S]** "Customizing admin" guide

---

## 19. Open questions

### Q-ADM-001: Mobile admin app
**Otázka:** React Native admin app or just responsive web?

**Status:** Fáze 4+ React Native using same backend. MVP: responsive web works on tablet.

### Q-ADM-002: Real-time collaborative editing (multiple users editing same product)
**Otázka:** Figma-style live cursors + presence?

**Status:** Out of scope MVP. Optimistic lock sufficient. Fáze 3+ consider.

### Q-ADM-003: Native desktop app (Electron / Tauri)
**Otázka:** Desktop wrapper for offline + native notifications?

**Status:** Out of scope. PWA installable as fallback.

### Q-ADM-004: Customizable dashboards
**Otázka:** Drag-drop widget dashboard per user?

**Status:** Fáze 2+ feature. MVP: fixed dashboard.

### Q-ADM-005: Admin SDK / app extensions
**Otázka:** Third-party apps inject UI into admin (like Shopify App Bridge)?

**Status:** Fáze 3+ in `28-developer-platform.md`. iframe-based with PostMessage.

### Q-ADM-006: Theming admin per tenant (white-label)
**Otázka:** Tenant can fully reskin admin for resale?

**Status:** Fáze 3+ feature. MVP: brand color + logo injection only.

### Q-ADM-007: Multi-language admin
**Otázka:** Beyond English/Czech for MVP?

**Status:** Fáze 2: German, Slovak. Fáze 3+: more.

### Q-ADM-008: Audit log retention
**Otázka:** How long to keep?

**Status:** Per `30-security.md` — 2 years hot, 5 years cold storage.

### Q-ADM-009: Admin analytics
**Otázka:** Track admin user behavior for UX improvements?

**Status:** Yes, anonymized. Per `20-analytics-reporting.md`. Opt-out available.

### Q-ADM-010: Offline support
**Otázka:** Service worker + IndexedDB queue for mutations?

**Status:** Fáze 2+ progressive enhancement. MVP: online-only.

---

## 📅 Změny

| Datum | Změna |
|---|---|
| 2026-05-20 | Initial — Admin backoffice architecture. Vite + React 19 SPA per DEC-FE-001, Tailwind + shadcn/ui, TanStack Router/Query, command palette, real-time SSE, multi-tenant + multi-store switching, AI copilot panel. |

---

**Konec Admin Backoffice.**

➡️ Pokračovat na: [`28-developer-platform.md`](28-developer-platform.md)
