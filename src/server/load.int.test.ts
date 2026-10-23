import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createDb } from "@/db/client";
import { assessment, exerciseRun, loadState, trainingSession, user } from "@/db/schema";
import { playRun } from "../../tests/setup/play-run";
import {
  chooseFatigueAdvice,
  getBetSessionSummary,
  getFatigueAdvice,
  previewBetSession,
  startBetSession,
} from "./bet-session";
import { postponeAssessment, refreshLoad } from "./load";
import { completeRun, recordTrials } from "./training";

const db = createDb(process.env.DATABASE_URL!);
const SESSION = { device: "desktop", inputMode: "keyboard", durationMin: 60, context: "after_sport", preFatigue: 3 } as const;
const QUICK = 0.05;

afterAll(async () => {
  await db.$client.end();
});

async function createAssessedUser() {
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
    results: { protocolVersion: 1, domains: [], fatigueResistance: 0.9, comparison: null },
    completedAt: new Date("2026-09-01T10:00:00Z"),
  });
  return id;
}

/** A completed BET session on a given day, with calm fatigue checks. */
async function pastBetSession(userId: string, startedAt: Date) {
  const [session] = await db
    .insert(trainingSession)
    .values({ userId, kind: "bet", status: "completed", device: "desktop", inputMode: "keyboard", startedAt })
    .returning({ id: trainingSession.id });
  for (const [position, block, lapses] of [[0, "fatigue_open", 1], [1, "fatigue_close", 2]] as const) {
    await db.insert(exerciseRun).values({
      sessionId: session.id,
      exercise: "pvt_b",
      block,
      position,
      config: {},
      seed: 1,
      status: "completed",
      results: { lapses, meanRtMs: 280 + position * 20 },
    });
  }
}

async function setLoad(userId: string, step: number, since: string) {
  await db.insert(loadState).values({ userId, step, lastStepAt: since, cycleStartedAt: since });
}

describe("load state", () => {
  it("is created at step 0 on first use and saved", async () => {
    const userId = await createAssessedUser();
    const evaluation = await refreshLoad(db, userId, new Date("2026-10-23T10:00:00Z"));
    expect(evaluation.state).toMatchObject({ step: 0, lastStepAt: "2026-10-23", cycleStartedAt: "2026-10-23" });
    const [row] = await db.select().from(loadState).where(eq(loadState.userId, userId));
    expect(row.step).toBe(0);
  });

  it("steps up after two weeks of BET sessions and records the change", async () => {
    const userId = await createAssessedUser();
    await setLoad(userId, 0, "2026-10-05");
    await pastBetSession(userId, new Date("2026-10-07T10:00:00Z"));
    await pastBetSession(userId, new Date("2026-10-12T10:00:00Z"));

    const evaluation = await refreshLoad(db, userId, new Date("2026-10-19T10:00:00Z"));
    expect(evaluation.state).toMatchObject({ step: 1, lastStepAt: "2026-10-19" });
    expect(evaluation.state.lastChange).toMatchObject({ kind: "up", variable: "betShare" });
  });

  it("drops after more than seven days without a session", async () => {
    const userId = await createAssessedUser();
    await setLoad(userId, 4, "2026-10-01");
    await pastBetSession(userId, new Date("2026-10-08T10:00:00Z"));
    expect((await refreshLoad(db, userId, new Date("2026-10-17T10:00:00Z"))).state.step).toBe(2);
  });

  it("proposes an assessment in the light week and lets the user postpone it", async () => {
    const userId = await createAssessedUser();
    await setLoad(userId, 3, "2026-10-01");
    const lightWeek = new Date("2026-10-23T10:00:00Z"); // cycle day 22
    const evaluation = await refreshLoad(db, userId, lightWeek);
    expect(evaluation).toMatchObject({ deload: true, assessmentDue: true });
    // The light week runs two steps below.
    expect(evaluation.parameters).toEqual({ betShare: 0.65, betLevelOffset: 0, betExerciseMaxMin: 20 });

    expect(await postponeAssessment(db, userId, lightWeek)).toBe(true);
    expect((await refreshLoad(db, userId, lightWeek)).assessmentDue).toBe(false);
  });
});

describe("load in BET sessions", () => {
  it("sizes the BET block and raises its starting level from the load", async () => {
    const userId = await createAssessedUser();
    // Step 2: 65 % share, BET level offset +1. Recent session keeps it from dropping for inactivity.
    await setLoad(userId, 2, new Date().toISOString().slice(0, 10));
    const started = await startBetSession(db, userId, SESSION, QUICK);

    const bet = started.steps.filter((s) => s.block === "bet");
    const betMs = bet.reduce((sum, s) => sum + s.config.durationMs, 0);
    expect(betMs).toBe(Math.round(39 * 60_000 * QUICK));
    // Stroop starts 2 below its own level (3), plus the offset of 1.
    expect(bet.find((s) => s.exercise === "stroop")!.level).toBe(2);
    expect(started.explanation.load).toMatchObject({ step: 2, deload: false });
    expect((await previewBetSession(db, userId))![60].load).toMatchObject({ step: 2 });
  });
});

describe("fatigue advice", () => {
  /** Starts a session and plays its opening check with slow answers: every answer is a lapse. */
  async function tiredStart() {
    const userId = await createAssessedUser();
    const started = await startBetSession(db, userId, SESSION, 0.2);
    const opening = started.steps[0];
    const trials = playRun(opening, 450);
    await recordTrials(db, userId, opening.runId, { trials });
    await completeRun(db, userId, opening.runId, { pauses: [], trialCount: trials.length });
    return { userId, started };
  }

  it("advises a lighter session above three lapses at the opening check", async () => {
    const { userId, started } = await tiredStart();
    const advice = await getFatigueAdvice(db, userId, started.sessionId);
    expect(advice.lapses).toBeGreaterThan(3);
    expect(advice.advised).toBe(true);
  });

  it("halves and eases the BET block when the user lightens the session", async () => {
    const { userId, started } = await tiredStart();
    const before = started.steps.filter((s) => s.block === "bet");
    const { steps } = await chooseFatigueAdvice(db, userId, started.sessionId, { choice: "lighten" });
    const after = steps!.filter((s) => s.block === "bet");

    after.forEach((step, i) => {
      expect(step.config.durationMs).toBe(Math.round(before[i].config.durationMs * 0.5));
      if (before[i].level !== null) expect(step.level).toBe(Math.max(1, before[i].level! - 2));
    });
    expect((await getBetSessionSummary(db, userId, started.sessionId)).fatigueAdvice).toBe("lightened");
  });

  it("records a declined advice and keeps the session as planned", async () => {
    const { userId, started } = await tiredStart();
    const { steps } = await chooseFatigueAdvice(db, userId, started.sessionId, { choice: "continue" });
    expect(steps!.map((s) => s.config.durationMs)).toEqual(started.steps.map((s) => s.config.durationMs));
    expect((await getBetSessionSummary(db, userId, started.sessionId)).fatigueAdvice).toBe("declined");
  });

  it("ends the session when the user chooses rest", async () => {
    const { userId, started } = await tiredStart();
    expect(await chooseFatigueAdvice(db, userId, started.sessionId, { choice: "rest" })).toEqual({ steps: null });
    const summary = await getBetSessionSummary(db, userId, started.sessionId);
    expect(summary).toMatchObject({ status: "incomplete", fatigueAdvice: "rested" });
  });
});
