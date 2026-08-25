CREATE TYPE "public"."bracket_node_status" AS ENUM('pending', 'active', 'completed');--> statement-breakpoint
CREATE TABLE "tournament_bracket_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"round_id" uuid NOT NULL,
	"round_number" integer NOT NULL,
	"position" integer NOT NULL,
	"participant_a_user_id" uuid,
	"participant_b_user_id" uuid,
	"match_id" uuid,
	"winner_user_id" uuid,
	"is_bye" boolean DEFAULT false NOT NULL,
	"status" "bracket_node_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tournament_bracket_nodes_tournament_id_round_number_position_unique" UNIQUE("tournament_id","round_number","position")
);
--> statement-breakpoint
ALTER TABLE "room_participants" ADD COLUMN "role" text DEFAULT 'player' NOT NULL;--> statement-breakpoint
ALTER TABLE "room_participants" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "locked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "finished_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tournament_bracket_nodes" ADD CONSTRAINT "tournament_bracket_nodes_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_bracket_nodes" ADD CONSTRAINT "tournament_bracket_nodes_round_id_tournament_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."tournament_rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_bracket_nodes" ADD CONSTRAINT "tournament_bracket_nodes_participant_a_user_id_users_id_fk" FOREIGN KEY ("participant_a_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_bracket_nodes" ADD CONSTRAINT "tournament_bracket_nodes_participant_b_user_id_users_id_fk" FOREIGN KEY ("participant_b_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_bracket_nodes" ADD CONSTRAINT "tournament_bracket_nodes_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_bracket_nodes" ADD CONSTRAINT "tournament_bracket_nodes_winner_user_id_users_id_fk" FOREIGN KEY ("winner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_bracket_tournament" ON "tournament_bracket_nodes" USING btree ("tournament_id");--> statement-breakpoint
CREATE INDEX "idx_bracket_round" ON "tournament_bracket_nodes" USING btree ("round_id");