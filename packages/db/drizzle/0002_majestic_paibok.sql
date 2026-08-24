CREATE TYPE "public"."event_status" AS ENUM('draft', 'published', 'cancelled', 'completed');--> statement-breakpoint
CREATE TYPE "public"."room_status" AS ENUM('open', 'in_progress', 'closed');--> statement-breakpoint
CREATE TYPE "public"."title_rarity" AS ENUM('common', 'uncommon', 'rare', 'epic', 'legendary');--> statement-breakpoint
CREATE TYPE "public"."tournament_format" AS ENUM('single_elimination', 'double_elimination', 'round_robin');--> statement-breakpoint
CREATE TYPE "public"."tournament_round_status" AS ENUM('pending', 'ready', 'running', 'completed');--> statement-breakpoint
CREATE TYPE "public"."tournament_status" AS ENUM('draft', 'registration_open', 'seeding', 'running', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "event_difficulty_levels" (
	"event_id" uuid NOT NULL,
	"difficulty_id" text NOT NULL,
	CONSTRAINT "event_difficulty_levels_event_id_difficulty_id_unique" UNIQUE("event_id","difficulty_id")
);
--> statement-breakpoint
CREATE TABLE "event_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_registrations_event_id_user_id_unique" UNIQUE("event_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "event_stacks" (
	"event_id" uuid NOT NULL,
	"stack_id" text NOT NULL,
	CONSTRAINT "event_stacks_event_id_stack_id_unique" UNIQUE("event_id","stack_id")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description_md" text,
	"rules_md" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"max_participants" integer,
	"reward_title_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "event_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "question_topics" (
	"question_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	CONSTRAINT "question_topics_question_id_topic_id_unique" UNIQUE("question_id","topic_id")
);
--> statement-breakpoint
CREATE TABLE "room_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ready_at" timestamp with time zone,
	CONSTRAINT "room_participants_room_id_user_id_unique" UNIQUE("room_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_id" text NOT NULL,
	"name" text NOT NULL,
	"host_user_id" uuid NOT NULL,
	"stack_id" text NOT NULL,
	"difficulty_id" text,
	"max_players" integer NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"ranked" boolean DEFAULT false NOT NULL,
	"time_limit_sec" integer DEFAULT 900 NOT NULL,
	"question_selection_mode" text DEFAULT 'adaptive' NOT NULL,
	"join_code" text,
	"status" "room_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rooms_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"stack_id" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "topics_slug_stack_id_unique" UNIQUE("slug","stack_id")
);
--> statement-breakpoint
CREATE TABLE "tournament_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"seed" integer,
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tournament_registrations_tournament_id_user_id_unique" UNIQUE("tournament_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "tournament_rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"round_number" integer NOT NULL,
	"name" text DEFAULT 'Round' NOT NULL,
	"status" "tournament_round_status" DEFAULT 'pending' NOT NULL,
	"starts_at" timestamp with time zone,
	CONSTRAINT "tournament_rounds_tournament_id_round_number_unique" UNIQUE("tournament_id","round_number")
);
--> statement-breakpoint
CREATE TABLE "tournaments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description_md" text,
	"format" "tournament_format" DEFAULT 'single_elimination' NOT NULL,
	"season_id" uuid NOT NULL,
	"stack_id" text NOT NULL,
	"max_participants" integer NOT NULL,
	"registration_opens_at" timestamp with time zone NOT NULL,
	"registration_closes_at" timestamp with time zone NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"champion_user_id" uuid,
	"reward_title_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "tournament_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tournaments_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "ranked" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "room_id" uuid;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "event_id" uuid;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "tournament_id" uuid;--> statement-breakpoint
ALTER TABLE "titles" ADD COLUMN "rarity" "title_rarity" DEFAULT 'common' NOT NULL;--> statement-breakpoint
ALTER TABLE "titles" ADD COLUMN "is_secret" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "equipped_title_id" uuid;--> statement-breakpoint
ALTER TABLE "event_difficulty_levels" ADD CONSTRAINT "event_difficulty_levels_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_difficulty_levels" ADD CONSTRAINT "event_difficulty_levels_difficulty_id_difficulty_bands_id_fk" FOREIGN KEY ("difficulty_id") REFERENCES "public"."difficulty_bands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_stacks" ADD CONSTRAINT "event_stacks_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_stacks" ADD CONSTRAINT "event_stacks_stack_id_stacks_id_fk" FOREIGN KEY ("stack_id") REFERENCES "public"."stacks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_topics" ADD CONSTRAINT "question_topics_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_topics" ADD CONSTRAINT "question_topics_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_participants" ADD CONSTRAINT "room_participants_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_participants" ADD CONSTRAINT "room_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_host_user_id_users_id_fk" FOREIGN KEY ("host_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_stack_id_stacks_id_fk" FOREIGN KEY ("stack_id") REFERENCES "public"."stacks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_difficulty_id_difficulty_bands_id_fk" FOREIGN KEY ("difficulty_id") REFERENCES "public"."difficulty_bands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_stack_id_stacks_id_fk" FOREIGN KEY ("stack_id") REFERENCES "public"."stacks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_registrations" ADD CONSTRAINT "tournament_registrations_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_registrations" ADD CONSTRAINT "tournament_registrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_rounds" ADD CONSTRAINT "tournament_rounds_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_stack_id_stacks_id_fk" FOREIGN KEY ("stack_id") REFERENCES "public"."stacks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_champion_user_id_users_id_fk" FOREIGN KEY ("champion_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_event_registrations_event" ON "event_registrations" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "idx_room_participants_room" ON "room_participants" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "idx_rooms_status_public" ON "rooms" USING btree ("status","is_public");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_rooms_open_host" ON "rooms" USING btree ("host_user_id") WHERE status = 'open';--> statement-breakpoint
CREATE INDEX "idx_tournament_registrations_tournament" ON "tournament_registrations" USING btree ("tournament_id");--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_equipped_title_id_titles_id_fk" FOREIGN KEY ("equipped_title_id") REFERENCES "public"."titles"("id") ON DELETE set null ON UPDATE no action;