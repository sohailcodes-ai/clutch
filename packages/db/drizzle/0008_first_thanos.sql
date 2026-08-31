CREATE TYPE "public"."challenge_status" AS ENUM('pending', 'accepted', 'declined', 'expired', 'cancelled', 'match_created');--> statement-breakpoint
CREATE TYPE "public"."friendship_status" AS ENUM('pending', 'accepted', 'declined');--> statement-breakpoint
CREATE TABLE "challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenger_id" uuid NOT NULL,
	"challenged_id" uuid NOT NULL,
	"status" "challenge_status" DEFAULT 'pending' NOT NULL,
	"stack_id" text NOT NULL,
	"difficulty_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"match_id" uuid
);
--> statement-breakpoint
CREATE TABLE "friendships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_id" uuid NOT NULL,
	"addressee_id" uuid NOT NULL,
	"status" "friendship_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_challenger_id_users_id_fk" FOREIGN KEY ("challenger_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_challenged_id_users_id_fk" FOREIGN KEY ("challenged_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_stack_id_stacks_id_fk" FOREIGN KEY ("stack_id") REFERENCES "public"."stacks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_difficulty_id_difficulty_bands_id_fk" FOREIGN KEY ("difficulty_id") REFERENCES "public"."difficulty_bands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_addressee_id_users_id_fk" FOREIGN KEY ("addressee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_challenges_challenger" ON "challenges" USING btree ("challenger_id","status");--> statement-breakpoint
CREATE INDEX "idx_challenges_challenged" ON "challenges" USING btree ("challenged_id","status");--> statement-breakpoint
CREATE INDEX "idx_challenges_expires" ON "challenges" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_friendships_requester" ON "friendships" USING btree ("requester_id","status");--> statement-breakpoint
CREATE INDEX "idx_friendships_addressee" ON "friendships" USING btree ("addressee_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_friendships_pair" ON "friendships" USING btree ("requester_id","addressee_id");