import { Container, Graphics, Rectangle, type Text } from 'pixi.js';
import gsap from 'gsap';
import { C, R } from '../core/theme';
import { makeText } from '../core/text';
import { logo } from '../core/icons';
import { sound } from '../core/audio/Sound';
import { LINKS, type Route } from './Header';

/** Menu lateral do telemóvel (entra da direita). */
export class Drawer extends Container {
  onNavigate: ((r: Route) => void) | null = null;
  isOpen = false;
  private readonly backdrop = new Graphics();
  private readonly panel = new Container();
  private readonly bg = new Graphics();
  private readonly brand = logo(22);
  private readonly items: { route: Route; bg: Graphics; text: Text; view: Container }[] = [];
  private readonly note: Text;
  private panelW = 300;
  private route: Route = 'home';

  constructor() {
    super();
    this.visible = false;
    this.backdrop.eventMode = 'static';
    this.backdrop.on('pointertap', () => this.close());
    this.panel.eventMode = 'static';
    this.note = makeText('Jogos demo com créditos fictícios.\nSem dinheiro real.', {
      fontSize: 14,
      fontWeight: '500',
      fill: C.textPlaceholder,
      lineHeight: 20,
    });
    this.panel.addChild(this.bg, this.brand, this.note);
    for (const l of LINKS) {
      const view = new Container();
      const bg = new Graphics();
      const text = makeText(l.label, { fontSize: 20, fontWeight: '700', fill: C.text });
      text.anchor.set(0, 0.5);
      view.addChild(bg, text);
      view.eventMode = 'static';
      view.cursor = 'pointer';
      view.on('pointertap', () => {
        sound.play('click');
        this.onNavigate?.(l.route);
        this.close();
      });
      this.panel.addChild(view);
      this.items.push({ route: l.route, bg, text, view });
    }
    this.addChild(this.backdrop, this.panel);
  }

  layout(W: number, H: number): void {
    this.panelW = Math.min(320, W * 0.86);
    const w = this.panelW;
    this.backdrop.clear().rect(0, 0, W, H).fill({ color: 0x000000, alpha: 0.55 });
    this.backdrop.hitArea = new Rectangle(0, 0, W, H);
    this.bg.clear().rect(0, 0, w, H).fill(C.bgPanel);
    this.panel.hitArea = new Rectangle(0, 0, w, H);
    this.brand.position.set(20, 36);
    this.items.forEach((it, i) => {
      it.view.position.set(16, 84 + i * 64);
      it.view.hitArea = new Rectangle(0, 0, w - 32, 56);
      it.text.position.set(18, 28);
    });
    this.note.position.set(20, H - 80);
    this.panel.x = this.isOpen ? W - w : W;
    this.paint();
  }

  setRoute(route: Route): void {
    this.route = route;
    this.paint();
  }

  open(W: number): void {
    this.isOpen = true;
    this.visible = true;
    gsap.killTweensOf([this.panel, this.backdrop]);
    gsap.fromTo(this.backdrop, { alpha: 0 }, { alpha: 1, duration: 0.2 });
    gsap.fromTo(this.panel, { x: W }, { x: W - this.panelW, duration: 0.35, ease: 'power3.out' });
    this.items.forEach((it, i) => gsap.fromTo(it.view, { alpha: 0, x: 40 }, { alpha: 1, x: 16, duration: 0.35, delay: 0.05 * i }));
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    gsap.killTweensOf([this.panel, this.backdrop]);
    gsap.to(this.backdrop, { alpha: 0, duration: 0.2 });
    gsap.to(this.panel, { x: this.panel.x + this.panelW, duration: 0.25, ease: 'power2.in', onComplete: () => void (this.visible = this.isOpen) });
  }

  private paint(): void {
    for (const it of this.items) {
      const on = it.route === this.route;
      it.bg.clear().roundRect(0, 0, this.panelW - 32, 56, R.input).fill(on ? C.bgAddon : C.bgPanel);
      it.text.style.fill = on ? C.text : C.textMuted;
    }
  }
}
