// Regularity data for the dashboard: calendar, streak, weekly goals, weekly
// load and self-ratings, over the last weeks of completed sessions.

import { and, asc, eq, gte } from "drizzle-orm";
import type { Database } from "@/db/client";
import { trainingSession } from "@/db/schema";
import {
  calendarWeeks,
  computeStreak,
  loadSpike,
  weeklyGoals,
  weeklyLoads,
  type ActivityDay,
  type ActivityKind,
  type CalendarDay,
  type WeekGoal,
  type WeekLoad,
} from "@/engine/regularity";
import { localDate, type DaySession } from "@/engine/weekly-plan";
import { getPreferences } from "./preferences";

export const DASHBOARD_WEEKS = 8;

export type RatingPoint = {
  date: string;
  preFatigue: number | null;
  postFatigue: number | null;
  perceivedEffort: number | null;
  motivation: number | null;
};

export type Regularity = {
  today: string;
  streak: { days: number; restDays: number };
  weeks: WeekGoal[];
  calendar: CalendarDay[][];
  loads: WeekLoad[];
  loadSpike: boolean;
  ratings: RatingPoint[];
};

export async function getRegularity(db: Database, userId: string, now = new Date()): Promise<Regularity> {
  const preferences = await getPreferences(db, userId);
  const today = localDate(now, preferences.timeZone);
  // A little more than the dashboard, so the streak and the first week's plan see their past.
  const since = new Date(now.getTime() - (DASHBOARD_WEEKS + 4) * 7 * 86_400_000);
  const rows = await db
    .select()
    .from(trainingSession)
    .where(
      and(
        eq(trainingSession.userId, userId),
        eq(trainingSession.status, "completed"),
        gte(trainingSession.startedAt, since),
      ),
    )
    .orderBy(asc(trainingSession.startedAt));

  const sessions = rows.map((row) => ({ ...row, date: localDate(row.startedAt, preferences.timeZone) }));
  const activity = new Map<string, ActivityKind[]>();
  for (const session of sessions) activity.set(session.date, [...(activity.get(session.date) ?? []), session.kind]);
  const activityDays: ActivityDay[] = [...activity.entries()].map(([date, kinds]) => ({ date, kinds }));
  const planSessions: DaySession[] = sessions
    .filter((s) => s.kind === "bet" || s.kind === "light")
    .map((s) => ({ date: s.date, kind: s.kind as "bet" | "light" }));
  const rated = sessions.filter((s) => s.kind === "bet" || s.kind === "light");
  const loads = weeklyLoads(
    today,
    rated.filter((s) => s.sessionLoad !== null).map((s) => ({ date: s.date, load: s.sessionLoad! })),
    DASHBOARD_WEEKS,
  );

  return {
    today,
    streak: computeStreak(today, planSessions, [...activity.keys()], preferences),
    weeks: weeklyGoals(today, planSessions, preferences, DASHBOARD_WEEKS),
    calendar: calendarWeeks(today, DASHBOARD_WEEKS, activityDays, planSessions, preferences),
    loads,
    loadSpike: loadSpike(loads),
    ratings: rated
      .filter((s) => s.date >= loads[0].weekStart && s.postFatigue !== null)
      .map((s) => ({
        date: s.date,
        preFatigue: s.preFatigue,
        postFatigue: s.postFatigue,
        perceivedEffort: s.perceivedEffort,
        motivation: s.motivation,
      })),
  };
}
