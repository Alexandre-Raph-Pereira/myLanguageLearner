CREATE TYPE "public"."content_source" AS ENUM('manual', 'import_csv', 'import_text', 'import_photo', 'topik_lookup', 'alignment');--> statement-breakpoint
CREATE TYPE "public"."content_status" AS ENUM('active', 'suggested');--> statement-breakpoint
CREATE TYPE "public"."word_type" AS ENUM('noun', 'verb', 'adjective', 'adverb', 'pronoun', 'numeral', 'determiner', 'particle', 'counter', 'interjection', 'expression', 'other');--> statement-breakpoint
CREATE TABLE "test_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"language" text NOT NULL,
	"kind" text NOT NULL,
	"mode" text,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'ready' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"time_limit_s" integer,
	"score_correct" integer DEFAULT 0 NOT NULL,
	"score_total" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "word_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid,
	"word_id" uuid NOT NULL,
	"direction" text NOT NULL,
	"answer" text NOT NULL,
	"result" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "words" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"language" text NOT NULL,
	"term" text NOT NULL,
	"meanings" text[] NOT NULL,
	"meaning_key" text NOT NULL,
	"type" "word_type" DEFAULT 'other' NOT NULL,
	"example_sentence" text,
	"example_translation" text,
	"notes" text,
	"level" smallint DEFAULT 0 NOT NULL,
	"interval_days" integer DEFAULT 0 NOT NULL,
	"due_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_reviewed_at" timestamp with time zone,
	"correct_streak" integer DEFAULT 0 NOT NULL,
	"times_correct" integer DEFAULT 0 NOT NULL,
	"times_failed" integer DEFAULT 0 NOT NULL,
	"times_looked_up" integer DEFAULT 0 NOT NULL,
	"status" "content_status" DEFAULT 'active' NOT NULL,
	"source" "content_source" DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "words_level_range" CHECK ("words"."level" between 0 and 3),
	CONSTRAINT "words_meanings_nonempty" CHECK (cardinality("words"."meanings") >= 1)
);
--> statement-breakpoint
ALTER TABLE "word_reviews" ADD CONSTRAINT "word_reviews_session_id_test_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."test_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "word_reviews" ADD CONSTRAINT "word_reviews_word_id_words_id_fk" FOREIGN KEY ("word_id") REFERENCES "public"."words"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "test_sessions_user_kind_idx" ON "test_sessions" USING btree ("user_id","kind","started_at");--> statement-breakpoint
CREATE INDEX "word_reviews_session_idx" ON "word_reviews" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "word_reviews_user_created_idx" ON "word_reviews" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "words_user_lang_term_meaning_uq" ON "words" USING btree ("user_id","language","term","meaning_key");--> statement-breakpoint
CREATE INDEX "words_user_lang_term_idx" ON "words" USING btree ("user_id","language","term");--> statement-breakpoint
CREATE INDEX "words_user_lang_due_idx" ON "words" USING btree ("user_id","language","due_at");