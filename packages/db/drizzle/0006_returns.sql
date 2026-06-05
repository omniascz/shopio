CREATE TABLE "return_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"return_id" uuid NOT NULL,
	"pub_id" text NOT NULL,
	"order_item_id" uuid NOT NULL,
	"variant_id" uuid,
	"title_snapshot" text NOT NULL,
	"sku_snapshot" text,
	"quantity" integer NOT NULL,
	"unit_gross_amount" bigint NOT NULL,
	"line_gross_amount" bigint NOT NULL,
	"line_net_amount" bigint NOT NULL,
	"line_tax_amount" bigint NOT NULL,
	"tax_class_code" text DEFAULT 'standard' NOT NULL,
	"tax_rate_basis_points" integer DEFAULT 0 NOT NULL,
	"restocked" boolean DEFAULT false NOT NULL,
	"restocked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "returns" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"pub_id" text NOT NULL,
	"order_id" uuid NOT NULL,
	"number" text NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"status_entered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reason_code" text DEFAULT 'other' NOT NULL,
	"customer_note" text,
	"staff_note" text,
	"currency" text NOT NULL,
	"requested_refund_amount" bigint NOT NULL,
	"shipping_refund_amount" bigint DEFAULT 0 NOT NULL,
	"actual_refund_amount" bigint,
	"refund_method" text,
	"refund_reference" text,
	"credit_note_invoice_id" uuid,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone,
	"received_at" timestamp with time zone,
	"refunded_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "refunded_amount" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_return_id_returns_id_fk" FOREIGN KEY ("return_id") REFERENCES "public"."returns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_return_items_pub_id" ON "return_items" USING btree ("tenant_id","pub_id");--> statement-breakpoint
CREATE INDEX "idx_return_items_return" ON "return_items" USING btree ("return_id");--> statement-breakpoint
CREATE INDEX "idx_return_items_order_item" ON "return_items" USING btree ("order_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_returns_pub_id" ON "returns" USING btree ("tenant_id","pub_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_returns_number" ON "returns" USING btree ("tenant_id","number");--> statement-breakpoint
CREATE INDEX "idx_returns_order" ON "returns" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_returns_tenant_status" ON "returns" USING btree ("tenant_id","status","requested_at");