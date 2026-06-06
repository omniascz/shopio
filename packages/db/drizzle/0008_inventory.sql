CREATE TABLE "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"quantity_delta" integer NOT NULL,
	"reason" text NOT NULL,
	"reference_type" text,
	"reference_id" uuid,
	"resulting_stock_on_hand" integer NOT NULL,
	"actor_user_id" uuid,
	"note" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_reservations" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"released_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "stock_reserved" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_stock_movements_variant" ON "stock_movements" USING btree ("variant_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_stock_movements_tenant_reason" ON "stock_movements" USING btree ("tenant_id","reason","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_stock_reservations_variant" ON "stock_reservations" USING btree ("variant_id") WHERE status = 'active';--> statement-breakpoint
CREATE INDEX "idx_stock_reservations_order" ON "stock_reservations" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_stock_reservations_expiry" ON "stock_reservations" USING btree ("expires_at") WHERE status = 'active' AND expires_at IS NOT NULL;--> statement-breakpoint
-- Baseline: existing stock becomes an `initial_load` movement so the ledger
-- reconciles (Σ movements = stock_on_hand) for pre-existing variants.
INSERT INTO "stock_movements" ("tenant_id", "variant_id", "quantity_delta", "reason", "reference_type", "resulting_stock_on_hand", "note")
SELECT "tenant_id", "id", "stock_on_hand", 'initial_load', 'migration', "stock_on_hand", 'Baseline from pre-reservation stock_on_hand (migration 0008)'
FROM "product_variants"
WHERE "stock_on_hand" <> 0;
