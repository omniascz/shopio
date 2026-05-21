# 26 – THEMES & STOREFRONT

> **Doména:** Storefront design system — themes (visual + behavioral templates), design tokens, section-based editing (Shopify-style page builder), theme marketplace, headless API for custom frontends. Bundled default theme (Next.js 16, per [DEC-FE-001](01-decisions-registry.md#dec-fe-001-frontend-framework)). Accessibility WCAG 2.2 AA mandatory, Core Web Vitals enforced.

**Datum:** 2026-05-20
**Verze:** 1.0
**Status:** 🟡 DESIGN
**Reference:** [03 §19](03-data-models-master.md#19-themes--storefront-customization) · [DEC-FE-001](01-decisions-registry.md#dec-fe-001-frontend-framework) · [DEC-FE-002](01-decisions-registry.md#dec-fe-002-styling-strategy) · [22-multistore-channels.md](22-multistore-channels.md) · [35-graphic-templates.md](35-graphic-templates.md)

---

## 📑 Obsah

0. [Domain overview](#0-domain-overview)
1. [References](#1-references)
2. [Personas](#2-personas)
3. [Data models](#3-data-models)
4. [Theme architecture](#4-theme-architecture)
5. [Section-based editing](#5-section-based-editing)
6. [Design tokens](#6-design-tokens)
7. [State machines](#7-state-machines)
8. [Business rules](#8-business-rules)
9. [REST API endpoints](#9-rest-api-endpoints)
10. [GraphQL schema](#10-graphql-schema)
11. [Events](#11-events)
12. [Background jobs](#12-background-jobs)
13. [UI/UX flows](#13-uiux-flows)
14. [Edge cases & error handling](#14-edge-cases--error-handling)
15. [Performance & accessibility](#15-performance--accessibility)
16. [Security](#16-security)
17. [Testing](#17-testing)
18. [Implementation checklist](#18-implementation-checklist)
19. [Open questions](#19-open-questions)

---

## 0. Domain overview

### 0.1 Co tato doména **je**

- **Theme** — packageable storefront design (templates + styles + sections + settings schema + assets)
- **Bundled default theme** — Next.js 16 App Router theme shipped with platform; works out-of-box per [DEC-FE-001](01-decisions-registry.md#dec-fe-001-frontend-framework)
- **Theme marketplace** — community + premium themes (Fáze 2)
- **Design tokens** — CSS variables for colors, typography, spacing, radius, shadows (theme-customizable)
- **Section-based editing** — page builder where merchant drags sections (hero, product grid, banner, testimonials, ...) into page templates
- **Template files** — `home.json`, `product.json`, `collection.json`, `cart.json`, `account/*.json`, ...; render server-side from theme
- **Theme settings** — schema-driven (colors, fonts, layouts) editable in admin without code
- **Custom CSS / JS injection** — merchant adds own snippets within sandbox (Fáze 2)
- **Multi-store theme assignment** — different theme per store (per `22-multistore-channels.md`)
- **Theme versioning** — preview unpublished changes, rollback, history
- **Headless storefront** — Storefront API serves custom React Native / Next.js / Astro / etc. frontends (no theme needed)
- **Responsive design** — mobile-first; tablet/desktop variants
- **Accessibility WCAG 2.2 AA** — mandatory; automated linting + audit (`PERM-THEME-PUBLISH` blocked if critical violations)
- **Core Web Vitals** — LCP < 1.8s, INP < 150ms, CLS < 0.05 ([DEC-PERF-001](01-decisions-registry.md#dec-perf-001-performance-targets)); performance budget enforced in CI
- **A/B testing storefront** (Fáze 2+) — theme variants per traffic split
- **Theme preview** — preview changes before publish (draft → published workflow)
- **Page templates per type** — home, collection, product, search, cart, checkout, account, blog, page, error
- **Email template integration** — themes can include email layouts (cross-ref `19-marketing-seo.md`)

### 0.2 Co tato doména **NENÍ**

- ❌ Admin UI (→ `27-admin-backoffice.md`)
- ❌ Email marketing automation (→ `19-marketing-seo.md`)
- ❌ CMS content blocks (→ `32-cms-content.md` — CMS pages render in themes)
- ❌ Marketing analytics tracking JS (→ `20-analytics-reporting.md`)
- ❌ Theme code editor (Fáze 2+; basic JSON settings editor in MVP)
- ❌ Cart / checkout business logic (→ `11`, `12`)
- ❌ Product detail business logic (→ `06`)
- ❌ Cross-platform compatibility testing infrastructure (→ Fáze 3+ separate)
- ❌ Mobile app (→ Fáze 4+ React Native; uses same storefront API)
- ❌ Search UI (→ `08-search-filtering.md`; themes render search results)

### 0.3 Diferenciátory

1. **Server-rendered by default** — Next.js 16 RSC + Cache Components → fast LCP, good SEO
2. **Section-based editing built-in** — no need for $$ visual editor plugins (like PageBuilder addons in Magento)
3. **Headless ready from day 1** — Storefront API parity; choose Next.js theme or custom frontend
4. **Accessibility-first** — WCAG 2.2 AA mandatory; can't publish theme with critical a11y violations
5. **Core Web Vitals enforced** — CI checks block themes regressing performance
6. **Design tokens API** — themes expose CSS variables; admins customize without forking
7. **Open theme marketplace** — community themes welcome; premium themes via marketplace (per `28-developer-platform.md`)
8. **Multi-store theming** — single tenant runs multiple branded storefronts (per `22-multistore-channels.md`)

---

## 1. References

- [03 §19](03-data-models-master.md#19-themes--storefront-customization) — ENT-THEME-001, ENT-THEME-SETTINGS-001, ENT-THEME-ASSET-001
- [DEC-FE-001](01-decisions-registry.md#dec-fe-001-frontend-framework) — Next.js 16 storefront, Vite admin
- [DEC-FE-002](01-decisions-registry.md#dec-fe-002-styling-strategy) — Tailwind + shadcn/ui admin, theme system for storefront
- [DEC-FE-003](01-decisions-registry.md#dec-fe-003-state-management) — Zustand + TanStack Query
- [DEC-PERF-001](01-decisions-registry.md#dec-perf-001-performance-targets) — Core Web Vitals targets
- [22-multistore-channels.md](22-multistore-channels.md) — store ↔ theme assignment
- [28-developer-platform.md](28-developer-platform.md) — theme marketplace
- [29-integrations.md](29-integrations.md) — analytics, payment widget integration
- [32-cms-content.md](32-cms-content.md) — CMS pages render in theme templates
- [35-graphic-templates.md](35-graphic-templates.md) — design system reference
- [19-marketing-seo.md](19-marketing-seo.md) — email templates can be theme-aware
- [33-ai-features.md](33-ai-features.md) — AI design assistant (Fáze 3+)
- WCAG 2.2 (W3C Recommendation October 2023)
- Core Web Vitals (Google web.dev)
- ECMAScript / Web Components
- Next.js 16 docs (App Router, Cache Components)
- shadcn/ui patterns

---

## 2. Personas

| Persona | Použití | Klíčové permissions |
|---|---|---|
| `PERSONA-MERCHANT-OWNER` | Pick theme, customize, publish | `PERM-THEME-*` |
| `PERSONA-DESIGNER` (in-house or contracted) | Customize theme, add sections, design tokens | `PERM-THEME-CUSTOMIZE`, `PERM-THEME-PUBLISH` |
| `PERSONA-DEVELOPER` (theme developer) | Build + publish themes | `PERM-THEME-DEVELOP` |
| `PERSONA-MARKETING-MANAGER` | A/B test themes (Fáze 2+) | `PERM-THEME-AB-TEST` |
| `PERSONA-CONTENT-EDITOR` | Edit page content via sections | `PERM-CMS-EDIT` (cross-ref `32`) |
| `PERSONA-CUSTOMER` | Use storefront | No explicit permissions |
| `PERSONA-AI-COPILOT` | Suggest design improvements, generate sections (Fáze 3+) | `agent:theme:suggest` |
| `PERSONA-ACCESSIBILITY-AUDITOR` | Review theme a11y compliance | `PERM-THEME-AUDIT-VIEW` |
| `PERSONA-PLATFORM-STAFF` | Approve marketplace themes | `PERM-THEME-MARKETPLACE-APPROVE` |

---

## 3. Data models

### 3.1 `themes` ([ENT-THEME-001](03-data-models-master.md#ent-theme-001))

```sql
CREATE TABLE themes (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  pub_id TEXT NOT NULL,                                                                                      -- thm_ NanoID
  package_name TEXT NOT NULL,                                                                                -- '@shopio/theme-default','@my-org/theme-custom'
  package_version TEXT NOT NULL,                                                                              -- semver '1.2.3'
  name TEXT NOT NULL,                                                                                          -- "Shopio Default", "Modern Minimal"
  description TEXT NULL,
  author TEXT NULL,
  author_url TEXT NULL,
  -- source
  source_kind TEXT NOT NULL CHECK (source_kind IN ('bundled','marketplace','custom_upload','git_clone')),
  marketplace_listing_id UUID NULL,                                                                            -- if installed from marketplace
  git_repository_url TEXT NULL,                                                                                -- pro git_clone
  git_branch TEXT NULL,
  -- installation
  installed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  installed_by_user_id UUID NULL,
  install_storage_key TEXT NULL,                                                                               -- S3 path to theme assets bundle
  -- status
  status TEXT NOT NULL CHECK (status IN ('installing','installed','active','disabled','failed','uninstalling')) DEFAULT 'installing',
  status_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- preview / publish workflow
  published_revision_id UUID NULL,                                                                              -- → theme_revisions.id (currently live)
  draft_revision_id UUID NULL,                                                                                  -- → theme_revisions.id (in-progress edits)
  -- compliance flags (computed at validation time)
  accessibility_score INTEGER NULL,                                                                              -- 0-100, > 80 to publish
  performance_score INTEGER NULL,                                                                                -- 0-100, > 75 to publish
  passed_validation BOOLEAN NOT NULL DEFAULT false,
  validation_errors JSONB NULL,
  -- visual
  thumbnail_media_id UUID NULL REFERENCES media(id),
  preview_url TEXT NULL,                                                                                          -- demo URL
  -- license
  license_kind TEXT NULL CHECK (license_kind IN ('oss_mit','oss_apache_2','commercial','custom') OR license_kind IS NULL),
  license_url TEXT NULL,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_themes_pub_id UNIQUE (tenant_id, pub_id),
  CONSTRAINT uq_themes_package_version UNIQUE (tenant_id, package_name, package_version)
);

CREATE UNIQUE INDEX uq_themes_active ON themes (tenant_id) WHERE status = 'active';
CREATE INDEX idx_themes_marketplace ON themes (marketplace_listing_id) WHERE marketplace_listing_id IS NOT NULL;
```

**Exactly 1 active theme per tenant per store** — actual assignment via `stores.theme_id` (per `22-multistore-channels.md`).

### 3.2 `theme_revisions`

Each save = new revision. Allows preview + rollback.

```sql
CREATE TABLE theme_revisions (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  theme_id UUID NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,                                                                                -- sequential per theme
  kind TEXT NOT NULL CHECK (kind IN ('draft','published','archived')) DEFAULT 'draft',
  -- snapshot
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,                                                                       -- theme settings values
  templates JSONB NOT NULL DEFAULT '{}'::jsonb,                                                                       -- page templates as section trees
  custom_css TEXT NULL,
  custom_js TEXT NULL,                                                                                                -- sandboxed; admin-only feature
  -- compliance snapshot at save
  accessibility_score INTEGER NULL,
  performance_score INTEGER NULL,
  passed_validation BOOLEAN NOT NULL DEFAULT false,
  validation_errors JSONB NULL,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user_id UUID NULL,
  published_at TIMESTAMPTZ NULL,                                                                                       -- when this revision became live
  archived_at TIMESTAMPTZ NULL,
  notes TEXT NULL,                                                                                                      -- merchant changelog
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_theme_revisions UNIQUE (theme_id, revision_number)
);

CREATE INDEX idx_theme_revisions_theme ON theme_revisions (theme_id, revision_number DESC);
CREATE INDEX idx_theme_revisions_kind ON theme_revisions (theme_id, kind);
```

### 3.3 `theme_settings_schema`

Theme's settings.json — defines what merchant can customize.

```sql
CREATE TABLE theme_settings_schemas (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  theme_id UUID NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  schema_version TEXT NOT NULL,                                                                                          -- semver of schema
  schema_definition JSONB NOT NULL,                                                                                       -- JSON Schema
  -- example schema:
  -- { "groups": [
  --     { "name": "colors", "label": "Colors", "settings": [
  --       { "key": "color_primary", "kind": "color", "default": "#0066ff", "label": "Primary color" },
  --       { "key": "color_background", "kind": "color", "default": "#ffffff", ... }
  --     ]},
  --     { "name": "typography", "settings": [
  --       { "key": "font_heading", "kind": "font", "default": "Inter", "options": [...] }
  --     ]}
  --   ]
  -- }
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_theme_settings_schemas UNIQUE (theme_id, schema_version)
);
```

### 3.4 `theme_sections`

Catalog of section types available in theme.

```sql
CREATE TABLE theme_sections (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  theme_id UUID NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  section_kind TEXT NOT NULL,                                                                                              -- 'hero','product_grid','testimonials','rich_text','banner','featured_products','image_with_text','newsletter_signup','custom_html'
  name TEXT NOT NULL,                                                                                                       -- display name
  description TEXT NULL,
  category TEXT NULL,                                                                                                       -- 'header','footer','content','marketing'
  preview_media_id UUID NULL REFERENCES media(id),
  settings_schema JSONB NOT NULL,                                                                                            -- per-section configuration
  -- defaults
  default_settings JSONB NULL,                                                                                                -- starting config when added to page
  -- which templates can use this section
  allowed_template_kinds TEXT[] NULL,                                                                                          -- ['home','product','collection',...]; NULL = all
  -- behavior
  is_unique BOOLEAN NOT NULL DEFAULT false,                                                                                    -- only one per page (e.g., header)
  min_per_page INTEGER NULL,
  max_per_page INTEGER NULL,
  is_static BOOLEAN NOT NULL DEFAULT false,                                                                                     -- header/footer pinned
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_theme_sections UNIQUE (theme_id, section_kind)
);

CREATE INDEX idx_theme_sections_theme ON theme_sections (theme_id);
```

### 3.5 `theme_templates`

Page templates available (e.g., `product.json`, `collection.json`).

```sql
CREATE TABLE theme_templates (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  theme_id UUID NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  template_kind TEXT NOT NULL CHECK (template_kind IN (
    'home','collection','product','search','cart','checkout','account_index','account_orders','account_addresses',
    'blog_index','blog_post','cms_page','error_404','error_500','password_protected','maintenance','custom'
  )),
  template_variant TEXT NULL,                                                                                                    -- 'simple','grid','editorial' (multiple variants per kind)
  name TEXT NOT NULL,
  description TEXT NULL,
  default_section_tree JSONB NOT NULL,                                                                                            -- default layout
  layout_kind TEXT NOT NULL CHECK (layout_kind IN ('default','full_width','narrow','custom')) DEFAULT 'default',
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_theme_templates UNIQUE (theme_id, template_kind, COALESCE(template_variant, ''))
);

CREATE INDEX idx_theme_templates_theme ON theme_templates (theme_id, template_kind);
```

### 3.6 `theme_settings` ([ENT-THEME-SETTINGS-001](03-data-models-master.md#ent-theme-settings-001))

Per-store + per-theme settings values (snapshot of revision's settings).

```sql
CREATE TABLE theme_settings (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  theme_id UUID NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  setting_key TEXT NOT NULL,                                                                                                       -- e.g., 'color_primary','font_heading'
  setting_value JSONB NOT NULL,                                                                                                     -- can be string, number, object
  -- audit
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by_user_id UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_theme_settings UNIQUE (store_id, theme_id, setting_key)
);

CREATE INDEX idx_theme_settings_store_theme ON theme_settings (store_id, theme_id);
```

### 3.7 `theme_assets` ([ENT-THEME-ASSET-001](03-data-models-master.md#ent-theme-asset-001))

Custom asset overrides (logo, custom images, JS snippets).

```sql
CREATE TABLE theme_assets (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  theme_id UUID NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  asset_kind TEXT NOT NULL CHECK (asset_kind IN ('logo','favicon','og_image','custom_image','custom_css','custom_js','font_file','section_image')),
  storage_key TEXT NOT NULL,                                                                                                         -- S3 path
  mime_type TEXT NULL,
  filename TEXT NULL,
  bytes BIGINT NULL,
  width_px INTEGER NULL,
  height_px INTEGER NULL,
  position INTEGER NULL,                                                                                                              -- for ordering (e.g., multiple custom_js)
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- audit
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  uploaded_by_user_id UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_theme_assets_store_theme ON theme_assets (store_id, theme_id) WHERE is_active = true;
CREATE INDEX idx_theme_assets_kind ON theme_assets (theme_id, asset_kind);
```

### 3.8 `theme_validation_runs`

Audit of theme validation (a11y + performance + lint).

```sql
CREATE TABLE theme_validation_runs (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  theme_id UUID NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  revision_id UUID NULL REFERENCES theme_revisions(id) ON DELETE CASCADE,
  -- kinds run
  ran_accessibility_check BOOLEAN NOT NULL DEFAULT false,
  ran_performance_check BOOLEAN NOT NULL DEFAULT false,
  ran_lint_check BOOLEAN NOT NULL DEFAULT false,
  ran_responsive_check BOOLEAN NOT NULL DEFAULT false,
  -- scores
  accessibility_score INTEGER NULL,                                                                                                    -- 0-100
  performance_score INTEGER NULL,
  lighthouse_lcp_ms INTEGER NULL,
  lighthouse_inp_ms INTEGER NULL,
  lighthouse_cls NUMERIC(5,3) NULL,
  -- detailed results
  a11y_violations JSONB NULL,                                                                                                          -- axe-core output
  performance_metrics JSONB NULL,
  lint_warnings JSONB NULL,
  responsive_breakpoints_passed JSONB NULL,
  -- overall
  passed BOOLEAN NOT NULL,
  blocking_issues JSONB NULL,                                                                                                          -- critical issues preventing publish
  -- audit
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ NULL,
  duration_ms INTEGER NULL,
  initiated_by_kind TEXT NOT NULL CHECK (initiated_by_kind IN ('manual','auto_on_save','auto_on_publish','scheduled','ci')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_theme_validation_runs_theme ON theme_validation_runs (theme_id, started_at DESC);
CREATE INDEX idx_theme_validation_runs_revision ON theme_validation_runs (revision_id);
```

### 3.9 `theme_ab_tests` *(Fáze 2+)*

```sql
CREATE TABLE theme_ab_tests (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  pub_id TEXT NOT NULL,
  name TEXT NOT NULL,
  hypothesis TEXT NULL,
  control_revision_id UUID NOT NULL REFERENCES theme_revisions(id),
  variant_revision_ids UUID[] NOT NULL,
  traffic_split JSONB NOT NULL,                                                                                                          -- { "control": 50, "variant_a": 25, "variant_b": 25 }
  primary_metric TEXT NOT NULL,                                                                                                          -- 'conversion_rate','aov','clicks_to_cart'
  status TEXT NOT NULL CHECK (status IN ('draft','running','paused','completed','archived')) DEFAULT 'draft',
  started_at TIMESTAMPTZ NULL,
  ended_at TIMESTAMPTZ NULL,
  winning_variant TEXT NULL,
  statistical_significance NUMERIC(5,4) NULL,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_theme_ab_tests_pub_id UNIQUE (tenant_id, pub_id)
);

CREATE INDEX idx_theme_ab_tests_running ON theme_ab_tests (tenant_id, status) WHERE status = 'running';
```

### 3.10 `theme_marketplace_listings` *(read-side mirror, Fáze 2+)*

Themes available for install from marketplace (admin app shows catalog).

```sql
CREATE TABLE theme_marketplace_listings (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  package_name TEXT NOT NULL,                                                                                                            -- '@shopio-theme/modern-minimal'
  display_name TEXT NOT NULL,
  description TEXT NULL,
  author TEXT NULL,
  author_url TEXT NULL,
  latest_version TEXT NOT NULL,
  available_versions TEXT[] NOT NULL DEFAULT '{}',
  license_kind TEXT NULL,
  price_kind TEXT NOT NULL CHECK (price_kind IN ('free','one_time','subscription','open_source')) DEFAULT 'free',
  price_amount BIGINT NULL,
  price_currency CHAR(3) NULL,
  category TEXT NULL,
  tags TEXT[] NULL,
  -- assets
  thumbnail_url TEXT NULL,
  preview_images JSONB NULL,
  demo_url TEXT NULL,
  documentation_url TEXT NULL,
  -- stats
  install_count INTEGER NOT NULL DEFAULT 0,
  average_rating NUMERIC(3,2) NULL,
  rating_count INTEGER NOT NULL DEFAULT 0,
  -- compliance
  accessibility_score INTEGER NULL,
  performance_score INTEGER NULL,
  reviewed_by_platform_at TIMESTAMPTZ NULL,
  platform_approved BOOLEAN NOT NULL DEFAULT false,
  -- audit
  published_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_theme_marketplace_listings UNIQUE (package_name)
);

CREATE INDEX idx_theme_marketplace_listings_category ON theme_marketplace_listings (category) WHERE platform_approved = true;
CREATE INDEX idx_theme_marketplace_listings_popular ON theme_marketplace_listings (install_count DESC) WHERE platform_approved = true;
```

### 3.11 Vztahy

```
tenants (1)──(N) themes
stores (N)──(1) themes                                                                                                                    [stores.theme_id]
themes (1)──(N) theme_revisions
themes (1)──(1) theme_settings_schemas                                                                                                    [latest version]
themes (1)──(N) theme_sections
themes (1)──(N) theme_templates
themes (1)──(N) theme_settings                                                                                                            [per store]
themes (1)──(N) theme_assets                                                                                                              [per store]
themes (1)──(N) theme_validation_runs
themes (0..1)──(1) theme_marketplace_listings                                                                                              [if installed from marketplace]
theme_revisions (1)──(N) theme_validation_runs
stores (1)──(N) theme_ab_tests
```

---

## 4. Theme architecture

### 4.1 Theme package structure

Themes shipped as NPM packages OR uploaded ZIP:

```
@my-org/theme-custom/
├── package.json
├── theme.json                                                                                                                              # manifest (name, version, settings_schema)
├── settings.json                                                                                                                            # settings schema
├── templates/
│   ├── home.json
│   ├── product.json
│   ├── collection.json
│   ├── search.json
│   ├── cart.json
│   ├── account/
│   │   ├── index.json
│   │   ├── orders.json
│   │   └── addresses.json
│   ├── blog/
│   │   ├── index.json
│   │   └── post.json
│   ├── error_404.json
│   └── custom/                                                                                                                                # custom landing pages
├── sections/                                                                                                                                  # React Server Components
│   ├── hero.tsx
│   ├── product-grid.tsx
│   ├── testimonials.tsx
│   ├── newsletter-signup.tsx
│   ├── header.tsx
│   ├── footer.tsx
│   └── ...
├── components/                                                                                                                                # shared building blocks
│   ├── button.tsx
│   ├── product-card.tsx
│   └── ...
├── locales/                                                                                                                                   # theme-specific translations
│   ├── cs.json
│   └── en.json
├── styles/
│   ├── tokens.css                                                                                                                              # design tokens (CSS variables)
│   └── base.css
└── assets/                                                                                                                                    # static (icons, fonts)
```

### 4.2 Theme manifest (theme.json)

```jsonc
{
  "name": "Modern Minimal",
  "version": "1.0.0",
  "author": "Shopio",
  "author_url": "https://shopio.com",
  "description": "Clean, accessible storefront theme",
  "license": "MIT",
  "compatible_with_platform_version": "^1.0.0",
  "supported_locales": ["cs-CZ","en-US","de-DE"],
  "supports_rtl": false,
  "default_color_scheme": "light",
  "supports_color_schemes": ["light","dark","auto"],
  "section_kinds": ["hero","product_grid","testimonials","banner","rich_text","featured_products","image_with_text","newsletter_signup"],
  "template_kinds": ["home","product","collection","search","cart","blog_post","blog_index","account_index","account_orders","account_addresses","error_404"],
  "feature_flags": {
    "supports_quick_view": true,
    "supports_predictive_search": true,
    "supports_color_swatches": true
  }
}
```

### 4.3 Template definition (templates/product.json)

```jsonc
{
  "template_kind": "product",
  "layout_kind": "default",
  "sections": [
    {
      "kind": "header",
      "is_static": true,
      "settings": {"sticky": true}
    },
    {
      "kind": "product_main",
      "settings": {
        "show_vendor": true,
        "show_sku": true,
        "show_reviews": true,
        "gallery_layout": "side_thumbnails"
      }
    },
    {
      "kind": "product_description",
      "settings": {"tabs_enabled": true}
    },
    {
      "kind": "related_products",
      "settings": {"max_products": 4, "title": "You might also like"}
    },
    {
      "kind": "newsletter_signup",
      "settings": {"title": "Get 10% off your first order"}
    },
    {
      "kind": "footer",
      "is_static": true
    }
  ]
}
```

### 4.4 Section component example

```tsx
// sections/hero.tsx
import { ThemeSection } from '@shopio/theme-kit';

export const HeroSection: ThemeSection<HeroSettings> = ({ settings, store }) => {
  return (
    <section
      className="hero"
      style={{
        backgroundImage: `url(${settings.background_image_url})`,
        minHeight: settings.height || '60vh'
      }}
    >
      <h1>{settings.heading}</h1>
      <p>{settings.subheading}</p>
      {settings.cta_text && (
        <a href={settings.cta_url} className="btn-primary">
          {settings.cta_text}
        </a>
      )}
    </section>
  );
};

HeroSection.kind = 'hero';
HeroSection.settingsSchema = {
  type: 'object',
  properties: {
    heading: { type: 'string', maxLength: 100, default: 'Welcome' },
    subheading: { type: 'string', maxLength: 300 },
    background_image_url: { type: 'string', format: 'media' },
    cta_text: { type: 'string', maxLength: 30 },
    cta_url: { type: 'string', format: 'url' },
    height: { type: 'string', enum: ['40vh','60vh','80vh','100vh'], default: '60vh' }
  }
};
```

### 4.5 Settings schema (settings.json)

```jsonc
{
  "groups": [
    {
      "name": "colors",
      "label": "Colors",
      "settings": [
        { "key": "color_primary", "kind": "color", "default": "#0066ff", "label": "Primary" },
        { "key": "color_background", "kind": "color", "default": "#ffffff", "label": "Background" },
        { "key": "color_text", "kind": "color", "default": "#0a0a0a", "label": "Text" },
        { "key": "color_accent", "kind": "color", "default": "#FF6B35", "label": "Accent" }
      ]
    },
    {
      "name": "typography",
      "label": "Typography",
      "settings": [
        { "key": "font_heading", "kind": "font", "default": "Inter", "options": [
          {"value":"Inter","label":"Inter"},
          {"value":"Playfair Display","label":"Playfair Display"},
          {"value":"DM Serif Display","label":"DM Serif Display"}
        ]},
        { "key": "font_body", "kind": "font", "default": "Inter" },
        { "key": "heading_scale", "kind": "select", "default": "default",
          "options": [{"value":"compact"},{"value":"default"},{"value":"airy"}] }
      ]
    },
    {
      "name": "layout",
      "label": "Layout",
      "settings": [
        { "key": "container_max_width", "kind": "select", "default": "1280px",
          "options": [{"value":"1280px"},{"value":"1440px"},{"value":"1600px"},{"value":"full"}] }
      ]
    },
    {
      "name": "header",
      "label": "Header",
      "settings": [
        { "key": "header_sticky", "kind": "checkbox", "default": true },
        { "key": "header_show_search", "kind": "checkbox", "default": true },
        { "key": "header_logo_position", "kind": "select", "default": "left",
          "options": [{"value":"left"},{"value":"center"}] }
      ]
    }
  ]
}
```

---

## 5. Section-based editing

### 5.1 Theme editor (admin UI)

Visual editor accessible at `/admin/themes/{theme_id}/customize`:

- **Left panel:** template + section tree
- **Center:** live preview (iframe rendering storefront with draft revision)
- **Right panel:** settings for selected section (form generated from section's `settingsSchema`)

Actions:
- Add section (from theme's `theme_sections` catalog)
- Remove section
- Reorder sections (drag-drop)
- Edit section settings
- Duplicate section
- Save → creates new `theme_revisions` row (draft)
- Publish → marks revision as `kind='published'`, updates `themes.published_revision_id`

### 5.2 Page template editing

Merchant selects template (e.g., "Home"), sees section tree:
```
[Header]
├ [Hero]
├ [Featured Products]
├ [Image with Text]
├ [Newsletter Signup]
└ [Footer]
```

Drag new section onto canvas → insert position confirmed → section added with default settings.

### 5.3 Per-page customization (CMS pages)

For specific CMS pages (per `32-cms-content.md`), merchant can override theme's default template with custom section tree per page. Stored as `cms_pages.content_blocks`.

### 5.4 Section settings

Each section has own settings (defined in section component). Admin renders form from schema. Examples:

**Hero section settings:**
- Heading text
- Subheading
- Background image (media picker)
- CTA button text + URL
- Height (dropdown: 40vh / 60vh / 80vh / 100vh)
- Text alignment
- Background overlay opacity

**Product grid settings:**
- Source (collection / manual selection / smart filter)
- Number of products
- Layout (2/3/4/5 columns)
- Card style (default / minimal / detailed)
- Show price / vendor / rating
- Sort order

### 5.5 Save + publish workflow

```
Merchant edits → draft revision auto-saved every 30 sec
   ↓
Merchant clicks "Save" → revision saved + validated
   ↓
Validation runs (a11y + perf + responsive)
   ↓
Pass → "Publish" button enabled
Fail → blocking errors shown; cannot publish
   ↓
Click "Publish" → confirmation modal
   ↓
Revision marked 'published'; previous published marked 'archived'
   ↓
CDN cache invalidated for store
   ↓
Live storefront serves new revision
```

### 5.6 Preview mode

Customer sees current published revision. Admin in editor sees draft revision. Preview URL with signed token allows sharing draft to stakeholders without publishing:

```
GET /admin/themes/{theme_id}/preview?token={signed_jwt}
```

Token contains `revision_id`, expires 24h, allows logged-out access to draft preview.

### 5.7 Rollback

Each published revision retained. Admin can rollback to any prior version:
- Lists past `kind='published'` revisions with timestamps
- Click "Restore" → that revision becomes new published; new revision_number assigned (not in-place)

---

## 6. Design tokens

### 6.1 CSS variable system

Themes expose CSS variables for runtime customization:

```css
/* styles/tokens.css */
:root {
  /* Colors */
  --color-primary: var(--shopio-color-primary, #0066ff);
  --color-background: var(--shopio-color-background, #ffffff);
  --color-text: var(--shopio-color-text, #0a0a0a);
  --color-accent: var(--shopio-color-accent, #FF6B35);
  --color-border: var(--shopio-color-border, #e5e7eb);
  --color-muted: var(--shopio-color-muted, #6b7280);
  --color-error: var(--shopio-color-error, #dc2626);
  --color-success: var(--shopio-color-success, #10b981);

  /* Typography */
  --font-heading: var(--shopio-font-heading, 'Inter', system-ui, sans-serif);
  --font-body: var(--shopio-font-body, 'Inter', system-ui, sans-serif);
  --font-mono: ui-monospace, monospace;

  --font-size-base: 16px;
  --font-size-sm: 0.875rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.25rem;
  --font-size-2xl: 1.5rem;
  --font-size-3xl: 2rem;
  --font-size-4xl: 2.5rem;

  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  --line-height-tight: 1.25;
  --line-height-base: 1.5;
  --line-height-relaxed: 1.75;

  /* Spacing (8-pt grid) */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  --space-20: 80px;
  --space-24: 96px;

  /* Borders */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-full: 9999px;
  --border-width: 1px;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.07);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.1);

  /* Layout */
  --container-max-width: 1280px;
  --header-height: 64px;
  --footer-min-height: 200px;

  /* Animation */
  --transition-fast: 150ms ease-in-out;
  --transition-base: 250ms ease-in-out;
  --transition-slow: 400ms ease-in-out;

  /* Breakpoints (informational; use in JS not CSS) */
  /* sm: 640px, md: 768px, lg: 1024px, xl: 1280px, 2xl: 1536px */
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  :root:not([data-color-scheme="light"]) {
    --color-background: var(--shopio-color-background-dark, #0a0a0a);
    --color-text: var(--shopio-color-text-dark, #f9fafb);
    --color-border: var(--shopio-color-border-dark, #374151);
  }
}

[data-color-scheme="dark"] {
  --color-background: #0a0a0a;
  --color-text: #f9fafb;
  --color-border: #374151;
}
```

### 6.2 Settings → CSS variables binding

Storefront server renders `<style>` block with overrides from `theme_settings`:

```html
<style id="shopio-theme-overrides">
  :root {
    --shopio-color-primary: #FF6B35;
    --shopio-color-background: #FAFAFA;
    --shopio-font-heading: 'Playfair Display', serif;
  }
</style>
```

### 6.3 Per-store overrides

Each store has own `theme_settings` rows. Different stores running same theme can have different colors.

### 6.4 Component usage

Theme components use tokens consistently:
```css
.btn-primary {
  background: var(--color-primary);
  color: white;
  padding: var(--space-3) var(--space-6);
  border-radius: var(--radius-md);
  font-weight: var(--font-weight-medium);
  transition: var(--transition-fast);
}

.btn-primary:hover {
  background: color-mix(in srgb, var(--color-primary) 90%, black);
}
```

---

## 7. State machines

### 7.1 Theme lifecycle

```
installing → installed → active ↔ disabled
                                     ↓
                                  uninstalling → (removed)

failed (during install) → can retry
```

### 7.2 Theme revision lifecycle

```
draft → published ↘
                   archived (when superseded by newer published)
```

### 7.3 A/B test (Fáze 2+)

```
draft → running → completed → archived
              ↘ paused → running
```

---

## 8. Business rules

### RULE-THM-001: One active theme per store

`stores.theme_id` references exactly one theme. Cannot have multiple active themes for same store. Activation atomic: previous deactivated, new activated.

### RULE-THM-002: Theme publish blocks if validation fails

Critical violations (a11y, performance, lint) block publish:
- A11y score < 80: blocked
- Performance score < 75: blocked
- Critical lint errors: blocked

Warnings allowed (with merchant ack). Tenant override available (`tenant.settings.theme_publish_force_allowed=true`) for staging but logs audit warning.

### RULE-THM-003: Section settings validated against schema

When merchant saves section settings: Zod-validated against section's `settingsSchema`. Invalid → reject save with field errors.

### RULE-THM-004: Theme version compatibility

Theme manifest declares `compatible_with_platform_version`. Install rejected if platform version doesn't match semver range. Auto-updates respect semver.

### RULE-THM-005: Headless mode

Stores without bundled theme assigned (custom frontend via Storefront API):
- `stores.theme_id = NULL`
- All HTML/CSS/JS responsibility of merchant's custom frontend
- Storefront API serves data only (JSON)

### RULE-THM-006: Custom CSS/JS sandboxing

Custom JS uploaded by merchants:
- Strict CSP (no `eval`, no inline scripts in production)
- Iframe sandbox for execution (Fáze 2+)
- Allowlist approach: only certain DOM operations permitted
- No access to PII / customer data
- Default: feature disabled until tenant explicitly enables

MVP recommendation: disable custom JS; allow only custom CSS.

### RULE-THM-007: Theme assets storage limits

Per tenant: max theme assets storage configurable per plan tier:
- Free: 100 MB
- Pro: 5 GB
- Enterprise: 50 GB

Exceeded → upload blocked.

### RULE-THM-008: Section count limits

Per template:
- Min sections: 1 (cannot save empty template)
- Max sections: 50 (performance protection)
- Per section: own `min_per_page`/`max_per_page` (e.g., max 1 hero per home)

### RULE-THM-009: Theme revision retention

Per theme: latest 50 revisions retained. Older auto-archived to cold storage.

Published revisions never deleted (rollback target).

### RULE-THM-010: Multi-store theme assignment

Each store has independent theme assignment. Same theme can be active on multiple stores; settings per store independent.

### RULE-THM-011: Theme uninstall blocked when active

`themes.status='active'` cannot be uninstalled. Must first switch store to different theme.

### RULE-THM-012: Locale support

Theme declares `supported_locales`. Storefront for locale not in list:
- Falls back to first supported locale
- Warning logged (admin sees in dashboard)

Themes should support all tenant's enabled_locales (per `23-i18n.md`).

### RULE-THM-013: RTL support

Theme `supports_rtl=true`: CSS uses logical properties (`margin-inline-start` instead of `margin-left`). Per `23-i18n.md` RTL Fáze 3+.

Themes without RTL support cannot be activated for RTL stores (cs/de/en don't care; ar/he do).

### RULE-THM-014: Mobile-first responsive

All themes must support:
- Mobile (320-640px)
- Tablet (640-1024px)
- Desktop (1024px+)

Validation enforces with Lighthouse mobile tests.

### RULE-THM-015: Performance budget

Per `DEC-PERF-001`:
- LCP < 1.8s on 4G
- INP < 150ms
- CLS < 0.05
- Total JS bundle < 200 KB gzipped (per page)
- Image lazy loading enforced
- Font preload required

### RULE-THM-016: Accessibility WCAG 2.2 AA

Validated via axe-core:
- All images have alt text
- Form fields have labels
- Color contrast 4.5:1 minimum
- Keyboard navigable
- Focus indicators visible
- Screen reader friendly (semantic HTML, ARIA where needed)
- No animations cause vestibular issues (respects `prefers-reduced-motion`)

Critical violations block publish.

### RULE-THM-017: SEO requirements

Theme must support:
- Page title + meta description
- Canonical URL
- Hreflang for multi-locale
- JSON-LD (Product, Organization, BreadcrumbList) — per `19-marketing-seo.md`
- Open Graph + Twitter Card
- Sitemap-friendly URLs
- Server-side rendering for crawlers

### RULE-THM-018: Theme settings backward compatibility

When theme version upgraded:
- Settings keys retained: values migrate
- Removed settings: stored in metadata for potential rollback
- New settings: defaults applied
- Renamed: migration script in theme package

### RULE-THM-019: Marketplace theme review

Themes published to marketplace go through platform review:
- Code review (no malicious patterns)
- A11y + perf scores meet thresholds
- License clear
- Manifest valid
- Demo URL accessible

Manual review by platform staff. Approved themes get `platform_approved=true`.

### RULE-THM-020: Theme licensing enforcement

- `oss_mit` / `oss_apache_2`: free, attribution required
- `commercial`: license key required; verified at install
- License key tied to tenant; cannot transfer

Per `28-developer-platform.md`.

### RULE-THM-021: Preview tokens secure

Preview URLs use signed JWT (HMAC):
- Token includes `revision_id`, `expires_at`, `tenant_id`
- Expires 24h
- Single-use option (revoked after first access)
- Cannot escalate beyond storefront read access

### RULE-THM-022: Custom domain CSP

Per-store CSP headers must allow theme's CDN domains. Tenant configures additional allowed domains via Storefront API.

### RULE-THM-023: Theme update propagation

When merchant updates theme version:
- New version installed alongside old
- Settings migrated
- Preview enabled before publish
- On publish: new version active
- Old version retained 30 days then auto-archived

### RULE-THM-024: Section caching

Sections rendered via Next.js Cache Components:
- Cached per (store_id, theme_revision_id, section_id, params_hash)
- Invalidated on revision publish OR section settings update
- Per `vercel:next-cache-components` patterns

### RULE-THM-025: Per-page section overrides

CMS pages (per `32-cms-content.md`) can override theme's template sections. Storage in `cms_pages.content_blocks` (JSONB section tree, same format as theme template).

### RULE-THM-026: AI design assistant (Fáze 3+)

AI Copilot can:
- Suggest color palettes based on brand mood
- Generate hero section copy
- Recommend section additions based on conversion goals
- A11y violation auto-fixes (suggest)

Detail per `33-ai-features.md`.

### RULE-THM-027: Theme analytics

Per theme: tracked via `20-analytics-reporting.md`:
- Page load times per template
- Section render counts
- Click-through on sections
- Conversion impact

Helps merchant decide A/B test variants.

### RULE-THM-028: Multi-currency display

Theme renders prices respecting customer's currency (per `23-i18n.md`). Symbol position via `currencies.symbol_position`. Format via `Intl.NumberFormat`.

### RULE-THM-029: Multi-locale rendering

Theme templates use translation keys (per `23-i18n.md`). Locale switcher in header. URL structure: path-based or domain-based (per `22-multistore-channels.md`).

### RULE-THM-030: GDPR — cookie banner integration

Theme provides slot for cookie banner. Default included; customizable per tenant. Banner shown before analytics fires (consent required) per `18-customer-management.md` consent rules.

---

## 9. REST API endpoints

### 9.1 Themes management

```
GET    /api/{date}/themes
POST   /api/{date}/themes:install                                                                                                            # from marketplace OR upload
GET    /api/{date}/themes/{id}
DELETE /api/{date}/themes/{id}                                                                                                                # uninstall
POST   /api/{date}/themes/{id}:activate-for-store                                                                                              # body: { store_id }
POST   /api/{date}/themes/{id}:deactivate
POST   /api/{date}/themes/{id}:update                                                                                                          # update version
GET    /api/{date}/themes/{id}/revisions
GET    /api/{date}/themes/{id}/revisions/{revision_id}
POST   /api/{date}/themes/{id}/revisions/{revision_id}:publish
POST   /api/{date}/themes/{id}/revisions/{revision_id}:archive
POST   /api/{date}/themes/{id}/revisions/{revision_id}:rollback-to                                                                              # restore as new published
GET    /api/{date}/themes/{id}/sections
GET    /api/{date}/themes/{id}/templates
GET    /api/{date}/themes/{id}/settings-schema
POST   /api/{date}/themes/{id}:validate                                                                                                          # run validation
GET    /api/{date}/themes/{id}/validation-runs
GET    /api/{date}/themes/{id}/preview-url                                                                                                       # signed URL
```

### 9.2 Theme customization (editor backend)

```
GET    /api/{date}/stores/{store_id}/theme-settings
PATCH  /api/{date}/stores/{store_id}/theme-settings                                                                                              # bulk update
POST   /api/{date}/stores/{store_id}/theme-settings:save-draft
GET    /api/{date}/stores/{store_id}/theme-assets
POST   /api/{date}/stores/{store_id}/theme-assets:upload
DELETE /api/{date}/stores/{store_id}/theme-assets/{id}
GET    /api/{date}/stores/{store_id}/templates
PATCH  /api/{date}/stores/{store_id}/templates/{template_kind}                                                                                     # override section tree
DELETE /api/{date}/stores/{store_id}/templates/{template_kind}                                                                                     # revert to theme default
```

### 9.3 Theme marketplace

```
GET    /api/{date}/theme-marketplace/listings
GET    /api/{date}/theme-marketplace/listings/{id}
POST   /api/{date}/theme-marketplace/listings/{id}:install                                                                                          # install to tenant
GET    /api/{date}/theme-marketplace/listings:search?q=...
GET    /api/{date}/theme-marketplace/categories
```

### 9.4 A/B tests (Fáze 2+)

```
GET    /api/{date}/theme-ab-tests
POST   /api/{date}/theme-ab-tests
GET    /api/{date}/theme-ab-tests/{id}
PATCH  /api/{date}/theme-ab-tests/{id}
POST   /api/{date}/theme-ab-tests/{id}:start
POST   /api/{date}/theme-ab-tests/{id}:pause
POST   /api/{date}/theme-ab-tests/{id}:complete
GET    /api/{date}/theme-ab-tests/{id}/results
```

### 9.5 Storefront API (consumed by themes)

```
GET    /api/{date}/storefront/store/settings                                                                                                          # store + theme settings
GET    /api/{date}/storefront/store/templates/{template_kind}                                                                                          # rendered template tree (server-rendered theme reads these)
GET    /api/{date}/storefront/theme/css-variables                                                                                                       # CSS variable values
GET    /api/{date}/storefront/theme/translations/{locale}                                                                                                # UI strings
```

### 9.6 Example: Install theme from marketplace

```http
POST /api/2026-05-20/theme-marketplace/listings/lst_aB:install HTTP/1.1
Authorization: Bearer ...

{
  "version": "1.2.3",
  "auto_activate_for_store_id": "str_main"
}
```

```jsonc
HTTP/1.1 202 Accepted

{
  "data": {
    "theme_id": "thm_aB",
    "status": "installing",
    "estimated_seconds": 30
  }
}
```

### 9.7 Example: Save theme settings

```http
PATCH /api/2026-05-20/stores/str_main/theme-settings HTTP/1.1
Content-Type: application/json

{
  "settings": {
    "color_primary": "#FF6B35",
    "color_background": "#FAFAFA",
    "font_heading": "Playfair Display",
    "header_sticky": true,
    "container_max_width": "1440px"
  }
}
```

```jsonc
HTTP/1.1 200 OK

{
  "data": {
    "updated_settings_count": 5,
    "draft_revision_id": "rev_aB"
  }
}
```

### 9.8 Example: Publish revision

```http
POST /api/2026-05-20/themes/thm_aB/revisions/rev_aB:publish HTTP/1.1

{
  "notes": "Updated brand colors for spring campaign"
}
```

```jsonc
HTTP/1.1 200 OK

{
  "data": {
    "revision_id": "rev_aB",
    "kind": "published",
    "published_at": "2026-05-20T14:00:00Z",
    "previous_revision_archived": "rev_xY",
    "validation_passed": true
  }
}
```

### 9.9 Example: Validation results

```http
GET /api/2026-05-20/themes/thm_aB/validation-runs HTTP/1.1
```

```jsonc
HTTP/1.1 200 OK

{
  "data": [
    {
      "id": "val_aB",
      "ran_at": "2026-05-20T13:55:00Z",
      "accessibility_score": 92,
      "performance_score": 88,
      "lighthouse_lcp_ms": 1450,
      "lighthouse_inp_ms": 120,
      "lighthouse_cls": 0.02,
      "passed": true,
      "a11y_violations": [
        {
          "rule": "color-contrast",
          "severity": "warning",
          "element": ".btn-secondary",
          "description": "Insufficient contrast 3.2:1 (needs 4.5:1)"
        }
      ],
      "blocking_issues": []
    }
  ]
}
```

---

## 10. GraphQL schema

```graphql
type Theme implements Node & Timestamped {
  id: ID!
  pubId: String!
  packageName: String!
  packageVersion: String!
  name: String!
  description: String
  author: String
  authorUrl: String
  sourceKind: ThemeSourceKind!
  marketplaceListing: ThemeMarketplaceListing
  status: ThemeStatus!
  publishedRevision: ThemeRevision
  draftRevision: ThemeRevision
  revisions: [ThemeRevision!]!
  sections: [ThemeSection!]!
  templates: [ThemeTemplate!]!
  settingsSchema: ThemeSettingsSchema
  thumbnail: Media
  previewUrl: String
  licenseKind: ThemeLicenseKind
  accessibilityScore: Int
  performanceScore: Int
  passedValidation: Boolean!
  validationErrors: JSON
  installedAt: DateTime!
  installedBy: User
}

enum ThemeStatus { INSTALLING INSTALLED ACTIVE DISABLED FAILED UNINSTALLING }
enum ThemeSourceKind { BUNDLED MARKETPLACE CUSTOM_UPLOAD GIT_CLONE }
enum ThemeLicenseKind { OSS_MIT OSS_APACHE_2 COMMERCIAL CUSTOM }

type ThemeRevision implements Node {
  id: ID!
  theme: Theme!
  revisionNumber: Int!
  kind: ThemeRevisionKind!
  settings: JSON!
  templates: JSON!
  customCss: String
  accessibilityScore: Int
  performanceScore: Int
  passedValidation: Boolean!
  createdAt: DateTime!
  createdBy: User
  publishedAt: DateTime
  archivedAt: DateTime
  notes: String
}

enum ThemeRevisionKind { DRAFT PUBLISHED ARCHIVED }

type ThemeSection {
  id: ID!
  theme: Theme!
  sectionKind: String!
  name: String!
  description: String
  category: String
  previewImage: Media
  settingsSchema: JSON!
  defaultSettings: JSON
  allowedTemplateKinds: [String!]
  isUnique: Boolean!
  isStatic: Boolean!
}

type ThemeTemplate {
  id: ID!
  theme: Theme!
  templateKind: String!
  templateVariant: String
  name: String!
  description: String
  defaultSectionTree: JSON!
  layoutKind: String!
}

type ThemeSettingsSchema {
  schemaVersion: String!
  schemaDefinition: JSON!
}

type ThemeAsset {
  id: ID!
  store: Store!
  theme: Theme!
  assetKind: ThemeAssetKind!
  filename: String
  storageUrl: String!
  mimeType: String
  bytes: Int!
  uploadedAt: DateTime!
}

enum ThemeAssetKind { LOGO FAVICON OG_IMAGE CUSTOM_IMAGE CUSTOM_CSS CUSTOM_JS FONT_FILE SECTION_IMAGE }

type ThemeValidationRun {
  id: ID!
  theme: Theme!
  revision: ThemeRevision
  accessibilityScore: Int
  performanceScore: Int
  lighthouseLcpMs: Int
  lighthouseInpMs: Int
  lighthouseCls: Float
  a11yViolations: JSON
  performanceMetrics: JSON
  lintWarnings: JSON
  passed: Boolean!
  blockingIssues: JSON
  startedAt: DateTime!
  completedAt: DateTime
  durationMs: Int
}

type ThemeMarketplaceListing implements Node {
  id: ID!
  packageName: String!
  displayName: String!
  description: String
  author: String
  latestVersion: String!
  availableVersions: [String!]!
  licenseKind: String
  priceKind: ThemePriceKind!
  priceAmount: Money
  thumbnailUrl: String
  previewImages: JSON
  demoUrl: String
  installCount: Int!
  averageRating: Float
  ratingCount: Int!
  accessibilityScore: Int
  performanceScore: Int
  platformApproved: Boolean!
  publishedAt: DateTime!
}

enum ThemePriceKind { FREE ONE_TIME SUBSCRIPTION OPEN_SOURCE }

extend type Query {
  themes: [Theme!]! @auth(requires: PERM_THEME_VIEW)
  theme(id: ID, pubId: String): Theme @auth(requires: PERM_THEME_VIEW)
  themeMarketplace(filter: ThemeMarketplaceFilter): [ThemeMarketplaceListing!]!
  themeMarketplaceListing(id: ID, packageName: String): ThemeMarketplaceListing

  storeThemeSettings(storeId: ID!): JSON!
  storeThemeAssets(storeId: ID!): [ThemeAsset!]!

  currentStoreTheme: Theme!                                                                                                                            # for storefront/theme editor
  currentStoreThemeSettings: JSON!
  currentStoreTemplate(templateKind: String!): JSON!
}

extend type Mutation {
  installTheme(input: InstallThemeInput!): Theme! @auth(requires: PERM_THEME_INSTALL)
  uninstallTheme(id: ID!): DeletePayload! @auth(requires: PERM_THEME_INSTALL)
  activateThemeForStore(themeId: ID!, storeId: ID!): Store! @auth(requires: PERM_THEME_PUBLISH)
  updateThemeVersion(id: ID!, newVersion: String!): Theme! @auth(requires: PERM_THEME_INSTALL)

  saveThemeRevisionDraft(themeId: ID!, input: ThemeRevisionInput!): ThemeRevision! @auth(requires: PERM_THEME_CUSTOMIZE)
  publishThemeRevision(revisionId: ID!, notes: String): ThemeRevision! @auth(requires: PERM_THEME_PUBLISH)
  rollbackToRevision(revisionId: ID!): ThemeRevision! @auth(requires: PERM_THEME_PUBLISH)
  archiveThemeRevision(revisionId: ID!): ThemeRevision! @auth(requires: PERM_THEME_PUBLISH)

  updateStoreThemeSettings(storeId: ID!, settings: JSON!): MutationPayload! @auth(requires: PERM_THEME_CUSTOMIZE)
  uploadThemeAsset(storeId: ID!, input: ThemeAssetUploadInput!): ThemeAsset! @auth(requires: PERM_THEME_CUSTOMIZE)
  deleteThemeAsset(id: ID!): DeletePayload! @auth(requires: PERM_THEME_CUSTOMIZE)

  validateTheme(themeId: ID!): ThemeValidationRun! @auth(requires: PERM_THEME_PUBLISH)
  generateThemePreviewUrl(revisionId: ID!): String! @auth(requires: PERM_THEME_CUSTOMIZE)

  createThemeAbTest(input: ThemeAbTestInput!): ThemeAbTest! @auth(requires: PERM_THEME_AB_TEST)
  startThemeAbTest(id: ID!): ThemeAbTest! @auth(requires: PERM_THEME_AB_TEST)
  completeThemeAbTest(id: ID!, winningRevisionId: ID!): ThemeAbTest! @auth(requires: PERM_THEME_AB_TEST)
}
```

---

## 11. Events

| Build-spec ID | Wire | Payload |
|---|---|---|
| `EVENT-THEME-INSTALLING` | `theme.installing` | `{ theme }` |
| `EVENT-THEME-INSTALLED` | `theme.installed` | `{ theme }` |
| `EVENT-THEME-INSTALL-FAILED` | `theme.install_failed` | `{ theme, reason }` |
| `EVENT-THEME-ACTIVATED` | `theme.activated_for_store` | `{ theme, store }` |
| `EVENT-THEME-DEACTIVATED` | `theme.deactivated` | `{ theme }` |
| `EVENT-THEME-UNINSTALLED` | `theme.uninstalled` | `{ theme_id }` |
| `EVENT-THEME-VERSION-UPDATED` | `theme.version_updated` | `{ theme, previous_version, new_version }` |
| `EVENT-THEME-REVISION-CREATED` | `theme.revision_created` | `{ revision }` |
| `EVENT-THEME-REVISION-PUBLISHED` | `theme.revision_published` | `{ revision, previous_published_id }` |
| `EVENT-THEME-REVISION-ROLLBACK` | `theme.revision_rollback` | `{ revision }` |
| `EVENT-THEME-SETTINGS-UPDATED` | `theme.settings_updated` | `{ store, theme, changes }` |
| `EVENT-THEME-ASSET-UPLOADED` | `theme.asset_uploaded` | `{ asset }` |
| `EVENT-THEME-VALIDATION-COMPLETED` | `theme.validation_completed` | `{ run }` |
| `EVENT-THEME-VALIDATION-FAILED` | `theme.validation_failed` | `{ run, blocking_issues }` |
| `EVENT-THEME-AB-TEST-STARTED` | `theme.ab_test_started` | `{ test }` |
| `EVENT-THEME-AB-TEST-COMPLETED` | `theme.ab_test_completed` | `{ test, winning_variant }` |
| `EVENT-MARKETPLACE-THEME-INSTALLED` | `marketplace.theme_installed` | `{ listing, tenant }` (for marketplace analytics) |

**Konzumenti:**
- CDN cache invalidator
- Storefront cache invalidation
- Marketplace install counter
- Analytics (theme performance)
- Webhook delivery

---

## 12. Background jobs

| Job | Trigger | Queue | Frequency |
|---|---|---|---|
| `JOB-INSTALL-THEME` | install request | `themes` | On-demand |
| `JOB-UNINSTALL-THEME` | uninstall request | `themes` | On-demand |
| `JOB-VALIDATE-THEME` | manual trigger or auto on publish | `validation` | On-demand |
| `JOB-VALIDATE-THEME-ACCESSIBILITY` | EVENT-THEME-REVISION-CREATED | `validation` | On-demand |
| `JOB-VALIDATE-THEME-PERFORMANCE` | EVENT-THEME-REVISION-CREATED | `validation` | On-demand |
| `JOB-VALIDATE-THEME-LINT` | EVENT-THEME-REVISION-CREATED | `validation` | On-demand |
| `JOB-INVALIDATE-CDN-CACHE` | EVENT-THEME-REVISION-PUBLISHED | `cache` | On-demand |
| `JOB-WARM-STOREFRONT-CACHE-AFTER-PUBLISH` | EVENT-THEME-REVISION-PUBLISHED | `cache-warm` | On-demand |
| `JOB-ARCHIVE-OLD-REVISIONS` | scheduled | `maintenance` | Daily |
| `JOB-SYNC-THEME-MARKETPLACE-CATALOG` | scheduled | `marketplace` | Hourly |
| `JOB-INCREMENT-MARKETPLACE-INSTALL-COUNT` | EVENT-MARKETPLACE-THEME-INSTALLED | `marketplace` | On-demand |
| `JOB-DETECT-THEME-PERFORMANCE-REGRESSION` | scheduled | `monitoring` | Daily |
| `JOB-GENERATE-THEME-PREVIEW-SCREENSHOTS` | EVENT-THEME-INSTALLED, EVENT-THEME-REVISION-PUBLISHED | `screenshots` | On-demand |
| `JOB-EVALUATE-AB-TEST-SIGNIFICANCE` | scheduled per running test | `ab-tests` | Daily |
| `JOB-DETECT-A11Y-REGRESSIONS-DAILY` | scheduled | `monitoring` | Daily |

---

## 13. UI/UX flows

### FLOW-THM-001: Install theme from marketplace

```
[Admin → Themes → Browse marketplace]
   - Grid of available themes with thumbnails, ratings, prices
        ↓
   click theme
        ↓
[Theme detail page]
   - Screenshots
   - Demo URL link
   - Reviews
   - Author info
   - Pricing
   - "Install" button
        ↓
   click Install
        ↓
[Confirmation modal]
   - Choose store(s) to assign (or install without activating)
   - Confirm
        ↓
[POST /theme-marketplace/listings/{id}:install]
   - Status: installing → installed
   - Toast: "Theme installed successfully"
   - Auto-redirect to customizer
```

### FLOW-THM-002: Customize theme

```
[Admin → Themes → {theme} → Customize]
        ↓
[Theme customizer page]
   - Left: template + section tree
   - Center: live preview (iframe with draft revision)
   - Right: section settings + theme settings (collapsible)
        ↓
   merchant drags hero section → drops into home template
        ↓
[Settings panel opens for hero]
   - Heading: "Welcome to our store"
   - Background image: [upload]
   - CTA button: "Shop now" → /collections/all
        ↓
   merchant saves
        ↓
[POST /stores/{id}/theme-settings:save-draft]
   - New revision created (kind='draft')
   - Live preview updates
        ↓
[Validation runs in background]
   - Score badges shown (a11y: 92, perf: 88)
        ↓
   merchant clicks "Publish"
        ↓
[Confirmation modal]
   - "Publish changes to live site?"
   - Optional release notes
        ↓
[POST /themes/{id}/revisions/{id}:publish]
   - Revision becomes published
   - CDN cache invalidated
   - Live site updated
   - Email to merchant: "Your site has been updated"
```

### FLOW-THM-003: Preview before publish

```
[Customizer → "Preview" button]
        ↓
[Modal: "Share preview link?"]
   - Generate preview URL (signed, 24h expiry)
   - Copy to clipboard
        ↓
   merchant sends to stakeholder via Slack/email
        ↓
[Stakeholder opens link]
   - Storefront renders with draft revision
   - Banner: "Preview mode — not live"
   - Read-only (no add-to-cart etc.)
        ↓
   stakeholder approves
        ↓
   merchant returns to customizer → publishes
```

### FLOW-THM-004: Rollback to prior version

```
[Themes → {theme} → Revisions tab]
   - List of past revisions with timestamps + notes
        ↓
   click "Restore" on revision from 3 days ago
        ↓
[Confirmation modal]
   - "Restore revision #12 (published 2026-05-17)?"
   - Current revision will be archived
        ↓
[POST /themes/{id}/revisions/{id}:rollback-to]
   - New revision created with old content
   - Marked published
   - Live site reverts
   - Audit log entry
```

### FLOW-THM-005: A/B test (Fáze 2+)

```
[Customizer → "Create A/B test"]
        ↓
[A/B test wizard]
   - Name + hypothesis
   - Control: current published revision
   - Variant: select draft revision OR clone+edit
   - Traffic split: 50/50
   - Primary metric: conversion_rate
   - Min sample size: 10000 visitors
        ↓
[POST /theme-ab-tests]
   - Status: draft
        ↓
   merchant clicks "Start"
        ↓
[Storefront randomly assigns visitors to variants]
   - Cookie-based assignment, persistent per session
   - Analytics tagged with variant ID
        ↓
   ... runs for 2 weeks ...
        ↓
[Results page]
   - Variant B has 4.3% higher conversion (p=0.024)
   - Winner: Variant B
   - "Promote winner" button
        ↓
[Winner promoted to published; control archived]
```

### FLOW-THM-006: Validation feedback

```
[Customizer save → validation auto-runs]
        ↓
[Validation badge: 78% performance (warning)]
   - Hover shows details
        ↓
   merchant clicks "View report"
        ↓
[Validation report modal]
   - Performance: 78/100
     - LCP: 2.1s (target < 1.8s) — Hero image not optimized
     - INP: 145ms ✓
     - CLS: 0.04 ✓
   - A11y: 92/100
     - Warning: btn-secondary color contrast 3.2:1
   - Recommendations:
     • Compress hero background (current 2.4 MB → suggest < 300 KB)
     • Add `width`/`height` to product images
     • Increase btn-secondary contrast
        ↓
   merchant fixes issues + re-saves
```

---

## 14. Edge cases & error handling

| Scenario | Behavior | Code |
|---|---|---|
| Install theme incompatible with platform version | Reject | `THEME_INCOMPATIBLE`, 422 |
| Install theme with invalid manifest | Reject | `INVALID_THEME_MANIFEST`, 422 |
| Install fails (download error) | Status='failed'; retry available | (handled) |
| Activate theme not installed | Reject | `THEME_NOT_INSTALLED`, 422 |
| Activate theme with failed validation | Reject (force option requires special permission) | `THEME_VALIDATION_FAILED`, 422 |
| Uninstall active theme | Reject (deactivate first) | `THEME_IS_ACTIVE`, 422 |
| Publish revision with critical a11y violations | Reject | `A11Y_VIOLATIONS_BLOCKING`, 422 |
| Publish revision with poor performance score | Reject | `PERFORMANCE_BELOW_THRESHOLD`, 422 |
| Save draft with invalid section settings | Reject with field errors | `INVALID_SECTION_SETTINGS`, 422 |
| Concurrent edits | Optimistic lock (version) | `RESOURCE_VERSION_MISMATCH`, 412 |
| Preview URL expired | 410 Gone | `PREVIEW_TOKEN_EXPIRED`, 410 |
| Asset upload exceeds storage quota | Reject | `STORAGE_QUOTA_EXCEEDED`, 413 |
| Custom CSS contains malicious patterns (`eval`, etc.) | Sanitize or reject | `UNSAFE_CSS`, 422 |
| Section count > max for template | Reject add | `SECTION_LIMIT_EXCEEDED`, 422 |
| Theme settings invalid against schema | Reject with field errors | `INVALID_SETTINGS`, 422 |
| Asset file too large (>10MB single file) | Reject | `FILE_TOO_LARGE`, 413 |
| Theme update breaks settings (removed key) | Migration script runs; missing settings get defaults | (handled) |
| Marketplace theme withdrawn after install | Existing installs continue; new installs blocked | (handled) |
| Performance regression detected after publish | Admin alerted; rollback option suggested | (handled) |
| Revision count > 50 per theme | Auto-archive oldest published | (handled) |
| Theme manifest schema mismatch (theme version older than schema) | Migration to current schema; warning logged | (handled) |
| A/B test with too few visitors | Don't compute significance; warn merchant | (handled) |
| Custom font upload missing license info | Warn; merchant must confirm license | (handled) |
| Theme references deleted media | Validation flags; merchant notified | (handled) |

---

## 15. Performance & accessibility

### 15.1 Performance budgets (enforced)

Per `DEC-PERF-001`:

| Metric | Target | Block publish if |
|---|---|---|
| LCP (Largest Contentful Paint) | < 1.8s | > 2.5s |
| INP (Interaction to Next Paint) | < 150ms | > 250ms |
| CLS (Cumulative Layout Shift) | < 0.05 | > 0.15 |
| TTFB (Time to First Byte) | < 400ms | > 800ms |
| FCP (First Contentful Paint) | < 1.0s | > 1.5s |
| Total page weight | < 1.5 MB | > 3 MB |
| JS bundle (gzipped) | < 200 KB | > 400 KB |
| CSS (gzipped) | < 50 KB | > 100 KB |
| Image weight | < 1 MB | > 2 MB |
| Fonts (total) | < 200 KB | > 400 KB |

Validation: Lighthouse mobile run on 4G simulation.

### 15.2 Accessibility — WCAG 2.2 AA

Validated via axe-core:

| Rule | Severity | Block publish if |
|---|---|---|
| color-contrast (4.5:1 normal, 3:1 large) | critical | violations > 0 |
| html-has-lang | critical | missing |
| image-alt | critical | violations > 0 |
| label (form fields) | critical | violations > 0 |
| link-name | critical | violations > 0 |
| button-name | critical | violations > 0 |
| heading-order | warning | (non-blocking) |
| landmark-one-main | warning | (non-blocking) |
| keyboard navigation | manual | required |

### 15.3 Optimization techniques

- **Server-side rendering** (Next.js 16 RSC)
- **Cache Components** for static sections
- **Image optimization** (Next.js Image with WebP/AVIF)
- **Font preload** in `<head>`
- **Code splitting** per route
- **Lazy loading** for below-fold content
- **CDN edge caching** (Cloudflare)
- **Critical CSS inlined**
- **Service worker** for repeat visits (PWA-lite)

### 15.4 Monitoring

- Real User Monitoring (RUM) via Web Vitals API
- Daily Lighthouse audits per template
- Performance regression detection
- Per-theme Core Web Vitals dashboard

---

## 16. Security

### 16.1 Permissions

```
PERM-THEME-VIEW
PERM-THEME-INSTALL
PERM-THEME-CUSTOMIZE
PERM-THEME-PUBLISH
PERM-THEME-DEVELOP
PERM-THEME-AB-TEST
PERM-THEME-AUDIT-VIEW
PERM-THEME-MARKETPLACE-APPROVE
PERM-THEME-FORCE-PUBLISH                                                                                                                                  # bypass validation; rare
```

### 16.2 Theme isolation

Themes can't access other tenants' data. Sandboxed:
- Themes receive context object (current store, theme settings, current locale, current customer) — read-only
- Cannot make arbitrary API calls
- Custom JS sandboxed (Fáze 2+)

### 16.3 Custom CSS sanitization

- Strip `@import` of arbitrary URLs (allowlist platform CDN)
- Strip `url()` to external resources
- Reject `expression()` (legacy IE)
- Block CSP-violating patterns

### 16.4 Marketplace theme review

Themes uploaded to marketplace reviewed by platform staff:
- Static analysis for malicious patterns
- A11y + perf scores meet thresholds
- Manual code review for paid themes
- License clear

### 16.5 Preview tokens

Signed JWTs (HMAC):
- Expire 24h
- Scoped to revision_id
- Single-use option

### 16.6 Audit

100% audit on:
- Theme install / uninstall
- Theme activation per store
- Revision publishing
- Custom CSS / JS changes
- Force publish (bypass validation)

### 16.7 CSP

Per-store CSP headers strict by default. Tenant can extend allowed domains via Storefront API for theme assets.

---

## 17. Testing

### 17.1 Unit

```
TEST-UNIT-THM-001  ThemeManifestValidator
TEST-UNIT-THM-002  SectionSettingsValidator
TEST-UNIT-THM-003  ThemeSettingsBindingToCss (settings → CSS variables)
TEST-UNIT-THM-004  RevisionStateMachine
TEST-UNIT-THM-005  SectionTreeManipulator (add/remove/reorder)
TEST-UNIT-THM-006  PreviewTokenSigner
TEST-UNIT-THM-007  ThemeMigration (settings migration on version update)
```

### 17.2 Integration

```
TEST-INT-THM-001  Install theme from marketplace
TEST-INT-THM-002  Activate theme for store
TEST-INT-THM-003  Save draft revision → preview renders
TEST-INT-THM-004  Validation blocks publish on critical violations
TEST-INT-THM-005  Publish revision → CDN cache invalidated
TEST-INT-THM-006  Rollback to prior revision
TEST-INT-THM-007  Multi-store: same theme, different settings
TEST-INT-THM-008  Theme update version + settings migration
TEST-INT-THM-009  Custom asset upload + serve
TEST-INT-THM-010  Uninstall blocked when active
TEST-INT-THM-011  Theme A/B test traffic split
TEST-INT-THM-012  Concurrent edits → optimistic lock
TEST-INT-THM-013  Preview URL expiry
TEST-INT-THM-014  Marketplace install increments counter
```

### 17.3 E2E

```
TEST-E2E-THM-001  Merchant installs theme + customizes + publishes
TEST-E2E-THM-002  Storefront renders with custom theme settings
TEST-E2E-THM-003  Section reorder reflected in storefront
TEST-E2E-THM-004  Mobile responsive at all breakpoints
TEST-E2E-THM-005  Accessibility audit passes (axe-core)
TEST-E2E-THM-006  Core Web Vitals targets met
TEST-E2E-THM-007  Multi-locale rendering
TEST-E2E-THM-008  Dark mode toggle
```

### 17.4 Validation tests

```
TEST-VAL-THM-001  Lighthouse mobile run: LCP < 1.8s
TEST-VAL-THM-002  axe-core: 0 critical violations
TEST-VAL-THM-003  Responsive: all breakpoints pass visual diff
TEST-VAL-THM-004  Browser compatibility: Chrome, Safari, Firefox latest
TEST-VAL-THM-005  Screen reader: NVDA + VoiceOver smoke test
```

### 17.5 Load

```
TEST-LOAD-THM-001  10k concurrent storefront page loads → p95 < 200ms
TEST-LOAD-THM-002  Theme switching: 1000 stores update theme in parallel
```

---

## 18. Implementation checklist

### Backend
- [ ] **[S]** Drizzle schema `packages/db/src/schema/themes/*.ts`
- [ ] **[S]** Migrace `20260609_001_create_theme_tables.sql`
- [ ] **[L]** `ThemeInstallationService` — install + uninstall flow
- [ ] **[M]** `ThemeRevisionService` — save draft, publish, rollback
- [ ] **[M]** `ThemeSettingsService` — per-store settings management
- [ ] **[M]** `ThemeAssetService` — asset upload + storage
- [ ] **[L]** `ThemeValidationService` — a11y + performance + lint runs
- [ ] **[M]** `ThemePreviewService` — signed token generation
- [ ] **[M]** `ThemeMarketplaceService` — listings + install integration
- [ ] **[M]** `ThemeAbTestService` (Fáze 2+)
- [ ] **[M]** REST endpoints per §9
- [ ] **[M]** GraphQL types + resolvers
- [ ] **[S]** Storefront API for theme rendering

### Theme bundled default
- [ ] **[XL]** Default theme implementation (Next.js 16 App Router)
- [ ] **[L]** Page templates (home, product, collection, search, cart, account, blog, error)
- [ ] **[L]** Section components (~20 sections)
- [ ] **[M]** Design tokens CSS
- [ ] **[M]** Settings schema
- [ ] **[M]** Multi-locale support
- [ ] **[S]** Dark mode toggle
- [ ] **[S]** Responsive layouts
- [ ] **[M]** A11y compliance throughout
- [ ] **[M]** Performance optimization (Lighthouse 90+)

### Background jobs
- [ ] **[L]** JOB-INSTALL-THEME, JOB-UNINSTALL-THEME
- [ ] **[L]** JOB-VALIDATE-THEME + sub-jobs (a11y, performance, lint)
- [ ] **[M]** JOB-INVALIDATE-CDN-CACHE
- [ ] **[S]** JOB-WARM-STOREFRONT-CACHE-AFTER-PUBLISH
- [ ] **[S]** JOB-ARCHIVE-OLD-REVISIONS
- [ ] **[M]** JOB-SYNC-THEME-MARKETPLACE-CATALOG
- [ ] **[S]** JOB-INCREMENT-MARKETPLACE-INSTALL-COUNT
- [ ] **[M]** JOB-DETECT-THEME-PERFORMANCE-REGRESSION
- [ ] **[M]** JOB-GENERATE-THEME-PREVIEW-SCREENSHOTS
- [ ] **[M]** JOB-EVALUATE-AB-TEST-SIGNIFICANCE (Fáze 2+)
- [ ] **[S]** JOB-DETECT-A11Y-REGRESSIONS-DAILY

### Frontend — Admin
- [ ] **[L]** Themes list + install flow
- [ ] **[L]** Theme marketplace browse
- [ ] **[XL]** Visual theme customizer (template + sections + settings + preview)
- [ ] **[M]** Revision history + rollback UI
- [ ] **[M]** Validation report viewer
- [ ] **[M]** Theme A/B test wizard (Fáze 2+)
- [ ] **[M]** Asset upload + management
- [ ] **[S]** Theme analytics dashboard

### Tests
- [ ] **[M]** Per §17 + validation tests (axe-core, Lighthouse)

### Docs
- [ ] **[M]** "Customizing your storefront theme" merchant guide
- [ ] **[M]** "Creating themes" theme developer guide
- [ ] **[L]** "Theme architecture reference" developer doc
- [ ] **[M]** "Accessibility checklist for themes" guide
- [ ] **[M]** "Performance optimization guide for themes"
- [ ] **[S]** "Headless storefront with Storefront API" guide
- [ ] **[S]** Customer-facing: "What is a theme?" help article

---

## 19. Open questions

### Q-THM-001: Theme code editor (in-browser)
**Otázka:** VS Code-style in-browser editor for developers customizing theme code?

**Status:** Fáze 2+ feature. MVP: JSON settings editor + section drag-drop only.

### Q-THM-002: Theme inheritance / parent themes
**Otázka:** Child themes inherit from parent (WordPress-style)?

**Status:** Fáze 3+ feature. Complexity trade-off.

### Q-THM-003: Theme bundling at edge
**Otázka:** Ship themes as Edge Workers for ultra-low latency?

**Status:** Fáze 3+ optimization. MVP: standard SSR.

### Q-THM-004: Visual page builder for non-merchants
**Otázka:** Customer-facing customization (gift configurator UI built on theme system)?

**Status:** Out of scope. Customer customization handled via product variants.

### Q-THM-005: Theme marketplace revenue share
**Otázka:** Platform takes % of paid theme sales? Same as plugin marketplace?

**Status:** Per `28-developer-platform.md` plugin marketplace rules. 80/20 split standard.

### Q-THM-006: Per-device theme variants
**Otázka:** Separate mobile/desktop themes (instead of responsive)?

**Status:** Out of scope. Responsive design preferred.

### Q-THM-007: AI design assistant integration
**Otázka:** AI suggests color palettes, generates section copy, recommends layouts?

**Status:** Fáze 3+ in `33-ai-features.md`.

### Q-THM-008: Theme licensing protection (anti-piracy)
**Otázka:** Commercial themes have license keys; how to enforce?

**Status:** Marketplace install validates; license key checked on activation. Detail in `28-developer-platform.md`.

### Q-THM-009: Real-time collaborative editing
**Otázka:** Multiple admins customize theme simultaneously (Figma-style)?

**Status:** Out of scope MVP. Optimistic locking sufficient.

### Q-THM-010: Theme analytics deep dive
**Otázka:** Per-section conversion attribution?

**Status:** Fáze 2+ via `20-analytics-reporting.md` extensions.

---

## 📅 Změny

| Datum | Změna |
|---|---|
| 2026-05-20 | Initial — Themes & Storefront domain. Bundled Next.js 16 default theme, section-based editing, theme marketplace, design tokens, accessibility WCAG 2.2 AA mandatory, Core Web Vitals enforced. |

---

**Konec Themes & Storefront.**

➡️ Pokračovat na: [`27-admin-backoffice.md`](27-admin-backoffice.md)
