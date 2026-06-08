CREATE TABLE "product_bundle_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bundle_id" uuid NOT NULL,
	"child_variant_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"is_optional" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "type" text DEFAULT 'simple' NOT NULL;--> statement-breakpoint
ALTER TABLE "product_bundle_items" ADD CONSTRAINT "product_bundle_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_bundle_items" ADD CONSTRAINT "product_bundle_items_bundle_id_products_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_bundle_items" ADD CONSTRAINT "product_bundle_items_child_variant_id_product_variants_id_fk" FOREIGN KEY ("child_variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_bundle_items" ON "product_bundle_items" USING btree ("bundle_id","child_variant_id");--> statement-breakpoint
CREATE INDEX "idx_bundle_items_bundle" ON "product_bundle_items" USING btree ("tenant_id","bundle_id","position");--> statement-breakpoint
-- RLS tenant isolation (per `30`, migration 0020).
DO $$
BEGIN
  EXECUTE 'ALTER TABLE public.product_bundle_items ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.product_bundle_items FORCE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation ON public.product_bundle_items';
  EXECUTE 'CREATE POLICY tenant_isolation ON public.product_bundle_items '
    || 'USING (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid) '
    || 'WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid)';
END $$;