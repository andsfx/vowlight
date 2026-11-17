// A seeded mulberry32 generator, so one ?seed=N run replays every spawn, aim jitter and particle.

/** mulberry32: a 32-bit seed in, a deterministic stream of floats in [0, 1) out. */
export function mulberry32(seed) {
  let state = seed >>> 0;
  return function nextRandom() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A seed from the ?seed= text: a number as itself, any other text folded to 32 bits. */
export function seedFromText(text) {
  const raw = String(text ?? '').trim();
  if (raw === '') return 1;
  const numeric = Number(raw);
  if (Number.isFinite(numeric)) {
    const whole = Math.abs(Math.trunc(numeric)) >>> 0;
    return whole === 0 ? 1 : whole;
  }
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || 1;
}

/** The generators the rules and the visuals share: next, range, int, angle, pick, sign, spread. */
export function createRandom(seed) {
  const source = seed >>> 0 || 1;
  const next = mulberry32(source);
  return {
    seed: source,
    next,
    range(min, max) {
      return min + (max - min) * next();
    },
    int(min, max) {
      return Math.floor(min + (max - min + 1) * next());
    },
    angle() {
      return next() * Math.PI * 2;
    },
    pick(list) {
      return list[Math.floor(next() * list.length) % list.length];
    },
    sign() {
      return next() < 0.5 ? -1 : 1;
    },
    spread(amount) {
      return (next() * 2 - 1) * amount;
    },
  };
}
