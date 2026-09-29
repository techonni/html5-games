/** Índices sintéticos "Volatility (1s)": 1 tick por segundo, movimento log-normal. */
export interface MarketDef {
  id: string;
  name: string;
  badge: string;
  vol: number;
  start: number;
  decimals: number;
}

export const MARKETS: MarketDef[] = [
  { id: 'R_10', name: 'Volatility 10 (1s) Index', badge: '10', vol: 0.1, start: 6254.37, decimals: 2 },
  { id: 'R_25', name: 'Volatility 25 (1s) Index', badge: '25', vol: 0.25, start: 3521.842, decimals: 3 },
  { id: 'R_50', name: 'Volatility 50 (1s) Index', badge: '50', vol: 0.5, start: 243.1873, decimals: 4 },
  { id: 'R_75', name: 'Volatility 75 (1s) Index', badge: '75', vol: 0.75, start: 12045.61, decimals: 2 },
  { id: 'R_100', name: 'Volatility 100 (1s) Index', badge: '100', vol: 1, start: 985.58, decimals: 2 },
];

export interface Tick {
  t: number;
  q: number;
}

export interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
}

export const INTERVALS = [0, 60, 300] as const;
export type Interval = (typeof INTERVALS)[number];

const SECONDS_PER_YEAR = 365 * 24 * 3600;
// Os índices sintéticos são mais nervosos do que a vol anual sugere: fator para ticks visíveis.
const SPEED = 12;
const KEEP_TICKS = 600;
const KEEP_CANDLES = 120;

function gaussian(): number {
  const u = crypto.getRandomValues(new Uint32Array(2));
  const a = (u[0] + 1) / 2 ** 32;
  const b = u[1] / 2 ** 32;
  return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * b);
}

export class Market {
  readonly sigma: number;
  ticks: Tick[] = [];
  readonly candles: Record<60 | 300, Candle[]> = { 60: [], 300: [] };
  /** Preço de abertura da sessão (para a variação %). */
  open: number;

  constructor(readonly def: MarketDef, now: number) {
    this.sigma = (def.vol * Math.sqrt(SPEED)) / Math.sqrt(SECONDS_PER_YEAR);
    // Histórico de 3 h para já haver velas de 5 min ao abrir a app.
    const back = 3 * 3600;
    let q = def.start;
    const past: number[] = [];
    for (let i = 0; i < back; i++) {
      past.push(q);
      q = q / Math.exp(this.sigma * gaussian());
    }
    past.reverse();
    this.open = this.round(past[0]);
    past.forEach((p, i) => this.push({ t: now - back + i, q: this.round(p) }));
  }

  get id(): string {
    return this.def.id;
  }

  get last(): Tick {
    return this.ticks[this.ticks.length - 1];
  }

  round(q: number): number {
    const f = 10 ** this.def.decimals;
    return Math.round(q * f) / f;
  }

  step(t: number): Tick {
    const tick = { t, q: this.round(this.last.q * Math.exp(this.sigma * gaussian())) };
    this.push(tick);
    return tick;
  }

  /** Cotação no segundo exato t (ou a última anterior). */
  quoteAt(t: number): number {
    for (let i = this.ticks.length - 1; i >= 0; i--) if (this.ticks[i].t <= t) return this.ticks[i].q;
    return this.ticks[0].q;
  }

  private push(tick: Tick): void {
    this.ticks.push(tick);
    if (this.ticks.length > KEEP_TICKS) this.ticks.splice(0, this.ticks.length - KEEP_TICKS);
    for (const iv of [60, 300] as const) {
      const list = this.candles[iv];
      const t0 = Math.floor(tick.t / iv) * iv;
      const c = list[list.length - 1];
      if (c && c.t === t0) {
        c.h = Math.max(c.h, tick.q);
        c.l = Math.min(c.l, tick.q);
        c.c = tick.q;
      } else {
        list.push({ t: t0, o: c ? c.c : tick.q, h: tick.q, l: tick.q, c: tick.q });
        if (list.length > KEEP_CANDLES) list.shift();
      }
    }
  }
}

/** Relógio dos mercados: gera um tick por segundo (e recupera segundos perdidos). */
export class Feed {
  readonly markets: Market[];
  private lastSecond: number;
  onTick: ((t: number) => void) | null = null;

  constructor() {
    this.lastSecond = Math.floor(Date.now() / 1000);
    this.markets = MARKETS.map((d) => new Market(d, this.lastSecond));
  }

  get now(): number {
    return this.lastSecond;
  }

  update(): void {
    const sec = Math.floor(Date.now() / 1000);
    // Após o separador ficar escondido muito tempo, limita a recuperação.
    if (sec - this.lastSecond > 600) this.lastSecond = sec - 600;
    while (this.lastSecond < sec) {
      this.lastSecond++;
      for (const m of this.markets) m.step(this.lastSecond);
      this.onTick?.(this.lastSecond);
    }
  }

  get(id: string): Market {
    return this.markets.find((m) => m.id === id) ?? this.markets[0];
  }
}
