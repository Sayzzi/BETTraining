// Level per cognitive domain over time: the difficulty level held in the
// adaptive exercises (where the staircase keeps ~80 % success), replayed from
// each run's raw trials and averaged over the domain's latest runs.

import {
  DOMAINS,
  EXERCISES,
  finalLevel,
  type CognitiveDomain,
  type ExerciseConfig,
  type ExerciseId,
} from "./exercises";
import type { Trial } from "./trial";

/** Runs averaged into each point of a domain's curve. */
export const LEVEL_WINDOW = 5;

export type LevelRun = {
  /** Local calendar day (YYYY-MM-DD). */
  date: string;
  exercise: ExerciseId;
  config: ExerciseConfig;
  startLevel: number;
  trials: Trial[];
};

export type LevelPoint = { date: string; level: number };

/** The level a run ended on, replayed from its raw trials. */
export function runEndLevel(run: LevelRun): number | null {
  return finalLevel(run.config, run.startLevel, run.trials);
}

export function domainLevelSeries(
  runs: LevelRun[],
  window = LEVEL_WINDOW,
): Record<CognitiveDomain, LevelPoint[]> {
  const ordered = [...runs].sort((a, b) => a.date.localeCompare(b.date));
  return Object.fromEntries(
    DOMAINS.map((domain) => {
      const levels: { date: string; level: number }[] = [];
      for (const run of ordered) {
        if (!EXERCISES[run.exercise].domains.includes(domain)) continue;
        const level = runEndLevel(run);
        if (level !== null) levels.push({ date: run.date, level });
      }
      // One point per day: the mean of the latest runs up to that day's last run.
      const points: LevelPoint[] = [];
      levels.forEach((entry, i) => {
        if (levels[i + 1]?.date === entry.date) return;
        const recent = levels.slice(Math.max(0, i + 1 - window), i + 1);
        points.push({ date: entry.date, level: recent.reduce((sum, r) => sum + r.level, 0) / recent.length });
      });
      return [domain, points];
    }),
  ) as Record<CognitiveDomain, LevelPoint[]>;
}
