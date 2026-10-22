CREATE TABLE "user_preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"bet_sessions_per_week" integer NOT NULL,
	"default_duration_min" integer NOT NULL,
	"weekly_goal" integer NOT NULL,
	"time_zone" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;