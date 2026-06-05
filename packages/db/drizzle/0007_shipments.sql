CREATE TABLE "shipment_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"shipment_id" uuid NOT NULL,
	"status" text NOT NULL,
	"description" text,
	"source" text DEFAULT 'manual' NOT NULL,
	"is_customer_visible" boolean DEFAULT true NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"raw" jsonb
);
--> statement-breakpoint
CREATE TABLE "shipment_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"shipment_id" uuid NOT NULL,
	"order_item_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"title_snapshot" text NOT NULL,
	"sku_snapshot" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"pub_id" text NOT NULL,
	"order_id" uuid NOT NULL,
	"number" text NOT NULL,
	"carrier_code" text NOT NULL,
	"service_code" text NOT NULL,
	"shipping_address_snapshot" jsonb NOT NULL,
	"pickup_point_snapshot" jsonb,
	"weight_grams" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"status_entered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"carrier_shipment_id" text,
	"tracking_number" text,
	"tracking_url" text,
	"label_pdf_base64" text,
	"label_generated_at" timestamp with time zone,
	"label_provider" text,
	"handed_over_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"internal_note" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "quantity_fulfilled" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_items" ADD CONSTRAINT "shipment_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_items" ADD CONSTRAINT "shipment_items_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_items" ADD CONSTRAINT "shipment_items_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_shipment_events_shipment" ON "shipment_events" USING btree ("shipment_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_shipment_items" ON "shipment_items" USING btree ("shipment_id","order_item_id");--> statement-breakpoint
CREATE INDEX "idx_shipment_items_shipment" ON "shipment_items" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "idx_shipment_items_order_item" ON "shipment_items" USING btree ("order_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_shipments_pub_id" ON "shipments" USING btree ("tenant_id","pub_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_shipments_number" ON "shipments" USING btree ("tenant_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_shipments_tracking" ON "shipments" USING btree ("tenant_id","carrier_code","tracking_number") WHERE tracking_number IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_shipments_order" ON "shipments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_shipments_tenant_status" ON "shipments" USING btree ("tenant_id","status","created_at");