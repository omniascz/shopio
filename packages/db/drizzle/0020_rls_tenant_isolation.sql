-- Row-Level Security tenant isolation (per `30-security.md`).
--
-- The app currently connects as a SUPERUSER, which BYPASSES RLS entirely.
-- This migration creates a dedicated NON-superuser role `shopio_app` that the
-- application connects as for tenant-scoped work; queries run inside a
-- transaction that sets `app.current_tenant_id`, and the policies below confine
-- every row to that tenant. The legacy superuser connection keeps working for
-- bootstrap/auth (signup, login, tenant creation) and is unaffected by RLS.
--
-- Idempotent: safe to re-run.

-- 1) Dedicated application role (NOSUPERUSER → subject to RLS; NOBYPASSRLS).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'shopio_app') THEN
    CREATE ROLE shopio_app LOGIN PASSWORD 'shopio_app_dev_password' NOSUPERUSER NOBYPASSRLS;
  END IF;
END $$;

-- 2) Privileges (DML only — no DDL; RLS does the row gating).
GRANT USAGE ON SCHEMA public TO shopio_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO shopio_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO shopio_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO shopio_app;
-- Future tables/sequences created by migrations (run as superuser) inherit these.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO shopio_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO shopio_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO shopio_app;

-- 3) Enable + FORCE RLS and install the tenant-isolation policy on every table
--    that carries a tenant_id. FORCE makes even the table owner subject to it.
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'audit_log_entries','cart_items','carts','categories','channels',
    'cms_blog_posts','cms_pages','companies','coupon_redemptions','coupons',
    'customer_auth_tokens','customer_sessions','customers','invoice_items',
    'invoice_number_sequences','invoices','order_items','orders',
    'product_categories','product_media','product_reviews','product_variants',
    'products','return_items','returns','sessions','shipment_events',
    'shipment_items','shipments','shipping_provider_configs','shipping_rates',
    'shipping_zones','stock_movements','stock_reservations','tax_rates',
    'translations','user_tenant_memberships'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON public.%I '
      || 'USING (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid) '
      || 'WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid)',
      t
    );
  END LOOP;
END $$;
