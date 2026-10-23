import { describe, expect, it } from "vitest";
import {
  calendarWeeks,
  computeStreak,
  LOAD_SPIKE_RATIO,
  loadSpike,
  weeklyGoals,
  weeklyLoads,
  type ActivityDay,
} from "./regularity";
import { addDays, DEFAULT_PREFERENCES, recommendToday, type DaySession } from "./weekly-plan";

const MONDAY = "2026-10-05";
const PREFS = { ...DEFAULT_PREFERENCES, betSessionsPerWeek: 3 as const, weeklyGoal: 4 };

/** Two weeks of a user doing exactly what the plan recommends; also returns the planned rest days. */
function followPlan(days: number) {
  const sessions: DaySession[] = [];
  const rests: number[] = [];
  for (let day = 0; day < days; day++) {
    const date = addDays(MONDAY, day);
    const { kind } = recommendToday(date, sessions, PREFS);
    if (kind === "rest") rests.push(day);
    else sessions.push({ date, kind });
  }
  return { sessions, rests };
}

const { sessions: followed, rests } = followPlan(13);

describe("streak", () => {
  it("counts consecutive days with a session or a planned rest", () => {
    const today = addDays(MONDAY, 12);
    const streak = computeStreak(today, followed, followed.map((s) => s.date), PREFS);
    expect(rests.length).toBeGreaterThan(0);
    expect(streak).toEqual({ days: 13, restDays: rests.length });
  });

  it("breaks on a day with neither a session nor a planned rest", () => {
    // Skip the second Monday's BET session.
    const skipped = addDays(MONDAY, 7);
    const sessions = followed.filter((s) => s.date !== skipped);
    const streak = computeStreak(addDays(MONDAY, 12), sessions, sessions.map((s) => s.date), PREFS);
    expect(streak.days).toBe(5);
  });

  it("does not break on today before it is over, and counts it when rest is planned", () => {
    const today = addDays(MONDAY, 13);
    const restToday = recommendToday(today, followed, PREFS).kind === "rest";
    expect(computeStreak(today, followed, followed.map((s) => s.date), PREFS).days).toBe(restToday ? 14 : 13);
  });

  it("counts free practice and assessments as active days", () => {
    const today = addDays(MONDAY, 1);
    // Monday BET, Tuesday free practice only.
    const plan = [{ date: MONDAY, kind: "bet" as const }];
    expect(computeStreak(today, plan, [MONDAY, today], PREFS)).toEqual({ days: 2, restDays: 0 });
  });

  it("is zero without any activity", () => {
    expect(computeStreak(MONDAY, [], [], PREFS)).toEqual({ days: 0, restDays: 0 });
  });
});

describe("weekly goal", () => {
  it("reports each week's BET and light sessions against the goal", () => {
    const goals = weeklyGoals(addDays(MONDAY, 12), followed, PREFS, 3);
    expect(goals).toEqual([
      { weekStart: addDays(MONDAY, -7), done: 0, goal: 4, reached: false },
      { weekStart: MONDAY, done: 4, goal: 4, reached: true },
      { weekStart: addDays(MONDAY, 7), done: 4, goal: 4, reached: true },
    ]);
  });
});

describe("calendar", () => {
  it("lays out weeks from Monday with each day's activity and planned rest", () => {
    const activity: ActivityDay[] = [
      { date: MONDAY, kinds: ["bet"] },
      { date: addDays(MONDAY, 1), kinds: ["free_practice"] },
      { date: addDays(MONDAY, 2), kinds: ["assessment", "free_practice"] },
    ];
    const weeks = calendarWeeks(addDays(MONDAY, 2), 2, activity, [{ date: MONDAY, kind: "bet" }], PREFS);
    expect(weeks).toHaveLength(2);
    expect(weeks[1].map((d) => d.date)[0]).toBe(MONDAY);
    expect(weeks[1].slice(0, 4).map((d) => [d.kind, d.future])).toEqual([
      ["bet", false],
      ["free_practice", false],
      ["assessment", false],
      [null, true],
    ]);
    // The previous week had nothing, and the plan had BET due: no planned rest there.
    expect(weeks[0].every((d) => d.kind === null && !d.plannedRest)).toBe(true);
  });

  it("marks planned rest days", () => {
    const weeks = calendarWeeks(addDays(MONDAY, 7), 1, [], followed, PREFS);
    // Last week, seen from the next Monday: every planned rest of that week, nothing else.
    const lastWeek = calendarWeeks(addDays(MONDAY, 7), 2, [], followed, PREFS)[0];
    expect(lastWeek.filter((d) => d.plannedRest).map((d) => d.date)).toEqual(
      rests.filter((day) => day < 7).map((day) => addDays(MONDAY, day)),
    );
    expect(weeks[0][0].plannedRest).toBe(false);
  });
});

describe("load", () => {
  it("sums each week's completed load", () => {
    const loads = weeklyLoads(
      addDays(MONDAY, 8),
      [
        { date: MONDAY, load: 200 },
        { date: addDays(MONDAY, 2), load: 150 },
        { date: addDays(MONDAY, 8), load: 300 },
      ],
      3,
    );
    expect(loads).toEqual([
      { weekStart: addDays(MONDAY, -7), load: 0 },
      { weekStart: MONDAY, load: 350 },
      { weekStart: addDays(MONDAY, 7), load: 300 },
    ]);
  });

  it("flags a week well above the previous weeks' average", () => {
    const week = (load: number) => ({ weekStart: MONDAY, load });
    expect(loadSpike([week(200), week(200), week(200), week(200 * LOAD_SPIKE_RATIO + 1)])).toBe(true);
    expect(loadSpike([week(200), week(200), week(200), week(250)])).toBe(false);
    expect(loadSpike([week(0), week(0), week(0), week(300)])).toBe(false);
  });
});
