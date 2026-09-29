// Aleatoriedade criptográfica: número uniforme em [0, 1).
const buf = new Uint32Array(1);
export function random() {
  crypto.getRandomValues(buf);
  return buf[0] / 4294967296;
}

export function randInt(n) {
  return Math.floor(random() * n);
}

// Distribuição "crash/limbo" com 1% de vantagem da casa: P(resultado >= x) = 0.99 / x.
export function crashPoint() {
  const r = random();
  return Math.max(1, Math.floor((99 / (1 - r))) / 100);
}
