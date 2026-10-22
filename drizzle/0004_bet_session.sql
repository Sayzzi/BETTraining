CREATE TYPE "public"."session_context" AS ENUM('rest', 'before_sport', 'after_sport');--> statement-breakpoint
ALTER TABLE "exercise_run" ADD COLUMN "difficulty_key" text;--> statement-breakpoint
ALTER TABLE "training_session" ADD COLUMN "context" "session_context";--> statement-breakpoint
ALTER TABLE "training_session" ADD COLUMN "duration_min" integer;--> statement-breakpoint
ALTER TABLE "training_session" ADD COLUMN "pre_fatigue" integer;--> statement-breakpoint
ALTER TABLE "training_session" ADD COLUMN "post_fatigue" integer;--> statement-breakpoint
ALTER TABLE "training_session" ADD COLUMN "perceived_effort" integer;--> statement-breakpoint
ALTER TABLE "training_session" ADD COLUMN "motivation" integer;--> statement-breakpoint
ALTER TABLE "training_session" ADD COLUMN "session_load" integer;