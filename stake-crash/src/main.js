import './style.css';
import { createChart, multAt, msFor } from './chart.js';
import { crashPoint } from './rng.js';
import { t } from './i18n.js';
import { createForYouGames } from './foryou-games.js';

const WAIT_MS = 5000;
const CRASH_HOLD_MS = 2800;
const AUTO_TARGET = 2;
const STORAGE_KEY = 'zunrel-crash-demo-v3';

const $ = (id) => document.getElementById(id);

const els = {
  stage: $('stage'),
  countdownPill: $('countdown-pill'),
  countdownVal: $('countdown-val'),
  crashedPill: $('crashed-pill'),
  playBtn: $('play-btn'),
  amountInput: $('amount-input'),
  netGain: $('net-gain'),
  resultLabel: $('result-label'),
  balance: $('balance'),
  balanceBtn: $('balance-btn'),
  halfBtn: $('half-btn'),
  doubleBtn: $('double-btn'),
  toast: $('toast'),
  pnlNotice: $('pnl-notice'),
  pnlAmount: $('pnl-amount'),
  pnlIcon: $('pnl-icon'),
  pnlLabel: $('pnl-label'),
  menuBtn: $('menu-btn'),
  drawerRoot: $('drawer-root'),
  drawerBackdrop: $('drawer-backdrop'),
  drawerClose: $('drawer-close'),
  signinBtn: $('signin-btn'),
  registerBtn: $('register-btn'),
  fairnessBtn: $('fairness-btn'),
  settingsBtn: $('settings-btn'),
  statsBtn: $('stats-btn'),
  heartBtn: $('heart-btn'),
  saveBtn: $('save-btn'),
  statsList: $('stats-list'),
  modalRoot: $('modal-root'),
  modalBackdrop: $('modal-backdrop'),
  modalClose: $('modal-close'),
  modalTitle: $('modal-title'),
  modalBody: $('modal-body'),
  foryouStrip: $('foryou-strip'),
  gameOverlay: $('game-overlay'),
  gameStage: $('game-stage'),
  gameControls: $('game-controls'),
  gameTitle: $('game-title'),
  gameBack: $('game-back'),
  gameBalance: $('game-balance'),
  gameBalanceBtn: $('game-balance-btn'),
};

let lang = 'fr';
let balance = 10000;
let history = [];
let mode = 'manual';
let chart = null;
let favored = false;
let user = null;
let settings = { sound: true, animations: true, notifications: true };
let lastResult = null; // { kind: 'gain'|'loss', amount }

/** @type {'waiting'|'flying'|'crashed'} */
let phase = 'waiting';
let waitStart = 0;
let flyStart = 0;
let crashAt = 1;
let crashHoldStart = 0;
let bet = null;

const forYou = createForYouGames({
  getBalance: () => balance,
  setBalance: (v) => {
    balance = Math.round(v * 100) / 100;
    updateBalanceUI();
    save();
  },
  getLang: () => lang,
  onToast: (msg, kind) => showToast(msg, kind),
});

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('zunrel-crash-demo-v2');
    if (!raw) return;
    const data = JSON.parse(raw);
    if (typeof data.balance === 'number' && data.balance >= 0) balance = data.balance;
    if (Array.isArray(data.history)) history = data.history.slice(0, 40);
    if (data.lang === 'fr' || data.lang === 'pt') lang = data.lang;
    if (data.settings) settings = { ...settings, ...data.settings };
    if (typeof data.favored === 'boolean') favored = data.favored;
    if (data.user?.name) user = data.user;
  } catch {
    /* ignore */
  }
}

function save() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ balance, history, lang, settings, favored, user }),
  );
}

function fmtMoney(n) {
  return n.toLocaleString(lang === 'pt' ? 'pt-PT' : 'fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseNum(str) {
  if (typeof str !== 'string') return NaN;
  return parseFloat(str.replace(',', '.').replace(/[^\d.]/g, ''));
}

function formatInput(n, decimals = 2) {
  if (!Number.isFinite(n)) return '0.00';
  return n.toFixed(decimals).replace('.', ',');
}

function showToast(msg, kind = '') {
  els.toast.hidden = false;
  els.toast.textContent = msg;
  els.toast.className = `toast${kind ? ` ${kind}` : ''}`;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    els.toast.hidden = true;
  }, 2400);
}

function showPnl(amount, kind) {
  if (!els.pnlNotice) return;
  const abs = Math.abs(amount);
  const sign = kind === 'win' ? '+' : '−';
  els.pnlLabel.textContent = t(lang, kind === 'win' ? 'gain' : 'loss');
  els.pnlAmount.textContent = `${sign}${fmtMoney(abs)}`;
  els.pnlIcon.textContent = kind === 'win' ? '↑' : '↓';
  els.pnlNotice.hidden = false;
  els.pnlNotice.classList.remove('show', 'win', 'lose');
  void els.pnlNotice.offsetWidth;
  els.pnlNotice.classList.add('show', kind);
  clearTimeout(showPnl._t);
  showPnl._t = setTimeout(() => {
    els.pnlNotice.classList.remove('show', 'win', 'lose');
    els.pnlNotice.hidden = true;
  }, 2700);
}

function applyI18n() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(lang, el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    el.setAttribute('aria-label', t(lang, el.dataset.i18nAria));
  });
  document.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.classList.toggle('on', btn.dataset.lang === lang);
  });
  els.heartBtn.classList.toggle('on', favored);
  els.heartBtn.setAttribute('aria-pressed', favored ? 'true' : 'false');
  updateResultField();
  updateBalanceUI();
  setPlayButton();
  renderStatsPanel();
}

function setLang(next) {
  if (next !== 'fr' && next !== 'pt') return;
  lang = next;
  save();
  applyI18n();
}

function updateBalanceUI() {
  els.balance.textContent = fmtMoney(balance);
  if (els.gameBalance) els.gameBalance.textContent = fmtMoney(balance);
}

function updateResultField() {
  if (lastResult) {
    els.resultLabel.textContent = t(lang, lastResult.kind === 'gain' ? 'gain' : 'loss');
    els.netGain.value = formatInput(lastResult.amount);
    els.resultLabel.classList.toggle('is-loss', lastResult.kind === 'loss');
    els.resultLabel.classList.toggle('is-gain', lastResult.kind === 'gain');
    return;
  }
  els.resultLabel.textContent = t(lang, 'gain');
  els.resultLabel.classList.remove('is-loss', 'is-gain');
  // Projected gain if flying with an active bet (manual cashout estimate at current mult)
  if (phase === 'flying' && bet && !bet.queued && bet.cashed == null) {
    const m = multAt(performance.now() - flyStart);
    const net = Math.max(0, bet.amount * m - bet.amount);
    els.netGain.value = formatInput(net);
    return;
  }
  els.netGain.value = formatInput(0);
}

function setPlayButton() {
  const btn = els.playBtn;
  btn.classList.remove('cashout', 'queued', 'waiting');
  btn.disabled = false;

  if (phase === 'flying' && bet && !bet.queued && !bet.cashed) {
    const m = multAt(performance.now() - flyStart);
    btn.textContent = `${t(lang, 'cashOut')} ${fmtMoney(bet.amount * m)}`;
    btn.classList.add('cashout');
    return;
  }

  if (bet?.queued) {
    btn.textContent = t(lang, 'cancelBet');
    btn.classList.add('queued');
    return;
  }

  if (phase === 'waiting') {
    btn.textContent = t(lang, 'play');
    return;
  }

  btn.textContent = t(lang, 'playNext');
  if (phase === 'crashed') btn.classList.add('waiting');
}

function placeOrQueueBet() {
  const amount = Math.round((parseNum(els.amountInput.value) || 0) * 100) / 100;
  const target = mode === 'auto' ? AUTO_TARGET : Infinity;

  if (!(amount >= 0.01)) {
    showToast(t(lang, 'invalidAmount'), 'lose');
    return;
  }
  if (amount > balance) {
    showToast(t(lang, 'insufficient'), 'lose');
    return;
  }

  balance = Math.round((balance - amount) * 100) / 100;
  updateBalanceUI();
  save();

  lastResult = null;
  bet = { amount, target, queued: phase !== 'waiting', cashed: null };

  if (phase === 'waiting') {
    showToast(t(lang, 'betPlaced', { n: fmtMoney(amount) }));
  } else {
    showToast(t(lang, 'betQueued'));
  }
  updateResultField();
  setPlayButton();
}

function cancelQueued() {
  if (!bet?.queued) return;
  balance = Math.round((balance + bet.amount) * 100) / 100;
  bet = null;
  updateBalanceUI();
  save();
  showToast(t(lang, 'betCancelled'));
  setPlayButton();
}

function cashOut(atMult) {
  if (!bet || bet.queued || bet.cashed != null) return;
  if (atMult >= crashAt) return;

  const m = Math.floor(atMult * 100) / 100;
  bet.cashed = m;
  const payout = Math.round(bet.amount * m * 100) / 100;
  const net = Math.round((payout - bet.amount) * 100) / 100;
  balance = Math.round((balance + payout) * 100) / 100;
  lastResult = { kind: 'gain', amount: Math.max(0, net) };
  updateBalanceUI();
  updateResultField();
  save();
  showPnl(payout, 'win');
  setPlayButton();
}

function settleLoss() {
  if (!bet || bet.queued || bet.cashed != null) return;
  lastResult = { kind: 'loss', amount: bet.amount };
  updateResultField();
  showPnl(bet.amount, 'lose');
  bet.cashed = 0;
  save();
}

function startWaiting() {
  phase = 'waiting';
  waitStart = performance.now();
  els.countdownPill.hidden = false;
  els.crashedPill.hidden = true;
  if (bet?.queued) bet.queued = false;
  chart?.draw({ ms: 0, phase: 'waiting' });
  setPlayButton();
  updateResultField();
}

function startFlying() {
  phase = 'flying';
  flyStart = performance.now();
  crashAt = crashPoint();
  els.countdownPill.hidden = true;
  els.crashedPill.hidden = true;
  setPlayButton();
}

function startCrashed() {
  phase = 'crashed';
  crashHoldStart = performance.now();
  els.countdownPill.hidden = true;
  els.crashedPill.hidden = false;

  history.unshift(crashAt);
  history = history.slice(0, 40);
  save();
  renderStatsPanel();

  if (bet && !bet.queued && bet.cashed == null) settleLoss();
  if (bet && !bet.queued) bet = null;

  chart?.draw({
    ms: msFor(crashAt),
    crashed: true,
    crashMult: crashAt,
    phase: 'crashed',
  });
  setPlayButton();
  updateResultField();
}

function tick() {
  const now = performance.now();

  if (phase === 'waiting') {
    const left = Math.max(0, WAIT_MS - (now - waitStart));
    els.countdownVal.textContent = (left / 1000).toFixed(2);
    chart?.draw({ ms: 0, phase: 'waiting' });
    if (left <= 0) startFlying();
    return;
  }

  if (phase === 'flying') {
    const ms = now - flyStart;
    const m = multAt(ms);

    if (bet && !bet.queued && bet.cashed == null && Number.isFinite(bet.target) && m >= bet.target && bet.target < crashAt) {
      cashOut(bet.target);
    }

    if (m >= crashAt) {
      startCrashed();
      return;
    }

    chart?.draw({ ms, phase: 'flying' });
    setPlayButton();
    updateResultField();
    return;
  }

  if (phase === 'crashed') {
    if (now - crashHoldStart >= CRASH_HOLD_MS) startWaiting();
  }
}

/* ---------- Modals ---------- */
function openModal(title, html) {
  els.modalTitle.textContent = title;
  els.modalBody.innerHTML = html;
  els.modalRoot.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  els.modalRoot.hidden = true;
  els.modalBody.innerHTML = '';
  document.body.style.overflow = '';
}

function openAuth(modeAuth) {
  const isIn = modeAuth === 'in';
  openModal(
    t(lang, isIn ? 'authTitleIn' : 'authTitleUp'),
    `
    <p style="margin-bottom:10px">${t(lang, 'authDemo')}</p>
    ${
      isIn
        ? ''
        : `<div class="form-row"><label>${t(lang, 'username')}</label><input id="auth-user" type="text" autocomplete="username" /></div>`
    }
    <div class="form-row"><label>${t(lang, 'email')}</label><input id="auth-email" type="email" autocomplete="email" /></div>
    <div class="form-row"><label>${t(lang, 'password')}</label><input id="auth-pass" type="password" autocomplete="${isIn ? 'current-password' : 'new-password'}" /></div>
    <button type="button" class="btn-block" id="auth-submit">${t(lang, isIn ? 'submitIn' : 'submitUp')}</button>
    `,
  );
  $('auth-submit')?.addEventListener('click', () => {
    const name =
      $('auth-user')?.value?.trim() ||
      $('auth-email')?.value?.split('@')[0] ||
      'Demo';
    user = { name };
    save();
    closeModal();
    closeDrawer();
    showToast(t(lang, 'authOk', { n: name }), 'win');
  });
}

function openSettings() {
  openModal(
    t(lang, 'settingsTitle'),
    `
    <div class="toggle-row"><span>${t(lang, 'sound')}</span><label class="switch"><input type="checkbox" id="set-sound" ${settings.sound ? 'checked' : ''}/><span></span></label></div>
    <div class="toggle-row"><span>${t(lang, 'animations')}</span><label class="switch"><input type="checkbox" id="set-anim" ${settings.animations ? 'checked' : ''}/><span></span></label></div>
    <div class="toggle-row"><span>${t(lang, 'notifications')}</span><label class="switch"><input type="checkbox" id="set-notif" ${settings.notifications ? 'checked' : ''}/><span></span></label></div>
    <button type="button" class="btn-block" id="set-save">${t(lang, 'saveGame')}</button>
    `,
  );
  $('set-save')?.addEventListener('click', () => {
    settings = {
      sound: !!$('set-sound')?.checked,
      animations: !!$('set-anim')?.checked,
      notifications: !!$('set-notif')?.checked,
    };
    save();
    closeModal();
    showToast(t(lang, 'savedSettings'));
  });
}

function statsData() {
  const rounds = history.length;
  const avg = rounds ? history.reduce((a, b) => a + b, 0) / rounds : 0;
  const best = rounds ? Math.max(...history) : 0;
  return { rounds, avg, best };
}

function renderStatsPanel() {
  if (!els.statsList) return;
  const { rounds, avg, best } = statsData();
  els.statsList.innerHTML = `
    <li><span>${t(lang, 'rounds')}</span><strong>${rounds}</strong></li>
    <li><span>${t(lang, 'avgCrash')}</span><strong>${avg ? avg.toFixed(2) + 'x' : '—'}</strong></li>
    <li><span>${t(lang, 'bestCrash')}</span><strong>${best ? best.toFixed(2) + 'x' : '—'}</strong></li>
    <li><span>${t(lang, 'balanceLabel')}</span><strong>${fmtMoney(balance)} C</strong></li>
  `;
}

function openStats() {
  const { rounds, avg, best } = statsData();
  openModal(
    t(lang, 'statsTitle'),
    `
    <ul class="stats-list">
      <li><span>${t(lang, 'rounds')}</span><strong>${rounds}</strong></li>
      <li><span>${t(lang, 'avgCrash')}</span><strong>${avg ? avg.toFixed(2) + 'x' : '—'}</strong></li>
      <li><span>${t(lang, 'bestCrash')}</span><strong>${best ? best.toFixed(2) + 'x' : '—'}</strong></li>
      <li><span>${t(lang, 'balanceLabel')}</span><strong>${fmtMoney(balance)} C</strong></li>
    </ul>
    <button type="button" class="btn-ghost" id="stats-close">${t(lang, 'close')}</button>
    `,
  );
  $('stats-close')?.addEventListener('click', closeModal);
}

function openFairness() {
  openModal(
    t(lang, 'fairnessTitle'),
    `<p>${t(lang, 'fairnessBody')}</p><button type="button" class="btn-ghost" id="fair-close">${t(lang, 'close')}</button>`,
  );
  $('fair-close')?.addEventListener('click', closeModal);
}

function openBalanceMenu() {
  openModal(
    t(lang, 'balanceLabel'),
    `
    <p style="margin-bottom:8px"><strong>${fmtMoney(balance)} C</strong></p>
    <button type="button" class="btn-block" id="refill-btn">${t(lang, 'refill')}</button>
    <button type="button" class="btn-ghost" id="bal-close">${t(lang, 'close')}</button>
    `,
  );
  $('refill-btn')?.addEventListener('click', () => {
    balance = 10000;
    updateBalanceUI();
    save();
    closeModal();
    showToast(t(lang, 'refilled'), 'win');
  });
  $('bal-close')?.addEventListener('click', closeModal);
}

function openNavPanel(nav) {
  if (nav === 'foryou') {
    els.foryouStrip?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  if (nav === 'browse') {
    openDrawer();
    return;
  }
  openModal(
    t(lang, 'casinoTitle'),
    `<p>${t(lang, 'casinoBody')}</p><button type="button" class="btn-ghost" id="nav-close">${t(lang, 'close')}</button>`,
  );
  $('nav-close')?.addEventListener('click', closeModal);
}

/* ---------- Drawer (right → left) ---------- */
function openDrawer() {
  els.drawerRoot.hidden = false;
  requestAnimationFrame(() => els.drawerRoot.classList.add('open'));
  els.menuBtn.classList.add('open');
  els.menuBtn.setAttribute('aria-expanded', 'true');
}

function closeDrawer() {
  els.drawerRoot.classList.remove('open');
  els.menuBtn.classList.remove('open');
  els.menuBtn.setAttribute('aria-expanded', 'false');
  setTimeout(() => {
    if (!els.drawerRoot.classList.contains('open')) els.drawerRoot.hidden = true;
  }, 220);
}

function toggleDrawer() {
  if (els.drawerRoot.hidden || !els.drawerRoot.classList.contains('open')) openDrawer();
  else closeDrawer();
}

/* ---------- For You games ---------- */
const GAME_TITLES = { mines: 'Mines', scarab: 'Scarab Spin', samurai: 'Blue Samurai' };

async function openGame(id) {
  closeDrawer();
  els.gameTitle.textContent = GAME_TITLES[id] || id;
  els.gameOverlay.hidden = false;
  updateBalanceUI();
  await forYou.open(id, els.gameStage, els.gameControls, els.gameBalance);
}

function closeGame() {
  forYou.close();
  els.gameControls.replaceChildren();
  els.gameOverlay.hidden = true;
}

function bindUI() {
  els.menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDrawer();
  });
  els.drawerBackdrop.addEventListener('click', closeDrawer);
  els.drawerClose.addEventListener('click', closeDrawer);

  document.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      setLang(btn.dataset.lang);
    });
  });

  els.playBtn.addEventListener('click', () => {
    if (phase === 'flying' && bet && !bet.queued && bet.cashed == null) {
      cashOut(multAt(performance.now() - flyStart));
      return;
    }
    if (bet?.queued) {
      cancelQueued();
      return;
    }
    placeOrQueueBet();
  });

  els.halfBtn.addEventListener('click', () => {
    const v = (parseNum(els.amountInput.value) || 0) / 2;
    els.amountInput.value = formatInput(Math.max(0.01, Math.floor(v * 100) / 100));
  });

  els.doubleBtn.addEventListener('click', () => {
    const v = (parseNum(els.amountInput.value) || 0) * 2;
    els.amountInput.value = formatInput(Math.min(balance, Math.round(v * 100) / 100));
  });

  els.amountInput.addEventListener('blur', () => {
    els.amountInput.value = formatInput(Math.max(0, parseNum(els.amountInput.value) || 0));
  });

  document.querySelectorAll('.mode').forEach((btn) => {
    btn.addEventListener('click', () => {
      mode = btn.dataset.mode;
      document.querySelectorAll('.mode').forEach((b) => {
        const on = b.dataset.mode === mode;
        b.classList.toggle('on', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      if (mode === 'auto') showToast(t(lang, 'autoMode'));
    });
  });

  els.balanceBtn.addEventListener('click', openBalanceMenu);
  els.gameBalanceBtn?.addEventListener('click', openBalanceMenu);
  els.signinBtn.addEventListener('click', () => openAuth('in'));
  els.registerBtn.addEventListener('click', () => openAuth('up'));
  els.settingsBtn.addEventListener('click', openSettings);
  els.statsBtn.addEventListener('click', openStats);
  els.fairnessBtn.addEventListener('click', openFairness);
  $('drawer-settings')?.addEventListener('click', () => {
    closeDrawer();
    openSettings();
  });
  $('drawer-stats')?.addEventListener('click', () => {
    closeDrawer();
    openStats();
  });
  $('drawer-fairness')?.addEventListener('click', () => {
    closeDrawer();
    openFairness();
  });
  $('drawer-foryou')?.addEventListener('click', () => {
    closeDrawer();
    els.foryouStrip?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  els.heartBtn.addEventListener('click', () => {
    favored = !favored;
    els.heartBtn.classList.toggle('on', favored);
    els.heartBtn.setAttribute('aria-pressed', favored ? 'true' : 'false');
    save();
    showToast(t(lang, favored ? 'favored' : 'unfavored'));
  });

  els.saveBtn.addEventListener('click', () => {
    save();
    showToast(t(lang, 'savedGame'), 'win');
  });

  document.querySelectorAll('.info-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const id = tab.dataset.tab;
      document.querySelectorAll('.info-tab').forEach((tEl) => tEl.classList.toggle('on', tEl === tab));
      document.querySelectorAll('.tab-panel').forEach((p) => {
        p.hidden = p.dataset.panel !== id;
      });
      if (id === 'stats') renderStatsPanel();
    });
  });

  document.querySelectorAll('.nav-item').forEach((item) => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach((n) => n.classList.remove('active'));
      item.classList.add('active');
      openNavPanel(item.dataset.nav);
    });
  });

  document.querySelectorAll('.fy-card').forEach((card) => {
    card.addEventListener('click', () => openGame(card.dataset.game));
  });
  els.gameBack.addEventListener('click', closeGame);

  els.modalBackdrop.addEventListener('click', closeModal);
  els.modalClose.addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      closeDrawer();
      if (!els.gameOverlay.hidden) closeGame();
    }
  });
}

async function main() {
  load();
  applyI18n();
  updateBalanceUI();
  updateResultField();
  bindUI();

  chart = await createChart(els.stage);
  startWaiting();

  setInterval(() => {
    if (mode === 'auto' && phase === 'waiting' && !bet) {
      const amount = parseNum(els.amountInput.value) || 0;
      if (amount >= 0.01 && amount <= balance) placeOrQueueBet();
    }
  }, 400);

  const loop = () => {
    tick();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

main().catch((err) => {
  console.error(err);
  showToast(t(lang, 'pixiFail'), 'lose');
});
