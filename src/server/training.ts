// Application layer for training sessions. Every function takes the database
// and the signed-in user's id, and only touches that user's rows.

import { and, asc, count, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db/client";
import { exerciseRun, trainingSession, trial } from "@/db/schema";
import {
  computeExerciseResults,
  exerciseConfig,
  FREE_PRACTICE_DURATIONS_MIN,
  FREE_PRACTICE_EXERCISES,
} from "@/engine/exercises";
import type { PvtConfig } from "@/engine/pvt";
import { randomSeed } from "@/engine/random";
import type { RtResults } from "@/engine/results";
import type { Pause, Trial } from "@/engine/trial";

export class NotFoundError extends Error {}

const inputMode = z.enum(["keyboard", "touch", "mouse"]);

export const startFreePracticeInput = z.object({
  exercise: z.enum(FREE_PRACTICE_EXERCISES),
  durationMin: z.union(FREE_PRACTICE_DURATIONS_MIN.map((value) => z.literal(value))),
  device: z.enum(["desktop", "tablet", "mobile"]),
  inputMode,
  userAgent: z.string().max(512).optional(),
});

export const trialInput = z.object({
  index: z.number().int().nonnegative(),
  practice: z.boolean(),
  onsetMs: z.number().nullable(),
  responseMs: z.number().nullable(),
  rtMs: z.number().nullable(),
  outcome: z.enum(["hit", "lapse", "miss", "false_start"]),
  correct: z.boolean(),
  stimulus: z.record(z.string(), z.unknown()).nullable(),
  response: z.object({ input: inputMode }).nullable(),
});

export const trialBatchInput = z.object({ trials: z.array(trialInput).max(500) });

export const completeRunInput = z.object({
  pauses: z.array(z.object({ atMs: z.number(), durationMs: z.number().nonnegative() })).max(500),
  trialCount: z.number().int().nonnegative(),
});

export type StartedRun = { sessionId: string; runId: string; seed: number; config: PvtConfig };

export async function startFreePractice(
  db: Database,
  userId: string,
  input: z.infer<typeof startFreePracticeInput>,
): Promise<StartedRun> {
  const { exercise, durationMin, device, inputMode, userAgent } = startFreePracticeInput.parse(input);
  const config = exerciseConfig(exercise, durationMin);
  const seed = randomSeed();

  return db.transaction(async (tx) => {
    await abandonOpenSessions(tx, userId);
    const [session] = await tx
      .insert(trainingSession)
      .values({ userId, kind: "free_practice", device, inputMode, userAgent })
      .returning({ id: trainingSession.id });
    const [run] = await tx
      .insert(exerciseRun)
      .values({ sessionId: session.id, exercise, position: 0, config, seed })
      .returning({ id: exerciseRun.id });
    return { sessionId: session.id, runId: run.id, seed, config };
  });
}

/** Stores a batch of trials. Re-sending the same trials is harmless. */
export async function recordTrials(db: Database, userId: string, runId: string, input: unknown) {
  const { trials } = trialBatchInput.parse(input);
  await findOwnedRun(db, userId, runId);
  if (trials.length === 0) return;
  await db
    .insert(trial)
    .values(trials.map((t) => ({ ...t, runId })))
    .onConflictDoNothing();
}

export type CompleteRunResult =
  | { status: "completed"; results: RtResults }
  | { status: "missing_trials"; stored: number; expected: number };

/** Computes results from the stored trials, so the server never trusts client-side scores. */
export async function completeRun(
  db: Database,
  userId: string,
  runId: string,
  input: z.infer<typeof completeRunInput>,
): Promise<CompleteRunResult> {
  const { pauses, trialCount } = completeRunInput.parse(input);
  const run = await findOwnedRun(db, userId, runId);

  const [{ stored }] = await db.select({ stored: count() }).from(trial).where(eq(trial.runId, runId));
  if (stored < trialCount) return { status: "missing_trials", stored, expected: trialCount };

  const results = computeExerciseResults(run.config as PvtConfig, await loadTrials(db, runId));
  const endedAt = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(exerciseRun)
      .set({ status: "completed", results, pauses, endedAt })
      .where(eq(exerciseRun.id, runId));
    await tx
      .update(trainingSession)
      .set({ status: "completed", endedAt })
      .where(eq(trainingSession.id, run.sessionId));
  });
  return { status: "completed", results };
}

/** Marks a session the user left before the end as incomplete; its trials are kept. */
export async function abandonSession(db: Database, userId: string, sessionId: string) {
  if (!z.uuid().safeParse(sessionId).success) return;
  const endedAt = new Date();
  await db.transaction(async (tx) => {
    const updated = await tx
      .update(trainingSession)
      .set({ status: "incomplete", endedAt })
      .where(
        and(
          eq(trainingSession.id, sessionId),
          eq(trainingSession.userId, userId),
          eq(trainingSession.status, "in_progress"),
        ),
      )
      .returning({ id: trainingSession.id });
    if (updated.length > 0) await markRunsIncomplete(tx, [sessionId], endedAt);
  });
}

export type RunDetails = {
  id: string;
  sessionId: string;
  exercise: string;
  status: "in_progress" | "completed" | "incomplete";
  config: PvtConfig;
  results: RtResults | null;
  startedAt: Date;
};

export async function getRun(db: Database, userId: string, runId: string): Promise<RunDetails> {
  const run = await findOwnedRun(db, userId, runId);
  return {
    id: run.id,
    sessionId: run.sessionId,
    exercise: run.exercise,
    status: run.status,
    config: run.config as PvtConfig,
    results: run.results as RtResults | null,
    startedAt: run.startedAt,
  };
}

export async function loadTrials(db: Database, runId: string): Promise<Trial[]> {
  const rows = await db.select().from(trial).where(eq(trial.runId, runId)).orderBy(asc(trial.index));
  return rows.map((row) => ({
    index: row.index,
    practice: row.practice,
    onsetMs: row.onsetMs,
    responseMs: row.responseMs,
    rtMs: row.rtMs,
    outcome: row.outcome,
    correct: row.correct,
    stimulus: row.stimulus as Trial["stimulus"],
    response: row.response as Trial["response"],
  }));
}

export type { Pause };

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

async function findOwnedRun(db: Database | Transaction, userId: string, runId: string) {
  if (!z.uuid().safeParse(runId).success) throw new NotFoundError("Run not found");
  const [row] = await db
    .select({ run: exerciseRun })
    .from(exerciseRun)
    .innerJoin(trainingSession, eq(exerciseRun.sessionId, trainingSession.id))
    .where(and(eq(exerciseRun.id, runId), eq(trainingSession.userId, userId)));
  if (!row) throw new NotFoundError("Run not found");
  return row.run;
}

async function abandonOpenSessions(tx: Transaction, userId: string) {
  const endedAt = new Date();
  const open = await tx
    .update(trainingSession)
    .set({ status: "incomplete", endedAt })
    .where(and(eq(trainingSession.userId, userId), eq(trainingSession.status, "in_progress")))
    .returning({ id: trainingSession.id });
  await markRunsIncomplete(tx, open.map((s) => s.id), endedAt);
}

async function markRunsIncomplete(tx: Transaction, sessionIds: string[], endedAt: Date) {
  if (sessionIds.length === 0) return;
  await tx
    .update(exerciseRun)
    .set({ status: "incomplete", endedAt })
    .where(and(inArray(exerciseRun.sessionId, sessionIds), eq(exerciseRun.status, "in_progress")));
}
