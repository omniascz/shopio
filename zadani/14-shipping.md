# 14 – SHIPPING & FULFILLMENT

> **Doména:** Doprava a doručení. Carrier abstraction (provider interface), shipping zones, rate calculation pipeline, pickup points cache, label generation (PDF), tracking ingestion, ETA. MVP carriers: Zásilkovna, PPL, Česká pošta, DPD, Packeta SK. International v1.0+ (GLS DE, DHL DE, Hermes, ...).

**Datum:** 2026-05-19
**Verze:** 1.0
**Status:** 🟡 DESIGN
**Reference:** [03 §9](03-data-models-master.md#9-orders-payments-shipments) · [12-checkout.md](12-checkout.md) · [16-order-management.md](16-order-management.md) · [DEC-EVENTS-001](01-decisions-registry.md#dec-events-001-event-bus--background-jobs)

---

## 📑 Obsah

0. [Domain overview](#0-domain-overview)
1. [References](#1-references)
2. [Personas](#2-personas)
3. [Data models](#3-data-models)
4. [Carrier abstraction & MVP carriers](#4-carrier-abstraction--mvp-carriers)
5. [Rate calculation pipeline](#5-rate-calculation-pipeline)
6. [State machines](#6-state-machines)
7. [Business rules](#7-business-rules)
8. [REST API endpoints](#8-rest-api-endpoints)
9. [GraphQL schema](#9-graphql-schema)
10. [Events](#10-events)
11. [Background jobs](#11-background-jobs)
12. [UI/UX flows](#12-uiux-flows)
13. [Edge cases & error handling](#13-edge-cases--error-handling)
14. [Performance](#14-performance)
15. [Security](#15-security)
16. [Testing](#16-testing)
17. [Implementation checklist](#17-implementation-checklist)
18. [Open questions](#18-open-questions)

---

## 0. Domain overview

### 0.1 Co tato doména **je**

- **Carrier abstraction** — `ShippingCarrier` interface; per-provider implementace
- **MVP carriers (CZ/SK first):** Zásilkovna, PPL, Česká pošta (ČP), DPD, Packeta SK
- **Shipping zones** — geografické skupiny (země + region) pro rate rules
- **Shipping rates** — `flat`, `weight_based`, `price_based`, `free_above_threshold`, `dimensional`
- **Pickup points** — cached lokality (Zásilkovna výdejny, BalíkovnyČP) pro storefront picker
- **Label generation** — PDF labels (carrier API call → store + return URL)
- **Tracking ingestion** — carrier webhooks update `shipment_events`
- **ETA calculation** — z `cutoff_time` warehouse + carrier service_code days
- **Multi-package shipments** — 1 order může mít N shipments (split fulfillment)
- **COD coordination** — carrier reports cash collected → triggers `13-payments.md` capture
- **Insurance** — opt-in per shipment, cost added to shipping_amount
- **International** — customs declarations (HS codes, value, currency) — v1.0+
- **Returns shipping** — RMA label generation via carrier (Fáze 2)
- **Click & Collect (BOPIS)** — pickup at warehouse (warehouses.pickup_enabled, v1.0+)

### 0.2 Co tato doména **NENÍ**

- ❌ Order lifecycle (→ `16-order-management.md`; shipment is owned tightly with order)
- ❌ Payment incl. COD capture mechanism (→ `13-payments.md`; we trigger their capture on delivery)
- ❌ Returns workflow (→ `17-returns-refunds.md`; we may issue return labels)
- ❌ Inventory allocation across warehouses (→ `09-inventory.md`; we receive allocated warehouse_id)
- ❌ Customs declaration content rules (→ Fáze 2 international v `15-tax-compliance.md`)
- ❌ Marketplace shipping (multi-seller per cart) (→ `25-marketplace.md`)
- ❌ Last-mile delivery management (→ third-party WMS/carrier)

### 0.3 Diferenciátory

1. **CZ/SK lokalizace first-class** — Zásilkovna/Packeta widget pickup-point integration, ČP Balíkovna, COD nativně
2. **Carrier-agnostic API** — merchant nepíše per-carrier kód; jeden interface
3. **Rate calc deterministic** — pure function (cart × address) → list rates; cacheable
4. **Pickup points cache** — local sync z carrier feedů; storefront widget bez závislosti na carrier uptime
5. **EU-first ETA** — den-přesný odhad doručení založený na cutoff + business days
6. **Plugin model** — externí carrier (custom dropshipper, regionální posta) přes plugin

---

## 1. References

- [03 §9](03-data-models-master.md#9-orders-payments-shipments) — ENT-SHIPMENT-001 až ENT-PICKUP-POINT-001
- [12-checkout.md](12-checkout.md) — shipping method selection step
- [13-payments.md](13-payments.md) — COD capture trigger
- [16-order-management.md](16-order-management.md) — order's shipments, fulfillment_status
- [09-inventory.md](09-inventory.md) — warehouse_id source, BOPIS
- [17-returns-refunds.md](17-returns-refunds.md) — return labels
- [15-tax-compliance.md](15-tax-compliance.md) — shipping tax handling, international customs
- [22-multistore-channels.md](22-multistore-channels.md) — per-channel shipping config (Fáze 2)
- [29-integrations.md](29-integrations.md) — carrier integration plugin patterns
- Carrier APIs: Zasilkovna API (api.packeta.com), PPL myAPI, ČP B2B API, DPD ShipperAPI
- IATA codes pro international airports (v1.0+)

---

## 2. Personas

| Persona | Použití | Klíčové permissions |
|---|---|---|
| `PERSONA-MERCHANT-OWNER` | Configure carriers, zones, rates | `PERM-SHIPPING-*` |
| `PERSONA-FULFILLMENT-MANAGER` | Print labels, manage shipments | `PERM-SHIPPING-LABEL-PRINT`, `PERM-SHIPMENT-MANAGE` |
| `PERSONA-WAREHOUSE-STAFF` | Pick & pack, generate labels | `PERM-SHIPMENT-MANAGE`, `PERM-INVENTORY-VIEW` |
| `PERSONA-CUSTOMER-SERVICE` | Check tracking, reissue label, update address | `PERM-SHIPMENT-MANAGE`, `PERM-SHIPMENT-EDIT-ADDRESS` |
| `PERSONA-CUSTOMER` | Pick shipping method, choose pickup point, track delivery | None explicit |
| `PERSONA-CARRIER-INTEGRATION` (system) | Webhook callbacks (tracking events) | API key with `shipping:webhook` scope |
| `PERSONA-AI-COPILOT` | Suggest shipping rules, anomaly detection | `agent:shipping:read` |
| `PERSONA-EXTERNAL-AGENT` | MCP `shipping.get_rates`, `shipping.track` | `agent:catalog:read`, `agent:order:read` |

---

## 3. Data models

### 3.1 `shipments` ([ENT-SHIPMENT-001](03-data-models-master.md#ent-shipment-001))

```sql
CREATE TABLE shipments (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  pub_id TEXT NOT NULL,                                         -- shp_ NanoID
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  number TEXT NOT NULL,                                          -- SHP-2026-NNNN per tenant
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  carrier_code TEXT NOT NULL,                                    -- 'zasilkovna','ppl','ceska_posta',...
  service_code TEXT NOT NULL,                                    -- carrier-specific 'home','pickup_point','express','cod'
  service_display_name TEXT NOT NULL,
  -- destination
  shipping_address_snapshot JSONB NOT NULL,                       -- immutable from order
  pickup_point_id UUID NULL REFERENCES pickup_points(id),         -- if service=pickup_point
  pickup_point_snapshot JSONB NULL,                                -- snapshot at shipment creation
  -- carrier-side
  carrier_shipment_id TEXT NULL,                                   -- carrier's internal ID
  tracking_number TEXT NULL,
  tracking_url TEXT NULL,
  return_tracking_number TEXT NULL,                                -- if return label issued
  -- label
  label_media_id UUID NULL REFERENCES media(id),                   -- PDF stored
  label_format TEXT NULL CHECK (label_format IN ('pdf_a4','pdf_a6','zpl','epl','png') OR label_format IS NULL),
  label_generated_at TIMESTAMPTZ NULL,
  -- status
  status TEXT NOT NULL CHECK (status IN (
    'draft','pending','ready_to_ship','label_generated','handed_over',
    'in_transit','out_for_delivery','delivered','collected_pickup',
    'failed_delivery','returned_to_sender','cancelled','lost'
  )) DEFAULT 'draft',
  status_entered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- dimensions / weight
  weight_grams INTEGER NULL,
  length_mm INTEGER NULL,
  width_mm INTEGER NULL,
  height_mm INTEGER NULL,
  declared_value_amount BIGINT NULL,                                -- for customs / insurance
  declared_value_currency CHAR(3) NULL,
  -- COD
  is_cod BOOLEAN NOT NULL DEFAULT false,
  cod_amount BIGINT NULL,
  cod_currency CHAR(3) NULL,
  cod_collected_at TIMESTAMPTZ NULL,
  -- insurance
  is_insured BOOLEAN NOT NULL DEFAULT false,
  insurance_amount BIGINT NULL,
  insurance_currency CHAR(3) NULL,
  -- delivery
  shipped_at TIMESTAMPTZ NULL,
  estimated_delivery_at TIMESTAMPTZ NULL,
  delivered_at TIMESTAMPTZ NULL,
  delivery_attempts_count INTEGER NOT NULL DEFAULT 0,
  delivery_signature_required BOOLEAN NOT NULL DEFAULT false,
  delivery_signature_image_media_id UUID NULL REFERENCES media(id),
  recipient_id_check_required BOOLEAN NOT NULL DEFAULT false,       -- age-restricted goods
  -- cost
  cost_amount BIGINT NULL,                                          -- our cost (merchant pays carrier)
  cost_currency CHAR(3) NULL,
  charged_amount BIGINT NULL,                                       -- what we charged customer
  charged_currency CHAR(3) NULL,
  -- notes
  delivery_instructions TEXT NULL,
  internal_notes TEXT NULL,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL,
  updated_by UUID NULL,
  version INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_shipments_pub_id UNIQUE (tenant_id, pub_id),
  CONSTRAINT uq_shipments_number UNIQUE (tenant_id, number),
  CONSTRAINT uq_shipments_tracking UNIQUE (tenant_id, carrier_code, tracking_number) DEFERRABLE INITIALLY IMMEDIATE,
  CONSTRAINT ck_cod_amount CHECK ((is_cod = false AND cod_amount IS NULL) OR (is_cod = true AND cod_amount > 0))
);

CREATE INDEX idx_shipments_order ON shipments (order_id, created_at);
CREATE INDEX idx_shipments_status ON shipments (tenant_id, status, status_entered_at DESC);
CREATE INDEX idx_shipments_carrier_tracking ON shipments (carrier_code, tracking_number) WHERE tracking_number IS NOT NULL;
CREATE INDEX idx_shipments_warehouse ON shipments (warehouse_id, status) WHERE status IN ('draft','pending','ready_to_ship');
CREATE INDEX idx_shipments_cod_uncollected ON shipments (tenant_id) WHERE is_cod = true AND cod_collected_at IS NULL AND status NOT IN ('delivered','cancelled','returned_to_sender','lost');
```

### 3.2 `shipment_items` ([ENT-SHIPMENT-ITEM-001](03-data-models-master.md#ent-shipment-item-001))

Partial fulfillment: per-order-item which shipment ships which qty.

```sql
CREATE TABLE shipment_items (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES order_items(id),
  variant_id UUID NOT NULL REFERENCES product_variants(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  weight_grams INTEGER NULL,
  CONSTRAINT uq_shipment_items UNIQUE (shipment_id, order_item_id)
);

CREATE INDEX idx_shipment_items_order_item ON shipment_items (order_item_id);
```

### 3.3 `shipment_events` ([ENT-SHIPMENT-EVENT-001](03-data-models-master.md#ent-shipment-event-001))

Append-only tracking log z carrier webhooks.

```sql
CREATE TABLE shipment_events (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  status TEXT NOT NULL,                                           -- carrier-normalized status
  carrier_raw_status TEXT NULL,                                    -- original carrier code
  description TEXT NULL,
  location TEXT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('webhook','poll','manual','system')) DEFAULT 'webhook',
  raw_payload JSONB NULL,
  is_customer_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
) PARTITION BY RANGE (occurred_at);

CREATE INDEX idx_shipment_events_shipment ON shipment_events (shipment_id, occurred_at DESC);
CREATE INDEX brin_shipment_events_occurred_at ON shipment_events USING BRIN (occurred_at);
```

### 3.4 `shipping_zones` ([ENT-SHIPPING-ZONE-001](03-data-models-master.md#ent-shipping-zone-001))

```sql
CREATE TABLE shipping_zones (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,                                             -- "CZ", "EU", "Outside EU"
  country_codes CHAR(2)[] NOT NULL DEFAULT '{}',
  region_codes TEXT[] NULL,                                        -- e.g., DE Bundesländer (NULL = all regions)
  postal_code_patterns TEXT[] NULL,                                -- regex/ranges for finer zones (Fáze 2+)
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,                             -- higher matches first (e.g., specific country > EU zone)
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT uq_shipping_zones_tenant_name UNIQUE (tenant_id, name)
);

CREATE INDEX idx_shipping_zones_active ON shipping_zones (tenant_id, priority DESC) WHERE is_active = true;
```

### 3.5 `shipping_rates` ([ENT-SHIPPING-RATE-001](03-data-models-master.md#ent-shipping-rate-001))

```sql
CREATE TABLE shipping_rates (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  shipping_zone_id UUID NOT NULL REFERENCES shipping_zones(id) ON DELETE CASCADE,
  carrier_code TEXT NOT NULL,
  service_code TEXT NOT NULL,
  display_name TEXT NOT NULL,                                      -- "Zásilkovna výdejní místo"
  description TEXT NULL,
  icon_media_id UUID NULL REFERENCES media(id),
  -- rate calculation
  kind TEXT NOT NULL CHECK (kind IN ('flat','weight_based','price_based','free_above_threshold','dimensional','custom_plugin')),
  amount BIGINT NULL,                                              -- flat amount
  currency CHAR(3) NOT NULL,
  tiers JSONB NULL,                                                 -- [{ "min_weight": 0, "max_weight": 1000, "amount": 9900 }, ...] pro weight_based
                                                                    -- nebo [{ "min_subtotal": 0, "max_subtotal": 100000, "amount": 9900 }, ...] pro price_based
  free_above_amount BIGINT NULL,                                    -- pro free_above_threshold
  dimensional_factor INTEGER NULL,                                  -- volumetric weight divisor (e.g., 5000 = cm³ → kg)
  plugin_handler TEXT NULL,                                          -- pro custom_plugin
  -- supplement options
  cod_supplement_amount BIGINT NULL,                                 -- extra fee if COD
  cod_supplement_currency CHAR(3) NULL,
  insurance_supplement_percent INTEGER NULL,                         -- basis points of insured value
  insurance_supplement_min BIGINT NULL,
  -- carrier service properties (cached display)
  estimated_days_min INTEGER NULL,
  estimated_days_max INTEGER NULL,
  cutoff_time TIME NULL,                                              -- past this time → estimate +1 day
  weekend_delivery BOOLEAN NOT NULL DEFAULT false,
  pickup_only BOOLEAN NOT NULL DEFAULT false,
  requires_signature_default BOOLEAN NOT NULL DEFAULT false,
  supports_cod BOOLEAN NOT NULL DEFAULT false,
  supports_insurance BOOLEAN NOT NULL DEFAULT false,
  -- constraints
  min_weight_grams INTEGER NULL,
  max_weight_grams INTEGER NULL,                                      -- product matching cart weight must fit
  max_length_mm INTEGER NULL,
  max_width_mm INTEGER NULL,
  max_height_mm INTEGER NULL,
  max_dimensions_sum_mm INTEGER NULL,                                 -- "length+width+height ≤ X"
  excluded_product_tags TEXT[] NULL,                                  -- e.g., 'hazmat','fragile'
  excluded_postal_code_patterns TEXT[] NULL,
  required_customer_group_id UUID NULL REFERENCES customer_groups(id), -- only for B2B group, e.g.
  -- visibility / availability
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_visible_in_checkout BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,                                 -- ordering in checkout list
  starts_at TIMESTAMPTZ NULL,                                          -- promotional window
  ends_at TIMESTAMPTZ NULL,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_shipping_rates_unique
    UNIQUE (shipping_zone_id, carrier_code, service_code) DEFERRABLE INITIALLY IMMEDIATE
);

CREATE INDEX idx_shipping_rates_zone ON shipping_rates (shipping_zone_id) WHERE is_active = true;
CREATE INDEX idx_shipping_rates_tenant_carrier ON shipping_rates (tenant_id, carrier_code, is_active);
```

### 3.6 `pickup_points` ([ENT-PICKUP-POINT-001](03-data-models-master.md#ent-pickup-point-001))

```sql
CREATE TABLE pickup_points (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  carrier_code TEXT NOT NULL,
  external_id TEXT NOT NULL,                                        -- carrier's own ID (Zásilkovna point ID, ČP balíkovna ID)
  name TEXT NOT NULL,
  -- address
  address_snapshot JSONB NOT NULL,
  street1 TEXT NULL,
  street2 TEXT NULL,
  city TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  country_code CHAR(2) NOT NULL,
  region TEXT NULL,
  latitude NUMERIC(9,6) NULL,
  longitude NUMERIC(9,6) NULL,
  -- properties
  opening_hours JSONB NULL,                                           -- weekly schedule
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_24_7 BOOLEAN NOT NULL DEFAULT false,
  is_indoor BOOLEAN NULL,
  has_parking BOOLEAN NULL,
  has_wheelchair_access BOOLEAN NULL,
  supports_cod BOOLEAN NOT NULL DEFAULT true,
  max_weight_grams INTEGER NULL,
  max_dimensions_sum_mm INTEGER NULL,
  -- sync
  last_synced_at TIMESTAMPTZ NULL,
  sync_source TEXT NULL,                                              -- 'api','csv_feed','manual'
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_pickup_points_carrier_external UNIQUE (carrier_code, external_id)
);

CREATE INDEX idx_pickup_points_country_postal ON pickup_points (country_code, postal_code) WHERE is_active = true;
CREATE INDEX idx_pickup_points_geo ON pickup_points USING GIST (point(longitude, latitude)) WHERE is_active = true;
CREATE INDEX idx_pickup_points_active_carrier ON pickup_points (carrier_code) WHERE is_active = true;
```

**Platform-wide:** žádný `tenant_id` (sdílený číselník napříč tenanty). Carrier-owned data.

### 3.7 `shipping_provider_configs`

Per-tenant carrier credentials + settings (paralelně k `payment_provider_configs`).

```sql
CREATE TABLE shipping_provider_configs (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  carrier_code TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  is_test_mode BOOLEAN NOT NULL DEFAULT true,
  display_name TEXT NOT NULL,
  credentials_vault_path TEXT NULL,
  webhook_secret_vault_path TEXT NULL,
  webhook_endpoint_url TEXT NULL,
  sender_address_snapshot JSONB NULL,                                  -- merchant's return address
  sender_phone TEXT NULL,
  sender_email CITEXT NULL,
  default_label_format TEXT CHECK (default_label_format IN ('pdf_a4','pdf_a6','zpl','epl') OR default_label_format IS NULL) DEFAULT 'pdf_a4',
  options JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_shipping_provider_configs UNIQUE (tenant_id, carrier_code)
);

CREATE INDEX idx_shipping_provider_configs_enabled
  ON shipping_provider_configs (tenant_id)
  WHERE is_enabled = true;
```

### 3.8 `shipping_webhook_events`

```sql
CREATE TABLE shipping_webhook_events (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  carrier_code TEXT NOT NULL,
  provider_event_id TEXT NULL,                                          -- may not exist; some carriers don't provide
  event_type TEXT NOT NULL,
  related_shipment_id UUID NULL REFERENCES shipments(id),
  payload JSONB NOT NULL,
  signature_verified BOOLEAN NOT NULL DEFAULT false,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ NULL,
  processing_error TEXT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT uq_shipping_webhook_events
    UNIQUE (carrier_code, provider_event_id) DEFERRABLE INITIALLY IMMEDIATE
) PARTITION BY RANGE (received_at);

CREATE INDEX idx_shipping_webhook_unprocessed ON shipping_webhook_events (received_at) WHERE processed_at IS NULL;
CREATE INDEX brin_shipping_webhook_received ON shipping_webhook_events USING BRIN (received_at);
```

### 3.9 Vztahy

```
tenants (1)──(N) shipping_provider_configs
tenants (1)──(N) shipping_zones (1)──(N) shipping_rates
orders (1)──(N) shipments
shipments (1)──(N) shipment_items (each refs order_item)
shipments (1)──(N) shipment_events
shipments (N)──(1) warehouses
shipments (N)──(0..1) pickup_points
pickup_points (carrier-wide, no tenant_id)
shipments (1)──(0..1) media (label)
shipments (1)──(0..1) media (signature image)
```

---

## 4. Carrier abstraction & MVP carriers

### 4.1 `ShippingCarrier` interface

```typescript
interface ShippingCarrier {
  readonly code: string;
  readonly capabilities: CarrierCapabilities;

  // Rate calculation
  calculateRates(input: RateRequest): Promise<RateResult[]>;     // for live-rate carriers

  // Shipment creation
  createShipment(input: CreateShipmentInput): Promise<CreateShipmentResult>;
                                                                  // returns: carrier_shipment_id, tracking_number, label PDF
  cancelShipment(carrierShipmentId: string): Promise<void>;
  
  // Label
  generateLabel(carrierShipmentId: string, format: LabelFormat): Promise<LabelResult>;
                                                                  // base64 PDF or ZPL
  generateReturnLabel(carrierShipmentId: string): Promise<LabelResult>;
  
  // Tracking
  getTracking(trackingNumber: string): Promise<TrackingResult>;
  
  // Pickup points (for carriers offering pickup network)
  listPickupPoints(filter: PickupFilter): Promise<PickupPoint[]>;
  
  // Webhook
  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean;
  parseWebhookEvent(payload: object): NormalizedShipmentEvent;
}

interface CarrierCapabilities {
  supportsCod: boolean;
  supportsInsurance: boolean;
  supportsLabelGeneration: boolean;          // can issue labels via API
  supportsLiveRates: boolean;                 // dynamic pricing API
  supportsPickupPoints: boolean;
  supportsReturnLabels: boolean;
  supportsBatchPickup: boolean;                // schedule pickup of multiple shipments
  maxWeightGrams: number;
  maxDimensionsSumMm: number;
  servesCountries: string[];                  // ISO 3166-1 alpha-2
  labelFormats: LabelFormat[];                 // ['pdf_a4', 'pdf_a6', 'zpl', ...]
  trackingEventTypes: string[];
}
```

### 4.2 MVP carriers matrix

| Carrier | Country | Services | COD | Insurance | Pickup points | Live rates | Labels |
|---|---|---|---|---|---|---|---|
| **Zásilkovna** (Packeta CZ) | CZ + EU | pickup_point, home_delivery | ✅ | ✅ | ✅ (8000+ v CZ) | ✅ | ✅ PDF A6 |
| **PPL** | CZ + SK + EU | door, parcelbox, COD | ✅ | ✅ | ✅ (limited) | ✅ | ✅ PDF |
| **Česká pošta** (ČP) | CZ + worldwide | Balík do ruky, Balík do balíkovny, Balík na poštu, EMS | ✅ | ✅ | ✅ (Balíkovny, pošty) | ❌ (rate cards) | ✅ PDF |
| **DPD** | CZ + EU | classic, express, pickup | ✅ | ✅ | ✅ | ✅ | ✅ PDF |
| **Packeta SK** | SK | pickup_point, home | ✅ | ✅ | ✅ (SK) | ✅ | ✅ |
| **GLS** (DE, Fáze 2) | DE + EU | parcelshop, business | ✅ | ✅ | ✅ | ✅ | ✅ |

### 4.3 Carrier service codes mapping

Each carrier has internal service codes; we normalize:

| Normalized service_code | Zasilkovna | PPL | ČP | DPD |
|---|---|---|---|---|
| `home_delivery` | "DHL" / standard | "Balík Den večer" | "Balík do ruky" | "Classic" |
| `pickup_point` | "Z-BOX" / "výdejna" | "Parcelshop" | "Balíkovna" | "PickUp" |
| `express` | n/a | "Expres CZ" | "EMS" | "Express 12:00" |
| `parcel_locker` | "Z-BOX" | n/a | "Balíkomat" | "Locker" |

### 4.4 Plugin carrier

`shipping_rates.kind='custom_plugin'` + `plugin_handler` = qualified handler. Plugin implements `ShippingCarrier` interface; loaded at runtime.

Pro: dropshipping (supplier ships directly, no carrier API call, just instructions), regional couriers, in-house delivery.

---

## 5. Rate calculation pipeline

Critical: deterministic, cacheable, called at checkout step 3.

### 5.1 Input

```typescript
interface RateRequest {
  cart_items: CartItem[];           // weight, dimensions, value, tags
  cart_subtotal_amount: bigint;
  cart_currency: string;
  shipping_address: Address;        // postal code + country required
  customer_group_id?: string;
  channel_id?: string;
  warehouse_id?: string;             // if pre-allocated; otherwise auto-pick default
  preferred_pickup_point_id?: string; // hint
  timestamp: Date;                   // for promotional windows
}
```

### 5.2 Pipeline stages

```
STAGE 1: Resolve shipping zone
  For each zone where tenant_id matches:
    Check country_codes contains shipping_address.country_code
    Check region_codes is NULL or contains shipping_address.region
    Check postal_code_patterns (if defined) regex match
  Sort by priority DESC
  Pick first match (or fail "no zone for address")

STAGE 2: Compute cart weight & dimensions
  total_weight = sum(item.weight_grams * item.quantity)
  total_subtotal = cart.subtotal_amount
  // Box packing simulation (simplified MVP): max dimension along each axis;
  //   more sophisticated bin-packing v1.0+
  total_dimensions = compute_bounding_box(items)

STAGE 3: Filter applicable shipping_rates
  For each shipping_rate in shipping_zone:
    Skip if !is_active OR !is_visible_in_checkout
    Skip if time window: starts_at > now OR ends_at < now
    Skip if min_weight_grams > total_weight
    Skip if max_weight_grams < total_weight
    Skip if max_length_mm < bounding_box.max_dimension OR similar
    Skip if any item has tag in excluded_product_tags
    Skip if shipping_address.postal_code matches any excluded_postal_code_patterns
    Skip if required_customer_group_id is set AND customer.group ≠ that
    Skip if rate.carrier requires COD but cart's payment_method isn't COD-compatible (Fáze 2 cross-domain)

STAGE 4: Calculate rate amount per applicable rate
  For each applicable rate:
    Switch rate.kind:
      case 'flat':            amount = rate.amount
      case 'weight_based':    amount = lookup_tier(rate.tiers, total_weight, key='weight')
      case 'price_based':     amount = lookup_tier(rate.tiers, total_subtotal, key='subtotal')
      case 'free_above_threshold':  amount = (total_subtotal >= free_above_amount) ? 0 : rate.amount
      case 'dimensional':     volumetric_weight = bounding_box_volume_cm3 / dimensional_factor
                              amount = lookup_tier(rate.tiers, max(volumetric_weight, total_weight))
      case 'custom_plugin':   amount = plugin.calculate(rate, RateRequest)
    
    if cod_requested AND rate.cod_supplement_amount:
      amount += rate.cod_supplement_amount
    if insurance_requested AND rate.insurance_supplement_percent:
      insurance_fee = max(insurance_supplement_min, (declared_value * insurance_supplement_percent) / 10000)
      amount += insurance_fee
    
  Apply currency: if rate.currency ≠ cart.currency, convert via exchange_rates

STAGE 5: Live rate enrichment (optional, carrier-supported)
  For carriers with supportsLiveRates:
    Call carrier.calculateRates(input) async with timeout 2s
    If success: replace pre-computed rate amount with live rate
    If fail/timeout: use pre-computed (graceful degradation)
  Cache live rate results 10 min per (cart_hash, address_hash)

STAGE 6: Compute ETA per rate
  estimated_delivery_at = compute_eta(
    warehouse.cutoff_time,
    warehouse.timezone,
    rate.estimated_days_min,
    rate.estimated_days_max,
    rate.weekend_delivery,
    now()
  )
  // If past cutoff_time: shifts by 1 business day

STAGE 7: Build response list
  For each rate:
    {
      shipping_rate_id, carrier_code, service_code, display_name, icon_url,
      amount, currency, tax_amount (delegated to 15),
      estimated_delivery_min_at, estimated_delivery_max_at,
      requires_pickup_point: rate.pickup_only,
      supports_cod: rate.supports_cod,
      supports_insurance: rate.supports_insurance,
      requires_signature: rate.requires_signature_default,
      restrictions: { max_weight_grams, max_dimensions_sum_mm },
    }
  Sort by priority DESC, then by amount ASC

OUTPUT: List of available rates for checkout step 3
```

### 5.3 Pseudocode

```typescript
function calculateShippingRates(input: RateRequest): Promise<RateOption[]> {
  // Cache key
  const cacheKey = hashRateInput(input);
  const cached = await redis.get(`shipping_rates:${cacheKey}`);
  if (cached) return JSON.parse(cached);

  // Stage 1: zone
  const zone = resolveShippingZone(input.shipping_address, input.tenant_id);
  if (!zone) throw new NoZoneError();
  
  // Stage 2: cart metrics
  const totalWeight = computeTotalWeight(input.cart_items);
  const dimensions = computeBoundingBox(input.cart_items);
  
  // Stage 3-4: filter + compute per rate
  const candidates = await loadRatesForZone(zone.id);
  const computed: RateOption[] = [];
  for (const rate of candidates) {
    if (!isApplicable(rate, input, totalWeight, dimensions)) continue;
    const amount = await computeRateAmount(rate, input, totalWeight, dimensions);
    computed.push(buildRateOption(rate, amount, input));
  }
  
  // Stage 5: live rate enrichment
  await Promise.all(computed.map(async opt => {
    if (carriers[opt.carrier_code].capabilities.supportsLiveRates) {
      try {
        const live = await carriers[opt.carrier_code].calculateRates({ ... }, { timeout: 2000 });
        if (live[0]) opt.amount = live[0].amount;
      } catch { /* graceful degradation */ }
    }
  }));
  
  // Stage 6: ETA
  const warehouse = await getDefaultOrAllocatedWarehouse(input);
  for (const opt of computed) {
    const eta = computeEta(warehouse.cutoff_time, warehouse.timezone, opt.estimated_days_min, opt.estimated_days_max, opt.weekend_delivery, input.timestamp);
    opt.estimated_delivery_min_at = eta.min;
    opt.estimated_delivery_max_at = eta.max;
  }
  
  // Stage 7: sort
  computed.sort((a, b) => (b.priority - a.priority) || (a.amount - b.amount));
  
  await redis.setEx(`shipping_rates:${cacheKey}`, 300, JSON.stringify(computed)); // 5 min cache
  return computed;
}
```

### 5.4 ETA computation

```typescript
function computeEta(
  cutoffTime: string,           // "16:00"
  timezone: string,              // "Europe/Prague"
  daysMin: number,
  daysMax: number,
  weekendDelivery: boolean,
  now: Date
): { min: Date, max: Date } {
  const tzNow = utcToZonedTime(now, timezone);
  const cutoff = parseTime(cutoffTime); // 16:00 in tz
  
  let shipDayOffset = 0;
  if (tzNow.getHours() >= cutoff.hours && tzNow.getMinutes() >= cutoff.minutes) {
    shipDayOffset = 1; // past cutoff, ship next business day
  }
  
  const shipDate = addBusinessDays(tzNow, shipDayOffset, { includeWeekends: weekendDelivery });
  const minDelivery = addBusinessDays(shipDate, daysMin, { includeWeekends: weekendDelivery });
  const maxDelivery = addBusinessDays(shipDate, daysMax, { includeWeekends: weekendDelivery });
  
  return { min: minDelivery, max: maxDelivery };
}
```

---

## 6. State machines

### 6.1 Shipment status lifecycle

```
                     ┌──── cancel (pre-handover) ──────────────────────┐
                     │                                                  │
[draft] ──prepare──▶ [pending] ──gen-label──▶ [label_generated]         │
                                                    │                   │
                                                    │ carrier pickup    │
                                                    ▼                   │
                                            [handed_over]               │
                                                    │                   │
                                                    │ in transit        │
                                                    ▼                   │
                                            [in_transit]                │
                                                    │                   │
                                              ┌─────┴─────┐             │
                                              │           │             │
                                  [out_for_delivery]  [collected_pickup]│
                                              │           │             │
                              ┌───────────────┘           │             │
                              │                            │             │
                       [delivered] ◀───────────────────────┘             │
                              │                                          │
                              │ delivery failed (e.g., not at home)      │
                              ▼                                          │
                      [failed_delivery]                                  │
                              │                                          │
                              ├── retry attempts ──▶ [out_for_delivery]   │
                              │                                          │
                              └── exhausted ──▶ [returned_to_sender]      │
                                                                          │
[lost] ──carrier reports lost (very rare) ◀───────────────────────────────┘

[cancelled] ─── terminal pre-handover only
```

**Transitions:**

| From | Event | To | Side effect |
|---|---|---|---|
| `(none)` | `create_shipment` | `draft` or `pending` | Insert row, optionally pre-call carrier to reserve tracking |
| `draft` | `confirm` | `pending` | Validate items, warehouse, address |
| `pending` | `generate_label` | `label_generated` | Carrier API call → label PDF, tracking_number; emit EVENT-LABEL-GENERATED |
| `label_generated` | `cancel` | `cancelled` | Cancel with carrier; release inventory if applicable |
| `label_generated` | `mark_handed_over` | `handed_over` | Warehouse staff marks pickup done |
| `handed_over` / `label_generated` | `carrier_picked_up` (webhook) | `in_transit` | EVENT-SHIPMENT-IN-TRANSIT |
| `in_transit` | `carrier_out_for_delivery` (webhook) | `out_for_delivery` | Customer notification |
| `in_transit` | `arrived_at_pickup_point` (webhook) | (event only, status stays in_transit) | Customer notification "ready for pickup" |
| `out_for_delivery` | `carrier_delivered` (webhook) | `delivered` | EVENT-SHIPMENT-DELIVERED; trigger COD capture if applicable |
| `in_transit` | `customer_collected` (pickup_point service) | `collected_pickup` → `delivered` | |
| `out_for_delivery` | `delivery_failed` (webhook) | `failed_delivery` | Retry scheduling |
| `failed_delivery` | `retry_delivery` (webhook) | `out_for_delivery` | |
| `failed_delivery` | `attempts_exhausted` (carrier policy) | `returned_to_sender` | Order may auto-cancel per merchant rule |
| `in_transit` | `carrier_lost_package` (rare webhook) | `lost` | Insurance claim |

### 6.2 Label generation lifecycle

```
[no label] ──API call──▶ [label_generating] ──success──▶ [label_generated, media_id set]
                                  │                              │
                                  ├──API error──▶ [label_failed] │
                                  │                              │
                                  └──retry──▶ [label_generating] ┘
```

If carrier API down: keep state `pending`; retry via `JOB-RETRY-LABEL-GENERATION` with exponential backoff (1m, 5m, 30m, 1h).

### 6.3 COD capture lifecycle (coordinates with `13`)

```
Shipment created (is_cod=true)
  ▼
Payment row (provider='cod', status='pending')
  ▼
Shipment delivered (webhook)
  ▼
Trigger JOB-COD-CAPTURE-FROM-CARRIER
  ▼
Update payment.status='captured', captured_at=now()
  ▼
Update order.payment_status='paid'
```

If shipment `returned_to_sender`: payment status → `cancelled` (no capture); order auto-cancelled (configurable).

---

## 7. Business rules

### RULE-SHIP-001: Zone resolution priority

When customer address matches multiple shipping_zones (e.g., "CZ" zone + "EU" zone), zone with higher `priority` wins. Tie-breaker: more specific (postal_code_patterns > region_codes > country_codes).

### RULE-SHIP-002: Carrier service code immutable post-shipment-creation

Once shipment in `label_generated` state, cannot change carrier_code or service_code. Customer must cancel + create new shipment.

### RULE-SHIP-003: Weight calculation precedence

Per shipment item: `variant.weight_grams` (if set), fallback to `product.weight_grams` (default), fallback to tenant default (e.g., 500g per item). Logged warning if multiple items lack weight.

### RULE-SHIP-004: Live rate timeout 2s

If carrier live rate API times out: fall back to configured `shipping_rates.tiers`. No checkout block.

If carrier live rate API returns 0 rates (e.g., postal code unsupported): exclude that carrier from result list; surface warning to customer.

### RULE-SHIP-005: Multi-warehouse fulfillment (v1.0+ MSI)

If order_items span multiple warehouses (per `09` allocation), create multiple shipments — one per warehouse. Each gets own tracking_number, label.

MVP: single warehouse per order; 1 shipment. v1.0+: split fulfillment.

### RULE-SHIP-006: Partial shipment

Shipment may cover subset of order_items (e.g., backorder item ships later). `shipment_items` rows with `quantity ≤ order_items.quantity`. Order's `fulfillment_status` derived: `unfulfilled`, `partially_fulfilled`, `fulfilled`, `returned`.

### RULE-SHIP-007: COD reconciliation

When shipment `is_cod=true` and `cod_collected_at IS NULL` after 7 days post-delivery: alert merchant (carrier hasn't reported collection). Manual investigation needed.

If carrier reports cash not collected (failed_delivery + returned): mark `cod_collected_at=NULL`, order auto-cancels.

### RULE-SHIP-008: Insurance auto-trigger

If `declared_value_amount > tenant.settings.shipping_insurance_auto_threshold` (default 5000 CZK): auto-add insurance regardless of customer choice. Merchant configurable.

### RULE-SHIP-009: Label format per warehouse

Different warehouses may use different printers (A4 office, A6 thermal). `warehouses.metadata.preferred_label_format` overrides carrier default.

### RULE-SHIP-010: Pickup point validity check

When checkout uses pickup_point: re-check `pickup_points.is_active=true` at confirm. Carriers occasionally deactivate points (renovation, closure). Failure → ask customer to pick another.

### RULE-SHIP-011: Pickup point capacity (Fáze 2)

Carriers may impose capacity limits (e.g., Zásilkovna point full). MVP: don't track capacity; rely on carrier error at label generation. v1.0+: query capacity API + show "approaching capacity" badge.

### RULE-SHIP-012: International shipping requirements

Customs declarations (Fáze 2):
- HS code per item (configurable per product)
- Total declared value
- Reason for export (e.g., "sale")
- IOSS number (EU intra → < €150 IOSS scheme; > requires DDP/DDU)
- Customs ID per recipient (e.g., Brazilian CPF)

MVP scope: EU intra (no customs needed under €150); non-EU shipping flagged as "v1.0+ feature, contact merchant directly".

### RULE-SHIP-013: Address validation gate at label gen

Before calling carrier API for label: validate address one more time (postal_code regex, required fields). Carrier-side validation can be expensive; fail-fast.

### RULE-SHIP-014: Tracking events visibility

`shipment_events.is_customer_visible`: most events true (handed_over, in_transit, delivered). Internal events (label_generation_retried, manual_override) `false` — admin sees, customer doesn't.

### RULE-SHIP-015: Tracking number uniqueness

`(carrier_code, tracking_number)` UNIQUE per tenant. Same tracking number across tenants OK (different account at carrier).

### RULE-SHIP-016: Return label issuance

Triggered from RMA workflow (`17-returns-refunds.md`). Carrier API call: `generateReturnLabel(original_shipment_id)` or `createShipment(reverse_input)`. Stored as `return_tracking_number` on original shipment, OR as separate shipment row with `metadata.return_of_shipment_id`.

### RULE-SHIP-017: BOPIS — pickup at warehouse (v1.0+)

`warehouses.pickup_enabled=true` and `shipping_rate.kind='pickup_at_warehouse'` (special pseudo-carrier `inhouse`). No label generated; customer notified when ready.

Status flow: `pending → ready_to_ship → ready_for_pickup → delivered (collected)`. No carrier involvement.

### RULE-SHIP-018: Free shipping promotion

`free_above_threshold` shipping rate where amount = 0 when cart subtotal ≥ free_above_amount. Implicit promotion; can stack with discount engine free_shipping discount (per `10`).

Conflict resolution: if both qualify, take the more generous (typically 0 either way).

### RULE-SHIP-019: Pickup point sync cadence

`JOB-PICKUP-SYNC-{carrier}` runs daily 03:00 per carrier:
- Fetch full point list (or delta) from carrier API
- Insert new, update changed (compare `last_synced_at`)
- Soft-delete points removed from carrier feed (set `is_active=false`)

### RULE-SHIP-020: Estimated delivery in customer-facing UI

Shown as range: "Pondělí 25. – středa 27. května 2026" (cs locale). Single date if min=max.

If estimate is "next business day", call it out explicitly: "Zítra (úterý)" — friendlier UX.

### RULE-SHIP-021: Webhook out of order

Carrier webhooks may arrive out of sequence (e.g., `delivered` before `out_for_delivery`). Apply per timestamp `occurred_at`, ignore if status regression unless `manual_override`.

### RULE-SHIP-022: Manual status override (admin)

Admin może force-set shipment status (e.g., customer reports delivery but carrier hasn't updated). `internal_notes` records reason. Audit log entry 100%.

### RULE-SHIP-023: Carrier API key rotation

Stored in Vault (DEC-SEC-002). Rotation procedure: tenant initiates → new key activated → old key still valid for in-flight shipments (24h overlap) → old key deactivated.

### RULE-SHIP-024: Sender address per shipment

`shipping_provider_configs.sender_address_snapshot` is default. Per shipment may override (e.g., dropshipping where sender is supplier, not merchant).

### RULE-SHIP-025: Dimensional weight (volumetric)

Some carriers charge max(actual_weight, volumetric_weight). Volumetric = (L × W × H) / divisor (typically 5000 for cm). Per `shipping_rates.dimensional_factor`.

### RULE-SHIP-026: Excluded products from carrier

Tag-based exclusions (`shipping_rates.excluded_product_tags`): e.g., "hazmat" cannot ship via Česká pošta letecky. Filter at rate calc.

### RULE-SHIP-027: Cutoff time business day

Past cutoff_time on Friday → ship Monday (skipping weekend unless `weekend_delivery=true`). Holiday calendar per country (Fáze 2 — MVP uses hardcoded CZ/SK/DE/EN basic holidays).

### RULE-SHIP-028: Order shipping_amount snapshot

`orders.shipping_amount` snapshot at order placement. Subsequent shipping_rate changes do not affect placed orders. Mirror pattern from pricing (per `10`).

### RULE-SHIP-029: Customer self-service tracking

`GET /storefront/shipments/{tracking_number}/track` returns customer-visible events. Public (no auth) but rate-limited. Provides tracking_url to carrier's page as fallback.

### RULE-SHIP-030: Shipment cancellation rules

Cancellation allowed:
- `draft`, `pending`: always
- `label_generated`: only if not yet handed over (within carrier-defined window, typically 1-4 hours)
- `handed_over` and beyond: NOT possible via API; customer must refuse delivery or initiate return

### RULE-SHIP-031: Bulk label generation

Admin selects N orders, clicks "Generate labels" → batch API call (or serial per carrier API limits). Returns multi-page PDF.

---

## 8. REST API endpoints

### 8.1 Provider configuration (admin)

```
GET    /api/{date}/shipping/providers
GET    /api/{date}/shipping/providers/{code}/config
PATCH  /api/{date}/shipping/providers/{code}/config
POST   /api/{date}/shipping/providers/{code}/config:test-connection
POST   /api/{date}/shipping/providers/{code}/config:rotate-secret
```

### 8.2 Zones

```
GET    /api/{date}/shipping/zones
POST   /api/{date}/shipping/zones
GET    /api/{date}/shipping/zones/{id}
PATCH  /api/{date}/shipping/zones/{id}
DELETE /api/{date}/shipping/zones/{id}
```

### 8.3 Rates

```
GET    /api/{date}/shipping/rates
POST   /api/{date}/shipping/rates
GET    /api/{date}/shipping/rates/{id}
PATCH  /api/{date}/shipping/rates/{id}
DELETE /api/{date}/shipping/rates/{id}
POST   /api/{date}/shipping/rates:bulk
POST   /api/{date}/shipping/rates:calculate          # admin testing tool
```

### 8.4 Pickup points (storefront + admin)

```
GET    /api/{date}/storefront/pickup-points?country=CZ&postal_code=12000&carrier=zasilkovna
GET    /api/{date}/storefront/pickup-points/{id}
GET    /api/{date}/storefront/pickup-points:nearest?lat=50.08&lng=14.42&radius_km=5&carrier=zasilkovna
GET    /api/{date}/storefront/pickup-points:search?q=Praha+5&carrier=zasilkovna&limit=20

POST   /api/{date}/shipping/pickup-points:sync       # admin trigger
GET    /api/{date}/shipping/pickup-points/{carrier_code}/sync-status
```

### 8.5 Shipments

```
GET    /api/{date}/shipments                          # list, filterable by status, carrier, order, warehouse
POST   /api/{date}/shipments                          # create draft (admin/system)
GET    /api/{date}/shipments/{id}
PATCH  /api/{date}/shipments/{id}                      # update internal notes, override address
DELETE /api/{date}/shipments/{id}                      # cancel (pre-handover)
POST   /api/{date}/shipments/{id}:generate-label
POST   /api/{date}/shipments/{id}:regenerate-label    # re-issue (e.g., damaged)
POST   /api/{date}/shipments/{id}:generate-return-label
POST   /api/{date}/shipments/{id}:cancel
POST   /api/{date}/shipments/{id}:mark-handed-over
POST   /api/{date}/shipments/{id}:manual-status-override

POST   /api/{date}/shipments:bulk-generate-labels     # async, returns operation
POST   /api/{date}/shipments:bulk-pickup-handover     # mark N shipments handed over (e.g., daily carrier pickup)
```

### 8.6 Tracking

```
GET    /api/{date}/shipments/{id}/tracking            # full event history
GET    /api/{date}/storefront/shipments/track?tracking_number=...&carrier=...
GET    /api/{date}/storefront/orders/{order_number}/tracking    # all shipments of order
POST   /api/{date}/shipments/{id}/tracking:refresh-from-carrier  # admin force-refresh
```

### 8.7 Rates calculation (called from `12-checkout.md`)

```
POST   /api/{date}/shipping:calculate-rates           # internal API for checkout
       Input: { cart_items, shipping_address, customer_group_id?, channel_id? }
       Output: list of RateOption
```

### 8.8 Webhooks (incoming)

```
POST   /api/{date}/webhooks/zasilkovna/{tenant_pub_id}
POST   /api/{date}/webhooks/ppl/{tenant_pub_id}
POST   /api/{date}/webhooks/ceska-posta/{tenant_pub_id}
POST   /api/{date}/webhooks/dpd/{tenant_pub_id}
POST   /api/{date}/webhooks/packeta-sk/{tenant_pub_id}
```

### 8.9 Example: Calculate rates

```http
POST /api/2026-05-19/shipping:calculate-rates HTTP/1.1
Authorization: Bearer ...

{
  "cart_items": [
    { "variant_id": "var_aB", "quantity": 2, "weight_grams": 500, "tags": ["clothing"] }
  ],
  "cart_subtotal_amount": 88200,
  "cart_currency": "CZK",
  "shipping_address": {
    "country_code": "CZ",
    "postal_code": "120 00",
    "city": "Praha"
  },
  "warehouse_id": "wh_main",
  "with_cod": false,
  "with_insurance": false
}
```

```jsonc
HTTP/1.1 200 OK

{
  "data": [
    {
      "shipping_rate_id": "shr_aB",
      "carrier_code": "zasilkovna",
      "service_code": "pickup_point",
      "display_name": "Zásilkovna výdejní místo",
      "icon_url": "https://cdn.shopio.com/...zasilkovna.svg",
      "amount": 7900,
      "tax_amount": 1659,
      "currency": "CZK",
      "estimated_delivery_min_at": "2026-05-20T09:00:00Z",
      "estimated_delivery_max_at": "2026-05-21T18:00:00Z",
      "estimated_days_min": 1,
      "estimated_days_max": 2,
      "requires_pickup_point": true,
      "supports_cod": true,
      "cod_supplement_amount": 1900,
      "supports_insurance": true,
      "requires_signature": false
    },
    {
      "shipping_rate_id": "shr_xY",
      "carrier_code": "ppl",
      "service_code": "home_delivery",
      "display_name": "PPL doručení na adresu",
      "amount": 11900,
      "tax_amount": 2499,
      "currency": "CZK",
      "estimated_delivery_min_at": "2026-05-20T09:00:00Z",
      "estimated_delivery_max_at": "2026-05-21T20:00:00Z",
      "estimated_days_min": 1,
      "estimated_days_max": 2,
      "requires_pickup_point": false,
      "supports_cod": true,
      "supports_insurance": true
    }
  ],
  "meta": {
    "duration_ms": 145,
    "live_rates_used_for": ["zasilkovna", "ppl"],
    "live_rates_fallback_for": [],
    "warehouse_used": "wh_main",
    "zone_matched": "zone_cz"
  }
}
```

### 8.10 Example: Nearest pickup points

```http
GET /api/2026-05-19/storefront/pickup-points:nearest?lat=50.0879&lng=14.4204&radius_km=2&carrier=zasilkovna&limit=10 HTTP/1.1
```

```jsonc
HTTP/1.1 200 OK
Cache-Control: public, max-age=86400

{
  "data": [
    {
      "id": "pup_aB",
      "type": "pickup_point",
      "attributes": {
        "carrier_code": "zasilkovna",
        "external_id": "Z-12345",
        "name": "Z-BOX Praha 5 - Anděl",
        "street1": "Plzeňská 12",
        "city": "Praha 5",
        "postal_code": "150 00",
        "country_code": "CZ",
        "latitude": 50.0879,
        "longitude": 14.4045,
        "distance_km": 0.95,
        "is_24_7": true,
        "supports_cod": true,
        "opening_hours": { "monday": "00:00-24:00", "tuesday": "00:00-24:00", ... }
      }
    },
    ...
  ]
}
```

### 8.11 Example: Generate label

```http
POST /api/2026-05-19/shipments/shp_aB:generate-label HTTP/1.1
Authorization: Bearer ...
Idempotency-Key: ...

{
  "format": "pdf_a6"
}
```

```jsonc
HTTP/1.1 200 OK

{
  "data": {
    "id": "01927bca-...",
    "pub_id": "shp_aB",
    "type": "shipment",
    "attributes": {
      "status": "label_generated",
      "carrier_code": "zasilkovna",
      "tracking_number": "Z123456789CZ",
      "tracking_url": "https://tracking.packeta.com/Z123456789CZ",
      "label_media_id": "mdi_label_aB",
      "label_url": "https://cdn.shopio.com/labels/...?sig=...",
      "label_format": "pdf_a6",
      "label_generated_at": "2026-05-19T15:30:00Z"
    }
  }
}
```

### 8.12 Example: Track shipment

```http
GET /api/2026-05-19/storefront/shipments/track?tracking_number=Z123456789CZ&carrier=zasilkovna HTTP/1.1
```

```jsonc
HTTP/1.1 200 OK

{
  "data": {
    "tracking_number": "Z123456789CZ",
    "carrier_code": "zasilkovna",
    "tracking_url": "https://tracking.packeta.com/Z123456789CZ",
    "status": "in_transit",
    "estimated_delivery_at": "2026-05-21T18:00:00Z",
    "events": [
      {
        "status": "label_generated",
        "description": "Štítek vygenerován",
        "occurred_at": "2026-05-19T15:30:00Z"
      },
      {
        "status": "handed_over",
        "description": "Předáno přepravci",
        "location": "Praha - depo",
        "occurred_at": "2026-05-19T17:00:00Z"
      },
      {
        "status": "in_transit",
        "description": "Zásilka v přepravě",
        "location": "Brno - tranzit",
        "occurred_at": "2026-05-20T03:15:00Z"
      }
    ]
  }
}
```

---

## 9. GraphQL schema

```graphql
type Shipment implements Node & Timestamped {
  id: ID!
  pubId: String!
  order: Order!
  number: String!
  warehouse: Warehouse!
  carrierCode: String!
  serviceCode: String!
  serviceDisplayName: String!
  shippingAddress: Address!
  pickupPoint: PickupPoint
  trackingNumber: String
  trackingUrl: String
  labelMediaUrl: String
  labelFormat: ShipmentLabelFormat
  status: ShipmentStatus!
  weightGrams: Int
  lengthMm: Int
  widthMm: Int
  heightMm: Int
  declaredValue: Money
  isCod: Boolean!
  codAmount: Money
  codCollectedAt: DateTime
  isInsured: Boolean!
  insuranceAmount: Money
  shippedAt: DateTime
  estimatedDeliveryAt: DateTime
  deliveredAt: DateTime
  deliveryAttemptsCount: Int!
  deliverySignatureRequired: Boolean!
  cost: Money
  chargedAmount: Money
  deliveryInstructions: String
  items: [ShipmentItem!]!
  events: [ShipmentEvent!]!
  createdAt: DateTime!
  updatedAt: DateTime!
  metadata: JSON
}

enum ShipmentStatus {
  DRAFT PENDING READY_TO_SHIP LABEL_GENERATED HANDED_OVER
  IN_TRANSIT OUT_FOR_DELIVERY DELIVERED COLLECTED_PICKUP
  FAILED_DELIVERY RETURNED_TO_SENDER CANCELLED LOST
}

enum ShipmentLabelFormat { PDF_A4 PDF_A6 ZPL EPL PNG }

type ShipmentItem {
  id: ID!
  orderItem: OrderItem!
  variant: ProductVariant!
  quantity: Int!
}

type ShipmentEvent {
  id: ID!
  status: String!
  description: String
  location: String
  occurredAt: DateTime!
  source: ShipmentEventSource!
}

enum ShipmentEventSource { WEBHOOK POLL MANUAL SYSTEM }

type ShippingZone implements Node {
  id: ID!
  name: String!
  countryCodes: [String!]!
  regionCodes: [String!]
  isActive: Boolean!
  priority: Int!
  rates: [ShippingRate!]!
}

type ShippingRate implements Node {
  id: ID!
  shippingZone: ShippingZone!
  carrierCode: String!
  serviceCode: String!
  displayName: String!
  iconUrl: String
  kind: ShippingRateKind!
  amount: Money
  estimatedDaysMin: Int
  estimatedDaysMax: Int
  cutoffTime: String
  weekendDelivery: Boolean!
  pickupOnly: Boolean!
  supportsCod: Boolean!
  supportsInsurance: Boolean!
  isActive: Boolean!
}

enum ShippingRateKind {
  FLAT WEIGHT_BASED PRICE_BASED FREE_ABOVE_THRESHOLD
  DIMENSIONAL CUSTOM_PLUGIN
}

type PickupPoint implements Node {
  id: ID!
  carrierCode: String!
  externalId: String!
  name: String!
  street1: String
  city: String!
  postalCode: String!
  countryCode: String!
  latitude: Float
  longitude: Float
  distanceKm: Float                       # populated when nearest query
  is247: Boolean!
  supportsCod: Boolean!
  openingHours: JSON
  isActive: Boolean!
}

type CarrierConfig implements Node {
  id: ID!
  carrierCode: String!
  isEnabled: Boolean!
  isTestMode: Boolean!
  displayName: String!
  senderAddress: Address
  defaultLabelFormat: ShipmentLabelFormat
}

type RateOption {
  shippingRateId: ID!
  carrierCode: String!
  serviceCode: String!
  displayName: String!
  iconUrl: String
  amount: Money!
  taxAmount: Money
  estimatedDeliveryMinAt: DateTime
  estimatedDeliveryMaxAt: DateTime
  requiresPickupPoint: Boolean!
  supportsCod: Boolean!
  codSupplementAmount: Money
  supportsInsurance: Boolean!
  requiresSignature: Boolean!
  restrictions: ShippingRestrictions
}

type ShippingRestrictions {
  maxWeightGrams: Int
  maxDimensionsSumMm: Int
}

extend type Query {
  shippingZones: [ShippingZone!]! @auth(requires: PERM_SHIPPING_VIEW)
  shippingZone(id: ID!): ShippingZone @auth(requires: PERM_SHIPPING_VIEW)
  shippingRates(zoneId: ID): [ShippingRate!]! @auth(requires: PERM_SHIPPING_VIEW)
  shipments(first: Int, after: String, filter: ShipmentFilter): ShipmentConnection! @auth(requires: PERM_SHIPMENT_VIEW)
  shipment(id: ID, pubId: String, trackingNumber: String): Shipment
  pickupPoints(carrierCode: String, countryCode: String, postalCode: String, near: GeoPointInput, radiusKm: Float, search: String, limit: Int): [PickupPoint!]!
  carrierConfigs: [CarrierConfig!]! @auth(requires: PERM_SHIPPING_VIEW)
  calculateShippingRates(input: RateCalculationInput!): [RateOption!]!
  trackShipment(trackingNumber: String!, carrierCode: String!): ShipmentTrackingResult!
}

type ShipmentTrackingResult {
  trackingNumber: String!
  carrierCode: String!
  trackingUrl: String
  status: String!
  estimatedDeliveryAt: DateTime
  events: [ShipmentEvent!]!
}

extend type Mutation {
  createShippingZone(input: ShippingZoneInput!): ShippingZone! @auth(requires: PERM_SHIPPING_MANAGE)
  updateShippingZone(id: ID!, input: ShippingZoneInput!): ShippingZone! @auth(requires: PERM_SHIPPING_MANAGE)
  deleteShippingZone(id: ID!): DeletePayload! @auth(requires: PERM_SHIPPING_MANAGE)

  createShippingRate(input: ShippingRateInput!): ShippingRate! @auth(requires: PERM_SHIPPING_MANAGE)
  updateShippingRate(id: ID!, input: ShippingRateInput!): ShippingRate! @auth(requires: PERM_SHIPPING_MANAGE)
  deleteShippingRate(id: ID!): DeletePayload! @auth(requires: PERM_SHIPPING_MANAGE)

  updateCarrierConfig(code: String!, input: CarrierConfigInput!): CarrierConfig! @auth(requires: PERM_SHIPPING_CONFIGURE)
  testCarrierConnection(code: String!): TestResult! @auth(requires: PERM_SHIPPING_CONFIGURE)

  createShipment(input: CreateShipmentInput!): Shipment! @auth(requires: PERM_SHIPMENT_MANAGE)
  generateShipmentLabel(id: ID!, format: ShipmentLabelFormat = PDF_A4): Shipment! @auth(requires: PERM_SHIPPING_LABEL_PRINT)
  regenerateShipmentLabel(id: ID!): Shipment! @auth(requires: PERM_SHIPPING_LABEL_PRINT)
  generateReturnLabel(id: ID!): Shipment! @auth(requires: PERM_SHIPPING_LABEL_PRINT)
  cancelShipment(id: ID!, reason: String!): Shipment! @auth(requires: PERM_SHIPMENT_MANAGE)
  markShipmentHandedOver(id: ID!): Shipment! @auth(requires: PERM_SHIPMENT_MANAGE)
  manualShipmentStatusOverride(id: ID!, status: ShipmentStatus!, notes: String!): Shipment! @auth(requires: PERM_SHIPMENT_OVERRIDE)

  bulkGenerateLabels(shipmentIds: [ID!]!, format: ShipmentLabelFormat = PDF_A4): Operation! @auth(requires: PERM_SHIPPING_LABEL_PRINT)
  bulkPickupHandover(shipmentIds: [ID!]!): Operation! @auth(requires: PERM_SHIPMENT_MANAGE)

  syncPickupPoints(carrierCode: String!): Operation! @auth(requires: PERM_SHIPPING_CONFIGURE)
}
```

---

## 10. Events

| Build-spec ID | Wire | Payload |
|---|---|---|
| `EVENT-SHIPMENT-CREATED` | `shipment.created` | `{ shipment }` |
| `EVENT-SHIPMENT-LABEL-GENERATED` | `shipment.label_generated` | `{ shipment, tracking_number, label_url }` |
| `EVENT-SHIPMENT-LABEL-FAILED` | `shipment.label_failed` | `{ shipment, error }` |
| `EVENT-SHIPMENT-HANDED-OVER` | `shipment.handed_over` | `{ shipment }` |
| `EVENT-SHIPMENT-IN-TRANSIT` | `shipment.in_transit` | `{ shipment }` |
| `EVENT-SHIPMENT-OUT-FOR-DELIVERY` | `shipment.out_for_delivery` | `{ shipment }` |
| `EVENT-SHIPMENT-ARRIVED-AT-PICKUP-POINT` | `shipment.arrived_at_pickup_point` | `{ shipment, pickup_point }` |
| `EVENT-SHIPMENT-DELIVERED` | `shipment.delivered` | `{ shipment, signature_image_url? }` |
| `EVENT-SHIPMENT-COLLECTED-PICKUP` | `shipment.collected_pickup` | `{ shipment }` |
| `EVENT-SHIPMENT-FAILED-DELIVERY` | `shipment.failed_delivery` | `{ shipment, attempt_number, reason }` |
| `EVENT-SHIPMENT-RETURNED-TO-SENDER` | `shipment.returned_to_sender` | `{ shipment }` |
| `EVENT-SHIPMENT-LOST` | `shipment.lost` | `{ shipment }` |
| `EVENT-SHIPMENT-CANCELLED` | `shipment.cancelled` | `{ shipment, reason }` |
| `EVENT-SHIPMENT-COD-COLLECTED` | `shipment.cod_collected` | `{ shipment, amount }` |
| `EVENT-SHIPMENT-EVENT-RECORDED` | `shipment.event_recorded` | `{ shipment, event }` |
| `EVENT-RETURN-LABEL-GENERATED` | `return_label.generated` | `{ shipment, return_tracking_number }` |
| `EVENT-CARRIER-CONFIG-CHANGED` | `carrier.config_changed` | `{ carrier_code, changed_fields }` |
| `EVENT-PICKUP-POINTS-SYNCED` | `pickup_points.synced` | `{ carrier_code, new, updated, deactivated }` |
| `EVENT-SHIPPING-ANOMALY-DETECTED` | `shipping.anomaly_detected` | `{ shipment, anomaly_type }` (e.g., "stuck in transit > 14 days") |

**Konzumenti:**
- Order management — `fulfillment_status` sync (`16-order-management.md`)
- Payments — `EVENT-SHIPMENT-DELIVERED` triggers COD capture (`13`)
- Customer notifications — email/SMS at key transitions
- Analytics — delivery performance per carrier
- Returns — when delivered, eligibility window starts
- Webhook delivery — per merchant subscription

---

## 11. Background jobs

| Job | Trigger | Queue | Frequency |
|---|---|---|---|
| `JOB-PROCESS-SHIPPING-WEBHOOK-EVENT` | webhook received | `shipping-webhooks` | On-demand |
| `JOB-RETRY-LABEL-GENERATION` | label_failed | `shipping-labels` | Exponential backoff |
| `JOB-PICKUP-SYNC-ZASILKOVNA` | scheduled | `shipping-sync` | Daily 03:00 |
| `JOB-PICKUP-SYNC-PPL` | scheduled | `shipping-sync` | Daily 03:00 |
| `JOB-PICKUP-SYNC-CP` | scheduled | `shipping-sync` | Daily 03:00 |
| `JOB-PICKUP-SYNC-DPD` | scheduled | `shipping-sync` | Daily 03:00 |
| `JOB-PICKUP-SYNC-PACKETA-SK` | scheduled | `shipping-sync` | Daily 03:00 |
| `JOB-DETECT-STUCK-SHIPMENTS` | scheduled | `shipping-sweeper` | Daily |
| `JOB-COD-TIMEOUT-CHECK` | scheduled | `shipping-sweeper` | Daily |
| `JOB-POLL-CARRIER-TRACKING` | scheduled (for carriers without webhooks or stale) | `shipping-tracking` | Every 4 hours |
| `JOB-SEND-DELIVERY-NOTIFICATION` | EVENT-SHIPMENT-OUT-FOR-DELIVERY / DELIVERED / COLLECTED_PICKUP | `notifications` | On-demand |
| `JOB-SEND-PICKUP-READY-NOTIFICATION` | EVENT-SHIPMENT-ARRIVED-AT-PICKUP-POINT | `notifications` | On-demand |
| `JOB-RETURN-LABEL-GENERATE` | RMA approve action | `shipping-labels` | On-demand |
| `JOB-BULK-LABEL-GENERATE` | manual admin trigger | `shipping-labels` | On-demand |
| `JOB-RECONCILE-CARRIER-INVOICES` | monthly | `shipping-reconcile` | Monthly (Fáze 2) |
| `JOB-SHIPPING-ANALYTICS-DAILY` | scheduled | `analytics` | Daily |
| `JOB-CLEANUP-OLD-WEBHOOK-EVENTS` | scheduled | `maintenance` | Daily |

### 11.1 JOB-PROCESS-SHIPPING-WEBHOOK-EVENT detail

```typescript
async function processShippingWebhookEvent(webhookEventId) {
  const event = await loadWebhookEvent(webhookEventId);
  const carrier = carriers[event.carrier_code];
  const normalized = carrier.parseWebhookEvent(event.payload);

  await pg.transaction(async tx => {
    const shipment = await tx.queryOne(sql`SELECT * FROM shipments WHERE carrier_code = ${event.carrier_code} AND tracking_number = ${normalized.tracking_number}`);
    if (!shipment) {
      // Orphan; defer
      throw new RetryLater(60);
    }
    
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('shipment:' + ${shipment.id})::bigint)`);
    
    // Apply status transition (guarded by state machine)
    const newStatus = mapEventToStatus(normalized.status);
    if (isValidTransition(shipment.status, newStatus) || normalized.occurred_at > shipment.status_entered_at) {
      await applyShipmentTransition(tx, shipment, newStatus, normalized);
    }
    
    // Append to shipment_events
    await tx.execute(sql`INSERT INTO shipment_events (...) VALUES (...)`);
    
    // Emit outbox event
    await emitOutbox(tx, mapToOurEvent(normalized));
    
    // COD trigger
    if (newStatus === 'delivered' && shipment.is_cod && !shipment.cod_collected_at) {
      await enqueueJob('JOB-COD-CAPTURE-FROM-CARRIER', { shipment_id: shipment.id });
    }
    
    await tx.execute(sql`UPDATE shipping_webhook_events SET processed_at = now() WHERE id = ${webhookEventId}`);
  });
}
```

### 11.2 JOB-POLL-CARRIER-TRACKING

For carriers without reliable webhooks (e.g., Česká pošta limited webhooks):
- Query tracking API for shipments in `handed_over`/`in_transit`/`out_for_delivery` states
- Update events
- Throttle to avoid API quota

### 11.3 JOB-DETECT-STUCK-SHIPMENTS

Daily sweep:
- Find shipments in `in_transit` > X days (carrier-specific threshold, default 14 days)
- Emit `EVENT-SHIPPING-ANOMALY-DETECTED`
- Admin notification

---

## 12. UI/UX flows

### FLOW-SHIP-001: Configure carrier (admin)

```
[Admin → Settings → Shipping → Carriers]
   - List of carriers (Zasilkovna, PPL, ČP, DPD, Packeta SK, ...)
   - Status badge: configured / enabled / disabled
        │
   click "Configure Zásilkovna"
        │
        ▼
[Zásilkovna config form]
   - API key (stored in Vault)
   - Webhook URL (read-only, copy to Zásilkovna admin)
   - Sender address (autofilled from tenant company address; can override)
   - Default label format (PDF A6 = thermal printer ready)
   - Test connection button
        │
        ▼
[Save + enable]
   - Triggers JOB-PICKUP-SYNC-ZASILKOVNA (initial)
   - Becomes available in checkout
```

### FLOW-SHIP-002: Set up shipping zone + rates

```
[Admin → Settings → Shipping → Zones]
   - "New Zone" button
        │
        ▼
[Zone form]
   - Name: "Česká republika"
   - Country codes: ['CZ']
   - Priority: 100 (higher than EU default)
        │
        ▼
[Save → zone created]
[Add rates for this zone]
   - For each carrier:
     - Pick service (pickup_point, home_delivery, COD)
     - Pick kind (weight_based example)
     - Configure tiers: [{ max_weight: 1000, amount: 7900 }, { max_weight: 5000, amount: 11900 }, ...]
     - Save
        │
        ▼
[Rates list populated for zone]
```

### FLOW-SHIP-003: Storefront pickup point selection

```
[Checkout step 3: Shipping]
   - List of shipping methods, customer picks "Zásilkovna pickup_point"
   - "Select pickup point" button appears
        │
        ▼
[Pickup point picker widget]
   - Map view (Mapy.cz / Leaflet)
   - Search bar
   - List of nearest points (from GET :nearest)
   - Per point: name, address, opening hours, distance
        │
   customer picks a point
        │
        ▼
[PATCH /checkouts/{id}/shipping with pickup_point_id]
   - Confirmation badge: "Vyzvednutí: Z-BOX Praha 5 - Anděl"
   - Continue to payment
```

### FLOW-SHIP-004: Generate label (warehouse staff)

```
[Admin → Fulfillment → Pending shipments]
   - List of orders ready to ship (status='pending')
        │
   staff picks shipment, clicks "Generate label"
        │
        ▼
[POST /shipments/{id}:generate-label]
   - Carrier API call → label PDF + tracking_number
   - Status: pending → label_generated
        │
        ▼
[PDF auto-opens for printing]
[Tracking number assigned, customer emailed]
```

### FLOW-SHIP-005: Bulk label generation (daily ops)

```
[Admin → Fulfillment → Multi-select pending shipments]
   - Filter by warehouse, carrier, date
   - Select 50 shipments
   - Click "Generate labels"
        │
        ▼
[POST /shipments:bulk-generate-labels → 202 operation]
   - Progress bar: 12/50 done...
        │
        ▼
[On complete: combined PDF downloadable]
   - All labels generated, tracking numbers assigned
   - Carrier pickup scheduled (if applicable)
```

### FLOW-SHIP-006: Customer tracks shipment

```
[Customer receives shipment email or visits /orders/{number}]
   - Order detail shows shipment(s) with tracking number + status
        │
   customer clicks "Track" button
        │
        ▼
[/storefront/orders/{order_number}/tracking]
   - Timeline view of events
     - "Předáno přepravci, 19. 5. 17:00"
     - "Tranzit přes Brno, 20. 5. 03:15"
     - "Doručeno na výdejní místo, 20. 5. 14:00 — připravená k vyzvednutí"
   - Estimated delivery
   - Carrier's tracking page link
   - Map view (optional)
```

### FLOW-SHIP-007: Failed delivery handling

```
[Customer not home, carrier reports "delivery_attempt_failed"]
   - Webhook → shipment.status = 'failed_delivery'
   - JOB-SEND-DELIVERY-NOTIFICATION
        │
        ▼
[Customer email + SMS]
   - "Doručení se nezdařilo. Druhý pokus zítra OR vyzvednutí na pobočce."
   - Customer can: reschedule via carrier link, or pick up at depot
        │
        ▼
[Second attempt next day; if also fails → returned_to_sender]
   - Order auto-action per merchant policy:
     • Auto-cancel + refund (default for COD)
     • Hold for customer instructions (default for prepaid)
```

---

## 13. Edge cases & error handling

| Scenario | Behavior | Code |
|---|---|---|
| Carrier API down at rate calc | Use cached rates; warning to customer | (graceful) |
| Carrier API down at label gen | Mark pending; retry job; alert if persistent | (handled async) |
| Pickup point deactivated during checkout | Re-validate at confirm; ask customer to re-select | `PICKUP_POINT_INACTIVE`, 422 |
| Shipping address postal_code invalid | Reject at address step (per `12`) | `INVALID_POSTAL_CODE`, 422 |
| No zone matches address | Reject with "We don't ship to your location" | `NO_SHIPPING_ZONE`, 422 |
| No rates after filtering | Reject; suggest different carrier or different cart | `NO_SHIPPING_METHODS_AVAILABLE`, 422 |
| Cart weight exceeds all carrier max | Reject; suggest splitting | `CART_TOO_HEAVY`, 422 |
| Cart dimensions exceed all carrier max | Reject | `CART_DIMENSIONS_EXCEED`, 422 |
| Live rate API returns 0 rates | Exclude that carrier from result | (silent) |
| Cancel shipment after handover | Reject; suggest customer refuse delivery | `SHIPMENT_ALREADY_HANDED_OVER`, 422 |
| Webhook with invalid signature | Reject 401, log, alert | (security) |
| Webhook for unknown shipment | Defer 60s retry; orphan after 24h | (handled) |
| Webhook with status regression (delivered → in_transit) | Ignore unless manual_override | (handled) |
| Carrier tracking endpoint not reachable | Show last cached events, indicate stale | (graceful UI) |
| Label format unsupported by carrier | Reject; suggest alternative | `LABEL_FORMAT_NOT_SUPPORTED`, 422 |
| Insurance amount > carrier max | Cap at max, warn merchant | (handled) |
| Customer changes pickup point mid-checkout | Re-validate (re-resolve rate) | (handled) |
| Concurrent label generation for same shipment | Advisory lock; idempotent (returns first label) | (handled) |
| Carrier returns ambiguous tracking number | Log + alert admin to resolve manually | (rare) |
| Shipment stuck `in_transit` > 14 days | Anomaly event + admin alert; customer reassurance email | (handled) |
| COD shipment delivered but no collection event after 7 days | Alert merchant; manual investigation | (handled) |
| Carrier reports `returned_to_sender` for non-COD prepaid order | Hold order; customer email asking for new address | (handled) |
| Pickup point sync API down | Stale data served; warn admin if > 48h since last sync | (graceful) |
| International shipping requested but customs disabled | Reject (Fáze 2 feature) | `INTERNATIONAL_SHIPPING_NOT_ENABLED`, 422 |
| Customer requests label reprint | Allow up to 5x per shipment (anti-fraud); admin can override | (handled) |
| BOPIS shipment unclaimed > 14 days | Auto-return to inventory; refund | (handled, per `09`) |
| Shipment update collides with order status (e.g., shipping cancelled order) | Reject if order cancelled; warn admin | `ORDER_CANCELLED`, 422 |
| Multi-package: 1 of 3 lost | Only that package's events; partial fulfillment continues; insurance claim for lost | (handled) |

---

## 14. Performance

### 14.1 Targets

| Operation | p50 | p95 | p99 |
|---|---|---|---|
| `POST /shipping:calculate-rates` (cached) | 10 ms | 30 ms | 60 ms |
| `POST /shipping:calculate-rates` (cache miss, live rates) | 100 ms | 400 ms | 1500 ms |
| `GET /pickup-points:nearest` | 20 ms | 60 ms | 150 ms |
| `POST /shipments/{id}:generate-label` (carrier API) | 300 ms | 1000 ms | 3000 ms |
| Webhook ingestion + insert | 15 ms | 40 ms | 100 ms |
| `JOB-PROCESS-SHIPPING-WEBHOOK-EVENT` | 50 ms | 200 ms | 500 ms |
| `JOB-PICKUP-SYNC-*` (10k points refresh) | 30 s | 90 s | 300 s |
| `JOB-BULK-LABEL-GENERATE` (50 labels) | 30 s | 90 s | 180 s |

### 14.2 Optimization

- **Rate calc cache** 5 min per (cart_hash, address_hash, customer_group_id)
- **Pickup points cache** 24h per (carrier, postal_code) for nearest queries
- **PostGIS geo index** for nearest queries (fast K-NN)
- **Pre-fetch carrier rates at checkout step 2** (background, hide latency from step 3)
- **DataLoader v GraphQL** for batched shipment_items, events
- **Webhook acknowledge fast** (200 OK before processing)
- **Connection pool** to carrier APIs (HTTP keep-alive)
- **Per-warehouse label format default** avoids per-shipment lookup

### 14.3 Hot path queries

```sql
-- Find pickup points within radius (PostGIS)
SELECT *,
  earth_distance(ll_to_earth($lat, $lng), ll_to_earth(latitude, longitude)) / 1000 AS distance_km
FROM pickup_points
WHERE carrier_code = $1 AND is_active = true
  AND earth_box(ll_to_earth($lat, $lng), $radius_km * 1000) @> ll_to_earth(latitude, longitude)
ORDER BY distance_km ASC
LIMIT 20;
```

```sql
-- Find rates for zone
SELECT * FROM shipping_rates
WHERE shipping_zone_id = $1 AND is_active = true
  AND (starts_at IS NULL OR starts_at <= now())
  AND (ends_at IS NULL OR ends_at > now())
ORDER BY priority DESC, amount ASC;
```

---

## 15. Security

### 15.1 Permissions

```
PERM-SHIPPING-VIEW
PERM-SHIPPING-MANAGE          # zones, rates
PERM-SHIPPING-CONFIGURE       # carrier credentials
PERM-SHIPMENT-VIEW
PERM-SHIPMENT-MANAGE
PERM-SHIPMENT-EDIT-ADDRESS    # restrictive
PERM-SHIPMENT-OVERRIDE        # manual status override (admin only)
PERM-SHIPPING-LABEL-PRINT
PERM-SHIPPING-RECONCILE
```

### 15.2 Webhook security

- Per-tenant URL with `tenant_pub_id`
- HMAC signature where carrier supports (Zasilkovna, DPD)
- IP whitelist where carrier supports (PPL static IPs)
- Replay protection: timestamp window 5 min
- Rate limit per tenant per carrier 600/min

### 15.3 PII handling

- `shipping_address_snapshot`, `pickup_point_snapshot` = PII; subject to GDPR export/delete
- `delivery_signature_image_media_id` = sensitive; encrypted at rest (already via storage encryption), access logged
- Retention: shipments 7 years (commerce records); events 2 years (Pro+), 90 days (Free)

### 15.4 Audit

- 100% audit log on: manual status overrides, label regeneration > 1x, carrier config changes, shipment cancellations
- Sample 1% on reads

### 15.5 Rate limits

| Endpoint | Anon | Auth Free | Auth Pro |
|---|---|---|---|
| `GET /pickup-points:nearest` | 60/min/IP | 1500/min | unlimited |
| `POST /shipping:calculate-rates` | 60/min/session | 600/min | 6000/min |
| `POST /shipments/{id}:generate-label` | n/a | 30/min | 300/min |
| `POST /shipments:bulk-generate-labels` | n/a | 1/hour (max 100 shipments) | 12/hour (max 500) |
| Webhook ingestion | 600/min per tenant | 6000/min | 60000/min |
| Customer tracking | 60/min/IP | 60/min | 60/min |

---

## 16. Testing

### 16.1 Unit

```
TEST-UNIT-SHIP-001  ZoneResolver — priority + postal_code patterns
TEST-UNIT-SHIP-002  RateFilter — exclusions (tags, postal, weight, dimensions)
TEST-UNIT-SHIP-003  RateCalculator — flat, weight_based, price_based, free_above
TEST-UNIT-SHIP-004  DimensionalWeightCalculator
TEST-UNIT-SHIP-005  EtaCalculator — cutoff time, business days, weekends, holidays
TEST-UNIT-SHIP-006  CarrierWebhookSignatureVerifier per carrier
TEST-UNIT-SHIP-007  PickupPointDistance (geo)
TEST-UNIT-SHIP-008  ShipmentStateMachine — valid transitions
TEST-UNIT-SHIP-009  BoxPackingSimulator (simple bin-pack)
TEST-UNIT-SHIP-010  TrackingEventNormalizer per carrier
```

### 16.2 Integration (mocked carriers)

```
TEST-INT-SHIP-001  Calculate rates for CZ cart → list returned with ETA
TEST-INT-SHIP-002  Calculate rates with no applicable carriers → 422
TEST-INT-SHIP-003  Live rate fallback to cached when carrier API down
TEST-INT-SHIP-004  Create shipment → carrier API → tracking_number returned
TEST-INT-SHIP-005  Generate label → PDF stored, media_id saved
TEST-INT-SHIP-006  Webhook delivered → status='delivered', COD capture triggered
TEST-INT-SHIP-007  Webhook out of order → state guards
TEST-INT-SHIP-008  Webhook duplicate → idempotent
TEST-INT-SHIP-009  Webhook orphan (no matching shipment) → retry with backoff
TEST-INT-SHIP-010  Sync pickup points — new, updated, deactivated
TEST-INT-SHIP-011  Nearest pickup query (PostGIS) — < 50ms for 10k points
TEST-INT-SHIP-012  Stuck shipment detection (> 14 days in_transit)
TEST-INT-SHIP-013  Manual status override → audit log entry
TEST-INT-SHIP-014  Bulk label generation 50 shipments
TEST-INT-SHIP-015  Cancel shipment pre-handover → carrier API call + state update
TEST-INT-SHIP-016  Concurrent label generation (advisory lock)
TEST-INT-SHIP-017  Return label issuance via API
TEST-INT-SHIP-018  Insurance auto-trigger above threshold
TEST-INT-SHIP-019  Multi-warehouse split fulfillment (v1.0+ scenario)
TEST-INT-SHIP-020  BOPIS pickup flow (v1.0+)
```

### 16.3 E2E

```
TEST-E2E-SHIP-001  Customer selects pickup point at checkout
TEST-E2E-SHIP-002  Customer chooses home delivery, sees correct ETA
TEST-E2E-SHIP-003  Customer with too heavy cart sees "no shipping methods"
TEST-E2E-SHIP-004  Admin generates label, customer receives tracking email
TEST-E2E-SHIP-005  Webhook flow simulating delivery → customer notified
TEST-E2E-SHIP-006  COD order delivered → payment captured automatically
TEST-E2E-SHIP-007  Failed delivery → retry email, eventual return-to-sender
TEST-E2E-SHIP-008  Customer tracks via order page
```

### 16.4 Load (k6)

```
TEST-LOAD-SHIP-001  500 RPS rate calc (cached) → p95 < 30 ms
TEST-LOAD-SHIP-002  100 RPS pickup nearest query (10k points) → p95 < 100 ms
TEST-LOAD-SHIP-003  100 concurrent label gen → no carrier API quota exceeded (throttle works)
TEST-LOAD-SHIP-004  Webhook ingestion 1000/sec → process < 5s p95
```

### 16.5 Chaos

```
TEST-CHAOS-SHIP-001  Carrier API timeout → fallback to cached rates
TEST-CHAOS-SHIP-002  Pickup sync API down for 48h → admin alert, stale data served
TEST-CHAOS-SHIP-003  Label gen fails 3x in row → retry job + manual fallback
TEST-CHAOS-SHIP-004  Webhook firehose (5000/sec spike) → queue absorbs, no loss
```

### 16.6 Carrier sandbox

- Zasilkovna sandbox account
- PPL test env
- ČP test mode
- DPD UAT
- Automated CI nightly suite

---

## 17. Implementation checklist

### Backend
- [ ] **[S]** Drizzle schema `packages/db/src/schema/shipping/*.ts`
- [ ] **[S]** Migrace `20260528_001_create_shipping_tables.sql` (partitions, PostGIS extension)
- [ ] **[L]** `ShippingCarrier` interface + Zasilkovna impl
- [ ] **[L]** PPL impl
- [ ] **[L]** Česká pošta impl
- [ ] **[M]** DPD impl
- [ ] **[M]** Packeta SK impl
- [ ] **[L]** `RateCalculatorService` — full pipeline
- [ ] **[M]** `ZoneResolver`
- [ ] **[M]** `EtaCalculator`
- [ ] **[M]** `BoxPackingSimulator`
- [ ] **[M]** `ShipmentService` — CRUD + state transitions
- [ ] **[L]** `LabelGenerationService` — carrier API call + storage
- [ ] **[M]** `WebhookProcessor` per carrier
- [ ] **[M]** `PickupPointSyncService`
- [ ] **[S]** `CarrierConfigService` + Vault integration
- [ ] **[M]** REST endpoints per §8
- [ ] **[M]** GraphQL types + resolvers
- [ ] **[S]** tRPC router (admin)
- [ ] **[S]** MCP tools `shipping.get_rates`, `shipping.track`

### Background jobs
- [ ] **[M]** JOB-PROCESS-SHIPPING-WEBHOOK-EVENT
- [ ] **[S]** JOB-RETRY-LABEL-GENERATION
- [ ] **[M]** JOB-PICKUP-SYNC-* (per carrier)
- [ ] **[S]** JOB-DETECT-STUCK-SHIPMENTS
- [ ] **[S]** JOB-COD-TIMEOUT-CHECK
- [ ] **[M]** JOB-POLL-CARRIER-TRACKING (for non-webhook carriers)
- [ ] **[S]** JOB-SEND-DELIVERY-NOTIFICATION
- [ ] **[S]** JOB-SEND-PICKUP-READY-NOTIFICATION
- [ ] **[M]** JOB-BULK-LABEL-GENERATE
- [ ] **[S]** JOB-SHIPPING-ANALYTICS-DAILY
- [ ] **[S]** JOB-CLEANUP-OLD-WEBHOOK-EVENTS

### Frontend — Admin
- [ ] **[M]** Carrier config screens (per carrier)
- [ ] **[M]** Zones + rates management
- [ ] **[L]** Shipments list (filter by status, carrier, warehouse, date)
- [ ] **[M]** Shipment detail (timeline, events, label preview)
- [ ] **[M]** Bulk label generation workflow
- [ ] **[M]** Daily pickup handover workflow
- [ ] **[S]** Analytics: delivery performance, on-time rate per carrier
- [ ] **[S]** Stuck shipments dashboard
- [ ] **[S]** COD reconciliation report

### Frontend — Storefront
- [ ] **[M]** Shipping method picker at checkout step 3
- [ ] **[L]** Pickup point picker widget (map + list + search)
- [ ] **[S]** ETA display in human language
- [ ] **[S]** Tracking page (per shipment / per order)
- [ ] **[S]** Customer-facing event timeline

### Tests
- [ ] **[M]** Per §16
- [ ] **[M]** Carrier sandbox CI nightly

### Docs
- [ ] **[S]** "Setting up carriers" merchant guide
- [ ] **[S]** Per-carrier configuration guides
- [ ] **[S]** "Managing shipping zones and rates" guide
- [ ] **[S]** "Daily fulfillment workflow" warehouse staff guide
- [ ] **[S]** Developer: custom carrier plugin SDK

---

## 18. Open questions

### Q-SHIP-001: Carrier negotiated rates
**Otázka:** Merchants often have negotiated rates with carriers. Should we let merchant override carrier API rates with custom tables?

**Status:** Supported via configured `shipping_rates` overriding live API. Merchant opts-in per service. v1.0+: dynamic negotiation per cart (Stripe-style API).

### Q-SHIP-002: Multi-package shipments
**Otázka:** Heavy cart → 2 packages from 1 warehouse. Multiple `shipments` rows or single shipment with multiple `packages` sub-rows?

**Status:** Multiple shipment rows (cleaner separation, separate tracking numbers). v1.0+: introduce `shipment_groups` for orchestration if UX needs.

### Q-SHIP-003: Carrier insurance vs marketplace insurance
**Otázka:** Carrier covers up to X EUR. For high-value packages, supplemental third-party insurance?

**Status:** v2.0+ feature. MVP: carrier insurance only.

### Q-SHIP-004: Customs declarations automation
**Otázka:** HS codes per product, automatic CN22/CN23 forms.

**Status:** v1.0+ international expansion feature. Detail v `15-tax-compliance.md` + product extension.

### Q-SHIP-005: Subscription shipping (recurring deliveries)
**Otázka:** Subscription box → repeat shipments with same address/method?

**Status:** v2.0+ when subscriptions launch (`24-subscriptions.md`). Uses our shipping primitives.

### Q-SHIP-006: Delivery time slots
**Otázka:** Customer picks "Saturday afternoon 14:00-18:00"?

**Status:** v1.0+ feature for carriers supporting (DPD, GLS). MVP: just estimated_days range.

### Q-SHIP-007: Per-channel shipping config
**Otázka:** Different methods for storefront vs POS vs marketplace?

**Status:** Schema-ready via `channel_id` filter (referenced; not yet enforced in MVP). v1.0+ activates.

### Q-SHIP-008: Carrier load balancing / failover
**Otázka:** Carrier A down → auto-failover to carrier B with similar capabilities?

**Status:** Manual: merchant disables broken carrier; checkout filters out. Auto-failover v2.0+ Enterprise feature.

### Q-SHIP-009: Returns shipping cost handling
**Otázka:** Customer pays return shipping vs merchant pays vs free return?

**Status:** Configurable per tenant in returns workflow (`17-returns-refunds.md`). Carrier issues return label; cost charged accordingly.

### Q-SHIP-010: AI-suggested shipping rules
**Otázka:** "Your average package is 800g, here's recommended rate breakpoints"?

**Status:** v2.0+ AI Copilot feature. Out of scope MVP.

### Q-SHIP-011: Shipping label pre-print bulk on cutoff
**Otázka:** At 16:00 cutoff, batch-print all today's labels automatically?

**Status:** Manual trigger in MVP. v1.0+: scheduled CRON-BULK-LABEL-GENERATE per warehouse.

### Q-SHIP-012: Real-time delivery tracking on map
**Otázka:** Live courier location for last-mile delivery?

**Status:** Carrier-dependent; only some carriers expose. v2.0+ feature where supported.

### Q-SHIP-013: Cross-border B2B shipping
**Otázka:** EU B2B → reverse charge VAT, no customs needed; non-EU B2B → customs declaration with VAT exemption.

**Status:** Detail in `15-tax-compliance.md` + B2B doc. Shipping coordinates address validation.

### Q-SHIP-014: Carrier API key rotation downtime
**Otázka:** During rotation, in-flight shipments may use old key for label gen. Window of acceptable failure?

**Status:** Vault dual-key rotation: old key valid 24h after new key activated. In-flight shipments fetch key at call time.

### Q-SHIP-015: Service code normalization across carriers
**Otázka:** Each carrier has internal codes. Should we expose normalized (`home_delivery`) or carrier-specific (`zasilkovna_dhl`) to merchants?

**Status:** Both. `service_code` is carrier-specific (stored). UI shows normalized + carrier label. API responses include both.

### Q-SHIP-016: Holiday calendars
**Otázka:** ETA calc needs holidays per country. Bundle vs configurable per tenant?

**Status:** Bundle CZ/SK/DE/PL/AT/HU/RO basic holidays MVP. Per-tenant override v1.0+.

### Q-SHIP-017: BOPIS pickup ID verification
**Otázka:** When customer picks up at warehouse, verify identity?

**Status:** Configurable per tenant (`require_id_for_pickup`). Default for high-value: true; otherwise false. v1.0+.

---

## 📅 Změny

| Datum | Změna |
|---|---|
| 2026-05-19 | Initial — Shipping domain. Carrier abstraction, 5 MVP carriers, rate calc pipeline, pickup points cache, label generation, tracking webhook ingestion, ETA, COD coordination. |

---

**Konec Shipping.**

➡️ Pokračovat na: [`15-tax-compliance.md`](15-tax-compliance.md)
