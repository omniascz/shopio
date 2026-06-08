CREATE TABLE "oauth_apps" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"pub_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"client_id" text NOT NULL,
	"client_secret_hash" text NOT NULL,
	"client_secret_hint" text NOT NULL,
	"redirect_uris" text[] NOT NULL,
	"scopes" text[] NOT NULL,
	"icon_url" text,
	"website_url" text,
	"status" text DEFAULT 'active' NOT NULL,
	"owner_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_auth_codes" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"app_id" uuid NOT NULL,
	"authorization_id" uuid NOT NULL,
	"scopes" text[] NOT NULL,
	"redirect_uri" text NOT NULL,
	"code_challenge" text,
	"user_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_authorizations" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"pub_id" text NOT NULL,
	"app_id" uuid NOT NULL,
	"scopes" text[] NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "oauth_tokens" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"app_id" uuid NOT NULL,
	"authorization_id" uuid NOT NULL,
	"access_token_hash" text NOT NULL,
	"refresh_token_hash" text NOT NULL,
	"scopes" text[] NOT NULL,
	"access_expires_at" timestamp with time zone NOT NULL,
	"refresh_expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "oauth_auth_codes" ADD CONSTRAINT "oauth_auth_codes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_auth_codes" ADD CONSTRAINT "oauth_auth_codes_app_id_oauth_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."oauth_apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_auth_codes" ADD CONSTRAINT "oauth_auth_codes_authorization_id_oauth_authorizations_id_fk" FOREIGN KEY ("authorization_id") REFERENCES "public"."oauth_authorizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_authorizations" ADD CONSTRAINT "oauth_authorizations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_authorizations" ADD CONSTRAINT "oauth_authorizations_app_id_oauth_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."oauth_apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_tokens" ADD CONSTRAINT "oauth_tokens_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_tokens" ADD CONSTRAINT "oauth_tokens_app_id_oauth_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."oauth_apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_tokens" ADD CONSTRAINT "oauth_tokens_authorization_id_oauth_authorizations_id_fk" FOREIGN KEY ("authorization_id") REFERENCES "public"."oauth_authorizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_oauth_apps_pub_id" ON "oauth_apps" USING btree ("pub_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_oauth_apps_client_id" ON "oauth_apps" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_oauth_apps_status" ON "oauth_apps" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_oauth_auth_codes_code" ON "oauth_auth_codes" USING btree ("code_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_oauth_authorizations_pub_id" ON "oauth_authorizations" USING btree ("tenant_id","pub_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_oauth_authorizations_app" ON "oauth_authorizations" USING btree ("tenant_id","app_id") WHERE status = 'active';--> statement-breakpoint
CREATE INDEX "idx_oauth_authorizations_tenant" ON "oauth_authorizations" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_oauth_tokens_access" ON "oauth_tokens" USING btree ("access_token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_oauth_tokens_refresh" ON "oauth_tokens" USING btree ("refresh_token_hash");--> statement-breakpoint
CREATE INDEX "idx_oauth_tokens_authorization" ON "oauth_tokens" USING btree ("authorization_id");--> statement-breakpoint
-- RLS tenant isolation (per `30`, migration 0020). oauth_apps is GLOBAL (no RLS,
-- like tenants). The tenant-scoped tables get the standard policy; the auth path
-- resolves tokens/codes by hash on the superuser pool (which bypasses RLS).
DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['oauth_authorizations','oauth_auth_codes','oauth_tokens'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I', tbl);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON public.%I '
      || 'USING (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid) '
      || 'WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid)',
      tbl);
  END LOOP;
END $$;
