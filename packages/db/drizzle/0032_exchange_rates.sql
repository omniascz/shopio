CREATE TABLE "exchange_rates" (
	"currency" text PRIMARY KEY NOT NULL,
	"amount" integer DEFAULT 1 NOT NULL,
	"rate" numeric(18, 6) NOT NULL,
	"fixing_date" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_exchange_rates_currency" ON "exchange_rates" USING btree ("currency");