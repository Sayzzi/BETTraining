import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createDb } from "@/db/client";
import { assessment, difficultyState, exerciseRun, trainingSession, user } from "@/db/schema";
import { playRun } from "../../tests/setup/play-run";
import type { Classification } from "@/engine/strengths";
import type { CognitiveDomain } from "@/engine/exercises";
import {
  AssessmentRequiredError,
  finishBetSession,
  getBetSessionSummary,
  previewBetSession,
  startBetSession,
  type SessionStepRun,
} from "./bet-session";
import { abandonSession, completeRun, NotFoundError, recordTrials, startFreePractice } from "./training";

const db = createDb(process.env.DATABASE_URL!);
const DEVICE = { device: "desktop", inputMode: "keyboard", userAgent: "vitest" } as const;
const QUICK = 0.05;
const SESSION = { ...DEVICE, durationMin: 30, context: "after_sport", preFatigue: 3 } as const;

afterAll(async () => {
  await db.$client.end();
});

/** A user who already completed an assessment, optionally with a strengths ranking. */
async function createAssessedUser(classification?: Partial<Record<CognitiveDomain, Classification>>) {
  const id = crypto.randomUUID();
  await db.insert(user).values({ id, name: "Jakub", email: `${id}@example.com` });
  const [session] = await db
    .insert(trainingSession)
    .values({ userId: id, kind: "assessment", status: "completed", device: "desktop", inputMode: "keyboard" })
    .returning({ id: trainingSession.id });
  await db.insert(assessment).values({
    userId: id,
    sessionId: session.id,
    protocolVersion: 1,
    status: "completed",
    results: {
      protocolVersion: 1,
      domains: [],
      fatigueResistance: 0.9,
      comparison: classification
        ? { previousAssessmentId: crypto.randomUUID(), previousCompletedAt: new Date().toISOString(), domains: [], classification }
        : null,
    },
    completedAt: new Date(),
  });
  return id;
}

async function completeStep(userId: string, step: SessionStepRun, rtMs = 400) {
  const trials = playRun(step, rtMs);
  await recordTrials(db, userId, step.runId, { trials });
  return completeRun(db, userId, step.runId, { pauses: [], trialCount: trials.length });
}

async function savedLevel(userId: string, key: string) {
  const [row] = await db
    .select()
    .from(difficultyState)
    .where(and(eq(difficultyState.userId, userId), eq(difficultyState.exercise, key)));
  return row?.level ?? null;
}

describe("BET sessions", () => {
  it("requires a completed assessment", async () => {
    const id = crypto.randomUUID();
    await db.insert(user).values({ id, name: "Jakub", email: `${id}@example.com` });
    await expect(startBetSession(db, id, SESSION, QUICK)).rejects.toBeInstanceOf(AssessmentRequiredError);
  });

  it("creates the planned runs with their blocks, and records the context and the opening rating", async () => {
    const userId = await createAssessedUser();
    const started = await startBetSession(db, userId, SESSION, QUICK);

    expect(started.steps.map((s) => s.block)).toEqual(["fatigue_open", "targeted", "bet", "fatigue_close"]);
    const [session] = await db.select().from(trainingSession).where(eq(trainingSession.id, started.sessionId));
    expect(session).toMatchObject({ kind: "bet", context: "after_sport", durationMin: 30, preFatigue: 3, status: "in_progress" });
    const runs = await db.select().from(exerciseRun).where(eq(exerciseRun.sessionId, started.sessionId));
    expect(runs.find((r) => r.block === "bet")!.difficultyKey).toBe("stroop:bet");
  });

  it("starts the BET level a little below the exercise's own level, and keeps the two apart", async () => {
    const userId = await createAssessedUser();
    const started = await startBetSession(db, userId, SESSION, QUICK);
    const bet = started.steps.find((s) => s.block === "bet")!;
    expect(bet.exercise).toBe("stroop");
    expect(bet.level).toBe(1); // Stroop starts at 3, minus 2.

    for (const step of started.steps) await completeStep(userId, step);

    expect(await savedLevel(userId, "stroop:bet")).toBeGreaterThan(1);
    expect(await savedLevel(userId, "stroop")).toBeNull();
    // Free practice still reads the exercise's own level.
    expect((await startFreePractice(db, userId, { ...DEVICE, exercise: "stroop", durationMin: 3 })).level).toBe(3);
  });

  it("finishes with the closing ratings and the completed load, then summarises the session", async () => {
    const userId = await createAssessedUser();
    const started = await startBetSession(db, userId, SESSION, QUICK);
    // Both under the 355 ms PVT-B lapse threshold, so each check has a mean reaction time.
    for (const step of started.steps) await completeStep(userId, step, step.block === "fatigue_close" ? 340 : 300);

    const outcome = await finishBetSession(db, userId, started.sessionId, {
      postFatigue: 7,
      perceivedEffort: 8,
      motivation: 6,
    });
    expect(outcome).toEqual({ status: "finished", sessionLoad: 240 });

    const summary = await getBetSessionSummary(db, userId, started.sessionId);
    expect(summary).toMatchObject({
      status: "completed",
      context: "after_sport",
      durationMin: 30,
      sessionLoad: 240,
      ratings: { preFatigue: 3, postFatigue: 7, perceivedEffort: 8, motivation: 6 },
    });
    expect(summary.fatigueCheck).toEqual({ meanRtChangeMs: 40, lapsesChange: 0 });
    expect(summary.runs).toHaveLength(4);
    expect(summary.runs.every((r) => r.results !== null)).toBe(true);
  });

  it("refuses the closing ratings while runs are still pending", async () => {
    const userId = await createAssessedUser();
    const started = await startBetSession(db, userId, SESSION, QUICK);
    await completeStep(userId, started.steps[0]);
    expect(
      await finishBetSession(db, userId, started.sessionId, { postFatigue: 5, perceivedEffort: 5, motivation: 5 }),
    ).toEqual({ status: "runs_pending" });
  });

  it("never repeats the previous session's BET exercise", async () => {
    const userId = await createAssessedUser();
    const first = await startBetSession(db, userId, SESSION, QUICK);
    const second = await startBetSession(db, userId, SESSION, QUICK);
    const betOf = (s: typeof first) => s.steps.filter((x) => x.block === "bet").map((x) => x.exercise);
    expect(betOf(second)).not.toEqual(betOf(first));
    expect(betOf(second).some((e) => betOf(first).includes(e))).toBe(false);
  });

  it("keeps an interrupted session as it was and marks it incomplete", async () => {
    const userId = await createAssessedUser();
    const started = await startBetSession(db, userId, SESSION, QUICK);
    await completeStep(userId, started.steps[0]);
    await abandonSession(db, userId, started.sessionId);

    const summary = await getBetSessionSummary(db, userId, started.sessionId);
    expect(summary.status).toBe("incomplete");
    expect(summary.runs[0].results).not.toBeNull();
    expect(summary.runs.slice(1).every((r) => r.status === "incomplete")).toBe(true);
  });

  it("validates ratings and keeps sessions private", async () => {
    const owner = await createAssessedUser();
    const intruder = await createAssessedUser();
    await expect(startBetSession(db, owner, { ...SESSION, preFatigue: 11 }, QUICK)).rejects.toThrow();
    const started = await startBetSession(db, owner, SESSION, QUICK);
    await expect(getBetSessionSummary(db, intruder, started.sessionId)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("weights the targeted block by the latest ranking and explains the plan", async () => {
    const userId = await createAssessedUser({
      sustained_attention: "strength",
      working_memory: "weakness",
      inhibition: "strength",
      processing_speed: "strength",
    });
    const started = await startBetSession(db, userId, { ...SESSION, durationMin: 45 }, QUICK);

    expect(started.explanation).toMatchObject({ rankingAvailable: true, weaknesses: ["working_memory"] });
    // The weakness opens the weighted cycle and takes one of the three slots.
    const targeted = started.steps.filter((s) => s.block === "targeted").map((s) => s.exercise);
    expect(targeted).toContain("nback");
    expect(started.explanation.betExercises).toEqual(
      started.steps.filter((s) => s.block === "bet").map((s) => s.exercise),
    );

    const summary = await getBetSessionSummary(db, userId, started.sessionId);
    expect(summary.explanation).toEqual(started.explanation);
  });

  it("previews the next session at each duration, matching the plan actually generated", async () => {
    const userId = await createAssessedUser({ working_memory: "weakness", inhibition: "strength" });
    const preview = await previewBetSession(db, userId);
    const started = await startBetSession(db, userId, { ...SESSION, durationMin: 60 }, QUICK);
    expect(preview![60]).toEqual(started.explanation);
    expect(Object.keys(preview!)).toEqual(["30", "45", "60"]);
  });

  it("has no preview before the first assessment", async () => {
    const id = crypto.randomUUID();
    await db.insert(user).values({ id, name: "Jakub", email: `${id}@example.com` });
    expect(await previewBetSession(db, id)).toBeNull();
  });
});
