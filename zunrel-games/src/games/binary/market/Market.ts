/** Pares de forex (cotações demo simuladas): 1 tick por segundo, movimento log-normal. */
export interface MarketDef {
  id: string;
  name: string;
  badge: string;
  /** Descrição curta do par (ex.: "Euro / Dólar americano"). */
  full: string;
  vol: number;
  start: number;
  decimals: number;
}

export const MARKETS: MarketDef[] = [
  { id: 'EURUSD', name: 'EUR/USD', badge: 'EUR', full: 'Euro / Dólar americano', vol: 0.08, start: 1.0852, decimals: 5 },
  { id: 'GBPUSD', name: 'GBP/USD', badge: 'GBP', full: 'Libra / Dólar americano', vol: 0.09, start: 1.2718, decimals: 5 },
  { id: 'USDJPY', name: 'USD/JPY', badge: 'JPY', full: 'Dólar americano / Iene', vol: 0.1, start: 149.62, decimals: 3 },
];

export interface Tick {
  t: number;
  q: number;
}

const SECONDS_PER_YEAR = 365 * 24 * 3600;
// Demo: o tempo corre mais depressa do que no mercado real, para os ticks de 1 s se verem mexer.
const SPEED = 16;
const KEEP_TICKS = 600;

function gaussian(): number {
  const u = crypto.getRandomValues(new Uint32Array(2));
  const a = (u[0] + 1) / 2 ** 32;
  const b = u[1] / 2 ** 32;
  return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * b);
}

export class Market {
  readonly sigma: number;
  ticks: Tick[] = [];
  /** Preço de abertura da sessão (para a variação %). */
  open: number;

  constructor(readonly def: MarketDef, now: number) {
    this.sigma = (def.vol * Math.sqrt(SPEED)) / Math.sqrt(SECONDS_PER_YEAR);
    // 1 h de histórico: variação da sessão e minigráficos logo ao abrir.
    const back = 3600;
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
