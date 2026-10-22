import { describe, expect, it } from "vitest";
import { CHOICE_RT_SPEC, type ChoiceRtStimulus } from "./choice-rt";
import { SYMBOLS, symbolDigitKey, symbolDigitSpec, type SymbolDigitStimulus } from "./symbol-digit";
import type { ChoiceTaskSpec } from "./choice-task";

function draw<S>(spec: ChoiceTaskSpec<S>, seed: number, count: number, level = 1) {
  const stimuli: S[] = [];
  let rng = seed;
  for (let i = 0; i < count; i++) {
    const [stimulus, next] = spec.makeStimulus(rng, spec.parameters(level));
    stimuli.push(stimulus);
    rng = next;
  }
  return stimuli;
}

describe("choice reaction time", () => {
  it("expects the key of the zone that lights up", () => {
    expect(CHOICE_RT_SPEC.correctChoice({ position: 2 })).toBe("2");
  });

  it("lights each of the four zones", () => {
    const positions = new Set(draw<ChoiceRtStimulus>(CHOICE_RT_SPEC, 3, 200).map((s) => s.position));
    expect(positions).toEqual(new Set([0, 1, 2, 3]));
  });

  it("replays the same signals for the same seed", () => {
    expect(draw(CHOICE_RT_SPEC, 17, 40)).toEqual(draw(CHOICE_RT_SPEC, 17, 40));
  });

  it("gives less time to answer and less waiting as the level rises", () => {
    expect(CHOICE_RT_SPEC.parameters(1)).toEqual({ responseWindowMs: 1500, itiMs: 1000 });
    expect(CHOICE_RT_SPEC.parameters(15)).toEqual({ responseWindowMs: 450, itiMs: 300 });
  });
});

describe("symbols-digits", () => {
  it("pairs each digit 1 to 9 with a distinct symbol", () => {
    const key = symbolDigitKey(42);
    expect(Object.keys(key).map(Number).sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(new Set(Object.values(key))).toEqual(new Set(SYMBOLS));
  });

  it("reshuffles the key from one seed to another, and replays it for the same seed", () => {
    expect(symbolDigitKey(1)).toEqual(symbolDigitKey(1));
    expect(symbolDigitKey(1)).not.toEqual(symbolDigitKey(2));
  });

  it("shows the symbol of a digit and expects that digit", () => {
    const key = symbolDigitKey(7);
    const spec = symbolDigitSpec(key);
    for (const stimulus of draw<SymbolDigitStimulus>(spec, 5, 100)) {
      expect(stimulus.symbol).toBe(key[stimulus.digit]);
      expect(spec.correctChoice(stimulus)).toBe(String(stimulus.digit));
    }
  });

  it("uses every digit", () => {
    const digits = new Set(draw<SymbolDigitStimulus>(symbolDigitSpec(symbolDigitKey(3)), 9, 400).map((s) => s.digit));
    expect(digits.size).toBe(9);
  });

  it("gives less time to answer and less waiting as the level rises", () => {
    const spec = symbolDigitSpec(symbolDigitKey(1));
    expect(spec.parameters(1)).toEqual({ responseWindowMs: 4000, itiMs: 600 });
    expect(spec.parameters(15)).toEqual({ responseWindowMs: 1200, itiMs: 200 });
  });
});
