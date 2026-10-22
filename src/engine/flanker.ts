// Flanker (Eriksen): five arrows; answer the direction of the centre one and
// ignore the flankers, which point the other way on incongruent trials.

import { interpolate, rollIncongruent, type ChoiceTaskConfig, type ChoiceTaskSpec } from "./choice-task";
import { nextInt, type RngState } from "./random";

export type FlankerDirection = "left" | "right";
export type FlankerStimulus = { direction: FlankerDirection; congruent: boolean };

export const FLANKER_LEVELS = { min: 1, max: 15, initial: 3 } as const;

const ARROW = { left: "<", right: ">" } as const;

/** The five arrows as displayed, centre arrow in the middle. */
export function flankerDisplay({ direction, congruent }: FlankerStimulus): string {
  const flank = congruent ? direction : direction === "left" ? "right" : "left";
  return ARROW[flank].repeat(2) + ARROW[direction] + ARROW[flank].repeat(2);
}

/** Builds one stimulus, congruent or not; exported for tests. */
export function makeFlankerStimulus(rng: RngState, incongruent: boolean): [FlankerStimulus, RngState] {
  const [side, next] = nextInt(rng, 0, 1);
  return [{ direction: side === 0 ? "left" : "right", congruent: !incongruent }, next];
}

export const FLANKER_SPEC: ChoiceTaskSpec<FlankerStimulus> = {
  parameters: (level) => ({
    incongruentRate: interpolate(level, FLANKER_LEVELS.min, FLANKER_LEVELS.max, 0.25, 0.75),
    responseWindowMs: Math.round(interpolate(level, FLANKER_LEVELS.min, FLANKER_LEVELS.max, 1500, 500)),
    itiMs: Math.round(interpolate(level, FLANKER_LEVELS.min, FLANKER_LEVELS.max, 1000, 300)),
  }),
  makeStimulus: (rng, parameters) => {
    const [incongruent, next] = rollIncongruent(rng, parameters);
    return makeFlankerStimulus(next, incongruent);
  },
  correctChoice: (stimulus) => stimulus.direction,
};

export function flankerConfig(durationMs: number, target: number): ChoiceTaskConfig {
  return { durationMs, practiceTrials: 6, minLevel: FLANKER_LEVELS.min, maxLevel: FLANKER_LEVELS.max, target };
}
