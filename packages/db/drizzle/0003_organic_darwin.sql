ALTER TABLE "user_profiles" ADD COLUMN "onboarding_completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "primary_stack_id" text;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_primary_stack_id_stacks_id_fk" FOREIGN KEY ("primary_stack_id") REFERENCES "public"."stacks"("id") ON DELETE no action ON UPDATE no action;