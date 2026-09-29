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
const COUNTDOWN_MS = 2500; // "descolagem" antes de cada ronda, à imagem da Stake

const multAt = (ms) => Math.exp(K * ms);
const msFor = (m) => Math.log(m) / K;

// Cor da pastilha do histórico consoante o escalão do multiplicador (como na Stake).
const TIER_BLUE_MAX = 2; // < 2× → azul
const TIER_PURPLE_MAX = 10; // 2×–10× → roxo, ≥10× → rosa
const tierOf = (m) => (m < TIER_BLUE_MAX ? 'blue' : m < TIER_PURPLE_MAX ? 'purple' : 'pink');

export default {
  id: 'crash',
  name: 'Crash',
  tagline: 'O multiplicador sobe… levanta antes de rebentar!',
  rules:
    'Depois de apostares, há uma contagem decrescente de descolagem e o multiplicador começa em 1.00×, subindo cada vez mais depressa até rebentar num ponto aleatório. Carrega em "Levantar" antes disso para ganhar aposta × multiplicador. Podes definir um levantamento automático.',
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

    // Grelha pontilhada de fundo, ao estilo Stake.
    const grid = new Graphics();
    for (let x = gx0; x <= gx1 + 1; x += 40) {
      for (let y = gy1; y <= gy0 + 1; y += 40) grid.circle(x, y, 1.2);
    }
    grid.fill({ color: COLORS.line, alpha: 0.5 });

    const axes = new Graphics();
    const labels = new Container();
    const curve = new Graphics();
    const glowTrail = new Graphics();

    // Foguetão: corpo + janela + barbatanas + chama animada (sem imagens, só vetores).
    const rocket = new Container();
    const flame = new Graphics();
    const body = new Graphics()
      .poly([16, 0, -6, -8, -14, -5, -14, 5, -6, 8])
      .fill(0xffffff)
      .poly([-6, -8, -14, -5, -10, -6])
      .fill(COLORS.red)
      .poly([-6, 8, -14, 5, -10, 6])
      .fill(COLORS.red)
      .circle(4, 0, 4)
      .fill(COLORS.blue);
    rocket.addChild(flame, body);
    root.addChild(grid, axes, labels, glowTrail, curve, rocket);

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
      glowTrail.clear();
      if (ms <= 0) {
        rocket.visible = false;
        return;
      }
      const steps = 80;
      const color = crashed ? COLORS.red : COLORS.yellow;
      const pts = [];
      for (let i = 0; i <= steps; i++) {
        const t = (ms * i) / steps;
        pts.push([px(t), py(multAt(t))]);
      }
      const trace = (g) => {
        g.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
      };

      trace(curve);
      curve.lineTo(px(ms), gy0).lineTo(px(0), gy0).closePath();
      curve.fill({ color, alpha: 0.18 });

      // Brilho suave por trás da linha principal (efeito "neon" da Stake).
      trace(glowTrail);
      glowTrail.stroke({ width: 16, color, alpha: 0.16, cap: 'round', join: 'round' });

      trace(curve);
      curve.stroke({ width: 4, color, cap: 'round', join: 'round' });
      trace(curve);
      curve.stroke({ width: 1.5, color: 0xffffff, alpha: 0.85, cap: 'round', join: 'round' });
      if (cashedAt) {
        const cm = Math.min(cashedAt, m);
        curve.circle(px(msFor(cm)), py(cm), 7).fill(COLORS.green);
      }

      rocket.visible = !crashed;
      const tip = { x: px(ms), y: py(m) };
      const prev = { x: px(ms * 0.97), y: py(multAt(ms * 0.97)) };
      rocket.position.set(tip.x, tip.y);
      rocket.rotation = Math.atan2(tip.y - prev.y, tip.x - prev.x);

      // Chama a tremeluzir atrás do foguetão.
      const flicker = 10 + Math.sin(ms / 40) * 3 + Math.random() * 4;
      flame.clear().poly([-14, -4, -14 - flicker, 0, -14, 4]).fill({ color: COLORS.yellow, alpha: 0.9 });
    };
    draw(0);

    // ---- Estado da ronda ----
    let round = null; // { amount, crash, auto, phase, countdownStart, start, cashed }

    const setButton = () => {
      if (!round) {
        play.textContent = 'Apostar';
        play.classList.remove('btn-cashout');
        play.disabled = false;
      } else if (round.phase === 'countdown') {
        play.textContent = 'A aguardar descolagem…';
        play.classList.remove('btn-cashout');
        play.disabled = true;
      } else if (round.cashed) {
        play.textContent = 'A aguardar fim da ronda…';
        play.disabled = true;
      } else {
        play.textContent = `Levantar ${money(round.amount * multAt(performance.now() - round.start))}`;
        play.classList.add('btn-cashout');
        play.disabled = false;
      }
      bet.disabled = autoIn.disabled = !!round;
    };

    const cashout = (m) => {
      if (!round || round.phase !== 'flying' || round.cashed || m >= round.crash) return;
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
      ctx.recent(mult(r.crash), !!r.cashed, tierOf(r.crash));
      setButton();
    };

    // Cancela uma ronda que ainda não descolou (devolve a aposta na totalidade).
    const cancelCountdown = () => {
      if (!round || round.phase !== 'countdown') return;
      const r = round;
      round = null;
      wallet.settle('Crash', r.amount, 1); // devolve o montante apostado, sem ganho nem perda
      setButton();
    };

    // Ao sair da página a meio da ronda, levanta automaticamente ao multiplicador atual.
    ctx.onLeave(() => {
      if (round && round.phase === 'countdown') {
        cancelCountdown();
        return;
      }
      if (round && round.phase === 'flying' && !round.cashed) {
        const m = multAt(performance.now() - round.start);
        if (m < round.crash) cashout(m);
      }
      finish();
    });

    app.ticker.add(() => {
      if (!round) return;

      if (round.phase === 'countdown') {
        const left = COUNTDOWN_MS - (performance.now() - round.countdownStart);
        if (left <= 0) {
          round.phase = 'flying';
          round.start = performance.now();
          status.text = 'Em curso…';
          status.style.fill = COLORS.muted;
          setButton();
          return;
        }
        draw(0);
        big.text = `${Math.ceil(left / 1000)}`;
        big.style.fill = COLORS.yellow;
        status.text = 'A preparar descolagem…';
        status.style.fill = COLORS.muted;
        return;
      }

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
      if (round && round.phase === 'flying') {
        cashout(multAt(performance.now() - round.start));
        return;
      }
      if (round) return;
      const amount = bet.value;
      const auto = parseFloat(autoIn.value);
      if (!takeBet(amount)) return;
      round = {
        amount,
        crash: crashPoint(),
        auto: auto >= 1.01 ? auto : null,
        phase: 'countdown',
        countdownStart: performance.now(),
        start: null,
        cashed: null,
      };
      big.style.fill = COLORS.yellow;
      status.text = 'A preparar descolagem…';
      status.style.fill = COLORS.muted;
      setButton();
    });

    return () => stage.destroy();
  },
};
