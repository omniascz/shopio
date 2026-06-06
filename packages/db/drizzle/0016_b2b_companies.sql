CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"pub_id" text NOT NULL,
	"name" text NOT NULL,
	"registration_number" text,
	"vat_id" text,
	"billing_address" jsonb,
	"net_terms_enabled" boolean DEFAULT false NOT NULL,
	"net_terms_days" integer DEFAULT 14 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "company_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "company_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "purchase_order_number" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_terms_days" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "due_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "company_id" uuid;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_companies_pub_id" ON "companies" USING btree ("tenant_id","pub_id");--> statement-breakpoint
CREATE INDEX "idx_companies_tenant" ON "companies" USING btree ("tenant_id");