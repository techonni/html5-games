import { Text, type TextStyleOptions } from 'pixi.js';
import { FONT } from './theme';

// Site e jogos usam escalas diferentes; cada Text acompanha a sua escala real no ecrã
// (verificado a cada frame, com margem para não re-rasterizar durante pequenas animações).
const registry = new Set<Text>();
let dpr = 1;

export function makeText(text: string, style: TextStyleOptions): Text {
  const t = new Text({ text, style: { fontFamily: FONT, ...style }, resolution: dpr });
  registry.add(t);
  t.once('destroyed', () => registry.delete(t));
  return t;
}

export function setDevicePixelRatio(r: number): void {
  dpr = r;
}

/** Ajusta a resolução dos textos à escala do mundo (chamado pelo ticker do site). */
export function updateTextResolutions(): void {
  for (const t of registry) {
    if (!t.visible) continue;
    const m = t.worldTransform;
    const s = Math.hypot(m.a, m.b);
    const target = Math.max(1, Math.round(dpr * s * 4) / 4);
    if (Math.abs(target - t.resolution) / t.resolution > 0.15) t.resolution = target;
  }
}
