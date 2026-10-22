// Choice reaction time: one of four zones lights up; press its key or tap it.

import { interpolate, type ChoiceTaskConfig, type ChoiceTaskSpec } from "./choice-task";
import { nextInt } from "./random";

export const CHOICE_RT_ZONES = 4;
export type ChoiceRtStimulus = { position: number };

export const CHOICE_RT_LEVELS = { min: 1, max: 15, initial: 3 } as const;

export const CHOICE_RT_SPEC: ChoiceTaskSpec<ChoiceRtStimulus> = {
  parameters: (level) => ({
    responseWindowMs: Math.round(interpolate(level, CHOICE_RT_LEVELS.min, CHOICE_RT_LEVELS.max, 1500, 450)),
    itiMs: Math.round(interpolate(level, CHOICE_RT_LEVELS.min, CHOICE_RT_LEVELS.max, 1000, 300)),
  }),
  makeStimulus: (rng) => {
    const [position, next] = nextInt(rng, 0, CHOICE_RT_ZONES - 1);
    return [{ position }, next];
  },
  correctChoice: (stimulus) => String(stimulus.position),
};

export function choiceRtConfig(durationMs: number, target: number): ChoiceTaskConfig {
  return { durationMs, practiceTrials: 6, minLevel: CHOICE_RT_LEVELS.min, maxLevel: CHOICE_RT_LEVELS.max, target };
}
