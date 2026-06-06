CREATE TABLE "marketplace_commissions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"order_item_id" uuid NOT NULL,
	"currency" text NOT NULL,
	"line_subtotal_amount" bigint NOT NULL,
	"commission_basis_points" integer NOT NULL,
	"commission_amount" bigint NOT NULL,
	"vendor_earning_amount" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"pub_id" text NOT NULL,
	"slug" text NOT NULL,
	"display_name" text NOT NULL,
	"legal_entity_name" text,
	"registration_number" text,
	"vat_id" text,
	"contact_email" text NOT NULL,
	"contact_phone" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"commission_basis_points" integer DEFAULT 1500 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "vendor_id" uuid;--> statement-breakpoint
ALTER TABLE "marketplace_commissions" ADD CONSTRAINT "marketplace_commissions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_commissions" ADD CONSTRAINT "marketplace_commissions_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_commissions" ADD CONSTRAINT "marketplace_commissions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_commissions" ADD CONSTRAINT "marketplace_commissions_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_mkt_commissions_line" ON "marketplace_commissions" USING btree ("order_item_id");--> statement-breakpoint
CREATE INDEX "idx_mkt_commissions_vendor" ON "marketplace_commissions" USING btree ("tenant_id","vendor_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_mkt_commissions_order" ON "marketplace_commissions" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_vendors_slug" ON "vendors" USING btree ("tenant_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_vendors_pub_id" ON "vendors" USING btree ("tenant_id","pub_id");--> statement-breakpoint
CREATE INDEX "idx_vendors_tenant" ON "vendors" USING btree ("tenant_id","status");--> statement-breakpoint
-- RLS tenant isolation for the new tenant-scoped tables (per `30`, migration 0020).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['vendors','marketplace_commissions'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON public.%I '
      || 'USING (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid) '
      || 'WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid)',
      t
    );
  END LOOP;
END $$;
