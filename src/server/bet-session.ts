// Application layer for BET sessions: one training session holding the
// planned runs (fatigue checks, targeted block, BET block), plus the
// self-ratings taken before and after.

import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db/client";
import { exerciseRun, trainingSession } from "@/db/schema";
import { describeRunDifficulty, type ExerciseConfig, type ExerciseId } from "@/engine/exercises";
import { randomSeed } from "@/engine/random";
import type { RtResults } from "@/engine/results";
import {
  BET_DURATIONS_MIN,
  fatigueCheckChange,
  LIGHT_SESSION_MIN,
  planBetSession,
  planLightSession,
  sessionLoad,
  type BetDuration,
  type BetSessionPlan,
  type BetHistory,
  type PlanExplanation,
  type SessionBlock,
} from "@/engine/session-plan";
import { currentClassification, hasCompletedAssessment } from "./assessment";
import { abandonOpenSessions, currentLevel, deviceInput, NotFoundError, type StartedRun } from "./training";

/** The session needs a completed assessment first. */
export class AssessmentRequiredError extends Error {}

const rating = z.number().int().min(0).max(10);

export const startBetSessionInput = deviceInput.extend({
  durationMin: z.union(BET_DURATIONS_MIN.map((value) => z.literal(value))),
  context: z.enum(["rest", "before_sport", "after_sport"]),
  preFatigue: rating,
});

export const finishBetSessionInput = z.object({
  postFatigue: rating,
  perceivedEffort: rating,
  motivation: rating,
});

export type SessionStepRun = StartedRun & { position: number; block: SessionBlock };
export type StartedBetSession = { sessionId: string; steps: SessionStepRun[]; explanation: PlanExplanation };

export async function startBetSession(
  db: Database,
  userId: string,
  input: z.infer<typeof startBetSessionInput>,
  timeScale = 1,
): Promise<StartedBetSession> {
  const { durationMin, context, preFatigue, ...device } = startBetSessionInput.parse(input);
  if (!(await hasCompletedAssessment(db, userId))) throw new AssessmentRequiredError();
  const classification = await currentClassification(db, userId);

  return db.transaction(async (tx) => {
    await abandonOpenSessions(tx, userId);
    const history = { ...(await betHistory(tx, userId)), classification };
    const plan = planBetSession(durationMin, history, timeScale);
    return createPlannedSession(tx, userId, plan, { kind: "bet", ...device, context, durationMin, preFatigue });
  });
}

export const startLightSessionInput = startBetSessionInput.omit({ durationMin: true });

/** A light session: about 10 minutes of targeted exercises, mostly on weaknesses. */
export async function startLightSession(
  db: Database,
  userId: string,
  input: z.infer<typeof startLightSessionInput>,
  timeScale = 1,
): Promise<StartedBetSession> {
  const { context, preFatigue, ...device } = startLightSessionInput.parse(input);
  if (!(await hasCompletedAssessment(db, userId))) throw new AssessmentRequiredError();
  const classification = await currentClassification(db, userId);

  return db.transaction(async (tx) => {
    await abandonOpenSessions(tx, userId);
    const lightSessionCount = await countSessions(tx, userId, "light");
    const plan = planLightSession({ lightSessionCount, classification }, timeScale);
    return createPlannedSession(tx, userId, plan, {
      kind: "light",
      ...device,
      context,
      durationMin: LIGHT_SESSION_MIN,
      preFatigue,
    });
  });
}

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** Inserts the session, then one run per planned step with its saved difficulty level. */
async function createPlannedSession(
  tx: Transaction,
  userId: string,
  { steps: planned, explanation }: BetSessionPlan,
  session: Omit<typeof trainingSession.$inferInsert, "userId" | "planExplanation">,
): Promise<StartedBetSession> {
  const [created] = await tx
    .insert(trainingSession)
    .values({ ...session, userId, planExplanation: explanation })
    .returning({ id: trainingSession.id });

  const steps = await Promise.all(
    planned.map(async (step) => ({
      ...step,
      seed: randomSeed(),
      level: step.difficultyKey ? await currentLevel(tx, userId, step.exercise, step.difficultyKey) : null,
    })),
  );
  const runs = await tx
    .insert(exerciseRun)
    .values(
      steps.map((step) => ({
        sessionId: created.id,
        exercise: step.exercise,
        block: step.block,
        difficultyKey: step.difficultyKey,
        position: step.position,
        config: step.config,
        seed: step.seed,
        difficultyStart: step.level === null ? null : describeRunDifficulty(step.exercise, step.config, step.level),
      })),
    )
    .returning({ id: exerciseRun.id, position: exerciseRun.position });

  const runIdAt = new Map(runs.map((run) => [run.position, run.id]));
  return {
    sessionId: created.id,
    explanation,
    steps: steps.map((step) => ({
      sessionId: created.id,
      runId: runIdAt.get(step.position)!,
      exercise: step.exercise,
      seed: step.seed,
      config: step.config,
      level: step.level,
      position: step.position,
      block: step.block,
    })),
  };
}

export type FinishBetSessionResult = { status: "finished"; sessionLoad: number } | { status: "runs_pending" };

/** Records the closing self-ratings and the completed load once every run is done. */
export async function finishBetSession(
  db: Database,
  userId: string,
  sessionId: string,
  input: z.infer<typeof finishBetSessionInput>,
): Promise<FinishBetSessionResult> {
  const ratings = finishBetSessionInput.parse(input);
  const session = await findOwnedBetSession(db, userId, sessionId);
  if (session.status !== "completed") return { status: "runs_pending" };

  const load = sessionLoad(ratings.perceivedEffort, session.durationMin!);
  await db
    .update(trainingSession)
    .set({ ...ratings, sessionLoad: load })
    .where(eq(trainingSession.id, sessionId));
  return { status: "finished", sessionLoad: load };
}

export type BetSessionSummary = {
  id: string;
  kind: "bet" | "light";
  status: "in_progress" | "completed" | "incomplete";
  context: "rest" | "before_sport" | "after_sport";
  durationMin: number;
  startedAt: Date;
  ratings: {
    preFatigue: number | null;
    postFatigue: number | null;
    perceivedEffort: number | null;
    motivation: number | null;
  };
  sessionLoad: number | null;
  explanation: PlanExplanation | null;
  fatigueCheck: ReturnType<typeof fatigueCheckChange>;
  runs: {
    id: string;
    block: SessionBlock;
    exercise: ExerciseId;
    status: "in_progress" | "completed" | "incomplete";
    config: ExerciseConfig;
    results: RtResults | null;
  }[];
};

export async function getBetSessionSummary(db: Database, userId: string, sessionId: string): Promise<BetSessionSummary> {
  const session = await findOwnedBetSession(db, userId, sessionId);
  const rows = await db
    .select({
      id: exerciseRun.id,
      block: exerciseRun.block,
      exercise: exerciseRun.exercise,
      status: exerciseRun.status,
      config: exerciseRun.config,
      results: exerciseRun.results,
    })
    .from(exerciseRun)
    .where(eq(exerciseRun.sessionId, sessionId))
    .orderBy(asc(exerciseRun.position));
  const runs = rows.map((row) => ({
    ...row,
    block: row.block as SessionBlock,
    exercise: row.exercise as ExerciseId,
    config: row.config as ExerciseConfig,
    results: row.results as RtResults | null,
  }));
  const resultsOf = (block: SessionBlock) => runs.find((run) => run.block === block)?.results ?? null;

  return {
    id: session.id,
    kind: session.kind as "bet" | "light",
    status: session.status,
    context: session.context!,
    durationMin: session.durationMin!,
    startedAt: session.startedAt,
    ratings: {
      preFatigue: session.preFatigue,
      postFatigue: session.postFatigue,
      perceivedEffort: session.perceivedEffort,
      motivation: session.motivation,
    },
    sessionLoad: session.sessionLoad,
    explanation: session.planExplanation as PlanExplanation | null,
    fatigueCheck: fatigueCheckChange(resultsOf("fatigue_open"), resultsOf("fatigue_close")),
    runs,
  };
}

/**
 * What the next session would look like at each duration, for the home page and the setup screen.
 * Null when the user has no completed assessment yet.
 */
export async function previewBetSession(
  db: Database,
  userId: string,
): Promise<Record<BetDuration, PlanExplanation> | null> {
  if (!(await hasCompletedAssessment(db, userId))) return null;
  const [history, classification] = await Promise.all([betHistory(db, userId), currentClassification(db, userId)]);
  return Object.fromEntries(
    BET_DURATIONS_MIN.map((duration) => [duration, planBetSession(duration, { ...history, classification }).explanation]),
  ) as Record<BetDuration, PlanExplanation>;
}

/** How many BET sessions the user started, and which exercises filled the last BET block. */
async function betHistory(
  db: Database | Transaction,
  userId: string,
): Promise<Omit<BetHistory, "classification">> {
  const total = await countSessions(db, userId, "bet");
  const [last] = await db
    .select({ id: trainingSession.id })
    .from(trainingSession)
    .where(and(eq(trainingSession.userId, userId), eq(trainingSession.kind, "bet")))
    .orderBy(desc(trainingSession.startedAt))
    .limit(1);
  const previous = last
    ? await db
        .select({ exercise: exerciseRun.exercise })
        .from(exerciseRun)
        .where(and(eq(exerciseRun.sessionId, last.id), eq(exerciseRun.block, "bet")))
    : [];
  return { betSessionCount: total, previousBetExercises: previous.map((row) => row.exercise as ExerciseId) };
}

/** Sessions of a kind the user ever started, to rotate plans from one session to the next. */
async function countSessions(db: Database | Transaction, userId: string, kind: "bet" | "light") {
  const [{ total }] = await db
    .select({ total: count() })
    .from(trainingSession)
    .where(and(eq(trainingSession.userId, userId), eq(trainingSession.kind, kind)));
  return total;
}

/** What the next light session would train, for the home page. Null before the first assessment. */
export async function previewLightSession(db: Database, userId: string): Promise<PlanExplanation | null> {
  if (!(await hasCompletedAssessment(db, userId))) return null;
  const [lightSessionCount, classification] = await Promise.all([
    countSessions(db, userId, "light"),
    currentClassification(db, userId),
  ]);
  return planLightSession({ lightSessionCount, classification }).explanation;
}

async function findOwnedBetSession(db: Database, userId: string, sessionId: string) {
  if (!z.uuid().safeParse(sessionId).success) throw new NotFoundError("Session not found");
  const [session] = await db
    .select()
    .from(trainingSession)
    .where(
      and(
        eq(trainingSession.id, sessionId),
        eq(trainingSession.userId, userId),
        inArray(trainingSession.kind, ["bet", "light"]),
      ),
    );
  if (!session) throw new NotFoundError("Session not found");
  return session;
}
