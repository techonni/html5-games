import type { Feed } from './Market';

export type Direction = 'up' | 'down';

export interface TradeType {
  id: 'binary' | 'turbo';
  name: string;
  profit: number;
  durations: number[];
}

export const TRADE_TYPES: TradeType[] = [
  { id: 'binary', name: 'Binary', profit: 0.85, durations: [60, 120, 180, 300, 600, 900] },
  { id: 'turbo', name: 'Turbo', profit: 0.8, durations: [30, 60, 120, 300] },
];

export interface Position {
  id: number;
  marketId: string;
  type: TradeType['id'];
  dir: Direction;
  stake: number;
  payout: number;
  entry: number;
  start: number;
  expiry: number;
  exit?: number;
  result?: 'win' | 'loss' | 'tie';
  pnl?: number;
}

const KEY = 'zunrel-binary:v2';
export const START_BALANCE = 10_000;

interface Saved {
  balance: number;
  closed: Position[];
  open?: Position[];
}

/**
 * Carteira demo e contratos "tudo ou nada": no vencimento compara a cotação
 * desse segundo com a de entrada. Ganha o lucro fixo, perde a aposta, empate devolve.
 */
export class Book {
  balance = START_BALANCE;
  open: Position[] = [];
  closed: Position[] = [];
  onChange: (() => void) | null = null;
  onSettle: ((p: Position) => void) | null = null;
  private nextId = 1;

  constructor(private readonly feed: Feed) {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Saved | null;
      if (s && Number.isFinite(s.balance)) {
        // Contratos que ficaram abertos ao fechar a app são anulados e a aposta devolvida.
        this.balance = s.balance + (s.open ?? []).reduce((sum, p) => sum + p.stake, 0);
        this.closed = s.closed ?? [];
        this.nextId = this.closed.reduce((m, p) => Math.max(m, p.id), 0) + 1;
      }
    } catch {
      /* ignorar */
    }
  }

  buy(marketId: string, type: TradeType, dir: Direction, stake: number, duration: number): Position | null {
    if (stake > this.balance + 1e-9) return null;
    const m = this.feed.get(marketId);
    const start = this.feed.now;
    const p: Position = {
      id: this.nextId++,
      marketId,
      type: type.id,
      dir,
      stake,
      payout: Math.round(stake * (1 + type.profit) * 100) / 100,
      entry: m.last.q,
      start,
      expiry: start + duration,
    };
    this.balance = Math.round((this.balance - stake) * 100) / 100;
    this.open.push(p);
    this.save();
    return p;
  }

  /** Chamado a cada segundo pelo feed. */
  settleDue(t: number): void {
    const due = this.open.filter((p) => p.expiry <= t);
    if (!due.length) return;
    for (const p of due) {
      const exit = this.feed.get(p.marketId).quoteAt(p.expiry);
      p.exit = exit;
      if (exit === p.entry) p.result = 'tie';
      else p.result = (exit > p.entry) === (p.dir === 'up') ? 'win' : 'loss';
      const credit = p.result === 'win' ? p.payout : p.result === 'tie' ? p.stake : 0;
      p.pnl = Math.round((credit - p.stake) * 100) / 100;
      this.balance = Math.round((this.balance + credit) * 100) / 100;
      this.closed.unshift(p);
      this.onSettle?.(p);
    }
    this.open = this.open.filter((p) => p.expiry > t);
    this.closed = this.closed.slice(0, 50);
    this.save();
  }

  /** Estado provisório de um contrato aberto (a ganhar / a perder). */
  winning(p: Position): boolean | null {
    const q = this.feed.get(p.marketId).last.q;
    if (q === p.entry) return null;
    return (q > p.entry) === (p.dir === 'up');
  }

  reset(): void {
    this.balance = START_BALANCE;
    this.open = [];
    this.closed = [];
    this.save();
  }

  private save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify({ balance: this.balance, closed: this.closed, open: this.open } satisfies Saved));
    } catch {
      /* ignorar */
    }
    this.onChange?.();
  }
}
