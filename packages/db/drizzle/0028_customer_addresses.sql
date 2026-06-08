CREATE TABLE "customer_addresses" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"pub_id" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"label" text,
	"recipient_name" text NOT NULL,
	"phone" text,
	"line1" text NOT NULL,
	"line2" text,
	"city" text NOT NULL,
	"postal_code" text NOT NULL,
	"country_code" text NOT NULL,
	"state" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_customer_addresses_pub_id" ON "customer_addresses" USING btree ("tenant_id","pub_id");--> statement-breakpoint
CREATE INDEX "idx_customer_addresses_customer" ON "customer_addresses" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_customer_addresses_default" ON "customer_addresses" USING btree ("customer_id") WHERE is_default;--> statement-breakpoint
-- RLS tenant isolation (per `30`, migration 0020).
DO $$
BEGIN
  EXECUTE 'ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.customer_addresses FORCE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation ON public.customer_addresses';
  EXECUTE 'CREATE POLICY tenant_isolation ON public.customer_addresses '
    || 'USING (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid) '
    || 'WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid)';
END $$;