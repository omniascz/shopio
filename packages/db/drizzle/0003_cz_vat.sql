CREATE TABLE "tax_rates" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"country_code" text NOT NULL,
	"tax_class_code" text NOT NULL,
	"rate_basis_points" integer NOT NULL,
	"name" text NOT NULL,
	"valid_from" date NOT NULL,
	"valid_until" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "price_includes_tax" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "shipping_tax_class" text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "tax_class_code" text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "tax_class_code" text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "tax_rate_basis_points" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "price_includes_tax" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tax_breakdown" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "tax_rates" ADD CONSTRAINT "tax_rates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tax_rates_window" ON "tax_rates" USING btree ("tenant_id","country_code","tax_class_code","valid_from");--> statement-breakpoint
CREATE INDEX "idx_tax_rates_lookup" ON "tax_rates" USING btree ("tenant_id","country_code","tax_class_code");