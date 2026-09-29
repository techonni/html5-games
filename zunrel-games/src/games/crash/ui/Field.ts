import { Container, Graphics, Rectangle, type Text } from 'pixi.js';
import gsap from 'gsap';
import { C, R } from '../theme';
import { makeText } from '../text';
import { chevron, coinIcon } from '../icons';
import { sound } from '../audio/Sound';

export interface FieldAddon {
  label?: string;
  icon?: 'up' | 'down';
  onTap: () => void;
}

export interface FieldOptions {
  label: string;
  value: string;
  coin?: boolean;
  readOnly?: boolean;
  addons?: FieldAddon[];
}

const LABEL_H = 30;
const BOX_H = 48;
const ADDON_W = 58;

/** Campo estilo "input" desenhado em Pixi: rótulo em cima, caixa escura, atalhos à direita. */
export class Field extends Container {
  static readonly HEIGHT = LABEL_H + BOX_H;
  onFocus: (() => void) | null = null;

  private readonly title: Text;
  private readonly value: Text;
  private readonly box = new Graphics();
  private readonly hit = new Container();
  private readonly caret = new Graphics();
  private readonly coin: Container | null;
  private readonly addons: { opt: FieldAddon; view: Container; bg: Graphics }[] = [];
  private readonly shaker = new Container();
  private w = 300;
  private focused = false;
  private locked = false;
  private readonly readOnly: boolean;
  private caretTween: gsap.core.Tween | null = null;

  constructor(o: FieldOptions) {
    super();
    this.readOnly = o.readOnly ?? false;
    this.title = makeText(o.label, { fontSize: 16, fontWeight: '600', fill: C.textMuted });
    this.value = makeText(o.value, { fontSize: 18, fontWeight: '500', fill: C.text });
    this.value.anchor.set(0, 0.5);
    this.caret.rect(0, -11, 2, 22).fill(C.btnPrimary);
    this.caret.visible = false;
    this.coin = o.coin ? coinIcon(26) : null;

    this.addChild(this.title, this.shaker);
    this.shaker.addChild(this.box, this.hit, this.value, this.caret);
    if (this.coin) this.shaker.addChild(this.coin);

    if (!this.readOnly) {
      this.hit.eventMode = 'static';
      this.hit.cursor = 'text';
      this.hit.on('pointertap', () => {
        if (this.locked) return;
        sound.play('click', 0.6);
        this.onFocus?.();
      });
    }

    for (const opt of o.addons ?? []) {
      const view = new Container();
      const bg = new Graphics();
      view.addChild(bg);
      if (opt.icon) view.addChild(chevron(opt.icon, 14));
      else {
        const t = makeText(opt.label ?? '', { fontSize: 18, fontWeight: '600', fill: C.text });
        t.anchor.set(0.5);
        view.addChild(t);
      }
      view.eventMode = 'static';
      view.cursor = 'pointer';
      view.hitArea = new Rectangle(-ADDON_W / 2, -BOX_H / 2, ADDON_W, BOX_H);
      view.on('pointerdown', () => {
        if (!this.locked) gsap.fromTo(bg, { alpha: 0.25 }, { alpha: 0, duration: 0.3 });
      });
      view.on('pointertap', () => {
        if (this.locked) return;
        sound.play('click');
        opt.onTap();
      });
      this.shaker.addChild(view);
      this.addons.push({ opt, view, bg });
    }
    this.layout(this.w);
  }

  layout(w: number): void {
    this.w = w;
    const addonsW = this.addons.length * ADDON_W;
    const inputW = w - addonsW;
    this.shaker.y = LABEL_H;

    const b = this.box.clear();
    b.roundRect(0, 0, w, BOX_H, R.input).fill(this.focused ? C.btnPrimary : C.border);
    b.roundRect(2, 2, w - 4, BOX_H - 4, R.input - 2).fill(this.readOnly ? C.bgPanel : C.bgInput);
    if (addonsW > 0) {
      b.roundRect(inputW, 2, addonsW - 2, BOX_H - 4, R.input - 2).fill(C.bgAddon);
      b.rect(inputW, 2, R.input, BOX_H - 4).fill(C.bgAddon);
      for (let i = 1; i < this.addons.length; i++) {
        b.rect(inputW + i * ADDON_W, 13, 1, BOX_H - 26).fill(C.textMuted);
      }
    }

    this.hit.hitArea = new Rectangle(0, 0, inputW, BOX_H);
    this.value.position.set(16, BOX_H / 2);
    if (this.coin) this.coin.position.set(inputW - 24, BOX_H / 2);
    this.addons.forEach((a, i) => {
      a.view.position.set(inputW + i * ADDON_W + ADDON_W / 2, BOX_H / 2);
      a.bg.clear().rect(-ADDON_W / 2 + 1, -BOX_H / 2 + 3, ADDON_W - 2, BOX_H - 6).fill(C.text);
      a.bg.alpha = 0;
    });
    this.placeCaret();
  }

  setValue(v: string): void {
    this.value.text = v;
    this.placeCaret();
  }

  setFocused(on: boolean): void {
    if (this.focused === on) return;
    this.focused = on;
    this.caret.visible = on;
    this.caretTween?.kill();
    this.caretTween = on ? gsap.fromTo(this.caret, { alpha: 1 }, { alpha: 0, duration: 0.5, repeat: -1, yoyo: true, ease: 'steps(1)' }) : null;
    this.layout(this.w);
  }

  setLocked(on: boolean): void {
    this.locked = on;
    this.shaker.alpha = on ? 0.55 : 1;
  }

  shake(): void {
    gsap.fromTo(this.shaker, { x: -8 }, { x: 0, duration: 0.45, ease: 'elastic.out(1.2, 0.3)' });
  }

  private placeCaret(): void {
    this.caret.position.set(this.value.x + this.value.width + 3, BOX_H / 2);
  }
}
