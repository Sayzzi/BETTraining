// Weighted up/down staircase (Kaernbach 1991): step up after a success, step
// down after an error, with stepDown / stepUp = target / (1 - target). The
// success rate then converges to the target, whatever the exercise.

export type Staircase = {
  /** Success rate the staircase converges to (0.8 by default, 0.95 in the BET block). */
  target: number;
  stepUp: number;
  min: number;
  max: number;
};

export function staircaseFor(target: number, bounds: { min: number; max: number }): Staircase {
  // A strict target needs small steps up, otherwise each error drops the level too far.
  return { target, stepUp: target >= 0.9 ? 0.05 : 0.25, ...bounds };
}

export function stepDown(staircase: Staircase) {
  return (staircase.stepUp * staircase.target) / (1 - staircase.target);
}

export function updateLevel(level: number, correct: boolean, staircase: Staircase): number {
  const next = correct ? level + staircase.stepUp : level - stepDown(staircase);
  return Math.min(staircase.max, Math.max(staircase.min, next));
}

/** Recomputes a final level from stored outcomes, so the server never trusts the client's level. */
export function replayLevel(start: number, outcomes: boolean[], staircase: Staircase): number {
  let level = start;
  for (const correct of outcomes) level = updateLevel(level, correct, staircase);
  return level;
}
