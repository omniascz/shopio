-- Custom SQL migration file, put your code below! --

-- Tenant integrity hardening — per `30-security.md` audit finding: child rows
-- could theoretically reference another tenant's parent (FKs were on bare id).
-- Composite same-tenant FKs make the DATABASE enforce that every child row
-- lives in its parent's tenant; the app layer keeps WHERE tenant_id filters.
--
-- NOTE for drizzle-kit: these constraints are additive and intentionally not
-- modeled in the TS schema (generate diffs against snapshots, not live DB —
-- it will not attempt to drop them).

-- 1) Parent uniques (tenant_id, id) — required targets for composite FKs
ALTER TABLE "products" ADD CONSTRAINT "uq_products_tenant_row" UNIQUE ("tenant_id", "id");--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "uq_product_variants_tenant_row" UNIQUE ("tenant_id", "id");--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "uq_categories_tenant_row" UNIQUE ("tenant_id", "id");--> statement-breakpoint
ALTER TABLE "carts" ADD CONSTRAINT "uq_carts_tenant_row" UNIQUE ("tenant_id", "id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "uq_orders_tenant_row" UNIQUE ("tenant_id", "id");--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "uq_order_items_tenant_row" UNIQUE ("tenant_id", "id");--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "uq_returns_tenant_row" UNIQUE ("tenant_id", "id");--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "uq_shipments_tenant_row" UNIQUE ("tenant_id", "id");--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "uq_invoices_tenant_row" UNIQUE ("tenant_id", "id");--> statement-breakpoint

-- 2) Composite child FKs (NO ACTION — existing single-column FKs keep their
--    cascade/restrict semantics; these only add the same-tenant guarantee).
--    Nullable ref columns use default MATCH SIMPLE: NULL ref → not enforced.
ALTER TABLE "product_variants" ADD CONSTRAINT "fk_product_variants_tenant_product" FOREIGN KEY ("tenant_id", "product_id") REFERENCES "products" ("tenant_id", "id");--> statement-breakpoint
ALTER TABLE "product_media" ADD CONSTRAINT "fk_product_media_tenant_product" FOREIGN KEY ("tenant_id", "product_id") REFERENCES "products" ("tenant_id", "id");--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "fk_product_categories_tenant_product" FOREIGN KEY ("tenant_id", "product_id") REFERENCES "products" ("tenant_id", "id");--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "fk_product_categories_tenant_category" FOREIGN KEY ("tenant_id", "category_id") REFERENCES "categories" ("tenant_id", "id");--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "fk_cart_items_tenant_cart" FOREIGN KEY ("tenant_id", "cart_id") REFERENCES "carts" ("tenant_id", "id");--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "fk_cart_items_tenant_variant" FOREIGN KEY ("tenant_id", "variant_id") REFERENCES "product_variants" ("tenant_id", "id");--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "fk_order_items_tenant_order" FOREIGN KEY ("tenant_id", "order_id") REFERENCES "orders" ("tenant_id", "id");--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "fk_order_items_tenant_variant" FOREIGN KEY ("tenant_id", "variant_id") REFERENCES "product_variants" ("tenant_id", "id");--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "fk_returns_tenant_order" FOREIGN KEY ("tenant_id", "order_id") REFERENCES "orders" ("tenant_id", "id");--> statement-breakpoint
ALTER TABLE "return_items" ADD CONSTRAINT "fk_return_items_tenant_return" FOREIGN KEY ("tenant_id", "return_id") REFERENCES "returns" ("tenant_id", "id");--> statement-breakpoint
ALTER TABLE "return_items" ADD CONSTRAINT "fk_return_items_tenant_order_item" FOREIGN KEY ("tenant_id", "order_item_id") REFERENCES "order_items" ("tenant_id", "id");--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "fk_shipments_tenant_order" FOREIGN KEY ("tenant_id", "order_id") REFERENCES "orders" ("tenant_id", "id");--> statement-breakpoint
ALTER TABLE "shipment_items" ADD CONSTRAINT "fk_shipment_items_tenant_shipment" FOREIGN KEY ("tenant_id", "shipment_id") REFERENCES "shipments" ("tenant_id", "id");--> statement-breakpoint
ALTER TABLE "shipment_items" ADD CONSTRAINT "fk_shipment_items_tenant_order_item" FOREIGN KEY ("tenant_id", "order_item_id") REFERENCES "order_items" ("tenant_id", "id");--> statement-breakpoint
ALTER TABLE "shipment_events" ADD CONSTRAINT "fk_shipment_events_tenant_shipment" FOREIGN KEY ("tenant_id", "shipment_id") REFERENCES "shipments" ("tenant_id", "id");--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "fk_invoices_tenant_order" FOREIGN KEY ("tenant_id", "order_id") REFERENCES "orders" ("tenant_id", "id");--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "fk_invoice_items_tenant_invoice" FOREIGN KEY ("tenant_id", "invoice_id") REFERENCES "invoices" ("tenant_id", "id");--> statement-breakpoint
ALTER TABLE "stock_reservations" ADD CONSTRAINT "fk_stock_reservations_tenant_variant" FOREIGN KEY ("tenant_id", "variant_id") REFERENCES "product_variants" ("tenant_id", "id");--> statement-breakpoint
ALTER TABLE "stock_reservations" ADD CONSTRAINT "fk_stock_reservations_tenant_order" FOREIGN KEY ("tenant_id", "order_id") REFERENCES "orders" ("tenant_id", "id");--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "fk_stock_movements_tenant_variant" FOREIGN KEY ("tenant_id", "variant_id") REFERENCES "product_variants" ("tenant_id", "id");
