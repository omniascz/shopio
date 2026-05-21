CREATE TABLE "cart_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"cart_id" uuid NOT NULL,
	"pub_id" text NOT NULL,
	"variant_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_amount" bigint NOT NULL,
	"unit_price_currency" text NOT NULL,
	"title_snapshot" text NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"pub_id" text NOT NULL,
	"session_id" text,
	"customer_id" uuid,
	"status" text DEFAULT 'active' NOT NULL,
	"status_entered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"currency" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"pub_id" text NOT NULL,
	"variant_id" uuid,
	"product_id" uuid,
	"product_title_snapshot" text NOT NULL,
	"variant_title_snapshot" text NOT NULL,
	"sku_snapshot" text,
	"quantity" integer NOT NULL,
	"unit_price_amount" bigint NOT NULL,
	"unit_price_currency" text NOT NULL,
	"line_subtotal_amount" bigint NOT NULL,
	"line_discount_amount" bigint DEFAULT 0 NOT NULL,
	"line_tax_amount" bigint DEFAULT 0 NOT NULL,
	"line_total_amount" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"pub_id" text NOT NULL,
	"order_number" text NOT NULL,
	"customer_email" text NOT NULL,
	"customer_name" text,
	"customer_phone" text,
	"shipping_address" jsonb NOT NULL,
	"billing_address" jsonb,
	"currency" text NOT NULL,
	"subtotal_amount" bigint NOT NULL,
	"discount_amount" bigint DEFAULT 0 NOT NULL,
	"shipping_amount" bigint DEFAULT 0 NOT NULL,
	"tax_amount" bigint DEFAULT 0 NOT NULL,
	"total_amount" bigint NOT NULL,
	"status" text DEFAULT 'pending_payment' NOT NULL,
	"status_entered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"payment_status" text DEFAULT 'pending' NOT NULL,
	"payment_method" text,
	"channel_kind" text DEFAULT 'storefront_web' NOT NULL,
	"customer_locale" text,
	"customer_note" text,
	"placed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone,
	"fulfilled_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carts" ADD CONSTRAINT "carts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_cart_items_cart" ON "cart_items" USING btree ("cart_id","added_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_cart_items_cart_variant" ON "cart_items" USING btree ("cart_id","variant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_carts_pub_id" ON "carts" USING btree ("tenant_id","pub_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_carts_active_session" ON "carts" USING btree ("tenant_id","session_id") WHERE status = 'active' AND session_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_carts_active_customer" ON "carts" USING btree ("tenant_id","customer_id") WHERE status = 'active' AND customer_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_carts_tenant_status" ON "carts" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "idx_carts_expiry" ON "carts" USING btree ("expires_at") WHERE status = 'active';--> statement-breakpoint
CREATE INDEX "idx_order_items_order" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_order_items_variant" ON "order_items" USING btree ("variant_id") WHERE variant_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_orders_pub_id" ON "orders" USING btree ("tenant_id","pub_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_orders_order_number" ON "orders" USING btree ("tenant_id","order_number");--> statement-breakpoint
CREATE INDEX "idx_orders_tenant_status" ON "orders" USING btree ("tenant_id","status","placed_at");--> statement-breakpoint
CREATE INDEX "idx_orders_customer_email" ON "orders" USING btree ("tenant_id","customer_email");