// =============================================================================
// RNG utilities — deterministic, seedable pseudo-randomness for the election
// agents. Every agent uses these instead of Math.random() so the same seed
// always produces the same result (fully auditable & reproducible).
// =============================================================================

/** FNV-1a string hash → 32-bit integer. */
function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mulberry32 PRNG — returns a closure producing floats in [0, 1). */
export function createRng(seed: string): () => number {
  let a = hashSeed(String(seed || "default"));
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic float in [min, max). */
export function seededFloat(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

/** Deterministic integer in [min, max] inclusive. */
export function seededInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Clamp a value into [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Round to 2 decimals — keeps audit output stable and comparable. */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}