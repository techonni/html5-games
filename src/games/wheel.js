import { Container, Graphics, Text } from 'pixi.js';
import { COLORS, FONT } from '../core/stage.js';
import { tween, ease } from '../core/tween.js';
import { random } from '../core/rng.js';
import { wallet } from '../core/wallet.js';
import { mult } from '../core/format.js';
import { h, betAmount, field, segmented, takeBet } from '../core/ui.js';

const W = 800;
const H = 640;
const R = 240;

// 30 segmentos por risco; cada roda tem valor esperado 0.99.
const rep = (arr, n) => Array.from({ length: n }, () => arr).flat();
const WHEELS = {
  low: rep([1.5, 1.2, 1.2, 0, 1.2, 1.5, 1.2, 0.9, 0, 1.2], 3),
  medium: rep([0, 1.9, 0, 1.5, 0, 2, 0, 1.5, 0, 3], 3),
  high: [29.7, ...Array(29).fill(0)],
};

const COLOR_OF = {
  0: 0x34505f,
  0.9: 0x9fb0c8,
  1.2: 0xe6eef5,
  1.5: 0x00e07a,
  1.9: 0xffe14d,
  2: 0xffc53d,
  3: 0x8b5cff,
  29.7: 0xff3d57,
};

export default {
  id: 'wheel',
  name: 'Wheel',
  tagline: 'Gira a roda da fortuna com três níveis de risco.',
  rules:
    'A roda tem 30 segmentos. Após apostares, gira e pára num segmento aleatório: ganhas a aposta × o multiplicador desse segmento. Risco baixo = prémios frequentes e pequenos; risco alto = um único segmento de 29.70×.',
  edge: '1%',

  async mount(ctx) {
    let risk = 'medium';
    let busy = false;
    const bet = betAmount(1);
    const riskSeg = segmented([['low', 'Baixo'], ['medium', 'Médio'], ['high', 'Alto']], risk, (v) => ((risk = v), build()));
    const play = h('button', { class: 'btn-primary', type: 'button' }, 'Girar');
    ctx.controls.append(bet.el, field('Risco', riskSeg.el), play);

    const stage = await ctx.createStage({ width: W, height: H });
    const { app, root } = stage;

    const cx = W / 2;
    const cy = 290;
    const wheel = new Container();
    wheel.position.set(cx, cy);
    const rim = new Graphics().circle(cx, cy, R + 18).fill(COLORS.panel).circle(cx, cy, R + 6).fill(COLORS.bg);
    root.addChild(rim, wheel);

    const hub = new Graphics().circle(0, 0, R * 0.62).fill(COLORS.bg).circle(0, 0, R * 0.62).stroke({ width: 4, color: COLORS.panel });
    hub.position.set(cx, cy);
    const center = new Text({ text: '', style: { fontFamily: FONT, fontSize: 58, fontWeight: '800', fill: 0xffffff } });
    center.anchor.set(0.5);
    center.position.set(cx, cy);
    root.addChild(hub, center);

    const pointer = new Graphics().poly([-18, -6, 18, -6, 0, 30]).fill(COLORS.red).stroke({ width: 3, color: 0xffffff });
    pointer.position.set(cx, cy - R - 24);
    root.addChild(pointer);

    const legend = new Container();
    legend.position.set(cx, 590);
    root.addChild(legend);

    let segs = WHEELS[risk];
    function build() {
      segs = WHEELS[risk];
      wheel.removeChildren().forEach((c) => c.destroy());
      const n = segs.length;
      const a = (Math.PI * 2) / n;
      const g = new Graphics();
      segs.forEach((v, i) => {
        const a0 = -Math.PI / 2 + i * a + 0.012;
        const a1 = -Math.PI / 2 + (i + 1) * a - 0.012;
        g.moveTo(Math.cos(a0) * R * 0.66, Math.sin(a0) * R * 0.66)
          .arc(0, 0, R, a0, a1)
          .arc(0, 0, R * 0.66, a1, a0, true)
          .closePath()
          .fill(COLOR_OF[v]);
      });
      wheel.addChild(g);

      legend.removeChildren().forEach((c) => c.destroy({ children: true }));
      const uniq = [...new Set(segs)].sort((x, y) => x - y);
      const cw = 104;
      uniq.forEach((v, i) => {
        const chip = new Container();
        const count = segs.filter((s) => s === v).length;
        const bg = new Graphics().roundRect(-cw / 2 + 4, -26, cw - 8, 52, 10).fill(COLORS.panel).rect(-cw / 2 + 4, 22, cw - 8, 4).fill(COLOR_OF[v]);
        const t = new Text({ text: mult(v), style: { fontFamily: FONT, fontSize: 17, fontWeight: '800', fill: 0xffffff } });
        t.anchor.set(0.5);
        t.y = -9;
        const c = new Text({ text: `${count} / 30`, style: { fontFamily: FONT, fontSize: 12, fontWeight: '600', fill: COLORS.muted } });
        c.anchor.set(0.5);
        c.y = 10;
        chip.addChild(bg, t, c);
        chip.x = (i - (uniq.length - 1) / 2) * cw;
        legend.addChild(chip);
      });
      center.text = '';
    }
    build();

    play.addEventListener('click', async () => {
      if (busy) return;
      const amount = bet.value;
      if (!takeBet(amount)) return;
      busy = true;
      play.disabled = true;
      riskSeg.disabled = true;

      const n = segs.length;
      const k = Math.floor(random() * n);
      const m = segs[k];
      const settle = ctx.once(() => {
        wallet.settle('Wheel', amount, m);
        ctx.recent(mult(m), m >= 1);
      });

      // Rodar para que o centro do segmento k fique debaixo do ponteiro (topo).
      const a = (Math.PI * 2) / n;
      const base = -(k + 0.5) * a + (random() - 0.5) * a * 0.7;
      const start = wheel.rotation;
      let end = base;
      while (end < start + Math.PI * 2 * 5) end += Math.PI * 2;
      center.text = '';
      let lastTick = 0;
      await tween(app.ticker, 3200, (t) => {
        wheel.rotation = start + (end - start) * t;
        const tick = Math.floor(wheel.rotation / a);
        if (tick !== lastTick) {
          lastTick = tick;
          pointer.rotation = -0.25;
        }
        pointer.rotation *= 0.85;
      }, ease.outQuart);
      wheel.rotation %= Math.PI * 2;
      pointer.rotation = 0;
      center.text = mult(m);
      center.style.fill = COLOR_OF[m] === COLORS.panelLight || m === 0 ? COLORS.muted : COLOR_OF[m];
      await tween(app.ticker, 250, (t) => center.scale.set(1 + 0.2 * Math.sin(t * Math.PI)), ease.linear);
      settle();
      busy = false;
      play.disabled = false;
      riskSeg.disabled = false;
    });

    return () => stage.destroy();
  },
};
