import { Container, Graphics } from 'pixi.js';
import { C } from './theme';
import { makeText } from './text';

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

/** Marca zunrel: quadrado azul com "z" + palavra. */
export function logo(size = 28): Container {
  const c = new Container();
  const box = size * 1.25;
  c.addChild(new Graphics().roundRect(0, -box / 2, box, box, box * 0.28).fill(C.btnPrimary));
  const z = makeText('z', { fontSize: size, fontWeight: '900', fontStyle: 'italic', fill: C.text });
  z.anchor.set(0.5);
  z.position.set(box / 2 - 1, -2);
  const word = makeText('zunrel', { fontSize: size, fontWeight: '800', fontStyle: 'italic', fill: C.text, letterSpacing: -0.5 });
  word.anchor.set(0, 0.5);
  word.position.set(box + 10, -1);
  c.addChild(z, word);
  return c;
}
