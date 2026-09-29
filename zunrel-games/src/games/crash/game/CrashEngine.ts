/** Velocidade da curva: m(t) = e^(GROWTH·t), com t em ms (≈ 2× aos 11,5 s). */
export const GROWTH = 0.00006;

export const HOUSE_RTP = 0.99;

export type Phase = 'countdown' | 'running' | 'crashed';

export const multiplierAt = (ms: number): number => Math.exp(GROWTH * ms);

/**
 * Ponto de crash com RTP de 99%: P(crash ≥ x) = 0.99 / x.
 * Usa crypto.getRandomValues em vez de Math.random.
 */
export function rollCrashPoint(): number {
  const u = crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
  const raw = HOUSE_RTP / (1 - u);
  return Math.max(1, Math.floor(raw * 100) / 100);
}

export interface EngineEvents {
  phase: (phase: Phase) => void;
  /** Chamado a cada frame da ronda, antes de um eventual crash nesse frame. */
  tick: (multiplier: number) => void;
}

/** Máquina de estados de uma ronda solo: contagem → voo → crash → contagem… */
export class CrashEngine {
  readonly countdownMs = 5000;
  readonly crashedMs = 2600;

  phase: Phase = 'countdown';
  elapsed = 0;
  multiplier = 1;
  round = 1;
  /** Tempo de voo (ms) — mantém-se após o crash para desenhar a curva final. */
  flightMs = 0;
  private crashPoint = rollCrashPoint();

  constructor(private readonly on: EngineEvents) {}

  /** Tempo restante da fase atual (útil para a contagem decrescente). */
  get remaining(): number {
    if (this.phase === 'countdown') return Math.max(0, this.countdownMs - this.elapsed);
    if (this.phase === 'crashed') return Math.max(0, this.crashedMs - this.elapsed);
    return 0;
  }

  update(dtMs: number): void {
    this.elapsed += dtMs;
    switch (this.phase) {
      case 'countdown':
        if (this.elapsed >= this.countdownMs) this.enter('running');
        break;
      case 'running': {
        const m = multiplierAt(this.elapsed);
        const crashed = m >= this.crashPoint;
        this.multiplier = crashed ? this.crashPoint : Math.floor(m * 100) / 100;
        this.flightMs = crashed ? Math.log(this.crashPoint) / GROWTH : this.elapsed;
        this.on.tick(this.multiplier);
        if (crashed) this.enter('crashed');
        break;
      }
      case 'crashed':
        if (this.elapsed >= this.crashedMs) {
          this.round++;
          this.crashPoint = rollCrashPoint();
          this.enter('countdown');
        }
        break;
    }
  }

  private enter(phase: Phase): void {
    this.phase = phase;
    this.elapsed = 0;
    if (phase !== 'crashed') {
      this.multiplier = 1;
      this.flightMs = 0;
    }
    this.on.phase(phase);
  }
}
