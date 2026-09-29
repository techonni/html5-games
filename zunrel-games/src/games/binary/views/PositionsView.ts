import { Container, Graphics, type Text } from 'pixi.js';
import { C, R } from '../theme';
import { makeText } from '../text';
import { fmtCountdown, fmtEur, fmtQuote, fmtSigned } from '../format';
import type { Feed } from '../market/Market';
import type { Book, Position } from '../market/Trades';
import { ScrollBox } from '../ui/ScrollBox';
import { Segmented } from '../ui/Segmented';

const CARD_H = 96;

/** Separador "Posições": contratos abertos (ao vivo) e fechados. */
export class PositionsView extends Container {
  private readonly tabs = new Segmented([{ label: 'Abertas' }, { label: 'Fechadas' }], 17);
  private readonly summary: Text;
  private readonly list = new ScrollBox();
  private w = 360;

  constructor(private readonly feed: Feed, private readonly book: Book) {
    super();
    this.summary = makeText('', { fontSize: 15, fontWeight: '600', fill: C.textMuted });
    this.tabs.onChange = () => {
      this.list.content.y = 0;
      this.refresh();
    };
    this.addChild(this.tabs, this.summary, this.list);
  }

  layout(w: number, h: number): void {
    this.w = w;
    this.tabs.layout(w, 50);
    this.summary.position.set(4, 64);
    this.list.position.set(0, 96);
    this.list.layout(w, h - 96);
    this.refresh();
  }

  showOpen(): void {
    this.tabs.select(0, true);
  }

  refresh(): void {
    const open = this.tabs.index === 0;
    const items = open ? this.book.open.slice().reverse() : this.book.closed;
    const pnl = this.book.closed.reduce((s, p) => s + (p.pnl ?? 0), 0);
    this.summary.text = open
      ? `${items.length} contrato(s) aberto(s) · em jogo ${fmtEur(items.reduce((s, p) => s + p.stake, 0))}`
      : `${items.length} fechado(s) · resultado ${fmtSigned(pnl)} EUR`;

    const c = this.list.content;
    c.removeChildren().forEach((ch) => ch.destroy({ children: true }));
    if (!items.length) {
      const empty = makeText(open ? 'Sem contratos abertos.\nCompra no separador Negociar.' : 'Ainda não há contratos fechados.', {
        fontSize: 16,
        fontWeight: '500',
        fill: C.textPlaceholder,
        align: 'center',
      });
      empty.anchor.set(0.5, 0);
      empty.position.set(this.w / 2, 40);
      c.addChild(empty);
    }
    items.forEach((p, i) => {
      const card = this.card(p);
      card.y = i * (CARD_H + 10);
      c.addChild(card);
    });
    this.list.refresh();
  }

  private card(p: Position): Container {
    const m = this.feed.get(p.marketId);
    const dec = m.def.decimals;
    const w = this.w;
    const card = new Container();
    const up = p.dir === 'up';
    const bg = new Graphics().roundRect(0, 0, w, CARD_H, R.panel).fill(C.bgPanel);
    const stripe = new Graphics().roundRect(0, 0, 6, CARD_H, 3).fill(up ? C.up : C.down);
    const name = makeText(`${m.def.name} · ${p.type === 'binary' ? 'Binary' : 'Turbo'}`, {
      fontSize: 16,
      fontWeight: '700',
      fill: C.text,
    });
    name.position.set(20, 14);
    const dir = makeText(`${up ? '▲ Sobe' : '▼ Desce'}  ·  ${fmtEur(p.stake)} → ${fmtEur(p.payout)}`, {
      fontSize: 14,
      fontWeight: '600',
      fill: up ? C.up : C.down,
    });
    dir.position.set(20, 42);
    const now = this.feed.get(p.marketId).last.q;
    const quotes = makeText(`Entrada ${fmtQuote(p.entry, dec)}  ·  ${p.exit !== undefined ? 'Saída' : 'Atual'} ${fmtQuote(p.exit ?? now, dec)}`, {
      fontSize: 14,
      fontWeight: '500',
      fill: C.textMuted,
    });
    quotes.position.set(20, 66);

    let rightText: string;
    let rightColor: number = C.text;
    if (p.result) {
      rightText = p.result === 'tie' ? 'Empate' : fmtSigned(p.pnl ?? 0);
      rightColor = p.result === 'win' ? C.up : p.result === 'loss' ? C.down : C.textMuted;
    } else {
      rightText = fmtCountdown(p.expiry - this.feed.now);
      const w = this.book.winning(p);
      rightColor = w === null ? C.text : w ? C.up : C.down;
    }
    const right = makeText(rightText, { fontSize: 20, fontWeight: '800', fill: rightColor });
    right.anchor.set(1, 0);
    right.position.set(w - 16, 12);
    card.addChild(bg, stripe, name, dir, quotes, right);
    return card;
  }
}
