import { Container, Graphics, Text } from 'pixi.js';
import { COLORS, FONT } from '../core/stage.js';
import { crashPoint } from '../core/rng.js';
import { wallet } from '../core/wallet.js';
import { mult, money } from '../core/format.js';
import { h, betAmount, field, takeBet, toast } from '../core/ui.js';

const W = 800;
const H = 500;
const PAD_L = 70;
const PAD_B = 50;
const PAD_T = 30;
const PAD_R = 30;
const K = 0.00011; // velocidade de crescimento: m(t) = e^(K·ms)

const multAt = (ms) => Math.exp(K * ms);
const msFor = (m) => Math.log(m) / K;

export default {
  id: 'crash',
  name: 'Crash',
  tagline: 'O multiplicador sobe… levanta antes de rebentar!',
  rules:
    'Depois de apostares, o multiplicador começa em 1.00× e sobe cada vez mais depressa até rebentar num ponto aleatório. Carrega em "Levantar" antes disso para ganhar aposta × multiplicador. Podes definir um levantamento automático.',
  edge: '1%',

  async mount(ctx) {
    const bet = betAmount(1);
    const autoIn = h('input', { class: 'input', type: 'number', min: '1.01', step: '0.01', value: '2.00' });
    const play = h('button', { class: 'btn-primary', type: 'button' }, 'Apostar');
    const info = h('div', { class: 'panel-note' }, 'Deixa o levantamento automático vazio para levantares manualmente.');
    ctx.controls.append(bet.el, field('Levantamento automático', autoIn), play, info);

    const stage = await ctx.createStage({ width: W, height: H });
    const { app, root } = stage;

    const gx0 = PAD_L;
    const gx1 = W - PAD_R;
    const gy0 = H - PAD_B;
    const gy1 = PAD_T;

    const axes = new Graphics();
    const labels = new Container();
    const curve = new Graphics();
    const rocket = new Graphics().poly([14, 0, -10, -9, -5, 0, -10, 9]).fill(0xffffff).circle(-12, 0, 4).fill(COLORS.yellow);
    root.addChild(axes, labels, curve, rocket);

    const big = new Text({ text: '1.00×', style: { fontFamily: FONT, fontSize: 84, fontWeight: '800', fill: 0xffffff } });
    big.anchor.set(0.5);
    big.position.set(W / 2 + 20, H / 2 - 20);
    const status = new Text({ text: 'Faz a tua aposta', style: { fontFamily: FONT, fontSize: 20, fontWeight: '600', fill: COLORS.muted } });
    status.anchor.set(0.5);
    status.position.set(W / 2 + 20, H / 2 + 45);
    root.addChild(big, status);

    const labelStyle = { fontFamily: FONT, fontSize: 14, fontWeight: '600', fill: COLORS.muted };
    const labelPool = [];
    const label = (i, text, x, y, ax, ay) => {
      let t = labelPool[i];
      if (!t) {
        t = new Text({ text, style: labelStyle });
        labelPool[i] = t;
        labels.addChild(t);
      }
      t.visible = true;
      t.text = text;
      t.anchor.set(ax, ay);
      t.position.set(x, y);
    };

    const niceStep = (range, n) => {
      const raw = range / n;
      const p = 10 ** Math.floor(Math.log10(raw));
      return [1, 2, 5, 10].map((m) => m * p).find((s) => s >= raw);
    };

    // Desenha eixos + curva até ao tempo `ms`.
    const draw = (ms, crashed, cashedAt) => {
      const m = multAt(ms);
      const xMax = Math.max(8000, ms * 1.15);
      const yMax = Math.max(2, 1 + (m - 1) * 1.25);
      const px = (t) => gx0 + (t / xMax) * (gx1 - gx0);
      const py = (v) => gy0 - ((v - 1) / (yMax - 1)) * (gy0 - gy1);

      axes.clear();
      labelPool.forEach((t) => (t.visible = false));
      let li = 0;
      const ys = niceStep(yMax - 1, 4);
      for (let v = 1; v <= yMax + 1e-9; v += ys) {
        axes.moveTo(gx0, py(v)).lineTo(gx1, py(v));
        label(li++, `${v.toFixed(v < 10 ? 1 : 0)}×`, gx0 - 10, py(v), 1, 0.5);
      }
      const xs = niceStep(xMax / 1000, 5);
      for (let s = 0; s <= xMax / 1000 + 1e-9; s += xs) label(li++, `${s}s`, px(s * 1000), gy0 + 12, 0.5, 0);
      axes.stroke({ width: 1, color: COLORS.line, alpha: 0.6 });

      curve.clear();
      if (ms <= 0) {
        rocket.visible = false;
        return;
      }
      const steps = 80;
      curve.moveTo(px(0), py(1));
      for (let i = 1; i <= steps; i++) {
        const t = (ms * i) / steps;
        curve.lineTo(px(t), py(multAt(t)));
      }
      curve.lineTo(px(ms), gy0).lineTo(px(0), gy0).closePath();
      const color = crashed ? COLORS.red : COLORS.yellow;
      curve.fill({ color, alpha: 0.18 });
      curve.moveTo(px(0), py(1));
      for (let i = 1; i <= steps; i++) {
        const t = (ms * i) / steps;
        curve.lineTo(px(t), py(multAt(t)));
      }
      curve.stroke({ width: 5, color, cap: 'round', join: 'round' });
      if (cashedAt) {
        const cm = Math.min(cashedAt, m);
        curve.circle(px(msFor(cm)), py(cm), 7).fill(COLORS.green);
      }

      rocket.visible = !crashed;
      const tip = { x: px(ms), y: py(m) };
      const prev = { x: px(ms * 0.97), y: py(multAt(ms * 0.97)) };
      rocket.position.set(tip.x, tip.y);
      rocket.rotation = Math.atan2(tip.y - prev.y, tip.x - prev.x);
    };
    draw(0);

    // ---- Estado da ronda ----
    let round = null; // { amount, crash, auto, start, cashed }

    const setButton = () => {
      if (!round) {
        play.textContent = 'Apostar';
        play.classList.remove('btn-cashout');
      } else if (round.cashed) {
        play.textContent = 'A aguardar fim da ronda…';
      } else {
        play.textContent = `Levantar ${money(round.amount * multAt(performance.now() - round.start))}`;
        play.classList.add('btn-cashout');
      }
      play.disabled = !!round && !!round.cashed;
      bet.disabled = autoIn.disabled = !!round;
    };

    const cashout = (m) => {
      if (!round || round.cashed || m >= round.crash) return;
      round.cashed = Math.floor(m * 100) / 100;
      wallet.settle('Crash', round.amount, round.cashed);
      status.text = `Levantaste a ${mult(round.cashed)} · +${money(round.amount * round.cashed)}`;
      status.style.fill = COLORS.green;
      toast(`Ganhaste ${money(round.amount * round.cashed)} em Crash!`, 'win');
      setButton();
    };

    const finish = () => {
      if (!round) return;
      const r = round;
      round = null;
      if (!r.cashed) wallet.settle('Crash', r.amount, 0);
      ctx.recent(mult(r.crash), !!r.cashed);
      setButton();
    };

    // Ao sair da página a meio da ronda, levanta automaticamente ao multiplicador atual.
    ctx.onLeave(() => {
      if (round && !round.cashed) {
        const m = multAt(performance.now() - round.start);
        if (m < round.crash) cashout(m);
      }
      finish();
    });

    app.ticker.add(() => {
      if (!round) return;
      const ms = performance.now() - round.start;
      const m = multAt(ms);
      if (m >= round.crash) {
        const crashMs = msFor(round.crash);
        draw(crashMs, true, round.cashed);
        big.text = mult(round.crash);
        big.style.fill = COLORS.red;
        if (!round.cashed) {
          status.text = `Rebentou a ${mult(round.crash)}`;
          status.style.fill = COLORS.red;
        }
        finish();
        return;
      }
      if (round.auto && !round.cashed && m >= round.auto) cashout(round.auto);
      draw(ms, false, round.cashed);
      big.text = mult(m);
      if (!round.cashed) setButton();
    });

    play.addEventListener('click', () => {
      if (round) {
        cashout(multAt(performance.now() - round.start));
        return;
      }
      const amount = bet.value;
      const auto = parseFloat(autoIn.value);
      if (!takeBet(amount)) return;
      round = {
        amount,
        crash: crashPoint(),
        auto: auto >= 1.01 ? auto : null,
        start: performance.now(),
        cashed: null,
      };
      big.style.fill = 0xffffff;
      status.text = 'Em curso…';
      status.style.fill = COLORS.muted;
      setButton();
    });

    return () => stage.destroy();
  },
};
