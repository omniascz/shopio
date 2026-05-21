CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"pub_id" text NOT NULL,
	"slug" text NOT NULL,
	"display_name" text NOT NULL,
	"legal_entity_name" text,
	"country_code" text NOT NULL,
	"default_locale" text DEFAULT 'cs-CZ' NOT NULL,
	"default_currency" text DEFAULT 'CZK' NOT NULL,
	"timezone" text DEFAULT 'Europe/Prague' NOT NULL,
	"registration_number" text,
	"vat_id" text,
	"status" text DEFAULT 'provisioning' NOT NULL,
	"status_entered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"plan_tier" text DEFAULT 'free' NOT NULL,
	"kek_arn" text,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_tenant_memberships" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"persona_code" text,
	"custom_role_id" uuid,
	"scope_store_ids" text[],
	"scope_region_codes" text[],
	"status" text DEFAULT 'pending_acceptance' NOT NULL,
	"invited_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"assigned_by_user_id" uuid,
	"revoked_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"pub_id" text NOT NULL,
	"email" "citext" NOT NULL,
	"email_verified_at" timestamp with time zone,
	"full_name" text,
	"password_hash" text,
	"mfa_enrolled_at" timestamp with time zone,
	"mfa_totp_secret_encrypted" text,
	"status" text DEFAULT 'pending_verification' NOT NULL,
	"suspension_reason" text,
	"locale" text DEFAULT 'cs-CZ' NOT NULL,
	"timezone" text DEFAULT 'Europe/Prague' NOT NULL,
	"failed_login_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"last_login_ip" "inet",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"tenant_id" uuid,
	"family_id" uuid NOT NULL,
	"refresh_token_hash" text NOT NULL,
	"device_fingerprint_hash" text,
	"user_agent" text,
	"ip_address" "inet",
	"country_code" text,
	"city" text,
	"assurance_level" text NOT NULL,
	"mfa_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_reason" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log_entries" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid,
	"pub_id" text NOT NULL,
	"sequence_number" bigint NOT NULL,
	"category" text NOT NULL,
	"action" text NOT NULL,
	"outcome" text NOT NULL,
	"actor_kind" text NOT NULL,
	"actor_user_id" uuid,
	"actor_token_id" uuid,
	"actor_app_installation_id" uuid,
	"actor_label" text,
	"resource_kind" text,
	"resource_id" uuid,
	"resource_label" text,
	"ip_address" "inet",
	"user_agent" text,
	"session_id" uuid,
	"request_id" text,
	"reason" text,
	"details" jsonb,
	"prev_entry_hash" text,
	"entry_hash" text NOT NULL,
	"signed_batch_id" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_tenant_memberships" ADD CONSTRAINT "user_tenant_memberships_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tenant_memberships" ADD CONSTRAINT "user_tenant_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tenants_pub_id" ON "tenants" USING btree ("pub_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tenants_slug" ON "tenants" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_tenants_status" ON "tenants" USING btree ("status") WHERE status IN ('active','provisioning');--> statement-breakpoint
CREATE UNIQUE INDEX "uq_user_tenant_memberships" ON "user_tenant_memberships" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_user_tenant_memberships_user" ON "user_tenant_memberships" USING btree ("user_id") WHERE status = 'active';--> statement-breakpoint
CREATE INDEX "idx_user_tenant_memberships_tenant" ON "user_tenant_memberships" USING btree ("tenant_id") WHERE status = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "uq_users_pub_id" ON "users" USING btree ("pub_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_users_active" ON "users" USING btree ("status") WHERE status = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "uq_sessions_refresh_hash" ON "sessions" USING btree ("refresh_token_hash");--> statement-breakpoint
CREATE INDEX "idx_sessions_user_active" ON "sessions" USING btree ("user_id") WHERE revoked_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_sessions_expiry" ON "sessions" USING btree ("expires_at") WHERE revoked_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_sessions_family" ON "sessions" USING btree ("family_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_audit_log_pub_id" ON "audit_log_entries" USING btree ("pub_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_audit_log_sequence" ON "audit_log_entries" USING btree ("tenant_id","sequence_number");--> statement-breakpoint
CREATE INDEX "idx_audit_log_tenant" ON "audit_log_entries" USING btree ("tenant_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_audit_log_actor" ON "audit_log_entries" USING btree ("actor_user_id","occurred_at") WHERE actor_user_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_audit_log_resource" ON "audit_log_entries" USING btree ("resource_kind","resource_id","occurred_at") WHERE resource_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_audit_log_category" ON "audit_log_entries" USING btree ("tenant_id","category","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_audit_log_outcome_failure" ON "audit_log_entries" USING btree ("tenant_id","occurred_at") WHERE outcome IN ('failure','denied');