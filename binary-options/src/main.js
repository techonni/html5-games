import './style.css';
import { Feed, MARKETS } from './market.js';
import { Chart } from './chart.js';
import { icons, symbolIcon } from './icons.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const phone = $('#phone');
const deskMQ = window.matchMedia('(min-width: 900px)');

// ---------- Estado ----------
const START_BALANCE = 10000;
const MULTIPLIERS = [1, 10, 20, 40, 60, 100, 200, 300];
const TRADE_TYPES = { binary: 'Binary', digital: 'Digital', turbo: 'Turbo', multipliers: 'Multipliers' };
// Opções binárias: prazos em segundos e lucro fixo (em % da aposta).
const DURATIONS = {
  binary: [60, 120, 300, 600, 900],
  digital: [60, 120, 300, 600],
  turbo: [30, 60, 120, 180, 300],
};
const FIXED_PROFIT = { binary: 0.85, turbo: 0.8 };
const STRIKES = [-3, -2, -1, 0, 1, 2, 3];
const isBinary = (type) => type !== 'multipliers';

// Função de distribuição normal (aproximação de Abramowitz-Stegun).
function normCdf(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

// Distância entre níveis de strike: meio desvio padrão do movimento esperado até ao vencimento.
function strikeStep(m, seconds) {
  const raw = m.last.quote * m.sigma * Math.sqrt(seconds) * 0.5;
  const p = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map((k) => k * p).find((v) => v >= raw);
}

// Lucro (em % da aposta) de um contrato binário.
function profitRate(type, dir, k) {
  if (type !== 'digital') return FIXED_PROFIT[type];
  // Probabilidade de terminar além do strike (k níveis de 0.5σ): quanto mais longe, maior o payout.
  const z = k * 0.5;
  const pWin = dir === 'up' ? 1 - normCdf(z) : normCdf(z);
  return Math.min(9, Math.max(0.1, 0.88 / pWin - 1));
}

const fmtDur = (s) => (s < 60 ? `${s}s` : `${s / 60}m`);
const fmtClock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

const state = {
  balance: START_BALANCE,
  view: 'trade',
  tradeType: 'binary',
  market: 'R_100',
  dir: 'up',
  mult: 1,
  stake: 2,
  tp: null,
  sl: null,
  durations: { binary: 60, digital: 60, turbo: 30 },
  strike: 0,
  chartMode: deskMQ.matches ? 60 : 'tick',
  tabs: ['R_100'],
  theme: 'dark',
  drawer: null, // 'positions' | 'reports' | 'home' | 'help'
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
$('.expiry-ico').innerHTML = icons.stopwatch;
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
  return binaryResult(c, q);
}

// Tudo ou nada: ganha o lucro fixo, perde 100% da aposta; empate exato devolve a aposta.
function binaryResult(c, q) {
  if (q === c.strike) return 0;
  const win = c.dir === 'up' ? q > c.strike : q < c.strike;
  return win ? r2(c.payout - c.stake) : -c.stake;
}

function quoteAt(m, epoch) {
  for (let i = m.ticks.length - 1; i >= 0; i--) if (m.ticks[i].epoch <= epoch) return m.ticks[i].quote;
  return m.last.quote;
}

function closeContract(c, reason) {
  const i = state.open.indexOf(c);
  if (i < 0) return;
  state.open.splice(i, 1);
  let pl = contractPL(c);
  if (c.type === 'multipliers') pl = Math.max(pl, -c.stake);
  if (isBinary(c.type)) {
    const m = feed.markets[c.market];
    c.exit = quoteAt(m, Math.min(c.expiryEpoch, m.last.epoch));
    pl = binaryResult(c, c.exit);
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

const dirName = (type, dir) => (dir === 'up' ? 'Up' : 'Down');
const contractDir = (c) => (isBinary(c.type) ? (c.dir === 'up' ? 'Up / Call' : 'Down / Put') : dirName(c.type, c.dir));
const contractName = (c) => `${TRADE_TYPES[c.type]} ${contractDir(c)}`;

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
    const T = state.durations[c.type];
    c.duration = T;
    c.expiryEpoch = c.entryEpoch + T;
    c.strike = c.type === 'digital' ? m.round(c.entry + state.strike * strikeStep(m, T)) : c.entry;
    c.rate = profitRate(c.type, c.dir, state.strike);
    c.payout = r2(stake * (1 + c.rate));
  }
  state.balance = r2(state.balance - stake);
  state.open.unshift(c);
  save();
  toast(`Stake: ${eur(stake)}`, `${contractName(c)} - ${def(c.market).name}${c.duration ? ` · ${fmtDur(c.duration)}` : ''}`);
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
    } else if (feed.markets[c.market].last.epoch >= c.expiryEpoch) {
      closeContract(c, 'expired');
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
        selectMarket(d.id, true);
        close();
      };
      body.append(b);
    }
  });
}

function selectMarket(id, addTab) {
  if (!state.tabs.includes(id)) {
    if (addTab || !deskMQ.matches) state.tabs.push(id);
    if (state.tabs.length > 4) state.tabs.splice(state.tabs.findIndex((t) => t !== id), 1);
  }
  state.market = id;
  chart?.setMarket(market());
  render();
}

function closeTab(id) {
  if (state.tabs.length < 2) return;
  const i = state.tabs.indexOf(id);
  state.tabs.splice(i, 1);
  if (state.market === id) selectMarket(state.tabs[Math.max(0, i - 1)]);
  else render();
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
  const type = state.tradeType;
  openSheet('Duration', (body, close) => {
    body.append(
      chips(DURATIONS[type].map((n) => [n, fmtDur(n)]), state.durations[type], (v) => ((state.durations[type] = v), render(), close()), DURATIONS[type].length === 4 ? 4 : 3),
    );
    body.append(el('div', 'hint', type === 'turbo' ? 'Turbo: very short contracts, from 30 seconds to 5 minutes.' : 'The result is decided by the price at the exact second of expiry.'));
  });
}

function strikeSheet() {
  const m = market();
  const step = strikeStep(m, state.durations.digital);
  openSheet('Strike price', (body, close) => {
    body.append(
      chips(
        STRIKES.map((k) => [k, `${k > 0 ? '+' : ''}${(k * step).toFixed(m.decimals)}`]),
        state.strike,
        (v) => ((state.strike = v), render(), close()),
        4,
      ),
    );
    const rows = STRIKES.map((k) => `${k > 0 ? '+' : ''}${(k * step).toFixed(m.decimals)}: Up ${Math.round(profitRate('digital', 'up', k) * 100)}% · Down ${Math.round(profitRate('digital', 'down', k) * 100)}%`);
    body.append(el('div', 'hint', `Distance from the current price. The further the strike is against you, the higher the payout.<br>${rows.join('<br>')}`));
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
    const clear = el('button', 'sheet-btn ghost', 'Clear drawings');
    clear.onclick = () => (chart?.clearDrawings(), close());
    body.append(clear);
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

const buyBtn = $('#buy-btn');
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
    const type = state.tradeType;
    const rate = profitRate(type, state.dir, state.strike);
    const payout = r2(state.stake * (1 + rate));
    setCard(1, 'Duration', fmtDur(state.durations[type]), durationSheet);
    if (type === 'digital') {
      const m = market();
      const off = state.strike * strikeStep(m, state.durations.digital);
      setCard(2, 'Strike', state.strike ? `${off > 0 ? '+' : ''}${off.toFixed(m.decimals)}` : 'Spot', strikeSheet);
      setCard(3, 'Stake', euroShort(state.stake), stakeSheet);
    } else {
      setCard(2, 'Stake', euroShort(state.stake), stakeSheet);
      setCard(3, 'Payout', `${euroShort(payout)}`, stakeSheet);
    }
    buyBtn.textContent = `Buy · +${Math.round(rate * 100)}%`;
  }
  if (!isBinary(state.tradeType)) buyBtn.textContent = 'Buy';

  $('#interval-tag').textContent = state.chartMode === 'tick' ? '1t' : state.chartMode === 60 ? '1m' : '5m';
  $('#expand-btn').innerHTML = phone.classList.contains('fs') ? icons.collapse : icons.expand;

  const badge = $('#nav-badge');
  badge.hidden = state.open.length === 0;
  badge.textContent = state.open.length;
  $$('#pos-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === state.posTab));
  renderPositions();
  renderDesk();
  renderLive();
}

function positionCard(c, live) {
  const d = def(c.market);
  const pl = live ? contractPL(c) : c.pl;
  const card = el('div', 'pos-card');
  card.dataset.id = c.id;
  const extra = live
    ? isBinary(c.type)
      ? binaryInfo(c)
      : `x${c.mult} · Entry ${c.entry.toFixed(d.decimals)}`
    : isBinary(c.type)
      ? `Strike ${c.strike.toFixed(d.decimals)} · Exit ${c.exit.toFixed(d.decimals)}`
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

function binaryInfo(c) {
  const left = Math.max(0, c.expiryEpoch - feed.markets[c.market].last.epoch);
  return `Expires in ${fmtClock(left)} · Strike ${c.strike.toFixed(def(c.market).decimals)} · Payout ${num(c.payout)}`;
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
  chart?.setContracts(openHere.map((c) => ({ entry: c.entry, entryEpoch: c.entryEpoch, dir: c.dir, strike: c.strike, expiryEpoch: c.expiryEpoch })));
  const timed = state.open.filter((c) => isBinary(c.type));
  const exp = $('#expiry-pill');
  exp.hidden = timed.length === 0;
  if (timed.length) {
    const next = Math.min(...timed.map((c) => c.expiryEpoch - feed.markets[c.market].last.epoch));
    $('#expiry-time').textContent = fmtClock(Math.max(0, next));
  }

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

  renderDeskLive();

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
      if (isBinary(c.type)) $('.t3', card).textContent = binaryInfo(c);
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
    await document.fonts?.load("600 15px 'Figtree'");
  } catch {
    /* fonte indisponível: usa a alternativa */
  }
  chart = await Chart.create($('#chart-canvas'), market());
  chart.setMode(state.chartMode);
  chart.onDrawDone = () => $('#t-draw').classList.remove('on');
  placeChart();
  renderLive();
})();

// =================== Desktop ===================
const deskIconMap = { home: 'homeDesk', positions: 'positionsDesk' };
$$('#desk [data-icon]').forEach((i) => (i.innerHTML = icons[deskIconMap[i.dataset.icon] ?? i.dataset.icon] ?? ''));
$('#d-plus').innerHTML = icons.plus;
$('#drawer-close').innerHTML = icons.closeX;

// Move o canvas do gráfico para o layout ativo.
function placeChart() {
  if (!chart) return;
  const host = $('#chart-canvas');
  if (deskMQ.matches) {
    $('#d-chart').prepend(host);
    chart.setLayout('desktop');
  } else {
    $('#chart').prepend(host);
    chart.setLayout('mobile');
  }
}
deskMQ.addEventListener('change', () => {
  placeChart();
  render();
});

function setDeskCard(n, label, value, onClick) {
  const c = $(`#d-card-${n}`);
  c.hidden = label == null;
  if (label == null) return;
  $('.d-card-label', c).textContent = label;
  $('.d-card-value', c).textContent = value;
  c.onclick = onClick;
}

function deskRows() {
  const rows = [];
  if (state.tradeType === 'multipliers') {
    const m = market();
    const q = m.last.quote;
    const comm = r2(state.stake * Math.sqrt(state.mult) * 0.01);
    const move = (state.stake - comm) / (state.stake * state.mult);
    const level = state.dir === 'up' ? q * (1 - move) : q * (1 + move);
    rows.push(['Stop out', euroSym(state.stake)], ['Stop out level', Math.max(0, level).toFixed(m.decimals)], ['Commission', euroSym(comm)]);
  } else {
    const rate = profitRate(state.tradeType, state.dir, state.strike);
    const exp = new Date((market().last.epoch + state.durations[state.tradeType]) * 1000);
    rows.push(
      ['Payout', euroSym(r2(state.stake * (1 + rate)))],
      ['Profit', `+${Math.round(rate * 100)}%`],
      ['Expiry', `${exp.toISOString().slice(11, 19)} GMT`],
    );
  }
  return rows;
}

function renderDesk() {
  // Separadores de mercado
  const tabs = $('#d-tabs');
  tabs.replaceChildren(
    ...state.tabs.map((id) => {
      const d = def(id);
      const on = id === state.market;
      const t = el('div', `d-tab${on ? ' on' : ''}`);
      t.dataset.id = id;
      t.innerHTML = `<span class="sym-ico">${symbolIcon(d.badge)}</span>
        <span class="d-tab-text"><span class="d-tab-name">${d.name}</span>
        <span class="d-tab-sub"><span>${TRADE_TYPES[state.tradeType]}</span>${on ? `<i class="chev">${icons.chevron}</i>` : ''}<span class="d-tab-pl" hidden></span></span></span>
        ${on && state.tabs.length > 1 ? `<button class="d-tab-x" aria-label="Close tab">${icons.tabClose}</button>` : ''}`;
      t.onclick = (e) => {
        if (e.target.closest('.d-tab-x')) return closeTab(id);
        if (on) return symbolSheet();
        selectMarket(id);
      };
      return t;
    }),
  );

  // Painel de parâmetros
  $('#d-howto-text').textContent = `How to trade ${TRADE_TYPES[state.tradeType]}?`;
  $$('#d-seg button').forEach((b) => b.classList.toggle('on', b.dataset.dir === state.dir));
  const buy = $('#d-buy');
  buy.classList.toggle('down', state.dir === 'down');
  if (state.tradeType === 'multipliers') {
    const risk = [state.tp != null ? `TP ${euroShort(state.tp)}` : null, state.sl != null ? `SL ${euroShort(state.sl)}` : null].filter(Boolean).join(' · ');
    setDeskCard(1, 'Multiplier', `x${state.mult}`, multiplierSheet);
    setDeskCard(2, 'Stake', euroShort(state.stake), stakeSheet);
    setDeskCard(3, 'Risk management', risk || '-', riskSheet);
    buy.textContent = 'Buy';
  } else {
    setDeskCard(1, 'Duration', fmtDur(state.durations[state.tradeType]), durationSheet);
    setDeskCard(2, 'Stake', euroShort(state.stake), stakeSheet);
    if (state.tradeType === 'digital') {
      const m = market();
      const off = state.strike * strikeStep(m, state.durations.digital);
      setDeskCard(3, 'Strike', state.strike ? `${off > 0 ? '+' : ''}${off.toFixed(m.decimals)}` : 'Spot', strikeSheet);
    } else setDeskCard(3, null);
    buy.textContent = `Buy · +${Math.round(profitRate(state.tradeType, state.dir, state.strike) * 100)}%`;
  }

  // Barra lateral
  const badge = $('#rail-badge');
  badge.hidden = state.open.length === 0;
  badge.textContent = state.open.length;
  $$('.rail-btn').forEach((b) => {
    const on = b.dataset.rail === state.drawer;
    b.classList.toggle('on', on);
    if (b.dataset.rail === 'positions') $('i', b).innerHTML = on ? icons.positionsDeskOn : icons.positionsDesk;
  });
  $('#d-interval').textContent = state.chartMode === 'tick' ? '1t' : state.chartMode === 60 ? '1m' : '5m';
  $('#t-ind').classList.toggle('on', !!chart?.sma);
  renderDrawer();
}

function deskPositionCard(c, live) {
  const d = def(c.market);
  const pl = live ? contractPL(c) : c.pl;
  const card = el('div', 'd-pos');
  card.dataset.id = c.id;
  const info = live
    ? isBinary(c.type)
      ? binaryInfo(c)
      : `x${c.mult} · Entry ${c.entry.toFixed(d.decimals)}`
    : isBinary(c.type)
      ? `Strike ${c.strike.toFixed(d.decimals)} · Exit ${c.exit.toFixed(d.decimals)}`
      : `${c.reason ? `${c.reason[0].toUpperCase()}${c.reason.slice(1)} · ` : ''}Entry ${c.entry.toFixed(d.decimals)}`;
  card.innerHTML = `<span class="sym-ico">${symbolIcon(d.badge)}</span><span class="t1">${d.name}</span><span class="ci">${icons.tradeOutline}</span>
    <span class="t2">${contractName(c)}</span><span class="stake">${num(c.stake)} EUR</span>
    <span class="pl${pl >= 0 ? ' pos' : ''}" data-pl>${signedEur(pl)}</span>
    <span class="t3">${info}</span>`;
  if (live && c.type === 'multipliers') {
    const btn = el('button', 'd-close', 'Close');
    btn.onclick = () => closeContract(c, null);
    card.append(btn);
  }
  return card;
}

const HELP = {
  multipliers: `<h3>Multipliers</h3><p>Choose Up if you think the price will rise or Down if it will fall. Your profit or loss is the market movement multiplied by the multiplier and your stake.</p><p>Your loss never exceeds your stake: when it reaches the stake the position is stopped out at the <b>stop out level</b>. A small commission is charged when you open the position.</p><p>Use risk management to close automatically with a take profit or stop loss.</p>`,
  binary: `<h3>Binary options</h3><p><b>Up / Call</b>: you win if the price at expiry is higher than the entry price. <b>Down / Put</b>: you win if it is lower.</p><p>All or nothing: if you are right at the exact second of expiry you receive your stake plus a fixed profit of 85%. If you are wrong you lose 100% of the stake. If the price is exactly the entry price, your stake is returned.</p>`,
  digital: `<h3>Digital options</h3><p>Like binary options, but you choose a strike price. The payout depends on the distance to the strike: the further the strike is against you, the higher the payout.</p><p>Up wins if the price at expiry is above the strike; Down wins if it is below.</p>`,
  turbo: `<h3>Turbo options</h3><p>Very short binary options, from 30 seconds to 5 minutes, with a fixed profit of 80%. The result is decided by the price at the exact second of expiry.</p>`,
};

function renderDrawer() {
  const dr = $('#drawer');
  dr.hidden = !state.drawer;
  if (!state.drawer) return;
  const body = $('#drawer-body');
  const tabsEl = $('#drawer-tabs');
  const foot = $('#drawer-foot');
  tabsEl.hidden = state.drawer !== 'positions';
  foot.hidden = !['positions', 'reports'].includes(state.drawer);
  const titles = { positions: 'Positions', reports: 'Reports', home: 'Trade types', help: 'Help' };
  $('#drawer-title').textContent = titles[state.drawer];
  $$('#drawer-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === state.posTab));

  if (state.drawer === 'positions' || state.drawer === 'reports') {
    const open = state.drawer === 'positions' && state.posTab === 'open';
    const items = open ? state.open : state.closed;
    body.replaceChildren(...items.map((c) => deskPositionCard(c, open)));
    if (!items.length) body.append(el('div', 'empty', open ? 'You have no open positions.' : 'You have no closed positions yet.'));
  } else if (state.drawer === 'home') {
    body.replaceChildren(
      ...$$('.home-view .home-card').map((src) => {
        const b = src.cloneNode(true);
        b.onclick = () => {
          state.tradeType = b.dataset.type;
          state.drawer = null;
          render();
        };
        return b;
      }),
    );
  } else {
    body.replaceChildren(el('div', 'drawer-text', `${HELP[state.tradeType]}<h3>Demo account</h3><p>Prices are simulated in your browser. The balance has no monetary value.</p>`));
  }
}

function renderDeskLive() {
  // P/L por separador
  for (const t of $$('#d-tabs .d-tab')) {
    const mine = state.open.filter((c) => c.market === t.dataset.id);
    const plEl = $('.d-tab-pl', t);
    plEl.hidden = mine.length === 0;
    if (mine.length) {
      const pl = r2(mine.reduce((s, c) => s + contractPL(c), 0));
      plEl.textContent = euroSym(pl);
      plEl.classList.toggle('pos', pl >= 0);
    }
  }
  // Linhas de detalhe (dependem do preço atual)
  $('#d-rows').replaceChildren(...deskRows().map(([a, b]) => el('div', 'd-row', `<span>${a}</span><span>${b}</span>`)));
  // Relógio GMT
  const now = new Date();
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  $('#d-date').textContent = `${now.getUTCDate()} ${MONTHS[now.getUTCMonth()]} ${now.getUTCFullYear()}`;
  $('#d-time').textContent = `${now.toISOString().slice(11, 19)} GMT`;
  // Gaveta de posições
  if (state.drawer === 'positions' || state.drawer === 'reports') {
    const open = state.drawer === 'positions' && state.posTab === 'open';
    const total = open ? r2(state.open.reduce((s, c) => s + contractPL(c), 0)) : r2(state.closed.reduce((s, c) => s + c.pl, 0));
    const n = open ? state.open.length : state.closed.length;
    $('#drawer-count').textContent = `${n} ${open ? 'open' : 'closed'} position${n === 1 ? '' : 's'}`;
    const tot = $('#drawer-total');
    tot.textContent = signedEur(total);
    tot.classList.toggle('pos', total >= 0);
    if (open) {
      for (const c of state.open) {
        const card = $(`.d-pos[data-id="${c.id}"]`);
        if (!card) continue;
        const pl = contractPL(c);
        const p = $('[data-pl]', card);
        p.textContent = signedEur(pl);
        p.classList.toggle('pos', pl >= 0);
        if (isBinary(c.type)) $('.t3', card).textContent = binaryInfo(c);
      }
    }
  }
}

// Eventos desktop
$$('#d-seg button').forEach((b) => (b.onclick = () => ((state.dir = b.dataset.dir), render())));
$('#d-buy').onclick = buy;
$('#d-plus').onclick = () => {
  openSheet('Add market', (body, close) => {
    for (const d of MARKETS) {
      const b = el('button', `list-item${state.tabs.includes(d.id) ? ' on' : ''}`);
      b.innerHTML = `<span class="sym-ico">${symbolIcon(d.badge)}</span><span>${d.name}</span><span class="price">${feed.markets[d.id].last.quote.toFixed(d.decimals)}</span>`;
      b.onclick = () => (selectMarket(d.id, true), close());
      body.append(b);
    }
  });
};
$('#d-reset').onclick = resetBalance;
$('#d-howto').onclick = () => ((state.drawer = 'help'), render());
$('#drawer-close').onclick = () => ((state.drawer = null), render());
$$('#drawer-tabs button').forEach((b) => (b.onclick = () => ((state.posTab = b.dataset.tab), render())));
$$('.rail-btn').forEach(
  (b) =>
    (b.onclick = () => {
      const r = b.dataset.rail;
      if (r === 'language') {
        return openSheet('Language', (body) => {
          const c = chips([['en', 'English']], 'en', () => {}, 2);
          body.append(c, el('div', 'hint', 'More languages coming soon.'));
        });
      }
      if (r === 'logout') {
        location.href = '../';
        return;
      }
      if (r === 'positions') state.posTab = 'open';
      state.drawer = state.drawer === r ? null : r;
      render();
    }),
);
$('#t-type').onclick = chartSheet;
$('#t-draw').onclick = () => {
  if (!chart) return;
  chart.drawMode = !chart.drawMode;
  $('#t-draw').classList.toggle('on', chart.drawMode);
  if (chart.drawMode) toast('Drawing tool', 'Click on the chart to add a horizontal line.');
};
$('#t-ind').onclick = () => {
  if (!chart) return;
  chart.sma = !chart.sma;
  $('#t-ind').classList.toggle('on', chart.sma);
};
$('#t-dl').onclick = () => chart?.download();
$('#z-in').onclick = () => chart?.setZoom(chart.zoom * 1.25);
$('#z-out').onclick = () => chart?.setZoom(chart.zoom / 1.25);
$('#z-reset').onclick = () => chart?.resetView();
$('#d-fs').onclick = () => {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.().catch(() => {});
};
