// Stroop: a colour word printed in an ink colour; answer the ink, not the word.

import { interpolate, type ChoiceTaskConfig, type ChoiceTaskSpec } from "./choice-task";
import { nextInt } from "./random";

export const STROOP_COLORS = ["red", "green", "blue", "yellow"] as const;
export type StroopColor = (typeof STROOP_COLORS)[number];

export type StroopStimulus = { word: StroopColor; ink: StroopColor; congruent: boolean };

export const STROOP_LEVELS = { min: 1, max: 15, initial: 3 } as const;

export const STROOP_SPEC: ChoiceTaskSpec<StroopStimulus> = {
  parameters: (level) => ({
    incongruentRate: interpolate(level, STROOP_LEVELS.min, STROOP_LEVELS.max, 0.25, 0.75),
    responseWindowMs: Math.round(interpolate(level, STROOP_LEVELS.min, STROOP_LEVELS.max, 3000, 1100)),
    itiMs: Math.round(interpolate(level, STROOP_LEVELS.min, STROOP_LEVELS.max, 1000, 400)),
  }),
  makeStimulus: (rng, incongruent) => {
    const [inkIndex, afterInk] = nextInt(rng, 0, STROOP_COLORS.length - 1);
    const ink = STROOP_COLORS[inkIndex];
    if (!incongruent) return [{ word: ink, ink, congruent: true }, afterInk];
    // Any other colour word, chosen uniformly.
    const [offset, next] = nextInt(afterInk, 1, STROOP_COLORS.length - 1);
    const word = STROOP_COLORS[(inkIndex + offset) % STROOP_COLORS.length];
    return [{ word, ink, congruent: false }, next];
  },
  correctChoice: (stimulus) => stimulus.ink,
};

export function stroopConfig(durationMs: number, target: number): ChoiceTaskConfig {
  return { durationMs, practiceTrials: 6, minLevel: STROOP_LEVELS.min, maxLevel: STROOP_LEVELS.max, target };
}
