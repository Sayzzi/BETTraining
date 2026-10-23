import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db/client";
import { userPreferences } from "@/db/schema";
import { BET_DURATIONS_MIN } from "@/engine/session-plan";
import { DEFAULT_PREFERENCES, type Preferences } from "@/engine/weekly-plan";

export const DEFAULT_TIME_ZONE = "Europe/Paris";

export type UserPreferences = Preferences & { timeZone: string };

function isTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const preferencesInput = z
  .object({
    betSessionsPerWeek: z.union([z.literal(3), z.literal(4), z.literal(5)]),
    defaultDurationMin: z.union(BET_DURATIONS_MIN.map((value) => z.literal(value))),
    weeklyGoal: z.number().int().max(7),
    timeZone: z.string().max(64).refine(isTimeZone),
  })
  .refine((value) => value.weeklyGoal >= value.betSessionsPerWeek, { path: ["weeklyGoal"] });

export async function getPreferences(db: Database, userId: string): Promise<UserPreferences> {
  const [row] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));
  if (!row) return { ...DEFAULT_PREFERENCES, timeZone: DEFAULT_TIME_ZONE };
  return {
    betSessionsPerWeek: row.betSessionsPerWeek as Preferences["betSessionsPerWeek"],
    defaultDurationMin: row.defaultDurationMin as Preferences["defaultDurationMin"],
    weeklyGoal: row.weeklyGoal,
    timeZone: row.timeZone,
  };
}

export async function savePreferences(db: Database, userId: string, input: unknown): Promise<UserPreferences> {
  const preferences = preferencesInput.parse(input);
  await db
    .insert(userPreferences)
    .values({ userId, ...preferences })
    .onConflictDoUpdate({ target: userPreferences.userId, set: preferences });
  return preferences;
}
