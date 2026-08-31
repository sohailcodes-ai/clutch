CREATE TABLE "verification_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"otp_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_verification_tokens_user" ON "verification_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_match_participants_user_created" ON "match_participants" USING btree ("user_id","joined_at");--> statement-breakpoint
CREATE INDEX "idx_matches_status_created" ON "matches" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_matches_status_ends" ON "matches" USING btree ("status","ends_at");--> statement-breakpoint
CREATE INDEX "idx_rating_ledger_user_created" ON "rating_ledger" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_submissions_match_user_created" ON "submissions" USING btree ("match_id","user_id","created_at");