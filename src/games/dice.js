import { Container, Graphics, Text } from 'pixi.js';
import { createStage, COLORS, FONT } from '../core/stage.js';
import { tween, ease, lerp } from '../core/tween.js';
import { random } from '../core/rng.js';
import { wallet } from '../core/wallet.js';
import { h, betAmount, field, takeBet } from '../core/ui.js';

const W = 800;
const H = 420;
const X0 = 80;
const X1 = 720;
const TRACK_Y = 250;

export default {
  id: 'dice',
  name: 'Dice',
  tagline: 'Escolhe o alvo e lança o dado de 0 a 100.',
  rules:
    'Arrasta o marcador para definir o alvo. Em "Acima de" ganhas se o número sorteado for maior que o alvo; em "Abaixo de" se for menor. Quanto menor a probabilidade, maior o multiplicador (99 ÷ probabilidade).',
  edge: '1%',

  async mount(ctx) {
    let target = 50.5;
    let over = true;
    let busy = false;

    // ---- Controlos HTML ----
    const bet = betAmount(1);
    const multIn = h('input', { class: 'input', type: 'number', step: '0.01', min: '1.0102', max: '49.5' });
    const targetIn = h('input', { class: 'input', type: 'number', step: '0.01', min: '2', max: '98' });
    const chanceIn = h('input', { class: 'input', type: 'number', step: '0.01', min: '2', max: '98' });
    const modeBtn = h('button', { class: 'input input-btn', type: 'button' });
    const profit = h('input', { class: 'input', readonly: true, tabindex: '-1' });
    const play = h('button', { class: 'btn-primary', type: 'button' }, 'Apostar');
    ctx.controls.append(
      bet.el,
      field('Lucro ao ganhar', profit),
      h('div', { class: 'grid-2' }, field('Multiplicador', multIn), field('Probabilidade %', chanceIn)),
      h('div', { class: 'grid-2' }, field('Alvo', targetIn), field('Modo', modeBtn)),
      play,
    );

    const chance = () => (over ? 100 - target : target);
    const payoutMult = () => Math.floor((99 / chance()) * 10000) / 10000;

    // ---- Cena Pixi ----
    const stage = await ctx.createStage({ width: W, height: H });
    const { app, root } = stage;

    const frame = new Graphics().roundRect(40, 170, W - 80, 160, 24).fill(COLORS.panel);
    root.addChild(frame);

    for (const v of [0, 25, 50, 75, 100]) {
      const x = lerp(X0, X1, v / 100);
      const label = new Text({ text: String(v), style: { fontFamily: FONT, fontSize: 18, fontWeight: '700', fill: COLORS.muted } });
      label.anchor.set(0.5);
      label.position.set(x, 140);
      const tick = new Graphics().poly([x - 7, 155, x + 7, 155, x, 164]).fill(COLORS.panel);
      root.addChild(label, tick);
    }

    const track = new Graphics();
    root.addChild(track);

    const handle = new Container();
    const handleG = new Graphics()
      .roundRect(-22, -22, 44, 44, 8)
      .fill(COLORS.blue)
      .rect(-9, -12, 3, 24)
      .rect(-1.5, -12, 3, 24)
      .rect(6, -12, 3, 24)
      .fill({ color: 0xffffff, alpha: 0.55 });
    handle.addChild(handleG);
    handle.y = TRACK_Y;
    handle.eventMode = 'static';
    handle.cursor = 'grab';
    root.addChild(handle);

    // Bolha do resultado
    const bubble = new Container();
    const bubbleG = new Graphics();
    const bubbleText = new Text({ text: '', style: { fontFamily: FONT, fontSize: 24, fontWeight: '800', fill: 0xffffff } });
    bubbleText.anchor.set(0.5);
    bubble.addChild(bubbleG, bubbleText);
    bubble.position.set(lerp(X0, X1, 0.5), 80);
    bubble.alpha = 0;
    root.addChild(bubble);

    const drawBubble = (color) => {
      bubbleG.clear().roundRect(-50, -28, 100, 56, 14).fill(color).poly([-10, 26, 10, 26, 0, 40]).fill(color);
    };

    const drawTrack = () => {
      const tx = lerp(X0, X1, target / 100);
      const lo = over ? COLORS.red : COLORS.green;
      const hi = over ? COLORS.green : COLORS.red;
      track
        .clear()
        .roundRect(X0 - 16, TRACK_Y - 16, X1 - X0 + 32, 32, 16)
        .fill(COLORS.panelLight)
        .roundRect(X0, TRACK_Y - 6, tx - X0, 12, 6)
        .fill(lo)
        .roundRect(tx, TRACK_Y - 6, X1 - tx, 12, 6)
        .fill(hi);
      handle.x = tx;
    };

    const sync = (skip) => {
      target = Math.min(98, Math.max(2, Math.round(target * 100) / 100));
      if (skip !== 'target') targetIn.value = target.toFixed(2);
      if (skip !== 'chance') chanceIn.value = chance().toFixed(2);
      if (skip !== 'mult') multIn.value = payoutMult().toFixed(4);
      modeBtn.textContent = over ? 'Acima de ⇅' : 'Abaixo de ⇅';
      profit.value = (bet.value * payoutMult() - bet.value).toFixed(2);
      drawTrack();
    };

    targetIn.addEventListener('input', () => {
      const v = parseFloat(targetIn.value);
      if (v >= 2 && v <= 98) (target = v), sync('target');
    });
    chanceIn.addEventListener('input', () => {
      const v = parseFloat(chanceIn.value);
      if (v >= 2 && v <= 98) (target = over ? 100 - v : v), sync('chance');
    });
    multIn.addEventListener('input', () => {
      const v = parseFloat(multIn.value);
      if (v >= 1.0102 && v <= 49.5) {
        const c = 99 / v;
        target = over ? 100 - c : c;
        sync('mult');
      }
    });
    [targetIn, chanceIn, multIn].forEach((i) => i.addEventListener('change', () => sync()));
    modeBtn.addEventListener('click', () => {
      if (busy) return;
      over = !over;
      target = 100 - target;
      sync();
    });
    ctx.controls.addEventListener('input', () => (profit.value = (bet.value * payoutMult() - bet.value).toFixed(2)));

    // Arrastar o marcador
    let dragging = false;
    handle.on('pointerdown', () => !busy && ((dragging = true), (handle.cursor = 'grabbing')));
    const stopDrag = () => ((dragging = false), (handle.cursor = 'grab'));
    app.stage.on('pointerup', stopDrag).on('pointerupoutside', stopDrag);
    app.stage.on('globalpointermove', (e) => {
      if (!dragging) return;
      const p = root.toLocal(e.global);
      target = ((p.x - X0) / (X1 - X0)) * 100;
      sync();
    });
    // Clicar na pista também move o alvo
    track.eventMode = 'static';
    track.cursor = 'pointer';
    track.on('pointerdown', (e) => {
      if (busy) return;
      const p = root.toLocal(e.global);
      target = ((p.x - X0) / (X1 - X0)) * 100;
      dragging = true;
      sync();
    });

    sync();

    // ---- Jogar ----
    play.addEventListener('click', async () => {
      if (busy) return;
      const amount = bet.value;
      if (!takeBet(amount)) return;
      busy = true;
      play.disabled = true;

      const roll = Math.floor(random() * 10001) / 100;
      const win = over ? roll > target : roll < target;
      const m = win ? payoutMult() : 0;
      const settle = ctx.once(() => {
        wallet.settle('Dice', amount, m);
        ctx.recent(roll.toFixed(2), win);
      });

      const fromX = bubble.alpha ? bubble.x : lerp(X0, X1, 0.5);
      const toX = lerp(X0, X1, roll / 100);
      bubble.alpha = 1;
      drawBubble(COLORS.panelLight);
      await tween(app.ticker, 450, (t) => {
        bubble.x = lerp(fromX, toX, t);
        bubbleText.text = (Math.random() * 100).toFixed(2);
      }, ease.outCubic);
      bubbleText.text = roll.toFixed(2);
      drawBubble(win ? COLORS.green : COLORS.red);
      bubbleText.style.fill = win ? 0x05301a : 0xffffff;
      await tween(app.ticker, 220, (t) => bubble.scale.set(1 + 0.18 * Math.sin(t * Math.PI)), ease.linear);
      settle();
      busy = false;
      play.disabled = false;
    });

    return () => stage.destroy();
  },
};
