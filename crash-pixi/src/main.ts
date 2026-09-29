import { Application, Container, Graphics, type Text } from 'pixi.js';
import gsap from 'gsap';
import { C, R } from './theme';
import { makeText, setTextResolution } from './text';
import { coinIcon } from './icons';
import { clamp, floor2, fmt, fmtMult } from './format';
import { CrashEngine, type Phase } from './game/CrashEngine';
import { CrashView } from './game/CrashView';
import { Wallet } from './game/Wallet';
import { ControlsPanel } from './ui/ControlsPanel';
import { Keypad } from './ui/Keypad';
import { Toast } from './ui/Toast';

interface Bet {
  amount: number;
  target: number;
  cashed: boolean;
}

const HEADER_H = 64;
const PAD = 16;
const MIN_TARGET = 1.01;
const MAX_TARGET = 1_000_000;

class CrashApp {
  private readonly app = new Application();
  private readonly root = new Container();
  private readonly header = new Container();
  private readonly headerBg = new Graphics();
  private readonly logo: Text;
  private readonly balancePill = new Container();
  private readonly balanceBg = new Graphics();
  private readonly balanceText: Text;
  private readonly card = new Graphics();
  private readonly view = new CrashView();
  private readonly panel: ControlsPanel;
  private readonly keypad = new Keypad();
  private readonly toast = new Toast();

  private readonly wallet = new Wallet();
  private readonly engine: CrashEngine;
  private shownBalance = { v: 0 };

  private amount = 1;
  private target = 2;
  private bet: Bet | null = null;
  private queued: { amount: number; target: number } | null = null;
  private autoOn = false;
  private profit = 0;

  constructor() {
    this.engine = new CrashEngine({
      phase: (p) => this.onPhase(p),
      tick: (m) => this.onTick(m),
    });
    this.logo = makeText('zunrel', { fontSize: 30, fontWeight: '800', fontStyle: 'italic', fill: C.text, letterSpacing: -1 });
    this.logo.anchor.set(0, 0.5);
    this.balanceText = makeText('', { fontSize: 17, fontWeight: '700', fill: C.text });
    this.balanceText.anchor.set(1, 0.5);

    this.panel = new ControlsPanel(
      [
        { label: '½', onTap: () => this.setAmount(this.amount / 2) },
        { label: '2×', onTap: () => this.setAmount(Math.min(this.amount * 2, this.wallet.balance)) },
      ],
      [
        { icon: 'down', onTap: () => this.stepTarget(-1) },
        { icon: 'up', onTap: () => this.stepTarget(1) },
      ],
    );
  }

  async start(): Promise<void> {
    await this.app.init({
      resizeTo: window,
      background: C.bgBase,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
    });
    document.body.appendChild(this.app.canvas);
    this.app.stage.addChild(this.root);

    this.buildHeader();
    this.root.addChild(this.card, this.view, this.panel, this.header, this.toast, this.keypad);

    this.panel.play.onTap = () => this.onPlay();
    this.panel.mode.onChange = (i) => {
      if (i === 0) this.autoOn = false;
      this.refresh();
    };
    this.panel.amount.onFocus = () => this.edit('amount');
    this.panel.cashout.onFocus = () => this.edit('cashout');

    this.wallet.onChange = (b) => this.animateBalance(b);
    this.shownBalance.v = this.wallet.balance;
    this.balanceText.text = fmt(this.wallet.balance);

    this.setAmount(Math.min(1, this.wallet.balance));
    this.setTarget(2);
    this.layout();
    window.addEventListener('resize', () => requestAnimationFrame(() => this.layout()));
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !this.keypad.isOpen) {
        e.preventDefault();
        this.onPlay();
      }
    });

    this.view.enterCountdown();
    this.view.setRound(this.engine.round, this.profit);
    this.app.ticker.add((t) => this.update(t.deltaMS));
    this.refresh();
  }

  private buildHeader(): void {
    this.balancePill.addChild(this.balanceBg, this.balanceText);
    const coin = coinIcon(24);
    coin.label = 'coin';
    this.balancePill.addChild(coin);
    this.balancePill.eventMode = 'static';
    this.balancePill.cursor = 'pointer';
    this.balancePill.on('pointertap', () => {
      if (this.wallet.balance < 1 && !this.bet && !this.queued) {
        this.wallet.refill();
        this.toast.show('Saldo demo reposto', C.btnPrimary);
      } else {
        this.toast.show('Créditos demo — sem dinheiro real');
      }
    });
    this.header.addChild(this.headerBg, this.logo, this.balancePill);
  }

  /** Layout responsivo: coluna única no telemóvel, duas colunas em ecrãs largos. */
  private layout(): void {
    const sw = window.innerWidth;
    const sh = window.innerHeight;
    const wide = sw / sh > 1.05 && sw >= 700;
    const designH = wide ? 680 : 800;
    let scale = sw / 400;
    if (wide || sh / scale < designH) scale = sh / designH;
    const W = sw / scale;
    const H = sh / scale;
    this.root.scale.set(scale);
    setTextResolution(Math.min(window.devicePixelRatio || 1, 2) * scale);

    const contentW = Math.min(W, wide ? 1180 : 480);
    const ox = (W - contentW) / 2;

    // Cabeçalho
    this.headerBg.clear().rect(0, 0, W, HEADER_H).fill(C.bgBase);
    this.logo.position.set(ox + PAD + 4, HEADER_H / 2);
    this.layoutBalance(ox + contentW - PAD);

    const top = HEADER_H + 4;
    const bottom = H - PAD;
    this.card.clear();
    if (wide) {
      const panelW = 360;
      const cardH = bottom - top;
      this.card.roundRect(ox + PAD, top, panelW, cardH, R.panel).fill(C.bgPanel);
      this.panel.position.set(ox + PAD * 2, top + PAD);
      this.panel.layout(panelW - PAD * 2);
      this.view.position.set(ox + PAD + panelW + 12, top);
      this.view.layout(contentW - PAD * 2 - panelW - 12, cardH, false);
    } else {
      const panelH = ControlsPanel.HEIGHT + PAD * 2;
      const stageH = Math.max(260, bottom - top - panelH);
      const cardW = contentW - PAD * 2;
      this.card.roundRect(ox + PAD, top, cardW, stageH + panelH, R.panel).fill(C.bgPanel);
      this.view.position.set(ox + PAD, top);
      this.view.layout(cardW, stageH, true);
      this.panel.position.set(ox + PAD * 2, top + stageH + PAD);
      this.panel.layout(cardW - PAD * 2);
    }
    this.toast.position.set(this.view.x + this.view.stageWidth / 2, this.view.y + this.view.noticeY);
    this.keypad.layout(W, H, ox, contentW);
  }

  private layoutBalance(right: number): void {
    const w = Math.max(130, this.balanceText.width + 64);
    const h = 44;
    this.balanceBg.clear().roundRect(-w, -h / 2, w, h, R.input).fill(C.bgInput);
    this.balanceText.position.set(-16, 0);
    const coin = this.balancePill.getChildByLabel('coin');
    if (coin) coin.position.set(-w + 24, 0);
    this.balancePill.position.set(right, HEADER_H / 2);
  }

  private animateBalance(to: number): void {
    gsap.to(this.shownBalance, {
      v: to,
      duration: 0.6,
      ease: 'power2.out',
      onUpdate: () => {
        this.balanceText.text = fmt(this.shownBalance.v);
        this.layoutBalance(this.balancePill.x);
      },
    });
    gsap.fromTo(this.balancePill.scale, { x: 1.06, y: 1.06 }, { x: 1, y: 1, duration: 0.4, ease: 'back.out(3)' });
  }

  // ---------- Ciclo de jogo ----------

  private update(dt: number): void {
    this.engine.update(Math.min(dt, 100));
    const e = this.engine;
    if (e.phase === 'countdown') this.view.updateCountdown(e.remaining, e.countdownMs);
    else if (e.phase === 'running') this.view.updateRunning(e.flightMs, e.multiplier);
  }

  private onPhase(p: Phase): void {
    const e = this.engine;
    if (p === 'countdown') {
      this.view.enterCountdown();
      this.view.setRound(e.round, this.profit);
      if (this.queued) {
        this.bet = { ...this.queued, cashed: false };
        this.queued = null;
      } else if (this.autoOn) {
        this.placeBet();
      }
    } else if (p === 'running') {
      this.view.enterRunning();
    } else {
      this.view.enterCrashed(e.flightMs, e.multiplier);
      this.view.history.push(e.multiplier);
      if (this.bet && !this.bet.cashed) {
        this.settle(-this.bet.amount);
        if (this.bet.amount > 0) this.toast.show(`Perdeste ${fmt(this.bet.amount)}`, C.loss);
      }
      this.bet = null;
    }
    this.refresh();
  }

  private onTick(m: number): void {
    const b = this.bet;
    if (b && !b.cashed && b.target >= MIN_TARGET && m >= b.target) this.cashOut(b.target);
    else if (b && !b.cashed) this.panel.play.setText(`Retirar ${fmt(floor2(b.amount * m))}`);
  }

  private cashOut(m: number): void {
    const b = this.bet;
    if (!b || b.cashed || this.engine.phase !== 'running') return;
    b.cashed = true;
    const payout = floor2(b.amount * m);
    this.wallet.add(payout);
    this.settle(payout - b.amount);
    this.view.popCashout(`${fmtMult(m)}  +${fmt(payout)}`);
    this.toast.show(`Ganhaste ${fmt(payout)} · ${fmtMult(m)}`, C.win, C.winText);
    this.refresh();
  }

  private settle(delta: number): void {
    this.profit = Math.round((this.profit + delta) * 100) / 100;
    this.view.setRound(this.engine.round, this.profit);
  }

  /** Desconta a aposta; devolve false se não houver saldo. */
  private reserve(): boolean {
    if (this.wallet.take(this.amount)) return true;
    this.panel.amount.shake();
    this.toast.show('Saldo insuficiente', C.loss);
    return false;
  }

  private placeBet(): void {
    if (!this.reserve()) {
      this.autoOn = false;
      return;
    }
    const bet = { amount: this.amount, target: this.target };
    if (this.engine.phase === 'countdown') this.bet = { ...bet, cashed: false };
    else this.queued = bet;
  }

  private onPlay(): void {
    const phase = this.engine.phase;
    if (this.panel.mode.index === 1) {
      this.autoOn = !this.autoOn;
      if (this.autoOn && phase === 'countdown' && !this.bet) this.placeBet();
      if (!this.autoOn && this.queued) this.cancelQueued();
    } else if (phase === 'countdown' && this.bet) {
      this.wallet.add(this.bet.amount);
      this.bet = null;
    } else if (phase === 'running' && this.bet && !this.bet.cashed) {
      this.cashOut(this.engine.multiplier);
    } else if (this.queued) {
      this.cancelQueued();
    } else if (!(phase === 'countdown' && this.bet)) {
      this.placeBet();
    }
    this.refresh();
  }

  private cancelQueued(): void {
    if (!this.queued) return;
    this.wallet.add(this.queued.amount);
    this.queued = null;
  }

  /** Atualiza o botão principal e bloqueia campos durante uma aposta ativa. */
  private refresh(): void {
    const { play, amount, cashout, mode } = this.panel;
    const phase = this.engine.phase;
    const b = this.bet;
    let label: string;
    let secondary = false;

    if (mode.index === 1) {
      label = this.autoOn ? 'Parar auto' : 'Iniciar auto';
      secondary = this.autoOn;
    } else if (phase === 'running' && b && !b.cashed) {
      label = `Retirar ${fmt(floor2(b.amount * this.engine.multiplier))}`;
    } else if (phase === 'countdown' && b) {
      label = 'Cancelar aposta';
      secondary = true;
    } else if (this.queued) {
      label = 'Cancelar próxima ronda';
      secondary = true;
    } else {
      label = phase === 'countdown' ? 'Apostar' : 'Jogar próxima ronda';
    }
    play.setText(label);
    play.setColor(secondary ? C.btnSecondary : C.btnPrimary);

    const busy = this.autoOn || !!this.queued || (!!b && !b.cashed);
    amount.setLocked(busy);
    cashout.setLocked(busy);
    mode.setLocked(busy);
  }

  // ---------- Valores ----------

  private setAmount(v: number): void {
    this.amount = clamp(floor2(Number.isFinite(v) ? v : 0), 0, 1e9);
    this.panel.amount.setValue(fmt(this.amount));
    this.updateGain();
  }

  private setTarget(v: number): void {
    this.target = clamp(Math.round((Number.isFinite(v) ? v : 2) * 100) / 100, MIN_TARGET, MAX_TARGET);
    this.panel.cashout.setValue(this.target.toFixed(2));
    this.updateGain();
  }

  private stepTarget(dir: 1 | -1): void {
    const v = this.target;
    const step = dir > 0 ? (v < 2 ? 0.1 : v < 10 ? 0.5 : 1) : v <= 2 ? 0.1 : v <= 10 ? 0.5 : 1;
    this.setTarget(v + dir * step);
  }

  private updateGain(): void {
    this.panel.gain.setValue(fmt(floor2(this.amount * (this.target - 1))));
  }

  private edit(which: 'amount' | 'cashout'): void {
    const field = which === 'amount' ? this.panel.amount : this.panel.cashout;
    const current = which === 'amount' ? this.amount.toFixed(2) : this.target.toFixed(2);
    field.setFocused(true);
    this.keypad.open({
      title: which === 'amount' ? 'Montante' : 'Retirar em (×)',
      value: current,
      onChange: (s) => {
        const n = Number(s || '0');
        if (which === 'amount') {
          this.amount = floor2(n);
          field.setValue(s || '0');
          this.updateGain();
        } else {
          field.setValue(s || '0');
          this.target = n;
          this.updateGain();
        }
      },
      onClose: () => {
        field.setFocused(false);
        if (which === 'amount') this.setAmount(this.amount);
        else this.setTarget(this.target);
      },
    });
  }
}

void new CrashApp().start();
