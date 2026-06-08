CREATE TABLE "wishlist_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_wishlist_items" ON "wishlist_items" USING btree ("customer_id","product_id");--> statement-breakpoint
CREATE INDEX "idx_wishlist_items_customer" ON "wishlist_items" USING btree ("tenant_id","customer_id");--> statement-breakpoint
-- RLS tenant isolation (per `30`, migration 0020).
DO $$
BEGIN
  EXECUTE 'ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.wishlist_items FORCE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation ON public.wishlist_items';
  EXECUTE 'CREATE POLICY tenant_isolation ON public.wishlist_items '
    || 'USING (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid) '
    || 'WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid)';
END $$;
