import { Graphics } from 'pixi.js';
import { C, R } from '../core/theme';
import { makeText } from '../core/text';
import { Button } from '../core/ui/Button';
import { Page } from './Page';

const BLOCKS: [string, string][] = [
  [
    'Quem somos',
    'A zunrel é um pequeno editor de jogos HTML5. Criamos jogos originais que correm direto no browser, no telemóvel e no computador, sem instalar nada.',
  ],
  [
    'Como são feitos',
    'Tudo o que vês — incluindo este site — é desenhado em canvas com PixiJS, animado com GSAP, escrito em TypeScript e com som gerido pelo Howler.js.',
  ],
  [
    'Só demonstração',
    'Os jogos usam créditos fictícios. Não aceitamos depósitos, não pagamos prémios e não há dinheiro real envolvido. O saldo fica guardado apenas no teu browser.',
  ],
  [
    'Jogo responsável',
    'Mesmo em demo, joga para te divertires e faz pausas. Estes jogos não são um incentivo a apostar a dinheiro real.',
  ],
];

/** Página "Sobre": informação básica do site. */
export class AboutPage extends Page {
  protected build(x: number, w: number): number {
    const m = this.mobile;
    const c = this.content;
    let y = m ? 28 : 64;
    const maxW = Math.min(w, 760);
    const h1 = makeText('Sobre a zunrel', { fontSize: m ? 34 : 46, fontWeight: '800', fill: C.text });
    h1.position.set(x, y);
    c.addChild(h1);
    y += h1.height + 28;
    for (const [title, text] of BLOCKS) {
      const t = makeText(title, { fontSize: 20, fontWeight: '700', fill: C.text });
      const d = makeText(text, { fontSize: 17, fontWeight: '500', fill: C.textMuted, wordWrap: true, wordWrapWidth: maxW - 40, lineHeight: 27 });
      const h = d.height + 76;
      const bg = new Graphics().roundRect(x, y, maxW, h, R.panel).fill(C.bgPanel);
      t.position.set(x + 20, y + 20);
      d.position.set(x + 20, y + 54);
      c.addChild(bg, t, d);
      y += h + 16;
    }
    const b = new Button({ label: 'Ver os jogos', width: 180, height: 52, fontSize: 17 });
    b.position.set(x, y + 12);
    b.onTap = () => this.onNavigate?.('home');
    c.addChild(b);
    return y + 64;
  }
}
