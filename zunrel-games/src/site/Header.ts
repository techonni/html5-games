import { Container, Graphics, Rectangle, type Text } from 'pixi.js';
import gsap from 'gsap';
import { C, R } from '../core/theme';
import { makeText } from '../core/text';
import { logo, speaker } from '../core/icons';
import { sound } from '../core/audio/Sound';
import { Button } from '../core/ui/Button';

export type Route = 'home' | 'crash' | 'binary' | 'about';

export const LINKS: { route: Route; label: string }[] = [
  { route: 'home', label: 'Início' },
  { route: 'crash', label: 'Crash' },
  { route: 'binary', label: 'Binary' },
  { route: 'about', label: 'Sobre' },
];

export const MAX_W = 1200;

/** Cabeçalho do site: marca, navegação (computador) ou menu (telemóvel), som e CTA. */
export class Header extends Container {
  static height(mobile: boolean): number {
    return mobile ? 60 : 72;
  }

  onNavigate: ((r: Route) => void) | null = null;
  onMenu: (() => void) | null = null;

  private readonly bg = new Graphics();
  private readonly brand = logo(24);
  private readonly links: { route: Route; text: Text }[] = [];
  private readonly underline = new Graphics();
  private readonly soundBtn = new Container();
  private readonly soundIcon = new Graphics();
  private readonly menuBtn = new Container();
  private readonly cta = new Button({ label: 'Jogar agora', width: 140, height: 44, fontSize: 16 });
  private route: Route = 'home';
  private mobile = false;
  private readonly bar = { x: 0, w: 0 };

  constructor() {
    super();
    this.brand.eventMode = 'static';
    this.brand.cursor = 'pointer';
    this.brand.on('pointertap', () => this.onNavigate?.('home'));
    this.addChild(this.bg, this.brand, this.underline);

    for (const l of LINKS) {
      const t = makeText(l.label, { fontSize: 16, fontWeight: '600', fill: C.textMuted });
      t.anchor.set(0.5);
      t.eventMode = 'static';
      t.cursor = 'pointer';
      t.hitArea = new Rectangle(-t.width / 2 - 14, -24, t.width + 28, 48);
      t.on('pointerover', () => {
        if (l.route !== this.route) t.style.fill = C.text;
      });
      t.on('pointerout', () => this.paint());
      t.on('pointertap', () => {
        sound.play('click');
        this.onNavigate?.(l.route);
      });
      this.links.push({ route: l.route, text: t });
      this.addChild(t);
    }

    const sbg = new Graphics().roundRect(-22, -22, 44, 44, R.input).fill(C.bgInput);
    this.soundBtn.addChild(sbg, speaker(this.soundIcon, sound.muted));
    this.soundBtn.eventMode = 'static';
    this.soundBtn.cursor = 'pointer';
    this.soundBtn.hitArea = new Rectangle(-22, -22, 44, 44);
    this.soundBtn.on('pointertap', () => {
      sound.toggleMute();
      if (!sound.muted) sound.play('click');
      gsap.fromTo(this.soundBtn.scale, { x: 0.85, y: 0.85 }, { x: 1, y: 1, duration: 0.3, ease: 'back.out(3)' });
    });
    sound.onMuteChange = (m) => speaker(this.soundIcon, m);

    const mbg = new Graphics().roundRect(-22, -22, 44, 44, R.input).fill(C.bgInput);
    const lines = new Graphics();
    for (const y of [-7, 0, 7]) lines.moveTo(-10, y).lineTo(10, y);
    lines.stroke({ width: 2.4, color: C.text, cap: 'round' });
    this.menuBtn.addChild(mbg, lines);
    this.menuBtn.eventMode = 'static';
    this.menuBtn.cursor = 'pointer';
    this.menuBtn.hitArea = new Rectangle(-22, -22, 44, 44);
    this.menuBtn.on('pointertap', () => {
      sound.play('click');
      this.onMenu?.();
    });
    this.cta.onTap = () => this.onNavigate?.('crash');
    this.addChild(this.soundBtn, this.menuBtn, this.cta);
  }

  layout(W: number, mobile: boolean): void {
    this.mobile = mobile;
    const h = Header.height(mobile);
    const cw = Math.min(W, MAX_W);
    const ox = (W - cw) / 2;
    const px = mobile ? 16 : 24;
    this.bg.clear().rect(0, 0, W, h).fill(C.bgBase).rect(0, h - 1, W, 1).fill(C.border);
    this.brand.position.set(ox + px, h / 2);
    this.brand.scale.set(mobile ? 0.9 : 1);

    const right = ox + cw - px;
    this.menuBtn.visible = mobile;
    this.cta.visible = !mobile;
    this.underline.visible = !mobile;
    if (mobile) {
      this.menuBtn.position.set(right - 22, h / 2);
      this.soundBtn.position.set(right - 22 - 54, h / 2);
    } else {
      this.cta.position.set(right - 140, (h - 44) / 2);
      this.soundBtn.position.set(right - 140 - 34, h / 2);
    }
    // Links centrados entre a marca e os botões
    let x = ox + px + 190;
    for (const l of this.links) {
      l.text.visible = !mobile;
      l.text.position.set(x + l.text.width / 2, h / 2);
      x += l.text.width + 36;
    }
    this.placeUnderline(false);
  }

  setRoute(route: Route): void {
    this.route = route;
    this.paint();
    this.placeUnderline(true);
  }

  private paint(): void {
    for (const l of this.links) l.text.style.fill = l.route === this.route ? C.text : C.textMuted;
  }

  private placeUnderline(animate: boolean): void {
    const l = this.links.find((k) => k.route === this.route);
    if (!l || this.mobile) return;
    const h = Header.height(false);
    const target = { x: l.text.x - l.text.width / 2, w: l.text.width };
    const draw = () => this.underline.clear().roundRect(this.bar.x, h - 4, this.bar.w, 3, 1.5).fill(C.btnPrimary);
    gsap.killTweensOf(this.bar);
    if (!animate || this.bar.w === 0) {
      Object.assign(this.bar, target);
      draw();
    } else gsap.to(this.bar, { ...target, duration: 0.35, ease: 'power3.out', onUpdate: draw });
  }
}
