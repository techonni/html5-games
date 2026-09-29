import { Container, FillGradient, Graphics, Rectangle, type Text } from 'pixi.js';
import gsap from 'gsap';
import { C, R } from '../theme';
import { makeText } from '../text';
import { fmtClock, fmtCountdown, fmtQuote } from '../format';
import type { Interval, Market } from '../market/Market';
import type { Position } from '../market/Trades';
import { sound } from '../audio/Sound';

const WINDOW_S = 16; // segundos de histórico visíveis no modo ticks
const NOW_FRAC = 0.56; // posição horizontal do "agora"
const CANDLES = 28;
const AXIS_W = 78;

function niceStep(range: number): number {
  const raw = range / 4;
  const p = 10 ** Math.floor(Math.log10(raw));
  const f = raw / p;
  return (f < 1.5 ? 1 : f < 3.5 ? 2.5 : f < 7.5 ? 5 : 10) * p;
}

/** Circulo com ícone, usado nos botões flutuantes do gráfico. */
function roundButton(draw: (g: Graphics) => void): Container {
  const c = new Container();
  c.addChild(new Graphics().circle(0, 0, 26).fill(C.bgPanel));
  const g = new Graphics();
  draw(g);
  c.addChild(g);
  c.eventMode = 'static';
  c.cursor = 'pointer';
  c.hitArea = new Rectangle(-28, -28, 56, 56);
  c.on('pointerdown', () => gsap.fromTo(c.scale, { x: 0.88, y: 0.88 }, { x: 1, y: 1, duration: 0.3, ease: 'back.out(3)' }));
  return c;
}

/** Gráfico em Pixi: linha de ticks com área em gradiente ou velas de 1/5 min, etiqueta de preço e contratos abertos. */
export class Chart extends Container {
  onMenu: (() => void) | null = null;
  onExpand: (() => void) | null = null;

  private readonly bg = new Graphics();
  private readonly plotLayer = new Container();
  private readonly clip = new Graphics();
  private readonly grid = new Graphics();
  private readonly area = new Graphics();
  private readonly line = new Graphics();
  private readonly candlesG = new Graphics();
  private readonly entries = new Graphics();
  private readonly entryLabels = new Container();
  private readonly dot = new Graphics();
  private readonly tag = new Container();
  private readonly tagBg = new Graphics();
  private readonly tagText: Text;
  private readonly yLabels: Text[] = [];
  private readonly xLabels: Text[] = [];
  private readonly menuBtn: Container;
  private readonly badgeText: Text;
  private readonly expandBtn: Container;
  private readonly areaGrad = new FillGradient({
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
    colorStops: [
      { offset: 0, color: 'rgba(59,130,246,0.28)' },
      { offset: 1, color: 'rgba(59,130,246,0)' },
    ],
  });

  private market!: Market;
  private interval: Interval = 0;
  private positions: Position[] = [];
  private readonly shown = { q: 0 };
  private yMin = 0;
  private yMax = 1;
  private w = 360;
  private plot = { x0: 0, y0: 0, x1: 1, y1: 1 };

  constructor() {
    super();
    this.tagText = makeText('', { fontSize: 17, fontWeight: '700', fill: C.text });
    this.tagText.anchor.set(0.5);
    this.tag.addChild(this.tagBg, this.tagText);
    for (let i = 0; i < 8; i++) {
      const y = makeText('', { fontSize: 14, fontWeight: '500', fill: C.textMuted });
      y.anchor.set(0, 0.5);
      const x = makeText('', { fontSize: 14, fontWeight: '500', fill: C.textMuted });
      x.anchor.set(0.5, 0);
      this.yLabels.push(y);
      this.xLabels.push(x);
    }

    this.menuBtn = roundButton((g) => {
      for (const dy of [-7, 0, 7]) g.circle(0, dy, 2.4).fill(C.text);
    });
    const badge = new Container();
    badge.addChild(new Graphics().circle(0, 0, 13).fill(C.btnPrimary));
    this.badgeText = makeText('1t', { fontSize: 12, fontWeight: '700', fill: C.text });
    this.badgeText.anchor.set(0.5);
    badge.addChild(this.badgeText);
    badge.position.set(18, -22);
    this.menuBtn.addChild(badge);
    this.menuBtn.on('pointertap', () => {
      sound.play('click');
      this.onMenu?.();
    });
    this.expandBtn = roundButton((g) => {
      g.moveTo(3, -3).lineTo(10, -10).moveTo(4, -10).lineTo(10, -10).lineTo(10, -4);
      g.moveTo(-3, 3).lineTo(-10, 10).moveTo(-10, 4).lineTo(-10, 10).lineTo(-4, 10);
      g.stroke({ width: 2.2, color: C.text, cap: 'round', join: 'round' });
    });
    this.expandBtn.on('pointertap', () => {
      sound.play('click');
      this.onExpand?.();
    });

    this.plotLayer.addChild(this.grid, ...this.yLabels, ...this.xLabels, this.area, this.candlesG, this.entries, this.line, this.dot, this.entryLabels);
    this.plotLayer.mask = this.clip;
    this.addChild(this.bg, this.plotLayer, this.clip, this.tag, this.menuBtn, this.expandBtn);
    this.dot.circle(0, 0, 7).fill(C.line);
  }

  setMarket(m: Market): void {
    this.market = m;
    this.shown.q = m.last.q;
    this.fitRange(true);
  }

  setInterval(iv: Interval): void {
    this.interval = iv;
    this.badgeText.text = iv === 0 ? '1t' : `${iv / 60}m`;
    this.fitRange(true);
  }

  setPositions(list: Position[]): void {
    this.positions = list;
  }

  /** Novo tick do mercado mostrado: a última cotação desliza com GSAP. */
  onTick(): void {
    gsap.to(this.shown, { q: this.market.last.q, duration: 0.45, ease: 'power2.out' });
  }

  layout(w: number, h: number): void {
    this.w = w;
    this.bg.clear().roundRect(0, 0, w, h, R.panel + 4).fill(C.bgStage);
    this.clip.clear().roundRect(0, 0, w, h, R.panel + 4).fill(0xffffff);
    this.plot = { x0: 22, y0: 40, x1: w - AXIS_W, y1: h - 56 };
    this.menuBtn.position.set(46, h - 92);
    this.expandBtn.position.set(w - AXIS_W - 36, h - 92);
  }

  /** Desenha um frame (chamado pelo ticker). */
  draw(): void {
    if (!this.market) return;
    this.fitRange(false);
    const { x0, y0, x1, y1 } = this.plot;
    const Y = (q: number) => y1 - ((q - this.yMin) / (this.yMax - this.yMin)) * (y1 - y0);
    const dec = this.market.def.decimals;

    // Grelha horizontal com preços à direita
    this.grid.clear();
    const step = niceStep(this.yMax - this.yMin);
    let li = 0;
    for (let v = Math.ceil(this.yMin / step) * step; v <= this.yMax && li < this.yLabels.length; v += step, li++) {
      const y = Y(v);
      this.grid.moveTo(x0 + 8, y).lineTo(x1 + 4, y);
      const t = this.yLabels[li];
      t.visible = true;
      t.text = fmtQuote(v, Math.min(dec, step >= 1 ? 2 : dec));
      t.position.set(this.w - AXIS_W + 10, y);
    }
    for (; li < this.yLabels.length; li++) this.yLabels[li].visible = false;

    const nowT = Date.now() / 1000;
    let lastX: number;
    const lastY = Y(this.shown.q);
    this.area.clear();
    this.line.clear();
    this.candlesG.clear();
    let xi = 0;

    if (this.interval === 0) {
      const pxPerSec = ((x1 - x0) * NOW_FRAC) / WINDOW_S;
      const nowX = x0 + (x1 - x0) * NOW_FRAC;
      const X = (t: number) => nowX - (nowT - t) * pxPerSec;
      // Grelha vertical a cada 5 s
      for (let t = Math.ceil((nowT - WINDOW_S - 4) / 5) * 5; t < nowT + 30 && xi < this.xLabels.length; t += 5) {
        const x = X(t);
        if (x < x0 - 20 || x > x1 + 30) continue;
        this.grid.moveTo(x, y0 - 30).lineTo(x, y1 + 8);
        if (t % 10 !== 0) continue;
        const lab = this.xLabels[xi++];
        lab.visible = true;
        lab.text = fmtClock(t);
        lab.position.set(x, y1 + 20);
      }
      const ticks = this.market.ticks.filter((k) => k.t >= nowT - WINDOW_S - 3);
      const pts: number[] = [];
      ticks.forEach((k, i) => pts.push(X(k.t), i === ticks.length - 1 ? lastY : Y(k.q)));
      lastX = pts[pts.length - 2];
      this.area.poly([...pts, lastX, y1 + 8, pts[0], y1 + 8]).fill(this.areaGrad);
      this.line.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) this.line.lineTo(pts[i], pts[i + 1]);
      this.line.lineTo(this.w - AXIS_W + 20, lastY);
      this.line.stroke({ width: 2.5, color: C.line, join: 'round' });
      this.drawEntries(X, Y, nowT);
    } else {
      const iv = this.interval;
      const list = this.market.candles[iv].slice(-CANDLES);
      const spacing = ((x1 - x0) * 0.9) / CANDLES;
      const X = (i: number) => x0 + (i + 0.5) * spacing;
      list.forEach((c, i) => {
        const x = X(i);
        const isLast = i === list.length - 1;
        const close = isLast ? this.shown.q : c.c;
        const up = close >= c.o;
        const col = up ? C.up : C.down;
        const hi = isLast ? Math.max(c.h, close) : c.h;
        const lo = isLast ? Math.min(c.l, close) : c.l;
        this.candlesG.moveTo(x, Y(hi)).lineTo(x, Y(lo)).stroke({ width: 1.5, color: col });
        const top = Y(Math.max(c.o, close));
        const bh = Math.max(1.5, Y(Math.min(c.o, close)) - top);
        this.candlesG.rect(x - spacing * 0.32, top, spacing * 0.64, bh).fill(col);
        if (i % 7 === 3 && xi < this.xLabels.length) {
          this.grid.moveTo(x, y0 - 30).lineTo(x, y1 + 8);
          const lab = this.xLabels[xi++];
          lab.visible = true;
          lab.text = fmtClock(c.t).slice(0, 5);
          lab.position.set(x, y1 + 20);
        }
      });
      lastX = X(list.length - 1);
      this.line.moveTo(lastX, lastY).lineTo(this.w - AXIS_W + 20, lastY).stroke({ width: 1, color: C.line, alpha: 0.6 });
      this.drawEntries(() => NaN, Y, nowT);
    }
    for (; xi < this.xLabels.length; xi++) this.xLabels[xi].visible = false;
    this.grid.stroke({ width: 1, color: C.grid, alpha: 0.9 });

    // Esconde preços do eixo que ficariam por baixo da etiqueta atual.
    for (const t of this.yLabels) if (t.visible && Math.abs(t.y - lastY) < 26) t.visible = false;
    this.dot.position.set(lastX, lastY);
    this.dot.visible = this.interval === 0;
    this.tagText.text = fmtQuote(this.shown.q, dec);
    const tw = this.tagText.width + 26;
    this.tagBg.clear().roundRect(-tw, -21, tw, 42, 8).fill(C.btnPrimary);
    this.tagText.x = -tw / 2;
    this.tag.position.set(this.w - 10, lastY);
  }

  /** Linhas de entrada dos contratos abertos neste mercado, com contagem. */
  private drawEntries(X: (t: number) => number, Y: (q: number) => number, nowT: number): void {
    const { x0, y0, x1, y1 } = this.plot;
    this.entries.clear();
    const mine = this.positions.filter((p) => p.marketId === this.market.id);
    while (this.entryLabels.children.length < mine.length) {
      const c = new Container();
      c.addChild(new Graphics(), makeText('', { fontSize: 13, fontWeight: '700', fill: C.winText }));
      this.entryLabels.addChild(c);
    }
    this.entryLabels.children.forEach((c, i) => (c.visible = i < mine.length));
    mine.forEach((p, i) => {
      const col = p.dir === 'up' ? C.up : C.down;
      const y = Math.max(y0, Math.min(y1, Y(p.entry)));
      const xs = Number.isNaN(X(p.start)) ? x0 : Math.max(x0, X(p.start));
      const xe = Number.isNaN(X(p.expiry)) ? x1 : Math.min(x1 + 20, X(p.expiry));
      for (let x = xs; x < xe; x += 10) this.entries.moveTo(x, y).lineTo(Math.min(x + 6, xe), y);
      this.entries.stroke({ width: 2, color: col });
      if (!Number.isNaN(X(p.expiry)) && X(p.expiry) <= x1 + 20) {
        this.entries.moveTo(X(p.expiry), y0 - 30).lineTo(X(p.expiry), y1 + 8).stroke({ width: 1.5, color: col, alpha: 0.8 });
      }
      if (!Number.isNaN(X(p.start))) this.entries.circle(X(p.start), Y(p.entry), 5).fill(col);
      const lab = this.entryLabels.children[i] as Container;
      const bg = lab.children[0] as Graphics;
      const t = lab.children[1] as Text;
      t.text = `${p.dir === 'up' ? '▲' : '▼'} ${fmtCountdown(Math.max(0, p.expiry - nowT))}`;
      t.style.fill = p.dir === 'up' ? C.winText : C.text;
      bg.clear().roundRect(-6, -3, t.width + 12, 22, 11).fill(col);
      lab.position.set(x0 + 10 + (i % 3) * 86, y - 26);
    });
  }

  /** Ajusta a escala vertical (suavizada) aos dados visíveis. */
  private fitRange(snap: boolean): void {
    if (!this.market) return;
    const nowT = Date.now() / 1000;
    let lo = Infinity;
    let hi = -Infinity;
    if (this.interval === 0) {
      for (const k of this.market.ticks) if (k.t >= nowT - WINDOW_S - 3) (lo = Math.min(lo, k.q)), (hi = Math.max(hi, k.q));
    } else {
      for (const c of this.market.candles[this.interval].slice(-CANDLES)) (lo = Math.min(lo, c.l)), (hi = Math.max(hi, c.h));
    }
    for (const p of this.positions) if (p.marketId === this.market.id) (lo = Math.min(lo, p.entry)), (hi = Math.max(hi, p.entry));
    lo = Math.min(lo, this.shown.q);
    hi = Math.max(hi, this.shown.q);
    const minRange = this.market.last.q * this.market.sigma * (this.interval === 0 ? 8 : 60);
    const mid = (lo + hi) / 2;
    const half = Math.max(hi - lo, minRange) * 0.62;
    const tMin = mid - half;
    const tMax = mid + half;
    const k = snap ? 1 : 0.08;
    this.yMin += (tMin - this.yMin) * k;
    this.yMax += (tMax - this.yMax) * k;
  }
}
