import { Container, Graphics, Rectangle, type Text } from 'pixi.js';
import gsap from 'gsap';
import { C, R } from '../theme';
import { makeText } from '../text';
import { sound } from '../audio/Sound';

/** Caixa com rótulo e valor (Duração / Aposta / Pagamento). */
export class Tile extends Container {
  onTap: (() => void) | null = null;
  private readonly bg = new Graphics();
  private readonly title: Text;
  private readonly value: Text;

  constructor(label: string, private readonly tappable = true) {
    super();
    this.title = makeText(label, { fontSize: 15, fontWeight: '600', fill: C.textMuted });
    this.value = makeText('', { fontSize: 22, fontWeight: '500', fill: C.text });
    this.title.anchor.set(0.5, 0);
    this.value.anchor.set(0.5, 0);
    this.addChild(this.bg, this.title, this.value);
    if (tappable) {
      this.eventMode = 'static';
      this.cursor = 'pointer';
      this.on('pointerdown', () => gsap.fromTo(this.bg, { alpha: 0.7 }, { alpha: 1, duration: 0.3 }));
      this.on('pointertap', () => {
        sound.play('click');
        this.onTap?.();
      });
    }
  }

  layout(w: number, h: number): void {
    this.bg.clear().roundRect(0, 0, w, h, R.input + 2).fill(C.border);
    this.bg.roundRect(2, 2, w - 4, h - 4, R.input).fill(C.bgInput);
    this.title.position.set(w / 2, 12);
    this.value.position.set(w / 2, 38);
    this.hitArea = new Rectangle(0, 0, w, h);
  }

  setValue(v: string): void {
    if (this.value.text !== v) {
      this.value.text = v;
      if (this.tappable) gsap.fromTo(this.value.scale, { x: 1.12, y: 1.12 }, { x: 1, y: 1, duration: 0.3, ease: 'back.out(3)' });
    }
  }
}
