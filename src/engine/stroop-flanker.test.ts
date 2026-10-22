import { describe, expect, it } from "vitest";
import { FLANKER_SPEC, flankerDisplay, type FlankerStimulus } from "./flanker";
import type { RngState } from "./random";
import { STROOP_COLORS, STROOP_SPEC, type StroopStimulus } from "./stroop";

function draw<S>(make: (rng: RngState, incongruent: boolean) => [S, RngState], seed: number, count: number, incongruent: boolean) {
  const stimuli: S[] = [];
  let rng = seed;
  for (let i = 0; i < count; i++) {
    const [stimulus, next] = make(rng, incongruent);
    stimuli.push(stimulus);
    rng = next;
  }
  return stimuli;
}

describe("Stroop", () => {
  it("expects the ink colour, not the word", () => {
    expect(STROOP_SPEC.correctChoice({ word: "red", ink: "blue", congruent: false })).toBe("blue");
  });

  it("prints congruent words in their own colour and incongruent ones in another", () => {
    for (const s of draw<StroopStimulus>(STROOP_SPEC.makeStimulus, 4, 200, false)) {
      expect(s).toMatchObject({ congruent: true, word: s.ink });
    }
    for (const s of draw<StroopStimulus>(STROOP_SPEC.makeStimulus, 4, 200, true)) {
      expect(s.congruent).toBe(false);
      expect(s.word).not.toBe(s.ink);
    }
  });

  it("uses every colour as ink and as word", () => {
    const stimuli = draw<StroopStimulus>(STROOP_SPEC.makeStimulus, 8, 400, true);
    expect(new Set(stimuli.map((s) => s.ink))).toEqual(new Set(STROOP_COLORS));
    expect(new Set(stimuli.map((s) => s.word))).toEqual(new Set(STROOP_COLORS));
  });

  it("replays the same stimuli for the same seed", () => {
    expect(draw(STROOP_SPEC.makeStimulus, 21, 30, true)).toEqual(draw(STROOP_SPEC.makeStimulus, 21, 30, true));
  });

  it("gets harder with the level: more conflict, less time", () => {
    expect(STROOP_SPEC.parameters(1)).toEqual({ incongruentRate: 0.25, responseWindowMs: 3000, itiMs: 1000 });
    expect(STROOP_SPEC.parameters(15)).toEqual({ incongruentRate: 0.75, responseWindowMs: 1100, itiMs: 400 });
  });
});

describe("Flanker", () => {
  it("expects the direction of the centre arrow", () => {
    expect(FLANKER_SPEC.correctChoice({ direction: "left", congruent: false })).toBe("left");
  });

  it("points the flankers the same way on congruent trials and the other way otherwise", () => {
    expect(flankerDisplay({ direction: "right", congruent: true })).toBe(">>>>>");
    expect(flankerDisplay({ direction: "right", congruent: false })).toBe("<<><<");
    expect(flankerDisplay({ direction: "left", congruent: false })).toBe(">><>>");
  });

  it("draws both directions and honours the congruency asked for", () => {
    const congruent = draw<FlankerStimulus>(FLANKER_SPEC.makeStimulus, 5, 200, false);
    expect(new Set(congruent.map((s) => s.direction))).toEqual(new Set(["left", "right"]));
    expect(congruent.every((s) => s.congruent)).toBe(true);
    expect(draw<FlankerStimulus>(FLANKER_SPEC.makeStimulus, 5, 50, true).every((s) => !s.congruent)).toBe(true);
  });

  it("replays the same stimuli for the same seed", () => {
    expect(draw(FLANKER_SPEC.makeStimulus, 13, 30, false)).toEqual(draw(FLANKER_SPEC.makeStimulus, 13, 30, false));
  });

  it("gets harder with the level: more conflict, less time", () => {
    expect(FLANKER_SPEC.parameters(1)).toEqual({ incongruentRate: 0.25, responseWindowMs: 1500, itiMs: 1000 });
    expect(FLANKER_SPEC.parameters(15)).toEqual({ incongruentRate: 0.75, responseWindowMs: 500, itiMs: 300 });
  });
});
