CREATE TABLE "ai_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"operation_id" uuid NOT NULL,
	"task" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cached_input_tokens" integer DEFAULT 0 NOT NULL,
	"estimated_cost_usd" numeric(10, 6) DEFAULT 0 NOT NULL,
	"cost_usd" numeric(10, 6) DEFAULT 0 NOT NULL,
	"status" text NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "language_profiles" (
	"user_id" uuid NOT NULL,
	"language" text NOT NULL,
	"exam" text DEFAULT 'TOPIK' NOT NULL,
	"target_level" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "language_profiles_user_id_language_pk" PRIMARY KEY("user_id","language")
);
--> statement-breakpoint
CREATE TABLE "model_pricing" (
	"model_id" text PRIMARY KEY NOT NULL,
	"input_per_mtok" numeric(10, 4) NOT NULL,
	"output_per_mtok" numeric(10, 4) NOT NULL,
	"cache_read_per_mtok" numeric(10, 4),
	"verified" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"native_language" text DEFAULT 'en' NOT NULL,
	"active_language" text DEFAULT 'ko' NOT NULL,
	"ai_provider" text,
	"ai_model_smart" text,
	"ai_model_fast" text,
	"budget_per_request_usd" numeric(10, 4) DEFAULT 0.5 NOT NULL,
	"budget_monthly_usd" numeric(10, 2) DEFAULT 10 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ai_usage_user_created_idx" ON "ai_usage" USING btree ("user_id","created_at");