CREATE TABLE "translations" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"field" text NOT NULL,
	"locale" text NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "enabled_locales" jsonb DEFAULT '["cs-CZ"]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "translations" ADD CONSTRAINT "translations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_translations_entity_field_locale" ON "translations" USING btree ("tenant_id","entity_type","entity_id","field","locale");--> statement-breakpoint
CREATE INDEX "idx_translations_lookup" ON "translations" USING btree ("tenant_id","entity_type","entity_id","locale");