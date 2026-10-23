// Keeps each user's load state up to date: evaluated from their sessions on
// every read, and saved when it changes.

import { and, asc, eq, gte, inArray } from "drizzle-orm";
import type { Database } from "@/db/client";
import { assessment, exerciseRun, loadState, trainingSession } from "@/db/schema";
import {
  evaluateLoad,
  initialLoadState,
  postponeAssessment as postpone,
  type BetSessionRecord,
  type LoadChange,
  type LoadEvaluation,
  type LoadState,
} from "@/engine/load";
import type { RtResults } from "@/engine/results";
import { localDate } from "@/engine/weekly-plan";
import { getPreferences } from "./preferences";

type Executor = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

/** Today's load evaluation, saved if the state moved. */
export async function refreshLoad(db: Executor, userId: string, now = new Date()): Promise<LoadEvaluation> {
  const { timeZone } = await getPreferences(db as Database, userId);
  const today = localDate(now, timeZone);
  const [stored, history] = await Promise.all([readState(db, userId), readHistory(db, userId, now, timeZone)]);
  const evaluation = evaluateLoad(stored ?? initialLoadState(today), { today, ...history });
  if (!stored || JSON.stringify(stored) !== JSON.stringify(evaluation.state)) await writeState(db, userId, evaluation.state);
  return evaluation;
}

/** Pushes the proposed assessment back a couple of days; false once the light week's limit is reached. */
export async function postponeAssessment(db: Database, userId: string, now = new Date()): Promise<boolean> {
  const { timeZone } = await getPreferences(db, userId);
  const { state, assessmentDue } = await refreshLoad(db, userId, now);
  if (!assessmentDue) return false;
  const next = postpone(state, localDate(now, timeZone));
  if (!next) return false;
  await writeState(db, userId, next);
  return true;
}

async function readState(db: Executor, userId: string): Promise<LoadState | null> {
  const [row] = await db.select().from(loadState).where(eq(loadState.userId, userId));
  if (!row) return null;
  return {
    step: row.step,
    lastStepAt: row.lastStepAt,
    cycleStartedAt: row.cycleStartedAt,
    assessmentPostponedUntil: row.assessmentPostponedUntil,
    lastChange: row.lastChange as LoadChange | null,
  };
}

async function writeState(db: Executor, userId: string, state: LoadState) {
  await db
    .insert(loadState)
    .values({ userId, ...state })
    .onConflictDoUpdate({ target: loadState.userId, set: state });
}

/** Completed BET sessions with their fatigue checks, the last session of any kind, and the last assessment. */
async function readHistory(db: Executor, userId: string, now: Date, timeZone: string) {
  const since = new Date(now.getTime() - 60 * 86_400_000);
  const sessions = await db
    .select({ id: trainingSession.id, kind: trainingSession.kind, startedAt: trainingSession.startedAt })
    .from(trainingSession)
    .where(
      and(
        eq(trainingSession.userId, userId),
        eq(trainingSession.status, "completed"),
        inArray(trainingSession.kind, ["bet", "light"]),
        gte(trainingSession.startedAt, since),
      ),
    )
    .orderBy(asc(trainingSession.startedAt));

  const betIds = sessions.filter((s) => s.kind === "bet").map((s) => s.id);
  const checks = betIds.length
    ? await db
        .select({ sessionId: exerciseRun.sessionId, block: exerciseRun.block, results: exerciseRun.results })
        .from(exerciseRun)
        .where(and(inArray(exerciseRun.sessionId, betIds), inArray(exerciseRun.block, ["fatigue_open", "fatigue_close"])))
    : [];
  const check = (sessionId: string, block: string) =>
    checks.find((c) => c.sessionId === sessionId && c.block === block)?.results as RtResults | null | undefined;

  const betSessions: BetSessionRecord[] = sessions
    .filter((s) => s.kind === "bet")
    .map((s) => {
      const open = check(s.id, "fatigue_open");
      const close = check(s.id, "fatigue_close");
      return {
        date: localDate(s.startedAt, timeZone),
        openLapses: open?.lapses ?? 0,
        closeLapses: close?.lapses ?? 0,
        openMeanRtMs: open?.meanRtMs ?? null,
        closeMeanRtMs: close?.meanRtMs ?? null,
      };
    });

  // An older assessment cannot fall in the current light week.
  const assessments = await db
    .select({ completedAt: assessment.completedAt })
    .from(assessment)
    .where(and(eq(assessment.userId, userId), eq(assessment.status, "completed"), gte(assessment.completedAt, since)));
  const lastAssessmentDate =
    assessments
      .map((a) => localDate(a.completedAt!, timeZone))
      .sort()
      .at(-1) ?? null;

  return {
    betSessions,
    lastSessionDate: sessions.length ? localDate(sessions.at(-1)!.startedAt, timeZone) : null,
    lastAssessmentDate,
  };
}
