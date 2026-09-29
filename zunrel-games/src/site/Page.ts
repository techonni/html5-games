import { Container, Graphics } from 'pixi.js';
import gsap from 'gsap';
import { C } from '../core/theme';
import { makeText } from '../core/text';
import { logo } from '../core/icons';
import { ScrollBox } from '../core/ui/ScrollBox';
import { MAX_W, type Route } from './Header';

/** Página com scroll; o conteúdo é reconstruído a cada mudança de tamanho. */
export abstract class Page extends Container {
  onNavigate: ((r: Route) => void) | null = null;
  protected readonly scroll = new ScrollBox();
  protected W = 400;
  protected mobile = true;

  constructor() {
    super();
    this.addChild(this.scroll);
  }

  get content(): Container {
    return this.scroll.content;
  }

  layout(W: number, H: number, mobile: boolean): void {
    this.W = W;
    this.mobile = mobile;
    this.scroll.layout(W, H);
    const kill = (c: Container) => {
      gsap.killTweensOf(c);
      gsap.killTweensOf(c.scale);
      c.children.forEach(kill);
    };
    this.content.removeChildren().forEach((c) => {
      kill(c);
      c.destroy({ children: true });
    });
    const cw = Math.min(W, MAX_W);
    const px = mobile ? 16 : 24;
    const y = this.build((W - cw) / 2 + px, cw - px * 2);
    this.footer(y + (mobile ? 40 : 72));
    this.scroll.refresh();
  }

  /** Desenha o conteúdo a partir de x com largura w; devolve o y final. */
  protected abstract build(x: number, w: number): number;

  tick(_dt: number): void {}

  /** Rodapé comum a todas as páginas. */
  private footer(y: number): void {
    const cw = Math.min(this.W, MAX_W);
    const px = this.mobile ? 16 : 24;
    const x = (this.W - cw) / 2 + px;
    const w = cw - px * 2;
    const f = new Container();
    f.y = y;
    const line = new Graphics().rect(0, 0, this.W, 1).fill(C.border);
    const bg = new Graphics().rect(0, 1, this.W, this.mobile ? 220 : 160).fill(C.bgBase);
    const brand = logo(20);
    brand.position.set(x, 44);
    const copy = makeText('© 2026 zunrel — editor de jogos HTML5.', { fontSize: 14, fontWeight: '600', fill: C.textMuted });
    const note = makeText(
      'Jogos de demonstração com créditos fictícios: não há depósitos, levantamentos nem prémios em dinheiro. Joga com moderação.',
      { fontSize: 14, fontWeight: '500', fill: C.textPlaceholder, wordWrap: true, wordWrapWidth: this.mobile ? w : w * 0.6, lineHeight: 20 },
    );
    if (this.mobile) {
      copy.position.set(x, 80);
      note.position.set(x, 108);
    } else {
      copy.position.set(x, 76);
      note.position.set(x + w * 0.4, 30);
    }
    f.addChild(line, bg, brand, copy, note);
    this.content.addChild(f);
  }
}
