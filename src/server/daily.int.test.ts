import { afterAll, describe, expect, it } from "vitest";
import { createDb } from "@/db/client";
import { assessment, trainingSession, user } from "@/db/schema";
import { playRun } from "../../tests/setup/play-run";
import { finishBetSession, getBetSessionSummary, previewLightSession, startLightSession } from "./bet-session";
import { getDailySession } from "./daily";
import { getPreferences, savePreferences } from "./preferences";
import { completeRun, recordTrials } from "./training";

const db = createDb(process.env.DATABASE_URL!);
const DEVICE = { device: "desktop", inputMode: "keyboard" } as const;

afterAll(async () => {
  await db.$client.end();
});

async function createUser(assessed = true) {
  const id = crypto.randomUUID();
  await db.insert(user).values({ id, name: "Jakub", email: `${id}@example.com` });
  if (assessed) {
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
      completedAt: new Date(),
    });
  }
  return id;
}

async function completedSession(userId: string, kind: "bet" | "light" | "free_practice", startedAt: Date) {
  await db.insert(trainingSession).values({
    userId,
    kind,
    status: "completed",
    device: "desktop",
    inputMode: "keyboard",
    startedAt,
  });
}

describe("preferences", () => {
  it("falls back to the defaults", async () => {
    expect(await getPreferences(db, await createUser())).toEqual({
      betSessionsPerWeek: 4,
      defaultDurationMin: 30,
      weeklyGoal: 5,
      timeZone: "Europe/Paris",
    });
  });

  it("saves and reads them back", async () => {
    const userId = await createUser();
    const saved = { betSessionsPerWeek: 3, defaultDurationMin: 45, weeklyGoal: 6, timeZone: "America/Montreal" };
    await savePreferences(db, userId, saved);
    await savePreferences(db, userId, { ...saved, weeklyGoal: 7 });
    expect(await getPreferences(db, userId)).toEqual({ ...saved, weeklyGoal: 7 });
  });

  it.each([
    ["too many BET sessions", { betSessionsPerWeek: 6 }],
    ["a goal below the BET sessions", { betSessionsPerWeek: 5, weeklyGoal: 4 }],
    ["an unknown time zone", { timeZone: "Mars/Olympus" }],
  ])("rejects %s", async (_label, change) => {
    const valid = { betSessionsPerWeek: 4, defaultDurationMin: 30, weeklyGoal: 5, timeZone: "Europe/Paris" };
    await expect(savePreferences(db, await createUser(), { ...valid, ...change })).rejects.toThrow();
  });
});

describe("today's session", () => {
  // Thursday 22 October 2026, 18:00 in Paris.
  const NOW = new Date("2026-10-22T16:00:00Z");

  it("recommends BET to a new user, and counts this week's sessions in the user's time zone", async () => {
    const userId = await createUser();
    expect(await getDailySession(db, userId, NOW)).toMatchObject({ kind: "bet", done: false, today: "2026-10-22" });

    await completedSession(userId, "bet", new Date("2026-10-19T08:00:00Z")); // Monday
    await completedSession(userId, "light", new Date("2026-10-20T08:00:00Z")); // Tuesday
    await completedSession(userId, "bet", new Date("2026-10-21T21:30:00Z")); // Wednesday 23:30 in Paris
    const daily = await getDailySession(db, userId, NOW);
    expect(daily.week).toMatchObject({ betDone: 2, lightDone: 1, daysLeft: 4 });
    // BET yesterday evening, and the week's one light session (goal 5 = 4 BET + 1 light) is done: rest.
    expect(daily.kind).toBe("rest");
  });

  it("ignores free practice", async () => {
    const userId = await createUser();
    await completedSession(userId, "free_practice", new Date("2026-10-22T07:00:00Z"));
    expect(await getDailySession(db, userId, NOW)).toMatchObject({ kind: "bet", done: false, todaysSessionId: null });
  });

  it("is done once today's session is completed", async () => {
    const userId = await createUser();
    await completedSession(userId, "bet", new Date("2026-10-22T06:00:00Z"));
    const daily = await getDailySession(db, userId, NOW);
    expect(daily).toMatchObject({ kind: "bet", done: true });
    expect(daily.todaysSessionId).toEqual(expect.any(String));
  });
});

describe("light sessions", () => {
  it("runs three targeted exercises over ten minutes and summarises them", async () => {
    const userId = await createUser();
    const started = await startLightSession(db, userId, { ...DEVICE, context: "rest", preFatigue: 2 }, 0.1);
    expect(started.steps.map((s) => s.block)).toEqual(["targeted", "targeted", "targeted"]);
    expect(started.explanation.betExercises).toEqual([]);

    for (const step of started.steps) {
      const trials = playRun(step, 400);
      await recordTrials(db, userId, step.runId, { trials });
      await completeRun(db, userId, step.runId, { pauses: [], trialCount: trials.length });
    }
    expect(
      await finishBetSession(db, userId, started.sessionId, { postFatigue: 3, perceivedEffort: 4, motivation: 7 }),
    ).toEqual({ status: "finished", sessionLoad: 40 });

    const summary = await getBetSessionSummary(db, userId, started.sessionId);
    expect(summary).toMatchObject({ kind: "light", context: "rest", durationMin: 10, fatigueCheck: null });
  });

  it("rotates its domains from one light session to the next and previews the next one", async () => {
    const userId = await createUser();
    const preview = await previewLightSession(db, userId);
    const first = await startLightSession(db, userId, { ...DEVICE, context: "rest", preFatigue: 2 }, 0.1);
    expect(first.explanation).toEqual(preview);
    const second = await startLightSession(db, userId, { ...DEVICE, context: "rest", preFatigue: 2 }, 0.1);
    expect(second.explanation.targetedDomains).not.toEqual(first.explanation.targetedDomains);
  });

  it("needs a completed assessment", async () => {
    await expect(
      startLightSession(db, await createUser(false), { ...DEVICE, context: "rest", preFatigue: 2 }),
    ).rejects.toThrow();
  });
});
