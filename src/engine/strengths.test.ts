import { describe, expect, it } from "vitest";
import type { AssessmentRunResult } from "./assessment";
import type { RtResults } from "./results";
import { classifyDomain, compareAssessments, STRENGTH_RULE, type DomainMetrics } from "./strengths";

const metrics = (meanRtMs: number | null, rtCv: number | null, accuracy: number | null): DomainMetrics => ({
  meanRtMs,
  rtCv,
  accuracy,
});

describe("strength rule", () => {
  it("makes a domain a strength when reaction time, regularity and accuracy all improve by 5 % or more", () => {
    const result = classifyDomain(metrics(500, 0.2, 0.8), metrics(470, 0.18, 0.85));
    expect(result.classification).toBe("strength");
    expect(result.reactionTime).toMatchObject({ previous: 500, current: 470, progressed: true });
    expect(result.reactionTime.change).toBeCloseTo(0.06);
    expect(result.regularity.change).toBeCloseTo(0.1);
    expect(result.accuracy.change).toBeCloseTo(0.0625);
  });

  it("counts exactly 5 % as progress", () => {
    expect(classifyDomain(metrics(400, 0.2, 0.8), metrics(380, 0.19, 0.84)).classification).toBe("strength");
  });

  it.each([
    ["only reaction time improves", metrics(450, 0.2, 0.8)],
    ["reaction time and regularity improve", metrics(450, 0.15, 0.8)],
    ["reaction time and accuracy improve", metrics(450, 0.2, 0.9)],
    ["regularity and accuracy improve", metrics(500, 0.15, 0.9)],
    ["everything improves but by under 5 %", metrics(490, 0.195, 0.82)],
  ])("keeps a weakness when %s", (_label, current) => {
    expect(classifyDomain(metrics(500, 0.2, 0.8), current).classification).toBe("weakness");
  });

  it("uses a configurable threshold", () => {
    const small = [metrics(500, 0.2, 0.8), metrics(490, 0.196, 0.816)] as const;
    expect(classifyDomain(...small).classification).toBe("weakness");
    expect(classifyDomain(...small, { ...STRENGTH_RULE, threshold: 0.02 }).classification).toBe("strength");
  });

  it("counts accuracy held at the ceiling as progress, since it cannot rise 5 % from there", () => {
    expect(classifyDomain(metrics(300, 0.2, 1), metrics(270, 0.15, 1)).classification).toBe("strength");
    expect(classifyDomain(metrics(300, 0.2, 0.98), metrics(270, 0.15, 0.97)).accuracy.progressed).toBe(false);
  });

  it("treats a missing indicator as no progress", () => {
    expect(classifyDomain(metrics(null, 0.2, 0.8), metrics(400, 0.1, 0.9)).classification).toBe("weakness");
    expect(classifyDomain(metrics(500, 0, 0.8), metrics(400, 0, 0.9)).regularity.progressed).toBe(false);
  });
});

describe("assessment comparison", () => {
  const run = (exercise: AssessmentRunResult["exercise"], block: AssessmentRunResult["block"], m: DomainMetrics) => ({
    exercise,
    block,
    results: { meanRtMs: m.meanRtMs, rtCv: m.rtCv, accuracy: m.accuracy } as RtResults,
  });

  it("compares the cold tests of two assessments domain by domain", () => {
    const previous = [
      run("pvt_b", "cold", metrics(300, 0.2, 1)),
      run("nback", "cold", metrics(800, 0.3, 0.7)),
      run("nback", "fatigued", metrics(100, 0.01, 1)),
    ];
    const current = [
      run("pvt_b", "cold", metrics(280, 0.18, 1)),
      run("nback", "cold", metrics(800, 0.3, 0.7)),
    ];
    const comparison = compareAssessments(previous, current);

    expect(comparison.map((c) => c.domain)).toEqual([
      "sustained_attention",
      "working_memory",
      "inhibition",
      "processing_speed",
    ]);
    expect(comparison[0]).toMatchObject({ exercise: "pvt_b", classification: "strength" });
    // The fatigued run is ignored: the n-back did not change at rest.
    expect(comparison[1].classification).toBe("weakness");
    expect(comparison[2].reactionTime.previous).toBeNull();
  });
});
