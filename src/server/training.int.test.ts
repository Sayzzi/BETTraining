import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createDb } from "@/db/client";
import { exerciseRun, trainingSession, user } from "@/db/schema";
import { frame, respond, startPvt } from "@/engine/pvt";
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

function start(userId: string) {
  return startFreePractice(db, userId, {
    exercise: "pvt",
    durationMin: 3,
    device: "desktop",
    inputMode: "keyboard",
    userAgent: "vitest",
  });
}

/** Plays a whole run with the engine, answering every stimulus after 280 ms. */
function playRun(seed: number, config: Parameters<typeof startPvt>[0]): Trial[] {
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
