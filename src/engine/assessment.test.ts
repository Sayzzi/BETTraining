import { describe, expect, it } from "vitest";
import {
  ASSESSMENT_PROTOCOL_VERSION,
  assessmentSteps,
  computeAssessmentResults,
  type AssessmentRunResult,
} from "./assessment";
import type { RtResults } from "./results";

function withScore(rateCorrectPerSecond: number | null): RtResults {
  return { rateCorrectPerSecond } as RtResults;
}

describe("assessment protocol", () => {
  const steps = assessmentSteps();

  it("runs the cold tests, one standard BET block, then the same tests fatigued", () => {
    expect(steps.map((s) => `${s.block}:${s.exercise}`)).toEqual([
      "cold:pvt_b",
      "cold:nback",
      "cold:stroop",
      "cold:symbol_digit",
      "bet:stroop",
      "fatigued:pvt_b",
      "fatigued:nback",
      "fatigued:stroop",
      "fatigued:symbol_digit",
    ]);
    expect(steps.map((s) => s.position)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("tests each of the four cognitive domains once per phase", () => {
    const cold = steps.filter((s) => s.block === "cold").map((s) => s.domain);
    expect(new Set(cold)).toEqual(new Set(["sustained_attention", "working_memory", "inhibition", "processing_speed"]));
  });

  it("is identical every time and never adapts its difficulty", () => {
    expect(assessmentSteps()).toEqual(steps);
    for (const step of steps) {
      if ("target" in step.config) expect(step.config.adaptive).toBe(false);
    }
  });

  it("uses the same settings at rest and fatigued, practice aside", () => {
    const cold = steps.filter((s) => s.block === "cold");
    const fatigued = steps.filter((s) => s.block === "fatigued");
    const withoutPractice = (config: object) => {
      const copy: Record<string, unknown> = { ...config };
      delete copy.practiceTrials;
      delete copy.practiceScoredTrials;
      return copy;
    };
    cold.forEach((step, i) => {
      expect(withoutPractice(fatigued[i].config)).toEqual(withoutPractice(step.config));
      expect(fatigued[i].level).toBe(step.level);
    });
  });

  it("only offers practice trials in the cold phase", () => {
    const practice = (step: (typeof steps)[number]) => {
      const config = step.config as Record<string, unknown>;
      return Number(config.practiceTrials ?? config.practiceScoredTrials ?? 0);
    };
    expect(steps.filter((s) => s.block !== "cold").every((s) => practice(s) === 0)).toBe(true);
    expect(steps.filter((s) => s.block === "cold" && s.exercise !== "pvt_b").every((s) => practice(s) > 0)).toBe(true);
  });

  it("induces fatigue with a 15-minute Stroop and lasts about 35 minutes of exercise", () => {
    const bet = steps.find((s) => s.block === "bet")!;
    expect(bet.config.durationMs).toBe(15 * 60_000);
    const total = steps.reduce((sum, s) => sum + s.config.durationMs, 0);
    expect(total / 60_000).toBeCloseTo(32, 0);
  });

  it("scales every duration for tests without changing anything else", () => {
    const quick = assessmentSteps(0.01);
    quick.forEach((step, i) => {
      expect(step.config.durationMs).toBe(Math.round(steps[i].config.durationMs * 0.01));
      expect(step.exercise).toBe(steps[i].exercise);
    });
  });
});

describe("assessment results", () => {
  const run = (block: AssessmentRunResult["block"], exercise: AssessmentRunResult["exercise"], score: number | null) => ({
    block,
    exercise,
    results: withScore(score),
  });

  it("scores each domain at rest and fatigued, with the relative change", () => {
    const results = computeAssessmentResults([
      run("cold", "pvt_b", 3),
      run("cold", "nback", 1),
      run("cold", "stroop", 1.5),
      run("cold", "symbol_digit", 0.8),
      run("bet", "stroop", 1.2),
      run("fatigued", "pvt_b", 2.7),
      run("fatigued", "nback", 1),
      run("fatigued", "stroop", 1.2),
      run("fatigued", "symbol_digit", 0.84),
    ]);

    expect(results.protocolVersion).toBe(ASSESSMENT_PROTOCOL_VERSION);
    const attention = results.domains.find((d) => d.domain === "sustained_attention")!;
    expect(attention).toMatchObject({ exercise: "pvt_b", cold: 3, fatigued: 2.7 });
    expect(attention.change).toBeCloseTo(-0.1);
    expect(results.domains.find((d) => d.domain === "processing_speed")!.change).toBeCloseTo(0.05);
  });

  it("measures fatigue resistance as the mean fatigued / cold ratio across domains", () => {
    const results = computeAssessmentResults([
      run("cold", "pvt_b", 2),
      run("cold", "nback", 1),
      run("fatigued", "pvt_b", 1.6),
      run("fatigued", "nback", 1),
    ]);
    // (0.8 + 1.0) / 2, domains without both scores are left out.
    expect(results.fatigueResistance).toBeCloseTo(0.9);
    expect(results.domains.find((d) => d.domain === "inhibition")).toMatchObject({ cold: null, change: null });
  });

  it("has no fatigue resistance when no domain was measured both ways", () => {
    expect(computeAssessmentResults([run("cold", "pvt_b", 2)]).fatigueResistance).toBeNull();
  });
});
