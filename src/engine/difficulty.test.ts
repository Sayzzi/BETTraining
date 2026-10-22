import { describe, expect, it } from "vitest";
import { nextRandom } from "./random";
import { replayLevel, staircaseFor, stepDown, updateLevel, type Staircase } from "./difficulty";

/** Simulated two-choice responder: near-perfect when easy, at chance (50 %) when far too hard. */
function pCorrect(level: number, threshold: number) {
  return 0.5 + 0.5 / (1 + Math.exp(level - threshold));
}

function simulate(staircase: Staircase, threshold: number, trials: number, seed = 1) {
  let level = staircase.min;
  let rng = seed;
  const outcomes: boolean[] = [];
  const levels: number[] = [];
  for (let i = 0; i < trials; i++) {
    const [draw, next] = nextRandom(rng);
    rng = next;
    const correct = draw < pCorrect(level, threshold);
    outcomes.push(correct);
    levels.push(level);
    level = updateLevel(level, correct, staircase);
  }
  return { outcomes, levels };
}

function accuracy(outcomes: boolean[]) {
  return outcomes.filter(Boolean).length / outcomes.length;
}

describe("weighted staircase", () => {
  it("steps down target / (1 - target) times the step up", () => {
    expect(stepDown(staircaseFor(0.8, { min: 1, max: 15 }))).toBeCloseTo(0.25 * 4);
    const strict = staircaseFor(0.95, { min: 1, max: 15 });
    expect(stepDown(strict)).toBeCloseTo(strict.stepUp * 19);
  });

  it("stays within its bounds", () => {
    const staircase = staircaseFor(0.8, { min: 1, max: 3 });
    expect(updateLevel(3, true, staircase)).toBe(3);
    expect(updateLevel(1, false, staircase)).toBe(1);
  });

  it.each([0.8, 0.95])("converges to a %s success rate with a simulated responder", (target) => {
    const staircase = staircaseFor(target, { min: 1, max: 15 });
    const { outcomes } = simulate(staircase, 8, 6000);
    expect(accuracy(outcomes.slice(2000))).toBeCloseTo(target, 1);
    expect(Math.abs(accuracy(outcomes.slice(2000)) - target)).toBeLessThan(0.025);
  });

  it("settles harder for an abler responder", () => {
    const staircase = staircaseFor(0.8, { min: 1, max: 15 });
    const average = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
    const weaker = average(simulate(staircase, 5, 4000).levels.slice(1000));
    const abler = average(simulate(staircase, 10, 4000).levels.slice(1000));
    expect(abler).toBeGreaterThan(weaker + 3);
  });

  it("replays the same final level from a start level and outcomes", () => {
    const staircase = staircaseFor(0.8, { min: 1, max: 15 });
    const outcomes = [true, true, true, true, false, true, true];
    let level = 4;
    for (const correct of outcomes) level = updateLevel(level, correct, staircase);
    expect(replayLevel(4, outcomes, staircase)).toBe(level);
  });
});
