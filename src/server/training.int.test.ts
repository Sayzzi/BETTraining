import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createDb } from "@/db/client";
import { difficultyState, exerciseRun, trainingSession, user } from "@/db/schema";
import * as choice from "@/engine/choice-task";
import * as nback from "@/engine/nback";
import type { FreePracticeExercise } from "@/engine/exercises";
import { STROOP_SPEC } from "@/engine/stroop";
import { symbolDigitKey, symbolDigitSpec } from "@/engine/symbol-digit";
import { frame, respond, startPvt, type PvtConfig } from "@/engine/pvt";
import type { Trial } from "@/engine/trial";
import {
  abandonSession,
  completeRun,
  getRun,
  loadTrials,
  NotFoundError,
  recordTrials,
  startFreePractice,
} from "./training";

const db = createDb(process.env.DATABASE_URL!);

afterAll(async () => {
  await db.$client.end();
});

async function createUser() {
  const id = crypto.randomUUID();
  await db.insert(user).values({ id, name: "Jakub", email: `${id}@example.com` });
  return id;
}

function start(userId: string, exercise: FreePracticeExercise = "pvt") {
  return startFreePractice(db, userId, {
    exercise,
    durationMin: 3,
    device: "desktop",
    inputMode: "keyboard",
    userAgent: "vitest",
  });
}

/** Plays a whole run with the engine, answering every stimulus after 280 ms. */
function playRun(seed: number, startedConfig: unknown): Trial[] {
  const config = startedConfig as PvtConfig;
  let run = startPvt({ ...config, practiceTrials: 0 }, seed, 0);
  let at = 0;
  while (run.phase !== "done") {
    at += 16;
    run = frame(run, at);
    if (run.stimulusOnsetMs !== null) run = respond(run, at + 280, { input: "keyboard" });
  }
  return run.trials;
}

describe("free practice sessions", () => {
  it("starts a free practice session with a PVT run and its configuration", async () => {
    const userId = await createUser();
    const started = await start(userId);

    expect(started.config.durationMs).toBe(180_000);
    const [session] = await db.select().from(trainingSession).where(eq(trainingSession.id, started.sessionId));
    expect(session).toMatchObject({ userId, kind: "free_practice", status: "in_progress", device: "desktop", inputMode: "keyboard" });
    const run = await getRun(db, userId, started.runId);
    expect(run).toMatchObject({ exercise: "pvt", status: "in_progress", results: null });
  });

  it("stores trials sent in batches, ignores a re-sent batch, and reads them back in order", async () => {
    const userId = await createUser();
    const started = await start(userId);
    const trials = playRun(started.seed, started.config);
    const middle = Math.floor(trials.length / 2);

    await recordTrials(db, userId, started.runId, { trials: trials.slice(0, middle) });
    await recordTrials(db, userId, started.runId, { trials: trials.slice(0, middle) });
    await recordTrials(db, userId, started.runId, { trials: trials.slice(middle) });

    expect(await loadTrials(db, started.runId)).toEqual(trials);
  });

  it("completes a run with results computed on the server from stored trials", async () => {
    const userId = await createUser();
    const started = await start(userId);
    const trials = playRun(started.seed, started.config);
    await recordTrials(db, userId, started.runId, { trials });

    const outcome = await completeRun(db, userId, started.runId, {
      pauses: [{ atMs: 5_000, durationMs: 2_000 }],
      trialCount: trials.length,
    });

    expect(outcome.status).toBe("completed");
    const run = await getRun(db, userId, started.runId);
    expect(run.status).toBe("completed");
    expect(run.results).toMatchObject({ trialCount: trials.length, meanRtMs: 280, lapses: 0 });
    const [session] = await db.select().from(trainingSession).where(eq(trainingSession.id, started.sessionId));
    expect(session.status).toBe("completed");
    expect(session.endedAt).not.toBeNull();
  });

  it("refuses to complete while trials are still missing, so the client can resend them", async () => {
    const userId = await createUser();
    const started = await start(userId);
    const trials = playRun(started.seed, started.config);
    await recordTrials(db, userId, started.runId, { trials: trials.slice(0, 2) });

    const outcome = await completeRun(db, userId, started.runId, { pauses: [], trialCount: trials.length });

    expect(outcome).toEqual({ status: "missing_trials", stored: 2, expected: trials.length });
    expect((await getRun(db, userId, started.runId)).status).toBe("in_progress");
  });

  it("marks an abandoned session and its run incomplete, keeping its trials", async () => {
    const userId = await createUser();
    const started = await start(userId);
    const trials = playRun(started.seed, started.config).slice(0, 3);
    await recordTrials(db, userId, started.runId, { trials });

    await abandonSession(db, userId, started.sessionId);

    expect((await getRun(db, userId, started.runId)).status).toBe("incomplete");
    expect(await loadTrials(db, started.runId)).toHaveLength(3);
  });

  it("marks a still-open session incomplete when the user starts a new one", async () => {
    const userId = await createUser();
    const first = await start(userId);
    await start(userId);

    const [run] = await db.select().from(exerciseRun).where(eq(exerciseRun.id, first.runId));
    expect(run.status).toBe("incomplete");
  });

  it("never lets a user read or write another user's run", async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const started = await start(owner);
    const trials = playRun(started.seed, started.config).slice(0, 1);

    await expect(recordTrials(db, intruder, started.runId, { trials })).rejects.toBeInstanceOf(NotFoundError);
    await expect(getRun(db, intruder, started.runId)).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      completeRun(db, intruder, started.runId, { pauses: [], trialCount: 0 }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await abandonSession(db, intruder, started.sessionId);
    expect((await getRun(db, owner, started.runId)).status).toBe("in_progress");
  });

  it("rejects malformed trials", async () => {
    const userId = await createUser();
    const started = await start(userId);
    await expect(
      recordTrials(db, userId, started.runId, { trials: [{ index: -1, outcome: "great" }] }),
    ).rejects.toThrow();
  });
});

/** Plays a whole n-back run at about 90 % success (above the 80 % target, so the level rises). */
function playNBack(started: Awaited<ReturnType<typeof start>>) {
  const config = { ...(started.config as nback.NBackConfig), practiceScoredTrials: 0 };
  let run = nback.startNBack(config, started.seed, 0, started.level!);
  let at = 0;
  while (run.phase !== "done") {
    at += 10;
    run = nback.frame(run, at);
    const current = run.current;
    if (current?.scored && !current.answer) {
      const right = current.isTarget ? "match" : "different";
      const choice = current.position % 10 === 0 ? (right === "match" ? "different" : "match") : right;
      run = nback.respond(run, at + 500, { choice, input: "keyboard" });
    }
  }
  return run;
}

describe("adaptive difficulty", () => {
  it("starts a new user's n-back at the initial level and records it on the run", async () => {
    const userId = await createUser();
    const started = await start(userId, "nback");

    expect(started.level).toBe(2);
    const [run] = await db.select().from(exerciseRun).where(eq(exerciseRun.id, started.runId));
    expect(run.difficultyStart).toEqual({ level: 2, n: 1, soaMs: 2500 });
  });

  it("saves the level reached, replayed on the server, and resumes from it next time", async () => {
    const userId = await createUser();
    const first = await start(userId, "nback");
    const played = playNBack(first);
    await recordTrials(db, userId, first.runId, { trials: played.trials });

    await completeRun(db, userId, first.runId, { pauses: [], trialCount: played.trials.length });

    const run = await getRun(db, userId, first.runId);
    expect(run.difficultyEnd!.level).toBeCloseTo(played.level);
    expect(run.difficultyEnd!.level).toBeGreaterThan(2);
    const [saved] = await db.select().from(difficultyState).where(eq(difficultyState.userId, userId));
    expect(saved).toMatchObject({ exercise: "nback" });
    expect(saved.level).toBeCloseTo(played.level);

    const second = await start(userId, "nback");
    expect(second.level).toBeCloseTo(played.level);
  });

  it("stores the difficulty in force with each trial", async () => {
    const userId = await createUser();
    const started = await start(userId, "nback");
    const played = playNBack(started);
    await recordTrials(db, userId, started.runId, { trials: played.trials.slice(0, 3) });

    const [first] = await loadTrials(db, started.runId);
    expect(first.difficulty).toEqual({ level: 2, n: 1, soaMs: 2500 });
    expect(first.response).toMatchObject({ choice: expect.stringMatching(/match|different/) });
  });

  it("leaves the saved level untouched when a run is abandoned", async () => {
    const userId = await createUser();
    const started = await start(userId, "nback");
    const played = playNBack(started);
    await recordTrials(db, userId, started.runId, { trials: played.trials });
    await abandonSession(db, userId, started.sessionId);

    expect(await db.select().from(difficultyState).where(eq(difficultyState.userId, userId))).toHaveLength(0);
  });

  it("keeps each user's level separate", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const started = await start(alice, "nback");
    const played = playNBack(started);
    await recordTrials(db, alice, started.runId, { trials: played.trials });
    await completeRun(db, alice, started.runId, { pauses: [], trialCount: played.trials.length });

    expect((await start(bob, "nback")).level).toBe(2);
  });

  it("has no difficulty for the PVT", async () => {
    const userId = await createUser();
    const started = await start(userId);
    expect(started.level).toBeNull();
    const [run] = await db.select().from(exerciseRun).where(eq(exerciseRun.id, started.runId));
    expect(run.difficultyStart).toBeNull();
  });
});

describe("choice tasks", () => {
  it("runs a Stroop session end to end: initial level, replayed level saved, interference cost stored", async () => {
    const userId = await createUser();
    const started = await start(userId, "stroop");
    expect(started.level).toBe(3);

    const config = { ...(started.config as choice.ChoiceTaskConfig), practiceTrials: 0 };
    let run = choice.startChoiceTask(config, STROOP_SPEC, started.seed, 0, started.level!);
    let at = 0;
    while (run.phase !== "done") {
      at += 10;
      run = choice.frame(run, at);
      if (run.current) {
        const rt = run.current.stimulus.congruent ? 500 : 650;
        run = choice.respond(run, at + rt, STROOP_SPEC.correctChoice(run.current.stimulus), "keyboard");
      }
    }
    await recordTrials(db, userId, started.runId, { trials: run.trials });
    const outcome = await completeRun(db, userId, started.runId, { pauses: [], trialCount: run.trials.length });

    expect(outcome.status).toBe("completed");
    const details = await getRun(db, userId, started.runId);
    expect(details.results!.congruencyEffectMs).toBe(150);
    expect(details.difficultyStart).toMatchObject({ level: 3, incongruentRate: expect.any(Number) });
    expect(details.difficultyEnd!.level).toBeCloseTo(run.level);
    expect((await start(userId, "stroop")).level).toBeCloseTo(run.level);
  });

  it("runs a symbols-digits session with the key rebuilt from the run's seed", async () => {
    const userId = await createUser();
    const started = await start(userId, "symbol_digit");
    const spec = symbolDigitSpec(symbolDigitKey(started.seed));
    const config = { ...(started.config as choice.ChoiceTaskConfig), practiceTrials: 0 };
    let run = choice.startChoiceTask(config, spec, started.seed, 0, started.level!);
    let at = 0;
    while (run.phase !== "done") {
      at += 10;
      run = choice.frame(run, at);
      if (run.current) run = choice.respond(run, at + 700, spec.correctChoice(run.current.stimulus), "keyboard");
    }
    await recordTrials(db, userId, started.runId, { trials: run.trials });
    await completeRun(db, userId, started.runId, { pauses: [], trialCount: run.trials.length });

    const details = await getRun(db, userId, started.runId);
    expect(details.results).toMatchObject({ accuracy: 1, congruencyEffectMs: null, meanRtMs: 700 });
    expect(details.difficultyEnd).toMatchObject({ level: run.level, responseWindowMs: expect.any(Number) });
  });
});
