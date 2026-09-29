const KEY = 'crash-pixi:balance';
export const START_BALANCE = 1000;

/** Carteira demo (créditos fictícios) guardada no browser quando possível. */
export class Wallet {
  balance: number;
  onChange: ((balance: number) => void) | null = null;

  constructor() {
    this.balance = START_BALANCE;
    try {
      const saved = Number(localStorage.getItem(KEY));
      if (localStorage.getItem(KEY) !== null && Number.isFinite(saved) && saved >= 0) this.balance = saved;
    } catch {
      /* armazenamento indisponível: fica o saldo inicial */
    }
  }

  take(amount: number): boolean {
    if (amount > this.balance + 1e-9) return false;
    this.set(this.balance - amount);
    return true;
  }

  add(amount: number): void {
    this.set(this.balance + amount);
  }

  refill(): void {
    this.set(START_BALANCE);
  }

  private set(v: number): void {
    this.balance = Math.round(v * 100) / 100;
    try {
      localStorage.setItem(KEY, String(this.balance));
    } catch {
      /* ignorar */
    }
    this.onChange?.(this.balance);
  }
}
