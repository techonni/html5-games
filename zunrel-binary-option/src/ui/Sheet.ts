import { Container, Graphics, Rectangle, type Text } from 'pixi.js';
import gsap from 'gsap';
import { C, R } from '../theme';
import { makeText } from '../text';
import { sound } from '../audio/Sound';

export interface SheetRow {
  label: string;
  sub?: string;
  badge?: string;
  selected?: boolean;
}

const ROW_H = 60;

/** Folha inferior com uma lista de opções (mercados, tipo, duração, intervalo). */
export class Sheet extends Container {
  isOpen = false;
  private readonly backdrop = new Graphics();
  private readonly panel = new Container();
  private readonly bg = new Graphics();
  private readonly title: Text;
  private readonly rows = new Container();
  private screenH = 800;
  private contentW = 400;
  private panelH = 200;
  private onPick: ((i: number) => void) | null = null;

  constructor() {
    super();
    this.visible = false;
    this.backdrop.eventMode = 'static';
    this.backdrop.on('pointertap', () => this.close());
    this.panel.eventMode = 'static';
    this.title = makeText('', { fontSize: 18, fontWeight: '700', fill: C.text });
    this.panel.addChild(this.bg, this.title, this.rows);
    this.addChild(this.backdrop, this.panel);
  }

  layout(screenW: number, screenH: number, contentX: number, contentW: number): void {
    this.screenH = screenH;
    this.contentW = contentW;
    this.backdrop.clear().rect(0, 0, screenW, screenH).fill({ color: 0x000000, alpha: 0.55 });
    this.backdrop.hitArea = new Rectangle(0, 0, screenW, screenH);
    this.panel.x = contentX;
    if (this.isOpen) this.panel.y = screenH - this.panelH;
  }

  open(title: string, items: SheetRow[], onPick: (i: number) => void): void {
    this.onPick = onPick;
    this.title.text = title;
    this.rows.removeChildren().forEach((c) => c.destroy({ children: true }));
    const w = this.contentW;
    const px = 16;
    items.forEach((it, i) => {
      const row = new Container();
      const bg = new Graphics().roundRect(0, 0, w - px * 2, ROW_H - 8, R.input).fill(it.selected ? C.bgAddon : C.bgInput);
      row.addChild(bg);
      let x = 16;
      if (it.badge) {
        const b = new Graphics().roundRect(x, 12, 44, 28, 8).fill(C.btnSecondary);
        const bt = makeText(it.badge, { fontSize: 13, fontWeight: '700', fill: C.text });
        bt.anchor.set(0.5);
        bt.position.set(x + 22, 26);
        row.addChild(b, bt);
        x += 58;
      }
      const label = makeText(it.label, { fontSize: 16, fontWeight: '600', fill: C.text });
      label.anchor.set(0, 0.5);
      label.position.set(x, (ROW_H - 8) / 2);
      row.addChild(label);
      if (it.sub) {
        const sub = makeText(it.sub, { fontSize: 15, fontWeight: '600', fill: C.textMuted });
        sub.anchor.set(1, 0.5);
        sub.position.set(w - px * 2 - 16, (ROW_H - 8) / 2);
        row.addChild(sub);
      }
      row.position.set(px, 60 + i * ROW_H);
      row.eventMode = 'static';
      row.cursor = 'pointer';
      row.hitArea = new Rectangle(0, 0, w - px * 2, ROW_H - 8);
      row.on('pointertap', () => {
        sound.play('click');
        this.onPick?.(i);
        this.close();
      });
      this.rows.addChild(row);
    });
    this.panelH = 60 + items.length * ROW_H + 20;
    this.bg.clear().roundRect(0, 0, w, this.panelH + R.panel, R.panel).fill(C.bgPanel);
    this.bg.roundRect(w / 2 - 22, 8, 44, 4, 2).fill(C.btnSecondary);
    this.title.position.set(px, 24);
    this.panel.hitArea = new Rectangle(0, 0, w, this.panelH);

    this.isOpen = true;
    this.visible = true;
    sound.play('sheet');
    gsap.killTweensOf([this.panel, this.backdrop]);
    gsap.fromTo(this.backdrop, { alpha: 0 }, { alpha: 1, duration: 0.2 });
    gsap.fromTo(this.panel, { y: this.screenH }, { y: this.screenH - this.panelH, duration: 0.35, ease: 'power3.out' });
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    gsap.killTweensOf([this.panel, this.backdrop]);
    gsap.to(this.backdrop, { alpha: 0, duration: 0.2 });
    gsap.to(this.panel, { y: this.screenH, duration: 0.25, ease: 'power2.in', onComplete: () => void (this.visible = this.isOpen) });
  }
}
