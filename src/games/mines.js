import { Container, Graphics, Text } from 'pixi.js';
import { COLORS, FONT } from '../core/stage.js';
import { tween, ease } from '../core/tween.js';
import { random } from '../core/rng.js';
import { wallet } from '../core/wallet.js';
import { mult, money } from '../core/format.js';
import { h, betAmount, field, select, takeBet, toast } from '../core/ui.js';

const N = 25;
const SIZE = 600;
const TILE = 104;
const GAP = 12;

// Multiplicador após `k` jogadas seguras com `m` minas (1% de vantagem da casa).
export function minesMultiplier(m, k) {
  let v = 0.99;
  for (let i = 0; i < k; i++) v *= (N - i) / (N - m - i);
  return v;
}

function gem() {
  return new Graphics()
    .poly([0, -30, 28, -8, 0, 32, -28, -8])
    .fill(0x00c96b)
    .poly([0, -30, 28, -8, 0, -2, -28, -8])
    .fill(0x5dffb0)
    .poly([0, -2, 28, -8, 0, 32])
    .fill(0x00a85a);
}

function bomb() {
  const g = new Graphics().circle(0, 4, 26).fill(0xff3d57).circle(0, 4, 18).fill(0x2a0610);
  g.rect(-3, -30, 6, 12).fill(0x9fb0c8).circle(-8, -4, 5).fill({ color: 0xffffff, alpha: 0.5 });
  return g;
}

export default {
  id: 'mines',
  name: 'Mines',
  tagline: 'Encontra diamantes e evita as minas.',
  rules:
    'Escolhe quantas minas esconder na grelha 5×5 e começa. Cada diamante encontrado aumenta o multiplicador. Levanta quando quiseres — mas se abrires uma mina perdes a aposta.',
  edge: '1%',

  async mount(ctx) {
    let mines = 3;
    let game = null; // { amount, layout:Set, revealed:number, over }
    const bet = betAmount(1);
    const minesSel = select(Array.from({ length: 24 }, (_, i) => [i + 1, String(i + 1)]), mines, (v) => (mines = Number(v)));
    const gemsOut = h('input', { class: 'input', readonly: true, tabindex: '-1', value: '22' });
    const profit = h('input', { class: 'input', readonly: true, tabindex: '-1', value: '0.00' });
    const play = h('button', { class: 'btn-primary', type: 'button' }, 'Apostar');
    const pick = h('button', { class: 'btn-secondary', type: 'button', disabled: true }, 'Escolha aleatória');
    ctx.controls.append(
      bet.el,
      h('div', { class: 'grid-2' }, field('Minas', minesSel), field('Diamantes', gemsOut)),
      field('Lucro total', profit),
      pick,
      play,
    );
    minesSel.addEventListener('change', () => (gemsOut.value = String(N - mines)));

    const stage = await ctx.createStage({ width: SIZE, height: SIZE });
    const { app, root } = stage;

    const off = (SIZE - (5 * TILE + 4 * GAP)) / 2;
    const tiles = [];
    for (let i = 0; i < N; i++) {
      const c = new Container();
      c.position.set(off + (i % 5) * (TILE + GAP) + TILE / 2, off + Math.floor(i / 5) * (TILE + GAP) + TILE / 2);
      const shadow = new Graphics().roundRect(-TILE / 2, -TILE / 2 + 6, TILE, TILE, 12).fill(0x172834);
      const face = new Graphics();
      const icon = new Container();
      c.addChild(shadow, face, icon);
      c.face = face;
      c.icon = icon;
      c.index = i;
      c.eventMode = 'static';
      c.cursor = 'pointer';
      c.on('pointerover', () => canPick(c) && (face.y = -3));
      c.on('pointerout', () => (face.y = 0));
      c.on('pointertap', () => reveal(i));
      root.addChild(c);
      tiles.push(c);
    }

    const drawFace = (c, state) => {
      c.face.clear().roundRect(-TILE / 2, -TILE / 2, TILE, TILE, 12);
      if (state === 'hidden') c.face.fill(COLORS.panelLight);
      else if (state === 'gem') c.face.fill(0x0f212e).stroke({ width: 3, color: COLORS.green, alpha: 0.8 });
      else if (state === 'bomb') c.face.fill(0x0f212e).stroke({ width: 3, color: COLORS.red, alpha: 0.8 });
      else c.face.fill(0x0f212e);
    };

    const reset = () => {
      for (const c of tiles) {
        drawFace(c, 'hidden');
        c.icon.removeChildren().forEach((x) => x.destroy());
        c.alpha = 1;
        c.scale.set(1);
        c.revealed = false;
      }
    };
    reset();

    const canPick = (c) => game && !game.over && !c.revealed;

    const overlay = new Container();
    const overlayBg = new Graphics();
    const overlayText = new Text({ text: '', style: { fontFamily: FONT, fontSize: 40, fontWeight: '800', fill: COLORS.green, align: 'center' } });
    overlayText.anchor.set(0.5);
    overlay.addChild(overlayBg, overlayText);
    overlay.position.set(SIZE / 2, SIZE / 2);
    overlay.visible = false;
    root.addChild(overlay);

    const showOverlay = (text) => {
      overlayText.text = text;
      overlayBg.clear().roundRect(-130, -60, 260, 120, 16).fill(COLORS.bg).stroke({ width: 4, color: COLORS.green });
      overlay.visible = true;
      overlay.scale.set(0.6);
      tween(app.ticker, 300, (t) => overlay.scale.set(0.6 + 0.4 * t), ease.outBack);
    };

    const flip = async (c, kind, dim) => {
      c.revealed = true;
      await tween(app.ticker, 110, (t) => (c.scale.x = 1 - t), ease.linear);
      drawFace(c, dim ? 'open' : kind);
      const icon = kind === 'gem' ? gem() : bomb();
      c.icon.addChild(icon);
      if (dim) c.alpha = 0.45;
      await tween(app.ticker, 160, (t) => (c.scale.x = t), ease.outBack);
    };

    const setUi = () => {
      const running = game && !game.over;
      bet.disabled = running;
      minesSel.disabled = running;
      pick.disabled = !running;
      if (running) {
        const m = minesMultiplier(game.mines, game.revealed);
        play.textContent = game.revealed ? `Levantar ${money(game.amount * m)}` : 'Escolhe um quadrado';
        play.disabled = game.revealed === 0;
        play.classList.toggle('btn-cashout', game.revealed > 0);
        profit.value = (game.amount * m - game.amount).toFixed(2);
      } else {
        play.textContent = 'Apostar';
        play.disabled = false;
        play.classList.remove('btn-cashout');
      }
    };

    const revealAll = () => {
      for (const c of tiles) if (!c.revealed) flip(c, game.layout.has(c.index) ? 'bomb' : 'gem', true);
    };

    const endGame = (win) => {
      game.over = true;
      const m = win ? minesMultiplier(game.mines, game.revealed) : 0;
      wallet.settle('Mines', game.amount, m);
      ctx.recent(win ? mult(m) : '💣', win);
      if (win) {
        showOverlay(`${mult(m)}\n${money(game.amount * m)}`);
        toast(`Ganhaste ${money(game.amount * m)} em Mines!`, 'win');
      }
      revealAll();
      setUi();
    };

    async function reveal(i) {
      const c = tiles[i];
      if (!canPick(c) || game.busy) return;
      game.busy = true;
      const isBomb = game.layout.has(i);
      await flip(c, isBomb ? 'bomb' : 'gem');
      game.busy = false;
      if (isBomb) {
        tween(app.ticker, 400, (t) => (c.rotation = Math.sin(t * Math.PI * 6) * 0.08 * (1 - t)), ease.linear);
        endGame(false);
        return;
      }
      game.revealed++;
      if (game.revealed === N - game.mines) endGame(true);
      else setUi();
    }

    pick.addEventListener('click', () => {
      const free = tiles.filter((c) => !c.revealed).map((c) => c.index);
      if (free.length) reveal(free[Math.floor(random() * free.length)]);
    });

    play.addEventListener('click', () => {
      if (game && !game.over) {
        if (game.revealed > 0 && !game.busy) endGame(true);
        return;
      }
      const amount = bet.value;
      if (!takeBet(amount)) return;
      const layout = new Set();
      while (layout.size < mines) layout.add(Math.floor(random() * N));
      game = { amount, mines, layout, revealed: 0, over: false, busy: false };
      overlay.visible = false;
      reset();
      setUi();
    });

    // Ao sair a meio: levanta se já houver diamantes, senão devolve a aposta.
    ctx.onLeave(() => {
      if (!game || game.over) return;
      game.over = true;
      wallet.settle('Mines', game.amount, game.revealed ? minesMultiplier(game.mines, game.revealed) : 1);
    });

    return () => stage.destroy();
  },
};
