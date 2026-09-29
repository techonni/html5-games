import { Howl, Howler } from 'howler';
import { env, render, sine, sweep, toWavUrl } from './synth';

export type SfxName = 'click' | 'bet' | 'tick' | 'launch' | 'cashout' | 'crash' | 'error';

const MUTE_KEY = 'crash-pixi:muted';

/** Pequeno ruído determinístico (evita Math.random a cada amostra). */
function noise(): () => number {
  let s = 22222;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x3fffffff - 1;
  };
}

function build(): Record<SfxName | 'engine', Float32Array> {
  const n = noise();
  let low = 0;
  return {
    click: render(0.05, (t) => sine(1400, t) * env(t, 0.002, 0.012) * 0.35),
    bet: render(0.22, (t) => (t < 0.09 ? sine(660, t) : sine(990, t)) * env(t % 0.09, 0.004, 0.05) * 0.4),
    tick: render(0.08, (t) => sine(1760, t) * env(t, 0.002, 0.02) * 0.3),
    launch: render(0.35, (t) => sweep(220, 880, 0.35, t) * env(t, 0.02, 0.12) * 0.3),
    cashout: render(0.6, (t) => {
      const a = sine(1318.5, t) * env(t, 0.003, 0.18);
      const b = t > 0.08 ? sine(1975.5, t - 0.08) * env(t - 0.08, 0.003, 0.22) : 0;
      return (a + b) * 0.3;
    }),
    crash: render(0.9, (t) => {
      low += (n() - low) * 0.08; // ruído filtrado (grave)
      return (low * 2.2 * env(t, 0.005, 0.18) + sweep(140, 35, 0.9, t) * env(t, 0.005, 0.3)) * 0.55;
    }),
    error: render(0.18, (t) => Math.sign(sine(150, t)) * env(t, 0.004, 0.06) * 0.18),
    // 1 s com número inteiro de ciclos → loop sem cliques.
    engine: render(1, (t) => (sine(110, t) * 0.6 + sine(220, t) * 0.3 + sine(330, t) * 0.1) * (0.8 + 0.2 * sine(6, t)) * 0.5),
  };
}

/** Gestão de som com Howler.js: efeitos, motor em loop com pitch a subir e mute persistente. */
class SoundManager {
  muted = false;
  private sfx: Partial<Record<SfxName, Howl>> = {};
  private engine: Howl | null = null;
  private engineId: number | null = null;

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      /* ignorar */
    }
    Howler.mute(this.muted);
    document.addEventListener('visibilitychange', () => Howler.mute(this.muted || document.hidden));
  }

  /** Cria os Howl a partir dos sons sintetizados (chamado uma vez no arranque). */
  init(): void {
    const data = build();
    for (const name of Object.keys(data) as (SfxName | 'engine')[]) {
      const howl = new Howl({ src: [toWavUrl(data[name])], format: ['wav'], loop: name === 'engine', volume: name === 'engine' ? 0 : 1 });
      if (name === 'engine') this.engine = howl;
      else this.sfx[name] = howl;
    }
  }

  play(name: SfxName, volume = 1): void {
    const h = this.sfx[name];
    if (!h) return;
    const id = h.play();
    h.volume(volume, id);
  }

  startEngine(): void {
    if (!this.engine) return;
    this.stopEngine();
    this.engineId = this.engine.play();
    this.engine.rate(0.8, this.engineId);
    this.engine.fade(0, 0.22, 400, this.engineId);
  }

  /** O tom do motor sobe com o multiplicador. */
  setEngineMultiplier(m: number): void {
    if (this.engine && this.engineId !== null) this.engine.rate(Math.min(2.6, 0.8 + Math.log(m) * 0.55), this.engineId);
  }

  stopEngine(): void {
    if (this.engine && this.engineId !== null) this.engine.stop(this.engineId);
    this.engineId = null;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    Howler.mute(this.muted || document.hidden);
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch {
      /* ignorar */
    }
    return this.muted;
  }
}

export const sound = new SoundManager();
