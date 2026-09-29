import { Container, Graphics } from 'pixi.js';
import { C } from './theme';
import { makeText } from './text';

/** Moeda dourada com "C" (Coins demo). */
export function coinIcon(size = 26): Container {
  const c = new Container();
  c.addChild(new Graphics().circle(0, 0, size / 2).fill(C.coin));
  const t = makeText('C', { fontSize: size * 0.55, fontWeight: '800', fill: C.coinText });
  t.anchor.set(0.5);
  c.addChild(t);
  return c;
}

/** Altifalante com ondas (som ligado) ou com um X (som desligado). */
export function speaker(g: Graphics, muted: boolean, color: number = C.text): Graphics {
  g.clear();
  g.poly([-9, -4, -5, -4, 1, -9, 1, 9, -5, 4, -9, 4]).fill(color);
  if (muted) {
    g.moveTo(5, -4).lineTo(12, 4).moveTo(12, -4).lineTo(5, 4).stroke({ width: 2.2, color, cap: 'round' });
  } else {
    g.arc(1, 0, 6, -Math.PI / 4, Math.PI / 4).stroke({ width: 2.2, color, cap: 'round' });
    g.arc(1, 0, 11, -Math.PI / 3.2, Math.PI / 3.2).stroke({ width: 2.2, color, cap: 'round' });
  }
  return g;
}

export function chevron(dir: 'up' | 'down', size = 14, color: number = C.text): Graphics {
  const h = size / 2;
  const y = dir === 'up' ? h / 2 : -h / 2;
  return new Graphics()
    .moveTo(-h, y)
    .lineTo(0, -y)
    .lineTo(h, y)
    .stroke({ width: 2.5, color, cap: 'round', join: 'round' });
}
