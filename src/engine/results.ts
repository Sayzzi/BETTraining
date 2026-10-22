// Results of a reaction-time exercise, always derived from its raw trials.

import type { Trial } from "./trial";

export type MinuteResult = {
  minute: number;
  trialCount: number;
  meanRtMs: number | null;
  accuracy: number | null;
  lapses: number;
};

export type RtResults = {
  trialCount: number;
  correctCount: number;
  accuracy: number | null;
  /** Mean reaction time of hits only: lapses, misses and false starts are excluded. */
  meanRtMs: number | null;
  /** Coefficient of variation (sample SD / mean) of hit reaction times. */
  rtCv: number | null;
  /** PVT only: slow responses at or above the threshold, plus misses. Zero when there is no threshold. */
  lapses: number;
  /** Wrong choices (choice exercises such as n-back). */
  errors: number;
  misses: number;
  falseStarts: number;
  /** Correct responses per second of total reaction time (Woltz & Was rate correct score). */
  rateCorrectPerSecond: number | null;
  lapseThresholdMs: number | null;
  minutes: MinuteResult[];
};

/** Exercises without a lapse threshold (choice tasks) do not count misses as lapses. */
export function computeRtResults(trials: Trial[], options: { lapseThresholdMs: number | null }): RtResults {
  const missesAreLapses = options.lapseThresholdMs !== null;
  const counted = trials.filter((trial) => !trial.practice);
  const hits: number[] = [];
  let correctCount = 0;
  let lapses = 0;
  let errors = 0;
  let misses = 0;
  let falseStarts = 0;
  let rtTotalMs = 0;

  for (const trial of counted) {
    if (trial.correct) correctCount++;
    if (trial.rtMs !== null) rtTotalMs += trial.rtMs;
    switch (trial.outcome) {
      case "hit":
        hits.push(trial.rtMs!);
        break;
      case "lapse":
        lapses++;
        break;
      case "miss":
        if (missesAreLapses) lapses++;
        misses++;
        break;
      case "error":
        errors++;
        break;
      case "false_start":
        falseStarts++;
        break;
    }
  }

  return {
    trialCount: counted.length,
    correctCount,
    accuracy: counted.length > 0 ? correctCount / counted.length : null,
    meanRtMs: mean(hits),
    rtCv: coefficientOfVariation(hits),
    lapses,
    errors,
    misses,
    falseStarts,
    rateCorrectPerSecond: rtTotalMs > 0 ? correctCount / (rtTotalMs / 1000) : null,
    lapseThresholdMs: options.lapseThresholdMs,
    minutes: byMinute(counted, missesAreLapses),
  };
}

function byMinute(trials: Trial[], missesAreLapses: boolean): MinuteResult[] {
  const buckets = new Map<number, Trial[]>();
  for (const trial of trials) {
    const at = trial.onsetMs ?? trial.responseMs;
    if (at === null) continue;
    const minute = Math.floor(at / 60_000);
    const bucket = buckets.get(minute);
    if (bucket) bucket.push(trial);
    else buckets.set(minute, [trial]);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([minute, bucket]) => {
      const hits = bucket.filter((t) => t.outcome === "hit").map((t) => t.rtMs!);
      const correct = bucket.filter((t) => t.correct).length;
      return {
        minute,
        trialCount: bucket.length,
        meanRtMs: mean(hits),
        accuracy: correct / bucket.length,
        lapses: bucket.filter((t) => t.outcome === "lapse" || (missesAreLapses && t.outcome === "miss")).length,
      };
    });
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  let sum = 0;
  for (const value of values) sum += value;
  return sum / values.length;
}

function coefficientOfVariation(values: number[]): number | null {
  const average = mean(values);
  if (average === null || values.length < 2 || average === 0) return null;
  let squares = 0;
  for (const value of values) squares += (value - average) ** 2;
  return Math.sqrt(squares / (values.length - 1)) / average;
}
