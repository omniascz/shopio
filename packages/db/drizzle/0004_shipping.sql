CREATE TABLE "pickup_points" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"carrier_code" text NOT NULL,
	"external_id" text NOT NULL,
	"name" text NOT NULL,
	"street" text,
	"city" text NOT NULL,
	"postal_code" text NOT NULL,
	"country_code" text NOT NULL,
	"latitude" numeric(9, 6),
	"longitude" numeric(9, 6),
	"opening_hours" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"supports_cod" boolean DEFAULT true NOT NULL,
	"last_synced_at" timestamp with time zone,
	"sync_source" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipping_provider_configs" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"carrier_code" text NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"is_test_mode" boolean DEFAULT true NOT NULL,
	"display_name" text NOT NULL,
	"credentials_vault_path" text,
	"sender_address_snapshot" jsonb,
	"options" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipping_rates" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"shipping_zone_id" uuid NOT NULL,
	"carrier_code" text NOT NULL,
	"service_code" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"kind" text NOT NULL,
	"amount" bigint,
	"currency" text NOT NULL,
	"tiers" jsonb,
	"free_above_amount" bigint,
	"pickup_only" boolean DEFAULT false NOT NULL,
	"supports_cod" boolean DEFAULT false NOT NULL,
	"estimated_days_min" integer,
	"estimated_days_max" integer,
	"min_weight_grams" integer,
	"max_weight_grams" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_visible_in_checkout" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipping_zones" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"country_codes" text[] DEFAULT '{}'::text[] NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_method" jsonb;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "pickup_point" jsonb;--> statement-breakpoint
ALTER TABLE "shipping_provider_configs" ADD CONSTRAINT "shipping_provider_configs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_rates" ADD CONSTRAINT "shipping_rates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_rates" ADD CONSTRAINT "shipping_rates_shipping_zone_id_shipping_zones_id_fk" FOREIGN KEY ("shipping_zone_id") REFERENCES "public"."shipping_zones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_zones" ADD CONSTRAINT "shipping_zones_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_pickup_points_carrier_external" ON "pickup_points" USING btree ("carrier_code","external_id");--> statement-breakpoint
CREATE INDEX "idx_pickup_points_country_postal" ON "pickup_points" USING btree ("country_code","postal_code") WHERE is_active = true;--> statement-breakpoint
CREATE INDEX "idx_pickup_points_active_carrier" ON "pickup_points" USING btree ("carrier_code") WHERE is_active = true;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_shipping_provider_configs" ON "shipping_provider_configs" USING btree ("tenant_id","carrier_code");--> statement-breakpoint
CREATE INDEX "idx_shipping_provider_configs_enabled" ON "shipping_provider_configs" USING btree ("tenant_id") WHERE is_enabled = true;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_shipping_rates_unique" ON "shipping_rates" USING btree ("shipping_zone_id","carrier_code","service_code");--> statement-breakpoint
CREATE INDEX "idx_shipping_rates_zone" ON "shipping_rates" USING btree ("shipping_zone_id") WHERE is_active = true;--> statement-breakpoint
CREATE INDEX "idx_shipping_rates_tenant_carrier" ON "shipping_rates" USING btree ("tenant_id","carrier_code","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_shipping_zones_tenant_name" ON "shipping_zones" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE INDEX "idx_shipping_zones_active" ON "shipping_zones" USING btree ("tenant_id","priority") WHERE is_active = true;