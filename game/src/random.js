// Velvet Vault — a tiny seeded random generator (mulberry32). The game logic itself is
// fixed layouts and fixed patrols, so this is only for cosmetic sparkle that must still
// look the same on every run of the same seed.
export function makeRng(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
