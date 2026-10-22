import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createDb } from "@/db/client";
import { exerciseRun, trainingSession, user } from "@/db/schema";
import {
  completeAssessment,
  currentClassification,
  getAssessment,
  hasCompletedAssessment,
  startAssessment,
  type AssessmentStepRun,
} from "./assessment";
import { playRun } from "../../tests/setup/play-run";
import { abandonSession, completeRun, NotFoundError, recordTrials, startFreePractice } from "./training";

const db = createDb(process.env.DATABASE_URL!);
const DEVICE = { device: "desktop", inputMode: "keyboard", userAgent: "vitest" } as const;
const QUICK = 0.02;

afterAll(async () => {
  await db.$client.end();
});

async function createUser() {
  const id = crypto.randomUUID();
  await db.insert(user).values({ id, name: "Jakub", email: `${id}@example.com` });
  return id;
}

async function completeStep(
  userId: string,
  step: AssessmentStepRun,
  rtMs: number | ((index: number) => number),
  correct?: (index: number) => boolean,
) {
  const trials = playRun(step, rtMs, correct);
  await recordTrials(db, userId, step.runId, { trials });
  return completeRun(db, userId, step.runId, { pauses: [], trialCount: trials.length });
}

describe("assessments", () => {
  it("creates the nine protocol runs in one session, with their block and fixed level", async () => {
    const userId = await createUser();
    const started = await startAssessment(db, userId, DEVICE, QUICK);

    expect(started.steps).toHaveLength(9);
    const runs = await db.select().from(exerciseRun).where(eq(exerciseRun.sessionId, started.sessionId));
    expect(runs.map((r) => r.block).sort()).toEqual(
      ["bet", "cold", "cold", "cold", "cold", "fatigued", "fatigued", "fatigued", "fatigued"],
    );
    const [session] = await db.select().from(trainingSession).where(eq(trainingSession.id, started.sessionId));
    expect(session.kind).toBe("assessment");
    expect(started.steps.find((s) => s.exercise === "nback")!.level).toBe(5);
  });

  it("stays in progress until the last run, then scores each domain and the fatigue resistance", async () => {
    const userId = await createUser();
    // Long enough for every test to collect trials.
    const started = await startAssessment(db, userId, DEVICE, 0.1);

    // Slower answers once fatigued.
    for (const step of started.steps) await completeStep(userId, step, step.block === "fatigued" ? 500 : 400);
    const [session] = await db.select().from(trainingSession).where(eq(trainingSession.id, started.sessionId));
    expect(session.status).toBe("completed");

    const outcome = await completeAssessment(db, userId, started.assessmentId);
    expect(outcome.status).toBe("completed");
    const details = await getAssessment(db, userId, started.assessmentId);
    expect(details.status).toBe("completed");
    expect(details.results!.domains).toHaveLength(4);
    for (const domain of details.results!.domains) {
      expect(domain.cold).toBeGreaterThan(domain.fatigued!);
      expect(domain.change).toBeLessThan(0);
    }
    expect(details.results!.fatigueResistance).toBeLessThan(1);
    expect(await hasCompletedAssessment(db, userId)).toBe(true);
  });

  it("refuses to score while runs are still pending", async () => {
    const userId = await createUser();
    const started = await startAssessment(db, userId, DEVICE, QUICK);
    await completeStep(userId, started.steps[0], 300);

    expect(await completeAssessment(db, userId, started.assessmentId)).toEqual({ status: "runs_pending", pending: 8 });
    const [session] = await db.select().from(trainingSession).where(eq(trainingSession.id, started.sessionId));
    expect(session.status).toBe("in_progress");
  });

  it("never changes the saved difficulty level", async () => {
    const userId = await createUser();
    const started = await startAssessment(db, userId, DEVICE, QUICK);
    for (const step of started.steps) await completeStep(userId, step, 300);

    const freePractice = await startFreePractice(db, userId, { ...DEVICE, exercise: "nback", durationMin: 3 });
    expect(freePractice.level).toBe(2);
  });

  it("marks an interrupted assessment incomplete, and a new one can start", async () => {
    const userId = await createUser();
    const first = await startAssessment(db, userId, DEVICE, QUICK);
    await completeStep(userId, first.steps[0], 300);
    await abandonSession(db, userId, first.sessionId);

    expect((await getAssessment(db, userId, first.assessmentId)).status).toBe("incomplete");
    expect(await hasCompletedAssessment(db, userId)).toBe(false);

    const second = await startAssessment(db, userId, DEVICE, QUICK);
    expect((await getAssessment(db, userId, second.assessmentId)).status).toBe("in_progress");
  });

  it("marks an open assessment incomplete when another session starts", async () => {
    const userId = await createUser();
    const started = await startAssessment(db, userId, DEVICE, QUICK);
    await startFreePractice(db, userId, { ...DEVICE, exercise: "pvt", durationMin: 3 });
    expect((await getAssessment(db, userId, started.assessmentId)).status).toBe("incomplete");
  });

  it("stores the same protocol every time", async () => {
    const userId = await createUser();
    const a = await startAssessment(db, userId, DEVICE);
    const b = await startAssessment(db, userId, DEVICE);
    const shape = (s: typeof a) => s.steps.map(({ exercise, block, config, level }) => ({ exercise, block, config, level }));
    expect(shape(a)).toEqual(shape(b));
  });

  it("keeps assessments private", async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const started = await startAssessment(db, owner, DEVICE, QUICK);
    await expect(getAssessment(db, intruder, started.assessmentId)).rejects.toBeInstanceOf(NotFoundError);
    await expect(completeAssessment(db, intruder, started.assessmentId)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("has no comparison or ranking after a first assessment", async () => {
    const userId = await createUser();
    const started = await startAssessment(db, userId, DEVICE, 0.1);
    for (const step of started.steps) await completeStep(userId, step, 300);
    await completeAssessment(db, userId, started.assessmentId);

    expect((await getAssessment(db, userId, started.assessmentId)).results!.comparison).toBeNull();
    expect(await currentClassification(db, userId)).toEqual({});
  });

  it("compares a new assessment with the previous one and records the strengths", async () => {
    const userId = await createUser();
    // First: slower, irregular, one error in four on choice tasks.
    const first = await startAssessment(db, userId, DEVICE, 0.1);
    for (const step of first.steps) {
      await completeStep(userId, step, (i) => (i % 2 ? 340 : 240), (i) => i % 4 !== 3);
    }
    await completeAssessment(db, userId, first.assessmentId);

    // Second: faster, steadier and accurate on every test except the n-back, which stays the same.
    const second = await startAssessment(db, userId, DEVICE, 0.1);
    for (const step of second.steps) {
      if (step.exercise === "nback") await completeStep(userId, step, (i) => (i % 2 ? 340 : 240), (i) => i % 4 !== 3);
      else await completeStep(userId, step, (i) => (i % 2 ? 250 : 200));
    }
    await completeAssessment(db, userId, second.assessmentId);

    const comparison = (await getAssessment(db, userId, second.assessmentId)).results!.comparison!;
    expect(comparison.previousAssessmentId).toBe(first.assessmentId);
    expect(comparison.classification).toEqual({
      sustained_attention: "strength",
      working_memory: "weakness",
      inhibition: "strength",
      processing_speed: "strength",
    });
    expect(comparison.domains.find((d) => d.domain === "inhibition")!.reactionTime.change).toBeGreaterThan(0.05);
    expect(await currentClassification(db, userId)).toEqual(comparison.classification);
  });
});
