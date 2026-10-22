ALTER TYPE "public"."trial_outcome" ADD VALUE 'error' BEFORE 'lapse';--> statement-breakpoint
CREATE TABLE "difficulty_state" (
	"user_id" text NOT NULL,
	"exercise" text NOT NULL,
	"level" double precision NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "difficulty_state_user_id_exercise_pk" PRIMARY KEY("user_id","exercise")
);
--> statement-breakpoint
ALTER TABLE "exercise_run" ADD COLUMN "difficulty_start" jsonb;--> statement-breakpoint
ALTER TABLE "exercise_run" ADD COLUMN "difficulty_end" jsonb;--> statement-breakpoint
ALTER TABLE "difficulty_state" ADD CONSTRAINT "difficulty_state_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;