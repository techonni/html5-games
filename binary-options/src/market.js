// Motor de preços sintético: 1 tick por segundo, movimento browniano geométrico.
// A volatilidade anual (ex.: 100%) é convertida para desvio padrão por segundo.
const SECONDS_PER_YEAR = 365 * 24 * 3600;

export const MARKETS = [
  { id: 'R_10', name: 'Volatility 10 (1s) Index', badge: '10', vol: 0.1, start: 6254.37, decimals: 2 },
  { id: 'R_25', name: 'Volatility 25 (1s) Index', badge: '25', vol: 0.25, start: 3521.842, decimals: 3 },
  { id: 'R_50', name: 'Volatility 50 (1s) Index', badge: '50', vol: 0.5, start: 243.1873, decimals: 4 },
  { id: 'R_75', name: 'Volatility 75 (1s) Index', badge: '75', vol: 0.75, start: 12045.61, decimals: 2 },
  { id: 'R_90', name: 'Volatility 90 (1s) Index', badge: '90', vol: 0.9, start: 21860.247, decimals: 3 },
  { id: 'R_100', name: 'Volatility 100 (1s) Index', badge: '100', vol: 1, start: 985.58, decimals: 2 },
];

function gaussian() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export class Market {
  constructor(def, historySeconds = 4 * 3600) {
    Object.assign(this, def);
    this.sigma = def.vol / Math.sqrt(SECONDS_PER_YEAR);
    this.ticks = [];
    // Histórico gerado para trás a partir do preço inicial, para o gráfico de velas ter dados.
    const now = Math.floor(Date.now() / 1000);
    let q = def.start;
    const back = [];
    for (let i = 0; i < historySeconds; i++) {
      back.push({ epoch: now - i, quote: this.round(q) });
      q = q / Math.exp(this.sigma * gaussian());
    }
    this.ticks = back.reverse();
    this.maxTicks = historySeconds + 600;
  }

  round(q) {
    const f = 10 ** this.decimals;
    return Math.round(q * f) / f;
  }

  get last() {
    return this.ticks[this.ticks.length - 1];
  }

  step(epoch) {
    const prev = this.last;
    let q = prev.quote;
    // Preenche segundos em falta (ex.: separador em segundo plano).
    for (let e = prev.epoch + 1; e <= epoch; e++) {
      q = this.round(q * Math.exp(this.sigma * gaussian()));
      this.ticks.push({ epoch: e, quote: q });
    }
    if (this.ticks.length > this.maxTicks) this.ticks.splice(0, this.ticks.length - this.maxTicks);
  }

  // Velas OHLC agregadas por intervalo (segundos).
  candles(interval, fromEpoch) {
    const out = [];
    let cur = null;
    for (const t of this.ticks) {
      if (t.epoch < fromEpoch) continue;
      const start = t.epoch - (t.epoch % interval);
      if (!cur || cur.epoch !== start) {
        cur = { epoch: start, open: t.quote, high: t.quote, low: t.quote, close: t.quote };
        out.push(cur);
      } else {
        cur.high = Math.max(cur.high, t.quote);
        cur.low = Math.min(cur.low, t.quote);
        cur.close = t.quote;
      }
    }
    return out;
  }
}

// Relógio único que avança todos os mercados a cada segundo.
export class Feed extends EventTarget {
  constructor() {
    super();
    this.markets = Object.fromEntries(MARKETS.map((m) => [m.id, new Market(m)]));
    const loop = () => {
      const epoch = Math.floor(Date.now() / 1000);
      for (const m of Object.values(this.markets)) m.step(epoch);
      this.dispatchEvent(new CustomEvent('tick', { detail: epoch }));
      setTimeout(loop, 1000 - (Date.now() % 1000) + 5);
    };
    setTimeout(loop, 1000 - (Date.now() % 1000) + 5);
  }
}
