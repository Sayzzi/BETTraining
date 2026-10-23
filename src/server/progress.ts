// Progress page data: level per domain over time (replayed from raw trials),
// assessment history and the current strengths and weaknesses.

import { and, asc, eq, gte, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { assessment, exerciseRun, trainingSession, trial } from "@/db/schema";
import type { AssessmentResults } from "@/engine/assessment";
import type { CognitiveDomain, DifficultySnapshot, ExerciseConfig, ExerciseId } from "@/engine/exercises";
import { domainLevelSeries, type LevelPoint, type LevelRun } from "@/engine/progress";
import type { Classification } from "@/engine/strengths";
import type { Trial } from "@/engine/trial";
import { localDate } from "@/engine/weekly-plan";
import { currentClassification } from "./assessment";
import { getPreferences } from "./preferences";

const HISTORY_DAYS = 365;

export type AssessmentPoint = {
  id: string;
  date: string;
  fatigueResistance: number | null;
  scores: Partial<Record<CognitiveDomain, number | null>>;
};

export type Progress = {
  levels: Record<CognitiveDomain, LevelPoint[]>;
  assessments: AssessmentPoint[];
  classification: Partial<Record<CognitiveDomain, Classification>>;
};

export async function getProgress(db: Database, userId: string, now = new Date()): Promise<Progress> {
  const [{ timeZone }, classification, levelRuns, assessments] = await Promise.all([
    getPreferences(db, userId),
    currentClassification(db, userId),
    adaptiveRuns(db, userId, now),
    db
      .select({ id: assessment.id, completedAt: assessment.completedAt, results: assessment.results })
      .from(assessment)
      .where(and(eq(assessment.userId, userId), eq(assessment.status, "completed")))
      .orderBy(asc(assessment.completedAt)),
  ]);

  return {
    levels: domainLevelSeries(levelRuns.map((run) => ({ ...run, date: localDate(run.startedAt, timeZone) }))),
    assessments: assessments.map((row) => {
      const results = row.results as AssessmentResults;
      return {
        id: row.id,
        date: localDate(row.completedAt!, timeZone),
        fatigueResistance: results.fatigueResistance,
        scores: Object.fromEntries(results.domains.map((d) => [d.domain, d.cold])),
      };
    }),
    classification,
  };
}

/**
 * Completed runs at the 80 % target with their raw trials: free practice and the targeted block.
 * BET runs (95 %, a separate level) and assessments (frozen difficulty) are left out.
 */
async function adaptiveRuns(db: Database, userId: string, now: Date) {
  const runs = await db
    .select({
      id: exerciseRun.id,
      exercise: exerciseRun.exercise,
      config: exerciseRun.config,
      difficultyStart: exerciseRun.difficultyStart,
      startedAt: exerciseRun.startedAt,
    })
    .from(exerciseRun)
    .innerJoin(trainingSession, eq(exerciseRun.sessionId, trainingSession.id))
    .where(
      and(
        eq(trainingSession.userId, userId),
        eq(exerciseRun.status, "completed"),
        isNotNull(exerciseRun.difficultyStart),
        or(isNull(exerciseRun.difficultyKey), eq(exerciseRun.difficultyKey, exerciseRun.exercise)),
        sql`coalesce((${exerciseRun.config} ->> 'adaptive')::boolean, true)`,
        gte(exerciseRun.startedAt, new Date(now.getTime() - HISTORY_DAYS * 86_400_000)),
      ),
    )
    .orderBy(asc(exerciseRun.startedAt));
  if (runs.length === 0) return [];

  const trials = await db
    .select()
    .from(trial)
    .where(inArray(trial.runId, runs.map((run) => run.id)))
    .orderBy(asc(trial.runId), asc(trial.index));
  const byRun = new Map<string, Trial[]>();
  for (const row of trials) {
    const list = byRun.get(row.runId) ?? [];
    list.push({
      index: row.index,
      practice: row.practice,
      onsetMs: row.onsetMs,
      responseMs: row.responseMs,
      rtMs: row.rtMs,
      outcome: row.outcome,
      correct: row.correct,
      stimulus: row.stimulus as Trial["stimulus"],
      response: row.response as Trial["response"],
      difficulty: row.difficulty as Trial["difficulty"],
    });
    byRun.set(row.runId, list);
  }

  return runs.map((run): Omit<LevelRun, "date"> & { startedAt: Date } => ({
    exercise: run.exercise as ExerciseId,
    config: run.config as ExerciseConfig,
    startLevel: (run.difficultyStart as DifficultySnapshot).level,
    trials: byRun.get(run.id) ?? [],
    startedAt: run.startedAt,
  }));
}
