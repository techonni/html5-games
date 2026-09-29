import './style.css';
import { Application, Container, Graphics, Text, FillGradient } from 'pixi.js';

const DESIGN_W = 462;
const STAGE_W = 434;
const STAGE_H = 378;
const $ = (id) => document.getElementById(id);

/* ---------- game state ---------- */
const state = {
  phase: 'wait', // wait | run | crash
  waitLeft: 5,
  t: 0,
  mult: 1,
  crashAt: 2,
  history: [1.44, 1.28, 2.45, 2.45].reverse(),
  players: 27,
  totalPlayers: 34,
  bet: null, // { amount, cashout, cashedAt }
  queued: false,
  balance: 1000,
  stats: { wins: 0, losses: 0, wagered: 0, profit: 0 },
  mode: 'manual',
  autoLeft: 0,
  autoRunning: false,
  bots: [],
};

const rnd = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
const genCrash = () => {
  if (rnd() < 0.01) return 1;
  return Math.min(1e6, Math.floor((99 / (1 - rnd())))/ 100);
};
const fmt2 = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const parseNum = (s) => parseFloat(String(s).replace(/\s/g, '').replace(',', '.')) || 0;
const multAt = (t) => Math.exp(0.085 * t + 0.0011 * t * t);

/* ---------- scaling ---------- */
const app$ = $('app');
let zoom = 1;
let pixi;
function fit() {
  zoom = Math.min(Math.max(window.innerWidth, 320), 520) / DESIGN_W;
  app$.style.zoom = zoom;
  app$.style.height = window.innerHeight / zoom + 'px';
  if (pixi) pixi.renderer.resize(STAGE_W, STAGE_H), (pixi.renderer.resolution = (window.devicePixelRatio || 1) * zoom);
  if (pixi) pixi.renderer.resize(STAGE_W, STAGE_H);
}

/* ---------- PixiJS stage ---------- */
const C = {
  run: { hi: 0x59a3ff, lo: 0x2f6be0, curveA: 0x80e0e8, curveB: 0x3b82f6 },
  crash: { hi: 0xf0566b, lo: 0xc02b45 },
  wait: { hi: 0x8fb8c8, lo: 0x5a8698 },
};

async function initStage() {
  try { await Promise.all([document.fonts.load('700 100px Fredoka'), document.fonts.load('600 20px Figtree')]); } catch {}
  pixi = new Application();
  await pixi.init({
    width: STAGE_W, height: STAGE_H, backgroundColor: 0x131f2c,
    antialias: true, autoDensity: true, resolution: (window.devicePixelRatio || 1) * zoom,
  });
  $('stage').appendChild(pixi.canvas);
  const root = pixi.stage;

  const curveG = new Graphics();
  root.addChild(curveG);

  // history pills
  const pillsC = new Container();
  root.addChild(pillsC);
  function drawPills() {
    pillsC.removeChildren().forEach((c) => c.destroy({ children: true }));
    const list = state.history.slice(-4).reverse();
    list.forEach((v, i) => {
      const x = 10.5 + i * 90.5;
      const g = new Graphics().roundRect(x, 20, 81, 42, 21).fill(v >= 2 ? 0x6bdc4b : 0x2d3d4d);
      const t = new Text({ text: v.toFixed(2) + '×', style: { fontFamily: 'Figtree', fontWeight: '600', fontSize: 17, fill: v >= 2 ? 0x0a1a0a : 0xffffff } });
      t.anchor.set(0.5); t.position.set(x + 40.5, 41.5);
      pillsC.addChild(g, t);
    });
    const bx = 372.5;
    const b = new Graphics().circle(bx + 21.25, 41, 21.25).fill(0x2d3d4d);
    const ic = new Graphics();
    const cx = bx + 21.25, cy = 41;
    ic.arc(cx - 1, cy, 8, Math.PI * 0.75, Math.PI * 2.1).stroke({ width: 2.4, color: 0xffffff, cap: 'round' });
    ic.poly([cx - 12, cy - 1, cx - 6, cy - 1, cx - 9, cy + 4]).fill(0xffffff);
    ic.roundRect(cx + 3, cy + 0, 8, 10, 2).fill(0xffffff);
    ic.roundRect(cx + 4.5, cy + 2, 5, 6, 1).fill(0x2d3d4d);
    pillsC.addChild(b, ic);
  }

  // multiplier text (extruded)
  const multC = new Container();
  multC.position.set(217, 170);
  root.addChild(multC);
  const mk = (fill, stroke, dy) => {
    const t = new Text({
      text: '1.00×',
      style: { fontFamily: 'Fredoka', fontWeight: '700', fontSize: 96, letterSpacing: 5, fill, stroke: { color: stroke, width: 5, join: 'round' }, padding: 12 },
    });
    t.anchor.set(0.5); t.y = dy;
    return t;
  };
  const sLo = mk(0x2f6be0, 0x2f6be0, 11);
  const sHi = mk(0x59a3ff, 0x59a3ff, 5.5);
  const main = mk(0xffffff, 0xffffff, 0);
  multC.addChild(sLo, sHi, main);
  const setMultText = (s, colors, alpha = 1) => {
    [sLo, sHi, main].forEach((t) => (t.text = s));
    sLo.style.fill = sLo.style.stroke.color = colors.lo;
    sHi.style.fill = sHi.style.stroke.color = colors.hi;
    sLo.style.stroke = { color: colors.lo, width: 5, join: 'round' };
    sHi.style.stroke = { color: colors.hi, width: 5, join: 'round' };
    multC.alpha = alpha;
    const w = main.width - 0;
    const k = Math.min(1, 300 / Math.max(w, 1)) * (s.length <= 5 ? 216 / Math.max(w, 1) : 1);
    multC.scale.set(Math.min(k, 1.35));
  };

  // badge
  const badge = new Container();
  badge.position.set(217, 242);
  const badgeBg = new Graphics();
  const badgeTxt = new Text({ text: '', style: { fontFamily: 'Figtree', fontWeight: '600', fontSize: 22, fill: 0xffffff } });
  badgeTxt.anchor.set(0.5);
  const badgeNum = new Text({ text: '', style: { fontFamily: 'Figtree', fontWeight: '600', fontSize: 22, fill: 0x6bdc4b } });
  badgeNum.anchor.set(0, 0.5);
  badge.addChild(badgeBg, badgeTxt, badgeNum);
  root.addChild(badge);
  function setBadge(kind, sec) {
    badgeBg.clear();
    badgeNum.text = '';
    if (kind === 'crash') {
      badgeTxt.text = 'Crashed'; badgeTxt.x = 0;
      badgeBg.roundRect(-55, -23.5, 110, 47, 23.5).fill(0xb92a40);
      badge.visible = true;
    } else if (kind === 'wait') {
      const a = 'Starting in ';
      badgeTxt.text = a; badgeNum.text = sec.toFixed(2) + 's';
      badgeTxt.anchor.set(0, 0.5);
      const w = badgeTxt.width + badgeNum.width;
      badgeTxt.x = -w / 2; badgeNum.x = badgeTxt.x + badgeTxt.width;
      badgeBg.roundRect(-89, -23.5, 178, 47, 23.5).fill(0x2b3d4f);
      badge.visible = true;
    } else badge.visible = false;
    if (kind === 'crash') badgeTxt.anchor.set(0.5, 0.5);
  }

  // info row
  const usersIco = new Graphics();
  const drawUser = (x, y, r, w, col) => { usersIco.circle(x, y, r).fill(col); usersIco.roundRect(x - w / 2, y + r + 1.5, w, 8, 4).fill(col); };
  drawUser(9, 6, 4.6, 5, 0x8fa3b8);
  drawUser(9, 6, 4.6, 5, 0x8fa3b8);
  usersIco.clear();
  drawUser(4.5, 8.5, 3.4, 8, 0x7f95aa);
  drawUser(23.5, 8.5, 3.4, 8, 0x7f95aa);
  drawUser(14, 5.5, 4.8, 14, 0x9fb3c6);
  usersIco.scale.set(0.8); usersIco.position.set(31, 340);
  const usersTxt = new Text({ text: '', style: { fontFamily: 'Figtree', fontWeight: '600', fontSize: 20, fill: 0xffffff } });
  usersTxt.position.set(57, 337);
  const net = new Text({ text: 'Network Status', style: { fontFamily: 'Figtree', fontWeight: '500', fontSize: 19, fill: 0x8fa3b8 } });
  net.anchor.set(1, 0.5); net.position.set(391, 349);
  const dot = new Graphics().circle(412, 349, 6).fill(0x6bdc4b);
  root.addChild(usersIco, usersTxt, net, dot);

  const rocketG = new Graphics();
  root.addChild(rocketG);
  // keep curve under text/badge, rocket above curve
  root.setChildIndex(curveG, 0);

  const ox = 30, oy = 324;
  const pt = (m) => {
    let dx = 610 * Math.log(m);
    if (dx > 200) dx = 200 + 170 * (1 - Math.exp(-(dx - 200) / 170));
    let dy = 0.5 * dx + 0.00025 * dx * dx + (dx > 200 ? 0.3 * (dx - 200) : 0);
    dy = Math.min(dy, 250);
    return [ox + dx, oy - dy];
  };

  function drawCurve() {
    curveG.clear(); rocketG.clear();
    const m = state.phase === 'wait' ? 1 : state.mult;
    const pts = [];
    const n = 48;
    for (let i = 0; i <= n; i++) pts.push(pt(1 + (m - 1) * (i / n) ** 1.0));
    // log-spaced sampling gives smoother shape for large multipliers
    const lp = [];
    for (let i = 0; i <= n; i++) lp.push(pt(Math.exp(Math.log(m) * (i / n))));
    const p = m > 1.001 ? lp : [[ox, oy], [ox + 0.01, oy]];
    const [ex, ey] = p[p.length - 1];
    const crashed = state.phase === 'crash';

    if (m > 1.001) {
      const fill = new FillGradient({ type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, colorStops: [
        { offset: 0, color: crashed ? '#40566a' : '#33526e' }, { offset: 1, color: crashed ? '#1a2a38' : '#17283a' } ] });
      curveG.moveTo(p[0][0], oy);
      p.forEach(([x, y]) => curveG.lineTo(x, y));
      curveG.lineTo(ex, oy).closePath().fill(fill);
      // stroke
      curveG.moveTo(p[0][0], p[0][1]);
      p.forEach(([x, y]) => curveG.lineTo(x, y));
      curveG.stroke({ width: 8, color: crashed ? 0x8fa6b8 : 0x59b5f0, cap: 'round', join: 'round' });
    } else {
      curveG.moveTo(ox, oy).lineTo(ox + 0.01, oy).stroke({ width: 8, color: 0x8fdff0, cap: 'round' });
    }

    if (state.phase === 'crash') {
      const cx = ex, cy = ey - 12;
      const sx = ex + 66 - 0, sy = ey - 40;
      const star = [];
      for (let i = 0; i < 8; i++) { const r = i % 2 ? 4 : 10; const ang = (Math.PI / 4) * i - Math.PI / 2; star.push(sx + Math.cos(ang) * r, sy + Math.sin(ang) * r); }
      rocketG.poly(star).fill(0xeaf2f8);
      rocketG.alpha = 1;
    } else {
      rocketG.scale.set(1);
      rocketG.position.set(0, 0);
      rocketG.circle(ex, ey, 12).fill(0xffffff);
    }
  }

  function render() {
    const s = state;
    if (s.phase === 'wait') {
      setMultText('1.00×', C.wait, 0.55);
      setBadge('wait', Math.max(0, s.waitLeft));
    } else if (s.phase === 'run') {
      setMultText(s.mult.toFixed(2) + '×', C.run);
      setBadge('none');
    } else {
      setMultText(s.mult.toFixed(2) + '×', C.crash);
      setBadge('crash');
    }
    usersTxt.text = `${s.players} / ${s.totalPlayers}`;
    if (s.phase === 'wait') usersTxt.text = String(s.players);
    drawCurve();
  }

  return { render, drawPills };
}

/* ---------- bots ---------- */
function newBots() {
  const n = 12 + Math.floor(rnd() * 14);
  state.bots = Array.from({ length: n }, () => ({
    amount: Math.round((0.5 + rnd() ** 3 * 4000) * 100) / 100,
    at: Math.max(1.05, 1 + rnd() ** 1.8 * 6),
    out: false,
  }));
  state.totalPlayers = state.bots.length + (state.bet ? 1 : 0);
  state.players = state.totalPlayers;
}
function renderBettors() {
  const total = state.bots.reduce((s, b) => s + b.amount, 0) + (state.bet ? state.bet.amount : 0);
  $('b-count').textContent = state.phase === 'wait' ? state.totalPlayers : `${state.players}`;
  $('b-total').textContent = fmt2(6200000 + total * 30);
  const items = [...state.bots].sort((a, b) => b.amount - a.amount).slice(0, 5);
  $('b-list').innerHTML = items
    .map((b, i) => `<li class="${b.out ? 'w' : ''}"><span>Player ${String(i + 1).padStart(2, '0')}</span><span>${b.out ? b.at.toFixed(2) + '×' : '—'} · ${fmt2(b.amount)}</span></li>`)
    .join('');
}

/* ---------- controls ---------- */
const amountEl = $('amount'), cashEl = $('cashout'), gainEl = $('gain'), playBtn = $('play');
const getAmount = () => Math.max(0, parseNum(amountEl.value));
const getCash = () => Math.max(1.01, parseNum(cashEl.value) || 2);
function updateGain() { amountEl.classList.toggle('zero', getAmount() === 0); gainEl.value = fmt2(getAmount() * (getCash() - 1)); }
amountEl.addEventListener('input', updateGain);
amountEl.addEventListener('blur', () => { amountEl.value = fmt2(getAmount()); updateGain(); });
cashEl.addEventListener('blur', () => { cashEl.value = getCash().toFixed(2).replace('.', ','); updateGain(); });
cashEl.addEventListener('input', updateGain);
$('half').onclick = () => { amountEl.value = fmt2(getAmount() / 2); updateGain(); };
$('double').onclick = () => { amountEl.value = fmt2(getAmount() * 2); updateGain(); };
const stepCash = (d) => { cashEl.value = Math.max(1.01, Math.round((getCash() + d) * 100) / 100).toFixed(2).replace('.', ','); updateGain(); };
$('c-up').onclick = () => stepCash(0.1);
$('c-down').onclick = () => stepCash(-0.1);
$('bettors-toggle').onclick = () => { $('b-list').classList.toggle('open'); $('b-chev').classList.toggle('open'); };
$('heart').onclick = (e) => e.currentTarget.classList.toggle('on');

document.querySelectorAll('#mode button').forEach((b) => (b.onclick = () => {
  state.mode = b.dataset.mode;
  document.querySelectorAll('#mode button').forEach((x) => x.classList.toggle('on', x === b));
  document.querySelector('.controls').classList.toggle('auto', state.mode === 'auto');
  if (state.mode === 'manual') state.autoRunning = false;
  updatePlay();
}));

document.querySelectorAll('#tabs button').forEach((b) => (b.onclick = () => {
  document.querySelectorAll('#tabs button').forEach((x) => x.classList.toggle('on', x === b));
  ['desc', 'stats', 'chat'].forEach((k) => ($('tab-' + k).hidden = k !== b.dataset.tab));
  if (b.dataset.tab === 'stats') renderStats();
}));
function renderStats() {
  const s = state.stats;
  const p = (v) => `<b class="${v > 0 ? 'pos' : v < 0 ? 'neg' : ''}">${fmt2(v)}</b>`;
  $('tab-stats').innerHTML = `
    <div class="stat-row"><span>Balance (demo)</span><b>${fmt2(state.balance)}</b></div>
    <div class="stat-row"><span>Profit</span>${p(s.profit)}</div>
    <div class="stat-row"><span>Wagered</span><b>${fmt2(s.wagered)}</b></div>
    <div class="stat-row"><span>Wins</span><b>${s.wins}</b></div>
    <div class="stat-row"><span>Losses</span><b>${s.losses}</b></div>`;
}
$('fair').onclick = () => toast('Provably fair · RTP 99.00% · demo credits only');
$('to-top').onclick = () => $('scroll').scrollTo({ top: 0, behavior: 'smooth' });
$('scroll').addEventListener('scroll', () => $('to-top').classList.toggle('show', $('scroll').scrollTop > 380), { passive: true });

let toastTimer;
function toast(msg, kind = '') {
  const t = $('toast');
  t.textContent = msg; t.className = 'toast show ' + kind;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = 'toast'), 2400);
}

function updatePlay() {
  const s = state;
  playBtn.className = 'play';
  if (s.phase === 'run' && s.bet && s.bet.cashedAt == null) {
    playBtn.classList.add('cash');
    playBtn.textContent = `Cashout  ${fmt2(s.bet.amount * s.mult)}`;
  } else if (s.mode === 'auto') {
    playBtn.textContent = s.autoRunning ? 'Stop Autobet' : 'Start Autobet';
    if (s.autoRunning) playBtn.classList.add('cancel');
  } else if (s.queued) {
    playBtn.classList.add('cancel');
    playBtn.textContent = 'Cancel';
  } else playBtn.textContent = s.phase === 'wait' ? 'Play' : 'Play Next Round';
}

function placeQueuedBet() {
  const amt = getAmount();
  if (amt > state.balance) { toast('Insufficient balance', 'loss'); state.queued = false; state.autoRunning = false; return false; }
  state.balance -= amt;
  state.stats.wagered += amt;
  state.bet = { amount: amt, cashout: getCash(), cashedAt: null };
  state.queued = false;
  return true;
}

function cashOut(m) {
  const b = state.bet;
  if (!b || b.cashedAt != null) return;
  b.cashedAt = m;
  const win = b.amount * m;
  state.balance += win;
  state.stats.profit += win - b.amount;
  state.stats.wins++;
  toast(`Cashed out ${m.toFixed(2)}× · +${fmt2(win - b.amount)}`, 'win');
  updatePlay();
}

playBtn.onclick = () => {
  const s = state;
  if (s.phase === 'run' && s.bet && s.bet.cashedAt == null) return cashOut(s.mult);
  if (s.mode === 'auto') {
    s.autoRunning = !s.autoRunning;
    s.autoLeft = parseInt($('bets').value, 10) || 0;
    if (s.autoRunning) s.queued = true;
    else s.queued = false;
  } else s.queued = !s.queued;
  if (s.phase === 'wait' && s.queued && !s.bet) { placeQueuedBet(); updateGain(); }
  else if (s.phase === 'wait' && !s.queued && s.bet && s.bet.cashedAt == null) {
    // cancel bet placed for this round
    s.balance += s.bet.amount; s.stats.wagered -= s.bet.amount; s.bet = null;
  }
  updatePlay();
  renderBettors();
};

/* ---------- round loop ---------- */
let stage;
function startWait() {
  state.phase = 'wait';
  state.waitLeft = 5;
  state.bet = null;
  state.crashAt = genCrash();
  newBots();
  if (state.queued) placeQueuedBet();
  updatePlay();
  renderBettors();
}
function startRun() {
  state.phase = 'run';
  state.t = 0;
  state.mult = 1;
  state.players = state.totalPlayers;
  updatePlay();
}
function doCrash() {
  state.phase = 'crash';
  state.mult = state.crashAt;
  state.crashLeft = 3.2;
  state.history.push(state.crashAt);
  if (state.history.length > 8) state.history.shift();
  stage.drawPills();
  const b = state.bet;
  if (b && b.cashedAt == null) {
    state.stats.losses++;
    state.stats.profit -= b.amount;
    toast(`Crashed at ${state.crashAt.toFixed(2)}× · −${fmt2(b.amount)}`, 'loss');
  }
  if (state.mode === 'auto' && state.autoRunning) {
    if (state.autoLeft === 1) { state.autoRunning = false; state.autoLeft = 0; }
    else { if (state.autoLeft > 1) state.autoLeft--; state.queued = true; }
  }
  updatePlay();
  renderBettors();
}

function tick(dt) {
  const s = state;
  if (s.phase === 'wait') {
    s.waitLeft -= dt;
    if (s.waitLeft <= 0) startRun();
  } else if (s.phase === 'run') {
    s.t += dt;
    s.mult = Math.max(1, multAt(s.t));
    if (s.mult >= s.crashAt) return doCrash();
    let out = 0;
    s.bots.forEach((b) => { if (!b.out && s.mult >= b.at) b.out = true; if (!b.out) out++; });
    s.players = out + (s.bet && s.bet.cashedAt == null ? 1 : 0);
    if (s.bet && s.bet.cashedAt == null && s.mult >= s.bet.cashout) cashOut(s.bet.cashout);
    if (s.bet && s.bet.cashedAt == null) playBtn.textContent = `Cashout  ${fmt2(s.bet.amount * s.mult)}`;
  } else {
    s.crashLeft -= dt;
    if (s.crashLeft <= 0) startWait();
  }
}

/* ---------- boot ---------- */
fit();
window.addEventListener('resize', fit);
updateGain();
initStage().then((st) => {
  stage = st;
  fit();
  stage.drawPills();
  startWait();
  state.waitLeft = 3.88;
  let last = performance.now(), acc = 0;
  pixi.ticker.add(() => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    tick(dt);
    stage.render();
    acc += dt;
    if (acc > 0.4) { acc = 0; renderBettors(); if (!$('tab-stats').hidden) renderStats(); }
  });
});
