import { Container, Graphics, Rectangle, type Text } from 'pixi.js';
import gsap from 'gsap';
import { C, R } from '../theme';
import { makeText } from '../text';
import { fmtQuote } from '../format';
import type { Feed, Market } from '../market/Market';
import { ScrollBox } from '../ui/ScrollBox';
import { sound } from '../audio/Sound';

const ROW_H = 84;

interface Row {
  m: Market;
  price: Text;
  change: Text;
  spark: Graphics;
}

/** Separador "Início": lista de mercados com preço, variação e minigráfico. */
export class HomeView extends Container {
  onSelect: ((id: string) => void) | null = null;
  private readonly title: Text;
  private readonly note: Text;
  private readonly list = new ScrollBox();
  private rows: Row[] = [];
  private w = 360;

  constructor(private readonly feed: Feed) {
    super();
    this.title = makeText('Mercados', { fontSize: 26, fontWeight: '800', fill: C.text });
    this.note = makeText('Forex · cotações demo, 1 tick por segundo', { fontSize: 15, fontWeight: '500', fill: C.textMuted });
    this.addChild(this.title, this.note, this.list);
  }

  layout(w: number, h: number): void {
    this.w = w;
    this.title.position.set(4, 0);
    this.note.position.set(4, 38);
    this.list.position.set(0, 76);
    this.list.layout(w, h - 76);
    this.build();
  }

  private build(): void {
    const c = this.list.content;
    c.removeChildren().forEach((ch) => ch.destroy({ children: true }));
    this.rows = this.feed.markets.map((m, i) => {
      const row = new Container();
      row.y = i * (ROW_H + 10);
      const bg = new Graphics().roundRect(0, 0, this.w, ROW_H, R.panel).fill(C.bgPanel);
      const badge = new Graphics().roundRect(16, 20, 48, 44, 10).fill(C.btnSecondary);
      const bt = makeText(m.def.badge, { fontSize: 16, fontWeight: '800', fill: C.text });
      bt.anchor.set(0.5);
      bt.position.set(40, 42);
      const name = makeText(m.def.name, { fontSize: 17, fontWeight: '700', fill: C.text });
      name.position.set(78, 14);
      const full = makeText(m.def.full, { fontSize: 13, fontWeight: '500', fill: C.textPlaceholder });
      full.position.set(78, 36);
      const price = makeText('', { fontSize: 15, fontWeight: '600', fill: C.textMuted });
      price.position.set(78, 54);
      const change = makeText('', { fontSize: 15, fontWeight: '700', fill: C.up });
      change.anchor.set(1, 0);
      change.position.set(this.w - 16, 46);
      const spark = new Graphics();
      spark.position.set(this.w - 106, 16);
      row.addChild(bg, badge, bt, name, full, price, change, spark);
      row.eventMode = 'static';
      row.cursor = 'pointer';
      row.hitArea = new Rectangle(0, 0, this.w, ROW_H);
      row.on('pointertap', () => {
        if (this.list.dragged) return;
        sound.play('click');
        gsap.fromTo(row.scale, { x: 0.97, y: 0.97 }, { x: 1, y: 1, duration: 0.3, ease: 'back.out(3)' });
        this.onSelect?.(m.id);
      });
      c.addChild(row);
      return { m, price, change, spark };
    });
    this.refresh();
  }

  refresh(): void {
    for (const r of this.rows) {
      const q = r.m.last.q;
      const ch = ((q - r.m.open) / r.m.open) * 100;
      r.price.text = fmtQuote(q, r.m.def.decimals);
      r.change.text = `${ch >= 0 ? '+' : '−'}${Math.abs(ch).toFixed(2)}%`;
      r.change.style.fill = ch >= 0 ? C.up : C.down;
      const pts = r.m.ticks.slice(-60).map((t) => t.q);
      const lo = Math.min(...pts);
      const hi = Math.max(...pts);
      const g = r.spark.clear();
      pts.forEach((v, i) => {
        const x = (i / (pts.length - 1)) * 90;
        const y = 22 - ((v - lo) / (hi - lo || 1)) * 20;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      });
      g.stroke({ width: 1.6, color: ch >= 0 ? C.up : C.down, join: 'round' });
    }
  }
}
