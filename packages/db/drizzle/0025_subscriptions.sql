CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"pub_id" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"items" jsonb NOT NULL,
	"shipping_address" jsonb NOT NULL,
	"payment_method" text DEFAULT 'cod' NOT NULL,
	"interval_unit" text NOT NULL,
	"interval_count" integer DEFAULT 1 NOT NULL,
	"next_run_at" timestamp with time zone NOT NULL,
	"last_run_at" timestamp with time zone,
	"orders_created" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_subscriptions_pub_id" ON "subscriptions" USING btree ("tenant_id","pub_id");--> statement-breakpoint
CREATE INDEX "idx_subscriptions_customer" ON "subscriptions" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX "idx_subscriptions_due" ON "subscriptions" USING btree ("status","next_run_at");--> statement-breakpoint
-- RLS tenant isolation (per `30`, migration 0020).
DO $$
BEGIN
  EXECUTE 'ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.subscriptions FORCE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation ON public.subscriptions';
  EXECUTE 'CREATE POLICY tenant_isolation ON public.subscriptions '
    || 'USING (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid) '
    || 'WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid)';
END $$;
