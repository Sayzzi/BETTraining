CREATE TYPE "public"."run_status" AS ENUM('in_progress', 'completed', 'incomplete');--> statement-breakpoint
CREATE TYPE "public"."session_kind" AS ENUM('free_practice', 'bet', 'light', 'assessment');--> statement-breakpoint
CREATE TYPE "public"."trial_outcome" AS ENUM('hit', 'lapse', 'miss', 'false_start');--> statement-breakpoint
CREATE TABLE "exercise_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"exercise" text NOT NULL,
	"position" integer NOT NULL,
	"config" jsonb NOT NULL,
	"seed" bigint NOT NULL,
	"status" "run_status" DEFAULT 'in_progress' NOT NULL,
	"pauses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"results" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "training_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"kind" "session_kind" NOT NULL,
	"status" "run_status" DEFAULT 'in_progress' NOT NULL,
	"device" text NOT NULL,
	"input_mode" text NOT NULL,
	"user_agent" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "trial" (
	"run_id" uuid NOT NULL,
	"index" integer NOT NULL,
	"practice" boolean NOT NULL,
	"onset_ms" double precision,
	"response_ms" double precision,
	"rt_ms" double precision,
	"outcome" "trial_outcome" NOT NULL,
	"correct" boolean NOT NULL,
	"stimulus" jsonb,
	"response" jsonb,
	"difficulty" jsonb,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trial_run_id_index_pk" PRIMARY KEY("run_id","index")
);
--> statement-breakpoint
ALTER TABLE "exercise_run" ADD CONSTRAINT "exercise_run_session_id_training_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."training_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_session" ADD CONSTRAINT "training_session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trial" ADD CONSTRAINT "trial_run_id_exercise_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."exercise_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exercise_run_session_idx" ON "exercise_run" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "training_session_user_started_idx" ON "training_session" USING btree ("user_id","started_at");