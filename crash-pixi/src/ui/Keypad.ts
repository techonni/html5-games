import { Container, Graphics, Rectangle, type Text } from 'pixi.js';
import gsap from 'gsap';
import { C, R } from '../theme';
import { makeText } from '../text';
import { Button } from './Button';

export interface KeypadRequest {
  title: string;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];
const KEY_H = 52;
const GAP = 8;
const MAX_LEN = 10;

/**
 * Teclado numérico em Pixi (folha inferior). Substitui o <input> do DOM,
 * para que toda a interface viva no canvas. Também aceita o teclado físico.
 */
export class Keypad extends Container {
  static readonly SHEET_H = 16 + 28 + 12 + 56 + 12 + 4 * KEY_H + 3 * GAP + 12 + 52 + 20;
  isOpen = false;

  private readonly backdrop = new Graphics();
  private readonly sheet = new Container();
  private readonly sheetBg = new Graphics();
  private readonly title: Text;
  private readonly display = new Graphics();
  private readonly valueText: Text;
  private readonly keys: { key: string; view: Container; bg: Graphics }[] = [];
  private readonly done: Button;
  private req: KeypadRequest | null = null;
  private value = '';
  private fresh = true;
  private screenH = 800;

  constructor() {
    super();
    this.visible = false;
    this.backdrop.eventMode = 'static';
    this.backdrop.on('pointertap', () => this.close());
    this.sheet.eventMode = 'static';
    this.title = makeText('', { fontSize: 16, fontWeight: '600', fill: C.textMuted });
    this.valueText = makeText('', { fontSize: 28, fontWeight: '700', fill: C.text });
    this.valueText.anchor.set(0, 0.5);
    this.done = new Button({ label: 'OK', width: 300, height: 52 });
    this.done.onTap = () => this.close();
    this.sheet.addChild(this.sheetBg, this.title, this.display, this.valueText, this.done);

    for (const key of KEYS) {
      const view = new Container();
      const bg = new Graphics();
      const t = makeText(key, { fontSize: 24, fontWeight: '600', fill: C.text });
      t.anchor.set(0.5);
      view.addChild(bg, t);
      view.eventMode = 'static';
      view.cursor = 'pointer';
      view.on('pointerdown', () => gsap.fromTo(view.scale, { x: 0.92, y: 0.92 }, { x: 1, y: 1, duration: 0.25, ease: 'back.out(3)' }));
      view.on('pointertap', () => this.press(key));
      this.sheet.addChild(view);
      this.keys.push({ key, view, bg });
    }
    this.addChild(this.backdrop, this.sheet);
    window.addEventListener('keydown', this.onKeyDown);
  }

  layout(screenW: number, screenH: number, contentX: number, contentW: number): void {
    this.screenH = screenH;
    this.backdrop.clear().rect(0, 0, screenW, screenH).fill({ color: 0x000000, alpha: 0.55 });
    this.backdrop.hitArea = new Rectangle(0, 0, screenW, screenH);

    const w = contentW;
    const h = Keypad.SHEET_H;
    this.sheet.x = contentX;
    this.sheet.y = this.isOpen ? screenH - h : screenH;
    this.sheet.hitArea = new Rectangle(0, 0, w, h);
    this.sheetBg.clear().roundRect(0, 0, w, h + R.panel, R.panel).fill(C.bgPanel);
    this.sheetBg.roundRect(w / 2 - 22, 8, 44, 4, 2).fill(C.btnSecondary);

    const px = 16;
    const inner = w - px * 2;
    this.title.position.set(px, 22);
    this.display.clear().roundRect(px, 56, inner, 56, R.input).fill(C.btnPrimary);
    this.display.roundRect(px + 2, 58, inner - 4, 52, R.input - 2).fill(C.bgInput);
    this.valueText.position.set(px + 16, 84);

    const keyW = (inner - 2 * GAP) / 3;
    const top = 56 + 56 + 12;
    this.keys.forEach((k, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      k.view.position.set(px + col * (keyW + GAP) + keyW / 2, top + row * (KEY_H + GAP) + KEY_H / 2);
      k.bg.clear().roundRect(-keyW / 2, -KEY_H / 2, keyW, KEY_H, R.input).fill(k.key === '⌫' || k.key === '.' ? C.bgAddon : C.btnSecondary);
      k.view.hitArea = new Rectangle(-keyW / 2, -KEY_H / 2, keyW, KEY_H);
    });
    this.done.setSize(inner, 52);
    this.done.position.set(px, top + 4 * KEY_H + 3 * GAP + 12);
  }

  open(req: KeypadRequest): void {
    this.req = req;
    this.value = req.value;
    this.fresh = true;
    this.title.text = req.title;
    this.refresh();
    this.isOpen = true;
    this.visible = true;
    gsap.killTweensOf([this.sheet, this.backdrop]);
    gsap.fromTo(this.backdrop, { alpha: 0 }, { alpha: 1, duration: 0.2 });
    gsap.fromTo(this.sheet, { y: this.screenH }, { y: this.screenH - Keypad.SHEET_H, duration: 0.35, ease: 'power3.out' });
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    const req = this.req;
    this.req = null;
    req?.onClose();
    gsap.killTweensOf([this.sheet, this.backdrop]);
    gsap.to(this.backdrop, { alpha: 0, duration: 0.2 });
    gsap.to(this.sheet, {
      y: this.screenH,
      duration: 0.25,
      ease: 'power2.in',
      onComplete: () => {
        this.visible = this.isOpen;
      },
    });
  }

  private press(key: string): void {
    if (!this.req) return;
    let v = this.fresh && key !== '⌫' ? '' : this.value;
    this.fresh = false;
    if (key === '⌫') v = v.slice(0, -1);
    else if (key === '.') {
      if (!v.includes('.')) v = (v || '0') + '.';
    } else {
      const decimals = v.includes('.') ? v.split('.')[1].length : 0;
      if (decimals >= 2 || v.length >= MAX_LEN) return;
      v = v === '0' ? key : v + key;
    }
    this.value = v;
    this.refresh();
    this.req.onChange(v);
  }

  private refresh(): void {
    this.valueText.text = this.value || '0';
    this.valueText.alpha = this.fresh ? 0.6 : 1;
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (!this.isOpen) return;
    if (/^[0-9]$/.test(e.key)) this.press(e.key);
    else if (e.key === '.' || e.key === ',') this.press('.');
    else if (e.key === 'Backspace') this.press('⌫');
    else if (e.key === 'Enter' || e.key === 'Escape') this.close();
    else return;
    e.preventDefault();
  };

}
