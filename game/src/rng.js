// Shadow Step — a tiny seeded random number generator.
// One job: deterministic randomness, so a level layout or a patrol
// wobble can be reproduced exactly from its seed.

export function makeRng(seed) {
  // mulberry32: small, fast, good enough for game flavour.
  let state = (seed >>> 0) || 0x9e3779b9;
  return function next() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

export function range(rng, min, max) {
  return min + rng() * (max - min);
}
