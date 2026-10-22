// Catalogue of exercises: what each one trains, whether it can serve in the
// BET block, and how its difficulty moves. Grows with each exercise ticket.

import type { ChoiceTaskConfig } from "./choice-task";
import { CHOICE_RT_LEVELS, CHOICE_RT_SPEC, choiceRtConfig } from "./choice-rt";
import { replayLevel, staircaseFor } from "./difficulty";
import { FLANKER_LEVELS, FLANKER_SPEC, flankerConfig } from "./flanker";
import { NBACK_LEVELS, nBackConfig, nBackParameters, type NBackConfig } from "./nback";
import { PVT_B, pvtStandard, type PvtConfig } from "./pvt";
import { computeRtResults, type RtResults } from "./results";
import { STROOP_LEVELS, STROOP_SPEC, stroopConfig } from "./stroop";
import { SYMBOL_DIGIT_LEVELS, symbolDigitConfig, symbolDigitParameters } from "./symbol-digit";
import type { Trial } from "./trial";

export type CognitiveDomain = "sustained_attention" | "working_memory" | "processing_speed" | "inhibition";

export type ExerciseId = "pvt" | "pvt_b" | "nback" | "stroop" | "flanker" | "choice_rt" | "symbol_digit";

export type ExerciseDefinition = {
  id: ExerciseId;
  domains: CognitiveDomain[];
  /** Long, demanding versions can fill the BET block. */
  betEligible: boolean;
  /** Level bounds and the parameters a level changes, or null when the exercise has no difficulty. */
  difficulty: { min: number; max: number; initial: number; levers: string[] } | null;
};

export const EXERCISES: Record<ExerciseId, ExerciseDefinition> = {
  pvt: { id: "pvt", domains: ["sustained_attention"], betEligible: true, difficulty: null },
  // The 3-minute fatigue check that opens and closes each BET session.
  pvt_b: { id: "pvt_b", domains: ["sustained_attention"], betEligible: false, difficulty: null },
  nback: {
    id: "nback",
    domains: ["working_memory"],
    betEligible: true,
    difficulty: { ...NBACK_LEVELS, levers: ["n", "pace"] },
  },
  stroop: {
    id: "stroop",
    domains: ["inhibition"],
    betEligible: true,
    difficulty: { ...STROOP_LEVELS, levers: ["incongruentRate", "responseWindow", "interTrialInterval"] },
  },
  flanker: {
    id: "flanker",
    domains: ["inhibition", "sustained_attention"],
    betEligible: true,
    difficulty: { ...FLANKER_LEVELS, levers: ["incongruentRate", "responseWindow", "interTrialInterval"] },
  },
  // Short speed drills: they train processing speed but are not used in the BET block.
  choice_rt: {
    id: "choice_rt",
    domains: ["processing_speed"],
    betEligible: false,
    difficulty: { ...CHOICE_RT_LEVELS, levers: ["responseWindow", "interTrialInterval"] },
  },
  symbol_digit: {
    id: "symbol_digit",
    domains: ["processing_speed"],
    betEligible: false,
    difficulty: { ...SYMBOL_DIGIT_LEVELS, levers: ["responseWindow", "interTrialInterval"] },
  },
};

export const FREE_PRACTICE_EXERCISES = [
  "pvt",
  "nback",
  "stroop",
  "flanker",
  "choice_rt",
  "symbol_digit",
] as const satisfies readonly ExerciseId[];
export type FreePracticeExercise = (typeof FREE_PRACTICE_EXERCISES)[number];

export const FREE_PRACTICE_DURATIONS_MIN = [3, 5, 10] as const;

/** Success rate targeted by adaptive difficulty outside the BET block. */
export const FREE_PRACTICE_TARGET = 0.8;

export type ExerciseConfig = PvtConfig | NBackConfig | ChoiceTaskConfig;

export function exerciseConfig(exercise: ExerciseId, durationMin: number): ExerciseConfig {
  return exerciseConfigFor(exercise, exercise === "pvt_b" ? PVT_B.durationMs : durationMin * 60_000);
}

/** Configuration for an exact duration, used by fixed protocols such as the assessment. */
export function exerciseConfigFor(exercise: ExerciseId, durationMs: number, target = FREE_PRACTICE_TARGET): ExerciseConfig {
  switch (exercise) {
    case "pvt_b":
      return { ...PVT_B, durationMs };
    case "pvt":
      return pvtStandard(durationMs);
    case "nback":
      return nBackConfig(durationMs, target);
    case "stroop":
      return stroopConfig(durationMs, target);
    case "flanker":
      return flankerConfig(durationMs, target);
    case "choice_rt":
      return choiceRtConfig(durationMs, target);
    case "symbol_digit":
      return symbolDigitConfig(durationMs, target);
  }
}

export function computeExerciseResults(config: ExerciseConfig, trials: Trial[]): RtResults {
  return computeRtResults(trials, { lapseThresholdMs: "lapseThresholdMs" in config ? config.lapseThresholdMs : null });
}

/** Level reached at the end of a run, replayed from its counted trials. Null without difficulty. */
export function finalLevel(config: ExerciseConfig, startLevel: number | null, trials: Trial[]): number | null {
  if (startLevel === null || !("target" in config) || config.adaptive === false) return null;
  const staircase = staircaseFor(config.target, { min: config.minLevel, max: config.maxLevel });
  return replayLevel(
    startLevel,
    trials.filter((t) => !t.practice).map((t) => t.correct),
    staircase,
  );
}

export type DifficultySnapshot = { level: number } & Record<string, number>;

/** Level plus the parameters it sets, as stored with a run. */
export function describeDifficulty(exercise: ExerciseId, level: number): DifficultySnapshot {
  switch (exercise) {
    case "nback":
      return { level, ...nBackParameters(level) };
    case "stroop":
      return { level, ...STROOP_SPEC.parameters(level) };
    case "flanker":
      return { level, ...FLANKER_SPEC.parameters(level) };
    case "choice_rt":
      return { level, ...CHOICE_RT_SPEC.parameters(level) };
    case "symbol_digit":
      return { level, ...symbolDigitParameters(level) };
    default:
      return { level };
  }
}
