// The assessment: a fixed protocol measuring each cognitive domain at rest,
// then after a standard BET block, fatigued. It never adapts, so assessments
// taken weeks apart stay comparable. Change the protocol only by bumping the
// version, since results from different versions cannot be compared.

import { EXERCISES, exerciseConfigFor, type CognitiveDomain, type ExerciseConfig, type ExerciseId } from "./exercises";
import type { RtResults } from "./results";
import type { Classification, DomainComparison } from "./strengths";

export const ASSESSMENT_PROTOCOL_VERSION = 1;

export type AssessmentBlock = "cold" | "bet" | "fatigued";

export type AssessmentStep = {
  position: number;
  block: AssessmentBlock;
  exercise: ExerciseId;
  /** Domain measured by a test; null for the fatigue-inducing BET block. */
  domain: CognitiveDomain | null;
  config: ExerciseConfig;
  /** Fixed difficulty level, or null for exercises without difficulty. */
  level: number | null;
};

type TestDefinition = { exercise: ExerciseId; domain: CognitiveDomain; durationMs: number; level: number | null };

export const ASSESSMENT_TESTS: readonly TestDefinition[] = [
  { exercise: "pvt_b", domain: "sustained_attention", durationMs: 180_000, level: null },
  // Level 5: 2-back, one letter every 2.5 s.
  { exercise: "nback", domain: "working_memory", durationMs: 120_000, level: 5 },
  { exercise: "stroop", domain: "inhibition", durationMs: 120_000, level: 8 },
  { exercise: "symbol_digit", domain: "processing_speed", durationMs: 90_000, level: 8 },
];

// A long, demanding Stroop: the task most BET studies use to induce mental fatigue.
const BET_BLOCK = { exercise: "stroop" as const, durationMs: 15 * 60_000, level: 10 };

/** The protocol's steps; timeScale shortens every duration for automated tests. */
export function assessmentSteps(timeScale = 1): AssessmentStep[] {
  const step = (
    block: AssessmentBlock,
    exercise: ExerciseId,
    domain: CognitiveDomain | null,
    durationMs: number,
    level: number | null,
    practice: boolean,
  ) => ({
    block,
    exercise,
    domain,
    config: fixedConfig(exercise, Math.round(durationMs * timeScale), practice),
    level,
  });

  return [
    ...ASSESSMENT_TESTS.map((t) => step("cold", t.exercise, t.domain, t.durationMs, t.level, true)),
    step("bet", BET_BLOCK.exercise, null, BET_BLOCK.durationMs, BET_BLOCK.level, false),
    ...ASSESSMENT_TESTS.map((t) => step("fatigued", t.exercise, t.domain, t.durationMs, t.level, false)),
  ].map((s, position) => ({ position, ...s }));
}

function fixedConfig(exercise: ExerciseId, durationMs: number, practice: boolean): ExerciseConfig {
  const config = exerciseConfigFor(exercise, durationMs);
  if ("practiceScoredTrials" in config) {
    return { ...config, adaptive: false, practiceScoredTrials: practice ? config.practiceScoredTrials : 0 };
  }
  if ("target" in config) {
    return { ...config, adaptive: false, practiceTrials: practice ? config.practiceTrials : 0 };
  }
  return { ...config, practiceTrials: practice ? config.practiceTrials : 0 };
}

export type AssessmentRunResult = { block: AssessmentBlock; exercise: ExerciseId; results: RtResults | null };

export type DomainScore = {
  domain: CognitiveDomain;
  exercise: ExerciseId;
  /** Rate correct score (correct answers per second of reaction): speed and accuracy in one number. */
  cold: number | null;
  fatigued: number | null;
  /** Relative change from rest to fatigue: -0.1 means 10 % worse when fatigued. */
  change: number | null;
};

export type AssessmentResults = {
  protocolVersion: number;
  domains: DomainScore[];
  /** Mean fatigued / cold ratio across domains: 1 means no drop under fatigue. */
  fatigueResistance: number | null;
  /** Comparison with the previous assessment and the resulting strengths; absent for a first assessment. */
  comparison?: AssessmentComparison | null;
};

export type AssessmentComparison = {
  previousAssessmentId: string;
  previousCompletedAt: string;
  domains: DomainComparison[];
  classification: Partial<Record<CognitiveDomain, Classification>>;
};

export function computeAssessmentResults(runs: AssessmentRunResult[]): AssessmentResults {
  const score = (block: AssessmentBlock, exercise: ExerciseId) =>
    runs.find((r) => r.block === block && r.exercise === exercise)?.results?.rateCorrectPerSecond ?? null;

  const domains = ASSESSMENT_TESTS.map(({ exercise, domain }) => {
    const cold = score("cold", exercise);
    const fatigued = score("fatigued", exercise);
    const change = cold && fatigued !== null ? fatigued / cold - 1 : null;
    return { domain, exercise, cold, fatigued, change };
  });

  const ratios = domains.filter((d) => d.change !== null).map((d) => 1 + d.change!);
  return {
    protocolVersion: ASSESSMENT_PROTOCOL_VERSION,
    domains,
    fatigueResistance: ratios.length > 0 ? ratios.reduce((a, b) => a + b, 0) / ratios.length : null,
  };
}

/** Domains covered by the assessment, in protocol order. */
export const ASSESSMENT_DOMAINS = ASSESSMENT_TESTS.map((t) => t.domain);

// Every test must measure the domain the catalogue says the exercise trains.
for (const test of ASSESSMENT_TESTS) {
  if (!EXERCISES[test.exercise].domains.includes(test.domain)) {
    throw new Error(`${test.exercise} does not train ${test.domain}`);
  }
}
