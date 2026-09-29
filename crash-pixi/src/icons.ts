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

export function chevron(dir: 'up' | 'down', size = 14, color: number = C.text): Graphics {
  const h = size / 2;
  const y = dir === 'up' ? h / 2 : -h / 2;
  return new Graphics()
    .moveTo(-h, y)
    .lineTo(0, -y)
    .lineTo(h, y)
    .stroke({ width: 2.5, color, cap: 'round', join: 'round' });
}
