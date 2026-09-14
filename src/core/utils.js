/**
 * Small math / random helpers shared across the game.
 * Everything here is deterministic where it can be, so island layouts are
 * identical on every device and across reloads.
 */

export const TAU = Math.PI * 2;

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const smoothstep = (t) => t * t * (3 - 2 * t);

/** Frame-rate independent exponential approach. `rate` is roughly "per second". */
export const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));

/** Shortest signed angular difference, in radians. */
export function angleDelta(from, to) {
  let d = (to - from) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

export function dampAngle(a, b, rate, dt) {
  return a + angleDelta(a, b) * (1 - Math.exp(-rate * dt));
}

/** Deterministic PRNG. Same seed always yields the same sequence. */
export function makeRng(seed) {
  let s = seed >>> 0 || 1;
  return function rng() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Turn any string into a stable 32-bit seed. */
export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 2D value noise in [-1, 1]. Cheap, smooth, and good enough for terrain. */
export function noise2D(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = smoothstep(xf), v = smoothstep(yf);
  const h = (a, b) => {
    let n = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ Math.imul(seed, 2246822519);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 2147483648 - 1;
  };
  const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

/** Layered value noise. `octaves` doublings of frequency at halving amplitude. */
export function fbm(x, y, octaves = 4, seed = 0) {
  let sum = 0, amp = 1, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise2D(x * freq, y * freq, seed + i * 1013) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

/** Pick a random element using a supplied rng. */
export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length) % arr.length];

/** Random float in [lo, hi) using a supplied rng. */
export const range = (rng, lo, hi) => lo + rng() * (hi - lo);

/** Format a distance for the Log Pose readout. */
export function formatDistance(units) {
  const leagues = units / 100;
  return leagues < 10 ? leagues.toFixed(1) + " lg" : Math.round(leagues) + " lg";
}

/** Compass letters for a heading in radians (0 = north / -Z). */
const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
export function compassLabel(heading) {
  const idx = Math.round((((heading % TAU) + TAU) % TAU) / (TAU / 8)) % 8;
  return COMPASS[idx];
}
