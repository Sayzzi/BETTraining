import { afterAll, describe, expect, it } from "vitest";
import { createDb } from "@/db/client";
import { user } from "@/db/schema";
import { playRun } from "../../tests/setup/play-run";
import { getSessionDetail, listSessions } from "./history";
import { abandonSession, completeRun, NotFoundError, recordTrials, startFreePractice } from "./training";

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

async function practice(userId: string, exercise: "pvt" | "stroop", finish: boolean) {
  const started = await startFreePractice(db, userId, { ...DEVICE, exercise, durationMin: 3 });
  if (finish) {
    const trials = playRun({ ...started, config: { ...started.config, durationMs: 20_000 } }, 300);
    await recordTrials(db, userId, started.runId, { trials });
    await completeRun(db, userId, started.runId, { pauses: [], trialCount: trials.length });
  }
  return started;
}

describe("session history", () => {
  it("lists the user's sessions newest first, incomplete ones included", async () => {
    const userId = await createUser();
    const first = await practice(userId, "pvt", true);
    const second = await practice(userId, "stroop", false);
    await abandonSession(db, userId, second.sessionId);

    const { sessions, hasMore } = await listSessions(db, userId);
    expect(hasMore).toBe(false);
    expect(sessions.map((s) => [s.id, s.kind, s.status, s.exercises])).toEqual([
      [second.sessionId, "free_practice", "incomplete", ["stroop"]],
      [first.sessionId, "free_practice", "completed", ["pvt"]],
    ]);
    expect(sessions[1].durationMin).toBe(3);
  });

  it("pages through older sessions", async () => {
    const userId = await createUser();
    for (let i = 0; i < 3; i++) await practice(userId, "pvt", false);
    const page = await listSessions(db, userId, { limit: 2 });
    expect(page.hasMore).toBe(true);
    const next = await listSessions(db, userId, { limit: 2, before: page.sessions.at(-1)!.startedAt });
    expect(next.hasMore).toBe(false);
    expect(next.sessions).toHaveLength(1);
    expect(next.sessions[0].id).not.toBe(page.sessions[0].id);
  });

  it("details each run with its results and minute-by-minute breakdown", async () => {
    const userId = await createUser();
    const started = await practice(userId, "pvt", true);
    const detail = await getSessionDetail(db, userId, started.sessionId);
    expect(detail).toMatchObject({ kind: "free_practice", status: "completed" });
    expect(detail.runs).toHaveLength(1);
    expect(detail.runs[0].results!.minutes.length).toBeGreaterThan(0);
  });

  it("never shows another user's sessions", async () => {
    const owner = await createUser();
    const other = await createUser();
    const started = await practice(owner, "pvt", true);

    expect((await listSessions(db, other)).sessions).toEqual([]);
    await expect(getSessionDetail(db, other, started.sessionId)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getSessionDetail(db, other, "not-a-uuid")).rejects.toBeInstanceOf(NotFoundError);
  });
});
