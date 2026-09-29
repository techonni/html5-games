import { Application, Container, Graphics, Text } from 'pixi.js';
import { t } from './i18n.js';

const FONT = 'Inter, system-ui, sans-serif';
const N = 25;

function rand() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] / 2 ** 32;
}

function minesMult(m, k) {
  let v = 0.99;
  for (let i = 0; i < k; i++) v *= (N - i) / (N - m - i);
  return v;
}

function fmt(n, lang) {
  return n.toLocaleString(lang === 'pt' ? 'pt-PT' : 'fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function el(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}

/** Shared wallet bridge with Crash parent */
export function createForYouGames({ getBalance, setBalance, getLang, onToast }) {
  let app = null;
  let destroyGame = null;

  async function mountPixi(host) {
    destroyCurrent();
    host.replaceChildren();
    const w = Math.max(280, host.clientWidth || 360);
    const h = Math.max(280, host.clientHeight || 360);
    app = new Application();
    await app.init({
      width: w,
      height: h,
      background: 0x0f212e,
      antialias: true,
      resolution: Math.min(2, window.devicePixelRatio || 1),
      autoDensity: true,
    });
    host.appendChild(app.canvas);
    return { app, w, h };
  }

  function destroyCurrent() {
    destroyGame?.();
    destroyGame = null;
    if (app) {
      app.destroy(true, { children: true });
      app = null;
    }
  }

  function syncBal(span) {
    if (span) span.textContent = fmt(getBalance(), getLang());
  }

  /* ---------- Mines (flat 5×5) ---------- */
  async function mountMines(stageEl, controlsEl, balEl) {
    const lang = getLang();
    const { app: pixi, w } = await mountPixi(stageEl);
    const SIZE = Math.min(w - 8, 420);
    const TILE = (SIZE - 48) / 5;
    const GAP = 8;
    const off = (w - (5 * TILE + 4 * GAP)) / 2;

    let mines = 3;
    let game = null;

    controlsEl.replaceChildren();
    const amount = el('input', 'fy-input');
    amount.value = '1,00';
    const minesSel = el('select', 'fy-select');
    for (let i = 1; i <= 24; i++) {
      const o = document.createElement('option');
      o.value = String(i);
      o.textContent = String(i);
      if (i === 3) o.selected = true;
      minesSel.appendChild(o);
    }
    const profit = el('input', 'fy-input');
    profit.readOnly = true;
    profit.value = '0,00';
    const play = el('button', 'fy-btn', t(lang, 'play'));
    const pick = el('button', 'fy-btn ghost', t(lang, 'randomPick'));
    pick.disabled = true;
    const cash = el('button', 'fy-btn cash', t(lang, 'cashout'));
    cash.disabled = true;

    controlsEl.append(
      wrapField(t(lang, 'amount'), amount),
      wrapField(t(lang, 'minesCount'), minesSel),
      wrapField(t(lang, 'gain'), profit),
      pick,
      play,
      cash,
    );

    const root = new Container();
    pixi.stage.addChild(root);
    const tiles = [];

    for (let i = 0; i < N; i++) {
      const c = new Container();
      c.x = off + (i % 5) * (TILE + GAP) + TILE / 2;
      c.y = 16 + Math.floor(i / 5) * (TILE + GAP) + TILE / 2;
      const face = new Graphics();
      const icon = new Container();
      c.addChild(face, icon);
      c.face = face;
      c.icon = icon;
      c.eventMode = 'static';
      c.cursor = 'pointer';
      c.on('pointertap', () => reveal(i));
      root.addChild(c);
      tiles.push(c);
      drawFace(c, 'hidden');
    }

    function drawFace(c, state) {
      c.face.clear().roundRect(-TILE / 2, -TILE / 2, TILE, TILE, 10);
      if (state === 'hidden') c.face.fill(0x2f4553);
      else if (state === 'gem') c.face.fill(0x1a2c38).stroke({ width: 2, color: 0x00e701 });
      else c.face.fill(0x1a2c38).stroke({ width: 2, color: 0xed6363 });
    }

    function gemIcon() {
      return new Graphics()
        .poly([0, -14, 12, -4, 0, 14, -12, -4])
        .fill(0x00e701)
        .poly([0, -14, 12, -4, 0, 0, -12, -4])
        .fill(0x5dffb0);
    }

    function bombIcon() {
      return new Graphics().circle(0, 2, 12).fill(0xed6363).circle(0, 2, 7).fill(0x2a0610);
    }

    function parseAmt() {
      return parseFloat(String(amount.value).replace(',', '.')) || 0;
    }

    function start() {
      const a = Math.round(parseAmt() * 100) / 100;
      if (a < 0.01) return onToast(t(lang, 'invalidAmount'), 'lose');
      if (a > getBalance()) return onToast(t(lang, 'insufficient'), 'lose');
      mines = Number(minesSel.value) || 3;
      setBalance(getBalance() - a);
      syncBal(balEl);
      const layout = new Set();
      while (layout.size < mines) layout.add(Math.floor(rand() * N));
      game = { amount: a, layout, revealed: 0, over: false };
      tiles.forEach((c) => {
        c.icon.removeChildren();
        drawFace(c, 'hidden');
        c.revealed = false;
      });
      profit.value = '0,00';
      pick.disabled = false;
      cash.disabled = false;
      play.textContent = t(lang, 'play');
    }

    function reveal(i) {
      if (!game || game.over || tiles[i].revealed) return;
      tiles[i].revealed = true;
      if (game.layout.has(i)) {
        drawFace(tiles[i], 'bomb');
        tiles[i].icon.addChild(bombIcon());
        game.over = true;
        pick.disabled = true;
        cash.disabled = true;
        onToast(`${t(lang, 'loss')} · −${fmt(game.amount, lang)} C`, 'lose');
        return;
      }
      drawFace(tiles[i], 'gem');
      tiles[i].icon.addChild(gemIcon());
      game.revealed++;
      const m = minesMult(mines, game.revealed);
      profit.value = fmt(game.amount * (m - 1), lang).replace(/\s/g, ' ');
    }

    function cashout() {
      if (!game || game.over || game.revealed < 1) return;
      const m = minesMult(mines, game.revealed);
      const payout = Math.round(game.amount * m * 100) / 100;
      setBalance(getBalance() + payout);
      syncBal(balEl);
      onToast(`${t(lang, 'gain')} · +${fmt(payout, lang)} C`, 'win');
      game.over = true;
      pick.disabled = true;
      cash.disabled = true;
    }

    play.onclick = () => {
      if (game && !game.over) return;
      start();
    };
    cash.onclick = cashout;
    pick.onclick = () => {
      if (!game || game.over) return;
      const free = tiles.map((c, i) => (!c.revealed ? i : -1)).filter((i) => i >= 0);
      if (free.length) reveal(free[Math.floor(rand() * free.length)]);
    };

    destroyGame = () => {
      root.destroy({ children: true });
    };
  }

  /* ---------- Flat slot helpers ---------- */
  function drawSym(kind, size = 28) {
    const g = new Graphics();
    const s = size / 2;
    if (kind === 'scarab') {
      g.ellipse(0, 2, s * 0.7, s * 0.85).fill(0xffbf00);
      g.circle(-s * 0.25, -s * 0.2, 3).fill(0x0f212e);
      g.circle(s * 0.25, -s * 0.2, 3).fill(0x0f212e);
    } else if (kind === 'tut') {
      g.roundRect(-s * 0.7, -s * 0.8, s * 1.4, s * 1.5, 6).fill(0xffbf00);
      g.roundRect(-s * 0.45, -s * 0.2, s * 0.9, s * 0.55, 4).fill(0x1a2c38);
    } else if (kind === 'gemG') g.poly([0, -s, s * 0.85, 0, 0, s, -s * 0.85, 0]).fill(0x00e701);
    else if (kind === 'gemP') g.poly([0, -s, s * 0.85, 0, 0, s, -s * 0.85, 0]).fill(0xb14dff);
    else if (kind === 'gemB') g.poly([0, -s, s * 0.85, 0, 0, s, -s * 0.85, 0]).fill(0x1475e1);
    else if (kind === 'spade') {
      g.poly([0, -s, s * 0.7, s * 0.15, 0, s * 0.35, -s * 0.7, s * 0.15]).fill(0x5b8def);
      g.rect(-3, s * 0.2, 6, s * 0.55).fill(0x5b8def);
    } else if (kind === 'club') {
      g.circle(0, -s * 0.25, s * 0.35).fill(0xb14dff);
      g.circle(-s * 0.35, s * 0.1, s * 0.32).fill(0xb14dff);
      g.circle(s * 0.35, s * 0.1, s * 0.32).fill(0xb14dff);
      g.rect(-3, s * 0.15, 6, s * 0.55).fill(0xb14dff);
    } else if (kind === 'diamond') g.poly([0, -s, s * 0.65, 0, 0, s, -s * 0.65, 0]).fill(0x00c390);
    else if (kind === 'helm') {
      g.roundRect(-s * 0.75, -s * 0.55, s * 1.5, s * 1.1, 8).fill(0x1475e1);
      g.rect(-s * 0.2, -s * 0.9, s * 0.4, s * 0.45).fill(0xffbf00);
    } else if (kind === 'bow') {
      g.arc(0, 0, s * 0.8, -Math.PI * 0.7, Math.PI * 0.7).stroke({ width: 3, color: 0xff8a3d });
      g.moveTo(-s * 0.7, 0).lineTo(s * 0.85, 0).stroke({ width: 2, color: 0xffbf00 });
    } else if (kind === 'crest') g.circle(0, 0, s * 0.75).fill(0xed6363).circle(0, 0, s * 0.4).fill(0x0f212e);
    else g.roundRect(-s * 0.6, -s * 0.6, s * 1.2, s * 1.2, 6).fill(0x7f8ba0);
    return g;
  }

  async function mountSlot(stageEl, controlsEl, balEl, opts) {
    const lang = getLang();
    const { app: pixi, w, h } = await mountPixi(stageEl);
    const cols = 5;
    const rows = 3;
    const symbols = opts.symbols;
    const cellW = Math.min(64, (w - 32) / cols);
    const cellH = Math.min(64, (h - 48) / rows);
    const gridW = cols * cellW;
    const gridH = rows * cellH;
    const ox = (w - gridW) / 2;
    const oy = 28;

    controlsEl.replaceChildren();
    const amount = el('input', 'fy-input');
    amount.value = '1,00';
    const payoutEl = el('input', 'fy-input');
    payoutEl.readOnly = true;
    payoutEl.value = '0,00';
    const play = el('button', 'fy-btn', t(lang, 'play'));
    const linesNote = el('div', 'fy-lines', `${t(lang, 'lines')}: ${opts.lines}`);
    controlsEl.append(
      wrapField(t(lang, 'amount'), amount),
      wrapField(t(lang, 'totalPayout'), payoutEl),
      linesNote,
      play,
    );

    const root = new Container();
    pixi.stage.addChild(root);

    const title = new Text({
      text: opts.title,
      style: { fontFamily: FONT, fontSize: 14, fontWeight: '700', fill: 0xb1bad3 },
    });
    title.anchor.set(0.5, 0);
    title.position.set(w / 2, 6);
    root.addChild(title);

    const cells = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const box = new Container();
        box.x = ox + c * cellW + cellW / 2;
        box.y = oy + r * cellH + cellH / 2;
        const bg = new Graphics()
          .roundRect(-cellW / 2 + 3, -cellH / 2 + 3, cellW - 6, cellH - 6, 8)
          .fill(0x213743);
        const icon = new Container();
        box.addChild(bg, icon);
        root.addChild(box);
        cells.push({ icon, sym: symbols[Math.floor(rand() * symbols.length)] });
        paintCell(cells[cells.length - 1]);
      }
    }

    function paintCell(cell) {
      cell.icon.removeChildren();
      cell.icon.addChild(drawSym(cell.sym, Math.min(cellW, cellH) * 0.55));
    }

    function spinOnce() {
      const a = Math.round((parseFloat(String(amount.value).replace(',', '.')) || 0) * 100) / 100;
      if (a < 0.01) return onToast(t(lang, 'invalidAmount'), 'lose');
      if (a > getBalance()) return onToast(t(lang, 'insufficient'), 'lose');
      setBalance(getBalance() - a);
      syncBal(balEl);

      for (const cell of cells) {
        cell.sym = symbols[Math.floor(rand() * symbols.length)];
        paintCell(cell);
      }

      // Simple pay: count best matching symbol on middle row (5 cells)
      const mid = cells.slice(cols, cols * 2).map((c) => c.sym);
      const counts = {};
      mid.forEach((s) => (counts[s] = (counts[s] || 0) + 1));
      let best = 0;
      for (const n of Object.values(counts)) best = Math.max(best, n);

      let mult = 0;
      if (best >= 5) mult = opts.pay5;
      else if (best >= 4) mult = opts.pay4;
      else if (best >= 3) mult = opts.pay3;

      // Scatter bonus (scarab / crest)
      const scatter = opts.scatter;
      const scatters = cells.filter((c) => c.sym === scatter).length;
      if (scatters >= 3) mult = Math.max(mult, opts.scatterPay);

      const win = Math.round(a * mult * 100) / 100;
      payoutEl.value = fmt(win, lang).replace(/\s/g, ' ');
      if (win > 0) {
        setBalance(getBalance() + win);
        syncBal(balEl);
        onToast(`${t(lang, 'gain')} · +${fmt(win, lang)} C`, 'win');
      } else {
        onToast(`${t(lang, 'loss')} · −${fmt(a, lang)} C`, 'lose');
      }
    }

    play.onclick = spinOnce;
    destroyGame = () => root.destroy({ children: true });
  }

  function wrapField(label, input) {
    const w = el('label', 'fy-field');
    w.append(el('span', 'fy-label', label), input);
    return w;
  }

  return {
    async open(id, stageEl, controlsEl, balEl) {
      if (id === 'mines') return mountMines(stageEl, controlsEl, balEl);
      if (id === 'scarab') {
        return mountSlot(stageEl, controlsEl, balEl, {
          title: 'Scarab Spin',
          lines: 20,
          symbols: ['scarab', 'tut', 'gemG', 'gemP', 'gemB', 'spade', 'club', 'diamond'],
          scatter: 'scarab',
          pay3: 0.5,
          pay4: 2,
          pay5: 10,
          scatterPay: 15,
        });
      }
      if (id === 'samurai') {
        return mountSlot(stageEl, controlsEl, balEl, {
          title: 'Blue Samurai',
          lines: 40,
          symbols: ['helm', 'bow', 'crest', 'gemB', 'gemG', 'spade', 'diamond', 'club'],
          scatter: 'crest',
          pay3: 0.4,
          pay4: 1.8,
          pay5: 12,
          scatterPay: 8,
        });
      }
    },
    close: destroyCurrent,
    syncBal,
  };
}
