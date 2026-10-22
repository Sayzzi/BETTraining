import { describe, expect, it } from "vitest";
import { nextInt, nextRandom } from "./random";

function sequence(seed: number, length: number) {
  const values: number[] = [];
  let state = seed;
  for (let i = 0; i < length; i++) {
    const [value, next] = nextRandom(state);
    values.push(value);
    state = next;
  }
  return values;
}

describe("seeded random", () => {
  it("replays the same sequence for the same seed", () => {
    expect(sequence(42, 20)).toEqual(sequence(42, 20));
  });

  it("produces different sequences for different seeds", () => {
    expect(sequence(1, 5)).not.toEqual(sequence(2, 5));
  });

  it("stays within [0, 1)", () => {
    for (const value of sequence(7, 1000)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("draws integers within inclusive bounds and reaches both ends", () => {
    const seen = new Set<number>();
    let state = 99;
    for (let i = 0; i < 2000; i++) {
      const [value, next] = nextInt(state, 1, 4);
      seen.add(value);
      state = next;
    }
    expect([...seen].sort()).toEqual([1, 2, 3, 4]);
  });
});
