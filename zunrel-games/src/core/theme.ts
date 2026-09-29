// Tokens de "UI Design Rules – HTML5 Games" convertidos para PixiJS (site + jogos).
export const C = {
  bgBase: 0x1b2836,
  bgStage: 0x111f2b,
  bgPanel: 0x233445,
  bgInput: 0x1b2431,
  bgAddon: 0x405368,
  btnPrimary: 0x3574d8,
  btnSecondary: 0x43586b,
  border: 0x35485c,
  text: 0xffffff,
  textMuted: 0x8fa3b7,
  textPlaceholder: 0x6f8296,
  win: 0x6bdd4a,
  winText: 0x0b1a07,
  loss: 0xbb2a3d,
  coin: 0xf5c631,
  coinText: 0x7a5a00,
  multBlue: 0x3b82f6,
  multRed: 0xe5364b,
  curveStart: 0x67e8f9,
  curveDead: 0x5d7185,
  /** Direção "Sobe" (verde) e "Desce" (vermelho) — os mesmos papéis de ganho/perda. */
  up: 0x6bdd4a,
  down: 0xe5364b,
  line: 0xffffff,
  grid: 0x2a3b4c,
} as const;

export const R = { panel: 16, btn: 14, input: 12 } as const;

export const FONT = 'Figtree, "Proxima Nova", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
