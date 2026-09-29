import { Container, Graphics, Text } from 'pixi.js';
import { COLORS, FONT } from '../core/stage.js';
import { tween, ease } from '../core/tween.js';
import { crashPoint, random } from '../core/rng.js';
import { wallet } from '../core/wallet.js';
import { mult } from '../core/format.js';
import { h, betAmount, field, takeBet } from '../core/ui.js';

const W = 800;
const H = 500;

export default {
  id: 'limbo',
  name: 'Limbo',
  tagline: 'Define um multiplicador alvo e reza para o superar.',
  rules:
    'Escolhe um multiplicador alvo (mínimo 1.01×). É sorteado um multiplicador aleatório: se for igual ou superior ao alvo, ganhas a aposta × alvo. Probabilidade de ganhar = 99 ÷ alvo %.',
  edge: '1%',

  async mount(ctx) {
    let busy = false;
    const bet = betAmount(1);
    const targetIn = h('input', { class: 'input', type: 'number', min: '1.01', step: '0.01', value: '2.00' });
    const chance = h('input', { class: 'input', readonly: true, tabindex: '-1' });
    const profit = h('input', { class: 'input', readonly: true, tabindex: '-1' });
    const play = h('button', { class: 'btn-primary', type: 'button' }, 'Apostar');
    ctx.controls.append(
      bet.el,
      field('Multiplicador alvo', targetIn),
      h('div', { class: 'grid-2' }, field('Probabilidade %', chance), field('Lucro ao ganhar', profit)),
      play,
    );
    const target = () => Math.max(1.01, Math.min(1e6, parseFloat(targetIn.value) || 1.01));
    const sync = () => {
      chance.value = (99 / target()).toFixed(4);
      profit.value = (bet.value * target() - bet.value).toFixed(2);
    };
    ctx.controls.addEventListener('input', sync);
    targetIn.addEventListener('change', () => ((targetIn.value = target().toFixed(2)), sync()));
    sync();

    const stage = await ctx.createStage({ width: W, height: H });
    const { app, root } = stage;

    // Anéis e estrelas animados em fundo
    const bg = new Container();
    root.addChild(bg);
    const stars = [];
    for (let i = 0; i < 70; i++) {
      const s = new Graphics().circle(0, 0, 1 + random() * 1.8).fill({ color: 0xffffff, alpha: 0.25 + random() * 0.5 });
      s.position.set(random() * W, random() * H);
      s.speed = 0.2 + random() * 0.8;
      bg.addChild(s);
      stars.push(s);
    }
    const rings = new Graphics();
    for (let r = 60; r <= 260; r += 50) rings.circle(0, 0, r).stroke({ width: 2, color: COLORS.line, alpha: 0.5 - r / 700 });
    rings.position.set(W / 2, H / 2);
    root.addChild(rings);

    const value = new Text({ text: '1.00×', style: { fontFamily: FONT, fontSize: 110, fontWeight: '800', fill: 0xffffff } });
    value.anchor.set(0.5);
    value.position.set(W / 2, H / 2);
    root.addChild(value);

    const sub = new Text({ text: 'Alvo 2.00×', style: { fontFamily: FONT, fontSize: 20, fontWeight: '600', fill: COLORS.muted } });
    sub.anchor.set(0.5);
    sub.position.set(W / 2, H / 2 + 90);
    root.addChild(sub);

    const burst = new Container();
    root.addChild(burst);

    let speed = 1;
    app.ticker.add((t) => {
      for (const s of stars) {
        s.y += s.speed * speed * t.deltaTime;
        if (s.y > H) (s.y = 0), (s.x = random() * W);
      }
      rings.rotation += 0.002 * speed * t.deltaTime;
      speed += (1 - speed) * 0.05;
      for (const p of burst.children) {
        p.x += p.vx * t.deltaTime;
        p.y += p.vy * t.deltaTime;
        p.vy += 0.15 * t.deltaTime;
        p.alpha -= 0.015 * t.deltaTime;
      }
      burst.children.filter((p) => p.alpha <= 0).forEach((p) => p.destroy());
    });

    const explode = () => {
      for (let i = 0; i < 60; i++) {
        const p = new Graphics().rect(-4, -2, 8, 4).fill([COLORS.green, COLORS.yellow, 0xffffff][i % 3]);
        const a = random() * Math.PI * 2;
        const v = 3 + random() * 7;
        p.position.set(W / 2, H / 2);
        p.rotation = a;
        p.vx = Math.cos(a) * v;
        p.vy = Math.sin(a) * v - 3;
        burst.addChild(p);
      }
    };

    play.addEventListener('click', async () => {
      if (busy) return;
      const amount = bet.value;
      const tgt = target();
      if (!takeBet(amount)) return;
      busy = true;
      play.disabled = true;

      const result = crashPoint();
      const win = result >= tgt;
      const settle = ctx.once(() => {
        wallet.settle('Limbo', amount, win ? tgt : 0);
        ctx.recent(mult(result), win);
      });

      sub.text = `Alvo ${mult(tgt)}`;
      value.style.fill = 0xffffff;
      speed = 6;
      // Contagem com crescimento logarítmico para que valores altos não demorem demasiado.
      const logR = Math.log(result);
      await tween(app.ticker, 700, (t) => {
        value.text = mult(Math.exp(logR * t));
        value.scale.set(1 + 0.08 * t);
      }, ease.outQuart);
      value.text = mult(result);
      value.style.fill = win ? COLORS.green : COLORS.red;
      if (win) explode();
      await tween(app.ticker, 200, (t) => value.scale.set(1.08 - 0.08 * t));
      settle();
      busy = false;
      play.disabled = false;
    });

    return () => stage.destroy();
  },
};
