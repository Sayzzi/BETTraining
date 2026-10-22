// Plans a BET session from the chosen duration and the user's history:
// a PVT-B fatigue check, a targeted block of short exercises done fresh,
// the BET block (about two thirds of the session, long and demanding),
// then a closing fatigue check.

import { EXERCISES, exerciseConfigFor, type CognitiveDomain, type ExerciseConfig, type ExerciseId } from "./exercises";
import { PVT_B } from "./pvt";
import type { RtResults } from "./results";
import type { Classification } from "./strengths";

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
  /** Strengths and weaknesses from the latest compared assessment; empty before that. */
  classification: Partial<Record<CognitiveDomain, Classification>>;
};

/** Why the session looks the way it does, built only from things the user can see. */
export type PlanExplanation = {
  rankingAvailable: boolean;
  weaknesses: CognitiveDomain[];
  /** Domains of the targeted block, in order (cognitive training, not BET). */
  targetedDomains: CognitiveDomain[];
  betExercises: ExerciseId[];
  /** The previous session's BET exercises, which this session rotates away from. */
  replacedBetExercises: ExerciseId[];
};

export type BetSessionPlan = { steps: PlannedStep[]; explanation: PlanExplanation };

export type PlanOptions = {
  /** Targeted slots a weakness gets for each slot of a strength (2:1 by default). */
  weaknessWeight?: number;
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

export function planBetSession(
  durationMin: BetDuration,
  history: BetHistory,
  timeScale = 1,
  { weaknessWeight = WEAKNESS_WEIGHT }: PlanOptions = {},
): BetSessionPlan {
  const checkMin = PVT_B.durationMs / 60_000;
  const betMin = Math.round(durationMin * BET_SHARE);
  const targetedMin = durationMin - 2 * checkMin - betMin;
  const targetedCount = Math.max(1, Math.round(targetedMin / TARGETED_EXERCISE_MIN));

  const minutesToMs = (minutes: number) => Math.round(minutes * 60_000 * timeScale);
  const steps: Omit<PlannedStep, "position">[] = [];

  steps.push(fatigueCheck("fatigue_open", minutesToMs(checkMin)));

  steps.push(
    ...targetedSteps(
      history.classification,
      weaknessWeight,
      history.betSessionCount * targetedCount,
      targetedCount,
      minutesToMs(targetedMin / targetedCount),
    ),
  );

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

  const planned = steps.map((step, position) => ({ position, ...step }));
  const weaknesses = DOMAIN_ORDER.filter((domain) => history.classification[domain] === "weakness");
  return {
    steps: planned,
    explanation: {
      rankingAvailable: Object.keys(history.classification).length > 0,
      weaknesses,
      targetedDomains: planned.filter((s) => s.block === "targeted").map((s) => s.domain!),
      betExercises: betExercises,
      replacedBetExercises: history.previousBetExercises.filter((e) => !betExercises.includes(e)),
    },
  };
}

const WEAKNESS_WEIGHT = 2;

export const LIGHT_SESSION_MIN = 10;
const LIGHT_EXERCISES = 3;
// A light session is mostly about weaknesses.
const LIGHT_WEAKNESS_WEIGHT = 3;

export type LightHistory = {
  /** Light sessions already started, to rotate their targeted domains. */
  lightSessionCount: number;
  classification: BetHistory["classification"];
};

/** A short session for days without BET: a few targeted exercises, no BET block, no fatigue checks. */
export function planLightSession(history: LightHistory, timeScale = 1): BetSessionPlan {
  const steps = targetedSteps(
    history.classification,
    LIGHT_WEAKNESS_WEIGHT,
    history.lightSessionCount * LIGHT_EXERCISES,
    LIGHT_EXERCISES,
    Math.round(((LIGHT_SESSION_MIN * 60_000) / LIGHT_EXERCISES) * timeScale),
  ).map((step, position) => ({ position, ...step }));
  return {
    steps,
    explanation: {
      rankingAvailable: Object.keys(history.classification).length > 0,
      weaknesses: DOMAIN_ORDER.filter((domain) => history.classification[domain] === "weakness"),
      targetedDomains: steps.map((s) => s.domain!),
      betExercises: [],
      replacedBetExercises: [],
    },
  };
}

/**
 * Targeted exercises for consecutive turns of the weighted domain cycle: turns continue
 * from one session to the next, so each domain's share holds over time.
 */
function targetedSteps(
  classification: BetHistory["classification"],
  weaknessWeight: number,
  firstTurn: number,
  count: number,
  durationMs: number,
): Omit<PlannedStep, "position">[] {
  const cycle = targetedCycle(classification, weaknessWeight);
  return Array.from({ length: count }, (_, slot) => {
    const turn = firstTurn + slot;
    const domain = cycle[turn % cycle.length];
    const choices = DOMAIN_EXERCISES[domain];
    const exercise = choices[occurrencesBefore(cycle, domain, turn) % choices.length];
    return {
      block: "targeted" as const,
      exercise,
      domain,
      config: withoutPractice(exerciseConfigFor(exercise, durationMs, TARGETED_TARGET)),
      difficultyKey: EXERCISES[exercise].difficulty ? exercise : null,
    };
  });
}

/**
 * One cycle of targeted domains where each domain appears as often as its weight
 * (weakness: weaknessWeight, strength: 1), interleaved by smooth weighted round-robin
 * so a domain does not come back several times in a row. Unranked domains count as weaknesses.
 */
function targetedCycle(
  classification: BetHistory["classification"],
  weaknessWeight: number,
): CognitiveDomain[] {
  const weights = DOMAIN_ORDER.map((domain) => (classification[domain] === "strength" ? 1 : weaknessWeight));
  const total = weights.reduce((a, b) => a + b, 0);
  const current = DOMAIN_ORDER.map(() => 0);
  const cycle: CognitiveDomain[] = [];
  for (let i = 0; i < total; i++) {
    weights.forEach((weight, index) => (current[index] += weight));
    let pick = 0;
    current.forEach((value, index) => {
      if (value > current[pick]) pick = index;
    });
    current[pick] -= total;
    cycle.push(DOMAIN_ORDER[pick]);
  }
  return cycle;
}

/** How many times a domain came up before this turn, to alternate its exercises. */
function occurrencesBefore(cycle: CognitiveDomain[], domain: CognitiveDomain, turn: number) {
  const perCycle = cycle.filter((d) => d === domain).length;
  const inPartialCycle = cycle.slice(0, turn % cycle.length).filter((d) => d === domain).length;
  return Math.floor(turn / cycle.length) * perCycle + inPartialCycle;
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
