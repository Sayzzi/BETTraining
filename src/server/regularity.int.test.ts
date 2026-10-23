import { afterAll, describe, expect, it } from "vitest";
import { createDb } from "@/db/client";
import { trainingSession, user } from "@/db/schema";
import { getRegularity } from "./regularity";

const db = createDb(process.env.DATABASE_URL!);
// Thursday 22 October 2026, 18:00 in Paris.
const NOW = new Date("2026-10-22T16:00:00Z");

afterAll(async () => {
  await db.$client.end();
});

async function createUser() {
  const id = crypto.randomUUID();
  await db.insert(user).values({ id, name: "Jakub", email: `${id}@example.com` });
  return id;
}

async function session(
  userId: string,
  kind: "bet" | "light" | "free_practice",
  startedAt: string,
  ratings: { load?: number; postFatigue?: number } = {},
) {
  await db.insert(trainingSession).values({
    userId,
    kind,
    status: "completed",
    device: "desktop",
    inputMode: "keyboard",
    startedAt: new Date(startedAt),
    sessionLoad: ratings.load ?? null,
    postFatigue: ratings.postFatigue ?? null,
    perceivedEffort: ratings.load ? Math.round(ratings.load / 30) : null,
    motivation: ratings.postFatigue ? 7 : null,
    preFatigue: ratings.postFatigue ? 3 : null,
  });
}

describe("regularity", () => {
  it("builds the calendar, goals, load and ratings from completed sessions", async () => {
    const userId = await createUser();
    await session(userId, "bet", "2026-10-19T08:00:00Z", { load: 240, postFatigue: 6 }); // Monday
    await session(userId, "free_practice", "2026-10-20T08:00:00Z"); // Tuesday
    await session(userId, "light", "2026-10-21T08:00:00Z", { load: 40, postFatigue: 4 }); // Wednesday

    const regularity = await getRegularity(db, userId, NOW);
    const thisWeek = regularity.calendar.at(-1)!;
    expect(thisWeek.slice(0, 4).map((d) => d.kind)).toEqual(["bet", "free_practice", "light", null]);
    expect(regularity.weeks.at(-1)).toMatchObject({ weekStart: "2026-10-19", done: 2, goal: 5 });
    expect(regularity.loads.at(-1)).toEqual({ weekStart: "2026-10-19", load: 280 });
    expect(regularity.ratings.map((r) => [r.date, r.postFatigue])).toEqual([
      ["2026-10-19", 6],
      ["2026-10-21", 4],
    ]);
    expect(regularity.streak.days).toBeGreaterThanOrEqual(3);
  });

  it("only contains the signed-in user's sessions", async () => {
    const owner = await createUser();
    const other = await createUser();
    await session(owner, "bet", "2026-10-19T08:00:00Z", { load: 240, postFatigue: 6 });

    const theirs = await getRegularity(db, other, NOW);
    expect(theirs.calendar.flat().every((d) => d.kind === null)).toBe(true);
    expect(theirs.loads.every((w) => w.load === 0)).toBe(true);
    expect(theirs.ratings).toEqual([]);
    expect(theirs.streak.days).toBe(0);
  });
});
