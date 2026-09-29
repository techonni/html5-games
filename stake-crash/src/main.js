import 'bootstrap/dist/css/bootstrap.min.css';
import './style.css';
import * as bootstrap from 'bootstrap';
import { Application, Container, Graphics, Text, FillGradient } from 'pixi.js';

const $ = (id) => document.getElementById(id);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const LS = {
  get: (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

/* ---------- utils ---------- */
const rnd = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
const fmt2 = (n) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const parseNum = (s) => parseFloat(String(s).replace(/\s/g, '').replace(',', '.')) || 0;
const multAt = (t) => Math.exp(0.085 * t + 0.0011 * t * t);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sha256 = async (str) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
};
const randHex = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, '0')).join('');
async function crashFromSeeds(server, client, nonce) {
  const h = parseInt((await sha256(`${server}:${client}:${nonce}`)).slice(0, 13), 16);
  const e = 2 ** 52;
  if (h % 100 === 0) return 1;
  return Math.floor((100 * e - h) / (e - h)) / 100;
}

/* ---------- state ---------- */
const settings = { sound: true, anim: true, toast: true, minCash: false, ...LS.get('zr_settings', {}) };
const state = {
  phase: 'wait', waitLeft: 5, t: 0, mult: 1, crashAt: 2, crashLeft: 0,
  history: LS.get('zr_hist', [1.44, 1.28, 2.45, 2.45]).slice(-8),
  rounds: LS.get('zr_rounds', []),
  players: 0, totalPlayers: 0, bet: null, queued: false,
  balance: 1000, stats: { wins: 0, losses: 0, wagered: 0, profit: 0 },
  mode: 'manual', autoLeft: 0, autoRunning: false, bots: [],
  fair: { server: '', hash: '', nonce: 0, client: LS.get('zr_client', randHex(8)), ready: false },
  lastRound: null, user: null,
};

/* ---------- accounts / wallet ---------- */
const users = () => LS.get('zr_users', {});
function persistBalance() {
  if (state.user) { const u = users(); if (u[state.user]) { u[state.user].balance = state.balance; u[state.user].stats = state.stats; LS.set('zr_users', u); } }
  else { LS.set('zr_guest_bal', state.balance); LS.set('zr_guest_stats', state.stats); }
}
function renderBalance() {
  $$('[data-bind="bal"]').forEach((e) => (e.textContent = fmt2(state.balance)));
  persistBalance();
}
function setUser(name) {
  state.user = name;
  if (name) {
    const u = users()[name];
    state.balance = u.balance; state.stats = u.stats || state.stats;
    $('user-name').textContent = name; $('user-mail').textContent = u.email;
  } else {
    state.balance = LS.get('zr_guest_bal', 1000); state.stats = LS.get('zr_guest_stats', state.stats);
  }
  $('guest-btns').classList.toggle('d-none', !!name);
  $('user-menu').classList.toggle('d-none', !name);
  LS.set('zr_session', name);
  renderBalance(); renderStats(); updatePlay();
}
const modal = (id) => bootstrap.Modal.getOrCreateInstance($(id));
const hashPw = (u, p) => sha256(`zunrel:${u.toLowerCase()}:${p}`);

$('f-register').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('r-user').value.trim(), mail = $('r-mail').value.trim(), pw = $('r-pass').value;
  const err = $('r-err');
  if (name.length < 3) return (err.textContent = 'Le pseudo doit contenir au moins 3 caractères.');
  if (!/^[\w.-]+$/.test(name)) return (err.textContent = 'Pseudo : lettres, chiffres, . _ - uniquement.');
  if (!/^\S+@\S+\.\S+$/.test(mail)) return (err.textContent = 'Adresse e-mail invalide.');
  if (pw.length < 6) return (err.textContent = 'Le mot de passe doit contenir au moins 6 caractères.');
  const all = users();
  if (Object.keys(all).some((k) => k.toLowerCase() === name.toLowerCase())) return (err.textContent = 'Ce pseudo est déjà pris.');
  all[name] = { email: mail, hash: await hashPw(name, pw), balance: 1000, stats: { wins: 0, losses: 0, wagered: 0, profit: 0 } };
  LS.set('zr_users', all);
  err.textContent = ''; e.target.reset(); modal('m-register').hide();
  setUser(name); toast(`Bienvenue, ${name} ! 1 000 G offerts.`, 'win');
});
$('f-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('l-user').value.trim().toLowerCase(), pw = $('l-pass').value, err = $('l-err');
  const all = users();
  const name = Object.keys(all).find((k) => k.toLowerCase() === id || all[k].email.toLowerCase() === id);
  if (!name || all[name].hash !== (await hashPw(name, pw))) return (err.textContent = 'Identifiants incorrects.');
  err.textContent = ''; e.target.reset(); modal('m-login').hide();
  setUser(name); toast(`Content de vous revoir, ${name} !`, 'win');
});
$$('[data-switch]').forEach((a) => a.addEventListener('click', (e) => {
  e.preventDefault();
  const cur = a.closest('.modal');
  cur.addEventListener('hidden.bs.modal', () => modal(a.dataset.switch.slice(1)).show(), { once: true });
  modal(cur.id).hide();
}));
$('logout').onclick = () => { if (state.bet && state.phase === 'run' && state.bet.cashedAt == null) return toast('Terminez la manche en cours avant de vous déconnecter.'); setUser(null); toast('Vous êtes déconnecté.'); };
$('refill').onclick = () => { state.balance += 1000; renderBalance(); toast('+1 000 G ajoutés à votre solde.', 'win'); };
$('reset-bal').onclick = () => { if (state.bet) return toast('Impossible pendant une mise.'); state.balance = 1000; renderBalance(); toast('Solde réinitialisé à 1 000 G.'); };

/* ---------- toast + sound ---------- */
let toastInst;
function toast(msg, kind = '', force = false) {
  if (!force && kind && !settings.toast && kind !== 'win-force') return;
  const el = $('toast');
  el.className = 'toast align-items-center border-0 ' + kind;
  $('toast-body').textContent = msg;
  toastInst ||= new bootstrap.Toast(el, { delay: 2600 });
  toastInst.show();
}
let actx;
function beep(freq, dur = 0.12, type = 'sine', vol = 0.06) {
  if (!settings.sound) return;
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.value = freq; g.gain.value = vol;
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
    o.connect(g).connect(actx.destination); o.start(); o.stop(actx.currentTime + dur);
  } catch {}
}

/* ---------- PixiJS stage ---------- */
let pixi, stage;
const C = {
  run: { hi: 0x59a3ff, lo: 0x2f6be0 },
  crash: { hi: 0xf0566b, lo: 0xc02b45 },
  wait: { hi: 0x8fb8c8, lo: 0x5a8698 },
};

async function initStage() {
  try { await Promise.race([Promise.all([document.fonts.load('700 100px Fredoka'), document.fonts.load('600 20px Figtree')]), new Promise((r) => setTimeout(r, 2500))]); } catch {}
  pixi = new Application();
  await pixi.init({ resizeTo: $('stage'), backgroundColor: 0x131f2c, antialias: true, autoDensity: true, resolution: Math.min(window.devicePixelRatio || 1, 3) });
  $('stage').appendChild(pixi.canvas);
  const root = pixi.stage;
  const curveG = new Graphics();
  const pillsC = new Container();
  root.addChild(curveG, pillsC);

  function drawPills() {
    pillsC.removeChildren().forEach((c) => c.destroy({ children: true }));
    state.history.slice(-4).reverse().forEach((v, i) => {
      const x = 10.5 + i * 90.5;
      const g = new Graphics().roundRect(x, 20, 81, 42, 21).fill(v >= 2 ? 0x6bdc4b : 0x2d3d4d);
      const t = new Text({ text: v.toFixed(2).replace('.', ',') + '×', style: { fontFamily: 'Figtree', fontWeight: '600', fontSize: 17, fill: v >= 2 ? 0x0a1a0a : 0xffffff } });
      t.anchor.set(0.5); t.position.set(x + 40.5, 41.5);
      pillsC.addChild(g, t);
    });
    const cx = 372.5 + 21.25, cy = 41;
    pillsC.addChild(new Graphics().circle(cx, cy, 21.25).fill(0x2d3d4d));
    const ic = new Graphics();
    ic.arc(cx - 1, cy, 8, Math.PI * 0.75, Math.PI * 2.1).stroke({ width: 2.4, color: 0xffffff, cap: 'round' });
    ic.poly([cx - 12, cy - 1, cx - 6, cy - 1, cx - 9, cy + 4]).fill(0xffffff);
    ic.roundRect(cx + 3, cy, 8, 10, 2).fill(0xffffff);
    ic.roundRect(cx + 4.5, cy + 2, 5, 6, 1).fill(0x2d3d4d);
    pillsC.addChild(ic);
    // hit zone for the history button
    const hit = new Graphics().circle(cx, cy, 24).fill({ color: 0xffffff, alpha: 0.001 });
    hit.eventMode = 'static'; hit.cursor = 'pointer';
    hit.on('pointertap', () => { renderHistory(); modal('m-history').show(); });
    pillsC.addChild(hit);
  }

  const multC = new Container();
  root.addChild(multC);
  const mk = (fill, dy) => {
    const t = new Text({ text: '1.00×', style: { fontFamily: 'Fredoka', fontWeight: '700', fontSize: 96, letterSpacing: 5, fill, stroke: { color: fill, width: 5, join: 'round' }, padding: 12 } });
    t.anchor.set(0.5); t.y = dy; return t;
  };
  const sLo = mk(0x2f6be0, 11), sHi = mk(0x59a3ff, 5.5), main = mk(0xffffff, 0);
  multC.addChild(sLo, sHi, main);
  const setMultText = (s, colors, alpha = 1) => {
    [sLo, sHi, main].forEach((t) => (t.text = s));
    sLo.style.fill = colors.lo; sLo.style.stroke = { color: colors.lo, width: 5, join: 'round' };
    sHi.style.fill = colors.hi; sHi.style.stroke = { color: colors.hi, width: 5, join: 'round' };
    multC.alpha = alpha;
    const k = k$();
    const w = Math.max(main.width, 1);
    multC.scale.set(Math.min((216 * k) / w, (pixi.screen.width - 30) / w, 1.6 * k));
  };

  const badge = new Container();
  const badgeBg = new Graphics();
  const badgeTxt = new Text({ text: '', style: { fontFamily: 'Figtree', fontWeight: '600', fontSize: 22, fill: 0xffffff } });
  const badgeNum = new Text({ text: '', style: { fontFamily: 'Figtree', fontWeight: '600', fontSize: 22, fill: 0x6bdc4b } });
  badge.addChild(badgeBg, badgeTxt, badgeNum);
  root.addChild(badge);
  let lastBadge = '';
  function setBadge(kind, sec) {
    const key = kind === 'wait' ? 'w' + sec.toFixed(2) : kind;
    if (key === lastBadge) return;
    lastBadge = key;
    badgeBg.clear(); badgeNum.text = '';
    badge.visible = kind !== 'none';
    if (kind === 'crash') {
      badgeTxt.text = 'Crashé'; badgeTxt.anchor.set(0.5); badgeTxt.x = 0;
      badgeBg.roundRect(-55, -23.5, 110, 47, 23.5).fill(0xb92a40);
    } else if (kind === 'wait') {
      badgeTxt.anchor.set(0, 0.5); badgeNum.anchor.set(0, 0.5);
      badgeTxt.text = 'Début dans '; badgeNum.text = sec.toFixed(2).replace('.', ',') + 's';
      const w = badgeTxt.width + badgeNum.width;
      badgeTxt.x = -w / 2; badgeNum.x = badgeTxt.x + badgeTxt.width;
      badgeBg.roundRect(-96, -23.5, 192, 47, 23.5).fill(0x2b3d4f);
    }
  }

  const usersIco = new Graphics();
  const drawUser = (x, y, r, w, col) => { usersIco.circle(x, y, r).fill(col); usersIco.roundRect(x - w / 2, y + r + 1.5, w, 8, 4).fill(col); };
  drawUser(4.5, 8.5, 3.4, 8, 0x7f95aa); drawUser(23.5, 8.5, 3.4, 8, 0x7f95aa); drawUser(14, 5.5, 4.8, 14, 0x9fb3c6);
  usersIco.scale.set(0.8);
  const usersTxt = new Text({ text: '', style: { fontFamily: 'Figtree', fontWeight: '600', fontSize: 20, fill: 0xffffff } });
  const net = new Text({ text: 'État du réseau', style: { fontFamily: 'Figtree', fontWeight: '500', fontSize: 19, fill: 0x8fa3b8 } });
  net.anchor.set(1, 0.5);
  const dot = new Graphics().circle(0, 0, 6).fill(0x6bdc4b);
  const rocketG = new Graphics();
  root.addChild(usersIco, usersTxt, net, dot, rocketG);

  const k$ = () => Math.min(Math.max(Math.min(pixi.screen.width / 434, pixi.screen.height / 378), 0.85), 1.7);

  function layout() {
    const w = pixi.screen.width, h = pixi.screen.height, k = k$();
    pillsC.scale.set(Math.min(k, 1.25));
    multC.position.set(w / 2, h * 0.45);
    badge.position.set(w / 2, h * 0.45 + 72 * k); badge.scale.set(k);
    usersIco.position.set(31, h - 38); usersTxt.position.set(57, h - 41);
    net.position.set(w - 43, h - 29); dot.position.set(w - 22, h - 29);
  }

  const pt = (m, w, h) => {
    const ox = 30, oy = h - 54;
    const sx = (w - 64) / 370, sy = Math.max(0.6, (h - 130) / 250);
    let dx = 610 * Math.log(m);
    if (dx > 200) dx = 200 + 170 * (1 - Math.exp(-(dx - 200) / 170));
    let dy = 0.5 * dx + 0.00025 * dx * dx + (dx > 200 ? 0.3 * (dx - 200) : 0);
    dy = Math.min(dy, 250);
    return [ox + dx * sx, oy - dy * sy];
  };

  function drawCurve() {
    const w = pixi.screen.width, h = pixi.screen.height, oy = h - 54;
    curveG.clear(); rocketG.clear();
    const m = state.phase === 'wait' ? 1 : state.mult;
    const crashed = state.phase === 'crash';
    const n = 48, p = [];
    for (let i = 0; i <= n; i++) p.push(pt(Math.exp(Math.log(Math.max(m, 1.0001)) * (i / n)), w, h));
    const [ex, ey] = p[p.length - 1];
    if (m > 1.001) {
      const fill = new FillGradient({ type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, colorStops: [
        { offset: 0, color: crashed ? '#40566a' : '#33526e' }, { offset: 1, color: crashed ? '#1a2a38' : '#17283a' }] });
      curveG.moveTo(p[0][0], oy);
      p.forEach(([x, y]) => curveG.lineTo(x, y));
      curveG.lineTo(ex, oy).closePath().fill(fill);
      curveG.moveTo(p[0][0], p[0][1]);
      p.forEach(([x, y]) => curveG.lineTo(x, y));
      curveG.stroke({ width: 8, color: crashed ? 0x8fa6b8 : 0x59b5f0, cap: 'round', join: 'round' });
    } else curveG.moveTo(30, oy).lineTo(30.01, oy).stroke({ width: 8, color: 0x8fdff0, cap: 'round' });
    const k = k$();
    if (crashed) {
      const sx = ex + 66 * k, sy = ey - 40 * k, star = [];
      for (let i = 0; i < 8; i++) { const r = (i % 2 ? 4 : 10) * k; const a = (Math.PI / 4) * i - Math.PI / 2; star.push(sx + Math.cos(a) * r, sy + Math.sin(a) * r); }
      rocketG.poly(star).fill(0xeaf2f8);
    } else {
      const bob = settings.anim && state.phase === 'run' ? Math.sin(performance.now() / 120) * 1.5 : 0;
      if (settings.anim && state.phase === 'run') rocketG.circle(ex, ey + bob, 17 * k).fill({ color: 0x59b5f0, alpha: 0.25 });
      rocketG.circle(ex, ey + bob, 12 * k).fill(0xffffff);
    }
  }

  const comma = (s) => s.replace('.', ',');
  function render() {
    const s = state;
    layout();
    if (s.phase === 'wait') { setMultText('1,00×', C.wait, 0.55); setBadge('wait', Math.max(0, s.waitLeft)); usersTxt.text = String(s.players); }
    else if (s.phase === 'run') { setMultText(comma(s.mult.toFixed(2)) + '×', C.run); setBadge('none'); usersTxt.text = `${s.players} / ${s.totalPlayers}`; }
    else { setMultText(comma(s.mult.toFixed(2)) + '×', C.crash); setBadge('crash'); usersTxt.text = `${s.players} / ${s.totalPlayers}`; }
    drawCurve();
  }
  return { render, drawPills };
}

/* ---------- bots / bettors ---------- */
const NAMES = ['Lucas', 'Emma', 'Nolan', 'Léa', 'Hugo', 'Jade', 'Louis', 'Chloé', 'Adam', 'Inès', 'Gabin', 'Manon', 'Théo', 'Camille', 'Raphaël', 'Zoé', 'Noé', 'Anaïs', 'Maël', 'Sacha'];
function newBots() {
  const n = 12 + Math.floor(rnd() * 16);
  state.bots = Array.from({ length: n }, () => ({
    name: NAMES[Math.floor(rnd() * NAMES.length)] + Math.floor(rnd() * 99),
    amount: Math.round((0.5 + rnd() ** 3 * 4000) * 100) / 100,
    at: Math.max(1.05, 1 + rnd() ** 1.8 * 6), out: false,
  }));
  state.totalPlayers = n + (state.bet ? 1 : 0);
  state.players = state.totalPlayers;
}
function renderBettors() {
  const total = state.bots.reduce((s, b) => s + b.amount, 0) + (state.bet ? state.bet.amount : 0);
  $('b-count').textContent = state.phase === 'wait' ? state.totalPlayers : state.players;
  $('b-total').textContent = fmt2(6200000 + total * 30);
  $('b-list').innerHTML = [...state.bots].sort((a, b) => b.amount - a.amount).slice(0, 6)
    .map((b) => `<li class="${b.out ? 'w' : ''}"><span>${esc(b.name)}</span><span>${b.out ? b.at.toFixed(2).replace('.', ',') + '× · ' : ''}${fmt2(b.amount)}</span></li>`).join('');
}

/* ---------- controls ---------- */
const amountEl = $('amount'), cashEl = $('cashout'), gainEl = $('gain'), playBtn = $('play');
const getAmount = () => Math.max(0, Math.round(parseNum(amountEl.value) * 100) / 100);
const getCash = () => Math.max(1.01, parseNum(cashEl.value) || 2);
function updateGain() { amountEl.classList.toggle('zero', getAmount() === 0); gainEl.value = fmt2(getAmount() * (getCash() - 1)); }
amountEl.addEventListener('input', updateGain);
amountEl.addEventListener('blur', () => { amountEl.value = fmt2(getAmount()); updateGain(); });
cashEl.addEventListener('input', updateGain);
cashEl.addEventListener('blur', () => { cashEl.value = getCash().toFixed(2).replace('.', ','); updateGain(); });
[amountEl, cashEl].forEach((el) => el.addEventListener('keydown', (e) => { if (e.key === 'Enter') el.blur(); e.stopPropagation(); }));
const setAmount = (v) => { amountEl.value = fmt2(Math.min(Math.max(v, 0), 1e9)); updateGain(); };
$('half').onclick = () => setAmount(getAmount() / 2);
$('double').onclick = () => setAmount(getAmount() * 2);
const stepCash = (d) => { cashEl.value = Math.max(1.01, Math.round((getCash() + d) * 100) / 100).toFixed(2).replace('.', ','); updateGain(); };
$('c-up').onclick = () => stepCash(0.1);
$('c-down').onclick = () => stepCash(-0.1);

$$('#mode button').forEach((b) => (b.onclick = () => {
  if (state.bet && state.phase === 'run') return toast('Attendez la fin de la manche.');
  state.mode = b.dataset.mode;
  $$('#mode button').forEach((x) => x.classList.toggle('on', x === b));
  $('auto-count-wrap').classList.toggle('d-none', state.mode !== 'auto');
  if (state.mode === 'manual') { state.autoRunning = false; }
  updatePlay();
}));

function renderStats() {
  const s = state.stats;
  const p = (v) => `<b class="${v > 0 ? 'pos' : v < 0 ? 'neg' : ''}">${fmt2(v)} G</b>`;
  const html = `
    <div class="stat-row"><span>Solde</span><b>${fmt2(state.balance)} G</b></div>
    <div class="stat-row"><span>Profit</span>${p(s.profit)}</div>
    <div class="stat-row"><span>Total misé</span><b>${fmt2(s.wagered)} G</b></div>
    <div class="stat-row"><span>Victoires</span><b>${s.wins}</b></div>
    <div class="stat-row"><span>Défaites</span><b>${s.losses}</b></div>`;
  $('tab-stats').innerHTML = html; $('stats-modal-body').innerHTML = html;
}
$('stats-reset').onclick = () => { state.stats = { wins: 0, losses: 0, wagered: 0, profit: 0 }; renderStats(); persistBalance(); toast('Statistiques réinitialisées.'); };

function renderHistory() {
  $('hist-body').innerHTML = state.rounds.length
    ? [...state.rounds].reverse().map((r) => `<tr><td class="${r.crash >= 2 ? 'text-success' : ''}">${r.crash.toFixed(2).replace('.', ',')}×</td><td>${r.amount ? fmt2(r.amount) + ' G' : '-'}</td><td class="text-end ${r.profit > 0 ? 'text-success' : r.profit < 0 ? 'text-danger' : ''}">${r.amount ? fmt2(r.profit) : '-'}</td></tr>`).join('')
    : '<tr><td colspan="3" class="text-center py-4">Aucune manche jouée pour le moment.</td></tr>';
}
$('m-history').addEventListener('show.bs.modal', renderHistory);
$('m-stats').addEventListener('show.bs.modal', renderStats);

/* settings */
[['s-sound', 'sound'], ['s-anim', 'anim'], ['s-toast', 'toast'], ['s-max', 'minCash']].forEach(([id, key]) => {
  $(id).checked = settings[key];
  $(id).onchange = () => { settings[key] = $(id).checked; LS.set('zr_settings', settings); if (key === 'sound' && settings.sound) beep(660); };
});

/* fairness */
async function refreshFairUI() {
  $('fair-hash').value = state.fair.hash;
  $('fair-client').value = state.fair.client;
  $('fair-nonce').value = state.fair.nonce;
  const lr = state.lastRound;
  $('last-round').innerHTML = lr
    ? `<b class="text-white">Dernière manche</b> : crash ${lr.crash.toFixed(2).replace('.', ',')}× · nonce ${lr.nonce}<br><span class="font-monospace text-break">graine serveur : ${lr.server}</span><br><span class="font-monospace">graine client : ${esc(lr.client)}</span>`
    : '';
}
$('m-fair').addEventListener('show.bs.modal', refreshFairUI);
$('fair-client').addEventListener('change', () => {
  const v = $('fair-client').value.trim().slice(0, 32) || randHex(8);
  state.fair.client = v; LS.set('zr_client', v); $('fair-client').value = v;
  toast('Graine client enregistrée (prochaine manche).');
});
$('v-go').onclick = async () => {
  const s = $('v-server').value.trim(), c = $('v-client').value.trim(), n = $('v-nonce').value.trim();
  if (!s || !c || !/^\d+$/.test(n)) return ($('v-out').textContent = 'Renseignez la graine serveur, la graine client et le nonce.');
  const h = await sha256(s), cr = await crashFromSeeds(s, c, n);
  $('v-out').innerHTML = `Hash : ${h}<br>Crash : <b class="text-white">${cr.toFixed(2).replace('.', ',')}×</b>`;
};

/* Description card actions */
const saved = LS.get('zr_saved', false), followed = LS.get('zr_follow', false);
const applyPub = () => {
  $('save-game').classList.toggle('on', LS.get('zr_saved', false)); $('save-game').setAttribute('aria-pressed', LS.get('zr_saved', false));
  $('save-game').textContent = LS.get('zr_saved', false) ? 'Sauvegardé ✓' : 'Sauvegarder';
  const f = LS.get('zr_follow', false);
  $('heart').classList.toggle('on', f); $('heart').setAttribute('aria-pressed', f);
  $('followers').textContent = f ? '79,38K' : '79,37K';
};
void saved; void followed;
$('save-game').onclick = () => { const v = !LS.get('zr_saved', false); LS.set('zr_saved', v); applyPub(); toast(v ? 'Jeu sauvegardé.' : 'Jeu retiré des sauvegardes.'); };
$('heart').onclick = () => { const v = !LS.get('zr_follow', false); LS.set('zr_follow', v); applyPub(); toast(v ? 'Vous suivez Zunrel Originals.' : 'Vous ne suivez plus Zunrel Originals.'); };
applyPub();

/* navigation */
function goto(where) {
  if (where === 'chat') {
    $('info-body').classList.contains('show') || bootstrap.Collapse.getOrCreateInstance($('info-body')).show();
    bootstrap.Tab.getOrCreateInstance($('t-chat')).show();
    $('info').scrollIntoView({ behavior: 'smooth' });
  } else window.scrollTo({ top: 0, behavior: 'smooth' });
  $$('.bnav button').forEach((b) => b.classList.toggle('on', b.dataset.goto === where));
}
$$('[data-goto]').forEach((b) => b.addEventListener('click', () => goto(b.dataset.goto)));
function renderForYou() {
  const s = state.stats, who = state.user || 'Invité';
  const last = [...state.rounds].reverse().slice(0, 5);
  $('foryou-body').innerHTML = `
    <div class="mb-3"><div class="text-white fs-5 fw-bold">${esc(who)}</div><div>Solde : <b class="text-white">${fmt2(state.balance)} G</b></div></div>
    <div class="stat-row"><span>Profit</span><b class="${s.profit > 0 ? 'pos' : s.profit < 0 ? 'neg' : ''}">${fmt2(s.profit)} G</b></div>
    <div class="stat-row"><span>Victoires / Défaites</span><b>${s.wins} / ${s.losses}</b></div>
    <div class="stat-row"><span>Jeu sauvegardé</span><b>${LS.get('zr_saved', false) ? 'Crash ✓' : 'Aucun'}</b></div>
    <h3 class="fs-6 text-white mt-4">Manches récentes</h3>
    ${last.length ? last.map((r) => `<div class="stat-row"><span>${r.crash.toFixed(2).replace('.', ',')}×</span><b class="${r.profit > 0 ? 'pos' : r.profit < 0 ? 'neg' : ''}">${r.amount ? fmt2(r.profit) + ' G' : '-'}</b></div>`).join('') : '<p class="small">Aucune manche pour le moment.</p>'}
    ${state.user ? '' : '<button class="btn btn-blue w-100 mt-4" data-bs-toggle="modal" data-bs-target="#m-register" data-bs-dismiss="offcanvas">Créer un compte gratuit</button>'}`;
}
$$('[data-open]').forEach((b) => b.addEventListener('click', () => {
  const id = 'oc-' + b.dataset.open;
  if (b.dataset.open === 'foryou') renderForYou();
  bootstrap.Offcanvas.getOrCreateInstance($(id)).show();
}));
$$('[data-soon]').forEach((b) => b.addEventListener('click', () => toast(`${b.dataset.soon} arrive bientôt !`)));
$('to-top').onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
window.addEventListener('scroll', () => $('to-top').classList.toggle('show', window.scrollY > 500), { passive: true });

/* chat */
const chatLog = $('chat-log');
const CHAT = ['Allez, x2 !', 'Trop tôt pour retirer 😅', 'Crash à 1,00... pas de chance', 'Belle série !', 'Je retire toujours à 1,5', 'Qui a fait x10 ?', 'On tente le x5 ?', 'GG !', 'Aïe.', 'Ça monte, ça monte...'];
function addChat(name, text, me = false) {
  const p = document.createElement('p');
  p.innerHTML = `<b class="${me ? 'me' : ''}">${esc(name)}</b> ${esc(text)}`;
  chatLog.appendChild(p);
  while (chatLog.children.length > 60) chatLog.firstChild.remove();
  chatLog.scrollTop = chatLog.scrollHeight;
}
addChat('Zunrel', 'Bienvenue dans le chat ! Restez courtois.');
setInterval(() => addChat(NAMES[Math.floor(rnd() * NAMES.length)] + Math.floor(rnd() * 99), CHAT[Math.floor(rnd() * CHAT.length)]), 6000);
$('chat-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = $('chat-input').value.trim();
  if (!v) return;
  addChat(state.user || 'Invité', v, true); $('chat-input').value = '';
});

/* play button */
function updatePlay() {
  const s = state;
  playBtn.className = 'play';
  if (s.phase === 'run' && s.bet && s.bet.cashedAt == null) {
    playBtn.classList.add('cash');
    playBtn.textContent = `Retirer  ${fmt2(s.bet.amount * s.mult)}`;
  } else if (s.mode === 'auto') {
    playBtn.textContent = s.autoRunning ? 'Arrêter l\'auto' : 'Lancer l\'auto';
    if (s.autoRunning) playBtn.classList.add('cancel');
  } else if (s.queued) { playBtn.classList.add('cancel'); playBtn.textContent = 'Annuler'; }
  else playBtn.textContent = s.phase === 'wait' ? 'Jouer' : 'Jouer au prochain tour';
}

function placeQueuedBet() {
  const amt = getAmount();
  if (amt <= 0) { toast('Entrez un montant supérieur à 0.', 'loss', true); state.queued = false; state.autoRunning = false; return false; }
  if (amt > state.balance + 1e-9) { toast('Solde insuffisant. Rechargez via votre solde.', 'loss', true); state.queued = false; state.autoRunning = false; return false; }
  state.balance -= amt; state.stats.wagered += amt;
  state.bet = { amount: amt, cashout: settings.minCash ? Math.max(1.01, getCash()) : getCash(), cashedAt: null };
  state.queued = false;
  state.totalPlayers = state.bots.length + 1; state.players = state.totalPlayers;
  renderBalance();
  return true;
}
function cashOut(m) {
  const b = state.bet;
  if (!b || b.cashedAt != null) return;
  b.cashedAt = m;
  const win = b.amount * m;
  state.balance += win; state.stats.profit += win - b.amount; state.stats.wins++;
  renderBalance(); renderStats();
  toast(`Retrait à ${m.toFixed(2).replace('.', ',')}× · +${fmt2(win - b.amount)} G`, 'win');
  beep(880, 0.15); setTimeout(() => beep(1175, 0.2), 120);
  updatePlay();
}
function onPlay() {
  const s = state;
  if (s.phase === 'run' && s.bet && s.bet.cashedAt == null) return cashOut(s.mult);
  if (s.mode === 'auto') {
    s.autoRunning = !s.autoRunning;
    s.autoLeft = Math.max(0, parseInt($('bets').value, 10) || 0);
    s.queued = s.autoRunning;
  } else s.queued = !s.queued;
  if (s.phase === 'wait' && s.queued && !s.bet) placeQueuedBet();
  else if (s.phase === 'wait' && !s.queued && s.bet && s.bet.cashedAt == null) {
    s.balance += s.bet.amount; s.stats.wagered -= s.bet.amount; s.bet = null; renderBalance();
  }
  updatePlay(); renderBettors();
}
playBtn.onclick = onPlay;
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !/INPUT|TEXTAREA|BUTTON|SELECT/.test(document.activeElement.tagName) && !document.querySelector('.modal.show')) { e.preventDefault(); onPlay(); }
});

/* ---------- round loop ---------- */
async function prepareRound() {
  const f = state.fair;
  f.ready = false; f.nonce++; f.server = randHex(16); f.hash = await sha256(f.server);
  state.crashAt = await crashFromSeeds(f.server, f.client, f.nonce);
  f.ready = true;
  if ($('m-fair').classList.contains('show')) refreshFairUI();
}
function startWait() {
  state.phase = 'wait'; state.waitLeft = 5; state.bet = null;
  newBots(); prepareRound();
  if (state.queued) placeQueuedBet();
  updatePlay(); renderBettors(); renderStats();
}
function startRun() {
  state.phase = 'run'; state.t = 0; state.mult = 1;
  state.players = state.totalPlayers; updatePlay(); beep(440, 0.08);
}
function doCrash() {
  state.phase = 'crash'; state.mult = state.crashAt; state.crashLeft = 3.2;
  state.history.push(state.crashAt); state.history = state.history.slice(-8); LS.set('zr_hist', state.history);
  stage.drawPills();
  const f = state.fair;
  state.lastRound = { server: f.server, client: f.client, nonce: f.nonce, crash: state.crashAt };
  const b = state.bet;
  const rec = { crash: state.crashAt, amount: b ? b.amount : 0, profit: b ? (b.cashedAt != null ? b.amount * (b.cashedAt - 1) : -b.amount) : 0 };
  state.rounds.push(rec); state.rounds = state.rounds.slice(-30); LS.set('zr_rounds', state.rounds);
  if (b && b.cashedAt == null) {
    state.stats.losses++; state.stats.profit -= b.amount;
    toast(`Crash à ${state.crashAt.toFixed(2).replace('.', ',')}× · −${fmt2(b.amount)} G`, 'loss');
    beep(140, 0.35, 'sawtooth', 0.08);
  } else beep(220, 0.2, 'square', 0.04);
  if (state.mode === 'auto' && state.autoRunning) {
    if (state.autoLeft === 1) { state.autoRunning = false; state.autoLeft = 0; toast('Auto terminé.'); }
    else { if (state.autoLeft > 1) state.autoLeft--; state.queued = true; }
  }
  renderBalance(); renderStats(); updatePlay(); renderBettors();
}
function tick(dt) {
  const s = state;
  if (s.phase === 'wait') {
    s.waitLeft = Math.max(0, s.waitLeft - dt);
    if (s.waitLeft <= 0 && s.fair.ready) startRun();
  } else if (s.phase === 'run') {
    s.t += dt; s.mult = Math.max(1, multAt(s.t));
    if (s.mult >= s.crashAt) return doCrash();
    let out = 0;
    s.bots.forEach((b) => { if (!b.out && s.mult >= b.at) b.out = true; if (!b.out) out++; });
    s.players = out + (s.bet && s.bet.cashedAt == null ? 1 : 0);
    if (s.bet && s.bet.cashedAt == null) {
      if (s.mult >= s.bet.cashout) cashOut(s.bet.cashout);
      else playBtn.textContent = `Retirer  ${fmt2(s.bet.amount * s.mult)}`;
    }
  } else {
    s.crashLeft -= dt;
    if (s.crashLeft <= 0) startWait();
  }
}

/* ---------- boot ---------- */
const sess = LS.get('zr_session', null);
setUser(sess && users()[sess] ? sess : null);
updateGain(); renderStats();
$('fair-client').value = state.fair.client;
initStage().then((st) => {
  stage = st; stage.drawPills();
  startWait(); state.waitLeft = 4;
  let last = performance.now(), acc = 0;
  pixi.ticker.add(() => {
    const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000);
    last = now; tick(dt); stage.render();
    acc += dt;
    if (acc > 0.4) { acc = 0; renderBettors(); }
  });
});
