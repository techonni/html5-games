import { Application, Container, FillGradient, Graphics, Text } from 'pixi.js';

const FONT = '"Outfit", "Inter", system-ui, sans-serif';
const K = 0.00006; // m(t) = e^(K·ms)

export const multAt = (ms) => Math.exp(K * ms);
export const msFor = (m) => Math.log(Math.max(1.0001, m)) / K;

/**
 * PixiJS crash graph: rising curve + 3D multiplier text + rocket tip.
 */
export async function createChart(host) {
  const app = new Application();
  await app.init({
    background: 0x0b1a24,
    antialias: true,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    width: Math.max(1, host.clientWidth),
    height: Math.max(1, host.clientHeight),
    preference: 'webgl',
  });
  host.appendChild(app.canvas);

  const root = new Container();
  app.stage.addChild(root);

  const bg = new Graphics();
  const grid = new Graphics();
  const fillG = new Graphics();
  const lineG = new Graphics();
  const tip = new Graphics();
  tip.circle(0, 0, 7).fill(0xffffff);
  tip.circle(0, 0, 11).fill({ color: 0xffffff, alpha: 0.18 });

  // 3D multiplier: shadow then face
  const shadow = new Text({
    text: '1.00x',
    style: {
      fontFamily: FONT,
      fontSize: 64,
      fontWeight: '900',
      fill: 0x6ea8ff,
      letterSpacing: -1,
    },
  });
  shadow.anchor.set(0.5);
  shadow.alpha = 0.85;

  const face = new Text({
    text: '1.00x',
    style: {
      fontFamily: FONT,
      fontSize: 64,
      fontWeight: '900',
      fill: 0xffffff,
      letterSpacing: -1,
    },
  });
  face.anchor.set(0.5);

  root.addChild(bg, grid, fillG, lineG, tip, shadow, face);

  let W = host.clientWidth;
  let H = host.clientHeight;
  const PAD = { l: 16, r: 16, t: 28, b: 28 };

  const layout = () => {
    W = Math.max(1, host.clientWidth);
    H = Math.max(1, host.clientHeight);
    app.renderer.resize(W, H);

    const fs = Math.round(Math.min(72, Math.max(42, W * 0.16)));
    face.style.fontSize = fs;
    shadow.style.fontSize = fs;
    face.position.set(W / 2, H * 0.38);
    shadow.position.set(W / 2 + 3, H * 0.38 + 5);

    bg.clear().rect(0, 0, W, H).fill(0x0b1a24);

    // subtle grid
    grid.clear();
    const cols = 6;
    const rows = 4;
    for (let i = 0; i <= cols; i++) {
      const x = PAD.l + ((W - PAD.l - PAD.r) * i) / cols;
      grid.moveTo(x, PAD.t).lineTo(x, H - PAD.b);
    }
    for (let j = 0; j <= rows; j++) {
      const y = PAD.t + ((H - PAD.t - PAD.b) * j) / rows;
      grid.moveTo(PAD.l, y).lineTo(W - PAD.r, y);
    }
    grid.stroke({ width: 1, color: 0x1e3342, alpha: 0.9 });
  };

  const ro = new ResizeObserver(layout);
  ro.observe(host);
  layout();

  const formatMult = (m) => `${m.toFixed(2)}x`;

  /**
   * @param {object} opts
   * @param {number} opts.ms elapsed ms of flight (0 = idle)
   * @param {boolean} [opts.crashed]
   * @param {number|null} [opts.crashMult]
   * @param {'idle'|'waiting'|'flying'|'crashed'} [opts.phase]
   */
  const draw = ({ ms = 0, crashed = false, crashMult = null, phase = 'idle' } = {}) => {
    const m = crashed && crashMult != null ? crashMult : multAt(ms);
    const showCurve = ms > 0 || crashed;

    // Color: flying = soft blue/white trail; crashed = grey/red
    const lineColor = crashed ? 0x8b9bb0 : 0xa8c4e0;
    const tipColor = crashed ? 0xed6363 : 0xffffff;

    face.text = formatMult(m);
    shadow.text = formatMult(m);

    if (crashed) {
      face.style.fill = 0xffffff;
      shadow.style.fill = 0xed6363;
      shadow.alpha = 1;
      shadow.position.set(W / 2 + 4, H * 0.38 + 6);
    } else if (phase === 'flying') {
      face.style.fill = 0xffffff;
      shadow.style.fill = 0x6ea8ff;
      shadow.alpha = 0.9;
      shadow.position.set(W / 2 + 3, H * 0.38 + 5);
    } else {
      face.style.fill = 0xffffff;
      shadow.style.fill = 0x3d5a73;
      shadow.alpha = 0.55;
      shadow.position.set(W / 2 + 2, H * 0.38 + 4);
      if (phase === 'waiting' || phase === 'idle') {
        face.text = '1.00x';
        shadow.text = '1.00x';
      }
    }

    fillG.clear();
    lineG.clear();

    if (!showCurve) {
      tip.visible = false;
      return;
    }

    const gx0 = PAD.l;
    const gx1 = W - PAD.r;
    const gy0 = H - PAD.b;
    const gy1 = PAD.t + H * 0.08;
    const xMax = Math.max(4500, ms * 1.12);
    const yMax = Math.max(1.8, 1 + (m - 1) * 1.35);
    const px = (t) => gx0 + (t / xMax) * (gx1 - gx0);
    const py = (v) => gy0 - ((v - 1) / (yMax - 1)) * (gy0 - gy1);

    const steps = Math.max(40, Math.min(120, Math.floor(ms / 40)));
    const drawMs = crashed && crashMult != null ? msFor(crashMult) : ms;

    // Area fill under curve
    fillG.moveTo(px(0), py(1));
    for (let i = 1; i <= steps; i++) {
      const t = (drawMs * i) / steps;
      fillG.lineTo(px(t), py(multAt(t)));
    }
    fillG.lineTo(px(drawMs), gy0).lineTo(px(0), gy0).closePath();

    const grad = new FillGradient({
      type: 'linear',
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      colorStops: crashed
        ? [
            { offset: 0, color: '#4a5564' },
            { offset: 1, color: '#0b1a24' },
          ]
        : [
            { offset: 0, color: '#3d6a8f' },
            { offset: 1, color: '#0b1a24' },
          ],
      textureSpace: 'local',
    });
    fillG.fill({ fill: grad, alpha: crashed ? 0.35 : 0.45 });

    // Stroke
    lineG.moveTo(px(0), py(1));
    for (let i = 1; i <= steps; i++) {
      const t = (drawMs * i) / steps;
      lineG.lineTo(px(t), py(multAt(t)));
    }
    lineG.stroke({ width: 4, color: lineColor, cap: 'round', join: 'round', alpha: crashed ? 0.75 : 1 });

    const tipX = px(drawMs);
    const tipY = py(multAt(drawMs));
    tip.visible = true;
    tip.clear();
    if (!crashed) {
      tip.circle(0, 0, 12).fill({ color: 0xffffff, alpha: 0.15 });
      tip.circle(0, 0, 6.5).fill(tipColor);
    } else {
      tip.circle(0, 0, 7).fill(tipColor);
    }
    tip.position.set(tipX, tipY);
  };

  draw({ ms: 0, phase: 'idle' });

  return {
    app,
    draw,
    multAt,
    msFor,
    destroy() {
      ro.disconnect();
      app.destroy(
        { removeView: true, releaseGlobalResources: true },
        { children: true, texture: true, textureSource: true },
      );
    },
  };
}
