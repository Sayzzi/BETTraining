import { describe, expect, it } from "vitest";
import { computeRtResults } from "./results";
import type { Trial, TrialOutcome } from "./trial";

let nextIndex = 0;
function trial(outcome: TrialOutcome, onsetMs: number | null, rtMs: number | null, practice = false): Trial {
  return {
    index: nextIndex++,
    practice,
    onsetMs,
    responseMs: onsetMs !== null && rtMs !== null ? onsetMs + rtMs : onsetMs,
    rtMs,
    outcome,
    correct: outcome === "hit" || outcome === "lapse",
    stimulus: null,
    response: null,
    difficulty: null,
  };
}

describe("computeRtResults", () => {
  it("averages hits only, leaving lapses, misses and false starts out of the mean", () => {
    const results = computeRtResults(
      [
        trial("hit", 1_000, 200),
        trial("hit", 5_000, 300),
        trial("lapse", 9_000, 800),
        trial("miss", 13_000, null),
        trial("false_start", null, null),
      ],
      { lapseThresholdMs: 500 },
    );
    expect(results.meanRtMs).toBe(250);
    expect(results.trialCount).toBe(5);
    expect(results.correctCount).toBe(3);
    expect(results.accuracy).toBeCloseTo(3 / 5);
  });

  it("counts misses as lapses and reports them separately too", () => {
    const results = computeRtResults(
      [trial("lapse", 0, 600), trial("miss", 4_000, null), trial("hit", 8_000, 250)],
      { lapseThresholdMs: 500 },
    );
    expect(results.lapses).toBe(2);
    expect(results.misses).toBe(1);
    expect(results.falseStarts).toBe(0);
  });

  it("measures regularity as the coefficient of variation of hit reaction times", () => {
    const results = computeRtResults([trial("hit", 0, 200), trial("hit", 3_000, 300)], { lapseThresholdMs: 500 });
    // Sample standard deviation of 200 and 300 is 70.71; mean 250.
    expect(results.rtCv).toBeCloseTo(70.7107 / 250, 4);
  });

  it("computes correct responses per second of response time (rate correct score)", () => {
    const results = computeRtResults(
      [trial("hit", 0, 250), trial("lapse", 3_000, 750), trial("false_start", 5_000, 50)],
      { lapseThresholdMs: 500 },
    );
    // 2 correct over 1.05 s of reaction time.
    expect(results.rateCorrectPerSecond).toBeCloseTo(2 / 1.05, 4);
  });

  it("ignores practice trials", () => {
    const results = computeRtResults(
      [trial("hit", 0, 900, true), trial("hit", 2_000, 200)],
      { lapseThresholdMs: 500 },
    );
    expect(results.trialCount).toBe(1);
    expect(results.meanRtMs).toBe(200);
  });

  it("splits the run minute by minute using onset, or response time for false starts", () => {
    const falseStartLate: Trial = { ...trial("false_start", null, null), responseMs: 61_000 };
    const results = computeRtResults(
      [trial("hit", 10_000, 200), trial("hit", 50_000, 400), trial("lapse", 70_000, 600), falseStartLate],
      { lapseThresholdMs: 500 },
    );
    expect(results.minutes).toEqual([
      { minute: 0, trialCount: 2, meanRtMs: 300, accuracy: 1, lapses: 0 },
      { minute: 1, trialCount: 2, meanRtMs: null, accuracy: 0.5, lapses: 1 },
    ]);
  });

  it("counts wrong choices as errors and keeps misses out of lapses when there is no threshold", () => {
    const results = computeRtResults(
      [trial("hit", 0, 600), trial("error", 3_000, 700), trial("miss", 6_000, null)],
      { lapseThresholdMs: null },
    );
    expect(results).toMatchObject({ errors: 1, misses: 1, lapses: 0, correctCount: 1, meanRtMs: 600 });
    expect(results.accuracy).toBeCloseTo(1 / 3);
    expect(results.minutes[0].lapses).toBe(0);
  });

  it("measures the interference cost as incongruent minus congruent hit reaction time", () => {
    const withCongruency = (outcome: TrialOutcome, rt: number, congruent: boolean) => ({
      ...trial(outcome, 0, rt),
      stimulus: { congruent },
    });
    const results = computeRtResults(
      [
        withCongruency("hit", 500, true),
        withCongruency("hit", 600, true),
        withCongruency("hit", 650, false),
        withCongruency("hit", 750, false),
        withCongruency("error", 300, false),
      ],
      { lapseThresholdMs: null },
    );
    expect(results.congruencyEffectMs).toBe(150);
  });

  it("has no interference cost for tasks without congruency", () => {
    expect(computeRtResults([trial("hit", 0, 300)], { lapseThresholdMs: 500 }).congruencyEffectMs).toBeNull();
  });

  it("returns empty statistics for a run without counted trials", () => {
    expect(computeRtResults([], { lapseThresholdMs: 500 })).toEqual({
      trialCount: 0,
      correctCount: 0,
      accuracy: null,
      meanRtMs: null,
      rtCv: null,
      lapses: 0,
      errors: 0,
      misses: 0,
      falseStarts: 0,
      rateCorrectPerSecond: null,
      congruencyEffectMs: null,
      lapseThresholdMs: 500,
      minutes: [],
    });
  });
});
