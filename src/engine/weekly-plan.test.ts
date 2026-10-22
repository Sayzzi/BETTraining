import { describe, expect, it } from "vitest";
import { addDays, DEFAULT_PREFERENCES, recommendToday, weekStart, type DaySession, type Preferences } from "./weekly-plan";

const MONDAY = "2026-10-19";

/** Follows the recommendation every day for several weeks; `skip` lists days the user does nothing. */
function simulate(preferences: Preferences, weeks: number, skip: (day: number) => boolean = () => false) {
  const done: DaySession[] = [];
  const days: { date: string; kind: string }[] = [];
  for (let day = 0; day < weeks * 7; day++) {
    const date = addDays(MONDAY, day);
    const recommendation = recommendToday(date, done, preferences);
    days.push({ date, kind: recommendation.kind });
    if (!skip(day) && recommendation.kind !== "rest") done.push({ date, kind: recommendation.kind });
  }
  return { done, days };
}

function perWeek(done: DaySession[], kind: DaySession["kind"]) {
  const counts = new Map<string, number>();
  for (const session of done.filter((s) => s.kind === kind)) {
    counts.set(weekStart(session.date), (counts.get(weekStart(session.date)) ?? 0) + 1);
  }
  return [...counts.values()];
}

describe("dates", () => {
  it("starts weeks on Monday", () => {
    expect(weekStart("2026-10-19")).toBe("2026-10-19");
    expect(weekStart("2026-10-25")).toBe("2026-10-19");
    expect(weekStart("2026-10-26")).toBe("2026-10-26");
  });

  it("adds days across months", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
  });
});

describe("today's session", () => {
  it.each([3, 4, 5] as const)("plans exactly %i BET sessions a week when followed", (betSessionsPerWeek) => {
    const { done } = simulate({ ...DEFAULT_PREFERENCES, betSessionsPerWeek, weeklyGoal: 6 }, 4);
    expect(perWeek(done, "bet")).toEqual([betSessionsPerWeek, betSessionsPerWeek, betSessionsPerWeek, betSessionsPerWeek]);
  });

  /** Consecutive BET days, counted per week of the second day. */
  function backToBack(days: { date: string; kind: string }[]) {
    const pairs = new Map<string, number>();
    days.slice(1).forEach((day, i) => {
      if (day.kind === "bet" && days[i].kind === "bet") {
        pairs.set(weekStart(day.date), (pairs.get(weekStart(day.date)) ?? 0) + 1);
      }
    });
    return pairs;
  }

  it("never schedules BET two days in a row with 3 a week", () => {
    const { days } = simulate({ ...DEFAULT_PREFERENCES, betSessionsPerWeek: 3, weeklyGoal: 6 }, 6);
    expect(backToBack(days).size).toBe(0);
  });

  it("keeps back-to-back BET days to at most one pair a week with 4 a week", () => {
    // Four non-adjacent days a week cannot hold week after week (8 in 14 days), so one pair is unavoidable.
    const { days } = simulate({ ...DEFAULT_PREFERENCES, betSessionsPerWeek: 4, weeklyGoal: 6 }, 6);
    expect(Math.max(0, ...backToBack(days).values())).toBeLessThanOrEqual(1);
  });

  it("fills the weekly goal with light sessions and rests the other days", () => {
    const { done, days } = simulate({ ...DEFAULT_PREFERENCES, betSessionsPerWeek: 4, weeklyGoal: 6 }, 3);
    expect(perWeek(done, "light")).toEqual([2, 2, 2]);
    expect(days.filter((d) => d.kind === "rest")).toHaveLength(3);
  });

  it("does not offer light sessions when the goal equals the BET sessions", () => {
    const { done } = simulate({ ...DEFAULT_PREFERENCES, betSessionsPerWeek: 4, weeklyGoal: 4 }, 2);
    expect(perWeek(done, "light")).toEqual([]);
  });

  it("catches up on missed days so the week still gets its BET sessions", () => {
    // Nothing done Monday to Wednesday.
    const { done } = simulate({ ...DEFAULT_PREFERENCES, betSessionsPerWeek: 4, weeklyGoal: 4 }, 1, (day) => day < 3);
    expect(perWeek(done, "bet")).toEqual([4]);
  });

  it("marks the day done once a BET or light session is completed today", () => {
    const today = addDays(MONDAY, 2);
    expect(recommendToday(today, [{ date: today, kind: "light" }], DEFAULT_PREFERENCES)).toMatchObject({
      kind: "light",
      done: true,
    });
  });

  it("reports the week's progress", () => {
    const today = addDays(MONDAY, 3);
    const recommendation = recommendToday(
      today,
      [
        { date: MONDAY, kind: "bet" },
        { date: addDays(MONDAY, 1), kind: "light" },
        { date: addDays(MONDAY, -2), kind: "bet" }, // previous week, ignored
      ],
      DEFAULT_PREFERENCES,
    );
    expect(recommendation.week).toEqual({ betDone: 1, betTarget: 4, lightDone: 1, goal: 5, daysLeft: 4 });
  });
});
