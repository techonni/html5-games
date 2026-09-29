import { Container, Graphics, type Text } from 'pixi.js';
import gsap from 'gsap';
import { C } from '../theme';
import { makeText } from '../text';
import { fmtMult } from '../format';

class Pill extends Container {
  private readonly bg = new Graphics();
  private readonly caption: Text;

  constructor(readonly value: number) {
    super();
    const win = value >= 2;
    this.caption = makeText(fmtMult(value), { fontSize: 15, fontWeight: '600', fill: win ? C.winText : C.text });
    this.caption.anchor.set(0.5);
    this.addChild(this.bg, this.caption);
  }

  draw(w: number, h: number): void {
    this.bg.clear().roundRect(0, 0, w, h, h / 2).fill(this.value >= 2 ? C.win : C.btnSecondary);
    this.caption.position.set(w / 2, h / 2);
  }
}

/** Últimos resultados em pílulas (verde ≥ 2×). O mais recente entra pela esquerda. */
export class HistoryBar extends Container {
  static readonly HEIGHT = 40;
  private static readonly GAP = 10;
  private readonly clip = new Graphics();
  private readonly row = new Container();
  private pills: Pill[] = [];
  private w = 320;
  private readonly count: number;

  constructor(count = 4) {
    super();
    this.count = count;
    this.addChild(this.row, this.clip);
    this.row.mask = this.clip;
  }

  private get pillW(): number {
    return (this.w - HistoryBar.GAP * (this.count - 1)) / this.count;
  }

  layout(w: number): void {
    this.w = w;
    this.clip.clear().rect(0, -4, w, HistoryBar.HEIGHT + 8).fill(0xffffff);
    this.pills.forEach((p, i) => {
      gsap.killTweensOf(p);
      p.draw(this.pillW, HistoryBar.HEIGHT);
      p.x = i * (this.pillW + HistoryBar.GAP);
    });
  }

  push(value: number): void {
    const step = this.pillW + HistoryBar.GAP;
    const pill = new Pill(value);
    pill.draw(this.pillW, HistoryBar.HEIGHT);
    pill.x = -step;
    this.row.addChild(pill);
    this.pills.unshift(pill);

    this.pills.forEach((p, i) => gsap.to(p, { x: i * step, duration: 0.45, ease: 'power3.out' }));
    gsap.from(pill.scale, { x: 0.6, y: 0.6, duration: 0.45, ease: 'back.out(2)' });

    for (const old of this.pills.splice(this.count + 1)) {
      gsap.killTweensOf(old);
      old.destroy({ children: true });
    }
  }
}
