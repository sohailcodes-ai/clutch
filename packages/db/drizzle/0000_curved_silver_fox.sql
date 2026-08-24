CREATE TYPE "public"."abuse_severity" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."abuse_status" AS ENUM('open', 'reviewed', 'actioned', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."match_result" AS ENUM('win', 'loss', 'draw', 'forfeit', 'no_result');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('queued', 'matched', 'starting', 'active', 'evaluating', 'resolved', 'cancelled', 'abandoned', 'draw');--> statement-breakpoint
CREATE TYPE "public"."question_status" AS ENUM('draft', 'published', 'retired');--> statement-breakpoint
CREATE TYPE "public"."queue_status" AS ENUM('waiting', 'matched', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."season_status" AS ENUM('upcoming', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('received', 'queued', 'running', 'accepted', 'wrong_answer', 'time_limit', 'runtime_error', 'compile_error', 'internal_error');--> statement-breakpoint
CREATE TYPE "public"."test_visibility" AS ENUM('public', 'hidden');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended', 'banned');--> statement-breakpoint
CREATE TABLE "abuse_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"match_id" uuid,
	"flag_type" text NOT NULL,
	"severity" "abuse_severity" NOT NULL,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "abuse_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "difficulty_bands" (
	"id" text PRIMARY KEY NOT NULL,
	"min_rating" integer NOT NULL,
	"max_rating" integer NOT NULL,
	"sort_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idempotency_records" (
	"key" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"route" text NOT NULL,
	"request_hash" text NOT NULL,
	"response_code" integer NOT NULL,
	"response_body" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "match_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"match_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"actor_user_id" uuid,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"slot" integer NOT NULL,
	"rating_before" integer NOT NULL,
	"rating_after" integer,
	"result" "match_result",
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ready_at" timestamp with time zone,
	"disconnected_at" timestamp with time zone,
	CONSTRAINT "match_participants_match_id_user_id_unique" UNIQUE("match_id","user_id"),
	CONSTRAINT "match_participants_match_id_slot_unique" UNIQUE("match_id","slot")
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_id" text NOT NULL,
	"season_id" uuid NOT NULL,
	"stack_id" text NOT NULL,
	"question_version_id" uuid NOT NULL,
	"difficulty_id" text NOT NULL,
	"status" "match_status" DEFAULT 'queued' NOT NULL,
	"time_limit_sec" integer NOT NULL,
	"started_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"winner_user_id" uuid,
	"resolve_reason" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matches_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "question_stack_support" (
	"question_id" uuid NOT NULL,
	"stack_id" text NOT NULL,
	CONSTRAINT "question_stack_support_question_id_stack_id_unique" UNIQUE("question_id","stack_id")
);
--> statement-breakpoint
CREATE TABLE "question_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"prompt_md" text NOT NULL,
	"starter_code" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"constraints" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"published_at" timestamp with time zone,
	CONSTRAINT "question_versions_question_id_version_unique" UNIQUE("question_id","version")
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"difficulty_id" text NOT NULL,
	"time_limit_sec" integer DEFAULT 900 NOT NULL,
	"memory_limit_mb" integer DEFAULT 256 NOT NULL,
	"status" "question_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "questions_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "queue_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"stack_id" text NOT NULL,
	"season_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"region" text NOT NULL,
	"difficulty_id" text,
	"status" "queue_status" DEFAULT 'waiting' NOT NULL,
	"enqueued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"matched_at" timestamp with time zone,
	"match_id" uuid
);
--> statement-breakpoint
CREATE TABLE "rank_tiers" (
	"id" text PRIMARY KEY NOT NULL,
	"min_rating" integer NOT NULL,
	"max_rating" integer,
	"sort_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rating_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"stack_id" text NOT NULL,
	"match_id" uuid NOT NULL,
	"season_id" uuid NOT NULL,
	"rating_before" integer NOT NULL,
	"rating_delta" integer NOT NULL,
	"rating_after" integer NOT NULL,
	"k_factor" integer NOT NULL,
	"expected_score" numeric(6, 4) NOT NULL,
	"actual_score" numeric(3, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "season_rating_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"stack_id" text NOT NULL,
	"start_rating" integer NOT NULL,
	"end_rating" integer,
	"peak_rating" integer NOT NULL,
	"games_played" integer DEFAULT 0 NOT NULL,
	"final_rank" integer,
	CONSTRAINT "season_rating_snapshots_season_id_user_id_stack_id_unique" UNIQUE("season_id","user_id","stack_id")
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" integer NOT NULL,
	"name" text NOT NULL,
	"title" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" "season_status" DEFAULT 'upcoming' NOT NULL,
	"soft_reset_factor" numeric(4, 3) DEFAULT '0.800' NOT NULL,
	"decay_after_days" integer DEFAULT 14 NOT NULL,
	"placement_matches" integer DEFAULT 5 NOT NULL,
	CONSTRAINT "seasons_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "stacks" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"symbol" text NOT NULL,
	"judge_runtime" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submission_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"test_case_id" uuid NOT NULL,
	"status" "submission_status" NOT NULL,
	"stdout" text,
	"stderr" text,
	"execution_time_ms" integer,
	"memory_kb" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"question_version_id" uuid NOT NULL,
	"source_code" text NOT NULL,
	"language" text NOT NULL,
	"status" "submission_status" DEFAULT 'received' NOT NULL,
	"passed_count" integer DEFAULT 0 NOT NULL,
	"total_count" integer DEFAULT 0 NOT NULL,
	"execution_time_ms" integer,
	"memory_kb" integer,
	"is_final" boolean DEFAULT false NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "submissions_match_id_user_id_idempotency_key_unique" UNIQUE("match_id","user_id","idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "test_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_version_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"visibility" "test_visibility" NOT NULL,
	"input" text NOT NULL,
	"expected_output" text NOT NULL,
	"weight" integer DEFAULT 1 NOT NULL,
	"time_limit_ms" integer,
	"memory_limit_mb" integer
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"handle" text NOT NULL,
	"display_name" text,
	"avatar_url" text,
	"region" text DEFAULT 'global' NOT NULL,
	"bio" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_profiles_handle_unique" UNIQUE("handle")
);
--> statement-breakpoint
CREATE TABLE "user_question_history" (
	"user_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"times_seen" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "user_question_history_user_id_question_id_unique" UNIQUE("user_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "user_stack_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"stack_id" text NOT NULL,
	"rating" integer DEFAULT 1000 NOT NULL,
	"tier_id" text,
	"games_played" integer DEFAULT 0 NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL,
	"losses" integer DEFAULT 0 NOT NULL,
	"draws" integer DEFAULT 0 NOT NULL,
	"placement_remaining" integer DEFAULT 5 NOT NULL,
	"peak_rating" integer DEFAULT 1000 NOT NULL,
	"last_played_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_stack_ratings_user_id_stack_id_unique" UNIQUE("user_id","stack_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"email_verified_at" timestamp with time zone,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "abuse_flags" ADD CONSTRAINT "abuse_flags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "abuse_flags" ADD CONSTRAINT "abuse_flags_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_stack_id_stacks_id_fk" FOREIGN KEY ("stack_id") REFERENCES "public"."stacks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_question_version_id_question_versions_id_fk" FOREIGN KEY ("question_version_id") REFERENCES "public"."question_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_difficulty_id_difficulty_bands_id_fk" FOREIGN KEY ("difficulty_id") REFERENCES "public"."difficulty_bands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_winner_user_id_users_id_fk" FOREIGN KEY ("winner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_stack_support" ADD CONSTRAINT "question_stack_support_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_stack_support" ADD CONSTRAINT "question_stack_support_stack_id_stacks_id_fk" FOREIGN KEY ("stack_id") REFERENCES "public"."stacks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_versions" ADD CONSTRAINT "question_versions_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_difficulty_id_difficulty_bands_id_fk" FOREIGN KEY ("difficulty_id") REFERENCES "public"."difficulty_bands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queue_entries" ADD CONSTRAINT "queue_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queue_entries" ADD CONSTRAINT "queue_entries_stack_id_stacks_id_fk" FOREIGN KEY ("stack_id") REFERENCES "public"."stacks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queue_entries" ADD CONSTRAINT "queue_entries_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queue_entries" ADD CONSTRAINT "queue_entries_difficulty_id_difficulty_bands_id_fk" FOREIGN KEY ("difficulty_id") REFERENCES "public"."difficulty_bands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queue_entries" ADD CONSTRAINT "queue_entries_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_ledger" ADD CONSTRAINT "rating_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_ledger" ADD CONSTRAINT "rating_ledger_stack_id_stacks_id_fk" FOREIGN KEY ("stack_id") REFERENCES "public"."stacks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_ledger" ADD CONSTRAINT "rating_ledger_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_ledger" ADD CONSTRAINT "rating_ledger_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_rating_snapshots" ADD CONSTRAINT "season_rating_snapshots_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_rating_snapshots" ADD CONSTRAINT "season_rating_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_rating_snapshots" ADD CONSTRAINT "season_rating_snapshots_stack_id_stacks_id_fk" FOREIGN KEY ("stack_id") REFERENCES "public"."stacks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_runs" ADD CONSTRAINT "submission_runs_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_runs" ADD CONSTRAINT "submission_runs_test_case_id_test_cases_id_fk" FOREIGN KEY ("test_case_id") REFERENCES "public"."test_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_question_version_id_question_versions_id_fk" FOREIGN KEY ("question_version_id") REFERENCES "public"."question_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_question_version_id_question_versions_id_fk" FOREIGN KEY ("question_version_id") REFERENCES "public"."question_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_question_history" ADD CONSTRAINT "user_question_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_question_history" ADD CONSTRAINT "user_question_history_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_stack_ratings" ADD CONSTRAINT "user_stack_ratings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_stack_ratings" ADD CONSTRAINT "user_stack_ratings_stack_id_stacks_id_fk" FOREIGN KEY ("stack_id") REFERENCES "public"."stacks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_stack_ratings" ADD CONSTRAINT "user_stack_ratings_tier_id_rank_tiers_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."rank_tiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_match_events_match" ON "match_events" USING btree ("match_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_queue_waiting_user" ON "queue_entries" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_queue_entries_user_waiting" ON "queue_entries" USING btree ("user_id") WHERE status = 'waiting';--> statement-breakpoint
CREATE INDEX "idx_user_stack_ratings_leaderboard" ON "user_stack_ratings" USING btree ("stack_id","rating");