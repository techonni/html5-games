import { Application, Container, FillGradient, Graphics, Text } from 'pixi.js';

const COLORS = {
  grid: 0xf2f2f2,
  axis: 0x999999,
  line: 0x000000,
  up: 0x4bb68a,
  down: 0xcc2e3d,
};
const FONT = "'IBM Plex Sans', system-ui, sans-serif";
const SPACING = 23.7; // px por segundo (ticks) ou por vela
const RIGHT_GUTTER = 67;
const PLOT_LEFT = 10;

const pad2 = (n) => String(n).padStart(2, '0');
const hhmmss = (epoch) => {
  const d = new Date(epoch * 1000);
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`;
};

function niceStep(range, count) {
  const raw = range / count;
  const p = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= raw) return m * p;
  return 10 * p;
}

function dashed(g, x1, y1, x2, y2, dash = 4, gap = 4) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 1) return;
  const dx = (x2 - x1) / len;
  const dy = (y2 - y1) / len;
  for (let d = 0; d < len; d += dash + gap) {
    const e = Math.min(len, d + dash);
    g.moveTo(x1 + dx * d, y1 + dy * d).lineTo(x1 + dx * e, y1 + dy * e);
  }
}

// Pool de textos para não recriar objetos a cada frame.
class TextPool {
  constructor(parent, style) {
    this.parent = parent;
    this.style = style;
    this.items = [];
    this.used = 0;
  }
  begin() {
    this.used = 0;
  }
  get(text, x, y, ax, ay) {
    let t = this.items[this.used];
    if (!t) {
      t = new Text({ text, style: this.style });
      this.parent.addChild(t);
      this.items.push(t);
    }
    this.used++;
    if (t.text !== text) t.text = text;
    t.anchor.set(ax, ay);
    t.position.set(Math.round(x), Math.round(y));
    t.visible = true;
    return t;
  }
  end() {
    for (let i = this.used; i < this.items.length; i++) this.items[i].visible = false;
  }
}

export class Chart {
  static async create(host, market) {
    const c = new Chart();
    await c.init(host, market);
    return c;
  }

  async init(host, market) {
    this.host = host;
    this.mode = 'tick'; // 'tick' | 60 | 300
    this.contracts = [];
    this.app = new Application();
    await this.app.init({
      background: 0xffffff,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 3),
      width: Math.max(1, host.clientWidth),
      height: Math.max(1, host.clientHeight),
    });
    host.prepend(this.app.canvas);

    const stage = this.app.stage;
    this.gridG = new Graphics();
    this.series = new Container();
    this.fillG = new Graphics();
    this.lineG = new Graphics();
    this.series.addChild(this.fillG, this.lineG);
    this.seriesMask = new Graphics();
    this.series.mask = this.seriesMask;
    this.markerG = new Graphics();
    this.priceG = new Graphics();
    this.labels = new Container();
    stage.addChild(this.gridG, this.series, this.seriesMask, this.markerG, this.labels, this.priceG);

    this.yLabels = new TextPool(this.labels, { fontFamily: FONT, fontSize: 12, fill: COLORS.axis });
    this.xLabels = new TextPool(this.labels, { fontFamily: FONT, fontSize: 12, fill: COLORS.axis });
    this.tagText = new Text({ text: '', style: { fontFamily: FONT, fontSize: 15, fontWeight: '700', fill: 0xffffff } });
    this.tagText.anchor.set(0.5);
    stage.addChild(this.tagText);

    this.gradient = new FillGradient({
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      colorStops: [
        { offset: 0, color: 'rgba(0,0,0,0.11)' },
        { offset: 1, color: 'rgba(0,0,0,0)' },
      ],
    });

    this.setMarket(market);

    const ro = new ResizeObserver(() => this.app.renderer.resize(Math.max(1, host.clientWidth), Math.max(1, host.clientHeight)));
    ro.observe(host);
    this.app.ticker.add((t) => this.draw(t.deltaMS));
  }

  setMarket(market) {
    this.market = market;
    this.viewTime = market.last.epoch;
    this.dispQuote = market.last.quote;
    this.yMin = null;
  }

  setMode(mode) {
    this.mode = mode;
    this.yMin = null;
  }

  setContracts(list) {
    this.contracts = list;
  }

  draw(dtMS) {
    const { width: W, height: H } = this.app.screen;
    const m = this.market;
    const last = m.last;
    const plotR = W - RIGHT_GUTTER;
    const plotT = 8;
    const plotB = H - 45;
    const k = 1 - Math.exp(-dtMS / 110);

    this.viewTime += (last.epoch - this.viewTime) * k;
    if (Math.abs(last.epoch - this.viewTime) > 5) this.viewTime = last.epoch;
    this.dispQuote += (last.quote - this.dispQuote) * k;

    // ---- Dados visíveis e função X ----
    const isTick = this.mode === 'tick';
    let xOf;
    let points = [];
    let candles = [];
    let lo = Infinity;
    let hi = -Infinity;
    let lastX;
    let timeStep;
    let firstT;

    if (isTick) {
      const anchor = PLOT_LEFT + (plotR - PLOT_LEFT) * 0.565;
      xOf = (t) => anchor + (t - this.viewTime) * SPACING;
      firstT = Math.floor(this.viewTime - (anchor - PLOT_LEFT) / SPACING) - 2;
      for (let i = m.ticks.length - 1; i >= 0; i--) {
        const tk = m.ticks[i];
        if (tk.epoch < firstT) break;
        const q = tk === last ? this.dispQuote : tk.quote;
        points.push({ x: xOf(tk.epoch), q });
        lo = Math.min(lo, q);
        hi = Math.max(hi, q);
      }
      points.reverse();
      lastX = xOf(last.epoch);
      timeStep = 5;
    } else {
      const I = this.mode;
      const lastStart = last.epoch - (last.epoch % I);
      const anchor = PLOT_LEFT + (plotR - PLOT_LEFT) * 0.435;
      xOf = (t) => anchor + ((t - lastStart) / I) * SPACING;
      const n = Math.ceil((anchor - PLOT_LEFT) / SPACING) + 2;
      firstT = lastStart - n * I;
      candles = m.candles(I, firstT);
      for (const c of candles) {
        lo = Math.min(lo, c.low);
        hi = Math.max(hi, c.high);
      }
      lastX = xOf(lastStart);
      timeStep = I === 60 ? 300 : 1800;
    }

    for (const c of this.contracts) {
      lo = Math.min(lo, c.entry);
      hi = Math.max(hi, c.entry);
    }

    // ---- Escala Y suavizada ----
    const minRange = last.quote * m.sigma * (isTick ? 6 : 40);
    const range = Math.max(hi - lo, minRange);
    const padFrac = isTick ? 0.55 : 0.3;
    const tMin = lo - range * padFrac;
    const tMax = hi + range * padFrac;
    if (this.yMin == null) {
      this.yMin = tMin;
      this.yMax = tMax;
    } else {
      this.yMin += (tMin - this.yMin) * k * 0.6;
      this.yMax += (tMax - this.yMax) * k * 0.6;
    }
    const yOf = (q) => plotB - ((q - this.yMin) / (this.yMax - this.yMin)) * (plotB - plotT);

    // ---- Grelha ----
    const g = this.gridG.clear();
    this.yLabels.begin();
    this.xLabels.begin();
    const step = niceStep(this.yMax - this.yMin, 4);
    for (let v = Math.ceil(this.yMin / step) * step; v <= this.yMax; v += step) {
      const y = Math.round(yOf(v)) + 0.5;
      g.moveTo(PLOT_LEFT, y).lineTo(plotR, y);
      this.yLabels.get(v.toFixed(m.decimals), W - 19, y + 1, 1, 0.5);
    }
    const tStart = Math.ceil(firstT / timeStep) * timeStep;
    for (let t = tStart; ; t += timeStep) {
      const x = Math.round(xOf(t)) + 0.5;
      if (x > W + 40) break;
      if (x < PLOT_LEFT) continue;
      g.moveTo(x, 0).lineTo(x, plotB);
      this.xLabels.get(hhmmss(t), x, H - 21, 0.5, 0.5);
    }
    g.stroke({ width: 1, color: COLORS.grid });
    this.yLabels.end();
    this.xLabels.end();

    // ---- Série ----
    this.seriesMask.clear().rect(PLOT_LEFT, 0, W - PLOT_LEFT, plotB).fill(0xffffff);
    const fill = this.fillG.clear();
    const line = this.lineG.clear();
    let lastY;
    if (isTick) {
      if (points.length > 1) {
        fill.moveTo(points[0].x, plotB);
        for (const p of points) fill.lineTo(p.x, yOf(p.q));
        fill.lineTo(points[points.length - 1].x, plotB).closePath().fill(this.gradient);
        line.moveTo(points[0].x, yOf(points[0].q));
        for (let i = 1; i < points.length; i++) line.lineTo(points[i].x, yOf(points[i].q));
        line.stroke({ width: 2, color: COLORS.line, join: 'round', cap: 'round' });
      }
      lastY = yOf(this.dispQuote);
    } else {
      const bw = 14;
      for (const c of candles) {
        const x = xOf(c.epoch);
        const color = c.close >= c.open ? COLORS.up : COLORS.down;
        line.moveTo(x, yOf(c.high)).lineTo(x, yOf(c.low)).stroke({ width: 2, color });
        const y1 = yOf(Math.max(c.open, c.close));
        const y2 = yOf(Math.min(c.open, c.close));
        line.rect(x - bw / 2, y1, bw, Math.max(1.5, y2 - y1)).fill(color);
      }
      lastY = yOf(last.quote);
    }

    // ---- Contratos abertos ----
    const mk = this.markerG.clear();
    for (const c of this.contracts) {
      const color = c.dir === 'up' ? COLORS.up : COLORS.down;
      const xe = xOf(c.entryEpoch);
      const ye = yOf(c.entry);
      const cx = PLOT_LEFT + 30;
      if (xe > cx + 20) {
        dashed(mk, cx + 19, ye, xe, ye);
        dashed(mk, xe, plotT + 10, xe, plotB - 24);
        mk.stroke({ width: 1.5, color });
        // Cronómetro na base da linha vertical
        mk.circle(xe, plotB - 12, 8).stroke({ width: 2, color });
        mk.moveTo(xe, plotB - 12).lineTo(xe, plotB - 16).stroke({ width: 2, color, cap: 'round' });
        mk.moveTo(xe - 3, plotB - 22.5).lineTo(xe + 3, plotB - 22.5).stroke({ width: 2, color, cap: 'round' });
      }
      mk.circle(cx, ye, 19).fill(0xffffff).stroke({ width: 2.5, color });
      mk.circle(cx, ye, 14.5).fill(color);
      const s = c.dir === 'up' ? -1 : 1;
      mk.moveTo(cx - 5, ye - 5 * s).lineTo(cx + 5, ye + 5 * s);
      mk.moveTo(cx + 5, ye + 5 * s).lineTo(cx - 2, ye + 5 * s);
      mk.moveTo(cx + 5, ye + 5 * s).lineTo(cx + 5, ye - 2 * s);
      mk.stroke({ width: 2.5, color: 0xffffff, cap: 'round', join: 'round' });
      // Seta desenhada no sentido do contrato (↗ para Up, ↘ para Down)
    }

    // ---- Preço atual ----
    const pg = this.priceG.clear();
    const label = (isTick ? this.dispQuote : last.quote).toFixed(m.decimals);
    if (this.tagText.text !== label) this.tagText.text = label;
    const tw = Math.max(65, this.tagText.width + 22);
    const tagX = W - 15 - tw;
    const ly = Math.round(lastY);
    pg.moveTo(lastX, ly).lineTo(tagX + 2, ly).stroke({ width: 1.5, color: COLORS.line });
    pg.circle(lastX, ly, 5.5).fill(COLORS.line);
    pg.roundRect(tagX, ly - 14.5, tw, 29, 6).fill(COLORS.line);
    this.tagText.position.set(Math.round(tagX + tw / 2), ly);
  }
}
