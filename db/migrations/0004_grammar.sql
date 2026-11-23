CREATE TABLE "grammar_links" (
	"user_id" uuid NOT NULL,
	"grammar_id" uuid NOT NULL,
	"related_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"note" text,
	CONSTRAINT "grammar_links_grammar_id_related_id_pk" PRIMARY KEY("grammar_id","related_id"),
	CONSTRAINT "grammar_links_not_self" CHECK ("grammar_links"."grammar_id" <> "grammar_links"."related_id")
);
--> statement-breakpoint
CREATE TABLE "grammar_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"language" text NOT NULL,
	"title" text NOT NULL,
	"pattern" text NOT NULL,
	"variants" text[] DEFAULT '{}'::text[] NOT NULL,
	"match_keys" text[] DEFAULT '{}'::text[] NOT NULL,
	"meaning_short" text NOT NULL,
	"level" smallint,
	"description_md" text DEFAULT '' NOT NULL,
	"formation_md" text DEFAULT '' NOT NULL,
	"examples" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"similar_md" text DEFAULT '' NOT NULL,
	"status" "content_status" DEFAULT 'active' NOT NULL,
	"source" "content_source" DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "grammar_points_level_range" CHECK ("grammar_points"."level" is null or "grammar_points"."level" between 1 and 6)
);
--> statement-breakpoint
ALTER TABLE "grammar_links" ADD CONSTRAINT "grammar_links_grammar_id_grammar_points_id_fk" FOREIGN KEY ("grammar_id") REFERENCES "public"."grammar_points"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grammar_links" ADD CONSTRAINT "grammar_links_related_id_grammar_points_id_fk" FOREIGN KEY ("related_id") REFERENCES "public"."grammar_points"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "grammar_links_user_idx" ON "grammar_links" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "grammar_links_related_idx" ON "grammar_links" USING btree ("related_id");--> statement-breakpoint
CREATE INDEX "grammar_points_user_lang_idx" ON "grammar_points" USING btree ("user_id","language");--> statement-breakpoint
CREATE INDEX "grammar_points_match_keys_idx" ON "grammar_points" USING gin ("match_keys");