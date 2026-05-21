# 32 – CMS & CONTENT

> **Doména:** Content Management System — CMS stránky (about, contact, custom landing), blog (posty, kategorie, autoři), reusable content blocks (sekce použitelné v tématech), navigation menus, URL redirects, custom forms (contact, newsletter, gated download), media library, scheduled publishing, content versioning + drafts, multi-language content, per-page SEO, knowledge base + FAQ, approval workflows. Renderuje se přes theme systém z `26`.

**Datum:** 2026-05-20
**Verze:** 1.0
**Status:** 🟡 DESIGN
**Reference:** [03 §15](03-data-models-master.md#15-content--cms) · [26-themes-storefront.md](26-themes-storefront.md) · [19-marketing-seo.md](19-marketing-seo.md) · [23-i18n.md](23-i18n.md)

---

## 📑 Obsah

0. [Domain overview](#0-domain-overview)
1. [References](#1-references)
2. [Personas](#2-personas)
3. [Data models](#3-data-models)
4. [Content blocks system](#4-content-blocks-system)
5. [Editorial workflow](#5-editorial-workflow)
6. [State machines](#6-state-machines)
7. [Business rules](#7-business-rules)
8. [REST API endpoints](#8-rest-api-endpoints)
9. [GraphQL schema](#9-graphql-schema)
10. [Events](#10-events)
11. [Background jobs](#11-background-jobs)
12. [UI/UX flows](#12-uiux-flows)
13. [Edge cases & error handling](#13-edge-cases--error-handling)
14. [Performance, security, testing](#14-performance-security-testing)
15. [Implementation checklist](#15-implementation-checklist)
16. [Open questions](#16-open-questions)

---

## 0. Domain overview

### 0.1 Co tato doména **je**

- **CMS pages** — libovolné stránky kromě produktových / kategorií / standardních storefront route: about, contact, terms, privacy, custom landing pages, kampaňové microsity
- **Blog** — periodické články, kategorizace + tagy, autoři, RSS, schedule publish
- **Content blocks** — reusable sekce (hero, testimonial, banner, FAQ list) — místo jednorázových inline v page, lze definovat globálně a reusnout
- **Navigation menus** — header menu, footer menu, side menu, mega menu (Fáze 2+); per-locale + per-store
- **URL redirects** — 301/302, regex podporovaný, importable from CSV (after migrace from Shopify/WooCommerce)
- **Custom forms** — contact, newsletter signup (cross-ref `19`), gated downloads, RFQ (cross-ref `21 §B2B`), bid-on-quote
- **Media library** — sdílená napříč product / blog / pages; tagging, folder, search, transformace
- **Scheduled publishing** — content publikne v daný čas (campaign launch)
- **Content versioning** — historie změn, rollback, draft vs published, preview ne-published
- **Multi-language content** — page + blog post translations per `23-i18n.md`
- **Per-page SEO** — title/description/og/canonical/JSON-LD (per `19`)
- **Knowledge base** — strukturované help articles, vyhledávatelné, kategorizované
- **FAQ system** — question-answer páry, accordion render, kategorie, schema.org FAQ markup
- **Approval workflows** — content review před publish (Fáze 2 enterprise)
- **AI assistance** — generate copy, suggest improvements (cross-ref `33`)

### 0.2 Co tato doména **NENÍ**

- ❌ Theme systém (jak se renderuje) — `26-themes-storefront.md`
- ❌ Marketing automation (emaily, kampaně) — `19-marketing-seo.md`
- ❌ Email content templating (kromě transactional fallback) — `19`
- ❌ Product descriptions content (oddělené pole na produktu) — `06-catalog-pim.md`
- ❌ Order confirmation, receipt content — `16-order-management.md` + `19`
- ❌ Customer-generated content moderation primary (reviews) — `25-marketplace.md` + custom
- ❌ Asset / media generic infrastructure (S3 storage) — implicitní z `31-operations.md`
- ❌ Search ranking of content — `08-search-filtering.md` (storefront search indexuje CMS content)
- ❌ Translation engine (DeepL integration) — `29-integrations.md` connector + `23-i18n.md` core
- ❌ Customer support ticketing — `29` (Zendesk/Intercom integration); knowledge base z CMS feeduje do helpdesk

### 0.3 Diferenciátory

1. **Block-based editing** — content jako tree of blocks (Gutenberg-style); flexible bez forcing tradičních fields
2. **Theme-aware rendering** — bloky se renderují přes theme sections (per `26`) → konzistentní vzhled s thématem napříč webem
3. **Multi-language native** — každý content kus má locale-aware versions, side-by-side editor pro překladatele
4. **AI copilot built-in** — generate / improve / translate copy přímo v editoru
5. **Headless-ready** — content přístupný přes API pro custom frontendy (Storefront API)
6. **Versioning + preview** — non-destructive editing, preview share-link before publish (per `26 §5.6`)
7. **Migration-friendly** — bulk import CSV / WordPress XML / Shopify export
8. **EU-compliant** — GDPR for form submissions (consent), cookie-free analytics-friendly

---

## 1. References

- [03 §15](03-data-models-master.md#15-content--cms) — ENT-CMS-PAGE, ENT-CMS-POST, ENT-CMS-MENU, ENT-CMS-REDIRECT
- [26-themes-storefront.md](26-themes-storefront.md) — section components rendering
- [19-marketing-seo.md](19-marketing-seo.md) — SEO meta per page, JSON-LD, sitemap inclusion, llms.txt feed
- [23-i18n.md](23-i18n.md) — translations table pattern
- [22-multistore-channels.md](22-multistore-channels.md) — content scoping per store
- [27-admin-backoffice.md](27-admin-backoffice.md) — editor UI shell
- [18-customer-management.md](18-customer-management.md) — form submission → customer creation
- [20-analytics-reporting.md](20-analytics-reporting.md) — pageview tracking
- [29-integrations.md](29-integrations.md) — DeepL translation, marketing email sync
- [30-security.md](30-security.md) — form CSRF, Turnstile, content sanitization
- [33-ai-features.md](33-ai-features.md) — AI copywriter
- Gutenberg / WordPress block schema (reference)
- Strapi + Sanity CMS patterns
- schema.org (FAQ, Article, BreadcrumbList, BlogPosting, WebPage)
- Common Mark + GFM (Markdown)

---

## 2. Personas

| Persona | Použití | Klíčové permissions |
|---|---|---|
| `PERSONA-CONTENT-EDITOR` | Píše a edituje pages + posts | `PERM-CMS-EDIT`, `PERM-CMS-PUBLISH` |
| `PERSONA-CONTENT-AUTHOR` | Píše posty, neumí publish (čeká na review) | `PERM-CMS-EDIT-OWN`, `PERM-CMS-DRAFT` |
| `PERSONA-CONTENT-MANAGER` / `MARKETING-MANAGER` | Schvaluje + plánuje + publikuje | `PERM-CMS-PUBLISH-ALL`, `PERM-CMS-APPROVE` |
| `PERSONA-TRANSLATOR` | Překládá content do jiných locales | `PERM-CMS-TRANSLATE`, scope per locale |
| `PERSONA-SEO-SPECIALIST` | Optimalizuje meta + structured data | `PERM-CMS-SEO-EDIT` |
| `PERSONA-DEVELOPER` | Vytváří custom block types | `PERM-CMS-BLOCKS-DEVELOP` |
| `PERSONA-CUSTOMER-SERVICE` | Spravuje knowledge base + FAQ | `PERM-CMS-KB-MANAGE` |
| `PERSONA-CUSTOMER` | Odesílá form submissions, čte content | (public, no auth required) |
| `PERSONA-AI-COPILOT` | Generates/translates/improves content | `agent:cms:read`, `agent:cms:suggest` |

---

## 3. Data models

### 3.1 `cms_pages` ([ENT-CMS-PAGE-001](03-data-models-master.md))

```sql
CREATE TABLE cms_pages (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pub_id TEXT NOT NULL,                                                                                                            -- pag_ NanoID
  -- scoping
  applies_to_store_ids UUID[] NULL,                                                                                                  -- NULL = all stores
  -- identity
  slug TEXT NOT NULL,                                                                                                                -- "about-us", "terms-of-service"
  title TEXT NOT NULL,
  subtitle TEXT NULL,
  -- content
  page_kind TEXT NOT NULL CHECK (page_kind IN ('regular','landing','legal','help','custom','password_protected','redirect_to')) DEFAULT 'regular',
  template_kind TEXT NULL,                                                                                                            -- which theme template ('cms_page','landing_page'); NULL = default
  content_blocks JSONB NOT NULL DEFAULT '[]'::jsonb,                                                                                   -- tree of blocks
  -- protection
  is_password_protected BOOLEAN NOT NULL DEFAULT false,
  password_hash TEXT NULL,                                                                                                             -- argon2id
  -- visibility
  status TEXT NOT NULL CHECK (status IN ('draft','scheduled','published','unpublished','archived')) DEFAULT 'draft',
  status_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  publish_at TIMESTAMPTZ NULL,                                                                                                          -- for status='scheduled'
  unpublish_at TIMESTAMPTZ NULL,                                                                                                         -- auto-unpublish (campaign end)
  visibility_kind TEXT NOT NULL CHECK (visibility_kind IN ('public','customer_only','b2b_only','staff_only','private_link_only')) DEFAULT 'public',
  -- SEO
  seo_title TEXT NULL,                                                                                                                    -- defaults to title
  seo_description TEXT NULL,
  seo_canonical_url TEXT NULL,
  seo_og_image_media_id UUID NULL,
  seo_og_title TEXT NULL,
  seo_og_description TEXT NULL,
  seo_index BOOLEAN NOT NULL DEFAULT true,
  seo_follow BOOLEAN NOT NULL DEFAULT true,
  seo_priority NUMERIC(2,1) NULL CHECK (seo_priority IS NULL OR (seo_priority BETWEEN 0 AND 1)),
  seo_change_frequency TEXT NULL CHECK (seo_change_frequency IN ('always','hourly','daily','weekly','monthly','yearly','never') OR seo_change_frequency IS NULL),
  json_ld JSONB NULL,                                                                                                                       -- custom JSON-LD overrides
  -- redirect (if page_kind='redirect_to')
  redirect_to_url TEXT NULL,
  redirect_status_code INTEGER NULL CHECK (redirect_status_code IN (301,302) OR redirect_status_code IS NULL),
  -- locale handling
  default_locale TEXT NOT NULL DEFAULT 'cs-CZ',                                                                                              -- BCP-47
  available_locales TEXT[] NOT NULL DEFAULT '{}',                                                                                            -- locales with translations
  -- author + revision
  primary_author_user_id UUID NULL REFERENCES users(id),
  current_revision_id UUID NULL,                                                                                                              -- references cms_page_revisions.id
  published_revision_id UUID NULL,
  -- counters
  view_count INTEGER NOT NULL DEFAULT 0,                                                                                                       -- aggregated daily
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user_id UUID NULL,
  published_at TIMESTAMPTZ NULL,
  archived_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_cms_pages_pub_id UNIQUE (tenant_id, pub_id),
  CONSTRAINT uq_cms_pages_slug UNIQUE (tenant_id, slug)
);

CREATE INDEX idx_cms_pages_published ON cms_pages (tenant_id, status) WHERE status = 'published';
CREATE INDEX idx_cms_pages_scheduled ON cms_pages (publish_at) WHERE status = 'scheduled';
CREATE INDEX idx_cms_pages_auto_unpublish ON cms_pages (unpublish_at) WHERE status = 'published' AND unpublish_at IS NOT NULL;
CREATE INDEX idx_cms_pages_author ON cms_pages (primary_author_user_id) WHERE primary_author_user_id IS NOT NULL;
```

### 3.2 `cms_page_revisions`

```sql
CREATE TABLE cms_page_revisions (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  page_id UUID NOT NULL REFERENCES cms_pages(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('draft','published','archived','autosave')) DEFAULT 'draft',
  -- snapshot
  title TEXT NOT NULL,
  subtitle TEXT NULL,
  content_blocks JSONB NOT NULL,
  seo_snapshot JSONB NULL,                                                                                                                       -- full SEO fields snapshot
  -- audit
  notes TEXT NULL,                                                                                                                                  -- changelog
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user_id UUID NULL,
  published_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_cms_page_revisions UNIQUE (page_id, revision_number)
);

CREATE INDEX idx_cms_page_revisions_page ON cms_page_revisions (page_id, revision_number DESC);
CREATE INDEX idx_cms_page_revisions_drafts ON cms_page_revisions (page_id) WHERE kind = 'draft';
```

### 3.3 `cms_page_translations` (per `23-i18n.md` pattern)

```sql
CREATE TABLE cms_page_translations (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  page_id UUID NOT NULL REFERENCES cms_pages(id) ON DELETE CASCADE,
  locale TEXT NOT NULL,                                                                                                                              -- BCP-47
  -- localized fields
  title TEXT NOT NULL,
  subtitle TEXT NULL,
  slug TEXT NOT NULL,                                                                                                                                 -- per-locale URL slug
  content_blocks JSONB NOT NULL,                                                                                                                       -- translated block tree
  seo_title TEXT NULL,
  seo_description TEXT NULL,
  seo_og_title TEXT NULL,
  seo_og_description TEXT NULL,
  -- translation status
  translation_status TEXT NOT NULL CHECK (translation_status IN ('missing','machine_translated','human_reviewing','reviewed','outdated')) DEFAULT 'missing',
  is_machine_translated BOOLEAN NOT NULL DEFAULT false,
  machine_translation_provider TEXT NULL,                                                                                                                -- 'deepl','google'
  last_translated_at TIMESTAMPTZ NULL,
  last_reviewed_at TIMESTAMPTZ NULL,
  last_reviewed_by_user_id UUID NULL,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_cms_page_translations UNIQUE (page_id, locale),
  CONSTRAINT uq_cms_page_translations_slug UNIQUE (tenant_id, locale, slug)
);

CREATE INDEX idx_cms_page_translations_locale ON cms_page_translations (tenant_id, locale);
CREATE INDEX idx_cms_page_translations_outdated ON cms_page_translations (tenant_id) WHERE translation_status IN ('missing','outdated');
```

### 3.4 `cms_blog_posts`

```sql
CREATE TABLE cms_blog_posts (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pub_id TEXT NOT NULL,                                                                                                                                    -- pst_ NanoID
  applies_to_store_ids UUID[] NULL,
  -- identity
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT NULL,
  excerpt TEXT NULL,                                                                                                                                          -- summary for listings
  -- content
  content_blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  reading_time_minutes INTEGER NULL,                                                                                                                           -- computed
  word_count INTEGER NULL,
  -- featured
  featured_image_media_id UUID NULL,
  featured_image_alt TEXT NULL,
  -- categorization
  category_id UUID NULL REFERENCES cms_blog_categories(id),
  tag_ids UUID[] NULL,
  -- authoring
  primary_author_user_id UUID NOT NULL,
  co_author_user_ids UUID[] NULL,
  -- visibility
  status TEXT NOT NULL CHECK (status IN ('draft','scheduled','published','unpublished','archived')) DEFAULT 'draft',
  status_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  publish_at TIMESTAMPTZ NULL,
  unpublish_at TIMESTAMPTZ NULL,
  visibility_kind TEXT NOT NULL CHECK (visibility_kind IN ('public','customer_only','b2b_only','staff_only')) DEFAULT 'public',
  -- SEO
  seo_title TEXT NULL,
  seo_description TEXT NULL,
  seo_canonical_url TEXT NULL,
  seo_og_image_media_id UUID NULL,
  seo_og_title TEXT NULL,
  seo_og_description TEXT NULL,
  seo_index BOOLEAN NOT NULL DEFAULT true,
  seo_follow BOOLEAN NOT NULL DEFAULT true,
  -- locale
  default_locale TEXT NOT NULL DEFAULT 'cs-CZ',
  available_locales TEXT[] NOT NULL DEFAULT '{}',
  -- revisions
  current_revision_id UUID NULL,
  published_revision_id UUID NULL,
  -- engagement
  view_count INTEGER NOT NULL DEFAULT 0,
  share_count INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,                                                                                                                            -- if comments enabled (Fáze 2+)
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ NULL,
  archived_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_cms_blog_posts_pub_id UNIQUE (tenant_id, pub_id),
  CONSTRAINT uq_cms_blog_posts_slug UNIQUE (tenant_id, slug)
);

CREATE INDEX idx_cms_blog_posts_published ON cms_blog_posts (tenant_id, published_at DESC) WHERE status = 'published';
CREATE INDEX idx_cms_blog_posts_category ON cms_blog_posts (category_id, published_at DESC) WHERE status = 'published';
CREATE INDEX idx_cms_blog_posts_author ON cms_blog_posts (primary_author_user_id, published_at DESC);
CREATE INDEX idx_cms_blog_posts_scheduled ON cms_blog_posts (publish_at) WHERE status = 'scheduled';
CREATE INDEX idx_cms_blog_posts_tags ON cms_blog_posts USING GIN (tag_ids) WHERE status = 'published';
```

### 3.5 `cms_blog_categories` + `cms_blog_tags`

```sql
CREATE TABLE cms_blog_categories (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  pub_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NULL,
  parent_category_id UUID NULL REFERENCES cms_blog_categories(id),
  -- listing
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- SEO
  seo_title TEXT NULL,
  seo_description TEXT NULL,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_cms_blog_categories_pub_id UNIQUE (tenant_id, pub_id),
  CONSTRAINT uq_cms_blog_categories_slug UNIQUE (tenant_id, slug)
);

CREATE TABLE cms_blog_tags (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  pub_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NULL,                                                                                                                                                              -- hex for UI
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_cms_blog_tags_pub_id UNIQUE (tenant_id, pub_id),
  CONSTRAINT uq_cms_blog_tags_slug UNIQUE (tenant_id, slug)
);
```

### 3.6 `cms_blog_post_revisions` + `cms_blog_post_translations`

Mirror `cms_page_revisions` and `cms_page_translations` structure pattern. (Schema omitted for brevity; identical fields with `post_id` instead of `page_id`.)

### 3.7 `cms_blocks` (reusable blocks library)

```sql
CREATE TABLE cms_blocks (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pub_id TEXT NOT NULL,                                                                                                                                                              -- blk_ NanoID
  code TEXT NOT NULL,                                                                                                                                                                  -- 'newsletter_signup_default','testimonials_homepage'
  name TEXT NOT NULL,
  description TEXT NULL,
  block_kind TEXT NOT NULL,                                                                                                                                                                -- references theme section kind: 'hero','testimonials','rich_text','newsletter_signup','faq_list',...
  settings JSONB NOT NULL,                                                                                                                                                                  -- block settings (per section schema)
  -- usage
  is_global BOOLEAN NOT NULL DEFAULT false,                                                                                                                                                  -- if true, used by reference; if false, embedded inline
  usage_count INTEGER NOT NULL DEFAULT 0,                                                                                                                                                    -- auto-tracked
  -- locale
  available_locales TEXT[] NOT NULL DEFAULT '{}',
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user_id UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_cms_blocks_pub_id UNIQUE (tenant_id, pub_id),
  CONSTRAINT uq_cms_blocks_code UNIQUE (tenant_id, code)
);

CREATE INDEX idx_cms_blocks_kind ON cms_blocks (tenant_id, block_kind);
CREATE INDEX idx_cms_blocks_global ON cms_blocks (tenant_id) WHERE is_global = true;
```

### 3.8 `cms_block_translations`

```sql
CREATE TABLE cms_block_translations (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  block_id UUID NOT NULL REFERENCES cms_blocks(id) ON DELETE CASCADE,
  locale TEXT NOT NULL,
  settings JSONB NOT NULL,                                                                                                                                                                    -- translated settings (e.g., heading, subheading, cta_text)
  translation_status TEXT NOT NULL CHECK (translation_status IN ('missing','machine_translated','reviewed','outdated')) DEFAULT 'missing',
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_cms_block_translations UNIQUE (block_id, locale)
);
```

### 3.9 `cms_menus` (navigation)

```sql
CREATE TABLE cms_menus (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pub_id TEXT NOT NULL,
  code TEXT NOT NULL,                                                                                                                                                                              -- 'header','footer_main','footer_legal','side_navigation','mega_menu'
  name TEXT NOT NULL,
  description TEXT NULL,
  menu_kind TEXT NOT NULL CHECK (menu_kind IN ('header','footer','sidebar','mega_menu','footer_legal','mobile_drawer','custom')) DEFAULT 'custom',
  -- scope
  applies_to_store_ids UUID[] NULL,
  -- items tree (denormalized for read perf; canonical is cms_menu_items)
  items JSONB NOT NULL DEFAULT '[]'::jsonb,                                                                                                                                                            -- precomputed tree
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_cms_menus_pub_id UNIQUE (tenant_id, pub_id),
  CONSTRAINT uq_cms_menus_code UNIQUE (tenant_id, code)
);

CREATE TABLE cms_menu_items (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  menu_id UUID NOT NULL REFERENCES cms_menus(id) ON DELETE CASCADE,
  parent_item_id UUID NULL REFERENCES cms_menu_items(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  -- target
  target_kind TEXT NOT NULL CHECK (target_kind IN ('external_url','internal_route','cms_page','product','category','collection','blog_post','blog_category','search','login','register','heading_only')),
  external_url TEXT NULL,
  internal_route TEXT NULL,                                                                                                                                                                                -- e.g., '/cart', '/account'
  cms_page_id UUID NULL REFERENCES cms_pages(id) ON DELETE SET NULL,
  product_id UUID NULL,
  category_id UUID NULL,
  blog_post_id UUID NULL REFERENCES cms_blog_posts(id) ON DELETE SET NULL,
  blog_category_id UUID NULL REFERENCES cms_blog_categories(id) ON DELETE SET NULL,
  -- display
  label TEXT NOT NULL,
  icon_name TEXT NULL,
  description TEXT NULL,                                                                                                                                                                                    -- for mega menus
  badge_label TEXT NULL,                                                                                                                                                                                       -- 'New','Sale'
  open_in_new_tab BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- visibility
  visibility_kind TEXT NOT NULL CHECK (visibility_kind IN ('always','public_only','customer_only','b2b_only','staff_only','hidden')) DEFAULT 'always',
  visible_from TIMESTAMPTZ NULL,
  visible_until TIMESTAMPTZ NULL,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_cms_menu_items_menu ON cms_menu_items (menu_id, parent_item_id NULLS FIRST, position);
CREATE INDEX idx_cms_menu_items_target ON cms_menu_items (cms_page_id) WHERE cms_page_id IS NOT NULL;
```

### 3.10 `cms_menu_item_translations`

```sql
CREATE TABLE cms_menu_item_translations (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  menu_item_id UUID NOT NULL REFERENCES cms_menu_items(id) ON DELETE CASCADE,
  locale TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT NULL,
  badge_label TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_cms_menu_item_translations UNIQUE (menu_item_id, locale)
);
```

### 3.11 `cms_redirects`

```sql
CREATE TABLE cms_redirects (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pub_id TEXT NOT NULL,                                                                                                                                                                                       -- red_ NanoID
  -- match
  source_path TEXT NOT NULL,                                                                                                                                                                                    -- '/old-product-url' OR regex if is_regex=true
  source_path_lower TEXT NOT NULL,                                                                                                                                                                                -- normalized lower for matching
  is_regex BOOLEAN NOT NULL DEFAULT false,
  case_sensitive BOOLEAN NOT NULL DEFAULT false,
  -- match host (optional)
  host_match TEXT NULL,                                                                                                                                                                                              -- 'old.example.com'; NULL = any
  -- target
  target_url TEXT NOT NULL,                                                                                                                                                                                            -- absolute or path
  status_code INTEGER NOT NULL CHECK (status_code IN (301,302,307,308)) DEFAULT 301,
  preserve_query_string BOOLEAN NOT NULL DEFAULT true,
  -- scope
  applies_to_store_ids UUID[] NULL,
  -- activation
  is_active BOOLEAN NOT NULL DEFAULT true,
  active_from TIMESTAMPTZ NULL,
  active_until TIMESTAMPTZ NULL,
  -- analytics
  hit_count BIGINT NOT NULL DEFAULT 0,                                                                                                                                                                                    -- aggregated
  last_hit_at TIMESTAMPTZ NULL,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user_id UUID NULL,
  source_kind TEXT NOT NULL CHECK (source_kind IN ('manual','auto_slug_change','bulk_import','migration')) DEFAULT 'manual',
  notes TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_cms_redirects_pub_id UNIQUE (tenant_id, pub_id),
  CONSTRAINT uq_cms_redirects_source UNIQUE (tenant_id, host_match, source_path_lower)
);

CREATE INDEX idx_cms_redirects_lookup ON cms_redirects (tenant_id, source_path_lower) WHERE is_active = true AND is_regex = false;
CREATE INDEX idx_cms_redirects_regex_active ON cms_redirects (tenant_id) WHERE is_active = true AND is_regex = true;
```

### 3.12 `cms_forms` (custom forms)

```sql
CREATE TABLE cms_forms (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pub_id TEXT NOT NULL,
  code TEXT NOT NULL,                                                                                                                                                                                                       -- 'contact','newsletter','b2b_quote_request','gated_download'
  name TEXT NOT NULL,
  description TEXT NULL,
  form_kind TEXT NOT NULL CHECK (form_kind IN ('contact','newsletter','rfq','gated_download','custom','survey')) DEFAULT 'custom',
  -- fields
  field_schema JSONB NOT NULL,                                                                                                                                                                                                   -- Zod-compatible JSON schema
  -- behavior
  redirect_after_submit_url TEXT NULL,                                                                                                                                                                                            -- success page
  success_message_html TEXT NULL,                                                                                                                                                                                                   -- inline
  send_confirmation_email_to_submitter BOOLEAN NOT NULL DEFAULT false,
  confirmation_email_template_id UUID NULL,                                                                                                                                                                                            -- references email template (per `19`)
  notify_email_addresses TEXT[] NULL,                                                                                                                                                                                                    -- internal notification
  notify_slack_webhook_url TEXT NULL,                                                                                                                                                                                                      -- internal notification
  -- spam protection
  require_turnstile BOOLEAN NOT NULL DEFAULT true,
  rate_limit_per_ip_hour INTEGER NOT NULL DEFAULT 10,
  -- consent
  require_gdpr_consent_checkbox BOOLEAN NOT NULL DEFAULT true,
  gdpr_consent_text TEXT NULL,
  marketing_consent_optional BOOLEAN NOT NULL DEFAULT true,
  -- audit
  submission_count BIGINT NOT NULL DEFAULT 0,
  last_submission_at TIMESTAMPTZ NULL,
  -- retention
  retention_days INTEGER NOT NULL DEFAULT 365,                                                                                                                                                                                                -- submissions auto-purge after
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user_id UUID NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_cms_forms_pub_id UNIQUE (tenant_id, pub_id),
  CONSTRAINT uq_cms_forms_code UNIQUE (tenant_id, code)
);

CREATE INDEX idx_cms_forms_kind ON cms_forms (tenant_id, form_kind) WHERE is_active = true;
```

### 3.13 `cms_form_submissions`

```sql
CREATE TABLE cms_form_submissions (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  form_id UUID NOT NULL REFERENCES cms_forms(id) ON DELETE CASCADE,
  pub_id TEXT NOT NULL,
  -- data
  field_values JSONB NOT NULL,                                                                                                                                                                                                                   -- validated form data
  source_page_url TEXT NULL,
  source_page_id UUID NULL REFERENCES cms_pages(id),
  -- submitter
  submitter_customer_id UUID NULL,                                                                                                                                                                                                                 -- if logged in
  submitter_email CITEXT NULL,                                                                                                                                                                                                                       -- from form or session
  submitter_ip INET NULL,
  submitter_user_agent TEXT NULL,
  -- consent capture
  gdpr_consent_given BOOLEAN NOT NULL DEFAULT false,
  gdpr_consent_text_snapshot TEXT NULL,
  marketing_consent_given BOOLEAN NULL,
  -- processing
  status TEXT NOT NULL CHECK (status IN ('received','processing','processed','spam','rejected')) DEFAULT 'received',
  processing_notes TEXT NULL,
  -- attachments
  attachments JSONB NULL,                                                                                                                                                                                                                              -- references to media uploads
  -- audit
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ NULL,
  retention_expires_at TIMESTAMPTZ NULL,                                                                                                                                                                                                                  -- computed from form.retention_days
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_cms_form_submissions_pub_id UNIQUE (tenant_id, pub_id)
) PARTITION BY RANGE (submitted_at);

CREATE INDEX idx_cms_form_submissions_form ON cms_form_submissions (form_id, submitted_at DESC);
CREATE INDEX idx_cms_form_submissions_status ON cms_form_submissions (tenant_id, status, submitted_at DESC) WHERE status IN ('received','processing');
CREATE INDEX idx_cms_form_submissions_purge ON cms_form_submissions (retention_expires_at) WHERE retention_expires_at IS NOT NULL;
```

### 3.14 `cms_kb_articles` (knowledge base)

```sql
CREATE TABLE cms_kb_articles (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pub_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  -- categorization
  category_id UUID NULL REFERENCES cms_kb_categories(id),
  -- content
  title TEXT NOT NULL,
  summary TEXT NULL,
  content_blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- visibility
  status TEXT NOT NULL CHECK (status IN ('draft','published','archived')) DEFAULT 'draft',
  visibility_kind TEXT NOT NULL CHECK (visibility_kind IN ('public','customer_only','b2b_only','staff_only')) DEFAULT 'public',
  -- engagement
  view_count INTEGER NOT NULL DEFAULT 0,
  helpful_yes_count INTEGER NOT NULL DEFAULT 0,
  helpful_no_count INTEGER NOT NULL DEFAULT 0,
  -- SEO
  seo_title TEXT NULL,
  seo_description TEXT NULL,
  seo_index BOOLEAN NOT NULL DEFAULT true,
  -- locale
  default_locale TEXT NOT NULL DEFAULT 'cs-CZ',
  available_locales TEXT[] NOT NULL DEFAULT '{}',
  -- audit
  primary_author_user_id UUID NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  related_article_ids UUID[] NULL,
  related_product_ids UUID[] NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ NULL,
  archived_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_cms_kb_articles_pub_id UNIQUE (tenant_id, pub_id),
  CONSTRAINT uq_cms_kb_articles_slug UNIQUE (tenant_id, slug)
);

CREATE TABLE cms_kb_categories (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  pub_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NULL,
  parent_category_id UUID NULL REFERENCES cms_kb_categories(id),
  icon_name TEXT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_cms_kb_categories_pub_id UNIQUE (tenant_id, pub_id),
  CONSTRAINT uq_cms_kb_categories_slug UNIQUE (tenant_id, slug)
);

CREATE INDEX idx_cms_kb_articles_published ON cms_kb_articles (tenant_id, published_at DESC) WHERE status = 'published';
CREATE INDEX idx_cms_kb_articles_category ON cms_kb_articles (category_id, display_order) WHERE status = 'published';
```

### 3.15 `cms_faqs`

```sql
CREATE TABLE cms_faqs (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  pub_id TEXT NOT NULL,
  group_code TEXT NOT NULL,                                                                                                                                                                                                                            -- 'product_questions','shipping','returns'; FAQs grouped for display
  question TEXT NOT NULL,
  answer_blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- scope (optional product / category / global)
  related_product_ids UUID[] NULL,
  related_category_ids UUID[] NULL,
  -- engagement
  view_count INTEGER NOT NULL DEFAULT 0,
  helpful_yes_count INTEGER NOT NULL DEFAULT 0,
  helpful_no_count INTEGER NOT NULL DEFAULT 0,
  -- SEO (schema.org FAQPage)
  include_in_schema_org BOOLEAN NOT NULL DEFAULT true,
  -- locale
  default_locale TEXT NOT NULL DEFAULT 'cs-CZ',
  available_locales TEXT[] NOT NULL DEFAULT '{}',
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_cms_faqs_pub_id UNIQUE (tenant_id, pub_id)
);

CREATE INDEX idx_cms_faqs_group ON cms_faqs (tenant_id, group_code, display_order) WHERE is_active = true;
```

### 3.16 `cms_approval_requests` (Fáze 2)

```sql
CREATE TABLE cms_approval_requests (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  pub_id TEXT NOT NULL,
  -- subject
  resource_kind TEXT NOT NULL CHECK (resource_kind IN ('cms_page','cms_blog_post','cms_block','cms_kb_article')),
  resource_id UUID NOT NULL,
  revision_id UUID NOT NULL,                                                                                                                                                                                                                                                  -- the draft awaiting approval
  -- workflow
  requested_by_user_id UUID NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected','withdrawn','expired')) DEFAULT 'pending',
  status_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewer_user_id UUID NULL,
  review_notes TEXT NULL,
  -- audit
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ NULL,
  expires_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_cms_approval_requests_pub_id UNIQUE (tenant_id, pub_id)
);

CREATE INDEX idx_cms_approval_pending ON cms_approval_requests (tenant_id, requested_at) WHERE status = 'pending';
```

### 3.17 Vztahy

```
cms_pages (1)──(N) cms_page_revisions
cms_pages (1)──(N) cms_page_translations
cms_pages (1)──(0..N) cms_menu_items                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              [as target]
cms_blog_posts (1)──(N) cms_blog_post_revisions
cms_blog_posts (1)──(N) cms_blog_post_translations
cms_blog_posts (N)──(0..1) cms_blog_categories
cms_blog_posts (N)──(0..N) cms_blog_tags                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  [via tag_ids array]
cms_blocks (1)──(N) cms_block_translations
cms_blocks (0..N) referenced by cms_pages, cms_blog_posts, theme templates                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  [via content_blocks JSONB with block_id refs]
cms_menus (1)──(N) cms_menu_items
cms_menu_items (1)──(N) cms_menu_item_translations
cms_forms (1)──(N) cms_form_submissions
cms_kb_articles (N)──(0..1) cms_kb_categories
cms_pages / cms_blog_posts / cms_blocks / cms_kb_articles → cms_approval_requests
```

---

## 4. Content blocks system

### 4.1 Block tree shape

Content (cms_pages.content_blocks, cms_blog_posts.content_blocks, ...) je JSONB tree:

```jsonc
{
  "version": 1,
  "blocks": [
    {
      "id": "blk_local_001",
      "kind": "hero",
      "settings": {
        "heading": "Welcome to Acme",
        "subheading": "Premium pottery, made in Czech Republic.",
        "background_image_media_id": "mda_aB",
        "cta_text": "Shop now",
        "cta_url": "/collections/all",
        "height": "60vh"
      }
    },
    {
      "id": "blk_local_002",
      "kind": "rich_text",
      "settings": {
        "content_html": "<h2>Our story</h2><p>...</p>"
      }
    },
    {
      "id": "blk_ref_aB",
      "kind": "newsletter_signup",
      "ref": "cms_block_id:blk_aB"
    },
    {
      "id": "blk_local_003",
      "kind": "columns",
      "settings": { "columns": 3, "gap": "lg" },
      "children": [
        { "id": "blk_local_004", "kind": "image_with_text", "settings": { ... } },
        { "id": "blk_local_005", "kind": "image_with_text", "settings": { ... } },
        { "id": "blk_local_006", "kind": "image_with_text", "settings": { ... } }
      ]
    }
  ]
}
```

Two ways to use a block:
- **Inline** — `settings` embedded in block tree (one-off content)
- **Reference (`ref`)** — link to `cms_blocks.id` (global reusable); renderer dereferences at render time

### 4.2 Block kind catalog (MVP)

Reuses theme sections (per `26 §3.4`). Common kinds:

| Kind | Use |
|---|---|
| `hero` | Headline + CTA + background image/video |
| `rich_text` | WYSIWYG-edited HTML content |
| `image_with_text` | Two-column image + text |
| `image_gallery` | Multi-image grid |
| `video_embed` | YouTube/Vimeo/native video |
| `cta_block` | Single-column CTA banner |
| `testimonials` | Customer quotes carousel |
| `feature_grid` | 3-6 feature tiles with icon + text |
| `pricing_table` | Pricing tier comparison (for SaaS-like) |
| `faq_list` | Accordion FAQs (uses cms_faqs by group) |
| `newsletter_signup` | Newsletter form (uses cms_forms) |
| `contact_form` | Contact form (uses cms_forms) |
| `product_showcase` | Single product hero card |
| `featured_products` | Product grid (manual or smart selection) |
| `blog_post_grid` | Recent posts |
| `kb_articles_grid` | Related KB articles |
| `code_block` | Syntax-highlighted code (technical docs) |
| `quote` | Pull-quote / blockquote |
| `divider` | Horizontal rule / spacer |
| `columns` | Layout container (children blocks) |
| `tabs` | Tabbed content |
| `embed` | Twitter/Instagram/Reddit/generic oEmbed |
| `html` | Raw HTML (admin-only; sanitized via DOMPurify; `PERM-CMS-EDIT-HTML` required) |
| `markdown` | Markdown source (rendered server-side) |
| `iframe` | Sandboxed iframe (with strict CSP per `30 §10.3`) |
| `custom:<plugin_code>` | Plugin-provided block (per `28 §8.12` extensions, Fáze 2) |

### 4.3 Block settings schema

Each block kind declares Zod schema (or JSON Schema). Editor renders form from schema. Validation server-side on save.

Example for `hero`:
```ts
const heroSchema = z.object({
  heading: z.string().min(1).max(120),
  subheading: z.string().max(300).optional(),
  background_image_media_id: z.string().regex(/^mda_/).optional(),
  cta_text: z.string().max(30).optional(),
  cta_url: z.string().url().or(z.string().startsWith('/')).optional(),
  height: z.enum(['40vh','60vh','80vh','100vh']).default('60vh'),
  text_alignment: z.enum(['left','center','right']).default('center'),
  overlay_opacity: z.number().min(0).max(1).default(0.3)
});
```

### 4.4 Block rendering

Storefront server (Next.js 16 RSC) iterates `content_blocks`:
1. For inline blocks: render theme section component with embedded settings
2. For reference blocks: load `cms_blocks` row → render with referenced settings
3. Translations resolved per locale (translation table for ref blocks; embedded translations for inline)

Cache per (tenant, page, locale, theme_revision_id) — invalidated on content/theme change.

### 4.5 Theme-CMS interop

- Theme defines section components (per `26`)
- CMS stores content as block tree referencing section kinds
- Block can only use section kinds that current theme supports
- Theme switch: blocks of unsupported kind shown as "Unavailable in current theme" placeholder; not deleted; restored if theme switches back

### 4.6 Reusable global blocks

Use case: newsletter signup, footer CTA, brand promise block appearing on many pages.

- Create global block in CMS → blocks library
- Insert reference (`ref`) in pages/posts
- Edit global block → all references update (single source of truth)
- "Where used" panel shows all pages referencing
- Delete protected if references exist (must clean first)

### 4.7 Block translations

Inline blocks: translations stored in `cms_page_translations.content_blocks` with same shape, translated `settings`.

Global blocks: translations in `cms_block_translations` per locale; references resolve to correct locale.

### 4.8 Block editor UX

Visual editor (admin):
- Add block: side panel with block catalog (search + categories)
- Drag-drop reorder
- Click block → settings panel (RHF + Zod)
- Click image field → media picker
- Click URL field → entity picker (CMS page, product, category, ...) OR external URL
- Live preview pane (iframe rendering with draft revision)
- "Insert global block" mode
- "Save as global block" promotes inline → global

### 4.9 Migration: WordPress / Shopify import

- WordPress: Gutenberg block mapping (`core/paragraph` → `rich_text`, `core/image` → `image_gallery` with 1 item, ...)
- Shopify: page content (HTML) → single `rich_text` block; manual cleanup recommended
- Custom mappers for known sources
- Per `JOB-IMPORT-CMS-CONTENT`

---

## 5. Editorial workflow

### 5.1 Lifecycle stages

```
[Idea/Brief]
    ↓
[Draft]
    ↓
[Awaiting Approval] (optional, Fáze 2)
    ↓
[Scheduled]
    ↓
[Published]
    ↓
[Unpublished / Archived]
```

### 5.2 Draft management

- Every edit creates new revision (`cms_page_revisions` with `kind='draft'` or `kind='autosave'`)
- Autosave every 30s of inactivity
- Manual save creates `kind='draft'`
- Up to 50 draft revisions retained per resource; older auto-archived
- Preview URL with signed token (24h TTL; see `26 §RULE-THM-021`)

### 5.3 Scheduling

- Set `publish_at` future timestamp
- Status moves `draft` → `scheduled`
- Cron job `JOB-PUBLISH-SCHEDULED-CONTENT` runs every 1 min
- At `publish_at`: revision promoted to `published`, page status `scheduled` → `published`
- Email notification to author
- Cache invalidated

### 5.4 Auto-unpublish

- Set `unpublish_at` future timestamp (campaign end)
- Cron unpublishes at time
- Status `published` → `unpublished`
- Page returns 410 Gone (if seo_index was true) or 404 (configurable)
- Optionally: redirect to alternative URL configured

### 5.5 Approval workflow (Fáze 2 enterprise)

If `tenant.settings.cms_approval_required_for_publish=true`:
- Author saves draft + clicks "Request approval"
- `cms_approval_requests` row created (status='pending')
- Manager notified
- Manager reviews, approves/rejects with notes
- On approve: content publishes (or moves to scheduled if `publish_at` set)
- On reject: author notified, can edit + resubmit

Per-resource approval requirement configurable (e.g., only legal pages require).

### 5.6 Translation workflow

```
[Default locale content published]
        ↓
[Translator dashboard shows "Translate to {locale}" task]
        ↓
[Side-by-side editor: source + target]
   - Auto-suggest from DeepL (per `29-integrations.md`)
   - Translator reviews, edits
        ↓
[Save: translation_status='reviewed']
        ↓
[Translated version available at /locale-path]
```

Triggered re-translation when source content changes:
- Detect via content hash diff
- `translation_status='outdated'`
- Notify translator

### 5.7 Versioning + rollback

- Every published revision retained
- Past 50 published revisions retained per page; older archived to cold storage
- Rollback: select past revision → "Restore" → creates new draft based on it → publish flow
- Diff view: side-by-side compare any two revisions

### 5.8 Collaborative editing

MVP: optimistic locking. If two editors edit same revision concurrently:
- Save by editor A → revision_v_n+1
- Save by editor B with stale `expected_revision_id` → conflict 412 Precondition Failed
- Editor B shown diff + merge UI: choose Yours / Theirs / Merge per field

Fáze 3+: real-time CRDT-based collaborative editing.

### 5.9 Content QA before publish

Optional checks (configurable):
- Spell check (locale-aware)
- Readability score (Flesch-Kincaid)
- Link checker (no broken internal links)
- Image alt-text required for accessibility
- SEO score (title/description length, keyword presence)
- Word count minimum (for blog posts)

Block publish if hard requirements fail (e.g., missing alt text on images for legal pages).

### 5.10 AI copilot for content

Per `33-ai-features.md`:
- Generate draft from outline
- Improve existing copy (clarity, tone)
- Translate via DeepL preview
- SEO suggestions
- Internal link suggestions ("link 'cs-cz pottery' to /collections/cs-cz-pottery?")
- Auto-generate excerpt + featured image alt

---

## 6. State machines

### 6.1 Page / blog post status

```
draft ──→ scheduled ──→ published ──→ unpublished
              ↑           ↑               ↓
              └───────────┴──────────── archived
```

### 6.2 Approval request

```
pending ──→ approved ──→ (downstream: content publishes/scheduled)
       └──→ rejected
       └──→ withdrawn (by author)
       └──→ expired (no review in N days)
```

### 6.3 Form submission

```
received ──→ processing ──→ processed
                       └──→ spam (Turnstile / heuristic fail)
                       └──→ rejected (manual)
```

### 6.4 Translation status (per `cms_page_translations.translation_status`)

```
missing ──→ machine_translated ──→ human_reviewing ──→ reviewed
                                                       ↓
                                                 outdated (when source changes)
                                                       ↓
                                              back to machine_translated cycle
```

---

## 7. Business rules

### RULE-CMS-001: Slug unique per tenant per locale

Slugs unique per `(tenant_id, slug)` for default locale; per `(tenant_id, locale, slug)` in translations. Slug change creates auto-redirect (per RULE-CMS-008).

### RULE-CMS-002: Slug format

Slug: lowercase, ASCII, hyphens, alphanumeric. Max 100 chars. No leading/trailing hyphen. Server normalizes (strip diacritics, convert spaces to hyphens, lowercase). Per `05-naming-conventions.md`.

### RULE-CMS-003: Content sanitization

HTML inside blocks sanitized server-side (DOMPurify with strict allowlist). Block `kind='html'` requires `PERM-CMS-EDIT-HTML`. Block `kind='iframe'` requires explicit allowlist of src domains.

### RULE-CMS-004: Block schema validation

Every block validated against its kind's schema on save. Invalid → reject with field errors.

### RULE-CMS-005: Theme compatibility check

On theme switch: pages with blocks of unsupported kinds shown as "Unavailable in current theme" placeholder. Editor banner suggests review. Content data preserved.

### RULE-CMS-006: Reusable block deletion protected

Global `cms_block` can't be deleted while referenced by any page/post (via `usage_count > 0`). Editor shows "Used in N places — review and replace first".

### RULE-CMS-007: Scheduled publish accuracy

`JOB-PUBLISH-SCHEDULED-CONTENT` runs every 1 min. Drift max 60s. For exact-second campaigns: not supported MVP (per `Q-CMS-009`).

### RULE-CMS-008: Auto-redirect on slug change

When `cms_pages.slug` changes OR `cms_blog_posts.slug` changes:
- Auto-create `cms_redirects` row from old → new with status 301
- `source_kind='auto_slug_change'`
- Active 1 year by default (configurable); after period, manual cleanup
- Prevents broken bookmarks + SEO loss

### RULE-CMS-009: Redirect chains avoided

If new redirect creates chain `A → B → C`: collapse to `A → C` automatically. Loop detection: reject creation if cycle would form.

### RULE-CMS-010: Form submission rate limit

Per IP per form: `cms_forms.rate_limit_per_ip_hour` default 10. Exceeded → 429. Logged as security event (per `30 §6.3`).

### RULE-CMS-011: Form Turnstile mandatory

`require_turnstile=true` default. Turnstile token verified server-side before processing. Skip allowed for logged-in customers (lower bot risk; configurable).

### RULE-CMS-012: GDPR consent on forms

`require_gdpr_consent_checkbox=true` default. Consent text snapshot saved with submission (audit). Marketing consent separate checkbox (per `18-customer-management.md` consent ledger).

### RULE-CMS-013: Form submission retention

Default 365 days. Auto-purged after via `JOB-PURGE-OLD-FORM-SUBMISSIONS`. Tenant can configure shorter retention. Records of legitimate interest (contact forms with substance) retained longer per business need.

### RULE-CMS-014: Form spam handling

Turnstile fail OR heuristic match (e.g., honeypot field filled) → `status='spam'`. Not delivered to notification email. Visible in admin for review. Auto-deleted after 30 days.

### RULE-CMS-015: Knowledge base search-indexed

Published KB articles indexed in storefront search (per `08-search-filtering.md`). Tenant-configurable (some KB private to customer service).

### RULE-CMS-016: FAQ schema.org markup

FAQs with `include_in_schema_org=true` rendered as `FAQPage` JSON-LD on pages where group is embedded. Per `19-marketing-seo.md`.

### RULE-CMS-017: Multi-store content scoping

`applies_to_store_ids=NULL` = available all stores. Specific list = scoped. Storefront only sees content scoped to current store + global.

### RULE-CMS-018: Page visibility kinds

- `public`: anyone
- `customer_only`: logged-in customer
- `b2b_only`: customer with `company_member` (per `21-b2b-complete.md`)
- `staff_only`: admin user
- `private_link_only`: requires signed preview-style token

Server-side enforcement (don't trust UI).

### RULE-CMS-019: Password-protected pages

`is_password_protected=true` + `password_hash` (argon2id). User enters password → cookie set with verified token (expires 24h). Per `30 §RULE-SEC-008` argon2id parameters.

### RULE-CMS-020: SEO defaults

When `seo_title NULL` → use `title`. When `seo_description NULL` → first 160 chars of first text block stripped of HTML. `seo_canonical_url NULL` → computed from slug.

### RULE-CMS-021: Sitemap inclusion

Published pages + blog posts + KB articles with `seo_index=true` included in sitemap (per `19-marketing-seo.md`). Pages with `seo_index=false`: noindex meta + excluded from sitemap.

### RULE-CMS-022: llms.txt feed

Per `19 §0.1` Shopio differentiator. Published CMS pages + blog posts emitted to `/llms.txt` and `/llms-full.txt` for AI crawler consumption.

### RULE-CMS-023: Blog reading time computed

`reading_time_minutes = ceil(word_count / 200)` (200 wpm avg). Computed on save. Updated on edit.

### RULE-CMS-024: Featured image alt required for accessibility

Blog post / page hero images require `alt` text for WCAG 2.2 AA (per `26 §15.2`). Block publish if missing on accessibility-critical templates.

### RULE-CMS-025: Translation workflow

When default-locale content changes substantively (text diff > 20%):
- All translations marked `outdated`
- Translator notified
- Storefront still shows existing translations with "Available in English (Czech version may be outdated)" banner option

Trivial changes (typo fix, image swap) don't trigger outdated state via heuristic.

### RULE-CMS-026: Menu cascade delete safety

Deleting CMS page referenced by menu items: menu items show "broken link" warning; don't auto-delete. Editor can replace target or remove.

### RULE-CMS-027: Menu item visibility runtime

`visibility_kind` checked at render. Anonymous user doesn't see `customer_only` items. B2B users see `b2b_only`. Time-bound (`visible_from` / `visible_until`) auto-hides expired.

### RULE-CMS-028: Maximum nesting depth

Content blocks: max 5 levels deep (prevents bloat). Menu items: max 3 levels (UX: more is unusable). Enforced on save.

### RULE-CMS-029: Reserved slugs

Cannot use as page slug: `cart`, `checkout`, `account`, `login`, `register`, `search`, `api`, `admin`, `blog`, `static`, `_next`. Configurable list per `01-DEC-CMS-001` (reserved routes).

### RULE-CMS-030: Image lazy-loading

Image blocks default `loading="lazy"` except first hero block per page (LCP optimization, per `26 §15.3`).

### RULE-CMS-031: Embed allowlist

`embed` block kind: only allowlisted providers (YouTube, Vimeo, Twitter, Instagram, Spotify, SoundCloud, CodePen). Other providers: HTML block with iframe (admin-permission required).

### RULE-CMS-032: AI-generated content disclosure

If content created/translated by AI: metadata flag `ai_generated=true` or `is_machine_translated=true`. Customer-facing transparency optional but recommended per EU AI Act anticipated requirements.

### RULE-CMS-033: Bulk import idempotency

CSV/WordPress XML/Shopify import uses external IDs / slugs as match keys. Re-importing same file = update existing (not duplicate). Dry-run mode previews changes.

### RULE-CMS-034: Form submission attachment limits

Max 10 files per submission, 25 MB per file, 100 MB total. Allowed types: PDF, image, document (allowlist). Magic-byte validated, virus scanned (per `30 §10.5`).

### RULE-CMS-035: Approval expiration

Pending approvals expire after 7 days (configurable) if not reviewed. Author notified to resubmit. Avoids stale queue.

### RULE-CMS-036: KB article helpfulness gating

"Was this helpful?" votes rate-limited (1 vote per article per IP per 7 days). Anonymous votes counted. Aggregates feed back to content team via dashboard.

### RULE-CMS-037: Revision retention

Per resource: 50 most recent revisions retained hot. Older archived to cold storage; restorable on demand within 30 days.

### RULE-CMS-038: Search reindex on publish

`EVENT-CMS-PAGE-PUBLISHED` triggers search index update (per `08-search-filtering.md`). Debounced 5 min to avoid index churn.

### RULE-CMS-039: Cache invalidation

Page publish/update → CDN purge for URL + listing pages (blog index, sitemap, llms.txt). Edge cache per `26 §RULE-THM-024`.

### RULE-CMS-040: Cross-tenant content blocked

Content per tenant. RLS enforced (per `30 §5.4`). Importing content from another tenant: explicit cross-tenant copy (rare; agency feature Fáze 2+).

---

## 8. REST API endpoints

### 8.1 Pages

```
GET    /api/{date}/cms/pages
POST   /api/{date}/cms/pages
GET    /api/{date}/cms/pages/{id}
PATCH  /api/{date}/cms/pages/{id}
DELETE /api/{date}/cms/pages/{id}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            # archive
POST   /api/{date}/cms/pages/{id}:publish
POST   /api/{date}/cms/pages/{id}:unpublish
POST   /api/{date}/cms/pages/{id}:schedule                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          # body: { publish_at }
POST   /api/{date}/cms/pages/{id}:save-draft
POST   /api/{date}/cms/pages/{id}:autosave
GET    /api/{date}/cms/pages/{id}/revisions
GET    /api/{date}/cms/pages/{id}/revisions/{revision_id}
POST   /api/{date}/cms/pages/{id}/revisions/{revision_id}:restore
GET    /api/{date}/cms/pages/{id}/preview-url
GET    /api/{date}/cms/pages/{id}/translations
POST   /api/{date}/cms/pages/{id}/translations/{locale}
PATCH  /api/{date}/cms/pages/{id}/translations/{locale}
DELETE /api/{date}/cms/pages/{id}/translations/{locale}
POST   /api/{date}/cms/pages/{id}/translations/{locale}:auto-translate                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          # via DeepL (29)
```

### 8.2 Blog

```
GET    /api/{date}/cms/blog/posts
POST   /api/{date}/cms/blog/posts
GET    /api/{date}/cms/blog/posts/{id}
PATCH  /api/{date}/cms/blog/posts/{id}
DELETE /api/{date}/cms/blog/posts/{id}
POST   /api/{date}/cms/blog/posts/{id}:publish
POST   /api/{date}/cms/blog/posts/{id}:schedule
GET    /api/{date}/cms/blog/posts/{id}/revisions
GET    /api/{date}/cms/blog/categories
POST   /api/{date}/cms/blog/categories
PATCH  /api/{date}/cms/blog/categories/{id}
DELETE /api/{date}/cms/blog/categories/{id}
GET    /api/{date}/cms/blog/tags
POST   /api/{date}/cms/blog/tags
```

### 8.3 Reusable blocks

```
GET    /api/{date}/cms/blocks
POST   /api/{date}/cms/blocks
GET    /api/{date}/cms/blocks/{id}
PATCH  /api/{date}/cms/blocks/{id}
DELETE /api/{date}/cms/blocks/{id}
GET    /api/{date}/cms/blocks/{id}/usage                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              # where used
GET    /api/{date}/cms/blocks/catalog                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  # available kinds + schemas
```

### 8.4 Menus

```
GET    /api/{date}/cms/menus
POST   /api/{date}/cms/menus
GET    /api/{date}/cms/menus/{id}
PATCH  /api/{date}/cms/menus/{id}
DELETE /api/{date}/cms/menus/{id}
GET    /api/{date}/cms/menus/{id}/items
POST   /api/{date}/cms/menus/{id}/items
PATCH  /api/{date}/cms/menus/{id}/items/{item_id}
DELETE /api/{date}/cms/menus/{id}/items/{item_id}
POST   /api/{date}/cms/menus/{id}/items:reorder
```

### 8.5 Redirects

```
GET    /api/{date}/cms/redirects
POST   /api/{date}/cms/redirects
GET    /api/{date}/cms/redirects/{id}
PATCH  /api/{date}/cms/redirects/{id}
DELETE /api/{date}/cms/redirects/{id}
POST   /api/{date}/cms/redirects:bulk-import                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                # CSV
POST   /api/{date}/cms/redirects:test                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                # body: { url } returns target if redirected
GET    /api/{date}/cms/redirects/analytics                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                # hit counts
```

### 8.6 Forms

```
GET    /api/{date}/cms/forms
POST   /api/{date}/cms/forms
GET    /api/{date}/cms/forms/{id}
PATCH  /api/{date}/cms/forms/{id}
DELETE /api/{date}/cms/forms/{id}
GET    /api/{date}/cms/forms/{id}/submissions
GET    /api/{date}/cms/forms/{id}/submissions/{submission_id}
POST   /api/{date}/cms/forms/{id}/submissions/{submission_id}:mark-processed
DELETE /api/{date}/cms/forms/{id}/submissions/{submission_id}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  # GDPR
POST   /api/{date}/cms/forms/{id}/submissions:export                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            # CSV download (async)
```

### 8.7 Knowledge base + FAQ

```
GET    /api/{date}/cms/kb-articles
POST   /api/{date}/cms/kb-articles
GET    /api/{date}/cms/kb-articles/{id}
PATCH  /api/{date}/cms/kb-articles/{id}
DELETE /api/{date}/cms/kb-articles/{id}
GET    /api/{date}/cms/kb-categories
POST   /api/{date}/cms/kb-categories
PATCH  /api/{date}/cms/kb-categories/{id}
DELETE /api/{date}/cms/kb-categories/{id}

GET    /api/{date}/cms/faqs
POST   /api/{date}/cms/faqs
PATCH  /api/{date}/cms/faqs/{id}
DELETE /api/{date}/cms/faqs/{id}
GET    /api/{date}/cms/faqs/groups
```

### 8.8 Approval (Fáze 2)

```
GET    /api/{date}/cms/approvals
POST   /api/{date}/cms/approvals                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      # request review
POST   /api/{date}/cms/approvals/{id}:approve
POST   /api/{date}/cms/approvals/{id}:reject
POST   /api/{date}/cms/approvals/{id}:withdraw
```

### 8.9 Storefront (public, read-only)

```
GET    /api/{date}/storefront/cms/pages/{slug}
GET    /api/{date}/storefront/cms/blog/posts                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          # list, paginated
GET    /api/{date}/storefront/cms/blog/posts/{slug}
GET    /api/{date}/storefront/cms/blog/categories/{slug}
GET    /api/{date}/storefront/cms/blog/tags/{slug}
GET    /api/{date}/storefront/cms/blog/feed.rss
GET    /api/{date}/storefront/cms/blog/feed.atom
GET    /api/{date}/storefront/cms/menus/{code}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      # resolved tree
GET    /api/{date}/storefront/cms/kb-articles/{slug}
GET    /api/{date}/storefront/cms/kb-articles
GET    /api/{date}/storefront/cms/faqs?group={code}

POST   /api/{date}/storefront/cms/forms/{code}:submit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              # form submission
POST   /api/{date}/storefront/cms/kb-articles/{slug}:vote-helpful                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          # body: { helpful: bool }
POST   /api/{date}/storefront/cms/faqs/{id}:vote-helpful
POST   /api/{date}/storefront/cms/pages/{slug}/unlock                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          # password-protected
```

### 8.10 Example: Publish page with scheduled publish

```http
POST /api/2026-05-20/cms/pages/pag_aB:schedule HTTP/1.1
Authorization: Bearer ...

{
  "publish_at": "2026-06-01T10:00:00Z",
  "notes": "Summer campaign launch"
}
```

```jsonc
HTTP/1.1 200 OK
{
  "data": {
    "id": "pag_aB",
    "status": "scheduled",
    "publish_at": "2026-06-01T10:00:00Z",
    "current_revision_id": "pre_xY"
  }
}
```

### 8.11 Example: Form submission

```http
POST /api/2026-05-20/storefront/cms/forms/contact:submit HTTP/1.1
Content-Type: application/json
X-Turnstile-Token: <token>

{
  "name": "Anna Nováková",
  "email": "anna@example.com",
  "subject": "Question about shipping",
  "message": "...",
  "gdpr_consent": true,
  "marketing_consent": false,
  "source_page_url": "https://shop.example.com/contact"
}
```

```jsonc
HTTP/1.1 201 Created
{
  "data": {
    "submission_id": "fms_aB",
    "success_message": "Thanks! We'll get back to you within 24 hours.",
    "redirect_url": null
  }
}
```

### 8.12 Example: Resolve storefront menu

```http
GET /api/2026-05-20/storefront/cms/menus/header HTTP/1.1
Accept-Language: cs-CZ
```

```jsonc
HTTP/1.1 200 OK
Cache-Control: max-age=60

{
  "data": {
    "menu_code": "header",
    "items": [
      {
        "id": "mni_aB",
        "label": "Obchod",
        "url": "/collections/all",
        "children": [
          { "id": "mni_xY", "label": "Novinky", "url": "/collections/new", "badge_label": "Nové" },
          { "id": "mni_zZ", "label": "Výprodej", "url": "/collections/sale" }
        ]
      },
      { "id": "mni_bC", "label": "Blog", "url": "/blog" },
      { "id": "mni_dE", "label": "O nás", "url": "/about-us" },
      { "id": "mni_fG", "label": "Kontakt", "url": "/contact" }
    ]
  }
}
```

---

## 9. GraphQL schema

### 9.1 Types — pages + blog

```graphql
type CmsPage implements Node & Timestamped {
  id: ID!
  pubId: String!
  slug: String!
  title: String!
  subtitle: String
  pageKind: CmsPageKind!
  templateKind: String
  contentBlocks: JSON!
  isPasswordProtected: Boolean!
  status: CmsContentStatus!
  publishAt: DateTime
  unpublishAt: DateTime
  visibilityKind: CmsVisibilityKind!
  seo: CmsSeoSettings!
  redirectToUrl: String
  redirectStatusCode: Int
  defaultLocale: String!
  availableLocales: [String!]!
  primaryAuthor: User
  publishedRevision: CmsPageRevision
  currentRevision: CmsPageRevision
  translations: [CmsPageTranslation!]!
  translation(locale: String!): CmsPageTranslation
  viewCount: Int!
  appliesToStores: [Store!]
  publishedAt: DateTime
  archivedAt: DateTime
  createdAt: DateTime!
  updatedAt: DateTime!
}

enum CmsPageKind { REGULAR LANDING LEGAL HELP CUSTOM PASSWORD_PROTECTED REDIRECT_TO }
enum CmsContentStatus { DRAFT SCHEDULED PUBLISHED UNPUBLISHED ARCHIVED }
enum CmsVisibilityKind { PUBLIC CUSTOMER_ONLY B2B_ONLY STAFF_ONLY PRIVATE_LINK_ONLY }

type CmsSeoSettings {
  title: String
  description: String
  canonicalUrl: String
  ogImage: Media
  ogTitle: String
  ogDescription: String
  index: Boolean!
  follow: Boolean!
  priority: Float
  changeFrequency: SeoChangeFrequency
  jsonLd: JSON
}

enum SeoChangeFrequency { ALWAYS HOURLY DAILY WEEKLY MONTHLY YEARLY NEVER }

type CmsPageRevision implements Node {
  id: ID!
  page: CmsPage!
  revisionNumber: Int!
  kind: CmsRevisionKind!
  title: String!
  subtitle: String
  contentBlocks: JSON!
  seoSnapshot: JSON
  notes: String
  createdAt: DateTime!
  createdBy: User
  publishedAt: DateTime
}

enum CmsRevisionKind { DRAFT PUBLISHED ARCHIVED AUTOSAVE }

type CmsPageTranslation {
  id: ID!
  page: CmsPage!
  locale: String!
  title: String!
  subtitle: String
  slug: String!
  contentBlocks: JSON!
  seoTitle: String
  seoDescription: String
  ogTitle: String
  ogDescription: String
  translationStatus: TranslationStatus!
  isMachineTranslated: Boolean!
  lastTranslatedAt: DateTime
  lastReviewedAt: DateTime
  lastReviewedBy: User
}

enum TranslationStatus { MISSING MACHINE_TRANSLATED HUMAN_REVIEWING REVIEWED OUTDATED }

type CmsBlogPost implements Node & Timestamped {
  id: ID!
  pubId: String!
  slug: String!
  title: String!
  subtitle: String
  excerpt: String
  contentBlocks: JSON!
  readingTimeMinutes: Int
  wordCount: Int
  featuredImage: Media
  featuredImageAlt: String
  category: CmsBlogCategory
  tags: [CmsBlogTag!]!
  primaryAuthor: User!
  coAuthors: [User!]
  status: CmsContentStatus!
  publishAt: DateTime
  unpublishAt: DateTime
  visibilityKind: CmsVisibilityKind!
  seo: CmsSeoSettings!
  defaultLocale: String!
  availableLocales: [String!]!
  translations: [CmsBlogPostTranslation!]!
  translation(locale: String!): CmsBlogPostTranslation
  viewCount: Int!
  shareCount: Int!
  appliesToStores: [Store!]
  publishedAt: DateTime
  createdAt: DateTime!
  updatedAt: DateTime!
}

type CmsBlogPostTranslation {
  id: ID!
  post: CmsBlogPost!
  locale: String!
  title: String!
  slug: String!
  excerpt: String
  contentBlocks: JSON!
  seoTitle: String
  seoDescription: String
  translationStatus: TranslationStatus!
  isMachineTranslated: Boolean!
}

type CmsBlogCategory {
  id: ID!
  pubId: String!
  slug: String!
  name: String!
  description: String
  parentCategory: CmsBlogCategory
  childCategories: [CmsBlogCategory!]!
  posts(first: Int, after: String): CmsBlogPostConnection!
  postCount: Int!
  displayOrder: Int!
  isActive: Boolean!
}

type CmsBlogTag {
  id: ID!
  pubId: String!
  slug: String!
  name: String!
  color: String
  postCount: Int!
}
```

### 9.2 Types — blocks, menus, redirects, forms, KB, FAQ

```graphql
type CmsBlock implements Node {
  id: ID!
  pubId: String!
  code: String!
  name: String!
  description: String
  blockKind: String!
  settings: JSON!
  isGlobal: Boolean!
  usageCount: Int!
  availableLocales: [String!]!
  translations: [CmsBlockTranslation!]!
  usedOnPages: [CmsPage!]!
  usedInPosts: [CmsBlogPost!]!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type CmsBlockTranslation {
  id: ID!
  block: CmsBlock!
  locale: String!
  settings: JSON!
  translationStatus: TranslationStatus!
}

type CmsMenu implements Node {
  id: ID!
  pubId: String!
  code: String!
  name: String!
  menuKind: CmsMenuKind!
  items: [CmsMenuItem!]!
  appliesToStores: [Store!]
  createdAt: DateTime!
  updatedAt: DateTime!
}

enum CmsMenuKind { HEADER FOOTER SIDEBAR MEGA_MENU FOOTER_LEGAL MOBILE_DRAWER CUSTOM }

type CmsMenuItem {
  id: ID!
  menu: CmsMenu!
  parent: CmsMenuItem
  position: Int!
  targetKind: CmsMenuItemTargetKind!
  resolvedUrl: String!
  label: String!
  iconName: String
  description: String
  badgeLabel: String
  openInNewTab: Boolean!
  isActive: Boolean!
  visibilityKind: CmsMenuItemVisibility!
  children: [CmsMenuItem!]!
  translations: [CmsMenuItemTranslation!]!
}

enum CmsMenuItemTargetKind {
  EXTERNAL_URL INTERNAL_ROUTE CMS_PAGE PRODUCT CATEGORY COLLECTION
  BLOG_POST BLOG_CATEGORY SEARCH LOGIN REGISTER HEADING_ONLY
}
enum CmsMenuItemVisibility { ALWAYS PUBLIC_ONLY CUSTOMER_ONLY B2B_ONLY STAFF_ONLY HIDDEN }

type CmsMenuItemTranslation {
  id: ID!
  menuItem: CmsMenuItem!
  locale: String!
  label: String!
  description: String
  badgeLabel: String
}

type CmsRedirect implements Node {
  id: ID!
  pubId: String!
  sourcePath: String!
  isRegex: Boolean!
  caseSensitive: Boolean!
  hostMatch: String
  targetUrl: String!
  statusCode: Int!
  preserveQueryString: Boolean!
  isActive: Boolean!
  activeFrom: DateTime
  activeUntil: DateTime
  hitCount: Int!
  lastHitAt: DateTime
  sourceKind: CmsRedirectSourceKind!
  notes: String
  createdAt: DateTime!
  createdBy: User
}

enum CmsRedirectSourceKind { MANUAL AUTO_SLUG_CHANGE BULK_IMPORT MIGRATION }

type CmsForm implements Node {
  id: ID!
  pubId: String!
  code: String!
  name: String!
  formKind: CmsFormKind!
  fieldSchema: JSON!
  redirectAfterSubmitUrl: String
  successMessageHtml: String
  notifyEmailAddresses: [String!]
  requireTurnstile: Boolean!
  rateLimitPerIpHour: Int!
  requireGdprConsentCheckbox: Boolean!
  gdprConsentText: String
  marketingConsentOptional: Boolean!
  submissionCount: Int!
  lastSubmissionAt: DateTime
  retentionDays: Int!
  isActive: Boolean!
  createdAt: DateTime!
}

enum CmsFormKind { CONTACT NEWSLETTER RFQ GATED_DOWNLOAD CUSTOM SURVEY }

type CmsFormSubmission implements Node {
  id: ID!
  pubId: String!
  form: CmsForm!
  fieldValues: JSON!
  sourcePageUrl: String
  submitterCustomer: Customer
  submitterEmail: String
  status: CmsFormSubmissionStatus!
  processingNotes: String
  gdprConsentGiven: Boolean!
  marketingConsentGiven: Boolean
  attachments: JSON
  submittedAt: DateTime!
  processedAt: DateTime
  retentionExpiresAt: DateTime
}

enum CmsFormSubmissionStatus { RECEIVED PROCESSING PROCESSED SPAM REJECTED }

type CmsKbArticle implements Node {
  id: ID!
  pubId: String!
  slug: String!
  title: String!
  summary: String
  contentBlocks: JSON!
  category: CmsKbCategory
  status: CmsContentStatus!
  visibilityKind: CmsVisibilityKind!
  viewCount: Int!
  helpfulYesCount: Int!
  helpfulNoCount: Int!
  seo: CmsSeoSettings!
  defaultLocale: String!
  availableLocales: [String!]!
  primaryAuthor: User
  relatedArticles: [CmsKbArticle!]
  relatedProducts: [Product!]
  publishedAt: DateTime
  createdAt: DateTime!
  updatedAt: DateTime!
}

type CmsKbCategory {
  id: ID!
  pubId: String!
  slug: String!
  name: String!
  description: String
  parentCategory: CmsKbCategory
  iconName: String
  articles(first: Int, after: String): CmsKbArticleConnection!
  articleCount: Int!
  displayOrder: Int!
  isActive: Boolean!
}

type CmsFaq {
  id: ID!
  pubId: String!
  groupCode: String!
  question: String!
  answerBlocks: JSON!
  displayOrder: Int!
  isActive: Boolean!
  relatedProducts: [Product!]
  relatedCategories: [Category!]
  viewCount: Int!
  helpfulYesCount: Int!
  helpfulNoCount: Int!
  includeInSchemaOrg: Boolean!
  defaultLocale: String!
  availableLocales: [String!]!
}

type CmsApprovalRequest implements Node {
  id: ID!
  pubId: String!
  resourceKind: String!
  resourceId: String!
  revisionId: String!
  requestedBy: User!
  status: CmsApprovalStatus!
  reviewer: User
  reviewNotes: String
  requestedAt: DateTime!
  reviewedAt: DateTime
  expiresAt: DateTime
}

enum CmsApprovalStatus { PENDING APPROVED REJECTED WITHDRAWN EXPIRED }
```

### 9.3 Queries + Mutations

```graphql
extend type Query {
  # Pages
  cmsPages(filter: CmsPageFilter, first: Int, after: String): CmsPageConnection! @auth(requires: PERM_CMS_VIEW)
  cmsPage(id: ID, pubId: String, slug: String): CmsPage
  cmsPageRevisions(pageId: ID!): [CmsPageRevision!]!

  # Blog
  cmsBlogPosts(filter: CmsBlogPostFilter, first: Int, after: String): CmsBlogPostConnection!
  cmsBlogPost(id: ID, pubId: String, slug: String): CmsBlogPost
  cmsBlogCategories: [CmsBlogCategory!]!
  cmsBlogCategory(id: ID, slug: String): CmsBlogCategory
  cmsBlogTags: [CmsBlogTag!]!

  # Blocks
  cmsBlocks(filter: CmsBlockFilter): [CmsBlock!]! @auth(requires: PERM_CMS_VIEW)
  cmsBlock(id: ID, code: String): CmsBlock
  cmsBlockCatalog: [CmsBlockKindDefinition!]!

  # Menus
  cmsMenus: [CmsMenu!]!
  cmsMenu(id: ID, code: String): CmsMenu

  # Redirects
  cmsRedirects(filter: CmsRedirectFilter, first: Int, after: String): CmsRedirectConnection! @auth(requires: PERM_CMS_REDIRECTS_VIEW)
  cmsRedirect(id: ID!): CmsRedirect
  testRedirectMatch(url: String!): RedirectTestResult!

  # Forms
  cmsForms(filter: CmsFormFilter): [CmsForm!]! @auth(requires: PERM_CMS_FORMS_VIEW)
  cmsForm(id: ID, code: String): CmsForm
  cmsFormSubmissions(formId: ID!, filter: CmsFormSubmissionFilter, first: Int, after: String): CmsFormSubmissionConnection! @auth(requires: PERM_CMS_FORMS_VIEW)
  cmsFormSubmission(id: ID!): CmsFormSubmission

  # KB + FAQ
  cmsKbArticles(filter: CmsKbArticleFilter): [CmsKbArticle!]!
  cmsKbArticle(id: ID, slug: String): CmsKbArticle
  cmsKbCategories: [CmsKbCategory!]!
  cmsFaqs(groupCode: String): [CmsFaq!]!

  # Approvals (Fáze 2)
  cmsApprovalRequests(status: [CmsApprovalStatus!]): [CmsApprovalRequest!]! @auth(requires: PERM_CMS_APPROVE)
}

extend type Mutation {
  # Pages
  createCmsPage(input: CreateCmsPageInput!): CmsPage! @auth(requires: PERM_CMS_EDIT)
  updateCmsPage(id: ID!, input: UpdateCmsPageInput!): CmsPage! @auth(requires: PERM_CMS_EDIT)
  savePageDraft(id: ID!, input: SavePageDraftInput!): CmsPageRevision! @auth(requires: PERM_CMS_EDIT)
  autosavePageDraft(id: ID!, contentBlocks: JSON!): CmsPageRevision!
  publishCmsPage(id: ID!, notes: String): CmsPage! @auth(requires: PERM_CMS_PUBLISH)
  unpublishCmsPage(id: ID!, reason: String): CmsPage! @auth(requires: PERM_CMS_PUBLISH)
  scheduleCmsPage(id: ID!, publishAt: DateTime!, unpublishAt: DateTime): CmsPage! @auth(requires: PERM_CMS_PUBLISH)
  restoreCmsPageRevision(pageId: ID!, revisionId: ID!): CmsPage! @auth(requires: PERM_CMS_EDIT)
  archiveCmsPage(id: ID!): CmsPage! @auth(requires: PERM_CMS_PUBLISH)
  generateCmsPagePreviewUrl(pageId: ID!, revisionId: ID): String!

  # Page translations
  upsertCmsPageTranslation(pageId: ID!, locale: String!, input: CmsPageTranslationInput!): CmsPageTranslation! @auth(requires: PERM_CMS_TRANSLATE)
  deleteCmsPageTranslation(pageId: ID!, locale: String!): DeletePayload! @auth(requires: PERM_CMS_TRANSLATE)
  autoTranslateCmsPage(pageId: ID!, targetLocale: String!, provider: TranslationProvider = DEEPL): CmsPageTranslation!

  # Blog
  createBlogPost(input: CreateBlogPostInput!): CmsBlogPost! @auth(requires: PERM_CMS_EDIT)
  updateBlogPost(id: ID!, input: UpdateBlogPostInput!): CmsBlogPost!
  publishBlogPost(id: ID!): CmsBlogPost! @auth(requires: PERM_CMS_PUBLISH)
  scheduleBlogPost(id: ID!, publishAt: DateTime!): CmsBlogPost!
  archiveBlogPost(id: ID!): CmsBlogPost!
  upsertBlogCategory(input: BlogCategoryInput!): CmsBlogCategory!
  upsertBlogTag(input: BlogTagInput!): CmsBlogTag!

  # Blocks
  createCmsBlock(input: CreateCmsBlockInput!): CmsBlock! @auth(requires: PERM_CMS_EDIT)
  updateCmsBlock(id: ID!, input: UpdateCmsBlockInput!): CmsBlock!
  deleteCmsBlock(id: ID!): DeletePayload!

  # Menus
  upsertCmsMenu(input: UpsertCmsMenuInput!): CmsMenu! @auth(requires: PERM_CMS_MENUS_EDIT)
  deleteCmsMenu(id: ID!): DeletePayload!
  reorderMenuItems(menuId: ID!, orderedItems: [MenuItemPositionInput!]!): CmsMenu!

  # Redirects
  createCmsRedirect(input: CreateCmsRedirectInput!): CmsRedirect! @auth(requires: PERM_CMS_REDIRECTS_MANAGE)
  updateCmsRedirect(id: ID!, input: UpdateCmsRedirectInput!): CmsRedirect!
  deleteCmsRedirect(id: ID!): DeletePayload!
  bulkImportRedirects(csvFileMediaId: ID!): BulkImportResult!

  # Forms
  createCmsForm(input: CreateCmsFormInput!): CmsForm! @auth(requires: PERM_CMS_FORMS_MANAGE)
  updateCmsForm(id: ID!, input: UpdateCmsFormInput!): CmsForm!
  deleteCmsForm(id: ID!): DeletePayload!
  markFormSubmissionProcessed(id: ID!, notes: String): CmsFormSubmission!
  deleteFormSubmission(id: ID!, reason: String!): DeletePayload!                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          # GDPR

  # KB + FAQ
  createKbArticle(input: CreateKbArticleInput!): CmsKbArticle! @auth(requires: PERM_CMS_KB_MANAGE)
  updateKbArticle(id: ID!, input: UpdateKbArticleInput!): CmsKbArticle!
  publishKbArticle(id: ID!): CmsKbArticle!
  upsertKbCategory(input: KbCategoryInput!): CmsKbCategory!
  upsertFaq(input: FaqInput!): CmsFaq!

  # Approvals (Fáze 2)
  requestCmsApproval(input: RequestApprovalInput!): CmsApprovalRequest! @auth(requires: PERM_CMS_DRAFT)
  approveCmsRequest(id: ID!, notes: String): CmsApprovalRequest! @auth(requires: PERM_CMS_APPROVE)
  rejectCmsRequest(id: ID!, notes: String!): CmsApprovalRequest! @auth(requires: PERM_CMS_APPROVE)
  withdrawCmsApprovalRequest(id: ID!): CmsApprovalRequest!
}

enum TranslationProvider { DEEPL GOOGLE OPENAI ANTHROPIC }
```

---

## 10. Events

| Build-spec ID | Wire | Payload |
|---|---|---|
| `EVENT-CMS-PAGE-CREATED` | `cms.page_created` | `{ page }` |
| `EVENT-CMS-PAGE-DRAFT-SAVED` | `cms.page_draft_saved` | `{ page, revision }` |
| `EVENT-CMS-PAGE-PUBLISHED` | `cms.page_published` | `{ page, revision }` |
| `EVENT-CMS-PAGE-SCHEDULED` | `cms.page_scheduled` | `{ page, publish_at }` |
| `EVENT-CMS-PAGE-UNPUBLISHED` | `cms.page_unpublished` | `{ page, reason }` |
| `EVENT-CMS-PAGE-ARCHIVED` | `cms.page_archived` | `{ page }` |
| `EVENT-CMS-PAGE-RESTORED-FROM-REVISION` | `cms.page_restored_from_revision` | `{ page, revision }` |
| `EVENT-CMS-PAGE-TRANSLATION-CREATED` | `cms.page_translation_created` | `{ page, locale }` |
| `EVENT-CMS-PAGE-TRANSLATION-OUTDATED` | `cms.page_translation_outdated` | `{ page, locales }` |
| `EVENT-CMS-PAGE-SLUG-CHANGED` | `cms.page_slug_changed` | `{ page, old_slug, new_slug, redirect_id }` |
| `EVENT-CMS-BLOG-POST-PUBLISHED` | `cms.blog_post_published` | `{ post }` |
| `EVENT-CMS-BLOG-POST-SCHEDULED` | `cms.blog_post_scheduled` | `{ post, publish_at }` |
| `EVENT-CMS-BLOG-POST-ARCHIVED` | `cms.blog_post_archived` | `{ post }` |
| `EVENT-CMS-BLOCK-CREATED` | `cms.block_created` | `{ block }` |
| `EVENT-CMS-BLOCK-UPDATED` | `cms.block_updated` | `{ block }` |
| `EVENT-CMS-BLOCK-DELETED` | `cms.block_deleted` | `{ block_id }` |
| `EVENT-CMS-MENU-UPDATED` | `cms.menu_updated` | `{ menu }` |
| `EVENT-CMS-REDIRECT-CREATED` | `cms.redirect_created` | `{ redirect }` |
| `EVENT-CMS-REDIRECT-AUTO-CREATED-ON-SLUG-CHANGE` | `cms.redirect_auto_created_on_slug_change` | `{ redirect, old_slug, new_slug }` |
| `EVENT-CMS-REDIRECT-LOOP-DETECTED` | `cms.redirect_loop_detected` | `{ chain }` |
| `EVENT-CMS-FORM-SUBMISSION-RECEIVED` | `cms.form_submission_received` | `{ submission }` |
| `EVENT-CMS-FORM-SUBMISSION-MARKED-SPAM` | `cms.form_submission_marked_spam` | `{ submission, reason }` |
| `EVENT-CMS-FORM-SUBMISSION-PROCESSED` | `cms.form_submission_processed` | `{ submission }` |
| `EVENT-CMS-NEWSLETTER-FORM-SUBSCRIBED` | `cms.newsletter_form_subscribed` | `{ submission, customer }` (handoff to `19`) |
| `EVENT-CMS-KB-ARTICLE-PUBLISHED` | `cms.kb_article_published` | `{ article }` |
| `EVENT-CMS-KB-ARTICLE-VOTED-HELPFUL` | `cms.kb_article_voted_helpful` | `{ article, helpful }` |
| `EVENT-CMS-FAQ-VOTED-HELPFUL` | `cms.faq_voted_helpful` | `{ faq, helpful }` |
| `EVENT-CMS-APPROVAL-REQUESTED` | `cms.approval_requested` | `{ request }` |
| `EVENT-CMS-APPROVAL-APPROVED` | `cms.approval_approved` | `{ request }` |
| `EVENT-CMS-APPROVAL-REJECTED` | `cms.approval_rejected` | `{ request, notes }` |
| `EVENT-CMS-CONTENT-IMPORTED` | `cms.content_imported` | `{ source, count, errors }` |

**Konzumenti:**
- Search index (per `08`) — page publish/update reindex
- Sitemap regenerate (per `19`)
- llms.txt regenerate
- CDN cache invalidate
- Marketing email automation (per `19`) — newsletter signup handoff
- Translation service (DeepL via `29`) — outdated translations
- Webhooks (per `28`)
- Analytics (per `20`) — content engagement
- Notifications (per `27`) — approvals, scheduled publish complete

---

## 11. Background jobs

| Job | Trigger | Queue | Frequency |
|---|---|---|---|
| `JOB-PUBLISH-SCHEDULED-CONTENT` | scheduled | `cms` | Every 1 min |
| `JOB-AUTO-UNPUBLISH-EXPIRED-CONTENT` | scheduled | `cms` | Every 1 min |
| `JOB-AUTO-CREATE-REDIRECT-ON-SLUG-CHANGE` | EVENT-CMS-PAGE-SLUG-CHANGED, blog post slug change | `cms` | On-demand |
| `JOB-DETECT-REDIRECT-CHAINS` | EVENT-CMS-REDIRECT-CREATED | `cms` | On-demand (collapse to direct redirect) |
| `JOB-MARK-TRANSLATIONS-OUTDATED-ON-SOURCE-CHANGE` | EVENT-CMS-PAGE-PUBLISHED, blog post publish | `cms` | On-demand (content-diff threshold check) |
| `JOB-AUTOSAVE-PAGE-DRAFT` | API call from editor | `cms` | Continuous (per editor) |
| `JOB-ARCHIVE-OLD-REVISIONS` | scheduled | `cms` | Daily (keep 50; archive older) |
| `JOB-COMPUTE-READING-TIME` | EVENT-CMS-BLOG-POST-PUBLISHED + draft save | `cms` | On-demand |
| `JOB-REGENERATE-SITEMAP` | EVENT-CMS-PAGE-PUBLISHED, EVENT-CMS-BLOG-POST-PUBLISHED, EVENT-CMS-KB-ARTICLE-PUBLISHED | `seo` | Debounced 5 min |
| `JOB-REGENERATE-LLMS-TXT` | same triggers | `seo` | Debounced 5 min |
| `JOB-REINDEX-SEARCH-FOR-CONTENT` | EVENT-CMS-* publish/update | `search` | Debounced 5 min |
| `JOB-INVALIDATE-CDN-CACHE-FOR-CONTENT` | EVENT-CMS-* publish/update | `cache` | On-demand |
| `JOB-PURGE-OLD-FORM-SUBMISSIONS` | scheduled | `gdpr` | Daily |
| `JOB-DELIVER-FORM-NOTIFICATION-EMAIL` | EVENT-CMS-FORM-SUBMISSION-RECEIVED | `notifications` | On-demand |
| `JOB-DELIVER-FORM-NOTIFICATION-SLACK` | EVENT-CMS-FORM-SUBMISSION-RECEIVED | `notifications` | On-demand |
| `JOB-SEND-FORM-SUBMISSION-CONFIRMATION` | EVENT-CMS-FORM-SUBMISSION-RECEIVED (if send_confirmation_email_to_submitter=true) | `notifications` | On-demand |
| `JOB-AUTO-TRANSLATE-VIA-DEEPL` | manual trigger or auto via integration policy | `translations` | On-demand (per `29-integrations.md`) |
| `JOB-RECOMPUTE-MENU-RESOLVED-TREE` | EVENT-CMS-MENU-UPDATED, related target resource publish/unpublish | `cms` | On-demand |
| `JOB-EXPIRE-APPROVAL-REQUESTS` | scheduled | `cms` | Daily |
| `JOB-NOTIFY-APPROVAL-REQUESTED` | EVENT-CMS-APPROVAL-REQUESTED | `notifications` | On-demand |
| `JOB-IMPORT-CMS-CONTENT` | manual trigger (admin upload) | `cms-import` | On-demand |
| `JOB-COMPUTE-CONTENT-ANALYTICS` | scheduled | `analytics` | Hourly aggregate |
| `JOB-AGGREGATE-VIEW-COUNTS` | scheduled | `analytics` | Hourly (push pageviews → cms_pages.view_count) |
| `JOB-DETECT-BROKEN-INTERNAL-LINKS` | scheduled | `seo` | Daily (publish report) |
| `JOB-RUN-CONTENT-QA-CHECKS` | EVENT-CMS-PAGE-DRAFT-SAVED (if QA enabled) | `cms` | On-demand |
| `JOB-AI-GENERATE-CONTENT` | manual trigger from editor | `ai-cms` | On-demand (per `33`) |

---

## 12. UI/UX flows

### FLOW-CMS-001: Create + publish landing page

```
[Admin → /content/pages → "New page"]
   - Title: "Summer Sale 2026"
   - Slug auto-generated from title: "summer-sale-2026"
   - Template: Landing page
        ↓
[Page editor opens]
   - Left: block tree
   - Center: live preview iframe (draft revision)
   - Right: settings panel + SEO accordion
        ↓
   user adds Hero block → settings: heading, image, CTA
   adds Featured Products block → picks 6 products
   adds Newsletter Signup block → references global block
   adds FAQ list block → picks "summer_sale" group
        ↓
   autosave every 30s → revision (kind='autosave')
        ↓
   user clicks "Save draft" → kind='draft'
        ↓
   user clicks "Preview" → signed URL (24h) → opens new tab
        ↓
   approval (Fáze 2): "Request approval" → manager reviews
        ↓
   user clicks "Publish" OR schedules for "2026-06-01 09:00 CET"
        ↓
[Status → published or scheduled]
   - URL: /pages/summer-sale-2026
   - Sitemap regenerated
   - Search reindexed
   - CDN purged
   - llms.txt updated
```

### FLOW-CMS-002: Translate page

```
[Page detail → Translations tab]
   - Available locales: cs-CZ (default, published), en-US (missing), de-DE (outdated)
        ↓
   click "Translate to en-US"
        ↓
[Side-by-side editor]
   - Left: cs-CZ source (read-only)
   - Right: en-US target (editable)
   - "Auto-translate via DeepL" button
        ↓
   click auto-translate
        ↓
[All text fields populated; translation_status='machine_translated']
   - Translator reviews + edits
   - Saves → translation_status='reviewed'
        ↓
[URL active: /en-us/pages/summer-sale-2026]
   - Hreflang tags added (per 19)
   - Sitemap includes both locales
```

### FLOW-CMS-003: Write blog post with AI assist

```
[Admin → /content/blog → "New post"]
   - Title, category, tags
        ↓
[Editor with AI panel open]
   - Outline writing assist (user types intent, AI suggests structure)
   - "Generate intro" → AI streams content
   - User edits + accepts
        ↓
   user writes body, occasionally invokes "Improve this paragraph"
        ↓
   "Generate SEO meta" → AI fills seo_title + seo_description
        ↓
   featured image upload (alt text required per RULE-CMS-024)
        ↓
   reading time auto-computed
        ↓
   publish OR schedule
```

### FLOW-CMS-004: Form submission lifecycle

```
[Customer visits /contact]
   - Form renders from cms_form config
   - Turnstile widget loaded
        ↓
   customer fills fields + checks GDPR consent
        ↓
   submit → POST /storefront/cms/forms/contact:submit
        ↓
[Server: Turnstile verify + rate limit check + Zod validate]
   - Save submission (status='received')
   - Emit EVENT-CMS-FORM-SUBMISSION-RECEIVED
        ↓
[Background jobs]
   - JOB-DELIVER-FORM-NOTIFICATION-EMAIL → ops@merchant.com
   - JOB-DELIVER-FORM-NOTIFICATION-SLACK (if configured)
   - JOB-SEND-FORM-SUBMISSION-CONFIRMATION → customer (auto-reply)
        ↓
[Customer sees success message OR redirect to thank-you page]
```

### FLOW-CMS-005: Manage redirects (post-migration)

```
[Admin → /content/redirects → "Bulk import CSV"]
   - Upload old_url,new_url,status_code
        ↓
[Server validates + creates redirects]
   - Loop detection
   - Duplicate detection (existing source_path → merge or skip)
        ↓
[Import summary: 1247 created, 13 duplicates skipped, 2 loops rejected]
        ↓
   storefront /old-product-slug → 301 → /new-product-slug
   hit_count incremented on each redirect
        ↓
[Analytics dashboard: top redirected paths, dead redirects (zero hits in 90d → suggest cleanup)]
```

### FLOW-CMS-006: Knowledge base browsing (customer)

```
[Customer at /help]
   - Categories grid: Orders, Returns, Shipping, Account, ...
        ↓
   click Returns
        ↓
[Category page]
   - List of articles
   - Search bar (full-text)
        ↓
   click "How to start a return"
        ↓
[Article detail]
   - Content rendered
   - Related articles
   - "Was this helpful?" yes/no
        ↓
   click yes → helpful_yes_count++
   click no → optional feedback form
```

### FLOW-CMS-007: Slug change → auto-redirect

```
[Editor changes /pages/about → /pages/our-story]
        ↓
[Save → EVENT-CMS-PAGE-SLUG-CHANGED]
        ↓
[JOB-AUTO-CREATE-REDIRECT-ON-SLUG-CHANGE]
   - cms_redirects row: '/pages/about' → '/pages/our-story' 301
   - source_kind='auto_slug_change'
   - active 1 year default
        ↓
[Old URL still works: 301 redirect]
[New URL: live]
[SEO preserved (link equity)]
```

---

## 13. Edge cases & error handling

| Scenario | Behavior | Code |
|---|---|---|
| Slug collision on save | Reject with suggestion (e.g., "summer-sale-2026-2") | `SLUG_TAKEN`, 422 |
| Slug uses reserved word | Reject | `RESERVED_SLUG`, 422 |
| Page references deleted global block | Render placeholder "Block unavailable"; admin notified | (handled) |
| Theme switch removes supported block kind | Block preserved; "Unavailable in current theme" placeholder | (handled per RULE-CMS-005) |
| Concurrent edit (stale revision) | 412 with diff UI | `RESOURCE_VERSION_MISMATCH`, 412 |
| Approval reviewer = author | Reject (segregation of duties) | `SELF_APPROVAL_FORBIDDEN`, 403 |
| Schedule publish_at in past | Reject (use immediate publish instead) | `INVALID_PUBLISH_AT`, 422 |
| Translation source content unchanged after update | Stay 'reviewed' (heuristic prevents false outdated) | (handled) |
| Form submission with marketing consent off | Skip Mailchimp sync per `29 §RULE-INT-027` | (handled) |
| Form submission Turnstile expired | Reject with re-challenge | `TURNSTILE_INVALID`, 401 |
| Form rate limit exceeded | 429 with retry-after | `RATE_LIMITED`, 429 |
| Form attachment over size | Reject | `FILE_TOO_LARGE`, 413 |
| Form attachment disallowed type | Reject | `FILE_TYPE_NOT_ALLOWED`, 415 |
| Redirect creates loop | Reject creation | `REDIRECT_LOOP`, 422 |
| Redirect target points to 404 | Allow but warn (target may be future page) | (warning) |
| Redirect host_match not owned by tenant | Reject | `INVALID_HOST`, 422 |
| Bulk import CSV malformed | Process valid rows, report errors per row | (partial success) |
| Knowledge base article private + non-customer accesses | 404 (don't reveal existence) | `NOT_FOUND`, 404 |
| Password-protected page wrong password | 401 with rate-limited retry | `PASSWORD_INVALID`, 401 |
| Menu item target deleted | Item shown with "broken link" warning in admin; hidden on storefront | (handled per RULE-CMS-026) |
| Menu depth > 3 levels | Reject save | `MENU_DEPTH_EXCEEDED`, 422 |
| Block nesting depth > 5 | Reject save | `BLOCK_NESTING_DEPTH_EXCEEDED`, 422 |
| HTML block submitted by user without permission | Reject | `MISSING_PERMISSION`, 403 |
| iframe block with disallowed src | Sanitize OR reject | `IFRAME_SRC_NOT_ALLOWED`, 422 |
| Approval expires | Author notified; resubmit needed | (handled per RULE-CMS-035) |
| Storefront cache stale after publish | CDN purge job; manual purge button available | (handled per RULE-CMS-039) |
| Search index lag after publish | Up to 5 min (debounce); acceptable | (handled) |
| Newsletter form submission for unsubscribed email | Re-subscribe + log consent timestamp | (handled per `18`) |
| Form notification email recipient invalid | Bounce → admin alerted | (handled) |
| Form attachment fails virus scan | Reject submission, log as security event | (handled per `30`) |
| Bulk import of WordPress XML with unmapped blocks | Imported as `rich_text` HTML; editor cleanup recommended | (warning) |
| Translation marked outdated mid-publish | Storefront shows source locale fallback with "(translation outdated)" badge if configured | (handled) |

---

## 14. Performance, security, testing

### 14.1 Performance targets

| Operation | p50 | p95 | p99 |
|---|---|---|---|
| Storefront page render (cached) | 50 ms | 200 ms | 500 ms |
| Storefront page render (cache miss) | 200 ms | 600 ms | 1500 ms |
| Block tree validate + persist (admin save) | 30 ms | 150 ms | 400 ms |
| Page revision diff compute | 50 ms | 200 ms | 500 ms |
| Menu resolve (storefront) | 10 ms | 50 ms | 150 ms (cached) |
| Redirect lookup | 5 ms | 20 ms | 60 ms (in-memory cache) |
| Form submission (incl. Turnstile verify) | 200 ms | 600 ms | 1500 ms |
| Search reindex per page | 100 ms | 500 ms | 2000 ms |
| Sitemap regeneration (full, 10k pages) | 5 s | 20 s | 60 s |
| llms.txt regeneration | 3 s | 15 s | 45 s |
| Auto-translation per page via DeepL | 2 s | 10 s | 30 s |
| Bulk redirect import (1000 rows) | 5 s | 20 s | 60 s |

### 14.2 Scaling

- 100k pages per tenant
- 1M blog posts across tenants
- 10M redirects across tenants (lookup table cached in Redis with bloom filter)
- 100k form submissions/day
- Knowledge base 10k articles per tenant

### 14.3 Security

#### 14.3.1 Permissions

```
PERM-CMS-VIEW
PERM-CMS-EDIT
PERM-CMS-EDIT-OWN                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  # author limited to own resources
PERM-CMS-EDIT-HTML                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          # raw HTML block authoring
PERM-CMS-DRAFT
PERM-CMS-PUBLISH
PERM-CMS-PUBLISH-ALL                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  # any resource
PERM-CMS-APPROVE
PERM-CMS-TRANSLATE
PERM-CMS-SEO-EDIT
PERM-CMS-MENUS-EDIT
PERM-CMS-REDIRECTS-VIEW
PERM-CMS-REDIRECTS-MANAGE
PERM-CMS-FORMS-VIEW
PERM-CMS-FORMS-MANAGE
PERM-CMS-KB-MANAGE
PERM-CMS-BLOCKS-DEVELOP                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  # creating custom block kinds (Fáze 2)
```

#### 14.3.2 Content sanitization

- HTML inside blocks: DOMPurify with strict allowlist (no `<script>`, no `on*` handlers, no `javascript:` URLs)
- Raw HTML block: requires `PERM-CMS-EDIT-HTML` + DOMPurify + admin disclaimer
- iframe block: src allowlist (configurable per tenant; defaults: YouTube, Vimeo, Spotify, SoundCloud)
- Markdown rendered server-side with secure parser (no raw HTML in MD by default)
- File uploads: magic-byte validated, virus scanned (per `30 §10.5`)

#### 14.3.3 Form security

- Turnstile mandatory (skippable only for logged-in customers)
- Rate limited per IP
- Honeypot field
- Time-to-submit anomaly detection (too-fast submissions flagged)
- GDPR consent captured + audit
- Attachments scanned

#### 14.3.4 Redirect security

- Open-redirect attacks prevented: target URL validated (host allowlist for external; internal paths only by default)
- Regex redirects sandboxed (RE2 engine to prevent ReDoS)
- Redirect chains/loops auto-collapsed/rejected

#### 14.3.5 Audit

All security-relevant actions audited (per `30 §8.1`):
- Page publish/unpublish
- Approval decisions
- Form submission view/export
- Translation changes
- Redirect creation/deletion
- HTML block authoring
- Password-protected page password changes

#### 14.3.6 Multi-tenant isolation

RLS enforced (per `30 §5.4`). All CMS tables have `tenant_id`; queries scoped automatically.

### 14.4 Testing

#### 14.4.1 Unit

```
TEST-UNIT-CMS-001  Slug normalization (diacritics, special chars)
TEST-UNIT-CMS-002  Block schema validator (per kind)
TEST-UNIT-CMS-003  Block tree depth checker
TEST-UNIT-CMS-004  Reading time calculator
TEST-UNIT-CMS-005  HTML sanitizer (DOMPurify wrapper)
TEST-UNIT-CMS-006  Reserved slug rejector
TEST-UNIT-CMS-007  Redirect loop detector
TEST-UNIT-CMS-008  Translation outdated heuristic (diff-based)
TEST-UNIT-CMS-009  Menu tree builder (denormalized JSONB from items)
TEST-UNIT-CMS-010  Form schema → Zod validator generator
TEST-UNIT-CMS-011  Content content-block ref resolver (inline vs global)
TEST-UNIT-CMS-012  SEO defaults computation
```

#### 14.4.2 Integration

```
TEST-INT-CMS-001  Create + edit + publish page end-to-end
TEST-INT-CMS-002  Scheduled publish executes at publish_at
TEST-INT-CMS-003  Slug change auto-creates redirect
TEST-INT-CMS-004  Restore from old revision works
TEST-INT-CMS-005  Translation create + auto-translate via DeepL
TEST-INT-CMS-006  Translation source change marks others outdated
TEST-INT-CMS-007  Global block update propagates to all referencing pages
TEST-INT-CMS-008  Theme switch shows placeholder for unsupported blocks
TEST-INT-CMS-009  Form submission lifecycle (Turnstile + notifications + GDPR consent)
TEST-INT-CMS-010  Form spam detection (heuristic + Turnstile fail)
TEST-INT-CMS-011  Bulk redirect import (CSV)
TEST-INT-CMS-012  Redirect chain auto-collapse
TEST-INT-CMS-013  Approval workflow (request → approve → publish)
TEST-INT-CMS-014  KB article publish + search index update
TEST-INT-CMS-015  Multi-locale page rendered at /locale-path
TEST-INT-CMS-016  Sitemap includes published content per locale
TEST-INT-CMS-017  llms.txt regenerates on publish
TEST-INT-CMS-018  Storefront search finds CMS pages + blog posts + KB
TEST-INT-CMS-019  Password-protected page locked + unlocks with correct password
TEST-INT-CMS-020  Cross-tenant RLS blocks access
```

#### 14.4.3 E2E (Playwright)

```
TEST-E2E-CMS-001  Editor: create page with all block kinds, save, publish, view on storefront
TEST-E2E-CMS-002  Translation workflow: cs → en via DeepL → human edit → publish
TEST-E2E-CMS-003  Blog post: write with AI assist, publish, RSS feed updated
TEST-E2E-CMS-004  Contact form: submit, see confirmation, notification email arrives
TEST-E2E-CMS-005  Newsletter form: submit, customer profile created, Mailchimp synced (via `29`)
TEST-E2E-CMS-006  Redirect: change slug, old URL redirects via 301, hit count increments
TEST-E2E-CMS-007  Menu: add items, drag-drop reorder, storefront reflects
TEST-E2E-CMS-008  Knowledge base: customer searches, finds article, votes helpful
TEST-E2E-CMS-009  FAQ: customer expands accordion, votes, FAQPage schema.org rendered
TEST-E2E-CMS-010  Approval (Fáze 2): author requests, manager approves, content publishes
```

#### 14.4.4 Performance

```
TEST-PERF-CMS-001  Page render cache hit ratio > 95% on hot pages
TEST-PERF-CMS-002  Storefront p95 < 200ms for cached pages
TEST-PERF-CMS-003  Sitemap regenerate 10k pages < 30s
TEST-PERF-CMS-004  Redirect lookup p99 < 60ms (10M redirects)
TEST-PERF-CMS-005  Block tree validation < 200ms p95
```

#### 14.4.5 Security

```
TEST-SEC-CMS-001  XSS attempts in WYSIWYG sanitized
TEST-SEC-CMS-002  HTML block restricted to PERM-CMS-EDIT-HTML
TEST-SEC-CMS-003  iframe src allowlist enforced
TEST-SEC-CMS-004  Form Turnstile bypass attempts blocked
TEST-SEC-CMS-005  Form file upload virus + magic-byte check
TEST-SEC-CMS-006  Open redirect prevention
TEST-SEC-CMS-007  Regex redirect ReDoS prevention
TEST-SEC-CMS-008  Password-protected page brute-force lockout
TEST-SEC-CMS-009  Cross-tenant RLS validated
TEST-SEC-CMS-010  Audit log integrity for content changes
```

---

## 15. Implementation checklist

### Backend
- [ ] **[S]** Drizzle schema `packages/db/src/schema/cms/*.ts`
- [ ] **[S]** Migrace `20260613_001_create_cms_tables.sql`
- [ ] **[L]** `CmsPageService` — CRUD, draft/publish/schedule, revisions
- [ ] **[L]** `CmsBlogService` — posts, categories, tags
- [ ] **[L]** `CmsBlockService` — global + inline; usage tracking
- [ ] **[M]** `CmsBlockRendererService` — resolve refs, render to HTML/JSX per theme section
- [ ] **[M]** `CmsBlockValidator` — schema per kind
- [ ] **[M]** `CmsMenuService` + tree resolver
- [ ] **[L]** `CmsRedirectService` — match engine + loop detection + ReDoS-safe regex
- [ ] **[M]** Redirect lookup middleware (early in request pipeline)
- [ ] **[L]** `CmsFormService` — submission + Turnstile + spam + retention purge
- [ ] **[M]** `CmsKbService` + helpful voting
- [ ] **[M]** `CmsFaqService` + schema.org markup
- [ ] **[M]** `CmsApprovalService` (Fáze 2)
- [ ] **[L]** `CmsTranslationService` — per-locale CRUD, outdated detection, DeepL integration
- [ ] **[M]** `CmsImporter` — WordPress XML, Shopify export, CSV
- [ ] **[M]** REST endpoints per §8
- [ ] **[M]** GraphQL types + resolvers per §9
- [ ] **[S]** Storefront API endpoints (read-only, public)
- [ ] **[S]** HTML sanitization wrapper (DOMPurify isomorphic)

### Background jobs
- [ ] **[M]** JOB-PUBLISH-SCHEDULED-CONTENT + JOB-AUTO-UNPUBLISH-EXPIRED-CONTENT
- [ ] **[M]** JOB-AUTO-CREATE-REDIRECT-ON-SLUG-CHANGE + JOB-DETECT-REDIRECT-CHAINS
- [ ] **[M]** JOB-MARK-TRANSLATIONS-OUTDATED-ON-SOURCE-CHANGE
- [ ] **[S]** JOB-ARCHIVE-OLD-REVISIONS
- [ ] **[S]** JOB-COMPUTE-READING-TIME
- [ ] **[M]** JOB-REGENERATE-SITEMAP + JOB-REGENERATE-LLMS-TXT
- [ ] **[M]** JOB-REINDEX-SEARCH-FOR-CONTENT
- [ ] **[M]** JOB-INVALIDATE-CDN-CACHE-FOR-CONTENT
- [ ] **[S]** JOB-PURGE-OLD-FORM-SUBMISSIONS
- [ ] **[M]** JOB-DELIVER-FORM-NOTIFICATION-EMAIL + Slack
- [ ] **[S]** JOB-SEND-FORM-SUBMISSION-CONFIRMATION
- [ ] **[M]** JOB-AUTO-TRANSLATE-VIA-DEEPL (cross-ref `29`)
- [ ] **[S]** JOB-RECOMPUTE-MENU-RESOLVED-TREE
- [ ] **[S]** JOB-EXPIRE-APPROVAL-REQUESTS
- [ ] **[S]** JOB-NOTIFY-APPROVAL-REQUESTED
- [ ] **[M]** JOB-IMPORT-CMS-CONTENT
- [ ] **[M]** JOB-COMPUTE-CONTENT-ANALYTICS + JOB-AGGREGATE-VIEW-COUNTS
- [ ] **[S]** JOB-DETECT-BROKEN-INTERNAL-LINKS
- [ ] **[S]** JOB-RUN-CONTENT-QA-CHECKS
- [ ] **[M]** JOB-AI-GENERATE-CONTENT (cross-ref `33`)

### Frontend — Admin
- [ ] **[XL]** Block-based page editor (visual tree + settings panel + live preview iframe)
- [ ] **[L]** Block library catalog UI (search + insert)
- [ ] **[M]** Global block management
- [ ] **[M]** Blog post editor (similar to page editor + blog-specific fields)
- [ ] **[L]** Menu editor (drag-drop tree + per-locale labels)
- [ ] **[L]** Redirect management (list + bulk import + analytics)
- [ ] **[M]** Form builder (field schema editor with drag-drop)
- [ ] **[M]** Form submissions inbox + processing actions
- [ ] **[M]** Knowledge base + FAQ editors
- [ ] **[L]** Translation side-by-side editor + auto-translate
- [ ] **[M]** Revision history + diff view + rollback
- [ ] **[M]** Approval queue (Fáze 2)
- [ ] **[S]** Bulk import wizard (WordPress XML / Shopify / CSV)
- [ ] **[M]** AI Copilot integration in editor

### Frontend — Storefront
- [ ] **[L]** Page renderer (resolves block tree, calls theme sections)
- [ ] **[M]** Blog index + post detail templates
- [ ] **[M]** Blog category + tag listings + RSS/Atom feeds
- [ ] **[M]** KB index + category + article templates
- [ ] **[M]** FAQ accordion component + schema.org markup
- [ ] **[M]** Form renderer (config-driven; Turnstile widget; client validation)
- [ ] **[M]** Menu renderer (header, footer, mega menu)
- [ ] **[S]** Password-protected page gate
- [ ] **[S]** Redirect middleware (early request pipeline)
- [ ] **[S]** "Outdated translation" banner

### Tests
- [ ] **[L]** Per §14.4

### Docs
- [ ] **[M]** "Building pages with blocks" merchant guide
- [ ] **[M]** "Blog with Shopio" guide
- [ ] **[M]** "Translation workflow" guide
- [ ] **[M]** "Migrating from WordPress / Shopify" guide
- [ ] **[M]** "Form configuration + GDPR" guide
- [ ] **[S]** "Knowledge base setup" guide
- [ ] **[S]** Developer guide: custom block kinds (Fáze 2 plugin)

---

## 16. Open questions

### Q-CMS-001: Block schema versioning
**Otázka:** Block kind schema evolves (new fields added). Existing content still uses old schema.

**Status:** Block-kind manifest declares schema version. Migration scripts upgrade in-place at render time (lazy) and during admin save (eager). Per `RULE-CMS-019` analog from theme.

### Q-CMS-002: Customer comments on blog
**Otázka:** Native comment system OR integrate Disqus / Commento?

**Status:** Out of scope MVP. Fáze 3+ feature. Native preferred for GDPR control; integrated for ease.

### Q-CMS-003: Real-time collaborative editing
**Otázka:** Figma-style multi-cursor on block editor?

**Status:** Out of scope MVP. Optimistic locking (RULE-CMS-008-pattern) sufficient. Fáze 3+ via Yjs/CRDT.

### Q-CMS-004: AI agent direct content edit (MCP write tool)
**Otázka:** Allow Claude / Cursor to publish content via MCP?

**Status:** Read MVP (per `28 §RULE-DEV-045`). Write requires user confirmation per request (per `30 §RULE-SEC-045`). Long-term: trust tiers per agent.

### Q-CMS-005: Static site generation (SSG)
**Otázka:** For high-traffic pages, pre-render at publish + serve static from CDN?

**Status:** Per `26-themes-storefront.md` Next.js Cache Components covers most cases. Fáze 3+ optimization: ISR / fully-static option per page.

### Q-CMS-006: Native search vs Algolia / Meilisearch
**Otázka:** CMS-specific search index OR reuse main search?

**Status:** Reuse Meilisearch (per `08-search-filtering.md`). CMS content indexed alongside products.

### Q-CMS-007: Content scheduling timezone
**Otázka:** `publish_at` in UTC vs tenant timezone vs admin user timezone?

**Status:** Stored UTC. Admin UI converts to user timezone. Editor shows "publishes at X in your time / Y in store timezone".

### Q-CMS-008: Custom field types per tenant
**Otázka:** Tenant defines own field types (custom metafields per `04`) usable in blocks?

**Status:** Cross-ref `04-api-conventions.md` metafields. Block kind `custom_fields` reads tenant's metafield definitions. Fáze 2 feature.

### Q-CMS-009: Sub-second campaign launch precision
**Otázka:** Black Friday flash sale must launch exactly 00:00:00.

**Status:** Out of scope. Cron precision 60s. Customer can use feature flag (per `31 §`) for sub-second toggles if needed; manual coordination.

### Q-CMS-010: Bidirectional content sync (e.g., Shopify content)
**Otázka:** Maintain content in both Shopio + Shopify temporarily during migration?

**Status:** One-time import recommended. Bidirectional sync messy. Cross-ref `29-integrations.md` migration adapter Fáze 2.

### Q-CMS-011: Multi-channel content reuse (POS displays, mobile app)
**Otázka:** Same blog post on website + POS kiosks + mobile app?

**Status:** Storefront API serves content as JSON. POS app + mobile app consume same content. Per `22-multistore-channels.md`.

### Q-CMS-012: Image transformations on-the-fly
**Otázka:** /cdn-cgi/image/.../media.jpg?w=400&q=80 — Cloudflare Image Resizing OR custom service?

**Status:** Cloudflare Polish + Image Resizing MVP. Fáze 2 self-host alternative (imgproxy). Per `31-operations.md`.

### Q-CMS-013: Content embeds — generic oEmbed
**Otázka:** Auto-detect URL → fetch oEmbed metadata → render rich preview?

**Status:** Allowlist (YouTube, Vimeo, Twitter, Instagram, Spotify, SoundCloud, CodePen) MVP. Generic oEmbed Fáze 2.

### Q-CMS-014: Per-user content drafts
**Otázka:** Each editor has personal drafts of same page (forking)?

**Status:** Out of scope MVP. Single shared draft per resource; collaborative editing handles concurrency (Q-CMS-003).

### Q-CMS-015: Knowledge base AI chatbot
**Otázka:** Customer-facing chatbot that searches KB + answers using LLM?

**Status:** Fáze 3+ via `33-ai-features.md`. RAG-pattern over KB articles.

---

## 📅 Změny

| Datum | Změna |
|---|---|
| 2026-05-20 | Initial — CMS & Content domain. Block-based editing (Gutenberg-style), theme-aware rendering, pages + blog + KB + FAQ + forms + menus + redirects, multi-language native, scheduled publish, AI assist, GDPR forms, migration support (WordPress/Shopify), 17 tables, 40 business rules, 30 events, 25 background jobs. |

---

**Konec CMS & Content.**

➡️ Phase 5 (Platform & Tech) **kompletní**. Pokračovat na: [`33-ai-features.md`](33-ai-features.md) (Phase 6: AI & Industry-specific).


