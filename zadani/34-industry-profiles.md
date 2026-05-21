# 34 – INDUSTRY PROFILES

> **Doména:** Industry profiles = vertical-specific preset bundles (fashion, food, health & beauty, electronics, books, furniture, jewelry, wine/spirits, toys, sports, pet, B2B industrial, services, digital products, crafts/handmade). Profile aktivuje preconfigured field schemas, page templates, business rules, recommended integrations, default workflows, EU regulatory checks. Merchant zvolí 1+ profil na onboardingu → platforma se "naladí" na vertikál; lze rozšířit / customizovat po MVP.

**Datum:** 2026-05-20
**Verze:** 1.0
**Status:** 🟡 DESIGN
**Reference:** [01-decisions-registry.md](01-decisions-registry.md) · [06-catalog-pim.md](06-catalog-pim.md) · [15-tax-compliance.md](15-tax-compliance.md) · [21-b2b-complete.md](21-b2b-complete.md) · [26-themes-storefront.md](26-themes-storefront.md)

---

## 📑 Obsah

0. [Domain overview](#0-domain-overview)
1. [References](#1-references)
2. [Personas](#2-personas)
3. [Architecture: profile preset bundle](#3-architecture-profile-preset-bundle)
4. [Data models](#4-data-models)
5. [Profile catalog](#5-profile-catalog)
6. [Per-profile detail](#6-per-profile-detail)
   - [6.1 Fashion & Apparel](#61-fashion--apparel)
   - [6.2 Food & Beverage](#62-food--beverage)
   - [6.3 Health & Beauty](#63-health--beauty)
   - [6.4 Electronics](#64-electronics)
   - [6.5 Books & Media](#65-books--media)
   - [6.6 Furniture & Home](#66-furniture--home)
   - [6.7 Jewelry & Watches](#67-jewelry--watches)
   - [6.8 Wine & Spirits](#68-wine--spirits)
   - [6.9 Toys & Kids](#69-toys--kids)
   - [6.10 Sports & Outdoor](#610-sports--outdoor)
   - [6.11 Pet Supplies](#611-pet-supplies)
   - [6.12 B2B Industrial](#612-b2b-industrial)
   - [6.13 Services & Bookings](#613-services--bookings)
   - [6.14 Digital Products](#614-digital-products)
   - [6.15 Crafts & Handmade](#615-crafts--handmade)
7. [State machines](#7-state-machines)
8. [Business rules](#8-business-rules)
9. [REST API endpoints](#9-rest-api-endpoints)
10. [GraphQL schema](#10-graphql-schema)
11. [Events](#11-events)
12. [Background jobs](#12-background-jobs)
13. [UI/UX flows](#13-uiux-flows)
14. [Testing](#14-testing)
15. [Implementation checklist](#15-implementation-checklist)
16. [Open questions](#16-open-questions)

---

## 0. Domain overview

### 0.1 Co tato doména **je**

- **Profile preset bundle** — pojmenovaná konfigurace platformy pro vertikál: field schemas (metafields per `04`), page templates, default theme suggestions, recommended integrations, default workflows, regulatory check templates, default categories
- **Vertical catalog** — 15 výchozích profilů pokrývajících běžné EU obchodní vertikály (rozšiřitelné)
- **Onboarding step** — wizard step 1 (per `27 §RULE-ADM-021`): tenant zvolí 1+ profil → preset aplikován na nový tenant
- **Multi-profile** — tenant může mít více profilů současně (např. "Fashion" + "Crafts"); deduplicate překryv
- **Customization** — preset jako starting point; tenant edituje / rozšiřuje cokoli
- **Regulatory compliance scaffolding** — per vertikál: připravené checklists, custom field templates pro mandatory data (EAN, allergens, age ratings, CE marking, ABV, vintage, ...)
- **Recommended integrations** — per vertikál list integrací (per `29`) automaticky doporučených (např. Heuréka pro CZ retail, Mailchimp pro fashion, accounting Pohoda pro CZ)
- **Default theme suggestions** — per vertikál theme z marketplace (per `26 §3.1`)
- **AI assist tailored** — Copilot system prompts adjusted per vertical (např. fashion = trendy/visual, B2B = formal/technical, food = compliance-focused)
- **Vertical-specific use cases** — virtual try-on (fashion), allergen filter (food), age gate (wine), warranty registration (electronics), download delivery (digital)

### 0.2 Co tato doména **NENÍ**

- ❌ Specific feature implementation pro vertikál (např. virtual try-on engine sama — to je samostatný plugin)
- ❌ Custom product catalog struktury (→ `06-catalog-pim.md` má metafields generic system; tato doc dává preset shapes)
- ❌ Regulatory engine sám (→ `15-tax-compliance.md` má EU rules; tato doc dává per-vertical config)
- ❌ Theme implementation (→ `26`); tato doc dává recommendations
- ❌ Integration adapter code (→ `29`); tato doc dává which integrations recommend per vertical
- ❌ Service-specific booking system (→ Fáze 4+ separate booking domain pro Services vertikál)
- ❌ Tenant business logic — tenant svobodně přizpůsobuje
- ❌ Industry-specific marketing (→ `19` má generic; vertikál nasměrování v profilu)

### 0.3 Diferenciátory

1. **EU-first vertical compliance** — každý profil má built-in EU regulatory hooks (allergen labeling EU 1169/2011, CE marking, age gate, ABV labeling, ...)
2. **Czech-specific** — Heuréka feed templates, Pohoda accounting, Czech Trade Inspection compliance helpers
3. **Multi-profile composable** — tenant kombinuje (fashion + crafts), žádný "lock-in" do jednoho
4. **AI-tuned per vertical** — Copilot prompts vertical-aware (fashion description vs technical spec sheet)
5. **Industry plugins ecosystem** — třetí strany mohou publikovat plugins extending profil (virtual try-on add-on pro Fashion, recipe builder pro Food, ...)
6. **No vertical lock** — profile = preset; tenant kdykoli může customizovat fields/templates/integrace bez ztráty profilu označení

---

## 1. References

- [01-decisions-registry.md](01-decisions-registry.md) — pricing tiers, plugin marketplace
- [04-api-conventions.md](04-api-conventions.md) — metafield system underpins profile field schemas
- [06-catalog-pim.md](06-catalog-pim.md) — products, variants, attributes
- [07-categories-taxonomy.md](07-categories-taxonomy.md) — default category trees per vertical
- [11-cart.md](11-cart.md), [12-checkout.md](12-checkout.md) — vertical-specific checkout fields (age gate)
- [13-payments.md](13-payments.md) — payment methods per vertical
- [14-shipping.md](14-shipping.md) — shipping requirements (cold chain for food, oversized for furniture)
- [15-tax-compliance.md](15-tax-compliance.md) — VAT rates per category, regulatory rules
- [17-returns-refunds.md](17-returns-refunds.md) — vertical-specific return policies
- [19-marketing-seo.md](19-marketing-seo.md) — vertical-specific feed generation (Heuréka categories)
- [21-b2b-complete.md](21-b2b-complete.md) — B2B Industrial vertical
- [22-multistore-channels.md](22-multistore-channels.md) — vertical-specific channels
- [24-subscriptions.md](24-subscriptions.md) — recurring (pet supplies, food boxes, digital)
- [25-marketplace.md](25-marketplace.md) — multi-vendor marketplaces (crafts, fashion)
- [26-themes-storefront.md](26-themes-storefront.md) — recommended themes per vertical
- [29-integrations.md](29-integrations.md) — recommended integrations
- [33-ai-features.md](33-ai-features.md) — AI Copilot vertical tuning
- EU Regulation 1169/2011 (food labeling)
- EU CLP Regulation (chemicals/cosmetics labeling)
- EU Toy Safety Directive 2009/48/EC (EN 71)
- EU Wine Regulation (1308/2013)
- EU Construction Products Regulation (305/2011)
- EU GPSR (General Product Safety Regulation, 2024)
- WEEE Directive (electronics waste)
- ISBN / ISSN standards
- GS1 (EAN/UPC) standards

---

## 2. Personas

| Persona | Použití | Klíčové permissions |
|---|---|---|
| `PERSONA-MERCHANT-OWNER` | Zvolí profile při onboardingu, aktivuje další později | `PERM-INDUSTRY-PROFILE-MANAGE` |
| `PERSONA-MERCHANT-CATEGORY-MANAGER` | Customizes preset fields per category | `PERM-CATALOG-MANAGE` (per `06`) |
| `PERSONA-MERCHANT-COMPLIANCE` | Reviews regulatory checklists per profile | `PERM-COMPLIANCE-VIEW`, `PERM-COMPLIANCE-MANAGE` |
| `PERSONA-PLATFORM-VERTICAL-EXPERT` | Defines new profiles (platform side) | `PERM-PLATFORM-PROFILE-DEFINE` |
| `PERSONA-PLATFORM-COMPLIANCE-OFFICER` | Maintains regulatory mappings | `PERM-PLATFORM-COMPLIANCE` |
| `PERSONA-AI-COPILOT` | Suggests profile based on description / catalog | `agent:profile:suggest` |
| `PERSONA-INDUSTRY-PLUGIN-DEVELOPER` | Builds plugin extending profile | partners.shopio.com (per `28`) |
| `PERSONA-AGENCY` | Configures multiple tenants napříč verticals | `PERM-INDUSTRY-PROFILE-MANAGE` per tenant |

---

## 3. Architecture: profile preset bundle

### 3.1 Bundle struktura

Industry profile = manifest (JSON/YAML) definující:

```yaml
code: fashion_apparel
display_name: Fashion & Apparel
description: Clothing, footwear, accessories
icon_url: /assets/profiles/fashion.svg
category: retail
region_codes: [EU, US, GLOBAL]
status: stable

# Field schemas (metafield definitions)
metafield_definitions:
  - resource: product
    code: size
    kind: select_multi
    label: Size
    options_source: predefined  # references option templates
    options_template: clothing_sizes_eu
    searchable: true
    facetable: true
    required_for_categories: [clothing]

  - resource: product
    code: material_composition
    kind: text_long
    label: Material composition
    required_for_categories: [clothing, footwear]
    eu_regulatory_basis: EU 1007/2011 (textile labeling)

  - resource: product_variant
    code: color
    kind: color_swatch
    required: true
    facetable: true

  - resource: product
    code: care_instructions
    kind: select_multi
    options: [machine_wash_30, hand_wash, dry_clean_only, do_not_bleach, ...]

  - resource: product
    code: fit
    kind: select
    options: [regular, slim, relaxed, oversized]

# Default categories (taxonomy)
default_categories:
  - slug: clothing
    name: Clothing
    children:
      - slug: tops
      - slug: bottoms
      - slug: dresses
      - slug: outerwear
      - slug: knitwear
      - slug: activewear
      - slug: underwear
      - slug: swimwear
  - slug: footwear
    children: [sneakers, boots, sandals, formal]
  - slug: accessories
    children: [bags, jewelry, hats, scarves, belts]

# Default page templates
default_pages:
  - slug: sizing-guide
    title: Sizing Guide
    template_blocks: [sizing_chart_block, fit_guide_block]
  - slug: care-instructions
    title: Care Instructions
  - slug: returns-policy
    title: Returns Policy
    template_blocks: [returns_policy_fashion_block]

# Default theme suggestions (per `26 §3.1`)
recommended_themes:
  - code: minimal_editorial
    reason: Clean grid suits fashion catalog
  - code: lookbook_lifestyle
    reason: Hero imagery, storytelling

# Recommended integrations (per `29`)
recommended_integrations:
  - code: heureka
    reason: CZ comparison shopping
    region_specific: CZ
  - code: glami
    reason: Fashion-specific feed
    region_specific: EU
  - code: meta_commerce
    reason: Instagram Shopping
  - code: tiktok_shop
    reason: Gen-Z fashion shoppers
  - code: klaviyo
    reason: Visual email + automation
  - code: trustpilot
    reason: Build social proof

# Default workflows
workflows:
  - code: returns
    settings:
      cooling_off_days: 14   # EU mandatory
      allow_size_exchange: true
      free_return_shipping: optional_per_tenant
      restocking_fee_percent: 0
  - code: shipping
    requires_signature_above_amount: 5000  # 5000 CZK = ~200 EUR
    free_shipping_threshold_amount: 100000  # 1000 CZK

# Business rules per vertical
business_rules:
  - code: clothing_returns_unworn_only
    description: "Returned clothing must be unworn with tags attached"
    enforcement: warn_buyer_pre_return
  - code: footwear_returns_box_required
    description: "Footwear returns require original box"

# Regulatory checklist
regulatory_checklist:
  - code: textile_labeling_eu
    description: Material composition labeling per EU 1007/2011
    mandatory: true
  - code: gpsr_2024
    description: General Product Safety Regulation manufacturer info
    mandatory: true
  - code: ce_marking_pp
    description: CE marking for PPE / safety apparel
    mandatory_if_categories: [ppe, safety_wear]

# Recommended AI use cases (per `33`)
ai_use_cases_emphasis:
  - vision_product_extract_attributes
    reason: Auto-fill color/pattern/style from product photos
  - content_gen_product_description
    reason: Generate from variants + brand voice
  - ai_outfit_complete
    reason: Complete-the-look recommendations
  - ai_size_recommend
    reason: Size suggestions from past purchases

# AI Copilot system prompt augmentation
copilot_brand_voice_default: |
  Speak with fashion-forward, trend-aware tone. Use sensory language.
  Highlight materials, fit, and styling possibilities.

# Vertical-specific UI hints
ui_hints:
  storefront_collection_layout: image_dominant_grid
  product_image_aspect_ratio: 3:4_portrait
  variant_picker_kind: visual_swatches  # vs dropdown
  show_size_guide_link: true
```

### 3.2 Profile activation flow

```
[Tenant onboarding step 1: "What kind of business?"]
   - Search or browse vertical catalog
   - AI suggests based on tenant description ("I sell handmade ceramic bowls" → Crafts + Home)
        ↓
[Confirm + customize]
   - Pick 1-3 profiles
   - Preview what will be configured
        ↓
[Activate]
   - JOB-APPLY-INDUSTRY-PROFILE for each:
     - Create metafield definitions (`MetafieldDefinition` per `04`)
     - Create default categories (per `07`) if tenant catalog empty
     - Create default CMS pages (per `32`)
     - Recommend (don't auto-install) integrations
     - Suggest recommended theme
     - Apply default workflow settings
     - Create regulatory checklist tasks
     - Apply AI Copilot brand voice
        ↓
[Tenant continues onboarding]
   - Existing data not overwritten; preset is additive
```

### 3.3 Multi-profile composition

When tenant aktivuje Fashion + Crafts:
- Metafield definitions union (no duplicates)
- Categories merged (Crafts adds /handmade subtree to existing structure)
- Templates: profile precedence ordering (first activated wins ties)
- Recommendations combined + deduplicated
- Regulatory checklist union
- AI brand voice merged (user prompted to refine)

### 3.4 Profile versioning

Profile manifest versioned semver. Platform updates manifest → tenant notified s diff:
- New fields added → opt-in to install
- Removed fields → kept (already in tenant catalog; just not recommended for new)
- Categories rename → manual confirmation
- Regulatory updates → highlighted (compliance impact)

Tenant můžou stay on old version OR opt-in to upgrades.

### 3.5 Custom profiles

Enterprise tenants OR agencies můžou publikovat vlastní profil (per `28-developer-platform.md` plugin ecosystem):
- Private profile (one tenant)
- Shared profile (within agency tenants)
- Public profile (marketplace; reviewed)

---

## 4. Data models

### 4.1 `industry_profiles` (platform catalog)

```sql
CREATE TABLE industry_profiles (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  code TEXT NOT NULL,                                                                                                                                                                                                                                                                                                                                                                                                                                              -- 'fashion_apparel','food_beverage','health_beauty'
  display_name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon_url TEXT NULL,
  -- categorization
  category TEXT NOT NULL CHECK (category IN ('retail','services','digital','b2b','marketplace','custom')),
  region_codes TEXT[] NOT NULL DEFAULT '{}',
  -- publishing
  publisher_kind TEXT NOT NULL CHECK (publisher_kind IN ('first_party','third_party_certified','community')) DEFAULT 'first_party',
  publisher_account_id UUID NULL,                                                                                                                                                                                                                                                                                                                                                                                                                                          -- if third-party
  -- bundle
  manifest_version TEXT NOT NULL,                                                                                                                                                                                                                                                                                                                                                                                                                                            -- semver
  manifest JSONB NOT NULL,                                                                                                                                                                                                                                                                                                                                                                                                                                                      -- full preset definition (per `3.1`)
  -- status
  status TEXT NOT NULL CHECK (status IN ('draft','beta','stable','deprecated','retired')) DEFAULT 'stable',
  -- visibility
  visibility TEXT NOT NULL CHECK (visibility IN ('public','private_to_publisher','agency_shared')) DEFAULT 'public',
  -- stats
  active_tenants_count INTEGER NOT NULL DEFAULT 0,
  average_rating NUMERIC(3,2) NULL,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_industry_profiles_code UNIQUE (code)
);

CREATE INDEX idx_industry_profiles_status ON industry_profiles (status) WHERE status IN ('stable','beta');
CREATE INDEX idx_industry_profiles_category ON industry_profiles (category) WHERE status = 'stable';
```

### 4.2 `tenant_industry_profiles` (per-tenant activations)

```sql
CREATE TABLE tenant_industry_profiles (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES industry_profiles(id),
  profile_code TEXT NOT NULL,                                                                                                                                                                                                                                                                                                                                                                                                                                                                  -- denormalized
  installed_manifest_version TEXT NOT NULL,
  -- activation choices
  installed_metafield_definitions TEXT[] NULL,                                                                                                                                                                                                                                                                                                                                                                                                                                                  -- codes of metafields tenant chose to install
  skipped_metafield_definitions TEXT[] NULL,
  installed_categories BOOLEAN NOT NULL DEFAULT true,
  installed_default_pages BOOLEAN NOT NULL DEFAULT true,
  applied_workflow_defaults BOOLEAN NOT NULL DEFAULT true,
  applied_ai_brand_voice BOOLEAN NOT NULL DEFAULT true,
  -- status
  status TEXT NOT NULL CHECK (status IN ('installing','active','disabled','upgrading','removing')) DEFAULT 'installing',
  -- audit
  installed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  installed_by_user_id UUID NULL,
  last_upgraded_at TIMESTAMPTZ NULL,
  disabled_at TIMESTAMPTZ NULL,
  removed_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_tenant_industry_profiles UNIQUE (tenant_id, profile_id)
);

CREATE INDEX idx_tenant_industry_profiles_active ON tenant_industry_profiles (tenant_id) WHERE status = 'active';
```

### 4.3 `regulatory_checklists`

```sql
CREATE TABLE regulatory_checklists (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  code TEXT NOT NULL,                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            -- 'textile_labeling_eu','ce_marking_toys'
  display_name TEXT NOT NULL,
  description_html TEXT NOT NULL,
  regulatory_basis TEXT NULL,                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            -- 'EU 1007/2011','EN 71-1:2014'
  region_codes TEXT[] NOT NULL,
  applies_to_categories TEXT[] NULL,                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            -- if specific category triggers
  applies_to_product_metafield TEXT NULL,                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            -- specific metafield triggers
  mandatory BOOLEAN NOT NULL DEFAULT false,
  severity TEXT NOT NULL CHECK (severity IN ('info','recommended','critical')) DEFAULT 'recommended',
  checklist_items JSONB NOT NULL,                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  -- [{ id, label, kind: 'manual_attest'|'metafield_required'|'doc_upload'|'integration_check', ...}]
  effective_from DATE NOT NULL DEFAULT now()::date,
  effective_until DATE NULL,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_regulatory_checklists_code UNIQUE (code)
);
```

### 4.4 `tenant_regulatory_checklist_status`

```sql
CREATE TABLE tenant_regulatory_checklist_status (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  checklist_id UUID NOT NULL REFERENCES regulatory_checklists(id),
  checklist_code TEXT NOT NULL,                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          -- denormalized
  status TEXT NOT NULL CHECK (status IN ('pending','in_progress','completed','dismissed','not_applicable')) DEFAULT 'pending',
  status_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  attestation_user_id UUID NULL,                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            -- who attested
  attestation_notes TEXT NULL,
  items_completed JSONB NULL,                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  -- per-item status
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_tenant_regulatory_checklist UNIQUE (tenant_id, checklist_id)
);

CREATE INDEX idx_tenant_regulatory_checklist_status_pending ON tenant_regulatory_checklist_status (tenant_id) WHERE status IN ('pending','in_progress');
```

### 4.5 Vztahy

```
industry_profiles (1)──(N) tenant_industry_profiles
tenants (1)──(N) tenant_industry_profiles
tenants (1)──(N) tenant_regulatory_checklist_status
regulatory_checklists (1)──(N) tenant_regulatory_checklist_status
industry_profiles → references → metafield_definitions (per `04`)
industry_profiles → references → recommended integrations (per `29`)
industry_profiles → references → recommended themes (per `26`)
```

---

## 5. Profile catalog

Per `5.x` MVP first-party profiles. Each detailed in §6.

| Code | Display name | Category | Region | Status |
|---|---|---|---|---|
| `fashion_apparel` | Fashion & Apparel | retail | EU/GLOBAL | stable |
| `food_beverage` | Food & Beverage | retail | EU | stable |
| `health_beauty` | Health & Beauty | retail | EU/GLOBAL | stable |
| `electronics` | Electronics | retail | EU/GLOBAL | stable |
| `books_media` | Books & Media | retail | EU/GLOBAL | stable |
| `furniture_home` | Furniture & Home | retail | EU/GLOBAL | stable |
| `jewelry_watches` | Jewelry & Watches | retail | EU/GLOBAL | stable |
| `wine_spirits` | Wine & Spirits | retail | EU | stable |
| `toys_kids` | Toys & Kids | retail | EU/GLOBAL | stable |
| `sports_outdoor` | Sports & Outdoor | retail | EU/GLOBAL | stable |
| `pet_supplies` | Pet Supplies | retail | EU/GLOBAL | stable |
| `b2b_industrial` | B2B Industrial | b2b | EU/GLOBAL | stable |
| `services_bookings` | Services & Bookings | services | EU/GLOBAL | beta (Fáze 2) |
| `digital_products` | Digital Products | digital | GLOBAL | stable |
| `crafts_handmade` | Crafts & Handmade | retail/marketplace | EU/GLOBAL | stable |

Fáze 3+ additional:
- `automotive_parts`, `office_supplies`, `pharmacy_otc`, `groceries_online`, `art_collectibles`, `musical_instruments`, `firearms_regulated` (where legal), `cannabis_cbd` (where legal), `subscription_box`, `events_tickets`

---

## 6. Per-profile detail

### 6.1 Fashion & Apparel

**Code:** `fashion_apparel`

**Metafields (product):**
- `size` (select_multi) — EU/UK/US/numeric scales per options template
- `color` (color_swatch) — per variant
- `material_composition` (text_long) — required per EU 1007/2011
- `care_instructions` (select_multi) — care symbols
- `fit` (select) — regular/slim/relaxed/oversized
- `season` (select) — SS/AW/all_season
- `target_gender` (select) — women/men/unisex/kids
- `country_of_origin` (select) — ISO 3166
- `sustainability_certifications` (select_multi) — GOTS, OEKO-TEX, Fair Trade

**Default categories:** Clothing → Tops/Bottoms/Dresses/Outerwear/Knitwear/Activewear/Underwear/Swimwear; Footwear → Sneakers/Boots/Sandals/Formal; Accessories → Bags/Jewelry/Hats/Scarves/Belts.

**Default pages:** Sizing Guide, Care Instructions, Returns Policy, About Our Brand.

**Recommended themes:** `minimal_editorial`, `lookbook_lifestyle`.

**Recommended integrations:** Heuréka (CZ), Glami (EU fashion-specific), Meta Commerce (Instagram Shopping), TikTok Shop, Klaviyo, Trustpilot.

**Workflows:**
- Returns: 14d cooling-off + size exchange + unworn-with-tags requirement
- Free shipping above 1000 CZK / 40 EUR
- Default shipping carriers: Zásilkovna, PPL

**Regulatory:**
- Textile labeling (EU 1007/2011) — mandatory
- GPSR 2024 — mandatory manufacturer info
- CE marking — if PPE / safety apparel category

**AI emphasis:** Vision extraction (color/pattern), description generation, outfit-complete, size recommendation.

**UI hints:** 3:4 portrait images, visual color swatches, size guide link prominent.

---

### 6.2 Food & Beverage

**Code:** `food_beverage`

**Metafields (product):**
- `allergens` (select_multi) — gluten/dairy/eggs/peanuts/tree_nuts/soy/fish/shellfish/celery/mustard/sesame/sulphites/lupin/molluscs (EU 14 allergens)
- `ingredients_list` (text_long) — required per EU 1169/2011
- `nutritional_info` (json) — per 100g/ml: energy, fat, saturated_fat, carbs, sugars, protein, salt
- `expiry_kind` (select) — best_before / use_by / production_date_only
- `storage_temperature` (select) — ambient/refrigerated/frozen
- `origin_country` (text)
- `organic_certified` (boolean) — EU organic logo
- `vegan` / `vegetarian` (boolean)
- `kosher` / `halal` (boolean) — for relevant markets
- `gluten_free` (boolean)
- `weight_net_g` (number)

**Variant fields:**
- `batch_number` — per `09-inventory.md` cross-ref
- `expiry_date` (date)

**Default categories:** Pantry → Beverages/Snacks/Baking/Spices; Fresh → Bakery/Dairy/Produce; Frozen; Beverages → Coffee/Tea/Juices/Sparkling.

**Default pages:** Allergens Info, Storage Instructions, Cold Chain Policy.

**Recommended themes:** `food_marketplace`, `gourmet_storyteller`.

**Recommended integrations:** Pohoda (CZ accounting), Heuréka, ČP / Zásilkovna chlazené balíky (Fáze 2), Mailchimp.

**Workflows:**
- Returns: EU cooling-off applies but perishables exempt; clearly disclose
- Shipping: cold chain — refrigerated/frozen flag triggers temperature-controlled carrier selection
- Expiry alerts: notify ops 14d before product expiry to discount/withdraw

**Regulatory:**
- EU 1169/2011 — food labeling (mandatory)
- EU Organic Logo — if organic certified
- Country of origin labeling
- Allergen highlighting (bold)

**AI emphasis:** Allergen extraction from ingredient list (vision), ingredient translation, nutritional analysis, recipe suggestions for storefront.

**UI hints:** Allergen badges prominent, expiry date visible, "may contain traces of..." disclaimer auto-generated.

**Cross-ref:** `15-tax-compliance.md` — food often reduced VAT rate (CZ 12%); profile auto-applies.

---

### 6.3 Health & Beauty

**Code:** `health_beauty`

**Metafields (product):**
- `inci_ingredients` (text_long) — INCI list per EU 1223/2009 (cosmetics)
- `skin_type` (select_multi) — normal/dry/oily/combination/sensitive
- `hair_type` (select_multi) — straight/wavy/curly/coily
- `concerns_addressed` (select_multi) — anti_aging/acne/hydration/...
- `volume_ml` / `volume_g` (number)
- `pao` (text) — "Period After Opening" symbol (e.g., "12M")
- `expiry_date` (date)
- `batch_number` (per variant)
- `cruelty_free_certified` (boolean)
- `vegan` (boolean)
- `dermatologist_tested` (boolean)
- `clinically_tested` (boolean)
- `country_of_manufacture` (text)
- `responsible_person_eu` (text) — EU 1223/2009 mandatory

**Default categories:** Skincare → Cleansers/Moisturizers/Serums/Masks/SPF; Makeup → Face/Eyes/Lips; Haircare; Fragrance; Body; Wellness Supplements (separate compliance).

**Default pages:** Ingredient Transparency, How to Choose, Sustainability, Returns Policy.

**Recommended themes:** `clean_beauty_minimal`, `editorial_wellness`.

**Recommended integrations:** Heuréka, Glami, Mailchimp, Klaviyo, Trustpilot.

**Workflows:**
- Returns: opened cosmetics may not be returnable for hygiene (clearly disclose; exception per EU cooling-off)
- Expiry alerts (per Food)
- Batch tracking mandatory (recall capability)

**Regulatory:**
- EU 1223/2009 (cosmetics) — INCI list, responsible person, PAO
- CLP labeling for chemical products
- Supplement regulation (different VAT, claims restrictions)
- Notification CPNP (Cosmetic Product Notification Portal) — pre-market, tenant-managed (Shopio doesn't notify EU)

**AI emphasis:** Ingredient analysis (extract from photo + classify), skin-type-based recommendations, content gen (formal scientific tone vs friendly).

**UI hints:** "Free from..." badges, INCI accessible (toggle reveal), PAO icon next to add-to-cart.

---

### 6.4 Electronics

**Code:** `electronics`

**Metafields (product):**
- `ean` / `upc` (text) — barcode, indexable
- `manufacturer_part_number` (text)
- `model_number` (text)
- `warranty_period_months` (number) — minimum 24 EU
- `serial_number_tracking` (boolean) — per-variant serial numbers
- `power_supply` (text) — voltage/wattage
- `dimensions_mm` (json) — width/depth/height
- `weight_grams` (number)
- `connectivity` (select_multi) — wifi/bluetooth/usb_c/...
- `compatibility` (select_multi) — referenced products
- `box_contents` (text_long)
- `manual_pdf_media_id` (media)
- `datasheet_pdf_media_id` (media)
- `energy_class` (select) — A/B/C/...
- `weee_category` (select) — for WEEE compliance
- `repairability_score` (number) — French index; EU expansion 2026
- `co2_footprint` (text) — climate label voluntary

**Variant fields:**
- `serial_number` (text; per-unit)
- `imei` (text; for phones)

**Default categories:** Computers → Laptops/Desktops/Tablets/Accessories; Phones; Audio → Headphones/Speakers; TV & Home Cinema; Smart Home; Gaming; Cameras.

**Default pages:** Warranty Policy, Repair Guide, Manuals & Drivers, Trade-In Program.

**Recommended themes:** `tech_grid`, `spec_focused`.

**Recommended integrations:** Heuréka, Zboží.cz, Google Shopping, Heureka Recenze, Trustpilot, Pohoda (CZ).

**Workflows:**
- Warranty registration: post-purchase email s registrace odkazem
- Returns: 14d cooling-off + extra 14d if used (per merchant policy)
- DOA (Dead on Arrival) handling — separate fast track
- Repair vs replacement workflow

**Regulatory:**
- WEEE Directive — recycling info, "crossed-out bin" symbol
- CE marking — mandatory
- RoHS (hazardous substances)
- EU Battery Regulation (2027 enforcement)
- Energy labeling (energy class)
- Right-to-Repair Directive

**AI emphasis:** Spec extraction from manufacturer page, comparison generation, compatibility check, "Will this work with my X?" Q&A.

**UI hints:** Spec table prominent, comparison tool, downloadable manuals tab.

---

### 6.5 Books & Media

**Code:** `books_media`

**Metafields (product):**
- `isbn_10` / `isbn_13` (text) — required for books
- `author` (text) — multiple via tags
- `publisher` (text)
- `publication_year` (number)
- `pages` (number)
- `language` (select) — BCP-47
- `binding` (select) — hardcover/paperback/ebook/audiobook
- `format` (select) — physical/ebook_epub/ebook_pdf/audiobook_mp3
- `age_rating` (select) — general/12+/15+/18+
- `genre` (select_multi)
- `series_name` (text)
- `series_position` (number)
- `original_language` (text) — for translations
- `translator` (text)
- `narrator` (text) — for audiobooks
- `runtime_minutes` (number) — for audiobooks/film
- `file_size_mb` (number) — digital

**For media (CDs/DVDs/Blu-ray):**
- `region_code` (text)
- `duration_minutes` (number)
- `subtitles_available` (select_multi)
- `audio_languages` (select_multi)

**Default categories:** Books → Fiction/Non-fiction/Children/Academic; Audiobooks; eBooks; Music CD; Films DVD/Blu-ray; Video Games.

**Default pages:** New Releases, Bestsellers, Genre Hubs, Gift Cards.

**Recommended themes:** `bookstore_classic`, `media_grid`.

**Recommended integrations:** Heuréka, Zboží.cz, Mailchimp, Google Books for cover images / metadata enrichment (Fáze 2).

**Workflows:**
- Returns: 14d cooling-off; digital downloads typically excluded if downloaded (must disclose at checkout)
- Pre-orders supported (per `06`)
- Subscriptions for monthly book box (`24-subscriptions.md`)

**Regulatory:**
- Fixed book price laws (some EU countries — DE, FR; not CZ as of 2026)
- Age rating display (PEGI for games; mandatory)
- ISBN registration (publisher-managed)
- VAT reduced rate on books (CZ 10%, EU varies)

**AI emphasis:** Plot summary generation, similar-book recommendations (semantic via embeddings), audiobook excerpt selection, AI search ("find me a mystery novel set in 1920s Prague").

**UI hints:** Cover-dominant layout, author landing pages, "Look inside" preview.

---

### 6.6 Furniture & Home

**Code:** `furniture_home`

**Metafields (product):**
- `dimensions_assembled_mm` (json) — W/D/H
- `dimensions_packed_mm` (json)
- `weight_kg` (number)
- `material` (text)
- `color` (per variant)
- `assembly_required` (boolean)
- `assembly_time_minutes` (number)
- `assembly_tools_required` (text_long)
- `max_load_kg` (number) — for shelves/chairs
- `style` (select) — modern/scandi/industrial/...
- `room` (select_multi) — living/bedroom/kitchen/office/outdoor
- `warranty_years` (number)
- `lead_time_days` (number) — for made-to-order
- `country_of_manufacture` (text)
- `eu_construction_products_regulation_doc` (media) — for relevant categories
- `fsc_certified` (boolean) — sustainable timber
- `flammability_class` (select) — for upholstery

**Default categories:** Living Room/Bedroom/Dining/Office/Outdoor/Kitchen/Bath/Decor/Lighting.

**Default pages:** Delivery & Assembly, Design Services, Care Guide, Trade Program (B2B).

**Recommended themes:** `furniture_showcase`, `lifestyle_storyteller`.

**Recommended integrations:** Pohoda (CZ), DPD oversize, Klaviyo, Trustpilot, 3D rendering integrations (Fáze 3+).

**Workflows:**
- Returns: 14d cooling-off + extended for made-to-order (often non-returnable; disclose)
- Shipping: oversized handling; threshold-based carrier selection (per `14`)
- White-glove delivery service (Fáze 2): paid add-on
- Made-to-order lead time disclosure
- Installation service add-on (Fáze 2)

**Regulatory:**
- EU Construction Products Regulation (305/2011) — for relevant items
- Flammability standards (BS 5852 UK; EN 1021 EU)
- FSC for timber claims
- GPSR 2024

**AI emphasis:** Style classification from photo, AR-ready 3D model suggestions (Fáze 3+), "Will this fit in my room?" interactive tool.

**UI hints:** Large-image lifestyle layouts, dimension visualizer, room visualization.

---

### 6.7 Jewelry & Watches

**Code:** `jewelry_watches`

**Metafields (product):**
- `material_metal` (select) — gold/silver/platinum/stainless_steel/...
- `purity_grade` (text) — "925" silver, "750" gold (18k)
- `weight_grams` (number)
- `gemstone_kind` (select_multi) — diamond/sapphire/...
- `gemstone_carat` (number)
- `gemstone_certificate_url` (media) — GIA / IGI cert
- `setting_type` (text)
- `ring_size_eu` (select_multi)
- `chain_length_cm` (number)
- `clasp_type` (text)
- `warranty_years` (number)
- `made_to_order` (boolean)
- `engravable` (boolean)
- `engraving_max_chars` (number)
- `hallmark` (text) — country hallmark stamp
- `watch_movement` (select) — automatic/quartz/mechanical
- `watch_water_resistance_m` (number)
- `case_diameter_mm` (number)
- `band_material` (text)
- `band_color` (per variant)

**Default categories:** Rings/Necklaces/Earrings/Bracelets/Watches → Men's/Women's/Unisex.

**Default pages:** Sizing Guide, Care for Jewelry, Certification & Authentication, Custom Engraving, Returns.

**Recommended themes:** `luxury_minimal`, `boutique_dark`.

**Recommended integrations:** Mailchimp, Klaviyo, Trustpilot, GIA database (Fáze 2 — premium).

**Workflows:**
- Returns: 14d cooling-off but engraved/custom typically non-returnable (disclose)
- Insurance options at checkout (Fáze 3+)
- Authentication certificate delivery
- Resizing service (Fáze 2)

**Regulatory:**
- Precious Metal Hallmarking — country-specific (CZ Puncovní úřad)
- Kimberley Process (diamond traceability)
- CITES (for protected materials like coral, ivory — banned)
- GPSR 2024

**AI emphasis:** Style matching, gift recommendations by occasion, sizing suggestions.

**UI hints:** Premium photography (close-ups + lifestyle), 360° viewer, ring size guide tool.

---

### 6.8 Wine & Spirits

**Code:** `wine_spirits`

**Metafields (product):**
- `abv_percent` (number) — alcohol by volume
- `volume_ml` (number)
- `wine_kind` (select) — red/white/rosé/sparkling/dessert/fortified
- `spirit_kind` (select) — whisky/vodka/rum/gin/...
- `vintage` (number) — year
- `region` (text) — Bordeaux, Tokaj, Moravia, ...
- `denomination` (text) — AOC, DOCG, VDP
- `grape_variety` (select_multi) — Cabernet Sauvignon, ...
- `tasting_notes` (text_long)
- `food_pairing` (text)
- `producer` (text)
- `serving_temperature_c` (number)
- `aging_years` (number)
- `cask_type` (text) — for whisky/rum
- `awards` (text_long)
- `sweetness_level` (select) — dry/off_dry/medium/sweet
- `acidity_level` (select)
- `tannin_level` (select)
- `body` (select) — light/medium/full

**Default categories:** Wine → Red/White/Rosé/Sparkling/Dessert/Fortified; Spirits → Whisky/Vodka/Rum/Gin/Brandy/Liqueur; Beer; Mixers.

**Default pages:** Sommelier Picks, Region Guides, Pairing Guide, Age Verification Info.

**Recommended themes:** `wine_cellar`, `editorial_culinary`.

**Recommended integrations:** Pohoda (CZ — special VAT for alcohol), Heuréka, Mailchimp, Vivino (Fáze 3+).

**Workflows:**
- Age gate at storefront entry (mandatory; per `RULE-IND-008`)
- Delivery requires adult signature (per `RULE-IND-009`)
- Geo-restrictions per jurisdiction (some EU countries restrict cross-border alcohol sales)
- Excise duty handling (per `15-tax-compliance.md` extended)
- Pre-orders for new vintages

**Regulatory:**
- EU Wine Regulation (1308/2013) — labeling, denomination
- Mandatory ABV labeling
- Allergen labeling (sulphites)
- Age gate (18+ CZ; varies EU 16-21)
- Excise duty stamps (per country)
- Cross-border restrictions (Article 33 directive)
- Marketing restrictions (no targeting minors)

**AI emphasis:** Tasting notes generation, food pairing suggestions, "Find me a wine like X but cheaper" semantic search.

**UI hints:** Vintage chart prominent, age gate first-visit, "Add to cellar" wishlist, sommelier badge.

---

### 6.9 Toys & Kids

**Code:** `toys_kids`

**Metafields (product):**
- `age_range_min_months` (number)
- `age_range_max_months` (number)
- `age_warning` (text) — "Not suitable for children under 3" mandatory if small parts
- `safety_certifications` (select_multi) — CE, EN 71-1, EN 71-2, EN 71-3, ASTM F963 (US)
- `materials` (text_long)
- `small_parts_warning` (boolean) — choking hazard
- `educational_value` (select_multi) — motor_skills, language, math, creativity
- `requires_assembly` (boolean)
- `requires_batteries` (boolean)
- `batteries_kind` (text) — AAA, AA, button
- `batteries_included` (boolean)
- `dimensions_mm` (json)
- `weight_g` (number)
- `country_of_manufacture` (text)
- `notified_body_id` (text) — for CE-marked toys

**Default categories:** By age (0-12m / 1-3y / 3-6y / 6-12y / Tweens); By type (Plush, Educational, Outdoor, Arts & Crafts, Construction, Vehicles, Dolls, Games & Puzzles).

**Default pages:** Safety Standards, Age-Appropriate Guide, Educational Picks, Gift Finder.

**Recommended themes:** `playful_colorful`, `nursery_pastel`.

**Recommended integrations:** Heuréka, Heuréka Recenze, Mailchimp, Klaviyo, Trustpilot.

**Workflows:**
- Returns: 14d cooling-off; opened toys generally returnable (vs. cosmetics exception)
- Safety recalls workflow — emergency communication channels
- Gift wrapping option (Fáze 2)
- "Not for Christmas" delivery dates (clearly disclose if outside window)

**Regulatory:**
- EU Toy Safety Directive 2009/48/EC (EN 71 series)
- CE marking — mandatory
- GPSR 2024
- Warnings labeling — "small parts" mandatory if applicable
- REACH Regulation (chemical safety)
- Battery Directive

**AI emphasis:** Age-appropriate recommendations ("My niece is 4 — what should I buy?"), gift suggestion, educational alignment.

**UI hints:** Age badge prominent, safety warnings visible, gift wrapping CTA at cart.

---

### 6.10 Sports & Outdoor

**Code:** `sports_outdoor`

**Metafields (product):**
- `sport_kind` (select_multi) — running/cycling/hiking/swimming/skiing/...
- `experience_level` (select) — beginner/intermediate/advanced/pro
- `gender_fit` (select) — male/female/unisex
- `size` (select_multi) — sport-specific scales
- `weight_g` (number)
- `dimensions_mm` (json)
- `material` (text)
- `weather_rating` (select) — fair/rainy/cold/winter/extreme
- `waterproof_rating` (text) — IPX5, IPX7 for electronics; mm H2O for textiles
- `breathability_rating` (text)
- `temperature_rating_c` (number) — for sleeping bags
- `feature_tags` (select_multi) — anti_slip, breathable, quick_dry, ...
- `safety_certifications` (select_multi) — CE per category, ECE 22.05 (helmets)
- `repairability` (text)

**Categories with extra fields:**
- Bikes: `frame_material`, `frame_size_cm`, `wheel_size_inch`, `gears`, `brake_kind`
- Skis: `length_cm`, `width_mm`, `binding_kind`
- Climbing: `weight_rating_kg`, `certification_uiaa`

**Default categories:** Running, Cycling, Hiking & Camping, Water Sports, Winter Sports, Team Sports, Fitness, Outdoor Recreation, Cycling Apparel, Footwear (sport-specific).

**Default pages:** Size & Fit Guide, Activity Guides, Trail Picks, Sustainability, Returns.

**Recommended themes:** `active_lifestyle`, `expedition_grid`.

**Recommended integrations:** Heuréka, Glami, Strava (Fáze 3+ social), Mailchimp, Klaviyo.

**Workflows:**
- Returns: 14d cooling-off; technical equipment may require unused-with-tags
- Bike assembly (delivered partially assembled — disclose)
- Rental option (Fáze 3+)
- Trade-in for skis/bikes (Fáze 3+)

**Regulatory:**
- CE marking — for PPE (helmets, climbing gear, life vests)
- ECE R22 — motorcycle helmets
- UIAA standards — climbing equipment
- GPSR 2024

**AI emphasis:** Fit recommendation by sport + body type, gear bundles ("Starter kit for mountain biking"), seasonal recommendations.

**UI hints:** Activity-based filtering, fit guide per discipline, weather-rating icons.

---

### 6.11 Pet Supplies

**Code:** `pet_supplies`

**Metafields (product):**
- `pet_kind` (select) — dog/cat/small_animal/bird/fish/reptile/horse
- `pet_breed_size` (select_multi) — toy/small/medium/large/giant
- `pet_age_stage` (select) — puppy/kitten/adult/senior
- `food_kind` (select) — dry_kibble/wet_food/treats/supplements
- `protein_source` (select_multi) — chicken/beef/fish/lamb/duck/vegetarian
- `grain_free` (boolean)
- `weight_kg` (number)
- `feeding_guide_per_day_grams_per_kg` (json) — feeding chart
- `ingredients` (text_long)
- `analytical_constituents` (json) — protein %, fat %, fibre %, ash %
- `vitamin_mineral_supplements` (json)
- `country_of_manufacture` (text)
- `expiry_date` (date)
- `batch_number` (per variant)
- `prescription_required` (boolean) — for medications
- `manufacturer_authorization` (text) — for veterinary products

**Default categories:** Dog → Food/Treats/Toys/Accessories/Health; Cat (mirror); Small Animals; Birds; Aquatics; Reptiles; Equine.

**Default pages:** Feeding Guide, Vet-Recommended, Subscription Box, Pet Health Info.

**Recommended themes:** `pet_friendly_warm`, `vet_clinical`.

**Recommended integrations:** Heuréka, Pohoda, Mailchimp, Klaviyo, Trustpilot, Zásilkovna.

**Workflows:**
- **Subscriptions** (per `24-subscriptions.md`) — central use case: auto-replenish pet food monthly
- Returns: 14d cooling-off; opened food typically non-returnable
- Recurring delivery discount
- Pet profile per customer (multiple pets per account)
- Veterinary prescription verification — flag products requiring vet auth

**Regulatory:**
- EU Feed Regulation (767/2009) — pet food labeling
- EU Veterinary Medicinal Products Regulation 2019/6 — for medications
- Mandatory labeling: composition, additives, feeding guide
- GPSR 2024

**AI emphasis:** Feeding amount calculator, breed-specific recommendations, "Time to reorder?" predictive replenishment.

**UI hints:** Pet profile saver, subscription CTA prominent ("Save 10% on auto-delivery"), feeding chart.

---

### 6.12 B2B Industrial

**Code:** `b2b_industrial`

**Metafields (product):**
- `manufacturer_part_number` (text)
- `oem_part_number` (text) — cross-reference OEM equivalent
- `ean` / `upc` (text)
- `technical_drawing_pdf` (media)
- `datasheet_pdf` (media)
- `material_safety_data_sheet_pdf` (media) — MSDS / SDS per CLP
- `dimensions_mm` (json)
- `weight_kg` (number)
- `material` (text)
- `tolerance` (text) — manufacturing tolerance
- `compliance_standards` (select_multi) — ISO_9001, ISO_14001, ATEX, IECEx, ...
- `industries_served` (select_multi) — automotive/aerospace/oil_gas/...
- `minimum_order_quantity` (number)
- `bulk_pricing_tier_1_min` / `bulk_pricing_tier_1_price` (json)
- `lead_time_days` (number)
- `country_of_origin` (text)
- `harmonized_tariff_code` (text) — HS code for customs
- `eccn` (text) — Export Control Classification Number
- `hazmat_classification` (text)

**Default categories:** Mechanical Components/Electrical/Pneumatics & Hydraulics/Tools/Safety Equipment/Packaging/Office & Industrial/Spare Parts.

**Default pages:** Request Quote, Volume Pricing, Trade Account Application, Technical Resources, Compliance Docs.

**Recommended themes:** `industrial_catalog`, `technical_spec_focused`.

**Recommended integrations:** Pohoda, iDoklad, Money S3 (CZ accounting), SAP B1 (Fáze 3+), Microsoft Dynamics (Fáze 3+), EDI integrations (Fáze 3+).

**Workflows:**
- **B2B complete** (per `21-b2b-complete.md`) — central: company accounts, RFQ, quotes, contracts, NET 30/60/90 terms, credit limits, multi-buyer approval
- Bulk pricing tiers
- Minimum order quantity enforcement
- Hazmat shipping handling
- Industrial returns / RMA / warranty workflows

**Regulatory:**
- REACH (chemicals)
- RoHS
- ATEX (explosive atmospheres)
- IECEx
- CE marking per category
- Customs documentation (HS codes, ECCN for export controls)
- SDS sheets per CLP

**AI emphasis:** Cross-reference (find OEM equivalent), spec extraction from PDFs, BOM (bill of materials) suggestion, compatibility verification.

**UI hints:** Spec table dominant, "Add to quote" CTA, bulk pricing matrix, downloadable technical resources tab, trade pricing visible only logged-in B2B customers.

**Cross-ref:** Heavy reliance on `21-b2b-complete.md`.

---

### 6.13 Services & Bookings

**Code:** `services_bookings`

**Status:** Beta (Fáze 2 launch — requires booking domain implementation).

**Metafields (product=service):**
- `service_kind` (select) — consultation/class/treatment/repair/installation/...
- `duration_minutes` (number)
- `location_kind` (select) — at_location/customer_location/remote
- `provider_user_ids` (uuid[]) — staff members
- `capacity_per_session` (number) — group classes
- `required_resources` (text_long) — equipment, room
- `prep_time_minutes` (number) — before
- `cleanup_time_minutes` (number) — after
- `cancellation_policy_hours_min` (number) — min hours notice
- `requires_intake_form` (boolean)
- `provider_qualifications` (text_long)
- `insurance_required` (boolean)
- `materials_included` (text)
- `additional_costs_disclosure` (text)

**Default categories:** Consultation/Health & Wellness/Beauty/Education & Coaching/Repair & Installation/Events & Workshops/Personal Care.

**Default pages:** Book a Service, Our Team, Locations, Cancellation Policy.

**Recommended themes:** `services_appointment`, `wellness_calendar`.

**Recommended integrations:** Calendly (Fáze 3+), Google Calendar / Outlook (Fáze 2), Pohoda, Mailchimp.

**Workflows:**
- **Booking calendar** (Fáze 2 booking domain)
- Reminders email + SMS
- Rescheduling self-service
- Cancellation policy enforcement (refund or fee per hours notice)
- No-show tracking
- Recurring sessions (per `24-subscriptions.md` — monthly massage subscription)
- Intake forms (per `32` cms_forms)
- Group classes capacity tracking
- Multi-provider scheduling

**Regulatory:**
- Healthcare services (where applicable) — extra requirements
- Insurance (professional liability disclosed)
- Privacy stricter for health appointments (GDPR Article 9 — special category data)
- Cancellation policy must be clear (consumer protection)

**AI emphasis:** Service recommendation by goal, intake form analysis, optimal scheduling suggestions.

**UI hints:** Calendar-centric layout, provider photos, intake form gated.

---

### 6.14 Digital Products

**Code:** `digital_products`

**Metafields (product):**
- `product_kind` (select) — software/ebook/music/video/template/font/preset/course/api_subscription
- `delivery_kind` (select) — instant_download/email_delivery/license_key/streaming_access/api_key
- `file_size_mb` (number)
- `file_format` (text)
- `download_limit_count` (number) — max downloads per purchase
- `download_expiry_days` (number) — link valid for N days
- `license_kind` (select) — single_user/multi_user/commercial/extended/lifetime/subscription
- `license_terms_html` (text_long)
- `digital_rights_management` (select) — none/watermark/drm
- `system_requirements` (text_long)
- `requires_activation` (boolean)
- `activation_kind` (select) — license_key/account_link/online_check
- `version` (text)
- `last_updated_at` (date)
- `support_included` (boolean)
- `support_period_months` (number)
- `included_assets_count` (number) — for bundles
- `personal_data_processed` (text) — for compliance

**Default categories:** Software → Apps/Plugins/Extensions; eBooks; Audio → Music/SFX/Samples; Video → Stock Footage/Templates; Design → Templates/Fonts/Icons/Mockups; Education → Courses/Tutorials; Subscriptions → SaaS/Memberships.

**Default pages:** License Terms, Download Help, Technical Requirements, Refund Policy (digital exception), Support.

**Recommended themes:** `digital_marketplace`, `creator_portfolio`.

**Recommended integrations:** Stripe, PayPal, Vimeo OTT (Fáze 3+), Mailchimp, Klaviyo, Trustpilot.

**Workflows:**
- Instant delivery: download link in confirmation email
- License key generation + delivery
- **Subscriptions** (per `24-subscriptions.md`) for recurring digital products
- Refunds: digital downloads typically non-refundable once downloaded (must disclose at checkout per EU 14-day cooling-off exception)
- Update notifications for purchased software
- License management dashboard (customer account)
- DRM handling (per kind)

**Regulatory:**
- EU 14-day cooling-off exception for digital content (Article 16(m) Consumer Rights Directive) — requires explicit consent + waiver of right
- VAT MOSS / OSS for digital products to EU consumers (per `15-tax-compliance.md`)
- GDPR for personal data
- DSA (Digital Services Act) — for marketplaces
- DRM disclosure
- Copyright + license clear

**AI emphasis:** License recommendation (single vs commercial), tutorial generation from documentation, similar-asset search via embeddings, customer support FAQ.

**UI hints:** "Instant download" badge, license comparison table, system requirements check, version history.

**Cross-ref:** Heavy reliance on `24-subscriptions.md` for SaaS / membership.

---

### 6.15 Crafts & Handmade

**Code:** `crafts_handmade`

**Metafields (product):**
- `made_by_artisan_name` (text)
- `artisan_bio` (text_long)
- `artisan_location` (text)
- `production_method` (select) — handmade/handcrafted/artisanal/limited_edition
- `materials` (text_long)
- `dimensions_mm` (json)
- `weight_g` (number)
- `lead_time_days` (number) — for made-to-order
- `is_one_of_a_kind` (boolean)
- `is_customizable` (boolean)
- `customization_options` (text_long)
- `inspiration_story` (text_long)
- `care_instructions` (text_long)
- `country_of_origin` (text)
- `traditional_technique` (text) — e.g., "Indigo shibori dyeing"
- `eco_friendly_certifications` (select_multi)

**Default categories:** Art → Paintings/Sculpture/Prints; Crafts → Ceramics/Textiles/Woodwork/Leather/Jewelry/Glass; Home Decor; Stationery; Bath & Body Handmade; Vintage & Antiques.

**Default pages:** Meet Our Artisans, Custom Orders, Care for Handmade, Sustainability, Returns Policy.

**Recommended themes:** `artisan_storyteller`, `handmade_grid`.

**Recommended integrations:** Glami, Heuréka, Mall.cz (Fáze 2), Etsy bridge (Fáze 3+), Pinterest, Instagram (Meta Commerce), Mailchimp, Trustpilot.

**Workflows:**
- Made-to-order: lead time clearly disclosed
- One-of-a-kind: stock = 1; auto-disable after sale
- Custom orders: workflow via form (per `32`) + quote (per `21`)
- Returns: 14d cooling-off; custom orders typically non-returnable (must disclose)
- Maker spotlight pages (CMS pages per `32`)
- Marketplace mode (per `25-marketplace.md`) common — multi-artisan platforms

**Regulatory:**
- Origin labeling
- GPSR 2024
- Artisan exemptions in some EU regulations (small-scale)
- CITES for protected materials (no ivory, certain woods, ...)
- VAT artisan threshold (CZ <2M CZK annual)

**AI emphasis:** Story generation from artisan bio + materials, similar-style discovery via embeddings, customization Q&A bot.

**UI hints:** Storytelling layout, artisan profile cards, "1 of 1" badges, custom order CTAs.

**Cross-ref:** Often combined with `marketplace` profile (multi-artisan platform).

---

## 7. State machines

### 7.1 Tenant profile activation

```
not_activated → installing → active ↔ disabled
                                         ↓
                                     upgrading → active
                                         ↓
                                     removing → removed (terminal)
```

### 7.2 Regulatory checklist status

```
pending → in_progress → completed (terminal)
                     → dismissed (acknowledged not applicable)
                     → not_applicable (auto-detected)
```

### 7.3 Profile manifest version

```
draft → beta → stable → deprecated → retired
```

---

## 8. Business rules

### RULE-IND-001: Profile is additive

Activating profile NEVER overwrites existing data. Conflicting metafield definitions (same code): preserve existing, skip new. User notified.

### RULE-IND-002: Multi-profile composition deterministic

Order of activation matters for tie-breaking. UI shows preview before activation.

### RULE-IND-003: Profile uninstall preserves user data

Removing profile doesn't delete metafield definitions or categories that have data attached. Disables future recommendation only.

### RULE-IND-004: Regulatory checklists not blocking by default

Checklist items are warnings + suggestions, not hard blockers. Critical items (`severity='critical'`) may block publish of specific resource (e.g., food product without allergens → cannot publish).

### RULE-IND-005: EU 1169/2011 enforcement (Food)

Food products `food_beverage` profile require `allergens` + `ingredients_list` populated before publish. Hard rule.

### RULE-IND-006: CE marking enforcement

`toys_kids`, `electronics`, certain `sports_outdoor`, `health_beauty` categories require CE marking attestation. Tenant attests; AI/Vision can assist verifying packaging photo.

### RULE-IND-007: Wine ABV labeling

`wine_spirits` products require `abv_percent` and `volume_ml` before publish. Mandatory per EU labeling.

### RULE-IND-008: Age gate enforcement

`wine_spirits` profile installs age gate (storefront modal first visit). Cookie-stored 30d. Per `12-checkout.md`: age confirmation also at checkout for alcohol items.

### RULE-IND-009: Adult signature for restricted delivery

Alcohol shipments: carrier instruction "adult signature required" auto-applied (per `14-shipping.md`).

### RULE-IND-010: Cooling-off exceptions disclosed

EU 14d cooling-off exemptions (per profile) must be disclosed at checkout:
- Perishable food (per `food_beverage`)
- Opened cosmetics (per `health_beauty`)
- Made-to-order / personalized (per `crafts_handmade`, `furniture_home`, `jewelry_watches`)
- Downloaded digital content (per `digital_products`)
- Health/hygiene products opened

Disclosure mandatory; auto-rendered at checkout.

### RULE-IND-011: Digital cooling-off waiver

`digital_products` profile: checkout requires explicit "I waive my right to 14d cooling-off because I want immediate download" checkbox before purchase (EU Consumer Rights Directive Article 16(m)).

### RULE-IND-012: B2B trade pricing visibility

`b2b_industrial` profile defaults `show_prices_logged_out=false` for trade categories (price requires login + approved trade account).

### RULE-IND-013: Hazmat shipping flag

`b2b_industrial` products with `hazmat_classification` populated: carrier integration limited to hazmat-certified carriers. Auto-flagged at checkout.

### RULE-IND-014: One-of-a-kind stock

`crafts_handmade` products with `is_one_of_a_kind=true`: stock auto-set to 1, auto-disabled after sale (no replenishment workflow).

### RULE-IND-015: Made-to-order lead time disclosure

Products with `lead_time_days > 0`: lead time prominent in product page + checkout. Cart blocks until customer acknowledges.

### RULE-IND-016: Expiry-aware inventory

`food_beverage`, `health_beauty`, `pet_supplies` profiles: products with `expiry_date` field. Inventory (per `09`) treats per-batch expiry. Oldest-first FIFO. Alert 14d before expiry: discount workflow or withdraw.

### RULE-IND-017: Allergen highlighting

`food_beverage` product detail page renders allergens with bold + icon. Ingredient list highlights allergens within text (EU 1169/2011).

### RULE-IND-018: Batch tracking enforced

`food_beverage`, `health_beauty`, `pet_supplies` (food/meds) profiles: per-variant batch_number + expiry_date mandatory. Used for recall capability.

### RULE-IND-019: Recall workflow

If recall declared (admin action, security event per `30`): all orders shipped with affected batch_numbers → customers notified within 24h. Pre-drafted templates per profile.

### RULE-IND-020: Vehicle / oversize shipping

`furniture_home` + `sports_outdoor` (bikes, skis) → carrier integration uses dimensional weight + oversize handling. Per `14-shipping.md` extended.

### RULE-IND-021: Serial number tracking

`electronics` (and select `sports_outdoor` like e-bikes): per-unit `serial_number` tracked at fulfillment. Customer warranty tied to serial.

### RULE-IND-022: WEEE compliance disclosure

`electronics` products: WEEE category + recycling info on product page (mandatory EU).

### RULE-IND-023: ISBN dedup

`books_media` ISBN must be unique per tenant catalog (multiple editions = different ISBN). Auto-detect duplicates at product creation.

### RULE-IND-024: Age rating block

`books_media` (games, films): customer accessing age-rated content prompted for age confirmation. Aligns with `wine_spirits` age gate pattern.

### RULE-IND-025: Cross-border alcohol restrictions

`wine_spirits`: configurable list of allowed shipping destinations. Some EU countries require local distributor (SE, FI, NO). Cart blocks otherwise.

### RULE-IND-026: Prescription veterinary handling

`pet_supplies` products with `prescription_required=true`: cart requires customer-uploaded prescription image + vet authorization before checkout completion.

### RULE-IND-027: Subscription default for consumables

`pet_supplies` (food), `health_beauty` (skincare routines), `food_beverage` (coffee, snacks): subscription CTA "Save X% with auto-delivery" promoted by profile. Per `24-subscriptions.md`.

### RULE-IND-028: VAT rate hints

Profile suggests reduced VAT rate for applicable categories (e.g., food → 12% CZ; books → 10% CZ). Tenant confirms via `15-tax-compliance.md` rules.

### RULE-IND-029: AI Copilot brand voice per profile

When profile activated, default `brand_voice_prompt` injected into `tenant_ai_settings`. Tenant can override.

### RULE-IND-030: Regulatory checklist task tracking

Each `regulatory_checklists` item creates task in tenant onboarding checklist (per `27 §RULE-ADM-021`). Tenant works through them; status tracked.

### RULE-IND-031: Profile recommends but doesn't auto-install integrations

Recommended integrations shown in onboarding wizard with "Install" buttons. Tenant decides. No silent integration installs.

### RULE-IND-032: Custom profiles must declare regulatory tier

Third-party profiles (Fáze 3+) must declare which regions/categories they target + what regulatory considerations apply. Reviewed by platform compliance staff.

### RULE-IND-033: Profile manifest immutable per version

Once published, manifest version can't change. New changes → new version. Tenants opt-in to upgrade.

### RULE-IND-034: AI suggests profile from description

Onboarding step: AI Copilot can suggest 1-3 profiles based on tenant's free-text business description. Customer reviews + confirms.

### RULE-IND-035: Profile metrics for platform

Platform tracks per profile: install count, churn, satisfaction. Drives improvement priorities.

---

## 9. REST API endpoints

### 9.1 Catalog (public)

```
GET    /api/{date}/industry-profiles
GET    /api/{date}/industry-profiles/{code}
GET    /api/{date}/industry-profiles/{code}/manifest
GET    /api/{date}/industry-profiles/by-region/{region_code}
GET    /api/{date}/industry-profiles/by-category/{category}
GET    /api/{date}/industry-profiles:search?q=...
POST   /api/{date}/industry-profiles:suggest                                                                                                                                                                                                                                                                                                                                                                                                                                                            # body: { tenant_description } → AI-suggested codes
```

### 9.2 Tenant activations

```
GET    /api/{date}/tenant/industry-profiles                                                                                                                                                                                                                                                                                                                                                                                                                                                                            # active profiles
POST   /api/{date}/tenant/industry-profiles                                                                                                                                                                                                                                                                                                                                                                                                                                                                              # body: { profile_codes, choices: { install_categories, install_metafields,... } }
GET    /api/{date}/tenant/industry-profiles/{code}
PATCH  /api/{date}/tenant/industry-profiles/{code}                                                                                                                                                                                                                                                                                                                                                                                                                                                                            # change activation choices
DELETE /api/{date}/tenant/industry-profiles/{code}                                                                                                                                                                                                                                                                                                                                                                                                                                                                              # disable
POST   /api/{date}/tenant/industry-profiles/{code}:upgrade                                                                                                                                                                                                                                                                                                                                                                                                                                                                          # to latest manifest version
POST   /api/{date}/tenant/industry-profiles/{code}:preview                                                                                                                                                                                                                                                                                                                                                                                                                                                                            # show what would change
```

### 9.3 Regulatory checklists

```
GET    /api/{date}/compliance/regulatory-checklists                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                # all applicable to tenant
GET    /api/{date}/compliance/regulatory-checklists/{code}
GET    /api/{date}/compliance/regulatory-checklists/by-profile/{profile_code}
POST   /api/{date}/compliance/regulatory-checklists/{code}:attest                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          # body: { items_completed, notes }
POST   /api/{date}/compliance/regulatory-checklists/{code}:dismiss
GET    /api/{date}/compliance/dashboard                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            # status overview
```

### 9.4 Platform side (vertical experts)

```
POST   /api/{date}/platform/industry-profiles                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            # create new profile
PATCH  /api/{date}/platform/industry-profiles/{code}
POST   /api/{date}/platform/industry-profiles/{code}/manifest-versions                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          # new version
POST   /api/{date}/platform/industry-profiles/{code}/versions/{v}:publish
POST   /api/{date}/platform/industry-profiles/{code}/versions/{v}:deprecate
POST   /api/{date}/platform/industry-profiles/{code}/versions/{v}:retire
```

### 9.5 Example: AI profile suggestion

```http
POST /api/2026-05-20/industry-profiles:suggest HTTP/1.1
Content-Type: application/json

{
  "tenant_description": "I sell handmade ceramic bowls made in my workshop in Moravia. Mostly Czech customers but expanding to Germany.",
  "locale": "cs-CZ",
  "target_regions": ["CZ","DE"]
}
```

```jsonc
HTTP/1.1 200 OK

{
  "data": {
    "suggestions": [
      {
        "code": "crafts_handmade",
        "display_name": "Crafts & Handmade",
        "confidence": 0.94,
        "reasoning": "Handmade products in artisan workshop; lead time, customization, storytelling fit profile.",
        "preview_metafields_added": 12
      },
      {
        "code": "furniture_home",
        "display_name": "Furniture & Home",
        "confidence": 0.46,
        "reasoning": "Decorative items overlap; partial match.",
        "preview_metafields_added": 8
      }
    ]
  }
}
```

### 9.6 Example: Activate profile

```http
POST /api/2026-05-20/tenant/industry-profiles HTTP/1.1
Authorization: Bearer <admin>

{
  "profile_codes": ["crafts_handmade"],
  "choices": {
    "install_metafields": ["all"],
    "install_default_categories": true,
    "install_default_pages": true,
    "apply_workflow_defaults": true,
    "apply_ai_brand_voice": true
  }
}
```

```jsonc
HTTP/1.1 202 Accepted

{
  "data": {
    "activation_id": "tip_aB",
    "profile_code": "crafts_handmade",
    "status": "installing",
    "estimated_complete_seconds": 30
  }
}
```

---

## 10. GraphQL schema

```graphql
type IndustryProfile implements Node {
  id: ID!
  code: String!
  displayName: String!
  description: String!
  iconUrl: String
  category: IndustryProfileCategory!
  regionCodes: [String!]!
  publisherKind: ProfilePublisherKind!
  publisherAccountId: String
  manifestVersion: String!
  manifest: JSON!
  status: IndustryProfileStatus!
  visibility: ProfileVisibility!
  activeTenantsCount: Int!
  averageRating: Float
  createdAt: DateTime!
}

enum IndustryProfileCategory { RETAIL SERVICES DIGITAL B2B MARKETPLACE CUSTOM }
enum ProfilePublisherKind { FIRST_PARTY THIRD_PARTY_CERTIFIED COMMUNITY }
enum IndustryProfileStatus { DRAFT BETA STABLE DEPRECATED RETIRED }
enum ProfileVisibility { PUBLIC PRIVATE_TO_PUBLISHER AGENCY_SHARED }

type TenantIndustryProfile implements Node {
  id: ID!
  profile: IndustryProfile!
  installedManifestVersion: String!
  installedMetafieldDefinitions: [String!]
  installedCategories: Boolean!
  installedDefaultPages: Boolean!
  appliedWorkflowDefaults: Boolean!
  appliedAiBrandVoice: Boolean!
  status: TenantProfileStatus!
  installedAt: DateTime!
  installedBy: User
  lastUpgradedAt: DateTime
  upgradeAvailable: Boolean!
  availableManifestVersion: String
}

enum TenantProfileStatus { INSTALLING ACTIVE DISABLED UPGRADING REMOVING }

type RegulatoryChecklist {
  id: ID!
  code: String!
  displayName: String!
  descriptionHtml: String!
  regulatoryBasis: String
  regionCodes: [String!]!
  appliesToCategories: [String!]
  mandatory: Boolean!
  severity: ChecklistSeverity!
  checklistItems: JSON!
  effectiveFrom: Date!
  effectiveUntil: Date
  tenantStatus: TenantChecklistStatus
}

enum ChecklistSeverity { INFO RECOMMENDED CRITICAL }

type TenantChecklistStatus {
  status: ChecklistStatus!
  itemsCompleted: JSON
  attestationUser: User
  attestationNotes: String
  statusChangedAt: DateTime!
}

enum ChecklistStatus { PENDING IN_PROGRESS COMPLETED DISMISSED NOT_APPLICABLE }

type ProfileSuggestion {
  code: String!
  displayName: String!
  confidence: Float!
  reasoning: String!
  previewMetafieldsAdded: Int!
}

extend type Query {
  industryProfiles(filter: IndustryProfileFilter): [IndustryProfile!]!
  industryProfile(code: String!): IndustryProfile
  tenantIndustryProfiles: [TenantIndustryProfile!]! @auth(requires: PERM_INDUSTRY_PROFILE_VIEW)
  tenantIndustryProfile(code: String!): TenantIndustryProfile
  applicableRegulatoryChecklists: [RegulatoryChecklist!]! @auth(requires: PERM_COMPLIANCE_VIEW)
  complianceDashboard: ComplianceDashboard! @auth(requires: PERM_COMPLIANCE_VIEW)
  suggestIndustryProfile(description: String!, regions: [String!]): [ProfileSuggestion!]!
}

type ComplianceDashboard {
  totalChecklists: Int!
  completedChecklists: Int!
  pendingChecklists: Int!
  criticalOutstanding: Int!
  completionPercentage: Float!
}

extend type Mutation {
  activateIndustryProfiles(input: ActivateIndustryProfilesInput!): [TenantIndustryProfile!]! @auth(requires: PERM_INDUSTRY_PROFILE_MANAGE)
  updateProfileActivation(code: String!, input: UpdateProfileActivationInput!): TenantIndustryProfile! @auth(requires: PERM_INDUSTRY_PROFILE_MANAGE)
  disableTenantProfile(code: String!): TenantIndustryProfile! @auth(requires: PERM_INDUSTRY_PROFILE_MANAGE)
  upgradeTenantProfile(code: String!): TenantIndustryProfile! @auth(requires: PERM_INDUSTRY_PROFILE_MANAGE)
  attestRegulatoryChecklist(code: String!, input: AttestChecklistInput!): TenantChecklistStatus! @auth(requires: PERM_COMPLIANCE_MANAGE)
  dismissRegulatoryChecklist(code: String!, reason: String): TenantChecklistStatus! @auth(requires: PERM_COMPLIANCE_MANAGE)
}
```

---

## 11. Events

| Build-spec ID | Wire | Payload |
|---|---|---|
| `EVENT-IND-PROFILE-PUBLISHED` | `industry.profile_published` | `{ profile, manifest_version }` |
| `EVENT-IND-PROFILE-DEPRECATED` | `industry.profile_deprecated` | `{ profile, sunset_at }` |
| `EVENT-IND-PROFILE-ACTIVATED` | `industry.profile_activated` | `{ tenant, profile }` |
| `EVENT-IND-PROFILE-DISABLED` | `industry.profile_disabled` | `{ tenant, profile }` |
| `EVENT-IND-PROFILE-UPGRADED` | `industry.profile_upgraded` | `{ tenant, profile, from_version, to_version }` |
| `EVENT-IND-PROFILE-INSTALLATION-FAILED` | `industry.profile_installation_failed` | `{ tenant, profile, reason }` |
| `EVENT-IND-METAFIELD-DEFINITIONS-INSTALLED` | `industry.metafield_definitions_installed` | `{ tenant, count, codes }` |
| `EVENT-IND-DEFAULT-CATEGORIES-INSTALLED` | `industry.default_categories_installed` | `{ tenant, count }` |
| `EVENT-IND-DEFAULT-PAGES-INSTALLED` | `industry.default_pages_installed` | `{ tenant, count }` |
| `EVENT-IND-REGULATORY-CHECKLIST-ATTESTED` | `industry.regulatory_checklist_attested` | `{ tenant, checklist }` |
| `EVENT-IND-REGULATORY-CHECKLIST-DISMISSED` | `industry.regulatory_checklist_dismissed` | `{ tenant, checklist }` |
| `EVENT-IND-RECALL-DECLARED` | `industry.recall_declared` | `{ tenant, recall, affected_batches }` |
| `EVENT-IND-PROFILE-SUGGESTED-BY-AI` | `industry.profile_suggested_by_ai` | `{ tenant, suggestions }` |
| `EVENT-IND-COMPLIANCE-DASHBOARD-CRITICAL-OUTSTANDING` | `industry.compliance_critical_outstanding` | `{ tenant, count }` |

**Konzumenti:**
- Onboarding wizard
- Notification center
- Audit log (per `30`)
- Compliance dashboard
- AI Copilot (re-tune brand voice on profile change)
- Search indexer (new categories)
- Sitemap regen (new default pages)

---

## 12. Background jobs

| Job | Trigger | Queue | Frequency |
|---|---|---|---|
| `JOB-APPLY-INDUSTRY-PROFILE` | activation request | `industry` | On-demand |
| `JOB-UPGRADE-TENANT-PROFILE` | upgrade request | `industry` | On-demand |
| `JOB-DISABLE-TENANT-PROFILE` | disable request | `industry` | On-demand |
| `JOB-PREVIEW-PROFILE-CHANGES` | preview API | `industry` | On-demand (synchronous) |
| `JOB-SUGGEST-PROFILE-FOR-TENANT` | AI suggestion API | `ai` | On-demand |
| `JOB-DETECT-PROFILE-UPGRADE-AVAILABLE` | scheduled | `industry` | Daily |
| `JOB-NOTIFY-PROFILE-UPGRADE` | EVENT-IND-PROFILE-PUBLISHED (newer than tenant's) | `notifications` | On-demand |
| `JOB-ANALYZE-COMPLIANCE-STATUS` | scheduled | `compliance` | Daily |
| `JOB-DETECT-CRITICAL-COMPLIANCE-OUTSTANDING` | scheduled | `compliance` | Daily |
| `JOB-DETECT-EXPIRY-APPROACHING` | scheduled | `industry` | Daily |
| `JOB-EXECUTE-RECALL-NOTIFICATION` | EVENT-IND-RECALL-DECLARED | `notifications` | On-demand |
| `JOB-AGGREGATE-PROFILE-METRICS-PLATFORM-WIDE` | scheduled | `analytics` | Daily |
| `JOB-VALIDATE-PROFILE-MANIFEST` | manifest publish | `industry` | On-demand |
| `JOB-AUTO-MARK-CHECKLIST-NOT-APPLICABLE` | scheduled | `compliance` | Daily (e.g., if tenant has no products in category) |

---

## 13. UI/UX flows

### FLOW-IND-001: Onboarding profile selection

```
[Step 1 of 8: "What kind of business?"]
   - Free-text input + popular profiles grid
        ↓
   tenant types: "I sell handmade pottery and ceramics"
        ↓
   AI suggests: Crafts & Handmade (94% confidence), Home (46%)
        ↓
[Tenant confirms: Crafts & Handmade]
        ↓
[Preview modal: "Here's what we'll set up..."]
   - 12 new metafields (size, material, artisan name, ...)
   - 8 default categories
   - 4 default pages (About Artisans, Custom Orders, ...)
   - 3 recommended integrations (Glami, Etsy bridge — install later)
   - Default Returns workflow (14d cooling-off + custom orders disclosure)
   - 4 regulatory checklist items
        ↓
   tenant confirms → "Activate"
        ↓
[Background: JOB-APPLY-INDUSTRY-PROFILE]
   - Status banner: "Setting up your store for Crafts & Handmade..."
   - 30s later: "Done! Your store is ready."
        ↓
[Onboarding continues to step 2: Currency + Tax]
```

### FLOW-IND-002: Adding profile after MVP launch

```
[Tenant Settings → Industry Profiles]
   - Currently active: Crafts & Handmade
   - "Add another profile" button
        ↓
[Browse catalog]
   - Filter by region (CZ + EU)
   - Tenant clicks "Furniture & Home" (expanding catalog)
        ↓
[Preview]
   - 8 new metafields (dimensions, assembly, ...)
   - Adds Furniture category subtree
   - 2 new regulatory checklist items
   - Suggests DPD oversized shipping integration
        ↓
   tenant activates
        ↓
[Both profiles now active; preset additive]
```

### FLOW-IND-003: Profile upgrade

```
[Platform publishes new version of fashion_apparel manifest]
   - Added new metafield: sustainability_certifications
   - Added new regulatory checklist: EU Digital Product Passport (2027 anticipation)
   - Updated default pages
        ↓
[EVENT-IND-PROFILE-PUBLISHED]
[JOB-NOTIFY-PROFILE-UPGRADE → affected tenants]
   - Email: "New version of Fashion & Apparel profile available"
   - In-app banner
        ↓
[Tenant → Industry Profiles → Fashion & Apparel → "Upgrade available"]
   - Modal: diff of changes
   - Opt-in checkboxes per change
        ↓
   tenant selects + applies
        ↓
[JOB-UPGRADE-TENANT-PROFILE]
   - Metafield definitions added
   - Regulatory checklist created (pending)
   - Pages added (if opted in)
   - Manifest version updated
```

### FLOW-IND-004: Recall workflow (food/electronics)

```
[Tenant discovers batch quality issue]
   - Admin → Inventory → Affected batch → "Declare recall"
        ↓
[Recall form]
   - Reason
   - Affected batch numbers
   - Severity (safety / quality / regulatory)
   - Action: refund / replace / both
        ↓
[Confirm]
        ↓
[EVENT-IND-RECALL-DECLARED]
[JOB-EXECUTE-RECALL-NOTIFICATION]
   - Find all orders with affected batch_number (per inventory tracking)
   - Email customers: "Important safety notice"
   - SMS option for critical (per `19`)
   - Auto-generate return labels
   - Refund pre-authorized
        ↓
[Reporting]
   - Recall status dashboard
   - Regulatory authority notification (per country)
   - Audit log (per `30`)
```

### FLOW-IND-005: AI suggests profile during catalog import

```
[Tenant imports 1000 products via CSV (no profile yet)]
        ↓
[AI scans product data (titles, descriptions, images)]
   - 87% match Furniture & Home patterns
   - Suggests activation
        ↓
[Notification: "Want to set up Furniture profile based on your catalog?"]
   - Preview + confirm flow
        ↓
[Profile applied; existing products auto-tagged with appropriate metafields where possible (AI fills metafields)]
```

---

## 14. Testing

```
TEST-UNIT-IND-001  Profile manifest validation
TEST-UNIT-IND-002  Multi-profile composition merger
TEST-UNIT-IND-003  Metafield definition installer (dedupe with existing)
TEST-UNIT-IND-004  Regulatory checklist eligibility calculator
TEST-UNIT-IND-005  Profile diff (current vs new version)
TEST-UNIT-IND-006  AI suggestion confidence scoring
TEST-UNIT-IND-007  Profile manifest semver compatibility

TEST-INT-IND-001  Onboarding: activate fashion + verify metafields installed
TEST-INT-IND-002  Multi-profile activation deterministic order
TEST-INT-IND-003  Profile upgrade preserves user data
TEST-INT-IND-004  Profile disable doesn't delete metafields with data
TEST-INT-IND-005  Regulatory checklist auto-creation per profile
TEST-INT-IND-006  Recall workflow end-to-end (food vertical)
TEST-INT-IND-007  Age gate enforcement (wine vertical)
TEST-INT-IND-008  CE attestation blocking publish (toys vertical)
TEST-INT-IND-009  Cooling-off exception disclosure at checkout
TEST-INT-IND-010  AI profile suggestion accuracy on labeled dataset

TEST-E2E-IND-001  Merchant onboarding with crafts_handmade profile
TEST-E2E-IND-002  Switching profile from B2C to B2B mid-business
TEST-E2E-IND-003  Wine merchant — age gate + adult signature delivery
TEST-E2E-IND-004  Food merchant — allergen labeling enforcement
TEST-E2E-IND-005  Electronics — warranty + recall lifecycle
TEST-E2E-IND-006  Custom profile (Fáze 3+) published by partner

TEST-COMPLY-IND-001  EU 1169/2011 enforced for food
TEST-COMPLY-IND-002  EU 1223/2009 enforced for cosmetics
TEST-COMPLY-IND-003  EU 1007/2011 enforced for textiles
TEST-COMPLY-IND-004  Wine labeling (ABV, allergens) enforced
TEST-COMPLY-IND-005  Toy safety (EN 71) checklist generated
TEST-COMPLY-IND-006  Digital cooling-off waiver at checkout
```

---

## 15. Implementation checklist

### Core
- [ ] **[S]** Drizzle schema `packages/db/src/schema/industry/*.ts`
- [ ] **[S]** Migrace `20260615_001_create_industry_tables.sql`
- [ ] **[M]** `IndustryProfileService` — manifest CRUD, validation, versioning
- [ ] **[L]** `ProfileActivationOrchestrator` — install metafields/categories/pages/workflows, idempotent
- [ ] **[M]** `RegulatoryChecklistService` — eligibility + attestation
- [ ] **[M]** `ProfileUpgradeService` — diff + apply
- [ ] **[M]** AI profile suggestion logic (vector embeddings of tenant description + profile descriptions)
- [ ] **[M]** REST + GraphQL endpoints

### Profile manifests (MVP 15)
- [ ] **[M]** Author manifests for all 15 MVP profiles per §6
- [ ] **[M]** Default metafield definitions per profile
- [ ] **[M]** Default categories per profile
- [ ] **[M]** Default CMS pages per profile
- [ ] **[M]** Workflow defaults per profile
- [ ] **[M]** Regulatory checklists per region

### Frontend — Admin
- [ ] **[L]** Profile selection step in onboarding wizard
- [ ] **[M]** Profile management page (settings/industry-profiles)
- [ ] **[M]** Profile preview modal (diff + opt-in checkboxes)
- [ ] **[M]** Upgrade-available banner + flow
- [ ] **[M]** Regulatory checklist dashboard
- [ ] **[M]** Compliance task center
- [ ] **[M]** Recall declaration wizard

### Tests
- [ ] Per §14

### Docs
- [ ] **[M]** "Choosing your industry profile" merchant guide
- [ ] **[M]** "Compliance for your vertical" per profile
- [ ] **[M]** "Building custom profiles" developer guide (Fáze 3+)
- [ ] **[M]** Per-vertical regulatory primer (CZ + EU)
- [ ] **[S]** Profile catalog as public docs page

---

## 16. Open questions

### Q-IND-001: Profile + product import sync
**Otázka:** Když tenant importuje CSV před výběrem profilu, můžeme retroactively aplikovat metafield definitions?

**Status:** Yes. Aktivace profilu zachová existing data; nové metafield definitions přidají sloupce (NULL pro existing). Tenant doplní manuálně nebo AI assist.

### Q-IND-002: Granularita custom profilů
**Otázka:** Agentura chce mít vlastní "Fashion + Acme branding" profil pro multiple svých tenantů?

**Status:** Fáze 3+ feature. Custom profile published via partners.shopio.com (per `28`), scope `agency_shared`.

### Q-IND-003: AI Act high-risk vertical features
**Otázka:** Některé profile features (např. age gate, KYC při alcohol) — kvalifikované jako high-risk per EU AI Act?

**Status:** Age gate je čisté rule-based (ne AI). AI-assisted age estimation (Fáze 4+) by spadalo pod high-risk → human-in-loop.

### Q-IND-004: Cross-profile data conflicts
**Otázka:** Fashion má `size` ve formátu EU/UK/US; Sports má `size` ve formátu shoe US/EU. Konflikt?

**Status:** Per-category options template (`05-naming-conventions.md`). `clothing_sizes_eu` vs `footwear_sizes_eu` — different templates, no conflict.

### Q-IND-005: Vertical-specific PII handling
**Otázka:** Health & Beauty (skin concerns) + Health vertical may collect special category data (GDPR Art 9).

**Status:** Per `30-security.md`. Profile flags resource fields jako "special category" → strict consent + audit. DPO review required.

### Q-IND-006: Profile pricing tier gating
**Otázka:** Některé profile pro Pro/Enterprise plan only? B2B Industrial např.?

**Status:** MVP: all profiles available all tiers. Fáze 2: B2B features (per `21`) gated; profile aktivní ale features omezené.

### Q-IND-007: Vertikál subdomény (CBD, regulated)
**Otázka:** Cannabis/CBD (where legal), firearms (where legal) — speciální požadavky?

**Status:** Out of MVP scope. Future profiles per legal review per region. Specialized compliance (CBD GMP, firearms license verification) → custom modules.

### Q-IND-008: Sezónní switch profilů
**Otázka:** Garden center má vlastně 4 different "stores" per season (spring planting, summer outdoor, autumn harvest, winter holidays)?

**Status:** Profile aktivní celoročně. Sezónnost řeší collections + campaigns (per `19`) + multi-store (per `22`). Sezónní override Fáze 3+.

### Q-IND-009: Industry-specific AI fine-tuning
**Otázka:** Vertikál-specific LLM (fashion product description LLM)?

**Status:** Fáze 4+ feature. Prompt template optimalization MVP; full fine-tuning enterprise tier.

### Q-IND-010: Marketplace profile + multi-vendor
**Otázka:** Tenant aktivuje "Crafts" profile + "Marketplace mode" (per `25`) — kombinatorika integrací?

**Status:** Combination supported. Marketplace mode enables seller onboarding; profile preset configures catalog + workflows. Společně tvoří handmade marketplace á la Etsy.

---

## 📅 Změny

| Datum | Změna |
|---|---|
| 2026-05-20 | Initial — Industry Profiles domain. 15 first-party profiles (Fashion, Food, Health & Beauty, Electronics, Books, Furniture, Jewelry, Wine, Toys, Sports, Pet, B2B Industrial, Services-beta, Digital Products, Crafts & Handmade). Profile = preset bundle (metafields + categories + pages + workflows + integrations + AI brand voice + regulatory checklists). Multi-profile composable. AI-suggested onboarding. EU-first regulatory compliance scaffolding. 4 tables, 35 business rules, 14 events, 14 background jobs. |

---

**Konec Industry Profiles.**

➡️ Pokračovat na: [`35-graphic-templates.md`](35-graphic-templates.md)



