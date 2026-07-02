CREATE TABLE "marketplace_channels" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"pub_id" text NOT NULL,
	"platform" text NOT NULL,
	"name" text NOT NULL,
	"external_account_id" text,
	"status" text DEFAULT 'disconnected' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_sync_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketplace_listings" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"external_offer_id" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"last_price_amount" bigint,
	"last_stock" integer,
	"last_error" text,
	"listed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "marketplace_channels" ADD CONSTRAINT "marketplace_channels_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_channel_id_marketplace_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."marketplace_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_marketplace_channels_pub_id" ON "marketplace_channels" USING btree ("tenant_id","pub_id");--> statement-breakpoint
CREATE INDEX "idx_marketplace_channels_tenant" ON "marketplace_channels" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_marketplace_listings_variant" ON "marketplace_listings" USING btree ("channel_id","variant_id");--> statement-breakpoint
CREATE INDEX "idx_marketplace_listings_channel" ON "marketplace_listings" USING btree ("channel_id","status");--> statement-breakpoint
CREATE INDEX "idx_marketplace_listings_offer" ON "marketplace_listings" USING btree ("tenant_id","external_offer_id");--> statement-breakpoint
-- RLS tenant isolation (per `30`, migration 0020).
DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['marketplace_channels','marketplace_listings'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I', tbl);
    EXECUTE format('CREATE POLICY tenant_isolation ON public.%I '
      || 'USING (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid) '
      || 'WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid)', tbl);
  END LOOP;
END $$;
