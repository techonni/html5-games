import { Container, Graphics, Rectangle, type Text } from 'pixi.js';
import gsap from 'gsap';
import { C } from '../theme';
import { makeText } from '../text';
import { sound } from '../audio/Sound';

export interface SegOption {
  label: string;
  /** Cor do texto quando selecionado (ex.: verde "Sobe", vermelho "Desce"). */
  color?: number;
}

/** Seletor em pílula com indicador deslizante (GSAP). */
export class Segmented extends Container {
  onChange: ((index: number) => void) | null = null;
  index = 0;
  private readonly bg = new Graphics();
  private readonly knob = new Graphics();
  private readonly labels: Text[];
  private w = 300;

  constructor(private readonly options: SegOption[], fontSize = 20) {
    super();
    this.addChild(this.bg, this.knob);
    this.labels = options.map((o, i) => {
      const t = makeText(o.label, { fontSize, fontWeight: '600', fill: C.textMuted });
      t.anchor.set(0.5);
      t.eventMode = 'static';
      t.cursor = 'pointer';
      t.on('pointertap', () => this.select(i));
      this.addChild(t);
      return t;
    });
  }

  layout(w: number, h: number): void {
    this.w = w;
    const segW = (w - 12) / this.labels.length;
    this.bg.clear().roundRect(0, 0, w, h, h / 2).fill(C.bgInput);
    this.knob.clear().roundRect(0, 0, segW, h - 12, (h - 12) / 2).fill(C.bgAddon);
    this.knob.position.set(6 + this.index * segW, 6);
    this.labels.forEach((t, i) => {
      t.position.set(6 + segW * (i + 0.5), h / 2);
      t.hitArea = new Rectangle(-segW / 2, -h / 2, segW, h);
    });
    this.paint();
  }

  select(i: number, silent = false): void {
    if (i === this.index) return;
    this.index = i;
    if (!silent) sound.play('click');
    const segW = (this.w - 12) / this.labels.length;
    gsap.to(this.knob, { x: 6 + i * segW, duration: 0.3, ease: 'power3.out' });
    this.paint();
    if (!silent) this.onChange?.(i);
  }

  private paint(): void {
    this.labels.forEach((t, j) => {
      t.style.fill = j === this.index ? (this.options[j].color ?? C.text) : C.textMuted;
    });
  }
}
