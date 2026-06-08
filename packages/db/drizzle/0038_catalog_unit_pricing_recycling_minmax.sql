ALTER TABLE "products" ADD COLUMN "unit_content_amount" numeric;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "unit_content_uom" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "unit_base_amount" numeric;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "recycling_fee_amount" bigint;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "deposit_amount" bigint;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "min_order_quantity" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "max_order_quantity" integer;