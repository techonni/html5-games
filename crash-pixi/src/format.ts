const money = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmt = (n: number): string => money.format(n);

export const fmtMult = (m: number): string => `${m.toFixed(2)}×`;

/** Arredonda para baixo a 2 casas (pagamentos nunca arredondam a favor do jogador). */
export const floor2 = (n: number): number => Math.floor(n * 100 + 1e-9) / 100;

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
