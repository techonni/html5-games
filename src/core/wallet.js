import { round2 } from './format.js';

const KEY = 'pixelune.wallet.v1';
const START = 1000;

// Carteira de créditos demo, guardada em localStorage (com fallback em memória).
class Wallet extends EventTarget {
  constructor() {
    super();
    this.balance = START;
    this.history = [];
    try {
      const saved = JSON.parse(localStorage.getItem(KEY));
      if (saved && typeof saved.balance === 'number') {
        this.balance = saved.balance;
        this.history = Array.isArray(saved.history) ? saved.history : [];
      }
    } catch {
      /* armazenamento indisponível */
    }
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ balance: this.balance, history: this.history.slice(0, 50) }));
    } catch {
      /* ignorar */
    }
    this.dispatchEvent(new Event('change'));
  }

  // Retira a aposta; devolve false se não houver saldo.
  bet(amount) {
    amount = round2(amount);
    if (!(amount >= 0) || amount > this.balance + 1e-9) return false;
    this.balance = round2(this.balance - amount);
    this.save();
    return true;
  }

  // Paga a aposta com o multiplicador final e regista no histórico.
  settle(game, amount, multiplier) {
    const payout = round2(amount * multiplier);
    this.balance = round2(this.balance + payout);
    this.history.unshift({ game, amount: round2(amount), multiplier, payout, time: Date.now() });
    this.history.length = Math.min(this.history.length, 50);
    this.save();
    return payout;
  }

  refill() {
    this.balance = START;
    this.save();
  }
}

export const wallet = new Wallet();
