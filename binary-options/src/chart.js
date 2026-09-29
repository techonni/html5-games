import { Application, Container, FillGradient, Graphics, Rectangle, Text } from 'pixi.js';

const FONT = "'IBM Plex Sans', system-ui, sans-serif";

// Medidas por layout (em px CSS), tiradas das capturas de ecrã.
const LAYOUTS = {
  mobile: {
    rightGutter: 67,
    labelRight: 19,
    tagRight: 15,
    tagH: 29,
    tagFont: 15,
    labelFont: 12,
    timeFromBottom: 21,
    plotFromBottom: 45,
    anchorTick: 0.565,
    anchorCandle: 0.435,
    spacing: 23.7,
    body: 14,
    up: 0x4bb68a,
    down: 0xcc2e3d,
    marker: 'mobile',
  },
  desktop: {
    rightGutter: 65,
    labelRight: 8,
    tagRight: 4,
    tagH: 23,
    tagFont: 13,
    labelFont: 10.5,
    timeFromBottom: 10,
    plotFromBottom: 20,
    anchorTick: 0.49,
    anchorCandle: 0.49,
    spacing: 19.5,
    body: 12,
    up: 0x00c390,
    down: 0xe6194b,
    marker: 'desktop',
  },
};

const THEMES = {
  light: { bg: 0xffffff, grid: 0xf2f2f2, axis: 0x999999, axisDesk: 0xc2c2c2, line: 0x000000, tag: 0x000000, tagText: 0xffffff, fill: 'rgba(0,0,0,0.11)', dot: 0x000000 },
  dark: { bg: 0x0e0e0e, grid: 0x1d1d1d, axis: 0x6e6e6e, axisDesk: 0x6e6e6e, line: 0xffffff, tag: 0xffffff, tagText: 0x0e0e0e, fill: 'rgba(255,255,255,0.12)', dot: 0xffffff },
};

const DRAW_COLOR = 0x377cfc;
const SMA_COLOR = 0xff9933;
const PLOT_LEFT_MOBILE = 10;

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
  constructor(parent) {
    this.parent = parent;
    this.items = [];
    this.used = 0;
  }
  begin() {
    this.used = 0;
  }
  get(text, x, y, ax, ay, size, color) {
    let t = this.items[this.used];
    if (!t) {
      t = new Text({ text, style: { fontFamily: FONT, fontSize: size, fill: color } });
      this.parent.addChild(t);
      this.items.push(t);
    }
    this.used++;
    if (t.text !== text) t.text = text;
    if (t.style.fontSize !== size) t.style.fontSize = size;
    if (t.style.fill !== color) t.style.fill = color;
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
    this.layout = LAYOUTS.mobile;
    this.theme = THEMES.light;
    this.contracts = [];
    this.zoom = 1;
    this.pan = 0; // deslocamento para o passado (segundos em ticks, velas em modo velas)
    this.drawings = {}; // linhas horizontais por mercado
    this.drawMode = false;
    this.sma = false;
    this.onDrawDone = null;

    this.app = new Application();
    await this.app.init({
      background: this.theme.bg,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 3),
      width: Math.max(1, host.clientWidth),
      height: Math.max(1, host.clientHeight),
      preserveDrawingBuffer: true,
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
    this.overlayG = new Graphics();
    this.markerG = new Graphics();
    this.priceG = new Graphics();
    this.labels = new Container();
    this.tagText = new Text({ text: '', style: { fontFamily: FONT, fontSize: 15, fontWeight: '700', fill: 0xffffff } });
    this.tagText.anchor.set(0.5);
    stage.addChild(this.gridG, this.series, this.seriesMask, this.overlayG, this.markerG, this.labels, this.priceG, this.tagText);
    this.texts = new TextPool(this.labels);
    this.makeGradient();

    // Arrastar para ver o histórico; clicar em modo desenho cria uma linha.
    stage.eventMode = 'static';
    stage.hitArea = new Rectangle(0, 0, 1e5, 1e5);
    let drag = null;
    stage.on('pointerdown', (e) => {
      drag = { x: e.global.x, pan: this.pan, moved: false };
    });
    stage.on('globalpointermove', (e) => {
      if (!drag) return;
      const dx = e.global.x - drag.x;
      if (Math.abs(dx) > 3) drag.moved = true;
      if (drag.moved) this.pan = Math.max(0, drag.pan + dx / this.spacing());
    });
    const end = (e) => {
      if (drag && !drag.moved && this.drawMode && this.yInv) {
        const q = this.yInv(e.global.y);
        (this.drawings[this.market.id] ??= []).push(q);
        this.drawMode = false;
        this.onDrawDone?.();
      }
      drag = null;
    };
    stage.on('pointerup', end).on('pointerupoutside', end);
    this.app.canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.setZoom(this.zoom * (e.deltaY > 0 ? 0.9 : 1.1));
      },
      { passive: false },
    );

    this.setMarket(market);
    const ro = new ResizeObserver(() => this.app.renderer.resize(Math.max(1, host.clientWidth), Math.max(1, host.clientHeight)));
    ro.observe(host);
    this.app.ticker.add((t) => this.draw(t.deltaMS));
  }

  makeGradient() {
    this.gradient?.destroy?.();
    this.gradient = new FillGradient({
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      colorStops: [
        { offset: 0, color: this.theme.fill },
        { offset: 1, color: 'rgba(0,0,0,0)' },
      ],
    });
  }

  spacing() {
    return this.layout.spacing * this.zoom;
  }

  setMarket(market) {
    this.market = market;
    this.viewTime = market.last.epoch;
    this.dispQuote = market.last.quote;
    this.yMin = null;
    this.pan = 0;
  }

  setMode(mode) {
    this.mode = mode;
    this.yMin = null;
    this.pan = 0;
  }

  setLayout(name) {
    this.layout = LAYOUTS[name];
    this.yMin = null;
  }

  setTheme(name) {
    this.theme = THEMES[name];
    this.app.renderer.background.color = this.theme.bg;
    this.makeGradient();
  }

  setZoom(z) {
    this.zoom = Math.min(3, Math.max(0.35, z));
  }

  resetView() {
    this.pan = 0;
    this.zoom = 1;
    this.yMin = null;
  }

  clearDrawings() {
    delete this.drawings[this.market.id];
  }

  setContracts(list) {
    this.contracts = list;
  }

  download() {
    this.app.renderer.extract.download({ target: this.app.stage, filename: `${this.market.id}-chart.png` });
  }

  draw(dtMS) {
    const { width: W, height: H } = this.app.screen;
    const L = this.layout;
    const T = this.theme;
    const desk = L.marker === 'desktop';
    const m = this.market;
    const last = m.last;
    const plotL = desk ? 0 : PLOT_LEFT_MOBILE;
    const plotR = W - L.rightGutter;
    const plotT = 8;
    const plotB = H - L.plotFromBottom;
    const sp = this.spacing();
    const k = 1 - Math.exp(-dtMS / 110);
    const axisColor = desk ? T.axisDesk : T.axis;

    this.viewTime += (last.epoch - this.viewTime) * k;
    if (Math.abs(last.epoch - this.viewTime) > 5) this.viewTime = last.epoch;
    this.dispQuote += (last.quote - this.dispQuote) * k;

    // ---- Dados visíveis e função X ----
    const isTick = this.mode === 'tick';
    let xOf;
    const points = [];
    let candles = [];
    let lo = Infinity;
    let hi = -Infinity;
    let lastX;
    let timeStep;
    let firstT;

    if (isTick) {
      const anchor = plotL + (plotR - plotL) * L.anchorTick;
      const vt = this.viewTime - this.pan;
      xOf = (t) => anchor + (t - vt) * sp;
      firstT = Math.floor(vt - (anchor - plotL) / sp) - 2;
      const lastT = vt + (W - anchor) / sp + 2;
      for (let i = m.ticks.length - 1; i >= 0; i--) {
        const tk = m.ticks[i];
        if (tk.epoch < firstT) break;
        if (tk.epoch > lastT) continue;
        const q = tk === last ? this.dispQuote : tk.quote;
        points.push({ x: xOf(tk.epoch), q });
        lo = Math.min(lo, q);
        hi = Math.max(hi, q);
      }
      points.reverse();
      lastX = xOf(last.epoch);
      timeStep = [5, 10, 15, 30, 60, 120].find((s) => s * sp >= 90) ?? 300;
    } else {
      const I = this.mode;
      const lastStart = last.epoch - (last.epoch % I);
      const anchor = plotL + (plotR - plotL) * L.anchorCandle;
      xOf = (t) => anchor + ((t - lastStart) / I + this.pan) * sp;
      const n = Math.ceil((anchor - plotL) / sp + this.pan) + 2;
      firstT = lastStart - n * I;
      candles = m.candles(I, firstT).filter((c) => xOf(c.epoch) < W + sp);
      for (const c of candles) {
        lo = Math.min(lo, c.low);
        hi = Math.max(hi, c.high);
      }
      lastX = xOf(lastStart);
      const steps = I === 60 ? [300, 600, 900, 1800, 3600] : [1800, 3600, 7200, 14400];
      timeStep = steps.find((s) => (s / I) * sp >= 90) ?? steps[steps.length - 1];
    }
    if (!Number.isFinite(lo)) {
      lo = hi = last.quote;
    }

    for (const c of this.contracts) {
      lo = Math.min(lo, c.entry, c.strike ?? c.entry);
      hi = Math.max(hi, c.entry, c.strike ?? c.entry);
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
    this.yInv = (y) => m.round(this.yMin + ((plotB - y) / (plotB - plotT)) * (this.yMax - this.yMin));

    // ---- Grelha ----
    const g = this.gridG.clear();
    this.texts.begin();
    const step = niceStep(this.yMax - this.yMin, desk ? 5 : 4);
    for (let v = Math.ceil(this.yMin / step) * step; v <= this.yMax; v += step) {
      const y = Math.round(yOf(v)) + 0.5;
      g.moveTo(plotL, y).lineTo(plotR, y);
      this.texts.get(v.toFixed(m.decimals), W - L.labelRight, y + 1, 1, 0.5, L.labelFont, axisColor);
    }
    const tStart = Math.ceil(firstT / timeStep) * timeStep;
    for (let t = tStart; ; t += timeStep) {
      const x = Math.round(xOf(t)) + 0.5;
      if (x > W + 40) break;
      if (x < plotL) continue;
      g.moveTo(x, 0).lineTo(x, desk ? H : plotB);
      if (!desk || x < plotR - 20) this.texts.get(hhmmss(t), x, H - L.timeFromBottom, 0.5, 0.5, L.labelFont, axisColor);
    }
    g.stroke({ width: 1, color: T.grid });

    // ---- Série ----
    this.seriesMask.clear().rect(plotL, 0, W - plotL, desk ? H : plotB).fill(0xffffff);
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
        line.stroke({ width: 2, color: T.line, join: 'round', cap: 'round' });
      }
      lastY = yOf(this.dispQuote);
    } else {
      const bw = Math.max(2, L.body * this.zoom);
      for (const c of candles) {
        const x = xOf(c.epoch);
        const color = c.close >= c.open ? L.up : L.down;
        line.moveTo(x, yOf(c.high)).lineTo(x, yOf(c.low)).stroke({ width: desk ? 1.5 : 2, color });
        const y1 = yOf(Math.max(c.open, c.close));
        const y2 = yOf(Math.min(c.open, c.close));
        line.rect(x - bw / 2, y1, bw, Math.max(1.5, y2 - y1)).fill(color);
      }
      lastY = yOf(last.quote);
    }

    // ---- Indicador (média móvel simples de 10) e desenhos ----
    const ov = this.overlayG.clear();
    if (this.sma) {
      const src = isTick ? points.map((p) => ({ x: p.x, v: p.q })) : candles.map((c) => ({ x: xOf(c.epoch), v: c.close }));
      const N = 10;
      let started = false;
      for (let i = N - 1; i < src.length; i++) {
        let s = 0;
        for (let j = i - N + 1; j <= i; j++) s += src[j].v;
        const y = yOf(s / N);
        if (!started) ov.moveTo(src[i].x, y), (started = true);
        else ov.lineTo(src[i].x, y);
      }
      if (started) ov.stroke({ width: 1.5, color: SMA_COLOR });
    }
    for (const q of this.drawings[m.id] ?? []) {
      const y = Math.round(yOf(q)) + 0.5;
      ov.moveTo(plotL, y).lineTo(plotR, y).stroke({ width: 1, color: DRAW_COLOR });
      ov.circle(plotR - 8, y, 3.5).fill(DRAW_COLOR);
    }

    // ---- Contratos abertos ----
    const mk = this.markerG.clear();
    for (const c of this.contracts) {
      const color = c.dir === 'up' ? L.up : L.down;
      const xe = xOf(c.entryEpoch);
      const ye = yOf(c.entry);
      const cx = desk ? Math.max(plotL + 30, Math.min(xe - 185, plotR - 40)) : plotL + 30;
      // Strike diferente da entrada (opções digitais): barreira tracejada em toda a largura.
      if (c.strike != null && c.strike !== c.entry) {
        const ys = yOf(c.strike);
        dashed(mk, plotL, ys, plotR, ys, 8, 5);
        mk.stroke({ width: 1.5, color, alpha: 0.9 });
      }
      if (c.expiryEpoch) {
        const xx = xOf(c.expiryEpoch);
        if (xx > plotL && xx < plotR) {
          dashed(mk, xx, plotT + 10, xx, plotB);
          mk.stroke({ width: 1.5, color: T.line });
          mk.moveTo(xx, plotT + 10).lineTo(xx, plotT + 30).stroke({ width: 2, color: T.line });
          for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) mk.rect(xx + i * 5, plotT + 10 + j * 5, 5, 5).fill((i + j) % 2 ? T.bg : T.line);
          mk.rect(xx, plotT + 10, 15, 10).stroke({ width: 1, color: T.line });
        }
      }
      const swY = desk ? H - 8 - 12 : plotB - 12;
      if (xe > cx + 20) {
        dashed(mk, cx + 19, ye, xe, ye, desk ? 3 : 4, desk ? 3 : 4);
        dashed(mk, xe, desk ? 0 : plotT + 10, xe, swY - 12, desk ? 3 : 4, desk ? 3 : 4);
        mk.stroke({ width: 1.5, color });
        if (desk) {
          mk.moveTo(xe, ye).lineTo(plotR, ye).stroke({ width: 1.5, color });
          mk.circle(xe, ye, 5).fill(T.bg).stroke({ width: 2, color });
        }
        // Cronómetro na base da linha vertical
        mk.circle(xe, swY, 8).stroke({ width: 2, color });
        mk.moveTo(xe, swY).lineTo(xe, swY - 4).stroke({ width: 2, color, cap: 'round' });
        mk.moveTo(xe - 3, swY - 10.5).lineTo(xe + 3, swY - 10.5).stroke({ width: 2, color, cap: 'round' });
      } else if (desk) {
        mk.moveTo(cx + 19, ye).lineTo(plotR, ye).stroke({ width: 1.5, color });
      }
      mk.circle(cx, ye, 19).fill(T.bg).stroke({ width: 2.5, color });
      mk.circle(cx, ye, 14.5).fill(color);
      // Seta no sentido do contrato (↗ para Up, ↘ para Down)
      const s = c.dir === 'up' ? -1 : 1;
      mk.moveTo(cx - 5, ye - 5 * s).lineTo(cx + 5, ye + 5 * s);
      mk.moveTo(cx + 5, ye + 5 * s).lineTo(cx - 2, ye + 5 * s);
      mk.moveTo(cx + 5, ye + 5 * s).lineTo(cx + 5, ye - 2 * s);
      mk.stroke({ width: 2.5, color: 0xffffff, cap: 'round', join: 'round' });
    }

    // ---- Preço atual ----
    const pg = this.priceG.clear();
    const label = (isTick ? this.dispQuote : last.quote).toFixed(m.decimals);
    if (this.tagText.text !== label) this.tagText.text = label;
    if (this.tagText.style.fontSize !== L.tagFont) this.tagText.style.fontSize = L.tagFont;
    if (this.tagText.style.fill !== T.tagText) this.tagText.style.fill = T.tagText;
    const tw = Math.max(desk ? 75 : 65, this.tagText.width + (desk ? 18 : 22));
    const tagX = W - L.tagRight - tw;
    const ly = Math.round(lastY);
    if (lastX < tagX) pg.moveTo(Math.max(lastX, plotL), ly).lineTo(tagX + 2, ly).stroke({ width: 1.5, color: T.line });
    if (lastX >= plotL && lastX <= plotR) pg.circle(lastX, ly, desk ? 4.5 : 5.5).fill(T.dot);
    pg.roundRect(tagX, ly - L.tagH / 2, tw, L.tagH, desk ? 4 : 6).fill(T.tag);
    this.tagText.position.set(Math.round(tagX + tw / 2), ly);
    this.texts.end();
  }
}
