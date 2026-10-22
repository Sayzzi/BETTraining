// Strengths and weaknesses: comparing an assessment's tests at rest with the
// previous assessment, a domain is a strength when reaction time, regularity
// and accuracy each improve by at least the threshold (5 %).

import { ASSESSMENT_TESTS, type AssessmentRunResult } from "./assessment";
import type { CognitiveDomain, ExerciseId } from "./exercises";

export type DomainMetrics = { meanRtMs: number | null; rtCv: number | null; accuracy: number | null };

export type Classification = "strength" | "weakness";

export type MetricProgress = {
  previous: number | null;
  current: number | null;
  /** Relative improvement: positive is better, whatever the metric's direction. */
  change: number | null;
  progressed: boolean;
};

export type DomainComparison = {
  domain: CognitiveDomain;
  exercise: ExerciseId;
  reactionTime: MetricProgress;
  regularity: MetricProgress;
  accuracy: MetricProgress;
  classification: Classification;
};

export const STRENGTH_RULE = {
  threshold: 0.05,
  // Accuracy cannot gain 5 % once near perfect: holding it at or above this level counts as progress.
  accuracyCeiling: 0.97,
};

export type StrengthRule = typeof STRENGTH_RULE;

export function classifyDomain(previous: DomainMetrics, current: DomainMetrics, rule: StrengthRule = STRENGTH_RULE) {
  const reactionTime = progress(previous.meanRtMs, current.meanRtMs, "lower", rule.threshold);
  const regularity = progress(previous.rtCv, current.rtCv, "lower", rule.threshold);
  let accuracy = progress(previous.accuracy, current.accuracy, "higher", rule.threshold);
  if (
    !accuracy.progressed &&
    previous.accuracy !== null &&
    current.accuracy !== null &&
    current.accuracy >= rule.accuracyCeiling &&
    current.accuracy >= previous.accuracy
  ) {
    accuracy = { ...accuracy, progressed: true };
  }
  const classification: Classification =
    reactionTime.progressed && regularity.progressed && accuracy.progressed ? "strength" : "weakness";
  return { reactionTime, regularity, accuracy, classification };
}

/** Compares the tests at rest of two assessments, in protocol order. */
export function compareAssessments(
  previous: AssessmentRunResult[],
  current: AssessmentRunResult[],
  rule: StrengthRule = STRENGTH_RULE,
): DomainComparison[] {
  const coldMetrics = (runs: AssessmentRunResult[], exercise: ExerciseId): DomainMetrics => {
    const results = runs.find((run) => run.block === "cold" && run.exercise === exercise)?.results;
    return {
      meanRtMs: results?.meanRtMs ?? null,
      rtCv: results?.rtCv ?? null,
      accuracy: results?.accuracy ?? null,
    };
  };
  return ASSESSMENT_TESTS.map(({ domain, exercise }) => ({
    domain,
    exercise,
    ...classifyDomain(coldMetrics(previous, exercise), coldMetrics(current, exercise), rule),
  }));
}

function progress(
  previous: number | null,
  current: number | null,
  better: "lower" | "higher",
  threshold: number,
): MetricProgress {
  if (previous === null || current === null || previous === 0) {
    return { previous, current, change: null, progressed: false };
  }
  const change = better === "lower" ? (previous - current) / previous : (current - previous) / previous;
  // Rounding guards the exact-threshold case against floating-point error.
  return { previous, current, change, progressed: Math.round(change * 1e9) / 1e9 >= threshold };
}
