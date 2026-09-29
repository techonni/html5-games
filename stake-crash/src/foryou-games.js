import { Application, Container, Graphics, Text } from 'pixi.js';
import { t } from './i18n.js';

const FONT = 'Inter, system-ui, sans-serif';
const N = 25;
const C = {
  bg: 0x0f212e,
  panel: 0x1a2c38,
  tile: 0x2f4553,
  tileHi: 0x3d5a6c,
  blue: 0x1475e1,
  green: 0x00e701,
  red: 0xed6363,
  gold: 0xffbf00,
  text: 0xffffff,
  muted: 0xb1bad3,
};

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

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function field(label, node) {
  const w = el('label', 'sg-field');
  w.append(el('span', 'sg-label', label), node);
  return w;
}

function parseAmt(input) {
  return Math.round((parseFloat(String(input.value).replace(',', '.')) || 0) * 100) / 100;
}

/** Wallet bridge shared with Crash */
export function createForYouGames({ getBalance, setBalance, getLang, onToast }) {
  let app = null;
  let destroyGame = null;
  let ro = null;
  let hostEl = null;

  async function mountPixi(host) {
    // Tear down previous game scene only (keep one Pixi Application alive)
    destroyGame?.();
    destroyGame = null;

    hostEl = host;
    const w = Math.max(300, host.clientWidth || 360);
    const h = Math.max(300, host.clientHeight || 420);

    if (!app) {
      app = new Application();
      await app.init({
        width: w,
        height: h,
        background: C.bg,
        antialias: true,
        resolution: Math.min(2, window.devicePixelRatio || 1),
        autoDensity: true,
        preference: 'webgl',
      });
      ro = new ResizeObserver(() => {
        if (!app || !hostEl?.isConnected) return;
        app.renderer.resize(Math.max(1, hostEl.clientWidth), Math.max(1, hostEl.clientHeight));
      });
    } else {
      app.stage.removeChildren().forEach((c) => c.destroy({ children: true }));
      app.renderer.resize(w, h);
      app.ticker.start();
    }

    if (app.canvas.parentNode !== host) {
      host.replaceChildren();
      host.appendChild(app.canvas);
    }
    ro.observe(host);
    return { app, w: app.screen.width, h: app.screen.height };
  }

  function clearScene() {
    destroyGame?.();
    destroyGame = null;
    if (ro && hostEl) {
      try {
        ro.unobserve(hostEl);
      } catch {
        /* ignore */
      }
    }
    if (app) {
      try {
        app.stage.removeChildren().forEach((c) => c.destroy({ children: true }));
        app.ticker.stop();
      } catch {
        /* ignore */
      }
    }
  }

  function syncBal(span) {
    if (span) span.textContent = fmt(getBalance(), getLang());
  }

  function debit(a, lang) {
    if (a < 0.01) {
      onToast(t(lang, 'invalidAmount'), 'lose');
      return false;
    }
    if (a > getBalance()) {
      onToast(t(lang, 'insufficient'), 'lose');
      return false;
    }
    setBalance(getBalance() - a);
    return true;
  }

  /* ===================== MINES (Stake-like) ===================== */
  async function mountMines(stageEl, controlsEl, balEl) {
    const lang = getLang();
    const { app: pixi } = await mountPixi(stageEl);

    let mines = 3;
    let game = null;

    // Controls — Stake order: Play, Amount+½/2x, Random Pick
    controlsEl.replaceChildren();
    const play = el('button', 'sg-play', t(lang, 'play'));
    const amount = el('input', 'sg-input');
    amount.value = '1,00';
    amount.inputMode = 'decimal';
    const half = el('button', 'sg-chip', '½');
    const dbl = el('button', 'sg-chip', '2×');
    const amountRow = el('div', 'sg-amount-row');
    const amountBox = el('div', 'sg-input-box');
    amountBox.append(amount, el('span', 'sg-coin', 'C'));
    const segs = el('div', 'sg-segs');
    segs.append(half, dbl);
    amountRow.append(amountBox, segs);

    const minesSel = el('select', 'sg-input');
    for (let i = 1; i <= 24; i++) {
      const o = document.createElement('option');
      o.value = String(i);
      o.textContent = String(i);
      if (i === 3) o.selected = true;
      minesSel.appendChild(o);
    }
    const profit = el('input', 'sg-input');
    profit.readOnly = true;
    profit.value = '0,00';
    const pick = el('button', 'sg-secondary', t(lang, 'randomPick'));
    pick.disabled = true;
    const cash = el('button', 'sg-cash', t(lang, 'cashout'));
    cash.hidden = true;

    controlsEl.append(
      play,
      field(t(lang, 'amount'), amountRow),
      el('div', 'sg-grid-2'),
    );
    const grid2 = controlsEl.querySelector('.sg-grid-2');
    grid2.append(field(t(lang, 'minesCount'), minesSel), field(t(lang, 'gain'), profit));
    controlsEl.append(pick, cash);

    half.onclick = () => {
      amount.value = fmt(Math.max(0.01, Math.floor(parseAmt(amount) * 50) / 100), lang).replace(/\s/g, '');
    };
    dbl.onclick = () => {
      amount.value = fmt(Math.min(getBalance(), Math.round(parseAmt(amount) * 200) / 100), lang).replace(/\s/g, '');
    };

    const root = new Container();
    pixi.stage.addChild(root);
    const tiles = [];

    function layout() {
      const W = pixi.screen.width;
      const H = pixi.screen.height;
      const pad = 14;
      const gap = 8;
      const side = Math.min(W - pad * 2, H - pad * 2);
      const tile = (side - gap * 4) / 5;
      const ox = (W - side) / 2 + tile / 2;
      const oy = (H - side) / 2 + tile / 2;
      tiles.forEach((c, i) => {
        c.x = ox + (i % 5) * (tile + gap);
        c.y = oy + Math.floor(i / 5) * (tile + gap);
        c.tileSize = tile;
        drawFace(c, c.state || 'hidden');
      });
    }

    function drawFace(c, state) {
      if (!c?.face || c.face.destroyed) return;
      c.state = state;
      const s = c.tileSize || 56;
      const r = Math.max(6, s * 0.14);
      c.face.clear().roundRect(-s / 2, -s / 2, s, s, r);
      if (state === 'hidden') c.face.fill(C.tile);
      else if (state === 'gem') c.face.fill(C.panel).stroke({ width: 2.5, color: C.green });
      else if (state === 'bomb') c.face.fill(C.panel).stroke({ width: 2.5, color: C.red });
      else c.face.fill(C.panel);
    }

    function gemIcon(s) {
      const g = new Graphics();
      const k = s * 0.28;
      g.poly([0, -k, k * 0.9, -k * 0.15, 0, k, -k * 0.9, -k * 0.15]).fill(0x00c96b);
      g.poly([0, -k, k * 0.9, -k * 0.15, 0, -k * 0.05, -k * 0.9, -k * 0.15]).fill(0x5dffb0);
      return g;
    }

    function bombIcon(s) {
      const g = new Graphics();
      const k = s * 0.22;
      g.circle(0, k * 0.1, k).fill(C.red);
      g.circle(0, k * 0.1, k * 0.55).fill(0x2a0610);
      g.roundRect(-k * 0.12, -k * 1.15, k * 0.24, k * 0.45, 2).fill(0x9fb0c8);
      return g;
    }

    for (let i = 0; i < N; i++) {
      const c = new Container();
      c.face = new Graphics();
      c.icon = new Container();
      c.addChild(c.face, c.icon);
      c.eventMode = 'static';
      c.cursor = 'pointer';
      c.on('pointertap', () => reveal(i));
      c.on('pointerover', () => {
        if (game && !game.over && !c.revealed) c.face.tint = 0xd0e4ff;
      });
      c.on('pointerout', () => {
        c.face.tint = 0xffffff;
      });
      root.addChild(c);
      tiles.push(c);
    }
    layout();

    function resetBoard() {
      tiles.forEach((c) => {
        c.revealed = false;
        c.icon.removeChildren();
        drawFace(c, 'hidden');
        c.face.tint = 0xffffff;
      });
    }

    function start() {
      const a = parseAmt(amount);
      const langNow = getLang();
      if (!debit(a, langNow)) return;
      syncBal(balEl);
      mines = Number(minesSel.value) || 3;
      const layoutSet = new Set();
      while (layoutSet.size < mines) layoutSet.add(Math.floor(rand() * N));
      game = { amount: a, layout: layoutSet, revealed: 0, over: false };
      resetBoard();
      profit.value = '0,00';
      pick.disabled = false;
      cash.hidden = true;
      play.textContent = t(langNow, 'play');
      play.disabled = true;
    }

    function reveal(i) {
      if (!game || game.over || tiles[i].revealed) return;
      const langNow = getLang();
      tiles[i].revealed = true;
      tiles[i].face.tint = 0xffffff;
      if (game.layout.has(i)) {
        drawFace(tiles[i], 'bomb');
        tiles[i].icon.addChild(bombIcon(tiles[i].tileSize));
        // reveal rest
        tiles.forEach((c, idx) => {
          if (!c.revealed && game.layout.has(idx)) {
            c.revealed = true;
            drawFace(c, 'bomb');
            c.icon.addChild(bombIcon(c.tileSize));
          }
        });
        game.over = true;
        pick.disabled = true;
        cash.hidden = true;
        play.disabled = false;
        onToast(`${t(langNow, 'loss')} · −${fmt(game.amount, langNow)} C`, 'lose');
        return;
      }
      drawFace(tiles[i], 'gem');
      tiles[i].icon.addChild(gemIcon(tiles[i].tileSize));
      game.revealed++;
      const m = minesMult(mines, game.revealed);
      profit.value = fmt(game.amount * (m - 1), langNow);
      cash.hidden = false;
      cash.textContent = `${t(langNow, 'cashout')} ${fmt(game.amount * m, langNow)}`;
    }

    function cashout() {
      if (!game || game.over || game.revealed < 1) return;
      const langNow = getLang();
      const m = minesMult(mines, game.revealed);
      const payout = Math.round(game.amount * m * 100) / 100;
      setBalance(getBalance() + payout);
      syncBal(balEl);
      onToast(`${t(langNow, 'gain')} · +${fmt(payout, langNow)} C`, 'win');
      game.over = true;
      pick.disabled = true;
      cash.hidden = true;
      play.disabled = false;
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

    const minesRo = new ResizeObserver(() => layout());
    minesRo.observe(stageEl);
    destroyGame = () => {
      minesRo.disconnect();
      // Don't destroy scene graph here — Application.destroy handles it safely later
    };
  }

  /* ===================== SLOT SYMBOLS (flat) ===================== */
  function sym(kind, size) {
    const g = new Graphics();
    const s = size / 2;
    switch (kind) {
      case 'scarab': {
        g.ellipse(0, 2, s * 0.72, s * 0.9).fill(C.gold);
        g.ellipse(0, 2, s * 0.45, s * 0.55).fill(0xe6a800);
        g.circle(-s * 0.22, -s * 0.15, s * 0.1).fill(C.bg);
        g.circle(s * 0.22, -s * 0.15, s * 0.1).fill(C.bg);
        g.moveTo(-s * 0.55, -s * 0.55).lineTo(-s * 0.2, -s * 0.9).lineTo(s * 0.2, -s * 0.9).lineTo(s * 0.55, -s * 0.55)
          .stroke({ width: 2.2, color: C.gold });
        break;
      }
      case 'tut': {
        g.roundRect(-s * 0.7, -s * 0.75, s * 1.4, s * 1.45, 7).fill(C.gold);
        g.roundRect(-s * 0.55, -s * 0.55, s * 1.1, s * 0.35, 4).fill(0x1a2c38);
        g.roundRect(-s * 0.4, 0, s * 0.8, s * 0.45, 4).fill(0x1a2c38);
        g.circle(-s * 0.22, -s * 0.35, s * 0.08).fill(C.text);
        g.circle(s * 0.22, -s * 0.35, s * 0.08).fill(C.text);
        break;
      }
      case 'gemG':
        g.poly([0, -s, s * 0.85, 0, 0, s, -s * 0.85, 0]).fill(0x00c96b);
        g.poly([0, -s, s * 0.85, 0, 0, -s * 0.1, -s * 0.85, 0]).fill(0x5dffb0);
        break;
      case 'gemP':
        g.poly([0, -s, s * 0.85, 0, 0, s, -s * 0.85, 0]).fill(0xb14dff);
        g.poly([0, -s, s * 0.85, 0, 0, -s * 0.1, -s * 0.85, 0]).fill(0xd4a0ff);
        break;
      case 'gemB':
        g.poly([0, -s, s * 0.85, 0, 0, s, -s * 0.85, 0]).fill(0x1475e1);
        g.poly([0, -s, s * 0.85, 0, 0, -s * 0.1, -s * 0.85, 0]).fill(0x5aa8ff);
        break;
      case 'spade':
        g.poly([0, -s * 0.95, s * 0.72, s * 0.1, 0, s * 0.35, -s * 0.72, s * 0.1]).fill(0x5b8def);
        g.rect(-s * 0.12, s * 0.15, s * 0.24, s * 0.7).fill(0x5b8def);
        break;
      case 'club':
        g.circle(0, -s * 0.35, s * 0.32).fill(0xb14dff);
        g.circle(-s * 0.32, s * 0.05, s * 0.3).fill(0xb14dff);
        g.circle(s * 0.32, s * 0.05, s * 0.3).fill(0xb14dff);
        g.rect(-s * 0.1, s * 0.1, s * 0.2, s * 0.65).fill(0xb14dff);
        break;
      case 'diamond':
        g.poly([0, -s, s * 0.7, 0, 0, s, -s * 0.7, 0]).fill(0x00c390);
        break;
      case 'helm':
        g.roundRect(-s * 0.8, -s * 0.35, s * 1.6, s * 1.05, 10).fill(0x1475e1);
        g.roundRect(-s * 0.18, -s * 0.95, s * 0.36, s * 0.7, 4).fill(C.gold);
        g.circle(-s * 0.28, 0, s * 0.12).fill(C.bg);
        g.circle(s * 0.28, 0, s * 0.12).fill(C.bg);
        break;
      case 'bow':
        g.arc(0, 0, s * 0.85, -2.2, 2.2).stroke({ width: 3.2, color: 0xff8a3d });
        g.moveTo(-s * 0.75, 0).lineTo(s * 0.9, 0).stroke({ width: 2.2, color: C.gold });
        g.circle(s * 0.9, 0, s * 0.12).fill(C.gold);
        break;
      case 'crest':
        g.circle(0, 0, s * 0.8).fill(C.red);
        g.circle(0, 0, s * 0.48).fill(C.bg);
        g.poly([0, -s * 0.28, s * 0.12, 0, 0, s * 0.28, -s * 0.12, 0]).fill(C.gold);
        break;
      case 'coin':
        g.circle(0, 0, s * 0.85).fill(C.gold);
        g.circle(0, 0, s * 0.55).fill(0xe6a800);
        break;
      case 'cat':
        g.roundRect(-s * 0.55, -s * 0.35, s * 1.1, s * 1.1, 8).fill(0xcfd6e0);
        g.poly([-s * 0.45, -s * 0.2, -s * 0.2, -s * 0.85, 0, -s * 0.25]).fill(0xcfd6e0);
        g.poly([s * 0.45, -s * 0.2, s * 0.2, -s * 0.85, 0, -s * 0.25]).fill(0xcfd6e0);
        g.circle(-s * 0.2, 0.05 * s, s * 0.08).fill(C.bg);
        g.circle(s * 0.2, 0.05 * s, s * 0.08).fill(C.bg);
        break;
      default:
        g.roundRect(-s * 0.6, -s * 0.6, s * 1.2, s * 1.2, 6).fill(0x7f8ba0);
    }
    return g;
  }

  /* ===================== SLOTS ===================== */
  async function mountSlot(stageEl, controlsEl, balEl, opts) {
    const lang = getLang();
    const { app: pixi } = await mountPixi(stageEl);
    const cols = 5;
    const rows = 3;
    const symbols = opts.symbols;

    controlsEl.replaceChildren();
    const play = el('button', 'sg-play', t(lang, 'play'));
    const amount = el('input', 'sg-input');
    amount.value = '1,00';
    amount.inputMode = 'decimal';
    const half = el('button', 'sg-chip', '½');
    const dbl = el('button', 'sg-chip', '2×');
    const amountRow = el('div', 'sg-amount-row');
    const amountBox = el('div', 'sg-input-box');
    amountBox.append(amount, el('span', 'sg-coin', 'C'));
    const segs = el('div', 'sg-segs');
    segs.append(half, dbl);
    amountRow.append(amountBox, segs);

    const linesSel = el('select', 'sg-input');
    for (const n of opts.lineOptions) {
      const o = document.createElement('option');
      o.value = String(n);
      o.textContent = String(n);
      if (n === opts.lines) o.selected = true;
      linesSel.appendChild(o);
    }
    const perLine = el('input', 'sg-input');
    perLine.readOnly = true;
    perLine.value = '0,05';

    const updatePer = () => {
      const a = parseAmt(amount);
      const lines = Number(linesSel.value) || opts.lines;
      perLine.value = fmt(a / lines, lang);
    };
    amount.oninput = updatePer;
    linesSel.onchange = updatePer;
    half.onclick = () => {
      amount.value = fmt(Math.max(0.01, Math.floor(parseAmt(amount) * 50) / 100), lang).replace(/\s/g, '');
      updatePer();
    };
    dbl.onclick = () => {
      amount.value = fmt(Math.min(getBalance(), Math.round(parseAmt(amount) * 200) / 100), lang).replace(/\s/g, '');
      updatePer();
    };
    updatePer();

    controlsEl.append(
      play,
      field(t(lang, 'amount'), amountRow),
      el('div', 'sg-grid-2'),
    );
    const g2 = controlsEl.querySelector('.sg-grid-2');
    g2.append(field(t(lang, 'lines'), linesSel), field(t(lang, 'amount') + ' / ' + t(lang, 'lines').toLowerCase(), perLine));

    const root = new Container();
    pixi.stage.addChild(root);
    const cells = [];
    let payoutTxt;

    function paint() {
      if (!pixi || pixi.renderer == null || root.destroyed) return;
      const W = pixi.screen.width;
      const H = pixi.screen.height;
      while (root.children.length) {
        const ch = root.children[0];
        root.removeChild(ch);
        ch.destroy({ children: true });
      }
      cells.length = 0;

      const padX = 12;
      const topBar = 36;
      const cellW = (W - padX * 2) / cols;
      const cellH = Math.min(cellW * 1.05, (H - topBar - 16) / rows);
      const gridW = cellW * cols;
      const gridH = cellH * rows;
      const ox = (W - gridW) / 2;
      const oy = topBar + Math.max(0, (H - topBar - gridH) / 2);

      const frame = new Graphics()
        .roundRect(ox - 6, oy - 6, gridW + 12, gridH + 12, 12)
        .fill(C.panel)
        .stroke({ width: 2, color: 0x2f4553 });
      root.addChild(frame);

      payoutTxt = new Text({
        text: `${t(getLang(), 'totalPayout')}: 0,00 C`,
        style: { fontFamily: FONT, fontSize: 13, fontWeight: '700', fill: C.muted },
      });
      payoutTxt.anchor.set(0.5, 0);
      payoutTxt.position.set(W / 2, 10);
      root.addChild(payoutTxt);

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const box = new Container();
          box.x = ox + c * cellW + cellW / 2;
          box.y = oy + r * cellH + cellH / 2;
          const bg = new Graphics()
            .roundRect(-cellW / 2 + 4, -cellH / 2 + 4, cellW - 8, cellH - 8, 8)
            .fill(0x213743);
          const icon = new Container();
          box.addChild(bg, icon);
          root.addChild(box);
          const kind = symbols[Math.floor(rand() * symbols.length)];
          const cell = { icon, kind, size: Math.min(cellW, cellH) * 0.58 };
          cell.icon.addChild(sym(cell.kind, cell.size));
          cells.push(cell);
        }
      }
    }

    paint();

    let spinning = false;
    async function spin() {
      if (spinning) return;
      const langNow = getLang();
      const a = parseAmt(amount);
      if (!debit(a, langNow)) return;
      syncBal(balEl);
      spinning = true;
      play.disabled = true;

      // animate reel shuffle
      for (let step = 0; step < 10; step++) {
        for (const cell of cells) {
          cell.kind = symbols[Math.floor(rand() * symbols.length)];
          cell.icon.removeChildren();
          cell.icon.addChild(sym(cell.kind, cell.size));
        }
        await new Promise((r) => setTimeout(r, 45));
      }

      const mid = cells.slice(cols, cols * 2).map((c) => c.kind);
      const counts = {};
      mid.forEach((s) => (counts[s] = (counts[s] || 0) + 1));
      let best = 0;
      for (const n of Object.values(counts)) best = Math.max(best, n);

      let mult = 0;
      if (best >= 5) mult = opts.pay5;
      else if (best >= 4) mult = opts.pay4;
      else if (best >= 3) mult = opts.pay3;

      const scatters = cells.filter((c) => c.kind === opts.scatter).length;
      if (scatters >= 3) mult = Math.max(mult, opts.scatterPay);

      const win = Math.round(a * mult * 100) / 100;
      if (payoutTxt) payoutTxt.text = `${t(langNow, 'totalPayout')}: ${fmt(win, langNow)} C`;
      if (win > 0) {
        setBalance(getBalance() + win);
        syncBal(balEl);
        onToast(`${t(langNow, 'gain')} · +${fmt(win, langNow)} C`, 'win');
      } else {
        onToast(`${t(langNow, 'loss')} · −${fmt(a, langNow)} C`, 'lose');
      }
      spinning = false;
      play.disabled = false;
    }

    play.onclick = spin;
    const slotRo = new ResizeObserver(() => {
      if (!spinning && app) paint();
    });
    slotRo.observe(stageEl);
    destroyGame = () => {
      slotRo.disconnect();
      spinning = true; // block late paints
    };
  }

  return {
    async open(id, stageEl, controlsEl, balEl) {
      if (id === 'mines') return mountMines(stageEl, controlsEl, balEl);
      if (id === 'scarab') {
        return mountSlot(stageEl, controlsEl, balEl, {
          title: 'Scarab Spin',
          lines: 20,
          lineOptions: [10, 20],
          symbols: ['scarab', 'tut', 'gemG', 'gemP', 'gemB', 'spade', 'club', 'diamond', 'coin', 'cat'],
          scatter: 'scarab',
          pay3: 0.6,
          pay4: 2.5,
          pay5: 12,
          scatterPay: 15,
        });
      }
      if (id === 'samurai') {
        return mountSlot(stageEl, controlsEl, balEl, {
          title: 'Blue Samurai',
          lines: 40,
          lineOptions: [20, 40],
          symbols: ['helm', 'bow', 'crest', 'gemB', 'gemG', 'spade', 'diamond', 'club', 'coin'],
          scatter: 'crest',
          pay3: 0.5,
          pay4: 2.2,
          pay5: 14,
          scatterPay: 10,
        });
      }
    },
    close: clearScene,
    syncBal,
  };
}
