CREATE TABLE "match_telemetry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"paste_count" integer DEFAULT 0 NOT NULL,
	"drop_count" integer DEFAULT 0 NOT NULL,
	"copy_count" integer DEFAULT 0 NOT NULL,
	"blur_count" integer DEFAULT 0 NOT NULL,
	"focus_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_telemetry_match_id_user_id_unique" UNIQUE("match_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "titles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"kind" text DEFAULT 'title' NOT NULL,
	"icon" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"criteria" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "titles_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "user_question_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"topic" text DEFAULT 'general' NOT NULL,
	"difficulty_id" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"solved" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"best_time_ms" integer,
	"last_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_question_stats_user_id_question_id_unique" UNIQUE("user_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "user_titles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title_id" uuid NOT NULL,
	"awarded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"match_id" uuid,
	CONSTRAINT "user_titles_user_id_title_id_unique" UNIQUE("user_id","title_id")
);
--> statement-breakpoint
ALTER TABLE "question_versions" ADD COLUMN "examples" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "description_md" text;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "topic" text DEFAULT 'general' NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "source" text DEFAULT 'clutch-original' NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "license" text;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "attribution" text;--> statement-breakpoint
ALTER TABLE "match_telemetry" ADD CONSTRAINT "match_telemetry_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_telemetry" ADD CONSTRAINT "match_telemetry_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_question_stats" ADD CONSTRAINT "user_question_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_question_stats" ADD CONSTRAINT "user_question_stats_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_titles" ADD CONSTRAINT "user_titles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_titles" ADD CONSTRAINT "user_titles_title_id_titles_id_fk" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_titles" ADD CONSTRAINT "user_titles_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_uqs_user_topic" ON "user_question_stats" USING btree ("user_id","topic");--> statement-breakpoint
CREATE INDEX "idx_user_titles_user" ON "user_titles" USING btree ("user_id");