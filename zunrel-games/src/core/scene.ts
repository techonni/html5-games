import type { Container } from 'pixi.js';

/** Um jogo embutido no site: desenha-se dentro do retângulo que o site lhe dá. */
export interface GameScene {
  readonly view: Container;
  /** Retângulo disponível em pixels do ecrã (CSS). */
  resize(width: number, height: number): void;
  /** Chamado a cada frame; `active` indica se o jogo está visível. */
  update(dtMs: number, active: boolean): void;
  setActive(active: boolean): void;
}
