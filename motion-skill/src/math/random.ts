/** Deterministic 32-bit PRNG. */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function smoothstep(value: number): number { return value * value * (3 - 2 * value); }

/** Interpolated value noise in [-1, 1]. */
export function noise1D(seed: number, x: number): number {
  const left = Math.floor(x);
  const fraction = x - left;
  const sample = (index: number) => createRandom((seed ^ Math.imul(index, 0x9e3779b1)) >>> 0)() * 2 - 1;
  const amount = smoothstep(fraction);
  return sample(left) * (1 - amount) + sample(left + 1) * amount;
}
