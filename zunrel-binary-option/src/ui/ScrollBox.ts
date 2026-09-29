import { Container, Graphics, Rectangle, type FederatedPointerEvent, type FederatedWheelEvent } from 'pixi.js';
import gsap from 'gsap';

/** Área com scroll vertical (arrastar com o dedo ou roda do rato), com máscara. */
export class ScrollBox extends Container {
  readonly content = new Container();
  private readonly clip = new Graphics();
  private w = 300;
  private h = 300;
  private dragY: number | null = null;
  private startScroll = 0;
  private moved = 0;

  constructor() {
    super();
    this.addChild(this.content, this.clip);
    this.content.mask = this.clip;
    this.eventMode = 'static';
    this.on('pointerdown', (e: FederatedPointerEvent) => {
      this.dragY = e.global.y;
      this.startScroll = this.content.y;
      this.moved = 0;
      gsap.killTweensOf(this.content);
    });
    this.on('globalpointermove', (e: FederatedPointerEvent) => {
      if (this.dragY === null) return;
      const dy = (e.global.y - this.dragY) / this.worldTransform.d;
      this.moved = Math.max(this.moved, Math.abs(dy));
      this.content.y = this.clampY(this.startScroll + dy);
    });
    const end = () => (this.dragY = null);
    this.on('pointerup', end);
    this.on('pointerupoutside', end);
    this.on('wheel', (e: FederatedWheelEvent) => {
      gsap.to(this.content, { y: this.clampY(this.content.y - e.deltaY), duration: 0.25, ease: 'power2.out' });
    });
  }

  /** true se o último gesto foi um arrasto (para não disparar toques). */
  get dragged(): boolean {
    return this.moved > 8;
  }

  layout(w: number, h: number): void {
    this.w = w;
    this.h = h;
    this.clip.clear().rect(0, 0, w, h).fill(0xffffff);
    this.hitArea = new Rectangle(0, 0, w, h);
    this.content.y = this.clampY(this.content.y);
  }

  refresh(): void {
    this.content.y = this.clampY(this.content.y);
  }

  get viewWidth(): number {
    return this.w;
  }

  private clampY(y: number): number {
    const max = 0;
    const min = Math.min(0, this.h - this.content.height - 16);
    return Math.max(min, Math.min(max, y));
  }
}
