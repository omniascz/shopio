CREATE TABLE "invoice_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"line_kind" text DEFAULT 'product' NOT NULL,
	"sku" text,
	"title" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_label" text DEFAULT 'ks' NOT NULL,
	"unit_price_amount" bigint NOT NULL,
	"net_amount" bigint NOT NULL,
	"tax_class_code" text DEFAULT 'standard' NOT NULL,
	"tax_rate_basis_points" integer DEFAULT 0 NOT NULL,
	"tax_amount" bigint NOT NULL,
	"gross_amount" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_number_sequences" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"sequence_code" text NOT NULL,
	"year" integer NOT NULL,
	"current_position" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"pub_id" text NOT NULL,
	"order_id" uuid NOT NULL,
	"kind" text DEFAULT 'invoice' NOT NULL,
	"related_invoice_id" uuid,
	"number" text NOT NULL,
	"number_sequence_code" text NOT NULL,
	"number_sequence_position" integer NOT NULL,
	"variable_symbol" text,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"taxable_supply_date" date NOT NULL,
	"due_date" date,
	"seller_snapshot" jsonb NOT NULL,
	"buyer_snapshot" jsonb NOT NULL,
	"currency" text NOT NULL,
	"subtotal_amount" bigint NOT NULL,
	"tax_amount" bigint NOT NULL,
	"total_amount" bigint NOT NULL,
	"tax_breakdown" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"price_includes_tax" boolean DEFAULT true NOT NULL,
	"payment_method_kind" text,
	"is_void" boolean DEFAULT false NOT NULL,
	"void_reason" text,
	"voided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_number_sequences" ADD CONSTRAINT "invoice_number_sequences_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_invoice_items_invoice" ON "invoice_items" USING btree ("invoice_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_invoice_number_sequences" ON "invoice_number_sequences" USING btree ("tenant_id","sequence_code","year");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_invoices_pub_id" ON "invoices" USING btree ("tenant_id","pub_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_invoices_number" ON "invoices" USING btree ("tenant_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_invoices_order_regular" ON "invoices" USING btree ("order_id") WHERE kind = 'invoice' AND is_void = false;--> statement-breakpoint
CREATE INDEX "idx_invoices_order" ON "invoices" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_tenant_issued" ON "invoices" USING btree ("tenant_id","issued_at");