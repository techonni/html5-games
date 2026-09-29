const money = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pad = (n: number) => String(n).padStart(2, '0');

export const fmt = (n: number): string => money.format(n);
export const fmtMult = (m: number): string => `${m.toFixed(2)}×`;
export const fmtEur = (n: number): string => `€${money.format(n)}`;
export const fmtSigned = (n: number): string => `${n > 0 ? '+' : n < 0 ? '−' : ''}${money.format(Math.abs(n))}`;
export const fmtQuote = (q: number, decimals: number): string => q.toFixed(decimals);

/** Arredonda para baixo a 2 casas (pagamentos nunca arredondam a favor do jogador). */
export const floor2 = (n: number): number => Math.floor(n * 100 + 1e-9) / 100;
export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Hora local HH:MM:SS a partir de segundos epoch. */
export const fmtClock = (epoch: number): string => {
  const d = new Date(epoch * 1000);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};
export const fmtDuration = (s: number): string => (s < 60 ? `${s}s` : s % 60 === 0 ? `${s / 60}m` : `${Math.floor(s / 60)}m ${s % 60}s`);
export const fmtCountdown = (s: number): string => `${Math.floor(s / 60)}:${pad(Math.max(0, Math.floor(s % 60)))}`;
