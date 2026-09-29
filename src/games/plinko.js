import { Container, Graphics, Text } from 'pixi.js';
import { COLORS, FONT } from '../core/stage.js';
import { tween, ease, lerp } from '../core/tween.js';
import { random } from '../core/rng.js';
import { wallet } from '../core/wallet.js';
import { mult } from '../core/format.js';
import { h, betAmount, field, select, takeBet } from '../core/ui.js';

const W = 640;
const H = 640;

// Tabelas de multiplicadores (simétricas) por número de linhas e risco.
const TABLES = {
  8: {
    low: [5.6, 2.1, 1.1, 1, 0.5, 1, 1.1, 2.1, 5.6],
    medium: [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
    high: [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29],
  },
  12: {
    low: [10, 3, 1.6, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 1.6, 3, 10],
    medium: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33],
    high: [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170],
  },
  16: {
    low: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
    medium: [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110],
    high: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000],
  },
};

// Cor do balde: vermelho nas pontas → amarelo no centro.
function bucketColor(i, n) {
  const d = Math.abs(i - (n - 1) / 2) / ((n - 1) / 2);
  const r = 255;
  const g = Math.round(lerp(192, 40, d));
  const b = Math.round(lerp(40, 80, d));
  return (r << 16) | (g << 8) | b;
}

export default {
  id: 'plinko',
  name: 'Plinko',
  tagline: 'Larga bolas e vê-as ressaltar até aos multiplicadores.',
  rules:
    'Cada bola ressalta em cada linha de pinos para a esquerda ou direita com 50% de probabilidade e cai num balde. O prémio é a aposta × o multiplicador do balde. Mais linhas e mais risco = extremos maiores.',
  edge: '≈1%',

  async mount(ctx) {
    let rows = 12;
    let risk = 'medium';
    let active = 0;

    const bet = betAmount(1);
    const riskSel = select([['low', 'Baixo'], ['medium', 'Médio'], ['high', 'Alto']], risk, (v) => ((risk = v), build()));
    const rowsSel = select([[8, '8'], [12, '12'], [16, '16']], rows, (v) => ((rows = Number(v)), build()));
    const play = h('button', { class: 'btn-primary', type: 'button' }, 'Largar bola');
    ctx.controls.append(bet.el, h('div', { class: 'grid-2' }, field('Risco', riskSel), field('Linhas', rowsSel)), play);

    const stage = await ctx.createStage({ width: W, height: H });
    const { app, root } = stage;

    const board = new Container();
    const ballsLayer = new Container();
    root.addChild(board, ballsLayer);

    let geo = null;
    let buckets = [];
    let pegs = [];

    function build() {
      board.removeChildren().forEach((c) => c.destroy({ children: true }));
      const s = Math.min(610 / (rows + 2), 540 / (rows + 1.2));
      const top = 50;
      const cx = W / 2;
      const pegR = Math.max(3, s * 0.12);
      const ballR = s * 0.26;
      geo = { s, top, cx, pegR, ballR };

      pegs = [];
      const pegsG = new Graphics();
      for (let i = 0; i < rows; i++) {
        const row = [];
        for (let j = 0; j < i + 3; j++) {
          const x = cx + (j - (i + 2) / 2) * s;
          const y = top + i * s;
          pegsG.circle(x, y, pegR);
          row.push({ x, y });
        }
        pegs.push(row);
      }
      pegsG.fill(0xffffff);
      board.addChild(pegsG);

      const table = TABLES[rows][risk];
      const by = top + (rows - 1) * s + s * 0.85;
      const bw = s * 0.94;
      const bh = Math.max(22, s * 0.72);
      buckets = table.map((m, k) => {
        const c = new Container();
        c.position.set(cx + (k - rows / 2) * s, by);
        const g = new Graphics().roundRect(-bw / 2, 0, bw, bh, 5).fill(bucketColor(k, table.length));
        const shadow = new Graphics().roundRect(-bw / 2, 4, bw, bh, 5).fill({ color: 0x000000, alpha: 0.35 });
        const t = new Text({
          text: m >= 100 ? `${m}` : `${m}×`,
          style: { fontFamily: FONT, fontSize: Math.min(15, s * 0.36), fontWeight: '800', fill: 0x1a0d00 },
        });
        t.anchor.set(0.5);
        if (t.width > bw - 4) t.scale.set((bw - 4) / t.width);
        t.position.set(0, bh / 2);
        c.addChild(shadow, g, t);
        board.addChild(c);
        return c;
      });
    }
    build();

    const syncControls = () => {
      const lock = active > 0;
      riskSel.disabled = rowsSel.disabled = lock;
    };

    async function dropBall(amount) {
      const { s, top, cx, pegR, ballR } = geo;
      const path = Array.from({ length: rows }, () => (random() < 0.5 ? 0 : 1));
      const slot = path.reduce((a, b) => a + b, 0);
      const m = TABLES[rows][risk][slot];
      const settle = ctx.once(() => {
        wallet.settle('Plinko', amount, m);
        ctx.recent(mult(m), m >= 1);
      });

      const ball = new Graphics().circle(0, 0, ballR).fill(COLORS.red).circle(-ballR * 0.3, -ballR * 0.3, ballR * 0.3).fill({ color: 0xffffff, alpha: 0.35 });
      const jitter = (random() - 0.5) * s * 0.2;
      ball.position.set(cx + jitter, top - s * 1.1);
      ballsLayer.addChild(ball);

      const contactY = (i) => top + i * s - pegR - ballR;
      // Queda até ao primeiro pino
      const x0 = ball.x;
      await tween(app.ticker, 220, (t) => {
        ball.x = lerp(x0, cx, t);
        ball.y = lerp(top - s * 1.1, contactY(0), t * t);
      }, ease.linear);

      let k = 0;
      let x = cx;
      for (let i = 0; i < rows; i++) {
        k += path[i];
        const nx = cx + (k - (i + 1) / 2) * s;
        const y1 = contactY(i);
        const y2 = i + 1 < rows ? contactY(i + 1) : top + (rows - 1) * s + s * 0.85 - ballR * 0.2;
        const fromX = x;
        // Pequeno ressalto para cima e depois queda (parábola).
        await tween(app.ticker, 150, (t) => {
          ball.x = lerp(fromX, nx, t);
          ball.y = lerp(y1, y2, t * t) - Math.sin(t * Math.PI) * s * 0.35 * (1 - t);
        }, ease.linear);
        x = nx;
      }

      ball.destroy();
      const b = buckets[slot];
      tween(app.ticker, 260, (t) => (b.y = b.y0 + Math.sin(t * Math.PI) * 10), ease.linear);
      settle();
    }

    play.addEventListener('click', () => {
      const amount = bet.value;
      if (!takeBet(amount)) return;
      active++;
      syncControls();
      const bs = buckets;
      bs.forEach((b) => (b.y0 ??= b.y));
      dropBall(amount).finally(() => {
        active--;
        syncControls();
      });
    });

    return () => stage.destroy();
  },
};
