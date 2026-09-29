/** Cryptographic uniform random in [0, 1). */
const buf = new Uint32Array(1);

export function random() {
  crypto.getRandomValues(buf);
  return buf[0] / 4294967296;
}

/**
 * Crash point with ~1% house edge (RTP 99%):
 * P(crash >= x) ≈ 0.99 / x  for x >= 1
 */
export function crashPoint() {
  const r = random();
  return Math.max(1, Math.floor(99 / (1 - r)) / 100);
}

export function randInt(min, max) {
  return Math.floor(random() * (max - min + 1)) + min;
}
