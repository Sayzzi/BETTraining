// Seeded PRNG (mulberry32): the same seed always yields the same stimuli,
// so a run can be replayed and tested. State is a plain uint32.

export type RngState = number;

export function nextRandom(state: RngState): [value: number, next: RngState] {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

/** Integer in [min, max], both inclusive. */
export function nextInt(state: RngState, min: number, max: number): [value: number, next: RngState] {
  const [value, next] = nextRandom(state);
  return [min + Math.floor(value * (max - min + 1)), next];
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 4294967296) >>> 0;
}
