# 24 – SUBSCRIPTIONS

> **Doména:** Subscription commerce. Recurring billing cycles (weekly/monthly/quarterly/yearly/custom), MIT (Merchant-Initiated Transactions) using saved payment methods (cross-ref `13`), trial periods, pause/resume/skip, dunning for failed payments, EU consumer rights (14-day cooling-off), customer self-service, subscription analytics (MRR/ARR/churn).
>
> **Status:** v2.0+ activation. MVP: schema-ready (`03 §13` ENT-SUBSCRIPTION-001), service stubs.

**Datum:** 2026-05-20
**Verze:** 1.0
**Status:** 🟡 DESIGN (Fáze 2/v2.0 activation)
**Reference:** [03 §13](03-data-models-master.md#13-subscriptions) · [10-pricing-promotions.md](10-pricing-promotions.md) · [13-payments.md](13-payments.md) · [15-tax-compliance.md](15-tax-compliance.md) · [16-order-management.md](16-order-management.md)

---

## 📑 Obsah

0. [Domain overview](#0-domain-overview)
1. [References](#1-references)
2. [Personas](#2-personas)
3. [Data models](#3-data-models)
4. [Billing cycle engine](#4-billing-cycle-engine)
5. [MIT (Merchant-Initiated Transactions)](#5-mit-merchant-initiated-transactions)
6. [Dunning workflow](#6-dunning-workflow)
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

- **Subscription products** — products marked as subscribable; customer selects frequency at checkout
- **Billing cycles** — `weekly`, `monthly`, `quarterly`, `semi_annual`, `yearly`, `custom_days`
- **Subscription lifecycle** — `trial → active → paused → past_due → cancelled / expired`
- **Recurring billing** — MIT charges against saved payment method (cross-ref `13`)
- **Trial periods** — free or discounted trial before first billing
- **Customer self-service** — manage frequency, skip, pause, resume, cancel (subject to plan rules)
- **Subscription items** — line items per cycle (can vary across cycles for "build-your-box" model)
- **Replenishment** — same items each cycle (B2B common, "monthly office supplies")
- **Add-ons** — additional items billed alongside main subscription
- **Quantity changes** — mid-cycle modification (prorated billing)
- **Pause windows** — customer holds subscription temporarily (vacation, holidays)
- **Skip cycle** — one-time skip of next delivery + billing
- **Subscription pricing** — locked at signup vs current market rate (per merchant policy)
- **Proration** — partial-cycle billing on changes
- **Dunning** — failed payment retry workflow (smart retries + customer outreach)
- **EU compliance** — 14-day cooling-off, automatic renewal disclosure, easy cancellation
- **MRR/ARR analytics** — Monthly Recurring Revenue, Annual Recurring Revenue, churn rate, LTV
- **Shipment scheduling** — auto-create shipments synced with billing cycle
- **Subscription orders** — each cycle creates new `orders` row with `source='recurring'`, `parent_order_id` linking
- **Cancellation reasons** — captured for churn analysis

### 0.2 Co tato doména **NENÍ**

- ❌ Payment provider integrations internals (→ `13-payments.md`)
- ❌ Order lifecycle internals (→ `16-order-management.md`)
- ❌ Shipping mechanics (→ `14-shipping.md`)
- ❌ Tax engine (→ `15-tax-compliance.md`)
- ❌ Refund mechanics (→ `13-payments.md`)
- ❌ Loyalty programs / points (→ Fáze 2+ plugin)
- ❌ Email automation (→ `19-marketing-seo.md`)
- ❌ Customer profile management (→ `18-customer-management.md`)
- ❌ Marketplace seller subscriptions (→ `25-marketplace.md`)
- ❌ Platform SaaS billing (i.e., Shopio billing merchants — separate billing for OUR product, NOT customer subscriptions in their shop)

### 0.3 Diferenciátory

1. **Customer self-service first-class** — EU customer rights respected, easy cancel via storefront (no support ticket)
2. **Build-your-box model** — items per cycle can vary, customer customizes each delivery
3. **Smart retry dunning** — payment retry schedule learned from past success patterns (Fáze 3+ AI)
4. **MIT compliance** — proper SCA exemption handling for EU recurring payments
5. **0% transaction fee** ([DEC-BIZ-001](01-decisions-registry.md#dec-biz-001-pricing-model)) — same principle as one-time payments
6. **Replenishment B2B native** — schema supports B2B procurement subscriptions (cross-ref `21-b2b-complete.md`)
7. **Cooling-off automatic** — first cycle within 14 days fully refundable per EU directive

---

## 1. References

- [03 §13](03-data-models-master.md#13-subscriptions) — ENT-SUBSCRIPTION-001, ENT-SUBSCRIPTION-ITEM-001
- [13-payments.md](13-payments.md) — saved payment methods, MIT, dunning shares infrastructure
- [10-pricing-promotions.md](10-pricing-promotions.md) — subscription pricing
- [15-tax-compliance.md](15-tax-compliance.md) — recurring invoice generation
- [16-order-management.md](16-order-management.md) — recurring orders with `parent_order_id`
- [09-inventory.md](09-inventory.md) — subscription stock reservation
- [14-shipping.md](14-shipping.md) — recurring shipments
- [17-returns-refunds.md](17-returns-refunds.md) — subscription returns + cancellation
- [18-customer-management.md](18-customer-management.md) — saved payment methods linkage
- [19-marketing-seo.md](19-marketing-seo.md) — subscription-related emails (renewal reminders, dunning, churn)
- [21-b2b-complete.md](21-b2b-complete.md) — B2B replenishment subscriptions
- [20-analytics-reporting.md](20-analytics-reporting.md) — MRR/ARR analytics
- [DEC-BIZ-001](01-decisions-registry.md#dec-biz-001-pricing-model) — pricing principles
- EU Consumer Rights Directive 2011/83/EU (14-day right of withdrawal)
- EU Better Enforcement Directive 2019/2161 (automatic renewal disclosure)
- PSD2 SCA exemptions for MIT
- ISO 8601 recurrence rule (RRULE) for complex schedules

---

## 2. Personas

| Persona | Použití | Klíčové permissions |
|---|---|---|
| `PERSONA-MERCHANT-OWNER` | Configure subscription products, dunning policy, plans | `PERM-SUBSCRIPTION-*` |
| `PERSONA-CATALOG-MANAGER` | Mark products subscribable, configure frequencies | `PERM-PRODUCT-UPDATE`, `PERM-SUBSCRIPTION-CONFIG` |
| `PERSONA-FINANCE-MANAGER` | View MRR/ARR, churn, manage dunning | `PERM-SUBSCRIPTION-VIEW`, `PERM-SUBSCRIPTION-ANALYTICS` |
| `PERSONA-CUSTOMER-SERVICE` | Help customer modify, pause, refund, cancel | `PERM-SUBSCRIPTION-MANAGE-FOR-CUSTOMER` |
| `PERSONA-CUSTOMER` | Self-service subscription management | Auth-gated to own customer_id |
| `PERSONA-AI-COPILOT` | Churn risk prediction, smart retry timing | `agent:subscription:read` |
| `PERSONA-EXTERNAL-AGENT` | Subscription on customer's behalf (per scope) | `agent:subscription:write` (limited) |
| `PERSONA-COMPLIANCE-OFFICER` | Audit subscriptions for EU compliance | `PERM-SUBSCRIPTION-AUDIT` |

---

## 3. Data models

### 3.1 `subscriptions` ([ENT-SUBSCRIPTION-001](03-data-models-master.md#ent-subscription-001))

```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  pub_id TEXT NOT NULL,                                                                              -- sub_ NanoID
  number TEXT NOT NULL,                                                                              -- "SUB-2026-00000123"
  customer_id UUID NOT NULL REFERENCES customers(id),
  company_id UUID NULL REFERENCES companies(id),                                                      -- B2B context
  parent_order_id UUID NOT NULL REFERENCES orders(id),                                                -- order that initiated subscription
  -- status
  status TEXT NOT NULL CHECK (status IN (
    'trial',                  -- in free trial period
    'active',                 -- regular billing
    'paused',                 -- temporarily on hold
    'past_due',               -- payment failed; dunning in progress
    'pending_cancellation',   -- cancellation scheduled at period end
    'cancelled',              -- terminated
    'expired',                -- ended naturally (e.g., fixed-term contract end)
    'failed'                  -- creation failed
  )) DEFAULT 'active',
  status_entered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- billing cycle
  billing_cycle_kind TEXT NOT NULL CHECK (billing_cycle_kind IN ('weekly','biweekly','monthly','quarterly','semi_annual','yearly','custom_days')) DEFAULT 'monthly',
  billing_interval_count INTEGER NOT NULL DEFAULT 1,                                                  -- e.g., 1 month vs 3 months for quarterly
  custom_interval_days INTEGER NULL,                                                                  -- pro custom_days
  billing_anchor_day INTEGER NULL,                                                                    -- 1-31 for monthly+; -1 = end of month
  billing_anchor_weekday INTEGER NULL,                                                                 -- 0-6 (Sunday-Saturday) for weekly+
  billing_anchor_timezone TEXT NULL,                                                                   -- defaults to tenant
  -- trial
  trial_end_at TIMESTAMPTZ NULL,                                                                       -- NULL = no trial
  trial_is_free BOOLEAN NOT NULL DEFAULT true,
  trial_charge_amount BIGINT NULL,                                                                     -- e.g., 1 CZK token charge
  -- pricing
  currency CHAR(3) NOT NULL,
  pricing_strategy TEXT NOT NULL CHECK (pricing_strategy IN ('locked_at_signup','current_market_rate','custom_per_cycle')) DEFAULT 'locked_at_signup',
  recurring_subtotal_amount BIGINT NOT NULL,                                                            -- snapshot at signup
  recurring_discount_amount BIGINT NOT NULL DEFAULT 0,
  recurring_shipping_amount BIGINT NOT NULL DEFAULT 0,
  recurring_tax_amount BIGINT NOT NULL DEFAULT 0,
  recurring_total_amount BIGINT NOT NULL,
  -- dates
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  next_billing_at TIMESTAMPTZ NULL,                                                                     -- when next charge fires
  next_shipment_at TIMESTAMPTZ NULL,
  paused_at TIMESTAMPTZ NULL,
  paused_until TIMESTAMPTZ NULL,                                                                        -- auto-resume date
  pause_reason TEXT NULL,
  resume_scheduled_at TIMESTAMPTZ NULL,
  cancelled_at TIMESTAMPTZ NULL,
  cancellation_effective_at TIMESTAMPTZ NULL,                                                            -- end-of-period vs immediate
  cancellation_reason TEXT NULL,
  cancellation_reason_code TEXT NULL CHECK (cancellation_reason_code IN (
    'customer_request','price_too_high','no_longer_needed','quality_issue','better_alternative',
    'temporary_break','technical_issue','payment_failure','merchant_decision','expired_card',
    'fraud','duplicate','manual_other'
  ) OR cancellation_reason_code IS NULL),
  expired_at TIMESTAMPTZ NULL,
  -- contract terms
  minimum_billing_cycles INTEGER NULL,                                                                    -- e.g., must complete 6 cycles
  total_billing_cycles INTEGER NULL,                                                                       -- finite-term contracts (e.g., 12 cycles)
  completed_billing_cycles INTEGER NOT NULL DEFAULT 0,
  -- payment method
  payment_method_id UUID NULL REFERENCES saved_payment_methods(id),
  payment_method_kind TEXT NULL,
  payment_method_provider_code TEXT NULL,
  payment_method_last4 TEXT NULL,                                                                          -- snapshot for display
  payment_method_brand TEXT NULL,
  -- shipping
  shipping_address_id UUID NULL REFERENCES addresses(id),
  shipping_address_snapshot JSONB NULL,                                                                    -- immutable
  shipping_method_id UUID NULL,
  preferred_delivery_window TEXT NULL,
  -- billing address
  billing_address_id UUID NULL REFERENCES addresses(id),
  billing_address_snapshot JSONB NULL,
  -- locale
  locale TEXT NOT NULL,
  -- discount + coupon (applied per-cycle)
  recurring_coupon_codes TEXT[] NULL,
  applied_coupon_first_cycle_only TEXT[] NULL,                                                              -- coupons used only on first cycle
  -- skips
  skip_next_cycle BOOLEAN NOT NULL DEFAULT false,                                                          -- toggle for one-time skip
  skipped_cycles_count INTEGER NOT NULL DEFAULT 0,
  -- failed attempts
  failed_payment_attempts_count INTEGER NOT NULL DEFAULT 0,
  last_payment_failure_at TIMESTAMPTZ NULL,
  last_payment_failure_reason TEXT NULL,
  -- dunning
  dunning_started_at TIMESTAMPTZ NULL,
  dunning_stage INTEGER NOT NULL DEFAULT 0,
  -- analytics
  total_revenue_amount BIGINT NOT NULL DEFAULT 0,                                                            -- lifetime sum of charges
  total_revenue_currency CHAR(3) NULL,
  -- customer prefs
  send_renewal_reminder_emails BOOLEAN NOT NULL DEFAULT true,                                                -- legal disclosure required for EU
  upcoming_charge_notification_days_before INTEGER NOT NULL DEFAULT 3,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_actor_kind TEXT NOT NULL,
  created_by_actor_id UUID NULL,
  version INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_subscriptions_pub_id UNIQUE (tenant_id, pub_id),
  CONSTRAINT uq_subscriptions_number UNIQUE (tenant_id, number)
);

CREATE INDEX idx_subscriptions_customer ON subscriptions (customer_id, status, started_at DESC);
CREATE INDEX idx_subscriptions_status ON subscriptions (tenant_id, status, status_entered_at DESC);
CREATE INDEX idx_subscriptions_next_billing ON subscriptions (next_billing_at) WHERE status IN ('active','trial') AND skip_next_cycle = false;
CREATE INDEX idx_subscriptions_next_shipment ON subscriptions (next_shipment_at) WHERE status IN ('active') AND skip_next_cycle = false;
CREATE INDEX idx_subscriptions_past_due ON subscriptions (tenant_id, dunning_started_at DESC) WHERE status = 'past_due';
CREATE INDEX idx_subscriptions_pending_cancellation ON subscriptions (cancellation_effective_at) WHERE status = 'pending_cancellation';
CREATE INDEX idx_subscriptions_company ON subscriptions (company_id) WHERE company_id IS NOT NULL;
```

### 3.2 `subscription_items` ([ENT-SUBSCRIPTION-ITEM-001](03-data-models-master.md#ent-subscription-item-001))

Items shipped per cycle.

```sql
CREATE TABLE subscription_items (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES product_variants(id),
  product_id UUID NOT NULL REFERENCES products(id),                                                          -- denormalized
  -- snapshot at subscription creation
  sku TEXT NOT NULL,
  title TEXT NOT NULL,
  variant_title TEXT NULL,
  primary_image_url TEXT NULL,
  -- per-cycle quantity + price
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_amount BIGINT NOT NULL,
  unit_price_currency CHAR(3) NOT NULL,
  line_subtotal_amount BIGINT NOT NULL,
  tax_class_code TEXT NULL,
  tax_rate_basis_points INTEGER NOT NULL DEFAULT 0,
  -- customization
  customization JSONB NULL,                                                                                    -- preferences (color, flavor) per cycle
  is_add_on BOOLEAN NOT NULL DEFAULT false,                                                                     -- vs core item
  position INTEGER NOT NULL DEFAULT 0,
  -- frequency override (Fáze 3+ per-item frequencies)
  item_billing_cycle_kind TEXT NULL,                                                                            -- NULL = inherit from subscription
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_subscription_items_subscription ON subscription_items (subscription_id, position);
CREATE INDEX idx_subscription_items_variant ON subscription_items (variant_id);
```

### 3.3 `subscription_billing_cycles`

Per-cycle history (each billing attempt).

```sql
CREATE TABLE subscription_billing_cycles (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  cycle_number INTEGER NOT NULL,                                                                                -- 1, 2, 3, ...
  cycle_period_start TIMESTAMPTZ NOT NULL,
  cycle_period_end TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'scheduled',              -- upcoming
    'processing',             -- charging now
    'paid',                   -- successfully billed
    'failed',                 -- payment failure
    'skipped',                -- one-time skip
    'paused',                 -- subscription paused; cycle deferred
    'refunded'                -- charged then refunded
  )) DEFAULT 'scheduled',
  scheduled_billing_at TIMESTAMPTZ NOT NULL,
  attempted_billing_at TIMESTAMPTZ NULL,
  completed_billing_at TIMESTAMPTZ NULL,
  -- amounts
  currency CHAR(3) NOT NULL,
  subtotal_amount BIGINT NOT NULL,
  discount_amount BIGINT NOT NULL DEFAULT 0,
  shipping_amount BIGINT NOT NULL DEFAULT 0,
  tax_amount BIGINT NOT NULL DEFAULT 0,
  total_amount BIGINT NOT NULL,
  -- linked records
  order_id UUID NULL REFERENCES orders(id),                                                                       -- order created for this cycle
  payment_id UUID NULL REFERENCES payments(id),                                                                    -- charge attempt
  invoice_id UUID NULL REFERENCES invoices(id),                                                                     -- invoice issued
  refund_id UUID NULL REFERENCES refunds(id),
  -- failures
  failure_attempts INTEGER NOT NULL DEFAULT 0,
  last_failure_code TEXT NULL,
  last_failure_message TEXT NULL,
  last_failure_at TIMESTAMPTZ NULL,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_subscription_billing_cycles UNIQUE (subscription_id, cycle_number)
) PARTITION BY RANGE (scheduled_billing_at);

CREATE INDEX idx_subscription_billing_cycles_subscription ON subscription_billing_cycles (subscription_id, cycle_number);
CREATE INDEX idx_subscription_billing_cycles_status ON subscription_billing_cycles (tenant_id, status, scheduled_billing_at);
CREATE INDEX idx_subscription_billing_cycles_scheduled ON subscription_billing_cycles (scheduled_billing_at) WHERE status = 'scheduled';
CREATE INDEX brin_subscription_billing_cycles_scheduled ON subscription_billing_cycles USING BRIN (scheduled_billing_at);
```

### 3.4 `subscription_modifications`

Audit of all subscription changes (paused, resumed, items modified, frequency changed, ...).

```sql
CREATE TABLE subscription_modifications (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  modification_kind TEXT NOT NULL CHECK (modification_kind IN (
    'created','activated','paused','resumed','skipped',
    'items_changed','frequency_changed','quantity_changed','price_changed',
    'address_changed','payment_method_changed','coupon_applied','coupon_removed',
    'cancelled','reactivated','trial_extended','trial_ended','expired',
    'manual_override','admin_adjustment','add_on_added','add_on_removed'
  )),
  actor_kind TEXT NOT NULL,
  actor_id UUID NULL,
  reason TEXT NULL,
  before_state JSONB NULL,                                                                                       -- relevant snapshot
  after_state JSONB NULL,
  effective_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_subscription_modifications_subscription ON subscription_modifications (subscription_id, occurred_at DESC);
```

### 3.5 `subscription_plans`

Predefined subscription templates (e.g., "Monthly coffee box — 250g", "Weekly produce subscription"). Merchant creates plans; customer subscribes to a plan.

```sql
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  pub_id TEXT NOT NULL,                                                                                          -- plan_ NanoID
  name TEXT NOT NULL,
  description TEXT NULL,
  -- billing
  billing_cycle_kind TEXT NOT NULL CHECK (billing_cycle_kind IN ('weekly','biweekly','monthly','quarterly','semi_annual','yearly','custom_days')),
  billing_interval_count INTEGER NOT NULL DEFAULT 1,
  custom_interval_days INTEGER NULL,
  -- pricing
  currency CHAR(3) NOT NULL,
  recurring_amount BIGINT NOT NULL,
  setup_fee_amount BIGINT NULL,                                                                                   -- one-time setup
  setup_fee_currency CHAR(3) NULL,
  -- trial
  trial_period_days INTEGER NULL,
  trial_is_free BOOLEAN NOT NULL DEFAULT true,
  trial_charge_amount BIGINT NULL,
  -- term limits
  minimum_billing_cycles INTEGER NULL,
  total_billing_cycles INTEGER NULL,
  -- items (predefined recurring items)
  default_items JSONB NOT NULL DEFAULT '[]'::jsonb,                                                                -- [{ variant_id, quantity }]
  allow_item_customization BOOLEAN NOT NULL DEFAULT false,
  available_add_ons JSONB NULL,                                                                                     -- [{ variant_id, max_quantity }]
  -- discount
  recurring_discount_percent_basis_points INTEGER NULL,                                                              -- e.g., 1000 = 10% subscription discount
  -- visibility
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_listed_in_storefront BOOLEAN NOT NULL DEFAULT true,
  visibility_channel_ids UUID[] NULL,
  -- metadata
  display_image_media_id UUID NULL REFERENCES media(id),
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user_id UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_subscription_plans_pub_id UNIQUE (tenant_id, pub_id)
);

CREATE INDEX idx_subscription_plans_active ON subscription_plans (tenant_id) WHERE is_active = true;
```

### 3.6 `product_subscription_options`

Per-product configuration for "subscribe & save" model (subscription as alternative purchase option for any product).

```sql
CREATE TABLE product_subscription_options (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  is_subscription_eligible BOOLEAN NOT NULL DEFAULT false,
  available_frequencies TEXT[] NOT NULL DEFAULT '{}',                                                              -- ['weekly','monthly','quarterly']
  default_frequency TEXT NULL,
  subscription_discount_percent_basis_points INTEGER NULL,                                                          -- discount when subscribed
  is_one_time_purchase_allowed BOOLEAN NOT NULL DEFAULT true,
  is_subscription_only BOOLEAN NOT NULL DEFAULT false,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_product_subscription_options UNIQUE (product_id)
);

CREATE INDEX idx_product_subscription_options_eligible ON product_subscription_options (tenant_id) WHERE is_subscription_eligible = true;
```

### 3.7 `dunning_attempts`

Each retry of a failed subscription payment.

```sql
CREATE TABLE dunning_attempts (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  billing_cycle_id UUID NOT NULL REFERENCES subscription_billing_cycles(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL,                                                                                  -- 1, 2, 3, ...
  scheduled_at TIMESTAMPTZ NOT NULL,
  attempted_at TIMESTAMPTZ NULL,
  status TEXT NOT NULL CHECK (status IN ('scheduled','succeeded','failed','cancelled')) DEFAULT 'scheduled',
  payment_id UUID NULL REFERENCES payments(id),
  failure_code TEXT NULL,
  failure_message TEXT NULL,
  notification_sent_at TIMESTAMPTZ NULL,
  notification_kind TEXT NULL CHECK (notification_kind IN ('email_grace','email_retry','email_final','sms_reminder','none') OR notification_kind IS NULL),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_dunning_attempts UNIQUE (billing_cycle_id, attempt_number)
);

CREATE INDEX idx_dunning_attempts_scheduled ON dunning_attempts (scheduled_at) WHERE status = 'scheduled';
CREATE INDEX idx_dunning_attempts_subscription ON dunning_attempts (subscription_id);
```

### 3.8 `subscription_pauses`

Pause windows (each pause = separate row for analytics).

```sql
CREATE TABLE subscription_pauses (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  paused_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paused_until TIMESTAMPTZ NULL,                                                                                    -- auto-resume
  resumed_at TIMESTAMPTZ NULL,
  pause_reason TEXT NULL,
  pause_reason_code TEXT NULL CHECK (pause_reason_code IN ('vacation','holiday','financial','too_much_stock','temporary_break','other') OR pause_reason_code IS NULL),
  initiated_by_actor_kind TEXT NOT NULL,
  initiated_by_actor_id UUID NULL,
  notes TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_subscription_pauses_subscription ON subscription_pauses (subscription_id, paused_at DESC);
CREATE INDEX idx_subscription_pauses_active ON subscription_pauses (subscription_id) WHERE resumed_at IS NULL;
CREATE INDEX idx_subscription_pauses_auto_resume ON subscription_pauses (paused_until) WHERE resumed_at IS NULL AND paused_until IS NOT NULL;
```

### 3.9 `subscription_skips`

One-off skip records.

```sql
CREATE TABLE subscription_skips (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  billing_cycle_number INTEGER NOT NULL,                                                                              -- which cycle was skipped
  skipped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT NULL,
  reason_code TEXT NULL,
  initiated_by_actor_kind TEXT NOT NULL,
  initiated_by_actor_id UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_subscription_skips UNIQUE (subscription_id, billing_cycle_number)
);

CREATE INDEX idx_subscription_skips_subscription ON subscription_skips (subscription_id, skipped_at DESC);
```

### 3.10 `subscription_analytics_snapshots`

Periodic MRR/ARR/churn snapshots (computed daily).

```sql
CREATE TABLE subscription_analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  snapshot_date DATE NOT NULL,
  currency CHAR(3) NOT NULL,                                                                                          -- normalized
  -- counts
  total_active_subscriptions INTEGER NOT NULL,
  total_trial_subscriptions INTEGER NOT NULL,
  total_paused_subscriptions INTEGER NOT NULL,
  total_past_due_subscriptions INTEGER NOT NULL,
  total_pending_cancellation INTEGER NOT NULL,
  total_cancelled_today INTEGER NOT NULL,
  total_new_today INTEGER NOT NULL,
  -- MRR
  mrr_amount BIGINT NOT NULL,                                                                                          -- monthly recurring revenue (normalized)
  arr_amount BIGINT NOT NULL,                                                                                          -- annual recurring revenue (MRR × 12)
  new_mrr_amount BIGINT NOT NULL,                                                                                      -- from new subscriptions today
  churned_mrr_amount BIGINT NOT NULL,                                                                                  -- lost from cancellations today
  expansion_mrr_amount BIGINT NOT NULL DEFAULT 0,                                                                       -- from upgrades / add-ons
  contraction_mrr_amount BIGINT NOT NULL DEFAULT 0,                                                                     -- from downgrades
  net_mrr_change_amount BIGINT NOT NULL,
  -- churn rates (basis points)
  customer_churn_rate_basis_points INTEGER NULL,
  revenue_churn_rate_basis_points INTEGER NULL,
  -- LTV
  avg_subscription_ltv_amount BIGINT NULL,
  avg_subscription_duration_days INTEGER NULL,
  -- audit
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_subscription_analytics_snapshots UNIQUE (tenant_id, snapshot_date, currency)
);

CREATE INDEX idx_subscription_analytics_snapshots_recent ON subscription_analytics_snapshots (tenant_id, snapshot_date DESC);
```

### 3.11 Vztahy

```
tenants (1)──(N) subscriptions
tenants (1)──(N) subscription_plans
tenants (1)──(N) product_subscription_options
customers (1)──(N) subscriptions
companies (0..1)──(N) subscriptions                                                                                    [B2B]
subscriptions (1)──(N) subscription_items
subscriptions (1)──(N) subscription_billing_cycles                                                                      [partitioned]
subscriptions (1)──(N) subscription_modifications                                                                       [audit]
subscriptions (1)──(N) subscription_pauses
subscriptions (1)──(N) subscription_skips
subscription_billing_cycles (1)──(N) dunning_attempts
subscriptions (N)──(0..1) saved_payment_methods                                                                          [from `13`]
subscriptions (1)──(1) orders                                                                                            [parent_order_id]
subscription_billing_cycles (0..1)──(1) orders                                                                            [recurring order]
subscription_billing_cycles (0..1)──(1) invoices                                                                          [recurring invoice]
products (1)──(0..1) product_subscription_options
```

---

## 4. Billing cycle engine

### 4.1 Cycle scheduling

When subscription created:
1. Calculate `current_period_start = started_at`
2. Calculate `current_period_end` = start + cycle_kind interval
3. Insert first `subscription_billing_cycles` row (cycle_number=1, status='scheduled')
4. Set `next_billing_at = start_of_period + (trial_period if any)` OR `current_period_end` for arrears billing
5. Set `next_shipment_at` similarly

### 4.2 Cycle interval calculation

```typescript
function calcCycleEnd(start: Date, kind: string, intervalCount: number, anchorDay?: number, anchorWeekday?: number, customDays?: number): Date {
  switch (kind) {
    case 'weekly': return addDays(start, 7 * intervalCount);
    case 'biweekly': return addDays(start, 14 * intervalCount);
    case 'monthly':
      let end = addMonths(start, 1 * intervalCount);
      if (anchorDay) end = setDayOfMonth(end, anchorDay);
      return end;
    case 'quarterly': return addMonths(start, 3 * intervalCount);
    case 'semi_annual': return addMonths(start, 6 * intervalCount);
    case 'yearly': return addMonths(start, 12 * intervalCount);
    case 'custom_days': return addDays(start, customDays * intervalCount);
  }
}
```

Edge cases:
- Month-end anchor (anchorDay=-1): Feb 28/29, Apr 30, etc.
- Anchor day not in month (e.g., 31st in Feb): use last day of month

### 4.3 Billing job

`JOB-PROCESS-SUBSCRIPTION-BILLING-CYCLES` runs every 5 minutes:

```typescript
async function processBillingCycles() {
  // Find scheduled cycles due now
  const due = await pg.query(sql`
    SELECT * FROM subscription_billing_cycles
    WHERE status = 'scheduled'
      AND scheduled_billing_at <= now()
      AND NOT EXISTS (
        SELECT 1 FROM subscriptions s
        WHERE s.id = subscription_id AND s.status NOT IN ('active','trial','past_due')
      )
    LIMIT 100
    FOR UPDATE SKIP LOCKED
  `);

  for (const cycle of due) {
    await processCycle(cycle);
  }
}

async function processCycle(cycle: BillingCycle) {
  const subscription = await loadSubscription(cycle.subscription_id);
  
  // Check skip
  if (subscription.skip_next_cycle) {
    await markCycleSkipped(cycle);
    await clearSkipFlag(subscription);
    await advanceSubscriptionToNextPeriod(subscription);
    await emitEvent('EVENT-SUBSCRIPTION-CYCLE-SKIPPED');
    return;
  }
  
  // Check pause
  if (subscription.status === 'paused') {
    await deferCycle(cycle, subscription.paused_until);
    return;
  }
  
  // Create order from subscription items
  const order = await createOrderFromSubscription(subscription, cycle);
  
  // MIT charge against saved payment method
  await markCycleProcessing(cycle);
  try {
    const payment = await chargeSubscription(subscription, cycle);
    await markCyclePaid(cycle, payment, order);
    
    // Reset failure counters
    await resetFailureCounters(subscription);
    
    // Schedule next cycle
    await scheduleNextCycle(subscription);
    
    await emitEvent('EVENT-SUBSCRIPTION-CYCLE-PAID');
  } catch (err) {
    await markCycleFailed(cycle, err);
    await initiateDunning(subscription, cycle);
    await emitEvent('EVENT-SUBSCRIPTION-PAYMENT-FAILED');
  }
}
```

### 4.4 Cycle order creation

For each successful cycle:
1. Create new `orders` row with `source='recurring'`, `parent_order_id = subscription.parent_order_id`, `metadata.subscription_id`, `metadata.cycle_number`
2. Insert `order_items` from `subscription_items` snapshot
3. Apply per-cycle pricing (locked vs current)
4. Tax engine recomputes (rates may have changed)
5. Skip cart + checkout flow (direct order creation)
6. Trigger fulfillment if shipping_method set
7. Emit `EVENT-ORDER-PLACED` (per `16`)

### 4.5 Pause handling

When paused:
- `subscriptions.status='paused'`, `paused_at`, `paused_until` set
- Scheduled `subscription_billing_cycles` cycles auto-update to `status='paused'`
- `JOB-AUTO-RESUME-SUBSCRIPTIONS` checks daily for `paused_until <= now()` → resume

Resume:
- `subscriptions.status='active'`, `paused_at=NULL`
- Reschedule next cycle based on resume date
- Optional: prorated catch-up charge if merchant policy demands

### 4.6 Skip handling

Customer opts to skip next cycle:
- `subscriptions.skip_next_cycle=true`
- Set `subscription_skips` row for current `cycle_number + 1`
- Next billing job: mark cycle skipped, advance period, clear flag
- Customer notified (configurable per cycle count)

---

## 5. MIT (Merchant-Initiated Transactions)

### 5.1 PSD2 / SCA requirements

EU PSD2 requires Strong Customer Authentication (SCA) for online card payments. Subscriptions qualify for MIT exemption if:
- Initial transaction (first cycle) used SCA — customer explicit consent
- Subsequent charges are "Merchant-Initiated" (no customer action required)
- Recurring transactions match initial mandate (amount, schedule)
- Exemption flag set on each charge

### 5.2 Subscription setup with SCA

At signup:
1. Customer enters card at checkout
2. SCA challenge during checkout (3DS2 typically)
3. Provider returns `payment_intent.setup_future_usage='off_session'` (Stripe) or equivalent
4. Saved payment method linked to subscription
5. Recurring mandate stored at provider

### 5.3 Recurring charge flow

```typescript
async function chargeSubscription(subscription, cycle) {
  const provider = paymentProviders[subscription.payment_method_provider_code];
  
  return await provider.charge({
    amount: cycle.total_amount,
    currency: cycle.currency,
    saved_payment_method_id: subscription.payment_method_id,
    customer_id: subscription.customer_id,
    is_recurring: true,
    sca_exemption_kind: 'recurring',                                                                                    // Stripe: 'off_session_recurring'
    metadata: {
      subscription_id: subscription.id,
      cycle_number: cycle.cycle_number,
    },
    idempotency_key: `sub-${subscription.id}-cycle-${cycle.cycle_number}`,
  });
}
```

### 5.4 SCA challenge fallback

Sometimes recurring charge requires fresh SCA (bank policy, expiring mandate):
- Provider returns `requires_action` with authentication URL
- We email customer: "Please authenticate to continue your subscription"
- Customer completes challenge → provider retries
- If not authenticated within 7 days → mark failed, dunning starts

### 5.5 Card update workflow

Customer's card expires or is replaced:
- Network token (Stripe / Mastercard / Visa) may auto-update — backend webhook fires
- Customer can manually update via storefront self-service
- If neither: dunning starts after first failure

---

## 6. Dunning workflow

### 6.1 Default retry schedule

When recurring charge fails:

```
Day 0: failure → mark past_due, attempt 1 result recorded
Day 3: attempt 2 (smart retry — same day of week as success in past, Fáze 3+)
Day 7: attempt 3 + customer email "Your subscription needs attention"
Day 14: attempt 4 + customer email "Last chance to update payment"
Day 21: attempt 5 (final)
Day 28: cancel subscription if still unpaid
```

Configurable per tenant `tenant.settings.subscription_dunning_schedule`.

### 6.2 Customer outreach

Each dunning stage triggers email (cross-ref `19-marketing-seo.md` automation flows):
- Day 3: "Payment failed, retrying"
- Day 7: "Update your payment method to keep your subscription"
- Day 14: "Your subscription is at risk"
- Day 28: "Your subscription has been cancelled — re-subscribe anytime"

### 6.3 Smart retry timing (Fáze 3+)

AI-based optimal retry timing:
- Learn customer's typical pay-day (when card has sufficient balance)
- Retry on those days
- Per-card success patterns

### 6.4 Customer self-service recovery

Storefront flow:
1. Customer receives dunning email
2. Click link → `/account/subscriptions/{number}/update-payment`
3. New payment method entered
4. Backend retries charge immediately
5. If succeeds: dunning cleared, subscription `active`

### 6.5 Reactivation

Cancelled subscription can be reactivated:
- Customer self-service or admin action
- New billing cycle starts; previous history preserved
- Optional: re-pricing if `pricing_strategy='current_market_rate'`

---

## 7. State machines

### 7.1 Subscription status

```
                                       trial_period_passes
                                              │
[trial] ──first charge OR trial_end ──▶ [active]
                                              │
                                              ├──pause──▶ [paused] ──resume──▶ [active]
                                              │                  (auto-resume at paused_until)
                                              │
                                              ├──charge fails──▶ [past_due]
                                              │                  │
                                              │                  ├──retry succeeds──▶ [active]
                                              │                  └──retries exhausted──▶ [cancelled]
                                              │
                                              ├──customer cancels (end of period)──▶ [pending_cancellation]
                                              │                  │
                                              │                  └──period ends──▶ [cancelled]
                                              │
                                              ├──customer cancels (immediate)──▶ [cancelled]
                                              │
                                              ├──total_billing_cycles reached──▶ [expired]
                                              │
                                              └──merchant cancels──▶ [cancelled]

Reactivation: [cancelled] → [active] (new period start, new cycle)
```

### 7.2 Billing cycle status

```
scheduled → processing → paid
                       → failed (dunning starts)
                       → skipped (customer opted)
                       → paused (subscription paused)
                       → refunded (after charged, refunded)
```

### 7.3 Dunning attempt

```
scheduled → attempted → succeeded (clears dunning)
                      → failed (next attempt scheduled OR final)
         → cancelled (subscription resolved differently)
```

---

## 8. Business rules

### RULE-SUB-001: Subscription creation requires saved payment method

Customer cannot subscribe without:
- Valid saved payment method (per `13`)
- Provider supporting recurring (e.g., not COD, not gift_card)
- SCA completed at initial transaction (EU)

### RULE-SUB-002: 14-day cooling-off (EU)

Per EU Consumer Rights Directive 2011/83/EU:
- First 14 days: customer can cancel without penalty
- Full refund of first cycle if requested
- No refund for already-shipped products is allowed only if "expressly waived" with explicit disclosure
- Disclosure required at signup

Exception: digital subscriptions (subscriptions to digital content) — customer expressly waives cooling-off in exchange for immediate access (per directive).

### RULE-SUB-003: Automatic renewal disclosure (EU)

Per EU Better Enforcement Directive 2019/2161:
- Customer must be informed about automatic renewal
- Disclosed clearly at signup + in confirmation
- Reminder email before each renewal (configurable, default 3 days before)
- Easy cancellation (no harder than signup) — RULE-SUB-004

### RULE-SUB-004: Easy cancellation

Customer can cancel via:
- Storefront self-service (1-2 clicks)
- Email to support (response within 24h)
- Phone (if merchant offers)

Cannot require: paper letter, certified mail, in-person visit (unless contractually agreed B2B).

EU directive: cancellation must be at least as easy as signup.

### RULE-SUB-005: Billing anchor consistency

Once subscription has `billing_anchor_day` set, all subsequent cycles align to that day. If anchor doesn't exist in month (e.g., 31st in Feb): use last day of month.

### RULE-SUB-006: Trial transition

When `trial_end_at` reached:
- Charge first cycle (or use trial_charge_amount if pre-set)
- Transition status `trial → active`
- If charge fails: enter dunning immediately

### RULE-SUB-007: Minimum billing cycles enforcement

If `minimum_billing_cycles=6`, customer cannot cancel before 6 cycles completed (subject to legal exceptions like cooling-off).

Cancellation attempts during minimum:
- Reject (customer notification: contractual lock-in)
- OR allow with penalty (one-time fee per merchant policy)

### RULE-SUB-008: Customer pricing lock vs market

`pricing_strategy='locked_at_signup'`: subscription_items unit_price_amount immutable. Tax may still change with regulation.

`pricing_strategy='current_market_rate'`: each cycle pulls current price from price_list. Notify customer before charge if price increased.

`pricing_strategy='custom_per_cycle'`: merchant sets each cycle price ad-hoc (rare; build-your-box model).

### RULE-SUB-009: Customer-initiated items modification

Customer can:
- Add add-ons (if `subscription_plans.allow_item_customization=true`)
- Remove add-ons
- Change quantities (next cycle)
- Swap variant (e.g., switch from "regular coffee" to "decaf")

Cannot:
- Change core plan items (without cancellation + new subscription)
- Reduce below minimum (per plan)

### RULE-SUB-010: Frequency change proration

Customer changes from monthly to quarterly mid-cycle:
- Current cycle continues as monthly until period end
- Next cycle scheduled per new frequency
- No proration (simplifies UX); cycle starts fresh

Tenant can opt for proration (Fáze 3+).

### RULE-SUB-011: Pause limits

Per tenant policy:
- Max consecutive pause duration (default 90 days)
- Max pauses per year (default 6)
- After limits: subscription auto-cancelled OR customer prompted

### RULE-SUB-012: Skip cycle limits

Per tenant policy:
- Max consecutive skips (default 2)
- Max skips per year (default 3)
- Excess: customer prompted to pause instead

### RULE-SUB-013: Tax recompute per cycle

Each cycle's tax recomputed with current rates. Snapshotted to `subscription_billing_cycles.tax_amount`.

If rate changed: customer notification (configurable threshold, e.g., >2% change).

### RULE-SUB-014: Failed cycle handling

After failed payment:
1. `subscription.status='past_due'`
2. `dunning_started_at=now()`
3. Schedule `dunning_attempts` per tenant schedule
4. Notify customer (email + optional SMS)
5. Order creation deferred (no fulfillment) until paid
6. Inventory not reserved for failed cycle

### RULE-SUB-015: Refund of last cycle on cancellation

EU cooling-off rules: customer can demand refund of last cycle if within 14 days. Merchant can dispute if goods shipped + used.

UI lets customer request refund as part of cancellation flow.

### RULE-SUB-016: B2B subscription (replenishment)

B2B customer can subscribe to replenishment:
- `subscriptions.company_id` set
- Per-company pricing (per `21-b2b-complete.md`)
- Billing on NET terms (invoice instead of card charge)
- PO number auto-applied to each cycle order

### RULE-SUB-017: Customer notification of upcoming charge

Per `subscription.upcoming_charge_notification_days_before` (default 3):
- Email customer: "Your next subscription charge of X will be on Y date"
- Includes: items, total, payment method, cancel link

Mandatory disclosure for EU.

### RULE-SUB-018: Inventory reservation for upcoming cycle

T-2 days before next cycle: reserve inventory for items (per `09-inventory.md`).

If insufficient stock at reservation time:
- Notify customer (substitute? cancel? wait?)
- Per merchant policy

### RULE-SUB-019: Shipping schedule alignment

Default: shipment created with each successful cycle order. Same delivery cadence as billing.

Decoupling option (Fáze 3+): e.g., bill monthly but ship every other month.

### RULE-SUB-020: Subscription analytics retention

`subscription_analytics_snapshots` retained indefinitely (aggregates, no PII). Useful for long-term MRR analysis.

Raw `subscriptions` table preserved per accounting law (10 years CZ).

### RULE-SUB-021: Plan changes (upgrade/downgrade)

Customer switches from "Bronze plan" ($10/mo) to "Gold plan" ($30/mo):
- New subscription created
- Old subscription cancelled at next period (or immediate with proration)
- Proration: ($20 difference × days remaining / cycle days)
- Charge or credit applied

### RULE-SUB-022: Add-on lifecycle

Add-ons billed alongside main subscription:
- Added: prorated charge for remainder of current period
- Removed: prorated credit for remainder of current period
- Stay synced with main subscription's billing cycle

### RULE-SUB-023: Subscription expiration

Fixed-term subscription reaches `total_billing_cycles`:
- Status `active → expired`
- Customer notified
- Optional: auto-renewal prompt (with explicit re-consent for EU)

### RULE-SUB-024: Payment method update non-disruptive

Customer updates payment method:
- Old method kept (in case new fails)
- New method validated (zero-auth or low-value test charge)
- On success: switch active method
- No interruption to schedule

### RULE-SUB-025: Subscription order doesn't follow normal cart flow

Recurring orders bypass cart, checkout, applying coupons fresh. Order created directly from subscription snapshot:
- `source='recurring'`
- `metadata.subscription_id`, `metadata.cycle_number`
- Skip cart `11-cart.md` flow entirely

### RULE-SUB-026: Cancellation reason capture

Cancellation flow asks customer:
- Reason code (dropdown)
- Free-form notes
- Optional: "Would a discount keep you?" offer (save-the-customer flow Fáze 2+)

Helps churn analysis per `20-analytics-reporting.md`.

### RULE-SUB-027: Concurrent subscription modifications

Advisory lock per subscription_id during mutations. Prevents race between billing job + customer self-service edit.

### RULE-SUB-028: Failed dunning final cancellation

After all dunning attempts exhausted:
- Status `cancelled`, `cancellation_reason_code='payment_failure'`
- Customer notified
- Re-subscription possible immediately

### RULE-SUB-029: Audit per modification

Every change (pause, item edit, frequency, address, payment method) logged in `subscription_modifications`.

### RULE-SUB-030: Tax-inclusive vs exclusive

Subscription pricing display follows `tenant.tax_inclusive_display`. Order created per channel rules (per `22-multistore-channels.md`).

### RULE-SUB-031: Subscription email automation triggers

Per `19-marketing-seo.md`:
- Welcome to subscription (1 email)
- Pre-renewal reminder (3 days before per RULE-SUB-017)
- Payment failed (dunning emails)
- Subscription paused / resumed (acknowledgement)
- Cancellation confirmation
- Win-back (30/60/90 days after cancellation)

### RULE-SUB-032: GDPR delete impact

Customer deletes account:
- Active subscriptions cancelled (cannot continue without PII)
- Subscription record anonymized per `18` rules
- Subscription history preserved for accounting

---

## 9. REST API endpoints

### 9.1 Subscription plans (admin)

```
GET    /api/{date}/subscription-plans
POST   /api/{date}/subscription-plans
GET    /api/{date}/subscription-plans/{id}
PATCH  /api/{date}/subscription-plans/{id}
DELETE /api/{date}/subscription-plans/{id}
POST   /api/{date}/subscription-plans/{id}:activate
POST   /api/{date}/subscription-plans/{id}:deactivate
```

### 9.2 Product subscription options

```
GET    /api/{date}/products/{id}/subscription-options
PATCH  /api/{date}/products/{id}/subscription-options
```

### 9.3 Subscriptions (admin)

```
GET    /api/{date}/subscriptions
GET    /api/{date}/subscriptions/{id}
PATCH  /api/{date}/subscriptions/{id}                                                                  # admin edits (limited)
POST   /api/{date}/subscriptions/{id}:pause
POST   /api/{date}/subscriptions/{id}:resume
POST   /api/{date}/subscriptions/{id}:skip-next-cycle
POST   /api/{date}/subscriptions/{id}:unskip-next-cycle
POST   /api/{date}/subscriptions/{id}:cancel
POST   /api/{date}/subscriptions/{id}:reactivate
POST   /api/{date}/subscriptions/{id}:charge-now                                                        # ad-hoc charge
POST   /api/{date}/subscriptions/{id}:retry-failed-payment
POST   /api/{date}/subscriptions/{id}:add-item
DELETE /api/{date}/subscriptions/{id}/items/{item_id}
PATCH  /api/{date}/subscriptions/{id}/items/{item_id}                                                    # qty change
POST   /api/{date}/subscriptions/{id}:change-frequency
POST   /api/{date}/subscriptions/{id}:change-payment-method
POST   /api/{date}/subscriptions/{id}:change-shipping-address
GET    /api/{date}/subscriptions/{id}/billing-cycles
GET    /api/{date}/subscriptions/{id}/modifications
GET    /api/{date}/subscriptions/{id}/dunning-attempts
```

### 9.4 Storefront (customer)

```
GET    /api/{date}/storefront/me/subscriptions
GET    /api/{date}/storefront/me/subscriptions/{number}
POST   /api/{date}/storefront/me/subscriptions/{number}:pause
POST   /api/{date}/storefront/me/subscriptions/{number}:resume
POST   /api/{date}/storefront/me/subscriptions/{number}:skip-next-cycle
POST   /api/{date}/storefront/me/subscriptions/{number}:cancel
POST   /api/{date}/storefront/me/subscriptions/{number}:reactivate
POST   /api/{date}/storefront/me/subscriptions/{number}:add-item
DELETE /api/{date}/storefront/me/subscriptions/{number}/items/{item_id}
PATCH  /api/{date}/storefront/me/subscriptions/{number}/items/{item_id}
POST   /api/{date}/storefront/me/subscriptions/{number}:change-frequency
POST   /api/{date}/storefront/me/subscriptions/{number}:change-payment-method
POST   /api/{date}/storefront/me/subscriptions/{number}:change-shipping-address
POST   /api/{date}/storefront/me/subscriptions/{number}:update-payment-method-from-dunning              # dunning recovery
GET    /api/{date}/storefront/me/subscriptions/{number}/upcoming-cycle                                   # preview next charge
```

### 9.5 Analytics

```
GET    /api/{date}/subscription-analytics/mrr?period=current
GET    /api/{date}/subscription-analytics/arr
GET    /api/{date}/subscription-analytics/churn?period=monthly
GET    /api/{date}/subscription-analytics/retention?cohort=monthly
GET    /api/{date}/subscription-analytics/ltv
GET    /api/{date}/subscription-analytics/top-cancellation-reasons
GET    /api/{date}/subscription-analytics/dunning-recovery-rate
```

### 9.6 Example: Customer pauses subscription

```http
POST /api/2026-05-20/storefront/me/subscriptions/SUB-2026-00000123:pause HTTP/1.1
Authorization: Bearer customer_jwt

{
  "paused_until": "2026-08-01",
  "pause_reason": "Vacation in July",
  "pause_reason_code": "vacation"
}
```

```jsonc
HTTP/1.1 200 OK

{
  "data": {
    "id": "sub_aB",
    "status": "paused",
    "paused_at": "2026-05-20T10:00:00Z",
    "paused_until": "2026-08-01T00:00:00Z",
    "resume_scheduled_at": "2026-08-01T00:00:00Z"
  },
  "meta": {
    "next_step": "Subscription will auto-resume on 1 August 2026. You can resume earlier via the account page."
  }
}
```

### 9.7 Example: Customer skips next cycle

```http
POST /api/2026-05-20/storefront/me/subscriptions/SUB-2026-00000123:skip-next-cycle HTTP/1.1

{
  "reason": "I have enough stock",
  "reason_code": "too_much_stock"
}
```

```jsonc
HTTP/1.1 200 OK

{
  "data": {
    "id": "sub_aB",
    "skip_next_cycle": true,
    "next_billing_at": "2026-07-15T00:00:00Z",                                                            # original
    "skipped_cycle_number": 3,
    "new_next_billing_at": "2026-08-15T00:00:00Z"                                                          # moved forward
  }
}
```

### 9.8 Example: Customer cancels subscription

```http
POST /api/2026-05-20/storefront/me/subscriptions/SUB-2026-00000123:cancel HTTP/1.1

{
  "cancellation_effective": "end_of_period",                                                              // or "immediate"
  "reason": "Found better alternative",
  "reason_code": "better_alternative",
  "request_refund_for_last_cycle": false
}
```

```jsonc
HTTP/1.1 200 OK

{
  "data": {
    "id": "sub_aB",
    "status": "pending_cancellation",
    "cancelled_at": "2026-05-20T10:00:00Z",
    "cancellation_effective_at": "2026-06-15T00:00:00Z",
    "remaining_cycles_until_end": 0,
    "refund_eligible": false                                                                              // 14-day cooling-off passed
  },
  "meta": {
    "next_step": "Your subscription will end on 15 June 2026. You'll receive your last delivery before then. You can reactivate anytime."
  }
}
```

### 9.9 Example: Admin charges ad-hoc

```http
POST /api/2026-05-20/subscriptions/sub_aB:charge-now HTTP/1.1
Authorization: Bearer staff_jwt
Idempotency-Key: ...

{
  "reason": "Catch-up missed cycle due to billing date misalignment",
  "amount": 49900,
  "currency": "CZK"
}
```

```jsonc
HTTP/1.1 200 OK

{
  "data": {
    "subscription_id": "sub_aB",
    "payment_id": "pay_xY",
    "status": "captured",
    "amount": 49900
  }
}
```

### 9.10 Example: MRR overview

```http
GET /api/2026-05-20/subscription-analytics/mrr?period=current HTTP/1.1
```

```jsonc
HTTP/1.1 200 OK

{
  "data": {
    "period": "current_month",
    "currency": "CZK",
    "mrr_amount": 1247500,
    "arr_amount": 14970000,
    "previous_period_mrr": 1198400,
    "change_amount": 49100,
    "change_percent_basis_points": 410,
    "components": {
      "new_mrr_amount": 84200,
      "expansion_mrr_amount": 12300,
      "contraction_mrr_amount": 8400,
      "churned_mrr_amount": 39000
    },
    "active_subscriptions": 487,
    "average_subscription_value": 2560,
    "churn_rate_basis_points": 313                                                                          // 3.13% monthly
  }
}
```

---

## 10. GraphQL schema

```graphql
type Subscription implements Node & Timestamped {
  id: ID!
  pubId: String!
  number: String!
  customer: Customer!
  company: Company
  parentOrder: Order!
  status: SubscriptionStatus!
  billingCycleKind: BillingCycleKind!
  billingIntervalCount: Int!
  customIntervalDays: Int
  billingAnchorDay: Int
  trialEndAt: DateTime
  currency: String!
  pricingStrategy: SubscriptionPricingStrategy!
  recurringSubtotalAmount: Money!
  recurringDiscountAmount: Money!
  recurringShippingAmount: Money!
  recurringTaxAmount: Money!
  recurringTotalAmount: Money!
  startedAt: DateTime!
  currentPeriodStart: DateTime!
  currentPeriodEnd: DateTime!
  nextBillingAt: DateTime
  nextShipmentAt: DateTime
  pausedAt: DateTime
  pausedUntil: DateTime
  cancelledAt: DateTime
  cancellationEffectiveAt: DateTime
  cancellationReason: String
  cancellationReasonCode: SubscriptionCancellationReasonCode
  expiredAt: DateTime
  minimumBillingCycles: Int
  totalBillingCycles: Int
  completedBillingCycles: Int!
  paymentMethod: SavedPaymentMethod
  shippingAddress: Address
  billingAddress: Address
  items: [SubscriptionItem!]!
  skipNextCycle: Boolean!
  skippedCyclesCount: Int!
  failedPaymentAttemptsCount: Int!
  dunningStage: Int!
  totalRevenue: Money!
  sendRenewalReminderEmails: Boolean!
  upcomingChargeNotificationDaysBefore: Int!
  billingCycles: [SubscriptionBillingCycle!]!
  modifications: [SubscriptionModification!]!
  pauses: [SubscriptionPause!]!
  skips: [SubscriptionSkip!]!
  dunningAttempts: [DunningAttempt!]!
  upcomingCyclePreview: UpcomingCyclePreview
  createdAt: DateTime!
  updatedAt: DateTime!
}

enum SubscriptionStatus { TRIAL ACTIVE PAUSED PAST_DUE PENDING_CANCELLATION CANCELLED EXPIRED FAILED }
enum BillingCycleKind { WEEKLY BIWEEKLY MONTHLY QUARTERLY SEMI_ANNUAL YEARLY CUSTOM_DAYS }
enum SubscriptionPricingStrategy { LOCKED_AT_SIGNUP CURRENT_MARKET_RATE CUSTOM_PER_CYCLE }
enum SubscriptionCancellationReasonCode {
  CUSTOMER_REQUEST PRICE_TOO_HIGH NO_LONGER_NEEDED QUALITY_ISSUE BETTER_ALTERNATIVE
  TEMPORARY_BREAK TECHNICAL_ISSUE PAYMENT_FAILURE MERCHANT_DECISION EXPIRED_CARD
  FRAUD DUPLICATE MANUAL_OTHER
}

type SubscriptionItem {
  id: ID!
  subscription: Subscription!
  variant: ProductVariant!
  product: Product!
  sku: String!
  title: String!
  quantity: Int!
  unitPrice: Money!
  lineSubtotal: Money!
  taxClassCode: String
  customization: JSON
  isAddOn: Boolean!
  position: Int!
}

type SubscriptionBillingCycle {
  id: ID!
  subscription: Subscription!
  cycleNumber: Int!
  cyclePeriodStart: DateTime!
  cyclePeriodEnd: DateTime!
  status: BillingCycleStatus!
  scheduledBillingAt: DateTime!
  attemptedBillingAt: DateTime
  completedBillingAt: DateTime
  totalAmount: Money!
  order: Order
  payment: Payment
  invoice: Invoice
  failureAttempts: Int!
  lastFailureCode: String
  lastFailureMessage: String
}

enum BillingCycleStatus { SCHEDULED PROCESSING PAID FAILED SKIPPED PAUSED REFUNDED }

type SubscriptionModification {
  id: ID!
  modificationKind: SubscriptionModificationKind!
  actor: Actor!
  reason: String
  beforeState: JSON
  afterState: JSON
  effectiveAt: DateTime!
  occurredAt: DateTime!
}

enum SubscriptionModificationKind {
  CREATED ACTIVATED PAUSED RESUMED SKIPPED
  ITEMS_CHANGED FREQUENCY_CHANGED QUANTITY_CHANGED PRICE_CHANGED
  ADDRESS_CHANGED PAYMENT_METHOD_CHANGED COUPON_APPLIED COUPON_REMOVED
  CANCELLED REACTIVATED TRIAL_EXTENDED TRIAL_ENDED EXPIRED
  MANUAL_OVERRIDE ADMIN_ADJUSTMENT ADD_ON_ADDED ADD_ON_REMOVED
}

type SubscriptionPause {
  id: ID!
  pausedAt: DateTime!
  pausedUntil: DateTime
  resumedAt: DateTime
  pauseReason: String
  pauseReasonCode: String
  initiatedBy: Actor!
}

type SubscriptionSkip {
  id: ID!
  billingCycleNumber: Int!
  skippedAt: DateTime!
  reason: String
}

type DunningAttempt {
  id: ID!
  attemptNumber: Int!
  scheduledAt: DateTime!
  attemptedAt: DateTime
  status: DunningAttemptStatus!
  payment: Payment
  failureCode: String
  failureMessage: String
}

enum DunningAttemptStatus { SCHEDULED SUCCEEDED FAILED CANCELLED }

type SubscriptionPlan implements Node {
  id: ID!
  pubId: String!
  name: String!
  description: String
  billingCycleKind: BillingCycleKind!
  billingIntervalCount: Int!
  currency: String!
  recurringAmount: Money!
  setupFeeAmount: Money
  trialPeriodDays: Int
  minimumBillingCycles: Int
  defaultItems: JSON!
  allowItemCustomization: Boolean!
  availableAddOns: JSON
  recurringDiscountPercent: Float
  isActive: Boolean!
  isListedInStorefront: Boolean!
}

type UpcomingCyclePreview {
  cycleNumber: Int!
  scheduledBillingAt: DateTime!
  estimatedTotal: Money!
  items: [SubscriptionItem!]!
  shippingAddress: Address!
  paymentMethod: SavedPaymentMethod!
}

extend type Query {
  subscriptions(first: Int, after: String, filter: SubscriptionFilter): SubscriptionConnection! @auth(requires: PERM_SUBSCRIPTION_VIEW)
  subscription(id: ID, pubId: String, number: String): Subscription @auth(requires: PERM_SUBSCRIPTION_VIEW)
  mySubscriptions: [Subscription!]!
  mySubscription(number: String!): Subscription
  subscriptionPlans(activeOnly: Boolean = true): [SubscriptionPlan!]!
  subscriptionPlan(id: ID, pubId: String): SubscriptionPlan

  subscriptionAnalyticsMrr(period: PeriodInput): MrrSnapshot! @auth(requires: PERM_SUBSCRIPTION_ANALYTICS)
  subscriptionAnalyticsChurn(period: PeriodInput): ChurnAnalysis! @auth(requires: PERM_SUBSCRIPTION_ANALYTICS)
  subscriptionAnalyticsRetention(cohort: TimeGranularity = MONTHLY): CohortMatrix! @auth(requires: PERM_SUBSCRIPTION_ANALYTICS)
  subscriptionAnalyticsTopCancellationReasons(period: PeriodInput): [CancellationReasonStat!]! @auth(requires: PERM_SUBSCRIPTION_ANALYTICS)
}

type MrrSnapshot {
  period: String!
  currency: String!
  mrrAmount: Money!
  arrAmount: Money!
  previousPeriodMrr: Money
  changeAmount: Money!
  changePercent: Float!
  newMrrAmount: Money!
  expansionMrrAmount: Money!
  contractionMrrAmount: Money!
  churnedMrrAmount: Money!
  activeSubscriptions: Int!
  averageSubscriptionValue: Money!
  churnRate: Float!
}

type ChurnAnalysis {
  period: String!
  customerChurnRate: Float!
  revenueChurnRate: Float!
  totalCancelled: Int!
  totalActiveAtStart: Int!
}

type CancellationReasonStat {
  reasonCode: String!
  count: Int!
  percentage: Float!
}

extend type Mutation {
  createSubscriptionPlan(input: SubscriptionPlanInput!): SubscriptionPlan! @auth(requires: PERM_SUBSCRIPTION_PLAN_MANAGE)
  updateSubscriptionPlan(id: ID!, input: SubscriptionPlanInput!): SubscriptionPlan! @auth(requires: PERM_SUBSCRIPTION_PLAN_MANAGE)
  activateSubscriptionPlan(id: ID!): SubscriptionPlan! @auth(requires: PERM_SUBSCRIPTION_PLAN_MANAGE)
  deactivateSubscriptionPlan(id: ID!): SubscriptionPlan! @auth(requires: PERM_SUBSCRIPTION_PLAN_MANAGE)

  pauseSubscription(id: ID!, pausedUntil: DateTime, reason: String): Subscription!
  resumeSubscription(id: ID!): Subscription!
  skipNextCycle(subscriptionId: ID!, reason: String): Subscription!
  unskipNextCycle(subscriptionId: ID!): Subscription!
  cancelSubscription(id: ID!, input: CancelSubscriptionInput!): Subscription!
  reactivateSubscription(id: ID!): Subscription!

  addSubscriptionItem(subscriptionId: ID!, input: SubscriptionItemInput!): SubscriptionItem!
  updateSubscriptionItem(itemId: ID!, input: SubscriptionItemUpdateInput!): SubscriptionItem!
  removeSubscriptionItem(itemId: ID!): DeletePayload!

  changeSubscriptionFrequency(id: ID!, input: ChangeFrequencyInput!): Subscription!
  changeSubscriptionPaymentMethod(id: ID!, paymentMethodId: ID!): Subscription!
  changeSubscriptionShippingAddress(id: ID!, addressId: ID!): Subscription!

  chargeSubscriptionNow(id: ID!, input: ChargeNowInput!, idempotencyKey: String!): Payment! @auth(requires: PERM_SUBSCRIPTION_CHARGE)
  retryFailedSubscriptionPayment(id: ID!): Payment! @auth(requires: PERM_SUBSCRIPTION_MANAGE)
  updatePaymentMethodFromDunning(subscriptionId: ID!, newPaymentMethodId: ID!): Subscription!
}
```

---

## 11. Events

| Build-spec ID | Wire | Payload |
|---|---|---|
| `EVENT-SUBSCRIPTION-CREATED` | `subscription.created` | `{ subscription }` |
| `EVENT-SUBSCRIPTION-ACTIVATED` | `subscription.activated` | `{ subscription }` (post-trial) |
| `EVENT-SUBSCRIPTION-TRIAL-STARTED` | `subscription.trial_started` | `{ subscription }` |
| `EVENT-SUBSCRIPTION-TRIAL-ENDING-SOON` | `subscription.trial_ending_soon` | `{ subscription, days_remaining }` |
| `EVENT-SUBSCRIPTION-TRIAL-ENDED` | `subscription.trial_ended` | `{ subscription }` |
| `EVENT-SUBSCRIPTION-CYCLE-SCHEDULED` | `subscription.cycle_scheduled` | `{ subscription, cycle }` |
| `EVENT-SUBSCRIPTION-CYCLE-PROCESSING` | `subscription.cycle_processing` | `{ subscription, cycle }` |
| `EVENT-SUBSCRIPTION-CYCLE-PAID` | `subscription.cycle_paid` | `{ subscription, cycle, payment, order }` |
| `EVENT-SUBSCRIPTION-CYCLE-SKIPPED` | `subscription.cycle_skipped` | `{ subscription, cycle }` |
| `EVENT-SUBSCRIPTION-PAYMENT-FAILED` | `subscription.payment_failed` | `{ subscription, cycle, failure_code }` |
| `EVENT-SUBSCRIPTION-DUNNING-STARTED` | `subscription.dunning_started` | `{ subscription, cycle }` |
| `EVENT-SUBSCRIPTION-DUNNING-RECOVERED` | `subscription.dunning_recovered` | `{ subscription, cycle }` |
| `EVENT-SUBSCRIPTION-DUNNING-EXHAUSTED` | `subscription.dunning_exhausted` | `{ subscription, cycle }` |
| `EVENT-SUBSCRIPTION-PAUSED` | `subscription.paused` | `{ subscription, paused_until }` |
| `EVENT-SUBSCRIPTION-RESUMED` | `subscription.resumed` | `{ subscription }` |
| `EVENT-SUBSCRIPTION-CANCELLED` | `subscription.cancelled` | `{ subscription, reason_code }` |
| `EVENT-SUBSCRIPTION-REACTIVATED` | `subscription.reactivated` | `{ subscription }` |
| `EVENT-SUBSCRIPTION-EXPIRED` | `subscription.expired` | `{ subscription }` (fixed-term ended) |
| `EVENT-SUBSCRIPTION-FREQUENCY-CHANGED` | `subscription.frequency_changed` | `{ subscription, previous, new }` |
| `EVENT-SUBSCRIPTION-PRICE-CHANGED` | `subscription.price_changed` | `{ subscription, previous, new }` |
| `EVENT-SUBSCRIPTION-ITEMS-CHANGED` | `subscription.items_changed` | `{ subscription, changes }` |
| `EVENT-SUBSCRIPTION-ADD-ON-ADDED` | `subscription.add_on_added` | `{ subscription, add_on }` |
| `EVENT-SUBSCRIPTION-PAYMENT-METHOD-CHANGED` | `subscription.payment_method_changed` | `{ subscription }` |
| `EVENT-SUBSCRIPTION-RENEWAL-REMINDER-SENT` | `subscription.renewal_reminder_sent` | `{ subscription, charge_date }` |
| `EVENT-SUBSCRIPTION-UPCOMING-CHARGE-DETECTED` | `subscription.upcoming_charge` | `{ subscription, amount, charge_at }` |
| `EVENT-SUBSCRIPTION-PLAN-CREATED` | `subscription.plan_created` | `{ plan }` |
| `EVENT-SUBSCRIPTION-MRR-MILESTONE` | `subscription.mrr_milestone` | `{ tenant_id, milestone_amount }` (e.g., 100k CZK MRR) |
| `EVENT-SUBSCRIPTION-CHURN-SPIKE` | `subscription.churn_spike` | `{ tenant_id, churn_rate, period }` |

**Konzumenti:**
- Email automation (cross-ref `19`) — renewal reminders, dunning emails, cancellation confirmation
- Order management (cross-ref `16`) — recurring order creation
- Inventory (cross-ref `09`) — reservation 2 days before cycle
- Analytics (cross-ref `20`) — MRR/churn computation
- Webhook delivery — per merchant subscription

---

## 12. Background jobs

| Job | Trigger | Queue | Frequency |
|---|---|---|---|
| `JOB-PROCESS-SUBSCRIPTION-BILLING-CYCLES` | scheduled | `subscriptions` | Every 5 min |
| `JOB-CREATE-NEXT-CYCLE-AFTER-PAID` | EVENT-SUBSCRIPTION-CYCLE-PAID | `subscriptions` | On-demand |
| `JOB-SEND-UPCOMING-CHARGE-NOTIFICATION` | scheduled | `notifications` | Daily |
| `JOB-AUTO-RESUME-SUBSCRIPTIONS` | scheduled | `subscriptions` | Hourly |
| `JOB-AUTO-CANCEL-EXPIRED-SUBSCRIPTIONS` | scheduled | `subscriptions` | Daily |
| `JOB-EXECUTE-DUNNING-ATTEMPT` | scheduled (per dunning_attempts.scheduled_at) | `dunning` | On-demand |
| `JOB-EXHAUST-DUNNING-AND-CANCEL` | when all attempts fail | `subscriptions` | On-demand |
| `JOB-SEND-DUNNING-EMAIL` | EVENT-SUBSCRIPTION-DUNNING-* | `notifications` | On-demand |
| `JOB-RESERVE-UPCOMING-CYCLE-INVENTORY` | scheduled (T-2 days) | `subscriptions` | Daily |
| `JOB-RELEASE-CANCELLED-INVENTORY` | EVENT-SUBSCRIPTION-CANCELLED | `subscriptions` | On-demand |
| `JOB-PROCESS-PENDING-CANCELLATIONS` | scheduled | `subscriptions` | Daily |
| `JOB-COMPUTE-MRR-DAILY-SNAPSHOT` | scheduled | `analytics` | Daily 04:00 |
| `JOB-COMPUTE-CHURN-METRICS` | scheduled | `analytics` | Daily |
| `JOB-DETECT-MRR-MILESTONE` | EVENT-SUBSCRIPTION-CYCLE-PAID | `analytics` | On-demand |
| `JOB-DETECT-CHURN-SPIKE` | scheduled | `analytics` | Daily |
| `JOB-SEND-TRIAL-ENDING-SOON-EMAIL` | scheduled | `notifications` | Daily |
| `JOB-CONVERT-TRIAL-TO-ACTIVE` | scheduled | `subscriptions` | Hourly |
| `JOB-RECONCILE-NETWORK-TOKEN-UPDATES` | webhook from provider | `subscriptions` | On-demand |
| `JOB-NOTIFY-EXPIRING-CARD` | scheduled | `notifications` | Daily |
| `JOB-PURGE-OLD-MODIFICATIONS` | scheduled | `maintenance` | Monthly |

### 12.1 JOB-PROCESS-SUBSCRIPTION-BILLING-CYCLES detail

```typescript
async function processSubscriptionBillingCycles() {
  // Select due cycles with subscription not paused
  const due = await pg.query(sql`
    SELECT bc.* FROM subscription_billing_cycles bc
    JOIN subscriptions s ON s.id = bc.subscription_id
    WHERE bc.status = 'scheduled'
      AND bc.scheduled_billing_at <= now()
      AND s.status IN ('active','trial')
      AND s.skip_next_cycle = false
    LIMIT 100
    FOR UPDATE SKIP LOCKED
  `);

  for (const cycle of due) {
    try {
      await pg.transaction(async tx => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('sub:' || ${cycle.subscription_id})::bigint)`);

        // 1. Create order from subscription items
        const order = await createOrderForCycle(tx, cycle);

        // 2. Charge payment method (outside Tx for external call)
        await markCycleProcessing(tx, cycle);
      });

      // 3. Charge (outside Tx — external)
      const payment = await chargeSubscription(cycle);

      // 4. Mark cycle paid + create next cycle
      await pg.transaction(async tx => {
        await markCyclePaid(tx, cycle, payment);
        await scheduleNextCycle(tx, cycle.subscription_id);
        await emitOutbox(tx, 'EVENT-SUBSCRIPTION-CYCLE-PAID', { cycle, payment });
      });
    } catch (err) {
      await markCycleFailed(cycle, err);
      await initiateDunning(cycle);
      await emitOutbox('EVENT-SUBSCRIPTION-PAYMENT-FAILED', { cycle, err });
    }
  }
}
```

### 12.2 JOB-EXECUTE-DUNNING-ATTEMPT detail

```typescript
async function executeDunningAttempt(attemptId: string) {
  const attempt = await loadDunningAttempt(attemptId);
  const cycle = await loadCycle(attempt.billing_cycle_id);
  const subscription = await loadSubscription(cycle.subscription_id);

  await markAttemptProcessing(attempt);

  try {
    const payment = await chargeSubscription(cycle);
    await markAttemptSucceeded(attempt, payment);
    await markCyclePaid(cycle, payment);
    await resetSubscriptionDunning(subscription);
    await emitOutbox('EVENT-SUBSCRIPTION-DUNNING-RECOVERED', { subscription, cycle });
  } catch (err) {
    await markAttemptFailed(attempt, err);
    // Schedule next attempt OR exhaust
    const nextAttempt = await scheduleNextDunningAttempt(subscription, cycle, attempt);
    if (!nextAttempt) {
      await emitOutbox('EVENT-SUBSCRIPTION-DUNNING-EXHAUSTED', { subscription, cycle });
      await cancelSubscriptionDueToDunning(subscription, cycle);
    }
  }
}
```

---

## 13. UI/UX flows

### FLOW-SUB-001: Subscribe at checkout

```
[Customer adds subscribable product to cart]
   - Product detail page shows "One-time purchase" vs "Subscribe & save 10%"
   - Toggle to subscription option
   - Frequency selector (weekly/monthly/quarterly per product config)
        │
        ▼
[Checkout — Subscription block displayed]
   - Order summary shows: "First cycle: 1199 Kč (next billing: 15. 6. 2026)"
   - Recurring disclosure: "Automatic monthly renewal until you cancel. Easy cancel anytime in account."
   - 14-day cooling-off mention
   - T&C checkbox includes subscription terms
        │
        ▼
[Customer completes checkout (per `12`)]
   - First charge captured with SCA
   - Subscription created with status='active' (or 'trial' if applicable)
   - Saved payment method linked
        │
        ▼
[Confirmation email includes subscription details]
```

### FLOW-SUB-002: Customer manages subscription

```
[Customer account → Subscriptions]
   - List of subscriptions with status badges
        │
   click subscription
        │
        ▼
[Subscription detail page]
   - Status: Active
   - Next billing: 15. 6. 2026 — 1199 Kč
   - Frequency: Monthly
   - Items list with quantities
   - Shipping address
   - Payment method (last4)
   - Actions:
     [Skip next cycle] [Pause] [Cancel]
     [Change frequency] [Update items] [Update payment method] [Update shipping]
   - Cycle history table
```

### FLOW-SUB-003: Customer pauses

```
[Subscription detail → "Pause subscription"]
        │
        ▼
[Pause modal]
   - "Pause until" date picker (max 90 days per default)
   - Reason dropdown (vacation, holiday, financial, ...)
   - Optional notes
        │
        ▼
[POST /subscriptions/{number}:pause]
   - Subscription paused
   - Next scheduled cycle deferred until paused_until
   - Email confirmation
   - JOB-AUTO-RESUME-SUBSCRIPTIONS will resume automatically
```

### FLOW-SUB-004: Customer cancels

```
[Subscription detail → "Cancel subscription"]
        │
        ▼
[Cancel flow (multi-step)]
   Step 1: Save-the-customer offer (optional Fáze 2+: "Want 20% off next 3 cycles?")
   Step 2: Reason capture (dropdown + notes)
   Step 3: Effective date (end of period vs immediate)
   Step 4: 14-day cooling-off refund option (if within window)
   Step 5: Confirmation
        │
        ▼
[POST /subscriptions/{number}:cancel]
   - status → pending_cancellation (until period ends) OR cancelled (immediate)
   - Customer notified
   - Subscription stays accessible in history
```

### FLOW-SUB-005: Failed payment recovery

```
[Customer receives email: "Payment failed for your subscription"]
   - Link to /account/subscriptions/{number}/update-payment
        │
        ▼
[Update payment page]
   - Current method shown (last4)
   - New card form (or select different saved method)
   - "Update & retry charge" button
        │
        ▼
[POST /storefront/me/subscriptions/{number}:update-payment-method-from-dunning]
   - New method validated
   - Retry charge immediately
   - On success: dunning cleared, subscription active
   - On fail: schedule next dunning attempt
```

### FLOW-SUB-006: Admin subscription dashboard

```
[Admin → Subscriptions]
   - Filter by status, frequency, plan, customer
   - Bulk select
        │
   click subscription
        │
        ▼
[Subscription detail (admin)]
   - All customer fields
   - Cycle history (table)
   - Modifications log
   - Dunning attempts (if past_due)
   - Actions:
     [Pause for customer] [Resume] [Skip next] [Charge now] [Manual refund] [Cancel]
     [Edit items] [Change frequency] [Apply discount] [Send recovery email]
```

### FLOW-SUB-007: Trial conversion

```
[Customer on trial — receives email 3 days before trial ends]
   - Subject: "Your trial ends in 3 days — first charge: 999 Kč on 15.6.2026"
   - Manage subscription link
        │
   ... 3 days pass ...
        │
        ▼
[JOB-CONVERT-TRIAL-TO-ACTIVE fires at trial_end_at]
   - status: trial → active
   - First billing cycle scheduled (or immediate)
   - Email: "Welcome to your subscription"
```

### FLOW-SUB-008: MRR dashboard

```
[Admin → Subscriptions → Analytics]
   - Big number: MRR 1,247,500 CZK ↑ 4.1% MoM
   - ARR: 14,970,000 CZK
   - Components:
     • New: +84,200 (10 new subs)
     • Expansion: +12,300 (3 add-on additions)
     • Contraction: -8,400 (2 downgrades)
     • Churn: -39,000 (8 cancellations)
   - Trend line (12 months)
   - Cohort retention matrix
   - Top cancellation reasons
```

---

## 14. Edge cases & error handling

| Scenario | Behavior | Code |
|---|---|---|
| Subscribe without saved payment method | Reject; require setup | `PAYMENT_METHOD_REQUIRED`, 422 |
| Pause beyond max duration | Reject; suggest cancellation | `PAUSE_DURATION_EXCEEDED`, 422 |
| Skip past max consecutive skips | Reject; offer pause | `SKIP_LIMIT_EXCEEDED`, 422 |
| Cancel during minimum_billing_cycles | Reject (default) or allow with penalty per merchant policy | `MINIMUM_CYCLES_NOT_REACHED`, 422 |
| Payment fails after all dunning attempts | Cancel subscription, notify customer | (handled) |
| Customer's card declined (do_not_honor) | Schedule retry with smart timing | (handled) |
| Card expired mid-subscription | Network token auto-update OR customer prompted | (handled) |
| 3DS challenge required mid-recurring | Email customer link to authenticate; defer 7 days | (handled) |
| Subscription paused while billing cycle pending | Cycle deferred to resume date | (handled) |
| Concurrent admin + customer cancellation | Advisory lock; first wins, second informed | (handled) |
| Inventory shortage at upcoming cycle | Notify customer; substitute / cancel cycle | (handled per RULE-SUB-018) |
| Shipping address invalid at next cycle | Email customer to update; defer if can't ship | (handled) |
| GDPR delete while active subscription | Cancel + anonymize per `18` rules | (handled per RULE-SUB-032) |
| Multi-cycle catch-up after long pause | Per merchant policy: skip OR resume with single cycle (default skip) | (configurable) |
| Trial customer attempts to cancel | Allow free cancellation (14-day cooling-off applies) | (handled per RULE-SUB-002) |
| Subscription with 0 items (admin removed all) | Reject save; require at least 1 item | `NO_ITEMS_IN_SUBSCRIPTION`, 422 |
| Subscription price increase >5% | Notify customer 30 days before with explicit consent option | (configurable, per RULE-SUB-008) |
| Concurrent items modification + billing cycle | Advisory lock; mutations wait | (handled) |
| B2B subscription on NET terms (no card) | Invoice issued each cycle; payment due per NET | (handled per RULE-SUB-016) |
| Add-on price changes | Mid-cycle add: prorated; locked at addition time | (handled) |
| Customer disputes recent recurring charge | Standard dispute flow per `13` | (handled) |
| Subscription with multi-currency (rare) | Currency locked at signup; no mid-stream switching | (handled) |
| Tax rate changes between cycles | Recompute; notify if >2% change | (handled per RULE-SUB-013) |
| Reactivation after long-cancelled (>1 year) | Allow but treat as new subscription (new signup flow) | (handled) |

---

## 15. Performance

### 15.1 Targets

| Operation | p50 | p95 | p99 |
|---|---|---|---|
| Subscription detail load | 25 ms | 80 ms | 200 ms |
| Customer's subscriptions list | 30 ms | 100 ms | 250 ms |
| `JOB-PROCESS-SUBSCRIPTION-BILLING-CYCLES` (100 cycles) | 10 s | 30 s | 60 s |
| Pause / resume | 50 ms | 200 ms | 500 ms |
| Cancel | 30 ms | 100 ms | 250 ms |
| MRR snapshot computation | 30 s | 90 s | 180 s |
| Upcoming charge notification batch | 60 s | 180 s | 300 s |

### 15.2 Optimization

- BRIN index on `scheduled_billing_at`
- Partial indexes for active subscriptions
- Subscription detail cached Redis (60s, event-invalidated)
- MRR snapshots pre-computed daily
- DataLoader pro batched customer subscriptions
- Advisory lock per subscription for mutations

### 15.3 Scaling

- 100k active subscriptions per tenant manageable
- 1M+ subscriptions: partition `subscriptions` table by tenant_id (Fáze 3+)
- Billing cycles table partitioned monthly (BRIN-indexed)

---

## 16. Security & compliance

### 16.1 Permissions

```
PERM-SUBSCRIPTION-VIEW
PERM-SUBSCRIPTION-MANAGE
PERM-SUBSCRIPTION-MANAGE-FOR-CUSTOMER                      # admin on behalf
PERM-SUBSCRIPTION-CONFIG
PERM-SUBSCRIPTION-PLAN-MANAGE
PERM-SUBSCRIPTION-CHARGE                                    # ad-hoc charge
PERM-SUBSCRIPTION-CANCEL
PERM-SUBSCRIPTION-ANALYTICS
PERM-SUBSCRIPTION-AUDIT
```

### 16.2 EU compliance

Per RULE-SUB-002 / 003 / 004:
- 14-day cooling-off enforced
- Automatic renewal disclosed at signup + reminder emails
- Easy cancellation (parity with signup ease)
- All consent versioned + auditable

### 16.3 PCI scope

Per `13` — recurring charges use stored provider tokens, not raw PAN.

### 16.4 Audit

100% audit on:
- Pause / resume / skip
- Cancel (with reason)
- Frequency change
- Items modification
- Payment method change
- Manual charges
- Plan changes

Per RULE-SUB-029.

### 16.5 Rate limits

| Endpoint | Customer | Admin |
|---|---|---|
| `POST /storefront/me/subscriptions/{n}:pause` | 5/hour | n/a |
| `POST /storefront/me/subscriptions/{n}:cancel` | 5/hour | n/a |
| `POST /subscriptions/{id}:charge-now` | n/a | 30/min |
| Subscription detail GET | 600/min | 6000/min |

---

## 17. Testing

### 17.1 Unit

```
TEST-UNIT-SUB-001  BillingCycleCalculator (all frequencies + anchors)
TEST-UNIT-SUB-002  SubscriptionStateMachine
TEST-UNIT-SUB-003  DunningScheduleCalculator
TEST-UNIT-SUB-004  ProrationCalculator (frequency change)
TEST-UNIT-SUB-005  MrrCalculator
TEST-UNIT-SUB-006  ChurnRateCalculator
TEST-UNIT-SUB-007  TrialEndDetector
TEST-UNIT-SUB-008  SubscriptionAnchorHandler (month-end edge cases)
TEST-UNIT-SUB-009  PauseDurationValidator
TEST-UNIT-SUB-010  CancellationReasonCodeMapper
```

### 17.2 Integration

```
TEST-INT-SUB-001   Create subscription at checkout → status='active'
TEST-INT-SUB-002   Trial subscription → trial_end → active
TEST-INT-SUB-003   Recurring billing cycle creates order
TEST-INT-SUB-004   Payment fails → past_due → dunning
TEST-INT-SUB-005   Dunning success → recovered → active
TEST-INT-SUB-006   Dunning exhausted → cancelled
TEST-INT-SUB-007   Customer pauses → cycles deferred
TEST-INT-SUB-008   Auto-resume after paused_until
TEST-INT-SUB-009   Customer skips → cycle marked, advanced
TEST-INT-SUB-010   Customer cancels (end of period)
TEST-INT-SUB-011   Customer cancels (immediate)
TEST-INT-SUB-012   Refund for first cycle within 14 days
TEST-INT-SUB-013   Add-on prorated billing
TEST-INT-SUB-014   Frequency change next cycle
TEST-INT-SUB-015   Quantity change next cycle
TEST-INT-SUB-016   Payment method change non-disruptive
TEST-INT-SUB-017   Card auto-update via network token
TEST-INT-SUB-018   Tax recompute per cycle
TEST-INT-SUB-019   MRR snapshot accuracy
TEST-INT-SUB-020   Cohort retention computation
TEST-INT-SUB-021   B2B subscription with NET terms
TEST-INT-SUB-022   Pricing strategy lock vs market
TEST-INT-SUB-023   Reactivation creates new period
TEST-INT-SUB-024   Trial ending soon email
TEST-INT-SUB-025   Upcoming charge notification 3 days before
TEST-INT-SUB-026   Inventory reservation T-2 days
TEST-INT-SUB-027   GDPR delete cancels + anonymizes
TEST-INT-SUB-028   Concurrent customer + admin edits (advisory lock)
TEST-INT-SUB-029   Subscription orders linked via parent_order_id
TEST-INT-SUB-030   Plan upgrade with proration
```

### 17.3 E2E

```
TEST-E2E-SUB-001  Customer subscribes at checkout, receives first delivery, charges monthly
TEST-E2E-SUB-002  Customer pauses for vacation, auto-resumes
TEST-E2E-SUB-003  Customer cancels mid-flow, easy 2-step process
TEST-E2E-SUB-004  Customer card expires, network token updates, no interruption
TEST-E2E-SUB-005  Customer dunning recovery via storefront
TEST-E2E-SUB-006  Trial customer receives reminder, converts
TEST-E2E-SUB-007  Customer skips cycle, next cycle correct
TEST-E2E-SUB-008  Admin charges ad-hoc, customer notified
TEST-E2E-SUB-009  Customer changes frequency from monthly to quarterly
TEST-E2E-SUB-010  B2B subscription with NET 30 invoicing
```

### 17.4 Load

```
TEST-LOAD-SUB-001  10k subscriptions cycle in batch processing window (< 30 min)
TEST-LOAD-SUB-002  500 concurrent customer self-service modifications → no deadlocks
TEST-LOAD-SUB-003  MRR snapshot 100k subscriptions in < 60s
```

### 17.5 Compliance

```
TEST-COMPLIANCE-SUB-001  14-day cooling-off refund flow
TEST-COMPLIANCE-SUB-002  Automatic renewal disclosure rendered + accepted
TEST-COMPLIANCE-SUB-003  Cancellation accessibility (same steps as signup)
TEST-COMPLIANCE-SUB-004  Renewal reminder email 3 days before
TEST-COMPLIANCE-SUB-005  Audit trail complete for all changes
```

---

## 18. Implementation checklist

### Backend
- [ ] **[S]** Drizzle schema `packages/db/src/schema/subscriptions/*.ts`
- [ ] **[S]** Migrace `20260607_001_create_subscription_tables.sql` (partitions for billing_cycles)
- [ ] **[L]** `SubscriptionService` — CRUD + state machine
- [ ] **[M]** `SubscriptionPlanService`
- [ ] **[M]** `ProductSubscriptionOptionsService`
- [ ] **[L]** `BillingCycleEngine` — schedule + process
- [ ] **[L]** `DunningService` — retry schedule + execute
- [ ] **[M]** `SubscriptionStateMachine`
- [ ] **[M]** `ProrationCalculator`
- [ ] **[L]** `MrrAnalyticsService` — daily snapshots
- [ ] **[M]** `ChurnAnalyticsService`
- [ ] **[M]** `CancellationFlowService` (with save-the-customer hooks Fáze 2+)
- [ ] **[S]** `TrialManagementService`
- [ ] **[M]** REST endpoints per §9
- [ ] **[M]** GraphQL types + resolvers
- [ ] **[S]** tRPC router (admin)
- [ ] **[S]** MCP tools `subscription.create`, `subscription.cancel` (per agent token scope)

### Background jobs
- [ ] **[L]** JOB-PROCESS-SUBSCRIPTION-BILLING-CYCLES
- [ ] **[M]** JOB-CREATE-NEXT-CYCLE-AFTER-PAID
- [ ] **[S]** JOB-SEND-UPCOMING-CHARGE-NOTIFICATION
- [ ] **[S]** JOB-AUTO-RESUME-SUBSCRIPTIONS
- [ ] **[S]** JOB-AUTO-CANCEL-EXPIRED-SUBSCRIPTIONS
- [ ] **[M]** JOB-EXECUTE-DUNNING-ATTEMPT
- [ ] **[M]** JOB-EXHAUST-DUNNING-AND-CANCEL
- [ ] **[S]** JOB-SEND-DUNNING-EMAIL
- [ ] **[M]** JOB-RESERVE-UPCOMING-CYCLE-INVENTORY
- [ ] **[S]** JOB-RELEASE-CANCELLED-INVENTORY
- [ ] **[S]** JOB-PROCESS-PENDING-CANCELLATIONS
- [ ] **[L]** JOB-COMPUTE-MRR-DAILY-SNAPSHOT
- [ ] **[M]** JOB-COMPUTE-CHURN-METRICS
- [ ] **[S]** JOB-DETECT-MRR-MILESTONE, JOB-DETECT-CHURN-SPIKE
- [ ] **[S]** JOB-SEND-TRIAL-ENDING-SOON-EMAIL
- [ ] **[M]** JOB-CONVERT-TRIAL-TO-ACTIVE
- [ ] **[S]** JOB-RECONCILE-NETWORK-TOKEN-UPDATES
- [ ] **[S]** JOB-NOTIFY-EXPIRING-CARD

### Frontend — Admin
- [ ] **[L]** Subscriptions list + filters + bulk
- [ ] **[L]** Subscription detail (timeline + items + modifications)
- [ ] **[M]** Subscription plans management
- [ ] **[M]** Product subscription options config (per product)
- [ ] **[M]** Dunning queue + manual interventions
- [ ] **[L]** MRR + ARR + churn dashboards
- [ ] **[M]** Cohort retention matrix UI
- [ ] **[M]** Manual charge UI
- [ ] **[S]** Cancellation reasons analytics

### Frontend — Storefront
- [ ] **[M]** Subscribe option on product detail page
- [ ] **[M]** Subscription block in checkout
- [ ] **[L]** /account/subscriptions list + detail
- [ ] **[M]** Pause subscription modal
- [ ] **[M]** Cancel subscription flow (multi-step with save-the-customer)
- [ ] **[M]** Skip cycle UI
- [ ] **[M]** Item modification UI (add-ons, qty)
- [ ] **[M]** Frequency change UI
- [ ] **[M]** Payment method update (from dunning email)
- [ ] **[M]** Upcoming cycle preview
- [ ] **[S]** Cycle history table
- [ ] **[S]** Trial countdown banner

### Tests
- [ ] **[M]** Per §17 (incl. compliance tests)

### Docs
- [ ] **[M]** "Setting up subscription products" merchant guide
- [ ] **[M]** "Managing subscriptions" customer-facing guide
- [ ] **[S]** "Configuring dunning" admin guide
- [ ] **[S]** "MRR + churn analytics" guide
- [ ] **[S]** "EU subscription compliance" legal guide
- [ ] **[S]** Developer: subscription event hooks for plugins
- [ ] **[S]** Customer-facing: "How subscriptions work" help article

---

## 19. Open questions

### Q-SUB-001: AI churn risk prediction
**Otázka:** Predict customers likely to churn → proactive save-the-customer.

**Status:** Fáze 3+ AI feature. Detail v `33-ai-features.md`.

### Q-SUB-002: Variable pricing per cycle (build-your-box)
**Otázka:** Customer picks items each cycle, total varies.

**Status:** Schema-ready (`pricing_strategy='custom_per_cycle'`). UI Fáze 2+.

### Q-SUB-003: Multi-currency subscriptions
**Otázka:** Customer subscribes in EUR, currency changes mid-stream.

**Status:** Currency locked at signup. Customer must cancel + re-subscribe.

### Q-SUB-004: Loyalty integration
**Otázka:** Subscribers earn loyalty points; tiers based on subscription duration.

**Status:** Fáze 2+ via loyalty plugin (`19-marketing-seo.md` future ext).

### Q-SUB-005: Gift subscriptions
**Otázka:** Customer pays for someone else's subscription.

**Status:** v3.0+ feature. Schema: `subscriptions.metadata.gift_recipient_email`.

### Q-SUB-006: Bundle subscriptions
**Otázka:** Subscribe to multiple products at discount.

**Status:** Achievable via subscription_plans with multiple `default_items`. UX Fáze 2+.

### Q-SUB-007: Subscription returns
**Otázka:** Return one cycle's delivery without cancelling subscription.

**Status:** Per `17-returns-refunds.md` — return creates RMA for that cycle's order. Subscription continues.

### Q-SUB-008: Reverse trial (charge first, refund if cancelled)
**Otázka:** Charge full amount upfront, refund on cancellation within trial.

**Status:** Schema supports (`trial_is_free=false`, `trial_charge_amount=full`). UI Fáze 2+.

### Q-SUB-009: Subscription gifting + transfer
**Otázka:** Transfer subscription to another customer mid-term.

**Status:** v3.0+ feature. Complex (taxes, address change, EU rules).

### Q-SUB-010: Manual cycle generation (one-off override)
**Otázka:** Admin creates ad-hoc cycle outside normal schedule.

**Status:** Possible via `POST /subscriptions/{id}:charge-now`. Limited use case.

---

## 📅 Změny

| Datum | Změna |
|---|---|
| 2026-05-20 | Initial — Subscription commerce domain (v2.0+ activation). Schema-ready in MVP. Recurring billing, dunning, EU compliance (14-day cooling-off, automatic renewal disclosure, easy cancellation), MRR/ARR analytics. |

---

**Konec Subscriptions.**

➡️ Pokračovat na: [`25-marketplace.md`](25-marketplace.md)
