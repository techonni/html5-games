import './style.css';
import { Feed, MARKETS } from './market.js';
import { Chart } from './chart.js';
import { icons, symbolIcon } from './icons.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const phone = $('#phone');

// ---------- Estado ----------
const START_BALANCE = 10000;
const MULTIPLIERS = [1, 10, 20, 40, 60, 100, 200, 300];
const RISE_FALL_PAYOUT = 1.95;
const TRADE_TYPES = { multipliers: 'Multipliers', risefall: 'Rise/Fall' };

const state = {
  balance: START_BALANCE,
  view: 'trade',
  tradeType: 'multipliers',
  market: 'R_100',
  dir: 'up',
  mult: 1,
  stake: 2,
  tp: null,
  sl: null,
  duration: 5,
  chartMode: 'tick',
  open: [],
  closed: [],
  posTab: 'open',
  expanded: null,
};

try {
  const saved = JSON.parse(localStorage.getItem('pixelune.trader.v1'));
  if (saved) {
    state.balance = saved.balance ?? START_BALANCE;
    state.closed = saved.closed ?? [];
  }
} catch {
  /* sem armazenamento */
}
const save = () => {
  try {
    localStorage.setItem('pixelune.trader.v1', JSON.stringify({ balance: state.balance, closed: state.closed.slice(0, 50) }));
  } catch {
    /* ignorar */
  }
};

// ---------- Formatação ----------
const r2 = (n) => Math.round(n * 100) / 100;
const num = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const eur = (n) => `${num(n)} EUR`;
const signedEur = (n) => `${n < 0 ? '-' : ''}${num(Math.abs(n))} EUR`;
const euroSym = (n, signed = false) => `${n < 0 ? '-' : signed && n > 0 ? '+' : ''}€${num(Math.abs(n))}`;
const euroShort = (n) => `€${Number.isInteger(n) ? n : num(n)}`;

// ---------- Mercados ----------
const feed = new Feed();
const market = () => feed.markets[state.market];
const def = (id) => MARKETS.find((m) => m.id === id);

// ---------- Ícones estáticos ----------
$('#plus-btn').innerHTML = icons.plus;
$('#chart-menu').innerHTML = icons.dots;
$$('.chev').forEach((c) => (c.innerHTML = icons.chevron));
$('.toast-ico').innerHTML = icons.stopwatch;
const navIcons = () => {
  $$('#tabbar button').forEach((b) => {
    const nav = b.dataset.nav;
    const on = nav === state.view;
    b.classList.toggle('on', on);
    const i = $('i', b);
    if (nav === 'trade') i.innerHTML = on ? icons.trade : icons.tradeOutline;
    else if (nav === 'positions') i.innerHTML = on ? icons.positionsActive : icons.positions;
    else i.innerHTML = icons[nav];
  });
};

// ---------- Contratos ----------
function contractPL(c) {
  const m = feed.markets[c.market];
  const q = m.last.quote;
  if (c.type === 'multipliers') {
    const move = ((q - c.entry) / c.entry) * (c.dir === 'up' ? 1 : -1);
    return r2(c.stake * c.mult * move - c.commission);
  }
  const winning = c.dir === 'up' ? q > c.entry : q < c.entry;
  return winning ? r2(c.stake * RISE_FALL_PAYOUT - c.stake) : -c.stake;
}

function closeContract(c, reason) {
  const i = state.open.indexOf(c);
  if (i < 0) return;
  state.open.splice(i, 1);
  let pl = contractPL(c);
  if (c.type === 'multipliers') pl = Math.max(pl, -c.stake);
  if (c.type === 'risefall') {
    const exit = feed.markets[c.market].last.quote;
    const win = c.dir === 'up' ? exit > c.entry : exit < c.entry;
    pl = win ? r2(c.stake * RISE_FALL_PAYOUT - c.stake) : -c.stake;
    c.exit = exit;
  }
  c.pl = pl;
  c.closedAt = Date.now();
  c.reason = reason;
  state.balance = r2(state.balance + c.stake + pl);
  state.closed.unshift(c);
  save();
  toast(pl >= 0 ? `Profit: ${eur(pl)}` : `Loss: ${eur(-pl)}`, `${contractName(c)} - ${def(c.market).name}${reason ? ` (${reason})` : ''}`);
  render();
}

const dirName = (type, dir) => (type === 'risefall' ? (dir === 'up' ? 'Rise' : 'Fall') : dir === 'up' ? 'Up' : 'Down');
const contractName = (c) => `${TRADE_TYPES[c.type]} ${dirName(c.type, c.dir)}`;

function buy() {
  const stake = state.stake;
  if (stake > state.balance) {
    toast('Insufficient balance', 'Tap Reset to restore your demo funds.');
    return;
  }
  const m = market();
  const c = {
    id: Date.now() + Math.random(),
    type: state.tradeType,
    market: state.market,
    dir: state.dir,
    stake,
    entry: m.last.quote,
    entryEpoch: m.last.epoch,
  };
  if (c.type === 'multipliers') {
    c.mult = state.mult;
    c.commission = r2(stake * Math.sqrt(state.mult) * 0.01);
    c.tp = state.tp;
    c.sl = state.sl;
  } else {
    c.duration = state.duration;
    c.ticksLeft = state.duration;
  }
  state.balance = r2(state.balance - stake);
  state.open.unshift(c);
  save();
  toast(`Stake: ${eur(stake)}`, `${contractName(c)} - ${def(c.market).name}`);
  const box = $('#sym-box');
  box.classList.add('flash');
  requestAnimationFrame(() => requestAnimationFrame(() => box.classList.remove('flash')));
  render();
}

feed.addEventListener('tick', () => {
  for (const c of [...state.open]) {
    if (c.type === 'multipliers') {
      const pl = contractPL(c);
      if (pl <= -c.stake) closeContract(c, 'stop out');
      else if (c.tp != null && pl >= c.tp) closeContract(c, 'take profit');
      else if (c.sl != null && pl <= -c.sl) closeContract(c, 'stop loss');
    } else {
      c.ticksLeft--;
      if (c.ticksLeft <= 0) closeContract(c);
    }
  }
  renderLive();
});

// Ao sair da página, fecha as posições abertas ao preço atual.
window.addEventListener('pagehide', () => {
  for (const c of [...state.open]) closeContract(c, 'session ended');
});

// ---------- Toast ----------
let toastTimer;
function toast(title, sub) {
  const t = $('#toast');
  $('#toast-title').textContent = title;
  $('#toast-sub').textContent = sub;
  t.hidden = false;
  t.classList.remove('out');
  void t.offsetWidth;
  t.style.animation = 'none';
  void t.offsetWidth;
  t.style.animation = '';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.add('out');
    setTimeout(() => (t.hidden = true), 250);
  }, 2600);
}

// ---------- Folhas inferiores ----------
function openSheet(title, build) {
  $('#sheet-title').textContent = title;
  const body = $('#sheet-body');
  body.replaceChildren();
  build(body, closeSheet);
  $('#sheet-wrap').hidden = false;
}
function closeSheet() {
  $('#sheet-wrap').hidden = true;
}
$('#sheet-wrap').addEventListener('click', (e) => e.target.id === 'sheet-wrap' && closeSheet());

const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
};

function chips(options, value, onPick, cols = 4) {
  const wrap = el('div', `chips${cols !== 4 ? ` cols-${cols}` : ''}`);
  for (const [v, label] of options) {
    const b = el('button', `chip${v === value ? ' on' : ''}`, label);
    b.onclick = () => {
      $$('.chip', wrap).forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
      onPick(v);
    };
    wrap.append(b);
  }
  return wrap;
}

function symbolSheet() {
  openSheet('Trade', (body, close) => {
    body.append(el('div', 'sheet-section', 'Trade type'));
    body.append(
      chips(Object.entries(TRADE_TYPES), state.tradeType, (v) => {
        state.tradeType = v;
        render();
      }, 2),
    );
    body.append(el('div', 'sheet-section', 'Synthetic indices'));
    for (const d of MARKETS) {
      const b = el('button', `list-item${d.id === state.market ? ' on' : ''}`);
      b.innerHTML = `<span class="sym-ico">${symbolIcon(d.badge)}</span><span>${d.name}</span><span class="price">${feed.markets[d.id].last.quote.toFixed(d.decimals)}</span>`;
      b.onclick = () => {
        state.market = d.id;
        chart?.setMarket(market());
        close();
        render();
      };
      body.append(b);
    }
  });
}

function multiplierSheet() {
  openSheet('Multiplier', (body, close) => {
    body.append(chips(MULTIPLIERS.map((m) => [m, `x${m}`]), state.mult, (v) => ((state.mult = v), render(), close())));
    body.append(el('div', 'hint', 'Your profit or loss is the market movement multiplied by this value. Your loss can never exceed your stake.'));
  });
}

function stakeSheet() {
  openSheet('Stake', (body, close) => {
    const step = el('div', 'stepper');
    const minus = el('button', '', '−');
    const plus = el('button', '', '+');
    const input = el('input');
    input.type = 'number';
    input.inputMode = 'decimal';
    input.min = '1';
    input.step = '1';
    input.value = state.stake;
    minus.onclick = () => (input.value = Math.max(1, (parseFloat(input.value) || 1) - 1));
    plus.onclick = () => (input.value = (parseFloat(input.value) || 0) + 1);
    step.append(minus, input, plus);
    const quick = chips([[1, '€1'], [5, '€5'], [10, '€10'], [50, '€50']], null, (v) => (input.value = v));
    const saveBtn = el('button', 'sheet-btn', 'Save');
    saveBtn.onclick = () => {
      state.stake = Math.max(1, Math.min(2000, r2(parseFloat(input.value) || 1)));
      render();
      close();
    };
    body.append(step, quick, el('div', 'hint', `Balance: ${eur(state.balance)}`), saveBtn);
  });
}

function riskSheet() {
  openSheet('Risk management', (body, close) => {
    const row = (label, value) => {
      const wrap = el('div');
      const head = el('div', 'row-toggle');
      const sw = el('button', `switch${value != null ? ' on' : ''}`);
      head.append(el('span', '', label), sw);
      const input = el('input', 'input');
      input.type = 'number';
      input.inputMode = 'decimal';
      input.placeholder = 'Amount (EUR)';
      input.value = value ?? '';
      input.disabled = value == null;
      sw.onclick = () => {
        sw.classList.toggle('on');
        input.disabled = !sw.classList.contains('on');
        if (!input.disabled) input.focus();
      };
      wrap.style.cssText = 'display:flex;flex-direction:column;gap:10px';
      wrap.append(head, input);
      return { wrap, get: () => (input.disabled ? null : Math.max(0.01, r2(parseFloat(input.value) || 0)) || null) };
    };
    const tp = row('Take profit', state.tp);
    const sl = row('Stop loss', state.sl);
    const saveBtn = el('button', 'sheet-btn', 'Save');
    saveBtn.onclick = () => {
      state.tp = tp.get();
      state.sl = sl.get();
      render();
      close();
    };
    body.append(tp.wrap, sl.wrap, el('div', 'hint', 'Positions close automatically when profit or loss reaches these amounts.'), saveBtn);
  });
}

function durationSheet() {
  openSheet('Duration', (body, close) => {
    body.append(chips([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => [n, `${n} tick${n > 1 ? 's' : ''}`]), state.duration, (v) => ((state.duration = v), render(), close())));
  });
}

function chartSheet() {
  openSheet('Chart', (body, close) => {
    body.append(el('div', 'sheet-section', 'Time interval'));
    body.append(
      chips([['tick', '1 tick'], [60, '1 minute'], [300, '5 minutes']], state.chartMode, (v) => {
        state.chartMode = v;
        chart?.setMode(v);
        render();
        close();
      }, 3),
    );
  });
}

function menuSheet() {
  openSheet('Menu', (body, close) => {
    const reset = el('button', 'sheet-btn', 'Reset demo balance');
    reset.onclick = () => {
      resetBalance();
      close();
    };
    const back = el('a', 'sheet-btn ghost', 'Back to Pixelune Casino');
    back.href = '../';
    back.style.cssText = 'display:grid;place-items:center;text-decoration:none';
    body.append(reset, back, el('div', 'hint', 'Pixelune Trader is a demo built with PixiJS. Prices are simulated and the balance has no monetary value.'));
  });
}

function resetBalance() {
  state.open = [];
  state.closed = [];
  state.balance = START_BALANCE;
  save();
  toast('Balance reset', `Demo balance: ${eur(START_BALANCE)}`);
  render();
}

// ---------- Renderização ----------
function bind(name, value, html = false) {
  $$(`[data-bind="${name}"]`).forEach((e) => {
    if (html) {
      if (e.dataset.v !== value) (e.innerHTML = value), (e.dataset.v = value);
    } else if (e.textContent !== value) e.textContent = value;
  });
}

function setCard(n, label, value, onClick) {
  const c = $(`#card-${n}`);
  $('.card-label', c).textContent = label;
  $('.card-value', c).textContent = value;
  c.onclick = onClick;
}

function render() {
  phone.dataset.view = state.view;
  navIcons();
  const d = def(state.market);
  bind('balance', eur(state.balance));
  bind('symName', d.name);
  bind('symIcon', symbolIcon(d.badge), true);
  bind('tradeTypeName', TRADE_TYPES[state.tradeType]);
  bind('upLabel', dirName(state.tradeType, 'up'));
  bind('downLabel', dirName(state.tradeType, 'down'));
  $$('#dir-seg button').forEach((b) => b.classList.toggle('on', b.dataset.dir === state.dir));
  $('#buy-btn').classList.toggle('down', state.dir === 'down');

  if (state.tradeType === 'multipliers') {
    setCard(1, 'Multiplier', `x${state.mult}`, multiplierSheet);
    setCard(2, 'Stake', euroShort(state.stake), stakeSheet);
    const risk = [state.tp != null ? `TP ${euroShort(state.tp)}` : null, state.sl != null ? `SL ${euroShort(state.sl)}` : null].filter(Boolean).join(' · ');
    setCard(3, 'Risk management', risk || '-', riskSheet);
  } else {
    setCard(1, 'Duration', `${state.duration} tick${state.duration > 1 ? 's' : ''}`, durationSheet);
    setCard(2, 'Stake', euroShort(state.stake), stakeSheet);
    setCard(3, 'Payout', euroShort(r2(state.stake * RISE_FALL_PAYOUT)), stakeSheet);
  }

  $('#interval-tag').textContent = state.chartMode === 'tick' ? '1t' : state.chartMode === 60 ? '1m' : '5m';
  $('#expand-btn').innerHTML = phone.classList.contains('fs') ? icons.collapse : icons.expand;

  const badge = $('#nav-badge');
  badge.hidden = state.open.length === 0;
  badge.textContent = state.open.length;
  $$('#pos-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === state.posTab));
  renderPositions();
  renderLive();
}

function positionCard(c, live) {
  const d = def(c.market);
  const pl = live ? contractPL(c) : c.pl;
  const card = el('div', 'pos-card');
  card.dataset.id = c.id;
  const extra = live
    ? c.type === 'risefall'
      ? `${c.ticksLeft} tick${c.ticksLeft === 1 ? '' : 's'} remaining`
      : `x${c.mult} · Entry ${c.entry.toFixed(d.decimals)}`
    : `${c.reason ? `${c.reason[0].toUpperCase()}${c.reason.slice(1)} · ` : ''}Entry ${c.entry.toFixed(d.decimals)}`;
  card.innerHTML = `
    <span class="sym-ico">${symbolIcon(d.badge)}</span>
    <div class="pos-main"><span>${d.name}</span><span class="t2">${contractName(c)}</span><span class="t3">${extra}</span></div>
    <div class="pos-side"><span class="ci">${icons.contract}</span><span class="stake">${num(c.stake)} EUR</span><span class="pl${pl >= 0 ? ' pos' : ''}" data-pl>${signedEur(pl)}</span></div>`;
  if (live && c.type === 'multipliers' && state.expanded === c.id) {
    const actions = el('div', 'pos-actions');
    const btn = el('button', 'pos-close', `Close ${euroSym(pl, true)}`);
    btn.dataset.closeBtn = '';
    btn.onclick = (e) => {
      e.stopPropagation();
      state.expanded = null;
      closeContract(c, null);
    };
    actions.append(btn);
    card.append(actions);
  }
  if (live && c.type === 'multipliers') {
    card.style.cursor = 'pointer';
    card.onclick = () => {
      state.expanded = state.expanded === c.id ? null : c.id;
      renderPositions();
    };
  }
  return card;
}

function renderPositions() {
  const list = $('#pos-list');
  const open = state.posTab === 'open';
  const items = open ? state.open : state.closed;
  list.replaceChildren(...items.map((c) => positionCard(c, open)));
  if (!items.length) list.append(el('div', 'empty', open ? 'You have no open positions.' : 'You have no closed positions yet.'));
}

// Atualizações a cada tick (sem reconstruir o DOM).
function renderLive() {
  const openHere = state.open.filter((c) => c.market === state.market);
  chart?.setContracts(openHere.map((c) => ({ entry: c.entry, entryEpoch: c.entryEpoch, dir: c.dir })));

  const pill = $('#pl-pill');
  pill.hidden = state.open.length === 0;
  const total = r2(state.open.reduce((s, c) => s + contractPL(c), 0));
  $('#pl-count').textContent = state.open.length;
  const pv = $('#pl-value');
  pv.textContent = euroSym(total);
  pv.classList.toggle('pos', total >= 0);

  const totalEl = $('#pos-total');
  const shown = state.posTab === 'open' ? total : r2(state.closed.reduce((s, c) => s + c.pl, 0));
  totalEl.textContent = signedEur(shown);
  totalEl.classList.toggle('pos', shown >= 0);

  if (state.view === 'positions' && state.posTab === 'open') {
    for (const c of state.open) {
      const card = $(`.pos-card[data-id="${c.id}"]`);
      if (!card) continue;
      const pl = contractPL(c);
      const p = $('[data-pl]', card);
      p.textContent = signedEur(pl);
      p.classList.toggle('pos', pl >= 0);
      const btn = $('[data-close-btn]', card);
      if (btn) btn.textContent = `Close ${euroSym(pl, true)}`;
      if (c.type === 'risefall') $('.t3', card).textContent = `${c.ticksLeft} tick${c.ticksLeft === 1 ? '' : 's'} remaining`;
    }
  }
}

// ---------- Eventos ----------
$$('#dir-seg button').forEach((b) => (b.onclick = () => ((state.dir = b.dataset.dir), render())));
$('#buy-btn').onclick = buy;
$('#sym-box').onclick = symbolSheet;
$('#plus-btn').onclick = symbolSheet;
$('#chart-menu').onclick = chartSheet;
$('#reset-btn').onclick = resetBalance;
$('#pl-pill').onclick = () => {
  phone.classList.remove('fs');
  state.view = 'positions';
  state.posTab = 'open';
  render();
};
$('#expand-btn').onclick = () => {
  phone.classList.toggle('fs');
  render();
};
$$('#pos-tabs button').forEach((b) => (b.onclick = () => ((state.posTab = b.dataset.tab), render())));
$$('#tabbar button').forEach(
  (b) =>
    (b.onclick = () => {
      if (b.dataset.nav === 'menu') return menuSheet();
      state.view = b.dataset.nav;
      render();
    }),
);
$$('.home-card').forEach(
  (b) =>
    (b.onclick = () => {
      state.tradeType = b.dataset.type;
      state.view = 'trade';
      render();
    }),
);

// ---------- Arranque ----------
let chart = null;
render();
(async () => {
  try {
    await document.fonts?.load("600 15px 'IBM Plex Sans'");
  } catch {
    /* fonte indisponível: usa a alternativa */
  }
  chart = await Chart.create($('#chart'), market());
  chart.setMode(state.chartMode);
  renderLive();
})();
