CREATE TABLE "payment_provider_configs" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"provider_code" text NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"is_test_mode" boolean DEFAULT true NOT NULL,
	"display_name" text NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"supported_currencies" text[] DEFAULT '{}' NOT NULL,
	"supported_method_kinds" text[] DEFAULT '{}' NOT NULL,
	"credentials" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"webhook_secret" text,
	"options" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"provider_code" text NOT NULL,
	"provider_event_id" text NOT NULL,
	"provider_event_type" text NOT NULL,
	"related_payment_id" uuid,
	"payload" jsonb NOT NULL,
	"signature_verified" boolean DEFAULT false NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"processing_error" text
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"pub_id" text NOT NULL,
	"order_id" uuid NOT NULL,
	"customer_id" uuid,
	"provider_code" text NOT NULL,
	"provider_payment_id" text,
	"provider_charge_id" text,
	"kind" text DEFAULT 'charge' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"amount" bigint NOT NULL,
	"amount_captured" bigint,
	"amount_refunded" bigint DEFAULT 0 NOT NULL,
	"currency" text NOT NULL,
	"method_kind" text,
	"method_brand" text,
	"method_last4" text,
	"authentication_url" text,
	"failure_code" text,
	"failure_message" text,
	"idempotency_key" text,
	"raw_payload" jsonb,
	"webhook_received_at" timestamp with time zone,
	"initiated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"authorized_at" timestamp with time zone,
	"captured_at" timestamp with time zone,
	"refunded_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment_provider_configs" ADD CONSTRAINT "payment_provider_configs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_webhook_events" ADD CONSTRAINT "payment_webhook_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_webhook_events" ADD CONSTRAINT "payment_webhook_events_related_payment_id_payments_id_fk" FOREIGN KEY ("related_payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_payment_provider_configs" ON "payment_provider_configs" USING btree ("tenant_id","provider_code");--> statement-breakpoint
CREATE INDEX "idx_payment_provider_configs_enabled" ON "payment_provider_configs" USING btree ("tenant_id","is_enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_payment_webhook_events" ON "payment_webhook_events" USING btree ("tenant_id","provider_code","provider_event_id");--> statement-breakpoint
CREATE INDEX "idx_payment_webhook_unprocessed" ON "payment_webhook_events" USING btree ("received_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_payments_pub_id" ON "payments" USING btree ("tenant_id","pub_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_payments_provider_payment_id" ON "payments" USING btree ("tenant_id","provider_code","provider_payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_payments_idempotency" ON "payments" USING btree ("tenant_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_payments_order" ON "payments" USING btree ("order_id","initiated_at");--> statement-breakpoint
CREATE INDEX "idx_payments_status" ON "payments" USING btree ("tenant_id","status","initiated_at");--> statement-breakpoint
-- RLS tenant isolation for the new tenant-scoped tables (per `30`, migration 0020).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['payments','payment_provider_configs','payment_webhook_events'] LOOP
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