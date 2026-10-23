// Chooses today's session from the week so far (Monday to Sunday): a BET
// session while some are still due (never two days running unless catching
// up), a light session until the weekly goal is met, rest otherwise.
// Free practice is not counted here: it never replaces today's session.

import type { BetDuration } from "./session-plan";

export type Preferences = {
  betSessionsPerWeek: 3 | 4 | 5;
  defaultDurationMin: BetDuration;
  /** Sessions per week, BET and light together. */
  weeklyGoal: number;
};

export const DEFAULT_PREFERENCES: Preferences = { betSessionsPerWeek: 4, defaultDurationMin: 30, weeklyGoal: 5 };

/** A completed BET or light session on a local calendar day (YYYY-MM-DD). */
export type DaySession = { date: string; kind: "bet" | "light" };

export type DailyRecommendation = {
  kind: "bet" | "light" | "rest";
  /** True once today's session is completed; kind is then the session done. */
  done: boolean;
  week: { betDone: number; betTarget: number; lightDone: number; goal: number; daysLeft: number };
};

export function recommendToday(today: string, completed: DaySession[], preferences: Preferences): DailyRecommendation {
  const monday = weekStart(today);
  const thisWeek = completed.filter((s) => weekStart(s.date) === monday);
  const betDone = thisWeek.filter((s) => s.kind === "bet").length;
  const lightDone = thisWeek.filter((s) => s.kind === "light").length;
  // Days left in the week, today included (Monday: 7, Sunday: 1).
  const daysLeft = 7 - daysBetween(monday, today);
  const week = { betDone, betTarget: preferences.betSessionsPerWeek, lightDone, goal: preferences.weeklyGoal, daysLeft };

  const todays = thisWeek.find((s) => s.date === today);
  if (todays) return { kind: todays.kind, done: true, week };

  const betLeft = preferences.betSessionsPerWeek - betDone;
  // Across the week boundary too: Sunday then Monday would be two days running.
  const betYesterday = completed.some((s) => s.date === addDays(today, -1) && s.kind === "bet");
  const mustCatchUp = betLeft >= daysLeft;
  if (betLeft > 0 && (mustCatchUp || !betYesterday)) return { kind: "bet", done: false, week };

  const lightSlots = Math.max(0, preferences.weeklyGoal - preferences.betSessionsPerWeek);
  // Keep enough days for the BET sessions still due.
  const spareDays = daysLeft - Math.max(0, betLeft);
  if (lightDone < lightSlots && spareDays > 0) return { kind: "light", done: false, week };
  return { kind: "rest", done: false, week };
}

/** Monday of the date's week. */
export function weekStart(date: string): string {
  const weekday = (parse(date).getUTCDay() + 6) % 7; // Monday = 0
  return addDays(date, -weekday);
}

export function addDays(date: string, days: number): string {
  const value = parse(date);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string) {
  return Math.round((parse(to).getTime() - parse(from).getTime()) / 86_400_000);
}

function parse(date: string) {
  return new Date(`${date}T00:00:00Z`);
}

/** A moment's calendar day (YYYY-MM-DD) in a time zone. */
export function localDate(moment: Date, timeZone: string): string {
  // The Canadian English locale formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(moment);
}
