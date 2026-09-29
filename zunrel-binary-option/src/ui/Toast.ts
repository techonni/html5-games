import { Container, Graphics, type Text } from 'pixi.js';
import gsap from 'gsap';
import { C } from '../theme';
import { makeText } from '../text';

/** Aviso curto no topo (ganho, perda, saldo insuficiente…). */
export class Toast extends Container {
  private readonly bg = new Graphics();
  private readonly caption: Text;
  private tl: gsap.core.Timeline | null = null;

  constructor() {
    super();
    this.caption = makeText('', { fontSize: 16, fontWeight: '700', fill: C.text });
    this.caption.anchor.set(0.5);
    this.addChild(this.bg, this.caption);
    this.alpha = 0;
    this.visible = false;
  }

  show(text: string, color: number = C.btnSecondary, textColor: number = C.text): void {
    this.caption.text = text;
    this.caption.style.fill = textColor;
    const w = this.caption.width + 40;
    const h = 44;
    this.bg.clear().roundRect(-w / 2, -h / 2, w, h, h / 2).fill(color);
    this.tl?.kill();
    this.visible = true;
    this.tl = gsap
      .timeline({ onComplete: () => (this.visible = false) })
      .fromTo(this, { alpha: 0 }, { alpha: 1, duration: 0.2 })
      .fromTo(this.scale, { x: 0.7, y: 0.7 }, { x: 1, y: 1, duration: 0.35, ease: 'back.out(2.5)' }, 0)
      .to(this, { alpha: 0, duration: 0.3 }, 1.8);
  }
}
