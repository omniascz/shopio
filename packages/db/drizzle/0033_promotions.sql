CREATE TABLE "promotions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"pub_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"value" bigint DEFAULT 0 NOT NULL,
	"currency" text,
	"max_discount_amount" bigint,
	"min_subtotal" bigint DEFAULT 0 NOT NULL,
	"min_quantity" integer DEFAULT 0 NOT NULL,
	"buy_quantity" integer DEFAULT 0 NOT NULL,
	"get_quantity" integer DEFAULT 0 NOT NULL,
	"get_discount_bps" integer DEFAULT 10000 NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"stackable" boolean DEFAULT true NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_promotions_pub_id" ON "promotions" USING btree ("tenant_id","pub_id");--> statement-breakpoint
CREATE INDEX "idx_promotions_tenant_active" ON "promotions" USING btree ("tenant_id","is_active");--> statement-breakpoint
-- RLS tenant isolation (per `30`, migration 0020).
DO $$
BEGIN
  EXECUTE 'ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.promotions FORCE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation ON public.promotions';
  EXECUTE 'CREATE POLICY tenant_isolation ON public.promotions '
    || 'USING (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid) '
    || 'WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid)';
END $$;
