import './style.css';
import { createChart, multAt, msFor } from './chart.js';
import { crashPoint, randInt } from './rng.js';

const WAIT_MS = 5000;
const CRASH_HOLD_MS = 2800;
const STORAGE_KEY = 'stake-crash-demo-v1';
const HI_MULT = 2;

const $ = (id) => document.getElementById(id);

const els = {
  stage: $('stage'),
  history: $('history'),
  historyRefresh: $('history-refresh'),
  countdownPill: $('countdown-pill'),
  countdownVal: $('countdown-val'),
  crashedPill: $('crashed-pill'),
  playersCount: $('players-count'),
  livePlayers: $('live-players'),
  playBtn: $('play-btn'),
  amountInput: $('amount-input'),
  cashoutInput: $('cashout-input'),
  netGain: $('net-gain'),
  balance: $('balance'),
  balanceBtn: $('balance-btn'),
  halfBtn: $('half-btn'),
  doubleBtn: $('double-btn'),
  cashoutDown: $('cashout-down'),
  cashoutUp: $('cashout-up'),
  toast: $('toast'),
  signinBtn: $('signin-btn'),
  registerBtn: $('register-btn'),
  fairnessBtn: $('fairness-btn'),
};

let balance = 10000;
let history = [];
let mode = 'manual'; // manual | auto
let chart = null;

/** @type {'waiting'|'flying'|'crashed'} */
let phase = 'waiting';
let waitStart = 0;
let flyStart = 0;
let crashAt = 1;
let crashHoldStart = 0;

/** Pending / active bet */
let bet = null; // { amount, target, queued?, cashed?, won? }
let playersOnline = 24;
let playersInRound = 20;

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (typeof data.balance === 'number' && data.balance >= 0) balance = data.balance;
    if (Array.isArray(data.history)) history = data.history.slice(0, 24);
  } catch {
    /* ignore */
  }
  if (!history.length) {
    history = [1.44, 2.45, 1.28, 3.12, 1.05, 10.02, 25.97, 1.08];
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ balance, history }));
}

function fmtMoney(n) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

function renderHistory() {
  els.history.innerHTML = '';
  for (const m of history) {
    const pill = document.createElement('span');
    pill.className = `pill${m >= HI_MULT ? ' hi' : ''}`;
    pill.textContent = `${m.toFixed(2)}x`;
    els.history.appendChild(pill);
  }
  if (!history.length) {
    for (const m of [1.44, 2.45, 1.28, 3.12, 1.05, 10.02]) {
      const pill = document.createElement('span');
      pill.className = `pill${m >= HI_MULT ? ' hi' : ''}`;
      pill.textContent = `${m.toFixed(2)}x`;
      els.history.appendChild(pill);
    }
  }
}

function updateBalanceUI() {
  els.balance.textContent = fmtMoney(balance);
}

function updateNetGain() {
  const amount = parseNum(els.amountInput.value) || 0;
  const target = parseNum(els.cashoutInput.value) || 0;
  const net = amount > 0 && target >= 1.01 ? amount * target - amount : 0;
  els.netGain.value = formatInput(Math.max(0, net));
}

function bumpPlayers() {
  playersOnline = randInt(18, 42);
  playersInRound = Math.min(playersOnline, randInt(Math.max(8, playersOnline - 10), playersOnline));
  els.playersCount.textContent = `${playersInRound} / ${playersOnline}`;
  els.livePlayers.textContent = String(playersOnline);
}

function setPlayButton() {
  const btn = els.playBtn;
  btn.classList.remove('cashout', 'queued', 'waiting');
  btn.disabled = false;

  if (phase === 'flying' && bet && !bet.queued && !bet.cashed) {
    const m = multAt(performance.now() - flyStart);
    btn.textContent = `Cash Out ${fmtMoney(bet.amount * m)}`;
    btn.classList.add('cashout');
    return;
  }

  if (bet?.queued) {
    btn.textContent = 'Cancel Bet';
    btn.classList.add('queued');
    return;
  }

  if (phase === 'waiting') {
    btn.textContent = 'Play';
    return;
  }

  // flying without active bet, or crashed
  btn.textContent = 'Play Next Round';
  if (phase === 'crashed') btn.classList.add('waiting');
}

function placeOrQueueBet() {
  const amount = Math.round((parseNum(els.amountInput.value) || 0) * 100) / 100;
  const target = Math.round((parseNum(els.cashoutInput.value) || 0) * 100) / 100;

  if (!(amount >= 0.01)) {
    showToast('Enter a valid amount', 'lose');
    return;
  }
  if (!(target >= 1.01)) {
    showToast('Cashout must be at least 1.01x', 'lose');
    return;
  }
  if (amount > balance) {
    showToast('Insufficient balance', 'lose');
    return;
  }

  balance = Math.round((balance - amount) * 100) / 100;
  updateBalanceUI();
  save();

  bet = { amount, target, queued: phase !== 'waiting', cashed: null };

  if (phase === 'waiting') {
    showToast(`Bet ${fmtMoney(amount)} G placed`, '');
  } else {
    showToast('Bet queued for next round', '');
  }
  setPlayButton();
}

function cancelQueued() {
  if (!bet?.queued) return;
  balance = Math.round((balance + bet.amount) * 100) / 100;
  bet = null;
  updateBalanceUI();
  save();
  showToast('Bet cancelled');
  setPlayButton();
}

function cashOut(atMult) {
  if (!bet || bet.queued || bet.cashed != null) return;
  if (atMult >= crashAt) return;

  const m = Math.floor(atMult * 100) / 100;
  bet.cashed = m;
  const payout = Math.round(bet.amount * m * 100) / 100;
  balance = Math.round((balance + payout) * 100) / 100;
  updateBalanceUI();
  save();
  showToast(`Cashed out at ${m.toFixed(2)}x · +${fmtMoney(payout)} G`, 'win');
  setPlayButton();
}

function settleLoss() {
  if (!bet || bet.queued || bet.cashed != null) return;
  showToast(`Crashed at ${crashAt.toFixed(2)}x`, 'lose');
  // amount already deducted
  bet.cashed = 0;
  save();
}

function startWaiting() {
  phase = 'waiting';
  waitStart = performance.now();
  els.countdownPill.hidden = false;
  els.crashedPill.hidden = true;
  bumpPlayers();

  // Activate queued bet
  if (bet?.queued) {
    bet.queued = false;
  }

  chart?.draw({ ms: 0, phase: 'waiting' });
  setPlayButton();
}

function startFlying() {
  phase = 'flying';
  flyStart = performance.now();
  crashAt = crashPoint();
  els.countdownPill.hidden = true;
  els.crashedPill.hidden = true;
  bumpPlayers();
  setPlayButton();
}

function startCrashed() {
  phase = 'crashed';
  crashHoldStart = performance.now();
  els.countdownPill.hidden = true;
  els.crashedPill.hidden = false;

  history.unshift(crashAt);
  history = history.slice(0, 24);
  renderHistory();
  save();

  if (bet && !bet.queued && bet.cashed == null) {
    settleLoss();
  }

  // Clear spent bet after crash (keep queued)
  if (bet && !bet.queued) bet = null;

  chart?.draw({
    ms: msFor(crashAt),
    crashed: true,
    crashMult: crashAt,
    phase: 'crashed',
  });
  setPlayButton();
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

    // Auto cashout (always when target reached — Stake "Cashout At")
    if (bet && !bet.queued && bet.cashed == null && m >= bet.target && bet.target < crashAt) {
      cashOut(bet.target);
    }

    if (m >= crashAt) {
      startCrashed();
      return;
    }

    chart?.draw({ ms, phase: 'flying' });
    setPlayButton();
    return;
  }

  if (phase === 'crashed') {
    if (now - crashHoldStart >= CRASH_HOLD_MS) startWaiting();
  }
}

function bindUI() {
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
    updateNetGain();
  });

  els.doubleBtn.addEventListener('click', () => {
    const v = (parseNum(els.amountInput.value) || 0) * 2;
    els.amountInput.value = formatInput(Math.min(balance, Math.round(v * 100) / 100));
    updateNetGain();
  });

  els.cashoutDown.addEventListener('click', () => {
    const v = Math.max(1.01, (parseNum(els.cashoutInput.value) || 2) - 0.1);
    els.cashoutInput.value = formatInput(Math.round(v * 100) / 100);
    updateNetGain();
  });

  els.cashoutUp.addEventListener('click', () => {
    const v = (parseNum(els.cashoutInput.value) || 2) + 0.1;
    els.cashoutInput.value = formatInput(Math.round(v * 100) / 100);
    updateNetGain();
  });

  els.amountInput.addEventListener('input', updateNetGain);
  els.cashoutInput.addEventListener('input', updateNetGain);

  els.amountInput.addEventListener('blur', () => {
    const v = parseNum(els.amountInput.value) || 0;
    els.amountInput.value = formatInput(Math.max(0, v));
    updateNetGain();
  });

  els.cashoutInput.addEventListener('blur', () => {
    const v = parseNum(els.cashoutInput.value) || 1.01;
    els.cashoutInput.value = formatInput(Math.max(1.01, v));
    updateNetGain();
  });

  document.querySelectorAll('.mode').forEach((btn) => {
    btn.addEventListener('click', () => {
      mode = btn.dataset.mode;
      document.querySelectorAll('.mode').forEach((b) => {
        const on = b.dataset.mode === mode;
        b.classList.toggle('on', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      if (mode === 'auto') {
        showToast('Auto mode: cashout at your target every round');
      }
    });
  });

  els.historyRefresh.addEventListener('click', () => {
    els.historyRefresh.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(360deg)' }], {
      duration: 450,
      easing: 'ease-out',
    });
    renderHistory();
  });

  els.balanceBtn.addEventListener('click', () => {
    if (balance < 100) {
      balance = 10000;
      updateBalanceUI();
      save();
      showToast('Demo balance refilled to 10,000 G');
    } else {
      showToast(`Balance: ${fmtMoney(balance)} G (demo)`);
    }
  });

  els.signinBtn.addEventListener('click', () => showToast('Demo mode — no account needed'));
  els.registerBtn.addEventListener('click', () => showToast('Demo mode — fictional credits only'));
  els.fairnessBtn.addEventListener('click', () =>
    showToast('Provably fair demo: crypto.getRandomValues(), RTP 99%'),
  );
}

async function main() {
  load();
  renderHistory();
  updateBalanceUI();
  updateNetGain();
  bumpPlayers();
  bindUI();

  chart = await createChart(els.stage);

  startWaiting();

  // Auto-bet hook: poll lightly
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
  showToast('Failed to start PixiJS canvas', 'lose');
});
