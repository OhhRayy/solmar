// A small seeded random number generator (mulberry32) plus the few helpers the city
// builder and the game use, so the same seed always builds the same Solmar.

export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A value in [min, max). */
export function range(random, min, max) {
  return min + random() * (max - min);
}

/** A whole number in [min, max]. */
export function int(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

/** One element of an array. */
export function pick(random, array) {
  return array[Math.floor(random() * array.length)];
}

/** An angle in radians. */
export function angle(random) {
  return random() * Math.PI * 2;
}

/** Wrap an angle to (-PI, PI]. */
export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a <= -Math.PI) a += Math.PI * 2;
  return a;
}

/** Distance between two points. */
export function dist(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}
