import { Container, Graphics } from 'pixi.js';
import gsap from 'gsap';
import { C, R } from '../core/theme';
import { makeText } from '../core/text';
import { Button } from '../core/ui/Button';
import { Page } from './Page';
import { BinaryThumb, CrashThumb, type Thumb } from './thumbs';
import type { Route } from './Header';

interface GameInfo {
  route: Route;
  title: string;
  desc: string;
  tags: string[];
  thumb: () => Thumb;
}

const GAMES: GameInfo[] = [
  {
    route: 'crash',
    title: 'Crash',
    desc: 'O multiplicador sobe até rebentar. Retira a tempo — à mão ou com retirada automática.',
    tags: ['RTP 99%', 'Solo', 'Rondas de 5 s'],
    thumb: () => new CrashThumb(),
  },
  {
    route: 'binary',
    title: 'Binary',
    desc: 'Sobe ou desce? Opções "tudo ou nada" sobre índices sintéticos, com gráfico ao vivo.',
    tags: ['Binary +85%', 'Turbo +80%', 'Ticks 1 s'],
    thumb: () => new BinaryThumb(),
  },
];

const FEATURES = [
  { icon: '€', title: 'Só demo', text: 'Créditos fictícios. Não há depósitos, levantamentos nem dinheiro real.' },
  { icon: '▶', title: 'Sem registo', text: 'Abre e joga. O saldo fica guardado no teu browser.' },
  { icon: '⚡', title: '100% canvas', text: 'Feito com PixiJS, GSAP, TypeScript e Howler.js, a 60 fps.' },
];

function pill(text: string, color: number = C.btnSecondary, textColor: number = C.text): Container {
  const c = new Container();
  const t = makeText(text, { fontSize: 13, fontWeight: '700', fill: textColor });
  const w = t.width + 22;
  c.addChild(new Graphics().roundRect(0, 0, w, 28, 14).fill(color), t);
  t.position.set(11, 14 - t.height / 2);
  return c;
}

/** Página inicial: destaque, grelha de jogos e vantagens. */
export class HomePage extends Page {
  private thumbs: Thumb[] = [];

  protected build(x: number, w: number): number {
    this.thumbs = [];
    const m = this.mobile;
    const c = this.content;
    let y = m ? 28 : 64;

    // ---------- Destaque ----------
    const textW = m ? w : w * 0.48;
    const kicker = pill('Jogos originais · HTML5', C.bgPanel, C.textMuted);
    kicker.position.set(x, y);
    const h1 = makeText('Jogos originais,\ndireto no browser.', {
      fontSize: m ? 36 : 54,
      fontWeight: '800',
      fill: C.text,
      lineHeight: m ? 42 : 62,
      wordWrap: true,
      wordWrapWidth: textW,
    });
    h1.position.set(x, y + 44);
    const lead = makeText('Crash e opções binárias em modo demo: créditos fictícios, sem registo e sem dinheiro real. Abre, joga e diverte-te.', {
      fontSize: m ? 16 : 19,
      fontWeight: '500',
      fill: C.textMuted,
      lineHeight: m ? 24 : 29,
      wordWrap: true,
      wordWrapWidth: textW,
    });
    lead.position.set(x, h1.y + h1.height + 16);
    c.addChild(kicker, h1, lead);

    let by = lead.y + lead.height + 28;
    const bw = m ? (w - 12) / 2 : 180;
    const play1 = new Button({ label: 'Jogar Crash', width: bw, height: 52, fontSize: 17 });
    const play2 = new Button({ label: 'Jogar Binary', width: bw, height: 52, fontSize: 17, color: C.btnSecondary });
    play1.position.set(x, by);
    play2.position.set(x + bw + 12, by);
    play1.onTap = () => this.onNavigate?.('crash');
    play2.onTap = () => this.onNavigate?.('binary');
    c.addChild(play1, play2);
    by += 52 + 28;

    const stats = [
      ['2', 'jogos originais'],
      ['99%', 'RTP no Crash'],
      ['0 €', 'sempre demo'],
    ];
    const sw = m ? w / 3 : 140;
    stats.forEach(([big, small], i) => {
      const b = makeText(big, { fontSize: m ? 24 : 28, fontWeight: '800', fill: C.text });
      const s = makeText(small, { fontSize: 13, fontWeight: '600', fill: C.textMuted });
      b.position.set(x + i * sw, by);
      s.position.set(x + i * sw, by + (m ? 32 : 38));
      c.addChild(b, s);
    });
    const textBottom = by + 64;

    // Ilustração: dois ecrãs de jogo animados a flutuar.
    const artW = m ? w : w * 0.48;
    const artH = m ? 250 : 400;
    const artX = m ? x : x + w - artW;
    const artY = m ? textBottom + 28 : y - 8;
    const art = new Container();
    art.position.set(artX, artY);
    const a1 = new CrashThumb();
    const a2 = new BinaryThumb();
    const artCardW = artW * 0.74;
    const artCardH = artH * 0.62;
    a1.layout(artCardW, artCardH);
    a2.layout(artCardW, artCardH);
    const frame = (t: Thumb) => {
      const f = new Container();
      f.addChild(new Graphics().roundRect(-6, -6, artCardW + 12, artCardH + 12, R.panel + 4).fill(C.bgPanel), t);
      return f;
    };
    const f2 = frame(a2);
    const f1 = frame(a1);
    f2.position.set(artW - artCardW, artH - artCardH);
    f1.position.set(0, 0);
    art.addChild(f2, f1);
    gsap.to(f1, { y: 10, duration: 2.6, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    gsap.to(f2, { y: artH - artCardH - 10, duration: 3.1, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    c.addChild(art);
    this.thumbs.push(a1, a2);
    gsap.from([kicker, h1, lead, play1, play2], { alpha: 0, y: '+=16', duration: 0.6, stagger: 0.06, ease: 'power3.out' });
    gsap.from(art, { alpha: 0, x: art.x + 30, duration: 0.8, ease: 'power3.out' });

    y = Math.max(textBottom, artY + artH) + (m ? 48 : 88);

    // ---------- Jogos ----------
    const h2 = makeText('Os nossos jogos', { fontSize: m ? 26 : 32, fontWeight: '800', fill: C.text });
    h2.position.set(x, y);
    const sub = makeText('Rápidos, bonitos e feitos para o telemóvel e para o computador.', {
      fontSize: 16,
      fontWeight: '500',
      fill: C.textMuted,
      wordWrap: true,
      wordWrapWidth: w,
    });
    sub.position.set(x, y + (m ? 38 : 46));
    c.addChild(h2, sub);
    y = sub.y + sub.height + 24;

    const cols = m ? 1 : 2;
    const gap = 24;
    const cw = (w - gap * (cols - 1)) / cols;
    const thumbH = m ? 190 : 250;
    // Monta os cartões primeiro para medir o texto; a altura final é a maior da linha.
    const cards = GAMES.map((g) => {
      const card = new Container();
      const bg = new Graphics();
      const thumb = g.thumb();
      thumb.layout(cw - 24, thumbH);
      thumb.position.set(12, 12);
      const title = makeText(g.title, { fontSize: 24, fontWeight: '800', fill: C.text });
      title.position.set(20, thumbH + 28);
      const desc = makeText(g.desc, { fontSize: 15, fontWeight: '500', fill: C.textMuted, wordWrap: true, wordWrapWidth: cw - 40, lineHeight: 22 });
      desc.position.set(20, thumbH + 66);
      const tags = new Container();
      let tx = 0;
      let ty = 0;
      const tagsW = m ? cw - 40 : cw - 170;
      for (const t of g.tags) {
        const p = pill(t);
        if (tx > 0 && tx + p.width > tagsW) {
          tx = 0;
          ty += 36;
        }
        p.position.set(tx, ty);
        tx += p.width + 8;
        tags.addChild(p);
      }
      const rowY = desc.y + desc.height + 20;
      tags.position.set(20, rowY + (m ? 0 : 8));
      const play = new Button({ label: 'Jogar', width: m ? cw - 40 : 120, height: 44, fontSize: 16 });
      play.position.set(m ? 20 : cw - 140, m ? rowY + ty + 28 + 16 : rowY);
      play.onTap = () => this.onNavigate?.(g.route);
      card.addChild(bg, thumb, title, desc, tags, play);
      this.thumbs.push(thumb);
      return { card, bg, height: play.y + 44 + 20 };
    });
    const cardH = Math.max(...cards.map((k) => k.height));
    let stackY = y;
    cards.forEach(({ card, bg, height }, i) => {
      // Telemóvel: cartões empilhados com a sua própria altura; computador: grelha.
      const baseY = m ? stackY : y + Math.floor(i / cols) * (cardH + gap);
      stackY += height + gap;
      card.position.set(x + (i % cols) * (cw + gap), baseY);
      bg.roundRect(0, 0, cw, m ? cards[i].height : cardH, R.panel).fill(C.bgPanel);
      if (!m) {
        card.eventMode = 'static';
        card.on('pointerover', () => gsap.to(card, { y: baseY - 4, duration: 0.2 }));
        card.on('pointerout', () => gsap.to(card, { y: baseY, duration: 0.2 }));
      }
      c.addChild(card);
    });
    y += m ? cards.reduce((sum, k) => sum + k.height + gap, 0) : Math.ceil(GAMES.length / cols) * (cardH + gap);
    y += m ? 24 : 56;

    // ---------- Vantagens ----------
    const fcols = m ? 1 : 3;
    const fw = (w - gap * (fcols - 1)) / fcols;
    const probe = FEATURES.map((f) =>
      makeText(f.text, { fontSize: 15, fontWeight: '500', fill: C.textMuted, wordWrap: true, wordWrapWidth: m ? fw - 100 : fw - 40, lineHeight: 21 }),
    );
    const fh = Math.max(...probe.map((d) => d.height)) + (m ? 72 : 134);
    probe.forEach((d) => d.destroy());
    FEATURES.forEach((f, i) => {
      const tile = new Container();
      tile.position.set(x + (i % fcols) * (fw + gap), y + Math.floor(i / fcols) * (fh + 16));
      const bg = new Graphics().roundRect(0, 0, fw, fh, R.panel).fill(C.bgPanel);
      const circle = new Graphics().circle(0, 0, 22).fill(C.bgAddon);
      circle.position.set(40, m ? fh / 2 : 44);
      const ic = makeText(f.icon, { fontSize: 20, fontWeight: '800', fill: C.text });
      ic.anchor.set(0.5);
      ic.position.copyFrom(circle.position);
      const t = makeText(f.title, { fontSize: 18, fontWeight: '700', fill: C.text });
      const d = makeText(f.text, { fontSize: 15, fontWeight: '500', fill: C.textMuted, wordWrap: true, wordWrapWidth: m ? fw - 100 : fw - 40, lineHeight: 21 });
      if (m) {
        t.position.set(80, 22);
        d.position.set(80, 50);
      } else {
        t.position.set(20, 84);
        d.position.set(20, 114);
      }
      tile.addChild(bg, circle, ic, t, d);
      c.addChild(tile);
    });
    return y + Math.ceil(FEATURES.length / fcols) * (fh + 16);
  }

  tick(dt: number): void {
    for (const t of this.thumbs) if (!t.destroyed) t.tick(dt);
  }
}
