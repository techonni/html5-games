const money = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmt = (n: number): string => money.format(n);

export const fmtEur = (n: number): string => `€${money.format(n)}`;

export const fmtSigned = (n: number): string => `${n > 0 ? '+' : n < 0 ? '−' : ''}${money.format(Math.abs(n))}`;

export const fmtQuote = (q: number, decimals: number): string => q.toFixed(decimals);

const pad = (n: number) => String(n).padStart(2, '0');

/** Hora local HH:MM:SS a partir de segundos epoch. */
export const fmtClock = (epoch: number): string => {
  const d = new Date(epoch * 1000);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

/** Duração curta: 45s, 1m, 1:05 (contagem). */
export const fmtDuration = (s: number): string => (s < 60 ? `${s}s` : s % 60 === 0 ? `${s / 60}m` : `${Math.floor(s / 60)}m ${s % 60}s`);

export const fmtCountdown = (s: number): string => `${Math.floor(s / 60)}:${pad(Math.max(0, Math.floor(s % 60)))}`;

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
