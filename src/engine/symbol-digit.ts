// Symbols-digits (after the Symbol Digit Modalities Test): a key pairs nine
// symbols with the digits 1 to 9; a symbol appears and the user gives its digit.
// The key is reshuffled from the run's seed so it cannot be learnt by heart.

import { interpolate, type ChoiceTaskConfig, type ChoiceTaskSpec } from "./choice-task";
import { nextInt } from "./random";

export const SYMBOLS = ["circle", "square", "triangle", "diamond", "cross", "star", "ring", "half", "hexagon"] as const;
export type SymbolId = (typeof SYMBOLS)[number];

/** Digit (1-9) to symbol. */
export type SymbolKey = Record<number, SymbolId>;

export type SymbolDigitStimulus = { symbol: SymbolId; digit: number };

export const SYMBOL_DIGIT_LEVELS = { min: 1, max: 15, initial: 3 } as const;

// Separate stream from the stimuli, so the key does not shift the sequence.
const KEY_SALT = 0x9e3779b9;

export function symbolDigitKey(seed: number): SymbolKey {
  const symbols: SymbolId[] = [...SYMBOLS];
  let rng = (seed ^ KEY_SALT) >>> 0;
  for (let i = symbols.length - 1; i > 0; i--) {
    const [j, next] = nextInt(rng, 0, i);
    rng = next;
    [symbols[i], symbols[j]] = [symbols[j], symbols[i]];
  }
  return Object.fromEntries(symbols.map((symbol, index) => [index + 1, symbol]));
}

export function symbolDigitParameters(level: number) {
  return {
    responseWindowMs: Math.round(interpolate(level, SYMBOL_DIGIT_LEVELS.min, SYMBOL_DIGIT_LEVELS.max, 4000, 1200)),
    itiMs: Math.round(interpolate(level, SYMBOL_DIGIT_LEVELS.min, SYMBOL_DIGIT_LEVELS.max, 600, 200)),
  };
}

export type SymbolDigitSpec = ChoiceTaskSpec<SymbolDigitStimulus> & { key: SymbolKey };

export function symbolDigitSpec(key: SymbolKey): SymbolDigitSpec {
  return {
    key,
    parameters: symbolDigitParameters,
    makeStimulus: (rng) => {
      const [digit, next] = nextInt(rng, 1, 9);
      return [{ symbol: key[digit], digit }, next];
    },
    correctChoice: (stimulus) => String(stimulus.digit),
  };
}

export function symbolDigitConfig(durationMs: number, target: number): ChoiceTaskConfig {
  return {
    durationMs,
    practiceTrials: 6,
    minLevel: SYMBOL_DIGIT_LEVELS.min,
    maxLevel: SYMBOL_DIGIT_LEVELS.max,
    target,
  };
}
