import { Container, Graphics, Rectangle, type Text } from 'pixi.js';
import gsap from 'gsap';
import { C, R } from '../theme';
import { makeText } from '../text';
import { sound } from '../audio/Sound';

/** Separador "Menu": som, repor saldo e informação. */
export class MenuView extends Container {
  onReset: (() => void) | null = null;
  private readonly title: Text;
  private readonly soundRow = new Container();
  private readonly resetRow = new Container();
  private readonly knob = new Graphics();
  private readonly track = new Graphics();
  private readonly about: Text;
  private w = 360;

  constructor() {
    super();
    this.title = makeText('Menu', { fontSize: 26, fontWeight: '800', fill: C.text });
    this.about = makeText('', { fontSize: 15, fontWeight: '500', fill: C.textMuted, wordWrap: true, wordWrapWidth: 320, lineHeight: 22 });
    this.about.text =
      'zunrel Binary — simulador demo de opções binárias "tudo ou nada" sobre forex (EUR/USD, GBP/USD e USD/JPY), com cotações simuladas.\n\n' +
      'Binary: 1–15 min, lucro fixo de 85%. Turbo: 30 s–5 min, lucro de 80%. ' +
      'O contrato é decidido pela cotação no segundo exato do vencimento; empate devolve a aposta.\n\n' +
      'Créditos fictícios, sem dinheiro real. Feito com PixiJS, GSAP, TypeScript e Howler.js.';

    this.soundRow.eventMode = 'static';
    this.soundRow.cursor = 'pointer';
    this.soundRow.on('pointertap', () => {
      sound.setMuted(!sound.muted);
      if (!sound.muted) sound.play('click');
      this.paintSwitch(true);
    });
    this.resetRow.eventMode = 'static';
    this.resetRow.cursor = 'pointer';
    this.resetRow.on('pointertap', () => {
      sound.play('click');
      this.onReset?.();
    });
    this.addChild(this.title, this.soundRow, this.resetRow, this.about);
  }

  layout(w: number): void {
    this.w = w;
    this.title.position.set(4, 0);
    this.row(this.soundRow, 'Som', 'Efeitos sonoros (Howler.js)', 56);
    this.soundRow.addChild(this.track, this.knob);
    this.paintSwitch(false);
    this.row(this.resetRow, 'Repor saldo demo', 'Volta a 10,000.00 EUR', 56 + 84);
    this.about.style.wordWrapWidth = w - 8;
    this.about.position.set(4, 56 + 2 * 84 + 12);
  }

  private row(c: Container, label: string, sub: string, y: number): void {
    c.removeChildren().forEach((ch) => ch.destroy());
    const bg = new Graphics().roundRect(0, 0, this.w, 72, R.panel).fill(C.bgPanel);
    const t = makeText(label, { fontSize: 17, fontWeight: '700', fill: C.text });
    t.position.set(18, 14);
    const s = makeText(sub, { fontSize: 14, fontWeight: '500', fill: C.textMuted });
    s.position.set(18, 40);
    c.addChild(bg, t, s);
    c.y = y;
    c.hitArea = new Rectangle(0, 0, this.w, 72);
  }

  private paintSwitch(animate: boolean): void {
    const on = !sound.muted;
    const x = this.w - 72;
    this.track.clear().roundRect(x, 22, 52, 30, 15).fill(on ? C.btnPrimary : C.btnSecondary);
    const kx = on ? x + 37 : x + 15;
    this.knob.clear().circle(0, 0, 11).fill(C.text);
    this.knob.y = 37;
    if (animate) gsap.to(this.knob, { x: kx, duration: 0.25, ease: 'power3.out' });
    else this.knob.x = kx;
  }
}
