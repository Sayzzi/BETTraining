CREATE TABLE "load_state" (
	"user_id" text PRIMARY KEY NOT NULL,
	"step" integer NOT NULL,
	"last_step_at" text NOT NULL,
	"cycle_started_at" text NOT NULL,
	"assessment_postponed_until" text,
	"last_change" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "training_session" ADD COLUMN "fatigue_advice" text;--> statement-breakpoint
ALTER TABLE "load_state" ADD CONSTRAINT "load_state_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;