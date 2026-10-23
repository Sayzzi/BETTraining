// Regularity: activity calendar, day streak (planned rest days keep it going),
// weekly goal per week, and weekly completed load with a spike warning.

import { addDays, recommendToday, weekStart, type DaySession, type Preferences } from "./weekly-plan";

export type ActivityKind = "bet" | "light" | "free_practice" | "assessment";

/** Completed sessions of a day, any kind. */
export type ActivityDay = { date: string; kinds: ActivityKind[] };

/** Planned rest: a day without a session the plan had marked as rest. */
function plannedRest(date: string, planSessions: DaySession[], preferences: Preferences) {
  const before = planSessions.filter((s) => s.date < date);
  return recommendToday(date, before, preferences).kind === "rest";
}

/**
 * Consecutive days up to today with a session of any kind or a planned rest. Today counts
 * once trained or when rest is planned, and cannot break the streak before it is over.
 */
export function computeStreak(
  today: string,
  planSessions: DaySession[],
  activeDates: string[],
  preferences: Preferences,
): { days: number; restDays: number } {
  const active = new Set(activeDates);
  let days = 0;
  let restDays = 0;
  let date = active.has(today) || plannedRest(today, planSessions, preferences) ? today : addDays(today, -1);
  // Stop at the first activity: a rest before ever training is no streak.
  const first = [...active].sort()[0];
  while (first !== undefined && date >= first) {
    if (active.has(date)) days++;
    else if (plannedRest(date, planSessions, preferences)) {
      days++;
      restDays++;
    } else break;
    date = addDays(date, -1);
  }
  return { days, restDays };
}

export type WeekGoal = { weekStart: string; done: number; goal: number; reached: boolean };

/** BET and light sessions against the weekly goal, for the last `weeks` weeks, oldest first. */
export function weeklyGoals(today: string, planSessions: DaySession[], preferences: Preferences, weeks: number): WeekGoal[] {
  const current = weekStart(today);
  return Array.from({ length: weeks }, (_, i) => {
    const start = addDays(current, -7 * (weeks - 1 - i));
    const done = planSessions.filter((s) => weekStart(s.date) === start).length;
    return { weekStart: start, done, goal: preferences.weeklyGoal, reached: done >= preferences.weeklyGoal };
  });
}

export type CalendarDay = {
  date: string;
  /** Main activity of the day: assessment, then BET, light, free practice. */
  kind: ActivityKind | null;
  plannedRest: boolean;
  future: boolean;
};

const PRIORITY: ActivityKind[] = ["assessment", "bet", "light", "free_practice"];

/** The last `weeks` weeks, Monday to Sunday, oldest first. */
export function calendarWeeks(
  today: string,
  weeks: number,
  activity: ActivityDay[],
  planSessions: DaySession[],
  preferences: Preferences,
): CalendarDay[][] {
  const first = addDays(weekStart(today), -7 * (weeks - 1));
  const byDate = new Map(activity.map((day) => [day.date, day.kinds]));
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = addDays(first, w * 7 + d);
      const kinds = byDate.get(date) ?? [];
      const kind = PRIORITY.find((k) => kinds.includes(k)) ?? null;
      const future = date > today;
      return { date, kind, future, plannedRest: !kind && !future && date < today && plannedRest(date, planSessions, preferences) };
    }),
  );
}

export type WeekLoad = { weekStart: string; load: number };

/** Completed load summed per week, for the last `weeks` weeks, oldest first. */
export function weeklyLoads(today: string, sessions: { date: string; load: number }[], weeks: number): WeekLoad[] {
  const current = weekStart(today);
  return Array.from({ length: weeks }, (_, i) => {
    const start = addDays(current, -7 * (weeks - 1 - i));
    const load = sessions.filter((s) => weekStart(s.date) === start).reduce((sum, s) => sum + s.load, 0);
    return { weekStart: start, load };
  });
}

/** A week this much above the previous three weeks' average is a sign of overreaching. */
export const LOAD_SPIKE_RATIO = 1.5;

export function loadSpike(loads: WeekLoad[], ratio = LOAD_SPIKE_RATIO): boolean {
  if (loads.length < 4) return false;
  const latest = loads.at(-1)!.load;
  const previous = loads.slice(-4, -1);
  const average = previous.reduce((sum, w) => sum + w.load, 0) / previous.length;
  return average > 0 && latest > average * ratio;
}
