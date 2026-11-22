CREATE TABLE "activity_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"language" text NOT NULL,
	"kind" text NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"ref_id" uuid,
	"session_id" uuid,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"local_date" date NOT NULL,
	"dedupe_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_progress" (
	"user_id" uuid NOT NULL,
	"language" text NOT NULL,
	"local_date" date NOT NULL,
	"words_answered" integer DEFAULT 0 NOT NULL,
	"grammar_lessons" integer DEFAULT 0 NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"goal_words" smallint NOT NULL,
	"goal_grammar" smallint NOT NULL,
	"goal_met" boolean DEFAULT false NOT NULL,
	"goal_met_at" timestamp with time zone,
	CONSTRAINT "daily_progress_user_id_language_local_date_pk" PRIMARY KEY("user_id","language","local_date")
);
--> statement-breakpoint
CREATE TABLE "milestones_earned" (
	"user_id" uuid NOT NULL,
	"language" text NOT NULL,
	"milestone_id" text NOT NULL,
	"earned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "milestones_earned_user_id_language_milestone_id_pk" PRIMARY KEY("user_id","language","milestone_id")
);
--> statement-breakpoint
ALTER TABLE "language_profiles" ADD COLUMN "daily_goal_words" smallint DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE "language_profiles" ADD COLUMN "daily_goal_grammar" smallint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "language_profiles" ADD COLUMN "points_total" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "language_profiles" ADD COLUMN "best_streak" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "timezone" text DEFAULT 'UTC' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "show_points" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "celebrate_milestones" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX "activity_events_user_lang_date_idx" ON "activity_events" USING btree ("user_id","language","local_date");--> statement-breakpoint
CREATE UNIQUE INDEX "activity_events_user_dedupe_uq" ON "activity_events" USING btree ("user_id","dedupe_key") WHERE "activity_events"."dedupe_key" is not null;--> statement-breakpoint
ALTER TABLE "language_profiles" ADD CONSTRAINT "daily_goal_words_range" CHECK ("language_profiles"."daily_goal_words" between 5 and 200);--> statement-breakpoint
ALTER TABLE "language_profiles" ADD CONSTRAINT "daily_goal_grammar_range" CHECK ("language_profiles"."daily_goal_grammar" between 0 and 5);