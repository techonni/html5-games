import { Container, Graphics, type Text } from 'pixi.js';
import gsap from 'gsap';
import { C } from './theme';
import { makeText } from './text';
import type { GameScene } from '../../core/scene';
import { clamp, fmt, fmtDuration, fmtEur, fmtSigned } from './format';
import { sound } from './audio/Sound';
import { Feed } from './market/Market';
import { Book, TRADE_TYPES, type Direction, type Position } from './market/Trades';
import { Button } from './ui/Button';
import { Keypad } from './ui/Keypad';
import { NavBar, type Tab } from './ui/NavBar';
import { Sheet } from './ui/Sheet';
import { Toast } from './ui/Toast';
import { HomeView } from './views/HomeView';
import { MenuView } from './views/MenuView';
import { PositionsView } from './views/PositionsView';
import { TradeView } from './views/TradeView';

const HEADER_H = 88;
const PAD = 16;
const MIN_STAKE = 1;
const MAX_STAKE = 2000;

/** zunrel Binary embutido no site. */
export class BinaryGame implements GameScene {
  readonly view = new Container();
  private readonly root = this.view;
  private active = false;
  private readonly feed = new Feed();
  private readonly book = new Book(this.feed);

  private readonly header = new Container();
  private readonly headerBg = new Graphics();
  private readonly avatar = new Container();
  private readonly accountLabel: Text;
  private readonly balanceText: Text;
  private readonly resetBtn = new Button({ label: 'Repor', width: 104, height: 52, color: C.btnSecondary, fontSize: 18 });
  private readonly shown = { v: 0 };

  private readonly trade = new TradeView();
  private readonly positions: PositionsView;
  private readonly home: HomeView;
  private readonly menu = new MenuView();
  private readonly nav = new NavBar();
  private readonly sheet = new Sheet();
  private readonly keypad = new Keypad();
  private readonly toast = new Toast();

  private tab: Tab = 'trade';
  private marketId = 'EURUSD';
  private typeIdx = 0;
  private dir: Direction = 'up';
  private durations: Record<string, number> = { binary: 60, turbo: 30 };
  private stake = 2;

  constructor() {
    this.positions = new PositionsView(this.feed, this.book);
    this.home = new HomeView(this.feed);
    this.accountLabel = makeText('Conta demo', { fontSize: 16, fontWeight: '500', fill: C.textMuted });
    this.balanceText = makeText('', { fontSize: 23, fontWeight: '700', fill: C.text });
    this.setup();
  }

  private get type() {
    return TRADE_TYPES[this.typeIdx];
  }

  /** Monta a cena (chamado uma vez, logo após o construtor). */
  private setup(): void {
    const av = new Graphics().roundRect(0, 0, 50, 50, 12).fill(C.btnPrimary);
    const avT = makeText('ZB', { fontSize: 20, fontWeight: '800', fill: C.text });
    avT.anchor.set(0.5);
    avT.position.set(25, 25);
    this.avatar.addChild(av, avT);
    this.header.addChild(this.headerBg, this.avatar, this.accountLabel, this.balanceText, this.resetBtn);
    this.resetBtn.onTap = () => this.resetAccount();

    this.root.addChild(this.home, this.trade, this.positions, this.menu, this.header, this.nav, this.toast, this.sheet, this.keypad);
    this.wire();
    this.shown.v = this.book.balance;
    this.balanceText.text = `${fmt(this.book.balance)} EUR`;

    this.showTab('trade', false);
    this.syncTrade();
  }

  resize(width: number, height: number): void {
    this.layout(width, height);
  }

  setActive(active: boolean): void {
    this.active = active;
  }

  /** O mercado continua a correr fora do ecrã para liquidar contratos a tempo. */
  update(_dt: number, active: boolean): void {
    this.feed.update();
    if (active && this.tab === 'trade') this.trade.chart.draw();
  }

  private wire(): void {
    const t = this.trade;
    t.onPickMarket = () => this.pickMarket();
    t.onPickType = () =>
      this.sheet.open(
        'Tipo de contrato',
        TRADE_TYPES.map((ty, i) => ({ label: ty.name, sub: `Lucro +${Math.round(ty.profit * 100)}%`, selected: i === this.typeIdx })),
        (i) => {
          this.typeIdx = i;
          this.syncTrade();
        },
      );
    t.dir.onChange = (i) => {
      this.dir = i === 0 ? 'up' : 'down';
      sound.play(i === 0 ? 'up' : 'down');
    };
    t.duration.onTap = () =>
      this.sheet.open(
        `Duração · ${this.type.name}`,
        this.type.durations.map((d) => ({ label: fmtDuration(d), selected: d === this.durations[this.type.id] })),
        (i) => {
          this.durations[this.type.id] = this.type.durations[i];
          this.syncTrade();
        },
      );
    t.stake.onTap = () => this.editStake();
    t.buy.onTap = () => this.buy();

    this.nav.onSelect = (tab) => this.showTab(tab, true);
    this.home.onSelect = (id) => {
      this.selectMarket(id);
      this.nav.select('trade', true);
    };
    this.menu.onReset = () => this.resetAccount();

    this.feed.onTick = (sec) => this.onSecond(sec);
    this.book.onSettle = (p) => this.onSettle(p);
    this.book.onChange = () => {
      this.animateBalance();
      this.nav.setOpenCount(this.book.open.length);
      this.trade.chart.setPositions(this.book.open);
    };

    window.addEventListener('keydown', (e) => {
      if (!this.active || this.keypad.isOpen || this.sheet.isOpen || this.tab !== 'trade') return;
      if (e.key === 'ArrowUp') this.trade.dir.select(0);
      else if (e.key === 'ArrowDown') this.trade.dir.select(1);
      else if (e.key === 'Enter') this.buy();
    });
  }

  /** Layout em coluna (estilo app), centrado em ecrãs largos. */
  /** Telemóvel: coluna com barra inferior. Computador: separadores no topo e painel ao lado do gráfico. */
  private layout(sw: number, sh: number): void {
    const wide = sw >= 900 && sw / sh > 1.1;
    let scale: number;
    if (wide) scale = Math.min(1.15, Math.max(0.75, sh / 820));
    else {
      scale = sw / 400;
      if (sh / scale < 760) scale = sh / 760;
    }
    const W = sw / scale;
    const H = sh / scale;
    this.root.scale.set(scale);

    const contentW = Math.min(W, wide ? 1200 / scale : 480);
    const ox = (W - contentW) / 2;
    const innerW = contentW - PAD * 2;

    this.headerBg.clear().rect(0, 0, W, HEADER_H).fill(C.bgBase);
    this.avatar.position.set(ox + PAD + 4, 18);
    this.accountLabel.position.set(ox + PAD + 70, 16);
    this.balanceText.position.set(ox + PAD + 70, 40);
    this.resetBtn.position.set(ox + contentW - PAD - 104, 18);

    let top = HEADER_H;
    let bottom = H - NavBar.HEIGHT - 12;
    if (wide) {
      this.nav.position.set(0, HEADER_H);
      this.nav.layout(W, ox + PAD, innerW, true);
      top = HEADER_H + NavBar.ROW_H + 16;
      bottom = H - PAD;
    } else {
      this.nav.position.set(0, H - NavBar.HEIGHT);
      this.nav.layout(W, ox, contentW);
    }
    // Listas e menu ficam legíveis no computador (largura limitada, centradas).
    const listW = wide ? Math.min(innerW, 760) : innerW;
    const listX = ox + PAD + (innerW - listW) / 2;
    this.trade.position.set(ox + PAD, top);
    for (const v of [this.positions, this.home, this.menu]) v.position.set(listX, top);
    this.trade.layout(innerW, bottom - top, wide);
    this.positions.layout(listW, bottom - top);
    this.home.layout(listW, bottom - top);
    this.menu.layout(listW);

    const sheetW = Math.min(contentW, 480);
    const sheetX = (W - sheetW) / 2;
    this.toast.position.set(W / 2, top + 72 + 44);
    this.sheet.layout(W, H, sheetX, sheetW);
    this.keypad.layout(W, H, sheetX, sheetW);
  }


  private showTab(tab: Tab, animate: boolean): void {
    this.tab = tab;
    const views: Record<Tab, Container> = { trade: this.trade, positions: this.positions, home: this.home, menu: this.menu };
    for (const [k, v] of Object.entries(views)) v.visible = k === tab;
    if (tab === 'positions') this.positions.refresh();
    if (tab === 'home') this.home.refresh();
    if (animate) gsap.fromTo(views[tab], { alpha: 0 }, { alpha: 1, duration: 0.25 });
  }

  private pickMarket(): void {
    this.sheet.open(
      'Mercados',
      this.feed.markets.map((m) => ({ label: m.def.name, badge: m.def.badge, sub: m.last.q.toFixed(m.def.decimals), selected: m.id === this.marketId })),
      (i) => this.selectMarket(this.feed.markets[i].id),
    );
  }

  private selectMarket(id: string): void {
    this.marketId = id;
    this.syncTrade();
  }

  /** Aplica mercado / tipo / duração / aposta aos componentes. */
  private syncTrade(): void {
    const m = this.feed.get(this.marketId);
    const ty = this.type;
    if (!ty.durations.includes(this.durations[ty.id])) this.durations[ty.id] = ty.durations[0];
    this.trade.setMarket(m.def.name, m.def.badge);
    this.trade.setType(ty.name);
    this.trade.chart.setMarket(m);
    this.trade.chart.setPositions(this.book.open);
    this.trade.duration.setValue(fmtDuration(this.durations[ty.id]));
    this.trade.stake.setValue(`€${fmt(this.stake).replace(/\.00$/, '')}`);
    this.trade.payout.setValue(fmtEur(this.stake * (1 + ty.profit)));
    this.trade.buy.setText(`Comprar · +${Math.round(ty.profit * 100)}%`);
  }

  private editStake(): void {
    let value = this.stake;
    this.keypad.open({
      title: 'Aposta (EUR)',
      value: String(this.stake),
      onChange: (s) => {
        value = Number(s || '0');
        this.trade.stake.setValue(`€${s || '0'}`);
        this.trade.payout.setValue(fmtEur(value * (1 + this.type.profit)));
      },
      onClose: () => {
        if (value < MIN_STAKE || value > MAX_STAKE) {
          sound.play('error');
          this.toast.show(`Aposta entre €${MIN_STAKE} e €${fmt(MAX_STAKE)}`, C.loss);
        }
        this.stake = clamp(Math.round(value * 100) / 100, MIN_STAKE, MAX_STAKE);
        this.syncTrade();
      },
    });
  }

  private buy(): void {
    const p = this.book.buy(this.marketId, this.type, this.dir, this.stake, this.durations[this.type.id]);
    if (!p) {
      sound.play('error');
      this.toast.show('Saldo insuficiente', C.loss);
      return;
    }
    sound.play('buy');
    this.toast.show(`${p.dir === 'up' ? '▲ Sobe' : '▼ Desce'} · ${fmtEur(p.stake)} · ${fmtDuration(p.expiry - p.start)}`, C.btnPrimary);
  }

  private onSecond(sec: number): void {
    this.book.settleDue(sec);
    const m = this.feed.get(this.marketId);
    if (m.last.t === sec) this.trade.chart.onTick();
    if (this.active && this.book.open.some((p) => p.expiry - sec <= 3 && p.expiry - sec > 0)) sound.play('beep', 0.6);
    if (this.tab === 'home') this.home.refresh();
    if (this.tab === 'positions') this.positions.refresh();
  }

  private onSettle(p: Position): void {
    if (p.result === 'win') {
      sound.play('win');
      this.toast.show(`Ganhaste ${fmtSigned(p.pnl ?? 0)} EUR`, C.win, C.winText);
    } else if (p.result === 'loss') {
      sound.play('loss');
      this.toast.show(`Perdeste ${fmtEur(p.stake)}`, C.loss);
    } else {
      sound.play('tie');
      this.toast.show('Empate · aposta devolvida');
    }
  }

  private resetAccount(): void {
    this.book.reset();
    this.toast.show('Saldo demo reposto: 10,000.00 EUR', C.btnPrimary);
  }

  private animateBalance(): void {
    gsap.to(this.shown, {
      v: this.book.balance,
      duration: 0.6,
      ease: 'power2.out',
      onUpdate: () => (this.balanceText.text = `${fmt(this.shown.v)} EUR`),
    });
  }
}


