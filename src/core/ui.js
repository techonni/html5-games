import { wallet } from './wallet.js';
import { money, round2 } from './format.js';

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null) el.append(c);
  return el;
}

export function toast(message, type = 'info') {
  const box = document.getElementById('toasts');
  const t = h('div', { class: `toast toast-${type}` }, message);
  box.append(t);
  setTimeout(() => t.classList.add('out'), 2600);
  setTimeout(() => t.remove(), 3000);
}

export function field(label, control, extra) {
  return h('label', { class: 'field' }, h('span', { class: 'field-label' }, h('span', {}, label), extra ?? null), control);
}

// Campo de montante da aposta com ½ e 2×.
export function betAmount(initial = 1) {
  const input = h('input', { class: 'input', type: 'number', min: '0', step: '0.01', value: initial.toFixed(2), inputmode: 'decimal' });
  const clamp = (v) => round2(Math.max(0, Math.min(v, wallet.balance)));
  const half = h('button', { class: 'chip', type: 'button', onclick: () => (input.value = clamp(value() / 2).toFixed(2)) }, '½');
  const dbl = h('button', { class: 'chip', type: 'button', onclick: () => (input.value = clamp(value() * 2 || 0.01).toFixed(2)) }, '2×');
  const value = () => round2(Math.max(0, parseFloat(input.value) || 0));
  input.addEventListener('change', () => (input.value = value().toFixed(2)));
  const hint = h('span', { class: 'field-hint' }, '');
  const syncHint = () => (hint.textContent = money(value()));
  input.addEventListener('input', syncHint);
  syncHint();
  const el = field('Montante da aposta', h('div', { class: 'input-group' }, h('span', { class: 'coin' }), input, half, dbl), hint);
  return {
    el,
    get value() {
      return value();
    },
    set disabled(d) {
      input.disabled = half.disabled = dbl.disabled = d;
    },
  };
}

export function select(options, value, onChange) {
  const el = h('select', { class: 'input' }, options.map(([v, l]) => h('option', { value: v, selected: String(v) === String(value) }, l)));
  el.addEventListener('change', () => onChange?.(el.value));
  return el;
}

export function segmented(options, value, onChange) {
  const el = h('div', { class: 'segmented' });
  const buttons = options.map(([v, l]) => {
    const b = h('button', { type: 'button', class: String(v) === String(value) ? 'on' : '' }, l);
    b.addEventListener('click', () => {
      if (el.dataset.disabled) return;
      buttons.forEach((x) => x.classList.toggle('on', x === b));
      onChange?.(v);
    });
    el.append(b);
    return b;
  });
  return {
    el,
    set disabled(d) {
      if (d) el.dataset.disabled = '1';
      else delete el.dataset.disabled;
      buttons.forEach((b) => (b.disabled = d));
    },
  };
}

export function readout(label, initial = '') {
  const input = h('input', { class: 'input', readonly: true, value: initial, tabindex: '-1' });
  return { el: field(label, input), set: (v) => (input.value = v) };
}

// Valida e desconta a aposta; mostra erro se não houver saldo.
export function takeBet(amount) {
  if (amount <= 0) {
    toast('Indica um montante superior a 0.', 'error');
    return false;
  }
  if (!wallet.bet(amount)) {
    toast('Saldo insuficiente. Usa "Repor" para recarregar os créditos demo.', 'error');
    return false;
  }
  return true;
}
