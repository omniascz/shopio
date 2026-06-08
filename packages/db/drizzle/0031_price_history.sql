CREATE TABLE "variant_price_history" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"price_amount" bigint NOT NULL,
	"currency" text NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "variant_price_history" ADD CONSTRAINT "variant_price_history_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_price_history" ADD CONSTRAINT "variant_price_history_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_variant_price_history_variant" ON "variant_price_history" USING btree ("variant_id","recorded_at");--> statement-breakpoint
-- RLS tenant isolation (per `30`, migration 0020).
DO $$
BEGIN
  EXECUTE 'ALTER TABLE public.variant_price_history ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.variant_price_history FORCE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation ON public.variant_price_history';
  EXECUTE 'CREATE POLICY tenant_isolation ON public.variant_price_history '
    || 'USING (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid) '
    || 'WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid)';
END $$;
--> statement-breakpoint
-- EU Omnibus: record every variant price change (covers all write paths:
-- product create, variant add, variant edit, CSV import). Only inserts when
-- price_amount actually changes, so it stays an append-only change log.
-- SECURITY DEFINER (owned by the superuser running this migration) so the
-- history insert bypasses FORCE RLS — works whether the variant write happens
-- via the RLS app role (withTenant) or the superuser pool (seed/admin).
CREATE OR REPLACE FUNCTION record_variant_price() RETURNS trigger
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') OR (NEW.price_amount IS DISTINCT FROM OLD.price_amount) THEN
    INSERT INTO public.variant_price_history (tenant_id, variant_id, price_amount, currency)
    VALUES (NEW.tenant_id, NEW.id, NEW.price_amount, NEW.price_currency);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_variant_price_history ON public.product_variants;
--> statement-breakpoint
CREATE TRIGGER trg_variant_price_history
  AFTER INSERT OR UPDATE OF price_amount ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION record_variant_price();
