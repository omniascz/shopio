CREATE TABLE "warehouses" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"pub_id" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"address" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "storage_bins" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"code" text NOT NULL,
	"bin_type" text DEFAULT 'shelf' NOT NULL,
	"max_capacity" integer,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stocktakes" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"pub_id" text NOT NULL,
	"warehouse_id" uuid,
	"name" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"note" text,
	"created_by" uuid,
	"applied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stocktake_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"stocktake_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"system_qty" integer NOT NULL,
	"counted_qty" integer NOT NULL,
	"variance" integer NOT NULL,
	"applied" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_bins" ADD CONSTRAINT "storage_bins_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_bins" ADD CONSTRAINT "storage_bins_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stocktakes" ADD CONSTRAINT "stocktakes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stocktakes" ADD CONSTRAINT "stocktakes_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stocktake_items" ADD CONSTRAINT "stocktake_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stocktake_items" ADD CONSTRAINT "stocktake_items_stocktake_id_stocktakes_id_fk" FOREIGN KEY ("stocktake_id") REFERENCES "public"."stocktakes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stocktake_items" ADD CONSTRAINT "stocktake_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_warehouses_pub_id" ON "warehouses" USING btree ("tenant_id","pub_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_warehouses_code" ON "warehouses" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE INDEX "idx_warehouses_tenant_status" ON "warehouses" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_storage_bins_code" ON "storage_bins" USING btree ("tenant_id","warehouse_id","code");--> statement-breakpoint
CREATE INDEX "idx_storage_bins_warehouse" ON "storage_bins" USING btree ("warehouse_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_stocktakes_pub_id" ON "stocktakes" USING btree ("tenant_id","pub_id");--> statement-breakpoint
CREATE INDEX "idx_stocktakes_tenant_status" ON "stocktakes" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_stocktake_items_variant" ON "stocktake_items" USING btree ("stocktake_id","variant_id");--> statement-breakpoint
CREATE INDEX "idx_stocktake_items_stocktake" ON "stocktake_items" USING btree ("stocktake_id");--> statement-breakpoint
-- RLS tenant isolation (per `30`, migration 0020).
DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['warehouses','storage_bins','stocktakes','stocktake_items'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I', tbl);
    EXECUTE format('CREATE POLICY tenant_isolation ON public.%I '
      || 'USING (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid) '
      || 'WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid)', tbl);
  END LOOP;
END $$;
