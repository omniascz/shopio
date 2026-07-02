CREATE TABLE "flow_runs" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"flow_id" uuid NOT NULL,
	"flow_pub_id" text NOT NULL,
	"trigger_event" text NOT NULL,
	"order_id" uuid,
	"order_number" text,
	"status" text NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"action_results" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pending_actions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"context_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	"next_attempt_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "flow_runs" ADD CONSTRAINT "flow_runs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_runs" ADD CONSTRAINT "flow_runs_flow_id_flows_id_fk" FOREIGN KEY ("flow_id") REFERENCES "public"."flows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_flow_runs_flow" ON "flow_runs" USING btree ("tenant_id","flow_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_flow_runs_due" ON "flow_runs" USING btree ("status","next_attempt_at");--> statement-breakpoint
-- RLS tenant isolation (per `30`, migration 0020). Reads go through the app
-- role (RLS-enforced); the retry worker writes on the superuser pool (bypass).
DO $$
BEGIN
  EXECUTE 'ALTER TABLE public.flow_runs ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.flow_runs FORCE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation ON public.flow_runs';
  EXECUTE 'CREATE POLICY tenant_isolation ON public.flow_runs '
    || 'USING (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid) '
    || 'WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid)';
END $$;
