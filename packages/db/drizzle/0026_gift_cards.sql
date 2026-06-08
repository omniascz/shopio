CREATE TABLE "gift_card_transactions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"gift_card_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"amount" bigint NOT NULL,
	"currency" text NOT NULL,
	"reference_type" text,
	"reference_id" uuid,
	"resulting_balance" bigint NOT NULL,
	"notes" text,
	"actor_kind" text NOT NULL,
	"actor_id" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gift_cards" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"pub_id" text NOT NULL,
	"code_hash" text NOT NULL,
	"code_prefix" text NOT NULL,
	"code_last4" text NOT NULL,
	"kind" text DEFAULT 'gift' NOT NULL,
	"initial_amount" bigint NOT NULL,
	"balance" bigint NOT NULL,
	"currency" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"issued_to_email" text,
	"issued_to_customer_id" uuid,
	"issued_by_order_id" uuid,
	"notes" text,
	"expires_at" timestamp with time zone,
	"activated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gift_card_transactions" ADD CONSTRAINT "gift_card_transactions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_card_transactions" ADD CONSTRAINT "gift_card_transactions_gift_card_id_gift_cards_id_fk" FOREIGN KEY ("gift_card_id") REFERENCES "public"."gift_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_cards" ADD CONSTRAINT "gift_cards_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_cards" ADD CONSTRAINT "gift_cards_issued_to_customer_id_customers_id_fk" FOREIGN KEY ("issued_to_customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_cards" ADD CONSTRAINT "gift_cards_issued_by_order_id_orders_id_fk" FOREIGN KEY ("issued_by_order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_gift_card_transactions_card" ON "gift_card_transactions" USING btree ("gift_card_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_gift_cards_pub_id" ON "gift_cards" USING btree ("tenant_id","pub_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_gift_cards_code_hash" ON "gift_cards" USING btree ("tenant_id","code_hash");--> statement-breakpoint
CREATE INDEX "idx_gift_cards_status" ON "gift_cards" USING btree ("tenant_id","status","expires_at");--> statement-breakpoint
CREATE INDEX "idx_gift_cards_customer" ON "gift_cards" USING btree ("issued_to_customer_id") WHERE issued_to_customer_id IS NOT NULL;--> statement-breakpoint
-- RLS tenant isolation (per `30`, migration 0020).
DO $$
BEGIN
  EXECUTE 'ALTER TABLE public.gift_cards ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.gift_cards FORCE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation ON public.gift_cards';
  EXECUTE 'CREATE POLICY tenant_isolation ON public.gift_cards '
    || 'USING (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid) '
    || 'WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid)';
  EXECUTE 'ALTER TABLE public.gift_card_transactions ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.gift_card_transactions FORCE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation ON public.gift_card_transactions';
  EXECUTE 'CREATE POLICY tenant_isolation ON public.gift_card_transactions '
    || 'USING (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid) '
    || 'WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid)';
END $$;