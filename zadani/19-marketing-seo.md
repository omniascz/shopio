# 19 – MARKETING & SEO

> **Doména:** SEO (metadata, sitemap, JSON-LD, robots/llms.txt, redirects), email marketing (templates per locale, transactional + marketing), automation (abandoned cart recovery, welcome series, post-purchase, win-back), newsletters, reviews & ratings, social feeds (Heuréka, Google Shopping, Meta catalog), web push (v1.0+). Marketing consent strictly enforced (per [18-customer-management.md](18-customer-management.md)).

**Datum:** 2026-05-20
**Verze:** 1.0
**Status:** 🟡 DESIGN
**Reference:** [03 §12](03-data-models-master.md#12-marketing-seo--cms) · [18-customer-management.md](18-customer-management.md) · [11-cart.md](11-cart.md) · [16-order-management.md](16-order-management.md) · [29-integrations.md](29-integrations.md)

---

## 📑 Obsah

0. [Domain overview](#0-domain-overview)
1. [References](#1-references)
2. [Personas](#2-personas)
3. [Data models](#3-data-models)
4. [SEO subsystem](#4-seo-subsystem)
5. [Email marketing subsystem](#5-email-marketing-subsystem)
6. [Marketing automation](#6-marketing-automation)
7. [State machines](#7-state-machines)
8. [Business rules](#8-business-rules)
9. [REST API endpoints](#9-rest-api-endpoints)
10. [GraphQL schema](#10-graphql-schema)
11. [Events](#11-events)
12. [Background jobs](#12-background-jobs)
13. [UI/UX flows](#13-uiux-flows)
14. [Edge cases & error handling](#14-edge-cases--error-handling)
15. [Performance](#15-performance)
16. [Security & compliance](#16-security--compliance)
17. [Testing](#17-testing)
18. [Implementation checklist](#18-implementation-checklist)
19. [Open questions](#19-open-questions)

---

## 0. Domain overview

### 0.1 Co tato doména **je**

**SEO subsystem:**
- Per-entity SEO metadata (products, categories, collections, CMS pages, blog posts)
- XML sitemaps (auto-generated, paginated, with image + video extensions)
- robots.txt + llms.txt (AI crawler guidelines)
- JSON-LD structured data (Product, Offer, BreadcrumbList, ItemList, Organization, WebSite, FAQPage)
- Canonical URLs (auto + override)
- Open Graph + Twitter Card meta
- Hreflang for multi-language stores
- 301/302/308 redirects management

**Email marketing:**
- Transactional emails (order_confirmation, password_reset, ...) per locale + theme
- Marketing campaigns (newsletter, promotional blast, segment-targeted)
- Marketing automation flows (abandoned cart, welcome, post-purchase, win-back)
- Email template editor (React Email components OR visual drag-drop, Fáze 2)
- Deliverability monitoring (bounce/spam tracking, sender reputation)
- Email list management (subscribers, segments, preferences)
- SPF/DKIM/DMARC setup helper
- Unsubscribe + List-Unsubscribe header (RFC 8058)

**Marketing channels:**
- Newsletters (one-off + scheduled)
- Marketing automation flows (trigger-based)
- Web push notifications (v1.0+, opt-in via PushAPI)
- SMS marketing (v1.0+, requires SMS provider integration)
- Social media product feeds (Heuréka XML, Google Shopping, Meta Catalog) — Fáze 2 detail per `29-integrations.md`
- Affiliate / referral programs (Fáze 3+)

**Reviews & ratings:**
- Product reviews (1-5 stars + text + media)
- Verified purchase badge
- Moderation queue (admin approval)
- Helpful votes (Fáze 2)
- Review-incentive emails post-purchase

**Wishlist** (cross-cutting; lightweight in MVP)

### 0.2 Co tato doména **NENÍ**

- ❌ Pricing engine + coupon logic (→ `10-pricing-promotions.md`)
- ❌ Customer profile management (→ `18-customer-management.md`)
- ❌ Cart / abandoned cart logic (→ `11-cart.md`; we trigger emails)
- ❌ CMS pages + content blocks (→ `32-cms-content.md`)
- ❌ Storefront themes (→ `26-themes-storefront.md`)
- ❌ Analytics dashboards (→ `20-analytics-reporting.md`)
- ❌ Loyalty program with points/tiers (→ Fáze 2+ plugin)
- ❌ Email provider infrastructure (SMTP, Resend, SES) — integrated, not built; (→ `29-integrations.md`)
- ❌ Customer consent ledger (lives in `18`; we enforce on read)
- ❌ Reviews of plugins/themes in marketplace (→ `28-developer-platform.md`)

### 0.3 Diferenciátory

1. **SEO + JSON-LD nativně** — Product, Offer, BreadcrumbList, ItemList, AggregateRating — server-rendered, AI-crawler-ready
2. **llms.txt** support — emerging standard pro AI crawler guidelines (Anthropic, OpenAI, Perplexity)
3. **Agent-native product feeds** — JSON-LD sitemap + structured data optimized for LLM consumption (`/feeds/json` from `06`)
4. **Marketing automation built-in** — no need for external Klaviyo/Mailchimp for basic flows (plugin marketplace pro advanced)
5. **GDPR-strict consent enforcement** — marketing email send REJECTS if `marketing_email` consent missing/revoked (per `18 RULE-CUST-006`)
6. **Multi-locale email templates** — fallback chain per `23-i18n.md`
7. **EU-first reviews moderation** — auto-detect suspicious content + manual review queue

---

## 1. References

- [03 §12](03-data-models-master.md#12-marketing-seo--cms) — ENT-SEO-METADATA-001 až ENT-BLOG-POST-001
- [18-customer-management.md](18-customer-management.md) — consent enforcement (RULE-CUST-006 → `marketing_email` purpose)
- [11-cart.md](11-cart.md) — abandoned cart triggers
- [16-order-management.md](16-order-management.md) — post-purchase triggers
- [10-pricing-promotions.md](10-pricing-promotions.md) — coupon attached to campaigns
- [06-catalog-pim.md](06-catalog-pim.md) — JSON-LD product output
- [07-categories-taxonomy.md](07-categories-taxonomy.md) — category sitemaps + breadcrumb JSON-LD
- [22-multistore-channels.md](22-multistore-channels.md) — per-channel marketing config
- [23-i18n.md](23-i18n.md) — translations + hreflang
- [29-integrations.md](29-integrations.md) — Email provider, SMS, social feeds plugins
- [32-cms-content.md](32-cms-content.md) — CMS pages SEO
- [33-ai-features.md](33-ai-features.md) — AI-generated subject lines, send-time optimization (Fáze 2+)
- [DEC-AI-001](01-decisions-registry.md#dec-ai-001-default-ai-provider) — AI providers
- [DEC-EVENTS-001](01-decisions-registry.md#dec-events-001-event-bus--background-jobs) — outbox pattern
- Schema.org Product/Offer/AggregateRating spec
- Google Search Central docs (sitemap, structured data)
- llms.txt emerging spec (llmstxt.org)
- RFC 8058 (One-Click Unsubscribe)
- RFC 5322 (Email format)

---

## 2. Personas

| Persona | Použití | Klíčové permissions |
|---|---|---|
| `PERSONA-MERCHANT-OWNER` | Full marketing + SEO control | `PERM-MARKETING-*`, `PERM-SEO-*` |
| `PERSONA-MARKETING-MANAGER` | Campaigns, automations, segments, templates | `PERM-MARKETING-CAMPAIGN-*`, `PERM-MARKETING-AUTOMATION-*`, `PERM-MARKETING-SEGMENT-*` |
| `PERSONA-CONTENT-EDITOR` | SEO content, redirects, blog posts | `PERM-SEO-MANAGE`, `PERM-CMS-EDIT` (cross-ref `32`) |
| `PERSONA-CATALOG-MANAGER` | Per-product SEO overrides | `PERM-SEO-MANAGE` (product-scoped) |
| `PERSONA-CUSTOMER-SERVICE` | View campaign delivery, resend, suppress | `PERM-MARKETING-VIEW`, `PERM-MARKETING-SUPPRESS` |
| `PERSONA-CUSTOMER` | Subscribe/unsubscribe, manage preferences | Auth-gated to own customer_id |
| `PERSONA-GUEST` | Subscribe to newsletter (anon by email) | Token-based confirmation |
| `PERSONA-AI-COPILOT` | Generate subject lines, suggest send times, segment ideas | `agent:marketing:read`, `agent:marketing:suggest` |
| `PERSONA-EXTERNAL-AGENT` | Read sitemap, JSON-LD feeds (public) | None (public endpoints) |
| `PERSONA-MODERATOR` | Review queue (Fáze 2 reviews) | `PERM-REVIEW-MODERATE` |

---

## 3. Data models

### 3.1 `seo_metadata` ([ENT-SEO-METADATA-001](03-data-models-master.md#ent-seo-metadata-001))

Per-entity SEO overrides (product, category, collection, page, ...).

```sql
CREATE TABLE seo_metadata (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('product','category','collection','cms_page','blog_post','tenant_root','store_root','channel_root')),
  entity_id UUID NULL,                                                 -- NULL for site-wide (tenant_root)
  locale TEXT NOT NULL,                                                -- BCP-47
  -- core meta
  title TEXT NULL,
  description TEXT NULL,
  canonical_url TEXT NULL,                                              -- override default
  robots TEXT NULL CHECK (robots IS NULL OR robots ~ '^(index|noindex)(,(follow|nofollow))?$'),
  -- Open Graph
  og_title TEXT NULL,
  og_description TEXT NULL,
  og_image_media_id UUID NULL REFERENCES media(id),
  og_type TEXT NULL,                                                    -- 'website','product','article'
  -- Twitter Card
  twitter_card TEXT NULL CHECK (twitter_card IN ('summary','summary_large_image','app','player') OR twitter_card IS NULL),
  twitter_site TEXT NULL,
  twitter_creator TEXT NULL,
  -- JSON-LD override / extension
  schema_jsonld_override JSONB NULL,                                    -- overrides auto-generated JSON-LD
  schema_jsonld_extensions JSONB NULL,                                  -- merges with auto (FAQPage, HowTo, etc.)
  -- hreflang
  hreflang_alternates JSONB NULL,                                        -- [{ locale, url }, ...]
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_seo_metadata UNIQUE (tenant_id, entity_type, entity_id, locale)
);

CREATE INDEX idx_seo_metadata_entity ON seo_metadata (entity_type, entity_id) WHERE entity_id IS NOT NULL;
CREATE INDEX idx_seo_metadata_tenant_locale ON seo_metadata (tenant_id, locale);
```

### 3.2 `redirects` ([ENT-REDIRECT-001](03-data-models-master.md#ent-redirect-001))

URL redirects (legacy URLs, content moves, marketing campaign vanity URLs).

```sql
CREATE TABLE redirects (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  channel_id UUID NULL REFERENCES channels(id),                          -- channel-scoped
  locale TEXT NULL,                                                       -- locale-specific
  from_path TEXT NOT NULL,                                                -- "/old-product-url"
  match_kind TEXT NOT NULL CHECK (match_kind IN ('exact','prefix','regex')) DEFAULT 'exact',
  to_path TEXT NOT NULL,                                                  -- "/products/new-slug" or absolute URL
  status_code INTEGER NOT NULL CHECK (status_code IN (301, 302, 307, 308)) DEFAULT 301,
  preserve_query_string BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ NULL,
  ends_at TIMESTAMPTZ NULL,
  description TEXT NULL,
  hit_count INTEGER NOT NULL DEFAULT 0,
  last_hit_at TIMESTAMPTZ NULL,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_redirects_unique
    UNIQUE (tenant_id, COALESCE(channel_id, '00000000-0000-0000-0000-000000000000'::uuid),
            COALESCE(locale, ''), from_path, match_kind) DEFERRABLE INITIALLY IMMEDIATE
);

CREATE INDEX idx_redirects_lookup ON redirects (tenant_id, from_path) WHERE is_active = true AND match_kind = 'exact';
CREATE INDEX idx_redirects_prefix ON redirects (tenant_id, from_path text_pattern_ops) WHERE is_active = true AND match_kind = 'prefix';
```

### 3.3 `sitemap_cache` *(materialized sitemap chunks for fast serving)*

```sql
CREATE TABLE sitemap_cache (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  channel_id UUID NULL REFERENCES channels(id),
  locale TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('products','categories','collections','pages','blog','sitemap_index','images','videos','news')),
  chunk_index INTEGER NOT NULL DEFAULT 0,                                  -- pro pagination (50k URLs per file max per Google)
  url_count INTEGER NOT NULL,
  xml_content_storage_key TEXT NOT NULL,                                  -- S3 path to gzipped XML
  url_path TEXT NOT NULL,                                                 -- public URL "/sitemap-products-1.xml"
  last_generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_generation_at TIMESTAMPTZ NULL,
  is_stale BOOLEAN NOT NULL DEFAULT false,                                 -- needs regeneration
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_sitemap_cache UNIQUE (tenant_id, COALESCE(channel_id, '00000000-0000-0000-0000-000000000000'::uuid), locale, kind, chunk_index)
);

CREATE INDEX idx_sitemap_cache_stale ON sitemap_cache (tenant_id, is_stale) WHERE is_stale = true;
```

### 3.4 `email_templates` *(reuse from `03 §21 ENT-EMAIL-TEMPLATE-001`)*

Already defined in master schema. Recap:

```sql
-- email_templates (per `03`):
--   code (e.g., 'order_confirmation'), locale, subject, body_mjml, body_html, is_active
--   UNIQUE (tenant_id, code, locale)
```

Tenant override of default templates. Defaults provided by platform per locale.

### 3.5 `email_campaigns`

Marketing email campaigns (one-off or scheduled).

```sql
CREATE TABLE email_campaigns (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  pub_id TEXT NOT NULL,                                                    -- cmp_ NanoID
  name TEXT NOT NULL,                                                       -- internal display name
  -- targeting
  segment_id UUID NULL REFERENCES customer_segments(id),                    -- from `18`
  segment_filter JSONB NULL,                                                 -- ad-hoc filter alternative
  estimated_recipient_count INTEGER NULL,
  -- content
  subject TEXT NOT NULL,
  preheader TEXT NULL,
  from_name TEXT NULL,
  from_email CITEXT NULL,
  reply_to CITEXT NULL,
  body_mjml TEXT NOT NULL,
  body_html TEXT NULL,                                                       -- compiled from MJML
  body_text TEXT NULL,                                                       -- plain fallback
  -- scheduling
  send_strategy TEXT NOT NULL CHECK (send_strategy IN ('immediate','scheduled','recurring','triggered')) DEFAULT 'immediate',
  scheduled_send_at TIMESTAMPTZ NULL,
  send_in_recipient_timezone BOOLEAN NOT NULL DEFAULT false,                  -- send at 10am local time
  best_send_time_optimization BOOLEAN NOT NULL DEFAULT false,                 -- AI-based, Fáze 2+
  recurrence_cron TEXT NULL,                                                  -- pro 'recurring'
  -- status
  status TEXT NOT NULL CHECK (status IN ('draft','review','scheduled','sending','sent','paused','failed','cancelled')) DEFAULT 'draft',
  status_entered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- metrics (materialized post-send)
  send_started_at TIMESTAMPTZ NULL,
  send_completed_at TIMESTAMPTZ NULL,
  total_recipients INTEGER NOT NULL DEFAULT 0,
  total_sent INTEGER NOT NULL DEFAULT 0,
  total_delivered INTEGER NOT NULL DEFAULT 0,
  total_bounced INTEGER NOT NULL DEFAULT 0,
  total_opened INTEGER NOT NULL DEFAULT 0,                                    -- unique opens (open tracking pixel)
  total_clicked INTEGER NOT NULL DEFAULT 0,
  total_unsubscribed INTEGER NOT NULL DEFAULT 0,
  total_complained INTEGER NOT NULL DEFAULT 0,                                -- spam complaints
  total_converted INTEGER NOT NULL DEFAULT 0,                                  -- attributed orders
  total_revenue_attributed_amount BIGINT NOT NULL DEFAULT 0,
  total_revenue_currency CHAR(3) NULL,
  -- A/B testing (Fáze 2+)
  ab_test_parent_campaign_id UUID NULL REFERENCES email_campaigns(id),
  ab_test_variant TEXT NULL,                                                  -- 'A','B','C'
  ab_test_split_percent INTEGER NULL,                                          -- e.g., 50
  ab_test_winner_metric TEXT NULL,
  ab_test_winner_variant TEXT NULL,
  -- discount attachment
  attached_coupon_id UUID NULL REFERENCES coupons(id),
  -- locale
  locale TEXT NOT NULL,
  -- attribution tracking (UTM auto-injected)
  utm_source TEXT NOT NULL DEFAULT 'shopio',
  utm_medium TEXT NOT NULL DEFAULT 'email',
  utm_campaign TEXT NOT NULL,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user_id UUID NULL,
  approved_by_user_id UUID NULL,
  approved_at TIMESTAMPTZ NULL,
  version INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_email_campaigns_pub_id UNIQUE (tenant_id, pub_id)
);

CREATE INDEX idx_email_campaigns_status ON email_campaigns (tenant_id, status, scheduled_send_at);
CREATE INDEX idx_email_campaigns_scheduled ON email_campaigns (scheduled_send_at) WHERE status = 'scheduled';
```

### 3.6 `email_sends`

Per-recipient send record (audit + analytics).

```sql
CREATE TABLE email_sends (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  campaign_id UUID NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  automation_flow_id UUID NULL REFERENCES automation_flows(id),                -- pro automation sends
  email_template_code TEXT NULL,                                                 -- pro transactional
  recipient_customer_id UUID NULL REFERENCES customers(id),
  recipient_email CITEXT NOT NULL,
  recipient_name TEXT NULL,
  locale TEXT NOT NULL,
  subject TEXT NOT NULL,
  from_email CITEXT NOT NULL,
  provider_message_id TEXT NULL,                                                  -- Resend / SES / SMTP message ID
  provider_code TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'queued','sending','sent','delivered','bounced','complained',
    'opened','clicked','unsubscribed','failed','suppressed'
  )) DEFAULT 'queued',
  -- delivery tracking
  queued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ NULL,
  delivered_at TIMESTAMPTZ NULL,
  bounced_at TIMESTAMPTZ NULL,
  bounce_kind TEXT NULL CHECK (bounce_kind IN ('hard','soft','suppress') OR bounce_kind IS NULL),
  bounce_reason TEXT NULL,
  complained_at TIMESTAMPTZ NULL,
  first_opened_at TIMESTAMPTZ NULL,
  last_opened_at TIMESTAMPTZ NULL,
  open_count INTEGER NOT NULL DEFAULT 0,
  first_clicked_at TIMESTAMPTZ NULL,
  last_clicked_at TIMESTAMPTZ NULL,
  click_count INTEGER NOT NULL DEFAULT 0,
  unsubscribed_at TIMESTAMPTZ NULL,
  -- attribution
  attributed_order_id UUID NULL REFERENCES orders(id),
  attributed_order_amount BIGINT NULL,
  -- failure
  failure_code TEXT NULL,
  failure_message TEXT NULL,
  -- raw
  raw_payload JSONB NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
) PARTITION BY RANGE (queued_at);

CREATE INDEX idx_email_sends_campaign ON email_sends (campaign_id, status) WHERE campaign_id IS NOT NULL;
CREATE INDEX idx_email_sends_customer ON email_sends (recipient_customer_id, queued_at DESC) WHERE recipient_customer_id IS NOT NULL;
CREATE INDEX idx_email_sends_provider_msg ON email_sends (provider_code, provider_message_id) WHERE provider_message_id IS NOT NULL;
CREATE INDEX brin_email_sends_queued ON email_sends USING BRIN (queued_at);
```

Retention: 1 year (Free), 2 years (Pro+).

### 3.7 `email_send_clicks`

Click event log for attribution.

```sql
CREATE TABLE email_send_clicks (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  email_send_id UUID NOT NULL REFERENCES email_sends(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  link_label TEXT NULL,                                                          -- 'cta_main','product_link_3','footer_unsubscribe'
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_hash TEXT NULL,
  user_agent_family TEXT NULL,
  country_code CHAR(2) NULL
) PARTITION BY RANGE (clicked_at);

CREATE INDEX idx_email_send_clicks_send ON email_send_clicks (email_send_id, clicked_at DESC);
CREATE INDEX brin_email_send_clicks_clicked ON email_send_clicks USING BRIN (clicked_at);
```

### 3.8 `automation_flows`

Trigger-based marketing flows (abandoned cart, welcome series, post-purchase, win-back).

```sql
CREATE TABLE automation_flows (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  pub_id TEXT NOT NULL,                                                          -- flow_ NanoID
  name TEXT NOT NULL,
  description TEXT NULL,
  trigger_kind TEXT NOT NULL CHECK (trigger_kind IN (
    'cart_abandoned','customer_signup','order_placed','order_delivered',
    'product_viewed','customer_inactive','birthday','custom_event',
    'subscription_renewed','subscription_cancelled','review_request_post_delivery'
  )),
  trigger_conditions JSONB NULL,                                                  -- additional filters
  steps JSONB NOT NULL,                                                            -- array of steps with delays + actions
  -- steps example:
  -- [
  --   { "kind":"wait","delay_seconds":3600 },
  --   { "kind":"send_email","template_code":"abandoned_cart_h1","subject_override":"..." },
  --   { "kind":"wait","delay_seconds":82800 },
  --   { "kind":"branch","condition":"cart_recovered","yes_path":[{"kind":"exit"}],"no_path":[{"kind":"send_email", ...}] },
  --   { "kind":"send_email","template_code":"abandoned_cart_d3" },
  --   { "kind":"add_tag","tag":"recovered_via_email" }
  -- ]
  status TEXT NOT NULL CHECK (status IN ('draft','active','paused','archived')) DEFAULT 'draft',
  is_default BOOLEAN NOT NULL DEFAULT false,                                       -- system-provided default
  max_concurrent_runs_per_customer INTEGER NOT NULL DEFAULT 1,                     -- avoid re-entry spam
  cooldown_seconds INTEGER NULL,                                                    -- minimum time between re-triggers per customer
  -- metrics
  total_started INTEGER NOT NULL DEFAULT 0,
  total_completed INTEGER NOT NULL DEFAULT 0,
  total_exited_early INTEGER NOT NULL DEFAULT 0,
  total_revenue_attributed_amount BIGINT NOT NULL DEFAULT 0,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user_id UUID NULL,
  version INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_automation_flows_pub_id UNIQUE (tenant_id, pub_id)
);

CREATE INDEX idx_automation_flows_trigger ON automation_flows (tenant_id, trigger_kind, status) WHERE status = 'active';
```

### 3.9 `automation_runs`

Per-customer execution instance of a flow.

```sql
CREATE TABLE automation_runs (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  automation_flow_id UUID NOT NULL REFERENCES automation_flows(id),
  customer_id UUID NULL REFERENCES customers(id),
  customer_email CITEXT NULL,                                                       -- guest flows (e.g., guest abandoned cart)
  trigger_event_payload JSONB NULL,                                                 -- snapshot of triggering event
  status TEXT NOT NULL CHECK (status IN ('running','completed','exited','failed','cancelled')) DEFAULT 'running',
  current_step_index INTEGER NOT NULL DEFAULT 0,
  next_action_at TIMESTAMPTZ NULL,                                                  -- when next step fires
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ NULL,
  exit_reason TEXT NULL CHECK (exit_reason IN ('completed','cart_recovered','order_placed','unsubscribed','manual_cancel','max_runs_exceeded','flow_archived','failed') OR exit_reason IS NULL),
  -- step results
  step_history JSONB NOT NULL DEFAULT '[]'::jsonb,                                   -- log of step executions
  emails_sent INTEGER NOT NULL DEFAULT 0,
  -- attribution
  attributed_order_id UUID NULL REFERENCES orders(id),
  attributed_revenue_amount BIGINT NULL,
  -- audit
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
) PARTITION BY RANGE (started_at);

CREATE INDEX idx_automation_runs_pending ON automation_runs (next_action_at) WHERE status = 'running' AND next_action_at IS NOT NULL;
CREATE INDEX idx_automation_runs_customer ON automation_runs (customer_id, started_at DESC) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_automation_runs_flow ON automation_runs (automation_flow_id, started_at DESC);
CREATE INDEX brin_automation_runs_started ON automation_runs USING BRIN (started_at);
```

### 3.10 `newsletter_subscriptions`

Standalone newsletter list (for non-customer signups).

```sql
CREATE TABLE newsletter_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  email CITEXT NOT NULL,
  linked_customer_id UUID NULL REFERENCES customers(id),                            -- if matched
  source TEXT NOT NULL CHECK (source IN ('footer_form','popup','checkout','admin_import','api','social','referral')),
  source_url TEXT NULL,
  signup_locale TEXT NULL,
  is_confirmed BOOLEAN NOT NULL DEFAULT false,                                       -- double opt-in
  confirmed_at TIMESTAMPTZ NULL,
  confirmation_token_hash TEXT NULL,
  unsubscribed_at TIMESTAMPTZ NULL,
  unsubscribe_reason TEXT NULL,
  utm JSONB NULL,
  preferences JSONB NULL,                                                            -- which lists / categories interested
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_newsletter_subscriptions_email UNIQUE (tenant_id, email) DEFERRABLE INITIALLY IMMEDIATE
);

CREATE INDEX idx_newsletter_subs_confirmed ON newsletter_subscriptions (tenant_id) WHERE is_confirmed = true AND unsubscribed_at IS NULL;
CREATE INDEX idx_newsletter_subs_pending ON newsletter_subscriptions (created_at) WHERE is_confirmed = false AND unsubscribed_at IS NULL;
```

### 3.11 `suppression_list`

Bounced / complained emails — never send again (regardless of campaign or template).

```sql
CREATE TABLE email_suppression_list (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  email CITEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('hard_bounce','spam_complaint','unsubscribe','manual','gdpr','deceased','invalid_address')),
  suppressed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  suppressed_by_actor_kind TEXT NULL,
  suppressed_by_actor_id UUID NULL,
  source_event_id UUID NULL,                                                         -- bounce event
  scope TEXT NOT NULL CHECK (scope IN ('marketing','transactional','all')) DEFAULT 'marketing',
  notes TEXT NULL,
  expires_at TIMESTAMPTZ NULL,                                                        -- pro soft bounces re-try later
  -- audit
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_email_suppression UNIQUE (tenant_id, email, scope)
);

CREATE INDEX idx_email_suppression_email ON email_suppression_list (tenant_id, email);
```

### 3.12 `customer_segments` *(referenced from `18`, defined here)*

Saved filter expressions for marketing campaigns.

```sql
-- already defined in 18-customer-management.md §3.11; see there
```

### 3.13 `reviews` *(MVP-light; v1.0+ expand)*

Product reviews.

```sql
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  pub_id TEXT NOT NULL,                                                              -- rev_ NanoID
  product_id UUID NOT NULL REFERENCES products(id),
  variant_id UUID NULL REFERENCES product_variants(id),                              -- review may be specific to variant
  customer_id UUID NULL REFERENCES customers(id),                                    -- nullable for moderated guest
  customer_email_snapshot CITEXT NULL,
  reviewer_name TEXT NOT NULL,                                                        -- display name
  order_id UUID NULL REFERENCES orders(id),                                           -- if linked → "verified purchase"
  is_verified_purchase BOOLEAN NOT NULL DEFAULT false,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title TEXT NULL,
  body TEXT NULL,                                                                     -- sanitized
  media_ids UUID[] NOT NULL DEFAULT '{}',                                              -- photo/video uploads
  language TEXT NULL,                                                                 -- BCP-47, auto-detect Fáze 2
  status TEXT NOT NULL CHECK (status IN ('pending_moderation','approved','rejected','spam','hidden')) DEFAULT 'pending_moderation',
  moderation_notes TEXT NULL,
  moderation_at TIMESTAMPTZ NULL,
  moderated_by_user_id UUID NULL,
  -- engagement
  helpful_count INTEGER NOT NULL DEFAULT 0,
  not_helpful_count INTEGER NOT NULL DEFAULT 0,
  reported_count INTEGER NOT NULL DEFAULT 0,                                           -- abuse reports
  reply_from_merchant TEXT NULL,
  reply_from_merchant_at TIMESTAMPTZ NULL,
  reply_from_merchant_user_id UUID NULL,
  -- AI signals (Fáze 2)
  ai_sentiment_score INTEGER NULL,                                                     -- 0-100
  ai_spam_score INTEGER NULL,                                                          -- 0-100
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_reviews_pub_id UNIQUE (tenant_id, pub_id)
);

CREATE INDEX idx_reviews_product ON reviews (product_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_reviews_status ON reviews (tenant_id, status, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_reviews_customer ON reviews (customer_id, created_at DESC) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_reviews_pending_moderation ON reviews (tenant_id, created_at) WHERE status = 'pending_moderation' AND deleted_at IS NULL;
```

### 3.14 `wishlists` *(MVP-light)*

Customer wishlist.

```sql
CREATE TABLE wishlists (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  pub_id TEXT NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'My Wishlist',
  is_default BOOLEAN NOT NULL DEFAULT true,
  is_public BOOLEAN NOT NULL DEFAULT false,                                            -- shareable
  share_token_hash TEXT NULL,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_wishlists_pub_id UNIQUE (tenant_id, pub_id)
);

CREATE TABLE wishlist_items (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  wishlist_id UUID NOT NULL REFERENCES wishlists(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES product_variants(id),
  product_id UUID NOT NULL REFERENCES products(id),
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT uq_wishlist_items UNIQUE (wishlist_id, variant_id)
);

CREATE INDEX idx_wishlist_items_wishlist ON wishlist_items (wishlist_id, position);
```

### 3.15 `back_in_stock_subscriptions`

Customer subscribes to be notified when out-of-stock variant restocks.

```sql
CREATE TABLE back_in_stock_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  variant_id UUID NOT NULL REFERENCES product_variants(id),
  customer_id UUID NULL REFERENCES customers(id),
  email CITEXT NOT NULL,
  notified_at TIMESTAMPTZ NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,                                                     -- 90 days default

  CONSTRAINT uq_back_in_stock UNIQUE (tenant_id, variant_id, email) DEFERRABLE INITIALLY IMMEDIATE
);

CREATE INDEX idx_back_in_stock_active ON back_in_stock_subscriptions (variant_id) WHERE is_active = true AND notified_at IS NULL;
```

### 3.16 `social_product_feeds`

Configured feeds for external platforms (Heuréka, Google Shopping, Meta Catalog).

```sql
CREATE TABLE social_product_feeds (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  pub_id TEXT NOT NULL,                                                                -- fed_ NanoID
  name TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('heureka','zbozi_cz','google_shopping','meta_catalog','pinterest','tiktok','custom_xml','custom_json')),
  feed_format TEXT NOT NULL CHECK (feed_format IN ('xml','csv','tsv','json','rss')),
  locale TEXT NOT NULL,
  currency CHAR(3) NOT NULL,
  channel_id UUID NULL REFERENCES channels(id),
  -- filtering
  category_ids UUID[] NULL,                                                             -- limit to certain categories
  collection_ids UUID[] NULL,
  excluded_product_tags TEXT[] NULL,
  min_stock_count INTEGER NULL,                                                          -- exclude out-of-stock
  -- output
  public_url_path TEXT NOT NULL,                                                         -- /feeds/heureka.xml
  output_storage_key TEXT NULL,                                                           -- cached S3 path
  last_generated_at TIMESTAMPTZ NULL,
  next_generation_at TIMESTAMPTZ NULL,
  generation_frequency_minutes INTEGER NOT NULL DEFAULT 60,                              -- hourly default
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- metrics
  last_generation_product_count INTEGER NULL,
  last_generation_duration_ms INTEGER NULL,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_social_product_feeds_pub_id UNIQUE (tenant_id, pub_id)
);

CREATE INDEX idx_social_product_feeds_active ON social_product_feeds (tenant_id, platform) WHERE is_active = true;
CREATE INDEX idx_social_product_feeds_due ON social_product_feeds (next_generation_at) WHERE is_active = true;
```

### 3.17 Vztahy

```
tenants (1)──(N) seo_metadata                  [per entity]
tenants (1)──(N) redirects
tenants (1)──(N) sitemap_cache
tenants (1)──(N) email_templates               [from `03`]
tenants (1)──(N) email_campaigns
tenants (1)──(N) email_sends                   [partitioned]
tenants (1)──(N) automation_flows
automation_flows (1)──(N) automation_runs      [partitioned]
tenants (1)──(N) newsletter_subscriptions
tenants (1)──(N) email_suppression_list
tenants (1)──(N) reviews
tenants (1)──(N) wishlists (1)──(N) wishlist_items
tenants (1)──(N) back_in_stock_subscriptions
tenants (1)──(N) social_product_feeds
customers (1)──(N) reviews                      [authored]
customers (1)──(N) wishlists
customers (1)──(N) automation_runs              [triggered]
customers (1)──(N) email_sends                  [recipient]
products (1)──(N) reviews
variants (1)──(N) back_in_stock_subscriptions
email_campaigns (0..1)──(1) coupons              [attached promo]
email_campaigns (0..1)──(1) customer_segments
```

---

## 4. SEO subsystem

### 4.1 SEO metadata resolution order

Per-request SEO metadata for a URL:

```
1. Find entity → (type, id) e.g., product slug → product_id
2. Lookup seo_metadata WHERE entity_type=X AND entity_id=Y AND locale=L
3. If not found: fallback to default locale's seo_metadata
4. If still not found: auto-generate defaults from entity fields:
   - title: "{entity.title} | {tenant.name}"
   - description: entity.short_description (truncated 160 chars)
   - canonical_url: storefront's canonical for entity
   - og_*: derived from above
5. Apply hreflang alternates from translations
6. Render <head> tags
```

### 4.2 Sitemap generation

`JOB-GENERATE-SITEMAP-FULL` (daily; or after EVENT-PRODUCT-* batch):

```
For each (channel, locale) combination:
  Generate sitemap index file at /sitemap.xml
  For each kind (products, categories, collections, pages, blog):
    Paginate URLs into chunks of 50,000 max
    Render XML with <loc>, <lastmod>, <changefreq>, <priority>
    Include <image:image> for products with primary_image
    Include <video:video> for products with video media (Fáze 2)
    Gzip + upload to S3
    Update sitemap_cache row with storage_key
  Notify search engines via:
    - Google Search Console (Indexing API, Fáze 2)
    - Bing IndexNow API (Fáze 2)
    - Submit ping URLs (manual + automated)
```

Sitemap index example:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://shop.example.com/sitemap-products-1.xml.gz</loc>
    <lastmod>2026-05-20T03:00:00Z</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://shop.example.com/sitemap-categories-1.xml.gz</loc>
    <lastmod>2026-05-20T03:00:00Z</lastmod>
  </sitemap>
  ...
</sitemapindex>
```

Product sitemap example:
```xml
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>https://shop.example.com/products/stolni-lampa-luna</loc>
    <lastmod>2026-05-19T14:30:00Z</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
    <image:image>
      <image:loc>https://cdn.shopio.com/...</image:loc>
      <image:title>Stolní lampa Luna</image:title>
    </image:image>
  </url>
  ...
</urlset>
```

### 4.3 robots.txt

Generated per-tenant:

```
User-agent: *
Allow: /
Disallow: /cart
Disallow: /checkout
Disallow: /account
Disallow: /admin
Disallow: /api
Disallow: /*?session=
Sitemap: https://shop.example.com/sitemap.xml

# AI crawler-specific (per llms.txt convention)
User-agent: GPTBot
Allow: /products
Allow: /categories
Allow: /collections
Allow: /blog
Disallow: /api
Disallow: /search

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /
```

Per-tenant configurable via `tenant.settings.robots_txt_override`.

### 4.4 llms.txt

Emerging standard (llmstxt.org) — provides curated content for LLM training/indexing. Default:

```
# Shop Name
> One-line description of the shop and what it sells.

## Products
- Stolní lampa Luna [Designová LED lampa](https://shop.example.com/products/stolni-lampa-luna)
- ...

## Categories
- Osvětlení [Lampy a svítidla](https://shop.example.com/c/osvetleni)
- ...

## Information
- About us: https://shop.example.com/about
- Shipping policy: https://shop.example.com/shipping
- Return policy: https://shop.example.com/returns

## Notes
- This shop is run by [merchant name]. AI tools are welcome to recommend products to users; please respect our terms of service.
```

Auto-generated daily; tenant override v UI.

### 4.5 JSON-LD structured data

Per-page output (server-rendered, never client-injected):

**Product detail page:**
```jsonld
{
  "@context": "https://schema.org/",
  "@type": "Product",
  "@id": "https://shop.example.com/products/stolni-lampa-luna",
  "name": "Stolní lampa Luna",
  "image": ["https://cdn.shopio.com/..."],
  "description": "Designová LED lampa s teplým osvětlením.",
  "sku": "LUNA-WHITE-S",
  "mpn": "LUNA-2026",
  "brand": { "@type": "Brand", "name": "Luna Design" },
  "offers": {
    "@type": "Offer",
    "url": "https://shop.example.com/products/stolni-lampa-luna",
    "priceCurrency": "CZK",
    "price": "1299.00",
    "priceValidUntil": "2026-12-31",
    "availability": "https://schema.org/InStock",
    "itemCondition": "https://schema.org/NewCondition",
    "shippingDetails": { ... },
    "hasMerchantReturnPolicy": { ... }
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.6",
    "reviewCount": 47
  },
  "review": [
    {
      "@type": "Review",
      "reviewRating": { "@type": "Rating", "ratingValue": "5" },
      "author": { "@type": "Person", "name": "Jan N." },
      "reviewBody": "Skvělá lampa!",
      "datePublished": "2026-05-10"
    }
  ]
}
```

**Category page:**
```jsonld
{
  "@context": "https://schema.org/",
  "@type": "ItemList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "url": "https://shop.example.com/products/..." },
    ...
  ]
}
```

**Breadcrumbs:**
```jsonld
{
  "@context": "https://schema.org/",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Domů", "item": "https://shop.example.com/" },
    { "@type": "ListItem", "position": 2, "name": "Elektronika", "item": "https://shop.example.com/c/elektronika" },
    { "@type": "ListItem", "position": 3, "name": "Stolní lampy", "item": "https://shop.example.com/c/elektronika/stolni-lampy" }
  ]
}
```

**Organization (site-wide):**
```jsonld
{
  "@context": "https://schema.org/",
  "@type": "Organization",
  "name": "Shop XYZ",
  "url": "https://shop.example.com",
  "logo": "https://cdn.shopio.com/logo.png",
  "sameAs": ["https://www.facebook.com/...", "https://www.instagram.com/..."],
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "+420777123456",
    "contactType": "customer service",
    "areaServed": "CZ",
    "availableLanguage": ["cs", "en"]
  }
}
```

### 4.6 Hreflang

For multi-language stores:

```html
<link rel="alternate" hreflang="cs-CZ" href="https://shop.example.com/produkty/stolni-lampa-luna" />
<link rel="alternate" hreflang="en-US" href="https://shop.example.com/en/products/luna-table-lamp" />
<link rel="alternate" hreflang="de-DE" href="https://shop.example.com/de/produkte/luna-tischlampe" />
<link rel="alternate" hreflang="x-default" href="https://shop.example.com/produkty/stolni-lampa-luna" />
```

### 4.7 Canonical URLs

Each page has:
```html
<link rel="canonical" href="https://shop.example.com/products/stolni-lampa-luna" />
```

Strip query params (except for legitimate variants like `?variant=X`). Configurable per tenant.

### 4.8 Redirects engine

Request middleware:

```
1. Lookup exact match in redirects WHERE from_path = $1 AND is_active = true
2. If found AND in window: 301/302/308 redirect
3. Else: lookup prefix match (sorted by from_path length DESC)
4. Else: lookup regex match (last resort, slower)
5. Else: continue to normal route handler
```

Update `hit_count` + `last_hit_at` async (don't block redirect).

---

## 5. Email marketing subsystem

### 5.1 Email provider abstraction

Per `13-payments.md` pattern — `EmailProvider` interface:

```typescript
interface EmailProvider {
  readonly code: string;
  send(input: SendInput): Promise<SendResult>;
  sendBatch(inputs: SendInput[]): Promise<BatchSendResult>;
  verifyWebhookSignature(payload: string, signature: string): boolean;
  parseWebhookEvent(payload: object): NormalizedEmailEvent;
  getDomainStatus(domain: string): Promise<DomainStatus>;        // SPF/DKIM/DMARC check
}
```

MVP providers:
- **Resend** (preferred — modern API, good deliverability, EU-friendly)
- **AWS SES** (cost-effective at scale)
- **SMTP** (generic fallback — Postmark, Mailgun, custom SMTP server)

Tenant configures per-tenant provider + sender domain.

### 5.2 Email template engine

- **MJML** as authoring format — responsive, mobile-friendly
- React Email components for transactional (programmatic build)
- Compile MJML → HTML at save time
- Auto-generate plain text fallback
- Variable substitution: `{{customer.first_name}}`, `{{order.total | formatMoney}}`, `{{cart.items}}`

Template kinds:
- **Transactional**: order_confirmation, password_reset, shipping_notification, ...
- **Marketing campaign**: ad-hoc designed
- **Automation step**: pre-designed flow steps

### 5.3 Sender domain authentication

For deliverability:
- **SPF** record: `v=spf1 include:_spf.resend.com ~all`
- **DKIM** signing (provider-managed)
- **DMARC** policy: `v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com`

Admin UI provides setup wizard:
- Show required DNS records
- Verify via DNS lookup
- Status badges (green/yellow/red)

### 5.4 Send orchestration

```
Campaign sent at scheduled_send_at OR triggered by automation step:
  1. Resolve recipient list (segment query OR ad-hoc filter)
  2. Filter by suppression_list (exclude)
  3. Filter by marketing consent (RULE-MAR-001):
     - For 'marketing' scope: only customers with active marketing_email consent
     - For 'transactional' scope: all (no consent gate)
  4. For each recipient:
     - Insert email_sends row (status='queued')
     - Personalize template (variables, locale)
     - Enqueue JOB-SEND-EMAIL with provider routing
  5. Worker pool dispatches to provider API
  6. Status updates via provider webhooks
```

Throttling:
- Per provider rate limits respected
- Per tenant max sends/hour configurable

### 5.5 Event tracking

Provider webhooks → normalized events:
- `delivered` (provider confirmed delivery to MX)
- `bounced` (hard / soft)
- `complained` (spam complaint)
- `opened` (tracking pixel loaded — note: limited reliability post Apple Mail Privacy)
- `clicked` (link click via redirect tracking)

Webhook idempotent via `(provider_code, provider_message_id, event_type)`.

### 5.6 Unsubscribe handling

**One-click unsubscribe (RFC 8058):**
```
List-Unsubscribe: <mailto:unsubscribe@example.com?subject=unsub:cus_aB>,
                  <https://shop.example.com/u/{signed_token}>
List-Unsubscribe-Post: List-Unsubscribe=One-Click
```

Customer click → POST to URL → revoke `marketing_email` consent + add to suppression list.

Per-list unsubscribe (Fáze 2): customer can unsubscribe from specific campaigns/categories without leaving all marketing.

---

## 6. Marketing automation

### 6.1 Trigger sources

| Trigger | Event source | Use case |
|---|---|---|
| `cart_abandoned` | EVENT-CART-ABANDONED (`11`) | Abandoned cart recovery emails |
| `customer_signup` | EVENT-CUSTOMER-CREATED (`18`) | Welcome series |
| `order_placed` | EVENT-ORDER-PLACED (`16`) | Confirmation + cross-sell |
| `order_delivered` | EVENT-SHIPMENT-DELIVERED (`14`) | Review request, satisfaction survey |
| `product_viewed` | EVENT-PRODUCT-VIEWED (synthetic from page tracking) | Browse abandonment |
| `customer_inactive` | scheduled (no activity 90d) | Win-back campaign |
| `birthday` | scheduled (customer.birth_date matches today) | Birthday discount |
| `subscription_renewed` | EVENT-SUBSCRIPTION-RENEWED (`24`) | Upsell |
| `subscription_cancelled` | EVENT-SUBSCRIPTION-CANCELLED (`24`) | Save-the-customer |
| `custom_event` | API call by plugin/integration | Custom flows |
| `review_request_post_delivery` | scheduled (5-7d after delivery) | Solicit review |

### 6.2 Flow definition DSL

`automation_flows.steps` JSONB array:

```jsonc
[
  {
    "kind": "wait",
    "delay_seconds": 3600,
    "label": "Wait 1 hour"
  },
  {
    "kind": "branch",
    "condition": {
      "expression": "customer.has_marketing_consent AND cart.total_amount >= 50000",
      "evaluator": "expression"
    },
    "yes_path_index": 2,
    "no_path_index": 7
  },
  {
    "kind": "send_email",
    "template_code": "abandoned_cart_h1",
    "subject_template": "Zapomněl jste něco v košíku, {{customer.first_name}}?",
    "attach_coupon_id": null,
    "tracking_label": "abandoned_cart_h1"
  },
  {
    "kind": "wait",
    "delay_seconds": 82800
  },
  {
    "kind": "check_exit_condition",
    "exit_if": "cart.status IN ('converted','expired','cancelled') OR customer.marketing_consent_revoked"
  },
  {
    "kind": "send_email",
    "template_code": "abandoned_cart_d1",
    "subject_template": "Stále zájem? Tu je 10% sleva",
    "attach_coupon_id": "cpn_recover10"
  },
  {
    "kind": "add_tag",
    "tag": "incentive_sent"
  },
  {
    "kind": "wait",
    "delay_seconds": 172800
  },
  {
    "kind": "send_email",
    "template_code": "abandoned_cart_d3_final"
  },
  {
    "kind": "exit",
    "reason": "completed"
  }
]
```

Step kinds:
- `wait`: delay
- `send_email`: send templated email
- `send_sms`: SMS (Fáze 2+)
- `send_push`: web push (v1.0+)
- `branch`: conditional split
- `check_exit_condition`: evaluate exit signal mid-flow
- `add_tag` / `remove_tag`: tag customer
- `assign_segment`: add to segment
- `webhook`: call external URL
- `exit`: terminate flow

### 6.3 Concurrency limits

Per `automation_flows.max_concurrent_runs_per_customer`:
- Default 1 (avoid re-entry; if customer abandons cart again while flow active, don't start 2nd)
- Cooldown via `cooldown_seconds` — min time between re-triggers per customer

### 6.4 Built-in default flows

Platform provides starter flows (merchant can edit or replace):

1. **Abandoned cart recovery** (3 emails: 1h, 24h, 72h with coupon)
2. **Welcome series** (1 email immediately, follow-up at 3 days with discount)
3. **Post-purchase thank you** (immediate, with cross-sell at 7 days)
4. **Review request** (5 days after delivery)
5. **Back in stock** (immediate notification)
6. **Win-back** (90 days no activity, then 180 days)
7. **Birthday** (annual)
8. **Order delivered confirmation** (transactional, immediate on delivery)

### 6.5 Attribution

When recipient clicks email link → tracked param `?utm_source=shopio&utm_medium=email&utm_campaign={campaign_id}&utm_send={email_send_id}`.

If recipient places order within 14 days (configurable attribution window):
- Order → `metadata.attributed_email_send_id`
- Update `email_sends.attributed_order_id`, `attributed_order_amount`
- Update `email_campaigns.total_converted`, `total_revenue_attributed_amount`

---

## 7. State machines

### 7.1 Email campaign lifecycle

```
[draft] ──submit for review──▶ [review] ──approve──▶ [scheduled] ──cron fires──▶ [sending] ──complete──▶ [sent]
   │                                │                     │
   │ cancel                          │ cancel               │ pause
   ▼                                ▼                     ▼
[cancelled]                    [cancelled]            [paused] ──resume──▶ [sending]
                                                            │
                                                            └── error rate > threshold ──▶ [failed]
```

### 7.2 Automation run lifecycle

```
[running] ──step completes, more steps──▶ [running] (next_action_at set)
    │
    ├── all steps done ──▶ [completed]
    ├── exit condition met ──▶ [exited] with reason
    ├── step fails (no retry) ──▶ [failed]
    ├── customer unsubscribes ──▶ [exited, reason='unsubscribed']
    ├── manual cancel ──▶ [cancelled]
    └── flow archived ──▶ [exited, reason='flow_archived']
```

### 7.3 Review lifecycle

```
[pending_moderation] ──admin approves──▶ [approved]
       │                                       │
       │ admin rejects                          │ admin hides
       ▼                                       ▼
   [rejected]                              [hidden]
       │
       └── auto-spam-detect score > 80 ──▶ [spam]
```

### 7.4 Newsletter subscription lifecycle

```
[unconfirmed] ──click confirmation email──▶ [confirmed] ──unsubscribe──▶ [unsubscribed]
       │                                          │
       │ expire 7 days unconfirmed                 │ admin / GDPR delete
       ▼                                          ▼
[deleted]                                    [unsubscribed]
```

---

## 8. Business rules

### RULE-MAR-001: Marketing consent strict gate

Marketing emails sent ONLY if recipient has active `marketing_email` consent (per `18` RULE-CUST-006). Pre-send check:

```sql
SELECT 1 FROM customers c
LEFT JOIN customer_consents cc ON cc.customer_id = c.id
  AND cc.purpose = 'marketing_email'
  AND cc.revoked_at IS NULL
WHERE c.id = $1 AND cc.granted = true AND c.deleted_at IS NULL;
```

If no active consent: email queued with `status='suppressed'`. Recorded but not sent. Reason: 'no_marketing_consent'.

Transactional emails (order confirmation, etc.) NOT gated by marketing consent.

### RULE-MAR-002: Suppression list always honored

Email on `email_suppression_list` for scope `marketing` or `all` → never sent (regardless of consent). Reason in send record: 'suppressed'.

### RULE-MAR-003: Double opt-in for newsletter

Newsletter signup via storefront form:
- Insert `newsletter_subscriptions` (is_confirmed=false)
- Send confirmation email with signed token (24h TTL)
- Customer clicks link → POST /storefront/newsletter/confirm
- Set is_confirmed=true, confirmed_at, link to customer if email matches
- Also grant `marketing_email` consent in `customer_consents` (RULE-CUST-006)

Without confirmation: cannot send marketing.

### RULE-MAR-004: Single-click unsubscribe

Per RFC 8058: every marketing email has `List-Unsubscribe` header + URL. One POST → unsubscribe immediate. No confirmation page required.

After unsubscribe:
- Revoke `marketing_email` consent
- Add to `email_suppression_list` (scope='marketing')
- Confirmation page shown (informational)

### RULE-MAR-005: Suppression on hard bounce

Hard bounce (invalid email address, mailbox doesn't exist):
- Auto-add to `email_suppression_list` (scope='all')
- Mark customer `email_verified_at = NULL`
- Customer next login may be prompted to confirm

### RULE-MAR-006: Suppression on spam complaint

Spam complaint (recipient marked as spam in their email client):
- Auto-add to `email_suppression_list` (scope='all')
- Revoke marketing consent
- Customer marked as `is_high_risk` (per `18`)
- Admin notification

### RULE-MAR-007: Soft bounce retry

Soft bounce (mailbox full, temporary): retry up to 3 attempts over 24h. After 3 consecutive: treat as hard bounce.

### RULE-MAR-008: Email tracking pixel opt-in

GDPR sensitive — open tracking via 1px pixel may be considered tracking. Per tenant:
- `tenant.settings.email_open_tracking ∈ ('enabled','disabled')` — default enabled
- Customer can opt out via preferences page (sets `customers.preferences.no_email_open_tracking=true`)

When disabled: open tracking pixel not embedded; open_count remains 0.

### RULE-MAR-009: Click tracking always opt-in

Click tracking via redirect URL — necessary for attribution. Considered legitimate interest under GDPR. No opt-out (would break unsubscribe link tracking too).

### RULE-MAR-010: Campaign approval workflow

Large campaigns (> 1000 recipients) require:
- Admin reviews preview
- Test send to internal test list
- Approve button (`approved_by_user_id`)

Then status → `scheduled` or `sending`. Configurable per tenant `tenant.settings.campaign_approval_threshold`.

### RULE-MAR-011: Campaign throttling

Per provider rate limit (e.g., Resend 100/sec). Per tenant configurable max sends/hour. Avoid spike that triggers spam flags.

Recipient timezone-aware send (`send_in_recipient_timezone=true`): spread send over 24h based on `customer.metadata.timezone` (derived from address country if not set).

### RULE-MAR-012: A/B test campaign (Fáze 2+)

Parent campaign + 2-4 variant campaigns:
- Split traffic by `ab_test_split_percent`
- Track per-variant metrics
- After significance window: auto-pick winner OR admin chooses
- Optional: send rest of list to winner variant

### RULE-MAR-013: Sitemap regeneration triggers

`JOB-MARK-SITEMAP-STALE` on:
- EVENT-PRODUCT-PUBLISHED / ARCHIVED / DELETED
- EVENT-CATEGORY-CREATED / UPDATED / DELETED
- EVENT-COLLECTION-PUBLISHED / ARCHIVED
- EVENT-CMS-PAGE-PUBLISHED / ARCHIVED

Marks `sitemap_cache.is_stale=true`. `JOB-GENERATE-SITEMAP-FULL` regenerates daily at 03:00 OR if stale > 5 min.

Search engines pinged on regeneration (Google Indexing API where applicable).

### RULE-MAR-014: Redirect priority

Multiple redirects matching: priority DESC, then most-recent-created. Exact match > prefix > regex.

Loop detection: max 5 redirect hops before serving 508 Loop Detected.

### RULE-MAR-015: Canonical URL stripping

Default canonical:
- Strip session ID, UTM params, tracking params (configurable allow-list per tenant)
- Lowercase host
- Trailing slash policy (configurable per tenant)
- Variant query params kept if part of product detail (e.g., `?variant=X`)

### RULE-MAR-016: Hreflang completeness

For multi-locale tenant: every page MUST have hreflang for every active locale + `x-default`. Missing locales hurt SEO.

Validation: `JOB-VALIDATE-HREFLANG` daily checks for orphans.

### RULE-MAR-017: Reviews verified purchase badge

`reviews.is_verified_purchase=true` iff:
- `order_id` linked (customer placed order)
- Order contains this product
- Order status = 'delivered' or 'completed'

Storefront UI shows "Ověřený nákup" badge.

### RULE-MAR-018: Reviews moderation

Default `pending_moderation`. Admin reviews queue:
- Approve → public
- Reject → hidden, customer notified
- Spam → hidden, no notification

Auto-spam scoring (Fáze 2 AI-based):
- AI sentiment + content quality check
- Score > 80 → auto-mark spam
- Score 50-80 → flag for manual review (priority)

### RULE-MAR-019: Review incentives compliant

Review-request emails CANNOT offer payment per review (illegal in EU). May offer:
- Loyalty points / discount for ANY review (positive or negative)
- Entry to giveaway for verified reviewers

Wording template provided per locale.

### RULE-MAR-020: Customer can edit own review

Customer may edit own review within 30 days; goes back to `pending_moderation`. After 30 days: admin help required.

Delete own review: customer can request; admin approves (preserves audit). For GDPR delete: anonymize reviewer_name + body to "[Removed at user request]".

### RULE-MAR-021: Wishlist guest support

Guest wishlist: stored in localStorage (no DB). On signup: migrate to DB. Configurable per tenant.

Logged-in customer can share wishlist via signed URL. Recipient sees read-only view.

### RULE-MAR-022: Back-in-stock notification

`back_in_stock_subscriptions.is_active=true` + variant.available > 0:
- `JOB-NOTIFY-BACK-IN-STOCK` fires (subscribed customers)
- Email sent
- `notified_at` set
- `is_active=false` (one-shot)

To re-subscribe: customer manually re-clicks button.

Expiry: 90 days from create (configurable). After expiry: auto-deactivate (cleanup spam).

### RULE-MAR-023: Product feed generation

Feed `social_product_feeds`:
- Default frequency: 60 min (Heuréka recommended)
- Generates XML/CSV per platform spec
- Filter by category/collection/exclude_tags
- Includes only in_stock + active products
- Uploaded to S3, served via signed CDN URL

Per platform field mapping:
- Heuréka: ITEM_ID, PRODUCTNAME, URL, IMGURL, PRICE_VAT, DELIVERY_DATE, EAN, ITEMGROUP_ID
- Google Shopping: id, title, description, link, image_link, condition, availability, price, brand, gtin, mpn
- Meta Catalog: id, title, description, availability, condition, price, link, image_link, brand

### RULE-MAR-024: Email template variable safety

Variable substitution sandboxed:
- No code execution (no `eval`-style)
- HTML-escape by default; explicit `{{ var | safe }}` for trusted HTML
- Conditionals via Handlebars-like syntax
- Filters: `formatMoney`, `formatDate`, `truncate`, `default`, `pluralize`

Template validation on save: render with mock data, detect errors.

### RULE-MAR-025: Automation cooldown across flows

Customer cooldown across all marketing flows: `tenant.settings.marketing_global_cooldown_seconds` (default 7 days). Prevents being in 5 flows simultaneously.

Exception: transactional flows (order confirmation, password reset) — never throttled.

### RULE-MAR-026: Suppression respect across automation

Even if customer in active automation run, send_email step checks suppression list. If suppressed: skip step (advance to next).

### RULE-MAR-027: Locale resolution for email send

For each recipient:
1. Customer's `default_locale` (from `18`)
2. Else: order's `locale` (from `16`) for order-triggered emails
3. Else: tenant's `default_locale`

Template fallback chain (per `23-i18n.md`): exact → language base → tenant default.

### RULE-MAR-028: Sender domain per channel/locale

Tenant may have different sender domain per channel:
- `shop.example.com` for CZ → from: `objednavky@shop.example.com`
- `shop.example.de` for DE → from: `bestellungen@shop.example.de`

Configurable in admin.

### RULE-MAR-029: Bounce rate threshold protective

If campaign bounce rate > 5% within first 100 sends: auto-pause + admin alert. Prevent reputation damage.

If complaint rate > 0.5% within first 100: same.

### RULE-MAR-030: GDPR — campaign metrics anonymized after retention

Email_sends partitioned + retention 1-2 years. After: drop partition.

Customer email in `email_sends.recipient_email` and `recipient_customer_id` anonymized if customer goes through GDPR delete (per `18 RULE-CUST-027` pattern).

### RULE-MAR-031: Public sitemap rate limit

`/sitemap.xml` is public but rate-limited per IP (1000/min) to prevent abuse. Genuine search engines have their crawl budgets.

### RULE-MAR-032: AI-generated subject lines disclosure

If AI generates subject line (Fáze 2): `metadata.ai_generated_subject=true`. Per EU AI Act draft, may need disclosure (Fáze 3+).

---

## 9. REST API endpoints

### 9.1 SEO

```
GET    /api/{date}/seo/metadata?entity_type=product&entity_id=...&locale=cs-CZ
POST   /api/{date}/seo/metadata
PATCH  /api/{date}/seo/metadata/{id}
DELETE /api/{date}/seo/metadata/{id}

GET    /api/{date}/seo/redirects
POST   /api/{date}/seo/redirects
PATCH  /api/{date}/seo/redirects/{id}
DELETE /api/{date}/seo/redirects/{id}
POST   /api/{date}/seo/redirects:bulk-import-csv

POST   /api/{date}/seo/sitemap:regenerate                    # admin trigger
GET    /api/{date}/seo/sitemap/status                         # per-kind freshness

GET    /api/{date}/seo/llms-txt                                # current llms.txt content
PATCH  /api/{date}/seo/llms-txt                                # override

# Public (no auth)
GET    /sitemap.xml                                            # sitemap index
GET    /sitemap-products-{n}.xml.gz                            # chunk
GET    /robots.txt
GET    /llms.txt
GET    /{path}                                                  # storefront with JSON-LD inline
```

### 9.2 Email templates

```
GET    /api/{date}/email-templates
GET    /api/{date}/email-templates/{code}?locale=cs-CZ
PATCH  /api/{date}/email-templates/{code}                       # tenant override of default
DELETE /api/{date}/email-templates/{code}                       # revert to platform default
POST   /api/{date}/email-templates/{code}:preview                # render with mock data
POST   /api/{date}/email-templates/{code}:send-test              # send to specific email
```

### 9.3 Email campaigns

```
GET    /api/{date}/email-campaigns
POST   /api/{date}/email-campaigns
GET    /api/{date}/email-campaigns/{id}
PATCH  /api/{date}/email-campaigns/{id}
DELETE /api/{date}/email-campaigns/{id}
POST   /api/{date}/email-campaigns/{id}:submit-for-review
POST   /api/{date}/email-campaigns/{id}:approve
POST   /api/{date}/email-campaigns/{id}:schedule
POST   /api/{date}/email-campaigns/{id}:send-now                 # immediate
POST   /api/{date}/email-campaigns/{id}:pause
POST   /api/{date}/email-campaigns/{id}:resume
POST   /api/{date}/email-campaigns/{id}:cancel
POST   /api/{date}/email-campaigns/{id}:duplicate
POST   /api/{date}/email-campaigns/{id}:send-test                 # preview to test list
GET    /api/{date}/email-campaigns/{id}/recipients
GET    /api/{date}/email-campaigns/{id}/metrics
GET    /api/{date}/email-campaigns/{id}/sends                     # individual delivery records
```

### 9.4 Email sends + provider webhooks

```
GET    /api/{date}/email-sends
GET    /api/{date}/email-sends/{id}
POST   /api/{date}/email-sends/{id}:resend                        # admin resend
GET    /api/{date}/email-sends/{id}/clicks
GET    /api/{date}/email-suppression-list
POST   /api/{date}/email-suppression-list                          # manually add
DELETE /api/{date}/email-suppression-list/{email}                  # remove (with caution)

# Public webhooks
POST   /api/{date}/webhooks/email/{provider}/{tenant_pub_id}
```

### 9.5 Automation flows

```
GET    /api/{date}/automation-flows
POST   /api/{date}/automation-flows
GET    /api/{date}/automation-flows/{id}
PATCH  /api/{date}/automation-flows/{id}
DELETE /api/{date}/automation-flows/{id}
POST   /api/{date}/automation-flows/{id}:activate
POST   /api/{date}/automation-flows/{id}:pause
POST   /api/{date}/automation-flows/{id}:archive
POST   /api/{date}/automation-flows/{id}:test                       # dry-run with test customer
POST   /api/{date}/automation-flows/{id}:trigger-manually            # for testing
GET    /api/{date}/automation-flows/{id}/runs                         # current/historical runs
GET    /api/{date}/automation-flows/{id}/metrics
POST   /api/{date}/automation-flows/{id}/runs/{run_id}:cancel
```

### 9.6 Newsletter

```
# Storefront
POST   /api/{date}/storefront/newsletter/subscribe                    # body: { email, source?, locale? }
GET    /api/{date}/storefront/newsletter/confirm?token=...
POST   /api/{date}/storefront/newsletter/unsubscribe?token=...
PATCH  /api/{date}/storefront/newsletter/preferences

# Admin
GET    /api/{date}/newsletter-subscriptions
POST   /api/{date}/newsletter-subscriptions:bulk-import
GET    /api/{date}/newsletter-subscriptions/{id}
DELETE /api/{date}/newsletter-subscriptions/{id}
POST   /api/{date}/newsletter-subscriptions:export
```

### 9.7 Reviews

```
# Storefront
POST   /api/{date}/storefront/reviews                                  # submit review
GET    /api/{date}/storefront/products/{slug}/reviews?sort=...&filter=...
PATCH  /api/{date}/storefront/reviews/{id}                              # edit own (within 30d)
DELETE /api/{date}/storefront/reviews/{id}                              # request own delete
POST   /api/{date}/storefront/reviews/{id}:helpful                       # mark helpful
POST   /api/{date}/storefront/reviews/{id}:report                        # flag abuse

# Admin
GET    /api/{date}/reviews
GET    /api/{date}/reviews/{id}
POST   /api/{date}/reviews/{id}:approve
POST   /api/{date}/reviews/{id}:reject
POST   /api/{date}/reviews/{id}:mark-spam
POST   /api/{date}/reviews/{id}:hide
POST   /api/{date}/reviews/{id}:reply                                    # merchant reply
GET    /api/{date}/reviews:pending-moderation
POST   /api/{date}/reviews:bulk-moderate
```

### 9.8 Wishlist

```
GET    /api/{date}/storefront/me/wishlists
POST   /api/{date}/storefront/me/wishlists                                # create
GET    /api/{date}/storefront/me/wishlists/{id}
PATCH  /api/{date}/storefront/me/wishlists/{id}                            # rename, share
DELETE /api/{date}/storefront/me/wishlists/{id}
POST   /api/{date}/storefront/me/wishlists/{id}/items                      # add item
DELETE /api/{date}/storefront/me/wishlists/{id}/items/{item_id}
POST   /api/{date}/storefront/me/wishlists/{id}/items/{item_id}:move-to-cart
GET    /api/{date}/storefront/wishlists/by-share-token?token=...           # shared view
```

### 9.9 Back in stock

```
POST   /api/{date}/storefront/back-in-stock/subscribe                       # body: { variant_id, email }
POST   /api/{date}/storefront/back-in-stock/unsubscribe?token=...
GET    /api/{date}/back-in-stock-subscriptions                              # admin
```

### 9.10 Social product feeds

```
GET    /api/{date}/marketing/product-feeds
POST   /api/{date}/marketing/product-feeds
GET    /api/{date}/marketing/product-feeds/{id}
PATCH  /api/{date}/marketing/product-feeds/{id}
DELETE /api/{date}/marketing/product-feeds/{id}
POST   /api/{date}/marketing/product-feeds/{id}:regenerate
GET    /api/{date}/marketing/product-feeds/{id}/status

# Public feeds
GET    /feeds/{platform}.{ext}                                                # e.g., /feeds/heureka.xml
```

### 9.11 Analytics

```
GET    /api/{date}/marketing-analytics/email-performance?period=30d
GET    /api/{date}/marketing-analytics/automation-flows-performance
GET    /api/{date}/marketing-analytics/top-converting-campaigns
GET    /api/{date}/marketing-analytics/list-growth?period=90d
GET    /api/{date}/marketing-analytics/segment-overlap
GET    /api/{date}/marketing-analytics/deliverability?period=30d            # bounce + complaint rate
```

### 9.12 Example: Submit review

```http
POST /api/2026-05-20/storefront/reviews HTTP/1.1
Authorization: Bearer customer_jwt

{
  "product_id": "prd_aB",
  "variant_id": "var_xY",
  "order_id": "ord_aB",
  "rating": 5,
  "title": "Skvělá lampa",
  "body": "Designově krásná, světlo příjemné. Doporučuji!",
  "media_ids": ["mdi_photo1"]
}
```

```jsonc
HTTP/1.1 201 Created

{
  "data": {
    "id": "...",
    "pub_id": "rev_aB",
    "attributes": {
      "product_id": "prd_aB",
      "rating": 5,
      "title": "Skvělá lampa",
      "body": "Designově krásná...",
      "is_verified_purchase": true,
      "status": "pending_moderation",
      "reviewer_name": "Jan N."
    }
  },
  "meta": {
    "next_step": "Vaše recenze čeká na schválení a brzy bude zveřejněna."
  }
}
```

### 9.13 Example: Create email campaign

```http
POST /api/2026-05-20/email-campaigns HTTP/1.1
Idempotency-Key: ...

{
  "name": "Letní výprodej 2026",
  "subject": "Letní výprodej už začal — slevy až 50 %",
  "preheader": "Vybrali jsme pro vás top kousky léta",
  "from_name": "Shop XYZ",
  "from_email": "novinky@shop.example.com",
  "body_mjml": "<mjml>...</mjml>",
  "locale": "cs-CZ",
  "segment_filter": { "tags": ["VIP"], "accepts_marketing": true },
  "send_strategy": "scheduled",
  "scheduled_send_at": "2026-06-01T10:00:00Z",
  "attached_coupon_id": "cpn_summer50",
  "utm_campaign": "summer-sale-2026"
}
```

```jsonc
HTTP/1.1 201 Created

{
  "data": {
    "id": "...",
    "pub_id": "cmp_aB",
    "attributes": {
      "name": "Letní výprodej 2026",
      "status": "draft",
      "estimated_recipient_count": 1247,
      "scheduled_send_at": "2026-06-01T10:00:00Z"
    },
    "next_step": "Submit for review or send test before scheduling"
  }
}
```

### 9.14 Example: Newsletter subscribe

```http
POST /api/2026-05-20/storefront/newsletter/subscribe HTTP/1.1
Content-Type: application/json

{
  "email": "newuser@example.com",
  "source": "footer_form",
  "locale": "cs-CZ",
  "preferences": { "categories": ["lighting", "furniture"] }
}
```

```jsonc
HTTP/1.1 202 Accepted

{
  "data": {
    "email": "newuser@example.com",
    "is_confirmed": false
  },
  "meta": {
    "next_step": "Confirmation email sent. Please click the link within 24 hours.",
    "confirmation_email_sent": true
  }
}
```

### 9.15 Example: Get email metrics

```http
GET /api/2026-05-20/email-campaigns/cmp_aB/metrics HTTP/1.1
```

```jsonc
HTTP/1.1 200 OK

{
  "data": {
    "campaign_id": "cmp_aB",
    "status": "sent",
    "total_recipients": 1247,
    "total_sent": 1247,
    "total_delivered": 1198,
    "total_bounced": 49,
    "total_opened": 587,
    "total_clicked": 142,
    "total_unsubscribed": 8,
    "total_complained": 2,
    "total_converted": 31,
    "total_revenue_attributed_amount": 187300,
    "total_revenue_currency": "CZK",
    "delivery_rate_basis_points": 9607,
    "open_rate_basis_points": 4900,
    "click_rate_basis_points": 1186,
    "click_to_open_rate_basis_points": 2419,
    "unsubscribe_rate_basis_points": 67,
    "complaint_rate_basis_points": 17,
    "conversion_rate_basis_points": 261,
    "send_started_at": "2026-06-01T10:00:00Z",
    "send_completed_at": "2026-06-01T10:35:00Z"
  }
}
```

---

## 10. GraphQL schema

```graphql
type SeoMetadata implements Node {
  id: ID!
  entityType: SeoEntityType!
  entityId: ID
  locale: String!
  title: String
  description: String
  canonicalUrl: String
  robots: String
  ogTitle: String
  ogDescription: String
  ogImage: Media
  ogType: String
  twitterCard: TwitterCard
  schemaJsonldOverride: JSON
  schemaJsonldExtensions: JSON
  hreflangAlternates: JSON
}

enum SeoEntityType { PRODUCT CATEGORY COLLECTION CMS_PAGE BLOG_POST TENANT_ROOT STORE_ROOT CHANNEL_ROOT }
enum TwitterCard { SUMMARY SUMMARY_LARGE_IMAGE APP PLAYER }

type Redirect implements Node {
  id: ID!
  channel: Channel
  locale: String
  fromPath: String!
  matchKind: RedirectMatchKind!
  toPath: String!
  statusCode: Int!
  preserveQueryString: Boolean!
  isActive: Boolean!
  priority: Int!
  startsAt: DateTime
  endsAt: DateTime
  hitCount: Int!
  lastHitAt: DateTime
  createdAt: DateTime!
}

enum RedirectMatchKind { EXACT PREFIX REGEX }

type EmailCampaign implements Node {
  id: ID!
  pubId: String!
  name: String!
  subject: String!
  preheader: String
  fromName: String
  fromEmail: String
  bodyMjml: String!
  segment: CustomerSegment
  estimatedRecipientCount: Int
  sendStrategy: EmailSendStrategy!
  scheduledSendAt: DateTime
  sendInRecipientTimezone: Boolean!
  status: EmailCampaignStatus!
  totalSent: Int!
  totalDelivered: Int!
  totalBounced: Int!
  totalOpened: Int!
  totalClicked: Int!
  totalUnsubscribed: Int!
  totalConverted: Int!
  totalRevenueAttributed: Money
  deliveryRate: Float
  openRate: Float
  clickRate: Float
  attachedCoupon: Coupon
  locale: String!
  utmCampaign: String!
  createdAt: DateTime!
  updatedAt: DateTime!
}

enum EmailSendStrategy { IMMEDIATE SCHEDULED RECURRING TRIGGERED }
enum EmailCampaignStatus { DRAFT REVIEW SCHEDULED SENDING SENT PAUSED FAILED CANCELLED }

type EmailSend implements Node {
  id: ID!
  campaign: EmailCampaign
  automationFlow: AutomationFlow
  emailTemplateCode: String
  recipientCustomer: Customer
  recipientEmail: String!
  subject: String!
  status: EmailSendStatus!
  queuedAt: DateTime!
  sentAt: DateTime
  deliveredAt: DateTime
  firstOpenedAt: DateTime
  firstClickedAt: DateTime
  unsubscribedAt: DateTime
  bounceKind: BounceKind
  bounceReason: String
  attributedOrder: Order
  attributedOrderAmount: Money
  openCount: Int!
  clickCount: Int!
}

enum EmailSendStatus { QUEUED SENDING SENT DELIVERED BOUNCED COMPLAINED OPENED CLICKED UNSUBSCRIBED FAILED SUPPRESSED }
enum BounceKind { HARD SOFT SUPPRESS }

type AutomationFlow implements Node {
  id: ID!
  pubId: String!
  name: String!
  description: String
  triggerKind: AutomationTriggerKind!
  triggerConditions: JSON
  steps: JSON!
  status: AutomationFlowStatus!
  isDefault: Boolean!
  maxConcurrentRunsPerCustomer: Int!
  cooldownSeconds: Int
  totalStarted: Int!
  totalCompleted: Int!
  totalExitedEarly: Int!
  totalRevenueAttributed: Money!
  createdAt: DateTime!
  updatedAt: DateTime!
}

enum AutomationTriggerKind {
  CART_ABANDONED CUSTOMER_SIGNUP ORDER_PLACED ORDER_DELIVERED
  PRODUCT_VIEWED CUSTOMER_INACTIVE BIRTHDAY CUSTOM_EVENT
  SUBSCRIPTION_RENEWED SUBSCRIPTION_CANCELLED REVIEW_REQUEST_POST_DELIVERY
}

enum AutomationFlowStatus { DRAFT ACTIVE PAUSED ARCHIVED }

type AutomationRun implements Node {
  id: ID!
  automationFlow: AutomationFlow!
  customer: Customer
  customerEmail: String
  status: AutomationRunStatus!
  currentStepIndex: Int!
  nextActionAt: DateTime
  startedAt: DateTime!
  completedAt: DateTime
  exitReason: AutomationRunExitReason
  emailsSent: Int!
  attributedOrder: Order
}

enum AutomationRunStatus { RUNNING COMPLETED EXITED FAILED CANCELLED }
enum AutomationRunExitReason { COMPLETED CART_RECOVERED ORDER_PLACED UNSUBSCRIBED MANUAL_CANCEL MAX_RUNS_EXCEEDED FLOW_ARCHIVED FAILED }

type NewsletterSubscription implements Node {
  id: ID!
  email: String!
  linkedCustomer: Customer
  source: NewsletterSource!
  isConfirmed: Boolean!
  confirmedAt: DateTime
  unsubscribedAt: DateTime
  preferences: JSON
  createdAt: DateTime!
}

enum NewsletterSource { FOOTER_FORM POPUP CHECKOUT ADMIN_IMPORT API SOCIAL REFERRAL }

type Review implements Node {
  id: ID!
  pubId: String!
  product: Product!
  variant: ProductVariant
  customer: Customer
  reviewerName: String!
  rating: Int!
  title: String
  body: String
  media: [Media!]!
  isVerifiedPurchase: Boolean!
  status: ReviewStatus!
  helpfulCount: Int!
  notHelpfulCount: Int!
  replyFromMerchant: String
  replyFromMerchantAt: DateTime
  createdAt: DateTime!
}

enum ReviewStatus { PENDING_MODERATION APPROVED REJECTED SPAM HIDDEN }

type Wishlist implements Node {
  id: ID!
  pubId: String!
  customer: Customer!
  name: String!
  isDefault: Boolean!
  isPublic: Boolean!
  items: [WishlistItem!]!
  createdAt: DateTime!
}

type WishlistItem {
  id: ID!
  variant: ProductVariant!
  product: Product!
  note: String
  position: Int!
  addedAt: DateTime!
}

type SocialProductFeed implements Node {
  id: ID!
  pubId: String!
  name: String!
  platform: SocialFeedPlatform!
  feedFormat: String!
  locale: String!
  currency: String!
  publicUrlPath: String!
  lastGeneratedAt: DateTime
  generationFrequencyMinutes: Int!
  isActive: Boolean!
  lastGenerationProductCount: Int
}

enum SocialFeedPlatform { HEUREKA ZBOZI_CZ GOOGLE_SHOPPING META_CATALOG PINTEREST TIKTOK CUSTOM_XML CUSTOM_JSON }

extend type Query {
  seoMetadata(entityType: SeoEntityType!, entityId: ID, locale: String!): SeoMetadata
  redirects(first: Int, after: String, filter: RedirectFilter): RedirectConnection! @auth(requires: PERM_SEO_VIEW)
  resolveRedirect(path: String!): Redirect

  emailTemplates: [EmailTemplate!]! @auth(requires: PERM_MARKETING_VIEW)
  emailCampaigns(first: Int, after: String, filter: EmailCampaignFilter): EmailCampaignConnection! @auth(requires: PERM_MARKETING_VIEW)
  emailCampaign(id: ID, pubId: String): EmailCampaign @auth(requires: PERM_MARKETING_VIEW)

  automationFlows: [AutomationFlow!]! @auth(requires: PERM_MARKETING_VIEW)
  automationFlow(id: ID, pubId: String): AutomationFlow @auth(requires: PERM_MARKETING_VIEW)
  myAutomationRuns: [AutomationRun!]!  # for customer transparency

  newsletterSubscriptions(first: Int, after: String, filter: NewsletterFilter): NewsletterSubscriptionConnection! @auth(requires: PERM_MARKETING_VIEW)

  productReviews(productId: ID!, status: [ReviewStatus!] = [APPROVED], sort: ReviewSort = NEWEST, first: Int = 10, after: String): ReviewConnection!
  myReviews(first: Int, after: String): ReviewConnection!
  pendingReviewModeration(first: Int, after: String): ReviewConnection! @auth(requires: PERM_REVIEW_MODERATE)

  myWishlists: [Wishlist!]!
  wishlistByShareToken(token: String!): Wishlist!

  socialProductFeeds: [SocialProductFeed!]! @auth(requires: PERM_MARKETING_VIEW)
}

extend type Mutation {
  upsertSeoMetadata(input: SeoMetadataInput!): SeoMetadata! @auth(requires: PERM_SEO_MANAGE)
  createRedirect(input: RedirectInput!): Redirect! @auth(requires: PERM_SEO_MANAGE)
  updateRedirect(id: ID!, input: RedirectInput!): Redirect! @auth(requires: PERM_SEO_MANAGE)
  deleteRedirect(id: ID!): DeletePayload! @auth(requires: PERM_SEO_MANAGE)
  regenerateSitemap: Operation! @auth(requires: PERM_SEO_MANAGE)

  createEmailCampaign(input: EmailCampaignInput!): EmailCampaign! @auth(requires: PERM_MARKETING_CAMPAIGN_CREATE)
  updateEmailCampaign(id: ID!, input: EmailCampaignInput!): EmailCampaign! @auth(requires: PERM_MARKETING_CAMPAIGN_EDIT)
  scheduleEmailCampaign(id: ID!, scheduledSendAt: DateTime!): EmailCampaign! @auth(requires: PERM_MARKETING_CAMPAIGN_SEND)
  sendEmailCampaignNow(id: ID!): EmailCampaign! @auth(requires: PERM_MARKETING_CAMPAIGN_SEND)
  pauseEmailCampaign(id: ID!): EmailCampaign! @auth(requires: PERM_MARKETING_CAMPAIGN_EDIT)
  cancelEmailCampaign(id: ID!): EmailCampaign! @auth(requires: PERM_MARKETING_CAMPAIGN_EDIT)
  sendTestEmail(campaignId: ID, templateCode: String, recipientEmails: [String!]!): MutationPayload! @auth(requires: PERM_MARKETING_VIEW)

  createAutomationFlow(input: AutomationFlowInput!): AutomationFlow! @auth(requires: PERM_MARKETING_AUTOMATION_MANAGE)
  updateAutomationFlow(id: ID!, input: AutomationFlowInput!): AutomationFlow! @auth(requires: PERM_MARKETING_AUTOMATION_MANAGE)
  activateAutomationFlow(id: ID!): AutomationFlow! @auth(requires: PERM_MARKETING_AUTOMATION_MANAGE)
  pauseAutomationFlow(id: ID!): AutomationFlow! @auth(requires: PERM_MARKETING_AUTOMATION_MANAGE)
  cancelAutomationRun(id: ID!): AutomationRun! @auth(requires: PERM_MARKETING_AUTOMATION_MANAGE)

  subscribeToNewsletter(input: NewsletterSubscribeInput!): MutationPayload!
  confirmNewsletterSubscription(token: String!): MutationPayload!
  unsubscribeFromNewsletter(token: String!): MutationPayload!

  submitReview(input: ReviewInput!): Review!
  updateMyReview(id: ID!, input: ReviewInput!): Review!
  deleteMyReview(id: ID!): DeletePayload!
  voteReviewHelpful(id: ID!): Review!
  reportReview(id: ID!, reason: String!): MutationPayload!

  approveReview(id: ID!): Review! @auth(requires: PERM_REVIEW_MODERATE)
  rejectReview(id: ID!, reason: String!): Review! @auth(requires: PERM_REVIEW_MODERATE)
  markReviewSpam(id: ID!): Review! @auth(requires: PERM_REVIEW_MODERATE)
  replyToReview(id: ID!, reply: String!): Review! @auth(requires: PERM_REVIEW_MODERATE)

  addToMyWishlist(wishlistId: ID, variantId: ID!): WishlistItem!
  removeFromMyWishlist(wishlistItemId: ID!): DeletePayload!
  shareMyWishlist(wishlistId: ID!): String!

  subscribeBackInStock(input: BackInStockSubscribeInput!): MutationPayload!

  createSocialProductFeed(input: SocialProductFeedInput!): SocialProductFeed! @auth(requires: PERM_MARKETING_FEED_MANAGE)
  regenerateSocialProductFeed(id: ID!): Operation! @auth(requires: PERM_MARKETING_FEED_MANAGE)
}
```

---

## 11. Events

| Build-spec ID | Wire | Payload |
|---|---|---|
| `EVENT-SEO-METADATA-CHANGED` | `seo.metadata_changed` | `{ entity_type, entity_id, locale }` |
| `EVENT-REDIRECT-CREATED` | `seo.redirect_created` | `{ redirect }` |
| `EVENT-SITEMAP-GENERATED` | `seo.sitemap_generated` | `{ tenant_id, kinds, total_urls }` |
| `EVENT-SITEMAP-MARKED-STALE` | `seo.sitemap_stale` | `{ tenant_id, reason }` |
| `EVENT-EMAIL-CAMPAIGN-CREATED` | `email.campaign_created` | `{ campaign }` |
| `EVENT-EMAIL-CAMPAIGN-SCHEDULED` | `email.campaign_scheduled` | `{ campaign }` |
| `EVENT-EMAIL-CAMPAIGN-SENDING-STARTED` | `email.campaign_sending_started` | `{ campaign, recipient_count }` |
| `EVENT-EMAIL-CAMPAIGN-SENT` | `email.campaign_sent` | `{ campaign, total_sent }` |
| `EVENT-EMAIL-CAMPAIGN-PAUSED` | `email.campaign_paused` | `{ campaign, reason }` |
| `EVENT-EMAIL-SENT` | `email.sent` | `{ send }` |
| `EVENT-EMAIL-DELIVERED` | `email.delivered` | `{ send }` |
| `EVENT-EMAIL-BOUNCED` | `email.bounced` | `{ send, bounce_kind }` |
| `EVENT-EMAIL-COMPLAINED` | `email.complained` | `{ send }` |
| `EVENT-EMAIL-OPENED` | `email.opened` | `{ send }` |
| `EVENT-EMAIL-CLICKED` | `email.clicked` | `{ send, url }` |
| `EVENT-EMAIL-UNSUBSCRIBED` | `email.unsubscribed` | `{ send, customer_id }` |
| `EVENT-EMAIL-SUPPRESSED` | `email.suppressed` | `{ email, reason, scope }` |
| `EVENT-AUTOMATION-RUN-STARTED` | `automation.run_started` | `{ run }` |
| `EVENT-AUTOMATION-RUN-STEP-EXECUTED` | `automation.step_executed` | `{ run, step_index, step_kind, result }` |
| `EVENT-AUTOMATION-RUN-COMPLETED` | `automation.run_completed` | `{ run }` |
| `EVENT-AUTOMATION-RUN-EXITED` | `automation.run_exited` | `{ run, reason }` |
| `EVENT-NEWSLETTER-SUBSCRIBED` | `newsletter.subscribed` | `{ subscription }` |
| `EVENT-NEWSLETTER-CONFIRMED` | `newsletter.confirmed` | `{ subscription }` |
| `EVENT-NEWSLETTER-UNSUBSCRIBED` | `newsletter.unsubscribed` | `{ subscription }` |
| `EVENT-REVIEW-SUBMITTED` | `review.submitted` | `{ review }` |
| `EVENT-REVIEW-APPROVED` | `review.approved` | `{ review }` |
| `EVENT-REVIEW-REJECTED` | `review.rejected` | `{ review, reason }` |
| `EVENT-REVIEW-REPLIED` | `review.replied` | `{ review, reply }` |
| `EVENT-WISHLIST-ITEM-ADDED` | `wishlist.item_added` | `{ wishlist, item }` |
| `EVENT-WISHLIST-ITEM-REMOVED` | `wishlist.item_removed` | `{ wishlist, item_id }` |
| `EVENT-BACK-IN-STOCK-SUBSCRIBED` | `back_in_stock.subscribed` | `{ subscription }` |
| `EVENT-BACK-IN-STOCK-NOTIFIED` | `back_in_stock.notified` | `{ subscription, customers_notified }` |
| `EVENT-PRODUCT-FEED-GENERATED` | `marketing.product_feed_generated` | `{ feed, product_count, duration_ms }` |
| `EVENT-DELIVERABILITY-DEGRADED` | `marketing.deliverability_degraded` | `{ provider, bounce_rate, complaint_rate }` |

**Konzumenti:**
- Search indexer — reindex on SEO metadata changes
- Automation engine — flow triggers
- Analytics — campaign metrics aggregation
- Customer aggregates — review_count, helpful votes
- Webhook delivery

---

## 12. Background jobs

| Job | Trigger | Queue | Frequency |
|---|---|---|---|
| `JOB-GENERATE-SITEMAP-FULL` | scheduled OR stale flag | `seo` | Daily 03:00 |
| `JOB-MARK-SITEMAP-STALE` | EVENT-PRODUCT-* / CATEGORY-* / etc. | `seo` | On-demand |
| `JOB-PING-SEARCH-ENGINES` | EVENT-SITEMAP-GENERATED | `seo` | On-demand |
| `JOB-VALIDATE-HREFLANG` | scheduled | `seo` | Daily |
| `JOB-CLEANUP-OLD-REDIRECT-HITS` | scheduled | `maintenance` | Daily |
| `JOB-SEND-EMAIL` | enqueued by campaign / automation | `email-outgoing` | On-demand |
| `JOB-PROCESS-EMAIL-WEBHOOK-EVENT` | webhook received | `email-webhooks` | On-demand |
| `JOB-SEND-EMAIL-CAMPAIGN` | EVENT-EMAIL-CAMPAIGN-SCHEDULED at scheduled_send_at | `email-campaigns` | On-demand |
| `JOB-ABORT-CAMPAIGN-ON-HIGH-BOUNCE` | bounce rate monitoring | `email-monitor` | Every 5 min during send |
| `JOB-ABORT-CAMPAIGN-ON-COMPLAINT` | complaint rate monitoring | `email-monitor` | Every 5 min during send |
| `JOB-PROCESS-EMAIL-ATTRIBUTION` | EVENT-ORDER-PLACED | `analytics` | On-demand |
| `JOB-AUTOMATION-RUN-TICK` | scheduled (poll runs with next_action_at <= now) | `automations` | Every minute |
| `JOB-AUTOMATION-START-RUN` | trigger events (cart_abandoned, etc.) | `automations` | On-demand |
| `JOB-AUTOMATION-EXIT-RUN-ON-EVENT` | events that satisfy exit conditions | `automations` | On-demand |
| `JOB-CONFIRM-NEWSLETTER-EXPIRY` | scheduled | `marketing-sweeper` | Daily (cleanup unconfirmed > 7d) |
| `JOB-AUTO-MODERATE-REVIEWS` | EVENT-REVIEW-SUBMITTED (Fáze 2 AI) | `moderation` | On-demand |
| `JOB-REQUEST-REVIEW-AFTER-DELIVERY` | scheduled | `marketing` | Daily (5 days post-delivery) |
| `JOB-NOTIFY-BACK-IN-STOCK` | EVENT-STOCK-RESTOCKED (from `09`) | `notifications` | On-demand |
| `JOB-CLEANUP-EXPIRED-BACK-IN-STOCK` | scheduled | `maintenance` | Daily (>90 days old) |
| `JOB-GENERATE-SOCIAL-PRODUCT-FEED` | scheduled per feed.generation_frequency_minutes | `marketing-feeds` | Configurable |
| `JOB-AGGREGATE-CAMPAIGN-METRICS` | EVENT-EMAIL-* | `analytics` | On-demand (debounced) |
| `JOB-DETECT-DELIVERABILITY-ISSUES` | scheduled | `email-monitor` | Hourly |
| `JOB-RECOMPUTE-PRODUCT-AGGREGATE-RATING` | EVENT-REVIEW-APPROVED / REJECTED | `analytics` | On-demand (debounced) |
| `JOB-PURGE-OLD-EMAIL-SENDS` | scheduled | `maintenance` | Daily (per retention) |
| `JOB-DETECT-INACTIVE-CUSTOMERS` | scheduled (for win-back) | `marketing` | Daily |
| `JOB-BIRTHDAY-FLOW-TRIGGER` | scheduled (for birthday flow) | `marketing` | Daily 08:00 |

### 12.1 JOB-SEND-EMAIL-CAMPAIGN detail

```typescript
async function sendEmailCampaign(campaignId: string) {
  const campaign = await loadCampaign(campaignId);
  if (campaign.status !== 'scheduled') return; // idempotent guard
  
  // Status → sending
  await updateCampaign(campaignId, { status: 'sending', send_started_at: new Date() });
  await emitOutbox('EVENT-EMAIL-CAMPAIGN-SENDING-STARTED', { campaign });
  
  // Resolve recipients
  const recipients = await resolveRecipients(campaign.segment_filter);
  
  // Filter suppression + consent
  const eligible = await filterEligibleRecipients(recipients, 'marketing');
  
  // Insert email_sends rows (status='queued') in batches
  await batchInsertEmailSends(campaign, eligible);
  
  // Enqueue per-recipient jobs respecting throttle
  for (const batch of chunk(eligible, 100)) {
    for (const recipient of batch) {
      await enqueueJob('JOB-SEND-EMAIL', { send_id: ..., campaign_id: campaign.id, recipient_id: recipient.id });
    }
    await sleep(1000); // throttle
  }
  
  // Final status update happens after all sends complete (event-driven via JOB-AGGREGATE-CAMPAIGN-METRICS)
}
```

### 12.2 JOB-AUTOMATION-RUN-TICK detail

```typescript
async function automationRunTick() {
  // Poll runs ready to execute next step
  const pending = await pg.query(sql`
    SELECT * FROM automation_runs
    WHERE status = 'running' AND next_action_at <= now()
    LIMIT 1000
    FOR UPDATE SKIP LOCKED
  `);
  
  for (const run of pending) {
    try {
      await executeNextStep(run);
    } catch (err) {
      await markRunFailed(run, err);
    }
  }
}

async function executeNextStep(run: AutomationRun) {
  const flow = await loadFlow(run.automation_flow_id);
  const step = flow.steps[run.current_step_index];
  
  // Check exit conditions first
  if (await checkExitCondition(run, flow)) {
    await exitRun(run, computeExitReason(run, flow));
    return;
  }
  
  switch (step.kind) {
    case 'wait':
      await scheduleNextStep(run, step.delay_seconds);
      break;
    case 'send_email':
      await sendAutomationEmail(run, step);
      await advanceStep(run);
      break;
    case 'branch':
      const branchTaken = await evaluateBranch(run, step);
      run.current_step_index = branchTaken ? step.yes_path_index : step.no_path_index;
      await saveRun(run);
      break;
    case 'add_tag':
      await tagCustomer(run.customer_id, step.tag);
      await advanceStep(run);
      break;
    case 'exit':
      await exitRun(run, step.reason ?? 'completed');
      break;
    // ... other step kinds
  }
}
```

---

## 13. UI/UX flows

### FLOW-MAR-001: SEO management (admin)

```
[Admin → SEO → Pages]
   - List of pages with SEO scores (auto-computed)
        │
   click product
        │
        ▼
[SEO panel within product editor]
   - SEO title input + length indicator (recommended 50-60 chars)
   - Meta description + length indicator (150-160)
   - Canonical URL override
   - OG image upload
   - JSON-LD preview (collapsible)
   - "Preview in Google" simulation
        │
        ▼
[Save → PATCH /seo/metadata]
   - Sitemap marked stale
```

### FLOW-MAR-002: Create email campaign

```
[Admin → Marketing → Campaigns → New]
        │
        ▼
[Wizard]
   Step 1: Name + segment (existing or ad-hoc filter)
   Step 2: Subject + preheader + from
   Step 3: Body editor (MJML / drag-drop block builder)
     - Drag blocks: header, hero, product grid, button, divider, footer
     - Personalization tokens
     - Preview button
   Step 4: Schedule + attach coupon
   Step 5: Review
     - Estimated recipients
     - Preview render
     - Submit for review OR send-now
        │
        ▼
[POST /email-campaigns]
   - status='draft'
        │
   admin sends test email to themselves
        │
        ▼
[POST /email-campaigns/{id}:submit-for-review]
   - status='review'
   - Approval workflow (if threshold met)
        │
        ▼
[POST /email-campaigns/{id}:approve]
   - status='scheduled'
   - Cron fires at scheduled_send_at
   - JOB-SEND-EMAIL-CAMPAIGN executes
```

### FLOW-MAR-003: Automation flow builder

```
[Admin → Marketing → Automations → New]
        │
        ▼
[Visual flow builder]
   - Drag-drop nodes:
     • Trigger: "Cart abandoned"
     • Wait: 1 hour
     • Email: "Cart reminder"
     • Wait: 1 day
     • Branch: "If cart total > 1000"
       ├─ Email: "Premium reminder with 10% coupon"
       └─ Email: "Standard reminder"
     • Wait: 3 days
     • Email: "Last chance"
     • Exit
   - Per node: configure parameters
   - Connect nodes (visually)
        │
        ▼
[Save → POST /automation-flows]
   - status='draft'
        │
   admin tests
        │
        ▼
[POST /automation-flows/{id}:activate]
   - status='active'
   - Trigger listens for new EVENT-CART-ABANDONED → starts run
```

### FLOW-MAR-004: Customer subscribes to newsletter

```
[Storefront footer → newsletter signup form]
   - Email input
   - "Subscribe" button
        │
        ▼
[POST /storefront/newsletter/subscribe]
   - newsletter_subscriptions row (is_confirmed=false)
   - Confirmation email sent
        │
   ... customer clicks email link ...
        │
        ▼
[GET /storefront/newsletter/confirm?token=...]
   - is_confirmed=true
   - marketing_email consent granted in customer_consents
   - "Welcome" email auto-sent (if welcome flow active)
   - Storefront landing: "Děkujeme za přihlášení!"
```

### FLOW-MAR-005: Customer writes review

```
[Storefront product detail → "Write a review" CTA (visible if customer has order with this product)]
        │
        ▼
[Review form]
   - Star rating (required)
   - Title (optional)
   - Body (optional, min 10 chars)
   - Photos upload
   - Submit
        │
        ▼
[POST /storefront/reviews]
   - status='pending_moderation'
   - Customer sees "Děkujeme, recenze čeká na schválení"
        │
   ... admin moderates ...
        │
        ▼
[Email to customer: "Vaše recenze je nyní zveřejněna"]
   - Public on product page
   - Aggregate rating recomputed
```

### FLOW-MAR-006: Admin moderates reviews

```
[Admin → Reviews → Pending queue]
   - List with rating, customer, product, body preview
   - Auto-spam-flagged at top
        │
   click review
        │
        ▼
[Review detail]
   - Full content + photos
   - Customer context (orders, total reviews, sentiment history)
   - Product link
   - Actions:
     [Approve] [Reject] [Mark spam] [Hide] [Reply]
   - If Reply: textarea for merchant response
        │
        ▼
[POST /reviews/{id}:approve]
   - status='approved'
   - Customer notified
   - Aggregate rating updated
```

### FLOW-MAR-007: Configure social product feed (Heuréka)

```
[Admin → Marketing → Product feeds → New]
   - Platform: Heuréka
   - Locale: cs-CZ
   - Currency: CZK
   - Filter: All active products in stock
   - Frequency: hourly
        │
        ▼
[POST /marketing/product-feeds]
   - Feed URL provided: https://shop.example.com/feeds/heureka.xml
   - First generation queued
        │
        ▼
[Merchant copies URL → submits to Heuréka admin panel]
[Heuréka periodically fetches from URL]
```

---

## 14. Edge cases & error handling

| Scenario | Behavior | Code |
|---|---|---|
| Send marketing email to customer without consent | Suppress; record reason | (silent, logged) |
| Send marketing email to suppressed address | Suppress | (silent, logged) |
| Campaign throttled at provider | Retry with backoff | (handled) |
| Bounce rate > 5% mid-send | Auto-pause campaign | (handled per RULE-MAR-029) |
| Email template variable missing | Use default fallback OR fail-fast with clear error | (configurable) |
| Customer click on dead link | Track click, redirect to fallback URL or homepage | (handled) |
| Customer unsubscribes mid-automation | Exit run; reason='unsubscribed' | (handled) |
| Customer in 5 active automation runs simultaneously | New trigger rejected; cooldown enforced | (handled per RULE-MAR-025) |
| Trigger event for unknown customer (e.g., guest cart abandoned) | Run created with `customer_email`, no `customer_id` | (handled) |
| Newsletter signup with existing email | Re-send confirmation if unconfirmed; else no-op | (handled) |
| Newsletter confirmation token expired | Allow re-request | (handled) |
| Review submitted for product customer didn't order | Allow but no verified badge | (handled) |
| Review submitted with profanity / spam content | Auto-mark spam (Fáze 2 AI); else manual review | (handled) |
| Customer attempts to edit review > 30 days old | Reject; suggest admin contact | `EDIT_WINDOW_EXPIRED`, 422 |
| Wishlist > 100 items | Reject add (configurable) | `WISHLIST_TOO_LARGE`, 422 |
| Back-in-stock subscribe but product not out of stock | Reject (subscribe button shouldn't show) | `PRODUCT_AVAILABLE`, 422 |
| Same email subscribes 10x back-in-stock for same variant | UNIQUE constraint; idempotent (existing row reused) | (handled) |
| Sitemap chunk > 50k URLs | Auto-split into multiple chunks | (handled) |
| Sitemap generation > 30 min | Background job continues; admin alert | (handled) |
| Redirect loop (A → B → A) | Detect at lookup; serve 508 | `REDIRECT_LOOP`, 508 |
| Hreflang URL doesn't exist | Skip alternate (warning logged) | (handled) |
| JSON-LD schema validation error | Log warning; emit anyway (search engines fault tolerant) | (handled) |
| Product feed generation > 10 min | Continue async; cached version served meanwhile | (handled) |
| Email provider webhook signature invalid | Reject 401, log, alert | (security) |
| Open tracking pixel cached by Apple Mail Privacy | Track as open anyway (limitation noted) | (handled, with caveat) |
| Customer GDPR delete during active campaign | Anonymize email_sends rows for that customer | (handled per RULE-MAR-030) |
| Concurrent campaign edits | Optimistic lock via version | `RESOURCE_VERSION_MISMATCH`, 412 |
| Test send to non-internal address | Reject (anti-abuse) | `TEST_ADDRESS_NOT_ALLOWED`, 422 |

---

## 15. Performance

### 15.1 Targets

| Operation | p50 | p95 | p99 |
|---|---|---|---|
| `GET /sitemap.xml` (cached gzip) | 5 ms | 15 ms | 50 ms |
| `GET /sitemap-products-1.xml.gz` (S3 stream) | 30 ms | 100 ms | 300 ms |
| `GET /robots.txt` | 3 ms | 10 ms | 30 ms |
| Storefront page JSON-LD render | +1 ms over base | +3 ms | +8 ms |
| Redirect lookup | 5 ms | 15 ms | 40 ms |
| `POST /storefront/newsletter/subscribe` | 50 ms | 150 ms | 400 ms |
| Send 1000-recipient campaign queue | 5 s | 20 s | 60 s |
| `JOB-AUTOMATION-RUN-TICK` (1000 runs) | 2 s | 10 s | 30 s |
| `JOB-GENERATE-SITEMAP-FULL` (10k products) | 30 s | 120 s | 300 s |
| `JOB-GENERATE-SOCIAL-PRODUCT-FEED` (10k products) | 20 s | 60 s | 180 s |

### 15.2 Optimization

- **Sitemap cached** in S3 + CDN (long TTL, purged on regeneration)
- **JSON-LD pre-computed** per entity, stored in seo_metadata cache field (Fáze 2 — MVP renders inline)
- **Redirect lookup cached** Redis (5 min TTL, invalidated on change)
- **Email sends partitioned** monthly (huge volume)
- **Automation runs partitioned** monthly
- **DataLoader v GraphQL** pro batched email_sends per campaign
- **Connection pool** to email provider
- **Bulk insert** email_sends in batches of 1000
- **Webhook acknowledge fast** (200 OK before processing)

### 15.3 Scaling

- Email send volume: 1M emails/day per tenant on properly sized provider — manageable
- Webhook ingestion 1000/sec
- Sitemap generation 1M URLs in ~5 min (paginated)
- Automation runs concurrent: limited by next_action_at scheduling

---

## 16. Security & compliance

### 16.1 Permissions

```
PERM-SEO-VIEW
PERM-SEO-MANAGE
PERM-MARKETING-VIEW
PERM-MARKETING-CAMPAIGN-CREATE
PERM-MARKETING-CAMPAIGN-EDIT
PERM-MARKETING-CAMPAIGN-SEND
PERM-MARKETING-CAMPAIGN-APPROVE
PERM-MARKETING-AUTOMATION-MANAGE
PERM-MARKETING-SEGMENT-MANAGE
PERM-MARKETING-SEGMENT-EXPORT
PERM-MARKETING-FEED-MANAGE
PERM-MARKETING-SUPPRESS
PERM-REVIEW-MODERATE
PERM-REVIEW-REPLY
```

### 16.2 Marketing consent enforcement

Per RULE-MAR-001 — strict gate at send time. No bypass even for admin.

### 16.3 GDPR

- Email sends retention 1-2 years; anonymize on customer GDPR delete (per RULE-MAR-030)
- Unsubscribe always immediate (RULE-MAR-004)
- Newsletter double opt-in (RULE-MAR-003)
- Open tracking opt-out (RULE-MAR-008)
- Cookie consents respected for tracking pixels

### 16.4 Anti-abuse

- Newsletter signup rate-limited per IP + per email
- Review submission rate-limited per customer
- Sitemap public rate-limited per IP (RULE-MAR-031)
- Webhook signature verification mandatory

### 16.5 Audit

- 100% audit on: campaign send, automation flow activation, review moderation, suppression list changes, sender domain changes
- Sample 1% on reads

### 16.6 Rate limits

| Endpoint | Anon | Auth |
|---|---|---|
| `POST /storefront/newsletter/subscribe` | 3/hour per IP, 1/hour per email | n/a |
| `POST /storefront/reviews` | 1/hour per customer | n/a |
| `POST /email-campaigns/{id}:send-now` | n/a | 10/hour |
| `POST /email-campaigns/{id}:send-test` | n/a | 30/hour |
| `GET /sitemap.xml` | 1000/min per IP | 1000/min |
| `POST /webhooks/email/{provider}` | 600/min per tenant | 6000/min |

---

## 17. Testing

### 17.1 Unit

```
TEST-UNIT-MAR-001  SeoMetadataResolver — fallback chain
TEST-UNIT-MAR-002  SitemapBuilder — chunk pagination
TEST-UNIT-MAR-003  RobotsTxtGenerator
TEST-UNIT-MAR-004  LlmsTxtGenerator
TEST-UNIT-MAR-005  JsonLdProductBuilder
TEST-UNIT-MAR-006  RedirectMatcher — exact, prefix, regex
TEST-UNIT-MAR-007  RedirectLoopDetector
TEST-UNIT-MAR-008  EmailTemplateRenderer (MJML → HTML, variables)
TEST-UNIT-MAR-009  RecipientFilter (suppression + consent)
TEST-UNIT-MAR-010  AutomationStepExecutor (each kind)
TEST-UNIT-MAR-011  AutomationExitConditionEvaluator
TEST-UNIT-MAR-012  BounceClassifier (hard vs soft)
TEST-UNIT-MAR-013  AttributionLinker (UTM → order)
TEST-UNIT-MAR-014  ProductFeedBuilder per platform
TEST-UNIT-MAR-015  ReviewSpamDetector (Fáze 2 AI)
```

### 17.2 Integration

```
TEST-INT-MAR-001   Sitemap regeneration after product publish
TEST-INT-MAR-002   Robots.txt + llms.txt served correctly
TEST-INT-MAR-003   JSON-LD validates against schema.org
TEST-INT-MAR-004   Redirect exact match served
TEST-INT-MAR-005   Redirect loop detected
TEST-INT-MAR-006   Email campaign send to 100 recipients
TEST-INT-MAR-007   Campaign suppresses non-consenting recipients
TEST-INT-MAR-008   Bounce webhook updates email_sends
TEST-INT-MAR-009   Hard bounce adds to suppression list
TEST-INT-MAR-010   Spam complaint → consent revoked
TEST-INT-MAR-011   Unsubscribe URL revokes consent immediate
TEST-INT-MAR-012   Open / click webhooks update metrics
TEST-INT-MAR-013   Automation: cart abandoned → email sent after 1h
TEST-INT-MAR-014   Automation exits when cart_recovered
TEST-INT-MAR-015   Automation respects cooldown
TEST-INT-MAR-016   Newsletter double opt-in flow
TEST-INT-MAR-017   Review submission + auto-verified-purchase
TEST-INT-MAR-018   Review moderation approves + aggregate rating updated
TEST-INT-MAR-019   Wishlist add/remove + share
TEST-INT-MAR-020   Back in stock notification fires
TEST-INT-MAR-021   Heuréka product feed generated correctly
TEST-INT-MAR-022   Google Shopping feed includes correct fields
TEST-INT-MAR-023   Campaign metrics aggregated correctly
TEST-INT-MAR-024   Attribution links order to email_send
TEST-INT-MAR-025   GDPR delete anonymizes email_sends rows
TEST-INT-MAR-026   High bounce rate auto-pauses campaign
TEST-INT-MAR-027   Concurrent automation tick (advisory lock)
```

### 17.3 E2E

```
TEST-E2E-MAR-001  Customer subscribes newsletter, confirms, receives campaign
TEST-E2E-MAR-002  Customer abandons cart → receives recovery email → clicks → recovers
TEST-E2E-MAR-003  Customer places order → confirmation + post-purchase flow
TEST-E2E-MAR-004  Customer leaves review → admin approves → public on PDP
TEST-E2E-MAR-005  Customer adds to wishlist, shares, friend views
TEST-E2E-MAR-006  Search engine crawls sitemap, fetches product, parses JSON-LD
TEST-E2E-MAR-007  Admin creates A/B test campaign (Fáze 2+)
```

### 17.4 Load

```
TEST-LOAD-MAR-001  Sitemap serve 10k RPS (CDN-cached) → p95 < 30 ms
TEST-LOAD-MAR-002  Send 100k-recipient campaign in < 1 hour
TEST-LOAD-MAR-003  Automation engine handles 10k concurrent runs
TEST-LOAD-MAR-004  Email webhook ingestion 1000/sec → process within 5 min
```

---

## 18. Implementation checklist

### Backend
- [ ] **[S]** Drizzle schema `packages/db/src/schema/marketing/*.ts`
- [ ] **[S]** Migrace `20260602_001_create_marketing_tables.sql` (partitions for email_sends + automation_runs + clicks)
- [ ] **[L]** `SeoService` — metadata + JSON-LD builders
- [ ] **[L]** `SitemapService` — generation + caching + chunking
- [ ] **[M]** `RobotsTxtService`, `LlmsTxtService`
- [ ] **[M]** `RedirectService` — matching + loop detection
- [ ] **[L]** `EmailProvider` interface + Resend + SES + SMTP implementations
- [ ] **[L]** `EmailTemplateService` — MJML compile + variable substitution
- [ ] **[L]** `EmailCampaignService` — full lifecycle
- [ ] **[L]** `EmailSendOrchestrator` — recipient resolution + throttling + dispatch
- [ ] **[L]** `WebhookProcessor` — provider event normalization
- [ ] **[L]** `AutomationEngine` — flow execution + tick scheduler + exit conditions
- [ ] **[M]** `AutomationStepExecutor` per step kind
- [ ] **[M]** `NewsletterService` — double opt-in
- [ ] **[M]** `ReviewService` — submission, moderation, aggregate rating
- [ ] **[S]** `WishlistService`
- [ ] **[S]** `BackInStockService`
- [ ] **[M]** `SocialProductFeedService` — per platform builders
- [ ] **[M]** `SuppressionListService`
- [ ] **[M]** `AttributionLinker` — UTM → order
- [ ] **[M]** REST endpoints per §9
- [ ] **[M]** GraphQL types + resolvers
- [ ] **[S]** tRPC router (admin)
- [ ] **[S]** MCP tools (read-only feeds)

### Background jobs
- [ ] **[M]** JOB-GENERATE-SITEMAP-FULL
- [ ] **[S]** JOB-MARK-SITEMAP-STALE, JOB-PING-SEARCH-ENGINES, JOB-VALIDATE-HREFLANG
- [ ] **[L]** JOB-SEND-EMAIL (with provider routing + retries)
- [ ] **[M]** JOB-PROCESS-EMAIL-WEBHOOK-EVENT
- [ ] **[L]** JOB-SEND-EMAIL-CAMPAIGN
- [ ] **[M]** JOB-ABORT-CAMPAIGN-ON-HIGH-BOUNCE, JOB-ABORT-CAMPAIGN-ON-COMPLAINT
- [ ] **[M]** JOB-PROCESS-EMAIL-ATTRIBUTION
- [ ] **[L]** JOB-AUTOMATION-RUN-TICK
- [ ] **[M]** JOB-AUTOMATION-START-RUN, JOB-AUTOMATION-EXIT-RUN-ON-EVENT
- [ ] **[S]** JOB-CONFIRM-NEWSLETTER-EXPIRY
- [ ] **[S]** JOB-AUTO-MODERATE-REVIEWS (Fáze 2 AI)
- [ ] **[S]** JOB-REQUEST-REVIEW-AFTER-DELIVERY
- [ ] **[S]** JOB-NOTIFY-BACK-IN-STOCK
- [ ] **[S]** JOB-CLEANUP-EXPIRED-BACK-IN-STOCK
- [ ] **[M]** JOB-GENERATE-SOCIAL-PRODUCT-FEED per platform
- [ ] **[M]** JOB-AGGREGATE-CAMPAIGN-METRICS
- [ ] **[S]** JOB-DETECT-DELIVERABILITY-ISSUES
- [ ] **[S]** JOB-RECOMPUTE-PRODUCT-AGGREGATE-RATING
- [ ] **[S]** JOB-PURGE-OLD-EMAIL-SENDS
- [ ] **[S]** JOB-DETECT-INACTIVE-CUSTOMERS, JOB-BIRTHDAY-FLOW-TRIGGER

### Frontend — Admin
- [ ] **[M]** SEO management per entity (in product, category, page editors)
- [ ] **[M]** Redirects management list + editor
- [ ] **[M]** Sitemap status dashboard
- [ ] **[L]** Email campaign list + builder (MJML editor)
- [ ] **[M]** Email template editor + preview + test send
- [ ] **[L]** Visual automation flow builder
- [ ] **[M]** Automation run inspector (per customer)
- [ ] **[M]** Newsletter subscriptions list + bulk operations
- [ ] **[M]** Review moderation queue
- [ ] **[M]** Review detail + reply UI
- [ ] **[S]** Suppression list management
- [ ] **[M]** Social product feeds management
- [ ] **[L]** Marketing analytics dashboards (email performance, automation ROI, deliverability)
- [ ] **[S]** Sender domain setup wizard (SPF/DKIM/DMARC)

### Frontend — Storefront
- [ ] **[M]** Newsletter signup form (footer, popup, exit-intent)
- [ ] **[S]** Newsletter confirmation landing page
- [ ] **[L]** Product reviews section on PDP (display + write)
- [ ] **[M]** Review submission form
- [ ] **[S]** Helpful vote button
- [ ] **[M]** Wishlist UI (PDP add button, /account/wishlist page, share modal)
- [ ] **[S]** Back-in-stock subscribe button on OOS variants
- [ ] **[S]** Unsubscribe landing pages
- [ ] **[S]** Email preferences page (link from unsubscribe + /account/preferences)
- [ ] **[S]** JSON-LD inline (server-rendered per page)
- [ ] **[S]** OG meta tags
- [ ] **[S]** Canonical URL link
- [ ] **[S]** Hreflang alternates

### Tests
- [ ] **[M]** Per §17

### Docs
- [ ] **[M]** "SEO best practices" merchant guide
- [ ] **[M]** "Email marketing setup" merchant guide
- [ ] **[M]** "Building automation flows" merchant guide
- [ ] **[S]** "Configuring product feeds (Heuréka, Google Shopping, Meta)" guide
- [ ] **[S]** "Review moderation" admin guide
- [ ] **[S]** "Deliverability best practices" guide
- [ ] **[S]** Customer-facing: "Managing email preferences"
- [ ] **[S]** Developer: marketing event hooks for plugins
- [ ] **[S]** Developer: email template authoring (MJML + variables)

---

## 19. Open questions

### Q-MAR-001: Email provider default
**Otázka:** Resend (modern, EU-friendly) vs AWS SES (cheap at scale) vs SendGrid as default?

**Status:** Resend pro Free/Starter (modern API, free tier); SES pro Pro+ (cost). SendGrid plugin marketplace.

### Q-MAR-002: SMS marketing
**Otázka:** SMS provider abstraction (Twilio, SMSCloud) for marketing campaigns?

**Status:** v1.0+ feature. SMS consent already in `customer_consents` (purpose='marketing_sms'). Infrastructure plugin.

### Q-MAR-003: Web push notifications
**Otázka:** PushAPI for browser push (re-engagement)?

**Status:** v1.0+ feature. Requires service worker setup, subscription management.

### Q-MAR-004: Email AB testing
**Otázka:** Full A/B framework with statistical significance?

**Status:** Fáze 2+ feature. Schema-ready (ab_test_* fields in campaigns).

### Q-MAR-005: AI-generated subject lines
**Otázka:** Anthropic Claude generates subject options based on email content?

**Status:** Fáze 2+ feature. Detail v `33-ai-features.md`.

### Q-MAR-006: Send-time optimization
**Otázka:** ML-based best send time per recipient (based on past open patterns)?

**Status:** Fáze 3+ feature.

### Q-MAR-007: Behavioral segmentation
**Otázka:** RFM segmentation, churn risk prediction?

**Status:** v1.0+ analytical feature in `20-analytics-reporting.md`.

### Q-MAR-008: Image asset optimization in emails
**Otázka:** Auto-optimize embedded images (WebP, retina variants)?

**Status:** v1.0+ feature.

### Q-MAR-009: Multi-channel campaign orchestration
**Otázka:** Coordinate email + SMS + push in single campaign?

**Status:** Fáze 2+ — extend campaign model. MVP: email-only campaigns.

### Q-MAR-010: Loyalty / referral program
**Otázka:** Built-in loyalty points + referral codes?

**Status:** Fáze 2+ plugin marketplace. Schema in customer (preferences) + coupons (referral codes per `10`).

### Q-MAR-011: Survey / NPS
**Otázka:** Post-delivery NPS survey, feedback collection?

**Status:** Fáze 2+ plugin.

### Q-MAR-012: AI moderator for reviews
**Otázka:** Auto-approve clean reviews, flag suspicious?

**Status:** Fáze 2+ feature in `33-ai-features.md`. AI sentiment + spam scoring.

### Q-MAR-013: Review syndication (Yotpo, Trustpilot)
**Otázka:** Push reviews to external trust platforms?

**Status:** Fáze 2+ plugin marketplace integrations.

### Q-MAR-014: Embed reviews via JSON-LD AggregateRating
**Otázka:** Already in MVP. Pre-emptive check that Google parses correctly via test tool.

**Status:** Implementation includes Google Rich Results Test validation in CI.

### Q-MAR-015: Multi-language sitemap
**Otázka:** Separate sitemap per locale or combined?

**Status:** Separate per locale for clarity + Google's preferred approach. Sitemap index aggregates.

### Q-MAR-016: Image sitemap separate
**Otázka:** Dedicated sitemap-images.xml or inline image:image tags in product sitemap?

**Status:** Inline (Google's preferred approach for product imagery).

### Q-MAR-017: PWA + app push?
**Otázka:** Mobile app push notifications (Fáze 4 mobile app)?

**Status:** Fáze 4. FCM/APNs setup. Schema extension.

### Q-MAR-018: Custom email domains per channel
**Otázka:** B2B vs B2C separate sender domains?

**Status:** Configurable. Detail v `22-multistore-channels.md`.

### Q-MAR-019: Webhook for external CRM
**Otázka:** Real-time sync to HubSpot, Salesforce, ActiveCampaign?

**Status:** v1.0+ via plugin marketplace (`29-integrations.md`).

### Q-MAR-020: Compliance with CAN-SPAM, CASL
**Otázka:** US + Canada compliance specifics?

**Status:** US/Canada expansion Fáze 3+. CAN-SPAM unsubscribe within 10 days; CASL explicit opt-in. Schema-ready.

---

## 📅 Změny

| Datum | Změna |
|---|---|
| 2026-05-20 | Initial — Marketing & SEO domain. SEO (sitemaps, JSON-LD, robots/llms.txt, redirects, hreflang), email marketing (templates, campaigns, automations), reviews, wishlist, back-in-stock, social product feeds, GDPR-strict consent enforcement. |

---

**Konec Marketing & SEO.**

➡️ Pokračovat na: [`20-analytics-reporting.md`](20-analytics-reporting.md)
