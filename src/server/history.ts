// Read-only history of the user's sessions, newest first, with each run's results.

import { and, asc, desc, eq, inArray, lt } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db/client";
import { assessment, exerciseRun, trainingSession } from "@/db/schema";
import type { DifficultySnapshot, ExerciseConfig, ExerciseId } from "@/engine/exercises";
import type { RtResults } from "@/engine/results";
import { NotFoundError } from "./training";

export type SessionKind = "free_practice" | "bet" | "light" | "assessment";
export type SessionStatus = "in_progress" | "completed" | "incomplete";

export type SessionListItem = {
  id: string;
  kind: SessionKind;
  status: SessionStatus;
  context: "rest" | "before_sport" | "after_sport" | null;
  startedAt: Date;
  /** Planned duration for BET and light sessions, otherwise the exercise's duration. */
  durationMin: number | null;
  exercises: ExerciseId[];
  /** Results page of an assessment, when the session is one. */
  assessmentId: string | null;
};

export const HISTORY_PAGE_SIZE = 30;

/** The user's sessions, newest first; pass the last item's start to read the next page. */
export async function listSessions(
  db: Database,
  userId: string,
  { before, limit = HISTORY_PAGE_SIZE }: { before?: Date; limit?: number } = {},
): Promise<{ sessions: SessionListItem[]; hasMore: boolean }> {
  const rows = await db
    .select()
    .from(trainingSession)
    .where(and(eq(trainingSession.userId, userId), before ? lt(trainingSession.startedAt, before) : undefined))
    .orderBy(desc(trainingSession.startedAt))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const ids = page.map((row) => row.id);

  const [runs, assessments] = ids.length
    ? await Promise.all([
        db
          .select({ sessionId: exerciseRun.sessionId, exercise: exerciseRun.exercise, config: exerciseRun.config })
          .from(exerciseRun)
          .where(inArray(exerciseRun.sessionId, ids))
          .orderBy(asc(exerciseRun.position)),
        db
          .select({ id: assessment.id, sessionId: assessment.sessionId })
          .from(assessment)
          .where(inArray(assessment.sessionId, ids)),
      ])
    : [[], []];

  return {
    hasMore: rows.length > limit,
    sessions: page.map((row) => {
      const sessionRuns = runs.filter((run) => run.sessionId === row.id);
      const runMinutes = sessionRuns.reduce((sum, run) => sum + (run.config as ExerciseConfig).durationMs, 0) / 60_000;
      return {
        id: row.id,
        kind: row.kind,
        status: row.status,
        context: row.context,
        startedAt: row.startedAt,
        durationMin: row.durationMin ?? (sessionRuns.length ? Math.round(runMinutes) : null),
        exercises: sessionRuns.map((run) => run.exercise as ExerciseId),
        assessmentId: assessments.find((a) => a.sessionId === row.id)?.id ?? null,
      };
    }),
  };
}

export type SessionDetail = SessionListItem & {
  endedAt: Date | null;
  runs: {
    id: string;
    exercise: ExerciseId;
    block: string | null;
    status: SessionStatus;
    config: ExerciseConfig;
    results: RtResults | null;
    difficultyStart: DifficultySnapshot | null;
    difficultyEnd: DifficultySnapshot | null;
  }[];
};

export async function getSessionDetail(db: Database, userId: string, sessionId: string): Promise<SessionDetail> {
  if (!z.uuid().safeParse(sessionId).success) throw new NotFoundError("Session not found");
  const [row] = await db
    .select()
    .from(trainingSession)
    .where(and(eq(trainingSession.id, sessionId), eq(trainingSession.userId, userId)));
  if (!row) throw new NotFoundError("Session not found");

  const [runs, [linked]] = await Promise.all([
    db.select().from(exerciseRun).where(eq(exerciseRun.sessionId, sessionId)).orderBy(asc(exerciseRun.position)),
    db.select({ id: assessment.id }).from(assessment).where(eq(assessment.sessionId, sessionId)),
  ]);
  const runMinutes = runs.reduce((sum, run) => sum + (run.config as ExerciseConfig).durationMs, 0) / 60_000;

  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    context: row.context,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    durationMin: row.durationMin ?? (runs.length ? Math.round(runMinutes) : null),
    exercises: runs.map((run) => run.exercise as ExerciseId),
    assessmentId: linked?.id ?? null,
    runs: runs.map((run) => ({
      id: run.id,
      exercise: run.exercise as ExerciseId,
      block: run.block,
      status: run.status,
      config: run.config as ExerciseConfig,
      results: run.results as RtResults | null,
      difficultyStart: run.difficultyStart as DifficultySnapshot | null,
      difficultyEnd: run.difficultyEnd as DifficultySnapshot | null,
    })),
  };
}
