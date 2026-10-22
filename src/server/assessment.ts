// Application layer for assessments. An assessment is one training session
// holding the nine runs of the fixed protocol; each run uploads and completes
// through the usual training endpoints.

import { and, asc, desc, eq, lt } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db/client";
import { assessment, exerciseRun, trainingSession } from "@/db/schema";
import {
  ASSESSMENT_PROTOCOL_VERSION,
  assessmentSteps,
  computeAssessmentResults,
  type AssessmentBlock,
  type AssessmentComparison,
  type AssessmentResults,
  type AssessmentRunResult,
} from "@/engine/assessment";
import { compareAssessments, type Classification } from "@/engine/strengths";
import { describeDifficulty, type CognitiveDomain, type ExerciseConfig, type ExerciseId } from "@/engine/exercises";
import { randomSeed } from "@/engine/random";
import type { RtResults } from "@/engine/results";
import { abandonOpenSessions, deviceInput, NotFoundError, type StartedRun } from "./training";

export type AssessmentStepRun = StartedRun & {
  position: number;
  block: AssessmentBlock;
  domain: CognitiveDomain | null;
};

export type StartedAssessment = { assessmentId: string; sessionId: string; steps: AssessmentStepRun[] };

export async function startAssessment(
  db: Database,
  userId: string,
  input: z.infer<typeof deviceInput>,
  timeScale = 1,
): Promise<StartedAssessment> {
  const { device, inputMode, userAgent } = deviceInput.parse(input);
  const steps = assessmentSteps(timeScale);

  return db.transaction(async (tx) => {
    await abandonOpenSessions(tx, userId);
    const [session] = await tx
      .insert(trainingSession)
      .values({ userId, kind: "assessment", device, inputMode, userAgent })
      .returning({ id: trainingSession.id });
    const [created] = await tx
      .insert(assessment)
      .values({ userId, sessionId: session.id, protocolVersion: ASSESSMENT_PROTOCOL_VERSION })
      .returning({ id: assessment.id });

    const seeded = steps.map((step) => ({ ...step, seed: randomSeed() }));
    const runs = await tx
      .insert(exerciseRun)
      .values(
        seeded.map((step) => ({
          sessionId: session.id,
          exercise: step.exercise,
          block: step.block,
          position: step.position,
          config: step.config,
          seed: step.seed,
          difficultyStart: step.level === null ? null : describeDifficulty(step.exercise, step.level),
        })),
      )
      .returning({ id: exerciseRun.id, position: exerciseRun.position });

    const runIdAt = new Map(runs.map((run) => [run.position, run.id]));
    return {
      assessmentId: created.id,
      sessionId: session.id,
      steps: seeded.map((step) => ({
        sessionId: session.id,
        runId: runIdAt.get(step.position)!,
        exercise: step.exercise,
        seed: step.seed,
        config: step.config,
        level: step.level,
        position: step.position,
        block: step.block,
        domain: step.domain,
      })),
    };
  });
}

export type CompleteAssessmentResult =
  | { status: "completed"; results: AssessmentResults }
  | { status: "runs_pending"; pending: number };

/** Computes the scores once every run of the protocol is completed. */
export async function completeAssessment(
  db: Database,
  userId: string,
  assessmentId: string,
): Promise<CompleteAssessmentResult> {
  const found = await findOwnedAssessment(db, userId, assessmentId);
  const runs = await db
    .select({ block: exerciseRun.block, exercise: exerciseRun.exercise, status: exerciseRun.status, results: exerciseRun.results })
    .from(exerciseRun)
    .where(eq(exerciseRun.sessionId, found.sessionId))
    .orderBy(asc(exerciseRun.position));

  const pending = runs.filter((run) => run.status !== "completed").length;
  if (pending > 0) return { status: "runs_pending", pending };

  const current = toRunResults(runs);
  const results: AssessmentResults = {
    ...computeAssessmentResults(current),
    comparison: await compareWithPrevious(db, userId, found, current),
  };
  await db
    .update(assessment)
    .set({ status: "completed", results, completedAt: new Date() })
    .where(eq(assessment.id, assessmentId));
  return { status: "completed", results };
}

export type AssessmentDetails = {
  id: string;
  status: "in_progress" | "completed" | "incomplete";
  protocolVersion: number;
  results: AssessmentResults | null;
  startedAt: Date;
  completedAt: Date | null;
  runs: { id: string; block: AssessmentBlock; exercise: ExerciseId; position: number; config: ExerciseConfig }[];
};

export async function getAssessment(db: Database, userId: string, assessmentId: string): Promise<AssessmentDetails> {
  const found = await findOwnedAssessment(db, userId, assessmentId);
  const runs = await db
    .select({
      id: exerciseRun.id,
      block: exerciseRun.block,
      exercise: exerciseRun.exercise,
      position: exerciseRun.position,
      config: exerciseRun.config,
    })
    .from(exerciseRun)
    .where(eq(exerciseRun.sessionId, found.sessionId))
    .orderBy(asc(exerciseRun.position));
  return {
    id: found.id,
    status: found.status,
    protocolVersion: found.protocolVersion,
    results: found.results as AssessmentResults | null,
    startedAt: found.startedAt,
    completedAt: found.completedAt,
    runs: runs.map((run) => ({
      ...run,
      block: run.block as AssessmentBlock,
      exercise: run.exercise as ExerciseId,
      config: run.config as ExerciseConfig,
    })),
  };
}

/** The user's two most recent completed assessments, newest first. */
export async function latestAssessments(db: Database, userId: string, limit = 2) {
  return db
    .select({ id: assessment.id, results: assessment.results, completedAt: assessment.completedAt })
    .from(assessment)
    .where(and(eq(assessment.userId, userId), eq(assessment.status, "completed")))
    .orderBy(desc(assessment.completedAt))
    .limit(limit);
}

/** Strengths and weaknesses from the latest assessment that could be compared; empty before that. */
export async function currentClassification(
  db: Database,
  userId: string,
): Promise<Partial<Record<CognitiveDomain, Classification>>> {
  const [latest] = await latestAssessments(db, userId, 1);
  return (latest?.results as AssessmentResults | null)?.comparison?.classification ?? {};
}

export async function hasCompletedAssessment(db: Database, userId: string) {
  return (await latestAssessments(db, userId, 1)).length > 0;
}

/** Compares with the user's previous completed assessment of the same protocol version, if any. */
async function compareWithPrevious(
  db: Database,
  userId: string,
  current: typeof assessment.$inferSelect,
  currentRuns: AssessmentRunResult[],
): Promise<AssessmentComparison | null> {
  const [previous] = await db
    .select()
    .from(assessment)
    .where(
      and(
        eq(assessment.userId, userId),
        eq(assessment.status, "completed"),
        eq(assessment.protocolVersion, current.protocolVersion),
        lt(assessment.startedAt, current.startedAt),
      ),
    )
    .orderBy(desc(assessment.completedAt))
    .limit(1);
  if (!previous) return null;

  const previousRuns = await db
    .select({ block: exerciseRun.block, exercise: exerciseRun.exercise, results: exerciseRun.results })
    .from(exerciseRun)
    .where(eq(exerciseRun.sessionId, previous.sessionId));
  const domains = compareAssessments(toRunResults(previousRuns), currentRuns);
  return {
    previousAssessmentId: previous.id,
    previousCompletedAt: previous.completedAt!.toISOString(),
    domains,
    classification: Object.fromEntries(domains.map((d) => [d.domain, d.classification])),
  };
}

function toRunResults(rows: { block: string | null; exercise: string; results: unknown }[]): AssessmentRunResult[] {
  return rows.map((row) => ({
    block: row.block as AssessmentBlock,
    exercise: row.exercise as ExerciseId,
    results: row.results as RtResults | null,
  }));
}

async function findOwnedAssessment(db: Database, userId: string, assessmentId: string) {
  if (!z.uuid().safeParse(assessmentId).success) throw new NotFoundError("Assessment not found");
  const [found] = await db
    .select()
    .from(assessment)
    .where(and(eq(assessment.id, assessmentId), eq(assessment.userId, userId)));
  if (!found) throw new NotFoundError("Assessment not found");
  return found;
}
