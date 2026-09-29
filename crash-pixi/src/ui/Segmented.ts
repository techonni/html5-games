import { Container, Graphics, Rectangle, type Text } from 'pixi.js';
import gsap from 'gsap';
import { C } from '../theme';
import { makeText } from '../text';
import { sound } from '../audio/Sound';

/** Seletor de 2+ opções em pílula, com indicador deslizante (GSAP). */
export class Segmented extends Container {
  static readonly HEIGHT = 50;
  onChange: ((index: number) => void) | null = null;
  index = 0;

  private readonly bg = new Graphics();
  private readonly knob = new Graphics();
  private readonly labels: Text[];
  private w = 300;
  private locked = false;

  constructor(options: string[]) {
    super();
    this.addChild(this.bg, this.knob);
    this.labels = options.map((o, i) => {
      const t = makeText(o, { fontSize: 16, fontWeight: '600', fill: C.text });
      t.anchor.set(0.5);
      t.eventMode = 'static';
      t.cursor = 'pointer';
      t.on('pointertap', () => this.select(i));
      this.addChild(t);
      return t;
    });
    this.eventMode = 'static';
    this.layout(this.w);
  }

  layout(w: number): void {
    this.w = w;
    const h = Segmented.HEIGHT;
    const n = this.labels.length;
    const segW = (w - 10) / n;
    this.bg.clear().roundRect(0, 0, w, h, h / 2).fill(C.bgInput);
    this.knob.clear().roundRect(0, 0, segW, h - 10, (h - 10) / 2).fill(C.bgAddon);
    this.knob.position.set(5 + this.index * segW, 5);
    this.labels.forEach((t, i) => {
      t.position.set(5 + segW * (i + 0.5), h / 2);
      t.hitArea = new Rectangle(-segW / 2, -h / 2, segW, h);
      t.alpha = i === this.index ? 1 : 0.65;
    });
  }

  setLocked(on: boolean): void {
    this.locked = on;
    this.alpha = on ? 0.55 : 1;
  }

  select(i: number): void {
    if (this.locked || i === this.index) return;
    this.index = i;
    sound.play('click');
    const segW = (this.w - 10) / this.labels.length;
    gsap.to(this.knob, { x: 5 + i * segW, duration: 0.3, ease: 'power3.out' });
    this.labels.forEach((t, j) => gsap.to(t, { alpha: j === i ? 1 : 0.65, duration: 0.2 }));
    this.onChange?.(i);
  }
}
