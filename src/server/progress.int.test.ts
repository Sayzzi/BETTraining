import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createDb } from "@/db/client";
import { exerciseRun, user } from "@/db/schema";
import type { DifficultySnapshot } from "@/engine/exercises";
import { playRun } from "../../tests/setup/play-run";
import { getProgress } from "./progress";
import { completeRun, recordTrials, startFreePractice } from "./training";

const db = createDb(process.env.DATABASE_URL!);
const DEVICE = { device: "desktop", inputMode: "keyboard" } as const;

afterAll(async () => {
  await db.$client.end();
});

async function createUser() {
  const id = crypto.randomUUID();
  await db.insert(user).values({ id, name: "Jakub", email: `${id}@example.com` });
  return id;
}

async function practice(userId: string, exercise: "nback" | "stroop" | "pvt") {
  const started = await startFreePractice(db, userId, { ...DEVICE, exercise, durationMin: 3 });
  const short = { ...started, config: { ...started.config, durationMs: 40_000 } };
  const trials = playRun(short, 500, (i) => i % 8 !== 7);
  await recordTrials(db, userId, started.runId, { trials });
  await completeRun(db, userId, started.runId, { pauses: [], trialCount: trials.length });
  return started;
}

describe("progress", () => {
  it("rebuilds each domain's level from the raw trials, matching the stored end levels", async () => {
    const userId = await createUser();
    const first = await practice(userId, "nback");
    const second = await practice(userId, "nback");
    await practice(userId, "pvt");

    const progress = await getProgress(db, userId);
    const stored = await Promise.all(
      [first, second].map(async (s) => {
        const [run] = await db.select().from(exerciseRun).where(eq(exerciseRun.id, s.runId));
        return (run.difficultyEnd as DifficultySnapshot).level;
      }),
    );
    expect(progress.levels.working_memory.at(-1)!.level).toBeCloseTo((stored[0] + stored[1]) / 2);
    // The PVT has no difficulty level.
    expect(progress.levels.sustained_attention).toEqual([]);
    expect(progress.assessments).toEqual([]);
    expect(progress.classification).toEqual({});
  });

  it("only contains the signed-in user's data", async () => {
    const owner = await createUser();
    const other = await createUser();
    await practice(owner, "stroop");

    expect((await getProgress(db, owner)).levels.inhibition).toHaveLength(1);
    const theirs = await getProgress(db, other);
    expect(Object.values(theirs.levels).every((points) => points.length === 0)).toBe(true);
    expect(theirs.assessments).toEqual([]);
  });
});
