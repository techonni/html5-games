export const ease = {
  linear: (t) => t,
  outCubic: (t) => 1 - (1 - t) ** 3,
  outQuart: (t) => 1 - (1 - t) ** 4,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  outBack: (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
  },
};

// Anima de 0 a 1 em `duration` ms no ticker dado; resolve quando termina.
export function tween(ticker, duration, onUpdate, easing = ease.outCubic) {
  return new Promise((resolve) => {
    let elapsed = 0;
    const step = (t) => {
      elapsed += t.deltaMS;
      const p = Math.min(1, elapsed / duration);
      onUpdate(easing(p), p);
      if (p >= 1) {
        ticker.remove(step);
        resolve();
      }
    };
    ticker.add(step);
  });
}

export const lerp = (a, b, t) => a + (b - a) * t;
