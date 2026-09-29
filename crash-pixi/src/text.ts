import { Text, type TextStyleOptions } from 'pixi.js';
import { FONT } from './theme';

// Os Text são rasterizados no tamanho de design; como o stage é escalado,
// a resolução acompanha a escala para o texto ficar nítido.
const registry = new Set<Text>();
let resolution = 1;

export function makeText(text: string, style: TextStyleOptions): Text {
  const t = new Text({ text, style: { fontFamily: FONT, ...style }, resolution });
  registry.add(t);
  t.once('destroyed', () => registry.delete(t));
  return t;
}

export function setTextResolution(r: number): void {
  resolution = r;
  for (const t of registry) t.resolution = r;
}
