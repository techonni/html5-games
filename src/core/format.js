export const money = (n) =>
  Number(n).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const mult = (n) => `${Number(n).toFixed(2)}×`;

export const round2 = (n) => Math.round(n * 100) / 100;
