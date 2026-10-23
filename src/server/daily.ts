import { and, desc, eq, gte, inArray } from "drizzle-orm";
import type { Database } from "@/db/client";
import { trainingSession } from "@/db/schema";
import { localDate, recommendToday, type DailyRecommendation } from "@/engine/weekly-plan";
import { getPreferences } from "./preferences";

export type DailySession = DailyRecommendation & {
  today: string;
  /** Today's completed session, for a link to its summary. */
  todaysSessionId: string | null;
};

/** Today's session from the BET and light sessions completed this week; free practice never counts. */
export async function getDailySession(db: Database, userId: string, now = new Date()): Promise<DailySession> {
  const preferences = await getPreferences(db, userId);
  const rows = await db
    .select({ id: trainingSession.id, kind: trainingSession.kind, startedAt: trainingSession.startedAt })
    .from(trainingSession)
    .where(
      and(
        eq(trainingSession.userId, userId),
        eq(trainingSession.status, "completed"),
        inArray(trainingSession.kind, ["bet", "light"]),
        // Enough to cover this week and yesterday, whatever the time zone.
        gte(trainingSession.startedAt, new Date(now.getTime() - 9 * 86_400_000)),
      ),
    )
    .orderBy(desc(trainingSession.startedAt));

  const today = localDate(now, preferences.timeZone);
  const sessions = rows.map((row) => ({
    id: row.id,
    date: localDate(row.startedAt, preferences.timeZone),
    kind: row.kind as "bet" | "light",
  }));
  return {
    ...recommendToday(today, sessions, preferences),
    today,
    todaysSessionId: sessions.find((s) => s.date === today)?.id ?? null,
  };
}
