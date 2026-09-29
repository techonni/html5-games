import { Container, FillGradient, Graphics, type Text } from 'pixi.js';
import { C, R } from '../core/theme';
import { makeText } from '../core/text';
import { fmtMult } from '../core/format';

const areaGrad = () =>
  new FillGradient({
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
    colorStops: [
      { offset: 0, color: 'rgba(59,130,246,0.35)' },
      { offset: 1, color: 'rgba(59,130,246,0)' },
    ],
  });

export interface Thumb extends Container {
  layout(w: number, h: number): void;
  tick(dtMs: number): void;
}

/** Miniatura animada do Crash: a curva sobe, rebenta e recomeça. */
export class CrashThumb extends Container implements Thumb {
  private readonly bg = new Graphics();
  private readonly area = new Graphics();
  private readonly line = new Graphics();
  private readonly ball = new Graphics().circle(0, 0, 8).fill(C.text);
  private readonly mult: Text;
  private readonly pills = new Graphics();
  private readonly pillTexts: Text[] = [];
  private readonly lineGrad = new FillGradient({
    start: { x: 0, y: 0.5 },
    end: { x: 1, y: 0.5 },
    colorStops: [
      { offset: 0, color: C.curveStart },
      { offset: 1, color: C.multBlue },
    ],
  });
  private readonly fill = areaGrad();
  private w = 300;
  private h = 180;
  private t = 0;
  private crashAt = 2.4;
  private dead = 0;

  constructor() {
    super();
    this.mult = makeText('1.00×', {
      fontSize: 40,
      fontWeight: '900',
      fill: C.text,
      stroke: { color: C.multBlue, width: 5, join: 'round' },
      dropShadow: { color: C.multBlue, distance: 4, angle: Math.PI / 2, blur: 0, alpha: 1 },
      padding: 8,
    });
    this.mult.anchor.set(0.5);
    ['1.44×', '2.45×', '10.02×'].forEach((s, i) => {
      const t = makeText(s, { fontSize: 12, fontWeight: '700', fill: i ? C.winText : C.text });
      t.anchor.set(0.5);
      this.pillTexts.push(t);
    });
    this.addChild(this.bg, this.pills, ...this.pillTexts, this.area, this.line, this.ball, this.mult);
  }

  layout(w: number, h: number): void {
    this.w = w;
    this.h = h;
    this.bg.clear().roundRect(0, 0, w, h, R.panel).fill(C.bgStage);
    this.pills.clear();
    this.pillTexts.forEach((t, i) => {
      const pw = 64;
      const x = 14 + i * (pw + 8);
      this.pills.roundRect(x, 14, pw, 26, 13).fill(i ? C.win : C.btnSecondary);
      t.position.set(x + pw / 2, 27);
    });
    this.mult.position.set(w / 2, h * 0.46);
    this.mult.scale.set(Math.min(1.4, w / 320));
  }

  tick(dt: number): void {
    if (this.dead > 0) {
      this.dead -= dt;
      if (this.dead <= 0) {
        this.t = 0;
        this.crashAt = 1.3 + Math.random() * 3;
        this.mult.style.stroke = { color: C.multBlue, width: 5, join: 'round' };
        this.mult.style.dropShadow = { color: C.multBlue, distance: 4, angle: Math.PI / 2, blur: 0, alpha: 1 };
      }
      return;
    }
    this.t += dt;
    let m = Math.exp(0.00018 * this.t);
    if (m >= this.crashAt) {
      m = this.crashAt;
      this.dead = 1400;
      this.mult.style.stroke = { color: C.multRed, width: 5, join: 'round' };
      this.mult.style.dropShadow = { color: C.multRed, distance: 4, angle: Math.PI / 2, blur: 0, alpha: 1 };
    }
    this.mult.text = fmtMult(Math.floor(m * 100) / 100);
    const x0 = 18;
    const y1 = this.h - 18;
    const x1 = this.w - 24;
    const y0 = 54;
    const tMax = Math.max(6000, this.t / 0.85);
    const yMax = Math.max(1.8, 1 + (m - 1) / 0.8);
    const pts: number[] = [];
    for (let i = 0; i <= 32; i++) {
      const t = (this.t * i) / 32;
      pts.push(x0 + (t / tMax) * (x1 - x0), y1 - ((Math.exp(0.00018 * t) - 1) / (yMax - 1)) * (y1 - y0));
    }
    const tx = pts[pts.length - 2];
    const ty = pts[pts.length - 1];
    const dead = this.dead > 0;
    this.area.clear().poly([...pts, tx, y1, x0, y1]).fill(dead ? { color: C.curveDead, alpha: 0.2 } : this.fill);
    this.line.clear().moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) this.line.lineTo(pts[i], pts[i + 1]);
    this.line.stroke(dead ? { width: 5, color: C.curveDead, cap: 'round' } : { width: 5, fill: this.lineGrad, cap: 'round', join: 'round' });
    this.ball.position.set(tx, ty);
    this.ball.visible = !dead;
  }
}

/** Miniatura animada do Binary: cotação a deslizar com etiqueta e linha de entrada. */
export class BinaryThumb extends Container implements Thumb {
  private readonly bg = new Graphics();
  private readonly grid = new Graphics();
  private readonly area = new Graphics();
  private readonly line = new Graphics();
  private readonly entry = new Graphics();
  private readonly dot = new Graphics().circle(0, 0, 5).fill(C.line);
  private readonly tag = new Graphics();
  private readonly tagText: Text;
  private readonly fill = areaGrad();
  private readonly pts: number[] = [];
  private w = 300;
  private h = 180;
  private acc = 0;
  private q = 1.0852;
  private entryQ = 1.085;

  constructor() {
    super();
    for (let i = 0; i < 40; i++) this.pts.push(this.walk());
    this.tagText = makeText('', { fontSize: 13, fontWeight: '700', fill: C.text });
    this.tagText.anchor.set(0.5);
    this.addChild(this.bg, this.grid, this.area, this.entry, this.line, this.dot, this.tag, this.tagText);
  }

  private walk(): number {
    this.q += (Math.random() - 0.5) * 0.00012;
    return this.q;
  }

  layout(w: number, h: number): void {
    this.w = w;
    this.h = h;
    this.bg.clear().roundRect(0, 0, w, h, R.panel).fill(C.bgStage);
    this.grid.clear();
    for (let i = 1; i < 4; i++) this.grid.moveTo(14, (h * i) / 4).lineTo(w - 70, (h * i) / 4);
    this.grid.stroke({ width: 1, color: C.grid });
  }

  tick(dt: number): void {
    this.acc += dt;
    if (this.acc > 700) {
      this.acc = 0;
      this.pts.push(this.walk());
      this.pts.shift();
      if (Math.random() < 0.05) this.entryQ = this.q;
    }
    const lo = Math.min(...this.pts, this.entryQ) - 0.0001;
    const hi = Math.max(...this.pts, this.entryQ) + 0.0001;
    const x0 = 14;
    const x1 = this.w * 0.62;
    const Y = (v: number) => this.h - 22 - ((v - lo) / (hi - lo)) * (this.h - 50);
    const step = (x1 - x0) / (this.pts.length - 1);
    const shift = (this.acc / 700) * step;
    const xy: number[] = [];
    this.pts.forEach((v, i) => xy.push(x0 + i * step - shift, Y(v)));
    const lx = xy[xy.length - 2];
    const ly = xy[xy.length - 1];
    this.area.clear().poly([...xy, lx, this.h - 10, xy[0], this.h - 10]).fill(this.fill);
    this.line.clear().moveTo(xy[0], xy[1]);
    for (let i = 2; i < xy.length; i += 2) this.line.lineTo(xy[i], xy[i + 1]);
    this.line.lineTo(this.w - 66, ly).stroke({ width: 2, color: C.line, join: 'round' });
    const ey = Y(this.entryQ);
    this.entry.clear();
    for (let x = x0; x < this.w - 70; x += 9) this.entry.moveTo(x, ey).lineTo(x + 5, ey);
    this.entry.stroke({ width: 2, color: this.q >= this.entryQ ? C.up : C.down });
    this.dot.position.set(lx, ly);
    this.tagText.text = this.q.toFixed(5);
    const tw = this.tagText.width + 16;
    this.tag.clear().roundRect(this.w - 8 - tw, ly - 14, tw, 28, 6).fill(C.btnPrimary);
    this.tagText.position.set(this.w - 8 - tw / 2, ly);
  }
}
