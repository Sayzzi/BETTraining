// Catalogue of exercises the player can run. Grows with each exercise ticket.

import { PVT_B, pvtStandard, type PvtConfig } from "./pvt";
import { computeRtResults, type RtResults } from "./results";
import type { Trial } from "./trial";

export type ExerciseId = "pvt" | "pvt_b";

export const FREE_PRACTICE_EXERCISES = ["pvt"] as const satisfies readonly ExerciseId[];
export type FreePracticeExercise = (typeof FREE_PRACTICE_EXERCISES)[number];

export const FREE_PRACTICE_DURATIONS_MIN = [3, 5, 10] as const;

export function exerciseConfig(exercise: ExerciseId, durationMin: number): PvtConfig {
  return exercise === "pvt_b" ? PVT_B : pvtStandard(durationMin * 60_000);
}

export function computeExerciseResults(config: PvtConfig, trials: Trial[]): RtResults {
  return computeRtResults(trials, { lapseThresholdMs: config.lapseThresholdMs });
}
