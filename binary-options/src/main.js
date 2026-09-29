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
    await document.fonts?.load("600 15px 'IBM Plex Sans'");
  } catch {
    /* fonte indisponível: usa a alternativa */
  }
  chart = await Chart.create($('#chart'), market());
  chart.setMode(state.chartMode);
  renderLive();
})();
