// Plans a BET session from the chosen duration and the user's history:
// a PVT-B fatigue check, a targeted block of short exercises done fresh,
// the BET block (about two thirds of the session, long and demanding),
// then a closing fatigue check.

import { EXERCISES, exerciseConfigFor, type CognitiveDomain, type ExerciseConfig, type ExerciseId } from "./exercises";
import { PVT_B } from "./pvt";
import type { RtResults } from "./results";

export const BET_DURATIONS_MIN = [30, 45, 60] as const;
export type BetDuration = (typeof BET_DURATIONS_MIN)[number];

export type SessionBlock = "fatigue_open" | "targeted" | "bet" | "fatigue_close";

export type PlannedStep = {
  position: number;
  block: SessionBlock;
  exercise: ExerciseId;
  /** Domain a targeted exercise trains; null elsewhere. */
  domain: CognitiveDomain | null;
  config: ExerciseConfig;
  /** Key of the saved difficulty level this run reads and updates; null without difficulty. */
  difficultyKey: string | null;
};

export type BetHistory = {
  /** BET sessions already started, used to rotate the targeted domains. */
  betSessionCount: number;
  /** Exercises of the previous session's BET block, never repeated back to back. */
  previousBetExercises: ExerciseId[];
};

const BET_SHARE = 0.65;
const SINGLE_BET_EXERCISE_MAX_MIN = 25;
const TARGETED_EXERCISE_MIN = 3;
export const BET_TARGET = 0.95;
const TARGETED_TARGET = 0.8;

// BET rotation order; Stroop first, as in most BET studies.
const BET_EXERCISES: ExerciseId[] = ["stroop", "flanker", "nback", "pvt"];

// Incongruent Stroop is the classic BET task; flanker keeps some congruent trials
// so the flankers cannot simply be read in reverse.
const BET_INCONGRUENT_RATE: Partial<Record<ExerciseId, number>> = { stroop: 1, flanker: 0.75 };

const DOMAIN_ORDER: CognitiveDomain[] = ["sustained_attention", "working_memory", "inhibition", "processing_speed"];
const DOMAIN_EXERCISES: Record<CognitiveDomain, ExerciseId[]> = {
  sustained_attention: ["pvt"],
  working_memory: ["nback"],
  inhibition: ["stroop", "flanker"],
  processing_speed: ["choice_rt", "symbol_digit"],
};

export function planBetSession(durationMin: BetDuration, history: BetHistory, timeScale = 1): PlannedStep[] {
  const checkMin = PVT_B.durationMs / 60_000;
  const betMin = Math.round(durationMin * BET_SHARE);
  const targetedMin = durationMin - 2 * checkMin - betMin;
  const targetedCount = Math.max(1, Math.round(targetedMin / TARGETED_EXERCISE_MIN));

  const minutesToMs = (minutes: number) => Math.round(minutes * 60_000 * timeScale);
  const steps: Omit<PlannedStep, "position">[] = [];

  steps.push(fatigueCheck("fatigue_open", minutesToMs(checkMin)));

  for (let slot = 0; slot < targetedCount; slot++) {
    // Consecutive slots across sessions walk the domain order, so each domain gets an equal share.
    const turn = history.betSessionCount * targetedCount + slot;
    const domain = DOMAIN_ORDER[turn % DOMAIN_ORDER.length];
    const choices = DOMAIN_EXERCISES[domain];
    const exercise = choices[Math.floor(turn / DOMAIN_ORDER.length) % choices.length];
    steps.push({
      block: "targeted",
      exercise,
      domain,
      config: withoutPractice(exerciseConfigFor(exercise, minutesToMs(targetedMin / targetedCount), TARGETED_TARGET)),
      difficultyKey: EXERCISES[exercise].difficulty ? exercise : null,
    });
  }

  const betExercises = pickBetExercises(betMin > SINGLE_BET_EXERCISE_MAX_MIN ? 2 : 1, history.previousBetExercises);
  for (const exercise of betExercises) {
    const config = withoutPractice(exerciseConfigFor(exercise, minutesToMs(betMin / betExercises.length), BET_TARGET));
    const pinned = BET_INCONGRUENT_RATE[exercise];
    steps.push({
      block: "bet",
      exercise,
      domain: null,
      config: pinned === undefined ? config : { ...config, fixedIncongruentRate: pinned },
      // A separate level: 95 % would otherwise drag down the 80 % free-practice level.
      difficultyKey: EXERCISES[exercise].difficulty ? `${exercise}:bet` : null,
    });
  }

  steps.push(fatigueCheck("fatigue_close", minutesToMs(checkMin)));
  return steps.map((step, position) => ({ position, ...step }));
}

function pickBetExercises(count: number, previous: ExerciseId[]): ExerciseId[] {
  const fresh = BET_EXERCISES.filter((exercise) => !previous.includes(exercise));
  return (fresh.length >= count ? fresh : BET_EXERCISES).slice(0, count);
}

function fatigueCheck(block: "fatigue_open" | "fatigue_close", durationMs: number): Omit<PlannedStep, "position"> {
  return { block, exercise: "pvt_b", domain: null, config: { ...PVT_B, durationMs }, difficultyKey: null };
}

function withoutPractice(config: ExerciseConfig): ExerciseConfig {
  return "practiceScoredTrials" in config ? { ...config, practiceScoredTrials: 0 } : { ...config, practiceTrials: 0 };
}

/** Completed load: perceived effort (0-10) times the session's duration in minutes. */
export function sessionLoad(perceivedEffort: number, durationMin: number) {
  return perceivedEffort * durationMin;
}

/** How the closing fatigue check compares with the opening one; positive means slower or more lapses. */
export function fatigueCheckChange(open: RtResults | null, close: RtResults | null) {
  if (!open || !close || open.meanRtMs === null || close.meanRtMs === null) return null;
  return { meanRtChangeMs: close.meanRtMs - open.meanRtMs, lapsesChange: close.lapses - open.lapses };
}
