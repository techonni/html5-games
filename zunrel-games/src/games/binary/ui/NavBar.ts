import { Container, Graphics, Rectangle, type Text } from 'pixi.js';
import gsap from 'gsap';
import { C } from '../theme';
import { makeText } from '../text';
import { sound } from '../audio/Sound';

export type Tab = 'home' | 'trade' | 'positions' | 'menu';

const ICONS: Record<Tab, (g: Graphics, color: number) => void> = {
  home: (g, color) => {
    g.moveTo(-13, -1).lineTo(0, -13).lineTo(13, -1).moveTo(-10, -3).lineTo(-10, 12).lineTo(10, 12).lineTo(10, -3);
    g.stroke({ width: 2.2, color, join: 'round', cap: 'round' });
  },
  trade: (g, color) => {
    g.roundRect(-14, -14, 28, 28, 5).fill(C.btnPrimary);
    g.moveTo(-5, 8).lineTo(-5, -8).moveTo(-9, -4).lineTo(-5, -8).lineTo(-1, -4);
    g.moveTo(5, -8).lineTo(5, 8).moveTo(1, 4).lineTo(5, 8).lineTo(9, 4);
    g.stroke({ width: 2.2, color, join: 'round', cap: 'round' });
  },
  positions: (g, color) => {
    g.circle(0, 0, 13).moveTo(0, -7).lineTo(0, 0).lineTo(5, 3);
    g.stroke({ width: 2.2, color, join: 'round', cap: 'round' });
  },
  menu: (g, color) => {
    for (const y of [-8, 0, 8]) g.moveTo(-13, y).lineTo(13, y);
    g.stroke({ width: 2.2, color, cap: 'round' });
  },
};

const LABELS: Record<Tab, string> = { home: 'Início', trade: 'Negociar', positions: 'Posições', menu: 'Menu' };

/** Barra de navegação inferior com 4 separadores. */
export class NavBar extends Container {
  static readonly HEIGHT = 76;
  /** Altura em modo horizontal (separadores no topo, computador). */
  static readonly ROW_H = 56;
  onSelect: ((tab: Tab) => void) | null = null;
  active: Tab = 'trade';
  private readonly bg = new Graphics();
  private readonly items: { tab: Tab; view: Container; icon: Graphics; label: Text; w: number }[] = [];
  private readonly badge = new Container();
  private readonly badgeText: Text;
  private readonly pill = new Graphics();
  private horizontal = false;

  constructor() {
    super();
    this.addChild(this.bg, this.pill);
    for (const tab of Object.keys(ICONS) as Tab[]) {
      const view = new Container();
      const icon = new Graphics();
      const label = makeText(LABELS[tab], { fontSize: 15, fontWeight: '600', fill: C.textMuted });
      label.anchor.set(0.5, 0);
      label.y = 22;
      view.addChild(icon, label);
      view.eventMode = 'static';
      view.cursor = 'pointer';
      view.on('pointertap', () => this.select(tab));
      this.addChild(view);
      this.items.push({ tab, view, icon, label, w: 0 });
    }
    this.badge.addChild(new Graphics().circle(0, 0, 10).fill(C.down));
    this.badgeText = makeText('', { fontSize: 12, fontWeight: '800', fill: C.text });
    this.badgeText.anchor.set(0.5);
    this.badge.addChild(this.badgeText);
    this.badge.visible = false;
    this.items[2].view.addChild(this.badge);
    this.badge.position.set(14, -12);
    this.paint();
  }

  layout(screenW: number, contentX: number, contentW: number, horizontal = false): void {
    this.horizontal = horizontal;
    if (horizontal) {
      // Linha de separadores: ícone + texto lado a lado, pílula no ativo.
      this.bg.clear().rect(0, 0, screenW, NavBar.ROW_H).fill(C.bgBase).rect(0, NavBar.ROW_H - 1, screenW, 1).fill(C.border);
      let x = contentX;
      for (const it of this.items) {
        it.label.anchor.set(0, 0.5);
        it.label.position.set(18, 0);
        const w = 18 + it.label.width + 28;
        it.view.position.set(x + 16, NavBar.ROW_H / 2);
        it.view.hitArea = new Rectangle(-16, -22, w + 4, 44);
        it.w = w;
        x += w + 12;
      }
    } else {
      this.bg.clear().rect(0, 0, screenW, NavBar.HEIGHT + 40).fill(C.bgBase).rect(0, 0, screenW, 1).fill(C.border);
      const cell = contentW / this.items.length;
      this.items.forEach((it, i) => {
        it.label.anchor.set(0.5, 0);
        it.label.position.set(0, 22);
        it.view.position.set(contentX + cell * (i + 0.5), 28);
        it.view.hitArea = new Rectangle(-cell / 2, -28, cell, NavBar.HEIGHT);
      });
    }
    this.paint();
  }

  setOpenCount(n: number): void {
    const was = this.badge.visible ? Number(this.badgeText.text) : 0;
    this.badge.visible = n > 0;
    this.badgeText.text = String(n);
    if (n > was) gsap.fromTo(this.badge.scale, { x: 0.3, y: 0.3 }, { x: 1, y: 1, duration: 0.4, ease: 'back.out(3)' });
  }

  select(tab: Tab, silent = false): void {
    if (!silent) sound.play('click');
    this.active = tab;
    this.paint();
    const it = this.items.find((i) => i.tab === tab);
    if (it && !silent) gsap.fromTo(it.icon.scale, { x: 0.8, y: 0.8 }, { x: 1, y: 1, duration: 0.35, ease: 'back.out(3)' });
    this.onSelect?.(tab);
  }

  private paint(): void {
    for (const it of this.items) {
      const on = it.tab === this.active;
      it.icon.clear();
      if (it.tab === 'trade') {
        if (on) ICONS.trade(it.icon, C.text);
        else {
          it.icon.moveTo(-5, 8).lineTo(-5, -8).moveTo(-9, -4).lineTo(-5, -8).lineTo(-1, -4);
          it.icon.moveTo(5, -8).lineTo(5, 8).moveTo(1, 4).lineTo(5, 8).lineTo(9, 4);
          it.icon.stroke({ width: 2.2, color: C.textMuted, join: 'round', cap: 'round' });
        }
      } else ICONS[it.tab](it.icon, on ? C.text : C.textMuted);
      it.label.style.fill = on ? C.text : C.textMuted;
      if (this.horizontal) it.icon.scale.set(0.75);
      else it.icon.scale.set(1);
    }
    this.pill.clear();
    if (this.horizontal) {
      const it = this.items.find((i) => i.tab === this.active);
      if (it) {
        this.pill.roundRect(it.view.x - 16, NavBar.ROW_H / 2 - 20, it.w + 4, 40, 20).fill(C.bgPanel);
      }
    }
  }
}
